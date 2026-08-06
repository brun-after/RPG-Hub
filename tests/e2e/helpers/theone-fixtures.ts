// Fixtures da aventura REAL "The One" (the_one_avt_mqfyesmr) para simulação
// hermética. A linha de rpg_registry é a exportação byte-a-byte do banco de
// produção (md5 3ba6f4f886c6dcabdda6127af32911d4, 2026-08-06) em
// theone-registry.json; characters/skills usam o shape canônico de
// tests/sim/fixtures-aventura.ts preenchido com os nomes/ids reais da campanha.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserContext, Route } from '@playwright/test';

export const THEONE_RPG_ID = 'the_one_avt_mqfyesmr';

const REGISTRY_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'theone-registry.json');

export const SUPABASE_URL = 'https://exfcimrtyuhygiicspwh.supabase.co';

export function makeTheOneRegistryRows(): any[] {
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

const ATTRS_GUERREIRO = { 'Força': 15, 'Destreza': 10, 'Constituição': 17, 'Inteligência': 8, 'Sabedoria': 8 };
const ATTRS_MAGO      = { 'Força': 9,  'Destreza': 12, 'Constituição': 10, 'Inteligência': 15, 'Sabedoria': 14 };

// ids reais de characters vistos nos logs da API de produção (2026-08-06).
export const CHAR_IDS = {
  ares:    'e84eaa9a-6ad4-48e9-a203-bed2400591b4',
  haima:   'e9afbe2a-c71f-459c-bbb1-7471369c6fa2',
  sylphia: '3a60e792-c043-4170-9fb3-d30e3ccd5c96',
  oblivio: 'char-oblivio-sim',
};

// ids reais de skills (query em produção, 2026-08-06).
export const SKILL_IDS = {
  arcoEmChamas:   '55b51e33-445f-40f5-84c6-13395f3f6da1',
  estrelaEsparta: '1259a756-b20d-428e-9bc8-7575aba64253',
  chicoteDeLava:  'e913ca1c-e350-4c46-84bf-722b483c300d',
  lancaCarmesim:  '311cf77f-8530-49cd-afa5-310242db2644',
  necromancer:    'fa8daff5-6e2e-4cd6-a697-00fa682ba710',
  corteSangrento: '6f846d4e-3bf6-4096-93b6-eb1d656087c8',
  mordida:        'bbc6715a-9e2d-4f85-af9a-b71b062dd2be',
  maoEsqueleto:   '5d522ddb-329a-46d9-a30d-db6ef68d2b60',
  thunder:        'fa4cdbc7-4793-4b2b-844e-e7ff125a0778',
  ixitalor:       '5a54dafb-6e38-40b6-a845-393cb35ee8c7',
  wave:           '42f991d1-f33c-4916-9239-3d3f8b188e04',
};

export function makeTheOneCharsRows() {
  const mk = (id: string, nome: string, classe: string, x: number, y: number,
              atrs: any, mana: number, skillsIds: string[]) => ({
    id, rpg_id: THEONE_RPG_ID, nome,
    hp_atual: null, hp_max: null, nivel: 2, xp: 0, pontos_attr: 0,
    custom_attrs: {
      classe_aventura: classe, cor: '#4fa3d1',
      avt_x: x, avt_y: y,
      skills_ids: skillsIds,
      atributos: { ...atrs, Mana: mana, ManaMax: mana },
    },
  });
  return [
    mk(CHAR_IDS.ares, 'Ares', 'guerreiro', 7, 4, ATTRS_GUERREIRO, 10,
       [SKILL_IDS.arcoEmChamas, SKILL_IDS.estrelaEsparta, SKILL_IDS.chicoteDeLava, SKILL_IDS.lancaCarmesim]),
    mk(CHAR_IDS.haima, 'Haima Volkov', 'mago', 8, 4, ATTRS_MAGO, 14,
       [SKILL_IDS.necromancer, SKILL_IDS.corteSangrento, SKILL_IDS.mordida, SKILL_IDS.maoEsqueleto]),
    mk(CHAR_IDS.sylphia, 'Sylphia', 'mago', 21, 4, ATTRS_MAGO, 14, [SKILL_IDS.thunder]),
    mk(CHAR_IDS.oblivio, 'Oblivio', 'mago', 23, 11, ATTRS_MAGO, 14, [SKILL_IDS.ixitalor, SKILL_IDS.wave]),
  ];
}

export function makeTheOneSkillsRows() {
  const base = {
    rpg_id: THEONE_RPG_ID, cooldown_turnos: 0, atributo_base: 'Inteligência',
    alvo_tipo: 'inimigo', efeitos_bonus: [] as any,
    critico_positivo: null, critico_negativo: null,
  };
  return [
    { ...base, id: SKILL_IDS.arcoEmChamas, personagem: 'Ares', character_id: CHAR_IDS.ares,
      habilidade: 'Arco em chamas', efeito: 'Flecha flamejante',
      formula_dano: '2d8+4', custo_rsv: '3 Mana', tipo_dano: 'fogo', alcance_celulas: 6,
      // produção: animacao.tipo === 'pixi_studio' com referencia_img data-URI de 790KB
      animacao: { tipo: 'pixi_studio', cor: '#e74c3c', posicao: 'atacante',
                  pixi_studio_id: 'fac7e4c6-ff9f-4eed-9fc5-978c70a26e97',
                  audio: { cast: 'arrow_whoosh', impact: 'ice_shatter', volume: 0.75 } } },
    { ...base, id: SKILL_IDS.estrelaEsparta, personagem: 'Ares', character_id: CHAR_IDS.ares,
      habilidade: 'A estrela de Esparta', efeito: 'Golpe astral',
      formula_dano: '3d6+5', custo_rsv: '4 Mana', tipo_dano: 'magico', alcance_celulas: 5,
      animacao: { tipo: 'projetil', cor: '#f1c40f' } },
    { ...base, id: SKILL_IDS.chicoteDeLava, personagem: 'Ares', character_id: CHAR_IDS.ares,
      habilidade: 'Chicote de lava', efeito: 'Chicote incandescente',
      formula_dano: '2d6+4', custo_rsv: '3 Mana', tipo_dano: 'fogo', alcance_celulas: 4,
      // string JSON de propósito — exercita o parse do loader (aventura.ts:4019)
      animacao: '{"tipo":"projetil","cor":"#e8604c"}',
      efeitos_bonus: '[{"nome":"Queimadura","dot_formula":"1d4","dot_turnos":2}]' },
    { ...base, id: SKILL_IDS.lancaCarmesim, personagem: 'Ares', character_id: CHAR_IDS.ares,
      habilidade: 'Lança carmesim', efeito: 'Lança de sangue',
      formula_dano: '2d6+3', custo_rsv: '2 Mana', tipo_dano: 'fisico', alcance_celulas: 4,
      animacao: { tipo: 'projetil', cor: '#c0392b' } },
    { ...base, id: SKILL_IDS.necromancer, personagem: 'Haima Volkov', character_id: CHAR_IDS.haima,
      habilidade: 'Necromancer', efeito: 'Invoca morto-vivo',
      formula_dano: '1d6', custo_rsv: '5 Mana', tipo_dano: 'sombrio', alcance_celulas: 4,
      animacao: { tipo: 'projetil', cor: '#8e44ad' } },
    { ...base, id: SKILL_IDS.corteSangrento, personagem: 'Haima Volkov', character_id: CHAR_IDS.haima,
      habilidade: 'Corte sangrento', efeito: 'Corte que sangra',
      formula_dano: '2d6+2', custo_rsv: '2 Mana', tipo_dano: 'fisico', alcance_celulas: 2,
      efeitos_bonus: [{ nome: 'Sangramento', dot_formula: '1d4', dot_turnos: 2 }],
      animacao: { tipo: 'projetil', cor: '#a93226' } },
    { ...base, id: SKILL_IDS.mordida, personagem: 'Haima Volkov', character_id: CHAR_IDS.haima,
      habilidade: 'Mordida', efeito: 'Mordida vampírica',
      formula_dano: '1d8+2', custo_rsv: '1 Mana', tipo_dano: 'fisico', alcance_celulas: 1,
      animacao: { tipo: 'projetil', cor: '#7b241c' } },
    { ...base, id: SKILL_IDS.maoEsqueleto, personagem: 'Haima Volkov', character_id: CHAR_IDS.haima,
      habilidade: 'Mão de esqueleto', efeito: 'Agarra o alvo',
      formula_dano: '1d6+1', custo_rsv: '2 Mana', tipo_dano: 'sombrio', alcance_celulas: 3,
      animacao: null },
    { ...base, id: SKILL_IDS.thunder, personagem: 'Sylphia', character_id: CHAR_IDS.sylphia,
      habilidade: 'Thunder', efeito: 'Raio celeste',
      formula_dano: '3d6', custo_rsv: '4 Mana', tipo_dano: 'eletrico', alcance_celulas: 5,
      animacao: { tipo: 'projetil', cor: '#5dade2' } },
    { ...base, id: SKILL_IDS.ixitalor, personagem: 'Oblivio', character_id: CHAR_IDS.oblivio,
      habilidade: 'Ixitalor', efeito: 'Vazio devorador',
      formula_dano: '2d8', custo_rsv: '4 Mana', tipo_dano: 'sombrio', alcance_celulas: 4,
      animacao: { tipo: 'projetil', cor: '#2c3e50' } },
    { ...base, id: SKILL_IDS.wave, personagem: 'Oblivio', character_id: CHAR_IDS.oblivio,
      habilidade: 'Wave', efeito: 'Onda de choque',
      formula_dano: '1d10', custo_rsv: '2 Mana', tipo_dano: 'magico', alcance_celulas: 3,
      animacao: { tipo: 'projetil', cor: '#16a085' } },
  ];
}

export interface ReqLogEntry { method: string; url: string; body?: string; }

function respostaRest(url: string, method: string): any {
  if (method !== 'GET') return []; // PATCH/POST/DELETE: eco inerte
  if (url.includes('/rest/v1/rpg_registry')) return makeTheOneRegistryRows();
  if (url.includes(`/rest/v1/characters?rpg_id=eq.${THEONE_RPG_ID}`)) return makeTheOneCharsRows();
  if (url.includes(`/rest/v1/skills?rpg_id=eq.${THEONE_RPG_ID}`)) return makeTheOneSkillsRows();
  // attr_defs: a campanha real tem 0 linhas — retorno [] é fiel à produção.
  // item_catalog/rpg_members/batalhas/inventario/etc.: inertes.
  return [];
}

// Rede 100% hermética + gravador de tráfego REST (para diagnóstico de chamadas
// que na produção falham: rpc/npc_update_position 404, avt_session_state 404…).
export async function instalarRedeTheOne(context: BrowserContext, uid: string, reqLog: ReqLogEntry[]) {
  await context.route('**/*', (route: Route) => {
    const req = route.request();
    const url = req.url();

    if (url.startsWith('http://localhost:4173')) return route.continue();

    const json = (body: any, status = 200) => route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify(body),
    });

    if (url.startsWith(SUPABASE_URL)) {
      const entry: ReqLogEntry = { method: req.method(), url };
      if (req.method() !== 'GET') entry.body = (req.postData() || '').slice(0, 300);
      reqLog.push(entry);
    }

    if (url.startsWith(`${SUPABASE_URL}/auth/v1/token`)) {
      return json({ access_token: `tok-${uid}`, refresh_token: `ref-${uid}`,
                    user: { id: uid, email: `${uid}@sim.test` } });
    }
    if (url.startsWith(`${SUPABASE_URL}/auth/v1/user`)) return json({ user_metadata: {} });
    if (url.startsWith(`${SUPABASE_URL}/rest/v1/`)) return json(respostaRest(url, req.method()));
    if (url.startsWith(`${SUPABASE_URL}/storage/`)) return json({});

    return route.abort();
  });
}
