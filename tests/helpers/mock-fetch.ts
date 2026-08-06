// Mock de fetch para a camada Supabase. sb() só usa status/ok/text() da
// Response, então um objeto simples basta.
import { vi } from 'vitest';

export function makeResponse(status: number, body: any = '') {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}

// Instala um fetch roteado por padrão de URL. Rotas são testadas na ordem;
// a primeira cujo `match` (substring ou regex) casa com a URL responde.
// Sem rota casando: 200 com lista vazia (comportamento inócuo para .catch()).
export function stubFetchRotas(rotas: Array<{ match: string | RegExp; resposta: any; status?: number }>) {
  const chamadas: Array<{ url: string; init: any }> = [];
  const fn = vi.fn(async (url: string, init: any) => {
    chamadas.push({ url, init });
    for (const r of rotas) {
      const casa = typeof r.match === 'string' ? url.includes(r.match) : r.match.test(url);
      if (casa) return makeResponse(r.status ?? 200, r.resposta);
    }
    return makeResponse(200, []);
  });
  vi.stubGlobal('fetch', fn);
  return { fn, chamadas };
}
