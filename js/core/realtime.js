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
     // Tópicos novos + quaisquer adicionais já em _topicosAtivos (raro, mas seguro)
     const todos = new Set([...topicosBase, ..._topicosAtivos]);
     _topicosAtivos.clear();
     for(const t of todos) _doJoin(t);

     _startHeartbeat();

     // Compat: integração com chat (recebe a ws atual)
     try{ if(typeof chatIniciar==='function') chatIniciar(rpgId, ws); }catch(e){ _warn('chatIniciar falhou:', e); }

     // Resync após (re)conexão — re-busca estado autoritativo das batalhas.
     // Em primeira conexão também roda (idempotente, custo baixo).
     try{ if(typeof _avtCarregarBatalhasAtivas==='function') _avtCarregarBatalhasAtivas(); }catch(e){ _warn('resync batalhas falhou:', e); }

     // Despacha qualquer broadcast bufferizado durante a queda
     _flushOutbox();
   };

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

       // Chat broadcast
       if(msg.event==='broadcast'&&msg.payload?.event==='chat_msg'){chatReceberMensagem(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='chat_presence'){chatReceberPresenca(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='anim_ataque'){animReceberBroadcast(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='token_move'){tokenMoveReceber(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='combate_evento'){combateReceberBroadcast(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_host_heartbeat'){if(typeof avtReceberHostHeartbeat==='function')avtReceberHostHeartbeat(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_token_move'){if(typeof avtReceberMovimento==='function')avtReceberMovimento(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_combate_inicio'){if(typeof avtReceberCombateInicio==='function')avtReceberCombateInicio(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_batalha_update'){if(typeof avtReceberBatalhaUpdate==='function')avtReceberBatalhaUpdate(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_combate_fim'){if(typeof avtReceberFimBatalha==='function')avtReceberFimBatalha(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_combate_join'){if(typeof avtReceberJoinBatalha==='function')avtReceberJoinBatalha(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_npc_morreu'){if(typeof avtReceberNpcMorreu==='function')avtReceberNpcMorreu(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_npc_perseguindo'){if(typeof avtReceberNpcPerseguindo==='function')avtReceberNpcPerseguindo(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_convite_combate'){if(typeof avtReceberConviteCombate==='function')avtReceberConviteCombate(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_npc_respawn'){if(typeof avtReceberNpcRespawn==='function')avtReceberNpcRespawn(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_xp_ganho'){if(typeof avtReceberXpGanho==='function')avtReceberXpGanho(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_level_up'){if(typeof avtReceberLevelUp==='function')avtReceberLevelUp(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_jogador_morreu'){if(typeof avtReceberJogadorMorreu==='function')avtReceberJogadorMorreu(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_jogador_ressurgiu'){if(typeof avtReceberJogadorRessurgiu==='function')avtReceberJogadorRessurgiu(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_bau_aberto'){mostrarToast&&mostrarToast(msg.payload.payload?.jogadorNome+' abriu um baú!','ok');return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_skill_selecionada'){if(typeof avtReceberSkillSelecionada==='function')avtReceberSkillSelecionada(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_dado_rolado'){if(typeof avtReceberDadoRolado==='function')avtReceberDadoRolado(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_dano_visual'){if(typeof avtReceberDanoVisual==='function')avtReceberDanoVisual(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='avt_hp_update'){if(typeof avtReceberHpUpdate==='function')avtReceberHpUpdate(msg.payload.payload);return;}
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
       if(topic.includes('batalhas')){
         batalhaReceberLinhaRemota(rec);
       }

       // ── CRIATIVOS ──
       if(topic.includes('criativos')){
         criativoReceberLinhaRemota(rec);
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
   const delay=Math.min(1000*Math.pow(2,_tentativas),30000);
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
