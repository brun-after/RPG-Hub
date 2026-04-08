// systems/creative.js
// RPG Hub — Tutorial navigation, arena attack flow, arena scenario management
// Includes: TUTORIAL_STEPS, tutorialMostrar(), arena attack modals, scenario CRUD

// ══════════════════════════════════════════════════════════════
// TUTORIAL DE NAVEGAÇÃO
// ══════════════════════════════════════════════════════════════

const TUTORIAL_STEPS = {
  lore: {
    titulo: 'Lore — Conhecimento do Mundo',
    passos: [
      { t:'O que é Lore?', txt:'O Lore é o repositório de informações da campanha: história do mundo, facções, magia, regras especiais. É o seu manual de referência durante o jogo.' },
      { t:'Navegando por categorias', txt:'Use os filtros coloridos para navegar entre categorias. "Segredo" aparece só para o Mestre — segredos ocultos da narrativa ficam aqui.' },
      { t:'Editando entradas', txt:'O Mestre pode editar qualquer entrada clicando no ícone ✏. Jogadores com permissão especial também podem colaborar.' },
      { t:'Chat da sessão', txt:'O chat em tempo real está no ícone 💬 no topo. Converse com os outros jogadores durante a sessão sem sair da tela.' },
    ]
  },
  personagem: {
    titulo: 'Personagem — Ficha Completa',
    passos: [
      { t:'Navegando entre personagens', txt:'Os botões no topo desta aba mostram todos os personagens. Clique para alternar. O Mestre vê todos; jogadores veem o próprio personagem em destaque.' },
      { t:'HP e Vida', txt:'A barra vermelha é o HP atual. O Mestre pode ajustar clicando nos controles. Quando o HP chega a 0, o personagem fica incapacitado.' },
      { t:'Nível e XP', txt:'A barra dourada mostra a experiência. Quando XP atingir o limite definido pelo Mestre, o personagem sobe de nível automaticamente.' },
      { t:'Fundo do personagem', txt:'Abaixo das barras está o background e informações narrativas do personagem — história, motivações, aparência.' },
    ]
  },
  atributos: {
    titulo: 'Atributos — Ficha de Stats',
    passos: [
      { t:'O que são atributos?', txt:'Atributos são os valores numéricos que definem as capacidades do personagem: Força, Destreza, Mana, etc. Eles influenciam habilidades e combate.' },
      { t:'Editando valores', txt:'O Mestre pode editar qualquer atributo clicando no campo. Jogadores podem editar se o Mestre conceder permissão nas configurações.' },
      { t:'Status e recursos', txt:'Atributos de Status (Mana, Stamina, etc.) têm barra própria mostrando quanto resta. Habilidades consomem esses recursos ao serem usadas.' },
      { t:'Atributos especiais', txt:'Atributos especiais (Sanidade, Karma, etc.) aparecem com destaque visual e normalmente representam elementos narrativos únicos da campanha.' },
    ]
  },
  dados: {
    titulo: 'Dados — Sistema de Rolagem',
    passos: [
      { t:'Rolando dados', txt:'Selecione um dado clicando nele — ele ficará destacado em azul. Depois clique em "Rolar" ou pressione Espaço para rolar.' },
      { t:'Críticos no d20', txt:'Com o d20, um resultado 20 é Crítico Positivo (sucesso excepcional) e 1 é Falha Crítica. Os resultados aparecem em destaque dourado ou vermelho.' },
      { t:'Histórico', txt:'Todas as rolagens ficam registradas no histórico abaixo. Útil para confirmar resultados sem discussão.' },
      { t:'Dados em combate', txt:'Durante uma batalha na aba Mesa, você pode rolar dados diretamente na barra de batalha. Pressione Espaço no mapa para rolar o dado selecionado.' },
    ]
  },
  mapas: {
    titulo: 'Mesa — Mapa Tático',
    passos: [
      { t:'O mapa da sessão', txt:'Esta aba é a mesa de jogo. Os personagens aparecem como tokens coloridos com a inicial do nome. É onde acontecem os combates.' },
      { t:'Navegando no mapa', txt:'Arraste para mover o mapa. Use dois dedos para zoom. O Mestre pode mover tokens; jogadores movem o próprio token quando é sua vez.' },
      { t:'Iniciando batalha', txt:'O Mestre clica em ⚔ Iniciar Batalha para começar o combate por turnos. Cada participante rola d20 para iniciativa — a ordem determina quem age.' },
      { t:'Ferramentas', txt:'Na barra de ferramentas: 📏 mede distâncias no mapa, 👤+ adiciona personagens à cena, ⚔✨ cria batalhas com IA, 🗺+ cria novos mapas.' },
    ]
  },
  tabelas: {
    titulo: 'Tabelas — Dados da Campanha',
    passos: [
      { t:'O que são tabelas?', txt:'Tabelas são listas customizadas que o Mestre cria e edita durante a sessão: mercados, tabelas de loot, preços de itens, registros de NPCs.' },
      { t:'Visibilidade', txt:'O Mestre controla o que os jogadores veem usando o botão 👁. Tabelas ocultas ficam visíveis só para o Mestre.' },
      { t:'Criando tabelas', txt:'Clique em "Nova Tabela" para criar. Defina colunas com nomes relevantes e adicione linhas com os dados. Você pode editar durante a sessão.' },
    ]
  },
  config: {
    titulo: 'Configurações da Campanha',
    passos: [
      { t:'Vincular seu personagem', txt:'Na seção "Meu personagem", selecione qual personagem da campanha é o seu e clique em Salvar. Isso conecta sua conta ao personagem.' },
      { t:'Dados ativos', txt:'O Mestre pode escolher quais tipos de dado aparecem na aba Dados desta campanha — d4, d6, d8, d10, d12, d20.' },
      { t:'Gerenciar membros', txt:'O Mestre adiciona jogadores pelo nickname, atribui personagens e define permissões individuais (ex: quem pode editar Lore).' },
      { t:'Este tutorial', txt:'Você pode ativar ou desativar este tutorial a qualquer momento aqui em "Tutorial de Navegação". Use "Reiniciar" para ver tudo novamente.' },
    ]
  },
};

// Estado do tutorial por campanha
let _TUTORIAL_ABA = null;
let _TUTORIAL_PASSO = 0;
let _TUTORIAL_PASSOS = [];

function tutorialGetState(rpgId) {
  try {
    const raw = localStorage.getItem('rpghub_tutorial_' + rpgId);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return { ativo: true, passos_vistos: {} }; // ativo por padrão
}

function tutorialSetState(rpgId, state) {
  try { localStorage.setItem('rpghub_tutorial_' + rpgId, JSON.stringify(state)); } catch(e) {}
}

function tutorialIsAtivo() {
  if (!RPG_DATA?.rpgId) return false;
  const st = tutorialGetState(RPG_DATA.rpgId);
  return st.ativo !== false;
}

function tutorialMostrar(aba) {
  if (!tutorialIsAtivo()) return;
  const cfg = TUTORIAL_STEPS[aba];
  if (!cfg) return;

  const st = tutorialGetState(RPG_DATA.rpgId);
  if (st.passos_vistos?.[aba]) return; // já viu esta aba nesta sessão

  _TUTORIAL_ABA = aba;
  _TUTORIAL_PASSO = 0;
  _TUTORIAL_PASSOS = cfg.passos;

  _tutorialAtualizarUI();
  document.getElementById('tutorial-overlay').classList.add('ativo');
  document.getElementById('tutorial-dialog').classList.add('visivel');
  document.getElementById('tutorial-backdrop').style.display = 'block';
}

function _tutorialAtualizarUI() {
  const cfg = TUTORIAL_STEPS[_TUTORIAL_ABA];
  if (!cfg) return;
  const passo = _TUTORIAL_PASSOS[_TUTORIAL_PASSO];

  document.getElementById('tutorial-aba-nome').textContent = cfg.titulo;
  document.getElementById('tutorial-counter').textContent = `${_TUTORIAL_PASSO + 1} / ${_TUTORIAL_PASSOS.length}`;
  document.getElementById('tutorial-titulo').textContent = passo.t;
  document.getElementById('tutorial-texto').textContent = passo.txt;

  // Dots de progresso
  document.getElementById('tutorial-prog-dots').innerHTML = _TUTORIAL_PASSOS.map((_,i) =>
    `<div class="tutorial-prog-dot ${i === _TUTORIAL_PASSO ? 'ativo' : ''}"></div>`
  ).join('');

  // Botão muda no último passo
  const isUltimo = _TUTORIAL_PASSO >= _TUTORIAL_PASSOS.length - 1;
  const btn = document.getElementById('tutorial-next-btn');
  btn.textContent = isUltimo ? 'Entendido ✓' : 'Próximo →';
}

function tutorialAvancar() {
  if (_TUTORIAL_PASSO < _TUTORIAL_PASSOS.length - 1) {
    _TUTORIAL_PASSO++;
    _tutorialAtualizarUI();
  } else {
    tutorialFecharAba();
  }
}

function tutorialProximo() {
  // Skip este passo
  tutorialAvancar();
}

function tutorialFecharAba() {
  // Marcar esta aba como vista
  if (RPG_DATA?.rpgId && _TUTORIAL_ABA) {
    const st = tutorialGetState(RPG_DATA.rpgId);
    if (!st.passos_vistos) st.passos_vistos = {};
    st.passos_vistos[_TUTORIAL_ABA] = true;
    tutorialSetState(RPG_DATA.rpgId, st);
  }
  _fecharDialogTutorial();

  // Oferecer desativar após primeira aba completa
  const st = tutorialGetState(RPG_DATA?.rpgId || '');
  const visitadas = Object.keys(st.passos_vistos || {}).length;
  if (visitadas === 1) {
    setTimeout(() => {
      mostrarToast('Tutorial ativo. Desative nas ⚙ Configurações a qualquer momento.', '');
    }, 400);
  }
}

function tutorialPularTudo() {
  _fecharDialogTutorial();
}

function tutorialDesativarPermanente(checked) {
  if (!checked) return;
  // Desativa o tutorial permanentemente para esta campanha
  if (RPG_DATA?.rpgId) {
    tutorialToggle(false);
  }
  _fecharDialogTutorial();
  mostrarToast('📖 Tutorial desativado. Reative nas ⚙ Configurações.', '');
}

function _fecharDialogTutorial() {
  document.getElementById('tutorial-overlay').classList.remove('ativo');
  document.getElementById('tutorial-dialog').classList.remove('visivel');
  document.getElementById('tutorial-backdrop').style.display = 'none';
}

// Toggle nas configurações
function tutorialToggle(ativo) {
  if (!RPG_DATA?.rpgId) return;
  const st = tutorialGetState(RPG_DATA.rpgId);
  st.ativo = ativo;
  tutorialSetState(RPG_DATA.rpgId, st);
  mostrarToast(ativo ? '📖 Tutorial ativado' : '📖 Tutorial desativado', '');
}

// Reiniciar (apagar vistos)
function tutorialReiniciar() {
  if (!RPG_DATA?.rpgId) return;
  const st = tutorialGetState(RPG_DATA.rpgId);
  st.passos_vistos = {};
  st.ativo = true;
  tutorialSetState(RPG_DATA.rpgId, st);
  // Atualizar toggle
  const tog = document.getElementById('cfg-tutorial-toggle');
  if (tog) tog.checked = true;
  mostrarToast('↺ Tutorial reiniciado! Aparecerá novamente em cada aba.', 'sucesso');
}

// Sincronizar toggle quando entra na aba config
(function _hookTutorialConfig() {
  const origRenderConfig = window.renderConfig;
  window.renderConfig = function() {
    origRenderConfig && origRenderConfig.apply(this, arguments);
    setTimeout(() => {
      const tog = document.getElementById('cfg-tutorial-toggle');
      if (tog && RPG_DATA?.rpgId) {
        tog.checked = tutorialIsAtivo();
      }
    }, 50);
  };
})();

// Hook na função abrirAba para disparar tutorial
(function _hookTutorialAba() {
  const origAba = window.abrirAba;
  window.abrirAba = function(aba, btn) {
    origAba && origAba.call(this, aba, btn);
    // Mapear nomes de aba para chaves do tutorial
    const mapaAbas = {
      lore: 'lore',
      personagem: 'personagem',
      atributos: 'atributos',
      dados: 'dados',
      mapas: 'mapas',
      tabelas: 'tabelas',
      config: 'config',
    };
    const chave = mapaAbas[aba];
    if (chave) {
      setTimeout(() => tutorialMostrar(chave), 300);
    }
  };
})();

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
function arCalcularPenalidadeHP(nomePersonagem) {
  const c = AR.chars.find(x => x.nome === nomePersonagem);
  if (!c) return 0;
  const hpMax = c.hp_max ?? c.custom_attrs?.hp_max ?? 100;
  const hpAtual = c.hp_atual ?? hpMax;
  const hpPct = hpMax > 0 ? (hpAtual / hpMax) * 100 : 100;
  const pens = arGetPenalidades();
  let penTotal = 0;
  // Aplicar penalidades cumulativas (todas as que se aplicam)
  pens.forEach(p => { if (hpPct < p.hp) penTotal += p.penalidade; });
  return penTotal;
}

// ══════════════════════════════════════════════════════════════
// SISTEMA DE ATAQUE ARENA — NOVO FLUXO
// ══════════════════════════════════════════════════════════════
// Estado temporário dos ataques arena
if (!AR.estado) AR.estado = {};
if (!AR.estado.ataques_arena) AR.estado.ataques_arena = [];

// Garante que o estado ataques_arena existe após carregamento
const _origArCarregarTudo = window.arCarregarTudo;
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
  const c = AR.chars.find(x => x.nome === meuChar);
  if (c && c.hp_atual <= 0) { arToast('Seu personagem está incapacitado', 'erro'); return; }
  document.getElementById('ar-atk-sol-atacante').textContent = meuChar;
  // Preencher alvos
  const sel = document.getElementById('ar-atk-sol-alvo');
  sel.innerHTML = AR.chars.filter(x => x.nome !== meuChar).map(x =>
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

function mostrarAtaqueAguardando(id) {
  // Aguarda update via polling/realtime
  const check = setInterval(async () => {
    if (!AR.session) { clearInterval(check); return; }
    const reg = await arSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&select=arena_estado&limit=1`).catch(()=>null);
    const raw = reg && reg[0] ? reg[0].arena_estado : null;
    if (!raw) return;
    const estado = typeof raw === 'object' ? raw : JSON.parse(raw || '{}');
    const atk = (estado.ataques_arena || []).find(a => a.id === id);
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
  const pendentes = (AR.estado.ataques_arena || []).filter(a => a.status === 'aguardando_mestre');
  const el = document.getElementById('ar-ataques-pendentes');
  if (!el) return;
  const rolagens = (AR.estado.ataques_arena || []).filter(a => a.status === 'rolagem_enviada');

  const temQualquer = pendentes.length > 0 || rolagens.length > 0;
  el.style.display = temQualquer ? 'block' : 'none';
  if (!temQualquer) { el.innerHTML = ''; return; }

  let html = '';
  if (pendentes.length) {
    html += `<div style="font-family:'Cinzel',serif;font-size:0.65rem;color:rgba(240,204,106,0.7);text-transform:uppercase;margin-bottom:8px">⚔ Solicitações de Ataque</div>`;
    html += pendentes.map(a => `
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
    html += rolagens.map(a => {
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

function abrirModalAvaliarAtaque(id) {
  const atk = (AR.estado.ataques_arena || []).find(a => a.id === id);
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
  const atk = (AR.estado.ataques_arena || []).find(a => a.id === id);
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

async function arMestreRejeitarAtaqueId(id) {
  const atk = (AR.estado.ataques_arena || []).find(a => a.id === id);
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
  const atk = (AR.estado.ataques_arena || []).find(a => a.id === id);
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

function abrirModalRolarEfetividade(id) {
  const atk = (AR.estado.ataques_arena || []).find(a => a.id === id);
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
  const atk = (AR.estado.ataques_arena || []).find(a => a.id === id);
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
    document.getElementById('ar-atk-rl-btn-confirmar').dataset.rolagem = rolagemFinal;
  }, 150);
}

async function arConfirmarRolagemEfetividade() {
  const id = document.getElementById('ar-atk-rl-id').value;
  const rolagemFinal = parseInt(document.getElementById('ar-atk-rl-btn-confirmar').dataset.rolagem);
  const atk = (AR.estado.ataques_arena || []).find(a => a.id === id);
  if (!atk) return;
  atk.rolagem = rolagemFinal;
  atk.status = 'rolagem_enviada';
  await arSalvarEstado();
  fecharModal('ar-modal-atk-rolar');
  arToast('Rolagem enviada ao Mestre!', 'sucesso');
  // Polling para resultado
  const check = setInterval(async () => {
    if (!AR.session) { clearInterval(check); return; }
    const reg = await arSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&select=arena_estado&limit=1`).catch(()=>null);
    const raw = reg && reg[0] ? reg[0].arena_estado : null;
    if (!raw) return;
    const estado = typeof raw === 'object' ? raw : JSON.parse(raw || '{}');
    const a = (estado.ataques_arena || []).find(x => x.id === id);
    if (!a) { clearInterval(check); return; }
    if (a.status === 'concluido') {
      clearInterval(check);
      AR.estado = estado;
      renderArenaPersonagens(); renderArenaEntidades();
    }
  }, 2500);
  setTimeout(() => clearInterval(check), 120000);
}

function abrirModalDefinirDano(id) {
  const atk = (AR.estado.ataques_arena || []).find(a => a.id === id);
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
  alvosEl.innerHTML = AR.chars.map(c => {
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
  const _arRId = (id) => document.getElementById(id);
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

function arAtkDnModo(modo) {
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
  el.dataset.total = total;
}

async function arMestreAplicarDano() {
  const id = document.getElementById('ar-atk-dn-id').value;
  const atk = (AR.estado.ataques_arena || []).find(a => a.id === id);
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
    const arAnim = { tipo: arAnimTipo };
    if (_arIsMidia) {
      arAnim.url     = (arAnimTipo !== 'svg' ? document.getElementById('ar-atk-dn-anim-url')?.value.trim() : '') || '';
      arAnim.svg     = arAnimTipo === 'svg' ? document.getElementById('ar-atk-dn-anim-svg')?.value.trim() : '';
      arAnim.tamanho = parseInt(document.getElementById('ar-atk-dn-anim-tamanho')?.value) || 120;
      arAnim.duracao = parseInt(document.getElementById('ar-atk-dn-anim-duracao')?.value) || 1500;
      arAnim.posicao = document.getElementById('ar-atk-dn-anim-posicao')?.value || 'alvo';
    } else {
      arAnim.cor    = document.getElementById('ar-atk-dn-anim-cor')?.value   || '#e74c3c';
      arAnim.icone  = document.getElementById('ar-atk-dn-anim-icone')?.value.trim() || '';
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
const _origArAcaoAtacar = window.arAcaoAtacar;
window.arAcaoAtacar = async function() {
  if (AR.myRole === 'mestre') { _origArAcaoAtacar?.(); return; }
  abrirModalSolicitarAtaque();
};

// ═══════════════════════════════════════════════════════════════
// CENÁRIOS LISTA — NOVO SISTEMA
// ═══════════════════════════════════════════════════════════════
function arPreviewCenarioListaImg(url) {
  const prev = document.getElementById('ar-cenario-lista-img-preview');
  const img = document.getElementById('ar-cenario-lista-img-el');
  if (!url) { prev.style.display = 'none'; return; }
  img.src = url;
  prev.style.display = 'block';
}

function abrirModalCriarCenarioLista(idEditar) {
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
    const cen = (AR.estado.cenarios_lista || []).find(c => c.id === idEditar);
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
    const idx = AR.estado.cenarios_lista.findIndex(c => c.id === idEditar);
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

async function arAtivarCenarioLista(id) {
  if (AR.myRole !== 'mestre') { arToast('Só o Mestre pode ativar cenários', 'erro'); return; }
  const cen = (AR.estado.cenarios_lista || []).find(c => c.id === id);
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
  el.innerHTML = cenarios.map(cen => {
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

async function arDeletarCenario(id) {
  if (AR.myRole !== 'mestre') return;
  if (!confirm('Remover este cenário?')) return;
  AR.estado.cenarios_lista = (AR.estado.cenarios_lista || []).filter(c => c.id !== id);
  await arSalvarEstado();
  renderCenariosLista();
  arToast('Cenário removido', '');
}

// ═══════════════════════════════════════════════════════════════
// ARENA CENÁRIO — 4 MODOS DE FUNDO (URL / UPLOAD / SVG / CANVAS)
// Paralelo ao sistema de campanha, sem interferência
// ═══════════════════════════════════════════════════════════════
let _arCenBgTab       = 'url';
let _arCenUploadDataUrl = null;
let _arCenSvgDataUrl    = null;
let _arCenCanvasDataUrl = null;

function arCenBgTab(tab) {
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

function arCenBgUrlPreview(url) {
  const prev = document.getElementById('ar-cen-img-preview');
  if (!prev) return;
  if (url) { prev.src = url; prev.style.display = 'block'; }
  else { prev.style.display = 'none'; }
}

async function arCenBgUpload(input) {
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

function arCenBgSvgPreview(svgText) {
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
let _nmceContext = 'nm';

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
      if (c) { const ctx = c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); ctx.drawImage(img,0,0,c.width,c.height); nmCE.history = []; nmcePush(); }
    };
    img.src = _arCenCanvasDataUrl;
  }
  nmceFullscreenAbrir();
}

// Sobrescrever renderPropostasCenario para incluir propostas de cenário da lista
const _origRenderPropostas = window.renderPropostasCenario;
window.renderPropostasCenario = function() {
  const wrap = document.getElementById('ar-cenario-propostas-wrap');
  const list = document.getElementById('ar-cenario-propostas-list');
  if (!wrap || !list || AR.myRole !== 'mestre') return;
  const propostas = AR.estado.propostas_cenario || [];
  wrap.style.display = propostas.length ? 'block' : 'none';
  list.innerHTML = propostas.map(p => {
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

async function arAprovarPropostaCenarioLista(id) {
  const p = (AR.estado.propostas_cenario||[]).find(x=>x.id===id);
  if (!p) return;
  if (!AR.estado.cenarios_lista) AR.estado.cenarios_lista = [];
  const isCriacao = p.tipo === 'criacao' || !p.tipo;
  if (isCriacao) {
    AR.estado.cenarios_lista.push({ id: 'cen_'+Date.now(), nome: p.nome||p.texto, descricao: p.descricao||p.texto, img: p.img||'', grid: p.grid, escala_val: p.escala_val, escala_unit: p.escala_unit, autor: p.autor, ts: p.ts });
  } else if (p.tipo === 'edicao') {
    const idx = AR.estado.cenarios_lista.findIndex(c => c.id === p.cenario_id);
    if (idx >= 0) AR.estado.cenarios_lista[idx] = { ...AR.estado.cenarios_lista[idx], nome: p.nome, descricao: p.descricao, img: p.img, grid: p.grid, escala_val: p.escala_val, escala_unit: p.escala_unit };
  }
  AR.estado.propostas_cenario = (AR.estado.propostas_cenario||[]).filter(x=>x.id!==id);
  await arSalvarEstado();
  renderCenariosLista();
  renderPropostasCenario();
  arToast('Cenário aprovado!', 'sucesso');
}

// Sobrescrever renderArenaCenario para incluir a nova lista
const _origRenderArenaCenario = window.renderArenaCenario;
window.renderArenaCenario = function() {
  _origRenderArenaCenario?.();
  renderCenariosLista();
  renderPropostasCenario();
  arRenderAtaquesArenaMestre();
};

// ═══════════════════════════════════════════════════════════════
// Atualizar UI do cenário com novos botões
// ═══════════════════════════════════════════════════════════════
const _origArAtualizarUIpeloPapel = window.arAtualizarUIpeloPapel;
window.arAtualizarUIpeloPapel = function() {
  _origArAtualizarUIpeloPapel?.();
  renderCenariosLista();
  renderPropostasCenario();
};

// Expor renderCenariosLista globalmente para chamadas no arTab
const _origArTab = window.arTab;
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
const _origRenderMesa = window.renderMesa;
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
  let el = null;
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
    
    // Forçar visibilidade
    el.style.display = 'block';
    
    setTimeout(() => {
      console.log('[Scroll] Executando scrollIntoView...');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      console.log('[Aprovações] Scroll realizado com sucesso');
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
    if (mesaAcaoPainel) {
      mesaAcaoPainel.appendChild(wrap);
      console.log('[Aprovações Campanha] Elemento criado e inserido em mesa-acao-painel');
    } else {
      // Fallback: inserir no tab-mapas
      const tabMapas = document.getElementById('tab-mapas');
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
  console.log('[Aprovações Campanha] Painel exibido - renderizando', pendentes.length, 'aprovações');
  
  const html = pendentes.map(criativo => {
    const descricaoTruncada = (criativo.descricao || 'Ação criativa')
      .substring(0, 80) + ((criativo.descricao || '').length > 80 ? '…' : '');
    
    const tipoCor = {
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
            onclick="aprovarCriativo('${criativo.id}')" 
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
  
  // Atualizar painel de ações da mesa se houver pendentes
  if (typeof _mesaRenderAcoes === 'function') {
    _mesaRenderAcoes();
  }
  
  // Retornar o elemento criado/encontrado
  return wrap;
};


// ────────────────────────────────────────────────────────────────
// Função para aprovar uma ação criativa
// ────────────────────────────────────────────────────────────────
window.aprovarCriativo = async function(criativoId) {
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
window.rejeitarCriativo = async function(criativoId) {
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
