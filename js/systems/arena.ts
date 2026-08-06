// systems/arena.js
// RPG Hub — Arena/PVP mode: state, navigation, characters, combat, initiatives
// Includes: AR state, arTab(), carregarArenaList(), arena combat system, Arena Hub

// ═══════════════════════════════════════════════════════════════
// ⚔️  ARENA MODE — Estado global
// ═══════════════════════════════════════════════════════════════
let AR: any = {
  session: null,      // {rpg_id, name, batalha_num, theme_json (parsed)}
  chars: [],          // [{nome, hp_atual, hp_max, custom_attrs:{descricao,tipo,buffs,cor}, ...}]
  estado: {cenario:'', turno:0, log:[]},  // lore secao='estado'
  estadoLoreId: null, // id do registro de lore do estado
  histList: [],       // [{id, titulo, conteudo}] lore secao='historico'
  d100Hist: [],
  ws: null,
  charTipoModal: 'jogador',
  hpEditNome: null,
  myRole: 'jogador',  // 'mestre' ou 'jogador'
  myNickname: '',     // nickname do player logado
  myCharNome: null,   // personagem vinculado ao player
  iniciativa: null,   // estado da iniciativa: {ativa, fase, ordem, ordemAtual, round, iniciativas, empatados}
  arenaIdCriada: null, // rpg_id da arena recém-criada
  bulkCriaturas: [],  // criaturas para criação em lote
  iniValorAtual: null, // valor rolado no modal de iniciativa
  vincularCriaturaNome: null, // criatura sendo vinculada
};

const AR_CORES = ['#e8604c','#4fa3d1','#27ae60','#c8a84b','#7b2fbe','#e91e8c','#00bcd4','#ff9800','#9c27b0','#607d8b'];

// ═══════════════════════════════════════════════════════════════
// INJEÇÃO NO HUB — adiciona seção Arena ao hub principal
// ═══════════════════════════════════════════════════════════════
window.addEventListener('load', ()=>{
  setTimeout(()=>{
    const hubBody = document.querySelector('.hub-body');
    if (!hubBody) return;
    const sep = document.createElement('div');
    sep.className = 'hub-arena-sep';
    sep.style.marginTop = '28px';
    sep.innerHTML = `
      <div class="hub-section-title" style="color:rgba(232,80,60,0.6)">Modo Arena</div>
      <button class="hub-arena-btn" onclick="abrirArenaHub()">
        <span style="font-size:1.1rem">⚔</span>
        <span>Beyonders & PVP Dinâmico</span>
      </button>`;
    hubBody.appendChild(sep);
  }, 100);
});

// ═══════════════════════════════════════════════════════════════
// NAVEGAÇÃO
// ═══════════════════════════════════════════════════════════════
async function abrirArenaHub() {
  document.getElementById('hub').style.display = 'none';
  document.getElementById('arena-hub').style.display = 'block';
  await carregarArenaList();
}

function fecharArenaHub() {
  salvarNav('hub');
  document.getElementById('arena-hub').style.display = 'none';
  document.getElementById('hub').style.display = '';
}

function sairArenaSession() {
  chatOcultar();
  salvarNav('hub');
  arFecharRealtime();
  document.getElementById('arena-session').style.display = 'none';
  document.getElementById('arena-hub').style.display = 'block';
  carregarArenaList();
}

function arTab(nome, btn) {
  document.querySelectorAll('.ar-tab-content').forEach(el => el.classList.remove('ativo'));
  document.querySelectorAll('.ar-tab').forEach(b => b.classList.remove('ativo'));
  document.getElementById('ar-tab-' + nome).classList.add('ativo');
  btn.classList.add('ativo');
  if (nome === 'config') { renderArenaConfig(); renderArenaDiceConfig(); }
  if (nome === 'd100') renderArenaDados();
  if (nome === 'efeitos') renderArenaEfeitos();
  if (nome === 'log') renderArenaLog();
  if (nome === 'iniciativa') renderArenaIniciativaUI();
  if (nome === 'entidades') { renderArenaEntidades(); renderSolicitacoesEntidade(); }
  if (nome === 'cenario') { renderArenaCenario(); renderPropostasCenario(); }
  if (AR.session) try{localStorage.setItem('rpghub_artab_'+AR.session.rpg_id, nome);}catch(e){}
}

// ═══════════════════════════════════════════════════════════════
// SUPABASE ARENA HELPERS
// ═══════════════════════════════════════════════════════════════
async function arSb<T = any>(path: string, opts: any={}): Promise<T | null> {
  return sb(path, opts); // usa a função sb() já existente
}
async function sbAnon(path) {
  // Para busca pública por código de acesso, usa anon key sem JWT.
  // Se houver sessão ativa, injeta o Bearer para que RLS do usuário se aplique.
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' };
  if (SESSION?.access_token) headers['Authorization'] = `Bearer ${SESSION.access_token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function carregarArenaList() {
  const el = document.getElementById('ar-sessoes-list');
  try {
    // Filtrar is_arena=true direto no banco (coluna real agora)
    const all = await arSb('rpg_registry?is_arena=eq.true&select=*&order=name');
    const userId = SESSION?.user?.id;
    // Mostrar arenas onde o usuário é dono OU é membro
    let membrosIds = [];
    if (userId) {
      try {
        const membros = await arSb(`rpg_members?player_id=eq.${userId}&select=rpg_id`);
        membrosIds = (membros||[]).map(m=>m.rpg_id);
      } catch(e){}
    }
    const arenas = (all||[]).filter(r => r.owner_id === userId || membrosIds.includes(r.rpg_id));
    if (!arenas.length) { el.innerHTML = '<div class="ar-empty">Nenhuma arena ainda<br><small style="font-size:0.78rem">Crie uma ou entre com um código</small></div>'; return; }
    el.innerHTML = arenas.map(a => {
      const t = a.theme_json || {};
      const bn = t.batalha_num || 1;
      const ehDono = a.owner_id === userId;
      const codigo = a.codigo_acesso || '';
      return `<div class="ar-session-item" onclick="entrarArena('${a.rpg_id}')">
        <div class="ar-session-icon">⚔</div>
        <div style="flex:1">
          <div class="ar-session-name">${a.name}</div>
          <div class="ar-session-batalha">Batalha #${bn}${ehDono && codigo ? ` · <span style="letter-spacing:0.15em;color:rgba(232,80,60,0.7)">${codigo}</span>` : ''}</div>
        </div>
        <span style="color:rgba(232,80,60,0.3);font-size:1.1rem">›</span>
      </div>`;
    }).join('');
  } catch(e) { el.innerHTML = '<div class="ar-empty" style="color:#e74c3c">Erro ao carregar</div>'; }
}

async function criarArenaSession() {
  const nome = document.getElementById('ar-nova-nome').value.trim();
  if (!nome) { arToast('Informe o nome da arena','erro'); return; }
  const id = 'arena_' + Date.now();
  // Gerar código de acesso curto (4-6 chars, maiúsculas)
  const codigo = Math.random().toString(36).substring(2,7).toUpperCase().replace(/[0-9]/g, c => String.fromCharCode(65+parseInt(c)));
  // Ler dado de efetividade
  const dadoEfetiv = parseInt(document.getElementById('ar-nova-dado-efetiv')?.value || '20') || 20;
  // Ler penalidades
  const penalidadesRows = document.querySelectorAll('#ar-nova-penalidades .ar-penal-row');
  const penalidades = [];
  penalidadesRows.forEach(row => {
    const hp = parseInt(row.querySelector('.ar-penal-hp')?.value);
    const val = parseInt(row.querySelector('.ar-penal-val')?.value);
    if (!isNaN(hp) && !isNaN(val) && hp > 0 && val > 0) penalidades.push({ hp, penalidade: val });
  });
  penalidades.sort((a,b) => b.hp - a.hp); // ordem decrescente de HP
  const theme = { batalha_num:1, dado_efetividade:dadoEfetiv, penalidades_hp:penalidades, preto:'#080608', escuro:'#100a0a', painel:'#180e0e', borda:'#2a1212', cinza:'#3a2020', texto:'#d8c8c8', suave:'#8a7070', primario:'#e8604c', primario_v:'#ff9580', destaque:'#e8604c', destaque_v:'#ff9580', perigo:'#c0392b', sucesso:'#27ae60', especial:'#7b2fbe' };
  try {
    await arSb('rpg_registry', {method:'POST', body:JSON.stringify({rpg_id:id, name:nome, owner_id: SESSION?.user?.id||null, theme_json:theme, is_arena:true, codigo_acesso:codigo})});
    // Registrar criador como mestre em rpg_members
    if (SESSION?.user?.id) {
      const nick = SESSION.profile?.nickname || 'Mestre';
      try { await arSb('rpg_members', {method:'POST', body:JSON.stringify({rpg_id:id, player_id:SESSION.user.id, nickname:nick, role:'mestre'})}); } catch(e) {}
    }
    AR.arenaIdCriada = id;
    // Mostrar código na tela
    document.getElementById('ar-criada-codigo').textContent = codigo;
    document.getElementById('ar-criada-form-wrap').style.display = 'none';
    document.getElementById('ar-criada-codigo-wrap').style.display = 'block';
    arToast('Arena criada! Compartilhe o código com os jogadores.','sucesso');
    await carregarArenaList();
  } catch(e) { arToast('Erro ao criar arena','erro'); console.error(e); }
}

function arEntrarArenaAposCriacao() {
  fecharModal('ar-modal-criar-arena');
  document.getElementById('ar-criada-form-wrap').style.display = 'block';
  document.getElementById('ar-criada-codigo-wrap').style.display = 'none';
  if (AR.arenaIdCriada) entrarArena(AR.arenaIdCriada);
}

function abrirModalCriarArena() {
  document.getElementById('ar-nova-nome').value='';
  document.getElementById('ar-criada-form-wrap').style.display = 'block';
  document.getElementById('ar-criada-codigo-wrap').style.display = 'none';
  // Reset dado efetividade
  const sel = document.getElementById('ar-nova-dado-efetiv');
  if (sel) sel.value = '20';
  // Reset penalidades para padrão
  const penalDiv = document.getElementById('ar-nova-penalidades');
  if (penalDiv) penalDiv.innerHTML = `
    <div class="ar-penal-row" style="display:flex;gap:6px;align-items:center">
      <span style="font-size:0.78rem;color:#9a8888;white-space:nowrap">HP &lt;</span>
      <input type="number" value="75" min="1" max="99" class="ar-input ar-penal-hp" style="width:60px;padding:6px 8px;text-align:center">
      <span style="font-size:0.78rem;color:#9a8888">→ −</span>
      <input type="number" value="5" min="1" class="ar-input ar-penal-val" style="width:60px;padding:6px 8px;text-align:center">
      <span style="font-size:0.78rem;color:#9a8888">no dado</span>
      <button onclick="this.closest('.ar-penal-row').remove()" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:1rem;padding:0 4px">✕</button>
    </div>
    <div class="ar-penal-row" style="display:flex;gap:6px;align-items:center">
      <span style="font-size:0.78rem;color:#9a8888;white-space:nowrap">HP &lt;</span>
      <input type="number" value="25" min="1" max="99" class="ar-input ar-penal-hp" style="width:60px;padding:6px 8px;text-align:center">
      <span style="font-size:0.78rem;color:#9a8888">→ −</span>
      <input type="number" value="15" min="1" class="ar-input ar-penal-val" style="width:60px;padding:6px 8px;text-align:center">
      <span style="font-size:0.78rem;color:#9a8888">no dado</span>
      <button onclick="this.closest('.ar-penal-row').remove()" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:1rem;padding:0 4px">✕</button>
    </div>
  `;
  abrirModal('ar-modal-criar-arena');
}

function arAdicionarPenalidadeRow() {
  const div = document.getElementById('ar-nova-penalidades');
  if (!div) return;
  const row = document.createElement('div');
  row.className = 'ar-penal-row';
  row.style.cssText = 'display:flex;gap:6px;align-items:center';
  row.innerHTML = `<span style="font-size:0.78rem;color:#9a8888;white-space:nowrap">HP &lt;</span>
    <input type="number" placeholder="50" min="1" max="99" class="ar-input ar-penal-hp" style="width:60px;padding:6px 8px;text-align:center">
    <span style="font-size:0.78rem;color:#9a8888">→ −</span>
    <input type="number" placeholder="10" min="1" class="ar-input ar-penal-val" style="width:60px;padding:6px 8px;text-align:center">
    <span style="font-size:0.78rem;color:#9a8888">no dado</span>
    <button onclick="this.closest('.ar-penal-row').remove()" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:1rem;padding:0 4px">✕</button>`;
  div.appendChild(row);
}

function arCopiarCodigo() {
  const codigo = document.getElementById('ar-criada-codigo').textContent;
  navigator.clipboard?.writeText(codigo).then(()=>arToast('Código copiado!','sucesso')).catch(()=>arToast('Código: '+codigo,''));
}

async function arEntrarPorCodigo() {
  const codigo = document.getElementById('ar-hub-codigo').value.trim().toUpperCase();
  if (!codigo || codigo.length < 3) { arToast('Informe o código da arena','erro'); return; }
  try {
    // Busca direto pela coluna codigo_acesso (filtro no banco)
    let rows; try { rows = await sbAnon(`rpg_registry?is_arena=eq.true&codigo_acesso=eq.${encodeURIComponent(codigo)}&select=*&limit=1`); } catch(e) { rows = await arSb(`rpg_registry?is_arena=eq.true&codigo_acesso=eq.${encodeURIComponent(codigo)}&select=*&limit=1`); }
    const arena = rows && rows[0];
    if (!arena) { arToast('Arena não encontrada com este código','erro'); return; }
    // Registrar como jogador em rpg_members se não estiver
    if (SESSION?.user?.id) {
      const membros = await arSb(`rpg_members?rpg_id=eq.${encodeURIComponent(arena.rpg_id)}&player_id=eq.${SESSION.user.id}&select=*`);
      if (!membros || !membros.length) {
        const nick = SESSION.profile?.nickname || 'Jogador';
        try { await arSb('rpg_members', {method:'POST', body:JSON.stringify({rpg_id:arena.rpg_id, player_id:SESSION.user.id, nickname:nick, role:'jogador'})}); } catch(e) {}
      }
    }
    document.getElementById('ar-hub-codigo').value = '';
    await entrarArena(arena.rpg_id);
  } catch(e) { arToast('Erro ao entrar por código','erro'); console.error(e); }
}

async function entrarArena(rpgId) {
  salvarNav('arena', rpgId);
  document.getElementById('arena-hub').style.display = 'none';
  document.getElementById('arena-session').style.display = 'block';
  // Reset tabs
  document.querySelectorAll('.ar-tab').forEach((b,i)=>b.classList.toggle('ativo',i===0));
  document.querySelectorAll('.ar-tab-content').forEach((c,i)=>c.classList.toggle('ativo',i===0));
  AR.d100Hist = [];

  try {
    const meta = (await arSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(rpgId)}&select=*&limit=1`))||[];
    if (!meta.length) { arToast('Sessão não encontrada','erro'); sairArenaSession(); return; }
    const m = meta[0];
    const t = m.theme_json || {};
    AR.session = { ...m, rpg_id: rpgId, theme: t };

    // Detectar papel do usuário logado
    AR.myRole = 'jogador';
    AR.myNickname = SESSION?.profile?.nickname || '';
    AR.myCharNome = null;
    if (SESSION?.user?.id) {
      const ehDono = m.owner_id === SESSION.user.id;
      if (ehDono) {
        AR.myRole = 'mestre';
      } else {
        try {
          const membro = await arSb(`rpg_members?rpg_id=eq.${encodeURIComponent(rpgId)}&player_id=eq.${SESSION.user.id}&select=*&limit=1`);
          if (membro && membro.length) {
            AR.myRole = membro[0].role || 'jogador';
            AR.myNickname = membro[0].nickname || AR.myNickname;
            AR.myCharNome = membro[0].linked || null;
          }
        } catch(e) {}
      }
    }

    // Badge de role
    const roleBadge = document.getElementById('ar-role-badge');
    if (roleBadge) roleBadge.innerHTML = AR.myRole === 'mestre'
      ? '<span class="ar-role-mestre">⚜ Mestre</span>'
      : '<span class="ar-role-jogador">⚔ Jogador</span>';

    document.getElementById('ar-session-nome').textContent = m.name;
    document.getElementById('ar-batalha-badge').textContent = `Batalha #${t.batalha_num||1}`;

    await arCarregarTudo();
    renderArenaDados();
    arMesaRenderDados();
    arAtualizarUIpeloPapel();
    arIniciarRealtime(rpgId);
    chatMostrar(rpgId);
    // Restaurar aba salva
    const savedArTab = localStorage.getItem('rpghub_artab_'+rpgId);
    if(savedArTab){
      const btn = document.querySelector(`.ar-tab[onclick*="'${savedArTab}'"]`);
      const el = document.getElementById('ar-tab-'+savedArTab);
      if(btn && el){ document.querySelectorAll('.ar-tab-content').forEach(c=>c.classList.remove('ativo')); document.querySelectorAll('.ar-tab').forEach(b=>b.classList.remove('ativo')); el.classList.add('ativo'); btn.classList.add('ativo'); }
    }
  } catch(e) { arToast('Erro ao entrar na arena','erro'); console.error(e); }
}

// Atualiza a UI de acordo com o papel do usuário
function arAtualizarUIpeloPapel() {
  const isMestre = AR.myRole === 'mestre';
  // Cenário
  const cMestre = document.getElementById('ar-cenario-mestre-btns');
  const cMestreCriar = document.getElementById('ar-cenario-mestre-criar');
  const cJogador = document.getElementById('ar-cenario-jogador-btns');
  const cPropostas = document.getElementById('ar-cenario-propostas-wrap');
  if (cMestre) cMestre.style.display = isMestre ? 'block' : 'none';
  if (cMestreCriar) cMestreCriar.style.display = isMestre ? 'block' : 'none';
  if (cJogador) cJogador.style.display = isMestre ? 'none' : 'block';
  if (cPropostas) cPropostas.style.display = isMestre ? 'block' : 'none';
  // Personagens
  const btnMestre = document.getElementById('ar-btn-novo-jogador-mestre');
  const btnPlayer = document.getElementById('ar-btn-novo-jogador-player');
  if (btnMestre) btnMestre.style.display = isMestre ? 'block' : 'none';
  if (btnPlayer) {
    const jaTemChar = AR.myCharNome || AR.chars.some(c => (c.custom_attrs?.owner_nickname||'') === AR.myNickname && (c.custom_attrs?.tipo||'jogador') === 'jogador');
    btnPlayer.style.display = (!isMestre && !jaTemChar) ? 'block' : 'none';
  }
  // Entidades
  const eMestre = document.getElementById('ar-entidades-btns-mestre');
  const ePlayer = document.getElementById('ar-entidades-btns-player');
  const eSolic = document.getElementById('ar-entidades-solicitacoes-wrap');
  if (eMestre) eMestre.style.display = isMestre ? 'block' : 'none';
  if (ePlayer) ePlayer.style.display = isMestre ? 'none' : 'block';
  if (eSolic) eSolic.style.display = isMestre ? 'block' : 'none';
  // Efeitos
  const efBtnsMestre = document.getElementById('ar-efeitos-btns-mestre');
  if (efBtnsMestre) efBtnsMestre.style.display = isMestre ? 'block' : 'none';
  // Mesa — botões de mapa (mestre only)
  const mesaBtnsMestre = document.getElementById('ar-mesa-btns-mestre');
  if (mesaBtnsMestre) mesaBtnsMestre.style.display = isMestre ? 'flex' : 'none';
  // Botão avançar turno (mestre controla turnos normais)
  const btnAvancar = document.getElementById('ar-btn-avancar-turno');
  if (btnAvancar) btnAvancar.style.display = isMestre ? 'block' : 'none';
  // Iniciativa
  renderArenaIniciativaUI();
  // Propostas de cenário e solicitações de entidade
  renderPropostasCenario();
  renderSolicitacoesEntidade();
}

async function arCarregarTudo() {
  const id = AR.session.rpg_id;
  const e = encodeURIComponent(id);
  const [chars, loreData, arAttrDefs] = await Promise.all([
    arSb(`characters?rpg_id=eq.${e}&select=*&order=nome`),
    arSb(`lore?rpg_id=eq.${e}&select=*`),
    arSb(`attr_defs?rpg_id=eq.${e}&select=*&order=ordem`)
  ]);
  AR.attrDefs = arAttrDefs || [];

  // custom_attrs é jsonb — já vem como objeto do Supabase
  AR.chars = (chars||[]).map(c => {
    if(typeof c.custom_attrs==='string'){try{c.custom_attrs=JSON.parse(c.custom_attrs);}catch(e){c.custom_attrs={};}}
    if(!c.custom_attrs||typeof c.custom_attrs!=='object')c.custom_attrs={};
    if (!Array.isArray(c.buffs)) c.buffs = [];
    // Sincronizar colunas dedicadas do DB para custom_attrs (igual ao getRPGData)
    c.custom_attrs.nivel       = c.nivel       ?? c.custom_attrs.nivel       ?? 1;
    c.custom_attrs.hp_max      = c.hp_max      ?? c.custom_attrs.hp_max      ?? 100;
    c.custom_attrs.xp          = c.xp          ?? c.custom_attrs.xp          ?? 0;
    c.custom_attrs.pontos_attr = c.pontos_attr ?? c.custom_attrs.pontos_attr ?? 0;
    return c;
  });

  // Estado arena: lido de rpg_registry.arena_estado (novo schema)
  const lores = loreData || [];
  AR.histList = lores.filter(l => l.secao === 'historico');
  try {
    const reg = await arSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(id)}&select=arena_estado&limit=1`);
    const raw = reg&&reg[0]?reg[0].arena_estado:null;
    if(raw){ AR.estado=typeof raw==='object'?raw:JSON.parse(raw); if(!AR.estado.log)AR.estado.log=[]; }
    else AR.estado={cenario:'',turno:0,log:[]};
    // Carregar estado de iniciativa do arena_estado
    if (AR.estado.iniciativa_arena) AR.iniciativa = (AR.estado as any).iniciativa_arena;
    else AR.iniciativa = null;
  } catch(e){ AR.estado={cenario:'',turno:0,log:[]}; AR.iniciativa=null; }

  renderArenaPersonagens();
  renderArenaEntidades();
  renderArenaEfeitos();
  renderArenaLog();
  renderArenaCenario();
  renderArenaD100Hist();
  renderArenaIniciativaUI();
  renderMesa();
  arAtualizarUIpeloPapel();

  // Carregar criativos pendentes da arena (mesma tabela que campanha)
  try {
    const critivosArena = await arSb(`criativos?rpg_id=eq.${encodeURIComponent(id)}&status=in.(pendente,aprovado_dc,dc_rolado_sucesso,dc_rolado_narrativo,dc_rolado_falha,aprovado_aguardando_rolagem)&select=*`);
    if (critivosArena && critivosArena.length) {
      // Fundir com CRIATIVOS_CAMP sem duplicar
      critivosArena.forEach(c => {
        const idx = CRIATIVOS_CAMP.findIndex(x => x.id === c.id);
        if (idx >= 0) CRIATIVOS_CAMP[idx] = c;
        else CRIATIVOS_CAMP.push(c);
      });
      criativoRenderMestre();
    }
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════════════
// RENDER: PERSONAGENS
// ═══════════════════════════════════════════════════════════════
function renderArenaPersonagens() {
  const jogadores = AR.chars.filter(c => (c.custom_attrs.tipo||'jogador') === 'jogador');
  const el = document.getElementById('ar-chars-list');
  if (!jogadores.length) { el.innerHTML = '<div class="ar-empty">Nenhum jogador ainda<br><small>Adicione ou aguarde outros jogadores criarem seus personagens</small></div>'; return; }
  el.innerHTML = jogadores.map(c => arCharCardHTML(c)).join('');
  // Atualizar botão de criação de personagem do player
  const btnPlayer = document.getElementById('ar-btn-novo-jogador-player');
  if (btnPlayer && AR.myRole !== 'mestre') {
    const jaTemChar = AR.myNickname && AR.chars.some(c => (c.custom_attrs?.owner_nickname||'') === AR.myNickname && (c.custom_attrs?.tipo||'jogador') === 'jogador');
    btnPlayer.style.display = jaTemChar ? 'none' : 'block';
  }
}

function renderArenaEntidades() {
  const ents = AR.chars.filter(c => ['criatura','objeto'].includes(c.custom_attrs.tipo||''));
  const el = document.getElementById('ar-entidades-list');
  if (!ents.length) { el.innerHTML = '<div class="ar-empty">Nenhuma entidade declarada</div>'; return; }
  el.innerHTML = ents.map(c => arCharCardHTML(c)).join('');
}

function arCharCardHTML(c) {
  const ca = c.custom_attrs || {};
  const hpMax = ca.hp_max ?? 100;
  const hp = c.hp_atual ?? hpMax;
  const hpPct = Math.round((hp / hpMax) * 100);
  const hpClass = hpPct >= 60 ? 'ar-hp-high' : hpPct >= 25 ? 'ar-hp-mid' : 'ar-hp-low';
  const cor = ca.cor || '#e8604c';
  const buffs = (c.buffs||ca.buffs||[]).filter(b => _buffAtivo(b));
  const tipoIcon = ca.tipo === 'criatura' ? '👹' : ca.tipo === 'objeto' ? '🗡' : '⚔';
  const hpColor = hp === 0 ? '#555' : `hsl(${hpPct*1.2},70%,50%)`;
  const incapacitado = hp <= 0;

  const isMestre = AR.myRole === 'mestre';
  // Verifica se é meu personagem pela ownership ou nickname
  const isMeuPersonagem = isMestre || AR.myCharNome === c.nome || (AR.myNickname && (ca.owner_nickname||'') === AR.myNickname);
  const ehNPC = ca.tipo === 'criatura' || ca.tipo === 'objeto';
  // NPCs: só mestre edita. Jogadores: cada um edita o seu.
  const podeEditar = isMestre || (!ehNPC && isMeuPersonagem);
  const podeAtacar = isMeuPersonagem && !incapacitado;

  // Badge de vínculo (para criaturas)
  const vincBadge = ca.vinculado_a ? `<span class="ar-vinculo-badge" title="Vinculada a ${ca.vinculado_a}">🔗 ${ca.vinculado_a}</span>` : '';
  // Badge de owner (para jogadores)
  const ownerBadge = !ehNPC && ca.owner_nickname ? `<span style="font-family:'Cinzel',serif;font-size:0.55rem;color:#7a6060;margin-left:4px">(${ca.owner_nickname})</span>` : '';

  let btnAtacar = '';
  if (podeAtacar) {
    btnAtacar = `<button class="ar-inline-btn-sm" onclick="abrirModalAtaque('${c.nome.replace(/'/g,"\\'")}','arena')" style="color:#e8604c;border-color:rgba(232,80,60,0.3)" title="Atacar">⚔</button>`;
  }

  // Botão inventário para o jogador dono do personagem
  const btnInventario = (isMeuPersonagem && !ehNPC) ? `<button class="ar-inline-btn-sm" onclick="abrirInventario('${c.nome.replace(/'/g,"\\'")}')" title="Inventário">🎒</button>` : '';

  // Botão vincular criatura (mestre, apenas criaturas)
  const btnVincular = (isMestre && ehNPC) ? `<button class="ar-inline-btn-sm" onclick="abrirModalVincular('${c.nome.replace(/'/g,"\\'")}')">🔗</button>` : '';

  return `<div class="ar-char-card" style="border-color:${cor}22;opacity:${incapacitado?0.55:1}">
    <div class="ar-char-top">
      <div class="ar-char-dot" style="background:${cor}"></div>
      <div style="flex:1">
        <div class="ar-char-nome" style="color:${cor}">${tipoIcon} ${c.nome}${ownerBadge}${incapacitado?' <span style="font-size:0.65rem;color:#e74c3c">[INCAPACITADO]</span>':''}</div>
        ${ca.tipo && ca.tipo !== 'jogador' ? `<div class="ar-char-tipo">${ca.tipo} ${vincBadge}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        ${btnAtacar}
        <button class="ar-inline-btn-sm" onclick="abrirModalHP('${c.nome.replace(/'/g,"\\'")}')">HP</button>
        ${btnInventario}
        ${!ehNPC && podeEditar ? `<button class="ar-inline-btn-sm" onclick="arAbrirAparencia('${c.nome.replace(/'/g,"\\'")}')">🎨</button>` : ''}
        ${podeEditar ? `<button class="ar-inline-btn-sm" onclick="abrirModalEditarChar('${c.nome.replace(/'/g,"\\'")}')">✎</button>` : ''}
        ${btnVincular}
      </div>
    </div>
    ${ca.descricao ? `<div class="ar-char-desc">${ca.descricao}</div>` : ''}
    <div class="ar-hp-label"><span>Vida</span><span style="color:${hpColor};font-family:'Cinzel',serif">${hp} / ${hpMax}</span></div>
    <div class="ar-hp-bar"><div class="ar-hp-fill ${hpClass}" style="width:${Math.min(hpPct,100)}%"></div></div>
    ${buffs.length ? `<div class="ar-efeitos-row">${buffs.map(b => {
      const resumo = atkResumoBuff ? atkResumoBuff(b) : (b.nome);
      const bc = b.sem_ataque || b.sem_movimento ? '#e8604c' : b.dot_formula ? '#f0cc6a' : (b.mod_dano??0)<0 ? '#e8604c' : '#7ec8f0';
      return `<span class="ar-badge" style="background:${bc}15;border:1px solid ${bc}33;color:${bc}">${b.nome}</span>`;
    }).join('')}</div>` : ''}
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// RENDER: CENÁRIO
// ═══════════════════════════════════════════════════════════════
function renderArenaCenario() {
  document.getElementById('ar-turno-num').textContent = AR.estado.turno || 0;
  const ct = document.getElementById('ar-cenario-texto');
  if (AR.estado.cenario) {
    ct.textContent = AR.estado.cenario;
    ct.style.color = '#c8b8b8';
    ct.style.fontStyle = 'normal';
  } else {
    ct.textContent = 'Nenhum cenário declarado';
    ct.style.color = '#9a8888';
    ct.style.fontStyle = 'italic';
  }
  try { renderAtaquesPendentes(); } catch(e) {}
}

async function salvarCenario() {
  const texto = document.getElementById('ar-cenario-input').value.trim();
  const img = document.getElementById('ar-cenario-img').value.trim();
  if (!texto) return;
  AR.estado.cenario = texto;
  (AR.estado as any).cenario_img = img;
  arAddLog(`📍 Cenário: ${texto}`);
  await arSalvarEstado();
  fecharModal('ar-modal-cenario');
  renderArenaCenario();
  renderMesa();
  arToast('Cenário atualizado!','sucesso');
}

// ═══════════════════════════════════════════════════════════════
// RENDER: EFEITOS
// ═══════════════════════════════════════════════════════════════
// ── Helper: ícones/resumo de um buff ─────────────────────────
function atkResumoBuff(b) {
  const partes = [];
  // Negativos
  if (b.dot_formula && (b.dot_turnos_restantes ?? 0) > 0)             partes.push(`🩸 DOT ${b.dot_formula} ×${b.dot_turnos_restantes}t`);
  if (b.sem_movimento && (b.sem_movimento_turnos_restantes ?? 0) > 0)  partes.push(`🚫 Mov. ${b.sem_movimento_turnos_restantes}t`);
  if (b.sem_ataque    && (b.sem_ataque_turnos_restantes    ?? 0) > 0)  partes.push(`⚔🚫 Atk(${b.sem_ataque_tipo||'todos'}) ${b.sem_ataque_turnos_restantes}t`);
  if ((b.mod_dano ?? 0) < 0 && (b.mod_dano_turnos_restantes ?? 0) > 0)
    partes.push(`📉 Dano ${b.mod_dano} ×${b.mod_dano_turnos_restantes}t`);
  // Positivos
  if (b.hot_formula   && (b.hot_turnos_restantes   ?? 0) > 0)          partes.push(`💚 HOT ${b.hot_formula} ×${b.hot_turnos_restantes}t`);
  if ((b.boost_dano   ?? 0) > 0 && (b.boost_dano_turnos_restantes ?? 0) > 0)
    partes.push(`⚡ +${b.boost_dano} dano ×${b.boost_dano_turnos_restantes}t`);
  if (b.rec_atributo  && b.rec_modo === 'turno' && (b.rec_turnos_restantes ?? 0) > 0)
    partes.push(`🔷 ${b.rec_atributo} ×${b.rec_turnos_restantes}t`);
  if (!partes.length && (b.turnos_restantes ?? 0) > 0) partes.push(`${b.turnos_restantes}t`);
  return partes.join(' · ') || 'ativo';
}

function renderArenaEfeitos() {
  const el = document.getElementById('ar-efeitos-list');
  if (!el) return;
  const efeitosMap = {};
  AR.chars.forEach(c => {
    (c.buffs||[]).forEach(b => {
      if (!efeitosMap[b.id]) efeitosMap[b.id] = { efeito: b, alvos: [] };
      efeitosMap[b.id].alvos.push(c.nome);
    });
  });
  const efeitos = Object.values<any>(efeitosMap);
  if (!efeitos.length) { el.innerHTML = '<div class="ar-empty">Nenhum efeito ativo</div>'; return; }
  el.innerHTML = efeitos.map(({ efeito: b, alvos }) => {
    const resumo = atkResumoBuff(b);
    const ehBuff = b.tipo === 'buff' || b.tipo === 'cura_imediata'
      || b.hot_formula || b.boost_dano || b.rec_atributo;
    const cor = ehBuff
      ? (b.boost_dano ? '#f0cc6a' : b.rec_atributo ? '#b07ef0' : '#5ee09a')
      : (b.dot_formula ? '#f0cc6a' : '#e8604c');
    const icone = ehBuff ? '✨' : '💀';
    return `<div class="ar-efeito-card" style="border-color:${cor}22;border-left:2px solid ${cor}">
      <div class="ar-efeito-nome" style="color:${cor}">${icone} ${b.nome}</div>
      <div class="ar-efeito-desc" style="color:${cor}99">${resumo}</div>
      <div class="ar-efeito-meta">
        ${alvos.map(a => `<span class="ar-efeito-alvo">→ ${a}</span>`).join('')}
        <button class="ar-inline-btn-danger" onclick="removerEfeito('${b.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// RENDER: LOG
// ═══════════════════════════════════════════════════════════════
function renderArenaLog() {
  const el = document.getElementById('ar-log-list');
  const logs = (AR.estado.log||[]).slice().reverse();
  if (!logs.length) { el.innerHTML = '<div class="ar-empty">Sem eventos registrados</div>'; return; }
  el.innerHTML = logs.map(l => `<div class="ar-log-item"><span class="ar-log-turno">T${l.turno||0}</span><span class="ar-log-texto">${l.texto}</span></div>`).join('');
}

// ═══════════════════════════════════════════════════════════════
// RENDER: D100
// ═══════════════════════════════════════════════════════════════
function renderArenaD100Hist() {
  const el = document.getElementById('ar-d100-hist');
  if (!AR.d100Hist.length) { el.innerHTML = '<div style="padding:14px;text-align:center;color:#7a6060;font-style:italic;font-size:0.85rem">Nenhuma rolagem</div>'; return; }
  el.innerHTML = AR.d100Hist.map(h => {
    let cor = '#c8d8e8', tag = '';
    if (h.num >= 95) { cor='#5ee09a'; tag=' ✦ Prodígio!'; }
    else if (h.num <= 5) { cor='#e74c3c'; tag=' ✦ Catástrofe!'; }
    else if (h.num >= 80) { cor='#f0cc6a'; }
    else if (h.num <= 20) { cor='#e8604c'; }
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 14px;border-bottom:1px solid rgba(60,30,30,0.4);">
      <span style="font-family:'Cinzel',serif;font-size:0.6rem;color:#7a6060">d100</span>
      <span style="font-family:'Cinzel',serif;font-size:1.1rem;color:${cor};min-width:36px">${h.num}</span>
      ${h.ator?`<span style="font-size:0.75rem;color:#8a7070">${h.ator}</span>`:''}
      <span style="font-size:0.72rem;color:${cor};margin-left:auto">${tag}</span>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// RENDER: CONFIG
// ═══════════════════════════════════════════════════════════════
function renderArenaConfig() {
  // Código de convite (só mestre vê)
  const cfgCodigoWrap = document.getElementById('ar-cfg-codigo-wrap');
  if (cfgCodigoWrap) {
    if (AR.myRole === 'mestre') {
      cfgCodigoWrap.style.display = 'block';
      const codigo = AR.session?.codigo_acesso || '—';
      const el = document.getElementById('ar-cfg-codigo-val');
      if (el) el.textContent = codigo;
    } else {
      cfgCodigoWrap.style.display = 'none';
    }
  }
  // Histórico
  const el = document.getElementById('ar-historico-list');
  if (!AR.histList.length) { el.innerHTML = '<div class="ar-empty">Nenhuma batalha salva</div>'; return; }
  el.innerHTML = AR.histList.map(h => {
    let hd: any = {}; try { hd = JSON.parse(h.conteudo||'{}'); } catch(e) {}
    return `<div class="ar-hist-item" onclick="verHistorico(${h.id})">
      <div class="ar-hist-nome">${h.titulo}</div>
      <div class="ar-hist-meta">${hd.chars_count||0} personagens · ${hd.turno_final||0} turnos · ${(hd as any).data||''}</div>
    </div>`;
  }).join('');
}

function arCopiarCodigoCfg() {
  const codigo = document.getElementById('ar-cfg-codigo-val')?.textContent || '';
  navigator.clipboard?.writeText(codigo)
    .then(()=>arToast('Código copiado!','sucesso'))
    .catch(()=>arToast('Código: '+codigo,''));
}

// ═══════════════════════════════════════════════════════════════
// AÇÕES: HP
// ═══════════════════════════════════════════════════════════════
function abrirModalHP(nome) {
  AR.hpEditNome = nome;
  const c = AR.chars.find(x => x.nome === nome);
  if (!c) return;
  const hpMax = c.custom_attrs?.hp_max ?? 100;
  const hp = c.hp_atual ?? hpMax;
  document.getElementById('ar-hp-char-nome').textContent = nome;
  document.getElementById('ar-hp-val').textContent = hp + ' / ' + hpMax;
  document.getElementById('ar-hp-slider').max = hpMax;
  document.getElementById('ar-hp-slider').value = hp;
  arAtualizarBarraHP(hp, hpMax);
  abrirModal('ar-modal-hp');
}

function arHpSliderChange() {
  const sl = document.getElementById('ar-hp-slider');
  const v = parseInt(sl.value);
  const hpMax = parseInt(sl.max)||100;
  document.getElementById('ar-hp-val').textContent = v + ' / ' + hpMax;
  arAtualizarBarraHP(v, hpMax);
}

function arHpDelta(delta) {
  const sl = document.getElementById('ar-hp-slider');
  const hpMax = parseInt(sl.max)||100;
  const novo = Math.max(0, Math.min(hpMax, parseInt(sl.value) + delta));
  sl.value = novo;
  arHpSliderChange();
}

function arAtualizarBarraHP(hp, hpMax) {
  hpMax = hpMax || parseInt(document.getElementById('ar-hp-slider').max)||100;
  const pct = Math.round((hp/hpMax)*100);
  const fill = document.getElementById('ar-hp-bar-fill');
  const cls = pct >= 60 ? 'ar-hp-high' : pct >= 25 ? 'ar-hp-mid' : 'ar-hp-low';
  fill.className = `ar-hp-fill ${cls}`;
  fill.style.width = Math.min(pct,100) + '%';
}

async function confirmarHP() {
  const nome = AR.hpEditNome;
  const novo = parseInt(document.getElementById('ar-hp-slider').value);
  const c = AR.chars.find(x => x.nome === nome);
  if (!c) return;
  const old = c.hp_atual;
  c.hp_atual = novo;
  const hpMax = c.custom_attrs?.hp_max ?? 100;
  try {
    await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(nome)}`, {method:'PATCH', body:JSON.stringify({hp_atual:novo})});
    const diff = novo - old;
    const diffText = diff >= 0 ? `+${diff}` : `${diff}`;
    arAddLog(`💢 ${nome}: ${old}/${hpMax} → ${novo}/${hpMax} (${diffText})`);
    await arSalvarEstado();
    fecharModal('ar-modal-hp');
    renderArenaPersonagens();
    renderArenaEntidades();
    renderMesa();
    arToast('HP atualizado!','sucesso');
  } catch(e) { arToast('Erro ao salvar HP','erro'); }
}

// ═══════════════════════════════════════════════════════════════
// AÇÕES: PERSONAGENS / ENTIDADES
// ═══════════════════════════════════════════════════════════════
function abrirModalCriarChar(tipo) {
  AR.charTipoModal = tipo;
  document.getElementById('ar-char-edit-nome').value = '';
  document.getElementById('ar-char-nome').value = '';
  document.getElementById('ar-char-desc').value = '';
  document.getElementById('ar-char-img').value = '';
  document.getElementById('ar-char-img-thumb').style.display = 'none';
  const hpDefault = AR.session?.level_config?.hp_base || 100;
  document.getElementById('ar-char-hp').value = hpDefault;
  document.getElementById('ar-char-hp').max = hpDefault;
  document.getElementById('ar-char-hp-val').textContent = hpDefault + ' / ' + hpDefault;
  document.getElementById('ar-char-tipo').value = tipo;
  document.getElementById('ar-char-del-wrap').style.display = 'none';
  const tipoLabel = tipo === 'criatura' ? 'Nova Criatura' : tipo === 'objeto' ? 'Novo Objeto' : 'Novo Jogador';
  document.getElementById('ar-modal-char-titulo').textContent = tipoLabel;
  renderCoresSwatch(AR_CORES[Math.floor(Math.random()*AR_CORES.length)]);
  abrirModal('ar-modal-char');
}

function abrirModalEditarChar(nome) {
  const c = AR.chars.find(x => x.nome === nome);
  if (!c) return;
  const ca = c.custom_attrs || {};
  document.getElementById('ar-char-edit-nome').value = nome;
  document.getElementById('ar-char-nome').value = nome;
  document.getElementById('ar-char-desc').value = ca.descricao || '';
  const imgUrl = normalizeImgUrl(ca.img_url || ca.img || '');
  document.getElementById('ar-char-img').value = imgUrl;
  const thumb = document.getElementById('ar-char-img-thumb');
  if (imgUrl) { thumb.src = imgUrl; thumb.style.display = 'block'; } else { thumb.style.display = 'none'; }
  document.getElementById('ar-char-hp').value = c.hp_atual ?? (ca.hp_max ?? 100);
  document.getElementById('ar-char-hp').max = ca.hp_max || 100;
  document.getElementById('ar-char-hp-val').textContent = (c.hp_atual ?? (ca.hp_max ?? 100)) + ' / ' + (ca.hp_max || 100);
  document.getElementById('ar-char-tipo').value = ca.tipo || 'jogador';
  document.getElementById('ar-char-del-wrap').style.display = 'block';
  const tipo = ca.tipo || 'jogador';
  const tipoLabel = tipo === 'criatura' ? 'Editar Criatura' : tipo === 'objeto' ? 'Editar Objeto' : 'Editar Jogador';
  document.getElementById('ar-modal-char-titulo').textContent = tipoLabel;
  renderCoresSwatch(ca.cor || AR_CORES[0]);
  // Habilidades NPC
  const habilidadesWrap = document.getElementById('ar-habilidades-npc-wrap');
  if (habilidadesWrap) habilidadesWrap.style.display = tipo === 'criatura' ? 'block' : 'none';
  NPC_HABILIDADES_TEMP = JSON.parse(JSON.stringify(ca.habilidades || []));
  atkRenderHabilidadesNPC(NPC_HABILIDADES_TEMP);
  abrirModal('ar-modal-char');
}

function renderCoresSwatch(corSel) {
  document.getElementById('ar-char-cores').innerHTML = AR_CORES.map(c =>
    `<div class="ar-cor${c===corSel?' sel':''}" style="background:${c}" data-cor="${c}" onclick="selecionarCor(this,'${c}')"></div>`
  ).join('');
}

function selecionarCor(el, cor) {
  document.querySelectorAll('#ar-char-cores .ar-cor').forEach(d => d.classList.remove('sel'));
  el.classList.add('sel');
}

function getCorSelecionada() {
  const sel = document.querySelector('#ar-char-cores .ar-cor.sel');
  return sel ? sel.dataset.cor : AR_CORES[0];
}

async function salvarChar() {
  const nomeOld = document.getElementById('ar-char-edit-nome').value;
  const nome = document.getElementById('ar-char-nome').value.trim();
  const desc = document.getElementById('ar-char-desc').value.trim();
  const hp = parseInt(document.getElementById('ar-char-hp').value);
  const hpMax = parseInt(document.getElementById('ar-char-hp').max) || hp || 100;
  const tipo = document.getElementById('ar-char-tipo').value;
  const cor = getCorSelecionada();
  const img = document.getElementById('ar-char-img').value.trim();
  if (!nome) { arToast('Informe o nome','erro'); return; }

  const isEdit = !!nomeOld;
  const existente = AR.chars.find(c => c.nome === nome && nome !== nomeOld);
  if (existente) { arToast('Já existe personagem com este nome','erro'); return; }

  // Regra: jogador só pode ter 1 personagem comum (não-mestre)
  if (!isEdit && tipo === 'jogador' && AR.myRole !== 'mestre') {
    const jaTemChar = AR.chars.some(c =>
      (c.custom_attrs?.owner_nickname||'') === AR.myNickname &&
      (c.custom_attrs?.tipo||'jogador') === 'jogador'
    );
    if (jaTemChar) { arToast('Você já tem um personagem nesta arena','erro'); return; }
  }

  const customAttrs: any = {};
  if (isEdit) {
    const oldChar = AR.chars.find(c => c.nome === nomeOld);
    if (oldChar) Object.assign(customAttrs, oldChar.custom_attrs || {});
  }
  (customAttrs as any).descricao = desc;
  (customAttrs as any).tipo = tipo;
  (customAttrs as any).cor = cor;
  (customAttrs as any).img_url = normalizeImgUrl(img);
  (customAttrs as any).hp_max = hpMax;
  if (!customAttrs.buffs) (customAttrs as any).buffs = [];
  // Salvar owner para controle de edição
  if (!isEdit && tipo === 'jogador') {
    (customAttrs as any).owner_nickname = AR.myNickname || (SESSION?.profile?.nickname || '');
  }
  // Habilidades de NPC
  if (tipo === 'criatura') {
    (customAttrs as any).habilidades = NPC_HABILIDADES_TEMP;
  } else {
    delete (customAttrs as any).habilidades;
  }
  NPC_HABILIDADES_TEMP = [];
  // Init position at random spot if new char
  if (!isEdit || !(customAttrs as any).pos) {
    customAttrs.pos = { x: 20 + Math.random() * 60, y: 20 + Math.random() * 60 };
  }

  try {
    if (isEdit) {
      await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(nomeOld)}`, {
        method:'PATCH', body:JSON.stringify({nome, hp_atual:hp, custom_attrs:customAttrs, hp_max:hpMax})
      });
      const idx = AR.chars.findIndex(c => c.nome === nomeOld);
      if (idx >= 0) { AR.chars[idx].nome = nome; AR.chars[idx].hp_atual = hp; AR.chars[idx].hp_max = hpMax; AR.chars[idx].custom_attrs = customAttrs; }
      arToast('Personagem atualizado!','sucesso');
    } else {
      const novo = await arSb('characters', {method:'POST', body:JSON.stringify({
        rpg_id:AR.session.rpg_id, nome,
        hp_atual:hp,
        hp_max:hpMax,
        nivel:1, xp:0, pontos_attr:0,
        custom_attrs:customAttrs
      })});
      const charObj = Array.isArray(novo) ? novo[0] : novo;
      charObj.custom_attrs = customAttrs;
      AR.chars.push(charObj);
      arAddLog(`✨ ${nome} entrou na arena! (${tipo})`);
      await arSalvarEstado();
      arToast(`${nome} adicionado!`,'sucesso');
    }
    fecharModal('ar-modal-char');
    renderArenaPersonagens();
    renderArenaEntidades();
    renderMesa();
  } catch(e) { arToast('Erro ao salvar','erro'); console.error(e); }
}

async function deletarChar() {
  const nome = document.getElementById('ar-char-edit-nome').value;
  if (!nome) return;
  if (!confirm(`Remover "${nome}" da batalha?`)) return;
  try {
    await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(nome)}`, {method:'DELETE'});
    AR.chars = AR.chars.filter(c => c.nome !== nome);
    arAddLog(`🚪 ${nome} removido da batalha`);
    await arSalvarEstado();
    fecharModal('ar-modal-char');
    renderArenaPersonagens();
    renderArenaEntidades();
    arToast('Removido!','sucesso');
  } catch(e) { arToast('Erro ao remover','erro'); }
}

// ═══════════════════════════════════════════════════════════════
// AÇÕES: EFEITOS / BUFFS / DEBUFFS
// ═══════════════════════════════════════════════════════════════
function arEfToggle(key) {
  const map = { heal:'ar-ef-heal-fields', hot:'ar-ef-hot-fields', boost:'ar-ef-boost-fields',
    rec:'ar-ef-rec-fields', dot:'ar-ef-dot-fields', deb:'ar-ef-deb-fields',
    mov:'ar-ef-mov-fields', atk:'ar-ef-atk-fields', def:'ar-ef-def-fields' };
  const el = document.getElementById(map[key]);
  const chk = document.getElementById(`ar-ef-${key}-on`);
  if (el && chk) el.style.display = chk.checked ? 'block' : 'none';
}

function arEfSelectGroup(grupo) {
  const items = [...document.querySelectorAll('#ar-ef-targets .ar-check-item')];
  items.forEach(el => {
    const tipo = el.dataset.tipo || 'jogador';
    const ehNpc = tipo === 'npc' || tipo === 'criatura' || tipo === 'objeto';
    let sel = false;
    if (grupo === 'todos') sel = true;
    else if (grupo === 'jogadores') sel = !ehNpc;
    else if (grupo === 'npcs') sel = ehNpc;
    else sel = false;
    el.classList.toggle('sel', sel);
    const chk = el.querySelector('.ar-chk');
    if (chk) chk.textContent = sel ? '✓' : '';
  });
}

function arEfTipoChange() {
  const tipo = document.getElementById('ar-ef-tipo').value;
  const pos = document.getElementById('ar-ef-sec-positivos');
  const neg = document.getElementById('ar-ef-sec-negativos');
  if (pos) pos.style.opacity = tipo === 'debuff' ? '0.4' : '1';
  if (neg) neg.style.opacity = tipo === 'buff'   ? '0.4' : '1';
}

function abrirModalCriarEfeito() {
  document.getElementById('ar-ef-nome').value   = '';
  document.getElementById('ar-ef-tipo').value   = 'buff';
  document.getElementById('ar-ef-turnos').value = '3';
  // Desmarcar todos os checkboxes e esconder campos
  ['heal','hot','boost','rec','dot','deb','mov','atk','def'].forEach(k => {
    const chk = document.getElementById(`ar-ef-${k}-on`);
    if (chk) chk.checked = false;
    arEfToggle(k);
  });
  arEfTipoChange();
  // Targets
  const targets = document.getElementById('ar-ef-targets');
  targets.innerHTML = AR.chars.map(c => {
    const tipo = c.custom_attrs?.tipo || 'jogador';
    const cor = tipo === 'jogador' ? '#7ec8f0' : '#e8604c';
    return `<div class="ar-check-item" data-nome="${c.nome}" data-tipo="${tipo}" onclick="this.classList.toggle('sel');this.querySelector('.ar-chk').textContent=this.classList.contains('sel')?'✓':''">
      <div class="ar-chk"></div>
      <span style="width:10px;height:10px;border-radius:50%;background:${c.custom_attrs?.cor||cor};display:inline-block;margin-right:4px;flex-shrink:0"></span>
      <span style="font-size:0.9rem">${c.nome}</span>
      <span style="font-size:0.72rem;color:#7a6060;margin-left:auto">${tipo}</span>
    </div>`;
  }).join('');
  abrirModal('ar-modal-efeito');
}

async function salvarEfeito() {
  const nome = document.getElementById('ar-ef-nome').value.trim();
  if (!nome) { arToast('Informe o nome do efeito','erro'); return; }
  const tipo   = document.getElementById('ar-ef-tipo').value;
  const turnos = parseInt(document.getElementById('ar-ef-turnos').value)||3;
  const selecionados = [...document.querySelectorAll('#ar-ef-targets .ar-check-item.sel')].map(el=>el.dataset.nome);
  if (!selecionados.length) { arToast('Selecione ao menos um alvo','erro'); return; }

  const efBase: any = {
    id:   'ef_' + Date.now(),
    nome, tipo,
    turno_inicio: AR.estado.turno,
    turnos_restantes: turnos,
  };
  // Positivos
  if (document.getElementById('ar-ef-heal-on').checked) {
    (efBase as any).heal_formula = document.getElementById('ar-ef-heal-formula').value.trim() || '20';
  }
  if (document.getElementById('ar-ef-hot-on').checked) {
    (efBase as any).hot_formula = document.getElementById('ar-ef-hot-formula').value.trim() || '1d6';
    (efBase as any).hot_turnos  = parseInt(document.getElementById('ar-ef-hot-turnos').value)||3;
    efBase.hot_turnos_restantes = (efBase as any).hot_turnos;
  }
  if (document.getElementById('ar-ef-boost-on').checked) {
    (efBase as any).boost_dano        = parseInt(document.getElementById('ar-ef-boost-mod').value)||5;
    (efBase as any).boost_dano_turnos = parseInt(document.getElementById('ar-ef-boost-turnos').value)||2;
    efBase.boost_dano_turnos_restantes = (efBase as any).boost_dano_turnos;
  }
  if (document.getElementById('ar-ef-rec-on').checked) {
    (efBase as any).rec_atributo    = document.getElementById('ar-ef-rec-atributo').value.trim();
    (efBase as any).rec_formula     = document.getElementById('ar-ef-rec-formula').value.trim() || '10';
    (efBase as any).rec_modo        = document.getElementById('ar-ef-rec-modo').value;
    (efBase as any).rec_turnos      = parseInt(document.getElementById('ar-ef-rec-turnos').value)||3;
    efBase.rec_turnos_restantes = efBase.rec_modo === 'turno' ? (efBase as any).rec_turnos : 0;
  }
  // Negativos
  if (document.getElementById('ar-ef-dot-on').checked) {
    (efBase as any).dot_formula = document.getElementById('ar-ef-dot-formula').value.trim() || '1d6';
    (efBase as any).dot_turnos  = parseInt(document.getElementById('ar-ef-dot-turnos').value)||3;
    efBase.dot_turnos_restantes = (efBase as any).dot_turnos;
  }
  if (document.getElementById('ar-ef-deb-on').checked) {
    (efBase as any).mod_dano        = parseInt(document.getElementById('ar-ef-deb-mod').value)||-4;
    (efBase as any).mod_dano_turnos = parseInt(document.getElementById('ar-ef-deb-turnos').value)||2;
    efBase.mod_dano_turnos_restantes = (efBase as any).mod_dano_turnos;
  }
  if (document.getElementById('ar-ef-mov-on').checked) {
    (efBase as any).sem_movimento = true;
    (efBase as any).sem_movimento_turnos = parseInt(document.getElementById('ar-ef-mov-turnos').value)||1;
    efBase.sem_movimento_turnos_restantes = (efBase as any).sem_movimento_turnos;
  }
  if (document.getElementById('ar-ef-atk-on').checked) {
    (efBase as any).sem_ataque      = true;
    (efBase as any).sem_ataque_tipo = document.getElementById('ar-ef-atk-tipo').value || 'todos';
    (efBase as any).sem_ataque_turnos = parseInt(document.getElementById('ar-ef-atk-turnos').value)||1;
    efBase.sem_ataque_turnos_restantes = (efBase as any).sem_ataque_turnos;
  }
  if (document.getElementById('ar-ef-def-on')?.checked) {
    (efBase as any).mod_defesa        = parseInt(document.getElementById('ar-ef-def-mod').value) || 3;
    (efBase as any).mod_defesa_turnos = parseInt(document.getElementById('ar-ef-def-turnos').value) || 2;
    efBase.mod_defesa_turnos_restantes = (efBase as any).mod_defesa_turnos;
  }

  // Aplicar cura imediata + buff a cada personagem
  for (const charNome of selecionados) {
    const c = AR.chars.find(x => x.nome === charNome);
    if (!c) continue;
    // Cura imediata
    if ((efBase as any).heal_formula) {
      const grupos = parsearFormulaDano((efBase as any).heal_formula);
      const r = grupos ? rolarGrupos(grupos) : { total: parseInt((efBase as any).heal_formula)||0 };
      c.hp_atual = Math.min(c.custom_attrs?.hp_max ?? 100, (c.hp_atual ?? (c.custom_attrs?.hp_max ?? 100)) + r.total);
      try {
        await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(charNome)}`,
          { method:'PATCH', body:JSON.stringify({hp_atual:c.hp_atual}) });
      } catch(e) {}
    }
    // Recuperação imediata de atributo
    if (efBase.rec_atributo && (efBase as any).rec_modo === 'imediato') {
      const grupos = parsearFormulaDano((efBase as any).rec_formula || '0');
      const r = grupos ? rolarGrupos(grupos) : { total: parseInt((efBase as any).rec_formula)||0 };
      if (!c.custom_attrs.atributos) c.custom_attrs.atributos = {};
      c.custom_attrs.atributos[(efBase as any).rec_atributo] = (parseFloat(c.custom_attrs.atributos[efBase.rec_atributo])||0) + r.total;
    }
    // Buff persistente (HOT, boost, DOT, debuff, etc.)
    const efId = efBase.id + '_' + charNome.slice(0,4);
    c.buffs = [...(c.buffs||[]), { ...efBase, id: efId }];
    try {
      await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(charNome)}`,
        { method:'PATCH', body:JSON.stringify({ buffs: c.buffs, custom_attrs: c.custom_attrs }) });
    } catch(e) {}
  }

  const tipoLabel = tipo === 'buff' ? '✨ Buff' : tipo === 'debuff' ? '💀 Debuff' : '🌀 Efeito';
  arAddLog(`${tipoLabel} "${nome}" aplicado em: ${selecionados.join(', ')} (${turnos} turnos)`);
  await arSalvarEstado();
  fecharModal('ar-modal-efeito');
  renderArenaEfeitos();
  renderArenaPersonagens();
  renderArenaEntidades();
  arToast('Efeito aplicado!','sucesso');
}

async function removerEfeito(efId) {
  if (!confirm('Remover este efeito de todos os personagens?')) return;
  for (const c of AR.chars) {
    const antes = (c.buffs||[]).length;
    c.buffs = (c.buffs||[]).filter(b => b.id !== efId);
    if (c.buffs.length < antes) {
      try {
        await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(c.nome)}`, {
          method:'PATCH', body:JSON.stringify({ buffs: c.buffs })
        });
      } catch(e) {}
    }
  }
  arAddLog(`🗑 Efeito removido`);
  await arSalvarEstado();
  renderArenaEfeitos();
  renderArenaPersonagens();
  renderArenaEntidades();
  arToast('Efeito removido!','sucesso');
}

// ═══════════════════════════════════════════════════════════════
// AÇÕES: TURNO
// ═══════════════════════════════════════════════════════════════
async function avancarTurno() {
  AR.estado.turno = (AR.estado.turno||0) + 1;
  const t = AR.estado.turno;
  const logsMensagens = [];

  // Processar efeitos de cada personagem
  for (const c of AR.chars) {
    const buffs = c.buffs || [];
    if (!buffs.length) continue;
    let mudou = false;
    let hpMudou = false;
    const buffsParaManter = [];

    for (const b of buffs) {
      // ── DOT ──────────────────────────────────────────────────
      if (b.dot_formula && b.dot_turnos_restantes > 0) {
        const grupos = parsearFormulaDano(b.dot_formula);
        const rolagem = grupos ? rolarGrupos(grupos) : { total: parseInt(b.dot_formula) || 0 };
        const dano = rolagem.total;
        c.hp_atual = Math.max(0, (c.hp_atual ?? 100) - dano);
        hpMudou = true;
        logsMensagens.push(`🩸 DOT "${b.nome}" causou ${dano} de dano em ${c.nome} (HP: ${c.hp_atual}/${c.custom_attrs?.hp_max??100})`);
        b.dot_turnos_restantes--;
        mudou = true;
      }

      // ── HOT (Heal over Time) ─────────────────────────────────
      if (b.hot_formula && b.hot_turnos_restantes > 0) {
        const grupos = parsearFormulaDano(b.hot_formula);
        const rolagem = grupos ? rolarGrupos(grupos) : { total: parseInt(b.hot_formula) || 0 };
        const cura = rolagem.total;
        const hpMax = c.custom_attrs?.hp_max ?? 100;
        c.hp_atual = Math.min(hpMax, (c.hp_atual ?? hpMax) + cura);
        hpMudou = true;
        logsMensagens.push(`💚 HOT "${b.nome}" curou ${cura} HP de ${c.nome} (HP: ${c.hp_atual}/${hpMax}) — ${b.hot_turnos_restantes}t restante(s)`);
        b.hot_turnos_restantes--;
        mudou = true;
      }

      // ── Recuperação de atributo por turno ────────────────────
      if (b.rec_atributo && b.rec_modo === 'turno' && b.rec_turnos_restantes > 0) {
        const grupos = parsearFormulaDano(b.rec_formula || '0');
        const rolagem = grupos ? rolarGrupos(grupos) : { total: parseInt(b.rec_formula)||0 };
        if (!c.custom_attrs.atributos) c.custom_attrs.atributos = {};
        const atual = parseFloat(c.custom_attrs.atributos[b.rec_atributo]) || 0;
        c.custom_attrs.atributos[b.rec_atributo] = atual + rolagem.total;
        logsMensagens.push(`🔷 "${b.nome}" recuperou ${rolagem.total} de ${b.rec_atributo} de ${c.nome}`);
        b.rec_turnos_restantes--;
        mudou = true;
      }

      // ── Decrementa outros contadores ─────────────────────────
      ['sem_movimento_turnos_restantes','sem_ataque_turnos_restantes','mod_dano_turnos_restantes',
       'boost_dano_turnos_restantes','mod_defesa_turnos_restantes','turnos_restantes'].forEach(campo => {
        if ((b[campo] ?? 0) > 0) { b[campo]--; mudou = true; }
      });

      // Verificar se o buff ainda tem algum efeito ativo
      const aindaVivo = (b.dot_turnos_restantes ?? 0) > 0
        || (b.hot_turnos_restantes ?? 0) > 0
        || (b.sem_movimento && (b.sem_movimento_turnos_restantes ?? 0) > 0)
        || (b.sem_ataque    && (b.sem_ataque_turnos_restantes    ?? 0) > 0)
        || ((b.mod_dano ?? 0) !== 0 && (b.mod_dano_turnos_restantes ?? 0) > 0)
        || ((b.boost_dano   ?? 0) !== 0 && (b.boost_dano_turnos_restantes ?? 0) > 0)
        || ((b.mod_defesa   ?? 0) !== 0 && (b.mod_defesa_turnos_restantes ?? 0) > 0)
        || (b.rec_atributo && b.rec_modo === 'turno' && (b.rec_turnos_restantes ?? 0) > 0)
        || (b.turnos_restantes ?? 0) > 0;

      if (!aindaVivo) {
        // ── Reverter modificador_attr temporário ao expirar ──────────
        if (b.modificador_attr && (b.modificador_delta ?? 0) !== 0) {
          if (!c.custom_attrs) c.custom_attrs = {};
          if (!c.custom_attrs.atributos) c.custom_attrs.atributos = {};
          c.custom_attrs.atributos[b.modificador_attr] =
            (parseFloat(c.custom_attrs.atributos[b.modificador_attr]) || 0) - b.modificador_delta;
          mudou = true;
        }
        logsMensagens.push(_logExpiracaoEfeito(b, c.nome));
      } else {
        buffsParaManter.push(b);
      }
    }

    if (mudou) {
      c.buffs = buffsParaManter;
      const body: any = { buffs: c.buffs };
      if (hpMudou) (body as any).hp_atual = c.hp_atual;
      // Sempre incluir custom_attrs para capturar mudanças de rec_atributo (não depende de hpMudou)
      body.custom_attrs = c.custom_attrs;
      try {
        await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(c.nome)}`,
          { method:'PATCH', body:JSON.stringify(body) });
      } catch(e) {}
    }
  }

  arAddLog(`⏱ Turno ${t} iniciado`);
  logsMensagens.forEach(msg => arAddLog(msg));

  // ── Expirar invocações temporárias ──────────────────────────
  const invExpirados = AR.chars.filter(c =>
    c.custom_attrs?.invocado &&
    c.custom_attrs?.turno_expira != null &&
    t >= c.custom_attrs.turno_expira
  );
  for (const inv of invExpirados) {
    try {
      await arSb(
        `characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(inv.nome)}`,
        { method: 'DELETE' }
      );
    } catch(e) {}
    AR.chars = AR.chars.filter(x => x.nome !== inv.nome);
    logsMensagens.push(`💨 ${inv.nome} (invocação) foi disperso no turno ${t}`);
    arAddLog(`💨 ${inv.nome} foi disperso`);
  }

  // Decrementa cooldowns de habilidades
  if ((AR.estado as any).cooldowns) {
    for (const id of Object.keys((AR.estado as any).cooldowns)) {
      (AR.estado as any).cooldowns[id]--;
      if (AR.estado.cooldowns[id] <= 0) delete (AR.estado as any).cooldowns[id];
    }
  }

  await arSalvarEstado();
  renderArenaCenario();
  renderArenaEfeitos();
  renderArenaPersonagens();
  renderArenaEntidades();
  renderMesa();
  const qtdExp = logsMensagens.filter(m => m.includes('expirou')).length;
  const qtdDot = logsMensagens.filter(m => m.includes('DOT')).length;
  const qtdHot = logsMensagens.filter(m => m.includes('HOT')).length;
  const parts = [];
  if (qtdDot) parts.push(qtdDot + ' DOT(s)');
  if (qtdHot) parts.push(qtdHot + ' HOT(s)');
  if (qtdExp) parts.push(qtdExp + ' efeito(s) expiraram');
  arToast(parts.length ? `Turno ${t}: ${parts.join(', ')}` : `Turno ${t}!`, parts.length ? '' : 'sucesso');
}

// ═══════════════════════════════════════════════════════════════
// AÇÕES: LOG MANUAL
// ═══════════════════════════════════════════════════════════════
function abrirModalLog() {
  document.getElementById('ar-log-input').value = '';
  abrirModal('ar-modal-log');
}

async function adicionarLogManual() {
  const texto = document.getElementById('ar-log-input').value.trim();
  if (!texto) return;
  arAddLog(`📝 ${texto}`);
  await arSalvarEstado();
  fecharModal('ar-modal-log');
  renderArenaLog();
  arToast('Evento registrado!','sucesso');
}

// ═══════════════════════════════════════════════════════════════
// AÇÕES: DADOS CUSTOMIZÁVEIS (ARENA)
// ═══════════════════════════════════════════════════════════════
let AR_DADO_SEL = 20;

function getArenaDiceConfig(){ try{ const id=AR.session&&AR.session.rpg_id; if(!id) return TIPOS_DADO; const s=localStorage.getItem('rpghub_dice_arena_'+id); return s?JSON.parse(s):TIPOS_DADO; }catch(e){ return TIPOS_DADO; } }
function setArenaDiceConfig(arr){ try{ const id=AR.session&&AR.session.rpg_id; if(id) localStorage.setItem('rpghub_dice_arena_'+id,JSON.stringify(arr)); }catch(e){} }

function renderArenaDados(){
  const ativos = getArenaDiceConfig();
  if(!ativos.includes(AR_DADO_SEL)) AR_DADO_SEL = ativos[ativos.length-1];

  const grid = document.getElementById('ar-dado-grid');
  if(grid){
    grid.innerHTML = ativos.map(d=>{
      const sel = d===AR_DADO_SEL;
      return `<button onclick="arSelecionarDado(${d})" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px;border-radius:8px;border:1px solid ${sel?'#e8604c':'rgba(60,30,30,0.5)'};background:${sel?'rgba(232,80,60,0.12)':'transparent'};cursor:pointer;color:${sel?'#e8604c':'#7a6060'}">
        <svg viewBox="0 0 40 40" fill="none" style="width:28px;height:28px">${svgDadoArena(d)}</svg>
        <span style="font-family:'Cinzel',serif;font-size:0.62rem">d${d}</span>
      </button>`;
    }).join('');
  }
}
function renderArenaDiceConfig(){
  const ativos = getArenaDiceConfig();
  const grid = document.getElementById('ar-cfg-dice-grid');
  if(!grid) return;
  grid.innerHTML = TIPOS_DADO.map(d=>{
    const on = ativos.includes(d);
    return `<button onclick="toggleDadoArena(${d})" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px;border-radius:8px;border:1px solid ${on?'#e8604c':'rgba(60,30,30,0.5)'};background:${on?'rgba(232,80,60,0.1)':'transparent'};cursor:pointer;color:${on?'#e8604c':'#7a6060'}">
      <svg viewBox="0 0 40 40" fill="none" style="width:28px;height:28px">${svgDadoArena(d)}</svg>
      <span style="font-family:'Cinzel',serif;font-size:0.62rem">d${d}</span>
    </button>`;
  }).join('');
}
function toggleDadoArena(d){
  let ativos = getArenaDiceConfig();
  if(ativos.includes(d)){
    if(ativos.length<=1){ arToast('Mínimo 1 dado ativo','erro'); return; }
    ativos = ativos.filter(x=>x!==d);
  } else {
    ativos = [...ativos,d].sort((a,b)=>a-b);
  }
  setArenaDiceConfig(ativos);
  renderArenaDiceConfig();
  renderArenaDados();
}
function arSelecionarDado(d){ AR_DADO_SEL=d; renderArenaDados(); }
function arRolarDadoSel(){
  const r = Math.floor(Math.random()*AR_DADO_SEL)+1;
  const el = document.getElementById('ar-dado-resultado');
  if(el){ el.classList.remove('girar'); void el.offsetWidth; el.classList.add('girar'); (el as any).textContent=r; }
}
function svgDadoArena(d){
  const s=`stroke="#e8604c" stroke-width="1.5"`,t=`fill="#e8604c" font-size="10" font-family="Cinzel,serif"`;
  if(d===4)return`<polygon points="20,4 36,34 4,34" fill="none" ${s}/><text x="20" y="28" text-anchor="middle" ${t}>4</text>`;
  if(d===6)return`<rect x="6" y="6" width="28" height="28" rx="4" fill="none" ${s}/><text x="20" y="26" text-anchor="middle" ${t}>6</text>`;
  if(d===8)return`<polygon points="20,3 37,20 20,37 3,20" fill="none" ${s}/><text x="20" y="26" text-anchor="middle" ${t}>8</text>`;
  if(d===10)return`<polygon points="20,3 35,15 30,35 10,35 5,15" fill="none" ${s}/><text x="20" y="27" text-anchor="middle" ${t}>10</text>`;
  if(d===20)return`<polygon points="20,2 38,12 38,28 20,38 2,28 2,12" fill="none" ${s}/><text x="20" y="26" text-anchor="middle" ${t}>20</text>`;
  return`<circle cx="20" cy="20" r="17" fill="none" ${s}/><text x="20" y="25" text-anchor="middle" font-size="9" font-family="Cinzel,serif" fill="#e8604c">100</text>`;
}

// ═══════════════════════════════════════════════════════════════
// AÇÕES: D100
// ═══════════════════════════════════════════════════════════════
function arRolarD100() {
  const r = Math.floor(Math.random()*100)+1;
  const numEl = document.getElementById('ar-d100-num');
  numEl.classList.remove('girar'); void numEl.offsetWidth; numEl.classList.add('girar');
  (numEl as any).textContent = r;
  let sub = 'd100';
  if (r >= 95) { sub = '✦ PRODÍGIO ABSOLUTO!'; numEl.style.color='#5ee09a'; }
  else if (r >= 80) { sub = '✦ Sucesso poderoso'; numEl.style.color='#f0cc6a'; }
  else if (r >= 50) { sub = 'Sucesso'; numEl.style.color='#c8d8e8'; }
  else if (r >= 20) { sub = 'Sucesso parcial'; numEl.style.color='#e8604c'; }
  else if (r > 5)  { sub = 'Falha significativa'; numEl.style.color='#e74c3c'; }
  else { sub = '✦ CATÁSTROFE TOTAL!'; numEl.style.color='#e74c3c'; }
  document.getElementById('ar-d100-sub').textContent = sub;
  AR.d100Hist.unshift({num:r, ts:Date.now()});
  if (AR.d100Hist.length > 30) AR.d100Hist.pop();
  renderArenaD100Hist();
}

// ═══════════════════════════════════════════════════════════════
// AÇÕES: HISTÓRICO E RESET
// ═══════════════════════════════════════════════════════════════
async function salvarHistoricoArena() {
  const batalhaNum = AR.session.theme.batalha_num || 1;
  const snapshot = {
    batalha_num: batalhaNum,
    data: new Date().toLocaleDateString('pt-BR'),
    turno_final: AR.estado.turno,
    cenario_final: AR.estado.cenario,
    chars_count: AR.chars.length,
    chars_snapshot: AR.chars.map(c => ({
      nome: c.nome, hp: c.hp_atual, hpMax: c.custom_attrs?.hp_max||100, tipo: c.custom_attrs?.tipo||'jogador',
      descricao: c.custom_attrs?.descricao||'', cor: c.custom_attrs?.cor||'#e8604c'
    })),
    log: AR.estado.log || []
  };
  const titulo = `Batalha #${batalhaNum}`;
  try {
    await arSb('lore', {method:'POST', body:JSON.stringify({
      rpg_id:AR.session.rpg_id, secao:'historico', titulo, conteudo:JSON.stringify(snapshot)
    })});
    // Refresh history
    const lores = await arSb(`lore?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&select=*`);
    AR.histList = (lores||[]).filter(l => l.secao === 'historico');
    renderArenaConfig();
    arToast('Batalha salva no histórico!','sucesso');
  } catch(e) { arToast('Erro ao salvar histórico','erro'); }
}

async function resetarBatalha() {
  const nomeNovaBatalha = document.getElementById('ar-reset-nome').value.trim();
  const opcaoChars = document.getElementById('ar-reset-opcao-chars').value || 'manter';
  // Incrementar batalha_num no theme_json
  const t = AR.session.theme;
  const novaBatalhaNum = (t.batalha_num||1) + 1;
  t.batalha_num = novaBatalhaNum;
  try {
    await arSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}`, {
      method:'PATCH', body:JSON.stringify({theme_json:t})
    });

    if (opcaoChars === 'deletar') {
      // Deletar todos os personagens (jogadores + criaturas)
      await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}`, {method:'DELETE'});
      AR.chars = [];
    } else {
      // Deletar apenas criaturas, objetos e invocações temporárias; manter jogadores mas resetar HP e efeitos
      const criaturas = AR.chars.filter(c => ['criatura','objeto'].includes(c.custom_attrs?.tipo||'') || c.custom_attrs?.invocado);
      for (const cc of criaturas) {
        try { await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(cc.nome)}`, {method:'DELETE'}); } catch(e) {}
      }
      // Resetar HP e buffs dos jogadores
      const jogadores = AR.chars.filter(c => (c.custom_attrs?.tipo||'jogador') === 'jogador');
      for (const jog of jogadores) {
        const hpMax = jog.custom_attrs?.hp_max ?? 100;
        jog.hp_atual = hpMax;
        // Reverter modificador_attr temporários pendentes
        if (Array.isArray(jog.buffs)) {
          for (const b of jog.buffs) {
            if (b.modificador_attr && (b.modificador_delta ?? 0) !== 0) {
              if (!jog.custom_attrs.atributos) jog.custom_attrs.atributos = {};
              jog.custom_attrs.atributos[b.modificador_attr] =
                (parseFloat(jog.custom_attrs.atributos[b.modificador_attr]) || 0) - b.modificador_delta;
            }
          }
        }
        jog.buffs = [];
        jog.custom_attrs = {...jog.custom_attrs, pos: {x: 20+Math.random()*60, y: 20+Math.random()*60}};
        try {
          await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(jog.nome)}`, {
            method:'PATCH', body:JSON.stringify({hp_atual:hpMax, buffs:[], custom_attrs:jog.custom_attrs})
          });
        } catch(e) {}
      }
      AR.chars = jogadores;
    }

    // Resetar estado (cenário, turno, log, iniciativa)
    AR.estado = {cenario:'', turno:0, log:[]};
    AR.iniciativa = null;
    await arSalvarEstado();
    fecharModal('ar-modal-reset');
    document.getElementById('ar-batalha-badge').textContent = `Batalha #${novaBatalhaNum}`;
    renderArenaPersonagens();
    renderArenaEntidades();
    renderArenaEfeitos();
    renderArenaLog();
    renderArenaCenario();
    renderArenaIniciativaUI();
    renderArenaConfig();
    renderMesa();
    arToast(`Nova batalha #${novaBatalhaNum} iniciada!`,'sucesso');
  } catch(e) { arToast('Erro ao resetar','erro'); console.error(e); }
}

function arResetToggleOpcao(el, opcao) {
  document.querySelectorAll('#ar-modal-reset .ar-check-item').forEach(item => {
    item.classList.remove('sel');
    item.querySelector('.ar-chk').textContent = '';
  });
  el.classList.add('sel');
  el.querySelector('.ar-chk').textContent = '✓';
  document.getElementById('ar-reset-opcao-chars').value = opcao;
}

async function verHistorico(loreId) {
  const h = AR.histList.find(x => x.id === loreId);
  if (!h) return;
  let hd: any = {}; try { hd = JSON.parse(h.conteudo||'{}'); } catch(e) {}
  document.getElementById('ar-hist-view-titulo').textContent = h.titulo;
  const chars = ((hd as any).chars_snapshot||[]).map(c => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)"><div style="width:8px;height:8px;border-radius:50%;background:${c.cor||'#e8604c'}"></div><span style="font-family:'Cinzel',serif;font-size:0.85rem">${c.nome}</span><span style="margin-left:auto;color:${c.hp<=0?'#e74c3c':c.hp<(c.hpMax||100)*0.3?'#f39c12':'#5ee09a'};font-family:'Cinzel',serif;font-size:0.82rem">${c.hp}/${c.hpMax||100}</span></div>`).join('');
  const logs = ((hd as any).log||[]).slice(-20).map(l => `<div style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:0.85rem;color:#9a8888"><span style="font-family:'Cinzel',serif;font-size:0.6rem;color:rgba(232,80,60,0.4);margin-right:8px">T${l.turno||0}</span>${l.texto}</div>`).join('');
  document.getElementById('ar-hist-view-conteudo').innerHTML = `
    <div style="margin-bottom:12px"><span style="font-family:'Cinzel',serif;font-size:0.65rem;color:#7a6060">DATA:</span> ${hd.data||'—'} · <span style="font-family:'Cinzel',serif;font-size:0.65rem;color:#7a6060">TURNOS:</span> ${(hd as any).turno_final||0}</div>
    ${hd.cenario_final?`<div style="background:rgba(20,12,12,0.7);border-left:2px solid rgba(232,80,60,0.3);padding:8px 12px;border-radius:4px;margin-bottom:12px;font-size:0.9rem;color:#b8a0a0">${hd.cenario_final}</div>`:''}
    <div style="margin-bottom:8px;font-family:'Cinzel',serif;font-size:0.65rem;color:#7a6060">PERSONAGENS</div>${chars||'<div style="color:#7a6060">Sem registros</div>'}
    <div style="margin-top:12px;margin-bottom:8px;font-family:'Cinzel',serif;font-size:0.65rem;color:#7a6060">ÚLTIMOS EVENTOS</div>${logs||'<div style="color:#7a6060">Sem logs</div>'}`;
  abrirModal('ar-modal-hist-view');
}

async function confirmarDeletarArena() {
  if (!AR.session) return;
  if (!confirm(`Deletar a arena "${AR.session.name}" permanentemente?\nTodos os dados serão perdidos.`)) return;
  try {
    await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}`, {method:'DELETE'});
    await arSb(`lore?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}`, {method:'DELETE'});
    await arSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}`, {method:'DELETE'});
    arFecharRealtime();
    arToast('Arena deletada','sucesso');
    setTimeout(()=>{ AR.session=null; document.getElementById('arena-session').style.display='none'; document.getElementById('arena-hub').style.display='block'; carregarArenaList(); },800);
  } catch(e) { arToast('Erro ao deletar','erro'); }
}

// ═══════════════════════════════════════════════════════════════
// UTILS: ESTADO / LORE
// ═══════════════════════════════════════════════════════════════
function arAddLog(texto) {
  if (!AR.estado.log) AR.estado.log = [];
  AR.estado.log.push({turno:AR.estado.turno, texto, ts:Date.now()});
  if (AR.estado.log.length > 200) AR.estado.log.shift();
}

async function arSalvarEstado() {
  const id = AR.session.rpg_id;
  if (AR.iniciativa) (AR.estado as any).iniciativa_arena = AR.iniciativa;
  else delete (AR.estado as any).iniciativa_arena;
  // Limpar ataques finalizados (evita payload crescer e salvar falhar silenciosamente)
  if ((AR.estado as any).ataques_arena) {
    AR.estado.ataques_arena = (AR.estado as any).ataques_arena.filter(a =>
      a.status === 'aguardando_mestre' || a.status === 'aprovado_dc' || a.status === 'rolagem_enviada'
    );
  }
  try {
    await arSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(id)}`,
      {method:'PATCH', body:JSON.stringify({arena_estado:JSON.stringify(AR.estado)})});
  } catch(e) {
    console.error('Erro ao salvar estado arena:', e);
    arToast('\u26a0 Falha ao salvar \u2014 verifique a conexão', 'erro');
  }
}
// ═══════════════════════════════════════════════════════════════
// REALTIME
// ═══════════════════════════════════════════════════════════════
function arIniciarRealtime(rpgId) {
  arFecharRealtime();
  let _arReconectando=false, _arTentativas=0, _arTimer=null;

  function conectar(){
    let ws;
    try { ws = new WebSocket(`${SUPABASE_URL.replace('https','wss')}/realtime/v1/websocket?apikey=${SUPABASE_KEY}&vsn=1.0.0`); } catch(e) { return; }
    AR.ws = ws;

    ws.onopen = () => {
      _arTentativas=0; _arReconectando=false;
      const join = (t) => ws.send(JSON.stringify({topic:t, event:'phx_join', payload:{config:{broadcast:{self:false},presence:{key:''}}}, ref:'ar1'}));
      join(`realtime:public:characters:rpg_id=eq.${rpgId}`);
      join(`realtime:public:rpg_registry:rpg_id=eq.${rpgId}`);
      join(`realtime:public:batalhas:rpg_id=eq.${rpgId}`);
      join(`realtime:public:criativos:rpg_id=eq.${rpgId}`);
      const dot=document.getElementById('ar-rdot');
      if(dot){dot.style.display='inline-block';dot.title='Arena conectada';}
      chatIniciar(rpgId, ws);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        // Chat broadcast
        if (msg.event === 'broadcast' && msg.payload?.event === 'chat_msg') { chatReceberMensagem(msg.payload.payload); return; }
        if (msg.event === 'broadcast' && msg.payload?.event === 'chat_presence') { chatReceberPresenca(msg.payload.payload); return; }
        if (msg.event === 'broadcast' && msg.payload?.event === 'anim_ataque') { animReceberBroadcast(msg.payload.payload); return; }
        if (msg.event === 'broadcast' && msg.payload?.event === 'token_move') { tokenMoveReceber(msg.payload.payload); return; }
        if (msg.event === 'broadcast' && msg.payload?.event === 'combate_evento') { combateReceberBroadcast(msg.payload.payload); return; }
        if (!msg.payload || !msg.payload.record) return;
        const rec = msg.payload.record;
        const ev = msg.event;
        const topic = msg.topic||'';

        // ── CHARACTERS ──
        if (topic.includes('characters')) {
          if(typeof rec.custom_attrs==='string'){try{rec.custom_attrs=JSON.parse(rec.custom_attrs);}catch(e){rec.custom_attrs={};}}
          if(!rec.custom_attrs||typeof rec.custom_attrs!=='object')rec.custom_attrs={};
          if (!Array.isArray(rec.buffs)) rec.buffs = [];
          if(ev==='DELETE'){
            const oldRec=msg.payload.old_record||{};
            const nome=oldRec.nome||rec.nome;
            AR.chars=AR.chars.filter(c=>!(c.nome===nome&&c.rpg_id===rec.rpg_id));
            // também remove do RPG_DATA principal se disponível
            if(RPG_DATA&&RPG_DATA.characters)RPG_DATA.characters=RPG_DATA.characters.filter(c=>!(c.nome===nome&&c.rpg_id===rec.rpg_id));
          } else {
            const idx = AR.chars.findIndex(c => c.nome === rec.nome && c.rpg_id === rec.rpg_id);
            if (idx >= 0) AR.chars[idx] = rec;
            else if (ev === 'INSERT') AR.chars.push(rec);
            // Sync para RPG_DATA também
            if(RPG_DATA&&RPG_DATA.characters){
              const ri=RPG_DATA.characters.findIndex(c=>c.nome===rec.nome&&c.rpg_id===rec.rpg_id);
              if(ri>=0)RPG_DATA.characters[ri]=rec;
              else if(ev==='INSERT')RPG_DATA.characters.push(rec);
            }
          }
          renderArenaPersonagens(); renderArenaEntidades(); renderArenaEfeitos();
          renderMesa();
        }

        // ── RPG_REGISTRY ──
        if (topic.includes('rpg_registry')) {
          // arena_estado
          if (rec.arena_estado !== undefined) {
            try {
              const raw = rec.arena_estado;
              AR.estado = typeof raw==='object'?raw:JSON.parse(raw||'{}');
              if(!AR.estado.log)AR.estado.log=[];
              // Sync iniciativa
              if (AR.estado.iniciativa_arena) AR.iniciativa = (AR.estado as any).iniciativa_arena;
              else AR.iniciativa = null;
            } catch(e) {}
            renderArenaCenario(); renderArenaLog(); renderArenaIniciativaUI(); renderMesa(); renderPropostasCenario(); renderSolicitacoesEntidade();
          }
          // batalha_estado (jsonb — já chega como objeto)
          if (rec.batalha_estado !== undefined) {
            try {
              const bd = rec.batalha_estado || {};
              if(typeof batalhaReceberEstadoRemoto==='function') batalhaReceberEstadoRemoto(bd);
            } catch(e) {}
          }
          // criativos_pendentes removido — tabela criativos é a fonte de verdade
        }

        // ── BATALHAS ──
        if(topic.includes('batalhas')){
          batalhaReceberLinhaRemota(rec);
        }

        // ── CRIATIVOS ──
        if(topic.includes('criativos')){
          criativoReceberLinhaRemota(rec);
        }

      } catch(err) {}
    };

    ws.onerror = () => {};
    ws.onclose = () => {
      const dot=document.getElementById('ar-rdot');
      if(dot){dot.style.display='none';dot.title='Desconectado';}
      if(!_arReconectando){
        _arReconectando=true;
        const delay=Math.min(1000*Math.pow(2,_arTentativas),30000);
        _arTentativas++;
        _arTimer=setTimeout(()=>{if(AR.ws===ws||AR.ws===null){AR.ws=null;conectar();}},delay);
      }
    };
  }

  if(_arTimer){clearTimeout(_arTimer);_arTimer=null;}
  conectar();
}

function arFecharRealtime() {
  if (AR.ws) { try { AR.ws.close(); } catch(e) {} AR.ws = null; }
  const dot = document.getElementById('ar-rdot');
  if (dot) dot.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════
// UTILS: MODAIS / TOAST / SLIDER
// ═══════════════════════════════════════════════════════════════
function abrirModal(id) { document.getElementById(id).style.display='flex'; }
function fecharModal(id) { document.getElementById(id).style.display='none'; }
function abrirModalCenario() {
  if (AR.myRole !== 'mestre') { arToast('Apenas o Mestre pode alterar o cenário diretamente','erro'); return; }
  document.getElementById('ar-cenario-input').value=AR.estado.cenario||'';
  document.getElementById('ar-cenario-img').value=(AR.estado as any).cenario_img||'';
  if (document.getElementById('ar-cenario-json')) document.getElementById('ar-cenario-json').value='';
  const prev = document.getElementById('ar-cenario-img-preview');
  const prevEl = document.getElementById('ar-cenario-img-preview-el');
  if (AR.estado.cenario_img && prevEl) { prevEl.src=(AR.estado as any).cenario_img; if(prev)prev.style.display='block'; }
  else if(prev) prev.style.display='none';
  abrirModal('ar-modal-cenario');
}
function abrirModalResetBatalha() { document.getElementById('ar-reset-nome').value=''; abrirModal('ar-modal-reset'); }
function abrirModalProporCenario() {
  document.getElementById('ar-proposta-cenario-texto').value='';
  document.getElementById('ar-proposta-cenario-img').value='';
  document.getElementById('ar-proposta-cenario-json').value='';
  abrirModal('ar-modal-propor-cenario');
}
function abrirModalSolicitarEntidade() {
  document.getElementById('ar-sol-ent-nome').value='';
  document.getElementById('ar-sol-ent-desc').value='';
  document.getElementById('ar-sol-ent-hp').value='50';
  document.getElementById('ar-sol-ent-img').value='';
  abrirModal('ar-modal-solicitar-entidade');
}
function abrirModalVincular(nomeEntidade) {
  AR.vincularCriaturaNome = nomeEntidade;
  document.getElementById('ar-vincular-nome-criatura').textContent = nomeEntidade;
  // Listar jogadores
  const jogadores = AR.chars.filter(c => (c.custom_attrs?.tipo||'jogador') === 'jogador');
  const criatura = AR.chars.find(c => c.nome === nomeEntidade);
  const vinculoAtual = criatura?.custom_attrs?.vinculado_a || null;
  const list = document.getElementById('ar-vincular-jogadores-list');
  list.innerHTML = [
    `<div class="ar-check-item${!vinculoAtual?' sel':''}" onclick="arVincularSel(this,null)"><div class="ar-chk">${!vinculoAtual?'✓':''}</div><div><div style="font-family:'Cinzel',serif;font-size:0.78rem">Sem vínculo — turno próprio</div></div></div>`,
    ...jogadores.map(j => `<div class="ar-check-item${vinculoAtual===j.nome?' sel':''}" onclick="arVincularSel(this,'${j.nome}')"><div class="ar-chk">${vinculoAtual===j.nome?'✓':''}</div><div><div style="font-family:'Cinzel',serif;font-size:0.78rem">${j.nome}</div><div style="font-size:0.7rem;color:#7a6060">${j.custom_attrs?.owner_nickname||''}</div></div></div>`)
  ].join('');
  abrirModal('ar-modal-vincular');
}
function arVincularSel(el, jogNome) {
  document.querySelectorAll('#ar-vincular-jogadores-list .ar-check-item').forEach(i=>{ i.classList.remove('sel'); i.querySelector('.ar-chk').textContent=''; });
  el.classList.add('sel');
  el.querySelector('.ar-chk').textContent='✓';
  el._vinculo = jogNome;
}
async function arConfirmarVinculo() {
  const nome = AR.vincularCriaturaNome;
  if (!nome) return;
  const selecionado = document.querySelector('#ar-vincular-jogadores-list .ar-check-item.sel');
  const jogNome = selecionado?._vinculo !== undefined ? selecionado._vinculo : null;
  const posicao = document.getElementById('ar-vincular-posicao').value;
  const c = AR.chars.find(x => x.nome === nome);
  if (!c) return;
  c.custom_attrs.vinculado_a = jogNome;
  try {
    await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(nome)}`,
      {method:'PATCH', body:JSON.stringify({custom_attrs: c.custom_attrs})});
    // Se sem vínculo, inserir na ordem de iniciativa baseado na posição escolhida
    if (!jogNome && AR.iniciativa?.ativa) {
      arInserirCriaturaIniciativa(nome, posicao);
    }
    arAddLog(`🔗 ${nome} ${jogNome ? `vinculada a ${jogNome}` : 'desvinculada (turno próprio)'}`);
    await arSalvarEstado();
    fecharModal('ar-modal-vincular');
    renderArenaEntidades();
    renderArenaIniciativaUI();
    renderMesa();
    arToast(jogNome ? `Vinculada a ${jogNome}!` : 'Desvinculada!', 'sucesso');
  } catch(e) { arToast('Erro ao vincular','erro'); }
}

function arPreviewCenarioImg(url) {
  const prev = document.getElementById('ar-cenario-img-preview');
  const prevEl = document.getElementById('ar-cenario-img-preview-el');
  if (!prev || !prevEl) return;
  const norm = normalizeImgUrl(url||'');
  if (norm) { prevEl.src = norm; prev.style.display = 'block'; }
  else { prev.style.display = 'none'; }
}
function arImportarCenarioJSON() {
  const txt = ((document.getElementById('ar-cenario-json')||{}) as any).value||'';
  if (!txt.trim()) return;
  try {
    const obj = JSON.parse(txt);
    if (obj.cenario) document.getElementById('ar-cenario-input').value = obj.cenario;
    if (obj.cenario_img) { document.getElementById('ar-cenario-img').value = obj.cenario_img; arPreviewCenarioImg(obj.cenario_img); }
    arToast('JSON importado!','sucesso');
  } catch(e) { arToast('JSON inválido','erro'); }
}
function arImportarCenarioArquivo(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const obj = JSON.parse((ev.target as any).result);
      if (obj.cenario) document.getElementById('ar-cenario-input').value = obj.cenario;
      if (obj.cenario_img) { document.getElementById('ar-cenario-img').value = obj.cenario_img; arPreviewCenarioImg(obj.cenario_img); }
      arToast('Arquivo importado!','sucesso');
    } catch(err) { arToast('Arquivo JSON inválido','erro'); }
  };
  reader.readAsText(file);
}
function arImportarPropostaCenarioJSON() {
  const txt = ((document.getElementById('ar-proposta-cenario-json')||{}) as any).value||'';
  if (!txt.trim()) return;
  try {
    const obj = JSON.parse(txt);
    if (obj.cenario) document.getElementById('ar-proposta-cenario-texto').value = obj.cenario;
    if (obj.cenario_img) document.getElementById('ar-proposta-cenario-img').value = obj.cenario_img;
    arToast('JSON importado!','sucesso');
  } catch(e) { arToast('JSON inválido','erro'); }
}



function arToast(msg, tipo) {
  // Reutiliza o toast existente
  mostrarToast(msg, tipo);
}

// Chat na arena — usa o mesmo painel flutuante do sistema de chat de campanha
function arChatToggle() {
  chatToggle();
  // Sincroniza badge depois de toggle
  setTimeout(arSincronizarChatBadge, 50);
}

function arSincronizarChatBadge() {
  const badge = document.getElementById('ar-chat-badge');
  const hdrBadge = document.getElementById('chat-fab-badge');
  if (!badge) return;
  const n = CHAT?.naoLidos || 0;
  (badge as any).textContent = n > 9 ? '9+' : n;
  badge.style.display = n > 0 ? 'flex' : 'none';
  // Tint do botão quando chat aberto
  const btn = document.getElementById('ar-chat-btn');
  if (btn) btn.style.background = CHAT?.aberto ? 'rgba(79,163,209,0.15)' : 'none';
}



function arSliderUpdate(sliderId, valId, suffix) {
  const v = document.getElementById(sliderId).value;
  document.getElementById(valId).textContent = v + (suffix||'');
}

// Fechar modal ao clicar fora
document.addEventListener('click', (e) => {
  if ((e.target as any).classList.contains('ar-modal')) fecharModal((e.target as any).id);
});

// Preview imagem no modal de char
document.addEventListener('input', (e) => {
  if ((e.target as any).id === 'ar-char-img') {
    const thumb = document.getElementById('ar-char-img-thumb');
    const url = (e.target as any).value.trim();
    if (url) { thumb.src = url; thumb.style.display = 'block'; } else { thumb.style.display = 'none'; }
  }
});

// ═══════════════════════════════════════════════════════════════
// CRIAÇÃO DE PERSONAGEM PELO PRÓPRIO JOGADOR
// ═══════════════════════════════════════════════════════════════
function arCriarMeuPersonagem() {
  const jaTemChar = AR.myNickname && AR.chars.some(c => (c.custom_attrs?.owner_nickname||'') === AR.myNickname && (c.custom_attrs?.tipo||'jogador') === 'jogador');
  if (jaTemChar) { arToast('Você já tem um personagem nesta batalha','erro'); return; }
  abrirModalCriarChar('jogador');
}

function arAbrirAparencia(nome) {
  const c = AR.chars.find(x => x.nome === nome);
  if (!c) return;
  if (!window.RPG_DATA) window.RPG_DATA = {};
  if (!RPG_DATA.characters) RPG_DATA.characters = [];
  const existeIdx = RPG_DATA.characters.findIndex(x => x.nome === nome);
  const fakeChar = { ...c, custom_attrs: { ...(c.custom_attrs||{}) } };
  if (existeIdx >= 0) RPG_DATA.characters[existeIdx] = fakeChar;
  else RPG_DATA.characters.push(fakeChar);
  RPG_DATA.myRole = AR.myRole;
  window._arAparenciaHook = true;
  window._arAparenciaNome = nome;
  abrirModalAparencia(nome);
}
document.addEventListener('arAparenciaSalva', function(e) {
  if (!window._arAparenciaHook || !window._arAparenciaNome) return;
  const nome = window._arAparenciaNome;
  const charRpd = RPG_DATA?.characters?.find(x => x.nome === nome);
  const charAr = AR.chars.find(x => x.nome === nome);
  if (charRpd && charAr) {
    charAr.custom_attrs = { ...charAr.custom_attrs, aparencia: charRpd.custom_attrs?.aparencia };
    arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(nome)}`, {
      method:'PATCH', body:JSON.stringify({custom_attrs:charAr.custom_attrs})
    }).then(()=>{ renderMesa(); }).catch(()=>{});
  }
  window._arAparenciaHook = false; window._arAparenciaNome = null;
});

// ═══════════════════════════════════════════════════════════════
// PROPOSTAS DE CENÁRIO (jogadores propõem, mestre aprova)
// ═══════════════════════════════════════════════════════════════
async function arEnviarPropostaCenario() {
  const texto = document.getElementById('ar-proposta-cenario-texto').value.trim();
  const img = document.getElementById('ar-proposta-cenario-img').value.trim();
  if (!texto) { arToast('Descreva o cenário proposto','erro'); return; }
  if (!AR.estado.propostas_cenario) (AR.estado as any).propostas_cenario = [];
  (AR.estado as any).propostas_cenario.push({
    id: Date.now()+'', autor: AR.myNickname, texto, img, ts: Date.now(), status: 'pendente'
  });
  await arSalvarEstado();
  fecharModal('ar-modal-propor-cenario');
  renderPropostasCenario();
  arToast('Proposta enviada ao Mestre!','sucesso');
}

function renderPropostasCenario() {
  const wrap = document.getElementById('ar-cenario-propostas-wrap');
  const list = document.getElementById('ar-cenario-propostas-list');
  if (!wrap || !list) return;
  const propostas = (AR.estado as any).propostas_cenario || [];
  if (AR.myRole !== 'mestre') return;
  wrap.style.display = propostas.length ? 'block' : 'none';
  list.innerHTML = propostas.map(p => `
    <div class="ar-proposta-card pendente">
      <div class="ar-proposta-titulo">💡 Proposta de <strong>${p.autor||'jogador'}</strong></div>
      <div class="ar-proposta-desc">${p.texto}</div>
      ${p.img ? `<div style="font-size:0.72rem;color:#7a6060">🖼 Imagem: ${p.img.length>40?p.img.slice(0,40)+'…':p.img}</div>` : ''}
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="ar-inline-btn" style="color:#5ee09a;border-color:rgba(39,174,96,0.3)" onclick="arAprovarPropostaCenario('${p.id}')">✓ Aprovar</button>
        <button class="ar-inline-btn-danger" onclick="arRejeitarPropostaCenario('${p.id}')">✕ Rejeitar</button>
      </div>
    </div>`).join('') || '<div class="ar-empty">Nenhuma proposta pendente</div>';
}

async function arAprovarPropostaCenario(id) {
  const p = ((AR.estado as any).propostas_cenario||[]).find(x=>x.id===id);
  if (!p) return;
  AR.estado.cenario = p.texto;
  if (p.img) (AR.estado as any).cenario_img = p.img;
  AR.estado.propostas_cenario = ((AR.estado as any).propostas_cenario||[]).filter(x=>x.id!==id);
  arAddLog(`📍 Cenário aprovado (proposta de ${p.autor}): ${p.texto}`);
  await arSalvarEstado();
  renderArenaCenario();
  renderPropostasCenario();
  renderMesa();
  arToast('Cenário aprovado e aplicado!','sucesso');
}

async function arRejeitarPropostaCenario(id) {
  AR.estado.propostas_cenario = ((AR.estado as any).propostas_cenario||[]).filter(x=>x.id!==id);
  await arSalvarEstado();
  renderPropostasCenario();
  arToast('Proposta rejeitada','');
}

// ═══════════════════════════════════════════════════════════════
// SOLICITAÇÕES DE ENTIDADE (jogadores solicitam, mestre aprova)
// ═══════════════════════════════════════════════════════════════
async function arEnviarSolicitacaoEntidade() {
  const nome = document.getElementById('ar-sol-ent-nome').value.trim();
  const tipo = document.getElementById('ar-sol-ent-tipo').value;
  const desc = document.getElementById('ar-sol-ent-desc').value.trim();
  const hp = parseInt(document.getElementById('ar-sol-ent-hp').value)||50;
  const img = document.getElementById('ar-sol-ent-img').value.trim();
  if (!nome) { arToast('Informe o nome','erro'); return; }
  if (!AR.estado.solicitacoes_entidade) (AR.estado as any).solicitacoes_entidade = [];
  (AR.estado as any).solicitacoes_entidade.push({
    id: Date.now()+'', autor: AR.myNickname, nome, tipo, desc, hp, img, ts: Date.now()
  });
  await arSalvarEstado();
  fecharModal('ar-modal-solicitar-entidade');
  renderSolicitacoesEntidade();
  arToast('Solicitação enviada ao Mestre!','sucesso');
}

function renderSolicitacoesEntidade() {
  const wrap = document.getElementById('ar-entidades-solicitacoes-wrap');
  const list = document.getElementById('ar-entidades-solicitacoes-list');
  if (!wrap || !list) return;
  const sols = (AR.estado as any).solicitacoes_entidade || [];
  if (AR.myRole !== 'mestre') return;
  wrap.style.display = sols.length ? 'block' : 'none';
  list.innerHTML = sols.map(s => `
    <div class="ar-proposta-card pendente">
      <div class="ar-proposta-titulo">${s.tipo==='criatura'?'👹':'🗡'} <strong>${s.nome}</strong> — solicitado por ${s.autor}</div>
      <div class="ar-proposta-desc">${s.desc||'(sem descrição)'}</div>
      <div style="font-size:0.72rem;color:#7a6060">HP: ${s.hp}</div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="ar-inline-btn" style="color:#5ee09a;border-color:rgba(39,174,96,0.3)" onclick="arAprovarEntidade('${s.id}')">✓ Criar e Vincular</button>
        <button class="ar-inline-btn-danger" onclick="arRejeitarEntidade('${s.id}')">✕ Rejeitar</button>
      </div>
    </div>`).join('') || '<div class="ar-empty">Nenhuma solicitação</div>';
}

async function arAprovarEntidade(id) {
  const s = ((AR.estado as any).solicitacoes_entidade||[]).find(x=>x.id===id);
  if (!s) return;
  const cor = AR_CORES[Math.floor(Math.random()*AR_CORES.length)];
  const customAttrs = {
    tipo: s.tipo, descricao: s.desc, cor, hp_max: s.hp,
    img_url: normalizeImgUrl(s.img||''),
    vinculado_a: s.autor, // vínculo automático com quem solicitou
    owner_nickname: s.autor,
    pos: {x:20+Math.random()*60, y:20+Math.random()*60},
    buffs: []
  };
  try {
    const novo = await arSb('characters', {method:'POST', body:JSON.stringify({
      rpg_id:AR.session.rpg_id, nome:s.nome, hp_atual:s.hp, hp_max:s.hp,
      nivel:1, xp:0, pontos_attr:0, custom_attrs:customAttrs
    })});
    const charObj = Array.isArray(novo)?novo[0]:novo;
    charObj.custom_attrs = customAttrs;
    AR.chars.push(charObj);
    AR.estado.solicitacoes_entidade = ((AR.estado as any).solicitacoes_entidade||[]).filter(x=>x.id!==id);
    arAddLog(`✨ ${s.nome} (${s.tipo}) criado e vinculado a ${s.autor}`);
    await arSalvarEstado();
    renderArenaEntidades();
    renderSolicitacoesEntidade();
    renderMesa();
    arToast(`${s.nome} criado e vinculado a ${s.autor}!`,'sucesso');
  } catch(e) { arToast('Erro ao criar entidade','erro'); }
}

async function arRejeitarEntidade(id) {
  AR.estado.solicitacoes_entidade = ((AR.estado as any).solicitacoes_entidade||[]).filter(x=>x.id!==id);
  await arSalvarEstado();
  renderSolicitacoesEntidade();
  arToast('Solicitação rejeitada','');
}

// ═══════════════════════════════════════════════════════════════
// CRIAÇÃO EM LOTE DE CRIATURAS (Mestre)
// ═══════════════════════════════════════════════════════════════
function abrirModalBulkCriaturas() {
  AR.bulkCriaturas = [{}];
  renderBulkCriaturas();
  abrirModal('ar-modal-bulk-criaturas');
}

function renderBulkCriaturas() {
  const list = document.getElementById('ar-bulk-criaturas-lista');
  if (!list) return;
  list.innerHTML = AR.bulkCriaturas.map((c, i) => `
    <div class="ar-bulk-item">
      <div class="ar-bulk-item-header">
        <span>Criatura ${i+1}</span>
        ${AR.bulkCriaturas.length>1 ? `<button onclick="arBulkRemoveCriatura(${i})" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:0.9rem">✕</button>` : ''}
      </div>
      <div class="ar-form-row">
        <div class="ar-form-group" style="margin-bottom:8px"><label class="ar-label">Nome *</label><input class="ar-input" id="ar-bulk-nome-${i}" value="${c.nome||''}" placeholder="Ex: Goblin Guerreiro"></div>
        <div class="ar-form-group" style="margin-bottom:8px"><label class="ar-label">HP</label><input class="ar-input" id="ar-bulk-hp-${i}" type="number" value="${c.hp||100}" min="1"></div>
      </div>
      <div class="ar-form-group" style="margin-bottom:8px"><label class="ar-label">Descrição / Habilidades</label><textarea class="ar-textarea" id="ar-bulk-desc-${i}" style="min-height:50px" placeholder="Poderes e comportamento...">${c.desc||''}</textarea></div>
      <div class="ar-form-group" style="margin-bottom:0"><label class="ar-label">Imagem (URL, opcional)</label><input class="ar-input" id="ar-bulk-img-${i}" value="${c.img||''}" placeholder="https://..."></div>
    </div>`).join('');
}

function arBulkAddCriatura() {
  AR.bulkCriaturas.push({});
  renderBulkCriaturas();
}

function arBulkRemoveCriatura(i) {
  AR.bulkCriaturas.splice(i, 1);
  renderBulkCriaturas();
}

async function arBulkCriarCriaturas() {
  const criaturas = AR.bulkCriaturas.map((_, i) => ({
    nome: (document.getElementById(`ar-bulk-nome-${i}`)?.value||'').trim(),
    hp: parseInt(document.getElementById(`ar-bulk-hp-${i}`)?.value)||100,
    desc: (document.getElementById(`ar-bulk-desc-${i}`)?.value||'').trim(),
    img: (document.getElementById(`ar-bulk-img-${i}`)?.value||'').trim(),
  })).filter(c => c.nome);

  if (!criaturas.length) { arToast('Adicione ao menos uma criatura com nome','erro'); return; }

  let criadas = 0;
  for (const c of criaturas) {
    const cor = AR_CORES[Math.floor(Math.random()*AR_CORES.length)];
    const customAttrs = {
      tipo:'criatura', descricao:c.desc, cor, hp_max:c.hp,
      img_url:normalizeImgUrl(c.img), buffs:[],
      pos:{x:20+Math.random()*60, y:20+Math.random()*60},
      temporaria:true // marca para ser apagada ao zerar batalha
    };
    try {
      const novo = await arSb('characters', {method:'POST', body:JSON.stringify({
        rpg_id:AR.session.rpg_id, nome:c.nome, hp_atual:c.hp, hp_max:c.hp,
        nivel:1, xp:0, pontos_attr:0, custom_attrs:customAttrs
      })});
      const charObj = Array.isArray(novo)?novo[0]:novo;
      charObj.custom_attrs = customAttrs;
      AR.chars.push(charObj);
      arAddLog(`👹 ${c.nome} entrou na arena (criatura)`);
      criadas++;
    } catch(e) {}
  }
  await arSalvarEstado();
  fecharModal('ar-modal-bulk-criaturas');
  renderArenaEntidades();
  renderMesa();
  arToast(`${criadas} criatura(s) criadas!`,'sucesso');
}

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE INICIATIVA PARA ARENA
// ═══════════════════════════════════════════════════════════════
function renderArenaIniciativaUI() {
  const pre = document.getElementById('ar-ini-pre');
  const rolando = document.getElementById('ar-ini-rolando');
  const combate = document.getElementById('ar-ini-combate');
  if (!pre) return;

  const isMestre = AR.myRole === 'mestre';
  const ini = AR.iniciativa;

  const startMestre = document.getElementById('ar-ini-start-btns-mestre');
  const startPlayer = document.getElementById('ar-ini-start-btns-player');
  const nenhumaEl  = document.getElementById('ar-ini-nenhuma');

  if (!ini || !ini.ativa) {
    pre.style.display = 'block';
    if (startMestre) startMestre.style.display = isMestre ? 'block' : 'none';
    if (startPlayer) startPlayer.style.display = (!isMestre) ? 'block' : 'none';
    if (nenhumaEl) nenhumaEl.style.display = 'none'; // ocultado quando há botões
    if (rolando) rolando.style.display = 'none';
    if (combate) combate.style.display = 'none';
    // Ocultar botões mestre da batalha
    const btnsMestre = document.getElementById('ar-ini-combate-btns-mestre');
    if (btnsMestre) btnsMestre.style.display = 'none';
    return;
  }
  pre.style.display = 'none';

  if (ini.fase === 'iniciativa') {
    if (rolando) rolando.style.display = 'block';
    if (combate) combate.style.display = 'none';
    renderListaRolagem();
    const meuChar = arMeuChar();
    const jaRolei = meuChar && ini.iniciativas && ini.iniciativas[meuChar] != null;
    const btnRolar = document.getElementById('ar-ini-btn-rolar-meu');
    if (btnRolar) btnRolar.style.display = (!isMestre && meuChar && !jaRolei) ? 'block' : 'none';
    const btnCalc = document.getElementById('ar-ini-btn-calcular-mestre');
    if (btnCalc) btnCalc.style.display = isMestre ? 'block' : 'none';
    const btnsMestre = document.getElementById('ar-ini-combate-btns-mestre');
    if (btnsMestre) btnsMestre.style.display = 'none';
  } else {
    // Fase combate
    if (rolando) rolando.style.display = 'none';
    if (combate) combate.style.display = 'block';
    renderOrdemCombate();
    const roundEl = document.getElementById('ar-ini-round');
    if (roundEl) roundEl.textContent = ini.round || 1;
    const btnsMestre = document.getElementById('ar-ini-combate-btns-mestre');
    if (btnsMestre) btnsMestre.style.display = isMestre ? 'flex' : 'none';
  }
}

function renderListaRolagem() {
  const ini = AR.iniciativa;
  const lista = document.getElementById('ar-ini-lista-rolagem');
  if (!lista || !ini) return;
  lista.innerHTML = ini.participantes.map(p => {
    const rolou = ini.iniciativas && ini.iniciativas[p.nome] != null;
    const valor = rolou ? ini.iniciativas[p.nome] : '?';
    return `<div class="ar-ini-card" style="opacity:${rolou?1:0.5}">
      <div class="ar-ini-num" style="color:${rolou?'#e8604c':'#5a4040'}">${valor}</div>
      <div class="ar-ini-nome" style="color:${p.cor||'#c8d8e8'}">${p.nome}</div>
      <div style="font-size:0.65rem;color:${rolou?'#5ee09a':'#7a6060'}">${rolou?'✓ Rolou':'Aguardando…'}</div>
    </div>`;
  }).join('');
}

function renderOrdemCombate() {
  const ini = AR.iniciativa;
  if (!ini) return;
  const strip = document.getElementById('ar-ini-ordem-strip');
  const vezLabel = document.getElementById('ar-ini-vez-label');
  const acoesEl = document.getElementById('ar-ini-acoes');
  const atual = ini.ordem && ini.ordem[ini.ordemAtual];

  // Render strip (mini-cards horizontais como na campanha)
  if (strip) {
    strip.innerHTML = ini.ordem.filter(p => !p.vinculado_a).map((p, idx) => {
      const isAtual = idx === ini.ordemAtual;
      const cor = p.cor || '#e8604c';
      return `<div onclick="${AR.myRole==='mestre'?`arDarVezPara(${idx})`:'undefined'}" style="
        flex-shrink:0;padding:6px 10px;border-radius:8px;text-align:center;cursor:${AR.myRole==='mestre'?'pointer':'default'};
        border:1px solid ${isAtual?cor:'rgba(60,30,30,0.5)'};
        background:${isAtual?`rgba(${hexToRgb(cor)},0.15)`:'rgba(20,12,12,0.7)'};
        transition:all 0.2s;min-width:54px;">
        <div style="font-family:'Cinzel',serif;font-size:0.58rem;color:${isAtual?cor:'#7a6060'}">${p.iniciativa||'?'}</div>
        <div style="font-size:0.72rem;color:${isAtual?cor:'#b8a8a8'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70px">${p.nome}</div>
        ${isAtual?`<div style="font-size:0.5rem;color:${cor};margin-top:2px">▲ vez</div>`:''}
      </div>`;
    }).join('');
  }

  // Vez label
  if (vezLabel) {
    vezLabel.textContent = atual ? `Vez de ${atual.nome}` : '';
  }

  // Verificar se é meu turno
  const meuChar = arMeuChar();
  const isMestre = AR.myRole === 'mestre';
  const ehMeuTurno = atual && meuChar && atual.nome === meuChar;
  if (acoesEl) acoesEl.style.display = (ehMeuTurno || isMestre) ? 'block' : 'none';

  // Criaturas vinculadas
  const minhasCriaturas = AR.chars.filter(c => {
    const owner = c.custom_attrs?.vinculado_a;
    return owner && (owner === meuChar || isMestre);
  });
  const criatWrap = document.getElementById('ar-ini-criaturas-vinculadas');
  const criatList = document.getElementById('ar-ini-criaturas-list');
  if (criatWrap && criatList) {
    criatWrap.style.display = minhasCriaturas.length ? 'block' : 'none';
    criatList.innerHTML = minhasCriaturas.map(c => `
      <button onclick="abrirModalAtaque('${c.nome.replace(/'/g,"\\'")}','arena')" style="width:100%;margin-bottom:4px;padding:7px 10px;background:rgba(232,80,60,0.08);border:1px solid rgba(232,80,60,0.25);border-radius:6px;color:#e8604c;font-family:'Cinzel',serif;font-size:0.72rem;cursor:pointer;text-align:left">
        ⚔ ${c.nome} <span style="color:#7a6060;font-size:0.65rem">(${c.hp_atual??'?'}/${c.custom_attrs?.hp_max??'?'} HP)</span>
      </button>`).join('');
  }
}

function arMeuChar() {
  if (AR.myCharNome) return AR.myCharNome;
  return AR.chars.find(c => {
    const ca = c.custom_attrs || {};
    return (ca.owner_nickname === AR.myNickname || ca.owner_nickname === SESSION?.user?.email) && (ca.tipo || 'jogador') === 'jogador';
  })?.nome || null;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return isNaN(r) ? '232,80,60' : `${r},${g},${b}`;
}

function arDarVezPara(idx) {
  if (AR.myRole !== 'mestre' || !AR.iniciativa) return;
  AR.iniciativa.ordemAtual = idx;
  arSalvarEstado();
  renderOrdemCombate();
}

async function arIniciarIniciativa() {
  if (AR.myRole !== 'mestre') return;
  // Participantes: jogadores + criaturas sem vínculo
  const participantes = AR.chars.filter(c => {
    const tipo = c.custom_attrs?.tipo || 'jogador';
    const hpAtual = c.hp_atual ?? c.custom_attrs?.hp_max ?? c.hp_max ?? 100;
    if (tipo === 'jogador') return hpAtual > 0;
    if (tipo === 'criatura' || tipo === 'objeto') return !c.custom_attrs?.vinculado_a && hpAtual > 0;
    return false;
  }).map(c => ({
    nome: c.nome,
    tipo: c.custom_attrs?.tipo||'jogador',
    cor: c.custom_attrs?.cor || '#e8604c',
    iniciativa: null,
  }));

  if (!participantes.length) { arToast('Nenhum participante disponível','erro'); return; }

  // NPCs rolam automaticamente; jogadores rolam por conta
  const iniciativas = {};
  participantes.forEach(p => {
    if (p.tipo === 'criatura' || p.tipo === 'objeto') {
      iniciativas[p.nome] = Math.floor(Math.random()*20)+1;
      p.iniciativa = iniciativas[p.nome];
    }
  });

  AR.iniciativa = { ativa:true, fase:'iniciativa', participantes, iniciativas, round:1, ordemAtual:0, ordem:[] };
  arAddLog('⚔ Batalha iniciada! Rolando iniciativas...');
  await arSalvarEstado();
  renderArenaIniciativaUI();
  arToast('Iniciativa iniciada! Jogadores devem rolar seu d20.','sucesso');
}

function abrirModalArenaIniciativa() {
  AR.iniValorAtual = null;
  document.getElementById('ar-ini-modal-dado').textContent = '—';
  document.getElementById('ar-ini-modal-confirmar').disabled = true;
  document.getElementById('ar-ini-modal-confirmar').style.opacity = '0.4';
  abrirModal('ar-modal-arena-iniciativa');
}

function arRolarIniciativaModal() {
  AR.iniValorAtual = Math.floor(Math.random()*20)+1;
  const el = document.getElementById('ar-ini-modal-dado');
  el.style.transform='scale(0.6)';el.style.opacity='0.3';
  setTimeout(()=>{
    el.textContent = AR.iniValorAtual;
    el.style.color = AR.iniValorAtual===20?'#5ee09a':AR.iniValorAtual===1?'#e74c3c':'#e8604c';
    el.style.transform='scale(1)';el.style.opacity='1';
    const btn = document.getElementById('ar-ini-modal-confirmar');
    btn.disabled=false; btn.style.opacity='1';
  },100);
}

async function arConfirmarIniciativa() {
  if (AR.iniValorAtual == null || !AR.iniciativa) return;
  const meuChar = arMeuChar();
  if (!meuChar) { arToast('Você não tem um personagem nesta batalha','erro'); return; }
  AR.iniciativa.iniciativas = AR.iniciativa.iniciativas || {};
  AR.iniciativa.iniciativas[meuChar] = AR.iniValorAtual;
  const p = AR.iniciativa.participantes.find(x=>x.nome===meuChar);
  if (p) p.iniciativa = AR.iniValorAtual;
  arAddLog(`🎲 ${meuChar} rolou iniciativa: ${AR.iniValorAtual}`);
  await arSalvarEstado();
  fecharModal('ar-modal-arena-iniciativa');
  renderArenaIniciativaUI();
  arToast(`Iniciativa ${AR.iniValorAtual} registrada!`,'sucesso');
}

async function arCalcularOrdemIniciativa() {
  if (!AR.iniciativa || AR.myRole !== 'mestre') return;
  const ini = AR.iniciativa;
  // Ordenar por iniciativa (maior primeiro), NPCs já têm valor
  const ordem = [...ini.participantes].sort((a,b) => (ini.iniciativas[b.nome]||0) - (ini.iniciativas[a.nome]||0));
  ordem.forEach(p => { p.iniciativa = ini.iniciativas[p.nome] || 0; });
  ini.ordem = ordem;
  ini.ordemAtual = 0;
  ini.fase = 'combate';
  ini.round = 1;
  const atual = ordem[0];
  arAddLog(`⚔ Ordem definida! ${ordem.map(p=>`${p.nome}(${p.iniciativa})`).join(' > ')}`);
  arAddLog(`🎯 Vez de: ${atual?.nome}`);
  await arSalvarEstado();
  renderArenaIniciativaUI();
  renderArenaCenario();
  arToast(`Combate iniciado! Vez de ${atual?.nome}!`,'sucesso');
}

// Helper: retorna true se o personagem está morto (hp <= 0)
const _charMorto = (p) => {
  const c = AR.chars.find(x => x.nome === p?.nome);
  return c && (c.hp_atual ?? 100) <= 0;
};

async function arProximoTurnoIniciativa() {
  if (!AR.iniciativa || AR.myRole !== 'mestre') return;
  const ini = AR.iniciativa;
  // Avançar para o próximo participante (pulando criaturas vinculadas)
  let prox = (ini.ordemAtual + 1);
  while (prox < ini.ordem.length &&
         (ini.ordem[prox]?.vinculado_a || _charMorto(ini.ordem[prox]))) {
    if (_charMorto(ini.ordem[prox]))
      arAddLog(`💀 ${ini.ordem[prox]?.nome} está fora — turno pulado`);
    prox++;
  }
  if (prox >= ini.ordem.length) {
    // Novo round
    ini.round = (ini.round||1) + 1;
    prox = 0;
    // Processar efeitos de turno
    await avancarTurno();
    arAddLog(`🔄 Round ${ini.round} iniciado`);
  }
  ini.ordemAtual = prox;
  const atual = ini.ordem[prox];
  arAddLog(`🎯 Vez de: ${atual?.nome}`);
  await arSalvarEstado();
  renderArenaIniciativaUI();
  renderArenaCenario();
  arToast(`Vez de ${atual?.nome || '?'}!`,'sucesso');
}

async function arEncerrarBatalhaIniciativa() {
  if (!AR.iniciativa || AR.myRole !== 'mestre') return;
  if (!confirm('Encerrar o combate? A ordem de iniciativa será perdida.')) return;

  // ── Limpar buffs de todos os personagens ao encerrar combate ───────────
  for (const c of AR.chars) {
    if (!Array.isArray(c.buffs) || !c.buffs.length) continue;
    // Reverter modificador_attr pendentes antes de limpar
    for (const b of c.buffs) {
      if (b.modificador_attr && (b.modificador_delta ?? 0) !== 0) {
        if (!c.custom_attrs) c.custom_attrs = {};
        if (!c.custom_attrs.atributos) c.custom_attrs.atributos = {};
        c.custom_attrs.atributos[b.modificador_attr] =
          (parseFloat(c.custom_attrs.atributos[b.modificador_attr]) || 0) - b.modificador_delta;
      }
    }
    c.buffs = [];
    try {
      await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(c.nome)}`,
        { method: 'PATCH', body: JSON.stringify({ buffs: [], custom_attrs: c.custom_attrs }) });
    } catch(e) {}
  }

  AR.iniciativa = null;
  arAddLog('⚔ Combate encerrado. Buffs e debuffs removidos.');
  await arSalvarEstado();
  renderArenaPersonagens();
  renderArenaEntidades();
  renderArenaEfeitos();
  renderArenaIniciativaUI();
  arToast('Combate encerrado','');
}

function arInserirCriaturaIniciativa(nome, posicao) {
  if (!AR.iniciativa || AR.iniciativa.fase !== 'combate') return;
  const c = AR.chars.find(x=>x.nome===nome);
  if (!c) return;
  const novaEntrada = {nome, tipo:c.custom_attrs?.tipo||'criatura', cor:c.custom_attrs?.cor||'#e8604c', iniciativa:Math.floor(Math.random()*20)+1};
  if (posicao === 'imediato') {
    AR.iniciativa.ordem.splice(AR.iniciativa.ordemAtual+1, 0, novaEntrada);
  } else if (posicao === 'ultimo') {
    AR.iniciativa.ordem.push(novaEntrada);
  } else {
    // próxima: inserir baseado na iniciativa rolada
    const pos = AR.iniciativa.ordem.findIndex((p,i)=>i>AR.iniciativa.ordemAtual&&p.iniciativa<novaEntrada.iniciativa);
    if (pos<0) AR.iniciativa.ordem.push(novaEntrada);
    else AR.iniciativa.ordem.splice(pos,0,novaEntrada);
  }
  arAddLog(`👹 ${nome} entrou na fila de combate (iniciativa: ${novaEntrada.iniciativa})`);
}

async function arAcaoAtacar() {
  // Abre modal de ataque para o personagem atual
  const ini = AR.iniciativa;
  if (ini && ini.fase === 'combate') {
    const atual = ini.ordem[ini.ordemAtual];
    if (atual) { abrirModalAtaque(atual.nome, 'arena'); return; }
  }
  const meuChar = AR.myCharNome || AR.chars.find(c=>(c.custom_attrs?.owner_nickname||'')===AR.myNickname&&(c.custom_attrs?.tipo||'jogador')==='jogador')?.nome;
  if (meuChar) abrirModalAtaque(meuChar, 'arena');
}

async function arAcaoPassar() {
  if (AR.myRole === 'mestre') { await arProximoTurnoIniciativa(); return; }
  const ini = AR.iniciativa;
  if (!ini || ini.fase !== 'combate') return;
  const meuChar = AR.myCharNome || AR.chars.find(c=>(c.custom_attrs?.owner_nickname||'')===AR.myNickname&&(c.custom_attrs?.tipo||'jogador')==='jogador')?.nome;
  const atual = ini.ordem[ini.ordemAtual];
  if (atual && atual.nome === meuChar) {
    arAddLog(`⏩ ${meuChar} passou o turno`);
    // Avança a ordem de iniciativa diretamente (sem exigir ação do mestre)
    let prox = (ini.ordemAtual + 1);
    while (prox < ini.ordem.length &&
           (ini.ordem[prox]?.vinculado_a || _charMorto(ini.ordem[prox]))) {
      if (_charMorto(ini.ordem[prox]))
        arAddLog(`💀 ${ini.ordem[prox]?.nome} está fora — turno pulado`);
      prox++;
    }
    if (prox >= ini.ordem.length) {
      ini.round = (ini.round||1) + 1;
      prox = 0;
      await avancarTurno();
      arAddLog(`🔄 Round ${ini.round} iniciado`);
    }
    ini.ordemAtual = prox;
    const proximo = ini.ordem[prox];
    arAddLog(`🎯 Vez de: ${proximo?.nome}`);
    await arSalvarEstado();
    renderArenaIniciativaUI();
    renderArenaCenario();
    arToast(`Vez de ${proximo?.nome || '?'}!`, 'sucesso');
  }
}

// ═══════════════════════════════════════════════════════════════
// REALTIME — atualiza iniciativa quando estado muda
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// 🎲 DADO RÁPIDO DA MESA — Rolagem de dados integrada ao mapa da Arena
// ═══════════════════════════════════════════════════════════════
let AR_MESA_DADO_SEL = null;

function arMesaRenderDados() {
  if (!AR.session) return;
  const cfg = getArenaDiceConfig();
  const el = document.getElementById('ar-mesa-dado-btns');
  if (!el) return;
  el.innerHTML = cfg.map(d =>
    `<button class="ar-mesa-dado-btn${AR_MESA_DADO_SEL === d ? ' ativo' : ''}"
             onclick="arMesaSelecionarDado(${d})" title="d${d}">d${d}</button>`
  ).join('');
}

function arMesaSelecionarDado(d) {
  AR_MESA_DADO_SEL = d;
  arMesaRenderDados();
}

function arMesaRolarDado() {
  const d = AR_MESA_DADO_SEL;
  if (!d) { arToast('Selecione um dado', 'erro'); return; }
  const r = Math.floor(Math.random() * d) + 1;
  const el = document.getElementById('ar-mesa-dado-resultado');
  if (!el) return;
  el.style.transform = 'scale(0.6)'; el.style.opacity = '0.3';
  setTimeout(() => {
    let cor = '#7ec8f0', txt = String(r);
    if (d === 20 && r === 20)       { cor = '#5ee09a'; txt = r + ' ✦'; }
    else if (d === 20 && r === 1)   { cor = '#e74c3c'; txt = r + ' ✕'; }
    else if (d === 100 && r === 100){ cor = '#5ee09a'; txt = r + ' ✦'; }
    el.textContent = txt; el.style.color = cor;
    el.style.transform = 'scale(1)'; el.style.opacity = '1';
  }, 70);
}

// ═══════════════════════════════════════════════════════════════
// ⚔️  MESA — Sistema de campo de batalha top-down
// ═══════════════════════════════════════════════════════════════

let MESA: any = {
  toolMode: false,      // false = arrastar | true = medir distância
  medindo: [null, null],// [token_nome_A, token_nome_B]
  medicaoAtiva: null,   // { pA, pB, label } — linha de medição de distância persistente entre renders
  escala: { val: 1.5, unit: 'm', grid: 20 },
  dragging: null,       // {nome, startX%, startY%, el}
  dragTimer: null,      // debounce para salvar posição
  zoom: 1,              // fator de zoom do mapa da mesa
  panX: 0,              // translação horizontal (px)
  panY: 0,              // translação vertical (px)
  _panStartX: 0, _panStartY: 0, _panOriginX: 0, _panOriginY: 0,
  _zoomInited: false, _keyZoomInited: false,
};

function mesaZoomApply() {
  const bg = document.getElementById('ar-mesa-bg');
  if (!bg) return;
  bg.style.transformOrigin = '0 0';
  bg.style.transform = `translate(${MESA.panX}px,${MESA.panY}px) scale(${MESA.zoom})`;
  const lbl = document.getElementById('ar-mesa-zoom-val');
  if (lbl) lbl.textContent = Math.round(MESA.zoom * 100) + '%';
}

function mesaZoomReset() {
  MESA.zoom = 1; MESA.panX = 0; MESA.panY = 0;
  mesaZoomApply();
  const btn = document.getElementById('ar-mesa-zoom-val');
  if (btn) btn.textContent = '100%';
}

function mesaZoomSet(z, pivotX, pivotY) {
  const wrap = document.getElementById('ar-mesa-wrap');
  if (!wrap) return;
  const oldZoom = MESA.zoom;
  const newZoom = Math.max(0.05, Math.min(20, z));
  // Ajustar pan para manter o ponto de pivot estacionário
  if (pivotX != null && pivotY != null) {
    MESA.panX = pivotX - (pivotX - MESA.panX) * (newZoom / oldZoom);
    MESA.panY = pivotY - (pivotY - MESA.panY) * (newZoom / oldZoom);
  }
  MESA.zoom = newZoom;
  mesaZoomApply();
  const btn = document.getElementById('ar-mesa-zoom-val');
  if (btn) btn.textContent = Math.round(newZoom * 100) + '%';
}

function mesaZoomInit() {
  const wrap = document.getElementById('ar-mesa-wrap');
  if (!wrap || MESA._zoomInited) return;
  MESA._zoomInited = true;

  wrap.style.overflow = 'visible';
  wrap.style.borderRadius = '10px';
  wrap.style.clipPath = 'inset(0 round 10px)';

  // ── Wheel zoom (centrado no cursor) ───────────────────────────
  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = wrap.getBoundingClientRect();
    mesaZoomSet(MESA.zoom * (e.deltaY < 0 ? 1.15 : 0.87), e.clientX - rect.left, e.clientY - rect.top);
  }, { passive: false });

  // ── Pinch zoom (touch 2 dedos) ────────────────────────────────
  let _lastPinchDist = 0;
  wrap.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2)
      _lastPinchDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
  }, { passive: true });
  wrap.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      if (_lastPinchDist > 0) {
        const rect = wrap.getBoundingClientRect();
        mesaZoomSet(MESA.zoom * dist / _lastPinchDist,
          (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
          (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top);
        _lastPinchDist = dist;
      }
    }
  }, { passive: false });

  // ── Pan com pointer em qualquer lugar do mapa ─────────────────
  let _isPanning = false, _panPointerId = null, _panSX = 0, _panSY = 0, _panOX = 0, _panOY = 0;
  wrap.addEventListener('pointerdown', (e) => {
    if ((e.target as any).closest('#ar-mesa-zoom-hud')) return;
    if (MESA.toolMode) return;
    if ((e.target as any).closest('.ar-mesa-token') && e.button === 0) return;
    _isPanning = true; _panPointerId = e.pointerId;
    _panSX = e.clientX; _panSY = e.clientY;
    _panOX = MESA.panX; _panOY = MESA.panY;
    wrap.setPointerCapture(e.pointerId);
    wrap.style.cursor = 'grabbing';
    e.preventDefault();
  });
  wrap.addEventListener('pointermove', (e) => {
    if (!_isPanning || e.pointerId !== _panPointerId) return;
    MESA.panX = _panOX + (e.clientX - _panSX);
    MESA.panY = _panOY + (e.clientY - _panSY);
    mesaZoomApply();
  });
  const _endPan = (e) => {
    if (e.pointerId !== _panPointerId) return;
    _isPanning = false; _panPointerId = null;
    wrap.style.cursor = 'grab';
  };
  wrap.addEventListener('pointerup', _endPan);
  wrap.addEventListener('pointercancel', _endPan);

  // ── Atalhos de teclado (aba mesa da arena) ────────────────────
  if (!MESA._keyZoomInited) {
    MESA._keyZoomInited = true;
    document.addEventListener('keydown', (e) => {
      const mesaTab = document.getElementById('ar-tab-mesa');
      if (!mesaTab || !mesaTab.classList.contains('ativo')) return;
      if ((e.target as any).tagName === 'INPUT' || (e.target as any).tagName === 'TEXTAREA') return;
      const wrapEl = document.getElementById('ar-mesa-wrap');
      const r = wrapEl ? wrapEl.getBoundingClientRect() : { width: 300, height: 300 };
      if (e.key === '+' || e.key === '=') { e.preventDefault(); mesaZoomSet(MESA.zoom * 2, r.width / 2, r.height / 2); }
      else if (e.key === '-') { e.preventDefault(); mesaZoomSet(MESA.zoom * 0.5, r.width / 2, r.height / 2); }
      else if (e.key === '0') { e.preventDefault(); mesaZoomReset(); }
    });
  }
}

// ── RENDER PRINCIPAL ─────────────────────────────────────────
function renderMesa() {
  const mesaEl = document.getElementById('ar-tab-mesa');
  if (!mesaEl) return;

  // Atualizar turno
  const turnoEl = document.getElementById('ar-mesa-turno');
  if (turnoEl) (turnoEl as any).textContent = AR.estado.turno || 0;

  // Atualizar pill do cenário
  const pill = document.getElementById('ar-mesa-cenario-pill');
  if (pill) {
    if (AR.estado.cenario) {
      pill.textContent = AR.estado.cenario.length > 45 ? AR.estado.cenario.slice(0,45) + '…' : AR.estado.cenario;
      pill.style.color = '#b8a8a8';
    } else {
      pill.textContent = 'Toque para definir cenário…';
      pill.style.color = '#7a6060';
    }
  }

  // Background do campo
  mesaAtualizarBackground();

  // Desenhar grade
  mesaDesenharGrade();

  // Tokens
  mesaRenderTokens();

  // Inicializar zoom (só uma vez por sessão)
  setTimeout(mesaZoomInit, 100);

  // Efeitos ativos resumo
  mesaRenderEfeitosRow();

  // Status rápido (hp cards)
  mesaRenderStatus();

  // Iniciativa / batalha (integrado na aba Mesa)
  renderArenaIniciativaUI();

  // Ações criativas pendentes (mestre)
  criativoRenderMestre();
}

function mesaAtualizarBackground() {
  const bg = document.getElementById('ar-mesa-bg');
  if (!bg) return;
  bg.style.background = 'radial-gradient(ellipse at center,#1a0e0e 0%,#050208 100%)';
  bg.style.perspective = '';

  const imgUrl = normalizeImgUrl(AR.estado?.cenario_img || '');

  // Remover ar-iso-wrap legado se existir
  const _legacyWrap = bg.querySelector('.ar-iso-wrap');
  if (_legacyWrap) _legacyWrap.remove();

  let arBgImg = bg.querySelector('img.ar-bg-img');
  if (!arBgImg) {
    arBgImg = document.createElement('img');
    arBgImg.className = 'ar-bg-img';
    arBgImg.onerror = () => { arBgImg.style.display = 'none'; };
    arBgImg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:0;';
    bg.insertBefore(arBgImg, bg.firstChild);
  }

  if (imgUrl) {
    arBgImg.src = imgUrl;
    arBgImg.style.display = 'block';
  } else {
    arBgImg.style.display = 'none';
  }
  // Garantir que o img original do HTML não duplique
  const oldImgEl = document.getElementById('ar-mesa-img');
  if (oldImgEl) oldImgEl.style.display = 'none';

  // Reaplicar zoom/pan atual após atualizar o background
  mesaZoomApply();
}

function mesaDesenharGrade() {
  const canvas = document.getElementById('ar-mesa-canvas');
  if (!canvas) return;
  const wrap = document.getElementById('ar-mesa-bg');
  const w = wrap.offsetWidth || 300;
  const h = wrap.offsetHeight || 225;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const g = MESA.escala.grid;
  if (!g) return;
  // Grade ortogonal (H/V) — sem isométrico
  const cols = g;
  const rows = Math.round(h / (w / g));
  const cW = w / cols;
  const cH = h / rows;
  ctx.strokeStyle = 'rgba(200,168,75,0.15)';
  ctx.lineWidth = 0.5;
  for (let c = 0; c <= cols; c++) {
    const x = Math.round(c * cW) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    const y = Math.round(r * cH) + 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

// ── TOKENS ───────────────────────────────────────────────────
function mesaRenderTokens() {
  const layer = document.getElementById('ar-mesa-tokens');
  if (!layer) return;
  layer.innerHTML = '';
  AR.chars.forEach(c => mesaCriarToken(c, layer));
  // Montar canvas animado após inserção no DOM
  requestAnimationFrame(() => { window._animScheduleTokenMount?.(true); });
  // Restaurar linha de medição de distância caso exista (sobrevive a re-renders)
  if (MESA.medicaoAtiva) {
    const { pA, pB, label } = MESA.medicaoAtiva;
    mesaRenderDistLine(pA, pB, label);
  } else {
    mesaRenderDistLine();
  }
}

function mesaCriarToken(c, layer) {
  const ca = c.custom_attrs || {};
  const pos = ca.pos || { x: 50, y: 50 };
  const cor = ca.cor || '#e8604c';
  const hpMax = ca.hp_max ?? 100;
  const hp = c.hp_atual ?? hpMax;
  const hpPct = Math.round((hp/hpMax)*100);
  const tipoIcon = ca.tipo === 'criatura' ? '👹' : ca.tipo === 'objeto' ? '🗡' : '';
  const iniciais = c.nome.slice(0,2).toUpperCase();
  const incapacitado = hp <= 0;
  const buffsCount = (ca.buffs||[]).filter(b => _buffAtivo(b)).length;

  // Escala de profundidade iso: y=0 (fundo) → 0.72×; y=100 (frente) → 1.22×
  const arDepthOn = !!(AR.estado?.transform3d?.depth ?? true); // arena sempre depth=true por default
  const arIsoDepth = arDepthOn ? (0.72 + (pos.y / 100) * 0.50).toFixed(3) : '1';
  const token = document.createElement('div');
  token.className = 'ar-mesa-token';
  token.dataset.nome = c.nome;
  token.style.cssText = `
    position:absolute;
    left:${pos.x}%;top:${pos.y}%;
    transform:translate(-50%,-50%) scale(${arIsoDepth});
    width:${ca.tipo==='objeto'?40:50}px;
    height:${ca.tipo==='objeto'?40:50}px;
    border-radius:${ca.tipo==='objeto'?'6px':'50%'};
    border:2px solid ${selecionado?'#7ec8f0':cor};
    box-shadow:${selecionado?`0 0 0 3px rgba(126,200,240,0.5),`:''}0 0 12px ${cor}55;
    overflow:hidden;
    cursor:${MESA.toolMode?'crosshair':'grab'};
    z-index:10;
    transition:box-shadow 0.15s;
    touch-action:none;
    opacity:${incapacitado?0.45:1};
    background:${(ca.img_url||ca.img)?'transparent':'rgba(20,12,12,0.95)'};
    display:flex;align-items:center;justify-content:center;
    flex-direction:column;
  `;
  const apmodSvg = ca.aparencia && typeof apmodTokenSVG === 'function' ? apmodTokenSVG(c, 'local') : null;
  const isIso = !!(apmodSvg && !ca.img_url && !ca.img);
  const tamanhoFator = Math.max(0.4, (ca.aparencia?.tamanho || 1.0));
  const isAnimadoAr = ca.aparencia?.modo === 'animado' && ca.aparencia?.animado?.parts && Object.keys(ca.aparencia.animado.parts).length > 0;
  if (isIso) {
    const tw = Math.round((ca.tipo==='objeto'?28:32)*tamanhoFator);
    const th = Math.round((ca.tipo==='objeto'?36:52)*tamanhoFator);
    const elev = Math.round(8*tamanhoFator);
    token.style.cssText = `position:absolute;left:${pos.x}%;top:${pos.y}%;transform:translate(-50%,-50%);width:${tw}px;height:${th}px;cursor:${MESA.toolMode?'crosshair':'grab'};z-index:10;touch-action:none;opacity:${incapacitado?0.45:1};overflow:visible;display:flex;align-items:flex-end;justify-content:center;`;
    const inner = document.createElement('div');
    // CSS filter cria compositing group que quebra WebGL — omitir para tokens animados
    const _arFilter = isAnimadoAr ? '' : `filter:drop-shadow(0 ${elev}px 12px rgba(0,0,0,0.9)) drop-shadow(0 2px 4px rgba(0,0,0,0.7))${selecionado?' drop-shadow(0 0 6px rgba(126,200,240,0.7))':''}`;
    inner.style.cssText = `width:${tw}px;height:${th}px;border:1px solid ${selecionado?'#7ec8f0':cor+'44'};border-radius:4px;background:transparent;position:relative;${_arFilter};transform:translateY(-${elev}px);display:flex;align-items:center;justify-content:center;overflow:visible;`;
    const _arEquips = ca.aparencia?.equipamentos_visuais || [];
    const composedImgAr = ca.aparencia?.composed_img;
    if (composedImgAr && !isAnimadoAr) {
      inner.innerHTML = `<img src="${composedImgAr}" style="width:${tw}px;height:${th}px;object-fit:contain;display:block" crossorigin="anonymous">`;
    } else {
      const _arEquipHtml = (camada) => _arEquips.filter(eq=>eq.visivel!==false&&(eq.img||eq.img_url||(eq.svg&&eq.svg.length>5))&&(camada==='atras'?eq.camada==='atras':eq.camada!=='atras')).map(eq=>{const xP=eq.x!=null?eq.x:50,yP=eq.y!=null?eq.y:30,esc=(eq.escala!=null?eq.escala:100)/100,eW=Math.round(0.35*tw*esc),eH=Math.round(0.45*th*esc),l=Math.round((xP/100)*tw-eW/2),t=Math.round((yP/100)*th-eH/2);const rot=eq.rotacao!=null?eq.rotacao:0;const rotH=eq.rotacaoH||0;const _arWarp=eq.warpCorners?_aeqComputeMatrix3d(eW,eH,eq.warpCorners.map(c=>({x:c.x*eW,y:c.y*eH}))):null;const _arTfParts=_arWarp&&_arWarp!=='none'?[_arWarp]:[rotH?`perspective(400px) rotateY(${rotH}deg)`:'',rot?`rotate(${rot}deg)`:'',eq.skewX?`skewX(${eq.skewX}deg)`:'',eq.skewY?`skewY(${eq.skewY}deg)`:''].filter(Boolean);const rotS=_arTfParts.length?`transform:${_arTfParts.join(' ')};transform-origin:${(_arWarp&&_arWarp!=='none')?'0 0':'center center'};`:'';const inn=(eq.img||eq.img_url)?`<img src="${eq.img||eq.img_url}" style="width:${eW}px;height:${eH}px;object-fit:contain;pointer-events:none">`:`<div style="width:${eW}px;height:${eH}px;display:flex;align-items:center;justify-content:center;pointer-events:none">${eq.svg}</div>`;return `<div style="position:absolute;left:${l}px;top:${t}px;z-index:${camada==='atras'?0:5};pointer-events:none;${rotS}">${inn}</div>`;}).join('');
      inner.innerHTML = _arEquipHtml('atras') + apmodSvg + _arEquipHtml('frente');
    }
    token.appendChild(inner);
  } else if (ca.img_url || ca.img) {
    const _arTints = ca.aparencia?.tints || [];
    const _arOvls = tintOverlayHtml(_arTints);
    token.innerHTML = `<div style="position:relative;width:100%;height:100%;border-radius:inherit;overflow:hidden"><img src="${normalizeImgUrl(ca.img_url||ca.img)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="this.style.display='none'">${_arOvls}</div>`;
  } else {
    token.innerHTML = `<div style="font-family:'Cinzel',serif;font-size:0.75rem;color:${cor};line-height:1;font-weight:700">${tipoIcon||iniciais}</div>`;
  }

  // Badge HP
  const hpBadge = document.createElement('div');
  hpBadge.style.cssText = `position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);background:#050208;border:1px solid ${cor}55;border-radius:8px;padding:1px 5px;font-family:'Cinzel',serif;font-size:0.55rem;color:${hpPct>=60?'#5ee09a':hpPct>=25?'#f0cc6a':'#e74c3c'};white-space:nowrap;pointer-events:none;`;
  hpBadge.textContent = hp + '/' + hpMax;
  token.appendChild(hpBadge);

  // Badge nome
  const nomeBadge = document.createElement('div');
  nomeBadge.style.cssText = `position:absolute;top:-18px;left:50%;transform:translateX(-50%);background:rgba(5,2,8,0.85);border-radius:4px;padding:1px 6px;font-family:'Cinzel',serif;font-size:0.55rem;color:${cor};white-space:nowrap;pointer-events:none;max-width:80px;overflow:hidden;text-overflow:ellipsis;`;
  nomeBadge.textContent = c.nome;
  token.appendChild(nomeBadge);

  // Badge buffs
  if (buffsCount > 0) {
    const buffBadge = document.createElement('div');
    buffBadge.style.cssText = `position:absolute;top:-4px;right:-4px;width:14px;height:14px;border-radius:50%;background:#e8604c;border:1px solid #050208;font-family:'Cinzel',serif;font-size:0.5rem;color:#fff;display:flex;align-items:center;justify-content:center;pointer-events:none;`;
    buffBadge.textContent = buffsCount;
    token.appendChild(buffBadge);
  }

  // Incapacitado overlay
  if (incapacitado) {
    const over = document.createElement('div');
    over.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;font-size:1rem;border-radius:inherit;pointer-events:none;';
    over.textContent = '💀';
    token.appendChild(over);
  }

  // DRAG ou MEDIÇÃO
  token.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (MESA.toolMode) {
      mesaClicarToken(c.nome);
      return;
    }
    mesaIniciarDrag(c.nome, token, e);
  });
  token.addEventListener('click', (e) => {
    e.stopPropagation();
    if ((MESA as any).tokenMoveu) return;
  });

  layer.appendChild(token);
}

// ── DRAG ────────────────────────────────────────────────────
function mesaIniciarDrag(nome, el, e) {
  // Verificar debuff sem_movimento (apenas para não-mestre)
  const isMestreArena = AR.myRole === 'mestre';
  if (!isMestreArena) {
    const c = AR.chars.find(ch => ch.nome === nome);
    const buffs = c?.buffs || [];
    const imobilizado = buffs.some(b => b.sem_movimento && (b.sem_movimento_turnos_restantes ?? 0) > 0);
    if (imobilizado) {
      const buff = buffs.find(b => b.sem_movimento && (b.sem_movimento_turnos_restantes ?? 0) > 0);
      arToast(`🚫 ${nome} está imobilizado — "${buff?.nome || 'Debuff'}"`, 'erro');
      return;
    }
  }
  e.preventDefault();
  MESA.dragging = nome;
  (MESA as any).tokenMoveu = false;
  el.style.cursor = 'grabbing';
  el.setPointerCapture(e.pointerId);
  el.addEventListener('pointermove', mesaOnDrag);
  el.addEventListener('pointerup', mesaFimDrag);
}

function mesaOnDrag(e) {
  if (!MESA.dragging) return;
  (MESA as any).tokenMoveu = true;
  const wrap = document.getElementById('ar-mesa-wrap');
  const bg   = document.getElementById('ar-mesa-bg');
  const wrapRect = wrap.getBoundingClientRect();
  // Compensar zoom e pan: converter coordenada de tela para posição % dentro do elemento não-escalado
  const zoom = MESA.zoom || 1;
  const localX = (e.clientX - wrapRect.left - MESA.panX) / zoom;
  const localY = (e.clientY - wrapRect.top  - MESA.panY) / zoom;
  const layoutW = bg.offsetWidth  || wrapRect.width;
  const layoutH = bg.offsetHeight || wrapRect.height;
  const x = Math.max(2, Math.min(98, localX / layoutW * 100));
  const y = Math.max(2, Math.min(98, localY / layoutH * 100));
  const c = AR.chars.find(ch => ch.nome === MESA.dragging);
  if (!c) return;
  c.custom_attrs.pos = { x, y };
  // Mover token visualmente sem re-render completo
  const tokenEl = document.querySelector(`.ar-mesa-token[data-nome="${CSS.escape(MESA.dragging)}"]`);
  if (tokenEl) {
    tokenEl.style.left = x+'%';
    tokenEl.style.top  = y+'%';
    // Atualiza escala de profundidade iso em tempo real durante o arrasto
    const ds = (0.72 + (y / 100) * 0.50).toFixed(3);
    const existingTransform = tokenEl.style.transform || '';
    tokenEl.style.transform = `translate(-50%,-50%) scale(${ds})`;
  }
  // Broadcast em tempo real para outros clientes (throttle 50ms ≈ 20fps)
  const _nowM = Date.now();
  if (!MESA._lastBroadcast || _nowM - (MESA as any)._lastBroadcast > 50) {
    (MESA as any)._lastBroadcast = _nowM;
    tokenMoveBroadcast({ sid: _TOKEN_MOVE_SID, nome: MESA.dragging, x, y, contexto: 'arena' });
  }
  // Debounce: agendar save após pausa de 400ms
  clearTimeout(MESA.dragTimer);
  const nomeSnap = MESA.dragging;
  const attrsSnap = {...c.custom_attrs}; // objeto direto — jsonb
  MESA.dragTimer = setTimeout(async () => {
    try {
      await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(nomeSnap)}`, {
        method:'PATCH', body: JSON.stringify({custom_attrs: attrsSnap})
      });
    } catch(err) {}
  }, 400);
}

async function mesaFimDrag(e) {
  if (!MESA.dragging) return;
  const nome = MESA.dragging;
  MESA.dragging = null;
  MESA.tokenMoveu = false;
  const c = AR.chars.find(ch => ch.nome === nome);
  // Forçar save imediato ao soltar (cancela debounce pendente)
  clearTimeout(MESA.dragTimer);
  if (c) {
    try {
      await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(nome)}`, {
        method:'PATCH', body:JSON.stringify({custom_attrs:c.custom_attrs})
      });
    } catch(err) {}
  }
  const tokenEl = document.querySelector(`.ar-mesa-token[data-nome="${CSS.escape(nome)}"]`);
  if (tokenEl) {
    tokenEl.style.cursor = 'grab';
    tokenEl.removeEventListener('pointermove', mesaOnDrag);
    tokenEl.removeEventListener('pointerup', mesaFimDrag);
  }
}

// ── FERRAMENTA DE MEDIÇÃO ────────────────────────────────────
function toggleMesaTool() {
  MESA.toolMode = !MESA.toolMode;
  MESA.medindo = [null, null];
  if (!MESA.toolMode) MESA.medicaoAtiva = null; // limpar ao desativar ferramenta
  const btn = document.getElementById('ar-mesa-tool-btn');
  const hint = document.getElementById('ar-mesa-tool-hint');
  if (btn) {
    btn.textContent = MESA.toolMode ? '✕' : '📏';
    btn.style.background = MESA.toolMode ? 'rgba(79,163,209,0.15)' : '';
    btn.style.borderColor = MESA.toolMode ? 'rgba(79,163,209,0.4)' : '';
    btn.style.color = MESA.toolMode ? '#7ec8f0' : '';
  }
  if (hint) hint.style.display = MESA.toolMode ? 'block' : 'none';
  mesaRenderDistLine(); // limpa linha
  mesaRenderTokens();   // atualiza cursors
}

function mesaClicarToken(nome) {
  if (!MESA.medindo[0]) {
    MESA.medindo[0] = nome;
    arToast(`${nome} selecionado — agora toque no segundo`, '');
    mesaRenderTokens(); // highlight
    return;
  }
  if (MESA.medindo[0] === nome) {
    MESA.medindo = [null, null];
    mesaRenderTokens();
    mesaRenderDistLine();
    return;
  }
  MESA.medindo[1] = nome;
  mesaCalcularDistancia();
}

function mesaCalcularDistancia() {
  const [nA, nB] = MESA.medindo;
  const cA = AR.chars.find(c => c.nome === nA);
  const cB = AR.chars.find(c => c.nome === nB);
  if (!cA || !cB) return;
  const pA = cA.custom_attrs.pos || {x:50,y:50};
  const pB = cB.custom_attrs.pos || {x:50,y:50};
  const bg = document.getElementById('ar-mesa-bg');
  const w = bg.offsetWidth, h = bg.offsetHeight;
  const g = MESA.escala.grid || 20;
  const dxPct = (pB.x - pA.x), dyPct = (pB.y - pA.y);
  const dxCells = dxPct / 100 * g;
  const dyCells = dyPct / 100 * g * (w/h) / (4/3);
  const distCells = Math.sqrt(dxCells*dxCells + dyCells*dyCells);
  const distReal = (distCells * MESA.escala.val).toFixed(1);
  const unit = MESA.escala.unit;
  const label = `${distReal} ${unit}`;
  arToast(`📏 ${nA} → ${nB}: ${label} (~${distCells.toFixed(1)} quadrados)`, '');
  MESA.medicaoAtiva = { pA, pB, label }; // persiste a linha para ser restaurada em re-renders
  mesaRenderDistLine(pA, pB, label);
  MESA.medindo = [null, null];
  setTimeout(() => mesaRenderTokens(), 100);
}

function mesaRenderDistLine(pA?, pB?, label?) {
  const svg = document.getElementById('ar-mesa-dist-svg');
  if (!svg) return;
  if (!pA) { svg.innerHTML = ''; return; }
  const bg = document.getElementById('ar-mesa-bg');
  const w = bg.offsetWidth, h = bg.offsetHeight;
  const x1 = pA.x/100*w, y1 = pA.y/100*h;
  const x2 = pB.x/100*w, y2 = pB.y/100*h;
  const mx = (x1+x2)/2, my = (y1+y2)/2;
  svg.innerHTML = `
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7ec8f0" stroke-width="1.5" stroke-dasharray="5,4" opacity="0.8"/>
    <circle cx="${x1}" cy="${y1}" r="4" fill="#7ec8f0" opacity="0.8"/>
    <circle cx="${x2}" cy="${y2}" r="4" fill="#7ec8f0" opacity="0.8"/>
    <rect x="${mx-28}" y="${my-10}" width="56" height="18" rx="4" fill="rgba(5,2,8,0.85)"/>
    <text x="${mx}" y="${my+4}" text-anchor="middle" font-family="Cinzel,serif" font-size="9" fill="#7ec8f0">${label||''}</text>
    <text x="${w-4}" y="14" text-anchor="end" font-family="Cinzel,serif" font-size="9" fill="#7ec8f0" opacity="0.5" style="cursor:pointer" onclick="limparMedicaoArena()">✕ Limpar</text>
  `;
}

function limparMedicaoArena() {
  MESA.medicaoAtiva = null;
  MESA.medindo = [null, null];
  const svg = document.getElementById('ar-mesa-dist-svg');
  if (svg) svg.innerHTML = '';
}

// ── EFEITOS ROW NA MESA ──────────────────────────────────────
function mesaRenderEfeitosRow() {
  const el = document.getElementById('ar-mesa-efeitos-row');
  if (!el) return;
  const efeitosMap = {};
  AR.chars.forEach(c => {
    (c.buffs||[]).filter(b => _buffAtivo(b)).forEach(b => {
      if (!efeitosMap[b.id]) efeitosMap[b.id] = b;
    });
  });
  const efeitos = Object.values<any>(efeitosMap);
  el.innerHTML = efeitos.map(b => {
    const cls = b.tipo === 'buff' ? 'ar-badge-buff' : b.tipo === 'debuff' ? 'ar-badge-debuff' : 'ar-badge-neutro';
    const dur = b.turnos_restantes > 0 ? ` (${b.turnos_restantes}t)` : '';
    return `<span class="ar-badge ${cls}" title="${b.descricao||''}">${b.tipo==='buff'?'↑':b.tipo==='debuff'?'↓':'~'} ${b.nome}${dur}</span>`;
  }).join('');
}

// ── STATUS RÁPIDO ────────────────────────────────────────────
function mesaRenderStatus() {
  const el = document.getElementById('ar-mesa-status');
  if (!el) return;
  if (!AR.chars.length) { el.innerHTML = ''; return; }
  el.innerHTML = AR.chars.map(c => {
    const ca = c.custom_attrs || {};
    const hpMax = ca.hp_max ?? 100;
    const hp = c.hp_atual ?? hpMax;
    const hpPct = Math.round((hp/hpMax)*100);
    const cor = ca.cor || '#e8604c';
    const hpColor = hpPct >= 60 ? '#5ee09a' : hpPct >= 25 ? '#f0cc6a' : '#e74c3c';
    const hpCls = hpPct >= 60 ? 'ar-hp-high' : hpPct >= 25 ? 'ar-hp-mid' : 'ar-hp-low';
    const tipoIcon = ca.tipo==='criatura'?'👹':ca.tipo==='objeto'?'🗡':'⚔';
    const buffsCount = (ca.buffs||[]).filter(b => _buffAtivo(b)).length;
    const isMestre = RPG_DATA?.myRole === 'mestre';
    const ehMeuChar = SESSION?.user && c.nome === (RPG_DATA?.linked || '');
    const podeAtacarMesa = ehMeuChar || isMestre;
    // Botão ⚔ com estado de batalha
    let btnAtacarMesa = '';
    if (podeAtacarMesa && hp > 0) {
      const estadoAtk = isMestre ? 'livre' : _estadoBatalhaJogador(c.nome);
      if (estadoAtk === 'livre') {
        btnAtacarMesa = `<button onclick="event.stopPropagation();abrirModalAtaque('${c.nome.replace(/'/g,"\\'")}','arena')" style="background:rgba(232,80,60,0.1);border:1px solid rgba(232,80,60,0.25);border-radius:4px;color:#e8604c;font-family:'Cinzel',serif;font-size:0.6rem;padding:2px 8px;cursor:pointer;flex-shrink:0" title="Atacar">⚔</button>`;
      } else if (estadoAtk === 'fora_combate') {
        btnAtacarMesa = `<button onclick="event.stopPropagation();abrirModalAtaque('${c.nome.replace(/'/g,"\\'")}','arena')" style="background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.25);border-radius:4px;color:#c8a84b;font-family:'Cinzel',serif;font-size:0.6rem;padding:2px 8px;cursor:pointer;flex-shrink:0" title="Fora de combate — Mestre precisará aprovar">⚔?</button>`;
      } else {
        btnAtacarMesa = `<button onclick="event.stopPropagation()" style="background:rgba(60,50,50,0.06);border:1px solid rgba(60,50,50,0.2);border-radius:4px;color:#4a3a3a;font-family:'Cinzel',serif;font-size:0.6rem;padding:2px 8px;cursor:not-allowed;flex-shrink:0;opacity:0.4" title="Não é seu turno">⚔</button>`;
      }
    }
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(20,12,12,0.7);border:1px solid ${cor}20;border-left:2px solid ${cor};border-radius:6px;cursor:pointer" onclick="abrirModalHP('${c.nome.replace(/'/g,"\\'")}')">
      ${(ca.img_url||ca.img)?`<img src="${normalizeImgUrl(ca.img_url||ca.img)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid ${cor}40;flex-shrink:0" onerror="this.style.display='none'">`:`<div style="width:28px;height:28px;border-radius:50%;background:${cor}15;border:1px solid ${cor}40;display:flex;align-items:center;justify-content:center;font-size:0.75rem;flex-shrink:0">${tipoIcon}</div>`}
      <div style="flex:1;min-width:0">
        <div style="font-family:'Cinzel',serif;font-size:0.75rem;color:${cor};margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.nome}</div>
        <div class="ar-hp-bar" style="height:5px;margin:0"><div class="ar-hp-fill ${hpCls}" style="width:${hpPct}%"></div></div>
      </div>
      <span style="font-family:'Cinzel',serif;font-size:0.78rem;color:${hpColor};flex-shrink:0">${hp}/${hpMax}</span>
      ${buffsCount?`<span style="font-family:'Cinzel',serif;font-size:0.6rem;color:#e8604c;background:rgba(232,80,60,0.1);border:1px solid rgba(232,80,60,0.2);border-radius:10px;padding:1px 5px">×${buffsCount}</span>`:''}
      ${btnAtacarMesa}
    </div>`;
  }).join('');
}

// ── ESCALA ───────────────────────────────────────────────────
function abrirModalEscala() {
  document.getElementById('ar-escala-val').value = MESA.escala.val;
  document.getElementById('ar-escala-unit').value = MESA.escala.unit;
  document.getElementById('ar-grid-size').value = MESA.escala.grid;
  abrirModal('ar-modal-escala');
}

function salvarEscala() {
  MESA.escala.val = parseFloat(document.getElementById('ar-escala-val').value) || 1.5;
  MESA.escala.unit = document.getElementById('ar-escala-unit').value;
  MESA.escala.grid = parseInt(document.getElementById('ar-grid-size').value) || 0;
  fecharModal('ar-modal-escala');
  mesaDesenharGrade();
  arToast('Escala atualizada!','sucesso');
}

// ── MAPA DA ARENA: configurar imagem de fundo ─────────────────
// ═══ EDITOR 3D DA ARENA ════════════════════════════════════════════════════
function arMp3dAtualizar() {
  const _get = id => parseFloat(document.getElementById(id)?.value ?? 0);
  const rx = _get('ar-mp3d-rx'), ry = _get('ar-mp3d-ry'), rz = _get('ar-mp3d-rz');
  const persp = _get('ar-mp3d-persp'), ox = _get('ar-mp3d-ox'), oy = _get('ar-mp3d-oy'), sc = _get('ar-mp3d-sc');

  // Labels
  const _lbl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  _lbl('ar-mp3d-rx-val',    rx    + '°');
  _lbl('ar-mp3d-ry-val',    ry    + '°');
  _lbl('ar-mp3d-rz-val',    rz    + '°');
  _lbl('ar-mp3d-persp-val', persp >= 4000 ? '∞' : persp + 'px');
  _lbl('ar-mp3d-ox-val',    ox    + '%');
  _lbl('ar-mp3d-oy-val',    oy    + '%');
  _lbl('ar-mp3d-sc-val',    (sc/100).toFixed(2) + '×');

  // Preview
  const plane = document.getElementById('ar-mp3d-preview-plane');
  if (plane) {
    const wrap = plane.parentElement;
    wrap.style.perspective = persp >= 4000 ? '' : `${persp}px`;
    wrap.style.perspectiveOrigin = '50% 50%';
    plane.style.transform = [
      `translateX(${ox}%)`, `translateY(${oy}%)`, `scale(${sc/100})`,
      `rotateZ(${rz}deg)`,  `rotateX(${rx}deg)`,  `rotateY(${ry}deg)`,
    ].join(' ');
  }
  // Grade de referência
  const svg = document.getElementById('ar-mp3d-grid-svg');
  if (svg) {
    const lines = [];
    for (let i = 1; i < 5; i++) {
      const p = (i * 20) + '%';
      lines.push(`<line x1="${p}" y1="0" x2="${p}" y2="100%" stroke="rgba(126,200,240,0.25)" stroke-width="0.5"/>`);
      lines.push(`<line x1="0" y1="${p}" x2="100%" y2="${p}" stroke="rgba(126,200,240,0.25)" stroke-width="0.5"/>`);
    }
    svg.innerHTML = lines.join('');
  }
  // Aplicar ao vivo na arena
  const arWrap = document.querySelector('#ar-mesa-bg .ar-iso-wrap');
  if (arWrap) mapaAplicarTransform3D(arWrap, {rx,ry,rz,persp,ox,oy,sc});
  // Profundidade nos tokens da arena
  if (document.getElementById('ar-mp3d-depth')?.checked) {
    document.querySelectorAll('.ar-mesa-token').forEach(el => {
      const posY = parseFloat(el.style.top) || 50;
      const ds = (0.72 + (posY / 100) * 0.50).toFixed(3);
      el.style.transform = `translate(-50%,-50%) scale(${ds})`;
    });
  }
}

function arPreset3D(preset) {
  const sets = {
    flat:     { rx:0,  ry:0, rz:0,  persp:4000, ox:0, oy:0, sc:100 },
    dimetric: { rx:60, ry:0, rz:45, persp:4000, ox:0, oy:0, sc:110 },
    iso:      { rx:54, ry:0, rz:45, persp:4000, ox:0, oy:0, sc:110 },
    reset:    { rx:0,  ry:0, rz:0,  persp:4000, ox:0, oy:0, sc:100 },
  };
  const s = sets[preset]; if (!s) return;
  const _set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  _set('ar-mp3d-rx', s.rx);  _set('ar-mp3d-ry', s.ry);   _set('ar-mp3d-rz', s.rz);
  _set('ar-mp3d-persp', s.persp); _set('ar-mp3d-ox', s.ox); _set('ar-mp3d-oy', s.oy); _set('ar-mp3d-sc', s.sc);
  arMp3dAtualizar();
}
// ════════════════════════════════════════════════════════════════════════════

function abrirModalArMapa() {
  const img = (AR.estado as any).cenario_img || '';
  document.getElementById('ar-mapa-img').value = img;
  const prev = document.getElementById('ar-mapa-img-preview');
  const prevWrap = document.getElementById('ar-mapa-img-preview-wrap');
  if (img && prev) { prev.src = img; prevWrap.style.display = 'block'; }
  else if (prevWrap) prevWrap.style.display = 'none';
  const input = document.getElementById('ar-mapa-img');
  if (input) {
    input.oninput = () => {
      const v = input.value.trim();
      if (v && prev) { prev.src = v; prevWrap.style.display = 'block'; }
      else if (prevWrap) prevWrap.style.display = 'none';
      // Atualizar preview 3D com nova imagem
      const pi = document.getElementById('ar-mp3d-preview-img');
      if (pi) pi.src = v;
    };
  }
  // Carregar valores 3D salvos
  const t3d = (AR.estado as any).transform3d || {};
  const _sv = (id, v, def) => { const el = document.getElementById(id); if (el) el.value = v ?? def; };
  _sv('ar-mp3d-rx',    t3d.rx    ?? 0,    0);
  _sv('ar-mp3d-ry',    t3d.ry    ?? 0,    0);
  _sv('ar-mp3d-rz',    t3d.rz    ?? 0,    0);
  _sv('ar-mp3d-persp', t3d.persp ?? 4000, 4000);
  _sv('ar-mp3d-ox',    t3d.ox    ?? 0,    0);
  _sv('ar-mp3d-oy',    t3d.oy    ?? 0,    0);
  _sv('ar-mp3d-sc',    t3d.sc    ?? 100,  100);
  const depthEl = document.getElementById('ar-mp3d-depth');
  if (depthEl) depthEl.checked = !!t3d.depth;
  const pi = document.getElementById('ar-mp3d-preview-img');
  if (pi) pi.src = img;
  arMp3dAtualizar();
  abrirModal('ar-modal-mapa');
}

async function salvarArMapa() {
  const img = (document.getElementById('ar-mapa-img')?.value || '').trim();
  (AR.estado as any).cenario_img = img;
  // Salvar configuração 3D no estado da arena
  const _gv = id => { const el = document.getElementById(id); return el ? +el.value : null; };
  const arT3d = {
    rx:    _gv('ar-mp3d-rx')    ?? 0,
    ry:    _gv('ar-mp3d-ry')    ?? 0,
    rz:    _gv('ar-mp3d-rz')    ?? 0,
    persp: _gv('ar-mp3d-persp') ?? 4000,
    ox:    _gv('ar-mp3d-ox')    ?? 0,
    oy:    _gv('ar-mp3d-oy')    ?? 0,
    sc:    _gv('ar-mp3d-sc')    ?? 100,
    depth: !!(document.getElementById('ar-mp3d-depth')?.checked),
  };
  (AR.estado as any).transform3d = arT3d;
  mesaAtualizarBackground();
  await arSalvarEstado();
  fecharModal('ar-modal-mapa');
  arToast('Mapa atualizado!', 'sucesso');
}

// ── MAPA DA ARENA: importar JSON ──────────────────────────────
function abrirModalArImportarMapa() {
  document.getElementById('ar-importar-mapa-json').value = '';
  const st = document.getElementById('ar-importar-mapa-status');
  if (st) st.style.display = 'none';
  abrirModal('ar-modal-importar-mapa');
}

async function executarArImportarMapa() {
  const raw = (document.getElementById('ar-importar-mapa-json')?.value || '').trim();
  const st  = document.getElementById('ar-importar-mapa-status');
  const showErr = (msg) => {
    if (!st) return;
    st.style.display = 'block';
    st.style.background = 'rgba(192,57,43,0.1)';
    st.style.color = '#e74c3c';
    st.style.border = '1px solid rgba(192,57,43,0.2)';
    st.textContent = msg;
  };
  const showOk = (msg) => {
    if (!st) return;
    st.style.display = 'block';
    st.style.background = 'rgba(46,204,113,0.1)';
    st.style.color = '#2ecc71';
    st.style.border = '1px solid rgba(46,204,113,0.2)';
    st.textContent = msg;
  };
  if (!raw) { showErr('Cole o JSON antes de importar.'); return; }

  let data;
  try {
    const cleaned = raw.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
    data = JSON.parse(cleaned);
  } catch(e) { showErr('JSON inválido: ' + e.message); return; }

  const mapa = Array.isArray(data) ? data[0] : data;
  if (!mapa) { showErr('Nenhum mapa encontrado no JSON.'); return; }

  // ── Imagem: suporte a SVG+JSON e config sem imagem ──
  let img = mapa.cenario_img || mapa.img_url || '';
  if (!img && mapa.svg && mapa.svg.trim().includes('<svg')) {
    const svgLimpo = mapa.svg.trim()
      .replace(/<script[\s\S]*?<\/script>/gi,'')
      .replace(/on\w+="[^"]*"/gi,'');
    try {
      img = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgLimpo)));
    } catch(e) {
      img = 'data:image/svg+xml,' + encodeURIComponent(svgLimpo);
    }
  }

  // ── Escala e grade (obrigatórios para config-only) ──
  const escVal  = parseFloat(mapa.escala_val) || null;
  const escUnit = mapa.escala_unit || null;
  const grid    = parseInt(mapa.grid) || null;

  // ── Aplicar configurações ──
  let aplicou = false;
  if (img) {
    (AR.estado as any).cenario_img = img;
    aplicou = true;
  }
  if (escVal)         { MESA.escala.val  = escVal;  aplicou = true; }
  if (escUnit)        { MESA.escala.unit = escUnit; aplicou = true; }
  if (grid !== null)  { MESA.escala.grid = grid;    aplicou = true; }

  if (!aplicou) {
    showErr('Nenhuma configuração válida encontrada. Verifique os campos: escala_val, grid, svg/img_url.');
    return;
  }

  mesaAtualizarBackground();
  mesaDesenharGrade();
  await arSalvarEstado();
  fecharModal('ar-modal-importar-mapa');

  const infoExtra = img ? '' : ' (sem imagem — adicione o fundo da mesa separadamente)';
  arToast(`Mapa configurado: ${mapa.nome || mapa.map_id || 'mapa'}${infoExtra}`, 'sucesso');
}

// ── RESIZE: redesenhar grade ao redimensionar ────────────────
let mesaResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(mesaResizeTimer);
  mesaResizeTimer = setTimeout(() => {
    mesaDesenharGrade();
    mesaRenderTokens();
  }, 120);
});

// ── MODAL: IMAGEM DE PERSONAGEM ──────────────────────────────
function abrirModalImg(nome) {
  const c = RPG_DATA.characters.find(x => x.nome === nome);
  if (!c) return;
  const ca = c.custom_attrs || {};
  const cor = ca.cor || 'var(--primario)';
  const img = ca.img || '';
  // Criar modal dinamicamente se não existir
  let m = document.getElementById('modal-img-personagem');
  if (!m) {
    m = document.createElement('div');
    m.id = 'modal-img-personagem';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:900;display:flex;align-items:flex-end;justify-content:center';
    m.innerHTML = `
      <div style="background:var(--escuro);border:1px solid var(--borda);border-top:2px solid var(--primario);border-radius:16px 16px 0 0;padding:24px 20px 44px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <div style="font-family:var(--fonte-d);font-size:0.9rem;color:var(--primario)">Foto do personagem</div>
          <button onclick="document.getElementById('modal-img-personagem').style.display='none'" style="background:none;border:none;color:var(--suave);font-size:1.4rem;cursor:pointer">✕</button>
        </div>
        <div style="text-align:center;margin-bottom:16px">
          <img id="modal-img-preview" src="" style="width:90px;height:90px;border-radius:50%;object-fit:cover;display:none;border:3px solid var(--primario)" onerror="this.style.display='none'">
          <div id="modal-img-placeholder" style="width:90px;height:90px;border-radius:50%;background:rgba(79,163,209,0.1);border:2px dashed rgba(79,163,209,0.3);display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:2rem">👤</div>
        </div>
        <div style="margin-bottom:16px">
          <label style="font-size:0.8rem;color:var(--suave);margin-bottom:6px;display:block">URL da imagem</label>
          <input type="text" id="modal-img-url" placeholder="Cole o link aqui (Google Drive aceito)" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:8px;padding:10px;color:var(--texto);font-size:0.9rem" oninput="modalImgPreview(this.value)">
        </div>
        <input type="hidden" id="modal-img-nome">
        <button class="btn btn-primario" onclick="salvarImgPersonagem()" style="width:100%;margin-bottom:8px">Salvar imagem</button>
        <button class="btn btn-secundario" onclick="document.getElementById('modal-img-personagem').style.display='none'" style="width:100%">Cancelar</button>
      </div>`;
    document.body.appendChild(m);
  }
  document.getElementById('modal-img-url').value = img;
  document.getElementById('modal-img-nome').value = nome;
  modalImgPreview(img);
  m.style.display = 'flex';
}

function modalImgPreview(url) {
  const normalized = normalizeImgUrl(url);
  const prev = document.getElementById('modal-img-preview');
  const ph = document.getElementById('modal-img-placeholder');
  if (normalized) {
    prev.src = normalized;
    prev.style.display = 'block';
    if (ph) ph.style.display = 'none';
  } else {
    prev.style.display = 'none';
    if (ph) ph.style.display = 'flex';
  }
}

function attrImgPreview(url, cor, targetId) {
  const normalized = normalizeImgUrl(url);
  const prev = document.getElementById(targetId || 'f-img-preview');
  if (!prev) return;
  if (normalized) { prev.src = normalized; prev.style.display = ''; }
  else prev.style.display = 'none';
}

async function salvarImgPersonagem() {
  const nome = document.getElementById('modal-img-nome').value;
  const url = (document.getElementById('modal-img-url').value || '').trim();
  const c = RPG_DATA.characters.find(x => x.nome === nome);
  if (!c) return;
  const ca = { ...(c.custom_attrs || {}) };
  ca.img = url;
  c.custom_attrs = ca;
  try {
    await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nome)}`, {
      method: 'PATCH', body: JSON.stringify({ custom_attrs: ca })
    });
    mostrarToast('Imagem salva!', 'sucesso');
    document.getElementById('modal-img-personagem').style.display = 'none';
    // Re-renderizar onde o personagem está visível
    if (CHAR_VIEW === nome) renderCharView(nome);
    if (ATTR_VIEW === nome) renderAttrView(nome);
    renderConfig();
    // Atualizar token no mapa se visível
    if (MAPA_STATE.mapaAtualId) {
      const mapas = RPG_DATA.mapas || [];
      const entry = mapas.find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
      if (entry) mapaRenderTokens(entry.mapa);
    }
  } catch(e) { mostrarToast('Erro ao salvar', 'erro'); }
}

// ═══════════════════════════════════════════════════════════════
// CRIAR BATALHA VIA IA — MODAL E PARSER
// ═══════════════════════════════════════════════════════════════

function abrirModalCriarBatalhaIA() {
  const isMestre = RPG_DATA?.myRole === 'mestre';
  if (!isMestre) { mostrarToast('Apenas o Mestre pode criar batalhas', 'erro'); return; }
  document.getElementById('batalha-ia-status').style.display = 'none';
  document.getElementById('batalha-ia-input').value = '';
  document.getElementById('modal-criar-batalha-overlay').style.display = 'flex';
}

function fecharModalCriarBatalha() {
  document.getElementById('modal-criar-batalha-overlay').style.display = 'none';
}

function copiarPromptBatalha() {
  const nomesCampanha = (RPG_DATA?.characters || [])
    .filter(c => !c.custom_attrs?.npc_generico)
    .map(c => c.nome).join(', ') || 'os personagens';
  const nomeCampanha = CURRENT_RPG?.nome || 'a campanha';
  const mapaAtual = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === MAPA_STATE?.mapaAtualId);
  const nomeLocal  = mapaAtual?.mapa?.nome || 'o local atual';

  const prompt = `Você é o Mestre da campanha "${nomeCampanha}". Com base no contexto narrativo atual, gere um JSON de batalha para o RPG Hub. O local da cena é: ${nomeLocal}.

Responda APENAS com o JSON, sem texto adicional, sem markdown, sem explicações.

━━━ VISUALIZAÇÃO — DIMÉTRICA ESTILO DIABLO 3 ━━━
Todos os mapas de batalha usam perspectiva dimétrica estilo Diablo 3:
câmera ortográfica (sem ponto de fuga), rotação Z 45°, inclinação X ~60°.
Eixo X cresce para direita-baixo; eixo Y cresce para esquerda-baixo.
Coordenadas 0,0 = canto superior-esquerdo (fundo da cena); 100,100 = canto inferior-direito (frente).
Personagens ficam na frente (y alto). Inimigos ao fundo (y baixo). Tática: use cobertura de paredes e altura.

O JSON deve seguir EXATAMENTE este schema:

{
  "submapa": "Nome curto e único do local (ex: Taverna do Lobo - Salão, Floresta das Sombras, Masmorra Nível 1)",
  "imagem_fundo_iso": null,
  "render_data": {
    "estilo": "dungeon" ou "edificio" ou "area_aberta",
    "descricao_visual": "Descrição tática isométrica: materiais de piso e parede, fontes de luz, pontos de cobertura, altura de teto ou vegetação, texturas dominantes, elementos ambientais marcantes",
    "comodos": [
      { "tipo": "sala",     "nome": "Salão Principal",  "x": 0,  "y": 4,  "w": 14, "h": 10, "cor": "#2a1e10" },
      { "tipo": "corredor", "nome": "Corredor Lateral",  "x": 14, "y": 6,  "w": 6,  "h": 3,  "cor": "#1a1208" },
      { "tipo": "sala",     "nome": "Cozinha",           "x": 20, "y": 2,  "w": 8,  "h": 8,  "cor": "#1e1508" },
      { "tipo": "sala",     "nome": "Porão",             "x": 0,  "y": 14, "w": 10, "h": 6,  "cor": "#100c08" }
    ],
    "saidas": [
      { "nome": "Porta da frente", "x_percent": 10, "y_percent": 90, "destino_map_id": null },
      { "nome": "Fuga pelos fundos", "x_percent": 85, "y_percent": 55, "destino_map_id": null }
    ],
    "biomas": [],
    "pontos_de_interesse": []
  },
  "personagens": [
    { "nome": "NOME_EXATO", "x": 20, "y": 70 }
  ],
  "inimigos": [
    { "nome": "Goblin Batedura",   "hp": 30, "hp_max": 30, "cor": "#c0392b", "x": 75, "y": 35, "ataque": "1d6+2", "descricao": "Goblin ágil com faca enferrujada" },
    { "nome": "Troll das Trevas",  "hp": 90, "hp_max": 90, "cor": "#8B0000", "x": 80, "y": 55, "ataque": "2d8+4", "descricao": "Troll regenerante, lento mas devastador" }
  ],
  "npcs_especiais": [
    { "nome": "Taberneiro Klaus", "hp": 15, "hp_max": 15, "cor": "#4fa3d1", "x": 45, "y": 50, "aliado": true, "descricao": "NPC aliado, pode ajudar ou fugir" }
  ]
}

REGRAS OBRIGATÓRIAS:

imagem_fundo_iso:
• Se você tiver capacidade de gerar imagem: gere um campo de batalha isométrico em PNG
  com fundo 100% transparente (canal alpha) e forneça a URL pública ou base64 aqui.
• Requisitos da imagem: perspectiva dimétrica estilo Diablo 3 (câmera ortográfica, rot Z 45°,
  inclinação X ~60°), iluminação superior-esquerda, sombras paralelas no chão, oclusão ambiental,
  máximo detalhe de textura e volume. Resolução mínima 1024×1024px.
  Prefira layer PNG separado do conteúdo tático. Apenas o visual final com máxima qualidade gráfica.
• Se não puder gerar imagem: deixe null.

render_data (cenário tático isométrico):
• Escolha estilo "dungeon" para masmorras/subterrâneos/ruínas, "edificio" para construções
  (taverna/castelo/loja), "area_aberta" para florestas/campos/ruas.
• "edificio"/"dungeon": crie 5 a 10 comodos[] formando um layout real — entrada, cômodos
  principais, corredores, saídas alternativas. Inclua rotas de fuga em saidas[].
• "area_aberta": use biomas[] (4-8 regiões) cobrindo toda a área e pontos_de_interesse[]
  para obstáculos, árvores, pedras, etc. Deixe comodos vazio.
• descricao_visual: descreva o local em perspectiva isométrica — materiais, iluminação,
  cobertura tática, diferenças de elevação, elementos de destaque visual.
• Pense taticamente em isométrico: atrás de quais paredes os inimigos se escondem?
  Quais colunas/muros oferecem cobertura? Há diferença de elevação aproveitável?
• saidas[]: SEMPRE pelo menos 2 — uma entrada principal e uma rota de fuga.

personagens:
• Liste apenas: ${nomesCampanha}. Use o nome EXATO.
• Posicione em grupo no inferior-esquerdo isométrico (x: 10-40, y: 50-80).

inimigos (NPCs genéricos — criados automaticamente no jogo):
• Nomes temáticos e únicos. Múltiplos do mesmo tipo: numere ("Goblin 1", "Goblin 2").
• x/y no lado oposto dos personagens (x: 55-90, y: 20-65).
• hp e hp_max: condizentes com a ameaça narrativa.
• ataque: fórmula de dados (ex: "1d6+2", "2d8"). Pode ser omitido.
• cor: hexadecimal (ex: #e74c3c vermelho, #8B0000 vermelho escuro).

npcs_especiais (NPCs aliados ou neutros importantes — opcional):
• NPCs com nome próprio relevantes à cena (aliados, informantes, vítimas).
• aliado: true para quem ajuda os players, false para neutros/hostis com personalidade.
• x/y: no cômodo narrativamente adequado.

x e y: SEMPRE número entre 0 e 100 (sem %).`;

  navigator.clipboard.writeText(prompt).then(() => {
    const label = document.getElementById('label-copiar-prompt-batalha');
    const ok    = document.getElementById('ok-copiar-prompt-batalha');
    label.style.display = 'none'; ok.style.display = 'inline';
    setTimeout(() => { label.style.display = 'inline'; ok.style.display = 'none'; }, 2500);
  }).catch(() => mostrarToast('Não foi possível copiar', 'erro'));
}

function _parseBatalhaCSV(csv) {
  const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV inválido: mínimo 2 linhas (cabeçalho + dados)');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows = lines.slice(1).map(l => {
    const cols = l.split(',').map(c => c.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
    return obj;
  });
  const personagens = [], inimigos = [], npcs_especiais = [];
  let submapa = null;
  rows.forEach(r => {
    if (!submapa && r.submapa) submapa = r.submapa;
    const ent = {
      nome:   r.nome || r.name || '',
      x:      parseFloat(r.x) || 50,
      y:      parseFloat(r.y) || 50,
      hp:     r.hp     ? parseInt(r.hp)     : undefined,
      hp_max: r.hp_max ? parseInt(r.hp_max) : undefined,
      cor:    r.cor || r.color || r.colour || undefined,
    };
    const tipo = (r.tipo || r.type || '').toLowerCase();
    if      (tipo === 'npc_especial' || tipo === 'aliado') npcs_especiais.push({ ...ent, aliado: tipo === 'aliado' });
    else if (tipo === 'inimigo' || tipo === 'criatura' || tipo === 'npc' || tipo === 'enemy') inimigos.push(ent);
    else    personagens.push(ent);
  });
  return { submapa: submapa || 'Batalha', personagens, inimigos, npcs_especiais };
}

async function importarBatalhaIA() {
  const raw = document.getElementById('batalha-ia-input').value.trim();
  const statusEl = document.getElementById('batalha-ia-status');

  const mostrarErro = msg => {
    statusEl.style.display = 'block';
    statusEl.style.background = 'rgba(192,57,43,0.1)';
    statusEl.style.color = '#e74c3c';
    statusEl.style.border = '1px solid rgba(192,57,43,0.25)';
    statusEl.textContent = '✕ ' + msg;
  };

  if (!raw) { mostrarErro('Cole o JSON ou CSV antes de importar.'); return; }

  let batalha;
  try {
    const jsonRaw = raw.replace(/^```[a-z]*\n?/,'').replace(/```$/,'').trim();
    batalha = JSON.parse(jsonRaw);
  } catch (_) {
    try { batalha = _parseBatalhaCSV(raw); }
    catch (e) { mostrarErro('Formato inválido: ' + e.message); return; }
  }

  const { submapa: nomeSubmapa, personagens = [], inimigos = [], npcs_especiais = [], render_data } = batalha;
  if (!nomeSubmapa) { mostrarErro('Campo "submapa" não encontrado.'); return; }
  if (!personagens.length && !inimigos.length && !npcs_especiais.length) {
    mostrarErro('Nenhuma entidade encontrada.'); return;
  }

  statusEl.style.display = 'block';
  statusEl.style.background = 'rgba(176,126,240,0.08)';
  statusEl.style.color = '#b07ef0';
  statusEl.style.border = '1px solid rgba(176,126,240,0.2)';
  statusEl.textContent = '⏳ Processando…';

  const rpgId     = RPG_DATA?.rpgId;
  const mapaAtualId = MAPA_STATE?.mapaAtualId || null;

  // ── 1. Criar ou sobrescrever submapa ────────────────────────────────────
  const mapId    = 'batalha_' + nomeSubmapa.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,30) + '_' + Date.now().toString(36).slice(-4);
  const existente = (RPG_DATA.mapas || []).find(l => l.mapa.nome === nomeSubmapa && l.mapa.tipo === 'local');

  let subMapId;
  if (existente) {
    subMapId = existente.mapa.map_id;
    // Atualizar render_data se veio novo
    if (render_data) {
      existente.mapa.render_data = render_data;
      try {
        await sb(`mapas?id=eq.${existente.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ render_data })
        });
      } catch(_) {}
    }
    mostrarToast(`Submapa "${nomeSubmapa}" encontrado — atualizando`, 'info');
  } else {
    try {
      const mapaPayload: any = {
        rpg_id:         rpgId,
        map_id:         mapId,
        nome:           nomeSubmapa,
        tipo:           'local',
        img_url:        '',
        escala_val:     1.5,
        escala_unit:    'm',
        grid:           20,
        parent_map_id:  mapaAtualId,
        zona_w_percent: 20,
        zona_h_percent: 20,
        locais:         [],
      };
      if (render_data) mapaPayload.render_data = render_data;
      const [row] = await sb('mapas', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(mapaPayload)
      });
      subMapId = mapId;
      const mapaObj = {
        map_id: mapId, nome: nomeSubmapa, tipo: 'local',
        parent_map_id: mapaAtualId, locais: [],
        ...(render_data ? { render_data } : {}),
      };
      RPG_DATA.mapas.push({ id: row?.id, rpg_id: rpgId, mapa: mapaObj });
    } catch(e) {
      mostrarErro('Erro ao criar submapa: ' + e.message);
      return;
    }
  }

  let ok = 0, erros = [];

  // ── 2. Posicionar personagens dos players ────────────────────────────────
  for (const p of personagens) {
    const char = (RPG_DATA.characters || []).find(c => c.nome === p.nome);
    if (!char) { erros.push(p.nome + ' (não encontrado)'); continue; }
    const ca = char.custom_attrs || {};
    if (!ca.map_positions) ca.map_positions = {};
    ca.map_positions[subMapId] = pctParaCelula(p.x, p.y, subMapId);
    char.active_map_id = subMapId;
    try {
      await sb(`characters?id=eq.${char.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active_map_id: subMapId, map_positions: ca.map_positions, custom_attrs: ca })
      });
      ok++;
    } catch(e) { erros.push(p.nome + ' (erro ao salvar)'); }
  }

  // ── 3. Criar/posicionar inimigos como NPCs genéricos ────────────────────
  for (const ini of inimigos) {
    let char = (RPG_DATA.characters || []).find(c => c.nome === ini.nome && c.custom_attrs?.npc_generico);
    if (!char) {
      const hpMax = ini.hp_max || ini.hp || 30;
      const novoCa = {
        tipo_personagem: 'npc',          // ← campo que o sistema usa para isNpc
        tipo:            'npc',
        npc_generico:    true,
        nome_base:       ini.nome,
        cor:             ini.cor || '#c0392b',
        hp_max:          hpMax,
        map_positions:   { [subMapId]: pctParaCelula(ini.x, ini.y, subMapId) },
        atributos:       {},
        ...(ini.ataque    ? { ataque_padrao: ini.ataque }        : {}),
        ...(ini.descricao ? { descricao: ini.descricao }         : {}),
      };
      try {
        const [row] = await sb('characters', {
          method:  'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify({
            rpg_id:        rpgId,
            nome:          ini.nome,
            hp_atual:      ini.hp || hpMax,
            active_map_id: subMapId,
            custom_attrs:  novoCa,
            map_positions: novoCa.map_positions,
          })
        });
        if (row) {
          RPG_DATA.characters.push({   // pseudo-personagem sintético da arena (parcial por design)
            id: row.id, nome: ini.nome, hp_atual: ini.hp || hpMax,
            active_map_id: subMapId, map_positions: novoCa.map_positions,
            custom_attrs: novoCa
          } as any);
          ok++;
        }
      } catch(e) { erros.push(ini.nome + ' (erro ao criar NPC)'); }
    } else {
      // Reposicionar NPC genérico já existente
      const ca = char.custom_attrs || {};
      if (!ca.map_positions) ca.map_positions = {};
      ca.map_positions[subMapId] = pctParaCelula(ini.x, ini.y, subMapId);
      char.active_map_id = subMapId;
      if (ini.hp) char.hp_atual = ini.hp;
      try {
        await sb(`characters?id=eq.${char.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ active_map_id: subMapId, map_positions: ca.map_positions, custom_attrs: ca, hp_atual: char.hp_atual })
        });
        ok++;
      } catch(e) { erros.push(ini.nome + ' (erro ao reposicionar)'); }
    }
  }

  // ── 4. Criar/posicionar NPCs especiais ──────────────────────────────────
  for (const npc of npcs_especiais) {
    let char = (RPG_DATA.characters || []).find(c => c.nome === npc.nome);
    if (!char) {
      const hpMax = npc.hp_max || npc.hp || 20;
      const novoCa = {
        tipo_personagem: 'npc',
        tipo:            'npc',
        npc_generico:    false,           // ← NPC especial, não genérico
        nome_base:       npc.nome,
        cor:             npc.cor || (npc.aliado ? '#4fa3d1' : '#e8a020'),
        hp_max:          hpMax,
        aliado:          npc.aliado || false,
        map_positions:   { [subMapId]: pctParaCelula(npc.x, npc.y, subMapId) },
        atributos:       {},
        ...(npc.descricao ? { descricao: npc.descricao } : {}),
      };
      try {
        const [row] = await sb('characters', {
          method:  'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify({
            rpg_id:        rpgId,
            nome:          npc.nome,
            hp_atual:      npc.hp || hpMax,
            active_map_id: subMapId,
            custom_attrs:  novoCa,
            map_positions: novoCa.map_positions,
          })
        });
        if (row) {
          RPG_DATA.characters.push({   // pseudo-personagem sintético da arena (parcial por design)
            id: row.id, nome: npc.nome, hp_atual: npc.hp || hpMax,
            active_map_id: subMapId, map_positions: novoCa.map_positions,
            custom_attrs: novoCa
          } as any);
          ok++;
        }
      } catch(e) { erros.push(npc.nome + ' (erro ao criar NPC especial)'); }
    } else {
      // Reposicionar NPC especial existente
      const ca = char.custom_attrs || {};
      if (!ca.map_positions) ca.map_positions = {};
      ca.map_positions[subMapId] = { x: npc.x, y: npc.y };
      char.active_map_id = subMapId;
      if (npc.hp) char.hp_atual = npc.hp;
      try {
        await sb(`characters?id=eq.${char.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ active_map_id: subMapId, map_positions: ca.map_positions, custom_attrs: ca, hp_atual: char.hp_atual })
        });
        ok++;
      } catch(e) { erros.push(npc.nome + ' (erro ao reposicionar NPC especial)'); }
    }
  }

  // ── 5. Navegar para o submapa criado ────────────────────────────────────
  if (typeof selecionarMapa    === 'function') selecionarMapa(subMapId);
  if (typeof renderMapasTab    === 'function') renderMapasTab();
  if (typeof mapaRenderTokens  === 'function') {
    const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === subMapId);
    if (entry) mapaRenderTokens(entry.mapa);
  }
  if (typeof mapaRenderStatus  === 'function') mapaRenderStatus();
  if (typeof mapaRenderCanvas  === 'function') {
    const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === subMapId);
    if (entry?.mapa?.render_data) setTimeout(() => mapaRenderCanvas(entry.mapa), 100);
  }

  // ── 6. Feedback final ────────────────────────────────────────────────────
  fecharModalCriarBatalha();
  const erroStr = erros.length ? ` (Atenção: ${erros.join(', ')})` : '';
  const totalNpcs = inimigos.length + npcs_especiais.length;
  mostrarToast(`✅ Batalha "${nomeSubmapa}" criada! ${personagens.length} player(s), ${totalNpcs} NPC(s).${erroStr}`, erros.length ? 'aviso' : 'sucesso');
}

// ═══════════════════════════════════════════════════════════════

/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "AR", { configurable: true, get: () => AR, set: (__v) => { AR = __v; } });
Object.defineProperty(globalThis, "AR_CORES", { configurable: true, get: () => AR_CORES });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirArenaHub", { configurable: true, get: () => abrirArenaHub, set: (__v) => { abrirArenaHub = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharArenaHub", { configurable: true, get: () => fecharArenaHub, set: (__v) => { fecharArenaHub = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "sairArenaSession", { configurable: true, get: () => sairArenaSession, set: (__v) => { sairArenaSession = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arTab", { configurable: true, get: () => arTab, set: (__v) => { arTab = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arSb", { configurable: true, get: () => arSb, set: (__v) => { arSb = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "sbAnon", { configurable: true, get: () => sbAnon, set: (__v) => { sbAnon = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "carregarArenaList", { configurable: true, get: () => carregarArenaList, set: (__v) => { carregarArenaList = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "criarArenaSession", { configurable: true, get: () => criarArenaSession, set: (__v) => { criarArenaSession = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arEntrarArenaAposCriacao", { configurable: true, get: () => arEntrarArenaAposCriacao, set: (__v) => { arEntrarArenaAposCriacao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalCriarArena", { configurable: true, get: () => abrirModalCriarArena, set: (__v) => { abrirModalCriarArena = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arAdicionarPenalidadeRow", { configurable: true, get: () => arAdicionarPenalidadeRow, set: (__v) => { arAdicionarPenalidadeRow = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arCopiarCodigo", { configurable: true, get: () => arCopiarCodigo, set: (__v) => { arCopiarCodigo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arEntrarPorCodigo", { configurable: true, get: () => arEntrarPorCodigo, set: (__v) => { arEntrarPorCodigo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "entrarArena", { configurable: true, get: () => entrarArena, set: (__v) => { entrarArena = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arAtualizarUIpeloPapel", { configurable: true, get: () => arAtualizarUIpeloPapel, set: (__v) => { arAtualizarUIpeloPapel = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arCarregarTudo", { configurable: true, get: () => arCarregarTudo, set: (__v) => { arCarregarTudo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderArenaPersonagens", { configurable: true, get: () => renderArenaPersonagens, set: (__v) => { renderArenaPersonagens = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderArenaEntidades", { configurable: true, get: () => renderArenaEntidades, set: (__v) => { renderArenaEntidades = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arCharCardHTML", { configurable: true, get: () => arCharCardHTML, set: (__v) => { arCharCardHTML = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderArenaCenario", { configurable: true, get: () => renderArenaCenario, set: (__v) => { renderArenaCenario = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "salvarCenario", { configurable: true, get: () => salvarCenario, set: (__v) => { salvarCenario = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "atkResumoBuff", { configurable: true, get: () => atkResumoBuff, set: (__v) => { atkResumoBuff = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderArenaEfeitos", { configurable: true, get: () => renderArenaEfeitos, set: (__v) => { renderArenaEfeitos = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderArenaLog", { configurable: true, get: () => renderArenaLog, set: (__v) => { renderArenaLog = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderArenaD100Hist", { configurable: true, get: () => renderArenaD100Hist, set: (__v) => { renderArenaD100Hist = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderArenaConfig", { configurable: true, get: () => renderArenaConfig, set: (__v) => { renderArenaConfig = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arCopiarCodigoCfg", { configurable: true, get: () => arCopiarCodigoCfg, set: (__v) => { arCopiarCodigoCfg = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalHP", { configurable: true, get: () => abrirModalHP, set: (__v) => { abrirModalHP = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arHpSliderChange", { configurable: true, get: () => arHpSliderChange, set: (__v) => { arHpSliderChange = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arHpDelta", { configurable: true, get: () => arHpDelta, set: (__v) => { arHpDelta = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arAtualizarBarraHP", { configurable: true, get: () => arAtualizarBarraHP, set: (__v) => { arAtualizarBarraHP = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "confirmarHP", { configurable: true, get: () => confirmarHP, set: (__v) => { confirmarHP = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalCriarChar", { configurable: true, get: () => abrirModalCriarChar, set: (__v) => { abrirModalCriarChar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalEditarChar", { configurable: true, get: () => abrirModalEditarChar, set: (__v) => { abrirModalEditarChar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderCoresSwatch", { configurable: true, get: () => renderCoresSwatch, set: (__v) => { renderCoresSwatch = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "selecionarCor", { configurable: true, get: () => selecionarCor, set: (__v) => { selecionarCor = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "getCorSelecionada", { configurable: true, get: () => getCorSelecionada, set: (__v) => { getCorSelecionada = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "salvarChar", { configurable: true, get: () => salvarChar, set: (__v) => { salvarChar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "deletarChar", { configurable: true, get: () => deletarChar, set: (__v) => { deletarChar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arEfToggle", { configurable: true, get: () => arEfToggle, set: (__v) => { arEfToggle = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arEfSelectGroup", { configurable: true, get: () => arEfSelectGroup, set: (__v) => { arEfSelectGroup = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arEfTipoChange", { configurable: true, get: () => arEfTipoChange, set: (__v) => { arEfTipoChange = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalCriarEfeito", { configurable: true, get: () => abrirModalCriarEfeito, set: (__v) => { abrirModalCriarEfeito = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "salvarEfeito", { configurable: true, get: () => salvarEfeito, set: (__v) => { salvarEfeito = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "removerEfeito", { configurable: true, get: () => removerEfeito, set: (__v) => { removerEfeito = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "avancarTurno", { configurable: true, get: () => avancarTurno, set: (__v) => { avancarTurno = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalLog", { configurable: true, get: () => abrirModalLog, set: (__v) => { abrirModalLog = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "adicionarLogManual", { configurable: true, get: () => adicionarLogManual, set: (__v) => { adicionarLogManual = __v; } });
Object.defineProperty(globalThis, "AR_DADO_SEL", { configurable: true, get: () => AR_DADO_SEL, set: (__v) => { AR_DADO_SEL = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "getArenaDiceConfig", { configurable: true, get: () => getArenaDiceConfig, set: (__v) => { getArenaDiceConfig = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "setArenaDiceConfig", { configurable: true, get: () => setArenaDiceConfig, set: (__v) => { setArenaDiceConfig = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderArenaDados", { configurable: true, get: () => renderArenaDados, set: (__v) => { renderArenaDados = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderArenaDiceConfig", { configurable: true, get: () => renderArenaDiceConfig, set: (__v) => { renderArenaDiceConfig = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "toggleDadoArena", { configurable: true, get: () => toggleDadoArena, set: (__v) => { toggleDadoArena = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arSelecionarDado", { configurable: true, get: () => arSelecionarDado, set: (__v) => { arSelecionarDado = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arRolarDadoSel", { configurable: true, get: () => arRolarDadoSel, set: (__v) => { arRolarDadoSel = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "svgDadoArena", { configurable: true, get: () => svgDadoArena, set: (__v) => { svgDadoArena = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arRolarD100", { configurable: true, get: () => arRolarD100, set: (__v) => { arRolarD100 = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "salvarHistoricoArena", { configurable: true, get: () => salvarHistoricoArena, set: (__v) => { salvarHistoricoArena = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "resetarBatalha", { configurable: true, get: () => resetarBatalha, set: (__v) => { resetarBatalha = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arResetToggleOpcao", { configurable: true, get: () => arResetToggleOpcao, set: (__v) => { arResetToggleOpcao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "verHistorico", { configurable: true, get: () => verHistorico, set: (__v) => { verHistorico = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "confirmarDeletarArena", { configurable: true, get: () => confirmarDeletarArena, set: (__v) => { confirmarDeletarArena = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arAddLog", { configurable: true, get: () => arAddLog, set: (__v) => { arAddLog = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arSalvarEstado", { configurable: true, get: () => arSalvarEstado, set: (__v) => { arSalvarEstado = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arIniciarRealtime", { configurable: true, get: () => arIniciarRealtime, set: (__v) => { arIniciarRealtime = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arFecharRealtime", { configurable: true, get: () => arFecharRealtime, set: (__v) => { arFecharRealtime = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModal", { configurable: true, get: () => abrirModal, set: (__v) => { abrirModal = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharModal", { configurable: true, get: () => fecharModal, set: (__v) => { fecharModal = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalCenario", { configurable: true, get: () => abrirModalCenario, set: (__v) => { abrirModalCenario = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalResetBatalha", { configurable: true, get: () => abrirModalResetBatalha, set: (__v) => { abrirModalResetBatalha = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalProporCenario", { configurable: true, get: () => abrirModalProporCenario, set: (__v) => { abrirModalProporCenario = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalSolicitarEntidade", { configurable: true, get: () => abrirModalSolicitarEntidade, set: (__v) => { abrirModalSolicitarEntidade = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalVincular", { configurable: true, get: () => abrirModalVincular, set: (__v) => { abrirModalVincular = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arVincularSel", { configurable: true, get: () => arVincularSel, set: (__v) => { arVincularSel = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arConfirmarVinculo", { configurable: true, get: () => arConfirmarVinculo, set: (__v) => { arConfirmarVinculo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arPreviewCenarioImg", { configurable: true, get: () => arPreviewCenarioImg, set: (__v) => { arPreviewCenarioImg = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arImportarCenarioJSON", { configurable: true, get: () => arImportarCenarioJSON, set: (__v) => { arImportarCenarioJSON = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arImportarCenarioArquivo", { configurable: true, get: () => arImportarCenarioArquivo, set: (__v) => { arImportarCenarioArquivo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arImportarPropostaCenarioJSON", { configurable: true, get: () => arImportarPropostaCenarioJSON, set: (__v) => { arImportarPropostaCenarioJSON = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arToast", { configurable: true, get: () => arToast, set: (__v) => { arToast = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arChatToggle", { configurable: true, get: () => arChatToggle, set: (__v) => { arChatToggle = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arSincronizarChatBadge", { configurable: true, get: () => arSincronizarChatBadge, set: (__v) => { arSincronizarChatBadge = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arSliderUpdate", { configurable: true, get: () => arSliderUpdate, set: (__v) => { arSliderUpdate = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arCriarMeuPersonagem", { configurable: true, get: () => arCriarMeuPersonagem, set: (__v) => { arCriarMeuPersonagem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arAbrirAparencia", { configurable: true, get: () => arAbrirAparencia, set: (__v) => { arAbrirAparencia = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arEnviarPropostaCenario", { configurable: true, get: () => arEnviarPropostaCenario, set: (__v) => { arEnviarPropostaCenario = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderPropostasCenario", { configurable: true, get: () => renderPropostasCenario, set: (__v) => { renderPropostasCenario = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arAprovarPropostaCenario", { configurable: true, get: () => arAprovarPropostaCenario, set: (__v) => { arAprovarPropostaCenario = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arRejeitarPropostaCenario", { configurable: true, get: () => arRejeitarPropostaCenario, set: (__v) => { arRejeitarPropostaCenario = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arEnviarSolicitacaoEntidade", { configurable: true, get: () => arEnviarSolicitacaoEntidade, set: (__v) => { arEnviarSolicitacaoEntidade = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderSolicitacoesEntidade", { configurable: true, get: () => renderSolicitacoesEntidade, set: (__v) => { renderSolicitacoesEntidade = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arAprovarEntidade", { configurable: true, get: () => arAprovarEntidade, set: (__v) => { arAprovarEntidade = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arRejeitarEntidade", { configurable: true, get: () => arRejeitarEntidade, set: (__v) => { arRejeitarEntidade = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalBulkCriaturas", { configurable: true, get: () => abrirModalBulkCriaturas, set: (__v) => { abrirModalBulkCriaturas = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderBulkCriaturas", { configurable: true, get: () => renderBulkCriaturas, set: (__v) => { renderBulkCriaturas = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arBulkAddCriatura", { configurable: true, get: () => arBulkAddCriatura, set: (__v) => { arBulkAddCriatura = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arBulkRemoveCriatura", { configurable: true, get: () => arBulkRemoveCriatura, set: (__v) => { arBulkRemoveCriatura = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arBulkCriarCriaturas", { configurable: true, get: () => arBulkCriarCriaturas, set: (__v) => { arBulkCriarCriaturas = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderArenaIniciativaUI", { configurable: true, get: () => renderArenaIniciativaUI, set: (__v) => { renderArenaIniciativaUI = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderListaRolagem", { configurable: true, get: () => renderListaRolagem, set: (__v) => { renderListaRolagem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderOrdemCombate", { configurable: true, get: () => renderOrdemCombate, set: (__v) => { renderOrdemCombate = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arMeuChar", { configurable: true, get: () => arMeuChar, set: (__v) => { arMeuChar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "hexToRgb", { configurable: true, get: () => hexToRgb, set: (__v) => { hexToRgb = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arDarVezPara", { configurable: true, get: () => arDarVezPara, set: (__v) => { arDarVezPara = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arIniciarIniciativa", { configurable: true, get: () => arIniciarIniciativa, set: (__v) => { arIniciarIniciativa = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalArenaIniciativa", { configurable: true, get: () => abrirModalArenaIniciativa, set: (__v) => { abrirModalArenaIniciativa = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arRolarIniciativaModal", { configurable: true, get: () => arRolarIniciativaModal, set: (__v) => { arRolarIniciativaModal = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arConfirmarIniciativa", { configurable: true, get: () => arConfirmarIniciativa, set: (__v) => { arConfirmarIniciativa = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arCalcularOrdemIniciativa", { configurable: true, get: () => arCalcularOrdemIniciativa, set: (__v) => { arCalcularOrdemIniciativa = __v; } });
Object.defineProperty(globalThis, "_charMorto", { configurable: true, get: () => _charMorto });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arProximoTurnoIniciativa", { configurable: true, get: () => arProximoTurnoIniciativa, set: (__v) => { arProximoTurnoIniciativa = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arEncerrarBatalhaIniciativa", { configurable: true, get: () => arEncerrarBatalhaIniciativa, set: (__v) => { arEncerrarBatalhaIniciativa = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arInserirCriaturaIniciativa", { configurable: true, get: () => arInserirCriaturaIniciativa, set: (__v) => { arInserirCriaturaIniciativa = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arAcaoAtacar", { configurable: true, get: () => arAcaoAtacar, set: (__v) => { arAcaoAtacar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arAcaoPassar", { configurable: true, get: () => arAcaoPassar, set: (__v) => { arAcaoPassar = __v; } });
Object.defineProperty(globalThis, "AR_MESA_DADO_SEL", { configurable: true, get: () => AR_MESA_DADO_SEL, set: (__v) => { AR_MESA_DADO_SEL = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arMesaRenderDados", { configurable: true, get: () => arMesaRenderDados, set: (__v) => { arMesaRenderDados = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arMesaSelecionarDado", { configurable: true, get: () => arMesaSelecionarDado, set: (__v) => { arMesaSelecionarDado = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arMesaRolarDado", { configurable: true, get: () => arMesaRolarDado, set: (__v) => { arMesaRolarDado = __v; } });
Object.defineProperty(globalThis, "MESA", { configurable: true, get: () => MESA, set: (__v) => { MESA = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaZoomApply", { configurable: true, get: () => mesaZoomApply, set: (__v) => { mesaZoomApply = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaZoomReset", { configurable: true, get: () => mesaZoomReset, set: (__v) => { mesaZoomReset = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaZoomSet", { configurable: true, get: () => mesaZoomSet, set: (__v) => { mesaZoomSet = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaZoomInit", { configurable: true, get: () => mesaZoomInit, set: (__v) => { mesaZoomInit = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderMesa", { configurable: true, get: () => renderMesa, set: (__v) => { renderMesa = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaAtualizarBackground", { configurable: true, get: () => mesaAtualizarBackground, set: (__v) => { mesaAtualizarBackground = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaDesenharGrade", { configurable: true, get: () => mesaDesenharGrade, set: (__v) => { mesaDesenharGrade = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaRenderTokens", { configurable: true, get: () => mesaRenderTokens, set: (__v) => { mesaRenderTokens = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaCriarToken", { configurable: true, get: () => mesaCriarToken, set: (__v) => { mesaCriarToken = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaIniciarDrag", { configurable: true, get: () => mesaIniciarDrag, set: (__v) => { mesaIniciarDrag = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaOnDrag", { configurable: true, get: () => mesaOnDrag, set: (__v) => { mesaOnDrag = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaFimDrag", { configurable: true, get: () => mesaFimDrag, set: (__v) => { mesaFimDrag = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "toggleMesaTool", { configurable: true, get: () => toggleMesaTool, set: (__v) => { toggleMesaTool = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaClicarToken", { configurable: true, get: () => mesaClicarToken, set: (__v) => { mesaClicarToken = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaCalcularDistancia", { configurable: true, get: () => mesaCalcularDistancia, set: (__v) => { mesaCalcularDistancia = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaRenderDistLine", { configurable: true, get: () => mesaRenderDistLine, set: (__v) => { mesaRenderDistLine = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "limparMedicaoArena", { configurable: true, get: () => limparMedicaoArena, set: (__v) => { limparMedicaoArena = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaRenderEfeitosRow", { configurable: true, get: () => mesaRenderEfeitosRow, set: (__v) => { mesaRenderEfeitosRow = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaRenderStatus", { configurable: true, get: () => mesaRenderStatus, set: (__v) => { mesaRenderStatus = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalEscala", { configurable: true, get: () => abrirModalEscala, set: (__v) => { abrirModalEscala = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "salvarEscala", { configurable: true, get: () => salvarEscala, set: (__v) => { salvarEscala = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arMp3dAtualizar", { configurable: true, get: () => arMp3dAtualizar, set: (__v) => { arMp3dAtualizar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arPreset3D", { configurable: true, get: () => arPreset3D, set: (__v) => { arPreset3D = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalArMapa", { configurable: true, get: () => abrirModalArMapa, set: (__v) => { abrirModalArMapa = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "salvarArMapa", { configurable: true, get: () => salvarArMapa, set: (__v) => { salvarArMapa = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalArImportarMapa", { configurable: true, get: () => abrirModalArImportarMapa, set: (__v) => { abrirModalArImportarMapa = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "executarArImportarMapa", { configurable: true, get: () => executarArImportarMapa, set: (__v) => { executarArImportarMapa = __v; } });
Object.defineProperty(globalThis, "mesaResizeTimer", { configurable: true, get: () => mesaResizeTimer, set: (__v) => { mesaResizeTimer = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalImg", { configurable: true, get: () => abrirModalImg, set: (__v) => { abrirModalImg = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "modalImgPreview", { configurable: true, get: () => modalImgPreview, set: (__v) => { modalImgPreview = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "attrImgPreview", { configurable: true, get: () => attrImgPreview, set: (__v) => { attrImgPreview = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "salvarImgPersonagem", { configurable: true, get: () => salvarImgPersonagem, set: (__v) => { salvarImgPersonagem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalCriarBatalhaIA", { configurable: true, get: () => abrirModalCriarBatalhaIA, set: (__v) => { abrirModalCriarBatalhaIA = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharModalCriarBatalha", { configurable: true, get: () => fecharModalCriarBatalha, set: (__v) => { fecharModalCriarBatalha = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "copiarPromptBatalha", { configurable: true, get: () => copiarPromptBatalha, set: (__v) => { copiarPromptBatalha = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_parseBatalhaCSV", { configurable: true, get: () => _parseBatalhaCSV, set: (__v) => { _parseBatalhaCSV = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "importarBatalhaIA", { configurable: true, get: () => importarBatalhaIA, set: (__v) => { importarBatalhaIA = __v; } });
