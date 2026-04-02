// maps/maps.js
// RPG Hub — Map rendering system, fog of war, battle mode, movement controls
// Contains two sections: map visual rendering (5075-8649) and map campaign (11501-16894)

// ── TIPO: Mídia (gif, imagem, svg, iframe) ─────────────────────────────────
function _animMedia(animacao, origem, alvo, resolve) {
  const { tipo, url, svg, tamanho = 120, duracao = 1500, posicao = 'alvo' } = animacao;

  // Calcular posição do elemento
  let cx, cy;
  if (posicao === 'atacante') {
    cx = origem.x; cy = origem.y;
  } else if (posicao === 'meio') {
    cx = (origem.x + alvo.x) / 2; cy = (origem.y + alvo.y) / 2;
  } else {
    cx = alvo.x; cy = alvo.y;
  }

  // Container overlay
  const wrap = document.createElement('div');
  wrap.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:10100;overflow:hidden`;

  // Elemento de mídia
  let el;
  const sz = tamanho + 'px';

  if (tipo === 'gif' || tipo === 'imagem') {
    el = document.createElement('img');
    el.src = url;
    el.style.cssText = `width:${sz};height:${sz};object-fit:contain;border-radius:8px;position:absolute`;
  } else if (tipo === 'svg') {
    el = document.createElement('div');
    el.innerHTML = svg;
    el.style.cssText = `width:${sz};height:${sz};display:flex;align-items:center;justify-content:center;position:absolute`;
    const svgEl = el.querySelector('svg');
    if (svgEl) { svgEl.style.width = '100%'; svgEl.style.height = '100%'; }
  } else if (tipo === 'iframe') {
    el = document.createElement('iframe');
    el.src = url;
    el.style.cssText = `width:${sz};height:${sz};border:none;border-radius:8px;position:absolute;background:transparent`;
    el.setAttribute('allowtransparency', 'true');
    el.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  }

  if (!el) { resolve(); return; }

  // Se posição = trajetória: animar ao longo da trajetória
  const isTrajetoria = posicao === 'trajetoria';
  const halfSz = tamanho / 2;

  if (isTrajetoria) {
    el.style.left = (origem.x - halfSz) + 'px';
    el.style.top  = (origem.y - halfSz) + 'px';
  } else {
    el.style.left = (cx - halfSz) + 'px';
    el.style.top  = (cy - halfSz) + 'px';
  }

  // Transições CSS: fade in → hold → fade out
  el.style.opacity = '0';
  el.style.transition = `opacity 0.2s ease`;
  el.style.transform = 'scale(0.85)';

  wrap.appendChild(el);
  document.body.appendChild(wrap);

  // Fade in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'scale(1)';
      el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    });
  });

  // Trajetória: mover com RAF
  if (isTrajetoria) {
    const startTs = performance.now();
    const cx2 = (origem.x + alvo.x) / 2;
    const cy2 = Math.min(origem.y, alvo.y) - 60;
    function moveFrame(now) {
      const t = Math.min((now - startTs) / duracao, 1);
      const bx = (1-t)*(1-t)*origem.x + 2*(1-t)*t*cx2 + t*t*alvo.x;
      const by = (1-t)*(1-t)*origem.y + 2*(1-t)*t*cy2 + t*t*alvo.y;
      el.style.left = (bx - halfSz) + 'px';
      el.style.top  = (by - halfSz) + 'px';
      if (t < 1) requestAnimationFrame(moveFrame);
    }
    requestAnimationFrame(moveFrame);
  }

  // Fade out e remover
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'scale(1.1)';
    el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    setTimeout(() => { wrap.remove(); resolve(); }, 320);
  }, duracao - 320);
}

function _animImpacto(ctx, pos, rgb, cor, icone) {
  let f = 0;
  function frame() {
    f++; const alpha=Math.max(0,1-f/10), raio=10+f*4;
    ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
    const g=ctx.createRadialGradient(pos.x,pos.y,0,pos.x,pos.y,raio);
    g.addColorStop(0,`rgba(255,255,255,${alpha})`);
    g.addColorStop(0.4,`rgba(${rgb},${alpha})`);
    g.addColorStop(1,`rgba(${rgb},0)`);
    ctx.beginPath(); ctx.arc(pos.x,pos.y,raio,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    if (icone) {
      ctx.font=`${14+f*2}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.globalAlpha=alpha; ctx.fillText(icone,pos.x,pos.y); ctx.globalAlpha=1;
    }
    if (f < 10) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ── Validação de duração total da animação ──────────────────────────────────
function skAnimValidarDuracao() {
  const _isMestre = RPG_DATA?.myRole === 'mestre';
  const maxTotal  = _isMestre ? 10000 : 3000;
  const limLabel  = _isMestre ? '10s' : '3s';

  // Mídia
  const durM   = parseInt(document.getElementById('sk-anim-duracao')?.value) || 0;
  const repM   = parseInt(document.getElementById('sk-anim-repeticao')?.value) || 1;
  const totalM = durM * repM;
  const avisoM = document.getElementById('sk-anim-dur-aviso');
  if (avisoM) {
    const over = totalM > maxTotal;
    avisoM.style.display = totalM > 0 ? 'block' : 'none';
    avisoM.style.color   = over ? '#e8604c' : totalM > maxTotal * 0.85 ? '#f39c12' : 'rgba(255,255,255,0.35)';
    avisoM.textContent   = over ? `⚠ Total: ${totalM}ms — limite: ${maxTotal}ms (${limLabel})` : `Total: ${totalM}ms de ${maxTotal}ms`;
  }

  // Canvas
  const durC   = parseInt(document.getElementById('sk-anim-duracao-canvas')?.value) || 0;
  const repC   = parseInt(document.getElementById('sk-anim-repeticao-canvas')?.value) || 1;
  const totalC = durC * repC;
  const avisoC = document.getElementById('sk-anim-dur-aviso-canvas');
  if (avisoC) {
    const over = totalC > maxTotal;
    avisoC.style.display = totalC > 0 ? 'block' : 'none';
    avisoC.style.color   = over ? '#e8604c' : totalC > maxTotal * 0.85 ? '#f39c12' : 'rgba(255,255,255,0.35)';
    avisoC.textContent   = over ? `⚠ Total: ${totalC}ms — limite: ${maxTotal}ms (${limLabel})` : `Total: ${totalC}ms de ${maxTotal}ms`;
  }
}

// ── Preview no modal de skill ──────────────────────────────────────────────
let _skAnimPreviewRaf = null;

// ── UI: mudar campos ao selecionar tipo de animação ──────────────────────
function skAnimTipoChange() {
  const tipo = document.getElementById('sk-anim-tipo').value;
  const camposCanvas = document.getElementById('sk-anim-campos-canvas');
  const camposMidia  = document.getElementById('sk-anim-campos-midia');
  const isMidia  = ['gif','imagem','svg','iframe'].includes(tipo);
  const isCanvas = ['projetil','onda','explosao','raio','aura'].includes(tipo);

  if (camposCanvas) camposCanvas.style.display = isCanvas ? '' : 'none';
  if (camposMidia)  camposMidia.style.display  = isMidia  ? '' : 'none';

  if (isMidia) {
    // Ajustar label e mostrar campo correto
    const urlLabel  = document.getElementById('sk-anim-url-label');
    const urlInput  = document.getElementById('sk-anim-url');
    const svgInput  = document.getElementById('sk-anim-svg-code');
    const labels = { gif:'URL do GIF', imagem:'URL da Imagem', iframe:'URL do iFrame' };
    if (urlLabel) urlLabel.textContent = labels[tipo] || 'URL';
    if (urlInput)  urlInput.style.display  = tipo !== 'svg' ? '' : 'none';
    if (svgInput)  svgInput.style.display  = tipo === 'svg' ? '' : 'none';
    skAnimMidiaPreview();
  } else if (isCanvas) {
    skAnimPreview();
  } else {
    // nenhuma — esconder preview
    const pw = document.getElementById('sk-anim-preview-wrap');
    const mw = document.getElementById('sk-anim-midia-preview-wrap');
    if (pw) pw.style.display = 'none';
    if (mw) mw.style.display = 'none';
  }
}

function skAnimMidiaPreview() {
  const tipo   = document.getElementById('sk-anim-tipo').value;
  const url    = document.getElementById('sk-anim-url')?.value.trim();
  const svg    = document.getElementById('sk-anim-svg-code')?.value.trim();
  const tam    = parseInt(document.getElementById('sk-anim-tamanho')?.value) || 120;
  const wrap   = document.getElementById('sk-anim-midia-preview-wrap');
  const inner  = document.getElementById('sk-anim-midia-preview-inner');
  if (!wrap || !inner) return;

  const conteudo = tipo === 'svg' ? svg : url;
  if (!conteudo) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';

  const sz = Math.min(tam, 150);
  if (tipo === 'svg') {
    inner.innerHTML = `<div style="width:${sz}px;height:${sz}px;display:flex;align-items:center;justify-content:center">${svg}</div>`;
  } else if (tipo === 'gif' || tipo === 'imagem') {
    inner.innerHTML = `<img src="${url}" style="max-width:${sz}px;max-height:${sz}px;border-radius:6px;object-fit:contain" onerror="this.parentElement.innerHTML='<span style=color:#e74c3c;font-size:0.75rem>Erro ao carregar imagem</span>'">`;
  } else if (tipo === 'iframe') {
    inner.innerHTML = `<div style="font-size:0.72rem;color:var(--suave);font-style:italic">iFrame não pré-visualizável — será exibido durante o ataque</div>`;
  }
}


// ── Criativo mestre: troca campos ao mudar tipo ───────────────────────────
function criativoAnimTipoChange() {
  const tipo = document.getElementById('criativo-anim-tipo')?.value || 'nenhuma';
  const isMidia  = ['gif','imagem','svg','iframe'].includes(tipo);
  const isCanvas = ['projetil','onda','explosao','raio','aura'].includes(tipo);
  const cc = document.getElementById('criativo-anim-campos-canvas');
  const cm = document.getElementById('criativo-anim-campos-midia');
  if (cc) cc.style.display = isCanvas ? '' : 'none';
  if (cm) cm.style.display = isMidia  ? '' : 'none';
  if (isMidia) {
    const labels = { gif:'URL do GIF', imagem:'URL da Imagem', iframe:'URL do iFrame' };
    const lbl = document.getElementById('criativo-anim-url-label');
    const url = document.getElementById('criativo-anim-url');
    const svg = document.getElementById('criativo-anim-svg-code');
    if (lbl) lbl.textContent = labels[tipo] || 'URL';
    if (url) url.style.display = tipo !== 'svg' ? '' : 'none';
    if (svg) svg.style.display = tipo === 'svg' ? '' : 'none';
  }
}

// ── Arena mestre-dano: troca campos ao mudar tipo ─────────────────────────
function arAnimDnTipoChange() {
  const tipo = document.getElementById('ar-atk-dn-anim-tipo')?.value || 'nenhuma';
  const isMidia  = ['gif','imagem','svg','iframe'].includes(tipo);
  const isCanvas = ['projetil','onda','explosao','raio','aura'].includes(tipo);
  const cc = document.getElementById('ar-atk-dn-anim-canvas');
  const cm = document.getElementById('ar-atk-dn-anim-midia');
  if (cc) cc.style.display = isCanvas ? '' : 'none';
  if (cm) cm.style.display = isMidia  ? '' : 'none';
  if (isMidia) {
    const labels = { gif:'URL do GIF', imagem:'URL da Imagem', iframe:'URL do iFrame' };
    const lbl = document.getElementById('ar-atk-dn-anim-url-label');
    const url = document.getElementById('ar-atk-dn-anim-url');
    const svg = document.getElementById('ar-atk-dn-anim-svg');
    if (lbl) lbl.textContent = labels[tipo] || 'URL';
    if (url) url.style.display = tipo !== 'svg' ? '' : 'none';
    if (svg) svg.style.display = tipo === 'svg' ? '' : 'none';
  }
}

function skAnimPreview() {
  const tipo = document.getElementById('sk-anim-tipo').value;
  const wrap = document.getElementById('sk-anim-preview-wrap');
  if (wrap) wrap.style.display = (tipo === 'nenhuma' || !['projetil','onda','explosao','raio','aura'].includes(tipo)) ? 'none' : 'block';
  if (!['projetil','onda','explosao','raio','aura'].includes(tipo)) return;
  skAnimPreviewPlay();
}

function skAnimPreviewPlay() {
  if (_skAnimPreviewRaf) cancelAnimationFrame(_skAnimPreviewRaf);
  const tipo   = document.getElementById('sk-anim-tipo').value;
  const cor    = document.getElementById('sk-anim-cor').value   || '#e74c3c';
  const icone  = document.getElementById('sk-anim-icone').value.trim();
  const trilha = document.getElementById('sk-anim-trilha').checked;
  const canvas = document.getElementById('sk-anim-preview-canvas');
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const rgb    = _animHexToRgb(cor);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const origem = { x: 20, y: 30 }, alvo = { x: 240, y: 30 };
  const dur = tipo==='aura'?800:tipo==='raio'?400:500;
  const start = performance.now();
  let lastRegen = 0, prevSegs = _animGerarZigzag(origem, alvo, 5);

  function drawFrame(now) {
    const t = Math.min((now - start) / dur, 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // tokens
    ctx.beginPath(); ctx.arc(origem.x,origem.y,10,0,Math.PI*2);
    ctx.fillStyle='rgba(79,163,209,0.5)'; ctx.fill();
    ctx.beginPath(); ctx.arc(alvo.x,alvo.y,10,0,Math.PI*2);
    ctx.fillStyle='rgba(232,80,60,0.5)'; ctx.fill();

    if (tipo==='projetil') {
      const cx2=(origem.x+alvo.x)/2, cy2=Math.min(origem.y,alvo.y)-20;
      const bx=(1-t)*(1-t)*origem.x+2*(1-t)*t*cx2+t*t*alvo.x;
      const by=(1-t)*(1-t)*origem.y+2*(1-t)*t*cy2+t*t*alvo.y;
      if (trilha) {
        for (let i=1;i<=6;i++) {
          const tt=Math.max(0,t-i*0.06);
          const tx=(1-tt)*(1-tt)*origem.x+2*(1-tt)*tt*cx2+tt*tt*alvo.x;
          const ty=(1-tt)*(1-tt)*origem.y+2*(1-tt)*tt*cy2+tt*tt*alvo.y;
          ctx.beginPath(); ctx.arc(tx,ty,3*(1-i/6),0,Math.PI*2);
          ctx.fillStyle=`rgba(${rgb},${(1-i/6)*0.35})`; ctx.fill();
        }
      }
      ctx.beginPath(); ctx.arc(bx,by,6,0,Math.PI*2); ctx.fillStyle=cor; ctx.fill();
      if (icone) { ctx.font='14px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(icone,bx,by); }

    } else if (tipo==='onda') {
      for (const off of [0,0.2,0.4]) {
        const lt=Math.max(0,Math.min((t-off)/(1-off),1));
        if(lt<=0) continue;
        ctx.beginPath(); ctx.arc(origem.x,origem.y,lt*45,0,Math.PI*2);
        ctx.strokeStyle=`rgba(${rgb},${(1-lt)*0.7})`; ctx.lineWidth=2; ctx.stroke();
      }

    } else if (tipo==='explosao') {
      const N=14;
      for(let i=0;i<N;i++){
        const ang=Math.PI*2*i/N;
        ctx.beginPath(); ctx.arc(alvo.x+Math.cos(ang)*t*30,alvo.y+Math.sin(ang)*t*30,3*(1-t),0,Math.PI*2);
        ctx.fillStyle=`rgba(${rgb},${1-t})`; ctx.fill();
      }
      if(t<0.3){ctx.beginPath();ctx.arc(alvo.x,alvo.y,t/0.3*18,0,Math.PI*2);ctx.fillStyle=`rgba(${rgb},${1-t/0.3*0.8})`;ctx.fill();}

    } else if (tipo==='raio') {
      if (now - lastRegen > 80) { prevSegs=_animGerarZigzag(origem,alvo,5); lastRegen=now; }
      const a=t<0.7?1:(1-t)/0.3;
      ctx.beginPath(); prevSegs.forEach((s,i)=>i===0?ctx.moveTo(s.x,s.y):ctx.lineTo(s.x,s.y));
      ctx.strokeStyle=`rgba(${rgb},${a*0.7})`; ctx.lineWidth=4; ctx.stroke();
      ctx.beginPath(); prevSegs.forEach((s,i)=>i===0?ctx.moveTo(s.x,s.y):ctx.lineTo(s.x,s.y));
      ctx.strokeStyle=`rgba(255,255,255,${a*0.8})`; ctx.lineWidth=1.5; ctx.stroke();

    } else if (tipo==='aura') {
      const pulse=Math.sin(t*Math.PI*4)*0.5+0.5;
      const r2=14+pulse*8, a=(t<0.8?1:(1-t)/0.2)*(0.4+pulse*0.4);
      const g2=ctx.createRadialGradient(alvo.x,alvo.y,0,alvo.x,alvo.y,r2);
      g2.addColorStop(0,`rgba(${rgb},${a})`); g2.addColorStop(1,`rgba(${rgb},0)`);
      ctx.beginPath(); ctx.arc(alvo.x,alvo.y,r2,0,Math.PI*2); ctx.fillStyle=g2; ctx.fill();
      if (icone) {
        ctx.font=`${12+pulse*4}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.globalAlpha=Math.min(1,a*2); ctx.fillText(icone,alvo.x,alvo.y); ctx.globalAlpha=1;
      }
    }

    if (t < 1) {
      _skAnimPreviewRaf = requestAnimationFrame(drawFrame);
    } else {
      setTimeout(skAnimPreviewPlay, 500);
    }
  }
  _skAnimPreviewRaf = requestAnimationFrame(drawFrame);
}

// ── Confirmar ataque (builder manual / AoE) ──────────────────
function atkConfirmarAtaque() {
  // Sempre via card do mapa — animação e dano só aplicados ao clicar no card
  // (mestre, jogador, com ou sem animação, catalogada ou criativa)
  COMBATE._pendingTrigger = true;
  fecharModalAtaque();
}

// Wrapper que aplica efeito + recuperação imediata de atributo
async function atkAplicarEfeitoComRecuperacao(nomeAlvo, ef, contexto) {
  if (!ef) return;
  // Recuperação imediata de atributo — aplica direto sem registrar buff de turno
  if (ef.rec_atributo && ef.rec_modo === 'imediato') {
    const emArena = contexto === 'arena';
    const chars = emArena ? (AR?.chars || []) : (RPG_DATA?.characters || []);
    const c = chars.find(x => x.nome === nomeAlvo);
    if (c) {
      const grupos = parsearFormulaDano(ef.rec_formula || '0');
      const r = grupos ? rolarGrupos(grupos) : { total: parseInt(ef.rec_formula)||0 };
      const val = r?.total || 0;
      if (!c.custom_attrs) c.custom_attrs = {};
      if (!c.custom_attrs.atributos) c.custom_attrs.atributos = {};
      const atual = parseFloat(c.custom_attrs.atributos[ef.rec_atributo]) || 0;
      c.custom_attrs.atributos[ef.rec_atributo] = atual + val;
      mostrarToast(`🔷 ${nomeAlvo}: ${ef.rec_atributo} +${val}`, 'sucesso');
      try {
        if (emArena) {
          await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(nomeAlvo)}`, { method:'PATCH', body:JSON.stringify({ custom_attrs: c.custom_attrs }) });
        } else {
          await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nomeAlvo)}`, { method:'PATCH', body:JSON.stringify({ custom_attrs: c.custom_attrs }) });
        }
      } catch(e) {}
    }
    return;
  }
  // Cura imediata como tipo especial
  if (ef.tipo === 'cura_imediata' && ef.valor) {
    await atkAplicarCura(nomeAlvo, ef.valor, contexto);
    return;
  }
  await atkAplicarEfeito(nomeAlvo, ef, contexto);
}

// ── Aplicar efeito bônus ao alvo ─────────────────────────────
async function atkAplicarEfeito(nomeAlvo, efeitoConfig, contexto) {
  if (!efeitoConfig) return;
  // Cura imediata — não cria buff; aplica diretamente e retorna
  if (efeitoConfig.tipo === 'cura_imediata' && efeitoConfig.valor) {
    await atkAplicarCura(nomeAlvo, efeitoConfig.valor, contexto);
    return;
  }
  const turnoAtual = contexto === 'arena' ? (AR.estado?.turno || 0) : 0;
  // AC-05-G2: HP temporário — aplica diretamente sem criar buff
  if (efeitoConfig.hp_temp) {
    const c = contexto === 'arena'
      ? AR.chars.find(x => x.nome === nomeAlvo)
      : RPG_DATA?.characters?.find(x => x.nome === nomeAlvo);
    if (c) {
      if (!c.custom_attrs) c.custom_attrs = {};
      c.custom_attrs.hp_temp = (parseInt(c.custom_attrs.hp_temp)||0) + efeitoConfig.hp_temp;
      const sbFn = contexto === 'arena' ? arSb : sb;
      const rpgId = contexto === 'arena' ? AR.session.rpg_id : RPG_DATA.rpgId;
      await sbFn(`characters?rpg_id=eq.${encodeURIComponent(rpgId)}&nome=eq.${encodeURIComponent(nomeAlvo)}`,
        { method: 'PATCH', body: JSON.stringify({ custom_attrs: c.custom_attrs }) });
      const logFn = contexto === 'arena' ? arLog : logCombate;
      if (logFn) logFn(`💙 ${nomeAlvo} ganhou ${efeitoConfig.hp_temp} HP temporário`);
    }
    return;
  }
  // AC-05-G2: Remover debuff
  if (efeitoConfig.remover_debuff) {
    const c = contexto === 'arena'
      ? AR.chars.find(x => x.nome === nomeAlvo)
      : RPG_DATA?.characters?.find(x => x.nome === nomeAlvo);
    if (c && Array.isArray(c.buffs)) {
      const idx = c.buffs.findIndex(b => b.tipo === 'debuff');
      if (idx >= 0) {
        const removido = c.buffs[idx];
        c.buffs.splice(idx, 1);
        const sbFn = contexto === 'arena' ? arSb : sb;
        const rpgId = contexto === 'arena' ? AR.session.rpg_id : RPG_DATA.rpgId;
        await sbFn(`characters?rpg_id=eq.${encodeURIComponent(rpgId)}&nome=eq.${encodeURIComponent(nomeAlvo)}`,
          { method: 'PATCH', body: JSON.stringify({ buffs: c.buffs }) });
        const logFn = contexto === 'arena' ? arLog : logCombate;
        if (logFn) logFn(`🧹 ${nomeAlvo} teve debuff "${removido.nome||'?'}" removido`);
      }
    }
    return;
  }
  // Determinar se é buff ou debuff
  const ehPositivo = !!(efeitoConfig.hot_formula || efeitoConfig.boost_dano
    || efeitoConfig.boost_defesa || efeitoConfig.hp_temp
    || efeitoConfig.rec_atributo || efeitoConfig.tipo === 'cura_imediata'
    || efeitoConfig.tipo === 'buff');
  const buff = {
    id:           'ef_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    nome:         efeitoConfig.nome || 'Efeito',
    tipo:         ehPositivo ? 'buff' : 'debuff',
    turno_inicio: turnoAtual,
    // ── Negativos ──────────────────────────────────────────
    dot_formula:              efeitoConfig.dot_formula || null,
    dot_turnos_restantes:     efeitoConfig.dot_turnos || (efeitoConfig.dot_formula ? (efeitoConfig.turnos || 0) : 0),
    sem_movimento:            !!efeitoConfig.sem_movimento,
    sem_movimento_turnos_restantes: efeitoConfig.sem_movimento_turnos || (efeitoConfig.sem_movimento ? (efeitoConfig.turnos || 0) : 0),
    sem_ataque:               !!efeitoConfig.sem_ataque,
    sem_ataque_tipo:          efeitoConfig.sem_ataque_tipo || 'todos',
    sem_ataque_turnos_restantes: efeitoConfig.sem_ataque_turnos || (efeitoConfig.sem_ataque ? (efeitoConfig.turnos || 0) : 0),
    mod_dano:                 efeitoConfig.mod_dano ?? 0,
    mod_dano_turnos_restantes: efeitoConfig.mod_dano_turnos || ((efeitoConfig.mod_dano ?? 0) !== 0 ? (efeitoConfig.turnos || 0) : 0),
    mod_defesa:               efeitoConfig.mod_defesa || efeitoConfig.boost_defesa || 0, // AC-05-G2: boost_defesa mapeado
    mod_defesa_turnos_restantes: efeitoConfig.mod_defesa_turnos || efeitoConfig.boost_defesa_turnos || ((efeitoConfig.mod_defesa || efeitoConfig.boost_defesa) ? (efeitoConfig.turnos || 0) : 0),
    // ── Positivos ──────────────────────────────────────────
    hot_formula:              efeitoConfig.hot_formula || null,
    hot_turnos_restantes:     efeitoConfig.hot_turnos  || 0,
    boost_dano:               efeitoConfig.boost_dano || 0,
    boost_dano_turnos_restantes: efeitoConfig.boost_dano_turnos || ((efeitoConfig.boost_dano ?? 0) !== 0 ? (efeitoConfig.turnos || 0) : 0),
    rec_atributo:             efeitoConfig.rec_atributo || null,
    rec_formula:              efeitoConfig.rec_formula || null,
    rec_modo:                 efeitoConfig.rec_modo || 'imediato',
    rec_turnos_restantes:     efeitoConfig.rec_modo === 'turno' ? (efeitoConfig.rec_turnos || efeitoConfig.turnos || 0) : 0,
    // ── Campo de compatibilidade: maior duração entre todos os efeitos ativos ──
    turnos_restantes: Math.max(
      efeitoConfig.dot_turnos || 0,
      efeitoConfig.sem_movimento_turnos || 0,
      efeitoConfig.sem_ataque_turnos || 0,
      efeitoConfig.mod_dano_turnos || 0,
      efeitoConfig.hot_turnos || 0,
      efeitoConfig.boost_dano_turnos || 0,
      efeitoConfig.boost_defesa_turnos || 0, // AC-05-G2
      (efeitoConfig.rec_modo === 'turno' ? efeitoConfig.rec_turnos : 0) || 0,
      efeitoConfig.mod_defesa_turnos || 0,
      efeitoConfig.turnos || 0,
    ),  // 0 = efeito imediato sem duração de turno (não cria buff fantasma)
    auto_aplicado: true,
  };

  // Não adicionar buff "fantasma" com duração zero (efeito imediato, sem persistência)
  if (buff.turnos_restantes <= 0) return;

  if (contexto === 'arena') {
    const c = AR.chars.find(x => x.nome === nomeAlvo);
    if (!c) return;
    if (!Array.isArray(c.buffs)) c.buffs = [];
    c.buffs.push(buff);
    await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(nomeAlvo)}`,
      { method: 'PATCH', body: JSON.stringify({ buffs: c.buffs, custom_attrs: c.custom_attrs }) });
  } else {
    const c = RPG_DATA?.characters.find(x => x.nome === nomeAlvo);
    if (!c) return;
    if (!Array.isArray(c.buffs)) c.buffs = [];
    c.buffs.push(buff);
    await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nomeAlvo)}`,
      { method: 'PATCH', body: JSON.stringify({ buffs: c.buffs }) });
  }
}

// ═══════════════════════════════════════════════════════════════
// MECÂNICA DE ÁREA LIVRE (alvo_tipo:'area') — AoE posicionável
// ═══════════════════════════════════════════════════════════════

let _AOE_STATE = null; // { centroX, centroY, raioCell, dragging, dragOffX, dragOffY }

function atkIniciarModoArea(h) {
  const raio = h.alcance_celulas ?? 2;

  // Mostrar instrução e botão confirmar no step 2, ocultar lista de alvos
  document.getElementById('atk-alvos-lista').style.display = 'none';
  document.getElementById('atk-aoe-instrucao').style.display = 'block';
  document.getElementById('atk-aoe-confirmar-btn').style.display = 'block';

  // Posição inicial = posição do atacante no mapa
  const mapId = MAPA_STATE?.mapaAtualId || null;
  const atacChar = (RPG_DATA?.characters||[]).find(c => c.nome === COMBATE.atacanteNome);
  const pos = mapId && atacChar ? getPosicaoNoMapa(atacChar, mapId) : null;
  const cx = pos?.x ?? 50;
  const cy = pos?.y ?? 50;

  _AOE_STATE = { centroX: cx, centroY: cy, raioCell: raio, dragging: false };

  // Criar / atualizar o círculo AoE no mapa
  _aoeRenderCircle(cx, cy, raio);

  // Atualizar preview de alvos
  _aoeAtualizarAlvos();

  atkIrParaStep(2);
}

function _aoeRenderCircle(cx, cy, raioCell) {
  const tokensEl = document.getElementById('mapa-tokens');
  if (!tokensEl) return;

  let el = document.getElementById('atk-aoe-circle');
  if (!el) {
    el = document.createElement('div');
    el.id = 'atk-aoe-circle';
    el.style.cssText = `position:absolute;border-radius:50%;cursor:grab;z-index:8;box-sizing:border-box;pointer-events:all`;
    el.addEventListener('pointerdown', _aoeStartDrag);
    tokensEl.appendChild(el);
  }

  const entry = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === MAPA_STATE?.mapaAtualId);
  const gridPx = entry?.mapa?.grid || 20;
  const raiopx = raioCell * gridPx;

  el.style.left   = cx + '%';
  el.style.top    = cy + '%';
  el.style.width  = (raiopx * 2) + 'px';
  el.style.height = (raiopx * 2) + 'px';
  el.style.transform = 'translate(-50%,-50%)';
  el.style.background = 'rgba(232,80,60,0.12)';
  el.style.border = '3px solid rgba(232,80,60,0.85)';
  el.style.boxShadow = '0 0 0 1px rgba(232,80,60,0.3), 0 0 24px rgba(232,80,60,0.4), inset 0 0 20px rgba(232,80,60,0.1)';
  el.style.display = 'block';
  el.innerHTML = `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:0.65rem;font-family:'Cinzel',serif;color:rgba(232,80,60,0.8);pointer-events:none;white-space:nowrap">💥 Área</div>`;
}

function mapaHideAoECircle() {
  const el = document.getElementById('atk-aoe-circle');
  if (el) el.style.display = 'none';
  _aoeRemoverBadges();
  _AOE_STATE = null;
  // Restaurar lista de alvos normal
  const listaEl = document.getElementById('atk-alvos-lista');
  if (listaEl) listaEl.style.display = '';
  const instrEl = document.getElementById('atk-aoe-instrucao');
  if (instrEl) instrEl.style.display = 'none';
  const btnEl = document.getElementById('atk-aoe-confirmar-btn');
  if (btnEl) btnEl.style.display = 'none';
}

function _aoeStartDrag(e) {
  if (!_AOE_STATE) return;
  e.preventDefault();
  e.stopPropagation();
  _AOE_STATE.dragging = true;
  const el = document.getElementById('atk-aoe-circle');
  if (el) { el.style.cursor = 'grabbing'; el.setPointerCapture(e.pointerId); }
  el.addEventListener('pointermove', _aoeDrag);
  el.addEventListener('pointerup', _aoeEndDrag);
}

function _aoeDrag(e) {
  if (!_AOE_STATE?.dragging) return;
  const wrap = document.getElementById('mapa-wrap');
  const bg   = document.getElementById('mapa-img');
  if (!wrap || !bg) return;
  const zoom  = MAPA_ZOOM?.zoom  || 1;
  const panX  = MAPA_ZOOM?.panX  || 0;
  const panY  = MAPA_ZOOM?.panY  || 0;
  const wRect = wrap.getBoundingClientRect();
  const lx = (e.clientX - wRect.left - panX) / zoom;
  const ly = (e.clientY - wRect.top  - panY) / zoom;
  const W  = bg.offsetWidth  || wRect.width;
  const H  = bg.offsetHeight || wRect.height;
  const cx = Math.max(2, Math.min(98, lx / W * 100));
  const cy = Math.max(2, Math.min(98, ly / H * 100));
  _AOE_STATE.centroX = cx;
  _AOE_STATE.centroY = cy;
  const el = document.getElementById('atk-aoe-circle');
  if (el) { el.style.left = cx + '%'; el.style.top = cy + '%'; }
  _aoeAtualizarAlvos();
}

function _aoeEndDrag(e) {
  if (!_AOE_STATE) return;
  _AOE_STATE.dragging = false;
  const el = document.getElementById('atk-aoe-circle');
  if (el) { el.style.cursor = 'grab'; el.removeEventListener('pointermove', _aoeDrag); el.removeEventListener('pointerup', _aoeEndDrag); }
}

function _aoeRemoverBadges() {
  document.querySelectorAll('.aoe-warning-badge').forEach(b => b.remove());
}

function _aoeAtualizarAlvos() {
  if (!_AOE_STATE) return;
  const { centroX, centroY, raioCell } = _AOE_STATE;
  const mapId  = MAPA_STATE?.mapaAtualId;
  const chars  = RPG_DATA?.characters || [];
  const entry  = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === mapId);
  const gridPx = entry?.mapa?.grid || 20;
  const imgEl  = document.getElementById('mapa-img');
  const W = imgEl?.offsetWidth  || 1;
  const H = imgEl?.offsetHeight || 1;
  const raiopx = raioCell * gridPx;
  const ffAtivo = CURRENT_RPG?.theme?.fogo_amigo_ativo === true;

  _aoeRemoverBadges();
  const tokensEl = document.getElementById('mapa-tokens');
  const dentroArea = [];

  chars.forEach(c => {
    const pos = getPosicaoNoMapa(c, mapId);
    if (!pos) return;
    const dx = (pos.x - centroX) / 100 * W;
    const dy = (pos.y - centroY) / 100 * H;
    const distPx = Math.sqrt(dx*dx + dy*dy);
    if (distPx > raiopx) return; // fora do raio

    const faction = c.custom_attrs?.npc_faction || (c.custom_attrs?.tipo === 'jogador' ? 'jogador' : 'inimigo');
    const ehFogoAmigo = (faction === 'aliado' || faction === 'jogador');

    // Se FF desligado, pular aliados e jogadores
    if (!ffAtivo && ehFogoAmigo) return;

    dentroArea.push({ nome: c.nome, faction, ehFogoAmigo });

    // Badge flutuante sobre o token
    if (tokensEl) {
      const tokenEl = tokensEl.querySelector(`.mapa-token[data-nome="${CSS.escape(c.nome)}"]`);
      if (tokenEl) {
        const badge = document.createElement('div');
        badge.className = 'aoe-warning-badge';
        badge.className += ehFogoAmigo ? ' aoe-warning-ff' : ' aoe-warning-atk';
        badge.textContent = ehFogoAmigo ? '⚠️ FOGO AMIGO' : '💥';
        tokenEl.appendChild(badge);
      }
    }
  });

  // Atualizar preview no painel
  const prevEl = document.getElementById('atk-aoe-alvos-preview');
  if (prevEl) {
    if (dentroArea.length === 0) {
      prevEl.textContent = 'Nenhum personagem na área.';
    } else {
      const ff  = dentroArea.filter(x => x.ehFogoAmigo);
      const atk = dentroArea.filter(x => !x.ehFogoAmigo);
      prevEl.innerHTML = (atk.length ? `⚔ ${atk.map(x=>x.nome).join(', ')}` : '') +
        (ff.length ? `${atk.length?'<br>':''}⚠️ <span style="color:#f0cc6a">Fogo amigo: ${ff.map(x=>x.nome).join(', ')}</span>` : '');
    }
  }

  // Armazenar lista de alvos para confirmação
  _AOE_STATE.alvosAtual = dentroArea;
}

function atkConfirmarAoE() {
  if (!_AOE_STATE) return;
  const alvos = (_AOE_STATE.alvosAtual || []).map(a => a.nome);
  mapaHideAoECircle();
  if (!alvos.length) { mostrarToast('Nenhum personagem na área', 'erro'); return; }
  COMBATE._alvosAoE = alvos;
  atkPrepararStep3();
  atkIrParaStep(3);
}

// Animação aoeWarn definida em css/styles.css


async function _atkInvocarPersonagem(skill, invocadorNome, contexto, critico) {
  // Detectar config de invocação: campo direto (novo) ou via efeitos_bonus legacy
  let nomeInvocado = skill.invocar_nome;
  let duracao      = skill.invocar_duracao_turnos ?? 0;

  if (!nomeInvocado) {
    const ef = (Array.isArray(skill.efeitos_bonus) ? skill.efeitos_bonus : [])
               .find(e => e.tipo === 'invocacao');
    if (!ef) return;
    nomeInvocado = ef.invocar_nome;
    duracao      = ef.invocar_duracao_turnos ?? 0;
  }
  if (!nomeInvocado) return;

  // Template do personagem a invocar
  const chars = contexto === 'arena' ? AR.chars : (RPG_DATA?.characters || []);
  const template = (RPG_DATA?.characters || []).find(x => x.nome === nomeInvocado);
  if (!template) {
    mostrarToast(`Personagem "${nomeInvocado}" não encontrado nos dados do RPG`, 'erro');
    return;
  }

  const hpBase = template.custom_attrs?.hp_max ?? template.hp_max ?? 50;
  const turnoAtual = contexto === 'arena' ? (AR.estado?.turno || 0) : 0;

  // Ajustes por crítico
  let hp = hpBase;
  let turnoExpira = duracao > 0 ? turnoAtual + duracao : null;
  if (critico === 'positivo') hp = hpBase * 2;
  if (critico === 'negativo') turnoExpira = turnoAtual + 1; // colapsa em 1 turno

  if (contexto === 'arena') {
    // Impedir dupla invocação do mesmo personagem pelo mesmo dono
    const jaExiste = AR.chars.find(x =>
      x.nome === nomeInvocado &&
      x.custom_attrs?.invocado &&
      x.custom_attrs?.pet_dono === invocadorNome
    );
    if (jaExiste) {
      arToast(`${nomeInvocado} já está em campo!`, 'erro');
      return;
    }

    const ca = {
      ...(template.custom_attrs || {}),
      eh_pet:        true,
      pet_dono:      invocadorNome,
      invocado:      true,
      turno_invocado: turnoAtual,
      turno_expira:  turnoExpira,
      hp_max:        hp,
      pos: { x: 20 + Math.random() * 60, y: 20 + Math.random() * 60 },
    };

    try {
      const novo = await arSb('characters', { method: 'POST', body: JSON.stringify({
        rpg_id:      AR.session.rpg_id,
        nome:        nomeInvocado,
        hp_atual:    hp,
        hp_max:      hp,
        nivel:       template.nivel || 1,
        xp: 0, pontos_attr: 0,
        custom_attrs: ca,
      })});
      const charObj = Array.isArray(novo) ? novo[0] : novo;
      if (charObj) { charObj.custom_attrs = ca; AR.chars.push(charObj); }
      const durLabel = turnoExpira != null ? ` · expira T${turnoExpira}` : ' · até fim do combate';
      arAddLog(`✨ ${invocadorNome} invocou ${nomeInvocado}! (HP: ${hp}${durLabel})`);
      await arSalvarEstado();
      renderArenaPersonagens(); renderArenaEntidades(); renderMesa();
      arToast(`${nomeInvocado} invocado!${critico === 'positivo' ? ' (HP duplo!)' : critico === 'negativo' ? ' (colapsa em 1 turno!)' : ''}`, 'sucesso');
    } catch(e) { arToast('Erro ao invocar personagem', 'erro'); }
  } else {
    // Campanha: ativa o personagem existente como pet temporário
    const c = RPG_DATA?.characters.find(x => x.nome === nomeInvocado);
    if (c) {
      c.hp_atual = hp;
      if (!c.custom_attrs) c.custom_attrs = {};
      c.custom_attrs.eh_pet       = true;
      c.custom_attrs.pet_dono     = invocadorNome;
      c.custom_attrs.invocado     = true;
      c.custom_attrs.turno_expira = turnoExpira;
      c.custom_attrs.hp_max       = hp;
      await saveCharacterStats(RPG_DATA.rpgId, nomeInvocado, {
        hp_atual:     hp,
        custom_attrs: c.custom_attrs,
      });
      mostrarToast(`${nomeInvocado} invocado! (HP: ${hp}${duracao > 0 ? `, ${duracao} turnos` : ''})`, 'sucesso');
      renderCharView(nomeInvocado);
    }
  }
}

// Verifica se uma skill é de invocação
function _skEhInvocacao(h) {
  if (h.tipo_dano === 'invocacao') return true;
  if (h.invocar_nome) return true;
  return (Array.isArray(h.efeitos_bonus) ? h.efeitos_bonus : []).some(e => e.tipo === 'invocacao');
}


// Retorna o dano já reduzido (ceil em cada etapa)
function calcularDanoFinal(danoBruto, tipoDano, char, attrDefs, atacanteChar) {
  if (!danoBruto || danoBruto <= 0) return 0;
  const atribs = char?.custom_attrs?.atributos || {};
  const resistDefs = (attrDefs || []).filter(a => a.categoria === 'resistencia');
  
  let danoAtual = danoBruto;

  // 0b. Aplicar mod_dano de debuffs do ALVO (ex: fraqueza, maldição)
  // NOTA: boost_dano do atacante já é somado na fórmula em atkPrepararStep3 (boostAtacante).
  // Não somar aqui para evitar contagem dupla.
  {
    const buffsAlvo = char?.buffs || [];
    let modTotal = 0;
    for (const b of buffsAlvo) {
      if ((b.mod_dano ?? 0) !== 0 && (b.mod_dano_turnos_restantes ?? 0) > 0) {
        modTotal += b.mod_dano;
      }
    }
    if (modTotal !== 0) {
      danoAtual = Math.max(0, danoAtual + modTotal); // mod_dano negativo = redução
    }
  }

  // 0c. Aplicar mod_defesa de buffs positivos do ALVO (ex: Escudo Mágico, Armadura Temporária)
  {
    const buffsAlvo = char?.buffs || [];
    for (const b of buffsAlvo) {
      if ((b.mod_defesa ?? 0) > 0 && (b.mod_defesa_turnos_restantes ?? 0) > 0) {
        danoAtual = Math.max(0, danoAtual - b.mod_defesa);
      }
    }
  }

  // 1. Processar armaduras (reduzem todo dano + bônus para físico)
  for (const def of resistDefs) {
    let cfg = {};
    try { cfg = JSON.parse(def.opcoes || '{}'); } catch(e) { continue; }
    if (cfg.tipo !== 'armadura') continue;
    const valorArmadura = parseFloat(atribs[def.nome]) || 0;
    if (!valorArmadura) continue;

    // Redução geral (% do valor da armadura aplicada a todo dano)
    if (cfg.pct_geral) {
      const reducaoGeral = Math.ceil(valorArmadura * cfg.pct_geral / 100);
      danoAtual = Math.max(0, danoAtual - reducaoGeral);
    }
    // Redução adicional para dano físico
    if (cfg.pct_fisico && tipoDano === 'fisico') {
      const reducaoFisica = Math.ceil(valorArmadura * cfg.pct_fisico / 100);
      danoAtual = Math.max(0, danoAtual - reducaoFisica);
    }
    // Redução adicional para dano mágico
    if (cfg.pct_magico && tipoDano === 'magico') {
      const reducaoMagica = Math.ceil(valorArmadura * cfg.pct_magico / 100);
      danoAtual = Math.max(0, danoAtual - reducaoMagica);
    }
  }

  // 2. Processar resistências elementais/por tipo
  for (const def of resistDefs) {
    let cfg = {};
    try { cfg = JSON.parse(def.opcoes || '{}'); } catch(e) { continue; }
    if (cfg.tipo !== 'resistencia') continue;
    // Verificar se este tipo de resistência se aplica ao dano
    const dmgTypes = Array.isArray(cfg.damage_type) ? cfg.damage_type : [cfg.damage_type];
    if (!dmgTypes.includes(tipoDano)) continue;
    const valorRes = parseFloat(atribs[def.nome]) || 0;
    if (!valorRes) continue;

    if (cfg.modo === 'absoluto') {
      // Redução flat
      danoAtual = Math.max(0, danoAtual - valorRes);
    } else {
      // Percentual (default): valor do atributo usado diretamente como %
      const reducao = Math.ceil(danoAtual * valorRes / 100);
      danoAtual = Math.max(0, danoAtual - reducao);
    }
  }

  return Math.ceil(danoAtual);
}

// ── Obtém attrDefs do contexto correto ──────────────────────────
function getAttrDefsParaDano(contexto) {
  if (contexto === 'arena') return AR.attrDefs || RPG_DATA?.attrDefs || [];
  return RPG_DATA?.attrDefs || [];
}

async function atkAplicarDano(nomeAlvo, dano, contexto, tipoDano) {
  const attrDefs = getAttrDefsParaDano(contexto);
  const atacanteNome = COMBATE.atacanteNome;
  if (contexto === 'arena') {
    const c = AR.chars.find(x => x.nome === nomeAlvo);
    if (!c) return;
    const atacanteChar = atacanteNome ? AR.chars.find(x => x.nome === atacanteNome) : null;
    const danoFinal = calcularDanoFinal(dano, tipoDano || 'fisico', c, attrDefs, atacanteChar);
    const hpMax = c.custom_attrs?.hp_max ?? 100;
    const novoHp = Math.max(0, (c.hp_atual ?? hpMax) - danoFinal);
    if (danoFinal !== dano) arLog(`🛡 ${nomeAlvo} — ${dano} de dano bruto → ${danoFinal} após buffs/resistências`);
    c.hp_atual = novoHp;
    await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(nomeAlvo)}`,
      { method: 'PATCH', body: JSON.stringify({ hp_atual: novoHp }) });
  } else {
    const c = RPG_DATA?.characters.find(x => x.nome === nomeAlvo);
    if (!c) return;
    const atacanteChar2 = atacanteNome ? RPG_DATA?.characters?.find(x => x.nome === atacanteNome) : null;
    const danoFinal = calcularDanoFinal(dano, tipoDano || 'fisico', c, attrDefs, atacanteChar2);
    if (danoFinal !== dano) mostrarToast(`🛡 ${nomeAlvo}: ${dano} → ${danoFinal} (buffs/resistências)`, '');
    const hpAtualReal = c.hp_atual ?? (c.custom_attrs?.hp_max ?? 100);
    const novoHp = Math.max(0, hpAtualReal - danoFinal);
    c.hp_atual = novoHp;

    // ── Registrar stats de batalha ────────────────────────────────────────
    if (BATALHA_ATUAL_ID && MAPA_STATE.batalhas[BATALHA_ATUAL_ID]) {
      const _bsStats = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
      if (!_bsStats.stats) _bsStats.stats = { dano: {}, habilidades: {}, danoRecebido: {} };
      const st = _bsStats.stats;
      // Dano causado por atacante
      if (atacanteNome) {
        if (!st.dano[atacanteNome]) st.dano[atacanteNome] = 0;
        st.dano[atacanteNome] += danoFinal;
      }
      // Dano recebido por alvo
      const tipoAlvo = (bs => bs?.participantes?.find(p => p.nome === nomeAlvo)?.tipo)(_bsStats);
      if (tipoAlvo === 'npc' || tipoAlvo === 'inimigo') {
        if (!st.danoRecebidoNpc) st.danoRecebidoNpc = {};
        if (!st.danoRecebidoNpc[nomeAlvo]) st.danoRecebidoNpc[nomeAlvo] = 0;
        st.danoRecebidoNpc[nomeAlvo] += danoFinal;
      } else {
        if (!st.danoRecebido[nomeAlvo]) st.danoRecebido[nomeAlvo] = 0;
        st.danoRecebido[nomeAlvo] += danoFinal;
      }
      // Rastrear maior dano único
      if (!st.maiorDano || danoFinal > st.maiorDano.valor) {
        const skNome = COMBATE?.habilidadeSel?.nome || null;
        st.maiorDano = { valor: danoFinal, atacante: atacanteNome, habilidade: skNome, alvo: nomeAlvo };
      }
      // Rastrear habilidades usadas
      const _skNome = COMBATE?.habilidadeSel?.nome;
      if (_skNome) {
        if (!st.habilidades[_skNome]) st.habilidades[_skNome] = 0;
        st.habilidades[_skNome]++;
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    await saveCharacterStats(RPG_DATA.rpgId, nomeAlvo, { hp_atual: novoHp });
    renderCharView(nomeAlvo); renderAttrView(nomeAlvo); mapaRenderStatus();
    if (novoHp <= 0) {
      // Marcar como morto e re-renderizar tokens (broadcast via DB realttime)
      c.custom_attrs = c.custom_attrs || {};
      c.custom_attrs.morto = true;
      try {
        await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nomeAlvo)}`,
          { method:'PATCH', body: JSON.stringify({ custom_attrs: c.custom_attrs }) });
      } catch(e) {}
      // Broadcast morte para todos os clientes
      combateBroadcast('personagem_morto', { nome: nomeAlvo });
      // I9: verificar drop automático se for NPC com tier
      const cMorto = RPG_DATA.characters.find(x=>x.nome===nomeAlvo);
      if(cMorto&&(cMorto.custom_attrs?.tipo==='inimigo'||cMorto.custom_attrs?.tipo==='npc')&&cMorto.custom_attrs?.tier){
        _executarDropNPC(RPG_DATA.rpgId, nomeAlvo, cMorto).catch(()=>{});
      }
      const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
      if (entry) mapaRenderTokens(entry.mapa);
      mostrarToast(`💀 ${nomeAlvo} foi derrotado!`, 'erro');

      // ── Verificar vitória após morte ──────────────────────────────────────
      _verificarVitoriaBatalha();
      // ─────────────────────────────────────────────────────────────────────
    }
  }
}

// ── 18F: Ataques criativos ───────────────────────────────────
async function atkEnviarAtaqueCriativo() {
  const { atacanteNome, alvoNome, habilidadeSel: h, contexto } = COMBATE;
  const id = 'ap_' + Date.now();
  const pendente = {
    id,
    atacante:  atacanteNome,
    alvo:      alvoNome,
    descricao: h.descricao,
    criativo_tipo: h.criativo_tipo || 'ataque',
    criativo_alvo_tipo: h.criativo_alvo_tipo || 'unico',
    turno:     contexto === 'arena' ? (AR.estado?.turno || 0) : 0,
    status:    'pendente',
  };

  if (contexto === 'arena') {
    // Arena também usa a tabela criativos (mesma que campanha) para realtime funcionar
    CRIATIVOS_CAMP.push(pendente);
    CRIATIVO_ID_ATUAL = id;
    // Inserir usando arSb para garantir o rpg_id correto da arena
    try {
      await arSb('criativos', {method:'POST', body:JSON.stringify({
        rpg_id:   AR.session.rpg_id,
        id:       pendente.id,
        atacante: pendente.atacante,
        alvo:     pendente.alvo,
        descricao:pendente.descricao,
        criativo_tipo: pendente.criativo_tipo,
        criativo_alvo_tipo: pendente.criativo_alvo_tipo,
        turno:    pendente.turno || 0,
        status:   'pendente',
      })});
    } catch(e) {}
    // Se o mestre está jogando como personagem, abre aprovação direto
    if (AR.myRole === 'mestre') {
      fecharModalAtaque();
      mostrarToast('Defina a fórmula da ação criativa', '');
      abrirModalCriativoMestre(id);
      return;
    }
    const divAguardando = document.getElementById('atk-pendente-aguardando');
    const divAprovado   = document.getElementById('atk-pendente-aprovado');
    const divRejeitado  = document.getElementById('atk-pendente-rejeitado');
    if (divAguardando) divAguardando.style.display = '';
    if (divAprovado)   divAprovado.style.display   = 'none';
    if (divRejeitado)  divRejeitado.style.display  = 'none';
    criativoIniciarPolling(id);
  } else {
    // Campanha: salvar na tabela criativos
    CRIATIVOS_CAMP.push(pendente);
    CRIATIVO_ID_ATUAL = id;
    await criativoInserir(pendente);

    // Mestre controlando o personagem: abrir modal de aprovação diretamente
    if (RPG_DATA?.myRole === 'mestre') {
      fecharModalAtaque();
      mostrarToast('Defina a fórmula da ação criativa', '');
      abrirModalCriativoMestre(id);
      return;
    }

    // Resetar sub-estados do step-pendente
    const divAguardando = document.getElementById('atk-pendente-aguardando');
    const divAprovado   = document.getElementById('atk-pendente-aprovado');
    const divRejeitado  = document.getElementById('atk-pendente-rejeitado');
    if (divAguardando) divAguardando.style.display = '';
    if (divAprovado)   divAprovado.style.display   = 'none';
    if (divRejeitado)  divRejeitado.style.display  = 'none';
    criativoIniciarPolling(id); // fallback: polling caso o realtime nao chegue
  }

  atkIrParaStep('pendente');
  mostrarToast('Ação criativa enviada ao Mestre', '');
}

// ── Solicitar aprovação do mestre para skill ofensiva fora de combate ─
async function atkEnviarSolicitacaoSkill() {
  const { atacanteNome, alvoNome, habilidadeSel: h, contexto } = COMBATE;
  const id = 'sk_' + Date.now();
  // Codificar info da skill no campo descricao com marcador especial
  const skillJson = JSON.stringify({
    nome: h.nome,
    formula: h.formula_dano || null,
    atributo: h.atributo_base || null,
    mod_pct: h.mod_atributo_pct || null,
  });
  const descricao = `[SKILL:${skillJson}] ${h.efeito || h.nome}`;
  const pendente = {
    id,
    tipo: 'skill_request',
    skill_nome: h.nome,
    skill_formula: h.formula_dano || null,
    skill_atributo: h.atributo_base || null,
    skill_mod_pct: h.mod_atributo_pct || null,
    atacante: atacanteNome,
    alvo: alvoNome,
    descricao,
    turno: 0,
    status: 'pendente',
  };

  CRIATIVOS_CAMP.push(pendente);
  CRIATIVO_ID_ATUAL = id;
  await criativoInserir(pendente);

  // Mestre controlando o personagem: abrir modal de aprovação diretamente
  if (RPG_DATA?.myRole === 'mestre') {
    fecharModalAtaque();
    mostrarToast(`Defina a fórmula para "${h.nome}"`, '');
    abrirModalCriativoMestre(id);
    return;
  }

  const divAguardando = document.getElementById('atk-pendente-aguardando');
  const divAprovado   = document.getElementById('atk-pendente-aprovado');
  const divRejeitado  = document.getElementById('atk-pendente-rejeitado');
  if (divAguardando) {
    divAguardando.style.display = '';
    divAguardando.querySelector
      && (divAguardando.querySelector('div:nth-child(2)') || divAguardando.lastElementChild || {}).textContent
      && (divAguardando.lastElementChild.textContent = `Mestre irá revisar o uso de "${h.nome}" em ${alvoNome}.`);
  }
  if (divAprovado)   divAprovado.style.display   = 'none';
  if (divRejeitado)  divRejeitado.style.display  = 'none';

  criativoIniciarPolling(id); // fallback: polling caso o realtime nao chegue
  atkIrParaStep('pendente');
  mostrarToast(`"${h.nome}" enviada ao Mestre para aprovação`, '');
}

function renderAtaquesPendentes() {
  const pendentes = (AR.estado.ataques_pendentes || []).filter(a => a.status === 'pendente');
  const el = document.getElementById('ar-ataques-pendentes');
  if (!el) return;
  el.style.display = pendentes.length && RPG_DATA?.myRole === 'mestre' ? 'block' : 'none';
  if (!pendentes.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div style="font-family:'Cinzel',serif;font-size:0.65rem;color:rgba(200,168,75,0.7);text-transform:uppercase;margin-bottom:8px">⚔ Ações Criativas Pendentes</div>
    ${pendentes.map(a => `
      <div style="background:rgba(200,168,75,0.05);border:1px solid rgba(200,168,75,0.2);border-radius:8px;padding:12px;margin-bottom:8px">
        <div style="font-family:'Cinzel',serif;font-size:0.8rem;color:var(--destaque);margin-bottom:4px">${a.atacante} → ${a.alvo}</div>
        <div style="font-size:0.85rem;color:#b8a8a8;margin-bottom:10px;line-height:1.5">${a.descricao}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:6px;flex:1">
            <input type="number" id="dano-ap-${a.id}" value="1" min="1"
              style="width:52px;padding:5px;background:rgba(8,4,4,0.9);border:1px solid rgba(60,30,30,0.6);border-radius:4px;color:#c8d8e8;font-family:'Cinzel',serif;font-size:0.75rem;text-align:center">
            <select id="dado-ap-${a.id}" style="padding:5px;background:rgba(8,4,4,0.9);border:1px solid rgba(60,30,30,0.6);border-radius:4px;color:#c8d8e8;font-family:'Cinzel',serif;font-size:0.75rem">
              ${[4,6,8,10,12,20].map(d=>`<option value="${d}">d${d}</option>`).join('')}
            </select>
            <button onclick="atkRolarParaPendente('${a.id}')"
              style="padding:5px 10px;background:rgba(232,80,60,0.1);border:1px solid rgba(232,80,60,0.3);border-radius:4px;color:#e8604c;font-family:'Cinzel',serif;font-size:0.7rem;cursor:pointer">🎲</button>
            <span id="resultado-ap-${a.id}" style="font-family:'Cinzel',serif;font-size:1.1rem;color:#f0cc6a;min-width:24px;text-align:center">—</span>
          </div>
          <div style="display:flex;gap:6px">
            <button onclick="atkMestreAprovar('${a.id}')"
              style="padding:5px 10px;background:rgba(39,174,96,0.1);border:1px solid rgba(39,174,96,0.3);border-radius:4px;color:#5ee09a;font-family:'Cinzel',serif;font-size:0.7rem;cursor:pointer">✓ Aprovar</button>
            <button onclick="atkMestreRejeitar('${a.id}')"
              style="padding:5px 10px;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.3);border-radius:4px;color:#e74c3c;font-family:'Cinzel',serif;font-size:0.7rem;cursor:pointer">✕ Rejeitar</button>
          </div>
        </div>
      </div>
    `).join('')}
  `;
}

function atkRolarParaPendente(apId) {
  const qtd   = parseInt(document.getElementById('dano-ap-'  + apId)?.value  || '1');
  const faces = parseInt(document.getElementById('dado-ap-'  + apId)?.value  || '6');
  const result = rolarFormula({ qtd, faces, bonus: 0, tipo: 'dado' });
  const el = document.getElementById('resultado-ap-' + apId);
  if (el) {
    el.textContent = result.total;
    el.dataset.total = result.total;
    el.title = `Dados: [${result.rolls.join(', ')}]`;
  }
}

async function atkMestreAprovar(apId) {
  const pendente = AR.estado.ataques_pendentes?.find(a => a.id === apId);
  if (!pendente) return;
  const resultEl = document.getElementById('resultado-ap-' + apId);
  const dano = parseInt(resultEl?.dataset.total || '0');
  pendente.status = 'aprovado'; pendente.dano_aplicado = dano;
  await atkAplicarDano(pendente.alvo, dano, 'arena', pendente.tipo_dano || 'fisico');
  arAddLog(`⚔ [Criativo] ${pendente.atacante} → ${pendente.alvo} — ${dano} de dano (aprovado pelo Mestre)`);
  await arSalvarEstado();
  renderArenaPersonagens(); renderArenaEntidades(); renderMesa();
  renderAtaquesPendentes();
  mostrarToast(`Ataque criativo de ${pendente.atacante} aprovado!`, 'sucesso');
}

async function atkMestreRejeitar(apId) {
  const pendente = AR.estado.ataques_pendentes?.find(a => a.id === apId);
  if (!pendente) return;
  pendente.status = 'rejeitado';
  arAddLog(`✕ Ação criativa de ${pendente.atacante} rejeitada pelo Mestre`);
  await arSalvarEstado();
  renderAtaquesPendentes();
  mostrarToast('Ação rejeitada', '');
}

// ══════════════════════════════════════════════════════════════
// ⚔ SISTEMA DE ATAQUES CRIATIVOS — CAMPANHA
// Fluxo: Jogador envia → Mestre preenche fórmula → Jogador rola → Dano aplicado
// Estado sincronizado via tabela criativos (realtime)
// ══════════════════════════════════════════════════════════════

// ── Helper: parsear dados de DC guardados em formula_aprovada ──────────────
function _parseDCData(formulaAprovada) {
  if (!formulaAprovada || !String(formulaAprovada).startsWith('__DC__')) return null;
  try { return JSON.parse(String(formulaAprovada).slice(6)); } catch(e) { return null; }
}

async function criativoSalvar(apenasId) {
  const rpgId = AR.session?.rpg_id || RPG_DATA?.rpgId;
  if (!rpgId) return;
  const sbFn = AR.session ? arSb : sb;
  const lista = apenasId
    ? CRIATIVOS_CAMP.filter(c => c.id === apenasId)
    : CRIATIVOS_CAMP;
  try {
    await Promise.all(lista.map(c =>
      sbFn(`criativos?rpg_id=eq.${encodeURIComponent(rpgId)}&id=eq.${encodeURIComponent(c.id)}`, {
        method:'PATCH',
        body:JSON.stringify({
          status:           c.status,
          formula_aprovada: c.formula_aprovada||null,
          mod_atributo:     c.mod_atributo||null,
          mod_atributo_pct: c.mod_atributo_pct||null,
          custo_cobrado:    c.custo_cobrado||null,
          animacao:         c.animacao||null,
        })
      })
    ));
  } catch(e) {}
}

async function criativoInserir(pendente) {
  if (!RPG_DATA?.rpgId) return;
  try {
    await sb('criativos', {
      method:'POST',
      body:JSON.stringify({
        rpg_id:            RPG_DATA.rpgId,
        id:                pendente.id,
        atacante:          pendente.atacante,
        alvo:              pendente.alvo,
        descricao:         pendente.descricao,
        turno:             pendente.turno||0,
        status:            pendente.status||'pendente',
        criativo_tipo:     pendente.criativo_tipo     || 'ataque',
        criativo_alvo_tipo:pendente.criativo_alvo_tipo|| 'unico',
      })
    });
  } catch(e) {}
}

function criativoReceberLinhaRemota(rec) {
  if (!rec || !rec.id) return;
  const c = {
    id:rec.id, atacante:rec.atacante, alvo:rec.alvo, descricao:rec.descricao,
    turno:rec.turno, status:rec.status,
    formula_aprovada:rec.formula_aprovada||null,
    mod_atributo:rec.mod_atributo||null,
    mod_atributo_pct:rec.mod_atributo_pct||null,
    custo_cobrado:rec.custo_cobrado||null,
    animacao:rec.animacao||null,
    criativo_tipo:      rec.criativo_tipo      || null,
    criativo_alvo_tipo: rec.criativo_alvo_tipo || null,
  };
  // Normalizar animacao (pode vir como string JSON do banco)
  if (typeof c.animacao === 'string') { try { c.animacao = JSON.parse(c.animacao); } catch(e) { c.animacao = null; } }
  if (c.animacao && typeof c.animacao !== 'object') c.animacao = null;
  // Extrair dados de DC se formula_aprovada tiver prefixo __DC__
  const dcData = _parseDCData(c.formula_aprovada);
  if (dcData) {
    c._dc = dcData;  // {dado, dc, eh_ataque, mensagem_fase1, resultado, critico, natural_max, mensagem_fase2}
  } else {
    c._dc = null;
  }
  // Restaurar _alvos_area do custo_cobrado (persistido pelo mestre na Fase 2)
  if (c.custo_cobrado && typeof c.custo_cobrado === 'object' && Array.isArray(c.custo_cobrado._alvos_area)) {
    c._alvos_area = c.custo_cobrado._alvos_area;
  }
  // Detectar combate_pedido a partir do prefixo [COMBATE_PEDIDO]
  const combateMatch = (rec.descricao || '').match(/^\[COMBATE_PEDIDO\]/);
  if (combateMatch) {
    c.tipo = 'combate_pedido';
    const mapaMatch = (rec.descricao || '').match(/mapa:([^\s|]+)/);
    c.mapa_id_pedido = mapaMatch ? mapaMatch[1] : null;
  }
  // Detectar skill request a partir do prefixo [SKILL:{...}]
  const skillMatch = (rec.descricao || '').match(/^\[SKILL:(\{.*?\})\]/);
  if (skillMatch) {
    try {
      const sk = JSON.parse(skillMatch[1]);
      c.tipo = 'skill_request';
      c.skill_nome    = sk.nome    || null;
      c.skill_formula = sk.formula || null;
      c.skill_atributo= sk.atributo|| null;
      c.skill_mod_pct = sk.mod_pct || null;
    } catch(e) {}
  }
  const idx = CRIATIVOS_CAMP.findIndex(x => x.id === c.id);
  if (idx >= 0) CRIATIVOS_CAMP[idx] = c;
  else CRIATIVOS_CAMP.push(c);
  criativoRenderMestre();
  if (CRIATIVO_ID_ATUAL === c.id) criativoAtualizarStepJogador(c);
  // Toast para mestre quando recebe pedido de combate
  if (c.tipo === 'combate_pedido' && (RPG_DATA?.myRole === 'mestre' || AR?.myRole === 'mestre')) {
    mostrarToast(`⚔ ${c.atacante} solicita entrada em combate!`, '');
  }
  // Toast para mestre quando jogador rolou o DC e aguarda definição de dano/buff
  if (c.status === 'dc_rolado_sucesso' && (RPG_DATA?.myRole === 'mestre' || AR?.myRole === 'mestre')) {
    const dc = c._dc;
    const resultLabel = dc ? `${dc.resultado}/${dc.dc}` : '';
    const ehSuporte = c.criativo_tipo === 'suporte';
    mostrarToast(`${ehSuporte ? '✨' : '⚔'} ${c.atacante} superou o desafio (${resultLabel})! ${ehSuporte ? 'Defina o buff/cura.' : 'Monte o dano.'}`, 'sucesso');
    // Auto-abrir modal de definir dano se não estiver aberto
    const overlayAberto = document.getElementById('modal-criativo-mestre-overlay')?.style.display !== 'none';
    if (!overlayAberto) abrirModalCriativoMestre(c.id);
  }
  if (c.status === 'dc_rolado_falha' && (RPG_DATA?.myRole === 'mestre' || AR?.myRole === 'mestre')) {
    const dc = c._dc;
    mostrarToast(`✗ ${c.atacante} falhou no desafio (${dc?.resultado||'?'}/${dc?.dc||'?'})`, '');
  }

  // Detectar se estamos em arena ou campanha
  const emArena = !!AR.session;
  const roleAtivo = emArena ? AR.myRole : RPG_DATA?.myRole;

  // Notificar mestre instantaneamente quando chega nova solicitação
  if (roleAtivo === 'mestre' && c.status === 'pendente') {
    // Em arena: aba Mesa; em campanha: aba Mapas
    const abaAtiva = emArena
      ? document.getElementById('ar-tab-mesa')?.classList.contains('ativo')
      : document.getElementById('tab-mapas')?.classList.contains('active');
    const isSkill = c.tipo === 'skill_request';
    const descCurta = isSkill
      ? (c.skill_nome || 'Skill')
      : (c.descricao||'').replace(/^\[SKILL:\{.*?\}\]\s*/,'').substring(0,60);
    _criativoNotifId = c.id;
    // UX-02: Vibração em mobile e badge pulsante independente do estado dos modais
    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    // Badge pulsante no botão/header do painel de criativos
    const _wrapId = emArena ? 'ar-criativos-mestre-wrap' : 'criativos-mestre-wrap';
    const _wrapEl = document.getElementById(_wrapId);
    if (_wrapEl) {
      _wrapEl.style.boxShadow = '0 0 0 2px rgba(200,168,75,0.8)';
      setTimeout(() => { if (_wrapEl) _wrapEl.style.boxShadow = ''; }, 3000);
    }
    if (!abaAtiva) {
      criativoNotifMostrar(
        'nova-solicitacao',
        '🎲 Nova Solicitação de Ação',
        `${c.atacante} → ${c.alvo || '?'}: ${descCurta}`,
        '📋 Abrir e Aprovar'
      );
    } else {
      mostrarToast(`Nova ação de ${c.atacante} aguardando aprovação`, '');
    }
  }
}

function criativoRenderMestre() {
  _limparNotifCreativo(); // UX-02: Limpar badge de notificação ao renderizar painel
  // Suporte a campanha e arena
  const emArena = !!AR.session;
  const roleAtivo = emArena ? AR.myRole : RPG_DATA?.myRole;
  const wrap = document.getElementById(emArena ? 'ar-criativos-mestre-wrap' : 'criativos-mestre-wrap');
  if (!wrap) return;
  if (roleAtivo !== 'mestre') { wrap.style.display = 'none'; return; }
  // UX-01: Incluir aprovado_dc e aprovado_aguardando_rolagem no painel do mestre
  // AC-10-B13: Incluir dc_rolado_narrativo de criativos de ataque (para reclassificação)
  const pendentes = CRIATIVOS_CAMP.filter(c => ['pendente','dc_rolado_sucesso','aprovado_dc','aprovado_aguardando_rolagem'].includes(c.status) ||
    (c.status === 'dc_rolado_narrativo' && c.criativo_tipo !== 'narrativo'));
  if (!pendentes.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  const corAccent = emArena ? 'rgba(232,80,60,0.7)' : 'rgba(200,168,75,0.7)';
  const corBtn = emArena ? 'rgba(232,80,60,0.2)' : 'rgba(200,168,75,0.2)';
  const corBtnBorder = emArena ? 'rgba(232,80,60,0.35)' : 'rgba(200,168,75,0.35)';
  const corBtnText = emArena ? '#e8604c' : 'var(--destaque)';
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <div style="font-family:'Cinzel',serif;font-size:0.6rem;color:${corAccent};text-transform:uppercase;letter-spacing:0.08em">✦ Ações Aguardando Aprovação</div>
      <button onclick="criativoMestreLimparTodas()" style="background:none;border:1px solid rgba(192,57,43,0.2);border-radius:4px;color:#e74c3c66;font-family:'Cinzel',serif;font-size:0.55rem;padding:2px 7px;cursor:pointer;text-transform:uppercase" title="Rejeitar todas as solicitações pendentes">✕ Limpar todas</button>
    </div>
    ${pendentes.map(c => {
      const isSkill    = c.tipo === 'skill_request';
      const isCombate  = c.tipo === 'combate_pedido';
      const isDanoReq  = c.status === 'dc_rolado_sucesso';
      const ehSuporte2 = c.criativo_tipo === 'suporte';
      // UX-01: estados de "aguardando jogador"
      const isAguardandoDC   = c.status === 'aprovado_dc';
      const isAguardandoRoll = c.status === 'aprovado_aguardando_rolagem';
      const isAguardandoJogador = isAguardandoDC || isAguardandoRoll;
      // AC-10-B13: criativo narrativo que passou mas foi marcado errado
      const isNarrativoMalMarcado = c.status === 'dc_rolado_narrativo' && c.criativo_tipo !== 'narrativo';
      // AC-11-G4: Distinguir NPC vs jogador real no card
      const temJogador = typeof personagemTemJogador === 'function' ? personagemTemJogador(c.atacante) : true;
      const isNpcAgindo = !temJogador;
      const bordaCard = isNpcAgindo
        ? (emArena ? 'rgba(232,80,60,0.35)' : 'rgba(200,168,75,0.35)')
        : 'rgba(79,163,209,0.35)';
      const bgCard = isNpcAgindo
        ? (emArena ? 'rgba(232,80,60,0.06)' : 'rgba(200,168,75,0.06)')
        : 'rgba(79,163,209,0.06)';
      const npcBadge = isNpcAgindo
        ? `<span style="font-size:0.5rem;background:rgba(200,168,75,0.12);border:1px solid rgba(200,168,75,0.3);border-radius:2px;padding:1px 4px;color:#f0cc6a;margin-left:4px;vertical-align:middle">NPC</span>`
        : `<span style="font-size:0.5rem;background:rgba(79,163,209,0.12);border:1px solid rgba(79,163,209,0.3);border-radius:2px;padding:1px 4px;color:#7ec8f0;margin-left:4px;vertical-align:middle">Jogador</span>`;
      const badge = isCombate
        ? `<span style="font-size:0.55rem;background:rgba(192,57,43,0.15);border:1px solid rgba(192,57,43,0.35);border-radius:3px;padding:1px 5px;color:#e74c3c;margin-left:4px">⚔ Combate</span>`
        : isDanoReq
          ? (ehSuporte2
            ? `<span style="font-size:0.55rem;background:rgba(94,224,154,0.1);border:1px solid rgba(94,224,154,0.35);border-radius:3px;padding:1px 5px;color:#5ee09a;margin-left:4px">✨ Definir Buff</span>`
            : `<span style="font-size:0.55rem;background:rgba(192,57,43,0.15);border:1px solid rgba(192,57,43,0.35);border-radius:3px;padding:1px 5px;color:#e74c3c;margin-left:4px">⚔ Montar Dano</span>`)
          : isAguardandoJogador
            ? `<span style="font-size:0.55rem;background:rgba(240,204,106,0.12);border:1px solid rgba(240,204,106,0.35);border-radius:3px;padding:1px 5px;color:#f0cc6a;margin-left:4px">⏳ Aguardando Jogador</span>`
          : isSkill
            ? `<span style="font-size:0.55rem;background:rgba(79,163,209,0.12);border:1px solid rgba(79,163,209,0.3);border-radius:3px;padding:1px 5px;color:#7ec8f0;margin-left:4px">Skill</span>`
            : `<span style="font-size:0.55rem;background:${corBtn};border:1px solid ${corBtnBorder};border-radius:3px;padding:1px 5px;color:${corBtnText};margin-left:4px">Criativo</span>`;
      const dc = c._dc;
      const descExibida = isCombate
        ? `⚔ Solicita entrada em combate — ${(c.descricao||'').replace(/^\[COMBATE_PEDIDO\]\s*mapa:[^\s|]+\s*\|?\s*/,'').trim() || 'sem descrição adicional'}`
        : isDanoReq
          ? (ehSuporte2
            ? `✅ Tirou <strong style="color:#f0cc6a">${dc?.resultado||'?'}</strong> / DC ${dc?.dc||'?'}${dc?.critico?' 🌟 Crítico!':''} — Defina buff/cura`
            : `✅ Tirou <strong style="color:#f0cc6a">${dc?.resultado||'?'}</strong> / DC ${dc?.dc||'?'}${dc?.critico?' 🌟 Crítico!':''} — Monte os dados de dano`)
          : isAguardandoDC
            ? `⏳ DC ${dc?.dc||'?'} (d${dc?.dado||20}) — aguardando jogador rolar`
          : isAguardandoRoll
            ? `⏳ Fórmula: <strong style="color:#f0cc6a">${c.formula_aprovada||'?'}</strong> — aguardando jogador rolar`
          : isSkill
            ? `🗡 ${c.skill_nome || '?'} em <strong style="color:#e8604c">${c.alvo}</strong>`
            : (c.descricao || '').replace(/^\[SKILL:\{.*?\}\]\s*/,'').replace(/^\[USO DE ITEM\]\s*/,'🎒 ').replace(/^\[COMBATE_PEDIDO\]\s*/,'');
      const isDanoReqSuporte = isDanoReq && ehSuporte2;
      const isDanoReqAtaque  = isDanoReq && !ehSuporte2;
      return `
      <div style="background:${isAguardandoJogador ? 'rgba(240,204,106,0.04)' : bgCard};border:1px solid ${isAguardandoJogador ? 'rgba(240,204,106,0.25)' : bordaCard};border-radius:8px;padding:10px;margin-bottom:6px;opacity:${isAguardandoJogador ? '0.85' : '1'}">
        <div style="font-family:'Cinzel',serif;font-size:0.75rem;color:${corBtnText};margin-bottom:3px">${c.atacante}${npcBadge}${badge}</div>
        <div style="font-size:0.8rem;color:#b8a8a8;margin-bottom:8px;line-height:1.4">${descExibida}</div>
        ${isNarrativoMalMarcado ? `<div style="display:flex;gap:6px">
          <button onclick="criativoReclassificar('${c.id}')" style="flex:1;padding:8px;background:linear-gradient(135deg,rgba(192,57,43,0.2),rgba(192,57,43,0.08));border:1px solid rgba(192,57,43,0.4);border-radius:6px;color:#e74c3c;font-family:'Cinzel',serif;font-size:0.65rem;cursor:pointer;text-transform:uppercase;letter-spacing:0.06em">⚔ Definir Efeito (Reclassificar)</button>
        </div>` : isAguardandoJogador ? '' : `<div style="display:flex;gap:6px">
          <button onclick="${c.tipo === 'combate_pedido' ? `mestreAbrirModalCombatePedido('${c.id}')` : `abrirModalCriativoMestre('${c.id}')`}"
            style="flex:1;padding:8px;background:linear-gradient(135deg,${isCombate || isDanoReqAtaque ? 'rgba(192,57,43,0.2),rgba(192,57,43,0.08)' : isDanoReqSuporte ? 'rgba(94,224,154,0.15),rgba(94,224,154,0.05)' : `${corBtn},${corBtn.replace('0.2','0.08')}`});border:1px solid ${isCombate || isDanoReqAtaque ? 'rgba(192,57,43,0.4)' : isDanoReqSuporte ? 'rgba(94,224,154,0.4)' : corBtnBorder};border-radius:6px;color:${isCombate || isDanoReqAtaque ? '#e74c3c' : isDanoReqSuporte ? '#5ee09a' : corBtnText};font-family:'Cinzel',serif;font-size:0.65rem;cursor:pointer;text-transform:uppercase;letter-spacing:0.06em">
            ${c.tipo === 'combate_pedido' ? '⚔ Gerenciar Combate' : isDanoReqSuporte ? '✨ Definir Buff/Cura' : isDanoReqAtaque ? '🎲 Montar Dano' : isSkill ? '🎲 Revisar Skill' : '🎲 Definir Desafio'}
          </button>
          <button onclick="criativoMestreRejeitarDireto('${c.id}')"
            style="padding:8px 10px;background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.25);border-radius:6px;color:#e74c3c88;font-family:'Cinzel',serif;font-size:0.72rem;cursor:pointer" title="Rejeitar">✕</button>
        </div>`}
      </div>
    `}).join('')}
  `;
}

// AC-08-B10: Badge de Crítico Visível no Modal Fase 2
function _adicionarBadgeCriticoModalFase2(c) {
  const dc = c._dc;
  if (!dc || !dc.critico) return '';
  const natural = dc.natural_max;
  return natural
    ? `<div style="margin-top:8px;padding:8px 12px;background:linear-gradient(135deg,rgba(255,215,0,0.25),rgba(255,215,0,0.1));border:1px solid rgba(255,215,0,0.5);border-radius:8px;text-align:center">
         <span style="font-size:1.1rem">🌟</span>
         <span style="font-family:'Cinzel',serif;font-size:0.75rem;color:#ffd700;margin-left:8px;letter-spacing:0.08em">CRÍTICO PERFEITO! (${dc.dado} natural)</span>
       </div>`
    : `<div style="margin-top:8px;padding:8px 12px;background:linear-gradient(135deg,rgba(200,168,75,0.25),rgba(200,168,75,0.1));border:1px solid rgba(200,168,75,0.5);border-radius:8px;text-align:center">
         <span style="font-size:1rem">✨</span>
         <span style="font-family:'Cinzel',serif;font-size:0.75rem;color:#f0cc6a;margin-left:8px;letter-spacing:0.08em">Sucesso Crítico! (${dc.resultado}/${dc.dc})</span>
       </div>`;
}

function abrirModalCriativoMestre(id) {
  const c = CRIATIVOS_CAMP.find(x => x.id === id);
  if (!c) return;
  document.getElementById('criativo-mestre-id').value = id;

  const isSkill    = c.tipo === 'skill_request';
  const isFase2    = c.status === 'dc_rolado_sucesso';
  
  // Detectar tipo de ação
  const criativoTipo = c.criativo_tipo || 'ataque';
  const criativoAlvoTipo = c.criativo_alvo_tipo || 'unico';

  // --- Info header com badge de tipo ---
  let descDisplay;
  const tipoBadge = criativoTipo === 'ataque' ? '<span style="background:rgba(232,80,60,0.12);border:1px solid rgba(232,80,60,0.3);color:#e8604c;padding:2px 8px;border-radius:4px;font-size:0.65rem;margin-left:8px">⚔️ ATAQUE</span>' :
                    criativoTipo === 'suporte' ? '<span style="background:rgba(94,224,154,0.1);border:1px solid rgba(94,224,154,0.3);color:#5ee09a;padding:2px 8px;border-radius:4px;font-size:0.65rem;margin-left:8px">✨ SUPORTE</span>' :
                    '<span style="background:rgba(126,200,240,0.1);border:1px solid rgba(126,200,240,0.3);color:#7ec8f0;padding:2px 8px;border-radius:4px;font-size:0.65rem;margin-left:8px">📖 NARRATIVO</span>';
  
  const alvoBadge = criativoAlvoTipo === 'area' ? '<span style="color:#f0cc6a;font-size:0.72rem;margin-left:6px">💥 Área</span>' :
                    criativoAlvoTipo === 'proprio' ? '<span style="color:#7ec8f0;font-size:0.72rem;margin-left:6px">👤 Próprio</span>' :
                    criativoAlvoTipo === 'unico' && c.alvo ? `<span style="color:#e8604c;font-size:0.72rem;margin-left:6px">🎯 ${c.alvo}</span>` : '';
  
  if (isFase2 && c._dc) {
    const dc = c._dc;
    const criticoStr = dc.critico ? ` 🌟 <span style="color:#f0cc6a">CRÍTICO!</span>` : '';
    const ehAtaque = dc.eh_ataque;
    
    // Mensagem diferente baseada no tipo
    let instrucaoFase2 = 'Monte os dados de dano para o ataque.';
    if (criativoTipo === 'ataque' && ehAtaque) {
      instrucaoFase2 = 'Monte os dados de dano e/ou defina turnos de debuff.';
    } else if (criativoTipo === 'suporte') {
      instrucaoFase2 = 'Defina o valor de cura ou turnos de buff.';
    }
    
    const badgeCritico = _adicionarBadgeCriticoModalFase2(c);
    descDisplay = `<strong style="color:var(--destaque)">${c.atacante}</strong>${tipoBadge}${alvoBadge}<br>
      <strong style="color:#f0cc6a;font-size:1.1em">${dc.resultado}</strong> (d${dc.dado}) contra DC ${dc.dc}${criticoStr}<br>
      <span style="font-size:0.8rem;color:#7a6060">${instrucaoFase2}</span>${badgeCritico}`;
  } else if (isSkill) {
    descDisplay = `<strong style="color:var(--destaque)">${c.atacante}</strong> → <strong style="color:#e8604c">${c.alvo}</strong>${tipoBadge}<br>
      <span style="font-family:'Cinzel',serif;font-size:0.82rem;color:#7ec8f0">🗡 ${c.skill_nome}</span>
      ${c.skill_formula ? `<span style="color:#f0cc6a;margin-left:6px">· ${c.skill_formula}</span>` : ''}
      <br><span style="font-size:0.8rem;color:#7a6060;margin-top:2px;display:block">Defina dado e DC para esta skill fora de combate</span>`;
  } else {
    const descLimpa = (c.descricao||'').replace(/^\[SKILL:\{.*?\}\]\s*/,'').replace(/^\[USO DE ITEM\]\s*/,'').replace(/^\[COMBATE_PEDIDO\]\s*/,'');
    descDisplay = `<strong style="color:var(--destaque)">${c.atacante}</strong>${tipoBadge}${alvoBadge}<br><span style="color:#b8a8a8">${descLimpa}</span>`;
  }
  document.getElementById('criativo-mestre-info').innerHTML = descDisplay;

  // Título contextualizado
  const tituloEl = document.getElementById('criativo-mestre-titulo');
  if (tituloEl) {
    if (isFase2) {
      if (criativoTipo === 'ataque') tituloEl.textContent = '⚔ Definir Dano/Debuff';
      else if (criativoTipo === 'suporte') tituloEl.textContent = '✨ Definir Cura/Buff';
      else tituloEl.textContent = '📖 Resolução Narrativa';
    } else {
      tituloEl.textContent = '🎲 Definir Desafio (DC)';
    }
  }

  // Mostrar fase correta
  // UX-03: Transição animada entre fases
  const f1 = document.getElementById('criativo-fase1');
  const f2 = document.getElementById('criativo-fase2');
  if (isFase2) {
    if (f1 && f1.style.display !== 'none') {
      f1.classList.add('fase-saindo');
      setTimeout(() => { f1.style.display = 'none'; f1.classList.remove('fase-saindo'); f2.style.display = ''; f2.classList.add('fase-entrando'); requestAnimationFrame(() => f2.classList.remove('fase-entrando')); }, 200);
    } else { if(f1) f1.style.display='none'; if(f2) f2.style.display=''; }
  } else {
    if (f2 && f2.style.display !== 'none') {
      f2.classList.add('fase-saindo');
      setTimeout(() => { f2.style.display = 'none'; f2.classList.remove('fase-saindo'); f1.style.display = ''; f1.classList.add('fase-entrando'); requestAnimationFrame(() => f1.classList.remove('fase-entrando')); }, 200);
    } else { if(f2) f2.style.display='none'; if(f1) f1.style.display=''; }
  }

  if (isFase2) {
    // --- FASE 2: Builder de dano/cura/buff ---
    CRIATIVO_MESTRE_BUILDER = [];
    if (isSkill && c.skill_formula) {
      const grupos = parsearFormulaDano(c.skill_formula);
      if (grupos) grupos.forEach(g => {
        if (g.tipo === 'dado') {
          const ex = CRIATIVO_MESTRE_BUILDER.find(x => x.tipo === 'dado' && x.faces === g.faces);
          if (ex) ex.qtd += (g.qtd||1); else CRIATIVO_MESTRE_BUILDER.push({tipo:'dado',qtd:g.qtd||1,faces:g.faces});
        }
      });
    }
    criativoMestreBuilderAtualizar();
    
    // ── AC-01-B1: Restaurar alvos de área de custo_cobrado ao reabrir modal
    if (c.custo_cobrado?._alvos_area && !c._alvos_area) {
      c._alvos_area = c.custo_cobrado._alvos_area;
    }
    
    // Mostrar/ocultar seções baseado no tipo
    const ehAtaque = c._dc?.eh_ataque;
    const danoSection = document.getElementById('criativo-dano-section');
    const turnosSection = document.getElementById('criativo-turnos-section');
    
    // Preencher atributos
    const selAttr = document.getElementById('criativo-mestre-atributo');
    if (selAttr) {
      const attrDefsSource = RPG_DATA?.attrDefs || AR?.estado?.attrDefs || [];
      selAttr.innerHTML = '<option value="">— Nenhum —</option>' +
        attrDefsSource.filter(a => a.tipo==='number'||!a.tipo||a.tipo==='text').map(a=>`<option value="${a.nome}">${a.nome}</option>`).join('');
      selAttr.value = (isSkill && c.skill_atributo) ? c.skill_atributo : '';
    }
    const modPctEl = document.getElementById('criativo-mestre-mod-pct');
    if (modPctEl) modPctEl.value = (isSkill && c.skill_mod_pct) ? c.skill_mod_pct : '';
    document.getElementById('criativo-mestre-attr-preview').textContent = '';
    criativoMestreAtributoMudou();
    
    // Mostrar resultado
    const resultEl = document.getElementById('criativo-fase2-resultado');
    if (resultEl && c._dc) {
      const dc = c._dc;
      // AC-08-B10: Adicionar badge visual de crítico e garantir visibilidade
      const criticoStr = dc.critico ? ` — 🌟 Crítico!` : '';
      const criticoBadge = dc.critico ? `<div style="display:inline-block;background:linear-gradient(135deg,#f0cc6a,#d4af37);padding:4px 10px;border-radius:6px;font-size:0.65rem;color:#1a0f00;font-weight:bold;letter-spacing:0.05em;margin-top:6px;box-shadow:0 2px 8px rgba(240,204,106,0.4)">🌟 CRÍTICO</div>` : '';
      const corResult = dc.critico ? '#f0cc6a' : '#5ee09a';
      const bgColor = dc.critico ? 'rgba(240,204,106,0.12)' : 'rgba(39,174,96,0.06)';
      const borderColor = dc.critico ? 'rgba(240,204,106,0.4)' : 'rgba(39,174,96,0.2)';
      resultEl.style.cssText = `padding:12px;border-radius:8px;margin-bottom:14px;text-align:center;background:${bgColor};border:1px solid ${borderColor};display:block`;
      resultEl.innerHTML = `<div style="font-size:0.65rem;color:var(--suave);font-family:'Cinzel',serif;text-transform:uppercase;margin-bottom:4px">Resultado do Desafio</div>
        <div style="font-family:'Cinzel',serif;font-size:1.8rem;color:${corResult};line-height:1">${dc.resultado}</div>
        <div style="font-size:0.75rem;color:var(--suave);margin-top:2px">d${dc.dado} • DC ${dc.dc}${criticoStr}</div>${criticoBadge}`;
    }
    
    // Reset animação
    const animTipoEl = document.getElementById('criativo-anim-tipo');
    if (animTipoEl) { animTipoEl.value = 'nenhuma'; criativoAnimTipoChange(); }
    const _rId = (eid) => document.getElementById(eid);
    if (_rId('criativo-anim-cor'))      _rId('criativo-anim-cor').value    = '#e74c3c';
    if (_rId('criativo-anim-icone'))    _rId('criativo-anim-icone').value  = '';
    if (_rId('criativo-anim-trilha'))   _rId('criativo-anim-trilha').checked = false;
    if (_rId('criativo-anim-url'))      _rId('criativo-anim-url').value    = '';
    if (_rId('criativo-anim-svg-code')) _rId('criativo-anim-svg-code').value = '';
    if (_rId('criativo-anim-tamanho'))  _rId('criativo-anim-tamanho').value = 120;
    if (_rId('criativo-anim-duracao'))  _rId('criativo-anim-duracao').value = 1500;
    if (_rId('criativo-anim-posicao'))  _rId('criativo-anim-posicao').value = 'alvo';
    if (_rId('criativo-msg-fase2'))     _rId('criativo-msg-fase2').value   = '';

    // ── Injetar painel de efeitos extras (buff/debuff/cura/HOT/DOT) ──────────
    _injetarCriativoExtrasPanel(c);

    // AC-08-B9: Mostrar aviso de cadastro de skill na Fase 2
    const skillWrapF2 = document.getElementById('criativo-fase2-skill-wrap');
    if (skillWrapF2) skillWrapF2.style.display = c._cadastrar_skill ? '' : 'none';
  } else {
    // --- FASE 1: DC declaration ---
    // Reset dado selecionado (default d20)
    document.querySelectorAll('.dc-dado-btn').forEach(b => b.classList.remove('dc-dado-sel'));
    const d20Btn = document.querySelector('.dc-dado-btn[data-faces="20"]');
    if (d20Btn) d20Btn.classList.add('dc-dado-sel');
    // Reset DC
    const dcEl = document.getElementById('criativo-dc-valor');
    if (dcEl) dcEl.value = '';
    const dcPrev = document.getElementById('criativo-dc-preview');
    if (dcPrev) dcPrev.textContent = '';
    
    // Pré-marcar "É ataque / tem efeito" se for tipo ataque ou suporte
    const atqCheck = document.getElementById('criativo-eh-ataque');
    if (atqCheck) { 
      atqCheck.checked = (criativoTipo === 'ataque' || criativoTipo === 'suporte'); 
      criativoEhAtaqueChange(); 
    }
    
    // Reset mensagem
    const msgEl = document.getElementById('criativo-msg-fase1');
    if (msgEl) msgEl.value = '';
    // Reset custo
    const cobrarCheck = document.getElementById('criativo-cobrar-custo');
    const custoFields = document.getElementById('criativo-custo-fields');
    const custoPrev   = document.getElementById('criativo-custo-preview');
    if (cobrarCheck) cobrarCheck.checked = false;
    if (custoFields) custoFields.style.display = 'none';
    if (custoPrev)   custoPrev.textContent = '';
    const custoSel = document.getElementById('criativo-custo-atributo');
    if (custoSel) {
      const especiais = (RPG_DATA?.attrDefs || []).filter(a => a.categoria==='status' && a.tipo==='number');
      custoSel.innerHTML = '<option value="">— Selecionar —</option>' +
        especiais.map(a=>`<option value="${a.nome}">${a.nome}</option>`).join('');
    }
    const custoQtd = document.getElementById('criativo-custo-qtd');
    if (custoQtd) custoQtd.value = '';
    // Reset skill
    const cadastrarCheck = document.getElementById('criativo-cadastrar-skill');
    const cadastrarFields = document.getElementById('criativo-cadastrar-skill-fields');
    if (cadastrarCheck) cadastrarCheck.checked = false;
    if (cadastrarFields) cadastrarFields.style.display = 'none';
    const skNomeEl = document.getElementById('criativo-skill-nome');
    const skEfeitoEl = document.getElementById('criativo-skill-efeito');
    if (skNomeEl) skNomeEl.value = c.skill_nome || '';
    if (skEfeitoEl) skEfeitoEl.value = (c.descricao||'').replace(/^\[SKILL:\{.*?\}\]\s*/,'').replace(/^\[COMBATE_PEDIDO\]\s*/,'').replace(/^\[USO DE ITEM\]\s*/,'') || '';
    // Pré-preencher DC para skill_request
    if (isSkill && c.skill_formula) {
      // Sugerir d20 como dado padrão para skills
    }
  }

  document.getElementById('modal-criativo-mestre-overlay').style.display = 'flex';
}

function criativoCobrarCustoToggle() {
  const on = document.getElementById('criativo-cobrar-custo').checked;
  const fields = document.getElementById('criativo-custo-fields');
  if (fields) fields.style.display = on ? 'block' : 'none';
  if (on) criativoCustoAtributoMudou();
}

function criativoCustoAtributoMudou() {
  const id = document.getElementById('criativo-mestre-id').value;
  const c = CRIATIVOS_CAMP.find(x => x.id === id);
  const atributo = document.getElementById('criativo-custo-atributo')?.value;
  const previewEl = document.getElementById('criativo-custo-preview');
  if (!c || !atributo || !previewEl) return;
  const charList2 = RPG_DATA?.characters || AR?.chars || [];
  const char = charList2.find(ch => ch.nome === c.atacante);
  const val = parseFloat(char?.custom_attrs?.atributos?.[atributo]) || 0;
  previewEl.textContent = `${c.atacante}: ${atributo} atual = ${val}`;
}

function fecharModalCriativoMestre() {
  document.getElementById('modal-criativo-mestre-overlay').style.display = 'none';
}

// ── Painel de efeitos extras (buff/debuff/cura/HOT/DOT) na Fase 2 do criativo ─
function _injetarCriativoExtrasPanel(c) {
  if (!c) return;
  const fase2 = document.getElementById('criativo-fase2');
  if (!fase2) return;

  const criativoTipo = c?.criativo_tipo || 'ataque';
  const ehSuporte = criativoTipo === 'suporte';
  const panelId = 'criativo-extras-panel';

  // Remover painel anterior se existir (tipo pode mudar)
  const old = document.getElementById(panelId);
  if (old) old.remove();

  const panel = document.createElement('div');
  panel.id = panelId;
  panel.style.cssText = `margin-top:10px;margin-bottom:4px;padding:12px;background:rgba(${ehSuporte?'94,224,154':'232,80,60'},0.05);border:1px solid rgba(${ehSuporte?'94,224,154':'232,80,60'},0.18);border-radius:8px`;

  const labelStyle = `display:flex;align-items:center;gap:5px;font-size:0.72rem;color:var(--texto);cursor:pointer;margin-bottom:6px`;
  const inputStyle = `padding:4px 6px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;font-family:'Cinzel',serif;font-size:0.8rem;text-align:center`;
  const rowStyle   = `display:none;align-items:center;gap:6px;flex-wrap:wrap;margin-left:20px;margin-bottom:4px`;

  panel.innerHTML = `
    <div style="font-family:'Cinzel',serif;font-size:0.62rem;color:${ehSuporte?'#5ee09a':'#e8604c'};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">
      ${ehSuporte?'✨ Efeitos Adicionais (Buff / Cura)':'☠ Efeitos Adicionais (Debuff / Dano Extra)'}
    </div>
    ${ehSuporte ? `
    <label style="${labelStyle}"><input type="checkbox" id="cx-cura-on" style="accent-color:#5ee09a" onchange="document.getElementById('cx-cura-fields').style.display=this.checked?'flex':'none'"> 💊 Cura Imediata</label>
    <div id="cx-cura-fields" style="${rowStyle}"><input type="number" id="cx-cura-qtd" value="10" min="1" style="${inputStyle};width:60px;color:#5ee09a"><span style="font-size:0.65rem;color:var(--suave)">HP</span></div>

    <label style="${labelStyle}"><input type="checkbox" id="cx-hot-on" style="accent-color:#5ee09a" onchange="document.getElementById('cx-hot-fields').style.display=this.checked?'flex':'none'"> 💚 HOT (cura por turno)</label>
    <div id="cx-hot-fields" style="${rowStyle}"><input type="text" id="cx-hot-formula" value="1d6" style="${inputStyle};width:58px;color:#5ee09a"> <span style="font-size:0.65rem;color:var(--suave)">×</span> <input type="number" id="cx-hot-turnos" value="3" min="1" max="99" style="${inputStyle};width:42px;color:#5ee09a"> <span style="font-size:0.65rem;color:var(--suave)">turnos</span></div>

    <label style="${labelStyle}"><input type="checkbox" id="cx-boost-on" style="accent-color:#f0cc6a" onchange="document.getElementById('cx-boost-fields').style.display=this.checked?'flex':'none'"> ⚡ Boost de Dano</label>
    <div id="cx-boost-fields" style="${rowStyle}"><span style="font-size:0.65rem;color:var(--suave)">+</span><input type="number" id="cx-boost-mod" value="3" min="1" style="${inputStyle};width:42px;color:#f0cc6a"> <span style="font-size:0.65rem;color:var(--suave)">×</span> <input type="number" id="cx-boost-turnos" value="2" min="1" max="99" style="${inputStyle};width:42px;color:#f0cc6a"> <span style="font-size:0.65rem;color:var(--suave)">turnos</span></div>

    <!-- AC-05-G2: Efeitos defensivos ausentes — agora disponíveis -->
    <label style="${labelStyle}"><input type="checkbox" id="cx-def-on" style="accent-color:#7ec8f0" onchange="document.getElementById('cx-def-fields').style.display=this.checked?'flex':'none'"> 🛡 Boost de Defesa</label>
    <div id="cx-def-fields" style="${rowStyle}"><span style="font-size:0.65rem;color:var(--suave)">+</span><input type="number" id="cx-def-mod" value="3" min="1" style="${inputStyle};width:42px;color:#7ec8f0"> <span style="font-size:0.65rem;color:var(--suave)">×</span> <input type="number" id="cx-def-turnos" value="2" min="1" max="99" style="${inputStyle};width:42px;color:#7ec8f0"> <span style="font-size:0.65rem;color:var(--suave)">turnos</span></div>

    <label style="${labelStyle}"><input type="checkbox" id="cx-hptemp-on" style="accent-color:#5ee09a" onchange="document.getElementById('cx-hptemp-fields').style.display=this.checked?'flex':'none'"> 💙 HP Temporário (Escudo)</label>
    <div id="cx-hptemp-fields" style="${rowStyle}"><input type="number" id="cx-hptemp-qtd" value="10" min="1" style="${inputStyle};width:60px;color:#5ee09a"> <span style="font-size:0.65rem;color:var(--suave)">HP temp</span></div>

    <label style="${labelStyle}"><input type="checkbox" id="cx-removedebuff-on" style="accent-color:#f0cc6a"> 🧹 Remover 1 Debuff do Alvo</label>
    ` : `
    <label style="${labelStyle}"><input type="checkbox" id="cx-dot-on" style="accent-color:#e8604c" onchange="document.getElementById('cx-dot-fields').style.display=this.checked?'flex':'none'"> 🩸 DOT (dano por turno)</label>
    <div id="cx-dot-fields" style="${rowStyle}"><input type="text" id="cx-dot-formula" value="1d4" style="${inputStyle};width:58px;color:#e8604c"> <span style="font-size:0.65rem;color:var(--suave)">×</span> <input type="number" id="cx-dot-turnos" value="3" min="1" max="99" style="${inputStyle};width:42px;color:#e8604c"> <span style="font-size:0.65rem;color:var(--suave)">turnos</span></div>

    <label style="${labelStyle}"><input type="checkbox" id="cx-debuff-on" style="accent-color:#e8604c" onchange="document.getElementById('cx-debuff-fields').style.display=this.checked?'flex':'none'"> 📉 Redução de Dano</label>
    <div id="cx-debuff-fields" style="${rowStyle}"><input type="number" id="cx-debuff-mod" value="-3" style="${inputStyle};width:52px;color:#e8604c"> <span style="font-size:0.65rem;color:var(--suave)">×</span> <input type="number" id="cx-debuff-turnos" value="2" min="1" max="99" style="${inputStyle};width:42px;color:#e8604c"> <span style="font-size:0.65rem;color:var(--suave)">turnos</span></div>

    <label style="${labelStyle}"><input type="checkbox" id="cx-imob-on" style="accent-color:#a07ef0" onchange="document.getElementById('cx-imob-fields').style.display=this.checked?'flex':'none'"> 🚫 Imobilizar</label>
    <div id="cx-imob-fields" style="${rowStyle};display:none"><input type="number" id="cx-imob-turnos" value="1" min="1" max="99" style="${inputStyle};width:52px;color:#a07ef0"> <span style="font-size:0.65rem;color:var(--suave)">turnos</span></div>

    <label style="${labelStyle}"><input type="checkbox" id="cx-stun-on" style="accent-color:#e8604c" onchange="document.getElementById('cx-stun-fields').style.display=this.checked?'flex':'none'"> ⚔🚫 Atordoar</label>
    <div id="cx-stun-fields" style="${rowStyle};display:none"><select id="cx-stun-tipo" style="${inputStyle};flex:1"><option value="todos">Todos os ataques</option><option value="fisico">Apenas físicos</option><option value="magico">Apenas mágicos</option></select> <input type="number" id="cx-stun-turnos" value="1" min="1" max="99" style="${inputStyle};width:42px;color:#e8604c"> <span style="font-size:0.65rem;color:var(--suave)">turnos</span></div>
    `}
    ${c?.criativo_alvo_tipo === 'area' ? `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.07)">
      <div style="font-family:'Cinzel',serif;font-size:0.62rem;color:var(--suave);text-transform:uppercase;margin-bottom:5px">💥 Alvos da Área (separados por vírgula)</div>
      <input type="text" id="cx-alvos-area" placeholder="Ex: Goblin, Orc, Troll" style="width:100%;padding:7px 9px;background:rgba(10,15,24,0.8);border:1px solid var(--borda);border-radius:6px;color:#f0cc6a;font-family:var(--fonte-t);font-size:0.85rem;box-sizing:border-box">
    </div>
    ` : ''}
  `;

  // Inserir antes da caixa de mensagem (penúltimo filho) ou no fim da fase2
  const msgBox = fase2.querySelector('#criativo-msg-fase2');
  if (msgBox?.parentElement?.parentElement === fase2) {
    fase2.insertBefore(panel, msgBox.parentElement);
  } else if (msgBox) {
    msgBox.parentNode.insertBefore(panel, msgBox);
  } else {
    fase2.appendChild(panel);
  }

  // Pré-preencher com valores já salvos (reabertura do modal)
  const extras = c?.custo_cobrado?._efeitos_extras || [];
  for (const ef of extras) {
    if (ef.tipo === 'cura_imediata') {
      const el = document.getElementById('cx-cura-on'); if (el) { el.checked=true; document.getElementById('cx-cura-fields').style.display='flex'; }
      const q = document.getElementById('cx-cura-qtd'); if (q) q.value=ef.valor||10;
    }
    if (ef.hot_formula) {
      const el = document.getElementById('cx-hot-on'); if (el) { el.checked=true; document.getElementById('cx-hot-fields').style.display='flex'; }
      const f = document.getElementById('cx-hot-formula'); if (f) f.value=ef.hot_formula;
      const t = document.getElementById('cx-hot-turnos'); if (t) t.value=ef.hot_turnos||3;
    }
    if (ef.boost_dano) {
      const el = document.getElementById('cx-boost-on'); if (el) { el.checked=true; document.getElementById('cx-boost-fields').style.display='flex'; }
      const m = document.getElementById('cx-boost-mod'); if (m) m.value=ef.boost_dano;
      const t = document.getElementById('cx-boost-turnos'); if (t) t.value=ef.boost_dano_turnos||2;
    }
    if (ef.dot_formula) {
      const el = document.getElementById('cx-dot-on'); if (el) { el.checked=true; document.getElementById('cx-dot-fields').style.display='flex'; }
      const f = document.getElementById('cx-dot-formula'); if (f) f.value=ef.dot_formula;
      const t = document.getElementById('cx-dot-turnos'); if (t) t.value=ef.dot_turnos||3;
    }
    if (ef.mod_dano) {
      const el = document.getElementById('cx-debuff-on'); if (el) { el.checked=true; document.getElementById('cx-debuff-fields').style.display='flex'; }
      const m = document.getElementById('cx-debuff-mod'); if (m) m.value=ef.mod_dano;
      const t = document.getElementById('cx-debuff-turnos'); if (t) t.value=ef.mod_dano_turnos||2;
    }
    if (ef.sem_movimento) {
      const el = document.getElementById('cx-imob-on'); if (el) { el.checked=true; document.getElementById('cx-imob-fields').style.display='flex'; }
      const t = document.getElementById('cx-imob-turnos'); if (t) t.value=ef.sem_movimento_turnos||1;
    }
    if (ef.sem_ataque) {
      const el = document.getElementById('cx-stun-on'); if (el) { el.checked=true; document.getElementById('cx-stun-fields').style.display='flex'; }
      const tipo = document.getElementById('cx-stun-tipo'); if (tipo) tipo.value=ef.sem_ataque_tipo||'todos';
      const t = document.getElementById('cx-stun-turnos'); if (t) t.value=ef.sem_ataque_turnos||1;
    }
    // AC-05-G2: Re-hidratar efeitos defensivos
    if (ef.boost_defesa) {
      const el = document.getElementById('cx-def-on'); if (el) { el.checked=true; document.getElementById('cx-def-fields').style.display='flex'; }
      const m = document.getElementById('cx-def-mod'); if (m) m.value=ef.boost_defesa;
      const t = document.getElementById('cx-def-turnos'); if (t) t.value=ef.boost_defesa_turnos||2;
    }
    if (ef.hp_temp) {
      const el = document.getElementById('cx-hptemp-on'); if (el) { el.checked=true; document.getElementById('cx-hptemp-fields').style.display='flex'; }
      const q = document.getElementById('cx-hptemp-qtd'); if (q) q.value=ef.hp_temp;
    }
    if (ef.remover_debuff) {
      const el = document.getElementById('cx-removedebuff-on'); if (el) el.checked=true;
    }
  }
  if (c._alvos_area?.length) {
    const el = document.getElementById('cx-alvos-area'); if (el) el.value=c._alvos_area.join(', ');
  }
}


window._acaoPersonagemAtual = null;

function abrirModalAcao(nomePersonagem) {
  window._acaoPersonagemAtual = nomePersonagem;
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const nomeEl = document.getElementById('modal-acao-nome');
  if (nomeEl) nomeEl.textContent = nomePersonagem;

  // Ocultar subpainéis
  document.getElementById('modal-acao-sub-criativa').style.display = 'none';
  document.getElementById('modal-acao-sub-combate').style.display = 'none';
  document.getElementById('modal-acao-sub-itens').style.display = 'none';

  // Mostrar opções corretas
  const jogOpts = document.getElementById('modal-acao-opcoes-jogador');
  const mesOpts = document.getElementById('modal-acao-opcoes-mestre');
  if (isMestre) {
    jogOpts.style.display = 'none';
    mesOpts.style.display = '';
  } else {
    jogOpts.style.display = '';
    mesOpts.style.display = 'none';
    // Ocultar "solicitar combate" se já estiver em combate ativo neste mapa
    const estaEmCombate = _estadoBatalhaJogador(nomePersonagem) !== 'fora_combate';
    const combSec = document.getElementById('modal-acao-combate-section');
    if (combSec) combSec.style.display = estaEmCombate ? 'none' : '';
  }

  document.getElementById('modal-acao-overlay').style.display = 'flex';
}

function fecharModalAcao() {
  document.getElementById('modal-acao-overlay').style.display = 'none';
}

function modalAcaoCriativa() {
  const isMestre = RPG_DATA?.myRole === 'mestre';
  // Mestre usa o modal de ataque diretamente
  if (isMestre) {
    fecharModalAcao();
    abrirModalAtaque(window._acaoPersonagemAtual, 'campanha');
    return;
  }
  // Jogador vê o subpainel de texto
  document.getElementById('modal-acao-opcoes-jogador').style.display = 'none';
  document.getElementById('modal-acao-criativa-desc').value = '';
  document.getElementById('modal-acao-sub-criativa').style.display = '';
}

function modalAcaoItem() {
  // Usar o sistema INV para listar consumíveis do personagem
  const nomeChar = window._acaoPersonagemAtual;
  const lista = document.getElementById('modal-acao-itens-lista');
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const painel = isMestre ? 'modal-acao-opcoes-mestre' : 'modal-acao-opcoes-jogador';
  if (document.getElementById(painel)) document.getElementById(painel).style.display = 'none';

  const char = RPG_DATA?.characters?.find(c => c.nome === nomeChar);
  if (!char || !INV?.inventario) {
    lista.innerHTML = '<div style="text-align:center;color:var(--suave);font-style:italic;padding:20px;font-size:0.85rem">Inventário não carregado</div>';
    document.getElementById('modal-acao-sub-itens').style.display = '';
    return;
  }

  // Itens do personagem no sistema INV
  const itensInv = INV.inventario.filter(i => {
    if (i.quantidade <= 0) return false;
    const pertence = i.char_id === char.id || i.personagem_nome === nomeChar || i.owner_id === char.id;
    if (!pertence) return false;
    const def = INV.itemDefs.find(d => d.id === (i.item_catalog_id || i.item_def_id));
    return def && (def.tipo === 'consumivel' || def.tipo === 'misc');
  });

  if (!itensInv.length) {
    lista.innerHTML = '<div style="text-align:center;color:var(--suave);font-style:italic;padding:20px;font-size:0.85rem">Nenhum item consumível no inventário</div>';
  } else {
    lista.innerHTML = itensInv.map(invItem => {
      const def = INV.itemDefs.find(d => d.id === (invItem.item_catalog_id || invItem.item_def_id));
      if (!def) return '';
      const efStr = Array.isArray(def.efeitos) ? def.efeitos.map(ef => _efeitoLabel?.(ef) || ef.tipo).join(' · ') : (def.descricao || '');
      return `<div onclick="fecharModalAcao();abrirModalUsarItem('${invItem.id}','${nomeChar.replace(/'/g,"\\'")}' )"
        style="padding:10px 12px;background:rgba(39,174,96,0.06);border:1px solid rgba(39,174,96,0.18);border-radius:8px;margin-bottom:6px;cursor:pointer;transition:background 0.2s"
        onmouseover="this.style.background='rgba(39,174,96,0.12)'" onmouseout="this.style.background='rgba(39,174,96,0.06)'">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
          <span style="font-size:1.1rem">${def.icone||'📦'}</span>
          <span style="font-family:var(--fonte-d);font-size:0.78rem;color:#5ee09a;flex:1">${def.nome}</span>
          <span style="font-family:var(--fonte-d);font-size:0.68rem;color:var(--suave)">×${invItem.quantidade}</span>
        </div>
        ${efStr ? `<div style="font-size:0.72rem;color:var(--suave)">${efStr}</div>` : ''}
      </div>`;
    }).join('');
  }
  document.getElementById('modal-acao-sub-itens').style.display = '';
}

function usarItemConsumivel(nomeChar, idx) {
  const char = RPG_DATA?.characters?.find(c => c.nome === nomeChar);
  if (!char) return;
  const itens = (char.custom_attrs?.itens || []).filter(it => it.consumivel || it.tipo === 'consumivel' || it.quantidade > 0);
  const item = itens[idx];
  if (!item) return;
  fecharModalAcao();
  const nomeItem = item.nome || item.name || 'Item';
  // Enviar ação criativa descrevendo o uso do item
  const idCriativo = 'item_' + Date.now();
  const pendente = {
    id: idCriativo,
    tipo: 'criativo',
    atacante: nomeChar,
    alvo: nomeChar,
    descricao: `[USO DE ITEM] ${nomeChar} usou "${nomeItem}". ${item.descricao||item.efeito||''}`.trim(),
    turno: 0,
    status: 'pendente',
  };
  CRIATIVOS_CAMP.push(pendente);
  CRIATIVO_ID_ATUAL = idCriativo;
  criativoInserir(pendente).then(() => {
    criativoRenderMestre();
    if (RPG_DATA?.myRole === 'mestre') {
      mostrarToast(`🎒 ${nomeChar} usou "${nomeItem}" — defina o efeito.`, '');
      abrirModalCriativoMestre(idCriativo);
    } else {
      criativoIniciarPolling(idCriativo);
      mostrarToast(`🎒 ${nomeChar} usou "${nomeItem}"! Aguardando Mestre.`, 'sucesso');
    }
  });
}

function modalAcaoSolicitarCombate() {
  document.getElementById('modal-acao-opcoes-jogador').style.display = 'none';
  document.getElementById('modal-acao-combate-motivo').value = '';
  document.getElementById('modal-acao-sub-combate').style.display = '';
}

async function acaoEnviarCriativa() {
  const desc = document.getElementById('modal-acao-criativa-desc').value.trim();
  if (!desc) { mostrarToast('Descreva sua ação primeiro', 'erro'); return; }
  const nomeChar = window._acaoPersonagemAtual;
  fecharModalAcao();

  const idCriativo = 'cri_' + Date.now();
  const pendente = {
    id: idCriativo,
    tipo: 'criativo',
    atacante: nomeChar,
    alvo: nomeChar,
    descricao: desc,
    turno: 0,
    status: 'pendente',
  };
  CRIATIVOS_CAMP.push(pendente);
  CRIATIVO_ID_ATUAL = idCriativo;
  await criativoInserir(pendente);
  criativoRenderMestre();

  // Mestre usando ação criativa via modal de ação: abrir aprovação diretamente
  if (RPG_DATA?.myRole === 'mestre') {
    mostrarToast('Defina a fórmula da ação criativa', '');
    abrirModalCriativoMestre(idCriativo);
    return;
  }

  criativoIniciarPolling(idCriativo);
  mostrarToast('✨ Ação criativa enviada ao Mestre', '');
}

async function acaoEnviarPedidoCombate() {
  const motivo = document.getElementById('modal-acao-combate-motivo').value.trim();
  const nomeChar = window._acaoPersonagemAtual;
  const mapaId = RPG_DATA?.characters?.find(c => c.nome === nomeChar)?.active_map_id || MAPA_STATE?.mapaAtualId || '';
  fecharModalAcao();

  const idPedido = 'cbt_' + Date.now();
  const desc = `[COMBATE_PEDIDO] mapa:${mapaId}${motivo ? ' | ' + motivo : ''}`;
  const pendente = {
    id: idPedido,
    tipo: 'combate_pedido',
    mapa_id_pedido: mapaId,
    atacante: nomeChar,
    alvo: '',
    descricao: desc,
    turno: 0,
    status: 'pendente',
  };
  CRIATIVOS_CAMP.push(pendente);
  await criativoInserir(pendente);
  criativoRenderMestre();
  mostrarToast('⚔ Pedido de combate enviado ao Mestre', '');
}

// ─── Mestre: abrir modal para aprovar pedido de combate ─────────────────────
function mestreAbrirModalCombatePedido(id) {
  const c = CRIATIVOS_CAMP.find(x => x.id === id);
  if (!c) return;
  document.getElementById('combate-pedido-id').value = id;
  document.getElementById('combate-pedido-solicitante').value = c.atacante;
  // Extrair mapa_id do campo descricao
  const mapaMatch = (c.descricao || '').match(/mapa:([^\s|]+)/);
  const mapaId = mapaMatch ? mapaMatch[1] : (c.mapa_id_pedido || MAPA_STATE?.mapaAtualId || '');
  document.getElementById('combate-pedido-mapa-id').value = mapaId;
  const motivo = (c.descricao || '').replace(/^\[COMBATE_PEDIDO\]\s*mapa:[^\s|]+\s*\|?\s*/, '').trim();
  const mapaEntry = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === mapaId);
  const mapaNome = mapaEntry?.mapa?.nome || mapaId || '?';
  document.getElementById('combate-pedido-info').innerHTML =
    `<strong style="color:var(--destaque)">${c.atacante}</strong> solicita entrada em combate no mapa <strong style="color:#7ec8f0">${mapaNome}</strong>${motivo ? `<br><span style="color:var(--suave)">"${motivo}"</span>` : ''}`;

  // Listar personagens elegíveis (mesmo mapa, hp > 0, não em batalha)
  const todosChars = RPG_DATA?.characters || [];
  const elegiveis = todosChars.filter(ch => {
    if (!ch.active_map_id || ch.active_map_id !== mapaId) return false;
    const hp = Number(ch.custom_attrs?.atributos?.HP ?? ch.custom_attrs?.hp ?? ch.custom_attrs?.['HP'] ?? 1);
    if (hp <= 0) return false;
    const jaEmBatalha = Object.values(MAPA_STATE?.batalhas || {}).some(b =>
      b.ativa && b.participantes?.some(p => p.nome === ch.nome)
    );
    return !jaEmBatalha;
  });

  const lista = document.getElementById('combate-pedido-participantes');
  if (!elegiveis.length) {
    lista.innerHTML = `<div style="text-align:center;color:var(--suave);font-style:italic;padding:12px;font-size:0.85rem">Nenhum personagem elegível neste mapa</div>`;
  } else {
    lista.innerHTML = elegiveis.map(ch => {
      const ca = ch.custom_attrs || {};
      const tipo = (ca.tipo_personagem === 'npc' || ca.tipo === 'npc') ? 'npc' : 'jogador';
      const cor = ca.cor || (tipo==='npc' ? '#e8604c' : '#7ec8f0');
      const hp  = Number(ca.atributos?.HP ?? ca.hp ?? 1);
      const hpMax = Number(ca.atributos?.HP_max ?? ca.hp_max ?? hp);
      return `<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(10,5,5,0.7);border-radius:8px;border-left:2px solid ${cor};cursor:pointer;margin-bottom:5px">
        <input type="checkbox" data-nome="${ch.nome}" data-tipo="${tipo}" data-cor="${cor}" checked style="accent-color:${cor};width:16px;height:16px">
        <span style="font-family:var(--fonte-d);font-size:0.78rem;color:${cor};flex:1">${ch.nome}</span>
        <span style="font-size:0.68rem;color:var(--suave)">${tipo}</span>
        <span style="font-size:0.68rem;color:${cor}">${hp}/${hpMax} HP</span>
      </label>`;
    }).join('');
  }
  document.getElementById('modal-combate-pedido-overlay').style.display = 'flex';
}

function fecharModalCombatePedido() {
  document.getElementById('modal-combate-pedido-overlay').style.display = 'none';
}

async function mestreAprovarCombatePedido() {
  const id     = document.getElementById('combate-pedido-id').value;
  const mapaId = document.getElementById('combate-pedido-mapa-id').value;
  const checkboxes = document.querySelectorAll('#combate-pedido-participantes input[type=checkbox]:checked');
  const participantesBase = Array.from(checkboxes).map(cb => ({
    nome: cb.dataset.nome, tipo: cb.dataset.tipo, cor: cb.dataset.cor, iniciativa: null
  }));
  if (participantesBase.length < 2) {
    mostrarToast('Selecione pelo menos 2 participantes para iniciar a batalha', 'erro');
    return;
  }
  fecharModalCombatePedido();
  // Remover pedido da lista
  const idx = CRIATIVOS_CAMP.findIndex(c => c.id === id);
  if (idx >= 0) CRIATIVOS_CAMP.splice(idx, 1);
  criativoRenderMestre();
  try {
    const rpgId = RPG_DATA?.rpgId;
    if (rpgId) await sb(`criativos?rpg_id=eq.${encodeURIComponent(rpgId)}&id=eq.${encodeURIComponent(id)}`, { method:'DELETE' });
  } catch(e) {}

  // Iniciar batalha no mapa selecionado
  const mapaEntry = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === mapaId);
  const mapaNome = mapaEntry?.mapa?.nome || mapaId;
  const bid = batalhaNovaId(mapaId);
  participantesBase.forEach(p => {
    if (p.tipo === 'npc') {
      p.iniciativa = Math.floor(Math.random() * 20) + 1;
    }
  });
  MAPA_STATE.batalhas[bid] = {
    id: bid, mapa_id: mapaId, mapa_nome: mapaNome,
    ativa: true, pausada: false, turnoRound: 1,
    fase: 'iniciativa',
    participantes: participantesBase,
    ordemAtual: 0, iniciativasRoladas: {}, empatados: [], dadoSel: null
  };
  BATALHA_ATUAL_ID = bid;
  _aplicarEstadoBatalhaUI();
  _atualizarBadgeMesa();
  _atualizarSeletorBatalhas();
  await criarBatalhaRemota(bid);
  // Broadcast instantâneo: outros clientes sabem da batalha antes do Supabase propagar
  combateBroadcast('batalha_criada', { batalhaId: bid, estado: MAPA_STATE.batalhas[bid] });
  mostrarToast(`⚔ Batalha iniciada em "${mapaNome}" com ${participantesBase.length} participantes!`, 'sucesso');
  batalhaVerificarIniciativasCompletas(bid);
}

async function mestreRejeitarCombatePedido() {
  const id = document.getElementById('combate-pedido-id').value;
  fecharModalCombatePedido();
  const idx = CRIATIVOS_CAMP.findIndex(c => c.id === id);
  if (idx >= 0) CRIATIVOS_CAMP.splice(idx, 1);
  criativoRenderMestre();
  try {
    const rpgId = RPG_DATA?.rpgId;
    if (rpgId) await sb(`criativos?rpg_id=eq.${encodeURIComponent(rpgId)}&id=eq.${encodeURIComponent(id)}`, { method:'DELETE' });
  } catch(e) {}
  mostrarToast('Pedido de combate recusado.', '');
}

function criativoCadastrarSkillToggle() {
  const checked = document.getElementById('criativo-cadastrar-skill')?.checked;
  const fields = document.getElementById('criativo-cadastrar-skill-fields');
  if (fields) fields.style.display = checked ? 'block' : 'none';
}

function criativoMestreBuilderAdd(faces) {
  const ex = CRIATIVO_MESTRE_BUILDER.find(g => g.tipo === 'dado' && g.faces === faces);
  if (ex) ex.qtd++; else CRIATIVO_MESTRE_BUILDER.push({ tipo: 'dado', qtd: 1, faces });
  criativoMestreBuilderAtualizar();
}
function criativoMestreBuilderRemove(faces) {
  const idx = CRIATIVO_MESTRE_BUILDER.findIndex(g => g.tipo === 'dado' && g.faces === faces);
  if (idx < 0) return;
  CRIATIVO_MESTRE_BUILDER[idx].qtd--;
  if (CRIATIVO_MESTRE_BUILDER[idx].qtd <= 0) CRIATIVO_MESTRE_BUILDER.splice(idx, 1);
  criativoMestreBuilderAtualizar();
}
function criativoMestreBuilderAtualizar() {
  const formula = formulaDeGrupos(CRIATIVO_MESTRE_BUILDER);
  const labelEl = document.getElementById('criativo-mestre-formula-label');
  if (labelEl) labelEl.textContent = formula || '(sem dados base)';
  const chipsEl = document.getElementById('criativo-mestre-builder-chips');
  if (!chipsEl) return;
  chipsEl.innerHTML = CRIATIVO_MESTRE_BUILDER.map(g => {
    if (g.tipo !== 'dado') return '';
    return `<div style="display:flex;align-items:center;gap:3px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:20px;padding:2px 8px 2px 6px">
      <span style="font-family:'Cinzel',serif;font-size:0.82rem;color:#f0cc6a">${g.qtd}d${g.faces}</span>
      <button onclick="criativoMestreBuilderRemove(${g.faces})" style="background:none;border:none;color:#c8a84b88;cursor:pointer;font-size:0.95rem;padding:0 0 0 2px;line-height:1">−</button>
    </div>`;
  }).join('');
}
function criativoMestreAtributoMudou() {
  const id  = document.getElementById('criativo-mestre-id').value;
  const c   = CRIATIVOS_CAMP.find(x => x.id === id);
  const sel = document.getElementById('criativo-mestre-atributo');
  const previewEl = document.getElementById('criativo-mestre-attr-preview');
  if (!c || !sel || !previewEl) return;
  const atributo = sel.value;
  if (!atributo) { previewEl.textContent = ''; return; }
  const charList = RPG_DATA?.characters || AR?.chars || [];
  const char = charList.find(ch => ch.nome === c.atacante);
  const val = char ? parseFloat(char.custom_attrs?.atributos?.[atributo] ?? 0) : 0;
  previewEl.textContent = `${c.atacante}: ${atributo} = ${val}`;
}

// ─── Helpers do modal mestre ─────────────────────────────────────────────────
function criativoSelecionarDado(btn, faces) {
  document.querySelectorAll('.dc-dado-btn').forEach(b => b.classList.remove('dc-dado-sel'));
  btn.classList.add('dc-dado-sel');
  criativoDCPreview();
}

function criativoToggleAtaque() {
  const chk = document.getElementById('criativo-eh-ataque');
  if (chk) { chk.checked = !chk.checked; criativoEhAtaqueChange(); }
}

function criativoEhAtaqueChange() {
  const chk = document.getElementById('criativo-eh-ataque');
  const icon = document.getElementById('criativo-eh-ataque-icon');
  const desc = document.getElementById('criativo-eh-ataque-desc');
  if (!chk) return;
  const on = chk.checked;
  if (icon) icon.textContent = on ? '⚔' : '⬜';
  if (icon) { icon.style.background = on ? 'rgba(192,57,43,0.2)' : 'rgba(255,255,255,0.05)'; icon.style.borderColor = on ? 'rgba(192,57,43,0.6)' : 'rgba(192,57,43,0.3)'; }
  if (desc) desc.textContent = on
    ? 'Jogador rola DC; se passar, volta ao mestre para definir dano/buff (Fase 2).'
    : 'Resultado é narrativo. O mestre decide o efeito fora do sistema de dados.';
}

function criativoDCPreview() {
  const dadoBtn = document.querySelector('.dc-dado-btn.dc-dado-sel');
  const faces = dadoBtn ? parseInt(dadoBtn.dataset.faces) : 20;
  const dc = parseInt(document.getElementById('criativo-dc-valor')?.value) || 0;
  const prevEl = document.getElementById('criativo-dc-preview');
  if (!prevEl) return;
  if (!dc) { prevEl.textContent = ''; return; }
  const limiar = Math.round((faces - dc) / 2 + dc);
  prevEl.textContent = `Crítico se tirar > ${limiar} · Natural ${faces} = Crítico automático`;
}

// ─── Abre o modal de ataque como overlay (corrige CSS de modo inline anterior) ─
function _criativoAbrirModalOverlay(c) {
  // Esconder painel inline do mapa imediatamente para evitar duplicidade
  const painelMapa = document.getElementById('atk-criativo-aprovado-mapa');
  if (painelMapa) painelMapa.style.display = 'none';

  const modal = document.getElementById('modal-ataque');
  if (!modal) { criativoAtualizarStepJogador(c); return; }

  // Mover modal de volta ao body caso esteja no anchor inline
  if (modal.parentElement?.id === 'atk-painel-campanha-anchor') {
    document.body.appendChild(modal);
  }

  // Restaurar CSS de overlay (sobrescreve qualquer cssText residual do modo inline)
  const inner = modal.querySelector('div');
  modal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;align-items:flex-end;justify-content:center;';
  if (inner) {
    inner.style.borderRadius = '16px 16px 0 0';
    inner.style.marginTop = '';
    inner.style.paddingBottom = '44px';
    inner.style.maxHeight = '90vh';
  }

  criativoAtualizarStepJogador(c);
  atkIrParaStep('pendente');
}

// ─── FASE 1: Mestre define dado + DC e envia ao jogador ──────────────────────
async function criativoMestreConcluirFase1() {
  const id = document.getElementById('criativo-mestre-id').value;
  const c = CRIATIVOS_CAMP.find(x => x.id === id);
  if (!c) return;

  const dadoBtn = document.querySelector('.dc-dado-btn.dc-dado-sel');
  const faces = dadoBtn ? parseInt(dadoBtn.dataset.faces) : 20;
  const dc = parseInt(document.getElementById('criativo-dc-valor')?.value) || 0;
  if (!dc || dc < 1) { mostrarToast('⚠ Defina a dificuldade (DC) antes de enviar.', 'erro'); return; }

  const ehAtaque = document.getElementById('criativo-eh-ataque')?.checked || false;
  const mensagem = document.getElementById('criativo-msg-fase1')?.value.trim() || '';

  // Custo de recurso (opcional)
  const cobrar = document.getElementById('criativo-cobrar-custo')?.checked;
  const custoAtrib = document.getElementById('criativo-custo-atributo')?.value?.trim() || null;
  const custoQtd   = parseFloat(document.getElementById('criativo-custo-qtd')?.value) || 0;
  c.custo_cobrado = (cobrar && custoAtrib && custoQtd > 0) ? { atributo: custoAtrib, quantidade: custoQtd } : null;

  // Salvar os dados de DC como JSON no campo formula_aprovada com prefixo __DC__
  const dcData = { dado: faces, dc, eh_ataque: ehAtaque, mensagem_fase1: mensagem };
  c.formula_aprovada = '__DC__' + JSON.stringify(dcData);
  c._dc = dcData;
  c.status = 'aprovado_dc';
  c.mod_atributo = null;
  c.mod_atributo_pct = null;
  c.animacao = null;

  // AC-08-B9: Skill será cadastrada na Fase 2 (após DC) quando a fórmula real estiver disponível.
  // Salvar intenção de cadastrar para recuperar na Fase 2:
  c._cadastrar_skill = document.getElementById('criativo-cadastrar-skill')?.checked || false;
  if (c._cadastrar_skill) {
    c._skill_meta = {
      nome: document.getElementById('criativo-skill-nome')?.value.trim() || 'Ação Criativa',
      efeito: document.getElementById('criativo-skill-efeito')?.value.trim() || '',
      tipo_dano: document.getElementById('criativo-skill-tipo-dano')?.value || 'fisico',
    };
  }

  fecharModalCriativoMestre();
  await criativoSalvar(id);
  criativoRenderMestre();

  const atqLabel = ehAtaque ? 'Ataque' : 'Não-ataque';
  mostrarToast(`🎲 Desafio enviado: d${faces} vs DC ${dc} (${atqLabel})${mensagem ? ' — "' + mensagem.substring(0,40) + '"' : ''}`, 'sucesso');

  // Se for a própria ação do mestre, abrir modal de ataque no step DC
  if (CRIATIVO_ID_ATUAL === id) {
    _criativoAbrirModalOverlay(c);
  }
}

// ─── Helper: labels por tipo de ação criativa ────────────────────────────────
function crLabelAcao(tipo) {
  return { ataque: '⚔ Dano', suporte: '✨ Efeito', narrativo: '📜 Ação' }[tipo] || '⚔ Dano';
}

// ─── FASE 2: Mestre define dano (após jogador passar no DC) ──────────────────
async function criativoMestreDefinirDano() {
  const id = document.getElementById('criativo-mestre-id').value;
  const c = CRIATIVOS_CAMP.find(x => x.id === id);
  if (!c) return;

  const ehSuporte = (c.criativo_tipo || 'ataque') === 'suporte';
  const formula = formulaDeGrupos(CRIATIVO_MESTRE_BUILDER) || null;
  if (!formula && !ehSuporte) { mostrarToast('⚠ Adicione pelo menos um dado de dano.', 'erro'); return; }
  
  // AC-03-B4: Para suporte, validar que há pelo menos fórmula OU efeito extra
  // (validação completa de efeitos será feita após coletar efeitosExtras)

  const atributo = document.getElementById('criativo-mestre-atributo')?.value.trim() || null;
  const modPct   = document.getElementById('criativo-mestre-mod-pct')?.value !== ''
    ? parseFloat(document.getElementById('criativo-mestre-mod-pct').value) : null;
  const mensagem = document.getElementById('criativo-msg-fase2')?.value.trim() || '';

  // Animação
  const animTipo = document.getElementById('criativo-anim-tipo')?.value || 'nenhuma';
  if (animTipo !== 'nenhuma') {
    const _isMidia = ['gif','imagem','svg','iframe'].includes(animTipo);
    c.animacao = { tipo: animTipo };
    if (_isMidia) {
      c.animacao.url     = animTipo !== 'svg' ? (document.getElementById('criativo-anim-url')?.value.trim() || '') : '';
      c.animacao.svg     = animTipo === 'svg' ? (document.getElementById('criativo-anim-svg-code')?.value.trim() || '') : '';
      c.animacao.tamanho = parseInt(document.getElementById('criativo-anim-tamanho')?.value) || 120;
      c.animacao.duracao = parseInt(document.getElementById('criativo-anim-duracao')?.value) || 1500;
      c.animacao.posicao = document.getElementById('criativo-anim-posicao')?.value || 'alvo';
    } else {
      c.animacao.cor    = document.getElementById('criativo-anim-cor')?.value   || '#e74c3c';
      c.animacao.icone  = document.getElementById('criativo-anim-icone')?.value.trim() || '';
      c.animacao.trilha = document.getElementById('criativo-anim-trilha')?.checked || false;
    }
  } else { c.animacao = null; }

  // ── Coletar efeitos extras do painel injetado ─────────────────────────────
  const efeitosExtras = [];
  const criativoTipo = c.criativo_tipo || 'ataque';
  if (ehSuporte) {
    // Cura imediata
    if (document.getElementById('cx-cura-on')?.checked) {
      const qtd = parseInt(document.getElementById('cx-cura-qtd')?.value) || 0;
      if (qtd > 0) efeitosExtras.push({ tipo:'cura_imediata', valor: qtd, nome:`Cura ${qtd}` });
    }
    // HOT
    if (document.getElementById('cx-hot-on')?.checked) {
      const form = document.getElementById('cx-hot-formula')?.value?.trim() || '1d6';
      const turn = parseInt(document.getElementById('cx-hot-turnos')?.value) || 3;
      efeitosExtras.push({ hot_formula: form, hot_turnos: turn, nome:`HOT ${form}×${turn}t` });
    }
    // Boost de dano
    if (document.getElementById('cx-boost-on')?.checked) {
      const mod = parseInt(document.getElementById('cx-boost-mod')?.value) || 3;
      const turn = parseInt(document.getElementById('cx-boost-turnos')?.value) || 2;
      efeitosExtras.push({ boost_dano: mod, boost_dano_turnos: turn, nome:`+${mod} Dano ×${turn}t` });
    }
    // AC-05-G2: Boost de defesa
    if (document.getElementById('cx-def-on')?.checked) {
      const mod = parseInt(document.getElementById('cx-def-mod')?.value) || 3;
      const turn = parseInt(document.getElementById('cx-def-turnos')?.value) || 2;
      efeitosExtras.push({ boost_defesa: mod, boost_defesa_turnos: turn, nome:`+${mod} Defesa ×${turn}t` });
    }
    // AC-05-G2: HP temporário
    if (document.getElementById('cx-hptemp-on')?.checked) {
      const qtd = parseInt(document.getElementById('cx-hptemp-qtd')?.value) || 10;
      efeitosExtras.push({ hp_temp: qtd, nome:`+${qtd} HP temp` });
    }
    // AC-05-G2: Remover debuff
    if (document.getElementById('cx-removedebuff-on')?.checked) {
      efeitosExtras.push({ remover_debuff: 1, nome:'🧹 Remove Debuff' });
    }
  } else {
    // DOT
    if (document.getElementById('cx-dot-on')?.checked) {
      const form = document.getElementById('cx-dot-formula')?.value?.trim() || '1d4';
      const turn = parseInt(document.getElementById('cx-dot-turnos')?.value) || 3;
      efeitosExtras.push({ dot_formula: form, dot_turnos: turn, nome:`DOT ${form}×${turn}t` });
    }
    // Redução de dano (debuff mod_dano)
    if (document.getElementById('cx-debuff-on')?.checked) {
      const mod = parseInt(document.getElementById('cx-debuff-mod')?.value) || -3;
      const turn = parseInt(document.getElementById('cx-debuff-turnos')?.value) || 2;
      efeitosExtras.push({ mod_dano: mod, mod_dano_turnos: turn, nome:`${mod} Dano ×${turn}t` });
    }
    // Imobilização
    if (document.getElementById('cx-imob-on')?.checked) {
      const turn = parseInt(document.getElementById('cx-imob-turnos')?.value) || 1;
      efeitosExtras.push({
        sem_movimento: true,
        sem_movimento_turnos: turn,
        nome: `🚫 Imobilizado ×${turn}t`,
        tipo: 'debuff',
      });
    }
    // Atordoamento
    if (document.getElementById('cx-stun-on')?.checked) {
      const tipo = document.getElementById('cx-stun-tipo')?.value || 'todos';
      const turn = parseInt(document.getElementById('cx-stun-turnos')?.value) || 1;
      efeitosExtras.push({
        sem_ataque: true,
        sem_ataque_tipo: tipo,
        sem_ataque_turnos: turn,
        nome: `⚔🚫 Atordoado ×${turn}t`,
        tipo: 'debuff',
      });
    }
  }

  // AC-03-B4: Validar que ações de suporte têm pelo menos um efeito ou fórmula
  if (ehSuporte && !formula && efeitosExtras.length === 0) {
    mostrarToast('⚠ Ação de suporte precisa ter dados de cura OU pelo menos um efeito (cura imediata, HOT, boost).', 'erro');
    return;
  }

  // Alvos de área (campo texto separado por vírgula)
  const alvosAreaStr = document.getElementById('cx-alvos-area')?.value?.trim();
  if (alvosAreaStr) {
    c._alvos_area = alvosAreaStr.split(',').map(a => a.trim()).filter(Boolean);
  } else {
    c._alvos_area = null;
  }

  // Atualizar _dc com a mensagem de fase 2
  const dcExistente = c._dc || {};
  const dcAtualizado = { ...dcExistente, mensagem_fase2: mensagem };

  c.status = 'aprovado_aguardando_rolagem';
  c.formula_aprovada = formula;
  c.mod_atributo = atributo;
  c.mod_atributo_pct = modPct;

  // Salvar metadados (efeitos extras, dc_data, alvos_area) em custo_cobrado
  // AC-01-B2: Preservar custo original se existir
  const custoOriginal = (c.custo_cobrado && !c.custo_cobrado._dano_meta) ? c.custo_cobrado : null;
  
  if (!c.custo_cobrado) {
    c.custo_cobrado = { _dano_meta: true, dc_data: dcAtualizado };
  } else if (typeof c.custo_cobrado === 'object') {
    c.custo_cobrado._dc_data = dcAtualizado;
  }
  
  // Preservar custo original para exibição e possível reembolso
  if (custoOriginal) {
    if (!c.custo_cobrado || typeof c.custo_cobrado !== 'object') {
      c.custo_cobrado = { _dano_meta: true };
    }
    c.custo_cobrado._custo_original = custoOriginal;
  }
  
  if (efeitosExtras.length) {
    if (!c.custo_cobrado || typeof c.custo_cobrado !== 'object') c.custo_cobrado = { _dano_meta: true };
    c.custo_cobrado._efeitos_extras = efeitosExtras;
  }
  // Persistir alvos de área no custo_cobrado para que o jogador receba via realtime
  if (c._alvos_area && c._alvos_area.length) {
    if (!c.custo_cobrado || typeof c.custo_cobrado !== 'object') c.custo_cobrado = { _dano_meta: true };
    c.custo_cobrado._alvos_area = c._alvos_area;
  }

  // AC-08-B9: Cadastrar skill na Fase 2 com fórmula e alvo_tipo corretos
  if (c._cadastrar_skill && c._skill_meta && RPG_DATA?.rpgId) {
    const sm = c._skill_meta;
    const alvoTipoSkill = c.criativo_alvo_tipo === 'area' ? 'area'
      : c.criativo_tipo === 'suporte' ? 'aliado' : 'inimigo';
    try {
      const skillBody = {
        rpg_id: RPG_DATA.rpgId,
        personagem: c.atacante,
        character_id: _skCharId(c.atacante),
        habilidade: sm.nome,
        efeito: sm.efeito || sm.nome,
        formula_dano: formula || null,
        tipo_dano: sm.tipo_dano,
        cooldown_turnos: 0,
        alvo_tipo: alvoTipoSkill,
        atributo_base: atributo || null,
        mod_atributo_pct: modPct || null,
      };
      const [novaSkill] = await sb('skills', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(skillBody) });
      if (RPG_DATA.skills) RPG_DATA.skills.push(novaSkill || skillBody);
      mostrarToast(`📖 Skill "${sm.nome}" cadastrada para ${c.atacante} com fórmula ${formula||'(buff)'}!`, 'sucesso');
    } catch(e) { console.warn('Erro ao cadastrar skill:', e); }
    c._cadastrar_skill = false;
    c._skill_meta = null;
  }

  fecharModalCriativoMestre();
  await criativoSalvar(id);
  _sincronizarAnimacaoCriativo(id); // AC-02-B3: Sincronizar animação para jogadores offline
  criativoRenderMestre();

  const efStr = efeitosExtras.map(e=>e.nome).join(' · ');
  // AC-01-B2: Usar _custo_original se disponível
  const custoReal = c.custo_cobrado?._custo_original || (c.custo_cobrado && !c.custo_cobrado._dano_meta ? c.custo_cobrado : null);
  const custoLabel = custoReal
    ? ` · Custo: ${custoReal.quantidade} ${custoReal.atributo}` : '';
  const lbl = crLabelAcao(criativoTipo);
  mostrarToast(`${lbl} definido: ${formula || '(buff direto)'}${efStr?' · '+efStr:''}${custoLabel}. Aguardando jogador rolar.`, 'sucesso');

  if (CRIATIVO_ID_ATUAL === id) {
    _criativoAbrirModalOverlay(c);
  }
}

async function criativoMestreRejeitar() {
  const id = document.getElementById('criativo-mestre-id').value;
  const c = CRIATIVOS_CAMP.find(x => x.id === id);
  if (!c) return;
  
  // AC-09-B11: Solicitar motivo da rejeição
  const motivo = prompt('Motivo da rejeição (opcional):\n\nEste motivo será exibido ao jogador.', '');
  // Se o usuário cancelar (null), não rejeitar
  if (motivo === null) return;
  
  fecharModalCriativoMestre();
  
  // AC-ESTADO: Transicionar para 'concluido' e limpar após delay
  c.status = 'rejeitado';
  c.motivo_rejeicao = motivo || 'Nenhum motivo fornecido';
  await criativoSalvar(id);
  criativoRenderMestre();
  mostrarToast('Ação recusada.', '');
  
  // Transicionar para 'concluido' após 3 segundos
  setTimeout(async () => {
    const cAtual = CRIATIVOS_CAMP.find(x => x.id === id);
    if (cAtual && cAtual.status === 'rejeitado') {
      cAtual.status = 'concluido';
      try {
        const rpgId = AR.session?.rpg_id || RPG_DATA?.rpgId;
        const sbFn = AR.session ? arSb : sb;
        await sbFn(`criativos?rpg_id=eq.${encodeURIComponent(rpgId)}&id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ status: 'concluido' })
        });
      } catch(e) {}
      
      // Limpar após 30 segundos
      setTimeout(() => {
        const idx = CRIATIVOS_CAMP.findIndex(x => x.id === id);
        if (idx >= 0) CRIATIVOS_CAMP.splice(idx, 1);
        criativoRenderMestre();
        try {
          const rpgId = AR.session?.rpg_id || RPG_DATA?.rpgId;
          const sbFn = AR.session ? arSb : sb;
          sbFn(`criativos?rpg_id=eq.${encodeURIComponent(rpgId)}&id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(()=>{});
        } catch(e) {}
      }, 30000);
    }
  }, 3000);
}

// Rejeitar diretamente do card (sem abrir modal)
async function criativoMestreRejeitarDireto(id) {
  const c = CRIATIVOS_CAMP.find(x => x.id === id);
  if (!c) return;
  
  // AC-09-B11: Solicitar motivo da rejeição
  const motivo = prompt('Motivo da rejeição (opcional):\n\nEste motivo será exibido ao jogador.', '');
  // Se o usuário cancelar (null), não rejeitar
  if (motivo === null) return;
  
  // AC-ESTADO: Transicionar para 'concluido' e limpar após delay
  c.status = 'rejeitado';
  c.motivo_rejeicao = motivo || 'Nenhum motivo fornecido';
  await criativoSalvar(id);
  criativoRenderMestre();
  mostrarToast('Ação recusada.', '');
  
  // Transicionar para 'concluido' após 3 segundos
  setTimeout(async () => {
    const cAtual = CRIATIVOS_CAMP.find(x => x.id === id);
    if (cAtual && cAtual.status === 'rejeitado') {
      cAtual.status = 'concluido';
      try {
        const rpgId = AR.session?.rpg_id || RPG_DATA?.rpgId;
        const sbFn = AR.session ? arSb : sb;
        await sbFn(`criativos?rpg_id=eq.${encodeURIComponent(rpgId)}&id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ status: 'concluido' })
        });
      } catch(e) {}
      
      // Limpar após 30 segundos
      setTimeout(() => {
        const idx = CRIATIVOS_CAMP.findIndex(x => x.id === id);
        if (idx >= 0) CRIATIVOS_CAMP.splice(idx, 1);
        criativoRenderMestre();
        try {
          const rpgId = AR.session?.rpg_id || RPG_DATA?.rpgId;
          const sbFn = AR.session ? arSb : sb;
          sbFn(`criativos?rpg_id=eq.${encodeURIComponent(rpgId)}&id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(()=>{});
        } catch(e) {}
      }, 30000);
    }
  }, 3000);
}

// Rejeitar todas as solicitações pendentes de uma vez
async function criativoMestreLimparTodas() {
  // AC-09-B12: Não incluir 'dc_rolado_sucesso' - jogador já rolou e pagou custo
  const pendentes = CRIATIVOS_CAMP.filter(c =>
    ['pendente','aprovado_dc'].includes(c.status)
  );
  if (!pendentes.length) return;
  const ids = pendentes.map(c => c.id);
  ids.forEach(id => {
    const ix = CRIATIVOS_CAMP.findIndex(c => c.id === id);
    if (ix >= 0) CRIATIVOS_CAMP.splice(ix, 1);
  });
  criativoRenderMestre();
  mostrarToast(`${ids.length} solicitação(ões) removida(s).`, '');
  try {
    const rpgId = AR.session?.rpg_id || RPG_DATA?.rpgId;
    const sbFn = AR.session ? arSb : sb;
    await Promise.all(ids.map(id =>
      sbFn(`criativos?rpg_id=eq.${encodeURIComponent(rpgId)}&id=eq.${encodeURIComponent(id)}`, { method:'DELETE' }).catch(()=>{})
    ));
  } catch(e) { console.warn('Erro ao deletar criativos:', e); }
}

// AC-10-B13: Reclassificar criativo narrativo como ataque (para mestre corrigir eh_ataque=false por engano)
async function criativoReclassificar(id) {
  const c = CRIATIVOS_CAMP.find(x => x.id === id);
  if (!c) return;
  if (!confirm('Reclassificar como ataque mecânico? O mestre poderá definir dano agora.')) return;
  if (c._dc) c._dc.eh_ataque = true;
  c.status = 'dc_rolado_sucesso';
  c.formula_aprovada = '__DC__' + JSON.stringify(c._dc || {});
  await criativoSalvar(id);
  criativoRenderMestre();
  mostrarToast('⚔ Criativo reclassificado como ataque. Monte o dano.', 'sucesso');
  abrirModalCriativoMestre(id);
}

// Chamado quando o estado remoto muda — atualiza a tela do jogador no step-pendente
// Referência ao criativo pendente da notificação global
let _criativoNotifId = null;

function criativoNotifMostrar(tipo, titulo, msg, labelBotao) {
  // tipo: 'aprovado' | 'recusado' | 'nova-solicitacao'
  const bar = document.getElementById('criativo-notif-bar');
  if (!bar) return;
  bar.className = tipo === 'recusado' ? 'recusado' : tipo === 'nova-solicitacao' ? 'nova-solicitacao' : '';
  document.getElementById('criativo-notif-titulo').textContent = titulo;
  document.getElementById('criativo-notif-msg').textContent = msg;
  document.getElementById('criativo-notif-btn-acao').textContent = labelBotao;
  bar.style.display = 'block';

  // Se sidebar disponível, mover notif para dentro dela (sem cobrir mapa)
  const _cSb = document.getElementById('ficha-sidebar-painel') || document.getElementById('mapa-sidebar');
  if (_cSb && bar.parentElement !== _cSb) {
    bar.style.position = 'static';
    bar.style.transform = 'none';
    bar.style.width = '100%';
    bar.style.minWidth = '0';
    bar.style.bottom = '';
    bar.style.left = '';
    bar.style.zIndex = '';
    bar.style.borderRadius = '8px';
    _cSb.insertBefore(bar, _cSb.firstChild);
  }

  // Também mostrar abaixo do mapa / na mapa-bar legada
  const mapaBar = document.getElementById('criativo-mapa-bar');
  if (mapaBar) {
    const borderColorMap = { 'recusado': 'rgba(192,57,43,0.5)', 'nova-solicitacao': 'rgba(79,163,209,0.5)', '': 'rgba(200,168,75,0.5)' };
    const titrColorMap  = { 'recusado': '#e74c3c', 'nova-solicitacao': 'var(--primario-v)', '': 'var(--destaque)' };
    const tipoKey = tipo === 'recusado' ? 'recusado' : tipo === 'nova-solicitacao' ? 'nova-solicitacao' : '';
    mapaBar.style.borderColor = borderColorMap[tipoKey];
    document.getElementById('criativo-mapa-titulo').style.color = titrColorMap[tipoKey];
    document.getElementById('criativo-mapa-titulo').textContent = titulo;
    document.getElementById('criativo-mapa-msg').textContent = msg;
    document.getElementById('criativo-mapa-btn-acao').textContent = labelBotao;
    const btnAcaoMapa = document.getElementById('criativo-mapa-btn-acao');
    if (btnAcaoMapa) {
      const bgAcaoMap = { 'recusado': 'rgba(192,57,43,0.15)', 'nova-solicitacao': 'rgba(79,163,209,0.15)', '': 'linear-gradient(135deg,rgba(200,168,75,0.25),rgba(200,168,75,0.1))' };
      const bdAcaoMap = { 'recusado': 'rgba(192,57,43,0.4)', 'nova-solicitacao': 'rgba(79,163,209,0.4)', '': 'rgba(200,168,75,0.4)' };
      const clAcaoMap = { 'recusado': '#e74c3c', 'nova-solicitacao': '#7ec8f0', '': 'var(--destaque)' };
      btnAcaoMapa.style.background = bgAcaoMap[tipoKey];
      btnAcaoMapa.style.borderColor = bdAcaoMap[tipoKey];
      btnAcaoMapa.style.color = clAcaoMap[tipoKey];
    }
    mapaBar.style.display = 'block';
  }
}

function criativoNotifFechar() {
  const bar = document.getElementById('criativo-notif-bar');
  if (bar) bar.style.display = 'none';
  const mapaBar = document.getElementById('criativo-mapa-bar');
  if (mapaBar) mapaBar.style.display = 'none';
  _criativoNotifId = null;
}

function criativoNotifAcao() {
  criativoNotifFechar();
  const emArena = !!AR.session;
  const roleAtivo = emArena ? AR.myRole : RPG_DATA?.myRole;
  if (roleAtivo === 'mestre') {
    if (emArena) {
      // Arena: navegar para aba Mesa
      const btnMesa = document.querySelector('#ar-tabs .ar-tab');
      if (btnMesa) arTab('mesa', btnMesa);
    } else {
      // Campanha: abrir aba Mapas
      const btnMesa = document.querySelector('.tab-btn[onclick*="mapas"]');
      if (btnMesa) abrirAba('mapas', btnMesa);
    }
    if (_criativoNotifId) {
      setTimeout(() => abrirModalCriativoMestre(_criativoNotifId), 150);
    }
  } else {
    // Jogador: reabrir o modal de ataque no step pendente com estado atualizado
    const modal = document.getElementById('modal-ataque');
    if (modal) {
      modal.style.display = 'flex';
      // Re-renderizar o estado aprovado antes de mostrar o step
      const cAtual = CRIATIVOS_CAMP.find(x => x.id === CRIATIVO_ID_ATUAL);
      if (cAtual) criativoAtualizarStepJogador(cAtual);
      else atkIrParaStep('pendente');
    }
  }
}

function _criativoHideAllPendente() {
  ['atk-pendente-aguardando','atk-pendente-dc-definida','atk-pendente-resultado-narrativo',
   'atk-pendente-aguardando-dano','atk-pendente-aprovado','atk-pendente-rejeitado']
    .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  // Esconder também o painel inline do mapa (evita duplicidade com o modal)
  const painelMapa = document.getElementById('atk-criativo-aprovado-mapa');
  if (painelMapa) painelMapa.style.display = 'none';
}

function criativoAtualizarStepJogador(c) {
  const modalAtaque = document.getElementById('modal-ataque');
  const modalAberto = modalAtaque && modalAtaque.style.display !== 'none';

  _criativoHideAllPendente(); // já esconde atk-criativo-aprovado-mapa também

  // ── STATUS: aprovado_dc  (mestre definiu dado+DC, jogador deve rolar) ──────
  if (c.status === 'aprovado_dc') {
    const dc = c._dc;
    if (!dc) return;
    const limiar = Math.round((dc.dado - dc.dc) / 2 + dc.dc);
    const divDC = document.getElementById('atk-pendente-dc-definida');
    if (divDC) {
      divDC.style.display = '';
      const tipoLabel = document.getElementById('atk-dc-tipo-label');
      const valorEl   = document.getElementById('atk-dc-valor-label');
      const previewEl = document.getElementById('atk-dc-critico-preview');
      const msgEl     = document.getElementById('atk-dc-msg-mestre');
      if (tipoLabel) tipoLabel.textContent = `🎲 d${dc.dado}`;
      if (valorEl)   valorEl.textContent   = dc.dc;
      if (previewEl) previewEl.textContent = `Crítico se > ${limiar} · Natural ${dc.dado} = Crítico automático`;
      if (msgEl)     { msgEl.textContent = dc.mensagem_fase1 || ''; msgEl.style.display = dc.mensagem_fase1 ? '' : 'none'; msgEl.style.whiteSpace = 'pre-wrap'; } // UX-05
    }
    if (modalAberto) {
      atkIrParaStep('pendente');
      mostrarToast(`🎲 Mestre definiu desafio: d${dc.dado} vs DC ${dc.dc}`, 'sucesso');
    } else {
      const painelMapa = document.getElementById('atk-criativo-aprovado-mapa');
      const formulaEl  = document.getElementById('atk-criativo-aprovado-formula');
      const tituloEl   = document.getElementById('atk-criativo-aprovado-titulo');
      const btnEl      = document.getElementById('atk-criativo-aprovado-btn');
      if (painelMapa && formulaEl) {
        if (tituloEl) tituloEl.textContent = `🎲 Desafio: role o d${dc.dado}`;
        formulaEl.textContent = `DC ${dc.dc}${dc.mensagem_fase1 ? ' · ' + dc.mensagem_fase1 : ''}`;
        if (btnEl) btnEl.textContent = `🎲 Rolar d${dc.dado}`;
        painelMapa.style.display = 'block';
        painelMapa.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        criativoNotifMostrar('aprovado', `🎲 Desafio Definido! d${dc.dado} vs DC ${dc.dc}`,
          `${dc.mensagem_fase1 ? dc.mensagem_fase1 + ' · ' : ''}Role o dado para prosseguir.`, '🎲 Rolar Agora');
      }
    }
    return;
  }

  // ── STATUS: dc_rolado_sucesso (aguardando mestre montar dano/buff) ────────
  if (c.status === 'dc_rolado_sucesso') {
    const divWait = document.getElementById('atk-pendente-aguardando-dano');
    if (divWait) {
      divWait.style.display = '';
      const dc = c._dc;
      const criticoStr = dc?.critico ? ` 🌟 Crítico!` : '';
      const ehSuporte = c.criativo_tipo === 'suporte';
      document.getElementById('atk-aguardando-dano-icone').textContent = dc?.critico ? '🌟' : '✅';
      document.getElementById('atk-aguardando-dano-titulo').textContent = `Tirou ${dc?.resultado||'?'} — Superou a DC!${criticoStr}`;
      document.getElementById('atk-aguardando-dano-sub').textContent = ehSuporte
        ? 'Aguardando o Mestre definir o efeito de suporte...'
        : 'Aguardando o Mestre montar os dados de dano...';
    }
    if (modalAberto) atkIrParaStep('pendente');
    return;
  }

  // ── STATUS: dc_rolado_narrativo (resultado narrativo, sem ataque) ─────────────
  if (c.status === 'dc_rolado_narrativo' || c.status === 'dc_rolado_falha') {
    const divNarr = document.getElementById('atk-pendente-resultado-narrativo');
    if (divNarr) {
      divNarr.style.display = '';
      const dc = c._dc;
      const sucesso = c.status === 'dc_rolado_narrativo';
      const criticoStr = dc?.critico ? ' 🌟' : '';
      document.getElementById('atk-narrativo-icon').textContent = sucesso ? (dc?.critico ? '🌟' : '✅') : '❌';
      document.getElementById('atk-narrativo-titulo').innerHTML = sucesso
        ? `<span style="color:#5ee09a">Sucesso${criticoStr}!</span> Resultado: ${dc?.resultado||'?'} / DC ${dc?.dc||'?'}`
        : `<span style="color:#e74c3c">Falhou.</span> Resultado: ${dc?.resultado||'?'} / DC ${dc?.dc||'?'}`;
      document.getElementById('atk-narrativo-detalhe').textContent = sucesso
        ? 'A ação foi bem-sucedida! O efeito é narrativo.'
        : 'Não alcançou a dificuldade. O mestre decide o que acontece.';
      const msgMestre = dc?.mensagem_fase1 || '';
      const msgEl = document.getElementById('atk-narrativo-msg-mestre');
      if (msgEl) { msgEl.textContent = msgMestre ? `"${msgMestre}"` : ''; msgEl.style.display = msgMestre ? '' : 'none'; }
    }
    if (modalAberto) atkIrParaStep('pendente');
    return;
  }

  // ── STATUS: aprovado_aguardando_rolagem (ataque — dano definido pelo mestre) ──
  if (c.status === 'aprovado_aguardando_rolagem') {
    const _lbl = crLabelAcao(c.criativo_tipo);
    let label = c.formula_aprovada || '(buff direto)';
    if (c.mod_atributo && c.mod_atributo_pct) label += ` + ${c.mod_atributo_pct}% ${c.mod_atributo}`;
    const custo = c.custo_cobrado && !c.custo_cobrado?._dano_meta ? ` · Custo: ${c.custo_cobrado.quantidade} ${c.custo_cobrado.atributo}` : '';
    const divAprov = document.getElementById('atk-pendente-aprovado');
    if (divAprov) {
      divAprov.style.display = '';
      const labelEl = document.getElementById('atk-pendente-formula-label');
      if (labelEl) labelEl.textContent = `🎲 ${label}${custo}`;
      // Mensagem do mestre (fase 2)
      const dc = c._dc || (c.custo_cobrado?._dano_meta ? c.custo_cobrado.dc_data : null) || {};
      const msgEl = document.getElementById('atk-pendente-dano-msg');
      if (msgEl) { msgEl.textContent = dc.mensagem_fase2 || ''; msgEl.style.display = dc.mensagem_fase2 ? '' : 'none'; msgEl.style.whiteSpace = 'pre-wrap'; } // UX-05
    }
    if (modalAberto) {
      atkIrParaStep('pendente');
      mostrarToast(`${_lbl} definido! Role agora.`, 'sucesso');
    } else {
      const painelMapa = document.getElementById('atk-criativo-aprovado-mapa');
      const formulaEl  = document.getElementById('atk-criativo-aprovado-formula');
      // AC-03-B5: Atualizar texto do botão baseado no tipo de ação
      const btnEl = document.getElementById('atk-criativo-aprovado-btn');
      if (painelMapa && formulaEl) {
        formulaEl.textContent = '🎲 ' + label + custo;
        // Atualizar texto do botão baseado no tipo
        if (btnEl) {
          const criativoTipo = c.criativo_tipo || 'ataque';
          if (criativoTipo === 'suporte') {
            btnEl.textContent = '✨ Rolar Efeito';
          } else if (criativoTipo === 'ataque') {
            btnEl.textContent = '⚔ Rolar Dano';
          } else {
            btnEl.textContent = '🎲 Rolar os Dados';
          }
        }
        painelMapa.style.display = 'block';
        painelMapa.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        criativoNotifMostrar('aprovado', `${_lbl} definido pelo Mestre!`, `${_lbl}: ` + label + custo + '. Clique para rolar.', `🎲 Rolar`);
      }
    }
    return;
  }

  // ── STATUS: rejeitado ────────────────────────────────────────────────────────
  if (c.status === 'rejeitado') {
    const divRej = document.getElementById('atk-pendente-rejeitado');
    if (divRej) divRej.style.display = '';
    if (modalAberto) mostrarToast('❌ Mestre recusou sua ação criativa.', '');
    else criativoNotifMostrar('recusado', '❌ Ação Recusada', c.motivo_rejeicao ? `Motivo: ${c.motivo_rejeicao}` : 'O mestre recusou esta ação.', '✕ Entendido');
    return;
  }

  // Fallback: aguardando
  const divAg = document.getElementById('atk-pendente-aguardando');
  if (divAg) divAg.style.display = '';
}

// -- Polling de fallback: garante que o jogador receba a aprovacao
// mesmo se o realtime do Supabase nao disparar o evento UPDATE.
let _criativoPollingTimer = null;

function criativoIniciarPolling(id) {
  criativoStopPolling();
  const rpgId = RPG_DATA?.rpgId || AR.session?.rpg_id;
  if (!rpgId) return;
  const emArena = !!AR.session;
  const sbFn = emArena ? arSb : sb;
  let tentativas = 0;
  const INTERVALO = 3500;
  const MAX = 120; // Maior timeout para suportar o fluxo de 2 fases
  const STATUS_FINAIS = ['rejeitado','concluido','dc_rolado_narrativo','dc_rolado_falha'];
  const STATUS_MUDOU = (s) => s !== 'pendente'; // Qualquer mudança interessa
  _criativoPollingTimer = setInterval(async () => {
    tentativas++;
    if (tentativas > MAX || CRIATIVO_ID_ATUAL !== id) { criativoStopPolling(); return; }
    const local = CRIATIVOS_CAMP.find(x => x.id === id);
    // Parar se status final atingido
    if (!local || STATUS_FINAIS.includes(local.status)) { criativoStopPolling(); return; }
    // Continuar polling se aguardando mudança
    const statusParaPollar = ['pendente','aprovado_dc','dc_rolado_sucesso','aprovado_aguardando_rolagem'];
    if (!statusParaPollar.includes(local.status)) { criativoStopPolling(); return; }
    try {
      const rows = await sbFn(
        `criativos?rpg_id=eq.${encodeURIComponent(rpgId)}&id=eq.${encodeURIComponent(id)}&select=*&limit=1`
      );
      const remoto = rows && rows[0];
      if (!remoto) { criativoStopPolling(); return; }
      if (remoto.status !== local.status) {
        criativoReceberLinhaRemota(remoto);
        // Reiniciar polling se ainda há fases a percorrer
        if (!STATUS_FINAIS.includes(remoto.status)) {
          tentativas = 0; // Reset contagem para nova fase
        } else {
          criativoStopPolling();
        }
      }
    } catch(e) {}
  }, INTERVALO);
}

function criativoStopPolling() {
  if (_criativoPollingTimer) { clearInterval(_criativoPollingTimer); _criativoPollingTimer = null; }
}

// ─── Jogador rola o dado de DC (Fase 1 → mestre ou narrativo) ────────────────
async function criativoJogadorRolarDC() {
  const c = CRIATIVOS_CAMP.find(x => x.id === CRIATIVO_ID_ATUAL);
  if (!c || !c._dc) return;

  const { dado, dc, eh_ataque, mensagem_fase1 } = c._dc;

  // Descontar custo se houver
  if (c.custo_cobrado && !c.custo_cobrado._dano_meta) {
    const { atributo, quantidade } = c.custo_cobrado;
    const char = (RPG_DATA?.characters || []).find(x => x.nome === c.atacante);
    const atual = parseFloat(char?.custom_attrs?.atributos?.[atributo]) || 0;
    if (atual < quantidade) {
      mostrarToast(`❌ Sem ${atributo} suficiente! (precisa ${quantidade}, tem ${atual})`, 'erro');
      return;
    }
    descontarCustoSkill(c.atacante, `${quantidade} ${atributo}`, 'campanha');
  }

  // ═══════════════════════════════════════════════════════════════
  // 🎲 ANIMAÇÃO VISUAL DO DADO
  // ═══════════════════════════════════════════════════════════════
  
  // Mostrar modal de rolagem
  _dcMostrarModalRolagem(c.atacante, dado, dc);
  
  // Rolar o dado com animação (embaralhar por ~500ms)
  const resultado = Math.floor(Math.random() * dado) + 1;
  const dadoEl = document.getElementById('dc-dado-valor');
  
  await new Promise(resolve => {
    let elapsed = 0;
    const iv = setInterval(() => {
      if (dadoEl) dadoEl.textContent = Math.floor(Math.random() * dado) + 1;
      elapsed += 70;
      if (elapsed >= 490) {
        clearInterval(iv);
        if (dadoEl) dadoEl.textContent = resultado;
        resolve();
      }
    }, 70);
  });

  // Calcular resultado
  const limiarCritico = Math.round((dado - dc) / 2 + dc);
  // AC-12-B14: Falha crítica (rolar muito abaixo do DC)
  const limiarFalhaCrit = Math.floor(dc / 2);
  const naturalMax = resultado === dado;
  const critico = naturalMax || resultado > limiarCritico;
  const sucesso = resultado >= dc;
  const falhaCritica = !sucesso && resultado <= limiarFalhaCrit;

  // Aguardar 300ms antes de mostrar resultado
  await new Promise(r => setTimeout(r, 300));
  
  // Mostrar resultado visual
  _dcMostrarResultado(resultado, dc, sucesso, critico, naturalMax, dado, falhaCritica);
  
  // UX-04: Para resultados dramaticos (critico/falha), mostrar botao manual
  if (critico || !sucesso) {
    await new Promise(resolve => {
      const modal = document.getElementById('modal-dc-rolagem');
      if (!modal) { setTimeout(resolve, 2000); return; }
      const btnCont = document.createElement('div');
      btnCont.id = 'dc-continuar-wrap';
      btnCont.style.cssText = 'margin-top:24px;animation:slideUp 0.4s ease-out';
            btnCont.innerHTML = `<button id='dc-btn-continuar' style='padding:10px 28px;background:linear-gradient(135deg,rgba(200,168,75,0.2),rgba(200,168,75,0.08));border:1px solid rgba(200,168,75,0.5);border-radius:8px;color:#f0cc6a;font-family:Cinzel,serif;font-size:0.8rem;cursor:pointer;letter-spacing:0.06em;text-transform:uppercase'>✓ Vi! Continuar</button>`;
      modal.querySelector('div')?.appendChild(btnCont);
      const cleanup = () => { btnCont.remove(); resolve(); };
      const btn = document.getElementById('dc-btn-continuar');
      if (btn) btn.addEventListener('click', cleanup, { once: true });
      setTimeout(cleanup, 12000); // fallback 12s
    });
  } else {
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Fechar modal de rolagem
  _dcFecharModalRolagem();

  // ═══════════════════════════════════════════════════════════════
  // CONTINUAR COM LÓGICA ORIGINAL
  // ═══════════════════════════════════════════════════════════════

  // Montar texto de resultado para broadcast
  let msgResultado;
  if (naturalMax) {
    msgResultado = `🎲 ${c.atacante} tirou ${resultado} natural! 🌟 ${dado} natural! Crítico! (DC ${dc})`;
  } else if (critico) {
    msgResultado = `🎲 ${c.atacante} tirou ${resultado} — 🌟 SUCESSO CRÍTICO! (DC ${dc}, limiar ${limiarCritico})`;
  } else if (sucesso) {
    msgResultado = `🎲 ${c.atacante} tirou ${resultado} — ✅ Sucesso! (DC ${dc})`;
  } else {
    // AC-12-B14: Toast diferenciado para falha crítica
    msgResultado = falhaCritica
      ? `🎲 ${c.atacante} tirou ${resultado} — 💀 FALHA CRÍTICA! (DC ${dc}, limiar ${limiarFalhaCrit})`
      : `🎲 ${c.atacante} tirou ${resultado} — ❌ Falhou. (DC ${dc})`;
  }

  // Broadcast para todos
  mostrarToast(msgResultado, sucesso ? 'sucesso' : '');
  combateBroadcast('dados_rolados', {
    atacante: c.atacante, habilidade: 'Ação Criativa',
    total: resultado, critico: critico ? (naturalMax ? `${dado} natural! Crítico!` : 'Sucesso Crítico!') : null,
    dc, sucesso, eh_ataque
  });

  // Gravar resultado no _dc do criativo
  // AC-12-B14: Incluir flag de falha crítica
  const dcAtualizado = { ...c._dc, resultado, critico, natural_max: naturalMax, sucesso, falha_critica: falhaCritica };

  if (!sucesso) {
    // Falha: narrativo sem efeito
    c._dc = dcAtualizado;
    c.status = eh_ataque ? 'dc_rolado_falha' : 'dc_rolado_narrativo';
    c.formula_aprovada = '__DC__' + JSON.stringify(dcAtualizado);
    
    // AC-ESTADO: Transicionar para 'concluido' após 5 segundos
    setTimeout(async () => {
      const cAtual = CRIATIVOS_CAMP.find(x => x.id === CRIATIVO_ID_ATUAL);
      if (cAtual && (cAtual.status === 'dc_rolado_falha' || cAtual.status === 'dc_rolado_narrativo')) {
        cAtual.status = 'concluido';
        await criativoSalvar(CRIATIVO_ID_ATUAL);
        criativoRenderMestre();
        // Limpar após 30 segundos
        setTimeout(() => {
          const idx = CRIATIVOS_CAMP.findIndex(x => x.id === CRIATIVO_ID_ATUAL);
          if (idx >= 0) CRIATIVOS_CAMP.splice(idx, 1);
          criativoRenderMestre();
          try {
            const rpgId = AR.session?.rpg_id || RPG_DATA?.rpgId;
            const sbFn = AR.session ? arSb : sb;
            sbFn(`criativos?rpg_id=eq.${encodeURIComponent(rpgId)}&id=eq.${encodeURIComponent(CRIATIVO_ID_ATUAL)}`, { method: 'DELETE' }).catch(()=>{});
          } catch(e) {}
        }, 30000);
      }
    }, 5000);
    
  } else if (!eh_ataque) {
    // Sucesso narrativo (mestre marcou como não-ataque / não tem efeito mecânico)
    c._dc = dcAtualizado;
    c.status = 'dc_rolado_narrativo';
    c.formula_aprovada = '__DC__' + JSON.stringify(dcAtualizado);
    
    // AC-ESTADO: Transicionar para 'concluido' após 5 segundos
    setTimeout(async () => {
      const cAtual = CRIATIVOS_CAMP.find(x => x.id === CRIATIVO_ID_ATUAL);
      if (cAtual && cAtual.status === 'dc_rolado_narrativo') {
        cAtual.status = 'concluido';
        await criativoSalvar(CRIATIVO_ID_ATUAL);
        criativoRenderMestre();
        // Limpar após 30 segundos
        setTimeout(() => {
          const idx = CRIATIVOS_CAMP.findIndex(x => x.id === CRIATIVO_ID_ATUAL);
          if (idx >= 0) CRIATIVOS_CAMP.splice(idx, 1);
          criativoRenderMestre();
          try {
            const rpgId = AR.session?.rpg_id || RPG_DATA?.rpgId;
            const sbFn = AR.session ? arSb : sb;
            sbFn(`criativos?rpg_id=eq.${encodeURIComponent(rpgId)}&id=eq.${encodeURIComponent(CRIATIVO_ID_ATUAL)}`, { method: 'DELETE' }).catch(()=>{});
          } catch(e) {}
        }, 30000);
      }
    }, 5000);
    
  } else {
    // Ataque ou suporte com efeito mecânico: aguardar mestre definir dano/buff
    c._dc = dcAtualizado;
    c.status = 'dc_rolado_sucesso';
    c.formula_aprovada = '__DC__' + JSON.stringify(dcAtualizado);
  }

  criativoAtualizarStepJogador(c);
  // Garantir modal overlay aberto para mostrar resultado (ex: mestre testando)
  const _modalDC = document.getElementById('modal-ataque');
  if (_modalDC && _modalDC.style.display === 'none') _criativoAbrirModalOverlay(c);
  else atkIrParaStep('pendente');
  // AC-12-B14: Aplicar consequência mecânica de falha crítica
  if (falhaCritica && eh_ataque) {
    await _aplicarConsequenciaFalhaCritica(CRIATIVO_ID_ATUAL, c.atacante, true);
  }
  await criativoSalvar(CRIATIVO_ID_ATUAL);
  criativoRenderMestre();
}

// AC-12-B14: Consequência Mecânica para Falha Crítica
async function _aplicarConsequenciaFalhaCritica(criativoId, atacante, falhaCritica) {
  if (!falhaCritica) return;
  const consequencias = [
    { tipo: 'debuff_dano', nome: 'Erro Fatal', descricao: 'Seu golpe errou completamente, deixando você exposto', efeito: { mod_dano: -3, mod_dano_turnos: 2 } },
    { tipo: 'atordoamento', nome: 'Desequilibrado', descricao: 'O contra-ataque te pegou desprevenido', efeito: { sem_ataque: true, sem_ataque_tipo: 'fisico', sem_ataque_turnos: 1 } },
    { tipo: 'vulneravel', nome: 'Defesas Baixas', descricao: 'Sua falha deixou você vulnerável', efeito: { boost_defesa: -2, boost_defesa_turnos: 1 } }
  ];
  const consq = consequencias[Math.floor(Math.random() * consequencias.length)];
  const char = (RPG_DATA?.characters || []).find(x => x.nome === atacante);
  if (!char) return;
  if (!char.buffs) char.buffs = [];
  char.buffs.push({ ...consq.efeito, nome: consq.nome, origem: 'falha_critica', tipo: 'debuff' });
  mostrarToast(`💀 ${atacante} sofreu: ${consq.nome} — ${consq.descricao}`, 'erro');
  combateBroadcast('efeito_aplicado', { alvo: atacante, efeito: consq.nome, descricao: consq.descricao, origem: 'falha_critica' });
  if (RPG_DATA?.rpgId) {
    try {
      const sbFn = AR.session ? arSb : sb;
      await sbFn(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(atacante)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ buffs: char.buffs })
      });
    } catch(e) { console.warn('Erro ao salvar consequência de falha crítica:', e); }
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎲 FUNÇÕES AUXILIARES PARA ANIMAÇÃO DE DC
// ═══════════════════════════════════════════════════════════════

function _dcMostrarModalRolagem(atacante, dado, dc) {
  // Criar ou reutilizar modal
  let modal = document.getElementById('modal-dc-rolagem');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-dc-rolagem';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="text-align:center;animation:fadeIn 0.3s ease-out">
        <div style="font-family:'Cinzel',serif;font-size:1.1rem;color:#f0cc6a;margin-bottom:12px">
          <span id="dc-atacante-nome">—</span> rolando...
        </div>
        <div style="font-size:0.75rem;color:var(--suave);margin-bottom:24px">
          Teste de DC <span id="dc-valor-dc" style="color:#e8604c;font-weight:bold">—</span>
        </div>
        
        <!-- Dado animado -->
        <div style="width:120px;height:120px;margin:0 auto 20px;border-radius:16px;background:rgba(232,80,60,0.1);border:3px solid rgba(232,80,60,0.6);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(232,80,60,0.3)">
          <div id="dc-dado-valor" style="font-family:'Cinzel',serif;font-size:3rem;color:#f0cc6a;font-weight:bold">?</div>
        </div>
        
        <div id="dc-dado-faces" style="font-size:0.7rem;color:var(--suave)">d20</div>
        
        <!-- Resultado -->
        <div id="dc-resultado" style="display:none;margin-top:24px;animation:slideUp 0.4s ease-out">
          <div id="dc-resultado-icone" style="font-size:3rem;margin-bottom:8px">✓</div>
          <div id="dc-resultado-texto" style="font-family:'Cinzel',serif;font-size:1.3rem;color:#5ee09a">SUCESSO!</div>
          <div id="dc-resultado-sub" style="font-size:0.8rem;color:var(--suave);margin-top:4px">—</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  // Atualizar conteúdo
  const nomeEl = document.getElementById('dc-atacante-nome');
  const dcEl = document.getElementById('dc-valor-dc');
  const facesEl = document.getElementById('dc-dado-faces');
  const resultadoEl = document.getElementById('dc-resultado');
  const dadoValorEl = document.getElementById('dc-dado-valor');
  
  if (nomeEl) nomeEl.textContent = atacante;
  if (dcEl) dcEl.textContent = dc;
  if (facesEl) facesEl.textContent = `d${dado}`;
  if (resultadoEl) resultadoEl.style.display = 'none';
  if (dadoValorEl) dadoValorEl.textContent = '?';
  
  modal.style.display = 'flex';
}

function _dcMostrarResultado(resultado, dc, sucesso, critico, naturalMax, dado, falhaCritica) {
  const resultadoEl = document.getElementById('dc-resultado');
  const iconeEl = document.getElementById('dc-resultado-icone');
  const textoEl = document.getElementById('dc-resultado-texto');
  const subEl = document.getElementById('dc-resultado-sub');
  const dadoContainer = document.querySelector('#modal-dc-rolagem > div > div:nth-child(4)');
  
  if (!resultadoEl) return;
  
  // Atualizar cor do dado baseado no resultado
  if (dadoContainer) {
    if (naturalMax) {
      dadoContainer.style.borderColor = '#f0cc6a';
      dadoContainer.style.background = 'rgba(240,204,106,0.2)';
      dadoContainer.style.boxShadow = '0 8px 32px rgba(240,204,106,0.5)';
    } else if (sucesso) {
      dadoContainer.style.borderColor = '#5ee09a';
      dadoContainer.style.background = 'rgba(94,224,154,0.15)';
      dadoContainer.style.boxShadow = '0 8px 32px rgba(94,224,154,0.4)';
    } else {
      dadoContainer.style.borderColor = '#e74c3c';
      dadoContainer.style.background = 'rgba(231,76,60,0.15)';
      dadoContainer.style.boxShadow = '0 8px 32px rgba(231,76,60,0.4)';
    }
  }
  
  // Configurar resultado
  if (naturalMax) {
    iconeEl.textContent = '🌟';
    textoEl.textContent = 'CRÍTICO PERFEITO!';
    textoEl.style.color = '#f0cc6a';
    subEl.textContent = `${resultado} natural em d${dado}!`;
  } else if (critico) {
    iconeEl.textContent = '✨';
    textoEl.textContent = 'SUCESSO CRÍTICO!';
    textoEl.style.color = '#f0cc6a';
    subEl.textContent = `Rolou ${resultado} (DC ${dc})`;
  } else if (sucesso) {
    iconeEl.textContent = '✓';
    textoEl.textContent = 'SUCESSO!';
    textoEl.style.color = '#5ee09a';
    subEl.textContent = `Rolou ${resultado} (DC ${dc})`;
  } else if (falhaCritica) {
    iconeEl.textContent = '💀';
    textoEl.textContent = 'FALHA CRÍTICA!';
    textoEl.style.color = '#c0392b';
    subEl.textContent = `Rolou ${resultado} — muito abaixo do DC ${dc}`;
    if (dadoContainer) {
      dadoContainer.style.borderColor = '#c0392b';
      dadoContainer.style.background = 'rgba(192,57,43,0.25)';
      dadoContainer.style.boxShadow = '0 8px 32px rgba(192,57,43,0.6)';
    }
  } else {
    iconeEl.textContent = '✗';
    textoEl.textContent = 'FALHOU';
    textoEl.style.color = '#e74c3c';
    subEl.textContent = `Rolou ${resultado} (precisava ${dc})`;
  }
  
  resultadoEl.style.display = 'block';
}

function _dcFecharModalRolagem() {
  const modal = document.getElementById('modal-dc-rolagem');
  if (modal) modal.style.display = 'none';
}

// ─── Jogador rola o dado de dano (Fase 2 — após mestre montar a fórmula) ─────
function criativoJogadorRolarDano() {
  const c = CRIATIVOS_CAMP.find(x => x.id === CRIATIVO_ID_ATUAL);
  if (!c) return;

  // Extrair efeitos extras salvos pelo mestre (buff/debuff/cura/HOT/DOT)
  let efeitosExtras = [];
  const custo = c.custo_cobrado;
  if (custo && typeof custo === 'object' && Array.isArray(custo._efeitos_extras)) {
    efeitosExtras = custo._efeitos_extras;
  }

  // Determinar tipo de alvo pelo tipo criativo
  const criativoTipo = c.criativo_tipo || 'ataque';
  const alvoTipoFinal = criativoTipo === 'suporte'
    ? (c.criativo_alvo_tipo === 'proprio' ? 'proprio' : 'aliado')
    : 'inimigo';

  // AC-03-B6: Detectar se é cura (suporte com cura_imediata OU HOT nos extras ou formula de cura)
  const ehCura = criativoTipo === 'suporte' && efeitosExtras.some(e => e.tipo === 'cura_imediata' || e.hot_formula);
  const tipoDanoFinal = criativoTipo === 'suporte' ? (ehCura ? 'cura' : 'suporte') : 'fisico';

  // Suporte a múltiplos alvos (área criativa)
  if (c.criativo_alvo_tipo === 'area' && c._alvos_area && c._alvos_area.length > 1) {
    COMBATE._alvosAoE = c._alvos_area;
    COMBATE.alvoNome  = c._alvos_area[0];
  } else {
    COMBATE._alvosAoE = null;
    COMBATE.alvoNome  = c.alvo || null;
  }

  // Montar habilidade temporária com tudo que o mestre definiu
  COMBATE.habilidadeSel = {
    criativo:         true,
    nome:             'Ação Criativa',
    formula_dano:     c.formula_aprovada || null,
    atributo_base:    c.mod_atributo || null,
    mod_atributo_pct: c.mod_atributo_pct || null,
    cooldown_turnos:  0,
    alvo_tipo:        alvoTipoFinal,
    tipo_dano:        tipoDanoFinal,
    efeitos_bonus:    efeitosExtras,
    animacao:         c.animacao || null,
  };

  const alvoResumo = document.getElementById('atk-alvo-resumo');
  const alvoLabel = COMBATE._alvosAoE ? COMBATE._alvosAoE.join(', ') : (c.alvo || '?');
  if (alvoResumo) alvoResumo.textContent = `Alvo: ${alvoLabel}`;

  _criativoHideAllPendente();
  atkPrepararStep3();
  atkIrParaStep(3);
}

// ─── Criativo aprovado: rolar do painel inline no mapa ───────────────────────
function criativoJogadorRolar() {
  // Detecta fase da ação criativa e redireciona: DC pendente → rolar DC; dano aprovado → rolar dano
  const c = CRIATIVOS_CAMP.find(x => x.id === CRIATIVO_ID_ATUAL);
  if (!c) return;
  if (c.status === 'aprovado_dc') criativoJogadorRolarDC();
  else if (c.status === 'aprovado_aguardando_rolagem') criativoJogadorRolarDano();
}

function criativoJogadorRolarMapa() {
  const el = document.getElementById('atk-criativo-aprovado-mapa');
  if (el) el.style.display = 'none';
  criativoJogadorRolar();
}

// ── Trigger de animacao de skill — flutua acima do token do atacante ────────
let _atkAnimTriggerTimer = null;
let _atkAnimTriggerSeg   = 10;

// ── Cálculo de crítico: ≥90% do valor máximo da fórmula (ceil) ──────────────
function calcMaxFormula(grupos) {
  if (!grupos || !grupos.length) return 0;
  let max = 0;
  for (const g of grupos) {
    if (g.tipo === 'dado') max += g.qtd * g.faces;
    else if (g.tipo === 'fixo' && g.valor > 0) max += g.valor;
  }
  return max;
}
function calcCriticoThreshold(grupos) {
  const max = calcMaxFormula(grupos);
  if (!max || max <= 0) return null;
  return Math.ceil(max * 0.9);
}

function _atkDarkenColor(hex, factor) {
  hex = (hex || '#4fa3d1').replace('#','');
  if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
  let r = parseInt(hex.slice(0,2),16) || 0;
  let g = parseInt(hex.slice(2,4),16) || 0;
  let b = parseInt(hex.slice(4,6),16) || 0;
  // Garante escurecimento mínimo: luminância máxima ≈ 120 (de 255)
  const lum = 0.299*r + 0.587*g + 0.114*b;
  const extra = lum > 160 ? (lum - 160) / 255 : 0;
  r = Math.round(r * (1 - factor - extra));
  g = Math.round(g * (1 - factor - extra));
  b = Math.round(b * (1 - factor - extra));
  return `rgba(${Math.max(0,r)},${Math.max(0,g)},${Math.max(0,b)},0.93)`;
}

function _atkMostrarTrigger() {
  const el = document.getElementById('atk-anim-trigger');
  if (!el) return;

  // ── Preencher dados do ataque ───────────────────────────────────
  const h = COMBATE.habilidadeSel;
  const nomeAtaque = h?.habilidade || h?.nome || '⚔ Ataque';
  const danoTotal  = COMBATE.dadosRolados?.total ?? null;
  const efeitos    = (h?.efeitos_bonus || []).map(e => e.nome).filter(Boolean).join(' · ');

  // ── Detecção de crítico (≥90% do máximo dos DADOS, sem modificador de atributo) ─────────────
  const grupos = COMBATE._gruposFormula || parsearFormulaDano(h?.formula_dano);
  // Isolar apenas grupos de dado (excluir fixo/modifier) para threshold
  const gruposDados = grupos ? grupos.filter(g => g.tipo === 'dado') : null;
  const threshold = gruposDados?.length ? calcCriticoThreshold(gruposDados) : null;
  // Usar apenas a soma dos dados individuais (sem bonus/modifier)
  const somenteDados = COMBATE.dadosRolados?.dados
    ? COMBATE.dadosRolados.dados.reduce((s,d) => s + d.valor, 0)
    : danoTotal;
  const ehCura = h?.tipo_dano === 'cura';
  const ehPositivo = ehCura || ['aliado','proprio','todos_aliados'].includes(h?.alvo_tipo);
  const criticoTexto = ehPositivo ? (h?.critico_positivo || null) : (h?.critico_negativo || null);
  const ehCritico = threshold !== null && somenteDados !== null && somenteDados >= threshold;
  COMBATE._ehCritico = ehCritico;
  COMBATE._criticoTexto = ehCritico ? criticoTexto : null;
  COMBATE._criticoEhPositivo = ehPositivo;

  // Badge de crítico
  const criticoEl = document.getElementById('atk-anim-trigger-critico');
  if (criticoEl) {
    if (ehCritico) {
      criticoEl.textContent = ehPositivo ? `✨ CRÍTICO! ${criticoTexto || ''}` : `⚡ CRÍTICO! ${criticoTexto || ''}`;
      criticoEl.style.display = 'block';
      criticoEl.style.background = ehPositivo
        ? 'linear-gradient(135deg,rgba(94,224,154,0.35),rgba(20,180,100,0.35))'
        : 'linear-gradient(135deg,rgba(240,180,20,0.35),rgba(255,120,0,0.35))';
      criticoEl.style.borderColor = ehPositivo ? 'rgba(94,224,154,0.6)' : 'rgba(240,180,20,0.6)';
    } else {
      criticoEl.style.display = 'none';
    }
  }

  document.getElementById('atk-anim-trigger-nome').textContent = nomeAtaque;
  const danoEl = document.getElementById('atk-anim-trigger-dano');
  danoEl.textContent = danoTotal != null ? (ehCura ? `${danoTotal} cura` : `${danoTotal} dano`) : '';
  danoEl.style.display = danoTotal != null ? 'block' : 'none';
  danoEl.style.color = ehCura ? '#5ee09a' : '#f0cc6a';
  const efEl = document.getElementById('atk-anim-trigger-efeitos');
  efEl.textContent = efeitos;
  efEl.style.display = efeitos ? 'block' : 'none';

  // ── Cor de fundo (cor do personagem escurecida) ─────────────────
  const chars = COMBATE.contexto === 'arena' ? (AR?.chars || []) : (RPG_DATA?.characters || []);
  const char  = chars.find(c => c.nome === COMBATE.atacanteNome);
  const cor   = char?.custom_attrs?.cor || char?.cor || '#4fa3d1';
  const bgEscuro = _atkDarkenColor(cor, 0.45);
  const box = document.getElementById('atk-anim-trigger-box');
  if (box) box.style.background = bgEscuro;
  const arrow = document.getElementById('atk-anim-trigger-arrow');
  if (arrow) arrow.style.borderTopColor = bgEscuro;

  // ── Posicionar acima do token do atacante ───────────────────────
  const tokenEl = resolverTokenEl(COMBATE.atacanteNome, COMBATE.contexto);
  const mapaEl  = document.getElementById('mapa-img');
  if (tokenEl && mapaEl) {
    const tokenRect = tokenEl.getBoundingClientRect();
    const mapaRect  = mapaEl.getBoundingClientRect();
    const leftPct   = ((tokenRect.left + tokenRect.width / 2 - mapaRect.left) / mapaRect.width)  * 100;
    const topPct    = ((tokenRect.top                         - mapaRect.top)  / mapaRect.height) * 100;
    el.style.left = `${Math.min(Math.max(leftPct, 15), 85)}%`;
    el.style.top  = `${Math.max(topPct, 18)}%`;
  } else {
    el.style.left = '50%';
    el.style.top  = '38%';
  }

  // ── Painel de ações (desktop ou sidebar) para confirmação ────────
  const _trigDesktop = document.getElementById('mesa-acao-painel');
  const _trigSidebar = _trigDesktop || document.getElementById('atk-sidebar-trigger');
  if (_trigSidebar) {
    const ehCura2 = COMBATE.habilidadeSel?.tipo_dano === 'cura';
    const danoTotal2 = COMBATE.dadosRolados?.total ?? null;
    const nomeAtk2 = COMBATE.habilidadeSel?.habilidade || COMBATE.habilidadeSel?.nome || '⚔ Ataque';
    _trigSidebar.innerHTML =
      '<div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--destaque);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">🎯 Confirmar</div>' +
      (ehCritico ? '<div style="font-family:var(--fonte-d);font-size:0.7rem;color:#f0cc6a;text-align:center;margin-bottom:4px">⚡ CRÍTICO! ' + (criticoTexto||'') + '</div>' : '') +
      '<div style="font-family:var(--fonte-d);font-size:0.85rem;color:var(--texto);margin-bottom:3px">' + nomeAtk2 + '</div>' +
      (danoTotal2 != null ? '<div style="font-family:var(--fonte-d);font-size:1.4rem;color:' + (ehCura2?'#5ee09a':'#f0cc6a') + ';text-align:center;margin:4px 0">' + danoTotal2 + (ehCura2?' cura':' dano') + '</div>' : '') +
      '<div style="font-size:0.6rem;color:var(--suave);text-align:center;margin-bottom:8px">Auto em <span id="atk-sb-trig-seg">10</span>s</div>' +
      '<button onclick="_atkTriggerAnimacao()" style="width:100%;padding:10px;background:linear-gradient(135deg,#9b2020,#c0392b);border:none;border-radius:8px;color:#fff;font-family:var(--fonte-d);font-size:0.72rem;cursor:pointer;text-transform:uppercase;letter-spacing:.08em">⚔ Confirmar ataque</button>' +
      '<button onclick="mapaAtaqueFechar();fecharModalAtaque()" style="width:100%;margin-top:5px;padding:7px;background:none;border:1px solid var(--borda);border-radius:8px;color:var(--suave);font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer">Cancelar</button>';
    _trigSidebar.style.display = 'block';
    el.style.display = 'none'; // ocultar overlay do mapa
  }

  // ── Contagem regressiva ─────────────────────────────────────────
  _atkAnimTriggerSeg = 10;
  const segEl = document.getElementById('atk-anim-trigger-seg');
  if (segEl) segEl.textContent = _atkAnimTriggerSeg;
  // Só exibir overlay no mapa se sidebar indisponível
  if (!_trigSidebar) el.style.display = 'block';
  clearInterval(_atkAnimTriggerTimer);

  // ── Broadcast: todos veem o card instantaneamente ───────────────
  combateBroadcast('trigger_mostrar', {
    atacanteNome: COMBATE.atacanteNome,
    alvoNome:     COMBATE.alvoNome || null,
    contexto:     COMBATE.contexto,
    nomeAtaque,
    danoTotal,
    efeitos,
    cor,
    ehCritico,
    criticoTexto: ehCritico ? criticoTexto : null,
    ehPositivo,
    ehCura,
  });

  _atkAnimTriggerTimer = setInterval(() => {
    _atkAnimTriggerSeg--;
    const s = document.getElementById('atk-anim-trigger-seg');
    if (s) s.textContent = _atkAnimTriggerSeg;
    const s2 = document.getElementById('atk-sb-trig-seg');
    if (s2) s2.textContent = _atkAnimTriggerSeg;
    if (_atkAnimTriggerSeg <= 0) _atkTriggerAnimacao();
  }, 1000);
}

function _atkOcultarTrigger() {
  clearInterval(_atkAnimTriggerTimer);
  const el = document.getElementById('atk-anim-trigger');
  if (el) el.style.display = 'none';
  const sb = document.getElementById('atk-sidebar-trigger');
  if (sb) sb.style.display = 'none';
  combateBroadcast('trigger_ocultar', {});
}

// ── Exibe o card de trigger para espectadores (somente visual, sem clique) ──
function _atkMostrarTriggerRemoto(p) {
  const el = document.getElementById('atk-anim-trigger');
  if (!el) return;

  document.getElementById('atk-anim-trigger-nome').textContent = p.nomeAtaque || '⚔ Ataque';
  const danoEl = document.getElementById('atk-anim-trigger-dano');
  danoEl.textContent = p.danoTotal != null ? (p.ehCura ? `${p.danoTotal} cura` : `${p.danoTotal} dano`) : '';
  danoEl.style.display = p.danoTotal != null ? 'block' : 'none';
  danoEl.style.color = p.ehCura ? '#5ee09a' : '#f0cc6a';
  const efEl = document.getElementById('atk-anim-trigger-efeitos');
  efEl.textContent = p.efeitos || '';
  efEl.style.display = p.efeitos ? 'block' : 'none';

  // Badge de crítico para espectadores
  const criticoEl = document.getElementById('atk-anim-trigger-critico');
  if (criticoEl) {
    if (p.ehCritico) {
      criticoEl.textContent = p.ehPositivo ? `✨ CRÍTICO! ${p.criticoTexto || ''}` : `⚡ CRÍTICO! ${p.criticoTexto || ''}`;
      criticoEl.style.display = 'block';
      criticoEl.style.background = p.ehPositivo
        ? 'linear-gradient(135deg,rgba(94,224,154,0.35),rgba(20,180,100,0.35))'
        : 'linear-gradient(135deg,rgba(240,180,20,0.35),rgba(255,120,0,0.35))';
      criticoEl.style.borderColor = p.ehPositivo ? 'rgba(94,224,154,0.6)' : 'rgba(240,180,20,0.6)';
    } else {
      criticoEl.style.display = 'none';
    }
  }

  const bgEscuro = _atkDarkenColor(p.cor || '#4fa3d1', 0.45);
  const box = document.getElementById('atk-anim-trigger-box');
  if (box) { box.style.background = bgEscuro; box.style.pointerEvents = 'none'; }
  const arrow = document.getElementById('atk-anim-trigger-arrow');
  if (arrow) arrow.style.borderTopColor = bgEscuro;

  // Posicionar acima do token do atacante (posição local de cada tela)
  const tokenEl = resolverTokenEl(p.atacanteNome, p.contexto);
  const mapaEl  = document.getElementById('mapa-img');
  if (tokenEl && mapaEl) {
    const tokenRect = tokenEl.getBoundingClientRect();
    const mapaRect  = mapaEl.getBoundingClientRect();
    const leftPct   = ((tokenRect.left + tokenRect.width / 2 - mapaRect.left) / mapaRect.width)  * 100;
    const topPct    = ((tokenRect.top                         - mapaRect.top)  / mapaRect.height) * 100;
    el.style.left = `${Math.min(Math.max(leftPct, 15), 85)}%`;
    el.style.top  = `${Math.max(topPct, 18)}%`;
  } else {
    el.style.left = '50%';
    el.style.top  = '38%';
  }
  el.style.display = 'block';
}

async function _atkTriggerAnimacao() {
  _atkOcultarTrigger();
  await _atkRodarAnimacao();
  await _atkAplicarDanoFinal();
  fecharModalAtaque();
  // Re-render action panel após animação concluída
  setTimeout(() => _mesaRenderAcoes?.(), 200);
}

// ── 18H: Habilidades de NPC ───────────────────────────────────
function atkRenderHabilidadesNPC(habilidades) {
  const el = document.getElementById('ar-char-habilidades-lista');
  if (!el) return;
  el.innerHTML = (habilidades || []).map((h, i) => `
    <div style="background:rgba(20,12,12,0.8);border:1px solid rgba(60,30,30,0.5);border-radius:6px;padding:8px 10px;font-size:0.82rem">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-family:'Cinzel',serif;color:#e8604c">${h.nome}</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${h.formula_dano ? `<span style="font-size:0.7rem;color:#f0cc6a">${h.formula_dano}</span>` : ''}
          <button onclick="atkRemoverHabilidadeNPC(${i})" style="background:none;border:none;color:#e74c3c55;font-size:0.8rem;cursor:pointer">✕</button>
        </div>
      </div>
      ${h.efeito ? `<div style="font-size:0.75rem;color:#9a8888;margin-top:2px">${h.efeito.slice(0,60)}${h.efeito.length>60?'…':''}</div>` : ''}
    </div>
  `).join('') || '<div style="color:#7a6060;font-style:italic;font-size:0.8rem">Nenhuma habilidade cadastrada</div>';
}

function atkAdicionarHabilidadeNPC() {
  const nome = prompt('Nome da habilidade:');
  if (!nome) return;
  const formula  = prompt('Fórmula de dano (ex: 2d6, 1d8+3 — deixe vazio para nenhum):') || null;
  const efeito   = prompt('Descrição do efeito (opcional):') || '';
  const efNome   = prompt('Nome do efeito automático (deixe vazio se não houver):') || null;
  let efeito_auto = null;
  if (efNome) {
    const tipo   = prompt('Tipo do efeito (buff/debuff/neutro):') || 'debuff';
    const turnos = parseInt(prompt('Duração em turnos:')) || 3;
    const mod    = parseInt(prompt('Modificador de dano (%):')) || 0;
    efeito_auto  = { nome: efNome, tipo, descricao: efeito, turnos, mod_dano: mod };
  }
  NPC_HABILIDADES_TEMP.push({ id: 'h_' + Date.now(), nome, formula_dano: formula || null, efeito, efeito_auto, tipo_dano: 'fisico' });
  atkRenderHabilidadesNPC(NPC_HABILIDADES_TEMP);
}

function atkRemoverHabilidadeNPC(idx) {
  NPC_HABILIDADES_TEMP.splice(idx, 1);
  atkRenderHabilidadesNPC(NPC_HABILIDADES_TEMP);
}


// ─── Map Campaign Section (lines 11501-16894 in app.js) ───────────────────


// ── MAPA: funções de hierarquia ───────────────────────────────

// Retorna todos os mapas filhos diretos de um map_id
function mapaFilhos(parentId) {
  return (RPG_DATA.mapas||[]).filter(l => l.mapa.parent_map_id === parentId);
}

// Retorna a zona de um mapa filho dentro do pai
function mapaZonaNoParent(childMapId) {
  const parent = (RPG_DATA.mapas||[]).find(l =>
    (l.mapa.locais||[]).some(z => z.mapa_local_id === childMapId));
  if (!parent) return null;
  return parent.mapa.locais.find(z => z.mapa_local_id === childMapId) || null;
}

// Projeta a posição (x,y) de um mapa filho para as coordenadas do pai
// zona: { x, y, zona_w_percent, zona_h_percent } — centro e tamanho em %
function projetarPosicaoNoParent(posX, posY, zona) {
  if (!zona) return null;
  const w = zona.zona_w_percent || zona.raio_percent || 8;
  const h = zona.zona_h_percent || (w * 0.75);
  // posX/posY são % dentro do filho (0-100) → projetar para % do pai
  const px = zona.x + (posX - 50) / 100 * w;
  const py = zona.y + (posY - 50) / 100 * h;
  return { x: Math.max(0, Math.min(100, px)), y: Math.max(0, Math.min(100, py)) };
}

// Retorna a posição projetada de um personagem em qualquer mapa ancestral
// Retorna null se o personagem não está nesse mapa nem em descendentes
// ── 1.1 MIGRAÇÃO: normaliza posição do formato antigo {x,y}% para novo {col,row} ──
function normalizarPosicao(pos, mapa) {
  if (!pos) return null;
  if (pos.col !== undefined && pos.row !== undefined) return pos; // já novo formato
  if (pos.x === undefined || pos.y === undefined) return null;
  const largura = mapa?.largura_total || 20;
  const altura  = mapa?.altura_total  || 20;
  return {
    col: Math.max(0, Math.round((pos.x / 100) * largura)),
    row: Math.max(0, Math.round((pos.y / 100) * altura))
  };
}

// ── Helper: converte porcentagem % para célula {col,row} ──────────────────────
function pctParaCelula(x, y, mapId) {
  const mapa = _getMapaById(mapId);
  const largura = mapa?.largura_total || 20;
  const altura  = mapa?.altura_total  || 20;
  return {
    col: Math.max(0, Math.round((x / 100) * largura)),
    row: Math.max(0, Math.round((y / 100) * altura))
  };
}

// ── Helper: obter mapa pelo map_id ─────────────────────────────────────────
function _getMapaById(mapId) {
  return (RPG_DATA?.mapas || []).find(l => l.mapa.map_id === mapId)?.mapa || null;
}


// ── 1.3 — helpers de imagem separados ────────────────────────────────────────
function _imgToken(ca) {
  return ca?.img_retrato || ca?.aparencia?.img_frente || ca?.img || ca?.img_url || '';
}
function _imgFicha(ca) {
  return ca?.img_full || ca?.img || ca?.img_url || '';
}

function getPosicaoNoMapa(char, targetMapId) {
  const activeId = char.active_map_id;
  if (!activeId) return null;

  // Posição direta (normaliza formato antigo automaticamente)
  if (activeId === targetMapId) {
    const raw = (char.map_positions || {})[targetMapId] || null;
    return normalizarPosicao(raw, _getMapaById(targetMapId));
  }

  // Verificar se está num mapa filho (recursivo)
  function projetar(fromMapId) {
    const zona = mapaZonaNoParent(fromMapId);
    if (!zona) return null;
    const parentEntry = (RPG_DATA.mapas||[]).find(l =>
      (l.mapa.locais||[]).some(z => z.mapa_local_id === fromMapId));
    if (!parentEntry) return null;
    const parentId = parentEntry.mapa.map_id;

    // Posição do char no fromMap
    let posNoFrom = null;
    if (activeId === fromMapId) {
      posNoFrom = (char.map_positions || {})[fromMapId] || null;
    } else {
      // Recursão: projetar desde o mapa ativo até fromMapId
      posNoFrom = projetar2(activeId, fromMapId);
    }
    if (!posNoFrom) return null;
    const posNoParent = projetarPosicaoNoParent(posNoFrom.x, posNoFrom.y, zona);
    if (parentId === targetMapId) return posNoParent;
    // Subir mais um nível
    if (posNoParent) return projetar(parentId);
    return null;
  }

  function projetar2(fromId, toId) {
    if (fromId === toId) return (char.map_positions || {})[fromId] || null;
    const zona = mapaZonaNoParent(fromId);
    if (!zona) return null;
    const posNoFrom = (char.map_positions || {})[fromId] || null;
    if (!posNoFrom) return null;
    const parentEntry = (RPG_DATA.mapas||[]).find(l =>
      (l.mapa.locais||[]).some(z => z.mapa_local_id === fromId));
    if (!parentEntry) return null;
    const parentId = parentEntry.mapa.map_id;
    const posNoParent = projetarPosicaoNoParent(posNoFrom.x, posNoFrom.y, zona);
    if (!posNoParent) return null;
    if (parentId === toId) return posNoParent;
    return projetar2(parentId, toId);
  }

  // Verificar se activeId é descendente de targetMapId
  function isDescendente(childId, ancestorId) {
    const zona = mapaZonaNoParent(childId);
    if (!zona) return false;
    const parentEntry = (RPG_DATA.mapas||[]).find(l =>
      (l.mapa.locais||[]).some(z => z.mapa_local_id === childId));
    if (!parentEntry) return false;
    const pid = parentEntry.mapa.map_id;
    if (pid === ancestorId) return true;
    return isDescendente(pid, ancestorId);
  }

  if (isDescendente(activeId, targetMapId)) {
    return projetar2(activeId, targetMapId);
  }
  return null;
}

// Setar posição ativa de um personagem (move para o mapa atual)
async function setCharActiveMap(charNome, mapId, x, y) {
  const c = RPG_DATA.characters.find(ch => ch.nome === charNome);
  if (!c) return;
  if (!c.map_positions) c.map_positions = {};
  c.active_map_id = mapId;
  // 1.1 - salvar no novo formato {col, row}
  const mapaObj = _getMapaById(mapId);
  const largura = mapaObj?.largura_total || 20;
  const altura  = mapaObj?.altura_total  || 20;
  const col = (typeof x === 'number' && x <= 1)
    ? Math.round(x * largura)
    : (x > 1 ? Math.round((x / 100) * largura) : Math.round(x));
  const row = (typeof y === 'number' && y <= 1)
    ? Math.round(y * altura)
    : (y > 1 ? Math.round((y / 100) * altura) : Math.round(y));
  c.map_positions[mapId] = { col, row };
  try {
    await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(charNome)}`,
      { method:'PATCH', body: JSON.stringify({ active_map_id: mapId, map_positions: c.map_positions }) });
  } catch(e) {}
}

async function removeCharFromMap(charNome) {
  const c = RPG_DATA.characters.find(ch => ch.nome === charNome);
  if (!c) return;
  const mapaId = MAPA_STATE.mapaAtualId;
  // Remove posição do mapa atual
  if (c.map_positions) delete c.map_positions[mapaId];
  // Se active_map_id era este mapa, limpa
  if (c.active_map_id === mapaId) c.active_map_id = null;
  try {
    await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(charNome)}`,
      { method:'PATCH', body: JSON.stringify({ active_map_id: c.active_map_id, map_positions: c.map_positions }) });
  } catch(e) {}
  const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === mapaId);
  if (entry) mapaRenderTokens(entry.mapa);
  mapaRenderStatus();
}

// Exclui um personagem do banco + estado local + re-render
// isGenerico=true: confirmação mais rápida, usado direto do mapa
// isGenerico=false: confirmação explícita, apenas dentro do edit
async function excluirPersonagemCompleto(nome, isGenerico) {
  // NPCs genéricos mortos em combate são excluídos automaticamente sem confirmação
  if (!isGenerico) {
    const msg = `Excluir permanentemente "${nome}"? Esta ação não pode ser desfeita.`;
    if (!confirm(msg)) return;
  }
  const rpgId = RPG_DATA.rpgId;
  try {
    await sb(`characters?rpg_id=eq.${encodeURIComponent(rpgId)}&nome=eq.${encodeURIComponent(nome)}`, { method: 'DELETE' });
  } catch(e) {}
  RPG_DATA.characters = (RPG_DATA.characters || []).filter(c => c.nome !== nome);
  // Remove de batalhas ativas
  Object.values(MAPA_STATE.batalhas || {}).forEach(b => {
    if (b.participantes) b.participantes = b.participantes.filter(p => p.nome !== nome);
    if (b.iniciativasRoladas) delete b.iniciativasRoladas[nome];
  });
  // Re-render
  const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
  if (entry) mapaRenderTokens(entry.mapa);
  mapaRenderStatus();
  if (typeof renderAttrButtons === 'function') renderAttrButtons();
  // Atualiza seletores de personagens
  const rowChar = document.getElementById('char-select-row');
  if (rowChar) rowChar.innerHTML = buildCharBtns('char') + `<button class="char-btn" onclick="abrirModalNovoChar()" style="border-style:dashed;color:var(--suave)" title="Criar personagem ou NPC">＋</button>`;
  mostrarToast(`${nome} excluído.`, '');
  // Fecha o painel se estava aberto
  if (CHAR_VIEW === nome) { CHAR_VIEW = null; document.getElementById('char-view').innerHTML = ''; }
  if (ATTR_VIEW === nome) { ATTR_VIEW = null; document.getElementById('attr-view').innerHTML = ''; }
}

// Alias de conveniência usado no auto-delete por HP=0
async function excluirNpcGenerico(nome) {
  return excluirPersonagemCompleto(nome, true);
}

async function resetarHpNpcGenerico(nome) {
  const c = (RPG_DATA.characters||[]).find(ch => ch.nome === nome);
  if (!c) return;
  const hpMax = c.custom_attrs?.hp_max ?? 30;
  c.hp_atual = hpMax;
  try { await saveCharacterStats(RPG_DATA.rpgId, nome, { hp_atual: hpMax }); } catch(e) {}
  mapaRenderStatus();
  mostrarToast(`${nome}: HP restaurado (${hpMax})`, '');
}

function ativarModoPlacement(localMapId, localMapNome, zonaW, zonaH) {
  PLACEMENT_STATE = { localMapId, localMapNome, zonaW: zonaW||15, zonaH: zonaH||15 };
  const hint = document.getElementById('mapa-placement-hint');
  if (hint) { hint.style.display = 'flex'; hint.querySelector('span').textContent = `Clique no mapa para posicionar "${localMapNome}"`; }
  document.getElementById('mapa-wrap').classList.add('placement-ativo');
  mostrarToast(`Clique no mapa geral para posicionar "${localMapNome}"`, '');
}

function cancelarPlacement() {
  PLACEMENT_STATE = null;
  const hint = document.getElementById('mapa-placement-hint');
  if (hint) hint.style.display = 'none';
  document.getElementById('mapa-wrap').classList.remove('placement-ativo');
}

async function confirmarPlacement(x, y) {
  if (!PLACEMENT_STATE) return;
  const { localMapId, localMapNome, zonaW, zonaH } = PLACEMENT_STATE;
  cancelarPlacement();

  // Atualizar mapa local com posição e dimensões
  const localEntry = RPG_DATA.mapas.find(l => l.mapa.map_id === localMapId);
  if (localEntry) {
    localEntry.mapa.zona_x = x;
    localEntry.mapa.zona_y = y;
    localEntry.mapa.zona_w_percent = zonaW;
    localEntry.mapa.zona_h_percent = zonaH;
    try {
      // Preferir id numérico; se null (mapa recém-criado sem return=representation), usar map_id
      const patchUrl = localEntry.id
        ? `mapas?id=eq.${encodeURIComponent(localEntry.id)}`
        : `mapas?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&map_id=eq.${encodeURIComponent(localMapId)}`;
      await sb(patchUrl,
        { method:'PATCH', body:JSON.stringify({
          zona_x:x, zona_y:y, zona_w_percent:zonaW, zona_h_percent:zonaH,
          largura_real: localEntry.mapa.largura_real||null,
          altura_real: localEntry.mapa.altura_real||null,
          representar_pct: localEntry.mapa.representar_pct||null,
        }) });
    } catch(e) {}
  }

  // Criar/atualizar zona no mapa pai linkando para este local
  const parentEntry = RPG_DATA.mapas.find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
  if (parentEntry) {
    if (!parentEntry.mapa.locais) parentEntry.mapa.locais = [];
    parentEntry.mapa.locais = parentEntry.mapa.locais.filter(l => l.mapa_local_id !== localMapId);
    parentEntry.mapa.locais.push({
      local_id:         localMapId,
      nome:             localMapNome,
      x:                parseFloat(x.toFixed(1)),
      y:                parseFloat(y.toFixed(1)),
      zona_w_percent:   zonaW,
      zona_h_percent:   zonaH,
      raio_percent:     zonaW, // compat
      raio:             Math.round(zonaW * 4),
      mapa_local_id:    localMapId,
      largura_real:     localEntry?.mapa?.largura_real||null,
      altura_real:      localEntry?.mapa?.altura_real||null,
      representar_pct:  localEntry?.mapa?.representar_pct||null,
    });
    try {
      await sb(`mapas?id=eq.${encodeURIComponent(parentEntry.id)}`,
        { method:'PATCH', body:JSON.stringify({ locais:parentEntry.mapa.locais }) });
    } catch(e) {}
    renderMapaViewer();
    mostrarToast(`"${localMapNome}" posicionado no mapa!`, 'sucesso');
  }
}

// ── 14F: MAPAS — Zonas de transição ──────────────────────────
function toggleMapaTool(modo) {
  const isActive = MAPA_STATE.toolMode === modo;
  MAPA_STATE.toolMode = isActive ? null : modo;
  // Atualizar botões
  document.querySelectorAll('.mapa-tool-btn').forEach(b => b.classList.remove('ativo'));
  if (MAPA_STATE.toolMode) {
    const btnMap = { medicao: 'mapa-tool-med', zonas: 'mapa-tool-zonas', paredes: 'mapa-tool-paredes' };
    const btn = document.getElementById(btnMap[MAPA_STATE.toolMode] || '');
    if (btn) btn.classList.add('ativo');
  }
  // Reset primeiroPonto ao trocar de modo
  if (typeof WALLS_STATE !== 'undefined') WALLS_STATE.primeroPonto = null;
  // Hints
  const hintMed = document.getElementById('mapa-tool-hint');
  const hintZon = document.getElementById('mapa-tool-zonas-hint');
  const hintPar = document.getElementById('mapa-tool-paredes-hint');
  if (hintMed) hintMed.style.display = MAPA_STATE.toolMode === 'medicao' ? 'block' : 'none';
  if (hintZon) hintZon.style.display = MAPA_STATE.toolMode === 'zonas' ? 'block' : 'none';
  if (hintPar) hintPar.style.display = MAPA_STATE.toolMode === 'paredes' ? 'block' : 'none';
  // Limpar medição ao sair do modo
  if (MAPA_STATE.toolMode !== 'medicao') {
    MAPA_STATE.medicaoAtiva = null;
    const svg = document.getElementById('mapa-dist-svg');
    if (svg) svg.innerHTML = '';
  }
  // Re-renderizar zonas com/sem handles de edição
  const mapas = RPG_DATA.mapas || [];
  const entry = mapas.find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
  if (entry) mapaRenderTokens(entry.mapa);
}

function abrirModalZona(localId, x, y) {
  const overlay = document.getElementById('modal-zona-overlay');
  document.getElementById('zona-pos-x').value = x || 50;
  document.getElementById('zona-pos-y').value = y || 50;
  const mapas = RPG_DATA.mapas || [];
  const entry = mapas.find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
  if (!entry) return;
  const local = localId ? (entry.mapa.locais || []).find(l => l.local_id === localId) : null;
  document.getElementById('modal-zona-titulo').textContent = local ? 'Editar Zona' : 'Nova Zona de Transição';
  document.getElementById('zona-local-id').value = localId || '';
  document.getElementById('zona-id').value = local ? local.local_id : '';
  document.getElementById('zona-nome').value = local ? local.nome : '';
  document.getElementById('zona-destino').value = local ? (local.mapa_local_id || '') : '';
  document.getElementById('zona-raio').value = local ? (local.raio || 20) : 20;
  document.getElementById('btn-remover-zona').style.display = local ? '' : 'none';
  overlay.style.display = 'flex';
  overlay.onclick = e => { if (e.target === overlay) fecharModalZona(); };
}
function fecharModalZona() {
  document.getElementById('modal-zona-overlay').style.display = 'none';
}
async function salvarZona() {
  const localIdOrig = document.getElementById('zona-local-id').value;
  const local_id = document.getElementById('zona-id').value.trim().replace(/\s+/g,'_');
  const nome = document.getElementById('zona-nome').value.trim();
  if (!local_id || !nome) { mostrarToast('ID e nome obrigatórios', 'erro'); return; }
  const mapas = RPG_DATA.mapas || [];
  const entry = mapas.find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
  if (!entry) return;
  if (!entry.mapa.locais) entry.mapa.locais = [];
  const novaZona = {
    local_id,
    nome,
    x: parseFloat(document.getElementById('zona-pos-x').value) || 50,
    y: parseFloat(document.getElementById('zona-pos-y').value) || 50,
    raio: parseInt(document.getElementById('zona-raio').value) || 20,
    mapa_local_id: document.getElementById('zona-destino').value.trim() || null
  };
  if (localIdOrig) {
    const idx = entry.mapa.locais.findIndex(l => l.local_id === localIdOrig);
    if (idx >= 0) entry.mapa.locais[idx] = novaZona; else entry.mapa.locais.push(novaZona);
  } else {
    entry.mapa.locais.push(novaZona);
  }
  try {
    await sb(`mapas?id=eq.${encodeURIComponent(entry.id)}`, {
      method:'PATCH', body:JSON.stringify({ locais:entry.mapa.locais })
    });
    fecharModalZona();
    renderMapaViewer();
    mostrarToast('Zona salva!', 'sucesso');
  } catch(e) { mostrarToast('Erro ao salvar zona', 'erro'); }
}
async function removerZona() {
  const localId = document.getElementById('zona-local-id').value;
  if (!localId || !confirm('Remover esta zona?')) return;
  const mapas = RPG_DATA.mapas || [];
  const entry = mapas.find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
  if (!entry) return;
  entry.mapa.locais = (entry.mapa.locais || []).filter(l => l.local_id !== localId);
  try {
    await sb(`mapas?id=eq.${encodeURIComponent(entry.id)}`, {
      method:'PATCH', body:JSON.stringify({ locais:entry.mapa.locais })
    });
    fecharModalZona();
    renderMapaViewer();
    mostrarToast('Zona removida', 'sucesso');
  } catch(e) { mostrarToast('Erro ao remover zona', 'erro'); }
}

// ── DADOS ─────────────────────────────────────────────────────
function renderDados(){
  const ativos = getDiceConfig(RPG_DATA.rpgId);
  document.getElementById('dado-grid').innerHTML=ativos.map(d=>`<button class="dado-btn" onclick="selecionarDado(${d},this)"><svg class="dado-icone" viewBox="0 0 40 40" fill="none">${svgDado(d)}</svg><span class="dado-label">d${d}</span></button>`).join('');
}
function renderDiceConfig(){
  const rpgId=RPG_DATA.rpgId;
  const ativos=getDiceConfig(rpgId);
  const el=document.getElementById('cfg-dice-grid');
  if(!el) return;
  el.innerHTML=TIPOS_DADO.map(d=>{
    const on=ativos.includes(d);
    return `<button onclick="toggleDadoCampanha(${d})" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px;border-radius:8px;border:1px solid ${on?'var(--primario)':'var(--borda)'};background:${on?'rgba(79,163,209,0.12)':'transparent'};cursor:pointer;transition:all 0.2s;color:${on?'var(--primario)':'var(--suave)'}">
      <svg viewBox="0 0 40 40" fill="none" style="width:28px;height:28px">${svgDado(d)}</svg>
      <span style="font-family:var(--fonte-d);font-size:0.62rem">d${d}</span>
    </button>`;
  }).join('');
}
function toggleDadoCampanha(d){
  const rpgId=RPG_DATA.rpgId;
  let ativos=getDiceConfig(rpgId);
  if(ativos.includes(d)){
    if(ativos.length<=1){mostrarToast('Mínimo 1 dado ativo','erro');return;}
    ativos=ativos.filter(x=>x!==d);
  } else {
    ativos=[...ativos,d].sort((a,b)=>a-b);
  }
  setDiceConfig(rpgId,ativos);
  renderDiceConfig();
  renderDados();
}
function svgDado(d){const s=`stroke="var(--primario)" stroke-width="1.5"`,t=`fill="var(--primario)" font-size="10" font-family="Cinzel,serif"`;if(d===4)return`<polygon points="20,4 36,34 4,34" fill="none" ${s}/><text x="20" y="28" text-anchor="middle" ${t}>4</text>`;if(d===6)return`<rect x="6" y="6" width="28" height="28" rx="4" fill="none" ${s}/><text x="20" y="26" text-anchor="middle" ${t}>6</text>`;if(d===8)return`<polygon points="20,3 37,20 20,37 3,20" fill="none" ${s}/><text x="20" y="26" text-anchor="middle" ${t}>8</text>`;if(d===10)return`<polygon points="20,3 35,15 30,35 10,35 5,15" fill="none" ${s}/><text x="20" y="27" text-anchor="middle" ${t}>10</text>`;if(d===20)return`<polygon points="20,2 38,12 38,28 20,38 2,28 2,12" fill="none" ${s}/><text x="20" y="26" text-anchor="middle" ${t}>20</text>`;return`<circle cx="20" cy="20" r="17" fill="none" ${s}/><text x="20" y="25" text-anchor="middle" font-size="9" font-family="Cinzel,serif" fill="var(--primario)">100</text>`;}
function selecionarDado(d,btn){DADO_SEL=d;document.querySelectorAll('.dado-btn').forEach(b=>b.classList.remove('selecionado'));btn.classList.add('selecionado');document.getElementById('resultado-tipo').textContent=`d${d} selecionado`;document.getElementById('resultado-critico').style.display='none';}
function rolarDado(){
 if(!DADO_SEL){mostrarToast('Selecione um dado','erro');return;}
 const r=Math.floor(Math.random()*DADO_SEL)+1,nEl=document.getElementById('resultado-num'),cEl=document.getElementById('resultado-critico');
 nEl.classList.remove('girar');void nEl.offsetWidth;nEl.classList.add('girar');nEl.textContent=r;
 document.getElementById('resultado-tipo').textContent=`d${DADO_SEL}`;
 cEl.style.display='none';cEl.className='resultado-critico';
 if(DADO_SEL===20&&r===20){cEl.style.display='inline-block';cEl.classList.add('critico-pos');cEl.textContent='Crítico Perfeito!';}
 else if(DADO_SEL===20&&r===1){cEl.style.display='inline-block';cEl.classList.add('critico-neg');cEl.textContent='Falha Crítica!';}
 HISTORICO.unshift({dado:DADO_SEL,num:r});if(HISTORICO.length>20)HISTORICO.pop();
 document.getElementById('historico-lista').innerHTML=HISTORICO.map(h=>{let tag='';if(h.dado===20&&h.num===20)tag=`<span class="hist-tag critico-pos">Crítico</span>`;if(h.dado===20&&h.num===1)tag=`<span class="hist-tag critico-neg">Falha</span>`;return`<div class="historico-item"><span class="hist-dado">d${h.dado}</span><span class="hist-num">${h.num}</span>${tag}</div>`;}).join('');
}




// ── MAPAS ─────────────────────────────────────────────────────
function renderMapasTab() {
  const mapas = RPG_DATA.mapas || [];
  const lista = document.getElementById('mapa-lista');
  if (!lista) return;

  if (!mapas.length) {
    lista.innerHTML = `<div style="color:var(--suave);font-style:italic;font-size:0.85rem;padding:8px 0">Nenhum mapa disponível</div>`;
    document.getElementById('mapa-tokens').innerHTML = '';
    document.getElementById('mapa-dist-svg').innerHTML = '';
    return;
  }

  lista.innerHTML = mapas.map(l => {
    const m = l.mapa;
    const isAtivo = m.map_id === MAPA_STATE.mapaAtualId;
    return `<div class="mapa-card${isAtivo?' ativo':''}" data-map-id="${m.map_id}" onclick="selecionarMapa('${m.map_id}')">
      ${m.tipo==='geral'?'🌍':'🏰'} ${m.nome||'Mapa'}
    </div>`;
  }).join('');

  // Controlar visibilidade dos elementos de batalha
  const wrap = document.getElementById('mapa-wrap');
  const isMestre = RPG_DATA?.myRole === 'mestre';

  _aplicarEstadoBatalhaUI();
  _atualizarBadgeMesa();
  _atualizarSeletorBatalhas();

  // Selecionar mapa inicial se nenhum ativo
  if (!MAPA_STATE.mapaAtualId && mapas.length) {
    const rpgId = RPG_DATA?.rpgId;

    // 1. Tentar restaurar mapa salvo no localStorage
    let mapaRestaurado = null;
    try {
      const salvo = localStorage.getItem('rpghub_mapa_' + rpgId);
      if (salvo && mapas.find(l => l.mapa.map_id === salvo)) mapaRestaurado = salvo;
    } catch(e) {}

    if (mapaRestaurado) {
      // Registrar geral antes de restaurar o local
      const entry = mapas.find(l => l.mapa.map_id === mapaRestaurado);
      if (entry?.mapa?.tipo === 'geral') MAPA_STATE.mapaGeralId = mapaRestaurado;
      else {
        // Encontrar o geral pai para manter a navegação correta
        const geral = mapas.find(l => l.mapa.tipo === 'geral');
        if (geral) MAPA_STATE.mapaGeralId = geral.mapa.map_id;
      }
      selecionarMapa(mapaRestaurado);
      return;
    }

    // 2. Sem histórico: para jogador, abrir o mapa mais local do personagem vinculado
    const charNome = RPG_DATA?.linked;
    if (charNome) {
      const char = (RPG_DATA.characters || []).find(c => c.nome === charNome);
      const activeMapId = char?.active_map_id;
      if (activeMapId && mapas.find(l => l.mapa.map_id === activeMapId)) {
        const geral = mapas.find(l => l.mapa.tipo === 'geral');
        if (geral) MAPA_STATE.mapaGeralId = geral.mapa.map_id;
        selecionarMapa(activeMapId);
        return;
      }
    }

    // 3. Fallback: selecionar primeiro mapa disponível
    const primeiro = mapas[0].mapa;
    if (primeiro.tipo === 'geral') MAPA_STATE.mapaGeralId = primeiro.map_id;
    selecionarMapa(primeiro.map_id);
  } else {
    renderMapaViewer();
  }
}

function selecionarMapa(mapId) {
  const mapas = RPG_DATA.mapas || [];
  const entry = mapas.find(l => l.mapa.map_id === mapId);
  if (!entry) return;
  MAPA_STATE.mapaAtualId = mapId;
  MAPA_STATE.medicaoAtiva = null;
  const m = entry.mapa;
  if (m.tipo === 'geral') MAPA_STATE.mapaGeralId = mapId;

  // Limpar botões contextuais ao trocar de mapa
  _ctxSidebarLimpar?.();

  // Resetar zoom ao trocar de mapa
  mapaZoomReset();

  // Persistir mapa selecionado para restaurar ao recarregar
  try {
    const rpgId = RPG_DATA?.rpgId;
    if (rpgId) localStorage.setItem('rpghub_mapa_' + rpgId, mapId);
  } catch(e) {}

  // Ao trocar de mapa, BATALHA_ATUAL_ID deve refletir apenas o mapa atual.
  // Batalhas de outros mapas ficam ocultas — exibidas só como notificação.
  const bNovoMapa = batalhaDoMapa(mapId);
  BATALHA_ATUAL_ID = bNovoMapa
    ? Object.keys(MAPA_STATE.batalhas).find(k => MAPA_STATE.batalhas[k] === bNovoMapa) || null
    : null;

  // Atualizar seleção visual
  document.querySelectorAll('.mapa-card').forEach(el => {
    el.classList.toggle('ativo', el.dataset.mapId === m.map_id);
  });

  // Breadcrumb
  const bc = document.getElementById('mapa-breadcrumb');
  const bcLocal = document.getElementById('mapa-bc-local');
  if (mapaIsTatico(m)) {
    bc.style.display = 'flex';
    if (bcLocal) bcLocal.textContent = m.nome;
  } else {
    bc.style.display = 'none';
  }

  renderMapaViewer();
  _aplicarEstadoBatalhaUI();
  _atualizarSeletorBatalhas();
}

function renderMapaViewer() {
  const mapas = RPG_DATA.mapas || [];
  const entry = mapas.find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
  if (!entry) return;
  const m = entry.mapa;

  // ── IMAGEM DE FUNDO ──────────────────────────────────────────────────────
  const imgDiv = document.getElementById('mapa-img');

  // Remover isoWrap legado se existir
  const _legacyWrap = imgDiv.querySelector('.mapa-iso-wrap');
  if (_legacyWrap) _legacyWrap.remove();

  let existingImg = imgDiv.querySelector('img.mapa-bg-img');
  if (!existingImg) {
    existingImg = document.createElement('img');
    existingImg.className = 'mapa-bg-img';
    imgDiv.insertBefore(existingImg, imgDiv.firstChild);
  }

  if (m.img_url) {
    existingImg.src = normalizeImgUrl(m.img_url);
    existingImg.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%;object-fit:cover;image-rendering:-webkit-optimize-contrast;';
  } else {
    existingImg.src = '';
    existingImg.style.cssText = 'display:none';
    // Render procedural via canvas quando não há imagem mas há render_data
    if (m.render_data) {
      setTimeout(() => mapaRenderCanvas(m), 50);
    }
  }

  // Escala info
  const escInfo = document.getElementById('mapa-escala-info');
  if (escInfo) {
    const escalaText = m.escala_val ? `1 célula = ${m.escala_val} ${m.escala_unit||'m'}` : '';
    escInfo.innerHTML = escalaText;
  }

  // Grade
  mapaDesenharGrade(m);

  // Fog de guerra desativado — remover canvas se existir
  const _fogEx = document.getElementById('fog-canvas');
  if (_fogEx) _fogEx.remove();

  // Tokens
  mapaRenderTokens(m);

  // Status
  mapaRenderStatus();

  // Botões contextuais do personagem vinculado (mestre-jogador ou jogador)
  const _linkedCtx = RPG_DATA?.linked;
  if (_linkedCtx) {
    setTimeout(() => _ctxAtualizarPainelDesktop?.(_linkedCtx), 80);
  }

  // Click no fundo para medição / limpar / criar zona
  const wrap = document.getElementById('mapa-wrap');
  wrap.onclick = (e) => {
    if (e.target === wrap || e.target.id === 'mapa-img' || e.target.id === 'mapa-canvas') {
      // Modo placement de mapa local
      if (PLACEMENT_STATE) {
        const rect = wrap.getBoundingClientRect();
        const x = Math.max(2, Math.min(98, (e.clientX - rect.left) / rect.width * 100));
        const y = Math.max(2, Math.min(98, (e.clientY - rect.top)  / rect.height * 100));
        confirmarPlacement(x, y);
        return;
      }
      if (MAPA_STATE.toolMode === 'medicao' && MAPA_STATE.medicaoAtiva) { limparMedicaoMapa(); }
      else if (MAPA_STATE.toolMode === 'zonas') {
        // Criar nova zona no ponto clicado
        const rect = wrap.getBoundingClientRect();
        const x = Math.max(2, Math.min(98, (e.clientX - rect.left) / rect.width * 100));
        const y = Math.max(2, Math.min(98, (e.clientY - rect.top) / rect.height * 100));
        abrirModalZona(null, x.toFixed(1), y.toFixed(1));
      } else if (MAPA_STATE.toolMode === 'cenario_placement') {
        cenarioHandleMapaClick(e, wrap);
        return;
      } else if (MAPA_STATE.toolMode === 'paredes') {
        // Clique cria ponto de parede ou porta (shift=porta)
        const entry2 = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
        if (!entry2) return;
        const m2 = entry2.mapa;
        const rect2 = wrap.getBoundingClientRect();
        const canvas2 = document.getElementById('mapa-canvas');
        const W2 = canvas2?.offsetWidth || rect2.width;
        const H2 = canvas2?.offsetHeight || rect2.height;
        const cols2 = m2.largura_total || 20;
        const rows2 = m2.altura_total  || 20;
        const col = Math.floor(((e.clientX - rect2.left) / W2) * cols2);
        const row = Math.floor(((e.clientY - rect2.top)  / H2) * rows2);
        if (e.shiftKey) {
          portaAdicionar(col, row);
        } else {
          paredAdicionarPonto(col, row);
        }
      }
    }
  };

  // Inicializar zoom/pan (só uma vez); reaplicar zoom atual após cada render
  setTimeout(() => { mapaZoomInit(); mapaZoomApply(); }, 50);

  // Redesenhar grade ao redimensionar (somente uma instância por mapa)
  if (wrap && !wrap._resizeObserver) {
    wrap._resizeObserver = new ResizeObserver(() => {
      const entry = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
      if (entry) mapaDesenharGrade(entry.mapa);
    });
    wrap._resizeObserver.observe(wrap);
  }
}

// mapaAplicarTransform3D removido — sem suporte isométrico
function mapaAplicarTransform3D(wrapper) {
  if (!wrapper) return;
  wrapper.style.transform = '';
  wrapper.style.perspective = '';
  wrapper.style.perspectiveOrigin = '';
}

// Atualiza preview ao vivo e labels no modal de config 3D
function mp3dAtualizar() {
  const _get = id => parseFloat(document.getElementById(id)?.value ?? 0);
  const rx = _get('mp3d-rx'), ry = _get('mp3d-ry'), rz = _get('mp3d-rz');
  const persp = _get('mp3d-persp'), ox = _get('mp3d-ox'), oy = _get('mp3d-oy'), sc = _get('mp3d-sc');

  // Atualizar labels
  document.getElementById('mp3d-rx-val').textContent    = rx + '°';
  document.getElementById('mp3d-ry-val').textContent    = ry + '°';
  document.getElementById('mp3d-rz-val').textContent    = rz + '°';
  document.getElementById('mp3d-persp-val').textContent = persp >= 4000 ? '∞' : persp + 'px';
  document.getElementById('mp3d-ox-val').textContent    = ox + '%';
  document.getElementById('mp3d-oy-val').textContent    = oy + '%';
  document.getElementById('mp3d-sc-val').textContent    = (sc/100).toFixed(2) + '×';

  // Aplicar no preview
  const plane = document.getElementById('mp3d-preview-plane');
  if (plane) {
    const wrap = plane.parentElement;
    wrap.style.perspective = persp >= 4000 ? '' : `${persp}px`;
    wrap.style.perspectiveOrigin = '50% 50%';
    plane.style.transform = [
      `translateX(${ox}%)`,
      `translateY(${oy}%)`,
      `scale(${sc/100})`,
      `rotateZ(${rz}deg)`,
      `rotateX(${rx}deg)`,
      `rotateY(${ry}deg)`,
    ].join(' ');
  }

  // Desenhar grade de referência no preview
  const svg = document.getElementById('mp3d-grid-svg');
  if (svg) {
    const lines = [];
    for (let i = 1; i < 5; i++) {
      const pct = (i * 20) + '%';
      lines.push(`<line x1="${pct}" y1="0" x2="${pct}" y2="100%" stroke="rgba(126,200,240,0.25)" stroke-width="0.5"/>`);
      lines.push(`<line x1="0" y1="${pct}" x2="100%" y2="${pct}" stroke="rgba(126,200,240,0.25)" stroke-width="0.5"/>`);
    }
    svg.innerHTML = lines.join('');
  }

  // Aplicar também no mapa ao vivo se estiver aberto
  const entry = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === MAPA_STATE?.mapaAtualId);
  if (entry) {
    const liveWrap = document.querySelector('#mapa-img .mapa-iso-wrap');
    if (liveWrap) mapaAplicarTransform3D(liveWrap, {rx,ry,rz,persp,ox,oy,sc});
    // Profundidade nos tokens
    if (document.getElementById('mp3d-depth')?.checked) {
      document.querySelectorAll('.mapa-token').forEach(el => {
        const posY = parseFloat(el.style.top) || 50;
        const ds = (0.72 + (posY / 100) * 0.50).toFixed(3);
        el.style.transform = `translate(-50%,-50%) scale(${ds})`;
      });
    }
  }
}

// Presets rápidos de perspectiva
function mapaPreset3D(preset) {
  const sets = {
    flat:     { rx:0,   ry:0, rz:0,  persp:4000, ox:0, oy:0, sc:100 },
    dimetric: { rx:60,  ry:0, rz:45, persp:4000, ox:0, oy:0, sc:110 }, // Diablo 2:1 ~ 60° + 45° rot
    iso:      { rx:54,  ry:0, rz:45, persp:4000, ox:0, oy:0, sc:110 }, // arcsin(1/√3) ≈ 35.26° mas na css isso equivale a ~54°
    reset:    { rx:0,   ry:0, rz:0,  persp:4000, ox:0, oy:0, sc:100 },
  };
  const s = sets[preset];
  if (!s) return;
  const _set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  _set('mp3d-rx', s.rx);   _set('mp3d-ry', s.ry);  _set('mp3d-rz', s.rz);
  _set('mp3d-persp', s.persp); _set('mp3d-ox', s.ox); _set('mp3d-oy', s.oy); _set('mp3d-sc', s.sc);
  mp3dAtualizar();
}

// ════════════════════════════════════════════════════════════════════════════

function mapaDesenharGrade(m) {
  const canvas = document.getElementById('mapa-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.offsetWidth || canvas.parentElement?.offsetWidth || 0;
  const h = canvas.offsetHeight || canvas.parentElement?.offsetHeight || 0;
  if (!w || !h) return; // canvas ainda não renderizado — skip silencioso
  canvas.width = w; canvas.height = h;
  ctx.clearRect(0, 0, w, h);
  const grid = m.grid || 0;
  if (!grid) return;
  const isTatico  = mapaIsTatico(m);
  if (isTatico) {
    _drawIsoGrid(ctx, w, h, grid, 'rgba(126,200,240,0.13)');
  } else {
    // Grade ortogonal (H/V) — táticos e mapas gerais
    // Linhas alinhadas com as células para cada passo = 1 célula visual
    const cols = m.largura_total || Math.round(w / grid);
    const rows = m.altura_total  || Math.round(h / grid);
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
}

function mapaRenderTokens(m) {
  const tokensEl = document.getElementById('mapa-tokens');
  if (!tokensEl) return;
  // Remover aviso iso-legado se ainda existir no DOM
  const _oldAviso = document.getElementById('aviso-iso-legado');
  if (_oldAviso) _oldAviso.remove();
  const chars = RPG_DATA.characters || [];
  const mapId = MAPA_STATE.mapaAtualId;
  tokensEl.innerHTML = '';

  // ── helper: normaliza campo x/y aceitando tanto x quanto x_percent ──
  const _localX = l => l.x ?? l.x_percent ?? 0;
  const _localY = l => l.y ?? l.y_percent ?? 0;

  // ── helper: cria e appenda uma div de zona clicável ───────────────────
  function _criarZonaDiv(nome, posX, posY, wPct, hPct, raiopx, mapaLocalId, localId, isTool) {
    const zona = document.createElement('div');
    zona.className = 'mapa-zona';
    const isLocalMap = !!mapaLocalId;
    if (isLocalMap) {
      const w = wPct || 10, h = hPct || (w * 0.75);
      zona.style.cssText = `left:${posX}%;top:${posY}%;width:${w}%;height:${h}%;transform:translate(-50%,-50%);position:absolute`;
    } else {
      zona.style.cssText = `left:${posX}%;top:${posY}%;width:${raiopx*2}px;height:${raiopx*2}px;transform:translate(-50%,-50%);position:absolute`;
    }
    if (isTool) {
      zona.style.outline = '2px dashed var(--destaque)';
      zona.style.cursor = 'pointer';
      zona.innerHTML = `<span class="mapa-zona-label" style="color:var(--destaque)">${nome}</span>`;
      zona.onclick = (e) => { e.stopPropagation(); abrirModalZona(localId || '', posX, posY); };
    } else if (isLocalMap) {
      zona.style.cssText += `;background:rgba(200,168,75,0.08);border:1.5px solid rgba(200,168,75,0.4);border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;backdrop-filter:blur(1px)`;
      zona.innerHTML = `<span style="font-size:0.9rem">🏰</span><span style="font-family:var(--fonte-d);font-size:0.55rem;color:var(--destaque);text-align:center;line-height:1.2;padding:0 4px;text-shadow:0 1px 3px rgba(0,0,0,0.8)">${nome}</span>`;
      zona.title = `Entrar em ${nome}`;
      zona.onclick = (e) => { e.stopPropagation(); entrarMapaLocal(mapaLocalId); };
      zona.addEventListener('mouseenter', () => { zona.style.background = 'rgba(200,168,75,0.18)'; zona.style.borderColor = 'var(--destaque)'; });
      zona.addEventListener('mouseleave', () => { zona.style.background = 'rgba(200,168,75,0.08)'; zona.style.borderColor = 'rgba(200,168,75,0.4)'; });
    } else {
      zona.innerHTML = `<span class="mapa-zona-label">${nome}</span>`;
      zona.onclick = () => entrarMapaLocal(mapaLocalId);
    }
    tokensEl.appendChild(zona);
  }

  // ── 1. Zonas definidas em m.locais (criadas manualmente ou pelo schema) ─
  const poisJaCobertosPorLocal = new Set();
  (m.locais || []).forEach(local => {
    if (!local.mapa_local_id && MAPA_STATE.toolMode !== 'zonas') return;
    const posX  = _localX(local);
    const posY  = _localY(local);
    const wPct  = local.zona_w_percent || local.raio_percent || 10;
    const hPct  = local.zona_h_percent || (wPct * 0.75);
    const raiopx = local.raio || 20;
    _criarZonaDiv(local.nome, posX, posY, wPct, hPct, raiopx, local.mapa_local_id, local.local_id, MAPA_STATE.toolMode === 'zonas');
    // Marcar o mapa_local_id como já coberto para não duplicar via POIs
    if (local.mapa_local_id) poisJaCobertosPorLocal.add(local.mapa_local_id);
  });

  // ── 2. POIs do render_data que apontam para mapas filhos ──────────────
  // Permite clicar numa cidade desenhada no canvas mesmo sem zona manual
  const rd = m.render_data;
  if (rd && MAPA_STATE.toolMode !== 'zonas') {
    const mapas = RPG_DATA.mapas || [];
    (rd.pontos_de_interesse || []).forEach(poi => {
      // Descobrir map_id destino: campo direto ou buscar por nome
      const mapaLocalId = poi.mapa_local_id
        || mapas.find(l => l.mapa.nome === poi.nome || l.mapa.nome === poi.destino)?.mapa?.map_id
        || null;
      if (!mapaLocalId) return;
      if (poisJaCobertosPorLocal.has(mapaLocalId)) return; // já tem zona
      const posX = poi.x_percent ?? poi.x ?? 0;
      const posY = poi.y_percent ?? poi.y ?? 0;
      // Tamanho baseado no raio_tiles do POI: ~2× raio em %
      const raioTiles = poi.raio_tiles || 5;
      const wPct = Math.max(6, raioTiles * 1.8);
      const hPct = wPct * 0.75;
      _criarZonaDiv(poi.nome, posX, posY, wPct, hPct, 20, mapaLocalId, null, false);
      poisJaCobertosPorLocal.add(mapaLocalId);
    });
  }

  // Detectar tipo de mapa atual (geral ou local)
  const mapaAtual = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === mapId);
  const tipoMapa = mapaAtual ? mapaAtual.mapa.tipo : 'geral';

  // Renderizar tokens de personagens (diretos + projetados de filhos)
  chars.forEach(c => {
    const pos = getPosicaoNoMapa(c, mapId);
    if (!pos) return;
    const isProjected = c.active_map_id !== mapId; // vem de mapa filho
    const ca = c.custom_attrs || {};
    const isNpc = ca.tipo_personagem === 'npc';

    // NPCs invisíveis no mapa geral não aparecem
    if (isNpc && tipoMapa === 'geral' && ca.visivel_geral === false) return;
    // Token projetado: só mostra se personagem está em mapa filho deste
    // Token direto: active_map_id === mapId

    const el = document.createElement('div');
    el.className = 'mapa-token';
    el.dataset.nome = c.nome;

    // 2.2 — posicionar token pelo grid (col/row) em vez de porcentagem
    const _mapaObj = (RPG_DATA.mapas||[]).find(l=>l.mapa.map_id===mapId)?.mapa;
    const _gridW = _mapaObj?.largura_total || 20;
    const _gridH = _mapaObj?.altura_total  || 20;
    const _col = pos.col ?? pos.x ?? 0;
    const _row = pos.row ?? pos.y ?? 0;
    const _leftPct = ((_col + 0.5) / _gridW) * 100;
    const _topPct  = ((_row + 0.5) / _gridH) * 100;
    el.style.cssText = `left:${_leftPct.toFixed(2)}%;top:${_topPct.toFixed(2)}%;transform:translate(-50%,-50%)`;
    if (isProjected) el.dataset.projected = '1';
    const cor = ca.cor || c.cor || (isNpc ? '#e8604c' : 'var(--primario)');

    // ── APMOD: resolução de SVG do token ──────────────────────────
    const apmodSvg = typeof apmodTokenSVG === 'function' ? apmodTokenSVG(c, tipoMapa) : null;
    const tamanhoFator = Math.max(0.4, (ca.aparencia?.tamanho || 1.0));
    el.dataset.baseTamanho = tamanhoFator;
    // ── Equipamentos visuais: overlays posicionados sobre o token ─
    const _equipOverlayHtml = (equips, tw, th, camadaFiltro) => {
      if (!equips || !equips.length) return '';
      return equips.filter(eq => eq.visivel !== false && (eq.img || eq.img_url || (eq.svg && eq.svg.length > 5)) && (!camadaFiltro || (camadaFiltro === 'atras' ? eq.camada === 'atras' : eq.camada !== 'atras'))).map(eq => {
        const xPct = eq.x != null ? eq.x : 50;
        const yPct = eq.y != null ? eq.y : 30;
        const escala = (eq.escala != null ? eq.escala : 100) / 100;
        const rotacao = eq.rotacao || 0;
        const rotacaoH = eq.rotacaoH || 0;
        // Tamanho proporcional ao token — mesmas proporções do editor (35%×45% do canvas)
        const eqW = Math.round(0.35 * tw * escala);
        const eqH = Math.round(0.45 * th * escala);
        const left = Math.round((xPct / 100) * tw - eqW / 2);
        const top = Math.round((yPct / 100) * th - eqH / 2);
        const zIdx = eq.camada === 'atras' ? 0 : 5;
        const _warp = eq.warpCorners ? _aeqComputeMatrix3d(eqW, eqH, eq.warpCorners.map(c=>({x:c.x*eqW,y:c.y*eqH}))) : null;
        const _tfParts = _warp && _warp !== 'none' ? [_warp] : [rotacaoH ? `perspective(400px) rotateY(${rotacaoH}deg)` : '', rotacao ? `rotate(${rotacao}deg)` : '', eq.skewX ? `skewX(${eq.skewX}deg)` : '', eq.skewY ? `skewY(${eq.skewY}deg)` : ''].filter(Boolean);
        const _tfOrigin = (_warp && _warp !== 'none') ? '0 0' : 'center center';
        const _tf = _tfParts.length ? `transform:${_tfParts.join(' ')};transform-origin:${_tfOrigin};` : '';
        const inner = (eq.img || eq.img_url)
          ? `<img src="${eq.img || eq.img_url}" style="width:${eqW}px;height:${eqH}px;object-fit:contain;pointer-events:none">`
          : `<div style="width:${eqW}px;height:${eqH}px;display:flex;align-items:center;justify-content:center;pointer-events:none">${eq.svg}</div>`;
        return `<div style="position:absolute;left:${left}px;top:${top}px;z-index:${zIdx};${_tf}pointer-events:none">${inner}</div>`;
      }).join('');
    };
    const _equipVisuais = ca.aparencia?.equipamentos_visuais || [];

    const _npcFaction = ca.npc_faction || 'inimigo';
    const _factionColor = { inimigo: '#e8604c', neutro: '#c8a84b', aliado: '#5ee09a' }[_npcFaction] || '#e8604c';
    const npcBadge = isNpc ? `<div title="NPC ${_npcFaction}" style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:50%;background:${_factionColor};border:1px solid rgba(5,2,8,0.9);pointer-events:none"></div>` : '';
    // 3.2 — marcador do personagem vinculado do mestre
    const isVinculado = c.nome === RPG_DATA?.linked && RPG_DATA?.myRole === 'mestre';
    const vinculadoBadge = isVinculado ? `<div title="Seu personagem" style="position:absolute;bottom:-3px;left:-3px;width:9px;height:9px;border-radius:50%;background:#f0cc6a;border:1px solid rgba(0,0,0,0.8);pointer-events:none;z-index:15"></div>` : '';
    const projBadge = isProjected ? `<div title="Em mapa filho" style="position:absolute;bottom:-3px;right:-3px;width:10px;height:10px;border-radius:50%;background:rgba(200,168,75,0.9);border:1px solid rgba(0,0,0,0.7);pointer-events:none;font-size:6px;display:flex;align-items:center;justify-content:center">📍</div>` : '';

    {
      // Token circular: único formato (sem modo isométrico)
      const tamanho = isNpc ? '24px' : '32px';
      const bordaEstilo = isNpc ? `border:2px dashed ${cor}` : `border:2px solid ${cor}`;
      const opacidade = isNpc ? '0.85' : '1';

      let innerContent;
      if (apmodSvg) {
        const _ciSize = isNpc ? 24 : 32;
        innerContent = `<div class="apmod-token-wrap" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative">${_equipOverlayHtml(_equipVisuais, _ciSize, _ciSize, 'atras')}${apmodSvg}${_equipOverlayHtml(_equipVisuais, _ciSize, _ciSize, 'frente')}</div>`;
      } else {
        // Fallback: imagem ou letra
        const _tImgUrl = normalizeImgUrl(_imgToken(ca)||c.img_url||c.img||'');
        if (_tImgUrl) {
          const _tints = ca.aparencia?.tints || [];
          const _tOvls = tintOverlayHtml(_tints);
          innerContent = `<div style="position:relative;width:100%;height:100%;border-radius:50%;overflow:hidden"><img src="${_tImgUrl}" style="width:100%;height:100%;object-fit:cover">${_tOvls}</div>`;
        } else {
          innerContent = c.nome[0]||'?';
        }
      }

      const glowSize = isNpc ? '36px' : '46px';
      const corHex = cor.replace(/^var\([^)]+\)$/,'#4fa3d1').replace('#','');
      let gr=79,gg=163,gb=209;
      if(/^[0-9a-f]{6}$/i.test(corHex)){gr=parseInt(corHex.slice(0,2),16);gg=parseInt(corHex.slice(2,4),16);gb=parseInt(corHex.slice(4,6),16);}
      const glowCss = isProjected ? '' : `<div class="mapa-token-glow" style="width:${glowSize};height:${glowSize};left:50%;top:50%;background:radial-gradient(circle,rgba(${gr},${gg},${gb},0.35) 0%,rgba(${gr},${gg},${gb},0.12) 60%,transparent 80%);box-shadow:0 0 10px 2px rgba(${gr},${gg},${gb},0.22)"></div>`;
      el.innerHTML = `
        <div style="position:relative">
          ${glowCss}
          <div class="mapa-token-circle" style="width:${tamanho};height:${tamanho};${bordaEstilo};background:rgba(0,0,0,0.6);position:relative;opacity:${isProjected?'0.55':opacidade}">
            ${innerContent}
            ${npcBadge}${projBadge}${vinculadoBadge}
          </div>
          ${c.custom_attrs?.morto ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:10"><span style="font-size:1.3rem;color:#e74c3c;text-shadow:0 0 6px #000,0 0 12px rgba(231,76,60,0.8);font-weight:900;line-height:1">✕</span></div>` : ''}
        </div>
        <div class="mapa-token-label" style="color:${isNpc?'#e8a09a':'#fff'};opacity:${isProjected?'0.7':'1'}">${c.nome}${c.custom_attrs?.morto?' 💀':''}</div>`;
    }
    if (!isProjected) {
      el.addEventListener('pointerdown', e => mapaIniciarDrag(c.nome, el, e));
    }
    el.addEventListener('click', e => {
      e.stopPropagation();
      if (MAPA_STATE.tokenMoveu) return;
      _tokenCliqueSimples(c.nome);
    });
    el.addEventListener('dblclick', e => {
      e.stopPropagation();
      _tokenDuploClique(c.nome); // 3.2: mestre assume controle com dblclick
    });
    tokensEl.appendChild(el);
  });
  // Adicionar badges de buff/debuff ativos sobre os tokens
  _mapaAdicionarBadgesBuffTokens();
  // Renderizar paredes e portas
  paredePorRenderizar(m);
  // Renderizar objetos de cenário (chaves, baús, obstáculos, portas)
  if (typeof cenarioRenderObjetos_mapa === 'function') cenarioRenderObjetos_mapa(m);
}

// ── Badges de DOT/HOT ativos nos tokens do mapa ───────────────────────────────
function _mapaAdicionarBadgesBuffTokens() {
  const chars = RPG_DATA?.characters || [];
  chars.forEach(c => {
    const buffs = c.buffs || [];
    if (!buffs.length) return;
    const tokenEl = document.querySelector(`.mapa-token[data-nome="${CSS.escape(c.nome)}"]`);
    if (!tokenEl) return;
    tokenEl.querySelectorAll('.buff-dot-badge,.buff-hot-badge').forEach(b => b.remove());
    const temDot = buffs.some(b => b.dot_formula && (b.dot_turnos_restantes ?? 0) > 0);
    const temHot = buffs.some(b => b.hot_formula && (b.hot_turnos_restantes ?? 0) > 0);
    const temDebuff = buffs.some(b => b.tipo === 'debuff' && (
      (b.sem_ataque_turnos_restantes??0)>0 ||
      (b.mod_dano_turnos_restantes??0)>0 ||
      (b.sem_movimento && (b.sem_movimento_turnos_restantes ?? 0) > 0)
    ));
    if (temDot) {
      const b = document.createElement('div');
      b.className='buff-dot-badge';
      b.style.cssText='position:absolute;bottom:-4px;right:-4px;width:14px;height:14px;border-radius:50%;background:#c0392b;border:1px solid #050810;font-size:0.5rem;color:#fff;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:10';
      b.textContent='🩸'; b.title='DOT ativo';
      tokenEl.appendChild(b);
    }
    if (temHot) {
      const b = document.createElement('div');
      b.className='buff-hot-badge';
      b.style.cssText='position:absolute;bottom:-4px;left:-4px;width:14px;height:14px;border-radius:50%;background:#27ae60;border:1px solid #050810;font-size:0.5rem;color:#fff;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:10';
      b.textContent='💚'; b.title='HOT ativo';
      tokenEl.appendChild(b);
    }
    if (temDebuff && !temDot) {
      const b = document.createElement('div');
      b.className='buff-dot-badge';
      b.style.cssText='position:absolute;top:-4px;right:-4px;width:14px;height:14px;border-radius:50%;background:#8e44ad;border:1px solid #050810;font-size:0.5rem;color:#fff;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:10';
      b.textContent='☠'; b.title='Debuff ativo';
      tokenEl.appendChild(b);
    }
  });
  // Adicionar botão ⚔ acima do token de quem está na vez
  _mapaAdicionarBotaoAtaqueTurno();
}

function mapaRenderStatus() {
  const el = document.getElementById('mapa-status');
  if (!el) return;
  const chars = RPG_DATA.characters || [];
  const mapId = MAPA_STATE.mapaAtualId;

  const mapaAtual = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === mapId);
  const tipoMapa = mapaAtual ? mapaAtual.mapa.tipo : 'geral';

  const pcs  = chars.filter(c => (c.custom_attrs||{}).tipo_personagem !== 'npc');
  const npcs = chars.filter(c => (c.custom_attrs||{}).tipo_personagem === 'npc');

  const renderCard = (c, isNpc) => {
    const ca = c.custom_attrs || {};
    const nomeEsc = c.nome.replace(/'/g,"\\'");
    const cor = ca.cor || c.cor || (isNpc ? '#e8604c' : 'var(--primario-v)');
    const isMestre = RPG_DATA?.myRole === 'mestre';
    const isGenerico = ca.npc_generico === true;
    const isMeuChar = SESSION?.user && c.nome === (RPG_DATA?.linked || '');

    // ── Stats ────────────────────────────────────────────────────
    const hp_max = ca.hp_max || 100;
    const hp = c.hp_atual ?? hp_max;
    const hpPct = Math.max(0, Math.min(100, Math.round(hp / hp_max * 100)));
    const hpColor = hpPct > 60 ? '#5ee09a' : hpPct > 30 ? '#f0cc6a' : '#e74c3c';

    // XP bar (só jogadores com sistema de nível)
    const lc = (CURRENT_RPG?.theme?.level_config) || {};
    const nivel = ca.nivel || 1;
    const nivel_max = lc.nivel_maximo || 20;
    const xp = ca.xp || 0;
    const xp_proximo = (!isNpc && !isGenerico && nivel < nivel_max) ? nivel * 100 : null;
    const xpPct = xp_proximo ? Math.min(100, Math.round(xp / xp_proximo * 100)) : 0;

    // Recursos de status (Mana, Stamina, Ki…) — apenas categoria 'status'
    const adEspeciais = (RPG_DATA.attrDefs || []).filter(a => a.categoria === 'status' && a.tipo === 'number');
    const atribs = ca.atributos || {};

    // ── Barras ───────────────────────────────────────────────────
    const hpBar = `<div style="margin-top:4px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
        <span class="ms-label" style="color:${hpColor}">HP</span>
        <span class="ms-value" style="color:${hpColor}">${hp}/${hp_max}</span>
      </div>
      <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${hpPct}%;background:${hpColor};border-radius:3px;transition:width 0.3s"></div>
      </div>
    </div>`;

    const xpBar = xp_proximo ? `<div style="margin-top:3px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
        <span class="ms-label" style="color:var(--destaque)">XP Nv.${nivel}</span>
        <span class="ms-value" style="color:var(--destaque)">${xp}/${xp_proximo}</span>
      </div>
      <div style="height:4px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${xpPct}%;background:var(--destaque);border-radius:3px;transition:width 0.3s"></div>
      </div>
    </div>` : '';

    const recursosBars = adEspeciais.map(a => {
      const val = parseFloat(atribs[a.nome]) || 0;
      const nomeMax = a.nome.replace(/atual|current/i,'').trim();
      const aMax = (RPG_DATA.attrDefs||[]).find(d => d.nome.toLowerCase().includes(nomeMax.toLowerCase()) && d.nome !== a.nome && d.tipo==='number');
      const maxVal = aMax ? (parseFloat(atribs[aMax.nome])||0) : null;
      const pct = maxVal && maxVal > 0 ? Math.min(100, Math.round(val/maxVal*100)) : null;
      return `<div style="margin-top:3px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
          <span class="ms-label" style="color:#b07ef0">${a.nome}</span>
          <span class="ms-value" style="color:#b07ef0">${val}${maxVal?'/'+maxVal:''}</span>
        </div>
        ${pct!=null?`<div style="height:4px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:#b07ef0;border-radius:3px;transition:width 0.3s"></div></div>`:''}
      </div>`;
    }).join('');

    // Botão de Ação (fora de combate ou mestre)
    const podeAtacar = isMestre || isMeuChar;
    const btnAtk = (podeAtacar && hp > 0) ? `<button onclick="event.stopPropagation();abrirModalAcao('${nomeEsc}')" style="background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:5px;color:#7ec8f0;padding:2px 7px;font-size:0.65rem;cursor:pointer;flex-shrink:0;font-family:'Cinzel',serif" title="Ação">Ação</button>` : '';

    // Botão pin (colocar/reposicionar no mapa)
    const estaNoMapaAtual = mapId && c.active_map_id === mapId;
    const podePin = isMestre || isMeuChar;
    const btnPin = podePin ? `<button onclick="event.stopPropagation();mapaPosicionarChar('${nomeEsc}')" style="background:rgba(79,163,209,0.07);border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:${estaNoMapaAtual?'var(--primario-v)':'#7a92aa'};padding:2px 6px;font-size:0.65rem;cursor:pointer;flex-shrink:0" title="${estaNoMapaAtual?'Reposicionar':'Colocar no mapa'}">📍</button>` : '';

    // Botão remover do mapa (mestre, apenas se estiver no mapa)
    const btnRem = (isMestre && estaNoMapaAtual) ? `<button onclick="event.stopPropagation();removeCharFromMap('${nomeEsc}')" style="background:rgba(192,57,43,0.06);border:1px solid rgba(192,57,43,0.15);border-radius:5px;color:#c0392b88;padding:2px 6px;font-size:0.65rem;cursor:pointer;flex-shrink:0" title="Remover do mapa">✕</button>` : '';

    const opacidade = !estaNoMapaAtual ? 'opacity:0.55;' : '';

    return `<div style="${opacidade}background:rgba(14,20,30,0.85);border:1px solid ${estaNoMapaAtual ? cor+'22' : 'rgba(255,255,255,0.04)'};border-left:2px solid ${estaNoMapaAtual ? cor : '#3a4a5a'};border-radius:7px;padding:7px 10px;margin-bottom:5px;cursor:pointer" onclick="abrirFichaNoMapa('${nomeEsc}')">
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:${hpBar || xpBar || recursosBars ? '2px':'0'}">
        <span class="ms-nome" style="color:${cor}">${c.nome}</span>
        ${btnPin}${btnRem}${btnAtk}
      </div>
      ${estaNoMapaAtual ? hpBar + xpBar + recursosBars : `<div class="ms-fora">— fora do mapa —</div>`}
    </div>`;
  };

  let html = '';

  if (pcs.length) {
    html += `<div class="ms-section">Personagens</div>`;
    html += pcs.map(c => renderCard(c, false)).join('');
  }

  if (npcs.length) {
    html += `<div class="ms-section" style="color:#e86050;margin-top:10px">NPCs</div>`;
    html += npcs.map(c => renderCard(c, true)).join('');
  }

  el.innerHTML = html || `<div style="color:var(--suave);font-style:italic;font-size:0.85rem;padding:8px">Nenhum personagem</div>`;
  // Se em modo 3-col, também atualizar painel de ações
  if (document.getElementById('mesa-acao-painel')) {
    _mesaRenderAcoes?.();
  }
}

// ── CONFIGURAÇÕES DO MAPA — título, grid, escala e metadados visuais ──────
function abrirModalMapaConfig() {
  const mapas = RPG_DATA.mapas || [];
  const entry = mapas.find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
  if (!entry) { mostrarToast('Selecione um mapa primeiro', 'erro'); return; }
  const m = entry.mapa;

  // Ocultar confirmação de exclusão
  document.getElementById('mapa-config-confirm-del').style.display = 'none';

  document.getElementById('modal-mapa-config-titulo').textContent = `✏️ ${m.nome || 'Configurar Mapa'}`;
  document.getElementById('modal-mapa-config-id').value = entry.id;
  document.getElementById('modal-mapa-config-map-id-original').value = m.map_id;

  // Campos básicos
  document.getElementById('modal-mapa-nome').value = m.nome || '';
  document.getElementById('modal-mapa-map-id').value = m.map_id || '';
  document.getElementById('modal-mapa-img-url').value = m.img_url || '';
  document.getElementById('modal-mapa-escala-val').value = m.escala_val || '';
  document.getElementById('modal-mapa-escala-unit').value = m.escala_unit || 'm';
  document.getElementById('modal-mapa-grid').value = m.grid || '';

  // Unidades nos labels
  const unit = m.escala_unit || 'm';
  ['modal-mapa-unit-lbl1','modal-mapa-unit-lbl2','modal-mapa-local-unit1','modal-mapa-local-unit2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = `(${unit})`;
  });

  // Dimensões totais
  document.getElementById('modal-mapa-larg-total').value = m.largura_total || '';
  document.getElementById('modal-mapa-alt-total').value = m.altura_total || '';

  modalMapaPreviewImg(m.img_url || '');

  // Seção de mapa local
  const localSecao = document.getElementById('modal-mapa-local-secao');
  if (m.tipo === 'local') {
    localSecao.style.display = 'block';

    // Popular seletor de pai (todos os mapas exceto o próprio)
    const selPai = document.getElementById('modal-mapa-parent');
    selPai.innerHTML = mapas
      .filter(l => l.mapa.map_id !== m.map_id)
      .map(l => `<option value="${l.mapa.map_id}">${l.mapa.tipo==='geral'?'🌍':'🏰'} ${l.mapa.nome}</option>`)
      .join('');

    // Encontrar mapa pai atual
    const paiEntry = mapas.find(l => (l.mapa.locais||[]).some(z => z.mapa_local_id === m.map_id));
    if (paiEntry) selPai.value = paiEntry.mapa.map_id;

    // Tamanho real (guardados no local ou no mapa)
    document.getElementById('modal-mapa-local-larg').value = m.largura_real || '';
    document.getElementById('modal-mapa-local-alt').value  = m.altura_real  || '';
    document.getElementById('modal-mapa-repr-pct').value  = m.representar_pct != null ? m.representar_pct : 100;

    document.getElementById('modal-mapa-preview-calc').style.display = 'none';
    mapaConfigAtualizarPreview();
  } else {
    localSecao.style.display = 'none';
  }

  const overlay = document.getElementById('modal-mapa-config-overlay');

  // ── Carregar configuração 3D ────────────────────────────────────────────
  const t3d = m.transform3d || m.render_data?.transform3d || {};
  const _sv = (id, v, def) => { const el = document.getElementById(id); if (el) el.value = v ?? def; };
  _sv('mp3d-rx',   t3d.rx   ?? 0,    0);
  _sv('mp3d-ry',   t3d.ry   ?? 0,    0);
  _sv('mp3d-rz',   t3d.rz   ?? 0,    0);
  _sv('mp3d-persp',t3d.persp ?? 4000, 4000);
  _sv('mp3d-ox',   t3d.ox   ?? 0,    0);
  _sv('mp3d-oy',   t3d.oy   ?? 0,    0);
  _sv('mp3d-sc',   t3d.sc   ?? 100,  100);
  const depthEl = document.getElementById('mp3d-depth');
  if (depthEl) depthEl.checked = !!t3d.depth;
  // Preview com imagem atual
  const previewImg = document.getElementById('mp3d-preview-img');
  if (previewImg) previewImg.src = normalizeImgUrl(m.img_url || '');
  mp3dAtualizar();

  overlay.style.display = 'flex';
  overlay.addEventListener('pointerdown', function handler(e) {
    if (e.target === overlay) { fecharModalMapaConfig(); overlay.removeEventListener('pointerdown', handler); }
  });
}

function modalMapaPreviewImg(url) {
  const normalized = normalizeImgUrl(url);
  const prev = document.getElementById('modal-mapa-img-preview');
  const ph = document.getElementById('modal-mapa-img-placeholder');
  if (normalized) {
    prev.src = normalized;
    prev.style.display = 'block';
    if (ph) ph.style.display = 'none';
  } else {
    prev.style.display = 'none';
    if (ph) ph.style.display = 'flex';
  }
}

function fecharModalMapaConfig() {
  document.getElementById('modal-mapa-config-overlay').style.display = 'none';
}

// Mostrar confirmação de exclusão inline no modal
function pedirConfirmacaoExcluirMapa() {
  document.getElementById('mapa-config-confirm-del').style.display = 'block';
  document.getElementById('mapa-config-confirm-del').scrollIntoView({ behavior:'smooth', block:'center' });
}

// Excluir mapa a partir do modal (com confirmação já feita)
async function deletarMapaDoModal() {
  if (RPG_DATA?.myRole !== 'mestre') return;
  const mapas = RPG_DATA.mapas || [];
  const entry = mapas.find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
  if (!entry) return;
  const nome = entry.mapa.nome || entry.mapa.map_id;
  if (batalhaDoMapa(MAPA_STATE.mapaAtualId)) {
    mostrarToast('Encerre a batalha antes de excluir este mapa', 'erro');
    return;
  }
  // Remover referência deste mapa nas zonas do pai
  const paiEntry = mapas.find(l => (l.mapa.locais||[]).some(z => z.mapa_local_id === MAPA_STATE.mapaAtualId));
  if (paiEntry) {
    paiEntry.mapa.locais = (paiEntry.mapa.locais||[]).filter(z => z.mapa_local_id !== MAPA_STATE.mapaAtualId);
    try {
      await sb(`mapas?id=eq.${encodeURIComponent(paiEntry.id)}`,
        { method:'PATCH', body:JSON.stringify({ locais: paiEntry.mapa.locais }) });
    } catch(e) {}
  }
  try {
    await sb(`mapas?id=eq.${encodeURIComponent(entry.id)}`, { method:'DELETE' });
    RPG_DATA.mapas = RPG_DATA.mapas.filter(l => l.mapa.map_id !== MAPA_STATE.mapaAtualId);
    MAPA_STATE.mapaAtualId = null;
    MAPA_STATE.mapaGeralId = null;
    fecharModalMapaConfig();
    renderMapasTab();
    mostrarToast(`Mapa "${nome}" excluído`, 'sucesso');
  } catch(e) { mostrarToast('Erro ao excluir mapa', 'erro'); }
}

// Reposicionar mapa local (a partir do modal de config)
function reposicionarMapaLocal() {
  const mapas = RPG_DATA.mapas || [];
  const entry = mapas.find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
  if (!entry || entry.mapa.tipo !== 'local') return;
  const m = entry.mapa;
  const novoPaiId = document.getElementById('modal-mapa-parent')?.value || m.parent_map_id;

  // Recalcular zona com valores do modal (pode ter sido editado)
  let zonaW = m.zona_w_percent || 15;
  let zonaH = m.zona_h_percent || 15;
  const largReal = parseFloat(document.getElementById('modal-mapa-local-larg')?.value) || m.largura_real;
  const altReal  = parseFloat(document.getElementById('modal-mapa-local-alt')?.value)  || m.altura_real;
  const reprPct  = parseFloat(document.getElementById('modal-mapa-repr-pct')?.value)   || m.representar_pct || 100;
  const paiEntry = novoPaiId ? mapas.find(l => l.mapa.map_id === novoPaiId) : null;
  if (paiEntry && largReal && paiEntry.mapa.largura_total) {
    zonaW = parseFloat(((largReal * reprPct / 100) / paiEntry.mapa.largura_total * 100).toFixed(2));
    if (altReal && paiEntry.mapa.altura_total) {
      zonaH = parseFloat(((altReal * reprPct / 100) / paiEntry.mapa.altura_total * 100).toFixed(2));
    } else {
      zonaH = parseFloat((zonaW * 0.75).toFixed(2));
    }
  }
  // Persistir dimensões no mapa para uso posterior no placement
  m.largura_real = largReal;
  m.altura_real = altReal;
  m.representar_pct = reprPct;
  m.zona_w_percent = zonaW;
  m.zona_h_percent = zonaH;

  fecharModalMapaConfig();
  if (novoPaiId) selecionarMapa(novoPaiId);
  ativarModoPlacement(m.map_id, m.nome, zonaW, zonaH);
  mostrarToast(`Clique no mapa para reposicionar "${m.nome}"`, '');
}

// Atualizar preview de cálculo no modal de config
function mapaConfigAtualizarPreview() {
  const mapas = RPG_DATA.mapas || [];
  const largReal = parseFloat(document.getElementById('modal-mapa-local-larg')?.value);
  const altReal  = parseFloat(document.getElementById('modal-mapa-local-alt')?.value);
  const reprPct  = parseFloat(document.getElementById('modal-mapa-repr-pct')?.value) || 100;
  const paiId    = document.getElementById('modal-mapa-parent')?.value;
  const paiEntry = paiId ? mapas.find(l=>l.mapa.map_id===paiId) : null;
  const paiLarg  = paiEntry?.mapa?.largura_total;
  const paiAlt   = paiEntry?.mapa?.altura_total;
  const unit     = paiEntry?.mapa?.escala_unit || document.getElementById('modal-mapa-escala-unit')?.value || 'm';
  const preview  = document.getElementById('modal-mapa-preview-calc');
  if (!preview) return;
  if (largReal && paiLarg) {
    const dispW = (largReal * reprPct / 100).toFixed(1);
    const pctW  = (dispW / paiLarg * 100).toFixed(1);
    const dispH = altReal ? (altReal * reprPct / 100).toFixed(1) : '—';
    const pctH  = (altReal && paiAlt) ? (dispH / paiAlt * 100).toFixed(1) + '%' : '—';
    preview.style.display = 'block';
    preview.innerHTML = `📐 Exibido como <strong>${dispW}${unit} × ${dispH}${unit}</strong> no mapa pai — ocupa ~<strong>${pctW}%</strong> × ${pctH} da área.`;
  } else if (largReal && reprPct !== 100) {
    const dispW = (largReal * reprPct / 100).toFixed(1);
    preview.style.display = 'block';
    preview.innerHTML = `📐 Exibido como <strong>${dispW}${unit}</strong> de largura. Defina as dimensões totais do mapa pai para cálculo automático de %.`;
  } else {
    preview.style.display = 'none';
  }
}

async function salvarConfigMapa() {
  const mapas = RPG_DATA.mapas || [];
  const entry = mapas.find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
  if (!entry) return;
  const m = entry.mapa;

  const novoNome    = document.getElementById('modal-mapa-nome').value.trim() || m.nome;
  const novoMapId   = (document.getElementById('modal-mapa-map-id').value.trim().replace(/\s+/g,'_')) || m.map_id;
  const imgUrl      = document.getElementById('modal-mapa-img-url').value.trim();
  const escalaVal   = parseFloat(document.getElementById('modal-mapa-escala-val').value) || 1;
  const escalaUnit  = document.getElementById('modal-mapa-escala-unit').value.trim() || 'm';
  const grid        = parseInt(document.getElementById('modal-mapa-grid').value) || 20;
  const largTotal   = parseFloat(document.getElementById('modal-mapa-larg-total').value) || null;
  const altTotal    = parseFloat(document.getElementById('modal-mapa-alt-total').value)  || null;

  const oldMapId = m.map_id;
  m.nome        = novoNome;
  m.map_id      = novoMapId;
  m.img_url     = imgUrl;
  m.escala_val  = escalaVal;
  m.escala_unit = escalaUnit;
  m.grid        = grid;
  m.largura_total = largTotal;
  m.altura_total  = altTotal;

  // Se ID mudou, atualizar referências em zonas de pai
  if (oldMapId !== novoMapId) {
    MAPA_STATE.mapaAtualId = novoMapId;
    if (MAPA_STATE.mapaGeralId === oldMapId) MAPA_STATE.mapaGeralId = novoMapId;
    mapas.forEach(l => {
      if (!l.mapa.locais) return;
      l.mapa.locais.forEach(z => {
        if (z.mapa_local_id === oldMapId) z.mapa_local_id = novoMapId;
        if (z.local_id === oldMapId) z.local_id = novoMapId;
      });
    });
  }

  let zonaW = m.zona_w_percent || 15;
  let zonaH = m.zona_h_percent || 15;

  if (m.tipo === 'local') {
    const largReal  = parseFloat(document.getElementById('modal-mapa-local-larg').value) || null;
    const altReal   = parseFloat(document.getElementById('modal-mapa-local-alt').value)  || null;
    const reprPct   = parseFloat(document.getElementById('modal-mapa-repr-pct').value)   || 100;
    const novoPaiId = document.getElementById('modal-mapa-parent').value;

    m.largura_real    = largReal;
    m.altura_real     = altReal;
    m.representar_pct = reprPct;
    m.parent_map_id   = novoPaiId;

    const paiEntry = mapas.find(l => l.mapa.map_id === novoPaiId);
    const paiLarg  = paiEntry?.mapa?.largura_total;
    const paiAlt   = paiEntry?.mapa?.altura_total;

    if (largReal && paiLarg) {
      zonaW = parseFloat(((largReal * reprPct / 100) / paiLarg * 100).toFixed(2));
    }
    if (altReal && paiAlt) {
      zonaH = parseFloat(((altReal * reprPct / 100) / paiAlt * 100).toFixed(2));
    } else if (!altReal || !paiAlt) {
      zonaH = parseFloat((zonaW * 0.75).toFixed(2));
    }

    m.zona_w_percent = zonaW;
    m.zona_h_percent = zonaH;

    // Atualizar zona no mapa pai
    if (paiEntry) {
      if (!paiEntry.mapa.locais) paiEntry.mapa.locais = [];
      const zonaExist = paiEntry.mapa.locais.find(z => z.mapa_local_id === oldMapId || z.mapa_local_id === novoMapId);
      if (zonaExist) {
        zonaExist.mapa_local_id  = novoMapId;
        zonaExist.local_id       = novoMapId;
        zonaExist.nome           = novoNome;
        zonaExist.zona_w_percent = zonaW;
        zonaExist.zona_h_percent = zonaH;
        zonaExist.raio_percent   = zonaW;
      }
      try {
        await sb(`mapas?id=eq.${encodeURIComponent(paiEntry.id)}`,
          { method:'PATCH', body:JSON.stringify({ locais: paiEntry.mapa.locais }) });
      } catch(e) {}
    }
  }

  try {
    // Ler configuração 3D do modal
    const _gv = id => { const el = document.getElementById(id); return el ? +el.value : null; };
    const t3d = {
      rx:    _gv('mp3d-rx')    ?? 0,
      ry:    _gv('mp3d-ry')    ?? 0,
      rz:    _gv('mp3d-rz')    ?? 0,
      persp: _gv('mp3d-persp') ?? 4000,
      ox:    _gv('mp3d-ox')    ?? 0,
      oy:    _gv('mp3d-oy')    ?? 0,
      sc:    _gv('mp3d-sc')    ?? 100,
      depth: !!(document.getElementById('mp3d-depth')?.checked),
    };
    m.transform3d = t3d;

    // Guardar transform3d dentro do render_data (JSONB existente — sem necessidade de nova coluna)
    const novoRenderData = Object.assign({}, m.render_data || {}, { transform3d: t3d });
    m.render_data  = novoRenderData;
    m.transform3d  = t3d;

    const patch = {
      nome: novoNome, map_id: novoMapId,
      img_url: imgUrl, escala_val: escalaVal, escala_unit: escalaUnit, grid,
      largura_total: largTotal, altura_total: altTotal,
      largura_real: m.largura_real||null, altura_real: m.altura_real||null,
      representar_pct: m.representar_pct||null,
      parent_map_id: m.parent_map_id||null,
      zona_w_percent: m.zona_w_percent, zona_h_percent: m.zona_h_percent,
      render_data: novoRenderData,
    };
    await sb(`mapas?id=eq.${encodeURIComponent(entry.id)}`, { method:'PATCH', body:JSON.stringify(patch) });
    // Feedback visual no botão de salvar
    const _btnSalvar = document.querySelector('#modal-mapa-config-overlay .btn-primario');
    if (_btnSalvar) {
      const _txtOrig = _btnSalvar.textContent;
      _btnSalvar.textContent = '✓ Salvo!';
      _btnSalvar.style.background = '#27ae60';
      _btnSalvar.style.color = '#fff';
      _btnSalvar.disabled = true;
      setTimeout(() => {
        _btnSalvar.textContent = _txtOrig;
        _btnSalvar.style.background = '';
        _btnSalvar.style.color = '';
        _btnSalvar.disabled = false;
        fecharModalMapaConfig();
      }, 1200);
    } else {
      fecharModalMapaConfig();
    }
    mostrarToast('Mapa atualizado!', 'sucesso');
    renderMapasTab();
    // Reaplicar visual imediatamente — transform3d já está em m.transform3d
    const upEntry = (RPG_DATA.mapas||[]).find(l=>l.mapa.map_id===MAPA_STATE.mapaAtualId);
    if (upEntry) {
      renderMapaViewer();
    }
  } catch(e) {
    mostrarToast('Erro ao salvar mapa', 'erro');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ██  MOVIMENTO DE TOKEN EM TEMPO REAL  (broadcast via canal de chat)
// ═══════════════════════════════════════════════════════════════════════════
const _TOKEN_MOVE_SID = Math.random().toString(36).slice(2);

function tokenMoveBroadcast(payload) {
  try {
    const rpgId = AR.session?.rpg_id || RPG_DATA?.rpgId;
    const ws    = AR.ws || realtimeWS;
    if (!rpgId || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      topic:   `realtime:chat:${rpgId}`,
      event:   'broadcast',
      payload: { type: 'broadcast', event: 'token_move', payload },
      ref:     'tmov_' + Date.now()
    }));
  } catch(e) {}
}

function tokenMoveReceber(payload) {
  if (!payload || payload.sid === _TOKEN_MOVE_SID) return;
  const { nome, x, y, contexto, mapId } = payload;
  if (contexto === 'campanha') {
    if (MAPA_STATE.mapaAtualId !== mapId) return;
    const c = RPG_DATA?.characters?.find(ch => ch.nome === nome);
    if (c) {
      if (!c.map_positions) c.map_positions = {};
      c.map_positions[mapId] = { x, y };
      c.active_map_id = mapId;
    }
    const el = document.querySelector(`.mapa-token[data-nome="${CSS.escape(nome)}"]`);
    if (!el) return;
    // 2.2 — reposicionar pelo grid ao receber broadcast
    const _recvMapa = (RPG_DATA?.mapas||[]).find(l=>l.mapa.map_id===mapId)?.mapa;
    const _recvW = _recvMapa?.largura_total||20, _recvH = _recvMapa?.altura_total||20;
    const _recvPos = pctParaCelula(x, y, mapId);
    el.style.left = ((_recvPos.col+0.5)/_recvW*100).toFixed(2)+'%';
    el.style.top  = ((_recvPos.row+0.5)/_recvH*100).toFixed(2)+'%';
    el.style.transform = 'translate(-50%,-50%)'; // 2.4 top-down
  } else if (contexto === 'arena') {
    const c = AR?.chars?.find(ch => ch.nome === nome);
    if (c) {
      if (!c.custom_attrs) c.custom_attrs = {};
      c.custom_attrs.pos = { x, y };
    }
    const el = document.querySelector(`.ar-mesa-token[data-nome="${CSS.escape(nome)}"]`);
    if (!el) return;
    el.style.left = x + '%';
    el.style.top  = y + '%';
    const ds = (0.72 + (y / 100) * 0.50).toFixed(3);
    el.style.transform = `translate(-50%,-50%) scale(${ds})`;
  }
}

// ── DRAG DE TOKEN NO MAPA ─────────────────────────────────────

// ════════════════════════════════════════════════════════════════════════════
// 2.3 — FOG DE GUERRA: 3 estados por célula
// oculta | revelada | visivel_agora
// Ativado apenas em mapas táticos
// ════════════════════════════════════════════════════════════════════════════
const FOG_STATE = {
  // { [mapId]: { [col_row]: 'oculta'|'revelada'|'visivel_agora' } }
  mapas: {},
  // Raio de visão padrão em células
  raio: 5,
};

function fogGetEstado(mapId, col, row) {
  return (FOG_STATE.mapas[mapId] || {})[ col+'_'+row ] || 'oculta';
}

function fogSetEstado(mapId, col, row, estado) {
  if (!FOG_STATE.mapas[mapId]) FOG_STATE.mapas[mapId] = {};
  FOG_STATE.mapas[mapId][ col+'_'+row ] = estado;
}

function fogInicializar(mapId, mapa) {
  // Só mapas táticos têm fog
  if (!mapaIsTatico(mapa)) return;
  // Se já inicializado, manter o estado salvo
  if (FOG_STATE.mapas[mapId]) return;
  FOG_STATE.mapas[mapId] = {};
  // Tudo começa oculto (estados ausentes = oculto, não precisa preencher)
}

function fogCarregarDoServidor(mapId, fogData) {
  if (fogData && typeof fogData === 'object') {
    FOG_STATE.mapas[mapId] = fogData;
  }
}

// Revelar fog ao redor de um token (chamado via HUB_EVENTS 'token_moveu')
function fogRevealAround(mapId, col, row, raio) {
  const r = raio ?? FOG_STATE.raio;
  const mapa = _getMapaById(mapId);
  if (!mapa || !mapaIsTatico(mapa)) return false;

  const largura = mapa.largura_total || 20;
  const altura  = mapa.altura_total  || 20;
  let alterou = false;

  // Revelar células dentro do raio usando distância Euclidiana (círculo real)
  // Fog só se expande — células reveladas NUNCA voltam a ficar ocultas
  for (let dc = -r; dc <= r; dc++) {
    for (let dr = -r; dr <= r; dr++) {
      const dist = Math.sqrt(dc * dc + dr * dr); // Euclidean → círculo
      if (dist > r) continue;
      const c2 = col + dc, r2 = row + dr;
      if (c2 < 0 || c2 >= largura || r2 < 0 || r2 >= altura) continue;
      const atual = fogGetEstado(mapId, c2, r2);
      if (atual !== 'visivel_agora') {
        fogSetEstado(mapId, c2, r2, 'visivel_agora');
        alterou = true;
      }
    }
  }

  // Sem loop de demote: fog não volta a cobrir células já reveladas
  return alterou;
}

// Revelar retângulo de células (comando FOG: revelar A1:D5)
function fogRevealRect(mapId, colA, rowA, colB, rowB) {
  const c1=Math.min(colA,colB), c2=Math.max(colA,colB);
  const r1=Math.min(rowA,rowB), r2=Math.max(rowA,rowB);
  for (let c=c1; c<=c2; c++) for (let r=r1; r<=r2; r++) {
    fogSetEstado(mapId, c, r, 'visivel_agora');
  }
  fogRenderizar(mapId);
}

// Fog de guerra desativado — função mantida para compatibilidade
function fogRenderizar(mapId) {
  const existing = document.getElementById('fog-canvas');
  if (existing) existing.remove();
  return; // fog desativado

  const bg = document.getElementById('mapa-img');
  if (!bg) return;
  const W = bg.offsetWidth  || bg.naturalWidth  || 800;
  const H = bg.offsetHeight || bg.naturalHeight || 600;

  let canvas = document.getElementById('fog-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'fog-canvas';
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:4';
    bg.parentNode?.insertBefore(canvas, bg.nextSibling);
  }
  canvas.width  = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  const largura = mapa.largura_total || 20;
  const altura  = mapa.altura_total  || 20;
  const cW = W / largura;
  const cH = H / altura;
  const r  = FOG_STATE.raio;

  // ── Passo 1: preencher tudo com névoa escura ─────────────────
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.95)';
  ctx.fillRect(0, 0, W, H);

  // ── Passo 2: clarear áreas exploradas (reveladas pelo histórico) ─
  // Células com estado 'revelada' ficam 50 % visíveis (já visitadas)
  // Células 'visivel_agora' ficam 100 % visíveis via gradiente no passo 3
  const fog = FOG_STATE.mapas[mapId] || {};
  ctx.globalCompositeOperation = 'destination-out';
  for (const [chave, estado] of Object.entries(fog)) {
    if (estado === 'oculta') continue;
    const [cs, rs] = chave.split('_').map(Number);
    ctx.globalAlpha = estado === 'visivel_agora' ? 1.0 : 0.45;
    ctx.fillRect(cs * cW, rs * cH, cW + 0.5, cH + 0.5);
  }

  // ── Passo 3: círculo suave ao redor de cada jogador ──────────────
  // Usa gradiente radial para bordas redondas e suaves, centrado na
  // posição atual do personagem. Garante que o jogador nunca fique no escuro.
  const chars = RPG_DATA?.characters || [];
  for (const c of chars) {
    const ca = c.custom_attrs || {};
    if (ca.tipo_personagem === 'npc' || ca.tipo === 'npc') continue;
    const pos = (c.map_positions || {})[mapId];
    if (!pos) continue;

    const px = (pos.col + 0.5) * cW;
    const py = (pos.row + 0.5) * cH;
    // Raio em pixels: usa a menor dimensão de célula para manter proporcional
    const raiopx = r * Math.min(cW, cH);

    // Gradiente: centro totalmente limpo → borda totalmente opaca
    const grad = ctx.createRadialGradient(px, py, raiopx * 0.55, px, py, raiopx);
    grad.addColorStop(0, 'rgba(0,0,0,1)');   // centro: apaga névoa 100 %
    grad.addColorStop(1, 'rgba(0,0,0,0)');   // borda: sem apagamento (névoa permanece)

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, raiopx, 0, Math.PI * 2);
    ctx.fill();
  }

  // Restaurar estado do contexto
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// Salvar fog no banco (debounced, 3s)
let _fogSaveTimer = null;
function fogSalvarDebounced(rpgId, mapId) {
  clearTimeout(_fogSaveTimer);
  _fogSaveTimer = setTimeout(async () => {
    const fogData = FOG_STATE.mapas[mapId];
    if (!fogData) return;
    try {
      await sb(`mapas?rpg_id=eq.${encodeURIComponent(rpgId)}&map_id=eq.${encodeURIComponent(mapId)}`,
        { method:'PATCH', body: JSON.stringify({ fog_data: fogData }) });
    } catch(e) {}
  }, 3000);
}

// Fog de guerra desativado — listener de revelação removido
// HUB_EVENTS.on('token_moveu', ...) desabilitado


// ════════════════════════════════════════════════════════════════════════════
// 2.6 — RAIO MÁXIMO DA CÂMERA: bloqueio de movimento antes de sair
// ════════════════════════════════════════════════════════════════════════════
const CAMERA_RAIO_MAX = 10; // células — configurável

function cameraVerificarRaio(mapId, nomeCandidato, colDestino, rowDestino) {
  // Só aplica durante combate ou quando câmera automática está ativa
  if (MAPA_ZOOM.modo !== 'auto') return true;
  const mapa = _getMapaById(mapId);
  if (!mapa || !mapaIsTatico(mapa)) return true;

  const centro = _cameraCalcCentroide(mapId);
  if (!centro) return true;

  const W = mapa.largura_total || 20;
  const H = mapa.altura_total  || 20;
  const centroCol = Math.round(centro.x * W);
  const centroRow = Math.round(centro.y * H);

  const dist = Math.max(
    Math.abs(colDestino - centroCol),
    Math.abs(rowDestino - centroRow)
  );
  return dist <= CAMERA_RAIO_MAX;
}

function cameraBloqueioFeedback(nome) {
  mostrarToast('🛑 Aguarde o grupo.', 'aviso');
  // Vibração mobile
  if (navigator.vibrate) navigator.vibrate(80);
  // Animação de resistência no token
  const tokenEl = document.querySelector(`.mapa-token[data-nome="${CSS.escape(nome)}"]`);
  if (tokenEl) {
    tokenEl.style.animation = 'tokenResistencia 0.3s ease';
    setTimeout(() => { tokenEl.style.animation = ''; }, 350);
  }
}


// Injetar CSS da animação de resistência do token
(function() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes tokenResistencia {
      0%,100% { transform: translate(-50%,-50%); }
      25% { transform: translate(-46%,-50%); }
      75% { transform: translate(-54%,-50%); }
    }
  `;
  document.head.appendChild(style);
})();
function mapaIniciarDrag(nome, el, e) {
  if (MAPA_STATE.toolMode === 'medicao') return;

  // Durante modo de ataque: bloquear movimento de qualquer token que não seja o atacante
  if (ATAQUE_MAPA_STATE.ativo && nome !== ATAQUE_MAPA_STATE.atacanteNome) {
    // Se for alvo disponível, interpretar como clique de seleção de alvo
    if (ATAQUE_MAPA_STATE.fase === 'alvos') {
      const isAlvo = COMBATE._alvos.some(a => a.nome === nome);
      if (isAlvo) {
        // O clique no token será tratado pelo listener 'click' normalmente
      } else {
        mostrarToast('⚔ Mova apenas seu personagem durante o ataque', '');
      }
    }
    return;
  }

  // Verificar debuff sem_movimento (apenas para não-mestre)
  const isMestre = RPG_DATA?.myRole === 'mestre';
  if (!isMestre) {
    const c = RPG_DATA?.characters?.find(ch => ch.nome === nome);
    const buffs = c?.buffs || [];
    const imobilizado = buffs.some(b => b.sem_movimento && (b.sem_movimento_turnos_restantes ?? 0) > 0);
    if (imobilizado) {
      const buff = buffs.find(b => b.sem_movimento && (b.sem_movimento_turnos_restantes ?? 0) > 0);
      mostrarToast(`🚫 ${nome} está imobilizado — "${buff?.nome || 'Debuff'}"`, 'erro');
      return;
    }
  }

  e.preventDefault();
  MAPA_STATE.dragging = nome;
  MAPA_STATE.tokenMoveu = false;
  el.style.cursor = 'grabbing';
  el.setPointerCapture(e.pointerId);
  el.addEventListener('pointermove', mapaOnDrag);
  el.addEventListener('pointerup', mapaFimDrag);
}

function mapaOnDrag(e) {
  if (!MAPA_STATE.dragging) return;
  MAPA_STATE.tokenMoveu = true;
  const bg = document.getElementById('mapa-img');
  const rect = bg.getBoundingClientRect();
  // Compensar zoom e pan: converter coordenada de tela para coordenada dentro do elemento não-escalado
  const zoom = MAPA_ZOOM.zoom || 1;
  const panX = MAPA_ZOOM.panX || 0;
  const panY = MAPA_ZOOM.panY || 0;
  const wrap = document.getElementById('mapa-wrap');
  const wrapRect = wrap.getBoundingClientRect();
  // Posição relativa ao wrap, compensando pan e zoom
  const localX = (e.clientX - wrapRect.left - panX) / zoom;
  const localY = (e.clientY - wrapRect.top  - panY) / zoom;
  const layoutW = bg.offsetWidth  || wrapRect.width;
  const layoutH = bg.offsetHeight || wrapRect.height;
  const x = Math.max(2, Math.min(98, localX / layoutW * 100));
  const y = Math.max(2, Math.min(98, localY / layoutH * 100));
  const c = RPG_DATA.characters.find(ch => ch.nome === MAPA_STATE.dragging);
  if (!c) return;
  if (!c.map_positions) c.map_positions = {};
  c.active_map_id = MAPA_STATE.mapaAtualId;
  const _dragSnapped = pctParaCelula(x, y, MAPA_STATE.mapaAtualId);
  c.map_positions[MAPA_STATE.mapaAtualId] = _dragSnapped;
  const tokenEl = document.querySelector(`.mapa-token[data-nome="${CSS.escape(MAPA_STATE.dragging)}"]`);
  if (tokenEl) {
    // Snap visual para centro da célula durante o drag
    const _dragMapa = _getMapaById(MAPA_STATE.mapaAtualId);
    const _gW = _dragMapa?.largura_total || 20, _gH = _dragMapa?.altura_total || 20;
    const _snapX = (_dragSnapped.col + 0.5) / _gW * 100;
    const _snapY = (_dragSnapped.row + 0.5) / _gH * 100;
    tokenEl.style.left = _snapX.toFixed(2)+'%';
    tokenEl.style.top  = _snapY.toFixed(2)+'%';
    tokenEl.style.transform = 'translate(-50%,-50%)';
  }
  // Broadcast em tempo real para outros clientes (throttle 50ms ≈ 20fps)
  const _now = Date.now();
  if (!MAPA_STATE._lastBroadcast || _now - MAPA_STATE._lastBroadcast > 50) {
    MAPA_STATE._lastBroadcast = _now;
    tokenMoveBroadcast({ sid: _TOKEN_MOVE_SID, nome: MAPA_STATE.dragging, x, y, mapId: MAPA_STATE.mapaAtualId, contexto: 'campanha' });
  }
  // Atualizar círculo de alcance se for o atacante atual a se mover
  if (MAPA_STATE._rangeCircle && MAPA_STATE._rangeCircle.atacanteNome === MAPA_STATE.dragging) {
    const circleEl = document.getElementById('atk-range-circle');
    if (circleEl && circleEl.style.display !== 'none') {
      circleEl.style.left = x + '%';
      circleEl.style.top  = y + '%';
    }
    // Throttle: atualizar destaques de alvos durante movimento (a cada 300ms)
    if (ATAQUE_MAPA_STATE.ativo && ATAQUE_MAPA_STATE.fase === 'alvos') {
      const now2 = Date.now();
      if (!MAPA_STATE._lastAlvoUpdate || now2 - MAPA_STATE._lastAlvoUpdate > 300) {
        MAPA_STATE._lastAlvoUpdate = now2;
        atkMontarSelecaoAlvo();
        _mapaAtaqueDestacarAlvos();
      }
    }
  }
  // Debounce save
  clearTimeout(MAPA_STATE.dragTimer);
  const nomeSnap  = MAPA_STATE.dragging;
  const posSnap   = JSON.parse(JSON.stringify(c.map_positions));
  const mapIdSnap = c.active_map_id;
  MAPA_STATE.dragTimer = setTimeout(async () => {
    try {
      await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nomeSnap)}`, {
        method:'PATCH', body: JSON.stringify({ active_map_id: mapIdSnap, map_positions: posSnap })
      });
    } catch(err) {}
  }, 400);
}

async function mapaFimDrag(e) {
  if (!MAPA_STATE.dragging) return;
  const nome = MAPA_STATE.dragging;
  MAPA_STATE.dragging = null;
  const _moveu = MAPA_STATE.tokenMoveu;
  if (_moveu) {
    const _c = RPG_DATA?.characters?.find(ch => ch.nome === nome);
    const _pos = _c ? (_c.map_positions || {})[MAPA_STATE.mapaAtualId] : null;
    if (_pos) HUB_EVENTS.emit('token_moveu', { nome, paraCelula: _pos });
  }
  // Reseta apos o evento click ter chance de checar a flag
  setTimeout(() => { MAPA_STATE.tokenMoveu = false; }, 300);
  clearTimeout(MAPA_STATE.dragTimer);
  const c = RPG_DATA.characters.find(ch => ch.nome === nome);
  if (c) {
    try {
      await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nome)}`, {
        method:'PATCH', body: JSON.stringify({ active_map_id: c.active_map_id, map_positions: c.map_positions })
      });
    } catch(err) {}
    mapaRenderStatus();
  }
  const tokenEl = document.querySelector(`.mapa-token[data-nome="${CSS.escape(nome)}"]`);
  if (tokenEl) {
    tokenEl.style.cursor = 'grab';
    tokenEl.removeEventListener('pointermove', mapaOnDrag);
    tokenEl.removeEventListener('pointerup', mapaFimDrag);
  }
  // Atualizar alvos disponíveis se personagem movido for o atacante atual
  if (_moveu) _mapaAtaqueAtualizarAposMovimento(nome);
}

// ── POSICIONAR PERSONAGEM PELO BOTÃO 📌 ──────────────────────
function mapaPosicionarChar(nome) {
  const wrap = document.getElementById('mapa-wrap');
  mostrarToast(`Toque no mapa para posicionar ${nome}`, '');
  const onceClick = (e) => {
    const rect = wrap.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, (e.clientX - rect.left) / rect.width * 100));
    const y = Math.max(2, Math.min(98, (e.clientY - rect.top) / rect.height * 100));
    setCharActiveMap(nome, MAPA_STATE.mapaAtualId, x, y).then(() => {
      const mapas = RPG_DATA.mapas || [];
      const entry = mapas.find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
      if (entry) mapaRenderTokens(entry.mapa);
      mapaRenderStatus();
    });
    wrap.removeEventListener('click', onceClick);
  };
  wrap.addEventListener('click', onceClick);
}

// ── MODO BATALHA ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
// ⚔ SISTEMA DE BATALHA — MÚLTIPLAS BATALHAS SIMULTÂNEAS
// ══════════════════════════════════════════════════════════════

// ── UTILITÁRIOS ───────────────────────────────────────────────
function batalhaNovaId(mapaId) {
  return `b_${mapaId}_${Date.now()}`;
}

function batalhaDoMapa(mapaId) {
  return Object.values(MAPA_STATE.batalhas).find(b => b.mapa_id === mapaId && b.ativa) || null;
}

function batalhaBuscaMinhaAtiva() {
  // Retorna batalhas nas quais o jogador atual participa
  const meuNome = RPG_DATA?.linked;
  const isMestre = RPG_DATA?.myRole === 'mestre';
  return Object.values(MAPA_STATE.batalhas).filter(b => {
    if (!b.ativa) return false;
    if (isMestre) return true;
    return b.participantes?.some(p => p.nome === meuNome);
  });
}

function jogadorEstaOnline(nomePersonagem) {
  // Verifica se o jogador com esse personagem vinculado está online (visto nos últimos 30s)
  const agora = Date.now();
  return CHAT.online.some(u => u.nick === nomePersonagem && (agora - u.ts) < 35000);
}

function personagemTemJogador(nomePersonagem) {
  // Retorna true se algum jogador (não mestre) tem esse personagem vinculado
  return !!(RPG_DATA?.membrosLinked?.[nomePersonagem]);
}

function mestreDeveJogarPor(participante) {
  // O mestre deve jogar por um participante se:
  // 1. É um NPC, OU
  // 2. É um personagem sem jogador vinculado
  return participante.tipo === 'npc' || !personagemTemJogador(participante.nome);
}

function batalhaParticipantesDoMapa(mapaId) {
  // Apenas personagens com active_map_id EXATO neste mapa.
  // Tokens projetados de submapas filhos NÃO participam da batalha deste mapa —
  // eles só aparecem visualmente. A batalha deles é no mapa onde estão de fato.
  const chars = RPG_DATA.characters || [];
  return chars.filter(c => c.active_map_id === mapaId);
}

// Retorna o ID da batalha da qual o jogador atual (linked) participa.
// Para o mestre, retorna BATALHA_ATUAL_ID (batalha sendo visualizada).
function batalhaIdMinha() {
  if (RPG_DATA?.myRole === 'mestre') return BATALHA_ATUAL_ID;
  const meuNome = RPG_DATA?.linked;
  if (!meuNome) return BATALHA_ATUAL_ID;
  const entrada = Object.entries(MAPA_STATE.batalhas).find(([, b]) =>
    b.ativa && b.participantes?.some(p => p.nome === meuNome)
  );
  return entrada ? entrada[0] : null;
}

// Retorna o objeto batalha do jogador atual (ou null).
function batalhaMinha() {
  const id = batalhaIdMinha();
  return id ? (MAPA_STATE.batalhas[id] || null) : null;
}

// ── Helper: retorna cooldowns ativos de uma batalha de campanha ──────────
function getCooldownsBatalha(bid) {
  if (!bid) return {};
  const bs = MAPA_STATE.batalhas[bid];
  return (bs?.cooldowns && typeof bs.cooldowns === 'object') ? bs.cooldowns : {};
}

// ── PERSISTÊNCIA ─────────────────────────────────────────────
async function salvarEstadoBatalha(bid) {
  const ids = bid ? [bid] : Object.keys(MAPA_STATE.batalhas);
  const rpgId = RPG_DATA.rpgId;
  try {
    await Promise.all(ids.map(id => {
      const bs = MAPA_STATE.batalhas[id];
      if (!bs) return;
      return sb(`batalhas?rpg_id=eq.${encodeURIComponent(rpgId)}&id=eq.${encodeURIComponent(id)}`, {
        method:'PATCH',
        body:JSON.stringify({
          mapa_id:bs.mapa_id, mapa_nome:bs.mapa_nome,
          ativa:bs.ativa, pausada:bs.pausada, turno_round:bs.turnoRound, fase:bs.fase,
          ordem_atual:bs.ordemAtual, participantes:bs.participantes,
          iniciativas_roladas:bs.iniciativasRoladas, empatados:bs.empatados,
          dado_sel:bs.dadoSel||null, cooldowns:bs.cooldowns||{},
        })
      });
    }));
  } catch(e) {}
}

async function criarBatalhaRemota(bid) {
  const bs = MAPA_STATE.batalhas[bid];
  if (!bs) return;
  const rpgId = RPG_DATA.rpgId;
  try {
    await sb('batalhas', {
      method:'POST',
      body:JSON.stringify({
        rpg_id:rpgId, id:bid,
        mapa_id:bs.mapa_id, mapa_nome:bs.mapa_nome,
        ativa:bs.ativa, pausada:bs.pausada, turno_round:bs.turnoRound, fase:bs.fase,
        ordem_atual:bs.ordemAtual, participantes:bs.participantes,
        iniciativas_roladas:bs.iniciativasRoladas, empatados:bs.empatados,
        dado_sel:bs.dadoSel||null, cooldowns:bs.cooldowns||{},
      })
    });
  } catch(e) {}
}

// ── REALTIME — receber linha da tabela batalhas ───────────────
function batalhaReceberLinhaRemota(rec) {
  if (!rec || !rec.id) return;
  const bs = {
    id:rec.id, mapa_id:rec.mapa_id, mapa_nome:rec.mapa_nome,
    ativa:rec.ativa, pausada:rec.pausada, turnoRound:rec.turno_round, fase:rec.fase,
    participantes:Array.isArray(rec.participantes)?rec.participantes:[],
    ordemAtual:rec.ordem_atual,
    iniciativasRoladas:(rec.iniciativas_roladas&&typeof rec.iniciativas_roladas==='object')?rec.iniciativas_roladas:{},
    empatados:Array.isArray(rec.empatados)?rec.empatados:[],
    dadoSel:rec.dado_sel||null,
    cooldowns:(rec.cooldowns&&typeof rec.cooldowns==='object')?rec.cooldowns:{},
  };
  const bd = { ...MAPA_STATE.batalhas, [bs.id]: bs };
  batalhaReceberEstadoRemoto(bd);
}

// ── REALTIME ─────────────────────────────────────────────────
function batalhaReceberEstadoRemoto(raw) {
  try {
    const bd = typeof raw === 'object' ? raw : JSON.parse(raw || '{}');
    if (!bd || typeof bd !== 'object') return;
    const meuNome = RPG_DATA?.linked;
    const isMestre = RPG_DATA?.myRole === 'mestre';

    // Detectar mudanças relevantes para este cliente
    Object.entries(bd).forEach(([bid, bs]) => {
      const anterior = MAPA_STATE.batalhas[bid];

      // Batalha encerrada remotamente
      if (anterior?.ativa && !bs.ativa) {
        mostrarToast(`Batalha em "${bs.mapa_nome || bs.mapa_id}" encerrada`, '');
      }

      // Nova batalha que me inclui
      if (!anterior && bs.ativa) {
        const meInclui = isMestre || bs.participantes?.some(p => p.nome === meuNome);
        if (meInclui) mostrarToast(`⚔ Nova batalha em "${bs.mapa_nome || bs.mapa_id}"!`, '');
      }

      // Mudança de fase ou vez
      if (anterior && bs.ativa) {
        const meInclui = isMestre || bs.participantes?.some(p => p.nome === meuNome);
        if (!meInclui) return;

        if (anterior.fase !== 'combate' && bs.fase === 'combate') {
          mostrarToast('⚔ Iniciativa definida! Combate iniciado!', '');
        }
        if (bs.fase === 'combate' && bs.ordemAtual !== anterior.ordemAtual) {
          _notificarVez(bs, bid);
        }
        if ((bs.fase === 'iniciativa' || bs.fase === 'empate') && bs.empatados?.includes(meuNome)) {
          document.getElementById('ini-modal-aviso').textContent = '⚠ Empate! Role novamente.';
          document.getElementById('ini-modal-aviso').style.display = 'block';
          BATALHA_ATUAL_ID = bid; // sincronizar para esta batalha antes de abrir o modal
          abrirModalIniciativa();
        }
      }
    });

    MAPA_STATE.batalhas = bd;

    // Verificar TODAS as batalhas em fase iniciativa (não só a atual)
    if (RPG_DATA?.myRole === 'mestre') {
      Object.entries(MAPA_STATE.batalhas).forEach(([bid, bs]) => {
        if (bs.ativa && (bs.fase === 'iniciativa' || bs.fase === 'empate')) {
          batalhaVerificarIniciativasCompletas(bid);
        }
      });
    }

    // Jogadores: sincronizar BATALHA_ATUAL_ID para a própria batalha
    if (RPG_DATA?.myRole !== 'mestre') {
      const minhaId = batalhaIdMinha();
      if (minhaId) BATALHA_ATUAL_ID = minhaId;
    }

    // Atualizar UI se o mapa atual tem batalha
    const bAtual = batalhaDoMapa(MAPA_STATE.mapaAtualId);
    if (bAtual && RPG_DATA?.myRole === 'mestre') {
      BATALHA_ATUAL_ID = Object.keys(MAPA_STATE.batalhas).find(k => MAPA_STATE.batalhas[k] === bAtual);
    }
    _aplicarEstadoBatalhaUI();
    _atualizarBadgeMesa();
    _atualizarSeletorBatalhas();
  } catch(e) {}
}

function _notificarVez(bs, bid) {
  const atual = bs.participantes[bs.ordemAtual];
  if (!atual) return;
  const meuNome = RPG_DATA?.linked;
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const ehMinhaVez = atual.nome === meuNome || (isMestre && mestreDeveJogarPor(atual));
  const mapaLabel = bs.mapa_nome || bs.mapa_id || '';
  if (ehMinhaVez) mostrarToast(`⚔ Sua vez! — ${atual.nome} (${mapaLabel})`, '');
  else mostrarToast(`↻ Vez de ${atual.nome} — ${mapaLabel}`, '');
  _atualizarBadgeMesa();
}

// ── BADGE NA ABA MESA ─────────────────────────────────────────
function _atualizarBadgeMesa() {
  const badge = document.getElementById('mesa-batalha-badge');
  if (!badge) return;
  const meuNome = RPG_DATA?.linked;
  const isMestre = RPG_DATA?.myRole === 'mestre';
  // Contar batalhas onde é minha vez agora
  const minhaVez = Object.values(MAPA_STATE.batalhas).filter(b => {
    if (!b.ativa || b.fase !== 'combate' || b.pausada) return false;
    const atual = b.participantes?.[b.ordemAtual];
    if (!atual) return false;
    return atual.nome === meuNome || (isMestre && mestreDeveJogarPor(atual));
  });
  const count = minhaVez.length;
  // Também mostrar se há batalha ativa com fase iniciativa onde ainda não rolei
  const pendIniciativa = Object.values(MAPA_STATE.batalhas).filter(b => {
    if (!b.ativa || (b.fase !== 'iniciativa' && b.fase !== 'empate')) return false;
    if (!meuNome) return false;
    const participo = b.participantes?.some(p => p.nome === meuNome);
    const jaRolei = b.iniciativasRoladas?.[meuNome] != null && !b.empatados?.includes(meuNome);
    return participo && !jaRolei;
  }).length;
  const total = count + pendIniciativa;
  badge.style.display = total > 0 ? 'flex' : 'none';
  badge.textContent = total > 1 ? total : '⚔';
}

// ── SELETOR DE BATALHAS (mestre) ──────────────────────────────
function _atualizarSeletorBatalhas() {
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const wrap = document.getElementById('batalhas-selector');
  if (!wrap) return;
  const batalhasAtivas = Object.entries(MAPA_STATE.batalhas).filter(([,b]) => b.ativa);

  if (!isMestre) {
    // Jogador: ocultar o seletor — eles não navegam entre batalhas
    wrap.style.display = 'none';
    return;
  }

  // Mestre: mostrar seletor quando há 2+ batalhas simultâneas
  if (batalhasAtivas.length <= 1) { wrap.style.display = 'none'; return; }

  wrap.style.display = 'flex';
  wrap.innerHTML = batalhasAtivas.map(([bid, b]) => {
    const isAtual = bid === BATALHA_ATUAL_ID;
    const atual = b.participantes?.[b.ordemAtual];
    const minhaVez = (atual && mestreDeveJogarPor(atual)) || atual?.nome === RPG_DATA?.linked;
    const mapaLabel = b.mapa_nome || b.mapa_id || '?';
    const faseIcon = b.fase === 'combate' ? '⚔' : '🎲';
    return `<button onclick="batalhaAlternarPara('${bid}')"
      title="Mapa: ${mapaLabel}${b.pausada?' (pausada)':''}"
      style="padding:5px 10px;background:${isAtual?'rgba(192,57,43,0.2)':'rgba(20,29,43,0.8)'};border:1px solid ${isAtual?'rgba(192,57,43,0.5)':'var(--borda)'};border-radius:6px;color:${isAtual?'#e74c3c':'var(--suave)'};font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:1px">
      <span>${minhaVez?'⚔ ':''}${faseIcon} ${mapaLabel}${b.pausada?' ⏸':''}</span>
      ${isAtual?`<span style="font-size:0.5rem;opacity:0.6">▶ visualizando</span>`:''}
    </button>`;
  }).join('');
}

function batalhaAlternarPara(bid) {
  const b = MAPA_STATE.batalhas[bid];
  if (b?.mapa_id) {
    // Navegar ao mapa da batalha — selecionarMapa definirá BATALHA_ATUAL_ID automaticamente
    selecionarMapa(b.mapa_id);
  } else {
    _aplicarEstadoBatalhaUI();
    _atualizarSeletorBatalhas();
  }
}

// ── MODAL: ESCOLHER PARTICIPANTES ────────────────────────────

// ════════════════════════════════════════════════════════════════════════════
// FASE 4 — SESSÃO E NARRATIVA
// ════════════════════════════════════════════════════════════════════════════

let SESSAO_ATUAL = {
  nome: '', sistema: '', cenas: [], cenaAtualId: null,
  organograma: { nos: {} },
};

// ── 4.1 Parser do Pacote de Sessão ───────────────────────────────────────
function _parseCoordenada(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return null;
  const col = m[1].toUpperCase().split('').reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
  const row = parseInt(m[2]) - 1;
  return { col, row };
}
function _parseRetangulo(s) {
  if (!s) return null;
  const partes = s.split(':');
  if (partes.length !== 2) return null;
  const p1 = _parseCoordenada(partes[0]);
  const p2 = _parseCoordenada(partes[1]);
  if (!p1 || !p2) return null;
  return { c1: p1.col, r1: p1.row, c2: p2.col, r2: p2.row };
}

function parsePacote(texto) {
  const linhas = texto.split('\n');
  const resultado = [];
  let cenaAtual = null;
  for (let i = 0; i < linhas.length; i++) {
    const raw = linhas[i].trim();
    if (!raw || raw.startsWith('//') || raw.startsWith('#')) continue;
    const r = _parseLinha(raw, cenaAtual);
    resultado.push({ linha: raw, idx: i, ...r });
    if (r.status !== 'erro' && r.acao?.tipo === 'cena') cenaAtual = r.acao.cena_id;
  }
  return resultado;
}

function _parseLinha(raw, cenaAtual) {
  if (/^SESS[ÃA]O:/i.test(raw)) {
    const m = raw.match(/^SESS[ÃA]O:\s*"?([^"|]+)"?/i);
    const nome = m?.[1]?.trim() || 'Sessão';
    const sistema = raw.match(/sistema:\s*([\w.]+)/i)?.[1] || '';
    return { status:'ok', acao:{ tipo:'sessao', nome, sistema } };
  }
  if (/^CENA\s+\d+/i.test(raw)) {
    const nMatch = raw.match(/^CENA\s+(\d+)/i);
    const cenario  = raw.match(/cenario:\s*([\w_-]+)/i)?.[1] || null;
    const condicao = raw.match(/condicao:\s*([\w_]+)/i)?.[1] || null;
    const musica   = raw.match(/musica:\s*([\w_]+)/i)?.[1] || null;
    const n = nMatch?.[1] || '0';
    const cena_id = 'cena_' + n;
    if (cenario) {
      const mapaExiste = (RPG_DATA?.mapas||[]).some(l => l.mapa.map_id === cenario);
      if (!mapaExiste) return { status:'aviso', msg:"Cenário '" + cenario + "' não encontrado — cena criada sem mapa", acao:{ tipo:'cena', cena_id, cenario:null, condicao, musica } };
    }
    return { status:'ok', acao:{ tipo:'cena', cena_id, cenario, condicao, musica } };
  }
  if (/^NARRA[ÇC][ÃA]O:/i.test(raw)) {
    const texto = raw.replace(/^NARRA[ÇC][ÃA]O:\s*/i,'').replace(/^"|"$/g,'');
    return { status:'ok', acao:{ tipo:'narracao', texto, cena_id: cenaAtual } };
  }
  if (/^SPAWN:/i.test(raw)) {
    const body = raw.replace(/^SPAWN:\s*/i,'');
    const tokens = body.split('|').map(t => t.trim());
    const spawns = []; let temErro = false;
    for (const tok of tokens) {
      const m = tok.match(/^([\w\s]+)\s+([A-Za-z]+\d+)/);
      if (!m) continue;
      const nomeRaw = m[1].trim();
      const coord   = _parseCoordenada(m[2]);
      const comportamento = tok.match(/comportamento:\s*(\w+)/i)?.[1] || null;
      const alvoFixo      = tok.match(/alvo_fixo:\s*([\w\s]+)/i)?.[1]?.trim() || null;
      const char = (RPG_DATA?.characters||[]).find(c => c.nome.toLowerCase() === nomeRaw.toLowerCase());
      if (!char) { spawns.push({ erro:true, nome:nomeRaw, msg:"Personagem não encontrado: '" + nomeRaw + "'" }); temErro = true; }
      else spawns.push({ nome:char.nome, coord, comportamento, alvoFixo, corrigido: char.nome !== nomeRaw });
    }
    if (!spawns.length) return { status:'erro', msg:'Nenhum personagem válido no SPAWN' };
    if (temErro && spawns.every(s => s.erro)) return { status:'erro', msg: spawns.map(s=>s.msg).join('; '), acao:null };
    const status = spawns.some(s=>s.corrigido) ? 'aviso' : spawns.some(s=>s.erro) ? 'aviso' : 'ok';
    return { status, msg: spawns.filter(s=>s.corrigido).map(s=>"'" + s.nome + "' (corrigido)").join(', ')||null, acao:{ tipo:'spawn', spawns, cena_id: cenaAtual } };
  }
  if (/^FOG:/i.test(raw)) {
    const cmd = raw.replace(/^FOG:\s*/i,'').trim();
    if (cmd === 'revelar_gradual') return { status:'ok', acao:{ tipo:'fog', modo:'gradual', cena_id: cenaAtual } };
    if (cmd === 'sem_fog')         return { status:'ok', acao:{ tipo:'fog', modo:'desativar', cena_id: cenaAtual } };
    const rect = _parseRetangulo(cmd);
    if (!rect) return { status:'erro', msg:"Coordenada inválida: '" + cmd + "'" };
    return { status:'ok', acao:{ tipo:'fog', modo:'revelar_rect', rect, cena_id: cenaAtual } };
  }
  if (/^ZONA:/i.test(raw)) {
    const body = raw.replace(/^ZONA:\s*/i,'');
    const labelM = body.match(/"([^"]+)"/);
    const label  = labelM?.[1] || 'Zona';
    const partes = body.replace(/"[^"]*"/, '').trim().split(/\s+/);
    const tipo   = partes[0]?.toLowerCase() || 'interesse';
    const coord  = _parseCoordenada(partes[1]);
    if (!coord) return { status:'aviso', msg:'Coordenada de zona inválida — ignorada', acao:null };
    return { status:'ok', acao:{ tipo:'zona', zona_tipo: tipo, coord, label, cena_id: cenaAtual } };
  }
  if (/^BATALHA:/i.test(raw)) return { status:'ok', acao:{ tipo:'batalha', cmd:'iniciar', cena_id: cenaAtual } };
  if (/^ORGANOGRAMA:/i.test(raw)) {
    const nome = raw.replace(/^ORGANOGRAMA:\s*/i,'').replace(/^"|"$/g,'');
    return { status:'ok', acao:{ tipo:'organograma', nome } };
  }
  if (/^N[ÓO]:/i.test(raw)) {
    const m = raw.match(/^N[ÓO]:\s*(\w+)\s+"([^"]+)"/i);
    if (!m) return { status:'aviso', msg:'Formato de NÓ inválido', acao:null };
    return { status:'ok', acao:{ tipo:'no_organograma', no_id: m[1], label: m[2] } };
  }
  if (/^requer:|^tem:|^conecta:/i.test(raw)) return { status:'ok', acao:{ tipo:'no_detalhe', raw } };
  return { status:'aviso', msg:'Linha não reconhecida — ignorada', acao:null };
}

async function pacoteAplicar(resultado) {
  const mapId = MAPA_STATE?.mapaAtualId;
  for (const item of resultado) {
    if (item.status === 'erro' || !item.acao) continue;
    const a = item.acao;
    switch (a.tipo) {
      case 'sessao': SESSAO_ATUAL.nome = a.nome; SESSAO_ATUAL.sistema = a.sistema; break;
      case 'cena':
        if (!SESSAO_ATUAL.cenas.find(c => c.id === a.cena_id))
          SESSAO_ATUAL.cenas.push({ id:a.cena_id, cenario:a.cenario, condicao:a.condicao, musica:a.musica, status:'disponivel', narracao:'', comandos:[], afetada:false });
        break;
      case 'narracao': { const cn = SESSAO_ATUAL.cenas.find(c => c.id === a.cena_id); if (cn) cn.narracao = a.texto; break; }
      case 'spawn':
        for (const s of (a.spawns||[])) {
          if (s.erro || !s.coord) continue;
          await setCharActiveMap(s.nome, mapId, s.coord.col, s.coord.row);
          if (s.comportamento) {
            const c = (RPG_DATA?.characters||[]).find(ch => ch.nome === s.nome);
            if (c) { c.custom_attrs = c.custom_attrs||{}; c.custom_attrs.comportamento = s.comportamento; }
          }
        }
        { const entry = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === mapId); if (entry) mapaRenderTokens(entry.mapa); }
        break;
      case 'fog':
        if (a.modo === 'revelar_rect') fogRevealRect(mapId, a.rect.c1, a.rect.r1, a.rect.c2, a.rect.r2);
        else if (a.modo === 'desativar') { FOG_STATE.mapas[mapId] = {}; fogRenderizar(mapId); }
        else if (a.modo === 'gradual')   { fogInicializar(mapId, _getMapaById(mapId)); fogRenderizar(mapId); }
        break;
      case 'zona': {
        const mapaZ = _getMapaById(mapId);
        if (mapaZ && a.coord) {
          if (!mapaZ.locais) mapaZ.locais = [];
          const W = mapaZ.largura_total||20, H = mapaZ.altura_total||20;
          mapaZ.locais = mapaZ.locais.filter(l => l.nome !== a.label);
          mapaZ.locais.push({ local_id:'zona_'+Date.now(), nome:a.label, zona_tipo:a.zona_tipo,
            x: parseFloat(((a.coord.col+0.5)/W*100).toFixed(1)), y: parseFloat(((a.coord.row+0.5)/H*100).toFixed(1)), raio:15 });
          HUB_EVENTS.emit('zona_ativada', { zona: a.label, tipo: a.zona_tipo });
        }
        break;
      }
      case 'organograma': SESSAO_ATUAL.organograma.nome = a.nome; break;
    }
  }
  const ef = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === mapId);
  if (ef) { mapaRenderTokens(ef.mapa); fogRenderizar(mapId); }
  sessionRenderPainel();
}

function pacoteMostrarConfirmacao(resultado) {
  const ok = resultado.filter(r => r.status==='ok').length;
  const av = resultado.filter(r => r.status==='aviso').length;
  const er = resultado.filter(r => r.status==='erro').length;
  let modal = document.getElementById('modal-pacote-confirmacao');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-pacote-confirmacao';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);align-items:flex-end;justify-content:center';
    modal.innerHTML = `<div style="background:var(--painel,#141d2b);border-radius:16px 16px 0 0;padding:20px;width:100%;max-width:600px;max-height:80vh;display:flex;flex-direction:column;gap:12px"><div style="display:flex;justify-content:space-between;align-items:center"><div style="font-family:var(--fonte-d);font-size:0.85rem;color:var(--texto)">Pacote de Sessão</div><button onclick="document.getElementById('modal-pacote-confirmacao').style.display='none'" style="background:none;border:none;color:var(--suave);cursor:pointer;font-size:1.1rem">✕</button></div><div id="pacote-resumo" style="font-size:0.78rem;color:var(--suave)"></div><div id="pacote-linhas" style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:4px"></div><div style="display:flex;gap:8px"><button onclick="pacoteAplicar(window._pacoteResultado).then(()=>{ document.getElementById('modal-pacote-confirmacao').style.display='none'; mostrarToast('✓ Pacote aplicado','ok'); })" style="flex:1;padding:11px;background:rgba(39,174,96,0.12);border:1px solid rgba(39,174,96,0.4);border-radius:8px;color:#5ee09a;font-family:var(--fonte-d);font-size:0.7rem;cursor:pointer">✓ Confirmar e aplicar</button><button onclick="document.getElementById('modal-pacote-confirmacao').style.display='none'" style="padding:11px 18px;background:none;border:1px solid var(--borda);border-radius:8px;color:var(--suave);font-family:var(--fonte-d);font-size:0.7rem;cursor:pointer">Revisar</button></div></div>`;
    document.body.appendChild(modal);
  }
  window._pacoteResultado = resultado;
  document.getElementById('pacote-resumo').innerHTML = '<span style="color:#5ee09a">✓ '+ok+' aplicadas</span> · <span style="color:#f0cc6a">⚠ '+av+' corrigidas</span> · <span style="color:#e74c3c">✗ '+er+' ignoradas</span>';
  document.getElementById('pacote-linhas').innerHTML = resultado.map(r => {
    const cor  = r.status==='ok' ? '#5ee09a' : r.status==='aviso' ? '#f0cc6a' : '#e74c3c';
    const icon = r.status==='ok' ? '✓' : r.status==='aviso' ? '⚠' : '✗';
    return '<div style="display:flex;gap:8px;align-items:flex-start;padding:4px 8px;background:rgba(255,255,255,0.03);border-radius:5px;border-left:2px solid '+cor+'"><span style="color:'+cor+';flex-shrink:0;font-size:0.75rem;margin-top:1px">'+icon+'</span><div style="flex:1;min-width:0"><div style="font-size:0.7rem;color:var(--texto);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+r.linha+'</div>'+(r.msg?'<div style="font-size:0.65rem;color:'+cor+';margin-top:1px">'+r.msg+'</div>':'')+'</div></div>';
  }).join('');
  modal.style.display = 'flex';
}

window.processarPacoteSessao = function(texto) {
  if (!texto?.trim()) { mostrarToast('Cole o pacote de sessão primeiro', 'aviso'); return; }
  pacoteMostrarConfirmacao(parsePacote(texto));
};

// ── 4.2 Pool de cenas ─────────────────────────────────────────────────────
function sessionRenderPainel() {
  const el = document.getElementById('session-cenas-painel');
  if (!el) return;
  if (!SESSAO_ATUAL.cenas.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--suave);font-style:italic;font-size:0.82rem">Nenhuma cena carregada.<br>Cole um Pacote de Sessão para começar.</div>';
    return;
  }
  el.innerHTML = SESSAO_ATUAL.cenas.map(cena => {
    const corStatus = { disponivel:'rgba(79,163,209,0.4)', afetada:'rgba(200,168,75,0.5)', usada:'rgba(122,146,170,0.25)' }[cena.status]||'var(--borda)';
    const labelStatus = { disponivel:'disponível', afetada:'⚠ afetada', usada:'usada' }[cena.status]||'';
    return '<div style="border:1px solid '+corStatus+';border-radius:9px;padding:10px 12px;margin-bottom:6px;background:rgba(15,21,32,0.7);opacity:'+(cena.status==='usada'?'0.5':'1')+'"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div style="font-family:var(--fonte-d);font-size:0.78rem;color:var(--texto)">'+cena.id.replace('_',' ')+'</div><span style="font-size:0.6rem;color:'+corStatus.replace('0.4','0.8').replace('0.5','0.8').replace('0.25','0.5')+'">'+labelStatus+'</span></div>'+(cena.narracao?'<div style="font-size:0.72rem;color:var(--suave);font-style:italic;margin-bottom:6px">"'+cena.narracao.slice(0,80)+(cena.narracao.length>80?'…':'')+'…"</div>':'')+(cena.cenario?'<div style="font-size:0.65rem;color:rgba(79,163,209,0.7)">🗺 '+cena.cenario+'</div>':'')+(cena.afetada?'<div style="font-size:0.65rem;color:#f0cc6a;margin-top:4px">⚠ Afetada por mudanças na sessão</div>':'')+(cena.status!=='usada'?'<button onclick="sessionAtivarCena(\'' + cena.id + '\')" style="margin-top:8px;width:100%;padding:7px;background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.25);border-radius:7px;color:var(--primario-v);font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer">▶ Ativar cena</button>':'')+'</div>';
  }).join('');
}

async function sessionAtivarCena(cenaId) {
  const cena = SESSAO_ATUAL.cenas.find(c => c.id === cenaId);
  if (!cena) return;
  if (cena.afetada && !confirm('⚠ Esta cena foi afetada por mudanças. Ativar mesmo assim?')) return;
  if (cena.cenario) {
    const entry = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === cena.cenario);
    if (entry) { MAPA_STATE.mapaAtualId = cena.cenario; mapaRenderizar(entry.mapa); }
  }
  if (cena.narracao) {
    HUB_EVENTS.emit('cena_carregada', { cena_id: cenaId, nome: cena.id, narracao: cena.narracao });
    mostrarToast('📖 ' + cena.narracao.slice(0, 60) + '…', '', 5000);
  }
  cena.status = 'usada'; SESSAO_ATUAL.cenaAtualId = cenaId; sessionRenderPainel();
}

// ── 4.3 Organograma narrativo ─────────────────────────────────────────────
function orgAddNo(noId, label, requer, tem, conexoes) {
  SESSAO_ATUAL.organograma.nos[noId] = { label:label||noId, requer:Array.isArray(requer)?requer:[], tem:Array.isArray(tem)?tem:[], conexoes:conexoes||{}, visitado:false };
}
function orgNavegar(saidaId) {
  const noAtual = SESSAO_ATUAL.organograma.nos[SESSAO_ATUAL.cenaAtualId];
  if (!noAtual) return;
  const destino = noAtual.conexoes[saidaId];
  if (destino) { const cena = SESSAO_ATUAL.cenas.find(c => c.id === destino); if (cena) sessionAtivarCena(destino); noAtual.visitado = true; }
}
HUB_EVENTS.on('zona_ativada', ({ zona }) => {
  const noAtual = SESSAO_ATUAL.organograma.nos[SESSAO_ATUAL.cenaAtualId];
  if (!noAtual) return;
  const destino = noAtual.conexoes[zona];
  if (destino) { mostrarToast('🚪 Transição para ' + destino, ''); sessionAtivarCena(destino); }
});

// ── 4.4 Biblioteca de elementos ──────────────────────────────────────────
let BIBLIOTECA_CENA = {
  estruturais: ['corredor','sala_aberta','praça','floresta','caverna','telhado','beco'],
  passagens:   ['porta_norte','porta_sul','porta_leste','porta_oeste','escada_baixo','escada_cima','portal'],
  zonas:       ['altar','bau','armadilha','mercador','NPC_amigavel','NPC_hostil','item_chao'],
  atmosfera:   ['noite','nevoa','chuva','incendio','abandono','festa'],
};
function bibliotecaCarregarDoLore() {
  const loreEntry = (RPG_DATA?.lore||[]).find(l => l.secao === 'cena_biblioteca');
  if (loreEntry?.conteudo) { try { const p = JSON.parse(loreEntry.conteudo); if (p&&typeof p==='object') BIBLIOTECA_CENA = {...BIBLIOTECA_CENA,...p}; } catch(e) {} }
}

// ── 4.5 Geração aleatória ────────────────────────────────────────────────
function gerarCenaAleatoria(sel) {
  sel = sel || {};
  const estrutural = (sel.estruturais?.length) ? sel.estruturais[Math.floor(Math.random()*sel.estruturais.length)] : BIBLIOTECA_CENA.estruturais[Math.floor(Math.random()*BIBLIOTECA_CENA.estruturais.length)];
  const passagens  = sel.passagens?.length ? sel.passagens : [BIBLIOTECA_CENA.passagens[Math.floor(Math.random()*BIBLIOTECA_CENA.passagens.length)]];
  const zonasSel   = sel.zonas||[];
  const extras     = []; const qtd = 1+Math.floor(Math.random()*2);
  for (let i=0; i<qtd; i++) { const z = BIBLIOTECA_CENA.zonas[Math.floor(Math.random()*BIBLIOTECA_CENA.zonas.length)]; if (!zonasSel.includes(z)&&!extras.includes(z)) extras.push(z); }
  const novaCena = { id:'cena_gen_'+Date.now(), cenario:null, status:'disponivel', narracao:'', afetada:false, gerada:{ estrutural, passagens, zonas:[...zonasSel,...extras] }, comandos:[] };
  SESSAO_ATUAL.cenas.push(novaCena); sessionRenderPainel(); return novaCena;
}
window.abrirModalGeracaoCena = function() {
  let modal = document.getElementById('modal-gerar-cena');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-gerar-cena';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);align-items:flex-end;justify-content:center';
    modal.innerHTML = `<div style="background:var(--painel,#141d2b);border-radius:16px 16px 0 0;padding:20px;width:100%;max-width:580px;max-height:80vh;overflow-y:auto"><div style="font-family:var(--fonte-d);font-size:0.85rem;color:var(--texto);margin-bottom:14px">⚄ Gerar Cena Aleatória</div>'+Object.entries(BIBLIOTECA_CENA).map(([cat, itens]) => '<div style="margin-bottom:10px"><div style="font-size:0.6rem;color:var(--destaque);font-family:var(--fonte-d);text-transform:uppercase;margin-bottom:5px">'+cat+'</div><div style="display:flex;flex-wrap:wrap;gap:5px">'+itens.map(item => '<label style="display:flex;align-items:center;gap:4px;padding:3px 8px;border:1px solid var(--borda);border-radius:12px;cursor:pointer;font-size:0.65rem;color:var(--suave)"><input type="checkbox" value="'+item+'" data-cat="'+cat+'" style="accent-color:var(--destaque)"> '+item+'</label>').join('')+'</div></div>').join('')+'<button onclick="_confirmarGeracaoCena()" style="width:100%;margin-top:12px;padding:11px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.35);border-radius:8px;color:var(--destaque);font-family:var(--fonte-d);font-size:0.7rem;cursor:pointer">⚄ Gerar</button><button onclick="document.getElementById('modal-gerar-cena').style.display='none'" style="width:100%;margin-top:6px;padding:8px;background:none;border:1px solid var(--borda);border-radius:8px;color:var(--suave);font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer">Cancelar</button></div>`;

    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
};
window._confirmarGeracaoCena = function() {
  const checks = document.querySelectorAll('#modal-gerar-cena input[type=checkbox]:checked');
  const sel = {};
  checks.forEach(cb => { const cat = cb.dataset.cat; if (!sel[cat]) sel[cat] = []; sel[cat].push(cb.value); });
  const cena = gerarCenaAleatoria(sel);
  document.getElementById('modal-gerar-cena').style.display = 'none';
  mostrarToast('✓ Cena gerada: ' + cena.gerada.estrutural + ' com ' + cena.gerada.passagens.join(', '), 'ok');
};

// ── 4.6 Propagação de consequências ──────────────────────────────────────
function sessaoMarcarCenasAfetadas(nomeElemento) {
  if (!nomeElemento) return;
  const nl = nomeElemento.toLowerCase();
  SESSAO_ATUAL.cenas.forEach(cena => {
    if (cena.status === 'usada') return;
    if (cena.narracao?.toLowerCase().includes(nl) || (cena.gerada?.zonas||[]).some(z=>z.toLowerCase().includes(nl)) || cena.id.toLowerCase().includes(nl))
      cena.afetada = true;
  });
  sessionRenderPainel();
}
HUB_EVENTS.on('dano_aplicado', ({ alvo }) => {
  const c = (RPG_DATA?.characters||[]).find(ch => ch.nome === alvo);
  if (c?.custom_attrs?.morto) sessaoMarcarCenasAfetadas(alvo);
});

// ── 4.7 Proxy BATALHA_ATUAL_ID ─────────────────────────────────────────
let _batalhaAtualIdInterno = null;
Object.defineProperty(window, 'BATALHA_ATUAL_ID', {
  get() { return _batalhaAtualIdInterno; },
  set(v) {
    _batalhaAtualIdInterno = v;
    if (v && MAPA_STATE?.mapaAtualId) {
      if (!MAPA_STATE.batalhas[v]) MAPA_STATE.batalhas[v] = {};
      MAPA_STATE.batalhas[v].mapa_id = MAPA_STATE.mapaAtualId;
    }
  },
  configurable: true,
});


// ════════════════════════════════════════════════════════════════════════════
// FASE 6 — COMBATE E ITENS
// ════════════════════════════════════════════════════════════════════════════

// ── 6.1 Piloto automático NPC ─────────────────────────────────────────────
const NPC_PILOTO = {};

function npcTogglePiloto(nomeNpc) {
  NPC_PILOTO[nomeNpc] = !NPC_PILOTO[nomeNpc];
  mostrarToast(NPC_PILOTO[nomeNpc] ? '🤖 '+nomeNpc+' em piloto automático' : '🎮 '+nomeNpc+' em controle manual', '');
  const tokenEl = document.querySelector('.mapa-token[data-nome="'+CSS.escape(nomeNpc)+'"]');
  if (tokenEl) {
    let badge = tokenEl.querySelector('.piloto-badge');
    if (NPC_PILOTO[nomeNpc]) {
      if (!badge) { badge=document.createElement('div'); badge.className='piloto-badge'; badge.style.cssText='position:absolute;top:-5px;left:-5px;width:11px;height:11px;border-radius:50%;background:#b07ef0;border:1px solid rgba(0,0,0,0.8);font-size:6px;display:flex;align-items:center;justify-content:center;color:#fff;z-index:15;pointer-events:none'; badge.textContent='🤖'; tokenEl.appendChild(badge); }
    } else { badge?.remove(); }
  }
}

async function npcExecutarTurnoAuto(nomeNpc) {
  const c = (RPG_DATA?.characters||[]).find(ch => ch.nome === nomeNpc);
  if (!c) return;
  const comportamento = c.custom_attrs?.comportamento || 'agressivo';
  const mapId = MAPA_STATE?.mapaAtualId;
  if (!mapId) return;
  const acao = await _npcCalcAcao(nomeNpc, comportamento, mapId);
  if (acao.moverPara) { await _moverTokenPorSeta(nomeNpc, acao.moverPara.dc, acao.moverPara.dr); await new Promise(r=>setTimeout(r,200)); }
  if (acao.atacar) { COMBATE.contexto='campanha'; COMBATE.atacanteNome=nomeNpc; COMBATE.habilidadeSel=acao.atacar.skill; COMBATE.alvoNome=acao.atacar.alvo; COMBATE._habilidades=atkGetHabilidadesCampanha(nomeNpc); COMBATE._alvos=[]; COMBATE._jaAplicado=false; await atkRolarDados?.(); }
}

async function _npcCalcAcao(nomeNpc, comportamento, mapId) {
  const c = (RPG_DATA?.characters||[]).find(ch => ch.nome===nomeNpc); if (!c) return {};
  const ca=c.custom_attrs||{}; const pos=getPosicaoNoMapa(c,mapId); const hp=c.hp_atual??(ca.hp_max||100); const hpMax=ca.hp_max||100; const hpPct=hp/hpMax;
  const skills=atkGetHabilidadesCampanha(nomeNpc); const chars=RPG_DATA?.characters||[];
  const aliados  = chars.filter(x => { const ca2=x.custom_attrs||{}; return x.nome!==nomeNpc&&(ca2.tipo_personagem==='npc'||ca2.tipo==='npc')&&!ca2.morto&&x.active_map_id===mapId; });
  const inimigos = chars.filter(x => { const ca2=x.custom_attrs||{}; return ca2.tipo_personagem!=='npc'&&ca2.tipo!=='npc'&&!ca2.morto&&x.active_map_id===mapId; });
  const _maisDano  = () => skills.filter(s=>s.alvo_tipo==='inimigo').sort((a,b)=>{ const dA=a.formula_dano?.match(/\d+d(\d+)/)?.[1]||0,dB=b.formula_dano?.match(/\d+d(\d+)/)?.[1]||0; return parseInt(dB)-parseInt(dA); })[0];
  const _skillCura = () => skills.find(s=>s.alvo_tipo==='aliado'||s.tipo_dano==='cura');
  const _dist      = alvoNome => atkDistanciaCelulas(nomeNpc, alvoNome);
  const _maisProx  = lista => lista.reduce((b,x)=>{ const d=_dist(x.nome); return (d!==null&&(b===null||d<b.dist))?{char:x,dist:d}:b; }, null);
  const _fugir     = () => { const mp=_maisProx(inimigos); if(!mp) return null; const pi=getPosicaoNoMapa(mp.char,mapId); if(!pi||!pos) return null; return { dc:pos.col>pi.col?1:pos.col<pi.col?-1:0, dr:pos.row>pi.row?1:pos.row<pi.row?-1:0 }; };
  const _emDir     = alvoNome => { const pa=getPosicaoNoMapa((chars.find(x=>x.nome===alvoNome)),mapId); if(!pos||!pa) return null; return { dc:pa.col>pos.col?1:pa.col<pos.col?-1:0, dr:pa.row>pos.row?1:pa.row<pos.row?-1:0 }; };
  let alvoFixo=ca.alvo_fixo||null, moverPara=null, atacar=null;
  switch(comportamento) {
    case 'agressivo':{ const mp=_maisProx(inimigos); if(mp){const sk=_maisDano(); if(sk&&mp.dist<=(sk.alcance_celulas||1)){atacar={skill:sk,alvo:mp.char.nome};}else{moverPara=_emDir(mp.char.nome);}}} break;
    case 'defensivo':{ if(hpPct<0.4){moverPara=_fugir();}else{const mp=_maisProx(inimigos);if(mp){const sk=_maisDano();if(sk&&mp.dist<=(sk.alcance_celulas||1))atacar={skill:sk,alvo:mp.char.nome};}}} break;
    case 'suporte':  { const aMin=aliados.reduce((b,x)=>{const h=x.hp_atual??(x.custom_attrs?.hp_max||100),m=x.custom_attrs?.hp_max||100;return(!b||h/m<b.pct)?{char:x,pct:h/m}:b;},null); const sk=_skillCura(); if(aMin&&sk&&aMin.pct<0.7){const d=_dist(aMin.char.nome);if(d!==null&&d<=(sk.alcance_celulas||1)){atacar={skill:sk,alvo:aMin.char.nome};}else{moverPara=_emDir(aMin.char.nome);}}else{const mp=_maisProx(inimigos);if(mp){const sk2=_maisDano();if(sk2&&mp.dist<=(sk2.alcance_celulas||1))atacar={skill:sk2,alvo:mp.char.nome};else moverPara=_emDir(mp.char.nome);}}} break;
    case 'covarde':  { if(hpPct<0.6){moverPara=_fugir();}else{const mp=_maisProx(inimigos);if(mp&&mp.dist<=1){const sk=_maisDano();if(sk)atacar={skill:sk,alvo:mp.char.nome};}}} break;
    case 'protetor': { const mp=_maisProx(inimigos); if(mp){const sk=skills.find(s=>s.alvo_tipo==='aliado')||_maisDano();if(sk&&mp.dist<=(sk.alcance_celulas||1)){atacar={skill:sk,alvo:mp.char.nome};}else{moverPara=_emDir(mp.char.nome);}}} break;
    case 'berserk':  { const mp=_maisProx(inimigos); if(mp){const sk=_maisDano();if(sk){if(mp.dist<=(sk.alcance_celulas||1))atacar={skill:sk,alvo:mp.char.nome};else moverPara=_emDir(mp.char.nome);}}} break;
    case 'emboscador':{ const skR=skills.filter(s=>s.alvo_tipo==='inimigo'&&(s.alcance_celulas||1)>2).sort((a,b)=>(b.alcance_celulas||0)-(a.alcance_celulas||0))[0]; const mp=_maisProx(inimigos); if(mp&&skR){if(mp.dist<=skR.alcance_celulas)atacar={skill:skR,alvo:mp.char.nome};else moverPara=_emDir(mp.char.nome);}else if(mp&&mp.dist<=2){moverPara=_fugir();}} break;
    case 'cacador':  { if(!alvoFixo){const ap=inimigos.reduce((b,x)=>{const h=x.hp_atual??100;return(!b||h<b.hp)?{char:x,hp:h}:b;},null);if(ap)alvoFixo=ap.char.nome;} if(alvoFixo){const d=_dist(alvoFixo);const sk=_maisDano();if(sk){if(d!==null&&d<=(sk.alcance_celulas||1))atacar={skill:sk,alvo:alvoFixo};else moverPara=_emDir(alvoFixo);}}} break;
    case 'estrategista':{ const skC=skills.find(s=>s.alvo_tipo==='inimigo'&&s.efeitos_bonus?.some(e=>e.sem_movimento||e.sem_ataque)); const sk=_maisDano(); const mp=_maisProx(inimigos); if(mp){const skU=(skC&&!mp.char.buffs?.some(b=>b.sem_movimento))?skC:sk;if(skU&&mp.dist<=(skU.alcance_celulas||1))atacar={skill:skU,alvo:mp.char.nome};else moverPara=_emDir(mp.char.nome);}} break;
    default:{ const todos=['agressivo','defensivo','suporte','covarde','emboscador']; return _npcCalcAcao(nomeNpc,todos[Math.floor(Math.random()*todos.length)],mapId); }
  }
  return { moverPara, atacar };
}

// ── 6.2 Aprovação automática de itens ─────────────────────────────────────
const _origConfirmarUsarItem = window.confirmarUsarItem;
window.confirmarUsarItem = async function() {
  if (!_usarItemCtx) return;
  const { invItem, def, nomeUsuario } = _usarItemCtx;
  const alvoId = document.getElementById('usar-item-alvo-sel')?.value;
  const precisaAlvo = def.alvo && def.alvo !== 'self';
  if (precisaAlvo && !alvoId) { mostrarToast('Selecione um alvo', 'aviso'); return; }
  const precisaAprovacao = def.requer_aprovacao === true && RPG_DATA?.myRole !== 'mestre';
  const usuarioChar = RPG_DATA?.characters?.find(c => c.nome === nomeUsuario);
  if (!usuarioChar) { mostrarToast('Personagem não encontrado', 'erro'); return; }
  if (precisaAprovacao) {
    try {
      const [row] = await sb('item_usos', { method:'POST', headers:{'Prefer':'return=representation'}, body:JSON.stringify({ rpg_id:RPG_DATA.rpgId, inventario_id:invItem.id, item_def_id:def.id, usado_por_id:usuarioChar.id, alvo_id:alvoId||null, status:'pendente', efeitos_snap:def.efeitos }) });
      if (row) INV.usosPendentes.push(row);
      renderItensPendentes6();
      mostrarToast('⏳ Aguardando aprovação do Mestre', 'aviso');
      fecharModalUsarItem();
    } catch(e) { mostrarToast('Erro ao enviar uso', 'erro'); }
    return;
  }
  const alvoChar = RPG_DATA?.characters?.find(c => c.id === alvoId) || usuarioChar;
  if (!alvoChar) { mostrarToast('Alvo não encontrado', 'erro'); return; }
  await _aplicarEfeitosItem(def.efeitos||[], alvoChar.nome, nomeUsuario);
  await _consumirItem(invItem);
  const efLabel = (def.efeitos||[]).map(e => _efeitoLabel(e)).filter(Boolean).join(', ');
  HUB_EVENTS.emit('item_usado', { personagem: nomeUsuario, item: def.nome, efeito: efLabel, aprovacao: 'auto' });
  fecharModalUsarItem();
};

// ── 6.3 Fila de aprovação com 3 raias ────────────────────────────────────
function renderItensPendentes6() {
  const wrap = document.getElementById('itens-aprovacoes-wrap');
  const lista = document.getElementById('itens-aprovacoes-lista');
  if (!wrap||!lista) return;
  if (RPG_DATA?.myRole !== 'mestre' || !INV.usosPendentes?.length) { wrap.style.display='none'; return; }
  wrap.style.display = 'block';
  const bloqueantes = INV.usosPendentes.filter(u => { const def=INV.itemDefs?.find(d=>d.id===(u.item_def_id||u.item_catalog_id)); const ef=u.efeitos_snap||def?.efeitos||[]; return ef.some(e=>e.tipo==='dano'||e.tipo==='debuff'||e.tipo==='dot'); });
  const aguardando  = INV.usosPendentes.filter(u => !bloqueantes.includes(u));
  const _renderRaia = (label, cor, items) => {
    if (!items.length) return '';
    return '<div style="margin-bottom:10px"><div style="font-size:0.58rem;font-family:var(--fonte-d);color:'+cor+';text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;border-bottom:1px solid '+cor+'44;padding-bottom:3px">'+label+'</div>'+items.map(u=>{
      const def=INV.itemDefs?.find(d=>d.id===(u.item_def_id||u.item_catalog_id));
      const usadoPor=RPG_DATA?.characters?.find(c=>c.id===u.usado_por_id);
      const alvo=RPG_DATA?.characters?.find(c=>c.id===u.alvo_id);
      const efStr=(u.efeitos_snap||def?.efeitos||[]).map(_efeitoLabel).filter(Boolean).join(' · ');
      return '<div style="background:var(--escuro);border:1px solid '+cor+'44;border-left:3px solid '+cor+';border-radius:7px;padding:8px 10px;margin-bottom:5px"><div style="font-size:0.72rem;color:var(--texto)"><b>'+(usadoPor?.nome||'?')+'</b> quer usar <b>'+(def?.icone||'📦')+' '+(def?.nome||'item')+'</b>'+(alvo&&alvo.nome!==usadoPor?.nome?' em <b>'+alvo.nome+'</b>':'')+'</div>'+(efStr?'<div style="font-size:0.65rem;color:#7ec8f0;margin-top:2px">✦ '+efStr+'</div>':'')+'<div style="display:flex;gap:5px;margin-top:7px"><button onclick="aprovarUsoItem('+u.id+')" style="flex:1;padding:6px;background:rgba(39,174,96,0.1);border:1px solid rgba(39,174,96,0.35);border-radius:6px;color:#5ee09a;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer">✓ Aprovar</button><button onclick="rejeitarUsoItem('+u.id+')" style="flex:1;padding:6px;background:rgba(192,57,43,0.06);border:1px solid rgba(192,57,43,0.25);border-radius:6px;color:#e74c3c88;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer">✕ Rejeitar</button></div></div>';
    }).join('')+'</div>';
  };
  lista.innerHTML = _renderRaia('🔴 Bloqueante — requer resolução', '#e74c3c', bloqueantes) + _renderRaia('🟡 Aguardando — resolva quando puder', '#f0cc6a', aguardando);
}
window.renderItensPendentes = renderItensPendentes6;

// ── 6.4 Loot com posição no mapa ─────────────────────────────────────────
const _origExecutarDropNPC = window._executarDropNPC;
window._executarDropNPC = async function(rpgId, npcNome, npcChar) {
  const mapId = MAPA_STATE?.mapaAtualId;
  const posNpc = mapId ? getPosicaoNoMapa(npcChar, mapId) : null;
  await _origExecutarDropNPC(rpgId, npcNome, npcChar);
  if (posNpc && mapId) {
    try { await sb('loot_pendente?rpg_id=eq.'+encodeURIComponent(rpgId)+'&origem_npc=eq.'+encodeURIComponent(npcNome)+'&saqueado=eq.false', { method:'PATCH', body:JSON.stringify({ posicao_col:posNpc.col, posicao_row:posNpc.row, mapa_id:mapId }) }); } catch(e) {}
  }
};
window.abrirModalLootToken = function(npcNome) {
  if (typeof abrirModalLoot === 'function') { abrirModalLoot(npcNome); return; }
  mostrarToast('💰 Saquear '+npcNome+' — abra a aba Tabelas para ver o loot', 'info');
};

// ── 6.5 Janela de reclamação de loot 15s ─────────────────────────────────
const LOOT_RECLAMOS = {};
function lootMostrarJanela(lootId, nomeItem, raridade) {
  const corRar = ({comum:'#9aa8b8',incomum:'#5ee09a',raro:'#7ec8f0',epico:'#b07ef0',lendario:'#f0cc6a'})[raridade]||'#9aa8b8';
  LOOT_RECLAMOS[lootId] = LOOT_RECLAMOS[lootId]||[];
  let card = document.getElementById('loot-janela-'+lootId);
  if (!card) { card=document.createElement('div'); card.id='loot-janela-'+lootId; card.style.cssText='position:fixed;top:80px;right:12px;z-index:9150;border:2px solid '+corRar+';border-radius:10px;background:rgba(10,15,25,0.96);padding:10px 12px;min-width:170px;box-shadow:0 8px 24px rgba(0,0,0,0.6)'; document.body.appendChild(card); }
  let seg = 15;
  card.innerHTML = '<div style="font-size:0.65rem;color:'+corRar+';font-family:var(--fonte-d);margin-bottom:4px">'+nomeItem+'</div><div style="font-size:0.58rem;color:var(--suave);margin-bottom:8px">Interesse em <span id="loot-timer-'+lootId+'" style="color:'+corRar+'">'+seg+'s</span></div><button onclick="lootReclamar(\'' + lootId + '\')" style="width:100%;padding:7px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:7px;color:var(--destaque);font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer;min-height:40px">✋ Tenho interesse</button><div id="loot-reclamos-'+lootId+'" style="margin-top:5px;font-size:0.58rem;color:var(--suave)"></div>';
  const countdown = setInterval(() => { seg--; const t=document.getElementById('loot-timer-'+lootId); if(t) t.textContent=seg+'s'; if(seg<=0){clearInterval(countdown);lootResolverReclamo(lootId,nomeItem);} }, 1000);
  card._countdown = countdown;
}
window.lootReclamar = function(lootId) {
  const meu = RPG_DATA?.linked||'Jogador';
  if(!LOOT_RECLAMOS[lootId]) LOOT_RECLAMOS[lootId]=[];
  if(!LOOT_RECLAMOS[lootId].includes(meu)){ LOOT_RECLAMOS[lootId].push(meu); const el=document.getElementById('loot-reclamos-'+lootId); if(el) el.textContent='Interesse: '+LOOT_RECLAMOS[lootId].join(', '); mostrarToast('✋ Interesse registrado: '+meu,'ok'); }
};
function lootResolverReclamo(lootId, nomeItem) {
  const card = document.getElementById('loot-janela-'+lootId);
  const reclamos = LOOT_RECLAMOS[lootId]||[];
  if (!reclamos.length) { if(card){card.innerHTML='<div style="font-size:0.65rem;color:var(--suave);padding:4px">'+nomeItem+' disponível para saque livre</div>'; setTimeout(()=>card.remove(),4000);} }
  else if (reclamos.length===1) { if(card){card.innerHTML='<div style="font-size:0.65rem;color:#5ee09a;padding:4px">✓ '+nomeItem+' → '+reclamos[0]+'</div>'; setTimeout(()=>card.remove(),3000);} mostrarToast('✓ '+nomeItem+' distribuído para '+reclamos[0],'ok'); }
  else { if(card){card.innerHTML='<div style="font-size:0.65rem;color:#f0cc6a;padding:4px 0;margin-bottom:6px">'+nomeItem+' — múltiplo interesse</div>'+reclamos.map(r=>'<div style="font-size:0.6rem;color:var(--suave)">'+r+'</div>').join('')+'<div style="font-size:0.58rem;color:rgba(200,168,75,0.6);margin-top:6px">Mestre decide quem recebe</div>';} notifAdicionar({tipo:'loot',prioridade:'media',titulo:'Loot disputado: '+nomeItem,descricao:reclamos.join(', ')+' têm interesse',acao:{label:'Distribuir',fn:()=>mostrarToast('Distribua o item manualmente via inventário','')}}); }
}

// ── 6.6 Indicadores de buff/debuff no token ───────────────────────────────
const _origMRBadges6 = window._mapaAdicionarBadgesBuffTokens;
window._mapaAdicionarBadgesBuffTokens = function() {
  const chars = RPG_DATA?.characters||[];
  chars.forEach(c => {
    const buffs = c.buffs||[]; if (!buffs.length) return;
    const tokenEl = document.querySelector('.mapa-token[data-nome="'+CSS.escape(c.nome)+'"]'); if (!tokenEl) return;
    tokenEl.querySelectorAll('.buff-status-badge').forEach(b=>b.remove());
    const ativos = buffs.filter(b => { const t=b.turnos_restantes??b.dot_turnos_restantes??b.hot_turnos_restantes??0; return t>0||(b.sem_movimento&&(b.sem_movimento_turnos_restantes??0)>0)||(b.sem_ataque&&(b.sem_ataque_turnos_restantes??0)>0); });
    if (!ativos.length) { tokenEl.querySelector('.mapa-token-circle')?.style.setProperty('box-shadow',''); return; }
    const temDebSev = ativos.some(b=>b.tipo==='debuff'&&(b.sem_movimento||b.sem_ataque||(b.dot_formula&&(b.dot_turnos_restantes??0)>0)));
    const temBuff   = ativos.some(b=>b.tipo==='buff');
    const circle = tokenEl.querySelector('.mapa-token-circle');
    if (circle) { circle.style.boxShadow = temDebSev ? '0 0 0 2px rgba(231,76,60,0.9),0 0 8px rgba(231,76,60,0.4)' : temBuff ? '0 0 0 2px rgba(94,224,154,0.8),0 0 6px rgba(94,224,154,0.3)' : '0 0 0 2px rgba(240,204,106,0.6)'; }
    const iconMap = { dot:{emoji:'🩸',cor:'#c0392b'}, hot:{emoji:'💚',cor:'#27ae60'}, sem_mov:{emoji:'🦶',cor:'#e74c3c'}, sem_atk:{emoji:'⚔',cor:'#e74c3c'}, buff:{emoji:'✨',cor:'#b07ef0'}, debuff:{emoji:'☠',cor:'#8e44ad'} };
    const icones = [];
    if(ativos.some(b=>b.dot_formula&&(b.dot_turnos_restantes??0)>0)) icones.push(iconMap.dot);
    if(ativos.some(b=>b.hot_formula&&(b.hot_turnos_restantes??0)>0)) icones.push(iconMap.hot);
    if(ativos.some(b=>b.sem_movimento&&(b.sem_movimento_turnos_restantes??0)>0)) icones.push(iconMap.sem_mov);
    if(ativos.some(b=>b.sem_ataque&&(b.sem_ataque_turnos_restantes??0)>0)) icones.push(iconMap.sem_atk);
    if(ativos.some(b=>b.tipo==='buff'&&!b.dot_formula&&!b.hot_formula)) icones.push(iconMap.buff);
    else if(ativos.some(b=>b.tipo==='debuff'&&!b.dot_formula&&!b.sem_movimento&&!b.sem_ataque)) icones.push(iconMap.debuff);
    const iconesWrap = document.createElement('div');
    iconesWrap.style.cssText = 'position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);display:flex;gap:2px;z-index:12;pointer-events:none';
    icones.slice(0,3).forEach(ico => { const s=document.createElement('div'); s.className='buff-status-badge'; s.style.cssText='width:14px;height:14px;border-radius:50%;background:'+ico.cor+';border:1px solid rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;font-size:7px'; s.textContent=ico.emoji; iconesWrap.appendChild(s); });
    if (icones.length>3) { const ex=document.createElement('div'); ex.className='buff-status-badge'; ex.style.cssText='width:14px;height:14px;border-radius:50%;background:rgba(122,146,170,0.8);border:1px solid rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;font-size:7px;color:#fff'; ex.textContent='+'+(icones.length-3); iconesWrap.appendChild(ex); }
    tokenEl.title = ativos.map(b=>(b.nome||'buff')+' ('+(b.turnos_restantes??b.dot_turnos_restantes??b.hot_turnos_restantes??'?')+'t)').join(' | ');
    tokenEl.appendChild(iconesWrap);
  });
  _mapaAdicionarBotaoAtaqueTurno?.();
};

// ── 6.7 Preview trade_off em skills antes de equipar ──────────────────────
const _origInvEquipar6 = window._invEquipar || _invEquipar;
window._invEquipar = async function(nomeChar, invItem, def) {
  const tradeOffs = def.trade_offs||{};
  if (Object.keys(tradeOffs).length>0) {
    const habilidades = atkGetHabilidadesCampanha(nomeChar);
    const c  = (RPG_DATA?.characters||[]).find(x=>x.nome===nomeChar);
    const ca = c?.custom_attrs||{};
    const impactos = [];
    for (const [attr, val] of Object.entries(tradeOffs)) {
      const delta = typeof val==='object' ? val.valor : parseFloat(val)||0;
      if (delta>=0) continue;
      for (const h of habilidades) {
        if (h.atributo_base!==attr||!h.mod_atributo_pct) continue;
        const atualAttr=parseFloat(ca.atributos?.[attr]||0), novoAttr=atualAttr+delta;
        const modAtual=Math.ceil(atualAttr*h.mod_atributo_pct/100), modNovo=Math.ceil(novoAttr*h.mod_atributo_pct/100);
        if (modAtual!==modNovo) impactos.push({ skill:h.nome, de:h.formula_dano?h.formula_dano+'+'+modAtual:'+'+modAtual, para:h.formula_dano?h.formula_dano+'+'+modNovo:'+'+modNovo, attr, delta });
      }
    }
    if (impactos.length>0) {
      const linhas = impactos.map(i=>'  '+i.skill+': '+i.de+' → '+i.para+'  ('+i.attr+' '+i.delta+')').join('\n');
      if (!confirm('⚠ Equipar '+def.nome+' afeta suas habilidades:\n\n'+linhas+'\n\nEquipar mesmo assim?')) return;
      const skNomes = impactos.map(i=>i.skill).join(', ');
      HUB_EVENTS.emit('item_usado', { personagem:nomeChar, item:def.nome, efeito:'trade_off — afetou: '+skNomes, aprovacao:'auto' });
    }
  }
  return _origInvEquipar6(nomeChar, invItem, def);
};

// ── 6.8 bloqueado_por_nivel dinâmico ─────────────────────────────────────
function bloqueadoPorNivel(charNome, itemDef) {
  const c = (RPG_DATA?.characters||[]).find(ch=>ch.nome===charNome); if (!c) return false;
  const nivel = c.nivel??c.custom_attrs?.nivel??c.custom_attrs?.atributos?.Nível??1;
  return parseInt(nivel) < parseInt(itemDef?.nivel_minimo_uso??itemDef?.nivel??1);
}
const _origRenderInvCompleto6 = window.renderInvCompleto;
window.renderInvCompleto = function() {
  if (INV?.inventarios) {
    const charNome = INV.charAtivo;
    if (charNome) { const charId=INV.charId; const insts=INV.inventarios[charId]||[]; for(const inst of insts){const it=inst.item||inst.item_catalog||{}; inst.bloqueado_por_nivel=bloqueadoPorNivel(charNome,it);} }
  }
  return _origRenderInvCompleto6?.();
};

// ── 6.9 Baú do Grupo como zona no mapa ────────────────────────────────────
const _origCtxGerarBotoes6 = window.ctxGerarBotoes;
window.ctxGerarBotoes = function(charNome, mapId) {
  const botoes = _origCtxGerarBotoes6(charNome, mapId);
  const pos = getPosicaoNoMapa((RPG_DATA?.characters||[]).find(c=>c.nome===charNome), mapId);
  if (!pos) return botoes;
  const mapa   = _getMapaById(mapId);
  const locais = mapa?.locais || [];
  const W      = mapa?.largura_total || 20;
  const H      = mapa?.altura_total  || 20;

  // Baú do Grupo adjacente
  for (const zona of locais) {
    if (zona.zona_tipo !== 'bau_grupo') continue;
    const zC = Math.round(((zona.x ?? 0) / 100) * W);
    const zR = Math.round(((zona.y ?? 0) / 100) * H);
    if (Math.max(Math.abs((pos.col ?? 0) - zC), Math.abs((pos.row ?? 0) - zR)) <= 1)
      botoes.unshift({ label: '🗄 ' + (zona.nome || 'Baú do Grupo'), acao: 'bau_grupo', prioridade: 8, desabilitado: false });
  }

  // Piloto automático (só NPC, só mestre)
  if (RPG_DATA?.myRole === 'mestre') {
    const ch  = (RPG_DATA?.characters || []).find(c => c.nome === charNome);
    const ca  = ch?.custom_attrs || {};
    const estaNoMapa = ch?.active_map_id === mapId;
    if (estaNoMapa && (ca.tipo_personagem === 'npc' || ca.tipo === 'npc')) {
      const pilotoAtivo = NPC_PILOTO[charNome];
      botoes.push({ label: pilotoAtivo ? '🤖 Piloto Ativo' : '🎮 Ativar Piloto',
        acao: 'toggle_piloto', prioridade: pilotoAtivo ? 9 : 3, desabilitado: false });
      if (pilotoAtivo)
        botoes.push({ label: '▶ Executar Turno', acao: 'executar_turno_npc', prioridade: 10, desabilitado: false });
    }
  }

  return botoes;
};
// bau_grupo já tratado na função base ctxExecutarAcao

function abrirModalIniciarBatalha() {
  const isMestre = RPG_DATA?.myRole === 'mestre';
  if (!isMestre) return;
  const mapaId = MAPA_STATE.mapaAtualId;
  if (!mapaId) { mostrarToast('Selecione um mapa primeiro', 'erro'); return; }
  if (batalhaDoMapa(mapaId)) { mostrarToast('Já há uma batalha ativa neste mapa', 'erro'); return; }

  // Apenas personagens fisicamente neste mapa (active_map_id exato)
  const allCharsHere = batalhaParticipantesDoMapa(mapaId);
  if (!allCharsHere.length) { mostrarToast('Nenhum personagem posicionado neste local', 'erro'); return; }

  // Excluir personagens que já estão em outra batalha ativa
  const chars = allCharsHere.filter(c => {
    const jaEmBatalha = Object.values(MAPA_STATE.batalhas).some(b =>
      b.ativa && b.mapa_id !== mapaId && b.participantes?.some(p => p.nome === c.nome)
    );
    return !jaEmBatalha;
  });
  const ocupados = allCharsHere.filter(c => !chars.includes(c));
  if (ocupados.length) {
    mostrarToast(`${ocupados.map(c=>c.nome).join(', ')} já ${ocupados.length===1?'está':'estão'} em outra batalha`, 'erro');
    if (!chars.length) return;
  }

  // Precisa de pelo menos 2 participantes para haver batalha
  if (chars.length < 2) {
    mostrarToast('É necessário ao menos 2 personagens no local para iniciar uma batalha', 'erro');
    return;
  }

  // Checar se há NPCs quando PvP está desabilitado
  const pvpAtivo = CURRENT_RPG?.theme?.pvp_ativo === true;
  const temNpc = chars.some(c => {
    const ca = c.custom_attrs || {};
    return ca.tipo_personagem === 'npc' || ca.tipo === 'npc';
  });
  if (!pvpAtivo && !temNpc) {
    mostrarToast('Não há inimigos neste local. Habilite o PvP ou adicione NPCs para iniciar uma batalha', 'erro');
    return;
  }

  const lista = document.getElementById('ini-batalha-participantes');
  const charsFiltrados = chars.filter(c => !c.custom_attrs?.eh_pet && !c.custom_attrs?.morto);
  lista.innerHTML = charsFiltrados.map(c => {
    const ca = c.custom_attrs || {};
    const tipo = (ca.tipo_personagem === 'npc' || ca.tipo === 'npc') ? 'npc' : 'jogador';
    const cor = ca.cor || (tipo==='npc'?'#e8604c':'#7ec8f0');
    return `<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(10,5,5,0.7);border-radius:8px;border-left:2px solid ${cor};cursor:pointer">
      <input type="checkbox" data-nome="${c.nome}" data-tipo="${tipo}" data-cor="${cor}" checked style="accent-color:${cor};width:16px;height:16px">
      <span style="font-family:var(--fonte-d);font-size:0.78rem;color:${cor}">${c.nome}</span>
      <span style="font-size:0.68rem;color:var(--suave);flex:1">${tipo}</span>
    </label>`;
  }).join('');

  document.getElementById('modal-iniciar-batalha-overlay').style.display = 'flex';
}

function fecharModalIniciarBatalha() {
  document.getElementById('modal-iniciar-batalha-overlay').style.display = 'none';
}

async function confirmarIniciarBatalha() {
  fecharModalIniciarBatalha();
  const checkboxes = document.querySelectorAll('#ini-batalha-participantes input[type=checkbox]:checked');
  const participantesBase = Array.from(checkboxes).map(cb => ({
    nome: cb.dataset.nome, tipo: cb.dataset.tipo,
    cor: cb.dataset.cor, iniciativa: null
  })).filter(p => {
    // Pets não participam da fila de iniciativa — agem no turno do dono
    const c = (RPG_DATA?.characters||[]).find(x => x.nome === p.nome);
    return !(c?.custom_attrs?.eh_pet);
  });
  if (!participantesBase.length) { mostrarToast('Selecione ao menos um participante', 'erro'); return; }
  if (participantesBase.length < 2) { mostrarToast('É necessário ao menos 2 participantes para iniciar uma batalha', 'erro'); return; }

  // Validar PvP: se desabilitado, precisa de pelo menos 1 NPC
  const pvpAtivo = CURRENT_RPG?.theme?.pvp_ativo === true;
  const temNpc = participantesBase.some(p => p.tipo === 'npc');
  if (!pvpAtivo && !temNpc) {
    mostrarToast('Sem inimigos selecionados. Habilite o PvP ou adicione NPCs à batalha', 'erro');
    return;
  }

  const mapaId = MAPA_STATE.mapaAtualId;
  const mapaEntry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === mapaId);
  const mapaNome = mapaEntry?.mapa?.nome || mapaId;
  const bid = batalhaNovaId(mapaId);

  const iniciativasRoladas = {};
  participantesBase.forEach(p => {
    if (p.tipo === 'npc') {
      // NPCs: iniciativa automática com bônus de custom_attrs
      const ca = (RPG_DATA?.characters?.find(x => x.nome === p.nome)?.custom_attrs) || {};
      const bonus = parseInt(ca.bonus_iniciativa) || 0;
      const roll = Math.floor(Math.random() * 20) + 1 + bonus;
      p.iniciativa = roll;
      iniciativasRoladas[p.nome] = roll;
    }
    // Personagens sem jogador vinculado: mestre rola manualmente
    // Jogadores vinculados: cada um rola no seu cliente
  });

  MAPA_STATE.batalhas[bid] = {
    id: bid, mapa_id: mapaId, mapa_nome: mapaNome,
    ativa: true, pausada: false, turnoRound: 1,
    fase: 'iniciativa',
    participantes: participantesBase,
    ordemAtual: 0, iniciativasRoladas, empatados: [], dadoSel: null
  };

  BATALHA_ATUAL_ID = bid;
  _aplicarEstadoBatalhaUI();
  _atualizarBadgeMesa();
  _atualizarSeletorBatalhas();
  await criarBatalhaRemota(bid);
  // Broadcast instantâneo: outros clientes sabem da batalha antes do Supabase propagar
  combateBroadcast('batalha_criada', { batalhaId: bid, estado: MAPA_STATE.batalhas[bid] });
  mostrarToast(`⚔ Batalha iniciada em "${mapaNome}"! Aguardando iniciativas...`, '');
  batalhaVerificarIniciativasCompletas(bid);
}

// ── FASE DE INICIATIVA ────────────────────────────────────────
function batalhaRenderFaseIniciativa() {
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  const lista = document.getElementById('batalha-iniciativas-lista');
  if (!lista || !bs) return;

  const meuNome = RPG_DATA?.linked;
  const isMestre = RPG_DATA?.myRole === 'mestre';

  lista.innerHTML = bs.participantes.map(p => {
    const rolou = bs.iniciativasRoladas[p.nome] != null;
    const emEmpate = bs.empatados?.includes(p.nome);
    const valor = bs.iniciativasRoladas[p.nome];
    const statusIcon = emEmpate ? '⚠' : (rolou ? '✓' : '⏳');
    const statusCor = emEmpate ? '#c8a84b' : (rolou ? '#5ee09a' : '#7a6060');
    const offline = personagemTemJogador(p.nome) && !mestreDeveJogarPor(p) && !jogadorEstaOnline(p.nome);
    const icone = mestreDeveJogarPor(p) ? '👾' : '🧙';

    // Determinar se deve mostrar botão de rolar para este participante
    const ehMeuPersonagem = p.nome === meuNome;
    const mestrePodeRolarPorEste = isMestre && mestreDeveJogarPor(p);
    const deveExibirBotao = (!rolou || emEmpate) && (ehMeuPersonagem || mestrePodeRolarPorEste);
    const labelBotao = emEmpate ? '⚠ Re-rolar' : '🎲 Rolar';
    const nomeSafe = p.nome.replace(/'/g, "\\'");

    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(10,5,5,0.7);border-radius:6px;border-left:2px solid ${p.cor}">
      <span style="color:${p.cor};font-size:0.7rem">${icone}</span>
      <span style="font-family:var(--fonte-d);font-size:0.72rem;flex:1;color:${rolou?'var(--texto)':'var(--suave)'}">${p.nome}${offline?' 📴':''}</span>
      <span style="font-family:var(--fonte-d);font-size:0.85rem;color:${statusCor};min-width:24px;text-align:right">${rolou&&!emEmpate?valor:''}</span>
      ${deveExibirBotao
        ? `<button onclick="abrirModalIniciativa('${nomeSafe}')"
            style="padding:3px 8px;background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:4px;color:#7ec8f0;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer;white-space:nowrap">${labelBotao}</button>`
        : `<span style="font-size:0.75rem;color:${statusCor}">${statusIcon}</span>`
      }
    </div>`;
  }).join('');

  // Botão global "Rolar Iniciativa" (para jogador com personagem vinculado que ainda não rolou)
  const btnRolar = document.getElementById('batalha-btn-rolar-iniciativa');
  if (btnRolar && bs) {
    const euParticipo = bs.participantes.find(p => p.nome === meuNome);
    const jaRolei = euParticipo && bs.iniciativasRoladas[meuNome] != null && !bs.empatados?.includes(meuNome);
    // Mostrar botão global apenas para jogadores (não mestre): o mestre usa os botões inline
    btnRolar.style.display = (!isMestre && euParticipo && !jaRolei) ? '' : 'none';
    btnRolar.textContent = bs.empatados?.includes(meuNome) ? '⚠ Empate — Rolar Novamente' : '🎲 Rolar Iniciativa (d20)';
    btnRolar.onclick = () => abrirModalIniciativa();
  }
}

function abrirModalIniciativa(nomePersonagem) {
  // nomePersonagem: nome explícito (mestre rolando por NPC/personagem sem vínculo)
  // se omitido, usa o personagem vinculado ao jogador atual
  const nome = nomePersonagem || RPG_DATA?.linked;
  if (!nome) { mostrarToast('Sem personagem vinculado', 'erro'); return; }
  INI_VALOR_ATUAL = null;
  INI_NOME_ATUAL = nome; // guarda para usar no confirmar
  document.getElementById('ini-modal-nome').textContent = nome;
  document.getElementById('ini-dado-display').textContent = '—';
  document.getElementById('ini-dado-display').style.color = 'var(--primario-v)';
  const btnConf = document.getElementById('ini-btn-confirmar');
  btnConf.disabled = true; btnConf.style.opacity = '0.4'; btnConf.style.display = '';
  const btnRolar = document.getElementById('ini-btn-rolar');
  if (btnRolar) btnRolar.style.display = '';
  const btnFechar = document.getElementById('ini-btn-fechar');
  if (btnFechar) btnFechar.style.display = 'none';
  document.getElementById('ini-modal-aviso').style.display = 'none';
  document.getElementById('modal-iniciativa-overlay').style.display = 'flex';
}

function fecharModalIniciativa() {
  document.getElementById('modal-iniciativa-overlay').style.display = 'none';
}

function iniciativaRolarDado() {
  // Bloqueia nova rolagem se já rolou
  if (INI_VALOR_ATUAL != null) return;

  INI_VALOR_ATUAL = Math.floor(Math.random() * 20) + 1;
  const el = document.getElementById('ini-dado-display');
  el.textContent = INI_VALOR_ATUAL;
  el.style.color = INI_VALOR_ATUAL === 20 ? '#f0cc6a' : INI_VALOR_ATUAL === 1 ? '#e74c3c' : 'var(--primario-v)';
  el.style.transform = 'scale(1.3)';
  setTimeout(() => { el.style.transform = ''; }, 200);

  // Ocultar botão de rolar e confirmar; mostrar apenas fechar
  const btnRolar = document.getElementById('ini-btn-rolar');
  if (btnRolar) btnRolar.style.display = 'none';
  const btnConf = document.getElementById('ini-btn-confirmar');
  if (btnConf) btnConf.style.display = 'none';
  const btnFechar = document.getElementById('ini-btn-fechar');
  if (btnFechar) btnFechar.style.display = '';

  // Aplicar automaticamente
  iniciativaConfirmar();

  // Mensagem de confirmação
  const aviso = document.getElementById('ini-modal-aviso');
  if (aviso) {
    aviso.textContent = '✓ Iniciativa registrada!';
    aviso.style.color = '#5ee09a';
    aviso.style.display = '';
  }
}

async function iniciativaConfirmar() {
  if (INI_VALOR_ATUAL == null) return;
  const nomeAlvo = INI_NOME_ATUAL || RPG_DATA?.linked;
  if (!nomeAlvo) return;
  // Não fecha mais automaticamente — o jogador fecha com o botão "Fechar"

  // Para jogadores, sempre usar a batalha em que participam, não necessariamente
  // a que o mestre está visualizando no momento.
  const bid = (RPG_DATA?.myRole === 'mestre') ? BATALHA_ATUAL_ID : batalhaIdMinha();
  if (!bid) return;
  const bs = MAPA_STATE.batalhas[bid];
  if (!bs) return;

  bs.iniciativasRoladas[nomeAlvo] = INI_VALOR_ATUAL;
  const p = bs.participantes.find(x => x.nome === nomeAlvo);
  if (p) p.iniciativa = INI_VALOR_ATUAL;
  bs.empatados = bs.empatados.filter(n => n !== nomeAlvo);

  batalhaRenderFaseIniciativa();
  // Broadcast instantâneo para todos os clientes verem a iniciativa em tempo real
  combateBroadcast('iniciativa_rolada', { batalhaId: bid, nome: nomeAlvo, valor: INI_VALOR_ATUAL });
  await salvarEstadoBatalha(bid);

  if (RPG_DATA?.myRole === 'mestre') batalhaVerificarIniciativasCompletas(bid);
}

function batalhaVerificarIniciativasCompletas(bid) {
  const bs = MAPA_STATE.batalhas[bid];
  if (!bs) return;
  const todosRolaram = bs.participantes.every(p => bs.iniciativasRoladas[p.nome] != null);
  if (!todosRolaram) return;

  const grupos = {};
  bs.participantes.forEach(p => {
    const v = bs.iniciativasRoladas[p.nome];
    if (!grupos[v]) grupos[v] = [];
    grupos[v].push(p);
  });
  const empatados = [];
  Object.values(grupos).forEach(grp => { if (grp.length > 1) grp.forEach(p => empatados.push(p.nome)); });

  if (empatados.length) {
    bs.empatados = empatados;
    empatados.forEach(n => {
      delete bs.iniciativasRoladas[n];
      const p = bs.participantes.find(x => x.nome === n);
      if (p) p.iniciativa = null;
      // Apenas NPCs re-rolam automaticamente
      if (p && p.tipo === 'npc') {
        const roll = Math.floor(Math.random() * 20) + 1;
        bs.iniciativasRoladas[n] = roll;
        p.iniciativa = roll;
        bs.empatados = bs.empatados.filter(e => e !== n);
      }
      // Personagens sem jogador vinculado e jogadores ficam em bs.empatados aguardando rolagem manual
    });
    bs.fase = 'empate';
    batalhaRenderFaseIniciativa();
    salvarEstadoBatalha(bid);
    // Broadcast instantâneo do estado de empate
    combateBroadcast('batalha_estado', { batalhaId: bid, fase: bs.fase, iniciativasRoladas: bs.iniciativasRoladas, empatados: bs.empatados, participantes: bs.participantes });

    // Verificar se ainda há alguém esperando rolar manualmente
    const pendentesHumanos = bs.empatados.length > 0;
    if (pendentesHumanos) {
      mostrarToast('⚠ Empate! Os participantes marcados devem re-rolar.', '');
      // NPCs já re-rolaram; pode ter criado novo empate entre eles — re-verificar só NPCs pendentes
      // A verificação completa acontece quando os humanos confirmarem sua rolagem
    } else {
      // Todos os empatados eram NPCs e já re-rolaram — re-verificar se criaram novo empate
      setTimeout(() => batalhaVerificarIniciativasCompletas(bid), 100);
    }
    return;
  }

  bs.participantes.sort((a, b) => (bs.iniciativasRoladas[b.nome]||0) - (bs.iniciativasRoladas[a.nome]||0));
  bs.participantes.forEach(p => { p.iniciativa = bs.iniciativasRoladas[p.nome]; });
  bs.fase = 'combate';
  bs.ordemAtual = 0;
  bs.empatados = [];
  _aplicarEstadoBatalhaUI();
  salvarEstadoBatalha(bid);
  // Broadcast instantâneo: todos os clientes atualizam para fase de combate imediatamente
  combateBroadcast('batalha_estado', { batalhaId: bid, fase: 'combate', participantes: bs.participantes, ordemAtual: 0, turnoRound: bs.turnoRound, iniciativasRoladas: bs.iniciativasRoladas, empatados: [] });
  _atualizarBadgeMesa();
  _notificarVez(bs, bid);
}

// ── FASE DE COMBATE ───────────────────────────────────────────
function batalhaRenderOrdemStrip() {
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  const strip = document.getElementById('batalha-ordem-strip');
  if (!strip || !bs) return;
  const isMestre = RPG_DATA?.myRole === 'mestre';

  strip.innerHTML = bs.participantes.map((p, i) => {
    const isAtual = i === bs.ordemAtual;
    const offline = personagemTemJogador(p.nome) && !mestreDeveJogarPor(p) && !jogadorEstaOnline(p.nome);
    const borda = isAtual ? `2px solid ${p.cor}` : '1px solid rgba(255,255,255,0.06)';
    const bg = isAtual ? `${p.cor}18` : 'rgba(10,5,5,0.7)';
    const sombra = isAtual ? `0 0 12px ${p.cor}44` : 'none';
    return `<div onclick="${isMestre?`batalhaDefinirVez(${i})`:'undefined'}"
      style="flex-shrink:0;min-width:60px;padding:6px 8px;border-radius:8px;border:${borda};background:${bg};box-shadow:${sombra};text-align:center;cursor:${isMestre?'pointer':'default'};transition:all 0.2s;position:relative">
      ${offline?'<span style="position:absolute;top:2px;right:3px;font-size:0.5rem">📴</span>':''}
      <div style="font-size:0.65rem">${p.tipo==='npc'?'👾':'🧙'}</div>
      <div style="font-family:var(--fonte-d);font-size:0.55rem;color:${p.cor};max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.nome}">${p.nome}</div>
      <div style="font-family:var(--fonte-d);font-size:0.9rem;color:${isAtual?p.cor:'var(--suave)'}">${p.iniciativa}</div>
    </div>`;
  }).join('');

  const children = strip.children;
  if (children[bs.ordemAtual]) {
    setTimeout(() => children[bs.ordemAtual].scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' }), 50);
  }
}

function batalhaRenderVezLabel() {
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  const label = document.getElementById('batalha-vez-label');
  const avisoOffline = document.getElementById('batalha-offline-aviso');
  if (!label || !bs) return;

  const atual = bs.participantes[bs.ordemAtual];
  if (!atual) return;

  const meuNome = RPG_DATA?.linked;
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const ehMinhaVez = atual.nome === meuNome;
  const mestreJoga = mestreDeveJogarPor(atual); // NPC ou personagem sem jogador vinculado
  const podeMestreAtacar = isMestre && (mestreJoga || ehMinhaVez);
  const isOffline = !mestreJoga && personagemTemJogador(atual.nome) && !jogadorEstaOnline(atual.nome);
  const pausada = bs.pausada;

  if (ehMinhaVez) label.innerHTML = `<span style="color:var(--destaque)">✦ É sua vez!</span>`;
  else if (mestreJoga && isMestre) label.innerHTML = `<span style="color:var(--destaque)">✦ Sua vez — ${atual.nome}</span>`;
  else label.innerHTML = `<span>Vez de <strong style="color:${atual.cor}">${atual.nome}</strong></span>`;

  // Exibir movimento restante na barra de batalha
  let movEl = document.getElementById('batalha-mov-restante');
  if (!movEl) {
    movEl = document.createElement('div');
    movEl.id = 'batalha-mov-restante';
    movEl.style.cssText = 'font-family:var(--fonte-d);font-size:0.6rem;color:rgba(200,168,75,0.7);margin-top:3px';
    label.after(movEl);
  }
  if (BATALHA_ATUAL_ID) {
    const movRest = movGetRestante(BATALHA_ATUAL_ID, atual.nome);
    const movMax  = movCalcVelocidade(atual.nome);
    movEl.textContent = movRest !== Infinity ? `🏃 ${movRest}/${movMax} mov restante` : '';
  }

  // Aviso offline
  if (avisoOffline) {
    if (isOffline) {
      avisoOffline.style.display = '';
      avisoOffline.textContent = `📴 ${atual.nome} está offline. Aguardando ou o mestre pode jogar por ele.`;
    } else {
      avisoOffline.style.display = 'none';
    }
  }

  const btnAtacar = document.getElementById('batalha-btn-atacar');
  const btnJogarPor = document.getElementById('batalha-btn-jogar-por');
  const btnPular = document.getElementById('batalha-btn-pular');
  const wrapReorder = document.getElementById('batalha-reordenar-wrap');

  if (btnAtacar) {
    const podeAtacar = (ehMinhaVez || podeMestreAtacar) && !pausada && !isOffline;
    btnAtacar.style.display = podeAtacar ? '' : 'none';
    btnAtacar.disabled = pausada;
  }
  // Botão "jogar por offline": só mestre, só quando o personagem TEM jogador mas está offline
  if (btnJogarPor) {
    btnJogarPor.style.display = (isMestre && isOffline) ? '' : 'none';
  }
  if (btnPular) btnPular.style.display = isMestre ? '' : 'none';
  if (wrapReorder) {
    wrapReorder.style.display = isMestre ? '' : 'none';
    batalhaRenderReordenarLista();
  }
}

function batalhaRenderReordenarLista() {
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  const lista = document.getElementById('batalha-reordenar-lista');
  if (!lista || !bs) return;
  lista.innerHTML = bs.participantes.map((p, i) => {
    const isAtual = i === bs.ordemAtual;
    return `<button onclick="batalhaDefinirVez(${i})"
      style="padding:4px 8px;background:${isAtual?`${p.cor}22`:'rgba(20,29,43,0.8)'};border:1px solid ${isAtual?p.cor:'var(--borda)'};border-radius:6px;color:${isAtual?p.cor:'var(--suave)'};font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer">${p.nome}</button>`;
  }).join('');
}

async function batalhaDefinirVez(i) {
  if (RPG_DATA?.myRole !== 'mestre') return;
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  if (!bs) return;
  bs.ordemAtual = i;
  batalhaRenderOrdemStrip();
  batalhaRenderVezLabel();
  // Broadcast instantâneo antes do DB (elimina latência para os jogadores)
  combateBroadcast('vez_passou', { batalhaId: BATALHA_ATUAL_ID, ordemAtual: bs.ordemAtual, turnoRound: bs.turnoRound });
  await salvarEstadoBatalha(BATALHA_ATUAL_ID);
  _notificarVez(bs, BATALHA_ATUAL_ID);
  _atualizarBadgeMesa();
}

// ── BUG-05 FIX: Função centralizada para finalizar ataque e avançar turno ──
// Substitui as 3 chamadas diretas a batalhaPassarVez() no fluxo de combate.
// Garante: (1) batalha ativa e não pausada, (2) sem chamada dupla.
async function _finalizarAtaqueCampanha() {
  if (!BATALHA_ATUAL_ID) return;
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  if (!bs?.ativa)    { mostrarToast('⚠ Batalha não está ativa', '');   return; }
  if (bs?.pausada)   { mostrarToast('⏸ Batalha pausada — turno não avançou', ''); return; }
  await batalhaPassarVez();
}
// ───────────────────────────────────────────────────────────────────────────

async function batalhaPassarVez() {
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  if (!bs) return;

  // BUG-10: Alertar mestre se o NPC atual tem pets que não agiram
  const atual = bs.participantes[bs.ordemAtual];
  if (atual && RPG_DATA?.myRole === 'mestre') {
    const cAtual = RPG_DATA?.characters?.find(x => x.nome === atual.nome);
    const isNpcAtual = cAtual?.custom_attrs?.tipo_personagem === 'npc' || cAtual?.custom_attrs?.tipo === 'npc';
    if (isNpcAtual) {
      const petsDoNpc = typeof petGetPetsDoDono === 'function' ? petGetPetsDoDono(atual.nome, 'campanha') : [];
      if (petsDoNpc && petsDoNpc.length > 0) {
        mostrarToast(`⚠ ${atual.nome} tem pet(s): ${petsDoNpc.map(p => p.nome).join(', ')} — não esqueça de acionar!`, 'aviso');
      }
    }
  }

  const wasRound = bs.turnoRound || 1;
  let next = (bs.ordemAtual + 1) % bs.participantes.length;

  // ── Pular participantes mortos ────────────────────────────────────────────
  let tentativas = 0;
  while (tentativas < bs.participantes.length) {
    const pNext = bs.participantes[next];
    const cNext = RPG_DATA?.characters?.find(x => x.nome === pNext?.nome);
    if (!cNext?.custom_attrs?.morto) break;
    next = (next + 1) % bs.participantes.length;
    tentativas++;
  }
  // ─────────────────────────────────────────────────────────────────────────

  const novoRound = next === 0;
  if (novoRound) {
    bs.turnoRound++;
    document.getElementById('mapa-batalha-turno').textContent = bs.turnoRound;
    mostrarToast(`🔄 Round ${bs.turnoRound}`, '');
    // Processar DOT/HOT/buffs por turno a cada novo round
    await _processarEfeitosCampanha();
  }

  // ── BUG-01 FIX: Decrementar cooldowns de habilidades ─────────────────────
  if (bs.cooldowns && typeof bs.cooldowns === 'object') {
    let cooldownMudou = false;
    for (const skillId of Object.keys(bs.cooldowns)) {
      if (bs.cooldowns[skillId] > 0) {
        bs.cooldowns[skillId]--;
        if (bs.cooldowns[skillId] === 0) delete bs.cooldowns[skillId];
        cooldownMudou = true;
      }
    }
    // Não precisa salvar separado — salvarEstadoBatalha abaixo já persiste cooldowns
  }
  // ─────────────────────────────────────────────────────────────────────────

  bs.ordemAtual = next;
  batalhaRenderOrdemStrip();
  batalhaRenderVezLabel();
  // Broadcast instantâneo (outros clientes atualizam sem esperar o DB)
  combateBroadcast('vez_passou', { batalhaId: BATALHA_ATUAL_ID, ordemAtual: bs.ordemAtual, turnoRound: bs.turnoRound });
  await salvarEstadoBatalha(BATALHA_ATUAL_ID);
  // 4.x — emitir turno_avancou para o Event Bus
  const _proxPartic = bs.participantes[next];
  if (_proxPartic) {
    HUB_EVENTS.emit('turno_avancou', {
      personagem: _proxPartic.nome,
      rodada: bs.turnoRound,
      batalhaId: BATALHA_ATUAL_ID
    });
  }
  _notificarVez(bs, BATALHA_ATUAL_ID);
  _atualizarBadgeMesa();
}

// ── Helper: verifica se um buff/debuff ainda está ativo ──────────────────────
function _buffAtivo(b) {
  if (!b) return false;
  return (b.dot_turnos_restantes ?? 0) > 0
    || (b.hot_turnos_restantes ?? 0) > 0
    || (b.sem_movimento && (b.sem_movimento_turnos_restantes ?? 0) > 0)
    || (b.sem_ataque    && (b.sem_ataque_turnos_restantes    ?? 0) > 0)
    || ((b.mod_dano ?? 0) !== 0 && (b.mod_dano_turnos_restantes ?? 0) > 0)
    || ((b.boost_dano   ?? 0) !== 0 && (b.boost_dano_turnos_restantes ?? 0) > 0)
    || ((b.mod_defesa   ?? 0) !== 0 && (b.mod_defesa_turnos_restantes ?? 0) > 0)
    || (b.rec_atributo && b.rec_modo === 'turno' && (b.rec_turnos_restantes ?? 0) > 0)
    || (b.turnos_restantes ?? 0) > 0;
}

// ── Helper: log detalhado de expiração de efeito ─────────────────────────────
function _logExpiracaoEfeito(b, nomePersonagem) {
  const r = [];
  if (b.sem_movimento) r.push('imobilização removida');
  if (b.sem_ataque) r.push(
    `bloqueio de ${
      b.sem_ataque_tipo === 'fisico' ? 'ataques físicos' :
      b.sem_ataque_tipo === 'magico' ? 'ataques mágicos' :
      'todos os ataques'
    } removido`
  );
  if (b.dot_formula) r.push('DOT encerrado');
  if (b.hot_formula) r.push('HOT encerrado');
  if ((b.boost_dano ?? 0) > 0) r.push('bônus de dano expirado');
  const det = r.length ? ` [${r.join('; ')}]` : '';
  return `⌛ Efeito "${b.nome}" expirou em ${nomePersonagem}${det}`;
}

// ── Processamento de efeitos por turno (campanha) ─────────────────────────────
async function _processarEfeitosCampanha() {
  if (!RPG_DATA?.rpgId || !RPG_DATA?.characters?.length) return;
  const logs = [];
  for (const c of RPG_DATA.characters) {
    const buffs = c.buffs || [];
    if (!buffs.length) continue;
    let mudou = false, hpMudou = false;
    const manter = [];
    for (const b of buffs) {
      // ── DOT ──────────────────────────────────────────────────
      if (b.dot_formula && (b.dot_turnos_restantes ?? 0) > 0) {
        const grupos = parsearFormulaDano(b.dot_formula);
        const rolagem = grupos ? rolarGrupos(grupos) : { total: parseInt(b.dot_formula) || 0 };
        const danoBruto = rolagem.total;
        const hpMax = c.custom_attrs?.hp_max ?? 100;
        // BUG-03 FIX: aplicar resistências e armaduras do alvo
        const attrDefsDot = getAttrDefsParaDano('campanha');
        const tipoDot = b.dot_tipo_dano || 'magico'; // campo opcional, padrão mágico
        const danoFinal = calcularDanoFinal(danoBruto, tipoDot, c, attrDefsDot, null);
        c.hp_atual = Math.max(0, (c.hp_atual ?? hpMax) - danoFinal);
        hpMudou = true;
        const reducaoLabel = danoFinal !== danoBruto ? ` (${danoBruto} bruto → ${danoFinal} após resistência)` : '';
        logs.push(`🩸 DOT "${b.nome}" causou ${danoFinal} de dano em ${c.nome}${reducaoLabel} (HP: ${c.hp_atual}/${hpMax})`);
        b.dot_turnos_restantes--;
        mudou = true;
      }
      // ── HOT ──────────────────────────────────────────────────
      if (b.hot_formula && (b.hot_turnos_restantes ?? 0) > 0) {
        const grupos = parsearFormulaDano(b.hot_formula);
        const rolagem = grupos ? rolarGrupos(grupos) : { total: parseInt(b.hot_formula) || 0 };
        const cura = rolagem.total;
        const hpMax = c.custom_attrs?.hp_max ?? 100;
        c.hp_atual = Math.min(hpMax, (c.hp_atual ?? hpMax) + cura);
        hpMudou = true;
        logs.push(`💚 HOT "${b.nome}" curou ${cura} HP de ${c.nome} (HP: ${c.hp_atual}/${hpMax}) — ${b.hot_turnos_restantes}t restante(s)`);
        b.hot_turnos_restantes--;
        mudou = true;
      }
      // ── Recuperação de atributo por turno ────────────────────
      if (b.rec_atributo && b.rec_modo === 'turno' && (b.rec_turnos_restantes ?? 0) > 0) {
        const grupos = parsearFormulaDano(b.rec_formula || '0');
        const rolagem = grupos ? rolarGrupos(grupos) : { total: parseInt(b.rec_formula)||0 };
        if (!c.custom_attrs.atributos) c.custom_attrs.atributos = {};
        const atual = parseFloat(c.custom_attrs.atributos[b.rec_atributo]) || 0;
        c.custom_attrs.atributos[b.rec_atributo] = atual + rolagem.total;
        logs.push(`🔷 "${b.nome}" recuperou ${rolagem.total} de ${b.rec_atributo} em ${c.nome}`);
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
          if (!c.custom_attrs.atributos) c.custom_attrs.atributos = {};
          c.custom_attrs.atributos[b.modificador_attr] =
            (parseFloat(c.custom_attrs.atributos[b.modificador_attr]) || 0) - b.modificador_delta;
          mudou = true;
        }
        logs.push(_logExpiracaoEfeito(b, c.nome)); }
      else manter.push(b);
    }
    if (mudou) {
      c.buffs = manter;
      const body = { buffs: c.buffs };
      if (hpMudou) body.hp_atual = c.hp_atual;
      // Sempre salvar custom_attrs para capturar mudanças de rec_atributo
      body.custom_attrs = c.custom_attrs;
      try {
        await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(c.nome)}`,
          { method:'PATCH', body:JSON.stringify(body) });
      } catch(e) {}
    }
  }
  if (logs.length) {
    logs.forEach(l => mostrarToast(l, ''));
    renderCharView?.(CHAR_VIEW); renderAttrView?.(ATTR_VIEW); mapaRenderStatus?.();
  }
}

function batalhaAtacarVez() {
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  if (!bs) return;
  const atual = bs.participantes[bs.ordemAtual];
  if (!atual) return;
  // Esconder botão enquanto modo de ataque está ativo
  const btnAtacar = document.getElementById('batalha-btn-atacar');
  if (btnAtacar) btnAtacar.style.display = 'none';
  // Usar modo de ataque dinâmico no mapa
  mapaAtaqueIniciar(atual.nome);
}

async function batalhaJogarPorOffline(nomeParticipante) {
  // Mestre assume o turno do jogador offline
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  if (!bs || RPG_DATA?.myRole !== 'mestre') return;
  if (bs.fase !== 'combate') { mostrarToast('Batalha ainda na fase de iniciativa', 'aviso'); return; }
  if (bs.pausada)            { mostrarToast('⏸ Batalha pausada', 'aviso'); return; }

  const atual = bs.participantes[bs.ordemAtual];
  if (!atual) return;

  // BUG-09 FIX: se nomeParticipante foi passado, validar que é a vez dele
  if (nomeParticipante && nomeParticipante !== atual.nome) {
    mostrarToast(`Ainda não é a vez de ${nomeParticipante} — aguardando ${atual.nome}`, 'aviso');
    return;
  }

  const cAtual = RPG_DATA?.characters?.find(x => x.nome === atual.nome);
  if (cAtual?.custom_attrs?.eh_pet) {
    mostrarToast('Pets agem no turno do dono — use o painel de pet', 'aviso');
    return;
  }
  mostrarToast(`🎮 Jogando por ${atual.nome}...`, '');
  const btnAtacar = document.getElementById('batalha-btn-atacar');
  if (btnAtacar) btnAtacar.style.display = 'none';
  mapaAtaqueIniciar(atual.nome);
}

function batalhaAvancarTurno() {
  if (RPG_DATA?.myRole === 'mestre') batalhaPassarVez();
}

function batalhaAtualizarTurno() {
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  const el = document.getElementById('mapa-batalha-turno');
  if (el && bs) el.textContent = bs.turnoRound || 1;
}

// ── PAUSAR / RETOMAR ─────────────────────────────────────────
async function pausarOuRetomarBatalha() {
  if (RPG_DATA?.myRole !== 'mestre') return;
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  if (!bs) return;
  bs.pausada = !bs.pausada;
  const btn = document.getElementById('batalha-btn-pausar');
  if (btn) btn.textContent = bs.pausada ? '▶ Retomar' : '⏸ Pausar';
  batalhaRenderVezLabel();
  combateBroadcast('batalha_pausada', { batalhaId: BATALHA_ATUAL_ID, pausada: bs.pausada });
  await salvarEstadoBatalha(BATALHA_ATUAL_ID);
  mostrarToast(bs.pausada ? '⏸ Batalha pausada' : '▶ Batalha retomada', '');
}

// ── ENCERRAR ─────────────────────────────────────────────────
async function encerrarBatalha() {
  if (RPG_DATA?.myRole !== 'mestre') return;
  if (!confirm('Encerrar esta batalha? A iniciativa será perdida.')) return;

  // Capturar bid ANTES de zerar BATALHA_ATUAL_ID
  const bid = BATALHA_ATUAL_ID;
  if (!bid) return;

  // Broadcast instantâneo: todos os clientes removem a batalha sem esperar o DELETE propagar
  combateBroadcast('batalha_encerrada', { batalhaId: bid });

  // ── Limpar buffs de todos os participantes ao encerrar ──────────────────
  const bs = MAPA_STATE.batalhas[bid];
  if (bs?.participantes?.length) {
    for (const p of bs.participantes) {
      const c = RPG_DATA?.characters?.find(x => x.nome === p.nome);
      if (c && Array.isArray(c.buffs) && c.buffs.length) {
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
          await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(p.nome)}`,
            { method: 'PATCH', body: JSON.stringify({ buffs: [], custom_attrs: c.custom_attrs }) });
        } catch(e) {}
      }
    }
  }

  // Remover localmente
  delete MAPA_STATE.batalhas[bid];
  BATALHA_ATUAL_ID = null;
  _aplicarEstadoBatalhaUI();
  _atualizarBadgeMesa();
  _atualizarSeletorBatalhas();

  // Deletar do banco (DELETE real, não apenas ativa=false)
  try {
    const rpgId = RPG_DATA.rpgId;
    await sb(`batalhas?rpg_id=eq.${encodeURIComponent(rpgId)}&id=eq.${encodeURIComponent(bid)}`, { method: 'DELETE' });
  } catch(e) {}

  mostrarToast('Batalha encerrada', '');
}

// ── ENTRAR EM BATALHA (compat) ────────────────────────────────
function entrarBatalha() { abrirModalIniciarBatalha(); }

// ── VERIFICAR VITÓRIA ─────────────────────────────────────────
function _verificarVitoriaBatalha() {
  if (!BATALHA_ATUAL_ID) return;
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  if (!bs?.ativa || !bs.participantes?.length) return;

  // Verificar quais participantes ainda estão vivos
  const vivos = bs.participantes.filter(p => {
    const c = RPG_DATA?.characters?.find(x => x.nome === p.nome);
    return !c?.custom_attrs?.morto;
  });

  // Vitória se todos os vivos forem jogadores (nenhum NPC/inimigo vivo)
  const temInimigoVivo = vivos.some(p => p.tipo === 'npc');
  if (temInimigoVivo) return;

  // Vitória confirmada — aguardar um frame para o toast de morte aparecer antes
  setTimeout(() => _mostrarTelaVitoria(bs), 800);
}

// ── TELA DE VITÓRIA ───────────────────────────────────────────
function _mostrarTelaVitoria(bs) {
  if (!bs) return;
  const stats = bs.stats || {};

  // ── Calcular estatísticas ─────────────────────────────────────
  const danoMap = stats.dano || {};
  const habilidadesMap = stats.habilidades || {};
  const danoRecebidoMap = stats.danoRecebido || {};

  // Quem causou mais dano
  const rankDano = Object.entries(danoMap).sort((a,b) => b[1]-a[1]);
  const mvpDano = rankDano[0];

  // Habilidade mais usada
  const rankSkills = Object.entries(habilidadesMap).sort((a,b) => b[1]-a[1]);
  const skillTop = rankSkills[0];

  // Maior dano único
  const maiorDano = stats.maiorDano;

  // Quem recebeu mais dano (tanker)
  const rankRecebidoNpc = Object.entries(stats.danoRecebidoNpc || {}).sort((a,b) => b[1]-a[1]);
  const rankRecebido = Object.entries(danoRecebidoMap).sort((a,b) => b[1]-a[1]);
  const melhorTanker = rankRecebido[0]; // mais dano dos inimigos absorvido

  // Total de dano causado
  const danoTotal = Object.values(danoMap).reduce((acc, v) => acc + v, 0);
  const rounds = bs.turnoRound || 1;

  // Construir linhas do relatório
  const linhas = [];

  if (mvpDano) linhas.push({ icon: '🗡️', label: 'Maior Destruidor', valor: `${mvpDano[0]} — ${mvpDano[1]} de dano total` });
  if (skillTop) linhas.push({ icon: '✨', label: 'Habilidade Mais Usada', valor: `"${skillTop[0]}" — usada ${skillTop[1]}×` });
  if (maiorDano) linhas.push({ icon: '💥', label: 'Maior Golpe', valor: `${maiorDano.valor} de dano${maiorDano.habilidade ? ` com "${maiorDano.habilidade}"` : ''} por ${maiorDano.atacante || '?'} em ${maiorDano.alvo || '?'}` });
  if (melhorTanker) linhas.push({ icon: '🛡️', label: 'Mais Resistente (jogadores)', valor: `${melhorTanker[0]} — suportou ${melhorTanker[1]} de dano` });
  if (rankDano.length > 1) linhas.push({ icon: '⚔️', label: 'Ranking de Dano', valor: rankDano.map(([n,d], i) => `${i+1}º ${n} (${d})`).join(' · ') });
  linhas.push({ icon: '🔄', label: 'Duração da Batalha', valor: `${rounds} round${rounds > 1 ? 's' : ''}` });
  if (danoTotal > 0) linhas.push({ icon: '📊', label: 'Dano Total Causado', valor: `${danoTotal} de dano` });

  // Mortes inimigas
  const mortos = bs.participantes.filter(p => {
    const c = RPG_DATA?.characters?.find(x => x.nome === p.nome);
    return (p.tipo === 'npc') && c?.custom_attrs?.morto;
  });
  if (mortos.length) linhas.push({ icon: '💀', label: 'Inimigos Derrotados', valor: mortos.map(p => p.nome).join(', ') });

  // Broadcast vitória para todos
  combateBroadcast('batalha_vitoria', { batalhaId: BATALHA_ATUAL_ID, stats, rounds });

  // ── Montar HTML ───────────────────────────────────────────────
  const linhasHTML = linhas.map(l => `
    <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(200,168,75,0.12);border-radius:8px">
      <span style="font-size:1.3rem;flex-shrink:0;line-height:1.2">${l.icon}</span>
      <div>
        <div style="font-size:0.65rem;color:rgba(200,168,75,0.7);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px">${l.label}</div>
        <div style="font-size:0.85rem;color:#dce8f0;line-height:1.4">${l.valor}</div>
      </div>
    </div>`).join('');

  const overlay = document.createElement('div');
  overlay.id = 'batalha-vitoria-overlay';
  overlay.style.cssText = `position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);backdrop-filter:blur(6px);animation:fadeIn 0.4s ease`;

  overlay.innerHTML = `
    <style>
      @keyframes fadeIn { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }
      @keyframes shimmer { 0%,100%{text-shadow:0 0 20px #f0cc6a,0 0 40px rgba(200,168,75,0.4)} 50%{text-shadow:0 0 30px #f0cc6a,0 0 60px rgba(200,168,75,0.6),0 0 80px rgba(200,168,75,0.2)} }
      @keyframes starfall { 0%{transform:translateY(-20px);opacity:0} 30%{opacity:1} 100%{transform:translateY(0);opacity:1} }
      #batalha-vitoria-box { animation: fadeIn 0.45s cubic-bezier(0.16,1,0.3,1); }
      #batalha-vitoria-titulo { animation: shimmer 2.5s ease-in-out infinite; }
    </style>
    <div id="batalha-vitoria-box" style="background:linear-gradient(160deg,#0d1520 0%,#0a0c12 60%,#0d1520 100%);border:1px solid rgba(200,168,75,0.35);border-radius:16px;padding:36px 32px 28px;max-width:540px;width:92vw;max-height:88vh;overflow-y:auto;box-shadow:0 0 60px rgba(200,168,75,0.15),0 20px 60px rgba(0,0,0,0.8);position:relative">

      <!-- Decoração topo -->
      <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:200px;height:2px;background:linear-gradient(90deg,transparent,rgba(200,168,75,0.6),transparent)"></div>

      <!-- Título -->
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:3rem;margin-bottom:8px;animation:starfall 0.6s ease-out">🏆</div>
        <h2 id="batalha-vitoria-titulo" style="font-family:'Cinzel',serif;font-size:1.9rem;color:#f0cc6a;margin:0;letter-spacing:0.06em">VITÓRIA!</h2>
        <p style="font-size:0.8rem;color:rgba(200,168,75,0.55);margin:6px 0 0;letter-spacing:0.12em;text-transform:uppercase">O grupo saiu vitorioso da batalha</p>
      </div>

      <!-- Divisor -->
      <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(200,168,75,0.25),transparent);margin-bottom:20px"></div>

      <!-- Relatório -->
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px">
        ${linhasHTML || '<div style="color:rgba(200,200,200,0.4);text-align:center;padding:16px">Sem dados de combate registrados</div>'}
      </div>

      <!-- Decoração fundo -->
      <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(200,168,75,0.2),transparent);margin-bottom:20px"></div>

      <!-- Botão encerrar -->
      <div style="text-align:center">
        <button onclick="_encerrarBatalhaAposVitoria()" style="font-family:'Cinzel',serif;padding:12px 32px;background:linear-gradient(135deg,rgba(200,168,75,0.2),rgba(200,168,75,0.08));border:1px solid rgba(200,168,75,0.5);border-radius:8px;color:#f0cc6a;font-size:0.95rem;cursor:pointer;letter-spacing:0.06em;transition:all 0.2s" onmouseenter="this.style.background='linear-gradient(135deg,rgba(200,168,75,0.3),rgba(200,168,75,0.15))'" onmouseleave="this.style.background='linear-gradient(135deg,rgba(200,168,75,0.2),rgba(200,168,75,0.08))'">
          ⚔ Encerrar Batalha
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Sons/Vibração (se disponível)
  try { if (navigator.vibrate) navigator.vibrate([100,50,200]); } catch(e) {}
}

async function _encerrarBatalhaAposVitoria() {
  const overlay = document.getElementById('batalha-vitoria-overlay');
  if (overlay) overlay.remove();

  // Encerrar batalha automaticamente
  const bid = BATALHA_ATUAL_ID;
  if (!bid) return;

  // ── Limpar buffs de todos os participantes ao encerrar ──────────────────
  const bs = MAPA_STATE.batalhas[bid];
  if (bs?.participantes?.length) {
    for (const p of bs.participantes) {
      const c = RPG_DATA?.characters?.find(x => x.nome === p.nome);
      if (c && Array.isArray(c.buffs) && c.buffs.length) {
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
          await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(p.nome)}`,
            { method: 'PATCH', body: JSON.stringify({ buffs: [], custom_attrs: c.custom_attrs }) });
        } catch(e) {}
      }
    }
  }

  combateBroadcast('batalha_encerrada', { batalhaId: bid });
  delete MAPA_STATE.batalhas[bid];
  BATALHA_ATUAL_ID = null;
  _aplicarEstadoBatalhaUI();
  _atualizarBadgeMesa();
  _atualizarSeletorBatalhas();

  try {
    await sb(`batalhas?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&id=eq.${encodeURIComponent(bid)}`, { method: 'DELETE' });
  } catch(e) {}

  mostrarToast('⚔ Batalha encerrada com vitória!', 'sucesso');
}


// Navega para o mapa da primeira batalha ativa encontrada (exceto o atual)
function _irParaBatalhaAtiva() {
  const mapaId = MAPA_STATE.mapaAtualId;
  const outra = Object.values(MAPA_STATE.batalhas).find(b => b.ativa && b.mapa_id !== mapaId);
  if (outra?.mapa_id) selecionarMapa(outra.mapa_id);
}

// ── APLICAR UI ────────────────────────────────────────────────
function _aplicarEstadoBatalhaUI() {
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const mapaId = MAPA_STATE.mapaAtualId;

  if (isMestre) {
    // Mestre: BATALHA_ATUAL_ID sempre limitado ao mapa atual.
    // Batalhas de outros mapas ficam ocultas (mostradas só como notificação).
    const bDoMapa = batalhaDoMapa(mapaId);
    if (bDoMapa) {
      BATALHA_ATUAL_ID = Object.keys(MAPA_STATE.batalhas).find(k => MAPA_STATE.batalhas[k] === bDoMapa) || null;
    } else {
      BATALHA_ATUAL_ID = null;
    }
  } else {
    // Jogador: SEMPRE sincronizar para a batalha em que participa.
    const minhaId = batalhaIdMinha();
    if (minhaId) {
      BATALHA_ATUAL_ID = minhaId;
    } else if (BATALHA_ATUAL_ID && !MAPA_STATE.batalhas[BATALHA_ATUAL_ID]?.ativa) {
      BATALHA_ATUAL_ID = null;
    }
  }

  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  // Para jogadores: só mostrar batalha se ela for do mapa atual
  const batalhaEDoMapaAtual = bs && bs.mapa_id === mapaId;

  const bar = document.getElementById('mapa-batalha-bar');
  const btnEntrar = document.getElementById('mapa-batalha-btn');
  const btnOutro = document.getElementById('mapa-batalha-outro');
  const wrap = document.getElementById('mapa-wrap');

  // Notificação de batalha em outro mapa (só mestre, quando não há batalha no mapa atual)
  if (btnOutro) {
    if (isMestre && !batalhaEDoMapaAtual) {
      const outrasBatalhas = Object.values(MAPA_STATE.batalhas).filter(b => b.ativa && b.mapa_id !== mapaId);
      if (outrasBatalhas.length) {
        const nomes = outrasBatalhas.map(b => b.mapa_nome || b.mapa_id).join(', ');
        btnOutro.style.display = '';
        btnOutro.textContent = `⚔ Batalha em andamento: ${nomes} — toque para navegar`;
      } else {
        btnOutro.style.display = 'none';
      }
    } else {
      btnOutro.style.display = 'none';
    }
  }

  if (!bs || !bs.ativa || !batalhaEDoMapaAtual) {
    if (bar) bar.style.display = 'none';
    if (btnEntrar) btnEntrar.style.display = isMestre ? '' : 'none';
    if (wrap) wrap.classList.remove('batalha-ativa');
    return;
  }

  if (bar) bar.style.display = 'flex';
  if (btnEntrar) btnEntrar.style.display = 'none';
  if (wrap) wrap.classList.add('batalha-ativa');

  const ctrlMestre = document.getElementById('batalha-ctrl-mestre');
  if (ctrlMestre) ctrlMestre.style.display = isMestre ? 'flex' : 'none';

  const btnPausar = document.getElementById('batalha-btn-pausar');
  if (btnPausar) btnPausar.textContent = bs.pausada ? '▶ Retomar' : '⏸ Pausar';

  document.getElementById('mapa-batalha-turno').textContent = bs.turnoRound || 1;

  const faseIni = document.getElementById('batalha-fase-iniciativa');
  const faseCom = document.getElementById('batalha-fase-combate');
  const faseLabel = document.getElementById('batalha-fase-label');

  if (bs.fase === 'iniciativa' || bs.fase === 'empate') {
    if (faseIni) faseIni.style.display = '';
    if (faseCom) faseCom.style.display = 'none';
    if (faseLabel) faseLabel.textContent = bs.fase === 'empate' ? '⚠ Empate — re-rolar' : '🎲 Rolando iniciativas…';
    batalhaRenderFaseIniciativa();
    if (isMestre) batalhaVerificarIniciativasCompletas(BATALHA_ATUAL_ID);
  } else if (bs.fase === 'combate') {
    if (faseIni) faseIni.style.display = 'none';
    if (faseCom) faseCom.style.display = '';
    if (faseLabel) faseLabel.textContent = bs.pausada ? '⏸ Pausada' : `⚔ ${bs.mapa_nome || 'Batalha'} ${isMestre ? '' : '— seu mapa'}`;
    batalhaRenderOrdemStrip();
    batalhaRenderVezLabel();
    batalhaRenderDados();
  }
}

// ── DADOS (para rolagem avulsa durante batalha) ───────────────
function batalhaRenderDados() {
  const el = document.getElementById('mapa-batalha-dados');
  if (!el) return;
  const ativos = getDiceConfig(RPG_DATA.rpgId);
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  el.innerHTML = ativos.map(d => {
    const sel = bs?.dadoSel === d;
    return `<button class="batalha-dado-btn${sel?' ativo':''}" onclick="batalhaSelDado(${d},this)">
      <svg viewBox="0 0 40 40" fill="none" style="width:18px;height:18px">${svgDado(d)}</svg>d${d}
    </button>`;
  }).join('');
}

function batalhaSelDado(d, btn) {
  if (MAPA_STATE.batalhas[BATALHA_ATUAL_ID]) MAPA_STATE.batalhas[BATALHA_ATUAL_ID].dadoSel = d;
  document.querySelectorAll('.batalha-dado-btn').forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
  batalhaRolarDado();
}

function batalhaRolarDado() {
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  const d = bs?.dadoSel;
  if (!d) return;
  const r = Math.floor(Math.random() * d) + 1;
  const res = document.getElementById('mapa-batalha-resultado');
  const num = document.getElementById('mapa-batalha-res-num');
  const lbl = document.getElementById('mapa-batalha-res-label');
  if (!res || !num || !lbl) return;
  res.style.display = 'block';
  num.textContent = r;
  num.style.color = (d===20&&r===20)?'#f0cc6a':(d===20&&r===1)?'#e74c3c':'var(--primario-v)';
  lbl.textContent = (d===20&&r===20)?'✦ Crítico!':(d===20&&r===1)?'✦ Falha!':`d${d}`;
  num.style.transform = 'scale(1.3)';
  setTimeout(() => { num.style.transform = ''; }, 200);
}

document.addEventListener('keydown', (e) => {
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  if (e.code === 'Space' && bs?.dadoSel) {
    const mapaAberto = document.getElementById('tab-mapas')?.classList.contains('active');
    if (mapaAberto) { e.preventDefault(); batalhaRolarDado(); }
  }
});

// ── DELETE DE MAPA ────────────────────────────────────────────
async function deletarMapaAtual() {
  // Redirecionar para o modal com confirmação inline
  abrirModalMapaConfig();
  setTimeout(() => pedirConfirmacaoExcluirMapa(), 200);
}


// ── TOGGLE VISIBILIDADE NPC NO MAPA GERAL ────────────────────
async function toggleNpcVisivelGeral(nome) {
  const c = RPG_DATA.characters.find(ch => ch.nome === nome);
  if (!c) return;
  const ca = c.custom_attrs || {};
  ca.visivel_geral = ca.visivel_geral === false ? true : false; // toggle (padrão true)
  c.custom_attrs = ca;
  try {
    await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nome)}`, {
      method:'PATCH', body: JSON.stringify({custom_attrs: ca})
    });
    mostrarToast(`${nome}: ${ca.visivel_geral ? 'visível no mapa geral' : 'oculto no mapa geral'}`, '');
  } catch(e) {}
  const mapas = RPG_DATA.mapas || [];
  const entry = mapas.find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
  if (entry) mapaRenderTokens(entry.mapa);
  mapaRenderStatus();
}

// ── FERRAMENTA DE MEDIÇÃO ─────────────────────────────────────
// (toggleMapaTool já definida acima — versão completa com suporte a zonas)


// ════════════════════════════════════════════════════════════════════════════
// FASE 3 — CONTROLES E MOVIMENTAÇÃO
// 3.1 Setinhas com snap de célula
// 3.2 Clique simples = selecionar / duplo = controlar (mestre)
// 3.3 Tab retorna ao personagem vinculado
// ════════════════════════════════════════════════════════════════════════════

// ── Estado de controle de token ───────────────────────────────────────────
const TOKEN_CTRL = {
  nomeControle: null,      // token com controle de teclado (mestre: dblclick)
  nomeSelecionado: null,   // token selecionado visualmente (clique simples)
};

// Teclas setas pressionadas simultaneamente (para diagonal)
const _TECLAS_ATIVAS = new Set();

document.addEventListener('keydown', (e) => {
  _TECLAS_ATIVAS.add(e.key);
  _processarSetinhaMapa(e);
});
document.addEventListener('keyup', (e) => {
  _TECLAS_ATIVAS.delete(e.key);
});

function _processarSetinhaMapa(e) {
  const setas = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
  if (!setas.includes(e.key)) return;

  // Só atua quando aba mapa está aberta
  const mapaAtivo = document.getElementById('tab-mapas')?.classList.contains('active');
  if (!mapaAtivo) return;

  // Não capturar seta quando foco está em input/textarea
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (['input','textarea','select'].includes(tag)) return;

  e.preventDefault();

  const nomeToken = _getTokenControleAtual();

  if (!nomeToken) {
    // Nenhum token: mover câmera
    const step = 30;
    if (e.key === 'ArrowLeft')  MAPA_ZOOM.panX += step;
    if (e.key === 'ArrowRight') MAPA_ZOOM.panX -= step;
    if (e.key === 'ArrowUp')    MAPA_ZOOM.panY += step;
    if (e.key === 'ArrowDown')  MAPA_ZOOM.panY -= step;
    MAPA_ZOOM.modo = 'manual';
    mapaZoomApply();
    return;
  }

  // Calcular delta: suporte diagonal (duas setas ao mesmo tempo)
  let dc = 0, dr = 0;
  if (_TECLAS_ATIVAS.has('ArrowLeft'))  dc -= 1;
  if (_TECLAS_ATIVAS.has('ArrowRight')) dc += 1;
  if (_TECLAS_ATIVAS.has('ArrowUp'))    dr -= 1;
  if (_TECLAS_ATIVAS.has('ArrowDown'))  dr += 1;

  if (dc === 0 && dr === 0) return;
  _moverTokenPorSeta(nomeToken, dc, dr);
}

async function _moverTokenPorSeta(nome, dc, dr) {
  const mapId = MAPA_STATE?.mapaAtualId;
  if (!mapId) return;
  const c = RPG_DATA?.characters?.find(ch => ch.nome === nome);
  if (!c) return;

  const pos = getPosicaoNoMapa(c, mapId);
  if (!pos) return;

  const mapa = _getMapaById(mapId);
  if (!mapa) return;

  const colAtual = pos.col ?? 0;
  const rowAtual = pos.row ?? 0;
  const colDest  = Math.max(0, Math.min((mapa.largura_total || 20) - 1, colAtual + dc));
  const rowDest  = Math.max(0, Math.min((mapa.altura_total  || 20) - 1, rowAtual + dr));

  if (colDest === colAtual && rowDest === rowAtual) return;

  // Verificar se parede bloqueia o caminho
  if (paredeBloqueiaMovimento(mapId, colAtual, rowAtual, dc, dr)) {
    mostrarToast('🧱 Parede bloqueia o caminho!', 'erro');
    return;
  }
  // Verificar se obstáculo/porta fechada bloqueia
  if (typeof cenarioObstaculoBloqueiaMovimento === 'function' && cenarioObstaculoBloqueiaMovimento(mapId, colDest, rowDest)) {
    mostrarToast('🚧 Caminho bloqueado!', 'erro');
    return;
  }
  // Verificar se porta fechada bloqueia (porta não adjacente = já bloqueada por parede)
  const _portaNo = (RPG_DATA?.mapas||[]).find(l=>l.mapa.map_id===mapId);
  if (_portaNo) {
    const _portas = _portaNo.mapa?.render_data?.portas || [];
    const _portaBlq = _portas.find(p => !p.aberta && p.col === colDest && p.row === rowDest);
    if (_portaBlq) {
      mostrarToast('🔒 ' + (_portaBlq.nome||'Porta') + ' está fechada!', 'aviso');
      return;
    }
  }

  // 2.6 — verificar raio máximo da câmera
  if (!cameraVerificarRaio(mapId, nome, colDest, rowDest)) {
    cameraBloqueioFeedback(nome);
    return;
  }

  // 3.4 — verificar pontos de movimento (será verificado via movimentoRestante)
  const batalhaId = BATALHA_ATUAL_ID;
  const bs = batalhaId ? MAPA_STATE.batalhas[batalhaId] : null;
  if (bs && bs.fase === 'combate' && !bs.pausada) {
    const movRest = (bs.movimentoRestante || {})[nome];
    if (movRest === 0) {
      mostrarToast('🚫 Sem pontos de movimento restantes!', 'erro');
      return;
    }
    if (movRest !== undefined) {
      bs.movimentoRestante[nome] = Math.max(0, movRest - 1);
    }
  }

  // Atualizar posição
  if (!c.map_positions) c.map_positions = {};
  const novaPos = { col: colDest, row: rowDest };
  c.map_positions[mapId] = novaPos;
  c.active_map_id = mapId;

  // Re-renderizar token
  const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === mapId);
  if (entry) mapaRenderTokens(entry.mapa);

  // Emitir evento
  HUB_EVENTS.emit('token_moveu', { nome, deCelula: pos, paraCelula: novaPos });

  // Broadcast para outros clientes (usar x/y% para retrocompat.)
  const W = mapa.largura_total || 20, H = mapa.altura_total || 20;
  const xPct = ((colDest + 0.5) / W * 100).toFixed(2);
  const yPct = ((rowDest + 0.5) / H * 100).toFixed(2);
  tokenMoveBroadcast({ sid: _TOKEN_MOVE_SID, nome, x: parseFloat(xPct), y: parseFloat(yPct), mapId, contexto: 'campanha' });

  // Salvar no banco (debounced)
  clearTimeout(MAPA_STATE.dragTimer);
  const posSnap = JSON.parse(JSON.stringify(c.map_positions));
  MAPA_STATE.dragTimer = setTimeout(async () => {
    try {
      await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nome)}`,
        { method:'PATCH', body: JSON.stringify({ active_map_id: mapId, map_positions: posSnap }) });
    } catch(e) {}
  }, 400);
}

// ── Quem controla o teclado no momento ───────────────────────────────────
function _getTokenControleAtual() {
  const isMestre = RPG_DATA?.myRole === 'mestre';
  // No mobile landscape o mestre age como jogador — controla seu personagem vinculado
  if (isMestre && isMobileLandscape()) {
    return RPG_DATA?.linked || null;
  }
  if (isMestre) {
    // Desktop: controla o token que recebeu dblclick
    return TOKEN_CTRL.nomeControle;
  }
  // Jogador: sempre seu personagem vinculado
  return RPG_DATA?.linked || null;
}

// ── 3.2 — Separar clique simples (selecionar) de duplo (controlar) ───────
// Patch no click handler do token em mapaRenderTokens:
// O dblclick do NPC (abrirModalImg) é do mestre — mantemos mas adicionamos
// comportamento de assumir controle

function _tokenCliqueSimples(nome) {
  TOKEN_CTRL.nomeSelecionado = nome;
  // Atualizar visual: anel mais grosso no selecionado
  document.querySelectorAll('.mapa-token').forEach(el => {
    const circle = el.querySelector('.mapa-token-circle');
    if (circle) {
      circle.style.boxShadow = el.dataset.nome === nome
        ? '0 0 0 3px rgba(200,168,75,0.8)' : '';
    }
  });
  // Atualizar painel de botões contextuais
  _ctxAtualizarPainelDesktop(nome);
  // Se sidebar existe, abrir ficha nela; caso contrário, manter comportamento legado
  const _hasSidebar = !!document.getElementById('mapa-sidebar');
  if (_hasSidebar) {
    abrirFichaNoMapa(nome); // vai para sidebar
  } else {
    mapaClicarToken(nome); // legado: modal fixo
  }
}

function _ctxAtualizarPainelDesktop(nome) {
  if (isMobileLandscape()) return; // mobile usa zona direita
  // Atualizar painel de ações: desktop → mesa-acao-painel; mobile → ctx-sidebar
  // Ambos chamam _mesaRenderAcoes / sidebar render conforme disponibilidade
  TOKEN_CTRL.nomeSelecionado = TOKEN_CTRL.nomeSelecionado || nome;

  // Desktop 3-col: re-renderizar painel de ações completo
  if (document.getElementById('mesa-acao-painel')) {
    _mesaRenderAcoes?.();
    return;
  }

  // Mobile sidebar: render ctx buttons no slot de ctx
  const sidebarLista = document.getElementById('ctx-sidebar-lista');
  const sidebarWrap  = document.getElementById('ctx-sidebar-botoes');
  const mapId = MAPA_STATE?.mapaAtualId;
  if (!mapId) { _ctxSidebarLimpar(); return; }
  const botoes = ctxGerarBotoes(nome, mapId);
  const { visiveis, ocultos } = ctxPriorizar(botoes);

  if (sidebarLista && sidebarWrap) {
    if (!visiveis.length) { sidebarWrap.style.display = 'none'; return; }
    sidebarWrap.style.display = 'block';
    sidebarLista.innerHTML = '';
    visiveis.forEach(b => {
      const btn = document.createElement('button');
      btn.style.cssText = 'width:100%;padding:7px 10px;background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.25);border-radius:8px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer;text-align:left;transition:background .15s;line-height:1.3';
      btn.innerHTML = '<span style="display:block">'+b.label+'</span>'+(b.sublabel?'<span style="color:rgba(200,168,75,0.7);font-size:0.55rem">'+b.sublabel+'</span>':'');
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(79,163,209,0.18)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(79,163,209,0.08)');
      btn.addEventListener('click', () => { ctxExecutarAcao(b); _ctxSidebarLimpar(); });
      sidebarLista.appendChild(btn);
    });
    if (ocultos.length) {
      const mais = document.createElement('button');
      mais.style.cssText = 'width:100%;padding:5px;background:none;border:1px dashed rgba(79,163,209,0.2);border-radius:8px;color:rgba(79,163,209,0.5);font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer';
      mais.textContent = '+ ' + ocultos.length + ' mais';
      mais.addEventListener('click', () => ctxMostrarOcultos(ocultos));
      sidebarLista.appendChild(mais);
    }
  }
}

function _tokenDuploClique(nome) {
  const isMestre = RPG_DATA?.myRole === 'mestre';
  if (!isMestre) return;
  TOKEN_CTRL.nomeControle = nome;
  mostrarToast(`🎮 Controlando ${nome}`, '');
  // Feedback visual: destaque especial no token controlado
  document.querySelectorAll('.mapa-token').forEach(el => {
    el.querySelector('.mapa-token-circle')?.style.setProperty('outline',
      el.dataset.nome === nome ? '2px dashed rgba(94,224,154,0.8)' : 'none'
    );
  });
}

// ── 3.3 — Tab retorna ao personagem vinculado ────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const mapaAtivo = document.getElementById('tab-mapas')?.classList.contains('active');
  if (!mapaAtivo) return;
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (['input','textarea','select'].includes(tag)) return;
  const vinculado = RPG_DATA?.linked;
  if (!vinculado) return;
  e.preventDefault();
  TOKEN_CTRL.nomeControle = vinculado;
  TOKEN_CTRL.nomeSelecionado = vinculado;
  mostrarToast(`↩ Controlando ${vinculado}`, '');
  // Centralizar câmera no personagem vinculado
  const c = RPG_DATA?.characters?.find(ch => ch.nome === vinculado);
  const mapId = MAPA_STATE?.mapaAtualId;
  if (c && mapId) {
    const pos = getPosicaoNoMapa(c, mapId);
    if (pos) {
      const mapa = _getMapaById(mapId);
      const W = mapa?.largura_total || 20, H = mapa?.altura_total || 20;
      const bg = document.getElementById('mapa-img');
      const wrap = document.getElementById('mapa-wrap');
      if (bg && wrap) {
        const bW = bg.offsetWidth, bH = bg.offsetHeight;
        const wW = wrap.offsetWidth, wH = wrap.offsetHeight;
        const pctX = (pos.col + 0.5) / W;
        const pctY = (pos.row + 0.5) / H;
        MAPA_ZOOM.panX = wW/2 - pctX * bW * MAPA_ZOOM.zoom;
        MAPA_ZOOM.panY = wH/2 - pctY * bH * MAPA_ZOOM.zoom;
        mapaZoomApply();
      }
    }
  }
});


// ════════════════════════════════════════════════════════════════════════════
// 3.4 — SISTEMA DE PONTOS DE MOVIMENTO POR TURNO
// ════════════════════════════════════════════════════════════════════════════

function movCalcVelocidade(charNome) {
  const c = RPG_DATA?.characters?.find(ch => ch.nome === charNome);
  if (!c) return 4;
  const ca = c.custom_attrs || {};
  // Configuração da campanha (com defaults razoáveis)
  const cfg = RPG_DATA?.config || {};
  const base   = parseInt(cfg.velocidade_base)  || 4;
  const fator  = parseInt(cfg.velocidade_fator) || 4;
  // Atributo Destreza (ou similar configurado)
  const destr  = parseFloat(ca.atributos?.Destreza || ca.atributos?.destreza || 0);
  const bonus  = Math.floor(destr / fator);
  // Buffs/debuffs de velocidade
  const buffs  = c.buffs || [];
  const modVel = buffs.reduce((sum, b) => {
    if (b.sem_movimento && (b.sem_movimento_turnos_restantes ?? 0) > 0) return -9999;
    return sum;
  }, 0);
  return Math.max(0, base + bonus + modVel);
}

function movResetTurno(batalhaId, charNome) {
  const bs = MAPA_STATE.batalhas[batalhaId];
  if (!bs) return;
  if (!bs.movimentoRestante) bs.movimentoRestante = {};
  if (!bs.acaoRestante)      bs.acaoRestante      = {};
  bs.movimentoRestante[charNome] = movCalcVelocidade(charNome);
  bs.acaoRestante[charNome]      = 1;
}

function movGetRestante(batalhaId, charNome) {
  const bs = MAPA_STATE.batalhas[batalhaId];
  if (!bs || !bs.movimentoRestante) return Infinity;
  const v = bs.movimentoRestante[charNome];
  return v === undefined ? movCalcVelocidade(charNome) : v;
}

function movConsumirAcao(batalhaId, charNome) {
  const bs = MAPA_STATE.batalhas[batalhaId];
  if (!bs) return true;
  if (!bs.acaoRestante) bs.acaoRestante = {};
  const cfg = RPG_DATA?.config || {};
  if (bs.acaoRestante[charNome] <= 0) return false;
  bs.acaoRestante[charNome] = 0;
  // Modo exclusivo: usar ação cancela movimento restante
  if (cfg.turno_modo_exclusivo) bs.movimentoRestante[charNome] = 0;
  return true;
}

// Registrar listener: reset de movimento ao avançar turno
HUB_EVENTS.on('turno_avancou', ({ personagem, batalhaId }) => {
  if (batalhaId && personagem) movResetTurno(batalhaId, personagem);
});


// ════════════════════════════════════════════════════════════════════════════
// 3.5 — BOTÕES CONTEXTUAIS POR POSIÇÃO NO GRID
// Emergem baseados na posição do token no mapa
// ════════════════════════════════════════════════════════════════════════════

function ctxGerarBotoes(charNome, mapId) {
  const botoes = [];
  const c = (RPG_DATA?.characters || []).find(ch => ch.nome === charNome);
  if (!c) return botoes;
  const pos = getPosicaoNoMapa(c, mapId);
  if (!pos) return botoes;

  const isMestre   = RPG_DATA?.myRole === 'mestre';
  const mapa       = _getMapaById(mapId);
  const chars      = RPG_DATA?.characters || [];
  const habilidades = atkGetHabilidadesCampanha(charNome);
  const batalhaId  = BATALHA_ATUAL_ID;
  const bs         = batalhaId ? MAPA_STATE.batalhas[batalhaId] : null;
  const emCombate  = bs?.fase === 'combate' && !bs?.pausada;
  const movRest    = batalhaId ? movGetRestante(batalhaId, charNome) : Infinity;
  const ca         = c.custom_attrs || {};
  const hp         = c.hp_atual ?? (ca.hp_max || 100);
  const hpMax      = ca.hp_max || 100;
  const hpPct      = hp / hpMax;

  // ── 1. Skills de ataque/buff baseadas em alcance posicional ──────────────
  for (const h of habilidades) {
    if (!h.alcance_celulas) continue;
    if (h.alvo_tipo === 'proprio') continue; // tratado na zona central mobile (3.7)
    if (h.criativo) continue; // ação criativa não é contextual

    const targets = chars.filter(alvo => {
      if (alvo.nome === charNome) return false;
      const ca2 = alvo.custom_attrs || {};
      const isNpcAlvo = ca2.tipo_personagem === 'npc' || ca2.tipo === 'npc';
      if (h.alvo_tipo === 'inimigo'  && !isNpcAlvo) return false;
      if (h.alvo_tipo === 'aliado'   &&  isNpcAlvo) return false;
      return alvo.active_map_id === mapId;
    });

    for (const alvo of targets) {
      const dist = atkDistanciaCelulas(charNome, alvo.nome);
      if (dist === null) continue;
      const alvoHp = alvo.hp_atual ?? 100;

      if (dist <= h.alcance_celulas) {
        botoes.push({
          label: `${h.nome} → ${alvo.nome}`,
          acao: 'usar_skill',
          skill: h,
          alvo: alvo.nome,
          prioridade: h.alvo_tipo === 'inimigo'
            ? (hpPct > 0.5 ? 10 : 8)  // atacar tem prioridade quando saudável
            : (alvoHp < 30 ? 9 : 5),   // curar tem prioridade quando aliado crítico
          desabilitado: false,
        });
      } else if (h.alvo_tipo === 'inimigo' && emCombate) {
        // Fora do alcance — mostrar se movimento permite chegar
        const movNecessario = dist - h.alcance_celulas;
        if (movNecessario <= movRest) {
          botoes.push({
            label: `${h.nome} → ${alvo.nome}`,
            sublabel: `mova ${movNecessario}c`,
            acao: 'usar_skill',
            skill: h,
            alvo: alvo.nome,
            prioridade: 2,
            desabilitado: false,
            requerMovimento: movNecessario,
          });
        }
      }
    }
  }

  // ── 2. Saquear (token morto com loot adjacente) ───────────────────────
  const mortos = chars.filter(alvo => {
    if (alvo.active_map_id !== mapId) return false;
    const ca2 = alvo.custom_attrs || {};
    return ca2.morto && ca2.tem_loot;
  });
  for (const morto of mortos) {
    const dist = atkDistanciaCelulas(charNome, morto.nome);
    if (dist !== null && dist <= 1) {
      botoes.push({
        label: `Saquear ${morto.nome}`,
        acao: 'saquear',
        alvo: morto.nome,
        prioridade: 7,
        desabilitado: false,
      });
    }
  }

  // ── 3. Zonas de interesse adjacentes ─────────────────────────────────
  const locais = mapa?.locais || [];
  for (const zona of locais) {
    if (!zona.local_id && !zona.mapa_local_id) continue;
    // Calcular distância do token à zona
    const zW = mapa.largura_total || 20, zH = mapa.altura_total || 20;
    const zCol = Math.round(((zona.x ?? zona.x_percent ?? 0) / 100) * zW);
    const zRow = Math.round(((zona.y ?? zona.y_percent ?? 0) / 100) * zH);
    const distZ = Math.max(Math.abs((pos.col ?? 0) - zCol), Math.abs((pos.row ?? 0) - zRow));
    if (distZ <= 1) {
      if (zona.mapa_local_id) {
        botoes.push({ label: `Entrar: ${zona.nome}`, acao: 'entrar_mapa', mapaId: zona.mapa_local_id, prioridade: 6 });
      } else if (zona.local_id) {
        botoes.push({ label: zona.nome || 'Interagir', acao: 'zona', zonaId: zona.local_id, prioridade: 4 });
      }
    }
  }

  // ── 4. Ordenar e limitar ──────────────────────────────────────────────
  botoes.sort((a, b) => (b.prioridade || 0) - (a.prioridade || 0));
  return botoes;
}

// Priorizar: max 3 visíveis, resto em "..."
function ctxPriorizar(botoes) {
  const visiveis = botoes.slice(0, 3);
  const ocultos  = botoes.slice(3);
  return { visiveis, ocultos };
}

// Executar ação contextual
function ctxExecutarAcao(botao) {
  if (!botao || botao.desabilitado) return;
  const _charAtivo = TOKEN_CTRL.nomeSelecionado || RPG_DATA?.linked;
  switch (botao.acao) {
    case 'usar_skill':
      if (botao.alvo && botao.skill) {
        COMBATE.contexto     = 'campanha';
        COMBATE.atacanteNome = _charAtivo;
        COMBATE.alvoNome     = botao.alvo;
        COMBATE.habilidadeSel = botao.skill;
        COMBATE._habilidades  = atkGetHabilidadesCampanha(_charAtivo);
        COMBATE._alvos        = [];
        COMBATE._jaAplicado   = false;
        mapaAtaqueIniciar(_charAtivo);
      } else {
        mapaAtaqueIniciar(_charAtivo);
      }
      break;
    case 'saquear':
      abrirModalLootToken(botao.alvo);
      break;
    case 'entrar_mapa':
      entrarMapaLocal(botao.mapaId);
      break;
    case 'zona':
      HUB_EVENTS.emit('zona_ativada', { zona: botao.zonaId, personagem: _charAtivo });
      break;
    case 'toggle_piloto':
      npcTogglePiloto(_charAtivo);
      break;
    case 'executar_turno_npc':
      npcExecutarTurnoAuto(_charAtivo).catch(() => {});
      break;
    case 'bau_grupo':
      renderInvBau?.();
      mostrarToast('Abra Inventário → Baú do Grupo', 'info');
      break;
  }
}

// Renderizar botões contextuais para o painel de combate existente
function ctxRenderizarPainelBotoes(charNome) {
  const mapId = MAPA_STATE?.mapaAtualId;
  if (!mapId) return;
  const botoes = ctxGerarBotoes(charNome, mapId);
  const { visiveis, ocultos } = ctxPriorizar(botoes);

  // Encontrar painel de botões contextuais existente ou criar
  let painel = document.getElementById('ctx-botoes-painel');
  if (!painel) return; // será renderizado pelo HTML existente

  painel.innerHTML = '';
  visiveis.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'ctx-btn';
    btn.innerHTML = `<span class="ctx-btn-label">${b.label}</span>${b.sublabel ? `<span class="ctx-btn-sub">${b.sublabel}</span>` : ''}`;
    btn.disabled = b.desabilitado;
    btn.onclick = () => ctxExecutarAcao(b);
    painel.appendChild(btn);
  });

  if (ocultos.length) {
    const maisBtn = document.createElement('button');
    maisBtn.className = 'ctx-btn ctx-btn-mais';
    maisBtn.textContent = `... +${ocultos.length}`;
    maisBtn.onclick = () => ctxMostrarOcultos(ocultos);
    painel.appendChild(maisBtn);
  }
}

function ctxMostrarOcultos(ocultos) {
  // Grade expansível acima do painel
  let grade = document.getElementById('ctx-grade-ocultos');
  if (!grade) {
    grade = document.createElement('div');
    grade.id = 'ctx-grade-ocultos';
    grade.style.cssText = 'position:fixed;bottom:120px;right:10px;z-index:9998;background:var(--escuro,#0a0f16);border:1px solid var(--borda,rgba(30,45,66,0.8));border-radius:10px;padding:8px;display:grid;grid-template-columns:1fr 1fr;gap:6px;max-width:280px';
    document.body.appendChild(grade);
  }
  grade.innerHTML = '';
  ocultos.forEach(b => {
    const btn = document.createElement('button');
    btn.style.cssText = 'padding:8px 10px;background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:8px;color:var(--texto,#c8d8e8);font-size:0.72rem;cursor:pointer;text-align:left;min-height:44px';
    btn.textContent = b.label;
    btn.onclick = () => { ctxExecutarAcao(b); grade.remove(); };
    grade.appendChild(btn);
  });
  // Fechar ao clicar fora
  setTimeout(() => {
    const close = () => { grade.remove(); document.removeEventListener('click', close); };
    document.addEventListener('click', close);
  }, 100);
}

// Expor globalmente
// ctxGerarBotoes: versão final é o patch da Fase 6 + melhorias
// window.ctxGerarBotoes já foi definido no patch acima
window.ctxExecutarAcao = ctxExecutarAcao;
window.ctxRenderizarPainelBotoes = ctxRenderizarPainelBotoes;

function mapaClicarToken(nome) {
  // Modo medição: selecionar pontos
  if (MAPA_STATE.toolMode === 'medicao') {
    const c = RPG_DATA.characters.find(ch => ch.nome === nome);
    if (!c) return;
    const pos = (c.map_positions||{})[MAPA_STATE.mapaAtualId];
    if (!pos) return;
    if (!MAPA_STATE.medicaoAtiva) {
      MAPA_STATE.medicaoAtiva = { pA: { nome, ...pos }, pB: null };
    } else if (!MAPA_STATE.medicaoAtiva.pB) {
      MAPA_STATE.medicaoAtiva.pB = { nome, ...pos };
      mapaDesenharDistancia();
    } else {
      MAPA_STATE.medicaoAtiva = { pA: { nome, ...pos }, pB: null };
      document.getElementById('mapa-dist-svg').innerHTML = '';
    }
    return;
  }
  // Modo de ataque dinâmico: clicar em alvo disponível
  if (ATAQUE_MAPA_STATE.ativo && ATAQUE_MAPA_STATE.fase === 'alvos') {
    const isAlvoValido = COMBATE._alvos.some(a => a.nome === nome);
    if (isAlvoValido) {
      mapaAtaqueClicarAlvo(nome);
      return;
    }
    // Clicar no próprio personagem (atacante) não faz nada
    if (nome === ATAQUE_MAPA_STATE.atacanteNome) return;
    // Clicar em personagem que não é alvo válido
    mostrarToast('⚔ Selecione um alvo destacado no mapa', '');
    return;
  }
  // Modo normal: abrir ficha compacta
  abrirFichaNoMapa(nome);
}

// ── FICHA COMPACTA — abre na sidebar (sem cobrir o mapa)
function fecharFichaNoMapa() {
  // Suporte legado: esconder overlay caso ainda exista
  const ov = document.getElementById('modal-ficha-mapa-overlay');
  if (ov) ov.style.display = 'none';
  // Limpar painel da sidebar
  const sp = document.getElementById('ficha-sidebar-painel');
  if (sp) sp.style.display = 'none';
}
function abrirFichaNoMapa(nome) {
  const c = RPG_DATA.characters.find(x => x.nome === nome);
  if (!c) return;
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const ca = c.custom_attrs || {};
  const isNpc = (ca.tipo_personagem || ca.tipo) === 'npc';
  const ocultarAtribs = !isMestre && isNpc && ca.ocultar_atributos === true;
  const cor = ca.cor || 'var(--primario)';
  const hp_max = ca.hp_max || 100;
  const hp = c.hp_atual ?? hp_max;
  const hpPct = Math.max(0, Math.min(100, Math.round(hp / hp_max * 100)));
  const hpColor = hpPct > 60 ? '#5ee09a' : hpPct > 30 ? '#f0cc6a' : '#e74c3c';
  const atribs = ca.atributos || {};
  const attrDefs = RPG_DATA.attrDefs || [];
  const nivel = ca.nivel || 1;
  const lc = (CURRENT_RPG?.theme?.level_config) || {};
  const nivel_max = lc.nivel_maximo || 20;
  const xp = ca.xp || 0;
  const xp_proximo = (!isNpc && nivel < nivel_max) ? nivel * 100 : null;
  const xpPct = xp_proximo ? Math.min(100, Math.round(xp / xp_proximo * 100)) : 0;

  // Skills
  const skills = _skFiltrarPorChar(RPG_DATA.skills || [], nome);
  const skHtml = skills.map(s => {
    const custoLabel = s.custo_tipo === 'movimento' ? '🏃 mov' : s.custo_tipo === 'nenhum' ? '—' : null;
    const metaRow = [
      s.formula_dano ? `<span style="font-size:0.78rem;color:var(--destaque)">🎲 ${s.formula_dano}</span>` : '',
      s.cooldown_turnos > 0 ? `<span style="font-size:0.75rem;color:#a07040">⏳ CD ${s.cooldown_turnos}t</span>` : '',
      s.tipo_dano && s.tipo_dano !== 'fisico' ? `<span style="font-size:0.72rem;color:var(--suave)">${s.tipo_dano}</span>` : '',
      custoLabel ? `<span style="font-size:0.7rem;color:rgba(200,168,75,0.7)">${custoLabel}</span>` : '',
    ].filter(Boolean).join(' · ');
    return `<div style="padding:8px 10px;background:rgba(10,15,25,0.6);border:1px solid rgba(255,255,255,0.05);border-radius:6px;margin-bottom:5px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
        <span style="font-family:var(--fonte-d);font-size:0.72rem;color:${cor};flex:1">${s.habilidade}</span>
        ${s.custo_rsv ? `<span style="font-size:0.6rem;padding:1px 6px;background:rgba(176,126,240,0.12);border:1px solid rgba(176,126,240,0.25);border-radius:10px;color:#b07ef0">${s.custo_rsv}</span>` : ''}
      </div>
      ${s.efeito ? `<div style="font-size:0.8rem;color:#8a9ab0;line-height:1.4">${s.efeito}</div>` : ''}
      ${metaRow ? `<div style="font-size:0.75rem;color:var(--suave);margin-top:3px">${metaRow}</div>` : ''}
    </div>`;
  }).join('');

  // Atributos visíveis (sem ocultar)
  const adVisiveis = ocultarAtribs ? [] : attrDefs;
  const adBasicos   = adVisiveis.filter(a => (a.categoria || 'basico') === 'basico' && a.tipo === 'number');
  const adEspeciais = adVisiveis.filter(a => a.categoria === 'status' && a.tipo === 'number');
  const statBoxes = adBasicos.map(a => {
    const v = atribs[a.nome] !== undefined ? atribs[a.nome] : '—';
    return `<div class="stat-box" style="border-top:2px solid ${cor}"><div class="stat-label">${a.nome}</div><div class="stat-valor" style="color:${cor}">${v}</div></div>`;
  }).join('');

  const recursosBars = adEspeciais.map(a => {
    const val = parseFloat(atribs[a.nome]) || 0;
    const nomeMax = a.nome.replace(/atual|current/i,'').trim();
    const aMax = attrDefs.find(d => d.nome.toLowerCase().includes(nomeMax.toLowerCase()) && d.nome !== a.nome && d.tipo === 'number');
    const maxVal = aMax ? parseFloat(atribs[aMax.nome]) || 0 : null;
    const pct = maxVal && maxVal > 0 ? Math.min(100, Math.round(val / maxVal * 100)) : null;
    return `<div style="margin-top:5px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
        <span style="font-family:var(--fonte-d);font-size:0.55rem;color:#b07ef0;text-transform:uppercase;letter-spacing:0.06em">${a.nome}</span>
        <span style="font-size:0.7rem;color:#b07ef0;font-family:var(--fonte-d)">${val}${maxVal ? '/'+maxVal : ''}</span>
      </div>
      ${pct != null ? `<div style="height:4px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:#b07ef0;border-radius:3px"></div></div>` : ''}
    </div>`;
  }).join('');

  // Toggle ocultar atributos (mestre + NPC)
  const toggleOcultar = (isMestre && isNpc) ? `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(176,126,240,0.05);border:1px solid rgba(176,126,240,0.15);border-radius:8px;margin-bottom:12px">
      <label style="display:flex;align-items:center;gap:8px;font-family:var(--fonte-d);font-size:0.6rem;color:#b07ef0;text-transform:uppercase;letter-spacing:0.07em;cursor:pointer;flex:1">
        <input type="checkbox" id="ficha-toggle-ocultar" onchange="fichaToggleOcultarAtribs('${nome.replace(/'/g,"\\'")}')" ${ca.ocultar_atributos ? 'checked' : ''} style="accent-color:#b07ef0">
        Ocultar atributos dos jogadores
      </label>
    </div>` : '';

  // Botão colocar/remover do mapa
  const mapId = MAPA_STATE.mapaAtualId;
  const estaNoMapa = mapId && c.active_map_id === mapId;
  const isMeuChar = c.nome === (RPG_DATA?.linked || '');
  // Mobile: qualquer jogador pode ajustar o tamanho de qualquer token — alteração salva só em cache local
  const _mobileAjuste = typeof _isMobile === 'function' && _isMobile();
  const mostrarBtnMapa = isMestre || isMeuChar || (_mobileAjuste && estaNoMapa);
  // Rótulo do botão Tamanho: indica "(local)" quando o jogador mobile ajusta um char que não é o seu
  const _tamBtnLabel = (_mobileAjuste && !isMestre && !isMeuChar) ? '⇕ Tamanho 📱' : '⇕ Tamanho';
  const btnMapa = mostrarBtnMapa ? `
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      ${(isMestre || (!estaNoMapa && isMeuChar)) ? `<button onclick="fecharFichaNoMapa();mapaPosicionarChar('${nome.replace(/'/g,"\\'")}') " style="flex:1;min-width:80px;padding:8px;background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.25);border-radius:7px;color:var(--primario-v);font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;text-transform:uppercase">📍 Posicionar</button>` : ''}
      ${estaNoMapa ? `<button onclick="fecharFichaNoMapa();mapaCharSizeAtivar('${nome.replace(/'/g,"\\'")}') " style="flex:1;min-width:80px;padding:8px;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.25);border-radius:7px;color:var(--destaque-v);font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;text-transform:uppercase">${_tamBtnLabel}</button>` : ''}
      ${isMestre && estaNoMapa ? `<button onclick="fecharFichaNoMapa();removeCharFromMap('${nome.replace(/'/g,"\\'")}') " style="flex:1;min-width:80px;padding:8px;background:rgba(192,57,43,0.07);border:1px solid rgba(192,57,43,0.2);border-radius:7px;color:#c0392b;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;text-transform:uppercase">✕ Remover</button>` : ''}
    </div>` : '';

  const imgUrl = normalizeImgUrl(ca.img_retrato || ca.img || ca.img_url || '');
  document.getElementById('modal-ficha-mapa-content').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:12px">
        ${imgUrl
          ? `<img src="${imgUrl}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid ${cor}" onerror="this.style.display='none'">`
          : `<div style="width:52px;height:52px;border-radius:50%;background:${cor}18;border:2px solid ${cor}44;display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:${cor}">${c.nome[0]||'?'}</div>`}
        <div>
          <div style="font-family:var(--fonte-d);font-size:1rem;color:var(--texto)">${c.nome}</div>
          <div style="font-size:0.78rem;color:${cor};font-style:italic">${ca.tipo||'jogador'}${ca.classe?' · '+ca.classe:''}${ca.raca?' · '+ca.raca:''}${!isNpc?' · Nv.'+nivel:''}</div>
        </div>
      </div>
      <button onclick="fecharFichaNoMapa()" style="background:none;border:none;color:var(--suave);font-size:1.4rem;cursor:pointer;flex-shrink:0">✕</button>
    </div>

    ${toggleOcultar}
    ${btnMapa}

    <!-- HP -->
    <div style="margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <span style="font-family:var(--fonte-d);font-size:0.58rem;color:${hpColor};text-transform:uppercase;letter-spacing:0.07em">HP</span>
        <span style="font-size:0.78rem;color:${hpColor};font-family:var(--fonte-d)">${hp} / ${hp_max}</span>
      </div>
      <div style="height:7px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${hpPct}%;background:${hpColor};border-radius:4px;transition:width 0.3s"></div>
      </div>
    </div>

    <!-- XP -->
    ${xp_proximo ? `<div style="margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <span style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--destaque);text-transform:uppercase;letter-spacing:0.07em">XP · Nv.${nivel}</span>
        <span style="font-size:0.75rem;color:var(--destaque);font-family:var(--fonte-d)">${xp}/${xp_proximo}</span>
      </div>
      <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${xpPct}%;background:var(--destaque);border-radius:3px"></div>
      </div>
    </div>` : ''}

    <!-- Recursos especiais -->
    ${recursosBars}

    <!-- Atributos básicos -->
    ${!ocultarAtribs && statBoxes ? `
      <div style="font-family:var(--fonte-d);font-size:0.55rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.08em;margin:10px 0 6px">Atributos</div>
      <div class="stats-grid">${statBoxes}</div>` : ''}

    ${ocultarAtribs ? `<div style="font-size:0.78rem;color:var(--suave);font-style:italic;text-align:center;padding:8px 0">— atributos não revelados —</div>` : ''}

    <!-- Skills com custo_tipo -->
    ${skills.length ? `
      <div style="font-family:var(--fonte-d);font-size:0.55rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.08em;margin:12px 0 6px">Habilidades</div>
      ${skHtml}` : ''}

    <!-- Movimento restante (só em batalha) -->
    ${(function() {
      const bid = BATALHA_ATUAL_ID;
      if (!bid || !estaNoMapa) return '';
      const movRest = movGetRestante(bid, nome);
      const movMax  = movCalcVelocidade(nome);
      const cor2 = movRest > 0 ? '#f0cc6a' : '#e74c3c';
      return '<div style="margin-top:10px;padding:8px 10px;background:rgba(200,168,75,0.06);border:1px solid rgba(200,168,75,0.2);border-radius:8px;display:flex;justify-content:space-between;align-items:center"><span style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--suave);text-transform:uppercase">Movimento</span><span style="font-family:var(--fonte-d);font-size:0.82rem;color:' + cor2 + '">' + movRest + ' / ' + movMax + '</span></div>';
    })()}

    <!-- Piloto automático (só NPC, só mestre) -->
    ${(isMestre && isNpc && estaNoMapa) ? `
      <div style="margin-top:8px">
        <button onclick="npcTogglePiloto('${nome.replace(/'/g,"\'")}');fecharFichaNoMapa()"
          style="width:100%;padding:8px;background:${NPC_PILOTO[nome] ? 'rgba(176,126,240,0.15)' : 'rgba(30,45,66,0.5)'};border:1px solid ${NPC_PILOTO[nome] ? 'rgba(176,126,240,0.4)' : 'var(--borda)'};border-radius:8px;color:${NPC_PILOTO[nome] ? '#b07ef0' : 'var(--suave)'};font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;text-transform:uppercase">
          ${NPC_PILOTO[nome] ? '🤖 Piloto Ativo — Desativar' : '🎮 Controle Manual — Ativar Piloto'}
        </button>
        ${NPC_PILOTO[nome] ? '<button onclick="npcExecutarTurnoAuto(\'' + nome.replace(/'/g,"\\'") + '\');fecharFichaNoMapa()" style="width:100%;margin-top:5px;padding:8px;background:rgba(176,126,240,0.1);border:1px solid rgba(176,126,240,0.3);border-radius:8px;color:#b07ef0;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer">▶ Executar Turno Auto</button>' : ''}
      </div>` : ''}

    <!-- Botões contextuais por posição (só em batalha ativa) -->
    ${(function() {
      const mapId2 = MAPA_STATE?.mapaAtualId;
      if (!mapId2 || !estaNoMapa) return '';
      const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
      if (!bs || bs.fase !== 'combate') return '';
      const botoes = ctxGerarBotoes(nome, mapId2);
      if (!botoes.length) return '';
      const { visiveis, ocultos } = ctxPriorizar(botoes);
      const btnsHtml = visiveis.map(b =>
        '<button onclick="ctxExecutarAcao(' + JSON.stringify(b).replace(/'/g,"\'") + ');fecharFichaNoMapa()" ' +
        'style="flex:1;min-width:100px;padding:8px;background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.2);border-radius:7px;color:var(--primario-v);font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer;text-align:left">' +
        b.label + (b.sublabel ? '<br><span style=\'font-size:0.52rem;color:rgba(200,168,75,0.7)\'>' + b.sublabel + '</span>' : '') +
        '</button>'
      ).join('');
      return '<div style="margin-top:10px"><div style="font-family:var(--fonte-d);font-size:0.55rem;color:var(--suave);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Ações disponíveis</div><div style="display:flex;flex-wrap:wrap;gap:5px">' + btnsHtml + (ocultos.length ? '<button onclick="ctxMostrarOcultos(' + JSON.stringify(ocultos).replace(/'/g,"\'") + ')" style="padding:8px;background:rgba(30,45,66,0.5);border:1px dashed rgba(79,163,209,0.2);border-radius:7px;color:rgba(79,163,209,0.5);font-size:0.6rem;cursor:pointer">+' + ocultos.length + '</button>' : '') + '</div></div>';
    })()}
  `;
  // Preferir sidebar se disponível; senão overlay legado
  const _fichaConteudo = document.getElementById('modal-ficha-mapa-content').innerHTML;
  const _sidebarFicha = document.getElementById('ficha-sidebar-painel');
  if (_sidebarFicha) {
    _sidebarFicha.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
      '<div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--destaque);text-transform:uppercase;letter-spacing:.08em">👤 Ficha</div>' +
      '<button onclick="fecharFichaNoMapa()" style="background:none;border:none;color:var(--suave);font-size:1rem;cursor:pointer;line-height:1">✕</button>' +
      '</div>' + _fichaConteudo;
    _sidebarFicha.style.display = 'block';
  } else {
    document.getElementById('modal-ficha-mapa-overlay').style.display = 'flex';
  }
}

async function fichaToggleOcultarAtribs(nome) {
  const c = RPG_DATA.characters.find(x => x.nome === nome);
  if (!c || !c.custom_attrs) return;
  const novoEstado = document.getElementById('ficha-toggle-ocultar')?.checked ?? false;
  c.custom_attrs.ocultar_atributos = novoEstado;
  try {
    await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nome)}`,
      { method: 'PATCH', body: JSON.stringify({ custom_attrs: c.custom_attrs }) });
    mostrarToast(novoEstado ? '🔒 Atributos ocultos para jogadores' : '🔓 Atributos visíveis', '');
  } catch(e) { mostrarToast('Erro ao salvar', 'erro'); }
}

// ── ADICIONAR PERSONAGEM AO MAPA (mestre) ─────────────────────
function abrirModalAdicionarAoMapa() {
  if (RPG_DATA?.myRole !== 'mestre') return;
  if (!MAPA_STATE.mapaAtualId) { mostrarToast('Selecione um mapa primeiro', 'erro'); return; }
  const chars = RPG_DATA.characters || [];
  const mapId = MAPA_STATE.mapaAtualId;

  const lista = chars.map(c => {
    const ca = c.custom_attrs || {};
    const cor = ca.cor || '#7ec8f0';
    const estaNoMapa = c.active_map_id === mapId;
    const nomeEsc = c.nome.replace(/'/g, "\\'");
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(10,15,25,0.6);border:1px solid rgba(255,255,255,0.05);border-radius:7px;margin-bottom:5px">
      <div style="width:30px;height:30px;border-radius:50%;background:${cor}18;border:1.5px solid ${cor};display:flex;align-items:center;justify-content:center;font-size:0.85rem;flex-shrink:0">${c.nome[0]||'?'}</div>
      <div style="flex:1">
        <div style="font-family:var(--fonte-d);font-size:0.72rem;color:${cor}">${c.nome}</div>
        <div style="font-size:0.7rem;color:var(--suave)">${ca.tipo||'jogador'}${ca.classe?' · '+ca.classe:''}</div>
      </div>
      ${estaNoMapa
        ? `<span style="font-size:0.6rem;color:#5ee09a;font-family:var(--fonte-d)">✓ No mapa</span>
           <button onclick="document.getElementById('modal-addchar-overlay').style.display='none';removeCharFromMap('${nomeEsc}')" style="padding:4px 8px;background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.2);border-radius:5px;color:#c0392b;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer">✕</button>`
        : `<button onclick="document.getElementById('modal-addchar-overlay').style.display='none';mapaPosicionarChar('${nomeEsc}')" style="padding:4px 10px;background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:5px;color:var(--primario-v);font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer">📍 Colocar</button>`}
    </div>`;
  }).join('');

  const modal = document.getElementById('modal-addchar-overlay');
  document.getElementById('modal-addchar-lista').innerHTML = lista || '<div style="color:var(--suave);font-style:italic;font-size:0.85rem">Nenhum personagem</div>';
  modal.style.display = 'flex';
}

function mapaDesenharDistancia() {
  const med = MAPA_STATE.medicaoAtiva;
  if (!med || !med.pA || !med.pB) return;
  const mapas = RPG_DATA.mapas || [];
  const entry = mapas.find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
  const m = entry ? entry.mapa : {};
  const escala = m.escala_val || 1.5;
  const unit = m.escala_unit || 'm';
  const grid = m.grid || 20;

  const svg = document.getElementById('mapa-dist-svg');
  const wrap = document.getElementById('mapa-img');
  const W = wrap.offsetWidth, H = wrap.offsetHeight;
  const x1 = med.pA.x/100*W, y1 = med.pA.y/100*H;
  const x2 = med.pB.x/100*W, y2 = med.pB.y/100*H;
  const dist = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
  const celulas = dist / grid;
  const metros = (celulas * escala).toFixed(1);

  svg.innerHTML = `
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--primario)" stroke-width="2" stroke-dasharray="6 3" opacity="0.8"/>
    <circle cx="${x1}" cy="${y1}" r="4" fill="var(--primario)" opacity="0.8"/>
    <circle cx="${x2}" cy="${y2}" r="4" fill="var(--primario)" opacity="0.8"/>
    <rect x="${(x1+x2)/2-36}" y="${(y1+y2)/2-10}" width="72" height="20" rx="4" fill="rgba(15,21,32,0.9)" stroke="var(--primario)" stroke-width="1"/>
    <text x="${(x1+x2)/2}" y="${(y1+y2)/2+5}" text-anchor="middle" font-family="Cinzel,serif" font-size="9" fill="var(--primario-v)">${metros} ${unit}</text>
    <text x="${W-4}" y="14" text-anchor="end" font-family="Cinzel,serif" font-size="9" fill="var(--primario)" opacity="0.5" cursor="pointer" onclick="limparMedicaoMapa()">✕ Limpar</text>`;
}

function limparMedicaoMapa() {
  MAPA_STATE.medicaoAtiva = null;
  document.getElementById('mapa-dist-svg').innerHTML = '';
}

// ── NAVEGAÇÃO ENTRE MAPAS ─────────────────────────────────────
function entrarMapaLocal(mapaLocalId) {
  // Encontrar a zona que liga o pai a este mapa local
  const parentEntry = (RPG_DATA.mapas||[]).find(l =>
    (l.mapa.locais||[]).some(z => z.mapa_local_id === mapaLocalId));
  const zona = parentEntry?.mapa?.locais?.find(z => z.mapa_local_id === mapaLocalId);

  if (zona && parentEntry) {
    const parentId = parentEntry.mapa.map_id;
    const w = zona.zona_w_percent || zona.raio_percent || 8;
    const h = zona.zona_h_percent || (w * 0.75);

    // Auto-mover personagens que estão ativos no pai e dentro da zona
    (RPG_DATA.characters || []).forEach(async c => {
      if (c.active_map_id !== parentId) return;
      const pos = (c.map_positions || {})[parentId];
      if (!pos) return;
      const zonaX = zona.x ?? zona.x_percent ?? 0;
    const zonaY = zona.y ?? zona.y_percent ?? 0;
    const dx = pos.x - zonaX, dy = pos.y - zonaY;
      if (Math.abs(dx) <= w/2 && Math.abs(dy) <= h/2) {
        // Posição relativa dentro da zona → % no mapa local
        const lx = Math.max(5, Math.min(95, 50 + (dx / (w/2)) * 40));
        const ly = Math.max(5, Math.min(95, 50 + (dy / (h/2)) * 40));
        await setCharActiveMap(c.nome, mapaLocalId, parseFloat(lx.toFixed(1)), parseFloat(ly.toFixed(1)));
      }
    });
  }

  selecionarMapa(mapaLocalId);
}

function voltarMapaGeral() {
  if (MAPA_STATE.mapaGeralId) selecionarMapa(MAPA_STATE.mapaGeralId);
}

// ── CONFIG ────────────────────────────────────────────────────
function renderConfig(){
 // Opções de personagem para vínculo
 document.getElementById('cfg-opcoes').innerHTML=RPG_DATA.characters.map(c=>{
   const ca=c.custom_attrs||{};
   const cor=ca.cor||'var(--primario)';
   const imgC=normalizeImgUrl(ca.img||'');
   return`<div class="char-opcao${c.nome===CFG_CHAR?' selecionado':''}" onclick="selecionarOpcaoConfig('${c.nome}',this)">
     <div class="opcao-radio"><div class="opcao-dot"></div></div>
     ${imgC
       ? `<img src="${imgC}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid ${cor};flex-shrink:0" onerror="this.style.display='none'">`
       : `<div style="width:36px;height:36px;border-radius:50%;background:${cor}18;border:2px solid ${cor}44;display:flex;align-items:center;justify-content:center;font-size:1rem;color:${cor};flex-shrink:0">${c.nome[0]||'?'}</div>`}
     <div class="opcao-info">
       <div class="opcao-nome">${c.nome}</div>
       <div class="opcao-classe" style="color:${cor};font-size:0.7rem">${ca.tipo||'jogador'}</div>
     </div>
   </div>`;
 }).join('');
 renderDiceConfig();
 // Painel de membros e atributos (só para mestre)
 const isMestre = RPG_DATA.myRole === 'mestre';
 const membrosCard = document.getElementById('cfg-membros-card');
 if (membrosCard) membrosCard.style.display = isMestre ? '' : 'none';
 const attrdefCard = document.getElementById('cfg-attrdef-card');
 if (attrdefCard) attrdefCard.style.display = isMestre ? '' : 'none';
 if (isMestre) { renderCfgMembros(); renderCfgAttrDefs(); }
 // PvP card
 const pvpCard = document.getElementById('cfg-pvp-card');
 if (pvpCard) pvpCard.style.display = isMestre ? '' : 'none';
 const pvpToggle = document.getElementById('cfg-pvp-toggle');
 if (pvpToggle) pvpToggle.checked = !!(CURRENT_RPG?.theme?.pvp_ativo);
 const ffToggle = document.getElementById('cfg-ff-toggle');
 if (ffToggle) ffToggle.checked = !!(CURRENT_RPG?.theme?.fogo_amigo_ativo);
 // Moedas card — só mestre
 const moedasCard = document.getElementById('cfg-moedas-card');
 if (moedasCard) moedasCard.style.display = isMestre ? '' : 'none';
 if (isMestre && typeof cfgMoedasInit === 'function') cfgMoedasInit();
}

async function salvarPvpConfig(ativo) {
  const tema = { ...(CURRENT_RPG.theme || {}), pvp_ativo: ativo };
  await sb(`rpg_registry?rpg_id=eq.${encodeURIComponent(CURRENT_RPG.id)}`,
    { method: 'PATCH', body: JSON.stringify({ theme_json: tema }) }
  );
  CURRENT_RPG.theme = tema;
  mostrarToast(ativo ? 'PvP habilitado!' : 'PvP desabilitado', 'sucesso');
}

async function salvarFogoAmigoConfig(ativo) {
  const tema = { ...(CURRENT_RPG.theme || {}), fogo_amigo_ativo: ativo };
  await sb(`rpg_registry?rpg_id=eq.${encodeURIComponent(CURRENT_RPG.id)}`,
    { method: 'PATCH', body: JSON.stringify({ theme_json: tema }) }
  );
  CURRENT_RPG.theme = tema;
  mostrarToast(ativo ? '🔥 Fogo Amigo ativado!' : 'Fogo Amigo desativado', 'sucesso');
}

async function renderCfgMembros() {
 const el = document.getElementById('cfg-membros-lista');
 if (!el) return;
 try {
   const membros = await sb(`rpg_members?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&select=player_id,nickname,role,linked,permissoes&order=role.asc,nickname.asc`);
   const myId = SESSION?.user?.id;
   const isMestreLocal = RPG_DATA.myRole === 'mestre';
   el.innerHTML = (membros||[]).map(m => {
     const isSelf = m.player_id === myId;
     const isMestrem = m.role === 'mestre';
     const mEsc = (m.nickname||'').replace(/'/g,"\'");
     const corRole = isMestrem ? 'var(--destaque)' : 'var(--primario-v)';
     const personagem = m.linked;
     return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--painel);border:1px solid var(--borda);border-left:2px solid ${corRole};border-radius:6px;margin-bottom:4px">
       <div style="flex:1">
         <span style="font-family:var(--fonte-d);font-size:0.78rem;color:var(--texto)">${m.nickname||'—'}</span>
         ${isSelf ? '<span style="font-size:0.6rem;color:var(--suave);margin-left:6px">(você)</span>' : ''}
         ${personagem ? `<span style="margin-left:6px;font-size:0.68rem;color:var(--destaque)">⚔ ${personagem}</span>` : ''}
       </div>
       <span style="font-family:var(--fonte-d);font-size:0.6rem;color:${corRole};text-transform:uppercase">${m.role}</span>
       ${isSelf ? `<button onclick="abrirModalVincularPersonagem()"
         style="background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.2);border-radius:4px;color:var(--primario-v);font-size:0.6rem;padding:2px 8px;cursor:pointer;font-family:var(--fonte-d)">
         ${personagem ? '✏ Mudar' : '+ Vincular'}</button>` : ''}
       ${isMestreLocal && !isSelf && !isMestrem ? `<button onclick="abrirModalAtribuirPersonagem('${m.player_id}','${mEsc}')"
         style="background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.2);border-radius:4px;color:var(--primario-v);font-size:0.6rem;padding:2px 8px;cursor:pointer;font-family:var(--fonte-d)">${personagem ? '✏ Personagem' : '⚔ Atribuir'}</button>` : ''}
       ${isMestreLocal && !isSelf && !isMestrem ? `<button onclick="abrirModalPermissoes('${m.player_id}','${mEsc}')"
         style="background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.2);border-radius:4px;color:var(--destaque);font-size:0.6rem;padding:2px 8px;cursor:pointer;font-family:var(--fonte-d)">⚙ Perm</button>` : ''}
       ${isMestreLocal && !isSelf && !isMestrem ? `<button onclick="cfgRemoverMembro('${m.player_id}','${mEsc}')"
         style="background:none;border:none;color:#e74c3c66;cursor:pointer;font-size:0.8rem;padding:2px 6px">✕</button>` : ''}
     </div>`;
   }).join('') || '<div style="color:var(--suave);font-size:0.8rem;font-style:italic;padding:8px">Nenhum membro.</div>';
 } catch(e) { el.innerHTML = '<div style="color:var(--suave);font-size:0.8rem">Erro ao carregar membros.</div>'; }
}

// ── MESTRE: Atribuir personagem a jogador ────────────────────
function abrirModalAtribuirPersonagem(playerId, nickname) {
  const pcs = (RPG_DATA.characters||[]).filter(c => {
    const tipo = (c.custom_attrs||{}).tipo || 'jogador';
    return tipo === 'jogador';
  });
  const overlay = document.createElement('div');
  overlay.id = 'modal-atribuir-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML = `
    <div style="background:var(--painel);border:1px solid var(--borda);border-radius:12px;padding:24px;width:100%;max-width:360px;max-height:80vh;overflow-y:auto">
      <div style="font-family:var(--fonte-d);font-size:0.75rem;color:var(--destaque);text-transform:uppercase;margin-bottom:4px">⚔ Atribuir Personagem</div>
      <div style="font-size:0.8rem;color:var(--suave);margin-bottom:16px">Selecione o personagem de <strong style="color:var(--texto)">${nickname}</strong></div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">
        ${pcs.map(c => {
          const ca = c.custom_attrs || {};
          const cor = ca.cor || 'var(--primario)';
          const nomeEsc = c.nome.replace(/'/g,"\'");
          const imgUrl = normalizeImgUrl(ca.img || '');
          return `<button onclick="atribuirPersonagemAMembro('${playerId}','${nomeEsc}')"
            style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--fundo);border:1px solid ${cor}44;border-radius:8px;cursor:pointer;text-align:left;width:100%">
            <div style="width:32px;height:32px;border-radius:50%;border:1.5px solid ${cor};background:${cor}22;display:flex;align-items:center;justify-content:center;font-family:var(--fonte-d);font-size:0.7rem;color:${cor};flex-shrink:0;overflow:hidden">
              ${imgUrl ? `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : c.nome.slice(0,2).toUpperCase()}
            </div>
            <div style="text-align:left">
              <div style="font-family:var(--fonte-d);font-size:0.8rem;color:${cor}">${c.nome}</div>
              <div style="font-size:0.68rem;color:var(--suave)">${ca.classe||ca.tipo||''}</div>
            </div>
          </button>`;
        }).join('')}
        <button onclick="atribuirPersonagemAMembro('${playerId}', null)"
          style="padding:8px;background:transparent;border:1px dashed var(--borda);border-radius:8px;color:var(--suave);font-size:0.72rem;cursor:pointer;margin-top:4px">
          Remover vínculo
        </button>
      </div>
      <button onclick="document.getElementById('modal-atribuir-overlay').remove()"
        class="btn btn-secundario" style="width:100%">Cancelar</button>
    </div>
  `;
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

async function atribuirPersonagemAMembro(playerId, nomePersonagem) {
  try {
    await sb(
      `rpg_members?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&player_id=eq.${encodeURIComponent(playerId)}`,
      { method: 'PATCH', body: JSON.stringify({ linked: nomePersonagem }) }
    );
    document.getElementById('modal-atribuir-overlay')?.remove();
    mostrarToast(nomePersonagem ? `Personagem atribuído: ${nomePersonagem}` : 'Vínculo removido', 'sucesso');
    renderCfgMembros();
  } catch(e) { mostrarToast('Erro ao atribuir personagem', 'erro'); }
}

async function cfgAdicionarMembro() {
  const input = document.getElementById('cfg-novo-nickname').value.trim().toLowerCase();
  if (!input) return;
  try {
    let jogador = null;
    if (input.includes('@')) {
      const resultado = await sb(`players_with_email?email=eq.${encodeURIComponent(input)}&select=id,nickname,nome_real`);
      jogador = resultado?.[0] || null;
    } else {
      const resultado = await sb(`players?nickname=eq.${encodeURIComponent(input)}&select=id,nickname,nome_real`);
      jogador = resultado?.[0] || null;
    }
    if (!jogador) { mostrarToast(`Jogador "${input}" não encontrado`, 'erro'); return; }
    const jaExiste = await sb(`rpg_members?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&player_id=eq.${jogador.id}`);
    if (jaExiste?.length) { mostrarToast(`${jogador.nickname} já é membro`, 'erro'); return; }
    await sb('rpg_members', {
      method: 'POST',
      body: JSON.stringify({ rpg_id: RPG_DATA.rpgId, player_id: jogador.id, nickname: jogador.nickname, role: 'jogador', permissoes: {} })
    });
    document.getElementById('cfg-novo-nickname').value = '';
    mostrarToast(`${jogador.nickname} adicionado!`, 'sucesso');
    renderCfgMembros();
  } catch(e) { mostrarToast('Erro ao adicionar membro', 'erro'); }
}

// ── PERMISSÕES DE JOGADOR ─────────────────────────────────────
const PERMISSOES_CONFIG = [
  { key: 'editar_lore',      label: 'Editar Lore',                padrao: false },
  { key: 'editar_tabelas',   label: 'Editar Tabelas',              padrao: false },
  { key: 'editar_npcs',      label: 'Editar NPCs na Mesa',       padrao: false },
  { key: 'criar_personagem', label: 'Criar Personagens / NPCs',    padrao: false },
  { key: 'pvp_ativo',        label: 'Participar de PvP',           padrao: true  },
  { key: 'ataque_criativo',  label: 'Usar Ataques Criativos',      padrao: true  },
];

async function abrirModalPermissoes(playerId, nickname) {
  const membro = (await sb(
    `rpg_members?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&player_id=eq.${encodeURIComponent(playerId)}&select=permissoes`
  ))?.[0];
  const perm = membro?.permissoes || {};
  const overlay = document.createElement('div');
  overlay.id = 'modal-permissoes-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML = `
    <div style="background:var(--painel);border:1px solid var(--borda);border-radius:12px;padding:24px;width:100%;max-width:380px">
      <div style="font-family:var(--fonte-d);font-size:0.75rem;color:var(--destaque);text-transform:uppercase;margin-bottom:4px">⚙ Permissões</div>
      <div style="font-size:0.8rem;color:var(--suave);margin-bottom:16px">${nickname}</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
        ${PERMISSOES_CONFIG.map(p => {
          const ativo = perm[p.key] !== undefined ? perm[p.key] : p.padrao;
          return `<label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 10px;background:var(--escuro);border:1px solid var(--borda);border-radius:6px">
            <input type="checkbox" id="perm-${p.key}" ${ativo?'checked':''} style="width:16px;height:16px;accent-color:var(--destaque)">
            <span style="font-size:0.85rem">${p.label}</span>
          </label>`;
        }).join('')}
      </div>
      <button onclick="salvarPermissoes('${playerId}')" class="btn btn-primario" style="width:100%;margin-bottom:8px">Salvar Permissões</button>
      <button onclick="document.getElementById('modal-permissoes-overlay').remove()" class="btn btn-secundario" style="width:100%">Cancelar</button>
    </div>
  `;
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

async function salvarPermissoes(playerId) {
  const novas = {};
  PERMISSOES_CONFIG.forEach(p => {
    novas[p.key] = document.getElementById('perm-' + p.key)?.checked ?? p.padrao;
  });
  await sb(
    `rpg_members?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&player_id=eq.${encodeURIComponent(playerId)}`,
    { method: 'PATCH', body: JSON.stringify({ permissoes: novas }) }
  );
  document.getElementById('modal-permissoes-overlay')?.remove();
  mostrarToast('Permissões salvas!', 'sucesso');
  renderCfgMembros();
}

async function cfgRemoverMembro(playerId, nickname) {
 if (!confirm(`Remover ${nickname} da campanha?`)) return;
 await sb(`rpg_members?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&player_id=eq.${encodeURIComponent(playerId)}`, { method: 'DELETE' });
 mostrarToast(`${nickname} removido`, 'sucesso');
 renderCfgMembros();
}

// ── 16H: Modal vínculo jogador ↔ personagem ──────────────────
function abrirModalVincularPersonagem() {
  const pcs = (RPG_DATA.characters||[]).filter(c => {
    const tipo = (c.custom_attrs||{}).tipo_personagem || 'jogador';
    return tipo !== 'npc';
  });
  const overlay = document.createElement('div');
  overlay.id = 'modal-vincular-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML = `
    <div style="background:var(--painel);border:1px solid var(--borda);border-radius:12px;padding:24px;width:100%;max-width:360px;max-height:80vh;overflow-y:auto">
      <div style="font-family:var(--fonte-d);font-size:0.75rem;color:var(--destaque);text-transform:uppercase;margin-bottom:16px">⚔ Vincular Personagem</div>
      <p style="font-size:0.82rem;color:var(--suave);margin-bottom:14px;line-height:1.5">
        Escolha seu personagem nesta campanha. Ele será o padrão nas abas de personagem.
      </p>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">
        ${pcs.map(c => {
          const ca = c.custom_attrs || {};
          const cor = ca.cor || 'var(--primario)';
          const nomeEsc = c.nome.replace(/'/g,"\'");
          const imgUrl = normalizeImgUrl(ca.img || '');
          return `<button onclick="vincularPersonagem('${nomeEsc}')"
            style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--fundo);border:1px solid ${cor}44;border-radius:8px;cursor:pointer;text-align:left;width:100%">
            <div style="width:32px;height:32px;border-radius:50%;border:1.5px solid ${cor};background:${cor}22;display:flex;align-items:center;justify-content:center;font-family:var(--fonte-d);font-size:0.7rem;color:${cor};flex-shrink:0;overflow:hidden">
              ${imgUrl ? `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : c.nome.slice(0,2).toUpperCase()}
            </div>
            <div style="text-align:left">
              <div style="font-family:var(--fonte-d);font-size:0.8rem;color:${cor}">${c.nome}</div>
              <div style="font-size:0.68rem;color:var(--suave)">${ca.classe||''}</div>
            </div>
          </button>`;
        }).join('')}
        <button onclick="vincularPersonagem(null)"
          style="padding:8px;background:transparent;border:1px dashed var(--borda);border-radius:8px;color:var(--suave);font-size:0.72rem;cursor:pointer;margin-top:4px">
          Desvincular
        </button>
      </div>
      <button onclick="document.getElementById('modal-vincular-overlay').remove()"
        class="btn btn-secundario" style="width:100%">Cancelar</button>
    </div>
  `;
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

async function vincularPersonagem(nomePersonagem) {
  if (!SESSION?.user?.id) return;
  try {
    await sb(
      `rpg_members?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&player_id=eq.${encodeURIComponent(SESSION.user.id)}`,
      { method: 'PATCH', body: JSON.stringify({ linked: nomePersonagem }) }
    );
    RPG_DATA.linked = nomePersonagem;
    document.getElementById('modal-vincular-overlay')?.remove();
    mostrarToast(nomePersonagem ? `Vinculado a ${nomePersonagem}!` : 'Vínculo removido', 'sucesso');
    if (nomePersonagem) {
      CHAR_VIEW = nomePersonagem; ATTR_VIEW = nomePersonagem; CFG_CHAR = nomePersonagem;
      renderCharButtons(); renderAttrButtons(); renderHeader();
      renderCharView(nomePersonagem); renderAttrView(nomePersonagem);
    }
    renderConfig();
    renderCfgMembros();
  } catch(e) { mostrarToast('Erro ao vincular personagem', 'erro'); }
}


// ── CRUD: ATTR_DEFS ───────────────────────────────────────────
function renderCfgAttrDefs() {
 const el = document.getElementById('cfg-attrdef-lista');
 if (!el) return;
 const defs = RPG_DATA.attrDefs || [];
 if (!defs.length) {
   el.innerHTML = '<div style="color:var(--suave);font-size:0.8rem;font-style:italic;padding:8px">Nenhum atributo definido.</div>';
   return;
 }
 el.innerHTML = defs.sort((a,b) => (a.ordem||0) - (b.ordem||0)).map(a => {
   const tipoLabel = {number:'Número', text:'Texto', boolean:'Sim/Não', select:'Seleção'}[a.tipo] || a.tipo;
   const aIdSafe = String(a.id).replace(/'/g, "\\'");
   return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--borda)">
     <div style="flex:1">
       <span style="font-family:var(--fonte-d);font-size:0.78rem;color:var(--texto)">${a.nome}</span>
       <span style="margin-left:8px;font-size:0.65rem;color:var(--suave)">[${tipoLabel}]</span>
       <span style="margin-left:6px;font-size:0.6rem;padding:1px 6px;border-radius:10px;${{'especial':'background:rgba(123,47,190,0.15);color:#b07ef0','status':'background:rgba(79,163,209,0.15);color:#4fa3d1','resistencia':'background:rgba(232,160,32,0.15);color:#e8a020'}[a.categoria]||'background:rgba(79,163,209,0.12);color:var(--primario-v)'}">${{'especial':'✨ Especial','status':'📊 Status','resistencia':'🛡 Resistência'}[a.categoria]||'🔷 Básico'}</span>
       ${a.categoria==='resistencia'&&a.opcoes?`<span style="margin-left:4px;font-size:0.6rem;color:#e8a020;font-style:italic">${(()=>{try{const c=JSON.parse(a.opcoes);return c.tipo==='armadura'?'Armadura':`vs ${c.damage_type||'?'}${c.modo==='absoluto'?' (abs)':' (%)'}`;}catch(e){return '';}})()}</span>`:''}
       ${a.categoria==='status'&&a.opcoes?`<span style="margin-left:4px;font-size:0.6rem;color:#4fa3d1;font-style:italic">${(()=>{try{const c=JSON.parse(a.opcoes);return c.max_attr?`base:${c.max_base||0}+${c.max_attr}×${c.max_mult||0}`:'';}catch(e){return '';}})()}</span>`:''}
     </div>
     <span style="font-size:0.62rem;color:var(--suave);min-width:24px;text-align:center">#${a.ordem||0}</span>
     <button onclick="abrirModalAttrDef('${aIdSafe}')" style="background:none;border:none;color:var(--suave);cursor:pointer;font-size:0.85rem;padding:2px 5px" title="Editar">✏️</button>
   </div>`;
 }).join('');
}

function abrirModalAttrDef(id) {
 const overlay = document.getElementById('modal-attrdef-overlay');
 const tituloEl = document.getElementById('modal-attrdef-titulo');
 const btnRemover = document.getElementById('ad-btn-remover');
 if (id) {
   const def = (RPG_DATA.attrDefs || []).find(a => a.id === id);
   if (!def) return;
   document.getElementById('ad-id').value = id;
   document.getElementById('ad-nome').value = def.nome;
   document.getElementById('ad-tipo').value = def.tipo;
   document.getElementById('ad-categoria').value = def.categoria || 'basico';
   document.getElementById('ad-ordem').value = def.ordem || 1;
   // Restore category-specific opcoes fields
   const cat = def.categoria || 'basico';
   if (cat === 'resistencia') {
     document.getElementById('ad-resistencia-json').value = def.opcoes || '';
     document.getElementById('ad-opcoes').value = '';
     _adStatusJsonToForm('');
   } else if (cat === 'status') {
     _adStatusJsonToForm(def.opcoes || '');
     document.getElementById('ad-opcoes').value = '';
     document.getElementById('ad-resistencia-json').value = '';
   } else {
     document.getElementById('ad-opcoes').value = def.opcoes || '';
     document.getElementById('ad-resistencia-json').value = '';
     _adStatusJsonToForm('');
   }
   tituloEl.textContent = 'Editar Atributo';
   btnRemover.style.display = '';
 } else {
   document.getElementById('ad-id').value = '';
   document.getElementById('ad-nome').value = '';
   document.getElementById('ad-tipo').value = 'number';
   document.getElementById('ad-categoria').value = 'basico';
   document.getElementById('ad-opcoes').value = '';
   document.getElementById('ad-ordem').value = (RPG_DATA.attrDefs || []).length + 1;
   tituloEl.textContent = 'Novo Atributo';
   btnRemover.style.display = 'none';
 }
 attrDefTipoChange();
 overlay.style.display = 'flex';
}

function fecharModalAttrDef() {
 document.getElementById('modal-attrdef-overlay').style.display = 'none';
}

function attrDefTipoChange() {
 const tipo = document.getElementById('ad-tipo').value;
 const cat = document.getElementById('ad-categoria').value;
 document.getElementById('ad-opcoes-group').style.display = (tipo === 'select' && cat !== 'resistencia' && cat !== 'status') ? '' : 'none';
 attrDefCategoriaChange();
}

function attrDefCategoriaChange() {
 const cat = document.getElementById('ad-categoria').value;
 const tipo = document.getElementById('ad-tipo').value;
 document.getElementById('ad-resistencia-group').style.display = cat === 'resistencia' ? '' : 'none';
 document.getElementById('ad-status-group').style.display = cat === 'status' ? '' : 'none';
 document.getElementById('ad-opcoes-group').style.display = (tipo === 'select' && cat !== 'resistencia' && cat !== 'status') ? '' : 'none';
 // Populate the status attribute dropdown
 if (cat === 'status') {
   const sel = document.getElementById('ad-status-attr');
   if (sel) {
     const defs = RPG_DATA?.attrDefs || [];
     const cur = sel.value;
     sel.innerHTML = '<option value="">— Nenhum (pool fixo manual) —</option>' +
       defs.filter(d => d.tipo === 'number').map(d =>
         `<option value="${d.nome}">${d.nome}</option>`
       ).join('');
     if (cur) sel.value = cur;
   }
 }
}

// ── Status attr form helpers ──────────────────────────────────
function _adStatusJsonToForm(jsonStr) {
  let base = '', mult = '', attr = '';
  if (jsonStr) {
    try {
      const obj = JSON.parse(jsonStr);
      base = obj.max_base != null ? String(obj.max_base) : '';
      mult = obj.max_mult != null ? String(obj.max_mult) : '';
      attr = obj.max_attr || '';
    } catch(e) {}
  }
  const baseEl = document.getElementById('ad-status-base');
  const multEl = document.getElementById('ad-status-mult');
  if (baseEl) baseEl.value = base;
  if (multEl) multEl.value = mult;
  // Set attr after dropdown is populated (setTimeout ensures dropdown exists)
  setTimeout(() => {
    const attrEl = document.getElementById('ad-status-attr');
    if (attrEl && attr) attrEl.value = attr;
  }, 30);
}

function _adStatusFormToJson() {
  const base = parseFloat(document.getElementById('ad-status-base')?.value) || 0;
  const mult = parseFloat(document.getElementById('ad-status-mult')?.value) || 0;
  const attr = (document.getElementById('ad-status-attr')?.value || '').trim();
  const obj = { max_base: base };
  if (attr) { obj.max_attr = attr; obj.max_mult = mult; }
  // Return null if all defaults (no formula configured)
  if (!base && !attr) return null;
  return JSON.stringify(obj);
}

async function salvarAttrDef() {
 const id = document.getElementById('ad-id').value;
 const nome = (document.getElementById('ad-nome').value || '').trim();
 const tipo = document.getElementById('ad-tipo').value;
 const categoria = document.getElementById('ad-categoria').value || 'basico';
 const ordem = parseInt(document.getElementById('ad-ordem').value) || 1;
 // Collect opcoes from the right field based on categoria
 let opcoes;
 if (categoria === 'resistencia') {
   opcoes = (document.getElementById('ad-resistencia-json').value || '').trim() || null;
   if (opcoes) { try { JSON.parse(opcoes); } catch(e) { mostrarToast('JSON de resistência inválido', 'erro'); return; } }
 } else if (categoria === 'status') {
   opcoes = _adStatusFormToJson();
 } else {
   opcoes = (document.getElementById('ad-opcoes').value || '').trim() || null;
 }
 if (!nome) { mostrarToast('Nome do atributo é obrigatório', 'erro'); return; }
 try {
   if (id) {
     // Editar
     await sb(`attr_defs?id=eq.${encodeURIComponent(id)}`, {
       method: 'PATCH',
       body: JSON.stringify({ nome, tipo, opcoes, ordem, categoria })
     });
     const idx = (RPG_DATA.attrDefs || []).findIndex(a => a.id === id);
     if (idx >= 0) RPG_DATA.attrDefs[idx] = { ...RPG_DATA.attrDefs[idx], nome, tipo, opcoes, ordem, categoria };
     mostrarToast('Atributo atualizado!', 'sucesso');
   } else {
     // Criar
     const res = await sb('attr_defs', {
       method: 'POST',
       body: JSON.stringify({ rpg_id: RPG_DATA.rpgId, nome, tipo, opcoes, ordem, categoria })
     });
     if (res && res[0]) RPG_DATA.attrDefs.push(res[0]);
     else RPG_DATA.attrDefs.push({ id: null, rpg_id: RPG_DATA.rpgId, nome, tipo, opcoes, ordem, categoria });
     mostrarToast('Atributo criado!', 'sucesso');
   }
   fecharModalAttrDef();
   renderCfgAttrDefs();
   // Recarregar views de atributos para refletir mudança
   if (ATTR_VIEW) renderAttrView(ATTR_VIEW);
   if (CHAR_VIEW) renderCharView(CHAR_VIEW);
 } catch(e) { mostrarToast('Erro ao salvar atributo', 'erro'); }
}

function removerAttrDefModal() {
 const id = document.getElementById('ad-id').value;
 const nome = (document.getElementById('ad-nome').value || '').trim();
 if (!id) return;
 if (!confirm(`Remover o atributo "${nome}"?\nEle será apagado da definição da campanha. Os valores já salvos nos personagens NÃO são deletados automaticamente.`)) return;
 removerAttrDef(id, nome);
}

async function removerAttrDef(id, nome) {
 try {
   await sb(`attr_defs?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
   RPG_DATA.attrDefs = (RPG_DATA.attrDefs || []).filter(a => a.id !== id);
   mostrarToast(`"${nome}" removido`, 'sucesso');
   fecharModalAttrDef();
   renderCfgAttrDefs();
   if (ATTR_VIEW) renderAttrView(ATTR_VIEW);
   if (CHAR_VIEW) renderCharView(CHAR_VIEW);
 } catch(e) { mostrarToast('Erro ao remover atributo', 'erro'); }
}
function selecionarOpcaoConfig(nome,el){CFG_CHAR=nome;document.querySelectorAll('.char-opcao').forEach(o=>o.classList.remove('selecionado'));el.classList.add('selecionado');}
async function salvarConfig(){if(!CFG_CHAR){mostrarToast('Selecione um personagem','erro');return;}try{await saveMemberLinked(RPG_DATA.rpgId,CFG_CHAR);RPG_DATA.linked=CFG_CHAR;renderHeader();mostrarToast('Vínculo salvo!','sucesso');}catch(e){mostrarToast('Erro ao salvar','erro');}}
async function confirmarDeleteRPG(){if(!CURRENT_RPG||CURRENT_RPG.id==='dual'){mostrarToast('DUAL não pode ser deletado','erro');return;}if(!confirm(`Deletar "${CURRENT_RPG.name}"?`))return;try{await deleteRPGData(CURRENT_RPG.id);mostrarToast('RPG deletado','sucesso');HUB_DATA.rpgs=HUB_DATA.rpgs.filter(r=>r.rpg_id!==CURRENT_RPG.id);setTimeout(voltarHub,800);}catch(e){mostrarToast(e.message||'Erro','erro');}}
