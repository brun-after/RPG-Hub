#!/usr/bin/env node
// run.js — Orquestrador principal dos agentes de sessão RPG Hub
//
// Uso:
//   node run.js                    — sessão completa
//   node run.js --only-setup       — apenas cria campanha/personagens
//   node run.js --only-teardown    — apenas remove dados de teste
//   node run.js --only-report      — apenas gera relatório com dados existentes
//   node run.js --skip-teardown    — não remove dados ao final (útil para debug)
//   node run.js --rodadas 3        — define número de rodadas de combate
//
// Requisitos: .env com credenciais (veja .env.example)

import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { initSupabase, setAuthToken } from './lib/supabase.js';
import { initLogger, createLogger, getBugs, getAtritos, getMetricas } from './lib/logger.js';
import { gerarRelatorio } from './lib/report.js';
import { setup, tentarCriarContas, PERSONAGENS } from './scenarios/setup.js';
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

import { AgentesMestre }   from './agents/mestre.js';
import { AgenteJogador1 }  from './agents/jogador1.js';
import { AgenteJogador2 }  from './agents/jogador2.js';
import { AgenteJogador3 }  from './agents/jogador3.js';

// ── Configuração ──────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL      = process.env.SUPABASE_URL          || 'https://exfcimrtyuhygiicspwh.supabase.co';
const SUPABASE_KEY      = process.env.SUPABASE_ANON_KEY     || '';
const SUPABASE_SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const REPORT_PATH   = join(__dir, 'ux-report.md');
const LOG_PATH      = join(__dir, 'session.log');
const VERBOSE       = process.env.VERBOSE === 'true';

const args = process.argv.slice(2);
const FLAG = {
  onlySetup:    args.includes('--only-setup'),
  onlyTeardown: args.includes('--only-teardown'),
  onlyReport:   args.includes('--only-report'),
  skipTeardown: args.includes('--skip-teardown') || process.env.SKIP_TEARDOWN === 'true',
};
const rodadas = parseInt(args.find(a => a.match(/^\d+$/)) || process.env.RODADAS_COMBATE || '5');

const CONTAS = {
  mestre:   { email: process.env.MESTRE_EMAIL,   senha: process.env.MESTRE_SENHA,   access_token: process.env.MESTRE_ACCESS_TOKEN   },
  jogador1: { email: process.env.JOGADOR1_EMAIL, senha: process.env.JOGADOR1_SENHA, access_token: process.env.JOGADOR1_ACCESS_TOKEN },
  jogador2: { email: process.env.JOGADOR2_EMAIL, senha: process.env.JOGADOR2_SENHA, access_token: process.env.JOGADOR2_ACCESS_TOKEN },
  jogador3: { email: process.env.JOGADOR3_EMAIL, senha: process.env.JOGADOR3_SENHA, access_token: process.env.JOGADOR3_ACCESS_TOKEN },
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Agentes ────────────────────────────────────────────────────
let agtMestre, agtJ1, agtJ2, agtJ3;

// ── Main ──────────────────────────────────────────────────────
async function main() {
  initLogger(LOG_PATH, VERBOSE);
  initSupabase(SUPABASE_URL, SUPABASE_KEY);
  const log = createLogger('orchestrator', 'desktop');

  log.info('═══════════════════════════════════════════════════');
  log.info('  RPG Hub — Agentes de Sessão Automatizada');
  log.info('  Campanha: Agentes - A Cripta Maldita');
  log.info(`  Rodadas de combate: ${rodadas}`);
  log.info(`  Relatório: ${REPORT_PATH}`);
  log.info('═══════════════════════════════════════════════════');

  // Verificar credenciais
  if (!CONTAS.mestre.email) {
    log.error('Credenciais não encontradas. Configure o arquivo .env (veja .env.example)');
    process.exit(1);
  }

  if (!SUPABASE_KEY) {
    log.error('SUPABASE_ANON_KEY não configurada no .env');
    process.exit(1);
  }

  initSupabase(SUPABASE_URL, SUPABASE_KEY, SUPABASE_SVC_KEY);

  // Verificar tokens pré-configurados
  const tokensPreconfigured = {
    mestre:   process.env.MESTRE_ACCESS_TOKEN,
    jogador1: process.env.JOGADOR1_ACCESS_TOKEN,
    jogador2: process.env.JOGADOR2_ACCESS_TOKEN,
    jogador3: process.env.JOGADOR3_ACCESS_TOKEN,
  };
  const usandoTokensPreconfig = Object.values(tokensPreconfigured).some(t => t);
  if (usandoTokensPreconfig) {
    log.info('🔑 Usando tokens de acesso pré-configurados do .env');
  } else if (SUPABASE_SVC_KEY) {
    log.info('🔑 Service Role Key detectada — criação de contas sem captcha habilitada');
  } else {
    log.warn('⚠ Sem service role key — se hCaptcha estiver ativo no login, agentes falharão');
    log.warn('  Soluções: (1) adicionar SUPABASE_SERVICE_ROLE_KEY ao .env, ou');
    log.warn('  (2) adicionar *_ACCESS_TOKEN ao .env (tokens de contas existentes)');
  }

  // ── Tentativa de criação de contas (ignora erros) ─────────────
  if (!FLAG.onlyTeardown && !FLAG.onlyReport) {
    await tentarCriarContas(CONTAS).catch(() => {});
  }

  // ── SETUP ─────────────────────────────────────────────────────
  let rpgId, mapaId, campanha, sessoes, personagensCriados;

  if (!FLAG.onlyTeardown && !FLAG.onlyReport) {
    try {
      ({ rpgId, mapaId, campanha, sessoes, personagens: personagensCriados } = await setup(CONTAS));
    } catch (e) {
      log.error(`Setup falhou: ${e.message}`);
      log.warn('Dica: verifique se as credenciais do .env estão corretas e se as contas existem no Supabase');
      gerarRelatorio(REPORT_PATH, { campanha: 'FALHOU NO SETUP', rodadas });
      process.exit(1);
    }
  }

  if (FLAG.onlySetup) {
    log.info('✅ Setup concluído (--only-setup)');
    gerarRelatorio(REPORT_PATH, { campanha: campanha?.name, rodadas });
    return;
  }

  // ── CONECTAR AGENTES ──────────────────────────────────────────
  log.info('\n📡 Conectando agentes ao realtime...');

  agtMestre = new AgentesMestre({
    sessao: sessoes.mestre,
    rpgId, mapaId,
    personagens: Object.values(personagensCriados),
    habilidades: [],
  });

  agtJ1 = new AgenteJogador1({ sessao: sessoes.jogador1, rpgId, mapaId });
  agtJ2 = new AgenteJogador2({ sessao: sessoes.jogador2, rpgId, mapaId });
  agtJ3 = new AgenteJogador3({ sessao: sessoes.jogador3, rpgId, mapaId });

  // Conectar em paralelo
  await Promise.allSettled([
    agtMestre.conectar(SUPABASE_URL, SUPABASE_KEY).catch(e => log.warn(`Mestre realtime: ${e.message}`)),
    agtJ1.conectar(SUPABASE_URL, SUPABASE_KEY).catch(e => log.warn(`J1 realtime: ${e.message}`)),
    agtJ2.conectar(SUPABASE_URL, SUPABASE_KEY).catch(e => log.warn(`J2 realtime: ${e.message}`)),
    agtJ3.conectar(SUPABASE_URL, SUPABASE_KEY).catch(e => log.warn(`J3 realtime: ${e.message}`)),
  ]);
  await sleep(500); // aguarda WebSocket estabilizar

  // ── VERIFICAÇÕES PRÉ-COMBATE ──────────────────────────────────
  log.info('\n🔍 Verificações pré-combate...');

  await agtMestre.abrirMapa();
  await agtJ1.carregarCampanha();
  await agtJ1.verificarFichaPersonagem();
  await agtJ2.verificarCarregamentoMobile();
  await agtJ3.verificarAbaPet();

  await sleep(300);

  // ── CHAT PRÉ-BATALHA ──────────────────────────────────────────
  log.info('\n💬 Chat pré-batalha...');
  await agtJ1.enviarChat('Pronto para a batalha! Vamos entrar na cripta!');
  await sleep(100);
  await agtJ2.enviarChat('Aguardando o sinal do mestre 🏹');
  await sleep(100);
  await agtJ3.enviarChat('Sombra está pronta! Vamos lá!');
  await sleep(100);
  await agtMestre.chatComoNpc('Capitão Vorn', 'INTRUSOS! Matem todos!');

  await sleep(500);

  // ── PREPARAR DADOS DE COMBATE ─────────────────────────────────
  const habilidades = await carregarHabilidades(rpgId, sessoes.mestre.access_token, log);

  // Lista de personagens para o combate (sem pet na ordem de iniciativa)
  const combatentes = [
    { nome: 'Arquimedes',      faction: 'aliado',  hp: 38, hp_max: 38, eh_pet: false, mod_iniciativa: 2 },
    { nome: 'Kael',            faction: 'aliado',  hp: 52, hp_max: 52, eh_pet: false, mod_iniciativa: 1 },
    { nome: 'Lyra',            faction: 'aliado',  hp: 42, hp_max: 42, eh_pet: false, mod_iniciativa: 4 },
    { nome: 'Theron',          faction: 'aliado',  hp: 49, hp_max: 49, eh_pet: false, mod_iniciativa: 0 },
    { nome: 'Sombra',          faction: 'aliado',  hp: 22, hp_max: 22, eh_pet: true,  pet_dono: 'Theron', mod_iniciativa: 2 },
    { nome: 'Capitão Vorn',    faction: 'inimigo', hp: 40, hp_max: 40, eh_pet: false, mod_iniciativa: 1 },
    { nome: 'Lobo das Trevas', faction: 'inimigo', hp: 28, hp_max: 28, eh_pet: false, mod_iniciativa: 3 },
  ];

  // Clonar para uso mutável (hp_atual)
  const personsAtivos = combatentes.map(p => ({ ...p, hp_atual: p.hp }));

  // Posições iniciais
  const posicoes = {
    'Arquimedes':      { col: 5, row: 9 },
    'Kael':            { col: 4, row: 8 },
    'Lyra':            { col: 6, row: 9 },
    'Theron':          { col: 5, row: 8 },
    'Sombra':          { col: 4, row: 9 },
    'Capitão Vorn':    { col: 5, row: 3 },
    'Lobo das Trevas': { col: 6, row: 3 },
  };

  // ── INICIAR BATALHA ───────────────────────────────────────────
  log.info('\n⚔ Iniciando batalha...');
  setAuthToken(sessoes.mestre.access_token);

  const batalhaId = await iniciarBatalha({
    rpgId,
    mapaId,
    participantes: combatentes.filter(p => !p.eh_pet),
    mestreToken: sessoes.mestre.access_token,
    log: createLogger('combate', 'desktop'),
  });

  await sleep(500);

  // ── FASE DE INICIATIVA ────────────────────────────────────────
  const combateLog = createLogger('combate', 'desktop');
  const { ordem } = await faseIniciativa({
    rpgId,
    batalhaId,
    participantes: combatentes,
    sessoes,
    log: combateLog,
  });

  await sleep(300);

  // Verificações pós-iniciativa
  await agtMestre.verificarIniciatviStrip(batalhaId);
  await agtJ3.verificarPetIniciativa(batalhaId);
  await agtJ3.verificarMovimentoPet(posicoes['Theron']);

  // ── RODADAS DE COMBATE ────────────────────────────────────────
  let therondEuAZeroHP = false;
  let criatioId = null;

  for (let rodada = 1; rodada <= rodadas; rodada++) {
    await simularRodada({
      rodada,
      rpgId,
      mapaId,
      batalhaId,
      personagens: personsAtivos,
      habilidades,
      posicoes,
      ordem,
      sessoes,
      log: combateLog,
    });

    // ── Eventos especiais por rodada ──────────────────────────

    // Rodada 1: D-pad mobile explícito
    if (rodada === 1) {
      const posLyra = posicoes['Lyra'];
      const novaPosLyra = await agtJ2.dpadMover(0, -1, posLyra);
      posicoes['Lyra'] = novaPosLyra;
      await agtJ2.verificarZonaAcoes(batalhaId);

      const posTheron = posicoes['Theron'];
      const novaPosTheron = await agtJ3.dpadMover(-1, -1, posTheron);
      posicoes['Theron'] = novaPosTheron;
      agtJ3.alternarAbaMobile(); // vê o pet
    }

    // Rodada 2: Ação criativa de Kael
    if (rodada === 2) {
      log.info('\n💡 Kael tenta ação criativa...');
      const criativo = await submeterAcaoCriativa({
        rpgId,
        atacante: 'Kael',
        alvo: 'Capitão Vorn',
        descricao: 'Jogar areia nos olhos do Capitão para cegá-lo temporariamente',
        turno: rodada,
        token: sessoes.jogador1?.access_token || sessoes.mestre.access_token,
        log: combateLog,
      });

      if (criativo) {
        criatioId = criativo.id;
        await sleep(200);
        // GM aprova
        await aprovarAcaoCriativa({
          criativoId: criatioId,
          formula: '1d4',
          token: sessoes.mestre.access_token,
          log: combateLog,
        });
      }
    }

    // Rodada 3: Kael vai a 0 HP → death saves
    if (rodada === 3 && !therondEuAZeroHP) {
      const kael = personsAtivos.find(p => p.nome === 'Kael');
      if (kael && kael.hp_atual > 0) {
        log.info('\n💀 Simulando Kael caindo a 0 HP...');
        kael.hp_atual = 0;
        setAuthToken(sessoes.mestre.access_token);
        try {
          const { sb: sbFunc } = await import('./lib/supabase.js');
          await sbFunc(`characters?rpg_id=eq.${rpgId}&nome=eq.Kael`, {
            method: 'PATCH',
            body: JSON.stringify({ hp_atual: 0 }),
          });
        } catch {}

        therondEuAZeroHP = true;

        for (let ds = 1; ds <= 3; ds++) {
          const resultado = await executarDeathSave({
            rpgId,
            personagem: 'Kael',
            batalhaId,
            token: sessoes.jogador1?.access_token || sessoes.mestre.access_token,
            log: combateLog,
          });
          if (resultado.critico || ds === 3) break;
          await sleep(150);
        }

        // Lyra usa poção em Kael
        await usarItem({
          rpgId,
          personagem: 'Lyra',
          itemNome: 'Poção de Cura',
          alvo: 'Kael',
          token: sessoes.jogador2?.access_token || sessoes.mestre.access_token,
          log: combateLog,
        });
      }
    }

    // Rodada 4: Verificações mobile pós-dano
    if (rodada === 4) {
      await agtJ2.verificarEstadoPersonagem();
      await agtJ3.verificarHpPet();
      await agtMestre.verificarCooldowns(batalhaId);
    }

    // Chat durante combate
    if (rodada === 2) {
      await agtJ1.enviarChat(`Rodada ${rodada}! Vamos nessa!`);
    }

    await sleep(200);
  }

  // ── PÓS-COMBATE ───────────────────────────────────────────────
  log.info('\n🏁 Encerrando batalha...');
  await encerrarBatalha({ rpgId, batalhaId, token: sessoes.mestre.access_token, log: combateLog });

  // XP — apenas personagens jogadores (não NPCs)
  const jogadores = ['Arquimedes', 'Kael', 'Lyra', 'Theron'];
  await distribuirXP({
    rpgId,
    personagens: jogadores,
    xpPorPersonagem: 350,
    token: sessoes.mestre.access_token,
    log: combateLog,
  });

  // Level up de Theron (simula atingir threshold)
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

  // Chat pós-combate
  await agtMestre.chatComoNpc('Narrador', 'O perigo foi contido... por enquanto.');
  await sleep(100);
  await agtJ1.enviarChat('Boa sessão pessoal! 🎉');
  await agtJ2.enviarChat('Lyra quase morreu mas foi épico 😅');
  await agtJ3.enviarChat('Sombra se saiu muito bem! 🐺');

  // ── TEARDOWN ──────────────────────────────────────────────────
  if (!FLAG.skipTeardown) {
    log.info('\n🗑 Limpando dados de teste...');
    await teardown(rpgId, sessoes.mestre.access_token);
  } else {
    log.info(`\n⚠ Teardown ignorado (--skip-teardown). rpgId: ${rpgId}`);
  }

  // ── DESCONECTAR AGENTES ───────────────────────────────────────
  await Promise.allSettled([
    agtMestre?.desconectar(),
    agtJ1?.desconectar(),
    agtJ2?.desconectar(),
    agtJ3?.desconectar(),
  ]);

  // ── GERAR RELATÓRIO ───────────────────────────────────────────
  log.info('\n📊 Gerando relatório de UX...');
  const resumo = gerarRelatorio(REPORT_PATH, {
    campanha: campanha?.name || CAMPANHA_NOME,
    rodadas,
  });

  log.info('═══════════════════════════════════════════════════');
  log.info(`  SESSÃO CONCLUÍDA`);
  log.info(`  Nota UX: ${resumo.nota.toFixed(1)}/5`);
  log.info(`  Bugs: ${resumo.bugs} | Atritos: ${resumo.atritos} | Ações: ${resumo.acoes}`);
  log.info(`  Relatório: ${REPORT_PATH}`);
  log.info('═══════════════════════════════════════════════════');
}

// ── Carrega habilidades do DB ─────────────────────────────────
async function carregarHabilidades(rpgId, token, log) {
  setAuthToken(token);
  try {
    const { sb } = await import('./lib/supabase.js');
    const habs = await sb(`skills?rpg_id=eq.${rpgId}&select=*`);
    log.info(`📚 ${habs?.length || 0} habilidades carregadas do banco`);
    return habs || [];
  } catch (e) {
    log.warn(`Falha ao carregar habilidades: ${e.message}`);
    return [];
  }
}

// ── Tratamento de erros e cleanup ────────────────────────────
process.on('unhandledRejection', (err) => {
  console.error('[Erro não tratado]', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('\n[Interrompido] Gerando relatório parcial...');
  try {
    gerarRelatorio(REPORT_PATH + '.parcial.md', { campanha: 'INTERROMPIDO', rodadas: 0 });
    await Promise.allSettled([
      agtMestre?.desconectar(),
      agtJ1?.desconectar(),
      agtJ2?.desconectar(),
      agtJ3?.desconectar(),
    ]);
  } catch {}
  process.exit(0);
});

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
