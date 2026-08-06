// types.d.ts
// RPG Hub — Declarações de globals compartilhados entre módulos.
// Os módulos se comunicam via window (rodapés "[migração-esm] accessors globais");
// aqui declaramos o que não existe como declaração top-level em nenhum módulo:
// libs de CDN, globals dos <script> inline do index.html e globals de runtime
// puro (atribuídos via window.* ou referenciados sob guarda de typeof).
// Tipos serão refinados nas próximas entregas (Entregas 3-4).

export {};

declare global {
  // Entrega 4: o index signature de Window foi removido — window.X agora
  // resolve pelo global declarado (Window & typeof globalThis), tornando as
  // chamadas cross-module verificáveis. Nomes que só existem via window.*
  // ficam no bloco auto-gerado window-globals abaixo.
  // Membros de window com tipo real (Entrega 4) — mantidos fora do bloco
  // auto-gerado; o gerador só re-inclui nomes que o tsc reporta como ausentes.
  interface Window {
    RPG_DATA: RpgData | null;
    MAPA_STATE: MapaState;
    CRIATIVOS_CAMP: CriativoCampanha[];
    BATALHA_ATUAL_ID: string | null;
    CURRENT_RPG: any;
    AVT_EVENTS?: Record<string, { handler?: string; persist?: 'never' | 'snapshot' | 'immediate'; reliable?: boolean; relay?: boolean }>;
    __avtPendingBroadcasts?: Array<{ ev: string; pl: any; at: number }>;
    __avtFlushPendingBroadcasts?: () => void;
  }

  // [migração-ts:window-globals:início]
  interface Window {
    CREATURE_MODELS?: any;
    _AVT_PATCH_V22_LOADED?: any;
    _AVT_RT_HANDLERS_BOUND?: any;
    _CTRL_TRIGGER_ATIVO?: any;
    _MESA_ATK_STATE?: any;
    _RT_HP_THROTTLE_INSTALLED?: any;
    __GRID_TACTICAL__?: any;
    __MAPS_GRID_CORE_LOADED__?: any;
    __tokenMountObserver?: any;
    __tokenMountPoll?: any;
    _abrirModalPacote?: any;
    _acaoAlvoTipoAtual?: any;
    _acaoPersonagemAtual?: any;
    _acaoTipoAtual?: any;
    _aeqEditIdx?: any;
    _aeqGesture?: any;
    _aeqWarpGesture?: any;
    _aeqWorking?: any;
    _animCtrlMap?: any;
    _animGenSelectedFile?: any;
    _animMontarTokensNoMapa?: any;
    _animRendererVersion?: any;
    _animScheduleTokenMount?: any;
    _apmodAnimCtrl?: any;
    _apmodAnimTabCtrl?: any;
    _apmodAnimado?: any;
    _apmodCriaturaModelo?: any;
    _apmodEquipsVisuais?: any;
    _apmodHeadAnimCtrl?: any;
    _apmodJsonPartes?: any;
    _apmodLastBaseTab?: any;
    _apmodLastTab?: any;
    _apmodMiniAnimCtrl?: any;
    _apmodNome?: any;
    _apmodOriginal?: any;
    _apmodOriginalStale?: any;
    _apmodTints?: any;
    _aprBuilder?: any;
    _arAparenciaHook?: any;
    _arAparenciaNome?: any;
    _atkReativaUsar?: any;
    _atkTriggerAplicar?: any;
    _atkTriggerCancelar?: any;
    _atkTriggerSidebarAtivo?: any;
    _avtAbrirFichaMobile?: any;
    _avtAbrirModalTransferirHost?: any;
    _avtAcaoParaHost?: any;
    _avtAguardarSemHost?: any;
    _avtAutoRollTimer?: any;
    _avtBuildStateTick?: any;
    _avtBulkAparState?: any;
    _avtCtrlZoom?: any;
    _avtEditFaseLockAtual?: any;
    _avtFaseHostUnloadBound?: any;
    _avtIniciarHpHeartbeat?: any;
    _avtIniciarRegenHpPorSegundo?: any;
    _avtMenuPlayerMusicPref?: any;
    _avtNpcAddPresetKey?: any;
    _avtNpcApplyDamage?: any;
    _avtNpcClasseEditando?: any;
    _avtNpcClasseNovaForm?: any;
    _avtNpcHostLoop?: any;
    _avtNpcOnRemoteUpdate?: any;
    _avtNpcSyncUnloadBound?: any;
    _avtPararHpHeartbeat?: any;
    _avtPararRegenHpPorSegundo?: any;
    _avtRenderTopbar?: any;
    _avtRxMove?: any;
    _avtToggleLogMobile?: any;
    _avtTokenSeq?: any;
    _avtWalkStudio?: any;
    _barraContextoAvancar?: any;
    _confirmarGeracaoCena?: any;
    _debugEstadoBatalha?: any;
    _dpadPress?: any;
    _dpadRelease?: any;
    _editandoObjeto?: any;
    _esqPreviewRender?: any;
    _getCharTamanhoEfetivo?: any;
    _getTipoPersonagem?: any;
    _hcaptchaApiPronta?: any;
    _invPosContext?: any;
    _loadingEscTimer?: any;
    _loadingFadeTimer?: any;
    _loadingHideTimer?: any;
    _loadingMaxTimer?: any;
    _mesaAtaqueInlineSelecionarAlvo?: any;
    _mesaAtaqueInlineSelecionarHab?: any;
    _mesaAtaqueInlineSelecionarHabOrig?: any;
    _mesaAtaqueInlineVoltar?: any;
    _mesaAtaquePet?: any;
    _mesaWinResizeSetup?: any;
    _mostrarPropostaRecebidaOrig?: any;
    _normalizarTipoPersonagem?: any;
    _pacoteResultado?: any;
    _patchTokenLoot?: any;
    _pixiPatchPendente?: any;
    _renderTokenStyle?: any;
    _skAtaqueBasicoMode?: any;
    _tokFacingDir?: any;
    _tokLastPos?: any;
    _ultimoCritico?: any;
    _verificarAlcanceSkill?: any;
    _verificarAtributosEspeciais?: any;
    _verificarMercadoToken?: any;
    _wsOnMsg?: any;
    abrirModalGeracaoCena?: any;
    abrirTab?: any;
    aplicarDanoCriativo?: any;
    aprovarCriativo?: any;
    assertXpConsistente?: any;
    atkAplicarEfeitoPassiva?: any;
    avtReceberAuthoritativeApply?: any;
    avtReceberCharUpdate?: any;
    avtReceberFaseMudou?: any;
    avtReceberInvUpdate?: any;
    avtReceberItemDesequipado?: any;
    avtReceberItemEquipado?: any;
    avtReceberMoveInput?: any;
    avtReceberOocCooldown?: any;
    avtReceberPlayerAction?: any;
    avtReceberPlayerDamage?: any;
    avtReceberPlayerHp?: any;
    avtReceberPortaProxima?: any;
    avtReceberRastroMarcar?: any;
    avtReceberStateTick?: any;
    batalhaReceberConfirmacaoReacao?: any;
    batalhaReceberDefesaResolvida?: any;
    batalhaReceberReacaoExecutada?: any;
    batalhaReceberSolicitacaoDefesa?: any;
    batalhaReceberSolicitacaoReacao?: any;
    bauDepositarItem?: any;
    bauRetirarItem?: any;
    confirmarCompraMercado?: any;
    confirmarSaque?: any;
    copiarPromptPacoteSessao?: any;
    criarSetModoTurno?: any;
    enviarProposta?: any;
    fecharModalMercado?: any;
    fichaRefresh?: any;
    filtrarMercado?: any;
    getTodasHabilidades?: any;
    gridTacticalHide?: any;
    gridTacticalMeasure?: any;
    gridTacticalSetPaintBrush?: any;
    gridTacticalShowAttackRange?: any;
    gridTacticalSnapToken?: any;
    gridTacticalToggleFlag?: any;
    inventarioReceberAtualização?: any;
    itemCatalogReceberAtualização?: any;
    lootReceberAtualização?: any;
    lootReclamar?: any;
    mercadoReceberAtualização?: any;
    mercadoVenderItem?: any;
    mobileCtrlSetModo?: any;
    mobileUsarSkillPropria?: any;
    moedasReceberAtualização?: any;
    nmCE?: any;
    notifDismiss?: any;
    notifExpandir?: any;
    processarPacoteSessao?: any;
    rejeitarCriativo?: any;
    responderTrade?: any;
    scrollToPendingApprovals?: any;
    selecionarAlvoLista?: any;
    skAnimComboGerarPrompt?: any;
    skAnimGSAPPreviewPlay?: any;
    skAnimPixiCopiarPrompt?: any;
    skAnimPixiGerarPrompt?: any;
    skAnimPixiOnJsonChange?: any;
    skAnimPixiPreviewPlay?: any;
    skAnimSpineCopiarPrompt?: any;
    skAnimSpineGerarPrompt?: any;
    skAnimSpineOnJsonChange?: any;
    skAnimSpinePreviewPlay?: any;
    temaPadraoToggle?: any;
    toggleLootSel?: any;
    toggleTradeSel?: any;
    tradeAceitarBadge?: any;
    tradeBadgeExpandir?: any;
    tradeRecusarBadge?: any;
    tradesReceberAtualização?: any;
    wsHandler?: any;
  }
  // [migração-ts:window-globals:fim]

  // Shim de migração: o app acessa .value/.checked/.disabled etc. em elementos
  // sem narrowing; remover exige ~284 narrowings (Entrega 5).
  interface HTMLElement {
    [key: string]: any;
  }
  interface Element {
    [key: string]: any;
  }

  // Bibliotecas de terceiros expostas pelo core/vendor.ts e core/pixi-lazy.ts
  var gsap: any;
  var Howl: any;
  var Howler: any;
  var PIXI: any;
  var hcaptcha: any;

  // Globals expostos dinamicamente pelo core (window.RTNet etc.)
  var RTNet: any;
  var _mapeamentoCache: any;

  // Globals definidos nos <script> inline do index.html
  var esconderSplash: any;

  // Globals atribuídos só via window.* (nunca declarados no escopo do módulo)
  var AudioManager: any;

  // Globals de runtime puro: nomes sem declaração top-level em nenhum módulo —
  // são atribuídos via window.*, criados por patches dinâmicos ou referenciados
  // apenas sob guarda de typeof. Refletem o comportamento real do app; candidatos
  // a limpeza/tipagem nas Entregas 3-4.
  // Acessados via globalThis.* (telemetria/patches internos)
  var __rtModeChangeHandler: any;
  var __rtSendBroadcast: any;
  var __rtWsStats: any;
  var _avtNpcApplyDamage: any;
  var _avtNpcHostLoop: any;
  var _avtNpcOnRemoteUpdate: any;

  // [migração-ts:auto-globals:início]
  var AVT_WALK_PRESETS: any;
  var EFFECT_REGISTRY: any;
  var FASE_TILE_SZ: any;
  var INVENTARIO_CACHE: any;
  var ITEMS_CATALOG: any;
  var LOOT_CACHE: any;
  var MERCADO_CACHE: any;
  var MOEDAS_CACHE: any;
  var TOKEN_CTRL: any;
  var TRADES_CACHE: any;
  var _aoeObterAlvosAtingidos: any;
  var _aplicarAnimacaoSkill: any;
  var _avtAplicarPlayerDamageLocal: any;
  var _avtCameraSnapToPlayer: any;
  var _avtCtrlRolarDados: any;
  var _avtCtrlSelecionarAlvo: any;
  var _avtCtrlSelecionarSkill: any;
  var _avtIniciarRegenManaPorSegundo: any;
  var _avtIrParaFase: any;
  var _avtNpcSyncInit: any;
  var _avtNpcSyncReportDelta: any;
  var _avtNpcSyncShutdown: any;
  var _avtNpcSyncTickLerp: any;
  var _avtPararRegenManaPorSegundo: any;
  var _avtRTBroadcastPlayerDamage: any;
  var _avtSouHostDe: any;
  var _calcHpNpc: any;
  var _dataUrlToBlob: any;
  var _isHost: any;
  var _isMestre: any;
  var _isRTNet: any;
  var _mesaAtaqueInlineConfirmar: any;
  var _mesaAtaqueInlineRolar: any;
  var _origMostrarPropostaRecebidaOrig: any;
  var _personagemPodeAtacar: any;
  var abrirModalDanoCriativo: any;
  var abrirModalLoot: any;
  var abrirModalLootNPC: any;
  var abrirModalLootToken: any;
  var aceitarTrade: any;
  var adicionarItemInventario: any;
  var aplicarBuffCampanha: any;
  var aplicarDanoBatalha: any;
  var assertHpConsistente: any;
  var atualizarDisplayMoedas: any;
  var atualizarInventarioUI: any;
  var atualizarMapaLoot: any;
  var atualizarTradesUI: any;
  var avtWalkRender: any;
  var battleStateBroadcast: any;
  var cenaRenderizarObjetos: any;
  var chatEnviarNarrador: any;
  var comprarItemMercado: any;
  var emitirEvento: any;
  var executarAnimacaoAtaque: any;
  var executarAnimacaoDados: any;
  var executarEfeitoCriativo: any;
  var fecharModalDanoCriativo: any;
  var fecharModalLoot: any;
  var fecharModalTrade: any;
  var gridTacticalShowMoveRange: any;
  var inicializarSistemaAprovacoes: any;
  var iniciarBatalha: any;
  var itemAtualizarPreview: any;
  var mapa: any;
  var mapaCarregar: any;
  var mostrarTelaVitoria: any;
  var mostrarTriggerVisual: any;
  var navegarParaMapa: any;
  var notifExecutar: any;
  var ocultarTriggerVisual: any;
  var recalcularHpMax: any;
  var recusarTrade: any;
  var renderBaus: any;
  var renderCatalogo: any;
  var renderEquipamentos: any;
  var renderInventario: any;
  var renderItemCatalog: any;
  var renderMercado: any;
  var renderMoedas: any;
  var renderPersonagens: any;
  var renderTrades: any;
  var setCooldownBatalha: any;
  var skAnimPixiPosicaoChange: any;
  // [migração-ts:auto-globals:fim]
}
