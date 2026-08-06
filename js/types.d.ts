// types.d.ts
// RPG Hub — Declarações de globals compartilhados entre módulos durante a migração.
// Os módulos se comunicam via window (rodapés "[migração-esm] accessors globais");
// aqui declaramos o que os arquivos .ts referenciam de módulos ainda em .js.
// Tipos serão refinados conforme os módulos forem convertidos (Entregas 2-4).

export {};

declare global {
  // Propriedades dinâmicas no window (padrão do app: estado e API globais)
  interface Window {
    [key: string]: any;
  }

  // Shim de migração: o app acessa .value/.checked/.disabled etc. em elementos
  // obtidos por getElementById sem narrowing. Será removido quando os módulos
  // ganharem tipos reais (Entregas 3-4).
  interface HTMLElement {
    [key: string]: any;
  }
  interface Element {
    [key: string]: any;
  }
  interface Document {
    [key: string]: any;
  }

  // Bibliotecas de terceiros expostas pelo core/vendor.ts e core/pixi-lazy.ts
  var gsap: any;
  var Howl: any;
  var Howler: any;
  var PIXI: any;
  var hcaptcha: any;

  // Globals de módulos ainda não convertidos, referenciados por arquivos .ts
  var RTNet: any;
  var _mapeamentoCache: any;

  // Globals definidos nos <script> inline do index.html
  var esconderSplash: any;

  // Globals atribuídos só via window.* (nunca declarados no escopo do módulo)
  var AudioManager: any;

  // Globals de módulos ainda em .js, referenciados por arquivos já convertidos.
  // Bloco regenerado automaticamente durante a Entrega 2; esvazia conforme os
  // módulos donos são convertidos. (Sobras no fim = globals de runtime puro.)
  // [migração-ts:auto-globals:início]
  var FASE_TILE_SZ: any;
  var INVENTARIO_CACHE: any;
  var ITEMS_CATALOG: any;
  var LOOT_CACHE: any;
  var MERCADO_CACHE: any;
  var MOEDAS_CACHE: any;
  var TOKEN_CTRL: any;
  var TRADES_CACHE: any;
  var _aoeObterAlvosAtingidos: any;
  var _avtIrParaFase: any;
  var _avtNpcSyncShutdown: any;
  var _dataUrlToBlob: any;
  var _isMestre: any;
  var _mesaAtaqueInlineConfirmar: any;
  var _mesaAtaqueInlineRolar: any;
  var abrirModalLoot: any;
  var abrirModalLootToken: any;
  var adicionarItemInventario: any;
  var aplicarBuffCampanha: any;
  var aplicarDanoBatalha: any;
  var arLog: any;
  var atualizarDisplayMoedas: any;
  var atualizarInventarioUI: any;
  var atualizarMapaLoot: any;
  var atualizarTradesUI: any;
  var battleStateBroadcast: any;
  var cenaRenderizarObjetos: any;
  var chatEnviarNarrador: any;
  var executarAnimacaoAtaque: any;
  var executarAnimacaoDados: any;
  var gridTacticalShowMoveRange: any;
  var inicializarSistemaAprovacoes: any;
  var iniciarBatalha: any;
  var logCombate: any;
  var mapa: any;
  var mapaCarregar: any;
  var mapaRenderizar: any;
  var mostrarTelaVitoria: any;
  var mostrarTriggerVisual: any;
  var navegarParaMapa: any;
  var notifExecutar: any;
  var ocultarTriggerVisual: any;
  var recalcularHpMax: any;
  var renderBaus: any;
  var renderCatalogo: any;
  var renderEquipamentos: any;
  var renderInventario: any;
  var renderItemCatalog: any;
  var renderMercado: any;
  var renderMoedas: any;
  var renderPersonagens: any;
  var renderTrades: any;
  var selecionado: any;
  var setCooldownBatalha: any;
  var skAnimPixiPosicaoChange: any;
  // [migração-ts:auto-globals:fim]
}
