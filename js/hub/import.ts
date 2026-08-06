// hub/import.js
// RPG Hub — RPG import system, AI-assisted generation, map import, tab navigation
// Includes: abrirImport(), importRPGJSON(), AI map generation prompts, abrirAba(), mostrarToast()

// ── IMPORT ────────────────────────────────────────────────────
let IMPORT_MODE='novo';
const PLABELS: Record<string, any> = {novo:{completo:'Gerar arquivo completo com IA (Novo RPG)',config:'Gerar seção Config (Novo RPG)',characters:'Gerar seção Personagens (Novo RPG)',skills:'Gerar seção Habilidades (Novo RPG)',lore:'Gerar seção Lore (Novo RPG)',attr_defs:'Gerar seção Atributos (Novo RPG)',attr_grupos:'Gerar Mapeamento de Atributos (Novo RPG)',vocab_tematico:'Gerar Vocabulário Temático (Novo RPG)',item_catalog:'Gerar Catálogo de Itens (Novo RPG)',inventario:'Gerar Inventários Iniciais (Novo RPG)'},atualizar:{completo:'Gerar arquivo completo com IA (Atualizar)',config:'Gerar seção Config (Atualizar)',characters:'Gerar seção Personagens (Atualizar)',skills:'Gerar seção Habilidades (Atualizar)',lore:'Gerar seção Lore (Atualizar)',attr_defs:'Gerar seção Atributos (Atualizar)',attr_grupos:'Gerar Mapeamento de Atributos (Atualizar)',vocab_tematico:'Gerar Vocabulário Temático (Atualizar)',item_catalog:'Gerar Catálogo de Itens (Atualizar)',inventario:'Gerar Inventários Iniciais (Atualizar)'}};


function setImportMode(mode: any){
 IMPORT_MODE=mode;const isAt=mode==='atualizar';
 document.getElementById('import-title').textContent=isAt?'Atualizar RPG':'Importar Novo RPG';
 document.getElementById('rpg-update-selector').style.display=isAt?'block':'none';
 document.getElementById('modo-novo-btn').style.cssText=`flex:1;padding:10px;background:${isAt?'none':'rgba(200,168,75,0.15)'};border:none;color:${isAt?'#7a92aa':'#f0cc6a'};font-family:'Cinzel',serif;font-size:0.7rem;cursor:pointer;text-transform:uppercase`;
 document.getElementById('modo-atualizar-btn').style.cssText=`flex:1;padding:10px;background:${isAt?'rgba(79,163,209,0.15)':'none'};border:none;color:${isAt?'#7ec8f0':'#7a92aa'};font-family:'Cinzel',serif;font-size:0.7rem;cursor:pointer;text-transform:uppercase`;
 document.getElementById('btn-import-submit').textContent=isAt?'Atualizar RPG':'Importar RPG';
 document.getElementById('req-config').textContent=isAt?'Opcional — atualiza tema e nome':'Obrigatório — define ID, nome, tema visual';
 document.getElementById('asterisco-config').style.display=isAt?'none':'inline';
 Object.keys(PLABELS[mode]).forEach(s=>{const el=document.getElementById('label-'+s);if(el)el.textContent=PLABELS[mode][s];});
}


function preencherSeletorRPGs(){const sel=document.getElementById('rpg-update-select');sel.innerHTML='<option value="">Selecione...</option>';(HUB_DATA.rpgs||[]).forEach(r=>{const o=document.createElement('option');o.value=r.rpg_id;o.textContent=r.name;sel.appendChild(o);});}
function abrirImport(){
  // Cancelar loading pendente caso ainda esteja animando
  const lel=document.getElementById('loading');
  if(lel){lel.classList.remove('visible');lel.style.opacity='1';lel.style.transition='';}
  Object.keys(IMPORT_CSVS).forEach(k=>delete IMPORT_CSVS[k]);
  setImportMode('novo');
  preencherSeletorRPGs();
  document.querySelectorAll('.import-status').forEach(el=>el.style.display='none');
  document.querySelectorAll('input[type=file]').forEach(el=>el.value='');
  document.querySelectorAll('textarea[id^="paste-"]').forEach(el=>el.value='');
  // Popular select de RPGs para importação avulsa de mapas
  const sel = document.getElementById('mapas-rpg-select');
  if (sel && HUB_DATA?.rpgs?.length) {
    sel.innerHTML = '<option value="">Selecione o RPG...</option>' +
      HUB_DATA.rpgs.map(r => `<option value="${r.rpg_id}">${r.nome||r.rpg_id}</option>`).join('');
  }
  document.getElementById('hub').style.display='none';
  document.getElementById('app').classList.remove('visible');
  document.getElementById('import-screen').style.display='block';
}
function fecharImport(){
  document.getElementById('import-screen').style.display='none';
  document.getElementById('app').classList.remove('visible');
  document.getElementById('hub').style.display='';
}
function abrirPixiStudio(){
  document.getElementById('hub').style.display='none';
  const scr=document.getElementById('pixi-studio-screen');
  if(scr) scr.style.display='flex';
  if(typeof pixiStudioInit==='function') pixiStudioInit();
}
function fecharPixiStudio(){
  const scr=document.getElementById('pixi-studio-screen');
  if(scr) scr.style.display='none';
  if(typeof PIXI_STUDIO_STATE!=='undefined' && PIXI_STUDIO_STATE._origin==='aventura'){
    PIXI_STUDIO_STATE._origin=null;
    const menu=document.getElementById('avt-menu-screen');
    if(menu) menu.style.display='flex';
  } else {
    document.getElementById('hub').style.display='';
  }
}


function lerCSV(tipo: any,input: any){const f=input.files[0];if(!f)return;const st=document.getElementById('status-'+tipo),rd=new FileReader();rd.onload=e=>{try{const p=parseCSV(e.target.result);p.forEach(r=>Object.keys(r).forEach(k=>{if(typeof r[k]==='string')r[k]=r[k].replace(/\\n/g,'\n');}));IMPORT_CSVS[tipo]=p;st.textContent=`✓ ${p.length} linha(s)`;st.className='import-status ok';st.style.display='block';}catch(err){st.textContent=`✗ ${err.message}`;st.className='import-status err';st.style.display='block';}};rd.readAsText(f,'UTF-8');}

// Lê CSV colado como texto
function lerCSVPaste(tipo: any, texto: any) {
  const st = document.getElementById('status-' + tipo);
  if (!texto || !texto.trim()) { IMPORT_CSVS[tipo] = null; if(st){st.style.display='none';} return; }
  try {
    const p = parseCSV(texto);
    p.forEach(r => Object.keys(r).forEach(k => { if(typeof r[k]==='string') r[k]=r[k].replace(/\\n/g,'\n'); }));
    IMPORT_CSVS[tipo] = p;
    if (st) { st.textContent = `✓ ${p.length} linha(s) (texto colado)`; st.className='import-status ok'; st.style.display='block'; }
  } catch(err) {
    if (st) { st.textContent = `✗ ${err.message}`; st.className='import-status err'; st.style.display='block'; }
    IMPORT_CSVS[tipo] = null;
  }
}

function lerAllInOne(input: any){const f=input.files[0];if(!f)return;const st=document.getElementById('status-allinone'),rd=new FileReader();rd.onload=e=>{try{const secs=parseMultiSection(e.target.result);const ns=Object.keys(secs);if(!ns.length)throw new Error('Nenhuma seção encontrada.');ns.forEach(s=>IMPORT_CSVS[s]=secs[s]);st.textContent=`✓ ${ns.length} seção(ões): ${ns.join(', ')}`;st.className='import-status ok';st.style.display='block';}catch(err){st.textContent=`✗ ${err.message}`;st.className='import-status err';st.style.display='block';}};rd.readAsText(f,'UTF-8');}

// Lê CSV all-in-one colado como texto
function lerAllInOnePaste(texto: any) {
  const st = document.getElementById('status-allinone');
  if (!texto || !texto.trim()) { if(st) st.style.display='none'; return; }
  try {
    const secs = parseMultiSection(texto);
    const ns = Object.keys(secs);
    if (!ns.length) throw new Error('Nenhuma seção encontrada. Use #SECTION:config, #SECTION:characters…');
    ns.forEach(s => IMPORT_CSVS[s] = secs[s]);
    if (st) { st.textContent = `✓ ${ns.length} seção(ões): ${ns.join(', ')} (texto colado)`; st.className='import-status ok'; st.style.display='block'; }
  } catch(err) {
    if (st) { st.textContent = `✗ ${err.message}`; st.className='import-status err'; st.style.display='block'; }
  }
}

// Lê JSON de mapas via input de arquivo
function lerMapasJSONFile(input: any) {
  const file = input.files[0];
  if (!file) return;
  const st = document.getElementById('status-mapas');
  const reader = new FileReader();
  reader.onload = e => {
    _processarMapasJSONTexto(e.target.result, st);
  };
  reader.readAsText(file);
}

// Lê JSON de mapas via texto colado
function lerMapasJSONPaste(texto: any) {
  const st = document.getElementById('status-mapas');
  if (!texto || !texto.trim()) { _mapasImportJSON = null; if(st) st.style.display='none'; return; }
  _processarMapasJSONTexto(texto, st);
}

function _processarMapasJSONTexto(texto: any, st: any) {
  try {
    const raw = texto.replace(/^```[a-z]*\n?/,'').replace(/```$/,'').trim();
    const data = JSON.parse(raw);
    const arr = Array.isArray(data) ? data : (data.mapas ? data.mapas : [data]);
    if (!arr.length || !arr[0].map_id) throw new Error('JSON inválido: cada mapa precisa de map_id');

    const comSvg    = arr.filter((m: any) => m.svg && m.svg.includes('<svg')).length;
    const comConfig = arr.filter((m: any) => m.largura_total || m.escala_val).length;
    _mapasImportJSON = arr;

    const labels = arr.map((m: any) => {
      const tipoIcon = m.tipo === 'geral' ? '🌍' : '🏰';
      const dims = m.largura_total ? ` ${m.largura_total}×${m.altura_total}cél` : '';
      return `${tipoIcon} ${m.nome||m.map_id}${dims}`;
    }).join(', ');

    const formatInfo = comSvg > 0
      ? ` · ${comSvg} com SVG`
      : comConfig > 0 ? ` · config sem imagem (adicione a imagem depois)` : '';

    if (st) {
      st.innerHTML = `<span style="color:var(--sucesso)">✓ ${arr.length} mapa(s)${formatInfo}: ${labels}</span>`;
      st.style.display='block';
    }
  } catch(err) {
    if (st) { st.innerHTML = `<span style="color:var(--perigo)">✗ JSON inválido: ${err.message}</span>`; st.style.display='block'; }
    _mapasImportJSON = null;
  }
}

// Importa APENAS os mapas num RPG já existente (sem precisar de CSV)
async function importarSoMapas() {
  const rpgId = document.getElementById('mapas-rpg-select').value;
  const st = document.getElementById('status-mapas');
  const mostrarSt = (msg: any, tipo: any) => {
    if (st) { st.innerHTML = `<span style="color:var(--${tipo==='ok'?'sucesso':'perigo'})">${msg}</span>`; st.style.display='block'; }
  };
  if (!rpgId) { mostrarSt('✗ Selecione um RPG antes de importar', 'err'); return; }
  if (!_mapasImportJSON || !_mapasImportJSON.length) { mostrarSt('✗ Nenhum JSON de mapas carregado. Use o arquivo ou cole o texto acima.', 'err'); return; }
  mostrarSt('⏳ Importando mapas…', 'ok');
  try {
    const count = _mapasImportJSON.length;
    await importarMapasJSON(rpgId, _mapasImportJSON);
    // ── Recarregar mapas em memória se este for o RPG ativo ──
    if (RPG_DATA?.rpgId === rpgId) {
      try {
        const mapasRaw = await sb(`mapas?rpg_id=eq.${encodeURIComponent(rpgId)}&select=id,rpg_id,map_id,nome,escala_val,escala_unit,grid,parent_map_id,tipo,zona_x,zona_y,zona_w_percent,zona_h_percent,largura_total,altura_total,largura_real,altura_real,representar_pct,locais,render_data&order=id`);
        RPG_DATA.mapas = (mapasRaw||[]).map((m: any)=>({
          id: m.id, rpg_id: rpgId,
          mapa:{map_id:m.map_id,nome:m.nome,img_url:'',escala_val:m.escala_val??1.5,escala_unit:m.escala_unit||'m',grid:m.grid??20,parent_map_id:m.parent_map_id||null,tipo:m.tipo||'geral',zona_x:m.zona_x,zona_y:m.zona_y,zona_w_percent:m.zona_w_percent,zona_h_percent:m.zona_h_percent,largura_total:m.largura_total||null,altura_total:m.altura_total||null,largura_real:m.largura_real||null,altura_real:m.altura_real||null,representar_pct:m.representar_pct??100,locais:Array.isArray(m.locais)?m.locais:[],render_data:m.render_data||null}
        }));
        if (typeof renderMapasTab === 'function') renderMapasTab();
      } catch(e) {}
    }
    mostrarSt(`✓ ${count} mapa(s) importado(s)! Abra a campanha na aba Mapas e adicione as imagens de fundo via ⚙ de cada mapa.`, 'ok');
    _mapasImportJSON = null;
    document.getElementById('paste-mapas').value = '';
    document.getElementById('file-mapas').value = '';
  } catch(e) {
    mostrarSt(`✗ Erro: ${e.message}`, 'err');
  }
}

function parseMultiSection(text: any){const res: Record<string, any> = {},lines=text.split(/\r?\n/);let cur: any=null,buf: any[]=[];const flush=()=>{if(cur&&buf.length>1){const p=parseCSV(buf.join('\n'));p.forEach(r=>Object.keys(r).forEach(k=>{if(typeof r[k]==='string')r[k]=r[k].replace(/\\n/g,'\n');}));res[cur]=p;}};lines.forEach((l: any)=>{const m=l.match(/^#SECTION:([\w-]+)/i);if(m){flush();cur=m[1];buf=[];}else if(!l.startsWith('#')&&l.trim())buf.push(l);});flush();return res;}
function parseCSV(text: any){
  const ls=text.trim().split(/\r?\n/);
  if(!ls.length)return[];
  const h=parseCSVLine(ls[0]);
  const rows=[];
  for(let ri=1;ri<ls.length;ri++){
    const l=ls[ri];
    if(!l.trim())continue;
    const v=parseCSVLine(l);
    // ── Aviso: linha com menos campos que o cabeçalho ──────────────────
    if(v.length < h.length){
      console.warn(`[parseCSV] Linha ${ri+1} tem ${v.length} campo(s) mas o cabeçalho tem ${h.length}. Campos faltando serão strings vazias. Verifique colunas: ${h.slice(v.length).join(', ')}`);
    }
    const o: Record<string, any> = {};
    h.forEach((k,i)=>o[k.trim()]=(v[i]||'').trim());
    rows.push(o);
  }
  return rows;
}
function parseCSVLine(line: any){
  const r=[];let cur='',inQ=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(inQ&&line[i+1]==='"'){cur+='"';i++;} // "" → " (escaped quote)
      else inQ=!inQ;
    } else if(ch===','&&!inQ){r.push(cur);cur='';}
    else cur+=ch;
  }
  // ── Aviso: aspas não fechadas (campo multi-linha real ou CSV malformado) ──
  if(inQ){console.warn('[parseCSVLine] Aspas não fechadas — campo pode estar malformado. Linha truncada em:', line.slice(-60));}
  r.push(cur);return r;
}


async function enviarImport(){
 const btn=document.getElementById('btn-import-submit');
 if(IMPORT_MODE==='atualizar'){
   const rpgId=document.getElementById('rpg-update-select').value;
   if(!rpgId){showSt('status-import','Selecione qual RPG atualizar','err');return;}
   const secs=Object.keys(IMPORT_CSVS).filter(k=>IMPORT_CSVS[k]&&IMPORT_CSVS[k].length);
   if(!secs.length){showSt('status-import','Nenhum arquivo carregado','err');return;}
   btn.disabled=true;btn.textContent='Atualizando...';
   try{const upd=await updateRPG(rpgId,IMPORT_CSVS);showSt('status-import',`✓ Atualizado: ${upd.join(', ')}`,'ok');HUB_DATA.rpgs=await getAllRPGs()||[];setTimeout(fecharImport,2000);}
   catch(e){showSt('status-import',`✗ ${e.message}`,'err');}
   finally{btn.disabled=false;btn.textContent='Atualizar RPG';}
   return;
 }
 if(!IMPORT_CSVS.config||!(IMPORT_CSVS as any).config.length){showSt('status-import','#SECTION:config é obrigatório','err');return;}
 if(IMPORT_CSVS.characters&&IMPORT_CSVS.characters.length&&(!IMPORT_CSVS.attr_defs||!(IMPORT_CSVS as any).attr_defs.length)){showSt('status-import','⚠ #SECTION:characters requer #SECTION:attr_defs para definir os atributos. Adicione a seção attr_defs ao arquivo.','err');return;}
 btn.disabled=true;btn.textContent='Importando...';
 try{const rpgId=await importRPG(IMPORT_CSVS, _mapasImportJSON);showSt('status-import',`✓ "${(IMPORT_CSVS as any).config[0].name}" importado!`,'ok');HUB_DATA.rpgs=await getAllRPGs()||[];renderRPGList(HUB_DATA.rpgs);setTimeout(fecharImport,2000);}
 catch(e){showSt('status-import',`✗ ${e.message}`,'err');}
 finally{btn.disabled=false;btn.textContent='Importar RPG';}
}


function showSt(id: any,msg: any,tipo: any){const el=document.getElementById(id);el.textContent=msg;el.className='import-status '+tipo;el.style.display='block';}



// ── PROMPTS IA ────────────────────────────────────────────────

// ── SPECS TÉCNICOS — alinhados ao SQL atual ───────────────────
// Tabelas: rpg_registry, characters, skills, lore, attr_defs, mapas
const SPECS: Record<string, any> = {

// ─── #SECTION:config ──────────────────────────────────────────
// Salvo em: rpg_registry.theme_json (buildTheme)
// Campos diretos: rpg_id, name
// Campos via theme_json: todos os demais abaixo
config:`Colunas: rpg_id,name,description,font_display,font_text,font_url,animation,animation_css,card_icon_svg,animation_loading_svg,theme_preto,theme_escuro,theme_painel,theme_borda,theme_cinza,theme_texto,theme_suave,theme_primario,theme_primario_v,theme_destaque,theme_destaque_v,theme_perigo,theme_sucesso,theme_especial,nivel_maximo,hp_base,hp_por_nivel,hp_attr,hp_attr_mult,pontos_attr_por_nivel,aumentos_automaticos_json,habilidades_por_nivel_json,velocidade_base,velocidade_fator,turno_modo_exclusivo

Significado de cada coluna:

rpg_id — Identificador único da campanha. Lowercase, sem espaços, sem acentos. Ex: "aethelgard", "cthulhu_2025". NUNCA repita um rpg_id existente.
name — Nome exibido da campanha para os jogadores.
description — Frase ou duas que descrevem a campanha. Aparece no card de seleção.

━━━ IDENTIDADE VISUAL — PRIORIDADE #1 ━━━

O visual é o que os jogadores sentem antes de jogar. Cada campanha deve ter uma identidade única e memorável.

card_icon_svg — Ícone exibido no card de seleção da campanha.
  • viewBox="0 0 32 32" — obrigatório para encaixar no container do card
  • Use #COLOR1 e #COLOR2 como placeholders de cor — substituídos automaticamente pelas cores primário e destaque da campanha
  • Evite filtros CSS, blur e gradientes complexos: o ícone renderiza em ~32–44px na tela. Formas com silhueta clara e bordas definidas garantem legibilidade nesse tamanho
  • Explore ao máximo a expressividade dentro do viewBox — o sistema suporta qualquer SVG válido

animation — Nome da animação (string curta, sem espaços). Ex: "flame", "rift_salamander", "void_pulse"

animation_loading_svg — SVG exibido durante 2–3 segundos de loading. Mais elaborado que o ícone.
  • OBRIGATÓRIO: use as variáveis CSS var(--destaque), var(--primario), var(--primario-v), var(--destaque-v) nas cores do SVG — é assim que o asset responde automaticamente ao tema da campanha
  • O container limita a área de exibição; o viewBox pode ser qualquer proporção adequada ao design
  • Explore animações, paths complexos, gradientes e efeitos que serão animados pelo campo animation_css via CSS

animation_css — CSS que anima o SVG de loading. Formato exato:
  ".anim-NOME svg{animation:NOME 2s ease-in-out infinite}@keyframes NOME{0%{transform:scale(1);filter:drop-shadow(0 0 6px var(--destaque));opacity:0.8}50%{transform:scale(1.08);filter:drop-shadow(0 0 16px var(--destaque-v));opacity:1}100%{transform:scale(1);filter:drop-shadow(0 0 6px var(--destaque));opacity:0.8}}"
  O nome da classe DEVE ser .anim-{valor do campo animation}.

━━━ TIPOGRAFIA ━━━

font_display — Fonte para títulos e headers. Google Fonts. Ex: "Cinzel" (épico), "Pirata One" (piratas), "Uncial Antiqua" (medieval), "Orbitron" (sci-fi), "Creepster" (horror)
font_text — Fonte para corpo de texto. Ex: "Crimson Text", "Lora", "Merriweather", "IM Fell English"
font_url — URL completa do Google Fonts com ambas as fontes.
  ⛔ CAMPO CRÍTICO: URLs do Google Fonts contêm vírgulas internas (ex: "ital,wght@0,400;1,400"). Se a URL NÃO estiver entre aspas duplas no CSV, essas vírgulas quebram o parser e deslocam TODOS os campos seguintes — o campo "animation" receberá lixo e aparecerá colado ao título da campanha na tela de seleção.
  ✅ SEMPRE envolva font_url entre aspas duplas no CSV, mesmo que a URL não contenha espaços.
  ✅ Ex correto:  ,"https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Crimson+Text:ital,wght@0,400;1,400&display=swap",
  ❌ Ex ERRADO:   ,https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Crimson+Text:ital,wght@0,400;1,400&display=swap,

━━━ PALETA DE CORES ━━━

Cada cor define a atmosfera emocional. Escolha com intenção — o jogador SENTE a campanha pela cor.

theme_preto — Fundo mais escuro. Backgrounds e profundidade. Ex: "#080c10"
theme_escuro — Cards e painéis secundários. Ex: "#0f1520"
theme_painel — Superfícies de conteúdo. Ex: "#141d2b"
theme_borda — Separadores e bordas sutis. Ex: "#1e2d42"
theme_cinza — Estados inativos, elementos desabilitados. Ex: "#2a3a50"
theme_texto — Texto principal legível. Ex: "#c8d8e8"
theme_suave — Texto secundário, metadados. Ex: "#7a92aa"
theme_primario — Cor interativa principal: botões, links, foco. Ex: "#4fa3d1"
theme_primario_v — Variante mais clara para hover/destaque. Ex: "#7ec8f0"
theme_destaque — Cor protagonista: títulos, elementos hero. Ex: "#c8a84b"
theme_destaque_v — Versão mais brilhante do destaque. Ex: "#f0cc6a"
theme_perigo — Dano, alertas críticos, perda. Ex: "#c0392b"
theme_sucesso — Cura, vitória, positivo. Ex: "#27ae60"
theme_especial — Magia, itens raros, mecânicas únicas. Ex: "#7b2fbe"

Guia de psicologia das cores por gênero:
• Fantasia sombria → roxos profundos, vermelhos sangue, azuis frios
• Alta fantasia → dourados reais, verdes esmeralda, roxo imperial
• Cyberpunk → rosas neon, cyans elétricos, preto profundo
• Horror → verdes doentios, vermelhos dessaturados, cinzas frios
• Pós-apocalíptico → laranjas enferrujados, marrons sujos, amarelos desbotados
• Space opera → azuis profundos, brancos prata, roxos cósmicos

Regras CSV (OBRIGATÓRIAS — violações causam importação corrompida):
  • "" para aspas internas em qualquer campo (ex: width=""32""). Mantenha SVG em uma única linha (sem quebras reais).
  • Qualquer campo que contenha vírgula DEVE estar entre aspas duplas. Isso inclui obrigatoriamente:
    - font_url (URLs do Google Fonts sempre têm vírgulas internas)
    - description, background, animation_css, card_icon_svg, animation_loading_svg
    - Qualquer texto livre com vírgula, ponto e vírgula ou aspas
  • ⛔ NÃO omita as aspas em font_url. É o erro mais comum e corrompe silenciosamente todos os campos seguintes (animation, cores, SVGs).

━━━ SISTEMA DE NÍVEL (OPCIONAL) ━━━

nivel_maximo — Nível máximo da campanha. Padrão: 20. Ex: 10 para campanhas curtas.
hp_base — HP Máximo no nível 1. Ex: 100 para campanhas simples, 30 para sistemas mais granulares.
hp_por_nivel — Quanto de HP Máximo aumenta por nível. Ex: 10 significa +10 HP a cada level up.
hp_attr — Nome EXATO do atributo que contribui com HP Máximo (deve existir em attr_defs). Ex: "Constituição". Deixe VAZIO se HP não depende de atributo.
hp_attr_mult — Multiplicador do atributo no cálculo de HP. Ex: 3 → HP_max = hp_base + (Constituição × 3). Deixe 0 se não usar hp_attr.
  Exemplo: hp_base=50, hp_attr="Constituição", hp_attr_mult=3, Constituição=15 → HP_max=50+(15×3)=95.
pontos_attr_por_nivel — Pontos de atributo ganhos por nível para distribuição livre. Ex: 1 ou 2.
aumentos_automaticos_json — JSON com atributos que aumentam automaticamente a cada nível. Ex: {"Força":1,"Mana":2} — aumenta Força em +1 e Mana em +2 a cada level up.
habilidades_por_nivel_json — JSON mapeando nível → lista de habilidades desbloqueadas. Ex: {"3":["Golpe Duplo"],"5":["Fúria Berserker"]} — habilidades ficam bloqueadas até o personagem atingir o nível necessário.

Deixe esses campos em branco se a campanha não usar sistema de progressão de nível.

━━━ SISTEMA DE MOVIMENTO ━━━

velocidade_base      — Células que o personagem pode mover por turno (sem bônus). Padrão: 4.
velocidade_fator     — Divisor da Destreza para calcular bônus de velocidade.
  Velocidade final = velocidade_base + floor(Destreza / velocidade_fator)
  Exemplo: base=4, fator=4, Destreza=12 → velocidade = 4 + 3 = 7 células/turno.
turno_modo_exclusivo — "true" se mover E atacar no mesmo turno é proibido (ou atacar OU mover).
  "false" ou vazio = pode fazer ambos no mesmo turno (padrão).

Deixe velocidade_base e velocidade_fator em branco para usar os padrões (4 e 4).`,


// ─── #SECTION:characters ──────────────────────────────────────
// Salvo em: tabela characters
// nome, hp_atual, nivel, hp_max → colunas diretas
// tipo, cor, img_url, background, equipamentos, companheiro → custom_attrs jsonb
characters:`⚠️ TRANSCREVA APENAS personagens que JÁ EXISTEM no material. NÃO invente, NÃO crie exemplos. Campo sem informação → deixe em BRANCO.

Colunas: nome,nivel,hp_max,hp_atual,tipo,cor,img_retrato,img_full,img_url,background,equipamentos,companheiro

⛔ REGRA CRÍTICA DE COLUNAS — LEIA ANTES DE GERAR:
Toda linha DEVE ter exatamente 12 campos separados por vírgula. Campos vazios NÃO podem ser omitidos.
Estrutura obrigatória do final de cada linha:
  → COM equipamentos, SEM companheiro:  ,"item1, item2",
  → SEM equipamentos, COM companheiro:  ,,Nome do Companheiro
  → SEM os dois:                        ,,
  → COM os dois:                        ,"item1, item2",Nome Companheiro
Omitir a vírgula do campo vazio é o erro mais comum.

nome — Nome exato do personagem. Cada linha = um personagem único.

nivel — Nível atual do personagem. Padrão: 1. Ex: 3 para um guerreiro de médio poder.

hp_max — HP Máximo do personagem (valor absoluto). Calculado como hp_base + (nivel-1)*hp_por_nivel da campanha. Se não houver level_config, use o valor bruto. Ex: 120.

hp_atual — HP atual do personagem como valor absoluto (NÃO percentual). Padrão: igual ao hp_max (personagem com vida cheia). Ex: 85 (personagem ferido com 85 de 120 HP).

tipo — Classifica o ser:
  "jogador"  → Personagem controlado por jogador (PC). Tem ficha completa, habilidades únicas.
  "npc"      → Controlado pelo mestre. Pode ser aliado, inimigo elaborado, comerciante.
  "criatura" → Monstro, besta, ser sem linguagem ou consciência humana.
  "objeto"   → Entidade inanimada com mecânicas (armadilha, construto, golem sem vontade).

img_retrato — URL do rosto/busto para o token circular no mapa.
img_full    — URL do corpo inteiro para a ficha do personagem.
img_url     — Legado; equivale a img_retrato se não preenchido.

cor — Cor hexadecimal do token no mapa. Escolha que represente o personagem.
  Ex: guerreiro → "#e8604c" | mago → "#7b2fbe" | aliado → "#4fa3d1" | criatura → "#c0392b"

background — História, motivações, personalidade do personagem. Use \\n para parágrafos.

equipamentos — Lista de itens separados por vírgula. Ex: "Espada longa, Escudo de carvalho, Poção de cura ×2"
  Se o personagem não tem equipamentos, deixe o campo vazio — mas MANTENHA A VÍRGULA separadora.

companheiro — Nome de um companheiro/familiar do personagem, se houver. Vazio se não houver.

EXEMPLOS CORRETOS (conte as vírgulas antes de gerar!):
  Goblin,1,30,30,criatura,#8b3a1e,,Goblin comum de floresta.,,
  Aragorn,5,120,80,jogador,#4fa3d1,,Ranger habilidoso.,"Espada longa, Arco élfico",
  Gandalf,10,100,100,npc,#c8a84b,,Mago cinzento.,Bordão,Balrog`,


// ─── #SECTION:skills ──────────────────────────────────────────
// Salvo em: tabela skills
// efeitos_bonus_json (CSV) → efeitos_bonus (coluna DB, tipo jsonb array)
skills:`⚠️ TRANSCREVA APENAS habilidades que JÁ EXISTEM no material. NÃO invente. Campo sem informação → deixe em BRANCO.

Colunas: personagem,habilidade,custo_rsv,custo_tipo,efeito,formula_dano,alcance_celulas,cooldown_turnos,tipo_dano,atributo_base,alvo_tipo,efeitos_bonus_json,critico_positivo,critico_negativo,animacao_json

custo_tipo — "acao" (padrão) | "movimento" (consome movimento) | "nenhum" (passiva/reação)

animacao_json — OBRIGATÓRIO PARA TODAS AS SKILLS — Animação exibida no mapa quando a habilidade é usada.
O motor aceita três sistemas independentes que podem ser combinados livremente em um único JSON.

POSIÇÃO do efeito (campo "posicao"):
  "alvo"         → impacto no ponto de chegada (golpe, explosão, cura, debuff de contato)
  "atacante"     → emana do caster (buff, aura, carregamento)
  "meio"         → área central entre os combatentes
  "trajetoria"   → algo viaja do atacante ao alvo (projétil, onda)
  "raio"         → raio contínuo que conecta atacante e alvo
  "area"         → AoE ampla centrada entre os combatentes
  "multiplo_alvo"→ efeito que se replica em cadeia para tokens adjacentes
  "orbital"      → orbita em torno do atacante
  "cadeia"       → salta de alvo em alvo visualmente
  "sequencial"   → multi-golpe rápido no mesmo alvo
  "retorno"      → projétil vai ao alvo e volta ao atacante

DURAÇÃO: golpe rápido 500–900ms | ataque normal 900–1400ms | magia épica 1600–2800ms | invocação 2000–4000ms

SISTEMA 1 — PIXI PARTICLES (partículas canvas):
{"tipo":"pixi_particles","posicao":"<POSIÇÃO>","duracao":<MS>,"repeticao":1,"pixi_config":[<EMISSORES>]}
Campos por emissor: alpha:{start,end} scale:{start,end} color:{start,end} speed:{start,end}
  acceleration:{x,y} startRotation:{min,max} rotationSpeed:{min,max} lifetime:{min,max}
  frequency emitterLifetime maxParticles addAtBack(bool)
  blendMode("add"|"screen"|"normal"|"multiply") particleShape("circle"|"star"|"diamond"|"spark"|"ring")
  spawnType("point"|"circle"|"ring"|"burst") spawnCircle:{x,y,r}
  glowStrength(0–5) turbulence(0–3) stretchSquash(bool)
  timingCurve("linear"|"overshoot"|"elastic"|"bounce"|"pulse")
  impactFrame:{at,duration,timeScale} hangTime:{at,duration}
  persistentDecal:{enabled,fadeTime,flicker,color,alpha}
  customShapeCode: string (código canvas; vars: ctx, size, progress)

SISTEMA 2 — GSAP (animação de token DOM, em paralelo):
Adicione "gsap_config": {"preset":"<PRESET>","cor":"#hex","duracao":<ms>,"intensidade":<0.3-2.0>,"alvo_efeito":"alvo"|"atacante"|"ambos"}
Presets: impacto_shake | impacto_escala | aura_pulso | critico_espiral | cura_flutuante
         lancamento | token_dash | token_teleport | token_arremesso_volta | token_recuo

SISTEMA 3 — ANIMAÇÃO ESQUELÉTICA (bones procedurais, em paralelo):
Adicione "spine_config": {"duracao":<ms>,"posicao":"<POSIÇÃO>","escala":<0.1-3.0>,"skeleton":{...}}
skeleton.bones: [{id, parent?, x, y, length}]
skeleton.slots: [{bone, draw:{type("circle"|"rect"|"line"|"arc"), fill, glow?, alpha?, composite?}}]
skeleton.tracks: [{bone, keyframes:[{t(0-1), angle, alpha?, scaleX?, scaleY?}]}]

FORMATOS ACEITOS (use um, dois ou três sistemas):
Apenas Pixi: {"tipo":"pixi_particles","posicao":"alvo","duracao":1200,"pixi_config":[...]}
Pixi+GSAP:   {"tipo":"pixi_particles","posicao":"alvo","duracao":1200,"pixi_config":[...],"gsap_config":{...}}
Triple:      {"tipo":"pixi_particles","posicao":"alvo","duracao":1800,"pixi_config":[...],"gsap_config":{...},"spine_config":{...}}

INVOCAÇÃO (alvo_tipo="invocacao" ou nome indica criatura/objeto):
A animação representa a APARIÇÃO da entidade — como ela emerge no mundo físico.
Não é um ataque: é materialização, rasgo no éter, emergência do solo, silhueta ganhando forma.
Use posicao "alvo" ou "area", duracao longa (2000–4000ms), e construa em camadas (surgimento → forma → presença).

⚠️ REGRAS CSV PARA animacao_json:
- O JSON inteiro DEVE estar entre aspas duplas
- Aspas internas do JSON devem ser escapadas como "" (padrão CSV)
- Mantenha tudo em uma única linha — sem quebras reais de linha
- Campos vazios/nulos: deixe a célula em branco (sem null nem {})

personagem — Nome EXATO de um personagem da seção characters.
habilidade — Nome oficial da habilidade/poder/técnica.
custo_rsv — Custo para usar: "2 Mana", "1 Stamina", "Passiva". Vazio se não houver custo.
efeito — Descrição completa do que a habilidade faz. Não resuma.
formula_dano — Fórmula de dados. Formatos válidos: "2d6", "1d8+3", "3d4-1", "1d6+1d8", "10" (valor fixo). VAZIO se não causa dano numérico.
alcance_celulas — Inteiro de células de grade (mesmo sistema que a régua do mapa: 1 célula = espaço de 1 token).
  • VAZIO = sem limite de alcance (padrão para a maioria das habilidades)
  • Use número APENAS se o material fonte indicar explicitamente um alcance limitado
  • Referência visual pela régua: adjacente/corpo-a-corpo=1, arremesso curto≈3–5, arco/magia média≈8–12, longo alcance≈15–20
  • Se o material indicar metros/pés e você não souber a escala do mapa → deixe VAZIO (melhor ilimitado do que errar)
  • A régua in-game mede exatamente esta distância: tokens a 3 células = alcance_celulas 3 alcança, a 4 não alcança
cooldown_turnos — Inteiro de turnos indisponível após uso. 0 ou VAZIO = sem cooldown.

tipo_dano — Use EXATAMENTE um destes valores:
  "fisico"   → corte, impacto, perfuração
  "magico"   → magia arcana genérica
  "fogo"     → chamas, calor
  "gelo"     → frio, congelamento
  "veneno"   → toxina, doença, corrosão
  "cura"     → restauração de vida
  "psiquico" → mente, ilusão, medo
  "outro"    → não se enquadra nos anteriores

atributo_base — Nome EXATO do atributo que a habilidade usa (de attr_defs). Determina se o ataque é físico ou mágico para fins de bloqueio. VAZIO se a habilidade não usa atributo específico.
tipo_dano — MUITO IMPORTANTE para o sistema de resistências: o tipo definido aqui é usado para verificar se o alvo tem resistência correspondente em attr_defs (categoria=resistencia). Use tipos consistentes entre skills e attr_defs de resistência.

alvo_tipo — Use EXATAMENTE um destes valores:
  "inimigo"        → atinge um inimigo (padrão para ataques)
  "proprio"        → afeta apenas o próprio personagem (buffs pessoais, auto-cura)
  "aliado"         → afeta um aliado escolhido dentro do alcance
  "todos_aliados"  → afeta todos os aliados dentro do alcance (AoE de suporte)
  "todos_inimigos" → atinge todos os inimigos dentro do alcance (AoE ofensivo)

efeitos_bonus_json — Array JSON de efeitos aplicados automaticamente ao acertar. VAZIO se não houver.
  Cada objeto no array representa um efeito. Use apenas os campos relevantes:

  Positivos (buffs):
    "hot_formula": "1d6"         → cura por turno (HOT)
    "hot_turnos": 3              → duração do HOT
    "boost_dano": 5              → aumenta dano do ALVO em +N por turno
    "boost_dano_turnos": 2       → duração do boost
    "rec_atributo": "Mana"       → nome do atributo recuperado (deve existir em attr_defs)
    "rec_formula": "1d8"         → fórmula ou valor fixo de recuperação
    "rec_modo": "turno"          → "imediato" (uma vez) ou "turno" (por turno)
    "rec_turnos": 3              → duração se rec_modo="turno"

  Negativos (debuffs):
    "dot_formula": "1d6"         → dano por turno (DOT)
    "dot_turnos": 3              → duração do DOT
    "sem_movimento": true        → imobiliza o alvo
    "sem_movimento_turnos": 2    → duração da imobilização
    "sem_ataque": true           → impede o alvo de atacar
    "sem_ataque_tipo": "todos"   → "todos", "fisico" ou "magico"
    "sem_ataque_turnos": 1       → duração do bloqueio de ataque
    "mod_dano": -3               → reduz o dano do alvo em N
    "mod_dano_turnos": 2         → duração do debuff de dano

  Um único efeito pode combinar múltiplos campos. Exemplos:
    [{"nome":"Veneno","dot_formula":"1d4","dot_turnos":3}]
    [{"nome":"Regeneração","hot_formula":"1d8","hot_turnos":4}]
    [{"nome":"Bênção de Combate","boost_dano":4,"boost_dano_turnos":3}]
    [{"nome":"Paralisia","sem_movimento":true,"sem_movimento_turnos":2,"sem_ataque":true,"sem_ataque_tipo":"todos","sem_ataque_turnos":2}]
    [{"nome":"Queimadura","dot_formula":"1d6","dot_turnos":3,"mod_dano":-2,"mod_dano_turnos":2}]
    [{"nome":"Restaurar Mana","rec_atributo":"Mana","rec_formula":"2d6","rec_modo":"turno","rec_turnos":3}]

  Use aspas duplas dentro do JSON. A coluna inteira é um array: [{...},{...}]

critico_positivo — Efeito narrativo ou mecânico especial em acerto crítico. Vazio se não definido.
critico_negativo — Consequência em falha crítica. Vazio se não definido.`,


// ─── #SECTION:lore ────────────────────────────────────────────
// Salvo em: tabela lore (filtrado: secao != 'mapa' ao carregar)
lore:`⚠️ TRANSCREVA APENAS lore que está NO MATERIAL. NÃO invente reinos, magias ou facções.

Colunas: secao,titulo,conteudo

secao — OBRIGATÓRIO — NOT NULL. Categoria temática. Use EXATAMENTE um destes valores:
  "mundo"     → geografia, lugares, clima, cosmologia, planetas
  "magia"     → sistemas de magia, feitiços, artefatos, regras do arcano
  "sociedade" → culturas, costumes, religiões, raças, idiomas
  "segredo"   → informações ocultas, conspirações, verdades escondidas (visíveis APENAS ao mestre)
  "historia"  → eventos passados, cronologia, guerras, lendas
  "facoes"    → grupos, guildas, exércitos, facções políticas, suas relações e objetivos
  "regras"    → mecânicas específicas do sistema, regras da casa, como funcionam certos sistemas

titulo — Nome desta entrada. Ex: "Reino de Aethelgard", "A Grande Maré", "Guilda dos Mercadores"

conteudo — Texto completo da entrada. Use \\n para parágrafos. Seja fiel ao material — não resuma demais.

Dica: prefira múltiplas entradas curtas e bem categorizadas a uma entrada longa e genérica.`,


// ─── #SECTION:attr_defs ───────────────────────────────────────
// Salvo em: tabela attr_defs
// categoria é salvo e usado extensamente no app (basico/especial)
attr_defs:`⚠️ TRANSCREVA APENAS atributos que o sistema REALMENTE USA. NÃO invente. NÃO adicione atributos genéricos de RPG que não estejam no material.

Colunas: nome,tipo,opcoes,ordem,categoria

nome — Nome exato do atributo como aparece no sistema. Ex: "Força", "Constituição", "Armadura", "Resistência ao Gelo"

tipo — Como o valor é representado:
  "number"  → valor numérico (Força, Constituição, Armadura, Mana, Resistência…)
  "text"    → texto livre (Ocupação, Alinhamento descritivo, Notas, Raça)
  "boolean" → sim/não, verdadeiro/falso (ex: "Amaldiçoado", "Iniciado na Ordem")
  "select"  → uma opção de lista fechada. Requer o campo "opcoes".

opcoes — Uso varia por categoria:
  tipo=select: valores possíveis separados por vírgula. Ex: "Bem,Neutro,Mal"
  categoria=resistencia: JSON de configuração (ver abaixo).
  categoria=status: JSON de fórmula do pool máximo (ver abaixo).
  Demais casos: deixe VAZIO.

ordem — Número de posição na ficha. 1 aparece primeiro.

categoria — MUITO IMPORTANTE. Define em quais personagens este atributo aparece E como é calculado:

  "basico"     → presente em TODOS (incluindo criaturas/NPCs genéricos).
                 Use para: Força, Destreza, Constituição, Defesa, Iniciativa.

  "especial"   → aparece APENAS em personagens jogadores e NPCs elaborados/nomeados.
                 Use EXCLUSIVAMENTE para atributos intrinsecamente ligados à lore/narrativa
                 do personagem — algo que define quem ele é, não o que ele consome.
                 Exemplos corretos: Sanidade, Possessão, Karma, Herança Mágica, Vínculo,
                 Corrupção, Honra, Fé, Renome.
                 ⚠️ NÃO USE para recursos gastos em habilidades (Mana, Stamina, Ki, etc.)
                 — esses são "status".

  "status"     → Atributos dinâmicos que mudam constantemente durante uma sessão.
                 São exibidos por padrão na mesa de jogo (visíveis sem clicar no personagem).
                 Inclui OBRIGATORIAMENTE: HP (gerado automaticamente), Nível, XP.
                 Inclui TAMBÉM: todos os recursos gastos em habilidades — Mana, Stamina, Ki,
                 Energia, Pontos de Ação, Sanidade (quando consumida por habilidades), etc.
                 opcoes (JSON, opcional): {"max_base":50,"max_attr":"Magia","max_mult":2}
                 → significa: pool máximo = 50 + (valor_de_Magia × 2). Deixe vazio para valor manual.

  "resistencia" → Armadura ou resistência elemental. Afeta o cálculo de dano recebido.
                  Presente em TODOS (basico) por padrão para armadura, ou apenas elaborados para resistências específicas.
                  opcoes (JSON, OBRIGATÓRIO):

                  Armadura (reduz todo dano + bônus para tipos específicos):
                  {"tipo":"armadura","pct_geral":10,"pct_fisico":50}
                  → pct_geral: % do VALOR da armadura reduzido de TODO dano (ceil).
                  → pct_fisico: % adicional do valor reduzido apenas de dano físico (ceil).
                  → pct_magico: % adicional apenas de dano mágico (opcional).
                  Exemplo: Armadura=20, pct_geral=10, pct_fisico=50:
                    Todo dano: -ceil(20×10%)= -2
                    Dano físico adicional: -ceil(20×50%)= -10
                    Ataque físico de 14 → 14-2-10=2 de dano

                  Resistência elemental (por tipo de dano de skill):
                  {"tipo":"resistencia","damage_type":"gelo","modo":"percentual"}
                  → damage_type: tipo exato da skill (gelo, fogo, veneno, magico, psiquico…)
                  → modo "percentual": valor do atributo usado como %. Ex: Resistência=10 → -10% do dano (ceil)
                  → modo "absoluto": valor do atributo subtraído diretamente do dano
                  → damage_type pode ser array: ["gelo","agua"] para resistir múltiplos tipos

REGRAS PRÁTICAS:
• "Guarda aleatório" ou "Lobo da floresta" teria? → "basico"
• Afeta o cálculo de dano recebido? → "resistencia"
• É um recurso gasto em habilidades (Mana, Stamina, Ki…)? → "status"
• Muda constantemente durante uma party (HP, XP, nível)? → "status"
• É algo profundo da identidade/lore do personagem, não gasto em combate? → "especial"
• Armaduras são "resistencia" categoria "basico" (toda criatura tem ou tem 0).
• Resistências elementais geralmente são "resistencia" com categoria "basico" ou "especial" conforme o caso.
• DICA: se o jogador "gasta" ou "recupera" durante uma sessão → "status". Se define quem ele é narrativamente → "especial".`,

// ─── #SECTION:attr_grupos ─────────────────────────────────────
// Salvo em: tabela atributos_grupos
attr_grupos:`Classifica os atributos da campanha nos 4 grupos universais do motor de balanceamento.
Colunas: nome_customizado,grupo_base

nome_customizado — Nome EXATO do atributo (deve bater com attr_defs da campanha, mesmos acentos e maiúsculas)
grupo_base — UM dos 4 valores fixos: forca | destreza | constituicao | inteligencia

CRITÉRIOS DE CLASSIFICAÇÃO:
• Força (forca): atributos que aumentam dano físico, peso carregado, intimidação física
  Ex: Força, Poder, Potência, Musculatura, Ataque Físico
• Destreza (destreza): velocidade, precisão, furtividade, reflexos, acrobacia
  Ex: Destreza, Agilidade, Precisão, Velocidade, Esquiva
• Constituição (constituicao): HP, resistência, vitalidade, endurance, defesa passiva
  Ex: Constituição, Vitalidade, Resistência, Defesa, Endurance
• Inteligência (inteligencia): magia, percepção, carisma, diplomacia, lore, social
  Ex: Inteligência, Carisma, Percepção, Sabedoria, Mana, Arcana

Recursos de gasto (Mana, Stamina, Ki) → use o grupo do efeito principal da habilidade que os consome.
Atributos ambíguos → inteligencia (mais abrangente). Marque no último campo "revisar" se necessário.
NÃO inclua atributos de resistência elemental ou categorias especiais — só os de combate/progressão base.`,

// ─── #SECTION:vocab_tematico ──────────────────────────────────
// Salvo em: tabela vocabulario_tematico
vocab_tematico:`Vocabulário para geração automática de nomes de itens com identidade temática da campanha.
Colunas: tipo,valor

tipo — EXATAMENTE um de: prefixo_material | adjetivo_qualidade | nome_origem

prefixo_material — Material do qual o item é feito. Substantivo simples.
  Ex (fantasia medieval): Ferro, Aço, Mithril, Obsidiana, Osso, Couro, Prata, Rúnico
  Ex (lovecraftiano): Coral Negro, Quartzo Cavernoso, Carne Fundida, Tendon Antigo
  Ex (sci-fi): Carbono, Titânio, Nanofibra, Plasma Solidificado, Cromo Pulsante
  Quantidade recomendada: 12–20 entradas

adjetivo_qualidade — Adjetivo que descreve a natureza mágica/especial do item. Uma palavra.
  Ex (fantasia medieval): Afiado, Forjado, Sombrio, Encantado, Antigo, Corrompido, Sagrado
  Ex (lovecraftiano): Sussurrante, Devorador, Insano, Espreitante, Abissal, Profano
  Ex (sci-fi): Overclocked, Blindado, Neural, Furtivo, Ionizado, Psiônico
  Quantidade recomendada: 15–25 entradas

nome_origem — Sufixo de lugar, evento ou entidade de origem (para itens Raros+). "da/do + ..."
  Ex (fantasia medieval): da Forja Esquecida, do Rei Traído, das Sombras Eternas, da Ordem Caída
  Ex (lovecraftiano): de Yuggoth, do Vazio Dançante, do Culto Submerso, do Sonho Fendido
  Ex (sci-fi): do Colapso Estelar, da Singularidade, da IA Primordial, da Estação Morta
  Quantidade recomendada: 10–15 entradas

REGRA: seja temático. Os nomes gerados serão como: "Cajado Coral Negro Sussurrante do Culto Submerso".
Evite palavras genéricas (ex: "Bom", "Médio") — prefira termos com identidade narrativa.`,

// ─── #SECTION:item_catalog ────────────────────────────────────
// Salvo em: tabela item_catalog
// População do catálogo de itens da campanha — consumíveis, equipamentos, misc
item_catalog:`Colunas: nome,tipo,descricao,icone,raridade,valor_base,slot_padrao,atributos_bonus_json,efeitos_json,alvo,alcance_m,requer_aprovacao,nivel_minimo_uso,peso,img_url,unico_no_mundo,tipo_canonico

VISÃO GERAL DO SISTEMA DE ITENS:
• item_catalog = catálogo mestre de todos os itens. Cada linha é um tipo de item.
• Jogadores têm instâncias desses itens em seus inventários (#SECTION:inventario).
• O Mercado é abastecido a partir do item_catalog.
• O catálogo também pode ser importado separadamente via JSON ou CSV na aba Tabelas → "⬇ Importar Catálogo".
• Tabelas do tipo Mercado podem ser populadas via JSON/CSV referenciando itens pelo nome — o sistema casa automaticamente com o catálogo.

─── TIPOS DE ITEM ───

tipo — OBRIGATÓRIO. Use EXATAMENTE um destes:
  "consumivel" → Use uma vez e some. Poções, pergaminhos, flechas, venenos, comidas.
  "equipamento" → Equipa em slot. Armas, armaduras, acessórios. Altera atributos automaticamente.
  "misc"        → Sem mecânica automática. Chaves, troféus, ingredientes, itens de missão.

─── CAMPOS GERAIS ───

nome          — Nome do item. Ex: "Poção de Cura", "Espada de Aço Rúnico", "Fragmento de Obsidiana"
descricao     — Texto lore/mecânico completo do item. O jogador lê isso ao inspecionar.
icone         — Emoji representativo. Ex: 🧪 ⚔️ 🛡️ 💍 🎯 🪄 💎 🧲 🗡️ 🪬 📜 🧨 🍖
raridade      — EXATAMENTE um: "comum" | "incomum" | "raro" | "epico" | "lendario"
valor_base    — Preço em ouro (float). Base para cálculo de compra/venda no mercado.
img_url       — URL de imagem. Opcional.
nivel_minimo_uso — Nível mínimo para usar/equipar. OBRIGATÓRIO — NOT NULL. Use 1 se não houver restrição de nível. NUNCA deixe vazio ou em branco; o valor mínimo aceito é 1.
peso          — Peso em unidades (float). Vazio se a campanha não usa sistema de carga.
unico_no_mundo — "true" se apenas um exemplar pode existir entre TODOS os personagens. Ao ser comprado ou adquirido por alguém, nenhum outro personagem pode obtê-lo. Use para itens lendários icônicos, artefatos únicos, relíquias de missão. Vazio ou omitido = false (padrão).
tipo_canonico — Subtipo interno para slots especiais. Normalmente igual a "tipo" para consumíveis e misc. Para equipamentos, usa o valor do slot (ex: "arma_principal", "amuleto"). Deixe vazio — o sistema deriva automaticamente a partir de slot_padrao.

─── CAMPOS DE EQUIPAMENTO ───

slot_padrao   — OBRIGATÓRIO para tipo=equipamento. EXATAMENTE um:
  cabeca | corpo | maos | pernas | pes | arma_principal | arma_secundaria | anel | amuleto | capa

atributos_bonus_json — JSON: dicionário atributo→valor que é somado ao equipar e subtraído ao desequipar.
  Os NOMES das chaves devem bater EXATAMENTE com os attr_defs da campanha (mesmas maiúsculas, acentos).
  Exemplos:
  {"Armadura":5}                          → escudo simples
  {"Força":3,"Armadura":2}                → elmo guerreiro
  {"Mana":25,"Inteligência":2}            → cajado mágico
  {"Destreza":2,"Iniciativa":3}           → luvas de ladrão
  {"Resistência ao Fogo":15}              → manto gnômico
  {"Armadura":8,"Força":1,"Destreza":-1}  → armadura pesada (penaliza destreza)

─── CAMPOS DE CONSUMÍVEL ───

alvo — Quem recebe o efeito:
  "self"    → sempre o próprio usuário
  "aliado"  → aliado escolhido pelo jogador
  "inimigo" → inimigo escolhido (itens hostis)
  ""        → mestre decide na hora de aprovar

alcance_m    — Distância máxima de uso em metros. Vazio = sem limite.
requer_aprovacao — FALSE por padrão (aprovação automática). Use "true" apenas para dano em área, debuff em outros ou efeito narrativo complexo, mesmo com alvo definido. Vazio = false.

efeitos_json — Array JSON de efeitos aplicados ao usar. Campos por tipo de efeito:

  CURA / DANO DIRETO:
  [{"tipo":"hp","valor":30}]                         → cura 30 HP
  [{"tipo":"hp","valor":-15}]                        → causa 15 de dano (veneno ingerido)

  RECURSO (Mana, Stamina, Ki, etc.):
  [{"tipo":"recurso","recurso":"Mana","valor":20}]   → recupera 20 Mana
  [{"tipo":"recurso","recurso":"Stamina","valor":-5}]→ drena 5 Stamina

  ATRIBUTO TEMPORÁRIO:
  [{"tipo":"atributo","atributo":"Força","valor":3,"turnos":5}]  → +3 Força por 5 turnos
  [{"tipo":"atributo","atributo":"Força","valor":3,"turnos":0}]  → +3 Força permanente

  DEBUFF:
  [{"tipo":"debuff","debuff":"Envenenado","duracao_turnos":4}]   → aplica Envenenado por 4 turnos

  REMOVER DEBUFF:
  [{"tipo":"remover_debuff","debuff":"Envenenado"}]              → cura Envenenado

  DANO DE ARREMESSO:
  [{"tipo":"dano","valor":8}]                                     → causa 8 de dano (hostil)

  COMBINADOS (array com múltiplos efeitos):
  [{"tipo":"hp","valor":50},{"tipo":"recurso","recurso":"Mana","valor":20}]   → poção dupla

EXEMPLOS COMPLETOS POR CATEGORIA:

Consumíveis de cura:
  Poção de Cura Pequena   → tipo=consumivel, icone=🧪, raridade=comum,    valor=10,  efeitos=[{"tipo":"hp","valor":20}],  alvo=self
  Poção de Cura Média     → tipo=consumivel, icone=🧪, raridade=incomum,  valor=30,  efeitos=[{"tipo":"hp","valor":50}],  alvo=self|aliado
  Elixir da Regeneração   → tipo=consumivel, icone=💉, raridade=raro,     valor=80,  efeitos=[{"tipo":"hp","valor":100},{"tipo":"recurso","recurso":"Mana","valor":30}], alvo=self

Consumíveis de recurso:
  Poção de Mana           → tipo=consumivel, icone=🫧, raridade=comum,    valor=15,  efeitos=[{"tipo":"recurso","recurso":"Mana","valor":25}],  alvo=self
  Cristal de Stamina      → tipo=consumivel, icone=💠, raridade=incomum,  valor=25,  efeitos=[{"tipo":"recurso","recurso":"Stamina","valor":20}],alvo=self

Consumíveis de buff:
  Elixir da Força         → tipo=consumivel, icone=💪, raridade=incomum,  valor=40,  efeitos=[{"tipo":"atributo","atributo":"Força","valor":4,"turnos":3}], alvo=self

Consumíveis ofensivos:
  Veneno de Basilisco     → tipo=consumivel, icone=🧪, raridade=raro,     valor=60,  efeitos=[{"tipo":"debuff","debuff":"Petrificado","duracao_turnos":2}], alvo=inimigo, alcance_m=1, requer_aprovacao=true
  Frasco de Ácido         → tipo=consumivel, icone=🧫, raridade=incomum,  valor=35,  efeitos=[{"tipo":"dano","valor":15},{"tipo":"debuff","debuff":"Corroído","duracao_turnos":3}], alvo=inimigo, alcance_m=5

Antídotos:
  Antídoto Comum          → tipo=consumivel, icone=🌿, raridade=comum,    valor=12,  efeitos=[{"tipo":"remover_debuff","debuff":"Envenenado"}], alvo=aliado
  Purificação Sagrada     → tipo=consumivel, icone=✨, raridade=raro,     valor=70,  efeitos=[{"tipo":"remover_debuff","debuff":"Maldição"},{"tipo":"remover_debuff","debuff":"Envenenado"}], alvo=aliado

Equipamentos — armas:
  Espada Longa de Aço     → tipo=equipamento, slot=arma_principal, raridade=comum,   valor=50,  atributos_bonus={"Força":2}
  Adaga Envenenada        → tipo=equipamento, slot=arma_secundaria,raridade=incomum, valor=80,  atributos_bonus={"Destreza":3,"Veneno":2}
  Cetro Arcano            → tipo=equipamento, slot=arma_principal, raridade=raro,    valor=150, atributos_bonus={"Inteligência":4,"Mana":20}

Equipamentos — proteção:
  Elmo de Ferro           → tipo=equipamento, slot=cabeca,         raridade=comum,   valor=30,  atributos_bonus={"Armadura":3}
  Armadura de Placas      → tipo=equipamento, slot=corpo,          raridade=incomum, valor=120, atributos_bonus={"Armadura":10,"Força":1,"Destreza":-2}
  Botas Velozes           → tipo=equipamento, slot=pes,            raridade=incomum, valor=45,  atributos_bonus={"Destreza":2,"Iniciativa":2}

Equipamentos — acessórios:
  Anel de Proteção        → tipo=equipamento, slot=anel,           raridade=incomum, valor=60,  atributos_bonus={"Armadura":2,"Resistência à Magia":5}
  Amuleto do Dragão       → tipo=equipamento, slot=amuleto,        raridade=epico,   valor=400, atributos_bonus={"Resistência ao Fogo":25,"Força":5}

Misc (sem mecânica):
  Chave da Masmorra       → tipo=misc, icone=🗝️, raridade=misc, valor=0
  Fragmento de Runa       → tipo=misc, icone=🔮, raridade=incomum, valor=25
  Cabeça do Dragão        → tipo=misc, icone=🐲, raridade=lendario, valor=1000

ESTRATÉGIA DE BALANCEAMENTO DO CATÁLOGO:
• Consumíveis de cura: HP curado = ~20-30% do hp_max no nível 1, escalando com raridade
• Preço de equipamentos: comum ≤ 80, incomum ≤ 200, raro ≤ 500, épico ≤ 2000, lendário ilimitado
• Balancear Armadura (defensiva) vs bônus de ataque: um item bom em defesa deve ter tradeoff (penalidade de Destreza ou similar)
• Itens lendários devem ser únicos, com história e efeitos que mudam o estilo de jogo — use unico_no_mundo=true para lendários icônicos
• Sempre criar versões escaladas (Pequena/Média/Grande) de consumíveis básicos para dar opções ao longo da progressão

─── IMPORTAÇÃO SEPARADA (JSON / CSV) ───

Além do #SECTION:item_catalog no CSV principal, o catálogo pode ser importado de forma independente na aba Tabelas → botão "⬇ Importar Catálogo". Campos aceitos no JSON/CSV de importação direta:

JSON mínimo:
[
  {"nome":"Espada de Aço","tipo":"equipamento","raridade":"incomum","icone":"⚔️","slot_padrao":"arma_principal","atributos_bonus":{"Força":2},"valor_base":150},
  {"nome":"Poção de Cura","tipo":"consumivel","raridade":"comum","icone":"🧪","efeitos":[{"tipo":"hp","valor":30}],"alvo":"self","valor_base":30},
  {"nome":"Espada Lendária do Rei","tipo":"equipamento","raridade":"lendario","icone":"⚔️","unico_no_mundo":true,"valor_base":5000}
]

Equivalente CSV:
nome,tipo,raridade,icone,slot_padrao,atributos_bonus_json,efeitos_json,alvo,valor_base,unico_no_mundo,descricao
Espada de Aço,equipamento,incomum,⚔️,arma_principal,"{""Força"":2}",,150,false,Uma espada robusta
Poção de Cura,consumivel,comum,🧪,,,"[{""tipo"":""hp"",""valor"":30}]",self,30,false,Restaura vitalidade
Espada Lendária do Rei,equipamento,lendario,⚔️,arma_principal,"{""Força"":8}",,5000,true,Forjada para o rei eterno

─── POPULANDO TABELA-MERCADO VIA IMPORTAÇÃO ───

Tabelas do tipo Mercado podem ser populadas via JSON/CSV referenciando itens pelo nome. Os itens precisam já existir no catálogo. Gere no seguinte formato:

JSON:
[
  {"item":"Poção de Cura","preco":50,"estoque":10},
  {"item":"Espada de Aço","preco":200,"estoque":3},
  {"item":"Amuleto do Dragão","preco":800}
]

CSV:
item,preco,estoque
Poção de Cura,50,10
Espada de Aço,200,3
Amuleto do Dragão,800,`,

// ─── #SECTION:inventario ──────────────────────────────────────
// Distribui itens iniciais aos personagens — instâncias do item_catalog
inventario:`Popula o inventário inicial dos personagens. Cada linha = uma instância de item no inventário.
PROCESSE SOMENTE APÓS #SECTION:item_catalog estar completo.

Colunas: personagem,item,quantidade,equipado,notas

personagem — Nome EXATO de um personagem da seção characters.
item       — Nome EXATO de um item da seção item_catalog.
quantidade — Inteiro. Padrão: 1. Consumíveis múltiplos (ex: 3 para "3 poções").
equipado   — "true" se o item começa equipado no slot correspondente. "false" ou vazio se no inventário.
             ATENÇÃO: um personagem não pode começar com dois itens equipados no mesmo slot.
notas      — Texto livre (origem, condição especial, identificação). Vazio se não houver.

ESTRATÉGIA DE DISTRIBUIÇÃO INICIAL:
• Personagens jogadores de nível 1 tipicamente começam com 1-2 consumíveis pequenos + equipamento básico
• NPCs importantes têm equipamento representativo de seu papel (guarda → armadura+arma)
• Criaturas raramente têm inventário (só quando têm loot especial definido)
• Equipar automaticamente o melhor item disponível para o slot — o sistema desequipa automaticamente ao equipar outro
• Personagens com especialização arcana → privilegiar equipamentos de Mana e itens de buff mágico
• Personagens de combate corpo-a-corpo → começar com arma equipada + item de cura reserva

Exemplos:
  Arthur (guerreiro nível 1): Espada Longa de Aço [equipado=true], Elmo de Ferro [equipado=true], Poção de Cura Pequena [qtd=2]
  Lyra (maga nível 1): Cetro Arcano [equipado=true], Poção de Mana [qtd=2], Livro de Feitiços [qtd=1]
  Thief NPC: Adaga Envenenada [equipado=true], Veneno de Basilisco [qtd=1]`

}; // fim SPECS

// ── SPEC DE CONFIGURAÇÃO DE MAPAS (sem SVG) ───────────────────
const SPEC_MAPAS_CONFIG = `━━━ CONFIGURAÇÃO DE MAPAS — FORMATO JSON ━━━

Retorne um array JSON. Cada objeto é um mapa. SEM SVG, SEM imagem embutida.
A imagem pode ser adicionada depois pelo usuário. Retorne APENAS o array JSON.

Campos de cada mapa:
{
  "map_id":         "id_unico_lowercase_sem_espacos",
  "nome":           "Nome legível do local",
  "tipo":           "mundo" | "tatico",
  "parent_map_id":  null,
  "escala_val":     1.5,
  "escala_unit":    "m",
  "grid":           20,
  "largura_total":  20,
  "altura_total":   16,
  "fog_inicial":    "fechado" | "revelado" | "sem_fog",
  "descricao":      "Descrição atmosférica",
  "locais": [
    {
      "local_id":     "id_zona",
      "nome":         "Rótulo da zona",
      "zona_tipo":    "interesse" | "perigo" | "saida" | "bau_grupo" | "passagem",
      "mapa_local_id":"map_id do mapa destino (transições)",
      "x_percent":    50,
      "y_percent":    10,
      "raio":         20
    }
  ]
}

━━━ TIPOS DE MAPA ━━━

MUNDO  (tipo:"mundo")  → orientação narrativa, sem grade, sem fog. fog_inicial:"sem_fog"
TÁTICO (tipo:"tatico") → exploração/combate, grade fixa, fog progressivo. fog_inicial:"fechado"
BATALHA → não é mapa separado — é estado do mapa tático atual.

━━━ HIERARQUIA ━━━

NÍVEL 1 — MUNDO (parent_map_id:null) escala km. locais[] → táticos nível 2.
NÍVEL 2 — TÁTICO urbano/exterior. escala 5–50m. locais[] → interiores nível 3.
NÍVEL 3 — TÁTICO interior. escala 1–3m. grid 20–30. largura/altura em células.

━━━ ZONA_TIPO ━━━

interesse → altar, NPC, pista. Pulso dourado.
perigo    → armadilha, área perigosa. Pulso vermelho.
saida     → porta, escada, passagem. Pulso azul.
bau_grupo → baú compartilhado. Pulso verde.
passagem  → corredor, transição simples. Pulso azul suave.

━━━ TOKENS ━━━

Tokens são posicionados via SPAWN no Pacote de Sessão — NÃO no JSON de configuração.
Coordenada de célula: SPAWN: kael A3 | goblin D5

━━━ FOG ━━━

fog_inicial:"fechado"  → tudo oculto, revela ao mover (padrão táticos)
fog_inicial:"revelado" → tudo visível desde o início
fog_inicial:"sem_fog"  → sem fog (padrão mundos)

━━━ DIMENSÕES ━━━

largura_total / altura_total = CÉLULAS (não metros).
Metros = largura_total × escala_val
Caverna 21m×15m, células 1.5m → largura_total:14, altura_total:10, escala_val:1.5

━━━ EXEMPLO ━━━

[
  {
    "map_id":"regiao_norte","nome":"Região Norte","tipo":"mundo","parent_map_id":null,
    "escala_val":50,"escala_unit":"km","grid":25,"largura_total":40,"altura_total":30,
    "fog_inicial":"sem_fog","descricao":"Planícies ao norte do reino.",
    "locais":[{"local_id":"lz_cav","nome":"Caverna","zona_tipo":"interesse","mapa_local_id":"caverna_entrada","x_percent":60,"y_percent":40,"raio":25}]
  },
  {
    "map_id":"caverna_entrada","nome":"Entrada da Caverna","tipo":"tatico","parent_map_id":"regiao_norte",
    "escala_val":1.5,"escala_unit":"m","grid":20,"largura_total":16,"altura_total":12,
    "fog_inicial":"fechado","zona_x":60,"zona_y":40,"zona_w_percent":14,"zona_h_percent":12,
    "descricao":"Caverna úmida com estalactites.",
    "locais":[
      {"local_id":"saida_fundo","nome":"Passagem para o interior","zona_tipo":"saida","mapa_local_id":"caverna_sala","x_percent":80,"y_percent":50,"raio":15},
      {"local_id":"altar","nome":"Altar Antigo","zona_tipo":"interesse","x_percent":30,"y_percent":30,"raio":12}
    ]
  }
]`


// ── PROMPT MESTRE CONVERSACIONAL ──────────────────────────────
function gerarPromptMestre() {
  return `Você é um assistente especializado no RPG Hub — sistema de RPG de mesa digital. Seu papel é guiar o usuário a configurar a campanha dele de três formas possíveis. Leia tudo antes de responder.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎲 O QUE O SISTEMA SUPORTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PERSONAGENS & FICHAS
• Tipos: jogador (PC com ficha), npc (controlado pelo mestre), criatura (monstros), objeto (armadilhas, construtos)
• HP como percentual visual 0–100%, barra colorida que muda de cor por estado
• Atributos 100% customizáveis pelo narrador: numérico, texto, booleano, seleção de lista
• SISTEMA DE PET / MONTARIA: qualquer personagem pode ser marcado como "pet" vinculado a um dono. Pets com habilidades cadastradas aparecem como ataques extras no turno do dono — o pet não rola iniciativa, não age sozinho e usa sua própria posição no mapa para calcular alcance. Se o dono estiver incapacitado, o pet também não pode agir. Para configurar: na ficha do personagem-pet, marcar "É um pet" e selecionar o dono.
• Quatro categorias de atributo:
  - "basico": aparece em TODOS, inclusive criaturas geradas em batalha (Força, Defesa, etc.)
  - "especial": só personagens principais e NPCs nomeados — APENAS atributos ligados à lore/identidade narrativa do personagem (Sanidade, Possessão, Karma, Corrupção, etc.) que NÃO são recursos gastos em habilidades
  - "status": atributos dinâmicos visíveis por padrão na mesa — HP, Nível, XP e TODOS os recursos gastos/recuperados em habilidades (Mana, Stamina, Ki, Energia, etc.)
  - "resistencia": armadura e resistências elementais — aplicadas automaticamente ao cálculo de dano recebido
• HP máximo pode ser derivado de atributo: hp_base + (Atributo × multiplicador) — configurável na config
• SISTEMA DE RESISTÊNCIAS automático:
  - Armadura reduz dano (% do valor da armadura, configurável por tipo físico/mágico)
  - Resistências elementais reduzem dano de tipo específico (% ou valor absoluto)
  - Fraquezas emergem naturalmente de quem tem 0 de resistência a um tipo
  - Todo cálculo arredonda para cima (ceil), aplicando armadura antes das resistências elementais
• Equipamentos (sistema completo — veja seção abaixo), background narrativo, foto por URL, token colorido no mapa

TABELAS DINÂMICAS
• Aba "Tabelas" com tabelas de colunas e linhas totalmente livres — mercado, lista de NPCs, rotas, preços, rumores, loot tables, qualquer informação que muda durante a campanha
• O mestre cria as colunas e linhas; pode ocultar tabelas dos jogadores
• Ideal para: itens à venda em um mercado, informações compradas de NPCs, tabela de encontros aleatórios, etc.

CATÁLOGO DE ITENS & INVENTÁRIO
• O mestre cria um catálogo de itens (item_defs) com três tipos: consumível, equipamento e misc
• Cada personagem tem um inventário que o mestre (ou o próprio jogador) gerencia
• Item pode ter ícone (emoji), raridade (comum/incomum/raro/épico/lendário) e valor em ouro

CONSUMÍVEIS (itens de uso limitado)
• Efeitos configuráveis por item:
  - hp: cura ou dano direto ao HP (valor positivo = cura, negativo = dano)
  - recurso: recupera ou reduz um recurso (Mana, Stamina, Ki…) pelo nome exato do atributo
  - atributo: aumenta/reduz um atributo temporariamente por N turnos (0 = permanente)
  - remover_debuff: limpa um debuff/buff negativo específico pelo nome
  - dano: causa dano ao alvo (para itens hostis: venenos, facas de arremesso, etc.)
  - debuff: aplica um status negativo ao alvo por N turnos
• Cada consumível tem:
  - alvo: "self" (si mesmo) | "aliado" | "inimigo" | vazio (mestre decide na hora)
  - alcance_m: distância máxima de uso em metros (verificada automaticamente no mapa)
  - requer_aprovacao: FALSE por padrão — aplica automaticamente. true apenas para dano em área, debuff em outros ou efeito narrativo complexo
• Se alvo estiver vazio ou requer_aprovacao=true → uso vai para fila de aprovação do Mestre
• Jogador usa da aba Personagem → seção Inventário → botão Usar/Lançar
• Mestre vê fila de pendências na aba Tabelas e pode Aprovar (aplica efeito) ou Rejeitar

EQUIPAMENTOS (alteram atributos automaticamente)
• Slots disponíveis: cabeca, corpo, maos, pernas, pes, arma_principal, arma_secundaria, anel, amuleto, capa
• bonus_attrs: dicionário de atributo→valor adicionado ao equipar e subtraído ao desequipar
  Ex: { "Armadura": 5, "Força": 2 } → ao equipar, Armadura sobe 5 e Força sobe 2; ao desequipar, volta ao normal
• Os nomes dos atributos em bonus_attrs devem bater exatamente com os attr_defs da campanha
• O mestre adiciona itens ao inventário de qualquer personagem; jogador pode equipar/desequipar clicando no slot
• Um slot só comporta um item de cada vez — equipar um novo desequipa o anterior automaticamente

DICAS DE USO NA CRIAÇÃO DA CAMPANHA
• Se a campanha usa armadura como equipamento (item físico) em vez de atributo fixo → use equipamento com bonus_attrs: { "Armadura": X } e atributo "Armadura" categoria "resistencia"
• Poções de cura simples: tipo=consumivel, efeitos=[{tipo:"hp", valor:30}], alvo="aliado"
• Veneno de contato: tipo=consumivel, efeitos=[{tipo:"debuff", debuff:"Envenenado", duracao_turnos:3}], alvo="inimigo", alcance_m:1
• Arma de arremesso: tipo=consumivel, efeitos=[{tipo:"dano", valor:8}], alvo="inimigo", alcance_m:10
• Elixir de mana: tipo=consumivel, efeitos=[{tipo:"recurso", recurso:"Mana", valor:20}], alvo="self"
• Antídoto: tipo=consumivel, efeitos=[{tipo:"remover_debuff", debuff:"Envenenado"}], alvo="aliado"
• Espada +2 Força: tipo=equipamento, slot="arma_principal", bonus_attrs:{"Força":2}
• Anel de Mana: tipo=equipamento, slot="anel", bonus_attrs:{"Mana":20}

HABILIDADES & COMBATE
• Fórmula de dano livre: 2d6, 1d8+3, 10 (fixo), 1d6+1d8, etc.
• Alcance em células de grade configurável
• Cooldown em turnos
• Tipos de dano: físico, mágico, fogo, gelo, veneno, cura, psíquico, outro
• Atributo base que determina se o ataque é físico ou mágico (usado para bloqueio)
• Alvos: inimigo único, aliado, próprio, todos aliados (AoE), todos inimigos (AoE)
• Efeitos bônus automáticos ao acertar (campo efeitos_bonus_json):
  - DOT: dano por turno (veneno, sangramento, queimadura)
  - HOT: cura por turno (regeneração, bênção)
  - Boost de dano: aumenta os ataques do alvo por N turnos
  - Recuperação de atributo: recarrega Mana/Stamina/etc. imediatamente ou por turno
  - Imobilização: impede movimento por N turnos
  - Bloqueio de ataque: impede atacar (todos/físico/mágico) por N turnos
  - Debuff de dano: reduz o dano do alvo por N turnos
  - Imunidade a dano: alvo é completamente imune por N turnos
    Ex: [{"nome":"Barreira Divina","imune_dano":true,"imune_dano_turnos":2}]
  - Efeito Atrasado: dispara efeito secundário após N turnos. Tipos:
    • dano_aoe: [{"nome":"Bomba Temporal","efeito_atrasado":true,"delay_turnos":2,"tipo_efeito_atrasado":"dano_aoe","formula_dano":"3d8","tipo_dano":"fogo","alcance_celulas":3,"stun_turnos":1}]
    • cura_aoe: [{"nome":"Pulso Sagrado","efeito_atrasado":true,"delay_turnos":1,"tipo_efeito_atrasado":"cura_aoe","formula_cura":"2d6+3","alcance_celulas":2}]
    • buff_aoe: aplica buff/debuff em área após delay
    • movimento: concede células de movimento bônus ao usuário após delay
    • atributo: modifica um atributo após delay
  - Animação persistente: habilidades com duração N turnos podem ter aura visual que permanece no token
    Ex: [{"nome":"Escudo Arcano","imune_dano":true,"imune_dano_turnos":2,"animacao_persistente":true}]
• Crítico positivo e negativo configuráveis
• Bloqueio de ataques físicos ou mágicos via habilidade defensiva
• custo_tipo: "acao" | "movimento" | "nenhum" — que reserva de turno a skill consome
• 1 ação movimento + 1 ação ataque por turno; diagonal = 1 célula (Chebyshev)
• velocidade_base + floor(Destreza/velocidade_fator) células por turno
• 10 arquétipos NPC: agressivo, defensivo, suporte, covarde, protetor, berserk, emboscador, cacador, estrategista, aleatorio

SISTEMA DE REAÇÕES (avançado)
• Habilidades reativas são ativadas fora do turno do personagem, em resposta a eventos do combate
• sistema_reacao: "dnd5e" | "custom" | "none"
• Tipos de reação:
  - "interrupt": bloqueia/cancela o ataque ou ação do oponente antes de acontecer
    → Quando o personagem é alvo de um ataque, o sistema pergunta se quer usar a reação
    → Se usar, o ataque é cancelado completamente
    → Campo movimento_bonus_cancelar: N células de movimento bônus concedido ao reagir
    Ex: Kael com "Recuo Veloz" → interrupt, movimento_bonus_cancelar:3 → ao ser atacado, cancela e ganha +3 de movimento
  - "counter": age imediatamente após o ataque acontecer (contra-ataque, parry)
  - "support": ativa em resposta ao ataque em um aliado (interposição, escudo)
  - "passive": ativa automaticamente sem escolha do jogador
• Rolagem de AC (D&D 5e): com sistema_reacao="dnd5e", o atacante rola d20 + modificadores vs CA do defensor
  Se não atingir a CA → ataque automaticamente falha (miss)
  Configurar no config: sistema_reacao_global = "dnd5e" | "custom"
• Esquiva: habilidade com efeito [{"nome":"Esquiva","esquiva_ativa":true,"esquiva_turnos":1}]
  → Atacante rola 2d20, usa o menor valor (desvantagem)
• custo_reacao: "reacao" — consome a reserva de reação do turno (1 por rodada)

SISTEMA DE BATALHA
• Múltiplas batalhas simultâneas em mapas diferentes
• Iniciativa e ordem de turnos pelo mestre
• Rollback: desfazer última ação de turno
• Pausar/retomar batalha
• Fora de combate: jogador pode enviar solicitação de skill → mestre aprova/recusa
• Log de batalha em tempo real

MAPAS
• Dois tipos: mundo (orientação narrativa) e tático (exploração/combate com grade e fog)
• Tokens: retratos circulares com img_retrato (token) e img_full (ficha separados)
• Batalha é estado do mapa tático — sem mapa filho separado
• Mapas locais dentro de mapas locais (aninhamento livre)
• Dimensionamento por tamanho real (ex: "esta vila tem 200m") com exibição proporcional no mapa pai
• Tokens dos personagens arrastáveis, sincronizados em tempo real
• Medição de distância em células de grade
• Zonas de transição clicáveis entre mapas
• Escala configurável (1 célula = X metros/pés/jardas)
• Imagem de fundo por URL

LORE
• Categorias: mundo, magia, sociedade, segredo (só mestre), história, facções, regras
• Editável durante a sessão

VISUAL & IDENTIDADE
• Tema 100% customizável: 14 variáveis de cor, fontes Google Fonts
• Ícone SVG único na tela de seleção de campanhas
• Animação de loading temática com CSS próprio
• Cada campanha tem identidade visual única

PACOTE DE SESSÃO
O mestre prepara a sessão com a IA e cola num único campo — o Hub processa tudo automaticamente.
Gramática: SESSÃO | CENA | NARRAÇÃO | SPAWN nome COORD | FOG: revelar A1:D5 | ZONA: tipo COORD "label" | BATALHA: iniciar
Cenas ficam em pool (não fila) — mestre ativa a que faz sentido.
ORGANOGRAMA: "Nome" → NÓ: id "label" / requer: elem / conecta: destino (via saida)

MULTIPLAYER TEMPO REAL
• Sincronização automática via WebSocket (sem refresh manual)
• Personagens se movem no mapa de todos ao mesmo tempo
• Chat integrado por campanha

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 FORMATO DE DADOS (CSV de importação)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Arquivo .csv com seções marcadas por #SECTION:nome. Seções disponíveis:
  #SECTION:config, #SECTION:characters, #SECTION:skills, #SECTION:lore, #SECTION:attr_defs,
  #SECTION:attr_grupos, #SECTION:vocab_tematico, #SECTION:item_catalog, #SECTION:inventario

Regras de formatação:
  • "" para aspas internas em campos CSV (ex: width=""32"")
  • \\n para quebras de linha dentro de campos de texto
  • SVG sempre em linha única (sem quebras de linha reais dentro do SVG)
  • Comece DIRETO com #SECTION:config, sem texto antes ou depois do CSV
  • JSON embutido em campos CSV deve usar aspas duplas escapadas: [{"tipo":""hp"",""valor"":30}]

${Object.keys(SPECS).filter(s => s !== 'mapas').map(s => `--- #SECTION:${s} ---\n${SPECS[s]}`).join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗺 CONFIGURAÇÃO DE MAPAS (JSON separado)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Os mapas NÃO fazem parte do CSV principal. São configurados separadamente como um array JSON.
Quando o usuário quiser configurar mapas, gere um JSON de configuração (sem SVG — a imagem é adicionada depois).
O usuário importa esse JSON na aba "Mapas" do painel de importação ou na modal "Gerar Mapa com IA".

${SPEC_MAPAS_CONFIG}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 SUA PRIMEIRA MENSAGEM — FAÇA ISSO AGORA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Apresente-se e pergunte qual caminho o usuário quer seguir, com EXATAMENTE este texto:

---

Olá! Sou seu assistente para configurar sua campanha no **RPG Hub**. Por onde quer começar?

**1. 🆕 Criar do zero** — Você tem uma ideia ou gênero em mente. Vou te guiar passo a passo, sugerindo mecânicas, atributos e identidade visual que aproveitam ao máximo o sistema.

**2. 📖 Adaptar minha campanha** — Você já tem uma campanha pronta (D&D, Pathfinder, sistema próprio, notas, outro VTT). Vou fazer perguntas para traduzir tudo para o RPG Hub sem perder o que você tem.

**3. 📄 Gerar o CSV** — Você já organizou os dados e quer só o arquivo para importar. Me passe o que tem e gero na hora.

Qual você escolhe?

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 CAMINHO 1 — CRIAR DO ZERO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Conduza em fases, UMA por vez. Resuma o que foi decidido ao final de cada fase e pergunte se quer ajustar antes de avançar. Nunca jogue todas as perguntas de uma vez.

FASE 1 — Conceito e tom
  Qual gênero/ambientação? (fantasia medieval, cyberpunk, horror cósmico, space opera, steampunk, pós-apocalíptico, investigação, etc.)
  Número de jogadores? Tom? (sombrio/brutal | heroico/épico | investigativo/tenso | humorístico | íntimo/narrativo)
  Alguma referência que inspire? (livro, filme, jogo, série)
  Há pets, montarias ou companheiros que os personagens podem ter? (sistema de pet suportado)

FASE 2 — Sistema de atributos
  Explique a diferença entre categorias:
    "basico" → aparece em TODOS (até criaturas genéricas): Força, Destreza, Defesa, Iniciativa
    "especial" → só protagonistas e NPCs nomeados — EXCLUSIVAMENTE atributos narrativos/de lore (Sanidade, Possessão, Karma, Corrupção). NÃO usar para recursos gastos em habilidades.
    "status" → recursos dinâmicos gastos/recuperados durante a sessão: Mana, Stamina, Ki, XP, Nível. Visíveis por padrão na mesa.
    "resistencia" → reduz dano automaticamente: Armadura, Resistência ao Fogo, etc.

  Sugira conjuntos adequados ao gênero. Exemplos que pode oferecer:
    • Clássico (fantasia): Força, Destreza, Constituição, Inteligência, Sabedoria, Carisma | recursos: Mana, Stamina
    • Horror: Força, Destreza, Constituição, Inteligência, Sanidade (especial), Sorte | recursos: nenhum ou Sanidade como status
    • Narrativo: Corpo, Mente, Alma, Reputação, Vínculos | recursos: nenhum
    • Cyberpunk: Corpo, Reflexos, Tech, Cool, Empatia, Sorte | recursos: RAM, Humanidade
    • Pós-apo: Força, Agilidade, Percepção, Inteligência, Resistência | recursos: Munição como status

  Pergunte sobre recursos status com pool máximo derivado de atributo:
    opcoes no attr_def de status: {"max_base":50,"max_attr":"Inteligência","max_mult":2} → pool_max = 50 + (Inteligência × 2)
    Isso cria automaticamente "Mana Máxima" = 50 + Int×2 para cada personagem.

FASE 2.5 — Sistema de resistências e defesas (SEMPRE PERGUNTAR)
  Antes de definir combate, apresente as opções de sistema de defesa em ordem crescente de complexidade:

  OPÇÃO A — Simples (padrão): Sem armadura ou resistências. O dano vai direto ao HP. Ideal para campanhas narrativas.
  
  OPÇÃO B — Armadura básica: Um atributo "Armadura" que reduz todo dano. O jogador define:
    • pct_geral: % do valor da armadura que reduz qualquer dano (ex: 10 → armadura 20 = -2 de todo dano)
    • pct_fisico: % adicional do valor que reduz dano físico (ex: 50 → armadura 20 = -10 adicional em físico)
    Exemplo do usuário: armadura 20, pct_geral=10, pct_fisico=50 → ataque físico de 14: 14-2-10=2 de dano.
  
  OPÇÃO C — Resistências elementais: Além da armadura, personagens podem ter resistências a tipos específicos de dano (gelo, fogo, veneno, psíquico…). O valor do atributo é usado como percentual de redução (ou valor absoluto, se preferir). Isso cria automaticamente fraquezas para tipos sem resistência.
    Exemplo: 10 de resistência ao gelo → ataque de gelo de 13 → 13-ceil(13×10%)=13-2=11 de dano.
  
  OPÇÃO D — Combinado: Armadura + resistências elementais (o cálculo aplica armadura primeiro, depois resistência).
  
  Se o usuário escolher B, C ou D, pergunte quais tipos de dano a campanha usa — esses serão as chaves de resistência.
  Pergunte se criaturas têm armadura por padrão (ex: esqueleto 5, dragão 20).
  
  HP por Atributo — Separe também: o HP máximo pode ser derivado de um atributo.
  Exemplo: "HP = 50 + Constituição × 3". Se o usuário quiser isso, colete:
    hp_base (valor base, ex: 50), hp_attr (nome do atributo, ex: "Constituição"), hp_attr_mult (multiplicador, ex: 3).

FASE 3 — Sistema de combate e design de habilidades
  O combate é central ou secundário na campanha?
  Se central: quer tipos de dano diferenciados? Efeitos automáticos (veneno, paralisia, buff)? Críticos especiais?

  GUIE O DESIGN DE HABILIDADES DE CADA PERSONAGEM:
  Para cada PC e NPC elaborado, pergunte e construa habilidades completas usando todos os campos disponíveis:

  CAMPOS ESSENCIAIS de cada habilidade:
    • habilidade: nome da técnica/poder
    • formula_dano: "2d6", "1d8+3", "3d4-1", "1d6+1d8", "10" (fixo). VAZIO se não causa dano.
    • tipo_dano: fisico | magico | fogo | gelo | veneno | cura | psiquico | outro
    • alvo_tipo: inimigo | proprio | aliado | todos_aliados | todos_inimigos
    • custo_rsv: "2 Mana", "1 Stamina", "Passiva". Vazio se gratuita.
    • cooldown_turnos: 0 = uso livre. 1–5 = balanceia habilidades fortes.
    • alcance_celulas: corpo-a-corpo=1, arremesso=3-5, magia curta=8, longa=15-20. VAZIO=sem limite.
    • atributo_base: atributo cujo valor é multiplicado por mod_atributo_pct e somado ao dano final.
    • critico_positivo: o que acontece em acerto crítico (narração mecânica)
    • critico_negativo: o que acontece em falha crítica

  EFEITOS BÔNUS (efeitos_bonus_json) — guie o usuário a usar todos os disponíveis:
    DOT (dano por turno — veneno, sangramento, queimadura):
      [{"nome":"Veneno","dot_formula":"1d4","dot_turnos":3}]
      [{"nome":"Sangramento","dot_formula":"1d6","dot_turnos":4}]
    
    HOT (cura por turno — regeneração, bênção, escudo de vida):
      [{"nome":"Regeneração","hot_formula":"1d8","hot_turnos":4}]
    
    Imobilização:
      [{"nome":"Paralisado","sem_movimento":true,"sem_movimento_turnos":2}]
    
    Bloqueio de ataque:
      [{"nome":"Cegado","sem_ataque":true,"sem_ataque_tipo":"todos","sem_ataque_turnos":2}]
      [{"nome":"Barreira Anti-Magia","sem_ataque":true,"sem_ataque_tipo":"magico","sem_ataque_turnos":3}]
    
    Debuff de dano:
      [{"nome":"Fragilizado","mod_dano":-3,"mod_dano_turnos":2}]
    
    Boost de dano (buff para o ALVO):
      [{"nome":"Fúria Sagrada","boost_dano":5,"boost_dano_turnos":3}]
    
    Recuperação de recurso:
      [{"nome":"Canalizar Mana","rec_atributo":"Mana","rec_formula":"2d6","rec_modo":"turno","rec_turnos":3}]
      [{"nome":"Pulso de Energia","rec_atributo":"Stamina","rec_formula":"15","rec_modo":"imediato"}]
    
    COMBINADOS (múltiplos efeitos em uma habilidade):
      [{"nome":"Queimadura","dot_formula":"1d6","dot_turnos":3,"mod_dano":-2,"mod_dano_turnos":2}]
      [{"nome":"Paralisia Total","sem_movimento":true,"sem_movimento_turnos":2,"sem_ataque":true,"sem_ataque_tipo":"todos","sem_ataque_turnos":2}]
      [{"nome":"Dreno Vital","dot_formula":"1d4","dot_turnos":3,"hot_formula":"1d4","hot_turnos":3}]

    Imunidade a dano (N turnos):
      [{"nome":"Barreira Sagrada","imune_dano":true,"imune_dano_turnos":2,"animacao_persistente":true}]

    Efeito Atrasado — Dano AoE:
      [{"nome":"Bomba Temporal","efeito_atrasado":true,"delay_turnos":2,"tipo_efeito_atrasado":"dano_aoe","formula_dano":"3d8","tipo_dano":"fogo","alcance_celulas":3,"stun_turnos":1}]

    Efeito Atrasado — Cura AoE (pulso de cura após N turnos, aliados em volta):
      [{"nome":"Onda Curativa","efeito_atrasado":true,"delay_turnos":1,"tipo_efeito_atrasado":"cura_aoe","formula_cura":"2d6+3","alcance_celulas":2}]

    Efeito Atrasado — Movimento bônus (recarga de movimento após delay):
      [{"nome":"Recarga Tática","efeito_atrasado":true,"delay_turnos":1,"tipo_efeito_atrasado":"movimento","movimento_atrasado":4}]

    REAÇÕES (habilidades defensivas fora do turno):
      Interrupt (cancela ataque, concede movimento):
        sistema_reacao="dnd5e", custo_reacao="reacao", tipo_reacao="interrupt", movimento_bonus_cancelar=3
      Esquiva (desvantagem no ataque do oponente):
        [{"nome":"Esquiva","esquiva_ativa":true,"esquiva_turnos":1}]
      Contra-ataque:
        sistema_reacao="custom", custo_reacao="reacao", tipo_reacao="counter"

  ORIENTAÇÕES DE BALANCEAMENTO DE HABILIDADES:
  • Habilidades básicas (sem custo, sem cooldown): dano baixo = 1d6 a 1d8
  • Habilidades médias (2-3 de recurso ou cooldown 1-2): dano médio = 2d6 a 1d10+3
  • Habilidades poderosas (alto custo ou cooldown 3+): dano alto = 2d8+4 a 3d6
  • Habilidades AoE (todos_inimigos): ~75% do dano de ataque singular equivalente
  • Habilidades de cura (tipo_dano=cura): cura típica = 1d6+2 a 2d8 dependendo do nível
  • Passivas: sem custo, sem cooldown, efeito de suporte (boost_dano, rec_atributo)
  • Uma habilidade poderosa com mod_atributo_pct:100 (usa 100% do atributo como bônus) + cooldown 3+ = habilidade signature

  ANIMAÇÕES (animacao_json) — OBRIGATÓRIO PARA CADA HABILIDADE:
  O motor de animação tem três sistemas que rodam em paralelo: Pixi Particles (canvas), GSAP (token DOM) e Animação Esquelética (bones procedurais). Use um, dois ou três conforme necessário.

  Para cada habilidade, decida VISUALMENTE antes de gerar:
  • O que o observador VÊ quando este poder é ativado? Não o elemento — o ATO.
  • Qual o RITMO? (instantâneo, gradual, explosivo, pulsante, onda contínua)
  • Como TERMINA? (dissolve, colapsa, explode, retrai, desaparece)
  • Para INVOCAÇÕES: como a entidade APARECE? Ela rasga o éter, emerge do solo, condensa do nada?
    Use posicao "area" ou "alvo", duracao longa (2000–4000ms), e construa a materialização em camadas.

  Posições disponíveis (escolha a que descreve o comportamento real):
  alvo | atacante | meio | trajetoria | raio | area | multiplo_alvo | orbital | cadeia | sequencial | retorno

  Formatos aceitos para animacao_json (use o que melhor serve a habilidade):
  Apenas partículas:  {"tipo":"pixi_particles","posicao":"...","duracao":...,"pixi_config":[...]}
  Com token motion:   {...,"gsap_config":{"preset":"token_dash","cor":"#ff4400","duracao":500,"intensidade":1.2,"alvo_efeito":"atacante"}}
  Com esquelético:    {...,"spine_config":{"duracao":1200,"posicao":"alvo","skeleton":{"bones":[...],"slots":[...],"tracks":[...]}}}
  Todos os três:      {"tipo":"pixi_particles","posicao":"...","duracao":...,"pixi_config":[...],"gsap_config":{...},"spine_config":{...}}

  Referência completa de campos em #SECTION:skills. Não use exemplos prontos — crie efeitos únicos para cada habilidade.

FASE 4 — Identidade visual
  3 palavras que descrevem o visual da campanha?
  Referências visuais? Cores predominantes do mundo?
  Se o usuário não souber, sugira combinações baseadas no gênero escolhido.
  Lembre: card_icon_svg, animation_loading_svg e animation_css são criados por você — faça-os únicos e memoráveis.

FASE 5 — Personagens completos (PCs, NPCs, Criaturas)
  PERSONAGENS JOGADORES (tipo=jogador):
    • Nome, conceito/classe, nível inicial
    • Distribuição de atributos (sugerir conforme a especialização)
    • Habilidades definitórias: 2-4 habilidades por personagem, uma delas a "habilidade signature"
    • Equipamentos iniciais: arma equipada + proteção + 1-2 consumíveis de reserva
    • Background narrativo (campo background)
    • Tem pet/familiar/montaria? → crie como personagem tipo=npc com campo "É um pet" e dono definido

  NPCs ELABORADOS (tipo=npc — aliados, vilões, comerciantes, figuras-chave):
    ⚠️ NPCs elaborados recebem TODOS os atributos, incluindo "especial" (Sanidade, Motivação, etc.)
    • Nome, papel na narrativa
    • Atributos completos — distribuição reflete o archetype:
      Guarda Veterano: Força alta, Destreza média, Constituição alta, Armadura média
      Mago Sábio: Inteligência muito alta, Força baixa, Mana alta, Armadura baixa
      Ladra Ágil: Destreza muito alta, Força média, Constituição baixa, Armadura leve
    • Habilidades: 2-4 habilidades que refletem o papel narrativo
    • Equipamentos representativos do papel
    • Background: motivação, segredos, relações com os PCs
    • Cor do token: aliados = tons de azul (#4fa3d1), neutros = cinza (#7a92aa), inimigos = tons de vermelho/laranja

  CRIATURAS (tipo=criatura — monstros, bestas, seres sem linguagem):
    ⚠️ Criaturas recebem APENAS atributos "basico" e "resistencia" — sem "especial" ou recursos de habilidade
    ⚠️ Não têm background elaborado — lore vai em seção "mundo" ou "segredo" do Lore
    • Nome da espécie/tipo (pode haver várias criaturas do mesmo tipo)
    • HP de acordo com o papel: Mini = 20-40, Normal = 60-100, Elite = 150-250, Chefe = 300-600+
    • Atributos típicos por archetype:
      Bruto Físico (Ogro, Troll): Força 18-25, Destreza 6-8, Constituição 20-25, Armadura 5-8, Inteligência 4
      Predador Ágil (Lobo, Pantera): Força 12-16, Destreza 18-22, Constituição 12-15, Armadura 2-4
      Criatura Arcana (Elemental, Lich): Inteligência 18-24, Força 8-12, Mana ou equivalente, Resistência Elemental 15-30
      Blindado (Golem, Caranguejo Gigante): Armadura 20-35, Força 15-20, Destreza 4-6, Constituição alta
    • 1-3 habilidades que definem o estilo de combate (mordida venenosa, carga, rajada)
    • Resistências/fraquezas elementais coerentes com a lore (esqueleto → resistente a físico, fraco a sagrado)
    • Cor do token: sempre tons escuros de vermelho/roxo/laranja para distinguir de aliados
    • loot_table: criaturas importantes podem ter itens de loot definidos (campo notas do inventário)

  OBJETOS (tipo=objeto — armadilhas, construtos sem vontade):
    • Nome, descrição mecânica
    • HP representa durabilidade/pontos de estrutura
    • Atributos apenas os relevantes para as mecânicas (Armadura, HP)
    • Habilidade = efeito da armadilha (DOT de veneno, dano ao passar, etc.)

FASE 6 — Habilidades (detalhamento)
  Já abordada na FASE 3. Nesta fase, confirme e complete todas as habilidades de todos os personagens.
  Pergunte se o usuário quer habilidades_por_nivel_json (habilidades bloqueadas até certo nível).
    Exemplo: {"3":["Golpe Duplo"],"5":["Fúria Berserker"]} — desbloqueia conforme o personagem nivela.
  Pergunte se quer aumentos_automaticos_json (atributos que crescem automaticamente por nível).
    Exemplo: {"Força":1,"Mana":5} — a cada level up, +1 Força e +5 Mana.

FASE 7 — Itens, consumíveis e equipamentos (POPULAÇÃO COMPLETA)
  A campanha vai usar itens físicos? Se sim, construa um catálogo completo:

  POOL DE CONSUMÍVEIS (mínimo recomendado por campanha):
    • 2-3 variantes de cura (Pequena/Média/Grande) com valores escalados: 20/50/100 HP
    • 1-2 variantes de recurso (Poção de Mana Pequena/Grande): recupera 25/60 Mana
    • 1-2 itens de buff temporário alinhados com o tema (Elixir da Força +3 por 3 turnos)
    • 1-2 antídotos/curas de debuff específicos da campanha (Antídoto → remove Envenenado)
    • 1-2 consumíveis ofensivos (venenos, frascos de ácido, flechas mágicas) se o tom permitir
    • Comida/descanso se a campanha simula longas jornadas

  POOL DE EQUIPAMENTOS (por slot — recomendado):
    • arma_principal: versões em pelo menos 2 raridades (comum → incomum ou raro)
    • corpo: armadura leve (Destreza) + armadura pesada (Força+penalidade Destreza) se o sistema diferenciar
    • acessórios (anel, amuleto, capa): itens de especialização — cada um deve definir um estilo diferente

  ITENS LENDÁRIOS E ÚNICOS:
    • 1-3 itens lendários com identidade narrativa própria (nome único, background, efeitos múltiplos)
    • Itens de missão (tipo=misc) como chaves, fragmentos, artefatos sem mecânica automática

  DISTRIBUIÇÃO INICIAL (#SECTION:inventario):
    • PCs nível 1: arma equipada + proteção equipada + 1-2 consumíveis de reserva
    • NPCs comerciantes: inventário representativo das mercadorias que vendem
    • NPCs guarda/soldado: arma + armadura equipadas
    • Criaturas com loot especial: adicionar ao inventário com notas sobre a origem

  MERCADO:
    A seção #SECTION:item_catalog ALIMENTA o mercado automaticamente. O mestre seleciona quais itens
    estão disponíveis para compra via a aba Mercado. Recomende:
    • Itens comuns/incomuns disponíveis no mercado desde o início
    • Itens raros disponíveis apenas após certos eventos ou locais específicos
    • Itens épicos/lendários nunca no mercado — apenas como recompensa, loot ou missão

FASE 8 — Lore e mapas
  Informações de mundo para registrar? (locais, facções, história, regras especiais)
  Tem imagem de mapa? (URL pública) Qual escala? (reinos em km? Dungeons em metros?)
  NPCs comerciantes/vilões/aliados que aparecem em locais específicos?

FASE 8.5 — BALANCEAMENTO GERAL DA CAMPANHA (FASE CRÍTICA — SEMPRE INCLUIR)
  Antes de gerar o CSV final, revise o equilíbrio geral com base nos parâmetros coletados:

  BALANCEAMENTO DE HP:
  • Criaturas comuns: HP = 50-80% do HP de um PC de nível equivalente
  • Criaturas elite: HP = 120-180% do HP de um PC
  • Chefe final: HP = 2-3× o HP total do grupo (por exemplo: 4 PCs × 100 HP = chefe com 800-1200 HP)
  • NPCs aliados importantes: HP próximo aos PCs para sobreviver em combate

  BALANCEAMENTO DE DANO:
  • Ataque básico de criatura: deve fazer 15-25% do HP máximo de um PC em dano médio
  • Ataque especial de criatura: 30-45% do HP máximo de um PC, com cooldown 2-3
  • Habilidade de cura: deve restaurar 25-40% do HP máximo do alvo
  • Se houver armadura: calcule o dano EFETIVO: Ataque físico × (1 - pct_geral/100 × Armadura/ValorAtaque)
    Exemplo: atacante faz 20 de dano, alvo tem Armadura=15, pct_geral=10, pct_fisico=40:
    Redução geral: ceil(15×10%)=2 | Redução física: ceil(15×40%)=6 → dano efetivo = 20-2-6=12

  BALANCEAMENTO DE PROGRESSÃO:
  • pontos_attr_por_nivel: 1-2 pontos por nível. Mais que 3 acelera demais a progressão.
  • hp_por_nivel: 8-15 HP por nível para campanhas clássicas. Escala a dificuldade dos combates.
  • nivel_maximo: 10 para campanhas curtas, 15-20 para campanhas longas.
  • XP recomendado por missão: suficiente para 2-3 níveis por arco narrativo.

  VERIFICAÇÕES FINAIS:
  ✓ Cada PC tem ao menos 1 habilidade signature que o diferencia dos outros?
  ✓ Criaturas têm resistências/fraquezas que criam decisão tática? (inimigo de fogo → usar gelo)
  ✓ O dano médio dos PCs por turno permite derrotar um inimigo comum em 3-5 rounds?
  ✓ O mercado tem itens em todas as faixas de preço?
  ✓ Os atributos dos PCs são balanceados: nenhum PC tem tudo alto (deve haver tradeoffs)?
  ✓ vocab_tematico tem pelo menos 12 prefixos, 15 adjetivos e 10 origens?

Ao final: "Tenho o que preciso. Quer que eu gere o CSV agora?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 CAMINHO 2 — ADAPTAR CAMPANHA EXISTENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Peça que o usuário compartilhe o material que tem (qualquer formato — texto bruto, regras, lista de personagens). Depois investigue as lacunas com perguntas direcionadas. Não repita o que já foi respondido.

Sequência de investigação:
  1. "Qual sistema você usa?" (D&D 5e, Pathfinder, GURPS, sistema próprio, ficção narrativa pura)
  2. "Quais são os atributos dos personagens? Me dê os nomes exatos e o que representam."
  3. "Há recursos que os jogadores gastam? (Mana, Stamina, Ki, Pontos de Ação) — esses viram atributos categoria 'status'"
  3b. "Há sistema de armadura ou resistência a tipos de dano? Se sim: é um valor numérico? Como o HP base é calculado? Algum atributo contribui para o HP máximo?"
  4. "Como funciona o combate? Turnos por iniciativa? Dados usados? Que tipos de dano existem?"
  5. "Me dê os personagens jogadores: nome, conceito, valores dos atributos de cada um."
  6. "Eles têm habilidades? Liste as principais com nome, efeito e valores numéricos. Para cada habilidade: tem custo de recurso? Cooldown? Efeito secundário (veneno, paralisia, buff)?"
  7. "Há NPCs elaborados ou criaturas importantes? Para criaturas: HP, atributos principais, ataque característico, resistências/fraquezas."
  8. "Tem pets, montarias ou companheiros vinculados a personagens?"
  9. "Tem informações de mundo a registrar? (locais, facções, história, regras especiais)"
  10. "A campanha usa itens consumíveis (poções, venenos, armas de arremesso) ou equipamentos que afetam atributos? Liste: nome, tipo (consumível/equipamento), slot se equipamento, efeito mecânico."
  11. "Quais itens os personagens já possuem? (inventário inicial)"
  12. "Tem tabelas de mercado, loot ou informações de NPCs que mudam durante a sessão?"
  13. "Tem imagens de mapa? URL ou descrição. Qual escala?"
  14. "Como você imagina o visual? Cores, fontes, referências estéticas."

A cada resposta:
  • Confirme o que entendeu antes de avançar
  • Mapeie para o RPG Hub: "Isso vai entrar como [campo] em #SECTION:[seção]"
  • Aponte adaptações: "Seu sistema de pontos de ação não tem equivalente direto, mas podemos simular com cooldown_turnos — quer tentar?"
  • Seja honesto sobre limitações e ofereça alternativas
  • Para habilidades de D&D/Pathfinder: traduza modificadores de atributo como mod_atributo_pct
    Ex: "adiciona modificador de Força ao dano" → atributo_base="Força", mod_atributo_pct=50 (simula metade do valor)

Ao final de cada bloco: "Tem mais alguma coisa nessa área antes de avançar?"
Ao terminar tudo: "Tenho o suficiente. Quer revisar algo antes de gerar o CSV?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 CAMINHO 3 — GERAR O CSV
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Peça os dados. Pergunte apenas o que faltar para campos obrigatórios.
Campo obrigatório mínimo: #SECTION:config com rpg_id e name.

Regras absolutas:
  ✗ NÃO invente personagens, locais, habilidades ou atributos que não estejam no material
  ✗ NÃO preencha lacunas com "exemplos típicos de RPG"
  ✓ Campo sem informação → deixe BRANCO (não use zeros, não coloque "N/A")
  ✓ Transcreva EXATAMENTE os nomes como aparecem (maiúsculas, acentos, espaços)
  ✓ Comece direto com #SECTION:config, sem texto antes ou depois
  ✓ Para animações e ícones: crie SVGs que capturem o ESPÍRITO da campanha — únicos, memoráveis
  ✓ SEMPRE preencher animacao_json em TODAS as skills — nenhuma skill pode ficar sem animação. Pense: o que o observador VÊ quando este poder é ativado? Use o sistema (Pixi Particles, GSAP, Esquelético) que melhor expressa a habilidade — ou combine dois ou três para máximo impacto visual. Para INVOCAÇÕES, represente a APARIÇÃO da entidade, não um ataque.
  ✓ SEMPRE incluir #SECTION:item_catalog se a campanha usa itens — nunca deixar o catálogo vazio
  ✓ SEMPRE incluir #SECTION:inventario para distribuir itens iniciais depois do item_catalog
  ✓ SEMPRE incluir #SECTION:vocab_tematico para habilitar geração procedural de nomes de itens
  ✓ SEMPRE incluir #SECTION:attr_grupos para o motor de balanceamento funcionar

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ REGRAS GERAIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Uma fase/bloco por vez — não jogue tudo de uma vez
• Após cada resposta, resuma o que entendeu antes de avançar
• Ofereça sugestões quando o usuário não souber, mas deixe a decisão final para ele
• "Gera o CSV" ou "gera agora" em qualquer momento → gere com o que foi definido até ali
• CSV pode ser parcial — melhor gerar incompleto e complementar depois
• Nunca recuse gerar por falta de dados — use o que tem, deixe vazio o que não tem
• Ao gerar, SEMPRE inclua item_catalog + inventario + vocab_tematico + attr_grupos mesmo que básicos
• Faça os personagens ficarem COMPLETOS: atributos distribuídos, habilidades com todos os campos, equipamentos`;
}


// ══════════════════════════════════════════════════════════════
// SISTEMA DE MAPAS GERADOS POR IA
// ══════════════════════════════════════════════════════════════

// ── Alias de compatibilidade: lerMapasJSON() delega para lerMapasJSONFile() ─────────────────────
let _mapasImportJSON: any = null;
function lerMapasJSON(input: any) { lerMapasJSONFile(input); }

// ── Importa mapas JSON dentro do importRPG (upsert) ─────────────────────
async function importarMapasJSON(rpgId: any, mapas: any) {
  for (const m of mapas) {
    // ── Suporte a SVG embutido (formato antigo SVG+JSON) ──
    let img_url = m.img_url || '';
    if (!img_url && m.svg && m.svg.trim().includes('<svg')) {
      const svgLimpo = m.svg.trim()
        .replace(/<script[\s\S]*?<\/script>/gi,'')
        .replace(/on\w+="[^"]*"/gi,'');
      try {
        img_url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgLimpo)));
      } catch(e) {
        img_url = 'data:image/svg+xml,' + encodeURIComponent(svgLimpo);
      }
    }
    // img_url pode ser '' — mapa de configuração sem imagem ainda (imagem adicionada depois)

    // ── render_data: preservar e enriquecer ──
    let render_data = m.render_data || null;
    if (m.visao) {
      render_data = render_data ? { ...render_data, visao: m.visao } : { visao: m.visao };
    }
    if (m.descricao) {
      render_data = render_data
        ? { ...render_data, descricao_visual: m.descricao }
        : { visao: m.visao || 'top', descricao_visual: m.descricao };
    }

    // ── Dimensões: suporte a largura_total/altura_total ──
    const body = {
      rpg_id:          rpgId,
      map_id:          m.map_id,
      nome:            m.nome,
      tipo:            m.tipo            || 'geral',
      img_url:         img_url,
      escala_val:      m.escala_val      ?? 1.5,
      escala_unit:     m.escala_unit     || 'm',
      grid:            m.grid            || 20,
      parent_map_id:   m.parent_map_id   || null,
      locais:          m.locais          || [],
      render_data:     render_data,
      // Campos de posicionamento hierárquico
      zona_x:          m.zona_x          ?? null,
      zona_y:          m.zona_y          ?? null,
      zona_w_percent:  m.zona_w_percent  ?? null,
      zona_h_percent:  m.zona_h_percent  ?? null,
      largura_total:   m.largura_total   ?? null,
      altura_total:    m.altura_total    ?? null,
      largura_real:    m.largura_real    ?? m.largura_total ?? null,
      altura_real:     m.altura_real     ?? m.altura_total  ?? null,
    };

    // Upsert: POST → se duplicado, PATCH
    try {
      await sb('mapas', { method: 'POST', body: JSON.stringify(body) });
    } catch(e) {
      if (e.message && e.message.includes('23505')) {
        await sb(`mapas?rpg_id=eq.${encodeURIComponent(rpgId)}&map_id=eq.${encodeURIComponent(m.map_id)}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        throw e;
      }
    }
  }
}

// ── Abre modal de geração de mapa (via cópia de prompt) ────────
function abrirModalGerarMapaIA() {
  document.getElementById('ia-mapa-mesa-contexto').value = '';
  document.getElementById('ok-copiar-mapa-mesa').style.display = 'none';
  document.getElementById('label-copiar-mapa-mesa').textContent = 'Copiar prompt';

  // Limpar campo de importação
  const pasteEl = document.getElementById('ia-mapa-mesa-paste');
  if (pasteEl) pasteEl.value = '';
  const stEl = document.getElementById('ia-mapa-mesa-status');
  if (stEl) stEl.style.display = 'none';

  // Mostrar mapas já existentes como referência
  const mapasExistentes = RPG_DATA?.mapas || [];
  const aviso = document.getElementById('ia-mapa-mesa-aviso');
  if (mapasExistentes.length) {
    const lista = mapasExistentes.map(l => {
      const tipo = l.mapa.tipo === 'geral' ? '🌍' : '🏰';
      return `${tipo} ${l.mapa.nome} [${l.mapa.map_id}]`;
    }).join('\n');
    aviso.style.display = 'block';
    aviso.innerHTML = `<b style="color:var(--destaque)">Mapas existentes (incluídos no prompt):</b><br><span style="white-space:pre-line;font-size:0.72rem">${lista}</span>`;
  } else {
    aviso.style.display = 'none';
  }

  document.getElementById('modal-gerar-mapa-ia-overlay').style.display = 'flex';
}

// ── Gera e copia o prompt de CONFIG para a IA ─────────────
function copiarPromptMapaMesa() {
  const desc = document.getElementById('ia-mapa-mesa-contexto').value.trim();
  if (!desc) { mostrarToast('Descreva o que gerar antes de copiar', 'erro'); return; }

  const mapasExistentes = RPG_DATA?.mapas || [];
  const prompt = gerarPromptMapasConfig(desc, mapasExistentes);

  const label = document.getElementById('label-copiar-mapa-mesa');
  const ok    = document.getElementById('ok-copiar-mapa-mesa');
  const done  = () => {
    label.style.display = 'none';
    ok.style.display = 'inline';
    setTimeout(() => { label.style.display = 'inline'; ok.style.display = 'none'; }, 2500);
  };
  if (navigator.clipboard) navigator.clipboard.writeText(prompt).then(done).catch(() => fbCopy(prompt, done));
  else fbCopy(prompt, done);
}

// ── Gera e copia o prompt de SVG+JSON para a IA ─────────────
function copiarPromptMapaMesaSVG() {
  const desc = document.getElementById('ia-mapa-mesa-contexto').value.trim();
  if (!desc) { mostrarToast('Descreva o que gerar antes de copiar', 'erro'); return; }
  const mapasExistentes = RPG_DATA?.mapas || [];
  const prompt = gerarPromptMapasSVGAtualizacao(desc, mapasExistentes);
  const done = () => mostrarToast('✓ Prompt SVG copiado', 'ok');
  if (navigator.clipboard) navigator.clipboard.writeText(prompt).then(done).catch(() => fbCopy(prompt, done));
  else fbCopy(prompt, done);
}

// ── Importa config JSON colado diretamente na modal ─────────
async function importarMapasMesaPaste() {
  const paste = (document.getElementById('ia-mapa-mesa-paste')?.value || '').trim();
  const st = document.getElementById('ia-mapa-mesa-status');
  const showSt = (msg: any, tipo: any) => {
    if (!st) return;
    st.style.display = 'block';
    st.style.color = tipo === 'ok' ? 'var(--sucesso)' : 'var(--perigo)';
    st.textContent = msg;
  };
  if (!paste) { showSt('Cole o JSON de configuração antes de importar.', 'err'); return; }
  if (!RPG_DATA?.rpgId) { showSt('Nenhuma campanha aberta.', 'err'); return; }

  let data;
  try {
    const raw = paste.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
    data = JSON.parse(raw);
  } catch(e) { showSt('JSON inválido: ' + e.message, 'err'); return; }

  const arr = Array.isArray(data) ? data : (data.mapas ? data.mapas : [data]);
  if (!arr.length || !arr[0].map_id) { showSt('Formato inválido: cada mapa precisa de map_id.', 'err'); return; }

  showSt('⏳ Importando ' + arr.length + ' mapa(s)…', 'ok');
  try {
    await importarMapasJSON(RPG_DATA.rpgId, arr);
    // Recarregar mapas em memória
    const mapasRaw = await sb(`mapas?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&select=id,rpg_id,map_id,nome,escala_val,escala_unit,grid,parent_map_id,tipo,zona_x,zona_y,zona_w_percent,zona_h_percent,largura_total,altura_total,largura_real,altura_real,representar_pct,locais,render_data&order=id`);
    RPG_DATA.mapas = (mapasRaw || []).map((m: any) => ({
      mapa: { map_id: m.map_id, nome: m.nome, img_url: '', escala_val: m.escala_val ?? 1.5, escala_unit: m.escala_unit || 'm', grid: m.grid ?? 20, parent_map_id: m.parent_map_id || null, tipo: m.tipo || 'geral', zona_x: m.zona_x, zona_y: m.zona_y, zona_w_percent: m.zona_w_percent, zona_h_percent: m.zona_h_percent, largura_total: m.largura_total || null, altura_total: m.altura_total || null, largura_real: m.largura_real || null, altura_real: m.altura_real || null, representar_pct: m.representar_pct ?? 100, locais: Array.isArray(m.locais) ? m.locais : [], render_data: m.render_data || null }
    }));
    showSt(`✓ ${arr.length} mapa(s) importado(s)! Adicione a imagem depois via edição do mapa.`, 'ok');
    renderMapasTab();
    document.getElementById('modal-gerar-mapa-ia-overlay').style.display = 'none';
    mostrarToast(`✓ ${arr.length} mapa(s) criado(s)!`, 'ok');
  } catch(e) {
    showSt('Erro: ' + (e.message || e), 'err');
  }
}

// ── Gera prompt de config de mapas (sem SVG) ─────────────────────
function gerarPromptMapasConfig(contexto: any, mapasExistentes: any) {
  const listaMapas = (mapasExistentes || []).length
    ? (mapasExistentes).map((l: any) => {
        const tipo = l.mapa.tipo === 'geral' ? '🌍 GERAL' : '🏰 LOCAL';
        const dims = l.mapa.largura_total ? ` (${l.mapa.largura_total}×${l.mapa.altura_total} cél, ${l.mapa.escala_val}${l.mapa.escala_unit}/cél)` : '';
        return `  • ${tipo} "${l.mapa.nome}" [${l.mapa.map_id}]${dims}`;
      }).join('\n')
    : '  (nenhum mapa existente ainda)';

  return `Você vai gerar a configuração de mapas para uma campanha de RPG no sistema RPG Hub.
Retorne APENAS um array JSON de configurações de mapa. SEM SVG, SEM imagem — apenas dimensões e hierarquia.
A imagem/ilustração de cada mapa será adicionada depois pelo mestre de jogo.

━━━ CONTEXTO ━━━
${contexto}

━━━ MAPAS JÁ EXISTENTES (não repita map_ids) ━━━
${listaMapas}

━━━ O QUE GERAR ━━━
Gere apenas os mapas necessários para o contexto descrito.
Para sessões de batalha/combate: priorize mapas do tipo "local" com dimensões táticas.
Para exploração: inclua um mapa "geral" conectado a locais táticos via locais[].

${SPEC_MAPAS_CONFIG}`;
}

// ══════════════════════════════════════════════════════════════
// CANVAS RENDERER PROCEDURAL
// Chamado por renderMapaViewer quando render_data existe e img_url é vazio
// ══════════════════════════════════════════════════════════════

function mapaRenderCanvas(m: any) {
  const rd = m.render_data;
  if (!rd) return false;

  const canvas = document.getElementById('mapa-canvas');
  if (!canvas) return false;
  const wrap = document.getElementById('mapa-img');
  const W = wrap.offsetWidth || 400;
  const H = wrap.offsetHeight || 300;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const estilo = rd.estilo || 'area_aberta';

  if (estilo === 'geral') _renderGeral(ctx, rd, W, H);
  else if (estilo === 'dungeon') _renderDungeon(ctx, rd, W, H);
  else if (estilo === 'edificio') _renderEdificio(ctx, rd, W, H);
  else if (estilo === 'cidade') _renderCidade(ctx, rd, W, H);
  else _renderAreaAberta(ctx, rd, W, H);

  // Pontos de interesse
  // Cidades: cluster de tiles de construção. Outros POIs: ícone + label.
  const _TS_POI = 8;
  const _colsPOI = Math.ceil(W / _TS_POI);
  const _rowsPOI = Math.ceil(H / _TS_POI);
  const _ICONS_CIDADE = new Set(['🏰','🏯','🏙','🌆','🌇','🏘','🏚','🏛','🕌','⛪','🏟']);
  (rd.pontos_de_interesse || []).forEach((p: any) => {
    const px = (p.x_percent / 100) * W;
    const py = (p.y_percent / 100) * H;
    const isCidade = _ICONS_CIDADE.has(p.icone) || p.tipo === 'cidade' || p.tipo === 'vila' || p.tipo === 'aldeia' || p.tipo === 'capital';
    if (isCidade && (estilo === 'geral' || estilo === 'area_aberta')) {
      const raio = p.raio_tiles || (p.tipo === 'capital' ? 7 : p.tipo === 'cidade' ? 5 : 3);
      const cRgb = _hex2rgb(p.cor_cidade || '#6a5038');
      const cx = Math.floor(px / _TS_POI);
      const cy = Math.floor(py / _TS_POI);
      for (let dy = -raio; dy <= raio; dy++) {
        for (let dx = -raio; dx <= raio; dx++) {
          if (Math.sqrt(dx*dx + dy*dy) > raio + 0.5) continue;
          const tx = cx + dx, ty2 = cy + dy;
          if (tx < 0 || ty2 < 0 || tx >= _colsPOI || ty2 >= _rowsPOI) continue;
          const n = _tnoise(tx * 1.5, ty2 * 1.5) * 0.6 + _tnoise(tx * 4.1, ty2 * 4.1) * 0.4;
          const isRua = _th(tx * 13, ty2 * 7) < 0.22;
          const isEd  = !isRua && _th(tx * 5, ty2 * 11) > 0.3;
          let r = cRgb.r, g = cRgb.g, b = cRgb.b;
          if (isRua) { r=Math.round(r*0.55); g=Math.round(g*0.55); b=Math.round(b*0.55); }
          else if (isEd) { r=Math.min(255,r+18); g=Math.min(255,g+12); b=Math.min(255,b+8); }
          _drawTile(ctx, tx*_TS_POI, ty2*_TS_POI, _TS_POI, r, g, b, n, 1);
        }
      }
      ctx.save();
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 5;
      ctx.fillStyle = '#f0cc6a';
      ctx.fillText(p.nome, px, py + raio * _TS_POI + 2);
      ctx.restore();
    } else {
      ctx.save();
      ctx.font = '14px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4;
      ctx.fillText(p.icone || '📍', px, py);
      ctx.font = '8px monospace';
      ctx.fillStyle = '#f0cc6a'; ctx.shadowBlur = 3;
      ctx.fillText(p.nome, px, py + 13);
      ctx.restore();
    }
  });

  // Saídas
  (rd.saidas || []).forEach((s: any) => {
    const x = (s.x_percent / 100) * W;
    const y = (s.y_percent / 100) * H;
    ctx.save();
    ctx.strokeStyle = 'rgba(200,168,75,0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#f0cc6a';
    ctx.textAlign = 'center';
    ctx.fillText('↩', x, y + 1);
    ctx.restore();
  });

  return true;
}

// ── CIDADE ───────────────────────────────────────────────────
function _renderCidade(ctx: any, rd: any, W: any, H: any) {
  const TS = 6;
  const cols = Math.ceil(W / TS), rows = Math.ceil(H / TS);
  const tileType = new Uint8Array(cols * rows);
  const tileRoom = new Int16Array(cols * rows).fill(-1);
  const quarteiroes = rd.quarteiroes || [];
  const ruas = rd.ruas || [];
  const edificios = rd.edificios || [];
  const muros = rd.muros || [];
  for (let i = 0; i < tileType.length; i++) tileType[i] = 1;
  (rd.pracas || []).forEach((p: any) => {
    const px1=(p.x/100)*W, py1=(p.y/100)*H, pw=(p.w/100)*W, ph=(p.h/100)*H;
    const tx1=Math.floor(px1/TS), ty1=Math.floor(py1/TS), tx2=Math.ceil((px1+pw)/TS), ty2=Math.ceil((py1+ph)/TS);
    for(let ty=ty1;ty<ty2;ty++) for(let tx=tx1;tx<tx2;tx++) if(tx>=0&&ty>=0&&tx<cols&&ty<rows) tileType[ty*cols+tx]=4;
  });
  quarteiroes.forEach((q: any,qi: any) => {
    const px1=(q.x/100)*W, py1=(q.y/100)*H, pw=(q.w/100)*W, ph=(q.h/100)*H;
    const tx1=Math.floor(px1/TS), ty1=Math.floor(py1/TS), tx2=Math.ceil((px1+pw)/TS), ty2=Math.ceil((py1+ph)/TS);
    for(let ty=ty1;ty<ty2;ty++) for(let tx=tx1;tx<tx2;tx++) if(tx>=0&&ty>=0&&tx<cols&&ty<rows){tileType[ty*cols+tx]=2;tileRoom[ty*cols+tx]=qi;}
  });
  edificios.forEach((e: any,ei: any) => {
    const px1=(e.x/100)*W, py1=(e.y/100)*H, pw=(e.w/100)*W, ph=(e.h/100)*H;
    const tx1=Math.floor(px1/TS), ty1=Math.floor(py1/TS), tx2=Math.ceil((px1+pw)/TS), ty2=Math.ceil((py1+ph)/TS);
    for(let ty=ty1;ty<ty2;ty++) for(let tx=tx1;tx<tx2;tx++) if(tx>=0&&ty>=0&&tx<cols&&ty<rows){tileType[ty*cols+tx]=3;tileRoom[ty*cols+tx]=1000+ei;}
  });
  muros.forEach((m: any) => {
    const x1=(m.de[0]/100)*W, y1=(m.de[1]/100)*H, x2=(m.para[0]/100)*W, y2=(m.para[1]/100)*H;
    const len=Math.sqrt((x2-x1)**2+(y2-y1)**2), steps=Math.ceil(len/(TS*0.5));
    for(let s=0;s<=steps;s++){
      const t=s/steps, mx=x1+(x2-x1)*t, my=y1+(y2-y1)*t;
      for(let dw=-1;dw<=1;dw++){
        const tx2b=Math.floor(mx/TS)+(Math.abs(dw)<1?0:dw), ty2b=Math.floor(my/TS);
        if(tx2b>=0&&ty2b>=0&&tx2b<cols&&ty2b<rows) tileType[ty2b*cols+tx2b]=5;
      }
    }
  });
  const TIPOS_COR: Record<string, any> = {residencial:{r:60,g:48,b:32},comercial:{r:75,g:58,b:30},nobre:{r:65,g:55,b:40},militar:{r:45,g:50,b:45},religioso:{r:55,g:55,b:65},porto:{r:35,g:48,b:60},pobre:{r:48,g:40,b:28}};
  const qRgbs=quarteiroes.map((q: any)=>q.cor?_hex2rgb(q.cor):(TIPOS_COR[q.tipo]||{r:58,g:46,b:30}));
  const eRgbs=edificios.map((e: any)=>e.cor?_hex2rgb(e.cor):{r:80,g:65,b:42});
  for(let ty=0;ty<rows;ty++){
    for(let tx=0;tx<cols;tx++){
      const tipo=tileType[ty*cols+tx], px=tx*TS, py=ty*TS;
      const n=_tnoise(tx*1.2,ty*1.2)*0.55+_tnoise(tx*3.5,ty*3.5)*0.45;
      const ri=tileRoom[ty*cols+tx];
      if(tipo===1){_drawTile(ctx,px,py,TS,52,48,42,n,1);}
      else if(tipo===4){_drawTile(ctx,px,py,TS,75,70,62,n,1);}
      else if(tipo===5){const v=_th(tx,ty)>0.6?0.65:1.05;_drawTile(ctx,px,py,TS,Math.round(85*v),Math.round(80*v),Math.round(72*v),n,1);}
      else if(tipo===2){const c=ri>=0&&ri<qRgbs.length?qRgbs[ri]:{r:58,g:46,b:30};const s=_th(tx*3,ty*7)>0.35?1.18:0.82;_drawTile(ctx,px,py,TS,Math.min(255,Math.round(c.r*s)),Math.min(255,Math.round(c.g*s)),Math.min(255,Math.round(c.b*s)),n,1);}
      else if(tipo===3){const idx=ri-1000, c=idx>=0&&idx<eRgbs.length?eRgbs[idx]:{r:80,g:65,b:42};_drawTile(ctx,px,py,TS,c.r,c.g,c.b,n,1);}
    }
  }
  ruas.forEach((r: any) => {
    const x1=(r.de[0]/100)*W, y1=(r.de[1]/100)*H, x2=(r.para[0]/100)*W, y2=(r.para[1]/100)*H;
    const len=Math.sqrt((x2-x1)**2+(y2-y1)**2), steps=Math.ceil(len/(TS*0.4));
    const larg=Math.max(1,Math.round((r.largura||3)*0.5)), ang=Math.atan2(y2-y1,x2-x1)+Math.PI/2;
    for(let s=0;s<=steps;s++){
      const t=s/steps, mx=x1+(x2-x1)*t, my=y1+(y2-y1)*t;
      for(let dw=-larg;dw<=larg;dw++){
        const sx=mx+Math.cos(ang)*dw*TS, sy=my+Math.sin(ang)*dw*TS;
        const rtx=Math.floor(sx/TS), rty=Math.floor(sy/TS);
        if(rtx<0||rty<0||rtx>=cols||rty>=rows) continue;
        _drawTile(ctx,rtx*TS,rty*TS,TS,50,46,40,_tnoise(rtx*1.8,rty*1.8),1);
      }
    }
  });
  quarteiroes.forEach((q: any) => {
    const cx=((q.x+q.w/2)/100)*W, cy=((q.y+q.h/2)/100)*H;
    ctx.save();ctx.font='8px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.shadowColor='rgba(0,0,0,0.95)';ctx.shadowBlur=4;ctx.fillStyle='rgba(240,220,180,0.8)';
    ctx.fillText(q.nome,cx,cy);ctx.restore();
  });
  edificios.forEach((e: any) => {
    const cx=((e.x+e.w/2)/100)*W, cy=((e.y+e.h/2)/100)*H;
    ctx.save();
    if(e.icone){ctx.font='10px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='rgba(0,0,0,0.95)';ctx.shadowBlur=4;ctx.fillText(e.icone,cx,cy-5);}
    ctx.font='7px monospace';ctx.textAlign='center';ctx.textBaseline='top';
    ctx.shadowColor='rgba(0,0,0,0.95)';ctx.shadowBlur=4;ctx.fillStyle='#f0cc6a';
    ctx.fillText(e.nome,cx,cy+(e.icone?3:-4));ctx.restore();
  });
}

// ══════════════════════════════════════════════════════════════
// TILE ENGINE — renderização estilo Minecraft 2D
// ══════════════════════════════════════════════════════════════

// Hash determinístico (sem Math.random — tiles consistentes entre renders)
function _th(x: any, y: any) {
  let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

// Ruído bilinear suavizado
function _tnoise(x: any, y: any) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = _th(xi,yi), b = _th(xi+1,yi), c = _th(xi,yi+1), d = _th(xi+1,yi+1);
  const sx = xf*xf*(3-2*xf), sy = yf*yf*(3-2*yf);
  return a + (b-a)*sx + (c-a)*sy + (a-b-c+d)*sx*sy;
}

// Converter hex para {r,g,b}
function _hex2rgb(hex: any) {
  const h = hex.replace('#','');
  const n = parseInt(h.length===3 ? h.split('').map((c: any)=>c+c).join('') : h, 16);
  return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
}

// Desenhar um tile com variação de noise
function _drawTile(ctx: any, px: any, py: any, ts: any, r: any, g: any, b: any, noiseVal: any, alpha: any) {
  const v = 0.82 + noiseVal * 0.36;
  const ri = Math.min(255, Math.max(0, Math.round(r * v)));
  const gi = Math.min(255, Math.max(0, Math.round(g * v)));
  const bi = Math.min(255, Math.max(0, Math.round(b * v)));
  ctx.fillStyle = alpha < 1
    ? `rgba(${ri},${gi},${bi},${alpha})`
    : `rgb(${ri},${gi},${bi})`;
  ctx.fillRect(px, py, ts, ts);
}

// ── GERAL / ÁREA ABERTA — Voronoi tile biomes ─────────────────
function _renderBiomasTile(ctx: any, rd: any, W: any, H: any) {
  const TS = 8; // tamanho do tile em px
  const biomas = rd.biomas || [];
  if (!biomas.length) {
    ctx.fillStyle = '#0d1a0d';
    ctx.fillRect(0, 0, W, H);
    return;
  }

  // Centro de cada bioma com perturbação para bordas orgânicas
  const centros = biomas.map((b: any) => {
    const cx = ((b.x + b.w / 2) / 100) * W;
    const cy = ((b.y + b.h / 2) / 100) * H;
    const c  = _hex2rgb(b.cor || '#2a5018');
    return { cx, cy, r: c.r, g: c.g, b: c.b, nome: b.nome,
             px1: (b.x/100)*W, py1: (b.y/100)*H,
             px2: ((b.x+b.w)/100)*W, py2: ((b.y+b.h)/100)*H };
  });

  const cols = Math.ceil(W / TS);
  const rows = Math.ceil(H / TS);

  // Mapa Voronoi por tile
  const tileMap = new Array(rows * cols);
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const wx = tx * TS + TS / 2;
      const wy = ty * TS + TS / 2;
      // Perturbação orgânica
      const pertX = (_th(tx * 7.3, ty * 3.1) - 0.5) * TS * 2.5;
      const pertY = (_th(tx * 2.9, ty * 8.7) - 0.5) * TS * 2.5;
      const pwx = wx + pertX, pwy = wy + pertY;
      let best = -1, bestDist = Infinity;
      centros.forEach((c: any, i: any) => {
        const dx = pwx - c.cx, dy = pwy - c.cy;
        const dist = dx*dx + dy*dy;
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
      tileMap[ty * cols + tx] = best;
    }
  }

  // Desenhar tiles
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const bi = tileMap[ty * cols + tx];
      if (bi < 0) continue;
      const c = centros[bi];
      const px = tx * TS, py = ty * TS;
      const n = _tnoise(tx * 0.7, ty * 0.7) * 0.6 + _tnoise(tx * 2.1, ty * 2.1) * 0.4;
      // Bordas de bioma (vizinhos diferentes) ficam mais escuras
      let isBorda = false;
      if (tx > 0       && tileMap[ty*cols+(tx-1)] !== bi) isBorda = true;
      if (tx < cols-1  && tileMap[ty*cols+(tx+1)] !== bi) isBorda = true;
      if (ty > 0       && tileMap[(ty-1)*cols+tx] !== bi) isBorda = true;
      if (ty < rows-1  && tileMap[(ty+1)*cols+tx] !== bi) isBorda = true;
      let r = c.r, g = c.g, b = c.b;
      if (isBorda) { r=Math.round(r*0.72); g=Math.round(g*0.72); b=Math.round(b*0.72); }
      _drawTile(ctx, px, py, TS, r, g, b, n, 1);
    }
  }

  // Estradas como faixa de tiles terra
  (rd.estradas || []).forEach((e: any) => {
    const x1=(e.de[0]/100)*W, y1=(e.de[1]/100)*H;
    const x2=(e.para[0]/100)*W, y2=(e.para[1]/100)*H;
    const len=Math.sqrt((x2-x1)**2+(y2-y1)**2);
    const steps=Math.ceil(len/(TS*0.6));
    for (let s=0; s<=steps; s++) {
      const t=s/steps;
      const mx=x1+(x2-x1)*t, my=y1+(y2-y1)*t;
      for (let dw=-1; dw<=1; dw++) {
        const nx=(_th(mx+dw,my)-0.5)*3, ny=(_th(mx,my+dw)-0.5)*3;
        const rtx=Math.floor((mx+nx)/TS), rty=Math.floor((my+ny)/TS);
        if(rtx<0||rty<0||rtx>=cols||rty>=rows) continue;
        const nn=_tnoise(rtx*1.3,rty*1.3);
        _drawTile(ctx,rtx*TS,rty*TS,TS,130,110,75,nn,1);
      }
    }
  });

  // Rios como faixa azul
  (rd.rios || []).forEach((r: any) => {
    const x1=(r.de[0]/100)*W, y1=(r.de[1]/100)*H;
    const x2=(r.para[0]/100)*W, y2=(r.para[1]/100)*H;
    const len=Math.sqrt((x2-x1)**2+(y2-y1)**2);
    const steps=Math.ceil(len/(TS*0.5));
    for (let s=0; s<=steps; s++) {
      const t=s/steps;
      const mx=x1+(x2-x1)*t, my=y1+(y2-y1)*t;
      for (let dw=-1; dw<=1; dw++) {
        const rtx=Math.floor((mx+dw)/TS), rty=Math.floor((my+dw)/TS);
        if(rtx<0||rty<0||rtx>=cols||rty>=rows) continue;
        const nn=_tnoise(rtx*0.8,rty*0.8);
        _drawTile(ctx,rtx*TS,rty*TS,TS,40+Math.round(nn*20),80+Math.round(nn*30),160+Math.round(nn*20),nn,1);
      }
    }
  });

  // Labels dos biomas
  centros.forEach((c: any) => {
    ctx.save();
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 5;
    ctx.fillStyle = 'rgba(255,255,240,0.75)';
    ctx.fillText(c.nome, c.cx, c.cy);
    ctx.restore();
  });
}

function _renderGeral(ctx: any, rd: any, W: any, H: any) {
  _renderBiomasTile(ctx, rd, W, H);
}

function _renderAreaAberta(ctx: any, rd: any, W: any, H: any) {
  _renderBiomasTile(ctx, rd, W, H);
}

// ── DUNGEON — tiles de pedra, piso por sala, corredores ───────
function _renderDungeon(ctx: any, rd: any, W: any, H: any) {
  const TS = 8;
  const comodos = rd.comodos || [];

  // Fundo: pedra sólida
  ctx.fillStyle = '#080810';
  ctx.fillRect(0, 0, W, H);
  const cols = Math.ceil(W / TS), rows = Math.ceil(H / TS);
  for (let ty = 0; ty < rows; ty++)
    for (let tx = 0; tx < cols; tx++) {
      const n = _tnoise(tx * 0.6, ty * 0.6) * 0.5 + _tnoise(tx * 2.2, ty * 2.2) * 0.5;
      _drawTile(ctx, tx*TS, ty*TS, TS, 22, 18, 30, n, 1);
    }

  if (!comodos.length) return;

  const xs  = comodos.map((c: any) => c.x), ys  = comodos.map((c: any) => c.y);
  const x2s = comodos.map((c: any) => c.x + c.w), y2s = comodos.map((c: any) => c.y + c.h);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const maxX = Math.max(...x2s), maxY = Math.max(...y2s);
  const MARGIN = 24;
  const sc = Math.min((W - MARGIN*2) / (maxX - minX || 1), (H - MARGIN*2) / (maxY - minY || 1));
  const offX = MARGIN + ((W - MARGIN*2) - (maxX - minX) * sc) / 2;
  const offY = MARGIN + ((H - MARGIN*2) - (maxY - minY) * sc) / 2;
  const toX = (x: any) => offX + (x - minX) * sc;
  const toY = (y: any) => offY + (y - minY) * sc;

  // Mapa de tipos de tile
  const tileType = new Uint8Array(cols * rows); // 0=pedra, 1=piso, 2=corredor
  const tileColor = new Array(cols * rows).fill(null);

  comodos.forEach((c: any) => {
    const tipo = c.tipo === 'corredor' ? 2 : 1;
    const cor  = c.cor ? _hex2rgb(c.cor) : null;
    const tx1 = Math.floor(toX(c.x)   / TS);
    const ty1 = Math.floor(toY(c.y)   / TS);
    const tx2 = Math.ceil ((toX(c.x + c.w)) / TS);
    const ty2 = Math.ceil ((toY(c.y + c.h)) / TS);
    for (let ty = ty1; ty < ty2; ty++)
      for (let tx = tx1; tx < tx2; tx++)
        if (tx >= 0 && ty >= 0 && tx < cols && ty < rows) {
          tileType[ty * cols + tx] = tipo;
          if (cor) tileColor[ty * cols + tx] = cor;
        }
  });

  // Corredores L-shaped entre salas adjacentes
  for (let i = 0; i < comodos.length - 1; i++) {
    const a = comodos[i], b = comodos[i+1];
    const ax = Math.floor((toX(a.x + a.w/2)) / TS);
    const ay = Math.floor((toY(a.y + a.h/2)) / TS);
    const bx = Math.floor((toX(b.x + b.w/2)) / TS);
    const by = Math.floor((toY(b.y + b.h/2)) / TS);
    // Horizontal depois vertical
    for (let tx = Math.min(ax,bx); tx <= Math.max(ax,bx); tx++)
      for (let dw = -1; dw <= 1; dw++) {
        const ty = ay + dw;
        if (tx>=0&&ty>=0&&tx<cols&&ty<rows && tileType[ty*cols+tx]===0)
          tileType[ty*cols+tx] = 2;
      }
    for (let ty = Math.min(ay,by); ty <= Math.max(ay,by); ty++)
      for (let dw = -1; dw <= 1; dw++) {
        const tx = bx + dw;
        if (tx>=0&&ty>=0&&tx<cols&&ty<rows && tileType[ty*cols+tx]===0)
          tileType[ty*cols+tx] = 2;
      }
  }

  // Renderizar
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const tipo = tileType[ty * cols + tx];
      if (tipo === 0) continue;
      const px = tx * TS, py = ty * TS;
      const n = _tnoise(tx * 1.1, ty * 1.1) * 0.55 + _tnoise(tx * 3.3, ty * 3.3) * 0.45;
      const cor = tileColor[ty * cols + tx];
      if (tipo === 1) {
        const r = cor ? cor.r : 40, g = cor ? cor.g : 32, b = cor ? cor.b : 55;
        // Verificar se é parede (borda de sala)
        const isBorda = [[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dy]) => {
          const nx2 = tx+dx, ny2 = ty+dy;
          return nx2<0||ny2<0||nx2>=cols||ny2>=rows||tileType[ny2*cols+nx2]===0;
        });
        if (isBorda) _drawTile(ctx, px, py, TS, Math.min(255,r+35), Math.min(255,g+30), Math.min(255,b+40), n, 1);
        else         _drawTile(ctx, px, py, TS, r, g, b, n, 1);
      } else {
        _drawTile(ctx, px, py, TS, 28, 24, 38, n, 1);
      }
    }
  }

  // Labels dos cômodos
  comodos.forEach((c: any) => {
    const cx = toX(c.x + c.w/2), cy = toY(c.y + c.h/2);
    const rw = c.w * sc, rh = c.h * sc;
    if (rw < 16 || rh < 10) return;
    ctx.save();
    ctx.font = `${Math.max(7, Math.min(11, sc * 0.7))}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 4;
    ctx.fillStyle = 'rgba(200,185,220,0.8)';
    ctx.fillText(c.nome || c.tipo, cx, cy);
    ctx.restore();
  });
}

// ── EDIFÍCIO — tiles de tijolo, pisos por cômodo ──────────────
function _renderEdificio(ctx: any, rd: any, W: any, H: any) {
  const TS = 8;
  const comodos = rd.comodos || [];

  // Fundo: exterior
  ctx.fillStyle = '#080c08';
  ctx.fillRect(0, 0, W, H);
  const cols = Math.ceil(W / TS), rows = Math.ceil(H / TS);
  for (let ty = 0; ty < rows; ty++)
    for (let tx = 0; tx < cols; tx++) {
      const n = _tnoise(tx * 0.5, ty * 0.5);
      _drawTile(ctx, tx*TS, ty*TS, TS, 18, 26, 18, n, 1);
    }

  if (!comodos.length) return;

  const xs  = comodos.map((c: any) => c.x), ys  = comodos.map((c: any) => c.y);
  const x2s = comodos.map((c: any) => c.x + c.w), y2s = comodos.map((c: any) => c.y + c.h);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const maxX = Math.max(...x2s), maxY = Math.max(...y2s);
  const MARGIN = 20;
  const sc = Math.min((W - MARGIN*2) / (maxX - minX || 1), (H - MARGIN*2) / (maxY - minY || 1));
  const offX = MARGIN + ((W - MARGIN*2) - (maxX - minX) * sc) / 2;
  const offY = MARGIN + ((H - MARGIN*2) - (maxY - minY) * sc) / 2;
  const toX = (x: any) => offX + (x - minX) * sc;
  const toY = (y: any) => offY + (y - minY) * sc;

  const tileType  = new Uint8Array(cols * rows); // 0=exterior, 1=parede, 2=piso
  const tileColor = new Array(cols * rows).fill(null);

  comodos.forEach((c: any) => {
    const cor = c.cor ? _hex2rgb(c.cor) : null;
    const tx1 = Math.floor(toX(c.x)       / TS);
    const ty1 = Math.floor(toY(c.y)       / TS);
    const tx2 = Math.ceil (toX(c.x + c.w) / TS);
    const ty2 = Math.ceil (toY(c.y + c.h) / TS);
    for (let ty = ty1; ty < ty2; ty++)
      for (let tx = tx1; tx < tx2; tx++)
        if (tx >= 0 && ty >= 0 && tx < cols && ty < rows) {
          tileType[ty * cols + tx] = 2;
          if (cor) tileColor[ty * cols + tx] = cor;
        }
  });

  // Marcar paredes (tiles de piso adjacentes ao exterior)
  for (let ty = 0; ty < rows; ty++)
    for (let tx = 0; tx < cols; tx++)
      if (tileType[ty * cols + tx] === 2) {
        const isBorda = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]].some(([dx,dy]) => {
          const nx2 = tx+dx, ny2 = ty+dy;
          return nx2<0||ny2<0||nx2>=cols||ny2>=rows||tileType[ny2*cols+nx2]===0;
        });
        if (isBorda) tileType[ty * cols + tx] = 1;
      }

  // Renderizar
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const tipo = tileType[ty * cols + tx];
      if (tipo === 0) continue;
      const px = tx * TS, py = ty * TS;
      const n = _tnoise(tx * 1.3, ty * 1.3) * 0.5 + _tnoise(tx * 4.1, ty * 4.1) * 0.5;
      if (tipo === 1) {
        // Parede: tijolo com padrão de aparelhamento
        const rowOffset = ty % 2 === 0 ? 0 : 0.5;
        const brickN = _th(Math.floor(tx + rowOffset), ty);
        _drawTile(ctx, px, py, TS, 75 + Math.round(brickN * 20), 60 + Math.round(brickN * 12), 45 + Math.round(brickN * 8), n, 1);
      } else {
        const cor = tileColor[ty * cols + tx];
        const r = cor ? cor.r : 48, g = cor ? cor.g : 38, b = cor ? cor.b : 26;
        _drawTile(ctx, px, py, TS, r, g, b, n, 1);
      }
    }
  }

  // Labels dos cômodos
  comodos.forEach((c: any) => {
    const cx = toX(c.x + c.w/2), cy = toY(c.y + c.h/2);
    const rw = c.w * sc, rh = c.h * sc;
    if (rw < 16 || rh < 10) return;
    ctx.save();
    ctx.font = `${Math.max(7, Math.min(11, sc * 0.7))}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 4;
    ctx.fillStyle = 'rgba(210,190,150,0.85)';
    ctx.fillText(c.nome || c.tipo, cx, cy);
    ctx.restore();
  });
}



function _roundRect(ctx: any, x: any, y: any, w: any, h: any, r: any) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Schema SVG+JSON reutilizado nos prompts de mapa ──────────────────────────
const SCHEMA_MAPA_SVG = `━━━ FORMATO DE SAÍDA — SVG+JSON ━━━

Retorne um array JSON. Cada objeto é um mapa. O SVG do mapa deve estar no campo "svg".
Retorne APENAS o array JSON, sem texto antes ou depois, sem markdown.

Estrutura de cada mapa:
{
  "map_id": "id_unico_lowercase_sem_espacos",
  "nome": "Nome do local",
  "tipo": "geral" | "local",
  "visao": "top" | "iso",
  "parent_map_id": "map_id do pai, ou null se for raiz",
  "escala_val": 5,
  "escala_unit": "km",
  "grid": 20,
  "descricao": "Descrição atmosférica para o narrador (1-2 frases)",
  "locais": [
    {
      "local_id": "id_zona",
      "nome": "Rótulo da zona clicável",
      "mapa_local_id": "map_id do mapa que abre ao clicar",
      "x_percent": 45,
      "y_percent": 60,
      "raio": 20
    }
  ],
  "svg": "<svg viewBox=\\"0 0 800 500\\" xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>"
}

━━━ CAMPO visao ━━━

  "top" — visão ortogonal de cima (câmera perpendicular ao plano)
    → Para: regiões, continentes, cidades com bairros, qualquer mapa-contêiner
    → SVG: sem perspectiva lateral, biomas/texturas no plano, rios com curvas, montanhas como silhuetas

  "iso" — perspectiva isométrica 2:1 (ângulo 26,57°)
    → Para: dungeons, interiores, bairros com detalhe tático, locais específicos
    → SVG: pisos como losangos, paredes com altura projetada, volumes 3D com 3 faces visíveis

━━━ HIERARQUIA DE NAVEGAÇÃO ━━━

O sistema permite navegar clicando em zonas. Cada mapa pode ter locais[] que abrem outros mapas.
Estrutura recomendada (3 níveis):

  NÍVEL 1 — REGIÃO (visao: "top", tipo: "geral")
    SVG com biomas, rios, relevos, cidades como ícones marcados
    locais[] → mapas de cidades/locais de nível 2

  NÍVEL 2 — ÁREA/CIDADE (visao: "top" ou "iso", tipo: "geral" ou "local")
    SVG com bairros, ruas, edifícios principais, pontos de interesse
    locais[] → interiores de nível 3

  NÍVEL 3 — INTERIOR TÁTICO (visao: "iso", tipo: "local")
    SVG isométrico com cômodos, corredores, objetos
    escala_val: 1.5, escala_unit: "m"
    locais[] → saídas/entradas (opcional)

━━━ REQUISITOS DO SVG ━━━

• viewBox="0 0 800 500" em todos os mapas
• Sem <script>, sem <image> com src externo
• Elementos permitidos: <path> <polygon> <rect> <circle> <ellipse> <line> <text>
  <g> <defs> <linearGradient> <radialGradient> <pattern> <filter> <use> <symbol>
• <symbol> + <use> para elementos repetidos (árvores, tochas, colunas, pedras)
• Tamanho máximo: 200KB por SVG — use densidade inteligente, não repetição bruta
• Texto: font-family="serif" ou font-family="sans-serif" apenas

━━━ QUALIDADE VISUAL MÁXIMA ━━━

• Toda superfície com profundidade: gradientes multicamada, feTurbulence para texturas orgânicas
• feDropShadow para objetos com altura (árvores, muros, torres, cofres)
• <pattern> para pisos repetidos (pedra, madeira, grama, água)
• Formas orgânicas com <path> curvilíneo (rios, costas, clareiras, bordas de floresta)
• Liberdade total de estilo: realista, cartográfico, fantasia, sombrio, colorido — siga o tom da campanha
• Sem áreas grandes com cor sólida — toda superfície tem textura ou gradiente

Para VISÃO ISO — PERSPECTIVA DIMÉTRICA ESTILO DIABLO 3 (CRÍTICO):
Câmera ortográfica com rotação Z 45° + inclinação X ~60°. Sem ponto de fuga.
• Pisos: losangos largos (ratio ~2:1 H:V). O centro isométrico fica em aprox. 400,250
  Losango de tile: M 400,200 L 460,230 L 400,260 L 340,230 Z (120×60px)
• Paredes e objetos: 3 faces visíveis (topo plano, face-esquerda, face-direita)
• Profundidade: renderize fundo→frente (objetos do topo do SVG antes, frente por cima)
• Iluminação: fonte superior-esquerda — topo claro, face-esq médio, face-dir escura (contraste ≥15%)
• Sombras projetadas paralelas no chão para tudo com altura (não radiais — câmera ortográfica)
• Use feDropShadow ou <path> de sombra pré-computado para árvores, muros, colunas, cofres
• Objetos no topo da cena (fundo isométrico) podem ser sutilmente menores que os da frente,
  reforçando a sensação 3D do Diablo sem quebrar a projeção paralela
• NUNCA use perspectiva cônica (ponto de fuga único) — câmera ortográfica pura`;

function gerarPromptMapasSVGInicio(contexto: any) {
  return `Você vai gerar os mapas iniciais de uma campanha de RPG para o sistema RPG Hub.
Os mapas são SVGs embutidos num JSON — sem biomas pré-definidos, liberdade total de criação visual.

━━━ CONTEXTO DA CAMPANHA ━━━
${contexto}

━━━ O QUE GERAR ━━━

Gere uma hierarquia de 3 níveis:

NÍVEL 1 — 1 mapa de MUNDO (tipo:"mundo") — TOP-DOWN
  SVG: território completo com relevos, biomas, rios, cidades como pontos marcados.
  locais[] apontando para os mapas do nível 2.

NÍVEL 2 — 2 a 3 mapas TÁTICOS (tipo:"tatico") — TOP-DOWN
  SVG: ruas, bairros, edifícios, ou área aberta detalhada.
  locais[] apontando para os interiores do nível 3.

NÍVEL 3 — 2 a 4 interiores TÁTICOS (tipo:"tatico") — TOP-DOWN
  Vista de cima: pisos como tiles, paredes como bordas espessas, sombras projetadas para baixo.
  NÃO use perspectiva isométrica, losangos, paredes com 3 faces ou Diablo-style.
  escala_val: 1.5, escala_unit: "m".

⚠️ Qualidade visual > quantidade. SVGs ricos em poucos mapas. Use o máximo da capacidade
gráfica — gradientes, texturas, filtros, sombras. Siga o tom da campanha.

${SCHEMA_MAPA_SVG}`;
}

function gerarPromptMapasSVGAtualizacao(contexto: any, mapasExistentes: any) {
  const listaMapas = mapasExistentes.length
    ? mapasExistentes.map((l: any) => {
        const tipo = mapaGetTipo(l.mapa);
        const icon = tipo === 'tatico' ? '🗺 TÁTICO' : '🌍 MUNDO';
        return `  • ${icon} "${l.mapa.nome}" [${l.mapa.map_id}] (tipo: ${tipo})`;
      }).join('\n')
    : '  (nenhum ainda)';

  return `Você vai gerar novos mapas para uma campanha de RPG em andamento no sistema RPG Hub.
Os mapas são SVGs embutidos num JSON — sem biomas pré-definidos, liberdade total de criação visual.

━━━ CONTEXTO ATUAL ━━━
${contexto}

━━━ MAPAS JÁ EXISTENTES (não repita map_ids) ━━━
${listaMapas}

━━━ O QUE GERAR ━━━
Gere apenas o necessário para os próximos passos da campanha. Respeite a hierarquia:
• Se falta um local que os jogadores vão visitar → gere-o
• Se falta o interior de uma cena importante → gere-o
• Cada novo mapa deve ter locais[] conectando corretamente aos mapas existentes se houver relação

TODOS os mapas são TOP-DOWN. NÃO use perspectiva isométrica, losangos ou paredes com 3 faces.
tipo:"mundo" → território narrativo top-down, sem grade tática.
tipo:"tatico" → planta baixa vista de cima, tiles e bordas.
Priorize qualidade visual — SVG com gradientes, texturas, filtros, sombras.

${SCHEMA_MAPA_SVG}`;
}


// ════════════════════════════════════════════════════════════════════════════
// 8.5 — PROMPT PACOTE DE SESSÃO
// ════════════════════════════════════════════════════════════════════════════

function gerarPromptPacoteSessao() {
  const rpg = CURRENT_RPG||{};
  const nome = rpg.theme?.name||RPG_DATA?.config?.name||'Campanha';
  const sistema = RPG_DATA?.config?.sistema||'RPG Hub';
  const chars = (RPG_DATA?.characters||[]).filter(c => { const ca=c.custom_attrs||{}; return ca.tipo_personagem!=='npc'&&ca.tipo!=='npc'&&!ca.morto; });
  const npcs  = (RPG_DATA?.characters||[]).filter(c => { const ca=c.custom_attrs||{}; return (ca.tipo_personagem==='npc'||ca.tipo==='npc')&&!ca.morto; }).slice(0,8);
  const cenaUsadas = SESSAO_ATUAL?.cenas?.filter(c=>c.status==='usada').map(c=>c.id)||[];
  const mapas = (RPG_DATA?.mapas||[]).map(l => l.mapa.nome+' ['+l.mapa.map_id+'] ('+mapaGetTipo(l.mapa)+')');
  const ctxChars = chars.map(c => {
    const ca=c.custom_attrs||{};
    const pos = MAPA_STATE?.mapaAtualId ? getPosicaoNoMapa(c,MAPA_STATE.mapaAtualId) : null;
    const posStr = pos ? ' em '+String.fromCharCode(65+pos.col)+(pos.row+1) : '';
    return '  • '+c.nome+' (nível '+(c.nivel||1)+', HP '+(c.hp_atual??ca.hp_max??'?')+'/'+(ca.hp_max??'?')+')'+posStr;
  }).join('\n');

  return `Você é um assistente de RPG para o sistema RPG Hub.
Crie um Pacote de Sessão completo usando EXATAMENTE a gramática abaixo.

━━━ CONTEXTO ━━━
Campanha: \${nome} | Sistema: \${sistema}
Cenas já usadas: \${cenaUsadas.length?cenaUsadas.join(', '):'(nenhuma)'}
Personagens: \n\${ctxChars||'  (nenhum posicionado)'}
NPCs vivos: \${npcs.map(c=>c.nome).join(', ')||'(nenhum)'}
Mapas: \${mapas.join(' | ')||'(nenhum)'}

━━━ GRAMÁTICA ━━━

SESSÃO: "Nome" | sistema: \${sistema}
CENA N | cenario: map_id | musica: suspense | condicao: opcional
  NARRAÇÃO: "Texto para o narrador."
  SPAWN: nome COLROW | comportamento: arquetipo | alvo_fixo: Nome
  FOG: revelar A1:D5
  FOG: revelar_gradual
  ZONA: tipo COORD "Label"
  BATALHA: iniciar

Coordenadas: A=col1, B=col2... | 1=linha1, 2=linha2... | Ex: A3=col1,row3

━━━ ZONA_TIPO ━━━
interesse perigo saida bau_grupo passagem

━━━ ARQUÉTIPOS NPC ━━━
agressivo defensivo suporte covarde protetor berserk emboscador cacador estrategista aleatorio

━━━ ORGANOGRAMA (opcional) ━━━
ORGANOGRAMA: "Nome do Arco"
  NÓ: id "Nome"
    requer: elemento, NPC_nome
    conecta: outro_id (via saida_norte)

━━━ REGRAS ━━━
• Toda cena tática deve ter pelo menos 1 ZONA: saida
• Cenas ficam em pool — sem ordem obrigatória
• Fog revelado persiste entre cenas (memória do grupo)
• Inclua 2-4 cenas + 1 opcional

Gere o pacote agora.`;
}

window.gerarPromptPacoteSessao = gerarPromptPacoteSessao;
window.copiarPromptPacoteSessao = function() {
  const texto = gerarPromptPacoteSessao();
  if (navigator.clipboard) navigator.clipboard.writeText(texto).then(()=>mostrarToast('📋 Prompt copiado!','ok'));
  else fbCopy(texto, ()=>mostrarToast('📋 Prompt copiado!','ok'));
};

function copiarPromptSecao(secao: any){
 const isAt = IMPORT_MODE === 'atualizar';
 let texto;
 if (secao === 'completo') {
   texto = gerarPromptMestre();
 } else if (secao === 'pacote') {
   texto = gerarPromptPacoteSessao();
 } else if (secao === 'mapas') {
   // Prompt de configuração de mapas (sem SVG — imagem adicionada depois)
   const contextoEl = document.getElementById('ia-mapa-contexto');
   const contexto = contextoEl?.value.trim() || '[Descreva o contexto da campanha aqui antes de copiar o prompt]';
   const mapasExistentes = RPG_DATA?.mapas || [];
   texto = gerarPromptMapasConfig(contexto, mapasExistentes);
 } else if (secao === 'mapas-svg') {
   // Prompt SVG+JSON completo (para quem quer gerar o visual também)
   const contextoEl = document.getElementById('ia-mapa-contexto');
   const contexto = contextoEl?.value.trim() || '[Descreva o contexto da campanha aqui antes de copiar o prompt]';
   const mapasExistentes = RPG_DATA?.mapas || [];
   texto = isAt
     ? gerarPromptMapasSVGAtualizacao(contexto, mapasExistentes)
     : gerarPromptMapasSVGInicio(contexto);
 } else {
   const REGRA_ZERO = `\u26a0\ufe0f REGRA ZERO: Você está TRANSCREVENDO um jogo que JÁ EXISTE. Extraia e organize o que está no material. NÃO invente nada. Campo sem informação → deixe BRANCO.`;
   texto = isAt
     ? `${REGRA_ZERO}\n\nGere APENAS a seção #SECTION:${secao} para ATUALIZAR a campanha. Inclua TODOS os registros (não só alterados). Sem texto antes ou depois.\nRegras: "" para aspas internas, \\n para quebras de linha.\n\n#SECTION:${secao}\n${SPECS[secao]||''}\n\n${secao==='config'?'CRÍTICO: Ícones e animações devem ser ÚNICOS e representar visualmente o tema da campanha.':''}\n\nGere a seção.`
     : `${REGRA_ZERO}\n\nGere APENAS a seção #SECTION:${secao}. Sem texto antes ou depois.\nRegras: "" para aspas internas, \\n para quebras de linha.\n\n#SECTION:${secao}\n${SPECS[secao]||''}\n\n${secao==='config'?'CRÍTICO: Crie ícones e animações que capturam o ESPÍRITO da campanha. Seja único e memorável.':''}\n\nGere a seção.`;
 }
 const okEl = document.getElementById('ok-' + secao);
 const copiar = () => {
   const btn = okEl?.closest('.prompt-copy-btn');
   if (btn) btn.classList.add('copied');
   if (okEl) okEl.style.display = 'inline';
   setTimeout(() => { if (btn) btn.classList.remove('copied'); if (okEl) okEl.style.display = 'none'; }, 2500);
 };
 if (navigator.clipboard) navigator.clipboard.writeText(texto).then(copiar).catch(() => fbCopy(texto, copiar));
 else fbCopy(texto, copiar);
}
function fbCopy(t: any,cb: any){const ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(e){}document.body.removeChild(ta);if(cb)cb();}


// ── UTILS ─────────────────────────────────────────────────────
function salvarNav(screen: any, id: any=null){ try{ localStorage.setItem('rpghub_nav', JSON.stringify({screen,id})); }catch(e){} }
function salvarAba(rpgId: any, aba: any){ try{ localStorage.setItem('rpghub_tab_'+rpgId, aba); }catch(e){} }
// ════════════════════════════════════════════════════════════════════
// LAYOUT 2-COLUNAS DO MAPA — sidebar scrollável + mapa fixo
// O CSS (#mapa-area-esq / #mapa-sidebar) faz o layout;
// este JS só move o DOM (uma única vez) e ajusta altura.
// ════════════════════════════════════════════════════════════════════
function _mapaInicializarLayout() {
  if (window.innerWidth > 1100) return; // modo mesa 3-col cuida das telas largas
  const tabMapas = document.getElementById('tab-mapas');
  if (!tabMapas) return;
  // Em portrait mobile muito estreito (< 480px), sidebar vai p/ baixo como barra
  const _isTinyPortrait = window.innerWidth < 480 && window.innerHeight > window.innerWidth;
  const sidebar = document.getElementById('mapa-sidebar');
  if (sidebar) {
    if (_isTinyPortrait) {
      sidebar.style.width = '100%';
      sidebar.style.maxHeight = '38vh';
      sidebar.style.borderLeft = 'none';
      sidebar.style.borderTop = '1px solid var(--borda)';
    } else {
      sidebar.style.width = window.innerWidth < 600 ? '185px' : '240px';
      sidebar.style.maxHeight = '';
      sidebar.style.borderLeft = '1px solid var(--borda)';
      sidebar.style.borderTop = 'none';
    }
    // forçar flex-direction no tab-mapas conforme orientação
    tabMapas.style.flexDirection = _isTinyPortrait ? 'column' : 'row';
  }

  // Só reestrutura o DOM uma vez
  if (!document.getElementById('mapa-sidebar')) {
    // ── Sidebar direita ──────────────────────────────────────────
    const sidebar = document.createElement('div');
    sidebar.id = 'mapa-sidebar';

    // Seção de botões contextuais (preenchida por _ctxAtualizarPainelDesktop)
    const ctxBox = document.createElement('div');
    ctxBox.id = 'ctx-sidebar-botoes';
    ctxBox.style.display = 'none';
    ctxBox.innerHTML =
      '<div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--destaque);' +
      'text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">⚡ Ações</div>' +
      '<div id="ctx-sidebar-lista" style="display:flex;flex-direction:column;gap:4px"></div>';
    sidebar.appendChild(ctxBox);

    // Painel de ataque inline (seleção de habilidade + alvo — substitui o float panel)
    const atkBox = document.createElement('div');
    atkBox.id = 'atk-sidebar-painel';
    atkBox.style.cssText = 'display:none;border-top:1px solid rgba(192,57,43,0.3);padding-top:8px;margin-top:4px';
    sidebar.appendChild(atkBox);

    // Trigger de confirmação inline (substitui overlay no mapa)
    const trigBox = document.createElement('div');
    trigBox.id = 'atk-sidebar-trigger';
    trigBox.style.cssText = 'display:none;border-top:1px solid rgba(200,168,75,0.25);padding-top:8px;margin-top:4px';
    sidebar.appendChild(trigBox);

    // Ficha do personagem inline (substitui modal fixo)
    const fichaBox = document.createElement('div');
    fichaBox.id = 'ficha-sidebar-painel';
    fichaBox.style.cssText = 'display:none;border-top:1px solid var(--borda);padding-top:8px;margin-top:4px';
    sidebar.appendChild(fichaBox);

    // Mover conteúdo que ficava embaixo do mapa para a sidebar
    const idsParaSidebar = [
      'mapa-status','criativo-mapa-bar','atk-criativo-aprovado-mapa',
      'atk-painel-campanha-anchor','feed-painel-inline','sessao-painel',
      'batalhas-selector','mapa-batalha-bar','mapa-batalha-btn',
      'rpg-load-status','mapa-batalha-outro','criativos-mestre-wrap'
    ];
    idsParaSidebar.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.style.marginTop = '0'; sidebar.appendChild(el); }
    });
    tabMapas.appendChild(sidebar);

    // ── Coluna esquerda: área do mapa ────────────────────────────
    const leftArea = document.createElement('div');
    leftArea.id = 'mapa-area-esq';
    const idsParaEsq = [
      'mapa-breadcrumb','mapa-lista','mapa-toolbar',
      'mobile-controle-banner','mapa-wrap',
      'mapa-tool-hint','mapa-placement-hint','mapa-tool-zonas-hint'
    ];
    idsParaEsq.forEach(id => {
      const el = document.getElementById(id);
      if (el) leftArea.appendChild(el);
    });
    tabMapas.insertBefore(leftArea, sidebar);

    // Ajustar altura ao redimensionar + remover classe em telas largas
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1100) {
        tabMapas.classList.remove('layout-2col');
      } else {
        tabMapas.classList.add('layout-2col');
        _mapaAjustarAlturaLayout();
      }
    });
  }

  // Ativar o layout — CSS só aplica flex com esta classe presente
  tabMapas.classList.add('layout-2col');
  _mapaAjustarAlturaLayout();
}

function _mapaAjustarAlturaLayout() {
  const tabMapas = document.getElementById('tab-mapas');
  if (!tabMapas || window.innerWidth > 1100) return;
  const nav    = document.querySelector('.nav-tabs');
  const header = document.querySelector('header');
  const navH    = nav    ? nav.offsetHeight    : 0;
  const headerH = header ? header.offsetHeight : 0;
  tabMapas.style.height = `calc(100dvh - ${headerH + navH}px)`;

  // Portrait tiny: mapa-area-esq deve ter altura mínima de 55vh
  const _isTinyPortrait = window.innerWidth < 480 && window.innerHeight > window.innerWidth;
  const leftArea = document.getElementById('mapa-area-esq');
  if (leftArea) {
    leftArea.style.minHeight = _isTinyPortrait ? '55vh' : '0';
    leftArea.style.flex = _isTinyPortrait ? '0 0 auto' : '1';
  }
}

function _ctxSidebarLimpar() {
  const sb = document.getElementById('ctx-sidebar-botoes');
  if (sb) sb.style.display = 'none';
  const p = document.getElementById('ctx-botoes-painel');
  if (p) p.innerHTML = '';
}

function abrirAba(id: any,btn: any){
  // Redirects: old tabs now unified in 'fichas'
  if (id === 'personagem' || id === 'atributos') {
    const fichasBtn = document.querySelector('.tab-btn[onclick*="fichas"]');
    if (fichasBtn) { abrirAba('fichas', fichasBtn); return; }
  }
  document.body.classList.toggle('mesa-ativa', id === 'mapas');
  document.body.classList.remove('nav-peek');
  if (id === 'mapas') {
    setTimeout(mesaModoVerificar, 100);
    setTimeout(_atualizarBannerControleMobile, 150);
    setTimeout(_mapaInicializarLayout, 60);
  }
  document.querySelectorAll('.tab-content').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+id)?.classList.add('active');
  btn.classList.add('active');
  if(id==='mapas'){ renderMapasTab(); }
  if(id==='fichas'){
    if(typeof renderFichasBtns==='function') renderFichasBtns();
    if(FICHAS_VIEW && typeof renderFichaView==='function') renderFichaView(FICHAS_VIEW);
  }
  if(RPG_DATA?.rpgId) salvarAba(RPG_DATA.rpgId, id);
}
function mostrarToast(msg: any,tipo?: any,_dur?: any){const t=document.getElementById('toast');t.textContent=msg;t.className='toast '+(tipo||'');t.classList.add('visivel');setTimeout(()=>t.classList.remove('visivel'),2400);}

if ('serviceWorker' in navigator) {
   window.addEventListener('load', () => {
     navigator.serviceWorker.register('./sw.js')
       .then(reg => console.log('[RPG Hub] SW registrado:', reg.scope))
       .catch(err => console.warn('[RPG Hub] SW falhou:', err));
   });
 }


/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "IMPORT_MODE", { configurable: true, get: () => IMPORT_MODE, set: (__v) => { IMPORT_MODE = __v; } });
Object.defineProperty(globalThis, "PLABELS", { configurable: true, get: () => PLABELS });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "setImportMode", { configurable: true, get: () => setImportMode, set: (__v) => { setImportMode = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "preencherSeletorRPGs", { configurable: true, get: () => preencherSeletorRPGs, set: (__v) => { preencherSeletorRPGs = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirImport", { configurable: true, get: () => abrirImport, set: (__v) => { abrirImport = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharImport", { configurable: true, get: () => fecharImport, set: (__v) => { fecharImport = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirPixiStudio", { configurable: true, get: () => abrirPixiStudio, set: (__v) => { abrirPixiStudio = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharPixiStudio", { configurable: true, get: () => fecharPixiStudio, set: (__v) => { fecharPixiStudio = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "lerCSV", { configurable: true, get: () => lerCSV, set: (__v) => { lerCSV = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "lerCSVPaste", { configurable: true, get: () => lerCSVPaste, set: (__v) => { lerCSVPaste = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "lerAllInOne", { configurable: true, get: () => lerAllInOne, set: (__v) => { lerAllInOne = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "lerAllInOnePaste", { configurable: true, get: () => lerAllInOnePaste, set: (__v) => { lerAllInOnePaste = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "lerMapasJSONFile", { configurable: true, get: () => lerMapasJSONFile, set: (__v) => { lerMapasJSONFile = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "lerMapasJSONPaste", { configurable: true, get: () => lerMapasJSONPaste, set: (__v) => { lerMapasJSONPaste = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_processarMapasJSONTexto", { configurable: true, get: () => _processarMapasJSONTexto, set: (__v) => { _processarMapasJSONTexto = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "importarSoMapas", { configurable: true, get: () => importarSoMapas, set: (__v) => { importarSoMapas = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "parseMultiSection", { configurable: true, get: () => parseMultiSection, set: (__v) => { parseMultiSection = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "parseCSV", { configurable: true, get: () => parseCSV, set: (__v) => { parseCSV = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "parseCSVLine", { configurable: true, get: () => parseCSVLine, set: (__v) => { parseCSVLine = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "enviarImport", { configurable: true, get: () => enviarImport, set: (__v) => { enviarImport = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "showSt", { configurable: true, get: () => showSt, set: (__v) => { showSt = __v; } });
Object.defineProperty(globalThis, "SPECS", { configurable: true, get: () => SPECS });
Object.defineProperty(globalThis, "SPEC_MAPAS_CONFIG", { configurable: true, get: () => SPEC_MAPAS_CONFIG });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "gerarPromptMestre", { configurable: true, get: () => gerarPromptMestre, set: (__v) => { gerarPromptMestre = __v; } });
Object.defineProperty(globalThis, "_mapasImportJSON", { configurable: true, get: () => _mapasImportJSON, set: (__v) => { _mapasImportJSON = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "lerMapasJSON", { configurable: true, get: () => lerMapasJSON, set: (__v) => { lerMapasJSON = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "importarMapasJSON", { configurable: true, get: () => importarMapasJSON, set: (__v) => { importarMapasJSON = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalGerarMapaIA", { configurable: true, get: () => abrirModalGerarMapaIA, set: (__v) => { abrirModalGerarMapaIA = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "copiarPromptMapaMesa", { configurable: true, get: () => copiarPromptMapaMesa, set: (__v) => { copiarPromptMapaMesa = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "copiarPromptMapaMesaSVG", { configurable: true, get: () => copiarPromptMapaMesaSVG, set: (__v) => { copiarPromptMapaMesaSVG = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "importarMapasMesaPaste", { configurable: true, get: () => importarMapasMesaPaste, set: (__v) => { importarMapasMesaPaste = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "gerarPromptMapasConfig", { configurable: true, get: () => gerarPromptMapasConfig, set: (__v) => { gerarPromptMapasConfig = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mapaRenderCanvas", { configurable: true, get: () => mapaRenderCanvas, set: (__v) => { mapaRenderCanvas = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_renderCidade", { configurable: true, get: () => _renderCidade, set: (__v) => { _renderCidade = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_th", { configurable: true, get: () => _th, set: (__v) => { _th = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_tnoise", { configurable: true, get: () => _tnoise, set: (__v) => { _tnoise = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_hex2rgb", { configurable: true, get: () => _hex2rgb, set: (__v) => { _hex2rgb = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_drawTile", { configurable: true, get: () => _drawTile, set: (__v) => { _drawTile = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_renderBiomasTile", { configurable: true, get: () => _renderBiomasTile, set: (__v) => { _renderBiomasTile = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_renderGeral", { configurable: true, get: () => _renderGeral, set: (__v) => { _renderGeral = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_renderAreaAberta", { configurable: true, get: () => _renderAreaAberta, set: (__v) => { _renderAreaAberta = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_renderDungeon", { configurable: true, get: () => _renderDungeon, set: (__v) => { _renderDungeon = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_renderEdificio", { configurable: true, get: () => _renderEdificio, set: (__v) => { _renderEdificio = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_roundRect", { configurable: true, get: () => _roundRect, set: (__v) => { _roundRect = __v; } });
Object.defineProperty(globalThis, "SCHEMA_MAPA_SVG", { configurable: true, get: () => SCHEMA_MAPA_SVG });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "gerarPromptMapasSVGInicio", { configurable: true, get: () => gerarPromptMapasSVGInicio, set: (__v) => { gerarPromptMapasSVGInicio = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "gerarPromptMapasSVGAtualizacao", { configurable: true, get: () => gerarPromptMapasSVGAtualizacao, set: (__v) => { gerarPromptMapasSVGAtualizacao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "gerarPromptPacoteSessao", { configurable: true, get: () => gerarPromptPacoteSessao, set: (__v) => { gerarPromptPacoteSessao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "copiarPromptSecao", { configurable: true, get: () => copiarPromptSecao, set: (__v) => { copiarPromptSecao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fbCopy", { configurable: true, get: () => fbCopy, set: (__v) => { fbCopy = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "salvarNav", { configurable: true, get: () => salvarNav, set: (__v) => { salvarNav = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "salvarAba", { configurable: true, get: () => salvarAba, set: (__v) => { salvarAba = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mapaInicializarLayout", { configurable: true, get: () => _mapaInicializarLayout, set: (__v) => { _mapaInicializarLayout = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mapaAjustarAlturaLayout", { configurable: true, get: () => _mapaAjustarAlturaLayout, set: (__v) => { _mapaAjustarAlturaLayout = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_ctxSidebarLimpar", { configurable: true, get: () => _ctxSidebarLimpar, set: (__v) => { _ctxSidebarLimpar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirAba", { configurable: true, get: () => abrirAba, set: (__v) => { abrirAba = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mostrarToast", { configurable: true, get: () => mostrarToast, set: (__v) => { mostrarToast = __v; } });
