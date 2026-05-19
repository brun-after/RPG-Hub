// js/systems/aventura.js
// Aventura mode — solo/small-group top-down dungeon, tactical-pause combat
// rpg_registry { is_aventura: true, theme_json.dungeon_data } + characters + skills

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

var AVT_STATE = {
  rpgId: null,
  rpg: null,
  chars: [],
  skills: [],
  dungeon: null,           // { tiles[][], w, h, rooms[] }
  entidades: [],           // [{ id, nome, x, y, hp, hpMax, tipo, cor, pacienciaSecs, deteccaoRaio, isBoss }]
  batalhas: [],           // Array of active combat objects (multiple simultaneous combats)
  batalhaAutoSuspensa: false,
  mestreReposicionando: null, // entId being repositioned by master
  canvas: null,
  ctx: null,
  camera: { x: 0, y: 0, zoom: 1 },
  animFrame: null,
  _pendingTimeouts: [],
  _resizeObs: null,
  // GM / master
  isMestre: false,
  mestreAtivo: false,      // mestre em modo controle total (pode mover todos os personagens)
  npcIaAtiva: true,
  npcControlando: null,
  mestreVisaoGeral: false,
  mestrePainelAba: 'modo',
  // player assignment
  myCharNome: null,        // nome do personagem vinculado ao usuário atual
  membros: [],             // rpg_members carregados (para atribuição)
  // patience timers (per enemy)
  npcTimers: {},           // { entId: { patience: ms, maxPatience: ms, ativo: bool } }
  _lastFrameTs: 0,
  // character editor
  charEditorId: null,
  charEditorTab: 'attrs',
  // appearance / animation rendering (token sprites)
  aparencias: {},   // entId -> { parts, animations, partImgs: {key: Image}, loaded }
  entAnim: {},      // entId -> { state, stateStart, lastX, lastY, walkUntil, attackUntil, facing }
  _criando: {
    nome: '', cor: '#c8a84b', cor2: '#4fa3d1', icone: 'sword',
    personagens: [], importCampanhaId: null,
    mapa: null,            // dungeon object chosen in step 3
    mapaOpcao: null,       // 'procedural'|'editor'|'json'|'claude'|'fase'
    faseId: null,          // selected fase id (opção 'fase')
    etapa: 0
  },
  _novaFaseWizard: null,   // wizard state for creating extra phases
  _modoPortaPlacement: false, // when true, next map click sets door position
  _faseAnterior: null,     // saved dungeon to return to from extra phase
  itemCatalog: []          // item_catalog loaded for this adventure
};

const AVT_T  = { PAREDE: 0, PISO: 1, SAIDA: 2 };
const AVT_SZ = 48;

// Presets de aparência para NPCs e Bosses genéricos
const AVT_NPC_PRESETS = {
  goblin:    { nome:'Goblin',    icone:'G', cor:'#3a7a20', hpBase:12, pacienciaSecs:5, deteccaoRaio:3, xpBase:25 },
  esqueleto: { nome:'Esqueleto', icone:'S', cor:'#7a8090', hpBase:15, pacienciaSecs:6, deteccaoRaio:3, xpBase:30 },
  orc:       { nome:'Orc',       icone:'O', cor:'#6a3010', hpBase:25, pacienciaSecs:4, deteccaoRaio:4, xpBase:50 },
  troll:     { nome:'Troll',     icone:'T', cor:'#405c30', hpBase:40, pacienciaSecs:7, deteccaoRaio:4, xpBase:75 },
  vampiro:   { nome:'Vampiro',   icone:'V', cor:'#4a0a2a', hpBase:30, pacienciaSecs:3, deteccaoRaio:5, xpBase:60 },
  cultista:  { nome:'Cultista',  icone:'C', cor:'#2a1a5a', hpBase:18, pacienciaSecs:5, deteccaoRaio:3, xpBase:35 },
  boss:      { nome:'Boss',      icone:'☠', cor:'#4a0000', hpBase:100, pacienciaSecs:1, deteccaoRaio:6, isBoss:true, xpBase:300 },
};

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
// HUB
// ─────────────────────────────────────────────────────────────────────────────

async function avtHubRenderSection() {
  const lista = document.getElementById('avt-hub-lista');
  if (!lista) return;
  lista.innerHTML = '<div style="color:#7a92aa;font-size:0.75rem;padding:8px 0">Carregando…</div>';
  const aventuras = await aventuraCarregarLista();
  if (!aventuras.length) {
    lista.innerHTML = '<div style="color:#7a92aa;font-size:0.75rem;padding:8px 0;font-style:italic">Nenhum dungeon ainda.</div>';
    return;
  }
  lista.innerHTML = aventuras.map(r => {
    const t = r.theme_json || {};
    const cor = t.destaque || '#c8a84b';
    const rid = r.rpg_id.replace(/'/g, "\\'");
    return `<div class="avt-card" onclick="entrarAventura('${rid}')" style="--avt-acc:${cor}">
      <div class="avt-card-ico"><svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <path d="M13 3 L21 7 L21 19 L13 23 L5 19 L5 7Z" stroke="${cor}" stroke-width="1.2" fill="none"/>
        <path d="M9 13 L17 13 M13 9 L13 17" stroke="${cor}" stroke-width="1.5"/></svg></div>
      <div class="avt-card-info">
        <div class="avt-card-nome" style="color:${cor}">${r.name}</div>
        <div class="avt-card-sub">Dungeon</div>
      </div>
      <div class="avt-card-arr">→</div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// CRIAR AVENTURA — 3-step wizard
// ─────────────────────────────────────────────────────────────────────────────

function abrirCriarAventura() {
  AVT_STATE._criando = {
    nome: '', cor: '#c8a84b', cor2: '#4fa3d1', icone: 'sword',
    personagens: [{ nome: '', hp_max: 60, cor: '#4fa3d1' }],
    importCampanhaId: null, mapa: null, mapaOpcao: null, faseId: null, etapa: 0,
    _tilesetConfig: null, _tilesetImgFile: null, _tilesetImgUrl: null
  };
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

  const TOTAL = 3;
  const dots = document.getElementById('avt-criar-dots');
  if (dots) dots.innerHTML = Array.from({length: TOTAL}, (_, i) =>
    `<div class="criar-step-dot ${i===c.etapa?'ativo':i<c.etapa?'feito':''}"></div>`
  ).join('');

  const btnPrev = document.getElementById('avt-criar-btn-prev');
  const btnNext = document.getElementById('avt-criar-btn-next');
  if (btnPrev) btnPrev.style.display = c.etapa > 0 ? '' : 'none';
  if (btnNext) {
    const isLast = c.etapa === TOTAL - 1;
    btnNext.textContent = isLast ? '▶ Iniciar Dungeon!' : 'Próximo →';
    btnNext.onclick = isLast ? aventuraCriarSubmit : _avtCriarAvancar;
  }

  body.scrollTop = 0;
  if (c.etapa === 0) _avtCriarRenderIdentidade(body);
  else if (c.etapa === 1) _avtCriarRenderPersonagens(body);
  else _avtCriarRenderMapa(body);
}

// ── ETAPA 0: Identidade ───────────────────────────────────────────────────────
function _avtCriarRenderIdentidade(body) {
  const c = AVT_STATE._criando;
  body.innerHTML = `
    <div class="etapa-titulo">Identidade do Dungeon</div>
    <div class="etapa-desc">Nome e cor do seu dungeon.</div>
    <div class="criar-field">
      <label>Nome *</label>
      <input class="criar-input" id="avt-c-nome" value="${c.nome}" placeholder="Ex: A Cripta Esquecida" maxlength="60">
    </div>
    <div class="criar-field">
      <label>Cor principal</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        ${['#c8a84b','#4fa3d1','#7b2fbe','#27ae60','#e8604c','#e67e22'].map(cor =>
          `<div onclick="avtCriarSetCor('${cor}')"
            style="width:28px;height:28px;border-radius:50%;background:${cor};cursor:pointer;
                   border:2px solid ${c.cor===cor?'#fff':'transparent'};transition:border-color .15s"></div>`
        ).join('')}
        <input type="color" value="${c.cor}" oninput="avtCriarSetCor(this.value)"
          style="width:28px;height:28px;border-radius:50%;border:none;padding:0;cursor:pointer;background:none">
      </div>
    </div>`;
}

// ── ETAPA 1: Personagens ──────────────────────────────────────────────────────
function _avtCriarRenderPersonagens(body) {
  const c = AVT_STATE._criando;
  const campanhas = (HUB_DATA?.rpgs || [])
    .filter(r => !r.is_arena && !r.is_aventura && !(r.theme_json?.is_aventura));
  body.innerHTML = `
    <div class="etapa-titulo">Personagens</div>
    <div class="etapa-desc">Adicione seus heróis — ou importe de uma campanha.</div>
    ${campanhas.length ? `
    <div class="criar-field" style="margin-bottom:16px">
      <label>Importar de campanha (opcional)</label>
      <select id="avt-import-camp" onchange="avtCriarImportCampanha(this.value)"
        style="width:100%;padding:8px;background:#0a0f18;border:1px solid var(--borda);border-radius:6px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.8rem">
        <option value="">— Criar do zero —</option>
        ${campanhas.map(r => `<option value="${r.rpg_id}" ${c.importCampanhaId===r.rpg_id?'selected':''}>${r.name}</option>`).join('')}
      </select>
    </div>` : ''}
    <div id="avt-chars-lista">${_avtCriarRenderCharsLista()}</div>
    <button onclick="avtCriarAddChar()"
      style="margin-top:8px;padding:6px 14px;border-radius:6px;border:1px dashed rgba(255,255,255,0.2);background:transparent;color:#7a92aa;cursor:pointer;font-size:0.78rem">
      + Adicionar personagem
    </button>`;
}

function _avtCriarRenderCharsLista() {
  return AVT_STATE._criando.personagens.map((p, i) => `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;padding:10px;
                background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.08)">
      <div style="width:10px;height:10px;border-radius:50%;background:${p.cor||'#4fa3d1'};flex-shrink:0"></div>
      <input style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
                    border-radius:5px;color:#fff;padding:5px 8px;font-size:0.82rem;font-family:inherit"
        placeholder="Nome do personagem" value="${p.nome}"
        oninput="AVT_STATE._criando.personagens[${i}].nome=this.value">
      <input type="number" min="10" max="999" value="${p.hp_max}"
        style="width:60px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
               border-radius:5px;color:#fff;padding:5px 8px;font-size:0.82rem;text-align:center"
        title="HP máx" oninput="AVT_STATE._criando.personagens[${i}].hp_max=+this.value||60">
      <span style="font-size:0.65rem;color:#7a92aa">HP</span>
      <select onchange="AVT_STATE._criando.personagens[${i}].classe_aventura=this.value"
        style="padding:4px 6px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.15);border-radius:5px;color:#c8d8e8;font-size:0.75rem">
        <option value="guerreiro" ${(p.classe_aventura||'guerreiro')==='guerreiro'?'selected':''}>⚔ Guerreiro</option>
        <option value="mago" ${p.classe_aventura==='mago'?'selected':''}>🔮 Mago</option>
      </select>
      ${i > 0 ? `<button onclick="avtCriarRemChar(${i})"
        style="background:none;border:none;color:#7a92aa;cursor:pointer;font-size:0.9rem;padding:2px 4px">✕</button>` : ''}
    </div>`).join('');
}

// ── ETAPA 2: Mapa ─────────────────────────────────────────────────────────────
function _avtCriarRenderMapa(body) {
  const c = AVT_STATE._criando;

  // Detect if source campaign has fases
  const temFases = !!(c._fasesDisponiveis?.length);

  body.innerHTML = `
    <div class="etapa-titulo">Mapa do Dungeon</div>
    <div class="etapa-desc">Como quer criar o mapa?</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div class="avt-mapa-opcao ${c.mapaOpcao==='editor'?'selecionado':''}" onclick="avtCriarSelecionarMapa('editor')">
        <div class="avt-mapa-opcao-ico">✏</div>
        <div class="avt-mapa-opcao-titulo">Editor manual</div>
        <div class="avt-mapa-opcao-desc">Desenhe o mapa célula por célula</div>
      </div>
      <div class="avt-mapa-opcao ${c.mapaOpcao==='json'?'selecionado':''}" onclick="avtCriarSelecionarMapa('json')">
        <div class="avt-mapa-opcao-ico">📋</div>
        <div class="avt-mapa-opcao-titulo">Importar JSON (IA)</div>
        <div class="avt-mapa-opcao-desc">Cole JSON gerado por IA externa</div>
      </div>
      <div class="avt-mapa-opcao ${c.mapaOpcao==='claude'?'selecionado':''}" onclick="avtCriarSelecionarMapa('claude')">
        <div class="avt-mapa-opcao-ico">⚡</div>
        <div class="avt-mapa-opcao-titulo">Gerar com Claude</div>
        <div class="avt-mapa-opcao-desc">Descreva e gere via Claude API</div>
      </div>
      <div class="avt-mapa-opcao ${c.mapaOpcao==='procedural'?'selecionado':''}" onclick="avtCriarSelecionarMapa('procedural')">
        <div class="avt-mapa-opcao-ico">🎲</div>
        <div class="avt-mapa-opcao-titulo">Dungeon procedural</div>
        <div class="avt-mapa-opcao-desc">Gerar dungeon aleatória automática</div>
      </div>
    </div>

    <div class="avt-mapa-opcao ${c.mapaOpcao==='ia_fase'?'selecionado':''}" onclick="avtCriarSelecionarMapa('ia_fase')"
      style="grid-column:1/-1;display:flex;align-items:center;gap:12px">
      <span style="font-size:1.2rem">🎨</span>
      <div>
        <div class="avt-mapa-opcao-titulo">Tileset por IA (visual)</div>
        <div class="avt-mapa-opcao-desc">Gere blocos visuais com IA de imagem e aplique ao mapa</div>
      </div>
    </div>

    ${temFases ? `
    <div class="avt-mapa-opcao ${c.mapaOpcao==='fase'?'selecionado':''}" onclick="avtCriarSelecionarMapa('fase')"
      style="grid-column:1/-1;display:flex;align-items:center;gap:12px">
      <span style="font-size:1.2rem">🗺</span>
      <div>
        <div class="avt-mapa-opcao-titulo">Usar fase existente</div>
        <div class="avt-mapa-opcao-desc">Aproveitar uma fase salva da campanha importada</div>
      </div>
    </div>` : ''}

    <div id="avt-mapa-sub" style="margin-top:14px"></div>`;

  if (c.mapaOpcao) _avtCriarRenderMapaSub(c.mapaOpcao);
}

function avtCriarSelecionarMapa(opcao) {
  AVT_STATE._criando.mapaOpcao = opcao;
  AVT_STATE._criando.mapa = null;
  // Re-render just the option cards + sub panel
  const body = document.getElementById('avt-criar-body');
  if (body) _avtCriarRenderMapa(body);
}

function _avtCriarRenderMapaSub(opcao) {
  const sub = document.getElementById('avt-mapa-sub');
  if (!sub) return;
  const c = AVT_STATE._criando;

  if (opcao === 'procedural') {
    sub.innerHTML = `
      <div style="padding:12px;background:rgba(79,163,209,0.05);border:1px solid rgba(79,163,209,0.15);border-radius:8px">
        <div style="font-size:0.78rem;color:#c8d8e8;margin-bottom:10px">Dungeon gerada proceduralmente (BSP). Quantidade de salas:</div>
        <div style="display:flex;align-items:center;gap:10px">
          <input id="avt-proc-salas" type="range" min="3" max="50" value="8" style="flex:1;accent-color:#4fa3d1"
            oninput="document.getElementById('avt-proc-salas-val').textContent=this.value;AVT_STATE._criando._procSalas=+this.value">
          <span id="avt-proc-salas-val" style="font-family:var(--fonte-d);font-size:0.85rem;color:#c8a84b;min-width:28px;text-align:right">8</span>
          <span style="font-size:0.68rem;color:#7a92aa">salas</span>
        </div>
        <div style="font-size:0.68rem;color:#7a92aa;margin-top:8px">O tamanho do grid cresce automaticamente com o número de salas. Nomes e tipos de inimigos podem ser ajustados após entrar no mapa.</div>
      </div>`;
    AVT_STATE._criando._procSalas = 8;
    AVT_STATE._criando.mapa = 'procedural';

  } else if (opcao === 'editor') {
    sub.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span style="font-size:0.7rem;color:#7a92aa">Tamanho:</span>
        <select id="avt-ed-tamanho" onchange="_avtEditorTamanho(this.value)"
          style="padding:4px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.7rem">
          <option value="22x16">Pequena (22×16 — ~5 salas)</option>
          <option value="40x28">Média (40×28 — ~12 salas)</option>
          <option value="60x40" selected>Grande (60×40 — ~25 salas)</option>
          <option value="80x56">Enorme (80×56 — ~50 salas)</option>
        </select>
        <span style="font-size:0.68rem;color:#7a92aa">·</span>
        <button onclick="_avtEditorAcaoSet('piso')" id="avt-ed-btn-piso" class="avt-ed-btn avt-ed-btn-ativo">Piso</button>
        <button onclick="_avtEditorAcaoSet('parede')" id="avt-ed-btn-parede" class="avt-ed-btn">Parede</button>
        <button onclick="_avtEditorAcaoSet('sala')" id="avt-ed-btn-sala" class="avt-ed-btn">Sala</button>
        <button onclick="_avtEditorLimpar()" class="avt-ed-btn">Limpar</button>
        <button onclick="_avtEditorReset()" class="avt-ed-btn">Resetar</button>
      </div>
      <div style="overflow:auto;max-height:380px;border:1px solid rgba(79,163,209,0.15);border-radius:6px">
        <canvas id="avt-ed-canvas" style="cursor:crosshair;display:block;touch-action:none"></canvas>
      </div>`;
    _avtEd.w = 60; _avtEd.h = 40;
    setTimeout(_avtEditorInit, 50);

  } else if (opcao === 'json') {
    sub.innerHTML = `
      <div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap;align-items:flex-end">
        <div style="flex:1;min-width:120px">
          <label style="display:block;font-size:0.65rem;color:rgba(79,163,209,0.7);font-family:var(--fonte-d);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Nº de salas</label>
          <input id="avt-json-salas" type="number" min="1" max="50" value="10"
            style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.8rem"
            oninput="_avtJsonAtualizarPrompt()">
        </div>
        <div style="flex:2;min-width:150px">
          <label style="display:block;font-size:0.65rem;color:rgba(79,163,209,0.7);font-family:var(--fonte-d);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Tamanho do grid</label>
          <select id="avt-json-tamanho" onchange="_avtJsonAtualizarPrompt()"
            style="width:100%;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.8rem">
            <option value="22x16">Pequena (22×16)</option>
            <option value="40x28">Média (40×28)</option>
            <option value="60x40" selected>Grande (60×40)</option>
            <option value="80x56">Enorme (80×56)</option>
          </select>
        </div>
        <button onclick="_avtCopiarPromptJson()" class="prompt-copy-btn" style="font-size:0.7rem;flex-shrink:0;align-self:flex-end">
          <span>⎘</span> <span>Copiar prompt</span>
          <span id="avt-json-ok" class="prompt-copy-ok">✓ Copiado!</span>
        </button>
      </div>
      <textarea id="avt-json-input" rows="7" placeholder='Cole aqui o JSON gerado pela IA...'
        style="width:100%;box-sizing:border-box;padding:8px;background:rgba(10,15,24,0.8);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-family:monospace;font-size:0.72rem;resize:vertical;line-height:1.4"
        oninput="_avtJsonParsePreview(this.value)"></textarea>
      <div id="avt-json-status" style="margin-top:6px;font-size:0.75rem;color:#7a92aa"></div>`;

  } else if (opcao === 'claude') {
    const key = localStorage.getItem('animgen_claude_key') || '';
    sub.innerHTML = `
      <div class="criar-field">
        <label>Claude API Key ${key ? '(salva)' : '(necessária)'}</label>
        <input id="avt-claude-key" type="password" value="${key}"
          placeholder="sk-ant-…"
          style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;padding:7px 10px;font-family:monospace;font-size:0.8rem"
          oninput="localStorage.setItem('animgen_claude_key',this.value)">
      </div>
      <div style="display:flex;gap:10px;margin-bottom:6px;flex-wrap:wrap">
        <div style="flex:1;min-width:120px">
          <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Nº de salas (1–50)</label>
          <input id="avt-claude-salas" type="number" min="1" max="50" value="10"
            style="width:100%;box-sizing:border-box;padding:6px 8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;font-size:0.8rem">
        </div>
        <div style="flex:2;min-width:150px">
          <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Tamanho do grid</label>
          <select id="avt-claude-tamanho"
            style="width:100%;padding:6px 8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;font-size:0.8rem">
            <option value="22x16">Pequena (22×16)</option>
            <option value="40x28">Média (40×28)</option>
            <option value="60x40" selected>Grande (60×40)</option>
            <option value="80x56">Enorme (80×56)</option>
          </select>
        </div>
      </div>
      <div class="criar-field">
        <label>Descreva o dungeon</label>
        <textarea id="avt-claude-desc" rows="3" placeholder="Ex: Uma cripta ancestral com guardiões mortos-vivos e uma sala do chefe no fundo. Inimigos fortes e numerosos."
          style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;padding:7px 10px;font-size:0.82rem;resize:vertical;line-height:1.5;font-family:inherit"></textarea>
      </div>
      <button onclick="_avtGerarComClaude()" id="avt-claude-btn"
        style="padding:9px 18px;background:rgba(79,163,209,0.15);border:1px solid rgba(79,163,209,0.35);border-radius:7px;color:#4fa3d1;font-family:var(--fonte-d);font-size:0.75rem;cursor:pointer;text-transform:uppercase;letter-spacing:.06em">
        ⚡ Gerar mapa
      </button>
      <div id="avt-claude-status" style="margin-top:8px;font-size:0.75rem;color:#7a92aa"></div>`;

  } else if (opcao === 'fase') {
    const fases = c._fasesDisponiveis || [];
    sub.innerHTML = `
      <div class="criar-field">
        <label>Fase existente</label>
        <select id="avt-fase-sel" onchange="AVT_STATE._criando.faseId=this.value;AVT_STATE._criando.mapa='fase-'+this.value"
          style="width:100%;padding:8px;background:#0a0f18;border:1px solid var(--borda);border-radius:6px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.8rem">
          <option value="">— Selecionar —</option>
          ${fases.map(f => `<option value="${f.map_id}">${f.nome||f.map_id}</option>`).join('')}
        </select>
      </div>
      <div style="font-size:0.72rem;color:#7a92aa">A fase será copiada para seu dungeon (independente).</div>`;

  } else if (opcao === 'ia_fase') {
    sub.innerHTML = `
      <div style="padding:12px;background:rgba(200,168,75,0.05);border:1px solid rgba(200,168,75,0.15);border-radius:8px;display:flex;flex-direction:column;gap:10px">

        <!-- Configuração -->
        <div>
          <div style="font-size:0.68rem;color:rgba(200,168,75,0.7);font-family:var(--fonte-d);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Configuração</div>
          <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;align-items:flex-end">
            <div style="flex:3;min-width:140px">
              <label style="display:block;font-size:0.65rem;color:#7a92aa;margin-bottom:4px">Descrição do dungeon</label>
              <input id="avt-tileset-desc" type="text" value="${(c.nome||'').replace(/"/g,'&quot;')}"
                placeholder="ex: cripta sombria com guardiões mortos-vivos"
                style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(200,168,75,0.2);border-radius:6px;color:#c8d8e8;font-size:0.8rem">
            </div>
            <div style="min-width:56px">
              <label style="display:block;font-size:0.65rem;color:#7a92aa;margin-bottom:4px">Cols</label>
              <input id="avt-tileset-cols" type="number" value="4" min="2" max="16"
                style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(200,168,75,0.2);border-radius:6px;color:#c8d8e8;font-size:0.8rem">
            </div>
            <div style="min-width:56px">
              <label style="display:block;font-size:0.65rem;color:#7a92aa;margin-bottom:4px">Linhas</label>
              <input id="avt-tileset-rows" type="number" value="4" min="2" max="16"
                style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(200,168,75,0.2);border-radius:6px;color:#c8d8e8;font-size:0.8rem">
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <div style="min-width:80px">
              <label style="display:block;font-size:0.65rem;color:#7a92aa;margin-bottom:4px">Largura dungeon</label>
              <input id="avt-tileset-largura" type="number" value="24" min="10" max="80"
                style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(200,168,75,0.2);border-radius:6px;color:#c8d8e8;font-size:0.8rem">
            </div>
            <div style="min-width:80px">
              <label style="display:block;font-size:0.65rem;color:#7a92aa;margin-bottom:4px">Altura dungeon</label>
              <input id="avt-tileset-altura" type="number" value="18" min="8" max="60"
                style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(200,168,75,0.2);border-radius:6px;color:#c8d8e8;font-size:0.8rem">
            </div>
          </div>
        </div>

        <!-- Passo 1: prompt de imagem -->
        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(200,168,75,0.15);border-radius:6px;padding:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
            <span style="font-size:0.72rem;color:#c8a84b;font-weight:600">1. Prompt de imagem (tileset)</span>
            <button onclick="faseTilesetCopiarPromptImagem()"
              style="padding:4px 10px;background:rgba(200,168,75,0.12);border:1px solid rgba(200,168,75,0.3);border-radius:5px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer;text-transform:uppercase">
              ⎘ Copiar
            </button>
          </div>
          <div style="font-size:0.67rem;color:#7a92aa;line-height:1.5">Instrução para IA de imagem (DALL-E, Midjourney…) gerar o spritesheet de blocos.</div>
        </div>

        <!-- Passo 2: upload imagem -->
        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(200,168,75,0.15);border-radius:6px;padding:10px">
          <div style="font-size:0.72rem;color:#c8a84b;font-weight:600;margin-bottom:8px">2. Carregar tileset gerado</div>
          <label style="display:inline-block;padding:6px 12px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.25);border-radius:5px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;text-transform:uppercase">
            📁 Escolher imagem
            <input type="file" accept="image/*" style="display:none" onchange="faseTilesetHandleImageSelect(this)">
          </label>
          <span id="avt-tileset-img-nome" style="font-size:0.68rem;color:#7a92aa;margin-left:8px"></span>
          <div style="margin-top:8px">
            <img id="avt-tileset-img-preview" style="display:none;max-width:100%;max-height:140px;border:1px solid rgba(200,168,75,0.2);border-radius:4px;image-rendering:pixelated">
          </div>
        </div>

        <!-- Passo 3: prompt de layout -->
        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(200,168,75,0.15);border-radius:6px;padding:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
            <span style="font-size:0.72rem;color:#c8a84b;font-weight:600">3. Prompt de layout da dungeon</span>
            <button onclick="faseTilesetCopiarPromptLayout()"
              style="padding:4px 10px;background:rgba(200,168,75,0.12);border:1px solid rgba(200,168,75,0.3);border-radius:5px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer;text-transform:uppercase">
              ⎘ Copiar
            </button>
          </div>
          <div style="font-size:0.67rem;color:#7a92aa;line-height:1.5">Envie para Claude.ai ou ChatGPT <strong style="color:#c8a84b">junto com a imagem</strong>. A IA identifica os blocos e projeta as salas, corredores e objetos.</div>
        </div>

        <!-- Passo 4: colar JSON -->
        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(200,168,75,0.15);border-radius:6px;padding:10px">
          <div style="font-size:0.72rem;color:#c8a84b;font-weight:600;margin-bottom:8px">4. Cole o JSON retornado</div>
          <textarea id="avt-tileset-json-input" rows="6" placeholder='{"version":2,"cols":4,"rows":4,"blocos":{...},"mapa":{"tiles":[...]}}'
            style="width:100%;box-sizing:border-box;padding:8px;background:rgba(10,15,24,0.8);border:1px solid rgba(200,168,75,0.15);border-radius:6px;color:#c8d8e8;font-family:monospace;font-size:0.65rem;resize:vertical;line-height:1.4"
            oninput="faseTilesetHandleJSONPaste(this.value)"></textarea>
          <div id="avt-tileset-json-status" style="margin-top:4px;font-size:0.72rem"></div>
        </div>
      </div>`;

    // A IA define a dungeon — não há sub-modo separado
    c.mapa = 'ia_fase_pending';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WIZARD NAV
// ─────────────────────────────────────────────────────────────────────────────

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
  AVT_STATE._criando._fasesDisponiveis = [];
  AVT_STATE._criando._campSkillsToImport = [];
  if (!campId) {
    AVT_STATE._criando.personagens = [{ nome: '', hp_max: 60, cor: '#4fa3d1' }];
    const lista = document.getElementById('avt-chars-lista');
    if (lista) lista.innerHTML = _avtCriarRenderCharsLista();
    return;
  }
  try {
    const [chars, fases, campSkills] = await Promise.all([
      _avtSb(`characters?rpg_id=eq.${encodeURIComponent(campId)}&select=nome,hp_max,custom_attrs,id&order=nome`),
      _avtSb(`mapas?rpg_id=eq.${encodeURIComponent(campId)}&tipo=eq.fase&select=map_id,nome,render_data`)
        .catch(() => []),
      _avtSb(`skills?rpg_id=eq.${encodeURIComponent(campId)}&select=*`)
        .catch(() => [])
    ]);
    if (chars?.length) {
      const cores = ['#4fa3d1','#27ae60','#c8a84b','#7b2fbe','#e8604c'];
      AVT_STATE._criando.personagens = chars
        .filter(c => c.custom_attrs?.tipo_personagem !== 'npc')
        .map((c, i) => ({ nome: c.nome, hp_max: c.hp_max || 60, cor: cores[i % cores.length] }));
      if (!AVT_STATE._criando.personagens.length)
        AVT_STATE._criando.personagens = [{ nome: '', hp_max: 60, cor: '#4fa3d1' }];
      const lista = document.getElementById('avt-chars-lista');
      if (lista) lista.innerHTML = _avtCriarRenderCharsLista();
      mostrarToast(`${chars.length} personagens importados`, 'ok');
    }
    if (fases?.length) {
      AVT_STATE._criando._fasesDisponiveis = fases;
    }
    if (campSkills?.length) {
      AVT_STATE._criando._campSkillsToImport = campSkills;
      mostrarToast(`${campSkills.length} skills importadas`, 'ok');
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
  if (c.etapa === 1) {
    const chars = c.personagens.filter(p => p.nome.trim());
    if (!chars.length) { mostrarToast('Adicione ao menos 1 personagem', 'aviso'); return; }
  }
  c.etapa++;
  _avtCriarRenderEtapa();
}

// ─────────────────────────────────────────────────────────────────────────────
// TILE EDITOR
// ─────────────────────────────────────────────────────────────────────────────

var _avtEd = { tiles: null, w: 60, h: 40, acao: 'piso', painting: false, salaStart: null };

function _avtEditorTamanho(val) {
  const [w, h] = val.split('x').map(Number);
  _avtEd.w = w; _avtEd.h = h;
  _avtEd.tiles = null;
  _avtEditorInit();
}

function _avtEditorInit() {
  const EDSZ = 14, W = _avtEd.w, H = _avtEd.h;
  if (!_avtEd.tiles) _avtEditorReset();
  const canvas = document.getElementById('avt-ed-canvas');
  if (!canvas) return;
  canvas.width  = W * EDSZ;
  canvas.height = H * EDSZ;
  canvas.style.width  = (W * EDSZ) + 'px';
  canvas.style.height = (H * EDSZ) + 'px';
  _avtEditorRenderCanvas();

  const getTile = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W * EDSZ / rect.width;
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { tx: Math.floor(cx * scaleX / EDSZ), ty: Math.floor(cy * scaleX / EDSZ) };
  };

  const paint = (e) => {
    if (!_avtEd.painting) return;
    const {tx, ty} = getTile(e);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return;
    if (_avtEd.acao === 'sala' && _avtEd.salaStart) {
      // Preview only — fill on mouseup
    } else {
      _avtEd.tiles[ty][tx] = _avtEd.acao === 'parede' ? AVT_T.PAREDE : AVT_T.PISO;
    }
    _avtEditorRenderCanvas();
    AVT_STATE._criando.mapa = _avtEditorExport();
  };

  canvas.onmousedown = canvas.ontouchstart = (e) => {
    e.preventDefault(); _avtEd.painting = true;
    if (_avtEd.acao === 'sala') { _avtEd.salaStart = getTile(e); return; }
    paint(e);
  };
  canvas.onmousemove = canvas.ontouchmove = (e) => { e.preventDefault(); paint(e); };
  canvas.onmouseup = canvas.ontouchend = (e) => {
    if (_avtEd.acao === 'sala' && _avtEd.salaStart) {
      const {tx, ty} = getTile(e);
      const x0=Math.min(_avtEd.salaStart.tx,tx), y0=Math.min(_avtEd.salaStart.ty,ty);
      const x1=Math.max(_avtEd.salaStart.tx,tx), y1=Math.max(_avtEd.salaStart.ty,ty);
      for (let y=y0; y<=y1; y++) for (let x=x0; x<=x1; x++) _avtEd.tiles[y][x] = AVT_T.PISO;
      _avtEd.salaStart = null;
    }
    _avtEd.painting = false;
    _avtEditorRenderCanvas();
    AVT_STATE._criando.mapa = _avtEditorExport();
  };
  document.onmouseup = () => { _avtEd.painting = false; };
}

function _avtEditorReset() {
  _avtEd.tiles = _avtGerarDungeon(_avtEd.w, _avtEd.h).tiles;
  _avtEditorRenderCanvas();
  AVT_STATE._criando.mapa = _avtEditorExport();
}

function _avtEditorLimpar() {
  _avtEd.tiles = Array.from({length: _avtEd.h}, () => Array(_avtEd.w).fill(AVT_T.PAREDE));
  _avtEditorRenderCanvas();
  AVT_STATE._criando.mapa = _avtEditorExport();
}

function _avtEditorAcaoSet(acao) {
  _avtEd.acao = acao;
  ['piso','parede','sala'].forEach(a => {
    const btn = document.getElementById(`avt-ed-btn-${a}`);
    if (btn) btn.classList.toggle('avt-ed-btn-ativo', a === acao);
  });
}

function _avtEditorRenderCanvas() {
  const canvas = document.getElementById('avt-ed-canvas');
  if (!canvas || !_avtEd.tiles) return;
  const ctx = canvas.getContext('2d');
  const EDSZ = 14, W = _avtEd.w, H = _avtEd.h;
  ctx.fillStyle = '#050810';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      ctx.fillStyle = _avtEd.tiles[y][x] === AVT_T.PISO ? '#1a2535' : '#0a0c14';
      ctx.fillRect(x*EDSZ, y*EDSZ, EDSZ, EDSZ);
      ctx.strokeStyle = 'rgba(79,163,209,0.06)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x*EDSZ+0.5, y*EDSZ+0.5, EDSZ-1, EDSZ-1);
    }
  }
}

function _avtEditorExport() {
  const rooms = [];
  return { tiles: _avtEd.tiles, w: _avtEd.w, h: _avtEd.h, rooms, inimigos: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON IMPORT
// ─────────────────────────────────────────────────────────────────────────────

function _avtGetGridParams(prefixo) {
  const sel = document.getElementById(prefixo + '-tamanho');
  const [w, h] = (sel?.value || '60x40').split('x').map(Number);
  const salas = parseInt(document.getElementById(prefixo + '-salas')?.value || '10', 10);
  return { w: w||60, h: h||40, salas: Math.min(50, Math.max(1, salas||10)) };
}

function _avtGerarPromptJson(opts) {
  const w = opts?.w || 60, h = opts?.h || 40, salas = opts?.salas || 10;
  return `Gere um mapa de dungeon para um RPG top-down. Retorne APENAS o JSON, sem texto adicional.

PARÂMETROS:
- Grid: ${w} colunas × ${h} linhas
- Número de salas: ${salas} (interligadas por corredores)
- tiles: 0 = parede, 1 = piso

FORMATO OBRIGATÓRIO:
{
  "largura": ${w},
  "altura": ${h},
  "tiles": [
    [0,0,1,1,...],   ← linha 0, ${w} valores
    ...              ← total de ${h} linhas
  ],
  "salas": [
    {"id":"sala_1","x":2,"y":2,"w":8,"h":6,"tipo":"entrada","descricao":"Salão de entrada com tochas"},
    {"id":"sala_boss","x":50,"y":30,"w":10,"h":8,"tipo":"chefe","descricao":"Câmara do chefe guardada por dois sentinelas"}
  ],
  "inimigos": [
    {"x":12,"y":8,"hp":20,"cor":"#7a3300","sala_id":"sala_2"},
    {"x":35,"y":20,"hp":40,"cor":"#3a1a6a","sala_id":"sala_5"}
  ],
  "skills_sugeridas": [
    {"nome":"Golpe Sombrio","formula_dano":"2d6+5","tipo":"Ataque","efeito_visual":"Sombra","descricao":"Ataque com energia das trevas"},
    {"nome":"Cura das Pedras","formula_dano":"1d8+2","tipo":"Cura","efeito_visual":"Cura","descricao":"Recupera HP ao tocar a rocha sagrada"}
  ],
  "animacoes_sugeridas": [
    {
      "para":"jogadores",
      "animado_data": {
        "parts": { "_full": {"texture":"(SVG inline como data URI — personagem top-down visto de cima)","x":0,"y":0,"width":64,"height":64} },
        "animations": {
          "idle":   {"frames":[{"t":0,"transforms":{"_full":{"x":0,"y":0}}},{"t":500,"transforms":{"_full":{"x":0,"y":-1}}}],"duration":1000,"loop":true},
          "walk":   {"frames":[{"t":0,"transforms":{"_full":{"x":0,"y":0}}},{"t":200,"transforms":{"_full":{"x":0,"y":-3}}}],"duration":400,"loop":true},
          "attack": {"frames":[{"t":0,"transforms":{"_full":{"x":0,"y":0}}},{"t":100,"transforms":{"_full":{"x":4,"y":-2}}}],"duration":300,"loop":false}
        }
      }
    }
  ]
}

REGRAS:
- Posicione inimigos APENAS em tiles de piso (valor 1)
- NÃO invente nomes de inimigos — deixe o campo "nome" ausente (o mestre definirá)
- Cores dos inimigos: use hex que combine com o tipo (ex: undead → tons de cinza/azul, demônios → vermelho escuro)
- Salas com "tipo":"chefe" devem ter inimigos com HP maior (60–120)
- Salas com "tipo":"entrada" NÃO têm inimigos
- Corredores devem conectar TODAS as salas em sequência lógica
- ${salas >= 20 ? 'Para dungeons grandes: distribua salas em clusters temáticos (entrada, desenvolvimento, clímax)' : 'Organize as salas em progressão linear com uma bifurcação opcional'}`;
}

function _avtJsonAtualizarPrompt() {
  // Atualiza o prompt ao mudar salas/tamanho na UI do modo json
}

function _avtCopiarPromptJson() {
  const params = _avtGetGridParams('avt-json');
  const txt = _avtGerarPromptJson(params);
  const copy = () => {
    const ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  };
  navigator.clipboard.writeText(txt).catch(copy);
  const ok = document.getElementById('avt-json-ok');
  if (ok) { ok.style.opacity=1; setTimeout(()=>ok.style.opacity=0,2000); }
}

function _avtJsonParsePreview(txt) {
  const st = document.getElementById('avt-json-status');
  if (!txt.trim()) { if (st) st.textContent=''; return; }
  try {
    const json = JSON.parse(txt);
    const dungeon = _avtJsonToDungeon(json);
    AVT_STATE._criando.mapa = dungeon;
    if (st) st.innerHTML = `<span style="color:#27ae60">✓ Mapa válido — ${dungeon.w}×${dungeon.h} tiles, ${json.inimigos?.length||0} inimigos</span>`;
  } catch(e) {
    AVT_STATE._criando.mapa = null;
    if (st) st.innerHTML = `<span style="color:#e74c3c">✗ JSON inválido: ${e.message}</span>`;
  }
}

function _avtJsonToDungeon(json) {
  if (!json.tiles || !Array.isArray(json.tiles)) throw new Error('tiles ausente');
  const h = json.tiles.length, w = json.tiles[0]?.length || 0;
  if (!w || !h) throw new Error('dimensões inválidas');
  // Normaliza inimigos: remove nome se ausente (mestre definirá)
  const inimigos = (json.inimigos || []).map((ini, i) => ({
    x: ini.x, y: ini.y, hp: ini.hp || 20, cor: ini.cor || '#7a3300',
    nome: ini.nome || null, sala_id: ini.sala_id || null
  }));
  return {
    tiles: json.tiles, w, h,
    rooms: json.salas || [],
    _inimigosJson: inimigos,
    _skillsSugeridas: json.skills_sugeridas || [],
    _animacoesSugeridas: json.animacoes_sugeridas || []
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAUDE API
// ─────────────────────────────────────────────────────────────────────────────

async function _avtGerarComClaude() {
  const key = document.getElementById('avt-claude-key')?.value?.trim() ||
              localStorage.getItem('animgen_claude_key') || '';
  if (!key) { mostrarToast('Insira a Claude API Key', 'aviso'); return; }

  const desc = document.getElementById('avt-claude-desc')?.value?.trim() ||
               'Uma dungeon com inimigos variados';
  const params = _avtGetGridParams('avt-claude');

  const btn = document.getElementById('avt-claude-btn');
  const st  = document.getElementById('avt-claude-status');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Gerando…'; }
  if (st) st.innerHTML = `Gerando dungeon ${params.w}×${params.h} com ${params.salas} salas…`;

  const systemPrompt = `Você é um gerador de mapas de dungeon para jogos RPG top-down.
Retorne APENAS um JSON válido no formato especificado, sem nenhum texto adicional, sem markdown.`;

  const userPrompt = `Gere um mapa de dungeon com a seguinte descrição: "${desc}"

${_avtGerarPromptJson(params)}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Resposta sem JSON válido');

    const json = JSON.parse(match[0]);
    const dungeon = _avtJsonToDungeon(json);
    AVT_STATE._criando.mapa = dungeon;

    localStorage.setItem('animgen_claude_key', key);
    if (st) st.innerHTML = `<span style="color:#27ae60">✓ Mapa gerado — ${dungeon.w}×${dungeon.h} tiles, ${dungeon._inimigosJson?.length||0} inimigos</span>`;
    mostrarToast('✓ Mapa gerado com Claude!', 'sucesso');
  } catch(e) {
    if (st) st.innerHTML = `<span style="color:#e74c3c">✗ Erro: ${e.message}</span>`;
    mostrarToast('Erro Claude API: ' + e.message, 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Gerar mapa'; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT
// ─────────────────────────────────────────────────────────────────────────────

async function aventuraCriarSubmit() {
  const c = AVT_STATE._criando;
  const chars = c.personagens.filter(p => p.nome.trim());
  if (!c.nome) { mostrarToast('Nome é obrigatório', 'aviso'); return; }
  if (!chars.length) { mostrarToast('Adicione ao menos 1 personagem', 'aviso'); return; }
  if (!c.mapaOpcao) { mostrarToast('Escolha como criar o mapa', 'aviso'); return; }
  if ((c.mapaOpcao === 'json' || c.mapaOpcao === 'claude') && !c.mapa) {
    mostrarToast('Gere ou importe o mapa antes de continuar', 'aviso'); return;
  }
  if (c.mapaOpcao === 'fase' && !c.faseId) {
    mostrarToast('Selecione uma fase existente', 'aviso'); return;
  }
  if (c.mapaOpcao === 'ia_fase') {
    if (!c._tilesetImgFile) {
      mostrarToast('Carregue a imagem do tileset', 'aviso'); return;
    }
    if (!c._tilesetConfig?.mapa?.tiles) {
      mostrarToast('Cole o JSON de layout da dungeon (passo 4)', 'aviso'); return;
    }
  }

  const btn = document.getElementById('avt-criar-btn-next');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Criando…'; }

  try {
    const rpgId = c.nome.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,30)
                  + '_avt_' + Date.now().toString(36);

    // Resolve dungeon
    let dungeonData = null;
    let tilesetImgUrl = null;

    if (c.mapaOpcao === 'ia_fase') {
      // Upload tileset image
      if (c._tilesetImgFile) {
        try {
          tilesetImgUrl = await uploadToStorage(c._tilesetImgFile, `aventuras/${rpgId}/tileset`);
        } catch(e) { console.warn('[tileset] upload failed:', e); }
      }
      // Build dungeon from tileset config mapa
      dungeonData = faseTilesetToDungeonData(c._tilesetConfig);
      if (dungeonData) dungeonData.tileset_img_url = tilesetImgUrl || null;
    } else if (c.mapaOpcao === 'procedural' || c.mapa === 'procedural') {
      dungeonData = _avtGerarDungeonProcedural();
    } else if (c.mapa && typeof c.mapa === 'object') {
      dungeonData = c.mapa;
    }
    // 'fase' option: dungeonData stays null — will be loaded from fase render_data

    const themeJson = {
      destaque: c.cor, primario: c.cor2, animation: c.icone,
      is_aventura: true,
      dungeon_data: dungeonData,
      mapa_opcao: c.mapaOpcao,
      fase_id: c.faseId || null
    };

    let regBody = { rpg_id: rpgId, name: c.nome, owner_id: SESSION?.user?.id || null, theme_json: themeJson };
    try {
      await _avtSb('rpg_registry', { method: 'POST', body: JSON.stringify({ ...regBody, is_aventura: true }) });
    } catch(e) {
      await _avtSb('rpg_registry', { method: 'POST', body: JSON.stringify(regBody) });
    }

    if (SESSION?.user?.id) {
      await _avtSb('rpg_members', { method: 'POST', body: JSON.stringify({
        rpg_id: rpgId, player_id: SESSION.user.id,
        nickname: SESSION.nickname || SESSION.user.email || 'aventureiro',
        role: 'mestre', permissoes: {}
      })});
    }

    const cores = ['#4fa3d1','#27ae60','#c8a84b','#7b2fbe','#e8604c'];
    for (let i = 0; i < chars.length; i++) {
      const p = chars[i];
      await _avtSb('characters', { method: 'POST', body: JSON.stringify({
        rpg_id: rpgId, nome: p.nome.trim(), hp_max: p.hp_max || 60, hp_atual: p.hp_max || 60,
        xp: 0, nivel: 1, custom_attrs: { cor: p.cor || cores[i % cores.length], tipo_personagem: 'jogador', classe_aventura: p.classe_aventura || 'guerreiro' }
      })});
    }

    // Import skills from source campaign if available
    if (c._campSkillsToImport?.length) {
      try {
        const newSkills = c._campSkillsToImport.map(sk => ({
          ...sk,
          id: undefined,
          rpg_id: rpgId,
          character_id: undefined // will be re-linked by name if needed
        }));
        await _avtSb('skills', { method: 'POST', body: JSON.stringify(newSkills) });
      } catch(e) { /* non-critical — skills import failed */ }
    }

    mostrarToast(`✦ "${c.nome}" criada!`, 'sucesso');
    HUB_DATA.rpgs = await getAllRPGs() || [];
    renderRPGList(HUB_DATA.rpgs);
    await avtHubRenderSection();
    fecharCriarAventura();
    setTimeout(() => entrarAventura(rpgId), 400);
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = '▶ Iniciar Dungeon!'; }
    mostrarToast('Erro: ' + (e?.message || e), 'erro');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRAR / SAIR  — bug-fixed version
// ─────────────────────────────────────────────────────────────────────────────

async function _avtCarregarAtribuicaoJogador(rpgId) {
  AVT_STATE.myCharNome = null;
  AVT_STATE.membros = [];
  if (!SESSION?.user?.id) return;
  try {
    const membros = await _avtSb(`rpg_members?rpg_id=eq.${encodeURIComponent(rpgId)}&select=player_id,nickname,role,linked`);
    AVT_STATE.membros = membros || [];
    const meu = (membros || []).find(m => m.player_id === SESSION.user.id);
    if (meu?.linked) AVT_STATE.myCharNome = meu.linked;
  } catch(e) {}
}

async function _avtMestreAtribuirJogador(playerId, charNome) {
  try {
    await _avtSb(`rpg_members?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}&player_id=eq.${encodeURIComponent(playerId)}`,
      { method:'PATCH', body:JSON.stringify({ linked: charNome || null }) });
    const m = AVT_STATE.membros.find(x => x.player_id === playerId);
    if (m) m.linked = charNome || null;
    mostrarToast('Personagem atribuído!', 'ok');
    _avtMestrePainelRender();
  } catch(e) { mostrarToast('Erro ao atribuir: ' + (e?.message||e), 'erro'); }
}

async function _avtAdicionarMembro(input) {
  input = (input || '').trim().toLowerCase();
  if (!input) { mostrarToast('Digite o nome de usuário', 'aviso'); return; }
  try {
    let jogador = null;
    if (input.includes('@')) {
      const r = await _avtSb(`players_with_email?email=eq.${encodeURIComponent(input)}&select=id,nickname`);
      jogador = r?.[0] || null;
    } else {
      const r = await _avtSb(`players?nickname=eq.${encodeURIComponent(input)}&select=id,nickname`);
      jogador = r?.[0] || null;
    }
    if (!jogador) { mostrarToast(`Usuário "${input}" não encontrado`, 'erro'); return; }
    const jaExiste = await _avtSb(`rpg_members?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}&player_id=eq.${jogador.id}`);
    if (jaExiste?.length) { mostrarToast(`${jogador.nickname} já é membro`, 'aviso'); return; }
    await _avtSb('rpg_members', {
      method: 'POST',
      body: JSON.stringify({ rpg_id: AVT_STATE.rpgId, player_id: jogador.id, nickname: jogador.nickname, role: 'jogador', permissoes: {} })
    });
    AVT_STATE.membros.push({ player_id: jogador.id, nickname: jogador.nickname, role: 'jogador', linked: null });
    mostrarToast(`${jogador.nickname} adicionado!`, 'ok');
    _avtMestrePainelRender();
  } catch(e) { mostrarToast('Erro ao adicionar: ' + (e?.message||e), 'erro'); }
}

async function _avtRemoverMembro(playerId) {
  const m = AVT_STATE.membros.find(x => x.player_id === playerId);
  const nick = m?.nickname || playerId.slice(0,8);
  if (!confirm(`Remover ${nick} do dungeon?`)) return;
  try {
    await _avtSb(`rpg_members?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}&player_id=eq.${encodeURIComponent(playerId)}`, { method: 'DELETE' });
    AVT_STATE.membros = AVT_STATE.membros.filter(x => x.player_id !== playerId);
    mostrarToast(`${nick} removido`, 'ok');
    _avtMestrePainelRender();
  } catch(e) { mostrarToast('Erro ao remover: ' + (e?.message||e), 'erro'); }
}

async function entrarAventura(rpgId) {
  // Cancel any existing render loop and event listeners before starting
  _avtCleanupListeners();

  mostrarLoading('Carregando dungeon…');
  try {
    const [rpgs, chars, skills, itemCatalog] = await Promise.all([
      _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(rpgId)}&select=*`),
      _avtSb(`characters?rpg_id=eq.${encodeURIComponent(rpgId)}&select=*&order=nome`),
      _avtSb(`skills?rpg_id=eq.${encodeURIComponent(rpgId)}&select=*`),
      _avtSb(`item_catalog?rpg_id=eq.${encodeURIComponent(rpgId)}&select=id,nome,tipo,icone,raridade,img_url,slot_padrao,atributos_bonus&order=id`).catch(()=>[])
    ]);

    AVT_STATE.rpgId      = rpgId;
    AVT_STATE.rpg        = rpgs?.[0] || { rpg_id: rpgId, name: 'Dungeon' };
    _avtDetectarMestre();
    AVT_STATE.chars      = chars || [];
    AVT_STATE.skills     = skills || [];
    AVT_STATE.itemCatalog = itemCatalog || [];
    AVT_STATE.entidades = [];
    AVT_STATE.npcTimers = {};
    AVT_STATE._lastFrameTs = 0;
    AVT_STATE.batalhas = [];

    // Load player assignment (which character this user controls)
    await _avtCarregarAtribuicaoJogador(rpgId);

    // Load or generate dungeon
    const t = AVT_STATE.rpg.theme_json || {};
    if (t.dungeon_data?.tiles) {
      AVT_STATE.dungeon = t.dungeon_data;
    } else {
      AVT_STATE.dungeon = _avtGerarDungeon(60, 40, 8);
    }
    AVT_STATE._tilesetConfig   = AVT_STATE.dungeon.tileset_config  || null;
    AVT_STATE._tilesetImgUrl   = AVT_STATE.dungeon.tileset_img_url || null;
    AVT_STATE._tilesetLoaded   = false;
    AVT_STATE._tilesetTextures = {};
    _avtPopularEntidades();
    _avtCarregarTodasAparencias();

    // Connect realtime for multiplayer sync
    window.CURRENT_RPG = rpgId;
    if (typeof iniciarRealtime === 'function') iniciarRealtime(rpgId);

    // Show screen — must happen BEFORE canvas init
    document.getElementById('hub').style.display = 'none';
    const screen = document.getElementById('aventura-screen');
    if (!screen) throw new Error('Elemento #aventura-screen não encontrado');
    screen.style.display = 'flex';

    // Update header
    document.getElementById('avt-nome').textContent = AVT_STATE.rpg.name;
    document.getElementById('avt-nome').style.color = t.destaque || '#c8a84b';

    // Double-RAF: wait for browser reflow before measuring canvas dimensions
    requestAnimationFrame(() => requestAnimationFrame(() => {
      _avtCanvasInit();
      _avtRenderLoop();
      _avtRenderHpBar();
      ocultarLoading();
      if (AVT_STATE._tilesetConfig && AVT_STATE._tilesetImgUrl) {
        _avtCarregarTileset(AVT_STATE._tilesetImgUrl, AVT_STATE._tilesetConfig)
          .catch(e => console.warn('[tileset] load failed:', e));
      }
    }));

    salvarNav('rpg', rpgId);
  } catch(e) {
    ocultarLoading();
    mostrarToast('Erro ao carregar dungeon: ' + (e?.message || e), 'erro');
    // Ensure hub is visible on error
    const screen = document.getElementById('aventura-screen');
    if (screen) screen.style.display = 'none';
    document.getElementById('hub').style.display = 'block';
  }
}

function sairAventura() {
  _avtCleanupListeners();
  const screen = document.getElementById('aventura-screen');
  if (screen) screen.style.display = 'none';
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
}

function _avtCleanupListeners() {
  if (AVT_STATE.animFrame) { cancelAnimationFrame(AVT_STATE.animFrame); AVT_STATE.animFrame = null; }
  window.removeEventListener('resize', _avtCanvasResize);
  window.removeEventListener('keydown', _avtCanvasKey);
  (AVT_STATE._pendingTimeouts || []).forEach(id => clearTimeout(id));
  AVT_STATE._pendingTimeouts = [];
  if (AVT_STATE._resizeObs) { AVT_STATE._resizeObs.disconnect(); AVT_STATE._resizeObs = null; }
  avtDpadStop();
}

function _avtSetTimeout(fn, ms) {
  const id = setTimeout(fn, ms);
  AVT_STATE._pendingTimeouts.push(id);
  return id;
}

// ─────────────────────────────────────────────────────────────────────────────
// DUNGEON GENERATION
// ─────────────────────────────────────────────────────────────────────────────

function _avtGerarDungeon(w, h, maxRooms) {
  maxRooms = maxRooms || 8;
  const tiles = Array.from({length: h}, () => Array(w).fill(AVT_T.PAREDE));
  const rooms = [];

  const _carveRoom = (rx, ry, rw, rh) => {
    for (let y = ry; y < ry + rh; y++)
      for (let x = rx; x < rx + rw; x++)
        if (y > 0 && y < h-1 && x > 0 && x < w-1) tiles[y][x] = AVT_T.PISO;
  };
  const _overlaps = (rx, ry, rw, rh) =>
    rooms.some(r => rx < r.x+r.w+2 && rx+rw+2 > r.x && ry < r.y+r.h+2 && ry+rh+2 > r.y);

  // Mais tentativas para dungeons maiores
  const maxAttempts = maxRooms * 20;
  for (let attempt = 0; attempt < maxAttempts && rooms.length < maxRooms; attempt++) {
    const rw = 4 + Math.floor(Math.random() * 7);
    const rh = 3 + Math.floor(Math.random() * 6);
    if (rw >= w - 2 || rh >= h - 2) continue;
    const rx = 1 + Math.floor(Math.random() * (w - rw - 2));
    const ry = 1 + Math.floor(Math.random() * (h - rh - 2));
    if (_overlaps(rx, ry, rw, rh)) continue;
    _carveRoom(rx, ry, rw, rh);
    rooms.push({ x:rx, y:ry, w:rw, h:rh, cx:Math.floor(rx+rw/2), cy:Math.floor(ry+rh/2) });
  }

  // Conectar todas as salas com corredores em L
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i-1], b = rooms[i];
    for (let x = Math.min(a.cx,b.cx); x <= Math.max(a.cx,b.cx); x++)
      if (tiles[a.cy]?.[x] !== undefined) tiles[a.cy][x] = AVT_T.PISO;
    for (let y = Math.min(a.cy,b.cy); y <= Math.max(a.cy,b.cy); y++)
      if (tiles[y]?.[b.cx] !== undefined) tiles[y][b.cx] = AVT_T.PISO;
  }

  return { tiles, w, h, rooms };
}

function _avtGerarDungeonProcedural() {
  const salas = AVT_STATE._criando?._procSalas || 8;
  // Grid cresce proporcionalmente ao número de salas
  const area = Math.max(22*16, salas * 60);
  const w = Math.round(Math.sqrt(area * 1.4));
  const h = Math.round(area / w);
  return _avtGerarDungeon(w, h, salas);
}

function _avtPopularEntidades() {
  const d = AVT_STATE.dungeon;
  AVT_STATE.entidades = [];
  AVT_STATE.npcTimers = {};
  if (!d || !d.rooms?.length && !d.tiles) return;

  const rooms = d.rooms?.length ? d.rooms : _avtDetectarSalas(d);
  const cores = ['#4fa3d1','#27ae60','#c8a84b','#7b2fbe','#e8604c'];

  // Spawn explícito do tileset, ou primeiro tile passável da primeira sala
  const spawns = d._spawnJogadores?.length ? d._spawnJogadores : null;
  const primRoom = rooms[0];

  AVT_STATE.chars.filter(c => c.custom_attrs?.tipo_personagem !== 'npc').forEach((c, i) => {
    const col = c.custom_attrs?.cor || cores[i % cores.length];
    const ca  = c.custom_attrs || {};
    const sp  = spawns?.[i] || spawns?.[0];
    // Priority: saved position → tileset spawn → room fallback
    const sx = typeof ca.avt_x === 'number' ? ca.avt_x
             : sp ? sp.x + (i % 3) : (primRoom?.x||1) + 1 + (i % 3);
    const sy = typeof ca.avt_y === 'number' ? ca.avt_y
             : sp ? sp.y + Math.floor(i/3) : (primRoom?.y||1) + 1 + Math.floor(i/3);
    AVT_STATE.entidades.push({
      id: c.id || c.nome, nome: c.nome, tipo: 'jogador',
      x: sx, y: sy,
      hp: c.hp_atual || c.hp_max || 60, hpMax: c.hp_max || 60, cor: col, dbId: c.id
    });
  });

  const _initNpcTimer = (ent) => {
    AVT_STATE.npcTimers[ent.id] = {
      patience: ent.pacienciaSecs * 1000,
      maxPatience: ent.pacienciaSecs * 1000,
      ativo: false
    };
  };

  // Enemies from JSON import or procedural placement
  const inimigosJson = d._inimigosJson || [];
  if (inimigosJson.length) {
    inimigosJson.forEach((ini, i) => {
      const ent = {
        id: 'ini_' + i, nome: ini.nome || `Inimigo ${i+1}`, tipo: 'inimigo',
        x: ini.x, y: ini.y, hp: ini.hp || 20, hpMax: ini.hp || 20,
        cor: ini.cor || '#7a5c00', _semNome: !ini.nome,
        pacienciaSecs: ini.pacienciaSecs ?? 5,
        deteccaoRaio: ini.deteccaoRaio ?? 3,
        isBoss: ini.isBoss || false
      };
      AVT_STATE.entidades.push(ent);
      _initNpcTimer(ent);
    });
  } else {
    // Sem dados de IA: posiciona inimigos genéricos em cada sala (exceto a primeira)
    let uid = 0;
    const presetKeys = Object.keys(AVT_NPC_PRESETS).filter(k => k !== 'boss');
    for (let i = 1; i < rooms.length; i++) {
      const r = rooms[i];
      const count = 1 + Math.floor(Math.random() * Math.min(3, Math.floor(r.w * r.h / 8)));
      for (let j = 0; j < count; j++) {
        const preset = AVT_NPC_PRESETS[presetKeys[uid % presetKeys.length]];
        const ent = {
          id: 'ini_' + uid, nome: `${preset.nome} ${uid+1}`, tipo: 'inimigo',
          x: r.x + 1 + (j % Math.max(1, r.w - 2)),
          y: r.y + 1 + Math.floor(j / Math.max(1, r.w - 2)),
          hp: preset.hpBase, hpMax: preset.hpBase,
          cor: preset.cor, icone: preset.icone, _semNome: true,
          pacienciaSecs: preset.pacienciaSecs,
          deteccaoRaio: preset.deteccaoRaio,
          isBoss: false
        };
        AVT_STATE.entidades.push(ent);
        _initNpcTimer(ent);
        uid++;
      }
    }
  }
}

function _avtDetectarSalas(d) {
  // Simple fallback: find first and last piso tile as "room centers"
  const piso = [];
  for (let y = 0; y < d.h; y++)
    for (let x = 0; x < d.w; x++)
      if (_avtTilePassavel(x, y, d)) piso.push({x,y});
  if (!piso.length) return [{x:1,y:1,w:3,h:3,cx:2,cy:2}];
  const mid = Math.floor(piso.length / 2);
  return [
    { x:piso[0].x, y:piso[0].y, w:3, h:3, cx:piso[0].x, cy:piso[0].y },
    { x:piso[mid].x, y:piso[mid].y, w:3, h:3, cx:piso[mid].x, cy:piso[mid].y }
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS RENDERING — bug-fixed
// ─────────────────────────────────────────────────────────────────────────────

function _avtCanvasInit() {
  const wrap = document.getElementById('avt-mapa-wrap');
  if (!wrap) return;

  // Destroy old canvas
  const old = document.getElementById('avt-canvas');
  if (old) { old.onclick = null; old.remove(); }
  wrap.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.id = 'avt-canvas';
  canvas.style.cssText = 'display:block;cursor:pointer;image-rendering:pixelated;position:absolute;inset:0';
  wrap.appendChild(canvas);

  // Re-add D-pad inside wrap so it stays on top of canvas
  const dpad = document.getElementById('avt-dpad');
  if (dpad) wrap.appendChild(dpad);

  AVT_STATE.canvas = canvas;

  // ResizeObserver for reliable dimensions
  AVT_STATE._resizeObs = new ResizeObserver(() => _avtCanvasResize());
  AVT_STATE._resizeObs.observe(wrap);

  _avtCanvasResize();
  canvas.addEventListener('click', _avtCanvasClick);
  canvas.addEventListener('dblclick', _avtCanvasDblClick);
  window.addEventListener('resize', _avtCanvasResize);
  window.addEventListener('keydown', _avtCanvasKey);

  // Auto-show D-pad on mobile
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (dpad) dpad.style.display = isMobile ? 'block' : 'none';
  const dpadBtn = document.getElementById('avt-btn-dpad');
  if (dpadBtn) dpadBtn.style.display = isMobile ? 'inline-block' : 'none';

  _avtCameraCenter();
}

function _avtCanvasResize() {
  const wrap = document.getElementById('avt-mapa-wrap');
  const canvas = AVT_STATE.canvas;
  if (!wrap || !canvas) return;
  const w = wrap.clientWidth  || window.innerWidth;
  const h = wrap.clientHeight || (window.innerHeight - 130);
  if (w > 0 && h > 0) {
    canvas.width  = w;
    canvas.height = h;
    AVT_STATE.ctx = canvas.getContext('2d');
    _avtCameraCenter();
  }
}

// Centers camera on group centroid — use only for init/reset, not during movement
function _avtCameraCenter() {
  const jogadores = AVT_STATE.entidades.filter(e => e.tipo === 'jogador');
  const canvas = AVT_STATE.canvas;
  if (!jogadores.length || !canvas || !canvas.width) return;
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera.zoom || 1));
  const cx = jogadores.reduce((s, j) => s + j.x, 0) / jogadores.length;
  const cy = jogadores.reduce((s, j) => s + j.y, 0) / jogadores.length;
  AVT_STATE.camera.x = cx * SZ - canvas.width/2  + SZ/2;
  AVT_STATE.camera.y = cy * SZ - canvas.height/2 + SZ/2;
}

// Edge-triggered camera: follows only the controlled player to avoid cross-axis drift
function _avtCameraUpdate() {
  const canvas = AVT_STATE.canvas;
  if (!canvas?.width) return;
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera.zoom || 1));
  const MARGIN = 0.20;
  const mW = canvas.width  * MARGIN;
  const mH = canvas.height * MARGIN;

  const j = _avtMeuJogador() || AVT_STATE.entidades.find(e => e.tipo === 'jogador' && e.hp > 0);
  if (!j) return;

  const px = j.x * SZ - AVT_STATE.camera.x;
  const py = j.y * SZ - AVT_STATE.camera.y;
  let shiftX = 0, shiftY = 0;
  if (px < mW)                 shiftX = px - mW;
  if (px > canvas.width - mW)  shiftX = px - (canvas.width - mW);
  if (py < mH)                 shiftY = py - mH;
  if (py > canvas.height - mH) shiftY = py - (canvas.height - mH);
  AVT_STATE.camera.x = Math.round(AVT_STATE.camera.x + shiftX);
  AVT_STATE.camera.y = Math.round(AVT_STATE.camera.y + shiftY);
}

function _avtRenderLoop() {
  if (AVT_STATE.animFrame) cancelAnimationFrame(AVT_STATE.animFrame);
  const frame = () => {
    if (!AVT_STATE.canvas) return; // safety
    _avtRenderFrame();
    AVT_STATE.animFrame = requestAnimationFrame(frame);
  };
  AVT_STATE.animFrame = requestAnimationFrame(frame);
}

function _avtRenderFrame() {
  const { canvas, ctx, dungeon, entidades, camera } = AVT_STATE;
  if (!ctx || !dungeon || !canvas.width) return;

  // Track delta time for patience timers
  const now = performance.now();
  const dt = AVT_STATE._lastFrameTs ? now - AVT_STATE._lastFrameTs : 0;
  AVT_STATE._lastFrameTs = now;

  // Update patience timers (only for enemies not already in a combat)
  _avtAtualizarPaciencias(dt);

  const SZ = Math.round(AVT_SZ * (camera.zoom || 1));

  ctx.fillStyle = '#050810';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < dungeon.h; y++) {
    for (let x = 0; x < dungeon.w; x++) {
      const t  = dungeon.tiles[y]?.[x];
      const px = Math.round(x * SZ - camera.x);
      const py = Math.round(y * SZ - camera.y);
      if (px + SZ < 0 || px > canvas.width || py + SZ < 0 || py > canvas.height) continue;
      if (AVT_STATE._tilesetLoaded) {
        ctx.imageSmoothingEnabled = false;
        // String-key grid (ia_fase): usa a chave diretamente
        // Binary grid (outros modos): usa autotile por vizinhos
        const key = typeof t === 'string' ? t : _avtGetTileSemanticKey(x, y, dungeon);
        const tileImg = key ? AVT_STATE._tilesetTextures[key] : null;
        if (tileImg) { ctx.drawImage(tileImg, px, py, SZ, SZ); continue; }
        if (t === null || t === undefined) continue; // void — fundo já foi preenchido
        ctx.fillStyle = _avtTilePassavel(x, y, dungeon) ? '#101520' : '#0a0c14';
        ctx.fillRect(px, py, SZ, SZ);
      } else if (t === AVT_T.SAIDA) {
        ctx.fillStyle = '#101520';
        ctx.fillRect(px, py, SZ, SZ);
        // Pulsing exit indicator (static glow)
        ctx.fillStyle = 'rgba(79,220,140,0.18)';
        ctx.fillRect(px+2, py+2, SZ-4, SZ-4);
        ctx.strokeStyle = 'rgba(79,220,140,0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(px+2, py+2, SZ-4, SZ-4);
        ctx.fillStyle = 'rgba(79,220,140,0.8)';
        ctx.font = `${Math.round(SZ*0.55)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚪', px + SZ/2, py + SZ/2);
      } else if (t === AVT_T.PISO || (typeof t === 'string' && _avtTilePassavel(x, y, dungeon))) {
        ctx.fillStyle = '#101520';
        ctx.fillRect(px, py, SZ, SZ);
        ctx.strokeStyle = 'rgba(79,163,209,0.07)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px+0.5, py+0.5, SZ-1, SZ-1);
      } else {
        ctx.fillStyle = '#0a0c14';
        ctx.fillRect(px, py, SZ, SZ);
        ctx.fillStyle = 'rgba(79,163,209,0.04)';
        ctx.fillRect(px, py, SZ, 3);
        ctx.fillRect(px, py, 3, SZ);
      }
    }
  }

  const _minhaBat = _avtMinhaBatalha();
  if (_minhaBat?.moverModo) {
    const ativo = _avtAtivo();
    if (ativo) {
      _avtBFS(ativo.x, ativo.y, 3).forEach(pos => {
        ctx.fillStyle = 'rgba(79,163,209,0.2)';
        ctx.fillRect(Math.round(pos.x*SZ-camera.x), Math.round(pos.y*SZ-camera.y), SZ, SZ);
      });
    }
  }

  // Highlight entity being repositioned by master
  if (AVT_STATE.mestreReposicionando) {
    const re = entidades.find(e => e.id === AVT_STATE.mestreReposicionando);
    if (re) {
      ctx.strokeStyle = 'rgba(255,200,50,0.9)';
      ctx.lineWidth = 3;
      ctx.setLineDash([5,3]);
      ctx.strokeRect(Math.round(re.x*SZ-camera.x)+2, Math.round(re.y*SZ-camera.y)+2, SZ-4, SZ-4);
      ctx.setLineDash([]);
    }
  }

  entidades.forEach(e => {
    if (e.escondido) return; // NPCs mortos não aparecem no mapa
    const px = Math.round(e.x * SZ - camera.x);
    const py = Math.round(e.y * SZ - camera.y);
    if (px+SZ<0 || px>canvas.width || py+SZ<0 || py>canvas.height) return;

    const isBoss = e.isBoss === true;
    const rBase = Math.floor(SZ * 0.36);
    const r = isBoss ? Math.floor(rBase * 1.4) : rBase;
    const cx = px + SZ/2, cy = py + SZ/2;

    // Atualizar estado de animação (detectar movimento)
    _avtAnimAtualizar(e);

    // Sombra
    ctx.beginPath();
    ctx.ellipse(cx, cy+r+2, r-2, 4, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // Detection radius outline for enemies when patience active (only if not in combat)
    if (e.tipo === 'inimigo' && !_avtBatalhaDeEnt(e.id)) {
      const timer = AVT_STATE.npcTimers[e.id];
      if (timer?.ativo) {
        // Patience ring (outer)
        const pct = timer.patience / timer.maxPatience;
        const rPat = r + 7;
        ctx.beginPath(); ctx.arc(cx, cy, rPat, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, rPat, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct);
        ctx.strokeStyle = pct > 0.5 ? '#f39c12' : '#e74c3c';
        ctx.lineWidth = 2.5; ctx.stroke();
      }
    }

    // Sprite animado se disponível, senão fallback círculo+ícone/letra
    const ap = AVT_STATE.aparencias[e.id];
    if (ap && ap.loaded) {
      _avtDesenharAparencia(ctx, e, cx, cy, SZ, ap);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.fillStyle = e.cor;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI*2);
      if (isBoss) {
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = e.tipo==='inimigo' ? 'rgba(232,96,76,0.6)' : 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
      }
      ctx.stroke();
      ctx.fillStyle = '#fff';
      const icone = e.icone || e.nome[0]?.toUpperCase() || '?';
      const fontSize = icone.length === 1 ? Math.floor(SZ * (isBoss ? 0.38 : 0.28)) : Math.floor(SZ * 0.26);
      ctx.font = `bold ${fontSize}px Cinzel,serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icone, cx, cy);
    }

    // Anel de HP por cima
    const hpPct = e.hp / e.hpMax;
    ctx.beginPath();
    ctx.arc(cx, cy, r+2, -Math.PI/2, -Math.PI/2 + Math.PI*2*hpPct);
    ctx.strokeStyle = hpPct > 0.5 ? '#27ae60' : hpPct > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Equipped weapon icon overlay (bottom-right corner)
    const dbCharForEquip = AVT_STATE.chars.find(c=>c.id===e.dbId||c.nome===e.nome);
    const equippedWeapon = dbCharForEquip?.custom_attrs?.equipamento?.arma_principal;
    if (equippedWeapon && typeof equippedWeapon === 'object' && equippedWeapon.img_url) {
      const iconSz = Math.round(SZ * 0.38);
      const iconX = cx + r * 0.55, iconY = cy + r * 0.55;
      const cached = AVT_STATE.aparencias[e.id + '_weapon'];
      if (cached?.img?.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(iconX, iconY, iconSz/2 + 1, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(10,12,20,0.85)';
        ctx.fill();
        ctx.drawImage(cached.img, iconX - iconSz/2, iconY - iconSz/2, iconSz, iconSz);
        ctx.restore();
      } else if (!cached) {
        const img = new Image();
        img.onload = () => {};
        img.src = equippedWeapon.img_url;
        AVT_STATE.aparencias[e.id + '_weapon'] = { img };
      }
    }

    // Contorno de turno ativo (in any active combat)
    if (AVT_STATE.batalhas.some(b => b.iniciativa[b.turnoIdx]?.id === e.id)) {
      ctx.beginPath();
      ctx.arc(cx, cy, r+5, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(200,168,75,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4,4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Meu personagem: destaque sutil
    if (e.nome === AVT_STATE.myCharNome) {
      ctx.beginPath();
      ctx.arc(cx, cy, r+4, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(79,163,209,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3,3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // HP numérico
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `${Math.floor(SZ*0.2)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${e.hp}`, cx, cy+r+9);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// APARÊNCIA ANIMADA — carregamento + render no canvas (idle/walk/attack)
// ─────────────────────────────────────────────────────────────────────────────

function _avtCarregarTodasAparencias() {
  (AVT_STATE.entidades || []).forEach(ent => _avtCarregarAparencia(ent));
}

function _avtCarregarAparencia(ent) {
  if (!ent) return;
  const dbChar = AVT_STATE.chars.find(c => c.id === ent.dbId || c.nome === ent.nome);
  const data   = dbChar?.custom_attrs?.animado_data;
  if (!data || !data.parts) return;

  const partImgs = {};
  const keys = Object.keys(data.parts);
  let pending = keys.length;
  const rec = { parts: data.parts, animations: data.animations || {}, partImgs, loaded: false };
  AVT_STATE.aparencias[ent.id] = rec;
  AVT_STATE.entAnim[ent.id] = {
    state: 'idle', stateStart: performance.now(),
    lastX: ent.x, lastY: ent.y,
    walkUntil: 0, attackUntil: 0, facing: 1
  };

  if (!pending) { rec.loaded = true; return; }
  keys.forEach(k => {
    const part = data.parts[k];
    if (!part?.texture) { pending--; if (!pending) rec.loaded = true; return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => { partImgs[k] = img; if (--pending <= 0) rec.loaded = true; };
    img.onerror = () => { if (--pending <= 0) rec.loaded = Object.keys(partImgs).length > 0; };
    img.src = part.texture;
  });
}

function _avtSetEntState(entId, state) {
  const a = AVT_STATE.entAnim[entId];
  if (!a) return;
  const ap = AVT_STATE.aparencias[entId];
  const now = performance.now();
  if (state === 'attack') {
    const dur = ap?.animations?.attack?.duration || 400;
    a.attackUntil = now + dur;
    a.state = 'attack';
    a.stateStart = now;
  } else if (state === 'walk') {
    const dur = ap?.animations?.walk?.duration || 600;
    a.walkUntil = now + Math.max(180, dur * 0.6);
    if (a.state !== 'walk' && a.state !== 'attack') { a.state = 'walk'; a.stateStart = now; }
  } else {
    a.state = 'idle'; a.stateStart = now;
  }
}

function _avtAnimAtualizar(ent) {
  let a = AVT_STATE.entAnim[ent.id];
  if (!a) {
    a = AVT_STATE.entAnim[ent.id] = {
      state: 'idle', stateStart: performance.now(),
      lastX: ent.x, lastY: ent.y, walkUntil: 0, attackUntil: 0, facing: 1
    };
  }
  const now = performance.now();
  if (ent.x !== a.lastX || ent.y !== a.lastY) {
    if (ent.x !== a.lastX) a.facing = ent.x > a.lastX ? 1 : -1;
    a.lastX = ent.x; a.lastY = ent.y;
    _avtSetEntState(ent.id, 'walk');
  }
  // Resolver estado atual
  if (now < a.attackUntil) {
    if (a.state !== 'attack') { a.state = 'attack'; a.stateStart = now - (now - a.attackUntil + (AVT_STATE.aparencias[ent.id]?.animations?.attack?.duration || 400)); }
  } else if (now < a.walkUntil) {
    if (a.state !== 'walk') { a.state = 'walk'; a.stateStart = now; }
  } else {
    if (a.state !== 'idle') { a.state = 'idle'; a.stateStart = now; }
  }
}

function _avtInterp(a, b, t) { return a + (b - a) * t; }

function _avtFrameTransform(anim, partKey, tMs) {
  // Retorna {x,y,scaleX,scaleY,rotation} interpolado entre keyframes
  const frames = anim?.frames || [];
  if (!frames.length) return { x:0, y:0, scaleX:1, scaleY:1, rotation:0 };
  const dur = anim.duration || frames[frames.length-1].t || 1000;
  let t = tMs;
  if (anim.loop !== false) t = ((t % dur) + dur) % dur;
  else t = Math.min(t, dur);

  // Pegar transforms da parte específica ou _full
  const getT = (f) => f.transforms?.[partKey] || f.transforms?._full || {};
  let prev = frames[0], next = frames[frames.length-1];
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].t <= t) prev = frames[i];
    if (frames[i].t >= t) { next = frames[i]; break; }
  }
  const span = Math.max(1, (next.t - prev.t));
  const k = next === prev ? 0 : (t - prev.t) / span;
  const pT = getT(prev), nT = getT(next);
  return {
    x:        _avtInterp(pT.x        ?? 0, nT.x        ?? 0, k),
    y:        _avtInterp(pT.y        ?? 0, nT.y        ?? 0, k),
    scaleX:   _avtInterp(pT.scaleX   ?? 1, nT.scaleX   ?? 1, k),
    scaleY:   _avtInterp(pT.scaleY   ?? 1, nT.scaleY   ?? 1, k),
    rotation: _avtInterp(pT.rotation ?? 0, nT.rotation ?? 0, k)
  };
}

function _avtDesenharAparencia(ctx, ent, cx, cy, SZ, ap) {
  const a = AVT_STATE.entAnim[ent.id];
  const anim = ap.animations?.[a?.state] || ap.animations?.idle;
  const tMs = a ? (performance.now() - a.stateStart) : 0;

  // Caixa-alvo do sprite — proporcional ao tile
  const targetH = Math.round(SZ * 0.95);

  ctx.save();
  ctx.translate(cx, cy);
  if (a && a.facing < 0) ctx.scale(-1, 1);

  // Renderiza cada parte (ordem do objeto)
  const partKeys = Object.keys(ap.parts);
  for (const k of partKeys) {
    const part = ap.parts[k];
    const img  = ap.partImgs[k];
    if (!img) continue;
    const tr = _avtFrameTransform(anim, k, tMs);

    const pW = part.width  || img.naturalWidth  || 64;
    const pH = part.height || img.naturalHeight || 64;
    const scale = targetH / pH;

    const drawW = pW * scale * (tr.scaleX || 1);
    const drawH = pH * scale * (tr.scaleY || 1);
    const ox = ((part.x || 0) + (tr.x || 0)) * scale;
    const oy = ((part.y || 0) + (tr.y || 0)) * scale;

    ctx.save();
    ctx.translate(ox, oy);
    if (tr.rotation) ctx.rotate(tr.rotation);
    try {
      ctx.drawImage(img, -drawW/2, -drawH/2, drawW, drawH);
    } catch(e) { /* ignore broken frame */ }
    ctx.restore();
  }
  ctx.restore();
}

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
      const nx=cur.x+dx, ny=cur.y+dy, key=`${nx},${ny}`;
      if (visited.has(key)) return;
      if (!_avtTilePassavel(nx, ny, AVT_STATE.dungeon)) return;
      visited.set(key, true);
      queue.push({x:nx, y:ny, dist:cur.dist+1});
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT — keyboard (desktop) + click
// ─────────────────────────────────────────────────────────────────────────────

function _avtCanvasClick(e) {
  const canvas = AVT_STATE.canvas;
  const rect = canvas.getBoundingClientRect();
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera.zoom || 1));
  const tileX = Math.floor((e.clientX - rect.left + AVT_STATE.camera.x) / SZ);
  const tileY = Math.floor((e.clientY - rect.top  + AVT_STATE.camera.y) / SZ);

  // Door placement mode for nova fase wizard
  if (AVT_STATE._modoPortaPlacement) {
    AVT_STATE._modoPortaPlacement = false;
    canvas.style.cursor = '';
    if (AVT_STATE._novaFaseWizard) {
      AVT_STATE._novaFaseWizard.porta_col = tileX;
      AVT_STATE._novaFaseWizard.porta_row = tileY;
    }
    _avtMestreNovaFaseRender();
    mostrarToast(`Porta definida em (${tileX}, ${tileY})`, 'ok');
    return;
  }

  const ent = AVT_STATE.entidades.find(e => e.x===tileX && e.y===tileY);

  // Master reposition mode: move selected entity to clicked tile
  if (AVT_STATE.mestreReposicionando) {
    const re = AVT_STATE.entidades.find(e => e.id === AVT_STATE.mestreReposicionando);
    if (re && _avtTilePassavel(tileX, tileY, AVT_STATE.dungeon)) {
      re.x = tileX; re.y = tileY;
      AVT_STATE.batalhas.forEach(b => {
        const bi = b.iniciativa.find(ei => ei.id === re.id);
        if (bi) { bi.x = tileX; bi.y = tileY; }
      });
      realtimeBroadcast('avt_token_move', { nome: re.nome, x: re.x, y: re.y });
      _avtDebounceSalvarPosicao(re);
      mostrarToast(`${re.nome} reposicionado`, 'ok');
    }
    AVT_STATE.mestreReposicionando = null;
    return;
  }

  const minhaBat = _avtMinhaBatalha();
  if (minhaBat) {
    if (minhaBat.moverModo) {
      const ativo = _avtAtivo();
      const isMestreCtrl = AVT_STATE.npcControlando && ativo?.id === AVT_STATE.npcControlando;
      if (ativo?.tipo === 'jogador' || isMestreCtrl) {
        const reachable = _avtBFS(ativo.x, ativo.y, 3);
        if (reachable.some(p => p.x===tileX && p.y===tileY)) {
          ativo.x = tileX; ativo.y = tileY;
          const entAtivo = AVT_STATE.entidades.find(e=>e.id===ativo.id);
          if (entAtivo) { entAtivo.x = tileX; entAtivo.y = tileY; }
          minhaBat.moverModo = false;
          _avtLog(`${ativo.nome} move para (${tileX},${tileY})`, minhaBat.id);
          _avtCheckAbandonoCombate(ativo, minhaBat);
          _avtHudUpdate(); _avtCameraUpdate();
        }
      }
    } else if (ent?.tipo === 'inimigo') {
      const sel = document.getElementById('avt-hud-alvo');
      if (sel) sel.value = ent.id;
    }
  } else if (!ent || ent.tipo !== 'inimigo') {
    const jogador = _avtMeuJogador();
    if (jogador && _avtTilePassavel(tileX, tileY, AVT_STATE.dungeon)) {
      jogador.x = tileX; jogador.y = tileY;
      _avtCameraUpdate();
      _avtCheckProximidadeInimigos();
      realtimeBroadcast('avt_token_move', { nome: jogador.nome, x: jogador.x, y: jogador.y });
      _avtDebounceSalvarPosicao(jogador);
      _avtVerificarPortaFase(tileX, tileY);
      _avtVerificarSaida(tileX, tileY);
    }
  }
}

function _avtCanvasDblClick(e) {
  const canvas = AVT_STATE.canvas;
  const rect = canvas.getBoundingClientRect();
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera.zoom || 1));
  const tileX = Math.floor((e.clientX - rect.left + AVT_STATE.camera.x) / SZ);
  const tileY = Math.floor((e.clientY - rect.top  + AVT_STATE.camera.y) / SZ);
  const ent = AVT_STATE.entidades.find(e => e.x === tileX && e.y === tileY);
  if (ent) {
    e.preventDefault();
    abrirAvtCharEditor(ent.id);
  }
}

function _avtCanvasKey(e) {
  // Only capture keys when aventura screen is visible
  if (document.getElementById('aventura-screen')?.style.display === 'none') return;
  const keys = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1],
                 a:[-1,0], d:[1,0], w:[0,-1], s:[0,1] };
  const dir = keys[e.key];
  if (!dir) return;
  const _myBatKey = _avtMinhaBatalha();
  if (_myBatKey && !_myBatKey.moverModo) return;
  e.preventDefault();
  _avtMoverJogador(dir[0], dir[1]);
}

// Returns the entity the current user controls (their assigned character, or any player if master active)
function _avtMeuJogador() {
  if (AVT_STATE.isMestre && AVT_STATE.mestreAtivo) {
    return AVT_STATE.entidades.find(e => e.tipo === 'jogador');
  }
  if (AVT_STATE.myCharNome) {
    return AVT_STATE.entidades.find(e => e.nome === AVT_STATE.myCharNome && e.tipo === 'jogador');
  }
  // Fallback só para sessão solo (único jogador no mapa, sem vínculo configurado)
  const jogadores = AVT_STATE.entidades.filter(e => e.tipo === 'jogador');
  return jogadores.length === 1 ? jogadores[0] : null;
}

function _avtMoverJogador(dx, dy) {
  const minhaBat = _avtMinhaBatalha();
  // In combat moverModo, allow master to move the controlled NPC via WASD/dpad
  let jogador;
  if (minhaBat?.moverModo && AVT_STATE.npcControlando) {
    const ativo = _avtAtivo();
    if (ativo?.id === AVT_STATE.npcControlando)
      jogador = AVT_STATE.entidades.find(e => e.id === AVT_STATE.npcControlando);
  }
  if (!jogador) jogador = _avtMeuJogador();
  if (!jogador) return;
  const nx = jogador.x + dx, ny = jogador.y + dy;
  if (!_avtTilePassavel(nx, ny, AVT_STATE.dungeon)) return;
  if (minhaBat?.moverModo) {
    const reachable = _avtBFS(jogador.x, jogador.y, 3);
    if (!reachable.some(p => p.x===nx && p.y===ny)) return;
    const ativo = _avtAtivo();
    if (ativo?.id === jogador.id) {
      ativo.x = nx; ativo.y = ny;
      jogador.x = nx; jogador.y = ny;
      minhaBat.moverModo = false;
      _avtLog(`${jogador.nome} move para (${nx},${ny})`, minhaBat.id);
      _avtCheckAbandonoCombate(ativo, minhaBat);
      _avtHudUpdate();
    }
  } else if (!minhaBat) {
    jogador.x = nx; jogador.y = ny;
    _avtCheckProximidadeInimigos();
    // Se jogador entrou na área de um combate ativo, entra imediatamente
    _avtCheckEntradaCombateAtivo(jogador);
    realtimeBroadcast('avt_token_move', { nome: jogador.nome, x: jogador.x, y: jogador.y });
    _avtDebounceSalvarPosicao(jogador);
    _avtVerificarPortaFase(jogador.x, jogador.y);
    // Atualizar painel do jogador para detectar baú na nova posição
    const pp = document.getElementById('avt-player-panel');
    if (pp && pp.style.display !== 'none') avtJogadorPainelRender();
  }
  _avtCameraUpdate();
}

// If player walks into an active combat's area, join immediately (no patience timer)
function _avtCheckEntradaCombateAtivo(jogador) {
  if (!jogador || _avtBatalhaDeEnt(jogador.id)) return;
  for (const bat of AVT_STATE.batalhas) {
    const dist = Math.abs(jogador.x - bat.centroX) + Math.abs(jogador.y - bat.centroY);
    if (dist <= (bat.raio ?? 3)) {
      bat.envolvidos.push(jogador.id);
      const initRoll = Math.floor(Math.random()*20)+1+4;
      bat.iniciativa.push({ ...jogador, initRoll });
      bat.iniciativa.sort((a,b) => b.initRoll - a.initRoll);
      if (bat.turnoIdx >= bat.iniciativa.length) bat.turnoIdx = 0;
      _avtLog(`${jogador.nome} entrou no combate!`, bat.id);
      mostrarToast(`${jogador.nome} entrou no combate!`, 'aviso');
      _avtHudMostrar(true);
      _avtHudUpdate();
      _avtBroadcastJoinBatalha(bat.id, jogador.id, jogador.nome);
      _avtBroadcastBatalha(bat);
      break;
    }
  }
}

function _avtCheckProximidadeInimigos() {
  if (AVT_STATE.batalhaAutoSuspensa) return;
  // Only check enemies that are NOT already in a combat
  const enemiesLivres = AVT_STATE.entidades.filter(e => e.tipo === 'inimigo' && e.hp > 0 && !_avtBatalhaDeEnt(e.id));
  if (!enemiesLivres.length) return;
  // Only free players (not in any combat) can trigger new combats
  const jogadoresLivres = AVT_STATE.entidades.filter(e => e.tipo === 'jogador' && e.hp > 0 && !_avtBatalhaDeEnt(e.id));
  enemiesLivres.forEach(ini => {
    const raio = ini.deteccaoRaio ?? 3;
    const emRaio = jogadoresLivres.some(j => Math.abs(j.x - ini.x) + Math.abs(j.y - ini.y) <= raio);
    if (!AVT_STATE.npcTimers[ini.id]) {
      const maxMs = (ini.pacienciaSecs ?? 5) * 1000;
      AVT_STATE.npcTimers[ini.id] = { patience: maxMs, maxPatience: maxMs, ativo: false };
    }
    const timer = AVT_STATE.npcTimers[ini.id];
    if (emRaio) {
      timer.ativo = true;
    } else {
      timer.ativo = false;
      timer.patience = timer.maxPatience;
    }
  });
}

function _avtAtualizarPaciencias(dt) {
  if (!dt) return;
  for (const [id, timer] of Object.entries(AVT_STATE.npcTimers)) {
    if (!timer.ativo) continue;
    // Skip if this enemy is already in a combat
    if (_avtBatalhaDeEnt(id)) { timer.ativo = false; continue; }
    timer.patience = Math.max(0, timer.patience - dt);
    if (timer.patience <= 0) {
      const ini = AVT_STATE.entidades.find(e => e.id === id);
      if (ini) avtCombateIniciar(ini);
      timer.patience = timer.maxPatience;
      timer.ativo = false;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE D-PAD
// ─────────────────────────────────────────────────────────────────────────────

var _avtDpadTimer = null;

function avtDpad(dx, dy) {
  clearInterval(_avtDpadTimer);
  _avtDpadDoMove(dx, dy);
  if (navigator.vibrate) navigator.vibrate(15);
  _avtDpadTimer = setInterval(() => _avtDpadDoMove(dx, dy), 200);
}

function avtDpadStop() {
  clearInterval(_avtDpadTimer);
  _avtDpadTimer = null;
}

function _avtDpadDoMove(dx, dy) {
  _avtMoverJogador(dx, dy);
}

function _avtToggleDpad() {
  const dpad = document.getElementById('avt-dpad');
  if (!dpad) return;
  dpad.style.display = dpad.style.display === 'none' ? 'block' : 'none';
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTIPLAYER SYNC
// ─────────────────────────────────────────────────────────────────────────────

// Receive remote player movement broadcast
function avtReceberMovimento({ nome, x, y }) {
  if (!AVT_STATE.rpgId) return;
  const ent = AVT_STATE.entidades.find(e => e.nome === nome);
  if (ent) { ent.x = x; ent.y = y; }
}
window.avtReceberMovimento = avtReceberMovimento;

// Receive combat-start broadcast from master
function avtReceberCombateInicio(payload) {
  if (!AVT_STATE.rpgId) return;
  // Apply positions from payload first
  if (payload.posicoes) {
    payload.posicoes.forEach(({ nome, x, y }) => {
      const ent = AVT_STATE.entidades.find(e => e.nome === nome);
      if (ent) { ent.x = x; ent.y = y; }
    });
  }
  // Find or create combat with the given id
  if (payload.batalhaId && AVT_STATE.batalhas.some(b => b.id === payload.batalhaId)) return;
  // Find the trigger enemy if provided
  const iniEnt = payload.iniNome ? AVT_STATE.entidades.find(e => e.nome === payload.iniNome) : null;
  avtCombateIniciar(iniEnt, payload.batalhaId);
}
window.avtReceberCombateInicio = avtReceberCombateInicio;

// Broadcast full battle state so all clients stay in sync after every action
function _avtBroadcastBatalha(bat) {
  if (!bat) return;
  const snapshot = {
    id: bat.id,
    turnoIdx: bat.turnoIdx,
    log: bat.log.slice(0, 10),
    envolvidos: bat.envolvidos,
    iniciativa: bat.iniciativa.map(e => ({ id: e.id, nome: e.nome, hp: e.hp, hpMax: e.hpMax, tipo: e.tipo, initRoll: e.initRoll })),
  };
  realtimeBroadcast('avt_batalha_update', snapshot);
}

// Receive battle-state update from any client
function avtReceberBatalhaUpdate(payload) {
  if (!AVT_STATE.rpgId || !payload?.id) return;
  const bat = AVT_STATE.batalhas.find(b => b.id === payload.id);
  if (!bat) return;
  bat.turnoIdx = payload.turnoIdx ?? bat.turnoIdx;
  if (Array.isArray(payload.log)) bat.log = payload.log;
  if (Array.isArray(payload.iniciativa)) {
    payload.iniciativa.forEach(snap => {
      const local = bat.iniciativa.find(e => e.id === snap.id);
      if (local) { local.hp = snap.hp; local.hpMax = snap.hpMax; }
      const ent = AVT_STATE.entidades.find(e => e.id === snap.id);
      if (ent) { ent.hp = snap.hp; ent.hpMax = snap.hpMax; }
    });
  }
  _avtRenderHpBar();
  _avtHudUpdate();
  _avtRenderLog();
}
window.avtReceberBatalhaUpdate = avtReceberBatalhaUpdate;

// Broadcast / receive combat end
function _avtBroadcastFimBatalha(batalhaId) {
  realtimeBroadcast('avt_combate_fim', { batalhaId });
}
function avtReceberFimBatalha({ batalhaId }) {
  if (!AVT_STATE.rpgId) return;
  AVT_STATE.batalhas = AVT_STATE.batalhas.filter(b => b.id !== batalhaId);
  _avtHudMostrar(!!_avtMinhaBatalha());
  _avtHudUpdate();
  _avtRenderLog();
}
window.avtReceberFimBatalha = avtReceberFimBatalha;

// Broadcast / receive player joining an existing combat
function _avtBroadcastJoinBatalha(batalhaId, jogadorId, jogadorNome) {
  realtimeBroadcast('avt_combate_join', { batalhaId, jogadorId, jogadorNome });
}
function avtReceberJoinBatalha({ batalhaId, jogadorId, jogadorNome }) {
  if (!AVT_STATE.rpgId) return;
  const bat = AVT_STATE.batalhas.find(b => b.id === batalhaId);
  if (!bat || bat.envolvidos.includes(jogadorId)) return;
  const ent = AVT_STATE.entidades.find(e => e.id === jogadorId);
  if (!ent) return;
  bat.envolvidos.push(jogadorId);
  const initRoll = Math.floor(Math.random()*20)+1+4;
  bat.iniciativa.push({ ...ent, initRoll });
  bat.iniciativa.sort((a,b) => b.initRoll - a.initRoll);
  _avtHudUpdate();
  _avtRenderLog();
}
window.avtReceberJoinBatalha = avtReceberJoinBatalha;

// Broadcast / receive NPC death (hidden from map)
function _avtBroadcastNpcMorreu(npcId) {
  realtimeBroadcast('avt_npc_morreu', { npcId });
}
function avtReceberNpcMorreu({ npcId }) {
  if (!AVT_STATE.rpgId) return;
  const ent = AVT_STATE.entidades.find(e => e.id === npcId);
  if (ent) ent.escondido = true;
}
window.avtReceberNpcMorreu = avtReceberNpcMorreu;

// Broadcast / receive NPC respawn
function _avtBroadcastNpcRespawn(npcId, x, y, hp) {
  realtimeBroadcast('avt_npc_respawn', { npcId, x, y, hp });
}
function avtReceberNpcRespawn({ npcId, x, y, hp }) {
  if (!AVT_STATE.rpgId) return;
  const ent = AVT_STATE.entidades.find(e => e.id === npcId);
  if (!ent) return;
  ent.escondido = false;
  ent.hp = hp;
  ent.hpMax = hp;
  ent.x = x;
  ent.y = y;
}
window.avtReceberNpcRespawn = avtReceberNpcRespawn;

// Broadcast / receive XP gain
function _avtBroadcastXpGanho(ganhos) {
  realtimeBroadcast('avt_xp_ganho', { ganhos });
}
function avtReceberXpGanho({ ganhos }) {
  if (!AVT_STATE.rpgId || !Array.isArray(ganhos)) return;
  ganhos.forEach(({ nome, xp }) => {
    const char = AVT_STATE.chars.find(c => c.nome === nome);
    if (char) {
      char.xp = (char.xp || 0) + xp;
      mostrarToast(`✦ ${nome} +${xp} XP`, 'sucesso');
    }
  });
}
window.avtReceberXpGanho = avtReceberXpGanho;

// NPC respawn: schedule timer-based respawn after death
function _avtAgendarRespawnNpc(ent) {
  const delay = (ent.respawnDelay ?? 60) * 1000;
  if (!ent.respawnTipo || ent.respawnTipo === 'nunca') return;
  if (ent.respawnTipo === 'timer') {
    _avtSetTimeout(() => avtRespawnNpc(ent.id), delay);
  }
  // 'manual' respawn is handled by master via panel button
}

// Respawn a dead NPC
function avtRespawnNpc(npcId) {
  const ent = AVT_STATE.entidades.find(e => e.id === npcId);
  if (!ent) return;
  ent.escondido = false;
  ent.hp = ent.hpMax;
  ent.vezes_morto = ent.vezes_morto || 0; // keep kill count
  delete AVT_STATE.npcTimers[npcId];
  mostrarToast(`${ent.nome} reapareceu!`, 'aviso');
  _avtBroadcastNpcRespawn(npcId, ent.x, ent.y, ent.hp);
}
window.avtRespawnNpc = avtRespawnNpc;

// Distribute XP from a killed NPC to all players in its combat
function _avtDistribuirXpNpc(npcEnt, bat) {
  const xpBase = npcEnt.xpBase ?? 0;
  if (!xpBase || !bat) return;
  const vezesMorto = npcEnt.vezes_morto || 0;
  const xpFinal = Math.max(1, Math.round(xpBase * Math.pow(0.8, vezesMorto)));
  const jogadoresNaBat = bat.iniciativa.filter(e => e.tipo === 'jogador');
  if (!jogadoresNaBat.length) return;
  const xpPorJog = Math.max(1, Math.round(xpFinal / jogadoresNaBat.length));
  const ganhos = jogadoresNaBat.map(j => ({ nome: j.nome, xp: xpPorJog }));

  ganhos.forEach(({ nome, xp }) => {
    const char = AVT_STATE.chars.find(c => c.nome === nome);
    if (!char) return;
    char.xp = (char.xp || 0) + xp;
    mostrarToast(`✦ ${nome} +${xp} XP`, 'sucesso');
    // Persist XP to DB
    if (char.id) {
      _avtSb('characters?id=eq.' + encodeURIComponent(char.id), { method: 'PATCH', body: JSON.stringify({ xp: char.xp }) }).catch(()=>{});
    }
  });
  _avtBroadcastXpGanho(ganhos);
}

// Handle NPC death: hide from map, maybe drop item, schedule respawn, give XP
function _avtNpcMorreu(npcEnt, bat) {
  if (!npcEnt || npcEnt.escondido) return;
  npcEnt.escondido = true;
  npcEnt.vezes_morto = (npcEnt.vezes_morto || 0) + 1;
  _avtBroadcastNpcMorreu(npcEnt.id);

  // 10% drop chance on first kill only
  if (npcEnt.vezes_morto === 1 && Math.random() < 0.10) {
    _avtGerarDropNpc(npcEnt);
  }

  // XP distribution
  _avtDistribuirXpNpc(npcEnt, bat);

  // Schedule respawn
  _avtAgendarRespawnNpc(npcEnt);
}

// Generate a loot drop at NPC's position
async function _avtGerarDropNpc(npcEnt) {
  if (!AVT_STATE.rpgId) return;
  try {
    const catalog = AVT_STATE.itemCatalog || [];
    const droppable = catalog.filter(i => i.droppable);
    if (!droppable.length) return;
    const item = droppable[Math.floor(Math.random() * droppable.length)];
    await _avtSb('loot_pendente', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        rpg_id: AVT_STATE.rpgId,
        item_id: item.id,
        origem_npc: npcEnt.nome,
        posicao_col: npcEnt.x,
        posicao_row: npcEnt.y,
        mapa_id: AVT_STATE.faseId || null,
      })
    });
    mostrarToast(`${npcEnt.nome} droppou ${item.nome}!`, 'sucesso');
  } catch(e) {}
}

// Debounced save of dungeon position to DB (so late-joining players see correct positions)
var _avtSavePosTimers = {};
function _avtDebounceSalvarPosicao(jogador) {
  clearTimeout(_avtSavePosTimers[jogador.nome]);
  _avtSavePosTimers[jogador.nome] = setTimeout(async () => {
    const dbChar = AVT_STATE.chars.find(c => c.nome === jogador.nome);
    if (!dbChar?.id) return;
    const ca = { ...(dbChar.custom_attrs || {}), avt_x: jogador.x, avt_y: jogador.y };
    dbChar.custom_attrs = ca;
    try { await _avtSb('characters?id=eq.' + encodeURIComponent(dbChar.id), { method:'PATCH', body:JSON.stringify({ custom_attrs:ca }) }); } catch(e) {}
  }, 2000);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMBAT
// ─────────────────────────────────────────────────────────────────────────────

// Helpers to find combats
function _avtMinhaBatalha() {
  const eu = _avtMeuJogador();
  if (eu) {
    const b = AVT_STATE.batalhas.find(b => b.envolvidos.includes(eu.id));
    if (b) return b;
  }
  if (AVT_STATE.isMestre && AVT_STATE.batalhas.length) return AVT_STATE.batalhas[0];
  return null;
}
function _avtBatalhaDeEnt(entId) {
  return AVT_STATE.batalhas.find(b => b.envolvidos.includes(entId)) || null;
}

// Check if a combatant moved out of combat range and should be removed
function _avtCheckAbandonoCombate(ativo, bat) {
  if (!bat || ativo.tipo !== 'jogador') return;
  const dist = Math.abs(ativo.x - bat.centroX) + Math.abs(ativo.y - bat.centroY);
  const raioAbandono = (bat.raio ?? 3) + 3; // a bit more lenient than trigger radius
  if (dist > raioAbandono) {
    bat.iniciativa = bat.iniciativa.filter(e => e.id !== ativo.id);
    bat.envolvidos = bat.envolvidos.filter(id => id !== ativo.id);
    if (bat.turnoIdx >= bat.iniciativa.length) bat.turnoIdx = 0;
    _avtLog(`${ativo.nome} recuou e saiu do combate`, bat.id);
    mostrarToast(`${ativo.nome} saiu do combate`, 'aviso');
    _avtHudMostrar(!!_avtMinhaBatalha());
    _avtHudUpdate();
  }
}

function avtCombateIniciar(inimigo_trigger, forcedId) {
  const raio = inimigo_trigger?.deteccaoRaio ?? 3;
  const cx = inimigo_trigger?.x ?? 0;
  const cy = inimigo_trigger?.y ?? 0;

  // Determine participants: players within range + the trigger enemy (and other nearby enemies)
  let participantes;
  if (inimigo_trigger) {
    const jogadoresNoRaio = AVT_STATE.entidades.filter(e =>
      e.tipo === 'jogador' && e.hp > 0 && !_avtBatalhaDeEnt(e.id) &&
      Math.abs(e.x - cx) + Math.abs(e.y - cy) <= raio
    );
    const inimigosProximos = AVT_STATE.entidades.filter(e =>
      e.tipo === 'inimigo' && e.hp > 0 && !_avtBatalhaDeEnt(e.id) &&
      Math.abs(e.x - cx) + Math.abs(e.y - cy) <= raio * 1.5
    );
    participantes = [...jogadoresNoRaio, ...inimigosProximos];
  } else {
    // Manual start by master: include all free entities
    participantes = AVT_STATE.entidades.filter(e => e.hp > 0 && !_avtBatalhaDeEnt(e.id));
  }

  if (!participantes.length) {
    mostrarToast('Nenhum participante no alcance para iniciar combate', 'aviso');
    return null;
  }

  const batId = forcedId || ('bat_' + Date.now());
  const init = participantes.map(e => ({
    ...e, initRoll: Math.floor(Math.random()*20)+1 + (e.tipo==='jogador' ? 4 : 0)
  })).sort((a,b) => b.initRoll - a.initRoll);

  const jogadorIniciador = participantes.find(e => e.tipo === 'jogador');
  const bat = {
    id: batId,
    iniciativa: init,
    turnoIdx: 0,
    log: ['Combate iniciado!'],
    moverModo: false,
    envolvidos: participantes.map(e => e.id),
    centroX: cx,
    centroY: cy,
    raio,
    iniciador: jogadorIniciador?.nome || null,
  };
  AVT_STATE.batalhas.push(bat);

  const nomes = participantes.map(e => e.nome).join(', ');
  mostrarToast(`⚔ Combate! (${nomes})`, 'aviso');

  const posicoes = participantes.map(e => ({ nome: e.nome, x: e.x, y: e.y }));
  realtimeBroadcast('avt_combate_inicio', { posicoes, batalhaId: batId, iniNome: inimigo_trigger?.nome || null });

  _avtHudMostrar(true);
  _avtHudUpdate();
  _avtRenderLog();
  // Não abre o painel do mestre automaticamente — o botão ⚙ está disponível manualmente
  const ativoNovo = bat.iniciativa[bat.turnoIdx];
  if (ativoNovo?.tipo === 'inimigo') _avtSetTimeout(() => _avtNpcTurno(bat), 800);
  return bat;
}

function avtCombateEncerrar(batalhaId) {
  if (!batalhaId) {
    if (AVT_STATE.batalhas.length === 0) return;
    batalhaId = AVT_STATE.batalhas[0].id;
  }
  _avtBroadcastFimBatalha(batalhaId);
  AVT_STATE.batalhas = AVT_STATE.batalhas.filter(b => b.id !== batalhaId);
  _avtHudMostrar(!!_avtMinhaBatalha());
  _avtHudUpdate();
  _avtRenderLog();
  _avtMestrePainelRender();
  mostrarToast('Combate encerrado', 'ok');
}

// Jogador pode encerrar apenas o próprio combate (ou mestre encerra qualquer um)
function avtEncerrarMeuCombate() {
  const bat = _avtMinhaBatalha();
  if (!bat) return;
  if (!AVT_STATE.isMestre) {
    const eu = _avtMeuJogador();
    if (!eu || bat.iniciador !== eu.nome) {
      mostrarToast('Apenas o iniciador ou o mestre pode encerrar este combate', 'aviso');
      return;
    }
  }
  avtCombateEncerrar(bat.id);
}
window.avtEncerrarMeuCombate = avtEncerrarMeuCombate;

function _avtAtivo() {
  const b = _avtMinhaBatalha();
  return b ? b.iniciativa[b.turnoIdx] : null;
}

function _avtHudMostrar(show) {
  const hud = document.getElementById('avt-hud');
  if (hud) hud.style.display = show ? 'flex' : 'none';
}

function _avtHudUpdate() {
  const b = _avtMinhaBatalha();
  if (!b) { _avtHudMostrar(false); return; }
  const ativo = b.iniciativa[b.turnoIdx];
  if (!ativo) return;

  const initBar = document.getElementById('avt-hud-init');
  if (initBar) {
    initBar.innerHTML = b.iniciativa.map((e,i) =>
      `<span class="avt-init-badge ${i===b.turnoIdx?'ativo':''}" style="border-color:${e.cor}">${e.nome.split(' ')[0]}</span>`
    ).join('<span class="avt-init-sep">›</span>');
  }

  const hudEsq = document.getElementById('avt-hud-esq');
  const hudDir = document.getElementById('avt-hud-dir');
  if (!hudEsq || !hudDir) return;

  if (ativo.tipo === 'jogador') {
    const inimigos = b.iniciativa.filter(e => e.tipo==='inimigo' && e.hp>0);
    const _dbChar = AVT_STATE.chars.find(c => c.id === ativo.dbId || c.nome === ativo.nome);
    const _charSkillIds = _dbChar?.custom_attrs?.skills_ids || [];
    const mySkills = AVT_STATE.skills.filter(sk =>
      _charSkillIds.includes(sk.id) ||
      sk.personagem === ativo.nome ||
      sk.character_id === ativo.dbId
    );
    // Decrement this player's cooldowns at start of their turn
    if (AVT_STATE._cooldowns) {
      Object.keys(AVT_STATE._cooldowns).forEach(key => {
        if (key.startsWith(ativo.id + '_') && AVT_STATE._cooldowns[key] > 0) {
          AVT_STATE._cooldowns[key]--;
        }
      });
    }
    hudEsq.innerHTML = `
      <div class="avt-hud-turno" style="color:${ativo.cor}">Turno: <b>${ativo.nome}</b></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select id="avt-hud-alvo" style="flex:1;min-width:110px;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.72rem">
          ${inimigos.map(e => `<option value="${e.id}">${e.nome} (${e.hp}/${e.hpMax}HP)</option>`).join('')}
          ${!inimigos.length ? '<option>— sem alvos —</option>' : ''}
        </select>
        <select id="avt-hud-skill" style="flex:1;min-width:110px;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.72rem">
          <option value="">Ataque básico (1d8)</option>
          ${mySkills.map(sk => {
            const cdKey = ativo.id + '_' + sk.id;
            const cd = (AVT_STATE._cooldowns || {})[cdKey] || 0;
            return `<option value="${sk.id}" data-formula="${sk.formula_dano||'1d6'}" ${cd > 0 ? 'disabled' : ''}>${sk.habilidade}${cd > 0 ? ` (⏱${cd})` : ''}</option>`;
          }).join('')}
        </select>
      </div>`;
    hudDir.innerHTML = `
      <button class="avt-hud-btn avt-hud-btn-atk" onclick="avtHudAtacar()">⚔ Atacar</button>
      <button class="avt-hud-btn avt-hud-btn-mov" onclick="avtHudMover()">↔ Mover</button>
      <button class="avt-hud-btn avt-hud-btn-pass" onclick="avtHudPassar()">⏭ Passar</button>`;
  } else {
    const isMestreCtrl = AVT_STATE.npcControlando === ativo.id;
    if (isMestreCtrl) {
      const alvos = b.iniciativa.filter(e => e.tipo==='jogador' && e.hp>0);
      hudEsq.innerHTML = `
        <div class="avt-hud-turno" style="color:${ativo.cor}">🎮 Controlando: <b>${ativo.nome}</b></div>
        <select id="avt-hud-alvo" style="padding:5px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.72rem;min-width:110px">
          ${alvos.map(e=>`<option value="${e.id}">${e.nome} (${e.hp}/${e.hpMax}HP)</option>`).join('')}
          ${!alvos.length?'<option>— sem alvos —</option>':''}
        </select>`;
      hudDir.innerHTML = `
        <button class="avt-hud-btn avt-hud-btn-atk" onclick="avtHudAtacarNpc()">⚔ Atacar</button>
        <button class="avt-hud-btn avt-hud-btn-mov" onclick="avtHudMover()">↔ Mover</button>
        <button class="avt-hud-btn avt-hud-btn-pass" onclick="avtHudPassar()">⏭ Passar</button>`;
    } else {
      hudEsq.innerHTML = `<div class="avt-hud-turno" style="color:${ativo.cor}">Turno: <b>${ativo.nome}</b> (inimigo)</div>
        <div style="color:#7a92aa;font-size:0.8rem">IA processando…</div>`;
      hudDir.innerHTML = '';
    }
  }
}

function avtHudAtacar() {
  const b = _avtMinhaBatalha();
  const ativo = _avtAtivo();
  if (!b || !ativo || ativo.tipo !== 'jogador') return;
  const alvoId = document.getElementById('avt-hud-alvo')?.value;
  const alvo   = b.iniciativa.find(e => e.id===alvoId);
  if (!alvo || alvo.hp<=0) { mostrarToast('Selecione um alvo válido', 'aviso'); return; }

  const skillSel = document.getElementById('avt-hud-skill');
  const skillId  = skillSel?.value || '';
  const sk = skillId ? AVT_STATE.skills.find(s=>s.id===skillId) : null;
  const formula  = sk?.formula_dano || '1d8';
  const skillNome = sk?.habilidade || 'Ataque básico';

  // Cooldown check
  if (sk) {
    if (!AVT_STATE._cooldowns) AVT_STATE._cooldowns = {};
    const cdKey = ativo.id + '_' + sk.id;
    if (AVT_STATE._cooldowns[cdKey] > 0) {
      mostrarToast(`${skillNome} em cooldown (${AVT_STATE._cooldowns[cdKey]} turno(s) restante(s))`, 'aviso');
      return;
    }
  }

  // Range check
  if (sk?.alcance_celulas != null) {
    const dist = Math.abs(ativo.x - alvo.x) + Math.abs(ativo.y - alvo.y);
    if (dist > sk.alcance_celulas) {
      mostrarToast(`${alvo.nome} está fora de alcance (${dist} células, máx ${sk.alcance_celulas})`, 'aviso');
      return;
    }
  }

  _avtSetEntState(ativo.id, 'attack');
  const dano    = _avtRolarFormula(formula);
  const hitRoll = Math.floor(Math.random()*20) + 1;
  const isCrit  = hitRoll >= 19;
  const isFumble = hitRoll === 1;

  if (isFumble) {
    const msg = `💨 ${ativo.nome} falha criticamente! (1)${sk?.critico_negativo ? ' — ' + sk.critico_negativo : ''}`;
    _avtLog(msg, b.id); mostrarToast(msg, '');
  } else if (hitRoll < 5) {
    _avtLog(`${ativo.nome} erra ${alvo.nome}! (${hitRoll})`, b.id);
    mostrarToast(`💨 ${ativo.nome} errou!`, '');
  } else {
    const real = isCrit ? dano * 2 : dano;
    const tipoDano = sk?.tipo_dano || 'fisico';
    alvo.hp = Math.max(0, alvo.hp - real);
    const entAlvo = AVT_STATE.entidades.find(e => e.id===alvo.id);
    if (entAlvo) entAlvo.hp = alvo.hp;
    const critMsg = isCrit && sk?.critico_positivo ? ' — ' + sk.critico_positivo : '';
    const msg = isCrit
      ? `🎯 CRÍTICO! ${ativo.nome} → ${alvo.nome}: ${real} [${tipoDano}] (${skillNome})${critMsg}`
      : `⚔ ${ativo.nome} → ${alvo.nome}: ${real} [${tipoDano}] (${skillNome})`;
    _avtLog(msg, b.id); mostrarToast(msg, 'ok');

    // Apply efeitos_bonus
    if (sk?.efeitos_bonus?.length && entAlvo) {
      if (!entAlvo.status_effects) entAlvo.status_effects = [];
      sk.efeitos_bonus.forEach(ef => {
        entAlvo.status_effects.push({ ...ef });
        _avtLog(`  ↳ ${ef.tipo}: ${ef.descricao} (${ef.duracao_turnos} turnos)`, b.id);
      });
    }

    _avtRenderHpBar();
    // Play skill animation
    if (sk) _avtPlaySkillAnim(sk, entAlvo || alvo);
    if (alvo.hp <= 0) {
      _avtLog(`💀 ${alvo.nome} derrotado!`, b.id);
      if (alvo.tipo === 'inimigo') { _avtNpcMorreu(entAlvo || alvo, b); _avtCheckVitoria(b); }
      else _avtCheckDerrota(b);
    }
    _avtBroadcastBatalha(b);
  }

  // Set cooldown
  if (sk?.cooldown_turnos > 0) {
    if (!AVT_STATE._cooldowns) AVT_STATE._cooldowns = {};
    AVT_STATE._cooldowns[ativo.id + '_' + sk.id] = sk.cooldown_turnos;
  }

  _avtSetTimeout(() => _avtTurnoAvancar(b), 600);
}

function avtHudMover() {
  const b = _avtMinhaBatalha();
  if (!b) return;
  b.moverModo = !b.moverModo;
  mostrarToast(b.moverModo ? 'Clique no tile de destino (ou use WASD/D-pad)' : 'Mover cancelado', '');
}

function avtHudPassar() {
  const b = _avtMinhaBatalha();
  const ativo = _avtAtivo();
  if (ativo) _avtLog(`${ativo.nome} passa o turno`, b?.id);
  _avtTurnoAvancar(b);
}

function _avtTurnoAvancar(bat) {
  if (!bat) bat = _avtMinhaBatalha();
  if (!bat) return;
  bat.moverModo = false;
  bat.iniciativa = bat.iniciativa.filter(e => e.hp > 0);
  bat.envolvidos = bat.envolvidos.filter(id => bat.iniciativa.some(e => e.id === id));
  if (!bat.iniciativa.length) { avtCombateEncerrar(bat.id); return; }
  bat.turnoIdx = (bat.turnoIdx + 1) % bat.iniciativa.length;
  _avtHudUpdate();
  _avtRenderLog();
  _avtBroadcastBatalha(bat);
  const ativoAgora = bat.iniciativa[bat.turnoIdx];
  if (ativoAgora?.tipo === 'inimigo') _avtSetTimeout(() => _avtNpcTurno(bat), 600);
}

function _avtNpcTurno(bat) {
  if (!bat) bat = _avtMinhaBatalha();
  if (!bat) return;
  const npc = bat.iniciativa[bat.turnoIdx];
  if (!npc || npc.tipo !== 'inimigo') return;
  const entNpc = AVT_STATE.entidades.find(e => e.id===npc.id);
  if (!entNpc || entNpc.hp<=0) { _avtTurnoAvancar(bat); return; }
  // Master controlling this NPC — show HUD and wait for master input
  if (AVT_STATE.npcControlando === npc.id) { _avtHudUpdate(); return; }
  // AI globally disabled — pass turn
  if (!AVT_STATE.npcIaAtiva) {
    _avtLog(`${npc.nome} aguarda (IA desligada)`, bat.id);
    _avtSetTimeout(() => _avtTurnoAvancar(bat), 800);
    return;
  }

  // Target only players in THIS combat
  const jogadores = AVT_STATE.entidades.filter(e => e.tipo==='jogador' && e.hp>0 && bat.envolvidos.includes(e.id));
  if (!jogadores.length) { _avtTurnoAvancar(bat); return; }

  let nearest = jogadores[0], nearDist = Infinity;
  jogadores.forEach(j => {
    const d = Math.abs(j.x-entNpc.x) + Math.abs(j.y-entNpc.y);
    if (d < nearDist) { nearest=j; nearDist=d; }
  });

  if (nearDist <= 1) {
    _avtSetEntState(npc.id, 'attack');
    const dano = _avtRolarFormula('1d6');
    if (Math.floor(Math.random()*20)+1 < 6) {
      _avtLog(`${npc.nome} erra ${nearest.nome}`, bat.id);
    } else {
      nearest.hp = Math.max(0, nearest.hp - dano);
      const initEnt = bat.iniciativa.find(e => e.id===nearest.id || e.nome===nearest.nome);
      if (initEnt) initEnt.hp = nearest.hp;
      _avtLog(`👹 ${npc.nome} → ${nearest.nome}: ${dano} dano`, bat.id);
      mostrarToast(`👹 ${npc.nome} ataca! -${dano} HP`, 'aviso');
      _avtRenderHpBar();
      _avtBroadcastBatalha(bat);
      if (nearest.hp <= 0) { _avtLog(`💀 ${nearest.nome} caiu!`, bat.id); _avtCheckDerrota(bat); }
    }
  } else {
    let bestDir=null, bestDist=nearDist;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
      const nx=entNpc.x+dx, ny=entNpc.y+dy;
      if (!_avtTilePassavel(nx, ny, AVT_STATE.dungeon)) return;
      const d = Math.abs(nearest.x-nx) + Math.abs(nearest.y-ny);
      if (d < bestDist) { bestDist=d; bestDir=[dx,dy]; }
    });
    if (bestDir) { entNpc.x+=bestDir[0]; entNpc.y+=bestDir[1]; npc.x=entNpc.x; npc.y=entNpc.y; }
  }
  _avtSetTimeout(() => _avtTurnoAvancar(bat), 500);
}

function _avtCheckVitoria(bat) {
  if (!bat) bat = _avtMinhaBatalha();
  if (!bat) return;
  const inimigosVivos = bat.iniciativa.some(e => e.tipo==='inimigo' && e.hp>0);
  if (!inimigosVivos) {
    _avtSetTimeout(() => {
      _avtLog('=== VITÓRIA ===', bat.id);
      _avtRenderLog();
      avtCombateEncerrar(bat.id);
      mostrarToast('✦ Vitória!', 'sucesso');
    }, 400);
  }
}

function _avtCheckDerrota(bat) {
  if (!bat) bat = _avtMinhaBatalha();
  if (!bat) return;
  const jogadoresVivos = bat.iniciativa.some(e => e.tipo==='jogador' && e.hp>0);
  if (!jogadoresVivos) {
    _avtSetTimeout(() => {
      _avtLog('=== DERROTA ===', bat.id);
      _avtRenderLog();
      avtCombateEncerrar(bat.id);
      mostrarToast('💀 Todos os heróis caíram…', 'erro');
    }, 400);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DICE
// ─────────────────────────────────────────────────────────────────────────────

function _avtRolarFormula(formula) {
  if (!formula) return Math.floor(Math.random()*8)+1;
  let total = 0;
  String(formula).toLowerCase().split('+').forEach(p => {
    p = p.trim();
    const m = p.match(/^(\d*)d(\d+)$/);
    if (m) { const n=parseInt(m[1])||1,d=parseInt(m[2])||6; for(let i=0;i<n;i++) total+=Math.floor(Math.random()*d)+1; }
    else total += parseInt(p)||0;
  });
  return Math.max(1, total);
}

// ─────────────────────────────────────────────────────────────────────────────
// LOG + HP BAR
// ─────────────────────────────────────────────────────────────────────────────

function _avtLog(msg, batalhaId) {
  const bat = batalhaId ? AVT_STATE.batalhas.find(b => b.id === batalhaId) : _avtMinhaBatalha();
  if (bat) {
    bat.log.unshift(msg);
    if (bat.log.length > 30) bat.log.length = 30;
  }
  _avtRenderLog();
}

function _avtRenderLog() {
  const el = document.getElementById('avt-log');
  if (!el) return;
  const bat = _avtMinhaBatalha();
  const log = bat ? bat.log : [];
  el.innerHTML = log.map(l => `<div class="avt-log-linha">${l}</div>`).join('');
}

function _avtRenderHpBar() {
  const wrap = document.getElementById('avt-hp-bars');
  if (!wrap) return;
  const jogadores = AVT_STATE.entidades.filter(e => e.tipo==='jogador');
  wrap.innerHTML = jogadores.map(j => {
    const pct = Math.max(0, j.hp/j.hpMax*100);
    const col = pct>50 ? '#27ae60' : pct>25 ? '#f39c12' : '#e74c3c';
    return `<div class="avt-hp-item">
      <span class="avt-hp-nome" style="color:${j.cor}">${j.nome.split(' ')[0]}</span>
      <div class="avt-hp-bar-wrap"><div class="avt-hp-bar-fill" style="width:${pct}%;background:${col}"></div></div>
      <span class="avt-hp-val">${j.hp}/${j.hpMax}</span>
    </div>`;
  }).join('');
}

function _avtToggleLog() {
  const panel = document.getElementById('avt-log-panel');
  if (!panel) return;
  panel.style.display = panel.style.display==='none' ? 'block' : 'none';
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER DETECTION & PANEL
// ─────────────────────────────────────────────────────────────────────────────

function _avtDetectarMestre() {
  AVT_STATE.isMestre = !!(AVT_STATE.rpg?.owner_id && SESSION?.user?.id &&
    AVT_STATE.rpg.owner_id === SESSION.user.id);
  const btnM = document.getElementById('avt-btn-mestre');
  if (btnM) btnM.style.display = AVT_STATE.isMestre ? 'inline-flex' : 'none';
  const btnP = document.getElementById('avt-btn-player');
  if (btnP) btnP.style.display = AVT_STATE.isMestre ? 'none' : 'inline-flex';
  const btnC = document.getElementById('avt-btn-combate');
  if (btnC) btnC.style.display = AVT_STATE.isMestre ? 'inline-flex' : 'none';
}

// ─── PLAYER PANEL ─────────────────────────────────────────────────────────────

function avtJogadorPainel() {
  const panel = document.getElementById('avt-player-panel');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'flex';
  if (!open) avtJogadorPainelRender();
}
window.avtJogadorPainel = avtJogadorPainel;

function avtJogadorPainelRender() {
  const el = document.getElementById('avt-pp-content');
  if (!el) return;
  const jogador = _avtMeuJogador();
  const bat = _avtMinhaBatalha();
  const skills = AVT_STATE.skills?.filter(s => !jogador || s.personagem === jogador.nome) || [];
  const char = jogador ? AVT_STATE.chars.find(c => c.nome === jogador.nome) : null;

  if (!jogador) {
    el.innerHTML = `<p style="color:#7a92aa;font-family:var(--fonte-d);font-size:0.75rem">Nenhum personagem vinculado à sua sessão.</p>`;
    return;
  }

  const hpPct = Math.max(0, (jogador.hp / jogador.hpMax) * 100);
  const hpCol = hpPct > 50 ? '#27ae60' : hpPct > 25 ? '#f39c12' : '#e74c3c';
  const xp = char?.xp ?? 0;
  const nivel = char?.nivel ?? 1;
  const xpProximo = nivel * 100;
  const xpPct = Math.min(100, (xp / xpProximo) * 100);

  // Seção: personagem
  let html = `
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:44px;height:44px;border-radius:50%;background:${jogador.cor || '#4fa3d1'};display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">${jogador.icone || '⚔'}</div>
        <div style="flex:1">
          <div style="font-family:var(--fonte-d);font-size:0.88rem;color:#c8d8e8;letter-spacing:.06em">${jogador.nome}</div>
          <div style="font-family:var(--fonte-d);font-size:0.62rem;color:#7a92aa">Nível ${nivel} · ${xp}/${xpProximo} XP</div>
        </div>
      </div>
      <!-- HP Bar -->
      <div>
        <div style="display:flex;justify-content:space-between;font-family:var(--fonte-d);font-size:0.62rem;color:#7a92aa;margin-bottom:3px">
          <span>HP</span><span style="color:${hpCol}">${jogador.hp} / ${jogador.hpMax}</span>
        </div>
        <div style="height:7px;background:rgba(79,163,209,0.12);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${hpPct}%;background:${hpCol};transition:width .3s"></div>
        </div>
      </div>
      <!-- XP Bar -->
      <div>
        <div style="height:4px;background:rgba(200,168,75,0.12);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${xpPct}%;background:#c8a84b;transition:width .3s"></div>
        </div>
      </div>
    </div>`;

  // Seção: combate ativo
  if (bat) {
    const podeEncerrar = bat.iniciador === jogador.nome;
    html += `
    <div style="border:1px solid rgba(232,96,76,0.25);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:8px">
      <div style="font-family:var(--fonte-d);font-size:0.62rem;color:#e8604c;text-transform:uppercase;letter-spacing:.08em">⚔ Combate Ativo</div>
      <div style="font-family:var(--fonte-d);font-size:0.62rem;color:#7a92aa">Iniciativa:</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${bat.iniciativa.map((e,i) => `<span style="font-family:var(--fonte-d);font-size:0.62rem;padding:2px 7px;border-radius:4px;border:1px solid ${i===bat.turnoIdx?'rgba(232,96,76,0.6)':'rgba(79,163,209,0.2)'};color:${i===bat.turnoIdx?'#e8604c':'#7a92aa'}">${e.nome.split(' ')[0]} ${e.hp}HP</span>`).join('')}
      </div>
      ${podeEncerrar ? `<button onclick="avtEncerrarMeuCombate()" style="margin-top:4px;background:rgba(232,96,76,0.12);border:1px solid rgba(232,96,76,0.3);border-radius:6px;color:#e8604c;font-family:var(--fonte-d);font-size:0.62rem;padding:5px 10px;cursor:pointer">⚑ Encerrar meu combate</button>` : ''}
    </div>`;
  }

  // Seção: baú na posição
  const bauNaPosicao = _avtBauNaPosicao(jogador.x, jogador.y);
  if (bauNaPosicao) {
    html += `
    <div style="border:1px solid rgba(200,168,75,0.25);border-radius:8px;padding:10px">
      <div style="font-family:var(--fonte-d);font-size:0.62rem;color:#c8a84b;margin-bottom:8px">📦 ${bauNaPosicao.nome || 'Baú'}</div>
      <button onclick="avtAbrirBau('${bauNaPosicao.id}')" style="background:rgba(200,168,75,0.12);border:1px solid rgba(200,168,75,0.3);border-radius:6px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.62rem;padding:5px 12px;cursor:pointer;width:100%">📦 Abrir Baú</button>
    </div>`;
  }

  // Seção: habilidades
  if (skills.length) {
    html += `
    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="font-family:var(--fonte-d);font-size:0.62rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.08em">Habilidades</div>
      ${skills.slice(0, 8).map(s => `
        <div style="border:1px solid rgba(79,163,209,0.12);border-radius:6px;padding:8px 10px">
          <div style="font-family:var(--fonte-d);font-size:0.75rem;color:#c8d8e8">${s.habilidade}</div>
          ${s.efeito ? `<div style="font-family:var(--fonte-d);font-size:0.62rem;color:#7a92aa;margin-top:2px">${s.efeito}</div>` : ''}
          ${s.formula_dano ? `<div style="font-family:var(--fonte-d);font-size:0.62rem;color:#4fa3d1;margin-top:2px">Dano: ${s.formula_dano}</div>` : ''}
        </div>`).join('')}
    </div>`;
  }

  // Seção: log rápido
  const allBatlogs = AVT_STATE.batalhas.flatMap(b => b.log.slice(0,5));
  if (allBatlogs.length) {
    html += `
    <div style="display:flex;flex-direction:column;gap:4px">
      <div style="font-family:var(--fonte-d);font-size:0.62rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.08em">Log recente</div>
      ${allBatlogs.map(l => `<div style="font-family:var(--fonte-d);font-size:0.62rem;color:#c8d8e8;padding:3px 0;border-bottom:1px solid rgba(79,163,209,0.07)">${l}</div>`).join('')}
    </div>`;
  }

  el.innerHTML = html;
}
window.avtJogadorPainelRender = avtJogadorPainelRender;

// Check if a baú object exists at player's exact position
function _avtBauNaPosicao(x, y) {
  const rd = AVT_STATE.dungeon?.render_data;
  if (!rd?.objetos) return null;
  const largura = AVT_STATE.dungeon?.w || 1;
  const altura = AVT_STATE.dungeon?.h || 1;
  return rd.objetos.find(o => {
    if (o.tipo !== 'bau' && o.tipo !== 'chest') return false;
    const ox = Math.round((o.x ?? 0) * largura);
    const oy = Math.round((o.y ?? 0) * altura);
    return ox === x && oy === y;
  }) || null;
}

// Open a chest at player's position
async function avtAbrirBau(bauId) {
  const jogador = _avtMeuJogador();
  if (!jogador) return;
  const rd = AVT_STATE.dungeon?.render_data;
  const bau = rd?.objetos?.find(o => o.id === bauId || String(o.id) === String(bauId));
  if (!bau) { mostrarToast('Baú não encontrado', 'erro'); return; }
  if (bau.aberto) { mostrarToast('Este baú já foi aberto', 'aviso'); return; }
  bau.aberto = true;

  const char = AVT_STATE.chars.find(c => c.nome === jogador.nome);
  if (!char) return;

  // Distribute loot
  const loot = bau.loot_itens || [];
  if (loot.length === 0 && !bau.ouro) {
    mostrarToast('📦 Baú vazio!', 'aviso');
    avtJogadorPainelRender();
    return;
  }

  // Add gold if any
  if (bau.ouro && char) {
    const ca = { ...(char.custom_attrs || {}), ouro: (char.custom_attrs?.ouro || 0) + bau.ouro };
    char.custom_attrs = ca;
    await _avtSb('characters?id=eq.' + encodeURIComponent(char.id), { method: 'PATCH', body: JSON.stringify({ custom_attrs: ca }) }).catch(()=>{});
    mostrarToast(`📦 Baú: +${bau.ouro} ouro!`, 'sucesso');
  }

  // Add items to inventario
  for (const item of loot) {
    if (!item.item_catalog_id && !item.id) continue;
    const itemId = item.item_catalog_id || item.id;
    await _avtSb('inventario', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        rpg_id: AVT_STATE.rpgId,
        character_id: char.id,
        personagem_nome: char.nome,
        item_catalog_id: itemId,
        quantidade: item.quantidade || 1,
        origem: 'bau',
      })
    }).catch(()=>{});
  }

  if (loot.length) mostrarToast(`📦 Baú aberto! ${loot.length} item(ns) adicionado(s) ao inventário`, 'sucesso');
  realtimeBroadcast('avt_bau_aberto', { bauId, jogadorNome: jogador.nome });
  avtJogadorPainelRender();
}
window.avtAbrirBau = avtAbrirBau;

// ─── END PLAYER PANEL ─────────────────────────────────────────────────────────

// ─── CATALOG IMPORT ───────────────────────────────────────────────────────────

function avtImportarCatalogo() {
  const existing = document.getElementById('avt-catalog-import-modal');
  if (existing) { existing.remove(); return; }

  const modal = document.createElement('div');
  modal.id = 'avt-catalog-import-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:#0a0f18;border:1px solid rgba(79,163,209,0.3);border-radius:12px;padding:20px;width:min(560px,95vw);display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-family:var(--fonte-d);font-size:0.85rem;color:#4fa3d1;flex:1;letter-spacing:.08em">IMPORTAR CATÁLOGO DE ITENS</span>
        <button onclick="document.getElementById('avt-catalog-import-modal').remove()" style="background:none;border:none;color:#7a92aa;cursor:pointer;font-size:1.2rem">×</button>
      </div>
      <div style="font-family:var(--fonte-d);font-size:0.7rem;color:#7a92aa">Cole o JSON do catálogo abaixo. Formato: array de objetos com campos <code>nome</code>, <code>tipo</code>, <code>descricao</code>, <code>icone</code>, <code>raridade</code>, <code>droppable</code>, <code>drop_rate</code>, etc.</div>
      <textarea id="avt-catalog-json" rows="10" placeholder='[{"nome":"Espada de Ferro","tipo":"equipamento","icone":"⚔","raridade":"comum","droppable":true,"drop_rate":0.1}]'
        style="width:100%;background:#050810;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem;padding:8px;font-family:monospace;resize:vertical;outline:none"></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button onclick="document.getElementById('avt-catalog-import-modal').remove()" style="background:none;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#7a92aa;font-family:var(--fonte-d);font-size:0.72rem;padding:6px 14px;cursor:pointer">Cancelar</button>
        <button onclick="avtImportarCatalogoConfirmar()" style="background:rgba(79,163,209,0.15);border:1px solid rgba(79,163,209,0.4);border-radius:6px;color:#4fa3d1;font-family:var(--fonte-d);font-size:0.72rem;padding:6px 14px;cursor:pointer">Importar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}
window.avtImportarCatalogo = avtImportarCatalogo;

async function avtImportarCatalogoConfirmar() {
  const raw = document.getElementById('avt-catalog-json')?.value.trim();
  if (!raw) { mostrarToast('Cole o JSON do catálogo', 'aviso'); return; }
  let itens;
  try { itens = JSON.parse(raw); } catch(e) { mostrarToast('JSON inválido: ' + e.message, 'erro'); return; }
  if (!Array.isArray(itens)) { mostrarToast('JSON deve ser um array de itens', 'erro'); return; }

  const rpgId = AVT_STATE.rpgId;
  if (!rpgId) { mostrarToast('Aventura não carregada', 'erro'); return; }

  mostrarToast('Importando...', '');
  let sucesso = 0, falha = 0;
  for (const item of itens) {
    try {
      await _avtSb('item_catalog', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ ...item, rpg_id: rpgId })
      });
      sucesso++;
    } catch(e) { falha++; }
  }

  // Reload catalog
  const catalog = await _avtSb(`item_catalog?rpg_id=eq.${encodeURIComponent(rpgId)}&select=id,nome,tipo,icone,raridade,img_url,slot_padrao,atributos_bonus,droppable,drop_rate`).catch(()=>[]);
  AVT_STATE.itemCatalog = catalog || [];

  document.getElementById('avt-catalog-import-modal')?.remove();
  mostrarToast(`Catálogo importado: ${sucesso} item(ns)${falha ? `, ${falha} erro(s)` : ''}`, sucesso ? 'sucesso' : 'erro');
}
window.avtImportarCatalogoConfirmar = avtImportarCatalogoConfirmar;

// ─── END CATALOG IMPORT ───────────────────────────────────────────────────────

function avtMestrePainel() {
  const panel = document.getElementById('avt-mestre-panel');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'flex';
  if (!open) _avtMestrePainelRender();
}

function _avtPlaySkillAnim(sk, alvoEnt) {
  if (!sk || !alvoEnt) return;
  const anim = sk.animacao || {};
  const tipo = anim.tipo || 'nenhuma';
  if (tipo === 'nenhuma') return;

  const canvas = AVT_STATE.canvas;
  if (!canvas) return;
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera.zoom || 1));
  const screenX = Math.round(alvoEnt.x * SZ - AVT_STATE.camera.x + SZ / 2);
  const screenY = Math.round(alvoEnt.y * SZ - AVT_STATE.camera.y + SZ / 2);

  if (tipo === 'simples' || tipo === 'gsap') {
    // Draw flash directly on the adventure canvas
    _avtCanvasFlash(screenX, screenY, anim.cor || anim.gsap_config?.cor || '#e74c3c', anim.subtipo || anim.gsap_config?.preset || 'Impacto');
    return;
  }

  if (tipo === 'pixi_particulas' && anim.particle_config) {
    _avtPixiParticleAnim(anim.particle_config, screenX, screenY);
    return;
  }

  if (tipo === 'pixi_spine' && anim.spine_config) {
    _avtPixiSpineAnim(anim.spine_config, screenX, screenY);
    return;
  }
}

function _avtCanvasFlash(screenX, screenY, cor, tipo) {
  const canvas = AVT_STATE.canvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera.zoom || 1));

  let frame = 0;
  const FRAMES = 8;
  function draw() {
    if (frame >= FRAMES) return;
    frame++;
    const alpha = 1 - frame / FRAMES;
    const radius = SZ * 0.5 * (1 + frame * 0.15);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.fillStyle = cor;
    ctx.shadowColor = cor;
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.restore();
    requestAnimationFrame(draw);
  }
  draw();
}

function _avtPixiParticleAnim(particleConfig, screenX, screenY) {
  // Create a temporary PIXI app overlaid on the adventure canvas
  const canvas = AVT_STATE.canvas;
  if (!canvas) return;
  if (typeof PIXI === 'undefined') {
    // Fallback to simple flash
    _avtCanvasFlash(screenX, screenY, '#e74c3c', 'Impacto');
    return;
  }

  const existingOverlay = document.getElementById('avt-pixi-particle-overlay');
  if (existingOverlay) existingOverlay.remove();

  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.id = 'avt-pixi-particle-overlay';
  overlayCanvas.width = canvas.width;
  overlayCanvas.height = canvas.height;
  overlayCanvas.style.cssText = `position:absolute;left:${canvas.offsetLeft}px;top:${canvas.offsetTop}px;pointer-events:none;z-index:100`;
  canvas.parentElement.style.position = 'relative';
  canvas.parentElement.appendChild(overlayCanvas);

  try {
    const app = new PIXI.Application({ view: overlayCanvas, backgroundAlpha: 0, width: canvas.width, height: canvas.height });

    const texList = [PIXI.Texture.WHITE];
    const duration = (particleConfig.lifetime?.max || 1.5) * 1000 + 200;

    // Use @pixi/particle-emitter if available, otherwise just clean up
    if (typeof PIXI.particles?.Emitter !== 'undefined' || typeof window.PIXI_PARTICLES !== 'undefined') {
      const EmitterClass = PIXI.particles?.Emitter || window.PIXI_PARTICLES?.Emitter;
      const container = new PIXI.Container();
      app.stage.addChild(container);
      try {
        const emitter = new EmitterClass(container, { ...particleConfig, pos: { x: screenX, y: screenY } });
        emitter.emit = true;
        let elapsed = 0;
        app.ticker.add((delta) => {
          elapsed += app.ticker.deltaMS;
          emitter.update(app.ticker.deltaMS * 0.001);
          if (elapsed > duration) { emitter.emit = false; }
        });
      } catch(e) { /* emitter API mismatch — skip */ }
    }

    setTimeout(() => {
      app.destroy(true);
      overlayCanvas.remove();
    }, duration + 500);
  } catch(e) {
    overlayCanvas.remove();
    _avtCanvasFlash(screenX, screenY, '#e74c3c', 'Impacto');
  }
}

function _avtPixiSpineAnim(spineConfig, screenX, screenY) {
  // Pixi Spine requires assets; fall back to canvas flash if not available
  if (typeof PIXI === 'undefined' || !spineConfig?.skeleton) {
    _avtCanvasFlash(screenX, screenY, '#9b59b6', 'Impacto');
    return;
  }

  const canvas = AVT_STATE.canvas;
  if (!canvas) return;

  const existingOverlay = document.getElementById('avt-pixi-spine-overlay');
  if (existingOverlay) existingOverlay.remove();

  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.id = 'avt-pixi-spine-overlay';
  overlayCanvas.width = canvas.width;
  overlayCanvas.height = canvas.height;
  overlayCanvas.style.cssText = `position:absolute;left:${canvas.offsetLeft}px;top:${canvas.offsetTop}px;pointer-events:none;z-index:101`;
  canvas.parentElement.style.position = 'relative';
  canvas.parentElement.appendChild(overlayCanvas);

  const duration = spineConfig.duracao || 1000;
  try {
    const app = new PIXI.Application({ view: overlayCanvas, backgroundAlpha: 0, width: canvas.width, height: canvas.height });
    PIXI.Assets.load([spineConfig.skeleton, spineConfig.atlas].filter(Boolean)).then(resources => {
      try {
        const SpineClass = PIXI.spine?.Spine || window.PIXI_SPINE?.Spine;
        if (SpineClass) {
          const spine = new SpineClass(resources[spineConfig.skeleton]?.spineData);
          spine.x = screenX;
          spine.y = screenY;
          spine.scale.set(spineConfig.scale || 1);
          if (spineConfig.animation) spine.state.setAnimation(0, spineConfig.animation, false);
          app.stage.addChild(spine);
        }
      } catch(e) { /* spine load error */ }
    }).catch(() => {});
  } catch(e) {
    overlayCanvas.remove();
  }

  setTimeout(() => {
    try { app.destroy(true); } catch(_) {}
    document.getElementById('avt-pixi-spine-overlay')?.remove();
  }, duration + 500);
}

function _avtMestrePainelRender() {
  const panel = document.getElementById('avt-mestre-panel');
  if (!panel) return;
  const membros = AVT_STATE.membros.filter(m => m.role !== 'mestre');
  const aba = AVT_STATE.mestrePainelAba;

  const abas = [
    { id: 'modo',        label: '🎮 Modo Mestre' },
    { id: 'combate',     label: '⚔ Combate' },
    { id: 'npcs',        label: '🤖 NPCs' },
    { id: 'personagens', label: '👤 Personagens' },
    { id: 'jogadores', label: '🎮 Jogadores' },
    { id: 'mapa',        label: '🗺 Mapa' },
    { id: 'campanha',    label: '🏰 Campanha', perigo: true },
  ];

  panel.style.display = 'flex';
  panel.innerHTML = `
    <div class="avt-mp-header" style="flex-shrink:0;padding:10px 14px">
      <span>⚙ PAINEL DO MESTRE</span>
      <button onclick="avtMestrePainel()" style="background:none;border:none;color:#7a92aa;cursor:pointer;font-size:1.2rem;padding:0;line-height:1">×</button>
    </div>
    <div class="avt-mp-body">
      <nav class="avt-mp-nav">
        ${abas.map(a => `<button class="avt-mp-nav-btn${aba===a.id?' ativo':''}${a.perigo?' perigo':''}"
          onclick="_avtMpAba('${a.id}')">${a.label}</button>`).join('')}
      </nav>
      <div class="avt-mp-content">${_avtMpConteudoAba()}</div>
    </div>`;
}

function _avtMpAba(aba) {
  AVT_STATE.mestrePainelAba = aba;
  _avtMestrePainelRender();
}

function _avtMpConteudoAba() {
  const batalhas = AVT_STATE.batalhas;
  const npcs = AVT_STATE.entidades.filter(e => e.tipo === 'inimigo' && e.hp > 0);
  const jogadores = AVT_STATE.entidades.filter(e => e.tipo === 'jogador');
  const membros = AVT_STATE.membros.filter(m => m.role !== 'mestre');

  switch (AVT_STATE.mestrePainelAba) {

    case 'modo': return `
      <div class="avt-mp-secao">
        <button class="avt-mp-toggle-btn ${AVT_STATE.mestreAtivo ? 'avt-mp-toggle-on' : ''}"
          onclick="AVT_STATE.mestreAtivo=!AVT_STATE.mestreAtivo;_avtMestrePainelRender();mostrarToast(AVT_STATE.mestreAtivo?'Controle total ativado':'Modo mestre desativado','ok')">
          <span class="avt-mp-toggle-dot"></span>
          ${AVT_STATE.mestreAtivo ? '🟢 Controle total ATIVO' : '⚪ Controle total INATIVO'}
        </button>
        <div class="avt-mp-hint">ATIVO: move qualquer personagem. INATIVO: move apenas o seu.</div>
      </div>
      <div class="avt-mp-secao">
        <div class="avt-mp-label">📍 Reposicionar entidade</div>
        <div class="avt-mp-hint" style="margin-bottom:6px">Selecione uma entidade e clique no mapa para mover.</div>
        <select id="avt-mp-repos-sel" style="width:100%;padding:5px 7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem;margin-bottom:6px">
          <option value="">Escolher entidade…</option>
          ${AVT_STATE.entidades.map(e=>`<option value="${e.id}" ${AVT_STATE.mestreReposicionando===e.id?'selected':''}>${e.tipo==='jogador'?'🧙':'👹'} ${e.nome} (${e.hp}/${e.hpMax}HP)</option>`).join('')}
        </select>
        <button class="avt-mp-btn avt-mp-btn-ok" style="width:100%" onclick="_avtMestreIniciarRepos()">📍 Iniciar reposicionamento</button>
        ${AVT_STATE.mestreReposicionando ? `<div class="avt-mp-hint" style="color:#c8a84b;margin-top:4px">⚡ Clique no mapa para mover a entidade selecionada</div>` : ''}
      </div>`;

    case 'combate': return `
      <div class="avt-mp-secao">
        <div class="avt-mp-row" style="flex-wrap:wrap;gap:6px;margin-bottom:8px">
          <button class="avt-mp-btn avt-mp-btn-ok" onclick="avtCombateIniciar(null);_avtMestrePainelRender()">⚔ Iniciar combate geral</button>
        </div>
        ${batalhas.length ? batalhas.map(bat => {
          const envNomes = bat.envolvidos.map(id => {
            const e = AVT_STATE.entidades.find(x => x.id === id);
            return e ? `${e.tipo==='jogador'?'🧙':'👹'} ${e.nome}` : '';
          }).filter(Boolean).join(', ');
          const ativoNome = bat.iniciativa[bat.turnoIdx]?.nome || '?';
          return `<div style="margin-bottom:8px;padding:8px;border-radius:7px;border:1px solid rgba(231,76,60,0.2);background:rgba(231,76,60,0.04)">
            <div style="font-size:0.7rem;color:#c8d8e8;font-weight:bold;margin-bottom:3px">⚔ Combate ativo</div>
            <div style="font-size:0.62rem;color:#7a92aa;margin-bottom:3px">${envNomes}</div>
            <div style="font-size:0.62rem;color:#c8a84b;margin-bottom:6px">Turno: ${ativoNome}</div>
            <div class="avt-mp-row" style="gap:4px">
              <button class="avt-mp-btn avt-mp-btn-danger" onclick="avtCombateEncerrar('${bat.id}');_avtMestrePainelRender()">✕ Encerrar</button>
              <button class="avt-mp-btn" onclick="_avtPassarTurnoBatalha('${bat.id}')">⏭ Passar turno</button>
            </div>
          </div>`;
        }).join('') : `<div class="avt-mp-hint">Nenhum combate em andamento.</div>`}
        <div style="margin-top:8px">
          <button class="avt-mp-toggle-btn ${AVT_STATE.batalhaAutoSuspensa ? 'avt-mp-toggle-warn' : ''}"
            onclick="AVT_STATE.batalhaAutoSuspensa=!AVT_STATE.batalhaAutoSuspensa;_avtMestrePainelRender();mostrarToast(AVT_STATE.batalhaAutoSuspensa?'Batalha automática suspensa':'Batalha automática ativa','ok')">
            <span class="avt-mp-toggle-dot"></span>
            ${AVT_STATE.batalhaAutoSuspensa ? '🚫 Batalha auto: SUSPENSA' : '✅ Batalha auto: ATIVA'}
          </button>
          <div class="avt-mp-hint">Suspender impede que aproximação de inimigos inicie combate automaticamente.</div>
        </div>
      </div>`;

    case 'npcs': return `
      <div class="avt-mp-secao">
        <button class="avt-mp-toggle-btn ${AVT_STATE.npcIaAtiva ? 'avt-mp-toggle-on' : ''}"
          onclick="AVT_STATE.npcIaAtiva=!AVT_STATE.npcIaAtiva;_avtMestrePainelRender()">
          <span class="avt-mp-toggle-dot"></span>
          ${AVT_STATE.npcIaAtiva ? '🟢 IA de NPCs ATIVA' : '⚪ IA de NPCs INATIVA'}
        </button>
        ${npcs.length ? `
          <div class="avt-mp-row" style="margin-top:8px">
            <select id="avt-mp-npc-sel" style="flex:1;padding:5px 7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem">
              <option value="">Escolher NPC…</option>
              ${npcs.map(n=>`<option value="${n.id}" ${AVT_STATE.npcControlando===n.id?'selected':''}>${n.nome} (${n.hp}/${n.hpMax} HP)</option>`).join('')}
            </select>
            <button class="avt-mp-btn" onclick="_avtMestreAssumir()">🎮 Assumir</button>
            ${AVT_STATE.npcControlando ? `<button class="avt-mp-btn avt-mp-btn-danger" onclick="AVT_STATE.npcControlando=null;_avtMestrePainelRender()">✕ Liberar</button>` : ''}
          </div>
        ` : ''}
        ${(() => {
          const mortos = AVT_STATE.entidades.filter(e => e.tipo==='inimigo' && e.escondido);
          return mortos.length ? `
            <div class="avt-mp-label" style="margin-top:10px">💀 NPCs mortos (respawn manual)</div>
            ${mortos.map(e=>`<div class="avt-mp-row" style="margin-top:4px">
              <span style="flex:1;font-size:0.72rem;color:#7a92aa">${e.nome}</span>
              <button class="avt-mp-btn avt-mp-btn-ok" onclick="avtRespawnNpc('${e.id}');_avtMestrePainelRender()">↺ Respawnar</button>
            </div>`).join('')}` : `<div class="avt-mp-hint" style="margin-top:6px">Nenhum NPC no momento.</div>`;
        })()}
      </div>`;

    case 'personagens': return `
      <div class="avt-mp-secao">
        ${AVT_STATE.entidades.length ? AVT_STATE.entidades.map(e => {
          const pct = Math.max(0, Math.min(100, (e.hp / e.hpMax) * 100));
          const cor = pct < 30 ? '#e74c3c' : pct < 60 ? '#f0cc6a' : '#27ae60';
          const batEnt = _avtBatalhaDeEnt(e.id);
          return `<div class="avt-mp-char-row" style="cursor:default">
            <span class="avt-mp-char-dot" style="background:${e.cor}"></span>
            <span class="avt-mp-char-nome" style="cursor:pointer" onclick="abrirAvtCharEditor('${e.id}');avtMestrePainel()">${e.nome}</span>
            <div class="avt-mp-hp-wrap" style="cursor:pointer" onclick="abrirAvtCharEditor('${e.id}');avtMestrePainel()">
              <div class="avt-mp-hp-bar" style="width:${pct}%;background:${cor}"></div>
            </div>
            <span class="avt-mp-char-hp" style="color:${cor}">${e.hp}/${e.hpMax}</span>
            ${batEnt ? `<span style="font-size:0.58rem;color:#e74c3c" title="Em combate">⚔</span>` : ''}
            <button title="Reposicionar no mapa" onclick="AVT_STATE.mestreReposicionando='${e.id}';mostrarToast('📍 Clique no mapa para mover ${e.nome.replace(/'/g,"\\'")}','ok');avtMestrePainel()"
              style="padding:2px 5px;font-size:0.62rem;background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.2);border-radius:4px;color:#4fa3d1;cursor:pointer;flex-shrink:0">📍</button>
          </div>`;
        }).join('') : `<div class="avt-mp-hint">Nenhum personagem na cena.</div>`}
      </div>`;

    case 'jogadores': return `
      <div class="avt-mp-secao">
        <div class="avt-mp-hint">Vincule jogadores ao personagem pelo nome de usuário.</div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <input id="avt-mp-add-nick" placeholder="Nome de usuário…" style="flex:1;padding:4px 7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.72rem;outline:none">
          <button class="avt-mp-btn avt-mp-btn-ok" onclick="_avtAdicionarMembro(document.getElementById('avt-mp-add-nick').value)">+ Add</button>
        </div>
        ${membros.length ? membros.map(m => {
          const esc = m.player_id.replace(/'/g,"\\'");
          const allChars = AVT_STATE.chars || [];
          return `<div style="display:flex;align-items:center;gap:6px;margin-top:8px">
            <span style="flex:1;font-size:0.72rem;color:#c8d8e8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${m.player_id}">${m.nickname||m.player_id.slice(0,8)}</span>
            <select onchange="_avtMestreAtribuirJogador('${esc}',this.value)"
              style="flex:1;padding:3px 5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.68rem">
              <option value="">— nenhum —</option>
              ${allChars.map(j=>`<option value="${j.nome}" ${m.linked===j.nome?'selected':''}>${j.nome}</option>`).join('')}
            </select>
            <button onclick="_avtRemoverMembro('${esc}')" style="padding:2px 6px;background:none;border:1px solid rgba(231,76,60,0.3);border-radius:4px;color:#e74c3c88;font-size:0.7rem;cursor:pointer" title="Remover">✕</button>
          </div>`;
        }).join('') : `<div style="margin-top:8px;font-size:0.7rem;color:#7a92aa;font-style:italic">Nenhum jogador adicionado ainda.</div>`}
      </div>`;

    case 'mapa': {
      const fases = AVT_STATE.rpg?.theme_json?.fases_extras || [];
      return `
      <div class="avt-mp-secao">
        <button class="avt-mp-toggle-btn ${AVT_STATE.mestreVisaoGeral?'avt-mp-toggle-on':''}" onclick="_avtMestreToggleVisao();_avtMestrePainelRender()">
          <span class="avt-mp-toggle-dot"></span>
          ${AVT_STATE.mestreVisaoGeral ? '👁 Visão geral ATIVA' : '👁 Visão geral INATIVA'}
        </button>
      </div>
      <div class="avt-mp-secao">
        <div class="avt-mp-label">Editar mapa</div>
        <div class="avt-mp-row" style="flex-wrap:wrap;gap:6px">
          <button class="avt-mp-btn" onclick="_avtMestreAddInimigo()">👹 + NPC/Boss</button>
          <button class="avt-mp-btn" onclick="avtMestreAbrirEditor()">✏ Editar Manual</button>
          <button class="avt-mp-btn" onclick="_avtMestreAbrirEditorTileset()">🎨 Editar com Tileset</button>
        </div>
      </div>
      ${AVT_STATE._faseAnterior ? `
      <div class="avt-mp-secao">
        <button class="avt-mp-btn avt-mp-btn-ok" style="width:100%" onclick="_avtVoltarFaseAnterior()">⬅ Voltar ao mapa anterior</button>
      </div>` : ''}
      <div class="avt-mp-secao">
        <div class="avt-mp-label">Fases extras</div>
        <button class="avt-mp-btn avt-mp-btn-ok" style="width:100%;margin-bottom:8px" onclick="_avtMestreNovaFase()">🚪 + Nova Fase</button>
        ${fases.length ? fases.map(f => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;background:rgba(79,163,209,0.04);border:1px solid rgba(79,163,209,0.1);margin-bottom:4px">
            <span style="flex:1;font-size:0.72rem;color:#c8d8e8">${f.nome}</span>
            <span style="font-size:0.62rem;color:#7a92aa">${f.porta.lock_type==='livre'?'🔓':f.porta.lock_type==='chave'?'🔑':'⚔'} (${f.porta.col},${f.porta.row})</span>
            <button class="avt-mp-btn" style="flex:0;padding:3px 7px;min-width:0;font-size:0.65rem" onclick="_avtEntrarFaseExtra(AVT_STATE.rpg.theme_json.fases_extras.find(x=>x.id==='${f.id}'))">▶</button>
            <button class="avt-mp-btn avt-mp-btn-danger" style="flex:0;padding:3px 7px;min-width:0" onclick="_avtMestreRemoverFase('${f.id}')">✕</button>
          </div>`).join('')
        : `<div class="avt-mp-hint">Nenhuma fase extra criada.</div>`}
      </div>`;
    }

    case 'campanha': return `
      <div class="avt-mp-secao">
        <div class="avt-mp-hint">Ações permanentes da campanha atual.</div>
        <button class="avt-mp-btn avt-mp-btn-danger" style="width:100%;margin-top:12px"
          onclick="_avtMestreExcluirCampanha()">🗑 Excluir campanha</button>
      </div>`;

    default: return '';
  }
}

function avtMestreAbrirEditor() {
  const dungeon = AVT_STATE.dungeon;
  if (!dungeon) { mostrarToast('Nenhum mapa carregado', 'aviso'); return; }

  // Build editor overlay
  let overlay = document.getElementById('avt-mestre-map-editor-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'avt-mestre-map-editor-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9500;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:16px;overflow:auto';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';

  const EDSZ = 14;
  const W = dungeon.w, H = dungeon.h;

  // Copy tiles for editing
  _avtEd.tiles = dungeon.tiles.map(row => [...row]);
  _avtEd.w = W;
  _avtEd.h = H;

  overlay.innerHTML = `
    <div style="width:100%;max-width:900px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-family:var(--fonte-d);font-size:1rem;color:#c8d8e8">✏ Editor de Mapa</div>
        <div style="display:flex;gap:8px">
          <button class="avt-mp-btn avt-mp-btn-ok" onclick="avtMestreSalvarMapaEditado()">💾 Salvar</button>
          <button class="avt-mp-btn avt-mp-btn-danger" onclick="document.getElementById('avt-mestre-map-editor-overlay').style.display='none'">✕ Fechar</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        ${[
          ['piso','🟫 Piso'],['parede','🔲 Parede'],['entrada','🚪 Entrada'],['saida','🟢 Saída'],
          ['agua','💧 Água'],['armadilha','⚠ Armadilha']
        ].map(([v,l]) => `<button class="avt-mp-btn ${_avtEd.acao===v?'avt-mp-btn-ativo':''}"
          onclick="document.querySelectorAll('#avt-mestre-map-editor-overlay .avt-mp-btn').forEach(b=>b.classList.remove('avt-mp-btn-ativo'));this.classList.add('avt-mp-btn-ativo');_avtEd.acao='${v}'">${l}</button>`).join('')}
      </div>
      <div style="overflow:auto;max-height:60vh;border:1px solid rgba(255,255,255,0.1);border-radius:8px">
        <canvas id="avt-ed-canvas-mestre" style="display:block;image-rendering:pixelated"></canvas>
      </div>
      <div style="margin-top:8px;font-size:0.68rem;color:#7a92aa">Clique/arraste para pintar tiles. A câmera da sessão será atualizada ao salvar.</div>
    </div>`;

  const canvas = document.getElementById('avt-ed-canvas-mestre');
  if (!canvas) return;
  canvas.width = W * EDSZ;
  canvas.height = H * EDSZ;
  canvas.style.width = (W * EDSZ) + 'px';
  canvas.style.height = (H * EDSZ) + 'px';

  function renderMestreEditor() {
    const ctx = canvas.getContext('2d');
    const TILE_COLORS = { piso:'#2a1f14', parede:'#0a0a0a', entrada:'#1a3a1a', saida:'#1a3a1a', agua:'#0a1a2a', armadilha:'#2a0a0a', null:'#050810' };
    const BORDER_COLORS = { piso:'#3a2a18', parede:'#222', entrada:'#27ae60', saida:'#2ecc71', agua:'#1a4a6a', armadilha:'#8e2020' };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = _avtEd.tiles[y]?.[x];
        ctx.fillStyle = TILE_COLORS[t] || TILE_COLORS['null'];
        ctx.fillRect(x * EDSZ, y * EDSZ, EDSZ, EDSZ);
        ctx.strokeStyle = BORDER_COLORS[t] || '#111';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x * EDSZ + 0.5, y * EDSZ + 0.5, EDSZ - 1, EDSZ - 1);
      }
    }
    // Draw entities
    AVT_STATE.entidades.forEach(ent => {
      if (ent.x < 0 || ent.x >= W || ent.y < 0 || ent.y >= H) return;
      ctx.fillStyle = ent.cor || (ent.tipo === 'jogador' ? '#4fa3d1' : '#e74c3c');
      ctx.beginPath();
      ctx.arc(ent.x * EDSZ + EDSZ/2, ent.y * EDSZ + EDSZ/2, EDSZ/2 - 1, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  renderMestreEditor();

  let painting = false;
  function paintTile(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W * EDSZ / rect.width;
    const scaleY = H * EDSZ / rect.height;
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const tx = Math.floor(cx * scaleX / EDSZ);
    const ty = Math.floor(cy * scaleY / EDSZ);
    if (tx < 0 || tx >= W || ty < 0 || ty >= H) return;
    if (!_avtEd.tiles[ty]) _avtEd.tiles[ty] = [];
    _avtEd.tiles[ty][tx] = _avtEd.acao;
    renderMestreEditor();
  }
  canvas.addEventListener('mousedown', e => { painting = true; paintTile(e); });
  canvas.addEventListener('mousemove', e => { if (painting) paintTile(e); });
  canvas.addEventListener('mouseup', () => { painting = false; });
  canvas.addEventListener('touchstart', e => { e.preventDefault(); painting = true; paintTile(e); });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); if (painting) paintTile(e); });
  canvas.addEventListener('touchend', () => { painting = false; });
}

async function avtMestreSalvarMapaEditado() {
  if (!_avtEd.tiles || !AVT_STATE.dungeon) return;
  AVT_STATE.dungeon.tiles = _avtEd.tiles.map(row => [...row]);
  const overlay = document.getElementById('avt-mestre-map-editor-overlay');
  if (overlay) overlay.style.display = 'none';
  // Persist to DB
  try {
    const themeJson = AVT_STATE.rpg?.theme_json || {};
    const newTheme = { ...themeJson, dungeon_data: AVT_STATE.dungeon };
    await _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ theme_json: newTheme })
    });
    mostrarToast('Mapa salvo!', 'ok');
  } catch(e) {
    mostrarToast('Mapa atualizado localmente (erro ao persistir: ' + (e?.message||e) + ')', 'aviso');
  }
}

// ─── Excluir campanha ────────────────────────────────────────────────────────
async function _avtMestreExcluirCampanha() {
  const nome = AVT_STATE.rpg?.name || 'esta campanha';
  if (!confirm(`Excluir "${nome}"? Esta ação não pode ser desfeita.`)) return;
  try {
    await deleteRPGData(AVT_STATE.rpgId);
    mostrarToast('Campanha excluída', 'ok');
    setTimeout(sairAventura, 800);
  } catch(e) {
    mostrarToast('Erro ao excluir: ' + (e?.message || e), 'erro');
  }
}

// ─── Editor com Tileset ───────────────────────────────────────────────────────
function _avtMestreAbrirEditorTileset() {
  const dungeon = AVT_STATE.dungeon;
  if (!dungeon) { mostrarToast('Nenhum mapa carregado', 'aviso'); return; }
  const tilesetUrl = AVT_STATE.rpg?.theme_json?.tileset_img_url;

  let overlay = document.getElementById('avt-mestre-map-editor-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'avt-mestre-map-editor-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9500;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:16px;overflow:auto';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';

  const EDSZ = 14;
  const W = dungeon.w, H = dungeon.h;
  _avtEd.tiles = dungeon.tiles.map(row => [...row]);
  _avtEd.w = W; _avtEd.h = H;
  if (!_avtEd.tilesetPaints) _avtEd.tilesetPaints = Object.assign({}, AVT_STATE.rpg?.theme_json?.tileset_paints || {});
  _avtEd.tsBrush = null; // {tc, tr}
  const TSCOLS = 8; // assumed tileset grid columns

  if (!tilesetUrl) {
    overlay.innerHTML = `
      <div style="width:100%;max-width:900px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div style="font-family:var(--fonte-d);font-size:1rem;color:#c8d8e8">🎨 Editor com Tileset</div>
          <button class="avt-mp-btn avt-mp-btn-danger" onclick="document.getElementById('avt-mestre-map-editor-overlay').style.display='none'">✕ Fechar</button>
        </div>
        <div style="color:#f0cc6a;font-size:0.8rem;padding:16px;border:1px solid rgba(240,204,106,0.3);border-radius:8px;background:rgba(240,204,106,0.06)">
          ⚠ Nenhum tileset disponível para este dungeon. Para usar esta função, gere um tileset na criação do dungeon. Alternativa: use o <button class="avt-mp-btn" style="display:inline-block;width:auto;margin-left:6px" onclick="document.getElementById('avt-mestre-map-editor-overlay').style.display='none';avtMestreAbrirEditor()">✏ Editor Manual</button>
        </div>
      </div>`;
    return;
  }

  overlay.innerHTML = `
    <div style="width:100%;max-width:1100px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-family:var(--fonte-d);font-size:1rem;color:#c8d8e8">🎨 Editor com Tileset</div>
        <div style="display:flex;gap:8px">
          <button class="avt-mp-btn avt-mp-btn-ok" onclick="_avtMestreSalvarTilesetPaints()">💾 Salvar</button>
          <button class="avt-mp-btn avt-mp-btn-danger" onclick="document.getElementById('avt-mestre-map-editor-overlay').style.display='none'">✕ Fechar</button>
        </div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:0 0 auto">
          <div style="font-size:0.64rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Tileset — clique para selecionar bloco</div>
          <div id="avt-ts-picker" style="border:1px solid rgba(79,163,209,0.2);border-radius:6px;overflow:hidden;cursor:crosshair;position:relative">
            <img id="avt-ts-img" src="${tilesetUrl}" style="display:block;image-rendering:pixelated;max-width:256px">
            <canvas id="avt-ts-overlay" style="position:absolute;top:0;left:0;pointer-events:none"></canvas>
          </div>
          <div id="avt-ts-brush-info" style="font-size:0.62rem;color:#4fa3d1;margin-top:4px">Nenhum bloco selecionado</div>
        </div>
        <div style="flex:1;min-width:260px">
          <div style="font-size:0.64rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Mapa — clique/arraste para pintar</div>
          <div style="overflow:auto;max-height:65vh;border:1px solid rgba(255,255,255,0.1);border-radius:8px">
            <canvas id="avt-ed-canvas-mestre" style="display:block;image-rendering:pixelated"></canvas>
          </div>
          <div style="margin-top:6px;font-size:0.62rem;color:#7a92aa">Clique com brush selecionado para pintar. Clique sem brush para apagar decoração.</div>
        </div>
      </div>
    </div>`;

  const canvas = document.getElementById('avt-ed-canvas-mestre');
  canvas.width = W * EDSZ; canvas.height = H * EDSZ;
  canvas.style.width = (W * EDSZ) + 'px'; canvas.style.height = (H * EDSZ) + 'px';

  const tsImg = document.getElementById('avt-ts-img');
  const tsPicker = document.getElementById('avt-ts-picker');
  const tsOverlay = document.getElementById('avt-ts-overlay');

  function renderTsEditor() {
    const ctx = canvas.getContext('2d');
    const TILE_COLORS = { piso:'#2a1f14', parede:'#0a0a0a', entrada:'#1a3a1a', saida:'#1a3a1a', agua:'#0a1a2a', armadilha:'#2a0a0a', null:'#050810' };
    const BORDER_COLORS = { piso:'#3a2a18', parede:'#222', entrada:'#27ae60', saida:'#2ecc71', agua:'#1a4a6a', armadilha:'#8e2020' };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = _avtEd.tiles[y]?.[x];
        ctx.fillStyle = TILE_COLORS[t] || TILE_COLORS['null'];
        ctx.fillRect(x * EDSZ, y * EDSZ, EDSZ, EDSZ);
        ctx.strokeStyle = BORDER_COLORS[t] || '#111';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x * EDSZ + 0.5, y * EDSZ + 0.5, EDSZ - 1, EDSZ - 1);
      }
    }
    // Draw tileset paints
    if (tsImg.complete && tsImg.naturalWidth) {
      const tsW = tsImg.naturalWidth, tsH = tsImg.naturalHeight;
      const TSROWS = Math.ceil(tsH / (tsW / TSCOLS));
      const tcSz = tsW / TSCOLS;
      Object.entries(_avtEd.tilesetPaints).forEach(([key, p]) => {
        const [px, py] = key.split('_').map(Number);
        if (px < 0 || px >= W || py < 0 || py >= H) return;
        ctx.drawImage(tsImg, p.tc * tcSz, p.tr * (tsH / TSROWS), tcSz, tsH / TSROWS,
          px * EDSZ, py * EDSZ, EDSZ, EDSZ);
      });
    }
    // Draw entities
    AVT_STATE.entidades.forEach(ent => {
      if (ent.x < 0 || ent.x >= W || ent.y < 0 || ent.y >= H) return;
      ctx.fillStyle = ent.cor || (ent.tipo === 'jogador' ? '#4fa3d1' : '#e74c3c');
      ctx.beginPath();
      ctx.arc(ent.x * EDSZ + EDSZ/2, ent.y * EDSZ + EDSZ/2, EDSZ/2 - 1, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  tsImg.onload = () => {
    tsOverlay.width = tsImg.offsetWidth || tsImg.naturalWidth;
    tsOverlay.height = tsImg.offsetHeight || tsImg.naturalHeight;
    renderTsEditor();
  };
  if (tsImg.complete) { tsImg.onload(); }

  tsPicker.addEventListener('click', e => {
    const rect = tsImg.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const cellW = rect.width / TSCOLS;
    const tsH = tsImg.naturalHeight, tsW = tsImg.naturalWidth;
    const TSROWS = Math.ceil(tsH / (tsW / TSCOLS));
    const cellH = rect.height / TSROWS;
    const tc = Math.floor(x / cellW), tr = Math.floor(y / cellH);
    _avtEd.tsBrush = { tc, tr };
    document.getElementById('avt-ts-brush-info').textContent = `Bloco selecionado: coluna ${tc}, linha ${tr}`;
    // Draw selection outline
    const oc = tsOverlay.getContext('2d');
    oc.clearRect(0, 0, tsOverlay.width, tsOverlay.height);
    oc.strokeStyle = '#4fa3d1';
    oc.lineWidth = 2;
    oc.strokeRect(tc * cellW + 1, tr * cellH + 1, cellW - 2, cellH - 2);
    tsOverlay.style.width = rect.width + 'px';
    tsOverlay.style.height = rect.height + 'px';
    tsOverlay.width = rect.width;
    tsOverlay.height = rect.height;
    oc.strokeRect(tc * cellW + 1, tr * cellH + 1, cellW - 2, cellH - 2);
  });

  let painting = false;
  function paintTs(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const tx = Math.floor(cx * W * EDSZ / rect.width / EDSZ);
    const ty = Math.floor(cy * H * EDSZ / rect.height / EDSZ);
    if (tx < 0 || tx >= W || ty < 0 || ty >= H) return;
    const key = `${tx}_${ty}`;
    if (_avtEd.tsBrush) {
      _avtEd.tilesetPaints[key] = { tc: _avtEd.tsBrush.tc, tr: _avtEd.tsBrush.tr };
    } else {
      delete _avtEd.tilesetPaints[key];
    }
    renderTsEditor();
  }
  canvas.addEventListener('mousedown', e => { painting = true; paintTs(e); });
  canvas.addEventListener('mousemove', e => { if (painting) paintTs(e); });
  canvas.addEventListener('mouseup', () => { painting = false; });
  canvas.addEventListener('touchstart', e => { e.preventDefault(); painting = true; paintTs(e); });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); if (painting) paintTs(e); });
  canvas.addEventListener('touchend', () => { painting = false; });
}

async function _avtMestreSalvarTilesetPaints() {
  if (!AVT_STATE.rpg) return;
  try {
    const newTheme = { ...(AVT_STATE.rpg.theme_json || {}), tileset_paints: _avtEd.tilesetPaints };
    AVT_STATE.rpg.theme_json = newTheme;
    await _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}`, {
      method: 'PATCH', body: JSON.stringify({ theme_json: newTheme })
    });
    document.getElementById('avt-mestre-map-editor-overlay').style.display = 'none';
    mostrarToast('Tileset salvo!', 'ok');
  } catch(e) {
    mostrarToast('Erro ao salvar: ' + (e?.message || e), 'erro');
  }
}

// ─── Nova Fase (wizard) ──────────────────────────────────────────────────────
function _avtMestreNovaFase() {
  AVT_STATE._novaFaseWizard = AVT_STATE._novaFaseWizard || {
    mapaOpcao: 'procedural', dungeon: null, _procSalas: 8,
    lock_type: 'livre', chave_palavra: '', npc_boss_id: '',
    porta_col: null, porta_row: null
  };
  _avtMestreNovaFaseRender();
}

function _avtMestreNovaFaseRender() {
  const overlay = document.getElementById('avt-anim-import-overlay');
  if (!overlay) return;
  const w = AVT_STATE._novaFaseWizard;
  const inimigos = AVT_STATE.entidades.filter(e => e.tipo === 'inimigo');
  const portaLabel = (w.porta_col != null && w.porta_row != null)
    ? `<span style="color:#27ae60">✓ Porta em (${w.porta_col}, ${w.porta_row})</span>`
    : `<span style="color:#7a92aa">Não definida</span>`;
  const mapaLabel = w.dungeon
    ? `<span style="color:#27ae60">✓ Mapa gerado (${w.dungeon.w}×${w.dungeon.h})</span>`
    : `<span style="color:#7a92aa">Nenhum mapa gerado</span>`;
  const mapOpts = [
    { v:'procedural', ico:'🎲', label:'Procedural' },
    { v:'json',       ico:'📋', label:'JSON (IA)' },
    { v:'claude',     ico:'⚡', label:'Claude API' },
    { v:'editor',     ico:'✏', label:'Editor' }
  ];

  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="avt-modal-box" style="max-width:540px;width:100%;max-height:90vh;overflow-y:auto">
      <div class="avt-modal-header">
        <span>🚪 Nova Fase</span>
        <button onclick="_avtNfCancelar()" style="background:none;border:none;color:#7a92aa;cursor:pointer;font-size:1.2rem;line-height:1;padding:0">×</button>
      </div>
      <div class="avt-modal-body" style="display:flex;flex-direction:column;gap:14px">

        <!-- Informações básicas -->
        <div>
          <label style="font-size:0.62rem;color:#7a92aa;display:block;margin-bottom:3px">Nome da fase</label>
          <input id="avt-nf-nome" value="${(w.nome||'').replace(/"/g,'&quot;')}" placeholder="Ex: Caverna do Norte"
            style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.78rem"
            oninput="AVT_STATE._novaFaseWizard.nome=this.value">
        </div>

        <!-- Tipo de bloqueio -->
        <div>
          <label style="font-size:0.62rem;color:#7a92aa;display:block;margin-bottom:5px">Tipo de bloqueio da porta</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            ${[['livre','🔓 Livre'],['chave','🔑 Chave'],['npc','⚔ Derrotar Boss']].map(([val,lbl])=>`
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.73rem;color:#c8d8e8">
                <input type="radio" name="avt-nf-lock" value="${val}" ${w.lock_type===val?'checked':''} onchange="_avtNfLockChange(this.value)"> ${lbl}
              </label>`).join('')}
          </div>
          <div id="avt-nf-extra" style="margin-top:8px">
            ${w.lock_type==='chave'?`<input id="avt-nf-chave" value="${(w.chave_palavra||'').replace(/"/g,'&quot;')}" placeholder="Palavra-chave (ex: chave_dourada)"
              oninput="AVT_STATE._novaFaseWizard.chave_palavra=this.value"
              style="width:100%;box-sizing:border-box;padding:5px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem">`:
            w.lock_type==='npc'?`<select id="avt-nf-npc" onchange="AVT_STATE._novaFaseWizard.npc_boss_id=this.value"
              style="width:100%;padding:5px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem">
              ${inimigos.length?inimigos.map(e=>`<option value="${e.id}" ${w.npc_boss_id===e.id?'selected':''}>${e.nome}${e.isBoss?' 👑':''} (${e.hp} HP)</option>`).join('')
                :'<option value="">— nenhum NPC na cena —</option>'}</select>`:''}
          </div>
        </div>

        <!-- Mapa -->
        <div>
          <div style="font-size:0.65rem;color:rgba(79,163,209,0.7);font-family:var(--fonte-d);text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px">Mapa da Fase</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:10px">
            ${mapOpts.map(o=>`
              <div onclick="_avtNfSelecionarMapa('${o.v}')"
                style="padding:8px 4px;text-align:center;border-radius:7px;border:1px solid ${w.mapaOpcao===o.v?'rgba(79,163,209,0.6)':'rgba(255,255,255,0.08)'};background:${w.mapaOpcao===o.v?'rgba(79,163,209,0.12)':'rgba(255,255,255,0.02)'};cursor:pointer">
                <div style="font-size:1.2rem;margin-bottom:3px">${o.ico}</div>
                <div style="font-size:0.62rem;color:#c8d8e8">${o.label}</div>
              </div>`).join('')}
          </div>
          <div id="avt-nf-mapa-sub"></div>
          <div style="font-size:0.68rem;margin-top:6px">${mapaLabel}</div>
        </div>

        <!-- Porta -->
        <div>
          <div style="font-size:0.65rem;color:rgba(79,163,209,0.7);font-family:var(--fonte-d);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Posição da Porta no Mapa Atual</div>
          <div style="display:flex;align-items:center;gap:10px">
            <button class="avt-mp-btn" onclick="_avtNfIniciarPlacement()">📍 Clique no mapa para definir</button>
            <span style="font-size:0.72rem">${portaLabel}</span>
          </div>
        </div>

      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
        <button class="avt-mp-btn" onclick="_avtNfCancelar()">Cancelar</button>
        <button class="avt-mp-btn avt-mp-btn-ok" onclick="_avtMestreSalvarNovaFase()">✓ Criar Fase</button>
      </div>
    </div>`;
  _avtNfRenderMapaSub(w.mapaOpcao);
}

function _avtNfCancelar() {
  AVT_STATE._novaFaseWizard = null;
  AVT_STATE._modoPortaPlacement = false;
  if (AVT_STATE.canvas) AVT_STATE.canvas.style.cursor = '';
  const overlay = document.getElementById('avt-anim-import-overlay');
  if (overlay) overlay.style.display = 'none';
}

function _avtNfLockChange(val) {
  if (!AVT_STATE._novaFaseWizard) return;
  AVT_STATE._novaFaseWizard.lock_type = val;
  const extra = document.getElementById('avt-nf-extra');
  if (!extra) return;
  const inimigos = AVT_STATE.entidades.filter(e => e.tipo === 'inimigo');
  if (val === 'chave') {
    extra.innerHTML = `<input id="avt-nf-chave" value="${(AVT_STATE._novaFaseWizard.chave_palavra||'').replace(/"/g,'&quot;')}" placeholder="Palavra-chave (ex: chave_dourada)"
      oninput="AVT_STATE._novaFaseWizard.chave_palavra=this.value"
      style="width:100%;box-sizing:border-box;padding:5px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem">`;
  } else if (val === 'npc') {
    extra.innerHTML = `<select id="avt-nf-npc" onchange="AVT_STATE._novaFaseWizard.npc_boss_id=this.value"
      style="width:100%;padding:5px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem">
      ${inimigos.length?inimigos.map(e=>`<option value="${e.id}">${e.nome}${e.isBoss?' 👑':''} (${e.hp} HP)</option>`).join('')
        :'<option value="">— nenhum NPC na cena —</option>'}</select>`;
  } else {
    extra.innerHTML = '';
  }
}

function _avtNfSelecionarMapa(opcao) {
  if (!AVT_STATE._novaFaseWizard) return;
  AVT_STATE._novaFaseWizard.mapaOpcao = opcao;
  // Update option card styles
  const grid = document.querySelector('#avt-nf-mapa-sub')?.parentElement?.querySelector('[style*="grid-template-columns"]');
  if (grid) {
    [...grid.children].forEach((el, i) => {
      const opts = ['procedural','json','claude','editor'];
      const sel = opts[i] === opcao;
      el.style.border = `1px solid ${sel?'rgba(79,163,209,0.6)':'rgba(255,255,255,0.08)'}`;
      el.style.background = sel?'rgba(79,163,209,0.12)':'rgba(255,255,255,0.02)';
    });
  }
  _avtNfRenderMapaSub(opcao);
}

function _avtNfRenderMapaSub(opcao) {
  const sub = document.getElementById('avt-nf-mapa-sub');
  if (!sub) return;
  const w = AVT_STATE._novaFaseWizard;
  const inp = `style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"`;

  if (opcao === 'procedural') {
    sub.innerHTML = `<div style="padding:10px;background:rgba(79,163,209,0.04);border:1px solid rgba(79,163,209,0.12);border-radius:7px">
      <div style="font-size:0.72rem;color:#c8d8e8;margin-bottom:8px">Dungeon BSP aleatória. Número de salas:</div>
      <div style="display:flex;align-items:center;gap:10px">
        <input type="range" min="3" max="30" value="${w._procSalas||8}" style="flex:1;accent-color:#4fa3d1"
          oninput="AVT_STATE._novaFaseWizard._procSalas=+this.value;document.getElementById('avt-nf-salas-val').textContent=this.value">
        <span id="avt-nf-salas-val" style="font-family:var(--fonte-d);color:#c8a84b;min-width:24px">${w._procSalas||8}</span>
        <span style="font-size:0.65rem;color:#7a92aa">salas</span>
      </div>
      <button class="avt-mp-btn avt-mp-btn-ok" style="margin-top:8px;width:100%" onclick="_avtNfGerarProcedural()">🎲 Pré-visualizar mapa</button>
    </div>`;
  } else if (opcao === 'json') {
    sub.innerHTML = `<div>
      <textarea id="avt-nf-json-input" rows="5" placeholder='Cole aqui o JSON gerado pela IA...'
        style="width:100%;box-sizing:border-box;padding:7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-family:monospace;font-size:0.68rem;resize:vertical"
        oninput="_avtNfJsonParse(this.value)"></textarea>
      <div id="avt-nf-json-status" style="font-size:0.68rem;color:#7a92aa;margin-top:4px"></div>
    </div>`;
  } else if (opcao === 'claude') {
    sub.innerHTML = `<div style="display:flex;flex-direction:column;gap:7px">
      <input id="avt-nf-claude-key" type="password" placeholder="Claude API Key (sk-ant-...)"
        value="${(localStorage.getItem('animgen_claude_key')||'').replace(/"/g,'&quot;')}" ${inp}>
      <input id="avt-nf-claude-desc" placeholder="Descreva a fase (ex: Vila abandonada com fantasmas)"
        value="${(w._claudeDesc||'').replace(/"/g,'&quot;')}"
        oninput="AVT_STATE._novaFaseWizard._claudeDesc=this.value" ${inp}>
      <button id="avt-nf-claude-btn" class="avt-mp-btn avt-mp-btn-ok" style="width:100%" onclick="_avtNfGerarComClaude()">⚡ Gerar mapa com Claude</button>
      <div id="avt-nf-claude-status" style="font-size:0.68rem;color:#7a92aa"></div>
    </div>`;
  } else if (opcao === 'editor') {
    sub.innerHTML = `<div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;align-items:center">
        <span style="font-size:0.65rem;color:#7a92aa">Tamanho:</span>
        <select id="avt-nf-ed-tamanho" onchange="_avtNfEditorTamanho(this.value)"
          style="padding:3px 6px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:4px;color:#c8d8e8;font-size:0.68rem">
          <option value="22x16">22×16</option>
          <option value="40x28" selected>40×28</option>
          <option value="60x40">60×40</option>
        </select>
        <button onclick="_avtNfEditorAcao('piso')" class="avt-ed-btn avt-ed-btn-ativo" id="avt-nf-btn-piso">Piso</button>
        <button onclick="_avtNfEditorAcao('parede')" class="avt-ed-btn" id="avt-nf-btn-parede">Parede</button>
        <button onclick="_avtNfEditorLimpar()" class="avt-ed-btn">Limpar</button>
        <button onclick="_avtNfEditorExport()" class="avt-mp-btn avt-mp-btn-ok" style="font-size:0.65rem;padding:3px 10px">✓ Usar este mapa</button>
      </div>
      <div style="overflow:auto;max-height:220px;border:1px solid rgba(79,163,209,0.12);border-radius:5px">
        <canvas id="avt-nf-ed-canvas" style="cursor:crosshair;display:block;touch-action:none"></canvas>
      </div>
    </div>`;
    setTimeout(_avtNfEditorInit, 50);
  }
}

function _avtNfGerarProcedural() {
  const w = AVT_STATE._novaFaseWizard;
  if (!w) return;
  const salas = w._procSalas || 8;
  const area = Math.max(22 * 16, salas * 60);
  const ww = Math.ceil(Math.sqrt(area * (22 / 16)));
  const hh = Math.ceil(area / ww);
  w.dungeon = _avtGerarDungeon(ww, hh, salas);
  const el = document.querySelector('#avt-nf-mapa-sub');
  if (el) {
    const st = document.createElement('div');
    st.style.cssText = 'font-size:0.68rem;color:#27ae60;margin-top:6px';
    st.textContent = `✓ Mapa gerado — ${w.dungeon.w}×${w.dungeon.h} tiles, ${salas} salas`;
    el.appendChild(st);
  }
  // Update status label
  const lbl = document.querySelector('[id="avt-anim-import-overlay"] .avt-modal-body > div:nth-child(3) > div:last-child');
  _avtMestreNovaFaseRender();
  mostrarToast('Mapa procedural gerado!', 'ok');
}

function _avtNfJsonParse(txt) {
  const st = document.getElementById('avt-nf-json-status');
  if (!txt.trim()) { if (st) st.textContent = ''; return; }
  try {
    const json = JSON.parse(txt);
    const dungeon = _avtJsonToDungeon(json);
    AVT_STATE._novaFaseWizard.dungeon = dungeon;
    if (st) st.innerHTML = `<span style="color:#27ae60">✓ Mapa válido — ${dungeon.w}×${dungeon.h} tiles</span>`;
  } catch(e) {
    AVT_STATE._novaFaseWizard.dungeon = null;
    if (st) st.innerHTML = `<span style="color:#e74c3c">✗ JSON inválido: ${e.message}</span>`;
  }
}

async function _avtNfGerarComClaude() {
  const w = AVT_STATE._novaFaseWizard;
  if (!w) return;
  const key = document.getElementById('avt-nf-claude-key')?.value?.trim() || localStorage.getItem('animgen_claude_key') || '';
  if (!key) { mostrarToast('Insira a Claude API Key', 'aviso'); return; }
  const desc = document.getElementById('avt-nf-claude-desc')?.value?.trim() || 'Uma dungeon com inimigos variados';
  w._claudeDesc = desc;
  const params = { w: 40, h: 28, salas: 10 };
  const btn = document.getElementById('avt-nf-claude-btn');
  const st = document.getElementById('avt-nf-claude-status');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Gerando…'; }
  if (st) st.textContent = `Gerando dungeon ${params.w}×${params.h}…`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true' },
      body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:8192,
        system:'Você é um gerador de mapas de dungeon para jogos RPG top-down. Retorne APENAS um JSON válido, sem texto adicional.',
        messages:[{ role:'user', content:`Gere um mapa de dungeon: "${desc}"\n\n${_avtGerarPromptJson(params)}` }]
      })
    });
    if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err?.error?.message||`HTTP ${res.status}`); }
    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Resposta sem JSON válido');
    const dungeon = _avtJsonToDungeon(JSON.parse(match[0]));
    w.dungeon = dungeon;
    localStorage.setItem('animgen_claude_key', key);
    if (st) st.innerHTML = `<span style="color:#27ae60">✓ Mapa gerado — ${dungeon.w}×${dungeon.h} tiles</span>`;
    mostrarToast('Mapa gerado com Claude!', 'ok');
  } catch(e) {
    if (st) st.innerHTML = `<span style="color:#e74c3c">✗ ${e.message}</span>`;
    mostrarToast('Erro Claude: ' + e.message, 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Gerar mapa com Claude'; }
  }
}

// Minimal canvas editor for nova fase
const _avtNfEd = { tiles: null, w: 40, h: 28, acao: 'piso', drawing: false };
function _avtNfEditorInit() {
  const canvas = document.getElementById('avt-nf-ed-canvas');
  if (!canvas) return;
  canvas.width = _avtNfEd.w * 12; canvas.height = _avtNfEd.h * 12;
  if (!_avtNfEd.tiles) _avtNfEd.tiles = Array.from({length:_avtNfEd.h}, ()=>Array(_avtNfEd.w).fill(AVT_T.PAREDE));
  _avtNfEditorDraw();
  const paint = e => {
    const r = canvas.getBoundingClientRect();
    const cw = r.width/_avtNfEd.w, ch = r.height/_avtNfEd.h;
    const tx = Math.floor((e.clientX-r.left)/cw), ty = Math.floor((e.clientY-r.top)/ch);
    if (tx>=0&&tx<_avtNfEd.w&&ty>=0&&ty<_avtNfEd.h) {
      _avtNfEd.tiles[ty][tx] = _avtNfEd.acao==='piso' ? AVT_T.PISO : AVT_T.PAREDE;
      _avtNfEditorDraw();
    }
  };
  canvas.onmousedown = e => { _avtNfEd.drawing=true; paint(e); };
  canvas.onmousemove = e => { if(_avtNfEd.drawing) paint(e); };
  canvas.onmouseup = () => { _avtNfEd.drawing=false; };
}
function _avtNfEditorDraw() {
  const canvas = document.getElementById('avt-nf-ed-canvas');
  if (!canvas||!_avtNfEd.tiles) return;
  const ctx = canvas.getContext('2d');
  const cw = canvas.width/_avtNfEd.w, ch = canvas.height/_avtNfEd.h;
  for (let y=0;y<_avtNfEd.h;y++) for (let x=0;x<_avtNfEd.w;x++) {
    ctx.fillStyle = _avtNfEd.tiles[y][x]===AVT_T.PISO?'#1a2535':'#0a0c14';
    ctx.fillRect(x*cw,y*ch,cw,ch);
  }
}
function _avtNfEditorAcao(a) {
  _avtNfEd.acao = a;
  ['piso','parede'].forEach(k => {
    const b = document.getElementById('avt-nf-btn-'+k);
    if (b) b.classList.toggle('avt-ed-btn-ativo', k===a);
  });
}
function _avtNfEditorTamanho(v) {
  const [ww,hh] = v.split('x').map(Number);
  _avtNfEd.w=ww; _avtNfEd.h=hh;
  _avtNfEd.tiles = Array.from({length:hh},()=>Array(ww).fill(AVT_T.PAREDE));
  const c = document.getElementById('avt-nf-ed-canvas');
  if (c) { c.width=ww*12; c.height=hh*12; }
  _avtNfEditorDraw();
}
function _avtNfEditorLimpar() {
  _avtNfEd.tiles = Array.from({length:_avtNfEd.h},()=>Array(_avtNfEd.w).fill(AVT_T.PAREDE));
  _avtNfEditorDraw();
}
function _avtNfEditorExport() {
  const w = AVT_STATE._novaFaseWizard;
  if (!w||!_avtNfEd.tiles) return;
  w.dungeon = { tiles:_avtNfEd.tiles.map(r=>[...r]), w:_avtNfEd.w, h:_avtNfEd.h, rooms:[] };
  mostrarToast('Mapa do editor definido!', 'ok');
  _avtMestreNovaFaseRender();
}

function _avtNfIniciarPlacement() {
  const w = AVT_STATE._novaFaseWizard;
  if (!w) return;
  // Save current nome to wizard state before hiding overlay
  w.nome = document.getElementById('avt-nf-nome')?.value?.trim() || w.nome;
  const overlay = document.getElementById('avt-anim-import-overlay');
  if (overlay) overlay.style.display = 'none';
  AVT_STATE._modoPortaPlacement = true;
  if (AVT_STATE.canvas) AVT_STATE.canvas.style.cursor = 'crosshair';
  mostrarToast('📍 Clique no mapa para posicionar a porta da nova fase', 'ok');
}

async function _avtMestreSalvarNovaFase() {
  const w = AVT_STATE._novaFaseWizard;
  if (!w) return;
  const nome = (document.getElementById('avt-nf-nome')?.value?.trim() || w.nome || '').trim();
  if (!nome) { mostrarToast('Informe o nome da fase', 'aviso'); return; }
  if (w.porta_col == null || w.porta_row == null) { mostrarToast('Defina a posição da porta clicando no mapa', 'aviso'); return; }

  // Resolve dungeon_data
  let dungeonData = w.dungeon;
  if (!dungeonData) {
    if (w.mapaOpcao === 'procedural') {
      const salas = w._procSalas || 8;
      const area = Math.max(22*16, salas*60);
      const ww = Math.ceil(Math.sqrt(area*(22/16))); const hh = Math.ceil(area/ww);
      dungeonData = _avtGerarDungeon(ww, hh, salas);
    } else {
      mostrarToast('Gere ou configure o mapa antes de criar a fase', 'aviso'); return;
    }
  }

  // Place SAIDA tile in last room of new phase's dungeon
  if (dungeonData.rooms?.length > 0) {
    const lastRoom = dungeonData.rooms[dungeonData.rooms.length - 1];
    const sx = lastRoom.cx ?? lastRoom.x, sy = lastRoom.cy ?? lastRoom.y;
    if (dungeonData.tiles[sy]?.[sx] !== undefined) dungeonData.tiles[sy][sx] = AVT_T.SAIDA;
  }

  const fase = {
    id: Date.now().toString(),
    nome,
    dungeon_data: dungeonData,
    porta: { col: w.porta_col, row: w.porta_row, lock_type: w.lock_type, chave_palavra: w.chave_palavra, npc_boss_id: w.npc_boss_id }
  };

  if (!AVT_STATE.rpg.theme_json) AVT_STATE.rpg.theme_json = {};
  AVT_STATE.rpg.theme_json.fases_extras = [...(AVT_STATE.rpg.theme_json.fases_extras || []), fase];

  try {
    await _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}`, {
      method:'PATCH', body:JSON.stringify({ theme_json: AVT_STATE.rpg.theme_json })
    });
    AVT_STATE._novaFaseWizard = null;
    document.getElementById('avt-anim-import-overlay').style.display = 'none';
    mostrarToast(`Fase "${nome}" criada!`, 'ok');
    _avtMestrePainelRender();
    // Navigate mestre directly to the new phase
    _avtEntrarFaseExtra(fase);
  } catch(e) {
    mostrarToast('Erro ao salvar fase: ' + (e?.message || e), 'erro');
  }
}

async function _avtMestreRemoverFase(faseId) {
  if (!confirm('Remover esta fase?')) return;
  const extras = (AVT_STATE.rpg.theme_json.fases_extras || []).filter(f => f.id !== faseId);
  AVT_STATE.rpg.theme_json.fases_extras = extras;
  try {
    await _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}`, {
      method: 'PATCH', body: JSON.stringify({ theme_json: AVT_STATE.rpg.theme_json })
    });
    mostrarToast('Fase removida', 'ok');
    _avtMestrePainelRender();
  } catch(e) {
    mostrarToast('Erro: ' + (e?.message || e), 'erro');
  }
}

// ─── Verificação de porta ao mover ───────────────────────────────────────────
function _avtVerificarPortaFase(x, y) {
  const fases = AVT_STATE.rpg?.theme_json?.fases_extras;
  if (!fases?.length) return;
  const fase = fases.find(f => f.porta.col === x && f.porta.row === y);
  if (!fase) return;
  const p = fase.porta;
  if (p.lock_type === 'npc') {
    const vivo = AVT_STATE.entidades.find(e => e.id === p.npc_boss_id && e.hp > 0);
    if (vivo) { mostrarToast(`Derrote ${vivo.nome} primeiro!`, 'aviso'); return; }
  }
  if (p.lock_type === 'chave') {
    const jog = _avtMeuJogador();
    const chaves = jog?.custom_attrs?.chaves_coletadas || jog?.custom_attrs?.chaves || [];
    const tem = chaves.some(c => (typeof c === 'string' ? c : c.chave_palavra) === p.chave_palavra);
    if (!tem) { mostrarToast(`Precisas de: ${p.chave_palavra}`, 'aviso'); return; }
  }
  _avtEntrarFaseExtra(fase);
}

async function _avtEntrarFaseExtra(fase) {
  if (!fase.dungeon_data) {
    fase.dungeon_data = _avtGerarDungeon(40, 28, 6);
    // Place SAIDA tile in last room
    if (fase.dungeon_data.rooms?.length > 0) {
      const lr = fase.dungeon_data.rooms[fase.dungeon_data.rooms.length - 1];
      const sx = lr.cx ?? lr.x, sy = lr.cy ?? lr.y;
      if (fase.dungeon_data.tiles[sy]?.[sx] !== undefined) fase.dungeon_data.tiles[sy][sx] = AVT_T.SAIDA;
    }
    const extras = AVT_STATE.rpg.theme_json.fases_extras.map(f =>
      f.id === fase.id ? { ...f, dungeon_data: fase.dungeon_data } : f
    );
    AVT_STATE.rpg.theme_json.fases_extras = extras;
    try {
      await _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}`, {
        method: 'PATCH', body: JSON.stringify({ theme_json: AVT_STATE.rpg.theme_json })
      });
    } catch(e) { /* continua mesmo sem persistir */ }
  }
  AVT_STATE._faseAnterior = { dungeon: AVT_STATE.dungeon };
  AVT_STATE.dungeon = fase.dungeon_data;
  const jogador = _avtMeuJogador();
  if (jogador && AVT_STATE.dungeon.rooms?.length) {
    const sala = AVT_STATE.dungeon.rooms[0];
    jogador.x = sala.cx != null ? sala.cx : sala.x;
    jogador.y = sala.cy != null ? sala.cy : sala.y;
  }
  mostrarToast(`Entrando: ${fase.nome}`, 'ok');
  _avtCameraUpdate();
  _avtMestrePainelRender();
}

function _avtVerificarSaida(x, y) {
  if (!AVT_STATE._faseAnterior) return;
  const tile = AVT_STATE.dungeon?.tiles?.[y]?.[x];
  if (tile === AVT_T.SAIDA) {
    if (confirm('🚪 Sair desta fase e voltar ao mapa anterior?')) _avtVoltarFaseAnterior();
  }
}

function _avtVoltarFaseAnterior() {
  if (!AVT_STATE._faseAnterior) return;
  AVT_STATE.dungeon = AVT_STATE._faseAnterior.dungeon;
  AVT_STATE._faseAnterior = null;
  // Move player to a walkable tile in restored dungeon
  const jogador = _avtMeuJogador();
  if (jogador && AVT_STATE.dungeon?.rooms?.length) {
    const sala = AVT_STATE.dungeon.rooms[0];
    jogador.x = sala.cx != null ? sala.cx : sala.x;
    jogador.y = sala.cy != null ? sala.cy : sala.y;
  }
  mostrarToast('Voltou ao mapa anterior', 'ok');
  _avtCameraUpdate();
  _avtMestrePainelRender();
}

function _avtMestreAssumir() {
  const sel = document.getElementById('avt-mp-npc-sel');
  if (!sel?.value) return;
  AVT_STATE.npcControlando = sel.value;
  AVT_STATE.npcIaAtiva = false;
  mostrarToast('🎮 Controlando: ' + (sel.options[sel.selectedIndex]?.text?.split('(')[0].trim()||'NPC'), 'ok');
  _avtMestrePainelRender();
}

function _avtMestreIniciarRepos() {
  const sel = document.getElementById('avt-mp-repos-sel');
  if (!sel?.value) { mostrarToast('Selecione uma entidade para reposicionar', 'aviso'); return; }
  AVT_STATE.mestreReposicionando = sel.value;
  const ent = AVT_STATE.entidades.find(e => e.id === sel.value);
  mostrarToast(`📍 Clique no mapa para mover ${ent?.nome || 'entidade'}`, 'ok');
  avtMestrePainel(); // close panel so player can click on map
}

function _avtPassarTurnoBatalha(batalhaId) {
  const bat = AVT_STATE.batalhas.find(b => b.id === batalhaId);
  if (!bat) return;
  const ativo = bat.iniciativa[bat.turnoIdx];
  if (ativo) _avtLog(`${ativo.nome} passa o turno`, bat.id);
  _avtTurnoAvancar(bat);
  _avtMestrePainelRender();
}

function _avtMestreAddInimigo() {
  const d = AVT_STATE.dungeon; if (!d) return;
  const overlay = document.getElementById('avt-anim-import-overlay');
  if (!overlay) return;

  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="avt-modal-box">
      <div class="avt-modal-header">
        <span>👹 Adicionar NPC / Boss</span>
        <button onclick="document.getElementById('avt-anim-import-overlay').style.display='none'" style="background:none;border:none;color:#7a92aa;cursor:pointer;font-size:1.2rem;line-height:1;padding:0">×</button>
      </div>
      <div class="avt-modal-body" style="display:flex;flex-direction:column;gap:10px">
        <div style="font-size:0.7rem;color:#7a92aa">Escolha um tipo ou personalize abaixo:</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px" id="avt-npc-presets">
          ${Object.entries(AVT_NPC_PRESETS).map(([k,p])=>`
            <button onclick="_avtNpcPresetSel('${k}')"
              style="padding:6px 10px;border-radius:6px;border:1px solid ${p.isBoss?'rgba(231,76,60,0.4)':'rgba(79,163,209,0.2)'};background:rgba(255,255,255,0.03);color:#c8d8e8;cursor:pointer;font-size:0.72rem;font-family:var(--fonte-d)">
              ${p.icone} ${p.nome}${p.isBoss?' 👑':''}
            </button>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label style="font-size:0.62rem;color:#7a92aa;display:block;margin-bottom:3px">Nome</label>
            <input id="avt-npc-nome" style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem" placeholder="Goblin"></div>
          <div><label style="font-size:0.62rem;color:#7a92aa;display:block;margin-bottom:3px">HP</label>
            <input id="avt-npc-hp" type="number" min="1" max="9999" value="20" style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          <div><label style="font-size:0.62rem;color:#7a92aa;display:block;margin-bottom:3px">Paciência (seg)</label>
            <input id="avt-npc-pac" type="number" min="0.5" max="60" value="5" step="0.5" style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          <div><label style="font-size:0.62rem;color:#7a92aa;display:block;margin-bottom:3px">Raio de Detecção</label>
            <input id="avt-npc-raio" type="number" min="1" max="15" value="3" style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          <div><label style="font-size:0.62rem;color:#7a92aa;display:block;margin-bottom:3px">Cor</label>
            <input id="avt-npc-cor" type="color" value="#7a5c00" style="width:100%;height:30px;border:1px solid rgba(79,163,209,0.2);border-radius:5px;background:#0a0f18;cursor:pointer"></div>
          <div style="display:flex;align-items:center;gap:6px;padding-top:18px">
            <input type="checkbox" id="avt-npc-boss" style="cursor:pointer">
            <label for="avt-npc-boss" style="font-size:0.72rem;color:#c8d8e8;cursor:pointer">Boss 👑</label>
          </div>
        </div>
      </div>
      <div class="avt-modal-footer">
        <button class="avt-mp-btn" onclick="document.getElementById('avt-anim-import-overlay').style.display='none'">Cancelar</button>
        <button class="avt-mp-btn" onclick="_avtNpcConfirmarAdd()">+ Adicionar ao Mapa</button>
      </div>
    </div>`;
}

function _avtNpcPresetSel(key) {
  const p = AVT_NPC_PRESETS[key]; if (!p) return;
  const n = document.getElementById('avt-npc-nome'); if (n) n.value = p.nome;
  const h = document.getElementById('avt-npc-hp'); if (h) h.value = p.hpBase;
  const pa = document.getElementById('avt-npc-pac'); if (pa) pa.value = p.pacienciaSecs;
  const r = document.getElementById('avt-npc-raio'); if (r) r.value = p.deteccaoRaio;
  const b = document.getElementById('avt-npc-boss'); if (b) b.checked = !!p.isBoss;
}

function _avtNpcConfirmarAdd() {
  const d = AVT_STATE.dungeon; if (!d) return;
  const pisos = [];
  for (let y=0;y<d.h;y++) for (let x=0;x<d.w;x++)
    if (_avtTilePassavel(x, y, d) && !AVT_STATE.entidades.some(e=>e.x===x&&e.y===y))
      pisos.push({x,y});
  if (!pisos.length) { mostrarToast('Sem espaço no mapa', 'aviso'); return; }
  const pos = pisos[Math.floor(Math.random()*pisos.length)];
  const nome = document.getElementById('avt-npc-nome')?.value?.trim() || 'Inimigo';
  const hp   = parseInt(document.getElementById('avt-npc-hp')?.value) || 20;
  const pac  = parseFloat(document.getElementById('avt-npc-pac')?.value) || 5;
  const raio = parseInt(document.getElementById('avt-npc-raio')?.value) || 3;
  const cor  = document.getElementById('avt-npc-cor')?.value || '#7a5c00';
  const isBoss = document.getElementById('avt-npc-boss')?.checked || false;
  const id = 'npc_' + Date.now();
  const ent = { id, nome, tipo:'inimigo', x:pos.x, y:pos.y, hp, hpMax:hp, cor, isBoss,
    pacienciaSecs:pac, deteccaoRaio:raio };
  AVT_STATE.entidades.push(ent);
  AVT_STATE.npcTimers[id] = { patience:pac*1000, maxPatience:pac*1000, ativo:false };
  document.getElementById('avt-anim-import-overlay').style.display = 'none';
  mostrarToast(`${nome} adicionado!`, 'ok');
}

function _avtNpcSetPaciencia(entId, val) {
  const e = AVT_STATE.entidades.find(x => x.id === entId); if (!e) return;
  e.pacienciaSecs = val;
  const t = AVT_STATE.npcTimers[entId];
  if (t) { t.maxPatience = val * 1000; t.patience = Math.min(t.patience, t.maxPatience); }
}
function _avtNpcSetRaio(entId, val) {
  const e = AVT_STATE.entidades.find(x => x.id === entId); if (!e) return;
  e.deteccaoRaio = val;
}
function _avtNpcSetBoss(entId, val) {
  const e = AVT_STATE.entidades.find(x => x.id === entId); if (!e) return;
  e.isBoss = val;
}
function _avtNpcSetCor(entId, val) {
  const e = AVT_STATE.entidades.find(x => x.id === entId); if (!e) return;
  e.cor = val;
}

function _avtMestreToggleVisao() {
  AVT_STATE.mestreVisaoGeral = !AVT_STATE.mestreVisaoGeral;
  const d = AVT_STATE.dungeon; const cv = AVT_STATE.canvas;
  if (AVT_STATE.mestreVisaoGeral && d && cv?.width) {
    const zoom = Math.min(cv.width/(d.w*AVT_SZ), cv.height/(d.h*AVT_SZ)) * 0.92;
    AVT_STATE.camera.zoom = zoom;
    AVT_STATE.camera.x = (d.w*AVT_SZ*zoom - cv.width)/2;
    AVT_STATE.camera.y = (d.h*AVT_SZ*zoom - cv.height)/2;
  } else {
    AVT_STATE.camera.zoom = 1;
    _avtCameraCenter();
  }
  _avtMestrePainelRender();
}

function avtHudAtacarNpc() {
  const b = _avtMinhaBatalha();
  const ativo = _avtAtivo();
  if (!b || !ativo || ativo.tipo !== 'inimigo') return;
  const alvoId = document.getElementById('avt-hud-alvo')?.value;
  const alvo = b.iniciativa.find(e=>e.id===alvoId);
  if (!alvo || alvo.hp<=0) { mostrarToast('Selecione um alvo', 'aviso'); return; }
  _avtSetEntState(ativo.id, 'attack');
  const dano = _avtRolarFormula('1d8');
  const hitRoll = Math.floor(Math.random()*20)+1;
  if (hitRoll < 5) {
    _avtLog(`${ativo.nome} erra ${alvo.nome}! (${hitRoll})`, b.id);
    mostrarToast('💨 ' + ativo.nome + ' errou!', '');
  } else {
    const real = hitRoll >= 19 ? dano*2 : dano;
    alvo.hp = Math.max(0, alvo.hp - real);
    const entAlvo = AVT_STATE.entidades.find(e=>e.id===alvo.id);
    if (entAlvo) entAlvo.hp = alvo.hp;
    _avtLog('🎮 ' + ativo.nome + ' → ' + alvo.nome + ': ' + real + (hitRoll>=19?' (CRÍTICO)':''), b.id);
    mostrarToast(ativo.nome + ' ataca! -' + real + ' HP', 'aviso');
    _avtRenderHpBar();
    if (alvo.hp <= 0) { _avtLog('💀 ' + alvo.nome + ' caiu!', b.id); _avtCheckDerrota(b); }
  }
  _avtSetTimeout(() => _avtTurnoAvancar(b), 600);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHARACTER EDITOR (Diablo III layout)
// ─────────────────────────────────────────────────────────────────────────────

function abrirAvtCharEditor(entId) {
  AVT_STATE.charEditorId = entId;
  AVT_STATE.charEditorTab = 'attrs';
  const screen = document.getElementById('avt-char-editor');
  if (screen) screen.style.display = 'flex';
  _avtCharEditorRender();
}

function fecharAvtCharEditor() {
  const screen = document.getElementById('avt-char-editor');
  if (screen) screen.style.display = 'none';
  AVT_STATE.charEditorId = null;
}

function _avtDefaultAttrs() {
  return { forca:10, destreza:10, inteligencia:10, constituicao:10, sabedoria:10, carisma:10, pontos:6 };
}

function _avtCharEditorRender() {
  const ent = AVT_STATE.entidades.find(e=>e.id===AVT_STATE.charEditorId);
  if (!ent) { fecharAvtCharEditor(); return; }
  const dbChar = AVT_STATE.chars.find(c=>c.id===ent.dbId||c.nome===ent.nome) || {};
  const attrs = dbChar.custom_attrs?.atributos || _avtDefaultAttrs();

  const hdr = document.getElementById('avt-ce-title');
  if (hdr) hdr.textContent = ent.nome;

  const left = document.getElementById('avt-ce-left');
  if (left) {
    const hpPct = Math.max(0, ent.hp/ent.hpMax*100);
    const animData = dbChar.custom_attrs?.animado_data;
    left.innerHTML = `
      <div id="avt-ce-sprite-wrap" style="width:180px;height:200px;margin:0 auto 12px;border-radius:10px;overflow:hidden;background:rgba(0,0,0,0.3);border:1px solid ${ent.cor}33;display:flex;align-items:center;justify-content:center">
        <div style="width:${ent.isBoss?110:90}px;height:${ent.isBoss?110:90}px;border-radius:50%;background:${ent.cor}33;border:${ent.isBoss?4:3}px solid ${ent.cor};display:flex;align-items:center;justify-content:center;font-size:${ent.isBoss?'2.8':'2.2'}rem;font-weight:bold;color:${ent.cor};font-family:var(--fonte-d)">${ent.icone||(ent.nome[0]||'?').toUpperCase()}</div>
      </div>
      <div style="text-align:center;margin-bottom:12px">
        <div style="font-family:var(--fonte-d);font-size:1rem;color:${ent.cor};margin-bottom:3px">${ent.nome}${ent.isBoss?' 👑':''}</div>
        <div style="font-size:0.7rem;color:#7a92aa">Nível ${dbChar.nivel||1} · XP ${dbChar.xp||0}</div>
        ${ent.tipo==='inimigo'?`<div style="font-size:0.62rem;color:${ent.isBoss?'#e74c3c':'#e8604c'};font-family:var(--fonte-d);margin-top:2px">${ent.isBoss?'BOSS':'NPC INIMIGO'}</div>`:''}
      </div>
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:0.68rem;color:#7a92aa;margin-bottom:3px">
          <span>HP</span><span style="color:${hpPct<30?'#e74c3c':'#c8d8e8'}">${ent.hp}/${ent.hpMax}</span>
        </div>
        <div style="background:#0a0f18;border-radius:4px;height:8px;overflow:hidden">
          <div style="height:100%;border-radius:4px;background:${hpPct<30?'#e74c3c':hpPct<60?'#c8a84b':'#27ae60'};width:${hpPct}%"></div>
        </div>
      </div>
      ${AVT_STATE.isMestre ? `
        <div style="display:flex;gap:5px;margin-bottom:10px">
          <button class="avt-mp-btn avt-mp-btn-danger" onclick="(()=>{const e=AVT_STATE.entidades.find(x=>x.id==='${ent.id}');if(e&&e.hp>0){e.hp=Math.max(0,e.hp-5);_avtCharEditorRender();_avtRenderHpBar();}})()" style="flex:1">−5 HP</button>
          <button class="avt-mp-btn" onclick="(()=>{const e=AVT_STATE.entidades.find(x=>x.id==='${ent.id}');if(e){e.hp=Math.min(e.hpMax,e.hp+5);_avtCharEditorRender();_avtRenderHpBar();}})()" style="flex:1">+5 HP</button>
        </div>
      ` : ''}
      <button class="avt-mp-btn" style="width:100%;margin-bottom:6px" onclick="_avtCharImportarAparencia('${ent.id}')">🎨 Importar aparência via IA</button>
      <button class="avt-mp-btn" style="width:100%" onclick="fecharAvtCharEditor()">✕ Fechar</button>`;
    if (animData && typeof animRendererMount === 'function') {
      const wrap = left.querySelector('#avt-ce-sprite-wrap');
      if (wrap) animRendererMount(wrap, animData, { displayWidth:180, displayHeight:200 });
    }
  }
  _avtCharEditorRenderRight(ent, dbChar, attrs);
}

function _avtCharEditorRenderRight(ent, dbChar, attrs) {
  const right = document.getElementById('avt-ce-right');
  if (!right) return;
  const tabs = AVT_STATE.isMestre ? ['attrs','equip','skills','skill-edit'] : ['attrs','equip','skills'];
  const tab = AVT_STATE.charEditorTab;
  const labels = { attrs:'Atributos', equip:'Equipamentos', skills:'Skills', 'skill-edit':'⚙ Editar Skills' };
  right.innerHTML = `
    <div class="avt-ce-tabs">
      ${tabs.map(t=>`<button class="avt-ce-tab ${t===tab?'ativo':''}" onclick="_avtCharEditorTab('${t}')">${labels[t]}</button>`).join('')}
    </div>
    <div class="avt-ce-content" id="avt-ce-content"></div>`;
  const content = document.getElementById('avt-ce-content');
  if (tab==='attrs') _avtCharEditorRenderAttrs(content, ent, dbChar, attrs);
  else if (tab==='equip') _avtCharEditorRenderEquip(content, ent, dbChar);
  else if (tab==='skills') _avtCharEditorRenderSkills(content, ent, dbChar);
  else if (tab==='skill-edit') _avtCharEditorRenderSkillEdit(content);
}

function _avtCharEditorTab(tab) {
  AVT_STATE.charEditorTab = tab; _avtCharEditorRender();
}

function _avtCharEditorRenderAttrs(container, ent, dbChar, attrs) {
  if (!container) return;
  const isEnemy = ent.tipo === 'inimigo';
  container.innerHTML = `
    <div class="avt-ce-section-title">Atributos</div>
    <div class="avt-ce-attrs-grid">
      ${[['forca','⚔ Força'],['destreza','🎯 Destreza'],['inteligencia','🔮 Inteligência'],
         ['constituicao','🛡 Constituição'],['sabedoria','👁 Sabedoria'],['carisma','✨ Carisma']
        ].map(([k,label])=>`
        <div class="avt-ce-attr-row">
          <div class="avt-ce-attr-label">${label}</div>
          <div class="avt-ce-attr-val">
            <button class="avt-ce-attr-btn" onclick="_avtAttrDelta('${ent.id}','${k}',-1)" ${(attrs[k]||10)<=8&&!AVT_STATE.isMestre?'disabled':''}>−</button>
            <span class="avt-ce-attr-num">${attrs[k]||10}</span>
            <button class="avt-ce-attr-btn" onclick="_avtAttrDelta('${ent.id}','${k}',1)" ${!AVT_STATE.isMestre&&(attrs.pontos||0)<=0?'disabled':''}>+</button>
          </div>
        </div>`).join('')}
    </div>
    ${attrs.pontos>0?`<div class="avt-ce-pontos">Pontos disponíveis: <b>${attrs.pontos}</b></div>`:''}
    <div class="avt-ce-section-title" style="margin-top:14px">HP Máximo</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      ${AVT_STATE.isMestre
        ? `<input type="number" min="1" max="9999" value="${ent.hpMax}" onchange="_avtAttrHpMax('${ent.id}',+this.value)"
            style="width:80px;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.3);border-radius:5px;color:#c8d8e8;font-size:0.85rem">
           <span style="color:#7a92aa;font-size:0.72rem">HP atual: ${ent.hp}</span>`
        : `<span style="font-size:0.9rem;color:#c8d8e8">${ent.hp} / ${ent.hpMax}</span>`}
    </div>
    ${isEnemy && AVT_STATE.isMestre ? `
    <div class="avt-ce-section-title" style="margin-top:14px">Comportamento do NPC</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div>
        <label style="font-size:0.62rem;color:#7a92aa;display:block;margin-bottom:3px">Paciência (seg)</label>
        <input type="number" min="0.5" max="60" step="0.5" value="${ent.pacienciaSecs??5}"
          onchange="_avtNpcSetPaciencia('${ent.id}',+this.value)"
          style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem">
      </div>
      <div>
        <label style="font-size:0.62rem;color:#7a92aa;display:block;margin-bottom:3px">Raio Detecção</label>
        <input type="number" min="1" max="15" value="${ent.deteccaoRaio??3}"
          onchange="_avtNpcSetRaio('${ent.id}',+this.value)"
          style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem">
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <input type="checkbox" id="avt-npc-boss-ed" ${ent.isBoss?'checked':''}
          onchange="_avtNpcSetBoss('${ent.id}',this.checked)" style="cursor:pointer">
        <label for="avt-npc-boss-ed" style="font-size:0.72rem;color:#c8d8e8;cursor:pointer">Boss 👑</label>
      </div>
      <div>
        <label style="font-size:0.62rem;color:#7a92aa;display:block;margin-bottom:3px">Cor</label>
        <input type="color" value="${ent.cor||'#7a5c00'}"
          onchange="_avtNpcSetCor('${ent.id}',this.value)"
          style="width:100%;height:30px;border:1px solid rgba(79,163,209,0.2);border-radius:5px;background:#0a0f18;cursor:pointer">
      </div>
    </div>` : ''}
    <button class="avt-mp-btn" onclick="_avtCharSalvarAttrs('${ent.id}')">💾 Salvar atributos</button>`;
}

function _avtAttrDelta(entId, attr, delta) {
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  const dbChar = AVT_STATE.chars.find(c=>c.id===ent?.dbId||c.nome===ent?.nome);
  if (!dbChar) return;
  if (!dbChar.custom_attrs) dbChar.custom_attrs = {};
  if (!dbChar.custom_attrs.atributos) dbChar.custom_attrs.atributos = _avtDefaultAttrs();
  const a = dbChar.custom_attrs.atributos;
  if (delta>0 && !AVT_STATE.isMestre && (a.pontos||0)<=0) return;
  if (delta<0 && (a[attr]||10)<=8) return;
  a[attr] = (a[attr]||10) + delta;
  if (!AVT_STATE.isMestre) a.pontos = Math.max(0, (a.pontos||0) - delta);
  _avtCharEditorRender();
}

function _avtAttrHpMax(entId, val) {
  if (!val || val < 1) return;
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  if (ent) { ent.hpMax = val; if (ent.hp > val) ent.hp = val; }
  const dbChar = AVT_STATE.chars.find(c=>c.id===ent?.dbId||c.nome===ent?.nome);
  if (dbChar) { dbChar.hp_max = val; if ((dbChar.hp_atual||0) > val) dbChar.hp_atual = val; }
  _avtRenderHpBar();
}

async function _avtCharSalvarAttrs(entId) {
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  const dbChar = AVT_STATE.chars.find(c=>c.id===ent?.dbId||c.nome===ent?.nome);
  if (!dbChar?.id) { mostrarToast('Salvo localmente', 'aviso'); return; }
  try {
    await _avtSb('characters?id=eq.' + encodeURIComponent(dbChar.id), {
      method:'PATCH', body:JSON.stringify({ custom_attrs:dbChar.custom_attrs, hp_max:ent.hpMax, hp_atual:ent.hp })
    });
    mostrarToast('Atributos salvos!', 'ok');
  } catch(e) { mostrarToast('Erro: ' + (e?.message||e), 'erro'); }
}

const AVT_EQUIP_SLOTS = [
  { key:'arma_principal', label:'Arma',      icon:'⚔' },
  { key:'corpo',          label:'Armadura',   icon:'🛡' },
  { key:'acessorio',      label:'Acessório',  icon:'💍' },
  { key:'amuleto',        label:'Amuleto',    icon:'📿' },
  { key:'anel',           label:'Anel',       icon:'🔮' },
];

function _avtCharEditorRenderEquip(container, ent, dbChar) {
  if (!container) return;
  const equip = dbChar.custom_attrs?.equipamento || {};
  const catalog = AVT_STATE.itemCatalog || [];

  const slotHtml = AVT_EQUIP_SLOTS.map(sl => {
    const equipped = equip[sl.key];
    // Support both new format (object with item_id) and legacy (string name)
    const equippedName = equipped ? (typeof equipped === 'object' ? equipped.nome : equipped) : null;
    const equippedImg  = equipped && typeof equipped === 'object' ? equipped.img_url : null;
    const bonuses      = equipped && typeof equipped === 'object' ? equipped.bonus_snapshot : null;
    const bonusText    = bonuses && Object.keys(bonuses).length
      ? Object.entries(bonuses).map(([a,v])=>`${a}: ${v>0?'+':''}${v}`).join(', ')
      : null;
    const compatItems  = catalog.filter(i => {
      if (i.tipo !== 'equipamento' && i.tipo !== 'arma') return false;
      const s = i.slot_padrao || '';
      if (!s) return true;
      // Map adventure slot keys to catalog slot keys
      const slotMap = { arma_principal: ['arma_principal','arma_1m','arma_2m','arco','lanca'], corpo: ['corpo','armadura'], acessorio: ['acessorio','maos','capa'], amuleto: ['amuleto'], anel: ['anel'] };
      return (slotMap[sl.key] || [sl.key]).includes(s);
    });

    return `<div style="padding:9px 11px;background:rgba(255,255,255,0.02);border:1px solid ${equippedName?'rgba(79,163,209,0.2)':'rgba(255,255,255,0.06)'};border-radius:8px;margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:8px">
        ${equippedImg ? `<img src="${equippedImg}" style="width:32px;height:32px;object-fit:contain;border-radius:4px;background:#0a0c14;border:1px solid rgba(79,163,209,0.15)" onerror="this.style.display='none'">` : `<span style="font-size:1.1rem;width:32px;text-align:center">${sl.icon}</span>`}
        <div style="flex:1;min-width:0">
          <div style="font-size:0.65rem;color:#7a92aa;font-family:var(--fonte-d);text-transform:uppercase;letter-spacing:.05em">${sl.label}</div>
          <div style="font-size:0.78rem;color:${equippedName?'#c8d8e8':'#444'};margin-top:1px">${equippedName||'— vazio —'}</div>
          ${bonusText?`<div style="font-size:0.62rem;color:#4fa3d1;margin-top:1px">📊 ${bonusText}</div>`:''}
        </div>
        ${AVT_STATE.isMestre && equippedName ? `<button class="avt-mp-btn avt-mp-btn-danger" style="padding:2px 6px;font-size:0.65rem" onclick="_avtDesequiparItem('${ent.id}','${sl.key}')">✕</button>` : ''}
      </div>
      ${AVT_STATE.isMestre && compatItems.length ? `
      <div style="margin-top:7px">
        <select onchange="_avtEquiparItem('${ent.id}','${sl.key}',this.value);this.value=''"
          style="width:100%;padding:4px 7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.15);border-radius:5px;color:#c8d8e8;font-size:0.72rem">
          <option value="">— Equipar item do catálogo —</option>
          ${compatItems.map(i=>`<option value="${i.id}">${i.icone||''} ${i.nome}${i.raridade?` (${i.raridade})`:''}</option>`).join('')}
        </select>
      </div>` : AVT_STATE.isMestre && !catalog.length ? `<div style="font-size:0.65rem;color:#4a6275;margin-top:5px;font-style:italic">Nenhum item no catálogo desta aventura — <a href="#" onclick="event.preventDefault();avtImportarCatalogo()" style="color:#4fa3d1">Importar catálogo</a></div>` : ''}
    </div>`;
  }).join('');

  container.innerHTML = `<div class="avt-ce-section-title">Equipamentos</div>${slotHtml}`;
}

function _avtEquiparItem(entId, slotKey, itemId) {
  if (!itemId) return;
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  const dbChar = AVT_STATE.chars.find(c=>c.id===ent?.dbId||c.nome===ent?.nome);
  if (!dbChar) return;
  const item = AVT_STATE.itemCatalog.find(i=>i.id===itemId);
  if (!item) return;
  if (!dbChar.custom_attrs) dbChar.custom_attrs = {};
  if (!dbChar.custom_attrs.equipamento) dbChar.custom_attrs.equipamento = {};
  if (!dbChar.custom_attrs.atributos) dbChar.custom_attrs.atributos = _avtDefaultAttrs();
  // Revert previous item in slot
  const prev = dbChar.custom_attrs.equipamento[slotKey];
  if (prev && typeof prev === 'object' && prev.bonus_snapshot) {
    Object.entries(prev.bonus_snapshot).forEach(([attr, delta]) => {
      dbChar.custom_attrs.atributos[attr] = (parseFloat(dbChar.custom_attrs.atributos[attr])||0) - delta;
    });
  }
  // Apply new bonuses
  const bonus = item.atributos_bonus || {};
  const snapshot = {};
  Object.entries(bonus).forEach(([attr, val]) => {
    const delta = typeof val === 'object' ? (val.valor||0) : parseFloat(val)||0;
    snapshot[attr] = delta;
    dbChar.custom_attrs.atributos[attr] = (parseFloat(dbChar.custom_attrs.atributos[attr])||0) + delta;
  });
  dbChar.custom_attrs.equipamento[slotKey] = { item_id: item.id, nome: item.nome, img_url: item.img_url||null, bonus_snapshot: snapshot };
  _avtSb('characters?id=eq.' + encodeURIComponent(dbChar.id), {
    method:'PATCH', body:JSON.stringify({ custom_attrs: dbChar.custom_attrs })
  }).catch(e => mostrarToast('Erro ao equipar: ' + (e?.message||e), 'erro'));
  _avtCharEditorRender();
}

function _avtDesequiparItem(entId, slotKey) {
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  const dbChar = AVT_STATE.chars.find(c=>c.id===ent?.dbId||c.nome===ent?.nome);
  if (!dbChar) return;
  if (!dbChar.custom_attrs) dbChar.custom_attrs = {};
  const prev = dbChar.custom_attrs.equipamento?.[slotKey];
  if (prev && typeof prev === 'object' && prev.bonus_snapshot) {
    if (!dbChar.custom_attrs.atributos) dbChar.custom_attrs.atributos = _avtDefaultAttrs();
    Object.entries(prev.bonus_snapshot).forEach(([attr, delta]) => {
      dbChar.custom_attrs.atributos[attr] = (parseFloat(dbChar.custom_attrs.atributos[attr])||0) - delta;
    });
  }
  if (dbChar.custom_attrs.equipamento) delete dbChar.custom_attrs.equipamento[slotKey];
  _avtSb('characters?id=eq.' + encodeURIComponent(dbChar.id), {
    method:'PATCH', body:JSON.stringify({ custom_attrs: dbChar.custom_attrs })
  }).catch(e => mostrarToast('Erro ao desequipar: ' + (e?.message||e), 'erro'));
  _avtCharEditorRender();
}

function _avtCharEditorRenderSkills(container, ent, dbChar) {
  if (!container) return;
  const charSkillIds = dbChar.custom_attrs?.skills_ids || ent.custom_attrs?.skills_ids || [];
  const mySkills = AVT_STATE.skills.filter(sk => charSkillIds.includes(sk.id));
  const otherSkills = AVT_STATE.skills.filter(sk => !charSkillIds.includes(sk.id));
  const animLabel = t => ({nenhuma:'',simples:'Simples',gsap:'GSAP',pixi_particulas:'Partículas',pixi_spine:'Skeleton'}[t]||t);

  container.innerHTML = `
    <div class="avt-ce-section-title">Minhas Skills</div>
    ${mySkills.length ? `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
      ${mySkills.map(sk=>`
        <div style="padding:10px 12px;background:rgba(79,163,209,0.06);border:1px solid rgba(79,163,209,0.25);border-radius:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
            <span style="font-size:0.82rem;color:#c8d8e8;font-family:var(--fonte-d);font-weight:600">${sk.habilidade||'Skill'}</span>
            ${AVT_STATE.isMestre?`<button class="avt-mp-btn avt-mp-btn-danger" style="padding:2px 7px;font-size:0.68rem" onclick="_avtSkillToggleChar('${ent.id}','${sk.id}')">− Remover</button>`:''}
          </div>
          <div style="font-size:0.68rem;color:#7a92aa;display:flex;gap:10px;flex-wrap:wrap">
            ${sk.formula_dano?`<span>🎲 ${sk.formula_dano}</span>`:''}
            ${sk.tipo_dano?`<span>💥 ${sk.tipo_dano}</span>`:''}
            ${sk.cooldown_turnos?`<span>⏱ ${sk.cooldown_turnos}t</span>`:''}
            ${sk.animacao?.tipo&&sk.animacao.tipo!=='nenhuma'?`<span>🎆 ${animLabel(sk.animacao.tipo)}</span>`:''}
          </div>
          ${sk.descricao?`<div style="font-size:0.68rem;color:#5a7288;margin-top:4px;font-style:italic">${sk.descricao}</div>`:''}
        </div>`).join('')}
    </div>` : `<div style="color:#7a92aa;font-size:0.75rem;font-style:italic;padding:8px 0 12px">Nenhuma skill atribuída ainda.</div>`}
    ${AVT_STATE.isMestre && AVT_STATE.skills.length ? `
    <details style="margin-top:4px">
      <summary style="font-size:0.72rem;color:#4fa3d1;cursor:pointer;padding:6px 0;user-select:none">▸ Gerenciar skills (${otherSkills.length} disponíveis)</summary>
      <div style="display:flex;flex-direction:column;gap:5px;margin-top:8px">
        ${AVT_STATE.skills.map(sk=>{
          const has = charSkillIds.includes(sk.id);
          return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(255,255,255,0.02);border:1px solid ${has?'rgba(79,163,209,0.2)':'rgba(255,255,255,0.05)'};border-radius:7px">
            <div style="flex:1;min-width:0">
              <div style="font-size:0.76rem;color:${has?'#c8d8e8':'#6a8298'};font-family:var(--fonte-d)">${sk.habilidade||'Skill'}</div>
              <div style="font-size:0.62rem;color:#4a6275">${sk.formula_dano||'—'} · ${sk.tipo_dano||'—'}</div>
            </div>
            <button class="avt-mp-btn ${has?'avt-mp-btn-danger':''}" style="padding:2px 8px;font-size:0.68rem" onclick="_avtSkillToggleChar('${ent.id}','${sk.id}')">${has?'− Remover':'+ Dar'}</button>
          </div>`;}).join('')}
      </div>
    </details>` : ''}`;
}

function _avtSkillToggleChar(entId, skillId) {
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  if (!ent) return;
  const dbChar = AVT_STATE.chars.find(c=>c.id===ent?.dbId||c.nome===ent?.nome);
  // Use dbChar if available, otherwise store on entity directly (dungeon-generated NPCs)
  const target = dbChar || ent;
  if (!target.custom_attrs) target.custom_attrs = {};
  if (!target.custom_attrs.skills_ids) target.custom_attrs.skills_ids = [];
  const ids = target.custom_attrs.skills_ids;
  const idx = ids.indexOf(skillId);
  if (idx>=0) ids.splice(idx,1); else ids.push(skillId);
  if (dbChar?.id) {
    _avtSb('characters?id=eq.' + encodeURIComponent(dbChar.id), {
      method:'PATCH', body:JSON.stringify({ custom_attrs: dbChar.custom_attrs })
    }).catch(e => mostrarToast('Erro ao salvar skill: ' + (e?.message||e), 'erro'));
  }
  // Sync personagem/character_id on the skill so combat HUD filter stays consistent
  const skObj = AVT_STATE.skills.find(s => s.id === skillId);
  if (skObj && dbChar) {
    if (idx >= 0) {
      // removed — clear link if owned by this character
      if (skObj.personagem === dbChar.nome || skObj.character_id === dbChar.id) {
        skObj.personagem = ''; skObj.character_id = null;
        _avtSb('skills?id=eq.' + encodeURIComponent(skillId), {
          method: 'PATCH', body: JSON.stringify({ personagem: '', character_id: null })
        }).catch(() => {});
      }
    } else {
      // added — bind to this character
      skObj.personagem = dbChar.nome; skObj.character_id = dbChar.id;
      _avtSb('skills?id=eq.' + encodeURIComponent(skillId), {
        method: 'PATCH', body: JSON.stringify({ personagem: dbChar.nome, character_id: dbChar.id })
      }).catch(() => {});
    }
  }
  _avtCharEditorRender();
}

function _avtCharEditorRenderSkillEdit(container) {
  if (!container) return;
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div class="avt-ce-section-title" style="margin:0">Skills da Aventura</div>
      <button class="avt-mp-btn" onclick="_avtSkillNova()">+ Nova Skill</button>
    </div>
    <div id="avt-ce-skill-lista">
      ${AVT_STATE.skills.length ? AVT_STATE.skills.map(_avtSkillCardHtml).join('') : '<div style="color:#7a92aa;font-size:0.75rem;font-style:italic">Nenhuma skill ainda.</div>'}
    </div>`;
}

function _avtSkillCardHtml(sk) {
  const eid = 'avt-sk-f-' + sk.id.replace(/[^a-z0-9]/gi,'_');
  const anim = sk.animacao || {};
  const animTipo = anim.tipo || 'nenhuma';
  const attrDefs = (RPG_DATA?.attrDefs || []).filter(a => a.tipo === 'number');

  const TIPOS_DANO = ['fisico','magico','fogo','gelo','raio','veneno','cura','psiquico','forcas','luz','sombra'];
  const ANIM_TIPOS = ['nenhuma','simples','gsap','pixi_particulas','pixi_spine'];
  const GSAP_PRESETS = ['impacto_shake','impacto_escala','aura_pulso','critico_espiral','cura_flutuante','raio_dash','teletransporte','invocar_aparece','explosao_radial','gelo_freeze','fogo_charge','sombra_mergulho'];
  const GATILHOS = ['ser_atacado','ser_atingido','sofrer_dano','aliado_atacado','inimigo_move_adjacente','inicio_turno_proprio','fim_turno_proprio','acertar_critico','matar_inimigo','custom'];

  const efeitosBonus = Array.isArray(sk.efeitos_bonus) ? sk.efeitos_bonus : [];

  return `
    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:8px;margin-bottom:6px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer" onclick="const f=document.getElementById('${eid}');f.style.display=f.style.display==='none'?'block':'none'">
        <span style="flex:1;font-family:var(--fonte-d);font-size:0.78rem;color:#c8d8e8">${sk.habilidade||sk.nome||'Skill'}</span>
        <span style="font-size:0.62rem;color:#7a92aa">${sk.formula_dano||'—'} · ${sk.tipo_dano||sk.tipo||'—'}${sk.cooldown_turnos?` · ⏱${sk.cooldown_turnos}t`:''}</span>
        <button class="avt-mp-btn avt-mp-btn-danger" onclick="event.stopPropagation();_avtSkillDeletar('${sk.id}')" style="padding:2px 6px">✕</button>
      </div>
      <div id="${eid}" style="display:none;padding:12px;border-top:1px solid rgba(255,255,255,0.06)">

        <!-- Row 1: Nome + Fórmula -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div><div class="avt-sk-label">Nome</div>
            <input value="${(sk.habilidade||'').replace(/"/g,'&quot;')}" oninput="_avtSkillField('${sk.id}','habilidade',this.value)"
              style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          <div><div class="avt-sk-label">Fórmula de dano</div>
            <input value="${sk.formula_dano||''}" placeholder="2d6+3" oninput="_avtSkillField('${sk.id}','formula_dano',this.value)"
              style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
        </div>

        <!-- Row 2: Tipo dano + Cooldown + Alcance -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
          <div><div class="avt-sk-label">Tipo de dano</div>
            <select onchange="_avtSkillField('${sk.id}','tipo_dano',this.value)"
              style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem">
              ${TIPOS_DANO.map(t=>`<option value="${t}" ${(sk.tipo_dano||'fisico')===t?'selected':''}>${t}</option>`).join('')}
            </select></div>
          <div><div class="avt-sk-label">Cooldown (turnos)</div>
            <input type="number" min="0" max="99" value="${sk.cooldown_turnos||0}" oninput="_avtSkillField('${sk.id}','cooldown_turnos',+this.value)"
              style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          <div><div class="avt-sk-label">Alcance (células)</div>
            <input type="number" min="0" max="99" value="${sk.alcance_celulas!=null?sk.alcance_celulas:''}" placeholder="—" oninput="_avtSkillField('${sk.id}','alcance_celulas',this.value===''?null:+this.value)"
              style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
        </div>

        <!-- Row 3: Atributo base + Mod% + Alvo -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
          <div><div class="avt-sk-label">Atributo base</div>
            <select onchange="_avtSkillField('${sk.id}','atributo_base',this.value)"
              style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem">
              <option value="">— Nenhum —</option>
              ${attrDefs.map(a=>`<option value="${a.nome}" ${sk.atributo_base===a.nome?'selected':''}>${a.nome}</option>`).join('')}
            </select></div>
          <div><div class="avt-sk-label">Mod. atributo (%)</div>
            <input type="number" min="-999" max="999" value="${sk.mod_atributo_pct!=null?sk.mod_atributo_pct:''}" placeholder="0"
              oninput="_avtSkillField('${sk.id}','mod_atributo_pct',this.value===''?null:+this.value)"
              style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          <div><div class="avt-sk-label">Tipo de alvo</div>
            <select onchange="_avtSkillField('${sk.id}','alvo_tipo',this.value)"
              style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem">
              ${['inimigo','aliado','proprio','area'].map(t=>`<option value="${t}" ${(sk.alvo_tipo||'inimigo')===t?'selected':''}>${t}</option>`).join('')}
            </select></div>
        </div>

        <!-- Row 4: Crítico pos + neg -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div><div class="avt-sk-label">Crítico positivo (nat 20)</div>
            <input value="${(sk.critico_positivo||'').replace(/"/g,'&quot;')}" placeholder="ex: Atordoa por 1 turno"
              oninput="_avtSkillField('${sk.id}','critico_positivo',this.value)"
              style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          <div><div class="avt-sk-label">Falha crítica (nat 1)</div>
            <input value="${(sk.critico_negativo||'').replace(/"/g,'&quot;')}" placeholder="ex: Perde próximo turno"
              oninput="_avtSkillField('${sk.id}','critico_negativo',this.value)"
              style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
        </div>

        <!-- Efeitos bônus -->
        <div style="margin-bottom:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <div class="avt-sk-label">Efeitos bônus</div>
            <button class="avt-mp-btn" style="padding:2px 8px;font-size:0.68rem" onclick="_avtSkillAddEfeito('${sk.id}')">+ Efeito</button>
          </div>
          <div id="avt-sk-efeitos-${sk.id.replace(/[^a-z0-9]/gi,'_')}">
            ${efeitosBonus.map((ef, i) => `
              <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;padding:5px 8px;background:rgba(79,163,209,0.05);border:1px solid rgba(79,163,209,0.15);border-radius:5px">
                <select onchange="_avtSkillEfeitoField('${sk.id}',${i},'tipo',this.value)"
                  style="padding:3px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:4px;color:#c8d8e8;font-size:0.7rem">
                  ${['buff','debuff','veneno','sangramento','atordoamento','invocacao','cura_bonus','dano_bonus'].map(t=>`<option value="${t}" ${ef.tipo===t?'selected':''}>${t}</option>`).join('')}
                </select>
                <input value="${(ef.descricao||'').replace(/"/g,'&quot;')}" placeholder="Descrição"
                  oninput="_avtSkillEfeitoField('${sk.id}',${i},'descricao',this.value)"
                  style="flex:1;padding:3px 5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:4px;color:#c8d8e8;font-size:0.7rem">
                <input type="number" value="${ef.duracao_turnos||1}" min="1" max="99" placeholder="Dur."
                  oninput="_avtSkillEfeitoField('${sk.id}',${i},'duracao_turnos',+this.value)"
                  style="width:45px;padding:3px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:4px;color:#c8d8e8;font-size:0.7rem;text-align:center"
                  title="Duração (turnos)">
                <button onclick="_avtSkillRemEfeito('${sk.id}',${i})" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:0.9rem;padding:0;line-height:1">✕</button>
              </div>`).join('')}
          </div>
        </div>

        <!-- Habilidade reativa -->
        <div style="margin-bottom:8px">
          <div class="avt-sk-label" style="margin-bottom:4px">Habilidade reativa</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><div class="avt-sk-label">Gatilho</div>
              <select onchange="_avtSkillField('${sk.id}','gatilho_tipo',this.value||null)"
                style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem">
                <option value="">— Não reativa —</option>
                ${GATILHOS.map(g=>`<option value="${g}" ${sk.gatilho_tipo===g?'selected':''}>${g}</option>`).join('')}
              </select></div>
            <div><div class="avt-sk-label">Condição (opcional)</div>
              <input value="${(sk.gatilho_descricao||'').replace(/"/g,'&quot;')}" placeholder="ex: apenas se aliado"
                oninput="_avtSkillField('${sk.id}','gatilho_descricao',this.value)"
                style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          </div>
        </div>

        <!-- Descrição -->
        <div style="margin-bottom:8px"><div class="avt-sk-label">Descrição / efeito narrativo</div>
          <textarea rows="2" oninput="_avtSkillField('${sk.id}','descricao',this.value)"
            style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.72rem;resize:none">${sk.descricao||''}</textarea>
        </div>

        <!-- Animação -->
        <div style="margin-bottom:10px">
          <div class="avt-sk-label" style="margin-bottom:6px">Animação</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
            ${ANIM_TIPOS.map(t => `<button class="avt-mp-btn ${animTipo===t?'avt-mp-btn-ativo':''}" style="font-size:0.68rem;padding:3px 8px"
              onclick="_avtSkillAnimSetTipo('${sk.id}','${t}',this)">${{nenhuma:'Nenhuma',simples:'Simples',gsap:'GSAP',pixi_particulas:'Pixi Partículas',pixi_spine:'Pixi Skeleton'}[t]||t}</button>`).join('')}
          </div>
          <div id="avt-sk-anim-cfg-${sk.id.replace(/[^a-z0-9]/gi,'_')}">
            ${_avtSkillAnimCfgHtml(sk)}
          </div>
        </div>

        <button class="avt-mp-btn avt-mp-btn-ok" onclick="_avtSkillSalvar('${sk.id}')" style="width:100%">💾 Salvar skill</button>
      </div>
    </div>`;
}

function _avtSkillField(id, field, val) { const sk=AVT_STATE.skills.find(s=>s.id===id); if(sk) sk[field]=val; }

function _avtSkillEfeitoField(skId, idx, field, val) {
  const sk = AVT_STATE.skills.find(s=>s.id===skId);
  if (!sk) return;
  if (!Array.isArray(sk.efeitos_bonus)) sk.efeitos_bonus = [];
  if (!sk.efeitos_bonus[idx]) sk.efeitos_bonus[idx] = {};
  sk.efeitos_bonus[idx][field] = val;
}

function _avtSkillAddEfeito(skId) {
  const sk = AVT_STATE.skills.find(s=>s.id===skId);
  if (!sk) return;
  if (!Array.isArray(sk.efeitos_bonus)) sk.efeitos_bonus = [];
  sk.efeitos_bonus.push({ tipo:'debuff', descricao:'', duracao_turnos:1 });
  // Re-render just this skill card
  const eid = 'avt-sk-f-' + skId.replace(/[^a-z0-9]/gi,'_');
  const container = document.getElementById(eid);
  if (!container) return;
  const expanded = container.style.display !== 'none';
  const parent = container.parentElement;
  if (parent) parent.outerHTML = _avtSkillCardHtml(sk);
  const newEl = document.getElementById(eid);
  if (newEl && expanded) newEl.style.display = 'block';
}

function _avtSkillRemEfeito(skId, idx) {
  const sk = AVT_STATE.skills.find(s=>s.id===skId);
  if (!sk || !Array.isArray(sk.efeitos_bonus)) return;
  sk.efeitos_bonus.splice(idx, 1);
  const eid = 'avt-sk-f-' + skId.replace(/[^a-z0-9]/gi,'_');
  const container = document.getElementById(eid);
  if (!container) return;
  const expanded = container.style.display !== 'none';
  const parent = container.parentElement;
  if (parent) parent.outerHTML = _avtSkillCardHtml(sk);
  const newEl = document.getElementById(eid);
  if (newEl && expanded) newEl.style.display = 'block';
}

function _avtSkillAnimSetTipo(skId, tipo, btn) {
  const sk = AVT_STATE.skills.find(s=>s.id===skId);
  if (!sk) return;
  if (!sk.animacao) sk.animacao = {};
  sk.animacao.tipo = tipo;
  // Update button states
  const allBtns = btn.parentElement.querySelectorAll('.avt-mp-btn');
  allBtns.forEach(b => b.classList.remove('avt-mp-btn-ativo'));
  btn.classList.add('avt-mp-btn-ativo');
  // Update config area
  const cfgId = 'avt-sk-anim-cfg-' + skId.replace(/[^a-z0-9]/gi,'_');
  const cfgEl = document.getElementById(cfgId);
  if (cfgEl) cfgEl.innerHTML = _avtSkillAnimCfgHtml(sk);
}

function _avtSkillAnimField(skId, field, val) {
  const sk = AVT_STATE.skills.find(s=>s.id===skId);
  if (!sk) return;
  if (!sk.animacao) sk.animacao = {};
  sk.animacao[field] = val;
}

function _avtSkillAnimCfgHtml(sk) {
  const anim = sk.animacao || {};
  const tipo = anim.tipo || 'nenhuma';
  const sid = sk.id.replace(/[^a-z0-9]/gi,'_');

  if (tipo === 'nenhuma') return '<div class="avt-mp-hint">Nenhuma animação ao usar esta skill.</div>';

  if (tipo === 'simples') {
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div><div class="avt-sk-label">Efeito visual</div>
        <select onchange="_avtSkillAnimField('${sk.id}','subtipo',this.value)"
          style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem">
          ${['Fogo','Gelo','Raio','Cura','Sombra','Arcano','Veneno','Impacto'].map(t=>`<option value="${t}" ${(anim.subtipo||'Impacto')===t?'selected':''}>${t}</option>`).join('')}
        </select></div>
      <div><div class="avt-sk-label">Cor</div>
        <input type="color" value="${anim.cor||'#e74c3c'}" oninput="_avtSkillAnimField('${sk.id}','cor',this.value)"
          style="width:100%;height:30px;padding:2px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;cursor:pointer"></div>
    </div>`;
  }

  if (tipo === 'gsap') {
    const GSAP_PRESETS = ['impacto_shake','impacto_escala','aura_pulso','critico_espiral','cura_flutuante','raio_dash','teletransporte','invocar_aparece','explosao_radial','gelo_freeze','fogo_charge','sombra_mergulho'];
    const gc = anim.gsap_config || {};
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div><div class="avt-sk-label">Preset GSAP</div>
        <select onchange="_avtSkillAnimGsapField('${sk.id}','preset',this.value)"
          style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem">
          ${GSAP_PRESETS.map(p=>`<option value="${p}" ${(gc.preset||'impacto_shake')===p?'selected':''}>${p}</option>`).join('')}
        </select></div>
      <div><div class="avt-sk-label">Cor</div>
        <input type="color" value="${gc.cor||'#e74c3c'}" oninput="_avtSkillAnimGsapField('${sk.id}','cor',this.value)"
          style="width:100%;height:30px;padding:2px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;cursor:pointer"></div>
      <div><div class="avt-sk-label">Intensidade</div>
        <input type="range" min="0.1" max="3" step="0.1" value="${gc.intensidade||1}"
          oninput="_avtSkillAnimGsapField('${sk.id}','intensidade',+this.value)"
          style="width:100%"></div>
      <div><div class="avt-sk-label">Alvo do efeito</div>
        <select onchange="_avtSkillAnimGsapField('${sk.id}','alvo_efeito',this.value)"
          style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem">
          ${['alvo','atacante','ambos'].map(t=>`<option value="${t}" ${(gc.alvo_efeito||'alvo')===t?'selected':''}>${t}</option>`).join('')}
        </select></div>
    </div>`;
  }

  if (tipo === 'pixi_particulas') {
    return `<div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div class="avt-sk-label">Config JSON (pixi-particles)</div>
        <button class="avt-mp-btn" style="font-size:0.65rem;padding:2px 7px" onclick="_avtSkillGerarAnimIA('${sk.id}','pixi_particulas')">⚡ Gerar com IA</button>
      </div>
      <textarea rows="6" placeholder='{"alpha":{"start":1,"end":0},"scale":{"start":0.3,"end":0},"color":{"start":"#e74c3c","end":"#f0cc6a"},"speed":{"start":200,"end":50},"lifetime":{"min":0.5,"max":1.5},"frequency":0.01,"maxParticles":100}'
        oninput="_avtSkillAnimParticleJson('${sk.id}',this.value)"
        style="width:100%;box-sizing:border-box;padding:6px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.68rem;font-family:monospace;resize:vertical">${anim.particle_config ? JSON.stringify(anim.particle_config, null, 2) : ''}</textarea>
    </div>`;
  }

  if (tipo === 'pixi_spine') {
    return `<div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div class="avt-sk-label">Config JSON (pixi-spine)</div>
        <button class="avt-mp-btn" style="font-size:0.65rem;padding:2px 7px" onclick="_avtSkillGerarAnimIA('${sk.id}','pixi_spine')">⚡ Gerar com IA</button>
      </div>
      <textarea rows="6" placeholder='{"skeleton":"URL_DO_SKELETON.json","atlas":"URL_DO_ATLAS.atlas","animation":"attack","posicao":"alvo","scale":1,"duracao":1000}'
        oninput="_avtSkillAnimSpineJson('${sk.id}',this.value)"
        style="width:100%;box-sizing:border-box;padding:6px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.68rem;font-family:monospace;resize:vertical">${anim.spine_config ? JSON.stringify(anim.spine_config, null, 2) : ''}</textarea>
    </div>`;
  }

  return '';
}

function _avtSkillAnimGsapField(skId, field, val) {
  const sk = AVT_STATE.skills.find(s=>s.id===skId);
  if (!sk) return;
  if (!sk.animacao) sk.animacao = {};
  if (!sk.animacao.gsap_config) sk.animacao.gsap_config = {};
  sk.animacao.gsap_config[field] = val;
}

function _avtSkillAnimParticleJson(skId, raw) {
  try {
    const cfg = JSON.parse(raw);
    const sk = AVT_STATE.skills.find(s=>s.id===skId);
    if (!sk) return;
    if (!sk.animacao) sk.animacao = {};
    sk.animacao.particle_config = cfg;
  } catch(e) { /* invalid JSON — ignore until valid */ }
}

function _avtSkillAnimSpineJson(skId, raw) {
  try {
    const cfg = JSON.parse(raw);
    const sk = AVT_STATE.skills.find(s=>s.id===skId);
    if (!sk) return;
    if (!sk.animacao) sk.animacao = {};
    sk.animacao.spine_config = cfg;
  } catch(e) { /* ignore */ }
}

async function _avtSkillGerarAnimIA(skId, animTipo) {
  const apiKey = typeof faseGenGetApiKey === 'function' ? faseGenGetApiKey() : null;
  if (!apiKey) {
    mostrarToast('Configure a chave da API Claude em Configurações do mapa para usar IA', 'aviso');
    return;
  }
  const sk = AVT_STATE.skills.find(s=>s.id===skId);
  if (!sk) return;

  const descricao = prompt(`Descreva o efeito visual desejado para "${sk.habilidade||'esta skill'}":\n(ex: "explosão de fogo laranja que se expande em anel", "cristais de gelo azul que congela o alvo")`);
  if (!descricao) return;

  mostrarToast('Gerando config de animação com IA…', '');

  const isParticle = animTipo === 'pixi_particulas';
  const systemPrompt = isParticle
    ? `Você é um especialista em pixi-particles. Gere APENAS um JSON válido de configuração de emitter para pixi-particles v5 que produza o efeito descrito. Sem texto adicional, apenas o JSON.`
    : `Você é um especialista em Pixi Spine. Gere APENAS um JSON válido de configuração de animação spine para RPG com os campos: skeleton (URL), atlas (URL), animation (nome), posicao (alvo/atacante), scale (número), duracao (ms). Sem texto adicional, apenas o JSON.`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-calls': 'true' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: descricao }]
      })
    });
    const data = await resp.json();
    const raw = data?.content?.[0]?.text?.trim() || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Resposta não contém JSON');
    const parsed = JSON.parse(jsonMatch[0]);

    if (!sk.animacao) sk.animacao = {};
    if (isParticle) sk.animacao.particle_config = parsed;
    else sk.animacao.spine_config = parsed;

    // Update textarea
    const cfgId = 'avt-sk-anim-cfg-' + skId.replace(/[^a-z0-9]/gi,'_');
    const cfgEl = document.getElementById(cfgId);
    if (cfgEl) cfgEl.innerHTML = _avtSkillAnimCfgHtml(sk);
    mostrarToast('Config de animação gerada!', 'ok');
  } catch(e) {
    mostrarToast('Erro ao gerar: ' + (e?.message||e), 'erro');
  }
}

function _avtSkillAnimTipo(id, tipo) {
  const sk = AVT_STATE.skills.find(s=>s.id===id);
  if (!sk) return;
  if (!sk.animacao) sk.animacao = {};
  sk.animacao.tipo = tipo;
}

async function _avtSkillNova() {
  const ent = AVT_STATE.entidades.find(e => e.id === AVT_STATE.charEditorId);
  const nova = {
    rpg_id: AVT_STATE.rpgId,
    personagem: ent?.nome || '',
    character_id: ent?.dbId || null,
    habilidade: 'Nova Skill',
    formula_dano: '1d6',
    efeito: '',
    animacao: { tipo: 'nenhuma' },
  };
  try {
    const res = await _avtSb('skills', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(nova) });
    if (res?.[0]?.id) nova.id = res[0].id;
  } catch(e) { nova.id = 'sk_local_' + Date.now(); mostrarToast('Skill criada localmente (sem sync)', 'aviso'); }
  AVT_STATE.skills.push(nova);
  _avtCharEditorRenderSkillEdit(document.getElementById('avt-ce-content'));
}

async function _avtSkillSalvar(id) {
  const sk = AVT_STATE.skills.find(s => s.id === id);
  if (!sk) return;
  const payload = {
    habilidade: sk.habilidade,
    efeito: sk.efeito || '',
    formula_dano: sk.formula_dano || null,
    tipo_dano: sk.tipo_dano || 'fisico',
    cooldown_turnos: sk.cooldown_turnos || 0,
    alcance_celulas: sk.alcance_celulas != null ? sk.alcance_celulas : null,
    atributo_base: sk.atributo_base || null,
    mod_atributo_pct: sk.mod_atributo_pct != null ? sk.mod_atributo_pct : null,
    alvo_tipo: sk.alvo_tipo || 'inimigo',
    critico_positivo: sk.critico_positivo || null,
    critico_negativo: sk.critico_negativo || null,
    efeitos_bonus: sk.efeitos_bonus?.length ? sk.efeitos_bonus : null,
    gatilho_tipo: sk.gatilho_tipo || null,
    gatilho_descricao: sk.gatilho_descricao || null,
    animacao: sk.animacao || null,
  };
  try {
    if (!sk.id || sk.id.startsWith('sk_local_')) {
      const ent = AVT_STATE.entidades.find(e => e.id === AVT_STATE.charEditorId);
      const res = await _avtSb('skills', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          ...payload,
          rpg_id: sk.rpg_id || AVT_STATE.rpgId,
          personagem: sk.personagem || ent?.nome || '',
          character_id: sk.character_id || ent?.dbId || null,
        })
      });
      if (res?.[0]?.id) sk.id = res[0].id;
    } else {
      await _avtSb('skills?id=eq.' + encodeURIComponent(sk.id), { method: 'PATCH', body: JSON.stringify(payload) });
    }
    mostrarToast('Skill salva!', 'ok');
  } catch(e) { mostrarToast('Erro: ' + (e?.message || e), 'erro'); }
}

async function _avtSkillDeletar(id) {
  if (!confirm('Deletar esta skill?')) return;
  AVT_STATE.skills = AVT_STATE.skills.filter(s=>s.id!==id);
  try { await _avtSb('skills?id=eq.' + encodeURIComponent(id), {method:'DELETE'}); } catch(e) {}
  _avtCharEditorRenderSkillEdit(document.getElementById('avt-ce-content'));
}

// ─────────────────────────────────────────────────────────────────────────────
// APPEARANCE IMPORT (AI)
// ─────────────────────────────────────────────────────────────────────────────

const _AVT_ANIM_PROMPT = `Crie os dados de aparência animada para este personagem de RPG top-down.
Retorne APENAS o JSON (sem texto adicional):

{
  "parts": {
    "_full": { "texture": "URL_OU_DATA_URI_SVG", "x": 0, "y": 0, "width": 128, "height": 200 }
  },
  "animations": {
    "idle": { "frames": [{"t":0,"transforms":{"_full":{"x":0,"y":0,"scaleY":1}}},{"t":500,"transforms":{"_full":{"x":0,"y":-2,"scaleY":1.02}}}], "duration":1000, "loop":true },
    "walk": { "frames": [{"t":0,"transforms":{"_full":{"x":0,"y":0}}},{"t":300,"transforms":{"_full":{"x":0,"y":-4}}}], "duration":600, "loop":true },
    "attack": { "frames": [{"t":0,"transforms":{"_full":{"x":0,"y":0}}},{"t":150,"transforms":{"_full":{"x":8,"y":-3}}}], "duration":400, "loop":false }
  },
  "equipment_slots": {}
}

Use SVG inline como texture (data:image/svg+xml,...) se não tiver imagem real.
O personagem é: [NOME_DESCRICAO]`;

function _avtCharImportarAparencia(entId) {
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  if (!ent) return;
  const overlay = document.getElementById('avt-anim-import-overlay');
  if (!overlay) return;
  const promptTxt = _AVT_ANIM_PROMPT.replace('[NOME_DESCRICAO]', ent.nome + ' — ' + (ent.tipo==='jogador'?'herói':'NPC inimigo'));
  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="avt-modal-box">
      <div class="avt-modal-header">
        <span>🎨 Aparência via IA — ${ent.nome}</span>
        <button onclick="document.getElementById('avt-anim-import-overlay').style.display='none'" style="background:none;border:none;color:#7a92aa;cursor:pointer;font-size:1.2rem;line-height:1;padding:0">×</button>
      </div>
      <div class="avt-modal-body">
        <p style="font-size:0.75rem;color:#7a92aa;margin:0 0 10px">Copie o prompt, envie para Claude ou outra IA junto com a imagem do personagem, cole o JSON retornado aqui. O sistema usa o mesmo formato de aparência animada já existente.</p>
        <div style="display:flex;gap:6px;margin-bottom:10px;align-items:flex-start">
          <textarea id="avt-anim-prompt-ta" rows="4" readonly style="flex:1;padding:7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.15);border-radius:6px;color:#7a92aa;font-size:0.64rem;resize:none;font-family:monospace">${promptTxt}</textarea>
          <button class="avt-mp-btn" onclick="_avtCopiarTexto('avt-anim-prompt-ta')" style="flex-shrink:0">⎘ Copiar</button>
        </div>
        <div style="font-size:0.7rem;color:#7a92aa;margin-bottom:5px">Cole o JSON retornado pela IA:</div>
        <textarea id="avt-anim-json-ta" rows="6" placeholder='{"parts":{...},"animations":{...}}'
          style="width:100%;box-sizing:border-box;padding:7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.7rem;resize:vertical;font-family:monospace"></textarea>
        <div id="avt-anim-status" style="font-size:0.7rem;min-height:1.4em;margin-top:5px"></div>
      </div>
      <div class="avt-modal-footer">
        <button class="avt-mp-btn" onclick="_avtAnimPreview()">👁 Validar JSON</button>
        <button class="avt-mp-btn" onclick="_avtAnimSalvar('${entId}')">💾 Salvar aparência</button>
      </div>
    </div>`;
}

function _avtCopiarTexto(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const txt = el.value||el.textContent;
  (navigator.clipboard?.writeText(txt)||Promise.reject()).then(
    ()=>mostrarToast('Copiado!','ok'),
    ()=>{ const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();mostrarToast('Copiado!','ok'); }
  );
}

function _avtAnimPreview() {
  const txt = document.getElementById('avt-anim-json-ta')?.value?.trim();
  const st  = document.getElementById('avt-anim-status');
  if (!txt) return;
  try {
    const data = JSON.parse(txt);
    if (!data.parts) throw new Error('Falta o campo "parts"');
    const nP = Object.keys(data.parts).length;
    const nA = Object.keys(data.animations||{}).length;
    if (st) st.innerHTML = '<span style="color:#27ae60">✓ JSON válido — ' + nP + ' parte(s), ' + nA + ' animação(ões)</span>';
  } catch(e) {
    if (st) st.innerHTML = '<span style="color:#e74c3c">✗ JSON inválido: ' + e.message + '</span>';
  }
}

async function _avtAnimSalvar(entId) {
  const txt = document.getElementById('avt-anim-json-ta')?.value?.trim();
  if (!txt) { mostrarToast('Cole o JSON antes de salvar', 'aviso'); return; }
  let data;
  try { data = JSON.parse(txt); if (!data.parts) throw new Error(); }
  catch(e) { mostrarToast('JSON inválido', 'erro'); return; }
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  const dbChar = AVT_STATE.chars.find(c=>c.id===ent?.dbId||c.nome===ent?.nome);
  if (!dbChar) { mostrarToast('Personagem não encontrado', 'erro'); return; }
  if (!dbChar.custom_attrs) dbChar.custom_attrs = {};
  dbChar.custom_attrs.animado_data = data;
  if (dbChar.id) {
    try {
      await _avtSb('characters?id=eq.' + encodeURIComponent(dbChar.id), {
        method:'PATCH', body:JSON.stringify({ custom_attrs:dbChar.custom_attrs })
      });
      mostrarToast('Aparência salva!', 'ok');
    } catch(e) { mostrarToast('Salvo localmente (erro DB)', 'aviso'); }
  }
  // Recarrega aparência da entidade correspondente para atualizar o token no mapa
  const entMapa = AVT_STATE.entidades.find(e => e.dbId === dbChar.id || e.nome === dbChar.nome);
  if (entMapa) _avtCarregarAparencia(entMapa);
  document.getElementById('avt-anim-import-overlay').style.display = 'none';
  _avtCharEditorRender();
}
