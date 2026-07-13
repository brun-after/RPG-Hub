(function() {
  var BTN_KEY = 'rpghub_tema_padrao';

  var VARS_CLARO = {
    '--preto':'#f2f4f7','--escuro':'#e8eaef','--painel':'#dde0e8',
    '--borda':'#c0c5d0','--cinza':'#d0d4dd','--texto':'#141820',
    '--suave':'#4e5568','--primario':'#1a5fa8','--primario-v':'#1255a0',
    '--destaque':'#6a4e00','--destaque-v':'#7a5c00',
    '--perigo':'#a81818','--sucesso':'#1a7a40','--especial':'#5a1a9e',
    '--sombra':'0 2px 8px rgba(0,0,0,0.12)','--fundo':'#f2f4f7'
  };

  function _estaAtivo() {
    return document.body.classList.contains('tema-padrao');
  }

  function _aplicarVars() {
    var root = document.documentElement;
    Object.keys(VARS_CLARO).forEach(function(k) {
      root.style.setProperty(k, VARS_CLARO[k]);
    });
    document.body.style.background = '#f2f4f7';
    document.body.style.color = '#141820';
  }

  function _removerVars() {
    var root = document.documentElement;
    Object.keys(VARS_CLARO).forEach(function(k) {
      root.style.removeProperty(k);
    });
    document.body.style.background = '';
    document.body.style.color = '';
  }

  /* ── Stylesheet dinâmico para sobrescrever inline styles ────── */
  function _injetarCSS() {
    if (document.getElementById('tp-inject')) return;
    var s = document.createElement('style');
    s.id = 'tp-inject';
    s.textContent = _gerarCSS();
    document.head.appendChild(s);
  }

  function _removerCSS() {
    var s = document.getElementById('tp-inject');
    if (s) s.remove();
  }

  function _gerarCSS() {
    var P = 'body.tema-padrao';
    /* Mapeia cada cor inline escura → equivalente claro */
    var bgHex = {
      '#080c10':'#f2f4f7','#050810':'#f2f4f7','#050208':'#f2f4f7',
      '#07090f':'#f2f4f7','#0a0f18':'#e8eaef','#0a0e18':'#e8eaef',
      '#0f1520':'#e8eaef','#0d1525':'#e8eaef','#111d2e':'#dde0e8',
      '#0f1a2e':'#dde0e8','#141d2b':'#dde0e8','#13203a':'#dde0e8',
      '#1e2d42':'#c0c5d0','#1c2e46':'#c0c5d0',
      '#2a3a50':'#d0d4dd','#243650':'#d0d4dd',
      '#1a0e0e':'#e8eaef','#0f0a0a':'#e8eaef','#080606':'#e8eaef'
    };
    var bgRgba = {
      'rgba(10,15,24,':'rgba(237,228,208,',
      'rgba(10,14,22,':'rgba(237,228,208,',
      'rgba(10,15,25,':'rgba(237,228,208,',
      'rgba(10,6,2,':'rgba(237,228,208,',
      'rgba(8,4,4,':'rgba(240,232,214,',
      'rgba(5,8,16,':'rgba(224,213,192,',
      'rgba(5,2,8,':'rgba(224,213,192,',
      'rgba(20,12,12,':'rgba(237,228,208,',
      'rgba(20,29,43,':'rgba(237,228,208,',
      'rgba(30,20,10,':'rgba(245,239,226,',
      'rgba(15,21,32,':'rgba(240,232,214,',
      'rgba(8,12,16,':'rgba(245,239,226,',
      'rgba(30,45,66,':'rgba(208,196,168,'
    };
    var txtHex = {
      '#c8d8e8':'#1c1408','#7ec8f0':'#1255a0','#7a92aa':'#5c4a2a',
      '#f0cc6a':'#8a6800','#c8a84b':'#7a5c00','#5ee09a':'#1a7a40',
      '#b07ef0':'#5a1a9e','#9a8888':'#6b5a3a','#7a6060':'#6b5a3a',
      '#4fa3d1':'#1a5fa8','#4eca7e':'#1a7a40','#b8a8a8':'#6b5a3a',
      '#c8b8b8':'#6b5a3a','#a77fdb':'#5a1a9e','#a08838':'#7a5c00',
      '#3a5270':'#9a8870','#7a8898':'#6b5a3a','#9af0c0':'#1a7a40',
      '#e8d090':'#8a6800','#6a5840':'#9a8870','#e8a090':'#a04030'
    };

    var css = '';

    /* Backgrounds hex */
    Object.keys(bgHex).forEach(function(dark) {
      var light = bgHex[dark];
      css += P+' [style*="background:'+dark+'"],';
      css += P+' [style*="background: '+dark+'"]{background:'+light+' !important}\n';
    });

    /* Backgrounds rgba */
    Object.keys(bgRgba).forEach(function(dark) {
      var light = bgRgba[dark];
      css += P+' [style*="background:'+dark+'"],';
      css += P+' [style*="background: '+dark+'"]{background:'+light+'0.85) !important}\n';
    });

    /* Overlays pretos */
    ['0.5','0.6','0.7'].forEach(function(a) {
      css += P+' [style*="background:rgba(0,0,0,0.'+a+'"],';
      css += P+' [style*="background: rgba(0,0,0,0.'+a+'"]{background:rgba(208,196,168,0.'+a+') !important}\n';
    });
    ['0.8','0.82','0.85','0.88','0.9','0.92','0.95','0.97','0.98'].forEach(function(a) {
      css += P+' [style*="background:rgba(0,0,0,'+a+'"],';
      css += P+' [style*="background: rgba(0,0,0,'+a+'"]{background:rgba(255,253,248,0.92) !important}\n';
    });

    /* Gradientes radiais escuros */
    css += P+' [style*="radial-gradient(ellipse at center,#0f1a2e"],';
    css += P+' [style*="radial-gradient(ellipse at center,#1a0e0e"],';
    css += P+' [style*="radial-gradient(ellipse at center, #0f1a2e"],';
    css += P+' [style*="radial-gradient(ellipse at center, #1a0e0e"]{background:radial-gradient(ellipse at center,#f5efe2 0%,#ede4d0 100%) !important}\n';

    /* Gradientes lineares escuros */
    css += P+' [style*="linear-gradient(135deg,rgba(20,29,43,"],';
    css += P+' [style*="linear-gradient(135deg,rgba(10,15,24,"]{background:linear-gradient(135deg,rgba(237,228,208,0.98),rgba(224,213,192,0.98)) !important}\n';

    /* Cores de texto */
    Object.keys(txtHex).forEach(function(dark) {
      var light = txtHex[dark];
      css += P+' [style*="color:'+dark+'"],';
      css += P+' [style*="color: '+dark+'"]{color:'+light+' !important}\n';
    });

    /* Brancos → escuro */
    css += P+' [style*="color:#fff;"]{color:#1c1408 !important}\n';
    css += P+' [style*="color: #fff;"]{color:#1c1408 !important}\n';
    css += P+' [style*="color:#ffffff"]{color:#1c1408 !important}\n';
    css += P+' [style*="color: #ffffff"]{color:#1c1408 !important}\n';

    /* rgba texto claro → escuro */
    css += P+' [style*="color:rgba(200,168,75,"]{color:rgba(122,92,0,0.85) !important}\n';
    css += P+' [style*="color:rgba(255,255,255,"]{color:rgba(28,20,8,0.5) !important}\n';

    /* Bordas escuras */
    css += P+' [style*="border:1px solid rgba(30,45,66,"]{border-color:#d0c4a8 !important}\n';
    css += P+' [style*="border:1px solid rgba(60,30,30,"]{border-color:#d0c4a8 !important}\n';
    css += P+' [style*="border:1px solid rgba(255,255,255,"]{border-color:rgba(208,196,168,0.3) !important}\n';
    css += P+' [style*="border:1.5px solid rgba(255,255,255,"]{border-color:rgba(208,196,168,0.4) !important}\n';
    css += P+' [style*="border:1px solid rgba(10,15,24,"]{border-color:#d0c4a8 !important}\n';
    css += P+' [style*="border-bottom:1px solid rgba(255,255,255,"]{border-bottom-color:rgba(208,196,168,0.3) !important}\n';

    /* accent-color */
    css += P+' [style*="accent-color:#5ee09a"]{accent-color:#1a7a40 !important}\n';
    css += P+' [style*="accent-color:#f0cc6a"]{accent-color:#7a5c00 !important}\n';
    css += P+' [style*="accent-color:#7ec8f0"]{accent-color:#1a5fa8 !important}\n';

    /* ── Classes (fallback) ─────────────────────────────────── */
    css += P+','+P+' #hub,'+P+' #app,'+P+' #import-screen,'+P+' #tela-auth,'+P+' #loading{background:#fffdf8 !important;color:#1c1408 !important}\n';
    css += P+' header,'+P+' .hub-header,'+P+' .import-header{background:#f5efe2 !important;border-bottom-color:#d0c4a8 !important}\n';
    css += P+' .hub-logo{background:none !important;-webkit-background-clip:unset !important;background-clip:unset !important;-webkit-text-fill-color:#3a2e10 !important}\n';
    css += P+' .nav-tabs{background:#f0e8d6 !important;border-bottom-color:#d0c4a8 !important}\n';
    css += P+' .tab-btn{color:#6b5a3a !important}'+P+' .tab-btn.active{color:#1c1408 !important;border-bottom-color:#1a5fa8 !important}\n';
    css += P+' .card,'+P+' .rpg-card,'+P+' .import-section,'+P+' .skill-item,'+P+' .mech-card,'+P+' .stat-box,'+P+' .dado-btn,'+P+' .crit-box,'+P+' .resultado-area,'+P+' .dual-side,'+P+' .edit-form,'+P+' .cat-item-card,'+P+' .inv-mochila-item,'+P+' .inv-slot,'+P+' .inv-moeda-card,'+P+' .bonus-linha,'+P+' .atr-mapping-painel,'+P+' .ar-card,'+P+' .ar-proposta-card,'+P+' .ar-bulk-item{background:#f5efe2 !important;border-color:#d0c4a8 !important;color:#1c1408 !important}\n';
    css += P+' input,'+P+' select,'+P+' textarea{background:#fffdf8 !important;border-color:#c5b898 !important;color:#1c1408 !important}\n';
    css += P+' input::placeholder,'+P+' textarea::placeholder{color:#9a8870 !important}\n';
    css += P+' .btn-primario{background:#1a5fa8 !important;color:#fff !important;border-color:#1a5fa8 !important}\n';
    css += P+' .btn-secundario{background:transparent !important;border-color:#d0c4a8 !important;color:#5c4a2a !important}\n';
    css += P+' .btn-perigo{background:rgba(176,32,32,0.1) !important;color:#b02020 !important}\n';
    css += P+' .char-btn{background:#f5efe2 !important;border-color:#d0c4a8 !important;color:#5c4a2a !important}\n';
    css += P+' .char-btn.ativo{background:rgba(122,92,0,0.12) !important;border-color:#7a5c00 !important;color:#7a5c00 !important}\n';
    css += P+' .lore-filtro{background:#e0d5c0 !important;border-color:#d0c4a8 !important;color:#5c4a2a !important}\n';
    css += P+' .lore-filtro.ativo{background:rgba(122,92,0,0.15) !important;border-color:#7a5c00 !important;color:#7a5c00 !important}\n';
    css += P+' .card-titulo{color:#7a5c00 !important;border-bottom-color:#d0c4a8 !important}\n';
    css += P+' .stat-label,'+P+' .barra-nome{color:#6b5a3a !important}\n';
    css += P+' .stat-valor,'+P+' .barra-num,'+P+' .dual-pts,'+P+' .tracker-val,'+P+' .char-nome{color:#7a5c00 !important}\n';
    css += P+' .skill-nome,'+P+' .mech-title{color:#1a5fa8 !important}\n';
    css += P+' .rpg-card-desc,'+P+' .rpg-card-arrow,'+P+' .dual-vs,'+P+' .hub-section-title,'+P+' .hub-sub{color:#6b5a3a !important}\n';
    css += P+' .logo{color:#7a5c00 !important}'+P+' .user-char{color:#1a5fa8 !important}\n';
    css += P+' .barra-bg,'+P+' .xp-barra-bg{background:#e0d5c0 !important}\n';
    css += P+' .dado-btn.selecionado{border-color:#1a5fa8 !important;background:rgba(26,95,168,0.08) !important}\n';
    css += P+' .dual-btn{border-color:#d0c4a8 !important;background:#f5efe2 !important;color:#1c1408 !important}\n';
    css += P+' .mech-select{background:#f5efe2 !important;border-color:#d0c4a8 !important;color:#1c1408 !important}\n';
    css += P+' .atr-chip{background:rgba(26,95,168,0.08) !important;border-color:rgba(26,95,168,0.25) !important;color:#1a5fa8 !important}\n';
    css += P+' .hub-import-btn{background:rgba(26,95,168,0.04) !important;border-color:rgba(26,95,168,0.3) !important;color:#1a5fa8 !important}\n';
    css += P+' .hub-criar-btn{background:rgba(122,92,0,0.08) !important;border-color:rgba(122,92,0,0.3) !important;color:#7a5c00 !important}\n';
    css += P+' .prompt-copy-btn{background:rgba(26,95,168,0.06) !important;border-color:rgba(26,95,168,0.2) !important;color:#1a5fa8 !important}\n';
    css += P+' .back-btn,'+P+' .back-hub-btn{border-color:#d0c4a8 !important;color:#6b5a3a !important}\n';
    css += P+' .form-group label{color:#6b5a3a !important}\n';
    css += P+' .loading-sub{color:#6b5a3a !important}\n';
    css += P+' #loading h1{color:#3a2e10 !important;text-shadow:none !important}\n';
    css += P+' [id$="-overlay"],'+P+' [id$="-modal"],'+P+' #chat-container{background:rgba(255,253,248,0.97) !important;color:#1c1408 !important}\n';
    css += P+' #mapa-wrap{background:#e8e0cc !important}\n';
    css += P+' #arena-hub,'+P+' #arena-session{background:#fffdf8 !important}\n';
    css += P+' .badge-azul{background:rgba(26,95,168,0.12) !important;color:#1a5fa8 !important;border-color:rgba(26,95,168,0.3) !important}\n';
    css += P+' .badge-ouro{background:rgba(122,92,0,0.12) !important;color:#7a5c00 !important;border-color:rgba(122,92,0,0.3) !important}\n';
    css += P+' .badge-roxo{background:rgba(90,26,158,0.12) !important;color:#5a1a9e !important;border-color:rgba(90,26,158,0.3) !important}\n';
    css += P+' .badge-verd{background:rgba(26,122,64,0.12) !important;color:#1a7a40 !important;border-color:rgba(26,122,64,0.3) !important}\n';
    css += P+' .inv-tab.active,'+P+' .item-form-tab.active{color:#1a5fa8 !important;border-bottom-color:#1a5fa8 !important}\n';
    css += P+' .char-search-input{background:#fffdf8 !important;border-color:#c5b898 !important}\n';
    css += P+' .lore-titulo{color:#7a5c00 !important}'+P+' .lore-texto{color:#1c1408 !important}\n';
    css += P+' .hub-email{color:#9a8870 !important}\n';
    css += P+' .char-sub{color:#5c4a2a !important}\n';
    css += P+' ::-webkit-scrollbar-thumb{background:rgba(90,70,30,0.2) !important}\n';

    /* Botão do tema — NÃO alterar */
    css += '#btn-tema-padrao{color:#c8a84b !important}\n';
    css += P+' #btn-tema-padrao{border-color:#1a5fa8 !important;color:#1a5fa8 !important;background:rgba(26,95,168,0.08) !important}\n';

    return css;
  }

  function _atualizarBotao(ativo) {
    var btn = document.getElementById('btn-tema-padrao');
    if (!btn) return;
    btn.textContent = ativo ? '🌙' : '☀️';
    btn.title = ativo ? 'Tema claro ativo — clique para desligar' : 'Ativar tema claro';
    btn.style.borderColor = ativo ? '#1a5fa8' : '';
    btn.style.color       = ativo ? '#1a5fa8' : '';
    btn.style.background  = ativo ? 'rgba(26,95,168,0.08)' : '';
  }

  function _aplicar(ativo) {
    document.body.classList.toggle('tema-padrao', ativo);
    if (ativo) {
      _aplicarVars();
      _injetarCSS();
    } else {
      _removerCSS();
      _removerVars();
      if (window.CURRENT_RPG && typeof window.aplicarTema === 'function') {
        window.aplicarTema(window.CURRENT_RPG);
      }
    }
    _atualizarBotao(ativo);
    try { localStorage.setItem(BTN_KEY, ativo ? '1' : '0'); } catch(e) {}
  }

  window.temaPadraoToggle = function() {
    _aplicar(!_estaAtivo());
  };

  document.addEventListener('DOMContentLoaded', function() {
    var _patchInterval = setInterval(function() {
      if (typeof window.aplicarTema !== 'function') return;
      if (typeof window.voltarHub   !== 'function') return;
      clearInterval(_patchInterval);

      var _origAplicarTema = window.aplicarTema;
      window.aplicarTema = function() {
        _origAplicarTema.apply(this, arguments);
        if (_estaAtivo()) {
          _aplicarVars();
          _injetarCSS();
        }
      };

      var _origVoltarHub = window.voltarHub;
      window.voltarHub = function() {
        _origVoltarHub.apply(this, arguments);
        if (_estaAtivo()) {
          _aplicarVars();
          _injetarCSS();
        }
      };
    }, 100);

    var _visInterval = setInterval(function() {
      var reflash = document.getElementById('hdr-reflash-btn');
      var temaBtn = document.getElementById('btn-tema-padrao');
      if (!reflash || !temaBtn) return;
      clearInterval(_visInterval);
      var obs = new MutationObserver(function() {
        temaBtn.style.display = reflash.style.display !== 'none' ? 'inline-flex' : 'none';
      });
      obs.observe(reflash, { attributes: true, attributeFilter: ['style'] });
      temaBtn.style.display = reflash.style.display !== 'none' ? 'inline-flex' : 'none';
    }, 300);

    var saved;
    try { saved = localStorage.getItem(BTN_KEY); } catch(e) {}
    if (saved === '1') {
      var _restoreInterval = setInterval(function() {
        if (typeof window.aplicarTema !== 'function') return;
        clearInterval(_restoreInterval);
        _aplicar(true);
      }, 150);
    }
  });
})();
