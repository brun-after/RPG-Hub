// maps/fase-tileset.js
// Tileset system for adventure mode: prompts, validation, string-grid rendering

// ── Células com rotação/flip ─────────────────────────────────────────────────
// Uma célula do grid é number (AVT_T) | string semântica | null. A string pode
// carregar um transform D4 como sufixo: "parede_N@t", t ∈ 1..7
//   1/2/3 = rotação 90/180/270° horária; 4..7 = flip horizontal + rotação (t-4)·90°
// Sem sufixo = identidade — saves antigos continuam parseando inalterados.
// TODO consumidor de célula deve ler a chave via _avtCellBase e o transform via
// _avtCellXform; nunca comparar a string crua.
function _avtCellBase(cell: any) {
  if (typeof cell !== 'string') return cell;
  const i = cell.indexOf('@');
  return i === -1 ? cell : cell.slice(0, i);
}
function _avtCellXform(cell: any) {
  if (typeof cell !== 'string') return 0;
  const i = cell.indexOf('@');
  if (i === -1) return 0;
  const t = parseInt(cell.slice(i + 1), 10);
  return (Number.isFinite(t) && t >= 1 && t <= 7) ? t : 0;
}
function _avtCellCom(key: any, t: any) {
  return t ? key + '@' + t : key;
}

// Desenha um tile aplicando o transform D4 (rotação em torno do centro).
function _avtDrawTileXform(ctx: any, img: any, px: any, py: any, SZ: any, t: any) {
  if (!t) { ctx.drawImage(img, px, py, SZ, SZ); return; }
  const rot = t & 3, flip = t >= 4;
  ctx.save();
  ctx.translate(px + SZ / 2, py + SZ / 2);
  ctx.rotate(rot * Math.PI / 2);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -SZ / 2, -SZ / 2, SZ, SZ);
  ctx.restore();
}

// Recorta uma região da imagem-fonte já aplicando o transform D4 num canvas —
// usado pelos fatiadores para materializar blocos rotacionados 1× no load
// (mecanismo de dedup: "parede_L": "bloco_1_0@1" reusa a arte da parede N).
function _avtTileXformCanvas(src: any, sx: any, sy: any, sw: any, sh: any, t: any) {
  const rot = (t || 0) & 3, flip = (t || 0) >= 4;
  const cv = document.createElement('canvas');
  const rot90 = rot === 1 || rot === 3;
  cv.width = Math.max(1, Math.round(rot90 ? sh : sw));
  cv.height = Math.max(1, Math.round(rot90 ? sw : sh));
  const c = cv.getContext('2d')!;
  c.translate(cv.width / 2, cv.height / 2);
  c.rotate(rot * Math.PI / 2);
  if (flip) c.scale(-1, 1);
  c.drawImage(src, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
  return cv;
}

// ── Layout canônico fixo — o sistema sempre espera elementos nestas posições ──
// col 0 = cantos NW/SW + parede Oeste   |  col 1 = paredes N/S + piso variante
// col 2 = cantos NE/SE + parede Leste   |  col 3 = piso principal / objetos / baú
// col 4 = cantos internos (côncavos)    (se cols >= 5)
// row 0 = canto_NO, parede_N, canto_NE, piso_1,     [canto_int_NO]
// row 1 = parede_O, piso_2,   parede_L, objeto_1,   [canto_int_NE]
// row 2 = canto_SO, parede_S, canto_SE, bau,         [canto_int_SO]
// row 3 = porta,    piso_3,   parede_int, porta_fase,[canto_int_SE] (se rows >= 4)
// row 4 = piso_4,   piso_5,   objeto_2,   objeto_3               (se rows >= 5)
function _faseTilesetBlocosCanonicos(cols: any, rows: any) {
  cols = cols || 4; rows = rows || 4;
  const b: any = {
    canto_NO: 'bloco_0_0', parede_N: 'bloco_1_0', canto_NE: 'bloco_2_0', piso_1: 'bloco_3_0',
    parede_O: 'bloco_0_1', piso_2:   'bloco_1_1', parede_L: 'bloco_2_1', objeto_1: 'bloco_3_1',
    canto_SO: 'bloco_0_2', parede_S: 'bloco_1_2', canto_SE: 'bloco_2_2', bau: 'bloco_3_2',
  };
  if (rows >= 4) { b.porta = 'bloco_0_3'; b.piso_3 = 'bloco_1_3'; b.parede_int = 'bloco_2_3'; (b as any).porta_fase = 'bloco_3_3'; }
  if (rows >= 5 && cols >= 4) { b.piso_4 = 'bloco_0_4'; b.piso_5 = 'bloco_1_4'; b.objeto_2 = 'bloco_2_4'; (b as any).objeto_3 = 'bloco_3_4'; }
  // Cantos internos (côncavos) — usados nas junções corredor→sala onde o diagonal é piso
  if (cols >= 5) {
    (b as any).canto_int_NO = 'bloco_4_0';
    (b as any).canto_int_NE = 'bloco_4_1';
    (b as any).canto_int_SO = 'bloco_4_2';
    if (rows >= 4) b.canto_int_SE = 'bloco_4_3';
  }
  return b;
}

// ── Prompt 1 — Geração de imagem do tileset ──────────────────────────────────
function faseTilesetImgPromptTemplate(opts: any) {
  const estilo = opts.estilo || 'pixel art fantasy dungeon';
  const cols   = Math.min(10, Math.max(4, opts.cols || 4));
  const rows   = Math.min(10, Math.max(4, opts.rows || 4));

  const row3 = rows >= 4 ? `
Row 3 — Portas e variações especiais:
  bloco_0_3 = Porta fechada (top-down — batente de madeira escura com ferragens de metal; encaixa perfeitamente com o piso, sem bordas brancas)
  bloco_1_3 = Piso variante 3 (runas gravadas, pedra diferente ou terra compactada)
  bloco_2_3 = Parede interna / alcova (face de parede interna ou nicho decorativo)
  bloco_3_3 = Portal de fase (saída mágica, escada, ou vórtice de luz — indica progressão)
` : '';

  const row4 = rows >= 5 ? `
Row 4 — Decoração extra e variações temáticas:
  bloco_0_4 = Piso variante 4 (sangue, água, lava, gelo — conforme o tema)
  bloco_1_4 = Piso variante 5 (outra variação orgânica)
  bloco_2_4 = Obstáculo 2 (tocha na parede, coluna, estátua, crânio)
  bloco_3_4 = Obstáculo 3 (armadilha, runa no chão, espinhos)
` : '';

  const col4 = cols >= 5 ? `
Coluna 4 — Cantos internos (côncavos):
  IMPORTANTE: estes são o ESPELHO dos cantos externos — onde o externo tem saliência convexa, o interno tem reentrância côncava.
  Aparecem nas junções entre corredor e sala, onde o piso "dobra" ao redor da parede.
  bloco_4_0 = Canto interno NO (côncavo NW) — piso vindo de Sul e Leste; o piso diagonal SE também é piso
  bloco_4_1 = Canto interno NE (côncavo NE) — piso vindo de Sul e Oeste; diagonal SW também é piso
  bloco_4_2 = Canto interno SO (côncavo SW) — piso vindo de Norte e Leste; diagonal NE também é piso
  ${rows >= 4 ? 'bloco_4_3 = Canto interno SE (côncavo SE) — piso vindo de Norte e Oeste; diagonal NW também é piso' : ''}
` : '';

  const extraRows = rows > 5 ? `\nLinhas 5+: variações temáticas extras compatíveis com o estilo definido.` : '';

  return `Você é um artista sênior de games criando um tileset para um RPG de visão top-down no estilo: "${estilo}".

Pense como um concept artist de um jogo AAA — cada tile deve ser visualmente rico, coerente com seus vizinhos e imediatamente legível durante o jogo. O jogador precisa identificar paredes, pisos, portas e objetos em um piscar de olhos.

REQUISITOS TÉCNICOS OBRIGATÓRIOS:
- Imagem QUADRADA PERFEITA (largura == altura) — ex: 512×512, 1024×1024, 2048×2048
- Grade uniforme de exatamente ${cols} colunas × ${rows} linhas (mínimo 4×4, máximo 10×10)
- Células perfeitamente iguais — zero margens, zero padding entre elas
- As linhas de grade são frações exatas das dimensões da imagem (sem pixels extras)
- Perspectiva top-down pura (câmera olhando diretamente de cima)
- Iluminação consistente: fonte de luz vinda de cima, sombras sutis abaixo dos elementos elevados

LAYOUT CANÔNICO — posições fixas por função (NUNCA trocar; o sistema lê estas posições):
┌──────────────────────────────────────────────────────────────────┐
│ col 0 = estrutura Oeste │ col 2 = estrutura Leste                │
│ col 1 = paredes N/S     │ col 3 = pisos/objetos                  │
│ col 4 = cantos internos (côncavos) — apenas se cols >= 5         │
└──────────────────────────────────────────────────────────────────┘

CÉLULAS OBRIGATÓRIAS (coluna × linha, índice zero):
Linha 0 — Cantos Norte e Piso principal:
  bloco_0_0 = Canto NW (parede virando do norte para o oeste — canto externo)
  bloco_1_0 = Face da parede Norte (borda superior de uma sala — piso fica ABAIXO deste tile)
  bloco_2_0 = Canto NE (parede virando do norte para o leste — canto externo)
  bloco_3_0 = Piso variante 1 (piso principal — pedra, paralelepípedo, madeira — com textura orgânica)

Linha 1 — Paredes Laterais e Piso secundário:
  bloco_0_1 = Face da parede Oeste (borda esquerda — piso fica à DIREITA)
  bloco_1_1 = Piso variante 2 (variação sutil: rachadura diferente, musgo, mancha)
  bloco_2_1 = Face da parede Leste (borda direita — piso fica à ESQUERDA)
  bloco_3_1 = Obstáculo / objeto (barril, caixote, pilar, pedregulho — bloqueia passagem)

Linha 2 — Cantos Sul e Baú:
  bloco_0_2 = Canto SW (parede virando do sul para o oeste)
  bloco_1_2 = Face da parede Sul (borda inferior — piso fica ACIMA)
  bloco_2_2 = Canto SE (parede virando do sul para o leste)
  bloco_3_2 = Baú do tesouro (baú fechado de madeira/metal, top-down — reconhecível imediatamente)
${row3}${row4}${col4}${extraRows}

REGRAS VISUAIS DE QUALIDADE:
- Paredes devem ter profundidade e espessura visível — não são apenas linhas
- Cantos EXTERNOS devem mostrar claramente a saliência convexa na junção de 90° entre duas faces de parede
- Cantos INTERNOS (côncavos, col 4 se presente) devem ser o espelho visual dos externos — reentrância suave, sem saliência
- Tiles de parede e canto devem ser CLARAMENTE DISTINTOS dos tiles de piso — nunca confundíveis
- Pisos devem parecer caminháveis: planos, com textura orgânica e variação sutil
- A transição visual entre parede e piso deve ser suave e coerente (sem bordas brancas ou cortes abruptos)
- O baú deve ser imediatamente identificável como contêiner de tesouro fechado
- Obstáculos devem parecer impassáveis visualmente
- Porta deve ser reconhecível como porta fechada (madeira + ferragens metálicas, vista de cima)
- Todos os tiles devem usar a mesma paleta de cores e estilo artístico — coerência visual total

OUTPUT: Uma única imagem plana (sem camadas), sem rótulos, sem UI, sem bordas fora do grid.`;
}

// ── Prompt 2 — Coordenadas + layout completo da dungeon ──────────────────────
function faseTilesetLayoutPromptTemplate(opts: any) {
  const cols      = Math.min(10, Math.max(4, opts.cols || 4));
  const rows      = Math.min(10, Math.max(4, opts.rows || 4));
  const descricao = opts.descricao || 'a dungeon with several rooms connected by corridors';
  const largura   = opts.largura   || 24;
  const altura    = opts.altura    || 18;

  const portaFaseBloco   = rows >= 4 ? `\n    "porta":      "bloco_0_3",\n    "piso_3":     "bloco_1_3",\n    "parede_int": "bloco_2_3",\n    "porta_fase": "bloco_3_3",` : '';
  const portaFaseValores = rows >= 4 ? `\n  "porta"       — closed door (placed on corridor openings between rooms)\n  "piso_3"      — floor variant 3 (use sparingly for dramatic effect)\n  "parede_int"  — inner wall / alcove (decorative interior wall)\n  "porta_fase"  — phase portal / exit (one per dungeon, in the final room)` : '';

  return `Você recebeu uma imagem de tileset dividida em grade ${cols}×${rows}. As células são nomeadas bloco_COL_LINHA (índice zero, col 0 = mais à esquerda, linha 0 = mais acima).

O tileset foi criado para o tema: "${descricao}".

LAYOUT CANÔNICO — o sistema SEMPRE usa estas posições fixas:
  bloco_0_0 = canto_NO  |  bloco_1_0 = parede_N   |  bloco_2_0 = canto_NE  |  bloco_3_0 = piso_1
  bloco_0_1 = parede_O  |  bloco_1_1 = piso_2      |  bloco_2_1 = parede_L  |  bloco_3_1 = objeto_1
  bloco_0_2 = canto_SO  |  bloco_1_2 = parede_S    |  bloco_2_2 = canto_SE  |  bloco_3_2 = bau
  ${rows >= 4 ? 'bloco_0_3 = porta    |  bloco_1_3 = piso_3   |  bloco_2_3 = parede_int | bloco_3_3 = porta_fase' : ''}

SUA TAREFA: retornar UM JSON com DUAS partes simultâneas:
1. CONFIRMAR o mapeamento de blocos (verificando a imagem)
2. CRIAR o layout completo da dungeon como grid de tiles

Retorne APENAS um objeto JSON (sem markdown, comece com {):

{
  "version": 2,
  "cols": ${cols},
  "rows": ${rows},

  "blocos": {
    "canto_NO":   "bloco_0_0",
    "parede_N":   "bloco_1_0",
    "canto_NE":   "bloco_2_0",
    "piso_1":     "bloco_3_0",
    "parede_O":   "bloco_0_1",
    "piso_2":     "bloco_1_1",
    "parede_L":   "bloco_2_1",
    "objeto_1":   "bloco_3_1",
    "canto_SO":   "bloco_0_2",
    "parede_S":   "bloco_1_2",
    "canto_SE":   "bloco_2_2",
    "bau":        "bloco_3_2"${portaFaseBloco}
  },

  "mapa": {
    "largura": ${largura},
    "altura":  ${altura},
    "salas": [
      {"id": "entrada",   "x": 2,  "y": 2,  "w": 7, "h": 6, "tipo": "entrada"},
      {"id": "corredor1", "x": 9,  "y": 4,  "w": 5, "h": 3, "tipo": "corredor"},
      {"id": "sala_2",    "x": 14, "y": 2,  "w": 6, "h": 5, "tipo": "normal"},
      {"id": "chefe",     "x": 9,  "y": 11, "w": 8, "h": 6, "tipo": "chefe"}
    ],
    "spawn_jogadores": [{"x": 4, "y": 4}],
    "inimigos": [
      {"x": 16, "y": 4,  "hp": 30, "nome": "Guardião"},
      {"x": 13, "y": 14, "hp": 80, "nome": "Chefe", "isBoss": true}
    ],
    "tiles": [
      GRADE COMPLETA ${largura}×${altura} AQUI — veja as regras abaixo
    ]
  }
}

══ REGRAS DE MAPEAMENTO DE TILESET ══
- Verifique cada célula na imagem do tileset
- O layout canônico acima já define as posições corretas — ajuste "blocos" SOMENTE se a imagem claramente divergir
- Célula bloco_C_L ocupa a fração x=[C/${cols}, (C+1)/${cols}] × y=[L/${rows}, (L+1)/${rows}] da imagem
- Se um papel não tiver correspondência visual clara, reutilize o tile mais próximo
- NÃO inclua "tile_size" — o sistema calcula automaticamente

══ DESIGN DE DUNGEON — PENSE COMO LEVEL DESIGNER ══
O array "tiles" deve ter exatamente ${altura} linhas × ${largura} colunas.
Cada célula contém uma string semântica ou null:

Valores permitidos:
  null          — vazio/void (escuridão fora da dungeon)
  "canto_NO"    — canto NW da parede
  "canto_NE"    — canto NE da parede
  "canto_SO"    — canto SW da parede
  "canto_SE"    — canto SE da parede
  "parede_N"    — face norte (borda superior de sala/corredor)
  "parede_S"    — face sul (borda inferior)
  "parede_O"    — face oeste (borda esquerda)
  "parede_L"    — face leste (borda direita)
  "piso_1"      — piso principal (tile mais comum)
  "piso_2"      — piso variante (misture com piso_1 para variedade orgânica)
  "objeto_1"    — obstáculo/objeto impassável (barril, pilar, caixote)
  "bau"         — baú de tesouro (coloque próximo às paredes, nunca no centro de corredor)${portaFaseValores}

DIRETRIZES ARTÍSTICAS DE LEVEL DESIGN:
- Pense no fluxo do jogador: a dungeon deve ter ritmo — salas de tensão alternadas com momentos de respiro
- Sala de entrada: ampla e relativamente segura, dá sensação de escala do local
- Salas intermediárias: progressivamente menores ou mais comprimidas, gerando tensão
- Sala do chefe: a maior e mais imponente — espaço para combate dramático
- Corredores: use largura variável (1 a 3 tiles) para criar sensação de urgência ou exploração
- Decoração narrativa com "objeto_1": barris encostados em paredes em salas de guarda, colunas em salões, pedras no chão em celas, runas na sala do chefe
- Distribua "piso_2" organicamente (15–25% dos tiles de piso) — não em padrão, mas em manchas irregulares
- Posicione "bau" em nichos próximos às paredes, nunca bloqueando passagens
- Certifique-se de que TODOS os cômodos são alcançáveis via corredores conectados
- Adapte a quantidade de salas, seus tamanhos e densidade de decoração ao tema: "${descricao}"
- Prefira layouts assimétricos e orgânicos a grades regulares — dungeons reais são irregulares

IMPORTANTE: Retorne APENAS o JSON. O array "tiles" deve ter EXATAMENTE ${altura} sub-arrays, cada um com EXATAMENTE ${largura} valores.`;
}

// ── Prompt unificado para IA externa (personagens + dungeon + tileset) ────────
function _avtPromptCampanhaExterna(opts: any) {
  const cols = Math.min(10, Math.max(4, opts.cols || 4));
  const rows = Math.min(10, Math.max(4, opts.rows || 4));

  const portaBlocos   = rows >= 4 ? `\n      "porta":      "bloco_0_3",\n      "piso_3":     "bloco_1_3",\n      "parede_int": "bloco_2_3",\n      "porta_fase": "bloco_3_3",` : '';
  const portaValores  = rows >= 4 ? `\n  "porta"       — porta fechada (coloque nas aberturas de corredores entre salas)\n  "piso_3"      — piso variante 3 (use pontualmente para efeito dramático)\n  "parede_int"  — parede interna / alcova decorativa\n  "porta_fase"  — portal de saída (apenas 1 por dungeon, na sala final)` : '';

  return `Você é um mestre de RPG criativo com olhar de game designer experiente. Os jogadores vão descrever os personagens que querem diretamente nesta conversa.

Sua missão é gerar um JSON completo de campanha de RPG — incluindo personagens balanceados, especificação de tileset canônico E um layout de dungeon detalhado e artisticamente projetado.

══ TILESET — LAYOUT CANÔNICO FIXO (${cols}×${rows}) ══
O sistema usa posições fixas para cada elemento — NÃO altere este mapeamento sem razão visual clara:
┌────────────────────────────────────────────────────────────┐
│ bloco_0_0=canto_NO  │ bloco_1_0=parede_N  │ bloco_2_0=canto_NE  │ bloco_3_0=piso_1    │
│ bloco_0_1=parede_O  │ bloco_1_1=piso_2    │ bloco_2_1=parede_L  │ bloco_3_1=objeto_1  │
│ bloco_0_2=canto_SO  │ bloco_1_2=parede_S  │ bloco_2_2=canto_SE  │ bloco_3_2=bau       │
${rows >= 4 ? '│ bloco_0_3=porta     │ bloco_1_3=piso_3    │ bloco_2_3=parede_int│ bloco_3_3=porta_fase│' : ''}
└────────────────────────────────────────────────────────────┘
REGRA CRÍTICA: col 0-2 = estrutura (paredes, cantos, porta); col 3 = pisos/objetos/baú/portal
Isso garante que o sistema nunca confunda piso com parede ou porta.

══ FORMATO DE SAÍDA ══
Retorne APENAS um único objeto JSON (sem markdown, comece com {).
O campo raiz "nome" é OBRIGATÓRIO — título curto da aventura em português (3 a 6 palavras):

{
  "nome": "Nome da Aventura",
  "characters": [
    {
      "nome": "Nome do Personagem",
      "hp_max": 70,
      "habilidades": [
        {"nome": "Golpe Pesado", "formula_dano": "1d8+3", "tipo_dano": "fisico", "cooldown_turnos": 1, "alcance_celulas": 1, "descricao": "Pancada brutal com a arma"},
        {"nome": "Escudo da Fé", "formula_dano": "0", "tipo_dano": "cura", "cooldown_turnos": 3, "alcance_celulas": 0, "descricao": "Cura 1d6 PV do alvo"}
      ],
      "aparencia_tipo": "guerreiro",
      "classe_aventura": "guerreiro"
    }
  ],
  "tileset_config": {
    "version": 2,
    "cols": ${cols},
    "rows": ${rows},
    "blocos": {
      "canto_NO":   "bloco_0_0",
      "parede_N":   "bloco_1_0",
      "canto_NE":   "bloco_2_0",
      "piso_1":     "bloco_3_0",
      "parede_O":   "bloco_0_1",
      "piso_2":     "bloco_1_1",
      "parede_L":   "bloco_2_1",
      "objeto_1":   "bloco_3_1",
      "canto_SO":   "bloco_0_2",
      "parede_S":   "bloco_1_2",
      "canto_SE":   "bloco_2_2",
      "bau":        "bloco_3_2"${portaBlocos}
    },
    "mapa": {
      "largura": <LARGURA>,
      "altura":  <ALTURA>,
      "salas": [
        {"id": "entrada",   "x": 2,  "y": 2,  "w": 7, "h": 6,  "tipo": "entrada"},
        {"id": "sala_2",    "x": 14, "y": 3,  "w": 6, "h": 5,  "tipo": "normal"},
        {"id": "chefe",     "x": 9,  "y": 12, "w": 8, "h": 6,  "tipo": "chefe"}
      ],
      "spawn_jogadores": [{"x": 4, "y": 4}],
      "inimigos": [
        {"x": 16, "y": 5,  "hp": 30, "nome": "Guardião"},
        {"x": 13, "y": 14, "hp": 80, "nome": "Chefe", "isBoss": true}
      ],
      "tiles": [ /* grade 2D completa — veja regras abaixo */ ]
    }
  }
}

══ REGRAS DE PERSONAGENS ══
- Crie um personagem por solicitação de jogador
- HP balanceado entre 40–120 conforme classe e descrição
- Cada personagem deve ter 2–4 habilidades com fórmulas de dano balanceadas
- "aparencia_tipo": npc_generico, guerreiro, mago, goblin, esqueleto, orc, troll, vampiro, cultista, boss
- "classe_aventura": guerreiro | mago

══ DESIGN DE DUNGEON — PENSE COMO LEVEL DESIGNER E ARTISTA ══
Você está criando uma dungeon com intenção artística. Cada decisão de layout deve contar uma história.

ESTRUTURA DO TILESET (o que cada chave semântica representa):
  null          — vazio/escuridão (fora da dungeon)
  "canto_NO/NE/SO/SE"         — cantos EXTERNOS de parede (saliência convexa na junção de 90°)
  "canto_int_NO/NE/SO/SE"     — cantos INTERNOS (côncavos) — GERADO AUTOMATICAMENTE pelo sistema; NÃO coloque no mapa
  "parede_N/S/O/L"            — faces de parede (bordas de salas e corredores)
  "piso_1"      — piso principal (use na maior parte do interior)
  "piso_2"      — variação de piso (distribua organicamente — 15-25% do piso)
  "objeto_1"    — obstáculo/objeto impassável (barril, pilar, caixote, pedra)
  "bau"         — baú de tesouro (coloque em nichos próximos a paredes)${portaValores}

DIRETRIZES ARTÍSTICAS DE LEVEL DESIGN:
- Escolha <LARGURA> e <ALTURA> que se adequem à história (ex: 24×18 a 40×28)
- Pense no fluxo narrativo: a dungeon conta uma história pelo layout
- Sala de entrada: ampla, relativamente segura — dá escala do ambiente ao jogador
- Salas intermediárias: progressivamente tensas, corredores variados (1 a 3 tiles de largura)
- Sala do chefe: a maior e mais imponente — espaço generoso para combate dramático
- Decoração com "objeto_1" de forma narrativa:
  • Salas de guarda: barris e caixotes encostados nas paredes
  • Salões: colunas em posições simétricas
  • Sala do chefe: runas ou altares em posições de destaque
  • Celas ou câmaras: pedras dispersas, entulho
- Distribua "piso_2" em manchas irregulares — não em padrão, mas como se fossem manchas naturais
- Posicione inimigos com HP crescente conforme avançam em direção ao chefe
- Conecte TODAS as salas via corredores — nenhuma sala inacessível
- Prefira layouts assimétricos — dungeons reais não são simétricas
- Adapte tudo ao tema descrito pelos jogadores

══ COMO USAR ESTE PROMPT ══
1. Os jogadores descreverão os personagens desejados e o tema da dungeon nesta conversa
2. Ouça as solicitações com atenção
3. Quando prontos, gere o JSON completo conforme especificado acima
4. Os jogadores copiarão o JSON e colarão no sistema de RPG`;
}

// ── Merge canônico de blocos ──────────────────────────────────────────────────
// A IA costuma devolver "blocos" incompleto (o prompt de layout nunca incluía os
// canto_int_* que o prompt de imagem exige) — aceitar verbatim descartava chaves
// que o autotiler usa. Sempre parte do canônico, sobrepõe o fornecido e descarta
// referências fora do grid cols×rows (com aviso).
function _avtMergeBlocosCanonicos(fornecidos: any, cols: any, rows: any) {
  const blocos: any = {
    ..._faseTilesetBlocosCanonicos(cols, rows),
    ...((fornecidos && typeof fornecidos === 'object') ? fornecidos : {}),
  };
  for (const [k, v] of Object.entries(blocos)) {
    const m = String(v).match(/^bloco_(\d+)_(\d+)(?:@[1-7])?$/);
    if (!m || parseInt(m[1], 10) >= cols || parseInt(m[2], 10) >= rows) {
      try { console.warn(`[tileset] bloco fora do grid ${cols}×${rows} descartado: ${k} → ${v}`); } catch (_) {}
      delete blocos[k];
    }
  }
  return blocos;
}

// ── Validação do JSON da campanha externa (personagens + tileset) ─────────────
function _avtValidarJSONCampanhaExterna(raw: any) {
  if (typeof raw === 'string') {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON inválido: não encontrou objeto { }');
    raw = JSON.parse(match[0]);
  }

  if (!raw.nome || typeof raw.nome !== 'string' || !raw.nome.trim())
    throw new Error('Campo "nome" ausente ou vazio');
  if (!Array.isArray(raw.characters) || !raw.characters.length)
    throw new Error('Campo "characters" ausente ou vazio');
  if (!raw.tileset_config || typeof raw.tileset_config !== 'object')
    throw new Error('Campo "tileset_config" ausente');

  const cfg = raw.tileset_config;
  const cfgCols = cfg.cols || 4;
  const cfgRows = cfg.rows || 4;
  const blocos = _avtMergeBlocosCanonicos(cfg.blocos, cfgCols, cfgRows);

  const mapa = cfg.mapa;
  if (!mapa || !Array.isArray(mapa.tiles) || !mapa.tiles.length)
    throw new Error('Campo "tileset_config.mapa.tiles" ausente ou vazio');

  const h = mapa.tiles.length;
  const w = mapa.tiles[0]?.length || 0;
  if (!h || !w) throw new Error('mapa.tiles vazio');

  return {
    nome:           raw.nome.trim(),
    characters:     raw.characters,
    tileset_config: {
      version: cfg.version || 2,
      cols:    cfgCols,
      rows:    cfgRows,
      blocos,
      mapa: {
        largura:         mapa.largura || w,
        altura:          mapa.altura  || h,
        tiles:           mapa.tiles,
        salas:           mapa.salas           || [],
        spawn_jogadores: mapa.spawn_jogadores || [],
        inimigos:        mapa.inimigos        || []
      }
    }
  };
}

// ── UI: copiar prompt de campanha externa ─────────────────────────────────────
function _avtCopiarPromptCampanhaExterna() {
  const cols = parseInt(document.getElementById('avt-ext-cols')?.value || '4', 10);
  const rows = parseInt(document.getElementById('avt-ext-rows')?.value || '4', 10);
  const prompt = _avtPromptCampanhaExterna({ cols, rows });
  navigator.clipboard.writeText(prompt)
    .then(() => mostrarToast('📋 Prompt técnico copiado — abra a IA externa e cole!', 'ok'))
    .catch(() => mostrarToast('Erro ao copiar', 'err'));
}

// ── UI: copiar prompt de imagem do tileset (modo ia_externa) ──────────────────
function _avtCopiarPromptImagemExterna() {
  const cols = parseInt(document.getElementById('avt-ext-cols')?.value || '4', 10);
  const rows = parseInt(document.getElementById('avt-ext-rows')?.value || '4', 10);
  const prompt = faseTilesetImgPromptTemplate({ estilo: 'pixel art fantasy dungeon', cols, rows });
  navigator.clipboard.writeText(prompt)
    .then(() => mostrarToast('📋 Prompt de imagem copiado — use no Midjourney, DALL-E ou similar!', 'ok'))
    .catch(() => mostrarToast('Erro ao copiar', 'err'));
}

// ── UI: selecionar imagem (modo ia_externa — usa IDs distintos) ───────────────
function _avtExtHandleImageSelect(input: any) {
  const file = input?.files?.[0];
  if (!file) return;
  (AVT_STATE._criando as any)._tilesetImgFile = file;
  const url = URL.createObjectURL(file);
  (AVT_STATE._criando as any)._tilesetImgUrl = url;
  const prev = document.getElementById('avt-ext-img-preview');
  if (prev) { prev.src = url; prev.style!.display = 'block'; }
  const nome = document.getElementById('avt-ext-img-nome');
  if (nome) nome.textContent = file.name;
}

// ── UI: colar JSON da campanha externa ────────────────────────────────────────
function _avtExtHandleJSONPaste(val: any) {
  const status = document.getElementById('avt-ext-json-status');
  if (!val.trim()) { if (status) status.textContent = ''; return; }
  try {
    const data = _avtValidarJSONCampanhaExterna(val);
    if (data.tileset_config?.mapa?.tiles)
      data.tileset_config.mapa.tiles = _avtNormalizarTilesParedes(data.tileset_config.mapa.tiles);
    (AVT_STATE._criando as any)._extCampanhaJSON = data;
    if (data.nome) AVT_STATE._criando.nome = data.nome;
    const w = data.tileset_config.mapa.largura;
    const h = data.tileset_config.mapa.altura;
    const nc = data.characters.length;
    const ns = data.tileset_config.mapa.salas?.length || 0;
    const nomeCampanha = data.nome ? ` — <b>${data.nome}</b>` : '';
    if (status) status.innerHTML =
      `<span style="color:#27ae60">✓ ${nc} personagem(ns) + mapa ${w}×${h} — ${ns} sala(s)${nomeCampanha}</span>`;
  } catch (e: any) {
    (AVT_STATE._criando as any)._extCampanhaJSON = null;
    if (status) status.innerHTML = `<span style="color:#e74c3c">✗ ${e.message}</span>`;
  }
}

// ── Validação do JSON combinado ───────────────────────────────────────────────
function faseTilesetValidarJSON(raw: any) {
  if (typeof raw === 'string') {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON inválido: não encontrou objeto { }');
    raw = JSON.parse(match[0]);
  }

  const cols = raw.cols || 4;
  const rows = raw.rows || 4;
  const blocos = _avtMergeBlocosCanonicos(raw.blocos, cols, rows);

  const result = {
    version: raw.version || 2,
    cols, rows,
    blocos,
    mapa:    raw.mapa    || null
  };

  if (result.mapa) {
    if (!Array.isArray(result.mapa.tiles)) throw new Error('Campo "mapa.tiles" ausente ou inválido');
    const h = result.mapa.tiles.length;
    const w = result.mapa.tiles[0]?.length || 0;
    if (!h || !w) throw new Error('mapa.tiles vazio');
    result.mapa.largura = result.mapa.largura || w;
    result.mapa.altura  = result.mapa.altura  || h;
    result.mapa.salas   = result.mapa.salas   || [];
    result.mapa.spawn_jogadores = result.mapa.spawn_jogadores || [];
    result.mapa.inimigos        = result.mapa.inimigos        || [];
  }

  return result;
}

// Converte mapa do tileset em dungeon_data compatível com o engine
function faseTilesetToDungeonData(config: any) {
  const m = config.mapa;
  if (!m?.tiles) return null;
  const h = m.tiles.length;
  const w = m.tiles[0]?.length || 0;
  return {
    tiles:          m.tiles,      // string-key grid
    w, h,
    rooms:          m.salas       || [],
    _inimigosJson:  m.inimigos    || [],
    _spawnJogadores: m.spawn_jogadores || [],
    tileset_config:  config,      // embedded
    tileset_img_url: null as any         // preenchido após upload
  };
}

// ── Estado do módulo ──────────────────────────────────────────────────────────
let _tilesetImgFile: any = null;

// ── UI: copiar prompt de imagem ───────────────────────────────────────────────
function faseTilesetCopiarPromptImagem() {
  const estilo = document.getElementById('avt-tileset-desc')?.value?.trim()
                 || AVT_STATE._criando?.nome || 'pixel art fantasy dungeon';
  const cols   = parseInt(document.getElementById('avt-tileset-cols')?.value || '4', 10);
  const rows   = parseInt(document.getElementById('avt-tileset-rows')?.value || '4', 10);
  const prompt = faseTilesetImgPromptTemplate({ estilo, cols, rows });
  navigator.clipboard.writeText(prompt)
    .then(() => mostrarToast('📋 Prompt de imagem copiado!', 'ok'))
    .catch(() => mostrarToast('Erro ao copiar', 'err'));
}

// ── UI: copiar prompt de layout ───────────────────────────────────────────────
function faseTilesetCopiarPromptLayout() {
  const descricao = document.getElementById('avt-tileset-desc')?.value?.trim()
                    || AVT_STATE._criando?.nome || 'a fantasy dungeon';
  const cols      = parseInt(document.getElementById('avt-tileset-cols')?.value || '4', 10);
  const rows      = parseInt(document.getElementById('avt-tileset-rows')?.value || '4', 10);
  const largura   = parseInt(document.getElementById('avt-tileset-largura')?.value || '24', 10);
  const altura    = parseInt(document.getElementById('avt-tileset-altura')?.value || '18', 10);
  const prompt    = faseTilesetLayoutPromptTemplate({ descricao, cols, rows, largura, altura });
  navigator.clipboard.writeText(prompt)
    .then(() => mostrarToast('📋 Prompt de layout copiado — envie junto com a imagem', 'ok'))
    .catch(() => mostrarToast('Erro ao copiar', 'err'));
}

// ── UI: selecionar imagem ─────────────────────────────────────────────────────
function faseTilesetHandleImageSelect(input: any) {
  const file = input?.files?.[0];
  if (!file) return;
  _tilesetImgFile = file;
  (AVT_STATE._criando as any)._tilesetImgFile = file;
  const url = URL.createObjectURL(file);
  (AVT_STATE._criando as any)._tilesetImgUrl = url;
  const prev = document.getElementById('avt-tileset-img-preview');
  if (prev) { prev.src = url; prev.style!.display = 'block'; }
  const nome = document.getElementById('avt-tileset-img-nome');
  if (nome) nome.textContent = file.name;
  // Mostra botão de troca após imagem selecionada
  let btnTrocar = document.getElementById('avt-tileset-trocar-btn');
  const labelUpload = input.closest('label');
  if (!btnTrocar && labelUpload) {
    btnTrocar = document.createElement('button');
    btnTrocar.id = 'avt-tileset-trocar-btn';
    btnTrocar.type = 'button';
    btnTrocar.textContent = '🔄 Trocar imagem';
    btnTrocar.style!.cssText = 'margin-top:6px;padding:5px 10px;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.25);border-radius:5px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;text-transform:uppercase;letter-spacing:.05em';
    btnTrocar.onclick = faseTilesetTrocarImagem;
    labelUpload.parentNode.insertBefore(btnTrocar, labelUpload.nextSibling);
  }
  if (btnTrocar) btnTrocar.style!.display = 'inline-block';
  if (labelUpload) labelUpload.style.display = 'none';
}

function faseTilesetTrocarImagem() {
  _tilesetImgFile = null;
  if (AVT_STATE._criando) {
    (AVT_STATE._criando as any)._tilesetImgFile = null;
    (AVT_STATE._criando as any)._tilesetImgUrl = null;
  }
  const prev = document.getElementById('avt-tileset-img-preview');
  if (prev) { prev.src = ''; prev.style!.display = 'none'; }
  const nome = document.getElementById('avt-tileset-img-nome');
  if (nome) nome.textContent = '';
  const btnTrocar = document.getElementById('avt-tileset-trocar-btn');
  if (btnTrocar) {
    const labelUpload = btnTrocar.previousElementSibling;
    if (labelUpload && labelUpload.tagName === 'LABEL') labelUpload.style!.display = '';
    btnTrocar.style!.display = 'none';
  }
}

// ── UI: colar JSON de layout ──────────────────────────────────────────────────
function faseTilesetHandleJSONPaste(val: any) {
  const status = document.getElementById('avt-tileset-json-status');
  if (!val.trim()) { if (status) status.textContent = ''; return; }
  try {
    const cfg = faseTilesetValidarJSON(val);
    if (cfg.mapa?.tiles) cfg.mapa.tiles = _avtNormalizarTilesParedes(cfg.mapa.tiles);
    (AVT_STATE._criando as any)._tilesetConfig = cfg;
    const w = cfg.mapa?.largura || '?', h = cfg.mapa?.altura || '?';
    const hasMapa = !!cfg.mapa?.tiles;
    if (status) status.innerHTML = hasMapa
      ? `<span style="color:#27ae60">✓ Tileset + mapa ${w}×${h} válidos — ${cfg.mapa.salas?.length||0} salas</span>`
      : `<span style="color:#e67e22">⚠ Tileset válido mas sem "mapa.tiles" — a IA não incluiu o layout</span>`;
  } catch (e: any) {
    (AVT_STATE._criando as any)._tilesetConfig = null;
    if (status) status.innerHTML = `<span style="color:#e74c3c">✗ ${e.message}</span>`;
  }
}

// ── Carregar tileset e pré-cortar blocos ──────────────────────────────────────
async function _avtCarregarTileset(imgUrl: any, config: any) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = (typeof normalizeImgUrl === 'function') ? normalizeImgUrl(imgUrl) : imgUrl;
  });

  const cols = config.cols || 4;
  const rows = config.rows || 4;
  const sep  = config.separador_px || 0;
  // Tile dimensions excluding optional visible separator lines
  const imgW = img.naturalWidth, imgH = img.naturalHeight;
  const sw = (imgW - sep * (cols + 1)) / cols;
  const sh = (imgH - sep * (rows + 1)) / rows;
  const textures: Record<string, any> = {};

  for (const [semanticKey, blocoRef] of Object.entries<any>(config.blocos || {})) {
    // Suporta rotação no valor do bloco: "bloco_1_0@1" = mesma arte, girada 90°
    // (dedup: as 4 faces de parede podem sair de 1 célula do atlas).
    const match = String(blocoRef).match(/^bloco_(\d+)_(\d+)(?:@([1-7]))?$/);
    if (!match) continue;
    const col = parseInt(match[1]), row = parseInt(match[2]);
    const xf  = match[3] ? parseInt(match[3], 10) : 0;

    // Round each boundary independently to avoid cumulative float drift
    const x0 = Math.round(sep + col * (sw + sep));
    const y0 = Math.round(sep + row * (sh + sep));
    const w0 = Math.round(sep + (col + 1) * (sw + sep)) - x0 - sep;
    const h0 = Math.round(sep + (row + 1) * (sh + sep)) - y0 - sep;

    const canvas = _avtTileXformCanvas(img, x0, y0, w0, h0, xf);

    const tileImg = new Image();
    tileImg.src = canvas.toDataURL('image/png');
    await new Promise(res => { tileImg.onload = res; tileImg.onerror = res; });
    textures[semanticKey] = tileImg;
  }

  (AVT_STATE as any)._tilesetTextures = textures;
  (AVT_STATE as any)._tilesetLoaded   = true;
}

// ── Hash pseudo-aleatório por posição (sem padrão diagonal) ──────────────────
// LCG avalanche — mesma semente → mesmo resultado, sem artefatos visíveis
function _tileRng(x: any, y: any) {
  let s = (Math.imul(x, 374761393) + Math.imul(y, 1103515245) + 12345) | 0;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
  return ((s ^ (s >>> 16)) >>> 0) / 0xFFFFFFFF;
}

// ── Lógica unificada de tipo de parede a partir de vizinhos ──────────────────
// N/S/E/W   = true se o vizinho cardinal é tile caminhável
// NE/NW/SE/SW = diagonais (opcionais) — usados para distinguir canto externo de interno
// blocos    = mapa de chaves semânticas disponíveis no tileset atual
//
// Canto EXTERNO (convexo): dois cardinais adjacentes são piso, diagonal entre eles é parede
// Canto INTERNO (côncavo): dois cardinais adjacentes são piso, diagonal entre eles também é piso
//   → ocorre nas junções corredor→sala onde o piso "dobra" ao redor da parede
function _avtTipoParede(N: any, S: any, E: any, W: any, NE: any, NW: any, SE: any, SW: any, blocos: any) {
  if (N && S && E && W) return 'piso_1';    // cercada por piso → tratar como piso

  // Cantos externos (convexos) — diagonal oposto aos cardinais livres é parede
  if (S && E && !N && !W && !SE) return 'canto_NO';
  if (S && W && !N && !E && !SW) return 'canto_NE';
  if (N && E && !S && !W && !NE) return 'canto_SO';
  if (N && W && !S && !E && !NW) return 'canto_SE';

  // Cantos internos (côncavos) — diagonal oposto também é piso → piso envolve este tile.
  // Retorna a CHAVE SEMÂNTICA (nunca a referência "bloco_C_R": o lookup de textura
  // e os predicados de colisão são indexados pela chave — devolver o block-ref
  // gerava tile invisível + colisão contraditória em toda junção côncava).
  if (S && E && !N && !W && SE)  return blocos?.canto_int_NO ? 'canto_int_NO' : 'parede_N';
  if (S && W && !N && !E && SW)  return blocos?.canto_int_NE ? 'canto_int_NE' : 'parede_N';
  if (N && E && !S && !W && NE)  return blocos?.canto_int_SO ? 'canto_int_SO' : 'parede_S';
  if (N && W && !S && !E && NW)  return blocos?.canto_int_SE ? 'canto_int_SE' : 'parede_S';

  if (N && S && !E && !W) return 'parede_N'; // corredor vertical
  if (E && W && !N && !S) return 'parede_O'; // corredor horizontal
  if (S && !N) return 'parede_N';
  if (N && !S) return 'parede_S';
  if (E && !W) return 'parede_O';
  if (W && !E) return 'parede_L';

  // Vértices externos: nenhum cardinal é piso, apenas uma diagonal.
  // Sem este caso o canto da sala fica vazio (null) — usa o canto convexo correspondente.
  if (SE && !NE && !NW && !SW) return 'canto_NO';
  if (SW && !NE && !NW && !SE) return 'canto_NE';
  if (NE && !NW && !SE && !SW) return 'canto_SO';
  if (NW && !NE && !SE && !SW) return 'canto_SE';
  return null;
}

// Conjunto canônico de chaves semânticas que representam parede/canto (tile sólido).
const _AVT_CHAVES_PAREDE = new Set([
  'parede_N','parede_S','parede_O','parede_L','parede_int',
  'canto_NO','canto_NE','canto_SO','canto_SE',
  'canto_int_NO','canto_int_NE','canto_int_SO','canto_int_SE',
]);

// Classifica uma célula (chave string OU número AVT_T) como parede sólida.
function _avtChaveEhParede(cell: any) {
  if (cell === null || cell === undefined) return true;            // void = sólido
  if (typeof cell === 'number') return cell === AVT_T.PAREDE;      // 0 = parede
  const base = _avtCellBase(cell);
  return _AVT_CHAVES_PAREDE.has(base) || base === 'parede';        // 'parede' legado
}

// ── Verificar se tile é passável (para colisão) ───────────────────────────────
// porta/porta_fase são PASSÁVEIS: são aberturas de corredor e o portal de saída
// (concordando com _avtChaveEhParede e _avtNormalizarTilesParedes, que já os
// tratavam como piso — a discordância selava corredores de mapas de IA).
function _avtTilePassavel(x: any, y: any, dungeon: any) {
  const t = dungeon.tiles[y]?.[x];
  if (t === null || t === undefined) return false;
  if (typeof t === 'number') return t === AVT_T.PISO || t === AVT_T.SAIDA;
  const base = _avtCellBase(t);
  return base.startsWith('piso') || base === 'bau' || base === 'porta' || base === 'porta_fase';
}

// ── Autotile para grids binários legados (0/1) ────────────────────────────────
function _avtGetTileSemanticKey(x: any, y: any, dungeon: any) {
  const tileAt = (tx: any, ty: any) => dungeon.tiles[ty]?.[tx] === AVT_T.PISO;
  const here = dungeon.tiles[y]?.[x];

  // SAÍDA com tileset: usa o tile de portal se existir; sem ele, null faz o
  // renderer cair no desenho legado da porta verde (antes caía no autotiler de
  // parede e a saída sumia atrás de um tile de muro).
  if (here === AVT_T.SAIDA) {
    const blocosS = (AVT_STATE as any)._tilesetConfig?.blocos;
    return blocosS?.porta_fase ? 'porta_fase' : null;
  }

  if (here === AVT_T.PISO) {
    if (dungeon._chestPositions?.some((p: any) => p.x === x && p.y === y)) return 'bau';
    const rng    = _tileRng(x, y);
    const config = (AVT_STATE as any)._tilesetConfig;
    const varCh  = config?.regras?.piso_variacao_chance ?? 0.15;
    const objCh  = config?.regras?.objeto_chance        ?? 0.03;
    if (rng < objCh)                                   return 'objeto_1';
    if (rng < varCh)                                   return 'piso_2';
    if (rng < varCh * 1.5 && config?.blocos?.piso_3)  return 'piso_3';
    return 'piso_1';
  }

  const N = tileAt(x, y-1), S = tileAt(x, y+1);
  const E = tileAt(x+1, y), W = tileAt(x-1, y);
  const NE = tileAt(x+1, y-1), NW = tileAt(x-1, y-1);
  const SE = tileAt(x+1, y+1), SW = tileAt(x-1, y+1);
  const blocos = (AVT_STATE as any)._tilesetConfig?.blocos;
  return _avtTipoParede(N, S, E, W, NE, NW, SE, SW, blocos);
}

// ── Normalização de grid: recalcula tiles de parede a partir dos vizinhos reais ─
// Recebe qualquer grid (strings semânticas OU binário 0/1).
// Preserva tiles de piso/especiais; recalcula apenas tiles de parede/canto.
function _avtNormalizarTilesParedes(tiles: any) {
  const ehPiso = (x: any, y: any) => {
    const t = tiles[y]?.[x];
    if (t === null || t === undefined) return false;
    if (typeof t === 'number') return t === 1;
    const base = _avtCellBase(t);
    return base.startsWith('piso') || base === 'bau' ||
           base.startsWith('objeto') || base === 'porta' || base === 'porta_fase';
  };

  const chavesParede = new Set([
    'parede_N','parede_S','parede_O','parede_L',
    'canto_NO','canto_NE','canto_SO','canto_SE','parede_int',
    'canto_int_NO','canto_int_NE','canto_int_SO','canto_int_SE',
  ]);

  const blocos = (AVT_STATE as any)._tilesetConfig?.blocos;
  const h = tiles.length, w = tiles[0]?.length || 0;
  const resultado = [];

  for (let y = 0; y < h; y++) {
    const linha = [];
    for (let x = 0; x < w; x++) {
      const cell = tiles[y][x];
      if (cell === null || cell === undefined) { linha.push(null); continue; }

      const eParede = typeof cell === 'number'
        ? cell !== 1
        : chavesParede.has(_avtCellBase(cell));

      if (!eParede) { linha.push(cell); continue; }

      const N = ehPiso(x, y-1), S = ehPiso(x, y+1);
      const E = ehPiso(x+1, y), W = ehPiso(x-1, y);
      const count = (N?1:0)+(S?1:0)+(E?1:0)+(W?1:0);
      if (count === 0) { linha.push(null); continue; }
      const NE = ehPiso(x+1, y-1), NW = ehPiso(x-1, y-1);
      const SE = ehPiso(x+1, y+1), SW = ehPiso(x-1, y+1);
      linha.push(_avtTipoParede(N, S, E, W, NE, NW, SE, SW, blocos));
    }
    resultado.push(linha);
  }
  return resultado;
}

// ── PixiJS: carregar tileset (modo fase-renderer) ─────────────────────────────
async function _faseTilesetCarregar(rd: any) {
  const config = rd.tileset_config;
  const imgUrl = rd.tileset_img_url;
  if (!config || !imgUrl) return;

  const url = (typeof normalizeImgUrl === 'function') ? normalizeImgUrl(imgUrl) : imgUrl;
  const base = await PIXI.Assets.load(url).catch((): any => null);
  if (!base) return;

  const bt   = base.baseTexture || base;
  const cols = config.cols || 4;
  const rows = config.rows || 4;
  const sep  = config.separador_px || 0;
  // Tile dimensions excluding optional visible separator lines
  const sw = (bt.width  - sep * (cols + 1)) / cols;
  const sh = (bt.height - sep * (rows + 1)) / rows;

  const textures: Record<string, any> = {};
  for (const [semanticKey, blocoRef] of Object.entries<any>(config.blocos || {})) {
    const match = String(blocoRef).match(/^bloco_(\d+)_(\d+)(?:@([1-7]))?$/);
    if (!match) continue;
    const col = parseInt(match[1]), row = parseInt(match[2]);
    const xf  = match[3] ? parseInt(match[3], 10) : 0;
    // Round each boundary independently to avoid cumulative float drift
    const x0 = Math.round(sep + col * (sw + sep));
    const y0 = Math.round(sep + row * (sh + sep));
    const w0 = Math.round(sep + (col + 1) * (sw + sep)) - x0 - sep;
    const h0 = Math.round(sep + (row + 1) * (sh + sep)) - y0 - sep;
    const drawableSrc: any = (bt as any).resource?.source;
    if (xf && drawableSrc) {
      // Rotação materializada via canvas (mais simples e portátil que groupD8)
      const cv = _avtTileXformCanvas(drawableSrc, x0, y0, w0, h0, xf);
      textures[semanticKey] = PIXI.Texture.from(cv);
    } else {
      textures[semanticKey] = new PIXI.Texture(bt, new PIXI.Rectangle(x0, y0, w0, h0));
    }
  }

  if (typeof FASE_STATE !== 'undefined') {
    (FASE_STATE as any)._tilesetTextures = textures;
    (FASE_STATE as any)._tilesetConfig   = config;
  }
}

// ── PixiJS: renderizar grade de tiles com tileset ────────────────────────────
function _faseRenderDungeonTiles(layer: any, rd: any) {
  const dungeon = rd.dungeon_data || rd.tileset_config?.mapa;
  if (!dungeon?.tiles) return;
  const textures = FASE_STATE?._tilesetTextures;
  if (!textures) return;
  // Display tile size in world units — independent of source image resolution
  const displayTs = (typeof FASE_TILE_SZ !== 'undefined') ? FASE_TILE_SZ : 64;
  const h = dungeon.tiles.length;

  for (let y = 0; y < h; y++) {
    const row = dungeon.tiles[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const cell = row[x];
      const key  = typeof cell === 'string' ? _avtCellBase(cell) : _avtGetTileSemanticKey(x, y, dungeon);
      const tex  = key ? textures[key] : null;
      if (!tex) continue;
      const spr = new PIXI.Sprite(tex);
      const xf = _avtCellXform(cell);
      if (xf) {
        // Transform D4 da célula: rotação/flip em torno do centro do tile
        spr.anchor.set(0.5);
        spr.x = x * displayTs + displayTs / 2; spr.y = y * displayTs + displayTs / 2;
        spr.rotation = (xf & 3) * Math.PI / 2;
        spr.width = displayTs; spr.height = displayTs;
        if (xf >= 4) spr.scale.x = -Math.abs(spr.scale.x);
      } else {
        spr.x = x * displayTs; spr.y = y * displayTs;
        spr.width = displayTs; spr.height = displayTs;
      }
      layer.addChild(spr);
    }
  }
}

/* [migração-esm] accessors globais */
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtCellBase", { configurable: true, get: () => _avtCellBase, set: (__v) => { _avtCellBase = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtCellXform", { configurable: true, get: () => _avtCellXform, set: (__v) => { _avtCellXform = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtCellCom", { configurable: true, get: () => _avtCellCom, set: (__v) => { _avtCellCom = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtDrawTileXform", { configurable: true, get: () => _avtDrawTileXform, set: (__v) => { _avtDrawTileXform = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtTileXformCanvas", { configurable: true, get: () => _avtTileXformCanvas, set: (__v) => { _avtTileXformCanvas = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMergeBlocosCanonicos", { configurable: true, get: () => _avtMergeBlocosCanonicos, set: (__v) => { _avtMergeBlocosCanonicos = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_faseTilesetBlocosCanonicos", { configurable: true, get: () => _faseTilesetBlocosCanonicos, set: (__v) => { _faseTilesetBlocosCanonicos = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseTilesetImgPromptTemplate", { configurable: true, get: () => faseTilesetImgPromptTemplate, set: (__v) => { faseTilesetImgPromptTemplate = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseTilesetLayoutPromptTemplate", { configurable: true, get: () => faseTilesetLayoutPromptTemplate, set: (__v) => { faseTilesetLayoutPromptTemplate = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtPromptCampanhaExterna", { configurable: true, get: () => _avtPromptCampanhaExterna, set: (__v) => { _avtPromptCampanhaExterna = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtValidarJSONCampanhaExterna", { configurable: true, get: () => _avtValidarJSONCampanhaExterna, set: (__v) => { _avtValidarJSONCampanhaExterna = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtCopiarPromptCampanhaExterna", { configurable: true, get: () => _avtCopiarPromptCampanhaExterna, set: (__v) => { _avtCopiarPromptCampanhaExterna = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtCopiarPromptImagemExterna", { configurable: true, get: () => _avtCopiarPromptImagemExterna, set: (__v) => { _avtCopiarPromptImagemExterna = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtExtHandleImageSelect", { configurable: true, get: () => _avtExtHandleImageSelect, set: (__v) => { _avtExtHandleImageSelect = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtExtHandleJSONPaste", { configurable: true, get: () => _avtExtHandleJSONPaste, set: (__v) => { _avtExtHandleJSONPaste = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseTilesetValidarJSON", { configurable: true, get: () => faseTilesetValidarJSON, set: (__v) => { faseTilesetValidarJSON = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseTilesetToDungeonData", { configurable: true, get: () => faseTilesetToDungeonData, set: (__v) => { faseTilesetToDungeonData = __v; } });
Object.defineProperty(globalThis, "_tilesetImgFile", { configurable: true, get: () => _tilesetImgFile, set: (__v) => { _tilesetImgFile = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseTilesetCopiarPromptImagem", { configurable: true, get: () => faseTilesetCopiarPromptImagem, set: (__v) => { faseTilesetCopiarPromptImagem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseTilesetCopiarPromptLayout", { configurable: true, get: () => faseTilesetCopiarPromptLayout, set: (__v) => { faseTilesetCopiarPromptLayout = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseTilesetHandleImageSelect", { configurable: true, get: () => faseTilesetHandleImageSelect, set: (__v) => { faseTilesetHandleImageSelect = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseTilesetTrocarImagem", { configurable: true, get: () => faseTilesetTrocarImagem, set: (__v) => { faseTilesetTrocarImagem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseTilesetHandleJSONPaste", { configurable: true, get: () => faseTilesetHandleJSONPaste, set: (__v) => { faseTilesetHandleJSONPaste = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtCarregarTileset", { configurable: true, get: () => _avtCarregarTileset, set: (__v) => { _avtCarregarTileset = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_tileRng", { configurable: true, get: () => _tileRng, set: (__v) => { _tileRng = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtTipoParede", { configurable: true, get: () => _avtTipoParede, set: (__v) => { _avtTipoParede = __v; } });
Object.defineProperty(globalThis, "_AVT_CHAVES_PAREDE", { configurable: true, get: () => _AVT_CHAVES_PAREDE });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtChaveEhParede", { configurable: true, get: () => _avtChaveEhParede, set: (__v) => { _avtChaveEhParede = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtTilePassavel", { configurable: true, get: () => _avtTilePassavel, set: (__v) => { _avtTilePassavel = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtGetTileSemanticKey", { configurable: true, get: () => _avtGetTileSemanticKey, set: (__v) => { _avtGetTileSemanticKey = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtNormalizarTilesParedes", { configurable: true, get: () => _avtNormalizarTilesParedes, set: (__v) => { _avtNormalizarTilesParedes = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_faseTilesetCarregar", { configurable: true, get: () => _faseTilesetCarregar, set: (__v) => { _faseTilesetCarregar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_faseRenderDungeonTiles", { configurable: true, get: () => _faseRenderDungeonTiles, set: (__v) => { _faseRenderDungeonTiles = __v; } });
