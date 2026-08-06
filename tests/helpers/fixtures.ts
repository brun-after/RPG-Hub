// Builders de fixtures compartilhados. Cada builder devolve um objeto novo no
// formato que o código de produção espera (characters, mapas, batalhas), com
// overrides pontuais por teste.
import { vi } from 'vitest';

// Mocka Math.random com uma sequência determinística; a última entrada repete
// se houver mais chamadas que valores. Para obter o valor v num dado de N
// faces: random = (v - 1) / N.
export function mockRandomSeq(vals: number[]) {
  let i = 0;
  return vi.spyOn(Math, 'random').mockImplementation(
    () => vals[Math.min(i++, vals.length - 1)],
  );
}

export function makeChar(overrides: any = {}) {
  return {
    id: overrides.id ?? 'char-uuid-1',
    rpg_id: 'rpg-teste',
    nome: 'Aria',
    hp_atual: 100,
    hp_max: 100,
    nivel: 1,
    xp: 0,
    pontos_attr: 0,
    active_map_id: null,
    map_positions: {},
    buffs: [],
    ...overrides,
    custom_attrs: {
      tipo: 'jogador',
      hp_max: 100,
      nivel: 1,
      atributos: {},
      ...(overrides.custom_attrs || {}),
    },
  };
}

export function makeMapa(overrides: any = {}) {
  return {
    map_id: 'mapa-1',
    nome: 'Mapa de Teste',
    tipo: 'tatico',
    img_url: '',
    escala_val: 1.5,
    escala_unit: 'm',
    grid: 20,
    largura_total: 20,
    altura_total: 20,
    parent_map_id: null,
    locais: [],
    render_data: null,
    ...overrides,
  };
}

// Entrada de RPG_DATA.mapas: { id, rpg_id, mapa: {...} }
export function makeMapaEntry(overrides: any = {}) {
  return { id: 1, rpg_id: 'rpg-teste', mapa: makeMapa(overrides) };
}

export function makeBatalha(overrides: any = {}) {
  return {
    id: 'batalha-1',
    mapa_id: 'mapa-1',
    mapa_nome: 'Mapa de Teste',
    ativa: true,
    pausada: false,
    fase: 'combate',
    turnoRound: 1,
    participantes: [],
    ordemAtual: 0,
    iniciativasRoladas: {},
    empatados: [],
    dadoSel: null,
    cooldowns: {},
    recursos_participantes: {},
    ...overrides,
  };
}

export function makeAttrDef(overrides: any = {}) {
  return {
    id: 1,
    rpg_id: 'rpg-teste',
    nome: 'Força',
    tipo: 'number',
    opcoes: null,
    ordem: 1,
    categoria: 'basico',
    ...overrides,
  };
}

// Reseta o estado global mutável entre testes (RPG_DATA etc. têm setters).
export function resetEstadoGlobal() {
  const g = globalThis as any;
  g.RPG_DATA = null;
  g.SESSION = null;
  g.CURRENT_RPG = null;
  g.BATALHA_ATUAL_ID = null;
  g.MAPA_STATE.batalhas = {};
  g.MAPA_STATE.mapaAtualId = null;
  g.COMBATE = undefined;
  g.AR = undefined;
}
