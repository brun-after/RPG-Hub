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

  // Bibliotecas de terceiros expostas pelo core/vendor.ts e core/pixi-lazy.ts
  var gsap: any;
  var Howl: any;
  var Howler: any;
  var PIXI: any;
  var hcaptcha: any;

  // Globals de módulos ainda não convertidos, referenciados por arquivos .ts
  var RTNet: any;
  var _mapeamentoCache: any;
}
