// Loja do Modo Aventura: objeto 'loja' no mapa, compra/venda com o ouro de
// custom_attrs.ouro. Roda no harness determinístico; o banco é mockado — o
// POST de inventario responde representation para o fluxo feliz e 500 para o
// cenário de estorno.
import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../js/systems/avt-inventario.js'; // AVT_INV/loja não entram no boot padrão do harness
import { bootAventuraSim } from './harness';
import { stubFetchRotas } from '../helpers/mock-fetch';
import { rotasAventura } from './fixtures-aventura';

const g = globalThis as any;

afterEach(() => {
  vi.useRealTimers();
});

const ROW_COMPRADO = {
  id: 'inv-comprado', rpg_id: 'rpg-sim', character_id: 'char-alice',
  item_catalog_id: 'it-pocao', quantidade: 1, equipado: false,
  slot_equipado: null, bonus_snapshot: null,
};

// Boot + loja injetada adjacente ao spawn de Alice (3,3). `postStatus` controla
// a resposta do POST /inventario (200 = compra entrega o item; 500 = estorno).
async function bootComLoja(estoque: any, opts: { postStatus?: number; ouro?: number } = {}) {
  const sim = await bootAventuraSim({ charNome: 'Alice' });
  stubFetchRotas([
    { match: /\/rest\/v1\/inventario$/, resposta: opts.postStatus === 500 ? 'err' : [ROW_COMPRADO], status: opts.postStatus ?? 200 },
    ...rotasAventura(),
  ]);
  const loja = { id: 'loja1', tipo: 'loja', nome: 'Empório Sim', icone: '🛒', x: 4 / 24, y: 3 / 16, estoque };
  sim.state.dungeon.render_data.objetos.push(loja);
  const char = sim.state.chars.find((c: any) => c.nome === 'Alice');
  char.custom_attrs.ouro = opts.ouro ?? 100;
  if (!g.AVT_INV.rpgId) await g.avtInvInit('rpg-sim');
  (g.AVT_INV.inventarios as any)['char-alice'] = (g.AVT_INV.inventarios as any)['char-alice'] || [];
  return { sim, loja, char };
}

describe('loja: proximidade e preços', () => {
  it('loja na célula ou adjacente (Chebyshev ≤ 1)', async () => {
    const { } = await bootComLoja([{ item_id: 'it-pocao', qtd: 1 }]);
    expect(g._avtLojaNaPosicao(3, 3)?.id).toBe('loja1');  // adjacente
    expect(g._avtLojaNaPosicao(4, 3)?.id).toBe('loja1');  // em cima
    expect(g._avtLojaNaPosicao(6, 3)).toBeNull();         // longe
  });

  it('catálogo da aventura carrega valor_base', async () => {
    const { sim } = await bootComLoja([]);
    const espada = sim.state.itemCatalog.find((i: any) => i.id === 'it-espada');
    expect(espada.valor_base).toBe(100);
    const noInv = g.AVT_INV.catalogo.find((i: any) => i.id === 'it-pocao');
    expect(noInv.valor_base).toBe(30);
  });
});

describe('loja: compra', () => {
  it('compra feliz: debita ouro, entrega item e decrementa estoque', async () => {
    const { sim, loja, char } = await bootComLoja([{ item_id: 'it-pocao', qtd: 1 }]);
    await g.avtLojaComprar('loja1', 'it-pocao'); // Poção, valor_base 30
    expect(char.custom_attrs.ouro).toBe(70);
    expect(loja.estoque[0].qtd).toBe(0);
    expect((g.AVT_INV.inventarios as any)['char-alice']
      .some((i: any) => i.id === 'inv-comprado')).toBe(true);
    void sim;
  });

  it('sem ouro suficiente: recusa sem tocar em nada', async () => {
    const { loja, char } = await bootComLoja([{ item_id: 'it-pocao', qtd: 1 }], { ouro: 10 });
    await g.avtLojaComprar('loja1', 'it-pocao');
    expect(char.custom_attrs.ouro).toBe(10);
    expect(loja.estoque[0].qtd).toBe(1);
    expect((g.AVT_INV.inventarios as any)['char-alice']).toHaveLength(0);
  });

  it('estoque esgotado: recusa', async () => {
    const { loja, char } = await bootComLoja([{ item_id: 'it-pocao', qtd: 0 }]);
    await g.avtLojaComprar('loja1', 'it-pocao');
    expect(char.custom_attrs.ouro).toBe(100);
    expect(loja.estoque[0].qtd).toBe(0);
  });

  it('item sem valor_base: recusa (sem preço definido)', async () => {
    const { char } = await bootComLoja([{ item_id: 'it-relicario', qtd: 3 }]);
    await g.avtLojaComprar('loja1', 'it-relicario');
    expect(char.custom_attrs.ouro).toBe(100);
    expect((g.AVT_INV.inventarios as any)['char-alice']).toHaveLength(0);
  });

  it('POST do inventário falha: ouro é estornado', async () => {
    const { loja, char } = await bootComLoja([{ item_id: 'it-pocao', qtd: 1 }], { postStatus: 500 });
    await g.avtLojaComprar('loja1', 'it-pocao');
    expect(char.custom_attrs.ouro).toBe(100); // 100 → 70 → estorno → 100
    expect(loja.estoque[0].qtd).toBe(1);      // estoque não decrementa
    expect((g.AVT_INV.inventarios as any)['char-alice']).toHaveLength(0);
  });

  it('estoque infinito (qtd null): compra não decrementa', async () => {
    const { loja, char } = await bootComLoja([{ item_id: 'it-pocao', qtd: null }]);
    await g.avtLojaComprar('loja1', 'it-pocao');
    expect(char.custom_attrs.ouro).toBe(70);
    expect(loja.estoque[0].qtd).toBeNull();
  });
});

describe('loja: venda', () => {
  it('vende a 50% do valor_base e remove o item do inventário', async () => {
    const { char } = await bootComLoja([]);
    vi.stubGlobal('confirm', vi.fn(() => true));
    (g.AVT_INV.inventarios as any)['char-alice'].push({
      id: 'inv-vender', character_id: 'char-alice', item_catalog_id: 'it-espada',
      quantidade: 1, equipado: false,
    });
    await g.avtLojaVender('loja1', 'inv-vender'); // Espada valor_base 100 → 50
    expect(char.custom_attrs.ouro).toBe(150);
    expect((g.AVT_INV.inventarios as any)['char-alice']
      .some((i: any) => i.id === 'inv-vender')).toBe(false);
  });

  it('quantidade > 1: vende UMA unidade e mantém a linha', async () => {
    const { char } = await bootComLoja([]);
    vi.stubGlobal('confirm', vi.fn(() => true));
    const row = { id: 'inv-pilha', character_id: 'char-alice', item_catalog_id: 'it-pocao', quantidade: 3, equipado: false };
    (g.AVT_INV.inventarios as any)['char-alice'].push(row);
    await g.avtLojaVender('loja1', 'inv-pilha'); // Poção 30 → venda 15
    expect(char.custom_attrs.ouro).toBe(115);
    expect(row.quantidade).toBe(2);
  });

  it('item sem cotação (valor_base null) não é vendável; equipado também não', async () => {
    const { char } = await bootComLoja([]);
    vi.stubGlobal('confirm', vi.fn(() => true));
    (g.AVT_INV.inventarios as any)['char-alice'].push(
      { id: 'inv-relic', character_id: 'char-alice', item_catalog_id: 'it-relicario', quantidade: 1, equipado: false },
      { id: 'inv-equip', character_id: 'char-alice', item_catalog_id: 'it-espada', quantidade: 1, equipado: true, slot_equipado: 'arma_principal' },
    );
    await g.avtLojaVender('loja1', 'inv-relic');
    await g.avtLojaVender('loja1', 'inv-equip');
    expect(char.custom_attrs.ouro).toBe(100);
    expect((g.AVT_INV.inventarios as any)['char-alice']).toHaveLength(2);
  });

  it('percentual de revenda configurável (30%)', async () => {
    const { sim, char } = await bootComLoja([]);
    sim.state.rpg.theme_json.level_config = { loja_revenda_pct: 30 };
    vi.stubGlobal('confirm', vi.fn(() => true));
    (g.AVT_INV.inventarios as any)['char-alice'].push({
      id: 'inv-esp2', character_id: 'char-alice', item_catalog_id: 'it-espada', quantidade: 1, equipado: false,
    });
    await g.avtLojaVender('loja1', 'inv-esp2'); // floor(100 × 30%) = 30
    expect(char.custom_attrs.ouro).toBe(130);
  });
});

describe('loja: sincronização', () => {
  it('avtReceberLojaUpdate substitui o estoque e ignora fase alheia', async () => {
    const { loja } = await bootComLoja([{ item_id: 'it-pocao', qtd: 5 }]);
    g.avtReceberLojaUpdate({ lojaId: 'loja1', estoque: [{ item_id: 'it-pocao', qtd: 2 }] });
    expect(loja.estoque[0].qtd).toBe(2);
    g.avtReceberLojaUpdate({ lojaId: 'loja1', faseId: 'outra-fase', estoque: [{ item_id: 'it-pocao', qtd: 99 }] });
    expect(loja.estoque[0].qtd).toBe(2);
  });
});
