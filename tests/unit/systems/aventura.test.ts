// Lógica pura do Modo Aventura (js/systems/aventura.js): PRNG determinístico,
// fórmula de HP, rasterização de trajetória, pathfinding e ocupação de célula.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../../js/systems/aventura.js';

const g = globalThis as any;

afterEach(() => {
  vi.useRealTimers();
});

describe('_avtSeededRng (PRNG por janela de 2s)', () => {
  it('mesmo NPC/ação/janela geram o mesmo valor em qualquer cliente', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const a = g._avtSeededRng('npc-1', 'patrulha');
    const b = g._avtSeededRng('npc-1', 'patrulha');
    expect(a).toBe(b);
  });

  it('janela de 2s seguinte gera valor diferente', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const antes = g._avtSeededRng('npc-1', 'patrulha');
    vi.setSystemTime(1_002_000);
    const depois = g._avtSeededRng('npc-1', 'patrulha');
    expect(depois).not.toBe(antes);
  });

  it('NPCs e ações diferentes divergem; valores ficam em [0,1)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const val1 = g._avtSeededRng('npc-1', 'patrulha');
    const val2 = g._avtSeededRng('npc-2', 'patrulha');
    const val3 = g._avtSeededRng('npc-1', 'perseguir');
    expect(val1).not.toBe(val2);
    expect(val1).not.toBe(val3);
    for (const v of [val1, val2, val3]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('_avtCalcHpJog (fórmula de HP do jogador)', () => {
  beforeEach(() => {
    g.AVT_STATE = { rpg: { theme_json: { level_config: {} } } };
  });

  it('defaults: hp_base 100 + Constituição × 4', () => {
    const ch = { custom_attrs: { atributos: { 'Constituição': 5 } } };
    expect(g._avtCalcHpJog(ch)).toBe(120);
  });

  it('lookup de atributo é insensível a acento e caixa (NFD)', () => {
    const ch = { custom_attrs: { atributos: { constituicao: 5 } } };
    expect(g._avtCalcHpJog(ch)).toBe(120);
  });

  it('usa level_config do mestre quando definido', () => {
    g.AVT_STATE.rpg.theme_json.level_config = { hp_base: 50, hp_attr: 'Vigor', hp_attr_mult: 2 };
    const ch = { custom_attrs: { atributos: { Vigor: 10, 'Constituição': 99 } } };
    expect(g._avtCalcHpJog(ch)).toBe(70);
  });

  it('hp_base_override por personagem substitui só a base', () => {
    g.AVT_STATE.rpg.theme_json.level_config = { hp_base: 100, hp_attr: 'Vigor', hp_attr_mult: 2 };
    const ch = { custom_attrs: { hp_base_override: '30', atributos: { Vigor: 5 } } };
    expect(g._avtCalcHpJog(ch)).toBe(40);
  });

  it('nunca retorna menos que 1', () => {
    g.AVT_STATE.rpg.theme_json.level_config = { hp_base: 0 };
    expect(g._avtCalcHpJog({ custom_attrs: { atributos: {} } })).toBe(1);
  });

  it('sem AVT_STATE ou personagem cai nos defaults sem quebrar', () => {
    g.AVT_STATE = undefined;
    expect(g._avtCalcHpJog(null)).toBe(100);
  });
});

describe('_avtRastroCelulasTrajetoria (Bresenham)', () => {
  it('linha horizontal inclui todas as células', () => {
    expect(g._avtRastroCelulasTrajetoria(0, 0, 3, 0)).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
    ]);
  });

  it('diagonal perfeita anda em passos diagonais', () => {
    expect(g._avtRastroCelulasTrajetoria(0, 0, 2, 2)).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 },
    ]);
  });

  it('mesmo ponto retorna uma célula; coordenadas fracionárias são arredondadas', () => {
    expect(g._avtRastroCelulasTrajetoria(2, 2, 2, 2)).toEqual([{ x: 2, y: 2 }]);
    expect(g._avtRastroCelulasTrajetoria(0.4, 0.4, 1.6, 0.4)).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
    ]);
  });
});

describe('_avtPathfindSimples (BFS em tiles)', () => {
  // Grid 5×5 com paredes configuráveis via stub do predicado global de tile.
  let bloqueadas: Set<string>;
  beforeEach(() => {
    bloqueadas = new Set();
    g.AVT_STATE = { dungeon: {} };
    g._avtTilePassavel = (x: number, y: number) =>
      x >= 0 && x < 5 && y >= 0 && y < 5 && !bloqueadas.has(`${x},${y}`);
  });

  it('início == destino retorna só a célula inicial', () => {
    expect(g._avtPathfindSimples(1, 1, 1, 1)).toEqual([{ x: 1, y: 1 }]);
  });

  it('caminho reto em grid aberto', () => {
    const path = g._avtPathfindSimples(0, 0, 2, 0);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 2, y: 0 });
    expect(path).toHaveLength(3);
  });

  it('parede força desvio', () => {
    bloqueadas.add('1,0');
    const path = g._avtPathfindSimples(0, 0, 2, 0);
    expect(path[path.length - 1]).toEqual({ x: 2, y: 0 });
    expect(path.length).toBe(5); // desce, contorna, sobe
    expect(path).not.toContainEqual({ x: 1, y: 0 });
  });

  it('destino inalcançável: fica no lugar', () => {
    for (const c of ['1,0', '0,1', '1,1']) bloqueadas.add(c);
    expect(g._avtPathfindSimples(0, 0, 4, 4)).toEqual([{ x: 0, y: 0 }]);
  });
});

describe('_avtCelulaOcupada', () => {
  const ent = (over: any = {}) => ({
    id: 'e1', nome: 'X', tipo: 'jogador', x: 3, y: 3, ...over,
  });

  beforeEach(() => {
    g.AVT_STATE = { entidades: [], colisaoJogJog: false, colisaoJogNpc: true };
  });

  it('ignora a própria entidade e células diferentes', () => {
    g.AVT_STATE.entidades = [ent()];
    expect(g._avtCelulaOcupada(3, 3, 'e1', 'jogador', false)).toBe(false);
    expect(g._avtCelulaOcupada(4, 3, 'e2', 'jogador', false)).toBe(false);
  });

  it('jogador × jogador respeita a config colisaoJogJog', () => {
    g.AVT_STATE.entidades = [ent()];
    expect(g._avtCelulaOcupada(3, 3, 'e2', 'jogador', false)).toBe(false);
    g.AVT_STATE.colisaoJogJog = true;
    expect(g._avtCelulaOcupada(3, 3, 'e2', 'jogador', false)).toBe(true);
  });

  it('jogador × NPC respeita colisaoJogNpc; NPC × NPC sempre bloqueia', () => {
    g.AVT_STATE.entidades = [ent({ tipo: 'inimigo' })];
    expect(g._avtCelulaOcupada(3, 3, 'e2', 'jogador', false)).toBe(true);
    g.AVT_STATE.colisaoJogNpc = false;
    expect(g._avtCelulaOcupada(3, 3, 'e2', 'jogador', false)).toBe(false);
    expect(g._avtCelulaOcupada(3, 3, 'e2', 'inimigo', false)).toBe(true);
  });

  it('fantasma não bloqueia fora de combate, mas bloqueia em combate', () => {
    g.AVT_STATE.colisaoJogJog = true;
    g.AVT_STATE.entidades = [ent({ _fantasma: true })];
    expect(g._avtCelulaOcupada(3, 3, 'e2', 'jogador', false)).toBe(false);
    expect(g._avtCelulaOcupada(3, 3, 'e2', 'jogador', true)).toBe(true);
  });

  it('avatar sempre bloqueia; escondido nunca bloqueia', () => {
    g.AVT_STATE.entidades = [ent({ tipo: 'avatar' })];
    expect(g._avtCelulaOcupada(3, 3, 'e2', 'jogador', false)).toBe(true);
    g.AVT_STATE.entidades = [ent({ tipo: 'avatar', escondido: true })];
    expect(g._avtCelulaOcupada(3, 3, 'e2', 'jogador', false)).toBe(false);
  });
});

describe('_avtSfxVolDist (ganho de design + atenuação por distância)', () => {
  beforeEach(() => {
    g.AVT_STATE = { entidades: [], myCharNome: null, isMestre: false, camera: null, canvas: null };
    g.AudioManager = { volume: { sfx: 1 } };
  });

  it('aplica -25% do modo aventura sobre o ganho de design', () => {
    expect(g._avtSfxVolDist(0.8, null)).toBeCloseTo(0.8 * 0.75);
  });

  it('não pré-multiplica o volume global do slider (playSFX já o aplica)', () => {
    g.AudioManager.volume.sfx = 0.5;
    expect(g._avtSfxVolDist(0.8, null)).toBeCloseTo(0.8 * 0.75);
  });

  it('atenua linearmente pela distância do ouvinte até silenciar a 20 células', () => {
    g.AVT_STATE.myCharNome = 'Heroi';
    g.AVT_STATE.entidades = [{ nome: 'Heroi', tipo: 'jogador', x: 0, y: 0, hp: 10 }];
    expect(g._avtSfxVolDist(0.8, { x: 10, y: 0 })).toBeCloseTo(0.8 * 0.75 * 0.5);
    expect(g._avtSfxVolDist(0.8, { x: 25, y: 0 })).toBe(0);
  });
});

describe('_avtMpAba (roteamento do painel do mestre no contexto do menu)', () => {
  beforeEach(() => {
    g.AVT_STATE = { mestrePainelAba: 'menu', entidades: [], membros: [], batalhas: [] };
    g.AVT_MENU_STATE = { configAba: 'menu', _configAberta: false };
  });

  it('no menu pré-jogo redireciona para o renderer do painel de config', () => {
    g._avtEmMenuConfig = () => true;
    g._avtMenuAbrirConfigMestre = vi.fn();
    g._avtMpAba('itens');
    expect(g._avtMenuAbrirConfigMestre).toHaveBeenCalledWith('itens');
    // não vaza a aba para o estado do painel in-game
    expect(g.AVT_STATE.mestrePainelAba).toBe('menu');
  });

  it('fora do menu mantém o fluxo in-game (troca a aba e re-renderiza)', () => {
    g._avtEmMenuConfig = () => false;
    g._avtMenuAbrirConfigMestre = vi.fn();
    g._avtMpAba('npcs');
    expect(g.AVT_STATE.mestrePainelAba).toBe('npcs');
    expect(g._avtMenuAbrirConfigMestre).not.toHaveBeenCalled();
  });
});
