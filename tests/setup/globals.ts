// Setup compartilhado de todos os testes unitários.
//
// Os módulos de js/ não exportam nada: publicam suas funções em globalThis via
// os rodapés "[migração-esm] accessors globais", e dependem uns dos outros por
// identificadores globais na ordem de import do js/main.ts. Este arquivo
// reproduz o prefixo "core" dessa ordem (sem vendor/pixi-lazy/realtime/rtnet,
// que puxam gsap/howler/WebSocket) para que qualquer módulo importado por um
// teste encontre seus pré-requisitos já definidos.
import '../../js/config';
import '../../js/state';
import '../../js/core/utils';
import '../../js/core/supabase';
import '../../js/core/optimistic-save';
import '../../js/core/events';

const g = globalThis as any;

// Identificadores que os módulos referenciam como bare globals sem nunca
// declarar (definidos por módulos que os testes não importam, ou só em
// runtime). Sem uma property em globalThis, até `FOO?.bar` lança
// ReferenceError — optional chaining não protege identificador não declarado.
for (const name of [
  'PERMISSOES_CONFIG', 'AR', 'AVT_STATE', 'COMBATE',
  'getPosicaoNoMapa', 'authRefreshSession', 'authSair',
  '_avtCarregarBatalhasAtivas', '_avtReconciliarEntidades',
  'combateBroadcast', 'realtimeBroadcast', 'salvarEstadoBatalha',
  'petGetHabilidadesPet',
  // definidas em background.js, referenciadas por catalog.js no import
  'nmceCoords', '_nmceSnapCelula', '_nmceRenderWalls', '_nmceAtualizarLista',
]) {
  if (!(name in g)) g[name] = undefined;
}

g.ATTR_MAPPING_CACHE = {};
g.mostrarToast = () => {};
g.arLog = () => {};
