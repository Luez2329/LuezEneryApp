const PVGIS_TMY_URL = 'https://re.jrc.ec.europa.eu/api/tmy';
const ALLOWED_ORIGINS = new Set([
  'https://luez2329.github.io',
  'http://127.0.0.1:8765',
  'http://localhost:8765'
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://luez2329.github.io',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(data, status, request, cacheControl = 'no-store') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl
    }
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (request.method !== 'GET') return json({ error: 'Método no permitido.' }, 405, request);

    const incoming = new URL(request.url);
    if (incoming.pathname !== '/' && incoming.pathname !== '/api/tmy') {
      return json({ error: 'Ruta no encontrada.' }, 404, request);
    }

    const lat = Number(incoming.searchParams.get('lat'));
    const lon = Number(incoming.searchParams.get('lon'));
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      return json({ error: 'Latitud o longitud inválida.' }, 400, request);
    }

    const target = new URL(PVGIS_TMY_URL);
    target.searchParams.set('lat', lat.toFixed(6));
    target.searchParams.set('lon', lon.toFixed(6));
    target.searchParams.set('outputformat', 'json');

    try {
      const upstream = await fetch(target, {
        headers: { 'User-Agent': 'LuezEnergyApp/1.0 (PVGIS public-data proxy)' },
        cf: { cacheEverything: true, cacheTtl: 86400 }
      });
      const body = await upstream.text();
      if (!upstream.ok) {
        return json({ error: `PVGIS respondió ${upstream.status}.`, detail: body.slice(0, 500) }, 502, request);
      }
      return new Response(body, {
        status: 200,
        headers: {
          ...corsHeaders(request),
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=3600, s-maxage=86400'
        }
      });
    } catch (error) {
      return json({ error: 'No fue posible conectar con PVGIS.', detail: error.message }, 502, request);
    }
  }
};
