// ui/modals.js
// RPG Hub — Secret market info system, session panel, wall/door obstacle system
// Includes: mercadoSelecionarTipo(), mostrarInformacaoAdquirida(), WALLS_STATE, paredeBloqueiaMovimento()


// ══════════════════════════════════════════════════════════════
// SISTEMA DE INFORMAÇÕES SECRETAS DO MERCADO
// Implementado conforme melhorias_sistema.js
// ══════════════════════════════════════════════════════════════

// Selecionar tipo no painel gerenciar do mercado
function mercadoSelecionarTipo(tipo) {
  const formItem = document.getElementById('mercado-form-item');
  const formInfo = document.getElementById('mercado-form-informacao');
  const btnItem  = document.getElementById('merc-tipo-item');
  const btnInfo  = document.getElementById('merc-tipo-info');
  if (!formItem || !formInfo) return;

  if (tipo === 'item') {
    formItem.style.display = 'block';
    formInfo.style.display = 'none';
    if (btnItem) { btnItem.style.background = 'rgba(79,163,209,0.15)'; btnItem.style.borderColor = 'rgba(79,163,209,0.3)'; btnItem.style.color = '#4fa3d1'; }
    if (btnInfo) { btnInfo.style.background = 'rgba(30,45,66,0.3)'; btnInfo.style.borderColor = 'rgba(30,45,66,0.5)'; btnInfo.style.color = '#7a92aa'; }
  } else {
    formItem.style.display = 'none';
    formInfo.style.display = 'block';
    if (btnInfo) { btnInfo.style.background = 'rgba(200,168,75,0.15)'; btnInfo.style.borderColor = 'rgba(200,168,75,0.3)'; btnInfo.style.color = '#f0cc6a'; }
    if (btnItem) { btnItem.style.background = 'rgba(30,45,66,0.3)'; btnItem.style.borderColor = 'rgba(30,45,66,0.5)'; btnItem.style.color = '#7a92aa'; }
    // Preencher select de moedas se vazio
    const select = document.getElementById('mercado-info-denom');
    if (select && select.options.length === 0 && typeof _mercDenoms === 'function') {
      _mercDenoms().forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.nome;
        opt.textContent = (d.emoji || '') + ' ' + d.nome;
        select.appendChild(opt);
      });
    }
  }
}

// Criar informação secreta no mercado (mestre apenas)
async function mercadoCriarInformacao() {
  if (!_isMestre()) { mostrarToast('Apenas o mestre pode criar informações', 'erro'); return; }

  const nome            = document.getElementById('mercado-info-nome')?.value.trim() || '';
  const descPublica     = document.getElementById('mercado-info-desc-pub')?.value.trim() || '';
  const conteudoSecreto = document.getElementById('mercado-info-conteudo')?.value.trim() || '';
  const preco           = parseFloat(document.getElementById('mercado-info-preco')?.value) || 0;
  const denom           = document.getElementById('mercado-info-denom')?.value || 'Ouro';
  const estoque         = parseInt(document.getElementById('mercado-info-estoque')?.value) || 1;

  if (!nome || !conteudoSecreto) { mostrarToast('Preencha nome e conteúdo secreto', 'aviso'); return; }

  const mercadoId = MERCADO_STATE.mercadoId;
  const rpgId     = _mercRpgId();

  try {
    const [row] = await sb('mercado', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        rpg_id: rpgId,
        mercado_id: mercadoId,
        tipo: 'informacao',
        custom_nome: nome,
        custom_descricao: descPublica || 'Informação disponível para compra',
        conteudo_secreto: conteudoSecreto,
        preco: preco,
        denominacao: denom,
        estoque: estoque,
        estoque_atual: estoque,
        item_catalog_id: null
      })
    });
    if (row) {
      MERCADO_STATE.todos.push(row);
      renderMercadoItens();
      _limparFormularioInformacao();
      mostrarToast(`✓ Informação "${nome}" adicionada ao mercado`, 'sucesso');
    }
  } catch (e) { mostrarToast('Erro ao criar informação: ' + e.message, 'erro'); }
}

function _limparFormularioInformacao() {
  const ids = ['mercado-info-nome','mercado-info-desc-pub','mercado-info-conteudo'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const preco = document.getElementById('mercado-info-preco'); if (preco) preco.value = '0';
  const est   = document.getElementById('mercado-info-estoque'); if (est) est.value = '1';
}

// Confirmar compra de informação (com dialog)
function confirmarCompraInfo(rowId, preco, denom) {
  const rowData = MERCADO_STATE.todos.find(r => r.id == rowId);
  if (!rowData) return;
  const nomeItem = rowData.custom_nome || 'Informação';
  const precoNum = parseFloat(preco) || 0;
  const msg = precoNum > 0
    ? `Adquirir "${nomeItem}" por ${precoNum} ${denom}?`
    : `Adquirir "${nomeItem}" gratuitamente?`;
  if (!confirm(msg)) return;
  comprarInformacao(rowId, preco, denom);
}

// Comprar informação secreta
async function comprarInformacao(rowId, preco, denom) {
  const charId   = _mercCharId();
  const rpgId    = _mercRpgId();
  const precoNum = parseFloat(preco) || 0;

  if (!charId) { mostrarToast('Abra o inventário de um personagem antes de comprar', 'aviso'); return; }

  const rowData = MERCADO_STATE.todos.find(r => r.id == rowId);
  if (!rowData) { mostrarToast('Informação não encontrada', 'erro'); return; }

  const nome = rowData.custom_nome || 'Informação';

  // 1. Verificar saldo
  if (precoNum > 0) {
    const atual = await sb(
      `moedas?rpg_id=eq.${encodeURIComponent(rpgId)}&dono_id=eq.${encodeURIComponent(charId)}&denominacao=eq.${encodeURIComponent(denom)}&select=id,quantidade`
    ).catch(() => []);
    const saldo = atual?.[0]?.quantidade || 0;
    if (saldo < precoNum) { mostrarToast(`❌ Saldo insuficiente — você tem ${saldo} ${denom}`, 'erro'); return; }
    try { await _moedaUpsert(charId, denom, -precoNum); }
    catch (e) { mostrarToast('Erro ao debitar moedas: ' + e.message, 'erro'); return; }
  }

  // 2. Registrar compra
  try {
    await sb('informacoes_compradas', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        rpg_id: rpgId,
        character_id: charId,
        mercado_item_id: rowId,
        conteudo: rowData.conteudo_secreto,
        comprado_em: new Date().toISOString()
      })
    });
  } catch (e) {
    if (precoNum > 0) { try { await _moedaUpsert(charId, denom, +precoNum); } catch (_) {} }
    mostrarToast('Erro ao adquirir informação', 'erro');
    return;
  }

  // 3. Decrementar estoque
  if (rowData.estoque != null) {
    const ea   = rowData.estoque_atual ?? rowData.estoque;
    const novo = Math.max(0, ea - 1);
    try {
      await sb(`mercado?id=eq.${rowId}&rpg_id=eq.${encodeURIComponent(rpgId)}`, {
        method: 'PATCH', body: JSON.stringify({ estoque_atual: novo })
      });
      rowData.estoque_atual = novo;
    } catch (_) {}
    renderMercadoItens();
  }

  // 4. Log + saldo
  await _moedaLog(charId, null, denom, precoNum, 'remover', `Compra de informação: ${nome}`);
  mostrarInformacaoAdquirida(nome, rowData.conteudo_secreto);
  await _mercAtualizarSaldo();
}

// Modal para mostrar informação adquirida
function mostrarInformacaoAdquirida(nome, conteudo) {
  const existing = document.getElementById('modal-info-adquirida');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-info-adquirida';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(15,21,32,0.98),rgba(10,14,22,0.98));border:2px solid rgba(200,168,75,0.4);border-radius:16px;padding:28px;max-width:500px;width:100%;box-shadow:0 8px 32px rgba(200,168,75,0.3)">
      <div style="font-family:'Cinzel',serif;font-size:1rem;color:#f0cc6a;text-align:center;margin-bottom:20px;letter-spacing:0.1em;text-transform:uppercase">📜 ${nome}</div>
      <div style="background:rgba(200,168,75,0.05);border:1px solid rgba(200,168,75,0.15);border-radius:8px;padding:16px;margin-bottom:20px;color:#c8d8e8;font-size:0.9rem;line-height:1.6;max-height:400px;overflow-y:auto">${(conteudo||'').replace(/\n/g,'<br>')}</div>
      <button onclick="document.getElementById('modal-info-adquirida').remove()" style="width:100%;padding:12px;background:linear-gradient(135deg,rgba(200,168,75,0.25),rgba(200,168,75,0.1));border:1px solid rgba(200,168,75,0.4);border-radius:8px;color:#f0cc6a;font-family:'Cinzel',serif;font-size:0.75rem;cursor:pointer;letter-spacing:0.08em;text-transform:uppercase" onmouseover="this.style.background='linear-gradient(135deg,rgba(200,168,75,0.35),rgba(200,168,75,0.15))'" onmouseout="this.style.background='linear-gradient(135deg,rgba(200,168,75,0.25),rgba(200,168,75,0.1))'">✓ Entendido</button>
    </div>`;
  document.body.appendChild(modal);
  mostrarToast(`✓ Informação adquirida: ${nome}`, 'sucesso');
}

// Ver informações compradas pelo personagem atual
async function verInformacoesCompradas() {
  const charId = _mercCharId();
  const rpgId  = _mercRpgId();
  if (!charId) { mostrarToast('Abra o inventário de um personagem', 'aviso'); return; }

  try {
    const rows = await sb(
      `informacoes_compradas?rpg_id=eq.${encodeURIComponent(rpgId)}&character_id=eq.${encodeURIComponent(charId)}&select=*,mercado_item:mercado!mercado_item_id(custom_nome)&order=comprado_em.desc`
    );
    if (!rows || rows.length === 0) { mostrarToast('Você ainda não comprou nenhuma informação', ''); return; }

    const existing = document.getElementById('modal-infos-compradas');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-infos-compradas';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';

    const itensHtml = rows.map(r => {
      const nome = r.mercado_item?.custom_nome || 'Informação';
      const data = r.comprado_em ? new Date(r.comprado_em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
      const conteudoEsc = (r.conteudo||'').replace(/'/g,"\'").replace(/\n/g,'\\n');
      const nomeEsc = nome.replace(/'/g,"\'");
      return `<div style="background:rgba(15,21,32,0.8);border:1px solid rgba(30,45,66,0.7);border-radius:8px;padding:14px;margin-bottom:10px;cursor:pointer" onmouseover="this.style.borderColor='rgba(200,168,75,0.4)'" onmouseout="this.style.borderColor='rgba(30,45,66,0.7)'" onclick="document.getElementById('modal-infos-compradas').remove();mostrarInformacaoAdquirida('${nomeEsc}','${conteudoEsc}')">
        <div style="font-size:0.85rem;color:#f0cc6a;margin-bottom:4px;font-family:'Cinzel',serif">📜 ${nome}</div>
        <div style="font-size:0.65rem;color:#7a92aa">Comprado em: ${data}</div>
      </div>`;
    }).join('');

    modal.innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(15,21,32,0.98),rgba(10,14,22,0.98));border:2px solid rgba(200,168,75,0.3);border-radius:16px;padding:28px;max-width:600px;width:100%;max-height:80vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <div style="font-family:'Cinzel',serif;font-size:0.9rem;color:#f0cc6a;letter-spacing:0.1em;text-transform:uppercase">📚 Minhas Informações</div>
          <button onclick="document.getElementById('modal-infos-compradas').remove()" style="background:none;border:none;color:#7a92aa;font-size:1.3rem;cursor:pointer">✕</button>
        </div>
        <div style="margin-bottom:12px;color:#7a92aa;font-size:0.75rem">Clique em uma informação para visualizá-la</div>
        ${itensHtml}
      </div>`;
    document.body.appendChild(modal);
  } catch (e) { mostrarToast('Erro ao carregar informações: ' + e.message, 'erro'); }
}

// Sobrescrever renderMercadoItens para suportar tipo 'informacao'
(function _patchRenderMercadoItens() {
  const _originalRender = window.renderMercadoItens;
  window.renderMercadoItens = function() {
    const grid = document.getElementById('mercado-itens-grid');
    if (!grid) return _originalRender ? _originalRender.apply(this, arguments) : undefined;

    const isMestre   = _isMestre();
    const filtroBusca = (document.getElementById('mercado-busca')?.value || '').toLowerCase();
    const filtroTipo  = document.getElementById('mercado-filtro-tipo')?.value || '';

    let itens = (MERCADO_STATE.todos || []).filter(r => {
      if (filtroTipo === 'informacao') return r.tipo === 'informacao';
      if (filtroTipo && filtroTipo !== 'informacao') {
        if (r.tipo === 'informacao') return false; // esconder infos em outros filtros
      }
      return true;
    });

    // Se filtro não é 'informacao' exclusivo, usar renderização original para itens normais
    if (filtroTipo !== 'informacao') {
      return _originalRender ? _originalRender.apply(this, arguments) : undefined;
    }

    if (filtroBusca) {
      itens = itens.filter(r => (r.custom_nome || '').toLowerCase().includes(filtroBusca));
    }

    if (itens.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#7a92aa;font-style:italic">Nenhuma informação encontrada</div>';
      return;
    }

    const _getEmoji = tipo => ({'arma':'⚔️','armadura':'🛡️','amuleto':'💎','consumivel':'🧪','ferramenta':'🔧','informacao':'📜'}[tipo] || '📦');

    grid.innerHTML = itens.map(r => {
      const nome    = r.custom_nome || 'Informação';
      const desc    = r.custom_descricao || '';
      const preco   = r.preco || 0;
      const denom   = r.denominacao || 'Ouro';
      const estoque = r.estoque_atual ?? r.estoque;
      const esgot   = estoque !== null && estoque !== undefined && estoque <= 0;

      const estoqueHtml = estoque != null
        ? `<div style="font-size:0.62rem;color:${estoque > 0 ? '#5ee09a' : '#e74c3c'};margin-top:4px">Estoque: ${estoque}</div>` : '';

      const btnComprar = !esgot
        ? `<button onclick="confirmarCompraInfo(${r.id},${preco},'${denom}')" style="padding:7px 12px;background:rgba(39,174,96,0.12);border:1px solid rgba(39,174,96,0.3);border-radius:7px;color:#5ee09a;font-family:'Cinzel',serif;font-size:0.58rem;cursor:pointer" onmouseover="this.style.background='rgba(39,174,96,0.22)'" onmouseout="this.style.background='rgba(39,174,96,0.12)'">${preco > 0 ? `${preco} ${denom}` : 'Grátis'}</button>`
        : `<div style="font-size:0.62rem;color:#e74c3c">Esgotado</div>`;

      const btnEditar = isMestre
        ? `<button onclick="mercadoEditarItem(${r.id})" style="padding:4px 8px;background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#4fa3d1;font-size:0.55rem;cursor:pointer;margin-left:4px">✏️</button>` : '';

      return `<div style="background:rgba(15,21,32,0.8);border:1px solid rgba(200,168,75,0.25);border-left:3px solid rgba(200,168,75,0.6);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px;transition:all 0.2s" onmouseover="this.style.borderColor='rgba(200,168,75,0.5)'" onmouseout="this.style.borderColor='rgba(200,168,75,0.25)'">
        <div style="display:flex;align-items:start;gap:8px">
          <span style="font-size:1.4rem">📜</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.82rem;color:#c8d8e8;font-weight:500">${nome}</div>
            ${desc ? `<div style="font-size:0.68rem;color:#7a92aa;margin-top:2px;font-style:italic">${desc}</div>` : ''}
            ${estoqueHtml}
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">${btnComprar}${btnEditar}</div>
      </div>`;
    }).join('');
  };
})();

console.log('✓ Sistema de informações secretas do mercado carregado');

// ============================================================
// ✨ PIXI PARTICLES PLUGIN — RPG Hub v4 (bugs corrigidos)
// ============================================================


(function () {
  'use strict';

  const PIXI_TYPE = 'pixi_particles';

  // ── Motor Canvas 2D ───────────────────────────────────────────────────
  class PixiParticleEngine {
    constructor(canvas, config, emitterPos) {
      this.canvas = canvas;
      this.ctx    = canvas.getContext('2d');
      this.cfg    = config || {};
      this.pos    = emitterPos || { x: canvas.width/2, y: canvas.height/2 };
      this.particles = []; this.time = 0; this.accumulator = 0;
      this.raf = null; this.lastTs = null;
      this._parse();
    }

    _parse() {
      const c = this.cfg;
      this.maxParticles     = Math.min(c.maxParticles || 100, 400);
      this.frequency        = Math.max(c.frequency || 0.016, 0.001);
      this.particlesPerWave = c.particlesPerWave || 1;
      this.emitterLifetime  = c.emitterLifetime !== undefined ? c.emitterLifetime : 1.0;
      this.addAtBack        = !!c.addAtBack;
      this.spawnType        = c.spawnType || 'point';
      this.spawnCircle      = c.spawnCircle || { x:0, y:0, r:10 };
      this.spawnRect        = c.spawnRect   || { x:0, y:0, w:20, h:20 };
      this.alphaStart       = c.alpha?.start  ?? 1;
      this.alphaEnd         = c.alpha?.end    ?? 0;
      this.alphaCurve       = c.alphaCurve   || 'linear';
      this.scaleStart       = c.scale?.start  ?? 1;
      this.scaleEnd         = c.scale?.end    ?? 0.1;
      this.scaleCurve       = c.scaleCurve   || 'linear';
      this.colorStart       = this._hex(c.color?.start || '#fff');
      this.colorEnd         = this._hex(c.color?.end   || '#fff');
      this.colorMid         = c.color?.mid ? this._hex(c.color.mid) : null;
      this.speedStart       = c.speed?.start  ?? 100;
      this.speedEnd         = c.speed?.end    ?? 0;
      this.maxSpeed         = c.maxSpeed      ?? Infinity;
      this.lifetimeMin      = c.lifetime?.min ?? 0.3;
      this.lifetimeMax      = c.lifetime?.max ?? 0.8;
      this.rotMin           = (c.startRotation?.min ?? 0)   * Math.PI/180;
      this.rotMax           = (c.startRotation?.max ?? 360) * Math.PI/180;
      this.rotSpeedMin      = (c.rotationSpeed?.min ?? 0)   * Math.PI/180;
      this.rotSpeedMax      = (c.rotationSpeed?.max ?? 0)   * Math.PI/180;
      this.accel            = { x: c.acceleration?.x ?? 0, y: c.acceleration?.y ?? 0 };
      this.blendMode        = c.blendMode || 'normal';
      this.noRotation       = !!c.noRotation;
      this.baseSize         = Math.max(c.particleBaseSize || 8, 2);
      this.particleShape    = c.particleShape  || 'circle';
      this.glowStrength     = c.glowStrength   ?? 0;
      this.turbulence       = c.turbulence     ?? 0;
      this.scaleXRatio      = c.scaleXRatio    ?? 1;
    }

    _hex(h) {
      if (!h) return {r:255,g:255,b:255};
      const s = h.replace('#','');
      if (s.length===3) return {r:parseInt(s[0]+s[0],16),g:parseInt(s[1]+s[1],16),b:parseInt(s[2]+s[2],16)};
      return {r:parseInt(s.slice(0,2),16),g:parseInt(s.slice(2,4),16),b:parseInt(s.slice(4,6),16)};
    }

    _lerp(a,b,t){return a+(b-a)*t;}

    _lerpColor(t) {
      if (this.colorMid) {
        if (t < 0.5) return this._lerpC(this.colorStart, this.colorMid, t * 2);
        return this._lerpC(this.colorMid, this.colorEnd, (t - 0.5) * 2);
      }
      return this._lerpC(this.colorStart, this.colorEnd, t);
    }
    _lerpC(a,b,t){return{r:Math.round(this._lerp(a.r,b.r,t)),g:Math.round(this._lerp(a.g,b.g,t)),b:Math.round(this._lerp(a.b,b.b,t))};}

    _ease(t, curve) {
      switch(curve) {
        case 'easeIn':    return t * t;
        case 'easeOut':   return 1 - (1-t)*(1-t);
        case 'easeInOut': return t < 0.5 ? 2*t*t : 1 - 2*(1-t)*(1-t);
        case 'pulse':     return Math.sin(t * Math.PI);
        default:          return t;
      }
    }

    _spawnPos() {
      const b={x:this.pos.x,y:this.pos.y};
      if(this.spawnType==='circle'){const r=Math.random()*this.spawnCircle.r,a=Math.random()*Math.PI*2;return{x:b.x+Math.cos(a)*r,y:b.y+Math.sin(a)*r};}
      if(this.spawnType==='ring'){const r=this.spawnCircle.r,a=Math.random()*Math.PI*2;return{x:b.x+Math.cos(a)*r,y:b.y+Math.sin(a)*r};}
      if(this.spawnType==='rect')return{x:b.x+(Math.random()-.5)*this.spawnRect.w,y:b.y+(Math.random()-.5)*this.spawnRect.h};
      if(this.spawnType==='burst'){const a=Math.random()*Math.PI*2,r=Math.random()*(this.spawnCircle.r||10);return{x:b.x+Math.cos(a)*r,y:b.y+Math.sin(a)*r};}
      return{...b};
    }

    _spawn(){
      const sp=this._spawnPos();
      const angle=this.rotMin+Math.random()*(this.rotMax-this.rotMin);
      const lt=this.lifetimeMin+Math.random()*(this.lifetimeMax-this.lifetimeMin);
      const rs=this.noRotation?0:this.rotSpeedMin+Math.random()*(this.rotSpeedMax-this.rotSpeedMin);
      return{x:sp.x,y:sp.y,vx:Math.cos(angle)*this.speedStart,vy:Math.sin(angle)*this.speedStart,dir:angle,rotation:angle,rotSpeed:rs,lifetime:lt,age:0};
    }

    update(dt){
      if(this.emitterLifetime<0||this.time<this.emitterLifetime){
        this.accumulator+=dt;
        while(this.accumulator>=this.frequency&&this.particles.length<this.maxParticles){
          for(let i=0;i<this.particlesPerWave;i++)if(this.particles.length<this.maxParticles)this.particles.push(this._spawn());
          this.accumulator-=this.frequency;
        }
      }
      for(let i=this.particles.length-1;i>=0;i--){
        const p=this.particles[i]; p.age+=dt;
        if(p.age>=p.lifetime){this.particles.splice(i,1);continue;}
        const t=p.age/p.lifetime,spd=this._lerp(this.speedStart,this.speedEnd,t);
        const cur=Math.sqrt(p.vx*p.vx+p.vy*p.vy)||1;
        p.vx=(p.vx/cur)*spd+this.accel.x*dt; p.vy=(p.vy/cur)*spd+this.accel.y*dt;
        if(this.turbulence>0){
          const drift=((Math.random()-.5)*this.turbulence*dt*6);
          const cos=Math.cos(drift),sin=Math.sin(drift);
          const nx=p.vx*cos-p.vy*sin, ny=p.vx*sin+p.vy*cos;
          p.vx=nx; p.vy=ny;
        }
        if(this.maxSpeed<Infinity){
          const spd2=Math.sqrt(p.vx*p.vx+p.vy*p.vy);
          if(spd2>this.maxSpeed){p.vx=(p.vx/spd2)*this.maxSpeed;p.vy=(p.vy/spd2)*this.maxSpeed;}
        }
        p.x+=p.vx*dt; p.y+=p.vy*dt;
        if(this.particleShape==='spark'){
          p.rotation=Math.atan2(p.vy,p.vx);
        } else if(!this.noRotation){
          p.rotation+=p.rotSpeed*dt;
        }
      }
      this.time+=dt;
    }

    // ── Formas de partícula ───────────────────────────────────────────────
    _drawShape(ctx, shape, size) {
      switch(shape) {
        case 'star': {
          const pts=5, outer=size, inner=size*.42;
          ctx.beginPath();
          for(let i=0;i<pts*2;i++){
            const r=i%2===0?outer:inner, a=(i*Math.PI/pts)-Math.PI/2;
            i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
          }
          ctx.closePath(); break;
        }
        case 'spark': {
          const lx=this.scaleXRatio*size*.18, ly=size*1.6;
          ctx.beginPath(); ctx.ellipse(0,0,lx,ly,0,0,Math.PI*2); break;
        }
        case 'diamond': {
          ctx.beginPath();
          ctx.moveTo(0,-size); ctx.lineTo(size*.55,0); ctx.lineTo(0,size); ctx.lineTo(-size*.55,0);
          ctx.closePath(); break;
        }
        case 'square': {
          const h=size*.75;
          ctx.beginPath(); ctx.rect(-h,-h,h*2,h*2); break;
        }
        default: {
          ctx.beginPath(); ctx.arc(0,0,size,0,Math.PI*2); break;
        }
      }
    }

    _blendOp(m){
      const MAP={normal:'source-over',add:'lighter',screen:'screen',multiply:'multiply',
        overlay:'overlay','soft-light':'soft-light','hard-light':'hard-light','color-dodge':'color-dodge'};
      return MAP[m]||'source-over';
    }

    // ── _renderParticles: núcleo compartilhado de draw ────────────────────
    // Usado por draw() e drawNoClear() para evitar duplicação de código.
    _renderParticles() {
      const ctx=this.ctx;
      const blendOp=this._blendOp(this.blendMode);
      const useGlow=this.glowStrength>0;
      const list=this.addAtBack?this.particles:[...this.particles].reverse();

      let glowCtx=null, glowCanvas=null;
      if(useGlow){
        glowCanvas=this._glowCanvas||(this._glowCanvas=document.createElement('canvas'));
        glowCanvas.width=this.canvas.width; glowCanvas.height=this.canvas.height;
        glowCtx=glowCanvas.getContext('2d');
        glowCtx.clearRect(0,0,glowCanvas.width,glowCanvas.height);
      }

      ctx.globalCompositeOperation=blendOp;

      for(const p of list){
        const t=p.age/p.lifetime;
        const alphaT=this._ease(t, this.alphaCurve);
        const scaleT=this._ease(t, this.scaleCurve);
        const alpha=Math.max(0,this._lerp(this.alphaStart,this.alphaEnd,alphaT));
        const scale=Math.max(0,this._lerp(this.scaleStart,this.scaleEnd,scaleT))*this.baseSize;
        const col=this._lerpColor(t);
        if(alpha<=0||scale<=0)continue;
        const cr=col.r,cg=col.g,cb=col.b;

        ctx.save();
        ctx.globalAlpha=alpha;
        ctx.translate(p.x,p.y);
        ctx.rotate(p.rotation);

        if(this.particleShape==='circle'){
          try{
            const g=ctx.createRadialGradient(0,0,0,0,0,scale);
            g.addColorStop(0,  `rgba(${cr},${cg},${cb},1)`);
            g.addColorStop(.45,`rgba(${cr},${cg},${cb},.75)`);
            g.addColorStop(1,  `rgba(${cr},${cg},${cb},0)`);
            this._drawShape(ctx,'circle',scale);
            ctx.fillStyle=g; ctx.fill();
          }catch(_){}
        } else {
          try{
            ctx.save();
            this._drawShape(ctx, this.particleShape, scale);
            ctx.clip();
            const g=ctx.createRadialGradient(-scale*.2,-scale*.2,0,0,0,scale*1.2);
            g.addColorStop(0,  `rgba(255,255,255,.55)`);
            g.addColorStop(.4, `rgba(${cr},${cg},${cb},1)`);
            g.addColorStop(1,  `rgba(${Math.max(0,cr-40)},${Math.max(0,cg-40)},${Math.max(0,cb-40)},.9)`);
            this._drawShape(ctx, this.particleShape, scale);
            ctx.fillStyle=g; ctx.fill();
            ctx.restore();
          }catch(_){
            this._drawShape(ctx, this.particleShape, scale);
            ctx.fillStyle=`rgb(${cr},${cg},${cb})`;
            ctx.fill();
          }
        }
        ctx.restore();

        if(useGlow && glowCtx){
          glowCtx.save();
          glowCtx.globalAlpha=alpha*0.7;
          glowCtx.translate(p.x,p.y);
          glowCtx.rotate(p.rotation);
          const gs=scale*(1+this.glowStrength*.6);
          glowCtx.beginPath(); glowCtx.arc(0,0,gs,0,Math.PI*2);
          glowCtx.fillStyle=`rgb(${cr},${cg},${cb})`;
          glowCtx.fill();
          glowCtx.restore();
        }
      }

      if(useGlow && glowCanvas){
        const blur=Math.round(this.glowStrength*8);
        ctx.save();
        ctx.filter=`blur(${blur}px)`;
        ctx.globalCompositeOperation=this.blendMode==='multiply'?'multiply':'lighter';
        ctx.globalAlpha=0.65;
        ctx.drawImage(glowCanvas,0,0);
        ctx.restore();
      }

      ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
    }

    // Draw normal: limpa o canvas e renderiza (uso em emitter único)
    draw(){
      this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
      this._renderParticles();
    }

    // Draw sem limpar: para uso em multi-layer onde o loop externo já limpou
    drawNoClear(){
      this._renderParticles();
    }

    get isAlive(){return this.particles.length>0||this.emitterLifetime<0||this.time<this.emitterLifetime;}

    start(onDone){
      const loop=(ts)=>{
        if(!this.lastTs)this.lastTs=ts;
        const dt=Math.min((ts-this.lastTs)/1000,.05); this.lastTs=ts;
        this.update(dt); this.draw();
        if(this.isAlive)this.raf=requestAnimationFrame(loop);
        else if(typeof onDone==='function')onDone();
      };
      this.raf=requestAnimationFrame(loop);
    }

    stop(){if(this.raf){cancelAnimationFrame(this.raf);this.raf=null;}}
  }

  let _previewEng    = null;
  let _previewRaf    = null; // para preview de trajetória (RAF manual)

  // ── Injetar UI no modal ───────────────────────────────────────────────
  function _injetarUI() {
    const sel = document.getElementById('sk-anim-tipo');
    if (sel && !sel.querySelector(`option[value="${PIXI_TYPE}"]`)) {
      const og = document.createElement('optgroup');
      og.label = 'Pixi Particles (IA)';
      const op = document.createElement('option');
      op.value = PIXI_TYPE; op.textContent = '✨ Pixi Particles (IA)';
      og.appendChild(op); sel.appendChild(og);
    }
    if (!document.getElementById('sk-anim-campos-pixi')) {
      const ref = document.getElementById('sk-anim-campos-midia');
      if (!ref) return;
      const div = document.createElement('div');
      div.id = 'sk-anim-campos-pixi'; div.style.display = 'none';
      div.innerHTML = `
        <div class="form-group" style="margin-bottom:8px">
          <label>🤖 Descreva o ataque para a IA</label>
          <input type="text" id="sk-anim-pixi-descricao" placeholder="Ex: bola de fogo, feixe de gelo, raio elétrico…" style="text-align:left;font-size:0.82rem">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div class="form-group"><label>Tipo Visual</label>
            <select id="sk-anim-pixi-tipo-visual" style="width:100%;padding:8px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.72rem">
              <option value="auto">🎲 Auto</option><option value="fogo">🔥 Fogo</option><option value="gelo">❄️ Gelo</option>
              <option value="raio">⚡ Raio</option><option value="veneno">☠️ Veneno</option><option value="magia">✨ Magia</option>
              <option value="cura">💚 Cura</option><option value="sombra">🌑 Sombra</option><option value="fisico">💥 Físico</option>
              <option value="sangue">🩸 Sangue</option><option value="vento">🌪️ Vento</option><option value="terra">🪨 Terra</option><option value="agua">💧 Água</option>
            </select>
          </div>
          <div class="form-group"><label>Posição</label>
            <select id="sk-anim-pixi-posicao" style="width:100%;padding:8px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.72rem">
              <option value="alvo">No alvo</option><option value="atacante">No atacante</option>
              <option value="meio">No meio</option><option value="trajetoria">Trajetória</option>
            </select>
          </div>
        </div>
        <button onclick="skAnimPixiGerarPrompt()" style="width:100%;padding:10px;background:linear-gradient(135deg,rgba(123,47,190,0.3),rgba(79,163,209,0.2));border:1px solid rgba(123,47,190,0.5);border-radius:8px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.72rem;cursor:pointer;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">
          📋 Gerar Prompt para IA
        </button>
        <div id="sk-anim-pixi-prompt-wrap" style="display:none;margin-bottom:12px">
          <div style="font-size:0.62rem;color:#7a92aa;margin-bottom:4px">Cole este prompt na sua IA externa e cole o JSON retornado no campo abaixo:</div>
          <div style="position:relative">
            <textarea id="sk-anim-pixi-prompt-out" rows="6" readonly style="width:100%;box-sizing:border-box;padding:8px;padding-right:70px;background:rgba(20,12,40,0.9);border:1px solid rgba(123,47,190,0.4);border-radius:6px;color:#c8a84b;font-family:monospace;font-size:0.62rem;resize:vertical;line-height:1.45"></textarea>
            <button onclick="skAnimPixiCopiarPrompt()" id="sk-anim-pixi-btn-copiar" style="position:absolute;top:6px;right:6px;padding:4px 10px;background:rgba(123,47,190,0.25);border:1px solid rgba(123,47,190,0.5);border-radius:4px;color:#c8a84b;font-size:0.6rem;cursor:pointer">📋 Copiar</button>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <label style="display:flex;justify-content:space-between;align-items:center">
            <span>JSON — Pixi Particles</span>
            <span style="display:flex;gap:6px">
              <a href="https://pixijs.io/pixi-particles-editor/" target="_blank" style="font-size:0.6rem;color:var(--primario);text-decoration:none;padding:2px 6px;border:1px solid rgba(79,163,209,0.3);border-radius:4px">↗ Editor</a>
              <button onclick="skAnimPixiPreviewPlay()" style="font-size:0.6rem;padding:2px 8px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:4px;color:#c8a84b;cursor:pointer">▶ Preview</button>
            </span>
          </label>
          <textarea id="sk-anim-pixi-json" rows="8" oninput="skAnimPixiOnJsonChange()" placeholder='Cole o JSON do editor ou clique em Gerar com IA'
            style="width:100%;box-sizing:border-box;padding:8px;background:rgba(5,8,16,0.9);border:1px solid rgba(123,47,190,0.3);border-radius:6px;color:#aed6f1;font-family:monospace;font-size:0.72rem;resize:vertical;margin-top:4px;line-height:1.5"></textarea>
          <div id="sk-anim-pixi-json-erro" style="display:none;font-size:0.65rem;color:#e74c3c;margin-top:4px"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div class="form-group"><label>Duração/ciclo (ms)</label><input type="number" id="sk-anim-pixi-duracao" value="1500" min="200" max="10000" step="100" style="text-align:center"></div>
          <div class="form-group"><label>Repetições</label><input type="number" id="sk-anim-pixi-repeticao" value="1" min="1" max="10" style="text-align:center"></div>
        </div>
        <div id="sk-anim-pixi-preview-wrap" style="display:none;background:rgba(5,8,16,0.92);border:1px solid rgba(123,47,190,0.3);border-radius:10px;padding:10px;text-align:center;margin-bottom:8px">
          <div style="font-size:0.65rem;color:var(--suave);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.08em">✦ Preview</div>
          <canvas id="sk-anim-pixi-preview-canvas" width="320" height="120" style="max-width:100%;border-radius:6px;background:rgba(15,21,32,0.95)"></canvas>
          <button onclick="skAnimPixiPreviewPlay()" style="display:block;margin:8px auto 0;padding:4px 16px;background:rgba(123,47,190,0.15);border:1px solid rgba(123,47,190,0.4);border-radius:5px;color:#a084e8;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer;text-transform:uppercase">▶ Repetir</button>
        </div>`;
      ref.parentNode.insertBefore(div, ref.nextSibling);
    }
  }

  // ── skAnimTipoChange patch ────────────────────────────────────────────
  const _origTipoChange = window.skAnimTipoChange;
  window.skAnimTipoChange = function () {
    const tipo = document.getElementById('sk-anim-tipo')?.value;
    const pixi = document.getElementById('sk-anim-campos-pixi');
    if (tipo === PIXI_TYPE) {
      ['sk-anim-campos-canvas','sk-anim-campos-midia'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
      ['sk-anim-preview-wrap','sk-anim-midia-preview-wrap'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
      if (pixi) pixi.style.display = '';
    } else {
      if (pixi) pixi.style.display = 'none';
      if (typeof _origTipoChange === 'function') _origTipoChange.call(this);
    }
  };

  // ── Gerador de Prompt para IA externa ────────────────────────────────
  window.skAnimPixiGerarPrompt = function () {
    const desc    = document.getElementById('sk-anim-pixi-descricao')?.value.trim() || '';
    const visual  = document.getElementById('sk-anim-pixi-tipo-visual')?.value || 'auto';
    const nome    = document.getElementById('sk-habilidade')?.value.trim() || '';
    const posicao = document.getElementById('sk-anim-pixi-posicao')?.value || 'alvo';
    const descSkill = document.getElementById('sk-descricao')?.value.trim() || '';
    const wrapEl  = document.getElementById('sk-anim-pixi-prompt-wrap');
    const outEl   = document.getElementById('sk-anim-pixi-prompt-out');

    // ── Dicionário visual narrativo ───────────────────────────────────────
    const narrativas = {
      fogo: {
        cor:'#ff6600 (laranja chama), #ff2200 (vermelho núcleo), #ffee00 (centro branco-amarelo), #ff4400 (brasas)',
        fisica:'accel.y entre -30 e -60 (chamas sobem), turbulence 1.5-2.5 (movimento orgânico do fogo), partículas grandes no centro e pequenas nas bordas',
        blend:'add nas chamas vivas, screen na fumaça, normal na brasa escura',
        forma:'spark (chamas alongadas), circle (brasas), star (faíscas)',
        visual:'Chamas REAIS não são uniformes: o centro é branco-amarelo intenso, o meio é laranja, as bordas são vermelhas e a fumaça acima é preta-acinzentada. As chamas tremem e sobem. As brasas caem lentamente.'
      },
      gelo: {
        cor:'#ffffff (reflexo), #aaddff (azul gelo), #006699 (azul profundo), #cceeff (cristal)',
        fisica:'accel.y 8-15 (cristais caem levemente), turbulence 0-0.3 (gelo é preciso, não caótico), partículas com rotação lenta',
        blend:'screen nos reflexos, add nos cristais, normal na sombra',
        forma:'diamond (cristais), spark (fragmentos finos), circle (névoa fria)',
        visual:'Gelo é SÓLIDO e CORTANTE: cristais hexagonais que refletem luz, fragmentos afiados que voam, névoa branca gelada que paira baixo. Não tem fumaça — tem névoa translúcida. Os reflexos são brancos e intensos, as sombras são azul-escuro.'
      },
      raio: {
        cor:'#ffffff (núcleo puro), #88ccff (halo elétrico), #0033ff (campo energético), #aaffff (plasma)',
        fisica:'speed altíssima (400-700 no núcleo), turbulence 2.0-3.0 (instabilidade elétrica), lifetime curtíssimo (0.02-0.1s), faíscas em todas as direções',
        blend:'add em tudo (raio é pura luz)',
        forma:'spark (raios), circle (plasma), star (faíscas)',
        visual:'Raio é CAÓTICO e INSTANTÂNEO: o núcleo é branco puro cegante, ao redor tem plasma azul vibrante, e faíscas saltam em todas as direções de forma imprevisível. O ar ao redor brilha azulado. Não dura mais que uma fração de segundo.'
      },
      veneno: {
        cor:'#44ff00 (verde tóxico), #228800 (verde floresta escuro), #aaff44 (brilho ácido), #001100 (sombra podre)',
        fisica:'accel.y 15-25 (gotículas caem), turbulence 1.0-1.8 (líquido viscoso), bolhas sobem (accel.y negativo em camadas leves)',
        blend:'screen no brilho tóxico, normal nas bolhas, add no respingo',
        forma:'circle (gotas), star (esporos), diamond (fragmentos)',
        visual:'Veneno é ORGÂNICO e VISCOSO: gotículas grossas e brilhantes que escorrem, bolhas que sobem lentamente, esporos que flutuam. A cor é verde doentio e brilhante — não verde belo, mas verde TÓXICO. Deixa rastro pegajoso.'
      },
      magia: {
        cor:'#ff88ff (rosa arcano), #cc00ff (violeta puro), #8800aa (índigo profundo), #ffccff (brilho etéreo)',
        fisica:'accel.y -10 a -20 (partículas arcanas flutuam), turbulence 0.4-0.8 (magia é fluida), rotação constante',
        blend:'add nas runas e brilhos, screen no halo etéreo',
        forma:'star (runas e faíscas), diamond (cristais arcanos), circle (energia)',
        visual:'Magia arcana é MISTERIOSA e FLUTUANTE: partículas em espiral, runas que brilham e somem, um halo etéreo violeta que pulsa. Não tem peso — tudo flutua. O centro é intenso violeta-branco, as bordas são roxo-escuro translúcido.'
      },
      cura: {
        cor:'#ffffff (luz pura), #88ffcc (verde-jade), #00cc66 (verde vida), #aaffdd (brilho suave)',
        fisica:'accel.y -25 a -45 (partículas de cura sobem sempre), turbulence 0.2-0.5 (movimento sereno), scale pequena aumentando (crescimento)',
        blend:'screen em tudo (cura é luz suave, não agressiva)',
        forma:'star (cruzes e faíscas de cura), circle (orbs), spark (raios de luz)',
        visual:'Cura é ASCENDENTE e SUAVE: partículas que sobem graciosamente, orbs de luz verde que pulsam, faíscas douradas-verdes. Não tem impacto violento — é gentil. O centro tem um flash branco suave e depois tudo sobe calmamente.'
      },
      sombra: {
        cor:'#220033 (roxo abissal), #440066 (sombra profunda), #000000 (vácuo), #8800cc (pulso sombrio)',
        fisica:'speed baixa (20-80), turbulence 1.2-2.0 (sombras são gasosas e imprevisíveis), scale MUITO grande (névoa densa que cobre tudo), lifetime longo',
        blend:'multiply na escuridão (escurece o que está atrás), normal na névoa densa, screen só no núcleo de energia',
        forma:'circle (névoa), star (only no núcleo mágico)',
        visual:'Sombra é DENSA e SUFOCANTE: uma névoa negra-roxa que se expande lentamente, absorvendo a luz ao redor. Multiply blend escurece genuinamente o cenário. O movimento é lento e pesado. Só o núcleo de energia tem algum brilho, e mesmo ele é roxo-escuro.'
      },
      fisico: {
        cor:'#ffcc00 (energia cinética), #ff8800 (impacto), #ffffff (flash de contato), #885500 (poeira)',
        fisica:'speed ALTÍSSIMA (400-800) no burst inicial, depois partículas caem (accel.y 40-80), turbulence 0.5-1.0',
        blend:'add no flash e energia, normal na poeira e pedaços',
        forma:'diamond (fragmentos sólidos), spark (energia), square (pedaços de pedra/madeira), circle (poeira)',
        visual:'Impacto físico é EXPLOSIVO e PESADO: um flash branco imediato no contato, depois fragmentos voam em todas as direções com velocidade, poeira sobe, e pedaços maiores caem com gravidade. Tudo acontece muito rápido. É RAW, não é mágico.'
      },
      sangue: {
        cor:'#cc0000 (sangue vivo), #660000 (sangue escuro), #220000 (sombra de sangue), #ff4444 (spray)',
        fisica:'accel.y 50-90 (MUITO pesado, sangue cai), turbulence 0.6-1.0, gotículas pequenas voam rápido no spray',
        blend:'normal em tudo (sangue é opaco, não brilha)',
        forma:'circle (gotas redondas), spark (spray fino)',
        visual:'Sangue é OPACO e PESADO: gotículas que voam brevemente e caem rápido por gravidade. Não brilha — blend NORMAL. Tem o spray inicial (gotículas pequenas rápidas) e depois as gotas maiores que caem. A cor escurece com o tempo.'
      },
      vento: {
        cor:'#eeffff (ar quase invisível), #aacccc (brisa leve), #ccdddd (rajada), #ffffff (ponta da rajada)',
        fisica:'turbulence MÁXIMA 2.5-3.5 (vento é caótico), speed alta e variável, sem aceleração gravitacional (vento não cai)',
        blend:'screen em tudo (vento é translúcido)',
        forma:'spark (rajadas finas), circle (redemoinho)',
        visual:'Vento é QUASE INVISÍVEL: partículas muito transparentes, brancas-azuladas, que se movem em espiral e rajadas. Turbulence altíssima. O efeito é ver O MOVIMENTO do ar, não o ar em si. Linhas finas e curvas que aparecem e somem rapidamente.'
      },
      terra: {
        cor:'#886633 (terra), #553300 (pedra escura), #221100 (sombra subterrânea), #aa8844 (poeira)',
        fisica:'accel.y MUITO ALTO 80-150 (pedras são pesadíssimas), speed alta no burst, turbulence 0.3-0.6',
        blend:'normal em tudo (pedra e terra são opacos)',
        forma:'square (blocos de pedra), diamond (fragmentos), circle (poeira)',
        visual:'Terra é MASSIVA e PESADA: blocos e pedaços que voam brevemente e caem RÁPIDO com gravidade alta. Poeira sobe mas logo cai. Sem brilho, blend normal. O impacto faz o chão rachar. Cores são marrons e cinzas terrosas, sem qualquer luminosidade.'
      },
      agua: {
        cor:'#aaddff (água clara), #0066cc (azul profundo), #003366 (sombra aquática), #ffffff (espuma)',
        fisica:'accel.y 25-45 (água cai), turbulence 0.8-1.4 (água é fluida), gotículas que se dispersam lateralmente',
        blend:'screen na espuma e reflexos, normal nas gotas pesadas',
        forma:'circle (gotas), spark (respingos finos), diamond (cristais de água)',
        visual:'Água é FLUIDA e REFLEXIVA: spray que vai para os lados, gotículas que caem em arco, espuma branca na superfície de impacto. Screen blend nos reflexos brancos. O movimento é fluido e natural — nada é rígido.'
      },
      auto: {
        cor:'escolha a paleta de cores que melhor representa a habilidade descrita',
        fisica:'escolha a física que melhor representa o movimento e peso da habilidade',
        blend:'escolha os blendModes que criam o visual mais fiel ao tema',
        forma:'escolha as formas de partícula mais adequadas',
        visual:'Analise a habilidade cuidadosamente e imagine como ela se pareceria em um RPG de alta qualidade. Pense no peso, velocidade, temperatura, elemento e impacto emocional dela.'
      }
    };

    const n = narrativas[visual] || narrativas.auto;
    const isTraj = posicao === 'trajetoria';

    // ── Análise narrativa da habilidade ──────────────────────────────────
    const nomeCompleto = nome || 'Habilidade';
    const descCompleta = [desc, descSkill].filter(Boolean).join(' — ');

    const posLabel = {
      alvo: 'NO ALVO (efeito de impacto que explode no personagem atingido)',
      atacante: 'NO ATACANTE (aura, buff ou preparação no personagem que usa a habilidade)',
      meio: 'NO MEIO DO CAMPO (efeito de área entre atacante e alvo)',
      trajetoria: 'EM TRAJETÓRIA (projétil que viaja do atacante até o alvo, o emitter se move)'
    }[posicao] || 'NO ALVO';

    // ── Prompt de trajetória ──────────────────────────────────────────────
    const promptTraj = `Você é diretor de VFX de um RPG de alta qualidade. Sua tarefa é gerar um efeito de partículas em JSON que represente VISUALMENTE e FIELMENTE a habilidade descrita — não apenas pelo elemento, mas pelo que ela é, como se move, e que sensação causa.

RESPONDA APENAS COM O ARRAY JSON PURO. Zero texto, zero markdown, zero explicações.

═══════════════════════════════════════════════
HABILIDADE: "${nomeCompleto}"
DESCRIÇÃO: "${descCompleta || 'sem descrição'}"
═══════════════════════════════════════════════

ANTES DE GERAR: visualize a habilidade como um animador de cinema faria.
${n.visual}

Perguntas que você deve responder mentalmente antes de escrever o JSON:
• Como este efeito se MOVE? (rápido/lento, orgânico/mecânico, pesado/leve)
• Qual é a SILHUETA do projétil enquanto viaja? (lança afilada, bola, nuvem, tendril)
• O QUE FICA NO RASTRO? (fogo, gelo, veneno, vácuo, escuridão)
• Como é o IMPACTO ao chegar no alvo?
• Qual a TEMPERATURA visual? (quente=laranja/vermelho, frio=azul/branco, tóxico=verde)

SISTEMA: o emitter SE MOVE do atacante ao alvo. Partículas são emitidas durante a viagem.
- speed ALTA (500-900): partícula gruda no emitter → forma o NÚCLEO/CORPO do projétil
- speed MÉDIA (100-350): partícula se afasta levemente → FRAGMENTOS e HALO lateral  
- speed BAIXA (8-70): partícula quase não se move → NÉVOA e RASTRO DIFUSO que fica

CAMPOS DISPONÍVEIS POR CAMADA:
alpha:{start,end} | scale:{start,end} | color:{start,end}
speed:{start,end} | acceleration:{x,y} | startRotation:{min,max}
rotationSpeed:{min,max} | lifetime:{min,max} | frequency | emitterLifetime
maxParticles | addAtBack:bool | spawnType:"point"|"ring"|"rect"
blendMode:"add"|"screen"|"normal"|"multiply"
particleShape:"circle"|"diamond"|"spark"|"star"|"square"
glowStrength:0-3 | turbulence:0-3
spawnCircle:{x,y,r} (obrigatório se spawnType="ring")

ESTRUTURA OBRIGATÓRIA — 6 A 7 CAMADAS (FUNDO PARA FRENTE):
[0] addAtBack:true — SOMBRA/VÁCUO: escura (cor da sombra do tema), scale cresce (1.5→5.0), alpha 0.15→0, blend:normal. Peso e profundidade.
[1] addAtBack:true — RASTRO/CAUDA: translúcida, speed baixa (8-60), turbulence do tema, blend:screen. O que fica no ar após o projétil passar.
[2] FRAGMENTOS LATERAIS: speed 120-320, saem em ângulo (±30-60° do eixo), forma característica do tema, blend:add, glowStrength 1-2.
[3] MICRO-RASTRO: partículas pequenas (scale 0.05-0.14), frequency alta (0.003-0.008), speed 60-160, blend:add. O "pó" e detalhes finos.
[4] HALO: spawnType:ring (r:3-8), speed 80-180, scale cresce (0.3→1.6), blend:add, glowStrength 2+. A onda ao redor do núcleo.
[5] NÚCLEO/CORPO: speed ALTA (480-800), scale afina (0.18→0.04), blend:add, glowStrength 2-3. O projétil em si.
[6] PONTA (opcional): speed MUITO ALTA (700-950), scale minúscula, maxParticles 8-15, lifetime curtíssimo (0.02-0.05). Flash da frente.

REGRAS INEGOCIÁVEIS:
• Pelo menos 3 blendModes diferentes
• addAtBack:true → blend normal ou multiply APENAS
• addAtBack:false → blend add ou screen SEMPRE  
• frequency entre 0.003 e 0.015
• emitterLifetime entre 0.35 e 0.95
• glowStrength 2.0+ nas camadas de frente

PALETA DO TEMA "${visual}": ${n.cor}
FÍSICA: ${n.fisica}
BLEND: ${n.blend}
FORMAS: ${n.forma}

Array JSON:`;

    // ── Prompt de posição fixa ────────────────────────────────────────────
    const promptFixo = `Você é diretor de VFX de um RPG de alta qualidade. Sua tarefa é gerar um efeito de partículas em JSON que represente VISUALMENTE e FIELMENTE a habilidade descrita — não apenas pelo elemento, mas pelo que ela É, como se manifesta, e que sensação causa.

RESPONDA APENAS COM O ARRAY JSON PURO. Zero texto, zero markdown, zero explicações.

═══════════════════════════════════════════════
HABILIDADE: "${nomeCompleto}"
DESCRIÇÃO: "${descCompleta || 'sem descrição'}"
POSIÇÃO: ${posLabel}
═══════════════════════════════════════════════

ANTES DE GERAR: visualize a habilidade como um animador de cinema faria.
${n.visual}

Perguntas que você deve responder mentalmente antes de escrever o JSON:
• Como este efeito NASCE? (explosão imediata, crescimento gradual, espiral, convergência)
• Qual o TEMPO do efeito? (instantâneo e violento, lento e opressivo, pulsante e rítmico)
• O efeito tem PESO? (pedras caem, chamas sobem, veneno escorre, sombra paira)
• Como ele TERMINA? (desaparece rápido, deixa rastro, implode, sobe e some)
• Qual parte do efeito chama mais atenção? (núcleo central, debris voando, anel de choque)

CAMPOS DISPONÍVEIS POR CAMADA:
alpha:{start,end} | scale:{start,end} | color:{start,end}
speed:{start,end} | acceleration:{x,y} | startRotation:{min,max}
rotationSpeed:{min,max} | lifetime:{min,max} | frequency | emitterLifetime
maxParticles | addAtBack:bool
spawnType:"point"|"circle"|"ring"|"rect"|"burst"
blendMode:"add"|"screen"|"normal"|"multiply"|"overlay"
particleShape:"circle"|"diamond"|"spark"|"star"|"square"
glowStrength:0-3 | turbulence:0-3
alphaCurve:"linear"|"easeIn"|"easeOut"|"easeInOut"|"pulse"
scaleCurve:"linear"|"easeIn"|"easeOut"|"easeInOut"|"pulse"
scaleXRatio:0.05-1.0 (espessura do spark)
spawnCircle:{x,y,r} | spawnRect:{x,y,w,h}

ESTRUTURA OBRIGATÓRIA — 5 A 7 CAMADAS (FUNDO PARA FRENTE):
[0] addAtBack:true — SOMBRA/BASE: cor escura do tema, scale 1.0→4.0 (expande e some), alpha 0.3→0, lifetime longo (0.6-1.4s), blend:normal. Profundidade e peso.
[1] addAtBack:true — NÉVOA/ATMOSFERA: semitransparente, turbulence do tema, blend:screen, lifetime médio. A "atmosfera" que o efeito cria ao redor.
[2] DEBRIS/FRAGMENTOS: speed 90-260, diamond ou square, blend:add, rotationSpeed alto, glowStrength 1-2. O que voa para os lados.
[3] ENERGIA DISPERSA: speed baixa-média, star ou circle, blend:add, alphaCurve:pulse, glowStrength 2+. Partículas que flutuam e pulsam.
[4] ANEL DE CHOQUE: spawnType:ring, scale cresce, blend:add, glowStrength 2-3. A onda que emana do centro.
[5] NÚCLEO: spawnType:burst ou circle pequeno, scale grande→pequena, blend:add, glowStrength 3, lifetime curto. O flash/impacto central.
[6] FAÍSCAS (opcional): spark, scaleXRatio:0.08-0.15, speed muito alta, lifetime curtíssimo, blend:add. Crackling de energia.

REGRAS INEGOCIÁVEIS:
• Mínimo 5 camadas — efeitos rasos parecem amadores
• addAtBack:true → blend normal ou multiply APENAS
• addAtBack:false → blend add ou screen SEMPRE
• alphaCurve:"pulse" em pelo menos 1 camada de energia (vibração dramática)
• glowStrength 2.5+ nas camadas frontais
• Ao menos 1 camada com spawnType:ring
• frequency entre 0.003 e 0.02
• Pense na NARRATIVA: o efeito deve contar a história da habilidade em partículas

PALETA DO TEMA "${visual}": ${n.cor}
FÍSICA: ${n.fisica}
BLEND: ${n.blend}
FORMAS: ${n.forma}

Array JSON:`;

    const prompt = isTraj ? promptTraj : promptFixo;
    if (outEl) outEl.value = prompt;
    if (wrapEl) wrapEl.style.display = '';
  };

  window.skAnimPixiCopiarPrompt = function () {
    const el = document.getElementById('sk-anim-pixi-prompt-out');
    const btn = document.getElementById('sk-anim-pixi-btn-copiar');
    if (!el) return;
    el.select(); el.setSelectionRange(0, 99999);
    navigator.clipboard?.writeText(el.value).catch(() => document.execCommand('copy'));
    if (btn) { btn.textContent = '✓ Copiado!'; setTimeout(() => { btn.textContent = '📋 Copiar'; }, 1800); }
  };

  window.skAnimPixiOnJsonChange = function () {
    const val = document.getElementById('sk-anim-pixi-json')?.value.trim()||'';
    const err = document.getElementById('sk-anim-pixi-json-erro');
    if (!val) { if(err) err.style.display='none'; return; }
    try { JSON.parse(val); if(err) err.style.display='none'; }
    catch(e) { if(err){err.style.display='';err.textContent='⚠ JSON inválido: '+e.message;} }
  };

  // ── Preview ───────────────────────────────────────────────────────────
  window.skAnimPixiPreviewPlay = function () {
    const jsonEl  = document.getElementById('sk-anim-pixi-json');
    const canvas  = document.getElementById('sk-anim-pixi-preview-canvas');
    const wrap    = document.getElementById('sk-anim-pixi-preview-wrap');
    const posicao = document.getElementById('sk-anim-pixi-posicao')?.value || 'alvo';
    if (!jsonEl||!canvas) return;
    let cfg; try{cfg=JSON.parse(jsonEl.value.trim());}catch(_){return;}
    if (wrap) wrap.style.display='';

    // Parar qualquer preview anterior
    if (_previewEng) { _previewEng.stop(); _previewEng=null; }
    if (_previewRaf) { cancelAnimationFrame(_previewRaf); _previewRaf=null; }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Marcadores visuais: origem (azul) e alvo (vermelho)
    const OX = 36, OY = canvas.height/2;
    const TX = canvas.width - 36, TY = canvas.height/2;

    function _drawMarkers() {
      ctx.save();
      // Origem
      ctx.beginPath(); ctx.arc(OX,OY,8,0,Math.PI*2);
      ctx.fillStyle='rgba(79,163,209,0.5)'; ctx.fill();
      ctx.strokeStyle='rgba(79,163,209,0.9)'; ctx.lineWidth=1.5; ctx.stroke();
      // Alvo
      ctx.beginPath(); ctx.arc(TX,TY,8,0,Math.PI*2);
      ctx.fillStyle='rgba(232,80,60,0.5)'; ctx.fill();
      ctx.strokeStyle='rgba(232,80,60,0.9)'; ctx.lineWidth=1.5; ctx.stroke();
      ctx.restore();
    }

    if (posicao === 'trajetoria') {
      // ── Preview de trajetória: projétil vai de OX,OY até TX,TY ─────────
      const layers = Array.isArray(cfg) ? cfg : [cfg];
      const totalMs = Math.min(parseInt(document.getElementById('sk-anim-pixi-duracao')?.value)||1500, 3000);
      const origem = {x:OX, y:OY}, alvo = {x:TX, y:TY};

      const back  = layers.filter(l => l.addAtBack);
      const front = layers.filter(l => !l.addAtBack);
      const ordered = [...back, ...front];

      const emPos = {...origem};
      const engines = ordered.map(layerCfg => {
        const adapted = _adaptarLayerParaTrajetoria(layerCfg, origem, alvo, totalMs, canvas);
        const eng = new PixiParticleEngine(canvas, adapted, {...emPos});
        eng._spreadAngle = adapted._spreadAngle;
        return eng;
      });

      let last = performance.now(), boom = false;
      const t0 = last;

      function previewLoop(ts) {
        const dt = Math.min((ts-last)/1000, 0.05); last = ts;
        const elapsed = ts - t0;
        const t = Math.min(elapsed / totalMs, 1);

        // Bézier quadrática achatada para o preview pequeno
        const dx = alvo.x-origem.x, dy = alvo.y-origem.y;
        const dist = Math.sqrt(dx*dx+dy*dy)||1;
        const arcH = Math.min(dist*0.15, 28);
        const cx = (origem.x+alvo.x)/2;
        const cy = Math.min(origem.y,alvo.y) - arcH;

        emPos.x = (1-t)*(1-t)*origem.x + 2*(1-t)*t*cx + t*t*alvo.x;
        emPos.y = (1-t)*(1-t)*origem.y + 2*(1-t)*t*cy + t*t*alvo.y;

        // Tangente para direção das partículas
        const nt = Math.min(t+0.03,1);
        const tnx = (1-nt)*(1-nt)*origem.x + 2*(1-nt)*nt*cx + nt*nt*alvo.x;
        const tny = (1-nt)*(1-nt)*origem.y + 2*(1-nt)*nt*cy + nt*nt*alvo.y;
        const tangAngle = Math.atan2(tny-emPos.y, tnx-emPos.x);

        // Burst ao chegar
        if (t >= 0.88 && !boom) {
          boom = true;
          engines.forEach(eng => {
            eng.emitterLifetime = eng.time + 0.35;
            eng.frequency       = Math.max(eng.frequency * 0.4, 0.002);
            eng.maxParticles    = Math.min(eng.maxParticles * 2, 200);
            eng.rotMin          = 0; eng.rotMax = Math.PI*2;
            eng.speedStart      = eng.speedStart * 1.5;
          });
        }

        // Atualizar engines
        engines.forEach(eng => {
          eng.pos    = {...emPos};
          eng.rotMin = tangAngle - eng._spreadAngle;
          eng.rotMax = tangAngle + eng._spreadAngle;
          eng.update(dt);
        });

        // Renderizar: limpar → fundo → frente → marcadores por cima
        ctx.clearRect(0,0,canvas.width,canvas.height);
        engines.forEach(eng => eng.drawNoClear());
        _drawMarkers();

        // Repetir automaticamente quando terminar
        if (elapsed < totalMs + 600) {
          _previewRaf = requestAnimationFrame(previewLoop);
        } else {
          // Reiniciar preview em loop
          engines.forEach(eng => {
            eng.particles = []; eng.time = 0; eng.accumulator = 0;
          });
          boom = false;
          const t0new = performance.now();
          last = t0new;
          function restart(ts2) {
            const dtR = Math.min((ts2-last)/1000,0.05); last=ts2;
            const elR = ts2-t0new, tR = Math.min(elR/totalMs,1);
            const cxR = (origem.x+alvo.x)/2;
            const cyR = Math.min(origem.y,alvo.y)-arcH;
            emPos.x=(1-tR)*(1-tR)*origem.x+2*(1-tR)*tR*cxR+tR*tR*alvo.x;
            emPos.y=(1-tR)*(1-tR)*origem.y+2*(1-tR)*tR*cyR+tR*tR*alvo.y;
            const ntR=Math.min(tR+0.03,1);
            const tnxR=(1-ntR)*(1-ntR)*origem.x+2*(1-ntR)*ntR*cxR+ntR*ntR*alvo.x;
            const tnyR=(1-ntR)*(1-ntR)*origem.y+2*(1-ntR)*ntR*cyR+ntR*ntR*alvo.y;
            const taR=Math.atan2(tnyR-emPos.y,tnxR-emPos.x);
            if(elR>=0.88*totalMs&&!boom){boom=true;engines.forEach(eng=>{eng.emitterLifetime=eng.time+0.35;eng.frequency=Math.max(eng.frequency*0.4,0.002);eng.maxParticles=Math.min(eng.maxParticles*2,200);eng.rotMin=0;eng.rotMax=Math.PI*2;eng.speedStart*=1.5;});}
            engines.forEach(eng=>{eng.pos={...emPos};eng.rotMin=taR-eng._spreadAngle;eng.rotMax=taR+eng._spreadAngle;eng.update(dtR);});
            ctx.clearRect(0,0,canvas.width,canvas.height);
            engines.forEach(eng=>eng.drawNoClear());
            _drawMarkers();
            if(elR<totalMs+600){_previewRaf=requestAnimationFrame(restart);}
            else{window.skAnimPixiPreviewPlay();}
          }
          _previewRaf=requestAnimationFrame(restart);
        }
      }

      _drawMarkers();
      _previewRaf = requestAnimationFrame(previewLoop);

    } else {
      // ── Preview fixo: multi-layer no centro do canvas ────────────────────
      _drawMarkers();
      const layers = Array.isArray(cfg) ? cfg : [cfg];
      const cx = canvas.width/2, cy = canvas.height/2;

      if (layers.length === 1) {
        const pcfg = {...layers[0], emitterLifetime: Math.min(layers[0].emitterLifetime||1, 2.5)};
        _previewEng = new PixiParticleEngine(canvas, pcfg, {x:cx, y:cy});
        _previewEng.start(null);
      } else {
        // Multi-layer: loop manual, todas as camadas simultaneamente
        const back  = layers.filter(l => l.addAtBack);
        const front = layers.filter(l => !l.addAtBack);
        const ordered = [...back, ...front];
        const durSecs = Math.min((parseInt(document.getElementById('sk-anim-pixi-duracao')?.value)||1500)/1000, 4);

        const previewEngines = ordered.map(lc => {
          const pc = {...lc, emitterLifetime: Math.min(lc.emitterLifetime||1, durSecs*0.85)};
          return new PixiParticleEngine(canvas, pc, {x:cx, y:cy});
        });

        let last2 = performance.now();

        function fixoLoop(ts) {
          const dt = Math.min((ts-last2)/1000, 0.05); last2 = ts;
          previewEngines.forEach(eng => { eng.pos={x:cx,y:cy}; eng.update(dt); });
          const ctx2 = canvas.getContext('2d');
          ctx2.clearRect(0,0,canvas.width,canvas.height);
          previewEngines.forEach(eng => eng.drawNoClear());
          _drawMarkers();
          // Loop automático: quando todas morreram, reiniciar
          const alive = previewEngines.some(e => e.isAlive);
          if (alive) {
            _previewRaf = requestAnimationFrame(fixoLoop);
          } else {
            previewEngines.forEach(e => { e.stop(); e.particles=[]; e.time=0; e.accumulator=0; e._parse(); });
            last2 = performance.now();
            _previewRaf = requestAnimationFrame(fixoLoop);
          }
        }
        _previewRaf = requestAnimationFrame(fixoLoop);
      }
    }
  };

  // ── salvarSkill patch ─────────────────────────────────────────────────
  const _origSalvar = window.salvarSkill;
  window.salvarSkill = async function () {
    const animTipo = document.getElementById('sk-anim-tipo')?.value;
    if (animTipo !== PIXI_TYPE) {
      return typeof _origSalvar === 'function' ? _origSalvar.call(this) : undefined;
    }

    const rawJson = document.getElementById('sk-anim-pixi-json')?.value.trim() || '';
    if (!rawJson) { mostrarToast('Configure as partículas antes de salvar', 'aviso'); return; }
    let pixiCfg;
    try { pixiCfg = JSON.parse(rawJson); }
    catch(_) { mostrarToast('JSON de partículas inválido', 'erro'); return; }

    const skillIdEditar = document.getElementById('modal-skill-id')?.value || '';
    const personagem    = document.getElementById('modal-skill-personagem')?.value || '';
    const posicao       = document.getElementById('sk-anim-pixi-posicao')?.value   || 'alvo';
    const duracao       = parseInt(document.getElementById('sk-anim-pixi-duracao')?.value)   || 1500;
    const repeticao     = parseInt(document.getElementById('sk-anim-pixi-repeticao')?.value) || 1;
    const animacaoPixi  = { tipo: PIXI_TYPE, pixi_config: pixiCfg, posicao, duracao, repeticao };
    const qtdAntes      = (window.RPG_DATA?.skills || []).length;

    document.getElementById('sk-anim-tipo').value = 'nenhuma';

    try {
      await _origSalvar.call(this);
    } catch(e) {
      console.error('[PixiParticles] Erro no salvarSkill original:', e);
      return;
    }

    let targetId = skillIdEditar;
    if (!targetId) {
      const skills = window.RPG_DATA?.skills || [];
      if (skills.length > qtdAntes) { targetId = skills[skills.length - 1].id; }
      if (!targetId) {
        const charId = typeof _skCharId === 'function' ? _skCharId(personagem) : null;
        const sk = [...skills].reverse().find(s =>
          s.personagem === personagem || (charId && s.character_id === charId));
        if (sk) targetId = sk.id;
      }
    }

    if (!targetId) {
      mostrarToast('Skill salva, mas animação pixi não pôde ser persistida', 'aviso');
      return;
    }

    if (!window._pixiPatchPendente) window._pixiPatchPendente = {};
    window._pixiPatchPendente[targetId] = true;

    const skImm = (window.RPG_DATA?.skills || []).find(s => String(s.id) === String(targetId));
    if (skImm) skImm.animacao = animacaoPixi;

    try {
      await sb(`skills?id=eq.${encodeURIComponent(targetId)}`,
        { method: 'PATCH', body: JSON.stringify({ animacao: animacaoPixi }) });
      delete window._pixiPatchPendente[targetId];
      const skPost = (window.RPG_DATA?.skills || []).find(s => String(s.id) === String(targetId));
      if (skPost) skPost.animacao = animacaoPixi;
      console.log('[PixiParticles] ✓ animacao persistida — skill', targetId);
    } catch(e) {
      delete window._pixiPatchPendente[targetId];
      console.error('[PixiParticles] Erro ao persistir animacao pixi:', e);
      mostrarToast('Skill salva, mas erro ao persistir animação de partículas', 'aviso');
    }
  };

  // ── animarAtaque patch ────────────────────────────────────────────────
  const _origAnimar = window.animarAtaque;
  window.animarAtaque = function ({ atacEl, alvoEl, animacao, dano }) {
    if (animacao?.tipo === PIXI_TYPE || animacao?.tipo === 'pixi') {
      return new Promise(resolve => {
        const c = el => {
          if (typeof _animCentro === 'function') return _animCentro(el);
          if (!el) return { x: innerWidth/2, y: innerHeight/2 };
          const r=el.getBoundingClientRect(); return{x:r.left+r.width/2,y:r.top+r.height/2};
        };
        _runPixi(animacao, c(atacEl), c(alvoEl), resolve);
      });
    }
    return typeof _origAnimar==='function' ? _origAnimar.call(this,{atacEl,alvoEl,animacao,dano}) : Promise.resolve();
  };

  function _mkCanvas() {
    const c=document.createElement('canvas');
    c.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:8888;width:100vw;height:100vh';
    c.width=innerWidth; c.height=innerHeight; document.body.appendChild(c); return c;
  }

  function _runPixi(animacao, origem, alvo, resolve) {
    const cfg   = animacao.pixi_config || {};
    const pos   = animacao.posicao || 'alvo';
    const durMs = animacao.duracao || 1500;

    if (pos === 'trajetoria') {
      const layers = Array.isArray(cfg) ? cfg : [cfg];
      _runTrajetoria(layers, origem, alvo, durMs, resolve);
      return;
    }

    // Posição fixa: alvo, atacante ou meio
    const emPos = pos==='atacante'?{...origem}:pos==='meio'?{x:(origem.x+alvo.x)/2,y:(origem.y+alvo.y)/2}:{...alvo};
    const layers = Array.isArray(cfg) ? cfg : [cfg];

    if (layers.length === 1) {
      // Camada única: comportamento original
      const canvas = _mkCanvas();
      const cfgR = {...layers[0], emitterLifetime: Math.min(layers[0].emitterLifetime||1,(durMs/1000)*.7)};
      const eng = new PixiParticleEngine(canvas, cfgR, emPos);
      const t0  = performance.now();
      eng.start(()=>{ const rem=Math.max(0,durMs-(performance.now()-t0)); setTimeout(()=>{canvas.remove();resolve();},rem); });
      setTimeout(()=>{eng.stop();canvas.remove();resolve();},durMs+600);
      return;
    }

    // Multi-layer fixo: todos os engines no mesmo ponto, loop manual
    _runFixo(layers, emPos, durMs, resolve);
  }

  // ── _runFixo: multi-layer em posição fixa ────────────────────────────
  function _runFixo(layers, emPos, durMs, resolve) {
    const canvas = _mkCanvas();
    const travelSecs = durMs / 1000;

    // Ordenar: addAtBack=true → fundo (desenhado primeiro)
    const back  = layers.filter(l => l.addAtBack);
    const front = layers.filter(l => !l.addAtBack);
    const ordered = [...back, ...front];

    const engines = ordered.map(layerCfg => {
      const cfgR = {
        ...layerCfg,
        emitterLifetime: Math.min(layerCfg.emitterLifetime || 1, travelSecs * 0.85),
      };
      return new PixiParticleEngine(canvas, cfgR, {...emPos});
    });

    const t0 = performance.now();
    let last = t0, raf = null;

    function loop(ts) {
      const dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;
      const elapsed = ts - t0;

      engines.forEach(eng => { eng.pos = {...emPos}; eng.update(dt); });

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      engines.forEach(eng => eng.drawNoClear());

      if (elapsed < durMs + 800) {
        raf = requestAnimationFrame(loop);
      } else {
        engines.forEach(e => e.stop());
        canvas.remove();
        resolve();
      }
    }

    raf = requestAnimationFrame(loop);
  }

  // ── Adaptar uma camada do JSON para o modelo de emitter-móvel ────────
  // O JSON foi feito para partículas autônomas (PIXI.js nativo).
  // Aqui convertemos: velocidade alta → spread pequeno (fica colado no projétil),
  // velocidade baixa → spread maior (fica para trás formando cauda).
  function _adaptarLayerParaTrajetoria(layerCfg, origem, alvo, totalMs, canvasRef) {
    const dx   = alvo.x - origem.x, dy = alvo.y - origem.y;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
    const travelSecs = totalMs / 1000;

    const origSpeed = layerCfg.speed?.start || 100;

    // Speed alta (núcleo/ponta): spread mínimo — partícula fica grudada no projétil
    // Speed média (fragmentos): spread moderado — forma cauda imediata
    // Speed baixa (névoa/geada): spread amplo — se dispersa lateralmente
    let spreadDeg;
    if      (origSpeed > 500) spreadDeg = 6;
    else if (origSpeed > 200) spreadDeg = 18;
    else                      spreadDeg = 40;

    // Velocidade das partículas no novo sistema:
    // Núcleo → quase zero (o emitter as carrega)
    // Fragmentos → pequena (ficam levemente para trás)
    // Névoa → moderada (se dispersa)
    let newSpeedStart, newSpeedEnd;
    if      (origSpeed > 500) { newSpeedStart = 12; newSpeedEnd = 0; }
    else if (origSpeed > 200) { newSpeedStart = 35; newSpeedEnd = 0; }
    else                      { newSpeedStart = 60; newSpeedEnd = 0; }

    // Lifetime: proporcional ao tamanho do preview vs tela real
    // Em preview pequeno (canvas 320px) os tempos ficam muito longos
    const scaleFactor = canvasRef ? Math.min(1, canvasRef.width / 900) : 1;
    const lifeScale   = 0.5 + scaleFactor * 0.5; // 0.5 (preview) a 1.0 (tela real)
    const lifeMin = Math.min((layerCfg.lifetime?.min ?? 0.15) * lifeScale, travelSecs * 0.55);
    const lifeMax = Math.min((layerCfg.lifetime?.max ?? 0.35) * lifeScale, travelSecs * 0.85);

    // Frequência: JSON foi calibrado para PIXI que spawnava centenas de partículas/s
    // Canvas 2D precisa de frequências maiores (menor intervalo entre spawns)
    const freqScale = origSpeed > 500 ? 2.5 : origSpeed > 200 ? 2.0 : 1.5;
    const newFreq   = Math.max((layerCfg.frequency || 0.016) * freqScale, 0.005);

    // emitterLifetime: vive durante toda a viagem
    const newEmitterLifetime = travelSecs * 0.93;

    // Aceleração: manter y (gravidade/flutuação) mas zerar x
    // O x do JSON assume direção horizontal — conflita com a tangente da curva
    const accel = { x: 0, y: layerCfg.acceleration?.y ?? 0 };

    const adapted = {
      ...layerCfg,
      speed:           { start: newSpeedStart, end: newSpeedEnd },
      lifetime:        { min: Math.max(lifeMin, 0.05), max: Math.max(lifeMax, 0.1) },
      frequency:       newFreq,
      emitterLifetime: newEmitterLifetime,
      acceleration:    accel,
      // startRotation será sobrescrito dinamicamente no loop via eng.rotMin/rotMax
      // mas precisa de valor inicial válido para o _parse()
      startRotation:   { min: 0, max: 360 },
      maxParticles:    Math.min(layerCfg.maxParticles || 100, 220),
    };

    // _spreadAngle em radianos para uso no loop de trajetória
    adapted._spreadAngle = spreadDeg * Math.PI / 180;

    return adapted;
  }

  // ── _runTrajetoria: multi-layer, emitter móvel ao longo de Bézier ────
  function _runTrajetoria(layers, origem, alvo, totalMs, resolve) {
    const canvas = _mkCanvas();
    const t0     = performance.now();

    // Ordenar: addAtBack=true vai para o fundo (desenhado primeiro)
    const back  = layers.filter(l => l.addAtBack);
    const front = layers.filter(l => !l.addAtBack);
    const ordered = [...back, ...front];

    const emPos = {...origem};

    // Criar um engine por camada, com parâmetros adaptados
    const engines = ordered.map(layerCfg => {
      const adapted = _adaptarLayerParaTrajetoria(layerCfg, origem, alvo, totalMs, null);
      const eng = new PixiParticleEngine(canvas, adapted, {...emPos});
      eng._spreadAngle = adapted._spreadAngle;
      return eng;
    });

    let last = t0, boom = false, raf = null;

    function loop(ts) {
      const dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;
      const elapsed = ts - t0;
      const t = Math.min(elapsed / totalMs, 1);

      // Bézier quadrática: arco suave proporcional à distância
      const dx = alvo.x - origem.x, dy = alvo.y - origem.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      const arcH = Math.min(dist * 0.15, 80);
      const cx = (origem.x + alvo.x) / 2;
      const cy = Math.min(origem.y, alvo.y) - arcH;

      emPos.x = (1-t)*(1-t)*origem.x + 2*(1-t)*t*cx + t*t*alvo.x;
      emPos.y = (1-t)*(1-t)*origem.y + 2*(1-t)*t*cy + t*t*alvo.y;

      // Tangente da curva no ponto atual
      const nt = Math.min(t + 0.02, 1);
      const tnx = (1-nt)*(1-nt)*origem.x + 2*(1-nt)*nt*cx + nt*nt*alvo.x;
      const tny = (1-nt)*(1-nt)*origem.y + 2*(1-nt)*nt*cy + nt*nt*alvo.y;
      const tangAngle = Math.atan2(tny - emPos.y, tnx - emPos.x);

      // Burst de impacto ao chegar no alvo
      if (t >= 0.88 && !boom) {
        boom = true;
        engines.forEach(eng => {
          eng.emitterLifetime  = eng.time + 0.45;
          eng.frequency        = Math.max(eng.frequency * 0.35, 0.002);
          eng.maxParticles     = Math.min(eng.maxParticles * 2, 350);
          eng.particlesPerWave = 3;
          // Burst em todas as direções
          eng.rotMin      = 0;
          eng.rotMax      = Math.PI * 2;
          eng.speedStart  = eng.speedStart * 1.6;
        });
      }

      // Atualizar posição e direção de cada engine
      engines.forEach(eng => {
        eng.pos    = {...emPos};
        eng.rotMin = tangAngle - eng._spreadAngle;
        eng.rotMax = tangAngle + eng._spreadAngle;
        eng.update(dt);
      });

      // Renderizar: limpar uma vez, depois cada camada sem limpar
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      engines.forEach(eng => eng.drawNoClear());

      if (elapsed < totalMs + 700) {
        raf = requestAnimationFrame(loop);
      } else {
        engines.forEach(e => e.stop());
        canvas.remove();
        resolve();
      }
    }

    raf = requestAnimationFrame(loop);
  }

  // ── abrirModalSkill patch ─────────────────────────────────────────────
  const _origAbrir = window.abrirModalSkill;

  function _populatePixiFields() {
    const sid = document.getElementById('modal-skill-id')?.value;
    if (!sid) return false;
    const sk = (window.RPG_DATA?.skills||[]).find(s=>String(s.id)===String(sid));
    const anim = sk?.animacao;
    if (!anim || (anim.tipo !== PIXI_TYPE && anim.tipo !== 'pixi')) return false;

    _injetarUI();

    const tipoEl = document.getElementById('sk-anim-tipo');
    if (tipoEl && tipoEl.value !== PIXI_TYPE) {
      tipoEl.value = PIXI_TYPE;
      if (typeof window.skAnimTipoChange === 'function') window.skAnimTipoChange();
    }
    const pixi = document.getElementById('sk-anim-campos-pixi');
    if (pixi) pixi.style.display = '';

    const jEl = document.getElementById('sk-anim-pixi-json');
    const pEl = document.getElementById('sk-anim-pixi-posicao');
    const dEl = document.getElementById('sk-anim-pixi-duracao');
    const rEl = document.getElementById('sk-anim-pixi-repeticao');
    if (jEl) jEl.value = anim.pixi_config ? JSON.stringify(anim.pixi_config, null, 2) : '';
    if (pEl) pEl.value = anim.posicao   || 'alvo';
    if (dEl) dEl.value = anim.duracao   || 1500;
    if (rEl) rEl.value = anim.repeticao || 1;
    return true;
  }

  window.abrirModalSkill = function (...args) {
    _injetarUI();
    if (typeof _origAbrir === 'function') _origAbrir.apply(this, args);
    _populatePixiFields();
  };

  // ── Init ──────────────────────────────────────────────────────────────
  function _init() {
    _injetarUI();
    const ov=document.getElementById('modal-skill-overlay');
    if(ov) new MutationObserver(()=>{ if(ov.style.display!=='none') _injetarUI(); }).observe(ov,{attributes:true,attributeFilter:['style']});
    console.log('✓ Pixi Particles Plugin v5 ativo — multi-layer trajetória');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',_init);
  else setTimeout(_init,800);

})();

// ============================================================
// OBSERVADOR DE TOKENS: Ajuste automático no mobile
// ============================================================

function _ajustarTokensMobile() {
  if (!_isMobile()) return;
  const tokens = document.querySelectorAll('.mapa-token[data-nome]');
  tokens.forEach(el => {
    const nome = el.dataset.nome;
    const cached = _getMobileSize(nome);
    if (cached === null) return;
    const baseTamanho = parseFloat(el.dataset.baseTamanho || '1');
    el.style.transform = `translate(-50%,-50%) scale(${(cached / baseTamanho).toFixed(3)})`;
  });
}

function _observarTokens() {
  const wrap = document.getElementById('mapa-wrap');
  if (!wrap) return;
  const obs = new MutationObserver(() => _ajustarTokensMobile());
  obs.observe(wrap, { childList: true, subtree: true });
}

function _initPatchMobile() {
  _observarTokens();
  // Aplicar imediatamente se já houver tokens na tela
  _ajustarTokensMobile();
  console.log('✓ Patch: tamanho mobile + fix distorção ativo');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initPatchMobile);
} else {
  setTimeout(_initPatchMobile, 500);
}
// ============================================================
// 🎬 ANIM REGISTRY — Sistema Universal de Animações v1
//    Compatível com o Pixi Particles Plugin existente.
//    Adiciona 28 tipos + IA com prompt unificado.
// ============================================================

(function () {
  'use strict';

  // ── Helpers internos ──────────────────────────────────────
  function mkCv(z) {
    const c = document.createElement('canvas');
    c.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:${z || 8888};width:100vw;height:100vh`;
    c.width = innerWidth; c.height = innerHeight;
    document.body.appendChild(c);
    return c;
  }
  function ctr(el) {
    if (!el) return { x: innerWidth / 2, y: innerHeight / 2 };
    if (typeof window._animCentro === 'function') return window._animCentro(el);
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  const lp  = (a, b, t) => a + (b - a) * t;
  const cl  = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
  const rd  = (mn, mx) => mn + Math.random() * (mx - mn);
  function h2r(h) {
    const s = h.replace('#', '');
    if (s.length === 3) return [parseInt(s[0]+s[0],16),parseInt(s[1]+s[1],16),parseInt(s[2]+s[2],16)];
    return [parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)];
  }
  function rgba(hex, a) { const [r,g,b] = h2r(hex); return `rgba(${r},${g},${b},${cl(a,0,1)})`; }

  // ── Registro central ──────────────────────────────────────
  const _reg = {};
  window.AnimRegistry = {
    register(tipo, fn) { _reg[tipo] = fn; },
    has(tipo) { return !!_reg[tipo]; },
    dispatch(anim, atacEl, alvoEl) {
      const tipo = anim?.tipo;
      const orig = ctr(atacEl), alvo = ctr(alvoEl);
      if (_reg[tipo]) return _reg[tipo](anim, orig, alvo);
      return Promise.resolve();
    }
  };

  // ── Patch: animarAtaque usa o registry antes do fallback ─
  const _origAnimar = window.animarAtaque;
  window.animarAtaque = function ({ atacEl, alvoEl, animacao, dano }) {
    const tipo = animacao?.tipo;
    if (tipo && tipo !== 'nenhuma' && tipo !== 'canvas' && tipo !== 'midia' &&
        tipo !== 'pixi_particles' && tipo !== 'pixi' && _reg[tipo]) {
      return AnimRegistry.dispatch(animacao, atacEl, alvoEl);
    }
    return typeof _origAnimar === 'function'
      ? _origAnimar.call(this, { atacEl, alvoEl, animacao, dano })
      : Promise.resolve();
  };

  // ==========================================================
  //  RUNNERS
  // ==========================================================

  // ── 01. SLASH ────────────────────────────────────────────
  _reg['slash'] = (anim, orig, alvo) => new Promise(res => {
    const c = mkCv(8890), ctx = c.getContext('2d');
    const cx = alvo.x, cy = alvo.y;
    const cor = anim.cor || '#e8e8ff';
    const qtd = anim.quantidade || 1;
    const abertura = (anim.abertura || 80) * Math.PI / 180;
    const angBase = anim.angulo != null
      ? anim.angulo * Math.PI / 180
      : Math.atan2(alvo.y - orig.y, alvo.x - orig.x);
    const esp = anim.espessura || 3;
    const dur = anim.duracao || 320;
    const comp = anim.comprimento || 130;
    const cor2 = anim.cor2 || '#ffffff';

    const slashes = Array.from({ length: qtd }, (_, i) => {
      const perp = angBase + Math.PI / 2;
      const off = (i - (qtd - 1) / 2) * (34 + rd(-6, 6));
      return {
        ox: cx + Math.cos(perp) * off,
        oy: cy + Math.sin(perp) * off,
        len: comp + rd(-15, 15),
        delay: i * (anim.delay_entre || 55)
      };
    });

    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0;
      ctx.clearRect(0, 0, c.width, c.height);
      slashes.forEach(sl => {
        const t = cl((el - sl.delay) / (dur * 0.55), 0, 1);
        if (t <= 0) return;
        const fade = t < 0.55 ? t / 0.55 : 1 - (t - 0.55) / 0.45;
        const a = cl(fade, 0, 1);
        const r = sl.len * 0.52;
        const sa = angBase - abertura / 2, ea = angBase + abertura / 2;
        const sx = sl.ox + Math.cos(sa) * r, sy = sl.oy + Math.sin(sa) * r;
        const ex = sl.ox + Math.cos(ea) * r, ey = sl.oy + Math.sin(ea) * r;
        const cpx = sl.ox + Math.cos(angBase) * r * 0.22;
        const cpy = sl.oy + Math.sin(angBase) * r * 0.22;
        ctx.save();
        ctx.globalAlpha = a * 0.35; ctx.strokeStyle = cor; ctx.lineWidth = esp * 5;
        ctx.lineCap = 'round'; ctx.shadowColor = cor; ctx.shadowBlur = 28;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cpx, cpy, ex, ey); ctx.stroke();
        ctx.globalAlpha = a * 0.92; ctx.lineWidth = esp; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cpx, cpy, ex, ey); ctx.stroke();
        ctx.globalAlpha = a * 0.8; ctx.strokeStyle = cor2; ctx.lineWidth = esp * 0.3; ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cpx, cpy, ex, ey); ctx.stroke();
        ctx.restore();
      });
      if (el < dur + 180) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 02. TENDRIL ──────────────────────────────────────────
  _reg['tendril'] = (anim, orig, alvo) => new Promise(res => {
    const target = anim.posicao === 'atacante' ? orig : alvo;
    const c = mkCv(8885), ctx = c.getContext('2d');
    const cx = target.x, cy = target.y;
    const cor1 = anim.cor_primaria || '#5aff2a';
    const cor2 = anim.cor_secundaria || '#c84a00';
    const dur = anim.duracao || 2500;
    const intens = anim.intensidade || 1.0;
    const nRaizes = Math.round((anim.raizes || 16) * intens);

    class Raiz {
      constructor(x, y, ang, prof) {
        this.x = x; this.y = y; this.ang = ang; this.prof = prof;
        this.maxLen = (80 + rd(0, 220 * (prof === 0 ? 1.8 : 0.7))) * intens;
        this.len = 0; this.spd = 3.5 + rd(0, 3);
        this.wob = (rd(0, 1) - 0.5) * 0.04;
        this.thick = prof === 0 ? 2.5 + rd(0, 2) : 0.8 + rd(0, 1);
        this.pts = [{ x, y }]; this.age = 0;
        this.maxAge = 120 + rd(0, 80);
        this.cor = Math.random() > 0.4 ? cor1 : cor2;
        this.spawned = false; this.op = 0;
      }
      update(arr) {
        this.age++;
        this.op = Math.min(1, this.age / 12);
        if (this.len < this.maxLen) {
          this.ang += this.wob + (rd(0, 1) - 0.5) * 0.06;
          this.x += Math.cos(this.ang) * this.spd;
          this.y += Math.sin(this.ang) * this.spd;
          this.pts.push({ x: this.x, y: this.y });
          this.len += this.spd;
          if (this.prof < 2 && this.len > this.maxLen * 0.4 && !this.spawned && Math.random() < 0.015) {
            this.spawned = true;
            for (let i = 0; i < Math.floor(1 + rd(0, 2)); i++)
              arr.push(new Raiz(this.x, this.y, this.ang + (rd(0, 1) - 0.5) * 1.2, this.prof + 1));
          }
        }
        return this.age <= this.maxAge;
      }
      draw() {
        if (this.pts.length < 2) return;
        const fade = this.age > this.maxAge * 0.7
          ? 1 - (this.age - this.maxAge * 0.7) / (this.maxAge * 0.3)
          : this.op;
        ctx.save();
        ctx.globalAlpha = Math.max(0, fade * 0.9);
        ctx.strokeStyle = this.cor;
        ctx.lineWidth = this.thick * (1 - this.len / this.maxLen * 0.5);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.shadowColor = this.cor; ctx.shadowBlur = this.prof === 0 ? 18 : 8;
        ctx.beginPath(); ctx.moveTo(this.pts[0].x, this.pts[0].y);
        for (let i = 1; i < this.pts.length; i++) ctx.lineTo(this.pts[i].x, this.pts[i].y);
        ctx.stroke(); ctx.restore();
      }
    }

    const tendrils = [], spores = [];
    for (let i = 0; i < Math.round(nRaizes * 0.55); i++)
      tendrils.push(new Raiz(cx, cy, rd(0, 1) * Math.PI * 2, 0));

    setTimeout(() => {
      for (let i = 0; i < nRaizes; i++)
        tendrils.push(new Raiz(cx, cy, (i / nRaizes) * Math.PI * 2, 0));
      for (let i = 0; i < 50 * intens; i++) {
        const a = rd(0, 1) * Math.PI * 2, spd = 0.5 + rd(0, 3.5);
        spores.push({
          x: cx + (rd(0, 1) - 0.5) * 40, y: cy + (rd(0, 1) - 0.5) * 40,
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 1,
          life: 1, decay: 0.008 + rd(0, 0.012), size: 2 + rd(0, 4), rot: rd(0, 0.3),
          col: [cor1, cor2, '#3aaa08', '#a83000'][Math.floor(rd(0, 4))]
        });
      }
    }, 380);

    const t0 = performance.now();
    (function loop() {
      ctx.clearRect(0, 0, c.width, c.height);
      for (let i = tendrils.length - 1; i >= 0; i--) {
        if (!tendrils[i].update(tendrils)) tendrils.splice(i, 1);
        else tendrils[i].draw();
      }
      for (let i = spores.length - 1; i >= 0; i--) {
        const s = spores[i];
        s.x += s.vx; s.y += s.vy; s.vy += 0.04; s.vx *= 0.99;
        s.life -= s.decay; s.rot += 0.05;
        if (s.life <= 0) { spores.splice(i, 1); continue; }
        ctx.save(); ctx.globalAlpha = s.life * 0.85;
        ctx.translate(s.x, s.y); ctx.rotate(s.rot);
        ctx.fillStyle = s.col; ctx.shadowColor = s.col; ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(0, -s.size); ctx.lineTo(s.size * 0.4, 0); ctx.lineTo(0, s.size); ctx.lineTo(-s.size * 0.4, 0);
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      if (performance.now() - t0 < dur + 600) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })();
  });

  // ── 03. SHOCKWAVE ─────────────────────────────────────────
  _reg['shockwave'] = (anim, orig, alvo) => new Promise(res => {
    const target = anim.posicao === 'atacante' ? orig : alvo;
    const c = mkCv(8889), ctx = c.getContext('2d');
    const cx = target.x, cy = target.y;
    const cores = anim.cores || ['#ffffff', rgba('#ffffff', 0.5)];
    const aneis = anim.aneis || 2;
    const dur = anim.duracao || 800;
    const maxR = anim.raio_max || 260;
    const waves = Array.from({ length: aneis }, (_, i) => ({
      delay: i * dur * 0.2, cor: cores[i % cores.length], maxR: maxR * (1 - i * 0.1)
    }));
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0;
      ctx.clearRect(0, 0, c.width, c.height);
      waves.forEach(w => {
        const t = cl((el - w.delay) / dur, 0, 1);
        if (t <= 0) return;
        const r = w.maxR * Math.pow(t, 0.55);
        const a = (1 - t) * 0.65;
        ctx.save(); ctx.globalAlpha = a;
        ctx.strokeStyle = w.cor; ctx.lineWidth = 3.5 * (1 - t);
        ctx.shadowColor = w.cor; ctx.shadowBlur = 35;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = a * 0.35; ctx.lineWidth = 10 * (1 - t);
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      });
      if (el < dur + 200) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 04. BEAM ──────────────────────────────────────────────
  _reg['beam'] = (anim, orig, alvo) => new Promise(res => {
    const c = mkCv(8887), ctx = c.getContext('2d');
    const cor = anim.cor || '#88ccff';
    const cor2 = anim.cor2 || '#ffffff';
    const esp = anim.espessura || 7;
    const dur = anim.duracao || 600;
    const pulsar = anim.pulsar !== false;
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      const fi = Math.min(1, t * 6), fo = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      const alpha = fi * fo;
      const pf = pulsar ? 1 + Math.sin(el * 0.022) * 0.14 : 1;
      ctx.clearRect(0, 0, c.width, c.height);
      if (alpha > 0) {
        ctx.save(); ctx.lineCap = 'round';
        ctx.globalAlpha = alpha * 0.25; ctx.strokeStyle = cor;
        ctx.lineWidth = esp * 5 * pf; ctx.shadowColor = cor; ctx.shadowBlur = 50;
        ctx.beginPath(); ctx.moveTo(orig.x, orig.y); ctx.lineTo(alvo.x, alvo.y); ctx.stroke();
        ctx.globalAlpha = alpha * 0.85; ctx.lineWidth = esp * pf; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.moveTo(orig.x, orig.y); ctx.lineTo(alvo.x, alvo.y); ctx.stroke();
        ctx.globalAlpha = alpha; ctx.strokeStyle = cor2; ctx.lineWidth = esp * 0.3 * pf; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.moveTo(orig.x, orig.y); ctx.lineTo(alvo.x, alvo.y); ctx.stroke();
        ctx.restore();
      }
      if (el < dur + 80) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 05. ARC_LIGHTNING ────────────────────────────────────
  _reg['arc_lightning'] = (anim, orig, alvo) => new Promise(res => {
    const c = mkCv(8891), ctx = c.getContext('2d');
    const cor = anim.cor || '#aaffff';
    const dur = anim.duracao || 500;
    const segs = anim.segmentos || 12;
    const desl = anim.deslocamento || 42;
    let lastDraw = 0;

    function drawBolt(x1, y1, x2, y2, d, depth) {
      const pts = [{ x: x1, y: y1 }];
      const dx = (x2 - x1) / d, dy = (y2 - y1) / d;
      for (let i = 1; i < d; i++) {
        const nx = x1 + dx * i + (rd(0, 1) - 0.5) * desl;
        const ny = y1 + dy * i + (rd(0, 1) - 0.5) * desl;
        pts.push({ x: nx, y: ny });
        if (depth < 1 && Math.random() < 0.22 && i > 2 && i < d - 2) {
          const ba = Math.atan2(y2 - y1, x2 - x1) + (rd(0, 1) - 0.5) * 1.1;
          const bl = Math.sqrt((x2-x1)**2+(y2-y1)**2) * rd(0.2, 0.45);
          drawBolt(nx, ny, nx + Math.cos(ba) * bl, ny + Math.sin(ba) * bl, Math.max(3, d >> 1), depth + 1);
        }
      }
      pts.push({ x: x2, y: y2 });
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
    }

    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      const alpha = t < 0.15 ? t / 0.15 : t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
      if (ts - lastDraw > 38) {
        lastDraw = ts;
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.save(); ctx.lineCap = 'round';
        ctx.globalAlpha = alpha * 0.18; ctx.strokeStyle = cor; ctx.lineWidth = 10;
        ctx.shadowColor = cor; ctx.shadowBlur = 35;
        drawBolt(orig.x, orig.y, alvo.x, alvo.y, segs, 0);
        ctx.globalAlpha = alpha * 0.88; ctx.lineWidth = 2.5; ctx.shadowBlur = 14;
        drawBolt(orig.x, orig.y, alvo.x, alvo.y, segs, 0);
        ctx.globalAlpha = alpha; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.shadowBlur = 5;
        drawBolt(orig.x, orig.y, alvo.x, alvo.y, segs >> 1, 0);
        ctx.restore();
      }
      if (el < dur) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 06. EXPLOSION ────────────────────────────────────────
  _reg['explosion'] = (anim, orig, alvo) => new Promise(res => {
    const c = mkCv(8889), ctx = c.getContext('2d');
    const cx = alvo.x, cy = alvo.y;
    const cor1 = anim.cor1 || '#ff6600';
    const cor2 = anim.cor2 || '#ffcc00';
    const cor3 = anim.cor3 || '#ff2200';
    const tam = anim.tamanho || 130;
    const dur = anim.duracao || 850;
    const debris = Array.from({ length: anim.debris || 35 }, () => {
      const a = rd(0, 1) * Math.PI * 2, spd = rd(2, 9) * tam / 130;
      return {
        x: cx, y: cy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - rd(1, 4),
        size: rd(2, 9), life: 1, decay: 0.014 + rd(0, 0.018),
        col: [cor1, cor2, cor3, '#ffffff', '#ffeeaa'][Math.floor(rd(0, 5))]
      };
    });
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      ctx.clearRect(0, 0, c.width, c.height);
      if (t < 0.13) {
        ctx.save(); ctx.globalAlpha = (0.13 - t) / 0.13 * 0.72;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); ctx.restore();
      }
      const r = tam * Math.min(t * 2.8, 1) * (t < 0.28 ? 1 : Math.max(0, 1 - (t - 0.28) / 0.72));
      if (r > 1) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, rgba(cor2, 0.95)); g.addColorStop(0.38, rgba(cor1, 0.75));
        g.addColorStop(0.75, rgba(cor3, 0.35)); g.addColorStop(1, rgba(cor3, 0));
        ctx.save(); ctx.globalAlpha = cl(1 - t * 0.75, 0, 1);
        ctx.fillStyle = g; ctx.shadowColor = cor1; ctx.shadowBlur = 50;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      debris.forEach(d => {
        d.x += d.vx; d.y += d.vy; d.vy += 0.18; d.vx *= 0.978;
        d.life -= d.decay; d.size *= 0.983;
        if (d.life <= 0) return;
        ctx.save(); ctx.globalAlpha = d.life * 0.92;
        ctx.fillStyle = d.col; ctx.shadowColor = d.col; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
      if (el < dur + 350) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 07. IMPLOSION ────────────────────────────────────────
  _reg['implosion'] = (anim, orig, alvo) => new Promise(res => {
    const c = mkCv(8889), ctx = c.getContext('2d');
    const cx = alvo.x, cy = alvo.y;
    const cor = anim.cor || '#aa00ff';
    const dur = anim.duracao || 700;
    const parts = Array.from({ length: anim.particulas || 65 }, () => {
      const a = rd(0, 1) * Math.PI * 2, r = rd(70, 210);
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, size: rd(2, 6), delay: rd(0, 0.35) };
    });
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      ctx.clearRect(0, 0, c.width, c.height);
      parts.forEach(p => {
        const pt = cl((t - p.delay) / (1 - p.delay), 0, 1);
        if (pt <= 0) return;
        const ease = 1 - Math.pow(1 - pt, 3);
        const px = lp(p.x, cx, ease), py = lp(p.y, cy, ease);
        ctx.save(); ctx.globalAlpha = (1 - pt) * 0.88;
        ctx.fillStyle = cor; ctx.shadowColor = cor; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(px, py, p.size * (1 - ease * 0.65), 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
      if (t > 0.84) {
        const ft = (t - 0.84) / 0.16;
        ctx.save(); ctx.globalAlpha = (1 - ft) * 0.65;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 65 * (1 - ft));
        g.addColorStop(0, rgba(cor, 1)); g.addColorStop(1, rgba(cor, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, 65 * (1 - ft), 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      if (el < dur + 80) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 08. CRYSTALLIZE ───────────────────────────────────────
  _reg['crystallize'] = (anim, orig, alvo) => new Promise(res => {
    const c = mkCv(8888), ctx = c.getContext('2d');
    const cx = alvo.x, cy = alvo.y;
    const cor = anim.cor || '#aaddff';
    const cor2 = anim.cor2 || '#ffffff';
    const dur = anim.duracao || 1300;
    const cristais = Array.from({ length: anim.cristais || 14 }, (_, i) => ({
      ang: (i / (anim.cristais || 14)) * Math.PI * 2 + rd(-0.18, 0.18),
      dist: rd(18, 58), alt: rd(28, 82), larg: rd(6, 18),
      delay: rd(0, 0.35), cor: Math.random() > 0.3 ? cor : cor2
    }));
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      ctx.clearRect(0, 0, c.width, c.height);
      cristais.forEach(cr => {
        const ct = cl((t - cr.delay) / 0.48, 0, 1);
        const fade = ct < 0.68 ? 1 : 1 - (ct - 0.68) / 0.32;
        if (ct <= 0 || fade <= 0) return;
        const grow = 1 - Math.pow(1 - ct, 2.2);
        const h = cr.alt * grow;
        const bx = cx + Math.cos(cr.ang) * cr.dist, by = cy + Math.sin(cr.ang) * cr.dist;
        const tx = bx + Math.cos(cr.ang) * h, ty = by + Math.sin(cr.ang) * h;
        const perp = cr.ang + Math.PI / 2;
        const hw = cr.larg * 0.5 * (1 - grow * 0.45);
        ctx.save(); ctx.globalAlpha = fade * 0.92;
        ctx.strokeStyle = cr.cor; ctx.fillStyle = rgba(cr.cor, 0.38);
        ctx.shadowColor = cr.cor; ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(bx + Math.cos(perp) * hw, by + Math.sin(perp) * hw);
        ctx.lineTo(bx - Math.cos(perp) * hw, by - Math.sin(perp) * hw);
        ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      });
      if (el < dur + 200) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 09. GROUND_CRACK ──────────────────────────────────────
  _reg['ground_crack'] = (anim, orig, alvo) => new Promise(res => {
    const c = mkCv(8884), ctx = c.getContext('2d');
    const cx = alvo.x, cy = alvo.y;
    const cor = anim.cor || '#5aff2a';
    const nR = anim.quantidade || 11;
    const dur = anim.duracao || 1600;
    const maxD = anim.distancia || 190;
    const cracks = Array.from({ length: nR }, (_, i) => {
      const a = (i / nR) * Math.PI * 2 + rd(-0.28, 0.28);
      const segs = 4 + Math.floor(rd(0, 4));
      const pts = [{ x: cx + Math.cos(a) * 18, y: cy + Math.sin(a) * 18 }];
      let px = pts[0].x, py = pts[0].y;
      for (let s = 0; s < segs; s++) {
        const da = a + (rd(0, 1) - 0.5) * 0.75;
        px += Math.cos(da) * (maxD / segs) * rd(0.7, 1.3);
        py += Math.sin(da) * (maxD / segs) * rd(0.25, 0.4);
        pts.push({ x: px, y: py });
      }
      return { pts, delay: rd(0, 0.28) };
    });
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      ctx.clearRect(0, 0, c.width, c.height);
      cracks.forEach(cr => {
        const ct = cl((t - cr.delay) / 0.45, 0, 1);
        const fade = t > 0.62 ? 1 - (t - 0.62) / 0.38 : 1;
        if (ct <= 0 || fade <= 0) return;
        const visS = Math.floor(ct * (cr.pts.length - 1));
        ctx.save(); ctx.globalAlpha = fade * 0.82;
        ctx.strokeStyle = cor; ctx.lineWidth = 1.8;
        ctx.shadowColor = cor; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(cr.pts[0].x, cr.pts[0].y);
        for (let i = 1; i <= visS && i < cr.pts.length; i++) ctx.lineTo(cr.pts[i].x, cr.pts[i].y);
        ctx.stroke(); ctx.restore();
      });
      if (el < dur) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 10. PILLAR ────────────────────────────────────────────
  _reg['pillar'] = (anim, orig, alvo) => new Promise(res => {
    const c = mkCv(8888), ctx = c.getContext('2d');
    const cx = alvo.x, cy = alvo.y;
    const cor = anim.cor || '#ffeeaa';
    const cor2 = anim.cor2 || '#ffffff';
    const larg = anim.largura || 65;
    const alt = anim.altura || 320;
    const dur = anim.duracao || 1100;
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      const fi = Math.min(1, t * 4.5), fo = t > 0.5 ? 1 - (t - 0.5) / 0.5 : 1;
      const alpha = fi * fo;
      const pulse = 1 + Math.sin(el * 0.018) * 0.09;
      ctx.clearRect(0, 0, c.width, c.height);
      if (alpha > 0) {
        ctx.save();
        const g = ctx.createLinearGradient(cx, cy - alt, cx, cy + 28);
        g.addColorStop(0, rgba(cor, 0)); g.addColorStop(0.38, rgba(cor, 0.62 * alpha));
        g.addColorStop(0.82, rgba(cor2, 0.92 * alpha)); g.addColorStop(1, rgba(cor, 0));
        ctx.shadowColor = cor; ctx.shadowBlur = 45;
        ctx.fillStyle = g;
        ctx.fillRect(cx - larg * pulse / 2, cy - alt, larg * pulse, alt + 28);
        const g2 = ctx.createLinearGradient(cx, cy - alt, cx, cy);
        g2.addColorStop(0, rgba(cor2, 0)); g2.addColorStop(0.55, rgba(cor2, 0.72 * alpha));
        g2.addColorStop(1, rgba(cor2, 0.38 * alpha));
        ctx.fillStyle = g2;
        ctx.fillRect(cx - larg * 0.18 * pulse / 2, cy - alt, larg * 0.18 * pulse, alt);
        ctx.restore();
      }
      if (el < dur) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 11. VORTEX ────────────────────────────────────────────
  _reg['vortex'] = (anim, orig, alvo) => new Promise(res => {
    const target = anim.posicao === 'atacante' ? orig : alvo;
    const c = mkCv(8888), ctx = c.getContext('2d');
    const cx = target.x, cy = target.y;
    const cor = anim.cor || '#aa00ff';
    const dur = anim.duracao || 1300;
    const bracos = anim.bracos || 3;
    const voltas = anim.voltas || 2.5;
    const parts = Array.from({ length: 85 }, () => ({
      ang: rd(0, Math.PI * 2), r: rd(20, 155),
      spd: rd(0.018, 0.058) * (Math.random() > 0.5 ? 1 : -1),
      size: rd(2, 5), life: rd(0, 1)
    }));
    const t0 = performance.now(); let rot = 0;
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
      rot += 0.038;
      ctx.clearRect(0, 0, c.width, c.height);
      for (let b = 0; b < bracos; b++) {
        const baseA = rot + (b / bracos) * Math.PI * 2;
        ctx.save(); ctx.globalAlpha = alpha * 0.72;
        ctx.strokeStyle = cor; ctx.lineWidth = 2;
        ctx.shadowColor = cor; ctx.shadowBlur = 18;
        ctx.beginPath();
        for (let i = 0; i < 100; i++) {
          const ft = i / 100, r = ft * 145;
          const a = baseA + ft * Math.PI * 2 * voltas;
          const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke(); ctx.restore();
      }
      parts.forEach(p => {
        p.ang += p.spd; p.r = Math.max(0, p.r - Math.abs(p.spd) * 55 * 0.016);
        p.life += 0.018; if (p.life > 1) { p.life = 0; p.r = rd(80, 185); }
        const px = cx + Math.cos(rot * 3 + p.ang) * p.r;
        const py = cy + Math.sin(rot * 3 + p.ang) * p.r;
        ctx.save(); ctx.globalAlpha = p.life * alpha * 0.85;
        ctx.fillStyle = cor; ctx.shadowColor = cor; ctx.shadowBlur = 9;
        ctx.beginPath(); ctx.arc(px, py, p.size * (p.r / 155), 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
      if (el < dur) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 12. CHARGE_UP ─────────────────────────────────────────
  _reg['charge_up'] = (anim, orig, alvo) => new Promise(res => {
    const c = mkCv(8892), ctx = c.getContext('2d');
    const cx = orig.x, cy = orig.y;
    const cor = anim.cor || '#ffff00';
    const dur = anim.duracao || 900;
    const parts = Array.from({ length: anim.particulas || 55 }, () => {
      const a = rd(0, 1) * Math.PI * 2, r = rd(65, 215);
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, ang: a, r, size: rd(2, 5.5), delay: rd(0, 0.55) };
    });
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      ctx.clearRect(0, 0, c.width, c.height);
      parts.forEach(p => {
        const pt = cl((t - p.delay) / (1 - p.delay), 0, 1);
        if (pt <= 0) return;
        const ease = Math.pow(pt, 2.2);
        const curR = p.r * (1 - ease);
        const px = cx + Math.cos(p.ang) * curR, py = cy + Math.sin(p.ang) * curR;
        ctx.save(); ctx.globalAlpha = pt * 0.92;
        ctx.fillStyle = cor; ctx.shadowColor = cor; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
      const auraR = 22 * (1 + Math.sin(el * 0.014) * 0.28) * Math.min(1, t * 3.2);
      if (auraR > 0) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        g.addColorStop(0, rgba(cor, 0.85 * Math.min(1, t * 5)));
        g.addColorStop(1, rgba(cor, 0));
        ctx.save(); ctx.fillStyle = g; ctx.shadowColor = cor; ctx.shadowBlur = 32;
        ctx.beginPath(); ctx.arc(cx, cy, auraR, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      if (el < dur) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 13. AURA_PULSE ────────────────────────────────────────
  _reg['aura_pulse'] = (anim, orig, alvo) => new Promise(res => {
    const target = anim.posicao === 'alvo' ? alvo : orig;
    const c = mkCv(8886), ctx = c.getContext('2d');
    const cx = target.x, cy = target.y;
    const cor = anim.cor || '#44ffaa';
    const pulsos = anim.pulsos || 3;
    const dur = anim.duracao || 1600;
    const raioMax = anim.raio || 108;
    const waves = Array.from({ length: pulsos }, (_, i) => ({ delay: i * (dur / pulsos) }));
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0;
      ctx.clearRect(0, 0, c.width, c.height);
      waves.forEach(w => {
        const wt = cl((el - w.delay) / (dur * 0.58), 0, 1);
        if (wt <= 0) return;
        const r = raioMax * wt, a = (1 - wt) * 0.72;
        ctx.save(); ctx.globalAlpha = a;
        ctx.strokeStyle = cor; ctx.lineWidth = 3.5 * (1 - wt);
        ctx.shadowColor = cor; ctx.shadowBlur = 28;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, rgba(cor, 0.12 * (1 - wt))); g.addColorStop(1, rgba(cor, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      if (el < dur + 200) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 14. SHAKE ─────────────────────────────────────────────
  _reg['shake'] = (anim, orig, alvo) => new Promise(res => {
    const dur = anim.duracao || 420;
    const intens = anim.intensidade || 9;
    const el = document.getElementById('mapa-wrap') || document.body;
    const origT = el.style.transform || '';
    const t0 = performance.now();
    (function loop(ts) {
      const elapsed = ts - t0, t = elapsed / dur;
      const f = anim.decaimento !== false ? 1 - t : 1;
      el.style.transform = `translate(${(rd(0, 1) - 0.5) * intens * 2 * f}px,${(rd(0, 1) - 0.5) * intens * 2 * f}px)`;
      if (elapsed < dur) requestAnimationFrame(loop);
      else { el.style.transform = origT; res(); }
    })(t0);
  });

  // ── 15. FLASH ─────────────────────────────────────────────
  _reg['flash'] = (anim, orig, alvo) => new Promise(res => {
    const c = mkCv(9000), ctx = c.getContext('2d');
    const cor = anim.cor || '#ffffff';
    const dur = anim.duracao || 300;
    const alphaMax = anim.intensidade || 0.52;
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      const a = t < 0.18 ? t / 0.18 * alphaMax : (1 - (t - 0.18) / 0.82) * alphaMax;
      ctx.clearRect(0, 0, c.width, c.height);
      if (a > 0) { ctx.fillStyle = rgba(cor, Math.max(0, a)); ctx.fillRect(0, 0, c.width, c.height); }
      if (el < dur) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 16. ZOOM_PUNCH ────────────────────────────────────────
  _reg['zoom_punch'] = (anim, orig, alvo) => new Promise(res => {
    const dur = anim.duracao || 360;
    const intens = anim.intensidade || 1.09;
    const wrap = document.getElementById('mapa-wrap') || document.body;
    const origTO = wrap.style.transformOrigin;
    const origTr = wrap.style.transform || '';
    wrap.style.transformOrigin = `${alvo.x}px ${alvo.y}px`;
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      const sc = t < 0.28 ? 1 + (intens - 1) * (t / 0.28) : 1 + (intens - 1) * (1 - (t - 0.28) / 0.72);
      wrap.style.transform = `scale(${Math.max(1, sc)})`;
      if (el < dur) requestAnimationFrame(loop);
      else { wrap.style.transform = origTr; wrap.style.transformOrigin = origTO || ''; res(); }
    })(t0);
  });

  // ── 17. SCREEN_CRACK ──────────────────────────────────────
  _reg['screen_crack'] = (anim, orig, alvo) => new Promise(res => {
    const c = mkCv(9001), ctx = c.getContext('2d');
    const cx = alvo.x, cy = alvo.y;
    const cor = anim.cor || '#ffffff';
    const dur = anim.duracao || 900;
    const cracks = Array.from({ length: anim.quantidade || 7 }, (_, i) => {
      const a = (i / (anim.quantidade || 7)) * Math.PI * 2 + rd(-0.38, 0.38);
      const pts = [{ x: cx, y: cy }];
      let px = cx, py = cy;
      for (let s = 0; s < 5 + Math.floor(rd(0, 4)); s++) {
        px += Math.cos(a + (rd(0, 1) - 0.5) * 0.55) * (rd(75, 215) / 6);
        py += Math.sin(a + (rd(0, 1) - 0.5) * 0.55) * (rd(75, 215) / 6);
        pts.push({ x: px, y: py });
      }
      return { pts };
    });
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.68 ? 1 - (t - 0.68) / 0.32 : 1;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.save(); ctx.globalAlpha = alpha * 0.88;
      ctx.strokeStyle = cor; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.shadowColor = cor; ctx.shadowBlur = 10;
      cracks.forEach(cr => {
        ctx.beginPath(); ctx.moveTo(cr.pts[0].x, cr.pts[0].y);
        cr.pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
      });
      ctx.restore();
      if (el < dur) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 18. FLOATING_TEXT ─────────────────────────────────────
  _reg['floating_text'] = (anim, orig, alvo) => new Promise(res => {
    const c = mkCv(9002), ctx = c.getContext('2d');
    const texto = anim.texto || 'CRÍTICO!';
    const cor = anim.cor || '#ffdd00';
    const cor2 = anim.cor2 || '#ff8800';
    const tam = anim.tamanho || 34;
    const dur = anim.duracao || 1300;
    let x = alvo.x, y = alvo.y - 20;
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      y -= 1.8 * (1 - Math.pow(t, 1.8));
      const scale = t < 0.14 ? t / 0.14 : t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.62 ? 1 - (t - 0.62) / 0.38 : 1;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.save(); ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = `bold ${tam * scale}px 'Cinzel','Georgia',serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
        ctx.fillStyle = '#000000'; ctx.fillText(texto, x + dx, y + dy);
      }
      ctx.fillStyle = cor; ctx.shadowColor = cor; ctx.shadowBlur = 22;
      ctx.fillText(texto, x, y);
      ctx.fillStyle = cor2; ctx.shadowBlur = 6; ctx.fillText(texto, x, y);
      ctx.restore();
      if (el < dur) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 19. RUNE_CIRCLE ───────────────────────────────────────
  _reg['rune_circle'] = (anim, orig, alvo) => new Promise(res => {
    const target = anim.posicao === 'atacante' ? orig : alvo;
    const c = mkCv(8886), ctx = c.getContext('2d');
    const cx = target.x, cy = target.y;
    const cor = anim.cor || '#ffdd44';
    const raio = anim.raio || 82;
    const dur = anim.duracao || 2100;
    const nRunas = anim.runas || 8;
    const giros = anim.giros || 1.2;
    const runas = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'.split('');
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      const alpha = t < 0.14 ? t / 0.14 : t > 0.76 ? 1 - (t - 0.76) / 0.24 : 1;
      const rot = el * 0.001 * Math.PI * 2 * giros;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.save(); ctx.globalAlpha = alpha * 0.92;
      ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.shadowColor = cor; ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.arc(cx, cy, raio, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, raio * 0.72, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = cor; ctx.font = '13px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < nRunas; i++) {
        const a = (i / nRunas) * Math.PI * 2 + rot;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * raio, cy + Math.sin(a) * raio);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillText(runas[i % runas.length], 0, 0);
        ctx.restore();
      }
      for (let i = 0; i < nRunas / 2; i++) {
        const a1 = (i / (nRunas / 2)) * Math.PI * 2 + rot;
        const a2 = a1 + Math.PI + Math.sin(el * 0.002 + i) * 0.48;
        ctx.globalAlpha = alpha * 0.28; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a1) * raio * 0.72, cy + Math.sin(a1) * raio * 0.72);
        ctx.lineTo(cx + Math.cos(a2) * raio * 0.72, cy + Math.sin(a2) * raio * 0.72);
        ctx.stroke();
      }
      ctx.restore();
      if (el < dur) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 20. AREA_PULSE ────────────────────────────────────────
  _reg['area_pulse'] = (anim, orig, alvo) => new Promise(res => {
    const target = { x: (orig.x + alvo.x) / 2, y: (orig.y + alvo.y) / 2 };
    const c = mkCv(8885), ctx = c.getContext('2d');
    const cx = target.x, cy = target.y;
    const cor = anim.cor || '#ff4400';
    const raio = anim.raio || 155;
    const dur = anim.duracao || 1600;
    const waves = Array.from({ length: anim.pulsos || 2 }, (_, i) => ({ delay: i * (dur * 0.38) }));
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, ta = cl(el / dur, 0, 1);
      ctx.clearRect(0, 0, c.width, c.height);
      const areaA = ta < 0.18 ? ta / 0.18 : ta > 0.62 ? 1 - (ta - 0.62) / 0.38 : 1;
      if (areaA > 0) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, raio);
        g.addColorStop(0, rgba(cor, areaA * 0.18)); g.addColorStop(0.7, rgba(cor, areaA * 0.08));
        g.addColorStop(1, rgba(cor, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, raio, 0, Math.PI * 2); ctx.fill();
      }
      waves.forEach(w => {
        const wt = cl((el - w.delay) / (dur * 0.48), 0, 1);
        if (wt <= 0) return;
        const r = raio * wt, wa = (1 - wt) * 0.82;
        ctx.save(); ctx.globalAlpha = wa;
        ctx.strokeStyle = cor; ctx.lineWidth = 3.2 * (1 - wt);
        ctx.shadowColor = cor; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      });
      if (el < dur + 320) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 21. STORM ─────────────────────────────────────────────
  _reg['storm'] = (anim, orig, alvo) => new Promise(res => {
    const c = mkCv(8889), ctx = c.getContext('2d');
    const cx = alvo.x, cy = alvo.y;
    const cor = anim.cor || '#aaffff';
    const raio = anim.raio || 125;
    const dur = anim.duracao || 1900;
    const nBolts = anim.relampagos || 9;
    const bolts = [];
    let lastBolt = 0;
    const intervalo = (dur * 0.85) / nBolts;

    function addBolt() {
      const tx = cx + rd(-1, 1) * raio, ty = cy + rd(-20, 20);
      const sy = ty - rd(145, 295);
      const pts = [{ x: tx + (rd(0, 1) - 0.5) * 32, y: sy }];
      let px = pts[0].x, py = sy;
      for (let i = 1; i < 9; i++) { px += rd(-28, 28); py += (ty - sy) / 8; pts.push({ x: px, y: py }); }
      pts.push({ x: tx, y: ty });
      bolts.push({ pts, life: 1, decay: 0.038 + rd(0, 0.038) });
    }

    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0;
      if (el < dur && ts - lastBolt > intervalo) { addBolt(); lastBolt = ts; }
      ctx.clearRect(0, 0, c.width, c.height);
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i]; b.life -= b.decay;
        if (b.life <= 0) { bolts.splice(i, 1); continue; }
        ctx.save(); ctx.globalAlpha = b.life * 0.82;
        ctx.strokeStyle = cor; ctx.lineWidth = 2.8; ctx.lineCap = 'round';
        ctx.shadowColor = cor; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.moveTo(b.pts[0].x, b.pts[0].y);
        b.pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.moveTo(b.pts[0].x, b.pts[0].y);
        b.pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke(); ctx.restore();
      }
      if (el < dur + 550) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 22. GRAVITY_WELL ──────────────────────────────────────
  _reg['gravity_well'] = (anim, orig, alvo) => new Promise(res => {
    const target = { x: (orig.x + alvo.x) / 2, y: (orig.y + alvo.y) / 2 };
    const c = mkCv(8887), ctx = c.getContext('2d');
    const cx = target.x, cy = target.y;
    const cor = anim.cor || '#6600aa';
    const dur = anim.duracao || 1600;
    const raio = anim.raio || 185;
    const parts = Array.from({ length: 85 }, () => {
      const a = rd(0, 1) * Math.PI * 2, r = rd(42, raio);
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: 0, vy: 0, size: rd(1.5, 4.5) };
    });
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
      ctx.clearRect(0, 0, c.width, c.height);
      for (let ring = 1; ring <= 4; ring++) {
        const r = raio * (ring / 4) * (1 - t * 0.45);
        ctx.save(); ctx.globalAlpha = alpha * 0.14;
        ctx.strokeStyle = cor; ctx.lineWidth = 1; ctx.setLineDash([5, 10]);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      }
      parts.forEach(p => {
        const dx = cx - p.x, dy = cy - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 820 * (t + 0.18) / dist;
        p.vx += dx / dist * force * 0.016; p.vy += dy / dist * force * 0.016;
        p.x += p.vx * 0.016; p.y += p.vy * 0.016;
        ctx.save(); ctx.globalAlpha = cl(1 - dist / raio, 0.1, 1) * alpha * 0.82;
        ctx.fillStyle = cor; ctx.shadowColor = cor; ctx.shadowBlur = 9;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
      if (el < dur) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 23. MULTI_PROJECTILE ──────────────────────────────────
  _reg['multi_projectile'] = (anim, orig, alvo) => new Promise(res => {
    const c = mkCv(8888), ctx = c.getContext('2d');
    const cor = anim.cor || '#ffcc00';
    const nProj = anim.quantidade || 5;
    const abertura = (anim.abertura || 55) * Math.PI / 180;
    const dur = anim.duracao || 620;
    const tam = anim.tamanho || 8;
    const angBase = Math.atan2(alvo.y - orig.y, alvo.x - orig.x);
    const dist = Math.sqrt((alvo.x - orig.x) ** 2 + (alvo.y - orig.y) ** 2);
    const projs = Array.from({ length: nProj }, (_, i) => {
      const a = angBase + (i - (nProj - 1) / 2) * (abertura / Math.max(1, nProj - 1));
      return { x: orig.x, y: orig.y, ang: a, trail: [], delay: i * 28 };
    });
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0;
      ctx.clearRect(0, 0, c.width, c.height);
      projs.forEach(p => {
        const t = cl((el - p.delay) / dur, 0, 1);
        if (t <= 0) return;
        const ease = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
        const px = orig.x + Math.cos(p.ang) * dist * ease;
        const py = orig.y + Math.sin(p.ang) * dist * ease;
        p.trail.push({ x: px, y: py });
        if (p.trail.length > 16) p.trail.shift();
        p.trail.forEach((pt, i) => {
          const tf = i / p.trail.length;
          ctx.save(); ctx.globalAlpha = tf * 0.48;
          ctx.fillStyle = cor; ctx.shadowColor = cor; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, tam * 0.38 * tf, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        });
        const alpha = t < 0.92 ? 0.96 : 1 - (t - 0.92) / 0.08;
        ctx.save(); ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = cor; ctx.shadowColor = cor; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.arc(px, py, tam, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(px, py, tam * 0.38, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
      if (el < dur + 320) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 24. RAIN ──────────────────────────────────────────────
  _reg['rain'] = (anim, orig, alvo) => new Promise(res => {
    const c = mkCv(8888), ctx = c.getContext('2d');
    const cx = alvo.x, cy = alvo.y;
    const cor = anim.cor || '#aaddff';
    const dur = anim.duracao || 1600;
    const raio = anim.raio || 115;
    const items = [];
    let lastItem = 0;
    const intervalo = (dur * 0.78) / (anim.quantidade || 13);
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0;
      if (el < dur * 0.82 && ts - lastItem > intervalo) {
        const tx = cx + rd(-1, 1) * raio;
        items.push({ x: tx, y: cy - rd(180, 340), tx, ty: cy, vel: rd(9, 15), life: 1 });
        lastItem = ts;
      }
      ctx.clearRect(0, 0, c.width, c.height);
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.y >= it.ty) {
          it.life -= 0.07;
          if (it.life <= 0) { items.splice(i, 1); continue; }
          ctx.save(); ctx.globalAlpha = it.life * 0.72;
          ctx.strokeStyle = cor; ctx.lineWidth = 1.5;
          ctx.shadowColor = cor; ctx.shadowBlur = 10;
          for (let j = 0; j < 5; j++) {
            const a = (j / 5) * Math.PI * 2, sr = (1 - it.life) * 22;
            ctx.beginPath(); ctx.moveTo(it.tx, it.ty);
            ctx.lineTo(it.tx + Math.cos(a) * sr, it.ty + Math.sin(a) * sr * 0.42); ctx.stroke();
          }
          ctx.restore();
        } else {
          it.y += it.vel;
          ctx.save(); ctx.globalAlpha = 0.92;
          ctx.strokeStyle = cor; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
          ctx.shadowColor = cor; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.moveTo(it.x, it.y); ctx.lineTo(it.x, it.y - it.vel * 2.8); ctx.stroke(); ctx.restore();
        }
      }
      if (el < dur + 800) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 25. AFTER_IMAGE ───────────────────────────────────────
  _reg['after_image'] = (anim, orig, alvo) => new Promise(res => {
    const target = anim.posicao === 'alvo' ? alvo : orig;
    const c = mkCv(8883), ctx = c.getContext('2d');
    const cx = target.x, cy = target.y;
    const cor = anim.cor || '#4499ff';
    const dur = anim.duracao || 900;
    const nImg = anim.quantidade || 6;
    const raio = anim.raio || 32;
    const imgs = Array.from({ length: nImg }, (_, i) => {
      const a = (i / nImg) * Math.PI * 2;
      return { x: cx + Math.cos(a) * raio, y: cy + Math.sin(a) * raio, delay: i * 55 };
    });
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0;
      ctx.clearRect(0, 0, c.width, c.height);
      imgs.forEach(img => {
        const t = cl((el - img.delay) / 520, 0, 1);
        if (t <= 0) return;
        ctx.save(); ctx.globalAlpha = (1 - t) * 0.62;
        ctx.strokeStyle = cor; ctx.lineWidth = 2.2; ctx.shadowColor = cor; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.arc(img.x, img.y, 19, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = rgba(cor, 0.14);
        ctx.beginPath(); ctx.arc(img.x, img.y, 19, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
      if (el < dur) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 26. BURN_MARK ─────────────────────────────────────────
  _reg['burn_mark'] = (anim, orig, alvo) => new Promise(res => {
    const c = mkCv(8880), ctx = c.getContext('2d');
    const cx = alvo.x, cy = alvo.y;
    const cor = anim.cor || '#ff3300';
    const cor2 = anim.cor2 || '#331100';
    const raio = anim.raio || 38;
    const dur = anim.duracao || 2200;
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.58 ? 1 - (t - 0.58) / 0.42 : 1;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.save(); ctx.globalAlpha = alpha * 0.82;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, raio);
      g.addColorStop(0, rgba(cor2, 0.92)); g.addColorStop(0.58, rgba(cor, 0.52)); g.addColorStop(1, rgba(cor, 0));
      ctx.shadowColor = cor; ctx.shadowBlur = 18; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, raio, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = cor; ctx.lineWidth = 2.8;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + (rd(0, 1) - 0.5) * 0.38;
        const r1 = raio * (0.78 + rd(0, 0.18)), r2 = raio * (1.08 + rd(0, 0.14));
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke();
      }
      ctx.restore();
      if (el < dur) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 27. COMIC_PANEL ───────────────────────────────────────
  _reg['comic_panel'] = (anim, orig, alvo) => new Promise(res => {
    const c = mkCv(9003), ctx = c.getContext('2d');
    const texto = anim.texto || 'IMPACTO!';
    const cor = anim.cor || '#ffdd00';
    const corFundo = anim.cor_fundo || '#ff0000';
    const dur = anim.duracao || 640;
    const nLinhas = anim.linhas || 26;
    const cx = alvo.x, cy = alvo.y;
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      const scale = t < 0.18 ? t / 0.18 : t > 0.68 ? 1 - (t - 0.68) / 0.32 : 1;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.62 ? 1 - (t - 0.62) / 0.38 : 1;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.save(); ctx.globalAlpha = alpha;
      for (let i = 0; i < nLinhas; i++) {
        const a = (i / nLinhas) * Math.PI * 2;
        ctx.strokeStyle = i % 2 === 0 ? corFundo : rgba(corFundo, 0.52);
        ctx.lineWidth = i % 2 === 0 ? 22 : 11;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 900, cy + Math.sin(a) * 900); ctx.stroke();
      }
      ctx.globalAlpha = alpha * 0.28; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${62 * scale}px 'Impact','Arial Black',sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) {
        ctx.fillStyle = '#000'; ctx.fillText(texto, cx + dx, cy + dy);
      }
      ctx.fillStyle = cor; ctx.shadowColor = cor; ctx.shadowBlur = 22; ctx.fillText(texto, cx, cy);
      ctx.restore();
      if (el < dur) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── 28. STANCE ────────────────────────────────────────────
  _reg['stance'] = (anim, orig, alvo) => new Promise(res => {
    const target = anim.posicao === 'alvo' ? alvo : orig;
    const c = mkCv(8882), ctx = c.getContext('2d');
    const cx = target.x, cy = target.y;
    const cor = anim.cor || '#ffcc00';
    const dur = anim.duracao || 2200;
    const raio = anim.raio || 42;
    const parts = Array.from({ length: 32 }, () => ({
      ang: rd(0, Math.PI * 2), r: rd(raio * 0.7, raio * 1.2),
      spd: rd(0.012, 0.032) * (Math.random() > 0.5 ? 1 : -1),
      size: rd(2, 5), life: rd(0, 1)
    }));
    const t0 = performance.now();
    (function loop(ts) {
      const el = ts - t0, t = el / dur;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.82 ? 1 - (t - 0.82) / 0.18 : 1;
      const pulse = 1 + Math.sin(el * 0.006) * 0.1;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.save(); ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = cor; ctx.lineWidth = 2 * pulse;
      ctx.shadowColor = cor; ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.arc(cx, cy, raio * pulse, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      parts.forEach(p => {
        p.ang += p.spd; p.life += 0.018; if (p.life > 1) p.life = 0;
        const px = cx + Math.cos(p.ang) * p.r * pulse;
        const py = cy + Math.sin(p.ang) * p.r * pulse;
        ctx.save(); ctx.globalAlpha = p.life * alpha * 0.92;
        ctx.fillStyle = cor; ctx.shadowColor = cor; ctx.shadowBlur = 11;
        ctx.beginPath(); ctx.arc(px, py, p.size * p.life, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
      if (el < dur) requestAnimationFrame(loop);
      else { c.remove(); res(); }
    })(t0);
  });

  // ── META: SEQUENCE ────────────────────────────────────────
  _reg['sequence'] = async (anim, orig, alvo) => {
    for (const etapa of (anim.etapas || [])) {
      if (_reg[etapa.tipo]) await _reg[etapa.tipo](etapa, orig, alvo);
    }
  };

  // ── META: PARALLEL ────────────────────────────────────────
  _reg['parallel'] = (anim, orig, alvo) =>
    Promise.all((anim.etapas || []).filter(e => _reg[e.tipo]).map(e => _reg[e.tipo](e, orig, alvo)));

  // ── META: CONDITIONAL ─────────────────────────────────────
  _reg['conditional'] = (anim, orig, alvo) => {
    const cfg = anim.acertou ? anim.se_acertou : anim.se_errou;
    if (cfg && _reg[cfg.tipo]) return _reg[cfg.tipo](cfg, orig, alvo);
    return Promise.resolve();
  };

  // ==========================================================
  //  UI — "🎬 Animação Avançada (IA)" no modal de skill
  // ==========================================================

  const AR_TYPE = 'anim_registry';

  function _injetarARUI() {
    const sel = document.getElementById('sk-anim-tipo');
    if (sel && !sel.querySelector(`option[value="${AR_TYPE}"]`)) {
      const og = document.createElement('optgroup');
      og.label = 'Animações Avançadas (IA)';
      const op = document.createElement('option');
      op.value = AR_TYPE; op.textContent = '🎬 Animação Avançada (IA)';
      og.appendChild(op); sel.appendChild(og);
    }
    if (!document.getElementById('sk-anim-campos-ar')) {
      const ref = document.getElementById('sk-anim-campos-pixi') || document.getElementById('sk-anim-campos-midia');
      if (!ref) return;
      const div = document.createElement('div');
      div.id = 'sk-anim-campos-ar'; div.style.display = 'none';
      div.innerHTML = `
        <div class="form-group" style="margin-bottom:8px">
          <label>🎭 Descreva o efeito visual da habilidade</label>
          <textarea id="sk-ar-descricao" rows="3" placeholder="Ex: Uma espada fantasma surge do vazio, corta o ar com trilha de luz azul e some em chamas negras…" style="width:100%;box-sizing:border-box;padding:8px;background:rgba(5,8,16,0.9);border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.8rem;resize:vertical;margin-top:4px;line-height:1.5"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div class="form-group"><label>Elemento</label>
            <select id="sk-ar-elemento" style="width:100%;padding:8px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.72rem">
              <option value="auto">🎲 Auto</option>
              <option value="fogo">🔥 Fogo</option><option value="gelo">❄️ Gelo</option>
              <option value="raio">⚡ Raio</option><option value="veneno">☠️ Veneno</option>
              <option value="sagrado">✨ Sagrado</option><option value="sombra">🌑 Sombra</option>
              <option value="fisico">💥 Físico</option><option value="natureza">🌿 Natureza</option>
              <option value="arcano">🔮 Arcano</option><option value="sangue">🩸 Sangue</option>
              <option value="vento">🌪️ Vento</option><option value="terra">🪨 Terra</option>
              <option value="agua">💧 Água</option><option value="psiquico">🧠 Psíquico</option>
            </select>
          </div>
          <div class="form-group"><label>Estilo</label>
            <select id="sk-ar-estilo" style="width:100%;padding:8px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.72rem">
              <option value="auto">🎲 Auto</option>
              <option value="corte">⚔️ Corte/Espada</option>
              <option value="projétil">🏹 Projétil</option>
              <option value="explosao">💣 Explosão/AoE</option>
              <option value="invocacao">🌀 Invocação</option>
              <option value="buff">✦ Buff/Aura</option>
              <option value="cura">💚 Cura</option>
              <option value="maldição">🕷️ Maldição</option>
              <option value="teletransporte">🌫️ Teleporte</option>
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div class="form-group"><label>Intensidade</label>
            <select id="sk-ar-intensidade" style="width:100%;padding:8px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.72rem">
              <option value="sutil">🌱 Sutil</option>
              <option value="media" selected>⚡ Média</option>
              <option value="poderosa">🔥 Poderosa</option>
              <option value="epica">💫 Épica</option>
            </select>
          </div>
          <div class="form-group"><label>Duração total (ms)</label>
            <input type="number" id="sk-ar-duracao" value="1500" min="200" max="8000" step="100" style="text-align:center">
          </div>
        </div>
        <button onclick="skARGerarPrompt()" style="width:100%;padding:11px;background:linear-gradient(135deg,rgba(200,50,50,0.2),rgba(123,47,190,0.3),rgba(79,163,209,0.2));border:1px solid rgba(200,100,50,0.5);border-radius:8px;color:#f0cc6a;font-family:var(--fonte-d);font-size:0.73rem;cursor:pointer;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">
          📋 Gerar Prompt para IA
        </button>
        <div id="sk-ar-prompt-wrap" style="display:none;margin-bottom:12px">
          <div style="font-size:0.62rem;color:#7a92aa;margin-bottom:4px">Cole este prompt na sua IA externa e cole o JSON retornado no campo abaixo:</div>
          <div style="position:relative">
            <textarea id="sk-ar-prompt-out" rows="6" readonly style="width:100%;box-sizing:border-box;padding:8px;padding-right:70px;background:rgba(20,12,40,0.9);border:1px solid rgba(200,100,50,0.4);border-radius:6px;color:#f0cc6a;font-family:monospace;font-size:0.62rem;resize:vertical;line-height:1.45"></textarea>
            <button onclick="skARCopiarPrompt()" id="sk-ar-btn-copiar" style="position:absolute;top:6px;right:6px;padding:4px 10px;background:rgba(200,100,50,0.2);border:1px solid rgba(200,100,50,0.5);border-radius:4px;color:#f0cc6a;font-size:0.6rem;cursor:pointer">📋 Copiar</button>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <label style="display:flex;justify-content:space-between;align-items:center">
            <span>JSON — Animação Gerada</span>
            <button onclick="skARPreviewPlay()" style="font-size:0.6rem;padding:2px 8px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:4px;color:#c8a84b;cursor:pointer">▶ Preview</button>
          </label>
          <textarea id="sk-ar-json" rows="10" oninput="skAROnJsonChange()" placeholder='A IA gerará o JSON aqui. Você também pode colar e editar manualmente.' style="width:100%;box-sizing:border-box;padding:8px;background:rgba(5,8,16,0.9);border:1px solid rgba(200,100,50,0.3);border-radius:6px;color:#aed6f1;font-family:monospace;font-size:0.7rem;resize:vertical;margin-top:4px;line-height:1.5"></textarea>
          <div id="sk-ar-json-erro" style="display:none;font-size:0.65rem;color:#e74c3c;margin-top:4px"></div>
        </div>
        <div id="sk-ar-preview-wrap" style="display:none;background:rgba(5,8,16,0.92);border:1px solid rgba(200,100,50,0.3);border-radius:10px;padding:10px;text-align:center;margin-bottom:8px">
          <div style="font-size:0.65rem;color:var(--suave);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.08em">🎬 Preview</div>
          <canvas id="sk-ar-preview-canvas" width="320" height="140" style="max-width:100%;border-radius:6px;background:rgba(8,12,22,0.98)"></canvas>
          <button onclick="skARPreviewPlay()" style="display:block;margin:8px auto 0;padding:4px 16px;background:rgba(200,100,50,0.12);border:1px solid rgba(200,100,50,0.35);border-radius:5px;color:#e88a50;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer;text-transform:uppercase">▶ Repetir</button>
        </div>`;
      ref.parentNode.insertBefore(div, ref.nextSibling);
    }
  }

  // ── Patch skAnimTipoChange ────────────────────────────────
  const _origTC2 = window.skAnimTipoChange;
  window.skAnimTipoChange = function () {
    const tipo = document.getElementById('sk-anim-tipo')?.value;
    const arEl = document.getElementById('sk-anim-campos-ar');
    if (tipo === AR_TYPE) {
      ['sk-anim-campos-canvas','sk-anim-campos-midia','sk-anim-campos-pixi']
        .forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
      ['sk-anim-preview-wrap','sk-anim-midia-preview-wrap']
        .forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
      if (arEl) arEl.style.display = '';
    } else {
      if (arEl) arEl.style.display = 'none';
      if (typeof _origTC2 === 'function') _origTC2.call(this);
    }
  };

  // ── Gerador de Prompt para IA externa (AnimRegistry) ─────
  window.skARGerarPrompt = function () {
    const desc      = document.getElementById('sk-ar-descricao')?.value.trim() || '';
    const elemento  = document.getElementById('sk-ar-elemento')?.value || 'auto';
    const estilo    = document.getElementById('sk-ar-estilo')?.value || 'auto';
    const intens    = document.getElementById('sk-ar-intensidade')?.value || 'media';
    const dur       = parseInt(document.getElementById('sk-ar-duracao')?.value) || 1500;
    const nomeSkill = document.getElementById('sk-habilidade')?.value.trim() || 'Habilidade';
    const descSkill = document.getElementById('sk-descricao')?.value.trim() || '';
    const wrapEl    = document.getElementById('sk-ar-prompt-wrap');
    const outEl     = document.getElementById('sk-ar-prompt-out');

    const descCompleta = [desc, descSkill].filter(Boolean).join(' — ');

    const paletas = {
      fogo:     'centro #ffee00 (branco-amarelo), meio #ff6600 (laranja), borda #ff2200 (vermelho), sombra #331100',
      gelo:     'reflexo #ffffff, cristal #aaddff, profundo #006699, névoa #cceeff',
      raio:     'núcleo #ffffff (cegante), plasma #aaffff, halo #88ccff, campo #0033ff',
      veneno:   'brilho #44ff00 (tóxico), médio #228800, profundo #001100, esporo #aaff44',
      sagrado:  'puro #ffffff, dourado #ffeeaa, âmbar #ffdd44, divino #ffffcc',
      sombra:   'vácuo #000000, abissal #220033, pulso #440066, energia #8800cc',
      fisico:   'flash #ffffff, impacto #ffcc00, energia #ff8800, detritos #885500',
      natureza: 'vivo #5aff2a, escuro #228800, madeira #4a2c0a, esporo #aaff44',
      arcano:   'etéreo #ff88ff, violeta #cc00ff, profundo #330066, runa #ffccff',
      sangue:   'vivo #cc0000, escuro #660000, sombra #220000, spray #ff4444',
      vento:    'rajada #ffffff, brisa #eeffff, ar #aacccc, sombra #445555',
      terra:    'pedra #886633, rocha #553300, solo #221100, poeira #aa8844',
      agua:     'espuma #ffffff, clara #aaddff, profundo #0066cc, oceano #003366',
      psiquico: 'mental #ff44ff, distorção #8800aa, abisso #220033, pulso #ffaaff',
      auto:     'escolha a paleta que melhor representa visualmente a habilidade descrita'
    };

    const estiloDesc = {
      corte:          'A habilidade é um CORTE — algo afiado rasga o espaço. Não é uma explosão circular — é uma linha, um arco, um slash brusco e rápido.',
      projétil:       'A habilidade é um PROJÉTIL que viaja. Use sequence: charge_up → beam/multi_projectile → explosion no impacto.',
      explosao:       'A habilidade EXPLODE em área. Epicentro brilhante, anel de choque se expandindo, debris voando.',
      invocacao:      'A habilidade INVOCA algo. rune_circle (preparação) → pillar (manifestação) → stance (presença persistente).',
      buff:           'A habilidade FORTALECE o usuário. stance + aura_pulse no atacante. Nada violento ou agressivo.',
      cura:           'A habilidade CURA. Partículas sobem, pillar de luz suave, floating_text "+HP". Sem impacto agressivo.',
      maldição:       'A habilidade AMALDIÇOA e corrói. tendril enrolando o alvo, ground_crack, burn_mark persistente.',
      teletransporte: 'A habilidade TELEPORTA. implosion onde estava → flash → explosion onde chegou.',
      auto:           'Analise a habilidade e escolha o estilo mais fiel ao que ela faz.'
    };

    const intensDesc = {
      sutil:    '1-2 tipos, 300-700ms total. Sem screen_crack. Discreta, para habilidades passivas ou de baixo custo.',
      media:    '2-3 tipos, 700-1500ms. shockwave e flash moderado. Habilidade normal de combate.',
      poderosa: 'sequence com 3-4 tipos, 1200-2500ms. shake + screen_crack. Habilidade especial marcante.',
      epica:    'sequence com 4-6 tipos, 1800-4000ms. shake forte, screen_crack, zoom_punch, comic_panel. A ultimate.'
    };

    const prompt = `Você é o diretor de VFX de um RPG de mesa digital de alta qualidade. Crie uma animação que represente FIELMENTE a habilidade como ela foi imaginada — não apenas pelo elemento, mas pela natureza, peso, velocidade e impacto emocional dela.

RESPONDA APENAS COM O JSON PURO. Zero texto, zero markdown, zero explicações.

═══════════════════════════════════════════
HABILIDADE: "${nomeSkill}"
DESCRIÇÃO: "${descCompleta || 'sem descrição adicional'}"
ELEMENTO: ${elemento} | ESTILO: ${estilo} | INTENSIDADE: ${intens}
DURAÇÃO TOTAL SUGERIDA: ${dur}ms
═══════════════════════════════════════════

▶ ANTES DE ESCREVER O JSON, visualize a habilidade:

1. O que ela FAZ visualmente? Não o elemento — o ATO.
   "Raiz Contida" não é só "magia verde" — são raízes que CRESCEM organicamente, se ramificam, saem do atacante, viajam ao alvo e o ENVOLVEM prendendo ao chão.
   "Bola de Fogo" não é só "fogo" — é uma esfera de energia que viaja e DETONA ao impactar.

2. MOVIMENTO: é instantâneo e explosivo? cresce lentamente? viaja de A→B? envolve o alvo?

3. PESO: leve e ágil (slash rápido) vs. pesado e lento (pedras, raízes, gelo)?

4. NARRATIVA: início → desenvolvimento → clímax → consequência. Use sequence para isso.

▶ PALETA DE CORES para "${elemento}": ${paletas[elemento] || paletas.auto}

▶ ESTILO: ${estiloDesc[estilo] || estiloDesc.auto}

▶ INTENSIDADE: ${intensDesc[intens]}

▶ TIPOS DISPONÍVEIS (use o que melhor representa a habilidade):

• "slash" — cortes em arco bezier | campos: cor, cor2, quantidade(1-5), abertura(30-120°), espessura(1-8), comprimento(60-200), duracao, delay_entre
• "tendril" — raízes/vinhas orgânicas crescendo | campos: cor_primaria, cor_secundaria, raizes(8-24), intensidade(0.5-2.0), duracao, posicao
• "shockwave" — anéis de onda de choque | campos: cores(array), aneis(1-4), raio_max(80-350), duracao, posicao
• "beam" — feixe contínuo atacante→alvo | campos: cor, cor2, espessura(3-15), pulsar(bool), duracao
• "arc_lightning" — raio elétrico zigzag | campos: cor, segmentos(8-20), deslocamento(20-80), duracao
• "explosion" — explosão radial com debris | campos: cor1, cor2, cor3, tamanho(50-250), debris(15-60), duracao
• "implosion" — partículas sugadas para dentro | campos: cor, particulas(30-100), duracao
• "crystallize" — cristais crescendo do impacto | campos: cor, cor2, cristais(6-20), duracao
• "ground_crack" — rachaduras irradiando pelo chão | campos: cor, quantidade(6-18), distancia(80-280), duracao
• "pillar" — coluna vertical de luz descendo | campos: cor, cor2, largura(30-120), altura(150-450), duracao
• "vortex" — espiral que suga partículas | campos: cor, bracos(2-5), voltas(1-4), duracao, posicao
• "charge_up" — partículas convergindo para o atacante | campos: cor, particulas(30-80), duracao
• "aura_pulse" — anéis de aura se expandindo | campos: cor, pulsos(1-5), raio(40-200), duracao, posicao
• "shake" — tremor de tela | campos: intensidade(3-20), duracao
• "flash" — flash de cor na tela | campos: cor, intensidade(0.2-0.8), duracao
• "zoom_punch" — zoom dramático no impacto | campos: intensidade(1.04-1.15), duracao
• "screen_crack" — rachaduras na câmera | campos: cor, quantidade(4-12), duracao
• "floating_text" — texto flutuando sobre alvo | campos: texto(string), cor, cor2, tamanho(20-60), duracao
• "rune_circle" — círculo de runas girando | campos: cor, raio(40-150), runas(4-12), giros(0.5-3), duracao, posicao
• "area_pulse" — pulso de área AoE | campos: cor, raio(80-300), pulsos(1-4), duracao
• "storm" — relâmpagos caindo em área | campos: cor, raio(80-200), relampagos(5-20), duracao
• "gravity_well" — poço gravitacional | campos: cor, raio(100-280), duracao
• "multi_projectile" — leque de projéteis | campos: cor, quantidade(2-8), abertura(20-90°), tamanho(4-16), duracao
• "rain" — objetos caindo do alto | campos: cor, quantidade(8-25), raio(60-200), duracao
• "after_image" — pós-imagens do personagem | campos: cor, quantidade(3-8), raio(20-60), duracao, posicao
• "burn_mark" — marca persistente no chão | campos: cor, cor2, raio(20-70), duracao
• "comic_panel" — flash estilo HQ | campos: texto, cor, cor_fundo, linhas(15-35), duracao
• "stance" — aura contínua orbitando | campos: cor, raio(25-80), duracao, posicao
• "sequence" — etapas em ORDEM: {"tipo":"sequence","etapas":[...cada etapa com seu tipo e campos...]}
• "parallel" — etapas SIMULTÂNEAS: {"tipo":"parallel","etapas":[...]}

▶ COMO COMPOR:

sequence (narrativa em 3 atos):
{"tipo":"sequence","etapas":[
  {"tipo":"charge_up","cor":"#5aff2a","duracao":400},
  {"tipo":"tendril","cor_primaria":"#5aff2a","cor_secundaria":"#4a2c0a","raizes":20,"intensidade":1.4,"duracao":1800},
  {"tipo":"parallel","etapas":[
    {"tipo":"ground_crack","cor":"#5aff2a","quantidade":12,"duracao":1000},
    {"tipo":"aura_pulse","cor":"#5aff2a","pulsos":2,"raio":90,"posicao":"alvo","duracao":1200}
  ]}
]}

▶ EXEMPLOS CONCRETOS (como pensar → animar):

"Raiz Contida" — raízes imobilizam o inimigo:
sequence: charge_up verde (atacante, 300ms) → tendril verde-marrom viajando até alvo (1800ms) → ground_crack irradiando dos pés do alvo (900ms) → stance no alvo simulando prisão (1500ms)

"Bola de Fogo" — projétil de fogo que explode:
sequence: charge_up laranja (400ms) → beam laranja viajando (500ms) → parallel de [explosion + shockwave + flash + shake] no alvo

"Golpe de Espada Crítico":
sequence: slash × 3 rápidos (350ms) → parallel de [shockwave + shake + screen_crack + zoom_punch] → floating_text "CRÍTICO!"

"Maldição das Sombras":
sequence: rune_circle roxo no alvo (700ms) → vortex sugando (800ms) → parallel de [tendril negro + burn_mark + aura_pulse escuro no alvo]

"Cura Sagrada":
sequence: pillar dourado descendo (600ms) → parallel de [aura_pulse dourado + floating_text "+HP"] → stance dourada suave (1500ms)

"Punho do Trovão":
sequence: charge_up amarelo (400ms) → arc_lightning para o alvo (300ms) → parallel de [explosion + shake intenso + screen_crack + zoom_punch + floating_text "TROVÃO!"]

▶ REGRAS ABSOLUTAS:
• O efeito NARRA A HABILIDADE — quem assistir entende o que aconteceu
• NÃO use shake/screen_crack em cura ou buff
• Para habilidades que ENVOLVEM o alvo (prisão, raízes, maldição): tendril + stance no alvo + ground_crack
• Para habilidades que VIAJAM: sequence com preparação → beam/multi_projectile → impacto
• Para habilidades EXPLOSIVAS: charge_up → explosion + parallel de efeitos de impacto
• Cada etapa dentro de sequence ou parallel PRECISA ter "duracao"
• posicao pode ser "alvo" ou "atacante" dentro de cada tipo

JSON da animação para "${nomeSkill}":`;

    if (outEl) outEl.value = prompt;
    if (wrapEl) wrapEl.style.display = '';
  };

  window.skARCopiarPrompt = function () {
    const el  = document.getElementById('sk-ar-prompt-out');
    const btn = document.getElementById('sk-ar-btn-copiar');
    if (!el) return;
    el.select(); el.setSelectionRange(0, 99999);
    navigator.clipboard?.writeText(el.value).catch(() => document.execCommand('copy'));
    if (btn) { btn.textContent = '✓ Copiado!'; setTimeout(() => { btn.textContent = '📋 Copiar'; }, 1800); }
  };

  window.skAROnJsonChange = function () {
    const val = document.getElementById('sk-ar-json')?.value.trim() || '';
    const err = document.getElementById('sk-ar-json-erro');
    if (!val) { if (err) err.style.display = 'none'; return; }
    try { JSON.parse(val); if (err) err.style.display = 'none'; }
    catch (e) { if (err) { err.style.display = ''; err.textContent = '⚠ JSON inválido: ' + e.message; } }
  };

  // ── Preview simplificado no canvas do modal ───────────────
  let _arPrevRaf = null;
  window.skARPreviewPlay = function () {
    const jsonEl = document.getElementById('sk-ar-json');
    const canvas = document.getElementById('sk-ar-preview-canvas');
    const wrap   = document.getElementById('sk-ar-preview-wrap');
    if (!jsonEl || !canvas) return;
    let cfg; try { cfg = JSON.parse(jsonEl.value.trim()); } catch (_) { return; }
    if (wrap) wrap.style.display = '';
    if (_arPrevRaf) { cancelAnimationFrame(_arPrevRaf); _arPrevRaf = null; }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const orig = { x: canvas.width * 0.18, y: canvas.height / 2 };
    const alvo = { x: canvas.width * 0.82, y: canvas.height / 2 };
    const cor = cfg.cor || cfg.etapas?.[0]?.cor || cfg.etapas?.[0]?.cor1 || '#ff8800';
    const dur = cfg.duracao || (cfg.etapas || []).reduce((s, e) => s + (e.duracao || 0), 0) || 1500;
    const tipo = cfg.tipo;
    const t0 = performance.now();

    function drawMarkers() {
      ctx.save();
      ctx.fillStyle = '#4fa3d1'; ctx.shadowColor = '#4fa3d1'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(orig.x, orig.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e74c3c'; ctx.shadowColor = '#e74c3c';
      ctx.beginPath(); ctx.arc(alvo.x, alvo.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    (function loop(ts) {
      const el = ts - t0, t = cl(el / dur, 0, 1);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const intensity = t < 0.35 ? t / 0.35 : t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
      if (intensity > 0) {
        const r = 32 * intensity;
        const g = ctx.createRadialGradient(alvo.x, alvo.y, 0, alvo.x, alvo.y, r);
        g.addColorStop(0, rgba(cor, intensity)); g.addColorStop(1, rgba(cor, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(alvo.x, alvo.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.globalAlpha = intensity * 0.42;
        ctx.strokeStyle = cor; ctx.lineWidth = 2 * intensity;
        ctx.shadowColor = cor; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(orig.x, orig.y); ctx.lineTo(alvo.x, alvo.y); ctx.stroke();
        ctx.restore();
        ctx.save(); ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#7a92aa'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
        ctx.fillText(tipo, canvas.width / 2, canvas.height - 6); ctx.restore();
      }
      drawMarkers();
      if (el < dur + 300) _arPrevRaf = requestAnimationFrame(loop);
      else setTimeout(() => { if (document.getElementById('sk-ar-json')?.value) skARPreviewPlay(); }, 300);
    })(t0);
  };

  // ── Patch salvarSkill ─────────────────────────────────────
  const _origSalvarAR = window.salvarSkill;
  window.salvarSkill = async function () {
    const animTipo = document.getElementById('sk-anim-tipo')?.value;
    if (animTipo !== AR_TYPE) {
      return typeof _origSalvarAR === 'function' ? _origSalvarAR.call(this) : undefined;
    }
    const rawJson = document.getElementById('sk-ar-json')?.value.trim() || '';
    if (!rawJson) { mostrarToast('Configure a animação antes de salvar', 'aviso'); return; }
    let animCfg;
    try { animCfg = JSON.parse(rawJson); }
    catch (_) { mostrarToast('JSON de animação inválido', 'erro'); return; }

    const skillIdEditar = document.getElementById('modal-skill-id')?.value || '';
    const personagem    = document.getElementById('modal-skill-personagem')?.value || '';
    const animacaoFinal = { ...animCfg, _via: AR_TYPE };
    const qtdAntes      = (window.RPG_DATA?.skills || []).length;

    document.getElementById('sk-anim-tipo').value = 'nenhuma';
    try { await _origSalvarAR.call(this); } catch (e) { console.error('[AnimRegistry] Erro ao salvar:', e); return; }

    let targetId = skillIdEditar;
    if (!targetId) {
      const skills = window.RPG_DATA?.skills || [];
      if (skills.length > qtdAntes) targetId = skills[skills.length - 1].id;
      if (!targetId) {
        const charId = typeof _skCharId === 'function' ? _skCharId(personagem) : null;
        const sk = [...skills].reverse().find(s => s.personagem === personagem || (charId && s.character_id === charId));
        if (sk) targetId = sk.id;
      }
    }
    if (!targetId) { mostrarToast('Skill salva, mas animação não pôde ser persistida', 'aviso'); return; }

    const skImm = (window.RPG_DATA?.skills || []).find(s => String(s.id) === String(targetId));
    if (skImm) skImm.animacao = animacaoFinal;
    try {
      await sb(`skills?id=eq.${encodeURIComponent(targetId)}`,
        { method: 'PATCH', body: JSON.stringify({ animacao: animacaoFinal }) });
      const skPost = (window.RPG_DATA?.skills || []).find(s => String(s.id) === String(targetId));
      if (skPost) skPost.animacao = animacaoFinal;
      console.log('[AnimRegistry] ✓ animacao persistida:', targetId);
      mostrarToast('Animação salva com sucesso!', 'ok');
    } catch (e) {
      console.error('[AnimRegistry] Erro ao persistir:', e);
      mostrarToast('Skill salva, mas erro ao persistir animação', 'aviso');
    }
  };

  // ── Populate ao abrir skill com AR anim ───────────────────
  const _origAbrirAR = window.abrirModalSkill;
  window.abrirModalSkill = function (...args) {
    _injetarARUI();
    if (typeof _origAbrirAR === 'function') _origAbrirAR.apply(this, args);
    setTimeout(() => {
      const sid = document.getElementById('modal-skill-id')?.value;
      if (!sid) return;
      const sk = (window.RPG_DATA?.skills || []).find(s => String(s.id) === String(sid));
      const anim = sk?.animacao;
      if (!anim || !_reg[anim.tipo]) return;
      _injetarARUI();
      const tipoEl = document.getElementById('sk-anim-tipo');
      if (tipoEl && tipoEl.value !== AR_TYPE) {
        tipoEl.value = AR_TYPE;
        if (typeof window.skAnimTipoChange === 'function') window.skAnimTipoChange();
      }
      const jEl = document.getElementById('sk-ar-json');
      if (jEl) jEl.value = JSON.stringify(anim, null, 2);
    }, 120);
  };

  // ── Init ──────────────────────────────────────────────────
  function _init() {
    _injetarARUI();
    const ov = document.getElementById('modal-skill-overlay');
    if (ov) new MutationObserver(() => {
      if (ov.style.display !== 'none') _injetarARUI();
    }).observe(ov, { attributes: true, attributeFilter: ['style'] });
    console.log('✓ AnimRegistry v1 ativo — 28 tipos: slash, tendril, shockwave, beam, arc_lightning, explosion, implosion, crystallize, ground_crack, pillar, vortex, charge_up, aura_pulse, shake, flash, zoom_punch, screen_crack, floating_text, rune_circle, area_pulse, storm, gravity_well, multi_projectile, rain, after_image, burn_mark, comic_panel, stance + sequence, parallel, conditional');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _init);
  else setTimeout(_init, 950);

})();
// ── Abrir modal de colar pacote ───────────────────────────────────────────
window._abrirModalPacote = function() {
  const m = document.getElementById('modal-colar-pacote');
  if (m) { m.style.display = 'flex'; }
};

// Renderizar painel de sessão ao abrir aba mapas
HUB_EVENTS.on('cena_carregada', () => sessionRenderPainel());

