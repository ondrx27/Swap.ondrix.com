import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '../contexts/WalletContext';

export const Header: React.FC = () => {
    const { connected, balance } = useWallet();

    return (
        <header>
            <div className="header-content">
                {/* Logo */}
                <a href="https://ondrix.com" className="header-logo">
                    <img src="/lono.png" alt="ONDRX" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <span>ONDRX</span>
                </a>

                {/* Navigation */}
                <nav className="header-nav" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <a
                        href="https://ondrix.com"
                        style={{
                            color: 'var(--text-secondary)',
                            textDecoration: 'none',
                            fontSize: '0.9rem',
                            transition: 'color 0.2s ease'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                        Home
                    </a>
                    <a
                        href="https://escrow.ondrix.com"
                        style={{
                            color: 'var(--text-secondary)',
                            textDecoration: 'none',
                            fontSize: '0.9rem',
                            transition: 'color 0.2s ease'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                        Escrow
                    </a>
                    <a
                        href="https://vesting.ondrix.com"
                        style={{
                            color: 'var(--text-secondary)',
                            textDecoration: 'none',
                            fontSize: '0.9rem',
                            transition: 'color 0.2s ease'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                        Vesting
                    </a>
                </nav>

                {/* Wallet Section */}
                <div className="header-wallet" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {connected && balance !== null && (
                        <div className="header-balance" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            background: 'var(--surface-2)',
                            borderRadius: '9999px',
                            border: '1px solid var(--border-light)',
                            fontSize: '0.875rem',
                            color: 'var(--text-secondary)'
                        }}>
                            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                {balance.toFixed(4)}
                            </span>
                            <span>SOL</span>
                        </div>
                    )}
                    <WalletMultiButton />
                </div>
            </div>
        </header>
    );
};
