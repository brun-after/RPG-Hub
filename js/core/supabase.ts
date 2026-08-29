// core/supabase.js
// RPG Hub — Supabase API client: fetch, upload, read, write, import/update operations
// Includes: sb(), sbUpload(), getAllRPGs(), lerRPG(), importRPG(), updateRPGData(), deleteRPGData()

// ══════════════════════════════════════════════════════════════


// ── SUPABASE FETCH ────────────────────────────────────────────
interface SbOpts {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: string;
  headers?: Record<string, string>;
  prefer?: string;
  [k: string]: any;   // repassado ao fetch (signal, cache, …)
}

async function sb<T = any>(path: string, opts: SbOpts = {}, _retry = 0): Promise<T | null> {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers: Record<string, string> = {
    'apikey':       SUPABASE_KEY,
    'Content-Type': 'application/json',
    // Default return=minimal: writes não devolvem a linha (economiza a
    // serialização de blobs grandes no servidor). Callers que consomem a
    // resposta passam prefer:'return=representation' explicitamente.
    'Prefer':       opts.prefer || 'return=minimal',
    ...(opts.headers || {})
  };
  if (SESSION?.access_token) {
    headers['Authorization'] = `Bearer ${SESSION.access_token}`;
  }
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401) {
    const ok = await authRefreshSession();
    if (ok) return sb(path, opts);
    authSair(); return null;
  }
  if (!res.ok) {
    const txt = await res.text();
    // Retry automático em statement timeout (57014) — até 3 tentativas com backoff
    if (_retry < 3 && txt.includes('57014')) {
      await new Promise(r => setTimeout(r, 1000 * (_retry + 1)));
      return sb(path, opts, _retry + 1);
    }
    throw new Error(txt);
  }
  if (res.status === 204) return null;
  const _txt = await res.text();
  if (!_txt || !_txt.trim()) return null;
  return JSON.parse(_txt);
}


// ── UPLOAD PARA SUPABASE STORAGE ─────────────────────────────
async function uploadToStorage(file: File, folder = 'misc'): Promise<string> {
  const ext  = file.name?.split('.').pop() || 'png';
  const nome = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/game-assets/${nome}`, {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SESSION!.access_token}`,
      'Content-Type':  file.type || 'image/png',
      'Cache-Control': '3600',
    },
    body: file   // envia o File diretamente, sem converter para base64
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error('Erro no upload: ' + err);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/game-assets/${nome}`;
}

// ── LEITURA ───────────────────────────────────────────────────
async function getAllRPGs(): Promise<RpgRegistryRow[] | null>{ return await sb<RpgRegistryRow[]>('rpg_registry?select=*,owner_id&order=name'); }


async function getRPGData(rpgId: string): Promise<RpgData>{
 // Retorno instantâneo — sem nenhuma query de rede.
 // Todo carregamento real é feito por _carregarProgressivo() depois que o app já está visível.
 return{rpgId,characters:[] as any[],skills:[] as any[],lore:[] as any[],mapas:[] as any[],attrDefs:[] as any[],linked:null as any,membrosLinked:{},_carregandoProgressivo:true};
}

// ── CARREGAMENTO PROGRESSIVO ─────────────────────────────────
async function _carregarProgressivo(rpgId: string) {
 const e=encodeURIComponent(rpgId);
 function _setStatus(txt: any) {
   const el=document.getElementById('rpg-load-status');
   if(el){ el.textContent=txt; el.style!.opacity='1'; el.style!.display='flex'; }
 }

 // Fase 0: attr_defs + batalhas + role (leve, necessário para UI)
 _setStatus('⏳ Conectando…');
 try {
   const uid=SESSION?.user?.id;
   const [attrDefs,batalhasRows,atributosMapeados,memberRows]=await Promise.all([
     sb<AttrDefRow[]>(`attr_defs?rpg_id=eq.${e}&select=*&order=ordem`).catch((): any[] => []),
     sb<BatalhaRow[]>(`batalhas?rpg_id=eq.${e}&ativa=eq.true&select=*`).catch((): any[] => []),
     sb<AtributosGrupoRow[]>(`atributos_grupos?rpg_id=eq.${e}&select=*&order=nome_customizado`).catch((): any[] => []),
     uid?sb<Pick<RpgMemberRow, 'linked'>[]>(`rpg_members?rpg_id=eq.${e}&player_id=eq.${encodeURIComponent(uid)}&select=linked`).catch((): any[] => []):[],
   ]);
   RPG_DATA!.attrDefs=attrDefs||[];
   if(atributosMapeados && typeof ATTR_MAPPING_CACHE !== 'undefined') ATTR_MAPPING_CACHE[rpgId]=atributosMapeados;
   const myLinked=memberRows?.[0]?.linked;
   if(myLinked) RPG_DATA!.linked=myLinked;
   if(batalhasRows&&batalhasRows.length){
     const bd: Record<string, any> = {};
     batalhasRows.forEach(b=>{
       bd[b.id]={id:b.id,mapa_id:b.mapa_id,mapa_nome:b.mapa_nome,ativa:b.ativa,pausada:b.pausada,turnoRound:b.turno_round,fase:b.fase,participantes:Array.isArray(b.participantes)?b.participantes:[],ordemAtual:b.ordem_atual,iniciativasRoladas:(b.iniciativas_roladas&&typeof b.iniciativas_roladas==='object')?b.iniciativas_roladas:{},empatados:Array.isArray(b.empatados)?b.empatados:[],dadoSel:b.dado_sel||null,cooldowns:(b.cooldowns&&typeof b.cooldowns==='object')?b.cooldowns:{},recursos_participantes:(b.recursos_participantes&&typeof b.recursos_participantes==='object')?b.recursos_participantes:{}};
     });
     MAPA_STATE.batalhas=bd;
   }
   _aplicarEstadoBatalhaUI();
   _atualizarBadgeMesa();
 } catch(err){ console.error('[RPG] fase0:',err); }

 // Fase 1: Mapas (sem img_url)
 _setStatus('⏳ Carregando mapas…');
 try {
   const mapasRaw=await sb<MapaRow[]>(`mapas?rpg_id=eq.${e}&select=id,rpg_id,map_id,nome,escala_val,escala_unit,grid,parent_map_id,tipo,zona_x,zona_y,zona_w_percent,zona_h_percent,largura_total,altura_total,largura_real,altura_real,representar_pct,locais,render_data&order=id`);
   RPG_DATA!.mapas=(mapasRaw||[]).map(m=>({
     id:m.id,rpg_id:m.rpg_id,
     mapa:{map_id:m.map_id,nome:m.nome,img_url:'',escala_val:m.escala_val??1.5,escala_unit:m.escala_unit||'m',grid:m.grid??20,parent_map_id:m.parent_map_id||null,tipo:m.tipo||'geral',zona_x:m.zona_x,zona_y:m.zona_y,zona_w_percent:m.zona_w_percent,zona_h_percent:m.zona_h_percent,largura_total:m.largura_total||null,altura_total:m.altura_total||null,largura_real:m.largura_real||null,altura_real:m.altura_real||null,representar_pct:m.representar_pct??100,locais:Array.isArray(m.locais)?m.locais:(typeof m.locais==='string'?JSON.parse(m.locais||'[]'):[]),render_data:m.render_data||null,transform3d:m.render_data?.transform3d||null}
   }));
   renderMapasTab();
   if (document.getElementById('tab-mapas')?.classList.contains('active')) {
     setTimeout(_mapaInicializarLayout, 80);
   }
   _setStatus('✓ Mapas · ⏳ Personagens…');
 } catch(err){ console.error('[RPG] mapas:',err); _setStatus('⚠ Mapas falhou · ⏳ Personagens…'); }

 // Fase 2: Personagens (sem imagens)
 try {
   const chars=await sb<CharacterRow[]>(`characters?rpg_id=eq.${e}&select=id,rpg_id,nome,hp_atual,hp_max,xp,nivel,pontos_attr,custom_attrs,map_positions,active_map_id,buffs&order=id`);
   (chars||[]).forEach(c=>_normalizarCharRow(c));
   RPG_DATA!.characters=chars||[];
   // Espelhar para AVT_STATE.chars — fix dessincronização entre clientes.
   try{
     if(typeof AVT_STATE!=='undefined' && AVT_STATE && AVT_STATE.rpgId === rpgId){
       AVT_STATE.chars = RPG_DATA!.characters;
       if(typeof _avtReconciliarEntidades === 'function') _avtReconciliarEntidades();
     }
   }catch(_){}
   // Vincular personagem do jogador
   if(RPG_DATA!.linked){
     CHAR_VIEW=RPG_DATA!.linked; ATTR_VIEW=CHAR_VIEW; CFG_CHAR=CHAR_VIEW;
   } else if(!CHAR_VIEW && RPG_DATA!.characters[0]){
     CHAR_VIEW=RPG_DATA!.characters[0].nome; ATTR_VIEW=CHAR_VIEW; CFG_CHAR=CHAR_VIEW;
   }
   renderCharButtons(); renderAttrButtons(); renderHeader();
   if(CHAR_VIEW){renderCharView(CHAR_VIEW); renderAttrView(CHAR_VIEW);}
   const entry=(RPG_DATA!.mapas||[]).find(l=>l.mapa.map_id===MAPA_STATE.mapaAtualId);
   if(entry) mapaRenderTokens(entry.mapa);
   mapaRenderStatus();
   _setStatus('✓ Mapas · ✓ Personagens · ⏳ Habilidades…');
 } catch(err){ console.error('[RPG] chars:',err); _setStatus('⚠ Personagens falhou · ⏳ Habilidades…'); }

 // Fase 3: Skills + Lore + Criativos
 try {
   const [skills,lore,criativos]=await Promise.all([
     sb<SkillRow[]>(`skills?rpg_id=eq.${e}&select=*&order=id`).catch((): any[] => []),
     sb<LoreRow[]>(`lore?rpg_id=eq.${e}&select=*&order=id`).catch((): any[] => []),
     sb<CriativoRow[]>(`criativos?rpg_id=eq.${e}&status=in.(pendente,aprovado_dc,dc_rolado_sucesso,dc_rolado_narrativo,dc_rolado_falha,aprovado_aguardando_rolagem)&select=*`).catch((): any[] => []),
   ]);
   (skills||[]).forEach(s=>{
     if(typeof s.animacao==='string'){try{s.animacao=JSON.parse(s.animacao);}catch(ex){s.animacao=null;}}
     if(s.animacao&&typeof s.animacao!=='object')s.animacao=null;
     if(!Array.isArray(s.efeitos_bonus)){if(typeof s.efeitos_bonus==='string'){try{s.efeitos_bonus=JSON.parse(s.efeitos_bonus);}catch(ex){s.efeitos_bonus=[];}}else s.efeitos_bonus=[];}
   });
   RPG_DATA!.skills=skills||[];
   RPG_DATA!.lore=(lore||[]).filter(l=>l.secao!=='mapa');
   if(criativos&&criativos.length){
     CRIATIVOS_CAMP=criativos.map(c=>{
       let anim=c.animacao||null;
       if(typeof anim==='string'){try{anim=JSON.parse(anim);}catch(ex){anim=null;}}
       if(anim&&typeof anim!=='object')anim=null;
       return{id:c.id,atacante:c.atacante,alvo:c.alvo,descricao:c.descricao,turno:c.turno,status:c.status,formula_aprovada:c.formula_aprovada||null,mod_atributo:c.mod_atributo||null,mod_atributo_pct:c.mod_atributo_pct||null,custo_cobrado:c.custo_cobrado||null,animacao:anim};
     });
   }
   renderLore(); renderConfig();
   criativoRenderMestre();
   _setStatus('✓ Mapas · ✓ Personagens · ✓ Habilidades · ⏳ Imagens…');
 } catch(err){ console.error('[RPG] skills/lore:',err); _setStatus('⚠ Habilidades falhou'); }

 // Fase 4: Imagens dos mapas (não-bloqueante)
 setTimeout(async ()=>{
   try {
     const mapasImg=await sb(`mapas?rpg_id=eq.${e}&select=map_id,img_url&order=id`).catch((): any[] => []);
     (mapasImg||[]).forEach((m: any)=>{
       const entry=RPG_DATA!.mapas.find(l=>l.mapa.map_id===m.map_id);
       if(entry && m.img_url) entry.mapa.img_url=m.img_url;
     });
     const curEntry=(RPG_DATA!.mapas||[]).find(l=>l.mapa.map_id===MAPA_STATE.mapaAtualId);
     if(curEntry && curEntry.mapa.img_url) (renderMapaViewer as any)(curEntry.mapa.map_id);
   } catch(err){ console.error('[RPG] imgs:',err); }
   const el=document.getElementById('rpg-load-status');
   if(el){ el.style!.transition='opacity 1s'; el.style!.opacity='0'; setTimeout(()=>el.style!.display='none',1100); }
 }, 300);
}

// ── NORMALIZAÇÃO DE LINHA DE PERSONAGEM ──────────────────────
// Compartilhada entre o carregamento progressivo e os re-fetches pontuais
// (optimistic-save). Espelha os campos derivados dentro de custom_attrs.
function _normalizarCharRow(c: any){
 if(typeof c.custom_attrs==='string'){try{c.custom_attrs=JSON.parse(c.custom_attrs);}catch(ex){c.custom_attrs={};}}
 if(!c.custom_attrs||typeof c.custom_attrs!=='object')c.custom_attrs={};
 if(!c.map_positions||typeof c.map_positions!=='object')c.map_positions={};
 if(!Array.isArray(c.buffs))c.buffs=[];
 c.custom_attrs.nivel       = c.nivel       ?? c.custom_attrs.nivel       ?? 1;
 c.custom_attrs.hp_max      = c.hp_max      ?? c.custom_attrs.hp_max      ?? 100;
 c.custom_attrs.xp          = c.xp          ?? c.custom_attrs.xp          ?? 0;
 c.custom_attrs.pontos_attr = c.pontos_attr ?? c.custom_attrs.pontos_attr ?? 0;
 return c;
}

// ── ESCRITA ───────────────────────────────────────────────────
async function saveCharacterStats(rpgId: string, charNameOrId: string, stats: { hp_atual?: number; custom_attrs?: CustomAttrs; [k: string]: any }){
 const body: any = {};
 if(stats.hp_atual!==undefined)body.hp_atual=stats.hp_atual;
 if(stats.custom_attrs!==undefined)body.custom_attrs=stats.custom_attrs; // jsonb
 const isUuid = typeof charNameOrId==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(charNameOrId);
 let qry; let charId = null;
 if(isUuid){
   charId = charNameOrId;
   qry = `characters?id=eq.${encodeURIComponent(charNameOrId)}`;
 } else {
   // Resolver o id localmente evita um SELECT de rede antes do PATCH —
   // este é o write mais quente do combate (cada ponto de dano).
   const local = RPG_DATA?.characters?.find(x=>x.nome===charNameOrId&&x.rpg_id===rpgId);
   if(local?.id){
     charId = local.id;
     qry = `characters?id=eq.${encodeURIComponent(local.id)}`;
   } else {
     try{
       const rows = await sb(`characters?rpg_id=eq.${encodeURIComponent(rpgId)}&nome=eq.${encodeURIComponent(charNameOrId)}&select=id&limit=1`);
       if(rows && rows[0] && rows[0].id){
         charId = rows[0].id;
         qry = `characters?id=eq.${encodeURIComponent(rows[0].id)}`;
       } else {
         qry = `characters?rpg_id=eq.${encodeURIComponent(rpgId)}&nome=eq.${encodeURIComponent(charNameOrId)}`;
       }
     }catch(_){
       qry = `characters?rpg_id=eq.${encodeURIComponent(rpgId)}&nome=eq.${encodeURIComponent(charNameOrId)}`;
     }
   }
 }
 await sb(qry,{method:'PATCH',body:JSON.stringify(body)});
 // Propagar mudanças para as cópias do personagem em outras aventuras (mesma
 // linhagem) — em background: não faz parte do save crítico.
 try{
   const ca = stats.custom_attrs;
   if(charId && ca?.linhagem_id && typeof window._avtSyncLinhagem==='function'){
     Promise.resolve(window._avtSyncLinhagem({ id: charId, rpg_id: rpgId, custom_attrs: ca, hp_atual: stats.hp_atual })).catch(()=>{});
   }
 }catch(_){}
}


async function saveMemberLinked(rpgId: any,charName: any){
 if(!SESSION?.user?.id){mostrarToast('Faça login para vincular personagem','erro');return;}
 await sb(`rpg_members?rpg_id=eq.${encodeURIComponent(rpgId)}&player_id=eq.${SESSION.user.id}`,
   {method:'PATCH',body:JSON.stringify({linked:charName})});
}


async function deleteRPGData(rpgId: string){
 if(rpgId==='dual')throw new Error('DUAL não pode ser deletado.');
 await sb(`rpg_registry?rpg_id=eq.${encodeURIComponent(rpgId)}`,{method:'DELETE'});
}


// ── IMPORT / UPDATE ───────────────────────────────────────────
function buildLevelConfig(cfg: any){
 const lc: any = {};
 if(cfg.nivel_maximo)           lc.nivel_maximo=parseInt(cfg.nivel_maximo)||20;
 if(cfg.hp_base)                lc.hp_base=parseInt(cfg.hp_base)||100;
 if(cfg.hp_por_nivel)           lc.hp_por_nivel=parseInt(cfg.hp_por_nivel)||10;
 if(cfg.pontos_attr_por_nivel)  lc.pontos_attr_por_nivel=parseInt(cfg.pontos_attr_por_nivel)||0;
 if(cfg.hp_attr)                lc.hp_attr=cfg.hp_attr; // atributo que contribui com HP
 if(cfg.hp_attr_mult)           lc.hp_attr_mult=parseFloat(cfg.hp_attr_mult)||0; // multiplicador
 if(cfg.aumentos_automaticos_json){try{lc.aumentos_automaticos=JSON.parse(cfg.aumentos_automaticos_json);}catch(e){}}
 if(cfg.habilidades_por_nivel_json){try{lc.habilidades_por_nivel=JSON.parse(cfg.habilidades_por_nivel_json);}catch(e){}}
 if(cfg.velocidade_base)        lc.velocidade_base=parseInt(cfg.velocidade_base)||4;
 if(cfg.velocidade_fator)       lc.velocidade_fator=parseInt(cfg.velocidade_fator)||4;
 if(cfg.turno_modo_exclusivo)   lc.turno_modo_exclusivo=cfg.turno_modo_exclusivo==='true'||cfg.turno_modo_exclusivo===true;
 return Object.keys(lc).length?lc:null;
}

// Calcula hp_max de um personagem usando atributos (se configurado)
// BUG-08 FIX: parâmetro nivel adicionado (default 1 para retrocompatibilidade)
function calcularHpMaxComAtributos(lc: any, charAtributos: any, hpMaxExplicito: any, nivel = 1) {
  if (hpMaxExplicito) return hpMaxExplicito; // HP explícito tem prioridade
  const base       = lc?.hp_base       || 100;
  const perNivel   = lc?.hp_por_nivel  || 0;
  const attrNome   = lc?.hp_attr;
  const mult       = parseFloat(lc?.hp_attr_mult) || 0;
  const nivelBonus = (Math.max(1, nivel) - 1) * perNivel;
  if (attrNome && mult && charAtributos) {
    const attrVal = parseFloat(charAtributos[attrNome]) || 0;
    return Math.ceil(base + nivelBonus + attrVal * mult);
  }
  return base + nivelBonus;
}

function buildTheme(cfg: any){
 const level_config=buildLevelConfig(cfg);
 return{
   preto:cfg.theme_preto||'#080c10',
   escuro:cfg.theme_escuro||'#0f1520',
   painel:cfg.theme_painel||'#141d2b',
   borda:cfg.theme_borda||'#1e2d42',
   cinza:cfg.theme_cinza||'#2a3a50',
   texto:cfg.theme_texto||'#c8d8e8',
   suave:cfg.theme_suave||'#7a92aa',
   primario:cfg.theme_primario||'#4fa3d1',
   primario_v:cfg.theme_primario_v||'#7ec8f0',
   destaque:cfg.theme_destaque||'#c8a84b',
   destaque_v:cfg.theme_destaque_v||'#f0cc6a',
   perigo:cfg.theme_perigo||'#c0392b',
   sucesso:cfg.theme_sucesso||'#27ae60',
   especial:cfg.theme_especial||'#7b2fbe',
   animation_css: cfg.animation_css || '',
   card_icon_svg: cfg.card_icon_svg || '',
   animation_loading_svg: cfg.animation_loading_svg || '',
   animation: cfg.animation || 'flame',
   font_display: cfg.font_display || 'Cinzel',
   font_text: cfg.font_text || 'Crimson Text',
   font_url: cfg.font_url || '',
   description: cfg.description || '',
   ...(level_config?{level_config}:{})
 };
}



async function insertSection(rpgId: any,section: any,rows: any,levelConfig: any){
 const P: any[]=[];
 if(section==='characters') rows.forEach((c: any)=>{
   // ── Pular linhas sem nome (garante robustez contra linhas vazias/malformadas) ──
   if(!c.nome||!c.nome.trim())return;

   const tipoChar = c.tipo||'jogador';
   const ca: any = {tipo:tipoChar,cor:c.cor||'#4fa3d1'};
   if(tipoChar==='npc'||tipoChar==='criatura'){ca.tipo_personagem='npc';ca.npc_generico=true;if(!c.cor)ca.cor='#e74c3c';}
   if(c.img_url)ca.img_url=normalizeImgUrl(c.img_url);
   if(c.background)ca.background=c.background;

   // ── Auto-correção: detecta coluna companheiro/equipamentos invertidas ─────
   // Erro comum no CSV: companheiro recebe lista de itens e equipamentos fica vazio.
   // Se companheiro contém vírgula e equipamentos está vazio, provavelmente estão trocados.
   let equipamentos = c.equipamentos||'';
   let companheiro  = c.companheiro||'';
   if(!equipamentos && companheiro && companheiro.includes(',') && !companheiro.trim().startsWith('{')) {
     // Lista de itens acabou no campo errado — corrigir silenciosamente
     console.warn(`[import] Auto-fix: "equipamentos" ↔ "companheiro" trocados em "${c.nome}"`);
     equipamentos = companheiro;
     companheiro  = '';
   }
   if(equipamentos)ca.equipamentos=equipamentos;
   if(companheiro) ca.companheiro =companheiro;

   // Level fields
   const nivel = parseInt(c.nivel)||1;
   const lc = levelConfig||{};
   // BUG-08 FIX: passar nivel — a função agora inclui hp_por_nivel internamente
   const hp_max = calcularHpMaxComAtributos(lc, ca.atributos, c.hp_max ? +c.hp_max : null, nivel);
   const hp_atual_raw = c.hp_atual!=null&&c.hp_atual!=='' ? +c.hp_atual : hp_max;
   ca.nivel = nivel;
   ca.hp_max = hp_max;
   ca.xp = +c.xp||0;
   ca.pontos_attr = +c.pontos_attr||0;
   P.push(sb('characters',{method:'POST',body:JSON.stringify({
     rpg_id:rpgId, nome:c.nome.trim(), hp_atual:hp_atual_raw, custom_attrs:ca,
     nivel:nivel, hp_max:hp_max, xp:+c.xp||0, pontos_attr:+c.pontos_attr||0
   })}));
 });
 if(section==='skills'){
    // Resolver character_id: buscar os personagens recém-inseridos para montar mapa nome→uuid
    let _charMapInsert: Record<string, any> = {};
    try {
      const _charsIns = await sb(`characters?rpg_id=eq.${encodeURIComponent(rpgId)}&select=id,nome`);
      (_charsIns||[]).forEach((c: any) => { _charMapInsert[c.nome] = c.id; });
    } catch(e) {}
    rows.forEach((s: any)=>{
    let efeitosBonus = null;
    if(s.efeitos_bonus_json){ try{ efeitosBonus = JSON.parse(s.efeitos_bonus_json); }catch(e){} }
    let skAnimacao = null;
    if(s.animacao_json){ try{ skAnimacao = JSON.parse(s.animacao_json); }catch(e){} }
    P.push(sb('skills',{method:'POST',body:JSON.stringify({
      rpg_id:rpgId,
      personagem:s.personagem,
      character_id: _charMapInsert[s.personagem] || null,
      habilidade:s.habilidade,
      efeito:s.efeito||'',
      formula_dano:s.formula_dano||null,
      custo_rsv:s.custo_rsv||null,
      cooldown_turnos:parseInt(s.cooldown_turnos)||0,
      tipo_dano:s.tipo_dano||'fisico',
      alcance_celulas:s.alcance_celulas!==''&&s.alcance_celulas!=null?parseInt(s.alcance_celulas):null,
      atributo_base:s.atributo_base||null,
      alvo_tipo:s.alvo_tipo||'inimigo',
      efeitos_bonus:efeitosBonus,
      critico_positivo:s.critico_positivo||null,
      critico_negativo:s.critico_negativo||null,
      animacao:skAnimacao||null,
    })}));
  });}
 if(section==='lore')      rows.forEach((l: any)=>P.push(sb('lore',{method:'POST',body:JSON.stringify({rpg_id:rpgId,secao:l.secao||'mundo',titulo:l.titulo||'',conteudo:l.conteudo||''})})));
 if(section==='mapas')     rows.forEach((m: any)=>P.push(sb('mapas',{method:'POST',body:JSON.stringify({
   rpg_id:rpgId, map_id:m.map_id, nome:m.nome, tipo:m.tipo||'geral',
   img_url:m.img_url||'', escala_val:+m.escala_val||1,
   escala_unit:m.escala_unit||'m', grid:+m.grid||20,
   parent_map_id:m.parent_map_id||null,
   locais: m.locais ? (typeof m.locais==='string'?JSON.parse(m.locais):m.locais) : [],
   render_data: m.render_data ? (typeof m.render_data==='string'?JSON.parse(m.render_data):m.render_data) : null,
 })})));
 if(section==='attr_defs') rows.forEach((a: any)=>P.push(sb('attr_defs',{method:'POST',body:JSON.stringify({rpg_id:rpgId,nome:a.nome||a.label||a.attr_key,tipo:a.tipo||'text',opcoes:a.opcoes||null,ordem:+a.ordem||1,categoria:a.categoria||'basico'})})));
 if(section==='item_catalog') rows.forEach((item: any)=>{
   let efeitos=null;
   if(item.efeitos_json){try{efeitos=typeof item.efeitos_json==='string'?JSON.parse(item.efeitos_json):item.efeitos_json;}catch(e){}}
   let atributos_bonus=null;
   if(item.atributos_bonus_json){try{atributos_bonus=typeof item.atributos_bonus_json==='string'?JSON.parse(item.atributos_bonus_json):item.atributos_bonus_json;}catch(e){}}
   const tipo=item.tipo||'misc';
   P.push(sb('item_catalog',{method:'POST',body:JSON.stringify({
     rpg_id:rpgId,
     nome:item.nome,
     tipo:tipo,
     descricao:item.descricao||null,
     icone:item.icone||'📦',
     raridade:item.raridade||'comum',
     valor_base:item.valor_base!=null?+item.valor_base:null,
     efeitos:tipo==='consumivel'?(efeitos||null):null,
     alvo:tipo==='consumivel'?(item.alvo||null):null,
     alcance_m:tipo==='consumivel'&&item.alcance_m!=null?+item.alcance_m:null,
     requer_aprovacao:item.requer_aprovacao==='true'||item.requer_aprovacao===true||false,
     slot_padrao:tipo==='equipamento'?(item.slot_padrao||null):null,
     atributos_bonus:tipo==='equipamento'?(atributos_bonus||null):null,
     tipo_canonico:tipo==='equipamento'?(item.slot_padrao||null):tipo,
     img_url:item.img_url||null,
     nivel_minimo_uso:item.nivel_minimo_uso?+item.nivel_minimo_uso:1,
     unico_no_mundo:item.unico_no_mundo==='true'||item.unico_no_mundo===true||false,
     peso:item.peso?+item.peso:null,
   })}));
 });
 if(section==='inventario'){
   // Resolver character_id e item_catalog_id por nome
   let _charMapInv: Record<string, any> = {},_itemMapInv: Record<string, any>={};
   try{const _ci=await sb(`characters?rpg_id=eq.${encodeURIComponent(rpgId)}&select=id,nome`);(_ci||[]).forEach((c: any)=>{_charMapInv[c.nome]=c.id;});}catch(e){}
   try{const _ii=await sb(`item_catalog?rpg_id=eq.${encodeURIComponent(rpgId)}&select=id,nome`);(_ii||[]).forEach((i: any)=>{_itemMapInv[i.nome]=i.id;});}catch(e){}
   rows.forEach((inv: any)=>{
     const charId=_charMapInv[inv.personagem];
     const itemId=_itemMapInv[inv.item];
     if(!charId||!itemId)return; // skip inválidos
     P.push(sb('inventario',{method:'POST',body:JSON.stringify({
       rpg_id:rpgId,
       character_id:charId,
       item_catalog_id:itemId,
       quantidade:inv.quantidade!=null?+inv.quantidade:1,
       equipado:inv.equipado==='true'||inv.equipado===true||false,
       notas:inv.notas||null,
     })}));
   });
 }
 await Promise.all(P);
}

async function importRPG(payload: any, mapasJSON: any=null): Promise<string>{
 const cfg=(payload.config||[])[0];
 if(!cfg||!cfg.rpg_id)throw new Error('rpg_id não encontrado no config.');
 const rpgId=cfg.rpg_id;
 const existing=await sb<Pick<RpgRegistryRow, 'rpg_id'>[]>(`rpg_registry?rpg_id=eq.${encodeURIComponent(rpgId)}&select=rpg_id`);
 if(existing&&existing.length)throw new Error(`RPG "${rpgId}" já existe.`);
 
 const theme=buildTheme(cfg);
 const levelConfig=buildLevelConfig(cfg);
 const ownerId=SESSION?.user?.id||null;
 const registryBody: any = {rpg_id:rpgId,name:cfg.name,owner_id:ownerId,theme_json:theme};
 if(levelConfig) registryBody.level_config=levelConfig;
 await sb('rpg_registry',{method:'POST',body:JSON.stringify(registryBody)});
 
 // Vincular criador como mestre automaticamente — OBRIGATÓRIO antes de inserir characters
 if (!ownerId) throw new Error('Usuário não autenticado.');
 await sb('rpg_members', {
   method: 'POST',
   body: JSON.stringify({
     rpg_id: rpgId,
     player_id: ownerId,
     nickname: SESSION?.nickname || SESSION?.user?.email || 'mestre',
     role: 'mestre',
     permissoes: {}
   })
 });

 for(const sec of['characters','skills','lore','attr_defs','mapas','item_catalog','inventario']){
   if(payload[sec]&&payload[sec].length)await insertSection(rpgId,sec,payload[sec],theme.level_config);
 }
 // A4: Importar mapeamento de atributos
 if(payload.attr_grupos&&payload.attr_grupos.length){
   const rows=payload.attr_grupos.filter((r: any)=>r.nome_customizado&&r.grupo_base);
   const validGrupos=['forca','destreza','constituicao','inteligencia'];
   const upserts=rows.filter((r: any)=>validGrupos.includes(r.grupo_base.toLowerCase().trim()))
     .map((r: any)=>({rpg_id:rpgId,nome_customizado:r.nome_customizado.trim(),nome_customizado_norm:r.nome_customizado.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),grupo_base:r.grupo_base.toLowerCase().trim()}));
   if(upserts.length){
     await sb('atributos_grupos',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates'},body:JSON.stringify(upserts)});
     // Atualizar cache local se RPG_DATA estiver carregado
     if(typeof _mapeamentoCache!=='undefined')delete _mapeamentoCache[rpgId];
   }
 }
 // A4: Importar vocabulário temático
 if(payload.vocab_tematico&&payload.vocab_tematico.length){
   const validTipos=['prefixo_material','adjetivo_qualidade','nome_origem'];
   const upserts=payload.vocab_tematico.filter((r: any)=>r.tipo&&r.valor&&validTipos.includes(r.tipo.trim()))
     .map((r: any)=>({rpg_id:rpgId,tipo:r.tipo.trim(),valor:r.valor.trim()}));
   if(upserts.length){
     await sb('vocabulario_tematico',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates'},body:JSON.stringify(upserts)});
   }
 }
 // Importar mapas gerados por IA (arquivo JSON separado)
 if (mapasJSON && mapasJSON.length) {
   await importarMapasJSON(rpgId, mapasJSON);
 }
 return rpgId;
}


async function updateRPG(rpgId: string, payload: any): Promise<string[]>{
 const sections=Object.keys(payload).filter(k=>payload[k]&&payload[k].length);
 let levelConfig=null;
 for(const sec of sections){
   if(sec==='config'){
     const cfg=payload.config[0];
     const theme = buildTheme(cfg);
     levelConfig=theme.level_config||null;
     await sb(`rpg_registry?rpg_id=eq.${encodeURIComponent(rpgId)}`,{method:'PATCH',body:JSON.stringify({
       name:cfg.name||rpgId,
       theme_json:theme
     })});
   }
   else{
     const TABLE_MAP: Record<string, any> = {characters:'characters',skills:'skills',lore:'lore',attr_defs:'attr_defs',item_catalog:'item_catalog',inventario:'inventario'};
     const tbl=TABLE_MAP[sec];
     if(tbl){
       await sb(`${tbl}?rpg_id=eq.${encodeURIComponent(rpgId)}`,{method:'DELETE'});
       await insertSection(rpgId,sec,payload[sec],levelConfig);
     }
   }
 }
 return sections;
}


// ── RPC helper (Postgres functions via PostgREST /rpc/<name>) ─────────────
// Reaproveita sb(): mantém retry 57014, refresh 401 e Bearer do usuário.
// Uso: const row = await sbRpc('npc_apply_damage', { _rpg, _npc, _delta, _attacker, _nonce });
async function sbRpc<T = any>(name: string, args: any = {}): Promise<T | null> {
  return sb(`rpc/${encodeURIComponent(name)}`, {
    method: 'POST',
    body: JSON.stringify(args || {}),
    prefer: 'return=representation',
  });
}
try { window.sbRpc = sbRpc; } catch(_) {}


// ── SESSION STATE (Modo Aventura — camada B snapshots) ────────────
// rpg_session_state.rpg_id é uuid com FK para rpg_registry; aventuras com id
// string usam a tabela avt_session_state (chave text, sem FK) — ver
// docs/migration_avt_session_state.sql. Sem a migração aplicada, as chamadas
// falham e o chamador (RTNet) tolera o erro (resync segue só via peer snapshot).
function _isUuidId(id: string | null | undefined): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));
}

async function sessionStateGet(rpgId: string): Promise<(RpgSessionStateRow | AvtSessionStateRow)[] | null> {
  if (_isUuidId(rpgId)) {
    return sb<RpgSessionStateRow[]>(`rpg_session_state?rpg_id=eq.${encodeURIComponent(rpgId)}&select=*`);
  }
  return sb<AvtSessionStateRow[]>(`avt_session_state?session_key=eq.${encodeURIComponent(rpgId)}&select=*`);
}

async function sessionStateUpdate(rpgId: any, snapshot: any) {
  if (_isUuidId(rpgId)) {
    return sbRpc('update_session_snapshot', { p_rpg_id: rpgId, p_snapshot: snapshot });
  }
  return sbRpc('update_avt_session_snapshot', { p_key: String(rpgId), p_snapshot: snapshot });
}

try { window.sessionStateGet    = sessionStateGet;    } catch(_) {}
try { window.sessionStateUpdate = sessionStateUpdate; } catch(_) {}

// ── PATCH v9: helper sessionData ─────────────────────────────────────────
async function salvarSessionData(rpgId: string, userId: string, patch: Record<string, any>) {
  if (!rpgId || !userId || !patch) return null;
  try {
    const row = await sb(`rpg_members?rpg_id=eq.${encodeURIComponent(rpgId)}&player_id=eq.${encodeURIComponent(userId)}&select=session_data`);
    const cur = (row && row[0]?.session_data) || {};
    const next = { ...cur, ...patch };
    return await sb(`rpg_members?rpg_id=eq.${encodeURIComponent(rpgId)}&player_id=eq.${encodeURIComponent(userId)}`,
      { method: 'PATCH', body: JSON.stringify({ session_data: next }) });
  } catch(e) { try { console.warn('[SB] salvarSessionData:', e); } catch(_){} return null; }
}
if (typeof window !== 'undefined') window.salvarSessionData = salvarSessionData;

// ── SFX Biblioteca do Mestre (armazenada em user_metadata) ───────────────────
async function sfxBibliotecaCarregar() {
  if (!SESSION?.access_token) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SESSION.access_token}` }
    });
    const data = await res.json();
    if (data.user_metadata) {
      if (!SESSION.user) SESSION.user = {} as any;
      SESSION.user.user_metadata = data.user_metadata;
      try { localStorage.setItem('rpghub_session', JSON.stringify(SESSION)); } catch(_) {}
    }
    return data.user_metadata?.sfx_biblioteca || [];
  } catch(e) { try { console.warn('[SFX]', e); } catch(_) {} return []; }
}

async function sfxBibliotecaSalvar(biblioteca: any[]) {
  if (!SESSION?.access_token) throw new Error('Não autenticado');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SESSION.access_token}`
    },
    body: JSON.stringify({ data: { sfx_biblioteca: biblioteca } })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  if (!SESSION.user) SESSION.user = {} as any;
  if (!SESSION.user.user_metadata) SESSION.user.user_metadata = {};
  SESSION.user.user_metadata.sfx_biblioteca = biblioteca;
  try { localStorage.setItem('rpghub_session', JSON.stringify(SESSION)); } catch(_) {}
  return biblioteca;
}

try { window.sfxBibliotecaCarregar = sfxBibliotecaCarregar; } catch(_) {}
try { window.sfxBibliotecaSalvar   = sfxBibliotecaSalvar;   } catch(_) {}

/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "sb", { configurable: true, writable: true, value: sb });
Object.defineProperty(globalThis, "uploadToStorage", { configurable: true, writable: true, value: uploadToStorage });
Object.defineProperty(globalThis, "getAllRPGs", { configurable: true, writable: true, value: getAllRPGs });
Object.defineProperty(globalThis, "getRPGData", { configurable: true, writable: true, value: getRPGData });
Object.defineProperty(globalThis, "_carregarProgressivo", { configurable: true, writable: true, value: _carregarProgressivo });
Object.defineProperty(globalThis, "saveCharacterStats", { configurable: true, writable: true, value: saveCharacterStats });
Object.defineProperty(globalThis, "_normalizarCharRow", { configurable: true, writable: true, value: _normalizarCharRow });
Object.defineProperty(globalThis, "saveMemberLinked", { configurable: true, writable: true, value: saveMemberLinked });
Object.defineProperty(globalThis, "deleteRPGData", { configurable: true, writable: true, value: deleteRPGData });
Object.defineProperty(globalThis, "buildLevelConfig", { configurable: true, writable: true, value: buildLevelConfig });
Object.defineProperty(globalThis, "calcularHpMaxComAtributos", { configurable: true, writable: true, value: calcularHpMaxComAtributos });
Object.defineProperty(globalThis, "buildTheme", { configurable: true, writable: true, value: buildTheme });
Object.defineProperty(globalThis, "insertSection", { configurable: true, writable: true, value: insertSection });
Object.defineProperty(globalThis, "importRPG", { configurable: true, writable: true, value: importRPG });
Object.defineProperty(globalThis, "updateRPG", { configurable: true, writable: true, value: updateRPG });
Object.defineProperty(globalThis, "sbRpc", { configurable: true, writable: true, value: sbRpc });
Object.defineProperty(globalThis, "sessionStateGet", { configurable: true, writable: true, value: sessionStateGet });
Object.defineProperty(globalThis, "sessionStateUpdate", { configurable: true, writable: true, value: sessionStateUpdate });
Object.defineProperty(globalThis, "salvarSessionData", { configurable: true, writable: true, value: salvarSessionData });
Object.defineProperty(globalThis, "sfxBibliotecaCarregar", { configurable: true, writable: true, value: sfxBibliotecaCarregar });
Object.defineProperty(globalThis, "sfxBibliotecaSalvar", { configurable: true, writable: true, value: sfxBibliotecaSalvar });
