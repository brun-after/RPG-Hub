// Interceptação REST/auth do Supabase para o teste hermético.
// Reusa os shapes de tests/sim/fixtures-aventura.ts — uma única fonte de
// verdade de schema para as duas camadas (Vitest e Playwright).
import type { BrowserContext, Route } from '@playwright/test';
import {
  RPG_ID, makeRpgRegistryRow, makeCharsRows, makeSkillsRows, makeAttrDefsRows,
} from '../../sim/fixtures-aventura';

// Mesmo valor hardcoded de js/config.ts — o app só fala com este host.
export const SUPABASE_URL = 'https://exfcimrtyuhygiicspwh.supabase.co';

function json(route: Route, body: any, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function respostaRest(url: string, method: string): any {
  if (method !== 'GET') return []; // PATCH/POST/DELETE: eco inerte
  if (url.includes('/rest/v1/rpg_registry')) return [makeRpgRegistryRow()];
  if (url.includes(`/rest/v1/characters?rpg_id=eq.${RPG_ID}`)) return makeCharsRows();
  if (url.includes(`/rest/v1/skills?rpg_id=eq.${RPG_ID}`)) return makeSkillsRows();
  if (url.includes(`/rest/v1/attr_defs?rpg_id=eq.${RPG_ID}`)) return makeAttrDefsRows();
  // item_catalog, rpg_members, batalhas, criativos, lore, mapas,
  // avt_session_state, rpg_session_state, npc_state, rpc/*, players, …
  return [];
}

// Rede 100% hermética: Supabase é interceptado com fixtures, o preview local
// passa, e QUALQUER outra origem (hcaptcha, fontes, CDNs) é abortada — nenhum
// byte sai para a internet.
export async function instalarRedeHermetica(context: BrowserContext, uid: string) {
  await context.route('**/*', route => {
    const req = route.request();
    const url = req.url();

    if (url.startsWith('http://localhost:4173')) return route.continue();

    if (url.startsWith(`${SUPABASE_URL}/auth/v1/token`)) {
      return json(route, {
        access_token: `tok-${uid}`,
        refresh_token: `ref-${uid}`,
        user: { id: uid, email: `${uid}@sim.test` },
      });
    }
    if (url.startsWith(`${SUPABASE_URL}/auth/v1/user`)) {
      return json(route, { user_metadata: {} });
    }
    if (url.startsWith(`${SUPABASE_URL}/rest/v1/`)) {
      return json(route, respostaRest(url, req.method()));
    }
    if (url.startsWith(`${SUPABASE_URL}/storage/`)) {
      return json(route, {});
    }

    return route.abort();
  });
}
