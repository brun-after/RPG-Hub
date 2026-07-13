// aventura/renderer-pixi.ts
// RPG Hub — Camada de mundo do modo aventura em PixiJS (WebGL).
//
// Entrega 2 da migração de renderer: o fundo + tiles do dungeon + grade saem do
// redesenho tile-a-tile por frame do Canvas 2D e viram uma cena PIXI construída
// UMA vez por fase (sprites/Graphics estáticos, culling por chunk). A câmera vira
// um transform de container por frame (GPU). O canvas 2D original fica transparente
// por cima e continua desenhando todo o resto (entidades, barras, portas, efeitos)
// — a lógica de jogo não muda em nada.
//
// O canvas PIXI é inserido DENTRO do #avt-mapa-wrap, atrás do #avt-canvas, então
// herda automaticamente a projeção isométrica (transform CSS aplicado ao wrap).
//
// Feature flag: `?renderer=canvas` na URL ou localStorage avt_renderer='canvas'
// desativa esta camada e restaura o caminho 100% Canvas 2D antigo.
//
// Contrato com aventura.js (_avtRenderFrame):
//   avtPixiWorldFrame(canvas, camera, SZ, dungeon, gridStyle, hue) → boolean
//     true  = camada PIXI ativa (o caller deve usar clearRect e pular tiles/grade)
//     false = usar o caminho Canvas 2D legado
//   avtPixiWorldDestroy() — libera o contexto GL (chamado ao sair da aventura)

const TILE = 48;         // deve casar com AVT_SZ (px por tile no zoom 1)
const CHUNK = 16;        // tiles por chunk (culling de visibilidade)

let _app: any = null;                 // PIXI.Application (autoStart: false)
let _tileRoot: any = null;            // container com os chunks da fase
let _chunks: any[] = [];              // [{c: Container, px, py, w, h}]
let _bakeSig = '';                    // assinatura da última fase assada
let _hueFilter: any = null;
let _hueAtual = 0;
let _texCache: Record<string, any> = {};   // key do tileset -> PIXI.Texture
let _carregandoCore = false;
let _viewCss = '';                    // último cssText espelhado do canvas 2D

function _flagDesativado(): boolean {
  try {
    if (new URLSearchParams(location.search).get('renderer') === 'canvas') return true;
    if (localStorage.getItem('avt_renderer') === 'canvas') return true;
  } catch (e) { /* ambientes sem localStorage */ }
  return false;
}

function _tilePassavelLocal(x: number, y: number, dungeon: any): boolean {
  // espelha _avtTilePassavel para uso no bake (função global do aventura.js)
  const fn = (window as any)._avtTilePassavel;
  if (typeof fn === 'function') return fn(x, y, dungeon);
  const t = dungeon.tiles[y]?.[x];
  return t === 1 || t === 2;
}

function _texturaDoTileset(key: string): any {
  if (_texCache[key]) return _texCache[key];
  const img = (window as any).AVT_STATE?._tilesetTextures?.[key];
  if (!img) return null;
  const PIXI = (window as any).PIXI;
  const tex = PIXI.Texture.from(img);
  tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
  _texCache[key] = tex;
  return tex;
}

// ── Construção da cena da fase (1× por fase/tileset/grade) ───────────────────
function _bakeFase(dungeon: any, gridStyle: any): void {
  const PIXI = (window as any).PIXI;
  const ST: any = (window as any).AVT_STATE;
  const tilesetOn = !!ST._tilesetLoaded;

  if (_tileRoot) { _tileRoot.destroy({ children: true }); }
  _texCache = {};
  _tileRoot = new PIXI.Container();
  _app.stage.addChild(_tileRoot);
  _chunks = [];

  const getKey = (window as any)._avtGetTileSemanticKey;

  for (let cy = 0; cy < dungeon.h; cy += CHUNK) {
    for (let cx = 0; cx < dungeon.w; cx += CHUNK) {
      const cont = new PIXI.Container();
      const g = new PIXI.Graphics();
      cont.addChild(g);
      const w = Math.min(CHUNK, dungeon.w - cx);
      const h = Math.min(CHUNK, dungeon.h - cy);

      for (let y = cy; y < cy + h; y++) {
        for (let x = cx; x < cx + w; x++) {
          const t = dungeon.tiles[y]?.[x];
          const px = x * TILE, py = y * TILE;

          if (tilesetOn) {
            // Paridade com o loop legado: chave string direta (ia_fase) ou autotile
            const key = typeof t === 'string' ? t : (typeof getKey === 'function' ? getKey(x, y, dungeon) : null);
            const tex = key ? _texturaDoTileset(key) : null;
            if (tex) {
              const sp = new PIXI.Sprite(tex);
              sp.position.set(px, py);
              sp.width = TILE; sp.height = TILE;
              cont.addChild(sp);
              continue;
            }
            if (t === null || t === undefined) continue; // void — fundo do app cobre
            g.beginFill(_tilePassavelLocal(x, y, dungeon) ? 0x101520 : 0x0a0c14);
            g.drawRect(px, py, TILE, TILE);
            g.endFill();
          } else if (t === 2 /* AVT_T.SAIDA */) {
            g.beginFill(0x101520); g.drawRect(px, py, TILE, TILE); g.endFill();
            g.beginFill(0x4fdc8c, 0.18); g.drawRect(px + 2, py + 2, TILE - 4, TILE - 4); g.endFill();
            g.lineStyle(2, 0x4fdc8c, 0.6);
            g.drawRect(px + 2, py + 2, TILE - 4, TILE - 4);
            g.lineStyle(0);
            const door = new PIXI.Text('🚪', { fontSize: Math.round(TILE * 0.55), fontFamily: 'serif' });
            door.anchor.set(0.5);
            door.position.set(px + TILE / 2, py + TILE / 2);
            door.alpha = 0.8;
            cont.addChild(door);
          } else if (t === 1 /* PISO */ || (typeof t === 'string' && _tilePassavelLocal(x, y, dungeon))) {
            g.beginFill(0x101520); g.drawRect(px, py, TILE, TILE); g.endFill();
            if (gridStyle && gridStyle.op > 0) {
              g.lineStyle(1, _corGrid(gridStyle), _opGrid(gridStyle));
              g.drawRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
              g.lineStyle(0);
            }
          } else {
            g.beginFill(0x0a0c14); g.drawRect(px, py, TILE, TILE); g.endFill();
            g.beginFill(0x4fa3d1, 0.04);
            g.drawRect(px, py, TILE, 3);
            g.drawRect(px, py, 3, TILE);
            g.endFill();
          }
        }
      }

      cont.position.set(0, 0);
      _tileRoot.addChild(cont);
      _chunks.push({ c: cont, px: cx * TILE, py: cy * TILE, w: w * TILE, h: h * TILE });
    }
  }

  // Grade suave sobre tilesets (linhas contínuas finas) — parte estática, assada junto
  if (tilesetOn && gridStyle && gridStyle.op > 0) {
    const gl = new PIXI.Graphics();
    gl.lineStyle(0.5, _corGrid(gridStyle), _opGrid(gridStyle));
    for (let gx = 0; gx <= dungeon.w; gx++) { gl.moveTo(gx * TILE, 0); gl.lineTo(gx * TILE, dungeon.h * TILE); }
    for (let gy = 0; gy <= dungeon.h; gy++) { gl.moveTo(0, gy * TILE); gl.lineTo(dungeon.w * TILE, gy * TILE); }
    _tileRoot.addChild(gl);
  }
}

// gridStyle.stroke vem como 'rgba(r,g,b,a)' do _avtGridStyle; extrai cor e alpha
function _corGrid(gridStyle: any): number {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(gridStyle.stroke || '');
  if (!m) return 0xffffff;
  return (parseInt(m[1]) << 16) | (parseInt(m[2]) << 8) | parseInt(m[3]);
}
function _opGrid(gridStyle: any): number {
  const m = /rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/.exec(gridStyle.stroke || '');
  return m ? parseFloat(m[1]) : (gridStyle.op ?? 1);
}

// ── Frame: chamado de _avtRenderFrame a cada rAF ─────────────────────────────
function avtPixiWorldFrame(canvas: any, camera: any, SZ: number, dungeon: any, gridStyle: any, hue: number): boolean {
  if (_flagDesativado() || !canvas || !dungeon) return false;
  const PIXI = (window as any).PIXI;

  // Lazy-init do core PIXI: até carregar, o caminho legado segue desenhando
  if (!PIXI) {
    if (!_carregandoCore && typeof (window as any).pixiEnsureCore === 'function') {
      _carregandoCore = true;
      (window as any).pixiEnsureCore().catch(() => { /* sem PIXI → legado permanente */ });
    }
    return false;
  }

  // (Re)criação do app quando não existe ou o canvas foi recriado/wrap foi limpo
  if (!_app || !_app.view.isConnected || _app.view.nextSibling !== canvas) {
    if (_app) { try { _app.destroy(true, { children: true, texture: false }); } catch (e) {} }
    _app = new PIXI.Application({
      width: canvas.width || 100,
      height: canvas.height || 100,
      backgroundColor: 0x050810,
      antialias: false,
      resolution: 1,
      autoStart: false,               // render manual, em sincronia com o rAF do jogo
      powerPreference: 'high-performance',
    });
    _app.view.id = 'avt-canvas-pixi';
    canvas.parentElement.insertBefore(_app.view, canvas); // atrás do canvas 2D (ordem DOM)
    _bakeSig = ''; _tileRoot = null; _viewCss = '';
  }

  // Espelha caixa CSS e tamanho de pixels do canvas 2D
  const css = canvas.style.cssText.replace('cursor:pointer;', '').replace('cursor: pointer;', '');
  if (css !== _viewCss) { _app.view.style.cssText = css; _app.view.style.pointerEvents = 'none'; _viewCss = css; }
  if (_app.renderer.width !== canvas.width || _app.renderer.height !== canvas.height) {
    if (!(canvas.width > 0 && canvas.height > 0)) return false;
    _app.renderer.resize(canvas.width, canvas.height);
  }

  // Rebake quando a fase/tileset/grade mudam (assinatura barata por frame)
  const ST: any = (window as any).AVT_STATE;
  const sig = `${dungeon.w}x${dungeon.h}:${ST._faseAtualId || 'principal'}:${ST._tilesetLoaded ? 1 : 0}:${gridStyle?.stroke}|${gridStyle?.op}`;
  if (sig !== _bakeSig) {
    try { _bakeFase(dungeon, gridStyle); _bakeSig = sig; }
    catch (e) { console.warn('[renderer-pixi] bake falhou, usando canvas:', e); return false; }
  }

  // Variação de cor da fase (hue-rotate) via ColorMatrixFilter (antes: ctx.filter por tile)
  if ((hue || 0) !== _hueAtual) {
    _hueAtual = hue || 0;
    if (_hueAtual) {
      if (!_hueFilter) _hueFilter = new PIXI.ColorMatrixFilter();
      _hueFilter.reset(); _hueFilter.hue(_hueAtual, false);
      _tileRoot.filters = [_hueFilter];
    } else {
      _tileRoot.filters = null;
    }
  }

  // Câmera → transform do container. Tiles assados a TILE px; o jogo desenha a
  // SZ = round(AVT_SZ * zoom), então a escala efetiva é SZ/TILE (não o zoom cru).
  const esc = SZ / TILE;
  _tileRoot.scale.set(esc);
  _tileRoot.position.set(-camera.x, -camera.y);

  // Culling por chunk (esconde chunks fora do viewport)
  const vx0 = camera.x / esc, vy0 = camera.y / esc;
  const vx1 = vx0 + canvas.width / esc, vy1 = vy0 + canvas.height / esc;
  for (const ch of _chunks) {
    ch.c.visible = !(ch.px + ch.w < vx0 || ch.px > vx1 || ch.py + ch.h < vy0 || ch.py > vy1);
  }

  _app.renderer.render(_app.stage);
  return true;
}

function avtPixiWorldAtivo(): boolean {
  return !!(_app && _app.view && _app.view.isConnected);
}

function avtPixiWorldDestroy(): void {
  if (_app) {
    try { _app.destroy(true, { children: true, texture: true }); } catch (e) {}
    _app = null; _tileRoot = null; _chunks = []; _bakeSig = ''; _texCache = {}; _hueFilter = null; _hueAtual = 0; _viewCss = '';
  }
}

Object.assign(window, { avtPixiWorldFrame, avtPixiWorldAtivo, avtPixiWorldDestroy });
