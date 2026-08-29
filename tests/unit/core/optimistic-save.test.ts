// Camada de salvamento otimista (js/core/optimistic-save.ts): coalescing por
// chave, notificação + ressincronização em falha, estado de eco para o
// realtime e variante debounced.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const g = globalThis as any;

// Deixa microtasks encadeadas (finally → próximo persist) drenarem.
const drenar = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
  g.mostrarToast = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  g.mostrarToast = () => {};
});

describe('salvarOtimista', () => {
  it('não bloqueia o caller: o código após a chamada roda antes do persist resolver', async () => {
    let resolvido = false;
    let resolver!: () => void;
    g.salvarOtimista({
      chave: 'characters:t1',
      persistir: () => new Promise<void>(r => { resolver = () => { resolvido = true; r(); }; }),
    });
    // síncrono, logo após a chamada — persist ainda em voo
    expect(resolvido).toBe(false);
    resolver();
    await drenar();
    expect(resolvido).toBe(true);
  });

  it('coalesce por chave: 3 chamadas rápidas → 2 execuções, a última vence', async () => {
    const execucoes: string[] = [];
    let resolver!: () => void;
    const opts = (tag: string) => ({
      chave: 'characters:t2',
      persistir: () => {
        execucoes.push(tag);
        if (tag === 'a') return new Promise<void>(r => { resolver = r; });
        return Promise.resolve();
      },
    });
    g.salvarOtimista(opts('a'));   // entra em voo
    g.salvarOtimista(opts('b'));   // vira "próximo"
    g.salvarOtimista(opts('c'));   // substitui b (last-write-wins)
    resolver();
    await drenar();
    expect(execucoes).toEqual(['a', 'c']);
  });

  it('chaves diferentes persistem em paralelo, sem coalescing entre si', async () => {
    const execucoes: string[] = [];
    g.salvarOtimista({ chave: 'characters:x', persistir: async () => { execucoes.push('x'); } });
    g.salvarOtimista({ chave: 'characters:y', persistir: async () => { execucoes.push('y'); } });
    await drenar();
    expect(execucoes.sort()).toEqual(['x', 'y']);
  });

  it('falha → toast de erro + aoFalhar aguardado + fila limpa', async () => {
    const ordem: string[] = [];
    g.salvarOtimista({
      chave: 'lore:t3',
      persistir: () => Promise.reject(new Error('boom')),
      aoFalhar: async () => { ordem.push('refetch'); },
      msgErro: 'Falhou lore',
    });
    await drenar();
    expect(g.mostrarToast).toHaveBeenCalledWith('Falhou lore', 'erro', 6000);
    expect(ordem).toEqual(['refetch']);
    // fila limpa: um novo save para a mesma chave executa imediatamente
    let rodou = false;
    g.salvarOtimista({ chave: 'lore:t3', persistir: async () => { rodou = true; } });
    await drenar();
    expect(rodou).toBe(true);
  });

  it('falha no próprio aoFalhar não propaga nem trava a fila', async () => {
    g.salvarOtimista({
      chave: 'skills:t4',
      persistir: () => Promise.reject(new Error('boom')),
      aoFalhar: () => Promise.reject(new Error('refetch falhou')),
    });
    await drenar();
    let rodou = false;
    g.salvarOtimista({ chave: 'skills:t4', persistir: async () => { rodou = true; } });
    await drenar();
    expect(rodou).toBe(true);
  });
});

describe('osEco', () => {
  it("ciclo de vida: 'pendente' em voo → 'recente' por 1,5s → null", async () => {
    let resolver!: () => void;
    g.salvarOtimista({
      chave: 'characters:eco',
      persistir: () => new Promise<void>(r => { resolver = r; }),
    });
    expect(g.osEco('characters:eco')).toBe('pendente');
    resolver();
    await drenar();
    expect(g.osEco('characters:eco')).toBe('recente');
    // além do grace de 1,5s
    const agora = Date.now;
    Date.now = () => agora() + 2000;
    try { expect(g.osEco('characters:eco')).toBe(null); }
    finally { Date.now = agora; }
  });

  it('chave desconhecida → null', () => {
    expect(g.osEco('characters:nunca-salvo')).toBe(null);
  });
});

describe('salvarOtimistaDebounced', () => {
  it('duas chamadas dentro da janela → um único persist com o opts mais recente', async () => {
    vi.useFakeTimers();
    const execucoes: string[] = [];
    g.salvarOtimistaDebounced({ chave: 'rpg_registry:arena:d1', ms: 200, persistir: async () => { execucoes.push('v1'); } });
    g.salvarOtimistaDebounced({ chave: 'rpg_registry:arena:d1', ms: 200, persistir: async () => { execucoes.push('v2'); } });
    expect(g.osEco('rpg_registry:arena:d1')).toBe('pendente');   // debounced conta como pendente
    await vi.advanceTimersByTimeAsync(250);
    expect(execucoes).toEqual(['v2']);
  });

  it('osFlushTudo dispara o debounced pendente imediatamente', async () => {
    vi.useFakeTimers();
    let rodou = false;
    g.salvarOtimistaDebounced({ chave: 'rpg_registry:arena:d2', ms: 5000, persistir: async () => { rodou = true; } });
    const p = g.osFlushTudo();
    await vi.advanceTimersByTimeAsync(0);
    await p;
    expect(rodou).toBe(true);
  });
});
