export default {
  async fetch(request, env) {
    // --- API ключ из секретов окружения ---
    const HELIUS_API_KEY = env.HELIUS_API_KEY;

    // --- CORS headers для всех ---
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-client-secret",
    };

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

    // --- Regular HTTP/JSON RPC ---
    const { pathname, search } = new URL(request.url);
    const payload = await request.text();

    // Определяем хост Helius
    const heliusHost = pathname === '/' ? 'mainnet.helius-rpc.com' : 'api.helius.xyz';
    const heliusUrl = `https://${heliusHost}${pathname}${search || ''}`;

    // --- Формируем прокси-запрос с ключом в заголовке ---
    const proxyRequest = new Request(heliusUrl, {
      method: request.method,
      body: payload || null,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": HELIUS_API_KEY,
        "X-Helius-Cloudflare-Proxy": "true",
      },
    });

    // Отправляем запрос на Helius
    const res = await fetch(proxyRequest);

    // --- Добавляем CORS к ответу ---
    const responseHeaders = new Headers(res.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return new Response(res.body, { status: res.status, headers: responseHeaders });
  },
};
