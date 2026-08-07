// Controles isométricos do Modo Aventura: _avtRemapDirTelaParaGrade (aventura.js)
// converte a direção COMO APARECE NA TELA para o eixo da grade. O invariante que
// estava quebrado (joystick/D-pad andando "de lado" em iso): a direção de grade
// produzida, projetada de volta pela transformação do mapa (_avtIsoDeltaToScreen,
// avt-menu.js), deve cair no MESMO setor de tela que o jogador apertou.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../../js/systems/avt-menu.js';
import '../../../js/systems/aventura.js';

const g = globalThis as any;

// 8 setores horários a partir de E (0°), como no joystick (avt-menu.js).
const SETORES_TELA: Array<[number, number]> = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

function setorDoAngulo(x: number, y: number): number {
  const ang = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return Math.round(ang / 45) % 8;
}

describe('_avtRemapDirTelaParaGrade', () => {
  it('é identidade com isométrico desligado', () => {
    g.AVT_GRAFICOS.isoAtivo = false;
    for (const [dx, dy] of SETORES_TELA) {
      expect(g._avtRemapDirTelaParaGrade(dx, dy)).toEqual([dx, dy]);
    }
  });

  describe.each([false, true])('iso ativo (profundidade=%s)', (prof) => {
    beforeEach(() => {
      g.AVT_GRAFICOS.isoAtivo = true;
      g.AVT_GRAFICOS.profundidade = prof;
      g._avtIsoParamsAtualizar();
    });

    it('cada setor de tela volta ao próprio setor após projeção (ida e volta)', () => {
      SETORES_TELA.forEach(([dx, dy], setor) => {
        const [gx, gy] = g._avtRemapDirTelaParaGrade(dx, dy);
        const s = g._avtIsoDeltaToScreen(gx, gy);
        expect(setorDoAngulo(s.x, s.y), `setor ${setor} (${dx},${dy})`).toBe(setor);
      });
    });

    it('os 8 setores produzem 8 direções de grade distintas', () => {
      const vistos = new Set(
        SETORES_TELA.map(([dx, dy]) => g._avtRemapDirTelaParaGrade(dx, dy).join(','))
      );
      expect(vistos.size).toBe(8);
    });

    it('cardeais de tela viram diagonais de grade (cima na tela = NO da grade)', () => {
      expect(g._avtRemapDirTelaParaGrade(0, -1)).toEqual([-1, -1]);
      expect(g._avtRemapDirTelaParaGrade(0, 1)).toEqual([1, 1]);
      expect(g._avtRemapDirTelaParaGrade(1, 0)).toEqual([1, -1]);
      expect(g._avtRemapDirTelaParaGrade(-1, 0)).toEqual([-1, 1]);
    });
  });
});
