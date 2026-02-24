import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import dns from 'dns';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Force IPv4 first to avoid ETIMEDOUT issues with IPv6
dns.setDefaultResultOrder('ipv4first');

// Only allow signing URLs destined for official MoonPay hostnames (SBG-07)
const ALLOWED_MOONPAY_HOSTS = ['buy.moonpay.com', 'buy-sandbox.moonpay.com'];

// Allowlist for currency codes — lowercase letters only, 2-10 chars (SBG-09)
const CURRENCY_CODE_RE = /^[a-z]{2,10}$/;

const app = express();
const PORT = 3001;

// MoonPay keys from environment variables
const MOONPAY_SECRET_KEY = process.env.MOONPAY_SECRET_KEY;
const MOONPAY_API_KEY = process.env.MOONPAY_API_KEY;

if (!MOONPAY_SECRET_KEY || !MOONPAY_API_KEY) {
    console.error('❌ Missing required environment variables: MOONPAY_SECRET_KEY and/or MOONPAY_API_KEY');
    console.error('   Please add them to your .env file');
    process.exit(1);
}

// Enable CORS for development
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));

app.use(express.json());

/**
 * Sign a MoonPay URL
 * POST /api/moonpay/sign
 * Body: { url: string }
 * Returns: { signedUrl: string, signature: string }
 */
app.post('/api/moonpay/sign', (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Validate that the URL targets an official MoonPay host (SBG-07)
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        if (!ALLOWED_MOONPAY_HOSTS.includes(parsedUrl.hostname)) {
            return res.status(403).json({ error: 'URL origin not permitted' });
        }

        // Parse the URL to get the query string
        const queryString = parsedUrl.search; // Includes the leading '?'

        // Create HMAC-SHA256 signature
        const signature = crypto
            .createHmac('sha256', MOONPAY_SECRET_KEY)
            .update(queryString)
            .digest('base64');

        // URL-encode the signature and append to URL
        const encodedSignature = encodeURIComponent(signature);
        const signedUrl = `${url}&signature=${encodedSignature}`;

        // NOTE: Do not log signedUrl — it contains a sensitive HMAC signature (SBG-05)

        res.json({
            signedUrl,
            signature: encodedSignature
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to sign URL' });
    }
});

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'moonpay-signer' });
});

/**
 * Get a buy quote from MoonPay
 * GET /api/moonpay/quote?currencyCode=sol&baseCurrencyAmount=50&baseCurrencyCode=usd
 * OR for crypto amount: GET /api/moonpay/quote?currencyCode=sol&quoteCurrencyAmount=1
 * Returns: { quoteCurrencyAmount, feeAmount, totalAmount, baseCurrencyAmount, ... }
 */
app.get('/api/moonpay/quote', async (req, res) => {
    try {
        const { currencyCode, baseCurrencyAmount, quoteCurrencyAmount, baseCurrencyCode = 'usd' } = req.query;

        if (!currencyCode || (!baseCurrencyAmount && !quoteCurrencyAmount)) {
            return res.status(400).json({
                error: 'Missing required parameters: currencyCode and either baseCurrencyAmount or quoteCurrencyAmount'
            });
        }

        // Validate currency codes to prevent URL injection (SBG-09)
        if (!CURRENCY_CODE_RE.test(currencyCode) || !CURRENCY_CODE_RE.test(baseCurrencyCode)) {
            return res.status(400).json({ error: 'Invalid currency code format' });
        }

        // MoonPay Quote API - include payment method for accurate fees
        let quoteUrl = `https://api.moonpay.com/v3/currencies/${currencyCode}/buy_quote?` +
            `apiKey=${MOONPAY_API_KEY}` +
            `&baseCurrencyCode=${baseCurrencyCode}` +
            `&paymentMethod=credit_debit_card`;

        // Add either baseCurrencyAmount (fiat) or quoteCurrencyAmount (crypto)
        if (quoteCurrencyAmount) {
            quoteUrl += `&quoteCurrencyAmount=${quoteCurrencyAmount}`;
        } else {
            quoteUrl += `&baseCurrencyAmount=${baseCurrencyAmount}`;
        }

        // NOTE: Do not log quoteUrl — it contains the MoonPay API key (SBG-05)

        // Fetch with timeout and retry
        const fetchWithTimeout = async (url, timeout = 15000, retries = 2) => {
            for (let i = 0; i <= retries; i++) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), timeout);

                    const response = await fetch(url, {
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'MoonPay-Proxy/1.0'
                        }
                    });

                    clearTimeout(timeoutId);
                    return response;
                } catch (error) {
                    if (i === retries) throw error;
                    await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
                }
            }
        };

        const response = await fetchWithTimeout(quoteUrl);

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({
                error: 'Failed to get quote from MoonPay',
                details: errorText
            });
        }

        const quoteData = await response.json();

        res.json(quoteData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get quote', message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 MoonPay signing server running on http://localhost:${PORT}`);
    console.log(`   POST /api/moonpay/sign - Sign a MoonPay URL`);
});
