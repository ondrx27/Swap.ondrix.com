/**
 * Cloudflare Pages Function: Solana RPC Proxy
 * Route: POST /api/rpc
 *
 * Proxies JSON-RPC calls to the Helius RPC endpoint, keeping the API key
 * server-side and out of the client bundle (SBG-08).
 */

export async function onRequestPost(context) {
    const allowedOrigin = context.env.ALLOWED_ORIGIN || 'https://ondrx.exchange';
    const corsHeaders = {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    const HELIUS_API_KEY = context.env.HELIUS_API_KEY;
    if (!HELIUS_API_KEY) {
        return new Response(JSON.stringify({ error: 'RPC not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    try {
        const body = await context.request.text();

        const rpcResponse = await fetch(
            `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            }
        );

        const data = await rpcResponse.text();

        return new Response(data, {
            status: rpcResponse.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'RPC proxy error', message: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
        },
    });
}
