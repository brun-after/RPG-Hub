// ═══════════════════════════════════════════════════════════════════════════
// EFFECT REGISTRY — fonte única de verdade dos tipos de efeito de skill.
//
// Cada tipo de efeito do sistema é registrado aqui com:
//  - detect(ef): reconhece o efeito num objeto efeitos_bonus autorado no editor
//    (skConfirmarEfeito em combat.js), que pode combinar vários efeitos num só
//    objeto e nem sempre define `tipo`;
//  - duracaoDe(ef): campo de duração próprio de cada efeito (dot_turnos,
//    boost_dano_turnos, …) — o runtime só entende `duracao_turnos`;
//  - isStatus: entra em status_effects com duração (vs. efeitos instantâneos
//    como cura/empurrão, tratados caso a caso nos fluxos de skill);
//  - positivo: aplicável a usuário/aliados (true) ou alvo/inimigos (false);
//  - orbEligible + defaults: alimenta o Orbe de Efeito (drop/spawn dinâmico).
//    Todo tipo novo registrado com orbEligible:true entra AUTOMATICAMENTE no
//    pool do orbe e no editor de config (a config salva é mesclada sobre os
//    defaults daqui).
//
// Consumidores: aventura.js (normalização de skills, loops de aplicação, tick,
// orbe de efeito, editor de config) e futuramente combat.js/skills.js.
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const TYPES = [
    // ── Negativos / alvo (não elegíveis para orbe) ───────────────────────────
    {
      id: 'dot', label: 'Dano por turno (DOT)', icone: '🔥', cor: '#c0392b',
      isStatus: true, positivo: false, orbEligible: false,
      detect: (ef: any) => !!ef.dot_formula,
      duracaoDe: (ef: any) => ef.dot_turnos,
      campos: ['dot_formula', 'dot_turnos', 'dot_variante'],
    },
    {
      id: 'stun', label: 'Atordoar', icone: '🌀', cor: '#9b59b6',
      isStatus: true, positivo: false, orbEligible: false,
      detect: (ef: any) => ef.tipo === 'stun',
      duracaoDe: (ef: any) => ef.duracao_turnos,
      campos: [],
    },
    {
      id: 'silence', label: 'Silenciar', icone: '🤐', cor: '#1a0028',
      isStatus: true, positivo: false, orbEligible: false,
      detect: (ef: any) => ef.tipo === 'silence',
      duracaoDe: (ef: any) => ef.duracao_turnos,
      campos: [],
    },
    {
      id: 'sem_movimento', label: 'Sem movimento', icone: '🦶', cor: '#c0392b',
      isStatus: true, positivo: false, orbEligible: false,
      detect: (ef: any) => !!ef.sem_movimento,
      duracaoDe: (ef: any) => ef.sem_movimento_turnos,
      campos: ['sem_movimento', 'sem_movimento_turnos'],
    },
    {
      id: 'sem_ataque', label: 'Sem ataque', icone: '🚫', cor: '#e67e22',
      isStatus: true, positivo: false, orbEligible: false,
      detect: (ef: any) => !!ef.sem_ataque,
      duracaoDe: (ef: any) => ef.sem_ataque_turnos,
      campos: ['sem_ataque', 'sem_ataque_tipo', 'sem_ataque_turnos'],
    },
    {
      id: 'mod_dano', label: 'Modificar dano causado', icone: '⚔', cor: '#e8604c',
      isStatus: true, positivo: false, orbEligible: false,
      detect: (ef: any) => ef.mod_dano != null && ef.mod_dano !== 0,
      duracaoDe: (ef: any) => ef.mod_dano_turnos,
      campos: ['mod_dano', 'mod_dano_turnos'],
    },

    // ── Positivos / usuário (candidatos a orbe) ──────────────────────────────
    {
      id: 'hot', label: 'Regeneração (HOT)', icone: '💚', cor: '#2ecc71',
      isStatus: true, positivo: true,
      detect: (ef: any) => !!ef.hot_formula,
      duracaoDe: (ef: any) => ef.hot_turnos,
      campos: ['hot_formula', 'hot_turnos'],
      orbEligible: true, defaultWeight: 20, defaultModo: 'tempo', defaultDuracaoTurnos: 3, defaultCargas: 3,
      buildEfeito: () => ({ tipo: 'hot', hot_formula: '1d6' }),
    },
    {
      id: 'boost_dano', label: 'Bônus de dano', icone: '💥', cor: '#f0cc6a',
      isStatus: true, positivo: true,
      detect: (ef: any) => ef.boost_dano != null && ef.boost_dano !== 0,
      duracaoDe: (ef: any) => ef.boost_dano_turnos,
      campos: ['boost_dano', 'boost_dano_turnos'],
      orbEligible: true, defaultWeight: 18, defaultModo: 'cargas', defaultDuracaoTurnos: 3, defaultCargas: 3,
      buildEfeito: () => ({ tipo: 'boost_dano', boost_dano: 5 }),
    },
    {
      id: 'rec_atributo', label: 'Recuperar recurso por turno', icone: '🔋', cor: '#b07ef0',
      isStatus: true, positivo: true,
      detect: (ef: any) => !!ef.rec_atributo || (!!ef.rec_formula && ef.tipo == null),
      duracaoDe: (ef: any) => ef.rec_turnos,
      campos: ['rec_atributo', 'rec_formula', 'rec_modo', 'rec_turnos'],
      orbEligible: true, defaultWeight: 8, defaultModo: 'tempo', defaultDuracaoTurnos: 3, defaultCargas: 3,
      // rec_atributo vazio = primeiro recurso do personagem (resolvido na aplicação)
      buildEfeito: () => ({ tipo: 'rec_atributo', rec_atributo: '', rec_formula: '5', rec_modo: 'abs' }),
    },
    {
      id: 'imune_dano', label: 'Imunidade a dano', icone: '🛡', cor: '#74b9ff',
      isStatus: true, positivo: true,
      detect: (ef: any) => !!ef.imune_dano,
      duracaoDe: (ef: any) => ef.imune_dano_turnos,
      campos: ['imune_dano', 'imune_dano_turnos'],
      orbEligible: true, defaultWeight: 4, defaultModo: 'tempo', defaultDuracaoTurnos: 1, defaultCargas: 1,
      buildEfeito: () => ({ tipo: 'imune_dano', imune_dano: true }),
    },
    {
      id: 'fantasma', label: 'Fantasma (intangível)', icone: '👻', cor: '#74b9ff',
      isStatus: true, positivo: true,
      detect: (ef: any) => ef.tipo === 'fantasma',
      duracaoDe: (ef: any) => ef.duracao_turnos,
      campos: [] as any[],
      orbEligible: true, defaultWeight: 2, defaultModo: 'tempo', defaultDuracaoTurnos: 2, defaultCargas: 1,
      buildEfeito: () => ({ tipo: 'fantasma' }),
    },
    {
      id: 'atravessar', label: 'Atravessar paredes', icone: '🚪', cor: '#3498db',
      isStatus: true, positivo: true,
      detect: (ef: any) => ef.tipo === 'atravessar',
      duracaoDe: (ef: any) => ef.duracao_turnos,
      campos: [],
      orbEligible: true, defaultWeight: 2, defaultModo: 'tempo', defaultDuracaoTurnos: 2, defaultCargas: 1,
      buildEfeito: () => ({ tipo: 'atravessar' }),
    },
    {
      id: 'ab_cd_reduzir', label: 'Ataque básico: recarga menor', icone: '⚡', cor: '#f39c12',
      isStatus: true, positivo: true,
      detect: (ef: any) => ef.tipo === 'ab_cd_reduzir',
      duracaoDe: (ef: any) => ef.duracao_turnos,
      campos: ['ab_cd_ooc_ms', 'ab_ataques_extra'],
      orbEligible: true, defaultWeight: 10, defaultModo: 'tempo', defaultDuracaoTurnos: 4, defaultCargas: 3,
      buildEfeito: () => ({ tipo: 'ab_cd_reduzir', alvo: 'usuario', ab_cd_ooc_ms: 350, ab_ataques_extra: 1 }),
    },
    {
      id: 'ab_dano_buff', label: 'Ataque básico: dano extra', icone: '🗡', cor: '#f0cc6a',
      isStatus: true, positivo: true,
      detect: (ef: any) => ef.tipo === 'ab_dano_buff',
      duracaoDe: (ef: any) => ef.duracao_turnos,
      campos: ['ab_dano_formula'],
      orbEligible: true, defaultWeight: 14, defaultModo: 'tempo', defaultDuracaoTurnos: 4, defaultCargas: 3,
      buildEfeito: () => ({ tipo: 'ab_dano_buff', alvo: 'usuario', ab_dano_formula: '1d6' }),
    },
    {
      id: 'ab_multi_alvo', label: 'Ataque básico: alvos extras', icone: '🎯', cor: '#e67e22',
      isStatus: true, positivo: true,
      detect: (ef: any) => ef.tipo === 'ab_multi_alvo',
      duracaoDe: (ef: any) => ef.duracao_turnos,
      campos: ['ab_multi_extra'],
      orbEligible: true, defaultWeight: 6, defaultModo: 'cargas', defaultDuracaoTurnos: 3, defaultCargas: 2,
      buildEfeito: () => ({ tipo: 'ab_multi_alvo', alvo: 'usuario', ab_multi_extra: 1 }),
    },
    {
      id: 'ab_alcance_buff', label: 'Ataque básico: alcance maior', icone: '🏹', cor: '#27ae60',
      isStatus: true, positivo: true,
      detect: (ef: any) => ef.tipo === 'ab_alcance_buff',
      duracaoDe: (ef: any) => ef.duracao_turnos,
      campos: ['ab_alcance_bonus'],
      orbEligible: true, defaultWeight: 8, defaultModo: 'tempo', defaultDuracaoTurnos: 4, defaultCargas: 3,
      buildEfeito: () => ({ tipo: 'ab_alcance_buff', alvo: 'usuario', ab_alcance_bonus: 1 }),
    },

    // ── Especiais (fluxo próprio nos handlers de skill — nunca genéricos) ────
    {
      id: 'cura', label: 'Cura imediata', icone: '✨', cor: '#27ae60',
      isStatus: false, positivo: true, orbEligible: false,
      detect: (ef: any) => ef.tipo === 'cura',
      duracaoDe: () => 0, campos: ['cura_formula'],
    },
    {
      id: 'teleporte', label: 'Teleporte', icone: '🌀', cor: '#a29bfe',
      isStatus: false, positivo: true, orbEligible: false,
      detect: (ef: any) => ef.tipo === 'teleporte',
      duracaoDe: (ef: any) => ef.duracao_turnos, campos: [],
    },
    {
      id: 'mover_usuario', label: 'Mover usuário (dash)', icone: '💨', cor: '#a29bfe',
      isStatus: false, positivo: true, orbEligible: false,
      detect: (ef: any) => ef.tipo === 'mover_usuario',
      duracaoDe: () => 0, campos: ['mover_destino', 'mover_distancia'],
    },
    {
      id: 'empurrao', label: 'Empurrão / Puxão', icone: '🌪', cor: '#e67e22',
      isStatus: false, positivo: false, orbEligible: false,
      detect: (ef: any) => ef.tipo === 'empurrao',
      duracaoDe: () => 0, campos: ['empurrao_direcao', 'empurrao_distancia'],
    },
    {
      id: 'efeito_atrasado', label: 'Efeito atrasado', icone: '⏳', cor: '#e8b04c',
      isStatus: false, positivo: false, orbEligible: false,
      detect: (ef: any) => !!ef.efeito_atrasado,
      duracaoDe: (ef: any) => ef.delay_turnos,
      campos: ['efeito_atrasado', 'delay_turnos', 'alcance_celulas', 'tipo_efeito_atrasado',
               'formula_dano', 'tipo_dano', 'stun_turnos', 'formula_cura',
               'efeito_bonus_atrasado', 'movimento_atrasado', 'atributo_atrasado'],
    },
    {
      id: 'necromante', label: 'Necromante (dominar ao matar)', icone: '☠', cor: '#8e44ad',
      isStatus: true, positivo: false, orbEligible: false,
      detect: (ef: any) => ef.tipo === 'necromante',
      duracaoDe: (ef: any) => ef.duracao_turnos, campos: ['cor_dominado'],
    },
    {
      id: 'rastro_persona', label: 'Rastro Persona', icone: '🐾', cor: '#5ee09a',
      isStatus: false, positivo: true, orbEligible: false,
      detect: (ef: any) => ef.tipo === 'rastro_persona',
      duracaoDe: (ef: any) => ef.duracao_turnos, campos: ['rastro_formula', 'rastro_cor'],
    },
    {
      id: 'rastro_anima', label: 'Rastro Anima', icone: '☄', cor: '#5ee09a',
      isStatus: false, positivo: true, orbEligible: false,
      detect: (ef: any) => ef.tipo === 'rastro_anima',
      duracaoDe: (ef: any) => ef.duracao_turnos, campos: ['rastro_formula', 'rastro_cor'],
    },
    {
      id: 'invocar_catalogo', label: 'Invocação do catálogo', icone: '🐺', cor: '#b07ef0',
      isStatus: false, positivo: true, orbEligible: false,
      detect: (ef: any) => ef.tipo === 'invocar_catalogo',
      duracaoDe: (ef: any) => ef.invocar_duracao_turnos,
      campos: ['invocar_ids', 'invocar_modo', 'invocar_qtd', 'invocar_duracao_modo', 'invocar_duracao_turnos'],
    },
  ];

  const byId: Record<string, any> = {};
  TYPES.forEach(t => { byId[t.id] = t; });

  // Divide um efeito autorado (que pode combinar vários componentes marcados no
  // editor) em entradas canônicas: uma por componente, cada uma com `tipo` e
  // `duracao_turnos` definidos — o formato que os loops de aplicação e o tick
  // (_avtProcessarStatusEffects) entendem. Campos comuns (nome, alvo, cor,
  // animacao_persistente) são preservados; a animação persistente fica só na
  // primeira entrada para não duplicar visuais.
  function normalizarEfeito(ef: any) {
    if (!ef || typeof ef !== 'object') return [];
    if (ef._canonico) return [ef];
    const detectados = TYPES.filter(t => { try { return t.detect(ef); } catch (_) { return false; } });
    if (!detectados.length) return [ef]; // desconhecido: passa adiante intacto
    const base = { ...ef };
    const saida = detectados.map((t, i) => {
      const entry = { ...base, tipo: t.id, _canonico: true };
      const dur = t.duracaoDe(ef);
      if (dur != null && !isNaN(dur)) entry.duracao_turnos = dur;
      else if (entry.duracao_turnos == null) entry.duracao_turnos = ef.duracao_turnos ?? 1;
      // Componentes de outros tipos saem desta entrada (evita double-detect a jusante)
      detectados.forEach(o => {
        if (o.id === t.id) return;
        (o.campos || []).forEach(c => { delete entry[c]; });
      });
      if (i > 0) delete entry.animacao_persistente;
      return entry;
    });
    return saida;
  }

  function normalizarEfeitos(efeitos: any) {
    if (!Array.isArray(efeitos)) return efeitos;
    const out: any = [];
    efeitos.forEach(ef => normalizarEfeito(ef).forEach(e => out.push(e)));
    return out;
  }

  window.EFFECT_REGISTRY = {
    types: TYPES,
    get: (id: any) => byId[id] || null,
    // Tipos que entram em status_effects, opcionalmente filtrados por polaridade.
    statusTipos: (opts: any = {}) => TYPES
      .filter(t => t.isStatus)
      .filter(t => opts.positivos == null || t.positivo === !!opts.positivos)
      .map(t => t.id),
    // Tipos elegíveis para o Orbe de Efeito (sempre positivos, com buildEfeito).
    orbEligible: () => TYPES.filter(t => t.orbEligible && typeof t.buildEfeito === 'function'),
    normalizarEfeito,
    normalizarEfeitos,
  };
})();
