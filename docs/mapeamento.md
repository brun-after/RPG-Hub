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
| 16 | `js/characters/characters.js` | 581 | — |
| 17 | `js/characters/skills.js` | 627 | — |
| 18 | `js/hub/hub.js` | 2300 | — |
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

*— Documento em construção. Atualizado a cada novo arquivo mapeado.*
