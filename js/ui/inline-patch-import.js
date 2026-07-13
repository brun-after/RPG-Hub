// ── Patch: garantir render_data com arrays ao importar/criar mapa ─────────
(function patchImportRenderData() {
  let tentativas = 0;
  const maxTentativas = 50; // 5 segundos
  
  const aplicarPatch = function() {
    const _origIniciarApp = window.iniciarApp;
    
    if (typeof _origIniciarApp === 'function') {
      window.iniciarApp = async function(rpgId) {
        try {
          const result = await _origIniciarApp(rpgId);
          // Normalizar render_data de todos os mapas após carregamento
          if (window.RPG_DATA && Array.isArray(window.RPG_DATA.mapas)) {
            window.RPG_DATA.mapas.forEach(entry => {
              if (!entry || !entry.mapa) return;
              const rd = entry.mapa.render_data;
              if (!rd || typeof rd !== 'object') {
                entry.mapa.render_data = { paredes:[], portas:[], objetos:[] };
                return;
              }
              if (!Array.isArray(rd.paredes)) rd.paredes = [];
              if (!Array.isArray(rd.portas))  rd.portas  = [];
              if (!Array.isArray(rd.objetos)) rd.objetos = [];
            });
          }
          return result;
        } catch (err) {
          console.error('Erro no patch de iniciarApp:', err);
          throw err;
        }
      };
    } else {
      tentativas++;
      if (tentativas < maxTentativas) {
        setTimeout(aplicarPatch, 100);
      }
    }
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicarPatch);
  } else {
    setTimeout(aplicarPatch, 0);
  }
})();
