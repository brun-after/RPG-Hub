// systems/market.js
// RPG Hub — Secret market information system
// Includes: mercadoSelecionarTipo(), mercadoCriarInformacao(), comprarInformacao()



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

/* [migração-esm] accessors globais */
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mercadoSelecionarTipo", { configurable: true, get: () => mercadoSelecionarTipo, set: (__v) => { mercadoSelecionarTipo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mercadoCriarInformacao", { configurable: true, get: () => mercadoCriarInformacao, set: (__v) => { mercadoCriarInformacao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_limparFormularioInformacao", { configurable: true, get: () => _limparFormularioInformacao, set: (__v) => { _limparFormularioInformacao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "confirmarCompraInfo", { configurable: true, get: () => confirmarCompraInfo, set: (__v) => { confirmarCompraInfo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "comprarInformacao", { configurable: true, get: () => comprarInformacao, set: (__v) => { comprarInformacao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mostrarInformacaoAdquirida", { configurable: true, get: () => mostrarInformacaoAdquirida, set: (__v) => { mostrarInformacaoAdquirida = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "verInformacoesCompradas", { configurable: true, get: () => verInformacoesCompradas, set: (__v) => { verInformacoesCompradas = __v; } });
