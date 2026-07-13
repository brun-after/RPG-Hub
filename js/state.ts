// state.js
// RPG Hub — Global state variables and map camera/zoom utilities
// Includes: HUB_DATA, RPG_DATA, MAPA_ZOOM, MAPA_STATE, camera auto loop, TIPOS_DADO, IMPORT_CSVS



let HUB_DATA={rpgs:[]}, RPG_DATA=null, CURRENT_RPG=null;
let DADO_SEL=null, FICHAS_VIEW=null, CHAR_VIEW=null, ATTR_VIEW=null, CFG_CHAR=null;
let HISTORICO=[], USER_ID=null, realtimeWS=null;
let SESSION=null; // {access_token, user:{id,email}} — preenchido por iniciarApp() após login bem-sucedido

// ── Ação Criativa ────────────────────────────────────────────────
let CRIATIVO_TIPO = 'ataque'; // 'ataque', 'suporte', 'narrativo'
let CRIATIVO_ALVO_TIPO = 'unico'; // 'unico', 'area', 'proprio'

// ── 19A: CHAT ────────────────────────────────────────────────
const CHAT = {
  msgs:     [],
  aberto:   false,
  naoLidos: 0,
  rpgId:    null,
  online:   [],
  _presenceInterval: null,
};
let INI_VALOR_ATUAL = null;
let INI_NOME_ATUAL = null;
let CRIATIVO_ID_ATUAL = null;
let CRIATIVOS_CAMP = []; // ataques criativos da campanha (sincronizados via rpg_registry)
let CRIATIVO_MESTRE_BUILDER = []; // builder de dados do modal do mestre
let BATALHA_ATUAL_ID = null; // id da batalha sendo visualizada no mapa atual

// ── Vínculo skill↔character por UUID ─────────────────────────
// Retorna o UUID do personagem a partir do nome (ou null).
function _skCharId(nome) {
  if (!nome) return null;
  const c = (RPG_DATA?.characters || []).find(x => x.nome === nome);
  return c?.id || null;
}
// Filtra skills pelo UUID do personagem, com fallback gracioso para
// registros antigos que só possuem o campo "personagem" (nome).
function _skFiltrarPorChar(skills, nome) {
  const cid = _skCharId(nome);
  if (cid) return skills.filter(s => s.character_id === cid || (!s.character_id && s.personagem === nome));
  return skills.filter(s => s.personagem === nome);
}
let _skModalCharId = null; // UUID do personagem no modal de skill aberto
let MAPA_STATE = {
  mapaAtualId:null, mapaGeralId:null, toolMode:null, medicaoAtiva:null, dragging:null, dragTimer:null,
  batalhas: {}, // { [batalha_id]: objetoBatalha }
  // compat: getter para a batalha do mapa atual
  get batalha() { return BATALHA_ATUAL_ID ? (this.batalhas[BATALHA_ATUAL_ID] || null) : null; }
};

// ── Zoom/Pan do mapa da campanha ──────────────────────────────
let MAPA_ZOOM = { zoom:1, panX:0, panY:0, _inited:false, _keyInited:false, _resizeInited:false, locked:true, activeChar:null, modo:'auto', _autoRafId:null };

function mapaZoomApply() {
  const img = document.getElementById('mapa-img');
  if (!img) return;
  img.style.transformOrigin = '0 0';
  img.style.transform = `translate(${MAPA_ZOOM.panX}px,${MAPA_ZOOM.panY}px) scale(${MAPA_ZOOM.zoom})`;
  img.style.willChange = 'transform';
  img.style.backfaceVisibility = 'hidden';
  // Renderização nítida (vetorial/CSS) ao ampliar; suaviza apenas ao reduzir
  img.style.imageRendering = MAPA_ZOOM.zoom > 1 ? 'crisp-edges' : 'high-quality';
  // Garante visibilidade ao reaplica zoom após resize do browser
  img.style.visibility = 'visible';
  // Atualiza tokens para renderização nítida conforme o zoom
  const bgImg = img.querySelector('img.mapa-bg-img') as HTMLElement;
  if (bgImg) bgImg.style.imageRendering = MAPA_ZOOM.zoom > 1 ? 'crisp-edges' : 'auto';
  const lbl = document.getElementById('mapa-zoom-val');
  if (lbl) lbl.textContent = Math.round(MAPA_ZOOM.zoom * 100) + '%';
}


// ════════════════════════════════════════════════════════════════════════════
// 2.1 — Aliases de tipo de mapa: 'geral'→'mundo', 'local'→'tatico'
// Retrocompatível: código antigo continua funcionando
// ════════════════════════════════════════════════════════════════════════════
function mapaGetTipo(mapa) {
  const t = mapa?.tipo || 'mundo';
  if (t === 'geral') return 'mundo';
  if (t === 'local') return 'tatico';
  return t; // 'mundo', 'tatico', 'fase' já no novo formato
}
function mapaIsMundo(mapa)  { return mapaGetTipo(mapa) === 'mundo'; }
function mapaIsTatico(mapa) { return mapaGetTipo(mapa) === 'tatico'; }
function mapaIsFase(mapa)   { return mapaGetTipo(mapa) === 'fase'; }

// ── Estado global do mapa de fase ────────────────────────────────────────────
let FASE_STATE = {
  faseAtualId:  null,
  app:          null,   // instância PIXI.Application ativa
  worldContainer: null, // container raiz do mundo (câmera aplica transform aqui)
  chunks:       {},     // { [chunkKey]: { container, loaded, lastAccess } }
  entidades:    {},     // { [id]: { estado, x, y, alvo, sprite, ... } }
  jogadoresPos: {},     // { [charNome]: { worldX, worldY } }
  loopRafId:    null,
  iaAtiva:      true,   // mestre pode desligar
  modoMestre:   false,  // visão completa sem fog
  _cameraLerp: { x: 0, y: 0, zoom: 1 },
};

function mapaToggleLock() {
  MAPA_ZOOM.locked = !MAPA_ZOOM.locked;
  const btn = document.getElementById('mapa-lock-btn');
  if (btn) {
    btn.textContent = MAPA_ZOOM.locked ? '🔒' : '🔓';
    btn.style.borderColor = MAPA_ZOOM.locked ? 'rgba(200,168,75,0.6)' : 'rgba(30,45,66,0.7)';
    btn.style.color = MAPA_ZOOM.locked ? '#f0cc6a' : '#7a92aa';
    btn.style.background = MAPA_ZOOM.locked ? 'rgba(200,168,75,0.12)' : 'rgba(5,8,16,0.85)';
    btn.title = MAPA_ZOOM.locked ? 'Mapa travado — clique para destravar' : 'Travar posição do mapa';
  }
  const wrap = document.getElementById('mapa-wrap');
  if (wrap) wrap.style.cursor = MAPA_ZOOM.locked ? 'default' : 'grab';
  mostrarToast(MAPA_ZOOM.locked ? '🔒 Mapa travado' : '🔓 Mapa destravado', MAPA_ZOOM.locked ? '' : 'ok');
}
// ════════════════════════════════════════════════════════════════════════════
// 2.5 — CÂMERA AUTOMÁTICA (segue centroide do grupo)
// ════════════════════════════════════════════════════════════════════════════
function mapaToggleModoCamera() {
  MAPA_ZOOM.modo = MAPA_ZOOM.modo === 'auto' ? 'manual' : 'auto';
  const btn = document.getElementById('mapa-camera-btn');
  if (btn) {
    btn.textContent = MAPA_ZOOM.modo === 'auto' ? '📷 Auto' : '🎮 Manual';
    btn.style.borderColor = MAPA_ZOOM.modo === 'auto'
      ? 'rgba(94,224,154,0.5)' : 'rgba(30,45,66,0.7)';
  }
  mostrarToast(MAPA_ZOOM.modo === 'auto'
    ? '📷 Câmera automática' : '🎮 Câmera manual', '');
  if (MAPA_ZOOM.modo === 'auto') _cameraAutoLoop();
}

function _cameraCalcCentroide(mapId) {
  const chars = RPG_DATA?.characters || [];
  const jogadores = chars.filter(c => {
    const ca = c.custom_attrs || {};
    const isNpc = ca.tipo_personagem === 'npc' || ca.tipo === 'npc';
    if (isNpc) return false;
    return c.active_map_id === mapId;
  });
  if (!jogadores.length) return null;
  const mapa = _getMapaById(mapId);
  const W = mapa?.largura_total || 20;
  const H = mapa?.altura_total  || 20;
  let sumX = 0, sumY = 0;
  let count = 0;
  for (const c of jogadores) {
    const pos = getPosicaoNoMapa(c, mapId);
    if (!pos) continue;
    sumX += (pos.col + 0.5) / W;
    sumY += (pos.row + 0.5) / H;
    count++;
  }
  if (!count) return null;
  return { x: sumX / count, y: sumY / count }; // 0-1
}

let _cameraTarget = { panX: 0, panY: 0, zoom: 1 };

function _cameraAutoTick() {
  if (MAPA_ZOOM.modo !== 'auto') return;
  const mapId = MAPA_STATE?.mapaAtualId;
  if (!mapId) return;

  const wrap = document.getElementById('mapa-wrap');
  if (!wrap) return;
  const wW = wrap.offsetWidth  || 800;
  const wH = wrap.offsetHeight || 600;
  const bg  = document.getElementById('mapa-img');
  const bW  = bg?.offsetWidth  || wW;
  const bH  = bg?.offsetHeight || wH;

  const centro = _cameraCalcCentroide(mapId);
  if (!centro) return;

  // Zoom automático: mantém grupo visível com margem
  const mapa = _getMapaById(mapId);
  const chars = (RPG_DATA?.characters || []).filter(c =>
    c.active_map_id === mapId && !['npc','criatura'].includes(c.custom_attrs?.tipo_personagem)
  );

  let minX = centro.x, maxX = centro.x, minY = centro.y, maxY = centro.y;
  for (const c of chars) {
    const pos = getPosicaoNoMapa(c, mapId);
    if (!pos) continue;
    const W = mapa?.largura_total || 20, H = mapa?.altura_total || 20;
    const px = (pos.col + 0.5) / W;
    const py = (pos.row + 0.5) / H;
    minX = Math.min(minX, px); maxX = Math.max(maxX, px);
    minY = Math.min(minY, py); maxY = Math.max(maxY, py);
  }

  const spreadX = Math.max(0.05, maxX - minX) + 0.15; // margem 15%
  const spreadY = Math.max(0.05, maxY - minY) + 0.15;
  const zoomX = 1 / spreadX;
  const zoomY = 1 / spreadY;
  const targetZoom = Math.max(0.5, Math.min(3.0, Math.min(zoomX, zoomY)));

  // Pan para centralizar o centroide
  const targetPanX = wW / 2 - centro.x * bW * targetZoom;
  const targetPanY = wH / 2 - centro.y * bH * targetZoom;

  // Interpolação suave
  const t = 0.08;
  MAPA_ZOOM.zoom  += (targetZoom  - MAPA_ZOOM.zoom)  * t;
  MAPA_ZOOM.panX  += (targetPanX  - MAPA_ZOOM.panX)  * t;
  MAPA_ZOOM.panY  += (targetPanY  - MAPA_ZOOM.panY)  * t;
  mapaZoomApply();
}

function _cameraAutoLoop() {
  if (MAPA_ZOOM._autoRafId) cancelAnimationFrame(MAPA_ZOOM._autoRafId);
  function tick() {
    _cameraAutoTick();
    if (MAPA_ZOOM.modo === 'auto') {
      MAPA_ZOOM._autoRafId = requestAnimationFrame(tick);
    }
  }
  MAPA_ZOOM._autoRafId = requestAnimationFrame(tick);
}

// No modo 'auto', ignorar pan/scroll manual
const _origMapaZoomApply = mapaZoomApply;
// Pan e zoom manual devem checar o modo
function mapaZoomManualGuard() {
  return MAPA_ZOOM.modo !== 'auto';
}



// ── Tamanho individual de personagem no mapa ────────────────────────────────
function mapaCharSizeAtivar(nome) {
  const c = RPG_DATA?.characters?.find(x => x.nome === nome); if (!c) return;
  const ca = c.custom_attrs || {};
  const tam = ca.aparencia?.tamanho || 1.0;
  MAPA_ZOOM.activeChar = nome;
  const hud = document.getElementById('mapa-char-size-hud'); if (!hud) return;
  const nomeEl = document.getElementById('mapa-char-size-nome');
  const slider = document.getElementById('mapa-char-size-slider') as HTMLInputElement;
  const valEl  = document.getElementById('mapa-char-size-val');
  if (nomeEl) nomeEl.textContent = nome.length > 14 ? nome.slice(0,13)+'…' : nome;
  if (slider) slider.value = String(tam);
  if (valEl)  valEl.textContent = Math.round(tam * 100) + '%';
  
  // Em mobile: sobrescreve o slider com o valor do cache local
  if (_isMobile()) {
    const cached = _getMobileSize(nome);
    if (cached !== null) {
      if (slider) slider.value = String(cached);
      if (valEl) valEl.textContent = Math.round(cached * 100) + '%';
      // Atualiza visualmente o token com o tamanho do cache
      mapaCharSizeSlide(cached);
    }
  }
  
  hud.style.display = 'flex';
}
function mapaCharSizeSlide(v) {
  const val = parseFloat(v);
  const valEl = document.getElementById('mapa-char-size-val');
  if (valEl) valEl.textContent = Math.round(val * 100) + '%';
  // Atualizar tamanho em memória
  const nome = MAPA_ZOOM.activeChar; if (!nome) return;
  const c = RPG_DATA?.characters?.find(x => x.nome === nome); if (!c) return;
  if (!c.custom_attrs) c.custom_attrs = {};
  if (!c.custom_attrs.aparencia) c.custom_attrs.aparencia = {};
  c.custom_attrs.aparencia.tamanho = val;
  
  // Mobile: salva em cache local
  if (_isMobile()) {
    _setMobileSize(nome, val);
  }
  
  // Atualizar o token visualmente via escala CSS direto — sem re-render completo
  const tokenEl = document.querySelector(`.mapa-token[data-nome="${CSS.escape(nome)}"]`) as HTMLElement;
  if (tokenEl) {
    const baseTamanho = parseFloat(tokenEl.dataset.baseTamanho || '1');
    tokenEl.style.transform = `translate(-50%,-50%) scale(${(val / baseTamanho).toFixed(3)})`;
  }
}

function mapaCharSizeStep(delta) {
  const slider = document.getElementById('mapa-char-size-slider') as HTMLInputElement; if (!slider) return;
  slider.blur(); // Prevent keyboard on mobile
  const v = Math.max(0.4, Math.min(5, parseFloat(slider.value) + delta));
  slider.value = String(v);
  mapaCharSizeSlide(v);
}
async function mapaCharSizeConfirmar() {
  const nome = MAPA_ZOOM.activeChar; if (!nome) return;
  
  // Mobile: salva apenas localmente; não altera o servidor
  if (_isMobile()) {
    const tam = parseFloat(
      (document.getElementById('mapa-char-size-slider') as HTMLInputElement)?.value || '1.0'
    );
    _setMobileSize(nome, tam);
    const isMeuChar = nome === (RPG_DATA?.linked || '');
    const isMestre = RPG_DATA?.myRole === 'mestre';
    mostrarToast(
      isMestre || isMeuChar
        ? '✓ Tamanho salvo (local)'
        : '📱 Tamanho ajustado localmente',
      'ok'
    );
    mapaCharSizeFechar();
    
    // Re-render visual com o novo tamanho
    const entry = (RPG_DATA?.mapas || []).find(
      l => l.mapa.map_id === MAPA_STATE?.mapaAtualId
    );
    if (entry && window.mapaRenderTokens) mapaRenderTokens(entry.mapa);
    return;
  }
  
  // Desktop: comportamento original (salva no servidor)
  const c = RPG_DATA?.characters?.find(x => x.nome === nome); if (!c) return;
  const tam = parseFloat((document.getElementById('mapa-char-size-slider') as HTMLInputElement)?.value || '1.0');
  if (!c.custom_attrs) c.custom_attrs = {};
  if (!c.custom_attrs.aparencia) c.custom_attrs.aparencia = {};
  c.custom_attrs.aparencia.tamanho = tam;
  try {
    await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nome)}`, {
      method: 'PATCH', body: JSON.stringify({ custom_attrs: c.custom_attrs })
    });
    mostrarToast('✓ Tamanho salvo', 'ok');
  } catch(e) { mostrarToast('Erro ao salvar tamanho', 'err'); }
  mapaCharSizeFechar();
  // Re-render completo para atualizar SVG com novo tamanho real
  const mapas = RPG_DATA?.mapas || [];
  const entry = mapas.find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
  if (entry) mapaRenderTokens(entry.mapa);
}
function mapaCharSizeFechar() {
  MAPA_ZOOM.activeChar = null;
  const hud = document.getElementById('mapa-char-size-hud');
  if (hud) hud.style.display = 'none';
}

function mapaZoomSet(z, pivotX, pivotY) {
  const oldZoom = MAPA_ZOOM.zoom;
  const newZoom = Math.max(0.05, Math.min(20, z));
  if (pivotX != null && pivotY != null) {
    MAPA_ZOOM.panX = pivotX - (pivotX - MAPA_ZOOM.panX) * (newZoom / oldZoom);
    MAPA_ZOOM.panY = pivotY - (pivotY - MAPA_ZOOM.panY) * (newZoom / oldZoom);
  }
  MAPA_ZOOM.zoom = newZoom;
  mapaZoomApply();
}

function mapaZoomReset() {
  MAPA_ZOOM.zoom = 1; MAPA_ZOOM.panX = 0; MAPA_ZOOM.panY = 0;
  mapaCharSizeFechar();
  mapaZoomApply();
}

function mapaZoomInit() {
  const wrap = document.getElementById('mapa-wrap');
  if (!wrap || MAPA_ZOOM._inited) return;
  MAPA_ZOOM._inited = true;

  // Permitir que o conteúdo extravase mas com clip nas bordas
  wrap.style.overflow = 'visible';
  wrap.style.clipPath = 'inset(0 round 10px)';

  // ── Wheel zoom (centrado no cursor) ───────────────────────────
  wrap.addEventListener('wheel', (e) => {
    if (MAPA_ZOOM.locked) return; // scroll normal da página passa
    e.preventDefault();
    const rect = wrap.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const delta = e.deltaY < 0 ? 1.15 : 0.87;
    mapaZoomSet(MAPA_ZOOM.zoom * delta, px, py);
  }, { passive: false });

  // ── Pinch zoom (touch 2 dedos) ────────────────────────────────
  let _lastPinchDist = 0;
  wrap.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      _lastPinchDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
    }
  }, { passive: true });
  wrap.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      if (MAPA_ZOOM.locked) return;
      const dist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      if (_lastPinchDist > 0) {
        const rect = wrap.getBoundingClientRect();
        mapaZoomSet(MAPA_ZOOM.zoom * dist / _lastPinchDist,
          (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
          (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top);
        _lastPinchDist = dist;
      }
    }
  }, { passive: false });

  // ── Pan com pointer em qualquer lugar do mapa ─────────────────
  // Deadzone menor em mobile para câmera responder com menos movimento
  const _panIsMobile = () => navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const _panDeadzone = () => _panIsMobile() ? 3 : 6;

  let _isPanning = false, _panPointerId = null, _panSX = 0, _panSY = 0, _panOX = 0, _panOY = 0;
  let _panThresholdMet = false;
  wrap.addEventListener('pointerdown', (e: any) => {
    if (e.target.closest('#mapa-zoom-hud')) return;
    if (e.target.closest('#mapa-char-size-hud')) return;
    if (MAPA_STATE.toolMode) return;
    if (MAPA_ZOOM.locked) return;
    if (e.target.closest('.mapa-token') && e.button === 0) return;
    _isPanning = true; _panPointerId = e.pointerId; _panThresholdMet = false;
    _panSX = e.clientX; _panSY = e.clientY;
    _panOX = MAPA_ZOOM.panX; _panOY = MAPA_ZOOM.panY;
    wrap.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  wrap.addEventListener('pointermove', (e) => {
    if (!_isPanning || e.pointerId !== _panPointerId) return;
    const dx = e.clientX - _panSX;
    const dy = e.clientY - _panSY;
    if (!_panThresholdMet) {
      if (Math.abs(dx) + Math.abs(dy) < _panDeadzone()) return;
      _panThresholdMet = true;
      wrap.style.cursor = 'grabbing';
    }
    MAPA_ZOOM.panX = _panOX + dx;
    MAPA_ZOOM.panY = _panOY + dy;
    mapaZoomApply();
  });
  const _endPan = (e) => {
    if (e.pointerId !== _panPointerId) return;
    _isPanning = false; _panPointerId = null;
    wrap.style.cursor = MAPA_ZOOM.locked ? 'default' : 'grab';
  };
  wrap.addEventListener('pointerup', _endPan);
  wrap.addEventListener('pointercancel', _endPan);

  // ── Reaplica zoom quando a janela do navegador é redimensionada (inclui zoom do browser)
  if (!MAPA_ZOOM._resizeInited) {
    MAPA_ZOOM._resizeInited = true;
    const _handleResize = () => {
      const imgEl = document.getElementById('mapa-img');
      if (!imgEl) return;
      // Garante que a imagem de fundo continua visível após zoom do browser
      imgEl.style.visibility = 'visible';
      imgEl.style.opacity = '1';
      mapaZoomApply();
    };
    window.addEventListener('resize', _handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', _handleResize);
    }
  }

  // ── Atalhos de teclado na aba mapas ──────────────────────────
  if (!MAPA_ZOOM._keyInited) {
    MAPA_ZOOM._keyInited = true;
    document.addEventListener('keydown', (e) => {
      const mapaTab = document.getElementById('tab-mapas');
      if (!mapaTab || !mapaTab.classList.contains('active')) return;
      if ((e.target as any).tagName === 'INPUT' || (e.target as any).tagName === 'TEXTAREA') return;
      if (MAPA_ZOOM.locked) return;
      const wrapEl = document.getElementById('mapa-wrap');
      const r = wrapEl ? wrapEl.getBoundingClientRect() : { width: 300, height: 300 };
      if (e.key === '+' || e.key === '=') { e.preventDefault(); mapaZoomSet(MAPA_ZOOM.zoom * 2, r.width / 2, r.height / 2); }
      else if (e.key === '-') { e.preventDefault(); mapaZoomSet(MAPA_ZOOM.zoom * 0.5, r.width / 2, r.height / 2); }
      else if (e.key === '0') { e.preventDefault(); mapaZoomReset(); }
    });
  }
}

function normalizeImgUrl(url) {
  if (!url) return url;
  url = url.trim();
  // Extrair ID do Google Drive de qualquer variante de link:
  // /file/d/{id}/view  ou  /file/d/{id}
  let m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  if (url.includes('lh3.googleusercontent.com')) return url;
  return url;
}
const TIPOS_DADO=[4,6,8,10,20,100];
function getDiceConfig(rpgId){ try{ const s=localStorage.getItem('rpghub_dice_'+rpgId); return s?JSON.parse(s):TIPOS_DADO; }catch(e){ return TIPOS_DADO; } }
function setDiceConfig(rpgId,arr){ try{ localStorage.setItem('rpghub_dice_'+rpgId,JSON.stringify(arr)); }catch(e){} }
const IMPORT_CSVS={};
const COR_MAP={primario:'var(--primario-v)',perigo:'#e74c3c',sucesso:'#5ee09a',especial:'#b07ef0',destaque:'var(--destaque-v)',suave:'var(--suave)'};


/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "HUB_DATA", { configurable: true, get: () => HUB_DATA, set: (__v) => { HUB_DATA = __v; } });
Object.defineProperty(globalThis, "RPG_DATA", { configurable: true, get: () => RPG_DATA, set: (__v) => { RPG_DATA = __v; } });
Object.defineProperty(globalThis, "CURRENT_RPG", { configurable: true, get: () => CURRENT_RPG, set: (__v) => { CURRENT_RPG = __v; } });
Object.defineProperty(globalThis, "DADO_SEL", { configurable: true, get: () => DADO_SEL, set: (__v) => { DADO_SEL = __v; } });
Object.defineProperty(globalThis, "FICHAS_VIEW", { configurable: true, get: () => FICHAS_VIEW, set: (__v) => { FICHAS_VIEW = __v; } });
Object.defineProperty(globalThis, "CHAR_VIEW", { configurable: true, get: () => CHAR_VIEW, set: (__v) => { CHAR_VIEW = __v; } });
Object.defineProperty(globalThis, "ATTR_VIEW", { configurable: true, get: () => ATTR_VIEW, set: (__v) => { ATTR_VIEW = __v; } });
Object.defineProperty(globalThis, "CFG_CHAR", { configurable: true, get: () => CFG_CHAR, set: (__v) => { CFG_CHAR = __v; } });
Object.defineProperty(globalThis, "HISTORICO", { configurable: true, get: () => HISTORICO, set: (__v) => { HISTORICO = __v; } });
Object.defineProperty(globalThis, "USER_ID", { configurable: true, get: () => USER_ID, set: (__v) => { USER_ID = __v; } });
Object.defineProperty(globalThis, "realtimeWS", { configurable: true, get: () => realtimeWS, set: (__v) => { realtimeWS = __v; } });
Object.defineProperty(globalThis, "SESSION", { configurable: true, get: () => SESSION, set: (__v) => { SESSION = __v; } });
Object.defineProperty(globalThis, "CRIATIVO_TIPO", { configurable: true, get: () => CRIATIVO_TIPO, set: (__v) => { CRIATIVO_TIPO = __v; } });
Object.defineProperty(globalThis, "CRIATIVO_ALVO_TIPO", { configurable: true, get: () => CRIATIVO_ALVO_TIPO, set: (__v) => { CRIATIVO_ALVO_TIPO = __v; } });
Object.defineProperty(globalThis, "CHAT", { configurable: true, get: () => CHAT });
Object.defineProperty(globalThis, "INI_VALOR_ATUAL", { configurable: true, get: () => INI_VALOR_ATUAL, set: (__v) => { INI_VALOR_ATUAL = __v; } });
Object.defineProperty(globalThis, "INI_NOME_ATUAL", { configurable: true, get: () => INI_NOME_ATUAL, set: (__v) => { INI_NOME_ATUAL = __v; } });
Object.defineProperty(globalThis, "CRIATIVO_ID_ATUAL", { configurable: true, get: () => CRIATIVO_ID_ATUAL, set: (__v) => { CRIATIVO_ID_ATUAL = __v; } });
Object.defineProperty(globalThis, "CRIATIVOS_CAMP", { configurable: true, get: () => CRIATIVOS_CAMP, set: (__v) => { CRIATIVOS_CAMP = __v; } });
Object.defineProperty(globalThis, "CRIATIVO_MESTRE_BUILDER", { configurable: true, get: () => CRIATIVO_MESTRE_BUILDER, set: (__v) => { CRIATIVO_MESTRE_BUILDER = __v; } });
Object.defineProperty(globalThis, "BATALHA_ATUAL_ID", { configurable: true, get: () => BATALHA_ATUAL_ID, set: (__v) => { BATALHA_ATUAL_ID = __v; } });
Object.defineProperty(globalThis, "_skCharId", { configurable: true, writable: true, value: _skCharId });
Object.defineProperty(globalThis, "_skFiltrarPorChar", { configurable: true, writable: true, value: _skFiltrarPorChar });
Object.defineProperty(globalThis, "_skModalCharId", { configurable: true, get: () => _skModalCharId, set: (__v) => { _skModalCharId = __v; } });
Object.defineProperty(globalThis, "MAPA_STATE", { configurable: true, get: () => MAPA_STATE, set: (__v) => { MAPA_STATE = __v; } });
Object.defineProperty(globalThis, "MAPA_ZOOM", { configurable: true, get: () => MAPA_ZOOM, set: (__v) => { MAPA_ZOOM = __v; } });
Object.defineProperty(globalThis, "mapaZoomApply", { configurable: true, writable: true, value: mapaZoomApply });
Object.defineProperty(globalThis, "mapaGetTipo", { configurable: true, writable: true, value: mapaGetTipo });
Object.defineProperty(globalThis, "mapaIsMundo", { configurable: true, writable: true, value: mapaIsMundo });
Object.defineProperty(globalThis, "mapaIsTatico", { configurable: true, writable: true, value: mapaIsTatico });
Object.defineProperty(globalThis, "mapaIsFase", { configurable: true, writable: true, value: mapaIsFase });
Object.defineProperty(globalThis, "FASE_STATE", { configurable: true, get: () => FASE_STATE, set: (__v) => { FASE_STATE = __v; } });
Object.defineProperty(globalThis, "mapaToggleLock", { configurable: true, writable: true, value: mapaToggleLock });
Object.defineProperty(globalThis, "mapaToggleModoCamera", { configurable: true, writable: true, value: mapaToggleModoCamera });
Object.defineProperty(globalThis, "_cameraCalcCentroide", { configurable: true, writable: true, value: _cameraCalcCentroide });
Object.defineProperty(globalThis, "_cameraTarget", { configurable: true, get: () => _cameraTarget, set: (__v) => { _cameraTarget = __v; } });
Object.defineProperty(globalThis, "_cameraAutoTick", { configurable: true, writable: true, value: _cameraAutoTick });
Object.defineProperty(globalThis, "_cameraAutoLoop", { configurable: true, writable: true, value: _cameraAutoLoop });
Object.defineProperty(globalThis, "_origMapaZoomApply", { configurable: true, get: () => _origMapaZoomApply });
Object.defineProperty(globalThis, "mapaZoomManualGuard", { configurable: true, writable: true, value: mapaZoomManualGuard });
Object.defineProperty(globalThis, "mapaCharSizeAtivar", { configurable: true, writable: true, value: mapaCharSizeAtivar });
Object.defineProperty(globalThis, "mapaCharSizeSlide", { configurable: true, writable: true, value: mapaCharSizeSlide });
Object.defineProperty(globalThis, "mapaCharSizeStep", { configurable: true, writable: true, value: mapaCharSizeStep });
Object.defineProperty(globalThis, "mapaCharSizeConfirmar", { configurable: true, writable: true, value: mapaCharSizeConfirmar });
Object.defineProperty(globalThis, "mapaCharSizeFechar", { configurable: true, writable: true, value: mapaCharSizeFechar });
Object.defineProperty(globalThis, "mapaZoomSet", { configurable: true, writable: true, value: mapaZoomSet });
Object.defineProperty(globalThis, "mapaZoomReset", { configurable: true, writable: true, value: mapaZoomReset });
Object.defineProperty(globalThis, "mapaZoomInit", { configurable: true, writable: true, value: mapaZoomInit });
Object.defineProperty(globalThis, "normalizeImgUrl", { configurable: true, writable: true, value: normalizeImgUrl });
Object.defineProperty(globalThis, "TIPOS_DADO", { configurable: true, get: () => TIPOS_DADO });
Object.defineProperty(globalThis, "getDiceConfig", { configurable: true, writable: true, value: getDiceConfig });
Object.defineProperty(globalThis, "setDiceConfig", { configurable: true, writable: true, value: setDiceConfig });
Object.defineProperty(globalThis, "IMPORT_CSVS", { configurable: true, get: () => IMPORT_CSVS });
Object.defineProperty(globalThis, "COR_MAP", { configurable: true, get: () => COR_MAP });
