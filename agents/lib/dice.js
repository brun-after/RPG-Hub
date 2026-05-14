// lib/dice.js
// Parser de fórmulas de dados — portado de js/combat/combat.js
// Funções: parsearFormulaDano(), rolarGrupos(), rolarFormula()

// Equivalente a parsearFormulaDano() do app
export function parsearFormulaDano(formula) {
  if (!formula || formula === '—') return null;
  const f = formula.toString().toLowerCase().replace(/\s/g, '');
  const grupos = [];
  const re = /([+-]?\d*d\d+|[+-]?\d+)/g;
  let m;
  while ((m = re.exec(f)) !== null) {
    const tok = m[1];
    const dado = tok.match(/^([+-]?\d*)d(\d+)$/);
    if (dado) {
      let qtdRaw = dado[1].replace(/^\+/, '') || '1';
      if (qtdRaw === '-') qtdRaw = '-1';
      const qtdSinal = parseInt(qtdRaw) || 1;
      const faces = parseInt(dado[2]);
      if (faces > 0) {
        if (qtdSinal > 0) {
          grupos.push({ tipo: 'dado', qtd: qtdSinal, faces });
        } else {
          grupos.push({ tipo: 'dado_negativo', qtd: Math.abs(qtdSinal), faces });
        }
      }
    } else {
      const val = parseInt(tok);
      if (!isNaN(val) && val !== 0) grupos.push({ tipo: 'fixo', valor: val });
    }
  }
  return grupos.length ? grupos : null;
}

// Equivalente a rolarGrupos() do app
export function rolarGrupos(grupos) {
  if (!grupos) return { total: 0, dados: [], bonus: 0 };
  const dados = [];
  let bonus = 0;
  for (const g of grupos) {
    if (g.tipo === 'dado') {
      for (let i = 0; i < g.qtd; i++) {
        dados.push({ faces: g.faces, valor: Math.floor(Math.random() * g.faces) + 1 });
      }
    } else if (g.tipo === 'dado_negativo') {
      for (let i = 0; i < g.qtd; i++) {
        bonus -= Math.floor(Math.random() * g.faces) + 1;
      }
    } else {
      bonus += g.valor;
    }
  }
  const total = Math.max(0, dados.reduce((s, d) => s + d.valor, 0) + bonus);
  return { total, dados, bonus };
}

// Rola fórmula em string — retorna { total, rolls, formula, detalhes }
export function rolar(formulaStr) {
  const grupos = parsearFormulaDano(formulaStr);
  if (!grupos) return { total: 0, rolls: [], formula: formulaStr, detalhes: '' };
  const { total, dados, bonus } = rolarGrupos(grupos);
  const rolls = dados.map(d => d.valor);
  const detalhes = rolls.length
    ? `[${rolls.join(', ')}]${bonus !== 0 ? (bonus > 0 ? '+' + bonus : bonus) : ''} = ${total}`
    : String(total);
  return { total, rolls, formula: formulaStr, detalhes };
}

// Rola d20 simples
export function d20() {
  return Math.floor(Math.random() * 20) + 1;
}

// Rola qualquer dado — rolar('d6'), rolar('2d8+3')
export function rolarSimples(faces) {
  return Math.floor(Math.random() * faces) + 1;
}
