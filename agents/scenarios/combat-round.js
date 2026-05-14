// scenarios/combat-round.js
// Simula rodadas completas de combate usando a API do Supabase
// Replica a lógica do app: iniciativa → turnos → ataques → efeitos

import { sb, setAuthToken, broadcast } from '../lib/supabase.js';
import { rolar, d20 } from '../lib/dice.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Criação da batalha ────────────────────────────────────────
export async function iniciarBatalha({ rpgId, mapaId, participantes, mestreToken, log }) {
  setAuthToken(mestreToken);
  const batalhaId = crypto.randomUUID
    ? crypto.randomUUID()
    : `batalha_${Date.now()}`;

  const t0 = Date.now();
  try {
    await sb('batalhas', {
      method: 'POST',
      body: JSON.stringify({
        id: batalhaId,
        rpg_id: rpgId,
        mapa_id: mapaId,
        mapa_nome: 'Cripta Maldita',
        ativa: true,
        pausada: false,
        turno_round: 0,
        fase: 'iniciativa',
        ordem_atual: 0,
        participantes: participantes.map(p => ({
          nome: p.nome,
          iniciativa: 0,
          faction: p.faction,
          hp_atual: p.hp,
          hp_max: p.hp_max,
          incapacitado: false,
          morto: false,
        })),
        iniciativas_roladas: {},
        empatados: [],
        dado_sel: 'd20',
        cooldowns: {},
        recursos_participantes: {},
      }),
    });
    log.metrica('criar_batalha', Date.now() - t0, true, null, { batalhaId });
    log.info(`⚔ Batalha criada: ${batalhaId}`);
    return batalhaId;
  } catch (e) {
    log.metrica('criar_batalha', Date.now() - t0, false, e);
    log.error(`Falha ao criar batalha: ${e.message}`);
    throw e;
  }
}

// ── Fase de iniciativa ────────────────────────────────────────
export async function faseIniciativa({ rpgId, batalhaId, participantes, sessoes, log }) {
  log.info('🎲 Fase de iniciativa — todos rolam...');
  const iniciativas = {};

  for (const p of participantes) {
    // Pet (Sombra) não rola — compartilha a vez do dono
    if (p.eh_pet) {
      log.info(`  Pet ${p.nome} não rola iniciativa (usa turno de ${p.pet_dono})`);

      // VERIFICAÇÃO BUG-02: pet NÃO deveria ter iniciativa própria
      const temIni = iniciativas[p.nome] != null;
      if (temIni) {
        log.bug('B02', `Pet ${p.nome} aparece com iniciativa própria — deveria compartilhar com ${p.pet_dono}`, 'moderado');
      }
      continue;
    }

    const roll = d20() + (p.mod_iniciativa || 0);
    iniciativas[p.nome] = roll;
    log.info(`  ${p.nome}: iniciativa ${roll}`);
    await sleep(50);
  }

  // Ordenar por iniciativa (decrescente)
  const ordem = participantes
    .filter(p => !p.eh_pet)
    .sort((a, b) => (iniciativas[b.nome] || 0) - (iniciativas[a.nome] || 0))
    .map(p => p.nome);

  // Verificar empates
  const contagens = {};
  for (const nome of ordem) contagens[iniciativas[nome]] = (contagens[iniciativas[nome]] || 0) + 1;
  const empatados = Object.entries(contagens).filter(([, c]) => c > 1).flatMap(([ini]) =>
    ordem.filter(n => iniciativas[n] == ini)
  );
  if (empatados.length) log.info(`⚠ Empate detectado entre: ${empatados.join(', ')}`);

  // Atualizar batalha para fase de combate
  const t0 = Date.now();
  const token = sessoes.mestre?.access_token;
  setAuthToken(token);
  try {
    await sb(`batalhas?id=eq.${batalhaId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fase: 'combate',
        ordem_atual: 0,
        turno_round: 1,
        iniciativas_roladas: iniciativas,
        participantes: participantes
          .filter(p => !p.eh_pet)
          .sort((a, b) => (iniciativas[b.nome] || 0) - (iniciativas[a.nome] || 0))
          .map(p => ({
            nome: p.nome,
            iniciativa: iniciativas[p.nome] || 0,
            faction: p.faction,
            hp_atual: p.hp,
            hp_max: p.hp_max,
            incapacitado: false,
            morto: false,
          })),
      }),
    });
    log.metrica('rolar_iniciativa', Date.now() - t0, true, null, { ordem });
    log.info(`✅ Iniciativa definida. Ordem: ${ordem.join(' → ')}`);
  } catch (e) {
    log.metrica('rolar_iniciativa', Date.now() - t0, false, e);
    log.error(`Falha ao atualizar iniciativa: ${e.message}`);
  }

  return { ordem, iniciativas };
}

// ── Simula um ataque ─────────────────────────────────────────
export async function executarAtaque({
  rpgId, batalhaId, atacante, alvo, habilidade, token,
  personagens, log, verificarDelay = false, t_broadcast_ref = null
}) {
  setAuthToken(token);

  const formulaDano = habilidade.formula_dano || '1d6';
  const resultado = rolar(formulaDano);
  const t0 = Date.now();

  // Aplicar dano ao alvo
  const alvoPers = personagens.find(p => p.nome === alvo);
  if (!alvoPers) {
    log.warn(`Alvo "${alvo}" não encontrado no combate`);
    return null;
  }

  const novoHp = Math.max(0, alvoPers.hp_atual - resultado.total);
  const incapacitado = novoHp <= 0;

  try {
    // Atualizar HP do alvo
    await sb(`characters?rpg_id=eq.${rpgId}&nome=eq.${encodeURIComponent(alvo)}`, {
      method: 'PATCH',
      body: JSON.stringify({ hp_atual: novoHp }),
    });

    // Atualizar alvo na lista de participantes da batalha
    const batalha = await sb(`batalhas?id=eq.${batalhaId}&select=participantes`);
    if (batalha?.[0]?.participantes) {
      const parts = batalha[0].participantes.map(p =>
        p.nome === alvo ? { ...p, hp_atual: novoHp, incapacitado } : p
      );
      await sb(`batalhas?id=eq.${batalhaId}`, {
        method: 'PATCH',
        body: JSON.stringify({ participantes: parts }),
      });
    }

    const duracao = Date.now() - t0;
    log.metrica('executar_ataque', duracao, true, null, {
      atacante,
      alvo,
      habilidade: habilidade.habilidade,
      dano: resultado.total,
      formula: resultado.formula,
      detalhes: resultado.detalhes,
      alvo_hp_novo: novoHp,
    });
    log.info(`  ⚔ ${atacante} → ${alvo} | ${habilidade.habilidade}: ${resultado.detalhes} | HP ${alvoPers.hp_atual} → ${novoHp}`);

    // Verificação BUG-05: Dano não pode gerar HP negativo
    if (novoHp < 0) {
      log.bug('B05', `HP de ${alvo} ficou negativo: ${novoHp}`, 'moderado', { alvo, novoHp });
    }

    // Atualiza hp_atual localmente para próximos ataques
    alvoPers.hp_atual = novoHp;

    return { ...resultado, alvo, novoHp, incapacitado };
  } catch (e) {
    log.metrica('executar_ataque', Date.now() - t0, false, e);
    log.error(`Falha ao aplicar dano de ${atacante} em ${alvo}: ${e.message}`);
    return null;
  }
}

// ── Death saves ───────────────────────────────────────────────
export async function executarDeathSave({ rpgId, personagem, batalhaId, token, log }) {
  setAuthToken(token);
  const roll = d20();
  const sucesso = roll >= 10;
  const critico = roll === 20;
  const fatalidade = roll === 1;

  log.metrica('death_save', 0, true, null, {
    personagem,
    roll,
    sucesso,
    critico,
    fatalidade,
  });
  log.info(`  💀 Death save ${personagem}: rolou ${roll} → ${sucesso ? 'SUCESSO' : 'FALHA'}${critico ? ' (CRÍTICO — estabiliza!)' : ''}${fatalidade ? ' (1 — MORTE IMINENTE!)' : ''}`);

  if (critico) {
    // Crítico: estabiliza com 1 HP
    try {
      await sb(`characters?rpg_id=eq.${rpgId}&nome=eq.${encodeURIComponent(personagem)}`, {
        method: 'PATCH',
        body: JSON.stringify({ hp_atual: 1 }),
      });
      log.info(`  ✅ ${personagem} estabilizou com 1 HP!`);
    } catch (e) {
      log.error(`Falha ao estabilizar ${personagem}: ${e.message}`);
    }
  }

  return { roll, sucesso, critico, fatalidade };
}

// ── Movimento de token ────────────────────────────────────────
export async function moverToken({ rpgId, mapaId, personagem, dc, dr, posAtual, token, log, dispositivo = 'desktop' }) {
  setAuthToken(token);
  const novaPosicao = {
    col: Math.max(0, Math.min(9, posAtual.col + dc)),
    row: Math.max(0, Math.min(9, posAtual.row + dr)),
  };

  const t0 = Date.now();
  try {
    await sb(`characters?rpg_id=eq.${rpgId}&nome=eq.${encodeURIComponent(personagem)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        map_positions: { [mapaId]: novaPosicao },
        active_map_id: mapaId,
      }),
    });
    const duracao = Date.now() - t0;
    log.metrica(dispositivo === 'mobile' ? 'mobile_mover' : 'mover_token', duracao, true, null, {
      personagem,
      de: posAtual,
      para: novaPosicao,
    });
    log.info(`  🗺 ${personagem} moveu: (${posAtual.col},${posAtual.row}) → (${novaPosicao.col},${novaPosicao.row})`);
    return novaPosicao;
  } catch (e) {
    log.metrica('mover_token', Date.now() - t0, false, e);
    log.warn(`Falha ao mover ${personagem}: ${e.message}`);
    return posAtual;
  }
}

// ── Ação criativa ─────────────────────────────────────────────
export async function submeterAcaoCriativa({ rpgId, atacante, alvo, descricao, turno, token, log }) {
  setAuthToken(token);
  const t0 = Date.now();
  try {
    const [criativo] = await sb('criativos', {
      method: 'POST',
      body: JSON.stringify({
        rpg_id: rpgId,
        atacante,
        alvo,
        descricao,
        turno,
        status: 'pendente',
      }),
    });
    log.metrica('submeter_criativo', Date.now() - t0, true, null, { id: criativo?.id, descricao });
    log.info(`  💡 Ação criativa submetida por ${atacante}: "${descricao}"`);
    return criativo;
  } catch (e) {
    log.metrica('submeter_criativo', Date.now() - t0, false, e);
    log.warn(`Falha ao submeter ação criativa: ${e.message}`);

    // VERIFICAÇÃO BUG: tabela criativos pode não existir
    if (e.message.includes('relation') || e.message.includes('does not exist')) {
      log.bug('B-CRIATIVO-01', 'Tabela "criativos" não encontrada — ação criativa indisponível', 'critico', { erro: e.message });
    }
    return null;
  }
}

// ── GM aprova ação criativa ───────────────────────────────────
export async function aprovarAcaoCriativa({ criativoId, formula, token, log }) {
  setAuthToken(token);
  const t0 = Date.now();
  try {
    await sb(`criativos?id=eq.${criativoId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'aprovado_dc',
        formula_aprovada: formula,
      }),
    });
    log.metrica('aprovar_criativo', Date.now() - t0, true, null, { criativoId, formula });
    log.info(`  ✅ GM aprovou ação criativa: fórmula ${formula}`);
  } catch (e) {
    log.metrica('aprovar_criativo', Date.now() - t0, false, e);
    log.warn(`Falha ao aprovar ação criativa: ${e.message}`);
  }
}

// ── Avançar turno ─────────────────────────────────────────────
export async function avancarTurno({ batalhaId, ordemAtualIdx, participantes, token, log }) {
  setAuthToken(token);
  const proximo = (ordemAtualIdx + 1) % participantes.length;
  const novaRodada = proximo === 0;

  const batalha = await sb(`batalhas?id=eq.${batalhaId}&select=turno_round`);
  const rodadaAtual = batalha?.[0]?.turno_round || 1;

  await sb(`batalhas?id=eq.${batalhaId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ordem_atual: proximo,
      turno_round: novaRodada ? rodadaAtual + 1 : rodadaAtual,
    }),
  });

  log.info(`  ⏭ Turno avançado → ${participantes[proximo]?.nome || '?'}${novaRodada ? ` (Rodada ${rodadaAtual + 1})` : ''}`);
  return proximo;
}

// ── Encerrar batalha ─────────────────────────────────────────
export async function encerrarBatalha({ rpgId, batalhaId, token, log }) {
  setAuthToken(token);
  const t0 = Date.now();
  try {
    await sb(`batalhas?id=eq.${batalhaId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ativa: false,
        fase: 'encerrada',
        pausada: false,
      }),
    });
    log.metrica('encerrar_batalha', Date.now() - t0, true, null, { batalhaId });
    log.info('🏁 Batalha encerrada');
  } catch (e) {
    log.metrica('encerrar_batalha', Date.now() - t0, false, e);
    log.error(`Falha ao encerrar batalha: ${e.message}`);
  }
}

// ── Distribuir XP ─────────────────────────────────────────────
export async function distribuirXP({ rpgId, personagens, xpPorPersonagem, token, log }) {
  setAuthToken(token);
  for (const nome of personagens) {
    const t0 = Date.now();
    try {
      // Busca XP atual
      const chars = await sb(`characters?rpg_id=eq.${rpgId}&nome=eq.${encodeURIComponent(nome)}&select=xp,nivel`);
      const char = chars?.[0];
      if (!char) { log.warn(`Personagem ${nome} não encontrado para XP`); continue; }

      const novoXp = (char.xp || 0) + xpPorPersonagem;
      await sb(`characters?rpg_id=eq.${rpgId}&nome=eq.${encodeURIComponent(nome)}`, {
        method: 'PATCH',
        body: JSON.stringify({ xp: novoXp }),
      });
      log.metrica('distribuir_xp', Date.now() - t0, true, null, { nome, xp: novoXp });
      log.info(`  📈 ${nome}: +${xpPorPersonagem} XP (total: ${novoXp})`);
    } catch (e) {
      log.metrica('distribuir_xp', Date.now() - t0, false, e);
      log.warn(`Falha ao dar XP para ${nome}: ${e.message}`);
    }
  }
}

// ── Level up ──────────────────────────────────────────────────
export async function executarLevelUp({ rpgId, personagem, novoNivel, token, log }) {
  setAuthToken(token);
  const t0 = Date.now();
  try {
    await sb(`characters?rpg_id=eq.${rpgId}&nome=eq.${encodeURIComponent(personagem)}`, {
      method: 'PATCH',
      body: JSON.stringify({ nivel: novoNivel }),
    });
    log.metrica('level_up', Date.now() - t0, true, null, { personagem, novoNivel });
    log.info(`  🎉 ${personagem} subiu para nível ${novoNivel}!`);
  } catch (e) {
    log.metrica('level_up', Date.now() - t0, false, e);
    log.warn(`Falha ao aplicar level up de ${personagem}: ${e.message}`);
  }
}

// ── Usar item consumível ──────────────────────────────────────
export async function usarItem({ rpgId, personagem, itemNome, alvo, token, log }) {
  setAuthToken(token);
  // Simula uso de poção de cura
  const cura = rolar('1d8+3');
  const t0 = Date.now();
  try {
    // Busca HP do alvo
    const chars = await sb(`characters?rpg_id=eq.${rpgId}&nome=eq.${encodeURIComponent(alvo)}&select=hp_atual,hp_max`);
    const char = chars?.[0];
    if (!char) { log.warn(`Personagem ${alvo} não encontrado para usar item`); return; }

    const novoHp = Math.min(char.hp_max, char.hp_atual + cura.total);
    await sb(`characters?rpg_id=eq.${rpgId}&nome=eq.${encodeURIComponent(alvo)}`, {
      method: 'PATCH',
      body: JSON.stringify({ hp_atual: novoHp }),
    });
    log.metrica('usar_item', Date.now() - t0, true, null, {
      personagem,
      item: itemNome,
      alvo,
      cura: cura.total,
      hp_novo: novoHp,
    });
    log.info(`  💊 ${personagem} usou ${itemNome} em ${alvo}: cura ${cura.detalhes}, HP → ${novoHp}`);
  } catch (e) {
    log.metrica('usar_item', Date.now() - t0, false, e);
    log.warn(`Falha ao usar item: ${e.message}`);
  }
}

// ── Simular rodada completa ────────────────────────────────────
export async function simularRodada({
  rodada, rpgId, mapaId, batalhaId,
  personagens, habilidades, posicoes,
  ordem, sessoes, log,
}) {
  log.info(`\n${'═'.repeat(50)}`);
  log.info(`  RODADA ${rodada}`);
  log.info('═'.repeat(50));

  const HABS = {};
  for (const h of habilidades) {
    if (!HABS[h.personagem]) HABS[h.personagem] = [];
    HABS[h.personagem].push(h);
  }

  let ordemIdx = 0;
  for (const nomeAtacante of ordem) {
    const atacante = personagens.find(p => p.nome === nomeAtacante);
    if (!atacante || atacante.hp_atual <= 0) {
      log.info(`  ⏭ ${nomeAtacante} incapacitado — passa turno`);
      ordemIdx++;
      continue;
    }

    log.info(`\n  → Vez de ${nomeAtacante}`);

    // Determinar token de autenticação do atacante
    let token = sessoes.mestre?.access_token;
    if (nomeAtacante === 'Kael')   token = sessoes.jogador1?.access_token || token;
    if (nomeAtacante === 'Lyra')   token = sessoes.jogador2?.access_token || token;
    if (nomeAtacante === 'Theron') token = sessoes.jogador3?.access_token || token;

    const dispositivo = ['Lyra', 'Theron'].includes(nomeAtacante) ? 'mobile' : 'desktop';

    // Movimento (simulação de D-pad para mobile)
    const posAtual = posicoes[nomeAtacante] || { col: 5, row: 5 };
    let novaPosicao = posAtual;

    const inimigos = personagens.filter(p => p.faction === 'inimigo' && p.hp_atual > 0);
    if (inimigos.length > 0 && atacante.faction !== 'inimigo') {
      // Move em direção ao inimigo mais próximo
      const alvoPos = posicoes[inimigos[0].nome] || { col: 5, row: 3 };
      const dc = alvoPos.col > posAtual.col ? 1 : alvoPos.col < posAtual.col ? -1 : 0;
      const dr = alvoPos.row > posAtual.row ? 1 : alvoPos.row < posAtual.row ? -1 : 0;

      if (dc !== 0 || dr !== 0) {
        novaPosicao = await moverToken({
          rpgId, mapaId,
          personagem: nomeAtacante,
          dc, dr,
          posAtual,
          token,
          log,
          dispositivo,
        });
        posicoes[nomeAtacante] = novaPosicao;
      }
    }

    // Escolher habilidade e alvo
    const habs = HABS[nomeAtacante] || [];
    const habAtaque = habs.find(h => h.alvo_tipo === 'inimigo') || habs[0];

    const alvosIni = atacante.faction === 'inimigo'
      ? personagens.filter(p => p.faction !== 'inimigo' && p.hp_atual > 0)
      : personagens.filter(p => p.faction === 'inimigo' && p.hp_atual > 0);

    if (habAtaque && alvosIni.length > 0) {
      const alvo = alvosIni[0];
      await executarAtaque({
        rpgId, batalhaId,
        atacante: nomeAtacante,
        alvo: alvo.nome,
        habilidade: habAtaque,
        token,
        personagens,
        log,
      });

      // Pet de Theron age junto na vez dele
      if (nomeAtacante === 'Theron') {
        const pet = personagens.find(p => p.eh_pet && p.pet_dono === 'Theron' && p.hp_atual > 0);
        if (pet) {
          const habPet = HABS[pet.nome]?.[0];
          if (habPet) {
            log.info(`    🐺 Pet ${pet.nome} age na vez de Theron`);
            await executarAtaque({
              rpgId, batalhaId,
              atacante: pet.nome,
              alvo: alvo.nome,
              habilidade: habPet,
              token,
              personagens,
              log,
            });
            log.metrica('pet_ataque', 0, true, null, { pet: pet.nome, dono: 'Theron' });
          }
        }
      }
    } else if (habs.find(h => h.alvo_tipo === 'aliado' || h.alvo_tipo === 'proprio')) {
      // Usar habilidade de suporte se não há inimigos acessíveis
      const habCura = habs.find(h => h.alvo_tipo === 'proprio');
      if (habCura) {
        log.info(`  ${nomeAtacante} usa ${habCura.habilidade} em si mesmo`);
      }
    }

    // Avançar turno
    ordemIdx = await avancarTurno({
      batalhaId,
      ordemAtualIdx: ordemIdx,
      participantes: ordem.map(n => ({ nome: n })),
      token: sessoes.mestre?.access_token,
      log,
    });

    await sleep(200); // pausa entre turnos
  }

  log.info(`\n  Fim da rodada ${rodada}`);
}
