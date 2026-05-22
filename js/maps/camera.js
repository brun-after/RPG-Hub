// maps/camera.js
// RPG Hub — Visual effects system (3-layer effects, zones, dead tokens) and map initialization
// Includes: Phase 7 visual effects: _injetarCssEfeitos(), zonasPulso(), tokenMorto()

// ════════════════════════════════════════════════════════════════════════════
// FASE 7 — EXPERIÊNCIA VISUAL
// ════════════════════════════════════════════════════════════════════════════

// ── 7.1 Efeitos em 3 camadas ──────────────────────────────────────────────
(function _injetarCssEfeitos() {
  const s = document.createElement('style');
  s.id = 'css-efeitos-3camadas';
  s.textContent = [
    '.anim-intencao-fisico{animation:intencaoFisico 150ms ease-out forwards}',
    '.anim-intencao-fogo{animation:intencaoFogo 150ms ease-out forwards}',
    '.anim-intencao-gelo{animation:intencaoGelo 150ms ease-out forwards}',
    '.anim-intencao-veneno{animation:intencaoVeneno 150ms ease-out forwards}',
    '.anim-intencao-magico{animation:intencaoMagico 150ms ease-out forwards}',
    '.anim-intencao-cura{animation:intencaoCura 150ms ease-out forwards}',
    '@keyframes intencaoFisico{0%,100%{filter:none}60%{filter:drop-shadow(0 0 12px rgba(231,76,60,0.9))}}',
    '@keyframes intencaoFogo{0%,100%{filter:none}60%{filter:drop-shadow(0 0 12px rgba(230,126,34,0.9))}}',
    '@keyframes intencaoGelo{0%,100%{filter:none}60%{filter:drop-shadow(0 0 12px rgba(127,205,245,0.9))}}',
    '@keyframes intencaoVeneno{0%,100%{filter:none}60%{filter:drop-shadow(0 0 12px rgba(39,174,96,0.9))}}',
    '@keyframes intencaoMagico{0%,100%{filter:none}60%{filter:drop-shadow(0 0 12px rgba(155,89,182,0.9))}}',
    '@keyframes intencaoCura{0%,100%{filter:none}60%{filter:drop-shadow(0 0 14px rgba(94,224,154,0.9))}}',
    '.anim-impacto-fisico{animation:shakeToken 300ms ease-out,flashVermelho 200ms ease-out}',
    '.anim-impacto-fogo{animation:shakeToken 300ms ease-out,flashLaranja 200ms ease-out}',
    '.anim-impacto-gelo{animation:shakeToken 200ms ease-out,flashAzul 200ms ease-out}',
    '.anim-impacto-veneno{animation:shakeToken 200ms ease-out,flashVerde 200ms ease-out}',
    '.anim-impacto-magico{animation:shakeToken 300ms ease-out,flashRoxo 200ms ease-out}',
    '.anim-impacto-cura{animation:pulsoCura 400ms ease-out}',
    '@keyframes shakeToken{0%{transform:translate(-50%,-50%)}20%{transform:translate(-46%,-50%)}40%{transform:translate(-54%,-50%)}60%{transform:translate(-47%,-50%)}80%{transform:translate(-52%,-50%)}100%{transform:translate(-50%,-50%)}}',
    '@keyframes flashVermelho{0%,100%{background-color:transparent}50%{background-color:rgba(231,76,60,0.45)}}',
    '@keyframes flashLaranja{0%,100%{background-color:transparent}50%{background-color:rgba(230,126,34,0.45)}}',
    '@keyframes flashAzul{0%,100%{background-color:transparent}50%{background-color:rgba(127,205,245,0.45)}}',
    '@keyframes flashVerde{0%,100%{background-color:transparent}50%{background-color:rgba(39,174,96,0.45)}}',
    '@keyframes flashRoxo{0%,100%{background-color:transparent}50%{background-color:rgba(155,89,182,0.45)}}',
    '@keyframes pulsoCura{0%{box-shadow:0 0 0 0 rgba(94,224,154,0.7)}70%{box-shadow:0 0 0 12px rgba(94,224,154,0)}100%{box-shadow:none}}',
    '.numero-flutuante{position:absolute;z-index:100;pointer-events:none;font-family:var(--fonte-d,"Cinzel",serif);font-weight:700;animation:subirSome 900ms ease-out forwards;transform:translateX(-50%);text-shadow:0 1px 4px rgba(0,0,0,0.9)}',
    '.numero-flutuante.dano{font-size:1.1rem;color:#e74c3c}',
    '.numero-flutuante.cura{font-size:1rem;color:#5ee09a}',
    '.numero-flutuante.critico{font-size:1.5rem;color:#f0cc6a;animation:subirSomeCritico 1s ease-out forwards}',
    '.numero-flutuante.errou{font-size:0.85rem;color:rgba(122,146,170,0.8)}',
    '@keyframes subirSome{0%{opacity:1;top:0}100%{opacity:0;top:-40px}}',
    '@keyframes subirSomeCritico{0%{opacity:1;top:0;transform:translateX(-50%) scale(1)}20%{transform:translateX(-50%) scale(1.3)}100%{opacity:0;top:-55px;transform:translateX(-50%) scale(1)}}',
    '.particula-impacto{position:absolute;pointer-events:none;border-radius:50%;z-index:99;animation:dispersarParticula 400ms ease-out forwards}',
    '@keyframes dispersarParticula{0%{opacity:0.9;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(var(--px),var(--py)) scale(0.2)}}',
  ].join('');
  document.head.appendChild(s);
})();

const _TIPO_ANIM_CLASS = { fisico:'fisico', fogo:'fogo', gelo:'gelo', veneno:'veneno', magico:'magico', psiquico:'magico', cura:'cura', outro:'fisico' };

function animarAtaque3Camadas(atacanteNome, alvoNome, dano, tipoDano, ehCritico, ehCura) {
  const tipoClass = _TIPO_ANIM_CLASS[tipoDano]||'fisico';
  const atacEl = document.querySelector('.mapa-token[data-nome="'+CSS.escape(atacanteNome)+'"]');
  const alvoEl = document.querySelector('.mapa-token[data-nome="'+CSS.escape(alvoNome)+'"]');
  if (atacEl) { const c=atacEl.querySelector('.mapa-token-circle')||atacEl; c.classList.add('anim-intencao-'+tipoClass); setTimeout(()=>c.classList.remove('anim-intencao-'+tipoClass),200); }
  setTimeout(() => {
    if (!alvoEl) return;
    const c=alvoEl.querySelector('.mapa-token-circle')||alvoEl;
    c.classList.add('anim-impacto-'+tipoClass); setTimeout(()=>c.classList.remove('anim-impacto-'+tipoClass),400);
    _dispararParticulasToken(alvoEl, tipoClass);
  }, 200);
  setTimeout(() => {
    if (!alvoEl) return;
    const rect=alvoEl.getBoundingClientRect(), mapaImg=document.getElementById('mapa-img'), mapaRect=mapaImg?.getBoundingClientRect();
    if (!mapaRect) return;
    const num=document.createElement('div');
    num.className='numero-flutuante'+(ehCura?' cura':ehCritico?' critico':dano===0||dano===null?' errou':' dano');
    num.style.cssText='left:'+(rect.left-mapaRect.left+rect.width/2)+'px;top:'+(rect.top-mapaRect.top-10)+'px';
    num.textContent = ehCura ? '+'+dano : (dano===0||dano===null ? 'ERROU' : '-'+dano);
    mapaImg.style.position='relative'; mapaImg.appendChild(num); setTimeout(()=>num.remove(),1000);
  }, 300);
}

function _dispararParticulasToken(tokenEl, tipoClass) {
  const rect=tokenEl.getBoundingClientRect(), mapaImg=document.getElementById('mapa-img'), mapaRect=mapaImg?.getBoundingClientRect();
  if (!mapaRect) return;
  const corMap={fisico:'#e74c3c',fogo:'#e67e22',gelo:'#7fd3f5',veneno:'#27ae60',magico:'#9b59b6',cura:'#5ee09a'};
  const cor=corMap[tipoClass]||'#e74c3c', cx=rect.left-mapaRect.left+rect.width/2, cy=rect.top-mapaRect.top+rect.height/2;
  for (let i=0;i<8;i++) {
    const ang=(Math.PI*2*i/8)+(Math.random()-0.5)*0.5, dist=20+Math.random()*30;
    const p=document.createElement('div'); p.className='particula-impacto';
    p.style.cssText='left:'+cx+'px;top:'+cy+'px;width:5px;height:5px;background:'+cor+';--px:'+(Math.cos(ang)*dist)+'px;--py:'+(Math.sin(ang)*dist)+'px';
    mapaImg.appendChild(p); setTimeout(()=>p.remove(),450);
  }
}

window.animarAtaque3Camadas = animarAtaque3Camadas;
HUB_EVENTS.on('dano_aplicado', ({ atacante, alvo, valor, tipo }) => { animarAtaque3Camadas(atacante, alvo, valor, tipo, window._ultimoCritico===alvo, false); });
HUB_EVENTS.on('cura_aplicada', ({ origem, alvo, valor })          => { animarAtaque3Camadas(origem, alvo, valor, 'cura', false, true); });

// ── 7.2 Zonas com pulso visual ────────────────────────────────────────────
(function _injetarCssZonas() {
  const s=document.createElement('style'); s.id='css-zonas-pulso';
  s.textContent = '.zona-pulso-interesse{animation:zonaInteresse 2s ease-in-out infinite}.zona-pulso-perigo{animation:zonaPerigo 1.5s ease-in-out infinite}.zona-pulso-saida{animation:zonaSaida 2.5s ease-in-out infinite}.zona-pulso-bau_grupo{animation:zonaBau 2s ease-in-out infinite}.zona-pulso-passagem{animation:zonaPassagem 3s ease-in-out infinite}@keyframes zonaInteresse{0%,100%{box-shadow:0 0 0 0 rgba(200,168,75,0.4)}60%{box-shadow:0 0 0 8px rgba(200,168,75,0)}}@keyframes zonaPerigo{0%,100%{box-shadow:0 0 0 0 rgba(231,76,60,0.5)}50%{box-shadow:0 0 0 10px rgba(231,76,60,0)}}@keyframes zonaSaida{0%,100%{box-shadow:0 0 0 0 rgba(79,163,209,0.4)}70%{box-shadow:0 0 0 8px rgba(79,163,209,0)}}@keyframes zonaBau{0%,100%{box-shadow:0 0 0 0 rgba(94,224,154,0.35)}60%{box-shadow:0 0 0 8px rgba(94,224,154,0)}}@keyframes zonaPassagem{0%,100%{box-shadow:0 0 0 0 rgba(126,200,240,0.3)}70%{box-shadow:0 0 0 6px rgba(126,200,240,0)}}';
  document.head.appendChild(s);
})();

const _origMRTokens7 = window.mapaRenderTokens;
window.mapaRenderTokens = function(m) {
  _origMRTokens7(m); _aplicarPulsoZonas(m); _verificarProximidadeZonas(m); _aplicarIconesLootTokens();
};

function _aplicarPulsoZonas(m) {
  if (!m?.locais?.length) return;
  const zonaEls = document.querySelectorAll('.mapa-zona');
  zonaEls.forEach(el => el.classList.remove('zona-pulso-interesse','zona-pulso-perigo','zona-pulso-saida','zona-pulso-bau_grupo','zona-pulso-passagem'));
  m.locais.forEach((zona, i) => { const tipo=zona.zona_tipo||'interesse'; const el=zonaEls[i]; if(el) el.classList.add('zona-pulso-'+tipo); });
}

function _verificarProximidadeZonas(m) {
  const mapId = MAPA_STATE?.mapaAtualId;
  if (!mapId||!m?.locais?.length) return;
  const jogadores = (RPG_DATA?.characters||[]).filter(c => { const ca=c.custom_attrs||{}; return c.active_map_id===mapId&&ca.tipo_personagem!=='npc'&&ca.tipo!=='npc'; });
  const W=m.largura_total||20, H=m.altura_total||20;
  m.locais.forEach(zona => {
    if (zona._visitada) return;
    const zC=Math.round(((zona.x??zona.x_percent??0)/100)*W), zR=Math.round(((zona.y??zona.y_percent??0)/100)*H);
    for (const jog of jogadores) {
      const pos=getPosicaoNoMapa(jog,mapId); if(!pos) continue;
      if (Math.max(Math.abs((pos.col??0)-zC),Math.abs((pos.row??0)-zR))<=2) {
        if (!zona._feedEmitido) { zona._feedEmitido=true; feedAdicionarEntrada(jog.nome+' está perto de "'+(zona.nome||'zona')+'"','cena'); }
        break;
      }
    }
  });
}

// ── 7.3 Token morto com ícone de loot ─────────────────────────────────────
function _aplicarIconesLootTokens() {
  (RPG_DATA?.characters||[]).forEach(c => {
    const ca=c.custom_attrs||{}; if(!ca.morto||!ca.tem_loot) return;
    const tokenEl=document.querySelector('.mapa-token[data-nome="'+CSS.escape(c.nome)+'"]'); if(!tokenEl||tokenEl.querySelector('.loot-badge-v2')) return;
    const badge=document.createElement('div'); badge.className='loot-badge-v2';
    badge.style.cssText='position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:rgba(200,168,75,0.95);border-radius:8px;padding:2px 6px;font-size:0.55rem;color:#050810;font-family:var(--fonte-d);z-index:20;pointer-events:none;white-space:nowrap;border:1px solid rgba(240,204,106,0.8);animation:lootPiscar 1.5s ease-in-out infinite';
    badge.textContent='💰 Loot'; tokenEl.appendChild(badge);
  });
}
(function(){ const s=document.createElement('style'); s.textContent='@keyframes lootPiscar{0%,100%{opacity:1}50%{opacity:0.6}}'; document.head.appendChild(s); })();

// ── 7.4 Aviso mapa iso legado ────────────────────────────────────────────
function _verificarMapaIsoLegado(m) {
  if (!m) return;
  const bannerId='banner-iso-legado';
  if (m.transform3d?.depth||m.render_data?.transform3d?.depth) {
    if (!document.getElementById(bannerId)) {
      const b=document.createElement('div'); b.id=bannerId;
      b.style.cssText='position:absolute;top:40px;left:50%;transform:translateX(-50%);z-index:25;background:rgba(200,168,75,0.12);border:1px solid rgba(200,168,75,0.4);border-radius:8px;padding:6px 14px;font-size:0.7rem;color:#f0cc6a;pointer-events:none;white-space:nowrap';
      b.textContent='⚠ Mapa isométrico legado — posições dos tokens podem estar incorretas';
      document.getElementById('mapa-tokens')?.appendChild(b);
    }
  } else { document.getElementById(bannerId)?.remove(); }
}
HUB_EVENTS.on('cena_carregada', () => { const m=_getMapaById(MAPA_STATE?.mapaAtualId); if(m) _verificarMapaIsoLegado(m); });

// ── 7.5 snapParaCelula no renderer procedural ─────────────────────────────
function snapParaCelula(xPct, yPct, mapa) {
  const largura=mapa?.largura_total||20, altura=mapa?.altura_total||20;
  return { col:Math.max(0,Math.min(largura-1,Math.round((xPct/100)*largura))), row:Math.max(0,Math.min(altura-1,Math.round((yPct/100)*altura))) };
}
window.snapParaCelula = snapParaCelula;

const _origMapaRenderCanvas7 = window.mapaRenderCanvas;
window.mapaRenderCanvas = function(m) {
  const resultado = _origMapaRenderCanvas7(m);
  if (!resultado) return resultado;
  if (mapaIsTatico(m) && m.render_data?.saidas?.length) {
    m.render_data.saidas.forEach(s => { if(s.x_percent!==undefined&&s.col===undefined){const sn=snapParaCelula(s.x_percent,s.y_percent,m);s.col=sn.col;s.row=sn.row;} });
  }
  if (mapaIsTatico(m) && m.grid) {
    const canvas = document.getElementById('mapa-canvas');
    const mapaImg = document.getElementById('mapa-img');
    if (canvas && mapaImg) {
      // Usar dimensões reais do elemento renderizado para alinhar com os tokens
      const W = mapaImg.offsetWidth  || mapaImg.clientWidth  || 400;
      const H = mapaImg.offsetHeight || mapaImg.clientHeight || 300;
      // Redimensionar canvas se necessário
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width  = W;
        canvas.height = H;
      }
      const ctx = canvas.getContext('2d');
      // Não limpar — preservar outros desenhos do renderer procedural
      const largura = m.largura_total || 20;
      const altura  = m.altura_total  || 20;
      const cW = W / largura;
      const cH = H / altura;
      const _hasTileset = typeof AVT_STATE !== 'undefined' && AVT_STATE._tilesetLoaded;
      ctx.save();
      ctx.strokeStyle = _hasTileset ? 'rgba(126,200,240,0.04)' : 'rgba(126,200,240,0.12)';
      ctx.lineWidth   = _hasTileset ? 0.3 : 0.5;
      for (let c = 0; c <= largura; c++) {
        ctx.beginPath(); ctx.moveTo(Math.round(c * cW) + 0.5, 0); ctx.lineTo(Math.round(c * cW) + 0.5, H); ctx.stroke();
      }
      for (let r = 0; r <= altura; r++) {
        ctx.beginPath(); ctx.moveTo(0, Math.round(r * cH) + 0.5); ctx.lineTo(W, Math.round(r * cH) + 0.5); ctx.stroke();
      }
      ctx.restore();
    }
  }
  return resultado;
};

function animarAtaque({ atacEl, alvoEl, animacao, dano }) {
  return new Promise(resolve => {
    const origem = _animCentro(atacEl);
    const alvo   = _animCentro(alvoEl);
    const cor    = animacao.cor   || '#e74c3c';
    const icone  = animacao.icone || '';
    const trilha = !!animacao.trilha;
    const rgb    = _animHexToRgb(cor);
    const canvas = _animCriarCanvas();
    const ctx    = canvas.getContext('2d');
    function destruir() { canvas.remove(); resolve(); }

    const tipos = {
      projetil:       () => _animProjetil     (ctx, canvas, origem, alvo, cor, rgb, icone, trilha, destruir),
      onda:           () => _animOnda         (ctx, canvas, origem, alvo, cor, rgb, icone, destruir),
      explosao:       () => _animExplosao     (ctx, canvas, origem, alvo, cor, rgb, icone, destruir),
      raio:           () => _animRaio         (ctx, canvas, origem, alvo, cor, rgb, icone, destruir),
      aura:           () => _animAura         (ctx, canvas, origem, alvo, cor, rgb, icone, destruir),
      aura_guerreiro: () => _animAuraGuerreiro(ctx, canvas, origem, alvo, cor, rgb, icone, destruir),
      corte:          () => _animCorte        (ctx, canvas, origem, alvo, cor, rgb, icone, destruir),
      bola_energia:   () => _animBolaEnergia  (ctx, canvas, origem, alvo, cor, rgb, icone, trilha, destruir),
      gif:            () => { canvas.remove(); _animMedia(animacao, origem, alvo, resolve); },
      imagem:         () => { canvas.remove(); _animMedia(animacao, origem, alvo, resolve); },
      svg:            () => { canvas.remove(); _animMedia(animacao, origem, alvo, resolve); },
      iframe:         () => { canvas.remove(); _animMedia(animacao, origem, alvo, resolve); },
    };
    const fn = tipos[animacao.tipo];
    if (fn) fn(); else destruir();
  });
}

function _animProjetil(ctx, canvas, origem, alvo, cor, rgb, icone, trilha, done) {
  const dur = 500, start = performance.now();
  const cx = (origem.x + alvo.x) / 2;
  const cy = Math.min(origem.y, alvo.y) - 80;
  const trail = [];
  function bezier(t) {
    return {
      x: (1-t)*(1-t)*origem.x + 2*(1-t)*t*cx + t*t*alvo.x,
      y: (1-t)*(1-t)*origem.y + 2*(1-t)*t*cy + t*t*alvo.y
    };
  }
  function frame(now) {
    const t = Math.min((now - start) / dur, 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pos = bezier(t);
    if (trilha) {
      trail.push({ ...pos, t });
      for (let i = trail.length - 1; i >= 0; i--) {
        const p = trail[i], age = t - p.t;
        if (age > 0.35) { trail.splice(0, i + 1); break; }
        const a = (1 - age / 0.35) * 0.6;
        const s = Math.max(2, 10 * (1 - age / 0.35));
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI*2);
        ctx.fillStyle = `rgba(${rgb},${a})`; ctx.fill();
      }
    }
    const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 18);
    grad.addColorStop(0, `rgba(${rgb},0.9)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 18, 0, Math.PI*2);
    ctx.fillStyle = grad; ctx.fill();
    if (icone) {
      ctx.font='22px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(icone, pos.x, pos.y);
    } else {
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 7, 0, Math.PI*2);
      ctx.fillStyle = cor; ctx.fill();
    }
    if (t >= 1) { _animImpacto(ctx, alvo, rgb, cor, icone); setTimeout(done, 300); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function _animOnda(ctx, canvas, origem, alvo, cor, rgb, icone, done) {
  const dur = 700, start = performance.now();
  const ondas = [0, 0.2, 0.4];
  function frame(now) {
    const t = Math.min((now - start) / dur, 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const off of ondas) {
      const lt = Math.min(Math.max((t - off) / (1 - off), 0), 1);
      if (lt <= 0) continue;
      const raio = lt * 120, alpha = (1 - lt) * 0.7;
      ctx.beginPath(); ctx.arc(origem.x, origem.y, raio, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(${rgb},${alpha})`; ctx.lineWidth = 3*(1-lt)+1; ctx.stroke();
    }
    if (icone) {
      ctx.font = `${20+t*10}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.globalAlpha = 1-t*0.5; ctx.fillText(icone, origem.x, origem.y); ctx.globalAlpha=1;
    }
    if (t >= 1) { done(); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function _animExplosao(ctx, canvas, origem, alvo, cor, rgb, icone, done) {
  const dur = 600, start = performance.now();
  const N = 28;
  const ps = Array.from({length:N},(_,i)=>{
    const ang=(Math.PI*2*i/N)+(Math.random()-0.5)*0.4, spd=60+Math.random()*80;
    return {vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, size:3+Math.random()*5};
  });
  function frame(now) {
    const t = Math.min((now - start) / dur, 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (t < 0.15) {
      const r=t/0.15*40;
      const g=ctx.createRadialGradient(alvo.x,alvo.y,0,alvo.x,alvo.y,r);
      g.addColorStop(0,`rgba(255,255,255,${0.9*(1-t/0.15)})`);
      g.addColorStop(0.5,`rgba(${rgb},0.8)`); g.addColorStop(1,`rgba(${rgb},0)`);
      ctx.beginPath(); ctx.arc(alvo.x,alvo.y,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    }
    for (const p of ps) {
      const px=alvo.x+p.vx*t, py=alvo.y+p.vy*t, alpha=Math.max(0,1-t*1.4);
      ctx.beginPath(); ctx.arc(px,py,p.size*(1-t*0.6),0,Math.PI*2);
      ctx.fillStyle=`rgba(${rgb},${alpha})`; ctx.fill();
    }
    if (icone && t>0.05 && t<0.7) {
      ctx.font=`${28+t*14}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.globalAlpha=Math.max(0,1-t*2); ctx.fillText(icone,alvo.x,alvo.y); ctx.globalAlpha=1;
    }
    if (t >= 1) { done(); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function _animRaio(ctx, canvas, origem, alvo, cor, rgb, icone, done) {
  const dur = 400, start = performance.now();
  let segs = _animGerarZigzag(origem, alvo, 8), lastRegen = 0;
  function frame(now) {
    const t = Math.min((now - start) / dur, 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (now - lastRegen > 60) { segs = _animGerarZigzag(origem, alvo, 8); lastRegen = now; }
    const alpha = t < 0.7 ? 1 : (1-t)/0.3;
    ctx.save();
    ctx.shadowColor=cor; ctx.shadowBlur=16;
    ctx.strokeStyle=`rgba(${rgb},${alpha*0.4})`; ctx.lineWidth=8;
    ctx.beginPath(); segs.forEach((s,i)=>i===0?ctx.moveTo(s.x,s.y):ctx.lineTo(s.x,s.y)); ctx.stroke();
    ctx.strokeStyle=`rgba(255,255,255,${alpha*0.85})`; ctx.lineWidth=2; ctx.shadowBlur=0;
    ctx.beginPath(); segs.forEach((s,i)=>i===0?ctx.moveTo(s.x,s.y):ctx.lineTo(s.x,s.y)); ctx.stroke();
    ctx.restore();
    if (icone && t > 0.6) {
      ctx.font='28px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.globalAlpha=(t-0.6)/0.4; ctx.fillText(icone,alvo.x,alvo.y); ctx.globalAlpha=1;
    }
    if (t >= 1) { done(); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function _animGerarZigzag(a, b, n) {
  const pts = [a];
  for (let i = 1; i < n; i++) {
    const tt = i/n;
    const bx = a.x+(b.x-a.x)*tt, by = a.y+(b.y-a.y)*tt;
    const px = -(b.y-a.y), py = b.x-a.x;
    const len = Math.sqrt(px*px+py*py)||1;
    const off = (Math.random()-0.5)*40;
    pts.push({x:bx+px/len*off, y:by+py/len*off});
  }
  pts.push(b); return pts;
}

function _animAura(ctx, canvas, origem, alvo, cor, rgb, icone, done) {
  const dur = 800, start = performance.now();
  function frame(now) {
    const t = Math.min((now - start) / dur, 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pulse = Math.sin(t*Math.PI*4)*0.5+0.5;
    const raio  = 28+pulse*16;
    const alpha = (t<0.8?1:(1-t)/0.2)*(0.4+pulse*0.4);
    const g = ctx.createRadialGradient(alvo.x,alvo.y,0,alvo.x,alvo.y,raio);
    g.addColorStop(0,`rgba(${rgb},${alpha})`);
    g.addColorStop(0.6,`rgba(${rgb},${alpha*0.5})`);
    g.addColorStop(1,`rgba(${rgb},0)`);
    ctx.beginPath(); ctx.arc(alvo.x,alvo.y,raio,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.beginPath(); ctx.arc(alvo.x,alvo.y,raio*1.1,0,Math.PI*2);
    ctx.strokeStyle=`rgba(${rgb},${alpha*0.6})`; ctx.lineWidth=2; ctx.stroke();
    if (icone) {
      ctx.font=`${18+pulse*6}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.globalAlpha=Math.min(1,alpha*2); ctx.fillText(icone,alvo.x,alvo.y); ctx.globalAlpha=1;
    }
    if (t >= 1) { done(); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function _animAuraGuerreiro(ctx, canvas, origem, alvo, cor, rgb, icone, done) {
  const dur = 900, start = performance.now();
  function frame(now) {
    const t = Math.min((now - start) / dur, 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pulse = Math.sin(t * Math.PI * 4) * 0.5 + 0.5;
    const raio  = 30 + pulse * 18;
    const alpha = (t < 0.8 ? 1 : (1 - t) / 0.2) * (0.45 + pulse * 0.4);
    const g = ctx.createRadialGradient(origem.x, origem.y, 0, origem.x, origem.y, raio);
    g.addColorStop(0, `rgba(${rgb},${alpha})`);
    g.addColorStop(0.6, `rgba(${rgb},${alpha * 0.5})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.beginPath(); ctx.arc(origem.x, origem.y, raio, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.arc(origem.x, origem.y, raio * 1.15, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${rgb},${alpha * 0.7})`; ctx.lineWidth = 2.5; ctx.stroke();
    const dx = alvo.x - origem.x, dy = alvo.y - origem.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const reach = raio * (0.6 + pulse * 0.4);
    ctx.beginPath();
    ctx.moveTo(origem.x, origem.y);
    ctx.lineTo(origem.x + (dx / len) * reach, origem.y + (dy / len) * reach);
    ctx.strokeStyle = `rgba(${rgb},${alpha})`; ctx.lineWidth = 3; ctx.stroke();
    if (icone) {
      ctx.font = `${20 + pulse * 6}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = Math.min(1, alpha * 2); ctx.fillText(icone, origem.x, origem.y); ctx.globalAlpha = 1;
    }
    if (t >= 1) { done(); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function _animCorte(ctx, canvas, origem, alvo, cor, rgb, icone, done) {
  const dur = 420, start = performance.now();
  const slashes = [
    { ox: -12, oy: -12, ex: 28, ey: 28 },
    { ox: -2,  oy: -18, ex: 38, ey: 22 },
    { ox: -22, oy: -6,  ex: 18, ey: 34 },
  ];
  function frame(now) {
    const t = Math.min((now - start) / dur, 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const alpha = t < 0.5 ? t / 0.5 : (1 - t) / 0.5;
    slashes.forEach((s, i) => {
      const delay = i * 0.08;
      const lt = Math.max(0, Math.min((t - delay) / (1 - delay), 1));
      if (lt <= 0) return;
      ctx.save();
      ctx.shadowColor = cor; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(alvo.x + s.ox, alvo.y + s.oy);
      ctx.lineTo(alvo.x + s.ox + (s.ex - s.ox) * lt, alvo.y + s.oy + (s.ey - s.oy) * lt);
      ctx.strokeStyle = `rgba(${rgb},${alpha * (1 - i * 0.2)})`;
      ctx.lineWidth = 3 - i * 0.5;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    });
    if (t >= 1) { done(); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function _animBolaEnergia(ctx, canvas, origem, alvo, cor, rgb, icone, trilha, done) {
  const dur = 480, start = performance.now();
  const cx = (origem.x + alvo.x) / 2;
  const cy = Math.min(origem.y, alvo.y) - 60;
  const trail = [];
  function bezier(t) {
    return {
      x: (1-t)*(1-t)*origem.x + 2*(1-t)*t*cx + t*t*alvo.x,
      y: (1-t)*(1-t)*origem.y + 2*(1-t)*t*cy + t*t*alvo.y,
    };
  }
  function frame(now) {
    const t = Math.min((now - start) / dur, 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pos = bezier(t);
    trail.push({ ...pos, t });
    for (let i = trail.length - 1; i >= 0; i--) {
      const p = trail[i], age = t - p.t;
      if (age > 0.4) { trail.splice(0, i + 1); break; }
      const a = (1 - age / 0.4) * 0.7;
      const s2 = Math.max(2, 14 * (1 - age / 0.4));
      const g2 = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s2);
      g2.addColorStop(0, `rgba(${rgb},${a})`);
      g2.addColorStop(1, `rgba(${rgb},0)`);
      ctx.beginPath(); ctx.arc(p.x, p.y, s2, 0, Math.PI * 2); ctx.fillStyle = g2; ctx.fill();
    }
    ctx.save();
    ctx.shadowColor = cor; ctx.shadowBlur = 20;
    const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 20);
    g.addColorStop(0, `rgba(255,255,255,0.9)`);
    g.addColorStop(0.3, `rgba(${rgb},0.85)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    if (icone) {
      ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(icone, pos.x, pos.y);
    }
    if (t >= 1) { _animImpacto(ctx, alvo, rgb, cor, icone); setTimeout(done, 280); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

