// ui/modals.js - VERSÃO CORRIGIDA
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
// ✨ PIXI PARTICLES PLUGIN — RPG Hub v5 SAKUGA EDITION (CORRIGIDO)
// Implementa: Stretch & Squash, Custom Shapes, Persistent Decals,
// Advanced Timing, Composite Figures, Skeleton Animation
// CORREÇÃO: Remove manchas de preview, corrige funcionamento em jogo
// ============================================================

(function () {
  'use strict';

  const PIXI_TYPE = 'pixi_particles';

  // ── Canvas Persistente para Decalques ────────────────────────────────
  let DECAL_CANVAS = null;
  let DECAL_CTX = null;
  let DECAL_TIMERS = []; // Track active decals

  function _getDecalCanvas() {
    if (!DECAL_CANVAS) {
      DECAL_CANVAS = document.createElement('canvas');
      DECAL_CANVAS.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:8887;width:100vw;height:100vh';
      DECAL_CANVAS.width = innerWidth;
      DECAL_CANVAS.height = innerHeight;
      DECAL_CTX = DECAL_CANVAS.getContext('2d');
      document.body.appendChild(DECAL_CANVAS);
    }
    return { canvas: DECAL_CANVAS, ctx: DECAL_CTX };
  }

  function _clearDecals() {
    if (DECAL_CTX) DECAL_CTX.clearRect(0, 0, DECAL_CANVAS.width, DECAL_CANVAS.height);
    DECAL_TIMERS.forEach(t => clearTimeout(t));
    DECAL_TIMERS = [];
  }

  function _autoCleanDecals(maxTime) {
    const timer = setTimeout(() => {
      _clearDecals();
      if (DECAL_CANVAS) {
        DECAL_CANVAS.remove();
        DECAL_CANVAS = null;
        DECAL_CTX = null;
      }
    }, maxTime);
    DECAL_TIMERS.push(timer);
  }

  // ── Custom Shape Definitions ──────────────────────────────────────────

  function _executeCustomShapeCode(code, ctx, size, progress) {
    try {
      const cos = Math.cos, sin = Math.sin, PI = Math.PI;
      const abs = Math.abs, sqrt = Math.sqrt, pow = Math.pow;
      const min = Math.min, max = Math.max, floor = Math.floor;
      const random = Math.random;
      
      const shapeFunc = new Function('ctx', 'size', 'progress', 'Math', `
        const {cos, sin, PI, abs, sqrt, pow, min, max, floor, random} = Math;
        ${code}
      `);
      
      shapeFunc(ctx, size, progress, Math);
    } catch (e) {
      console.warn('[PixiParticles] Erro ao executar customShapeCode:', e);
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
    }
  }
  
  const CUSTOM_SHAPES = {
    // Cabeça de dragão
    dragon_head: function(ctx, size, progress) {
      const s = size;
      ctx.save();
      // Mandíbula inferior
      ctx.beginPath();
      ctx.moveTo(-s*0.6, s*0.3);
      ctx.quadraticCurveTo(-s*0.3, s*0.6, 0, s*0.4);
      ctx.quadraticCurveTo(s*0.3, s*0.6, s*0.6, s*0.3);
      // Dentes
      for(let i = -2; i <= 2; i++) {
        ctx.lineTo(i*s*0.15, s*0.3 - s*0.15);
        ctx.lineTo((i+0.5)*s*0.15, s*0.3);
      }
      ctx.closePath();
      ctx.fill();
      
      // Mandíbula superior
      ctx.beginPath();
      ctx.moveTo(-s*0.7, 0);
      ctx.quadraticCurveTo(-s*0.4, -s*0.4, 0, -s*0.5);
      ctx.quadraticCurveTo(s*0.4, -s*0.4, s*0.7, 0);
      ctx.lineTo(s*0.6, s*0.1);
      ctx.quadraticCurveTo(s*0.3, s*0.3, 0, s*0.2);
      ctx.quadraticCurveTo(-s*0.3, s*0.3, -s*0.6, s*0.1);
      ctx.closePath();
      ctx.fill();
      
      // Olho
      ctx.fillStyle = progress > 0.5 ? '#ff0000' : '#ffaa00';
      ctx.beginPath();
      ctx.arc(-s*0.3, -s*0.2, s*0.12, 0, Math.PI*2);
      ctx.fill();
      
      ctx.restore();
    },

    // Punho de energia
    fist: function(ctx, size, progress) {
      const s = size;
      const pulse = 1 + Math.sin(progress * Math.PI * 4) * 0.1;
      ctx.save();
      
      // Palma
      ctx.fillStyle = ctx.fillStyle; // Usa cor atual
      ctx.beginPath();
      ctx.ellipse(0, 0, s*0.4*pulse, s*0.5*pulse, 0, 0, Math.PI*2);
      ctx.fill();
      
      // Dedos
      for(let i = 0; i < 4; i++) {
        const x = (i-1.5) * s*0.15;
        const y = -s*0.3;
        const w = s*0.1*pulse;
        const h = s*0.25*pulse;
        ctx.beginPath();
        ctx.ellipse(x, y, w, h, 0, 0, Math.PI*2);
        ctx.fill();
      }
      
      // Polegar
      ctx.beginPath();
      ctx.ellipse(-s*0.4, s*0.1, s*0.12*pulse, s*0.2*pulse, Math.PI*0.3, 0, Math.PI*2);
      ctx.fill();
      
      // Brilho de energia
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-s*0.1, -s*0.1, s*0.15*pulse, 0, Math.PI*2);
      ctx.fill();
      
      ctx.restore();
    },

    // Espada fantasma
    blade: function(ctx, size, progress) {
      const s = size;
      const trail = Math.max(0, progress - 0.5) * 2;
      ctx.save();
      
      // Lâmina
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s*0.08, -s*0.2);
      ctx.lineTo(s*0.08, s*0.6);
      ctx.lineTo(0, s*0.7);
      ctx.lineTo(-s*0.08, s*0.6);
      ctx.lineTo(-s*0.08, -s*0.2);
      ctx.closePath();
      ctx.fill();
      
      // Guarda
      ctx.fillRect(-s*0.25, s*0.6, s*0.5, s*0.08);
      
      // Cabo
      ctx.fillRect(-s*0.05, s*0.68, s*0.1, s*0.25);
      
      // Rastro de movimento
      if(trail > 0) {
        ctx.globalAlpha = 0.3 * (1 - trail);
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = s*0.15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-s*0.3*trail, -s);
        ctx.lineTo(-s*0.3*trail, s*0.7);
        ctx.stroke();
      }
      
      ctx.restore();
    },

    // Chamas (anatomia vetorial)
    flame: function(ctx, size, progress) {
      const s = size;
      const flicker = Math.sin(progress * Math.PI * 8) * 0.15;
      ctx.save();
      
      // Camada externa (vermelha)
      ctx.fillStyle = '#ff2200';
      ctx.beginPath();
      ctx.moveTo(0, s*0.5);
      ctx.quadraticCurveTo(-s*0.3*(1+flicker), s*0.2, -s*0.2, -s*0.3);
      ctx.quadraticCurveTo(-s*0.1, -s*0.6*(1+flicker*0.5), 0, -s);
      ctx.quadraticCurveTo(s*0.1, -s*0.6*(1+flicker*0.5), s*0.2, -s*0.3);
      ctx.quadraticCurveTo(s*0.3*(1+flicker), s*0.2, 0, s*0.5);
      ctx.closePath();
      ctx.fill();
      
      // Camada média (laranja)
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.moveTo(0, s*0.4);
      ctx.quadraticCurveTo(-s*0.2, s*0.1, -s*0.15, -s*0.2);
      ctx.quadraticCurveTo(-s*0.05, -s*0.5, 0, -s*0.8);
      ctx.quadraticCurveTo(s*0.05, -s*0.5, s*0.15, -s*0.2);
      ctx.quadraticCurveTo(s*0.2, s*0.1, 0, s*0.4);
      ctx.closePath();
      ctx.fill();
      
      // Núcleo (amarelo-branco)
      ctx.fillStyle = '#ffee00';
      ctx.beginPath();
      ctx.moveTo(0, s*0.3);
      ctx.quadraticCurveTo(-s*0.1, 0, -s*0.08, -s*0.3);
      ctx.quadraticCurveTo(0, -s*0.6, 0, -s*0.7);
      ctx.quadraticCurveTo(0, -s*0.6, s*0.08, -s*0.3);
      ctx.quadraticCurveTo(s*0.1, 0, 0, s*0.3);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    },

    // Garra/Raiz (para efeitos de natureza)
    claw: function(ctx, size, progress) {
      const s = size;
      const grow = Math.min(1, progress * 2);
      ctx.save();
      
      for(let i = 0; i < 3; i++) {
        const angle = (i - 1) * Math.PI * 0.2;
        ctx.save();
        ctx.rotate(angle);
        
        // Garra individual
        ctx.beginPath();
        ctx.moveTo(0, s*0.3);
        ctx.quadraticCurveTo(-s*0.05, s*0.1, -s*0.08, -s*0.4*grow);
        ctx.quadraticCurveTo(-s*0.05, -s*0.5*grow, 0, -s*0.6*grow);
        ctx.quadraticCurveTo(s*0.05, -s*0.5*grow, s*0.08, -s*0.4*grow);
        ctx.quadraticCurveTo(s*0.05, s*0.1, 0, s*0.3);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
      }
      
      // Base
      ctx.beginPath();
      ctx.arc(0, s*0.3, s*0.15, 0, Math.PI*2);
      ctx.fill();
      
      ctx.restore();
    }
  };

  // ── Motor Canvas 2D com Sakuga Features ──────────────────────────────
  class PixiParticleEngine {
    constructor(canvas, config, emitterPos) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cfg = config || {};
      this.pos = emitterPos || { x: canvas.width/2, y: canvas.height/2 };
      this.particles = [];
      this.time = 0;
      this.accumulator = 0;
      this.raf = null;
      this.lastTs = null;
      this.impactFrames = []; // Para pause dramático no impacto
      this.isPreview = false; // NOVO: flag para modo preview
      this._parse();
    }

    _parse() {
      const c = this.cfg;
      
      // Básicos
      this.maxParticles = Math.min(c.maxParticles || 100, 400);
      this.frequency = Math.max(c.frequency || 0.016, 0.001);
      this.particlesPerWave = c.particlesPerWave || 1;
      this.emitterLifetime = c.emitterLifetime !== undefined ? c.emitterLifetime : 1.0;
      this.addAtBack = !!c.addAtBack;
      
      // Spawn
      this.spawnType = c.spawnType || 'point';
      this.spawnCircle = c.spawnCircle || { x:0, y:0, r:10 };
      this.spawnRect = c.spawnRect || { x:0, y:0, w:20, h:20 };
      
      // Alpha & Scale
      this.alphaStart = c.alpha?.start ?? 1;
      this.alphaEnd = c.alpha?.end ?? 0;
      this.alphaCurve = c.alphaCurve || 'linear';
      this.scaleStart = c.scale?.start ?? 1;
      this.scaleEnd = c.scale?.end ?? 0.1;
      this.scaleCurve = c.scaleCurve || 'linear';
      
      // Cores
      this.colorStart = this._hex(c.color?.start || '#fff');
      this.colorEnd = this._hex(c.color?.end || '#fff');
      this.colorMid = c.color?.mid ? this._hex(c.color.mid) : null;
      
      // Velocidade & Física
      this.speedStart = c.speed?.start ?? 100;
      this.speedEnd = c.speed?.end ?? 0;
      this.maxSpeed = c.maxSpeed ?? Infinity;
      this.lifetimeMin = c.lifetime?.min ?? 0.3;
      this.lifetimeMax = c.lifetime?.max ?? 0.8;
      this.rotMin = (c.startRotation?.min ?? 0) * Math.PI/180;
      this.rotMax = (c.startRotation?.max ?? 360) * Math.PI/180;
      this.rotSpeedMin = (c.rotationSpeed?.min ?? 0) * Math.PI/180;
      this.rotSpeedMax = (c.rotationSpeed?.max ?? 0) * Math.PI/180;
      this.accel = { x: c.acceleration?.x ?? 0, y: c.acceleration?.y ?? 0 };
      
      // Renderização
      this.blendMode = c.blendMode || 'normal';
      this.noRotation = !!c.noRotation;
      this.baseSize = Math.max(c.particleBaseSize || 8, 2);
      this.particleShape = c.particleShape || 'circle';
      this.glowStrength = c.glowStrength ?? 0;
      this.turbulence = c.turbulence ?? 0;
      this.scaleXRatio = c.scaleXRatio ?? 1;
      
      // ═══ NOVOS RECURSOS SAKUGA ═══

      // Custom shape code (código livre)
      this.customShapeCode = c.customShapeCode || null;
      
      // Stretch & Squash
      this.stretchSquash = c.stretchSquash !== false; // Ativo por padrão
      this.stretchFactor = c.stretchFactor || 0.15;
      
      // Timing avançado
      this.timingCurve = c.timingCurve || 'linear'; // 'overshoot', 'elastic', 'bounce'
      this.hangTime = c.hangTime || 0; // Pausa no ápice (segundos)
      this.hangPoint = c.hangPoint || 0.5; // Quando pausar (0-1)
      
      // Custom shape
      this.customShape = c.customShape; // Nome ou função
      this.shapeProgress = c.shapeProgress !== false; // Animar shape com progresso
      
      // Persistent decal
      this.persistentDecal = c.persistentDecal || null;
      // { enabled: true, fadeTime: 3000, flicker: true, color: '#ff2200' }
      
      // Composite (múltiplas formas em uma partícula)
      this.composite = c.composite || null;
      // Array de { shape, offset: {x,y}, scale, color }
      
      // Skeleton animation
      this.skeleton = c.skeleton || null;
      // { bones: [{from:{x,y}, to:{x,y}}], animate: 'wave'|'pulse' }
      
      // Impact frames (pause dramático)
      this.impactFrame = c.impactFrame || null;
      // { at: 0.8, duration: 0.1, timeScale: 0.05 }
    }

    _hex(h) {
      if (!h) return {r:255,g:255,b:255};
      const s = h.replace('#','');
      if (s.length===3) return {r:parseInt(s[0]+s[0],16),g:parseInt(s[1]+s[1],16),b:parseInt(s[2]+s[2],16)};
      return {r:parseInt(s.slice(0,2),16),g:parseInt(s.slice(2,4),16),b:parseInt(s.slice(4,6),16)};
    }

    _lerp(a,b,t) { return a+(b-a)*t; }

    _lerpColor(t) {
      if (this.colorMid) {
        if (t < 0.5) return this._lerpC(this.colorStart, this.colorMid, t * 2);
        return this._lerpC(this.colorMid, this.colorEnd, (t - 0.5) * 2);
      }
      return this._lerpC(this.colorStart, this.colorEnd, t);
    }
    
    _lerpC(a,b,t) {
      return {
        r:Math.round(this._lerp(a.r,b.r,t)),
        g:Math.round(this._lerp(a.g,b.g,t)),
        b:Math.round(this._lerp(a.b,b.b,t))
      };
    }

    _ease(t, curve) {
      switch(curve) {
        case 'easeIn': return t * t;
        case 'easeOut': return 1 - (1-t)*(1-t);
        case 'easeInOut': return t < 0.5 ? 2*t*t : 1 - 2*(1-t)*(1-t);
        case 'pulse': return Math.sin(t * Math.PI);
        case 'overshoot': {
          const s = 1.70158;
          return t * t * ((s + 1) * t - s);
        }
        case 'elastic': {
          if (t === 0 || t === 1) return t;
          const p = 0.3;
          return Math.pow(2, -10 * t) * Math.sin((t - p/4) * (2*Math.PI) / p) + 1;
        }
        case 'bounce': {
          if (t < 1/2.75) return 7.5625 * t * t;
          if (t < 2/2.75) return 7.5625 * (t -= 1.5/2.75) * t + 0.75;
          if (t < 2.5/2.75) return 7.5625 * (t -= 2.25/2.75) * t + 0.9375;
          return 7.5625 * (t -= 2.625/2.75) * t + 0.984375;
        }
        default: return t;
      }
    }

    _spawnPos() {
      const b = {x:this.pos.x, y:this.pos.y};
      if(this.spawnType==='circle') {
        const r=Math.random()*this.spawnCircle.r, a=Math.random()*Math.PI*2;
        return {x:b.x+Math.cos(a)*r, y:b.y+Math.sin(a)*r};
      }
      if(this.spawnType==='ring') {
        const r=this.spawnCircle.r, a=Math.random()*Math.PI*2;
        return {x:b.x+Math.cos(a)*r, y:b.y+Math.sin(a)*r};
      }
      if(this.spawnType==='rect') {
        return {x:b.x+(Math.random()-.5)*this.spawnRect.w, y:b.y+(Math.random()-.5)*this.spawnRect.h};
      }
      if(this.spawnType==='burst') {
        const a=Math.random()*Math.PI*2, r=Math.random()*(this.spawnCircle.r||10);
        return {x:b.x+Math.cos(a)*r, y:b.y+Math.sin(a)*r};
      }
      return {...b};
    }

    _spawn() {
      const sp = this._spawnPos();
      const angle = this.rotMin + Math.random() * (this.rotMax - this.rotMin);
      const lt = this.lifetimeMin + Math.random() * (this.lifetimeMax - this.lifetimeMin);
      const rs = this.noRotation ? 0 : this.rotSpeedMin + Math.random() * (this.rotSpeedMax - this.rotSpeedMin);
      
      return {
        x: sp.x,
        y: sp.y,
        vx: Math.cos(angle) * this.speedStart,
        vy: Math.sin(angle) * this.speedStart,
        dir: angle,
        rotation: angle,
        rotSpeed: rs,
        lifetime: lt,
        age: 0,
        // Sakuga extras
        stretchX: 1,
        stretchY: 1,
        hung: false, // Se já passou pelo hang time
        impacted: false
      };
    }

    update(dt) {
      // Verificar impact frames
      if (this.impactFrame && !this.impacted) {
        const progress = this.time / (this.emitterLifetime > 0 ? this.emitterLifetime : 1);
        if (progress >= this.impactFrame.at) {
          this.impacted = true;
          this.impactFrames.push({
            start: performance.now(),
            duration: this.impactFrame.duration * 1000,
            timeScale: this.impactFrame.timeScale || 0.05
          });
        }
      }

      // Aplicar impact frame slowdown
      let effectiveDt = dt;
      for (let i = this.impactFrames.length - 1; i >= 0; i--) {
        const imp = this.impactFrames[i];
        const elapsed = performance.now() - imp.start;
        if (elapsed < imp.duration) {
          effectiveDt *= imp.timeScale;
        } else {
          this.impactFrames.splice(i, 1);
        }
      }

      // Spawn de partículas
      if (this.emitterLifetime < 0 || this.time < this.emitterLifetime) {
        this.accumulator += effectiveDt;
        while (this.accumulator >= this.frequency && this.particles.length < this.maxParticles) {
          for (let i = 0; i < this.particlesPerWave; i++) {
            if (this.particles.length < this.maxParticles) {
              this.particles.push(this._spawn());
            }
          }
          this.accumulator -= this.frequency;
        }
      }

      // Update partículas
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.age += effectiveDt;
        
        if (p.age >= p.lifetime) {
          // Ao morrer, criar decal se configurado E NÃO estiver em modo preview
          if (this.persistentDecal && this.persistentDecal.enabled && !this.isPreview) {
            this._createDecal(p);
          }
          this.particles.splice(i, 1);
          continue;
        }

        const t = p.age / p.lifetime;
        
        // Hang time
        if (this.hangTime > 0 && !p.hung && t >= this.hangPoint && t < this.hangPoint + 0.05) {
          p.hung = true;
          // Pausa será tratada pelo impact frame global
        }
        
        // Velocidade com curva de timing
        const speedT = this._ease(t, this.timingCurve);
        const spd = this._lerp(this.speedStart, this.speedEnd, speedT);
        const cur = Math.sqrt(p.vx*p.vx + p.vy*p.vy) || 1;
        
        p.vx = (p.vx/cur) * spd + this.accel.x * effectiveDt;
        p.vy = (p.vy/cur) * spd + this.accel.y * effectiveDt;
        
        // Turbulência
        if (this.turbulence > 0) {
          const drift = (Math.random()-.5) * this.turbulence * effectiveDt * 6;
          const cos = Math.cos(drift), sin = Math.sin(drift);
          const nx = p.vx*cos - p.vy*sin;
          const ny = p.vx*sin + p.vy*cos;
          p.vx = nx;
          p.vy = ny;
        }
        
        // Max speed
        if (this.maxSpeed < Infinity) {
          const spd2 = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
          if (spd2 > this.maxSpeed) {
            p.vx = (p.vx/spd2) * this.maxSpeed;
            p.vy = (p.vy/spd2) * this.maxSpeed;
          }
        }
        
        // ═══ STRETCH & SQUASH ═══
        if (this.stretchSquash) {
          const velocity = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
          const stretchAmount = Math.min(velocity * this.stretchFactor * 0.001, 0.5);
          
          // Estica na direção do movimento, achata perpendicular
          p.stretchX = 1 + stretchAmount;
          p.stretchY = 1 / p.stretchX;
          
          // Rotação segue direção do movimento para shapes alongadas
          if (this.particleShape === 'spark' || this.particleShape === 'blade') {
            p.rotation = Math.atan2(p.vy, p.vx);
          }
        } else {
          p.stretchX = 1;
          p.stretchY = 1;
        }
        
        // Posição
        p.x += p.vx * effectiveDt;
        p.y += p.vy * effectiveDt;
        
        // Rotação
        if (this.particleShape === 'spark' || this.particleShape === 'blade') {
          p.rotation = Math.atan2(p.vy, p.vx);
        } else if (!this.noRotation) {
          p.rotation += p.rotSpeed * effectiveDt;
        }
      }
      
      this.time += effectiveDt;
    }

    _createDecal(particle) {
      const decal = this.persistentDecal;
      const { ctx } = _getDecalCanvas();
      if (!ctx) return;
      
      const t = particle.age / particle.lifetime;
      const col = this._lerpColor(t);
      const decalColor = decal.color || `rgb(${col.r},${col.g},${col.b})`;
      const size = this.baseSize * this._lerp(this.scaleStart, this.scaleEnd, t);
      
      ctx.save();
      ctx.globalAlpha = decal.alpha || 0.3;
      ctx.fillStyle = decalColor;
      ctx.shadowColor = decalColor;
      ctx.shadowBlur = decal.blur || 15;
      
      // Marca de queimadura/cicatriz
      ctx.translate(particle.x, particle.y);
      ctx.beginPath();
      ctx.arc(0, 0, size * (decal.sizeMultiplier || 1.2), 0, Math.PI*2);
      ctx.fill();
      
      ctx.restore();
      
      // Flicker (opcional)
      if (decal.flicker) {
        setTimeout(() => {
          this._flickerDecal(particle.x, particle.y, size, decalColor, decal.fadeTime || 2000);
        }, 100);
      }
    }

    _flickerDecal(x, y, size, color, duration) {
      const { ctx } = _getDecalCanvas();
      if (!ctx) return;
      
      const start = performance.now();
      const flicker = () => {
        const elapsed = performance.now() - start;
        const t = elapsed / duration;
        if (t >= 1) return;
        
        const intensity = (1 - t) * (0.6 + Math.sin(elapsed * 0.02) * 0.4);
        ctx.save();
        ctx.globalAlpha = intensity * 0.2;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.translate(x, y);
        ctx.beginPath();
        ctx.arc(0, 0, size * 1.5, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
        
        requestAnimationFrame(flicker);
      };
      flicker();
    }

    // ── Desenho de formas ─────────────────────────────────────────────────
    _drawShape(ctx, shape, size, progress, particle) {
      // 1. Código customizado inline (prioridade máxima)
      if (this.customShapeCode && typeof this.customShapeCode === 'string') {
        _executeCustomShapeCode(this.customShapeCode, ctx, size, progress);
        return;
      }
      
      // 2. Custom shape (função ou nome)
      if (this.customShape) {
        if (typeof this.customShape === 'function') {
          this.customShape(ctx, size, progress);
          return;
        }
        if (typeof this.customShape === 'string' && CUSTOM_SHAPES[this.customShape]) {
          CUSTOM_SHAPES[this.customShape](ctx, size, progress);
          return;
        }
      }
      
      // 3. Composite (múltiplas formas)
      if (this.composite && Array.isArray(this.composite)) {
        this.composite.forEach(comp => {
          ctx.save();
          if (comp.offset) ctx.translate(comp.offset.x || 0, comp.offset.y || 0);
          if (comp.color) ctx.fillStyle = comp.color;
          const compSize = size * (comp.scale || 1);
          
          if (comp.code) {
            _executeCustomShapeCode(comp.code, ctx, compSize, progress);
          } else {
            this._drawBasicShape(ctx, comp.shape || 'circle', compSize, progress);
          }
          ctx.restore();
        });
        return;
      }
      
      // 4. Formas básicas
      this._drawBasicShape(ctx, shape, size, progress);
    }

    _drawBasicShape(ctx, shape, size, progress) {
      switch(shape) {
        case 'star': {
          const pts=5, outer=size, inner=size*.42;
          ctx.beginPath();
          for(let i=0;i<pts*2;i++){
            const r=i%2===0?outer:inner, a=(i*Math.PI/pts)-Math.PI/2;
            i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
          }
          ctx.closePath();
          break;
        }
        case 'spark': case 'blade': {
          const lx=this.scaleXRatio*size*.18, ly=size*1.6;
          ctx.beginPath();
          ctx.ellipse(0,0,lx,ly,0,0,Math.PI*2);
          break;
        }
        case 'diamond': {
          ctx.beginPath();
          ctx.moveTo(0,-size);
          ctx.lineTo(size*.55,0);
          ctx.lineTo(0,size);
          ctx.lineTo(-size*.55,0);
          ctx.closePath();
          break;
        }
        case 'square': {
          const h=size*.75;
          ctx.beginPath();
          ctx.rect(-h,-h,h*2,h*2);
          break;
        }
        case 'flame': {
          // Chama procedural
          CUSTOM_SHAPES.flame(ctx, size, progress);
          break;
        }
        default: {
          ctx.beginPath();
          ctx.arc(0,0,size,0,Math.PI*2);
          break;
        }
      }
    }

    _blendOp(m) {
      const MAP = {
        normal:'source-over', add:'lighter', screen:'screen', multiply:'multiply',
        overlay:'overlay', 'soft-light':'soft-light', 'hard-light':'hard-light',
        'color-dodge':'color-dodge'
      };
      return MAP[m]||'source-over';
    }

    // ── Renderização ──────────────────────────────────────────────────────
    _renderParticles() {
      const ctx = this.ctx;
      const blendOp = this._blendOp(this.blendMode);
      const useGlow = this.glowStrength > 0;
      const list = this.addAtBack ? this.particles : [...this.particles].reverse();

      let glowCtx = null, glowCanvas = null;
      if (useGlow) {
        glowCanvas = this._glowCanvas || (this._glowCanvas = document.createElement('canvas'));
        glowCanvas.width = this.canvas.width;
        glowCanvas.height = this.canvas.height;
        glowCtx = glowCanvas.getContext('2d');
        glowCtx.clearRect(0, 0, glowCanvas.width, glowCanvas.height);
      }

      ctx.globalCompositeOperation = blendOp;

      for (const p of list) {
        const t = p.age / p.lifetime;
        const alphaT = this._ease(t, this.alphaCurve);
        const scaleT = this._ease(t, this.scaleCurve);
        const alpha = Math.max(0, this._lerp(this.alphaStart, this.alphaEnd, alphaT));
        let scale = Math.max(0, this._lerp(this.scaleStart, this.scaleEnd, scaleT)) * this.baseSize;
        const col = this._lerpColor(t);
        
        if (alpha <= 0 || scale <= 0) continue;
        
        const cr = col.r, cg = col.g, cb = col.b;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        
        // Aplicar stretch & squash
        ctx.scale(p.stretchX, p.stretchY);

        // Desenhar shape
        if (this.particleShape === 'circle') {
          try {
            const g = ctx.createRadialGradient(0,0,0,0,0,scale);
            g.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
            g.addColorStop(.45, `rgba(${cr},${cg},${cb},.75)`);
            g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
            this._drawShape(ctx, 'circle', scale, t, p);
            ctx.fillStyle = g;
            ctx.fill();
          } catch(_) {}
        } else {
          try {
            ctx.save();
            this._drawShape(ctx, this.particleShape, scale, t, p);
            ctx.clip();
            const g = ctx.createRadialGradient(-scale*.2,-scale*.2,0,0,0,scale*1.2);
            g.addColorStop(0, `rgba(255,255,255,.55)`);
            g.addColorStop(.4, `rgba(${cr},${cg},${cb},1)`);
            g.addColorStop(1, `rgba(${Math.max(0,cr-40)},${Math.max(0,cg-40)},${Math.max(0,cb-40)},.9)`);
            this._drawShape(ctx, this.particleShape, scale, t, p);
            ctx.fillStyle = g;
            ctx.fill();
            ctx.restore();
          } catch(_) {
            this._drawShape(ctx, this.particleShape, scale, t, p);
            ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
            ctx.fill();
          }
        }
        
        ctx.restore();

        // Glow layer
        if (useGlow && glowCtx) {
          glowCtx.save();
          glowCtx.globalAlpha = alpha * 0.7;
          glowCtx.translate(p.x, p.y);
          glowCtx.rotate(p.rotation);
          const gs = scale * (1 + this.glowStrength * .6);
          glowCtx.beginPath();
          glowCtx.arc(0, 0, gs, 0, Math.PI*2);
          glowCtx.fillStyle = `rgb(${cr},${cg},${cb})`;
          glowCtx.fill();
          glowCtx.restore();
        }
      }

      // Aplicar glow
      if (useGlow && glowCanvas) {
        const blur = Math.round(this.glowStrength * 8);
        ctx.save();
        ctx.filter = `blur(${blur}px)`;
        ctx.globalCompositeOperation = this.blendMode === 'multiply' ? 'multiply' : 'lighter';
        ctx.globalAlpha = 0.65;
        ctx.drawImage(glowCanvas, 0, 0);
        ctx.restore();
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    draw() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this._renderParticles();
    }

    drawNoClear() {
      this._renderParticles();
    }

    get isAlive() {
      return this.particles.length > 0 || this.emitterLifetime < 0 || this.time < this.emitterLifetime;
    }

    start(onDone) {
      const loop = (ts) => {
        if (!this.lastTs) this.lastTs = ts;
        const dt = Math.min((ts - this.lastTs) / 1000, .05);
        this.lastTs = ts;
        this.update(dt);
        this.draw();
        if (this.isAlive) this.raf = requestAnimationFrame(loop);
        else if (typeof onDone === 'function') onDone();
      };
      this.raf = requestAnimationFrame(loop);
    }

    stop() {
      if (this.raf) {
        cancelAnimationFrame(this.raf);
        this.raf = null;
      }
    }
  }

  // ── Variáveis de preview ──────────────────────────────────────────────
  let _previewEng = null;
  let _previewRaf = null;

  // ── Injetar UI ────────────────────────────────────────────────────────
  function _injetarUI() {
    const sel = document.getElementById('sk-anim-tipo');
    if (sel && !sel.querySelector(`option[value="${PIXI_TYPE}"]`)) {
      const og = document.createElement('optgroup');
      og.label = 'Pixi Particles (IA Sakuga)';
      const op = document.createElement('option');
      op.value = PIXI_TYPE;
      op.textContent = '✨ Pixi Particles (IA Sakuga)';
      og.appendChild(op);
      sel.appendChild(og);
    }
    
    if (!document.getElementById('sk-anim-campos-pixi')) {
      const ref = document.getElementById('sk-anim-campos-midia');
      if (!ref) return;
      
      const div = document.createElement('div');
      div.id = 'sk-anim-campos-pixi';
      div.style.display = 'none';
      div.innerHTML = `
        <div class="form-group" style="margin-bottom:8px">
          <label>🤖 Descreva o ataque para a IA</label>
          <input type="text" id="sk-anim-pixi-descricao" placeholder="Ex: Cabeça de dragão cospe chamas, punho fantasma ataca, espada arcana corta o ar…" style="text-align:left;font-size:0.82rem">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div class="form-group"><label>Tipo Visual</label>
            <select id="sk-anim-pixi-tipo-visual" style="width:100%;padding:8px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.72rem">
              <option value="auto">🎲 Auto</option>
              <option value="fogo">🔥 Fogo</option>
              <option value="gelo">❄️ Gelo</option>
              <option value="raio">⚡ Raio</option>
              <option value="veneno">☠️ Veneno</option>
              <option value="magia">✨ Magia</option>
              <option value="cura">💚 Cura</option>
              <option value="sombra">🌑 Sombra</option>
              <option value="fisico">💥 Físico</option>
              <option value="sangue">🩸 Sangue</option>
              <option value="vento">🌪️ Vento</option>
              <option value="terra">🪨 Terra</option>
              <option value="agua">💧 Água</option>
            </select>
          </div>
          <div class="form-group"><label>Posição</label>
            <select id="sk-anim-pixi-posicao" style="width:100%;padding:8px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.72rem">
              <option value="alvo">No alvo</option>
              <option value="atacante">No atacante</option>
              <option value="meio">No meio</option>
              <option value="trajetoria">Trajetória</option>
            </select>
          </div>
        </div>
        <button onclick="skAnimPixiGerarPrompt()" style="width:100%;padding:10px;background:linear-gradient(135deg,rgba(123,47,190,0.3),rgba(79,163,209,0.2));border:1px solid rgba(123,47,190,0.5);border-radius:8px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.72rem;cursor:pointer;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">
          📋 Gerar Prompt SAKUGA para IA
        </button>
        <div id="sk-anim-pixi-prompt-wrap" style="display:none;margin-bottom:12px">
          <div style="font-size:0.62rem;color:#7a92aa;margin-bottom:4px">Cole este prompt na sua IA externa e cole o JSON retornado no campo abaixo:</div>
          <div style="position:relative">
            <textarea id="sk-anim-pixi-prompt-out" rows="8" readonly style="width:100%;box-sizing:border-box;padding:8px;padding-right:70px;background:rgba(20,12,40,0.9);border:1px solid rgba(123,47,190,0.4);border-radius:6px;color:#c8a84b;font-family:monospace;font-size:0.62rem;resize:vertical;line-height:1.45"></textarea>
            <button onclick="skAnimPixiCopiarPrompt()" id="sk-anim-pixi-btn-copiar" style="position:absolute;top:6px;right:6px;padding:4px 10px;background:rgba(123,47,190,0.25);border:1px solid rgba(123,47,190,0.5);border-radius:4px;color:#c8a84b;font-size:0.6rem;cursor:pointer">📋 Copiar</button>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <label style="display:flex;justify-content:space-between;align-items:center">
            <span>JSON — Pixi Particles SAKUGA</span>
            <span style="display:flex;gap:6px">
              <button onclick="skAnimPixiPreviewPlay()" style="font-size:0.6rem;padding:2px 8px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:4px;color:#c8a84b;cursor:pointer">▶ Preview</button>
            </span>
          </label>
          <textarea id="sk-anim-pixi-json" rows="10" oninput="skAnimPixiOnJsonChange()" placeholder='Cole o JSON da IA ou edite manualmente'
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

  // ── Patch skAnimTipoChange ────────────────────────────────────────────
  const _origTipoChange = window.skAnimTipoChange;
  window.skAnimTipoChange = function () {
    const tipo = document.getElementById('sk-anim-tipo')?.value;
    const pixi = document.getElementById('sk-anim-campos-pixi');
    if (tipo === PIXI_TYPE) {
      ['sk-anim-campos-canvas','sk-anim-campos-midia'].forEach(id => {
        const e = document.getElementById(id);
        if (e) e.style.display = 'none';
      });
      ['sk-anim-preview-wrap','sk-anim-midia-preview-wrap'].forEach(id => {
        const e = document.getElementById(id);
        if (e) e.style.display = 'none';
      });
      if (pixi) pixi.style.display = '';
    } else {
      if (pixi) pixi.style.display = 'none';
      if (typeof _origTipoChange === 'function') _origTipoChange.call(this);
    }
  };

  // ── Gerador de Prompt SAKUGA ──────────────────────────────────────────
  window.skAnimPixiGerarPrompt = function () {
    const desc = document.getElementById('sk-anim-pixi-descricao')?.value.trim() || '';
    const visual = document.getElementById('sk-anim-pixi-tipo-visual')?.value || 'auto';
    const nome = document.getElementById('sk-habilidade')?.value.trim() || '';
    const posicao = document.getElementById('sk-anim-pixi-posicao')?.value || 'alvo';
    const descSkill = document.getElementById('sk-descricao')?.value.trim() || '';
    const wrapEl = document.getElementById('sk-anim-pixi-prompt-wrap');
    const outEl = document.getElementById('sk-anim-pixi-prompt-out');
   
    const isTraj = posicao === 'trajetoria';
   
    const prompt = `Você é o diretor de VFX SAKUGA de um RPG. Crie partículas cinematográficas que NARRAM visualmente o que acontece.
   
  RESPONDA APENAS COM O ARRAY JSON. Zero texto, zero markdown.
   
  ═══════════════════════════════════════════
  HABILIDADE: "${nome}"
  DESCRIÇÃO: "${desc || descSkill || 'sem descrição'}"
  ELEMENTO: ${visual} | POSIÇÃO: ${posicao}
  ═══════════════════════════════════════════
   
  🎨 PALETA DE CORES (NATURAL, NÃO SATURADA):
  - Fogo: núcleo #fff8e1 (branco quente), meio #ffb74d (laranja suave), borda #e64a19 (vermelho queimado)
  - Gelo: reflexo #e3f2fd, cristal #64b5f6, profundo #1565c0, névoa #bbdefb
  - Raio: núcleo #f5f5f5, plasma #81d4fa, halo #42a5f5, campo #1976d2
  - Veneno: brilho #9ccc65, médio #689f38, profundo #33691e, névoa #c5e1a5
  - Magia: etéreo #ce93d8, violeta #ab47bc, profundo #6a1b9a, brilho #f3e5f5
  - Sombra: vácuo #212121, profundo #424242, pulso #616161, névoa #757575
   
  ⚠️ REGRA CRÍTICA DE CORES:
  - NUNCA use #ff0000, #00ff00, #0000ff puros
  - SEMPRE misture tons (ex: #e64a19 em vez de #ff0000)
  - Use alpha < 1.0 para camadas intensas
  - Prefira gradientes suaves a cores chapadas
   
  🔥 LIBERDADE TOTAL DE FORMAS:
   
  Você pode criar QUALQUER forma usando código canvas direto:
   
  **customShapeCode**: String com código JavaScript que desenha no canvas
  - Variáveis disponíveis: ctx, size, progress (0-1)
  - Funções Math disponíveis: cos, sin, PI, abs, sqrt, etc
   
  Exemplo - Espada Arcana:
  \`\`\`javascript
  "customShapeCode": "ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size*0.1, size*0.7); ctx.lineTo(-size*0.1, size*0.7); ctx.closePath(); ctx.fill(); ctx.fillRect(-size*0.3, size*0.7, size*0.6, size*0.1);"
  \`\`\`
   
  Exemplo - Runa Giratória:
  \`\`\`javascript
  "customShapeCode": "const angle = progress * PI * 2; for(let i=0; i<6; i++) { const a = angle + i*PI/3; ctx.fillRect(cos(a)*size*0.8 - size*0.15, sin(a)*size*0.8 - size*0.05, size*0.3, size*0.1); }"
  \`\`\`
   
  Exemplo - Cristal Hexagonal:
  \`\`\`javascript
  "customShapeCode": "ctx.beginPath(); for(let i=0; i<6; i++) { const a = i*PI/3; const x = cos(a)*size, y = sin(a)*size; i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y); } ctx.closePath(); ctx.fill();"
  \`\`\`
   
  Exemplo - Gota de Veneno:
  \`\`\`javascript
  "customShapeCode": "ctx.beginPath(); ctx.arc(0, size*0.3, size*0.7, 0, PI*2); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, -size*0.4); ctx.quadraticCurveTo(-size*0.3, 0, 0, size*0.3); ctx.quadraticCurveTo(size*0.3, 0, 0, -size*0.4); ctx.fill();"
  \`\`\`
   
  ${isTraj ? `
  🎯 TRAJETÓRIA - REGRAS ESPECIAIS:
   
  Para habilidades de TRAJETÓRIA (projétil que viaja):
   
  1. **SEMPRE use customShapeCode ou customShape** para o projétil principal
  2. Use múltiplas camadas:
     - [0] addAtBack:true → RASTRO/CAUDA (névoa que fica para trás)
     - [1] → PROJÉTIL PRINCIPAL com forma customizada
     - [2] → BRILHO/AURA ao redor
     - [3] opcional → PARTÍCULAS ORBITANDO
   
  3. **Velocidade no JSON original** (será adaptada automaticamente):
     - Projétil principal: speed.start > 400
     - Rastro/névoa: speed.start < 100
     - Aura: speed.start 150-250
   
  4. **Cores mais suaves** em trajetórias para evitar saturação
   
  Exemplo COMPLETO - Bola de Fogo:
  \`\`\`json
  [
    {
      "addAtBack": true,
      "particleShape": "circle",
      "color": {"start":"#ffb74d","end":"#e64a19"},
      "alpha": {"start":0.15,"end":0},
      "scale": {"start":1.5,"end":3.0},
      "speed": {"start":30,"end":0},
      "lifetime": {"min":0.4,"max":0.7},
      "frequency": 0.012,
      "maxParticles": 60,
      "blendMode": "screen",
      "turbulence": 0.8
    },
    {
      "customShapeCode": "const flicker = 0.85 + sin(progress*PI*8)*0.15; ctx.beginPath(); for(let i=0; i<8; i++) { const a = i*PI/4 + progress*PI*0.5; const r = size * (i%2 ? 0.7 : 1.0) * flicker; const x = cos(a)*r, y = sin(a)*r; i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y); } ctx.closePath(); ctx.fill();",
      "color": {"start":"#fff8e1","mid":"#ffb74d","end":"#e64a19"},
      "scale": {"start":1.2,"end":0.3},
      "speed": {"start":600,"end":50},
      "lifetime": {"min":0.2,"max":0.4},
      "frequency": 0.08,
      "maxParticles": 8,
      "blendMode": "add",
      "glowStrength": 2.5,
      "stretchSquash": true
    },
    {
      "particleShape": "spark",
      "color": {"start":"#fff8e1","end":"#ffb74d"},
      "alpha": {"start":0.8,"end":0},
      "scale": {"start":0.4,"end":0.1},
      "speed": {"start":180,"end":0},
      "lifetime": {"min":0.15,"max":0.3},
      "frequency": 0.015,
      "maxParticles": 40,
      "blendMode": "add",
      "turbulence": 1.2
    }
  ]
  \`\`\`
  ` : `
  🎯 EFEITO NO ALVO/ATACANTE:
   
  Para efeitos que aparecem em posição fixa:
   
  1. Foque em IMPACTO visual imediato
  2. Use customShapeCode para formas únicas
  3. Combine múltiplas camadas
  4. Use persistentDecal quando apropriado
  `}
   
  📐 RECURSOS SAKUGA:
   
  • **stretchSquash: true** → deformação com velocidade (essencial para projéteis)
  • **customShapeCode**: "código canvas aqui" → FORMA TOTALMENTE LIVRE
  • **customShape**: "dragon_head"|"fist"|"blade"|"flame"|"claw" → formas pré-definidas
  • **timingCurve**: "overshoot"|"elastic"|"bounce" → timing cinematográfico
  • **impactFrame**: {at:0.8, duration:0.15, timeScale:0.05} → slow-motion
  • **persistentDecal**: {enabled:true, fadeTime:3000, flicker:true, color:"#e64a19", alpha:0.3} → marca persistente
  • **composite**: [{code:"...", offset:{x,y}, scale, color}] → múltiplas formas em 1 partícula
   
  ⚠️ REGRAS CRÍTICAS:
  • Cada layer: color, scale, lifetime, frequency, emitterLifetime, maxParticles, blendMode
  • ${isTraj ? 'TRAJETÓRIA: layer principal SEMPRE com customShapeCode ou customShape' : 'FIXO: foque em impacto visual'}
  • Cores NATURAIS, não saturadas
  • persistentDecal: apenas para fogo, veneno, explosão, cortes
  • customShapeCode: use para criar formas únicas impossíveis com as pré-definidas
   
  Array JSON para "${nome}":`;
   
    if (outEl) outEl.value = prompt;
    if (wrapEl) wrapEl.style.display = '';
  };

  window.skAnimPixiCopiarPrompt = function () {
    const el = document.getElementById('sk-anim-pixi-prompt-out');
    const btn = document.getElementById('sk-anim-pixi-btn-copiar');
    if (!el) return;
    el.select();
    el.setSelectionRange(0, 99999);
    navigator.clipboard?.writeText(el.value).catch(() => document.execCommand('copy'));
    if (btn) {
      btn.textContent = '✓ Copiado!';
      setTimeout(() => { btn.textContent = '📋 Copiar'; }, 1800);
    }
  };

  window.skAnimPixiOnJsonChange = function () {
    const val = document.getElementById('sk-anim-pixi-json')?.value.trim() || '';
    const err = document.getElementById('sk-anim-pixi-json-erro');
    if (!val) {
      if (err) err.style.display = 'none';
      return;
    }
    try {
      JSON.parse(val);
      if (err) err.style.display = 'none';
    } catch (e) {
      if (err) {
        err.style.display = '';
        err.textContent = '⚠ JSON inválido: ' + e.message;
      }
    }
  };

  // ── Preview ───────────────────────────────────────────────────────────
  // FUNÇÃO AUXILIAR PARA DESENHAR MARCADORES (APENAS NO PREVIEW)
  function _drawPreviewMarkers(ctx, OX, OY, TX, TY) {
    ctx.save();
    // Marcador origem (azul)
    ctx.beginPath();
    ctx.arc(OX, OY, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(79,163,209,0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(79,163,209,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Marcador alvo (vermelho)
    ctx.beginPath();
    ctx.arc(TX, TY, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(232,80,60,0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,80,60,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  window.skAnimPixiPreviewPlay = function () {
    const jsonEl = document.getElementById('sk-anim-pixi-json');
    const canvas = document.getElementById('sk-anim-pixi-preview-canvas');
    const wrap = document.getElementById('sk-anim-pixi-preview-wrap');
    const posicao = document.getElementById('sk-anim-pixi-posicao')?.value || 'alvo';
    
    if (!jsonEl || !canvas) return;
    
    let cfg;
    try {
      cfg = JSON.parse(jsonEl.value.trim());
    } catch (_) {
      return;
    }
    
    if (wrap) wrap.style.display = '';

    if (_previewEng) {
      _previewEng.stop();
      _previewEng = null;
    }
    if (_previewRaf) {
      cancelAnimationFrame(_previewRaf);
      _previewRaf = null;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const OX = 36, OY = canvas.height / 2;
    const TX = canvas.width - 36, TY = canvas.height / 2;

    if (posicao === 'trajetoria') {
      const layers = Array.isArray(cfg) ? cfg : [cfg];
      const totalMs = Math.min(parseInt(document.getElementById('sk-anim-pixi-duracao')?.value) || 1500, 3000);
      const origem = { x: OX, y: OY }, alvo = { x: TX, y: TY };

      const back = layers.filter(l => l.addAtBack);
      const front = layers.filter(l => !l.addAtBack);
      const ordered = [...back, ...front];

      const emPos = { ...origem };
      const engines = ordered.map(layerCfg => {
        const adapted = _adaptarLayerParaTrajetoria(layerCfg, origem, alvo, totalMs, canvas);
        const eng = new PixiParticleEngine(canvas, adapted, { ...emPos });
        eng._spreadAngle = adapted._spreadAngle;
        eng.isPreview = true; // MARCA COMO PREVIEW
        return eng;
      });

      let last = performance.now(), boom = false;
      const t0 = last;

      function previewLoop(ts) {
        const dt = Math.min((ts - last) / 1000, 0.05);
        last = ts;
        const elapsed = ts - t0;
        const t = Math.min(elapsed / totalMs, 1);

        const dx = alvo.x - origem.x, dy = alvo.y - origem.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const arcH = Math.min(dist * 0.15, 28);
        const cx = (origem.x + alvo.x) / 2;
        const cy = Math.min(origem.y, alvo.y) - arcH;

        emPos.x = (1 - t) * (1 - t) * origem.x + 2 * (1 - t) * t * cx + t * t * alvo.x;
        emPos.y = (1 - t) * (1 - t) * origem.y + 2 * (1 - t) * t * cy + t * t * alvo.y;

        const nt = Math.min(t + 0.03, 1);
        const tnx = (1 - nt) * (1 - nt) * origem.x + 2 * (1 - nt) * nt * cx + nt * nt * alvo.x;
        const tny = (1 - nt) * (1 - nt) * origem.y + 2 * (1 - nt) * nt * cy + nt * nt * alvo.y;
        const tangAngle = Math.atan2(tny - emPos.y, tnx - emPos.x);

        if (t >= 0.88 && !boom) {
          boom = true;
          engines.forEach(eng => {
            eng.emitterLifetime = eng.time + 0.35;
            eng.frequency = Math.max(eng.frequency * 0.4, 0.002);
            eng.maxParticles = Math.min(eng.maxParticles * 2, 200);
            eng.rotMin = 0;
            eng.rotMax = Math.PI * 2;
            eng.speedStart = eng.speedStart * 1.5;
          });
        }

        engines.forEach(eng => {
          eng.pos = { ...emPos };
          eng.rotMin = tangAngle - eng._spreadAngle;
          eng.rotMax = tangAngle + eng._spreadAngle;
          eng.update(dt);
        });

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        engines.forEach(eng => eng.drawNoClear());
        _drawPreviewMarkers(ctx, OX, OY, TX, TY); // DESENHA MARCADORES APENAS NO PREVIEW

        if (elapsed < totalMs + 600) {
          _previewRaf = requestAnimationFrame(previewLoop);
        } else {
          engines.forEach(eng => {
            eng.particles = [];
            eng.time = 0;
            eng.accumulator = 0;
          });
          boom = false;
          const t0new = performance.now();
          last = t0new;
          _previewRaf = requestAnimationFrame(previewLoop);
        }
      }

      _drawPreviewMarkers(ctx, OX, OY, TX, TY);
      _previewRaf = requestAnimationFrame(previewLoop);
    } else {
      _drawPreviewMarkers(ctx, OX, OY, TX, TY);
      const layers = Array.isArray(cfg) ? cfg : [cfg];
      const cx = canvas.width / 2, cy = canvas.height / 2;

      if (layers.length === 1) {
        const pcfg = { ...layers[0], emitterLifetime: Math.min(layers[0].emitterLifetime || 1, 2.5) };
        _previewEng = new PixiParticleEngine(canvas, pcfg, { x: cx, y: cy });
        _previewEng.isPreview = true; // MARCA COMO PREVIEW
        _previewEng.start(null);
      } else {
        const back = layers.filter(l => l.addAtBack);
        const front = layers.filter(l => !l.addAtBack);
        const ordered = [...back, ...front];
        const durSecs = Math.min((parseInt(document.getElementById('sk-anim-pixi-duracao')?.value) || 1500) / 1000, 4);

        const previewEngines = ordered.map(lc => {
          const pc = { ...lc, emitterLifetime: Math.min(lc.emitterLifetime || 1, durSecs * 0.85) };
          const eng = new PixiParticleEngine(canvas, pc, { x: cx, y: cy });
          eng.isPreview = true; // MARCA COMO PREVIEW
          return eng;
        });

        let last2 = performance.now();

        function fixoLoop(ts) {
          const dt = Math.min((ts - last2) / 1000, 0.05);
          last2 = ts;
          previewEngines.forEach(eng => {
            eng.pos = { x: cx, y: cy };
            eng.update(dt);
          });
          const ctx2 = canvas.getContext('2d');
          ctx2.clearRect(0, 0, canvas.width, canvas.height);
          previewEngines.forEach(eng => eng.drawNoClear());
          _drawPreviewMarkers(ctx2, OX, OY, TX, TY); // DESENHA MARCADORES APENAS NO PREVIEW
          
          const alive = previewEngines.some(e => e.isAlive);
          if (alive) {
            _previewRaf = requestAnimationFrame(fixoLoop);
          } else {
            previewEngines.forEach(e => {
              e.stop();
              e.particles = [];
              e.time = 0;
              e.accumulator = 0;
              e._parse();
            });
            last2 = performance.now();
            _previewRaf = requestAnimationFrame(fixoLoop);
          }
        }
        _previewRaf = requestAnimationFrame(fixoLoop);
      }
    }
  };

  // ── Adaptador para trajetória ─────────────────────────────────────────
  function _adaptarLayerParaTrajetoria(layerCfg, origem, alvo, totalMs, canvasRef) {
    const dx = alvo.x - origem.x, dy = alvo.y - origem.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const travelSecs = totalMs / 1000;
    const origSpeed = layerCfg.speed?.start || 100;

    const isProjectile = !!(layerCfg.customShape || layerCfg.customShapeCode || 
                            layerCfg.composite || layerCfg.particleShape !== 'circle');

    let spreadDeg, newSpeedStart, newSpeedEnd;
    
    if (isProjectile) {
      spreadDeg = 3;
      newSpeedStart = 8;
      newSpeedEnd = 0;
    } else {
      if (origSpeed > 500) {
        spreadDeg = 6;
        newSpeedStart = 12;
        newSpeedEnd = 0;
      } else if (origSpeed > 200) {
        spreadDeg = 18;
        newSpeedStart = 35;
        newSpeedEnd = 0;
      } else {
        spreadDeg = 40;
        newSpeedStart = 60;
        newSpeedEnd = 0;
      }
    }

    const scaleFactor = canvasRef ? Math.min(1, canvasRef.width / 900) : 1;
    const lifeScale = 0.5 + scaleFactor * 0.5;
    const lifeMin = Math.min((layerCfg.lifetime?.min ?? 0.15) * lifeScale, travelSecs * 0.55);
    const lifeMax = Math.min((layerCfg.lifetime?.max ?? 0.35) * lifeScale, travelSecs * 0.85);

    const freqScale = isProjectile ? 1.5 : (origSpeed > 500 ? 2.5 : 2.0);
    const newFreq = Math.max((layerCfg.frequency || 0.016) * freqScale, 0.005);
    const newEmitterLifetime = travelSecs * 0.93;
    const accel = { x: 0, y: layerCfg.acceleration?.y ?? 0 };

    const adapted = {
      ...layerCfg,
      speed: { start: newSpeedStart, end: newSpeedEnd },
      lifetime: { min: Math.max(lifeMin, 0.05), max: Math.max(lifeMax, 0.1) },
      frequency: newFreq,
      emitterLifetime: newEmitterLifetime,
      acceleration: accel,
      startRotation: { min: 0, max: 360 },
      maxParticles: Math.min(layerCfg.maxParticles || 100, isProjectile ? 120 : 220),
    };

    adapted._spreadAngle = spreadDeg * Math.PI / 180;
    adapted._isProjectile = isProjectile;
    return adapted;
  }

  // ── salvarSkill patch ─────────────────────────────────────────────────
  const _origSalvar = window.salvarSkill;
  window.salvarSkill = async function () {
    const animTipo = document.getElementById('sk-anim-tipo')?.value;
    if (animTipo !== PIXI_TYPE) {
      return typeof _origSalvar === 'function' ? _origSalvar.call(this) : undefined;
    }

    const rawJson = document.getElementById('sk-anim-pixi-json')?.value.trim() || '';
    if (!rawJson) {
      mostrarToast('Configure as partículas antes de salvar', 'aviso');
      return;
    }
    
    let pixiCfg;
    try {
      pixiCfg = JSON.parse(rawJson);
    } catch (_) {
      mostrarToast('JSON de partículas inválido', 'erro');
      return;
    }

    const skillIdEditar = document.getElementById('modal-skill-id')?.value || '';
    const personagem = document.getElementById('modal-skill-personagem')?.value || '';
    const posicao = document.getElementById('sk-anim-pixi-posicao')?.value || 'alvo';
    const duracao = parseInt(document.getElementById('sk-anim-pixi-duracao')?.value) || 1500;
    const repeticao = parseInt(document.getElementById('sk-anim-pixi-repeticao')?.value) || 1;
    const animacaoPixi = {
      tipo: PIXI_TYPE,
      pixi_config: pixiCfg,
      posicao,
      duracao,
      repeticao
    };
    const qtdAntes = (window.RPG_DATA?.skills || []).length;

    document.getElementById('sk-anim-tipo').value = 'nenhuma';

    try {
      await _origSalvar.call(this);
    } catch (e) {
      console.error('[PixiParticles] Erro no salvarSkill original:', e);
      return;
    }

    let targetId = skillIdEditar;
    if (!targetId) {
      const skills = window.RPG_DATA?.skills || [];
      if (skills.length > qtdAntes) {
        targetId = skills[skills.length - 1].id;
      }
      if (!targetId) {
        const charId = typeof _skCharId === 'function' ? _skCharId(personagem) : null;
        const sk = [...skills].reverse().find(s =>
          s.personagem === personagem || (charId && s.character_id === charId)
        );
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
      await sb(`skills?id=eq.${encodeURIComponent(targetId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ animacao: animacaoPixi })
      });
      delete window._pixiPatchPendente[targetId];
      const skPost = (window.RPG_DATA?.skills || []).find(s => String(s.id) === String(targetId));
      if (skPost) skPost.animacao = animacaoPixi;
      console.log('[PixiParticles] ✓ animacao persistida — skill', targetId);
    } catch (e) {
      delete window._pixiPatchPendente[targetId];
      console.error('[PixiParticles] Erro ao persistir animacao pixi:', e);
      mostrarToast('Skill salva, mas erro ao persistir animação de partículas', 'aviso');
    }
  };

  // ── animarAtaque patch ────────────────────────────────────────────────
  const _origAnimar = window.animarAtaque;
  window.animarAtaque = function ({ atacEl, alvoEl, animacao, dano }) {
    if (animacao?.tipo === PIXI_TYPE || animacao?.tipo === 'pixi') {
      console.log('[PixiParticles] Executando animação em jogo:', animacao);
      return new Promise(resolve => {
        const c = el => {
          if (typeof _animCentro === 'function') return _animCentro(el);
          if (!el) return { x: innerWidth / 2, y: innerHeight / 2 };
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        };
        const origem = c(atacEl);
        const alvo = c(alvoEl);
        console.log('[PixiParticles] Posições - Origem:', origem, 'Alvo:', alvo);
        _runPixi(animacao, origem, alvo, resolve);
      });
    }
    return typeof _origAnimar === 'function'
      ? _origAnimar.call(this, { atacEl, alvoEl, animacao, dano })
      : Promise.resolve();
  };

  function _mkCanvas() {
    const c = document.createElement('canvas');
    c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:8888;width:100vw;height:100vh';
    c.width = innerWidth;
    c.height = innerHeight;
    document.body.appendChild(c);
    console.log('[PixiParticles] Canvas criado:', c.width, 'x', c.height);
    return c;
  }

  function _runPixi(animacao, origem, alvo, resolve) {
    console.log('[PixiParticles] _runPixi chamado');
    
    // Limpar decals antigos antes de começar
    _clearDecals();
    
    const cfg = animacao.pixi_config || {};
    const pos = animacao.posicao || 'alvo';
    const durMs = animacao.duracao || 1500;
    
    // Agendar limpeza automática de decals
    const maxDecalTime = 8000;
    _autoCleanDecals(durMs + maxDecalTime);

    if (pos === 'trajetoria') {
      const layers = Array.isArray(cfg) ? cfg : [cfg];
      _runTrajetoria(layers, origem, alvo, durMs, resolve);
      return;
    }

    const emPos = pos === 'atacante'
      ? { ...origem }
      : pos === 'meio'
      ? { x: (origem.x + alvo.x) / 2, y: (origem.y + alvo.y) / 2 }
      : { ...alvo };
    
    console.log('[PixiParticles] Posição do emissor:', emPos);
    
    const layers = Array.isArray(cfg) ? cfg : [cfg];

    if (layers.length === 1) {
      const canvas = _mkCanvas();
      const cfgR = {
        ...layers[0],
        emitterLifetime: Math.min(layers[0].emitterLifetime || 1, (durMs / 1000) * .7)
      };
      const eng = new PixiParticleEngine(canvas, cfgR, emPos);
      eng.isPreview = false; // NÃO É PREVIEW
      const t0 = performance.now();
      eng.start(() => {
        const rem = Math.max(0, durMs - (performance.now() - t0));
        setTimeout(() => {
          canvas.remove();
          resolve();
        }, rem);
      });
      setTimeout(() => {
        eng.stop();
        canvas.remove();
        resolve();
      }, durMs + 600);
      return;
    }

    _runFixo(layers, emPos, durMs, resolve);
  }

  function _runFixo(layers, emPos, durMs, resolve) {
    console.log('[PixiParticles] _runFixo - layers:', layers.length);
    const canvas = _mkCanvas();
    const travelSecs = durMs / 1000;

    const back = layers.filter(l => l.addAtBack);
    const front = layers.filter(l => !l.addAtBack);
    const ordered = [...back, ...front];

    const engines = ordered.map(layerCfg => {
      const cfgR = {
        ...layerCfg,
        emitterLifetime: Math.min(layerCfg.emitterLifetime || 1, travelSecs * 0.85),
      };
      const eng = new PixiParticleEngine(canvas, cfgR, { ...emPos });
      eng.isPreview = false; // NÃO É PREVIEW
      return eng;
    });

    const t0 = performance.now();
    let last = t0, raf = null;

    function loop(ts) {
      const dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;
      const elapsed = ts - t0;

      engines.forEach(eng => {
        eng.pos = { ...emPos };
        eng.update(dt);
      });

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      engines.forEach(eng => eng.drawNoClear());
      // NÃO DESENHA MARCADORES EM JOGO

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

  function _runTrajetoria(layers, origem, alvo, totalMs, resolve) {
    console.log('[PixiParticles] _runTrajetoria');
    const canvas = _mkCanvas();
    const t0 = performance.now();

    const back = layers.filter(l => l.addAtBack);
    const front = layers.filter(l => !l.addAtBack);
    const ordered = [...back, ...front];

    const emPos = { ...origem };

    const engines = ordered.map(layerCfg => {
      const adapted = _adaptarLayerParaTrajetoria(layerCfg, origem, alvo, totalMs, null);
      const eng = new PixiParticleEngine(canvas, adapted, { ...emPos });
      eng._spreadAngle = adapted._spreadAngle;
      eng.isPreview = false; // NÃO É PREVIEW
      return eng;
    });

    let last = t0, boom = false, raf = null;

    function loop(ts) {
      const dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;
      const elapsed = ts - t0;
      const t = Math.min(elapsed / totalMs, 1);

      const dx = alvo.x - origem.x, dy = alvo.y - origem.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const arcH = Math.min(dist * 0.15, 80);
      const cx = (origem.x + alvo.x) / 2;
      const cy = Math.min(origem.y, alvo.y) - arcH;

      emPos.x = (1 - t) * (1 - t) * origem.x + 2 * (1 - t) * t * cx + t * t * alvo.x;
      emPos.y = (1 - t) * (1 - t) * origem.y + 2 * (1 - t) * t * cy + t * t * alvo.y;

      const nt = Math.min(t + 0.02, 1);
      const tnx = (1 - nt) * (1 - nt) * origem.x + 2 * (1 - nt) * nt * cx + nt * nt * alvo.x;
      const tny = (1 - nt) * (1 - nt) * origem.y + 2 * (1 - nt) * nt * cy + nt * nt * alvo.y;
      const tangAngle = Math.atan2(tny - emPos.y, tnx - emPos.x);

      if (t >= 0.88 && !boom) {
        boom = true;
        engines.forEach(eng => {
          eng.emitterLifetime = eng.time + 0.45;
          eng.frequency = Math.max(eng.frequency * 0.35, 0.002);
          eng.maxParticles = Math.min(eng.maxParticles * 2, 350);
          eng.particlesPerWave = 3;
          eng.rotMin = 0;
          eng.rotMax = Math.PI * 2;
          eng.speedStart = eng.speedStart * 1.6;
        });
      }

      engines.forEach(eng => {
        eng.pos = { ...emPos };
        eng.rotMin = tangAngle - eng._spreadAngle;
        eng.rotMax = tangAngle + eng._spreadAngle;
        eng.update(dt);
      });

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      engines.forEach(eng => eng.drawNoClear());
      // NÃO DESENHA MARCADORES EM JOGO

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
    const sk = (window.RPG_DATA?.skills || []).find(s => String(s.id) === String(sid));
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
    if (pEl) pEl.value = anim.posicao || 'alvo';
    if (dEl) dEl.value = anim.duracao || 1500;
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
    const ov = document.getElementById('modal-skill-overlay');
    if (ov) {
      new MutationObserver(() => {
        if (ov.style.display !== 'none') _injetarUI();
      }).observe(ov, { attributes: true, attributeFilter: ['style'] });
    }
    console.log('✓ Pixi Particles Plugin v6 SAKUGA CORRIGIDO — Custom Shapes, Stretch & Squash, Persistent Decals, Advanced Timing, Impact Frames');
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    setTimeout(_init, 800);
  }

})();

// ── Abrir modal de colar pacote ───────────────────────────────────────────
window._abrirModalPacote = function() {
  const m = document.getElementById('modal-colar-pacote');
  if (m) { m.style.display = 'flex'; }
};

// Renderizar painel de sessão ao abrir aba mapas
HUB_EVENTS.on('cena_carregada', () => sessionRenderPainel());
