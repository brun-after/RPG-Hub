#!/usr/bin/env node
// run.js — Orquestrador principal dos agentes de sessão RPG Hub
//
// Modo simulação: bypassa autenticação — banco em memória, sem tocar no Supabase.
// Toda a lógica do jogo é executada contra o código do app portado para Node.js.
//
// Uso:
//   node run.js                    — sessão completa (simulação)
//   node run.js --rodadas 3        — define número de rodadas de combate
//   node run.js --skip-teardown    — mantém dados em memória para debug
//   node run.js --verbose          — log detalhado
//   node run.js --no-sim           — modo real (requer credenciais no .env)

import 'dotenv/config';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { initSupabase, setSimMode, setAuthToken } from './lib/supabase.js';
import { seedPlayers, dumpTable } from './lib/simdb.js';
import { initLogger, createLogger, getBugs, getAtritos, getMetricas } from './lib/logger.js';
import { gerarRelatorio } from './lib/report.js';
import { setup, PERSONAGENS } from './scenarios/setup.js';
import { teardown } from './scenarios/teardown.js';
import {
  iniciarBatalha,
  faseIniciativa,
  simularRodada,
  submeterAcaoCriativa,
  aprovarAcaoCriativa,
  executarDeathSave,
  usarItem,
  encerrarBatalha,
  distribuirXP,
  executarLevelUp,
} from './scenarios/combat-round.js';

import { AgentesMestre }  from './agents/mestre.js';
import { AgenteJogador1 } from './agents/jogador1.js';
import { AgenteJogador2 } from './agents/jogador2.js';
import { AgenteJogador3 } from './agents/jogador3.js';

// ── Config ────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = join(__dir, 'ux-report.md');
const LOG_PATH    = join(__dir, 'session.log');

const args = process.argv.slice(2);
const FLAG = {
  skipTeardown: args.includes('--skip-teardown') || process.env.SKIP_TEARDOWN === 'true',
  verbose:      args.includes('--verbose') || process.env.VERBOSE === 'true',
  noSim:        args.includes('--no-sim'),
};
const rodadas = parseInt(args.find(a => a.match(/^\d+$/)) || process.env.RODADAS_COMBATE || '5');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://exfcimrtyuhygiicspwh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Sessões simuladas — tokens fictícios que o SimDB ignora ──
function criarSessoesFake() {
  return {
    mestre:   { access_token: 'sim-token-mestre',   user: { id: 'uid-mestre',   email: 'mestre@sim.test'   } },
    jogador1: { access_token: 'sim-token-jogador1', user: { id: 'uid-jogador1', email: 'kael@sim.test'     } },
    jogador2: { access_token: 'sim-token-jogador2', user: { id: 'uid-jogador2', email: 'lyra@sim.test'     } },
    jogador3: { access_token: 'sim-token-jogador3', user: { id: 'uid-jogador3', email: 'theron@sim.test'   } },
  };
}

// ── Agentes ────────────────────────────────────────────────────
let agtMestre, agtJ1, agtJ2, agtJ3;

// ── Main ──────────────────────────────────────────────────────
async function main() {
  initLogger(LOG_PATH, FLAG.verbose);
  const log = createLogger('orchestrator', 'desktop');

  const SIM = !FLAG.noSim;

  // Inicializar Supabase (ou SimDB)
  initSupabase(SUPABASE_URL, SUPABASE_KEY);
  if (SIM) {
    setSimMode(true);
    log.info('═══════════════════════════════════════════════════');
    log.info('  RPG Hub — Simulação de Sessão (modo offline)');
    log.info('  Banco: em memória (SimDB) — sem auth, sem rede');
    log.info(`  Campanha: Agentes - A Cripta Maldita`);
    log.info(`  Rodadas de combate: ${rodadas}`);
    log.info(`  Relatório: ${REPORT_PATH}`);
    log.info('═══════════════════════════════════════════════════');
  } else {
    log.info('  RPG Hub — Modo real (requer credenciais no .env)');
  }

  // Sessões: simuladas ou do .env
  const sessoes = SIM
    ? criarSessoesFake()
    : {
        mestre:   { access_token: process.env.MESTRE_ACCESS_TOKEN,   user: { id: randomUUID(), email: process.env.MESTRE_EMAIL   } },
        jogador1: { access_token: process.env.JOGADOR1_ACCESS_TOKEN, user: { id: randomUUID(), email: process.env.JOGADOR1_EMAIL } },
        jogador2: { access_token: process.env.JOGADOR2_ACCESS_TOKEN, user: { id: randomUUID(), email: process.env.JOGADOR2_EMAIL } },
        jogador3: { access_token: process.env.JOGADOR3_ACCESS_TOKEN, user: { id: randomUUID(), email: process.env.JOGADOR3_EMAIL } },
      };

  // Seed de players simulados no SimDB (satisfaz FK de rpg_registry.owner_id)
  if (SIM) {
    seedPlayers([
      { id: sessoes.mestre.user.id,   nickname: 'mestre_agente',  nome_real: 'Arquimedes' },
      { id: sessoes.jogador1.user.id, nickname: 'kael_agente',    nome_real: 'Kael' },
      { id: sessoes.jogador2.user.id, nickname: 'lyra_agente',    nome_real: 'Lyra' },
      { id: sessoes.jogador3.user.id, nickname: 'theron_agente',  nome_real: 'Theron' },
    ]);
  }

  // ── SETUP ─────────────────────────────────────────────────────
  let rpgId, mapaId, campanha, personagensCriados;
  setAuthToken(sessoes.mestre.access_token);

  try {
    ({ rpgId, mapaId, campanha, personagens: personagensCriados } = await setup(sessoes));
  } catch (e) {
    log.error(`Setup falhou: ${e.message}`);
    gerarRelatorio(REPORT_PATH, { campanha: 'FALHOU NO SETUP', rodadas });
    process.exit(1);
  }

  // ── CONECTAR AGENTES ──────────────────────────────────────────
  log.info('\n📡 Inicializando agentes...');

  agtMestre = new AgentesMestre({
    sessao: sessoes.mestre,
    rpgId, mapaId,
    personagens: Object.values(personagensCriados),
    habilidades: [],
  });
  agtJ1 = new AgenteJogador1({ sessao: sessoes.jogador1, rpgId, mapaId });
  agtJ2 = new AgenteJogador2({ sessao: sessoes.jogador2, rpgId, mapaId });
  agtJ3 = new AgenteJogador3({ sessao: sessoes.jogador3, rpgId, mapaId });

  // Em sim mode, pular conexão WebSocket (sem rede)
  if (!SIM) {
    await Promise.allSettled([
      agtMestre.conectar(SUPABASE_URL, SUPABASE_KEY).catch(e => log.warn(`Mestre realtime: ${e.message}`)),
      agtJ1.conectar(SUPABASE_URL, SUPABASE_KEY).catch(e => log.warn(`J1 realtime: ${e.message}`)),
      agtJ2.conectar(SUPABASE_URL, SUPABASE_KEY).catch(e => log.warn(`J2 realtime: ${e.message}`)),
      agtJ3.conectar(SUPABASE_URL, SUPABASE_KEY).catch(e => log.warn(`J3 realtime: ${e.message}`)),
    ]);
    await sleep(500);
  } else {
    log.info('  [SimDB] Realtime WebSocket ignorado (offline)');
  }

  // ── VERIFICAÇÕES PRÉ-COMBATE ──────────────────────────────────
  log.info('\n🔍 Verificações pré-combate...');
  await agtMestre.abrirMapa();
  await agtJ1.carregarCampanha();
  await agtJ1.verificarFichaPersonagem();
  await agtJ2.verificarCarregamentoMobile();
  await agtJ3.verificarAbaPet();

  // ── CHAT PRÉ-BATALHA ──────────────────────────────────────────
  log.info('\n💬 Chat pré-batalha...');
  await agtJ1.enviarChat('Pronto para a batalha! Vamos entrar na cripta!');
  await agtJ2.enviarChat('Aguardando o sinal do mestre 🏹');
  await agtJ3.enviarChat('Sombra está pronta! Vamos lá!');
  await agtMestre.chatComoNpc('Capitão Vorn', 'INTRUSOS! Matem todos!');

  // ── CARREGAR HABILIDADES ──────────────────────────────────────
  const { sb } = await import('./lib/supabase.js');
  let habilidades = [];
  try {
    habilidades = await sb(`skills?rpg_id=eq.${rpgId}&select=*`) || [];
    log.info(`📚 ${habilidades.length} habilidades carregadas`);
  } catch (e) {
    log.warn(`Falha ao carregar habilidades: ${e.message}`);
  }

  // ── COMBATENTES ───────────────────────────────────────────────
  const combatentes = [
    { nome: 'Arquimedes',      faction: 'aliado',  hp: 38, hp_max: 38, eh_pet: false, mod_iniciativa: 2 },
    { nome: 'Kael',            faction: 'aliado',  hp: 52, hp_max: 52, eh_pet: false, mod_iniciativa: 1 },
    { nome: 'Lyra',            faction: 'aliado',  hp: 42, hp_max: 42, eh_pet: false, mod_iniciativa: 4 },
    { nome: 'Theron',          faction: 'aliado',  hp: 49, hp_max: 49, eh_pet: false, mod_iniciativa: 0 },
    { nome: 'Sombra',          faction: 'aliado',  hp: 22, hp_max: 22, eh_pet: true,  pet_dono: 'Theron', mod_iniciativa: 2 },
    { nome: 'Capitão Vorn',    faction: 'inimigo', hp: 40, hp_max: 40, eh_pet: false, mod_iniciativa: 1 },
    { nome: 'Lobo das Trevas', faction: 'inimigo', hp: 28, hp_max: 28, eh_pet: false, mod_iniciativa: 3 },
  ];
  const personsAtivos = combatentes.map(p => ({ ...p, hp_atual: p.hp }));

  const posicoes = {
    'Arquimedes':      { col: 5, row: 9 },
    'Kael':            { col: 4, row: 8 },
    'Lyra':            { col: 6, row: 9 },
    'Theron':          { col: 5, row: 8 },
    'Sombra':          { col: 4, row: 9 },
    'Capitão Vorn':    { col: 5, row: 3 },
    'Lobo das Trevas': { col: 6, row: 3 },
  };

  // ── BATALHA ───────────────────────────────────────────────────
  log.info('\n⚔ Iniciando batalha...');
  const combateLog = createLogger('combate', 'desktop');

  const batalhaId = await iniciarBatalha({
    rpgId, mapaId,
    participantes: combatentes.filter(p => !p.eh_pet),
    mestreToken: sessoes.mestre.access_token,
    log: combateLog,
  });

  // ── FASE DE INICIATIVA ────────────────────────────────────────
  const { ordem } = await faseIniciativa({
    rpgId, batalhaId,
    participantes: combatentes,
    sessoes,
    log: combateLog,
  });

  // Verificações pós-iniciativa
  await agtMestre.verificarIniciatviStrip(batalhaId);
  await agtJ3.verificarPetIniciativa(batalhaId);
  await agtJ3.verificarMovimentoPet(posicoes['Theron']);

  // ── RODADAS DE COMBATE ────────────────────────────────────────
  let kaelCaiu = false;

  for (let rodada = 1; rodada <= rodadas; rodada++) {
    await simularRodada({
      rodada, rpgId, mapaId, batalhaId,
      personagens: personsAtivos,
      habilidades, posicoes, ordem, sessoes,
      log: combateLog,
    });

    // ── Eventos especiais ─────────────────────────────────────

    // Rodada 1: D-pad mobile
    if (rodada === 1) {
      const novaPosLyra = await agtJ2.dpadMover(0, -1, posicoes['Lyra']);
      posicoes['Lyra'] = novaPosLyra;
      await agtJ2.verificarZonaAcoes(batalhaId);
      const novaPosTheron = await agtJ3.dpadMover(-1, -1, posicoes['Theron']);
      posicoes['Theron'] = novaPosTheron;
      agtJ3.alternarAbaMobile();
    }

    // Rodada 2: Ação criativa + chat
    if (rodada === 2) {
      log.info('\n💡 Kael submete ação criativa...');
      const criativo = await submeterAcaoCriativa({
        rpgId,
        atacante: 'Kael',
        alvo: 'Capitão Vorn',
        descricao: 'Jogar areia nos olhos do Capitão para cegá-lo temporariamente',
        turno: rodada,
        token: sessoes.jogador1.access_token,
        log: combateLog,
      });
      if (criativo) {
        await sleep(100);
        await aprovarAcaoCriativa({
          criativoId: criativo.id,
          formula: '1d4',
          token: sessoes.mestre.access_token,
          log: combateLog,
        });
        // Verificar bug B-MOD-03: dano_aplicado permanece null após aprovação
        const criativos = await sb(`criativos?id=eq.${criativo.id}&select=status,dano_aplicado`);
        const c = criativos?.[0];
        if (c && c.status === 'aprovado_dc' && c.dano_aplicado == null) {
          combateLog.bug('B-MOD-03', `Criativo aprovado mas dano_aplicado=null — dano nunca será aplicado sem modal explícito`, 'moderado', { id: criativo.id });
        }
      }
      await agtJ1.enviarChat(`Rodada ${rodada}! Joguei areia!`);
    }

    // Rodada 3: Kael cai a 0 HP → death saves → poção
    if (rodada === 3 && !kaelCaiu) {
      const kael = personsAtivos.find(p => p.nome === 'Kael');
      if (kael && kael.hp_atual > 0) {
        log.info('\n💀 Kael cai a 0 HP...');
        kael.hp_atual = 0;
        await sb(`characters?rpg_id=eq.${rpgId}&nome=eq.Kael`, {
          method: 'PATCH',
          body: JSON.stringify({ hp_atual: 0 }),
        });
        kaelCaiu = true;

        for (let ds = 1; ds <= 3; ds++) {
          const r = await executarDeathSave({
            rpgId, personagem: 'Kael', batalhaId,
            token: sessoes.jogador1.access_token,
            log: combateLog,
          });
          if (r.critico || ds === 3) break;
          await sleep(100);
        }

        await usarItem({
          rpgId,
          personagem: 'Lyra',
          itemNome: 'Poção de Cura',
          alvo: 'Kael',
          token: sessoes.jogador2.access_token,
          log: combateLog,
        });

        // Verificar se Kael voltou à lista de participantes ativos
        const batalhaState = await sb(`batalhas?id=eq.${batalhaId}&select=participantes`);
        const parts = batalhaState?.[0]?.participantes || [];
        const kaelPart = parts.find(p => p.nome === 'Kael');
        if (kaelPart && kaelPart.hp_atual <= 0 && !kaelPart.incapacitado) {
          combateLog.bug('B-DEATH-01', `Kael está com HP=0 mas incapacitado=false em participantes — death saves não sincronizados com a batalha`, 'alto', { hp: kaelPart.hp_atual, incapacitado: kaelPart.incapacitado });
        }
      }
    }

    // Rodada 4: Verificações de estado
    if (rodada === 4) {
      await agtJ2.verificarEstadoPersonagem();
      await agtJ3.verificarHpPet();
      await agtMestre.verificarCooldowns(batalhaId);

      // Verificar B-HIGH-01: loop de mortos
      const batalhaState = await sb(`batalhas?id=eq.${batalhaId}&select=participantes,ordem_atual`);
      const bs = batalhaState?.[0];
      if (bs) {
        const vivos = (bs.participantes || []).filter(p => !p.morto && p.hp_atual > 0);
        if (vivos.length === 0 && bs.participantes.length > 0) {
          combateLog.bug('B-HIGH-03', `Todos os participantes estão mortos/incapacitados mas batalha ainda avança turnos`, 'alto', { participantes: bs.participantes.length });
        }
        // Verificar B-HIGH-02: ordem_atual dentro dos limites
        if (bs.ordem_atual >= bs.participantes.length) {
          combateLog.bug('B-HIGH-02', `ordem_atual=${bs.ordem_atual} >= participantes.length=${bs.participantes.length} — off-by-one!`, 'alto');
        }
      }
    }

    await sleep(100);
  }

  // ── PÓS-COMBATE ───────────────────────────────────────────────
  log.info('\n🏁 Encerrando batalha...');
  await encerrarBatalha({ rpgId, batalhaId, token: sessoes.mestre.access_token, log: combateLog });

  await distribuirXP({
    rpgId,
    personagens: ['Arquimedes', 'Kael', 'Lyra', 'Theron'],
    xpPorPersonagem: 350,
    token: sessoes.mestre.access_token,
    log: combateLog,
  });

  await executarLevelUp({
    rpgId,
    personagem: 'Theron',
    novoNivel: 6,
    token: sessoes.mestre.access_token,
    log: combateLog,
  });

  // ── VERIFICAÇÕES PÓS-SESSÃO ───────────────────────────────────
  log.info('\n🔍 Verificações pós-sessão...');
  await agtMestre.verificarPresencaChat();
  await agtMestre.verificarFogOfWar();

  // Verificar cooldowns no estado final
  const batalhaFinal = await sb(`batalhas?id=eq.${batalhaId}&select=cooldowns`);
  const cooldowns = batalhaFinal?.[0]?.cooldowns || {};
  const habsSemId = habilidades.filter(h => !h.id);
  if (habsSemId.length > 0) {
    combateLog.bug('B-MOD-01', `${habsSemId.length} habilidade(s) sem campo "id" — cooldown silenciosamente ignorado para elas`, 'moderado', {
      habilidades: habsSemId.map(h => h.habilidade),
    });
  }

  // Chat pós-combate (verifica cap de caracteres)
  const chatMsgs = [
    { autor: 'Narrador', texto: 'O perigo foi contido... por enquanto.', fn: () => agtMestre.chatComoNpc('Narrador', 'O perigo foi contido... por enquanto.') },
    { autor: 'Kael', texto: 'Boa sessão pessoal! 🎉', fn: () => agtJ1.enviarChat('Boa sessão pessoal! 🎉') },
    { autor: 'Lyra', texto: 'Lyra quase morreu mas foi épico 😅', fn: () => agtJ2.enviarChat('Lyra quase morreu mas foi épico 😅') },
    { autor: 'Theron', texto: 'Sombra se saiu muito bem! 🐺', fn: () => agtJ3.enviarChat('Sombra se saiu muito bem! 🐺') },
  ];
  for (const msg of chatMsgs) {
    await msg.fn();
    await sleep(50);
  }

  // Verificar truncamento de chat (B-UX-02)
  const lore = await sb(`lore?rpg_id=eq.${rpgId}&secao=eq.chat_log&select=conteudo`);
  if (lore?.length > 0) {
    const totalChars = lore.reduce((acc, r) => acc + (r.conteudo?.length || 0), 0);
    if (totalChars > 900) {
      combateLog.atrito(
        `Chat acumulou ${totalChars} chars — próximo de truncar (cap 1000). Em sessões longas perde histórico silenciosamente.`,
        'medio',
        'Aumentar CHAT_CHAR_CAP ou implementar paginação do log de chat'
      );
    }
  }

  // ── TEARDOWN ──────────────────────────────────────────────────
  if (!FLAG.skipTeardown) {
    log.info('\n🗑 Limpando dados de teste...');
    await teardown(rpgId, sessoes.mestre.access_token);
  } else {
    log.info(`\n⚠ Teardown ignorado. rpgId: ${rpgId}`);
    log.info(`  Characters: ${dumpTable('characters').length}`);
    log.info(`  Batalhas: ${dumpTable('batalhas').length}`);
    log.info(`  Skills: ${dumpTable('skills').length}`);
  }

  // ── DESCONECTAR AGENTES ───────────────────────────────────────
  if (!SIM) {
    await Promise.allSettled([
      agtMestre?.desconectar(),
      agtJ1?.desconectar(),
      agtJ2?.desconectar(),
      agtJ3?.desconectar(),
    ]);
  }

  // ── GERAR RELATÓRIO ───────────────────────────────────────────
  log.info('\n📊 Gerando relatório de UX...');
  const resumo = gerarRelatorio(REPORT_PATH, {
    campanha: campanha?.name || 'Agentes - A Cripta Maldita',
    rodadas,
  });

  log.info('═══════════════════════════════════════════════════');
  log.info('  SESSÃO CONCLUÍDA');
  log.info(`  Nota UX: ${resumo.nota.toFixed(1)}/5`);
  log.info(`  Bugs: ${resumo.bugs} | Atritos: ${resumo.atritos} | Ações: ${resumo.acoes}`);
  log.info(`  Relatório: ${REPORT_PATH}`);
  log.info('═══════════════════════════════════════════════════');
}

// ── Cleanup ───────────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
  console.error('[Erro não tratado]', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('\n[Interrompido]');
  process.exit(0);
});

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
