import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, CreditCard, ArrowRight, ExternalLink } from 'lucide-react';

interface BuyDialogProps {
    isOpen: boolean;
    onClose: () => void;
    tokenSymbol: string;
    tokenAddress?: string;
    requiredAmount: number;
    userWalletAddress?: string;
}

// API Keys - Use environment variables for production
const TRANSAK_API_KEY = import.meta.env.VITE_TRANSAK_API_KEY || '20b02076-e691-4915-a039-cbce0af7b11d';
const TRANSAK_ENVIRONMENT = import.meta.env.VITE_TRANSAK_ENVIRONMENT || 'STAGING'; // STAGING or PRODUCTION
// MoonPay Test API Key - use sandbox for testing
const MOONPAY_API_KEY = import.meta.env.VITE_MOONPAY_API_KEY || 'pk_test_Rb5BlLCCgP0YgolZTTBTE8401SWx5K56';
const MOONPAY_IS_SANDBOX = import.meta.env.VITE_MOONPAY_SANDBOX !== 'false'; // Set to false for production

// API Base URL - relative path works with Cloudflare Pages Functions
// Local dev uses localhost, production uses same-domain /api
const API_BASE_URL = import.meta.env.DEV
    ? 'http://localhost:3001/api/moonpay'
    : '/api';

// Build Transak URL with all parameters
// Documentation: https://docs.transak.com/docs/sdk-on-ramp-and-off-ramp
function buildTransakUrl(params: {
    apiKey: string;
    cryptoCurrency: string;
    network: string;
    walletAddress?: string;
    fiatAmount?: number;
    cryptoAmount?: number;
    fiatCurrency?: string;
    themeColor?: string;
    environment?: 'STAGING' | 'PRODUCTION';
}): string {
    // Use staging URL for testing, production URL for live transactions
    const baseUrl = params.environment === 'PRODUCTION'
        ? 'https://global.transak.com/'
        : 'https://global-stg.transak.com/';

    const url = new URL(baseUrl);

    // Required parameters
    url.searchParams.set('apiKey', params.apiKey);
    url.searchParams.set('cryptoCurrencyCode', params.cryptoCurrency);
    url.searchParams.set('network', params.network);
    url.searchParams.set('defaultCryptoCurrency', params.cryptoCurrency);

    // Product type - only on-ramp (buy)
    url.searchParams.set('productsAvailed', 'BUY');

    // Wallet address integration
    if (params.walletAddress) {
        url.searchParams.set('walletAddress', params.walletAddress);
        url.searchParams.set('disableWalletAddressForm', 'true');
    }

    // Amount configuration - prioritize crypto amount if provided
    if (params.cryptoAmount) {
        // User wants to buy specific amount of crypto
        url.searchParams.set('defaultCryptoAmount', String(params.cryptoAmount));
    } else if (params.fiatAmount) {
        // User wants to spend specific amount of fiat
        url.searchParams.set('defaultFiatAmount', String(params.fiatAmount));
    }

    if (params.fiatCurrency) {
        url.searchParams.set('fiatCurrency', params.fiatCurrency);
    }

    // Theme customization
    if (params.themeColor) {
        url.searchParams.set('themeColor', params.themeColor);
    }

    // UI customization
    url.searchParams.set('hideMenu', 'true');
    url.searchParams.set('colorMode', 'DARK'); // DARK (all caps) as per docs
    url.searchParams.set('hideExchangeScreen', 'true'); // Skip exchange home screen

    // Environment parameter (STAGING or PRODUCTION)
    if (params.environment) {
        url.searchParams.set('environment', params.environment);
    }

    return url.toString();
}

// Fetch quote from Transak API
// Documentation: https://docs.transak.com/reference/lookup-get-quote
async function fetchTransakQuote(params: {
    fiatCurrency: string;
    cryptoCurrency: string;
    fiatAmount?: number;
    cryptoAmount?: number;
    network: string;
    paymentMethod?: string;
}): Promise<{
    cryptoAmount: number;
    fiatAmount: number;
    feeDecimal: number;
    totalFee: number;
    conversionPrice: number;
} | null> {
    try {
        // Correct Transak Quote API endpoint
        // Documentation: https://docs.transak.com/reference/get-price
        const baseUrl = TRANSAK_ENVIRONMENT === 'PRODUCTION'
            ? 'https://api.transak.com/api/v1/pricing/public/quotes'
            : 'https://api-stg.transak.com/api/v1/pricing/public/quotes';

        const url = new URL(baseUrl);
        url.searchParams.set('partnerApiKey', TRANSAK_API_KEY);
        url.searchParams.set('fiatCurrency', params.fiatCurrency);
        url.searchParams.set('cryptoCurrency', params.cryptoCurrency);
        url.searchParams.set('network', params.network);
        url.searchParams.set('isBuyOrSell', 'BUY');
        url.searchParams.set('paymentMethod', params.paymentMethod || 'credit_debit_card');

        if (params.fiatAmount) {
            url.searchParams.set('fiatAmount', String(params.fiatAmount));
        } else if (params.cryptoAmount) {
            url.searchParams.set('cryptoAmount', String(params.cryptoAmount));
        }

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            console.error('Transak quote failed:', response.status);
            return null;
        }

        const data = await response.json();
        console.log('Transak API response:', data);

        if (data.response) {
            console.log('Transak quote:', {
                cryptoAmount: data.response.cryptoAmount,
                fiatAmount: data.response.fiatAmount,
                totalFee: data.response.totalFee,
                conversionPrice: data.response.conversionPrice,
            });
            return {
                cryptoAmount: data.response.cryptoAmount || 0,
                fiatAmount: data.response.fiatAmount || params.fiatAmount || 0,
                feeDecimal: data.response.feeDecimal || 0,
                totalFee: data.response.totalFee || 0,
                conversionPrice: data.response.conversionPrice || 0,
            };
        }

        return null;
    } catch (error) {
        console.error('Transak quote error:', error);
        return null;
    }
}

// Fetch available fiat currencies from Transak
async function fetchTransakFiatCurrencies(): Promise<Array<{
    symbol: string;
    name: string;
    minAmount: number;
    maxAmount: number;
}>> {
    try {
        const baseUrl = TRANSAK_ENVIRONMENT === 'PRODUCTION'
            ? 'https://api.transak.com/fiat/public/v1/currencies/fiat-currencies'
            : 'https://api-stg.transak.com/fiat/public/v1/currencies/fiat-currencies';

        const response = await fetch(`${baseUrl}?apiKey=${TRANSAK_API_KEY}`);

        if (!response.ok) {
            console.error('Transak fiat currencies fetch failed:', response.status);
            return [];
        }

        const data = await response.json();

        if (data.response && Array.isArray(data.response)) {
            return data.response
                .filter((fiat: any) => fiat.isAllowed)
                .map((fiat: any) => {
                    // Get min/max from credit_debit_card payment option
                    const cardOption = fiat.paymentOptions?.find((po: any) => po.id === 'credit_debit_card');
                    return {
                        symbol: fiat.symbol,
                        name: fiat.name,
                        minAmount: cardOption?.minAmount || 5,
                        maxAmount: cardOption?.maxAmount || 10000,
                    };
                });
        }

        return [];
    } catch (error) {
        console.error('Error fetching Transak fiat currencies:', error);
        return [];
    }
}

// Fetch available currencies from MoonPay (both fiat and crypto)
async function fetchMoonPayCurrencies(): Promise<{
    fiat: Array<{ code: string; name: string; minBuyAmount: number; maxBuyAmount: number }>;
    crypto: Array<{ code: string; name: string; networkCode: string }>;
}> {
    try {
        const response = await fetch(`https://api.moonpay.com/v3/currencies?show=enabled&apiKey=${MOONPAY_API_KEY}`);

        if (!response.ok) {
            console.error('MoonPay currencies fetch failed:', response.status);
            return { fiat: [], crypto: [] };
        }

        const data = await response.json();

        // Filter fiat currencies
        const fiat = data
            .filter((c: any) => c.type === 'fiat')
            .map((c: any) => ({
                code: c.code.toUpperCase(),
                name: c.name,
                minBuyAmount: c.minBuyAmount || 20,
                maxBuyAmount: c.maxBuyAmount || 30000,
            }));

        // Filter crypto currencies on Solana network
        const crypto = data
            .filter((c: any) =>
                c.type === 'crypto' &&
                c.metadata?.networkCode === 'solana' &&
                ['sol', 'usdc_sol', 'usdt_sol'].includes(c.code)
            )
            .map((c: any) => ({
                code: c.code,
                name: c.name,
                networkCode: c.metadata?.networkCode || 'solana',
            }));

        return { fiat, crypto };
    } catch (error) {
        console.error('Error fetching MoonPay currencies:', error);
        return { fiat: [], crypto: [] };
    }
}

// Build MoonPay URL with all parameters
function buildMoonPayUrl(params: {
    apiKey: string;
    currencyCode: string;
    walletAddress?: string;
    baseCurrencyAmount?: number;
    quoteCurrencyAmount?: number;
    baseCurrencyCode?: string;
    colorCode?: string;
    isSandbox?: boolean;
}): string {
    // Use sandbox URL for testing, production URL for live
    const baseUrl = params.isSandbox
        ? 'https://buy-sandbox.moonpay.com/'
        : 'https://buy.moonpay.com/';
    const url = new URL(baseUrl);

    url.searchParams.set('apiKey', params.apiKey);
    url.searchParams.set('currencyCode', params.currencyCode);

    if (params.walletAddress) {
        url.searchParams.set('walletAddress', params.walletAddress);
    }

    if (params.quoteCurrencyAmount) {
        url.searchParams.set('quoteCurrencyAmount', String(params.quoteCurrencyAmount));
    } else if (params.baseCurrencyAmount) {
        // Ensure minimum $20 for MoonPay
        const amount = Math.max(params.baseCurrencyAmount, 20);
        url.searchParams.set('baseCurrencyAmount', String(amount));
        // Don't lock amount - let user adjust if needed
    }

    if (params.baseCurrencyCode) {
        url.searchParams.set('baseCurrencyCode', params.baseCurrencyCode);
    }

    if (params.colorCode) {
        url.searchParams.set('colorCode', params.colorCode);
    }

    // Additional settings for better UX
    url.searchParams.set('theme', 'dark');

    return url.toString();
}

export const BuyDialog: React.FC<BuyDialogProps> = ({
    isOpen,
    onClose,
    tokenSymbol,
    requiredAmount,
    userWalletAddress
}) => {
    // Minimum amounts - MoonPay requires $20, Transak allows lower
    const MIN_AMOUNT_TRANSAK = 5;  // Transak minimum $5
    const MIN_AMOUNT_MOONPAY = 20; // MoonPay minimum $20
    const MIN_AMOUNT_USD = MIN_AMOUNT_TRANSAK; // Overall minimum (allow Transak's lower limit)
    const MIN_CRYPTO_AMOUNT = 0.04; // Minimum crypto amount

    // Supported cryptocurrencies on Solana with token icons
    const SUPPORTED_CRYPTO = [
        {
            symbol: 'SOL',
            name: 'Solana',
            moonpayCode: 'sol',
            transakCode: 'SOL',
            logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
        },
        {
            symbol: 'USDT',
            name: 'Tether',
            moonpayCode: 'usdt_sol',
            transakCode: 'USDT',
            logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg'
        },
        {
            symbol: 'USDC',
            name: 'USD Coin',
            moonpayCode: 'usdc_sol',
            transakCode: 'USDC',
            logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
        },
    ];

    // Fiat currency symbols and flags mapping
    const FIAT_ICONS: Record<string, { symbol: string; flag: string }> = {
        'USD': { symbol: '$', flag: '🇺🇸' },
        'EUR': { symbol: '€', flag: '🇪🇺' },
        'GBP': { symbol: '£', flag: '🇬🇧' },
        'CAD': { symbol: '$', flag: '🇨🇦' },
        'AUD': { symbol: '$', flag: '🇦🇺' },
        'CHF': { symbol: 'Fr', flag: '🇨🇭' },
        'JPY': { symbol: '¥', flag: '🇯🇵' },
        'CNY': { symbol: '¥', flag: '🇨🇳' },
        'INR': { symbol: '₹', flag: '🇮🇳' },
        'RUB': { symbol: '₽', flag: '🇷🇺' },
        'BRL': { symbol: 'R$', flag: '🇧🇷' },
        'MXN': { symbol: '$', flag: '🇲🇽' },
        'KRW': { symbol: '₩', flag: '🇰🇷' },
        'TRY': { symbol: '₺', flag: '🇹🇷' },
        'PLN': { symbol: 'zł', flag: '🇵🇱' },
        'SEK': { symbol: 'kr', flag: '🇸🇪' },
        'NOK': { symbol: 'kr', flag: '🇳🇴' },
        'DKK': { symbol: 'kr', flag: '🇩🇰' },
        'NZD': { symbol: '$', flag: '🇳🇿' },
        'SGD': { symbol: '$', flag: '🇸🇬' },
        'HKD': { symbol: '$', flag: '🇭🇰' },
        'ZAR': { symbol: 'R', flag: '🇿🇦' },
        'AED': { symbol: 'د.إ', flag: '🇦🇪' },
        'ILS': { symbol: '₪', flag: '🇮🇱' },
        'PHP': { symbol: '₱', flag: '🇵🇭' },
        'THB': { symbol: '฿', flag: '🇹🇭' },
        'VND': { symbol: '₫', flag: '🇻🇳' },
        'IDR': { symbol: 'Rp', flag: '🇮🇩' },
        'MYR': { symbol: 'RM', flag: '🇲🇾' },
        'CZK': { symbol: 'Kč', flag: '🇨🇿' },
        'HUF': { symbol: 'Ft', flag: '🇭🇺' },
        'RON': { symbol: 'lei', flag: '🇷🇴' },
        'BGN': { symbol: 'лв', flag: '🇧🇬' },
        'UAH': { symbol: '₴', flag: '🇺🇦' },
    };

    // Helper to get fiat icon info
    const getFiatIcon = (code: string): { symbol: string; flag: string } => {
        return FIAT_ICONS[code] || { symbol: code.charAt(0), flag: '💵' };
    };

    // Fallback fiat currencies (used while loading from API)
    const FALLBACK_FIAT = [
        { symbol: 'USD', name: 'US Dollar' },
        { symbol: 'EUR', name: 'Euro' },
        { symbol: 'GBP', name: 'British Pound' },
    ];

    // Dynamic fiat currencies state (loaded from APIs)
    const [availableFiat, setAvailableFiat] = useState<Array<{
        symbol: string;
        name: string;
        minAmount?: number;
        maxAmount?: number;
    }>>(FALLBACK_FIAT);
    const [fiatLoading, setFiatLoading] = useState(true);

    // Currency selection state
    const [selectedCrypto, setSelectedCrypto] = useState<string>(tokenSymbol || 'SOL');
    const [selectedFiat, setSelectedFiat] = useState<string>('USD');
    const [showCryptoDropdown, setShowCryptoDropdown] = useState(false);
    const [showFiatDropdown, setShowFiatDropdown] = useState(false);

    // Input mode: 'fiat' or 'crypto'
    const [inputMode, setInputMode] = useState<'fiat' | 'crypto'>('fiat');

    // State for the purchase amount - string for proper input handling
    const [amountUsd, setAmountUsd] = useState<string>(String(Math.max(MIN_AMOUNT_USD, Math.ceil(requiredAmount * 1.1))));
    const [amountCrypto, setAmountCrypto] = useState<string>('1');
    const [isLoading, setIsLoading] = useState(false);

    // Mobile simplified interface state
    const [selectedProvider, setSelectedProvider] = useState<'transak' | 'moonpay'>('transak');
    const [showProviderDropdown, setShowProviderDropdown] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile viewport
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 480);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Prevent body scroll when modal is open
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

    // Fetch available fiat currencies on mount
    useEffect(() => {
        const loadCurrencies = async () => {
            setFiatLoading(true);
            try {
                // Fetch from both APIs in parallel
                const [transakFiat, moonPayData] = await Promise.all([
                    fetchTransakFiatCurrencies(),
                    fetchMoonPayCurrencies(),
                ]);

                // Merge and dedupe fiat currencies (prefer Transak data)
                const fiatMap = new Map<string, { symbol: string; name: string; minAmount?: number; maxAmount?: number }>();

                // Add Transak fiat currencies first
                transakFiat.forEach(f => {
                    fiatMap.set(f.symbol, {
                        symbol: f.symbol,
                        name: f.name,
                        minAmount: f.minAmount,
                        maxAmount: f.maxAmount,
                    });
                });

                // Add MoonPay fiat currencies (if not already present)
                moonPayData.fiat.forEach(f => {
                    if (!fiatMap.has(f.code)) {
                        fiatMap.set(f.code, {
                            symbol: f.code,
                            name: f.name,
                            minAmount: f.minBuyAmount,
                            maxAmount: f.maxBuyAmount,
                        });
                    }
                });

                const mergedFiat = Array.from(fiatMap.values());

                // Sort: popular currencies first
                const popularCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF'];
                mergedFiat.sort((a, b) => {
                    const aPopular = popularCurrencies.indexOf(a.symbol);
                    const bPopular = popularCurrencies.indexOf(b.symbol);
                    if (aPopular !== -1 && bPopular !== -1) return aPopular - bPopular;
                    if (aPopular !== -1) return -1;
                    if (bPopular !== -1) return 1;
                    return a.symbol.localeCompare(b.symbol);
                });

                if (mergedFiat.length > 0) {
                    setAvailableFiat(mergedFiat);
                }

                console.log('Loaded fiat currencies:', mergedFiat.length);
            } catch (error) {
                console.error('Error loading currencies:', error);
            } finally {
                setFiatLoading(false);
            }
        };

        loadCurrencies();
    }, []);

    // State for quotes - separate for each provider
    const [transakQuote, setTransakQuote] = useState<{
        cryptoAmount: number;
        fiatAmount: number;
        feeAmount: number;
        conversionPrice: number;
    } | null>(null);
    const [moonPayQuote, setMoonPayQuote] = useState<{
        quoteCurrencyAmount: number;
        feeAmount: number;
        networkFeeAmount: number;
        totalAmount: number;
        quoteCurrencyPrice?: number;
    } | null>(null);
    const [transakLoading, setTransakLoading] = useState(false);
    const [moonPayLoading, setMoonPayLoading] = useState(false);

    // Legacy quote state for compatibility
    const [quote, setQuote] = useState<{
        quoteCurrencyAmount: number;
        feeAmount: number;
        networkFeeAmount: number;
        totalAmount: number;
        baseCurrencyAmount?: number;
        quoteCurrencyPrice?: number;
    } | null>(null);
    const [quoteLoading, setQuoteLoading] = useState(false);

    // Best Rate calculation - compare providers
    const bestRateInfo = useMemo(() => {
        if (!transakQuote && !moonPayQuote) return null;

        // For fiat mode: compare how much crypto you get
        // For crypto mode: compare how much fiat you pay
        if (inputMode === 'fiat') {
            const transakAmount = transakQuote?.cryptoAmount || 0;
            const moonPayAmount = moonPayQuote?.quoteCurrencyAmount || 0;

            if (transakAmount === 0 && moonPayAmount === 0) return null;
            if (transakAmount === 0) return { bestProvider: 'moonpay' as const, difference: 0 };
            if (moonPayAmount === 0) return { bestProvider: 'transak' as const, difference: 0 };

            const diff = ((transakAmount - moonPayAmount) / moonPayAmount) * 100;

            if (Math.abs(diff) < 0.5) {
                // Less than 0.5% difference - no clear winner
                return { bestProvider: null, difference: 0 };
            }

            return {
                bestProvider: transakAmount > moonPayAmount ? 'transak' as const : 'moonpay' as const,
                difference: Math.abs(diff)
            };
        } else {
            // Crypto mode - compare fiat cost
            const transakCost = transakQuote?.fiatAmount || 0;
            const moonPayCost = moonPayQuote?.totalAmount || 0;

            if (transakCost === 0 && moonPayCost === 0) return null;
            if (transakCost === 0) return { bestProvider: 'moonpay' as const, difference: 0 };
            if (moonPayCost === 0) return { bestProvider: 'transak' as const, difference: 0 };

            const diff = ((moonPayCost - transakCost) / transakCost) * 100;

            if (Math.abs(diff) < 0.5) {
                return { bestProvider: null, difference: 0 };
            }

            return {
                bestProvider: transakCost < moonPayCost ? 'transak' as const : 'moonpay' as const,
                difference: Math.abs(diff)
            };
        }
    }, [transakQuote, moonPayQuote, inputMode]);

    // Processing time estimates
    const PROVIDER_INFO = {
        transak: {
            processingTime: '5-30 min',
            paymentMethods: 'Card, Bank, Apple Pay',
            countries: '160+'
        },
        moonpay: {
            processingTime: '5-15 min',
            paymentMethods: 'Card, Bank, GPay',
            countries: '100+'
        }
    };



    // Map token symbols to MoonPay supported currencies (lowercase)
    const getCryptoCode = useCallback((symbol: string): string => {
        const mapping: Record<string, string> = {
            'SOL': 'sol',
            'USDC': 'usdc_sol',
            'USDT': 'usdt_sol',
        };
        return mapping[symbol] || 'sol';
    }, []);

    // Map token symbols to Transak supported currencies (uppercase for API)
    const getTransakCryptoCode = useCallback((symbol: string): string => {
        const mapping: Record<string, string> = {
            'SOL': 'SOL',
            'USDC': 'USDC',
            'USDT': 'USDT',
        };
        return mapping[symbol] || 'SOL';
    }, []);

    // Fetch quote when amount changes
    useEffect(() => {
        // Validate based on input mode
        const fiatAmount = Number(amountUsd) || 0;
        const cryptoAmount = Number(amountCrypto) || 0;

        if (!isOpen) {
            setQuote(null);
            return;
        }

        if (inputMode === 'fiat' && fiatAmount < MIN_AMOUNT_USD) {
            setQuote(null);
            setTransakQuote(null);
            setMoonPayQuote(null);
            return;
        }

        if (inputMode === 'crypto' && cryptoAmount < MIN_CRYPTO_AMOUNT) {
            setQuote(null);
            setTransakQuote(null);
            setMoonPayQuote(null);
            return;
        }

        const fetchQuotes = async () => {
            const fiatAmount = Number(amountUsd) || 0;
            const cryptoAmt = Number(amountCrypto) || 0;

            // Fetch Transak quote
            // For fiat mode: need fiatAmount >= MIN_AMOUNT_TRANSAK
            // For crypto mode: need cryptoAmount >= MIN_CRYPTO_AMOUNT
            const shouldFetchTransak = inputMode === 'fiat'
                ? fiatAmount >= MIN_AMOUNT_TRANSAK
                : cryptoAmt >= MIN_CRYPTO_AMOUNT;

            if (shouldFetchTransak) {
                setTransakLoading(true);
                try {
                    const tQuote = await fetchTransakQuote({
                        fiatCurrency: selectedFiat,
                        cryptoCurrency: getTransakCryptoCode(selectedCrypto),
                        fiatAmount: inputMode === 'fiat' ? fiatAmount : undefined,
                        cryptoAmount: inputMode === 'crypto' ? cryptoAmt : undefined,
                        network: 'solana',
                        paymentMethod: 'credit_debit_card',
                    });
                    if (tQuote) {
                        setTransakQuote({
                            cryptoAmount: tQuote.cryptoAmount,
                            fiatAmount: tQuote.fiatAmount,
                            feeAmount: tQuote.totalFee,
                            conversionPrice: tQuote.conversionPrice,
                        });
                    } else {
                        setTransakQuote(null);
                    }
                } catch (error) {
                    console.error('Transak quote error:', error);
                    setTransakQuote(null);
                } finally {
                    setTransakLoading(false);
                }
            } else {
                setTransakQuote(null);
            }

            // Fetch MoonPay quote
            // For fiat mode: need fiatAmount >= MIN_AMOUNT_MOONPAY
            // For crypto mode: always try to fetch if cryptoAmou >= MIN_CRYPTO_AMOUNT
            const shouldFetchMoonPay = inputMode === 'fiat'
                ? fiatAmount >= MIN_AMOUNT_MOONPAY
                : cryptoAmt >= MIN_CRYPTO_AMOUNT;

            if (shouldFetchMoonPay) {
                setMoonPayLoading(true);
                setQuoteLoading(true);
                try {
                    let url = `${API_BASE_URL}/quote?` +
                        `currencyCode=${getCryptoCode(selectedCrypto)}&` +
                        `baseCurrencyCode=${selectedFiat.toLowerCase()}`;

                    if (inputMode === 'crypto') {
                        url += `&quoteCurrencyAmount=${amountCrypto}`;
                    } else {
                        url += `&baseCurrencyAmount=${fiatAmount}`;
                    }

                    const response = await fetch(url);

                    if (response.ok) {
                        const data = await response.json();
                        const mQuote = {
                            quoteCurrencyAmount: data.quoteCurrencyAmount || 0,
                            feeAmount: data.feeAmount || 0,
                            networkFeeAmount: data.networkFeeAmount || 0,
                            totalAmount: data.totalAmount || fiatAmount,
                            quoteCurrencyPrice: data.quoteCurrencyPrice || 0,
                        };
                        setMoonPayQuote(mQuote);
                        setQuote({ ...mQuote, baseCurrencyAmount: fiatAmount });
                    } else {
                        setMoonPayQuote(null);
                        setQuote(null);
                    }
                } catch (error) {
                    console.error('MoonPay quote error:', error);
                    setMoonPayQuote(null);
                    setQuote(null);
                } finally {
                    setMoonPayLoading(false);
                    setQuoteLoading(false);
                }
            } else {
                setMoonPayQuote(null);
                // For legacy compatibility, use Transak quote if MoonPay not available
                if (fiatAmount >= MIN_AMOUNT_TRANSAK) {
                    setQuoteLoading(true);
                    try {
                        const tQuote = await fetchTransakQuote({
                            fiatCurrency: selectedFiat,
                            cryptoCurrency: getTransakCryptoCode(selectedCrypto),
                            fiatAmount: fiatAmount,
                            network: 'solana',
                            paymentMethod: 'credit_debit_card',
                        });
                        if (tQuote) {
                            setQuote({
                                quoteCurrencyAmount: tQuote.cryptoAmount,
                                feeAmount: tQuote.totalFee,
                                networkFeeAmount: 0,
                                totalAmount: fiatAmount,
                                baseCurrencyAmount: fiatAmount,
                                quoteCurrencyPrice: tQuote.conversionPrice,
                            });
                        }
                    } catch (error) {
                        console.error('Error fetching quote:', error);
                    } finally {
                        setQuoteLoading(false);
                    }
                }
            }
        };

        // Debounce the fetch
        const timeoutId = setTimeout(fetchQuotes, 500);
        return () => clearTimeout(timeoutId);
    }, [isOpen, amountUsd, amountCrypto, inputMode, selectedCrypto, selectedFiat, getCryptoCode, getTransakCryptoCode]);

    // Validate amount based on mode
    const amountNum = Number(amountUsd) || 0;
    const cryptoNum = Number(amountCrypto) || 0;
    const isAmountValid = inputMode === 'fiat'
        ? amountNum >= MIN_AMOUNT_USD
        : cryptoNum >= MIN_CRYPTO_AMOUNT;

    // MoonPay requires minimum $20 - disable if below
    const isMoonPayValid = inputMode === 'fiat'
        ? amountNum >= MIN_AMOUNT_MOONPAY
        : (quote?.totalAmount && quote.totalAmount >= MIN_AMOUNT_MOONPAY);

    // Track if user has manually selected a provider
    const [hasUserManuallySelected, setHasUserManuallySelected] = useState(false);

    // Reset manual selection when modal opens
    useEffect(() => {
        if (isOpen) {
            setHasUserManuallySelected(false);
        }
    }, [isOpen]);

    // Reset manual selection when amount changes (new calculation = auto-select best again)
    useEffect(() => {
        setHasUserManuallySelected(false);
    }, [amountUsd, amountCrypto]);

    // Auto-select best rate provider for mobile interface
    // Only auto-select if user hasn't manually selected, OR if their selection becomes invalid
    useEffect(() => {
        const isCurrentSelectionInvalid = selectedProvider === 'moonpay' && !isMoonPayValid;

        // If current selection is invalid, we MUST switch regardless of manual preference
        if (isCurrentSelectionInvalid) {
            setSelectedProvider('transak');
            return;
        }

        // Otherwise, only switch if user hasn't manually selected
        if (!hasUserManuallySelected && bestRateInfo?.bestProvider) {
            setSelectedProvider(bestRateInfo.bestProvider);
        }
    }, [bestRateInfo, isMoonPayValid, selectedProvider, hasUserManuallySelected]);

    if (!isOpen) return null;

    const handleTransak = () => {
        if (!isAmountValid) return;

        // Prepare parameters based on input mode
        const transakParams: any = {
            apiKey: TRANSAK_API_KEY,
            cryptoCurrency: getTransakCryptoCode(selectedCrypto),
            network: 'solana',
            walletAddress: userWalletAddress,
            fiatCurrency: selectedFiat,
            themeColor: '00FF88',
            environment: TRANSAK_ENVIRONMENT as 'STAGING' | 'PRODUCTION',
        };

        // Set amount based on input mode
        if (inputMode === 'crypto') {
            transakParams.cryptoAmount = cryptoNum;
        } else {
            transakParams.fiatAmount = amountNum;
        }

        const transakUrl = buildTransakUrl(transakParams);

        // Open in a popup window
        window.open(transakUrl, 'transak', 'width=450,height=700,left=100,top=100');
        onClose();
    };

    const handleMoonPay = async () => {
        if (!isAmountValid) return;

        setIsLoading(true);

        const moonpayParams: any = {
            apiKey: MOONPAY_API_KEY,
            currencyCode: getCryptoCode(selectedCrypto),
            walletAddress: userWalletAddress,
            baseCurrencyCode: selectedFiat.toLowerCase(),
            colorCode: '00FF88',
            isSandbox: MOONPAY_IS_SANDBOX,
        };

        if (inputMode === 'crypto') {
            moonpayParams.quoteCurrencyAmount = cryptoNum;
        } else {
            moonpayParams.baseCurrencyAmount = amountNum;
        }

        const moonpayUrl = buildMoonPayUrl(moonpayParams);

        try {
            const response = await fetch(`${API_BASE_URL}/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: moonpayUrl }),
            });

            if (!response.ok) throw new Error('Failed to sign URL');

            const { signedUrl } = await response.json();
            window.open(signedUrl, 'moonpay', 'width=450,height=700,left=100,top=100');
        } catch (error) {
            console.error('Error signing MoonPay URL:', error);
            window.open(moonpayUrl, 'moonpay', 'width=450,height=700,left=100,top=100');
        } finally {
            setIsLoading(false);
        }

        onClose();
    };

    return (
        <div
            className="modal-overlay"
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(3, 5, 3, 0.85)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '1rem',
                animation: 'fadeIn 0.3s ease'
            }}
        >
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
                @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                .buy-modal-container::-webkit-scrollbar { width: 6px; }
                .buy-modal-container::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 10px; }
                .buy-modal-container::-webkit-scrollbar-thumb { background: linear-gradient(180deg, rgba(0, 255, 136, 0.4) 0%, rgba(0, 180, 100, 0.3) 100%); border-radius: 10px; }
                .buy-modal-container::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, rgba(0, 255, 136, 0.6) 0%, rgba(0, 180, 100, 0.5) 100%); }
                .buy-modal-dropdown::-webkit-scrollbar { width: 6px; }
                .buy-modal-dropdown::-webkit-scrollbar-track { background: transparent; }
                .buy-modal-dropdown::-webkit-scrollbar-thumb { background: rgba(0, 255, 136, 0.3); border-radius: 10px; }
                .provider-card-btn:hover { transform: translateX(4px); border-color: rgba(0, 255, 136, 0.5) !important; }
                .provider-card-btn:hover .provider-arrow { transform: translateX(4px); color: var(--primary) !important; }
                .currency-btn:hover { border-color: rgba(0, 255, 136, 0.4) !important; background: rgba(0, 255, 136, 0.05) !important; }
                .quick-amount-btn:hover { background: rgba(0, 255, 136, 0.15) !important; border-color: var(--primary) !important; color: var(--primary) !important; }
                
                /* Mobile Responsive Styles - Full Bottom Sheet Pattern */
                @media (max-width: 480px) {
                    .modal-overlay {
                        align-items: flex-end !important;
                        padding: 0 !important;
                    }
                    .buy-modal-container {
                        position: relative !important;
                        bottom: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        transform: none !important;
                        
                        width: 100% !important;
                        max-width: 100% !important;
                        max-height: 85vh !important;
                        
                        margin: 0 !important;
                        padding: 1.25rem !important;
                        padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 20px)) !important;
                        
                        border-radius: 28px 28px 0 0 !important;
                        border: none !important;
                        border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
                        
                        background: var(--surface-1) !important;
                        box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5) !important;
                        
                        animation: slideUpMobile 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
                        
                        overflow-y: auto !important;
                        -webkit-overflow-scrolling: touch !important;
                    }
                    .buy-modal-container h3 {
                        font-size: 1.15rem !important;
                    }
                    .buy-modal-container p {
                        font-size: 0.72rem !important;
                    }
                    .currency-btn {
                        padding: 0.875rem 1rem !important;
                        font-size: 0.95rem !important;
                        min-height: 52px !important;
                    }
                    .currency-selectors {
                        flex-direction: row !important;
                        gap: 0.625rem !important;
                    }
                    .quick-amount-btn {
                        padding: 0.625rem 0.5rem !important;
                        font-size: 0.8rem !important;
                        min-height: 42px !important;
                        flex: 1 !important;
                    }
                    .quick-amounts-row {
                        gap: 0.5rem !important;
                        flex-wrap: nowrap !important;
                        overflow-x: auto !important;
                        -webkit-overflow-scrolling: touch !important;
                        scrollbar-width: none !important;
                        padding-bottom: 0.25rem !important;
                    }
                    .quick-amounts-row::-webkit-scrollbar {
                        display: none;
                    }
                    .provider-card-btn {
                        padding: 1rem !important;
                        min-height: 72px !important;
                    }
                    .provider-card-btn img {
                        width: 40px !important;
                        height: 40px !important;
                    }
                    .amount-input-section {
                        padding: 1rem !important;
                    }
                    .amount-input-section input {
                        font-size: 1.75rem !important;
                    }
                    .amount-input-section > div:first-child > span:first-child {
                        font-size: 1.75rem !important;
                    }
                    .input-mode-toggle {
                        flex-direction: row !important;
                        gap: 2px !important;
                    }
                    .input-mode-toggle button {
                        padding: 0.5rem 0.75rem !important;
                        font-size: 0.72rem !important;
                        min-height: 36px !important;
                    }
                    .buy-modal-dropdown {
                        max-height: 45vh !important;
                        overflow-y: auto !important;
                    }
                    /* Quote cards mobile optimization */
                    .quote-row {
                        padding: 0.625rem !important;
                        font-size: 0.85rem !important;
                    }
                    .estimated-rates-section {
                        padding: 0.75rem !important;
                        gap: 0.625rem !important;
                    }
                    /* Close button larger for touch */
                    .buy-modal-container > div:first-of-type button {
                        width: 40px !important;
                        height: 40px !important;
                        min-height: 40px !important;
                    }
                }
                
                /* Small mobile (iPhone SE, etc) */
                @media (max-width: 375px) {
                    .buy-modal-container {
                        padding: 1rem !important;
                        padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 20px)) !important;
                        max-height: 95vh !important;
                    }
                    .buy-modal-container h3 {
                        font-size: 1rem !important;
                    }
                    .amount-input-section input {
                        font-size: 1.5rem !important;
                    }
                    .provider-card-btn {
                        padding: 0.875rem !important;
                        min-height: 64px !important;
                    }
                    .currency-btn {
                        padding: 0.75rem !important;
                        font-size: 0.875rem !important;
                        min-height: 48px !important;
                    }
                }
                
                /* Tablet Responsive */
                @media (max-width: 768px) and (min-width: 481px) {
                    .buy-modal-container {
                        padding: 1.5rem !important;
                        max-width: 440px !important;
                        border-radius: 22px !important;
                    }
                    .currency-selectors {
                        gap: 0.75rem !important;
                    }
                }
                
                /* Touch-friendly improvements for all touch devices */
                @media (hover: none) and (pointer: coarse) {
                    .currency-btn, .quick-amount-btn, .provider-card-btn {
                        min-height: 48px;
                        -webkit-tap-highlight-color: transparent;
                    }
                    .provider-card-btn:active {
                        transform: scale(0.98);
                        opacity: 0.92;
                        transition: all 0.1s ease;
                    }
                    .quick-amount-btn:active {
                        transform: scale(0.95);
                    }
                    .currency-btn:active {
                        transform: scale(0.98);
                    }
                    /* Larger dropdown items for touch */
                    .buy-modal-dropdown button {
                        min-height: 52px !important;
                        padding: 0.875rem !important;
                    }
                }
                
                /* Slide up animation for mobile bottom sheet */
                @keyframes slideUpMobile {
                    from { 
                        opacity: 0.8; 
                        transform: translateY(100%); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0); 
                    }
                }
            `}</style>

            <div
                className="buy-modal-container"
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'linear-gradient(165deg, rgba(10, 15, 10, 0.98) 0%, rgba(5, 8, 5, 0.99) 100%)',
                    border: '1px solid rgba(0, 255, 136, 0.2)',
                    borderRadius: '24px',
                    padding: '2rem',
                    maxWidth: '480px',
                    width: '100%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    position: 'relative',
                    boxShadow: '0 25px 100px rgba(0, 0, 0, 0.7), 0 0 80px rgba(0, 255, 136, 0.08)',
                    animation: 'slideUp 0.4s ease'
                }}
            >
                {/* Aurora Glow Effect */}
                <div style={{
                    position: 'absolute',
                    top: '-50%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '150%',
                    height: '100%',
                    background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0, 255, 136, 0.08) 0%, transparent 60%)',
                    pointerEvents: 'none',
                    zIndex: 0
                }} />

                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1.5rem',
                    position: 'relative',
                    zIndex: 1
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: '14px',
                            background: 'var(--surface-3)', // Muted background
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <CreditCard size={22} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <div>
                            <h3 style={{
                                fontSize: '1.25rem',
                                fontWeight: 700,
                                color: 'var(--text)',
                                fontFamily: 'Inter, sans-serif',
                                letterSpacing: '-0.02em',
                                margin: 0
                            }}>
                                Buy Crypto
                            </h3>
                            <p style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                margin: 0
                            }}>
                                Purchase with card or bank transfer
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: '10px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.color = 'var(--text)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Currency Selection - Redesigned */}
                <div
                    className="currency-selectors"
                    style={{
                        display: 'flex',
                        gap: '0.75rem',
                        marginBottom: '1.25rem',
                        position: 'relative',
                        zIndex: 10
                    }}>
                    {/* Crypto Selector */}
                    <div style={{ flex: 1, position: 'relative' }}>
                        <label style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            marginBottom: '0.4rem',
                            display: 'block',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em'
                        }}>
                            You Receive
                        </label>
                        <button
                            className="currency-btn"
                            onClick={() => { setShowCryptoDropdown(!showCryptoDropdown); setShowFiatDropdown(false); }}
                            style={{
                                width: '100%',
                                padding: '0.85rem 1rem',
                                background: 'var(--surface-1)',
                                border: '1px solid var(--border-light)',
                                borderRadius: '14px',
                                color: 'var(--text)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '1rem',
                                fontWeight: 600,
                                fontFamily: 'Space Grotesk, sans-serif',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <img
                                    src={SUPPORTED_CRYPTO.find(c => c.symbol === selectedCrypto)?.logoURI}
                                    alt={selectedCrypto}
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: '50%',
                                        objectFit: 'cover'
                                    }}
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                                {selectedCrypto}
                            </div>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{
                                transform: showCryptoDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease'
                            }}>
                                <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                        </button>
                        {showCryptoDropdown && (
                            <div
                                className="buy-modal-dropdown"
                                style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 6px)',
                                    left: 0,
                                    right: 0,
                                    background: 'linear-gradient(165deg, var(--surface-3) 0%, var(--surface-2) 100%)',
                                    border: '1px solid var(--border-accent)',
                                    borderRadius: '14px',
                                    padding: '0.5rem',
                                    zIndex: 100,
                                    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)',
                                    overflow: 'hidden'
                                }}
                            >
                                {SUPPORTED_CRYPTO.map((crypto) => (
                                    <button
                                        key={crypto.symbol}
                                        onClick={() => { setSelectedCrypto(crypto.symbol); setShowCryptoDropdown(false); }}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            background: selectedCrypto === crypto.symbol ? 'rgba(0, 255, 136, 0.1)' : 'transparent',
                                            border: 'none',
                                            borderRadius: '10px',
                                            color: 'var(--text)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            transition: 'all 0.15s ease'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = selectedCrypto === crypto.symbol ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 255, 255, 0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = selectedCrypto === crypto.symbol ? 'rgba(0, 255, 136, 0.1)' : 'transparent'}
                                    >
                                        <img
                                            src={crypto.logoURI}
                                            alt={crypto.symbol}
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: '50%',
                                                objectFit: 'cover'
                                            }}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{crypto.symbol}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{crypto.name}</div>
                                        </div>
                                        {selectedCrypto === crypto.symbol && (
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 'auto' }}>
                                                <path d="M3 8L6.5 11.5L13 5" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
                                            </svg>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Fiat Selector */}
                    <div style={{ flex: 1, position: 'relative' }}>
                        <label style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            marginBottom: '0.4rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em'
                        }}>
                            Pay With
                            {fiatLoading && (
                                <span style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: 'var(--primary)',
                                    animation: 'pulse 1s infinite'
                                }} />
                            )}
                        </label>
                        <button
                            className="currency-btn"
                            onClick={() => { setShowFiatDropdown(!showFiatDropdown); setShowCryptoDropdown(false); }}
                            style={{
                                width: '100%',
                                padding: '0.85rem 1rem',
                                background: 'var(--surface-1)',
                                border: '1px solid var(--border-light)',
                                borderRadius: '14px',
                                color: 'var(--text)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '1rem',
                                fontWeight: 600,
                                fontFamily: 'Space Grotesk, sans-serif',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <span style={{ fontSize: '1.25rem' }}>
                                    {getFiatIcon(selectedFiat).flag}
                                </span>
                                <span>{selectedFiat}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    ({getFiatIcon(selectedFiat).symbol})
                                </span>
                            </div>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{
                                transform: showFiatDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease'
                            }}>
                                <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                        </button>
                        {showFiatDropdown && (
                            <div
                                className="buy-modal-dropdown"
                                style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 6px)',
                                    left: 0,
                                    right: 0,
                                    background: 'var(--surface-2)',
                                    border: '1px solid var(--border-light)',
                                    borderRadius: '14px',
                                    padding: '0.5rem',
                                    zIndex: 100,
                                    maxHeight: '220px',
                                    overflowY: 'auto',
                                    overflowX: 'hidden', // Fix horizontal scroll
                                    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)'
                                }}
                            >
                                {availableFiat.map((fiat) => (
                                    <button
                                        key={fiat.symbol}
                                        onClick={() => { setSelectedFiat(fiat.symbol); setShowFiatDropdown(false); }}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.75rem',
                                            background: selectedFiat === fiat.symbol ? 'rgba(0, 255, 136, 0.1)' : 'transparent',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: 'var(--text)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            transition: 'all 0.15s ease'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = selectedFiat === fiat.symbol ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 255, 255, 0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = selectedFiat === fiat.symbol ? 'rgba(0, 255, 136, 0.1)' : 'transparent'}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '1.1rem' }}>{getFiatIcon(fiat.symbol).flag}</span>
                                            <span style={{ fontWeight: 600 }}>{fiat.symbol}</span>
                                            <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>({getFiatIcon(fiat.symbol).symbol})</span>
                                        </div>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{fiat.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Amount Input - Redesigned */}
                <div
                    className="amount-input-section"
                    style={{
                        background: 'linear-gradient(165deg, var(--surface-2) 0%, var(--surface-1) 100%)',
                        border: `1px solid ${isAmountValid ? 'var(--border-light)' : 'rgba(248, 113, 113, 0.5)'}`,
                        borderRadius: '18px',
                        padding: '1.25rem',
                        marginBottom: '1rem',
                        position: 'relative',
                        zIndex: 1,
                        transition: 'border-color 0.2s ease'
                    }}>
                    {/* Input Mode Toggle */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <label style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.8rem',
                            fontWeight: 500
                        }}>
                            {inputMode === 'fiat' ? 'You Pay' : 'You Receive'}
                        </label>
                        <div
                            className="input-mode-toggle"
                            style={{
                                display: 'flex',
                                gap: '2px',
                                background: 'var(--surface-1)',
                                padding: '3px',
                                borderRadius: '10px',
                                border: '1px solid var(--border-subtle)'
                            }}>
                            <button
                                onClick={() => setInputMode('fiat')}
                                style={{
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: inputMode === 'fiat' ? 'var(--primary)' : 'transparent',
                                    color: inputMode === 'fiat' ? 'var(--dark)' : 'var(--text-muted)',
                                    fontWeight: 600,
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {selectedFiat}
                            </button>
                            <button
                                onClick={() => setInputMode('crypto')}
                                style={{
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: inputMode === 'crypto' ? 'var(--primary)' : 'transparent',
                                    color: inputMode === 'crypto' ? 'var(--dark)' : 'var(--text-muted)',
                                    fontWeight: 600,
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {selectedCrypto}
                            </button>
                        </div>
                    </div>

                    {/* Amount Input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{
                            fontSize: '2rem',
                            fontWeight: 700,
                            color: inputMode === 'fiat' ? 'var(--primary)' : 'var(--text-muted)',
                            fontFamily: 'Space Grotesk, sans-serif'
                        }}>
                            {inputMode === 'fiat' ? getFiatIcon(selectedFiat).symbol : ''}
                        </span>
                        <input
                            type="number"
                            value={inputMode === 'fiat' ? amountUsd : amountCrypto}
                            onChange={(e) => inputMode === 'fiat' ? setAmountUsd(e.target.value) : setAmountCrypto(e.target.value)}
                            placeholder={inputMode === 'fiat' ? '100' : '1'}
                            min={inputMode === 'fiat' ? MIN_AMOUNT_USD : MIN_CRYPTO_AMOUNT}
                            step={inputMode === 'fiat' ? 5 : 0.01}
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text)',
                                fontSize: '2rem',
                                fontWeight: 700,
                                outline: 'none',
                                width: '100%',
                                fontFamily: 'Space Grotesk, sans-serif'
                            }}
                        />
                        <span style={{
                            color: inputMode === 'crypto' ? 'var(--primary)' : 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: '1.1rem'
                        }}>
                            {inputMode === 'crypto' ? selectedCrypto : selectedFiat}
                        </span>
                    </div>

                    {/* Conversion Display */}
                    <div style={{
                        marginTop: '0.5rem',
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                    }}>
                        {isLoading ? (
                            <span style={{ animation: 'pulse 1.5s infinite' }}>Fetching best rate...</span>
                        ) : (
                            <>
                                ≈
                                {inputMode === 'fiat' ? (
                                    selectedProvider === 'transak' && transakQuote ? (
                                        `${transakQuote.cryptoAmount?.toFixed(6) || '...'} ${selectedCrypto}`
                                    ) : selectedProvider === 'moonpay' && moonPayQuote ? (
                                        `${moonPayQuote.quoteCurrencyAmount?.toFixed(6) || '...'} ${selectedCrypto}`
                                    ) : '...'
                                ) : (
                                    selectedProvider === 'transak' && transakQuote ? (
                                        `${transakQuote.fiatAmount?.toFixed(2) || '...'} ${selectedFiat}`
                                    ) : selectedProvider === 'moonpay' && moonPayQuote ? (
                                        `${moonPayQuote.totalAmount?.toFixed(2) || '...'} ${selectedFiat}`
                                    ) : '...'
                                )}
                            </>
                        )}
                    </div>

                    {/* Quick Amount Buttons */}
                    {inputMode === 'fiat' && (
                        <div className="quick-amounts-row" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                            {[50, 100, 250, 500].map((amt) => (
                                <button
                                    key={amt}
                                    className="quick-amount-btn"
                                    onClick={() => setAmountUsd(String(amt))}
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        borderRadius: '10px',
                                        border: '1px solid var(--border-light)',
                                        background: Number(amountUsd) === amt ? 'rgba(0, 255, 136, 0.1)' : 'transparent',
                                        color: Number(amountUsd) === amt ? 'var(--primary)' : 'var(--text-muted)',
                                        fontWeight: 600,
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    ${amt}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Validation Error */}
                    {!isAmountValid && (
                        <p style={{
                            color: 'var(--error)',
                            fontSize: '0.8rem',
                            marginTop: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                        }}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M7 4V7.5M7 9.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                            Minimum: {inputMode === 'fiat' ? `$${MIN_AMOUNT_USD}` : `${MIN_CRYPTO_AMOUNT} ${selectedCrypto}`}
                        </p>
                    )}
                </div>

                {/* Quote Cards - Redesigned (Desktop only) */}
                {!isMobile && (transakQuote || moonPayQuote || quoteLoading) && (
                    <div style={{
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '14px',
                        padding: '1rem',
                        marginBottom: '1.25rem'
                    }}
                        className="estimated-rates-section"
                    >
                        <div style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            marginBottom: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            Estimated Rates
                            {quoteLoading && (
                                <span style={{
                                    width: 12,
                                    height: 12,
                                    border: '2px solid var(--border-light)',
                                    borderTopColor: 'var(--primary)',
                                    borderRadius: '50%',
                                    animation: 'spin 0.8s linear infinite'
                                }} />
                            )}
                        </div>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {/* Transak Quote */}
                            {(transakQuote || transakLoading) && (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    padding: '0.75rem',
                                    background: bestRateInfo?.bestProvider === 'transak'
                                        ? 'rgba(0, 255, 136, 0.08)'
                                        : 'rgba(0, 128, 255, 0.05)',
                                    borderRadius: '12px',
                                    border: bestRateInfo?.bestProvider === 'transak'
                                        ? '1px solid rgba(0, 255, 136, 0.3)'
                                        : '1px solid rgba(0, 128, 255, 0.15)',
                                    gap: '0.5rem',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <img src="/images/transak-logo.png" alt="Transak" style={{ width: 24, height: 24, borderRadius: '6px', objectFit: 'cover' }} />
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Transak</span>
                                            {bestRateInfo?.bestProvider === 'transak' && (
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    fontWeight: 700,
                                                    color: '#0a1f0a',
                                                    background: 'linear-gradient(135deg, #00FF88 0%, #00CC6A 100%)',
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '20px',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em'
                                                }}>
                                                    Best Rate {bestRateInfo.difference > 0 ? `+${bestRateInfo.difference.toFixed(1)}%` : ''}
                                                </span>
                                            )}
                                        </div>
                                        {transakLoading ? (
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading...</span>
                                        ) : transakQuote && (
                                            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>
                                                {inputMode === 'fiat'
                                                    ? `~${transakQuote.cryptoAmount.toFixed(4)} ${selectedCrypto}`
                                                    : `~${getFiatIcon(selectedFiat).symbol}${(transakQuote.fiatAmount || 0).toFixed(2)}`}
                                            </span>
                                        )}
                                    </div>
                                    {transakQuote && (
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            fontSize: '0.75rem',
                                            color: 'var(--text-dim)',
                                            paddingTop: '0.25rem',
                                            borderTop: '1px solid rgba(255,255,255,0.05)'
                                        }}>
                                            <span>Fee: {getFiatIcon(selectedFiat).symbol}{transakQuote.feeAmount?.toFixed(2) || '—'}</span>
                                            <span>⏱️ {PROVIDER_INFO.transak.processingTime}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* MoonPay Quote */}
                            {(moonPayQuote || moonPayLoading) && (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    padding: '0.75rem',
                                    background: bestRateInfo?.bestProvider === 'moonpay'
                                        ? 'rgba(0, 255, 136, 0.08)'
                                        : 'rgba(123, 97, 255, 0.05)',
                                    borderRadius: '12px',
                                    border: bestRateInfo?.bestProvider === 'moonpay'
                                        ? '1px solid rgba(0, 255, 136, 0.3)'
                                        : '1px solid rgba(123, 97, 255, 0.15)',
                                    gap: '0.5rem',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <img src="/images/moonpay-logo.png" alt="MoonPay" style={{ width: 24, height: 24, borderRadius: '6px', objectFit: 'cover' }} />
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>MoonPay</span>
                                            {bestRateInfo?.bestProvider === 'moonpay' && (
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    fontWeight: 700,
                                                    color: '#0a1f0a',
                                                    background: 'linear-gradient(135deg, #00FF88 0%, #00CC6A 100%)',
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '20px',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em'
                                                }}>
                                                    Best Rate {bestRateInfo.difference > 0 ? `+${bestRateInfo.difference.toFixed(1)}%` : ''}
                                                </span>
                                            )}
                                            {!isMoonPayValid && !moonPayLoading && (
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    color: 'var(--text-dim)',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    padding: '0.15rem 0.4rem',
                                                    borderRadius: '6px'
                                                }}>
                                                    Min ${MIN_AMOUNT_MOONPAY}
                                                </span>
                                            )}
                                        </div>
                                        {moonPayLoading ? (
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading...</span>
                                        ) : moonPayQuote && (
                                            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>
                                                {inputMode === 'fiat'
                                                    ? `~${moonPayQuote.quoteCurrencyAmount.toFixed(4)} ${selectedCrypto}`
                                                    : `~${getFiatIcon(selectedFiat).symbol}${moonPayQuote.totalAmount.toFixed(2)}`}
                                            </span>
                                        )}
                                    </div>
                                    {moonPayQuote && (
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            fontSize: '0.75rem',
                                            color: 'var(--text-dim)',
                                            paddingTop: '0.25rem',
                                            borderTop: '1px solid rgba(255,255,255,0.05)'
                                        }}>
                                            <span>Fee: {getFiatIcon(selectedFiat).symbol}{(moonPayQuote.feeAmount + moonPayQuote.networkFeeAmount).toFixed(2)}</span>
                                            <span>⏱️ {PROVIDER_INFO.moonpay.processingTime}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Provider Section - Mobile vs Desktop */}
                {isMobile ? (
                    /* MOBILE: Compact Provider Selector + Buy Button */
                    <div style={{ marginBottom: '1rem' }}>
                        {/* Provider Dropdown Selector */}
                        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                            <button
                                onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.875rem 1rem',
                                    background: 'linear-gradient(165deg, var(--surface-2) 0%, var(--surface-1) 100%)',
                                    border: '1px solid var(--border-light)',
                                    borderRadius: '14px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <img
                                        src={selectedProvider === 'transak' ? '/images/transak-logo.png' : '/images/moonpay-logo.png'}
                                        alt={selectedProvider}
                                        style={{ width: 32, height: 32, borderRadius: '8px' }}
                                    />
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{
                                            fontWeight: 600,
                                            color: 'var(--text)',
                                            fontSize: '0.95rem',
                                            textTransform: 'capitalize',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}>
                                            {selectedProvider}
                                            {bestRateInfo?.bestProvider === selectedProvider && (
                                                <span style={{
                                                    fontSize: '0.6rem',
                                                    fontWeight: 700,
                                                    color: '#0a1f0a',
                                                    background: 'linear-gradient(135deg, #00FF88 0%, #00CC6A 100%)',
                                                    padding: '0.15rem 0.4rem',
                                                    borderRadius: '10px',
                                                    textTransform: 'uppercase'
                                                }}>Best Rate</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {selectedProvider === 'transak' && transakQuote && (
                                                <>Fee: {getFiatIcon(selectedFiat).symbol}{transakQuote.feeAmount?.toFixed(2) || '0.00'} • {PROVIDER_INFO.transak.processingTime}</>
                                            )}
                                            {selectedProvider === 'moonpay' && moonPayQuote && (
                                                <>Fee: {getFiatIcon(selectedFiat).symbol}{(moonPayQuote.feeAmount + moonPayQuote.networkFeeAmount).toFixed(2)} • {PROVIDER_INFO.moonpay.processingTime}</>
                                            )}
                                            {!transakQuote && !moonPayQuote && (
                                                <>{PROVIDER_INFO[selectedProvider].paymentMethods}</>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{
                                    transform: showProviderDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease'
                                }}>
                                    <path d="M3 5L7 9L11 5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                            </button>

                            {/* Provider Dropdown */}
                            {showProviderDropdown && (
                                <div style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 6px)',
                                    left: 0,
                                    right: 0,
                                    background: 'var(--surface-2)',
                                    border: '1px solid var(--border-light)',
                                    borderRadius: '12px',
                                    padding: '0.5rem',
                                    zIndex: 100,
                                    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)'
                                }}>
                                    {(['transak', 'moonpay'] as const).map(provider => {
                                        const isProviderDisabled = provider === 'moonpay' && !isMoonPayValid;

                                        return (
                                            <button
                                                key={provider}
                                                onClick={() => {
                                                    if (!isProviderDisabled) {
                                                        setSelectedProvider(provider);
                                                        setHasUserManuallySelected(true); // Flag that user made a choice
                                                        setShowProviderDropdown(false);
                                                    }
                                                }}
                                                disabled={isProviderDisabled}
                                                style={{
                                                    width: '100%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '0.75rem',
                                                    background: selectedProvider === provider ? 'rgba(0, 255, 136, 0.1)' : 'transparent',
                                                    border: 'none',
                                                    borderRadius: '10px',
                                                    cursor: isProviderDisabled ? 'not-allowed' : 'pointer',
                                                    opacity: isProviderDisabled ? 0.5 : 1,
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <img
                                                        src={provider === 'transak' ? '/images/transak-logo.png' : '/images/moonpay-logo.png'}
                                                        alt={provider}
                                                        style={{ width: 28, height: 28, borderRadius: '6px' }}
                                                    />
                                                    <div style={{ textAlign: 'left' }}>
                                                        <div style={{
                                                            fontWeight: 600,
                                                            color: 'var(--text)',
                                                            fontSize: '0.9rem',
                                                            textTransform: 'capitalize',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.4rem'
                                                        }}>
                                                            {provider}
                                                            {bestRateInfo?.bestProvider === provider && !isProviderDisabled && (
                                                                <span style={{
                                                                    fontSize: '0.55rem',
                                                                    fontWeight: 700,
                                                                    color: '#0a1f0a',
                                                                    background: 'var(--primary)',
                                                                    padding: '0.1rem 0.3rem',
                                                                    borderRadius: '8px'
                                                                }}>BEST</span>
                                                            )}
                                                            {isProviderDisabled && (
                                                                <span style={{
                                                                    fontSize: '0.55rem',
                                                                    fontWeight: 700,
                                                                    color: '#ff4d4d',
                                                                    border: '1px solid rgba(255, 77, 77, 0.3)',
                                                                    padding: '0.1rem 0.3rem',
                                                                    borderRadius: '4px'
                                                                }}>Min $20</span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                            {/* Display Logic:
                                                                - If Input Mode is CRYPTO: Show how much it COSTS (Fiat Amount)
                                                                - If Input Mode is FIAT: Show how much you GET (Crypto Amount)
                                                            */}
                                                            {inputMode === 'crypto' ? (
                                                                // Show cost in Fiat
                                                                <>
                                                                    {provider === 'transak' && transakQuote && `~${transakQuote.fiatAmount?.toFixed(2)} ${selectedFiat}`}
                                                                    {provider === 'moonpay' && moonPayQuote && `~${moonPayQuote.totalAmount?.toFixed(2)} ${selectedFiat}`}
                                                                </>
                                                            ) : (
                                                                // Show amount in Crypto
                                                                <>
                                                                    {provider === 'transak' && transakQuote && `~${transakQuote.cryptoAmount?.toFixed(4)} ${selectedCrypto}`}
                                                                    {provider === 'moonpay' && moonPayQuote && `~${moonPayQuote.quoteCurrencyAmount?.toFixed(4)} ${selectedCrypto}`}
                                                                </>
                                                            )}

                                                            {/* Show payment methods if no quote yet */}
                                                            {provider === 'transak' && !transakQuote && PROVIDER_INFO.transak.paymentMethods}
                                                            {provider === 'moonpay' && !moonPayQuote && PROVIDER_INFO.moonpay.paymentMethods}
                                                        </div>
                                                    </div>
                                                </div>
                                                {selectedProvider === provider && (
                                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                        <path d="M3 8L6.5 11.5L13 5" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
                                                    </svg>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Mobile Buy Button */}
                        <button
                            onClick={() => selectedProvider === 'transak' ? handleTransak() : handleMoonPay()}
                            disabled={isLoading || !isAmountValid || (selectedProvider === 'moonpay' && !isMoonPayValid)}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: isAmountValid ? 'linear-gradient(135deg, var(--primary) 0%, #00CC6A 100%)' : 'rgba(255, 255, 255, 0.05)',
                                border: 'none',
                                borderRadius: '14px',
                                color: isAmountValid ? '#0a1f0a' : 'var(--text-muted)',
                                fontWeight: 700,
                                fontSize: '1rem',
                                cursor: isAmountValid ? 'pointer' : 'not-allowed',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            {isLoading ? (
                                <span style={{
                                    width: 18,
                                    height: 18,
                                    border: '2px solid rgba(0,0,0,0.2)',
                                    borderTopColor: '#0a1f0a',
                                    borderRadius: '50%',
                                    animation: 'spin 0.8s linear infinite'
                                }} />
                            ) : (
                                <>
                                    Buy with {selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)}
                                    <ExternalLink size={16} />
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    /* DESKTOP: Full Provider Cards */
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            marginBottom: '0.75rem'
                        }}>
                            Choose Provider
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {/* Transak Card */}
                            <button
                                className="provider-card-btn"
                                onClick={handleTransak}
                                disabled={isLoading || !isAmountValid}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    padding: '1.25rem',
                                    background: bestRateInfo?.bestProvider === 'transak'
                                        ? 'linear-gradient(165deg, rgba(0, 255, 136, 0.1) 0%, rgba(0, 200, 100, 0.05) 100%)'
                                        : 'linear-gradient(165deg, var(--surface-2) 0%, var(--surface-1) 100%)',
                                    border: bestRateInfo?.bestProvider === 'transak'
                                        ? '2px solid rgba(0, 255, 136, 0.4)'
                                        : '1px solid var(--border-light)',
                                    borderRadius: '16px',
                                    cursor: isLoading || !isAmountValid ? 'not-allowed' : 'pointer',
                                    opacity: isAmountValid ? 1 : 0.5,
                                    transition: 'all 0.25s ease',
                                    textAlign: 'left',
                                    width: '100%',
                                    position: 'relative'
                                }}
                            >
                                {bestRateInfo?.bestProvider === 'transak' && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '-8px',
                                        right: '12px',
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        color: '#0a1f0a',
                                        background: 'linear-gradient(135deg, #00FF88 0%, #00CC6A 100%)',
                                        padding: '0.25rem 0.6rem',
                                        borderRadius: '20px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        boxShadow: '0 2px 8px rgba(0, 255, 136, 0.3)'
                                    }}>
                                        Recommended
                                    </div>
                                )}
                                <img
                                    src="/images/transak-logo.png"
                                    alt="Transak"
                                    style={{
                                        width: 52,
                                        height: 52,
                                        borderRadius: '14px',
                                        objectFit: 'cover',
                                        flexShrink: 0
                                    }}
                                />
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        fontWeight: 600,
                                        color: 'var(--text)',
                                        marginBottom: '0.3rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontSize: '1rem'
                                    }}>
                                        Transak
                                        <ExternalLink size={13} style={{ color: 'var(--text-dim)' }} />
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                        {PROVIDER_INFO.transak.paymentMethods} • {PROVIDER_INFO.transak.countries} countries
                                    </div>
                                </div>
                                <ArrowRight className="provider-arrow" size={20} style={{ color: bestRateInfo?.bestProvider === 'transak' ? 'var(--primary)' : 'var(--text-muted)', transition: 'all 0.2s ease' }} />
                            </button>

                            {/* MoonPay Card */}
                            <button
                                className="provider-card-btn"
                                onClick={handleMoonPay}
                                disabled={isLoading || !isMoonPayValid}
                                title={!isMoonPayValid ? 'MoonPay requires minimum $20' : ''}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    padding: '1.25rem',
                                    background: bestRateInfo?.bestProvider === 'moonpay'
                                        ? 'linear-gradient(165deg, rgba(0, 255, 136, 0.1) 0%, rgba(0, 200, 100, 0.05) 100%)'
                                        : 'linear-gradient(165deg, var(--surface-2) 0%, var(--surface-1) 100%)',
                                    border: bestRateInfo?.bestProvider === 'moonpay'
                                        ? '2px solid rgba(0, 255, 136, 0.4)'
                                        : '1px solid var(--border-light)',
                                    borderRadius: '16px',
                                    cursor: isLoading || !isMoonPayValid ? 'not-allowed' : 'pointer',
                                    opacity: isMoonPayValid ? 1 : 0.5,
                                    transition: 'all 0.25s ease',
                                    textAlign: 'left',
                                    width: '100%',
                                    position: 'relative'
                                }}
                            >
                                {bestRateInfo?.bestProvider === 'moonpay' && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '-8px',
                                        right: '12px',
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        color: '#0a1f0a',
                                        background: 'linear-gradient(135deg, #00FF88 0%, #00CC6A 100%)',
                                        padding: '0.25rem 0.6rem',
                                        borderRadius: '20px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        boxShadow: '0 2px 8px rgba(0, 255, 136, 0.3)'
                                    }}>
                                        Recommended
                                    </div>
                                )}
                                <img
                                    src="/images/moonpay-logo.png"
                                    alt="MoonPay"
                                    style={{
                                        width: 52,
                                        height: 52,
                                        borderRadius: '14px',
                                        objectFit: 'cover',
                                        flexShrink: 0
                                    }}
                                />
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        fontWeight: 600,
                                        color: 'var(--text)',
                                        marginBottom: '0.3rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontSize: '1rem'
                                    }}>
                                        MoonPay
                                        <ExternalLink size={13} style={{ color: 'var(--text-dim)' }} />
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                        {PROVIDER_INFO.moonpay.paymentMethods} • {PROVIDER_INFO.moonpay.processingTime}
                                    </div>
                                </div>
                                <ArrowRight className="provider-arrow" size={20} style={{ color: bestRateInfo?.bestProvider === 'moonpay' ? 'var(--primary)' : 'var(--text-muted)', transition: 'all 0.2s ease' }} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Disclaimer - Redesigned */}
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.85rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)'
                }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginTop: 2, flexShrink: 0 }}>
                        <circle cx="8" cy="8" r="7" stroke="var(--text-dim)" strokeWidth="1.2" />
                        <path d="M8 5V8.5M8 10.5V11" stroke="var(--text-dim)" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    <p style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-dim)',
                        lineHeight: 1.5,
                        margin: 0
                    }}>
                        You'll be redirected to the provider's secure checkout. ONDRX is not responsible for third-party services.
                    </p>
                </div>
            </div>
        </div >
    );
};
