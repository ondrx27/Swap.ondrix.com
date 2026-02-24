import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, Loader2 } from 'lucide-react';
import { searchTokens, getPopularTokens, JupiterToken } from '../services/jupiter';
import { Token } from '../types';

interface TokenSelectorProps {
    selectedToken: Token | null;
    onSelect: (token: Token) => void;
    label: string;
}

// Convert Jupiter token to our Token type
function toToken(jt: JupiterToken): Token {
    return {
        symbol: jt.symbol,
        name: jt.name,
        address: jt.address,
        decimals: jt.decimals,
        logoURI: jt.logoURI,
    };
}

export const TokenSelector: React.FC<TokenSelectorProps> = ({ selectedToken, onSelect, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [tokens, setTokens] = useState<JupiterToken[]>([]);
    const [loading, setLoading] = useState(false);

    // Load popular tokens when modal opens
    useEffect(() => {
        if (isOpen && !searchQuery) {
            setTokens(getPopularTokens());
        }
    }, [isOpen, searchQuery]);

    // Debounced search when query changes
    useEffect(() => {
        if (!isOpen || !searchQuery.trim()) {
            return;
        }

        setLoading(true);
        const timer = setTimeout(() => {
            searchTokens(searchQuery)
                .then(setTokens)
                .finally(() => setLoading(false));
        }, 400);

        return () => clearTimeout(timer);
    }, [searchQuery, isOpen]);

    // Reset to popular tokens when search is cleared
    useEffect(() => {
        if (isOpen && searchQuery === '') {
            setTokens(getPopularTokens());
        }
    }, [searchQuery, isOpen]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handleClose = useCallback(() => {
        setIsOpen(false);
        setSearchQuery('');
    }, []);

    const handleSelect = useCallback((token: JupiterToken) => {
        onSelect(toToken(token));
        handleClose();
    }, [onSelect, handleClose]);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="token-selector"
                style={{ minWidth: '120px' }}
            >
                {selectedToken ? (
                    <>
                        {selectedToken.logoURI && (
                            <img
                                src={selectedToken.logoURI}
                                alt={selectedToken.symbol}
                                style={{ width: 24, height: 24, borderRadius: '50%' }}
                                onError={(e) => e.currentTarget.style.display = 'none'}
                            />
                        )}
                        <span style={{ fontWeight: 600 }}>{selectedToken.symbol}</span>
                    </>
                ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Select</span>
                )}
                <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
            </button>

            {isOpen && createPortal(
                <div className="modal-overlay" onClick={handleClose}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '1.5rem'
                        }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Select {label} Token</h3>
                            <button
                                onClick={handleClose}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '0.5rem',
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search Input */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            background: 'var(--surface-1)',
                            border: '1px solid var(--border-light)',
                            borderRadius: '12px',
                            padding: '0.75rem 1rem',
                            marginBottom: '1rem'
                        }}>
                            <Search size={18} style={{ color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search by name or paste address..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text)',
                                    fontSize: '1rem',
                                    width: '100%',
                                    outline: 'none',
                                }}
                            />
                            {loading && <Loader2 size={18} className="animate-spin" style={{ color: 'var(--primary)' }} />}
                        </div>

                        {/* Label */}
                        <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-dim)',
                            marginBottom: '0.75rem',
                            textAlign: 'center'
                        }}>
                            {searchQuery ? 'Search results' : 'Popular tokens'} • Powered by <span style={{ color: 'var(--primary)' }}>Jupiter</span>
                        </div>

                        {/* Token List */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                            maxHeight: '400px',
                            overflowY: 'auto',
                            paddingRight: '0.5rem'
                        }}>
                            {loading ? (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '2rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    <Loader2 size={24} className="animate-spin" style={{ marginRight: '0.5rem' }} />
                                    Searching...
                                </div>
                            ) : tokens.length === 0 ? (
                                <div style={{
                                    padding: '2rem',
                                    textAlign: 'center',
                                    color: 'var(--text-muted)'
                                }}>
                                    No tokens found for "{searchQuery}"
                                </div>
                            ) : (
                                tokens.map((token) => (
                                    <button
                                        key={token.address}
                                        onClick={() => handleSelect(token)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.75rem 1rem',
                                            background: selectedToken?.address === token.address ? 'var(--surface-3)' : 'transparent',
                                            border: selectedToken?.address === token.address ? '1px solid var(--primary)' : '1px solid transparent',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            width: '100%',
                                            transition: 'all 0.15s ease',
                                        }}
                                        onMouseOver={(e) => {
                                            if (selectedToken?.address !== token.address) {
                                                e.currentTarget.style.background = 'var(--surface-2)';
                                            }
                                        }}
                                        onMouseOut={(e) => {
                                            if (selectedToken?.address !== token.address) {
                                                e.currentTarget.style.background = 'transparent';
                                            }
                                        }}
                                    >
                                        {/* Token Logo */}
                                        <div style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: '50%',
                                            background: 'var(--surface-3)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            overflow: 'hidden',
                                            flexShrink: 0
                                        }}>
                                            {token.logoURI ? (
                                                <img
                                                    src={token.logoURI}
                                                    alt={token.symbol}
                                                    style={{ width: 36, height: 36 }}
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>
                                                    {token.symbol.slice(0, 2)}
                                                </span>
                                            )}
                                        </div>

                                        {/* Token Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                                                {token.symbol}
                                            </div>
                                            <div style={{
                                                fontSize: '0.85rem',
                                                color: 'var(--text-muted)',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>
                                                {token.name}
                                            </div>
                                        </div>

                                        {/* Token Address (shortened) */}
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--text-dim)',
                                            fontFamily: 'monospace'
                                        }}>
                                            {token.address.slice(0, 4)}...{token.address.slice(-4)}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
