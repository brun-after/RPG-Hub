// Stubs da camada de render chamada como bare globals por
// _carregarProgressivo. Instala vi.fn() para cada nome e devolve o mapa para
// asserções de chamada.
import { vi } from 'vitest';

export const NOMES_RENDER = [
  '_aplicarEstadoBatalhaUI', '_atualizarBadgeMesa',
  'renderMapasTab', '_mapaInicializarLayout',
  'renderCharButtons', 'renderAttrButtons', 'renderHeader',
  'renderCharView', 'renderAttrView',
  'mapaRenderTokens', 'mapaRenderStatus',
  'renderLore', 'renderConfig', 'criativoRenderMestre',
  'renderMapaViewer',
] as const;

export function stubRenderLayer() {
  const g = globalThis as any;
  const stubs: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const nome of NOMES_RENDER) {
    stubs[nome] = vi.fn();
    g[nome] = stubs[nome];
  }
  return stubs;
}
