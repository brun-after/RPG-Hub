// core/events.js
// RPG Hub — Permission helpers and battle-state utilities for event processing
// Note: HUB_EVENTS event bus is defined in config.js (lines 9-45)
// This file contains: temPermissao(), podeEditarPersonagem(), _estadoBatalhaJogador()

// ── PERMISSÕES — funções auxiliares ──────────────────────────
function temPermissao(chave) {
  if (RPG_DATA?.myRole === 'mestre') return true;
  const perm = RPG_DATA?.myPermissoes || {};
  const padrao = (PERMISSOES_CONFIG?.find(p => p.key === chave)?.padrao) ?? false;
  return perm[chave] !== undefined ? perm[chave] : padrao;
}

function podeEditarPersonagem(nomePersonagem) {
  if (RPG_DATA?.myRole === 'mestre') return true;
  return RPG_DATA?.linked === nomePersonagem;
}

// Retorna o estado de batalha do ponto de vista de um jogador:
// 'livre'       → mestre, ou em batalha ativa e é o turno do personagem
// 'fora_combate'→ jogador, sem batalha ativa
// 'outro_turno' → jogador, batalha ativa mas não é o turno dele
function _estadoBatalhaJogador(nomePersonagem) {
  // ── Arena mode: usar AR.iniciativa em vez de BATALHA_ATUAL_ID ──
  if (typeof AR !== 'undefined' && AR && AR.session) {
    if (AR.myRole === 'mestre') return 'livre';
    const ini = AR.iniciativa;
    if (!ini || !ini.ativa || ini.fase !== 'combate') return 'fora_combate';
    const atual = ini.ordem && ini.ordem[ini.ordemAtual];
    if (atual && atual.nome === nomePersonagem) return 'livre';
    return 'outro_turno';
  }
  // ── Campanha normal ───────────────────────────────────────────
  if (RPG_DATA?.myRole === 'mestre') return 'livre';
  // Procura em TODAS as batalhas ativas a que inclui este personagem.
  // Isso garante que o jogador responde à sua batalha mesmo que BATALHA_ATUAL_ID
  // esteja apontando para outra batalha (ex: mestre navegou para outro mapa).
  const bs = Object.values(MAPA_STATE.batalhas).find(b =>
    b.ativa && b.participantes?.some(p => p.nome === nomePersonagem)
  );
  if (!bs) return 'fora_combate';
  if (bs.fase === 'iniciativa' || bs.fase === 'empate') return 'outro_turno';
  if (bs.fase === 'combate' && !bs.pausada) {
    const atual = bs.participantes[bs.ordemAtual];
    if (atual && atual.nome === nomePersonagem) return 'livre';
    return 'outro_turno';
  }
  return 'fora_combate';
}

