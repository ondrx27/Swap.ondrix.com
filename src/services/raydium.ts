// Raydium API Service - Fallback for tokens not tradable on Jupiter

const RAYDIUM_API = 'https://transaction-v1.raydium.io';
const RAYDIUM_PRICE_API = 'https://api-v3.raydium.io';

export interface RaydiumQuote {
    inputMint: string;
    inputAmount: string;
    outputMint: string;
    outputAmount: string;
    otherAmountThreshold: string;
    slippageBps: number;
    priceImpactPct: number;
    routePlan: RaydiumRoute[];
}

export interface RaydiumRoute {
    poolId: string;
    inputMint: string;
    outputMint: string;
    feeMint: string;
    feeRate: number;
    feeAmount: string;
}

interface RaydiumQuoteResponse {
    id: string;
    success: boolean;
    version: string;
    data: RaydiumQuote;
}

interface RaydiumPriceResponse {
    id: string;
    success: boolean;
    data: Record<string, string>;
}

/**
 * Check if token is tradable on Raydium by fetching its price
 */
export async function isTokenTradableOnRaydium(mintAddress: string): Promise<boolean> {
    try {
        const response = await fetch(
            `${RAYDIUM_PRICE_API}/mint/price?mints=${mintAddress}`,
            {
                method: 'GET',
                headers: { 'accept': 'application/json' },
            }
        );

        if (!response.ok) return false;

        const data: RaydiumPriceResponse = await response.json();
        return data.success && data.data[mintAddress] !== undefined;
    } catch {
        return false;
    }
}

/**
 * Get token price from Raydium
 */
export async function getRaydiumPrice(mintAddress: string): Promise<number | null> {
    try {
        const response = await fetch(
            `${RAYDIUM_PRICE_API}/mint/price?mints=${mintAddress}`,
            {
                method: 'GET',
                headers: { 'accept': 'application/json' },
            }
        );

        if (!response.ok) return null;

        const data: RaydiumPriceResponse = await response.json();
        if (data.success && data.data[mintAddress]) {
            return parseFloat(data.data[mintAddress]);
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Get swap quote from Raydium
 */
export async function getRaydiumQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50
): Promise<RaydiumQuote | null> {
    try {
        const url = new URL(`${RAYDIUM_API}/compute/swap-base-in`);
        url.searchParams.set('inputMint', inputMint);
        url.searchParams.set('outputMint', outputMint);
        url.searchParams.set('amount', amount.toString());
        url.searchParams.set('slippageBps', slippageBps.toString());
        url.searchParams.set('txVersion', 'V0');

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: { 'accept': 'application/json' },
        });

        if (!response.ok) {
            console.error('Raydium quote failed:', response.status);
            return null;
        }

        const data: RaydiumQuoteResponse = await response.json();

        if (data.success && data.data) {
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Raydium quote error:', error);
        return null;
    }
}

/**
 * Build swap transaction from Raydium
 */
export async function buildRaydiumSwapTransaction(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number,
    userPublicKey: string
): Promise<string | null> {
    try {
        // First get the quote
        const quote = await getRaydiumQuote(inputMint, outputMint, amount, slippageBps);
        if (!quote) return null;

        // Then request the transaction
        const url = new URL(`${RAYDIUM_API}/transaction/swap-base-in`);
        url.searchParams.set('inputMint', inputMint);
        url.searchParams.set('outputMint', outputMint);
        url.searchParams.set('amount', amount.toString());
        url.searchParams.set('slippageBps', slippageBps.toString());
        url.searchParams.set('txVersion', 'V0');
        url.searchParams.set('wallet', userPublicKey);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: { 'accept': 'application/json' },
        });

        if (!response.ok) {
            console.error('Raydium swap transaction failed:', response.status);
            return null;
        }

        const data = await response.json();

        if (data.success && data.data) {
            return data.data.transaction || data.data;
        }
        return null;
    } catch (error) {
        console.error('Raydium swap transaction error:', error);
        return null;
    }
}
