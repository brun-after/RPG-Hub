// chat/chat.js
// RPG Hub — Chat system via Supabase Realtime Broadcast
// Includes: chat serialization/persistence, rendering, send/receive, online presence


// ═══════════════════════════════════════════════════════════════
// 💬 CHAT — Mensagens via Supabase Realtime Broadcast (sem tabela dedicada)
// ═══════════════════════════════════════════════════════════════

// ── Chat: persistência (localStorage + 1 linha no lore, cap 1000 chars) ──
const CHAT_TTL       = 60 * 60 * 1000; // 1 hora
const CHAT_CHAR_CAP  = 1000;            // cap de caracteres no banco
const CHAT_LORE_SEC  = 'chat_cache';

// Serializa mensagens para string compacta, cortando as mais antigas
// até caber em CHAT_CHAR_CAP caracteres
function chatSerializar(msgs) {
  const agora = Date.now();
  let recentes = msgs.filter(m => agora - (m.ts || 0) < CHAT_TTL);
  // Descarta mais antigas até caber no cap
  while (recentes.length > 0) {
    const s = JSON.stringify(recentes);
    if (s.length <= CHAT_CHAR_CAP) break;
    recentes.shift(); // remove a mais antiga
  }
  return JSON.stringify(recentes);
}

function chatSalvarLocal(rpgId, msgs) {
  try { localStorage.setItem('chat_hist_' + rpgId, chatSerializar(msgs)); } catch(e) {}
}
function chatLerLocal(rpgId) {
  try {
    const raw = localStorage.getItem('chat_hist_' + rpgId);
    if (!raw) return [];
    const agora = Date.now();
    return JSON.parse(raw).filter(m => agora - (m.ts || 0) < CHAT_TTL);
  } catch(e) { return []; }
}

// Salva no banco (debounced — máx 1 write a cada 30s)
CHAT._saveTimer   = null;
CHAT._loreId      = null; // id da linha lore já existente

function chatAgendarSalvoBanco() {
  if (CHAT._saveTimer) return; // já agendado
  CHAT._saveTimer = setTimeout(async () => {
    CHAT._saveTimer = null;
    if (!CHAT.rpgId) return;
    const conteudo = chatSerializar(CHAT.msgs);
    try {
      if (CHAT._loreId) {
        // Atualiza linha existente
        await sb(`lore?id=eq.${encodeURIComponent(CHAT._loreId)}`,
          { method: 'PATCH', body: JSON.stringify({ conteudo }) });
      } else {
        // Cria linha nova (pode já existir por race condition — ignora erro)
        const [row] = await sb('lore', {
          method: 'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify({ rpg_id: CHAT.rpgId, secao: CHAT_LORE_SEC, titulo: '_cache', conteudo })
        });
        if (row?.id) CHAT._loreId = row.id;
      }
    } catch(e) {} // falha silenciosa — localStorage ainda tem os dados
  }, 30000); // 30 segundos
}

async function chatCarregarDoBanco(rpgId) {
  try {
    const rows = await sb(`lore?rpg_id=eq.${encodeURIComponent(rpgId)}&secao=eq.${CHAT_LORE_SEC}&limit=1`);
    if (!rows?.length) return [];
    CHAT._loreId = rows[0].id;
    const agora = Date.now();
    return JSON.parse(rows[0].conteudo || '[]').filter(m => agora - (m.ts || 0) < CHAT_TTL);
  } catch(e) { return []; }
}

async function chatIniciar(rpgId, wsRef) {
  if (!wsRef) return;
  CHAT._loreId = null;
  // 1) Carrega localStorage imediatamente (sem latência)
  const local = chatLerLocal(rpgId);
  CHAT.msgs = local; CHAT.naoLidos = 0; CHAT.rpgId = rpgId; CHAT.online = [];
  chatRenderizar();
  // 2) Em paralelo, busca do banco (pode ter msgs de outros dispositivos)
  chatCarregarDoBanco(rpgId).then(banco => {
    if (!banco.length) return;
    // Mescla: une local + banco, remove duplicatas por ts+autor+texto, ordena
    const mapa = new Map();
    [...local, ...banco].forEach(m => mapa.set(`${m.ts}_${m.autor}_${m.texto}`, m));
    const merged = [...mapa.values()].sort((a, b) => (a.ts || 0) - (b.ts || 0));
    CHAT.msgs = merged;
    chatSalvarLocal(rpgId, merged);
    chatRenderizar();
  }).catch(() => {});
  const nick = SESSION?.nickname || USER_ID || 'Jogador';
  const charVinculado = RPG_DATA?.characters?.find(c => c.nome === RPG_DATA?.linked);
  const cor = charVinculado?.custom_attrs?.cor || '#7ec8f0';
  // Join chat broadcast channel
  wsRef.send(JSON.stringify({
    topic:   `realtime:chat:${rpgId}`,
    event:   'phx_join',
    payload: { config: { broadcast: { self: true }, presence: { key: nick } } },
    ref:     'chat_join'
  }));
  // Função reutilizável para enviar presença
  const enviarPresenca = () => {
    if (wsRef.readyState !== WebSocket.OPEN) return;
    const ch = RPG_DATA?.characters?.find(c => c.nome === RPG_DATA?.linked);
    const nickAtual = ch ? ch.nome : (SESSION?.nickname || USER_ID || 'Jogador');
    const corAtual = ch?.custom_attrs?.cor || '#7ec8f0';
    wsRef.send(JSON.stringify({
      topic:   `realtime:chat:${rpgId}`,
      event:   'broadcast',
      payload: { type: 'broadcast', event: 'chat_presence', payload: { nick: nickAtual, cor: corAtual, ts: Date.now() } },
      ref:     'presence_' + Date.now()
    }));
  };
  setTimeout(enviarPresenca, 800);
  // Heartbeat a cada 20s para manter presença atualizada
  if (CHAT._presenceInterval) clearInterval(CHAT._presenceInterval);
  CHAT._presenceInterval = setInterval(() => {
    enviarPresenca();
    // Atualizar lista de online removendo inativos e atualizar badge
    const agora = Date.now();
    CHAT.online = CHAT.online.filter(u => agora - u.ts < 35000);
    chatAtualizarOnline();
    _atualizarBadgeMesa();
    // Re-renderizar vez (pode ter mudado status offline) — usa a batalha do jogador
    const bidAtivo = batalhaIdMinha ? batalhaIdMinha() : BATALHA_ATUAL_ID;
    if (bidAtivo && MAPA_STATE.batalhas[bidAtivo]?.fase === 'combate') {
      batalhaRenderOrdemStrip();
      batalhaRenderVezLabel();
    }
  }, 20000);
}

function chatEnviar() {
  const input = document.getElementById('chat-input');
  const texto = input?.value.trim();
  if (!texto) return;
  const rpgId = AR.session?.rpg_id || CURRENT_RPG?.id;
  const ws    = AR.ws || realtimeWS;
  if (!ws || ws.readyState !== WebSocket.OPEN) { mostrarToast('Chat desconectado', 'erro'); return; }
  // Usar personagem vinculado como identidade no chat
  const charVinculado = RPG_DATA?.characters?.find(c => c.nome === RPG_DATA?.linked)
    || AR.chars?.find(c => c.nome === RPG_DATA?.linked);
  const cor   = charVinculado?.custom_attrs?.cor || '#7ec8f0';
  const autor = charVinculado ? charVinculado.nome : (SESSION?.nickname || USER_ID || 'Jogador');
  ws.send(JSON.stringify({
    topic:   `realtime:chat:${rpgId}`,
    event:   'broadcast',
    payload: { type: 'broadcast', event: 'chat_msg', payload: {
      autor, cor, texto, ts: Date.now()
    }},
    ref: 'chat_msg_' + Date.now()
  }));
  // Renovar presença a cada mensagem
  ws.send(JSON.stringify({
    topic:   `realtime:chat:${rpgId}`,
    event:   'broadcast',
    payload: { type: 'broadcast', event: 'chat_presence', payload: { nick: autor, cor, ts: Date.now() } },
    ref:     'presence_' + Date.now()
  }));
  input.value = '';
  input.focus();
}

function chatReceberMensagem(pkg) {
  if (!pkg?.autor || !pkg?.texto) return;
  // Evitar duplicatas (mensagem já no histórico local)
  const jaExiste = CHAT.msgs.some(m => m.ts === pkg.ts && m.autor === pkg.autor && m.texto === pkg.texto);
  if (!jaExiste) {
    CHAT.msgs.push(pkg);
    if (CHAT.msgs.length > 200) CHAT.msgs.shift();
    // Persistir localmente e agendar salvamento no banco
    if (CHAT.rpgId) {
      chatSalvarLocal(CHAT.rpgId, CHAT.msgs);
      chatAgendarSalvoBanco();
    }
  }
  const eProprioMsg = pkg.autor === (SESSION?.nickname || USER_ID);
  const chatVis = document.getElementById('chat-container')?.classList.contains('visivel') && CHAT.aberto;
  if (!eProprioMsg && !chatVis && !jaExiste) { CHAT.naoLidos++; chatAtualizarBadge(); }
  chatRenderizar();
}

function chatRenderizar() {
  const el    = document.getElementById('chat-mensagens');
  const empty = document.getElementById('chat-empty');
  if (!el) return;
  const meuNick = SESSION?.nickname || USER_ID;
  if (!CHAT.msgs.length) { if (empty) empty.style.display = 'block'; el.innerHTML = ''; return; }
  if (empty) empty.style.display = 'none';
  el.innerHTML = CHAT.msgs.slice(-80).map(m => {
    const eP  = m.autor === meuNick;
    const hora = new Date(m.ts).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    const isSys = m.tipo === 'sistema';
    if (isSys) return `<div style="text-align:center;font-size:0.68rem;color:#3a5270;font-style:italic;padding:4px 0">${chatEscapar(m.texto)}</div>`;
    return `<div class="chat-msg${eP?' chat-msg-proprio':''}" style="max-width:85%;align-self:${eP?'flex-end':'flex-start'}">
      <div class="chat-msg-autor" style="display:flex;align-items:center;gap:5px;margin-bottom:2px">
        <span style="font-family:'Cinzel',serif;font-size:0.6rem;color:${m.cor||'#7ec8f0'}">${chatEscapar(m.autor)}</span>
        <span style="font-size:0.58rem;color:#3a5270">${hora}</span>
      </div>
      <div style="background:${eP?'rgba(79,163,209,0.1)':'rgba(255,255,255,0.04)'};border:1px solid ${eP?'rgba(79,163,209,0.2)':'rgba(255,255,255,0.06)'};border-radius:${eP?'10px 10px 2px 10px':'10px 10px 10px 2px'};padding:6px 10px;font-size:0.88rem;color:#c8d8e8;line-height:1.4;word-break:break-word">${chatEscapar(m.texto)}</div>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
  chatAtualizarOnline();
}

function chatReceberPresenca(pkg) {
  if (!pkg?.nick) return;
  // Atualizar lista de online — remover entrada antiga do mesmo nick e adicionar nova
  CHAT.online = CHAT.online.filter(u => u.nick !== pkg.nick);
  CHAT.online.push({ nick: pkg.nick, cor: pkg.cor || '#7ec8f0', ts: pkg.ts || Date.now() });
  // Limpar usuários inativos há mais de 30s
  const agora = Date.now();
  CHAT.online = CHAT.online.filter(u => agora - u.ts < 30000);
  chatAtualizarOnline();
}

function chatAtualizarOnline() {
  const el = document.getElementById('chat-online');
  if (!el) return;
  const agora = Date.now();
  const ativos = CHAT.online.filter(u => agora - u.ts < 30000);
  if (!ativos.length) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = ativos.map(u =>
    `<span title="${u.nick}" style="width:7px;height:7px;border-radius:50%;background:${u.cor};flex-shrink:0;box-shadow:0 0 4px ${u.cor}88"></span>`
  ).join('') + `<span style="font-size:0.58rem;color:#3a5270;margin-left:2px">${ativos.length} online</span>`;
}

function chatMostrar(rpgId) {
  CHAT.rpgId = rpgId;
  const btn = document.getElementById('hdr-chat-btn');
  if (btn) btn.style.display = 'inline-flex';
  const rbtn = document.getElementById('hdr-reflash-btn');
  if (rbtn) rbtn.style.display = 'inline-flex';
  // Chat começa FECHADO — usuário abre clicando no ícone
  CHAT.aberto = false; CHAT.naoLidos = 0;
  chatAtualizarBadge();
}

function chatOcultar() {
  document.getElementById('chat-container').classList.remove('visivel');
  // NÃO esconde o botão — apenas fecha o painel
  CHAT.aberto = false;
}

async function reflashDados() {
  if (!CURRENT_RPG?.id) return;
  const btn = document.getElementById('hdr-reflash-btn');
  if (btn) { btn.textContent = '⏳'; btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }
  try {
    RPG_DATA = await getRPGData(CURRENT_RPG.id);
    // Re-renderiza tudo sem sair da aba atual nem mostrar loading
    if (typeof renderHeader       === 'function') renderHeader();
    if (typeof renderLore         === 'function') renderLore();
    if (typeof renderCharButtons  === 'function') renderCharButtons();
    if (typeof renderAttrButtons  === 'function') renderAttrButtons();
    if (typeof renderDados        === 'function') renderDados();
    if (typeof renderConfig       === 'function') renderConfig();
    if (typeof renderMapasTab     === 'function') renderMapasTab();
    if (CHAR_VIEW) {
      if (typeof renderCharView === 'function') renderCharView(CHAR_VIEW);
      if (typeof renderAttrView === 'function') renderAttrView(CHAR_VIEW);
    }
    mostrarToast('✅ Dados atualizados!', 'sucesso');
  } catch(e) {
    mostrarToast('❌ Erro ao atualizar dados', 'erro');
  } finally {
    if (btn) { btn.textContent = '🔄'; btn.style.opacity = ''; btn.style.pointerEvents = ''; }
  }
}

function chatToggle() {
  if (CHAT.aberto) {
    chatOcultar();
  } else {
    chatAbrir();
  }
}

function chatAbrir() {
  document.getElementById('chat-container').classList.add('visivel');
  CHAT.aberto = true; CHAT.naoLidos = 0;
  chatAtualizarBadge(); chatRenderizar();
  setTimeout(() => document.getElementById('chat-input')?.focus(), 50);
}

function chatAtualizarBadge() {
  const hdrBadge = document.getElementById('chat-fab-badge');
  const n = CHAT.naoLidos;
  if (hdrBadge) {
    hdrBadge.textContent = n > 9 ? '9+' : n;
    hdrBadge.style.display = n > 0 ? 'flex' : 'none';
  }
  // Sincronizar badge da arena também
  const arBadge = document.getElementById('ar-chat-badge');
  if (arBadge) {
    arBadge.textContent = n > 9 ? '9+' : n;
    arBadge.style.display = n > 0 ? 'flex' : 'none';
  }
}

async function chatSalvarLog() {
  if (!CHAT.msgs.length) { mostrarToast('Sem mensagens para salvar', ''); return; }
  const rpgId = AR.session?.rpg_id || CURRENT_RPG?.id;
  if (!rpgId) return;
  const titulo = `chat_${Date.now()}`;
  const conteudo = JSON.stringify({ data: new Date().toLocaleDateString('pt-BR'), msgs: CHAT.msgs });
  try {
    await sb('lore', { method:'POST', body: JSON.stringify({ rpg_id: rpgId, secao:'chat_log', titulo, conteudo }) });
    mostrarToast('Log do chat salvo!', 'sucesso');
  } catch(e) { mostrarToast('Erro ao salvar log', 'erro'); }
}

function chatEscapar(texto) {
  return texto.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

