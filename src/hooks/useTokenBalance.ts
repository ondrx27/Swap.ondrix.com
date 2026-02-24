import { useState, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { useWallet } from '../contexts/WalletContext';

// Native SOL mint address
const SOL_MINT = 'So11111111111111111111111111111111111111112';

interface TokenBalance {
    balance: number;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<number>;
}

/**
 * Hook to fetch token balance for a specific mint
 */
export function useTokenBalance(mintAddress: string | null, decimals: number = 9): TokenBalance {
    const { publicKey } = useWallet();
    const { connection } = useConnection();
    const [balance, setBalance] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBalance = useCallback(async (): Promise<number> => {
        if (!publicKey || !mintAddress || !connection) {
            setBalance(0);
            return 0;
        }

        setLoading(true);
        setError(null);

        try {
            let newBalance = 0;
            // Check if it's native SOL
            if (mintAddress === SOL_MINT) {
                const lamports = await connection.getBalance(publicKey);
                newBalance = lamports / LAMPORTS_PER_SOL;
                setBalance(newBalance);
            } else {
                // SPL Token
                const mintPubkey = new PublicKey(mintAddress);
                const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);

                try {
                    const account = await getAccount(connection, ata);
                    newBalance = Number(account.amount) / Math.pow(10, decimals);
                    setBalance(newBalance);
                } catch {
                    // Account doesn't exist - balance is 0
                    setBalance(0);
                }
            }
            return newBalance;
        } catch (err) {
            console.error('Failed to fetch token balance:', err);
            setError('Failed to fetch balance');
            setBalance(0);
            return 0;
        } finally {
            setLoading(false);
        }
    }, [publicKey, mintAddress, decimals, connection]);

    // Fetch on mount and when dependencies change
    useEffect(() => {
        fetchBalance();
    }, [fetchBalance]);

    return {
        balance,
        loading,
        error,
        refresh: fetchBalance,
    };
}

/**
 * Check if user has sufficient balance for a swap
 */
export function checkSufficientBalance(
    userBalance: number,
    requiredAmount: number
): { sufficient: boolean; shortfall: number } {
    const sufficient = userBalance >= requiredAmount;
    const shortfall = sufficient ? 0 : requiredAmount - userBalance;

    return { sufficient, shortfall };
}
