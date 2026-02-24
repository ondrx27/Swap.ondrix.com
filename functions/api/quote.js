/**
 * Cloudflare Pages Function: Get MoonPay Quote
 * Route: GET /api/quote
 *
 * Synced with server/index.js logic - includes retry mechanism
 */

// Allowlist for currency codes — lowercase letters only, 2-10 chars (SBG-09)
const CURRENCY_CODE_RE = /^[a-z]{2,10}$/;

export async function onRequestGet(context) {
    // Restrict CORS to the configured origin instead of wildcard (SBG-04)
    const allowedOrigin = context.env.ALLOWED_ORIGIN || 'https://ondrx.exchange';
    const corsHeaders = {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    try {
        // Get MoonPay API key from environment
        const MOONPAY_API_KEY = context.env.MOONPAY_API_KEY;
        if (!MOONPAY_API_KEY) {
            return new Response(JSON.stringify({ error: 'MoonPay API key not configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const url = new URL(context.request.url);
        const currencyCode = url.searchParams.get('currencyCode');
        const baseCurrencyAmount = url.searchParams.get('baseCurrencyAmount');
        const quoteCurrencyAmount = url.searchParams.get('quoteCurrencyAmount');
        const baseCurrencyCode = url.searchParams.get('baseCurrencyCode') || 'usd';

        if (!currencyCode || (!baseCurrencyAmount && !quoteCurrencyAmount)) {
            return new Response(JSON.stringify({
                error: 'Missing required parameters: currencyCode and either baseCurrencyAmount or quoteCurrencyAmount'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Validate currencyCode and baseCurrencyCode to prevent URL injection (SBG-09)
        if (!CURRENCY_CODE_RE.test(currencyCode) || !CURRENCY_CODE_RE.test(baseCurrencyCode)) {
            return new Response(JSON.stringify({ error: 'Invalid currency code format' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Build MoonPay quote URL - include payment method for accurate fees
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

        // Fetch with retry logic (matching server/index.js)
        const fetchWithRetry = async (fetchUrl, retries = 2) => {
            for (let i = 0; i <= retries; i++) {
                try {
                    const response = await fetch(fetchUrl, {
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'MoonPay-Proxy/1.0'
                        }
                    });
                    return response;
                } catch (error) {
                    if (i === retries) throw error;
                    // Wait 1s before retry
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        };

        const response = await fetchWithRetry(quoteUrl);

        if (!response.ok) {
            const errorText = await response.text();
            return new Response(JSON.stringify({
                error: 'Failed to get quote from MoonPay',
                details: errorText
            }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const quoteData = await response.json();

        return new Response(JSON.stringify(quoteData), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to get quote', message: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

export async function onRequestOptions(context) {
    const allowedOrigin = context.env.ALLOWED_ORIGIN || 'https://ondrx.exchange';
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}
