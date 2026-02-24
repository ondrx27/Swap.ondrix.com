# ONDRX Exchange

A non-custodial token swap interface built for the Solana ecosystem. Users can connect their Solana wallet and instantly swap tokens by routing through the deepest on-chain liquidity available — no registration, no custody of funds.

## What it does

- **Instant token swaps** — select any supported Solana token pair and swap in one click
- **Deep liquidity routing** — aggregates liquidity from leading Solana DEXs to find the best rate
- **Fiat on-ramp** — buy crypto directly with a credit/debit card via integrated payment partners (Transak, MoonPay)
- **Non-custodial** — the app never holds user funds; all transactions are signed locally by the user's wallet

## How it works

Users visit the exchange, connect a compatible Solana wallet, choose the tokens they want to swap and the amount, review the quoted output, and confirm the transaction. The swap is executed on-chain through aggregated DEX liquidity pools. Users who don't yet hold crypto can purchase SOL or USDC directly via the integrated fiat on-ramp widget before swapping.

## Deployment

The frontend is deployed as a static site. Backend API routes (fiat on-ramp signing, quote fetching) run as serverless functions on the same domain, eliminating cross-origin issues.

---

> Environment variables containing API keys are **not** included in this repository. Copy `.env.example` to `.env` and fill in your own keys before running locally.
