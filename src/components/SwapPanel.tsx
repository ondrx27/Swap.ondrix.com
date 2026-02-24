import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownUp, Loader2, AlertCircle, Wallet, Check, Copy, ExternalLink } from 'lucide-react';
import { TokenSelector } from './TokenSelector';
// import { BuyDialog } from './BuyDialog';
import { Token } from '../types';
import { POPULAR_TOKENS } from '../services/jupiter';
import { getRaydiumQuote } from '../services/raydium';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { checkSufficientBalance } from '../utils/solanaUtils';

// ... (keep constants)
// Jupiter API configuration
const JUPITER_API = 'https://api.jup.ag';
const API_KEY = import.meta.env.VITE_JUPITER_API_KEY || '';
const MOCK_MODE = false;
const BUYABLE_TOKENS = ['SOL', 'USDT', 'USDC'];

type SwapProvider = 'jupiter' | 'raydium' | null;

export const SwapPanel: React.FC = () => {
    const { connection } = useConnection();
    const { publicKey, signTransaction, connected } = useWallet();

    // State
    const [fromToken, setFromToken] = useState<Token | null>(POPULAR_TOKENS[0]); // SOL
    const [toToken, setToToken] = useState<Token | null>(POPULAR_TOKENS[1]); // USDC
    const [fromAmount, setFromAmount] = useState<string>('');
    const [toAmount, setToAmount] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // const [showBuyDialog, setShowBuyDialog] = useState(false);
    const [slippage, setSlippage] = useState(0.5); // 0.5%
    const [provider, setProvider] = useState<SwapProvider>(null);
    const [notTradable, setNotTradable] = useState(false);
    const [insufficientBalance, setInsufficientBalance] = useState(false);
    const [shortfall, setShortfall] = useState(0);
    const [swapSuccess, setSwapSuccess] = useState(false);
    const [lastTxSignature, setLastTxSignature] = useState<string | null>(null);
    const [copied, setCopied] = useState(false); // For copy button feedback

    // Get balance for the "from" token
    const { balance: fromTokenBalance, loading: balanceLoading, refresh: refreshBalance } = useTokenBalance(
        fromToken?.address || null,
        fromToken?.decimals || 9
    );

    // Check balance when amount or balance changes (skip in mock mode)
    useEffect(() => {
        if (MOCK_MODE) {
            setInsufficientBalance(false);
            setShortfall(0);
            return;
        }

        if (fromAmount && fromTokenBalance !== undefined) {
            const amount = parseFloat(fromAmount);
            if (!isNaN(amount)) {
                const { sufficient, shortfall: diff } = checkSufficientBalance(fromTokenBalance, amount);
                setInsufficientBalance(!sufficient);
                setShortfall(diff);
            } else {
                setInsufficientBalance(false);
                setShortfall(0);
            }
        } else {
            setInsufficientBalance(false);
            setShortfall(0);
        }
    }, [fromAmount, fromTokenBalance]);

    // Helper to fetch Jupiter Quote
    const getJupiterQuote = async (inputMint: string, outputMint: string, amount: number, slippageBps: number) => {
        const response = await fetch(
            `${JUPITER_API}/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`,
            {
                method: 'GET',
                headers: { 'x-api-key': API_KEY },
            }
        );
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (errorData.errorCode === 'TOKEN_NOT_TRADABLE') {
                throw new Error('TOKEN_NOT_TRADABLE');
            }
            throw new Error(errorData.error || 'Jupiter quote failed');
        }
        return await response.json();
    };

    // First try Jupiter, then Raydium
    const fetchQuote = useCallback(async () => {
        if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
            setToAmount('');
            setProvider(null);
            setNotTradable(false);
            return;
        }

        setLoading(true);
        setError(null);
        setNotTradable(false);

        const inputAmount = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals));
        const slippageBps = Math.floor(slippage * 100);

        // Try Jupiter first
        try {
            const quote = await getJupiterQuote(fromToken.address, toToken.address, inputAmount, slippageBps);

            const outputAmount = parseInt(quote.outAmount) / Math.pow(10, toToken.decimals);
            setToAmount(outputAmount.toFixed(6));
            setProvider('jupiter');
            setLoading(false);
            return;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            if (message !== 'TOKEN_NOT_TRADABLE') {
                console.log('Jupiter failed, trying Raydium fallback...', err);
            } else {
                console.log('Token not tradable on Jupiter, trying Raydium...');
            }
        }

        // Fallback to Raydium (existing logic)
        try {
            const raydiumQuote = await getRaydiumQuote(
                fromToken.address,
                toToken.address,
                inputAmount,
                slippageBps
            );

            if (raydiumQuote) {
                const outputAmount = parseInt(raydiumQuote.outputAmount) / Math.pow(10, toToken.decimals);
                setToAmount(outputAmount.toFixed(6));
                setProvider('raydium');
                setLoading(false);
                return;
            }
        } catch (err) {
            console.error('Raydium quote failed:', err);
        }

        // Both failed - token not tradable
        setNotTradable(true);
        setProvider(null);
        setToAmount('');
        setError('This token pair is not tradable on Jupiter or Raydium');
        setLoading(false);
    }, [fromToken, toToken, fromAmount, slippage]);

    // Debounce quote fetching
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchQuote();
        }, 500);
        return () => clearTimeout(timer);
    }, [fetchQuote]);

    // Swap tokens
    const handleSwapTokens = () => {
        const tempToken = fromToken;
        const tempAmount = fromAmount;
        setFromToken(toToken);
        setToToken(tempToken);
        setFromAmount(toAmount);
        setToAmount(tempAmount);
    };

    // Execute swap - with balance check
    const handleSwap = async () => {
        if (!connected) {
            return;
        }

        if (!fromToken || !toToken || !fromAmount || !publicKey || notTradable) {
            return;
        }

        // Re-check balance before swap (skip in mock mode)
        if (!MOCK_MODE) {
            const currentBalance = await refreshBalance();

            const amount = parseFloat(fromAmount);
            // Use currentBalance instead of potentially stale fromTokenBalance
            const { sufficient, shortfall: diff } = checkSufficientBalance(currentBalance, amount);

            if (!sufficient) {
                setInsufficientBalance(true);
                setShortfall(diff);
                // setShowBuyDialog(true); // Temporarily disabled
                return;
            }
        }

        setLoading(true);
        setError(null);
        setSwapSuccess(false);

        const inputAmount = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals));
        const slippageBps = Math.floor(slippage * 100);

        try {
            // MOCK MODE: Get real transaction and send to wallet for signing
            // User can review and CANCEL in their wallet
            if (MOCK_MODE) {
                if (!signTransaction || !connection) {
                    throw new Error('Wallet does not support transaction signing');
                }


                let swapTransactionBase64: string | null = null;

                if (provider === 'jupiter') {
                    const quoteResponse = await fetch(
                        `${JUPITER_API}/swap/v1/quote?inputMint=${fromToken.address}&outputMint=${toToken.address}&amount=${inputAmount}&slippageBps=${slippageBps}`,
                        { method: 'GET', headers: { 'x-api-key': API_KEY } }
                    );

                    if (!quoteResponse.ok) {
                        throw new Error('Failed to get Jupiter quote');
                    }

                    const quote = await quoteResponse.json();

                    const swapResponse = await fetch(`${JUPITER_API}/swap/v1/swap`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
                        body: JSON.stringify({
                            quoteResponse: quote,
                            userPublicKey: publicKey.toString(),
                            wrapAndUnwrapSol: true,
                        }),
                    });

                    if (!swapResponse.ok) {
                        throw new Error('Failed to create swap transaction');
                    }

                    const { swapTransaction } = await swapResponse.json();
                    swapTransactionBase64 = swapTransaction;
                }

                if (swapTransactionBase64) {
                    // Deserialize and send to wallet for signing
                    const transactionBuffer = Buffer.from(swapTransactionBase64, 'base64');
                    const transaction = VersionedTransaction.deserialize(transactionBuffer);

                    try {
                        // This will open wallet popup - user can cancel here
                        await signTransaction(transaction);

                        setSwapSuccess(true);
                        setTimeout(() => {
                            setSwapSuccess(false);
                            setFromAmount('');
                            setToAmount('');
                        }, 4000);

                    } catch (signError: unknown) {
                        // User cancelled - this is expected in mock mode
                        const errorMessage = signError instanceof Error ? signError.message : 'Unknown error';
                        if (errorMessage.includes('User rejected') || errorMessage.includes('cancelled')) {
                            setError('Transaction cancelled by user');
                        } else {
                            throw signError;
                        }
                    }
                }

                return; // MOCK_MODE: do not broadcast transaction
            }

            // REAL MODE: Execute actual swap
            if (!signTransaction || !connection) {
                throw new Error('Wallet does not support transaction signing');
            }

            let swapTransactionBase64: string | null = null;

            if (provider === 'jupiter') {
                // Jupiter swap
                const quoteResponse = await fetch(
                    `${JUPITER_API}/swap/v1/quote?inputMint=${fromToken.address}&outputMint=${toToken.address}&amount=${inputAmount}&slippageBps=${slippageBps}`,
                    {
                        method: 'GET',
                        headers: { 'x-api-key': API_KEY },
                    }
                );
                // Check HTTP status before parsing body (SBG-06)
                if (!quoteResponse.ok) {
                    throw new Error('Failed to get Jupiter quote');
                }
                const quote = await quoteResponse.json();

                const swapResponse = await fetch(`${JUPITER_API}/swap/v1/swap`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': API_KEY,
                    },
                    body: JSON.stringify({
                        quoteResponse: quote,
                        userPublicKey: publicKey.toString(),
                        wrapAndUnwrapSol: true,
                    }),
                });

                if (!swapResponse.ok) {
                    throw new Error('Failed to create Jupiter swap transaction');
                }

                const { swapTransaction } = await swapResponse.json();
                swapTransactionBase64 = swapTransaction;
            } else if (provider === 'raydium') {
                // Raydium swap - get transaction
                const url = new URL('https://transaction-v1.raydium.io/transaction/swap-base-in');
                url.searchParams.set('inputMint', fromToken.address);
                url.searchParams.set('outputMint', toToken.address);
                url.searchParams.set('amount', inputAmount.toString());
                url.searchParams.set('slippageBps', slippageBps.toString());
                url.searchParams.set('txVersion', 'V0');
                url.searchParams.set('wallet', publicKey.toString());

                const response = await fetch(url.toString(), {
                    method: 'GET',
                    headers: { 'accept': 'application/json' },
                });

                if (!response.ok) {
                    throw new Error('Failed to create Raydium swap transaction');
                }

                const data = await response.json();
                // Raydium returns transaction in data.data
                if (data.data && data.data[0]) {
                    swapTransactionBase64 = data.data[0].transaction;
                }
            }

            // Sign and send the transaction
            if (swapTransactionBase64) {
                const transactionBuffer = Buffer.from(swapTransactionBase64, 'base64');
                const transaction = VersionedTransaction.deserialize(transactionBuffer);

                // Sign with wallet
                const signedTransaction = await signTransaction(transaction);

                // Send to blockchain
                const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed',
                });

                // Wait for confirmation with timeout strategy
                // Race between confirmation and timeout
                const confirmationPromise = connection.confirmTransaction(signature, 'confirmed');
                const timeoutPromise = new Promise<{ value: { err: unknown } }>((_, reject) =>
                    setTimeout(() => reject(new Error('Transaction confirmation timed out')), 60000)
                );

                // Race the confirmation against the timeout
                // We cast connection.confirmTransaction result to match our timeout promise for easier racing
                const confirmation = await Promise.race([
                    confirmationPromise,
                    timeoutPromise
                ]) as Awaited<ReturnType<typeof connection.confirmTransaction>>;

                if (confirmation.value.err) {
                    throw new Error('Transaction failed: ' + JSON.stringify(confirmation.value.err));
                }

                setLastTxSignature(signature); // Store signature
                setSwapSuccess(true);
                setFromAmount('');
                setToAmount('');
                refreshBalance();

                // Removed auto-close timeout to let user see and copy the hash
            }
        } catch (err: unknown) {
            // Allow user rejection to pass silently or with specific message
            const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);

            if (errorMessage.includes('User rejected') || errorMessage.includes('0x0')) {
                setError('Transaction cancelled by user');
            } else if (errorMessage.includes('slippage')) {
                setError('Slippage tolerance exceeded. Try increasing slippage.');
            } else if (errorMessage.includes('timed out')) {
                // Even if timed out, it might have succeeded on chain - warn user to check explorer
                setError('Confirmation timed out. Check Solana Explorer for status.');
            } else {
                setError('Swap failed. ' + (err instanceof Error ? err.message : 'Unknown error'));
            }
        } finally {
            setLoading(false);
        }
    };

    const getButtonText = () => {
        if (!connected) return 'Connect Wallet';
        if (loading || balanceLoading) return 'Loading...';
        if (!fromAmount || parseFloat(fromAmount) <= 0) return 'Enter Amount';
        if (notTradable) return 'Not Tradable';
        if (insufficientBalance) return 'Insufficient Balance';
        if (!fromToken || !toToken) return 'Select Tokens';
        return `Swap via ${provider === 'raydium' ? 'Raydium' : 'Jupiter'}`;
    };

    const isButtonDisabled = () => {
        if (!connected) return false;
        if (loading || balanceLoading) return true;
        if (notTradable) return true;
        if (!fromAmount || parseFloat(fromAmount) <= 0) return true;
        if (!fromToken || !toToken) return true;
        // Disable for insufficient balance (On-ramp disabled)
        if (insufficientBalance) return true;

        return false;
    };

    return (
        <>
            <div className="swap-panel">
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1.5rem'
                }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Swap</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Slippage:</span>
                        <select
                            value={slippage}
                            onChange={(e) => setSlippage(parseFloat(e.target.value))}
                            style={{
                                background: 'var(--surface-3)',
                                border: '1px solid var(--border-light)',
                                borderRadius: '8px',
                                padding: '0.25rem 0.5rem',
                                color: 'var(--text)',
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                            }}
                        >
                            <option value={0.1}>0.1%</option>
                            <option value={0.5}>0.5%</option>
                            <option value={1}>1%</option>
                            <option value={3}>3%</option>
                        </select>
                    </div>
                </div>

                {/* From Token */}
                <div className="token-input-container" style={{ marginBottom: '0.5rem' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.75rem'
                    }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>From</span>
                        {connected && fromToken && (
                            <button
                                onClick={() => setFromAmount(fromTokenBalance.toString())}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: insufficientBalance ? 'var(--error)' : 'var(--primary)',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                }}
                            >
                                <Wallet size={14} />
                                {balanceLoading ? '...' : fromTokenBalance.toFixed(4)} MAX
                            </button>
                        )}
                    </div>
                    <div className="mobile-input-row" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input
                            type="number"
                            placeholder="0.00"
                            value={fromAmount}
                            onChange={(e) => setFromAmount(e.target.value)}
                            className="token-amount-input"
                            style={{
                                flex: 1,
                                borderColor: insufficientBalance ? 'var(--error)' : undefined
                            }}
                        />
                        <TokenSelector
                            selectedToken={fromToken}
                            onSelect={setFromToken}
                            label="From"
                        />
                    </div>
                    {/* Exact amount footnote */}
                    {fromAmount && fromAmount.length > 8 && (
                        <div className="exact-amount-note">
                            {fromAmount} {fromToken?.symbol}
                        </div>
                    )}
                </div>

                {/* Swap Arrow */}
                <button className="swap-arrow" onClick={handleSwapTokens}>
                    <ArrowDownUp size={20} />
                </button>

                {/* To Token */}
                <div className="token-input-container" style={{ marginTop: '0.5rem' }}>
                    <div style={{ marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>To</span>
                    </div>
                    <div className="mobile-input-row" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input
                            type="text"
                            placeholder="0.00"
                            value={loading ? '...' : toAmount}
                            readOnly
                            className="token-amount-input"
                            style={{ flex: 1, color: loading ? 'var(--text-dim)' : 'var(--text)' }}
                        />
                        <TokenSelector
                            selectedToken={toToken}
                            onSelect={setToToken}
                            label="To"
                        />
                    </div>
                    {/* Exact amount footnote */}
                    {toAmount && toAmount.length > 8 && !loading && (
                        <div className="exact-amount-note">
                            {toAmount} {toToken?.symbol}
                        </div>
                    )}
                </div>

                {/* Provider Badge */}
                {provider && toAmount && !loading && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        marginTop: '1rem',
                        padding: '0.5rem',
                        background: provider === 'raydium' ? 'rgba(155, 89, 182, 0.1)' : 'rgba(0, 255, 136, 0.1)',
                        border: `1px solid ${provider === 'raydium' ? 'rgba(155, 89, 182, 0.3)' : 'rgba(0, 255, 136, 0.3)'}`,
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        color: provider === 'raydium' ? '#9b59b6' : 'var(--primary)',
                    }}>
                        Route via {provider === 'raydium' ? '🔮 Raydium' : '🪐 Jupiter'}
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginTop: '1rem',
                        padding: '0.75rem',
                        background: 'rgba(248, 113, 113, 0.1)',
                        border: '1px solid rgba(248, 113, 113, 0.3)',
                        borderRadius: '12px',
                        color: 'var(--error)',
                        fontSize: '0.875rem'
                    }}>
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                {/* Success Message */}
                {swapSuccess && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        marginTop: '1rem',
                        padding: '1rem',
                        background: 'rgba(0, 255, 136, 0.1)',
                        border: '1px solid rgba(0, 255, 136, 0.3)',
                        borderRadius: '12px',
                        color: 'var(--primary)',
                        fontSize: '1rem',
                        fontWeight: 600
                    }}>
                        ✅ Swap Successful!
                        {MOCK_MODE && <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>(Mock)</span>}
                    </div>
                )}

                {/* Insufficient Balance Warning */}
                {insufficientBalance && !error && fromAmount && !MOCK_MODE && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginTop: '1rem',
                        padding: '0.75rem',
                        background: 'rgba(251, 191, 36, 0.1)',
                        border: '1px solid rgba(251, 191, 36, 0.3)',
                        borderRadius: '12px',
                        color: 'var(--warning)',
                        fontSize: '0.875rem'
                    }}>
                        <AlertCircle size={16} />
                        {BUYABLE_TOKENS.includes(fromToken?.symbol || '')
                            ? `Need ${shortfall.toFixed(4)} more ${fromToken?.symbol}. Click swap to buy crypto.`
                            : `Not enough ${fromToken?.symbol}. You need ${shortfall.toFixed(4)} more.`
                        }
                    </div>
                )}

                {/* Swap Button */}
                <button
                    onClick={handleSwap}
                    disabled={isButtonDisabled()}
                    className="glow-button"
                    style={{
                        width: '100%',
                        marginTop: '1.5rem',
                        padding: '1rem',
                        fontSize: '1rem',
                        background: insufficientBalance && !isButtonDisabled() && !MOCK_MODE && BUYABLE_TOKENS.includes(fromToken?.symbol || '')
                            ? 'linear-gradient(120deg, #f59e0b, #d97706)'
                            : undefined
                    }}
                >
                    {(loading || balanceLoading) && <Loader2 size={18} className="animate-spin" />}
                    {insufficientBalance && connected && fromAmount && !MOCK_MODE
                        ? 'Not Enough Tokens'
                        : getButtonText()
                    }
                </button>

                {/* Powered by */}
                <div style={{
                    marginTop: '1rem',
                    textAlign: 'center',
                    fontSize: '0.8rem',
                    color: 'var(--text-dim)'
                }}>
                    Powered by <span style={{ color: 'var(--primary)' }}>Jupiter</span> + <span style={{ color: '#9b59b6' }}>Raydium</span>
                </div>
            </div>

            {/* Buy Crypto Dialog */}
            {/* Buy Crypto Dialog - Temporarily Disabled */}
            {/* <BuyDialog
                isOpen={showBuyDialog}
                onClose={() => setShowBuyDialog(false)}
                userWalletAddress={publicKey?.toString()}
                tokenSymbol={fromToken?.symbol || 'SOL'}
                requiredAmount={shortfall} // Pass shortfall number, not boolean
            /> */}

            {/* Success Modal */}
            {swapSuccess && createPortal(
                <div
                    className="modal-overlay"
                    onClick={() => setSwapSuccess(false)}
                >
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxWidth: '400px',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '1.5rem',
                            padding: '2.5rem 2rem'
                        }}
                    >
                        {/* Success Icon Animation */}
                        <div style={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            background: 'rgba(0, 255, 136, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid var(--primary)',
                            boxShadow: '0 0 30px rgba(0, 255, 136, 0.2)'
                        }}>
                            <Check size={40} style={{ color: 'var(--primary)' }} />
                        </div>

                        <div>
                            <h3 style={{
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                marginBottom: '0.5rem',
                                background: 'linear-gradient(to right, #fff, #ccc)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}>
                                Swap Successful!
                            </h3>
                            <p style={{ color: 'var(--text-muted)' }}>
                                Your transaction has been confirmed on the blockchain.
                            </p>
                        </div>

                        {lastTxSignature && (
                            <div style={{ width: '100%', maxWidth: '320px' }}>
                                <div style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--text-dim)',
                                    marginBottom: '0.5rem',
                                    textAlign: 'left'
                                }}>
                                    Transaction Hash
                                </div>
                                <div style={{
                                    background: 'var(--surface-1)',
                                    border: '1px solid var(--border-light)',
                                    borderRadius: '12px',
                                    padding: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.5rem'
                                }}>
                                    <span style={{
                                        fontFamily: 'monospace',
                                        color: 'var(--text)',
                                        fontSize: '0.9rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {lastTxSignature.slice(0, 16)}...{lastTxSignature.slice(-16)}
                                    </span>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(lastTxSignature);
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 2000);
                                        }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: copied ? 'var(--primary)' : 'var(--text-muted)',
                                            padding: '0.25rem',
                                            transition: 'color 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        title="Copy Hash"
                                    >
                                        {copied ? <Check size={18} /> : <Copy size={18} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
                            <button
                                onClick={() => setSwapSuccess(false)}
                                style={{
                                    flex: 1,
                                    padding: '0.9rem',
                                    borderRadius: '12px',
                                    background: 'var(--surface-3)',
                                    border: '1px solid var(--border-light)',
                                    color: 'var(--text)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Close
                            </button>
                            {lastTxSignature && (
                                <a
                                    href={`https://solscan.io/tx/${lastTxSignature}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        flex: 1,
                                        padding: '0.9rem',
                                        borderRadius: '12px',
                                        background: 'rgba(0, 255, 136, 0.1)',
                                        border: '1px solid rgba(0, 255, 136, 0.2)',
                                        color: 'var(--primary)',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        textDecoration: 'none',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Explorer <ExternalLink size={16} />
                                </a>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
