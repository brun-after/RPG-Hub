// core/realtime.js
// RPG Hub — Supabase Realtime WebSocket connection management
// Includes: iniciarRealtime(), fecharRealtime() and reconnection logic

// ── REALTIME ──────────────────────────────────────────────────
function iniciarRealtime(rpgId){
 fecharRealtime();
 let _reconectando=false, _tentativas=0, _timerReconexao=null;

 function conectar(){
   let ws;
   try{ ws=new WebSocket(`${SUPABASE_URL.replace('https','wss')}/realtime/v1/websocket?apikey=${SUPABASE_KEY}&vsn=1.0.0`); }catch(e){return;}
   realtimeWS=ws;

   ws.onopen=()=>{
     _tentativas=0; _reconectando=false;
     // Ocultar banner de reconexão
     const banner=document.getElementById('reconexao-banner');
     if(banner)banner.classList.remove('visible');
     const join=(topic)=>ws.send(JSON.stringify({topic,event:'phx_join',payload:{config:{broadcast:{self:false},presence:{key:''}}},ref:'1'}));
     join(`realtime:public:characters:rpg_id=eq.${rpgId}`);
     join(`realtime:public:lore:rpg_id=eq.${rpgId}`);
     join(`realtime:public:skills:rpg_id=eq.${rpgId}`);
     join(`realtime:public:attr_defs:rpg_id=eq.${rpgId}`);
     join(`realtime:public:rpg_registry:rpg_id=eq.${rpgId}`);
     join(`realtime:public:batalhas:rpg_id=eq.${rpgId}`);
     join(`realtime:public:criativos:rpg_id=eq.${rpgId}`);
     join(`realtime:public:mapas:rpg_id=eq.${rpgId}`);
     join(`realtime:chat:${rpgId}`); // canal de broadcast de combate/animações
     const dot=document.getElementById('realtime-dot');
     if(dot){dot.style.display='inline-block';dot.title='Tempo real conectado';}
     chatIniciar(rpgId, ws);
     // Ao reconectar, recarregar estado de batalha para sincronizar (fix P8)
     if(typeof _avtCarregarBatalhasAtivas==='function')_avtCarregarBatalhasAtivas();
   };

   ws.onmessage=(e)=>{
     try{
       const msg=JSON.parse(e.data);
       // Chat broadcast
       if(msg.event==='broadcast'&&msg.payload?.event==='chat_msg'){chatReceberMensagem(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='chat_presence'){chatReceberPresenca(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='anim_ataque'){animReceberBroadcast(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='token_move'){tokenMoveReceber(msg.payload.payload);return;}
       if(msg.event==='broadcast'&&msg.payload?.event==='combate_evento'){combateReceberBroadcast(msg.payload.payload);return;}
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
             // Preservar animacao pixi_particles em memória se o evento realtime
             // trouxer animacao:null — isso ocorre quando o PATCH base (animacao:null)
             // dispara o evento antes do nosso PATCH dedicado (animacao:pixiConfig)
             // chegar ao servidor. O segundo PATCH corrigirá o servidor logo depois,
             // e um novo evento realtime virá com o valor correto.
             const existente = RPG_DATA.skills[idx];
             if (rec.animacao == null &&
                 (existente?.animacao?.tipo === 'pixi_particles' || existente?.animacao?.tipo === 'pixi') &&
                 typeof window._pixiPatchPendente === 'object' &&
                 window._pixiPatchPendente[rec.id]) {
               rec.animacao = existente.animacao; // manter pixi até o 2º evento chegar
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
         // batalha_estado (jsonb — já chega como objeto)
         if(rec.batalha_estado!==undefined){
           try{
             const bd = rec.batalha_estado || {};
             if(typeof batalhaReceberEstadoRemoto==='function')batalhaReceberEstadoRemoto(bd);
           }catch(e){}
         }
         // criativos_pendentes removido — tabela criativos é a fonte de verdade
         // arena_estado — sync para quem está fora da arena
         if(rec.arena_estado!==undefined){
           try{
             const raw=rec.arena_estado;
             AR.estado=typeof raw==='object'?raw:JSON.parse(raw||'{}');
             if(!AR.estado.log)AR.estado.log=[];
             if(typeof renderMesa==='function')renderMesa();
           }catch(e){}
         }
         // config (permissões)
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

     }catch(err){}
   };

   ws.onerror=()=>{};
   ws.onclose=()=>{
     const dot=document.getElementById('realtime-dot');
     if(dot){dot.style.display='none';dot.title='Desconectado';dot.classList.remove('reconectando');}
     if(!_reconectando){
       _reconectando=true;
       const banner=document.getElementById('reconexao-banner');
       if(banner)banner.classList.add('visible');
       const delay=Math.min(1000*Math.pow(2,_tentativas),30000);
       _tentativas++;
       _timerReconexao=setTimeout(()=>{if(realtimeWS===ws||realtimeWS===null){realtimeWS=null;conectar();}},delay);
     }
   };
 }

 if(_timerReconexao){clearTimeout(_timerReconexao);_timerReconexao=null;}
 conectar();
}


function fecharRealtime(){
 if(realtimeWS){try{realtimeWS.close();}catch(e){}realtimeWS=null;}
 document.getElementById('realtime-dot').style.display='none';
 if(CHAT._presenceInterval){clearInterval(CHAT._presenceInterval);CHAT._presenceInterval=null;}
 CHAT.online = []; CHAT.rpgId = null;
 chatAtualizarOnline();
}



// ── Enviar evento broadcast para todos os jogadores ──────────────────────
function realtimeBroadcast(tipo, payload) {
  if (!realtimeWS || realtimeWS.readyState !== WebSocket.OPEN) return;
  // Fallback robusto: CURRENT_RPG pode ser zerado por fluxos de saída de campanha
  // mesmo com o modo aventura/arena ativo. Derivar do primeiro estado disponível.
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
