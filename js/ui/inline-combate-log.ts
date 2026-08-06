// ═══════════════════════════════════════════════════════════════
// FUNÇÕES DO LOG DE COMBATE
// ═══════════════════════════════════════════════════════════════

// Função para toggle do log de combate
function toggleCombateLog() {
  const sidebar = document.getElementById('combate-log-sidebar');
  if (!sidebar) return;
  
  const isVisible = sidebar.style!.display !== 'none';
  sidebar.style!.display = isVisible ? 'none' : 'flex';
}

// Mostrar botão de log quando entrar em combate
function mostrarBotaoLogCombate__sombreado_local() { // sombreada pela declaração posterior (comportamento clássico: última vence)
  const btn = document.getElementById('combate-log-toggle');
  if (btn) btn.style!.display = 'block';
}

// Ocultar botão de log quando sair de combate
function ocultarBotaoLogCombate__sombreado_local() { // sombreada pela declaração posterior (comportamento clássico: última vence)
  const btn = document.getElementById('combate-log-toggle');
  const sidebar = document.getElementById('combate-log-sidebar');
  if (btn) btn.style!.display = 'none';
  if (sidebar) sidebar.style!.display = 'none';
}

// ═══════════════════════════════════════════════════════════════
// FASE 3: FUNÇÕES DE ATALHOS DE TECLADO
// ═══════════════════════════════════════════════════════════════

// Toggle tooltip de atalhos
function toggleAtalhosHelp() {
  const tooltip = document.getElementById('atalhos-tooltip');
  if (!tooltip) return;
  
  const isVisible = tooltip.style!.display !== 'none';
  tooltip.style!.display = isVisible ? 'none' : 'block';
}

// Mostrar/ocultar botão de atalhos junto com log de combate
function mostrarBotaoLogCombate() {
  const btnLog = document.getElementById('combate-log-toggle');
  const btnAtalhos = document.getElementById('atalhos-help-toggle');
  if (btnLog) btnLog.style!.display = 'block';
  if (btnAtalhos) btnAtalhos.style!.display = 'block';
}

function ocultarBotaoLogCombate() {
  const btnLog = document.getElementById('combate-log-toggle');
  const btnAtalhos = document.getElementById('atalhos-help-toggle');
  const sidebar = document.getElementById('combate-log-sidebar');
  const tooltip = document.getElementById('atalhos-tooltip');
  
  if (btnLog) btnLog.style!.display = 'none';
  if (btnAtalhos) btnAtalhos.style!.display = 'none';
  if (sidebar) sidebar.style!.display = 'none';
  if (tooltip) tooltip.style!.display = 'none';
}

// Auto-mostrar botão quando entrar em modo de batalha
document.addEventListener('DOMContentLoaded', function() {
  // Observer para detectar quando batalha inicia
  const observerCallback = function() {
    const hudBatalha = document.getElementById('hud-batalha');
    if (hudBatalha && hudBatalha.style!.display !== 'none') {
      mostrarBotaoLogCombate();
    }
  };
  
  // Executar uma vez na carga
  setTimeout(observerCallback, 1000);
  
  // E periodicamente
  setInterval(observerCallback, 5000);
});

/* [migração-esm] accessors globais */
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "toggleCombateLog", { configurable: true, get: () => toggleCombateLog, set: (__v) => { toggleCombateLog = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mostrarBotaoLogCombate", { configurable: true, get: () => mostrarBotaoLogCombate, set: (__v) => { mostrarBotaoLogCombate = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "ocultarBotaoLogCombate", { configurable: true, get: () => ocultarBotaoLogCombate, set: (__v) => { ocultarBotaoLogCombate = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "toggleAtalhosHelp", { configurable: true, get: () => toggleAtalhosHelp, set: (__v) => { toggleAtalhosHelp = __v; } });
