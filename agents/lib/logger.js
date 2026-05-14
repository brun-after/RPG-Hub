// lib/logger.js
// Logger com timestamp, agente e nível — registra métricas para relatório UX

import { appendFileSync, writeFileSync, existsSync } from 'fs';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const COLORS = {
  debug: '\x1b[36m', info: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m', reset: '\x1b[0m'
};

let _logFile = null;
let _verbose = false;
let _minLevel = 'info';

// Métricas coletadas para o relatório
const _metricas = [];
const _bugs = [];
const _atritos = [];

export function initLogger(logFile, verbose = false) {
  _logFile = logFile;
  _verbose = verbose;
  _minLevel = verbose ? 'debug' : 'info';
  if (logFile) writeFileSync(logFile, ''); // limpa o arquivo
}

export function createLogger(agente, dispositivo = 'desktop') {
  const log = (nivel, msg, dados = null) => {
    if (LEVELS[nivel] < LEVELS[_minLevel]) return;
    const ts = new Date().toISOString();
    const linha = `[${ts}] [${nivel.toUpperCase().padEnd(5)}] [${agente.padEnd(10)}] ${msg}`;
    const cor = COLORS[nivel] || '';

    // Console
    console.log(`${cor}${linha}${COLORS.reset}${dados && _verbose ? '\n' + JSON.stringify(dados, null, 2) : ''}`);

    // Arquivo de log
    if (_logFile) {
      try {
        appendFileSync(_logFile, linha + (dados ? ' ' + JSON.stringify(dados) : '') + '\n');
      } catch {}
    }
  };

  return {
    debug: (msg, d) => log('debug', msg, d),
    info:  (msg, d) => log('info', msg, d),
    warn:  (msg, d) => log('warn', msg, d),
    error: (msg, d) => log('error', msg, d),

    // Registra uma ação para métricas de UX
    metrica(acao, duracao_ms, sucesso, erro = null, extras = {}) {
      _metricas.push({
        ts: new Date().toISOString(),
        agente,
        dispositivo,
        acao,
        duracao_ms,
        sucesso,
        erro: erro?.message || erro || null,
        ...extras,
      });
    },

    // Registra um bug encontrado
    bug(id, descricao, severidade = 'moderado', dados = {}) {
      log('warn', `🐛 BUG ${id} [${severidade}]: ${descricao}`, dados);
      _bugs.push({ id, agente, ts: new Date().toISOString(), descricao, severidade, dados });
    },

    // Registra ponto de atrito de UX
    atrito(descricao, impacto = 'baixo', sugestao = '') {
      log('warn', `⚠ Atrito UX: ${descricao}`, { impacto, sugestao });
      _atritos.push({ agente, ts: new Date().toISOString(), descricao, impacto, sugestao });
    },
  };
}

// Exporta dados coletados para o gerador de relatório
export function getMetricas() { return _metricas; }
export function getBugs()     { return _bugs; }
export function getAtritos()  { return _atritos; }
