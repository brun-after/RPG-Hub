// js/systems/avt-menu.js
// Menu de início do Modo Aventura — exibido antes de entrar na fase.

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO DO MÓDULO
// ─────────────────────────────────────────────────────────────────────────────
var AVT_MENU_STATE = {
  rpgId: null,
  sessionData: null,
  _saveTimer: null,
  configAba: 'menu',
};

// ─────────────────────────────────────────────────────────────────────────────
// GRÁFICOS — preferência individual, localStorage
// ─────────────────────────────────────────────────────────────────────────────

var AVT_GRAFICOS = {
  ativo: false, nivel: 1, isoAtivo: false, isoTeclado: false, isoMobile: false, analogico: false,
  // Refinamentos da visão isométrica (ligados por padrão; individualmente desativáveis).
  bilbordes: true,    // personagens/labels "em pé" (contra-transformação afim)
  atmosfera: true,    // vinheta + luz ambiente nos jogadores
  profundidade: true, // y-sort + ângulo 2:1 (estilo Diablo)
  pernas: true,       // movimentação de pernas dos tokens (passada articulada) ao andar
  polimento: true,    // números arredondados + labels mais legíveis
  vfxProjecao: true,  // efeitos de habilidade posicionados pela projeção iso (tile/profundidade corretos)
  vfxBillboard: true, // efeitos de habilidade "em pé" (sem cisalhamento), acompanhando os personagens
  // Qualidade unificada (Fase 2): null = personalizado (toggles manuais)
  preset: null,       // 'baixo' | 'medio' | 'alto' | null
  adaptativo: true,   // degrada 1 nível de preset (com aviso) quando FPS < 45 por 5s
  cssFx: true,        // animações CSS decorativas contínuas (glow/pulso de tokens)
  luzGpu: true,       // camada de luz dinâmica WebGL (tochas/auras) — médio+
  vfxOverlayUnico: true, // overlay Pixi persistente único p/ VFX (fallback: overlays por efeito)
  perfOverlay: false, // overlay de FPS/RTT (AVT_PERF)
  // Áudio (Fase 6)
  volMusica: null,    // null = padrão do AudioManager (0.45)
  volSfx: null,       // null = padrão do AudioManager (0.75)
  sfxPassos: true,    // passos posicionais dos jogadores
};

const _AVT_GRAFICOS_KEY = 'rpghub_avt_graficos';

// ── PRESETS DE QUALIDADE ─────────────────────────────────────────────────────
// Cada preset seta em lote os toggles que custam frame time. "baixo" corta os
// custos por-frame (atmosfera, y-sort, pernas, CSS contínuo, luz GPU).
const _AVT_QUALIDADE_PRESETS = {
  baixo: { ativo: false, atmosfera: false, profundidade: false, pernas: false,
           polimento: false, cssFx: false, luzGpu: false },
  medio: { atmosfera: true, profundidade: true, pernas: true,
           polimento: true, cssFx: true, luzGpu: true },
  alto:  { ativo: true, atmosfera: true, profundidade: true, pernas: true,
           polimento: true, cssFx: true, luzGpu: true },
};

function _avtGraficosPreset(nome, opts) {
  const p = _AVT_QUALIDADE_PRESETS[nome];
  if (!p) return;
  Object.assign(AVT_GRAFICOS, p);
  AVT_GRAFICOS.preset = nome;
  _avtGraficosSalvar();
  _avtGraficosAplicarTudo();
  if (!(opts && opts.silencioso)) {
    try { if (typeof mostrarToast === 'function') mostrarToast('Qualidade gráfica: ' + nome, 'ok'); } catch(_) {}
  }
  // Atualiza a UI do menu se o painel de configurações estiver aberto
  try {
    const panel = document.getElementById('avt-menu-panel');
    if (panel && panel.style.display !== 'none' && panel.style.display !== '') {
      _avtMenuAbrirConfigMestre(AVT_MENU_STATE.configAba || 'graficos');
    }
  } catch(_) {}
}
window._avtGraficosPreset = _avtGraficosPreset;

// Reaplica todos os efeitos dependentes dos toggles (iso, atmosfera, CSS, luz GPU).
function _avtGraficosAplicarTudo() {
  try { if (typeof _avtGraficosAplicar === 'function') _avtGraficosAplicar(); } catch(_) {}
  try { _avtGraficosIsoAplicar(); } catch(_) {}
  try { _avtGraficosCssFxAplicar(); } catch(_) {}
  try { if (typeof _avtLuzGpuAplicar === 'function') _avtLuzGpuAplicar(); } catch(_) {}
}
window._avtGraficosAplicarTudo = _avtGraficosAplicarTudo;

// Gate das animações CSS contínuas (drop-shadow/box-shadow infinitos): quando
// cssFx=false, body.avt-fx-low pausa os keyframes decorativos (ver styles.css).
function _avtGraficosCssFxAplicar() {
  try { document.body.classList.toggle('avt-fx-low', AVT_GRAFICOS.cssFx === false); } catch(_) {}
}
window._avtGraficosCssFxAplicar = _avtGraficosCssFxAplicar;

// Qualidade adaptativa: chamado pelo AVT_PERF quando FPS médio < 45 por ~5s.
// Degrada um nível com aviso; nunca sobe sozinho (o jogador decide subir).
function _avtGraficosDegradar() {
  if (AVT_GRAFICOS.adaptativo === false) return false;
  const ordem = ['alto', 'medio', 'baixo'];
  const atual = AVT_GRAFICOS.preset;
  // preset null (personalizado): trata como "alto" para poder degradar
  const idx = atual ? ordem.indexOf(atual) : 0;
  if (idx < 0 || idx >= ordem.length - 1) return false;
  const novo = ordem[idx + 1];
  _avtGraficosPreset(novo, { silencioso: true });
  try {
    if (typeof mostrarToast === 'function') {
      mostrarToast('⚙ FPS baixo — qualidade gráfica reduzida para "' + novo + '". Ajuste no menu ⚙ Gráficos.', '');
    }
  } catch(_) {}
  return true;
}
window._avtGraficosDegradar = _avtGraficosDegradar;

// Ângulo/escala isométricos: valores-base (52°) e os efetivos (recalculados conforme
// o toggle "profundidade", que adota o diamante 2:1 clássico em 60°). São lidos pelas
// projeções de clique/pan e pela contra-transformação de billboards, logo qualquer
// mudança aqui se propaga automaticamente.
const _ISO_BASE_ANGLE_X = 52;   // graus — inclinação isométrica base
const _ISO_BASE_SCALE   = 1.45; // fator compensatório de escala base
var _ISO_ANGLE_X = _ISO_BASE_ANGLE_X;
var _ISO_SCALE   = _ISO_BASE_SCALE;
const _ISO_OVERSIZE = 1.8; // fator de aumento do wrap p/ cobrir os cantos do viewport
// Coeficientes da contra-transformação de billboard, cacheados (ver _avtIsoParamsAtualizar).
var _ISO_BB = null;

// Recalcula ângulo/escala efetivos. Com "profundidade" ativa usa 60° (squash ~0.5 →
// diamante 2:1) e compensa a escala para preservar a extensão vertical na tela.
function _avtIsoParamsAtualizar() {
  const usa2to1 = !!(AVT_GRAFICOS.isoAtivo && AVT_GRAFICOS.profundidade);
  _ISO_ANGLE_X = usa2to1 ? 60 : _ISO_BASE_ANGLE_X;
  const cosBase = Math.cos(_ISO_BASE_ANGLE_X * Math.PI / 180);
  const cosCur  = Math.cos(_ISO_ANGLE_X * Math.PI / 180);
  _ISO_SCALE = _ISO_BASE_SCALE * (cosBase / cosCur);
  // Pré-computa os coeficientes da contra-transformação de billboard. Eles só
  // dependem de _ISO_SCALE/_ISO_ANGLE_X (mudam apenas em toggle), então cacheá-los
  // aqui evita refazer Math.cos/divisões por entidade a cada frame no render iso.
  const k = _ISO_SCALE / Math.SQRT2;
  const inv2k = 1 / (2 * k);
  _ISO_BB = { inv2k, inv2kCos: inv2k / cosCur };
}

// Resolução de backing dos overlays WebGL de VFX. No iso o canvas do mapa é ampliado por
// _ISO_OVERSIZE (para cobrir os cantos da rotação 3D), então renderizar CADA overlay de
// efeito nessa resolução cheia multiplica a memória/fill-rate no GPU móvel (~3,24×) — o que
// estoura os contextos WebGL e trava o jogo. Renderizando a ~1/_ISO_OVERSIZE o custo por
// overlay volta ao patamar do topdown. Com autoDensity:true o tamanho CSS de exibição é
// preservado, então alinhamento/posicionamento dos efeitos não muda. Topdown → 1 (sem
// alteração de comportamento).
function _avtVfxOverlayResolution() {
  if (!(typeof AVT_GRAFICOS !== 'undefined' && AVT_GRAFICOS && AVT_GRAFICOS.isoAtivo)) return 1;
  return 1 / (_ISO_OVERSIZE || 1.8);
}
window._avtVfxOverlayResolution = _avtVfxOverlayResolution;

function _avtGraficosCarregar() {
  try {
    const raw = localStorage.getItem(_AVT_GRAFICOS_KEY);
    if (raw) Object.assign(AVT_GRAFICOS, JSON.parse(raw));
  } catch(e) {}
  _avtGraficosCssFxAplicar();
  _avtAudioAplicar();
}

// Aplica os volumes salvos ao AudioManager (chamado no load e nos sliders do menu).
function _avtAudioAplicar() {
  try {
    if (typeof AudioManager === 'undefined') return;
    if (typeof AVT_GRAFICOS.volMusica === 'number') AudioManager.setMusicVolume(AVT_GRAFICOS.volMusica);
    if (typeof AVT_GRAFICOS.volSfx === 'number')    AudioManager.setSfxVolume(AVT_GRAFICOS.volSfx);
  } catch(_) {}
}
window._avtAudioAplicar = _avtAudioAplicar;

function _avtGraficosSalvar() {
  try { localStorage.setItem(_AVT_GRAFICOS_KEY, JSON.stringify(AVT_GRAFICOS)); } catch(e) {}
}

function _avtGarantirFiltros3D() {
  if (document.getElementById('avt-svg-filtros3d')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'avt-svg-filtros3d';
  svg.setAttribute('style', 'display:none;position:absolute;width:0;height:0');
  svg.innerHTML = `<defs>
    <filter id="avt-filtro3d-1" color-interpolation-filters="sRGB">
      <feConvolveMatrix order="3" preserveAlpha="true"
        kernelMatrix="-0.5 -0.3 0  -0.3 1 0.3  0 0.3 0.5"/>
    </filter>
    <filter id="avt-filtro3d-2" color-interpolation-filters="sRGB">
      <feConvolveMatrix order="3" preserveAlpha="true"
        kernelMatrix="-1 -0.6 0  -0.6 1 0.6  0 0.6 1"/>
    </filter>
    <filter id="avt-filtro3d-3" color-interpolation-filters="sRGB">
      <feConvolveMatrix order="3" preserveAlpha="true"
        kernelMatrix="-2 -1 0  -1 1 1  0 1 2"/>
    </filter>
  </defs>`;
  document.body.appendChild(svg);
}

function _avtGraficosIsoAplicar() {
  const wrap = document.getElementById('avt-mapa-wrap');
  if (!wrap) return;
  _avtIsoParamsAtualizar(); // ângulo/escala efetivos (depende de "profundidade")
  // Host VFX é criado com resolution/antialias do modo vigente — recria no toggle.
  try { window._avtVfxHostDestroy?.(); } catch (_) {}
  if (AVT_GRAFICOS.isoAtivo) {
    wrap.style.transform = `rotateX(${_ISO_ANGLE_X}deg) rotateZ(45deg) scale(${_ISO_SCALE})`;
    wrap.style.transformOrigin = 'center center';
    // Estabiliza a camada de compositing 3D: evita re-rasterização (clarão) no mobile
    // quando overlays/efeitos são inseridos perto da camada transformada.
    wrap.style.willChange = 'transform';
    wrap.style.backfaceVisibility = 'hidden';
  } else {
    wrap.style.transform = '';
    wrap.style.transformOrigin = '';
    wrap.style.willChange = '';
    wrap.style.backfaceVisibility = '';
  }
  _avtIsoLayoutAplicar();
  _avtAtmosferaAplicar();
  _avtGraficosControlesAplicar();
}

// Vinheta de atmosfera: escurece bordas/void para o "mood" de masmorra. Aplicada como
// overlay fixo NÃO transformado sobre o container do mapa (irmão do wrap), de modo que
// não sofre a rotação isométrica. Os glows de luz nos jogadores são desenhados no canvas
// (em _avtRenderFrame), pois precisam acompanhar a câmera.
function _avtAtmosferaAplicar() {
  const wrap = document.getElementById('avt-mapa-wrap');
  const parent = wrap?.parentElement;
  if (!parent) return;
  let vig = document.getElementById('avt-atmosfera');
  const ativo = !!(AVT_GRAFICOS.isoAtivo && AVT_GRAFICOS.atmosfera);
  if (!ativo) { if (vig) vig.style.display = 'none'; return; }
  if (!vig) {
    vig = document.createElement('div');
    vig.id = 'avt-atmosfera';
    vig.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:20;'
      + 'background:radial-gradient(ellipse 62% 62% at 50% 48%,'
      + 'rgba(0,0,0,0) 38%,rgba(3,5,10,0.40) 72%,rgba(2,3,8,0.82) 100%);';
    parent.appendChild(vig);
  }
  vig.style.display = 'block';
}
window._avtAtmosferaAplicar = _avtAtmosferaAplicar;

// Cantos pretos: aumenta o wrap (e o canvas, que o acompanha) por _ISO_OVERSIZE e
// clipa o excedente no container pai, de modo que o paralelogramo da transform
// cubra todo o viewport. Mantém canvas == wrap, preservando a matemática de
// clique/pan/câmera (que usa offsetWidth/Height e a cadeia de offsetLeft).
function _avtIsoLayoutAplicar() {
  const wrap = document.getElementById('avt-mapa-wrap');
  if (!wrap) return;
  const parent = wrap.parentElement;
  if (!parent) return;
  // Só atua dentro do jogo (canvas existente e área com tamanho). Ao alternar no
  // menu pré-jogo, apenas guarda a preferência; o layout é aplicado ao entrar.
  const emJogo = !!(typeof AVT_STATE !== 'undefined' && AVT_STATE.canvas) && parent.clientWidth > 0;
  if (!emJogo && AVT_GRAFICOS.isoAtivo) return;
  if (AVT_GRAFICOS.isoAtivo) {
    if (!wrap._isoLayoutPrev) {
      wrap._isoLayoutPrev = {
        position: wrap.style.position, flex: wrap.style.flex,
        width: wrap.style.width, height: wrap.style.height,
        left: wrap.style.left, top: wrap.style.top,
        parentOverflow: parent.style.overflow,
      };
    }
    parent.style.overflow = 'hidden';
    wrap.style.position = 'absolute';
    wrap.style.flex = 'none';
    _avtIsoSizeWrap();
  } else if (wrap._isoLayoutPrev) {
    const p = wrap._isoLayoutPrev;
    wrap.style.position = p.position; wrap.style.flex = p.flex;
    wrap.style.width = p.width; wrap.style.height = p.height;
    wrap.style.left = p.left; wrap.style.top = p.top;
    parent.style.overflow = p.parentOverflow;
    wrap._isoLayoutPrev = null;
  }
  // Redimensiona o canvas para o novo tamanho do wrap.
  if (typeof _avtCanvasResize === 'function') { _avtIsoResizing = true; try { _avtCanvasResize(); } finally { _avtIsoResizing = false; } }
}

// Define apenas as dimensões oversized do wrap a partir do pai (sem disparar resize).
// Reaproveitado pelo _avtCanvasResize quando a janela muda de tamanho em iso.
var _avtIsoResizing = false;
function _avtIsoSizeWrap() {
  const wrap = document.getElementById('avt-mapa-wrap');
  if (!wrap || !AVT_GRAFICOS.isoAtivo) return;
  const parent = wrap.parentElement;
  if (!parent || parent.clientWidth <= 0) return;
  const pw = parent.clientWidth, ph = parent.clientHeight;
  const f = _ISO_OVERSIZE;
  wrap.style.width  = (pw * f) + 'px';
  wrap.style.height = (ph * f) + 'px';
  wrap.style.left = (pw * (1 - f) / 2) + 'px';
  wrap.style.top  = (ph * (1 - f) / 2) + 'px';
}
window._avtIsoSizeWrap = _avtIsoSizeWrap;

// Inversa analítica do CSS transform afim: tela → canvas (sem perspective, logo afim exata)
function _avtIsoScreenToCanvas(clientX, clientY) {
  const wrap = document.getElementById('avt-mapa-wrap');
  if (!wrap) return { x: clientX, y: clientY };
  let ox = 0, oy = 0, el = wrap;
  while (el) { ox += el.offsetLeft; oy += el.offsetTop; el = el.offsetParent as any; }
  const cw = wrap.offsetWidth, ch = wrap.offsetHeight;
  const dx = clientX - (ox + cw / 2);
  const dy = clientY - (oy + ch / 2);
  const k    = _ISO_SCALE / Math.SQRT2;
  const cosX = Math.cos(_ISO_ANGLE_X * Math.PI / 180);
  return {
    x: (dx + dy / cosX) / (2 * k) + cw / 2,
    y: (dy / cosX - dx) / (2 * k) + ch / 2,
  };
}

// Inversa para deltas de pan (offset cancela, só transforma a direção)
function _avtIsoDeltaToCanvas(dx, dy) {
  const k    = _ISO_SCALE / Math.SQRT2;
  const cosX = Math.cos(_ISO_ANGLE_X * Math.PI / 180);
  return { x: (dx + dy / cosX) / (2 * k), y: (dy / cosX - dx) / (2 * k) };
}

// Projeção DIRETA para deltas (canvas → tela): inversa exata de _avtIsoDeltaToCanvas.
// Usada para levar geometria de TRAJETO (caster→alvo) para dentro de containers de VFX
// billboardados: um billboard interpreta offsets como pixels de TELA, então um ponto P
// derivado do trajeto precisa virar `pivô + M·(P − pivô)` para cair sobre o token
// projetado. Offsets decorativos (lift, keyframes, anéis, wobble) ficam crus de
// propósito — devem ler como pixels de tela "em pé".
function _avtIsoDeltaToScreen(dx, dy) {
  const k    = _ISO_SCALE / Math.SQRT2;
  const cosX = Math.cos(_ISO_ANGLE_X * Math.PI / 180);
  return { x: (dx - dy) * k, y: (dx + dy) * k * cosX };
}
window._avtIsoDeltaToScreen = _avtIsoDeltaToScreen;

// Projeção DIRETA canvas → tela (inversa de _avtIsoScreenToCanvas), em coordenadas do
// PAI não-transformado do wrap. Usada para posicionar a camada de VFX (que fica FORA da
// transformação 3D) sobre o tile/profundidade corretos. Como a transform usa origin
// center e o pai é não-transformado, o centro do wrap = centro do pai.
function _avtIsoCanvasToScreen(canvasX, canvasY) {
  const wrap = document.getElementById('avt-mapa-wrap');
  if (!wrap) return { x: canvasX, y: canvasY };
  const cw = wrap.offsetWidth, ch = wrap.offsetHeight;
  const k    = _ISO_SCALE / Math.SQRT2;
  const cosX = Math.cos(_ISO_ANGLE_X * Math.PI / 180);
  const cxd = canvasX - cw / 2, cyd = canvasY - ch / 2;
  const dx = (cxd - cyd) * k;            // desloc. de tela a partir do centro
  const dy = (cxd + cyd) * k * cosX;
  return { x: wrap.offsetLeft + cw / 2 + dx, y: wrap.offsetTop + ch / 2 + dy };
}
window._avtIsoCanvasToScreen = _avtIsoCanvasToScreen;

// Billboards: aplica ao contexto 2D a contra-transformação (inversa da parte linear do
// CSS) ao redor do ponto de ancoragem (pivô, normalmente os pés). Como o CSS aplica uma
// transformação AFIM (não há perspective), desenhar com a inversa faz o sprite voltar a
// aparecer "em pé"/sem distorção na tela, mantendo os pés plantados no tile. O chamador
// envolve o desenho com ctx.save()/ctx.restore(). Usa os MESMOS k/cosX da projeção de
// clique, então acompanha o ângulo 2:1 automaticamente.
function _avtIsoBillboardAplicar(ctx, pivotX, pivotY) {
  // Lê os coeficientes cacheados (recalcula sob demanda se ainda não populados).
  if (!_ISO_BB) _avtIsoParamsAtualizar();
  const { inv2k, inv2kCos } = _ISO_BB;
  // Matriz inversa (tela→canvas), em torno do pivô: T(p)·M⁻¹·T(-p).
  // transform(a,b,c,d,e,f): x'=a·x+c·y+e, y'=b·x+d·y+f.
  ctx.translate(pivotX, pivotY);
  ctx.transform(inv2k, -inv2k, inv2kCos, inv2kCos, 0, 0);
  ctx.translate(-pivotX, -pivotY);
}
window._avtIsoBillboardAplicar = _avtIsoBillboardAplicar;

function _avtGraficosIsoToggle(ativo) {
  AVT_GRAFICOS.isoAtivo = ativo;
  _avtGraficosSalvar();
  _avtGraficosIsoAplicar();
  const chk = document.getElementById('avt-cfg-iso-ativo');
  if (chk) chk.checked = ativo;
  // Reflete o estado (habilita/desabilita) dos controles iso, se o painel estiver aberto
  _avtControlesAtualizarUI();
  _avtIsoRefinosAtualizarUI();
}

// ── Refinamentos da visão isométrica (preferência individual) ─────────────────
// Toggle genérico para bilbordes/atmosfera/profundidade/polimento. Apenas atualiza a
// flag e reaplica a transform iso (o loop de render lê as flags a cada frame).
function _avtGraficosRefinoToggle(chave, ativo) {
  AVT_GRAFICOS[chave] = !!ativo;
  AVT_GRAFICOS.preset = null; // ajuste manual → sai do preset em lote
  _avtGraficosSalvar();
  // "profundidade" muda o ângulo 2:1; "atmosfera" liga/desliga a vinheta.
  // Reaplicar a transform recalcula ambos sem reabrir a fase.
  _avtGraficosIsoAplicar();
  const chk = document.getElementById('avt-cfg-iso-' + chave);
  if (chk) chk.checked = !!ativo;
}
window._avtGraficosRefinoToggle = _avtGraficosRefinoToggle;

// Atualiza estado disabled/checked dos toggles de refinamento (dependem de isoAtivo,
// exceto "polimento" que vale sempre).
function _avtIsoRefinosAtualizarUI() {
  const isoOn = !!AVT_GRAFICOS.isoAtivo;
  ['bilbordes', 'atmosfera', 'profundidade', 'pernas', 'vfxProjecao', 'vfxBillboard'].forEach(chave => {
    const chk = document.getElementById('avt-cfg-iso-' + chave);
    if (chk) { chk.disabled = !isoOn; chk.checked = !!AVT_GRAFICOS[chave]; }
    const row = document.getElementById('avt-cfg-iso-' + chave + '-row');
    if (row) row.style.opacity = isoOn ? '1' : '0.45';
  });
  const pol = document.getElementById('avt-cfg-iso-polimento');
  if (pol) pol.checked = !!AVT_GRAFICOS.polimento;
}

// ── Controles isométricos (preferência individual) ───────────────────────────
function _avtGraficosTecladoToggle(ativo) {
  AVT_GRAFICOS.isoTeclado = ativo;
  _avtGraficosSalvar();
  const chk = document.getElementById('avt-cfg-iso-teclado');
  if (chk) chk.checked = ativo;
}

function _avtGraficosMobileToggle(ativo) {
  AVT_GRAFICOS.isoMobile = ativo;
  _avtGraficosSalvar();
  _avtGraficosControlesAplicar();
  const chk = document.getElementById('avt-cfg-iso-mobile');
  if (chk) chk.checked = ativo;
}

// Mostra/esconde os overlays de controle conforme preferências (sem gate de touch —
// se o usuário ativou explicitamente a opção, é suficiente para exibir).
function _avtGraficosControlesAplicar() {
  const isoDpad     = document.getElementById('avt-iso-dpad');
  const regularDpad = document.getElementById('avt-dpad');
  const analogicoEl = document.getElementById('avt-analogico-stick');

  const showIsoDpad   = !!(AVT_GRAFICOS.isoAtivo && AVT_GRAFICOS.isoMobile && !AVT_GRAFICOS.analogico);
  const showAnalogico = !!AVT_GRAFICOS.analogico;

  if (isoDpad)     isoDpad.style.display     = showIsoDpad   ? 'block' : 'none';
  if (analogicoEl) analogicoEl.style.display = showAnalogico ? 'block' : 'none';
  if (regularDpad && (showIsoDpad || showAnalogico)) regularDpad.style.display = 'none';

  if (showAnalogico) _avtAnalogicoIniciar();
}

function _avtGraficosAnalogicoToggle(ativo) {
  AVT_GRAFICOS.analogico = !!ativo;
  _avtGraficosSalvar();
  _avtGraficosControlesAplicar();
  const chk = document.getElementById('avt-cfg-analogico');
  if (chk) chk.checked = !!ativo;
}
window._avtGraficosAnalogicoToggle = _avtGraficosAnalogicoToggle;

// Inicializa o joystick analógico via Pointer Events (roda uma única vez).
let _avtAnalogicoIniciado = false;
function _avtAnalogicoIniciar() {
  if (_avtAnalogicoIniciado) return;
  const outer = document.querySelector('#avt-analogico-stick .avt-joystick-outer');
  const knob  = document.getElementById('avt-joystick-knob');
  if (!outer || !knob) return;
  _avtAnalogicoIniciado = true;

  const R = 50; // raio máximo de deslocamento do knob em px
  let _active = false, _lastSector = -1;

  // 8 setores horários desde E: E SE S SO O NO N NE
  // Modo normal → (dx,dy) de grade convencionais
  // Modo iso    → rotaciona 45° para alinhar ao visual da tela
  const _mapNormal = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
  const _mapIso    = [[1,-1],[1,0],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];

  function _dirGrid(sector) {
    return (AVT_GRAFICOS?.isoAtivo ? _mapIso : _mapNormal)[sector];
  }

  function _mover(ex, ey) {
    const rect = outer.getBoundingClientRect();
    let x = ex - (rect.left + rect.width  / 2);
    let y = ey - (rect.top  + rect.height / 2);
    const d = Math.sqrt(x * x + y * y);
    if (d > R) { x = x / d * R; y = y / d * R; }
    knob.style.transform = `translate(${x}px,${y}px)`;

    if (d < 14) { // deadzone
      if (_lastSector !== -1) { _lastSector = -1; if (typeof avtDpadStop === 'function') avtDpadStop(); }
      return;
    }
    const sector = Math.round(((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360 / 45) % 8;
    if (sector === _lastSector) return;
    _lastSector = sector;
    const [dx, dy] = _dirGrid(sector);
    if (typeof avtDpad === 'function') avtDpad(dx, dy);
  }

  outer.addEventListener('pointerdown', (e: any) => {
    _active = true; outer.setPointerCapture(e.pointerId); _mover(e.clientX, e.clientY);
  });
  outer.addEventListener('pointermove', (e: any) => { if (_active) _mover(e.clientX, e.clientY); });
  ['pointerup', 'pointercancel'].forEach(ev => outer.addEventListener(ev, () => {
    _active = false; _lastSector = -1;
    knob.style.transform = '';
    if (typeof avtDpadStop === 'function') avtDpadStop();
  }));
}

// Atualiza o estado disabled/checked dos toggles da aba Controles, se visíveis.
function _avtControlesAtualizarUI() {
  const isoOn = !!AVT_GRAFICOS.isoAtivo;
  ['avt-cfg-iso-teclado', 'avt-cfg-iso-mobile'].forEach(id => {
    const chk = document.getElementById(id);
    if (chk) chk.disabled = !isoOn;
  });
  const aviso = document.getElementById('avt-cfg-controles-aviso');
  if (aviso) aviso.style.display = isoOn ? 'none' : 'block';
}

function _avtMenuHtmlControles() {
  const g = AVT_GRAFICOS;
  const dis = g.isoAtivo ? '' : 'disabled';
  const op  = g.isoAtivo ? '1' : '0.45';
  return `
    <div>
      <div style="font-family:var(--fonte-d);font-size:0.65rem;color:rgba(200,168,75,0.7);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px">🎮 Controles</div>

      <label style="display:flex;align-items:center;gap:12px;cursor:pointer;padding:10px;background:var(--escuro,#0a0f18);border:1px solid var(--borda,rgba(79,163,209,0.15));border-radius:8px;margin-bottom:18px">
        <input type="checkbox" id="avt-cfg-analogico"
               style="width:18px;height:18px;accent-color:var(--destaque,#c8a84b)"
               ${g.analogico ? 'checked' : ''}
               onchange="_avtGraficosAnalogicoToggle(this.checked)">
        <div>
          <div style="font-family:var(--fonte-d);font-size:0.82rem;color:var(--texto,#c8d8e8)">Controle analógico</div>
          <div style="font-size:0.72rem;color:var(--suave,#7a92aa);margin-top:2px">Alavanca virtual no lugar do D-pad. Em modo isométrico os eixos se alinham à perspectiva visual.</div>
        </div>
      </label>

      <div style="font-family:var(--fonte-d);font-size:0.65rem;color:rgba(200,168,75,0.55);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">🗺 Controles Isométricos</div>

      <div id="avt-cfg-controles-aviso" style="display:${g.isoAtivo ? 'none' : 'block'};font-size:0.68rem;color:#c89a4b;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.25);border-radius:8px;padding:8px 10px;margin-bottom:12px">
        Disponível apenas com a <b>Visão Isométrica</b> ativada (aba Gráficos).
      </div>

      <label style="display:flex;align-items:center;gap:12px;cursor:pointer;padding:10px;background:var(--escuro,#0a0f18);border:1px solid var(--borda,rgba(79,163,209,0.15));border-radius:8px;margin-bottom:10px;opacity:${op}">
        <input type="checkbox" id="avt-cfg-iso-teclado" ${dis}
               style="width:18px;height:18px;accent-color:var(--destaque,#c8a84b)"
               ${g.isoTeclado ? 'checked' : ''}
               onchange="_avtGraficosTecladoToggle(this.checked)">
        <div>
          <div style="font-family:var(--fonte-d);font-size:0.82rem;color:var(--texto,#c8d8e8)">Controle isométrico (teclado)</div>
          <div style="font-size:0.72rem;color:var(--suave,#7a92aa);margin-top:2px">Move com W / E / S / D em diamante, alinhado às diagonais da tela.</div>
        </div>
      </label>

      <label style="display:flex;align-items:center;gap:12px;cursor:pointer;padding:10px;background:var(--escuro,#0a0f18);border:1px solid var(--borda,rgba(79,163,209,0.15));border-radius:8px;opacity:${op}">
        <input type="checkbox" id="avt-cfg-iso-mobile" ${dis}
               style="width:18px;height:18px;accent-color:var(--destaque,#c8a84b)"
               ${g.isoMobile ? 'checked' : ''}
               onchange="_avtGraficosMobileToggle(this.checked)">
        <div>
          <div style="font-family:var(--fonte-d);font-size:0.82rem;color:var(--texto,#c8d8e8)">Controle isométrico mobile</div>
          <div style="font-size:0.72rem;color:var(--suave,#7a92aa);margin-top:2px">D-pad com as diagonais em destaque e os direcionais comuns reduzidos.</div>
        </div>
      </label>
      <div style="font-size:0.6rem;color:#5a6b7a;margin-top:6px">Preferências salvas localmente neste dispositivo.</div>
    </div>
  `;
}

function _avtGraficosAplicar() {
  _avtGarantirFiltros3D();
  const canvas = AVT_STATE?.canvas || document.getElementById('avt-canvas');
  if (!canvas) return;
  canvas.style.filter = AVT_GRAFICOS.ativo ? `url(#avt-filtro3d-${AVT_GRAFICOS.nivel})` : '';
  _avtGraficosIsoAplicar();
}

function _avtGraficosAtualizarUI() {
  const g = AVT_GRAFICOS;
  const chk = document.getElementById('avt-cfg-tex3d-ativo');
  if (chk) chk.checked = g.ativo;
  [1,2,3].forEach(n => {
    const btn = document.getElementById(`avt-cfg-tex3d-n${n}`);
    if (!btn) return;
    const sel = g.ativo && g.nivel === n;
    btn.style.background = `rgba(200,168,75,${sel ? '0.15' : '0.04'})`;
    btn.style.borderColor = `rgba(200,168,75,${sel ? '0.55' : '0.18'})`;
    btn.style.color = sel ? '#f0cc6a' : '#7a92aa';
    btn.style.opacity = g.ativo ? '1' : '0.45';
  });
}

function _avtGraficosToggle(ativo) {
  AVT_GRAFICOS.ativo = ativo;
  _avtGraficosSalvar();
  _avtGraficosAplicar();
  _avtGraficosAtualizarUI();
}

function _avtGraficosNivel(n) {
  AVT_GRAFICOS.nivel = n;
  _avtGraficosSalvar();
  _avtGraficosAplicar();
  _avtGraficosAtualizarUI();
}

function _avtMenuHtmlGraficos() {
  const g = AVT_GRAFICOS;
  const niveisLabel = ['', 'Sutil', 'Moderado', 'Intenso'];
  const presets = [
    ['baixo', '🍃 Baixo',  'Máximo desempenho'],
    ['medio', '⚖ Médio',   'Equilíbrio'],
    ['alto',  '✨ Alto',    'Todos os efeitos'],
  ];
  return `
    <div style="margin-bottom:20px">
      <div style="font-family:var(--fonte-d);font-size:0.65rem;color:rgba(200,168,75,0.7);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px">🎚 Qualidade Gráfica</div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        ${presets.map(([id, label, sub]) => `
          <button onclick="_avtGraficosPreset('${id}')" id="avt-cfg-preset-${id}"
            style="flex:1;padding:9px 6px;border-radius:7px;cursor:pointer;font-size:0.68rem;font-family:var(--fonte-d);
                   background:rgba(200,168,75,${g.preset===id ? '0.15' : '0.04'});
                   border:1px solid rgba(200,168,75,${g.preset===id ? '0.55' : '0.18'});
                   color:${g.preset===id ? '#f0cc6a' : '#7a92aa'}">
            <div>${label}</div>
            <div style="font-size:0.56rem;opacity:0.75;margin-top:2px">${sub}</div>
          </button>
        `).join('')}
      </div>
      <div style="font-size:0.6rem;color:#5a6b7a;margin-bottom:10px">${g.preset ? '' : 'Personalizado (toggles abaixo). '}Os presets ajustam os refinamentos em lote; você pode refinar manualmente depois.</div>

      <label style="display:flex;align-items:center;gap:12px;cursor:pointer;padding:9px 10px;background:var(--escuro,#0a0f18);border:1px solid var(--borda,rgba(79,163,209,0.15));border-radius:8px;margin-bottom:8px">
        <input type="checkbox" id="avt-cfg-adaptativo"
               style="width:18px;height:18px;accent-color:var(--destaque,#c8a84b)"
               ${g.adaptativo !== false ? 'checked' : ''}
               onchange="AVT_GRAFICOS.adaptativo = this.checked; _avtGraficosSalvar()">
        <div>
          <div style="font-family:var(--fonte-d);font-size:0.8rem;color:var(--texto,#c8d8e8)">Qualidade adaptativa</div>
          <div style="font-size:0.7rem;color:var(--suave,#7a92aa);margin-top:2px">Reduz a qualidade automaticamente (com aviso) quando o FPS cai abaixo de 45.</div>
        </div>
      </label>

      <label style="display:flex;align-items:center;gap:12px;cursor:pointer;padding:9px 10px;background:var(--escuro,#0a0f18);border:1px solid var(--borda,rgba(79,163,209,0.15));border-radius:8px;margin-bottom:8px">
        <input type="checkbox" id="avt-cfg-perf-overlay"
               style="width:18px;height:18px;accent-color:var(--destaque,#c8a84b)"
               ${g.perfOverlay ? 'checked' : ''}
               onchange="if (typeof avtPerfToggle==='function') avtPerfToggle(this.checked)">
        <div>
          <div style="font-family:var(--fonte-d);font-size:0.8rem;color:var(--texto,#c8d8e8)">Medidor de desempenho</div>
          <div style="font-size:0.7rem;color:var(--suave,#7a92aa);margin-top:2px">Overlay com FPS, latência (RTT) e tráfego de rede — útil para diagnosticar travamentos.</div>
        </div>
      </label>
    </div>

    <div style="margin-bottom:20px">
      <div style="font-family:var(--fonte-d);font-size:0.65rem;color:rgba(200,168,75,0.7);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px">🔊 Áudio</div>

      <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Volume da música</label>
      <input type="range" min="0" max="1" step="0.05"
             value="${typeof g.volMusica === 'number' ? g.volMusica : 0.45}"
             style="width:100%;cursor:pointer;accent-color:#c8a84b;margin-bottom:10px"
             oninput="AVT_GRAFICOS.volMusica = parseFloat(this.value); _avtAudioAplicar(); _avtGraficosSalvar()">

      <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Volume dos efeitos (SFX)</label>
      <input type="range" min="0" max="1" step="0.05"
             value="${typeof g.volSfx === 'number' ? g.volSfx : 0.75}"
             style="width:100%;cursor:pointer;accent-color:#c8a84b;margin-bottom:10px"
             oninput="AVT_GRAFICOS.volSfx = parseFloat(this.value); _avtAudioAplicar(); _avtGraficosSalvar()">

      <label style="display:flex;align-items:center;gap:12px;cursor:pointer;padding:9px 10px;background:var(--escuro,#0a0f18);border:1px solid var(--borda,rgba(79,163,209,0.15));border-radius:8px;margin-bottom:8px">
        <input type="checkbox" style="width:18px;height:18px;accent-color:var(--destaque,#c8a84b)"
               ${g.sfxPassos !== false ? 'checked' : ''}
               onchange="AVT_GRAFICOS.sfxPassos = this.checked; _avtGraficosSalvar()">
        <div>
          <div style="font-family:var(--fonte-d);font-size:0.8rem;color:var(--texto,#c8d8e8)">Passos posicionais</div>
          <div style="font-size:0.7rem;color:var(--suave,#7a92aa);margin-top:2px">Som de passos dos jogadores, mais alto quanto mais perto de você.</div>
        </div>
      </label>
      <div style="font-size:0.6rem;color:#5a6b7a;margin-bottom:4px">Sons de skills, baús e fontes ambientes (tochas/cachoeiras) já atenuam pela distância automaticamente.</div>
    </div>

    <div style="margin-bottom:20px">
      <div style="font-family:var(--fonte-d);font-size:0.65rem;color:rgba(200,168,75,0.7);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px">🎨 Filtro de Textura 3D</div>

      <label style="display:flex;align-items:center;gap:12px;cursor:pointer;padding:10px;background:var(--escuro,#0a0f18);border:1px solid var(--borda,rgba(79,163,209,0.15));border-radius:8px;margin-bottom:12px">
        <input type="checkbox" id="avt-cfg-tex3d-ativo"
               style="width:18px;height:18px;accent-color:var(--destaque,#c8a84b)"
               ${g.ativo ? 'checked' : ''}
               onchange="_avtGraficosToggle(this.checked)">
        <div>
          <div style="font-family:var(--fonte-d);font-size:0.82rem;color:var(--texto,#c8d8e8)">Textura 3D</div>
          <div style="font-size:0.72rem;color:var(--suave,#7a92aa);margin-top:2px">Adiciona relevo e profundidade visual ao mapa da aventura</div>
        </div>
      </label>

      <div style="display:flex;gap:6px">
        ${[1,2,3].map(n => `
          <button onclick="_avtGraficosNivel(${n})" id="avt-cfg-tex3d-n${n}"
            style="flex:1;padding:8px;border-radius:7px;cursor:pointer;font-size:0.68rem;font-family:var(--fonte-d);
                   background:rgba(200,168,75,${g.ativo && g.nivel===n ? '0.15' : '0.04'});
                   border:1px solid rgba(200,168,75,${g.ativo && g.nivel===n ? '0.55' : '0.18'});
                   color:${g.ativo && g.nivel===n ? '#f0cc6a' : '#7a92aa'};
                   opacity:${g.ativo ? '1' : '0.45'}">
            ${niveisLabel[n]}
          </button>
        `).join('')}
      </div>
      <div style="font-size:0.6rem;color:#5a6b7a;margin-top:6px">Preferência salva localmente neste dispositivo.</div>
    </div>

    <div>
      <div style="font-family:var(--fonte-d);font-size:0.65rem;color:rgba(200,168,75,0.7);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px">🏔 Visão Isométrica</div>

      <label style="display:flex;align-items:center;gap:12px;cursor:pointer;padding:10px;background:var(--escuro,#0a0f18);border:1px solid var(--borda,rgba(79,163,209,0.15));border-radius:8px;margin-bottom:8px">
        <input type="checkbox" id="avt-cfg-iso-ativo"
               style="width:18px;height:18px;accent-color:var(--destaque,#c8a84b)"
               ${g.isoAtivo ? 'checked' : ''}
               onchange="_avtGraficosIsoToggle(this.checked)">
        <div>
          <div style="font-family:var(--fonte-d);font-size:0.82rem;color:var(--texto,#c8d8e8)">Visão Isométrica</div>
          <div style="font-size:0.72rem;color:var(--suave,#7a92aa);margin-top:2px">Inclina o mapa para perspectiva 3D isométrica. Compatível com o efeito de textura.</div>
        </div>
      </label>

      <div style="font-family:var(--fonte-d);font-size:0.62rem;color:rgba(200,168,75,0.55);text-transform:uppercase;letter-spacing:.08em;margin:14px 0 8px">✨ Refinamentos (estilo Diablo)</div>
      ${[
        ['bilbordes',    'Personagens em pé', 'Mantém personagens e nomes verticais voltados à câmera, em vez de inclinados junto com o chão.', true],
        ['atmosfera',    'Atmosfera e luz',   'Vinheta escura nas bordas e brilho ambiente ao redor dos jogadores.', true],
        ['profundidade', 'Profundidade 2:1',  'Quem está à frente sobrepõe quem está atrás e usa o ângulo isométrico 2:1 clássico.', true],
        ['pernas',       'Movimentação de pernas', 'Anima as pernas dos tokens ao andar (passada articulada). Desligue para um balanço simples. O estilo por token é escolhido no Estúdio de Caminhada da ficha.', true],
        ['vfxProjecao',  'Efeitos: profundidade', 'Posiciona os efeitos de habilidade no tile/profundidade corretos (projeção isométrica).', true],
        ['vfxBillboard', 'Efeitos: em pé',    'Desenha os efeitos de habilidade verticais, acompanhando os personagens em pé (não deitados no chão).', true],
        ['polimento',    'Polimento visual',  'Números de dano arredondados e nomes com contorno para melhor leitura.', false],
      ].map(([chave, titulo, desc, dependeIso]) => {
        const dis = (dependeIso && !g.isoAtivo) ? 'disabled' : '';
        const op  = (dependeIso && !g.isoAtivo) ? '0.45' : '1';
        return `
      <label id="avt-cfg-iso-${chave}-row" style="display:flex;align-items:center;gap:12px;cursor:pointer;padding:9px 10px;background:var(--escuro,#0a0f18);border:1px solid var(--borda,rgba(79,163,209,0.15));border-radius:8px;margin-bottom:8px;opacity:${op}">
        <input type="checkbox" id="avt-cfg-iso-${chave}" ${dis}
               style="width:18px;height:18px;accent-color:var(--destaque,#c8a84b)"
               ${g[chave as any] ? 'checked' : ''}
               onchange="_avtGraficosRefinoToggle('${chave}', this.checked)">
        <div>
          <div style="font-family:var(--fonte-d);font-size:0.8rem;color:var(--texto,#c8d8e8)">${titulo}</div>
          <div style="font-size:0.7rem;color:var(--suave,#7a92aa);margin-top:2px">${desc}</div>
        </div>
      </label>`;
      }).join('')}

      <div style="font-size:0.6rem;color:#5a6b7a;margin-top:2px">Para um sprite isométrico personalizado, configure na ficha do personagem.</div>
    </div>
  `;
}

window._avtGraficosToggle        = _avtGraficosToggle;
window._avtGraficosNivel         = _avtGraficosNivel;
window._avtGraficosIsoToggle     = _avtGraficosIsoToggle;
window._avtGraficosTecladoToggle = _avtGraficosTecladoToggle;
window._avtGraficosMobileToggle  = _avtGraficosMobileToggle;
window._avtGraficosControlesAplicar = _avtGraficosControlesAplicar;
window._avtIsoScreenToCanvas     = _avtIsoScreenToCanvas;
window._avtIsoDeltaToCanvas      = _avtIsoDeltaToCanvas;

// ─────────────────────────────────────────────────────────────────────────────
// ENTRADA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

async function avtMenuAbrir(rpgId) {
  try {
    mostrarLoading('Carregando dungeon…');
    await _avtCarregarDados(rpgId);
    AVT_MENU_STATE.rpgId = rpgId;
    AVT_MENU_STATE.sessionData = await _avtMenuCarregarSessionData(rpgId);
    ocultarLoading();

    document.getElementById('hub').style.display = 'none';
    const sc = document.getElementById('avt-menu-screen');
    if (!sc) { _avtMenuFallback(rpgId); return; }
    sc.style.display = 'flex';

    const t = AVT_STATE.rpg?.theme_json || {};

    // Imagem de fundo
    const bgEl = document.getElementById('avt-menu-bg-img');
    if (bgEl) {
      const imgUrl = t.menu_img_url || '';
      bgEl.style.backgroundImage = imgUrl ? `url("${imgUrl.replace(/"/g, '%22')}")` : 'none';
      bgEl.style.display = imgUrl ? 'block' : 'none';
    }

    // Cor de fundo
    if (t.menu_theme_color) {
      sc.style.background = t.menu_theme_color;
    } else {
      sc.style.background = '#050810';
    }

    // Nome
    const nomeEl = document.getElementById('avt-menu-nome');
    if (nomeEl) nomeEl.textContent = AVT_STATE.rpg?.name || 'Dungeon';

    // Esconder sub-painel
    const panel = document.getElementById('avt-menu-panel');
    if (panel) panel.style.display = 'none';

    _avtMenuRenderBotoes();
  } catch(e) {
    ocultarLoading();
    mostrarToast('Erro ao abrir menu: ' + (e?.message || e), 'erro');
    _avtMenuFallback(rpgId);
  }
}
window.avtMenuAbrir = avtMenuAbrir;

function _avtMenuFallback(rpgId) {
  mostrarLoading('Carregando dungeon…');
  _avtMostrarAventuraScreen();
  _avtIniciarRTNet(rpgId, _avtIniciarCanvas);
}

function sairAventura() {
  _avtCleanupListeners();
  try { if (typeof avtPixiWorldDestroy === 'function') avtPixiWorldDestroy(); } catch(_) {} // libera o contexto GL da camada de mundo
  try { if (AVT_STATE._autoSaveTimer) { clearInterval(AVT_STATE._autoSaveTimer); (AVT_STATE as any)._autoSaveTimer = null; } } catch(_) {}
  try { if (typeof RTNet !== 'undefined' && RTNet.initialized) RTNet.shutdown(); } catch(_) {}
  try { if (typeof _avtNpcSyncShutdown === 'function') _avtNpcSyncShutdown(); } catch(_){}
  try { const mm = document.getElementById('avt-minimap'); if (mm) mm.remove(); } catch(_) {}
  const avt = document.getElementById('aventura-screen');
  if (avt) avt.style.display = 'none';
  const menu = document.getElementById('avt-menu-screen');
  if (menu) menu.style.display = 'none';
  document.getElementById('hub').style.display = 'block';
  avtHubRenderSection();
  AVT_STATE.rpgId   = null;
  AVT_STATE.dungeon = null;
  AVT_STATE.entidades = [];
  AVT_STATE.batalhas = [];
  AVT_STATE.mestreReposicionando = null;
  AVT_STATE.aparencias = {};
  AVT_STATE.entAnim = {};
  AVT_STATE.npcTimers = {};
  AVT_STATE.myCharNome = null;
  AVT_STATE.membros = [];
  AVT_STATE._lastFrameTs = 0;
  AVT_MENU_STATE.rpgId = null;
  AVT_MENU_STATE.sessionData = null;
  if (typeof avtInvReset === 'function') avtInvReset();
}
window.sairAventura = sairAventura;

async function voltarAoMenuDeJogo() {
  _avtCleanupListeners();
  try { if (AVT_STATE._autoSaveTimer) { clearInterval(AVT_STATE._autoSaveTimer); (AVT_STATE as any)._autoSaveTimer = null; } } catch(_) {}
  try { if (typeof RTNet !== 'undefined' && RTNet.initialized) RTNet.shutdown(); } catch(_) {}
  try { if (typeof _avtNpcSyncShutdown === 'function') _avtNpcSyncShutdown(); } catch(_){}
  try { const mm = document.getElementById('avt-minimap'); if (mm) mm.remove(); } catch(_) {}
  const avt = document.getElementById('aventura-screen');
  if (avt) avt.style.display = 'none';
  const rpgId = AVT_STATE.rpgId;
  AVT_STATE.dungeon = null;
  AVT_STATE.entidades = [];
  AVT_STATE.batalhas = [];
  AVT_STATE.mestreReposicionando = null;
  AVT_STATE.aparencias = {};
  AVT_STATE.entAnim = {};
  AVT_STATE.npcTimers = {};
  AVT_STATE.myCharNome = null;
  AVT_STATE.membros = [];
  AVT_STATE._lastFrameTs = 0;
  if (typeof avtInvReset === 'function') avtInvReset();
  await avtMenuAbrir(rpgId);
}
window.voltarAoMenuDeJogo = voltarAoMenuDeJogo;

// ─────────────────────────────────────────────────────────────────────────────
// BOTÕES DO MENU PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuRenderBotoes() {
  const cont = document.getElementById('avt-menu-botoes');
  if (!cont) return;

  const sd = AVT_MENU_STATE.sessionData || {};
  const temSessao = !!(sd.last_char_nome);
  const t = AVT_STATE.rpg?.theme_json || {};
  const acc = t.destaque || '#c8a84b';

  const botoes = [
    {
      id: 'jogar', label: '▶ Jogar', sub: 'Novo início',
      cor: acc, fn: '_avtMenuAbrirJogar()',
    },
    {
      id: 'continuar', label: '⟳ Continuar', sub: 'Retomar sessão',
      cor: '#4fa3d1', fn: '_avtMenuAbrirContinuar()',
      disabled: !temSessao,
      titulo: temSessao ? '' : 'Sem sessão anterior',
    },
    {
      id: 'fase', label: '🗺 Fase', sub: 'Escolher entrada',
      cor: '#7a92aa', fn: '_avtMenuAbrirFase()',
    },
    {
      id: 'personagem', label: '👤 Personagem', sub: 'Gerenciar fichas',
      cor: '#7a92aa', fn: '_avtMenuAbrirPersonagem()',
    },
    {
      id: 'config', label: '⚙ Config', sub: 'Preferências',
      cor: '#7a92aa', fn: '_avtMenuAbrirConfig()',
    },
    {
      id: 'guia', label: '📖 Guia', sub: 'Como jogar',
      cor: '#7a92aa', fn: '_avtMenuAbrirGuia()',
    },
  ];

  if (AVT_STATE.isMestre) {
    botoes.push({
      id: 'pixi-studio', label: '🎨 Studio', sub: 'Animações de skill',
      cor: '#4fa3d1', fn: '_avtMenuAbrirPixiStudio()',
    });
  }

  cont.innerHTML = botoes.map(b => `
    <button
      id="avt-menu-btn-${b.id}"
      onclick="${b.disabled ? '' : b.fn}"
      title="${b.titulo || ''}"
      style="
        display:flex;align-items:center;gap:14px;
        background:rgba(${_hexToRgb(b.cor)},0.08);
        border:1px solid rgba(${_hexToRgb(b.cor)},${b.disabled ? '0.15' : '0.35'});
        border-radius:10px;padding:13px 20px;cursor:${b.disabled ? 'default' : 'pointer'};
        opacity:${b.disabled ? '0.45' : '1'};
        transition:background .15s,border-color .15s;
        width:100%;text-align:left;
        font-family:var(--fonte-d,serif);
      "
      ${b.disabled ? 'disabled' : ''}
    >
      <div style="flex:1">
        <div style="font-size:0.82rem;color:${b.cor};letter-spacing:.06em;text-transform:uppercase">${b.label}</div>
        <div style="font-size:0.6rem;color:#7a92aa;margin-top:2px;letter-spacing:.04em">${b.sub}</div>
      </div>
      <span style="color:${b.cor};opacity:.5;font-size:0.7rem">›</span>
    </button>
  `).join('');
}

function _hexToRgb(hex) {
  if (!hex || hex.length < 4) return '122,146,170';
  const h = hex.replace('#', '');
  const r = parseInt(h.length === 3 ? h[0]+h[0] : h.slice(0,2), 16);
  const g = parseInt(h.length === 3 ? h[1]+h[1] : h.slice(2,4), 16);
  const b = parseInt(h.length === 3 ? h[2]+h[2] : h.slice(4,6), 16);
  return `${r},${g},${b}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAINEL DESLIZANTE (sub-telas)
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuAbrirPanel(html, titulo) {
  const panel = document.getElementById('avt-menu-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(79,163,209,0.12);flex-shrink:0">
      <button onclick="_avtMenuFecharPanel()" style="background:none;border:1px solid rgba(79,163,209,0.25);border-radius:6px;color:#7a92aa;font-family:var(--fonte-d);font-size:0.62rem;padding:5px 10px;cursor:pointer">← Voltar</button>
      <span style="font-family:var(--fonte-d);font-size:0.78rem;color:#c8d8e8;letter-spacing:.08em;text-transform:uppercase">${titulo}</span>
    </div>
    <div style="padding:18px;flex:1;overflow-y:auto">${html}</div>
  `;
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
}

function _avtMenuFecharPanel() {
  const panel = document.getElementById('avt-menu-panel');
  if (panel) panel.style.display = 'none';
}
window._avtMenuFecharPanel = _avtMenuFecharPanel;

// ─────────────────────────────────────────────────────────────────────────────
// JOGAR — seleção de personagem para novo início
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuAbrirJogar() {
  _avtMenuAbrirPanel(_avtMenuHtmlSeletorChar('_avtMenuEntrarJogar'), 'Selecionar Personagem');
}
window._avtMenuAbrirJogar = _avtMenuAbrirJogar;

function _avtMenuEntrarJogar(charNome) {
  _avtMenuEntrarJogo({ charNome, faseId: 'principal' });
}
window._avtMenuEntrarJogar = _avtMenuEntrarJogar;

// ─────────────────────────────────────────────────────────────────────────────
// CONTINUAR — retoma última sessão
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuAbrirContinuar() {
  const sd = AVT_MENU_STATE.sessionData || {};
  const lastChar = sd.last_char_nome;
  const lastFase = sd.last_fase_id || 'principal';
  if (!lastChar) { mostrarToast('Sem sessão anterior salva', 'aviso'); return; }

  if (AVT_STATE.isMestre) {
    _avtMenuAbrirPanel(_avtMenuHtmlSeletorChar('_avtMenuEntrarContinuarComChar', lastFase), 'Continuar — Escolher Personagem');
  } else {
    _avtMenuEntrarJogo({ charNome: lastChar, faseId: lastFase });
  }
}
window._avtMenuAbrirContinuar = _avtMenuAbrirContinuar;

function _avtMenuEntrarContinuarComChar(charNome) {
  const lastFase = (AVT_MENU_STATE.sessionData || {}).last_fase_id || 'principal';
  _avtMenuEntrarJogo({ charNome, faseId: lastFase });
}
window._avtMenuEntrarContinuarComChar = _avtMenuEntrarContinuarComChar;

// ─────────────────────────────────────────────────────────────────────────────
// FASE — escolher fase e depois personagem
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuAbrirFase() {
  if (AVT_STATE.isMestre) {
    _avtMenuAbrirFaseMestre();
  } else {
    _avtMenuAbrirFaseJogador();
  }
}
window._avtMenuAbrirFase = _avtMenuAbrirFase;

function _avtMenuAbrirFaseJogador() {
  const fases = _avtMenuListarFases();
  const html = `
    <div style="display:flex;flex-direction:column;gap:8px">
      ${fases.map(f => `
        <button onclick="_avtMenuSelecionarFase('${f.id}')"
          style="background:rgba(79,163,209,0.06);border:1px solid rgba(79,163,209,0.2);border-radius:8px;padding:12px 16px;cursor:pointer;text-align:left;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.78rem;letter-spacing:.04em">
          ${f.nome}
        </button>
      `).join('')}
    </div>
  `;
  _avtMenuAbrirPanel(html, 'Escolher Fase');
}

function _avtMenuAbrirFaseMestre() {
  const extras = AVT_STATE.rpg?.theme_json?.fases_extras || [];

  const lockIcon = lt => lt === 'chave' ? '🔑' : lt === 'combate' ? '⚔' : '🔓';

  const html = `
    <div style="display:flex;flex-direction:column;gap:10px">

      <button onclick="_avtMenuNovaFaseComRefresh()"
        style="background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.35);border-radius:8px;padding:11px 16px;cursor:pointer;color:#c8a84b;font-family:var(--fonte-d);font-size:0.72rem;letter-spacing:.06em;text-align:center;width:100%">
        🚪 + Nova Fase
      </button>

      <div style="border-top:1px solid rgba(79,163,209,0.1);margin:4px 0"></div>

      <!-- Fase principal -->
      <div style="display:flex;align-items:center;gap:10px;background:rgba(79,163,209,0.05);border:1px solid rgba(79,163,209,0.15);border-radius:8px;padding:11px 14px">
        <div style="flex:1;font-family:var(--fonte-d);font-size:0.78rem;color:#c8d8e8">🏰 Fase Principal</div>
        <button onclick="_avtMenuSelecionarFase('principal')"
          style="background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#4fa3d1;font-family:var(--fonte-d);font-size:0.6rem;padding:4px 10px;cursor:pointer">▶ Jogar</button>
      </div>

      ${extras.map(f => `
        <div style="display:flex;align-items:center;gap:8px;background:rgba(79,163,209,0.04);border:1px solid rgba(79,163,209,0.12);border-radius:8px;padding:10px 12px">
          <div style="flex:1;min-width:0">
            <div style="font-family:var(--fonte-d);font-size:0.75rem;color:#c8d8e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lockIcon(f.porta?.lock_type)} ${f.nome||f.id}</div>
            <div style="font-size:0.6rem;color:#7a92aa;margin-top:2px">Portal: col ${f.porta?.col??'?'}, row ${f.porta?.row??'?'}</div>
          </div>
          <button onclick="_avtMenuSelecionarFase('${f.id}')"
            style="background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#4fa3d1;font-family:var(--fonte-d);font-size:0.6rem;padding:4px 9px;cursor:pointer;white-space:nowrap">▶ Jogar</button>
          <button onclick="_avtMenuEditarFase('${f.id}')"
            style="background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.3);border-radius:6px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.6rem;padding:4px 9px;cursor:pointer">✏</button>
          <button onclick="_avtMenuRemoverFaseComRefresh('${f.id}')"
            style="background:rgba(232,96,76,0.08);border:1px solid rgba(232,96,76,0.25);border-radius:6px;color:#e8604c;font-family:var(--fonte-d);font-size:0.6rem;padding:4px 9px;cursor:pointer">✕</button>
        </div>
      `).join('')}

      ${extras.length === 0 ? '<p style="font-size:0.68rem;color:#7a92aa;text-align:center;margin:8px 0">Nenhuma fase extra criada.</p>' : ''}
    </div>
  `;
  _avtMenuAbrirPanel(html, '🗺 Fases');
}
window._avtMenuAbrirFaseMestre = _avtMenuAbrirFaseMestre;

function _avtMenuNovaFaseComRefresh() {
  if (typeof _avtMestreNovaFase !== 'function') {
    mostrarToast('Entre na aventura para criar fases pelo mapa.', 'aviso');
    return;
  }
  _avtMestreNovaFase();
  const overlay = document.getElementById('avt-anim-import-overlay');
  if (!overlay) return;
  let _obs = new MutationObserver(() => {
    if (overlay.style.display === 'none' || overlay.style.display === '') {
      _obs.disconnect();
      _obs = null;
      _avtMenuAbrirFaseMestre();
    }
  });
  _obs.observe(overlay, { attributes: true, attributeFilter: ['style'] });
}
window._avtMenuNovaFaseComRefresh = _avtMenuNovaFaseComRefresh;

async function _avtMenuRemoverFaseComRefresh(faseId) {
  if (!confirm('Remover esta fase permanentemente?')) return;
  const theme = AVT_STATE.rpg.theme_json;
  theme.fases_extras = (theme.fases_extras || []).filter(f => f.id !== faseId);
  try {
    await _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AVT_MENU_STATE.rpgId)}`,
      { method: 'PATCH', body: JSON.stringify({ theme_json: theme }) });
    mostrarToast('Fase removida', 'ok');
  } catch(e) {
    mostrarToast('Erro ao remover: ' + (e?.message || e), 'erro');
  }
  _avtMenuAbrirFaseMestre();
}
window._avtMenuRemoverFaseComRefresh = _avtMenuRemoverFaseComRefresh;

function _avtMenuEditarFase(faseId) {
  const extras = AVT_STATE.rpg?.theme_json?.fases_extras || [];
  const f = extras.find(x => x.id === faseId);
  if (!f) return;

  const lockTypes = [
    { id: 'livre',   label: '🔓 Livre' },
    { id: 'chave',   label: '🔑 Chave' },
    { id: 'combate', label: '⚔ Combate' },
  ];

  const html = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div>
        <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Nome da fase</label>
        <input id="avt-edit-fase-nome" type="text" value="${(f.nome||'').replace(/"/g,'&quot;')}"
          style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem;padding:7px 10px;font-family:inherit;box-sizing:border-box">
      </div>

      <div>
        <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:6px">Tipo de lock da porta</label>
        <div style="display:flex;gap:6px">
          ${lockTypes.map(lt => `
            <button onclick="_avtMenuSetEditFaseLock('${lt.id}')"
              id="avt-edit-fase-lock-${lt.id}"
              style="flex:1;padding:7px 6px;border-radius:7px;cursor:pointer;font-size:0.65rem;font-family:var(--fonte-d);
                background:rgba(79,163,209,${(f.porta?.lock_type||'livre')===lt.id?'0.15':'0.04'});
                border:1px solid rgba(79,163,209,${(f.porta?.lock_type||'livre')===lt.id?'0.5':'0.15'});
                color:${(f.porta?.lock_type||'livre')===lt.id?'#4fa3d1':'#7a92aa'}">
              ${lt.label}
            </button>
          `).join('')}
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <div style="flex:1">
          <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Portal — Coluna</label>
          <input id="avt-edit-fase-col" type="number" min="0" value="${f.porta?.col??0}"
            style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem;padding:7px 10px;box-sizing:border-box">
        </div>
        <div style="flex:1">
          <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Portal — Linha</label>
          <input id="avt-edit-fase-row" type="number" min="0" value="${f.porta?.row??0}"
            style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem;padding:7px 10px;box-sizing:border-box">
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <div style="flex:1">
          <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Ordem na campanha</label>
          <input id="avt-edit-fase-ordem" type="number" min="0" value="${f.ordem ?? 1}"
            style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem;padding:7px 10px;box-sizing:border-box">
        </div>
        <div style="flex:1">
          <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Nível dos NPCs</label>
          <input id="avt-edit-fase-npclvl" type="number" min="1" value="${f.npc_level ?? 1}"
            style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem;padding:7px 10px;box-sizing:border-box">
        </div>
      </div>

      <div>
        <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:6px">🌀 Portas internas (teleporte na mesma fase)</label>
        ${(() => {
          const portas = f.dungeon_data?._portasInternas;
          if (!f.dungeon_data) return `<div style="font-size:0.62rem;color:#7a92aa;font-style:italic">Entre na fase uma vez para gerar o mapa antes de editar portas internas.</div>`;
          let h = '';
          (portas || []).forEach((p, i) => {
            h += `<div style="display:flex;gap:5px;align-items:center;margin-bottom:5px">
              <input id="avt-pi-nome-${i}" value="${(p.nome||('Porta '+(p.numero??i+2))).replace(/"/g,'&quot;')}" placeholder="Nome"
                style="flex:1;min-width:50px;background:rgba(255,255,255,0.04);border:1px solid rgba(168,120,255,0.25);border-radius:5px;color:#c8b8e8;font-size:0.66rem;padding:5px 7px;box-sizing:border-box">
              <input id="avt-pi-acol-${i}" type="number" value="${p.a?.col??0}" title="A coluna" style="width:46px;background:rgba(255,255,255,0.04);border:1px solid rgba(168,120,255,0.25);border-radius:5px;color:#c8b8e8;font-size:0.66rem;padding:5px 4px;text-align:center">
              <input id="avt-pi-arow-${i}" type="number" value="${p.a?.row??0}" title="A linha" style="width:46px;background:rgba(255,255,255,0.04);border:1px solid rgba(168,120,255,0.25);border-radius:5px;color:#c8b8e8;font-size:0.66rem;padding:5px 4px;text-align:center">
              <span style="color:#a878ff;font-size:0.7rem">↔</span>
              <input id="avt-pi-bcol-${i}" type="number" value="${p.b?.col??0}" title="B coluna" style="width:46px;background:rgba(255,255,255,0.04);border:1px solid rgba(168,120,255,0.25);border-radius:5px;color:#c8b8e8;font-size:0.66rem;padding:5px 4px;text-align:center">
              <input id="avt-pi-brow-${i}" type="number" value="${p.b?.row??0}" title="B linha" style="width:46px;background:rgba(255,255,255,0.04);border:1px solid rgba(168,120,255,0.25);border-radius:5px;color:#c8b8e8;font-size:0.66rem;padding:5px 4px;text-align:center">
              <button onclick="_avtMenuRemovePortaInterna('${faseId}',${i})" style="background:rgba(232,96,76,0.1);border:1px solid rgba(232,96,76,0.3);border-radius:5px;color:#e8604c;font-size:0.7rem;padding:3px 7px;cursor:pointer">✕</button>
            </div>`;
          });
          if (!(portas||[]).length) h += `<div style="font-size:0.62rem;color:#7a92aa;font-style:italic;margin-bottom:5px">Nenhuma porta interna.</div>`;
          h += `<button onclick="_avtMenuAddPortaInterna('${faseId}')" style="width:100%;background:rgba(168,120,255,0.1);border:1px solid rgba(168,120,255,0.3);border-radius:6px;color:#a878ff;font-size:0.64rem;padding:6px;cursor:pointer;font-family:var(--fonte-d)">＋ Adicionar porta interna</button>`;
          return h;
        })()}
        <div style="font-size:0.58rem;color:#7a92aa;margin-top:4px">O nome é único por par e se aplica às duas pontas (porta irmã).</div>
      </div>

      <div style="display:flex;gap:8px;margin-top:4px">
        <button onclick="_avtMenuAbrirFaseMestre()"
          style="flex:1;padding:9px;border-radius:7px;cursor:pointer;font-family:var(--fonte-d);font-size:0.68rem;background:none;border:1px solid rgba(122,146,170,0.2);color:#7a92aa">
          ← Cancelar
        </button>
        <button onclick="_avtMenuSalvarEditarFase('${faseId}')"
          style="flex:1;padding:9px;border-radius:7px;cursor:pointer;font-family:var(--fonte-d);font-size:0.68rem;background:rgba(79,163,209,0.12);border:1px solid rgba(79,163,209,0.4);color:#4fa3d1">
          ✓ Salvar
        </button>
      </div>
    </div>
  `;

  window._avtEditFaseLockAtual = f.porta?.lock_type || 'livre';
  _avtMenuAbrirPanel(html, `✏ Editar: ${f.nome||faseId}`);
}
window._avtMenuEditarFase = _avtMenuEditarFase;

function _avtMenuSetEditFaseLock(lockType) {
  window._avtEditFaseLockAtual = lockType;
  ['livre','chave','combate'].forEach(lt => {
    const btn = document.getElementById(`avt-edit-fase-lock-${lt}`);
    if (!btn) return;
    const ativo = lt === lockType;
    btn.style.background = `rgba(79,163,209,${ativo?'0.15':'0.04'})`;
    btn.style.borderColor = `rgba(79,163,209,${ativo?'0.5':'0.15'})`;
    btn.style.color = ativo ? '#4fa3d1' : '#7a92aa';
  });
}
window._avtMenuSetEditFaseLock = _avtMenuSetEditFaseLock;

// Lê as portas internas atualmente nos inputs do editor para o array da fase.
function _avtMenuLerPortasInternasEditor(fase) {
  if (!fase?.dungeon_data) return;
  const arr = [];
  for (let i = 0; ; i++) {
    const nomeEl = document.getElementById('avt-pi-nome-' + i);
    if (!nomeEl) break;
    const num = i + 2;
    arr.push({
      numero: num,
      nome: (nomeEl.value || ('Porta ' + num)).trim(),
      a: { col: parseInt(document.getElementById('avt-pi-acol-'+i)?.value||'0',10), row: parseInt(document.getElementById('avt-pi-arow-'+i)?.value||'0',10) },
      b: { col: parseInt(document.getElementById('avt-pi-bcol-'+i)?.value||'0',10), row: parseInt(document.getElementById('avt-pi-brow-'+i)?.value||'0',10) },
    });
  }
  fase.dungeon_data._portasInternas = arr;
}

function _avtMenuAddPortaInterna(faseId) {
  const fase = (AVT_STATE.rpg?.theme_json?.fases_extras || []).find(f => f.id === faseId);
  if (!fase?.dungeon_data) { mostrarToast('Entre na fase uma vez para gerar o mapa.', 'aviso'); return; }
  _avtMenuLerPortasInternasEditor(fase);
  if (!Array.isArray(fase.dungeon_data._portasInternas)) fase.dungeon_data._portasInternas = [];
  const num = fase.dungeon_data._portasInternas.length + 2;
  fase.dungeon_data._portasInternas.push({ numero: num, nome: 'Porta ' + num, a: { col: 1, row: 1 }, b: { col: 2, row: 2 } });
  _avtMenuEditarFase(faseId);
}
window._avtMenuAddPortaInterna = _avtMenuAddPortaInterna;

function _avtMenuRemovePortaInterna(faseId, idx) {
  const fase = (AVT_STATE.rpg?.theme_json?.fases_extras || []).find(f => f.id === faseId);
  if (!fase?.dungeon_data) return;
  _avtMenuLerPortasInternasEditor(fase);
  (fase.dungeon_data._portasInternas || []).splice(idx, 1);
  // Renumerar de 2 em diante
  (fase.dungeon_data._portasInternas || []).forEach((p, i) => {
    const oldName = p.nome, defName = 'Porta ' + (p.numero ?? i+2);
    p.numero = i + 2;
    if (!oldName || oldName === defName) p.nome = 'Porta ' + p.numero;
  });
  _avtMenuEditarFase(faseId);
}
window._avtMenuRemovePortaInterna = _avtMenuRemovePortaInterna;

async function _avtMenuSalvarEditarFase(faseId) {
  const nome = document.getElementById('avt-edit-fase-nome')?.value?.trim();
  const col  = parseInt(document.getElementById('avt-edit-fase-col')?.value || '0', 10);
  const row  = parseInt(document.getElementById('avt-edit-fase-row')?.value || '0', 10);
  const ordem = parseInt(document.getElementById('avt-edit-fase-ordem')?.value || '1', 10);
  const npcLvl = Math.max(1, parseInt(document.getElementById('avt-edit-fase-npclvl')?.value || '1', 10));
  const lockType = window._avtEditFaseLockAtual || 'livre';

  if (!nome) { mostrarToast('Nome obrigatório', 'aviso'); return; }

  const theme = AVT_STATE.rpg.theme_json;
  const fase = (theme.fases_extras || []).find(f => f.id === faseId);
  if (!fase) return;

  fase.nome = nome;
  fase.ordem = ordem;
  fase.npc_level = npcLvl;
  fase.porta = { ...(fase.porta || {}), lock_type: lockType, col, row };
  _avtMenuLerPortasInternasEditor(fase);
  if (fase.dungeon_data) fase.dungeon_data._npcLevel = npcLvl;

  try {
    await _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AVT_MENU_STATE.rpgId)}`,
      { method: 'PATCH', body: JSON.stringify({ theme_json: theme }) });
    mostrarToast('Fase atualizada!', 'ok');
  } catch(e) {
    mostrarToast('Erro ao salvar: ' + (e?.message || e), 'erro');
  }
  _avtMenuAbrirFaseMestre();
}
window._avtMenuSalvarEditarFase = _avtMenuSalvarEditarFase;

function _avtMenuSelecionarFase(faseId) {
  _avtMenuAbrirPanel(_avtMenuHtmlSeletorChar('_avtMenuEntrarFaseComChar', faseId), 'Selecionar Personagem');
}
window._avtMenuSelecionarFase = _avtMenuSelecionarFase;

function _avtMenuEntrarFaseComChar(charNome, faseId) {
  _avtMenuEntrarJogo({ charNome, faseId });
}
window._avtMenuEntrarFaseComChar = _avtMenuEntrarFaseComChar;

function _avtMenuListarFases() {
  const fases = [{ id: 'principal', nome: '🏰 Fase Principal' }];
  const extras = AVT_STATE.rpg?.theme_json?.fases_extras || [];
  extras.forEach(f => fases.push({ id: f.id, nome: f.nome || f.id }));
  return fases;
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSONAGEM — painel de gerenciamento sem entrar no jogo
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuAbrirPersonagem() {
  const chars = _avtMenuCharsVisiveis();
  const html = `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${chars.map(ch => {
        const ca = ch.custom_attrs || {};
        const cor = ca.cor || '#4fa3d1';
        return `
          <div style="display:flex;align-items:center;gap:12px;background:rgba(79,163,209,0.05);border:1px solid rgba(79,163,209,0.15);border-radius:8px;padding:12px 14px">
            <div style="width:36px;height:36px;border-radius:50%;background:${cor};display:flex;align-items:center;justify-content:center;font-size:1rem;color:#fff;flex-shrink:0">${(ch.nome||'?')[0].toUpperCase()}</div>
            <div style="flex:1">
              <div style="font-family:var(--fonte-d);font-size:0.78rem;color:#c8d8e8">${ch.nome}</div>
              <div style="font-size:0.62rem;color:#7a92aa;margin-top:2px">${ca.classe||''} ${ca.raca ? '· '+ca.raca : ''} · Nv ${ch.nivel||1}</div>
            </div>
            <button onclick="_avtMenuEditarChar('${ch.id}','${ch.nome.replace(/'/g,"\\'")}')" style="background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#4fa3d1;font-family:var(--fonte-d);font-size:0.6rem;padding:4px 10px;cursor:pointer">Editar</button>
          </div>
        `;
      }).join('')}
      <button onclick="_avtMenuCriarPersonagem()" style="background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.3);border-radius:8px;padding:12px;cursor:pointer;color:#c8a84b;font-family:var(--fonte-d);font-size:0.72rem;letter-spacing:.06em;text-align:center;width:100%">+ Novo Personagem</button>
    </div>
  `;
  _avtMenuAbrirPanel(html, 'Personagens');
}
window._avtMenuAbrirPersonagem = _avtMenuAbrirPersonagem;

function _avtMenuEditarChar(charId, charNome) {
  // Injeta entidade stub para o editor de personagem funcionar fora do jogo
  const tempId = 'menu-temp-' + charId;
  if (!AVT_STATE.entidades.find(e => e.id === tempId)) {
    const dbChar = (AVT_STATE.chars || []).find(c => c.id === charId) || {};
    const ca = dbChar.custom_attrs || {};
    AVT_STATE.entidades.push({
      id: tempId, dbId: charId, nome: charNome, tipo: 'jogador',
      hp: dbChar.hp_atual || 100, hpMax: _avtCalcHpJog(dbChar) || 100,
      nivel: dbChar.nivel || 1, x: 0, y: 0, cor: ca.cor || '#4fa3d1',
      custom_attrs: ca,
    });
  }
  if (typeof abrirAvtCharEditor === 'function') abrirAvtCharEditor(tempId);
}
window._avtMenuEditarChar = _avtMenuEditarChar;

async function _avtMenuCriarPersonagem() {
  const nome = prompt('Nome do novo personagem:');
  if (!nome || !nome.trim()) return;
  try {
    const uid = SESSION?.user?.id;
    const nick = SESSION?.user?.email || SESSION?.nickname || 'Jogador';
    const novoChar = {
      rpg_id: AVT_MENU_STATE.rpgId,
      nome: nome.trim(),
      hp_atual: 100, hp_max: 100, xp: 0, nivel: 1, pontos_attr: 0,
      custom_attrs: { tipo: 'jogador', cor: '#4fa3d1' }
    };
    const res = await _avtSb('characters', { method: 'POST', body: JSON.stringify(novoChar) });
    // Atribuir ao usuário
    if (uid) {
      await _avtSb(`rpg_members?rpg_id=eq.${encodeURIComponent(AVT_MENU_STATE.rpgId)}&player_id=eq.${encodeURIComponent(uid)}`,
        { method: 'PATCH', body: JSON.stringify({ linked: nome.trim() }) });
    }
    // Recarregar chars
    const chars = await _avtSb(`characters?rpg_id=eq.${encodeURIComponent(AVT_MENU_STATE.rpgId)}&select=*&order=nome`);
    if (chars) AVT_STATE.chars = chars;
    mostrarToast(`Personagem "${nome.trim()}" criado!`, 'ok');
    _avtMenuAbrirPersonagem();
  } catch(e) {
    mostrarToast('Erro ao criar personagem: ' + (e?.message || e), 'erro');
  }
}
window._avtMenuCriarPersonagem = _avtMenuCriarPersonagem;

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuAbrirConfig() {
  if (AVT_STATE.isMestre) {
    _avtMenuAbrirConfigMestre(AVT_MENU_STATE.configAba || 'menu');
  } else {
    _avtMenuAbrirPanel(_avtMenuHtmlConfigJogador(), '⚙ Configurações');
    _avtMenuBindColorPicker();
  }
}
window._avtMenuAbrirConfig = _avtMenuAbrirConfig;

function _avtMenuAbrirConfigMestre(aba) {
  AVT_MENU_STATE.configAba = aba;
  const abas = [
    { id: 'menu',          label: '🖼 Menu' },
    { id: 'combate',       label: '⚔ Combate' },
    { id: 'balanceamento', label: '⚖ Balanço' },
    { id: 'npcs',          label: '🤖 NPCs' },
    { id: 'loot_xp',       label: '📊 XP' },
    { id: 'mapa',          label: '🗺 Mapa' },
    { id: 'fases',         label: '🚪 Fases' },
    { id: 'campanha',      label: '🏰 Campanha' },
    { id: 'jogadores',     label: '👥 Jogadores' },
    { id: 'personagens',   label: '👤 Personagens' },
    { id: 'jogador',       label: '🎮 Player' },
    { id: 'graficos',      label: '🎨 Gráficos' },
    { id: 'controles',     label: '🎮 Controles' },
  ];

  const tabBar = `
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px">
      ${abas.map(a => `
        <button onclick="_avtMenuAbrirConfigMestre('${a.id}')"
          style="padding:5px 10px;border-radius:6px;cursor:pointer;font-family:var(--fonte-d);font-size:0.6rem;letter-spacing:.05em;white-space:nowrap;
            background:rgba(79,163,209,${aba===a.id?'0.15':'0.05'});
            border:1px solid rgba(79,163,209,${aba===a.id?'0.5':'0.18'});
            color:${aba===a.id?'#4fa3d1':'#7a92aa'}">
          ${a.label}
        </button>
      `).join('')}
    </div>
  `;

  const content = _avtMenuConfigConteudoAba(aba);
  _avtMenuAbrirPanel(tabBar + content, '⚙ Configurações');

  if (aba === 'menu') _avtMenuBindColorPicker();
}
window._avtMenuAbrirConfigMestre = _avtMenuAbrirConfigMestre;

function _avtMenuConfigConteudoAba(aba) {
  if (aba === 'menu') {
    const t = AVT_STATE.rpg?.theme_json || {};
    return `
      <div style="margin-bottom:20px">
        <div style="font-family:var(--fonte-d);font-size:0.65rem;color:rgba(200,168,75,0.7);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px">⚙ Aparência do Menu</div>

        <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Imagem de fundo (URL)</label>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <input id="avt-cfg-menu-img" type="url" placeholder="https://..." value="${t.menu_img_url||''}"
            style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.7rem;padding:6px 10px;font-family:inherit">
          <button onclick="_avtMenuUploadImagem()" style="background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#4fa3d1;font-size:0.65rem;padding:6px 10px;cursor:pointer;white-space:nowrap">📁 Upload</button>
        </div>

        <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Cor do tema</label>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <input id="avt-cfg-menu-color" type="color" value="${t.menu_theme_color||'#050810'}"
            style="width:40px;height:32px;border:none;border-radius:6px;cursor:pointer;background:none">
          <span id="avt-cfg-menu-color-val" style="font-size:0.68rem;color:#7a92aa">${t.menu_theme_color||'#050810'}</span>
        </div>

        <div style="font-family:var(--fonte-d);font-size:0.65rem;color:rgba(200,168,75,0.7);text-transform:uppercase;letter-spacing:.08em;margin:18px 0 12px;border-top:1px solid rgba(79,163,209,0.12);padding-top:14px">🗺 Grade do Mapa</div>

        <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Cor das linhas</label>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <input id="avt-cfg-grid-color" type="color" value="${t.grid_cor||'#ffffff'}"
            style="width:40px;height:32px;border:none;border-radius:6px;cursor:pointer;background:none">
          <span id="avt-cfg-grid-color-val" style="font-size:0.68rem;color:#7a92aa">${t.grid_cor||'#ffffff'}</span>
        </div>

        <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Opacidade das linhas</label>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
          <input id="avt-cfg-grid-op" type="range" min="0" max="0.5" step="0.01" value="${t.grid_opacidade ?? 0.09}"
            style="flex:1;cursor:pointer;accent-color:#c8a84b">
          <span id="avt-cfg-grid-op-val" style="font-size:0.68rem;color:#7a92aa;min-width:34px;text-align:right">${(t.grid_opacidade ?? 0.09).toFixed(2)}</span>
        </div>
        <div style="font-size:0.62rem;color:#5a6b7a;margin-bottom:16px">Opacidade 0 = grade invisível (campo sem separação por células).</div>

        <button onclick="_avtMenuSalvarConfigMestre()" style="background:rgba(200,168,75,0.12);border:1px solid rgba(200,168,75,0.4);border-radius:7px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.7rem;padding:8px 20px;cursor:pointer;letter-spacing:.06em;text-transform:uppercase;width:100%">Salvar</button>
      </div>
    `;
  }

  if (aba === 'jogador') {
    return _avtMenuHtmlConfigJogador();
  }

  if (aba === 'graficos') {
    return _avtMenuHtmlGraficos();
  }

  if (aba === 'controles') {
    return _avtMenuHtmlControles();
  }

  // Abas do painel do mestre: reutiliza _avtMpConteudoAba()
  if (typeof _avtMpConteudoAba !== 'function') {
    return '<p style="color:#7a92aa;font-size:0.72rem">Módulo do mestre não carregado.</p>';
  }
  const prevAba = AVT_STATE.mestrePainelAba;
  AVT_STATE.mestrePainelAba = aba;
  const html = _avtMpConteudoAba();
  AVT_STATE.mestrePainelAba = prevAba;
  return html;
}
window._avtMenuConfigConteudoAba = _avtMenuConfigConteudoAba;

function _avtMenuHtmlConfigJogador() {
  const sd = AVT_MENU_STATE.sessionData || {};
  const mp = sd.music_pref || { mode: 'auto' };
  const mb = sd.mobile_pref || { tipo: 'dispositivo', posicao: 'centralizado' };

  const modosMusica = [
    { id: 'auto',   label: '🔀 Automático',    sub: 'Seleção automática do sistema' },
    { id: 'master', label: '🎵 Seguir Mestre',  sub: 'Usa a seleção definida pelo mestre' },
    { id: 'custom', label: '🎶 Personalizar',   sub: 'Escolha suas trilhas' },
  ];

  const trilhasCustom = `
    <div id="avt-cfg-trilhas" style="display:${mp.mode==='custom' ? 'block' : 'none'};margin-top:12px;background:rgba(79,163,209,0.03);border:1px solid rgba(79,163,209,0.1);border-radius:8px;padding:12px">
      ${['exploracao','combate','boss'].map(ctx => {
        const tracks = DEFAULT_SOUNDTRACKS?.[ctx] || [];
        const sel = (mp.tracks || {})[ctx+'_url'] || '';
        return `
          <div style="margin-bottom:10px">
            <label style="display:block;font-size:0.62rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">${ctx}</label>
            <select id="avt-cfg-track-${ctx}" style="width:100%;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.68rem;padding:5px 8px">
              <option value="">— padrão —</option>
              ${tracks.map(tr => `<option value="${tr.url}" ${sel===tr.url?'selected':''}>${tr.label}</option>`).join('')}
            </select>
          </div>
        `;
      }).join('')}
    </div>
  `;

  return `
    <div style="margin-bottom:20px">
      <div style="font-family:var(--fonte-d);font-size:0.65rem;color:rgba(79,163,209,0.7);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">🎵 Música</div>
      <div style="display:flex;flex-direction:column;gap:6px" id="avt-cfg-musica-opts">
        ${modosMusica.map(m => `
          <button onclick="_avtMenuSelecionarMusicaMode('${m.id}')"
            id="avt-cfg-music-${m.id}"
            style="display:flex;align-items:center;gap:10px;background:rgba(79,163,209,${mp.mode===m.id?'0.12':'0.04'});border:1px solid rgba(79,163,209,${mp.mode===m.id?'0.45':'0.15'});border-radius:8px;padding:10px 14px;cursor:pointer;text-align:left;width:100%">
            <div style="flex:1">
              <div style="font-size:0.75rem;color:#c8d8e8;font-family:var(--fonte-d)">${m.label}</div>
              <div style="font-size:0.6rem;color:#7a92aa;margin-top:2px">${m.sub}</div>
            </div>
            ${mp.mode===m.id ? '<span style="color:#4fa3d1;font-size:0.7rem">✓</span>' : ''}
          </button>
        `).join('')}
      </div>
      ${trilhasCustom}
    </div>

    <div style="border-top:1px solid rgba(79,163,209,0.1);margin-bottom:16px"></div>

    <div style="margin-bottom:20px">
      <div style="font-family:var(--fonte-d);font-size:0.65rem;color:rgba(79,163,209,0.7);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">🎮 Controle Mobile</div>

      <div style="margin-bottom:8px">
        <div style="font-size:0.62rem;color:#7a92aa;margin-bottom:6px">Dispositivo</div>
        <div style="display:flex;gap:8px">
          ${['dispositivo','tv'].map(t2 => `
            <button onclick="_avtMenuSetMobilePref('tipo','${t2}')"
              id="avt-cfg-mobile-tipo-${t2}"
              style="flex:1;padding:8px;border-radius:7px;cursor:pointer;font-size:0.7rem;font-family:var(--fonte-d);
                background:rgba(79,163,209,${mb.tipo===t2?'0.12':'0.04'});
                border:1px solid rgba(79,163,209,${mb.tipo===t2?'0.45':'0.15'});
                color:${mb.tipo===t2?'#4fa3d1':'#7a92aa'}">
              ${t2==='dispositivo' ? '📱 No dispositivo' : '📺 Na TV'}
            </button>
          `).join('')}
        </div>
      </div>

      <div>
        <div style="font-size:0.62rem;color:#7a92aa;margin-bottom:6px">Posição do D-pad</div>
        <div style="display:flex;gap:8px">
          ${['centralizado','deadzone'].map(p => `
            <button onclick="_avtMenuSetMobilePref('posicao','${p}')"
              id="avt-cfg-mobile-pos-${p}"
              style="flex:1;padding:8px;border-radius:7px;cursor:pointer;font-size:0.7rem;font-family:var(--fonte-d);
                background:rgba(79,163,209,${mb.posicao===p?'0.12':'0.04'});
                border:1px solid rgba(79,163,209,${mb.posicao===p?'0.45':'0.15'});
                color:${mb.posicao===p?'#4fa3d1':'#7a92aa'}">
              ${p==='centralizado' ? '⊕ Centralizado' : '↔ Dead Zone'}
            </button>
          `).join('')}
        </div>
      </div>
    </div>

    <div style="border-top:1px solid rgba(79,163,209,0.1);margin-bottom:16px"></div>

    ${_avtMenuHtmlGraficos()}

    <div style="border-top:1px solid rgba(79,163,209,0.1);margin-bottom:16px"></div>

    ${_avtMenuHtmlControles()}

    <button onclick="_avtMenuSalvarConfigJogador()" style="background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.35);border-radius:7px;color:#4fa3d1;font-family:var(--fonte-d);font-size:0.7rem;padding:8px 20px;cursor:pointer;letter-spacing:.06em;text-transform:uppercase;width:100%">Salvar Configurações</button>
  `;
}

function _avtMenuBindColorPicker() {
  setTimeout(() => {
    const colorInp = document.getElementById('avt-cfg-menu-color');
    if (colorInp) {
      colorInp.addEventListener('input', () => {
        const val = document.getElementById('avt-cfg-menu-color-val');
        if (val) val.textContent = colorInp.value;
      });
    }
    const gridColorInp = document.getElementById('avt-cfg-grid-color');
    if (gridColorInp) {
      gridColorInp.addEventListener('input', () => {
        const val = document.getElementById('avt-cfg-grid-color-val');
        if (val) val.textContent = gridColorInp.value;
      });
    }
    const gridOpInp = document.getElementById('avt-cfg-grid-op');
    if (gridOpInp) {
      gridOpInp.addEventListener('input', () => {
        const val = document.getElementById('avt-cfg-grid-op-val');
        if (val) val.textContent = parseFloat(gridOpInp.value).toFixed(2);
      });
    }
  }, 50);
}

function _avtMenuSelecionarMusicaMode(modo) {
  const sd = AVT_MENU_STATE.sessionData || {};
  sd.music_pref = sd.music_pref || {};
  sd.music_pref.mode = modo;
  AVT_MENU_STATE.sessionData = sd;
  const trilhas = document.getElementById('avt-cfg-trilhas');
  if (trilhas) trilhas.style.display = modo === 'custom' ? 'block' : 'none';
  ['auto','master','custom'].forEach(m => {
    const btn = document.getElementById(`avt-cfg-music-${m}`);
    if (!btn) return;
    const ativo = m === modo;
    btn.style.background = `rgba(79,163,209,${ativo?'0.12':'0.04'})`;
    btn.style.borderColor = `rgba(79,163,209,${ativo?'0.45':'0.15'})`;
  });
}
window._avtMenuSelecionarMusicaMode = _avtMenuSelecionarMusicaMode;

function _avtMenuSetMobilePref(chave, valor) {
  const sd = AVT_MENU_STATE.sessionData || {};
  sd.mobile_pref = sd.mobile_pref || {};
  sd.mobile_pref[chave] = valor;
  AVT_MENU_STATE.sessionData = sd;
  const grupo = chave === 'tipo' ? ['dispositivo','tv'] : ['centralizado','deadzone'];
  const prefixo = chave === 'tipo' ? 'avt-cfg-mobile-tipo-' : 'avt-cfg-mobile-pos-';
  grupo.forEach(v => {
    const btn = document.getElementById(prefixo + v);
    if (!btn) return;
    const ativo = v === valor;
    btn.style.background = `rgba(79,163,209,${ativo?'0.12':'0.04'})`;
    btn.style.borderColor = `rgba(79,163,209,${ativo?'0.45':'0.15'})`;
    btn.style.color = ativo ? '#4fa3d1' : '#7a92aa';
  });
}
window._avtMenuSetMobilePref = _avtMenuSetMobilePref;

async function _avtMenuSalvarConfigMestre() {
  if (!AVT_STATE.isMestre) return;
  const imgUrl   = document.getElementById('avt-cfg-menu-img')?.value || '';
  const color    = document.getElementById('avt-cfg-menu-color')?.value || '';
  const gridCor  = document.getElementById('avt-cfg-grid-color')?.value || '#ffffff';
  const gridOpEl = document.getElementById('avt-cfg-grid-op');
  const gridOp   = gridOpEl ? parseFloat(gridOpEl.value) : 0.09;
  try {
    const themeAtual = AVT_STATE.rpg?.theme_json || {};
    const novoTheme = { ...themeAtual, menu_img_url: imgUrl, menu_theme_color: color, grid_cor: gridCor, grid_opacidade: gridOp };
    await _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AVT_MENU_STATE.rpgId)}`,
      { method: 'PATCH', body: JSON.stringify({ theme_json: novoTheme }) });
    AVT_STATE.rpg.theme_json = novoTheme;
    // Atualizar menu visualmente
    const bgEl = document.getElementById('avt-menu-bg-img');
    if (bgEl) { bgEl.style.backgroundImage = imgUrl ? `url("${imgUrl}")` : 'none'; bgEl.style.display = imgUrl ? 'block' : 'none'; }
    const sc = document.getElementById('avt-menu-screen');
    if (sc && color) sc.style.background = color;
    mostrarToast('Config do mestre salva!', 'ok');
  } catch(e) { mostrarToast('Erro ao salvar: ' + (e?.message||e), 'erro'); }
}
window._avtMenuSalvarConfigMestre = _avtMenuSalvarConfigMestre;

async function _avtMenuSalvarConfigJogador() {
  const sd = AVT_MENU_STATE.sessionData || {};

  // Coletar seleções de trilhas custom
  if ((sd.music_pref || {}).mode === 'custom') {
    sd.music_pref.tracks = sd.music_pref.tracks || {};
    ['exploracao','combate','boss'].forEach(ctx => {
      const sel = document.getElementById(`avt-cfg-track-${ctx}`);
      if (sel) sd.music_pref.tracks[ctx+'_url'] = sel.value;
    });
  }

  AVT_MENU_STATE.sessionData = sd;
  await _avtMenuSalvarSessionData(sd);

  // Aplicar controle mobile imediatamente se disponível
  const mb = sd.mobile_pref || {};
  if (typeof MOBILE_CTRL !== 'undefined') {
    if (mb.tipo)    MOBILE_CTRL.modoTela   = mb.tipo;
    if (mb.posicao) MOBILE_CTRL.modoCamara = mb.posicao === 'deadzone' ? 'deadzone' : 'centralizada';
  }
  mostrarToast('Configurações salvas!', 'ok');
}
window._avtMenuSalvarConfigJogador = _avtMenuSalvarConfigJogador;

async function _avtMenuUploadImagem() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    mostrarToast('Upload de imagem não suportado diretamente — use uma URL pública', 'aviso', 4000);
  };
  input.click();
}
window._avtMenuUploadImagem = _avtMenuUploadImagem;

// ─────────────────────────────────────────────────────────────────────────────
// GUIA
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuAbrirGuia() {
  const html = `
    <div style="font-family:var(--fonte-d);color:#c8d8e8;display:flex;flex-direction:column;gap:20px;max-width:600px">

      <section>
        <div style="font-size:0.65rem;color:#c8a84b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">🎮 Movimento</div>
        <p style="font-size:0.72rem;color:#7a92aa;line-height:1.6">Use <b style="color:#c8d8e8">WASD</b> ou as <b style="color:#c8d8e8">setas do teclado</b> para mover seu personagem pelo dungeon. No celular, use o <b style="color:#c8d8e8">D-pad</b> que aparece na tela. Clique em qualquer ponto do mapa para mover até lá.</p>
      </section>

      <section>
        <div style="font-size:0.65rem;color:#c8a84b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">⚔ Combate</div>
        <p style="font-size:0.72rem;color:#7a92aa;line-height:1.6">Ao se aproximar de um inimigo, ele ficará em <b style="color:#c8d8e8">modo de alerta</b>. Se a paciência dele acabar, ele inicia <b style="color:#c8d8e8">perseguição</b>. Quando próximo, aparecerá um convite de combate. Aceite para entrar no modo de <b style="color:#c8d8e8">turno por turno</b>.</p>
      </section>

      <section>
        <div style="font-size:0.65rem;color:#c8a84b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">💫 Skills e Cooldowns</div>
        <p style="font-size:0.72rem;color:#7a92aa;line-height:1.6">Durante o combate, você verá suas <b style="color:#c8d8e8">habilidades</b> disponíveis. Cada habilidade tem um <b style="color:#c8d8e8">cooldown</b> medido em turnos. Habilidades em cooldown aparecem com contador.</p>
      </section>

      <section>
        <div style="font-size:0.65rem;color:#c8a84b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">🗺 Fases e Portais</div>
        <p style="font-size:0.72rem;color:#7a92aa;line-height:1.6">Portas especiais levam a <b style="color:#c8d8e8">fases adicionais</b>. Cada fase tem seus próprios inimigos e recompensas. Use <b style="color:#c8d8e8">saídas</b> marcadas no mapa para retornar à fase anterior.</p>
      </section>

      <section>
        <div style="font-size:0.65rem;color:#c8a84b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">❤ HP, Mana e XP</div>
        <p style="font-size:0.72rem;color:#7a92aa;line-height:1.6">Seu <b style="color:#c8d8e8">HP</b> regenera lentamente fora de combate. A <b style="color:#c8d8e8">Mana</b> é consumida por habilidades especiais e também regenera. Derrotar inimigos concede <b style="color:#c8d8e8">XP</b> para ganhar níveis e pontos de atributo.</p>
      </section>

      <section>
        <div style="font-size:0.65rem;color:#c8a84b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">🌐 Host</div>
        <p style="font-size:0.72rem;color:#7a92aa;line-height:1.6">O <b style="color:#c8d8e8">host</b> é o jogador que coordena a sessão. Geralmente é o primeiro a entrar ou aquele que clica em "Iniciar como Host". Ao mudar de fase, pode ser necessário eleger um novo host para aquela fase.</p>
      </section>

    </div>
  `;
  _avtMenuAbrirPanel(html, '📖 Guia do Jogo');
}
window._avtMenuAbrirGuia = _avtMenuAbrirGuia;

// ─────────────────────────────────────────────────────────────────────────────
// STUDIO PIXI
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuAbrirPixiStudio() {
  const menu = document.getElementById('avt-menu-screen');
  if (menu) menu.style.display = 'none';
  const scr = document.getElementById('pixi-studio-screen');
  if (scr) scr.style.display = 'flex';
  if (typeof PIXI_STUDIO_STATE !== 'undefined') PIXI_STUDIO_STATE._origin = 'aventura';
  if (typeof pixiStudioInit === 'function') pixiStudioInit();
}
window._avtMenuAbrirPixiStudio = _avtMenuAbrirPixiStudio;

// ─────────────────────────────────────────────────────────────────────────────
// ENTRAR NO JOGO
// ─────────────────────────────────────────────────────────────────────────────

async function _avtMenuEntrarJogo({ charNome, faseId }) {
  try {
    const rpgId = AVT_MENU_STATE.rpgId;
    if (!rpgId) { mostrarToast('Sem aventura carregada', 'erro'); return; }

    mostrarLoading('Iniciando…');

    // Salvar sessão
    await _avtMenuSalvarSessionData({
      last_char_nome: charNome,
      last_fase_id: faseId || 'principal',
    });

    // Vincular personagem
    if (charNome) {
      const uid = SESSION?.user?.id;
      if (AVT_STATE.isMestre) {
        AVT_STATE.mestreAtivo = true;
      } else if (uid) {
        await _avtSb(
          `rpg_members?rpg_id=eq.${encodeURIComponent(rpgId)}&player_id=eq.${encodeURIComponent(uid)}`,
          { method: 'PATCH', body: JSON.stringify({ linked: charNome }) }
        ).catch(() => {});
      }
      AVT_STATE.myCharNome = charNome;
    }

    // Aplicar preferências de controle mobile
    const mb = (AVT_MENU_STATE.sessionData || {}).mobile_pref || {};
    if (typeof MOBILE_CTRL !== 'undefined') {
      if (mb.tipo)    MOBILE_CTRL.modoTela   = mb.tipo;
      if (mb.posicao) MOBILE_CTRL.modoCamara = mb.posicao === 'deadzone' ? 'deadzone' : 'centralizada';
    }

    // Aplicar preferência de música
    const mp = (AVT_MENU_STATE.sessionData || {}).music_pref || {};
    if (typeof AudioManager !== 'undefined' && mp.mode && mp.mode !== 'auto') {
      window._avtMenuPlayerMusicPref = mp;
      if (mp.mode === 'custom' && mp.tracks) {
        AudioManager.setPlayerPref(mp);
      }
    } else {
      delete window._avtMenuPlayerMusicPref;
    }

    _avtMostrarAventuraScreen();

    // Se há fase específica não-principal, entrar depois do canvas
    const faseAlvo = faseId && faseId !== 'principal' ? faseId : null;

    _avtIniciarRTNet(rpgId, () => {
      _avtIniciarCanvas();
      if (faseAlvo) {
        setTimeout(() => {
          if (typeof _avtIrParaFase === 'function') _avtIrParaFase(faseAlvo);
        }, 800);
      }
    });

  } catch(e) {
    ocultarLoading();
    mostrarToast('Erro ao entrar: ' + (e?.message || e), 'erro');
  }
}
window._avtMenuEntrarJogo = _avtMenuEntrarJogo;

// ─────────────────────────────────────────────────────────────────────────────
// SELETOR DE PERSONAGEM
// ─────────────────────────────────────────────────────────────────────────────

function _avtMenuCharsVisiveis() {
  const allChars = (AVT_STATE.chars || []).filter(c => (c.custom_attrs?.tipo || 'jogador') === 'jogador');
  if (AVT_STATE.isMestre) return allChars;
  const uid = SESSION?.user?.id;
  const linked = (AVT_STATE.membros || []).filter(m => m.player_id === uid).map(m => m.linked).filter(Boolean);
  if (linked.length > 0) return allChars.filter(c => linked.includes(c.nome));
  return allChars; // sem vinculação: mostra todos
}

function _avtMenuHtmlSeletorChar(fnCallback, extraParam?) {
  const chars = _avtMenuCharsVisiveis();
  if (chars.length === 0) {
    return '<p style="color:#7a92aa;font-size:0.72rem">Nenhum personagem disponível. Crie um na opção Personagem.</p>';
  }
  const extraArg = extraParam ? `,'${extraParam}'` : '';
  return `
    <div style="display:flex;flex-direction:column;gap:8px">
      ${chars.map(ch => {
        const ca = ch.custom_attrs || {};
        const cor = ca.cor || '#4fa3d1';
        return `
          <button onclick="${fnCallback}('${ch.nome}'${extraArg})"
            style="display:flex;align-items:center;gap:12px;background:rgba(79,163,209,0.05);border:1px solid rgba(79,163,209,0.18);border-radius:8px;padding:12px 14px;cursor:pointer;text-align:left;width:100%;transition:background .15s"
            onmouseover="this.style.background='rgba(79,163,209,0.1)'" onmouseout="this.style.background='rgba(79,163,209,0.05)'">
            <div style="width:38px;height:38px;border-radius:50%;background:${cor};display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#fff;flex-shrink:0">${(ch.nome||'?')[0].toUpperCase()}</div>
            <div style="flex:1">
              <div style="font-family:var(--fonte-d);font-size:0.8rem;color:#c8d8e8">${ch.nome}</div>
              <div style="font-size:0.62rem;color:#7a92aa;margin-top:2px">${ca.classe||'Aventureiro'} · Nv ${ch.nivel||1} · ${ch.hp_atual||100}/${_avtCalcHpJog(ch)||100} HP</div>
            </div>
            <span style="color:#4fa3d1;font-size:0.8rem">›</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTÊNCIA (session_data via rpg_members)
// ─────────────────────────────────────────────────────────────────────────────

async function _avtMenuCarregarSessionData(rpgId) {
  const uid = SESSION?.user?.id;
  if (!uid) return {};
  try {
    const rows = await _avtSb(
      `rpg_members?rpg_id=eq.${encodeURIComponent(rpgId)}&player_id=eq.${encodeURIComponent(uid)}&select=session_data`
    );
    return rows?.[0]?.session_data || {};
  } catch(_) { return {}; }
}

async function _avtMenuSalvarSessionData(patch) {
  const uid   = SESSION?.user?.id;
  const rpgId = AVT_MENU_STATE.rpgId;
  if (!uid || !rpgId) return;
  clearTimeout(AVT_MENU_STATE._saveTimer);
  AVT_MENU_STATE._saveTimer = setTimeout(async () => {
    try {
      const cur = AVT_MENU_STATE.sessionData || {};
      const upd = { ...cur, ...patch };
      AVT_MENU_STATE.sessionData = upd;
      await _avtSb(
        `rpg_members?rpg_id=eq.${encodeURIComponent(rpgId)}&player_id=eq.${encodeURIComponent(uid)}`,
        { method: 'PATCH', body: JSON.stringify({ session_data: upd }) }
      );
    } catch(_) {}
  }, 300);
}
window._avtMenuSalvarSessionData = _avtMenuSalvarSessionData;

// Handler global para avt_fase_mudou — DESATIVADO: trocar de fase é local e não deve
// arrastar outros jogadores nem forçá-los a uma sala de espera (isolamento por fase).
window.avtReceberFaseMudou = function(_payload) { /* no-op: fases são por jogador */ };

// Presença leve: registra em que fase cada jogador está (apenas informativo).
function _avtMenuBindFaseMudouHandler() {
  if (typeof RTNet === 'undefined' || typeof RTNet.on !== 'function') {
    setTimeout(_avtMenuBindFaseMudouHandler, 600);
    return;
  }
  RTNet.on('avt_fase_presenca', (payload) => {
    try {
      if (!payload?.nome) return;
      if (typeof AVT_STATE !== 'undefined') {
        AVT_STATE._fasePresenca = (AVT_STATE as any)._fasePresenca || {};
        (AVT_STATE as any)._fasePresenca[payload.nome] = payload.faseId || 'principal';
        // Se EU sou o host desta fase, reafirmo na hora para o recém-chegado saber
        // rapidamente que já há host (evita prompt duplicado de "ser host").
        const fid = payload.faseId || 'principal';
        if (((AVT_STATE as any)._faseHosts || {})[fid] === (window._avtMeuUid && window._avtMeuUid())
            && typeof window._avtReafirmarHostFase === 'function') {
          window._avtReafirmarHostFase(fid);
        }
      }
    } catch(_) {}
  });
}
_avtMenuBindFaseMudouHandler();

/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "AVT_MENU_STATE", { configurable: true, get: () => AVT_MENU_STATE, set: (__v) => { AVT_MENU_STATE = __v; } });
Object.defineProperty(globalThis, "AVT_GRAFICOS", { configurable: true, get: () => AVT_GRAFICOS, set: (__v) => { AVT_GRAFICOS = __v; } });
Object.defineProperty(globalThis, "_AVT_GRAFICOS_KEY", { configurable: true, get: () => _AVT_GRAFICOS_KEY });
Object.defineProperty(globalThis, "_ISO_BASE_ANGLE_X", { configurable: true, get: () => _ISO_BASE_ANGLE_X });
Object.defineProperty(globalThis, "_ISO_BASE_SCALE", { configurable: true, get: () => _ISO_BASE_SCALE });
Object.defineProperty(globalThis, "_ISO_ANGLE_X", { configurable: true, get: () => _ISO_ANGLE_X, set: (__v) => { _ISO_ANGLE_X = __v; } });
Object.defineProperty(globalThis, "_ISO_SCALE", { configurable: true, get: () => _ISO_SCALE, set: (__v) => { _ISO_SCALE = __v; } });
Object.defineProperty(globalThis, "_ISO_OVERSIZE", { configurable: true, get: () => _ISO_OVERSIZE });
Object.defineProperty(globalThis, "_ISO_BB", { configurable: true, get: () => _ISO_BB, set: (__v) => { _ISO_BB = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtIsoParamsAtualizar", { configurable: true, get: () => _avtIsoParamsAtualizar, set: (__v) => { _avtIsoParamsAtualizar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtVfxOverlayResolution", { configurable: true, get: () => _avtVfxOverlayResolution, set: (__v) => { _avtVfxOverlayResolution = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtGraficosCarregar", { configurable: true, get: () => _avtGraficosCarregar, set: (__v) => { _avtGraficosCarregar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtGraficosSalvar", { configurable: true, get: () => _avtGraficosSalvar, set: (__v) => { _avtGraficosSalvar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtGarantirFiltros3D", { configurable: true, get: () => _avtGarantirFiltros3D, set: (__v) => { _avtGarantirFiltros3D = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtGraficosIsoAplicar", { configurable: true, get: () => _avtGraficosIsoAplicar, set: (__v) => { _avtGraficosIsoAplicar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtAtmosferaAplicar", { configurable: true, get: () => _avtAtmosferaAplicar, set: (__v) => { _avtAtmosferaAplicar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtIsoLayoutAplicar", { configurable: true, get: () => _avtIsoLayoutAplicar, set: (__v) => { _avtIsoLayoutAplicar = __v; } });
Object.defineProperty(globalThis, "_avtIsoResizing", { configurable: true, get: () => _avtIsoResizing, set: (__v) => { _avtIsoResizing = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtIsoSizeWrap", { configurable: true, get: () => _avtIsoSizeWrap, set: (__v) => { _avtIsoSizeWrap = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtIsoScreenToCanvas", { configurable: true, get: () => _avtIsoScreenToCanvas, set: (__v) => { _avtIsoScreenToCanvas = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtIsoDeltaToCanvas", { configurable: true, get: () => _avtIsoDeltaToCanvas, set: (__v) => { _avtIsoDeltaToCanvas = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtIsoDeltaToScreen", { configurable: true, get: () => _avtIsoDeltaToScreen, set: (__v) => { _avtIsoDeltaToScreen = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtIsoCanvasToScreen", { configurable: true, get: () => _avtIsoCanvasToScreen, set: (__v) => { _avtIsoCanvasToScreen = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtIsoBillboardAplicar", { configurable: true, get: () => _avtIsoBillboardAplicar, set: (__v) => { _avtIsoBillboardAplicar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtGraficosIsoToggle", { configurable: true, get: () => _avtGraficosIsoToggle, set: (__v) => { _avtGraficosIsoToggle = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtGraficosRefinoToggle", { configurable: true, get: () => _avtGraficosRefinoToggle, set: (__v) => { _avtGraficosRefinoToggle = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtIsoRefinosAtualizarUI", { configurable: true, get: () => _avtIsoRefinosAtualizarUI, set: (__v) => { _avtIsoRefinosAtualizarUI = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtGraficosTecladoToggle", { configurable: true, get: () => _avtGraficosTecladoToggle, set: (__v) => { _avtGraficosTecladoToggle = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtGraficosMobileToggle", { configurable: true, get: () => _avtGraficosMobileToggle, set: (__v) => { _avtGraficosMobileToggle = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtGraficosControlesAplicar", { configurable: true, get: () => _avtGraficosControlesAplicar, set: (__v) => { _avtGraficosControlesAplicar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtGraficosAnalogicoToggle", { configurable: true, get: () => _avtGraficosAnalogicoToggle, set: (__v) => { _avtGraficosAnalogicoToggle = __v; } });
Object.defineProperty(globalThis, "_avtAnalogicoIniciado", { configurable: true, get: () => _avtAnalogicoIniciado, set: (__v) => { _avtAnalogicoIniciado = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtAnalogicoIniciar", { configurable: true, get: () => _avtAnalogicoIniciar, set: (__v) => { _avtAnalogicoIniciar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtControlesAtualizarUI", { configurable: true, get: () => _avtControlesAtualizarUI, set: (__v) => { _avtControlesAtualizarUI = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuHtmlControles", { configurable: true, get: () => _avtMenuHtmlControles, set: (__v) => { _avtMenuHtmlControles = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtGraficosAplicar", { configurable: true, get: () => _avtGraficosAplicar, set: (__v) => { _avtGraficosAplicar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtGraficosAtualizarUI", { configurable: true, get: () => _avtGraficosAtualizarUI, set: (__v) => { _avtGraficosAtualizarUI = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtGraficosToggle", { configurable: true, get: () => _avtGraficosToggle, set: (__v) => { _avtGraficosToggle = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtGraficosNivel", { configurable: true, get: () => _avtGraficosNivel, set: (__v) => { _avtGraficosNivel = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuHtmlGraficos", { configurable: true, get: () => _avtMenuHtmlGraficos, set: (__v) => { _avtMenuHtmlGraficos = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "avtMenuAbrir", { configurable: true, get: () => avtMenuAbrir, set: (__v) => { avtMenuAbrir = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuFallback", { configurable: true, get: () => _avtMenuFallback, set: (__v) => { _avtMenuFallback = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "sairAventura", { configurable: true, get: () => sairAventura, set: (__v) => { sairAventura = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "voltarAoMenuDeJogo", { configurable: true, get: () => voltarAoMenuDeJogo, set: (__v) => { voltarAoMenuDeJogo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuRenderBotoes", { configurable: true, get: () => _avtMenuRenderBotoes, set: (__v) => { _avtMenuRenderBotoes = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_hexToRgb", { configurable: true, get: () => _hexToRgb, set: (__v) => { _hexToRgb = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuAbrirPanel", { configurable: true, get: () => _avtMenuAbrirPanel, set: (__v) => { _avtMenuAbrirPanel = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuFecharPanel", { configurable: true, get: () => _avtMenuFecharPanel, set: (__v) => { _avtMenuFecharPanel = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuAbrirJogar", { configurable: true, get: () => _avtMenuAbrirJogar, set: (__v) => { _avtMenuAbrirJogar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuEntrarJogar", { configurable: true, get: () => _avtMenuEntrarJogar, set: (__v) => { _avtMenuEntrarJogar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuAbrirContinuar", { configurable: true, get: () => _avtMenuAbrirContinuar, set: (__v) => { _avtMenuAbrirContinuar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuEntrarContinuarComChar", { configurable: true, get: () => _avtMenuEntrarContinuarComChar, set: (__v) => { _avtMenuEntrarContinuarComChar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuAbrirFase", { configurable: true, get: () => _avtMenuAbrirFase, set: (__v) => { _avtMenuAbrirFase = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuAbrirFaseJogador", { configurable: true, get: () => _avtMenuAbrirFaseJogador, set: (__v) => { _avtMenuAbrirFaseJogador = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuAbrirFaseMestre", { configurable: true, get: () => _avtMenuAbrirFaseMestre, set: (__v) => { _avtMenuAbrirFaseMestre = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuNovaFaseComRefresh", { configurable: true, get: () => _avtMenuNovaFaseComRefresh, set: (__v) => { _avtMenuNovaFaseComRefresh = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuRemoverFaseComRefresh", { configurable: true, get: () => _avtMenuRemoverFaseComRefresh, set: (__v) => { _avtMenuRemoverFaseComRefresh = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuEditarFase", { configurable: true, get: () => _avtMenuEditarFase, set: (__v) => { _avtMenuEditarFase = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuSetEditFaseLock", { configurable: true, get: () => _avtMenuSetEditFaseLock, set: (__v) => { _avtMenuSetEditFaseLock = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuLerPortasInternasEditor", { configurable: true, get: () => _avtMenuLerPortasInternasEditor, set: (__v) => { _avtMenuLerPortasInternasEditor = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuAddPortaInterna", { configurable: true, get: () => _avtMenuAddPortaInterna, set: (__v) => { _avtMenuAddPortaInterna = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuRemovePortaInterna", { configurable: true, get: () => _avtMenuRemovePortaInterna, set: (__v) => { _avtMenuRemovePortaInterna = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuSalvarEditarFase", { configurable: true, get: () => _avtMenuSalvarEditarFase, set: (__v) => { _avtMenuSalvarEditarFase = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuSelecionarFase", { configurable: true, get: () => _avtMenuSelecionarFase, set: (__v) => { _avtMenuSelecionarFase = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuEntrarFaseComChar", { configurable: true, get: () => _avtMenuEntrarFaseComChar, set: (__v) => { _avtMenuEntrarFaseComChar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuListarFases", { configurable: true, get: () => _avtMenuListarFases, set: (__v) => { _avtMenuListarFases = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuAbrirPersonagem", { configurable: true, get: () => _avtMenuAbrirPersonagem, set: (__v) => { _avtMenuAbrirPersonagem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuEditarChar", { configurable: true, get: () => _avtMenuEditarChar, set: (__v) => { _avtMenuEditarChar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuCriarPersonagem", { configurable: true, get: () => _avtMenuCriarPersonagem, set: (__v) => { _avtMenuCriarPersonagem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuAbrirConfig", { configurable: true, get: () => _avtMenuAbrirConfig, set: (__v) => { _avtMenuAbrirConfig = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuAbrirConfigMestre", { configurable: true, get: () => _avtMenuAbrirConfigMestre, set: (__v) => { _avtMenuAbrirConfigMestre = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuConfigConteudoAba", { configurable: true, get: () => _avtMenuConfigConteudoAba, set: (__v) => { _avtMenuConfigConteudoAba = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuHtmlConfigJogador", { configurable: true, get: () => _avtMenuHtmlConfigJogador, set: (__v) => { _avtMenuHtmlConfigJogador = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuBindColorPicker", { configurable: true, get: () => _avtMenuBindColorPicker, set: (__v) => { _avtMenuBindColorPicker = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuSelecionarMusicaMode", { configurable: true, get: () => _avtMenuSelecionarMusicaMode, set: (__v) => { _avtMenuSelecionarMusicaMode = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuSetMobilePref", { configurable: true, get: () => _avtMenuSetMobilePref, set: (__v) => { _avtMenuSetMobilePref = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuSalvarConfigMestre", { configurable: true, get: () => _avtMenuSalvarConfigMestre, set: (__v) => { _avtMenuSalvarConfigMestre = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuSalvarConfigJogador", { configurable: true, get: () => _avtMenuSalvarConfigJogador, set: (__v) => { _avtMenuSalvarConfigJogador = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuUploadImagem", { configurable: true, get: () => _avtMenuUploadImagem, set: (__v) => { _avtMenuUploadImagem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuAbrirGuia", { configurable: true, get: () => _avtMenuAbrirGuia, set: (__v) => { _avtMenuAbrirGuia = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuAbrirPixiStudio", { configurable: true, get: () => _avtMenuAbrirPixiStudio, set: (__v) => { _avtMenuAbrirPixiStudio = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuEntrarJogo", { configurable: true, get: () => _avtMenuEntrarJogo, set: (__v) => { _avtMenuEntrarJogo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuCharsVisiveis", { configurable: true, get: () => _avtMenuCharsVisiveis, set: (__v) => { _avtMenuCharsVisiveis = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuHtmlSeletorChar", { configurable: true, get: () => _avtMenuHtmlSeletorChar, set: (__v) => { _avtMenuHtmlSeletorChar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuCarregarSessionData", { configurable: true, get: () => _avtMenuCarregarSessionData, set: (__v) => { _avtMenuCarregarSessionData = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuSalvarSessionData", { configurable: true, get: () => _avtMenuSalvarSessionData, set: (__v) => { _avtMenuSalvarSessionData = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMenuBindFaseMudouHandler", { configurable: true, get: () => _avtMenuBindFaseMudouHandler, set: (__v) => { _avtMenuBindFaseMudouHandler = __v; } });
