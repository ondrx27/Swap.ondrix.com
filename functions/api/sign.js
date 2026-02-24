/**
 * Cloudflare Pages Function: Sign MoonPay URL
 * Route: POST /api/sign
 *
 * Synced with server/index.js logic
 */

// Only allow signing URLs destined for official MoonPay hostnames (SBG-07)
const ALLOWED_MOONPAY_HOSTS = ['buy.moonpay.com', 'buy-sandbox.moonpay.com'];

export async function onRequestPost(context) {
    // Restrict CORS to the configured origin instead of wildcard (SBG-04)
    const allowedOrigin = context.env.ALLOWED_ORIGIN || 'https://ondrx.exchange';
    const corsHeaders = {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    try {
        const { url: moonpayUrl } = await context.request.json();

        if (!moonpayUrl) {
            return new Response(JSON.stringify({ error: 'URL is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Validate that the URL targets an official MoonPay host (SBG-07)
        let parsedUrl;
        try {
            parsedUrl = new URL(moonpayUrl);
        } catch {
            return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        if (!ALLOWED_MOONPAY_HOSTS.includes(parsedUrl.hostname)) {
            return new Response(JSON.stringify({ error: 'URL origin not permitted' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Get secret key from environment
        const secretKey = context.env.MOONPAY_SECRET_KEY;
        if (!secretKey) {
            return new Response(JSON.stringify({ error: 'Secret key not configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Parse the URL to get the query string (includes the leading '?')
        const queryString = parsedUrl.search; // Includes the leading '?'

        // Create HMAC-SHA256 signature using Web Crypto API
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secretKey),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signatureBuffer = await crypto.subtle.sign(
            'HMAC',
            key,
            encoder.encode(queryString) // Sign with '?' prefix like the local server
        );

        // Convert to base64
        const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

        // URL-encode the signature and append to URL
        const encodedSignature = encodeURIComponent(signatureBase64);
        const signedUrl = `${moonpayUrl}&signature=${encodedSignature}`;

        return new Response(JSON.stringify({
            signedUrl,
            signature: encodedSignature
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to sign URL', message: error.message }), {
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
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}
