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
  batalha: {
    ativa: false,
    iniciativa: [],
    turnoIdx: 0,
    log: [],
    moverModo: false
  },
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
  }
};

const AVT_T  = { PAREDE: 0, PISO: 1 };
const AVT_SZ = 48;

// Presets de aparência para NPCs e Bosses genéricos
const AVT_NPC_PRESETS = {
  goblin:    { nome:'Goblin',    icone:'G', cor:'#3a7a20', hpBase:12, pacienciaSecs:5, deteccaoRaio:3 },
  esqueleto: { nome:'Esqueleto', icone:'S', cor:'#7a8090', hpBase:15, pacienciaSecs:6, deteccaoRaio:3 },
  orc:       { nome:'Orc',       icone:'O', cor:'#6a3010', hpBase:25, pacienciaSecs:4, deteccaoRaio:4 },
  troll:     { nome:'Troll',     icone:'T', cor:'#405c30', hpBase:40, pacienciaSecs:7, deteccaoRaio:4 },
  vampiro:   { nome:'Vampiro',   icone:'V', cor:'#4a0a2a', hpBase:30, pacienciaSecs:3, deteccaoRaio:5 },
  cultista:  { nome:'Cultista',  icone:'C', cor:'#2a1a5a', hpBase:18, pacienciaSecs:5, deteccaoRaio:3 },
  boss:      { nome:'Boss',      icone:'☠', cor:'#4a0000', hpBase:100, pacienciaSecs:1, deteccaoRaio:6, isBoss:true },
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
    lista.innerHTML = '<div style="color:#7a92aa;font-size:0.75rem;padding:8px 0;font-style:italic">Nenhuma aventura ainda.</div>';
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
        <div class="avt-card-sub">Aventura solo</div>
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
    importCampanhaId: null, mapa: null, mapaOpcao: null, faseId: null, etapa: 0
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
    btnNext.textContent = isLast ? '▶ Iniciar Aventura!' : 'Próximo →';
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
    <div class="etapa-titulo">Identidade da Aventura</div>
    <div class="etapa-desc">Nome e cor da sua aventura.</div>
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
    <div class="etapa-titulo">Mapa da Aventura</div>
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

    ${temFases ? `
    <div class="avt-mapa-opcao ${c.mapaOpcao==='fase'?'selecionado':''}" onclick="avtCriarSelecionarMapa('fase')"
      style="display:flex;align-items:center;gap:12px">
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
        <label>Descreva a aventura</label>
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
      <div style="font-size:0.72rem;color:#7a92aa">A fase será copiada para sua aventura (independente).</div>`;
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
  if (!campId) {
    AVT_STATE._criando.personagens = [{ nome: '', hp_max: 60, cor: '#4fa3d1' }];
    const lista = document.getElementById('avt-chars-lista');
    if (lista) lista.innerHTML = _avtCriarRenderCharsLista();
    return;
  }
  try {
    const [chars, fases] = await Promise.all([
      _avtSb(`characters?rpg_id=eq.${encodeURIComponent(campId)}&select=nome,hp_max,custom_attrs&order=nome`),
      _avtSb(`mapas?rpg_id=eq.${encodeURIComponent(campId)}&tipo=eq.fase&select=map_id,nome,render_data`)
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

  const btn = document.getElementById('avt-criar-btn-next');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Criando…'; }

  try {
    const rpgId = c.nome.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,30)
                  + '_avt_' + Date.now().toString(36);

    // Resolve dungeon
    let dungeonData = null;
    if (c.mapaOpcao === 'procedural' || c.mapa === 'procedural') {
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
    // Update local membros cache
    const m = AVT_STATE.membros.find(x => x.player_id === playerId);
    if (m) m.linked = charNome || null;
    mostrarToast('Personagem atribuído!', 'ok');
    _avtMestrePainelRender();
  } catch(e) { mostrarToast('Erro ao atribuir: ' + (e?.message||e), 'erro'); }
}

async function entrarAventura(rpgId) {
  // Cancel any existing render loop and event listeners before starting
  _avtCleanupListeners();

  mostrarLoading('Carregando aventura…');
  try {
    const [rpgs, chars, skills] = await Promise.all([
      _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(rpgId)}&select=*`),
      _avtSb(`characters?rpg_id=eq.${encodeURIComponent(rpgId)}&select=*&order=nome`),
      _avtSb(`skills?rpg_id=eq.${encodeURIComponent(rpgId)}&select=*`)
    ]);

    AVT_STATE.rpgId   = rpgId;
    AVT_STATE.rpg     = rpgs?.[0] || { rpg_id: rpgId, name: 'Aventura' };
    _avtDetectarMestre();
    AVT_STATE.chars   = chars || [];
    AVT_STATE.skills  = skills || [];
    AVT_STATE.entidades = [];
    AVT_STATE.npcTimers = {};
    AVT_STATE._lastFrameTs = 0;
    AVT_STATE.batalha = { ativa:false, iniciativa:[], turnoIdx:0, log:[], moverModo:false };

    // Load player assignment (which character this user controls)
    await _avtCarregarAtribuicaoJogador(rpgId);

    // Load or generate dungeon
    const t = AVT_STATE.rpg.theme_json || {};
    if (t.dungeon_data?.tiles) {
      AVT_STATE.dungeon = t.dungeon_data;
    } else {
      AVT_STATE.dungeon = _avtGerarDungeon(60, 40, 8);
    }
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
    }));

    salvarNav('rpg', rpgId);
  } catch(e) {
    ocultarLoading();
    mostrarToast('Erro ao carregar aventura: ' + (e?.message || e), 'erro');
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
  AVT_STATE.batalha = { ativa:false, iniciativa:[], turnoIdx:0, log:[], moverModo:false };
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
  const primRoom = rooms[0];
  const cores = ['#4fa3d1','#27ae60','#c8a84b','#7b2fbe','#e8604c'];

  AVT_STATE.chars.filter(c => c.custom_attrs?.tipo_personagem !== 'npc').forEach((c, i) => {
    const col = c.custom_attrs?.cor || cores[i % cores.length];
    const ca = c.custom_attrs || {};
    // Restore saved dungeon position if any
    const sx = typeof ca.avt_x === 'number' ? ca.avt_x : (primRoom?.x||1) + 1 + (i % 3);
    const sy = typeof ca.avt_y === 'number' ? ca.avt_y : (primRoom?.y||1) + 1 + Math.floor(i/3);
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
      if (d.tiles[y]?.[x] === AVT_T.PISO) piso.push({x,y});
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

// Edge-triggered camera: moves only when any player approaches the viewport border
function _avtCameraUpdate() {
  const canvas = AVT_STATE.canvas;
  if (!canvas?.width) return;
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera.zoom || 1));
  const MARGIN = 0.20; // 20% margin triggers camera scroll
  const mW = canvas.width  * MARGIN;
  const mH = canvas.height * MARGIN;

  const jogadores = AVT_STATE.entidades.filter(e => e.tipo === 'jogador' && e.hp > 0);
  if (!jogadores.length) return;

  let shiftX = 0, shiftY = 0;
  for (const j of jogadores) {
    const px = j.x * SZ - AVT_STATE.camera.x;
    const py = j.y * SZ - AVT_STATE.camera.y;
    if (px < mW)                 shiftX = Math.min(shiftX, px - mW);
    if (px > canvas.width - mW)  shiftX = Math.max(shiftX, px - (canvas.width - mW));
    if (py < mH)                 shiftY = Math.min(shiftY, py - mH);
    if (py > canvas.height - mH) shiftY = Math.max(shiftY, py - (canvas.height - mH));
  }
  AVT_STATE.camera.x += shiftX;
  AVT_STATE.camera.y += shiftY;
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
  const { canvas, ctx, dungeon, entidades, camera, batalha } = AVT_STATE;
  if (!ctx || !dungeon || !canvas.width) return;

  // Track delta time for patience timers
  const now = performance.now();
  const dt = AVT_STATE._lastFrameTs ? now - AVT_STATE._lastFrameTs : 0;
  AVT_STATE._lastFrameTs = now;

  // Update patience timers
  if (!batalha.ativa) _avtAtualizarPaciencias(dt);

  const SZ = Math.round(AVT_SZ * (camera.zoom || 1));

  ctx.fillStyle = '#050810';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < dungeon.h; y++) {
    for (let x = 0; x < dungeon.w; x++) {
      const t  = dungeon.tiles[y]?.[x];
      const px = Math.round(x * SZ - camera.x);
      const py = Math.round(y * SZ - camera.y);
      if (px + SZ < 0 || px > canvas.width || py + SZ < 0 || py > canvas.height) continue;
      if (t === AVT_T.PISO) {
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

  if (batalha.ativa && batalha.moverModo) {
    const ativo = _avtAtivo();
    if (ativo) {
      _avtBFS(ativo.x, ativo.y, 3).forEach(pos => {
        ctx.fillStyle = 'rgba(79,163,209,0.2)';
        ctx.fillRect(Math.round(pos.x*SZ-camera.x), Math.round(pos.y*SZ-camera.y), SZ, SZ);
      });
    }
  }

  entidades.forEach(e => {
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

    // Detection radius outline for enemies when patience active
    if (e.tipo === 'inimigo' && !batalha.ativa) {
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

    // Contorno de turno ativo
    if (batalha.ativa && batalha.iniciativa[batalha.turnoIdx]?.id === e.id) {
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
      if (AVT_STATE.dungeon.tiles[ny]?.[nx] !== AVT_T.PISO) return;
      if (AVT_STATE.entidades.some(e => e.x===nx && e.y===ny)) return;
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
  const ent = AVT_STATE.entidades.find(e => e.x===tileX && e.y===tileY);

  if (AVT_STATE.batalha.ativa) {
    if (AVT_STATE.batalha.moverModo) {
      const ativo = _avtAtivo();
      const isMestreCtrl = AVT_STATE.npcControlando && ativo?.id === AVT_STATE.npcControlando;
      if (ativo?.tipo === 'jogador' || isMestreCtrl) {
        const reachable = _avtBFS(ativo.x, ativo.y, 3);
        if (reachable.some(p => p.x===tileX && p.y===tileY)) {
          ativo.x = tileX; ativo.y = tileY;
          const entAtivo = AVT_STATE.entidades.find(e=>e.id===ativo.id);
          if (entAtivo) { entAtivo.x = tileX; entAtivo.y = tileY; }
          AVT_STATE.batalha.moverModo = false;
          _avtLog(`${ativo.nome} move para (${tileX},${tileY})`);
          _avtHudUpdate(); _avtCameraUpdate();
        }
      }
    } else if (ent?.tipo === 'inimigo') {
      const sel = document.getElementById('avt-hud-alvo');
      if (sel) sel.value = ent.id;
    }
  } else if (!ent) {
    const jogador = _avtMeuJogador();
    if (jogador && AVT_STATE.dungeon.tiles[tileY]?.[tileX] === AVT_T.PISO) {
      jogador.x = tileX; jogador.y = tileY;
      _avtCameraUpdate();
      _avtCheckProximidadeInimigos();
      realtimeBroadcast('avt_token_move', { nome: jogador.nome, x: jogador.x, y: jogador.y });
      _avtDebounceSalvarPosicao(jogador);
    }
  }
}

function _avtCanvasKey(e) {
  // Only capture keys when aventura screen is visible
  if (document.getElementById('aventura-screen')?.style.display === 'none') return;
  const keys = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1],
                 a:[-1,0], d:[1,0], w:[0,-1], s:[0,1] };
  const dir = keys[e.key];
  if (!dir) return;
  if (AVT_STATE.batalha.ativa && !AVT_STATE.batalha.moverModo) return;
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
  // Fallback: first player (single-player or unassigned session)
  return AVT_STATE.entidades.find(e => e.tipo === 'jogador');
}

function _avtMoverJogador(dx, dy) {
  // In combat moverModo, allow master to move the controlled NPC via WASD/dpad
  let jogador;
  if (AVT_STATE.batalha.ativa && AVT_STATE.batalha.moverModo && AVT_STATE.npcControlando) {
    const ativo = _avtAtivo();
    if (ativo?.id === AVT_STATE.npcControlando)
      jogador = AVT_STATE.entidades.find(e => e.id === AVT_STATE.npcControlando);
  }
  if (!jogador) jogador = _avtMeuJogador();
  if (!jogador) return;
  const nx = jogador.x + dx, ny = jogador.y + dy;
  if (AVT_STATE.dungeon.tiles[ny]?.[nx] !== AVT_T.PISO) return;
  if (AVT_STATE.entidades.some(e => e.x===nx && e.y===ny)) return;
  if (AVT_STATE.batalha.ativa && AVT_STATE.batalha.moverModo) {
    const reachable = _avtBFS(jogador.x, jogador.y, 3);
    if (!reachable.some(p => p.x===nx && p.y===ny)) return;
    const ativo = _avtAtivo();
    if (ativo?.id === jogador.id) {
      ativo.x = nx; ativo.y = ny;
      AVT_STATE.batalha.moverModo = false;
      _avtLog(`${jogador.nome} move para (${nx},${ny})`);
      _avtHudUpdate();
    }
  } else if (!AVT_STATE.batalha.ativa) {
    jogador.x = nx; jogador.y = ny;
    _avtCheckProximidadeInimigos();
    realtimeBroadcast('avt_token_move', { nome: jogador.nome, x: jogador.x, y: jogador.y });
    _avtDebounceSalvarPosicao(jogador);
  }
  _avtCameraUpdate();
}

function _avtCheckProximidadeInimigos() {
  if (AVT_STATE.batalha.ativa) return;
  const jogadores = AVT_STATE.entidades.filter(e => e.tipo === 'jogador' && e.hp > 0);
  AVT_STATE.entidades.filter(e => e.tipo === 'inimigo' && e.hp > 0).forEach(ini => {
    const raio = ini.deteccaoRaio ?? 3;
    const emRaio = jogadores.some(j => Math.abs(j.x - ini.x) + Math.abs(j.y - ini.y) <= raio);
    if (!AVT_STATE.npcTimers[ini.id]) {
      const maxMs = (ini.pacienciaSecs ?? 5) * 1000;
      AVT_STATE.npcTimers[ini.id] = { patience: maxMs, maxPatience: maxMs, ativo: false };
    }
    const timer = AVT_STATE.npcTimers[ini.id];
    if (emRaio) {
      timer.ativo = true;
    } else {
      timer.ativo = false;
      timer.patience = timer.maxPatience; // reset when player leaves
    }
  });
}

function _avtAtualizarPaciencias(dt) {
  if (AVT_STATE.batalha.ativa || !dt) return;
  for (const [id, timer] of Object.entries(AVT_STATE.npcTimers)) {
    if (!timer.ativo) continue;
    timer.patience = Math.max(0, timer.patience - dt);
    if (timer.patience <= 0) {
      avtCombateIniciar();
      return;
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
  if (AVT_STATE.batalha.ativa) return; // already started locally
  // Apply positions from payload first
  if (payload.posicoes) {
    payload.posicoes.forEach(({ nome, x, y }) => {
      const ent = AVT_STATE.entidades.find(e => e.nome === nome);
      if (ent) { ent.x = x; ent.y = y; }
    });
  }
  avtCombateIniciar();
}
window.avtReceberCombateInicio = avtReceberCombateInicio;

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

function avtCombateIniciar() {
  mostrarToast('⚔ Combate iniciado!', 'aviso');
  const vivos = AVT_STATE.entidades.filter(e => e.hp > 0);
  const init = vivos.map(e => ({
    ...e, initRoll: Math.floor(Math.random()*20)+1 + (e.tipo==='jogador' ? 4 : 0)
  })).sort((a,b) => b.initRoll - a.initRoll);

  AVT_STATE.batalha = { ativa:true, iniciativa:init, turnoIdx:0, log:['Combate iniciado!'], moverModo:false };

  // Broadcast combat start so other players enter combat too
  const posicoes = AVT_STATE.entidades.map(e => ({ nome: e.nome, x: e.x, y: e.y }));
  realtimeBroadcast('avt_combate_inicio', { posicoes });

  _avtHudMostrar(true);
  _avtHudUpdate();
  _avtRenderLog();
  if (_avtAtivo()?.tipo === 'inimigo') _avtSetTimeout(_avtNpcTurno, 800);
}

function avtCombateEncerrar() {
  AVT_STATE.batalha.ativa    = false;
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
    const mySkills = AVT_STATE.skills.filter(sk => sk.personagem===ativo.nome || sk.character_id===ativo.dbId);
    hudEsq.innerHTML = `
      <div class="avt-hud-turno" style="color:${ativo.cor}">Turno: <b>${ativo.nome}</b></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select id="avt-hud-alvo" style="flex:1;min-width:110px;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.72rem">
          ${inimigos.map(e => `<option value="${e.id}">${e.nome} (${e.hp}/${e.hpMax}HP)</option>`).join('')}
          ${!inimigos.length ? '<option>— sem alvos —</option>' : ''}
        </select>
        <select id="avt-hud-skill" style="flex:1;min-width:110px;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.72rem">
          <option value="">Ataque básico (1d8)</option>
          ${mySkills.map(sk => `<option value="${sk.id}" data-formula="${sk.formula_dano||'1d6'}">${sk.habilidade}</option>`).join('')}
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
  const ativo = _avtAtivo();
  if (!ativo || ativo.tipo !== 'jogador') return;
  const alvoId = document.getElementById('avt-hud-alvo')?.value;
  const alvo   = AVT_STATE.batalha.iniciativa.find(e => e.id===alvoId);
  if (!alvo || alvo.hp<=0) { mostrarToast('Selecione um alvo válido', 'aviso'); return; }

  const skillSel = document.getElementById('avt-hud-skill');
  const formula  = skillSel?.selectedOptions?.[0]?.dataset?.formula || '1d8';
  const skillNome = skillSel?.value ? skillSel.selectedOptions[0].text : 'Ataque básico';

  _avtSetEntState(ativo.id, 'attack');
  const dano    = _avtRolarFormula(formula);
  const hitRoll = Math.floor(Math.random()*20) + 1;

  if (hitRoll < 5) {
    _avtLog(`${ativo.nome} erra ${alvo.nome}! (${hitRoll})`);
    mostrarToast(`💨 ${ativo.nome} errou!`, '');
  } else {
    const real = hitRoll >= 19 ? dano * 2 : dano;
    alvo.hp = Math.max(0, alvo.hp - real);
    const entAlvo = AVT_STATE.entidades.find(e => e.id===alvo.id);
    if (entAlvo) entAlvo.hp = alvo.hp;
    const msg = hitRoll >= 19
      ? `🎯 CRÍTICO! ${ativo.nome} → ${alvo.nome}: ${real} (${skillNome})`
      : `⚔ ${ativo.nome} → ${alvo.nome}: ${real} (${skillNome})`;
    _avtLog(msg); mostrarToast(msg, 'ok');
    _avtRenderHpBar();
    if (alvo.hp <= 0) { _avtLog(`💀 ${alvo.nome} derrotado!`); _avtCheckVitoria(); }
  }
  _avtSetTimeout(_avtTurnoAvancar, 600);
}

function avtHudMover() {
  AVT_STATE.batalha.moverModo = !AVT_STATE.batalha.moverModo;
  mostrarToast(AVT_STATE.batalha.moverModo ? 'Clique no tile de destino (ou use WASD/D-pad)' : 'Mover cancelado', '');
}

function avtHudPassar() {
  const ativo = _avtAtivo();
  if (ativo) _avtLog(`${ativo.nome} passa o turno`);
  _avtTurnoAvancar();
}

function _avtTurnoAvancar() {
  const b = AVT_STATE.batalha;
  b.moverModo = false;
  b.iniciativa = b.iniciativa.filter(e => e.hp > 0);
  if (!b.iniciativa.length) { avtCombateEncerrar(); return; }
  b.turnoIdx = (b.turnoIdx + 1) % b.iniciativa.length;
  _avtHudUpdate();
  _avtRenderLog();
  if (_avtAtivo()?.tipo === 'inimigo') _avtSetTimeout(_avtNpcTurno, 600);
}

function _avtNpcTurno() {
  const b = AVT_STATE.batalha;
  const npc = _avtAtivo();
  if (!npc || npc.tipo !== 'inimigo') return;
  const entNpc = AVT_STATE.entidades.find(e => e.id===npc.id);
  if (!entNpc || entNpc.hp<=0) { _avtTurnoAvancar(); return; }
  // Master controlling this NPC — show HUD and wait for master input
  if (AVT_STATE.npcControlando === npc.id) { _avtHudUpdate(); return; }
  // AI globally disabled — pass turn
  if (!AVT_STATE.npcIaAtiva) {
    _avtLog(`${npc.nome} aguarda (IA desligada)`);
    _avtSetTimeout(_avtTurnoAvancar, 800);
    return;
  }

  const jogadores = AVT_STATE.entidades.filter(e => e.tipo==='jogador' && e.hp>0);
  if (!jogadores.length) { _avtTurnoAvancar(); return; }

  let nearest = jogadores[0], nearDist = Infinity;
  jogadores.forEach(j => {
    const d = Math.abs(j.x-entNpc.x) + Math.abs(j.y-entNpc.y);
    if (d < nearDist) { nearest=j; nearDist=d; }
  });

  if (nearDist <= 1) {
    _avtSetEntState(npc.id, 'attack');
    const dano = _avtRolarFormula('1d6');
    if (Math.floor(Math.random()*20)+1 < 6) {
      _avtLog(`${npc.nome} erra ${nearest.nome}`);
    } else {
      nearest.hp = Math.max(0, nearest.hp - dano);
      const initEnt = b.iniciativa.find(e => e.id===nearest.id || e.nome===nearest.nome);
      if (initEnt) initEnt.hp = nearest.hp;
      _avtLog(`👹 ${npc.nome} → ${nearest.nome}: ${dano} dano`);
      mostrarToast(`👹 ${npc.nome} ataca! -${dano} HP`, 'aviso');
      _avtRenderHpBar();
      if (nearest.hp <= 0) { _avtLog(`💀 ${nearest.nome} caiu!`); _avtCheckDerrota(); }
    }
  } else {
    let bestDir=null, bestDist=nearDist;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
      const nx=entNpc.x+dx, ny=entNpc.y+dy;
      if (AVT_STATE.dungeon.tiles[ny]?.[nx] !== AVT_T.PISO) return;
      if (AVT_STATE.entidades.some(e => e.x===nx && e.y===ny)) return;
      const d = Math.abs(nearest.x-nx) + Math.abs(nearest.y-ny);
      if (d < bestDist) { bestDist=d; bestDir=[dx,dy]; }
    });
    if (bestDir) { entNpc.x+=bestDir[0]; entNpc.y+=bestDir[1]; npc.x=entNpc.x; npc.y=entNpc.y; }
  }
  _avtSetTimeout(_avtTurnoAvancar, 500);
}

function _avtCheckVitoria() {
  if (!AVT_STATE.entidades.some(e => e.tipo==='inimigo' && e.hp>0)) {
    _avtSetTimeout(() => {
      avtCombateEncerrar();
      mostrarToast('✦ Vitória!', 'sucesso');
      _avtLog('=== VITÓRIA ==='); _avtRenderLog();
    }, 400);
  }
}

function _avtCheckDerrota() {
  if (!AVT_STATE.entidades.some(e => e.tipo==='jogador' && e.hp>0)) {
    _avtSetTimeout(() => {
      avtCombateEncerrar();
      mostrarToast('💀 Todos os heróis caíram…', 'erro');
      _avtLog('=== DERROTA ==='); _avtRenderLog();
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

function _avtLog(msg) {
  AVT_STATE.batalha.log.unshift(msg);
  if (AVT_STATE.batalha.log.length > 30) AVT_STATE.batalha.log.length = 30;
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
  const btn = document.getElementById('avt-btn-mestre');
  if (btn) btn.style.display = AVT_STATE.isMestre ? 'inline-flex' : 'none';
}

function avtMestrePainel() {
  const panel = document.getElementById('avt-mestre-panel');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'flex';
  if (!open) _avtMestrePainelRender();
}

function _avtMestrePainelRender() {
  const panel = document.getElementById('avt-mestre-panel');
  if (!panel) return;
  const b = AVT_STATE.batalha;
  const npcs = AVT_STATE.entidades.filter(e => e.tipo === 'inimigo' && e.hp > 0);
  const jogadores = AVT_STATE.entidades.filter(e => e.tipo === 'jogador');
  const membros = AVT_STATE.membros.filter(m => m.role !== 'mestre');

  panel.innerHTML = `
    <div class="avt-mp-header">
      <span>⚙ PAINEL DO MESTRE</span>
      <button onclick="avtMestrePainel()" style="background:none;border:none;color:#7a92aa;cursor:pointer;font-size:1.2rem;padding:0;line-height:1">×</button>
    </div>
    <div class="avt-mp-secao">
      <div class="avt-mp-label">🎮 MODO MESTRE</div>
      <div class="avt-mp-row" style="margin-bottom:4px">
        <button class="avt-mp-btn ${AVT_STATE.mestreAtivo?'avt-mp-btn-ativo':''}"
          onclick="AVT_STATE.mestreAtivo=!AVT_STATE.mestreAtivo;_avtMestrePainelRender();mostrarToast(AVT_STATE.mestreAtivo?'Controle total ativado':'Modo mestre desativado','ok')">
          ${AVT_STATE.mestreAtivo ? '🟢 Controle total ON' : '⚪ Controle total OFF'}
        </button>
      </div>
      <div style="font-size:0.65rem;color:#7a92aa">ON: move qualquer personagem. OFF: move apenas o seu.</div>
    </div>
    <div class="avt-mp-secao">
      <div class="avt-mp-label">⚔ COMBATE</div>
      <div class="avt-mp-row">
        ${b.ativa
          ? `<button class="avt-mp-btn avt-mp-btn-danger" onclick="avtCombateEncerrar();_avtMestrePainelRender()">✕ Encerrar combate</button>
             <button class="avt-mp-btn" onclick="avtHudPassar();_avtMestrePainelRender()">⏭ Passar turno</button>`
          : `<button class="avt-mp-btn" onclick="avtCombateIniciar();_avtMestrePainelRender()">⚔ Iniciar combate</button>`}
      </div>
    </div>
    <div class="avt-mp-secao">
      <div class="avt-mp-label">🤖 NPCS — Piloto Automático</div>
      <div class="avt-mp-row" style="margin-bottom:8px">
        <button class="avt-mp-btn ${AVT_STATE.npcIaAtiva?'avt-mp-btn-ativo':''}" onclick="AVT_STATE.npcIaAtiva=true;_avtMestrePainelRender()">ON</button>
        <button class="avt-mp-btn ${!AVT_STATE.npcIaAtiva?'avt-mp-btn-ativo':''}" onclick="AVT_STATE.npcIaAtiva=false;_avtMestrePainelRender()">OFF</button>
        ${AVT_STATE.npcControlando ? `<button class="avt-mp-btn avt-mp-btn-danger" onclick="AVT_STATE.npcControlando=null;_avtMestrePainelRender()">Liberar NPC</button>` : ''}
      </div>
      ${npcs.length ? `
        <div class="avt-mp-row">
          <select id="avt-mp-npc-sel" style="flex:1;padding:5px 7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem">
            <option value="">Escolher NPC…</option>
            ${npcs.map(n=>`<option value="${n.id}" ${AVT_STATE.npcControlando===n.id?'selected':''}>${n.nome} (${n.hp}/${n.hpMax} HP)</option>`).join('')}
          </select>
          <button class="avt-mp-btn" onclick="_avtMestreAssumir()">Assumir</button>
        </div>
      ` : `<div style="font-size:0.68rem;color:#7a92aa;font-style:italic">Nenhum NPC ativo</div>`}
    </div>
    <div class="avt-mp-secao">
      <div class="avt-mp-label">👤 PERSONAGENS</div>
      ${AVT_STATE.entidades.map(e=>`
        <div class="avt-mp-char-row" onclick="abrirAvtCharEditor('${e.id}');avtMestrePainel()">
          <span class="avt-mp-char-dot" style="background:${e.cor}"></span>
          <span class="avt-mp-char-nome">${e.nome}</span>
          <span class="avt-mp-char-hp" style="color:${e.hp/e.hpMax<0.3?'#e74c3c':'#7a92aa'}">${e.hp}/${e.hpMax}</span>
          <span style="font-size:0.62rem;color:rgba(79,163,209,0.5)">${e.tipo==='jogador'?'🧙':'👹'} ✏</span>
        </div>`).join('')}
    </div>
    ${membros.length ? `
    <div class="avt-mp-secao">
      <div class="avt-mp-label">🎮 ATRIBUIÇÃO DE JOGADORES</div>
      <div style="font-size:0.65rem;color:#7a92aa;margin-bottom:8px">Vincule cada jogador ao seu personagem.</div>
      ${membros.map(m => {
        const esc = m.player_id.replace(/'/g,"\\'");
        return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="flex:1;font-size:0.72rem;color:#c8d8e8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.nickname||m.player_id.slice(0,8)}</span>
          <select onchange="_avtMestreAtribuirJogador('${esc}',this.value)"
            style="flex:1;padding:3px 5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.68rem">
            <option value="">— nenhum —</option>
            ${jogadores.map(j=>`<option value="${j.nome}" ${m.linked===j.nome?'selected':''}>${j.nome}</option>`).join('')}
          </select>
        </div>`;
      }).join('')}
    </div>` : ''}
    <div class="avt-mp-secao">
      <div class="avt-mp-label">🗺 MAPA</div>
      <div class="avt-mp-row" style="flex-wrap:wrap">
        <button class="avt-mp-btn ${AVT_STATE.mestreVisaoGeral?'avt-mp-btn-ativo':''}" onclick="_avtMestreToggleVisao()">👁 Visão geral</button>
        <button class="avt-mp-btn" onclick="_avtMestreAddInimigo()">+ NPC/Boss</button>
      </div>
    </div>`;
}

function _avtMestreAssumir() {
  const sel = document.getElementById('avt-mp-npc-sel');
  if (!sel?.value) return;
  AVT_STATE.npcControlando = sel.value;
  AVT_STATE.npcIaAtiva = false;
  mostrarToast('🎮 Controlando: ' + (sel.options[sel.selectedIndex]?.text?.split('(')[0].trim()||'NPC'), 'ok');
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
    if (d.tiles[y]?.[x]===AVT_T.PISO && !AVT_STATE.entidades.some(e=>e.x===x&&e.y===y))
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
  const ativo = _avtAtivo();
  if (!ativo || ativo.tipo !== 'inimigo') return;
  const alvoId = document.getElementById('avt-hud-alvo')?.value;
  const alvo = AVT_STATE.batalha.iniciativa.find(e=>e.id===alvoId);
  if (!alvo || alvo.hp<=0) { mostrarToast('Selecione um alvo', 'aviso'); return; }
  _avtSetEntState(ativo.id, 'attack');
  const dano = _avtRolarFormula('1d8');
  const hitRoll = Math.floor(Math.random()*20)+1;
  if (hitRoll < 5) {
    _avtLog(`${ativo.nome} erra ${alvo.nome}! (${hitRoll})`);
    mostrarToast('💨 ' + ativo.nome + ' errou!', '');
  } else {
    const real = hitRoll >= 19 ? dano*2 : dano;
    alvo.hp = Math.max(0, alvo.hp - real);
    const entAlvo = AVT_STATE.entidades.find(e=>e.id===alvo.id);
    if (entAlvo) entAlvo.hp = alvo.hp;
    _avtLog('🎮 ' + ativo.nome + ' → ' + alvo.nome + ': ' + real + (hitRoll>=19?' (CRÍTICO)':''));
    mostrarToast(ativo.nome + ' ataca! -' + real + ' HP', 'aviso');
    _avtRenderHpBar();
    if (alvo.hp <= 0) { _avtLog('💀 ' + alvo.nome + ' caiu!'); _avtCheckDerrota(); }
  }
  _avtSetTimeout(_avtTurnoAvancar, 600);
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

function _avtCharEditorRenderEquip(container, ent, dbChar) {
  if (!container) return;
  const equip = dbChar.custom_attrs?.equipamento || {};
  const slots = [['arma','⚔ Arma'],['armadura','🛡 Armadura'],['acessorio','💍 Acessório'],['amuleto','📿 Amuleto'],['anel','🔮 Anel']];
  container.innerHTML = `
    <div class="avt-ce-section-title">Equipamentos</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${slots.map(([k,label])=>`
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px">
          <span style="min-width:88px;font-size:0.7rem;color:#7a92aa;font-family:var(--fonte-d)">${label}</span>
          ${AVT_STATE.isMestre
            ? `<input value="${equip[k]||''}" placeholder="— vazio —" onchange="_avtEquipChange('${ent.id}','${k}',this.value)"
                style="flex:1;padding:4px 7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem">`
            : `<span style="flex:1;font-size:0.8rem;color:${equip[k]?'#c8d8e8':'#444'}">${equip[k]||'— vazio —'}</span>`}
        </div>`).join('')}
    </div>
    ${AVT_STATE.isMestre?`<div style="margin-top:12px"><button class="avt-mp-btn" onclick="_avtCharSalvarAttrs('${ent.id}')">💾 Salvar equipamentos</button></div>`:''}`;
}

function _avtEquipChange(entId, slot, val) {
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  const dbChar = AVT_STATE.chars.find(c=>c.id===ent?.dbId||c.nome===ent?.nome);
  if (!dbChar) return;
  if (!dbChar.custom_attrs) dbChar.custom_attrs = {};
  if (!dbChar.custom_attrs.equipamento) dbChar.custom_attrs.equipamento = {};
  dbChar.custom_attrs.equipamento[slot] = val.trim();
}

function _avtCharEditorRenderSkills(container, ent, dbChar) {
  if (!container) return;
  const charSkillIds = dbChar.custom_attrs?.skills_ids || [];
  container.innerHTML = `
    <div class="avt-ce-section-title">Skills</div>
    ${AVT_STATE.skills.length ? `<div style="display:flex;flex-direction:column;gap:6px">
      ${AVT_STATE.skills.map(sk=>{
        const has = charSkillIds.includes(sk.id);
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(255,255,255,0.02);border:1px solid ${has?'rgba(79,163,209,0.25)':'rgba(255,255,255,0.06)'};border-radius:8px">
          <div style="flex:1">
            <div style="font-size:0.8rem;color:#c8d8e8;font-family:var(--fonte-d)">${sk.habilidade||sk.nome||'Skill'}</div>
            <div style="font-size:0.66rem;color:#7a92aa">${sk.formula_dano||'—'} · ${sk.tipo||'Ataque'}${sk.animacao?.tipo&&sk.animacao.tipo!=='Nenhum'?' · 🎆 '+sk.animacao.tipo:''}</div>
          </div>
          ${AVT_STATE.isMestre
            ? `<button class="avt-mp-btn ${has?'avt-mp-btn-danger':''}" onclick="_avtSkillToggleChar('${ent.id}','${sk.id}')">${has?'− Remover':'+ Dar'}</button>`
            : `<span style="font-size:0.8rem;color:${has?'#4fa3d1':'#333'}">${has?'✓':''}</span>`}
        </div>`;}).join('')}
    </div>` : `<div style="color:#7a92aa;font-size:0.75rem;font-style:italic;padding:12px 0">Nenhuma skill. Use a aba ⚙ Editar Skills para criar.</div>`}`;
}

function _avtSkillToggleChar(entId, skillId) {
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  const dbChar = AVT_STATE.chars.find(c=>c.id===ent?.dbId||c.nome===ent?.nome);
  if (!dbChar) return;
  if (!dbChar.custom_attrs) dbChar.custom_attrs = {};
  if (!dbChar.custom_attrs.skills_ids) dbChar.custom_attrs.skills_ids = [];
  const ids = dbChar.custom_attrs.skills_ids;
  const idx = ids.indexOf(skillId);
  if (idx>=0) ids.splice(idx,1); else ids.push(skillId);
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
  return `
    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:8px;margin-bottom:6px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer" onclick="const f=document.getElementById('${eid}');f.style.display=f.style.display==='none'?'block':'none'">
        <span style="flex:1;font-family:var(--fonte-d);font-size:0.78rem;color:#c8d8e8">${sk.habilidade||sk.nome||'Skill'}</span>
        <span style="font-size:0.66rem;color:#7a92aa">${sk.formula_dano||'—'} · ${sk.tipo||'Ataque'}</span>
        <button class="avt-mp-btn avt-mp-btn-danger" onclick="event.stopPropagation();_avtSkillDeletar('${sk.id}')" style="padding:2px 6px">✕</button>
      </div>
      <div id="${eid}" style="display:none;padding:10px;border-top:1px solid rgba(255,255,255,0.06)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div><div style="font-size:0.62rem;color:#7a92aa;margin-bottom:3px">Nome</div>
            <input value="${sk.habilidade||''}" oninput="_avtSkillField('${sk.id}','habilidade',this.value)"
              style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          <div><div style="font-size:0.62rem;color:#7a92aa;margin-bottom:3px">Fórmula (ex: 2d6+3)</div>
            <input value="${sk.formula_dano||''}" placeholder="2d6+3" oninput="_avtSkillField('${sk.id}','formula_dano',this.value)"
              style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          <div><div style="font-size:0.62rem;color:#7a92aa;margin-bottom:3px">Tipo</div>
            <select onchange="_avtSkillField('${sk.id}','tipo',this.value)"
              style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem">
              ${['Ataque','Cura','Suporte','Debuff'].map(t=>`<option ${(sk.tipo||'Ataque')===t?'selected':''}>${t}</option>`).join('')}
            </select></div>
          <div><div style="font-size:0.62rem;color:#7a92aa;margin-bottom:3px">Efeito visual</div>
            <select onchange="_avtSkillAnimTipo('${sk.id}',this.value)"
              style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem">
              ${['Nenhum','Fogo','Gelo','Raio','Cura','Sombra','Arcano','Veneno'].map(t=>`<option ${(sk.animacao?.tipo||'Nenhum')===t?'selected':''}>${t}</option>`).join('')}
            </select></div>
        </div>
        <div style="margin-bottom:8px"><div style="font-size:0.62rem;color:#7a92aa;margin-bottom:3px">Descrição / efeito especial</div>
          <textarea rows="2" oninput="_avtSkillField('${sk.id}','descricao',this.value)"
            style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.72rem;resize:none">${sk.descricao||''}</textarea>
        </div>
        <button class="avt-mp-btn" onclick="_avtSkillSalvar('${sk.id}')">💾 Salvar skill</button>
      </div>
    </div>`;
}

function _avtSkillField(id, field, val) { const sk=AVT_STATE.skills.find(s=>s.id===id); if(sk) sk[field]=val; }

function _avtSkillAnimTipo(id, tipo) {
  const sk = AVT_STATE.skills.find(s=>s.id===id);
  if (!sk) return;
  if (!sk.animacao) sk.animacao = {};
  sk.animacao.tipo = tipo;
}

async function _avtSkillNova() {
  const nova = { rpg_id:AVT_STATE.rpgId, habilidade:'Nova Skill', formula_dano:'1d6', tipo:'Ataque', animacao:{tipo:'Nenhum'}, descricao:'' };
  try {
    const res = await _avtSb('skills', { method:'POST', body:JSON.stringify(nova) });
    if (res?.[0]?.id) nova.id = res[0].id;
  } catch(e) { nova.id = 'sk_local_' + Date.now(); }
  AVT_STATE.skills.push(nova);
  _avtCharEditorRenderSkillEdit(document.getElementById('avt-ce-content'));
}

async function _avtSkillSalvar(id) {
  const sk = AVT_STATE.skills.find(s=>s.id===id);
  if (!sk) return;
  try {
    if (!sk.id || sk.id.startsWith('sk_local_')) {
      const res = await _avtSb('skills', { method:'POST', body:JSON.stringify({...sk,id:undefined}) });
      if (res?.[0]?.id) sk.id = res[0].id;
    } else {
      await _avtSb('skills?id=eq.' + encodeURIComponent(sk.id), {
        method:'PATCH', body:JSON.stringify({ habilidade:sk.habilidade, formula_dano:sk.formula_dano, tipo:sk.tipo, animacao:sk.animacao, descricao:sk.descricao })
      });
    }
    mostrarToast('Skill salva!', 'ok');
  } catch(e) { mostrarToast('Erro: ' + (e?.message||e), 'erro'); }
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
