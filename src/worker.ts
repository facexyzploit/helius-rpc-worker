export default {
  async fetch(request, env) {
    const HELIUS_API_KEY = env.HELIUS_API_KEY;
    const CORS_ALLOW_ORIGIN = env.CORS_ALLOW_ORIGIN;

    // --- CORS headers ---
    const supportedDomains = CORS_ALLOW_ORIGIN ? CORS_ALLOW_ORIGIN.split(',') : undefined;
    const corsHeaders = {
      "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-client-secret",
    };

    const origin = request.headers.get('Origin');
    if (supportedDomains && origin && supportedDomains.includes(origin)) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
    } else {
      corsHeaders['Access-Control-Allow-Origin'] = '*';
    }

    // --- OPTIONS preflight ---
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    // --- WebSocket upgrade ---
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
      return fetch(`https://mainnet.helius-rpc.com/`, {
        method: request.method,
        headers: { "x-api-key": HELIUS_API_KEY },
        body: request.body,
      });
    }

    // --- Regular HTTP RPC ---
    const { pathname, search } = new URL(request.url);
    const payload = await request.text();
    const heliusHost = pathname === '/' ? 'mainnet.helius-rpc.com' : 'api.helius.xyz';
    const heliusUrl = `https://${heliusHost}${pathname}${search || ''}`;

    const proxyRequest = new Request(heliusUrl, {
      method: request.method,
      body: payload || null,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": HELIUS_API_KEY,
        "X-Helius-Cloudflare-Proxy": "true",
      },
    });

    const res = await fetch(proxyRequest);

    const responseHeaders = new Headers(res.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return new Response(res.body, { status: res.status, headers: responseHeaders });
  },
};