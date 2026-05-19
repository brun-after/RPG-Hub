// js/systems/aventura.js
// Aventura mode — solo/small-group top-down dungeon, tactical-pause combat
// rpg_registry { is_aventura: true } + characters + skills (same tables as campaigns)

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

var AVT_STATE = {
  rpgId: null,
  rpg: null,
  chars: [],
  skills: [],
  dungeon: null,      // { tiles[][], w, h, rooms[] }
  entidades: [],      // [{ id, nome, x, y, hp, hpMax, tipo, cor, atribs }]
  batalha: {
    ativa: false,
    iniciativa: [],   // sorted [{id, nome, tipo, cor}]
    turnoIdx: 0,
    log: [],
    moverModo: false
  },
  canvas: null,
  ctx: null,
  camera: { x: 0, y: 0 },
  animFrame: null,
  _criando: { nome: '', cor: '#c8a84b', cor2: '#4fa3d1', icone: 'sword',
               personagens: [], importCampanhaId: null }
};

const AVT_T = { PAREDE: 0, PISO: 1, PORTA: 2 };
const AVT_SZ = 48; // tile size in px

// ─────────────────────────────────────────────────────────────────────────────
// DB HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function _avtSb(path, opts) { return sb(path, opts); }

async function aventuraCarregarLista() {
  try {
    const all = await _avtSb('rpg_registry?select=*&order=name');
    if (!all) return [];
    return all.filter(r => r.is_aventura === true || r.theme_json?.is_aventura === true);
  } catch(e) { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// HUB — render aventura cards
// ─────────────────────────────────────────────────────────────────────────────

async function avtHubRenderSection() {
  const wrap = document.getElementById('avt-hub-section');
  if (!wrap) return;
  const lista = document.getElementById('avt-hub-lista');
  if (!lista) return;

  lista.innerHTML = '<div style="color:#7a92aa;font-size:0.75rem;padding:8px 0">Carregando…</div>';

  const aventuras = await aventuraCarregarLista();
  if (!aventuras.length) {
    lista.innerHTML = '<div style="color:#7a92aa;font-size:0.75rem;padding:8px 0;font-style:italic">Nenhuma aventura ainda.</div>';
    return;
  }

  lista.innerHTML = aventuras.map(r => {
    const t = r.theme_json || {};
    const cor = t.destaque || '#c8a84b';
    const rid = r.rpg_id.replace(/'/g, "\\'");
    return `<div class="avt-card" onclick="entrarAventura('${rid}')" style="--avt-acc:${cor}">
      <div class="avt-card-ico">${_avtIcnSvg(cor)}</div>
      <div class="avt-card-info">
        <div class="avt-card-nome" style="color:${cor}">${r.name}</div>
        <div class="avt-card-sub">Aventura solo</div>
      </div>
      <div class="avt-card-arr">→</div>
    </div>`;
  }).join('');
}

function _avtIcnSvg(cor) {
  return `<svg width="26" height="26" viewBox="0 0 26 26" fill="none">
    <path d="M13 3 L21 7 L21 19 L13 23 L5 19 L5 7Z" stroke="${cor}" stroke-width="1.2" fill="none"/>
    <path d="M9 13 L17 13 M13 9 L13 17" stroke="${cor}" stroke-width="1.5"/>
  </svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRIAR AVENTURA — simplified 2-step wizard
// ─────────────────────────────────────────────────────────────────────────────

function abrirCriarAventura() {
  AVT_STATE._criando = { nome: '', cor: '#c8a84b', cor2: '#4fa3d1', icone: 'sword',
                          personagens: [{ nome: '', hp_max: 60, cor: '#4fa3d1' }],
                          importCampanhaId: null, etapa: 0 };
  document.getElementById('hub').style.display = 'none';
  document.getElementById('aventura-criar-screen').style.display = 'flex';
  _avtCriarRenderEtapa();
}

function fecharCriarAventura() {
  document.getElementById('aventura-criar-screen').style.display = 'none';
  document.getElementById('hub').style.display = 'block';
}

function _avtCriarRenderEtapa() {
  const c = AVT_STATE._criando;
  const body = document.getElementById('avt-criar-body');
  if (!body) return;
  const dots = document.getElementById('avt-criar-dots');
  if (dots) dots.innerHTML = [0,1].map(i =>
    `<div class="criar-step-dot ${i===c.etapa?'ativo':i<c.etapa?'feito':''}"></div>`
  ).join('');
  const btnNext = document.getElementById('avt-criar-btn-next');
  const btnPrev = document.getElementById('avt-criar-btn-prev');
  if (btnPrev) btnPrev.style.display = c.etapa > 0 ? '' : 'none';
  if (btnNext) {
    btnNext.textContent = c.etapa === 1 ? '▶ Iniciar Aventura!' : 'Próximo →';
    btnNext.onclick = c.etapa === 1 ? aventuraCriarSubmit : _avtCriarAvancar;
  }

  if (c.etapa === 0) _avtCriarRenderIdentidade(body);
  else _avtCriarRenderPersonagens(body);
}

function _avtCriarRenderIdentidade(body) {
  const c = AVT_STATE._criando;
  body.innerHTML = `
    <div class="etapa-titulo">Identidade da Aventura</div>
    <div class="etapa-desc">Nome e visual para sua aventura.</div>
    <div class="criar-field">
      <label>Nome *</label>
      <input class="criar-input" id="avt-c-nome" value="${c.nome}" placeholder="Ex: A Cripta Esquecida" maxlength="60">
    </div>
    <div class="criar-field">
      <label>Cor principal</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${['#c8a84b','#4fa3d1','#7b2fbe','#27ae60','#e8604c','#e67e22'].map(cor =>
          `<div onclick="avtCriarSetCor('${cor}')" style="width:28px;height:28px;border-radius:50%;background:${cor};cursor:pointer;border:2px solid ${c.cor===cor?'#fff':'transparent'}" data-cor="${cor}"></div>`
        ).join('')}
        <input type="color" value="${c.cor}" oninput="avtCriarSetCor(this.value)" style="width:28px;height:28px;border-radius:50%;border:none;padding:0;cursor:pointer;background:none">
      </div>
    </div>`;
}

function _avtCriarRenderPersonagens(body) {
  const c = AVT_STATE._criando;
  const campanhas = (HUB_DATA?.rpgs || [])
    .filter(r => !r.is_arena && !r.is_aventura && !(r.theme_json?.is_aventura));
  body.innerHTML = `
    <div class="etapa-titulo">Personagens</div>
    <div class="etapa-desc">Adicione seus heróis. Ou importe de uma campanha existente.</div>
    ${campanhas.length ? `
    <div class="criar-field" style="margin-bottom:16px">
      <label>Importar de campanha (opcional)</label>
      <select id="avt-import-camp" onchange="avtCriarImportCampanha(this.value)" style="width:100%;padding:8px;background:#0a0f18;border:1px solid var(--borda);border-radius:6px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.8rem">
        <option value="">— Criar do zero —</option>
        ${campanhas.map(r => `<option value="${r.rpg_id}" ${c.importCampanhaId===r.rpg_id?'selected':''}>${r.name}</option>`).join('')}
      </select>
    </div>` : ''}
    <div id="avt-chars-lista">${_avtCriarRenderCharsLista()}</div>
    <button onclick="avtCriarAddChar()" style="margin-top:8px;padding:6px 14px;border-radius:6px;border:1px dashed rgba(255,255,255,0.2);background:transparent;color:#7a92aa;cursor:pointer;font-size:0.78rem">+ Adicionar personagem</button>`;
}

function _avtCriarRenderCharsLista() {
  return AVT_STATE._criando.personagens.map((p, i) => `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.08)">
      <div style="width:10px;height:10px;border-radius:50%;background:${p.cor||'#4fa3d1'};flex-shrink:0"></div>
      <input style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:5px;color:#fff;padding:5px 8px;font-size:0.82rem;font-family:inherit"
        placeholder="Nome do personagem" value="${p.nome}"
        oninput="AVT_STATE._criando.personagens[${i}].nome=this.value">
      <input type="number" min="10" max="999" value="${p.hp_max}"
        style="width:60px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:5px;color:#fff;padding:5px 8px;font-size:0.82rem;text-align:center"
        title="HP máx" oninput="AVT_STATE._criando.personagens[${i}].hp_max=+this.value||60">
      <span style="font-size:0.65rem;color:#7a92aa">HP</span>
      ${i > 0 ? `<button onclick="avtCriarRemChar(${i})" style="background:none;border:none;color:#7a92aa;cursor:pointer;font-size:0.9rem;padding:2px 4px">✕</button>` : ''}
    </div>`).join('');
}

function avtCriarSetCor(cor) {
  AVT_STATE._criando.cor = cor;
  _avtCriarRenderEtapa();
}

function avtCriarAddChar() {
  AVT_STATE._criando.personagens.push({ nome: '', hp_max: 60, cor: '#4fa3d1' });
  const lista = document.getElementById('avt-chars-lista');
  if (lista) lista.innerHTML = _avtCriarRenderCharsLista();
}

function avtCriarRemChar(i) {
  AVT_STATE._criando.personagens.splice(i, 1);
  const lista = document.getElementById('avt-chars-lista');
  if (lista) lista.innerHTML = _avtCriarRenderCharsLista();
}

async function avtCriarImportCampanha(campId) {
  AVT_STATE._criando.importCampanhaId = campId || null;
  if (!campId) {
    AVT_STATE._criando.personagens = [{ nome: '', hp_max: 60, cor: '#4fa3d1' }];
    const lista = document.getElementById('avt-chars-lista');
    if (lista) lista.innerHTML = _avtCriarRenderCharsLista();
    return;
  }
  try {
    const chars = await _avtSb(`characters?rpg_id=eq.${encodeURIComponent(campId)}&select=nome,hp_max,custom_attrs&order=nome`);
    if (chars && chars.length) {
      const cores = ['#4fa3d1','#27ae60','#c8a84b','#7b2fbe','#e8604c'];
      AVT_STATE._criando.personagens = chars
        .filter(c => c.custom_attrs?.tipo_personagem !== 'npc')
        .map((c, i) => ({ nome: c.nome, hp_max: c.hp_max || 60, cor: cores[i % cores.length], importadoDe: campId }));
      if (!AVT_STATE._criando.personagens.length)
        AVT_STATE._criando.personagens = [{ nome: '', hp_max: 60, cor: '#4fa3d1' }];
      const lista = document.getElementById('avt-chars-lista');
      if (lista) lista.innerHTML = _avtCriarRenderCharsLista();
      mostrarToast(`${chars.length} personagens importados`, 'ok');
    }
  } catch(e) { mostrarToast('Erro ao importar personagens', 'erro'); }
}

function _avtCriarVoltar() {
  const c = AVT_STATE._criando;
  if (c.etapa > 0) { c.etapa--; _avtCriarRenderEtapa(); }
}

function _avtCriarAvancar() {
  const c = AVT_STATE._criando;
  if (c.etapa === 0) {
    c.nome = document.getElementById('avt-c-nome')?.value?.trim() || c.nome;
    if (!c.nome) { mostrarToast('Nome é obrigatório', 'aviso'); return; }
  }
  c.etapa++;
  _avtCriarRenderEtapa();
}

async function aventuraCriarSubmit() {
  const c = AVT_STATE._criando;
  c.nome = document.getElementById('avt-c-nome')?.value?.trim() || c.nome;
  const chars = c.personagens.filter(p => p.nome.trim());
  if (!c.nome) { mostrarToast('Nome é obrigatório', 'aviso'); return; }
  if (!chars.length) { mostrarToast('Adicione ao menos 1 personagem', 'aviso'); return; }

  const btn = document.getElementById('avt-criar-btn-next');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Criando…'; }

  try {
    const rpgId = c.nome.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,30)
                  + '_avt_' + Date.now().toString(36);
    const themeJson = { destaque: c.cor, primario: c.cor2, animation: c.icone, is_aventura: true };

    // Insert rpg_registry — try with is_aventura column, fallback without
    let regBody = { rpg_id: rpgId, name: c.nome, owner_id: SESSION?.user?.id || null, theme_json: themeJson };
    try {
      await _avtSb('rpg_registry', { method: 'POST', body: JSON.stringify({ ...regBody, is_aventura: true }) });
    } catch(e) {
      // Column may not exist — insert without it (is_aventura tracked via theme_json)
      await _avtSb('rpg_registry', { method: 'POST', body: JSON.stringify(regBody) });
    }

    // Link owner as mestre
    if (SESSION?.user?.id) {
      await _avtSb('rpg_members', { method: 'POST', body: JSON.stringify({
        rpg_id: rpgId, player_id: SESSION.user.id,
        nickname: SESSION.nickname || SESSION.user.email || 'aventureiro',
        role: 'mestre', permissoes: {}
      })});
    }

    // Insert characters
    const cores = ['#4fa3d1','#27ae60','#c8a84b','#7b2fbe','#e8604c'];
    for (let i = 0; i < chars.length; i++) {
      const p = chars[i];
      await _avtSb('characters', { method: 'POST', body: JSON.stringify({
        rpg_id: rpgId, nome: p.nome.trim(), hp_max: p.hp_max || 60, hp_atual: p.hp_max || 60,
        xp: 0, nivel: 1, custom_attrs: { cor: p.cor || cores[i % cores.length], tipo_personagem: 'jogador' }
      })});
    }

    mostrarToast(`✦ "${c.nome}" criada!`, 'sucesso');
    HUB_DATA.rpgs = await getAllRPGs() || [];
    renderRPGList(HUB_DATA.rpgs);
    await avtHubRenderSection();

    fecharCriarAventura();
    setTimeout(() => entrarAventura(rpgId), 400);
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = '▶ Iniciar Aventura!'; }
    mostrarToast('Erro: ' + (e?.message || e), 'erro');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRAR / SAIR
// ─────────────────────────────────────────────────────────────────────────────

async function entrarAventura(rpgId) {
  mostrarLoading('Carregando aventura…');
  try {
    // Load data
    const [rpgs, chars, skills] = await Promise.all([
      _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(rpgId)}&select=*`),
      _avtSb(`characters?rpg_id=eq.${encodeURIComponent(rpgId)}&select=*&order=nome`),
      _avtSb(`skills?rpg_id=eq.${encodeURIComponent(rpgId)}&select=*`)
    ]);

    AVT_STATE.rpgId = rpgId;
    AVT_STATE.rpg = rpgs?.[0] || { rpg_id: rpgId, name: 'Aventura' };
    AVT_STATE.chars = chars || [];
    AVT_STATE.skills = skills || [];

    // Hide hub, show aventura screen
    document.getElementById('hub').style.display = 'none';
    const screen = document.getElementById('aventura-screen');
    screen.style.display = 'flex';

    // Update header
    const t = AVT_STATE.rpg.theme_json || {};
    document.getElementById('avt-nome').textContent = AVT_STATE.rpg.name;
    document.getElementById('avt-nome').style.color = t.destaque || '#c8a84b';

    // Generate dungeon
    AVT_STATE.dungeon = _avtGerarDungeon(22, 16);
    _avtPopularEntidades();

    // Start rendering
    _avtCanvasInit();
    _avtRenderLoop();
    _avtRenderHpBar();
    ocultarLoading();

    salvarNav('rpg', rpgId);
  } catch(e) {
    ocultarLoading();
    mostrarToast('Erro ao carregar aventura: ' + (e?.message || e), 'erro');
  }
}

function sairAventura() {
  if (AVT_STATE.animFrame) { cancelAnimationFrame(AVT_STATE.animFrame); AVT_STATE.animFrame = null; }
  document.getElementById('aventura-screen').style.display = 'none';
  document.getElementById('hub').style.display = 'block';
  avtHubRenderSection();
  AVT_STATE.rpgId = null;
  AVT_STATE.batalha.ativa = false;
}

// ─────────────────────────────────────────────────────────────────────────────
// DUNGEON GENERATION
// ─────────────────────────────────────────────────────────────────────────────

function _avtGerarDungeon(w, h) {
  const tiles = Array.from({length: h}, () => Array(w).fill(AVT_T.PAREDE));
  const rooms = [];

  const _carveRoom = (rx, ry, rw, rh) => {
    for (let y = ry; y < ry + rh; y++)
      for (let x = rx; x < rx + rw; x++)
        if (y > 0 && y < h-1 && x > 0 && x < w-1) tiles[y][x] = AVT_T.PISO;
  };

  const _overlaps = (rx, ry, rw, rh) =>
    rooms.some(r => rx < r.x+r.w+1 && rx+rw+1 > r.x && ry < r.y+r.h+1 && ry+rh+1 > r.y);

  for (let attempt = 0; attempt < 50 && rooms.length < 5; attempt++) {
    const rw = 4 + Math.floor(Math.random() * 5);
    const rh = 3 + Math.floor(Math.random() * 4);
    const rx = 1 + Math.floor(Math.random() * (w - rw - 2));
    const ry = 1 + Math.floor(Math.random() * (h - rh - 2));
    if (_overlaps(rx, ry, rw, rh)) continue;
    _carveRoom(rx, ry, rw, rh);
    rooms.push({ x: rx, y: ry, w: rw, h: rh,
                 cx: Math.floor(rx + rw/2), cy: Math.floor(ry + rh/2) });
  }

  // Connect rooms with L-shaped corridors
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i-1], b = rooms[i];
    // horizontal leg
    for (let x = Math.min(a.cx, b.cx); x <= Math.max(a.cx, b.cx); x++)
      if (tiles[a.cy]?.[x] !== undefined) tiles[a.cy][x] = AVT_T.PISO;
    // vertical leg
    for (let y = Math.min(a.cy, b.cy); y <= Math.max(a.cy, b.cy); y++)
      if (tiles[y]?.[b.cx] !== undefined) tiles[y][b.cx] = AVT_T.PISO;
  }

  return { tiles, w, h, rooms };
}

function _avtPopularEntidades() {
  const d = AVT_STATE.dungeon;
  AVT_STATE.entidades = [];

  if (!d.rooms.length) return;

  // Place player characters in first room
  const primRoom = d.rooms[0];
  const cores = ['#4fa3d1','#27ae60','#c8a84b','#7b2fbe','#e8604c'];
  AVT_STATE.chars.filter(c => c.custom_attrs?.tipo_personagem !== 'npc').forEach((c, i) => {
    const col = c.custom_attrs?.cor || cores[i % cores.length];
    AVT_STATE.entidades.push({
      id: c.id || c.nome, nome: c.nome, tipo: 'jogador',
      x: primRoom.x + 1 + (i % 3), y: primRoom.y + 1 + Math.floor(i / 3),
      hp: c.hp_atual || c.hp_max || 60, hpMax: c.hp_max || 60, cor: col,
      dbId: c.id
    });
  });

  // Place enemies in other rooms
  const inimigos = [
    { nome: 'Goblin', hp: 18, cor: '#7a5c00', tipo: 'inimigo' },
    { nome: 'Goblin Guerreiro', hp: 24, cor: '#5a4200', tipo: 'inimigo' },
    { nome: 'Esqueleto', hp: 20, cor: '#888', tipo: 'inimigo' },
    { nome: 'Orc', hp: 35, cor: '#3a5c30', tipo: 'inimigo' },
    { nome: 'Arainha', hp: 15, cor: '#4a003c', tipo: 'inimigo' }
  ];
  let uid = 0;
  for (let i = 1; i < d.rooms.length; i++) {
    const r = d.rooms[i];
    const count = 1 + Math.floor(Math.random() * 2);
    for (let j = 0; j < count; j++) {
      const tmpl = inimigos[Math.floor(Math.random() * inimigos.length)];
      AVT_STATE.entidades.push({
        id: 'inimigo_' + uid++, nome: tmpl.nome, tipo: 'inimigo',
        x: r.x + 1 + (j % (r.w - 2)), y: r.y + 1 + Math.floor(j / (r.w - 2)),
        hp: tmpl.hp, hpMax: tmpl.hp, cor: tmpl.cor
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS RENDERING
// ─────────────────────────────────────────────────────────────────────────────

function _avtCanvasInit() {
  const wrap = document.getElementById('avt-mapa-wrap');
  if (!wrap) return;
  let canvas = document.getElementById('avt-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'avt-canvas';
    canvas.style.cssText = 'display:block;cursor:pointer;image-rendering:pixelated';
    wrap.innerHTML = '';
    wrap.appendChild(canvas);
  }
  AVT_STATE.canvas = canvas;
  AVT_STATE.ctx = canvas.getContext('2d');
  _avtCanvasResize();
  canvas.onclick = _avtCanvasClick;
  window.addEventListener('resize', _avtCanvasResize);
  window.addEventListener('keydown', _avtCanvasKey);
  _avtCameraCenter();
}

function _avtCanvasResize() {
  const wrap = document.getElementById('avt-mapa-wrap');
  const canvas = AVT_STATE.canvas;
  if (!wrap || !canvas) return;
  canvas.width = wrap.clientWidth || 400;
  canvas.height = wrap.clientHeight || 300;
}

function _avtCameraCenter() {
  const jogador = AVT_STATE.entidades.find(e => e.tipo === 'jogador');
  if (!jogador || !AVT_STATE.canvas) return;
  AVT_STATE.camera.x = jogador.x * AVT_SZ - AVT_STATE.canvas.width/2 + AVT_SZ/2;
  AVT_STATE.camera.y = jogador.y * AVT_SZ - AVT_STATE.canvas.height/2 + AVT_SZ/2;
}

function _avtRenderLoop() {
  if (AVT_STATE.animFrame) cancelAnimationFrame(AVT_STATE.animFrame);
  const frame = () => {
    _avtRenderFrame();
    AVT_STATE.animFrame = requestAnimationFrame(frame);
  };
  AVT_STATE.animFrame = requestAnimationFrame(frame);
}

function _avtRenderFrame() {
  const { canvas, ctx, dungeon, entidades, camera, batalha } = AVT_STATE;
  if (!ctx || !dungeon) return;
  const SZ = AVT_SZ;

  ctx.fillStyle = '#050810';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Tiles
  for (let y = 0; y < dungeon.h; y++) {
    for (let x = 0; x < dungeon.w; x++) {
      const t = dungeon.tiles[y][x];
      const px = Math.round(x * SZ - camera.x);
      const py = Math.round(y * SZ - camera.y);
      if (px + SZ < 0 || px > canvas.width || py + SZ < 0 || py > canvas.height) continue;
      if (t === AVT_T.PISO) {
        ctx.fillStyle = '#101520';
        ctx.fillRect(px, py, SZ, SZ);
        ctx.strokeStyle = 'rgba(79,163,209,0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, SZ - 1, SZ - 1);
      } else {
        ctx.fillStyle = '#0a0c14';
        ctx.fillRect(px, py, SZ, SZ);
        // Wall shading top/left edges
        ctx.fillStyle = 'rgba(79,163,209,0.04)';
        ctx.fillRect(px, py, SZ, 3);
        ctx.fillRect(px, py, 3, SZ);
      }
    }
  }

  // Move mode: highlight reachable tiles
  if (batalha.ativa && batalha.moverModo) {
    const ativo = _avtAtivo();
    if (ativo) {
      const vel = 3;
      const reachable = _avtBFS(ativo.x, ativo.y, vel);
      reachable.forEach(pos => {
        const px = Math.round(pos.x * SZ - camera.x);
        const py = Math.round(pos.y * SZ - camera.y);
        ctx.fillStyle = 'rgba(79,163,209,0.22)';
        ctx.fillRect(px, py, SZ, SZ);
      });
    }
  }

  // Entities
  entidades.forEach(e => {
    const px = Math.round(e.x * SZ - camera.x);
    const py = Math.round(e.y * SZ - camera.y);
    if (px + SZ < 0 || px > canvas.width || py + SZ < 0 || py > canvas.height) return;

    const cx = px + SZ/2, cy = py + SZ/2;
    const r = Math.floor(SZ * 0.36);

    // Shadow
    ctx.beginPath();
    ctx.ellipse(cx, cy + r + 2, r - 2, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();

    // Body circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = e.cor;
    ctx.fill();

    // HP ring
    const hpPct = e.hp / e.hpMax;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, -Math.PI/2, -Math.PI/2 + Math.PI*2*hpPct);
    ctx.strokeStyle = hpPct > 0.5 ? '#27ae60' : hpPct > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Rim
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = e.tipo === 'inimigo' ? 'rgba(232,96,76,0.6)' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Active turn indicator
    if (batalha.ativa) {
      const ativo = batalha.iniciativa[batalha.turnoIdx];
      if (ativo && ativo.id === e.id) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(200,168,75,0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Initial letter
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(SZ*0.28)}px Cinzel,serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.nome[0]?.toUpperCase() || '?', cx, cy);

    // HP number below
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `${Math.floor(SZ*0.21)}px monospace`;
    ctx.fillText(`${e.hp}`, cx, cy + r + 9);
  });
}

// BFS for movement range
function _avtBFS(startX, startY, range) {
  const visited = new Map();
  const queue = [{x:startX, y:startY, dist:0}];
  visited.set(`${startX},${startY}`, true);
  const result = [];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.dist > 0) result.push({x:cur.x, y:cur.y});
    if (cur.dist >= range) continue;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
      const nx = cur.x+dx, ny = cur.y+dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) return;
      if (AVT_STATE.dungeon.tiles[ny]?.[nx] !== AVT_T.PISO) return;
      if (AVT_STATE.entidades.some(e => e.x===nx && e.y===ny)) return;
      visited.set(key, true);
      queue.push({x:nx, y:ny, dist:cur.dist+1});
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────────────────────────────

function _avtCanvasClick(e) {
  const canvas = AVT_STATE.canvas;
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
  const tileX = Math.floor((cx + AVT_STATE.camera.x) / AVT_SZ);
  const tileY = Math.floor((cy + AVT_STATE.camera.y) / AVT_SZ);

  const ent = AVT_STATE.entidades.find(e => e.x === tileX && e.y === tileY);

  if (AVT_STATE.batalha.ativa) {
    if (AVT_STATE.batalha.moverModo) {
      // Move player to tile
      const ativo = _avtAtivo();
      if (ativo && ativo.tipo === 'jogador') {
        const reachable = _avtBFS(ativo.x, ativo.y, 3);
        if (reachable.some(p => p.x === tileX && p.y === tileY)) {
          ativo.x = tileX; ativo.y = tileY;
          AVT_STATE.batalha.moverModo = false;
          _avtLog(`${ativo.nome} move para (${tileX},${tileY})`);
          _avtHudUpdate();
          _avtCameraCenter();
        }
      }
    } else if (ent && ent.tipo === 'inimigo') {
      // Quick-select target
      const sel = document.getElementById('avt-hud-alvo');
      if (sel) { sel.value = ent.id; }
    }
  } else {
    // Out-of-combat movement for first player
    if (!ent) {
      const jogador = AVT_STATE.entidades.find(e => e.tipo === 'jogador');
      if (jogador && AVT_STATE.dungeon.tiles[tileY]?.[tileX] === AVT_T.PISO) {
        // Simple direct move (no combat)
        jogador.x = tileX; jogador.y = tileY;
        _avtCameraCenter();
        _avtCheckProximidadeInimigos();
      }
    }
  }
}

function _avtCanvasKey(e) {
  const keys = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1],
                 a:[-1,0], d:[1,0], w:[0,-1], s:[0,1] };
  const dir = keys[e.key];
  if (!dir || AVT_STATE.batalha.ativa) return;
  const jogador = AVT_STATE.entidades.find(e => e.tipo === 'jogador');
  if (!jogador) return;
  const nx = jogador.x + dir[0], ny = jogador.y + dir[1];
  if (AVT_STATE.dungeon.tiles[ny]?.[nx] === AVT_T.PISO &&
      !AVT_STATE.entidades.some(e => e.x===nx && e.y===ny)) {
    jogador.x = nx; jogador.y = ny;
    _avtCameraCenter();
    _avtCheckProximidadeInimigos();
  }
}

function _avtCheckProximidadeInimigos() {
  const jogadores = AVT_STATE.entidades.filter(e => e.tipo === 'jogador');
  const inimigos = AVT_STATE.entidades.filter(e => e.tipo === 'inimigo' && e.hp > 0);
  const proche = inimigos.some(ini =>
    jogadores.some(j => Math.abs(j.x - ini.x) + Math.abs(j.y - ini.y) <= 3)
  );
  if (proche && !AVT_STATE.batalha.ativa) {
    avtCombateIniciar();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMBAT — tactical pause
// ─────────────────────────────────────────────────────────────────────────────

function avtCombateIniciar() {
  mostrarToast('⚔ Combate iniciado!', 'aviso');
  const vivos = AVT_STATE.entidades.filter(e => e.hp > 0);

  // Roll initiative
  const init = vivos.map(e => ({
    ...e,
    initRoll: Math.floor(Math.random() * 20) + 1 + (e.tipo === 'jogador' ? 4 : 0)
  })).sort((a, b) => b.initRoll - a.initRoll);

  AVT_STATE.batalha = {
    ativa: true,
    iniciativa: init,
    turnoIdx: 0,
    log: ['Combate iniciado!'],
    moverModo: false
  };

  _avtHudMostrar(true);
  _avtHudUpdate();
  _avtRenderLog();

  // If first turn is NPC, process it
  if (_avtAtivo()?.tipo === 'inimigo') {
    setTimeout(_avtNpcTurno, 800);
  }
}

function avtCombateEncerrar() {
  AVT_STATE.batalha.ativa = false;
  AVT_STATE.batalha.moverModo = false;
  _avtHudMostrar(false);
  mostrarToast('Combate encerrado', 'ok');
}

function _avtAtivo() {
  const b = AVT_STATE.batalha;
  return b.ativa ? b.iniciativa[b.turnoIdx] : null;
}

function _avtHudMostrar(show) {
  const hud = document.getElementById('avt-hud');
  if (hud) hud.style.display = show ? 'flex' : 'none';
}

function _avtHudUpdate() {
  const b = AVT_STATE.batalha;
  const ativo = _avtAtivo();
  if (!ativo) return;

  // Initiative bar
  const initBar = document.getElementById('avt-hud-init');
  if (initBar) {
    initBar.innerHTML = b.iniciativa.map((e, i) =>
      `<span class="avt-init-badge ${i===b.turnoIdx?'ativo':''}" style="border-color:${e.cor}">${e.nome.split(' ')[0]}</span>`
    ).join('<span class="avt-init-sep">›</span>');
  }

  const hudEsq = document.getElementById('avt-hud-esq');
  const hudDir = document.getElementById('avt-hud-dir');
  if (!hudEsq || !hudDir) return;

  if (ativo.tipo === 'jogador') {
    // Player turn — show controls
    const inimigos = b.iniciativa.filter(e => e.tipo === 'inimigo' && e.hp > 0);
    const mySkills = AVT_STATE.skills.filter(sk =>
      sk.personagem === ativo.nome || sk.character_id === ativo.dbId
    );

    hudEsq.innerHTML = `
      <div class="avt-hud-turno" style="color:${ativo.cor}">Turno: <b>${ativo.nome}</b></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select id="avt-hud-alvo" style="flex:1;min-width:120px;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.72rem">
          ${inimigos.map(e => `<option value="${e.id}">${e.nome} (${e.hp}/${e.hpMax}HP)</option>`).join('')}
          ${!inimigos.length ? '<option>— sem alvos —</option>' : ''}
        </select>
        <select id="avt-hud-skill" style="flex:1;min-width:120px;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.72rem">
          <option value="">Ataque básico (1d8)</option>
          ${mySkills.map(sk => `<option value="${sk.id}" data-formula="${sk.formula_dano||'1d6'}">${sk.habilidade}</option>`).join('')}
        </select>
      </div>`;

    hudDir.innerHTML = `
      <button class="avt-hud-btn avt-hud-btn-atk" onclick="avtHudAtacar()">⚔ Atacar</button>
      <button class="avt-hud-btn avt-hud-btn-mov" onclick="avtHudMover()">↔ Mover</button>
      <button class="avt-hud-btn avt-hud-btn-pass" onclick="avtHudPassar()">⏭ Passar</button>`;
  } else {
    // NPC turn — show waiting
    hudEsq.innerHTML = `<div class="avt-hud-turno" style="color:${ativo.cor}">Turno do inimigo: <b>${ativo.nome}</b></div>
      <div style="color:#7a92aa;font-size:0.8rem">IA processando…</div>`;
    hudDir.innerHTML = '';
  }
}

function avtHudAtacar() {
  const ativo = _avtAtivo();
  if (!ativo || ativo.tipo !== 'jogador') return;

  const alvoId = document.getElementById('avt-hud-alvo')?.value;
  const alvo = AVT_STATE.batalha.iniciativa.find(e => e.id === alvoId);
  if (!alvo || alvo.hp <= 0) { mostrarToast('Selecione um alvo válido', 'aviso'); return; }

  const skillSel = document.getElementById('avt-hud-skill');
  const formula = skillSel?.selectedOptions?.[0]?.dataset?.formula || '1d8';
  const skillNome = skillSel?.value ? skillSel.selectedOptions[0].text : 'Ataque básico';

  const dano = _avtRolarFormula(formula);
  const hitRoll = Math.floor(Math.random() * 20) + 1;

  if (hitRoll < 5) {
    _avtLog(`${ativo.nome} erra ${alvo.nome}! (rolou ${hitRoll})`);
    mostrarToast(`💨 ${ativo.nome} errou!`, '');
  } else {
    const real = hitRoll >= 19 ? dano * 2 : dano;
    alvo.hp = Math.max(0, alvo.hp - real);
    const msg = hitRoll >= 19
      ? `🎯 CRÍTICO! ${ativo.nome} → ${alvo.nome}: ${real} dano (${skillNome})`
      : `⚔ ${ativo.nome} → ${alvo.nome}: ${real} dano (${skillNome})`;
    _avtLog(msg);
    mostrarToast(msg, 'ok');
    _avtRenderHpBar();

    if (alvo.hp <= 0) {
      _avtLog(`💀 ${alvo.nome} derrotado!`);
      mostrarToast(`💀 ${alvo.nome} derrota!`, 'ok');
      _avtCheckVitoria();
    }
  }
  setTimeout(_avtTurnoAvancar, 600);
}

function avtHudMover() {
  AVT_STATE.batalha.moverModo = !AVT_STATE.batalha.moverModo;
  mostrarToast(AVT_STATE.batalha.moverModo ? 'Clique no tile de destino' : 'Modo mover cancelado', '');
}

function avtHudPassar() {
  const ativo = _avtAtivo();
  if (ativo) _avtLog(`${ativo.nome} passa o turno`);
  _avtTurnoAvancar();
}

function _avtTurnoAvancar() {
  const b = AVT_STATE.batalha;
  b.moverModo = false;

  // Remove dead from initiative
  b.iniciativa = b.iniciativa.filter(e => e.hp > 0);
  if (!b.iniciativa.length) { avtCombateEncerrar(); return; }

  b.turnoIdx = (b.turnoIdx + 1) % b.iniciativa.length;
  _avtHudUpdate();
  _avtRenderLog();

  // NPC turn
  if (_avtAtivo()?.tipo === 'inimigo') {
    setTimeout(_avtNpcTurno, 600);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NPC AI — move toward nearest player, attack if adjacent
// ─────────────────────────────────────────────────────────────────────────────

function _avtNpcTurno() {
  const b = AVT_STATE.batalha;
  const npc = _avtAtivo();
  if (!npc || npc.tipo !== 'inimigo') return;

  // Re-sync entity HP from iniciativa to entidades
  const entNpc = AVT_STATE.entidades.find(e => e.id === npc.id);
  if (!entNpc || entNpc.hp <= 0) { _avtTurnoAvancar(); return; }

  const jogadores = AVT_STATE.entidades.filter(e => e.tipo === 'jogador' && e.hp > 0);
  if (!jogadores.length) { _avtTurnoAvancar(); return; }

  // Find nearest player
  let nearest = jogadores[0], nearDist = Infinity;
  jogadores.forEach(j => {
    const d = Math.abs(j.x - entNpc.x) + Math.abs(j.y - entNpc.y);
    if (d < nearDist) { nearest = j; nearDist = d; }
  });

  if (nearDist <= 1) {
    // Attack
    const dano = _avtRolarFormula('1d6');
    const hit = Math.floor(Math.random() * 20) + 1;
    if (hit < 6) {
      _avtLog(`${npc.nome} erra ${nearest.nome}`);
    } else {
      nearest.hp = Math.max(0, nearest.hp - dano);
      // Sync back to initiative
      const initEnt = b.iniciativa.find(e => e.id === nearest.id || e.nome === nearest.nome);
      if (initEnt) initEnt.hp = nearest.hp;
      _avtLog(`👹 ${npc.nome} → ${nearest.nome}: ${dano} dano`);
      mostrarToast(`👹 ${npc.nome} ataca! -${dano} HP`, 'aviso');
      _avtRenderHpBar();
      if (nearest.hp <= 0) {
        _avtLog(`💀 ${nearest.nome} caiu!`);
        _avtCheckDerrota();
      }
    }
  } else {
    // Move toward player (1 step)
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    let bestDir = null, bestDist = nearDist;
    dirs.forEach(([dx,dy]) => {
      const nx = entNpc.x+dx, ny = entNpc.y+dy;
      if (AVT_STATE.dungeon.tiles[ny]?.[nx] !== AVT_T.PISO) return;
      if (AVT_STATE.entidades.some(e => e.x===nx && e.y===ny)) return;
      const d = Math.abs(nearest.x - nx) + Math.abs(nearest.y - ny);
      if (d < bestDist) { bestDist = d; bestDir = [dx,dy]; }
    });
    if (bestDir) { entNpc.x += bestDir[0]; entNpc.y += bestDir[1]; }
  }

  setTimeout(_avtTurnoAvancar, 500);
}

function _avtCheckVitoria() {
  const inimigosVivos = AVT_STATE.entidades.filter(e => e.tipo === 'inimigo' && e.hp > 0);
  if (!inimigosVivos.length) {
    setTimeout(() => {
      avtCombateEncerrar();
      mostrarToast('✦ Vitória! Todos os inimigos derrotados!', 'sucesso');
      _avtLog('=== VITÓRIA ===');
      _avtRenderLog();
    }, 400);
  }
}

function _avtCheckDerrota() {
  const jogadoresVivos = AVT_STATE.entidades.filter(e => e.tipo === 'jogador' && e.hp > 0);
  if (!jogadoresVivos.length) {
    setTimeout(() => {
      avtCombateEncerrar();
      mostrarToast('💀 Todos os heróis caíram…', 'erro');
      _avtLog('=== DERROTA ===');
      _avtRenderLog();
    }, 400);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DICE
// ─────────────────────────────────────────────────────────────────────────────

function _avtRolarFormula(formula) {
  if (!formula) return Math.floor(Math.random() * 8) + 1;
  let total = 0;
  const partes = String(formula).toLowerCase().split('+');
  partes.forEach(p => {
    p = p.trim();
    const m = p.match(/^(\d*)d(\d+)$/);
    if (m) {
      const n = parseInt(m[1]) || 1, d = parseInt(m[2]) || 6;
      for (let i = 0; i < n; i++) total += Math.floor(Math.random() * d) + 1;
    } else {
      total += parseInt(p) || 0;
    }
  });
  return Math.max(1, total);
}

// ─────────────────────────────────────────────────────────────────────────────
// LOG + HP BAR
// ─────────────────────────────────────────────────────────────────────────────

function _avtLog(msg) {
  AVT_STATE.batalha.log.unshift(msg);
  if (AVT_STATE.batalha.log.length > 20) AVT_STATE.batalha.log.length = 20;
  _avtRenderLog();
}

function _avtRenderLog() {
  const el = document.getElementById('avt-log');
  if (!el) return;
  el.innerHTML = AVT_STATE.batalha.log.map(l =>
    `<div class="avt-log-linha">${l}</div>`
  ).join('');
}

function _avtRenderHpBar() {
  const wrap = document.getElementById('avt-hp-bars');
  if (!wrap) return;
  const jogadores = AVT_STATE.entidades.filter(e => e.tipo === 'jogador');
  wrap.innerHTML = jogadores.map(j => {
    const pct = Math.max(0, j.hp / j.hpMax * 100);
    const col = pct > 50 ? '#27ae60' : pct > 25 ? '#f39c12' : '#e74c3c';
    return `<div class="avt-hp-item">
      <span class="avt-hp-nome" style="color:${j.cor}">${j.nome.split(' ')[0]}</span>
      <div class="avt-hp-bar-wrap">
        <div class="avt-hp-bar-fill" style="width:${pct}%;background:${col}"></div>
      </div>
      <span class="avt-hp-val">${j.hp}/${j.hpMax}</span>
    </div>`;
  }).join('');
}

function _avtToggleLog() {
  const panel = document.getElementById('avt-log-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT on DOMContentLoaded
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  // Render aventura section in hub after hub loads
  // Called again from iniciarApp via hook in auth.js
});
