// js/systems/avt-menu.js
// Menu de início do Modo Aventura — exibido antes de entrar na fase.

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO DO MÓDULO
// ─────────────────────────────────────────────────────────────────────────────
var AVT_MENU_STATE = {
  rpgId: null,
  sessionData: null,
  _saveTimer: null,
  configAba: 'menu',
};

// ─────────────────────────────────────────────────────────────────────────────
// ENTRADA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

async function avtMenuAbrir(rpgId) {
  try {
    mostrarLoading('Carregando dungeon…');
    await _avtCarregarDados(rpgId);
    AVT_MENU_STATE.rpgId = rpgId;
    AVT_MENU_STATE.sessionData = await _avtMenuCarregarSessionData(rpgId);
    ocultarLoading();

    document.getElementById('hub').style.display = 'none';
    const sc = document.getElementById('avt-menu-screen');
    if (!sc) { _avtMenuFallback(rpgId); return; }
    sc.style.display = 'flex';

    const t = AVT_STATE.rpg?.theme_json || {};

    // Imagem de fundo
    const bgEl = document.getElementById('avt-menu-bg-img');
    if (bgEl) {
      const imgUrl = t.menu_img_url || '';
      bgEl.style.backgroundImage = imgUrl ? `url("${imgUrl.replace(/"/g, '%22')}")` : 'none';
      bgEl.style.display = imgUrl ? 'block' : 'none';
    }

    // Cor de fundo
    if (t.menu_theme_color) {
      sc.style.background = t.menu_theme_color;
    } else {
      sc.style.background = '#050810';
    }

    // Nome
    const nomeEl = document.getElementById('avt-menu-nome');
    if (nomeEl) nomeEl.textContent = AVT_STATE.rpg?.name || 'Dungeon';

    // Esconder sub-painel
    const panel = document.getElementById('avt-menu-panel');
    if (panel) panel.style.display = 'none';

    _avtMenuRenderBotoes();
  } catch(e) {
    ocultarLoading();
    mostrarToast('Erro ao abrir menu: ' + (e?.message || e), 'erro');
    _avtMenuFallback(rpgId);
  }
}
window.avtMenuAbrir = avtMenuAbrir;

function _avtMenuFallback(rpgId) {
  mostrarLoading('Carregando dungeon…');
  _avtMostrarAventuraScreen();
  _avtIniciarRTNet(rpgId, _avtIniciarCanvas);
}

function sairAventura() {
  _avtCleanupListeners();
  try { if (AVT_STATE._autoSaveTimer) { clearInterval(AVT_STATE._autoSaveTimer); AVT_STATE._autoSaveTimer = null; } } catch(_) {}
  try { if (typeof RTNet !== 'undefined' && RTNet.initialized) RTNet.shutdown(); } catch(_) {}
  try { if (typeof _avtNpcSyncShutdown === 'function') _avtNpcSyncShutdown(); } catch(_){}
  try { const mm = document.getElementById('avt-minimap'); if (mm) mm.remove(); } catch(_) {}
  const avt = document.getElementById('aventura-screen');
  if (avt) avt.style.display = 'none';
  const menu = document.getElementById('avt-menu-screen');
  if (menu) menu.style.display = 'none';
  document.getElementById('hub').style.display = 'block';
  avtHubRenderSection();
  AVT_STATE.rpgId   = null;
  AVT_STATE.dungeon = null;
  AVT_STATE.entidades = [];
  AVT_STATE.batalhas = [];
  AVT_STATE.mestreReposicionando = null;
  AVT_STATE.aparencias = {};
  AVT_STATE.entAnim = {};
  AVT_STATE.npcTimers = {};
  AVT_STATE.myCharNome = null;
  AVT_STATE.membros = [];
  AVT_STATE._lastFrameTs = 0;
  AVT_MENU_STATE.rpgId = null;
  AVT_MENU_STATE.sessionData = null;
  if (typeof avtInvReset === 'function') avtInvReset();
}
window.sairAventura = sairAventura;

async function voltarAoMenuDeJogo() {
  _avtCleanupListeners();
  try { if (AVT_STATE._autoSaveTimer) { clearInterval(AVT_STATE._autoSaveTimer); AVT_STATE._autoSaveTimer = null; } } catch(_) {}
  try { if (typeof RTNet !== 'undefined' && RTNet.initialized) RTNet.shutdown(); } catch(_) {}
  try { if (typeof _avtNpcSyncShutdown === 'function') _avtNpcSyncShutdown(); } catch(_){}
  try { const mm = document.getElementById('avt-minimap'); if (mm) mm.remove(); } catch(_) {}
  const avt = document.getElementById('aventura-screen');
  if (avt) avt.style.display = 'none';
  const rpgId = AVT_STATE.rpgId;
  AVT_STATE.dungeon = null;
  AVT_STATE.entidades = [];
  AVT_STATE.batalhas = [];
  AVT_STATE.mestreReposicionando = null;
  AVT_STATE.aparencias = {};
  AVT_STATE.entAnim = {};
  AVT_STATE.npcTimers = {};
  AVT_STATE.myCharNome = null;
  AVT_STATE.membros = [];
  AVT_STATE._lastFrameTs = 0;
  if (typeof avtInvReset === 'function') avtInvReset();
  await avtMenuAbrir(rpgId);
}
window.voltarAoMenuDeJogo = voltarAoMenuDeJogo;

// ─────────────────────────────────────────────────────────────────────────────
// BOTÕES DO MENU PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuRenderBotoes() {
  const cont = document.getElementById('avt-menu-botoes');
  if (!cont) return;

  const sd = AVT_MENU_STATE.sessionData || {};
  const temSessao = !!(sd.last_char_nome);
  const t = AVT_STATE.rpg?.theme_json || {};
  const acc = t.destaque || '#c8a84b';

  const botoes = [
    {
      id: 'jogar', label: '▶ Jogar', sub: 'Novo início',
      cor: acc, fn: '_avtMenuAbrirJogar()',
    },
    {
      id: 'continuar', label: '⟳ Continuar', sub: 'Retomar sessão',
      cor: '#4fa3d1', fn: '_avtMenuAbrirContinuar()',
      disabled: !temSessao,
      titulo: temSessao ? '' : 'Sem sessão anterior',
    },
    {
      id: 'fase', label: '🗺 Fase', sub: 'Escolher entrada',
      cor: '#7a92aa', fn: '_avtMenuAbrirFase()',
    },
    {
      id: 'personagem', label: '👤 Personagem', sub: 'Gerenciar fichas',
      cor: '#7a92aa', fn: '_avtMenuAbrirPersonagem()',
    },
    {
      id: 'config', label: '⚙ Config', sub: 'Preferências',
      cor: '#7a92aa', fn: '_avtMenuAbrirConfig()',
    },
    {
      id: 'guia', label: '📖 Guia', sub: 'Como jogar',
      cor: '#7a92aa', fn: '_avtMenuAbrirGuia()',
    },
  ];

  if (AVT_STATE.isMestre) {
    botoes.push({
      id: 'pixi-studio', label: '🎨 Studio', sub: 'Animações de skill',
      cor: '#4fa3d1', fn: '_avtMenuAbrirPixiStudio()',
    });
  }

  cont.innerHTML = botoes.map(b => `
    <button
      id="avt-menu-btn-${b.id}"
      onclick="${b.disabled ? '' : b.fn}"
      title="${b.titulo || ''}"
      style="
        display:flex;align-items:center;gap:14px;
        background:rgba(${_hexToRgb(b.cor)},0.08);
        border:1px solid rgba(${_hexToRgb(b.cor)},${b.disabled ? '0.15' : '0.35'});
        border-radius:10px;padding:13px 20px;cursor:${b.disabled ? 'default' : 'pointer'};
        opacity:${b.disabled ? '0.45' : '1'};
        transition:background .15s,border-color .15s;
        width:100%;text-align:left;
        font-family:var(--fonte-d,serif);
      "
      ${b.disabled ? 'disabled' : ''}
    >
      <div style="flex:1">
        <div style="font-size:0.82rem;color:${b.cor};letter-spacing:.06em;text-transform:uppercase">${b.label}</div>
        <div style="font-size:0.6rem;color:#7a92aa;margin-top:2px;letter-spacing:.04em">${b.sub}</div>
      </div>
      <span style="color:${b.cor};opacity:.5;font-size:0.7rem">›</span>
    </button>
  `).join('');
}

function _hexToRgb(hex) {
  if (!hex || hex.length < 4) return '122,146,170';
  const h = hex.replace('#', '');
  const r = parseInt(h.length === 3 ? h[0]+h[0] : h.slice(0,2), 16);
  const g = parseInt(h.length === 3 ? h[1]+h[1] : h.slice(2,4), 16);
  const b = parseInt(h.length === 3 ? h[2]+h[2] : h.slice(4,6), 16);
  return `${r},${g},${b}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAINEL DESLIZANTE (sub-telas)
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuAbrirPanel(html, titulo) {
  const panel = document.getElementById('avt-menu-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(79,163,209,0.12);flex-shrink:0">
      <button onclick="_avtMenuFecharPanel()" style="background:none;border:1px solid rgba(79,163,209,0.25);border-radius:6px;color:#7a92aa;font-family:var(--fonte-d);font-size:0.62rem;padding:5px 10px;cursor:pointer">← Voltar</button>
      <span style="font-family:var(--fonte-d);font-size:0.78rem;color:#c8d8e8;letter-spacing:.08em;text-transform:uppercase">${titulo}</span>
    </div>
    <div style="padding:18px;flex:1;overflow-y:auto">${html}</div>
  `;
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
}

function _avtMenuFecharPanel() {
  const panel = document.getElementById('avt-menu-panel');
  if (panel) panel.style.display = 'none';
}
window._avtMenuFecharPanel = _avtMenuFecharPanel;

// ─────────────────────────────────────────────────────────────────────────────
// JOGAR — seleção de personagem para novo início
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuAbrirJogar() {
  _avtMenuAbrirPanel(_avtMenuHtmlSeletorChar('_avtMenuEntrarJogar'), 'Selecionar Personagem');
}
window._avtMenuAbrirJogar = _avtMenuAbrirJogar;

function _avtMenuEntrarJogar(charNome) {
  _avtMenuEntrarJogo({ charNome, faseId: 'principal' });
}
window._avtMenuEntrarJogar = _avtMenuEntrarJogar;

// ─────────────────────────────────────────────────────────────────────────────
// CONTINUAR — retoma última sessão
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuAbrirContinuar() {
  const sd = AVT_MENU_STATE.sessionData || {};
  const lastChar = sd.last_char_nome;
  const lastFase = sd.last_fase_id || 'principal';
  if (!lastChar) { mostrarToast('Sem sessão anterior salva', 'aviso'); return; }

  if (AVT_STATE.isMestre) {
    _avtMenuAbrirPanel(_avtMenuHtmlSeletorChar('_avtMenuEntrarContinuarComChar', lastFase), 'Continuar — Escolher Personagem');
  } else {
    _avtMenuEntrarJogo({ charNome: lastChar, faseId: lastFase });
  }
}
window._avtMenuAbrirContinuar = _avtMenuAbrirContinuar;

function _avtMenuEntrarContinuarComChar(charNome) {
  const lastFase = (AVT_MENU_STATE.sessionData || {}).last_fase_id || 'principal';
  _avtMenuEntrarJogo({ charNome, faseId: lastFase });
}
window._avtMenuEntrarContinuarComChar = _avtMenuEntrarContinuarComChar;

// ─────────────────────────────────────────────────────────────────────────────
// FASE — escolher fase e depois personagem
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuAbrirFase() {
  if (AVT_STATE.isMestre) {
    _avtMenuAbrirFaseMestre();
  } else {
    _avtMenuAbrirFaseJogador();
  }
}
window._avtMenuAbrirFase = _avtMenuAbrirFase;

function _avtMenuAbrirFaseJogador() {
  const fases = _avtMenuListarFases();
  const html = `
    <div style="display:flex;flex-direction:column;gap:8px">
      ${fases.map(f => `
        <button onclick="_avtMenuSelecionarFase('${f.id}')"
          style="background:rgba(79,163,209,0.06);border:1px solid rgba(79,163,209,0.2);border-radius:8px;padding:12px 16px;cursor:pointer;text-align:left;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.78rem;letter-spacing:.04em">
          ${f.nome}
        </button>
      `).join('')}
    </div>
  `;
  _avtMenuAbrirPanel(html, 'Escolher Fase');
}

function _avtMenuAbrirFaseMestre() {
  const extras = AVT_STATE.rpg?.theme_json?.fases_extras || [];

  const lockIcon = lt => lt === 'chave' ? '🔑' : lt === 'combate' ? '⚔' : '🔓';

  const html = `
    <div style="display:flex;flex-direction:column;gap:10px">

      <button onclick="_avtMenuNovaFaseComRefresh()"
        style="background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.35);border-radius:8px;padding:11px 16px;cursor:pointer;color:#c8a84b;font-family:var(--fonte-d);font-size:0.72rem;letter-spacing:.06em;text-align:center;width:100%">
        🚪 + Nova Fase
      </button>

      <div style="border-top:1px solid rgba(79,163,209,0.1);margin:4px 0"></div>

      <!-- Fase principal -->
      <div style="display:flex;align-items:center;gap:10px;background:rgba(79,163,209,0.05);border:1px solid rgba(79,163,209,0.15);border-radius:8px;padding:11px 14px">
        <div style="flex:1;font-family:var(--fonte-d);font-size:0.78rem;color:#c8d8e8">🏰 Fase Principal</div>
        <button onclick="_avtMenuSelecionarFase('principal')"
          style="background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#4fa3d1;font-family:var(--fonte-d);font-size:0.6rem;padding:4px 10px;cursor:pointer">▶ Jogar</button>
      </div>

      ${extras.map(f => `
        <div style="display:flex;align-items:center;gap:8px;background:rgba(79,163,209,0.04);border:1px solid rgba(79,163,209,0.12);border-radius:8px;padding:10px 12px">
          <div style="flex:1;min-width:0">
            <div style="font-family:var(--fonte-d);font-size:0.75rem;color:#c8d8e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lockIcon(f.porta?.lock_type)} ${f.nome||f.id}</div>
            <div style="font-size:0.6rem;color:#7a92aa;margin-top:2px">Portal: col ${f.porta?.col??'?'}, row ${f.porta?.row??'?'}</div>
          </div>
          <button onclick="_avtMenuSelecionarFase('${f.id}')"
            style="background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#4fa3d1;font-family:var(--fonte-d);font-size:0.6rem;padding:4px 9px;cursor:pointer;white-space:nowrap">▶ Jogar</button>
          <button onclick="_avtMenuEditarFase('${f.id}')"
            style="background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.3);border-radius:6px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.6rem;padding:4px 9px;cursor:pointer">✏</button>
          <button onclick="_avtMenuRemoverFaseComRefresh('${f.id}')"
            style="background:rgba(232,96,76,0.08);border:1px solid rgba(232,96,76,0.25);border-radius:6px;color:#e8604c;font-family:var(--fonte-d);font-size:0.6rem;padding:4px 9px;cursor:pointer">✕</button>
        </div>
      `).join('')}

      ${extras.length === 0 ? '<p style="font-size:0.68rem;color:#7a92aa;text-align:center;margin:8px 0">Nenhuma fase extra criada.</p>' : ''}
    </div>
  `;
  _avtMenuAbrirPanel(html, '🗺 Fases');
}
window._avtMenuAbrirFaseMestre = _avtMenuAbrirFaseMestre;

function _avtMenuNovaFaseComRefresh() {
  if (typeof _avtMestreNovaFase !== 'function') {
    mostrarToast('Entre na aventura para criar fases pelo mapa.', 'aviso');
    return;
  }
  _avtMestreNovaFase();
  const overlay = document.getElementById('avt-anim-import-overlay');
  if (!overlay) return;
  let _obs = new MutationObserver(() => {
    if (overlay.style.display === 'none' || overlay.style.display === '') {
      _obs.disconnect();
      _obs = null;
      _avtMenuAbrirFaseMestre();
    }
  });
  _obs.observe(overlay, { attributes: true, attributeFilter: ['style'] });
}
window._avtMenuNovaFaseComRefresh = _avtMenuNovaFaseComRefresh;

async function _avtMenuRemoverFaseComRefresh(faseId) {
  if (!confirm('Remover esta fase permanentemente?')) return;
  const theme = AVT_STATE.rpg.theme_json;
  theme.fases_extras = (theme.fases_extras || []).filter(f => f.id !== faseId);
  try {
    await _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AVT_MENU_STATE.rpgId)}`,
      { method: 'PATCH', body: JSON.stringify({ theme_json: theme }) });
    mostrarToast('Fase removida', 'ok');
  } catch(e) {
    mostrarToast('Erro ao remover: ' + (e?.message || e), 'erro');
  }
  _avtMenuAbrirFaseMestre();
}
window._avtMenuRemoverFaseComRefresh = _avtMenuRemoverFaseComRefresh;

function _avtMenuEditarFase(faseId) {
  const extras = AVT_STATE.rpg?.theme_json?.fases_extras || [];
  const f = extras.find(x => x.id === faseId);
  if (!f) return;

  const lockTypes = [
    { id: 'livre',   label: '🔓 Livre' },
    { id: 'chave',   label: '🔑 Chave' },
    { id: 'combate', label: '⚔ Combate' },
  ];

  const html = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div>
        <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Nome da fase</label>
        <input id="avt-edit-fase-nome" type="text" value="${(f.nome||'').replace(/"/g,'&quot;')}"
          style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem;padding:7px 10px;font-family:inherit;box-sizing:border-box">
      </div>

      <div>
        <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:6px">Tipo de lock da porta</label>
        <div style="display:flex;gap:6px">
          ${lockTypes.map(lt => `
            <button onclick="_avtMenuSetEditFaseLock('${lt.id}')"
              id="avt-edit-fase-lock-${lt.id}"
              style="flex:1;padding:7px 6px;border-radius:7px;cursor:pointer;font-size:0.65rem;font-family:var(--fonte-d);
                background:rgba(79,163,209,${(f.porta?.lock_type||'livre')===lt.id?'0.15':'0.04'});
                border:1px solid rgba(79,163,209,${(f.porta?.lock_type||'livre')===lt.id?'0.5':'0.15'});
                color:${(f.porta?.lock_type||'livre')===lt.id?'#4fa3d1':'#7a92aa'}">
              ${lt.label}
            </button>
          `).join('')}
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <div style="flex:1">
          <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Portal — Coluna</label>
          <input id="avt-edit-fase-col" type="number" min="0" value="${f.porta?.col??0}"
            style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem;padding:7px 10px;box-sizing:border-box">
        </div>
        <div style="flex:1">
          <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Portal — Linha</label>
          <input id="avt-edit-fase-row" type="number" min="0" value="${f.porta?.row??0}"
            style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem;padding:7px 10px;box-sizing:border-box">
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <div style="flex:1">
          <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Ordem na campanha</label>
          <input id="avt-edit-fase-ordem" type="number" min="0" value="${f.ordem ?? 1}"
            style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem;padding:7px 10px;box-sizing:border-box">
        </div>
        <div style="flex:1">
          <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Nível dos NPCs</label>
          <input id="avt-edit-fase-npclvl" type="number" min="1" value="${f.npc_level ?? 1}"
            style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem;padding:7px 10px;box-sizing:border-box">
        </div>
      </div>

      <div>
        <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:6px">🌀 Portas internas (teleporte na mesma fase)</label>
        ${(() => {
          const portas = f.dungeon_data?._portasInternas;
          if (!f.dungeon_data) return `<div style="font-size:0.62rem;color:#7a92aa;font-style:italic">Entre na fase uma vez para gerar o mapa antes de editar portas internas.</div>`;
          let h = '';
          (portas || []).forEach((p, i) => {
            h += `<div style="display:flex;gap:5px;align-items:center;margin-bottom:5px">
              <input id="avt-pi-nome-${i}" value="${(p.nome||('Porta '+(p.numero??i+2))).replace(/"/g,'&quot;')}" placeholder="Nome"
                style="flex:1;min-width:50px;background:rgba(255,255,255,0.04);border:1px solid rgba(168,120,255,0.25);border-radius:5px;color:#c8b8e8;font-size:0.66rem;padding:5px 7px;box-sizing:border-box">
              <input id="avt-pi-acol-${i}" type="number" value="${p.a?.col??0}" title="A coluna" style="width:46px;background:rgba(255,255,255,0.04);border:1px solid rgba(168,120,255,0.25);border-radius:5px;color:#c8b8e8;font-size:0.66rem;padding:5px 4px;text-align:center">
              <input id="avt-pi-arow-${i}" type="number" value="${p.a?.row??0}" title="A linha" style="width:46px;background:rgba(255,255,255,0.04);border:1px solid rgba(168,120,255,0.25);border-radius:5px;color:#c8b8e8;font-size:0.66rem;padding:5px 4px;text-align:center">
              <span style="color:#a878ff;font-size:0.7rem">↔</span>
              <input id="avt-pi-bcol-${i}" type="number" value="${p.b?.col??0}" title="B coluna" style="width:46px;background:rgba(255,255,255,0.04);border:1px solid rgba(168,120,255,0.25);border-radius:5px;color:#c8b8e8;font-size:0.66rem;padding:5px 4px;text-align:center">
              <input id="avt-pi-brow-${i}" type="number" value="${p.b?.row??0}" title="B linha" style="width:46px;background:rgba(255,255,255,0.04);border:1px solid rgba(168,120,255,0.25);border-radius:5px;color:#c8b8e8;font-size:0.66rem;padding:5px 4px;text-align:center">
              <button onclick="_avtMenuRemovePortaInterna('${faseId}',${i})" style="background:rgba(232,96,76,0.1);border:1px solid rgba(232,96,76,0.3);border-radius:5px;color:#e8604c;font-size:0.7rem;padding:3px 7px;cursor:pointer">✕</button>
            </div>`;
          });
          if (!(portas||[]).length) h += `<div style="font-size:0.62rem;color:#7a92aa;font-style:italic;margin-bottom:5px">Nenhuma porta interna.</div>`;
          h += `<button onclick="_avtMenuAddPortaInterna('${faseId}')" style="width:100%;background:rgba(168,120,255,0.1);border:1px solid rgba(168,120,255,0.3);border-radius:6px;color:#a878ff;font-size:0.64rem;padding:6px;cursor:pointer;font-family:var(--fonte-d)">＋ Adicionar porta interna</button>`;
          return h;
        })()}
        <div style="font-size:0.58rem;color:#7a92aa;margin-top:4px">O nome é único por par e se aplica às duas pontas (porta irmã).</div>
      </div>

      <div style="display:flex;gap:8px;margin-top:4px">
        <button onclick="_avtMenuAbrirFaseMestre()"
          style="flex:1;padding:9px;border-radius:7px;cursor:pointer;font-family:var(--fonte-d);font-size:0.68rem;background:none;border:1px solid rgba(122,146,170,0.2);color:#7a92aa">
          ← Cancelar
        </button>
        <button onclick="_avtMenuSalvarEditarFase('${faseId}')"
          style="flex:1;padding:9px;border-radius:7px;cursor:pointer;font-family:var(--fonte-d);font-size:0.68rem;background:rgba(79,163,209,0.12);border:1px solid rgba(79,163,209,0.4);color:#4fa3d1">
          ✓ Salvar
        </button>
      </div>
    </div>
  `;

  window._avtEditFaseLockAtual = f.porta?.lock_type || 'livre';
  _avtMenuAbrirPanel(html, `✏ Editar: ${f.nome||faseId}`);
}
window._avtMenuEditarFase = _avtMenuEditarFase;

function _avtMenuSetEditFaseLock(lockType) {
  window._avtEditFaseLockAtual = lockType;
  ['livre','chave','combate'].forEach(lt => {
    const btn = document.getElementById(`avt-edit-fase-lock-${lt}`);
    if (!btn) return;
    const ativo = lt === lockType;
    btn.style.background = `rgba(79,163,209,${ativo?'0.15':'0.04'})`;
    btn.style.borderColor = `rgba(79,163,209,${ativo?'0.5':'0.15'})`;
    btn.style.color = ativo ? '#4fa3d1' : '#7a92aa';
  });
}
window._avtMenuSetEditFaseLock = _avtMenuSetEditFaseLock;

// Lê as portas internas atualmente nos inputs do editor para o array da fase.
function _avtMenuLerPortasInternasEditor(fase) {
  if (!fase?.dungeon_data) return;
  const arr = [];
  for (let i = 0; ; i++) {
    const nomeEl = document.getElementById('avt-pi-nome-' + i);
    if (!nomeEl) break;
    const num = i + 2;
    arr.push({
      numero: num,
      nome: (nomeEl.value || ('Porta ' + num)).trim(),
      a: { col: parseInt(document.getElementById('avt-pi-acol-'+i)?.value||'0',10), row: parseInt(document.getElementById('avt-pi-arow-'+i)?.value||'0',10) },
      b: { col: parseInt(document.getElementById('avt-pi-bcol-'+i)?.value||'0',10), row: parseInt(document.getElementById('avt-pi-brow-'+i)?.value||'0',10) },
    });
  }
  fase.dungeon_data._portasInternas = arr;
}

function _avtMenuAddPortaInterna(faseId) {
  const fase = (AVT_STATE.rpg?.theme_json?.fases_extras || []).find(f => f.id === faseId);
  if (!fase?.dungeon_data) { mostrarToast('Entre na fase uma vez para gerar o mapa.', 'aviso'); return; }
  _avtMenuLerPortasInternasEditor(fase);
  if (!Array.isArray(fase.dungeon_data._portasInternas)) fase.dungeon_data._portasInternas = [];
  const num = fase.dungeon_data._portasInternas.length + 2;
  fase.dungeon_data._portasInternas.push({ numero: num, nome: 'Porta ' + num, a: { col: 1, row: 1 }, b: { col: 2, row: 2 } });
  _avtMenuEditarFase(faseId);
}
window._avtMenuAddPortaInterna = _avtMenuAddPortaInterna;

function _avtMenuRemovePortaInterna(faseId, idx) {
  const fase = (AVT_STATE.rpg?.theme_json?.fases_extras || []).find(f => f.id === faseId);
  if (!fase?.dungeon_data) return;
  _avtMenuLerPortasInternasEditor(fase);
  (fase.dungeon_data._portasInternas || []).splice(idx, 1);
  // Renumerar de 2 em diante
  (fase.dungeon_data._portasInternas || []).forEach((p, i) => {
    const oldName = p.nome, defName = 'Porta ' + (p.numero ?? i+2);
    p.numero = i + 2;
    if (!oldName || oldName === defName) p.nome = 'Porta ' + p.numero;
  });
  _avtMenuEditarFase(faseId);
}
window._avtMenuRemovePortaInterna = _avtMenuRemovePortaInterna;

async function _avtMenuSalvarEditarFase(faseId) {
  const nome = document.getElementById('avt-edit-fase-nome')?.value?.trim();
  const col  = parseInt(document.getElementById('avt-edit-fase-col')?.value || '0', 10);
  const row  = parseInt(document.getElementById('avt-edit-fase-row')?.value || '0', 10);
  const ordem = parseInt(document.getElementById('avt-edit-fase-ordem')?.value || '1', 10);
  const npcLvl = Math.max(1, parseInt(document.getElementById('avt-edit-fase-npclvl')?.value || '1', 10));
  const lockType = window._avtEditFaseLockAtual || 'livre';

  if (!nome) { mostrarToast('Nome obrigatório', 'aviso'); return; }

  const theme = AVT_STATE.rpg.theme_json;
  const fase = (theme.fases_extras || []).find(f => f.id === faseId);
  if (!fase) return;

  fase.nome = nome;
  fase.ordem = ordem;
  fase.npc_level = npcLvl;
  fase.porta = { ...(fase.porta || {}), lock_type: lockType, col, row };
  _avtMenuLerPortasInternasEditor(fase);
  if (fase.dungeon_data) fase.dungeon_data._npcLevel = npcLvl;

  try {
    await _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AVT_MENU_STATE.rpgId)}`,
      { method: 'PATCH', body: JSON.stringify({ theme_json: theme }) });
    mostrarToast('Fase atualizada!', 'ok');
  } catch(e) {
    mostrarToast('Erro ao salvar: ' + (e?.message || e), 'erro');
  }
  _avtMenuAbrirFaseMestre();
}
window._avtMenuSalvarEditarFase = _avtMenuSalvarEditarFase;

function _avtMenuSelecionarFase(faseId) {
  _avtMenuAbrirPanel(_avtMenuHtmlSeletorChar('_avtMenuEntrarFaseComChar', faseId), 'Selecionar Personagem');
}
window._avtMenuSelecionarFase = _avtMenuSelecionarFase;

function _avtMenuEntrarFaseComChar(charNome, faseId) {
  _avtMenuEntrarJogo({ charNome, faseId });
}
window._avtMenuEntrarFaseComChar = _avtMenuEntrarFaseComChar;

function _avtMenuListarFases() {
  const fases = [{ id: 'principal', nome: '🏰 Fase Principal' }];
  const extras = AVT_STATE.rpg?.theme_json?.fases_extras || [];
  extras.forEach(f => fases.push({ id: f.id, nome: f.nome || f.id }));
  return fases;
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSONAGEM — painel de gerenciamento sem entrar no jogo
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuAbrirPersonagem() {
  const chars = _avtMenuCharsVisiveis();
  const html = `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${chars.map(ch => {
        const ca = ch.custom_attrs || {};
        const cor = ca.cor || '#4fa3d1';
        return `
          <div style="display:flex;align-items:center;gap:12px;background:rgba(79,163,209,0.05);border:1px solid rgba(79,163,209,0.15);border-radius:8px;padding:12px 14px">
            <div style="width:36px;height:36px;border-radius:50%;background:${cor};display:flex;align-items:center;justify-content:center;font-size:1rem;color:#fff;flex-shrink:0">${(ch.nome||'?')[0].toUpperCase()}</div>
            <div style="flex:1">
              <div style="font-family:var(--fonte-d);font-size:0.78rem;color:#c8d8e8">${ch.nome}</div>
              <div style="font-size:0.62rem;color:#7a92aa;margin-top:2px">${ca.classe||''} ${ca.raca ? '· '+ca.raca : ''} · Nv ${ch.nivel||1}</div>
            </div>
            <button onclick="_avtMenuEditarChar('${ch.id}','${ch.nome.replace(/'/g,"\\'")}')" style="background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#4fa3d1;font-family:var(--fonte-d);font-size:0.6rem;padding:4px 10px;cursor:pointer">Editar</button>
          </div>
        `;
      }).join('')}
      <button onclick="_avtMenuCriarPersonagem()" style="background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.3);border-radius:8px;padding:12px;cursor:pointer;color:#c8a84b;font-family:var(--fonte-d);font-size:0.72rem;letter-spacing:.06em;text-align:center;width:100%">+ Novo Personagem</button>
    </div>
  `;
  _avtMenuAbrirPanel(html, 'Personagens');
}
window._avtMenuAbrirPersonagem = _avtMenuAbrirPersonagem;

function _avtMenuEditarChar(charId, charNome) {
  // Injeta entidade stub para o editor de personagem funcionar fora do jogo
  const tempId = 'menu-temp-' + charId;
  if (!AVT_STATE.entidades.find(e => e.id === tempId)) {
    const dbChar = (AVT_STATE.chars || []).find(c => c.id === charId) || {};
    const ca = dbChar.custom_attrs || {};
    AVT_STATE.entidades.push({
      id: tempId, dbId: charId, nome: charNome, tipo: 'jogador',
      hp: dbChar.hp_atual || 100, hpMax: _avtCalcHpJog(dbChar) || 100,
      nivel: dbChar.nivel || 1, x: 0, y: 0, cor: ca.cor || '#4fa3d1',
      custom_attrs: ca,
    });
  }
  if (typeof abrirAvtCharEditor === 'function') abrirAvtCharEditor(tempId);
}
window._avtMenuEditarChar = _avtMenuEditarChar;

async function _avtMenuCriarPersonagem() {
  const nome = prompt('Nome do novo personagem:');
  if (!nome || !nome.trim()) return;
  try {
    const uid = SESSION?.user?.id;
    const nick = SESSION?.user?.email || SESSION?.nickname || 'Jogador';
    const novoChar = {
      rpg_id: AVT_MENU_STATE.rpgId,
      nome: nome.trim(),
      hp_atual: 100, hp_max: 100, xp: 0, nivel: 1, pontos_attr: 0,
      custom_attrs: { tipo: 'jogador', cor: '#4fa3d1' }
    };
    const res = await _avtSb('characters', { method: 'POST', body: JSON.stringify(novoChar) });
    // Atribuir ao usuário
    if (uid) {
      await _avtSb(`rpg_members?rpg_id=eq.${encodeURIComponent(AVT_MENU_STATE.rpgId)}&player_id=eq.${encodeURIComponent(uid)}`,
        { method: 'PATCH', body: JSON.stringify({ linked: nome.trim() }) });
    }
    // Recarregar chars
    const chars = await _avtSb(`characters?rpg_id=eq.${encodeURIComponent(AVT_MENU_STATE.rpgId)}&select=*&order=nome`);
    if (chars) AVT_STATE.chars = chars;
    mostrarToast(`Personagem "${nome.trim()}" criado!`, 'ok');
    _avtMenuAbrirPersonagem();
  } catch(e) {
    mostrarToast('Erro ao criar personagem: ' + (e?.message || e), 'erro');
  }
}
window._avtMenuCriarPersonagem = _avtMenuCriarPersonagem;

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuAbrirConfig() {
  if (AVT_STATE.isMestre) {
    _avtMenuAbrirConfigMestre(AVT_MENU_STATE.configAba || 'menu');
  } else {
    _avtMenuAbrirPanel(_avtMenuHtmlConfigJogador(), '⚙ Configurações');
    _avtMenuBindColorPicker();
  }
}
window._avtMenuAbrirConfig = _avtMenuAbrirConfig;

function _avtMenuAbrirConfigMestre(aba) {
  AVT_MENU_STATE.configAba = aba;
  const abas = [
    { id: 'menu',          label: '🖼 Menu' },
    { id: 'balanceamento', label: '⚖ Balanço' },
    { id: 'npcs',          label: '🤖 NPCs' },
    { id: 'campanha',      label: '🏰 Campanha' },
    { id: 'jogadores',     label: '👥 Jogadores' },
    { id: 'personagens',   label: '👤 Personagens' },
    { id: 'jogador',       label: '🎮 Player' },
  ];

  const tabBar = `
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px">
      ${abas.map(a => `
        <button onclick="_avtMenuAbrirConfigMestre('${a.id}')"
          style="padding:5px 10px;border-radius:6px;cursor:pointer;font-family:var(--fonte-d);font-size:0.6rem;letter-spacing:.05em;white-space:nowrap;
            background:rgba(79,163,209,${aba===a.id?'0.15':'0.05'});
            border:1px solid rgba(79,163,209,${aba===a.id?'0.5':'0.18'});
            color:${aba===a.id?'#4fa3d1':'#7a92aa'}">
          ${a.label}
        </button>
      `).join('')}
    </div>
  `;

  const content = _avtMenuConfigConteudoAba(aba);
  _avtMenuAbrirPanel(tabBar + content, '⚙ Configurações');

  if (aba === 'menu') _avtMenuBindColorPicker();
}
window._avtMenuAbrirConfigMestre = _avtMenuAbrirConfigMestre;

function _avtMenuConfigConteudoAba(aba) {
  if (aba === 'menu') {
    const t = AVT_STATE.rpg?.theme_json || {};
    return `
      <div style="margin-bottom:20px">
        <div style="font-family:var(--fonte-d);font-size:0.65rem;color:rgba(200,168,75,0.7);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px">⚙ Aparência do Menu</div>

        <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Imagem de fundo (URL)</label>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <input id="avt-cfg-menu-img" type="url" placeholder="https://..." value="${t.menu_img_url||''}"
            style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.7rem;padding:6px 10px;font-family:inherit">
          <button onclick="_avtMenuUploadImagem()" style="background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#4fa3d1;font-size:0.65rem;padding:6px 10px;cursor:pointer;white-space:nowrap">📁 Upload</button>
        </div>

        <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Cor do tema</label>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <input id="avt-cfg-menu-color" type="color" value="${t.menu_theme_color||'#050810'}"
            style="width:40px;height:32px;border:none;border-radius:6px;cursor:pointer;background:none">
          <span id="avt-cfg-menu-color-val" style="font-size:0.68rem;color:#7a92aa">${t.menu_theme_color||'#050810'}</span>
        </div>

        <div style="font-family:var(--fonte-d);font-size:0.65rem;color:rgba(200,168,75,0.7);text-transform:uppercase;letter-spacing:.08em;margin:18px 0 12px;border-top:1px solid rgba(79,163,209,0.12);padding-top:14px">🗺 Grade do Mapa</div>

        <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Cor das linhas</label>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <input id="avt-cfg-grid-color" type="color" value="${t.grid_cor||'#ffffff'}"
            style="width:40px;height:32px;border:none;border-radius:6px;cursor:pointer;background:none">
          <span id="avt-cfg-grid-color-val" style="font-size:0.68rem;color:#7a92aa">${t.grid_cor||'#ffffff'}</span>
        </div>

        <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Opacidade das linhas</label>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
          <input id="avt-cfg-grid-op" type="range" min="0" max="0.5" step="0.01" value="${t.grid_opacidade ?? 0.09}"
            style="flex:1;cursor:pointer;accent-color:#c8a84b">
          <span id="avt-cfg-grid-op-val" style="font-size:0.68rem;color:#7a92aa;min-width:34px;text-align:right">${(t.grid_opacidade ?? 0.09).toFixed(2)}</span>
        </div>
        <div style="font-size:0.62rem;color:#5a6b7a;margin-bottom:16px">Opacidade 0 = grade invisível (campo sem separação por células).</div>

        <button onclick="_avtMenuSalvarConfigMestre()" style="background:rgba(200,168,75,0.12);border:1px solid rgba(200,168,75,0.4);border-radius:7px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.7rem;padding:8px 20px;cursor:pointer;letter-spacing:.06em;text-transform:uppercase;width:100%">Salvar</button>
      </div>
    `;
  }

  if (aba === 'jogador') {
    return _avtMenuHtmlConfigJogador();
  }

  // Abas do painel do mestre: reutiliza _avtMpConteudoAba()
  if (typeof _avtMpConteudoAba !== 'function') {
    return '<p style="color:#7a92aa;font-size:0.72rem">Módulo do mestre não carregado.</p>';
  }
  const prevAba = AVT_STATE.mestrePainelAba;
  AVT_STATE.mestrePainelAba = aba;
  const html = _avtMpConteudoAba();
  AVT_STATE.mestrePainelAba = prevAba;
  return html;
}
window._avtMenuConfigConteudoAba = _avtMenuConfigConteudoAba;

function _avtMenuHtmlConfigJogador() {
  const sd = AVT_MENU_STATE.sessionData || {};
  const mp = sd.music_pref || { mode: 'auto' };
  const mb = sd.mobile_pref || { tipo: 'dispositivo', posicao: 'centralizado' };

  const modosMusica = [
    { id: 'auto',   label: '🔀 Automático',    sub: 'Seleção automática do sistema' },
    { id: 'master', label: '🎵 Seguir Mestre',  sub: 'Usa a seleção definida pelo mestre' },
    { id: 'custom', label: '🎶 Personalizar',   sub: 'Escolha suas trilhas' },
  ];

  const trilhasCustom = `
    <div id="avt-cfg-trilhas" style="display:${mp.mode==='custom' ? 'block' : 'none'};margin-top:12px;background:rgba(79,163,209,0.03);border:1px solid rgba(79,163,209,0.1);border-radius:8px;padding:12px">
      ${['exploracao','combate','boss'].map(ctx => {
        const tracks = DEFAULT_SOUNDTRACKS?.[ctx] || [];
        const sel = (mp.tracks || {})[ctx+'_url'] || '';
        return `
          <div style="margin-bottom:10px">
            <label style="display:block;font-size:0.62rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">${ctx}</label>
            <select id="avt-cfg-track-${ctx}" style="width:100%;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.68rem;padding:5px 8px">
              <option value="">— padrão —</option>
              ${tracks.map(tr => `<option value="${tr.url}" ${sel===tr.url?'selected':''}>${tr.label}</option>`).join('')}
            </select>
          </div>
        `;
      }).join('')}
    </div>
  `;

  return `
    <div style="margin-bottom:20px">
      <div style="font-family:var(--fonte-d);font-size:0.65rem;color:rgba(79,163,209,0.7);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">🎵 Música</div>
      <div style="display:flex;flex-direction:column;gap:6px" id="avt-cfg-musica-opts">
        ${modosMusica.map(m => `
          <button onclick="_avtMenuSelecionarMusicaMode('${m.id}')"
            id="avt-cfg-music-${m.id}"
            style="display:flex;align-items:center;gap:10px;background:rgba(79,163,209,${mp.mode===m.id?'0.12':'0.04'});border:1px solid rgba(79,163,209,${mp.mode===m.id?'0.45':'0.15'});border-radius:8px;padding:10px 14px;cursor:pointer;text-align:left;width:100%">
            <div style="flex:1">
              <div style="font-size:0.75rem;color:#c8d8e8;font-family:var(--fonte-d)">${m.label}</div>
              <div style="font-size:0.6rem;color:#7a92aa;margin-top:2px">${m.sub}</div>
            </div>
            ${mp.mode===m.id ? '<span style="color:#4fa3d1;font-size:0.7rem">✓</span>' : ''}
          </button>
        `).join('')}
      </div>
      ${trilhasCustom}
    </div>

    <div style="border-top:1px solid rgba(79,163,209,0.1);margin-bottom:16px"></div>

    <div style="margin-bottom:20px">
      <div style="font-family:var(--fonte-d);font-size:0.65rem;color:rgba(79,163,209,0.7);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">🎮 Controle Mobile</div>

      <div style="margin-bottom:8px">
        <div style="font-size:0.62rem;color:#7a92aa;margin-bottom:6px">Dispositivo</div>
        <div style="display:flex;gap:8px">
          ${['dispositivo','tv'].map(t2 => `
            <button onclick="_avtMenuSetMobilePref('tipo','${t2}')"
              id="avt-cfg-mobile-tipo-${t2}"
              style="flex:1;padding:8px;border-radius:7px;cursor:pointer;font-size:0.7rem;font-family:var(--fonte-d);
                background:rgba(79,163,209,${mb.tipo===t2?'0.12':'0.04'});
                border:1px solid rgba(79,163,209,${mb.tipo===t2?'0.45':'0.15'});
                color:${mb.tipo===t2?'#4fa3d1':'#7a92aa'}">
              ${t2==='dispositivo' ? '📱 No dispositivo' : '📺 Na TV'}
            </button>
          `).join('')}
        </div>
      </div>

      <div>
        <div style="font-size:0.62rem;color:#7a92aa;margin-bottom:6px">Posição do D-pad</div>
        <div style="display:flex;gap:8px">
          ${['centralizado','deadzone'].map(p => `
            <button onclick="_avtMenuSetMobilePref('posicao','${p}')"
              id="avt-cfg-mobile-pos-${p}"
              style="flex:1;padding:8px;border-radius:7px;cursor:pointer;font-size:0.7rem;font-family:var(--fonte-d);
                background:rgba(79,163,209,${mb.posicao===p?'0.12':'0.04'});
                border:1px solid rgba(79,163,209,${mb.posicao===p?'0.45':'0.15'});
                color:${mb.posicao===p?'#4fa3d1':'#7a92aa'}">
              ${p==='centralizado' ? '⊕ Centralizado' : '↔ Dead Zone'}
            </button>
          `).join('')}
        </div>
      </div>
    </div>

    <button onclick="_avtMenuSalvarConfigJogador()" style="background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.35);border-radius:7px;color:#4fa3d1;font-family:var(--fonte-d);font-size:0.7rem;padding:8px 20px;cursor:pointer;letter-spacing:.06em;text-transform:uppercase;width:100%">Salvar Configurações</button>
  `;
}

function _avtMenuBindColorPicker() {
  setTimeout(() => {
    const colorInp = document.getElementById('avt-cfg-menu-color');
    if (colorInp) {
      colorInp.addEventListener('input', () => {
        const val = document.getElementById('avt-cfg-menu-color-val');
        if (val) val.textContent = colorInp.value;
      });
    }
    const gridColorInp = document.getElementById('avt-cfg-grid-color');
    if (gridColorInp) {
      gridColorInp.addEventListener('input', () => {
        const val = document.getElementById('avt-cfg-grid-color-val');
        if (val) val.textContent = gridColorInp.value;
      });
    }
    const gridOpInp = document.getElementById('avt-cfg-grid-op');
    if (gridOpInp) {
      gridOpInp.addEventListener('input', () => {
        const val = document.getElementById('avt-cfg-grid-op-val');
        if (val) val.textContent = parseFloat(gridOpInp.value).toFixed(2);
      });
    }
  }, 50);
}

function _avtMenuSelecionarMusicaMode(modo) {
  const sd = AVT_MENU_STATE.sessionData || {};
  sd.music_pref = sd.music_pref || {};
  sd.music_pref.mode = modo;
  AVT_MENU_STATE.sessionData = sd;
  const trilhas = document.getElementById('avt-cfg-trilhas');
  if (trilhas) trilhas.style.display = modo === 'custom' ? 'block' : 'none';
  ['auto','master','custom'].forEach(m => {
    const btn = document.getElementById(`avt-cfg-music-${m}`);
    if (!btn) return;
    const ativo = m === modo;
    btn.style.background = `rgba(79,163,209,${ativo?'0.12':'0.04'})`;
    btn.style.borderColor = `rgba(79,163,209,${ativo?'0.45':'0.15'})`;
  });
}
window._avtMenuSelecionarMusicaMode = _avtMenuSelecionarMusicaMode;

function _avtMenuSetMobilePref(chave, valor) {
  const sd = AVT_MENU_STATE.sessionData || {};
  sd.mobile_pref = sd.mobile_pref || {};
  sd.mobile_pref[chave] = valor;
  AVT_MENU_STATE.sessionData = sd;
  const grupo = chave === 'tipo' ? ['dispositivo','tv'] : ['centralizado','deadzone'];
  const prefixo = chave === 'tipo' ? 'avt-cfg-mobile-tipo-' : 'avt-cfg-mobile-pos-';
  grupo.forEach(v => {
    const btn = document.getElementById(prefixo + v);
    if (!btn) return;
    const ativo = v === valor;
    btn.style.background = `rgba(79,163,209,${ativo?'0.12':'0.04'})`;
    btn.style.borderColor = `rgba(79,163,209,${ativo?'0.45':'0.15'})`;
    btn.style.color = ativo ? '#4fa3d1' : '#7a92aa';
  });
}
window._avtMenuSetMobilePref = _avtMenuSetMobilePref;

async function _avtMenuSalvarConfigMestre() {
  if (!AVT_STATE.isMestre) return;
  const imgUrl   = document.getElementById('avt-cfg-menu-img')?.value || '';
  const color    = document.getElementById('avt-cfg-menu-color')?.value || '';
  const gridCor  = document.getElementById('avt-cfg-grid-color')?.value || '#ffffff';
  const gridOpEl = document.getElementById('avt-cfg-grid-op');
  const gridOp   = gridOpEl ? parseFloat(gridOpEl.value) : 0.09;
  try {
    const themeAtual = AVT_STATE.rpg?.theme_json || {};
    const novoTheme = { ...themeAtual, menu_img_url: imgUrl, menu_theme_color: color, grid_cor: gridCor, grid_opacidade: gridOp };
    await _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AVT_MENU_STATE.rpgId)}`,
      { method: 'PATCH', body: JSON.stringify({ theme_json: novoTheme }) });
    AVT_STATE.rpg.theme_json = novoTheme;
    // Atualizar menu visualmente
    const bgEl = document.getElementById('avt-menu-bg-img');
    if (bgEl) { bgEl.style.backgroundImage = imgUrl ? `url("${imgUrl}")` : 'none'; bgEl.style.display = imgUrl ? 'block' : 'none'; }
    const sc = document.getElementById('avt-menu-screen');
    if (sc && color) sc.style.background = color;
    mostrarToast('Config do mestre salva!', 'ok');
  } catch(e) { mostrarToast('Erro ao salvar: ' + (e?.message||e), 'erro'); }
}
window._avtMenuSalvarConfigMestre = _avtMenuSalvarConfigMestre;

async function _avtMenuSalvarConfigJogador() {
  const sd = AVT_MENU_STATE.sessionData || {};

  // Coletar seleções de trilhas custom
  if ((sd.music_pref || {}).mode === 'custom') {
    sd.music_pref.tracks = sd.music_pref.tracks || {};
    ['exploracao','combate','boss'].forEach(ctx => {
      const sel = document.getElementById(`avt-cfg-track-${ctx}`);
      if (sel) sd.music_pref.tracks[ctx+'_url'] = sel.value;
    });
  }

  AVT_MENU_STATE.sessionData = sd;
  await _avtMenuSalvarSessionData(sd);

  // Aplicar controle mobile imediatamente se disponível
  const mb = sd.mobile_pref || {};
  if (typeof MOBILE_CTRL !== 'undefined') {
    if (mb.tipo)    MOBILE_CTRL.modoTela   = mb.tipo;
    if (mb.posicao) MOBILE_CTRL.modoCamara = mb.posicao === 'deadzone' ? 'deadzone' : 'centralizada';
  }
  mostrarToast('Configurações salvas!', 'ok');
}
window._avtMenuSalvarConfigJogador = _avtMenuSalvarConfigJogador;

async function _avtMenuUploadImagem() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    mostrarToast('Upload de imagem não suportado diretamente — use uma URL pública', 'aviso', 4000);
  };
  input.click();
}
window._avtMenuUploadImagem = _avtMenuUploadImagem;

// ─────────────────────────────────────────────────────────────────────────────
// GUIA
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuAbrirGuia() {
  const html = `
    <div style="font-family:var(--fonte-d);color:#c8d8e8;display:flex;flex-direction:column;gap:20px;max-width:600px">

      <section>
        <div style="font-size:0.65rem;color:#c8a84b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">🎮 Movimento</div>
        <p style="font-size:0.72rem;color:#7a92aa;line-height:1.6">Use <b style="color:#c8d8e8">WASD</b> ou as <b style="color:#c8d8e8">setas do teclado</b> para mover seu personagem pelo dungeon. No celular, use o <b style="color:#c8d8e8">D-pad</b> que aparece na tela. Clique em qualquer ponto do mapa para mover até lá.</p>
      </section>

      <section>
        <div style="font-size:0.65rem;color:#c8a84b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">⚔ Combate</div>
        <p style="font-size:0.72rem;color:#7a92aa;line-height:1.6">Ao se aproximar de um inimigo, ele ficará em <b style="color:#c8d8e8">modo de alerta</b>. Se a paciência dele acabar, ele inicia <b style="color:#c8d8e8">perseguição</b>. Quando próximo, aparecerá um convite de combate. Aceite para entrar no modo de <b style="color:#c8d8e8">turno por turno</b>.</p>
      </section>

      <section>
        <div style="font-size:0.65rem;color:#c8a84b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">💫 Skills e Cooldowns</div>
        <p style="font-size:0.72rem;color:#7a92aa;line-height:1.6">Durante o combate, você verá suas <b style="color:#c8d8e8">habilidades</b> disponíveis. Cada habilidade tem um <b style="color:#c8d8e8">cooldown</b> medido em turnos. Habilidades em cooldown aparecem com contador.</p>
      </section>

      <section>
        <div style="font-size:0.65rem;color:#c8a84b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">🗺 Fases e Portais</div>
        <p style="font-size:0.72rem;color:#7a92aa;line-height:1.6">Portas especiais levam a <b style="color:#c8d8e8">fases adicionais</b>. Cada fase tem seus próprios inimigos e recompensas. Use <b style="color:#c8d8e8">saídas</b> marcadas no mapa para retornar à fase anterior.</p>
      </section>

      <section>
        <div style="font-size:0.65rem;color:#c8a84b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">❤ HP, Mana e XP</div>
        <p style="font-size:0.72rem;color:#7a92aa;line-height:1.6">Seu <b style="color:#c8d8e8">HP</b> regenera lentamente fora de combate. A <b style="color:#c8d8e8">Mana</b> é consumida por habilidades especiais e também regenera. Derrotar inimigos concede <b style="color:#c8d8e8">XP</b> para ganhar níveis e pontos de atributo.</p>
      </section>

      <section>
        <div style="font-size:0.65rem;color:#c8a84b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">🌐 Host</div>
        <p style="font-size:0.72rem;color:#7a92aa;line-height:1.6">O <b style="color:#c8d8e8">host</b> é o jogador que coordena a sessão. Geralmente é o primeiro a entrar ou aquele que clica em "Iniciar como Host". Ao mudar de fase, pode ser necessário eleger um novo host para aquela fase.</p>
      </section>

    </div>
  `;
  _avtMenuAbrirPanel(html, '📖 Guia do Jogo');
}
window._avtMenuAbrirGuia = _avtMenuAbrirGuia;

// ─────────────────────────────────────────────────────────────────────────────
// STUDIO PIXI
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuAbrirPixiStudio() {
  const menu = document.getElementById('avt-menu-screen');
  if (menu) menu.style.display = 'none';
  const scr = document.getElementById('pixi-studio-screen');
  if (scr) scr.style.display = 'flex';
  if (typeof PIXI_STUDIO_STATE !== 'undefined') PIXI_STUDIO_STATE._origin = 'aventura';
  if (typeof pixiStudioInit === 'function') pixiStudioInit();
}
window._avtMenuAbrirPixiStudio = _avtMenuAbrirPixiStudio;

// ─────────────────────────────────────────────────────────────────────────────
// ENTRAR NO JOGO
// ─────────────────────────────────────────────────────────────────────────────

async function _avtMenuEntrarJogo({ charNome, faseId }) {
  try {
    const rpgId = AVT_MENU_STATE.rpgId;
    if (!rpgId) { mostrarToast('Sem aventura carregada', 'erro'); return; }

    mostrarLoading('Iniciando…');

    // Salvar sessão
    await _avtMenuSalvarSessionData({
      last_char_nome: charNome,
      last_fase_id: faseId || 'principal',
    });

    // Vincular personagem
    if (charNome) {
      const uid = SESSION?.user?.id;
      if (AVT_STATE.isMestre) {
        AVT_STATE.mestreAtivo = true;
      } else if (uid) {
        await _avtSb(
          `rpg_members?rpg_id=eq.${encodeURIComponent(rpgId)}&player_id=eq.${encodeURIComponent(uid)}`,
          { method: 'PATCH', body: JSON.stringify({ linked: charNome }) }
        ).catch(() => {});
      }
      AVT_STATE.myCharNome = charNome;
    }

    // Aplicar preferências de controle mobile
    const mb = (AVT_MENU_STATE.sessionData || {}).mobile_pref || {};
    if (typeof MOBILE_CTRL !== 'undefined') {
      if (mb.tipo)    MOBILE_CTRL.modoTela   = mb.tipo;
      if (mb.posicao) MOBILE_CTRL.modoCamara = mb.posicao === 'deadzone' ? 'deadzone' : 'centralizada';
    }

    // Aplicar preferência de música
    const mp = (AVT_MENU_STATE.sessionData || {}).music_pref || {};
    if (typeof AudioManager !== 'undefined' && mp.mode && mp.mode !== 'auto') {
      window._avtMenuPlayerMusicPref = mp;
      if (mp.mode === 'custom' && mp.tracks) {
        AudioManager.setPlayerPref(mp);
      }
    } else {
      delete window._avtMenuPlayerMusicPref;
    }

    _avtMostrarAventuraScreen();

    // Se há fase específica não-principal, entrar depois do canvas
    const faseAlvo = faseId && faseId !== 'principal' ? faseId : null;

    _avtIniciarRTNet(rpgId, () => {
      _avtIniciarCanvas();
      if (faseAlvo) {
        setTimeout(() => {
          if (typeof _avtIrParaFase === 'function') _avtIrParaFase(faseAlvo);
        }, 800);
      }
    });

  } catch(e) {
    ocultarLoading();
    mostrarToast('Erro ao entrar: ' + (e?.message || e), 'erro');
  }
}
window._avtMenuEntrarJogo = _avtMenuEntrarJogo;

// ─────────────────────────────────────────────────────────────────────────────
// SELETOR DE PERSONAGEM
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuCharsVisiveis() {
  const allChars = (AVT_STATE.chars || []).filter(c => (c.custom_attrs?.tipo || 'jogador') === 'jogador');
  if (AVT_STATE.isMestre) return allChars;
  const uid = SESSION?.user?.id;
  const linked = (AVT_STATE.membros || []).filter(m => m.player_id === uid).map(m => m.linked).filter(Boolean);
  if (linked.length > 0) return allChars.filter(c => linked.includes(c.nome));
  return allChars; // sem vinculação: mostra todos
}

function _avtMenuHtmlSeletorChar(fnCallback, extraParam) {
  const chars = _avtMenuCharsVisiveis();
  if (chars.length === 0) {
    return '<p style="color:#7a92aa;font-size:0.72rem">Nenhum personagem disponível. Crie um na opção Personagem.</p>';
  }
  const extraArg = extraParam ? `,'${extraParam}'` : '';
  return `
    <div style="display:flex;flex-direction:column;gap:8px">
      ${chars.map(ch => {
        const ca = ch.custom_attrs || {};
        const cor = ca.cor || '#4fa3d1';
        return `
          <button onclick="${fnCallback}('${ch.nome}'${extraArg})"
            style="display:flex;align-items:center;gap:12px;background:rgba(79,163,209,0.05);border:1px solid rgba(79,163,209,0.18);border-radius:8px;padding:12px 14px;cursor:pointer;text-align:left;width:100%;transition:background .15s"
            onmouseover="this.style.background='rgba(79,163,209,0.1)'" onmouseout="this.style.background='rgba(79,163,209,0.05)'">
            <div style="width:38px;height:38px;border-radius:50%;background:${cor};display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#fff;flex-shrink:0">${(ch.nome||'?')[0].toUpperCase()}</div>
            <div style="flex:1">
              <div style="font-family:var(--fonte-d);font-size:0.8rem;color:#c8d8e8">${ch.nome}</div>
              <div style="font-size:0.62rem;color:#7a92aa;margin-top:2px">${ca.classe||'Aventureiro'} · Nv ${ch.nivel||1} · ${ch.hp_atual||100}/${_avtCalcHpJog(ch)||100} HP</div>
            </div>
            <span style="color:#4fa3d1;font-size:0.8rem">›</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTÊNCIA (session_data via rpg_members)
// ─────────────────────────────────────────────────────────────────────────────

async function _avtMenuCarregarSessionData(rpgId) {
  const uid = SESSION?.user?.id;
  if (!uid) return {};
  try {
    const rows = await _avtSb(
      `rpg_members?rpg_id=eq.${encodeURIComponent(rpgId)}&player_id=eq.${encodeURIComponent(uid)}&select=session_data`
    );
    return rows?.[0]?.session_data || {};
  } catch(_) { return {}; }
}

async function _avtMenuSalvarSessionData(patch) {
  const uid   = SESSION?.user?.id;
  const rpgId = AVT_MENU_STATE.rpgId;
  if (!uid || !rpgId) return;
  clearTimeout(AVT_MENU_STATE._saveTimer);
  AVT_MENU_STATE._saveTimer = setTimeout(async () => {
    try {
      const cur = AVT_MENU_STATE.sessionData || {};
      const upd = { ...cur, ...patch };
      AVT_MENU_STATE.sessionData = upd;
      await _avtSb(
        `rpg_members?rpg_id=eq.${encodeURIComponent(rpgId)}&player_id=eq.${encodeURIComponent(uid)}`,
        { method: 'PATCH', body: JSON.stringify({ session_data: upd }) }
      );
    } catch(_) {}
  }, 300);
}
window._avtMenuSalvarSessionData = _avtMenuSalvarSessionData;

// Handler global para avt_fase_mudou (usado pelo AVT_HANDLER_MAP do rtnet.js via Supabase fallback)
window.avtReceberFaseMudou = function(payload) {
  try {
    if (payload?.faseId && typeof _avtSalaEsperaFase === 'function') {
      _avtSalaEsperaFase(payload.faseId);
    }
  } catch(_) {}
};

// Handler de avt_fase_mudou recebido de outro peer via RTNet
// Registrado quando RTNet já está disponível ou aguarda até estar
function _avtMenuBindFaseMudouHandler() {
  if (typeof RTNet === 'undefined' || typeof RTNet.on !== 'function') {
    setTimeout(_avtMenuBindFaseMudouHandler, 600);
    return;
  }
  RTNet.on('avt_fase_mudou', (payload) => {
    try {
      if (payload?.faseId && typeof _avtSalaEsperaFase === 'function') {
        _avtSalaEsperaFase(payload.faseId);
      }
    } catch(_) {}
  });
}
_avtMenuBindFaseMudouHandler();
