// ui/tutorial.js
// RPG Hub — Tutorial navigation system
// Includes: TUTORIAL_STEPS, tutorialMostrar(), tutorialToggle(), tutorialReiniciar()


// ══════════════════════════════════════════════════════════════
// TUTORIAL DE NAVEGAÇÃO
// ══════════════════════════════════════════════════════════════

var TUTORIAL_STEPS: Record<string, any> = {
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
var _TUTORIAL_ABA: any = null;
var _TUTORIAL_PASSO = 0;
var _TUTORIAL_PASSOS: any = [];

function tutorialGetState(rpgId: any) {
  try {
    const raw = localStorage.getItem('rpghub_tutorial_' + rpgId);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return { ativo: true, passos_vistos: {} }; // ativo por padrão
}

function tutorialSetState(rpgId: any, state: any) {
  try { localStorage.setItem('rpghub_tutorial_' + rpgId, JSON.stringify(state)); } catch(e) {}
}

function tutorialIsAtivo() {
  if (!RPG_DATA?.rpgId) return false;
  const st = tutorialGetState(RPG_DATA.rpgId);
  return st.ativo !== false;
}

function tutorialMostrar(aba: any) {
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
  document.getElementById('tutorial-prog-dots').innerHTML = _TUTORIAL_PASSOS.map((_: any,i: any) =>
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

function tutorialDesativarPermanente(checked: any) {
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
function tutorialToggle(ativo: any) {
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
    origRenderConfig && origRenderConfig.apply(this, arguments as any);
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
    const mapaAbas: Record<string, any> = {
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


/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "TUTORIAL_STEPS", { configurable: true, get: () => TUTORIAL_STEPS, set: (__v) => { TUTORIAL_STEPS = __v; } });
Object.defineProperty(globalThis, "_TUTORIAL_ABA", { configurable: true, get: () => _TUTORIAL_ABA, set: (__v) => { _TUTORIAL_ABA = __v; } });
Object.defineProperty(globalThis, "_TUTORIAL_PASSO", { configurable: true, get: () => _TUTORIAL_PASSO, set: (__v) => { _TUTORIAL_PASSO = __v; } });
Object.defineProperty(globalThis, "_TUTORIAL_PASSOS", { configurable: true, get: () => _TUTORIAL_PASSOS, set: (__v) => { _TUTORIAL_PASSOS = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "tutorialGetState", { configurable: true, get: () => tutorialGetState, set: (__v) => { tutorialGetState = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "tutorialSetState", { configurable: true, get: () => tutorialSetState, set: (__v) => { tutorialSetState = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "tutorialIsAtivo", { configurable: true, get: () => tutorialIsAtivo, set: (__v) => { tutorialIsAtivo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "tutorialMostrar", { configurable: true, get: () => tutorialMostrar, set: (__v) => { tutorialMostrar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_tutorialAtualizarUI", { configurable: true, get: () => _tutorialAtualizarUI, set: (__v) => { _tutorialAtualizarUI = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "tutorialAvancar", { configurable: true, get: () => tutorialAvancar, set: (__v) => { tutorialAvancar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "tutorialProximo", { configurable: true, get: () => tutorialProximo, set: (__v) => { tutorialProximo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "tutorialFecharAba", { configurable: true, get: () => tutorialFecharAba, set: (__v) => { tutorialFecharAba = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "tutorialPularTudo", { configurable: true, get: () => tutorialPularTudo, set: (__v) => { tutorialPularTudo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "tutorialDesativarPermanente", { configurable: true, get: () => tutorialDesativarPermanente, set: (__v) => { tutorialDesativarPermanente = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_fecharDialogTutorial", { configurable: true, get: () => _fecharDialogTutorial, set: (__v) => { _fecharDialogTutorial = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "tutorialToggle", { configurable: true, get: () => tutorialToggle, set: (__v) => { tutorialToggle = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "tutorialReiniciar", { configurable: true, get: () => tutorialReiniciar, set: (__v) => { tutorialReiniciar = __v; } });
