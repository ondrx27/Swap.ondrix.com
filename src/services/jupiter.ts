// Jupiter Token API Service - v2 API with authentication

export interface JupiterToken {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logoURI?: string;
}

// Jupiter API configuration
const JUPITER_API = 'https://api.jup.ag';
const API_KEY = import.meta.env.VITE_JUPITER_API_KEY || '';

const headers = {
    'x-api-key': API_KEY,
};

// Hardcoded top 10 popular tokens (from Jupiter toporganicscore/24h)
export const POPULAR_TOKENS: JupiterToken[] = [
    {
        address: 'So11111111111111111111111111111111111111112',
        name: 'Wrapped SOL',
        symbol: 'SOL',
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    },
    {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    },
    {
        address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        name: 'USDT',
        symbol: 'USDT',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
    },
    {
        address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        name: 'Jupiter',
        symbol: 'JUP',
        decimals: 6,
        logoURI: 'https://static.jup.ag/jup/icon.png',
    },
    {
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        name: 'Bonk',
        symbol: 'BONK',
        decimals: 5,
        logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
    },
    {
        address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
        name: 'Raydium',
        symbol: 'RAY',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
    },
    {
        address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
        name: 'Marinade Staked SOL',
        symbol: 'mSOL',
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png',
    },
    {
        address: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
        name: 'Pyth Network',
        symbol: 'PYTH',
        decimals: 6,
        logoURI: 'https://pyth.network/token.svg',
    },
    {
        address: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
        name: 'Orca',
        symbol: 'ORCA',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png',
    },
    {
        address: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
        name: 'Render Token',
        symbol: 'RENDER',
        decimals: 8,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof/logo.png',
    },
];

// API response interface (different from our token interface)
interface JupiterApiToken {
    id: string;
    name: string;
    symbol: string;
    decimals: number;
    icon?: string;
}

// Convert API response to our token type
function mapApiToken(apiToken: JupiterApiToken): JupiterToken {
    return {
        address: apiToken.id,
        name: apiToken.name,
        symbol: apiToken.symbol,
        decimals: apiToken.decimals,
        logoURI: apiToken.icon,
    };
}

/**
 * Get popular tokens (hardcoded, no API call needed)
 */
export function getPopularTokens(): JupiterToken[] {
    return POPULAR_TOKENS;
}

/**
 * Search tokens by query (symbol, name, or address)
 */
export async function searchTokens(query: string): Promise<JupiterToken[]> {
    if (!query.trim()) {
        return POPULAR_TOKENS;
    }

    try {
        const response = await fetch(
            `${JUPITER_API}/tokens/v2/search?query=${encodeURIComponent(query.trim())}`,
            {
                method: 'GET',
                headers,
            }
        );

        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }

        const apiTokens: JupiterApiToken[] = await response.json();
        return apiTokens.map(mapApiToken);
    } catch (error) {
        console.error('Token search failed:', error);
        // Fallback to filtering popular tokens
        const searchLower = query.toLowerCase();
        return POPULAR_TOKENS.filter(t =>
            t.symbol.toLowerCase().includes(searchLower) ||
            t.name.toLowerCase().includes(searchLower)
        );
    }
}
