// types.d.ts
// RPG Hub — Declarações de globals compartilhados entre módulos.
// Os módulos se comunicam via window (rodapés "[migração-esm] accessors globais");
// aqui declaramos o que não existe como declaração top-level em nenhum módulo:
// libs de CDN, globals dos <script> inline do index.html e globals de runtime
// puro (atribuídos via window.* ou referenciados sob guarda de typeof).
// Tipos serão refinados nas próximas entregas (Entregas 3-4).

export {};

declare global {
  // Propriedades dinâmicas no window (padrão do app: estado e API globais)
  interface Window {
    [key: string]: any;
  }

  // obtidos por getElementById sem narrowing. Será removido quando os módulos
  // ganharem tipos reais (Entregas 3-4).
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
