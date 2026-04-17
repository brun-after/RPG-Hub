# Mapeamento de Funções — RPG Hub

> Documento gerado progressivamente. Cada seção cobre um arquivo JS, mapeando suas funções, o que fazem, e quais dependências externas (funções ou variáveis definidas em outros arquivos) cada uma requer.

---

## Índice de Arquivos

| # | Arquivo | Linhas | Status |
|---|---------|--------|--------|
| 1 | `js/init.js` | 5 | ✅ Mapeado |
| 2 | `sw.js` | 6 | ✅ Mapeado |
| 3 | `js/core/events.js` | 50 | ✅ Mapeado |
| 4 | `js/core/utils.js` | 64 | ✅ Mapeado |
| 5 | `js/config.js` | 91 | ✅ Mapeado |
| 6 | `js/systems/rest.js` | 98 | ✅ Mapeado |
| 7 | `js/systems/npcs.js` | 176 | ✅ Mapeado |
| 8 | `js/core/realtime.js` | 269 | ✅ Mapeado |
| 9 | `js/chat/chat.js` | 324 | ✅ Mapeado |
| 10 | `js/combat/animations.js` | 382 | ✅ Mapeado |
| 11 | `js/maps/camera.js` | 394 | ✅ Mapeado |
| 12 | `js/systems/lore.js` | 417 | ✅ Mapeado |
| 13 | `js/state.js` | 441 | ✅ Mapeado |
| 14 | `js/auth/auth.js` | 482 | ✅ Mapeado |
| 15 | `js/core/supabase.js` | 504 | ✅ Mapeado |
| 16 | `js/characters/characters.js` | 581 | ✅ Mapeado |
| 17 | `js/characters/skills.js` | 627 | ✅ Mapeado |
| 18 | `js/hub/hub.js` | 2300 | 🔄 Em progresso (linhas 1–1472) |
| 19 | `js/systems/inventory.js` | 2222 | — |
| 20 | `js/ui/tabs.js` | 2229 | — |
| 21 | `js/systems/creative.js` | 2456 | — |
| 22 | `js/hub/import.js` | 2676 | — |
| 23 | `js/systems/arena.js` | 3720 | — |
| 24 | `js/combat/combat.js` | 4321 | — |
| 25 | `js/ui/modals.js` | 2591 | — |
| 26 | `js/systems/catalog.js` | 9233 | — *(2 partes)* |
| 27 | `js/maps/maps.js` | 10012 | — *(2 partes)* |

---

## 1. `js/init.js`

**Linhas:** 5  
**Descrição geral:** Marcador de inicialização da aplicação. Emite um log no console confirmando que todos os módulos foram carregados via tags `<script>` no HTML.

### Funções definidas

*Nenhuma.*

### Variáveis/constantes definidas

*Nenhuma.*

### Dependências externas

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `console.log` | API nativa | Browser |

### Observações

Arquivo de sinalização: é o último `<script>` carregado no `index.html`, indicando que todos os outros módulos já estão disponíveis no escopo global.

---

## 2. `sw.js`

**Linhas:** 6  
**Descrição geral:** Service Worker mínimo para habilitar a instalação do app como PWA. Não implementa cache — todas as requisições vão direto à rede.

### Funções definidas

*Nenhuma função nomeada. Dois listeners anônimos registrados via `self.addEventListener`:*

| Evento | Linha | O que faz |
|--------|-------|-----------|
| `install` | 5 | Chama `self.skipWaiting()` para ativar o SW imediatamente, sem esperar o ciclo normal |
| `activate` | 6 | Chama `self.clients.claim()` para que o SW assuma controle das abas abertas sem necessidade de reload |

### Variáveis/constantes definidas

*Nenhuma.*

### Dependências externas

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `self.addEventListener` | Service Worker API | Browser |
| `self.skipWaiting()` | Service Worker API | Browser |
| `self.clients.claim()` | Service Worker API | Browser |

### Observações

Propositalmente sem handler de `fetch`: o app busca sempre dados frescos do Supabase, sem cache offline.

---

## 3. `js/core/events.js`

**Linhas:** 50  
**Descrição geral:** Helpers de permissão de usuário e utilitário de estado de batalha. O event bus (`HUB_EVENTS`) está definido em `config.js`, não aqui.

### Funções definidas

#### `temPermissao(chave)` — linha 7
Verifica se o usuário atual possui uma permissão específica.
- Mestre sempre retorna `true`.
- Jogadores: consulta `RPG_DATA.myPermissoes[chave]`; se não configurado, usa o valor padrão de `PERMISSOES_CONFIG`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA` | objeto global | `js/state.js` |
| `RPG_DATA.myRole` | propriedade | `js/state.js` |
| `RPG_DATA.myPermissoes` | propriedade | `js/state.js` |
| `PERMISSOES_CONFIG` | array global | não identificado ainda |

---

#### `podeEditarPersonagem(nomePersonagem)` — linha 14
Retorna `true` se o usuário pode editar o personagem informado.
- Mestre: sempre pode.
- Jogador: apenas se `RPG_DATA.linked` for igual ao nome do personagem.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA.myRole` | propriedade | `js/state.js` |
| `RPG_DATA.linked` | propriedade | `js/state.js` |

---

#### `_estadoBatalhaJogador(nomePersonagem)` — linha 23
Retorna o estado de batalha do personagem do ponto de vista do jogador. Valores possíveis:
- `'livre'` → mestre, ou está em combate ativo e é o seu turno
- `'fora_combate'` → sem batalha ativa que inclua o personagem
- `'outro_turno'` → batalha ativa, mas não é o turno do personagem

Suporta dois modos: **Arena** (usa `AR.iniciativa`) e **Campanha normal** (usa `MAPA_STATE.batalhas`).

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `AR` | objeto global (Arena) | `js/systems/arena.js` |
| `AR.session` | propriedade | `js/systems/arena.js` |
| `AR.myRole` | propriedade | `js/systems/arena.js` |
| `AR.iniciativa` | propriedade | `js/systems/arena.js` |
| `RPG_DATA.myRole` | propriedade | `js/state.js` |
| `MAPA_STATE` | objeto global | `js/state.js` |
| `MAPA_STATE.batalhas` | propriedade | `js/state.js` |

---

## 4. `js/core/utils.js`

**Linhas:** 64  
**Descrição geral:** Sistema de ícones e animações SVG customizados, usados em cards e telas de carregamento. Suporta tipos built-in e SVGs customizados via CSV.

### Funções definidas

#### `injectCustomCSS(rpgId, css)` — linha 11
Injeta ou atualiza um bloco `<style>` no `document.head` com CSS customizado, identificado pelo id `custom-anim-{rpgId}`.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `document.getElementById` | DOM API | Browser |
| `document.createElement` | DOM API | Browser |
| `document.head.appendChild` | DOM API | Browser |

---

#### `processCustomSVG(svg, color1, color2)` — linha 24
Função pura. Substitui os tokens `#COLOR1` e `#COLOR2` em uma string SVG pelas cores fornecidas. Retorna `null` se `svg` for falsy.

**Dependências externas:** *Nenhuma.*

---

#### `getCardIconSVG(tipo, c1, c2, customSVG)` — linha 30
Retorna uma string SVG para o ícone de um card. Se `customSVG` for fornecido, processa e retorna ele via `processCustomSVG`. Caso contrário, usa os tipos built-in: `flame`, `rune`, `gear`, `crystal`, `spirit`, `sigil` (fallback para um hexágono genérico).

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `processCustomSVG` | função | mesmo arquivo (`utils.js` linha 24) |

---

#### `getLoadingAnimSVG(tipo, customSVG)` — linha 48
Retorna uma string HTML (`<div class="anim-{tipo}">…</div>`) com SVG animado para estados de carregamento. Suporta os mesmos tipos de `getCardIconSVG`. Usa variáveis CSS (`--destaque`, `--primario`, `--primario-v`, `--destaque-v`) para colorização.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| CSS vars `--destaque`, `--primario`, `--primario-v`, `--destaque-v` | variáveis CSS | folha de estilos global |

---

## 5. `js/config.js`

**Linhas:** 91  
**Descrição geral:** Arquivo de configuração central. Define credenciais do Supabase, hCaptcha, o event bus global `HUB_EVENTS`, e utilitários de tamanho de personagem por dispositivo.

### Variáveis/constantes definidas

| Nome | Linha | Valor / Descrição |
|------|-------|-------------------|
| `SUPABASE_URL` | 9 | URL do projeto Supabase |
| `SUPABASE_KEY` | 10 | Chave anon pública do Supabase |
| `HCAPTCHA_SITEKEY` | 11 | Site key do hCaptcha |
| `EMAIL_CONFIRMATION_ENABLED` | 90 | `true` — habilita confirmação de e-mail no fluxo de auth |
| `HUB_EVENTS` | 17 | Objeto event bus (IIFE) — exposto globalmente |

### Funções definidas

#### `HUB_EVENTS.on(tipo, fn)` — linha 20
Registra um listener `fn` para o evento `tipo`.  
**Deps externas:** *Nenhuma* (usa closure `_listeners` interno).

#### `HUB_EVENTS.off(tipo, fn)` — linha 24
Remove o listener `fn` do evento `tipo`.  
**Deps externas:** *Nenhuma.*

#### `HUB_EVENTS.emit(tipo, dados)` — linha 28
Dispara todos os listeners registrados para `tipo`, passando `dados`. Captura erros com `console.warn`.  
**Deps externas:** *Nenhuma.*

---

#### `_isMobile()` — linha 59
Retorna `true` se a viewport for ≤ 768px ou se o user-agent indicar dispositivo móvel (Android/iPhone/iPad/iPod).

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `window.innerWidth` | Browser API | Browser |
| `navigator.userAgent` | Browser API | Browser |

---

#### `_charSizeKey(nome)` — linha 64
Retorna a chave de localStorage para o tamanho do personagem `nome`, escopada pelo `rpgId` do RPG atual.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `window.RPG_DATA.rpgId` | propriedade global | `js/state.js` (opcional; fallback `'default'`) |

---

#### `_getMobileSize(nome)` — linha 69
Lê o tamanho de personagem salvo no `localStorage`. Retorna `null` se não encontrado ou em caso de erro.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `localStorage` | Browser API | Browser |
| `_charSizeKey` | função | mesmo arquivo (`config.js` linha 64) |

---

#### `_setMobileSize(nome, val)` — linha 76
Salva o tamanho do personagem no `localStorage`. Ignora erros silenciosamente.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `localStorage` | Browser API | Browser |
| `_charSizeKey` | função | mesmo arquivo (`config.js` linha 64) |

---

#### `window._getCharTamanhoEfetivo(nome, ca)` — linha 81
Retorna o tamanho efetivo de exibição de um personagem no canvas/mapa.
- Em mobile: usa valor salvo no localStorage (via `_getMobileSize`), com mínimo de `0.4`.
- Em desktop: usa `ca.aparencia.tamanho` com mínimo de `0.4` (padrão `1.0`).

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `_isMobile` | função | mesmo arquivo (`config.js` linha 59) |
| `_getMobileSize` | função | mesmo arquivo (`config.js` linha 69) |
| `window.RPG_DATA` | objeto global | `js/state.js` (opcional) |

### Eventos disponíveis no `HUB_EVENTS` (documentados no arquivo)

| Evento | Dados | Descrição |
|--------|-------|-----------|
| `token_moveu` | `{ nome, deCelula, paraCelula, movimentoRestante }` | Token movido no mapa |
| `dano_aplicado` | `{ atacante, alvo, valor, tipo }` | Dano aplicado a um personagem |
| `cura_aplicada` | `{ origem, alvo, valor }` | Cura aplicada |
| `turno_avancou` | `{ personagem, rodada }` | Turno avançou |
| `habilidade_usada` | `{ personagem, habilidade, alvo }` | Habilidade usada |
| `zona_ativada` | `{ zona, personagem }` | Zona de efeito ativada |
| `cena_carregada` | `{ cena_id, nome }` | Nova cena/mapa carregado |
| `batalha_iniciada` | `{ mapa_id }` | Batalha iniciada |
| `batalha_encerrada` | `{ mapa_id, resultado }` | Batalha encerrada |
| `item_usado` | `{ personagem, item, efeito, aprovacao }` | Item consumido |
| `loot_dropado` | `{ npc, itens, posicao }` | Loot gerado por NPC |

---

## 6. `js/systems/rest.js`

**Linhas:** 98  
**Descrição geral:** Sistema de descanso (curto e longo) para personagens. Recupera HP, reseta cooldowns de habilidades e restaura atributos de recurso. Atualiza o banco via Supabase e re-renderiza a UI.

### Funções definidas

#### `descansoExecutar(tipo, nomePersonagem)` — linha 6 *(async)*
Executa o descanso para um único personagem.
- **Curto:** recupera `pctCurto * hpMax` HP (padrão 50%); reseta cooldowns com `tipo_recarga === 'descanso_curto'` na batalha atual.
- **Longo:** recupera HP máximo; zera todos os cooldowns; restaura atributos de recurso ao seu máximo (`e_recurso` + `max_attr` nas opções da attrDef); limpa estado moribundo/estabilizado.
- Persiste via `sb()` (PATCH em `characters`) e atualiza a UI local.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA` | objeto global | `js/state.js` |
| `RPG_DATA.characters` | array | `js/state.js` |
| `RPG_DATA.config` | objeto | `js/state.js` |
| `RPG_DATA.skills` | array | `js/state.js` |
| `RPG_DATA.attrDefs` | array | `js/state.js` |
| `RPG_DATA.rpgId` | string | `js/state.js` |
| `BATALHA_ATUAL_ID` | variável global | `js/maps/maps.js` ou `js/combat/combat.js` |
| `MAPA_STATE` | objeto global | `js/state.js` |
| `MAPA_STATE.batalhas` | objeto | `js/state.js` |
| `mostrarToast` | função | não identificado ainda |
| `sb` | função (fetch Supabase) | `js/core/supabase.js` |
| `renderCharView` | função | `js/characters/characters.js` (provável) |
| `renderAttrView` | função | `js/characters/characters.js` (provável) |
| `mapaRenderStatus` | função | `js/maps/maps.js` (provável) |

---

#### `descansoGrupo(tipo)` — linha 76 *(async)*
Aplica descanso (curto ou longo) a todos os personagens jogadores vivos (exclui NPCs e mortos). Envia mensagem do narrador no chat e re-renderiza tokens no mapa.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA.characters` | array | `js/state.js` |
| `descansoExecutar` | função | mesmo arquivo (`rest.js` linha 6) |
| `chatEnviarNarrador` | função | `js/chat/chat.js` (provável) |
| `MAPA_STATE.mapaAtualId` | propriedade | `js/state.js` |
| `RPG_DATA.mapas` | array | `js/state.js` |
| `mapaRenderTokens` | função | `js/maps/maps.js` (provável) |

---

## 7. `js/systems/npcs.js`

**Linhas:** 176  
**Descrição geral:** Criação de NPCs genéricos e posicionamento deles no mapa da campanha via clique. Inclui modal de criação, lógica de numeração sequencial e fila de placement.

### Variáveis definidas

| Nome | Linha | Tipo | Descrição |
|------|-------|------|-----------|
| `NPC_PLACEMENT_QUEUE` | 135 | `let` (array) | Fila de nomes de NPCs aguardando posicionamento no mapa |

### Funções definidas

#### `abrirModalNpcGenerico()` — linha 7
Abre o modal de criação de NPC genérico. Renderiza dinamicamente os campos de atributos básicos (`categoria === 'basico'`) com base em `RPG_DATA.attrDefs`. Suporta tipos `number`, `text`, `boolean` e `select`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `MAPA_STATE.mapaAtualId` | propriedade | `js/state.js` |
| `mostrarToast` | função | não identificado ainda |
| `RPG_DATA.attrDefs` | array | `js/state.js` |
| `document.getElementById` | DOM API | Browser |
| `fecharModalNpcGenerico` | função | mesmo arquivo (`npcs.js` linha 47) |

---

#### `fecharModalNpcGenerico()` — linha 47
Oculta o overlay do modal de NPC genérico. Função simples, sem dependências além do DOM.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `document.getElementById` | DOM API | Browser |

---

#### `criarNpcGenerico()` — linha 51 *(async)*
Lê os valores do formulário do modal e cria 1–20 NPCs no banco. Trata numeração sequencial (ex: "Goblin 1", "Goblin 2") evitando conflitos com nomes já existentes. Após criação, opcionalmente inicia o fluxo de posicionamento no mapa.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById` | DOM API | Browser |
| `mostrarToast` | função | não identificado ainda |
| `RPG_DATA.attrDefs` | array | `js/state.js` |
| `RPG_DATA.characters` | array | `js/state.js` |
| `RPG_DATA.rpgId` | string | `js/state.js` |
| `sb` | função (fetch Supabase) | `js/core/supabase.js` |
| `fecharModalNpcGenerico` | função | mesmo arquivo (`npcs.js` linha 47) |
| `renderAttrButtons` | função | não identificado ainda |
| `buildCharBtns` | função | não identificado ainda |
| `abrirModalNovoChar` | função | não identificado ainda |
| `MAPA_STATE.mapaAtualId` | propriedade | `js/state.js` |
| `npcGenericoIniciarPlacement` | função | mesmo arquivo (`npcs.js` linha 137) |
| `mapaRenderTokens` | função | `js/maps/maps.js` (provável) |
| `mapaRenderStatus` | função | `js/maps/maps.js` (provável) |

---

#### `npcGenericoIniciarPlacement(nomes)` — linha 137
Inicializa a fila de posicionamento com os nomes dos NPCs criados e chama o primeiro passo.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `NPC_PLACEMENT_QUEUE` | variável | mesmo arquivo (`npcs.js` linha 135) |
| `npcGenericoProximoPlacement` | função | mesmo arquivo (`npcs.js` linha 142) |

---

#### `npcGenericoProximoPlacement()` — linha 142
Processa o próximo NPC da fila de placement. Adiciona classe `placement-ativo` ao mapa e aguarda um clique do usuário. Ao clicar, calcula a posição percentual, faz snap para o centro da célula do grid e chama `setCharActiveMap` para persistir a posição. Recursiva — chama-se novamente após cada NPC posicionado.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `NPC_PLACEMENT_QUEUE` | variável | mesmo arquivo (`npcs.js` linha 135) |
| `RPG_DATA.mapas` | array | `js/state.js` |
| `MAPA_STATE.mapaAtualId` | propriedade | `js/state.js` |
| `mapaRenderTokens` | função | `js/maps/maps.js` (provável) |
| `mapaRenderStatus` | função | `js/maps/maps.js` (provável) |
| `mostrarToast` | função | não identificado ainda |
| `document.getElementById('mapa-wrap')` | DOM API | Browser / `index.html` |
| `_getMapaById` | função | `js/maps/maps.js` (provável) |
| `pctParaCelula` | função | `js/maps/maps.js` (provável) |
| `setCharActiveMap` | função | `js/maps/maps.js` (provável) |
| `npcGenericoProximoPlacement` | função (recursão) | mesmo arquivo |

---

## 8. `js/core/realtime.js`

**Linhas:** 269  
**Descrição geral:** Gerencia a conexão WebSocket com o Supabase Realtime. Assina múltiplos canais de dados e roteia eventos recebidos para os handlers corretos do sistema. Implementa reconexão automática com backoff exponencial.

### Variáveis globais referenciadas (definidas fora deste arquivo)

`realtimeWS` — referência global ao WebSocket atual (atribuída internamente).

### Funções definidas

#### `iniciarRealtime(rpgId)` — linha 6
Abre a conexão WebSocket e assina 9 canais Supabase Realtime:

| Canal | Dados monitorados |
|-------|-------------------|
| `characters` | Personagens do RPG |
| `lore` | Entradas de lore |
| `skills` | Habilidades |
| `attr_defs` | Definições de atributos |
| `rpg_registry` | Estado da batalha, arena e configurações |
| `batalhas` | Linhas da tabela de batalhas |
| `criativos` | Itens criativos |
| `mapas` | Mapas |
| `realtime:chat:{rpgId}` | Broadcast de chat, animações, tokens e combate |

Funções internas (closures):
- `conectar()` — cria o WebSocket, registra handlers `onopen/onmessage/onerror/onclose`
- `join(topic)` — envia `phx_join` para um canal
- `parseMapa(r)` — normaliza um registro da tabela `mapas` para o formato `{ id, rpg_id, mapa: {...} }`

Lógica de reconexão: backoff exponencial (`2^tentativas * 1000ms`, máx 30s). Mostra/oculta banner `#reconexao-banner`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `realtimeWS` | variável global | `js/state.js` |
| `SUPABASE_URL`, `SUPABASE_KEY` | constantes | `js/config.js` |
| `RPG_DATA` | objeto global | `js/state.js` |
| `MAPA_STATE` | objeto global | `js/state.js` |
| `CHAR_VIEW`, `ATTR_VIEW` | variáveis globais | `js/state.js` |
| `AR` | objeto global | `js/systems/arena.js` |
| `CURRENT_RPG` | variável global | `js/state.js` ou `js/hub/hub.js` |
| `chatIniciar` | função | `js/chat/chat.js` |
| `chatReceberMensagem` | função | `js/chat/chat.js` |
| `chatReceberPresenca` | função | `js/chat/chat.js` |
| `animReceberBroadcast` | função | `js/combat/animations.js` (provável) |
| `tokenMoveReceber` | função | `js/maps/maps.js` (provável) |
| `combateReceberBroadcast` | função | `js/combat/combat.js` (provável) |
| `_getMapaById` | função | `js/maps/maps.js` (provável) |
| `mapaRenderTokens` | função | `js/maps/maps.js` (provável) |
| `renderCharView` | função | `js/characters/characters.js` (provável) |
| `renderAttrView` | função | `js/characters/characters.js` (provável) |
| `renderCharButtons` | função | não identificado ainda |
| `mostrarToast` | função | não identificado ainda |
| `renderLore` | função | `js/systems/lore.js` (provável) |
| `batalhaReceberEstadoRemoto` | função | `js/combat/combat.js` (provável) |
| `renderMesa` | função | não identificado ainda |
| `batalhaReceberLinhaRemota` | função | `js/combat/combat.js` (provável) |
| `criativoReceberLinhaRemota` | função | `js/systems/creative.js` (provável) |
| `renderMapaViewer` | função | `js/maps/maps.js` (provável) |
| `renderMapasTab` | função | `js/maps/maps.js` (provável) |
| `chatAtualizarOnline` | função | `js/chat/chat.js` |
| `document` | DOM API | Browser |

---

#### `fecharRealtime()` — linha 247
Fecha o WebSocket ativo, oculta o indicador de status (`.realtime-dot`), limpa o intervalo de presença do chat e zera o estado de presença.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `realtimeWS` | variável global | `js/state.js` |
| `CHAT._presenceInterval` | propriedade | `js/state.js` |
| `CHAT.online`, `CHAT.rpgId` | propriedades | `js/state.js` |
| `chatAtualizarOnline` | função | `js/chat/chat.js` |
| `document.getElementById` | DOM API | Browser |

---

#### `realtimeBroadcast(tipo, payload)` — linha 258
Envia um evento broadcast genérico para todos os jogadores via WebSocket. Exportada em `window.realtimeBroadcast`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `realtimeWS` | variável global | `js/state.js` |
| `CURRENT_RPG` | variável global | `js/state.js` ou `js/hub/hub.js` |

---

## 9. `js/chat/chat.js`

**Linhas:** 324  
**Descrição geral:** Sistema de chat em tempo real via Supabase Realtime Broadcast. Sem tabela dedicada — usa broadcast para envio imediato e uma linha na tabela `lore` como cache persistente (cap de 1000 chars). Controla presença de usuários online.

### Constantes definidas

| Nome | Linha | Valor | Descrição |
|------|-------|-------|-----------|
| `CHAT_TTL` | 11 | `3 600 000` ms | Tempo de vida de uma mensagem (1 hora) |
| `CHAT_CHAR_CAP` | 12 | `1000` | Máximo de caracteres ao persistir no banco |
| `CHAT_LORE_SEC` | 13 | `'chat_cache'` | Nome da seção usada na tabela `lore` |

### Atribuições sobre o objeto global `CHAT`

| Propriedade | Linha | Descrição |
|-------------|-------|-----------|
| `CHAT._saveTimer` | 42 | Timer do debounce de salvamento no banco |
| `CHAT._loreId` | 43 | ID da linha `lore` usada como cache do chat |

### Funções definidas

#### `chatSerializar(msgs)` — linha 17
Filtra mensagens dentro do `CHAT_TTL` e remove as mais antigas até o array serializado caber em `CHAT_CHAR_CAP` caracteres. Retorna JSON string.  
**Deps externas:** *Nenhuma* (usa só constantes do mesmo arquivo).

---

#### `chatSalvarLocal(rpgId, msgs)` — linha 29
Salva o histórico serializado no `localStorage` com chave `chat_hist_{rpgId}`.

**Deps externas:** `localStorage` (Browser), `chatSerializar` (mesmo arquivo).

---

#### `chatLerLocal(rpgId)` — linha 32
Lê e filtra mensagens do `localStorage`, descartando as expiradas (> `CHAT_TTL`).

**Deps externas:** `localStorage` (Browser), `CHAT_TTL` (mesmo arquivo).

---

#### `chatAgendarSalvoBanco()` — linha 45
Debounce de 30 segundos: persiste o histórico serializado em uma linha da tabela `lore` (`secao = 'chat_cache'`). Cria a linha na primeira vez, atualiza nas demais.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `CHAT._saveTimer`, `CHAT.rpgId`, `CHAT.msgs`, `CHAT._loreId` | propriedades | `js/state.js` |
| `chatSerializar` | função | mesmo arquivo |
| `sb` | função (fetch Supabase) | `js/core/supabase.js` |

---

#### `chatCarregarDoBanco(rpgId)` — linha 69 *(async)*
Busca a linha de cache do chat na tabela `lore` e retorna as mensagens válidas (dentro do TTL).

**Dependências externas:** `sb` (supabase.js), `CHAT._loreId`, `CHAT_TTL`, `CHAT_LORE_SEC` (mesmo arquivo).

---

#### `chatIniciar(rpgId, wsRef)` — linha 79 *(async)*
Inicializa o chat: carrega histórico local imediatamente, depois mescla com dados do banco (dedup por `ts+autor+texto`). Faz join no canal broadcast `realtime:chat:{rpgId}` e inicia heartbeat de presença a cada 20s.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `CHAT.*` | objeto global | `js/state.js` |
| `chatLerLocal`, `chatRenderizar`, `chatCarregarDoBanco`, `chatSalvarLocal`, `chatAtualizarOnline` | funções | mesmo arquivo |
| `SESSION` | objeto global | `js/auth/auth.js` (provável) |
| `USER_ID` | variável global | `js/auth/auth.js` (provável) |
| `RPG_DATA.characters`, `RPG_DATA.linked` | propriedades | `js/state.js` |
| `_atualizarBadgeMesa` | função | não identificado ainda |
| `batalhaIdMinha` | função | `js/combat/combat.js` (provável) |
| `BATALHA_ATUAL_ID` | variável global | `js/maps/maps.js` ou `js/combat/combat.js` |
| `MAPA_STATE.batalhas` | propriedade | `js/state.js` |
| `batalhaRenderOrdemStrip` | função | `js/combat/combat.js` (provável) |
| `batalhaRenderVezLabel` | função | `js/combat/combat.js` (provável) |

---

#### `chatEnviar()` — linha 139
Lê o input `#chat-input`, envia a mensagem e renova presença via WebSocket. Usa o personagem vinculado ao usuário como identidade no chat. Suporta contexto de Arena (`AR.ws`) e Campanha (`realtimeWS`).

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById` | DOM API | Browser |
| `AR.session.rpg_id`, `AR.ws`, `AR.chars` | propriedades | `js/systems/arena.js` |
| `CURRENT_RPG.id` | propriedade | `js/state.js` ou `js/hub/hub.js` |
| `realtimeWS` | variável global | `js/state.js` |
| `RPG_DATA.characters`, `RPG_DATA.linked` | propriedades | `js/state.js` |
| `SESSION.nickname` | propriedade | `js/auth/auth.js` (provável) |
| `USER_ID` | variável global | `js/auth/auth.js` (provável) |
| `mostrarToast` | função | não identificado ainda |

---

#### `chatReceberMensagem(pkg)` — linha 170
Recebe pacote broadcast `{autor, cor, texto, ts}`, deduplica, appenda ao histórico, persiste localmente e agenda salvamento no banco. Incrementa `CHAT.naoLidos` se o chat estiver fechado.

**Deps externas:** `CHAT.*` (state.js), `chatSalvarLocal`, `chatAgendarSalvoBanco`, `chatAtualizarBadge`, `chatRenderizar` (mesmo arquivo), `SESSION`, `USER_ID`, `document`.

---

#### `chatRenderizar()` — linha 189
Renderiza os últimos 80 itens do histórico no elemento `#chat-mensagens`. Mensagens do sistema (`tipo === 'sistema'`) recebem estilo centralizado/itálico.

**Deps externas:** `document`, `CHAT.*`, `SESSION`, `USER_ID`, `chatEscapar`, `chatAtualizarOnline` (mesmo arquivo).

---

#### `chatReceberPresenca(pkg)` — linha 213
Atualiza `CHAT.online` com o pacote de presença recebido, descartando inativos (> 30s).

**Deps externas:** `CHAT.online`, `chatAtualizarOnline` (mesmo arquivo).

---

#### `chatAtualizarOnline()` — linha 224
Renderiza os indicadores de usuários online (dots coloridos + contador) no elemento `#chat-online`.

**Deps externas:** `document`, `CHAT.online`.

---

#### `chatMostrar(rpgId)` — linha 236
Exibe os botões de chat e reflash no header. Chat começa fechado.

**Deps externas:** `CHAT.*`, `document`, `chatAtualizarBadge` (mesmo arquivo).

---

#### `chatOcultar()` — linha 247
Remove a classe `visivel` do `#chat-container` e marca `CHAT.aberto = false`.

**Deps externas:** `document`, `CHAT.aberto`.

---

#### `reflashDados()` — linha 253 *(async)*
Recarrega todos os dados do RPG via `getRPGData()` e re-renderiza a interface completa sem mudar de aba.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `CURRENT_RPG.id` | propriedade | `js/state.js` ou `js/hub/hub.js` |
| `getRPGData` | função | `js/core/supabase.js` (provável) |
| `RPG_DATA` | objeto global | `js/state.js` |
| `CHAR_VIEW` | variável global | `js/state.js` |
| `renderHeader`, `renderLore`, `renderCharButtons`, `renderAttrButtons`, `renderDados`, `renderConfig`, `renderMapasTab`, `renderCharView`, `renderAttrView` | funções | vários arquivos |
| `mostrarToast` | função | não identificado ainda |
| `document` | DOM API | Browser |

---

#### `chatToggle()` — linha 279
Alterna visibilidade do painel de chat. Deps: `CHAT.aberto`, `chatOcultar`, `chatAbrir` (mesmo arquivo).

---

#### `chatAbrir()` — linha 287
Adiciona classe `visivel`, zera `naoLidos`, atualiza badge e renderiza. Foca o input.

**Deps externas:** `document`, `CHAT.*`, `chatAtualizarBadge`, `chatRenderizar` (mesmo arquivo).

---

#### `chatAtualizarBadge()` — linha 294
Atualiza o badge de não-lidos em dois lugares: `#chat-fab-badge` (header) e `#ar-chat-badge` (arena). Exibe `9+` quando `CHAT.naoLidos > 9`.

**Deps externas:** `document`, `CHAT.naoLidos`.

---

#### `chatSalvarLog()` — linha 309 *(async)*
Salva snapshot permanente do histórico de chat como entrada na tabela `lore` (seção `chat_log`).

**Deps externas:** `CHAT.msgs`, `AR.session.rpg_id`, `CURRENT_RPG.id`, `sb`, `mostrarToast`.

---

#### `chatEscapar(texto)` — linha 321
Função pura de sanitização HTML: escapa `& < > "`. Previne XSS nas mensagens renderizadas.  
**Deps externas:** *Nenhuma.*

### Observações

- **`chatEnviarNarrador`** (referenciada em `rest.js`) **não está definida neste arquivo**. Origem ainda não identificada.
- `CHAT` como objeto global é pré-requisito deste arquivo — provável em `js/state.js`.

---

## 10. `js/combat/animations.js`

**Linhas:** 382  
**Descrição geral:** Duas responsabilidades distintas: (1) broadcast de eventos de combate em tempo real para todos os jogadores; (2) motor de animação de ataque — emite e recebe animações via WebSocket e resolve os elementos DOM dos tokens para alimentar o engine Canvas 2D definido em `camera.js`.

> **Acoplamento cruzado:** este arquivo depende de `animarAtaque` (definida em `camera.js`), enquanto `camera.js` usa `_animCriarCanvas`, `_animCentro` e `_animHexToRgb` definidos aqui. Ambos precisam estar carregados antes que qualquer animação seja disparada.

### Constantes definidas

| Nome | Linha | Descrição |
|------|-------|-----------|
| `_ANIM_SID` | 284 | UUID de sessão por aba (`Math.random().toString(36).slice(2)`), usado para ignorar o eco do próprio emissor nos broadcasts |

### Funções definidas

#### `combateBroadcast(tipo, dados)` — linha 9
Envia evento de combate via WebSocket pelo canal `realtime:public:characters`. Anexa `_ANIM_SID` ao payload para que o emissor possa ignorar o próprio eco.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `AR.session.rpg_id`, `AR.ws` | propriedades | `js/systems/arena.js` |
| `RPG_DATA.rpgId` | propriedade | `js/state.js` |
| `realtimeWS` | variável global | `js/state.js` |
| `_ANIM_SID` | constante | mesmo arquivo (linha 284) |

---

#### `combateReceberBroadcast(payload)` — linha 25
Recebe broadcast de combate e despacha para lógica específica conforme o campo `tipo`. Ignora pacotes com `_sid === _ANIM_SID` (eco do próprio cliente).

Tipos de evento tratados:

| Tipo | Ação |
|------|------|
| `dados_rolados` | Toast com resultado do dado |
| `vez_passou` | Atualiza `bs.ordemAtual`, navega ao mapa se necessário, notifica vez |
| `ataque_executado` | Toast com dano e efeitos |
| `aguardando_aprovacao` | Toast para o mestre; notifica criativo pendente |
| `batalha_criada` | Insere batalha em `MAPA_STATE.batalhas`, navega ao mapa |
| `iniciativa_rolada` | Atualiza iniciativa do participante, verifica se todos rolaram |
| `batalha_estado` | Sync completo de fase/participantes/ordem |
| `batalha_pausada` | Atualiza `bs.pausada` |
| `batalha_encerrada` | Remove batalha do estado |
| `trigger_mostrar` | Exibe card de trigger remoto |
| `trigger_ocultar` | Oculta card de trigger |
| `personagem_morto` | Marca `ca.morto`, re-renderiza tokens |
| `personagem_caiu` | Marca `ca.moribundo`, re-renderiza tokens |
| `personagem_estabilizou` | Marca `ca.estabilizado`, re-renderiza tokens |
| `fase_mudou` | Atualiza `bs.fase` |
| `empurrao_executado` | Atualiza posição do alvo no mapa |
| `ataque_oportunidade` | Toast com resultado |
| `batalha_vitoria` | Exibe tela de vitória (apenas para jogadores) |
| `criativo_animacao` | Delega para `_onReceberAnimacaoCriativo` |

**Dependências externas (selecionadas):**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `MAPA_STATE`, `RPG_DATA` | objetos globais | `js/state.js` |
| `BATALHA_ATUAL_ID` | variável global | `js/combat/combat.js` ou `js/maps/maps.js` |
| `AR` | objeto global | `js/systems/arena.js` |
| `mostrarToast` | função | não identificado ainda |
| `selecionarMapa` | função | `js/maps/maps.js` (provável) |
| `_aplicarEstadoBatalhaUI` | função | `js/combat/combat.js` (provável) |
| `_notificarVez` | função | `js/combat/combat.js` (provável) |
| `_atualizarBadgeMesa` | função | não identificado ainda |
| `_atualizarSeletorBatalhas` | função | `js/combat/combat.js` (provável) |
| `batalhaRenderFaseIniciativa` | função | `js/combat/combat.js` (provável) |
| `batalhaVerificarIniciativasCompletas` | função | `js/combat/combat.js` (provável) |
| `batalhaRenderVezLabel` | função | `js/combat/combat.js` (provável) |
| `_mesaRenderAcoes`, `_mesaRenderIniciativa` | funções | não identificado ainda |
| `MOBILE_CTRL`, `_atualizarZonaDireita` | variável/função | não identificado ainda |
| `_atkMostrarTriggerRemoto` | função | não identificado ainda |
| `mapaRenderTokens` | função | `js/maps/maps.js` (provável) |
| `_mostrarTelaVitoria` | função | `js/combat/combat.js` (provável) |
| `_onReceberAnimacaoCriativo` | função | `js/systems/creative.js` (provável) |
| `_notificarNovoCreativoPendente` | função | não identificado ainda |
| `document` | DOM API | Browser |

---

#### `animBroadcast(payload)` — linha 287
Envia payload de animação de ataque via evento `anim_ataque` no mesmo canal de characters.

**Dependências externas:** `AR.session.rpg_id`, `AR.ws`, `RPG_DATA.rpgId`, `realtimeWS`.

---

#### `animReceberBroadcast(payload)` — linha 302 *(async)*
Recebe broadcast de animação de ataque remoto, resolve os elementos DOM dos tokens e executa a animação localmente com suporte a repetições.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `_ANIM_SID` | constante | mesmo arquivo (linha 284) |
| `resolverTokenEl` | função | mesmo arquivo (linha 351) |
| `animarAtaque` | função | `js/maps/camera.js` linha 205 |

---

#### `_atkRodarAnimacao()` — linha 320 *(async)*
Helper interno: emite animação para os outros jogadores via `animBroadcast` e executa também localmente. Lê contexto do objeto global `COMBATE`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `COMBATE` | objeto global | `js/combat/combat.js` (provável) |
| `animBroadcast` | função | mesmo arquivo (linha 287) |
| `resolverTokenEl` | função | mesmo arquivo (linha 351) |
| `animarAtaque` | função | `js/maps/camera.js` linha 205 |

---

#### `resolverTokenEl(nome, contexto)` — linha 351
Retorna o elemento DOM do token pelo nome e contexto (`'arena'` ou mapa). Usa `CSS.escape` para segurança no seletor.

**Dependências externas:** `CSS.escape` (Browser API), `document.querySelector`.

---

#### `_animCriarCanvas()` — linha 361
Cria e anexa ao `document.body` um `<canvas>` fullscreen com `pointer-events:none` e `z-index:10100`.

**Dependências externas:** `document`, `window.innerWidth`, `window.innerHeight`.

---

#### `_animCentro(el)` — linha 370
Retorna `{x, y}` com o centro absoluto de um elemento DOM via `getBoundingClientRect`.  
**Deps externas:** DOM API.

---

#### `_animHexToRgb(hex)` — linha 375
Converte string hex (`#rrggbb` ou `#rgb`) para string `"R,G,B"`. Função pura, sem deps externas.

---

## 11. `js/maps/camera.js`

**Linhas:** 394  
**Descrição geral:** Camada visual do mapa. Injeta CSS de animações, aplica efeitos de combate em 3 camadas (intenção → impacto → número flutuante + partículas), gerencia pulso de zonas, badge de loot e overlay de grid tático. Também define o dispatcher `animarAtaque` e os renderers Canvas 2D para cada tipo de animação.

> **Nota de nomenclatura:** apesar do nome `camera.js`, o arquivo não implementa câmera/pan/zoom. Seu escopo real é o sistema de efeitos visuais do mapa e o engine Canvas 2D de animações.

### IIFEs executadas na carga

| IIFE | Linha | O que faz |
|------|-------|-----------|
| `_injetarCssEfeitos()` | 10 | Injeta ~18 regras CSS para animações de intenção, impacto, números flutuantes e partículas |
| `_injetarCssZonas()` | 95 | Injeta CSS para pulso visual das 5 categorias de zonas |
| *(anônima lootPiscar)* | 141 | Injeta `@keyframes lootPiscar` para o badge de loot |

### Constantes definidas

| Nome | Linha | Descrição |
|------|-------|-----------|
| `_TIPO_ANIM_CLASS` | 52 | Mapa de tipo de dano (`fisico`, `fogo`, `gelo`, …) para sufixo CSS |
| `_origMRTokens7` | 101 | Guarda referência original de `window.mapaRenderTokens` antes do monkey-patch |
| `_origMapaRenderCanvas7` | 165 | Guarda referência original de `window.mapaRenderCanvas` antes do monkey-patch |

### Monkey-patches em `window`

| Alvo | Linha | O que adiciona |
|------|-------|----------------|
| `window.mapaRenderTokens` | 102 | Após renderizar tokens, aplica pulso de zonas, verifica proximidade e adiciona badges de loot |
| `window.mapaRenderCanvas` | 166 | Após renderizar canvas, converte saídas `x_percent` para células e sobrepõe grid tático |
| `window.animarAtaque3Camadas` | 90 | Exporta `animarAtaque3Camadas` para o escopo global |
| `window.snapParaCelula` | 163 | Exporta `snapParaCelula` para o escopo global |

### Listeners HUB_EVENTS registrados

| Evento | Linha | Ação |
|--------|-------|------|
| `dano_aplicado` | 91 | Chama `animarAtaque3Camadas` (não-cura) |
| `cura_aplicada` | 92 | Chama `animarAtaque3Camadas` (modo cura) |
| `cena_carregada` | 156 | Chama `_verificarMapaIsoLegado` |

### Funções definidas

#### `animarAtaque3Camadas(atacanteNome, alvoNome, dano, tipoDano, ehCritico, ehCura)` — linha 54
Executa animação em 3 fases com delays sequenciais:
1. *(t=0ms)* Flash de intenção no token atacante (`anim-intencao-{tipo}`)
2. *(t=200ms)* Flash de impacto no alvo (`anim-impacto-{tipo}`) + partículas
3. *(t=300ms)* Número flutuante (dano/cura/ERROU/crítico) sobre o token alvo

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `_TIPO_ANIM_CLASS` | constante | mesmo arquivo (linha 52) |
| `_dispararParticulasToken` | função | mesmo arquivo (linha 77) |
| `document.querySelector`, `CSS.escape` | APIs | Browser |
| `document.getElementById('mapa-img')` | DOM | Browser / `index.html` |

---

#### `_dispararParticulasToken(tokenEl, tipoClass)` — linha 77
Cria 8 elementos `div.particula-impacto` ao redor do token com ângulos e distâncias aleatórias, usando variáveis CSS `--px`/`--py` para a dispersão.

**Dependências externas:** `document.getElementById('mapa-img')`, `document.createElement`.

---

#### `_aplicarPulsoZonas(m)` — linha 106
Aplica classe `zona-pulso-{tipo}` em cada elemento `.mapa-zona` conforme o `zona_tipo` do local correspondente.

**Dependências externas:** `document.querySelectorAll`.

---

#### `_verificarProximidadeZonas(m)` — linha 113
Verifica se algum jogador está a ≤ 2 células de uma zona não visitada. Se sim, emite entrada no feed.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `MAPA_STATE.mapaAtualId` | propriedade | `js/state.js` |
| `RPG_DATA.characters` | array | `js/state.js` |
| `getPosicaoNoMapa` | função | `js/maps/maps.js` (provável) |
| `feedAdicionarEntrada` | função | não identificado ainda |

---

#### `_aplicarIconesLootTokens()` — linha 132
Adiciona badge `💰 Loot` aos tokens de personagens mortos com `ca.tem_loot === true`.

**Dependências externas:** `RPG_DATA.characters`, `document.querySelector`, `CSS.escape`.

---

#### `_verificarMapaIsoLegado(m)` — linha 144
Exibe ou remove banner de aviso para mapas com `transform3d.depth` (formato isométrico legado).

**Dependências externas:** `document.getElementById`, `document.getElementById('mapa-tokens')`.

---

#### `snapParaCelula(xPct, yPct, mapa)` — linha 159
Converte coordenadas percentuais para célula de grid `{col, row}`. Função pura, sem deps externas. Exportada em `window.snapParaCelula`.

---

#### `animarAtaque({ atacEl, alvoEl, animacao, dano })` — linha 205
Dispatcher central das animações Canvas 2D. Retorna `Promise`. Delega para:

| `animacao.tipo` | Função | Descrição |
|-----------------|--------|-----------|
| `projetil` | `_animProjetil` | Projétil em curva de Bézier com trilha opcional |
| `onda` | `_animOnda` | Ondas concêntricas expansivas |
| `explosao` | `_animExplosao` | Partículas de explosão |
| `raio` | `_animRaio` | Relâmpago zigzag com brilho |
| `aura` | `_animAura` | Aura pulsante ao redor do alvo |
| `gif`/`imagem`/`svg`/`iframe` | `_animMedia` | Mídia posicionada entre tokens |

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `_animCentro` | função | `js/combat/animations.js` linha 370 |
| `_animHexToRgb` | função | `js/combat/animations.js` linha 375 |
| `_animCriarCanvas` | função | `js/combat/animations.js` linha 361 |
| `_animMedia` | função | **não encontrada ainda** |
| `_animImpacto` | função | **não encontrada ainda** (usada em `_animProjetil`) |

---

#### `_animProjetil`, `_animOnda`, `_animExplosao`, `_animRaio`, `_animGerarZigzag`, `_animAura` — linhas 233–393
Renderers Canvas 2D individuais. Todos usam `requestAnimationFrame` + `performance.now`. Recebem `ctx`, `canvas`, `origem`, `alvo`, `cor`, `rgb`, `icone`, `done` (callback de resolução da Promise).

Funções puras de cálculo auxiliar:
- `_animGerarZigzag(a, b, n)` (linha 357): gera n pontos zigzag aleatórios entre dois pontos. Sem deps externas.

---

## 12. `js/systems/lore.js`

**Linhas:** 417  
**Descrição geral:** Apesar do nome, este arquivo vai muito além do sistema de lore. Contém a renderização do header, o sistema completo de botões e busca de personagens, e a função `renderCharView` — o maior e mais complexo renderer de ficha de personagem do sistema.

> **Atenção de nomenclatura:** o escopo real é `lore + character UI`, não apenas lore.

### Constantes definidas

| Nome | Linha | Valor | Descrição |
|------|-------|-------|-----------|
| `CHAR_SEARCH_THRESHOLD` | 25 | `5` | Número mínimo de personagens para exibir caixa de busca |

### Funções definidas

#### `renderHeader()` — linha 5
Atualiza o nome do personagem vinculado no header (`#hdr-char`).

**Deps externas:** `document.getElementById`, `RPG_DATA.linked`.

---

#### `renderLore()` — linha 9
Renderiza todas as entradas de lore visíveis (excluindo `chat_cache` e `chat_log`) agrupadas por seção. Inclui botões de editar/remover baseados na permissão `'editar_lore'`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA.lore` | array | `js/state.js` |
| `temPermissao` | função | `js/core/events.js` |
| `fmtSec` | função | mesmo arquivo (linha 19) |
| `filtrarLore` | função | mesmo arquivo (linha 20) |
| `abrirModalLore` | função | **não encontrada ainda** |
| `removerLore` | função | **não encontrada ainda** |
| `document.getElementById` | DOM API | Browser |

---

#### `fmtSec(s)` — linha 19
Função pura. Traduz slugs de seção para nomes legíveis (ex: `'facoes'` → `'Facções'`). Sem deps externas.

---

#### `filtrarLore(s, btn)` — linha 20
Ativa o botão de filtro clicado e mostra apenas os itens da seção correspondente.

**Deps externas:** `document.querySelectorAll`.

---

#### `renderCharButtons()` — linha 27
Reconstrói a linha de botões de seleção de personagens (`#char-select-row`) chamando `buildCharBtns` e exibe botão de criação.

**Deps externas:** `document.getElementById`, `buildCharBtns` (mesmo arquivo), `abrirModalNovoChar` (**não encontrada ainda**), `_charSearchToggle` (mesmo arquivo).

---

#### `_charSearchToggle(tab)` — linha 34
Exibe ou oculta a caixa de busca de personagens com base na contagem de entradas (NPCs genéricos são agrupados por `nome_base` para a contagem).

**Deps externas:** `RPG_DATA.characters`, `document.getElementById`, `CHAR_SEARCH_THRESHOLD` (mesmo arquivo).

---

#### `charFiltrar(input, tab)` — linha 60
Filtra botões de personagem em tempo real por texto. Mostra/oculta o botão "limpar busca".

**Deps externas:** `document.getElementById`, `document.querySelectorAll`.

---

#### `charFiltrarLimpar(tab)` — linha 74
Limpa o input de busca e reseta o filtro.

**Deps externas:** `document.getElementById`, `charFiltrar` (mesmo arquivo).

---

#### `buildCharBtns(tab)` — linha 81
Constrói HTML dos botões de seleção de personagens. Lógica de ordenação e agrupamento:
1. **Jogadores** (com seus pets logo após)
2. **NPCs especiais** (não genéricos, com seus pets)
3. **Criaturas / genéricos** (genéricos agrupados por `nome_base` com badge de contagem)
4. **Pets sem dono**

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA.characters` | array | `js/state.js` |
| `ATTR_VIEW`, `CHAR_VIEW` | variáveis globais | `js/state.js` |
| `selecionarChar` | função | mesmo arquivo (linha 174) |

---

#### `selecionarChar(nome, btn, tab)` — linha 174
Seleciona o personagem ativo, atualiza botão ativo na linha e renderiza a view correspondente (`char` ou `attr`).

**Deps externas:** `document.querySelectorAll`, `ATTR_VIEW`, `CHAR_VIEW` (state.js), `renderAttrView` (**não encontrada ainda**), `renderCharView` (mesmo arquivo).

---

#### `renderCharView(nome)` — linha 177 *(função principal ~240 linhas)*
Renderiza a ficha completa do personagem no painel `#char-view`. É a função mais complexa do arquivo. Inclui:

- Barra de HP e barra de XP com porcentagem
- Avatar (modo APMOD com SVG por partes + overlays de equipamentos, ou imagem URL simples)
- Stat boxes por categoria (status/recursos, básicos, especiais, resistências)
- Lista de habilidades com metadados (fórmula, alcance, cooldown, tipo de dano, efeitos bônus, críticos)
- Formulário de edição inline (nome, tipo, classe, raça, cor, background, equipamentos, pet/dono, aparência)
- Botões condicionais: inventário, level up, distribuição de pontos, excluir (só mestre)
- Bloqueio de atributos para NPCs

**Dependências externas (selecionadas):**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA.characters`, `RPG_DATA.skills`, `RPG_DATA.attrDefs`, `RPG_DATA.linked`, `RPG_DATA.myRole` | propriedades | `js/state.js` |
| `_skFiltrarPorChar` | função | `js/state.js` |
| `podeEditarPersonagem` | função | `js/core/events.js` |
| `normalizeImgUrl` | função | `js/state.js` |
| `CURRENT_RPG.theme.level_config` | propriedade | `js/state.js` ou `js/hub/hub.js` |
| `CHAR_VIEW`, `ATTR_VIEW` | variáveis | `js/state.js` |
| `apmodTokenSVG` | função | **não encontrada ainda** |
| `_aeqComputeMatrix3d` | função | **não encontrada ainda** |
| `tintOverlayHtml` | função | **não encontrada ainda** |
| `abrirModalAparencia` | função | **não encontrada ainda** |
| `abrirInventario` | função | `js/systems/inventory.js` (provável) |
| `distribuirPontosAttr` | função | **não encontrada ainda** |
| `abrirModalLevelUp` | função | **não encontrada ainda** |
| `toggleEditChar` | função | **não encontrada ainda** |
| `salvarInfoPersonagem` | função | **não encontrada ainda** |
| `excluirPersonagemCompleto` | função | **não encontrada ainda** |
| `charviewToggleOcultarAtribs` | função | **não encontrada ainda** |
| `abrirModalSkill` | função | `js/characters/skills.js` (provável) |
| `removerSkill` | função | `js/characters/skills.js` (provável) |
| `document.getElementById('char-view')` | DOM | Browser / `index.html` |

---

## 13. `js/state.js`

**Linhas:** 441  
**Descrição geral:** Arquivo de estado global da aplicação. Define todas as variáveis de estado compartilhadas entre módulos, o objeto `MAPA_STATE` e o sistema de zoom/pan/câmera do mapa. É o ponto central de dados do sistema.

### Variáveis e objetos globais definidos

| Nome | Linha | Tipo/Valor inicial | Descrição |
|------|-------|--------------------|-----------|
| `HUB_DATA` | 7 | `{rpgs:[]}` | Dados do hub (lista de RPGs do usuário) |
| `RPG_DATA` | 7 | `null` | Dados completos do RPG ativo (characters, skills, lore, attrDefs, mapas, etc.) |
| `CURRENT_RPG` | 7 | `null` | Objeto do RPG atualmente selecionado |
| `DADO_SEL` | 8 | `null` | Tipo de dado selecionado |
| `CHAR_VIEW` | 8 | `null` | Nome do personagem ativo na aba de ficha |
| `ATTR_VIEW` | 8 | `null` | Nome do personagem ativo na aba de atributos |
| `CFG_CHAR` | 8 | `null` | Personagem em configuração |
| `HISTORICO` | 9 | `[]` | Histórico de rolagens de dados |
| `USER_ID` | 9 | `null` | ID do usuário autenticado |
| `realtimeWS` | 9 | `null` | Referência ao WebSocket Supabase Realtime |
| `SESSION` | 10 | `null` | Sessão auth: `{access_token, user:{id,email}}` |
| `CRIATIVO_TIPO` | 13 | `'ataque'` | Tipo de ação criativa selecionada |
| `CRIATIVO_ALVO_TIPO` | 14 | `'unico'` | Alvo da ação criativa |
| `CHAT` | 17 | objeto | Estado do chat (msgs, aberto, naoLidos, rpgId, online, _presenceInterval) |
| `INI_VALOR_ATUAL` | 25 | `null` | Valor de iniciativa sendo rolado |
| `INI_NOME_ATUAL` | 26 | `null` | Personagem rolando iniciativa |
| `CRIATIVO_ID_ATUAL` | 27 | `null` | ID da ação criativa em andamento |
| `CRIATIVOS_CAMP` | 28 | `[]` | Ações criativas da campanha (sync via rpg_registry) |
| `CRIATIVO_MESTRE_BUILDER` | 29 | `[]` | Builder de dados do mestre para ações criativas |
| `BATALHA_ATUAL_ID` | 30 | `null` | ID da batalha visualizada no mapa atual |
| `_skModalCharId` | 46 | `null` | UUID do personagem no modal de skill aberto |
| `MAPA_STATE` | 47 | objeto | Estado do mapa: `mapaAtualId`, `mapaGeralId`, `toolMode`, `medicaoAtiva`, `dragging`, `dragTimer`, `batalhas{}`, getter `batalha` |
| `MAPA_ZOOM` | 55 | objeto | Estado de zoom/pan: `zoom`, `panX`, `panY`, `locked`, `activeChar`, `modo`, `_autoRafId`, `_inited`, `_keyInited` |
| `_cameraTarget` | 138 | `{panX:0,panY:0,zoom:1}` | Alvo da interpolação da câmera automática |
| `TIPOS_DADO` | 436 | `[4,6,8,10,20,100]` | Tipos de dado disponíveis por padrão |
| `IMPORT_CSVS` | 439 | `{}` | Cache de CSVs importados |
| `COR_MAP` | 440 | objeto | Mapa de nome de cor para variável CSS |

### Funções definidas

#### `_skCharId(nome)` — linha 34
Retorna o UUID do personagem pelo nome. Usado para vincular skills por UUID em vez de nome.  
**Deps externas:** `RPG_DATA.characters`.

---

#### `_skFiltrarPorChar(skills, nome)` — linha 41
Filtra skills pelo UUID do personagem, com fallback para o campo `personagem` (nome) em registros legados.  
**Deps externas:** `_skCharId` (mesmo arquivo).

---

#### `mapaGetTipo(mapa)` — linha 74
Normaliza o tipo do mapa: aliases `'geral'`→`'mundo'` e `'local'`→`'tatico'`. Função pura.

#### `mapaIsMundo(mapa)` — linha 80
Retorna `true` se o mapa é do tipo mundo. Deps: `mapaGetTipo`.

#### `mapaIsTatico(mapa)` — linha 81
Retorna `true` se o mapa é tático. Deps: `mapaGetTipo`.

---

#### `mapaZoomApply()` — linha 57
Aplica o estado atual de `MAPA_ZOOM` como CSS `transform` em `#mapa-img`. Atualiza o label de porcentagem de zoom.  
**Deps externas:** `MAPA_ZOOM`, `document.getElementById`.

---

#### `mapaToggleLock()` — linha 83
Alterna `MAPA_ZOOM.locked`. Atualiza botão `#mapa-lock-btn` e cursor do mapa.  
**Deps externas:** `MAPA_ZOOM`, `document.getElementById`, `mostrarToast`.

---

#### `mapaToggleModoCamera()` — linha 100
Alterna modo da câmera (`'auto'` ↔ `'manual'`). No modo auto, inicia o loop RAF.  
**Deps externas:** `MAPA_ZOOM`, `document.getElementById`, `mostrarToast`, `_cameraAutoLoop` (mesmo arquivo).

---

#### `_cameraCalcCentroide(mapId)` — linha 113
Calcula o centroide (0–1) de todos os personagens jogadores no mapa informado.

**Deps externas:** `RPG_DATA.characters`, `_getMapaById` (maps.js), `getPosicaoNoMapa` (maps.js).

---

#### `_cameraAutoTick()` — linha 140
Um frame do loop de câmera automática. Calcula zoom-alvo para manter todos os jogadores visíveis com 15% de margem e interpola suavemente (`t=0.08`).

**Deps externas:** `MAPA_ZOOM`, `MAPA_STATE.mapaAtualId`, `document.getElementById`, `_cameraCalcCentroide`, `_getMapaById`, `RPG_DATA.characters`, `getPosicaoNoMapa`, `mapaZoomApply` (todos internos exceto `_getMapaById` e `getPosicaoNoMapa`).

---

#### `_cameraAutoLoop()` — linha 191
Inicia o loop RAF da câmera automática. Continua enquanto `MAPA_ZOOM.modo === 'auto'`.  
**Deps externas:** `requestAnimationFrame` (Browser), `_cameraAutoTick` (mesmo arquivo).

---

#### `mapaZoomManualGuard()` — linha 205
Retorna `true` se o pan/zoom manual é permitido (modo não é `'auto'`). Sem deps externas.

---

#### `mapaCharSizeAtivar(nome)` — linha 212
Ativa o HUD de tamanho de token para um personagem. Em mobile, carrega o valor do cache local.

**Deps externas:** `RPG_DATA.characters`, `MAPA_ZOOM`, `document.getElementById`, `_isMobile` (config.js), `_getMobileSize` (config.js), `mapaCharSizeSlide` (mesmo arquivo).

---

#### `mapaCharSizeSlide(v)` — linha 238
Atualiza tamanho do token em memória e via CSS direto no elemento DOM (sem re-render). Salva no localStorage em mobile.

**Deps externas:** `MAPA_ZOOM`, `RPG_DATA.characters`, `document.getElementById`, `_isMobile`, `_setMobileSize` (config.js), `document.querySelector`, `CSS.escape`.

---

#### `mapaCharSizeStep(delta)` — linha 262
Incrementa/decrementa o slider de tamanho por `delta`.  
**Deps externas:** `document.getElementById`, `mapaCharSizeSlide` (mesmo arquivo).

---

#### `mapaCharSizeConfirmar()` — linha 269 *(async)*
Confirma o tamanho do token. **Mobile:** salva só localmente. **Desktop:** persiste no Supabase via `sb()`.

**Deps externas:** `MAPA_ZOOM`, `_isMobile`, `_setMobileSize`, `RPG_DATA`, `document.getElementById`, `mostrarToast`, `mapaCharSizeFechar` (mesmo arquivo), `mapaRenderTokens`, `MAPA_STATE`, `sb` (supabase.js).

---

#### `mapaCharSizeFechar()` — linha 314
Oculta o HUD de tamanho de token.  
**Deps externas:** `MAPA_ZOOM.activeChar`, `document.getElementById`.

---

#### `mapaZoomSet(z, pivotX, pivotY)` — linha 320
Define zoom para o valor `z` mantendo o ponto pivot fixo. Clampea entre 0.05 e 20.  
**Deps externas:** `MAPA_ZOOM`, `mapaZoomApply` (mesmo arquivo).

---

#### `mapaZoomReset()` — linha 331
Reseta zoom para 1 e pan para 0,0.  
**Deps externas:** `MAPA_ZOOM`, `mapaCharSizeFechar`, `mapaZoomApply` (mesmo arquivo).

---

#### `mapaZoomInit()` — linha 337
Registra todos os event listeners de zoom/pan do mapa. Executado uma única vez (`_inited`). Suporta:
- Mouse wheel (zoom centrado no cursor)
- Pinch-to-zoom (2 dedos touch)
- Pointer pan (arrastar mapa)
- Atalhos de teclado: `+`/`=` zoom in, `-` zoom out, `0` reset

**Deps externas:** `MAPA_ZOOM`, `MAPA_STATE.toolMode`, `document.getElementById`, `document.addEventListener`, `mapaZoomSet`, `mapaZoomReset` (mesmo arquivo).

---

#### `normalizeImgUrl(url)` — linha 425
Normaliza URLs do Google Drive para o formato direto `lh3.googleusercontent.com/d/{id}`. Função pura, sem deps externas.

---

#### `getDiceConfig(rpgId)` — linha 437
Lê configuração de dados do localStorage. Fallback para `TIPOS_DADO`.  
**Deps externas:** `localStorage`, `TIPOS_DADO` (mesmo arquivo).

#### `setDiceConfig(rpgId, arr)` — linha 438
Salva configuração de dados no localStorage.  
**Deps externas:** `localStorage`.

### Observações

- **`mostrarToast`** é chamada em `mapaToggleLock`, `mapaToggleModoCamera` e `mapaCharSizeConfirmar` mas **não está definida em nenhum arquivo mapeado até agora**. Pendente de identificação.
- **`_getMapaById`** e **`getPosicaoNoMapa`** usadas na câmera automática — prováveis em `js/maps/maps.js`.
- O getter `MAPA_STATE.batalha` retorna a batalha da `BATALHA_ATUAL_ID` atual — padrão de acesso conveniente usado amplamente no sistema de combate.

---

## 14. `js/auth/auth.js`

**Linhas:** 482  
**Descrição geral:** Sistema completo de autenticação. Gerencia login, cadastro com hCaptcha, recuperação de senha, refresh automático de token e o bootstrap inicial da aplicação após autenticação bem-sucedida.

### Variáveis definidas

| Nome | Linha | Valor inicial | Descrição |
|------|-------|---------------|-----------|
| `AUTH_MODE` | 7 | `'login'` | Modo atual do formulário (`'login'` ou `'cadastro'`) |
| `HCAPTCHA_WIDGET_ID` | 8 | `null` | ID do widget hCaptcha renderizado |

### Funções definidas

#### `onHcaptchaLoad()` — linha 11
Callback chamado pela API do hCaptcha ao carregar. Renderiza o widget no elemento `#auth-hcaptcha`.

**Deps externas:** `document.getElementById`, `hcaptcha.render` (API externa), `HCAPTCHA_SITEKEY` (config.js).

---

#### `authTab(modo)` — linha 21
Troca o painel de auth entre login e cadastro. Atualiza estilos dos botões de aba, visibilidade dos campos extras e reseta o hCaptcha e mensagens.

**Deps externas:** `document.getElementById`, `EMAIL_CONFIRMATION_ENABLED` (config.js), `hcaptcha.reset`, `authErro`, `authSucesso`, `authOcultarRecuperacao` (mesmo arquivo).

---

#### `authErro(msg)` / `authSucesso(msg)` — linhas 37 / 42
Exibe ou oculta as mensagens de erro/sucesso no formulário.  
**Deps externas:** `document.getElementById`.

---

#### `authToggleSenha()` / `authToggleSenha2()` — linhas 47 / 51
Alterna visibilidade dos campos de senha.  
**Deps externas:** `document.getElementById`.

---

#### `authSubmit()` — linha 56 *(async)*
Handler principal do formulário. Valida email e senha mínima, verifica se o widget hCaptcha foi renderizado e delega para `authCadastrar` ou `authEntrar`.

**Deps externas:** `document.getElementById`, `AUTH_MODE`, `HCAPTCHA_WIDGET_ID`, `authErro`, `authCadastrar`, `authEntrar` (mesmo arquivo).

---

#### `authCadastrar(email, senha, nickname, nomeReal)` — linha 91 *(async)*
Cria conta via endpoint GoTrue `/auth/v1/signup` com token hCaptcha. Exibe mensagem de confirmação de e-mail ou de sucesso conforme `EMAIL_CONFIRMATION_ENABLED`.

**Deps externas:** `hcaptcha.getResponse`, `HCAPTCHA_WIDGET_ID`, `SUPABASE_URL`, `SUPABASE_KEY` (config.js), `EMAIL_CONFIRMATION_ENABLED` (config.js), `traduzirErroAuth`, `authSucesso`, `authErro` (mesmo arquivo).

---

#### `authEntrar(email, senha)` — linha 116 *(async)*
Autentica via `/auth/v1/token?grant_type=password`. Busca nickname na tabela `players`, preenche `SESSION` e chama `iniciarApp`.

**Deps externas:** `hcaptcha.getResponse`, `SUPABASE_URL`, `SUPABASE_KEY`, `traduzirErroAuth`, `SESSION` (state.js), `localStorage`, `iniciarApp` (mesmo arquivo).

---

#### `authMostrarRecuperacao()` / `authOcultarRecuperacao()` — linhas 150 / 157
Exibe/oculta o painel de recuperação de senha.  
**Deps externas:** `document.getElementById`.

---

#### `authEnviarRecuperacao()` — linha 161 *(async)*
Envia e-mail de recuperação de senha via `/auth/v1/recover`. Exibe mensagem de sucesso ou erro.

**Deps externas:** `EMAIL_CONFIRMATION_ENABLED`, `SUPABASE_URL`, `SUPABASE_KEY`, `document.getElementById`.

---

#### `authVerificarLinkRecuperacao()` — linha 189
Lê `window.location.hash`, verifica se é um link de recuperação (`type=recovery`). Se sim, extrai o token e abre o formulário de nova senha.

**Deps externas:** `window.location.hash`, `history.replaceState`, `authExibirFormNovaSenha` (mesmo arquivo).

---

#### `authVerificarConfirmacaoEmail()` — linha 200 *(async)*
Lê o hash da URL para links de confirmação de e-mail (`type=signup` ou `type=email_change`). Se válido, busca dados do usuário com o token, preenche `SESSION` e chama `iniciarApp`.

**Deps externas:** `window.location.hash`, `history.replaceState`, `SUPABASE_URL`, `SUPABASE_KEY`, `SESSION` (state.js), `localStorage`, `iniciarApp`, `esconderSplash`, `document.getElementById`, `authSucesso` (mesmo arquivo).

---

#### `authExibirFormNovaSenha(tokenRecuperacao)` — linha 239
Cria e injeta no `document.body` um overlay com formulário para definir nova senha. O botão chama `authSalvarNovaSenha` com o token.

**Deps externas:** `document.getElementById`, `document.createElement`, `document.body.appendChild`.

---

#### `authSalvarNovaSenha(tokenRecuperacao)` — linha 266 *(async)*
Salva a nova senha via `PUT /auth/v1/user` com o token de recuperação. Fecha o modal e exibe mensagem de sucesso.

**Deps externas:** `document.getElementById`, `SUPABASE_URL`, `SUPABASE_KEY`.

---

#### `traduzirErroAuth(msg)` — linha 305
Função pura. Traduz mensagens de erro do Supabase GoTrue para português. Sem deps externas.

---

#### `authRefreshSession()` — linha 322 *(async)*
Renova o access token usando o refresh token via `/auth/v1/token?grant_type=refresh_token`. Atualiza `SESSION` e localStorage. Retorna `true`/`false`.

**Deps externas:** `SESSION` (state.js), `SUPABASE_URL`, `SUPABASE_KEY`, `localStorage`.

---

#### `authSair()` — linha 340
Logout: limpa `SESSION`, remove `rpghub_session` e `rpghub_nav` do localStorage, exibe tela de auth e reseta formulário.

**Deps externas:** `SESSION` (state.js), `localStorage`, `document.getElementById`, `authTab` (mesmo arquivo).

---

#### *(listener)* `window.addEventListener('load', ...)` — linha 352
Bootstrap da aplicação. Sequência de verificação na carga da página:
1. Link de confirmação de e-mail → `authVerificarConfirmacaoEmail`
2. Link de recuperação de senha → `authVerificarLinkRecuperacao`
3. Sessão salva no localStorage → `authRefreshSession` → `iniciarApp`
4. Sem sessão: exibe tela de login

**Deps externas:** `authVerificarConfirmacaoEmail`, `authVerificarLinkRecuperacao`, `esconderSplash`, `localStorage`, `SESSION`, `authRefreshSession`, `iniciarApp`, `document.getElementById` (mesmo arquivo / state.js / DOM).

---

#### `iniciarApp()` — linha 375 *(async)*
Bootstrap pós-login. Define `USER_ID`, carrega lista de RPGs, verifica navegação salva (`rpghub_nav`) para entrar diretamente numa campanha ou arena.

**Deps externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `SESSION` | objeto global | `js/state.js` |
| `USER_ID` | variável global | `js/state.js` |
| `HUB_DATA` | objeto global | `js/state.js` |
| `document.getElementById` | DOM API | Browser |
| `getAllRPGs` | função | `js/core/supabase.js` |
| `renderRPGList` | função | mesmo arquivo (linha 414) |
| `localStorage` | Browser API | Browser |
| `salvarNav` | função | **não encontrada ainda** |
| `abrirArenaHub` | função | **não encontrada ainda** |
| `entrarArena` | função | **não encontrada ainda** |
| `entrarRPG` | função | **não encontrada ainda** |

---

#### `renderRPGList(rpgs)` — linha 414
Renderiza os cards de campanha e arena no hub. Separa os RPGs em campanhas normais e arenas, gerando HTML com ícones SVG e cores do tema.

**Deps externas:** `document.getElementById`, `getCardIconSVG` (core/utils.js), `entrarRPG`, `entrarArenaFromHub` (mesmo arquivo).

---

#### `entrarArenaFromHub(rpgId)` — linha 476 *(async)*
Abre o painel de arena e entra diretamente na sessão de arena salva.

**Deps externas:** `document.getElementById`, `carregarArenaList`, `entrarArena` (**ambas não encontradas ainda**).

---

### Fluxos de auth.js

```
CARGA DA PÁGINA
└── window.load
    ├── authVerificarConfirmacaoEmail() ──► [link de email?]
    │   └── [sim] ──► iniciarApp()
    ├── authVerificarLinkRecuperacao() ──► [link de recovery?]
    │   └── [sim] ──► authExibirFormNovaSenha()
    │                      └── authSalvarNovaSenha()
    ├── [sessão no localStorage?]
    │   └── authRefreshSession() ──► [ok?] ──► iniciarApp()
    └── [nenhum] ──► exibir tela de login

FLUXO DE LOGIN
authSubmit()
├── AUTH_MODE=login  ──► authEntrar() ──► SESSION preenchida ──► iniciarApp()
└── AUTH_MODE=cadastro ──► authCadastrar() ──► mensagem de sucesso

FLUXO DE INICIALIZAÇÃO
iniciarApp()
├── getAllRPGs() [supabase.js]
├── renderRPGList()
└── [nav salva?]
    ├── is_arena ──► abrirArenaHub() + entrarArena()
    └── campanha ──► entrarRPG()

FLUXO DE RECUPERAÇÃO DE SENHA
authMostrarRecuperacao() ──► authEnviarRecuperacao() ──► [email enviado]
[link no email] ──► authVerificarLinkRecuperacao() ──► authExibirFormNovaSenha()
                                                          └── authSalvarNovaSenha()
```

---

## 15. `js/core/supabase.js`

**Linhas:** 504  
**Descrição geral:** Camada de acesso a dados. Fornece o wrapper `sb()` para todas as chamadas REST ao Supabase, funções de leitura/escrita de personagens e RPGs, carregamento progressivo em 4 fases e o sistema de importação/atualização de RPG via CSV.

### Funções definidas

#### `sb(path, opts, _retry)` — linha 9 *(async)*
Wrapper central do Supabase REST API. Todas as operações de dados do sistema passam por aqui.

Comportamentos especiais:
- **401 (Unauthorized):** chama `authRefreshSession()` → repete a request; se falhar → `authSair()`
- **Timeout (código 57014):** retry automático até 3x com backoff linear (1s, 2s, 3s)
- **204 No Content:** retorna `null`
- **Body vazio:** retorna `null`

**Deps externas:** `SUPABASE_URL`, `SUPABASE_KEY` (config.js), `SESSION.access_token` (state.js), `authRefreshSession`, `authSair` (auth.js).

---

#### `uploadToStorage(file, folder)` — linha 43 *(async)*
Faz upload de um arquivo para o bucket `game-assets` do Supabase Storage. Gera nome único com timestamp + random. Retorna a URL pública do arquivo.

**Deps externas:** `SUPABASE_URL`, `SUPABASE_KEY`, `SESSION.access_token` (state.js).

---

#### `getAllRPGs()` — linha 67
Busca todos os RPGs do usuário via `sb()`. Usada por `iniciarApp` (auth.js).  
**Deps externas:** `sb` (mesmo arquivo).

---

#### `getRPGData(rpgId)` — linha 70 *(async)*
Retorna **imediatamente** um objeto vazio de RPG (sem chamadas de rede). O carregamento real é feito por `_carregarProgressivo()` em seguida. Permite que o app fique visível sem esperar os dados.

**Deps externas:** *Nenhuma* (retorna objeto estático).

---

#### `_carregarProgressivo(rpgId)` — linha 77 *(async)*
Carregamento em 4 fases sequenciais com status visual no elemento `#rpg-load-status`:

| Fase | Dados | Renderiza |
|------|-------|-----------|
| 0 | `attr_defs` + batalhas ativas + `atributos_grupos` | UI de batalha, badge da mesa |
| 1 | Mapas (sem imagens) | `renderMapasTab()` |
| 2 | Personagens (sem imagens) | `renderCharButtons`, `renderCharView`, `renderAttrView`, tokens no mapa |
| 3 | Skills + Lore + Criativos | `renderLore`, `renderConfig`, `criativoRenderMestre` |
| 4 | Imagens dos mapas | `renderMapaViewer` *(não-bloqueante — 300ms delay)* |

**Deps externas (selecionadas):**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `sb` | função | mesmo arquivo |
| `RPG_DATA`, `MAPA_STATE`, `CHAR_VIEW`, `ATTR_VIEW`, `CFG_CHAR`, `CRIATIVOS_CAMP` | globais | `js/state.js` |
| `ATTR_MAPPING_CACHE` | variável | **não encontrada ainda** |
| `_aplicarEstadoBatalhaUI` | função | `js/combat/combat.js` (provável) |
| `_atualizarBadgeMesa` | função | **não encontrada ainda** |
| `renderMapasTab` | função | `js/maps/maps.js` (provável) |
| `_mapaInicializarLayout` | função | `js/maps/maps.js` (provável) |
| `renderCharButtons` | função | `js/systems/lore.js` |
| `renderAttrButtons` | função | **não encontrada ainda** |
| `renderHeader` | função | `js/systems/lore.js` |
| `renderCharView` | função | `js/systems/lore.js` |
| `renderAttrView` | função | **não encontrada ainda** |
| `mapaRenderTokens` | função | `js/maps/maps.js` (provável) |
| `mapaRenderStatus` | função | `js/maps/maps.js` (provável) |
| `renderLore` | função | `js/systems/lore.js` |
| `renderConfig` | função | **não encontrada ainda** |
| `criativoRenderMestre` | função | `js/systems/creative.js` (provável) |
| `renderMapaViewer` | função | `js/maps/maps.js` (provável) |

---

#### `saveCharacterStats(rpgId, charName, stats)` — linha 192 *(async)*
Persiste `hp_atual` e/ou `custom_attrs` de um personagem via PATCH.  
**Deps externas:** `sb`.

---

#### `saveMemberLinked(rpgId, charName)` — linha 200 *(async)*
Vincula o jogador logado a um personagem em `rpg_members`.  
**Deps externas:** `SESSION`, `sb`, `mostrarToast`.

---

#### `deleteRPGData(rpgId)` — linha 207 *(async)*
Remove o RPG da tabela `rpg_registry`. Bloqueia o RPG `'dual'`.  
**Deps externas:** `sb`.

---

#### `buildLevelConfig(cfg)` — linha 214
Constrói objeto de configuração de nível a partir de uma linha de config CSV. Retorna `null` se nenhum campo válido for encontrado. Função pura.

---

#### `calcularHpMaxComAtributos(lc, charAtributos, hpMaxExplicito, nivel)` — linha 232
Calcula o HP máximo de um personagem. HP explícito tem prioridade; caso contrário, usa `hp_base + bonus_por_nivel + atributo * multiplicador`. Função pura.

---

#### `buildTheme(cfg)` — linha 246
Constrói o objeto de tema completo (cores, fontes, animações, level_config) a partir de uma linha de config CSV.  
**Deps internas:** `buildLevelConfig` (mesmo arquivo).

---

#### `insertSection(rpgId, section, rows, levelConfig)` — linha 277 *(async)*
Insere linhas em qualquer tabela do sistema. Suporta: `characters`, `skills`, `lore`, `mapas`, `attr_defs`, `item_catalog`, `inventario`.

Lógica especial por seção:
- **characters**: auto-correção de colunas invertidas (companheiro/equipamentos), parse de `atributos_json`, cálculo de `hp_max`
- **skills**: resolve `character_id` por nome (query extra em `characters`)
- **inventario**: resolve `character_id` e `item_catalog_id` por nome (2 queries extras)

**Deps externas:** `sb`, `normalizeImgUrl` (state.js), `calcularHpMaxComAtributos` (mesmo arquivo).

---

#### `importRPG(payload, mapasJSON)` — linha 422 *(async)*
Importa um RPG completo a partir do payload processado de um CSV. Sequência:
1. Cria entrada em `rpg_registry`
2. Vincula o criador como mestre em `rpg_members`
3. Insere seções em ordem: characters → skills → lore → attr_defs → mapas → item_catalog → inventario
4. Importa mapeamento de atributos (`attr_grupos`) e vocabulário temático
5. Importa mapas JSON (se fornecido)

**Deps externas:** `sb`, `buildTheme`, `buildLevelConfig`, `SESSION`, `insertSection`, `importarMapasJSON` (**não encontrada ainda**), `_mapeamentoCache` (**não encontrada ainda**).

---

#### `updateRPG(rpgId, payload)` — linha 481 *(async)*
Atualiza um RPG existente. Para cada seção: deleta os dados antigos e re-insere com `insertSection`. Para `config`: atualiza `theme_json` via PATCH.

**Deps externas:** `sb`, `buildTheme`, `insertSection` (mesmo arquivo).

---

### Fluxos de supabase.js

```
TODAS AS OPERAÇÕES DE DADOS
└── sb(path, opts)
    ├── [401] ──► authRefreshSession() ──► [ok] ──► retry sb()
    │                                      └── [fail] ──► authSair()
    ├── [57014 timeout] ──► retry com backoff (até 3x)
    └── [sucesso] ──► JSON.parse(response)

ENTRADA NO RPG (chamada por entrarRPG — não mapeado ainda)
└── getRPGData(rpgId) ──► retorna objeto vazio imediatamente
    └── _carregarProgressivo(rpgId)
        ├── Fase 0: attr_defs + batalhas ──► _aplicarEstadoBatalhaUI()
        ├── Fase 1: mapas ──► renderMapasTab()
        ├── Fase 2: characters ──► renderCharButtons() + renderCharView()
        ├── Fase 3: skills + lore + criativos ──► renderLore() + renderConfig()
        └── Fase 4: imagens [300ms delay, não bloqueante] ──► renderMapaViewer()

IMPORTAÇÃO DE RPG
importRPG(payload)
├── sb('rpg_registry', POST) ──► cria registro
├── sb('rpg_members', POST) ──► vincula mestre
└── insertSection() [×7 seções em sequência]
    ├── characters: normalizeImgUrl + calcularHpMaxComAtributos + sb(POST)
    ├── skills: resolve character_id + sb(POST)
    └── inventario: resolve character_id + item_catalog_id + sb(POST)

VÍNCULO DE DADOS (sb ↔ auth)
sb() ──► authRefreshSession() [auth.js]
authEntrar() ──► SESSION preenchida ──► sb() passa a enviar Bearer token
```

---

### Atualização: resolução de `mostrarToast`

`mostrarToast` é chamada em `saveMemberLinked` (supabase.js), `mapaToggleLock` (state.js), `rest.js`, `npcs.js`, `chat.js`, `animations.js` e outros. Após análise de todos os arquivos mapeados, **ainda não foi encontrada definida**. Provavelmente está em `js/ui/modals.js` ou `js/hub/hub.js`.

---

---

## 16. `js/characters/characters.js`

**Linhas:** 581  
**Descrição geral:** Sistema de XP, level up, distribuição de pontos de atributo e renderização do painel de atributos (`renderAttrView`). Também cobre edição e renomeação de personagens com cascata de dados.

### Variáveis/constantes definidas

| Nome | Linha | Descrição |
|------|-------|-----------|
| `_xpModalNome` | 92 | Nome do personagem aberto no modal de XP; `null` quando fechado |

### Funções definidas

#### `abrirModalLevelUp(nome)` — linha 6
Abre overlay de confirmação de level up. Lê `CURRENT_RPG.theme.level_config` para montar preview: HP ganho, pontos de atributo, aumentos automáticos, habilidades desbloqueadas.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.characters` | array global | `js/state.js` |
| `CURRENT_RPG.theme.level_config` | objeto global | `js/state.js` |
| `document.body.appendChild` | DOM API | Browser |

---

#### `executarLevelUp(nome)` — linha 44 *(async)*
Aplica o level up: incrementa `nivel`, zera `xp`, acumula `pontos_attr`, aplica aumentos automáticos de atributo, recalcula `hp_max` via `recalcularHpMax`, persiste via `sb()`, atualiza `renderCharView`.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.characters` | array global | `js/state.js` |
| `CURRENT_RPG.theme.level_config` | objeto global | `js/state.js` |
| `recalcularHpMax(c)` | função | **não encontrada ainda** |
| `sb(path, opts)` | função async | `js/core/supabase.js` |
| `mostrarToast(msg, tipo)` | função | **não encontrada ainda** |
| `renderCharView(nome)` | função | `js/systems/lore.js` |

---

#### `abrirModalXP(nome)` — linha 94
Abre modal de XP: define `_xpModalNome`, preenche nome no header, chama `xpAtualizarModalUI`.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `xpAtualizarModalUI` | função | mesmo arquivo |

---

#### `fecharModalXP()` — linha 105
Fecha modal de XP e limpa `_xpModalNome`.

---

#### `xpAtualizarModalUI(nome)` — linha 110
Atualiza barra de progresso de XP, label de nível, botão de level up e botão de forçar level up no modal.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.characters` | array global | `js/state.js` |
| `CURRENT_RPG.theme.level_config` | objeto global | `js/state.js` |

---

#### `xpDarRapido(quantidade)` — linha 144 *(async)*
Adiciona XP ao personagem aberto no modal, salva, verifica auto level up, mostra toast.

**Dependências externas:** `xpSalvarChar`, `xpChecarAutoLevelUp`, `mostrarToast`, `RPG_DATA.characters`

---

#### `xpDarParaTodos()` — linha 160
Toggle do painel de XP para todos os jogadores.

---

#### `xpConfirmarTodos()` — linha 167 *(async)*
Distribui XP para todos os personagens tipo `'jogador'`. Para cada um: atualiza `ca.xp`, chama `xpSalvarChar`, verifica auto level up.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.characters` | array global | `js/state.js` |
| `xpSalvarChar` | função | mesmo arquivo |
| `xpChecarAutoLevelUp` | função | mesmo arquivo |
| `mostrarToast` | função | **não encontrada ainda** |
| `xpAtualizarModalUI` | função | mesmo arquivo |

---

#### `xpSalvarManual()` — linha 187 *(async)*
Define o XP do personagem para um valor fixo digitado no input, salva, verifica auto level up.

**Dependências externas:** `xpSalvarChar`, `xpChecarAutoLevelUp`, `mostrarToast`

---

#### `xpExecutarLevelUp()` — linha 204 *(async)*
Botão de level up automático no modal XP. Delega para `executarLevelUp`, depois atualiza UI do modal.

---

#### `xpForcarLevelUp()` — linha 212 *(async)*
Botão de forçar level up (mestre). Delega para `abrirModalLevelUp`.

---

#### `xpChecarAutoLevelUp(nome)` — linha 219 *(async)*
Verifica se o personagem atingiu XP suficiente para subir de nível. Se sim, chama `executarLevelUp` silenciosamente.

**Dependências externas:** `RPG_DATA.characters`, `CURRENT_RPG.theme.level_config`, `executarLevelUp`, `mostrarToast`, `xpAtualizarModalUI`

---

#### `xpSalvarChar(c, ca)` — linha 237 *(async)*
Persiste `custom_attrs` e `xp` do personagem via PATCH no Supabase.

**Dependências externas:** `sb`, `RPG_DATA.rpgId`, `mostrarToast`

---

#### `distribuirPontosAttr(nome)` — linha 246 *(async)*
Lê os inputs `pa-{attr}` do DOM, valida que total não excede `pontos_attr`, aplica aumentos, recalcula `hp_max` via `calcularHpMaxComAtributos`, persiste via `sb()`.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.characters`, `RPG_DATA.attrDefs` | globals | `js/state.js` |
| `CURRENT_RPG.theme.level_config` | objeto global | `js/state.js` |
| `calcularHpMaxComAtributos(lc, atribs, hpMax, nivel)` | função | `js/core/supabase.js` |
| `sb` | função async | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderCharView` | função | `js/systems/lore.js` |
| `renderAttrView` | função | mesmo arquivo |

---

#### `renderAttrButtons()` — linha 280
Reconstrói o seletor de personagens da aba Atributos. Wrapper para `buildCharBtns('attr')` e `_charSearchToggle`.

**Dependências externas:** `buildCharBtns`, `_charSearchToggle` — ambas em `js/systems/lore.js`

---

#### `renderAttrView(nome)` — linha 286
Renderiza o painel completo de atributos. Inclui: avatar (suporta APMOD builder via `apmodTokenSVG`), barra de HP, salvaguardas de morte, stat boxes por categoria (básicos/especiais/status/resistência), toggle de ocultar atributos (mestre+NPC), formulário de edição com campos por tipo de `attrDef`.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.characters`, `RPG_DATA.attrDefs`, `RPG_DATA.myRole` | globals | `js/state.js` |
| `normalizeImgUrl(url)` | função | `js/state.js` |
| `apmodTokenSVG(c, modo)` | função | **não encontrada ainda** |
| `podeEditarPersonagem(nome)` | função | `js/core/events.js` |
| `toggleEdit(nome)` | função | mesmo arquivo |
| `attrviewToggleOcultarAtribs` | função | mesmo arquivo |
| `salvarAtributos` | função | mesmo arquivo |

---

#### `toggleEdit(nome)` — linha 457
Toggle de visibilidade do form `#edit-form-{nome}` (aba Atributos).

---

#### `toggleEditChar(nome)` — linha 458
Toggle de visibilidade do form `#edit-char-form-{nome}` (aba Personagem).

---

#### `attrviewToggleOcultarAtribs(nome)` — linha 461 *(async)*
Lê o estado do checkbox `#attrview-toggle-ocultar` e persiste `ocultar_atributos` via `sb()` (aba Atributos).

**Dependências externas:** `RPG_DATA.characters`, `RPG_DATA.rpgId`, `sb`, `mostrarToast`

---

#### `charviewToggleOcultarAtribs(nome, checked)` — linha 473 *(async)*
Persiste `ocultar_atributos` a partir de um parâmetro booleano direto (chamada inline do HTML na aba Personagem).

**Dependências externas:** `RPG_DATA.characters`, `RPG_DATA.rpgId`, `sb`, `mostrarToast`

---

#### `salvarAtributos(nome)` — linha 485 *(async)*
Lê inputs `fca-{attr}` + `f-hp_atual`, recalcula `hp_max` via `calcularHpMaxComAtributos`, persiste via PATCH, re-renderiza `renderAttrView`.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `podeEditarPersonagem` | função | `js/core/events.js` |
| `RPG_DATA.characters`, `RPG_DATA.attrDefs`, `RPG_DATA.rpgId` | globals | `js/state.js` |
| `CURRENT_RPG.theme.level_config` | objeto global | `js/state.js` |
| `calcularHpMaxComAtributos` | função | `js/core/supabase.js` |
| `sb` | função async | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderAttrView` | função | mesmo arquivo |

---

#### `salvarInfoPersonagem(nome)` — linha 524 *(async)*
Salva informações do personagem (tipo, cor, classe, raça, imagem, pet). Suporta renomeação com cascata: atualiza `skills.personagem`, `rpg_members.linked`, e as variáveis globais `CHAR_VIEW`, `ATTR_VIEW`, `CFG_CHAR`, `RPG_DATA.linked`.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `podeEditarPersonagem` | função | `js/core/events.js` |
| `RPG_DATA.characters`, `RPG_DATA.skills`, `RPG_DATA.linked`, `RPG_DATA.rpgId` | globals | `js/state.js` |
| `CHAR_VIEW`, `ATTR_VIEW`, `CFG_CHAR` | globals | `js/state.js` |
| `sb` | função async | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderCharButtons`, `renderAttrButtons` | funções | `js/systems/lore.js` / mesmo arquivo |
| `renderConfig` | função | **não encontrada ainda** |
| `renderHeader` | função | `js/systems/lore.js` |
| `renderCharView` | função | `js/systems/lore.js` |
| `renderAttrView` | função | mesmo arquivo |

---

### Fluxos de characters.js

```
SISTEMA DE XP
xpDarRapido(qtd) ──► xpSalvarChar(c, ca) ──► sb() [PATCH characters]
                └──► xpChecarAutoLevelUp(nome)
                         └── [xp >= threshold] ──► executarLevelUp(nome)

xpConfirmarTodos() ──► [para cada PC] ──► xpSalvarChar + xpChecarAutoLevelUp

xpSalvarManual() ──► xpSalvarChar ──► xpChecarAutoLevelUp

NÍVEL UP
abrirModalLevelUp(nome) ──► [overlay DOM] ──► executarLevelUp(nome) [on confirm]
    └── executarLevelUp(nome)
            ├── recalcularHpMax(c)   [não encontrada ainda]
            ├── sb() [PATCH characters]
            └── renderCharView(nome)

xpForcarLevelUp() ──► abrirModalLevelUp(nome)
xpExecutarLevelUp() ──► executarLevelUp(nome)

DISTRIBUIÇÃO DE PONTOS
distribuirPontosAttr(nome)
    ├── [lê inputs pa-{attr}]
    ├── calcularHpMaxComAtributos() [supabase.js]
    ├── sb() [PATCH characters]
    ├── renderCharView(nome) [lore.js]
    └── renderAttrView(nome) [mesmo arquivo]

SALVAR ATRIBUTOS (aba Atributos)
salvarAtributos(nome)
    ├── [lê inputs fca-{attr} + f-hp_atual]
    ├── calcularHpMaxComAtributos()
    ├── sb() [PATCH characters]
    └── renderAttrView(nome)

RENOMEAR PERSONAGEM (salvarInfoPersonagem)
salvarInfoPersonagem(nome)
    ├── sb() [PATCH characters → nome=novoNome]
    ├── sb() [PATCH skills → personagem=novoNome]
    ├── sb() [PATCH rpg_members → linked=novoNome]
    ├── [atualiza CHAR_VIEW, ATTR_VIEW, CFG_CHAR, RPG_DATA.linked]
    ├── renderCharButtons() + renderAttrButtons() + renderConfig() + renderHeader()
    └── renderCharView(novoNome) + renderAttrView(novoNome)
```

---

## 17. `js/characters/skills.js`

**Linhas:** 627  
**Descrição geral:** CRUD de habilidades, lore e mapas. Formula builder para dano de habilidades. Criação de personagens. O arquivo termina com `PLACEMENT_STATE = null` — o sistema de placement de mapas continua em `js/maps/maps.js`.

### Variáveis/constantes definidas

| Nome | Linha | Descrição |
|------|-------|-----------|
| `SK_FB` | 68 | Array de grupos da fórmula de dano em construção. Cada grupo: `{tipo:'dado', faces, qtd}` ou `{tipo:'bonus', valor}` |
| `PLACEMENT_STATE` | 627 | Estado do modo de posicionamento de mapa local (valor inicial `null`; lógica continua em `maps.js`) |

### Funções definidas

#### `abrirModalNovoChar()` — linha 10
Abre modal de criação de personagem. Pré-preenche HP base a partir de `CURRENT_RPG.theme.level_config`.

**Dependências externas:** `CURRENT_RPG.theme.level_config` (state.js)

---

#### `fecharModalNovoChar()` — linha 24
Fecha o modal de criação.

---

#### `criarNovoPersonagem()` — linha 27 *(async)*
Cria novo personagem via `sb()`, calcula `hp_max` a partir do nível e do `level_config`, adiciona a `RPG_DATA.characters`, re-renderiza botões.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `CURRENT_RPG.theme.level_config` | objeto global | `js/state.js` |
| `RPG_DATA.characters`, `RPG_DATA.rpgId` | globals | `js/state.js` |
| `sb` | função async | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderCharButtons` | função | `js/systems/lore.js` |
| `renderAttrButtons` | função | `js/characters/characters.js` |
| `renderConfig` | função | **não encontrada ainda** |

---

#### `skFBAdicionarDado(faces)` — linha 70
Incrementa (ou insere) um grupo de dado no `SK_FB` e atualiza a UI.

**Dependências externas:** `skFBAtualizarUI` (mesmo arquivo)

---

#### `skFBRemoverDado(faces)` — linha 76
Decrementa (ou remove) um grupo de dado do `SK_FB`.

---

#### `skFBAdicionarBonus()` — linha 83
Usa `prompt()` para pedir valor, adiciona/merge ao grupo bonus em `SK_FB`.

---

#### `skFBLimpar()` — linha 91
Limpa `SK_FB` e atualiza UI.

---

#### `skFBAtualizarUI()` — linha 92
Re-renderiza chips visuais do formula builder (`#sk-fb-chips`), preview (`#sk-fb-preview`), e o campo oculto `#sk-formula`. Usa `formulaDeGrupos(SK_FB)` se disponível, senão monta string manualmente.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `formulaDeGrupos(SK_FB)` | função | **não encontrada ainda** |

---

#### `skFBCarregarFormula(formula)` — linha 111
Faz parse de uma string de fórmula (ex: `2d6+3`) de volta para o array `SK_FB`. Suporta múltiplos dados e bônus.

---

#### `skPopularAtributos()` — linha 122
Preenche o `<select>` `#sk-atributo-base` com os atributos de tipo `number` definidos em `RPG_DATA.attrDefs`.

**Dependências externas:** `RPG_DATA.attrDefs` (state.js)

---

#### `abrirModalSkill(skillId, personagemNome)` — linha 133
Abre o modal de habilidade em modo edição (se `skillId`) ou criação. Popula ~20 campos: nome, custo, efeito, fórmula de dano (via `skFBCarregarFormula`), cooldown, tipo de dano, alcance, atributo base, tipo de alvo, crits, efeitos bônus, campos de invocação, e todos os campos de animação. Aplica limite de duração para não-mestre (3000ms).

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.skills` | array global | `js/state.js` |
| `_skModalCharId` | variável global | `js/state.js` |
| `_skCharId(nome)` | função | `js/state.js` |
| `CHAR_VIEW` | variável global | `js/state.js` |
| `RPG_DATA.myRole` | propriedade | `js/state.js` |
| `skFBCarregarFormula` | função | mesmo arquivo |
| `skPopularAtributos` | função | mesmo arquivo |
| `skAlvoTipoChange` | função | **não encontrada ainda** |
| `skTipoDanoChange` | função | **não encontrada ainda** |
| `SK_EFEITOS_TEMP` | array global | **não encontrada ainda** |
| `skRenderEfeitosLista` | função | **não encontrada ainda** |
| `skAnimTipoChange` | função | **não encontrada ainda** |
| `skAnimValidarDuracao` | função | **não encontrada ainda** |

---

#### `fecharModalSkill()` — linha 232
Fecha o modal de habilidade.

---

#### `salvarSkill()` — linha 235 *(async)*
Valida e persiste uma habilidade (POST ou PATCH). Valida limite de duração de animação (3000ms para jogadores, 10000ms para mestre). Atualiza `RPG_DATA.skills` localmente, re-renderiza `renderCharView` se for o personagem atual.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `podeEditarPersonagem` | função | `js/core/events.js` |
| `RPG_DATA.skills`, `RPG_DATA.rpgId`, `RPG_DATA.myRole` | globals | `js/state.js` |
| `_skModalCharId`, `_skCharId` | global/função | `js/state.js` |
| `CHAR_VIEW` | global | `js/state.js` |
| `SK_EFEITOS_TEMP` | array global | **não encontrada ainda** |
| `sb` | função async | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderCharView` | função | `js/systems/lore.js` |

---

#### `removerSkill(skillId, nome, personagem)` — linha 321 *(async)*
Confirma e deleta habilidade via `sb()`, remove de `RPG_DATA.skills`, re-renderiza.

**Dependências externas:** `podeEditarPersonagem`, `sb`, `RPG_DATA.skills`, `CHAR_VIEW`, `renderCharView`, `mostrarToast`

---

#### `abrirModalLore(loreId)` — linha 333
Abre modal de lore em modo edição ou criação. *Nota: esta função está em skills.js, não em lore.js — foi definida aqui por conveniência.*

---

#### `fecharModalLore()` — linha 352
Fecha modal de lore.

---

#### `salvarLore()` — linha 355 *(async)*
Valida permissão `editar_lore`, persiste lore via `sb()`, atualiza `RPG_DATA.lore`, re-renderiza `renderLore()`.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `temPermissao('editar_lore')` | função | `js/core/events.js` |
| `RPG_DATA.lore`, `RPG_DATA.rpgId` | globals | `js/state.js` |
| `sb` | função async | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderLore` | função | `js/systems/lore.js` |

---

#### `removerLore(loreId, titulo)` — linha 377 *(async)*
Confirma e deleta entrada de lore, remove de `RPG_DATA.lore`, re-renderiza.

**Dependências externas:** `temPermissao`, `sb`, `RPG_DATA.lore`, `renderLore`, `mostrarToast`

---

#### `abrirModalNovoMapa()` — linha 389
Abre o modal de criação de mapa. Pré-seleciona tipo tático se já há mapa ativo. Detecta unidade de escala do mapa pai. Registra handler de Escape.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.mapas` | array global | `js/state.js` |
| `MAPA_STATE.mapaAtualId` | propriedade global | `js/state.js` |
| `nmBgTab` | função | **não encontrada ainda** |
| `nmBgClearUpload` | função | **não encontrada ainda** |
| `nmCE` | objeto global | **não encontrada ainda** |
| `nmceBgRender` | função | **não encontrada ainda** |
| `nmTipoChange` | função | mesmo arquivo |
| `nmParentChange` | função | mesmo arquivo |

---

#### `nmTipoChange(tipo)` — linha 449
Filtra os mapas disponíveis para seletor de pai conforme o tipo (geral/tático), mostra/oculta a seção de pai, chama `nmceUpdateIsoGuide`.

**Dependências externas:** `RPG_DATA.mapas`, `nmceUpdateIsoGuide` (**não encontrada ainda**)

---

#### `nmParentChange(paiId)` — linha 473
Atualiza labels de unidade e chama `nmAtualizarPreview` ao mudar o mapa pai.

---

#### `nmAtualizarPreview()` — linha 487
Calcula e exibe dimensões de exibição do novo mapa em relação ao mapa pai (em unidades reais e percentual).

**Dependências externas:** `RPG_DATA.mapas`

---

#### `fecharModalNovoMapa()` — linha 513
Fecha o modal de criação de mapa e remove o handler de Escape.

---

#### `criarNovoMapa()` — linha 518 *(async)*
Cria novo mapa: calcula `zona_w_percent`/`zona_h_percent` a partir das dimensões reais, obtém imagem via `nmBgGetFinal()`, persiste via `sb()`, adiciona a `RPG_DATA.mapas`, ativa modo de placement se tiver mapa pai.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.mapas`, `RPG_DATA.rpgId` | globals | `js/state.js` |
| `MAPA_STATE.mapaAtualId` | propriedade global | `js/state.js` |
| `nmBgGetFinal` | função | **não encontrada ainda** |
| `sb` | função async | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderMapasTab` | função | **não encontrada ainda** |
| `selecionarMapa` | função | **não encontrada ainda** |
| `ativarModoPlacement` | função | **não encontrada ainda** |

---

### Fluxos de skills.js

```
CRIAR PERSONAGEM
abrirModalNovoChar() ──► [modal DOM]
criarNovoPersonagem()
    ├── sb('characters', POST)
    ├── RPG_DATA.characters.push(novo)
    ├── renderCharButtons() [lore.js]
    ├── renderAttrButtons() [characters.js]
    └── renderConfig() [não mapeado]

FORMULA BUILDER (SK_FB)
skFBAdicionarDado(faces) ──► skFBAtualizarUI()
skFBRemoverDado(faces) ──► skFBAtualizarUI()
skFBAdicionarBonus() ──► [prompt] ──► skFBAtualizarUI()
skFBCarregarFormula(str) ──► [parse] ──► skFBAtualizarUI()
skFBAtualizarUI() ──► formulaDeGrupos(SK_FB) ──► [render chips + preview]

CRUD DE HABILIDADE
abrirModalSkill(id, nome)
    ├── [edição] ──► skFBCarregarFormula + skPopularAtributos
    └── [criação] ──► skFBLimpar + skPopularAtributos

salvarSkill()
    ├── [valida duração de animação]
    ├── [edição] ──► sb('skills', PATCH) ──► RPG_DATA.skills[idx] = {...}
    └── [criação] ──► sb('skills', POST) ──► RPG_DATA.skills.push(nova)
    └── renderCharView(personagem) [lore.js]

removerSkill(id)
    ├── sb('skills', DELETE)
    ├── RPG_DATA.skills = filter(...)
    └── renderCharView(personagem) [lore.js]

CRUD DE LORE
abrirModalLore(id) ──► [modal DOM]
salvarLore()
    ├── [edição] ──► sb('lore', PATCH) ──► RPG_DATA.lore[idx] = {...}
    └── [criação] ──► sb('lore', POST) ──► RPG_DATA.lore.push(novo)
    └── renderLore() [lore.js]

CRIAR MAPA
abrirModalNovoMapa()
    ├── nmTipoChange(tipo) ──► [popula seletor de pai]
    └── nmParentChange(paiId) ──► nmAtualizarPreview()

criarNovoMapa()
    ├── [calcula zona_w/h_percent a partir de dimensões reais]
    ├── nmBgGetFinal() ──► [obtém URL de fundo]
    ├── sb('mapas', POST)
    ├── RPG_DATA.mapas.push(entry)
    ├── renderMapasTab() [não mapeado]
    ├── [sem pai] ──► selecionarMapa(map_id)
    └── [com pai] ──► selecionarMapa(parentId) + ativarModoPlacement(map_id, ...)
```

---

### Relação entre characters.js e skills.js

Esses dois arquivos formam o subsistema de gestão de personagens:

```
characters.js (atributos, XP, level up, info)
     │
     ├── renderAttrView(nome) ◄── chamada também por salvarAtributos e distribuirPontosAttr
     │
     └── salvarInfoPersonagem(nome) ──► [cascade rename]
              ├── skills.personagem
              ├── rpg_members.linked
              └── CHAR_VIEW / ATTR_VIEW / CFG_CHAR

skills.js (habilidades, lore, mapas, novo personagem)
     │
     ├── salvarSkill() ──► renderCharView() [lore.js - renderiza lista de skills]
     ├── salvarLore() ──► renderLore() [lore.js]
     └── criarNovoMapa() ──► ativarModoPlacement() [maps.js - não mapeado]

Ambos dependem de:
    ├── podeEditarPersonagem / temPermissao [events.js]
    ├── sb() [supabase.js]
    ├── renderCharView / renderCharButtons / renderLore [lore.js]
    └── RPG_DATA / CHAR_VIEW / CURRENT_RPG [state.js]
```

*— Documento em construção. Atualizado a cada novo arquivo mapeado.*

---

## 18. `js/hub/hub.js` *(linhas 1–500 — Em progresso)*

**Linhas totais:** 2300  
**Descrição geral (parcial):** Arquivo central da interface da mesa de jogo. Responsável pelo layout de 3 colunas (desktop), feed de eventos, sistema de notificações, barra de contexto do mestre, entrada em campanhas (`entrarRPG`), aplicação de tema e tela de loading. Contém também o monkey-patch de `combateBroadcast` para reemitir eventos no `HUB_EVENTS`.

> **Nota:** Este arquivo é o maior orquestrador da UI. Chama funções de praticamente todos os outros módulos.

### Variáveis/constantes definidas (linhas 1–500)

| Nome | Linha | Tipo | Descrição |
|------|-------|------|-----------|
| `FEED_MESA` | 289 | `const` objeto | Estado do feed da mesa: `{ entradas: [], maxEntradas: 200 }` |
| `NOTIFICACOES` | 348 | `const` objeto | Estado das notificações: `{ fila: [] }` |
| `LOADING_START` | 478 | `let` number | Timestamp do início da tela de loading |
| `_origCombateBroadcast5` | 385 | `const` | Salva referência original de `combateBroadcast` antes do monkey-patch |
| `_origEntrarRPGF5` | 447 | `const` | Salva referência original de `entrarRPG` antes do monkey-patch |

### Funções definidas (linhas 1–500)

#### `mesaModoVerificar()` — linha 13
Ativa ou desativa o layout de 3 colunas da mesa. Em viewports > 1100px injeta CSS de grid e as 3 colunas via `_mesaInjetarColunas`. Em viewports menores remove a classe `mesa-ativo`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById('tab-mapas')` | DOM API | Browser |
| `window.innerWidth` | Browser API | Browser |
| `_mesaInjetarColunas` | função | mesmo arquivo (linha 39) |
| `_mesaRenderizarColunas` | função | mesmo arquivo (linha 103) |

---

#### `_mesaInjetarColunas()` — linha 39
Cria e injeta as 3 `div`s da mesa (col-esq, col-centro, col-dir) e a barra de ações, movendo elementos existentes do DOM (`mapa-breadcrumb`, `mapa-lista`, `mapa-toolbar`, `mapa-wrap`, `mapa-status` e vários painéis de batalha/criativos) para suas novas colunas. Idempotente (verifica se `#mesa-col-esq` já existe).

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById` | DOM API | Browser |
| `document.createElement` | DOM API | Browser |
| `mapaRenderStatus` | função | `js/maps/maps.js` (provável) |

---

#### `_mesaRenderizarColunas()` — linha 103
Atalho que chama em sequência `_mesaRenderChars`, `_mesaRenderIniciativa` e `_mesaRenderAcoes`.

---

#### `_mesaRenderChars()` — linha 105
Limpa o elemento `#mesa-chars-lista` e chama `mapaRenderStatus` para re-renderizar a lista de personagens da coluna esquerda.

**Dependências externas:** `document.getElementById`, `mapaRenderStatus` (`js/maps/maps.js`).

---

#### `_mesaRenderIniciativa()` — linha 111
Renderiza a lista de participantes da iniciativa na coluna esquerda. Exibe nome, cor e marca o participante atual (com ícone `▶`). Cada item é clicável via `selecionarAlvoLista`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `BATALHA_ATUAL_ID` | variável global | `js/state.js` |
| `MAPA_STATE.batalhas` | objeto | `js/state.js` |
| `selecionarAlvoLista` | função | **não encontrada ainda** |
| `document.getElementById` | DOM API | Browser |

---

#### `_mesaRenderBarraSkills()` — linha 123
Alias simples que chama `_mesaRenderAcoes`.

---

#### `_mesaRenderAcoes()` — linha 125
Renderiza o painel de ações da coluna direita. Constrói HTML dinamicamente conforme o contexto:
- **Fase iniciativa/empate:** botão de rolar iniciativa, lista de participantes com status de rolagem
- **Fase combate:** exibe de quem é a vez; se for a vez do jogador renderiza atalhos de habilidades via `_mesaRenderAtaqueInline`; botões de ação criativa, pular vez, jogar por NPC offline; ações posicionais via `ctxGerarBotoes`
- **Sem batalha:** botão de iniciar batalha (mestre), interações posicionais
- **Mestre:** lista de aprovações pendentes de `CRIATIVOS_CAMP`, controles de batalha (pausar/encerrar)

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `BATALHA_ATUAL_ID` | variável global | `js/state.js` |
| `MAPA_STATE` | objeto global | `js/state.js` |
| `RPG_DATA.myRole`, `RPG_DATA.linked` | propriedades | `js/state.js` |
| `CRIATIVOS_CAMP` | array global | `js/state.js` |
| `COMBATE` | objeto global | `js/combat/combat.js` (provável) |
| `TOKEN_CTRL.nomeSelecionado` | propriedade | **não encontrada ainda** |
| `atkGetHabilidadesCampanha` | função | **não encontrada ainda** |
| `_mesaRenderAtaqueInline` | função | **não encontrada ainda** (linhas > 500) |
| `abrirModalIniciativa` | função | **não encontrada ainda** |
| `abrirModalAcao` | função | **não encontrada ainda** |
| `batalhaPassarVez` | função | `js/combat/combat.js` (provável) |
| `batalhaJogarPorOffline` | função | **não encontrada ainda** |
| `ctxGerarBotoes` | função | **não encontrada ainda** |
| `ctxPriorizar` | função | **não encontrada ainda** |
| `ctxExecutarAcao` | função | **não encontrada ainda** |
| `ctxMostrarOcultos` | função | **não encontrada ainda** |
| `abrirModalIniciarBatalha` | função | **não encontrada ainda** |
| `scrollToPendingApprovals` | função | **não encontrada ainda** |
| `criativoRenderMestre` | função | `js/systems/creative.js` (provável) |
| `pausarOuRetomarBatalha` | função | `js/combat/combat.js` (provável) |
| `encerrarBatalha` | função | `js/combat/combat.js` (provável) |
| `document.getElementById` | DOM API | Browser |

---

#### `_mesaAtacarHab(btn)` — linha 262
Handler de click nos botões de habilidade da mesa (modo mestre). Lê `data-char` e `data-hab` do botão, define `COMBATE.atacanteNome` e `COMBATE.habilidadeSel`, e inicia o fluxo de ataque.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `COMBATE` | objeto global | `js/combat/combat.js` (provável) |
| `mapaAtaqueIniciar` | função | **não encontrada ainda** |

---

#### *(listener `resize`)* — linha 271
Ao redimensionar a janela: re-verifica o modo mesa e re-renderiza o canvas do mapa tático se houver mapa ativo.

**Dependências externas:** `document.getElementById`, `MAPA_STATE`, `RPG_DATA.mapas`, `mapaIsTatico` (state.js), `mapaRenderCanvas` (**não encontrada ainda**), `mesaModoVerificar`, `_mesaRenderizarColunas`.

---

#### Listeners `HUB_EVENTS` registrados (linhas 283–315)

| Evento | Linha | Ação |
|--------|-------|------|
| `turno_avancou` | 283 | Re-renderiza iniciativa e ações; atualiza zona direita se mobile |
| `dano_aplicado` | 284 | Re-renderiza chars e `mapaRenderStatus` |
| `cura_aplicada` | 285 | Re-renderiza chars e `mapaRenderStatus` |
| `token_selecionado` | 286 | Re-renderiza ações |
| `dano_aplicado` | 308 | Adiciona entrada no feed |
| `cura_aplicada` | 309 | Adiciona entrada no feed |
| `turno_avancou` | 310 | Adiciona entrada no feed |
| `token_moveu` | 311 | Adiciona entrada de movimento no feed |
| `habilidade_usada` | 312 | Adiciona entrada no feed |
| `zona_ativada` | 313 | Adiciona entrada no feed |
| `cena_carregada` | 314 | Adiciona entrada de cena no feed |
| `item_usado` | 315 | Adiciona entrada de item no feed |
| `turno_avancou` | 345 | Chama `barraContextoAtualizar(personagem)` |
| `turno_avancou` | 381 | Libera notificações adiadas (`_adiada=false`) |

---

#### `feedAdicionarEntrada(texto, tipo, personagem)` — linha 291
Adiciona uma entrada ao `FEED_MESA.entradas` (no início) e chama `feedRenderizar`. Limita a `maxEntradas` (200) entradas.

**Dependências externas:** `FEED_MESA` (mesmo arquivo), `feedRenderizar` (mesmo arquivo).

---

#### `feedRenderizar()` — linha 297
Renderiza as últimas 40 entradas do `FEED_MESA` no elemento `#mesa-feed-lista`. Cada entrada exibe horário formatado, texto e cor por tipo (`dano`, `cura`, `turno`, `movimento`, `item`, `cena`, `info`).

**Dependências externas:** `FEED_MESA`, `document.getElementById`.

---

#### `barraContextoInicializar()` — linha 318
Injeta a barra fixa de contexto do mestre no `document.body` (apenas para o mestre). Exibe papel atual e botão de avançar turno. Idempotente.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById` | DOM API | Browser |
| `RPG_DATA.myRole` | propriedade | `js/state.js` |
| `document.createElement`, `document.body.appendChild` | DOM API | Browser |
| `mapaToggleModoCamera` | função | `js/state.js` linha 100 |

---

#### `barraContextoAtualizar(personagem)` — linha 328
Atualiza o texto e cor da barra de contexto conforme o personagem cujo turno é atual. Diferencia mestre atuando como seu personagem vs. mestre controlando NPC.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById` | DOM API | Browser |
| `RPG_DATA.myRole`, `RPG_DATA.linked`, `RPG_DATA.characters` | propriedades | `js/state.js` |
| `batalhaPassarVez` | função | `js/combat/combat.js` (provável) |

---

#### `notifAdicionar({ tipo, prioridade, titulo, descricao, acao, dados })` — linha 350
Cria um objeto de notificação com ID único e o adiciona à fila. Notificações de prioridade `'baixa'` são adiadas durante combate ativo (flag `_adiada`).

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `NOTIFICACOES` | objeto | mesmo arquivo (linha 348) |
| `BATALHA_ATUAL_ID` | variável global | `js/state.js` |
| `MAPA_STATE.batalhas` | objeto | `js/state.js` |
| `notifRenderizar` | função | mesmo arquivo (linha 359) |

---

#### `notifRenderizar()` — linha 359
Renderiza o painel de notificações (`#notif-painel`) no canto inferior direito. Cria o elemento se não existir. Exibe até 5 notificações visíveis. Notificações de alta prioridade têm animação `notifPulso`.

Funções globais auxiliares:
- `window.notifDismiss(id)` — marca notificação como resolvida
- `window.notifExpandir(id)` — executa ação da notificação ao clicar
- `window.notifExecutar(id)` — executa callback `acao.fn` e resolve

**Dependências externas:** `NOTIFICACOES`, `document.getElementById`, `document.createElement`, `document.body`.

---

#### `entrarRPG(rpgId)` — linha 398 *(async)*
Fluxo completo de entrada em uma campanha:
1. Salva navegação via `salvarNav`
2. Busca metadata do RPG em `HUB_DATA.rpgs`
3. Define `CURRENT_RPG` e aplica tema via `aplicarTema`
4. Exibe loading via `mostrarLoading`
5. Carrega `RPG_DATA` via `getRPGData`
6. Busca role/linked/permissoes do jogador na tabela `rpg_members`
7. Renderiza UI inicial: header, lore, chars, atribs, dados, config, mapas
8. Inicia Realtime, Chat e carregamento progressivo
9. Restaura aba salva no `localStorage`

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `salvarNav` | função | **não encontrada ainda** |
| `MAPA_STATE` | objeto global | `js/state.js` |
| `HUB_DATA.rpgs` | array | `js/state.js` |
| `CURRENT_RPG` | variável global | `js/state.js` |
| `aplicarTema` | função | mesmo arquivo (linha 461) |
| `mostrarLoading` | função | mesmo arquivo (linha 480) |
| `getRPGData` | função | `js/core/supabase.js` |
| `SESSION` | objeto global | `js/state.js` |
| `sb` | função async | `js/core/supabase.js` |
| `RPG_DATA`, `CHAR_VIEW`, `ATTR_VIEW`, `CFG_CHAR` | globais | `js/state.js` |
| `renderHeader` | função | `js/systems/lore.js` |
| `renderLore` | função | `js/systems/lore.js` |
| `renderCharButtons` | função | `js/systems/lore.js` |
| `renderAttrButtons` | função | `js/characters/characters.js` |
| `renderDados` | função | **não encontrada ainda** |
| `renderConfig` | função | **não encontrada ainda** |
| `renderMapasTab` | função | `js/maps/maps.js` (provável) |
| `mostrarApp` | função | **não encontrada ainda** |
| `ocultarLoading` | função | **não encontrada ainda** |
| `localStorage` | Browser API | Browser |
| `iniciarRealtime` | função | `js/core/realtime.js` |
| `chatMostrar` | função | `js/chat/chat.js` |
| `_carregarProgressivo` | função | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |

> **Nota:** `entrarRPG` é redefinida logo abaixo (linha 448) via monkey-patch que adiciona uma chamada `setTimeout` de 800ms após a entrada, inicializando sistemas das fases 5+: `mesaModoVerificar`, `barraContextoInicializar`, `bibliotecaCarregarDoLore`, `sessionRenderPainel`, `_atualizarBannerControleMobile`, `desbloquearOrientacaoPWA`, `inicializarSistemaAprovacoes`.

---

#### `aplicarTema(rpg)` — linha 461
Aplica as variáveis CSS do tema do RPG no `:root` do documento. Suporta: cores (preto, escuro, painel, borda, cinza, texto, suave, primario, destaque, perigo, sucesso, especial), fontes (display + text), URL de fonte externa.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.documentElement.style.setProperty` | DOM API | Browser |
| `document.getElementById`, `document.createElement`, `document.head.appendChild` | DOM API | Browser |

---

#### `mostrarLoading(rpg)` — linha 480 *(parcial — continua além da linha 500)*
Exibe a tela de loading com animação SVG customizável, nome do RPG e botão de escape. Aplica CSS de animação do tema via `injectCustomCSS`. Registra timestamp em `LOADING_START`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `LOADING_START` | variável | mesmo arquivo (linha 478) |
| `document.getElementById` | DOM API | Browser |
| `injectCustomCSS` | função | `js/core/utils.js` |
| `getLoadingAnimSVG` | função | `js/core/utils.js` |
| `loadingEscapar` | função | **não encontrada ainda** (linhas > 500) |

> *(Continuação nas linhas 480–980 abaixo)*

---

---

### Funções definidas (linhas 480–980)

#### `mostrarLoading(rpg)` — linha 480 *(continuação)*
Oculta o hub, aplica CSS de animação do tema via `injectCustomCSS`, renderiza SVG animado no `#loading-anim`, define o título e adiciona/exibe a tela de loading. Cria botão "← Voltar ao Hub" que aparece após 3s. Define timer de 20s que força o escape com `mostrarToast`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById` | DOM API | Browser |
| `injectCustomCSS` | função | `js/core/utils.js` |
| `getLoadingAnimSVG` | função | `js/core/utils.js` |
| `loadingEscapar` | função | mesmo arquivo (linha 510) |
| `mostrarToast` | função | **não encontrada ainda** |

---

#### `loadingEscapar()` — linha 510
Cancela todos os timers de loading, oculta a tela de loading/criar, re-exibe o hub e fecha o Realtime.

**Dependências externas:** `document.getElementById`, `fecharRealtime` (`js/core/realtime.js`).

---

#### `ocultarLoading()` — linha 524
Cancela timers e aguarda o mínimo de 2.5s desde `LOADING_START` antes de fazer fade-out da tela de loading. Só re-exibe o hub se o `#app` não estiver visível e nenhuma tela de import/criar estiver ativa.

**Dependências externas:** `LOADING_START` (mesmo arquivo), `document.getElementById`.

---

#### `mostrarApp(rpg)` — linha 547
Exibe o painel do app: define nome do RPG, adiciona classe `visible` ao `#app`, ativa a primeira aba, oculta botão de deletar se for RPG `'dual'`, reseta `DADO_SEL` e `HISTORICO`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById`, `document.querySelectorAll` | DOM API | Browser |
| `DADO_SEL`, `HISTORICO` | variáveis globais | `js/state.js` |

---

#### `voltarHub()` — linha 556
Fecha o chat, limpa a navegação salva no localStorage, fecha o Realtime, oculta o app, re-exibe o hub, limpa estilos do tema e reseta `CURRENT_RPG` / `RPG_DATA`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `chatOcultar` | função | `js/chat/chat.js` |
| `localStorage.removeItem` | Browser API | Browser |
| `fecharRealtime` | função | `js/core/realtime.js` |
| `document.getElementById`, `document.documentElement` | DOM API | Browser |
| `CURRENT_RPG`, `RPG_DATA` | variáveis globais | `js/state.js` |

---

#### `window.selecionarAlvoLista(nomeEncodado)` — linha 568
Define `TOKEN_CTRL.nomeSelecionado` com o nome decodado, exibe toast de confirmação, re-renderiza ações e status do mapa.

**Dependências externas:** `TOKEN_CTRL` (**não encontrado ainda**), `mostrarToast`, `_mesaRenderAcoes` (mesmo arquivo), `mapaRenderStatus` (`js/maps/maps.js`).

---

#### `window._atualizarBadgeMesa()` — linha 578
Stub: oculta `#chat-badge-mesa` se existir. Sem lógica real implementada.

---

#### `_mesaDispararAnimacao(atacanteNome, alvoNome, animacao)` — linha 611 *(async)*
Obtém posições dos tokens no DOM e dispara animação visual: para tipos de mídia (`gif`, `imagem`, `svg`, `iframe`) chama `_animMedia`; para tipos canvas (`projetil`, `onda`, etc.) apenas loga (TODO). Aguarda 300ms como fallback.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.querySelector('.mapa-token[data-nome=...]')` | DOM API | Browser |
| `_animMedia` | função | **não encontrada ainda** |

---

#### `_mesaRenderAtaqueInline(atacanteNome, habilidades)` — linha 657
Renderizador do fluxo de ataque inline no painel de ações da mesa. Implementa uma máquina de 3 estados gerenciada pelo objeto global `window._MESA_ATK_STATE`:

| Step | Conteúdo renderizado |
|------|----------------------|
| 1 | Lista de habilidades disponíveis com cooldown, bloqueio, preview de dano (range min–max + modificador de atributo) e seção de pets/montarias |
| 2 | Lista de alvos disponíveis com distância em células, warnings de fogo amigo e indicador de fora do alcance |
| 3 | Preview da fórmula de dano + botão de rolar; após rolar, exibe resultado e botão de confirmar (visual diferente para cura/suporte/dano) |

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `window._MESA_ATK_STATE` | objeto global | mesmo arquivo (inicializado aqui) |
| `BATALHA_ATUAL_ID` | variável global | `js/state.js` |
| `getCooldownsBatalhaSeguro` | função | **não encontrada ainda** |
| `atkVerificarBloqueioAtaque` | função | **não encontrada ainda** |
| `calcularRangeDano` | função | **não encontrada ainda** |
| `calcModAtributo` | função | **não encontrada ainda** |
| `_mesaPetGetPetsDoDono` | função | **não encontrada ainda** (linhas > 980) |
| `_mesaPetDonoEstaAtivo` | função | **não encontrada ainda** (linhas > 980) |
| `_mesaPetGetHabilidades` | função | **não encontrada ainda** (linhas > 980) |
| `_mesaAtaqueInlineGetAlvos` | função | **não encontrada ainda** (linhas > 980) |
| `_mesaShowRangeCircle` | função | **não encontrada ainda** |
| `mapaHideRangeCircle` | função | **não encontrada ainda** (`js/maps/maps.js` provável) |
| `mostrarToast` | função | **não encontrada ainda** |
| `_mesaRenderAcoes` | função | mesmo arquivo (linha 125) |

---

#### `window._mesaAtaqueInlineSelecionarHab(idx, habilidade)` — linha 963
Define step=2, armazena a habilidade selecionada em `_MESA_ATK_STATE` e re-renderiza o painel.

---

#### `window._mesaAtaqueInlineSelecionarAlvo(alvoNome)` — linha 972 *(parcial — continua além de 980)*
Define step=3, armazena o alvo em `_MESA_ATK_STATE`, limpa dados rolados e chama `mapaHideRangeCircle`. Função continua nas linhas > 980.

> *(Continuação nas linhas 972–1472 abaixo)*

---

### Resolução de dependências identificadas nesta análise

| Função/Variável | Encontrada em |
|-----------------|---------------|
| `feedAdicionarEntrada` | `js/hub/hub.js` linha 291 ✅ |
| `notifAdicionar` | `js/hub/hub.js` linha 350 ✅ |
| `entrarRPG` | `js/hub/hub.js` linha 398 ✅ |
| `aplicarTema` | `js/hub/hub.js` linha 461 ✅ |
| `barraContextoAtualizar` | `js/hub/hub.js` linha 328 ✅ |
| `mostrarApp` | `js/hub/hub.js` linha 547 ✅ |
| `ocultarLoading` | `js/hub/hub.js` linha 524 ✅ |
| `voltarHub` | `js/hub/hub.js` linha 556 ✅ |
| `selecionarAlvoLista` | `js/hub/hub.js` linha 568 ✅ |
| `_atualizarBadgeMesa` | `js/hub/hub.js` linha 578 ✅ (stub) |

---

### Funções definidas (linhas 972–1472)

#### `window._mesaAtaqueInlineSelecionarAlvo(alvoNome)` — linha 972 *(completa)*
Define step=3, armazena o alvo em `_MESA_ATK_STATE`, limpa dados rolados, chama `mapaHideRangeCircle` e re-renderiza o painel.

**Dependências externas:** `mapaHideRangeCircle` (**não encontrada ainda**, `js/maps/maps.js` provável), `_mesaRenderAcoes` (mesmo arquivo).

---

#### `window._mesaAtaqueInlineVoltar()` — linha 984
Retrocede um step no fluxo inline. Bloqueia se os dados já foram rolados (`state.dadosRolados` preenchido). Ao voltar ao step 1 limpa estado e esconde círculo de alcance e AoE.

**Dependências externas:** `mostrarToast`, `mapaHideRangeCircle`, `mapaHideAoECircle` (**não encontrada ainda**), `_mesaRenderAcoes`.

---

#### `window._mesaAtaquePet(petNome, habilidadeIdx)` — linha 1010
Inicia ataque usando habilidade de um pet/montaria. Busca a habilidade via `_mesaPetGetHabilidades`, armazena `_petAtacante` e `_donoAtacante` no state, salta para step 2.

**Dependências externas:** `_mesaPetGetHabilidades` (mesmo arquivo, linha 1279), `BATALHA_ATUAL_ID`, `MAPA_STATE.batalhas`, `_mesaRenderAcoes`.

---

#### `window._mesaAtaqueInlineRolar()` — linha 1033 *(async)*
Rola dados do ataque inline. Exibe animação de 5 frames simulados antes do resultado real. Chama `rolarFormulaDano`, armazena resultado em `state.dadosRolados`, vibra o dispositivo (se suportado) e re-renderiza.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `window._MESA_ATK_STATE` | objeto global | mesmo arquivo |
| `BATALHA_ATUAL_ID`, `MAPA_STATE.batalhas` | globais | `js/state.js` |
| `document.getElementById` | DOM API | Browser |
| `rolarFormulaDano` | função | mesmo arquivo (linha 1375) |
| `navigator.vibrate` | Browser API | Browser |
| `_mesaRenderAcoes` | função | mesmo arquivo |

---

#### `window._mesaAtaqueInlineConfirmar()` — linha 1098 *(async)*
Confirma o ataque inline. Configura o objeto global `COMBATE` com atacante, habilidade, alvo e resultado. Se for ataque de pet, substitui temporariamente o atacante. Dispara animação da habilidade via `_mesaDispararAnimacao` antes de aplicar o dano. Chama `_atkAplicarDanoFinal` para aplicar dano, efeitos, cooldown e broadcast. Reseta o state completo após a conclusão.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `window._MESA_ATK_STATE` | objeto global | mesmo arquivo |
| `BATALHA_ATUAL_ID`, `MAPA_STATE.batalhas` | globais | `js/state.js` |
| `COMBATE` | objeto global | `js/combat/combat.js` (provável) |
| `mostrarToast` | função | **não encontrada ainda** |
| `_mesaDispararAnimacao` | função | mesmo arquivo (linha 611) |
| `_atkAplicarDanoFinal` | função | **não encontrada ainda** |
| `_mesaRenderAcoes` | função | mesmo arquivo |

---

#### `_mesaAtaqueInlineGetAlvos(atacanteNome, habilidade)` — linha 1180
Calcula a lista de alvos disponíveis para o ataque inline. Leva em conta:
- Apenas participantes da batalha ativa
- Sistema de **faction** (`jogador`, `aliado`, `neutro`, `inimigo`) via helper `_getFaction`
- Modo buff/cura: só aliados e jogadores
- Modo ataque: inimigos sempre; aliados/jogadores apenas se PvP ou fogo amigo ativo, ou for o mestre
- **Fogo amigo** (`fogoAmigo` / `fogoAmigoForte`) para warnings visuais
- Distância em células via `_calcularDistanciaSegura` e `foraAlcance` se habilidade tem `alcance_celulas`
- Suporte a ataque via pet (usa posição do pet para distância)

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `window._MESA_ATK_STATE` | objeto global | mesmo arquivo |
| `CURRENT_RPG.theme.pvp_ativo`, `CURRENT_RPG.theme.fogo_amigo_ativo` | propriedades | `js/state.js` |
| `RPG_DATA.characters`, `RPG_DATA.myRole` | globais | `js/state.js` |
| `BATALHA_ATUAL_ID`, `MAPA_STATE.batalhas` | globais | `js/state.js` |
| `_calcularDistanciaSegura` | função | mesmo arquivo (linha 1327) |

---

#### `_mesaPetGetHabilidades(petNome)` — linha 1279
Retorna as habilidades de um pet. Busca primeiro em `ca.habilidades`; se não houver, delega para `atkGetHabilidadesCampanha`.

**Dependências externas:** `RPG_DATA.characters`, `atkGetHabilidadesCampanha` (**não encontrada ainda**).

---

#### `_mesaPetGetPetsDoDono(donoNome)` — linha 1294
Retorna todos os personagens em `RPG_DATA.characters` que têm `custom_attrs.eh_pet === true` e `custom_attrs.pet_dono === donoNome`. Função simples de filtro.

**Dependências externas:** `RPG_DATA.characters`.

---

#### `_mesaPetDonoEstaAtivo(donoNome, tipoDanoHabilidade)` — linha 1302
Verifica se o dono do pet está apto a atacar: HP > 0, sem debuff `sem_ataque` ativo, e sem bloqueio por tipo de dano via `atkVerificarBloqueioAtaque`.

**Dependências externas:** `RPG_DATA.characters`, `atkVerificarBloqueioAtaque` (**não encontrada ainda**).

---

#### `_calcularDistanciaSegura(token1, token2)` — linha 1327
Função pura. Calcula a **distância de Chebyshev** (movimento xadrez — diagonal conta 1) entre dois tokens, normalizando diferentes formatos de posição (`col/row`, `x/y`, `column/linha`). Retorna `null` se posição indisponível.

**Dependências externas:** *Nenhuma.*

---

#### `calcularRangeDano(formula)` — linha 1346
Função pura. Extrai da fórmula (ex: `2d6`) os valores mínimo e máximo de dano. Retorna `{ min: qtd, max: qtd*faces }`.

**Dependências externas:** *Nenhuma.*

---

#### `calcModAtributo(habilidade, charNome, contexto)` — linha 1361
Função pura. Calcula o modificador de atributo (fórmula D&D: `floor((valor - 10) / 2)`). Suporta contexto `'arena'` (usa `AR.personagens`) ou campanha (usa `RPG_DATA.characters`).

**Dependências externas:** `AR.personagens` (`js/systems/arena.js`), `RPG_DATA.characters` (`js/state.js`).

---

#### `rolarFormulaDano(formula, habilidade, charNome, contexto)` — linha 1375
Rola a fórmula de dano (ex: `2d6+3`). Aplica modificador de atributo via `calcModAtributo`. Suporta críticos via `verificarCritico` (multiplicadores: 1.2× menor, 1.3× maior, 0 para erro). Dispara animação de crítico via `mostrarAnimacaoCritico` se disponível.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `calcModAtributo` | função | mesmo arquivo (linha 1361) |
| `verificarCritico` | função | **não encontrada ainda** |
| `mostrarAnimacaoCritico` | função | **não encontrada ainda** |

---

#### `getCooldownsBatalhaSeguro(batalhaId)` — linha 1433
Wrapper seguro de `getCooldownsBatalha`: retorna `{}` se a função não existir.

**Dependências externas:** `getCooldownsBatalha` (**não encontrada ainda**, `js/combat/combat.js` provável).

---

#### `_mesaShowRangeCircle(atacanteNome, alcance)` — linha 1444 *(parcial — continua além de 1472)*
Exibe um círculo visual de alcance no mapa para a habilidade selecionada. Busca a posição do atacante na batalha, remove círculo anterior e cria `#mapa-range-circle` posicionado absolutamente no grid.

> ⚠ Função não completamente lida. A próxima análise começa na linha 1444.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `BATALHA_ATUAL_ID`, `MAPA_STATE.batalhas` | globais | `js/state.js` |
| `document.getElementById('mapa-grid')` | DOM API | Browser |
| `mapaHideRangeCircle` | função | **não encontrada ainda** |

---

### Resolução de dependências — linhas 972–1472

| Função/Variável | Encontrada em |
|-----------------|---------------|
| `_mesaPetGetHabilidades` | `js/hub/hub.js` linha 1279 ✅ |
| `_mesaPetGetPetsDoDono` | `js/hub/hub.js` linha 1294 ✅ |
| `_mesaPetDonoEstaAtivo` | `js/hub/hub.js` linha 1302 ✅ |
| `_mesaAtaqueInlineGetAlvos` | `js/hub/hub.js` linha 1180 ✅ |
| `_mesaShowRangeCircle` | `js/hub/hub.js` linha 1444 ✅ (parcial) |
| `calcularRangeDano` | `js/hub/hub.js` linha 1346 ✅ |
| `calcModAtributo` | `js/hub/hub.js` linha 1361 ✅ |
| `rolarFormulaDano` | `js/hub/hub.js` linha 1375 ✅ |
| `getCooldownsBatalhaSeguro` | `js/hub/hub.js` linha 1433 ✅ |
