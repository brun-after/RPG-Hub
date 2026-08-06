// Integração do carregamento progressivo (js/core/supabase.ts):
// fetch roteado por URL, camada de render stubada, asserta a normalização
// linha-do-banco → objeto em memória (batalhas, mapas, personagens, skills).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { stubFetchRotas } from '../helpers/mock-fetch';
import { stubRenderLayer } from '../helpers/ui-stubs';
import { resetEstadoGlobal } from '../helpers/fixtures';

const g = globalThis as any;

const linhaBatalha = {
  id: 'bat-1', mapa_id: 'm1', mapa_nome: 'Cripta', ativa: true, pausada: false,
  turno_round: 2, fase: 'combate',
  participantes: 'não-é-array',      // deve virar []
  ordem_atual: 1,
  iniciativas_roladas: { Aria: 15 },
  empatados: null,                    // deve virar []
  dado_sel: null,
  cooldowns: 'inválido',              // deve virar {}
  recursos_participantes: { Aria: { Mana: 10 } },
};

const linhaMapa = {
  id: 1, rpg_id: 'rpg-teste', map_id: 'm1', nome: 'Cripta',
  escala_val: null, escala_unit: null, grid: null, parent_map_id: null,
  tipo: null, zona_x: null, zona_y: null, zona_w_percent: null,
  zona_h_percent: null, largura_total: 30, altura_total: 20,
  largura_real: null, altura_real: null, representar_pct: null,
  locais: '[{"nome":"Entrada"}]',     // string JSON deve ser parseada
  render_data: null,
};

const linhaChar = {
  id: 'uuid-aria', rpg_id: 'rpg-teste', nome: 'Aria',
  hp_atual: 90, hp_max: 120, xp: 250, nivel: 3, pontos_attr: 2,
  custom_attrs: '{"cor":"#fff"}',     // string JSON deve ser parseada
  map_positions: null, active_map_id: null, buffs: null,
};

function rotasPadrao() {
  return stubFetchRotas([
    { match: 'select=map_id,img_url', resposta: [{ map_id: 'm1', img_url: 'https://x/img.png' }] },
    { match: '/rest/v1/attr_defs', resposta: [{ id: 1, nome: 'Força', categoria: 'basico' }] },
    { match: '/rest/v1/batalhas', resposta: [linhaBatalha] },
    { match: '/rest/v1/atributos_grupos', resposta: [{ nome_customizado: 'Vigor', grupo_base: 'constituicao' }] },
    { match: '/rest/v1/rpg_members', resposta: [{ linked: 'Aria' }] },
    { match: '/rest/v1/mapas', resposta: [linhaMapa] },
    { match: '/rest/v1/characters', resposta: [linhaChar] },
    {
      match: '/rest/v1/skills',
      resposta: [{
        id: 1, personagem: 'Aria', habilidade: 'Bola de Fogo',
        animacao: '{"tipo":"projetil"}', efeitos_bonus: '[{"tipo":"stun"}]',
      }],
    },
    {
      match: '/rest/v1/lore',
      resposta: [
        { id: 1, secao: 'mundo', titulo: 'Intro' },
        { id: 2, secao: 'mapa', titulo: 'oculto' }, // filtrado
      ],
    },
    { match: '/rest/v1/criativos', resposta: [] },
  ]);
}

describe('_carregarProgressivo', () => {
  let stubs: ReturnType<typeof stubRenderLayer>;

  beforeEach(() => {
    resetEstadoGlobal();
    vi.useFakeTimers();
    stubs = stubRenderLayer();
    g.ATTR_MAPPING_CACHE = {};
    g.SESSION = { access_token: 'tok', user: { id: 'user-1' } };
    g.RPG_DATA = {
      rpgId: 'rpg-teste', characters: [], skills: [], lore: [], mapas: [],
      attrDefs: [], linked: null, membrosLinked: {}, _carregandoProgressivo: true,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('normaliza batalhas, mapas, personagens e skills do formato do banco', async () => {
    rotasPadrao();
    await g._carregarProgressivo('rpg-teste');

    // Fase 0 — attr_defs, cache de mapeamento, vínculo e batalhas
    expect(g.RPG_DATA.attrDefs).toHaveLength(1);
    expect(g.ATTR_MAPPING_CACHE['rpg-teste']).toHaveLength(1);
    expect(g.RPG_DATA.linked).toBe('Aria');

    const bat = g.MAPA_STATE.batalhas['bat-1'];
    expect(bat).toBeTruthy();
    expect(bat.turnoRound).toBe(2);
    expect(bat.participantes).toEqual([]);          // não-array saneado
    expect(bat.empatados).toEqual([]);
    expect(bat.cooldowns).toEqual({});              // valor inválido saneado
    expect(bat.iniciativasRoladas).toEqual({ Aria: 15 });
    expect(bat.recursos_participantes).toEqual({ Aria: { Mana: 10 } });

    // Fase 1 — mapas com defaults e locais parseados
    const mapa = g.RPG_DATA.mapas[0].mapa;
    expect(mapa.map_id).toBe('m1');
    expect(mapa.img_url).toBe('');                  // imagens só na fase 4
    expect(mapa.escala_val).toBe(1.5);              // ?? default
    expect(mapa.grid).toBe(20);
    expect(mapa.tipo).toBe('geral');
    expect(mapa.locais).toEqual([{ nome: 'Entrada' }]);

    // Fase 2 — personagem com custom_attrs parseado e colunas espelhadas
    const char = g.RPG_DATA.characters[0];
    expect(char.custom_attrs).toMatchObject({ cor: '#fff', nivel: 3, hp_max: 120, xp: 250, pontos_attr: 2 });
    expect(char.buffs).toEqual([]);
    expect(char.map_positions).toEqual({});
    expect(g.CHAR_VIEW).toBe('Aria');               // vinculado ao linked

    // Fase 3 — skills parseadas e lore sem seção "mapa"
    expect(g.RPG_DATA.skills[0].animacao).toEqual({ tipo: 'projetil' });
    expect(g.RPG_DATA.skills[0].efeitos_bonus).toEqual([{ tipo: 'stun' }]);
    expect(g.RPG_DATA.lore.map((l: any) => l.secao)).toEqual(['mundo']);

    // Render layer notificada
    expect(stubs.renderMapasTab).toHaveBeenCalled();
    expect(stubs.renderCharButtons).toHaveBeenCalled();
    expect(stubs.renderLore).toHaveBeenCalled();
  });

  it('fase 4 preenche img_url dos mapas após o defer de 300ms', async () => {
    rotasPadrao();
    await g._carregarProgressivo('rpg-teste');
    expect(g.RPG_DATA.mapas[0].mapa.img_url).toBe('');

    await vi.advanceTimersByTimeAsync(300);
    expect(g.RPG_DATA.mapas[0].mapa.img_url).toBe('https://x/img.png');
  });

  it('falha em uma fase não derruba as demais', async () => {
    stubFetchRotas([
      { match: '/rest/v1/mapas', resposta: 'boom', status: 500 },  // fase 1 falha
      { match: '/rest/v1/characters', resposta: [linhaChar] },
    ]);
    await g._carregarProgressivo('rpg-teste');

    expect(g.RPG_DATA.mapas).toEqual([]);           // fase 1 falhou
    expect(g.RPG_DATA.characters).toHaveLength(1);  // fase 2 seguiu normal
  });
});
