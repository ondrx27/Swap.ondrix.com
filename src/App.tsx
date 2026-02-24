import React from 'react';
import { WalletProvider } from './contexts/WalletContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { SwapPanel } from './components/SwapPanel';

const AppContent: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main style={{ flex: 1 }}>
        {/* Hero Section */}
        <section className="hero" style={{ minHeight: 'auto', paddingTop: '10rem', paddingBottom: '4rem' }}>
          {/* Aurora Background */}
          <div className="hero-aurora" />

          <div className="hero-content">
            <p className="hero-subtitle">ONDRX Exchange</p>
            <h1 className="hero-title">Swap Instantly</h1>
            <p className="hero-description">
              A non-custodial swap interface connected deeply to Solana DEX liquidity pools.
            </p>
          </div>

          {/* Swap Panel */}
          <div style={{ marginTop: '2rem', width: '100%', maxWidth: '500px', padding: '0 1rem' }}>
            <SwapPanel />
          </div>
        </section>

        {/* Features Section */}
        <section style={{
          padding: '4rem 2rem',
          background: 'var(--surface-1)',
          borderTop: '1px solid var(--border-subtle)'
        }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <h2 style={{
              textAlign: 'center',
              fontSize: '2rem',
              marginBottom: '3rem',
              background: 'linear-gradient(180deg, #FFFFFF 0%, #C8E6C9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Why Exchange with ONDRX?
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem'
            }}>
              {/* Feature 1 */}
              <div className="card">
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'rgba(0, 255, 136, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                  color: 'var(--primary)',
                  fontSize: '1.5rem'
                }}>
                  ⚡
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Best Rates</h3>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Powered by Jupiter aggregator for optimal routing across all Solana DEXs.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="card">
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'rgba(0, 255, 136, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                  color: 'var(--primary)',
                  fontSize: '1.5rem'
                }}>
                  🛡️
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Non-Custodial</h3>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Users interact directly with on-chain liquidity using their own wallets.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="card">
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'rgba(0, 255, 136, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                  color: 'var(--primary)',
                  fontSize: '1.5rem'
                }}>
                  🔒
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>ONDRX Ecosystem</h3>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Part of the trusted ONDRX ecosystem with escrow, vesting, and transparent operations.
                </p>
              </div>
            </div>

            {/* Fiat On-Ramp Notice */}
            <div style={{
              marginTop: '4rem',
              padding: '1.5rem',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.25rem' }}>
                Implementation Status
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '600px', margin: 0 }}>
                Fiat on-ramp integrations (such as MoonPay or Transak) are currently under evaluation and may be integrated in the future once compliance requirements are completed.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
};

export default App;
