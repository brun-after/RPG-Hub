// systems/creative.js
// RPG Hub — Arena attack flow and arena scenario CRUD
// Includes: abrirModalSolicitarAtaque(), arRolarEfetividade(), arena scenario management
// Tutorial system moved to: js/ui/tutorial.js

// ═══════════════════════════════════════════════════════════════
// ⚔ ARENA — Recursos adicionais: tema visual, penalidades por HP e mecânicas PvP/PvE
// ═══════════════════════════════════════════════════════════════

// ── Helper: obter config do tema da arena ─────────────────────
function arGetTheme() {
  if (!AR.session) return {};
  try {
    const t = AR.session.theme_json;
    return typeof t === 'object' ? t : JSON.parse(t || '{}');
  } catch(e) { return {}; }
}

function arGetDadoEfetividade() {
  return parseInt(arGetTheme().dado_efetividade || '20') || 20;
}

function arGetPenalidades() {
  return arGetTheme().penalidades_hp || [];
}

// Calcula penalidade total por HP% do personagem
function arCalcularPenalidadeHP(nomePersonagem: any) {
  const c = AR.chars.find((x: any) => x.nome === nomePersonagem);
  if (!c) return 0;
  const hpMax = c.hp_max ?? c.custom_attrs?.hp_max ?? 100;
  const hpAtual = c.hp_atual ?? hpMax;
  const hpPct = hpMax > 0 ? (hpAtual / hpMax) * 100 : 100;
  const pens = arGetPenalidades();
  let penTotal = 0;
  // Aplicar penalidades cumulativas (todas as que se aplicam)
  pens.forEach((p: any) => { if (hpPct < p.hp) penTotal += p.penalidade; });
  return penTotal;
}

// ══════════════════════════════════════════════════════════════
// SISTEMA DE ATAQUE ARENA — NOVO FLUXO
// ══════════════════════════════════════════════════════════════
// Estado temporário dos ataques arena
if (!AR.estado) AR.estado = {};
if (!AR.estado.ataques_arena) AR.estado.ataques_arena = [];

// Garante que o estado ataques_arena existe após carregamento
var _origArCarregarTudo = window.arCarregarTudo;
window.arCarregarTudo = async function(...args) {
  const r = await _origArCarregarTudo?.apply(this, args);
  if (!AR.estado.ataques_arena) AR.estado.ataques_arena = [];
  arRenderAtaquesArenaMestre();
  return r;
};

// Abre o modal de solicitar ataque (fluxo principal do jogador)
function abrirModalSolicitarAtaque() {
  const meuChar = arMeuChar();
  if (!meuChar) { arToast('Você não tem personagem na arena', 'erro'); return; }
  const c = AR.chars.find((x: any) => x.nome === meuChar);
  if (c && c.hp_atual <= 0) { arToast('Seu personagem está incapacitado', 'erro'); return; }
  document.getElementById('ar-atk-sol-atacante').textContent = meuChar;
  // Preencher alvos
  const sel = document.getElementById('ar-atk-sol-alvo');
  sel.innerHTML = AR.chars.filter((x: any) => x.nome !== meuChar).map((x: any) =>
    `<option value="${x.nome}">${x.nome}${x.hp_atual <= 0 ? ' [INCAP]' : ''}</option>`
  ).join('');
  document.getElementById('ar-atk-sol-descricao').value = '';
  abrirModal('ar-modal-atk-solicitar');
}

async function arEnviarSolicitacaoAtaque() {
  const atacante = arMeuChar();
  const alvo = document.getElementById('ar-atk-sol-alvo').value;
  const desc = document.getElementById('ar-atk-sol-descricao').value.trim();
  if (!atacante) { arToast('Sem personagem', 'erro'); return; }
  if (!desc) { arToast('Descreva a ação', 'erro'); return; }
  const id = 'atkarena_' + Date.now();
  const atk = { id, atacante, alvo, descricao: desc, status: 'aguardando_mestre', ts: Date.now() };
  if (!AR.estado.ataques_arena) AR.estado.ataques_arena = [];
  AR.estado.ataques_arena.push(atk);
  await arSalvarEstado();
  fecharModal('ar-modal-atk-solicitar');
  arRenderAtaquesArenaMestre();
  // Mostrar tela de aguardando para o jogador
  mostrarAtaqueAguardando(id);
  arToast('⚔ Solicitação enviada ao Mestre!', 'sucesso');
}

function mostrarAtaqueAguardando(id: any) {
  // Aguarda update via polling/realtime
  const check = setInterval(async () => {
    if (!AR.session) { clearInterval(check); return; }
    const reg = await arSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&select=arena_estado&limit=1`).catch((): any => null);
    const raw = reg && reg[0] ? reg[0].arena_estado : null;
    if (!raw) return;
    const estado = typeof raw === 'object' ? raw : JSON.parse(raw || '{}');
    const atk = (estado.ataques_arena || []).find((a: any) => a.id === id);
    if (!atk) { clearInterval(check); return; }
    if (atk.status === 'aprovado_dc') {
      clearInterval(check);
      AR.estado = estado;
      abrirModalRolarEfetividade(id);
    } else if (atk.status === 'rejeitado') {
      clearInterval(check);
      AR.estado = estado;
      arToast('✕ O Mestre negou o ataque', 'erro');
    }
  }, 2500);
  setTimeout(() => clearInterval(check), 120000); // timeout 2min
}

// Mestre: renderiza ataques pendentes de avaliação
function arRenderAtaquesArenaMestre() {
  if (AR.myRole !== 'mestre') return;
  const pendentes = (AR.estado.ataques_arena || []).filter((a: any) => a.status === 'aguardando_mestre');
  const el = document.getElementById('ar-ataques-pendentes');
  if (!el) return;
  const rolagens = (AR.estado.ataques_arena || []).filter((a: any) => a.status === 'rolagem_enviada');

  const temQualquer = pendentes.length > 0 || rolagens.length > 0;
  el.style.display = temQualquer ? 'block' : 'none';
  if (!temQualquer) { el.innerHTML = ''; return; }

  let html = '';
  if (pendentes.length) {
    html += `<div style="font-family:'Cinzel',serif;font-size:0.65rem;color:rgba(240,204,106,0.7);text-transform:uppercase;margin-bottom:8px">⚔ Solicitações de Ataque</div>`;
    html += pendentes.map((a: any) => `
      <div style="background:rgba(200,168,75,0.05);border:1px solid rgba(200,168,75,0.2);border-radius:8px;padding:12px;margin-bottom:8px">
        <div style="font-family:'Cinzel',serif;font-size:0.8rem;color:var(--destaque);margin-bottom:4px">${a.atacante} → ${a.alvo}</div>
        <div style="font-size:0.85rem;color:#b8a8a8;margin-bottom:10px;line-height:1.5;white-space:pre-line">${a.descricao}</div>
        <div style="display:flex;gap:8px">
          <button onclick="abrirModalAvaliarAtaque('${a.id}')"
            style="flex:1;padding:7px;background:rgba(39,174,96,0.1);border:1px solid rgba(39,174,96,0.3);border-radius:4px;color:#5ee09a;font-family:'Cinzel',serif;font-size:0.7rem;cursor:pointer">⚔ Avaliar</button>
          <button onclick="arMestreRejeitarAtaqueId('${a.id}')"
            style="padding:7px 12px;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.3);border-radius:4px;color:#e74c3c;font-family:'Cinzel',serif;font-size:0.7rem;cursor:pointer">✕</button>
        </div>
      </div>`).join('');
  }

  if (rolagens.length) {
    html += `<div style="font-family:'Cinzel',serif;font-size:0.65rem;color:rgba(126,200,240,0.7);text-transform:uppercase;margin:10px 0 8px">🎲 Rolagens Recebidas</div>`;
    html += rolagens.map((a: any) => {
      const dadoFaces = arGetDadoEfetividade();
      const rolou = a.rolagem ?? '?';
      const dc = a.dc ?? '?';
      const sucesso = typeof a.rolagem === 'number' && typeof a.dc === 'number' && a.rolagem >= a.dc;
      return `
      <div style="background:rgba(79,163,209,0.04);border:1px solid rgba(79,163,209,0.2);border-radius:8px;padding:12px;margin-bottom:8px">
        <div style="font-family:'Cinzel',serif;font-size:0.8rem;color:#7ec8f0;margin-bottom:4px">${a.atacante} → ${a.alvo}</div>
        <div style="font-size:0.82rem;color:#b8a8a8;margin-bottom:6px;white-space:pre-line">${a.descricao}</div>
        <div style="display:flex;gap:12px;margin-bottom:10px">
          <div><span style="font-size:0.62rem;color:#7a6060;text-transform:uppercase;font-family:'Cinzel',serif">d${dadoFaces} rolou</span>
            <div style="font-family:'Cinzel',serif;font-size:1.5rem;color:${sucesso?'#5ee09a':'#e8604c'}">${rolou}</div></div>
          <div><span style="font-size:0.62rem;color:#7a6060;text-transform:uppercase;font-family:'Cinzel',serif">DC</span>
            <div style="font-family:'Cinzel',serif;font-size:1.5rem;color:#f0cc6a">${dc}</div></div>
          <div style="display:flex;align-items:center">
            <span style="font-family:'Cinzel',serif;font-size:0.8rem;color:${sucesso?'#5ee09a':'#e8604c'};padding:4px 10px;border-radius:6px;background:${sucesso?'rgba(39,174,96,0.1)':'rgba(192,57,43,0.1)'};border:1px solid ${sucesso?'rgba(39,174,96,0.3)':'rgba(192,57,43,0.3)'}">${sucesso?'✓ Sucesso':'✕ Falha'}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="abrirModalDefinirDano('${a.id}')"
            style="flex:1;padding:7px;background:rgba(232,80,60,0.1);border:1px solid rgba(232,80,60,0.3);border-radius:4px;color:#e8604c;font-family:'Cinzel',serif;font-size:0.7rem;cursor:pointer">💥 Definir Dano</button>
          <button onclick="arMestreRejeitarAtaqueId('${a.id}')"
            style="padding:7px 12px;background:rgba(60,30,30,0.5);border:1px solid rgba(60,30,30,0.6);border-radius:4px;color:#7a6060;font-family:'Cinzel',serif;font-size:0.7rem;cursor:pointer">Ignorar</button>
        </div>
      </div>`;
    }).join('');
  }

  el.innerHTML = html;
}

function abrirModalAvaliarAtaque(id: any) {
  const atk = (AR.estado.ataques_arena || []).find((a: any) => a.id === id);
  if (!atk) return;
  document.getElementById('ar-atk-av-id').value = id;
  document.getElementById('ar-atk-av-atacante').textContent = atk.atacante;
  document.getElementById('ar-atk-av-alvo').textContent = atk.alvo;
  document.getElementById('ar-atk-av-desc').textContent = atk.descricao;
  document.getElementById('ar-atk-av-dc').value = '';
  abrirModal('ar-modal-atk-mestre-avaliar');
}

async function arMestreAprovarAtaque() {
  const id = document.getElementById('ar-atk-av-id').value;
  const dc = parseInt(document.getElementById('ar-atk-av-dc').value);
  if (!id || isNaN(dc) || dc < 1) { arToast('Informe a DC (mínimo 1)', 'erro'); return; }
  const atk = (AR.estado.ataques_arena || []).find((a: any) => a.id === id);
  if (!atk) return;
  atk.status = 'aprovado_dc';
  atk.dc = dc;
  await arSalvarEstado();
  fecharModal('ar-modal-atk-mestre-avaliar');
  arRenderAtaquesArenaMestre();
  arToast('Ataque aprovado! Aguardando rolagem do jogador…', 'sucesso');
}

async function arMestreRejeitarAtaque() {
  const id = document.getElementById('ar-atk-av-id').value;
  await arMestreRejeitarAtaqueId(id);
  fecharModal('ar-modal-atk-mestre-avaliar');
}

async function arMestreRejeitarAtaqueId(id: any) {
  const atk = (AR.estado.ataques_arena || []).find((a: any) => a.id === id);
  if (!atk) return;
  atk.status = 'rejeitado';
  arAddLog(`✕ ${atk.atacante} tentou atacar ${atk.alvo} — negado pelo Mestre`);
  await arSalvarEstado();
  arRenderAtaquesArenaMestre();
  arToast('Ataque negado', '');
  // Avançar turno ao rejeitar um ataque (jogador usou a ação)
  if (AR.iniciativa && AR.iniciativa.fase === 'combate') {
    await arProximoTurnoIniciativa();
  }
}

// Fechar modal de dano sem aplicar — avança turno mesmo assim
async function arMestreSemDanoFechar() {
  const id = document.getElementById('ar-atk-dn-id').value;
  const atk = (AR.estado.ataques_arena || []).find((a: any) => a.id === id);
  if (atk && atk.status !== 'concluido') {
    atk.status = 'concluido';
    atk.dano_aplicado = 0;
    arAddLog(`⚔ [Arena] ${atk.atacante} → ${atk.alvo} — sem dano`);
    await arSalvarEstado();
    arRenderAtaquesArenaMestre();
  }
  fecharModal('ar-modal-atk-mestre-dano');
  if (AR.iniciativa && AR.iniciativa.fase === 'combate') {
    await arProximoTurnoIniciativa();
  }
}

function abrirModalRolarEfetividade(id: any) {
  const atk = (AR.estado.ataques_arena || []).find((a: any) => a.id === id);
  if (!atk) return;
  const dado = arGetDadoEfetividade();
  const pen = arCalcularPenalidadeHP(atk.atacante);
  document.getElementById('ar-atk-rl-id').value = id;
  document.getElementById('ar-atk-rl-desc').textContent = atk.descricao;
  document.getElementById('ar-atk-rl-dado-label').textContent = `d${dado}`;
  document.getElementById('ar-atk-rl-dc').textContent = atk.dc;
  const penEl = document.getElementById('ar-atk-rl-penalidade-info');
  if (pen > 0) { penEl.textContent = `⚠ Penalidade por HP baixo: −${pen} na rolagem`; penEl.style.display = 'block'; }
  else { penEl.style.display = 'none'; }
  document.getElementById('ar-atk-rl-resultado').textContent = '—';
  document.getElementById('ar-atk-rl-resultado-sub').textContent = 'Pronto para rolar';
  document.getElementById('ar-atk-rl-resultado').style.color = '#e8604c';
  document.getElementById('ar-atk-rl-btn-confirmar').style.display = 'none';
  document.getElementById('ar-atk-rl-btn-rolar').style.display = '';
  abrirModal('ar-modal-atk-rolar');
}

function arRolarEfetividade() {
  const id = document.getElementById('ar-atk-rl-id').value;
  const atk = (AR.estado.ataques_arena || []).find((a: any) => a.id === id);
  if (!atk) return;
  const dado = arGetDadoEfetividade();
  const rolagem = Math.floor(Math.random() * dado) + 1;
  const pen = arCalcularPenalidadeHP(atk.atacante);
  const rolagemFinal = Math.max(1, rolagem - pen);
  const sucesso = rolagemFinal >= (atk.dc || 0);

  const el = document.getElementById('ar-atk-rl-resultado');
  el.style.transform = 'scale(0.6)'; el.style.opacity = '0';
  setTimeout(() => {
    el.textContent = rolagemFinal + (pen > 0 && pen !== 0 ? ` (${rolagem}−${pen})` : '');
    el.style.color = sucesso ? '#5ee09a' : '#e74c3c';
    el.style.transform = 'scale(1)'; el.style.opacity = '1';
    document.getElementById('ar-atk-rl-resultado-sub').textContent = sucesso ? `✓ Sucesso! Tirou ${rolagemFinal} ≥ ${atk.dc}` : `✕ Falha. Tirou ${rolagemFinal} < ${atk.dc}`;
    document.getElementById('ar-atk-rl-btn-rolar').style.display = 'none';
    document.getElementById('ar-atk-rl-btn-confirmar').style.display = '';
    // Guardar temporariamente
    (document.getElementById('ar-atk-rl-btn-confirmar') as any).dataset.rolagem = rolagemFinal;
  }, 150);
}

async function arConfirmarRolagemEfetividade() {
  const id = document.getElementById('ar-atk-rl-id').value;
  const rolagemFinal = parseInt(document.getElementById('ar-atk-rl-btn-confirmar').dataset.rolagem);
  const atk = (AR.estado.ataques_arena || []).find((a: any) => a.id === id);
  if (!atk) return;
  atk.rolagem = rolagemFinal;
  atk.status = 'rolagem_enviada';
  await arSalvarEstado();
  fecharModal('ar-modal-atk-rolar');
  arToast('Rolagem enviada ao Mestre!', 'sucesso');
  // Polling para resultado
  const check = setInterval(async () => {
    if (!AR.session) { clearInterval(check); return; }
    const reg = await arSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&select=arena_estado&limit=1`).catch((): any => null);
    const raw = reg && reg[0] ? reg[0].arena_estado : null;
    if (!raw) return;
    const estado = typeof raw === 'object' ? raw : JSON.parse(raw || '{}');
    const a = (estado.ataques_arena || []).find((x: any) => x.id === id);
    if (!a) { clearInterval(check); return; }
    if (a.status === 'concluido') {
      clearInterval(check);
      AR.estado = estado;
      renderArenaPersonagens(); renderArenaEntidades();
    }
  }, 2500);
  setTimeout(() => clearInterval(check), 120000);
}

function abrirModalDefinirDano(id: any) {
  const atk = (AR.estado.ataques_arena || []).find((a: any) => a.id === id);
  if (!atk) return;
  document.getElementById('ar-atk-dn-id').value = id;
  document.getElementById('ar-atk-dn-atacante').textContent = atk.atacante;
  document.getElementById('ar-atk-dn-alvo').textContent = atk.alvo;
  document.getElementById('ar-atk-dn-desc').textContent = atk.descricao;
  document.getElementById('ar-atk-dn-dc').textContent = atk.dc ?? '?';
  const rolEl = document.getElementById('ar-atk-dn-rolagem');
  const sucesso = typeof atk.rolagem === 'number' && typeof atk.dc === 'number' && atk.rolagem >= atk.dc;
  rolEl.textContent = atk.rolagem ?? '?';
  rolEl.style.color = sucesso ? '#5ee09a' : '#e8604c';
  document.getElementById('ar-atk-dn-status-badge').innerHTML = `<span style="font-family:'Cinzel',serif;font-size:0.72rem;padding:3px 8px;border-radius:4px;background:${sucesso?'rgba(39,174,96,0.1)':'rgba(192,57,43,0.1)'};color:${sucesso?'#5ee09a':'#e8604c'};border:1px solid ${sucesso?'rgba(39,174,96,0.3)':'rgba(192,57,43,0.3)'}">${sucesso?'Sucesso':'Falha'}</span>`;
  // Alvos possíveis — todos participantes
  const alvosEl = document.getElementById('ar-atk-dn-alvos-check');
  alvosEl.innerHTML = AR.chars.map((c: any) => {
    const isAlvoPrincipal = c.nome === atk.alvo;
    return `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(20,12,12,0.6);border:1px solid rgba(60,30,30,0.5);border-radius:6px;cursor:pointer;${isAlvoPrincipal?'border-color:rgba(232,80,60,0.3)':''}">
      <input type="checkbox" value="${c.nome}" ${isAlvoPrincipal?'checked':''} style="accent-color:#e8604c">
      <span style="font-family:'Cinzel',serif;font-size:0.82rem;color:${isAlvoPrincipal?'#e8604c':'#b8a8a8'}">${c.nome}</span>
      <span style="font-size:0.72rem;color:#7a6060">(${c.hp_atual??'?'} HP)</span>
    </label>`;
  }).join('');
  // Resetar modo dano
  arAtkDnModo('dado');
  document.getElementById('ar-atk-dn-resultado-dado').textContent = '—';
  document.getElementById('ar-atk-dn-resultado-dado').dataset.total = '';
  document.getElementById('ar-atk-dn-valor-fixo').value = '';
  // Reset animação
  const el_tipo = document.getElementById('ar-atk-dn-anim-tipo');
  if (el_tipo) { el_tipo.value = 'nenhuma'; arAnimDnTipoChange(); }
  const _arRId = (id: any) => document.getElementById(id);
  if (_arRId('ar-atk-dn-anim-icone'))   _arRId('ar-atk-dn-anim-icone').value  = '';
  if (_arRId('ar-atk-dn-anim-cor'))     _arRId('ar-atk-dn-anim-cor').value    = '#e74c3c';
  if (_arRId('ar-atk-dn-anim-trilha'))  _arRId('ar-atk-dn-anim-trilha').checked = false;
  if (_arRId('ar-atk-dn-anim-url'))     _arRId('ar-atk-dn-anim-url').value    = '';
  if (_arRId('ar-atk-dn-anim-svg'))     _arRId('ar-atk-dn-anim-svg').value    = '';
  if (_arRId('ar-atk-dn-anim-tamanho')) _arRId('ar-atk-dn-anim-tamanho').value = 120;
  if (_arRId('ar-atk-dn-anim-duracao')) _arRId('ar-atk-dn-anim-duracao').value = 1500;
  if (_arRId('ar-atk-dn-anim-posicao')) _arRId('ar-atk-dn-anim-posicao').value = 'alvo';
  abrirModal('ar-modal-atk-mestre-dano');
}

function arAtkDnModo(modo: any) {
  const dado = document.getElementById('ar-atk-dn-campos-dado');
  const fixo = document.getElementById('ar-atk-dn-campos-fixo');
  const btnDado = document.getElementById('ar-atk-dn-modo-dado');
  const btnFixo = document.getElementById('ar-atk-dn-modo-fixo');
  if (modo === 'dado') {
    dado.style.display = 'flex'; fixo.style.display = 'none';
    btnDado.style.background = 'rgba(232,80,60,0.12)'; btnDado.style.color = '#e8604c'; btnDado.style.borderColor = 'rgba(232,80,60,0.4)';
    btnFixo.style.background = 'transparent'; btnFixo.style.color = '#7a6060'; btnFixo.style.borderColor = 'rgba(60,30,30,0.6)';
  } else {
    dado.style.display = 'none'; fixo.style.display = 'block';
    btnFixo.style.background = 'rgba(232,80,60,0.12)'; btnFixo.style.color = '#e8604c'; btnFixo.style.borderColor = 'rgba(232,80,60,0.4)';
    btnDado.style.background = 'transparent'; btnDado.style.color = '#7a6060'; btnDado.style.borderColor = 'rgba(60,30,30,0.6)';
  }
}

function arAtkDnRolarDado() {
  const qtd = parseInt(document.getElementById('ar-atk-dn-qtd').value) || 1;
  const faces = parseInt(document.getElementById('ar-atk-dn-tipo-dado').value) || 6;
  let total = 0; const rolls = [];
  for (let i = 0; i < qtd; i++) { const r = Math.floor(Math.random()*faces)+1; rolls.push(r); total += r; }
  const el = document.getElementById('ar-atk-dn-resultado-dado');
  el.textContent = total + (rolls.length > 1 ? ` (${rolls.join('+')})` : '');
  (el as any).dataset.total = total;
}

async function arMestreAplicarDano() {
  const id = document.getElementById('ar-atk-dn-id').value;
  const atk = (AR.estado.ataques_arena || []).find((a: any) => a.id === id);
  if (!atk) return;

  // Calcular dano
  let dano = 0;
  const modoFixo = document.getElementById('ar-atk-dn-campos-fixo').style.display !== 'none';
  if (modoFixo) {
    dano = parseInt(document.getElementById('ar-atk-dn-valor-fixo').value) || 0;
  } else {
    dano = parseInt(document.getElementById('ar-atk-dn-resultado-dado').dataset.total) || 0;
  }

  // Alvos selecionados
  const alvosChecks = document.querySelectorAll('#ar-atk-dn-alvos-check input[type=checkbox]:checked');
  const alvos = Array.from(alvosChecks).map(c => c.value);

  if (!alvos.length) { arToast('Selecione pelo menos um alvo', 'erro'); return; }

  // ── Animação antes do dano ──────────────────────────────────
  const arAnimTipo = document.getElementById('ar-atk-dn-anim-tipo')?.value || 'nenhuma';
  if (arAnimTipo !== 'nenhuma') {
    const _arIsMidia = ['gif','imagem','svg','iframe'].includes(arAnimTipo);
    const arAnim: any = { tipo: arAnimTipo };
    if (_arIsMidia) {
      (arAnim as any).url     = (arAnimTipo !== 'svg' ? document.getElementById('ar-atk-dn-anim-url')?.value.trim() : '') || '';
      (arAnim as any).svg     = arAnimTipo === 'svg' ? document.getElementById('ar-atk-dn-anim-svg')?.value.trim() : '';
      (arAnim as any).tamanho = parseInt(document.getElementById('ar-atk-dn-anim-tamanho')?.value) || 120;
      (arAnim as any).duracao = parseInt(document.getElementById('ar-atk-dn-anim-duracao')?.value) || 1500;
      (arAnim as any).posicao = document.getElementById('ar-atk-dn-anim-posicao')?.value || 'alvo';
    } else {
      (arAnim as any).cor    = document.getElementById('ar-atk-dn-anim-cor')?.value   || '#e74c3c';
      (arAnim as any).icone  = document.getElementById('ar-atk-dn-anim-icone')?.value.trim() || '';
      arAnim.trilha = document.getElementById('ar-atk-dn-anim-trilha')?.checked || false;
    }
    // Para cada alvo, animar atacante→alvo
    for (const nomeAlvo of alvos) {
      const payload = {
        sid: _ANIM_SID,
        atacanteNome: atk.atacante,
        alvoNome: nomeAlvo,
        contexto: 'arena',
        animacao: arAnim,
        dano,
      };
      animBroadcast(payload);
      try {
        const atacEl = resolverTokenEl(atk.atacante, 'arena');
        const alvoEl = resolverTokenEl(nomeAlvo, 'arena');
        if (atacEl && alvoEl) await animarAtaque({ atacEl, alvoEl, animacao: arAnim, dano });
      } catch(e) {}
    }
  }

  // Aplicar dano a cada alvo selecionado
  for (const nomeAlvo of alvos) {
    if (dano > 0) await atkAplicarDano(nomeAlvo, dano, 'arena', 'fisico');
  }

  atk.status = 'concluido';
  atk.dano_aplicado = dano;
  atk.alvos_atingidos = alvos;
  const alvosStr = alvos.join(', ');
  arAddLog(`⚔ [Arena] ${atk.atacante} → ${alvosStr} — ${dano} de dano | Rolou ${atk.rolagem ?? '?'} (DC ${atk.dc})`);
  await arSalvarEstado();
  fecharModal('ar-modal-atk-mestre-dano');
  renderArenaPersonagens(); renderArenaEntidades(); renderMesa();
  arRenderAtaquesArenaMestre();
  arToast(`💥 ${dano} de dano aplicado em: ${alvosStr}`, 'sucesso');
  // Avançar turno automaticamente após resolver o ataque
  if (AR.iniciativa && AR.iniciativa.fase === 'combate') {
    await arProximoTurnoIniciativa();
  }
}

// ═══════════════════════════════════════════════════════════════
// BOTÃO DE ATAQUE ARENA NO TURNO — ABRE MODAL SOLICITAR
// ═══════════════════════════════════════════════════════════════
// Sobrescrever arAcaoAtacar para usar novo fluxo
var _origArAcaoAtacar = window.arAcaoAtacar;
window.arAcaoAtacar = async function() {
  if (AR.myRole === 'mestre') { _origArAcaoAtacar?.(); return; }
  abrirModalSolicitarAtaque();
};

// ═══════════════════════════════════════════════════════════════
// CENÁRIOS LISTA — NOVO SISTEMA
// ═══════════════════════════════════════════════════════════════
function arPreviewCenarioListaImg(url: any) {
  const prev = document.getElementById('ar-cenario-lista-img-preview');
  const img = document.getElementById('ar-cenario-lista-img-el');
  if (!url) { prev.style.display = 'none'; return; }
  img.src = url;
  prev.style.display = 'block';
}

function abrirModalCriarCenarioLista(idEditar: any) {
  const modal = document.getElementById('ar-modal-cenario-lista');
  document.getElementById('ar-cenario-lista-id').value = idEditar || '';
  // Reset bg tabs
  arCenBgTab('url');
  arCenBgClearUpload();
  _arCenUploadDataUrl = null;
  _arCenSvgDataUrl = null;
  _arCenCanvasDataUrl = null;
  const svgInput = document.getElementById('ar-cen-svg-input');
  if (svgInput) svgInput.value = '';
  const svgPrev = document.getElementById('ar-cen-svg-preview-wrap');
  if (svgPrev) svgPrev.style.display = 'none';
  const cvPrev = document.getElementById('ar-cen-canvas-preview-wrap');
  if (cvPrev) cvPrev.style.display = 'none';

  if (idEditar) {
    const cen = (AR.estado.cenarios_lista || []).find((c: any) => c.id === idEditar);
    if (!cen) return;
    document.getElementById('ar-cenario-lista-titulo').textContent = 'Editar Cenário';
    document.getElementById('ar-cenario-lista-nome').value = cen.nome || '';
    document.getElementById('ar-cenario-lista-desc').value = cen.descricao || '';
    // Pré-preencher URL se existir
    document.getElementById('ar-cen-img').value = cen.img || '';
    if (cen.img) arCenBgUrlPreview(cen.img);
    document.getElementById('ar-cenario-lista-grid').value = cen.grid ?? '20';
    document.getElementById('ar-cenario-lista-escala-val').value = cen.escala_val ?? '1.5';
    document.getElementById('ar-cenario-lista-escala-unit').value = cen.escala_unit || 'm';
  } else {
    document.getElementById('ar-cenario-lista-titulo').textContent = 'Novo Cenário';
    document.getElementById('ar-cenario-lista-nome').value = '';
    document.getElementById('ar-cenario-lista-desc').value = '';
    document.getElementById('ar-cen-img').value = '';
    document.getElementById('ar-cenario-lista-grid').value = '20';
    document.getElementById('ar-cenario-lista-escala-val').value = '1.5';
    document.getElementById('ar-cenario-lista-escala-unit').value = 'm';
  }
  abrirModal('ar-modal-cenario-lista');
}

async function salvarCenarioLista() {
  const idEditar = document.getElementById('ar-cenario-lista-id').value;
  const nome = document.getElementById('ar-cenario-lista-nome').value.trim();
  const desc = document.getElementById('ar-cenario-lista-desc').value.trim();
  const img = arCenBgGetFinal();
  const grid = parseInt(document.getElementById('ar-cenario-lista-grid').value) || 0;
  const escalaVal = parseFloat(document.getElementById('ar-cenario-lista-escala-val').value) || 1.5;
  const escalaUnit = document.getElementById('ar-cenario-lista-escala-unit').value || 'm';
  if (!nome) { arToast('Informe o título', 'erro'); return; }

  if (!AR.estado.cenarios_lista) AR.estado.cenarios_lista = [];

  const isMestre = AR.myRole === 'mestre';
  const id = idEditar || ('cen_' + Date.now());

  if (idEditar) {
    // Editar — verificar permissões
    const idx = AR.estado.cenarios_lista.findIndex((c: any) => c.id === idEditar);
    if (idx < 0) return;
    const cen = AR.estado.cenarios_lista[idx];
    const isCenarioAtivo = AR.estado.cenario_ativo_id === idEditar;

    if (isCenarioAtivo && !isMestre) { arToast('Só o Mestre pode editar o cenário ativo', 'erro'); return; }
    if (!isMestre && cen.autor !== AR.myNickname) { arToast('Você não pode editar o cenário de outro jogador', 'erro'); return; }

    if (!isMestre) {
      // Jogador editando cenário não-ativo: salvar como proposta de edição
      const proposta = { id: 'prop_' + Date.now(), tipo: 'edicao', cenario_id: idEditar, nome, descricao: desc, img, grid, escala_val: escalaVal, escala_unit: escalaUnit, autor: AR.myNickname, ts: Date.now() };
      if (!AR.estado.propostas_cenario) AR.estado.propostas_cenario = [];
      AR.estado.propostas_cenario.push(proposta);
      await arSalvarEstado();
      fecharModal('ar-modal-cenario-lista');
      renderCenariosLista();
      renderPropostasCenario();
      arToast('Edição enviada para aprovação do Mestre!', 'sucesso');
      return;
    }

    AR.estado.cenarios_lista[idx] = { ...cen, nome, descricao: desc, img, grid, visao: 'iso', escala_val: escalaVal, escala_unit: escalaUnit };
  } else {
    // Criar novo
    const novo = { id, nome, descricao: desc, img, grid, visao: 'iso', escala_val: escalaVal, escala_unit: escalaUnit, autor: AR.myNickname, ts: Date.now() };
    if (isMestre) {
      AR.estado.cenarios_lista.push(novo);
    } else {
      // Jogador: adicionar como proposta de criação
      if (!AR.estado.propostas_cenario) AR.estado.propostas_cenario = [];
      AR.estado.propostas_cenario.push({ ...novo, tipo: 'criacao', status: 'pendente' });
      await arSalvarEstado();
      fecharModal('ar-modal-cenario-lista');
      renderPropostasCenario();
      arToast('Cenário enviado para aprovação do Mestre!', 'sucesso');
      return;
    }
  }

  await arSalvarEstado();
  fecharModal('ar-modal-cenario-lista');
  renderCenariosLista();
  renderArenaCenario();
  renderMesa();
  arToast('Cenário salvo!', 'sucesso');
}

async function arAtivarCenarioLista(id: any) {
  if (AR.myRole !== 'mestre') { arToast('Só o Mestre pode ativar cenários', 'erro'); return; }
  const cen = (AR.estado.cenarios_lista || []).find((c: any) => c.id === id);
  if (!cen) return;
  AR.estado.cenario_ativo_id = id;
  AR.estado.cenario = cen.descricao || cen.nome;
  AR.estado.cenario_img = cen.img || '';
  // Aplicar escala da grade se definida
  if (cen.grid !== undefined) MESA.escala.grid = cen.grid;
  if (cen.escala_val !== undefined) MESA.escala.val = cen.escala_val;
  if (cen.escala_unit !== undefined) MESA.escala.unit = cen.escala_unit;
  MESA.escala.visao = 'iso'; // Arena sempre isométrica
  arAddLog(`📍 Cenário ativado: ${cen.nome}`);
  await arSalvarEstado();
  renderArenaCenario();
  renderCenariosLista();
  renderMesa();
  arToast(`Cenário "${cen.nome}" ativado!`, 'sucesso');
}

function renderCenariosLista() {
  const el = document.getElementById('ar-cenarios-lista');
  if (!el) return;
  const isMestre = AR.myRole === 'mestre';
  const cenarios = AR.estado.cenarios_lista || [];
  const ativoId = AR.estado.cenario_ativo_id;
  if (!cenarios.length) { el.innerHTML = '<div class="ar-empty">Nenhum cenário criado ainda</div>'; return; }
  el.innerHTML = cenarios.map((cen: any) => {
    const isAtivo = cen.id === ativoId;
    const ehMeu = cen.autor === AR.myNickname;
    const podeEditar = isMestre || (ehMeu && !isAtivo);
    return `<div style="background:rgba(20,12,12,0.8);border:1px solid ${isAtivo?'rgba(232,80,60,0.4)':'rgba(60,30,30,0.5)'};border-radius:10px;padding:12px;${isAtivo?'box-shadow:0 0 12px rgba(232,80,60,0.1)':''}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px">
        <div>
          <span style="font-family:'Cinzel',serif;font-size:0.88rem;color:${isAtivo?'#e8604c':'#b8a8a8'}">${cen.nome}</span>
          ${isAtivo ? '<span style="font-size:0.6rem;color:#e8604c;border:1px solid rgba(232,80,60,0.4);border-radius:10px;padding:1px 6px;margin-left:6px;font-family:\'Cinzel\',serif">ATIVO</span>' : ''}
          ${cen.autor ? `<div style="font-size:0.62rem;color:#5a4040;margin-top:2px">por ${cen.autor}</div>` : ''}
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          ${isMestre && !isAtivo ? `<button onclick="arAtivarCenarioLista('${cen.id}')" style="padding:4px 8px;background:rgba(232,80,60,0.1);border:1px solid rgba(232,80,60,0.3);border-radius:4px;color:#e8604c;font-family:'Cinzel',serif;font-size:0.58rem;cursor:pointer">Ativar</button>` : ''}
          ${podeEditar ? `<button onclick="abrirModalCriarCenarioLista('${cen.id}')" style="padding:4px 8px;background:transparent;border:1px solid rgba(60,30,30,0.6);border-radius:4px;color:#7a6060;font-family:'Cinzel',serif;font-size:0.58rem;cursor:pointer">✎</button>` : ''}
          ${isMestre && !isAtivo ? `<button onclick="arDeletarCenario('${cen.id}')" style="padding:4px 8px;background:transparent;border:1px solid rgba(192,57,43,0.3);border-radius:4px;color:#c0392b;font-size:0.65rem;cursor:pointer">✕</button>` : ''}
        </div>
      </div>
      ${cen.descricao ? `<div style="font-size:0.82rem;color:#9a8888;line-height:1.4">${cen.descricao.slice(0,120)}${cen.descricao.length>120?'…':''}</div>` : ''}
      ${cen.img ? `<div style="margin-top:6px;font-size:0.65rem;color:#5a4040">🖼 Imagem definida</div>` : ''}
      ${cen.grid ? `<div style="font-size:0.65rem;color:#5a4040;margin-top:2px">🗺 Grade: ${cen.grid}×${cen.grid} · ${cen.escala_val||1.5}${cen.escala_unit||'m'}/quadrado</div>` : ''}
    </div>`;
  }).join('');
}

async function arDeletarCenario(id: any) {
  if (AR.myRole !== 'mestre') return;
  if (!confirm('Remover este cenário?')) return;
  AR.estado.cenarios_lista = (AR.estado.cenarios_lista || []).filter((c: any) => c.id !== id);
  await arSalvarEstado();
  renderCenariosLista();
  arToast('Cenário removido', '');
}

// ═══════════════════════════════════════════════════════════════
// ARENA CENÁRIO — 4 MODOS DE FUNDO (URL / UPLOAD / SVG / CANVAS)
// Paralelo ao sistema de campanha, sem interferência
// ═══════════════════════════════════════════════════════════════
var _arCenBgTab       = 'url';
var _arCenUploadDataUrl: any = null;
var _arCenSvgDataUrl: any    = null;
var _arCenCanvasDataUrl: any = null;

function arCenBgTab(tab: any) {
  _arCenBgTab = tab;
  const tabs = ['url','upload','svg','canvas'];
  tabs.forEach(t => {
    const btn   = document.getElementById('ar-cen-tab-' + t);
    const panel = document.getElementById('ar-cen-panel-' + t);
    if (!btn || !panel) return;
    const active = t === tab;
    btn.style.background = active ? '#e8604c' : 'transparent';
    btn.style.color      = active ? '#fff' : '#7a6060';
    panel.style.display  = active ? 'block' : 'none';
  });
}

function arCenBgGetFinal() {
  if (_arCenBgTab === 'url')    return (document.getElementById('ar-cen-img')?.value || '').trim();
  if (_arCenBgTab === 'upload') return _arCenUploadDataUrl || '';
  if (_arCenBgTab === 'svg')    return _arCenSvgDataUrl || '';
  if (_arCenBgTab === 'canvas') return _arCenCanvasDataUrl || '';
  return '';
}

function arCenBgUrlPreview(url: any) {
  const prev = document.getElementById('ar-cen-img-preview');
  if (!prev) return;
  if (url) { prev.src = url; prev.style.display = 'block'; }
  else { prev.style.display = 'none'; }
}

async function arCenBgUpload(input: any) {
  const file = input.files?.[0]; if (!file) return;
  try {
    mostrarToast('Enviando cenário…', 'info');
    _arCenUploadDataUrl = await uploadToStorage(file, 'arena');
    const preview = document.getElementById('ar-cen-upload-preview');
    const wrap    = document.getElementById('ar-cen-upload-preview-wrap');
    if (preview) preview.src = _arCenUploadDataUrl;
    if (wrap)    wrap.style.display = 'block';
  } catch(e) {
    mostrarToast('Erro no upload do cenário', 'erro');
    console.error(e);
  }
}

function arCenBgClearUpload() {
  _arCenUploadDataUrl = null;
  const input   = document.getElementById('ar-cen-upload-input');
  const preview = document.getElementById('ar-cen-upload-preview');
  const wrap    = document.getElementById('ar-cen-upload-preview-wrap');
  if (input)   input.value = '';
  if (preview) preview.src = '';
  if (wrap)    wrap.style.display = 'none';
}

function arCenBgSvgPreview(svgText: any) {
  const warn = document.getElementById('ar-cen-svg-warn');
  const prevWrap = document.getElementById('ar-cen-svg-preview-wrap');
  const prevEl   = document.getElementById('ar-cen-svg-preview');
  if (!svgText.trim()) {
    _arCenSvgDataUrl = null;
    if (prevWrap) prevWrap.style.display = 'none';
    if (warn) warn.style.display = 'none';
    return;
  }
  if (!svgText.trim().startsWith('<svg') && !svgText.trim().startsWith('<?xml')) {
    if (warn) { warn.style.display = 'block'; warn.style.background = 'rgba(192,57,43,0.1)'; warn.style.color = '#e74c3c'; warn.style.border = '1px solid rgba(192,57,43,0.2)'; warn.textContent = '⚠ Isso não parece um SVG válido.'; }
    if (prevWrap) prevWrap.style.display = 'none';
    _arCenSvgDataUrl = null;
    return;
  }
  if (warn) warn.style.display = 'none';
  const blob = new Blob([svgText], {type:'image/svg+xml'});
  const url = URL.createObjectURL(blob);
  _arCenSvgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
  if (prevEl) prevEl.innerHTML = `<img src="${url}" style="max-height:130px;max-width:100%;object-fit:contain">`;
  if (prevWrap) prevWrap.style.display = 'block';
}

function arCenCopiarPromptSVG() {
  const nome = document.getElementById('ar-cenario-lista-nome')?.value?.trim() || '';
  const desc = document.getElementById('ar-cenario-lista-desc')?.value?.trim() || '';
  const prompt = `Crie um mapa SVG para uma arena de batalha RPG com perspectiva dimétrica estilo Diablo 3.

PERSPECTIVA OBRIGATÓRIA — DIMÉTRICA ESTILO DIABLO 3:
• Câmera ortográfica: sem ponto de fuga, paralelas nunca convergem
• Rotação Z 45°: grid visto na diagonal (quadrados viram losangos)
• Inclinação X ~60°: câmera alta, levemente sobre o ombro do personagem
• Pisos: losangos largos (~2:1 H:V). Centro isométrico em aprox. 400,250
• Paredes e objetos: 3 faces visíveis (topo plano, face-esquerda, face-direita)
• Iluminação: fonte superior-esquerda — topo claro, face-esq médio, face-dir escura
• Sombras paralelas projetadas no chão (não radiais) para tudo com altura
• Oclusão: fundo→frente (objetos do topo do SVG renderizados antes)
• Objetos ao fundo podem ser sutilmente menores, reforçando o 3D do Diablo

ESPECIFICAÇÕES TÉCNICAS:
• viewBox="0 0 800 500"
• Sem <script>, sem <image> src externo
• Elementos: <path> <polygon> <rect> <circle> <ellipse> <g> <defs> <linearGradient> <radialGradient> <pattern> <filter> <use> <symbol>
• <symbol> + <use> para elementos repetidos
• Máximo 200KB

${nome ? 'TEMA DA ARENA: ' + nome : ''}
${desc ? 'DESCRIÇÃO: ' + desc : 'Campo de batalha fantástico com obstáculos variados (crateras, rochas, ruínas, plataformas).'}

Retorne APENAS o código SVG completo, sem explicações, sem markdown.`; 
  navigator.clipboard.writeText(prompt).then(() => {
    const btn = document.getElementById('ar-cen-svg-copy-btn');
    const lbl = document.getElementById('ar-cen-svg-copy-lbl');
    if (lbl) lbl.textContent = '✓ Copiado!';
    if (btn) btn.style.color = '#5ee09a';
    setTimeout(() => { if (lbl) lbl.textContent = 'Copiar prompt SVG (genérico)'; if (btn) btn.style.color = '#f0cc6a'; }, 2000);
  });
}

// Variável de contexto para o canvas editor compartilhado
// 'nm' = modal de mapa de campanha | 'ar-cen' = cenário arena
var _nmceContext = 'nm';

function arCenAbrirCanvas() {
  _nmceContext = 'ar-cen';
  // Pré-carregar resultado anterior se existir
  nmCE._uploadDataUrl = _arCenCanvasDataUrl || null;
  nmceInit();
  if (_arCenCanvasDataUrl) {
    // Restaurar desenho anterior no canvas
    const img = new Image();
    img.onload = () => {
      const c = document.getElementById('nmce-canvas');
      if (c) { const ctx = c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); ctx.drawImage(img,0,0,c.width,c.height); nmCE.history = []; if (typeof nmcePushHistory === 'function') nmcePushHistory(); }
    };
    img.src = _arCenCanvasDataUrl;
  }
  nmceFullscreenAbrir();
}

// Sobrescrever renderPropostasCenario para incluir propostas de cenário da lista
var _origRenderPropostas = window.renderPropostasCenario;
window.renderPropostasCenario = function() {
  const wrap = document.getElementById('ar-cenario-propostas-wrap');
  const list = document.getElementById('ar-cenario-propostas-list');
  if (!wrap || !list || AR.myRole !== 'mestre') return;
  const propostas = AR.estado.propostas_cenario || [];
  wrap.style.display = propostas.length ? 'block' : 'none';
  list.innerHTML = propostas.map((p: any) => {
    const isCriacao = p.tipo === 'criacao' || !p.tipo;
    const isEdicao = p.tipo === 'edicao';
    const titulo = isCriacao ? `💡 Novo cenário de <strong>${p.autor||'jogador'}</strong>`
                              : `✎ Edição de cenário por <strong>${p.autor||'jogador'}</strong>`;
    return `<div class="ar-proposta-card pendente">
      <div class="ar-proposta-titulo">${titulo}</div>
      <div class="ar-proposta-desc"><strong>${p.nome}</strong>: ${p.texto || p.descricao || ''}</div>
      ${p.img ? `<div style="font-size:0.72rem;color:#7a6060">🖼 ${p.img.slice(0,40)}${p.img.length>40?'…':''}</div>` : ''}
      ${p.grid ? `<div style="font-size:0.65rem;color:#5a4040">🗺 Grade: ${p.grid}×${p.grid}</div>` : ''}
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="ar-inline-btn" style="color:#5ee09a;border-color:rgba(39,174,96,0.3)" onclick="arAprovarPropostaCenarioLista('${p.id}')">✓ Aprovar</button>
        <button class="ar-inline-btn-danger" onclick="arRejeitarPropostaCenario('${p.id}')">✕ Rejeitar</button>
      </div>
    </div>`;
  }).join('') || '<div class="ar-empty">Nenhuma proposta pendente</div>';
};

async function arAprovarPropostaCenarioLista(id: any) {
  const p = (AR.estado.propostas_cenario||[]).find((x: any)=>x.id===id);
  if (!p) return;
  if (!AR.estado.cenarios_lista) AR.estado.cenarios_lista = [];
  const isCriacao = p.tipo === 'criacao' || !p.tipo;
  if (isCriacao) {
    AR.estado.cenarios_lista.push({ id: 'cen_'+Date.now(), nome: p.nome||p.texto, descricao: p.descricao||p.texto, img: p.img||'', grid: p.grid, escala_val: p.escala_val, escala_unit: p.escala_unit, autor: p.autor, ts: p.ts });
  } else if (p.tipo === 'edicao') {
    const idx = AR.estado.cenarios_lista.findIndex((c: any) => c.id === p.cenario_id);
    if (idx >= 0) AR.estado.cenarios_lista[idx] = { ...AR.estado.cenarios_lista[idx], nome: p.nome, descricao: p.descricao, img: p.img, grid: p.grid, escala_val: p.escala_val, escala_unit: p.escala_unit };
  }
  AR.estado.propostas_cenario = (AR.estado.propostas_cenario||[]).filter((x: any)=>x.id!==id);
  await arSalvarEstado();
  renderCenariosLista();
  renderPropostasCenario();
  arToast('Cenário aprovado!', 'sucesso');
}

// Sobrescrever renderArenaCenario para incluir a nova lista
var _origRenderArenaCenario = window.renderArenaCenario;
window.renderArenaCenario = function() {
  _origRenderArenaCenario?.();
  renderCenariosLista();
  renderPropostasCenario();
  arRenderAtaquesArenaMestre();
};

// ═══════════════════════════════════════════════════════════════
// Atualizar UI do cenário com novos botões
// ═══════════════════════════════════════════════════════════════
var _origArAtualizarUIpeloPapel = window.arAtualizarUIpeloPapel;
window.arAtualizarUIpeloPapel = function() {
  _origArAtualizarUIpeloPapel?.();
  renderCenariosLista();
  renderPropostasCenario();
};

// Expor renderCenariosLista globalmente para chamadas no arTab
var _origArTab = window.arTab;
window.arTab = function(nome, btn) {
  _origArTab?.call(this, nome, btn);
  if (nome === 'cenario') {
    renderCenariosLista();
    renderPropostasCenario();
    arRenderAtaquesArenaMestre();
  }
  if (nome === 'mesa') { arRenderAtaquesArenaMestre(); }
};

// Garante que atk mestre aparece na Mesa também
var _origRenderMesa = window.renderMesa;
window.renderMesa = function() {
  _origRenderMesa?.();
  arRenderAtaquesArenaMestre();
};

// ═══════════════════════════════════════════════════════════════
// EXTENSÃO: SISTEMA DE APROVAÇÕES DE CAMPANHA
// ═══════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────────
// Função para fazer scroll até o painel de aprovações
// ────────────────────────────────────────────────────────────────
window.scrollToPendingApprovals = function() {
  console.log('[Scroll] Iniciando scroll para aprovações pendentes...');
  
  // Renderizar/criar o painel e obter o elemento diretamente
  let el: any = null;
  if (typeof criativoRenderMestre === 'function') {
    el = criativoRenderMestre();
    console.log('[Scroll] criativoRenderMestre retornou:', el ? 'elemento' : 'null');
  }
  
  // Se não conseguiu pelo retorno, tentar buscar no DOM
  if (!el) {
    el = document.getElementById('criativos-mestre-wrap');
    console.log('[Scroll] getElementById retornou:', el ? 'elemento' : 'null');
  }
  
  // Última tentativa: buscar dentro do painel de ações
  if (!el) {
    const mesaAcaoPainel = document.getElementById('mesa-acao-painel');
    if (mesaAcaoPainel) {
      el = mesaAcaoPainel.querySelector('#criativos-mestre-wrap');
      console.log('[Scroll] querySelector retornou:', el ? 'elemento' : 'null');
    }
  }
  
  if (el) {
    console.log('[Scroll] Elemento encontrado. Display atual:', el.style.display);
    console.log('[Scroll] Conteúdo HTML length:', el.innerHTML?.length || 0);
    console.log('[Scroll] Posição no DOM:', el.getBoundingClientRect());
    console.log('[Scroll] Parent:', el.parentElement?.id);
    
    // Forçar visibilidade com estilos bem destacados
    el.style.display = 'block';
    el.style.visibility = 'visible';
    el.style.opacity = '1';
    el.style.position = 'relative';
    el.style.zIndex = '9999';
    
    // TESTE VISUAL: fundo vermelho temporário
    el.style.background = '#ff0000';
    el.style.border = '3px solid #00ff00';
    
    setTimeout(() => {
      console.log('[Scroll] Executando scrollIntoView...');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      console.log('[Aprovações] Scroll realizado com sucesso');
      
      // Remover cores de teste após 3 segundos
      setTimeout(() => {
        el.style.background = 'var(--painel)';
        el.style.border = '1px solid var(--borda)';
      }, 3000);
    }, 100);
  } else {
    if (typeof mostrarToast === 'function') {
      mostrarToast('Painel de aprovações não encontrado', 'aviso');
    }
    console.error('[Aprovações] Elemento criativos-mestre-wrap não encontrado após todas as tentativas');
  }
};


// ────────────────────────────────────────────────────────────────
// Função principal: renderizar painel de aprovações do mestre
// ────────────────────────────────────────────────────────────────
window.criativoRenderMestre = function() {
  // Verificar se é modo campanha (não arena)
  if (typeof AR !== 'undefined' && AR.session) {
    // Modo arena - não renderizar painel de campanha
    return null;
  }

  // Selecionar o elemento do painel - tentar múltiplas localizações
  let wrap = document.getElementById('criativos-mestre-wrap');
  
  // Se não encontrou, pode estar dentro do painel de ações da mesa
  if (!wrap) {
    const mesaAcaoPainel = document.getElementById('mesa-acao-painel');
    if (mesaAcaoPainel) {
      wrap = mesaAcaoPainel.querySelector('#criativos-mestre-wrap');
    }
  }
  
  // Se ainda não encontrou, criar o elemento dinamicamente
  if (!wrap) {
    console.log('[Aprovações Campanha] Elemento não encontrado. Criando dinamicamente...');
    wrap = document.createElement('div');
    wrap.id = 'criativos-mestre-wrap';
    wrap.style.display = 'none';
    wrap.style.marginTop = '10px';
    
    // Tentar inserir no painel de ações da mesa
    const mesaAcaoPainel = document.getElementById('mesa-acao-painel');
    console.log('[Aprovações Campanha] mesa-acao-painel existe?', !!mesaAcaoPainel);
    
    if (mesaAcaoPainel) {
      console.log('[Aprovações Campanha] Inserindo em mesa-acao-painel...');
      mesaAcaoPainel.appendChild(wrap);
      console.log('[Aprovações Campanha] appendChild executado');
      console.log('[Aprovações Campanha] wrap.parentElement:', wrap.parentElement?.id);
      console.log('[Aprovações Campanha] wrap no DOM?', document.contains(wrap));
    } else {
      // Fallback: inserir no tab-mapas
      const tabMapas = document.getElementById('tab-mapas');
      console.log('[Aprovações Campanha] mesa-acao-painel não existe. tab-mapas existe?', !!tabMapas);
      
      if (tabMapas) {
        tabMapas.appendChild(wrap);
        console.log('[Aprovações Campanha] Elemento criado e inserido em tab-mapas');
      } else {
        console.error('[Aprovações Campanha] Não foi possível criar elemento - nenhum container encontrado');
        return null;
      }
    }
  } else {
    console.log('[Aprovações Campanha] Elemento encontrado:', wrap.parentElement?.id || 'root');
  }

  // Verificar se é mestre
  const isMestre = RPG_DATA?.myRole === 'mestre';
  
  if (!isMestre) {
    wrap.style.display = 'none';
    console.log('[Aprovações Campanha] Painel oculto - usuário não é mestre');
    return wrap;
  }

  // Filtrar criativos pendentes
  const pendentes = (CRIATIVOS_CAMP || []).filter(c => 
    ['pendente', 'dc_rolado_sucesso', 'aprovado_dc', 'aprovado_aguardando_rolagem'].includes(c.status)
  );

  console.log('[Aprovações Campanha] Pendentes encontrados:', pendentes.length);

  // Se não há pendentes, ocultar painel
  if (!pendentes.length) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    if (typeof _limparNotifCreativo === 'function') {
      _limparNotifCreativo();
    }
    console.log('[Aprovações Campanha] Painel oculto - sem pendentes');
    return wrap;
  }

  // Mostrar painel e renderizar aprovações
  wrap.style.display = 'block';
  wrap.style.visibility = 'visible';
  wrap.style.opacity = '1';
  wrap.style.position = 'relative';
  wrap.style.zIndex = '10';
  wrap.style.background = 'var(--painel)';
  wrap.style.padding = '12px';
  wrap.style.borderRadius = '8px';
  wrap.style.border = '1px solid var(--borda)';
  wrap.style.marginBottom = '12px';
  
  console.log('[Aprovações Campanha] Painel exibido - renderizando', pendentes.length, 'aprovações');
  
  const html = pendentes.map(criativo => {
    const descricaoTruncada = (criativo.descricao || 'Ação criativa')
      .substring(0, 80) + ((criativo.descricao || '').length > 80 ? '…' : '');
    
    const tipoCor: Record<string, any> = {
      'ataque': '#e74c3c',
      'suporte': '#5ee09a', 
      'narrativo': '#f0cc6a',
      'utilidade': '#7ec8f0'
    };
    const cor = tipoCor[criativo.criativo_tipo] || '#7ec8f0';
    
    return `
      <div style="
        margin-bottom:8px;
        padding:10px 12px;
        background:rgba(255,255,255,0.02);
        border:1px solid ${cor}33;
        border-left:3px solid ${cor};
        border-radius:8px;
      ">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <div style="flex:1;min-width:0">
            <div style="
              font-family:var(--fonte-d);
              font-size:0.68rem;
              color:${cor};
              margin-bottom:3px;
              font-weight:500;
            ">
              ${criativo.atacante || 'Desconhecido'}
              ${criativo.alvo ? (' → ' + criativo.alvo) : ''}
            </div>
            <div style="
              font-size:0.62rem;
              color:var(--texto);
              line-height:1.4;
              word-break:break-word;
            ">
              ${descricaoTruncada}
            </div>
            ${criativo.criativo_tipo ? `
              <div style="
                display:inline-block;
                margin-top:4px;
                padding:2px 6px;
                background:${cor}18;
                border:1px solid ${cor}40;
                border-radius:4px;
                font-size:0.55rem;
                color:${cor};
                text-transform:uppercase;
                letter-spacing:0.05em;
              ">
                ${criativo.criativo_tipo}
              </div>
            ` : ''}
          </div>
        </div>
        
        <div style="display:flex;gap:6px;margin-top:8px">
          <button 
            onclick="abrirModalAprovacaoCompleta('${criativo.id}')" 
            style="
              flex:1;
              padding:7px 10px;
              background:rgba(94,224,154,0.08);
              border:1px solid rgba(94,224,154,0.3);
              border-radius:6px;
              color:#5ee09a;
              font-family:var(--fonte-d);
              font-size:0.62rem;
              cursor:pointer;
              transition:all 0.2s;
            "
            onmouseover="this.style.background='rgba(94,224,154,0.15)'"
            onmouseout="this.style.background='rgba(94,224,154,0.08)'"
          >
            ✓ Aprovar
          </button>
          
          <button 
            onclick="rejeitarCriativo('${criativo.id}')" 
            style="
              flex:1;
              padding:7px 10px;
              background:rgba(192,57,43,0.08);
              border:1px solid rgba(192,57,43,0.3);
              border-radius:6px;
              color:#e74c3c;
              font-family:var(--fonte-d);
              font-size:0.62rem;
              cursor:pointer;
              transition:all 0.2s;
            "
            onmouseover="this.style.background='rgba(192,57,43,0.15)'"
            onmouseout="this.style.background='rgba(192,57,43,0.08)'"
          >
            ✕ Rejeitar
          </button>
        </div>
      </div>
    `;
  }).join('');

  wrap.innerHTML = `
    <div style="
      font-family:var(--fonte-d);
      font-size:0.62rem;
      color:var(--destaque);
      text-transform:uppercase;
      letter-spacing:0.08em;
      margin-bottom:8px;
      padding-bottom:6px;
      border-bottom:1px solid var(--borda);
    ">
      📋 Aprovações Pendentes (${pendentes.length})
    </div>
    ${html}
  `;
  
  console.log('[Aprovações] innerHTML definido. Comprimento:', wrap.innerHTML.length);
  console.log('[Aprovações] wrap.style.display:', wrap.style.display);
  console.log('[Aprovações] wrap visível no DOM?', wrap.offsetHeight > 0);
  
  // NÃO chamar _mesaRenderAcoes() aqui - causa loop infinito!
  
  // Retornar o elemento criado/encontrado
  return wrap;
};


// ────────────────────────────────────────────────────────────────
// Função para aprovar uma ação criativa
// ────────────────────────────────────────────────────────────────
window.aprovarCriativo = async function(criativoId: any) {
  const criativo = CRIATIVOS_CAMP.find(c => c.id === criativoId);
  if (!criativo) {
    if (typeof mostrarToast === 'function') {
      mostrarToast('Ação criativa não encontrada', 'erro');
    }
    return;
  }

  const rpgId = RPG_DATA?.rpgId;
  
  if (!rpgId) {
    if (typeof mostrarToast === 'function') {
      mostrarToast('Erro: RPG não identificado', 'erro');
    }
    return;
  }
  
  try {
    // Atualizar status localmente
    criativo.status = 'aprovado';
    
    // Atualizar no banco
    if (typeof sb === 'function') {
      await sb(`criativos?rpg_id=eq.${encodeURIComponent(rpgId)}&id=eq.${encodeURIComponent(criativoId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'aprovado' })
      });
    }
    
    if (typeof mostrarToast === 'function') {
      mostrarToast(`✓ Ação de ${criativo.atacante} aprovada`, 'sucesso');
    }
    
    // Re-renderizar painel
    criativoRenderMestre();
    
    // Atualizar feed se disponível
    if (typeof feedAdicionarEntrada === 'function') {
      feedAdicionarEntrada(
        `Mestre aprovou: ${criativo.atacante} → ${criativo.alvo || 'alvo'}`,
        'info'
      );
    }
    
    // EXECUTAR PRÓXIMA ETAPA baseado no tipo
    console.log('[Aprovação] Tipo da ação:', criativo.criativo_tipo);
    
    if (criativo.criativo_tipo === 'ataque') {
      // Abrir modal de definir dano
      console.log('[Aprovação] Abrindo modal de dano para ataque criativo');
      abrirModalDanoCriativo(criativoId);
    } else {
      // Para ações não-ofensivas, executar efeito direto
      console.log('[Aprovação] Executando efeito de ação não-ofensiva');
      executarEfeitoCriativo(criativo);
    }
    
  } catch (error) {
    console.error('[Aprovações Campanha] Erro ao aprovar:', error);
    if (typeof mostrarToast === 'function') {
      mostrarToast('Erro ao aprovar ação', 'erro');
    }
    criativo.status = 'pendente'; // Reverter
  }
};


// ────────────────────────────────────────────────────────────────
// Função para rejeitar uma ação criativa
// ────────────────────────────────────────────────────────────────
window.rejeitarCriativo = async function(criativoId: any) {
  const criativo = CRIATIVOS_CAMP.find(c => c.id === criativoId);
  if (!criativo) {
    if (typeof mostrarToast === 'function') {
      mostrarToast('Ação criativa não encontrada', 'erro');
    }
    return;
  }

  const rpgId = RPG_DATA?.rpgId;
  
  if (!rpgId) {
    if (typeof mostrarToast === 'function') {
      mostrarToast('Erro: RPG não identificado', 'erro');
    }
    return;
  }
  
  try {
    // Atualizar status localmente
    criativo.status = 'rejeitado';
    
    // Atualizar no banco
    if (typeof sb === 'function') {
      await sb(`criativos?rpg_id=eq.${encodeURIComponent(rpgId)}&id=eq.${encodeURIComponent(criativoId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'rejeitado' })
      });
    }
    
    if (typeof mostrarToast === 'function') {
      mostrarToast(`Ação de ${criativo.atacante} rejeitada`, 'aviso');
    }
    
    // Remover da lista após um curto delay
    setTimeout(() => {
      const idx = CRIATIVOS_CAMP.findIndex(c => c.id === criativoId);
      if (idx >= 0) {
        CRIATIVOS_CAMP.splice(idx, 1);
      }
      criativoRenderMestre();
    }, 1500);
    
    // Atualizar feed se disponível
    if (typeof feedAdicionarEntrada === 'function') {
      feedAdicionarEntrada(
        `Mestre rejeitou: ${criativo.atacante} → ${criativo.alvo || 'alvo'}`,
        'info'
      );
    }
    
  } catch (error) {
    console.error('[Aprovações Campanha] Erro ao rejeitar:', error);
    if (typeof mostrarToast === 'function') {
      mostrarToast('Erro ao rejeitar ação', 'erro');
    }
    criativo.status = 'pendente'; // Reverter
  }
};


// ────────────────────────────────────────────────────────────────
// Função de inicialização do sistema
// ────────────────────────────────────────────────────────────────
window.inicializarSistemaAprovacoes = function() {
  // Renderizar painel inicialmente se houver pendentes
  if (typeof criativoRenderMestre === 'function') {
    criativoRenderMestre();
  }
  
  // Re-renderizar quando houver mudanças nos criativos
  if (typeof HUB_EVENTS !== 'undefined' && HUB_EVENTS.on) {
    HUB_EVENTS.on('criativo_adicionado', () => {
      if (typeof criativoRenderMestre === 'function') {
        criativoRenderMestre();
      }
    });
    
    HUB_EVENTS.on('criativo_atualizado', () => {
      if (typeof criativoRenderMestre === 'function') {
        criativoRenderMestre();
      }
    });
  }
  
  console.log('[Aprovações Campanha] Sistema de aprovações inicializado');
};

console.log('[Creative] Sistema de aprovações de campanha carregado ✓');
console.log('Arena patches loaded ✓');

// ═══════════════════════════════════════════════════════════════
// CAMPANHA: Modal de Dano para Ações Criativas
// ═══════════════════════════════════════════════════════════════

window.abrirModalDanoCriativo = function(criativoId: any) {
  const criativo = CRIATIVOS_CAMP.find(c => c.id === criativoId);
  if (!criativo) {
    console.error('[Modal Dano] Criativo não encontrado:', criativoId);
    return;
  }
  
  console.log('[Modal Dano] Abrindo modal para:', criativo);
  
  // Verificar se existe modal de dano no DOM
  let modal = document.getElementById('modal-dano-criativo');
  
  if (!modal) {
    // Criar modal dinamicamente
    modal = document.createElement('div');
    modal.id = 'modal-dano-criativo';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:500px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h2 style="font-family:var(--fonte-d);color:var(--destaque);margin:0">⚔ Definir Dano</h2>
          <button onclick="fecharModalDanoCriativo()" style="background:none;border:none;color:var(--suave);font-size:24px;cursor:pointer">&times;</button>
        </div>
        
        <div style="background:var(--painel-escuro);padding:15px;border-radius:8px;margin-bottom:15px">
          <div style="font-family:var(--fonte-d);font-size:0.7rem;color:var(--suave);margin-bottom:8px">ATACANTE</div>
          <div id="dano-criativo-atacante" style="font-size:0.9rem;color:var(--destaque);margin-bottom:10px"></div>
          
          <div style="font-family:var(--fonte-d);font-size:0.7rem;color:var(--suave);margin-bottom:8px">ALVO</div>
          <div id="dano-criativo-alvo" style="font-size:0.9rem;color:#e8604c;margin-bottom:10px"></div>
          
          <div style="font-family:var(--fonte-d);font-size:0.7rem;color:var(--suave);margin-bottom:8px">DESCRIÇÃO</div>
          <div id="dano-criativo-desc" style="font-size:0.85rem;color:var(--texto);font-style:italic"></div>
        </div>
        
        <div style="margin-bottom:15px">
          <label style="font-family:var(--fonte-d);font-size:0.75rem;color:var(--texto);display:block;margin-bottom:8px">
            Dano a aplicar:
          </label>
          <input 
            type="number" 
            id="dano-criativo-valor" 
            min="0" 
            placeholder="0" 
            style="width:100%;padding:10px;background:var(--painel-escuro);border:1px solid var(--borda);border-radius:6px;color:var(--texto);font-size:1rem"
          />
        </div>
        
        <div style="display:flex;gap:10px">
          <button 
            onclick="fecharModalDanoCriativo()" 
            style="flex:1;padding:12px;background:var(--painel-escuro);border:1px solid var(--borda);border-radius:6px;color:var(--suave);cursor:pointer"
          >
            Cancelar
          </button>
          <button 
            onclick="aplicarDanoCriativo()" 
            style="flex:1;padding:12px;background:rgba(232,96,76,0.15);border:1px solid rgba(232,96,76,0.3);border-radius:6px;color:#e8604c;cursor:pointer;font-weight:bold"
          >
            Aplicar Dano
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  // Preencher dados
  document.getElementById('dano-criativo-atacante').textContent = criativo.atacante || '—';
  document.getElementById('dano-criativo-alvo').textContent = criativo.alvo || '—';
  document.getElementById('dano-criativo-desc').textContent = criativo.descricao || '';
  document.getElementById('dano-criativo-valor').value = '';
  
  // Guardar ID do criativo
  modal.dataset.criativoId = criativoId;
  
  // Mostrar modal
  modal.style.display = 'flex';
};

window.fecharModalDanoCriativo = function() {
  const modal = document.getElementById('modal-dano-criativo');
  if (modal) {
    modal.style.display = 'none';
  }
};

window.aplicarDanoCriativo = async function() {
  const modal = document.getElementById('modal-dano-criativo');
  const criativoId = modal?.dataset?.criativoId;
  const dano = parseInt(document.getElementById('dano-criativo-valor').value) || 0;
  
  if (!criativoId) {
    console.error('[Aplicar Dano] ID do criativo não encontrado');
    return;
  }
  
  const criativo = CRIATIVOS_CAMP.find(c => c.id === criativoId);
  if (!criativo) {
    console.error('[Aplicar Dano] Criativo não encontrado:', criativoId);
    return;
  }
  
  console.log('[Aplicar Dano] Aplicando', dano, 'de dano ao alvo:', criativo.alvo);
  
  // Encontrar personagem alvo
  const alvo = (RPG_DATA?.characters || []).find(c => c.nome === criativo.alvo);
  
  if (!alvo) {
    if (typeof mostrarToast === 'function') {
      mostrarToast('Alvo não encontrado', 'erro');
    }
    return;
  }
  
  // Aplicar dano
  const hpAtual = alvo.hp_atual || 0;
  const novoHP = Math.max(0, hpAtual - dano);
  
  alvo.hp_atual = novoHP;
  
  // Salvar no banco
  try {
    if (typeof sb === 'function') {
      await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(criativo.alvo)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ hp_atual: novoHP })
      });
    }
    
    // Atualizar status do criativo para concluído
    criativo.status = 'concluido';
    
    if (typeof sb === 'function') {
      await sb(`criativos?id=eq.${encodeURIComponent(criativoId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'concluido' })
      });
    }
    
    if (typeof mostrarToast === 'function') {
      mostrarToast(`💥 ${dano} de dano aplicado em ${criativo.alvo}`, 'sucesso');
    }
    
    // Atualizar UI
    if (typeof mapaRenderStatus === 'function') {
      mapaRenderStatus();
    }
    
    if (typeof renderCharView === 'function' && CHAR_VIEW === criativo.alvo) {
      renderCharView(criativo.alvo);
    }
    
    // Re-renderizar painel de aprovações
    criativoRenderMestre();
    
    // Fechar modal
    fecharModalDanoCriativo();
    
  } catch (error) {
    console.error('[Aplicar Dano] Erro:', error);
    if (typeof mostrarToast === 'function') {
      mostrarToast('Erro ao aplicar dano', 'erro');
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// CAMPANHA: Executar Efeito de Ações Não-Ofensivas
// ═══════════════════════════════════════════════════════════════

window.executarEfeitoCriativo = async function(criativo: any) {
  console.log('[Executar Efeito] Tipo:', criativo.criativo_tipo);
  
  // Para ações de suporte, utilidade, narrativo
  if (criativo.criativo_tipo === 'suporte') {
    // Exemplo: cura, buff, etc
    console.log('[Executar Efeito] Ação de suporte - implementar lógica de cura/buff');
    
    if (typeof mostrarToast === 'function') {
      mostrarToast(`✨ Ação de suporte executada: ${criativo.atacante}`, 'sucesso');
    }
  }
  
  if (criativo.criativo_tipo === 'utilidade') {
    console.log('[Executar Efeito] Ação de utilidade - efeito narrativo');
    
    if (typeof mostrarToast === 'function') {
      mostrarToast(`🔧 ${criativo.atacante} executou ação de utilidade`, 'info');
    }
  }
  
  if (criativo.criativo_tipo === 'narrativo') {
    console.log('[Executar Efeito] Ação narrativa - apenas flavor');
    
    if (typeof mostrarToast === 'function') {
      mostrarToast(`📖 Ação narrativa de ${criativo.atacante}`, 'info');
    }
  }
  
  // Marcar como concluído
  criativo.status = 'concluido';
  
  try {
    if (typeof sb === 'function') {
      await sb(`criativos?id=eq.${encodeURIComponent(criativo.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'concluido' })
      });
    }
  } catch (error) {
    console.error('[Executar Efeito] Erro ao salvar:', error);
  }
  
  // Re-renderizar
  criativoRenderMestre();
};

console.log('[Creative] Funções de execução de ações criativas registradas ✓');

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE AÇÕES CRIATIVAS 2.0 - Fluxo Otimizado
// ═══════════════════════════════════════════════════════════════

// ── Modal de Aprovação Completa (Mestre) ──────────────────────

function abrirModalAprovacaoCompleta(criativoId: any) {
  var criativo = CRIATIVOS_CAMP.find(function(c){ return c.id === criativoId; });
  if (!criativo) return;

  var tipo     = criativo.criativo_tipo     || 'ataque';
  var alvoTipo = criativo.criativo_alvo_tipo|| 'unico';
  var ehSuporte   = tipo === 'suporte';
  var ehNarrativo = tipo === 'narrativo';
  var ehArea      = alvoTipo === 'area';

  // Campos ocultos de contexto
  document.getElementById('apr-criativo-id').value  = criativoId;
  document.getElementById('apr-tipo-acao').value    = tipo;
  document.getElementById('apr-alvo-tipo').value    = alvoTipo;

  // Header
  var tituloMap: Record<string, any> = { ataque:'⚔ Aprovar Ataque', suporte:'✨ Aprovar Suporte', narrativo:'📖 Aprovar Narrativo', area:'💥 Aprovar Área' };
  var tituloEl = document.getElementById('apr-titulo-label');
  if (tituloEl) tituloEl.textContent = tituloMap[ehArea ? 'area' : tipo] || '📋 Aprovar Ação Criativa';
  var infoEl = document.getElementById('apr-info-linha');
  if (infoEl) infoEl.textContent = criativo.atacante + (criativo.alvo ? ' → ' + criativo.alvo : '');
  document.getElementById('apr-descricao').textContent = (criativo.descricao||'').replace(/^\[.*?\]\s*/,'');

  // DC — reset, d20 selecionado por padrão
  document.getElementById('apr-dc').value = '';
  var dcPrev = document.getElementById('apr-dc-preview');
  if (dcPrev) dcPrev.textContent = '';
  document.querySelectorAll('.apr-dado-btn').forEach(function(b) {
    var sel = b.dataset.faces === '20';
    b.classList.toggle('apr-dado-sel', sel);
    b.style.background = sel ? 'rgba(200,168,75,0.25)' : 'rgba(200,168,75,0.08)';
    b.style.borderColor = sel ? 'rgba(200,168,75,0.6)' : 'rgba(200,168,75,0.2)';
  });

  // Seção de dano: visível para ataque e área, oculto para suporte/narrativo
  var secDano = document.getElementById('apr-sec-dano');
  if (secDano) secDano.style.display = (!ehSuporte && !ehNarrativo) ? '' : 'none';

  // Seção alvos de área
  var secArea = document.getElementById('apr-sec-area');
  if (secArea) secArea.style.display = ehArea ? '' : 'none';
  var alvosEl = document.getElementById('apr-alvos-area');
  if (alvosEl) alvosEl.value = '';

  // Painéis de efeitos base
  var painelAtk = document.getElementById('apr-efeitos-ataque');
  var painelSup = document.getElementById('apr-efeitos-suporte');
  var tituloEf  = document.getElementById('apr-efeitos-base-titulo');
  if (painelAtk) painelAtk.style.display = ehSuporte ? 'none' : '';
  if (painelSup) painelSup.style.display = ehSuporte ? '' : 'none';
  if (tituloEf) {
    tituloEf.style.color = ehSuporte ? '#5ee09a' : '#e8604c';
    tituloEf.textContent = ehSuporte
      ? '✨ Efeitos Base (buff / cura ao passar na DC)'
      : '☠ Efeitos Base (debuff / dano extra ao passar na DC)';
  }

  // Botão confirmar — texto por tipo
  var btnConf = document.getElementById('apr-btn-confirmar');
  if (btnConf) btnConf.textContent = ehNarrativo ? '📖 Confirmar Narrativo' : ehSuporte ? '✨ Aprovar e Enviar' : '✓ Aprovar e Enviar';

  // Reset builder de dano
  window._aprBuilder = [];
  document.getElementById('apr-bonus').value = '0';
  aprBuilderAtualizar();

  // Reset todos checkboxes de efeitos base
  ['cx2-dot-on','cx2-debuff-on','cx2-imob-on','cx2-stun-on',
   'cx2-cura-on','cx2-hot-on','cx2-boost-on','cx2-def-on','cx2-hptemp-on','cx2-removedebuff-on'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.checked = false;
  });
  ['cx2-dot-fields','cx2-debuff-fields','cx2-imob-fields','cx2-stun-fields',
   'cx2-cura-fields','cx2-hot-fields','cx2-boost-fields','cx2-def-fields','cx2-hptemp-fields'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Reset efeito crítico
  document.getElementById('apr-efeito-critico').value = '';
  aprEfeitoCriticoChange();

  // Mostrar seção de cadastro de skill só para mestre
  var skillSec = document.getElementById('apr-skill-section');
  if (skillSec) {
    skillSec.style.display = (RPG_DATA?.myRole === 'mestre') ? '' : 'none';
    var chk = document.getElementById('apr-cadastrar-skill');
    if (chk) chk.checked = false;
    var campos = document.getElementById('apr-skill-campos');
    if (campos) campos.style.display = 'none';
    var skNome = document.getElementById('apr-skill-nome');
    if (skNome) skNome.value = (criativo.descricao || '').replace(/^\[.*?\]\s*/,'').slice(0,40);
    var skEfeito = document.getElementById('apr-skill-efeito');
    if (skEfeito) skEfeito.value = '';
  }

  document.getElementById('modal-aprovacao-completa').style.display = 'flex';
}

function aprSkillToggle() {
  var campos = document.getElementById('apr-skill-campos');
  var chk    = document.getElementById('apr-cadastrar-skill');
  if (campos && chk) campos.style.display = chk.checked ? '' : 'none';
}

function atualizarFormulaPreview() { aprBuilderAtualizar(); }

function aprSelecionarDado(btn: any, faces: any) {
  document.querySelectorAll('.apr-dado-btn').forEach(function(b) {
    b.classList.remove('apr-dado-sel');
    b.style.background = 'rgba(200,168,75,0.08)';
    b.style.borderColor = 'rgba(200,168,75,0.2)';
  });
  btn.classList.add('apr-dado-sel');
  btn.style.background = 'rgba(200,168,75,0.25)';
  btn.style.borderColor = 'rgba(200,168,75,0.6)';
  aprDCPreview();
}

function aprDCPreview() {
  var dadoBtn = document.querySelector('.apr-dado-btn.apr-dado-sel');
  var faces = dadoBtn ? parseInt(dadoBtn.dataset.faces) : 20;
  var dc = parseInt(document.getElementById('apr-dc')?.value) || 0;
  var el = document.getElementById('apr-dc-preview');
  if (!el) return;
  if (!dc) { el.textContent = ''; return; }
  var limiar = Math.round((faces - dc) / 2 + dc);
  el.textContent = 'Crítico se tirar > ' + limiar + ' · Natural ' + faces + ' = Crítico automático';
}

function aprBuilderAdd(faces: any) {
  if (!window._aprBuilder) window._aprBuilder = [];
  var ex = window._aprBuilder.find(function(g: any){ return g.faces === faces; });
  if (ex) ex.qtd++; else window._aprBuilder.push({ faces: faces, qtd: 1 });
  aprBuilderAtualizar();
}

function aprBuilderRemove(faces: any) {
  if (!window._aprBuilder) return;
  var idx = window._aprBuilder.findIndex(function(g: any){ return g.faces === faces; });
  if (idx < 0) return;
  window._aprBuilder[idx].qtd--;
  if (window._aprBuilder[idx].qtd <= 0) window._aprBuilder.splice(idx, 1);
  aprBuilderAtualizar();
}

function aprBuilderAtualizar() {
  var builder = window._aprBuilder || [];
  var bonus = parseInt(document.getElementById('apr-bonus')?.value) || 0;
  var chipsEl = document.getElementById('apr-builder-chips');
  var previewEl = document.getElementById('apr-formula-preview');
  if (chipsEl) chipsEl.innerHTML = builder.map(function(g: any) {
    return '<div style="display:flex;align-items:center;gap:3px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:20px;padding:2px 8px 2px 6px">' +
      '<span style="font-family:var(--fonte-d);font-size:0.82rem;color:#f0cc6a">' + g.qtd + 'd' + g.faces + '</span>' +
      '<button onclick="aprBuilderRemove(' + g.faces + ')" style="background:none;border:none;color:#c8a84b88;cursor:pointer;font-size:0.95rem;padding:0 0 0 2px;line-height:1">−</button></div>';
  }).join('');
  var formula = builder.map(function(g: any){ return g.qtd + 'd' + g.faces; }).join('+') || '(sem dados)';
  if (bonus > 0) formula += '+' + bonus;
  else if (bonus < 0) formula += bonus;
  if (previewEl) previewEl.textContent = formula;
}

function aprEfeitoCriticoChange() {
  var val = document.getElementById('apr-efeito-critico')?.value || '';
  var dotF = document.getElementById('apr-crit-dot-fields');
  var hotF = document.getElementById('apr-crit-hot-fields');
  if (dotF) dotF.style.display = val === 'dot' ? 'flex' : 'none';
  if (hotF) hotF.style.display = val === 'hot' ? 'flex' : 'none';
}

// Lê todos os efeitos base e crítico do modal e retorna objeto serializado
function _lerEfeitosModal() {
  var tipo = document.getElementById('apr-tipo-acao')?.value || 'ataque';
  var ehSuporte = tipo === 'suporte';
  var efeitosBase = [];
  var efeitoCritico = null;

  if (ehSuporte) {
    if (document.getElementById('cx2-cura-on')?.checked) {
      var qtd = parseInt(document.getElementById('cx2-cura-qtd')?.value) || 10;
      efeitosBase.push({ tipo:'cura_imediata', valor: qtd, nome:'Cura ' + qtd });
    }
    if (document.getElementById('cx2-hot-on')?.checked) {
      var form = document.getElementById('cx2-hot-formula')?.value?.trim() || '1d6';
      var turn = parseInt(document.getElementById('cx2-hot-turnos')?.value) || 3;
      efeitosBase.push({ hot_formula: form, hot_turnos: turn, nome:'HOT ' + form + 'x' + turn + 't' });
    }
    if (document.getElementById('cx2-boost-on')?.checked) {
      var mod = parseInt(document.getElementById('cx2-boost-mod')?.value) || 3;
      var turn = parseInt(document.getElementById('cx2-boost-turnos')?.value) || 2;
      efeitosBase.push({ boost_dano: mod, boost_dano_turnos: turn, nome:'+' + mod + ' Dano x' + turn + 't' });
    }
    if (document.getElementById('cx2-def-on')?.checked) {
      var mod = parseInt(document.getElementById('cx2-def-mod')?.value) || 3;
      var turn = parseInt(document.getElementById('cx2-def-turnos')?.value) || 2;
      efeitosBase.push({ boost_defesa: mod, boost_defesa_turnos: turn, nome:'+' + mod + ' Defesa x' + turn + 't' });
    }
    if (document.getElementById('cx2-hptemp-on')?.checked) {
      var qtd = parseInt(document.getElementById('cx2-hptemp-qtd')?.value) || 10;
      efeitosBase.push({ hp_temp: qtd, nome:'+' + qtd + ' HP temp' });
    }
    if (document.getElementById('cx2-removedebuff-on')?.checked) {
      efeitosBase.push({ remover_debuff: 1, nome:'🧹 Remove Debuff' });
    }
  } else {
    if (document.getElementById('cx2-dot-on')?.checked) {
      var form = document.getElementById('cx2-dot-formula')?.value?.trim() || '1d4';
      var turn = parseInt(document.getElementById('cx2-dot-turnos')?.value) || 3;
      efeitosBase.push({ dot_formula: form, dot_turnos: turn, nome:'DOT ' + form + 'x' + turn + 't' });
    }
    if (document.getElementById('cx2-debuff-on')?.checked) {
      var mod = parseInt(document.getElementById('cx2-debuff-mod')?.value) || -3;
      var turn = parseInt(document.getElementById('cx2-debuff-turnos')?.value) || 2;
      efeitosBase.push({ mod_dano: mod, mod_dano_turnos: turn, nome: mod + ' Dano x' + turn + 't' });
    }
    if (document.getElementById('cx2-imob-on')?.checked) {
      var turn = parseInt(document.getElementById('cx2-imob-turnos')?.value) || 1;
      efeitosBase.push({ sem_movimento: true, sem_movimento_turnos: turn, tipo:'debuff', nome:'🚫 Imobilizado x' + turn + 't' });
    }
    if (document.getElementById('cx2-stun-on')?.checked) {
      var stunTipo = document.getElementById('cx2-stun-tipo')?.value || 'todos';
      var turn = parseInt(document.getElementById('cx2-stun-turnos')?.value) || 1;
      efeitosBase.push({ sem_ataque: true, sem_ataque_tipo: stunTipo, sem_ataque_turnos: turn, tipo:'debuff', nome:'⚔🚫 Atordoado x' + turn + 't' });
    }
  }

  // Efeito crítico extra
  var critTipo = document.getElementById('apr-efeito-critico')?.value || '';
  if (critTipo) {
    var critObj: any = { tipo: critTipo };
    if (critTipo === 'dot') {
      (critObj as any).formula = document.getElementById('apr-crit-dot-formula')?.value?.trim() || '1d4';
      (critObj as any).turnos  = parseInt(document.getElementById('apr-crit-dot-turnos')?.value) || 2;
    }
    if (critTipo === 'hot') {
      (critObj as any).formula = document.getElementById('apr-crit-hot-formula')?.value?.trim() || '1d4';
      critObj.turnos  = parseInt(document.getElementById('apr-crit-hot-turnos')?.value) || 2;
    }
    efeitoCritico = critObj;
  }

  return { efeitosBase: efeitosBase, efeitoCritico: efeitoCritico };
}

async function aprovarCriativoCompleto() {
  var criativoId  = document.getElementById('apr-criativo-id').value;
  var tipo        = document.getElementById('apr-tipo-acao').value || 'ataque';
  var alvoTipo    = document.getElementById('apr-alvo-tipo').value || 'unico';
  var ehSuporte   = tipo === 'suporte';
  var ehNarrativo = tipo === 'narrativo';
  var ehArea      = alvoTipo === 'area';

  var dadoBtn  = document.querySelector('.apr-dado-btn.apr-dado-sel');
  var dadoFaces = dadoBtn ? parseInt(dadoBtn.dataset.faces) : 20;
  var dc       = parseInt(document.getElementById('apr-dc').value);
  var bonus    = parseInt(document.getElementById('apr-bonus').value) || 0;
  var builder  = window._aprBuilder || [];

  if (!dc || dc < 1) { if (typeof mostrarToast === 'function') mostrarToast('Defina a DC primeiro', 'erro'); return; }
  if (!ehSuporte && !ehNarrativo && !builder.length) {
    if (typeof mostrarToast === 'function') mostrarToast('Adicione ao menos um dado de dano', 'erro'); return;
  }

  var efeitos = _lerEfeitosModal();

  // Alvos de área
  var alvosAreaStr = document.getElementById('apr-alvos-area')?.value?.trim();
  var alvosArea = ehArea && alvosAreaStr
    ? alvosAreaStr.split(',').map(function(a: any){ return a.trim(); }).filter(Boolean)
    : null;

  var dadosDano = ehSuporte || ehNarrativo ? null : { grupos: builder, bonus: bonus };

  var prontoData = {
    dc: dc,
    dado_verificacao: dadoFaces,
    tipo_acao: tipo,
    alvo_tipo: alvoTipo,
    dados_dano: dadosDano,
    efeitos_base: efeitos.efeitosBase.length ? efeitos.efeitosBase : null,
    efeito_critico: efeitos.efeitoCritico || null,
    alvos_area: alvosArea,
  };
  var formulaAprovada = '__PRONTO__' + JSON.stringify(prontoData);

  try {
    await sb('criativos?id=eq.' + encodeURIComponent(criativoId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: 'aprovado_pronto', formula_aprovada: formulaAprovada })
    });

    var criativo = CRIATIVOS_CAMP.find(function(c){ return c.id === criativoId; });
    if (criativo) {
      criativo.status           = 'aprovado_pronto';
      criativo.formula_aprovada = formulaAprovada;
      criativo._pronto          = prontoData;
    }

    document.getElementById('modal-aprovacao-completa').style.display = 'none';
    if (typeof criativoRenderMestre === 'function') criativoRenderMestre();

    // ── Cadastrar skill se mestre marcou a opção ──────────────────────────
    var cadastrarSkill = document.getElementById('apr-cadastrar-skill')?.checked;
    if (cadastrarSkill && RPG_DATA?.myRole === 'mestre' && criativo) {
      var skNome   = document.getElementById('apr-skill-nome')?.value?.trim() || criativo.descricao?.slice(0,40) || 'Habilidade';
      var skEfeito = document.getElementById('apr-skill-efeito')?.value?.trim() || criativo.descricao || '';
      var formulaDano = (dadosDano && builder.length) ? builder.map(function(g: any){ return g.qtd+'d'+g.faces; }).join('+') + (bonus ? (bonus>0?'+':'')+bonus : '') : null;
      var skPayload = {
        rpg_id:          RPG_DATA.rpgId,
        personagem:      criativo.atacante,
        habilidade:      skNome,
        efeito:          skEfeito,
        formula_dano:    formulaDano,
        alvo_tipo:       alvoTipo === 'unico' ? (tipo === 'suporte' ? 'aliado' : 'inimigo')
                         : alvoTipo === 'proprio' ? 'proprio'
                         : alvoTipo === 'area' ? 'area' : 'inimigo',
        custo_tipo:      'acao',
        custo_rsv:       0,
        cooldown_turnos: 0,
      };
      try {
        await sb('skills', { method:'POST', headers:{'Content-Type':'application/json','Prefer':'return=minimal'}, body: JSON.stringify(skPayload) });
        mostrarToast('📚 Habilidade "'+skNome+'" cadastrada!', 'sucesso');
      } catch(e) { console.warn('[Skill] Erro ao cadastrar:', e); }
    }

    if (criativo) {
      var atacante     = criativo.atacante;
      var isNpc        = (RPG_DATA?.characters || []).find(function(c){ return c.nome === atacante; })?.custom_attrs?.tipo_personagem === 'npc';
      var isVinculado  = RPG_DATA?.linked === atacante && RPG_DATA?.myRole === 'mestre';
      var temJogador   = typeof personagemTemJogador === 'function' ? personagemTemJogador(atacante) : false;
      var online       = typeof jogadorEstaOnline    === 'function' ? jogadorEstaOnline(atacante)    : false;
      var mestreExecuta = isNpc || isVinculado || !temJogador || (temJogador && !online);
      if (mestreExecuta) {
        setTimeout(function(){ if (typeof abrirModalExecucaoCriativo === 'function') abrirModalExecucaoCriativo(criativoId); }, 150);
        mostrarToast('✓ Aprovado! Execute a ação abaixo.', 'sucesso');
      } else {
        mostrarToast('✓ Ação aprovada! Aguardando o jogador executar.', 'sucesso');
      }
    }
  } catch (error) {
    console.error('[Aprovar Completo] Erro:', error);
    if (typeof mostrarToast === 'function') mostrarToast('Erro ao aprovar ação', 'erro');
  }
}

function fecharModalAprovacaoCompleta() {
  document.getElementById('modal-aprovacao-completa').style.display = 'none';
}

// ── Modal de Execução (Jogador) ───────────────────────────────

var EXEC_CRIATIVO_ATUAL: any = null;

function abrirModalExecucaoCriativo(criativoId: any) {
  const criativo = CRIATIVOS_CAMP.find(c => c.id === criativoId);
  if (!criativo || criativo.status !== 'aprovado_pronto') {
    if (typeof mostrarToast === 'function') mostrarToast('Ação não está pronta para execução', 'erro');
    return;
  }
  if (!criativo._pronto && criativo.formula_aprovada && String(criativo.formula_aprovada).startsWith('__PRONTO__')) {
    try { criativo._pronto = JSON.parse(String(criativo.formula_aprovada).slice(9)); } catch(e) {}
  }
  const pronto = criativo._pronto || {};
  const dd     = pronto.dados_dano || { quantidade: 1, tipo: 6, bonus: 0 };
  const dc     = pronto.dc || '?';

  EXEC_CRIATIVO_ATUAL = criativo;
  document.getElementById('exec-descricao').textContent = criativo.descricao;
  document.getElementById('exec-alvo').textContent      = criativo.alvo || 'N/A';
  document.getElementById('exec-dc').textContent        = dc;
  let formula = `${dd.quantidade}d${dd.tipo}`;
  if (dd.bonus > 0) formula += ` +${dd.bonus}`;
  else if (dd.bonus < 0) formula += ` ${dd.bonus}`;
  document.getElementById('exec-formula').textContent = formula;
  document.getElementById('etapa-acerto').style.display    = 'block';
  document.getElementById('resultado-acerto').innerHTML    = '';
  document.getElementById('etapa-dano').style.display      = 'none';
  document.getElementById('resultado-dano').innerHTML      = '';
  document.getElementById('resultado-final').style.display = 'none';
  document.getElementById('dano-final-valor').innerHTML    = '';
  document.getElementById('modal-executar-criativo').style.display = 'flex';
}

function rolarAcertoCriativo() {
  const criativo = EXEC_CRIATIVO_ATUAL;
  if (!criativo) return;

  const pronto     = criativo._pronto || {};
  const dc         = pronto.dc || criativo.dc || 10;
  const dadoFaces  = pronto.dado_verificacao || 20;
  const resultado  = Math.floor(Math.random() * dadoFaces) + 1;
  const erro       = dadoFaces >= 20 && resultado === 1; // Erro crítico só em d20
  const sucesso    = resultado >= dc;
  const natural    = resultado === dadoFaces; // Natural máximo = crítico automático
  let tipoCritico  = null;
  if (natural)                                 tipoCritico = 'critico_maior';
  else if (resultado >= Math.round((dadoFaces - dc) / 2 + dc)) tipoCritico = 'critico_menor';

  const resultEl = document.getElementById('resultado-acerto');

  if (erro) {
    resultEl.innerHTML = `<div style="padding:10px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.3);border-radius:6px;margin-top:8px"><div style="font-size:1.2rem;margin-bottom:5px">💀 Rolou 1 (d${dadoFaces})</div><div style="color:#e74c3c;font-weight:bold">ERRO CRÍTICO!</div><div style="color:#c0392b;font-size:0.9rem">Sem efeito!</div></div>`;
    criativo._d20 = resultado; criativo._danoFinal = 0;
    finalizarExecucaoCriativo();
  } else if (!sucesso) {
    resultEl.innerHTML = `<div style="padding:10px;background:rgba(231,76,60,0.05);border:1px solid rgba(231,76,60,0.2);border-radius:6px;margin-top:8px"><div style="font-size:1.2rem;margin-bottom:5px">✕ Rolou ${resultado} (d${dadoFaces})</div><div style="color:#e8604c">FALHOU! (DC ${dc})</div><div style="color:#c0392b;font-size:0.9rem">Sem efeito!</div></div>`;
    criativo._d20 = resultado; criativo._danoFinal = 0;
    finalizarExecucaoCriativo();
  } else {
    let criticoHtml = '', criticoCor = '#5ee09a';
    if (tipoCritico === 'critico_menor') { criticoHtml = '<div style="color:#f39c12;font-weight:bold;margin-top:5px">⭐ Crítico! (+20% dano)</div>'; criticoCor = '#f39c12'; }
    else if (tipoCritico === 'critico_maior') { criticoHtml = '<div style="color:#f0cc6a;font-weight:bold;margin-top:5px">🌟 CRÍTICO MÁXIMO! (+30% + efeito extra)</div>'; criticoCor = '#f0cc6a'; }
    resultEl.innerHTML = `<div style="padding:10px;background:rgba(94,224,154,0.1);border:1px solid rgba(94,224,154,0.3);border-radius:6px;margin-top:8px"><div style="font-size:1.2rem;margin-bottom:5px;color:${criticoCor}">✓ Rolou ${resultado} (d${dadoFaces})</div><div style="color:#5ee09a;font-weight:bold">SUCESSO! (DC ${dc})</div>${criticoHtml}</div>`;
    criativo._d20 = resultado; criativo._tipoCritico = tipoCritico;
    // Para suporte/narrativo: não há dado de dano, ir direto ao final
    const ehSuporte = (pronto.tipo_acao === 'suporte' || pronto.tipo_acao === 'narrativo');
    if (ehSuporte) {
      criativo._danoFinal = 0;
      finalizarExecucaoCriativo();
    } else {
      document.getElementById('etapa-dano').style.display = 'block';
    }
  }
}

function rolarDanoCriativo() {
  const criativo = EXEC_CRIATIVO_ATUAL;
  if (!criativo) return;

  const pronto = criativo._pronto || {};
  const dd = pronto.dados_dano
    || (typeof criativo.dados_dano === 'string' ? JSON.parse(criativo.dados_dano) : criativo.dados_dano)
    || { grupos: [{faces:6, qtd:1}], bonus: 0 };

  // Suporte a grupos (novo) e formato legado
  let total = 0;
  let rollsHtml = '';
  if (dd.grupos) {
    dd.grupos.forEach((g: any) => {
      const rolls = [];
      for (let i = 0; i < g.qtd; i++) rolls.push(Math.floor(Math.random() * g.faces) + 1);
      const soma = rolls.reduce((a,b)=>a+b,0);
      total += soma;
      rollsHtml += `<div style="font-size:0.85rem;color:#9ab8d0">${g.qtd}d${g.faces}: [${rolls.join(', ')}] = <b>${soma}</b></div>`;
    });
  } else {
    const rolls = [];
    for (let i = 0; i < (dd.quantidade||1); i++) rolls.push(Math.floor(Math.random() * (dd.tipo||6)) + 1);
    total = rolls.reduce((a,b)=>a+b,0);
    rollsHtml = `<div style="font-size:0.85rem;color:#9ab8d0">Dados: [${rolls.join(', ')}] = ${total}</div>`;
  }
  const bonus = dd.bonus || 0;
  const subtotal = total + bonus;

  document.getElementById('resultado-dano').innerHTML = `
    <div style="padding:10px;background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:6px;margin-top:8px">
      ${rollsHtml}
      ${bonus !== 0 ? `<div style="font-size:0.85rem;color:#9ab8d0">Bônus fixo: ${bonus>0?'+':''}${bonus}</div>` : ''}
      <div style="font-size:1.1rem;font-weight:bold;color:#4fa3d1;margin-top:5px">Subtotal: ${subtotal}</div>
    </div>`;

  const resultado: any = typeof calcularDanoCritico === 'function'
    ? calcularDanoCritico(subtotal, criativo._d20)
    : { dano: subtotal, tipo: 'normal', mensagem: null };
  criativo._danoFinal = resultado.dano;

  // Efeitos base — sempre aplicados
  const efeitosBase = pronto.efeitos_base || [];
  let efeitosBaseHtml = '';
  if (efeitosBase.length) {
    efeitosBaseHtml = `<div style="margin-top:7px;padding:6px 8px;background:rgba(200,168,75,0.07);border:1px solid rgba(200,168,75,0.2);border-radius:6px">
      <div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--destaque);text-transform:uppercase;margin-bottom:3px">Efeitos Base</div>
      ${efeitosBase.map((ef: any) => `<div style="font-size:0.78rem;color:var(--texto)">✦ ${ef.nome||ef.tipo||'efeito'}</div>`).join('')}
    </div>`;
  }

  // Efeito crítico extra
  const critObj = pronto.efeito_critico;
  let efeitoCriticoHtml = '';
  if (critObj && resultado.tipo !== 'normal') {
    const labels: Record<string, any> = { dot:'🩸 DOT extra ativo', hot:'💚 HOT extra ativo', debuff:'⬇ Debuff extra aplicado',
      boost:'⬆ Boost extra aplicado', atordoar:'😵 Atordoado!', knockback:'💨 Knockback!', livre:'✏ Efeito especial!' };
    const label = labels[critObj.tipo||critObj] || String(critObj.tipo||critObj);
    const extra = (critObj.formula && critObj.turnos) ? ` (${critObj.formula}×${critObj.turnos}t)` : '';
    efeitoCriticoHtml = `<div style="font-size:0.82rem;color:#f0cc6a;margin-top:5px;background:rgba(200,168,75,0.1);padding:4px 8px;border-radius:5px">${label}${extra}</div>`;
  }

  let criticoHtml = resultado.mensagem ? `<div style="font-size:0.9rem;color:${resultado.cor||'#f39c12'};margin-bottom:5px">${resultado.mensagem}</div>` : '';

  document.getElementById('dano-final-valor').innerHTML = `
    <div style="padding:15px;background:rgba(192,57,43,0.1);border:2px solid rgba(192,57,43,0.3);border-radius:8px;text-align:center">
      ${criticoHtml}
      <div style="font-size:2rem;font-weight:bold;color:#e8604c">${resultado.dano}</div>
      <div style="font-size:0.8rem;color:#c0392b;margin-top:5px">DANO FINAL</div>
      ${efeitoCriticoHtml}
    </div>
    ${efeitosBaseHtml}`;
  document.getElementById('resultado-final').style.display = 'block';
}

async function aplicarDanoFinalCriativo() {
  const criativo = EXEC_CRIATIVO_ATUAL;
  if (!criativo || typeof criativo._danoFinal !== 'number') return;

  const dano   = criativo._danoFinal;
  const alvo   = criativo.alvo;
  const pronto = criativo._pronto || {};
  const tipo   = pronto.tipo_acao || 'ataque';
  const ehSuporte = tipo === 'suporte' || tipo === 'narrativo';
  const contexto  = 'campanha'; // sempre campanha neste fluxo

  try {
    // ── 1. Aplicar dano de HP (apenas ataque/área) ────────────────────────────
    if (!ehSuporte && dano > 0 && alvo) {
      const alvos = pronto.alvos_area?.length ? pronto.alvos_area : [alvo];
      for (const nomeAlvo of alvos) {
        const char = RPG_DATA?.characters?.find(c => c.nome === nomeAlvo);
        if (char) {
          char.hp_atual = Math.max(0, (char.hp_atual || 0) - dano);
          if (typeof saveCharacterStats === 'function') {
            await saveCharacterStats(RPG_DATA.rpgId, char.nome, { hp_atual: char.hp_atual });
          }
        }
      }
      if (typeof mapaRenderStatus === 'function') mapaRenderStatus();
    }

    // ── 2. Aplicar efeitos base ──────────────────────────────────────────────
    const efeitosBase = pronto.efeitos_base || [];
    if (efeitosBase.length && typeof atkAplicarEfeito === 'function') {
      const alvosEfBase = pronto.alvos_area?.length
        ? pronto.alvos_area
        : [alvo || criativo.atacante];

      for (const ef of efeitosBase) {
        // Cura imediata: aplica direto no HP com multiplicador de crítico se houver
        if (ef.tipo === 'cura_imediata' && ef.valor) {
          const mult = criativo._tipoCritico === 'critico_maior' ? 1.3
                     : criativo._tipoCritico === 'critico_menor' ? 1.2 : 1;
          const curaFinal = Math.ceil(ef.valor * mult);
          for (const nomeAlvo of alvosEfBase) {
            const char = RPG_DATA?.characters?.find(c => c.nome === nomeAlvo);
            if (char) {
              const hpMax = char.custom_attrs?.hp_max || char.custom_attrs?.hp || 100;
              char.hp_atual = Math.min(hpMax, (char.hp_atual || 0) + curaFinal);
              if (typeof saveCharacterStats === 'function') {
                await saveCharacterStats(RPG_DATA.rpgId, char.nome, { hp_atual: char.hp_atual });
              }
            }
          }
          if (typeof mostrarToast === 'function') mostrarToast(`💊 ${curaFinal} HP curado${mult > 1 ? ' (CRÍTICO!)' : ''}`, 'sucesso');
          continue; // já aplicado, não passa para atkAplicarEfeito
        }
        // Outros efeitos (HOT, buff, debuff, etc.) via sistema de buffs
        for (const nomeAlvo of alvosEfBase) {
          try { await atkAplicarEfeito(nomeAlvo, ef, contexto); } catch(e) { console.warn('[Criativo] Efeito base erro:', e); }
        }
      }
      if (typeof mapaRenderStatus === 'function') mapaRenderStatus();
    }
    const critObj = pronto.efeito_critico;
    if (critObj && criativo._tipoCritico && typeof atkAplicarEfeito === 'function') {
      const tipoC = critObj.tipo || critObj;
      const cfgCrit = {
        nome: critObj.tipo || String(critObj),
        dot_formula:  tipoC === 'dot' ? (critObj.formula || '1d4') : null,
        dot_turnos:   tipoC === 'dot' ? (critObj.turnos  || 2)     : 0,
        hot_formula:  tipoC === 'hot' ? (critObj.formula || '1d4') : null,
        hot_turnos:   tipoC === 'hot' ? (critObj.turnos  || 2)     : 0,
        mod_dano:     tipoC === 'debuff' ? -3 : 0,
        mod_dano_turnos: tipoC === 'debuff' ? 2 : 0,
        boost_dano:   tipoC === 'boost' ? 3 : 0,
        boost_dano_turnos: tipoC === 'boost' ? 2 : 0,
        sem_ataque:   tipoC === 'atordoar',
        sem_ataque_turnos: tipoC === 'atordoar' ? 1 : 0,
      };
      const nomeAlvoCrit = alvo || criativo.atacante;
      try { await atkAplicarEfeito(nomeAlvoCrit, cfgCrit, contexto); } catch(e) {}
    }

    // ── 4. Re-render status ──────────────────────────────────────────────────
    if (typeof mapaRenderStatus === 'function') mapaRenderStatus();

    // ── 5. Marcar criativo como concluído no banco ───────────────────────────
    await sb(`criativos?id=eq.${encodeURIComponent(criativo.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: 'concluido', dano_aplicado: dano })
    });
    criativo.status      = 'concluido';
    criativo.dano_aplicado = dano;

    // ── 6. Toast e animação ──────────────────────────────────────────────────
    if (typeof mostrarToast === 'function') {
      if (ehSuporte)        mostrarToast(`✨ Suporte aplicado em ${alvo || criativo.atacante}!`, 'sucesso');
      else if (dano > 0)    mostrarToast(`💥 ${dano} de dano aplicado em ${alvo}!`, 'sucesso');
      else                  mostrarToast('Ação concluída sem dano', '');
    }
    if (criativo._tipoCritico && typeof mostrarAnimacaoCritico === 'function') {
      mostrarAnimacaoCritico(criativo._tipoCritico, criativo.atacante, dano, dano);
    }

    document.getElementById('modal-executar-criativo').style.display = 'none';
    EXEC_CRIATIVO_ATUAL = null;
    if (typeof criativoRenderMestre === 'function') criativoRenderMestre();
    if (typeof _finalizarAtaqueCampanha === 'function') await _finalizarAtaqueCampanha();

  } catch (error) {
    console.error('[Execução] Erro ao aplicar criativo:', error);
    if (typeof mostrarToast === 'function') mostrarToast('Erro ao aplicar ação', 'erro');
  }
}

function finalizarExecucaoCriativo() {
  // Pula direto para o final quando erro/falha
  document.getElementById('etapa-dano').style.display = 'none';
  document.getElementById('resultado-final').style.display = 'block';
  
  const finalEl = document.getElementById('dano-final-valor');
  finalEl.innerHTML = `
    <div style="padding:15px;background:rgba(127,140,141,0.1);border:2px solid rgba(127,140,141,0.3);border-radius:8px;text-align:center">
      <div style="font-size:2rem;font-weight:bold;color:#7f8c8d">0</div>
      <div style="font-size:0.8rem;color:#95a5a6;margin-top:5px">SEM DANO</div>
    </div>
  `;
}

function fecharModalExecucaoCriativo() {
  document.getElementById('modal-executar-criativo').style.display = 'none';
  EXEC_CRIATIVO_ATUAL = null;
}

console.log('[Creative] Sistema 2.0 de ações criativas carregado ✓');

window.abrirModalAprovacaoCompleta  = abrirModalAprovacaoCompleta;
window.atualizarFormulaPreview      = atualizarFormulaPreview;
window.aprSelecionarDado            = aprSelecionarDado;
window.aprDCPreview                 = aprDCPreview;
window.aprBuilderAdd                = aprBuilderAdd;
window.aprBuilderRemove             = aprBuilderRemove;
window.aprBuilderAtualizar          = aprBuilderAtualizar;
window.aprSkillToggle               = aprSkillToggle;
window.aprovarCriativoCompleto      = aprovarCriativoCompleto;
window.fecharModalAprovacaoCompleta = fecharModalAprovacaoCompleta;
window.abrirModalExecucaoCriativo   = abrirModalExecucaoCriativo;
window.rolarAcertoCriativo          = rolarAcertoCriativo;
window.rolarDanoCriativo            = rolarDanoCriativo;
window.aplicarDanoFinalCriativo     = aplicarDanoFinalCriativo;
window.finalizarExecucaoCriativo    = finalizarExecucaoCriativo;
window.fecharModalExecucaoCriativo  = fecharModalExecucaoCriativo;

/* [migração-esm] accessors globais */
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arGetTheme", { configurable: true, get: () => arGetTheme, set: (__v) => { arGetTheme = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arGetDadoEfetividade", { configurable: true, get: () => arGetDadoEfetividade, set: (__v) => { arGetDadoEfetividade = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arGetPenalidades", { configurable: true, get: () => arGetPenalidades, set: (__v) => { arGetPenalidades = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arCalcularPenalidadeHP", { configurable: true, get: () => arCalcularPenalidadeHP, set: (__v) => { arCalcularPenalidadeHP = __v; } });
Object.defineProperty(globalThis, "_origArCarregarTudo", { configurable: true, get: () => _origArCarregarTudo, set: (__v) => { _origArCarregarTudo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalSolicitarAtaque", { configurable: true, get: () => abrirModalSolicitarAtaque, set: (__v) => { abrirModalSolicitarAtaque = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arEnviarSolicitacaoAtaque", { configurable: true, get: () => arEnviarSolicitacaoAtaque, set: (__v) => { arEnviarSolicitacaoAtaque = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mostrarAtaqueAguardando", { configurable: true, get: () => mostrarAtaqueAguardando, set: (__v) => { mostrarAtaqueAguardando = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arRenderAtaquesArenaMestre", { configurable: true, get: () => arRenderAtaquesArenaMestre, set: (__v) => { arRenderAtaquesArenaMestre = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalAvaliarAtaque", { configurable: true, get: () => abrirModalAvaliarAtaque, set: (__v) => { abrirModalAvaliarAtaque = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arMestreAprovarAtaque", { configurable: true, get: () => arMestreAprovarAtaque, set: (__v) => { arMestreAprovarAtaque = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arMestreRejeitarAtaque", { configurable: true, get: () => arMestreRejeitarAtaque, set: (__v) => { arMestreRejeitarAtaque = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arMestreRejeitarAtaqueId", { configurable: true, get: () => arMestreRejeitarAtaqueId, set: (__v) => { arMestreRejeitarAtaqueId = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arMestreSemDanoFechar", { configurable: true, get: () => arMestreSemDanoFechar, set: (__v) => { arMestreSemDanoFechar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalRolarEfetividade", { configurable: true, get: () => abrirModalRolarEfetividade, set: (__v) => { abrirModalRolarEfetividade = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arRolarEfetividade", { configurable: true, get: () => arRolarEfetividade, set: (__v) => { arRolarEfetividade = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arConfirmarRolagemEfetividade", { configurable: true, get: () => arConfirmarRolagemEfetividade, set: (__v) => { arConfirmarRolagemEfetividade = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalDefinirDano", { configurable: true, get: () => abrirModalDefinirDano, set: (__v) => { abrirModalDefinirDano = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arAtkDnModo", { configurable: true, get: () => arAtkDnModo, set: (__v) => { arAtkDnModo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arAtkDnRolarDado", { configurable: true, get: () => arAtkDnRolarDado, set: (__v) => { arAtkDnRolarDado = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arMestreAplicarDano", { configurable: true, get: () => arMestreAplicarDano, set: (__v) => { arMestreAplicarDano = __v; } });
Object.defineProperty(globalThis, "_origArAcaoAtacar", { configurable: true, get: () => _origArAcaoAtacar, set: (__v) => { _origArAcaoAtacar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arPreviewCenarioListaImg", { configurable: true, get: () => arPreviewCenarioListaImg, set: (__v) => { arPreviewCenarioListaImg = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalCriarCenarioLista", { configurable: true, get: () => abrirModalCriarCenarioLista, set: (__v) => { abrirModalCriarCenarioLista = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "salvarCenarioLista", { configurable: true, get: () => salvarCenarioLista, set: (__v) => { salvarCenarioLista = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arAtivarCenarioLista", { configurable: true, get: () => arAtivarCenarioLista, set: (__v) => { arAtivarCenarioLista = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderCenariosLista", { configurable: true, get: () => renderCenariosLista, set: (__v) => { renderCenariosLista = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arDeletarCenario", { configurable: true, get: () => arDeletarCenario, set: (__v) => { arDeletarCenario = __v; } });
Object.defineProperty(globalThis, "_arCenBgTab", { configurable: true, get: () => _arCenBgTab, set: (__v) => { _arCenBgTab = __v; } });
Object.defineProperty(globalThis, "_arCenUploadDataUrl", { configurable: true, get: () => _arCenUploadDataUrl, set: (__v) => { _arCenUploadDataUrl = __v; } });
Object.defineProperty(globalThis, "_arCenSvgDataUrl", { configurable: true, get: () => _arCenSvgDataUrl, set: (__v) => { _arCenSvgDataUrl = __v; } });
Object.defineProperty(globalThis, "_arCenCanvasDataUrl", { configurable: true, get: () => _arCenCanvasDataUrl, set: (__v) => { _arCenCanvasDataUrl = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arCenBgTab", { configurable: true, get: () => arCenBgTab, set: (__v) => { arCenBgTab = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arCenBgGetFinal", { configurable: true, get: () => arCenBgGetFinal, set: (__v) => { arCenBgGetFinal = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arCenBgUrlPreview", { configurable: true, get: () => arCenBgUrlPreview, set: (__v) => { arCenBgUrlPreview = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arCenBgUpload", { configurable: true, get: () => arCenBgUpload, set: (__v) => { arCenBgUpload = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arCenBgClearUpload", { configurable: true, get: () => arCenBgClearUpload, set: (__v) => { arCenBgClearUpload = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arCenBgSvgPreview", { configurable: true, get: () => arCenBgSvgPreview, set: (__v) => { arCenBgSvgPreview = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arCenCopiarPromptSVG", { configurable: true, get: () => arCenCopiarPromptSVG, set: (__v) => { arCenCopiarPromptSVG = __v; } });
Object.defineProperty(globalThis, "_nmceContext", { configurable: true, get: () => _nmceContext, set: (__v) => { _nmceContext = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arCenAbrirCanvas", { configurable: true, get: () => arCenAbrirCanvas, set: (__v) => { arCenAbrirCanvas = __v; } });
Object.defineProperty(globalThis, "_origRenderPropostas", { configurable: true, get: () => _origRenderPropostas, set: (__v) => { _origRenderPropostas = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "arAprovarPropostaCenarioLista", { configurable: true, get: () => arAprovarPropostaCenarioLista, set: (__v) => { arAprovarPropostaCenarioLista = __v; } });
Object.defineProperty(globalThis, "_origRenderArenaCenario", { configurable: true, get: () => _origRenderArenaCenario, set: (__v) => { _origRenderArenaCenario = __v; } });
Object.defineProperty(globalThis, "_origArAtualizarUIpeloPapel", { configurable: true, get: () => _origArAtualizarUIpeloPapel, set: (__v) => { _origArAtualizarUIpeloPapel = __v; } });
Object.defineProperty(globalThis, "_origArTab", { configurable: true, get: () => _origArTab, set: (__v) => { _origArTab = __v; } });
Object.defineProperty(globalThis, "_origRenderMesa", { configurable: true, get: () => _origRenderMesa, set: (__v) => { _origRenderMesa = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalAprovacaoCompleta", { configurable: true, get: () => abrirModalAprovacaoCompleta, set: (__v) => { abrirModalAprovacaoCompleta = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "aprSkillToggle", { configurable: true, get: () => aprSkillToggle, set: (__v) => { aprSkillToggle = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "atualizarFormulaPreview", { configurable: true, get: () => atualizarFormulaPreview, set: (__v) => { atualizarFormulaPreview = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "aprSelecionarDado", { configurable: true, get: () => aprSelecionarDado, set: (__v) => { aprSelecionarDado = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "aprDCPreview", { configurable: true, get: () => aprDCPreview, set: (__v) => { aprDCPreview = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "aprBuilderAdd", { configurable: true, get: () => aprBuilderAdd, set: (__v) => { aprBuilderAdd = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "aprBuilderRemove", { configurable: true, get: () => aprBuilderRemove, set: (__v) => { aprBuilderRemove = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "aprBuilderAtualizar", { configurable: true, get: () => aprBuilderAtualizar, set: (__v) => { aprBuilderAtualizar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "aprEfeitoCriticoChange", { configurable: true, get: () => aprEfeitoCriticoChange, set: (__v) => { aprEfeitoCriticoChange = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_lerEfeitosModal", { configurable: true, get: () => _lerEfeitosModal, set: (__v) => { _lerEfeitosModal = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "aprovarCriativoCompleto", { configurable: true, get: () => aprovarCriativoCompleto, set: (__v) => { aprovarCriativoCompleto = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharModalAprovacaoCompleta", { configurable: true, get: () => fecharModalAprovacaoCompleta, set: (__v) => { fecharModalAprovacaoCompleta = __v; } });
Object.defineProperty(globalThis, "EXEC_CRIATIVO_ATUAL", { configurable: true, get: () => EXEC_CRIATIVO_ATUAL, set: (__v) => { EXEC_CRIATIVO_ATUAL = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalExecucaoCriativo", { configurable: true, get: () => abrirModalExecucaoCriativo, set: (__v) => { abrirModalExecucaoCriativo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "rolarAcertoCriativo", { configurable: true, get: () => rolarAcertoCriativo, set: (__v) => { rolarAcertoCriativo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "rolarDanoCriativo", { configurable: true, get: () => rolarDanoCriativo, set: (__v) => { rolarDanoCriativo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "aplicarDanoFinalCriativo", { configurable: true, get: () => aplicarDanoFinalCriativo, set: (__v) => { aplicarDanoFinalCriativo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "finalizarExecucaoCriativo", { configurable: true, get: () => finalizarExecucaoCriativo, set: (__v) => { finalizarExecucaoCriativo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharModalExecucaoCriativo", { configurable: true, get: () => fecharModalExecucaoCriativo, set: (__v) => { fecharModalExecucaoCriativo = __v; } });
