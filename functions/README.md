# Cloudflare Pages Functions (Same-Domain API)

Functions are automatically served on the same domain as the site.

## Structure

```
functions/
  api/
    rpc.js   → POST /api/rpc  (Solana RPC proxy)
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `HELIUS_API_KEY` | Helius RPC API key | `your-helius-key` |
| `ALLOWED_ORIGIN` | CORS allowed origin | `https://swap.ondrix.com` |

## Deploy

```bash
# 1. Build the project
npm run build

# 2. Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=jupiter-exchange

# 3. Add environment variables in Pages settings:
#    Dashboard → Pages → [project] → Settings → Environment variables
#    - HELIUS_API_KEY
#    - ALLOWED_ORIGIN
```

## How it works

1. Cloudflare Pages automatically detects the `functions/` directory
2. `api/rpc.js` becomes an API endpoint at `/api/rpc`
3. Site at `domain.com`, API at `domain.com/api/*`
4. No CORS issues — everything on the same domain
