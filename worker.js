// Worker.js
interface Env {
  CORS_ALLOW_ORIGIN: string;
  HELIUS_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env) {
    // --- CORS headers ---
    const supportedDomains = env.CORS_ALLOW_ORIGIN
      ? env.CORS_ALLOW_ORIGIN.split(',')
      : undefined;

    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-client-secret",
    };

    const origin = request.headers.get('Origin');
    if (supportedDomains && origin && supportedDomains.includes(origin)) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
    } else {
      corsHeaders['Access-Control-Allow-Origin'] = '*';
    }

    // --- Handle OPTIONS preflight ---
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    // --- Handle WebSocket upgrade ---
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
      const wsUrl = `https://mainnet.helius-rpc.com/`;
      return fetch(wsUrl, {
        method: request.method,
        headers: {
          "x-api-key": env.HELIUS_API_KEY,
        },
        body: request.body,
      });
    }

    // --- Regular HTTP/JSON RPC proxy ---
    const { pathname, search } = new URL(request.url);
    const payload = await request.text();

    // Determine Helius endpoint
    const heliusHost =
      pathname === '/' ? 'mainnet.helius-rpc.com' : 'api.helius.xyz';
    const heliusUrl = `https://${heliusHost}${pathname}${search || ''}`;

    const proxyRequest = new Request(heliusUrl, {
      method: request.method,
      body: payload || null,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.HELIUS_API_KEY,
        "X-Helius-Cloudflare-Proxy": "true",
      },
    });

    const res = await fetch(proxyRequest);

    // Return response with CORS headers
    const responseHeaders = new Headers(res.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return new Response(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  },
};
