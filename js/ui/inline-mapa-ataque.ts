function mapaAtaqueMinimizar() {
  const panel = document.getElementById('atk-mapa-float-panel');
  const btn = document.getElementById('atk-minimizar-btn');
  const miniLabel = document.getElementById('atk-mapa-hab-mini');
  
  if (panel.classList.contains('minimizado')) {
    // Maximizar
    panel.classList.remove('minimizado');
    btn.innerHTML = '▼';
    btn.title = 'Minimizar painel';
  } else {
    // Minimizar
    panel.classList.add('minimizado');
    btn.innerHTML = '▲';
    btn.title = 'Expandir painel';
    
    // Mostrar resumo da habilidade selecionada
    const fase2Visivel = document.getElementById('atk-mapa-fase2').style.display !== 'none';
    if (fase2Visivel) {
      const resumo = document.getElementById('atk-mapa-hab-resumo');
      if (resumo && resumo.textContent) {
        const nomeHab = resumo.textContent.split('•')[0].trim();
        miniLabel.textContent = `(${nomeHab})`;
      }
    }
  }
}

/* [migração-esm] accessors globais */
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mapaAtaqueMinimizar", { configurable: true, get: () => mapaAtaqueMinimizar, set: (__v) => { mapaAtaqueMinimizar = __v; } });
