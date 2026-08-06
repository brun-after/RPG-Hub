// ── Handler Global de Erros para Diagnóstico ──────────────────────
window.addEventListener('error', function(e) {
  console.error('❌ ERRO GLOBAL:', e.message, 'em', e.filename, 'linha', e.lineno);
  
  // Mostrar erro visualmente se splash ainda estiver ativo
  const splash = document.getElementById('tela-splash');
  if (splash && splash.style.display !== 'none') {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:absolute;bottom:20px;left:20px;right:20px;background:rgba(231,76,60,0.95);color:#fff;padding:14px 16px;border-radius:8px;font-size:0.75rem;text-align:left;font-family:monospace;border:1px solid rgba(255,255,255,0.2);box-shadow:0 4px 12px rgba(0,0,0,0.4);z-index:99999';
    errorDiv.innerHTML = '<div style="font-weight:bold;margin-bottom:6px">⚠️ ERRO DETECTADO</div><div style="margin-bottom:4px">' + e.message + '</div><div style="font-size:0.68rem;opacity:0.8">' + (e.filename ? e.filename.split('/').pop() : 'desconhecido') + ':' + (e.lineno || '?') + '</div><div style="margin-top:8px;font-size:0.7rem;opacity:0.9">Abra o Console (F12) para mais detalhes</div>';
    splash.appendChild(errorDiv);
  }
});
