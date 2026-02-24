import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider, useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { Connection, PublicKey, LAMPORTS_PER_SOL, VersionedTransaction } from '@solana/web3.js';

interface WalletContextType {
    publicKey: PublicKey | null;
    connected: boolean;
    connecting: boolean;
    disconnect: () => Promise<void>;
    balance: number | null;
    refreshBalance: () => Promise<void>;
    signTransaction: (<T extends VersionedTransaction>(transaction: T) => Promise<T>) | undefined;
    connection: Connection | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function useWallet() {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
}

interface WalletProviderProps {
    children: ReactNode;
}

function WalletContextProvider({ children }: WalletProviderProps) {
    const { publicKey, connected, connecting, disconnect, signTransaction } = useSolanaWallet();
    const { connection } = useConnection();
    const [balance, setBalance] = React.useState<number | null>(null);

    const refreshBalance = React.useCallback(async () => {
        if (publicKey && connection) {
            try {
                const lamports = await connection.getBalance(publicKey);
                setBalance(lamports / LAMPORTS_PER_SOL);
            } catch (error) {
                console.error('Failed to fetch balance:', error);
                setBalance(null);
            }
        } else {
            setBalance(null);
        }
    }, [publicKey, connection]);

    // Balance is NOT auto-fetched on mount to avoid rate limits
    // Use refreshBalance() manually when needed, or use useTokenBalance hook

    const value = useMemo(() => ({
        publicKey,
        connected,
        connecting,
        disconnect,
        balance,
        refreshBalance,
        signTransaction,
        connection,
    }), [publicKey, connected, connecting, disconnect, balance, refreshBalance, signTransaction, connection]);

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
}

export function WalletProvider({ children }: WalletProviderProps) {
    // RPC endpoint strategy:
    // - Dev: VITE_HELIUS_API_KEY is in .env → use Helius directly (NOT bundled into prod
    //   because Cloudflare Pages only receives HELIUS_API_KEY without the VITE_ prefix).
    // - Prod: route through the /api/rpc Cloudflare Pages Function so the key stays server-side.
    //   Computed inside useMemo so it runs in browser context (window is guaranteed valid),
    //   avoiding the vite-plugin-node-polyfills global shim issue that causes window.location
    //   to be undefined when evaluated at module scope during the build phase.
    const endpoint = useMemo(() => {
        // Priority 1 — local dev: VITE_HELIUS_API_KEY in .env → direct Helius connection
        if (import.meta.env.VITE_HELIUS_API_KEY) {
            return `https://mainnet.helius-rpc.com/?api-key=${import.meta.env.VITE_HELIUS_API_KEY}`;
        }
        // Priority 2 — production: explicit proxy URL set in Cloudflare Pages env vars
        // Add VITE_RPC_URL = https://<your-domain>/api/rpc  (text type, not secret)
        if (import.meta.env.VITE_RPC_URL) {
            return import.meta.env.VITE_RPC_URL as string;
        }
        // Priority 3 — fallback via window.location.origin (browser context guaranteed in useMemo)
        const origin = window.location.origin;
        if (origin && origin !== 'null') {
            return `${origin}/api/rpc`;
        }
        return 'https://api.mainnet-beta.solana.com';
    }, []);

    // Empty array - wallet-adapter will auto-detect installed wallets via Standard Wallet Protocol
    // This avoids duplication issues with MetaMask and other wallets
    const wallets = useMemo(() => [], []);

    return (
        <ConnectionProvider endpoint={endpoint}>
            <SolanaWalletProvider
                wallets={wallets}
                autoConnect={false}
                onError={(error) => console.error('Wallet error:', error)}
            >
                <WalletModalProvider>
                    <WalletContextProvider>
                        {children}
                    </WalletContextProvider>
                </WalletModalProvider>
            </SolanaWalletProvider>
        </ConnectionProvider>
    );
}
