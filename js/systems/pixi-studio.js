// ─── Studio Pixi — Visual Particle Animation Editor ──────────────────────────
// Depends on: pixi-studio-presets.js, pixi-studio-avt.js, aventura.js (lazy)

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
  _lastTs:        0,
  _rafId:         0,
  _pickerCb:      null,
};

// ══ B — INIT & CRUD ══════════════════════════════════════════════════════════

function pixiStudioInit() {
  if (!RPG_DATA) return;
  // Only master can use Studio
  if (RPG_DATA.myRole !== 'mestre') {
    const root = document.getElementById('ps-root');
    if (root) root.innerHTML = '<div style="padding:40px;text-align:center;color:var(--suave);font-family:var(--fonte-d);font-size:0.85rem">Studio Pixi disponível apenas para o Mestre.</div>';
    return;
  }
  PIXI_STUDIO_STATE.rpgId = RPG_DATA.rpgId;
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
  <button class="btn" style="font-size:0.65rem;padding:4px 10px;color:var(--perigo);border-color:var(--perigo)" onclick="psExcluirAtual()">🗑</button>
</div>
<div id="ps-left" style="background:var(--escuro);border-right:1px solid var(--borda);overflow-y:auto;display:flex;flex-direction:column">
  <div style="padding:10px 12px;border-bottom:1px solid var(--borda)">
    <div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Animações</div>
    <div id="ps-anim-list" style="display:flex;flex-direction:column;gap:4px"></div>
  </div>
  <div style="padding:10px 12px;border-bottom:1px solid var(--borda)">
    <div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;margin-bottom:8px">Camadas</div>
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
      <button class="btn" style="font-size:0.6rem;padding:3px 7px" onclick="psAddLayer('emitter')">+Emissor</button>
      <button class="btn" style="font-size:0.6rem;padding:3px 7px" onclick="psAddLayer('sprite')">+Sprite</button>
      <button class="btn" style="font-size:0.6rem;padding:3px 7px" onclick="psAddLayer('shape')">+Forma</button>
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
  <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:16px;min-height:200px">
    <canvas id="ps-preview-canvas" width="480" height="300" style="border-radius:6px;border:1px solid var(--borda);max-width:100%"></canvas>
  </div>
  <div style="padding:8px 12px;background:var(--escuro);border-top:1px solid var(--borda);display:flex;align-items:center;gap:10px">
    <button onclick="psPreviewPlay()" title="Play" style="background:none;border:none;color:var(--texto);font-size:1.1rem;cursor:pointer;padding:2px 6px">▶</button>
    <button onclick="psPreviewPause()" title="Pause" style="background:none;border:none;color:var(--texto);font-size:1.1rem;cursor:pointer;padding:2px 6px">⏸</button>
    <button onclick="psPreviewStop()" title="Stop" style="background:none;border:none;color:var(--texto);font-size:1.1rem;cursor:pointer;padding:2px 6px">⏹</button>
    <button onclick="psPreviewToggleLoop()" id="ps-loop-btn" title="Loop" style="background:none;border:none;color:var(--suave);font-size:0.9rem;cursor:pointer;padding:2px 6px">↺</button>
    <div style="flex:1"></div>
    <span id="ps-preview-time" style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave)">0.0s / 2.0s</span>
    <label style="font-size:0.68rem;color:var(--suave);display:flex;align-items:center;gap:4px">Zoom
      <input type="range" id="ps-zoom-range" min="0.5" max="3" step="0.1" value="1" style="width:60px" oninput="psPreviewZoom(this.value)">
    </label>
  </div>
  <div id="ps-timeline" style="background:var(--escuro);border-top:1px solid var(--borda);padding:8px 12px;min-height:60px"></div>
</div>
<div id="ps-right" style="background:var(--escuro);border-left:1px solid var(--borda);overflow-y:auto;padding:12px">
  <div id="ps-props-panel"><div style="padding:20px 0;text-align:center;color:var(--suave);font-size:0.8rem;font-style:italic">Selecione uma camada</div></div>
</div>`;
  _psRenderAnimList();
}

async function psCarregarLista() {
  const rpgId = PIXI_STUDIO_STATE.rpgId;
  if (!rpgId) return;
  try {
    const rows = await sb(`pixi_animations?or=(rpg_id.eq.${encodeURIComponent(rpgId)},global.eq.true)&order=criado_em.desc`);
    PIXI_STUDIO_STATE.animacoes = rows || [];
  } catch (e) {
    PIXI_STUDIO_STATE.animacoes = [];
  }
  _psRenderAnimList();
}

function _psRenderAnimList() {
  const el = document.getElementById('ps-anim-list');
  if (!el) return;
  const list = PIXI_STUDIO_STATE.animacoes;
  if (!list.length) {
    el.innerHTML = '<div style="font-size:0.75rem;color:var(--suave);font-style:italic;padding:4px 0">Nenhuma animação. Crie uma!</div>';
    return;
  }
  const cur = PIXI_STUDIO_STATE.atual?.id;
  el.innerHTML = list.map(a => `
    <div class="ps-anim-item" onclick="psCarregarAnimacao('${a.id}')"
      style="padding:6px 8px;border-radius:5px;cursor:pointer;font-size:0.75rem;
             background:${a.id===cur ? 'rgba(79,163,209,0.15)' : 'rgba(255,255,255,0.03)'};
             border:1px solid ${a.id===cur ? 'var(--primario)' : 'transparent'};
             display:flex;align-items:center;gap:6px">
      ${a.preview_url ? `<img src="${a.preview_url}" style="width:36px;height:22px;object-fit:cover;border-radius:3px;flex-shrink:0">` : '<div style="width:36px;height:22px;background:var(--preto);border-radius:3px;flex-shrink:0"></div>'}
      <div style="min-width:0">
        <div style="font-family:var(--fonte-d);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.nome}</div>
        <div style="font-size:0.6rem;color:var(--suave)">${a.behavior || 'one-shot'}${a.global ? ' · global' : ''}</div>
      </div>
    </div>`).join('');
}

async function psCarregarAnimacao(id) {
  const row = PIXI_STUDIO_STATE.animacoes.find(a => a.id === id);
  if (!row) return;
  PIXI_STUDIO_STATE.atual = JSON.parse(JSON.stringify(row));
  PIXI_STUDIO_STATE._dirty = false;
  PIXI_STUDIO_STATE.layerSel = null;
  _psRenderAnimList();
  psPreviewStop();
  psPreviewMount();
  _psRenderLayerList();
  _psRenderBehaviorPanel();
  _psRenderPropsPanel();
  psTimelineRender();
  psPreviewRebuildAll();
}

function psNova() {
  const id = 'novo_' + Date.now();
  const config = _psDefaultConfig();
  PIXI_STUDIO_STATE.atual = { id: null, nome: 'Nova Animação', descricao: '', config_json: config, behavior: 'one-shot', duracao_ms: 1000, global: false };
  PIXI_STUDIO_STATE._dirty = true;
  PIXI_STUDIO_STATE.layerSel = null;
  _psRenderAnimList();
  psPreviewStop();
  psPreviewMount();
  _psRenderLayerList();
  _psRenderBehaviorPanel();
  _psRenderPropsPanel();
  psTimelineRender();
  psPreviewRebuildAll();
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
    rpg_id:      PIXI_STUDIO_STATE.rpgId,
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
  return { t: t ?? 0.5 };
}

function _psRenderLayerList() {
  const el = document.getElementById('ps-layer-list');
  if (!el) return;
  const layers = PIXI_STUDIO_STATE.atual?.config_json?.layers;
  if (!layers?.length) { el.innerHTML = '<div style="font-size:0.72rem;color:var(--suave);font-style:italic">Sem camadas</div>'; return; }
  const sel = PIXI_STUDIO_STATE.layerSel;
  const tipoIcon = { emitter: '✦', sprite: '🖼', shape: '◯', background: '▬' };
  el.innerHTML = [...layers].reverse().map((l, ri) => {
    const idx = layers.length - 1 - ri;
    return `<div style="display:flex;align-items:center;gap:4px;padding:4px 6px;border-radius:4px;cursor:pointer;
              background:${l.id===sel ? 'rgba(79,163,209,0.18)' : 'rgba(255,255,255,0.03)'};
              border:1px solid ${l.id===sel ? 'var(--primario)' : 'transparent'}"
              onclick="psSelectLayer('${l.id}')">
      <span style="font-size:0.75rem;opacity:0.7">${tipoIcon[l.tipo]||'•'}</span>
      <span style="flex:1;font-size:0.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.nome}</span>
      <button onclick="event.stopPropagation();psUpdateLayerProp('${l.id}','visivel',${!l.visivel})"
        style="background:none;border:none;cursor:pointer;font-size:0.75rem;opacity:${l.visivel?1:0.3};padding:1px 3px" title="Visível">👁</button>
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
<label style="display:flex;align-items:center;gap:6px;font-size:0.72rem;cursor:pointer;margin-bottom:8px">
  <input type="checkbox" ${cur.config_json.global?'checked':''} style="accent-color:var(--primario)"
    onchange="psUpdateConfigProp('global',this.checked)"> Global (todas campanhas)
</label>
${_psAudioHtml(cur.config_json)}`;
    return;
  }
  if (layer.tipo === 'emitter') { el.innerHTML = _psEmitterPanelHtml(layer); return; }
  if (layer.tipo === 'sprite')  { el.innerHTML = _psSpriteShapeHtml(layer, 'sprite'); return; }
  if (layer.tipo === 'shape')   { el.innerHTML = _psSpriteShapeHtml(layer, 'shape'); return; }
  if (layer.tipo === 'background') { el.innerHTML = _psBgPanelHtml(layer); return; }
}

function _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function psUpdateConfigProp(key, value) {
  if (!PIXI_STUDIO_STATE.atual) return;
  PIXI_STUDIO_STATE.atual.config_json[key] = value;
  _psSetDirty(true);
}

function _psAudioHtml(cfg) {
  const a = cfg.audio || {};
  return `<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:4px">
<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;margin-bottom:8px">Áudio</div>
<div class="form-group" style="margin-bottom:6px"><label style="font-size:0.66rem">Cast SFX (URL)</label>
  <input type="text" value="${_esc(a.cast||'')}" placeholder="https://..." oninput="psUpdateConfigProp('audio',Object.assign(PIXI_STUDIO_STATE.atual.config_json.audio||{},{cast:this.value}))"
    style="width:100%;padding:4px 6px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
</div>
<div class="form-group" style="margin-bottom:6px"><label style="font-size:0.66rem">Impact SFX (URL)</label>
  <input type="text" value="${_esc(a.impact||'')}" placeholder="https://..." oninput="psUpdateConfigProp('audio',Object.assign(PIXI_STUDIO_STATE.atual.config_json.audio||{},{impact:this.value}))"
    style="width:100%;padding:4px 6px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
</div>
<div class="form-group"><label style="font-size:0.66rem">Volume (${Math.round((a.volume||0.75)*100)}%)</label>
  <input type="range" min="0" max="1" step="0.05" value="${a.volume||0.75}" oninput="psUpdateConfigProp('audio',Object.assign(PIXI_STUDIO_STATE.atual.config_json.audio||{},{volume:parseFloat(this.value)}))"
    style="width:100%">
</div></div>`;
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
      ${['spark','glow','smoke','ember','ring','streak','star','noise','rune','arrowhead'].map(t=>`<option value="${t}"${layer.texture===t?' selected':''}>${t}</option>`).join('')}
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
${spawnFields}`;
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

function _psAlphaCurveHtml(layer) {
  const list = layer.emitter?.alpha?.list || [{ value: 0.9, time: 0 }, { value: 0, time: 1 }];
  return `<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:6px">
<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;margin-bottom:6px">Curva Alpha</div>
${list.map((s, i) => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
  <span style="font-size:0.6rem;color:var(--suave);min-width:24px">${Math.round(s.time*100)}%</span>
  <input type="range" min="0" max="1" step="0.01" value="${s.value}"
    oninput="psUpdateAlphaStop('${layer.id}',${i},parseFloat(this.value))" style="flex:1">
  <span style="font-size:0.6rem;color:var(--suave);min-width:24px">${s.value.toFixed(2)}</span>
</div>`).join('')}</div>`;
}

function _psScaleCurveHtml(layer) {
  const list = layer.emitter?.scale?.list || [{ value: 0.4, time: 0 }, { value: 0.05, time: 1 }];
  return `<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:6px">
<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;margin-bottom:6px">Curva de Escala</div>
${list.map((s, i) => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
  <span style="font-size:0.6rem;color:var(--suave);min-width:24px">${Math.round(s.time*100)}%</span>
  <input type="range" min="0" max="3" step="0.01" value="${s.value}"
    oninput="psUpdateScaleStop('${layer.id}',${i},parseFloat(this.value))" style="flex:1">
  <span style="font-size:0.6rem;color:var(--suave);min-width:30px">${s.value.toFixed(2)}</span>
</div>`).join('')}</div>`;
}

function _psSpawnFieldsHtml(layer) {
  const e = layer.emitter || {};
  const spawnType = e.spawnType || 'circle';
  return `<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:6px">
<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;margin-bottom:8px">Spawn</div>
<div class="form-group" style="margin-bottom:6px"><label style="font-size:0.66rem">Tipo</label>
  <select onchange="psUpdateEmitterProp('${layer.id}','spawnType',this.value);_psRenderPropsPanel()"
    style="width:100%;padding:5px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
    ${['point','circle','ring','rect','burst'].map(t=>`<option value="${t}"${spawnType===t?' selected':''}>${t}</option>`).join('')}
  </select></div>
${spawnType==='circle'||spawnType==='ring' ? `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
  ${_psRangeHtml(layer.id,'Raio','emitter.spawnCircle.r',e.spawnCircle?.r||5,0,200,1,true)}
</div>` : ''}
${spawnType==='rect' ? `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
  ${_psRangeHtml(layer.id,'Largura','emitter.spawnRect.w',e.spawnRect?.w||40,1,400,1,true)}
  ${_psRangeHtml(layer.id,'Altura','emitter.spawnRect.h',e.spawnRect?.h||40,1,400,1,true)}
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
  <select onchange="psUpdateLayerProp('${layer.id}','shape_type',this.value)"
    style="width:100%;padding:5px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
    ${['circle','rect','polygon'].map(t=>`<option value="${t}"${layer.shape_type===t?' selected':''}>${t}</option>`).join('')}
  </select></div>` : `
<div class="form-group" style="margin-bottom:8px"><label style="font-size:0.66rem">Imagem (URL ou Upload)</label>
  <input type="text" value="${_esc(layer.texture_url||'')}" placeholder="https://..."
    oninput="psUpdateLayerProp('${layer.id}','texture_url',this.value)"
    style="width:100%;padding:4px 6px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
  <input type="file" accept="image/*" onchange="psUploadTexture('${layer.id}',this)" style="font-size:0.66rem;margin-top:4px;width:100%">
</div>`}
<div class="form-group" style="margin-bottom:8px"><label style="font-size:0.66rem">Blend Mode</label>
  <select onchange="psUpdateLayerProp('${layer.id}','blendMode',this.value)"
    style="width:100%;padding:5px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
    ${['add','normal','multiply','screen'].map(m=>`<option value="${m}"${layer.blendMode===m?' selected':''}>${m}</option>`).join('')}
  </select></div>
<div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:6px">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
  <div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase">Keyframes</div>
  <button onclick="psAddKeyframe('${layer.id}',0.5)" style="background:none;border:1px solid var(--borda);border-radius:3px;color:var(--suave);font-size:0.6rem;cursor:pointer;padding:1px 6px">+ KF</button>
</div>
${kfs.length ? `<table style="width:100%;border-collapse:collapse;font-size:0.67rem">
<thead><tr style="color:var(--suave)">${
  isShape
    ? '<th>t</th><th>Raio</th><th>Cor</th><th>α</th><th></th>'
    : '<th>t</th><th>x</th><th>y</th><th>sc</th><th>α</th><th></th>'
}</tr></thead><tbody>
${kfs.map((k,i)=>`<tr style="border-top:1px solid rgba(255,255,255,0.05)">${
  isShape
    ? `<td><input type="number" min="0" max="1" step="0.01" value="${k.t}" onchange="psUpdateKeyframe('${layer.id}',${i},{t:parseFloat(this.value)})" style="width:36px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>
       <td><input type="number" value="${k.radius||0}" onchange="psUpdateKeyframe('${layer.id}',${i},{radius:parseFloat(this.value)})" style="width:36px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>
       <td><input type="color" value="${k.stroke_color||'#ffffff'}" onchange="psUpdateKeyframe('${layer.id}',${i},{stroke_color:this.value})" style="width:28px;height:22px;padding:1px;background:none;border:1px solid var(--borda);border-radius:2px;cursor:pointer"></td>
       <td><input type="number" min="0" max="1" step="0.05" value="${k.stroke_alpha||1}" onchange="psUpdateKeyframe('${layer.id}',${i},{stroke_alpha:parseFloat(this.value)})" style="width:32px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>`
    : `<td><input type="number" min="0" max="1" step="0.01" value="${k.t}" onchange="psUpdateKeyframe('${layer.id}',${i},{t:parseFloat(this.value)})" style="width:36px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>
       <td><input type="number" value="${k.x||0}" onchange="psUpdateKeyframe('${layer.id}',${i},{x:parseFloat(this.value)})" style="width:32px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>
       <td><input type="number" value="${k.y||0}" onchange="psUpdateKeyframe('${layer.id}',${i},{y:parseFloat(this.value)})" style="width:32px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>
       <td><input type="number" min="0.01" max="10" step="0.1" value="${k.scale||1}" onchange="psUpdateKeyframe('${layer.id}',${i},{scale:parseFloat(this.value)})" style="width:32px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>
       <td><input type="number" min="0" max="1" step="0.05" value="${k.alpha||0}" onchange="psUpdateKeyframe('${layer.id}',${i},{alpha:parseFloat(this.value)})" style="width:32px;padding:2px;background:var(--painel);border:1px solid var(--borda);border-radius:2px;color:var(--texto);font-size:0.66rem;text-align:center"></td>`
}<td><button onclick="psRemoveKeyframe('${layer.id}',${i})" style="background:none;border:none;color:var(--perigo);cursor:pointer;font-size:0.7rem">✕</button></td></tr>`).join('')}
</tbody></table>` : '<div style="font-size:0.72rem;color:var(--suave);font-style:italic">Sem keyframes</div>'}
</div>`;
}

function _psBgPanelHtml(layer) {
  return `
<div style="font-family:var(--fonte-d);font-size:0.7rem;color:var(--destaque);margin-bottom:10px">▬ Fundo: ${_esc(layer.nome)}</div>
${_psLayerCommonHtml(layer)}
<div class="form-group" style="margin-bottom:8px"><label style="font-size:0.66rem">Tipo</label>
  <select onchange="psUpdateLayerProp('${layer.id}','bg_type',this.value)"
    style="width:100%;padding:5px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
    ${['solid','gradient','image'].map(t=>`<option value="${t}"${layer.bg_type===t?' selected':''}>${t}</option>`).join('')}
  </select></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
  <div class="form-group"><label style="font-size:0.66rem">Cor</label>
    <input type="color" value="${layer.bg_color||'#000000'}" oninput="psUpdateLayerProp('${layer.id}','bg_color',this.value)"
      style="width:100%;height:34px;padding:2px;background:none;border:1px solid var(--borda);border-radius:4px;cursor:pointer">
  </div>
  <div class="form-group"><label style="font-size:0.66rem">Alpha (${Math.round((layer.bg_alpha||0)*100)}%)</label>
    <input type="range" min="0" max="1" step="0.05" value="${layer.bg_alpha||0}"
      oninput="psUpdateLayerProp('${layer.id}','bg_alpha',parseFloat(this.value))" style="width:100%">
  </div>
</div>
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

// ══ E — PREVIEW ENGINE ════════════════════════════════════════════════════════

async function psPreviewMount() {
  const canvas = document.getElementById('ps-preview-canvas');
  if (!canvas) return;
  psPreviewUnmount();
  if (typeof _avtEnsurePixiParticles !== 'function') return;
  await _avtEnsurePixiParticles().catch(() => {});
  if (typeof PIXI === 'undefined') return;
  try {
    const app = new PIXI.Application({
      view: canvas, width: canvas.width, height: canvas.height,
      backgroundAlpha: 1, backgroundColor: 0x060a10, antialias: false,
    });
    PIXI_STUDIO_STATE.previewApp = app;
    const worldRoot = new PIXI.Container();
    app.stage.addChild(worldRoot);
    PIXI_STUDIO_STATE._worldRoot = worldRoot;
    psPreviewRebuildAll();
  } catch (e) { console.warn('[pixi-studio] preview mount failed', e); }
}

function psPreviewUnmount() {
  psPreviewStop();
  _psDestroyAllEmitters();
  if (PIXI_STUDIO_STATE.previewApp) {
    try { PIXI_STUDIO_STATE.previewApp.destroy(false, { children: true, texture: false }); } catch (_) {}
    PIXI_STUDIO_STATE.previewApp = null;
    PIXI_STUDIO_STATE._worldRoot = null;
  }
}

function psPreviewPlay() {
  if (!PIXI_STUDIO_STATE.previewApp) psPreviewMount().then(_startPlay);
  else _startPlay();
  function _startPlay() {
    PIXI_STUDIO_STATE.previewTime = 0;
    PIXI_STUDIO_STATE.previewPlaying = true;
    PIXI_STUDIO_STATE._lastTs = 0;
    psPreviewRebuildAll();
    cancelAnimationFrame(PIXI_STUDIO_STATE._rafId);
    PIXI_STUDIO_STATE._rafId = requestAnimationFrame(_psPreviewTick);
    const loopBtn = document.getElementById('ps-loop-btn');
    if (loopBtn) loopBtn.style.color = PIXI_STUDIO_STATE.previewLooping ? 'var(--primario)' : 'var(--suave)';
  }
}

function psPreviewPause() {
  PIXI_STUDIO_STATE.previewPlaying = false;
  cancelAnimationFrame(PIXI_STUDIO_STATE._rafId);
}

function psPreviewStop() {
  PIXI_STUDIO_STATE.previewPlaying = false;
  PIXI_STUDIO_STATE.previewTime = 0;
  cancelAnimationFrame(PIXI_STUDIO_STATE._rafId);
  _psUpdateTimeDisplay(0);
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
  if (!PIXI_STUDIO_STATE.previewPlaying) return;
  const last = PIXI_STUDIO_STATE._lastTs || ts;
  PIXI_STUDIO_STATE._lastTs = ts;
  const delta = Math.min(ts - last, 100);
  const dur = PIXI_STUDIO_STATE.atual?.config_json?.duracao_ms || 1000;
  PIXI_STUDIO_STATE.previewTime += delta;
  const t = Math.min(1, PIXI_STUDIO_STATE.previewTime / dur);

  // Update emitters
  for (const [, em] of PIXI_STUDIO_STATE._emitterMap) {
    if (em && !em.destroyed) em.update(delta / 1000);
  }
  // Update sprites / shapes
  _psPreviewRenderFrame(t);

  _psUpdateTimeDisplay(t, dur);

  if (t >= 1) {
    if (PIXI_STUDIO_STATE.previewLooping) {
      PIXI_STUDIO_STATE.previewTime = 0;
      psPreviewRebuildAll();
    } else {
      PIXI_STUDIO_STATE.previewPlaying = false;
      return;
    }
  }
  PIXI_STUDIO_STATE._rafId = requestAnimationFrame(_psPreviewTick);
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

  for (const layer of layers) {
    if (!layer.visivel) continue;

    if (layer.tipo === 'sprite') {
      const sp = PIXI_STUDIO_STATE._spriteMap.get(layer.id);
      if (!sp) continue;
      const kf = _psInterpKf(layer.keyframes, t);
      if (kf) { sp.x = kf.x ?? 0; sp.y = kf.y ?? 0; sp.scale.set(kf.scale ?? 1); sp.alpha = kf.alpha ?? 1; sp.rotation = (kf.rotation ?? 0) * Math.PI / 180; }
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
        if (fa > 0) g.endFill();
      }
    }
  }
}

function _psInterpKf(keyframes, t) {
  if (!keyframes || !keyframes.length) return null;
  const sorted = [...keyframes].sort((a, b) => a.t - b.t);
  if (t <= sorted[0].t) return sorted[0];
  if (t >= sorted[sorted.length - 1].t) return sorted[sorted.length - 1];
  let lo = sorted[0], hi = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (t >= sorted[i].t && t <= sorted[i + 1].t) { lo = sorted[i]; hi = sorted[i + 1]; break; }
  }
  const f = (t - lo.t) / (hi.t - lo.t);
  const lerp = (a, b) => typeof a === 'number' && typeof b === 'number' ? a + (b - a) * f : a;
  const result = {};
  const keys = new Set([...Object.keys(lo), ...Object.keys(hi)]);
  keys.forEach(k => { if (k !== 't') result[k] = lerp(lo[k], hi[k]); });
  return result;
}

function psPreviewRebuildAll() {
  _psDestroyAllEmitters();
  const app = PIXI_STUDIO_STATE.previewApp;
  const worldRoot = PIXI_STUDIO_STATE._worldRoot;
  if (!app || !worldRoot || typeof PIXI === 'undefined') return;
  worldRoot.removeChildren();
  PIXI_STUDIO_STATE._spriteMap.clear();
  PIXI_STUDIO_STATE._shapeMap.clear();
  PIXI_STUDIO_STATE._bgSprite = null;

  const cfg = PIXI_STUDIO_STATE.atual?.config_json;
  if (!cfg) return;
  const cx = app.renderer.width / 2, cy = app.renderer.height / 2;
  const bm = { add: PIXI.BLEND_MODES.ADD, normal: PIXI.BLEND_MODES.NORMAL, screen: PIXI.BLEND_MODES.SCREEN, multiply: PIXI.BLEND_MODES.MULTIPLY };
  const sorted = [...(cfg.layers || [])].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));

  for (const layer of sorted) {
    if (!layer.visivel) continue;
    const container = new PIXI.Container();
    container.position.set(cx, cy);
    container.blendMode = bm[layer.blendMode] ?? PIXI.BLEND_MODES.ADD;
    worldRoot.addChild(container);

    if (layer.tipo === 'emitter' && layer.emitter) {
      _psCreateEmitter(layer, container, 0, 0);
    } else if (layer.tipo === 'sprite') {
      const texUrl = layer.texture_url;
      const tex = texUrl ? PIXI.Texture.from(texUrl) : PIXI.Texture.WHITE;
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.blendMode = bm[layer.blendMode] ?? PIXI.BLEND_MODES.ADD;
      container.addChild(sp);
      PIXI_STUDIO_STATE._spriteMap.set(layer.id, sp);
    } else if (layer.tipo === 'shape') {
      const g = new PIXI.Graphics();
      container.addChild(g);
      PIXI_STUDIO_STATE._shapeMap.set(layer.id, g);
    } else if (layer.tipo === 'background') {
      const g = new PIXI.Graphics();
      g.position.set(-cx, -cy);
      const color = parseInt((layer.bg_color || '#000000').replace('#', ''), 16);
      g.beginFill(color, layer.bg_alpha || 0).drawRect(0, 0, app.renderer.width, app.renderer.height).endFill();
      container.addChildAt(g, 0);
      PIXI_STUDIO_STATE._bgSprite = g;
    }
  }
}

function _psCreateEmitter(layer, container, x, y) {
  if (!PIXI.particles?.Emitter) return;
  let cfg = JSON.parse(JSON.stringify(layer.emitter));
  const tex = layer.texture_url ? PIXI.Texture.from(layer.texture_url) : _avtProcTextures(layer.texture || 'spark');
  const texArr = [tex || PIXI.Texture.WHITE];
  if (PIXI.particles.upgradeConfig && !Array.isArray(cfg.behaviors)) {
    try { cfg = PIXI.particles.upgradeConfig(cfg, texArr); } catch (_) {}
  }
  try {
    const em = new PIXI.particles.Emitter(container, cfg);
    em.updateSpawnPos(x, y);
    em.emit = true;
    PIXI_STUDIO_STATE._emitterMap.set(layer.id, em);
    if (PIXI_STUDIO_STATE.previewApp) {
      PIXI_STUDIO_STATE.previewApp.ticker.add((delta) => {
        if (!em.destroyed) em.update(PIXI_STUDIO_STATE.previewApp.ticker.elapsedMS / 1000);
      });
    }
  } catch (e) { console.warn('[pixi-studio] emitter create failed', e); }
}

function psPreviewSyncEmitter(layerId) {
  const em = PIXI_STUDIO_STATE._emitterMap.get(layerId);
  if (em && !em.destroyed) { try { em.destroy(); } catch (_) {} }
  PIXI_STUDIO_STATE._emitterMap.delete(layerId);
  const layer = _psGetLayer(layerId);
  if (!layer || !layer.emitter || !PIXI_STUDIO_STATE._worldRoot) return;
  const app = PIXI_STUDIO_STATE.previewApp;
  if (!app) return;
  const container = new PIXI.Container();
  container.position.set(app.renderer.width / 2, app.renderer.height / 2);
  PIXI_STUDIO_STATE._worldRoot.addChild(container);
  _psCreateEmitter(layer, container, 0, 0);
}

function _psDestroyAllEmitters() {
  for (const [, em] of PIXI_STUDIO_STATE._emitterMap) {
    try { if (!em.destroyed) em.destroy(); } catch (_) {}
  }
  PIXI_STUDIO_STATE._emitterMap.clear();
  cancelAnimationFrame(PIXI_STUDIO_STATE._rafId);
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
  const kfDiamonds = (l.keyframes||[]).map((k,i) =>
    `<div title="t=${k.t}" style="position:absolute;left:${k.t*100}%;top:50%;width:8px;height:8px;
      background:${tipoColor[l.tipo]||'#fff'};transform:translate(-50%,-50%) rotate(45deg);cursor:ew-resize;z-index:2"
      onmousedown="event.stopPropagation();psTimelineKfDragStart('${l.id}',${i},event)"></div>`).join('');
  return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
    <div style="min-width:70px;font-size:0.62rem;color:var(--suave);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.nome}</div>
    <div style="flex:1;position:relative;height:16px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:visible">
      <div style="position:absolute;inset:0;background:${tipoColor[l.tipo]||'#444'};opacity:0.35;border-radius:3px"></div>
      ${kfDiamonds}
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
    style="width:100%;padding:4px 6px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.78rem;text-align:center"></div>` : ''}
${isChain ? `<div style="font-size:0.68rem;color:var(--suave)">Configure a sequência na propriedade behavior_config.sequence</div>` : ''}
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
  PIXI_STUDIO_STATE.layerSel = null;
  _psSetDirty(true);
  psPreviewStop();
  psPreviewMount();
  _psRenderLayerList();
  _psRenderBehaviorPanel();
  _psRenderPropsPanel();
  psTimelineRender();
  psPreviewRebuildAll();
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
    // Full Studio config — use directly
    config = parsed;
  } else {
    // Assume raw pixi-particle-emitter config → wrap as single emitter layer
    config = _psDefaultConfig();
    config.layers[0].emitter = parsed;
    config.layers[0].nome = 'Importado';
  }
  // Ensure all layers have IDs
  (config.layers || []).forEach((l, i) => { if (!l.id) l.id = 'l_' + Date.now() + '_' + i; });

  if (!PIXI_STUDIO_STATE.atual) psNova();
  const cur = PIXI_STUDIO_STATE.atual;
  cur.config_json = config;
  cur.behavior = config.behavior || 'one-shot';
  cur.duracao_ms = config.duracao_ms || 1000;
  PIXI_STUDIO_STATE.layerSel = null;
  _psSetDirty(true);
  psPreviewStop();
  psPreviewMount();
  _psRenderLayerList();
  _psRenderBehaviorPanel();
  _psRenderPropsPanel();
  psTimelineRender();
  psPreviewRebuildAll();
  document.getElementById('ps-import-modal').style.display = 'none';
  mostrarToast('JSON importado com sucesso!', 'sucesso');
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
