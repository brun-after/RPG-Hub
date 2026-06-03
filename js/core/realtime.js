// core/realtime.js  — FIXED (Parte A do plano)
// RPG Hub — Supabase Realtime WebSocket connection management
// Drop-in replacement de realtime_5.js. API pública preservada:
//   - iniciarRealtime(rpgId)
//   - fecharRealtime()
//   - realtimeBroadcast(tipo, payload)  [window.realtimeBroadcast]
//   - global `realtimeWS` continua atualizado para compatibilidade
//
// Correções (vs. versão antiga):
//   1. Heartbeat Phoenix a cada 25s (mantém socket vivo no Supabase)
//   2. Refs monotônicos únicos em TODOS os frames (joins, broadcasts, heartbeats)
//   3. Tratamento de phx_reply ok/error — re-join automático com backoff curto
//   4. Detecção de socket zumbi (heartbeats sem resposta → força reconexão)
//   5. Reconexão robusta com backoff 1s→2s→4s→8s→16s→30s, re-join de todos os tópicos
//   6. Outbox: broadcasts enviados com socket fechado vão pra fila e despacham na reabertura
//   7. Throttle de avt_token_move (~60ms) para não inundar durante drag de tokens
//   8. Resync após reconexão: chama _avtCarregarBatalhasAtivas() (se existir)
//      para o app re-buscar estado autoritativo das tabelas
//   9. Limpeza total em fecharRealtime (heartbeat, timers, outbox, lista de tópicos)
//  10. Logging [RT] para diagnóstico

// ── REALTIME ──────────────────────────────────────────────────
function iniciarRealtime(rpgId){
 fecharRealtime();

 // Estado por sessão de iniciarRealtime (cada chamada começa do zero)
 let _reconectando=false, _tentativas=0, _timerReconexao=null;
 let _heartbeatTimer=null;
 let _ref=0;
 const _novoRef=()=>String(++_ref);

 // Tópicos que estamos (ou queremos estar) inscritos. Re-emitido a cada reconnect.
 const _topicosAtivos = new Set();
 // Tópicos pausados quando P2P está ativo (não precisam de Realtime durante a aventura)
 const _PAUSABLE_TOPICS = new Set([
   `realtime:public:characters:rpg_id=eq.${rpgId}`,
   `realtime:public:batalhas:rpg_id=eq.${rpgId}`,
   `realtime:public:npc_state:rpg_id=eq.${rpgId}`,
 ]);
 let _pausado = false;

 function _pausarVolateisP2P() {
   if (_pausado) return;
   _pausado = true;
   _log('pausando tópicos voláteis (P2P ativo)');
   for (const topic of _PAUSABLE_TOPICS) {
     _topicosAtivos.delete(topic);
     _topicosOk.delete(topic);
     if (realtimeWS && realtimeWS.readyState === WebSocket.OPEN) {
       try { realtimeWS.send(JSON.stringify({ topic, event: 'phx_leave', payload: {}, ref: _novoRef() })); } catch(_) {}
     }
   }
 }

 function _resumirVolateisP2P() {
   if (!_pausado) return;
   _pausado = false;
   _log('resumindo tópicos voláteis (P2P degradado/perdido)');
   for (const topic of _PAUSABLE_TOPICS) {
     if (!_topicosAtivos.has(topic)) _doJoin(topic);
   }
 }

 const _modeChangeHandler = (e) => {
   try {
     const { mode } = e.detail || {};
     if (mode === 'p2p' || mode === 'mixed') _pausarVolateisP2P();
     else if (mode === 'supabase') _resumirVolateisP2P();
   } catch(err) { _warn('modechange handler:', err); }
 };
 window.addEventListener('rtnet:modechange', _modeChangeHandler);
 globalThis.__rtModeChangeHandler = _modeChangeHandler;
 // Refs de joins enviados aguardando phx_reply — para retry direcionado.
 // Map<ref, {topic, attempt}>
 const _joinsPendentes = new Map();
 // Tópicos já confirmados (phx_reply ok) nesta sessão de socket.
 let _topicosOk = new Set();

 // Outbox: mensagens já serializadas a enviar quando o socket abrir.
 // {kind:'frame', frame:string} ou {kind:'broadcast', tipo, payload}
 const _outbox = [];
 const _OUTBOX_MAX = 100;

 // Throttle de token_move (por entidade) — coalesce envios contíguos.
 // Map<nome, {timer, lastPayload}>
 const _tokenMoveThrottle = new Map();
 const TOKEN_MOVE_THROTTLE_MS = 60;

 // Heartbeat liveness — se 2 heartbeats consecutivos não receberem reply, força close.
 let _heartbeatPendente = 0;
 const HEARTBEAT_INTERVAL_MS = 25_000;
 const HEARTBEAT_DEAD_AFTER  = 2; // pendentes consecutivos para considerar zumbi

 function _log(...args){ try{ console.log('[RT]', ...args); }catch(_){} }
 function _warn(...args){ try{ console.warn('[RT]', ...args); }catch(_){} }

 function _setStatus(state){
   // state: 'connected' | 'connecting' | 'disconnected'
   const dot=document.getElementById('realtime-dot');
   if(dot){
     if(state==='connected'){ dot.style.display='inline-block'; dot.title='Tempo real conectado'; dot.classList.remove('reconectando'); }
     else if(state==='connecting'){ dot.style.display='inline-block'; dot.title='Reconectando…'; dot.classList.add('reconectando'); }
     else { dot.style.display='none'; dot.title='Desconectado'; dot.classList.remove('reconectando'); }
   }
   const banner=document.getElementById('reconexao-banner');
   if(banner){
     if(state==='connecting') banner.classList.add('visible');
     else banner.classList.remove('visible');
   }
 }

 function _enviarFrame(frameStr){
   const ws = realtimeWS;
   if(ws && ws.readyState===WebSocket.OPEN){
     try { ws.send(frameStr); return true; } catch(e){ _warn('send falhou:', e); }
   }
   // bufferiza
   if(_outbox.length>=_OUTBOX_MAX){
     const dropped = _outbox.shift();
     _warn('outbox cheia, descartando frame antigo:', (dropped.kind==='broadcast'?dropped.tipo:'frame'));
   }
   _outbox.push({kind:'frame', frame:frameStr});
   return false;
 }

 function _flushOutbox(){
   if(!realtimeWS || realtimeWS.readyState!==WebSocket.OPEN) return;
   if(_outbox.length===0) return;
   _log('flush outbox:', _outbox.length, 'mensagens');
   const pend = _outbox.splice(0, _outbox.length);
   for(const item of pend){
     try{
       if(item.kind==='frame'){
         realtimeWS.send(item.frame);
       } else if(item.kind==='broadcast'){
         _sendBroadcastNow(item.tipo, item.payload);
       }
     }catch(e){ _warn('flush falhou:', e); }
   }
 }

 function _doJoin(topic){
   _topicosAtivos.add(topic);
   const ref = _novoRef();
   _joinsPendentes.set(ref, {topic, attempt: 0});
   const frame = JSON.stringify({
     topic, event:'phx_join',
     payload:{ config:{ broadcast:{self:false}, presence:{key:''} } },
     ref
   });
   _enviarFrame(frame);
 }

 function _agendarRejoin(topic, attempt){
   const delay = Math.min(300 * Math.pow(2, attempt), 5000);
   setTimeout(()=>{
     // só re-join se ainda não confirmado e ainda queremos esse tópico
     if(!_topicosAtivos.has(topic)) return;
     if(_topicosOk.has(topic)) return;
     _log('re-join tópico (tentativa', attempt+1, '):', topic);
     const ref = _novoRef();
     _joinsPendentes.set(ref, {topic, attempt: attempt+1});
     _enviarFrame(JSON.stringify({
       topic, event:'phx_join',
       payload:{ config:{ broadcast:{self:false}, presence:{key:''} } },
       ref
     }));
   }, delay);
 }

 function _startHeartbeat(){
   _stopHeartbeat();
   _heartbeatPendente = 0;
   _heartbeatTimer = setInterval(()=>{
     if(!realtimeWS || realtimeWS.readyState!==WebSocket.OPEN) return;
     _heartbeatPendente++;
     if(_heartbeatPendente >= HEARTBEAT_DEAD_AFTER){
       _warn('heartbeats sem resposta — forçando reconexão (socket zumbi)');
       try{ realtimeWS.close(); }catch(_){}
       return;
     }
     const ref = _novoRef();
     try{
       realtimeWS.send(JSON.stringify({
         topic:'phoenix', event:'heartbeat', payload:{}, ref
       }));
     }catch(e){ _warn('heartbeat send falhou:', e); }
   }, HEARTBEAT_INTERVAL_MS);
 }

 function _stopHeartbeat(){
   if(_heartbeatTimer){ clearInterval(_heartbeatTimer); _heartbeatTimer=null; }
   _heartbeatPendente = 0;
 }

 function _sendBroadcastNow(tipo, payload){
   if(!realtimeWS || realtimeWS.readyState!==WebSocket.OPEN){
     if(_outbox.length>=_OUTBOX_MAX){
       const dropped = _outbox.shift();
       _warn('outbox cheia, descartando antigo:', (dropped.kind==='broadcast'?dropped.tipo:'frame'));
     }
     _outbox.push({kind:'broadcast', tipo, payload});
     return;
   }
   const frame = JSON.stringify({
     topic: `realtime:chat:${rpgId}`,
     event: 'broadcast',
     payload: { event: tipo, payload },
     ref: _novoRef()
   });
   _enviarFrame(frame);
 }

 // Expor a função de envio para `realtimeBroadcast` (global) chamar via closure.
 // Guardamos no globalThis para que `realtimeBroadcast` (definido fora) use a
 // versão da sessão atual de iniciarRealtime. Em fecharRealtime, limpamos.
 globalThis.__rtSendBroadcast = function(tipo, payload){
   // Throttle dedicado para movimento contínuo de token
   if(tipo==='avt_token_move' && payload && payload.nome){
     const key = payload.nome;
     const slot = _tokenMoveThrottle.get(key) || {};
     slot.lastPayload = payload;
     if(slot.timer){ _tokenMoveThrottle.set(key, slot); return; }
     slot.timer = setTimeout(()=>{
       const cur = _tokenMoveThrottle.get(key);
       if(cur){
         cur.timer = null;
         const p = cur.lastPayload;
         _tokenMoveThrottle.set(key, cur);
         _sendBroadcastNow(tipo, p);
       }
     }, TOKEN_MOVE_THROTTLE_MS);
     _tokenMoveThrottle.set(key, slot);
     return;
   }
   _sendBroadcastNow(tipo, payload);
 };

 function conectar(){
   let ws;
   _setStatus('connecting');
   try{
     ws=new WebSocket(`${SUPABASE_URL.replace('https','wss')}/realtime/v1/websocket?apikey=${SUPABASE_KEY}&vsn=1.0.0`);
   }catch(e){
     _warn('falha ao abrir WebSocket:', e);
     _agendarReconexao();
     return;
   }
   realtimeWS=ws;

   ws.onopen=()=>{
     _log('conectado');
     _tentativas=0; _reconectando=false;
     _topicosOk = new Set();
     _joinsPendentes.clear();
     _setStatus('connected');

     // Joins iniciais (ou re-joins após reconexão)
     const topicosBase = [
       `realtime:public:characters:rpg_id=eq.${rpgId}`,
       `realtime:public:lore:rpg_id=eq.${rpgId}`,
       `realtime:public:skills:rpg_id=eq.${rpgId}`,
       `realtime:public:attr_defs:rpg_id=eq.${rpgId}`,
       `realtime:public:rpg_registry:rpg_id=eq.${rpgId}`,
       `realtime:public:batalhas:rpg_id=eq.${rpgId}`,
       `realtime:public:criativos:rpg_id=eq.${rpgId}`,
       `realtime:public:mapas:rpg_id=eq.${rpgId}`,
       `realtime:chat:${rpgId}`,
     ];
      // [NPC-SYNC] estado autoritativo de NPC (uma linha por NPC, por RPG)
      topicosBase.push(`realtime:public:npc_state:rpg_id=eq.${rpgId}`);
     // Tópicos novos + quaisquer adicionais já em _topicosAtivos (raro, mas seguro)
     const todos = new Set([...topicosBase, ..._topicosAtivos]);
     _topicosAtivos.clear();
     for(const t of todos) {
       if (_pausado && _PAUSABLE_TOPICS.has(t)) continue; // P2P ativo: não re-inscrever tópicos voláteis
       _doJoin(t);
     }

     _startHeartbeat();

     // Compat: integração com chat (recebe a ws atual)
     try{ if(typeof chatIniciar==='function') chatIniciar(rpgId, ws); }catch(e){ _warn('chatIniciar falhou:', e); }

     // Resync após (re)conexão — re-busca estado autoritativo das batalhas.
     // Em primeira conexão também roda (idempotente, custo baixo).
     try{ if(typeof _avtCarregarBatalhasAtivas==='function') _avtCarregarBatalhasAtivas(); }catch(e){ _warn('resync batalhas falhou:', e); }

     // [HOST-RTC] Notifica RTNet para re-anunciar peer presence e refazer ofertas WebRTC.
     try{ if(typeof RTNet !== 'undefined' && typeof RTNet._onSignalingReconnect === 'function') RTNet._onSignalingReconnect(); }catch(e){ _warn('RTNet reconnect hook:', e); }

     // Despacha qualquer broadcast bufferizado durante a queda
     _flushOutbox();
   };

   // Sincroniza atualizações de characters com o estado da aventura (AVT_STATE).
   // Sem isso, o host persiste HP/posição/XP no DB, o postgres_change chega nos outros
   // clientes, mas eles só atualizam RPG_DATA — AVT_STATE.chars/entidades ficam stale
   // e cada jogador vê um jogo diferente.
   function _syncAvtCharFromRecord(rec, ev, oldRec){
     try{
       if(typeof AVT_STATE === 'undefined' || !AVT_STATE || !AVT_STATE.rpgId) return;
       if(rec && rec.rpg_id && rec.rpg_id !== AVT_STATE.rpgId) return;
       if(ev === 'DELETE'){
         const delId = (oldRec && oldRec.id) || (rec && rec.id);
         if(Array.isArray(AVT_STATE.chars))     AVT_STATE.chars     = AVT_STATE.chars.filter(c=>c.id!==delId);
         if(Array.isArray(AVT_STATE.entidades)) AVT_STATE.entidades = AVT_STATE.entidades.filter(e=>e.dbId!==delId);
         return;
       }
       if(!rec || !rec.id) return;
       if(!Array.isArray(AVT_STATE.chars)) AVT_STATE.chars = [];
       const ci = AVT_STATE.chars.findIndex(c=>c.id===rec.id);
       if(ci>=0) AVT_STATE.chars[ci] = rec; else AVT_STATE.chars.push(rec);
       if(Array.isArray(AVT_STATE.entidades)){
         const ent = AVT_STATE.entidades.find(e=>e.dbId===rec.id || e.nome===rec.nome);
         if(ent){
           const ca = (rec.custom_attrs && typeof rec.custom_attrs==='object') ? rec.custom_attrs : {};
           if(typeof rec.hp_atual === 'number') ent.hp = rec.hp_atual;
           if(typeof rec.hp_max   === 'number') ent.hpMax = rec.hp_max;
           if(typeof rec.nivel    === 'number') ent.nivel = rec.nivel;
           if(typeof ca.avt_x === 'number' && typeof ca.avt_y === 'number'){
             const _meCtrl = (typeof _avtEntidadeControlada==='function') && _avtEntidadeControlada();
             if(!_meCtrl || _meCtrl.id !== ent.id){
               if(ent.x !== ca.avt_x || ent.y !== ca.avt_y){
                 ent.x = ca.avt_x; ent.y = ca.avt_y;
                 if(!ent._waypoints || ent._waypoints.length === 0){
                   ent.renderX = ca.avt_x; ent.renderY = ca.avt_y;
                 }
               }
             }
           }
         }
       }
     }catch(e){ _warn('[sync] AVT_STATE char falhou:', e); }
   }

   // Aventura ativa? (evita handlers da campanha pisarem no estado da aventura)
   function _isAvtAtual(){
     try{
       if(typeof AVT_STATE !== 'undefined' && AVT_STATE && AVT_STATE.rpgId) return true;
       if(typeof RPG_DATA !== 'undefined' && RPG_DATA && RPG_DATA.rpg && RPG_DATA.rpg.is_aventura) return true;
     }catch(_){}
     return false;
   }

   ws.onmessage=(e)=>{
     try{
       const msg=JSON.parse(e.data);

       // phx_reply — tratar status de joins e heartbeats
       if(msg.event==='phx_reply'){
         const ref = msg.ref;
         const status = msg.payload && msg.payload.status;
         // heartbeats: qualquer reply zera contador
         _heartbeatPendente = 0;
         if(ref && _joinsPendentes.has(ref)){
           const info = _joinsPendentes.get(ref);
           _joinsPendentes.delete(ref);
           if(status==='ok'){
             _topicosOk.add(info.topic);
           } else {
             _warn('join falhou:', info.topic, msg.payload);
             _agendarRejoin(info.topic, info.attempt);
           }
         }
         return;
       }

       // [RTNet] Roteamento de eventos de sinalização P2P
       if(msg.event==='broadcast' && msg.payload && typeof msg.payload.event === 'string' && msg.payload.event.indexOf('rtnet_')===0){
         const _rtType = msg.payload.event.slice('rtnet_'.length);
         try{ if(typeof RTNet !== 'undefined' && RTNet._signalingActive) RTNet._handleSignaling(_rtType, msg.payload.payload); }catch(e){ _warn('RTNet signaling:', e); }
         return;
       }

       // [PATCH v2_2] Dispatcher unificado de avt_* com fila quando handler ausente
       // Em modo P2P puro (RTNet.mode==='p2p') os eventos já chegam via DataChannel — ignorar Supabase
       if(msg.event==='broadcast' && msg.payload && typeof msg.payload.event === 'string' && msg.payload.event.indexOf('avt_')===0){
         if(typeof RTNet !== 'undefined' && RTNet.initialized && RTNet.mode === 'p2p') return;
         const _avtEv = msg.payload.event;
         const _avtPl = msg.payload.payload;
         const _map = {
           avt_host_heartbeat: 'avtReceberHostHeartbeat', // no-op stub
           avt_token_move: 'avtReceberMovimento',
           avt_combate_inicio: 'avtReceberCombateInicio',
           avt_batalha_update: 'avtReceberBatalhaUpdate',
           avt_combate_fim: 'avtReceberFimBatalha',
           avt_combate_join: 'avtReceberJoinBatalha',
           avt_npc_morreu: 'avtReceberNpcMorreu',
           avt_npc_perseguindo: 'avtReceberNpcPerseguindo',
           avt_npc_respawn: 'avtReceberNpcRespawn',
           avt_convite_combate: 'avtReceberConviteCombate',
           avt_xp_ganho: 'avtReceberXpGanho',
           avt_level_up: 'avtReceberLevelUp',
           avt_jogador_morreu: 'avtReceberJogadorMorreu',
           avt_jogador_ressurgiu: 'avtReceberJogadorRessurgiu',
           avt_skill_selecionada: 'avtReceberSkillSelecionada',
           avt_dado_rolado: 'avtReceberDadoRolado',
           avt_dano_visual: 'avtReceberDanoVisual',
           avt_hp_update: 'avtReceberHpUpdate',
           avt_rsv_update: 'avtReceberRsvUpdate',
           avt_member_linked: 'avtReceberMemberLinked',
           avt_primeiro_ataque: 'avtReceberPrimeiroAtaque',
           avt_skill_anim: 'avtReceberSkillAnim',
           avt_attack_anim: 'avtReceberAttackAnim',
           avt_level_config_update: 'avtReceberLevelConfigUpdate',
           avt_colisao_config: 'avtReceberColisaoConfig',
           avt_entidade_nova: 'avtReceberEntidadeNova',
           avt_invocacao_destruida: 'avtReceberInvocacaoDestruida',
           avt_state_tick:    'avtReceberStateTick',
           avt_player_hp:     'avtReceberPlayerHp',
           avt_player_damage: 'avtReceberPlayerDamage',
         };
         if(_avtEv === 'avt_bau_aberto'){
           try{ if(typeof mostrarToast==='function') mostrarToast((_avtPl && _avtPl.jogadorNome ? _avtPl.jogadorNome : 'Alguém') + ' abriu um baú!','ok'); }catch(_){}
           return;
         }
         const _hName = _map[_avtEv];
         if(_hName){
           const _fn = (typeof window !== 'undefined' ? window[_hName] : undefined);
           if(typeof _fn === 'function'){
             try{ _fn(_avtPl); }catch(err){ _warn('handler', _hName, 'falhou:', err); }
           } else {
             try{
               window.__avtPendingBroadcasts = window.__avtPendingBroadcasts || [];
               if(window.__avtPendingBroadcasts.length < 200){
                 window.__avtPendingBroadcasts.push({ ev: _avtEv, pl: _avtPl, at: Date.now() });
               }
               _warn('handler ausente para', _avtEv, '→ enfileirado (pend=', window.__avtPendingBroadcasts.length, ')');
             }catch(_){}
           }
           return;
         }
         _warn('evento avt_* desconhecido:', _avtEv);
         return;
       }
       // Chat broadcast
       if(msg.event==='broadcast'&&msg.payload?.event==='chat_msg'){chatReceberMensagem(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='chat_presence'){chatReceberPresenca(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='anim_ataque'){animReceberBroadcast(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='token_move'){tokenMoveReceber(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='combate_evento'){combateReceberBroadcast(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='porta_transicao'){
         const pl=msg.payload.payload;
         if(pl?.charNome&&pl?.mapa_destino){
           const char=(RPG_DATA?.characters||[]).find(c=>c.nome===pl.charNome);
           if(char){
             if(!char.map_positions)char.map_positions={};
             char.map_positions[pl.mapa_destino]={col:pl.destino_col||0,row:pl.destino_row||0};
             char.active_map_id=pl.mapa_destino;
           }
           const mapaAtual=typeof _getMapaById==='function'?_getMapaById(MAPA_STATE?.mapaAtualId):null;
           if(mapaAtual&&typeof mapaRenderTokens==='function')mapaRenderTokens(mapaAtual);
         }
         return;
       }
       if(!msg.payload||!msg.payload.record)return;
       const rec=msg.payload.record;
       const ev=msg.event;
       const topic=msg.topic||'';

       // ── CHARACTERS ──
       if(topic.includes('characters')){
         _syncAvtCharFromRecord(rec, ev, msg.payload.old_record);
         if(typeof rec.custom_attrs==='string'){try{rec.custom_attrs=JSON.parse(rec.custom_attrs);}catch(e){rec.custom_attrs={};}}
         else if(!rec.custom_attrs||typeof rec.custom_attrs!=='object'){rec.custom_attrs={};}
         if(!rec.map_positions||typeof rec.map_positions!=='object')rec.map_positions={};
         if(!Array.isArray(rec.buffs))rec.buffs=[];

         if(ev==='DELETE'){
           const oldRec=msg.payload.old_record||{};
           const nome=oldRec.nome||rec.nome;
           RPG_DATA.characters=RPG_DATA.characters.filter(c=>!(c.nome===nome&&c.rpg_id===rec.rpg_id));
           renderCharButtons(); if(typeof renderFichasBtns==='function') renderFichasBtns();
           mostrarToast(`✕ ${nome} removido`,'');
           return;
         }
         const idx=RPG_DATA.characters.findIndex(c=>c.nome===rec.nome&&c.rpg_id===rec.rpg_id);
         if(idx>=0){
           RPG_DATA.characters[idx]=rec;
           if(FICHAS_VIEW===rec.nome&&typeof renderFichaView==='function')renderFichaView(rec.nome);
           else{if(CHAR_VIEW===rec.nome)renderCharView(rec.nome);if(ATTR_VIEW===rec.nome)renderAttrView(rec.nome);}
           mostrarToast(`↺ ${rec.nome} atualizado`,'');
         } else if(ev==='INSERT'){
           RPG_DATA.characters.push(rec);
           mostrarToast(`✦ ${rec.nome} adicionado`,'sucesso');
         }
         renderCharButtons(); if(typeof renderFichasBtns==='function') renderFichasBtns();
         if(MAPA_STATE.mapaAtualId){const mapas=RPG_DATA.mapas||[];const entry=mapas.find(l=>l.mapa.map_id===MAPA_STATE.mapaAtualId);if(entry)mapaRenderTokens(entry.mapa);mapaRenderStatus();}
       }

       // ── SKILLS ──
       if(topic.includes('skills')){
         if(ev==='DELETE'){
           const oldRec=msg.payload.old_record||{};
           const skId=oldRec.id||rec.id;
           RPG_DATA.skills=RPG_DATA.skills.filter(s=>s.id!==skId);
         } else {
           if(typeof rec.animacao==='string'){try{rec.animacao=JSON.parse(rec.animacao);}catch(e){rec.animacao=null;}}
           if(typeof rec.efeitos_bonus==='string'){try{rec.efeitos_bonus=JSON.parse(rec.efeitos_bonus);}catch(e){rec.efeitos_bonus=[];}}
           const idx=RPG_DATA.skills.findIndex(s=>s.id===rec.id);
           if(idx>=0){
             const existente = RPG_DATA.skills[idx];
             if (rec.animacao == null &&
                 (existente?.animacao?.tipo === 'pixi_particles' || existente?.animacao?.tipo === 'pixi') &&
                 typeof window._pixiPatchPendente === 'object' &&
                 window._pixiPatchPendente[rec.id]) {
               rec.animacao = existente.animacao;
             }
             RPG_DATA.skills[idx]=rec;
           }
           else RPG_DATA.skills.push(rec);
         }
         if(FICHAS_VIEW&&typeof renderFichaView==='function')renderFichaView(FICHAS_VIEW);
         else if(CHAR_VIEW)renderCharView(CHAR_VIEW);
         try{
           if(typeof AVT_STATE!=='undefined' && AVT_STATE && AVT_STATE.rpgId){
             AVT_STATE.skills = (typeof RPG_DATA!=='undefined' && RPG_DATA && RPG_DATA.skills) ? RPG_DATA.skills : AVT_STATE.skills;
           }
         }catch(_){}
       }

       // ── LORE ──
       if(topic.includes('lore')){
         if(ev==='DELETE'){
           const oldRec=msg.payload.old_record||{};
           const lId=oldRec.id||rec.id;
           RPG_DATA.lore=RPG_DATA.lore.filter(l=>l.id!==lId);
         } else {
           const idx=RPG_DATA.lore.findIndex(l=>l.id===rec.id);
           if(idx>=0)RPG_DATA.lore[idx]=rec;
           else RPG_DATA.lore.push(rec);
         }
         if(typeof renderLore==='function'&&document.getElementById('lore-items'))renderLore();
       }

       // ── ATTR_DEFS ──
       if(topic.includes('attr_defs')){
         if(ev==='DELETE'){
           const oldRec=msg.payload.old_record||{};
           const adId=oldRec.id||rec.id;
           RPG_DATA.attrDefs=(RPG_DATA.attrDefs||[]).filter(a=>a.id!==adId);
         } else {
           const idx=(RPG_DATA.attrDefs||[]).findIndex(a=>a.id===rec.id);
           if(idx>=0)RPG_DATA.attrDefs[idx]=rec;
           else{if(!RPG_DATA.attrDefs)RPG_DATA.attrDefs=[];RPG_DATA.attrDefs.push(rec);}
         }
         if(FICHAS_VIEW&&typeof renderFichaView==='function')renderFichaView(FICHAS_VIEW);
         else{if(CHAR_VIEW)renderCharView(CHAR_VIEW);if(ATTR_VIEW)renderAttrView(ATTR_VIEW);}
       }

       // ── RPG_REGISTRY ──
       if(topic.includes('rpg_registry')){
         if(rec.batalha_estado!==undefined){
           try{
             const bd = rec.batalha_estado || {};
             if(typeof batalhaReceberEstadoRemoto==='function')batalhaReceberEstadoRemoto(bd);
           }catch(e){}
         }
         if(rec.arena_estado!==undefined){
           try{
             const raw=rec.arena_estado;
             AR.estado=typeof raw==='object'?raw:JSON.parse(raw||'{}');
             if(!AR.estado.log)AR.estado.log=[];
             if(typeof renderMesa==='function')renderMesa();
           }catch(e){}
         }
         if(rec.config!==undefined){
           try{
             const raw=rec.config;
             const cfg=typeof raw==='object'?raw:JSON.parse(raw||'{}');
             if(cfg.permissoes&&RPG_DATA.myRole!=='mestre'){
               RPG_DATA.myPermissoes=cfg.permissoes[RPG_DATA.userId]||{};
             }
           }catch(e){}
         }
       }

       // ── BATALHAS ──
       // Em aventura, o estado canônico vem via broadcast 'avt_batalha_update';
       // não disparar o handler da campanha para não pisar no AVT_STATE.batalhas.
       if(topic.includes('batalhas') && !_isAvtAtual()){
         if(typeof batalhaReceberLinhaRemota==='function') batalhaReceberLinhaRemota(rec);
       }

       // ── CRIATIVOS ──
       if(topic.includes('criativos') && !_isAvtAtual()){
         if(typeof criativoReceberLinhaRemota==='function') criativoReceberLinhaRemota(rec);
       }

       // ── MAPAS ──
       if(topic.includes('mapas')){
         const parseMapa = (r) => ({
           id: r.id, rpg_id: r.rpg_id,
           mapa: {
             map_id: r.map_id, nome: r.nome, img_url: r.img_url||'',
             escala_val: r.escala_val??1.5, escala_unit: r.escala_unit||'m', grid: r.grid??20,
             parent_map_id: r.parent_map_id||null, tipo: r.tipo||'geral',
             zona_x: r.zona_x, zona_y: r.zona_y,
             zona_w_percent: r.zona_w_percent, zona_h_percent: r.zona_h_percent,
             largura_total: r.largura_total||null, altura_total: r.altura_total||null,
             largura_real: r.largura_real||null, altura_real: r.altura_real||null,
             representar_pct: r.representar_pct??100,
             locais: Array.isArray(r.locais)?r.locais:(typeof r.locais==='string'?JSON.parse(r.locais||'[]'):[]),
             render_data: r.render_data||null,
           }
         });
         if(ev==='DELETE'){
           const oldRec=msg.payload.old_record||{};
           const mapId=oldRec.map_id||rec.map_id;
           RPG_DATA.mapas=(RPG_DATA.mapas||[]).filter(l=>l.mapa.map_id!==mapId);
           if(MAPA_STATE.mapaAtualId===mapId){MAPA_STATE.mapaAtualId=null;}
         } else {
           const entry=parseMapa(rec);
           const idx=(RPG_DATA.mapas||[]).findIndex(l=>l.mapa.map_id===rec.map_id);
           if(idx>=0) RPG_DATA.mapas[idx]=entry;
           else {if(!RPG_DATA.mapas)RPG_DATA.mapas=[];RPG_DATA.mapas.push(entry);}
           if(MAPA_STATE.mapaAtualId===rec.map_id){renderMapaViewer();}
         }
         if(document.getElementById('mapa-lista'))renderMapasTab();
       }

        // ── NPC_STATE (sincronização autoritativa de NPCs) ──
        if(topic.includes('npc_state')){
          try{
            if(ev === 'DELETE'){
              const oldRec = msg.payload.old_record || {};
              if(typeof window._avtNpcOnRemoteUpdate === 'function'){
                window._avtNpcOnRemoteUpdate({ ...oldRec, _deleted: true });
              }
            } else if(rec){
              if(typeof window._avtNpcOnRemoteUpdate === 'function'){
                window._avtNpcOnRemoteUpdate(rec);
              }
            }
          }catch(e){ _warn('npc_state handler falhou:', e); }
        }

     }catch(err){ _warn('onmessage parse:', err); }
   };

   ws.onerror=(e)=>{ _warn('ws.onerror'); };

   ws.onclose=()=>{
     _log('socket fechado');
     _stopHeartbeat();
     _setStatus('connecting');
     _agendarReconexao(ws);
   };
 }

 function _agendarReconexao(wsFechado){
   if(_reconectando) return;
   _reconectando=true;
   const delay=Math.min(1000*Math.pow(2,_tentativas),8000);
   _tentativas++;
   _log('reconectar em', delay, 'ms (tentativa', _tentativas, ')');
   _timerReconexao=setTimeout(()=>{
     _timerReconexao=null;
     // Só reconecta se o ws atual ainda é o que fechou (ou foi limpo)
     if(realtimeWS===wsFechado || realtimeWS===null){
       realtimeWS=null;
       _reconectando=false; // conectar() vai re-setar se falhar
       conectar();
     } else {
       _reconectando=false;
     }
   }, delay);
 }

 if(_timerReconexao){clearTimeout(_timerReconexao);_timerReconexao=null;}
 conectar();
}


function fecharRealtime(){
 try {
   if (typeof globalThis.__rtModeChangeHandler === 'function') {
     window.removeEventListener('rtnet:modechange', globalThis.__rtModeChangeHandler);
     delete globalThis.__rtModeChangeHandler;
   }
 } catch(_) {}
 if(realtimeWS){try{realtimeWS.close();}catch(e){}realtimeWS=null;}
 const dot=document.getElementById('realtime-dot');
 if(dot){ dot.style.display='none'; dot.classList.remove('reconectando'); }
 const banner=document.getElementById('reconexao-banner');
 if(banner) banner.classList.remove('visible');
 if(CHAT && CHAT._presenceInterval){clearInterval(CHAT._presenceInterval);CHAT._presenceInterval=null;}
 if(CHAT){ CHAT.online = []; CHAT.rpgId = null; }
 if(typeof chatAtualizarOnline==='function') chatAtualizarOnline();
 // Libera o sender associado à sessão anterior (se existir)
 try{ delete globalThis.__rtSendBroadcast; }catch(_){ globalThis.__rtSendBroadcast = undefined; }
}


// ── Enviar evento broadcast para todos os jogadores ──────────────────────
// API pública preservada. Usa o sender da sessão ativa (com outbox + throttle).
// Se não houver sessão ativa, faz fallback ao envio direto antigo.
function realtimeBroadcast(tipo, payload) {
  const rpgId =
       (typeof CURRENT_RPG !== 'undefined' && CURRENT_RPG)
    || (typeof AVT_STATE  !== 'undefined' && AVT_STATE  && AVT_STATE.rpgId)
    || (typeof AR         !== 'undefined' && AR         && AR.session && AR.session.rpgId)
    || (typeof CHAT       !== 'undefined' && CHAT       && CHAT.rpgId)
    || null;
  if (!rpgId) {
    console.warn('[realtimeBroadcast] rpgId indisponível, evento descartado:', tipo);
    return;
  }
  // Caminho preferencial: sender da sessão ativa (com outbox/throttle)
  if (typeof globalThis.__rtSendBroadcast === 'function') {
    try { globalThis.__rtSendBroadcast(tipo, payload); return; }
    catch (e) { console.warn('[realtimeBroadcast] sender da sessão falhou, caindo no fallback:', e); }
  }
  // Fallback (sessão não iniciada ainda): comportamento antigo, sem fila.
  if (!realtimeWS || realtimeWS.readyState !== WebSocket.OPEN) return;
  try {
    realtimeWS.send(JSON.stringify({
      topic: `realtime:chat:${rpgId}`,
      event: 'broadcast',
      payload: { event: tipo, payload },
      ref: String(Date.now()),
    }));
  } catch(e) { console.warn('realtimeBroadcast falhou:', e); }
}
window.realtimeBroadcast = realtimeBroadcast;


// ── [PATCH v2_2] Drena broadcasts avt_* recebidos antes dos handlers ────────
window.__avtFlushPendingBroadcasts = function(){
  try{
    const q = window.__avtPendingBroadcasts || [];
    if(!q.length) return;
    const _map = {
      avt_host_heartbeat: 'avtReceberHostHeartbeat',
      avt_token_move: 'avtReceberMovimento',
      avt_combate_inicio: 'avtReceberCombateInicio',
      avt_batalha_update: 'avtReceberBatalhaUpdate',
      avt_combate_fim: 'avtReceberFimBatalha',
      avt_combate_join: 'avtReceberJoinBatalha',
      avt_npc_morreu: 'avtReceberNpcMorreu',
      avt_npc_perseguindo: 'avtReceberNpcPerseguindo',
      avt_npc_respawn: 'avtReceberNpcRespawn',
      avt_convite_combate: 'avtReceberConviteCombate',
      avt_xp_ganho: 'avtReceberXpGanho',
      avt_level_up: 'avtReceberLevelUp',
      avt_jogador_morreu: 'avtReceberJogadorMorreu',
      avt_jogador_ressurgiu: 'avtReceberJogadorRessurgiu',
      avt_skill_selecionada: 'avtReceberSkillSelecionada',
      avt_dado_rolado: 'avtReceberDadoRolado',
      avt_dano_visual: 'avtReceberDanoVisual',
      avt_hp_update: 'avtReceberHpUpdate',
      avt_rsv_update: 'avtReceberRsvUpdate',
      avt_member_linked: 'avtReceberMemberLinked',
      avt_skill_anim: 'avtReceberSkillAnim',
      avt_attack_anim: 'avtReceberAttackAnim',
      avt_level_config_update: 'avtReceberLevelConfigUpdate',
      avt_colisao_config: 'avtReceberColisaoConfig',
      avt_entidade_nova: 'avtReceberEntidadeNova',
      avt_invocacao_destruida: 'avtReceberInvocacaoDestruida'
    };
    const kept = [];
    for(const item of q){
      const fnName = _map[item.ev];
      const fn = fnName ? window[fnName] : null;
      if(typeof fn === 'function'){
        try{ fn(item.pl); }catch(err){ console.warn('[RT] flush handler', fnName, 'falhou:', err); }
      } else {
        if(Date.now() - (item.at||0) < 10000) kept.push(item);
      }
    }
    window.__avtPendingBroadcasts = kept;
    try{ console.log('[RT] flush pendentes: aplicados', q.length - kept.length, 'restantes', kept.length); }catch(_){}
  }catch(e){ try{ console.warn('[RT] __avtFlushPendingBroadcasts falhou:', e); }catch(_){} }
};

// ── PATCH v12: throttle avt_player_hp no fallback Supabase ─────────────────
(function _rtPatchV12HpThrottle(){
  if (typeof window === 'undefined' || window._RT_HP_THROTTLE_INSTALLED) return;
  window._RT_HP_THROTTLE_INSTALLED = true;
  const _origRB = window.realtimeBroadcast;
  if (typeof _origRB !== 'function') return;
  let _lastHpTs = 0; let _pendingHp = null; let _hpTimer = null;
  window.realtimeBroadcast = function(tipo, payload){
    if (tipo === 'avt_player_hp') {
      _pendingHp = payload;
      if (_hpTimer) return;
      const now = Date.now();
      const wait = Math.max(0, 60 - (now - _lastHpTs));
      _hpTimer = setTimeout(() => {
        _hpTimer = null; _lastHpTs = Date.now();
        try { _origRB.call(this, 'avt_player_hp', _pendingHp); } catch(_){}
        _pendingHp = null;
      }, wait);
      return;
    }
    return _origRB.apply(this, arguments);
  };
})();
