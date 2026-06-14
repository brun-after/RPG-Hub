// ─── Studio Pixi — Visual Particle Animation Editor ──────────────────────────
// Depends on: pixi-studio-presets.js, pixi-studio-avt.js, aventura.js (lazy)

// Reference positions for attacker/target in preview canvas (relative to center)
const PS_ATAC_REF = { x: -160, y: 0 };
const PS_ALVO_REF = { x:  160, y: 0 };

// ── Easing library ───────────────────────────────────────────────────────────
// Each fn maps a normalized t∈[0,1] → eased value. Shared with pixi-studio-avt via window.
const PS_EASING = {
  linear:        t => t,
  easeInQuad:    t => t * t,
  easeOutQuad:   t => t * (2 - t),
  easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic:   t => t * t * t,
  easeOutCubic:  t => 1 - Math.pow(1 - t, 3),
  easeInOutCubic:t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeInOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  easeOutBack:   t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  easeOutElastic:t => { if (t === 0 || t === 1) return t; const c4 = (2 * Math.PI) / 3; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1; },
  easeOutBounce: t => { const n1 = 7.5625, d1 = 2.75; if (t < 1/d1) return n1*t*t; if (t < 2/d1) return n1*(t-=1.5/d1)*t+0.75; if (t < 2.5/d1) return n1*(t-=2.25/d1)*t+0.9375; return n1*(t-=2.625/d1)*t+0.984375; },
};
const PS_EASING_NAMES = Object.keys(PS_EASING);
function _psEase(name, t) { const f = PS_EASING[name] || PS_EASING.linear; return f(Math.max(0, Math.min(1, t))); }
if (typeof window !== 'undefined') { window.PS_EASING = PS_EASING; window._psEase = _psEase; }

// ══ A — STATE ═════════════════════════════════════════════════════════════════
var PIXI_STUDIO_STATE = {
  rpgId:          null,
  animacoes:      [],
  atual:          null,        // { id, nome, descricao, config_json, ... }
  previewApp:     null,
  previewPlaying: false,
  previewTime:    0,
  previewLooping: false,
  layerSel:       null,        // selected layer id
  _dirty:         false,
  _animCache:     {},          // adventure mode runtime cache: animId -> config_json
  _emitterMap:    new Map(),   // layerId -> PIXI.particles.Emitter
  _spriteMap:     new Map(),   // layerId -> PIXI.Sprite
  _shapeMap:      new Map(),   // layerId -> PIXI.Graphics
  _bgSprite:      null,
  _worldRoot:     null,
  _scrubbing:     false,
  _kfDrag:        null,
  _spDrag:        null,        // { layerId, ptIdx } spawn_path point drag
  _layerDrag:     null,        // { layerId, edge, startX, origSt, origEt } timeline layer drag
  _lastTs:        0,
  _rafId:         0,
  _pickerCb:      null,
  _origin:        null,  // 'aventura' when opened from adventure menu
  _drag:          null,  // { layerId, type, kfIdx, startX, startY, origX, origY, origScale, origRot, spX, spY }
  _recording:     false,
  _recordPoints:  [],
  _recordStartTs: 0,
  _history:       [],
  _historyIdx:    -1,
  _historyTimer:  null,
};

// ══ B — INIT & CRUD ══════════════════════════════════════════════════════════

function _psValidateEmitterCfg(cfg) {
  if (!cfg || typeof cfg !== 'object') cfg = {};
  if (!cfg.alpha?.list?.length)  cfg.alpha  = { list: [{value:0.8,time:0},{value:0,time:1}] };
  if (!cfg.scale?.list?.length)  cfg.scale  = { list: [{value:0.5,time:0},{value:0.1,time:1}] };
  if (!cfg.color?.list?.length)  cfg.color  = { list: [{value:'ffffff',time:0},{value:'ff8040',time:1}] };
  if (!cfg.speed?.start && !cfg.speed?.list) cfg.speed = { start: 180, end: 40 };
  if (typeof cfg.lifetime?.min !== 'number') cfg.lifetime = { min: 0.3, max: 0.8 };
  if (!cfg.frequency || cfg.frequency <= 0) cfg.frequency = 0.02;
  if (typeof cfg.maxParticles !== 'number' || cfg.maxParticles < 1) cfg.maxParticles = 50;
  if (!cfg.spawnType) cfg.spawnType = 'circle';
  if (!cfg.spawnCircle) cfg.spawnCircle = { x: 0, y: 0, r: 5 };
  if (typeof cfg.emitterLifetime !== 'number') cfg.emitterLifetime = -1;
  return cfg;
}

function _psPushHistory() {
  const cur = PIXI_STUDIO_STATE.atual;
  if (!cur) return;
  const snap = JSON.stringify(cur.config_json);
  const hist = PIXI_STUDIO_STATE._history;
  // Skip no-op pushes (e.g. a loader just seeded this exact baseline)
  if (hist[PIXI_STUDIO_STATE._historyIdx] === snap) return;
  if (PIXI_STUDIO_STATE._historyIdx < hist.length - 1)
    hist.splice(PIXI_STUDIO_STATE._historyIdx + 1);
  hist.push(snap);
  if (hist.length > 30) hist.shift();
  PIXI_STUDIO_STATE._historyIdx = hist.length - 1;
}

// Reset the undo stack to a single baseline = the current config.
// Called whenever a new animation is loaded/created so the first edit is undoable.
function _psHistoryReset() {
  clearTimeout(PIXI_STUDIO_STATE._historyTimer);
  const cur = PIXI_STUDIO_STATE.atual;
  if (!cur) { PIXI_STUDIO_STATE._history = []; PIXI_STUDIO_STATE._historyIdx = -1; return; }
  PIXI_STUDIO_STATE._history = [JSON.stringify(cur.config_json)];
  PIXI_STUDIO_STATE._historyIdx = 0;
}

function psUndo() {
  const hist = PIXI_STUDIO_STATE._history;
  const cur = PIXI_STUDIO_STATE.atual;
  if (!cur || PIXI_STUDIO_STATE._historyIdx <= 0) return;
  PIXI_STUDIO_STATE._historyIdx--;
  cur.config_json = JSON.parse(hist[PIXI_STUDIO_STATE._historyIdx]);
  psPreviewRebuildAll(); _psRenderLayerList(); _psRenderPropsPanel(); psTimelineRender(); _psRenderBehaviorPanel();
}

function psRedo() {
  const hist = PIXI_STUDIO_STATE._history;
  const cur = PIXI_STUDIO_STATE.atual;
  if (!cur || PIXI_STUDIO_STATE._historyIdx >= hist.length - 1) return;
  PIXI_STUDIO_STATE._historyIdx++;
  cur.config_json = JSON.parse(hist[PIXI_STUDIO_STATE._historyIdx]);
  psPreviewRebuildAll(); _psRenderLayerList(); _psRenderPropsPanel(); psTimelineRender(); _psRenderBehaviorPanel();
}

function pixiStudioInit() {
  if (!SESSION?.user?.id) return;
  psRenderShell();
  psCarregarLista();
}

function psRenderShell() {
  const root = document.getElementById('ps-root');
  if (!root) return;
  root.innerHTML = `
<div id="ps-toolbar" style="grid-column:1/-1;display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--escuro);border-bottom:1px solid var(--borda)">
  <span style="font-family:var(--fonte-d);font-size:0.8rem;color:var(--destaque);margin-right:8px">✦ Studio Pixi</span>
  <button class="btn btn-primario" style="font-size:0.7rem;padding:5px 12px" onclick="psNova()">+ Nova</button>
  <button class="btn" style="font-size:0.7rem;padding:5px 12px;background:rgba(79,163,209,0.12);border-color:var(--primario);color:var(--primario)" onclick="psSalvar()">💾 Salvar</button>
  <button class="btn" style="font-size:0.7rem;padding:5px 12px" onclick="psPresetsAbrir()">⚡ Presets</button>
  <button class="btn" style="font-size:0.7rem;padding:5px 12px" onclick="psImportarAbrir()">⬆ Import JSON</button>
  <button class="btn" style="font-size:0.7rem;padding:5px 12px" onclick="psExportarJson()">⬇ Export</button>
  <div style="flex:1"></div>
  <span id="ps-dirty-badge" style="display:none;font-size:0.65rem;color:#e8604c;font-family:var(--fonte-d)">● não salvo</span>
  <button class="btn" style="font-size:0.7rem;padding:4px 8px" onclick="psUndo()" title="Desfazer (Ctrl+Z)">↩</button>
  <button class="btn" style="font-size:0.7rem;padding:4px 8px" onclick="psRedo()" title="Refazer (Ctrl+Y)">↪</button>
  <button class="btn" style="font-size:0.65rem;padding:4px 10px;color:var(--perigo);border-color:var(--perigo)" onclick="psExcluirAtual()">🗑</button>
</div>
<div id="ps-left" style="background:var(--escuro);border-right:1px solid var(--borda);overflow-y:auto;display:flex;flex-direction:column">
  <div style="padding:10px 12px;border-bottom:1px solid var(--borda)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.08em">Animações</span>
      <button class="btn" style="font-size:0.6rem;padding:2px 7px" onclick="psDuplicarAnimacao()" title="Duplicar animação atual">⎘ Dup</button>
    </div>
    <input type="text" placeholder="🔍 buscar (nome/categoria)…" oninput="psFilterAnimList(this.value)"
      style="width:100%;padding:4px 7px;margin-bottom:8px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.7rem">
    <div id="ps-anim-list" style="display:flex;flex-direction:column;gap:4px"></div>
  </div>
  <div style="padding:10px 12px;border-bottom:1px solid var(--borda)">
    <div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;margin-bottom:8px">Camadas</div>
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
      <button class="btn" style="font-size:0.6rem;padding:3px 7px" onclick="psAddLayer('emitter')">+Emissor</button>
      <button class="btn" style="font-size:0.6rem;padding:3px 7px" onclick="psAddLayer('sprite')">+Sprite</button>
      <button class="btn" style="font-size:0.6rem;padding:3px 7px" onclick="psAddLayer('shape')">+Forma</button>
      <button class="btn" style="font-size:0.6rem;padding:3px 7px" onclick="psAddLayer('light')">+Luz</button>
      <button class="btn" style="font-size:0.6rem;padding:3px 7px" onclick="psAddLayer('background')">+Fundo</button>
    </div>
    <div id="ps-layer-list" style="display:flex;flex-direction:column;gap:3px"></div>
  </div>
  <div style="padding:10px 12px">
    <div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;margin-bottom:8px">Comportamento</div>
    <div id="ps-behavior-panel"></div>
  </div>
</div>
<div id="ps-center" style="display:flex;flex-direction:column;background:var(--preto);overflow:hidden">
  <div id="ps-preview-wrap" style="position:relative;flex:1;min-height:200px">
    <canvas id="ps-preview-canvas" style="position:absolute;inset:0;width:100%;height:100%;display:block;border-radius:6px;border:1px solid var(--borda)"></canvas>
  </div>
  <div style="padding:8px 12px;background:var(--escuro);border-top:1px solid var(--borda);display:flex;align-items:center;gap:10px">
    <button onclick="psPreviewPlay()" title="Play" style="background:none;border:none;color:var(--texto);font-size:1.1rem;cursor:pointer;padding:2px 6px">▶</button>
    <button onclick="psPreviewPause()" title="Pause" style="background:none;border:none;color:var(--texto);font-size:1.1rem;cursor:pointer;padding:2px 6px">⏸</button>
    <button onclick="psPreviewStop()" title="Stop" style="background:none;border:none;color:var(--texto);font-size:1.1rem;cursor:pointer;padding:2px 6px">⏹</button>
    <button onclick="psPreviewToggleLoop()" id="ps-loop-btn" title="Loop" style="background:none;border:none;color:var(--suave);font-size:0.9rem;cursor:pointer;padding:2px 6px">↺</button>
    <button id="ps-record-btn" onclick="psToggleGravar()" title="Gravar trajetória do emissor selecionado" style="background:none;border:1px solid var(--borda);border-radius:4px;color:var(--suave);font-size:0.72rem;cursor:pointer;padding:2px 8px">⏺ Gravar</button>
    <button id="ps-fx-btn" onclick="psToggleFx()" title="Pós-processamento (glow/bloom/câmera) — WYSIWYG" style="background:none;border:1px solid var(--primario);border-radius:4px;color:var(--primario);font-size:0.72rem;cursor:pointer;padding:2px 8px">✨ FX</button>
    <button id="ps-scene-btn" onclick="psToggleScene()" title="Preview com bonecos móveis (atacante/alvo)" style="background:none;border:1px solid var(--borda);border-radius:4px;color:var(--suave);font-size:0.72rem;cursor:pointer;padding:2px 8px">👥 Cena</button>
    <div style="flex:1"></div>
    <span id="ps-preview-time" style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave)">0.0s / 2.0s</span>
    <label style="font-size:0.68rem;color:var(--suave);display:flex;align-items:center;gap:4px">Zoom
      <input type="range" id="ps-zoom-range" min="0.5" max="3" step="0.1" value="1" style="width:60px" oninput="psPreviewZoom(this.value)">
    </label>
  </div>
  <div id="ps-timeline" style="background:var(--escuro);border-top:1px solid var(--borda);padding:8px 12px;min-height:60px"></div>
</div>
<div id="ps-right" style="background:var(--escuro);border-left:1px solid var(--borda);overflow-y:auto;padding:12px;min-width:300px;width:300px">
  <div id="ps-props-panel"><div style="padding:20px 0;text-align:center;color:var(--suave);font-size:0.8rem;font-style:italic">Selecione uma camada</div></div>
</div>`;
  _psRenderAnimList();
}

async function psCarregarLista() {
  const uid = SESSION?.user?.id;
  if (!uid) return;
  try {
    const ors = [`criado_por.eq.${encodeURIComponent(uid)}`, 'global.eq.true'];
    const rpgId = PIXI_STUDIO_STATE.rpgId;
    if (rpgId) ors.push(`rpg_id.eq.${encodeURIComponent(rpgId)}`);
    const rows = await sb(`pixi_animations?or=(${ors.join(',')})&order=criado_em.desc`);
    PIXI_STUDIO_STATE.animacoes = rows || [];
  } catch (e) {
    PIXI_STUDIO_STATE.animacoes = [];
  }
  _psRenderAnimList();
}

function psFilterAnimList(query) {
  PIXI_STUDIO_STATE._animFilter = (query || '').toLowerCase();
  _psRenderAnimList();
}

function _psRenderAnimList() {
  const el = document.getElementById('ps-anim-list');
  if (!el) return;
  const all = PIXI_STUDIO_STATE.animacoes || [];
  const q = PIXI_STUDIO_STATE._animFilter || '';
  const list = q ? all.filter(a => `${a.nome||''} ${a.behavior||''} ${a.config_json?.categoria||''}`.toLowerCase().includes(q)) : all;
  if (!all.length) {
    el.innerHTML = '<div style="font-size:0.75rem;color:var(--suave);font-style:italic;padding:4px 0">Nenhuma animação. Crie uma!</div>';
    return;
  }
  if (!list.length) {
    el.innerHTML = '<div style="font-size:0.72rem;color:var(--suave);font-style:italic;padding:4px 0">Nada encontrado.</div>';
    return;
  }
  const cur = PIXI_STUDIO_STATE.atual?.id;
  el.innerHTML = list.map(a => {
    const cat = a.config_json?.categoria ? ' · ' + _esc(a.config_json.categoria) : '';
    return `
    <div class="ps-anim-item"
      style="padding:6px 8px;border-radius:5px;cursor:pointer;font-size:0.75rem;
             background:${a.id===cur ? 'rgba(79,163,209,0.15)' : 'rgba(255,255,255,0.03)'};
             border:1px solid ${a.id===cur ? 'var(--primario)' : 'transparent'};
             display:flex;align-items:center;gap:6px">
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:6px" onclick="psCarregarAnimacao('${a.id}')">
        ${a.preview_url ? `<img src="${a.preview_url}" style="width:36px;height:22px;object-fit:cover;border-radius:3px;flex-shrink:0">` : '<div style="width:36px;height:22px;background:var(--preto);border-radius:3px;flex-shrink:0"></div>'}
        <div style="min-width:0">
          <div style="font-family:var(--fonte-d);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(a.nome)}</div>
          <div style="font-size:0.6rem;color:var(--suave)">${a.behavior || 'one-shot'}${a.global ? ' · global' : ''}${cat}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function psDuplicarAnimacao() {
  const cur = PIXI_STUDIO_STATE.atual;
  if (!cur) return mostrarToast('Nenhuma animação aberta', 'aviso');
  const clone = JSON.parse(JSON.stringify(cur));
  clone.id = null; clone.preview_url = null;
  clone.nome = (cur.nome || 'Animação') + ' cópia';
  PIXI_STUDIO_STATE.atual = clone;
  _psHistoryReset();
  PIXI_STUDIO_STATE.layerSel = null;
  _psSetDirty(true);
  _psRenderAnimList();
  psPreviewStop();
  _psRenderLayerList(); _psRenderBehaviorPanel(); _psRenderPropsPanel(); psTimelineRender(); _psRemountOrRebuild();
  mostrarToast('Animação duplicada — salve para persistir', 'sucesso');
}

async function psCarregarAnimacao(id) {
  const row = PIXI_STUDIO_STATE.animacoes.find(a => a.id === id);
  if (!row) return;
  PIXI_STUDIO_STATE.atual = JSON.parse(JSON.stringify(row));
  PIXI_STUDIO_STATE._dirty = false;
  _psHistoryReset();
  PIXI_STUDIO_STATE.layerSel = null;
  _psRenderAnimList();
  psPreviewStop();
  _psRenderLayerList();
  _psRenderBehaviorPanel();
  _psRenderPropsPanel();
  psTimelineRender();
  _psRemountOrRebuild();
}

function psNova() {
  const id = 'novo_' + Date.now();
  const config = _psDefaultConfig();
  PIXI_STUDIO_STATE.atual = { id: null, nome: 'Nova Animação', descricao: '', config_json: config, behavior: 'one-shot', duracao_ms: 1000, global: false };
  _psHistoryReset();
  PIXI_STUDIO_STATE._dirty = true;
  PIXI_STUDIO_STATE.layerSel = null;
  _psRenderAnimList();
  psPreviewStop();
  _psRenderLayerList();
  _psRenderBehaviorPanel();
  _psRenderPropsPanel();
  psTimelineRender();
  _psRemountOrRebuild();
  _psSetDirty(true);
}

function _psDefaultConfig() {
  return {
    version: 2, behavior: 'one-shot', duracao_ms: 1000, posicao: 'alvo',
    camera: { shake: { amp: 4, decay: 0.92, freq: 32 } },
    lighting: { bloom: { threshold: 0.6, intensity: 0.7, quality: 4 }, tone: 'filmic' },
    background: { darken: 0.1 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l_' + Date.now(), tipo: 'emitter', nome: 'Partículas', visivel: true, z: 3,
        blendMode: 'add', texture: 'spark', texture_url: null, glow: null,
        emitter: {
          alpha: { list: [{ value: 0.9, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.4, time: 0 }, { value: 0.05, time: 1 }] },
          color: { list: [{ value: 'ffffff', time: 0 }, { value: 'ff8040', time: 1 }] },
          speed: { start: 180, end: 40 }, acceleration: { x: 0, y: 0 },
          startRotation: { min: 0, max: 360 }, rotationSpeed: { min: -90, max: 90 },
          lifetime: { min: 0.3, max: 0.6 }, frequency: 0.01, emitterLifetime: 0.3,
          maxParticles: 60, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 5 }
        }, keyframes: [] }
    ],
  };
}

async function psSalvar() {
  const cur = PIXI_STUDIO_STATE.atual;
  if (!cur) return mostrarToast('Nenhuma animação para salvar', 'erro');

  // Sync top-level behavior/duration from config_json
  cur.behavior   = cur.config_json.behavior   || 'one-shot';
  cur.duracao_ms = cur.config_json.duracao_ms || 1000;
  cur.global     = cur.config_json.global     || false;

  const preview = await _psCaptureThumbnail().catch(() => null);
  let previewUrl = cur.preview_url || null;
  if (preview) {
    try { previewUrl = await uploadToStorage(preview, 'pixi-previews'); } catch (_) {}
  }

  const body = {
    // Global anims are shared (rpg_id null); otherwise scope to current RPG when known
    rpg_id:      cur.global ? null : (PIXI_STUDIO_STATE.rpgId || null),
    nome:        cur.nome || 'Animação',
    descricao:   cur.descricao || '',
    config_json: cur.config_json,
    behavior:    cur.behavior,
    duracao_ms:  cur.duracao_ms,
    global:      cur.global,
    criado_por:  SESSION?.user?.id || null,
    preview_url: previewUrl,
  };

  try {
    let saved;
    if (cur.id) {
      saved = await sb(`pixi_animations?id=eq.${encodeURIComponent(cur.id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) });
      saved = Array.isArray(saved) ? saved[0] : saved;
    } else {
      saved = await sb('pixi_animations', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) });
      saved = Array.isArray(saved) ? saved[0] : saved;
      cur.id = saved?.id || cur.id;
    }
    if (saved?.id) {
      Object.assign(cur, saved);
      // Invalidate adventure mode cache
      delete PIXI_STUDIO_STATE._animCache[saved.id];
    }
    PIXI_STUDIO_STATE._dirty = false;
    _psSetDirty(false);
    await psCarregarLista();
    mostrarToast('Animação salva!', 'sucesso');
  } catch (e) {
    mostrarToast('Erro ao salvar: ' + (e.message || e), 'erro');
  }
}

async function psExcluirAtual() {
  const cur = PIXI_STUDIO_STATE.atual;
  if (!cur?.id) return;
  if (!confirm(`Excluir "${cur.nome}"?`)) return;
  try {
    await sb(`pixi_animations?id=eq.${encodeURIComponent(cur.id)}`, { method: 'DELETE' });
    PIXI_STUDIO_STATE.atual = null;
    PIXI_STUDIO_STATE._dirty = false;
    psPreviewStop();
    psPreviewUnmount();
    _psRenderLayerList();
    _psRenderPropsPanel();
    await psCarregarLista();
    mostrarToast('Animação excluída', 'sucesso');
  } catch (e) {
    mostrarToast('Erro ao excluir', 'erro');
  }
}

function _psSetDirty(val) {
  PIXI_STUDIO_STATE._dirty = val;
  const badge = document.getElementById('ps-dirty-badge');
  if (badge) badge.style.display = val ? 'block' : 'none';
  // Debounced snapshot so a settled edit becomes one undo step
  if (val) {
    clearTimeout(PIXI_STUDIO_STATE._historyTimer);
    PIXI_STUDIO_STATE._historyTimer = setTimeout(_psPushHistory, 300);
  }
}

// ══ C — LAYER MANAGEMENT ══════════════════════════════════════════════════════

function psAddLayer(tipo) {
  const cur = PIXI_STUDIO_STATE.atual;
  if (!cur) return;
  const id = 'l_' + Date.now();
  const maxZ = cur.config_json.layers.reduce((m, l) => Math.max(m, l.z || 0), 0);
  let layer = { id, tipo, nome: tipo.charAt(0).toUpperCase() + tipo.slice(1), visivel: true, z: maxZ + 1, blendMode: 'add', keyframes: [] };
  if (tipo === 'emitter') {
    layer.texture = 'spark'; layer.texture_url = null; layer.glow = null;
    layer.emitter = {
      alpha: { list: [{ value: 0.9, time: 0 }, { value: 0, time: 1 }] },
      scale: { list: [{ value: 0.4, time: 0 }, { value: 0.05, time: 1 }] },
      color: { list: [{ value: 'ffffff', time: 0 }, { value: 'ff8040', time: 1 }] },
      speed: { start: 180, end: 40 }, acceleration: { x: 0, y: 0 },
      startRotation: { min: 0, max: 360 }, rotationSpeed: { min: -90, max: 90 },
      lifetime: { min: 0.3, max: 0.6 }, frequency: 0.01, emitterLifetime: 0.3,
      maxParticles: 60, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 5 }
    };
  } else if (tipo === 'sprite') {
    layer.texture_url = null; layer.blendMode = 'add';
    layer.base_scale = 1; layer.flip_x = false; layer.flip_y = false;
    layer.keyframes = [
      { t: 0, x: 0, y: 0, scale: 1, alpha: 1, rotation: 0 },
      { t: 1, x: 0, y: 0, scale: 2, alpha: 0, rotation: 0 }
    ];
  } else if (tipo === 'shape') {
    layer.shape_type = 'circle'; layer.blendMode = 'add';
    layer.keyframes = [
      { t: 0, radius: 5,  stroke_color: '#ff8842', stroke_alpha: 1, stroke_width: 3, fill_alpha: 0 },
      { t: 1, radius: 60, stroke_color: '#ff4422', stroke_alpha: 0, stroke_width: 1, fill_alpha: 0 }
    ];
  } else if (tipo === 'light') {
    layer.blendMode = 'add'; layer.color = '#ffd27f';
    layer.keyframes = [
      { t: 0, x: 0, y: 0, radius: 30, alpha: 0,   color: '#ffe9b0' },
      { t: 0.2, x: 0, y: 0, radius: 110, alpha: 0.85, color: '#ffd27f' },
      { t: 1, x: 0, y: 0, radius: 70, alpha: 0, color: '#ff9a3c' }
    ];
  } else if (tipo === 'background') {
    layer.bg_type = 'solid'; layer.bg_color = '#000000'; layer.bg_alpha = 0;
  }
  cur.config_json.layers.push(layer);
  _psSetDirty(true);
  _psRenderLayerList();
  psSelectLayer(id);
  psPreviewRebuildAll();
  psTimelineRender();
}

function psDuplicateLayer(layerId) {
  const cur = PIXI_STUDIO_STATE.atual;
  if (!cur) return;
  const idx = cur.config_json.layers.findIndex(l => l.id === layerId);
  if (idx < 0) return;
  const clone = JSON.parse(JSON.stringify(cur.config_json.layers[idx]));
  clone.id = 'l_' + Date.now();
  clone.nome = (clone.nome || 'Camada') + ' cópia';
  clone.z = (clone.z || 0) + 1;
  cur.config_json.layers.splice(idx + 1, 0, clone);
  _psSetDirty(true);
  _psRenderLayerList();
  psSelectLayer(clone.id);
  psPreviewRebuildAll();
  psTimelineRender();
}

function psRemoveLayer(layerId) {
  const cur = PIXI_STUDIO_STATE.atual;
  if (!cur) return;
  cur.config_json.layers = cur.config_json.layers.filter(l => l.id !== layerId);
  if (PIXI_STUDIO_STATE.layerSel === layerId) PIXI_STUDIO_STATE.layerSel = null;
  _psSetDirty(true);
  _psRenderLayerList();
  _psRenderPropsPanel();
  psPreviewRebuildAll();
  psTimelineRender();
}

function psMoveLayer(layerId, dir) {
  const cur = PIXI_STUDIO_STATE.atual;
  if (!cur) return;
  const layers = cur.config_json.layers;
  const idx = layers.findIndex(l => l.id === layerId);
  if (idx < 0) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= layers.length) return;
  const tmp = layers[idx]; layers[idx] = layers[newIdx]; layers[newIdx] = tmp;
  _psSetDirty(true);
  _psRenderLayerList();
}

function psSelectLayer(layerId) {
  PIXI_STUDIO_STATE.layerSel = layerId;
  _psRenderLayerList();
  _psRenderPropsPanel();
}

function psUpdateLayerProp(layerId, key, value) {
  const layer = _psGetLayer(layerId);
  if (!layer) return;
  if (key.includes('.')) {
    const parts = key.split('.');
    let obj = layer;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] == null) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
  } else {
    layer[key] = value;
  }
  _psSetDirty(true);
  if (layer.tipo === 'emitter') psPreviewSyncEmitter(layerId);
  else psPreviewRebuildAll();
}

function psUpdateEmitterProp(layerId, key, value) {
  const layer = _psGetLayer(layerId);
  if (!layer || !layer.emitter) return;
  if (key.includes('.')) {
    const parts = key.split('.');
    let obj = layer.emitter;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] == null) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
  } else {
    layer.emitter[key] = value;
  }
  _psSetDirty(true);
  psPreviewSyncEmitter(layerId);
}

function psAddKeyframe(layerId, t) {
  const layer = _psGetLayer(layerId);
  if (!layer) return;
  if (!layer.keyframes) layer.keyframes = [];
  const kf = _psDefaultKeyframe(layer, t);
  layer.keyframes.push(kf);
  layer.keyframes.sort((a, b) => a.t - b.t);
  _psSetDirty(true);
  _psRenderPropsPanel();
  psTimelineRender();
}

function psUpdateKeyframe(layerId, idx, props) {
  const layer = _psGetLayer(layerId);
  if (!layer || !layer.keyframes || !layer.keyframes[idx]) return;
  Object.assign(layer.keyframes[idx], props);
  layer.keyframes.sort((a, b) => a.t - b.t);
  _psSetDirty(true);
  psTimelineRender();
}

function psRemoveKeyframe(layerId, idx) {
  const layer = _psGetLayer(layerId);
  if (!layer || !layer.keyframes) return;
  layer.keyframes.splice(idx, 1);
  _psSetDirty(true);
  _psRenderPropsPanel();
  psTimelineRender();
}

function _psGetLayer(layerId) {
  return PIXI_STUDIO_STATE.atual?.config_json?.layers?.find(l => l.id === layerId) || null;
}

function _psDefaultKeyframe(layer, t) {
  if (layer.tipo === 'sprite') return { t: t ?? 0.5, x: 0, y: 0, scale: 1, alpha: 1, rotation: 0 };
  if (layer.tipo === 'shape')  return { t: t ?? 0.5, radius: 20, stroke_color: '#ffffff', stroke_alpha: 1, stroke_width: 2, fill_alpha: 0 };
  if (layer.tipo === 'light')  return { t: t ?? 0.5, x: 0, y: 0, radius: 60, alpha: 0.7, color: '#ffd27f' };
  return { t: t ?? 0.5 };
}

function _psRenderLayerList() {
  const el = document.getElementById('ps-layer-list');
  if (!el) return;
  const layers = PIXI_STUDIO_STATE.atual?.config_json?.layers;
  if (!layers?.length) { el.innerHTML = '<div style="font-size:0.72rem;color:var(--suave);font-style:italic">Sem camadas</div>'; return; }
  const sel = PIXI_STUDIO_STATE.layerSel;
  const tipoIcon = { emitter: '✦', sprite: '🖼', shape: '◯', light: '💡', background: '▬' };
  el.innerHTML = [...layers].reverse().map((l, ri) => {
    const idx = layers.length - 1 - ri;
    return `<div style="display:flex;align-items:center;gap:3px;padding:4px 6px;border-radius:4px;cursor:pointer;
              background:${l.id===sel ? 'rgba(79,163,209,0.18)' : 'rgba(255,255,255,0.03)'};
              border:1px solid ${l.id===sel ? 'var(--primario)' : 'transparent'}"
              onclick="psSelectLayer('${l.id}')">
      <span style="font-size:0.75rem;opacity:0.7">${tipoIcon[l.tipo]||'•'}</span>
      <span style="flex:1;font-size:0.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.nome}</span>
      <button onclick="event.stopPropagation();psUpdateLayerProp('${l.id}','visivel',${!l.visivel})"
        style="background:none;border:none;cursor:pointer;font-size:0.75rem;opacity:${l.visivel?1:0.3};padding:1px 3px" title="Visível">👁</button>
      <button onclick="event.stopPropagation();psDuplicateLayer('${l.id}')" title="Duplicar"
        style="background:none;border:none;cursor:pointer;font-size:0.65rem;color:var(--suave);padding:1px 2px">⎘</button>
      <button onclick="event.stopPropagation();psMoveLayer('${l.id}',-1)"
        style="background:none;border:none;cursor:pointer;font-size:0.65rem;color:var(--suave);padding:1px 2px">↑</button>
      <button onclick="event.stopPropagation();psMoveLayer('${l.id}',1)"
        style="background:none;border:none;cursor:pointer;font-size:0.65rem;color:var(--suave);padding:1px 2px">↓</button>
      <button onclick="event.stopPropagation();psRemoveLayer('${l.id}')"
        style="background:none;border:none;cursor:pointer;font-size:0.7rem;color:var(--perigo);padding:1px 3px">✕</button>
    </div>`;
  }).join('');
}

// ══ D — PROPERTIES PANEL ══════════════════════════════════════════════════════

function _psRenderPropsPanel() {
  const el = document.getElementById('ps-props-panel');
  if (!el) return;
  const layerId = PIXI_STUDIO_STATE.layerSel;
  const layer = layerId ? _psGetLayer(layerId) : null;
  if (!layer) {
    // Show animation-level props
    const cur = PIXI_STUDIO_STATE.atual;
    if (!cur) { el.innerHTML = '<div style="padding:20px 0;text-align:center;color:var(--suave);font-size:0.8rem;font-style:italic">Selecione uma camada</div>'; return; }
    el.innerHTML = `
<div style="font-family:var(--fonte-d);font-size:0.7rem;color:var(--destaque);margin-bottom:12px">Animação</div>
<div class="form-group" style="margin-bottom:8px"><label style="font-size:0.68rem">Nome</label>
  <input type="text" value="${_esc(cur.nome)}" oninput="PIXI_STUDIO_STATE.atual.nome=this.value;_psSetDirty(true)"
    style="width:100%;padding:5px 8px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.8rem">
</div>
<div class="form-group" style="margin-bottom:8px"><label style="font-size:0.68rem">Descrição</label>
  <textarea oninput="PIXI_STUDIO_STATE.atual.descricao=this.value;_psSetDirty(true)"
    style="width:100%;padding:5px 8px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.78rem;resize:vertical;min-height:50px">${_esc(cur.descricao||'')}</textarea>
</div>
<div class="form-group" style="margin-bottom:8px"><label style="font-size:0.68rem">Categoria</label>
  <input type="text" value="${_esc(cur.config_json.categoria||'')}" placeholder="fogo, gelo, cura…" oninput="psUpdateConfigProp('categoria',this.value)"
    style="width:100%;padding:5px 8px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.78rem">
</div>
<label style="display:flex;align-items:center;gap:6px;font-size:0.72rem;cursor:pointer;margin-bottom:8px">
  <input type="checkbox" ${cur.config_json.global?'checked':''} style="accent-color:var(--primario)"
    onchange="psUpdateConfigProp('global',this.checked)"> Global (todas campanhas)
</label>
${_psLightingHtml(cur.config_json)}
${_psScreenFxHtml(cur.config_json)}
${_psQualityHtml(cur.config_json)}
${_psAudioHtml(cur.config_json)}`;
    return;
  }
  if (layer.tipo === 'emitter') { el.innerHTML = _psEmitterPanelHtml(layer); return; }
  if (layer.tipo === 'sprite')  { el.innerHTML = _psSpriteShapeHtml(layer, 'sprite'); return; }
  if (layer.tipo === 'shape')   { el.innerHTML = _psSpriteShapeHtml(layer, 'shape'); return; }
  if (layer.tipo === 'light')   { el.innerHTML = _psLightPanelHtml(layer); return; }
  if (layer.tipo === 'background') { el.innerHTML = _psBgPanelHtml(layer); return; }
}

function _psLightPanelHtml(layer) {
  const kfs = layer.keyframes || [];
  return `
<div style="font-family:var(--fonte-d);font-size:0.7rem;color:var(--destaque);margin-bottom:10px">💡 Luz: ${_esc(layer.nome)}</div>
${_psLayerCommonHtml(layer)}
<div style="font-size:0.6rem;color:var(--suave);margin-bottom:6px">Flash/luz radial aditivo — anime raio, opacidade e cor.</div>
<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:6px">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
  <div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase">Keyframes</div>
  <button onclick="psAddKeyframe('${layer.id}',0.5)" style="background:none;border:1px solid var(--borda);border-radius:3px;color:var(--suave);font-size:0.6rem;cursor:pointer;padding:1px 6px">+ KF</button>
</div>
${kfs.length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.66rem;min-width:200px">
<thead><tr style="color:var(--suave)"><th>t</th><th>Raio</th><th>α</th><th>Cor</th><th>ease</th><th></th></tr></thead><tbody>
${kfs.map((k,i)=>`<tr style="border-top:1px solid rgba(255,255,255,0.05)">
  <td><input type="number" min="0" max="1" step="0.01" value="${k.t}" onchange="psUpdateKeyframe('${layer.id}',${i},{t:parseFloat(this.value)})" style="width:36px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.64rem;text-align:center"></td>
  <td><input type="number" value="${k.radius??60}" onchange="psUpdateKeyframe('${layer.id}',${i},{radius:parseFloat(this.value)})" style="width:42px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.64rem;text-align:center"></td>
  <td><input type="number" min="0" max="1" step="0.05" value="${k.alpha??0.8}" onchange="psUpdateKeyframe('${layer.id}',${i},{alpha:parseFloat(this.value)})" style="width:38px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.64rem;text-align:center"></td>
  <td><input type="color" value="${k.color||'#ffd27f'}" onchange="psUpdateKeyframe('${layer.id}',${i},{color:this.value})" style="width:28px;height:22px;padding:1px;background:none;border:1px solid var(--borda);border-radius:2px;cursor:pointer"></td>
  <td><select onchange="psUpdateKeyframe('${layer.id}',${i},{ease:this.value})" style="width:60px;padding:1px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.56rem">${PS_EASING_NAMES.map(n=>`<option value="${n}"${(k.ease||'linear')===n?' selected':''}>${n.replace('ease','')||'linear'}</option>`).join('')}</select></td>
  <td><button onclick="psRemoveKeyframe('${layer.id}',${i})" style="background:none;border:none;color:var(--perigo);cursor:pointer;font-size:0.7rem">✕</button></td></tr>`).join('')}
</tbody></table></div>` : '<div style="font-size:0.72rem;color:var(--suave);font-style:italic">Sem keyframes</div>'}
</div>`;
}

function _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function psUpdateConfigProp(key, value) {
  if (!PIXI_STUDIO_STATE.atual) return;
  PIXI_STUDIO_STATE.atual.config_json[key] = value;
  _psSetDirty(true);
}

function _psSfxOptions(selected) {
  if (typeof AudioManager === 'undefined' || !AudioManager.getSfxList) return `<option value="">— nenhum —</option>`;
  let list = [];
  try { list = AudioManager.getSfxList() || []; } catch (_) {}
  const cats = {};
  list.forEach(s => { (cats[s.cat || 'outros'] = cats[s.cat || 'outros'] || []).push(s); });
  const isCustom = selected && !list.some(s => s.id === selected);
  return `<option value="">— nenhum —</option>` +
    Object.entries(cats).map(([cat, arr]) => `<optgroup label="${cat}">${arr.map(s => `<option value="${s.id}"${selected === s.id ? ' selected' : ''}>${_esc(s.label)}</option>`).join('')}</optgroup>`).join('') +
    `<option value="__url__"${isCustom ? ' selected' : ''}>URL personalizada…</option>`;
}
function _psSfxFieldHtml(label, which, val) {
  const isCustom = val && (val.startsWith('http') || val.startsWith('/'));
  return `<div class="form-group" style="margin-bottom:6px"><label style="font-size:0.66rem;display:flex;justify-content:space-between">${label}
    <button onclick="psTestSfx('${which}')" title="Ouvir" style="background:none;border:none;color:var(--primario);cursor:pointer;font-size:0.7rem">🔊</button></label>
  <select onchange="psSetSfx('${which}',this.value)"
    style="width:100%;padding:4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.7rem">${_psSfxOptions(val)}</select>
  ${isCustom ? `<input type="text" value="${_esc(val)}" placeholder="https://..." oninput="psSetSfx('${which}',this.value)"
    style="width:100%;margin-top:3px;padding:4px 6px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.7rem">` : ''}</div>`;
}
function _psAudioHtml(cfg) {
  const a = cfg.audio || {};
  const evs = a.events || [];
  return `<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:4px">
<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;margin-bottom:8px">Áudio</div>
${_psSfxFieldHtml('Cast SFX', 'cast', a.cast || '')}
${_psSfxFieldHtml('Impact SFX', 'impact', a.impact || '')}
<div class="form-group"><label style="font-size:0.66rem">Volume (${Math.round((a.volume||0.75)*100)}%)</label>
  <input type="range" min="0" max="1" step="0.05" value="${a.volume||0.75}" oninput="psSetAudio('volume',parseFloat(this.value))" style="width:100%">
</div>
<div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0 4px">
  <div style="font-size:0.62rem;color:var(--suave);text-transform:uppercase">Eventos por tempo</div>
  <button onclick="psAddAudioEvent()" style="background:none;border:1px solid var(--borda);border-radius:3px;color:var(--suave);font-size:0.6rem;cursor:pointer;padding:1px 6px">+ Evento</button>
</div>
${evs.map((ev, i) => `<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">
  <input type="number" min="0" max="1" step="0.05" value="${ev.t ?? 0}" title="tempo" onchange="psUpdateAudioEvent(${i},'t',parseFloat(this.value))" style="width:42px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.64rem;text-align:center">
  <select onchange="psUpdateAudioEvent(${i},'sfx',this.value)" style="flex:1;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.62rem">${_psSfxOptions(ev.sfx)}</select>
  <button onclick="psTestSfxId('${_esc(ev.sfx||'')}')" style="background:none;border:none;color:var(--primario);cursor:pointer;font-size:0.68rem">🔊</button>
  <button onclick="psRemoveAudioEvent(${i})" style="background:none;border:none;color:var(--perigo);cursor:pointer;font-size:0.68rem">✕</button>
</div>`).join('')}
</div>`;
}
function psSetAudio(key, val) {
  const cfg = PIXI_STUDIO_STATE.atual?.config_json; if (!cfg) return;
  if (!cfg.audio) cfg.audio = {};
  cfg.audio[key] = val; _psSetDirty(true);
}
function psSetSfx(which, val) {
  if (val === '__url__') { psSetAudio(which, 'https://'); _psRenderPropsPanel(); return; }
  psSetAudio(which, val);
}
function psTestSfx(which) {
  const cfg = PIXI_STUDIO_STATE.atual?.config_json;
  if (cfg?.audio && typeof AudioManager !== 'undefined' && cfg.audio[which])
    AudioManager.playSFX(cfg.audio[which], { volume: cfg.audio.volume ?? 0.75 });
}
function psTestSfxId(id) { if (id && typeof AudioManager !== 'undefined') AudioManager.playSFX(id, { volume: 0.75 }); }
function psAddAudioEvent() {
  const cfg = PIXI_STUDIO_STATE.atual?.config_json; if (!cfg) return;
  if (!cfg.audio) cfg.audio = {};
  if (!cfg.audio.events) cfg.audio.events = [];
  cfg.audio.events.push({ t: 0.5, sfx: '' });
  _psSetDirty(true); _psRenderPropsPanel();
}
function psUpdateAudioEvent(i, key, val) {
  const evs = PIXI_STUDIO_STATE.atual?.config_json?.audio?.events;
  if (!evs || !evs[i]) return;
  evs[i][key] = val; _psSetDirty(true);
}
function psRemoveAudioEvent(i) {
  const evs = PIXI_STUDIO_STATE.atual?.config_json?.audio?.events;
  if (!evs) return;
  evs.splice(i, 1); _psSetDirty(true); _psRenderPropsPanel();
}

// ── Lighting (bloom + tone) ──────────────────────────────────────────────────
function _psLightingHtml(cfg) {
  const L = cfg.lighting || {};
  const b = L.bloom || {};
  return `<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:4px">
<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;margin-bottom:8px">Iluminação</div>
<label style="display:flex;align-items:center;gap:6px;font-size:0.7rem;cursor:pointer;margin-bottom:6px">
  <input type="checkbox" ${L.bloom ? 'checked' : ''} onchange="psToggleBloom(this.checked)"> Bloom (brilho cinematográfico)</label>
${L.bloom ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
  <div class="form-group"><label style="font-size:0.6rem;display:flex;justify-content:space-between">Limiar<span>${(b.threshold??0.4).toFixed(2)}</span></label>
    <input type="range" min="0" max="1" step="0.05" value="${b.threshold??0.4}" oninput="this.previousElementSibling.querySelector('span').textContent=parseFloat(this.value).toFixed(2);psSetLighting('bloom.threshold',parseFloat(this.value))" style="width:100%"></div>
  <div class="form-group"><label style="font-size:0.6rem;display:flex;justify-content:space-between">Intensidade<span>${(b.intensity??1.5).toFixed(1)}</span></label>
    <input type="range" min="0" max="4" step="0.1" value="${b.intensity??1.5}" oninput="this.previousElementSibling.querySelector('span').textContent=parseFloat(this.value).toFixed(1);psSetLighting('bloom.intensity',parseFloat(this.value))" style="width:100%"></div>
</div>` : ''}
<div class="form-group"><label style="font-size:0.66rem">Tom de cor</label>
  <select onchange="psSetLighting('tone',this.value)" style="width:100%;padding:5px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
    ${[['none','nenhum'],['filmic','filmic'],['aces','aces']].map(([v,l])=>`<option value="${v}"${(L.tone||'none')===v?' selected':''}>${l}</option>`).join('')}
  </select></div>
</div>`;
}
function psToggleBloom(on) {
  const cfg = PIXI_STUDIO_STATE.atual?.config_json; if (!cfg) return;
  if (!cfg.lighting) cfg.lighting = {};
  cfg.lighting.bloom = on ? (cfg.lighting.bloom || { threshold: 0.4, intensity: 1.5, quality: 6 }) : null;
  _psSetDirty(true);
  if (on && typeof _avtEnsurePixiFilter === 'function') _avtEnsurePixiFilter('bloom').then(() => psPreviewRebuildAll());
  else psPreviewRebuildAll();
  _psRenderPropsPanel();
}
function psSetLighting(path, val) {
  const cfg = PIXI_STUDIO_STATE.atual?.config_json; if (!cfg) return;
  if (!cfg.lighting) cfg.lighting = {};
  if (path.includes('.')) {
    const [a, b] = path.split('.');
    if (!cfg.lighting[a]) cfg.lighting[a] = {};
    cfg.lighting[a][b] = val;
  } else cfg.lighting[path] = (val === 'none' ? 'none' : val);
  _psSetDirty(true); psPreviewRebuildAll();
}

// ── Screen post-FX (animation-level filter stack) ────────────────────────────
function _psScreenFxHtml(cfg) {
  return `<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:4px">
<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;margin-bottom:4px">Efeitos de Tela</div>
${_psFilterStackHtmlFor('__anim__', cfg.filters)}</div>`;
}

// ── Quality / particle budget ────────────────────────────────────────────────
function _psQualityHtml(cfg) {
  const budget = (cfg.layers || []).reduce((s, l) => s + (l.tipo === 'emitter' ? (l.emitter?.maxParticles || 0) : 0), 0);
  const over = budget > 600;
  return `<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:4px">
<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;margin-bottom:6px">Desempenho</div>
<div class="form-group" style="margin-bottom:6px"><label style="font-size:0.66rem">Qualidade</label>
  <select onchange="psUpdateConfigProp('quality',this.value)" style="width:100%;padding:5px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
    ${[['alto','Alto (PC)'],['baixo','Baixo (celular)']].map(([v,l])=>`<option value="${v}"${(cfg.quality||'alto')===v?' selected':''}>${l}</option>`).join('')}
  </select></div>
<div style="font-size:0.62rem;color:${over ? 'var(--perigo)' : 'var(--suave)'}">Orçamento de partículas: ${budget}${over ? ' ⚠ pesado p/ celular (reduza)' : ''}</div>
</div>`;
}

function _psEmitterPanelHtml(layer) {
  const e = layer.emitter || {};
  const spawnFields = _psSpawnFieldsHtml(layer);
  return `
<div style="font-family:var(--fonte-d);font-size:0.7rem;color:var(--destaque);margin-bottom:10px">✦ Emissor: ${_esc(layer.nome)}</div>
${_psLayerCommonHtml(layer)}
<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:6px">
<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;margin-bottom:8px">Textura</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
  <div class="form-group"><label style="font-size:0.66rem">Builtin</label>
    <select onchange="psUpdateLayerProp('${layer.id}','texture',this.value)"
      style="width:100%;padding:5px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
      ${['spark','glow','smoke','ember','ring','streak','star','noise','rune','arrowhead','blade_slice','sparkle','shard','crescent','swirl','bolt','petal','hexagon','snowflake'].map(t=>`<option value="${t}"${layer.texture===t?' selected':''}>${t}</option>`).join('')}
    </select></div>
  <div class="form-group"><label style="font-size:0.66rem">Upload PNG</label>
    <input type="file" accept="image/png,image/gif,image/webp" onchange="psUploadTexture('${layer.id}',this)"
      style="font-size:0.66rem;width:100%">
    ${layer.texture_url ? `<a href="${layer.texture_url}" target="_blank" style="font-size:0.6rem;color:var(--primario)">ver atual</a>` : ''}
  </div>
</div>
<div class="form-group" style="margin-bottom:6px"><label style="font-size:0.66rem">Blend Mode</label>
  <select onchange="psUpdateLayerProp('${layer.id}','blendMode',this.value)"
    style="width:100%;padding:5px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
    ${['add','normal','multiply','screen'].map(m=>`<option value="${m}"${layer.blendMode===m?' selected':''}>${m}</option>`).join('')}
  </select></div>
</div>
<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:6px">
<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;margin-bottom:8px">Partículas</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
  ${_psRangeHtml(layer.id, 'Max Partículas', 'emitter.maxParticles', e.maxParticles||60, 1, 300, 1, true)}
  ${_psRangeHtml(layer.id, 'Freq (s)', 'emitter.frequency', e.frequency||0.01, 0.001, 0.5, 0.001, true)}
  ${_psRangeHtml(layer.id, 'Vida Min', 'emitter.lifetime.min', e.lifetime?.min||0.3, 0.05, 5, 0.05, true)}
  ${_psRangeHtml(layer.id, 'Vida Max', 'emitter.lifetime.max', e.lifetime?.max||0.6, 0.05, 5, 0.05, true)}
  ${_psRangeHtml(layer.id, 'Tempo Emis', 'emitter.emitterLifetime', e.emitterLifetime||0.3, -1, 10, 0.05, true)}
  ${_psRangeHtml(layer.id, 'Veloc Ini', 'emitter.speed.start', e.speed?.start||180, 0, 1000, 5, true)}
  ${_psRangeHtml(layer.id, 'Veloc Fim', 'emitter.speed.end', e.speed?.end||40, 0, 1000, 5, true)}
  ${_psRangeHtml(layer.id, 'Acel X', 'emitter.acceleration.x', e.acceleration?.x||0, -500, 500, 5, true)}
  ${_psRangeHtml(layer.id, 'Acel Y', 'emitter.acceleration.y', e.acceleration?.y||0, -500, 500, 5, true)}
  ${_psRangeHtml(layer.id, 'Rot Min (°/s)', 'emitter.rotationSpeed.min', e.rotationSpeed?.min||0, -720, 720, 5, true)}
  ${_psRangeHtml(layer.id, 'Rot Max (°/s)', 'emitter.rotationSpeed.max', e.rotationSpeed?.max||0, -720, 720, 5, true)}
</div>
</div>
${_psColorGradientHtml(layer)}
${_psAlphaCurveHtml(layer)}
${_psScaleCurveHtml(layer)}
${spawnFields}
${_psLayerFxHtml(layer)}`;
}

// Glow / trail / tint / light-cast / parallax / sub-emitters / filter stack — authoring power
function _psLayerFxHtml(layer) {
  const g = layer.glow || {};
  const tr = layer.trail || {};
  const lc = layer.lightCast || {};
  const sec = (title) => `<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;margin:10px 0 6px">${title}</div>`;
  const chk = (on, oninput, label) => `<label style="display:flex;align-items:center;gap:6px;font-size:0.7rem;cursor:pointer;margin-bottom:6px"><input type="checkbox" ${on?'checked':''} onchange="${oninput}"> ${label}</label>`;
  return `<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:6px">
${sec('Brilho (Glow)')}
${chk(!!layer.glow, `psToggleLayerGlow('${layer.id}',this.checked)`, 'Ativar glow')}
${layer.glow ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:end">
  <div class="form-group"><label style="font-size:0.62rem">Cor</label>
    <input type="color" value="${g.color||'#ffffff'}" oninput="psUpdateLayerProp('${layer.id}','glow.color',this.value)" style="width:100%;height:28px;padding:1px;background:none;border:1px solid var(--borda);border-radius:4px;cursor:pointer"></div>
  ${_psRangeHtml(layer.id,'Distância','glow.distance',g.distance??14,0,40,1,false)}
  ${_psRangeHtml(layer.id,'Força ext','glow.outerStrength',g.outerStrength??2,0,8,0.1,false)}
  ${_psRangeHtml(layer.id,'Força int','glow.innerStrength',g.innerStrength??0,0,8,0.1,false)}
</div>` : ''}
${sec('Rastro (Trail)')}
${chk(!!layer.trail, `psToggleLayerTrail('${layer.id}',this.checked)`, 'Ativar rastro')}
${layer.trail ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
  ${_psRangeHtml(layer.id,'Comprimento','trail.length',tr.length??8,2,40,1,false)}
  ${_psRangeHtml(layer.id,'Fade','trail.fade',tr.fade??0.8,0.3,0.98,0.01,false)}
</div>` : ''}
${sec('Cor & Luz')}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:end;margin-bottom:6px">
  <div class="form-group"><label style="font-size:0.62rem">Tint partícula</label>
    <input type="color" value="${layer.tint||'#ffffff'}" oninput="psUpdateLayerProp('${layer.id}','tint',this.value)" style="width:100%;height:28px;padding:1px;background:none;border:1px solid var(--borda);border-radius:4px;cursor:pointer"></div>
  ${_psRangeHtml(layer.id,'Parallax','parallax',layer.parallax??0,0,1,0.05,false)}
</div>
${chk(!!layer.lightCast, `psToggleLayerLightCast('${layer.id}',this.checked)`, 'Projeção de luz (light cast)')}
${layer.lightCast ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:end">
  <div class="form-group"><label style="font-size:0.62rem">Cor da luz</label>
    <input type="color" value="${lc.color||'#ffffff'}" oninput="psUpdateLayerProp('${layer.id}','lightCast.color',this.value)" style="width:100%;height:28px;padding:1px;background:none;border:1px solid var(--borda);border-radius:4px;cursor:pointer"></div>
  ${_psRangeHtml(layer.id,'Raio','lightCast.radius',lc.radius??90,10,300,5,false)}
  ${_psRangeHtml(layer.id,'Intensidade','lightCast.alpha',lc.alpha??0.6,0,1,0.05,false)}
</div>` : ''}
${_psFilterStackHtml(layer)}
</div>`;
}

function psToggleLayerGlow(id, on) {
  const l = _psGetLayer(id); if (!l) return;
  l.glow = on ? (l.glow || { distance: 14, outerStrength: 2, innerStrength: 0, color: '#ffffff' }) : null;
  _psSetDirty(true);
  if (on && typeof _avtEnsurePixiFilter === 'function') _avtEnsurePixiFilter('glow').then(() => psPreviewRebuildAll());
  else psPreviewRebuildAll();
  _psRenderPropsPanel();
}
function psToggleLayerTrail(id, on) {
  const l = _psGetLayer(id); if (!l) return;
  l.trail = on ? (l.trail || { length: 8, fade: 0.8 }) : null;
  _psSetDirty(true); psPreviewRebuildAll(); _psRenderPropsPanel();
}
function psToggleLayerLightCast(id, on) {
  const l = _psGetLayer(id); if (!l) return;
  l.lightCast = on ? (l.lightCast || { color: '#ffffff', radius: 90, alpha: 0.6 }) : null;
  _psSetDirty(true); psPreviewRebuildAll(); _psRenderPropsPanel();
}
function psToggleSpritesheet(id, on) {
  const l = _psGetLayer(id); if (!l) return;
  l.sprite_frames = on ? (l.sprite_frames || { cols: 4, rows: 1, fps: 12 }) : null;
  _psSetDirty(true); psPreviewRebuildAll(); _psRenderPropsPanel();
}

// ── Filter stack (per layer or per animation via id '__anim__') ───────────────
const _PS_FILTER_PARAMS = {
  blur:        [{ k:'strength', l:'Força', min:0, max:20, step:0.5, def:4 }],
  noise:       [{ k:'amount', l:'Qtd', min:0, max:1, step:0.05, def:0.2 }],
  bloom:       [{ k:'threshold', l:'Limiar', min:0, max:1, step:0.05, def:0.5 }, { k:'bloomScale', l:'Escala', min:0, max:4, step:0.1, def:1.5 }],
  shockwave:   [{ k:'amplitude', l:'Amplitude', min:0, max:80, step:1, def:30 }, { k:'wavelength', l:'Onda', min:20, max:400, step:5, def:160 }, { k:'speed', l:'Veloc', min:50, max:1500, step:25, def:500 }],
  displacement:[{ k:'scaleX', l:'Escala X', min:0, max:120, step:2, def:30 }, { k:'scaleY', l:'Escala Y', min:0, max:120, step:2, def:30 }],
  rgbsplit:    [{ k:'rx', l:'R x', min:-20, max:20, step:1, def:-5 }, { k:'bx', l:'B x', min:-20, max:20, step:1, def:5 }],
  godray:      [{ k:'gain', l:'Ganho', min:0, max:1, step:0.05, def:0.5 }, { k:'angle', l:'Ângulo', min:-90, max:90, step:5, def:30 }],
  outline:     [{ k:'thickness', l:'Espessura', min:1, max:10, step:1, def:2 }],
  crt:         [{ k:'curvature', l:'Curva', min:0, max:5, step:0.5, def:1 }, { k:'noise', l:'Ruído', min:0, max:1, step:0.05, def:0.2 }],
};
const _PS_FILTER_TYPES = Object.keys(_PS_FILTER_PARAMS);

function _psFilterArr(id, create) {
  if (id === '__anim__') {
    const cfg = PIXI_STUDIO_STATE.atual?.config_json; if (!cfg) return null;
    if (create && !cfg.filters) cfg.filters = []; return cfg.filters;
  }
  const layer = _psGetLayer(id); if (!layer) return null;
  if (create && !layer.filters) layer.filters = []; return layer.filters;
}
function _psFilterStackHtml(layer) { return _psFilterStackHtmlFor(layer.id, layer.filters); }
function _psFilterStackHtmlFor(id, filters) {
  filters = filters || [];
  const rows = filters.map((f, i) => `
    <div style="border:1px solid var(--borda);border-radius:5px;padding:5px 6px;margin-bottom:5px;background:rgba(255,255,255,0.02)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <span style="font-family:var(--fonte-d);font-size:0.66rem;color:var(--primario)">${f.type}</span>
        <button onclick="psRemoveFilter('${id}',${i})" style="background:none;border:none;color:var(--perigo);cursor:pointer;font-size:0.7rem">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
        ${(_PS_FILTER_PARAMS[f.type]||[]).map(p=>`<div class="form-group"><label style="font-size:0.6rem;display:flex;justify-content:space-between">${p.l}<span>${f[p.k]??p.def}</span></label>
          <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${f[p.k]??p.def}"
            oninput="this.previousElementSibling.querySelector('span').textContent=this.value;psUpdateFilterParam('${id}',${i},'${p.k}',parseFloat(this.value))" style="width:100%"></div>`).join('')}
      </div>
    </div>`).join('');
  return `<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;margin:10px 0 6px">Filtros / Shaders</div>
${rows}
<select onchange="if(this.value){psAddFilter('${id}',this.value);this.value=''}"
  style="width:100%;padding:5px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.7rem">
  <option value="">+ Adicionar filtro…</option>
  ${_PS_FILTER_TYPES.map(t=>`<option value="${t}">${t}</option>`).join('')}
</select>`;
}
function psAddFilter(id, type) {
  const arr = _psFilterArr(id, true); if (!arr) return;
  const spec = { type };
  (_PS_FILTER_PARAMS[type] || []).forEach(p => { spec[p.k] = p.def; });
  arr.push(spec);
  _psSetDirty(true);
  if (typeof _avtEnsurePixiFilter === 'function') _avtEnsurePixiFilter(type).then(() => { psPreviewRebuildAll(); }).catch(() => {});
  psPreviewRebuildAll(); _psRenderPropsPanel();
}
function psRemoveFilter(id, idx) {
  const arr = _psFilterArr(id, false); if (!arr) return;
  arr.splice(idx, 1);
  _psSetDirty(true); psPreviewRebuildAll(); _psRenderPropsPanel();
}
function psUpdateFilterParam(id, idx, key, val) {
  const arr = _psFilterArr(id, false); if (!arr || !arr[idx]) return;
  arr[idx][key] = val;
  _psSetDirty(true); psPreviewRebuildAll();
}

function _psLayerCommonHtml(layer) {
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
  <div class="form-group"><label style="font-size:0.66rem">Nome</label>
    <input type="text" value="${_esc(layer.nome)}" oninput="psUpdateLayerProp('${layer.id}','nome',this.value);_psRenderLayerList()"
      style="width:100%;padding:4px 6px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.78rem"></div>
  <div class="form-group"><label style="font-size:0.66rem">Z-order</label>
    <input type="number" value="${layer.z||0}" min="0" max="20" oninput="psUpdateLayerProp('${layer.id}','z',parseInt(this.value)||0)"
      style="width:100%;padding:4px 6px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.78rem;text-align:center"></div>
</div>`;
}

function _psRangeHtml(layerId, label, key, val, min, max, step, isEmitter) {
  const fn = isEmitter ? `psUpdateEmitterProp('${layerId}','${key}',parseFloat(this.value)||${val})`
                       : `psUpdateLayerProp('${layerId}','${key}',parseFloat(this.value)||${val})`;
  return `<div class="form-group"><label style="font-size:0.62rem;display:flex;justify-content:space-between">${label}<span id="ps-rv-${layerId}-${key.replace(/\./g,'-')}">${val}</span></label>
  <input type="range" min="${min}" max="${max}" step="${step}" value="${val}"
    oninput="document.getElementById('ps-rv-${layerId}-${key.replace(/\./g,'-')}').textContent=this.value;${fn}"
    style="width:100%"></div>`;
}

function _psColorGradientHtml(layer) {
  const list = layer.emitter?.color?.list || [{ value: 'ffffff', time: 0 }, { value: 'ff8040', time: 1 }];
  const stops = list.map((s, i) => `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      <input type="color" value="#${s.value}" oninput="psUpdateColorStop('${layer.id}',${i},'value',this.value.slice(1))"
        style="width:30px;height:24px;padding:1px;background:none;border:1px solid var(--borda);border-radius:3px;cursor:pointer">
      <input type="range" min="0" max="1" step="0.01" value="${s.time}"
        oninput="psUpdateColorStop('${layer.id}',${i},'time',parseFloat(this.value))" style="flex:1">
      <span style="font-size:0.6rem;color:var(--suave);min-width:28px">${Math.round(s.time*100)}%</span>
      ${list.length > 2 ? `<button onclick="psRemoveColorStop('${layer.id}',${i})"
        style="background:none;border:none;color:var(--perigo);cursor:pointer;font-size:0.7rem">✕</button>` : ''}
    </div>`).join('');
  return `<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:6px">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
  <div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase">Gradiente de Cor</div>
  <button onclick="psAddColorStop('${layer.id}')" style="background:none;border:1px solid var(--borda);border-radius:3px;color:var(--suave);font-size:0.6rem;cursor:pointer;padding:1px 6px">+ Stop</button>
</div>
<div style="height:16px;border-radius:4px;margin-bottom:8px;background:linear-gradient(to right,${list.map(s=>`#${s.value} ${s.time*100}%`).join(',')})"></div>
${stops}</div>`;
}

function _psCurveRowsHtml(layer, list, maxVal, valFn, timeFn, rmFn) {
  return list.map((s, i) => `<div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
  <input type="range" min="0" max="1" step="0.01" value="${s.time}" title="tempo"
    oninput="${timeFn}('${layer.id}',${i},parseFloat(this.value))" style="width:54px">
  <span style="font-size:0.58rem;color:var(--suave);min-width:26px">${Math.round(s.time*100)}%</span>
  <input type="range" min="0" max="${maxVal}" step="0.01" value="${s.value}"
    oninput="${valFn}('${layer.id}',${i},parseFloat(this.value));this.nextElementSibling.textContent=parseFloat(this.value).toFixed(2)" style="flex:1">
  <span style="font-size:0.58rem;color:var(--suave);min-width:28px">${s.value.toFixed(2)}</span>
  ${list.length > 2 ? `<button onclick="${rmFn}('${layer.id}',${i})" style="background:none;border:none;color:var(--perigo);cursor:pointer;font-size:0.7rem">✕</button>` : '<span style="width:10px"></span>'}
</div>`).join('');
}
function _psAlphaCurveHtml(layer) {
  const list = layer.emitter?.alpha?.list || [{ value: 0.9, time: 0 }, { value: 0, time: 1 }];
  return `<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:6px">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
  <div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase">Curva Alpha</div>
  <button onclick="psAddAlphaStop('${layer.id}')" style="background:none;border:1px solid var(--borda);border-radius:3px;color:var(--suave);font-size:0.6rem;cursor:pointer;padding:1px 6px">+ Stop</button>
</div>
${_psCurveRowsHtml(layer, list, 1, 'psUpdateAlphaStop', 'psUpdateAlphaStopTime', 'psRemoveAlphaStop')}</div>`;
}

function _psScaleCurveHtml(layer) {
  const list = layer.emitter?.scale?.list || [{ value: 0.4, time: 0 }, { value: 0.05, time: 1 }];
  return `<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:6px">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
  <div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase">Curva de Escala</div>
  <button onclick="psAddScaleStop('${layer.id}')" style="background:none;border:1px solid var(--borda);border-radius:3px;color:var(--suave);font-size:0.6rem;cursor:pointer;padding:1px 6px">+ Stop</button>
</div>
${_psCurveRowsHtml(layer, list, 3, 'psUpdateScaleStop', 'psUpdateScaleStopTime', 'psRemoveScaleStop')}</div>`;
}

function _psSpawnFieldsHtml(layer) {
  const e = layer.emitter || {};
  const spawnType = e.spawnType || 'circle';
  const sr = e.startRotation || { min: 0, max: 360 };
  const dir = Math.round(((sr.min ?? 0) + (sr.max ?? 360)) / 2);
  const spread = Math.round((sr.max ?? 360) - (sr.min ?? 0));
  const ox = layer.offset?.x ?? 0, oy = layer.offset?.y ?? 0;
  const numInput = (label, val, oninput, attrs = '') =>
    `<div class="form-group"><label style="font-size:0.62rem">${label}</label>
      <input type="number" value="${val}" ${attrs} oninput="${oninput}"
        style="width:100%;padding:3px 5px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem;text-align:center"></div>`;
  return `<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:6px">
<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;margin-bottom:8px">Origem & Direção</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
  ${numInput('Origem X', ox, `psUpdateLayerOffset('${layer.id}','x',parseFloat(this.value)||0)`)}
  ${numInput('Origem Y', oy, `psUpdateLayerOffset('${layer.id}','y',parseFloat(this.value)||0)`)}
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:4px">
  <div class="form-group"><label style="font-size:0.62rem">Direção (°)</label>
    <input type="number" id="ps-dir-${layer.id}" value="${dir}" min="-360" max="360" step="5" oninput="psUpdateEmitterDir('${layer.id}')"
      style="width:100%;padding:3px 5px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem;text-align:center"></div>
  <div class="form-group"><label style="font-size:0.62rem">Abertura (°)</label>
    <input type="number" id="ps-spread-${layer.id}" value="${spread}" min="0" max="360" step="5" oninput="psUpdateEmitterDir('${layer.id}')"
      style="width:100%;padding:3px 5px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem;text-align:center"></div>
</div>
<div style="font-size:0.58rem;color:var(--suave);margin-bottom:4px">Arraste o ✛ no preview para mover a origem.</div>
<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;margin:8px 0">Spawn</div>
<div class="form-group" style="margin-bottom:6px"><label style="font-size:0.66rem">Forma do nascimento</label>
  <select onchange="psSetSpawnType('${layer.id}',this.value)"
    style="width:100%;padding:5px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
    ${['point','circle','ring','rect','burst'].map(t=>`<option value="${t}"${spawnType===t?' selected':''}>${t}</option>`).join('')}
  </select></div>
${spawnType==='circle'||spawnType==='ring' ? `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
  ${_psRangeHtml(layer.id,'Raio','emitter.spawnCircle.r',e.spawnCircle?.r||5,0,200,1,true)}
</div>` : ''}
${spawnType==='rect' ? `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
  ${numInput('Largura', e.spawnRect?.w||40, `psUpdateSpawnRect('${layer.id}','w',parseFloat(this.value)||1)`, 'min="1" max="400" step="1"')}
  ${numInput('Altura', e.spawnRect?.h||40, `psUpdateSpawnRect('${layer.id}','h',parseFloat(this.value)||1)`, 'min="1" max="400" step="1"')}
</div>` : ''}
${spawnType==='burst' ? `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
  ${_psRangeHtml(layer.id,'Por Onda','emitter.particlesPerWave',e.particlesPerWave||10,1,100,1,true)}
</div>` : ''}
</div>`;
}

function _psSpriteShapeHtml(layer, tipo) {
  const kfs = layer.keyframes || [];
  const isShape = tipo === 'shape';
  return `
<div style="font-family:var(--fonte-d);font-size:0.7rem;color:var(--destaque);margin-bottom:10px">${isShape?'◯ Forma':'🖼 Sprite'}: ${_esc(layer.nome)}</div>
${_psLayerCommonHtml(layer)}
${isShape ? `
<div class="form-group" style="margin-bottom:8px"><label style="font-size:0.66rem">Tipo de Forma</label>
  <select onchange="psUpdateLayerProp('${layer.id}','shape_type',this.value);_psRenderPropsPanel()"
    style="width:100%;padding:5px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
    ${['circle','rect','polygon'].map(t=>`<option value="${t}"${layer.shape_type===t?' selected':''}>${t}</option>`).join('')}
  </select></div>
${layer.shape_type === 'polygon' ? `<div class="form-group" style="margin-bottom:8px"><label style="font-size:0.66rem">Lados</label>
  <input type="number" min="3" max="12" step="1" value="${layer.sides||6}" oninput="psUpdateLayerProp('${layer.id}','sides',parseInt(this.value)||6)"
    style="width:100%;padding:4px 6px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem;text-align:center"></div>` : ''}` : `
<div class="form-group" style="margin-bottom:8px"><label style="font-size:0.66rem">Imagem (URL ou Upload)</label>
  <input type="text" value="${_esc(layer.texture_url||'')}" placeholder="https://..."
    oninput="psUpdateLayerProp('${layer.id}','texture_url',this.value)"
    style="width:100%;padding:4px 6px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
  <input type="file" accept="image/*" onchange="psUploadTexture('${layer.id}',this)" style="font-size:0.66rem;margin-top:4px;width:100%">
  <div style="margin-top:8px;border:1px solid var(--borda);border-radius:5px;padding:6px 8px">
    <label style="display:flex;align-items:center;gap:6px;font-size:0.68rem;cursor:pointer;margin-bottom:${layer.sprite_frames?'6px':'0'}">
      <input type="checkbox" ${layer.sprite_frames?'checked':''} onchange="psToggleSpritesheet('${layer.id}',this.checked)"> Spritesheet animado</label>
    ${layer.sprite_frames ? `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px">
      <div class="form-group"><label style="font-size:0.6rem">Colunas</label><input type="number" min="1" value="${layer.sprite_frames.cols||1}" oninput="psUpdateLayerProp('${layer.id}','sprite_frames.cols',parseInt(this.value)||1);psPreviewRebuildAll()" style="width:100%;padding:3px;background:var(--painel);border:1px solid var(--borda);border-radius:3px;color:var(--texto);font-size:0.66rem;text-align:center"></div>
      <div class="form-group"><label style="font-size:0.6rem">Linhas</label><input type="number" min="1" value="${layer.sprite_frames.rows||1}" oninput="psUpdateLayerProp('${layer.id}','sprite_frames.rows',parseInt(this.value)||1);psPreviewRebuildAll()" style="width:100%;padding:3px;background:var(--painel);border:1px solid var(--borda);border-radius:3px;color:var(--texto);font-size:0.66rem;text-align:center"></div>
      <div class="form-group"><label style="font-size:0.6rem">FPS</label><input type="number" min="1" max="60" value="${layer.sprite_frames.fps||12}" oninput="psUpdateLayerProp('${layer.id}','sprite_frames.fps',parseInt(this.value)||12);psPreviewRebuildAll()" style="width:100%;padding:3px;background:var(--painel);border:1px solid var(--borda);border-radius:3px;color:var(--texto);font-size:0.66rem;text-align:center"></div>
    </div>` : ''}
  </div>
</div>`}
<div class="form-group" style="margin-bottom:8px"><label style="font-size:0.66rem">Blend Mode</label>
  <select onchange="psUpdateLayerProp('${layer.id}','blendMode',this.value)"
    style="width:100%;padding:5px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
    ${['add','normal','multiply','screen'].map(m=>`<option value="${m}"${layer.blendMode===m?' selected':''}>${m}</option>`).join('')}
  </select></div>
${!isShape ? `
<div style="background:rgba(79,163,209,0.06);border:1px solid rgba(79,163,209,0.18);border-radius:6px;padding:8px 10px;margin-bottom:8px">
  <div style="font-family:var(--fonte-d);font-size:0.6rem;color:var(--primario);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Transformação Base</div>
  <div class="form-group" style="margin-bottom:6px">
    <label style="font-size:0.66rem">Escala base: <b id="ps-bs-lbl-${layer.id}">${(layer.base_scale??1).toFixed(2)}×</b></label>
    <input type="range" min="0.05" max="10" step="0.05" value="${layer.base_scale??1}"
      oninput="psUpdateLayerProp('${layer.id}','base_scale',parseFloat(this.value));document.getElementById('ps-bs-lbl-${layer.id}').textContent=parseFloat(this.value).toFixed(2)+'×'"
      style="width:100%">
  </div>
  <div style="display:flex;gap:8px;align-items:center">
    <label style="font-size:0.7rem;display:flex;align-items:center;gap:4px;cursor:pointer">
      <input type="checkbox" ${layer.flip_x?'checked':''} onchange="psUpdateLayerProp('${layer.id}','flip_x',this.checked)"> Espelhar X
    </label>
    <label style="font-size:0.7rem;display:flex;align-items:center;gap:4px;cursor:pointer">
      <input type="checkbox" ${layer.flip_y?'checked':''} onchange="psUpdateLayerProp('${layer.id}','flip_y',this.checked)"> Espelhar Y
    </label>
  </div>
</div>` : ''}
<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:6px">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
  <div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase">Keyframes</div>
  <button onclick="psAddKeyframe('${layer.id}',0.5)" style="background:none;border:1px solid var(--borda);border-radius:3px;color:var(--suave);font-size:0.6rem;cursor:pointer;padding:1px 6px">+ KF</button>
</div>
${kfs.length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.67rem;min-width:${isShape?'160px':'220px'}">
<thead><tr style="color:var(--suave)">${
  isShape
    ? '<th style="padding:2px">t</th><th style="padding:2px">Raio</th><th style="padding:2px">Traço</th><th style="padding:2px">α</th><th style="padding:2px">Fill</th><th style="padding:2px">fα</th><th style="padding:2px">ease</th><th></th>'
    : '<th style="padding:2px">t</th><th style="padding:2px">x</th><th style="padding:2px">y</th><th style="padding:2px">sc</th><th style="padding:2px">rot°</th><th style="padding:2px">α</th><th style="padding:2px">ease</th><th></th>'
}</tr></thead><tbody>
${kfs.map((k,i)=>`<tr style="border-top:1px solid rgba(255,255,255,0.05)">${
  isShape
    ? `<td><input type="number" min="0" max="1" step="0.01" value="${k.t}" onchange="psUpdateKeyframe('${layer.id}',${i},{t:parseFloat(this.value)})" style="width:34px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>
       <td><input type="number" value="${k.radius||0}" onchange="psUpdateKeyframe('${layer.id}',${i},{radius:parseFloat(this.value)})" style="width:34px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>
       <td><input type="color" value="${k.stroke_color||'#ffffff'}" onchange="psUpdateKeyframe('${layer.id}',${i},{stroke_color:this.value})" style="width:28px;height:22px;padding:1px;background:none;border:1px solid var(--borda);border-radius:2px;cursor:pointer"></td>
       <td><input type="number" min="0" max="1" step="0.05" value="${k.stroke_alpha||1}" onchange="psUpdateKeyframe('${layer.id}',${i},{stroke_alpha:parseFloat(this.value)})" style="width:32px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>
       <td><input type="color" value="${k.fill_color||'#ffffff'}" onchange="psUpdateKeyframe('${layer.id}',${i},{fill_color:this.value})" style="width:28px;height:22px;padding:1px;background:none;border:1px solid var(--borda);border-radius:2px;cursor:pointer"></td>
       <td><input type="number" min="0" max="1" step="0.05" value="${k.fill_alpha||0}" onchange="psUpdateKeyframe('${layer.id}',${i},{fill_alpha:parseFloat(this.value)})" style="width:32px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>`
    : `<td><input type="number" min="0" max="1" step="0.01" value="${k.t}" onchange="psUpdateKeyframe('${layer.id}',${i},{t:parseFloat(this.value)})" style="width:32px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>
       <td><input type="number" value="${k.x||0}" onchange="psUpdateKeyframe('${layer.id}',${i},{x:parseFloat(this.value)})" style="width:30px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>
       <td><input type="number" value="${k.y||0}" onchange="psUpdateKeyframe('${layer.id}',${i},{y:parseFloat(this.value)})" style="width:30px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>
       <td><input type="number" min="0.01" max="20" step="0.05" value="${k.scale??1}" onchange="psUpdateKeyframe('${layer.id}',${i},{scale:parseFloat(this.value)})" style="width:30px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>
       <td><input type="number" min="-720" max="720" step="1" value="${k.rotation??0}" onchange="psUpdateKeyframe('${layer.id}',${i},{rotation:parseFloat(this.value)})" style="width:34px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>
       <td><input type="number" min="0" max="1" step="0.05" value="${k.alpha??1}" onchange="psUpdateKeyframe('${layer.id}',${i},{alpha:parseFloat(this.value)})" style="width:30px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>`
}<td><select onchange="psUpdateKeyframe('${layer.id}',${i},{ease:this.value})" title="Curva de aceleração até o próximo keyframe" style="width:62px;padding:1px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.58rem">${PS_EASING_NAMES.map(n=>`<option value="${n}"${(k.ease||'linear')===n?' selected':''}>${n.replace('ease','')||'linear'}</option>`).join('')}</select></td><td><button onclick="psRemoveKeyframe('${layer.id}',${i})" style="background:none;border:none;color:var(--perigo);cursor:pointer;font-size:0.7rem">✕</button></td></tr>`).join('')}
</tbody></table></div>` : '<div style="font-size:0.72rem;color:var(--suave);font-style:italic">Sem keyframes</div>'}
</div>`;
}

function _psBgPanelHtml(layer) {
  return `
<div style="font-family:var(--fonte-d);font-size:0.7rem;color:var(--destaque);margin-bottom:10px">▬ Fundo: ${_esc(layer.nome)}</div>
${_psLayerCommonHtml(layer)}
<div class="form-group" style="margin-bottom:8px"><label style="font-size:0.66rem">Tipo</label>
  <select onchange="psUpdateLayerProp('${layer.id}','bg_type',this.value);_psRenderPropsPanel()"
    style="width:100%;padding:5px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
    ${['solid','gradient','image'].map(t=>`<option value="${t}"${layer.bg_type===t?' selected':''}>${t}</option>`).join('')}
  </select></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
  <div class="form-group"><label style="font-size:0.66rem">${layer.bg_type==='gradient'?'Cor 1':'Cor'}</label>
    <input type="color" value="${layer.bg_color||'#000000'}" oninput="psUpdateLayerProp('${layer.id}','bg_color',this.value)"
      style="width:100%;height:34px;padding:2px;background:none;border:1px solid var(--borda);border-radius:4px;cursor:pointer">
  </div>
  <div class="form-group"><label style="font-size:0.66rem">Alpha (${Math.round((layer.bg_alpha||0)*100)}%)</label>
    <input type="range" min="0" max="1" step="0.05" value="${layer.bg_alpha||0}"
      oninput="psUpdateLayerProp('${layer.id}','bg_alpha',parseFloat(this.value))" style="width:100%">
  </div>
</div>
${layer.bg_type==='gradient' ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
  <div class="form-group"><label style="font-size:0.66rem">Cor 2</label>
    <input type="color" value="${layer.bg_color2||'#222244'}" oninput="psUpdateLayerProp('${layer.id}','bg_color2',this.value)"
      style="width:100%;height:34px;padding:2px;background:none;border:1px solid var(--borda);border-radius:4px;cursor:pointer"></div>
  <div class="form-group"><label style="font-size:0.66rem">Ângulo (°)</label>
    <input type="number" min="0" max="360" step="5" value="${layer.bg_angle||90}" oninput="psUpdateLayerProp('${layer.id}','bg_angle',parseFloat(this.value)||0)"
      style="width:100%;padding:6px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem;text-align:center"></div>
</div>` : ''}
${layer.bg_type==='image' ? `<div class="form-group"><label style="font-size:0.66rem">URL da imagem</label>
  <input type="text" value="${_esc(layer.bg_image_url||'')}" placeholder="https://..." oninput="psUpdateLayerProp('${layer.id}','bg_image_url',this.value)"
    style="width:100%;padding:4px 6px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
</div>` : ''}`;
}

// ══ COLOR / ALPHA / SCALE STOP HELPERS ══════════════════════════════════════

function psUpdateColorStop(layerId, idx, key, value) {
  const layer = _psGetLayer(layerId);
  if (!layer?.emitter?.color?.list) return;
  layer.emitter.color.list[idx][key] = value;
  _psSetDirty(true);
  psPreviewSyncEmitter(layerId);
  // Refresh gradient preview
  const gradEl = document.querySelector(`#ps-props-panel [style*="linear-gradient"]`);
  if (gradEl) {
    const list = layer.emitter.color.list;
    gradEl.style.background = `linear-gradient(to right,${list.map(s=>`#${s.value} ${s.time*100}%`).join(',')})`;
  }
}
function psAddColorStop(layerId) {
  const layer = _psGetLayer(layerId);
  if (!layer?.emitter?.color?.list) return;
  const list = layer.emitter.color.list;
  list.push({ value: 'ffffff', time: 0.5 });
  list.sort((a,b)=>a.time-b.time);
  _psSetDirty(true);
  psPreviewSyncEmitter(layerId);
  _psRenderPropsPanel();
}
function psRemoveColorStop(layerId, idx) {
  const layer = _psGetLayer(layerId);
  if (!layer?.emitter?.color?.list || layer.emitter.color.list.length <= 2) return;
  layer.emitter.color.list.splice(idx, 1);
  _psSetDirty(true);
  psPreviewSyncEmitter(layerId);
  _psRenderPropsPanel();
}
function psUpdateAlphaStop(layerId, idx, value) {
  const layer = _psGetLayer(layerId);
  if (!layer?.emitter?.alpha?.list) return;
  layer.emitter.alpha.list[idx].value = value;
  _psSetDirty(true);
  psPreviewSyncEmitter(layerId);
}
function psUpdateScaleStop(layerId, idx, value) {
  const layer = _psGetLayer(layerId);
  if (!layer?.emitter?.scale?.list) return;
  layer.emitter.scale.list[idx].value = value;
  _psSetDirty(true);
  psPreviewSyncEmitter(layerId);
}
function psAddAlphaStop(layerId) {
  const layer = _psGetLayer(layerId);
  if (!layer?.emitter?.alpha?.list) return;
  layer.emitter.alpha.list.push({ value: 0.5, time: 0.5 });
  layer.emitter.alpha.list.sort((a, b) => a.time - b.time);
  _psSetDirty(true); psPreviewSyncEmitter(layerId); _psRenderPropsPanel();
}
function psRemoveAlphaStop(layerId, idx) {
  const layer = _psGetLayer(layerId);
  if (!layer?.emitter?.alpha?.list || layer.emitter.alpha.list.length <= 2) return;
  layer.emitter.alpha.list.splice(idx, 1);
  _psSetDirty(true); psPreviewSyncEmitter(layerId); _psRenderPropsPanel();
}
function psUpdateAlphaStopTime(layerId, idx, time) {
  const layer = _psGetLayer(layerId);
  if (!layer?.emitter?.alpha?.list?.[idx]) return;
  layer.emitter.alpha.list[idx].time = time;
  layer.emitter.alpha.list.sort((a, b) => a.time - b.time);
  _psSetDirty(true); psPreviewSyncEmitter(layerId); _psRenderPropsPanel();
}
function psAddScaleStop(layerId) {
  const layer = _psGetLayer(layerId);
  if (!layer?.emitter?.scale?.list) return;
  layer.emitter.scale.list.push({ value: 0.3, time: 0.5 });
  layer.emitter.scale.list.sort((a, b) => a.time - b.time);
  _psSetDirty(true); psPreviewSyncEmitter(layerId); _psRenderPropsPanel();
}
function psRemoveScaleStop(layerId, idx) {
  const layer = _psGetLayer(layerId);
  if (!layer?.emitter?.scale?.list || layer.emitter.scale.list.length <= 2) return;
  layer.emitter.scale.list.splice(idx, 1);
  _psSetDirty(true); psPreviewSyncEmitter(layerId); _psRenderPropsPanel();
}
function psUpdateScaleStopTime(layerId, idx, time) {
  const layer = _psGetLayer(layerId);
  if (!layer?.emitter?.scale?.list?.[idx]) return;
  layer.emitter.scale.list[idx].time = time;
  layer.emitter.scale.list.sort((a, b) => a.time - b.time);
  _psSetDirty(true); psPreviewSyncEmitter(layerId); _psRenderPropsPanel();
}

// ── Origin (layer.offset) & emission direction (emitter.startRotation) ────────
function psUpdateLayerOffset(layerId, axis, value) {
  const layer = _psGetLayer(layerId);
  if (!layer) return;
  if (!layer.offset) layer.offset = { x: 0, y: 0 };
  layer.offset[axis] = value;
  _psSetDirty(true);
  if (layer.tipo === 'emitter') psPreviewSyncEmitter(layerId);
  else psPreviewRebuildAll();
}
function psUpdateEmitterDir(layerId) {
  const layer = _psGetLayer(layerId);
  if (!layer || !layer.emitter) return;
  const dir = parseFloat(document.getElementById('ps-dir-' + layerId)?.value) || 0;
  const spread = parseFloat(document.getElementById('ps-spread-' + layerId)?.value);
  const sp = isNaN(spread) ? 360 : spread;
  layer.emitter.startRotation = { min: dir - sp / 2, max: dir + sp / 2 };
  _psSetDirty(true);
  psPreviewSyncEmitter(layerId);
}
function psSetSpawnType(layerId, type) {
  const layer = _psGetLayer(layerId);
  if (!layer?.emitter) return;
  layer.emitter.spawnType = type;
  if (type === 'rect') {
    const r = layer.emitter.spawnRect = layer.emitter.spawnRect || { w: 40, h: 40 };
    r.x = -(r.w || 40) / 2; r.y = -(r.h || 40) / 2;   // center the rect on the spawn origin
  }
  _psSetDirty(true);
  psPreviewSyncEmitter(layerId);
  _psRenderPropsPanel();
}
function psUpdateSpawnRect(layerId, key, val) {
  const layer = _psGetLayer(layerId);
  if (!layer?.emitter) return;
  const r = layer.emitter.spawnRect = layer.emitter.spawnRect || { w: 40, h: 40 };
  r[key] = val;
  r.x = -(r.w || 40) / 2; r.y = -(r.h || 40) / 2;     // keep centered as size changes
  _psSetDirty(true);
  psPreviewSyncEmitter(layerId);
}
function _psBeginDragOrigin(layerId, e) {
  const layer = _psGetLayer(layerId);
  if (!layer) return;
  PIXI_STUDIO_STATE._drag = {
    layerId, type: 'origin',
    startX: e.global.x, startY: e.global.y,
    origX: layer.offset?.x ?? 0, origY: layer.offset?.y ?? 0,
  };
}

// ══ E — PREVIEW ENGINE ════════════════════════════════════════════════════════

// Robust WebGL probe — covers webgl2 + webgl and validates the limits PIXI relies on.
// Some headless/sandbox environments return 0 for MAX_FRAGMENT_UNIFORM_VECTORS or
// MAX_VARYING_VECTORS, which makes PIXI throw "Invalid value of `0` passed to
// checkMaxIfStatementsInShader" inside new PIXI.Application(...).
function _psCheckWebGLOK() {
  try {
    const c = document.createElement('canvas');
    const tryCtx = (name) => { try { return c.getContext(name); } catch (_) { return null; } };
    const gl = tryCtx('webgl2') || tryCtx('webgl') || tryCtx('experimental-webgl');
    if (!gl) return false;
    const frag = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) || 0;
    const vary = gl.getParameter(gl.MAX_VARYING_VECTORS) || 0;
    const tex  = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) || 0;
    return frag > 0 && vary > 0 && tex > 0;
  } catch (_) { return false; }
}

function _psDrawUnsupportedMessage(canvas) {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width || 480, h = canvas.height || 300;
    ctx.fillStyle = '#060a10';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9aa4b2';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Preview indisponível neste ambiente', w / 2, h / 2 - 10);
    ctx.fillStyle = '#5a6370';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('(sem GPU/WebGL compatível)', w / 2, h / 2 + 10);
  } catch (_) {}
}

let _psResizeTimer = null;

async function psPreviewMount() {
  const canvas = document.getElementById('ps-preview-canvas');
  if (!canvas) return;
  psPreviewUnmount();
  if (typeof _avtEnsurePixiParticles !== 'function') return;
  await _avtEnsurePixiParticles().catch(() => {});
  // Pre-load the filter packages this animation needs so the preview is WYSIWYG (glow/bloom/…)
  await _psEnsureFiltersForCfg(PIXI_STUDIO_STATE.atual?.config_json).catch(() => {});
  if (typeof PIXI === 'undefined') return;

  // Use the canvas's rendered CSS size so it fills the container
  const w = canvas.offsetWidth  || 480;
  const h = canvas.offsetHeight || 300;
  canvas.width  = w;
  canvas.height = h;

  // Hard pre-check: PIXI v7 removed the Canvas2D renderer, so a broken WebGL
  // context (sandbox/headless returning 0 for shader limits) makes
  // `new PIXI.Application(...)` throw "Invalid value of `0` passed to
  // checkMaxIfStatementsInShader". There is no `forceCanvas` fallback anymore —
  // we just paint a friendly message and bail out.
  if (!_psCheckWebGLOK()) {
    console.warn('[pixi-studio] WebGL not usable in this environment — preview disabled');
    _psDrawUnsupportedMessage(canvas);
    return;
  }

  let app = null;
  try {
    app = new PIXI.Application({
      view: canvas, width: w, height: h,
      backgroundAlpha: 1, backgroundColor: 0x060a10, antialias: false,
    });
  } catch (e) {
    console.warn('[pixi-studio] preview mount failed', e);
    _psDrawUnsupportedMessage(canvas);
    return;
  }

  try {
    PIXI_STUDIO_STATE.previewApp = app;
    // PIXI sets inline width/height styles — restore CSS fill
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;border-radius:6px;border:1px solid var(--borda)';
    const worldRoot = new PIXI.Container();
    app.stage.addChild(worldRoot);
    PIXI_STUDIO_STATE._worldRoot = worldRoot;

    // Enable stage interaction for drag — done AFTER the renderer is built.
    // Guarded so a missing eventMode/hitArea API (older PIXI) does not abort mount.
    try {
      app.stage.eventMode = 'static';
      app.stage.hitArea = new PIXI.Rectangle(0, 0, w, h);
      app.stage.on('pointermove', _psDragMove);
      app.stage.on('pointerup', _psDragEnd);
      app.stage.on('pointerupoutside', _psDragEnd);
    } catch (eEvt) {
      console.warn('[pixi-studio] stage events disabled', eEvt);
    }

    psPreviewRebuildAll();
    // Start idle RAF loop immediately — emitters run even before Play is pressed
    PIXI_STUDIO_STATE._lastTs = 0;
    cancelAnimationFrame(PIXI_STUDIO_STATE._rafId);
    PIXI_STUDIO_STATE._rafId = requestAnimationFrame(_psPreviewTick);
  } catch (e) {
    console.warn('[pixi-studio] preview setup failed', e);
    try { app.destroy(false, { children: true, texture: false }); } catch (_) {}
    PIXI_STUDIO_STATE.previewApp = null;
    PIXI_STUDIO_STATE._worldRoot = null;
    _psDrawUnsupportedMessage(canvas);
  }
}

function psPreviewUnmount() {
  cancelAnimationFrame(PIXI_STUDIO_STATE._rafId);
  PIXI_STUDIO_STATE.previewPlaying = false;
  PIXI_STUDIO_STATE.previewTime = 0;
  _psDestroyAllEmitters();
  if (PIXI_STUDIO_STATE.previewApp) {
    try { PIXI_STUDIO_STATE.previewApp.destroy(false, { children: true, texture: false }); } catch (_) {}
    PIXI_STUDIO_STATE.previewApp = null;
    PIXI_STUDIO_STATE._worldRoot = null;
  }
}

// Destroy filter objects attached to a display node and clear its `filters` ref.
// Filters hold GPU render-textures/framebuffers that PIXI does NOT free when the
// node is removed/destroyed — they must be destroyed explicitly to avoid a leak.
function _psDestroyFilters(node) {
  const fs = node && node.filters;
  if (Array.isArray(fs)) fs.forEach(f => { try { f && f.destroy && f.destroy(); } catch (_) {} });
  if (node) node.filters = null;
}

// Reuse the existing PIXI.Application when switching effects/presets instead of
// tearing down + recreating it on the same canvas (which churns the WebGL context
// and eventually corrupts it → gray preview). Mirrors psImportarJson's pattern.
function _psRemountOrRebuild() {
  if (!PIXI_STUDIO_STATE.previewApp) return psPreviewMount();
  psPreviewRebuildAll();
  return Promise.resolve();
}

function psPreviewPlay() {
  if (!PIXI_STUDIO_STATE.previewApp) {
    psPreviewMount().then(() => { _psDoPlay(); });
  } else {
    _psDoPlay();
  }
}
function _psDoPlay() {
  PIXI_STUDIO_STATE.previewTime = 0;
  PIXI_STUDIO_STATE.previewPlaying = true;
  PIXI_STUDIO_STATE._lastTs = 0;
  PIXI_STUDIO_STATE._hitstopDone = false;
  PIXI_STUDIO_STATE._hitstopUntil = 0;
  PIXI_STUDIO_STATE._shakeSeed = Math.random() * 1000;
  _psPlayPreviewAudio();
  psPreviewRebuildAll();
  const loopBtn = document.getElementById('ps-loop-btn');
  if (loopBtn) loopBtn.style.color = PIXI_STUDIO_STATE.previewLooping ? 'var(--primario)' : 'var(--suave)';
}

// Play the animation's audio (cast/impact/timed events) during preview — mirrors avtPixiPlayAnimation
function _psPlayPreviewAudio() {
  const cfg = PIXI_STUDIO_STATE.atual?.config_json;
  if (!cfg || typeof AudioManager === 'undefined') return;
  const a = cfg.audio || {};
  const vol = a.volume ?? 0.75;
  const play = (id, v) => { try { AudioManager.playSFX(id, { volume: v ?? vol }); } catch (_) {} };
  if (a.cast) play(a.cast);
  if (a.impact) {
    const delay = (cfg.behavior === 'projectile') ? (cfg.behavior_config?.projectile_speed_ms || 500) : 0;
    if (delay > 0) setTimeout(() => { if (PIXI_STUDIO_STATE.previewPlaying) play(a.impact); }, delay);
    else play(a.impact);
  }
  const dur = cfg.duracao_ms || 1000;
  (a.events || []).forEach(ev => {
    if (!ev || !ev.sfx) return;
    const at = Math.max(0, Math.min(1, ev.t ?? 0)) * dur;
    setTimeout(() => { if (PIXI_STUDIO_STATE.previewPlaying) play(ev.sfx, ev.volume); }, at);
  });
}

function psPreviewPause() {
  PIXI_STUDIO_STATE.previewPlaying = false; // RAF keeps running in idle mode
}

function psPreviewStop() {
  PIXI_STUDIO_STATE.previewPlaying = false;
  PIXI_STUDIO_STATE.previewTime = 0;
  _psUpdateTimeDisplay(0);
  // Reset sprites to t=0 visually
  if (PIXI_STUDIO_STATE.previewApp) _psPreviewRenderFrame(0);
}

function psPreviewToggleLoop() {
  PIXI_STUDIO_STATE.previewLooping = !PIXI_STUDIO_STATE.previewLooping;
  const btn = document.getElementById('ps-loop-btn');
  if (btn) btn.style.color = PIXI_STUDIO_STATE.previewLooping ? 'var(--primario)' : 'var(--suave)';
}

function psPreviewZoom(val) {
  const app = PIXI_STUDIO_STATE.previewApp;
  if (!app || !PIXI_STUDIO_STATE._worldRoot) return;
  PIXI_STUDIO_STATE._worldRoot.scale.set(parseFloat(val) || 1);
}

function _psPreviewTick(ts) {
  if (!PIXI_STUDIO_STATE.previewApp) return; // stop if app destroyed
  const last = PIXI_STUDIO_STATE._lastTs || ts;
  PIXI_STUDIO_STATE._lastTs = ts;
  const delta = Math.min(ts - last, 100);
  const cfg = PIXI_STUDIO_STATE.atual?.config_json;
  const dur = cfg?.duracao_ms || 1000;
  const fxOn = PIXI_STUDIO_STATE._fxEnabled !== false;
  const worldRoot = PIXI_STUDIO_STATE._worldRoot;
  const frozen = PIXI_STUDIO_STATE.previewPlaying && PIXI_STUDIO_STATE._hitstopUntil && ts < PIXI_STUDIO_STATE._hitstopUntil;

  // Always update emitters (idle + playing) — no ticker.add needed
  for (const [layerId, em] of PIXI_STUDIO_STATE._emitterMap) {
    if (!em || em.destroyed) continue;
    if (PIXI_STUDIO_STATE.previewPlaying) {
      const t = Math.min(1, PIXI_STUDIO_STATE.previewTime / dur);
      const layer = _psGetLayer(layerId);
      const st = layer?.start_t ?? 0, et = layer?.end_t ?? 1;
      const inRange = t >= st && t <= et;
      em.emit = inRange && !frozen;
      if (inRange && layer?.spawn_path?.length) {
        const tRel = et > st ? (t - st) / (et - st) : 0;
        const sp = _psInterpKf(layer.spawn_path, tRel);
        if (sp) em.updateSpawnPos(sp.x ?? 0, sp.y ?? 0);
      }
    }
    if (!frozen) em.update(delta / 1000);
  }

  // Camera shake (parity with _avtCameraFX) — offsets the world root while playing
  if (worldRoot) {
    const sh = cfg?.camera?.shake;
    if (fxOn && sh && sh.amp && PIXI_STUDIO_STATE.previewPlaying) {
      const tms = PIXI_STUDIO_STATE.previewTime;
      const amp = sh.amp * Math.pow(sh.decay || 0.9, tms / 16);
      const freq = (sh.freq || 30) / 1000;
      const seed = PIXI_STUDIO_STATE._shakeSeed || 0;
      worldRoot.position.set(Math.sin(tms * freq + seed) * amp, Math.cos(tms * freq * 1.13 + seed) * amp);
    } else if (worldRoot.position.x !== 0 || worldRoot.position.y !== 0) {
      worldRoot.position.set(0, 0);
    }
  }

  if (PIXI_STUDIO_STATE.previewPlaying && !frozen) {
    PIXI_STUDIO_STATE.previewTime += delta;
    const t = Math.min(1, PIXI_STUDIO_STATE.previewTime / dur);
    // Hitstop: freeze briefly at the configured impact moment
    const hs = cfg?.camera?.hitstop;
    if (fxOn && hs && hs.ms && !PIXI_STUDIO_STATE._hitstopDone && t >= (hs.at ?? 0.2)) {
      PIXI_STUDIO_STATE._hitstopUntil = ts + Math.min(hs.ms, 400);
      PIXI_STUDIO_STATE._hitstopDone = true;
    }
    _psPreviewRenderFrame(t);
    _psUpdateTimeDisplay(t, dur);
    if (t >= 1) {
      if (PIXI_STUDIO_STATE.previewLooping) {
        PIXI_STUDIO_STATE.previewTime = 0;
        PIXI_STUDIO_STATE._hitstopDone = false;
        PIXI_STUDIO_STATE._hitstopUntil = 0;
        psPreviewRebuildAll();
      } else {
        PIXI_STUDIO_STATE.previewPlaying = false;
      }
    }
  }
  PIXI_STUDIO_STATE._rafId = requestAnimationFrame(_psPreviewTick); // always re-request
}

function _psUpdateTimeDisplay(t, dur) {
  dur = dur || PIXI_STUDIO_STATE.atual?.config_json?.duracao_ms || 1000;
  const el = document.getElementById('ps-preview-time');
  if (el) el.textContent = `${((t * dur) / 1000).toFixed(1)}s / ${(dur / 1000).toFixed(1)}s`;
  // Move timeline playhead
  const ph = document.getElementById('ps-tl-playhead');
  if (ph) ph.style.left = (t * 100) + '%';
}

function _psPreviewRenderFrame(t) {
  const layers = PIXI_STUDIO_STATE.atual?.config_json?.layers || [];
  const worldRoot = PIXI_STUDIO_STATE._worldRoot;
  if (!worldRoot) return;

  if (PIXI_STUDIO_STATE._sceneMode) _psApplySceneFrame(t);

  for (const layer of layers) {
    if (!layer.visivel) continue;

    if (layer.tipo === 'sprite') {
      const sp = PIXI_STUDIO_STATE._spriteMap.get(layer.id);
      if (!sp) continue;
      const sst = layer.start_t ?? 0, set_ = layer.end_t ?? 1;
      sp.visible = (t >= sst && t <= set_);
      if (!PIXI_STUDIO_STATE._drag || PIXI_STUDIO_STATE._drag.layerId !== layer.id) {
        const tRel = set_ > sst ? Math.max(0, Math.min(1, (t - sst) / (set_ - sst))) : 0;
        const kf = _psInterpKf(layer.keyframes, tRel);
        if (kf) {
          const bs = layer.base_scale ?? 1;
          const sx = (kf.scale ?? 1) * bs * (layer.flip_x ? -1 : 1);
          const sy = (kf.scale ?? 1) * bs * (layer.flip_y ? -1 : 1);
          sp.x = kf.x ?? 0; sp.y = kf.y ?? 0;
          sp.scale.set(sx, sy);
          sp.alpha = kf.alpha ?? 1;
          sp.rotation = (kf.rotation ?? 0) * Math.PI / 180;
        }
      }
      // Update scale/rotate handles
      if (layer.id === PIXI_STUDIO_STATE.layerSel && sp.parent) {
        const scaleH = sp.parent.children.find(c => c.name === 'ps-scale-handle');
        const rotH   = sp.parent.children.find(c => c.name === 'ps-rot-handle');
        const hw = Math.abs(sp.width / 2) + 12, hh = Math.abs(sp.height / 2) + 12;
        if (scaleH) { scaleH.x = sp.x + hw;  scaleH.y = sp.y + hh; }
        if (rotH)   { rotH.x   = sp.x;        rotH.y   = sp.y - hh - 10; }
      }
    }

    if (layer.tipo === 'shape') {
      const g = PIXI_STUDIO_STATE._shapeMap.get(layer.id);
      if (!g) continue;
      const kf = _psInterpKf(layer.keyframes, t);
      if (kf) {
        g.clear();
        const sc = kf.stroke_color || '#ffffff';
        const sa = kf.stroke_alpha ?? 1;
        const sw = kf.stroke_width ?? 2;
        const fa = kf.fill_alpha ?? 0;
        const r  = kf.radius ?? 20;
        const bm = { add: PIXI.BLEND_MODES.ADD, normal: PIXI.BLEND_MODES.NORMAL, screen: PIXI.BLEND_MODES.SCREEN, multiply: PIXI.BLEND_MODES.MULTIPLY };
        g.blendMode = bm[layer.blendMode] ?? PIXI.BLEND_MODES.ADD;
        if (sa > 0) g.lineStyle(sw, parseInt(sc.replace('#',''), 16), sa);
        if (fa > 0) g.beginFill(parseInt((kf.fill_color||'#ffffff').replace('#',''), 16), fa);
        if (layer.shape_type === 'circle') g.drawCircle(0, 0, r);
        else if (layer.shape_type === 'rect') g.drawRect(-r, -r, r * 2, r * 2);
        else if (layer.shape_type === 'polygon') {
          const sides = Math.max(3, layer.sides || 6);
          const pts = [];
          for (let i = 0; i < sides; i++) { const ang = -Math.PI / 2 + i * 2 * Math.PI / sides; pts.push(Math.cos(ang) * r, Math.sin(ang) * r); }
          g.drawPolygon(pts);
        }
        if (fa > 0) g.endFill();
      }
    }

    if (layer.tipo === 'light') {
      const sp = PIXI_STUDIO_STATE._spriteMap.get(layer.id);
      if (!sp) continue;
      const sst = layer.start_t ?? 0, set_ = layer.end_t ?? 1;
      sp.visible = (t >= sst && t <= set_);
      const tRel = set_ > sst ? Math.max(0, Math.min(1, (t - sst) / (set_ - sst))) : 0;
      const kf = _psInterpKf(layer.keyframes, tRel);
      if (kf) {
        const r = kf.radius ?? 60;
        sp.width = sp.height = r * 2;
        sp.x = kf.x ?? 0; sp.y = kf.y ?? 0;
        sp.alpha = kf.alpha ?? 0.7;
        sp.tint = _psHexToInt(kf.color || layer.color || '#ffffff');
      }
    }
  }
}

// ══ DIRECT MANIPULATION ═══════════════════════════════════════════════════════

function _psBeginDragSprite(layerId, e, type) {
  psSelectLayer(layerId);
  const sp = PIXI_STUDIO_STATE._spriteMap.get(layerId);
  const layer = _psGetLayer(layerId);
  if (!sp || !layer) return;
  const dur = PIXI_STUDIO_STATE.atual?.config_json?.duracao_ms || 1000;
  const t = Math.min(1, PIXI_STUDIO_STATE.previewTime / dur);
  const kfs = layer.keyframes || [];
  let kfIdx = 0;
  if (kfs.length > 1) {
    let minDist = Infinity;
    kfs.forEach((kf, i) => { const d = Math.abs((kf.t ?? 0) - t); if (d < minDist) { minDist = d; kfIdx = i; } });
  }
  PIXI_STUDIO_STATE._drag = {
    layerId, type, kfIdx,
    startX: e.global.x, startY: e.global.y,
    origX: kfs[kfIdx]?.x ?? 0,
    origY: kfs[kfIdx]?.y ?? 0,
    origScale: Math.abs(kfs[kfIdx]?.scale ?? 1),
    origRot: kfs[kfIdx]?.rotation ?? 0,
    spX: sp.x, spY: sp.y,
  };
}

function _psDragMove(e) {
  const drag = PIXI_STUDIO_STATE._drag;
  if (!drag) return;
  const layer = _psGetLayer(drag.layerId);
  if (!layer) return;
  const zoom = PIXI_STUDIO_STATE._worldRoot?.scale?.x || 1;
  // Origin gizmo drag (emitter offset) — no sprite involved
  if (drag.type === 'origin') {
    const nx = Math.round(drag.origX + (e.global.x - drag.startX) / zoom);
    const ny = Math.round(drag.origY + (e.global.y - drag.startY) / zoom);
    if (!layer.offset) layer.offset = { x: 0, y: 0 };
    layer.offset.x = nx; layer.offset.y = ny;
    const em = PIXI_STUDIO_STATE._emitterMap.get(drag.layerId);
    if (em && !em.destroyed) em.updateSpawnPos(nx, ny);
    const app = PIXI_STUDIO_STATE.previewApp;
    if (app && PIXI_STUDIO_STATE._originGizmo)
      PIXI_STUDIO_STATE._originGizmo.position.set(app.renderer.width / 2 + nx, app.renderer.height / 2 + ny);
    _psSetDirty(true);
    return;
  }
  const sp = PIXI_STUDIO_STATE._spriteMap.get(drag.layerId);
  if (!sp) return;
  const dx = e.global.x - drag.startX;
  const dy = e.global.y - drag.startY;
  if (drag.type === 'move') {
    const nx = Math.round(drag.origX + dx / zoom);
    const ny = Math.round(drag.origY + dy / zoom);
    layer.keyframes[drag.kfIdx].x = nx;
    layer.keyframes[drag.kfIdx].y = ny;
    sp.x = nx; sp.y = ny;
  } else if (drag.type === 'scale') {
    const dist = (Math.abs(dx) + Math.abs(dy)) * (dx + dy > 0 ? 1 : -1);
    const ns = Math.max(0.05, Math.round((drag.origScale + dist / 80 / zoom) * 100) / 100);
    layer.keyframes[drag.kfIdx].scale = ns;
    const bs = layer.base_scale ?? 1;
    sp.scale.set(ns * bs * (layer.flip_x ? -1 : 1), ns * bs * (layer.flip_y ? -1 : 1));
  } else if (drag.type === 'rotate') {
    const app = PIXI_STUDIO_STATE.previewApp;
    if (!app) return;
    const cx = app.renderer.width / 2, cy = app.renderer.height / 2;
    const a1 = Math.atan2(drag.startY - (drag.spY + cy), drag.startX - (drag.spX + cx));
    const a2 = Math.atan2(e.global.y - (drag.spY + cy), e.global.x - (drag.spX + cx));
    const nr = Math.round(drag.origRot + (a2 - a1) * 180 / Math.PI);
    layer.keyframes[drag.kfIdx].rotation = nr;
    sp.rotation = nr * Math.PI / 180;
  }
  _psSetDirty(true);
}

function _psDragEnd() {
  if (!PIXI_STUDIO_STATE._drag) return;
  PIXI_STUDIO_STATE._drag = null;
  _psRenderPropsPanel();
}

// ══ TRAJECTORY RECORDING ══════════════════════════════════════════════════════

function psToggleGravar() {
  if (PIXI_STUDIO_STATE._recording) { _psRecordFinish(); return; }
  const layer = _psGetLayer(PIXI_STUDIO_STATE.layerSel);
  if (!layer || layer.tipo !== 'emitter') return mostrarToast('Selecione um emissor primeiro', 'aviso');
  _psRecordStart();
}

function _psRecordStart() {
  const canvas = document.getElementById('ps-preview-canvas');
  if (!canvas) return;
  PIXI_STUDIO_STATE._recording = true;
  PIXI_STUDIO_STATE._recordPoints = [];
  PIXI_STUDIO_STATE._recordStartTs = Date.now();
  canvas.style.outline = '2px solid #e8604c';
  canvas.addEventListener('pointermove', _psRecordPoint);
  canvas.addEventListener('pointerup', _psRecordFinish);
  const btn = document.getElementById('ps-record-btn');
  if (btn) { btn.style.color = '#e8604c'; btn.style.borderColor = '#e8604c'; }
  PIXI_STUDIO_STATE.previewTime = 0; PIXI_STUDIO_STATE.previewPlaying = true;
  PIXI_STUDIO_STATE._lastTs = 0; psPreviewRebuildAll();
  mostrarToast('Mova o mouse no canvas. Solte para finalizar.', 'aviso');
}

function _psRecordPoint(e) {
  if (!PIXI_STUDIO_STATE._recording) return;
  const rect = e.target.getBoundingClientRect();
  const x = e.clientX - rect.left - rect.width / 2;
  const y = e.clientY - rect.top - rect.height / 2;
  const dur = PIXI_STUDIO_STATE.atual?.config_json?.duracao_ms || 1000;
  const t = Math.min(1, (Date.now() - PIXI_STUDIO_STATE._recordStartTs) / dur);
  PIXI_STUDIO_STATE._recordPoints.push({ x, y, t });
}

function _psRecordFinish() {
  if (!PIXI_STUDIO_STATE._recording) return;
  PIXI_STUDIO_STATE._recording = false;
  PIXI_STUDIO_STATE.previewPlaying = false;
  const canvas = document.getElementById('ps-preview-canvas');
  if (canvas) { canvas.style.outline = ''; canvas.removeEventListener('pointermove', _psRecordPoint); canvas.removeEventListener('pointerup', _psRecordFinish); }
  const btn = document.getElementById('ps-record-btn');
  if (btn) { btn.style.color = ''; btn.style.borderColor = ''; }
  const raw = PIXI_STUDIO_STATE._recordPoints;
  if (raw.length < 3) return mostrarToast('Mova mais para gravar trajetória', 'aviso');
  const smooth = _psSmoothPath(raw);
  const layer = _psGetLayer(PIXI_STUDIO_STATE.layerSel);
  if (layer && layer.tipo === 'emitter') {
    layer.spawn_path = smooth; _psSetDirty(true); _psRenderPropsPanel();
    mostrarToast(`Trajetória gravada (${smooth.length} pts)`, 'sucesso');
  }
}

function _psSmoothPath(pts) {
  if (!pts.length) return [];
  pts = [...pts].sort((a, b) => a.t - b.t);
  // Ramer-Douglas-Peucker
  const rdp = (ps, eps) => {
    if (ps.length < 3) return ps;
    const [p0, pn] = [ps[0], ps[ps.length-1]];
    const dx = pn.x-p0.x, dy = pn.y-p0.y, len = Math.sqrt(dx*dx+dy*dy) || 1;
    let maxD = 0, maxI = 0;
    for (let i = 1; i < ps.length-1; i++) {
      const d = Math.abs(dy*ps[i].x - dx*ps[i].y + pn.x*p0.y - pn.y*p0.x) / len;
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > eps) return [...rdp(ps.slice(0, maxI+1), eps).slice(0,-1), ...rdp(ps.slice(maxI), eps)];
    return [p0, pn];
  };
  let reduced = rdp(pts, 5);
  if (reduced.length < 2) reduced = [pts[0], pts[pts.length-1]];
  // Gaussian smooth on x, y
  const gSmooth = (arr, key) => arr.map((p, i) => {
    const w = [0.06, 0.24, 0.40, 0.24, 0.06]; let v = 0, ws = 0;
    w.forEach((wi, j) => { const idx = i+j-2; if (idx >= 0 && idx < arr.length) { v += wi*arr[idx][key]; ws += wi; } });
    return ws ? v/ws : p[key];
  });
  const sx = gSmooth(reduced, 'x'), sy = gSmooth(reduced, 'y');
  return reduced.map((p, i) => ({ x: Math.round(sx[i]*10)/10, y: Math.round(sy[i]*10)/10, t: Math.round(p.t*1000)/1000 }));
}

// ══ INTERPOLATION ══════════════════════════════════════════════════════════════

function _psInterpKf(keyframes, t) {
  if (!keyframes || !keyframes.length) return null;
  const sorted = [...keyframes].sort((a, b) => a.t - b.t);
  if (t <= sorted[0].t) return sorted[0];
  if (t >= sorted[sorted.length - 1].t) return sorted[sorted.length - 1];
  let lo = sorted[0], hi = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (t >= sorted[i].t && t <= sorted[i + 1].t) { lo = sorted[i]; hi = sorted[i + 1]; break; }
  }
  const fRaw = (t - lo.t) / (hi.t - lo.t);
  // Easing is owned by the *outgoing* keyframe (lo). Default linear = legacy behavior.
  const f = _psEase(lo.ease || 'linear', fRaw);
  const lerp = (a, b) => typeof a === 'number' && typeof b === 'number' ? a + (b - a) * f : a;
  const result = {};
  const keys = new Set([...Object.keys(lo), ...Object.keys(hi)]);
  keys.forEach(k => { if (k !== 't' && k !== 'ease') result[k] = lerp(lo[k], hi[k]); });
  return result;
}

function psPreviewRebuildAll() {
  _psDestroyAllEmitters();
  const app = PIXI_STUDIO_STATE.previewApp;
  const worldRoot = PIXI_STUDIO_STATE._worldRoot;
  if (!app || !worldRoot || typeof PIXI === 'undefined') return;
  // Free GPU resources from the previous build: filters (render-textures/framebuffers)
  // are NOT released by removeChildren()/destroy() and would leak across rebuilds → gray.
  _psDestroyFilters(worldRoot);
  worldRoot.removeChildren().forEach(c => {
    _psDestroyFilters(c);
    try { c.destroy({ children: true, texture: false }); } catch (_) {}
  });
  PIXI_STUDIO_STATE._spriteMap.clear();
  PIXI_STUDIO_STATE._shapeMap.clear();
  if (!PIXI_STUDIO_STATE._layerContainers) PIXI_STUDIO_STATE._layerContainers = new Map();
  PIXI_STUDIO_STATE._layerContainers.clear();
  PIXI_STUDIO_STATE._sceneDummies = null;
  PIXI_STUDIO_STATE._bgSprite = null;

  const cfg = PIXI_STUDIO_STATE.atual?.config_json;
  if (!cfg) return;
  const cx = app.renderer.width / 2, cy = app.renderer.height / 2;
  const sceneMode = !!PIXI_STUDIO_STATE._sceneMode;
  const bm = { add: PIXI.BLEND_MODES.ADD, normal: PIXI.BLEND_MODES.NORMAL, screen: PIXI.BLEND_MODES.SCREEN, multiply: PIXI.BLEND_MODES.MULTIPLY };
  const sorted = [...(cfg.layers || [])].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));

  // Contextual reference markers based on effect posicao (replaced by live dummies in scene mode)
  if (sceneMode) {
    _psBuildSceneDummies(cx, cy);
  } else {
    const posicao = cfg.posicao || 'trajetoria';
    const mkTxt = (ch, color, ox, oy) => {
      const t = new PIXI.Text(ch, { fontSize: 16, fill: color, resolution: 2 });
      t.anchor.set(0.5);
      t.position.set(cx + ox, cy + oy);
      t.alpha = 0.6;
      worldRoot.addChild(t);
    };
    const mkLine = (x0, y0, x1, y1) => {
      const g = new PIXI.Graphics();
      g.lineStyle(1, 0xffffff, 0.07);
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      worldRoot.addChildAt(g, 0);
    };
    const mkCircle = (r) => {
      const g = new PIXI.Graphics();
      g.lineStyle(1, 0xe74c3c, 0.18);
      g.drawCircle(cx, cy, r);
      worldRoot.addChildAt(g, 0);
    };

    if (posicao === 'trajetoria' || posicao === 'raio' || posicao === 'retorno') {
      mkLine(cx + PS_ATAC_REF.x, cy, cx + PS_ALVO_REF.x, cy);
      mkTxt('⚔', 0x4fa3d1,  PS_ATAC_REF.x, 0);
      mkTxt('👹', 0xe74c3c, PS_ALVO_REF.x, 0);
    } else if (posicao === 'alvo') {
      mkTxt('👹', 0xe74c3c, 0, 0);
    } else if (posicao === 'atacante') {
      mkTxt('⚔', 0x4fa3d1, 0, 0);
    } else if (posicao === 'meio') {
      mkTxt('✦', 0xf0c040, 0, 0);
    } else if (posicao === 'area') {
      mkCircle(80);
      mkTxt('👹', 0xe74c3c, 0, 0);
    } else {
      mkLine(cx + PS_ATAC_REF.x, cy, cx + PS_ALVO_REF.x, cy);
      mkTxt('⚔', 0x4fa3d1,  PS_ATAC_REF.x, 0);
      mkTxt('👹', 0xe74c3c, PS_ALVO_REF.x, 0);
    }
  }

  const fxOn = PIXI_STUDIO_STATE._fxEnabled !== false;
  PIXI_STUDIO_STATE._originGizmo = null;

  // Background darken (parity with runtime _avtPixiParticleAnim) — behind effect layers
  if (fxOn && cfg.background && cfg.background.darken) {
    const dim = new PIXI.Graphics();
    dim.beginFill(0x000000, cfg.background.darken).drawRect(0, 0, app.renderer.width, app.renderer.height).endFill();
    worldRoot.addChild(dim);
  }

  for (const layer of sorted) {
    if (!layer.visivel) continue;
    const container = new PIXI.Container();
    container.position.set(cx, cy);
    container.blendMode = bm[layer.blendMode] ?? PIXI.BLEND_MODES.ADD;
    worldRoot.addChild(container);
    PIXI_STUDIO_STATE._layerContainers.set(layer.id, container);

    if (layer.tipo === 'emitter' && layer.emitter) {
      _psCreateEmitter(layer, container, layer.offset?.x || 0, layer.offset?.y || 0);
      if (fxOn) _psApplyContainerFilters(container, layer);
      // Draggable origin gizmo for the selected emitter
      if (layer.id === PIXI_STUDIO_STATE.layerSel && !sceneMode) {
        const ox = layer.offset?.x || 0, oy = layer.offset?.y || 0;
        const giz = new PIXI.Graphics();
        giz.lineStyle(1.5, 0x4fa3d1, 0.95);
        giz.drawCircle(0, 0, 9);
        giz.moveTo(-14, 0); giz.lineTo(14, 0); giz.moveTo(0, -14); giz.lineTo(0, 14);
        giz.position.set(cx + ox, cy + oy);
        giz.eventMode = 'static'; giz.cursor = 'move';
        giz.on('pointerdown', (e) => { e.stopPropagation(); _psBeginDragOrigin(layer.id, e); });
        worldRoot.addChild(giz);
        PIXI_STUDIO_STATE._originGizmo = giz;
      }
    } else if (layer.tipo === 'sprite') {
      const texUrl = layer.texture_url;
      const tex = texUrl ? PIXI.Texture.from(texUrl) : PIXI.Texture.WHITE;
      const sp = _psBuildSprite(layer, tex);
      sp.blendMode = bm[layer.blendMode] ?? PIXI.BLEND_MODES.ADD;
      if (layer.tint) sp.tint = _psHexToInt(layer.tint);
      sp.eventMode = 'static';
      sp.cursor = 'grab';
      sp.on('pointerdown', (e) => { e.stopPropagation(); _psBeginDragSprite(layer.id, e, 'move'); });
      container.addChild(sp);
      if (fxOn) _psApplyContainerFilters(container, layer);
      PIXI_STUDIO_STATE._spriteMap.set(layer.id, sp);
      // Handles (scale + rotate) for selected layer
      if (layer.id === PIXI_STUDIO_STATE.layerSel) {
        const scaleH = new PIXI.Graphics();
        scaleH.beginFill(0x4fa3d1, 0.9).drawCircle(0, 0, 7).endFill();
        scaleH.lineStyle(1.5, 0xffffff, 0.8).drawCircle(0, 0, 7);
        scaleH.name = 'ps-scale-handle'; scaleH.eventMode = 'static'; scaleH.cursor = 'nwse-resize';
        scaleH.on('pointerdown', (e) => { e.stopPropagation(); _psBeginDragSprite(layer.id, e, 'scale'); });
        container.addChild(scaleH);
        const rotH = new PIXI.Graphics();
        rotH.beginFill(0xc8a84b, 0.9).drawCircle(0, 0, 7).endFill();
        rotH.lineStyle(1.5, 0xffffff, 0.8).drawCircle(0, 0, 7);
        rotH.name = 'ps-rot-handle'; rotH.eventMode = 'static'; rotH.cursor = 'crosshair';
        rotH.on('pointerdown', (e) => { e.stopPropagation(); _psBeginDragSprite(layer.id, e, 'rotate'); });
        container.addChild(rotH);
      }
    } else if (layer.tipo === 'shape') {
      const g = new PIXI.Graphics();
      container.addChild(g);
      if (fxOn) _psApplyContainerFilters(container, layer);
      PIXI_STUDIO_STATE._shapeMap.set(layer.id, g);
    } else if (layer.tipo === 'light') {
      const sp = new PIXI.Sprite(_avtProcTextures('glow'));
      sp.anchor.set(0.5);
      sp.blendMode = PIXI.BLEND_MODES.ADD;
      container.addChild(sp);
      PIXI_STUDIO_STATE._spriteMap.set(layer.id, sp);
    } else if (layer.tipo === 'background') {
      _psDrawBackground(layer, container, cx, cy, app);
    }
  }

  // World-level lighting: bloom + tone + user post-FX (parity with runtime)
  if (fxOn) {
    const wf = [];
    const L = cfg.lighting || {};
    if (L.bloom && PIXI.filters?.AdvancedBloomFilter) {
      wf.push(new PIXI.filters.AdvancedBloomFilter({
        threshold: L.bloom.threshold ?? 0.4, bloomScale: L.bloom.intensity ?? 1.5,
        brightness: 1.0, blur: 8, quality: L.bloom.quality ?? 6,
      }));
    }
    if (L.tone && L.tone !== 'none') {
      const cm = new PIXI.ColorMatrixFilter();
      if (L.tone === 'filmic') { cm.contrast(0.15, true); cm.saturate(0.12, true); cm.brightness(1.04, true); }
      else if (L.tone === 'aces') { cm.contrast(0.22, true); cm.saturate(0.18, true); cm.brightness(1.06, true); cm.hue(-4, true); }
      wf.push(cm);
    }
    if (Array.isArray(cfg.filters) && cfg.filters.length && typeof _avtBuildPixiFilters === 'function') {
      try { wf.push(..._avtBuildPixiFilters(cfg.filters, worldRoot)); } catch (_) {}
    }
    worldRoot.filters = wf.length ? wf : null;
  } else {
    worldRoot.filters = null;
  }
}

// Build a sprite or animated spritesheet sprite from a layer
function _psBuildSprite(layer, tex) {
  const sf = layer.sprite_frames;
  if (sf && sf.cols > 0 && sf.rows > 0 && PIXI.AnimatedSprite) {
    try {
      const base = tex.baseTexture;
      const fw = Math.floor(base.realWidth / sf.cols);
      const fh = Math.floor(base.realHeight / sf.rows);
      const total = sf.total || (sf.cols * sf.rows);
      const frames = [];
      for (let i = 0; i < total; i++) {
        const cxx = (i % sf.cols) * fw, cyy = Math.floor(i / sf.cols) * fh;
        frames.push(new PIXI.Texture(base, new PIXI.Rectangle(cxx, cyy, fw, fh)));
      }
      if (frames.length) {
        const asp = new PIXI.AnimatedSprite(frames);
        asp.anchor.set(0.5);
        asp.animationSpeed = (sf.fps || 12) / 60;
        asp.loop = sf.loop !== false;
        asp.play();
        return asp;
      }
    } catch (e) { console.warn('[pixi-studio] spritesheet build failed', e); }
  }
  const sp = new PIXI.Sprite(tex);
  sp.anchor.set(0.5);
  return sp;
}

// Render a background layer (solid / gradient / image)
function _psDrawBackground(layer, container, cx, cy, app) {
  const W = app.renderer.width, H = app.renderer.height;
  if (layer.bg_type === 'image' && layer.bg_image_url) {
    const sp = new PIXI.Sprite(PIXI.Texture.from(layer.bg_image_url));
    sp.width = W; sp.height = H; sp.position.set(-cx, -cy); sp.alpha = layer.bg_alpha ?? 1;
    container.addChildAt(sp, 0);
    PIXI_STUDIO_STATE._bgSprite = sp;
    return;
  }
  const g = new PIXI.Graphics();
  g.position.set(-cx, -cy);
  if (layer.bg_type === 'gradient') {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const ang = (layer.bg_angle || 90) * Math.PI / 180;
    const x1 = W / 2 - Math.cos(ang) * W / 2, y1 = H / 2 - Math.sin(ang) * H / 2;
    const x2 = W / 2 + Math.cos(ang) * W / 2, y2 = H / 2 + Math.sin(ang) * H / 2;
    const grd = ctx.createLinearGradient(x1, y1, x2, y2);
    grd.addColorStop(0, layer.bg_color || '#000000');
    grd.addColorStop(1, layer.bg_color2 || '#000000');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    const sp = new PIXI.Sprite(PIXI.Texture.from(c));
    sp.position.set(-cx, -cy); sp.alpha = layer.bg_alpha ?? 1;
    container.addChildAt(sp, 0);
    PIXI_STUDIO_STATE._bgSprite = sp;
    return;
  }
  const color = parseInt((layer.bg_color || '#000000').replace('#', ''), 16);
  g.beginFill(color, layer.bg_alpha || 0).drawRect(0, 0, W, H).endFill();
  container.addChildAt(g, 0);
  PIXI_STUDIO_STATE._bgSprite = g;
}

// ── Scene mode (live moving attacker/target dummies) ─────────────────────────
function _psBuildSceneDummies(cx, cy) {
  const worldRoot = PIXI_STUDIO_STATE._worldRoot;
  if (!worldRoot) return;
  const line = new PIXI.Graphics();
  line.lineStyle(1, 0xffffff, 0.06);
  line.moveTo(cx + PS_ATAC_REF.x, cy); line.lineTo(cx + PS_ALVO_REF.x, cy);
  worldRoot.addChildAt(line, 0);
  const mk = (emoji, x, y) => {
    const t = new PIXI.Text(emoji, { fontSize: 30, resolution: 2 });
    t.anchor.set(0.5); t.position.set(x, y); t.alpha = 0.92;
    worldRoot.addChild(t); return t;
  };
  PIXI_STUDIO_STATE._sceneDummies = {
    atk:    mk('🧝', cx + PS_ATAC_REF.x, cy),
    target: mk('👹', cx + PS_ALVO_REF.x, cy),
  };
}

function _psSceneAnchor(t, cfg, cx, cy) {
  const ax = cx + PS_ATAC_REF.x, ay = cy;
  const tgX = cx + PS_ALVO_REF.x, tgY = cy + Math.sin(t * Math.PI * 2) * 28; // target wanders to test follow
  const b = cfg.behavior || 'one-shot';
  const dur = cfg.duracao_ms || 1000;
  let x, y;
  if (b === 'projectile') {
    const speed = cfg.behavior_config?.projectile_speed_ms || 500;
    const k = Math.min(1, (t * dur) / speed);
    x = ax + (tgX - ax) * k; y = ay + (tgY - ay) * k;
    // Mirror combat travel paths (arc/spiral) so the preview matches the game
    const path = cfg.travel?.path;
    if (path === 'arc' || path === 'spiral') {
      const dx = tgX - ax, dy = tgY - ay, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      if (path === 'arc') { const off = Math.sin(Math.PI * k) * Math.min(160, len * 0.35); x += nx * off; y += ny * off; }
      else { const r = Math.sin(Math.PI * k) * 26, ang = k * Math.PI * 6; x += nx * Math.cos(ang) * r; y += ny * Math.cos(ang) * r - Math.sin(ang) * r; }
    }
  } else if (b === 'follow-caster' || b === 'channel') { x = ax; y = ay; }
  else if (b === 'follow-target') { x = tgX; y = tgY; }
  else {
    const pos = cfg.posicao || 'alvo';
    if (pos === 'atacante') { x = ax; y = ay; }
    else if (pos === 'meio') { x = (ax + tgX) / 2; y = (ay + tgY) / 2; }
    else { x = tgX; y = tgY; }
  }
  return { x, y, ax, ay, tgX, tgY };
}

function _psApplySceneFrame(t) {
  if (!PIXI_STUDIO_STATE._sceneMode) return;
  const cfg = PIXI_STUDIO_STATE.atual?.config_json;
  const app = PIXI_STUDIO_STATE.previewApp;
  if (!cfg || !app) return;
  const cx = app.renderer.width / 2, cy = app.renderer.height / 2;
  const a = _psSceneAnchor(t, cfg, cx, cy);
  if (PIXI_STUDIO_STATE._layerContainers) {
    for (const [, c] of PIXI_STUDIO_STATE._layerContainers) {
      if (c && !c.destroyed) c.position.set(a.x, a.y);
    }
  }
  const d = PIXI_STUDIO_STATE._sceneDummies;
  if (d) { if (d.target) d.target.position.set(a.tgX, a.tgY); if (d.atk) d.atk.position.set(a.ax, a.ay); }
}

function psToggleFx() {
  PIXI_STUDIO_STATE._fxEnabled = (PIXI_STUDIO_STATE._fxEnabled === false);
  const on = PIXI_STUDIO_STATE._fxEnabled !== false;
  const btn = document.getElementById('ps-fx-btn');
  if (btn) { btn.style.color = on ? 'var(--primario)' : 'var(--suave)'; btn.style.borderColor = on ? 'var(--primario)' : 'var(--borda)'; }
  psPreviewRebuildAll();
}

function psToggleScene() {
  PIXI_STUDIO_STATE._sceneMode = !PIXI_STUDIO_STATE._sceneMode;
  const on = PIXI_STUDIO_STATE._sceneMode;
  const btn = document.getElementById('ps-scene-btn');
  if (btn) { btn.style.color = on ? 'var(--primario)' : 'var(--suave)'; btn.style.borderColor = on ? 'var(--primario)' : 'var(--borda)'; }
  psPreviewRebuildAll();
}

function _psHexToInt(c) {
  if (typeof c === 'number') return c;
  if (typeof c === 'string') { const h = c.replace('#', ''); const n = parseInt(h, 16); return isNaN(n) ? 0xffffff : n; }
  return 0xffffff;
}

// Apply per-layer filter stack (user filters + glow) to a container — mirrors aventura.js
function _psApplyContainerFilters(container, layer) {
  if (typeof PIXI === 'undefined' || !PIXI.filters) return;
  const fs = [];
  if (Array.isArray(layer.filters) && layer.filters.length && typeof _avtBuildPixiFilters === 'function') {
    try { fs.push(..._avtBuildPixiFilters(layer.filters, container)); } catch (_) {}
  }
  if (layer.glow && PIXI.filters.GlowFilter) {
    fs.push(new PIXI.filters.GlowFilter({
      distance: layer.glow.distance ?? 14,
      outerStrength: layer.glow.outerStrength ?? 2,
      innerStrength: layer.glow.innerStrength ?? 0,
      color: _psHexToInt(layer.glow.color || '#ffffff'),
      quality: layer.glow.quality ?? 0.3,
    }));
  }
  if (fs.length) container.filters = fs;
}

// Lazy-load every filter package referenced by a config so the preview matches the game
async function _psEnsureFiltersForCfg(cfg) {
  if (typeof _avtEnsurePixiFilter !== 'function' || !cfg) return;
  const loadable = ['glow', 'bloom', 'shockwave', 'godray', 'rgbsplit', 'outline', 'crt'];
  const need = new Set(['glow', 'bloom']);
  const scan = (arr) => { if (Array.isArray(arr)) arr.forEach(f => { if (f && f.type && loadable.includes(f.type)) need.add(f.type); }); };
  scan(cfg.filters);
  (cfg.layers || []).forEach(l => { scan(l.filters); if (l.glow) need.add('glow'); });
  await Promise.all([...need].map(n => _avtEnsurePixiFilter(n).catch(() => {})));
}

function _psCreateEmitter(layer, container, x, y) {
  if (!PIXI.particles?.Emitter) return;
  let cfg = JSON.parse(JSON.stringify(layer.emitter || {}));
  cfg = _psValidateEmitterCfg(cfg);
  // Center rect spawn on the origin (legacy configs may lack x/y → particles "sair do canto")
  if (cfg.spawnType === 'rect') {
    cfg.spawnRect = cfg.spawnRect || { w: 40, h: 40 };
    if (cfg.spawnRect.x == null) cfg.spawnRect.x = -(cfg.spawnRect.w || 40) / 2;
    if (cfg.spawnRect.y == null) cfg.spawnRect.y = -(cfg.spawnRect.h || 40) / 2;
  }
  const tex = layer.texture_url ? PIXI.Texture.from(layer.texture_url) : _avtProcTextures(layer.texture || 'spark');
  const texArr = [tex || PIXI.Texture.WHITE];
  if (PIXI.particles.upgradeConfig && !Array.isArray(cfg.behaviors)) {
    try { cfg = PIXI.particles.upgradeConfig(cfg, texArr); }
    catch (e) { console.warn('[pixi-studio] upgradeConfig failed:', e); }
  }
  // Per-emitter light cast (cheap fake lighting) — parity with runtime
  if (layer.lightCast) {
    try {
      const ls = new PIXI.Sprite(_avtProcTextures('glow'));
      ls.anchor.set(0.5);
      ls.tint = _psHexToInt(layer.lightCast.color || '#ffffff');
      ls.alpha = layer.lightCast.alpha ?? 0.6;
      ls.blendMode = PIXI.BLEND_MODES.ADD;
      const r = layer.lightCast.radius || 90;
      ls.width = ls.height = r * 2;
      ls.x = x; ls.y = y;
      container.addChild(ls);
    } catch (_) {}
  }
  try {
    const em = new PIXI.particles.Emitter(container, cfg);
    em.updateSpawnPos(x, y);
    em.emit = true;
    PIXI_STUDIO_STATE._emitterMap.set(layer.id, em);
    // Emitter is updated exclusively by _psPreviewTick RAF — no ticker.add here
  } catch (e) { console.warn('[pixi-studio] emitter create failed', e); }
}

function psPreviewSyncEmitter(layerId) {
  const em = PIXI_STUDIO_STATE._emitterMap.get(layerId);
  if (em && !em.destroyed) { try { em.destroy(); } catch (_) {} }
  PIXI_STUDIO_STATE._emitterMap.delete(layerId);
  // Tear down the layer's previous container (+ its filters) so repeated edits don't
  // orphan containers/filters on the GPU → gray preview.
  if (!PIXI_STUDIO_STATE._layerContainers) PIXI_STUDIO_STATE._layerContainers = new Map();
  const prev = PIXI_STUDIO_STATE._layerContainers.get(layerId);
  if (prev) {
    _psDestroyFilters(prev);
    try { prev.destroy({ children: true, texture: false }); } catch (_) {}
    PIXI_STUDIO_STATE._layerContainers.delete(layerId);
  }
  const layer = _psGetLayer(layerId);
  if (!layer || !layer.emitter || !PIXI_STUDIO_STATE._worldRoot) return;
  const app = PIXI_STUDIO_STATE.previewApp;
  if (!app) return;
  const bm = { add: PIXI.BLEND_MODES.ADD, normal: PIXI.BLEND_MODES.NORMAL, screen: PIXI.BLEND_MODES.SCREEN, multiply: PIXI.BLEND_MODES.MULTIPLY };
  const container = new PIXI.Container();
  container.position.set(app.renderer.width / 2, app.renderer.height / 2);
  container.blendMode = bm[layer.blendMode] ?? PIXI.BLEND_MODES.ADD;
  PIXI_STUDIO_STATE._worldRoot.addChild(container);
  PIXI_STUDIO_STATE._layerContainers.set(layerId, container);
  _psCreateEmitter(layer, container, layer.offset?.x || 0, layer.offset?.y || 0);
  if (PIXI_STUDIO_STATE._fxEnabled !== false) _psApplyContainerFilters(container, layer);
}

function _psDestroyAllEmitters() {
  for (const [, em] of PIXI_STUDIO_STATE._emitterMap) {
    try { if (!em.destroyed) em.destroy(); } catch (_) {}
  }
  PIXI_STUDIO_STATE._emitterMap.clear();
  // RAF is NOT cancelled here — managed by psPreviewMount/psPreviewUnmount
}

async function _psCaptureThumbnail() {
  const app = PIXI_STUDIO_STATE.previewApp;
  if (!app) return null;
  return new Promise(res => {
    const cv = app.renderer.extract.canvas(app.stage);
    cv.toBlob(blob => res(blob || null), 'image/png', 0.8);
  });
}

// ══ F — TIMELINE ══════════════════════════════════════════════════════════════

function psTimelineRender() {
  const el = document.getElementById('ps-timeline');
  if (!el) return;
  const cfg = PIXI_STUDIO_STATE.atual?.config_json;
  const dur = cfg?.duracao_ms || 1000;
  const layers = cfg?.layers || [];
  const t = Math.min(1, PIXI_STUDIO_STATE.previewTime / dur);
  const tipoColor = { emitter: '#4fa3d1', sprite: '#c8a84b', shape: '#27ae60', background: '#555' };

  el.innerHTML = `
<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
  <span style="font-family:var(--fonte-d);font-size:0.6rem;color:var(--suave);min-width:70px">Duração (ms)</span>
  <input type="number" value="${dur}" min="100" max="30000" step="100"
    oninput="psUpdateConfigProp('duracao_ms',parseInt(this.value)||1000);psTimelineRender()"
    style="width:70px;padding:3px 6px;background:var(--painel);border:1px solid var(--borda);border-radius:3px;color:var(--texto);font-size:0.72rem;text-align:center">
</div>
<div id="ps-tl-ruler" style="position:relative;height:18px;background:var(--painel);border-radius:4px;cursor:col-resize;margin-bottom:6px;user-select:none"
  onmousedown="psTimelineScrubStart(event)" ontouchstart="psTimelineScrubStart(event)">
  <div id="ps-tl-playhead" style="position:absolute;top:0;bottom:0;width:2px;background:var(--destaque);left:${t*100}%;pointer-events:none;transition:none"></div>
  ${[0,0.25,0.5,0.75,1].map(p=>`<div style="position:absolute;left:${p*100}%;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.08)"></div>
    <span style="position:absolute;left:${p*100}%;top:2px;font-size:0.55rem;color:var(--suave);transform:translateX(-50%)">${(p*dur/1000).toFixed(1)}s</span>`).join('')}
</div>
<div id="ps-tl-lanes">${layers.map(l => {
  const st = l.start_t ?? 0, et = l.end_t ?? 1;
  const leftPct  = (st * 100).toFixed(2) + '%';
  const widthPct = ((et - st) * 100).toFixed(2) + '%';
  const col = tipoColor[l.tipo] || '#fff';
  const kfDiamonds = (l.keyframes||[]).map((k,i) => {
    const kfPos = (st + k.t * (et - st)) * 100;
    return `<div title="t=${k.t}" style="position:absolute;left:${kfPos}%;top:50%;width:8px;height:8px;
      background:${col};transform:translate(-50%,-50%) rotate(45deg);cursor:ew-resize;z-index:4"
      onmousedown="event.stopPropagation();psTimelineKfDragStart('${l.id}',${i},event)"></div>`;
  }).join('');
  const spTriangles = (l.spawn_path||[]).map((pt,i) => {
    const ptPos = (st + pt.t * (et - st)) * 100;
    return `<div title="${Math.round((st + pt.t*(et-st)) * dur)}ms" style="position:absolute;left:${ptPos}%;bottom:1px;width:0;height:0;
      border-left:4px solid transparent;border-right:4px solid transparent;border-top:7px solid #f39c12;
      transform:translateX(-50%);cursor:ew-resize;z-index:5"
      onmousedown="event.stopPropagation();psTimelineSpawnPathDragStart('${l.id}',${i},event)"></div>`;
  }).join('');
  return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
    <div style="min-width:70px;font-size:0.62rem;color:var(--suave);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.nome}</div>
    <div style="flex:1;position:relative;height:16px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:visible">
      <div style="position:absolute;left:${leftPct};width:${widthPct};top:0;bottom:0;background:${col};opacity:0.35;border-radius:3px;cursor:grab"
        onmousedown="event.stopPropagation();psTimelineLayerDragStart('${l.id}','move',event)"></div>
      <div style="position:absolute;left:${leftPct};width:6px;top:0;bottom:0;background:${col};opacity:0.7;border-radius:3px 0 0 3px;cursor:w-resize;transform:translateX(-2px);z-index:3"
        onmousedown="event.stopPropagation();psTimelineLayerDragStart('${l.id}','start',event)"></div>
      <div style="position:absolute;left:calc(${leftPct} + ${widthPct});width:6px;top:0;bottom:0;background:${col};opacity:0.7;border-radius:0 3px 3px 0;cursor:e-resize;transform:translateX(-4px);z-index:3"
        onmousedown="event.stopPropagation();psTimelineLayerDragStart('${l.id}','end',event)"></div>
      ${kfDiamonds}${spTriangles}
    </div>
  </div>`;
}).join('')}</div>`;
}

function psTimelineScrubStart(e) {
  PIXI_STUDIO_STATE._scrubbing = true;
  psTimelineScrubMove(e);
  document.addEventListener('mousemove', psTimelineScrubMove);
  document.addEventListener('mouseup', psTimelineScrubEnd);
  document.addEventListener('touchmove', psTimelineScrubMove, { passive: false });
  document.addEventListener('touchend', psTimelineScrubEnd);
}
function psTimelineScrubMove(e) {
  if (!PIXI_STUDIO_STATE._scrubbing) return;
  if (e.preventDefault) e.preventDefault();
  const ruler = document.getElementById('ps-tl-ruler');
  if (!ruler) return;
  const rect = ruler.getBoundingClientRect();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const t = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
  const dur = PIXI_STUDIO_STATE.atual?.config_json?.duracao_ms || 1000;
  PIXI_STUDIO_STATE.previewTime = t * dur;
  const ph = document.getElementById('ps-tl-playhead');
  if (ph) ph.style.left = (t * 100) + '%';
  _psUpdateTimeDisplay(t, dur);
  if (!PIXI_STUDIO_STATE.previewPlaying) _psPreviewRenderFrame(t);
}
function psTimelineScrubEnd() {
  PIXI_STUDIO_STATE._scrubbing = false;
  document.removeEventListener('mousemove', psTimelineScrubMove);
  document.removeEventListener('mouseup', psTimelineScrubEnd);
  document.removeEventListener('touchmove', psTimelineScrubMove);
  document.removeEventListener('touchend', psTimelineScrubEnd);
}
function psTimelineKfDragStart(layerId, kfIdx, e) {
  PIXI_STUDIO_STATE._kfDrag = { layerId, kfIdx };
  document.addEventListener('mousemove', _psKfDragMove);
  document.addEventListener('mouseup', _psKfDragEnd);
}
function _psKfDragMove(e) {
  if (!PIXI_STUDIO_STATE._kfDrag) return;
  const { layerId, kfIdx } = PIXI_STUDIO_STATE._kfDrag;
  const ruler = document.getElementById('ps-tl-ruler');
  if (!ruler) return;
  const rect = ruler.getBoundingClientRect();
  const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  psUpdateKeyframe(layerId, kfIdx, { t });
}
function _psKfDragEnd() {
  PIXI_STUDIO_STATE._kfDrag = null;
  document.removeEventListener('mousemove', _psKfDragMove);
  document.removeEventListener('mouseup', _psKfDragEnd);
}

// ── Layer timeline drag (move block / resize start / resize end) ─────────────
function psTimelineLayerDragStart(layerId, edge, e) {
  const ruler = document.getElementById('ps-tl-ruler');
  const rect  = ruler?.getBoundingClientRect();
  if (!rect) return;
  const layer = _psGetLayer(layerId);
  if (!layer) return;
  PIXI_STUDIO_STATE._layerDrag = {
    layerId, edge,
    startX: e.clientX,
    rulerW: rect.width,
    origSt: layer.start_t ?? 0,
    origEt: layer.end_t   ?? 1,
  };
  document.addEventListener('mousemove', _psLayerDragMove);
  document.addEventListener('mouseup',   _psLayerDragEnd);
}
function _psLayerDragMove(e) {
  const d = PIXI_STUDIO_STATE._layerDrag;
  if (!d) return;
  const layer = _psGetLayer(d.layerId);
  if (!layer) return;
  const dt = (e.clientX - d.startX) / d.rulerW;
  if (d.edge === 'move') {
    const dur = d.origEt - d.origSt;
    const newSt = Math.max(0, Math.min(1 - dur, d.origSt + dt));
    layer.start_t = Math.round(newSt * 1000) / 1000;
    layer.end_t   = Math.round((newSt + dur) * 1000) / 1000;
  } else if (d.edge === 'start') {
    layer.start_t = Math.round(Math.max(0, Math.min(d.origEt - 0.05, d.origSt + dt)) * 1000) / 1000;
  } else if (d.edge === 'end') {
    layer.end_t   = Math.round(Math.min(1, Math.max(d.origSt + 0.05, d.origEt + dt)) * 1000) / 1000;
  }
  _psSetDirty(true);
  psTimelineRender();
}
function _psLayerDragEnd() {
  PIXI_STUDIO_STATE._layerDrag = null;
  document.removeEventListener('mousemove', _psLayerDragMove);
  document.removeEventListener('mouseup',   _psLayerDragEnd);
}

// ── Spawn_path point timing drag ─────────────────────────────────────────────
function psTimelineSpawnPathDragStart(layerId, ptIdx, e) {
  PIXI_STUDIO_STATE._spDrag = { layerId, ptIdx };
  document.addEventListener('mousemove', _psSpawnPathDragMove);
  document.addEventListener('mouseup',   _psSpawnPathDragEnd);
}
function _psSpawnPathDragMove(e) {
  const d = PIXI_STUDIO_STATE._spDrag;
  if (!d) return;
  const ruler = document.getElementById('ps-tl-ruler');
  const rect  = ruler?.getBoundingClientRect();
  if (!rect) return;
  const tAbs  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const layer = _psGetLayer(d.layerId);
  const st = layer?.start_t ?? 0, et = layer?.end_t ?? 1;
  const range = et - st;
  if (range > 0 && layer?.spawn_path?.[d.ptIdx]) {
    const tRel = Math.max(0, Math.min(1, (tAbs - st) / range));
    layer.spawn_path[d.ptIdx].t = Math.round(tRel * 1000) / 1000;
    _psSetDirty(true);
    psTimelineRender();
  }
}
function _psSpawnPathDragEnd() {
  PIXI_STUDIO_STATE._spDrag = null;
  document.removeEventListener('mousemove', _psSpawnPathDragMove);
  document.removeEventListener('mouseup',   _psSpawnPathDragEnd);
}

// ══ G — BEHAVIOR PANEL ════════════════════════════════════════════════════════

function _psRenderBehaviorPanel() {
  const el = document.getElementById('ps-behavior-panel');
  if (!el) return;
  const cfg = PIXI_STUDIO_STATE.atual?.config_json;
  if (!cfg) { el.innerHTML = ''; return; }
  const b = cfg.behavior || 'one-shot';
  const bc = cfg.behavior_config || {};
  const isProj = b === 'projectile';
  const isChain = b === 'chain';
  el.innerHTML = `
<div class="form-group" style="margin-bottom:6px"><label style="font-size:0.66rem">Tipo</label>
  <select onchange="psUpdateConfigProp('behavior',this.value);PIXI_STUDIO_STATE.atual.behavior=this.value;_psRenderBehaviorPanel()"
    style="width:100%;padding:5px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.72rem">
    ${[['one-shot','Disparo Único'],['loop','Loop'],['projectile','Projétil (A→B)'],['aoe','Área (AOE)'],['follow-caster','Seguir Conjurador'],['follow-target','Seguir Alvo'],['channel','Canalizado'],['chain','Combo Chain']].map(([v,l])=>`<option value="${v}"${b===v?' selected':''}>${l}</option>`).join('')}
  </select></div>
<div class="form-group" style="margin-bottom:6px"><label style="font-size:0.66rem">Posição</label>
  <select onchange="psUpdateConfigProp('posicao',this.value)"
    style="width:100%;padding:5px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.72rem">
    ${['alvo','atacante','meio','area','trajetoria'].map(v=>`<option value="${v}"${cfg.posicao===v?' selected':''}>${v}</option>`).join('')}
  </select></div>
${isProj ? `<div class="form-group" style="margin-bottom:6px"><label style="font-size:0.66rem">Velocidade do Projétil (ms)</label>
  <input type="number" value="${bc.projectile_speed_ms||500}" min="100" max="5000" step="50"
    oninput="psUpdateConfigProp('behavior_config',Object.assign(PIXI_STUDIO_STATE.atual.config_json.behavior_config||{},{projectile_speed_ms:parseInt(this.value)||500}))"
    style="width:100%;padding:4px 6px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.78rem;text-align:center"></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
  <div class="form-group"><label style="font-size:0.62rem">Trajetória</label>
    <select onchange="psSetTravel('path',this.value)" style="width:100%;padding:4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.7rem">
      ${[['linear','reta'],['arc','arco'],['spiral','espiral'],['homing','teleguiado']].map(([v,l])=>`<option value="${v}"${(cfg.travel?.path||'linear')===v?' selected':''}>${l}</option>`).join('')}
    </select></div>
  <label style="display:flex;align-items:flex-end;gap:5px;font-size:0.66rem;cursor:pointer;padding-bottom:4px">
    <input type="checkbox" ${cfg.travel?.rotate==='velocity'?'checked':''} onchange="psSetTravel('rotate',this.checked?'velocity':'')"> girar p/ direção</label>
</div>` : ''}
${isChain ? _psChainBuilderHtml(cfg) : ''}
<div style="border-top:1px solid var(--borda);padding-top:8px;margin-top:4px">
<div style="font-family:var(--fonte-d);font-size:0.62rem;color:var(--suave);text-transform:uppercase;margin-bottom:6px">Câmera</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
  <div class="form-group"><label style="font-size:0.6rem">Shake Amp</label>
    <input type="number" value="${cfg.camera?.shake?.amp??4}" min="0" max="30" step="1"
      oninput="cfg=PIXI_STUDIO_STATE.atual.config_json;if(!cfg.camera)cfg.camera={};if(!cfg.camera.shake)cfg.camera.shake={};cfg.camera.shake.amp=parseInt(this.value)||0;_psSetDirty(true)"
      style="width:100%;padding:3px 5px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem;text-align:center"></div>
  <div class="form-group"><label style="font-size:0.6rem">Hitstop (ms)</label>
    <input type="number" value="${cfg.camera?.hitstop?.ms??0}" min="0" max="200" step="10"
      oninput="cfg=PIXI_STUDIO_STATE.atual.config_json;if(!cfg.camera)cfg.camera={};if(!cfg.camera.hitstop)cfg.camera.hitstop={};cfg.camera.hitstop.ms=parseInt(this.value)||0;_psSetDirty(true)"
      style="width:100%;padding:3px 5px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem;text-align:center"></div>
</div></div>`;
}

function psSetTravel(key, val) {
  const cfg = PIXI_STUDIO_STATE.atual?.config_json; if (!cfg) return;
  if (!cfg.travel) cfg.travel = {};
  cfg.travel[key] = val; _psSetDirty(true);
}

function _psChainBuilderHtml(cfg) {
  const seq = cfg.behavior_config?.sequence || [];
  const ibtn = 'background:none;border:none;cursor:pointer;font-size:0.65rem;color:var(--suave);padding:1px 2px';
  return `<div style="border:1px solid var(--borda);border-radius:6px;padding:8px;margin-bottom:6px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
    <span style="font-size:0.62rem;color:var(--suave);text-transform:uppercase">Sequência do Combo</span>
    <button onclick="psChainAdd()" style="background:none;border:1px solid var(--borda);border-radius:3px;color:var(--suave);font-size:0.6rem;cursor:pointer;padding:1px 6px">+ Passo</button>
  </div>
  ${seq.length ? seq.map((s, i) => `<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">
    <span style="font-size:0.6rem;color:var(--suave);width:12px">${i + 1}</span>
    <span style="flex:1;font-size:0.66rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(s.animNome || s.animId || '?')}</span>
    <input type="number" min="0" step="50" value="${s.delay_ms || 0}" title="delay (ms) antes deste passo" onchange="psChainSetDelay(${i},parseInt(this.value)||0)" style="width:48px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.62rem;text-align:center">
    <button onclick="psChainMove(${i},-1)" style="${ibtn}">↑</button>
    <button onclick="psChainMove(${i},1)" style="${ibtn}">↓</button>
    <button onclick="psChainRemove(${i})" style="background:none;border:none;cursor:pointer;font-size:0.66rem;color:var(--perigo);padding:1px 2px">✕</button>
  </div>`).join('') : '<div style="font-size:0.64rem;color:var(--suave);font-style:italic">Adicione passos — cada um toca uma animação salva, na ordem, com seu atraso.</div>'}
  </div>`;
}
function _psChainSeq(create) {
  const cfg = PIXI_STUDIO_STATE.atual?.config_json; if (!cfg) return null;
  if (create) { if (!cfg.behavior_config) cfg.behavior_config = {}; if (!cfg.behavior_config.sequence) cfg.behavior_config.sequence = []; }
  return cfg.behavior_config?.sequence || null;
}
function psChainAdd() {
  if (typeof psPickerAbrir !== 'function') return;
  psPickerAbrir((id, nome) => {
    const seq = _psChainSeq(true); if (!seq) return;
    seq.push({ animId: id, animNome: nome, delay_ms: 200 });
    _psSetDirty(true); _psRenderBehaviorPanel();
  });
}
function psChainSetDelay(i, v) { const seq = _psChainSeq(false); if (seq && seq[i]) { seq[i].delay_ms = v; _psSetDirty(true); } }
function psChainRemove(i) { const seq = _psChainSeq(false); if (seq) { seq.splice(i, 1); _psSetDirty(true); _psRenderBehaviorPanel(); } }
function psChainMove(i, dir) {
  const seq = _psChainSeq(false); if (!seq) return;
  const j = i + dir; if (j < 0 || j >= seq.length) return;
  const tmp = seq[i]; seq[i] = seq[j]; seq[j] = tmp;
  _psSetDirty(true); _psRenderBehaviorPanel();
}

// ══ H — PRESETS MODAL ═════════════════════════════════════════════════════════

function psPresetsAbrir() {
  let modal = document.getElementById('ps-presets-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ps-presets-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:1100;align-items:center;justify-content:center';
    modal.innerHTML = `<div style="background:var(--escuro);border:1px solid var(--borda);border-radius:12px;padding:24px;width:90%;max-width:640px;max-height:85vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-family:var(--fonte-d);color:var(--destaque)">⚡ Biblioteca de Presets</div>
        <button onclick="document.getElementById('ps-presets-modal').style.display='none'" style="background:none;border:none;color:var(--suave);font-size:1.2rem;cursor:pointer">✕</button>
      </div>
      <div id="ps-presets-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px"></div>
    </div>`;
    document.body.appendChild(modal);
  }
  const grid = document.getElementById('ps-presets-grid');
  if (grid) {
    grid.innerHTML = Object.keys(PIXI_STUDIO_PRESETS).map(key => {
      const meta = PIXI_STUDIO_PRESET_META[key] || { nome: key, cor: '#4fa3d1', categoria: '' };
      const cfg = PIXI_STUDIO_PRESETS[key];
      return `<div onclick="psLoadPreset('${key}');document.getElementById('ps-presets-modal').style.display='none'"
        style="padding:12px;border:1px solid var(--borda);border-radius:8px;cursor:pointer;background:rgba(255,255,255,0.02);transition:background 0.15s"
        onmouseenter="this.style.background='rgba(79,163,209,0.1)'" onmouseleave="this.style.background='rgba(255,255,255,0.02)'">
        <div style="height:40px;border-radius:5px;margin-bottom:8px;background:linear-gradient(135deg,${meta.cor}33,${meta.cor}11);border:1px solid ${meta.cor}33;display:flex;align-items:center;justify-content:center">
          <div style="width:16px;height:16px;border-radius:50%;background:${meta.cor};opacity:0.8;box-shadow:0 0 10px ${meta.cor}"></div>
        </div>
        <div style="font-family:var(--fonte-d);font-size:0.72rem;margin-bottom:3px">${meta.nome}</div>
        <div style="font-size:0.62rem;color:var(--suave)">${meta.categoria} · ${cfg.behavior||'one-shot'} · ${(cfg.duracao_ms/1000).toFixed(1)}s</div>
      </div>`;
    }).join('');
  }
  modal.style.display = 'flex';
}

function psLoadPreset(key) {
  const preset = PIXI_STUDIO_PRESETS[key];
  if (!preset) return;
  const meta = PIXI_STUDIO_PRESET_META[key] || {};
  const clone = JSON.parse(JSON.stringify(preset));
  // Assign new unique layer IDs
  clone.layers.forEach((l, i) => { l.id = 'l_' + Date.now() + '_' + i; });
  if (!PIXI_STUDIO_STATE.atual) psNova();
  const cur = PIXI_STUDIO_STATE.atual;
  cur.nome = meta.nome || key;
  cur.config_json = clone;
  cur.behavior = clone.behavior;
  cur.duracao_ms = clone.duracao_ms;
  _psHistoryReset();
  PIXI_STUDIO_STATE.layerSel = null;
  _psSetDirty(true);
  psPreviewStop();
  _psRenderLayerList();
  _psRenderBehaviorPanel();
  _psRenderPropsPanel();
  psTimelineRender();
  _psRemountOrRebuild();
  mostrarToast(`Preset "${meta.nome||key}" carregado`, 'sucesso');
}

// ══ I — IMPORT / EXPORT JSON ══════════════════════════════════════════════════

function psImportarAbrir() {
  let modal = document.getElementById('ps-import-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ps-import-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:1100;align-items:center;justify-content:center';
    modal.innerHTML = `<div style="background:var(--escuro);border:1px solid var(--borda);border-radius:12px;padding:24px;width:90%;max-width:560px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-family:var(--fonte-d);color:var(--destaque)">⬆ Importar JSON</div>
        <button onclick="document.getElementById('ps-import-modal').style.display='none'" style="background:none;border:none;color:var(--suave);font-size:1.2rem;cursor:pointer">✕</button>
      </div>
      <p style="font-size:0.78rem;color:var(--suave);margin-bottom:12px">Cole um JSON de <code>@pixi/particle-emitter</code> (v4 ou v5) ou um config_json completo do Studio Pixi.</p>
      <textarea id="ps-import-json-text" rows="10" placeholder='{"alpha":{...},"speed":{...},...}'
        style="width:100%;padding:8px;background:var(--preto);border:1px solid var(--borda);border-radius:6px;color:var(--texto);font-size:0.72rem;resize:vertical;font-family:monospace"></textarea>
      <div style="display:flex;align-items:center;gap:8px;margin-top:12px">
        <button class="btn btn-primario" onclick="psImportarJson()" style="font-size:0.78rem;padding:7px 16px">Importar</button>
        <label style="font-size:0.75rem;color:var(--suave)">ou <input type="file" accept=".json,application/json" onchange="psImportarArquivo(this)" style="font-size:0.7rem"></label>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
}

function psImportarJson(jsonStr) {
  if (!jsonStr) jsonStr = document.getElementById('ps-import-json-text')?.value || '';
  if (!jsonStr.trim()) return mostrarToast('JSON vazio', 'erro');
  let parsed;
  try { parsed = JSON.parse(jsonStr); } catch (e) { return mostrarToast('JSON inválido: ' + e.message, 'erro'); }

  let config;
  if (parsed.version === 2 && parsed.layers) {
    // Full Studio config — validate emitter layers
    config = parsed;
    (config.layers || []).forEach(l => {
      if (l.tipo === 'emitter' && l.emitter) l.emitter = _psValidateEmitterCfg(l.emitter);
    });
  } else {
    // Raw pixi-particle-emitter config → wrap as single emitter layer
    config = _psDefaultConfig();
    config.layers[0].emitter = _psValidateEmitterCfg(parsed);
    config.layers[0].nome = 'Importado';
  }
  (config.layers || []).forEach((l, i) => { if (!l.id) l.id = 'l_' + Date.now() + '_' + i; });

  if (!PIXI_STUDIO_STATE.atual) psNova();
  const cur = PIXI_STUDIO_STATE.atual;
  cur.config_json = config;
  cur.behavior = config.behavior || 'one-shot';
  cur.duracao_ms = config.duracao_ms || 1000;
  _psHistoryReset();
  PIXI_STUDIO_STATE.layerSel = config.layers?.[0]?.id || null;
  _psSetDirty(true);
  _psRenderLayerList();
  _psRenderBehaviorPanel();
  _psRenderPropsPanel();
  psTimelineRender();
  document.getElementById('ps-import-modal').style.display = 'none';
  const afterMount = () => { _psDoPlay(); };
  if (!PIXI_STUDIO_STATE.previewApp) psPreviewMount().then(afterMount);
  else { psPreviewRebuildAll(); afterMount(); }
  mostrarToast('JSON importado — reproduzindo!', 'sucesso');
}

function psImportarArquivo(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const ta = document.getElementById('ps-import-json-text');
    if (ta) ta.value = e.target.result;
    psImportarJson(e.target.result);
  };
  reader.readAsText(file);
}

function psExportarJson() {
  const cur = PIXI_STUDIO_STATE.atual;
  if (!cur) return mostrarToast('Nenhuma animação para exportar', 'erro');
  const layerSel = PIXI_STUDIO_STATE.layerSel;
  let data;
  if (layerSel) {
    const layer = _psGetLayer(layerSel);
    if (layer?.tipo === 'emitter') data = layer.emitter;
    else data = layer;
  } else {
    data = cur.config_json;
  }
  const jsonStr = JSON.stringify(data, null, 2);
  // Show in a modal
  let modal = document.getElementById('ps-export-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ps-export-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:1100;align-items:center;justify-content:center';
    modal.innerHTML = `<div style="background:var(--escuro);border:1px solid var(--borda);border-radius:12px;padding:24px;width:90%;max-width:560px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-family:var(--fonte-d);color:var(--destaque)">⬇ Export JSON</div>
        <button onclick="document.getElementById('ps-export-modal').style.display='none'" style="background:none;border:none;color:var(--suave);font-size:1.2rem;cursor:pointer">✕</button>
      </div>
      <textarea id="ps-export-json-text" rows="14"
        style="width:100%;padding:8px;background:var(--preto);border:1px solid var(--borda);border-radius:6px;color:var(--texto);font-size:0.68rem;resize:vertical;font-family:monospace" readonly></textarea>
      <div style="margin-top:10px;display:flex;gap:8px">
        <button class="btn btn-primario" onclick="navigator.clipboard.writeText(document.getElementById('ps-export-json-text').value).then(()=>mostrarToast('Copiado!','sucesso'))" style="font-size:0.78rem;padding:7px 16px">📋 Copiar</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  const ta = document.getElementById('ps-export-json-text');
  if (ta) ta.value = jsonStr;
  modal.style.display = 'flex';
}

// ══ J — UPLOAD TEXTURE ════════════════════════════════════════════════════════

async function psUploadTexture(layerId, input) {
  const file = input.files?.[0];
  if (!file) return;
  mostrarToast('Enviando imagem...', '');
  try {
    const url = await uploadToStorage(file, 'pixi-textures');
    psUpdateLayerProp(layerId, 'texture_url', url);
    _psRenderPropsPanel();
    mostrarToast('Imagem carregada!', 'sucesso');
  } catch (e) {
    mostrarToast('Erro no upload: ' + (e.message || e), 'erro');
  }
}

// ══ K — SKILL PICKER ══════════════════════════════════════════════════════════

function psPickerAbrir(callbackFn) {
  PIXI_STUDIO_STATE._pickerCb = callbackFn;
  let modal = document.getElementById('ps-picker-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ps-picker-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:1100;align-items:center;justify-content:center';
    modal.innerHTML = `<div style="background:var(--escuro);border:1px solid var(--borda);border-radius:12px;padding:20px;width:90%;max-width:480px;max-height:80vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-family:var(--fonte-d);color:var(--destaque)">✦ Escolher Animação</div>
        <button onclick="document.getElementById('ps-picker-modal').style.display='none'" style="background:none;border:none;color:var(--suave);font-size:1.2rem;cursor:pointer">✕</button>
      </div>
      <div id="ps-picker-list" style="display:flex;flex-direction:column;gap:6px"></div>
    </div>`;
    document.body.appendChild(modal);
  }
  _psRenderPickerList();
  modal.style.display = 'flex';
}

function _psRenderPickerList() {
  const el = document.getElementById('ps-picker-list');
  if (!el) return;
  const list = PIXI_STUDIO_STATE.animacoes;
  if (!list.length) { el.innerHTML = '<div style="font-size:0.78rem;color:var(--suave);text-align:center;padding:20px">Nenhuma animação salva.</div>'; return; }
  el.innerHTML = list.map(a => `
    <div onclick="psPickerSelecionar('${a.id}','${_esc(a.nome)}')"
      style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--borda);border-radius:8px;cursor:pointer;background:rgba(255,255,255,0.02)"
      onmouseenter="this.style.background='rgba(79,163,209,0.1)'" onmouseleave="this.style.background='rgba(255,255,255,0.02)'">
      ${a.preview_url ? `<img src="${a.preview_url}" style="width:50px;height:32px;object-fit:cover;border-radius:4px;flex-shrink:0">` : '<div style="width:50px;height:32px;background:var(--preto);border-radius:4px;flex-shrink:0"></div>'}
      <div>
        <div style="font-family:var(--fonte-d);font-size:0.8rem">${_esc(a.nome)}</div>
        <div style="font-size:0.65rem;color:var(--suave)">${a.behavior||'one-shot'} · ${(a.duracao_ms/1000).toFixed(1)}s${a.global?' · global':''}</div>
      </div>
    </div>`).join('');
}

function psPickerSelecionar(id, nome) {
  document.getElementById('ps-picker-modal').style.display = 'none';
  if (typeof PIXI_STUDIO_STATE._pickerCb === 'function') {
    PIXI_STUDIO_STATE._pickerCb(id, nome);
    PIXI_STUDIO_STATE._pickerCb = null;
  }
}

// ══ Expose globals ════════════════════════════════════════════════════════════
window.pixiStudioInit       = pixiStudioInit;
window.psCarregarLista      = psCarregarLista;
window.psCarregarAnimacao   = psCarregarAnimacao;
window.psNova               = psNova;
window.psSalvar             = psSalvar;
window.psExcluirAtual       = psExcluirAtual;
window.psAddLayer           = psAddLayer;
window.psRemoveLayer        = psRemoveLayer;
window.psMoveLayer          = psMoveLayer;
window.psSelectLayer        = psSelectLayer;
window.psUpdateLayerProp    = psUpdateLayerProp;
window.psUpdateEmitterProp  = psUpdateEmitterProp;
window.psUpdateConfigProp   = psUpdateConfigProp;
window.psAddKeyframe        = psAddKeyframe;
window.psUpdateKeyframe     = psUpdateKeyframe;
window.psRemoveKeyframe     = psRemoveKeyframe;
window.psPreviewPlay        = psPreviewPlay;
window.psPreviewPause       = psPreviewPause;
window.psPreviewStop        = psPreviewStop;
window.psPreviewToggleLoop  = psPreviewToggleLoop;
window.psPreviewZoom        = psPreviewZoom;
window.psPreviewRebuildAll  = psPreviewRebuildAll;
window.psTimelineRender     = psTimelineRender;
window.psTimelineScrubStart = psTimelineScrubStart;
window.psTimelineScrubMove  = psTimelineScrubMove;
window.psTimelineScrubEnd   = psTimelineScrubEnd;
window.psTimelineKfDragStart = psTimelineKfDragStart;
window.psPresetsAbrir       = psPresetsAbrir;
window.psLoadPreset         = psLoadPreset;
window.psImportarAbrir      = psImportarAbrir;
window.psImportarJson       = psImportarJson;
window.psImportarArquivo    = psImportarArquivo;
window.psExportarJson       = psExportarJson;
window.psUploadTexture      = psUploadTexture;
window.psPickerAbrir        = psPickerAbrir;
window.psPickerSelecionar   = psPickerSelecionar;
window.psUpdateColorStop    = psUpdateColorStop;
window.psAddColorStop       = psAddColorStop;
window.psRemoveColorStop    = psRemoveColorStop;
window.psUpdateAlphaStop    = psUpdateAlphaStop;
window.psUpdateScaleStop    = psUpdateScaleStop;
window._psRenderLayerList   = _psRenderLayerList;
window._psRenderPropsPanel  = _psRenderPropsPanel;
window._psSetDirty          = _psSetDirty;
window.psUndo               = psUndo;
window.psRedo               = psRedo;
window.psToggleGravar       = psToggleGravar;
window._psRecordFinish      = _psRecordFinish;
// New (excellence pass) exports
window.psDuplicateLayer       = psDuplicateLayer;
window.psUpdateLayerOffset    = psUpdateLayerOffset;
window.psUpdateEmitterDir     = psUpdateEmitterDir;
window.psSetSpawnType         = psSetSpawnType;
window.psUpdateSpawnRect      = psUpdateSpawnRect;
window.psToggleFx             = psToggleFx;
window.psToggleScene          = psToggleScene;
window.psToggleLayerGlow      = psToggleLayerGlow;
window.psToggleLayerTrail     = psToggleLayerTrail;
window.psToggleLayerLightCast = psToggleLayerLightCast;
window.psToggleSpritesheet    = psToggleSpritesheet;
window.psAddFilter            = psAddFilter;
window.psRemoveFilter         = psRemoveFilter;
window.psUpdateFilterParam    = psUpdateFilterParam;
window.psAddAlphaStop         = psAddAlphaStop;
window.psRemoveAlphaStop      = psRemoveAlphaStop;
window.psUpdateAlphaStopTime  = psUpdateAlphaStopTime;
window.psAddScaleStop         = psAddScaleStop;
window.psRemoveScaleStop      = psRemoveScaleStop;
window.psUpdateScaleStopTime  = psUpdateScaleStopTime;
window.psSetAudio             = psSetAudio;
window.psSetSfx               = psSetSfx;
window.psTestSfx              = psTestSfx;
window.psTestSfxId            = psTestSfxId;
window.psAddAudioEvent        = psAddAudioEvent;
window.psUpdateAudioEvent     = psUpdateAudioEvent;
window.psRemoveAudioEvent     = psRemoveAudioEvent;
window.psToggleBloom          = psToggleBloom;
window.psSetLighting          = psSetLighting;
window.psSetTravel            = psSetTravel;
window.psChainAdd             = psChainAdd;
window.psChainSetDelay        = psChainSetDelay;
window.psChainRemove          = psChainRemove;
window.psChainMove            = psChainMove;
window.psDuplicarAnimacao     = psDuplicarAnimacao;
window.psFilterAnimList       = psFilterAnimList;

// Keyboard shortcuts: Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo
document.addEventListener('keydown', function(e) {
  if (!document.getElementById('pixi-studio-screen') || document.getElementById('pixi-studio-screen').style.display === 'none') return;
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); psUndo(); }
    else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); psRedo(); }
  }
});
