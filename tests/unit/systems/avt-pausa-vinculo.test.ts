// Pausa in-game (percepção de inimigos congelada/retomada) e ciclo de vida de
// personagens em uso (gate de spawn por vínculo, saída explícita, presença).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../../js/systems/aventura.js';

const g = globalThis as any;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── Fix câmera: limpeza do clone de transição de fase ───────────────────────

describe('_avtLimparEstadoMovimentoClone', () => {
  it('remove estado de movimento E o par callback/tag do waypoint', () => {
    const clone: any = {
      nome: 'Heroi', x: 3, y: 4,
      _waypoints: [{ x: 1, y: 1 }], _pendingInputs: [{}], _lerpTo: {},
      renderX: 3.5, renderY: 4.5,
      _wpCallbackOwner: 'local-path', _onWaypointReached: undefined, // JSON round-trip: função caiu, tag ficou
    };
    g._avtLimparEstadoMovimentoClone(clone);
    for (const k of ['_waypoints', '_pendingInputs', '_lerpTo', 'renderX', 'renderY', '_wpCallbackOwner', '_onWaypointReached']) {
      expect(k in clone, k).toBe(false);
    }
    expect(clone.nome).toBe('Heroi');
    expect(clone.x).toBe(3);
  });

  it('tolera null/undefined', () => {
    expect(g._avtLimparEstadoMovimentoClone(null)).toBeNull();
  });
});

// ─── Pausa: aquisição e congelamento de perseguição ──────────────────────────

function estadoBase(over: any = {}) {
  g.AVT_STATE = {
    rpgId: 'rpg-1',
    rpg: { theme_json: { level_config: {} } },
    entidades: [],
    npcTimers: {},
    batalhas: [],
    chars: [],
    membros: [],
    myCharNome: null,
    npcControlando: null,
    _jogoAutoSuspenso: false,
    _menuJogadorAberto: false,
    _inimigosIgnorados: [],
    npcSyncEnabled: false,
    colisaoJogJog: false,
    colisaoJogNpc: false,
    ...over,
  };
  g.mostrarToast = () => {};
}

describe('_avtCheckProximidadeInimigos (aquisição × pausa/escondido)', () => {
  beforeEach(() => estadoBase());

  it('jogador pausado no raio é tratado como fora do raio (não arma paciência)', () => {
    const jog = { id: 'j1', nome: 'Heroi', tipo: 'jogador', x: 5, y: 5, hp: 10, _pausado: true };
    const ini = { id: 'n1', nome: 'Orc', tipo: 'inimigo', x: 6, y: 5, hp: 10, deteccaoRaio: 3 };
    g.AVT_STATE.entidades = [jog, ini];
    g._avtCheckProximidadeInimigos(jog);
    expect(g.AVT_STATE.npcTimers['n1']?.ativo).toBe(false);
    expect(g.AVT_STATE.npcTimers['n1']?.targetId ?? null).toBeNull();
  });

  it('jogador escondido não é sequer avaliado', () => {
    const jog = { id: 'j1', nome: 'Heroi', tipo: 'jogador', x: 5, y: 5, hp: 10, escondido: true };
    const ini = { id: 'n1', nome: 'Orc', tipo: 'inimigo', x: 6, y: 5, hp: 10, deteccaoRaio: 3 };
    g.AVT_STATE.entidades = [jog, ini];
    g._avtCheckProximidadeInimigos(jog);
    expect(g.AVT_STATE.npcTimers['n1']).toBeUndefined();
  });

  it('sem pausa, jogador no raio arma paciência normalmente', () => {
    const jog = { id: 'j1', nome: 'Heroi', tipo: 'jogador', x: 5, y: 5, hp: 10 };
    const ini = { id: 'n1', nome: 'Orc', tipo: 'inimigo', x: 6, y: 5, hp: 10, deteccaoRaio: 3 };
    g.AVT_STATE.entidades = [jog, ini];
    g._avtCheckProximidadeInimigos(jog);
    expect(g.AVT_STATE.npcTimers['n1'].ativo).toBe(true);
    expect(g.AVT_STATE.npcTimers['n1'].targetId).toBe('j1');
  });
});

describe('_avtAtualizarPaciencias (alvo pausado congela; escondido desarma)', () => {
  beforeEach(() => estadoBase());

  it('alvo pausado: paciência não anda', () => {
    const jog = { id: 'j1', nome: 'Heroi', tipo: 'jogador', x: 5, y: 5, hp: 10, _pausado: true };
    const ini = { id: 'n1', nome: 'Orc', tipo: 'inimigo', x: 6, y: 5, hp: 10 };
    g.AVT_STATE.entidades = [jog, ini];
    g.AVT_STATE.npcTimers['n1'] = { ativo: true, isPursuing: false, targetId: 'j1', patience: 5000, maxPatience: 5000, _pacienciaRolada: true };
    g._avtAtualizarPaciencias(1000);
    expect(g.AVT_STATE.npcTimers['n1'].patience).toBe(5000);
    expect(g.AVT_STATE.npcTimers['n1'].ativo).toBe(true);
  });

  it('alvo escondido (saiu do jogo): timer desarma e re-rola na próxima aproximação', () => {
    const jog = { id: 'j1', nome: 'Heroi', tipo: 'jogador', x: 5, y: 5, hp: 10, escondido: true };
    const ini = { id: 'n1', nome: 'Orc', tipo: 'inimigo', x: 6, y: 5, hp: 10 };
    g.AVT_STATE.entidades = [jog, ini];
    g.AVT_STATE.npcTimers['n1'] = { ativo: true, isPursuing: false, targetId: 'j1', patience: 3000, maxPatience: 5000, _pacienciaRolada: true };
    g._avtAtualizarPaciencias(1000);
    const t = g.AVT_STATE.npcTimers['n1'];
    expect(t.ativo).toBe(false);
    expect(t.targetId).toBeNull();
    expect(t._pacienciaRolada).toBe(false);
    expect(t.patience).toBe(5000);
  });

  it('alvo normal: paciência decrementa', () => {
    const jog = { id: 'j1', nome: 'Heroi', tipo: 'jogador', x: 5, y: 5, hp: 10 };
    const ini = { id: 'n1', nome: 'Orc', tipo: 'inimigo', x: 6, y: 5, hp: 10 };
    g.AVT_STATE.entidades = [jog, ini];
    g.AVT_STATE.npcTimers['n1'] = { ativo: true, isPursuing: false, targetId: 'j1', patience: 5000, maxPatience: 5000, _pacienciaRolada: true };
    g._avtAtualizarPaciencias(1000);
    expect(g.AVT_STATE.npcTimers['n1'].patience).toBe(4000);
  });
});

describe('_avtIniciarPerseguicao (fallback de alvo ignora pausados/escondidos)', () => {
  beforeEach(() => estadoBase());

  it('único jogador pausado → perseguição inicia sem alvo', () => {
    const jog = { id: 'j1', nome: 'Heroi', tipo: 'jogador', x: 5, y: 5, hp: 10, _pausado: true };
    const ini = { id: 'n1', nome: 'Orc', tipo: 'inimigo', x: 6, y: 5, hp: 10 };
    g.AVT_STATE.entidades = [jog, ini];
    g.AVT_STATE.npcTimers['n1'] = { ativo: true, isPursuing: false, targetId: null, patience: 0, maxPatience: 5000 };
    g._avtIniciarPerseguicao('n1');
    expect(g.AVT_STATE.npcTimers['n1'].isPursuing).toBe(true);
    expect(g.AVT_STATE.npcTimers['n1'].targetId).toBeNull();
  });

  it('escolhe o jogador ativo mais próximo, pulando pausado e escondido', () => {
    const pausado   = { id: 'j1', nome: 'A', tipo: 'jogador', x: 6, y: 5, hp: 10, _pausado: true };
    const escondido = { id: 'j2', nome: 'B', tipo: 'jogador', x: 7, y: 5, hp: 10, escondido: true };
    const ativo     = { id: 'j3', nome: 'C', tipo: 'jogador', x: 9, y: 5, hp: 10 };
    const ini = { id: 'n1', nome: 'Orc', tipo: 'inimigo', x: 5, y: 5, hp: 10 };
    g.AVT_STATE.entidades = [pausado, escondido, ativo, ini];
    g.AVT_STATE.npcTimers['n1'] = { ativo: true, isPursuing: false, targetId: null, patience: 0, maxPatience: 5000 };
    g._avtIniciarPerseguicao('n1');
    expect(g.AVT_STATE.npcTimers['n1'].targetId).toBe('j3');
  });
});

describe('_avtAtualizarPerseguicoes (perseguição congela com alvo pausado e retoma)', () => {
  beforeEach(() => estadoBase());

  function armarPerseguicao() {
    const jog = { id: 'j1', nome: 'Heroi', tipo: 'jogador', x: 10, y: 5, hp: 10, _pausado: true };
    const ini = { id: 'n1', nome: 'Orc', tipo: 'inimigo', x: 5, y: 5, hp: 10 };
    g.AVT_STATE.entidades = [jog, ini];
    g.AVT_STATE.npcTimers['n1'] = {
      ativo: false, isPursuing: true, targetId: 'j1',
      patience: 0, maxPatience: 5000,
      inactionTimer: 0, pursuitStepTimer: 60000, attackCooldownTimer: 0, desistirCheckTimer: 0,
      _pathFailCount: 0,
    };
    return { jog, ini };
  }

  it('alvo pausado: nada anda — nem posição, nem inação, nem desistência', () => {
    const { ini } = armarPerseguicao();
    g._avtAtualizarPerseguicoes(200);
    const t = g.AVT_STATE.npcTimers['n1'];
    expect(t.isPursuing).toBe(true);
    expect(t.targetId).toBe('j1');
    expect(t.inactionTimer).toBe(0);
    expect(t.pursuitStepTimer).toBe(60000);
    expect(ini.x).toBe(5);
  });

  it('despausar retoma a MESMA perseguição de onde parou', () => {
    const { jog } = armarPerseguicao();
    g._avtAtualizarPerseguicoes(200);
    delete jog._pausado;
    g._avtAtualizarPerseguicoes(200);
    const t = g.AVT_STATE.npcTimers['n1'];
    expect(t.isPursuing).toBe(true);
    expect(t.targetId).toBe('j1');
    expect(t.inactionTimer).toBe(200);
    expect(t.pursuitStepTimer).toBe(59800);
  });

  it('alvo escondido (saiu do jogo) sem substituto: perseguição é cancelada', () => {
    const { jog } = armarPerseguicao();
    delete jog._pausado;
    jog.escondido = true;
    g._avtAtualizarPerseguicoes(200);
    const t = g.AVT_STATE.npcTimers['n1'];
    expect(t.isPursuing).toBe(false);
    expect(t.targetId).toBeNull();
  });
});

// ─── Vínculo: gate de spawn e spawn dinâmico ─────────────────────────────────

function estadoSpawn(over: any = {}) {
  estadoBase({
    dungeon: {
      w: 10, h: 10,
      rooms: [{ x: 1, y: 1, w: 3, h: 3, cx: 2, cy: 2 }],
      tiles: [[1]],
      _spawnJogadores: [{ x: 2, y: 2 }],
    },
    chars: [
      { id: 'c1', nome: 'Vinculado', custom_attrs: { atributos: { 'Força': 10, 'Constituição': 10 } } },
      { id: 'c2', nome: 'SemDono',   custom_attrs: { atributos: { 'Força': 10, 'Constituição': 10 } } },
      { id: 'c3', nome: 'Meu',       custom_attrs: { atributos: { 'Força': 10, 'Constituição': 10 } } },
    ],
    membros: [{ player_id: 'u1', linked: 'Vinculado' }],
    myCharNome: 'Meu',
    ...over,
  });
}

describe('_avtPopularEntidades (só personagens em uso)', () => {
  let origInimigos: any;
  beforeEach(() => {
    estadoSpawn();
    origInimigos = g._avtPopularEntidadesInimigos;
    g._avtPopularEntidadesInimigos = () => {};
  });
  afterEach(() => { g._avtPopularEntidadesInimigos = origInimigos; });

  it('com membros: spawna só o meu e os vinculados — sem dono fica fora', () => {
    g._avtPopularEntidades();
    const nomes = g.AVT_STATE.entidades.map((e: any) => e.nome).sort();
    expect(nomes).toEqual(['Meu', 'Vinculado']);
  });

  it('sem dados de membros: comportamento clássico (todos spawnam)', () => {
    g.AVT_STATE.membros = [];
    g._avtPopularEntidades();
    expect(g.AVT_STATE.entidades).toHaveLength(3);
  });

  it('vinculado offline nasce escondido; o meu nunca', () => {
    const origOnline = g._avtJogadorEstaOnline;
    g._avtJogadorEstaOnline = () => false;
    try {
      g._avtPopularEntidades();
      const vinc = g.AVT_STATE.entidades.find((e: any) => e.nome === 'Vinculado');
      const meu  = g.AVT_STATE.entidades.find((e: any) => e.nome === 'Meu');
      expect(vinc.escondido).toBe(true);
      expect(vinc._charOffline).toBe(true);
      expect(meu.escondido).toBeUndefined();
    } finally { g._avtJogadorEstaOnline = origOnline; }
  });
});

describe('_avtSpawnCharJogador (spawn dinâmico)', () => {
  beforeEach(() => estadoSpawn());

  it('cria a entidade uma única vez (idempotente)', () => {
    const a = g._avtSpawnCharJogador('SemDono');
    const b = g._avtSpawnCharJogador('SemDono');
    expect(a).toBeTruthy();
    expect(b).toBe(a);
    expect(g.AVT_STATE.entidades.filter((e: any) => e.nome === 'SemDono')).toHaveLength(1);
  });

  it('recusa personagem desconhecido e NPC', () => {
    expect(g._avtSpawnCharJogador('Fantasma')).toBeNull();
    g.AVT_STATE.chars.push({ id: 'c9', nome: 'Goblin', custom_attrs: { tipo_personagem: 'npc' } });
    expect(g._avtSpawnCharJogador('Goblin')).toBeNull();
  });

  it('honra posição salva (avt_x/avt_y)', () => {
    g.AVT_STATE.chars[1].custom_attrs.avt_x = 7;
    g.AVT_STATE.chars[1].custom_attrs.avt_y = 8;
    const ent = g._avtSpawnCharJogador('SemDono');
    expect(ent.x).toBe(7);
    expect(ent.y).toBe(8);
  });
});

describe('avtReceberMemberLinked (upsert + spawn/hide)', () => {
  beforeEach(() => {
    estadoSpawn();
    g.SESSION = { user: { id: 'eu' } };
  });

  it('vínculo novo de membro desconhecido: upsert + spawn do personagem', () => {
    g.avtReceberMemberLinked({ player_id: 'u2', linked: 'SemDono' });
    expect(g.AVT_STATE.membros.find((m: any) => m.player_id === 'u2')?.linked).toBe('SemDono');
    expect(g.AVT_STATE.entidades.find((e: any) => e.nome === 'SemDono')).toBeTruthy();
  });

  it('desvínculo esconde o personagem que ficou sem dono', () => {
    g.avtReceberMemberLinked({ player_id: 'u2', linked: 'SemDono' });
    g.avtReceberMemberLinked({ player_id: 'u2', linked: null });
    const ent = g.AVT_STATE.entidades.find((e: any) => e.nome === 'SemDono');
    expect(ent.escondido).toBe(true);
    expect(ent._charOffline).toBe(true);
  });

  it('re-vínculo limpa a marca de saída explícita', () => {
    const ent = g._avtSpawnCharJogador('SemDono');
    ent._charSaiu = true;
    g.avtReceberMemberLinked({ player_id: 'u2', linked: 'SemDono' });
    expect(ent._charSaiu).toBeUndefined();
  });
});

// ─── Saída explícita e presença ──────────────────────────────────────────────

describe('avtReceberCharSaiu + reconciliador de visibilidade', () => {
  beforeEach(() => {
    estadoSpawn();
    g.SESSION = { user: { id: 'eu' } };
  });

  it('personagem sai do jogo na hora (escondido + _charSaiu + heartbeat zerado)', () => {
    const ent = g._avtSpawnCharJogador('Vinculado');
    ent._lastGameSeen = Date.now();
    ent._pausado = true;
    g.avtReceberCharSaiu({ charNome: 'Vinculado' });
    expect(ent.escondido).toBe(true);
    expect(ent._charSaiu).toBe(true);
    expect(ent._lastGameSeen).toBe(0);
    expect(ent._pausado).toBeUndefined();
  });

  it('meu próprio personagem nunca é escondido por char_saiu', () => {
    const meu = g._avtSpawnCharJogador('Meu');
    g.avtReceberCharSaiu({ charNome: 'Meu' });
    expect(meu.escondido).toBeUndefined();
  });

  it('presença de CHAT fresca NÃO ressuscita quem saiu explicitamente', () => {
    const ent = g._avtSpawnCharJogador('Vinculado');
    g.avtReceberCharSaiu({ charNome: 'Vinculado' });
    const origOnline = g._avtJogadorEstaOnline;
    g._avtJogadorEstaOnline = () => true; // chat do jogador segue ativo no site
    try {
      g._avtAtualizarVisibilidadeOffline();
      expect(ent.escondido).toBe(true);
    } finally { g._avtJogadorEstaOnline = origOnline; }
  });
});

describe('_avtJogadorEstaOnline (fallback sem linha de membro)', () => {
  beforeEach(() => estadoSpawn({ membros: [] }));

  it('heartbeat de jogo fresco → online, mesmo sem membro conhecido', () => {
    g.AVT_STATE.entidades = [{ id: 'j1', nome: 'Ativo', tipo: 'jogador', _lastGameSeen: Date.now() - 1000 }];
    expect(g._avtJogadorEstaOnline('Ativo')).toBe(true);
  });

  it('heartbeat velho ou entidade ausente → offline', () => {
    g.AVT_STATE.entidades = [{ id: 'j1', nome: 'Sumido', tipo: 'jogador', _lastGameSeen: Date.now() - 300000 }];
    expect(g._avtJogadorEstaOnline('Sumido')).toBe(false);
    expect(g._avtJogadorEstaOnline('Inexistente')).toBe(false);
  });
});

// ─── Colisão: morto não bloqueia ─────────────────────────────────────────────

describe('_avtCelulaOcupada (jogador morto não bloqueia célula)', () => {
  beforeEach(() => {
    g.AVT_STATE = { entidades: [], colisaoJogJog: true, colisaoJogNpc: true };
  });

  it('jogador com hp<=0 não bloqueia; vivo bloqueia (com colisão ligada)', () => {
    g.AVT_STATE.entidades = [{ id: 'e1', nome: 'X', tipo: 'jogador', x: 3, y: 3, hp: 0 }];
    expect(g._avtCelulaOcupada(3, 3, 'e2', 'jogador', false)).toBe(false);
    expect(g._avtCelulaOcupada(3, 3, 'e2', 'inimigo', false)).toBe(false);
    g.AVT_STATE.entidades[0].hp = 5;
    expect(g._avtCelulaOcupada(3, 3, 'e2', 'jogador', false)).toBe(true);
  });
});
