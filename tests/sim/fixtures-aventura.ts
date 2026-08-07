// Fixtures REST do Modo Aventura para o bot de simulação. Uma única fonte de
// shapes — a Camada B (Playwright) reusa estes objetos para as rotas
// interceptadas, então drift de schema quebra num lugar só.
//
// Tudo é determinístico de propósito: dungeon vem pronta em
// theme_json.dungeon_data (nada de geração procedural), NPCs vêm de
// _inimigosJson com tipoClasse e atributos_base fixos (npc_level 1 → cópia
// direta, sem _avtNivelarNpc), e os personagens têm avt_x/avt_y salvos (o
// spawn prioriza posição salva) e Mana/ManaMax já corretos (sem PATCH de seed).

export const RPG_ID = 'rpg-sim';

// Grid 24×16: borda de parede (0), interior todo piso (1).
export function makeTiles(w = 24, h = 16): number[][] {
  const tiles: number[][] = [];
  for (let y = 0; y < h; y++) {
    const row: number[] = [];
    for (let x = 0; x < w; x++) {
      row.push(x === 0 || y === 0 || x === w - 1 || y === h - 1 ? 0 : 1);
    }
    tiles.push(row);
  }
  return tiles;
}

const ATTRS_GUERREIRO = { 'Força': 14, 'Destreza': 10, 'Constituição': 15, 'Inteligência': 8, 'Sabedoria': 8 };
const ATTRS_MAGO      = { 'Força': 8,  'Destreza': 12, 'Constituição': 8,  'Inteligência': 15, 'Sabedoria': 14 };

// NPCs longe do spawn dos jogadores (3,3)/(5,3): deteccaoRaio 3 não agride
// ninguém até o bot se aproximar.
export function makeInimigosJson() {
  return [
    {
      id: 'ini_0', nome: 'Goblin Sim', x: 10, y: 3, hp: 160, cor: '#7a5c00',
      isBoss: false, pacienciaSecs: 5, deteccaoRaio: 3, xpBase: 10,
      aparencia_tipo: 'npc_generico', topdown_ia: null,
      tipoClasse: 'guerreiro', alcance_celulas: 2,
      atributos_base: { ...ATTRS_GUERREIRO },
      respawnDelay: 60, respawnTipo: 'timer',
    },
    {
      id: 'ini_1', nome: 'Ogro Sim', x: 18, y: 10, hp: 160, cor: '#8a3c00',
      isBoss: false, pacienciaSecs: 5, deteccaoRaio: 3, xpBase: 10,
      aparencia_tipo: 'npc_generico', topdown_ia: null,
      tipoClasse: 'guerreiro', alcance_celulas: 2,
      atributos_base: { ...ATTRS_GUERREIRO },
      respawnDelay: 60, respawnTipo: 'timer',
    },
  ];
}

export function makeDungeonData() {
  return {
    w: 24, h: 16,
    tiles: makeTiles(),
    rooms: [
      { x: 1, y: 1, w: 10, h: 10, cx: 3, cy: 3 },
      { x: 13, y: 5, w: 9, h: 9, cx: 17, cy: 9 },
    ],
    npc_level: 1,
    _faseId: 'principal',
    _inimigosJson: makeInimigosJson(),
    render_data: { objetos: [] },
  };
}

export function makeRpgRegistryRow() {
  return {
    rpg_id: RPG_ID,
    name: 'Dungeon Sim',
    owner_id: 'uid-mestre-ausente', // ninguém do teste é mestre
    theme_json: {
      is_aventura: true,
      level_config: {},
      dungeon_data: makeDungeonData(),
    },
  };
}

export function makeCharsRows() {
  return [
    {
      id: 'char-alice', rpg_id: RPG_ID, nome: 'Alice',
      hp_atual: null, hp_max: null, nivel: 1, xp: 0, pontos_attr: 0,
      custom_attrs: {
        classe_aventura: 'guerreiro', cor: '#4fa3d1',
        avt_x: 3, avt_y: 3,
        skills_ids: [101, 102, 103],
        atributos: { ...ATTRS_GUERREIRO, Mana: 10, ManaMax: 10 },
      },
    },
    {
      id: 'char-bob', rpg_id: RPG_ID, nome: 'Bob',
      hp_atual: null, hp_max: null, nivel: 1, xp: 0, pontos_attr: 0,
      custom_attrs: {
        classe_aventura: 'mago', cor: '#7b2fbe',
        avt_x: 5, avt_y: 3,
        skills_ids: [],
        // Sabedoria 14 → ManaMax = round(10 × (1 + 4×10%)) = 14 (sem PATCH de seed)
        atributos: { ...ATTRS_MAGO, Mana: 14, ManaMax: 14 },
      },
    },
  ];
}

export function makeSkillsRows() {
  return [
    {
      id: 101, rpg_id: RPG_ID, personagem: 'Alice', character_id: 'char-alice',
      habilidade: 'Bola de Fogo', efeito: 'Projétil flamejante',
      formula_dano: '2d6+3', custo_rsv: '2 Mana', cooldown_turnos: 0,
      tipo_dano: 'magico', alcance_celulas: 4, atributo_base: 'Inteligência',
      alvo_tipo: 'inimigo', efeitos_bonus: [],
      critico_positivo: null, critico_negativo: null,
      // string JSON de propósito — exercita o parse do loader (aventura.js:4019)
      animacao: '{"tipo":"projetil","cor":"#e8604c"}',
    },
    {
      id: 102, rpg_id: RPG_ID, personagem: 'Alice', character_id: 'char-alice',
      habilidade: 'Marca Ardente', efeito: 'Aplica queimadura',
      formula_dano: '1d4', custo_rsv: null, cooldown_turnos: 0,
      tipo_dano: 'fogo', alcance_celulas: 3, atributo_base: 'Inteligência',
      alvo_tipo: 'inimigo',
      // string JSON — exercita parse + normalização via EFFECT_REGISTRY
      efeitos_bonus: '[{"nome":"Queimadura","dot_formula":"1d4","dot_turnos":2}]',
      critico_positivo: null, critico_negativo: null,
      animacao: null,
    },
    {
      id: 103, rpg_id: RPG_ID, personagem: 'Alice', character_id: 'char-alice',
      habilidade: 'Armadilha de Caça', efeito: 'Arma uma armadilha na célula alvo',
      formula_dano: null, custo_rsv: '1 Mana', cooldown_turnos: 2,
      tipo_dano: 'fisico', alcance_celulas: 3, atributo_base: null,
      alvo_tipo: 'inimigo',
      efeitos_bonus: [{ tipo: 'armadilha', armadilha_formula: '1d6', duracao_turnos: 5, armadilha_max: 2, armadilha_cor: '#e8604c' }],
      critico_positivo: null, critico_negativo: null,
      animacao: null,
    },
  ];
}

export function makeItemCatalogRows() {
  return [
    { id: 'it-pocao', rpg_id: RPG_ID, nome: 'Poção de Vida', tipo: 'consumivel', icone: '🧪', raridade: 'comum',
      descricao: 'Recupera 20 HP', efeitos: [{ tipo: 'hp', valor: 20 }], valor_base: 30,
      slot_padrao: null, atributos_bonus: null, img_url: null, droppable: false, drop_rate: 0, visual_config: null },
    { id: 'it-espada', rpg_id: RPG_ID, nome: 'Espada Curta', tipo: 'equipamento', icone: '🗡', raridade: 'incomum',
      descricao: null, efeitos: null, valor_base: 100, slot_padrao: 'arma_principal',
      atributos_bonus: { 'Força': 2 }, img_url: null, droppable: false, drop_rate: 0, visual_config: null },
    // Sem valor_base de propósito — exercita "⚠ sem preço" (compra) e "sem cotação" (venda)
    { id: 'it-relicario', rpg_id: RPG_ID, nome: 'Relicário Antigo', tipo: 'misc', icone: '🧿', raridade: 'raro',
      descricao: null, efeitos: null, valor_base: null, slot_padrao: null,
      atributos_bonus: null, img_url: null, droppable: false, drop_rate: 0, visual_config: null },
  ];
}

export function makeAttrDefsRows() {
  return [
    { id: 1, rpg_id: RPG_ID, nome: 'Força', tipo: 'number', opcoes: null, ordem: 1, categoria: 'basico' },
    { id: 2, rpg_id: RPG_ID, nome: 'Constituição', tipo: 'number', opcoes: null, ordem: 2, categoria: 'basico' },
    { id: 3, rpg_id: RPG_ID, nome: 'Inteligência', tipo: 'number', opcoes: null, ordem: 3, categoria: 'basico' },
  ];
}

// Rotas para stubFetchRotas (Vitest). Ordem importa: primeira que casa responde.
// Rotas não listadas caem no default 200 [] do stub — deixa PATCHes de seed,
// batalhas, inventário etc. inertes.
export function rotasAventura() {
  return [
    { match: `/rest/v1/rpg_registry?rpg_id=eq.${RPG_ID}`, resposta: [makeRpgRegistryRow()] },
    { match: `/rest/v1/characters?rpg_id=eq.${RPG_ID}`, resposta: makeCharsRows() },
    { match: `/rest/v1/skills?rpg_id=eq.${RPG_ID}`, resposta: makeSkillsRows() },
    { match: `/rest/v1/item_catalog`, resposta: makeItemCatalogRows() },
    { match: `/rest/v1/attr_defs?rpg_id=eq.${RPG_ID}`, resposta: makeAttrDefsRows() },
  ];
}
