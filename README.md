# ONDRX Exchange

A non-custodial token swap interface built for the Solana ecosystem. Users can connect their Solana wallet and instantly swap tokens by routing through the deepest on-chain liquidity available — no registration, no custody of funds.

## What it does

- **Instant token swaps** — select any supported Solana token pair and swap in one click
- **Deep liquidity routing** — aggregates liquidity from leading Solana DEXs (Jupiter, Raydium) to find the best rate
- **Non-custodial** — the app never holds user funds; all transactions are signed locally by the user's wallet

## How it works

Users visit the exchange, connect a compatible Solana wallet, choose the tokens they want to swap and the amount, review the quoted output, and confirm the transaction. The swap is executed on-chain through aggregated DEX liquidity pools.

## Deployment

The frontend is deployed as a static site. A serverless RPC proxy keeps API keys server-side.

---

> Environment variables containing API keys are **not** included in this repository. Copy `.env.example` to `.env` and fill in your own keys before running locally.
