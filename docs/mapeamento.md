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
| 18 | `js/hub/hub.js` | 2300 | ✅ Mapeado |
| 19 | `js/systems/inventory.js` | 2222 | ✅ Mapeado |
| 20 | `js/ui/tabs.js` | 2229 | ✅ Mapeado |
| 21 | `js/systems/creative.js` | 2456 | ✅ Mapeado |
| 22 | `js/hub/import.js` | 2676 | ✅ Mapeado |
| 23 | `js/systems/arena.js` | 3720 | ✅ Mapeado |
| 24 | `js/combat/combat.js` | 4321 | ✅ Mapeado |
| 25 | `js/app.js` | 1 | ✅ Mapeado |
| 26 | `js/ui/modals.js` | 2591 | ✅ Mapeado |
| 27 | `js/systems/catalog.js` | 9233 | ✅ Mapeado |
| 28 | `js/maps/maps.js` | 10012 | 🔄 Em progresso (batch 1) |

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

## 19. `js/systems/inventory.js` *(linhas 1–2222 — Completo)*

**Linhas totais:** 2222
**Descrição geral (parcial):** Sistema completo de inventário e equipamentos. Gerencia carregamento de dados (`item_catalog`, `tabelas`, `item_usos`), renderização da aba de tabelas e catálogo, inventário na ficha do personagem, equipar/desequipar com aplicação de bônus de atributos, e uso de itens consumíveis. Inclui o wizard de criação de campanha (`CRIAR_STATE`, citado no cabeçalho do arquivo).

### Variáveis/constantes definidas (linhas 1–500)

| Nome | Linha | Tipo | Descrição |
|------|-------|------|-----------|
| `INV` | 8 | `const` objeto | Estado global do sistema de inventário: `itemDefs`, `inventario`, `tabelas`, `usosPendentes`, `catalogo`, `inventarios`, `carregado`, `charAtivo`, `charId` |
| `SLOTS_LABELS` | 22 | `const` objeto | Mapa de chave de slot → `{ label, icon }` para os 10 slots de equipamento |
| `_invEquipando` | 359 | `let` bool | Guard contra duplo clique em equipar/desequipar |
| `_usarItemCtx` | 472 | `let` object\|null | Contexto do item aberto no modal de uso: `{ invItem, def, nomeUsuario }` |
| `_addInvCharId` | 817 | `let` number\|null | ID do personagem alvo do modal de adicionar ao inventário |
| `_addInvCharNome` | 818 | `let` string\|null | Nome do personagem alvo do modal de adicionar ao inventário |
| `_itemDefEfeitos` | 885 | `let` array | Buffer de efeitos sendo editados no modal de criar/editar item |
| `_itemDefBonus` | 886 | `let` object | Buffer de bônus de atributos sendo editados no modal de criar/editar item |

### Monkey-patches registrados na carga

| Alvo | Linha | O que adiciona |
|------|-------|----------------|
| `window.entrarRPG` | 101 | Após entrar no RPG: chama `invCarregarDados`, `renderTabelasTab`, `renderMestreBtnsTabelas`, `renderItensPendentes` |
| `window.renderCharView` | 113 | Após renderizar ficha: chama `renderInventarioChar(nome)` |

### Funções definidas (linhas 1–500)

#### `invCarregarDados(rpgId)` — linha 36 *(async)*
Carrega em paralelo via `sb()`: `item_catalog` (com todos os campos), `tabelas` e `item_usos` com status pendente. Agenda carregamento lazy de imagens via `requestIdleCallback` (fallback: `setTimeout` 2s).

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `sb` | função async | `js/core/supabase.js` |
| `_invCarregarImagensItens` | função | mesmo arquivo (linha 53) |
| `requestIdleCallback` | Browser API | Browser |

---

#### `_invCarregarImagensItens(rpgId)` — linha 53 *(async)*
Busca apenas `id` e `img_url` do `item_catalog` e atualiza o cache `INV.itemDefs` sem bloquear o carregamento principal. Erros ignorados silenciosamente.

**Dependências externas:** `sb`, `INV.itemDefs`.

---

#### `invCarregarInventarioChar(charId)` — linha 66 *(async)*
Busca o inventário de um personagem específico, mescla no cache global `INV.inventario` (remove entradas antigas do mesmo `charId`, insere novas).

**Dependências externas:** `sb`, `INV.inventario`.

---

#### `invCarregarTodosInventarios()` — linha 76 *(async)*
Itera sobre todos os personagens em `RPG_DATA.characters` e carrega seus inventários sequencialmente, preenchendo `INV.inventario` e `INV.inventarios[charId]`.

**Dependências externas:** `RPG_DATA.characters`, `sb`, `INV`.

---

#### `renderMestreBtnsTabelas()` — linha 122
Exibe ou oculta `#tabelas-mestre-btns` conforme o papel do usuário.

**Dependências externas:** `document.getElementById`, `RPG_DATA.myRole`.

---

#### `renderTabelasTab()` — linha 132
Renderiza duas seções na aba de tabelas:
1. **Tabelas genéricas:** cards com cabeçalho, `<table>` HTML renderizada a partir de `t.colunas` e `t.linhas`, botões de editar/deletar/toggle visibilidade (mestre)
2. **Catálogo de itens:** lista de `INV.itemDefs` com ícone/imagem, raridade, efeitos via `_efeitoLabel`, bônus de atributos, slot e botões de editar/deletar (mestre)

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `INV.tabelas`, `INV.itemDefs` | estado global | mesmo arquivo |
| `RPG_DATA.myRole` | propriedade | `js/state.js` |
| `SLOTS_LABELS` | constante | mesmo arquivo |
| `_efeitoLabel` | função | mesmo arquivo (linha 215) |
| `_resolveItemImgSrc` | função | **não encontrada ainda** (linhas > 500) |
| `abrirModalTabela`, `deletarTabela`, `toggleVisibilidadeTabela` | funções | **não encontradas ainda** |
| `abrirEditarItemCatalogo`, `deletarItemDef` | funções | **não encontradas ainda** |
| `document.getElementById` | DOM API | Browser |

---

#### `_efeitoLabel(ef)` — linha 215
Função pura. Converte um objeto de efeito em string legível. Suporta tipos: `hp`, `recurso`, `atributo`, `remover_debuff`, `dano`, `debuff`, `buff`, `dot`.

**Dependências externas:** *Nenhuma.*

---

#### `renderItensPendentes()` — linha 232
Exibe aprovações pendentes de uso de item apenas para o mestre. Renderiza lista de `INV.usosPendentes` com info do item, quem usou e em quem, mais botões de Aprovar/Rejeitar.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `INV.usosPendentes`, `INV.itemDefs` | estado global | mesmo arquivo |
| `RPG_DATA.myRole`, `RPG_DATA.characters` | propriedades | `js/state.js` |
| `_efeitoLabel` | função | mesmo arquivo |
| `aprovarUsoItem`, `rejeitarUsoItem` | funções | **não encontradas ainda** |
| `document.getElementById` | DOM API | Browser |

---

#### `renderInventarioChar(nome)` — linha 260 *(async)*
Renderiza a seção de inventário dentro do `#char-view`. Carrega o inventário do personagem via `invCarregarInventarioChar`, separa itens em **equipamentos** (com grid de slots) e **consumíveis** (com botão Usar). Injeta ou substitui `#inv-section-{charId}` no final da ficha.

Lógica de slots: cada slot mostra o item equipado (com bônus), item disponível para equipar (em tom reduzido) ou slot vazio.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA.characters`, `RPG_DATA.myRole`, `RPG_DATA.linked` | globais | `js/state.js` |
| `INV.inventario`, `INV.itemDefs` | estado global | mesmo arquivo |
| `SLOTS_LABELS` | constante | mesmo arquivo |
| `invCarregarInventarioChar` | função | mesmo arquivo (linha 66) |
| `_efeitoLabel` | função | mesmo arquivo (linha 215) |
| `invToggleEquip` | função | mesmo arquivo (linha 360) |
| `abrirModalAddInv` | função | **não encontrada ainda** |
| `abrirModalUsarItem` | função | mesmo arquivo (linha 474) |
| `document.getElementById` | DOM API | Browser |

---

#### `invToggleEquip(nomeChar, invId)` — linha 360 *(async)*
Equipa ou desequipa um item. Guard contra duplo clique (`_invEquipando`). Se equipando e o slot já está ocupado, desequipa o item anterior primeiro. Delega para `_invEquipar` ou `_invDesequipar`.

**Dependências externas:** `INV.inventario`, `INV.itemDefs`, `RPG_DATA.characters`, `_invEquipar`, `_invDesequipar`, `renderInventarioChar` (mesmo arquivo).

---

#### `_invEquipar(nomeChar, invItem, def)` — linha 392 *(async)*
Aplica bônus de atributos do item ao personagem (suporta modo percentual e absoluto), atualiza `invItem.equipado`, `slot_equipado` e `bonus_snapshot` (delta real aplicado), persiste via PATCH paralelo em `inventario` e `characters`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA.characters`, `RPG_DATA.rpgId` | globais | `js/state.js` |
| `sb` | função async | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderCharView` | função | `js/systems/lore.js` |
| `renderAttrView` | função | `js/characters/characters.js` |

---

#### `_invDesequipar(nomeChar, invItem, def)` — linha 431 *(async)*
Reverte bônus de atributos usando `bonus_snapshot` (se disponível) ou os valores brutos do item como fallback. Persiste via PATCH paralelo.

**Dependências externas:** (mesmas de `_invEquipar`).

---

#### `abrirModalUsarItem(invId, nomeUsuario)` — linha 474 *(async)*
Carrega todos os inventários se necessário, localiza o item e a definição, preenche o modal de uso (`#usar-item-nome`, `#usar-item-desc`, `#usar-item-efeitos`, `#usar-item-alvo-sel`). Monta lista de alvos filtrada por `def.alvo` (`'self'`/`'aliado'`/`'inimigo'`). Para cada candidato, calcula distância euclidiana no grid do mapa (usando `escala_val` e `grid`) e desabilita alvos fora de `def.alcance_m`. Exibe aviso de aprovação para jogadores quando `def.requer_aprovacao` ou `def.alvo` não definido.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `INV.inventario`, `INV.itemDefs` | estado global | mesmo arquivo |
| `invCarregarTodosInventarios` | função | mesmo arquivo |
| `RPG_DATA.characters`, `RPG_DATA.myRole`, `RPG_DATA.mapas` | globais | `js/state.js` |
| `MAPA_STATE.mapaAtualId` | global | `js/maps/maps.js` |
| `selecionarAlvoItem` | função | mesmo arquivo (linha 562) |
| `document.getElementById` | DOM API | Browser |

---

#### `selecionarAlvoItem(alvoId, alvoNome, btn)` — linha 562
Marca o alvo selecionado no modal de uso: escreve `alvoId` em `#usar-item-alvo-sel`, redefine estilos de todos os botões na lista e destaca o botão clicado em azul.

**Dependências externas:** `document.getElementById`, `document.querySelectorAll`.

---

#### `fecharModalUsarItem()` — linha 572
Oculta o overlay `#modal-usar-item-overlay` e limpa `_usarItemCtx`.

**Dependências externas:** `document.getElementById`.

---

#### `confirmarUsarItem()` — linha 577 *(async)*
Orquestrador de uso de item. Fluxo:
1. Valida contexto e alvo.
2. Se `precisaAprovacao` **e** usuário não é mestre → POST em `item_usos` (status `'pendente'`), atualiza `INV.usosPendentes`, chama `renderItensPendentes` e fecha o modal.
3. Caso contrário → chama `_aplicarEfeitosItem` (imediato) e depois `_consumirItem`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `sb` | função async | `js/core/supabase.js` |
| `RPG_DATA.characters`, `RPG_DATA.rpgId`, `RPG_DATA.myRole` | globais | `js/state.js` |
| `INV.usosPendentes`, `INV.inventario`, `INV.itemDefs` | estado global | mesmo arquivo |
| `_aplicarEfeitosItem` | função | mesmo arquivo (linha 624) |
| `_consumirItem` | função | mesmo arquivo (linha 759) |
| `renderItensPendentes` | função | mesmo arquivo (linha 232) |
| `fecharModalUsarItem` | função | mesmo arquivo |
| `mostrarToast` | função | **não encontrada ainda** |

---

#### `_aplicarEfeitosItem(efeitos, alvoNome, usuarioNome)` — linha 624 *(async)*
Itera sobre o array de efeitos do item e aplica cada um ao personagem alvo. Detecta contexto de Arena (`AR.session`) e usa `arSb` ou `sb` conforme necessário.

Efeitos suportados:

| Tipo | O que faz |
|------|-----------|
| `'hp'` | Soma `ef.valor` ao `hp_atual` (clampado em `[0, hp_max]`), PATCH no banco, emite `HUB_EVENTS('cura_aplicada')` se positivo |
| `'recurso'` | Adiciona `ef.valor` a `ca.atributos[ef.recurso]`; débitos clampados em 0 |
| `'atributo'` | Se `duracao_turnos > 0`: cria buff temporário com `modificador_delta` + aplica delta imediato. Se permanente: soma diretamente |
| `'remover_debuff'` | Filtra `alvo.buffs` removendo o debuff pelo nome |
| `'dano'` | Subtrai `ef.valor` do HP, PATCH no banco, emite `HUB_EVENTS('dano_aplicado')` |
| `'debuff'` | Push em `alvo.buffs` com `tipo:'debuff'`, `negativo:true`, `auto_aplicado:true` |
| `'buff'` | Push em `alvo.buffs` com suporte a `hot_formula`, `boost_dano`, duração |
| `'dot'` | Push em `alvo.buffs` com `dot_formula`, `dot_turnos_restantes` |

Ao final: PATCH em `characters` com `custom_attrs` + `buffs`, exibe toast e re-renderiza (`renderCharView`, `renderAttrView`, `mapaRenderStatus` ou equivalentes de Arena).

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `AR` | global | `js/systems/arena.js` |
| `arSb` | função | `js/systems/arena.js` |
| `sb` | função async | `js/core/supabase.js` |
| `saveCharacterStats` | função | `js/characters/characters.js` |
| `HUB_EVENTS.emit` | método | `js/core/events.js` |
| `RPG_DATA` | global | `js/state.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderCharView` | função | `js/systems/lore.js` |
| `renderAttrView` | função | `js/characters/characters.js` |
| `mapaRenderStatus` | função | `js/maps/maps.js` |
| `renderArenaPersonagens`, `renderArenaEntidades` | funções | `js/systems/arena.js` |

---

#### `_consumirItem(invItem)` — linha 759 *(async)*
Decrementa a quantidade do item em 1. Se chegar a zero: DELETE em `inventario` e remove das caches `INV.inventario` e `INV.inventarios[charId]`. Caso contrário: PATCH com nova quantidade e atualiza ambas as caches.

**Dependências externas:** `sb`, `INV.inventario`, `INV.inventarios`.

---

#### `aprovarUsoItem(usoId)` — linha 784 *(async)*
Fluxo de aprovação do mestre:
1. Localiza o uso em `INV.usosPendentes`, o item e os personagens envolvidos.
2. Chama `_aplicarEfeitosItem` com `efeitos_snap` (snapshot salvo no momento do pedido).
3. Chama `_consumirItem` para debitar o item.
4. PATCH em `item_usos` com `status:'aplicado'` e timestamp.
5. Remove da lista de pendentes, re-renderiza e exibe toast.

**Dependências externas:** `INV`, `RPG_DATA.characters`, `_aplicarEfeitosItem`, `_consumirItem`, `sb`, `renderItensPendentes`, `mostrarToast`.

---

#### `rejeitarUsoItem(usoId)` — linha 806 *(async)*
PATCH em `item_usos` com `status:'rejeitado'` e timestamp. Remove da lista de pendentes e re-renderiza.

**Dependências externas:** `sb`, `INV.usosPendentes`, `renderItensPendentes`, `mostrarToast`.

---

#### `abrirModalAddInv(nome, charId)` — linha 820
Armazena `charId` e `nome` em `_addInvCharId`/`_addInvCharNome`, preenche o header do modal, limpa o campo de busca e chama `renderAddInvLista`. Exibe `#modal-add-inv-overlay`.

**Dependências externas:** `document.getElementById`, `renderAddInvLista`.

---

#### `fecharModalAddInv()` — linha 830
Oculta `#modal-add-inv-overlay`.

**Dependências externas:** `document.getElementById`.

---

#### `renderAddInvLista()` — linha 834
Filtra `INV.itemDefs` pelo texto de busca digitado em `#add-inv-busca`. Renderiza cards clicáveis com ícone, nome, raridade (com cor) e botão `＋`. Cada card chama `adicionarAoInventario(d.id)` ao clicar.

**Dependências externas:** `INV.itemDefs`, `adicionarAoInventario`, `document.getElementById`.

---

#### `adicionarAoInventario(itemDefId)` — linha 852 *(async)*
Adiciona um item ao inventário do personagem em `_addInvCharId`:
- Se o item já existe e é consumível (`tipo === 'consumivel'`): incrementa `quantidade` via PATCH.
- Caso contrário: POST em `inventario` com `item_catalog_id`, `quantidade:1`, `equipado:false` e empurra o resultado para `INV.inventario`.
Fecha o modal e re-renderiza o inventário do personagem.

**Dependências externas:** `INV.inventario`, `INV.itemDefs`, `RPG_DATA.rpgId`, `sb`, `fecharModalAddInv`, `renderInventarioChar`, `mostrarToast`.

---

#### `abrirModalItemDef(id)` — linha 888 *(parcial — continua além de 973)*
Abre o modal de criar/editar item. Reseta `_itemDefEfeitos` e `_itemDefBonus`. Se `id` fornecido: preenche todos os campos com valores do `def` existente (nome, ícone, tipo, descrição, raridade, valor, alvo, alcance, aprovação, slot, img_url), copia efeitos e bônus para os buffers e chama `_renderItemDefEfeitos`/`_renderItemDefBonus`. Se novo: define valores padrão. Por fim chama `itemDefTipoChange()` e, após timeout, tenta mapear os efeitos existentes para a categoria correta no formulário inteligente via `itemDefCatChange`.

> ⚠ Função não completamente lida. A próxima análise começa na linha 973.

---

### Resolução de dependências — linhas 474–973

| Dependência marcada "não encontrada" | Encontrada em |
|--------------------------------------|---------------|
| `aprovarUsoItem` | linha 784 (mesmo arquivo) |
| `rejeitarUsoItem` | linha 806 (mesmo arquivo) |
| `abrirModalAddInv` | linha 820 (mesmo arquivo) |
| `abrirModalUsarItem` (completa) | linha 474 (mesmo arquivo) |

---

### Variáveis/constantes definidas (linhas 973–1472)

| Nome | Linha | Tipo | Descrição |
|------|-------|------|-----------|
| `_tabelaColunasEdit` | 1218 | `let` array | Buffer de colunas sendo editadas no modal de tabela |
| `_tabelaLinhasEdit` | 1219 | `let` array | Buffer de linhas sendo editadas no modal de tabela |
| `CRIAR_STATE` | 1376 | `let` objeto | Estado global do wizard de criação de campanha: `nivel`, `etapaIdx`, `etapas`, `dados` |
| `CRIAR_NIVEIS` | 1389 | `const` objeto | Configuração dos 3 níveis do wizard (`basico`, `intermediario`, `detalhado`) com etapas e cor |
| `ATTR_PRESETS` | 1395 | `const` array | 4 presets de atributos prontos (D&D, Narrativo, Horror, Cyberpunk) |
| `ICONES_OPCOES` | 1402 | `const` array | 8 opções de ícone para a campanha (`flame`, `rune`, `crystal`, etc.) |
| `COR_PRESETS` | 1413 | `const` array | 12 cores predefinidas para identidade visual da campanha |

### Monkey-patches adicionais (linhas 973–1472)

| Alvo | Linha | O que adiciona |
|------|-------|----------------|
| `window.abrirAba` | 1339 | Ao abrir a aba `'tabelas'`: se `INV.itemDefs` ainda vazio, chama `invCarregarDados` antes de renderizar; senão renderiza diretamente |

### Funções definidas (linhas 973–1472)

#### `_idefUpdateImgPreview(src)` — linha 978
Atualiza o preview de imagem no modal de item (`#idef-img-preview`). Se `src` fornecido: renderiza `<img>` com `onerror` silencioso. Se vazio: mostra `'📦'`.

**Dependências externas:** `document.getElementById`.

---

#### `idefUploadImg(input)` — linha 984 *(async)*
Faz upload de imagem para o Supabase Storage via `uploadToStorage(file, 'items')`, preenche `#idef-img-url` com a URL retornada e chama `_idefUpdateImgPreview`.

**Dependências externas:** `uploadToStorage`, `mostrarToast`, `_idefUpdateImgPreview`.

---

#### `fecharModalItemDef()` — linha 999
Oculta `#modal-itemdef-overlay`.

**Dependências externas:** `document.getElementById`.

---

#### `itemDefTipoChange()` — linha 1001
Exibe/oculta as seções `#idef-sec-consumivel` e `#idef-sec-equipamento` de acordo com `#idef-tipo`.

**Dependências externas:** `document.getElementById`.

---

#### `itemDefCatChange()` — linha 1007
Mostra a seção de categoria de efeito selecionada (`cura`/`recurso`/`buff`/`debuff_inimigo`/`antidoto`/`multiplo`) e oculta as demais. Também configura o toggle de HOT (heal over time).

**Dependências externas:** `document.getElementById`, `document.querySelector`.

---

#### `_idefColetarEfeitosSimples()` — linha 1024
Converte os campos do formulário simplificado de efeitos (UI de alto nível) para o formato interno `efeitos[]`. Funciona como tradutor por categoria:

| Categoria | Campos lidos | Efeito gerado |
|-----------|-------------|---------------|
| `cura` | valor, hot, turnos, alvo | `{ tipo:'hp', valor, hot, duracao_turnos }` |
| `recurso` | nome, valor, alvo | `{ tipo:'recurso', recurso, valor }` |
| `buff` | attr, valor, turnos, alvo | `{ tipo:'atributo', attr, valor, duracao_turnos }` |
| `debuff_inimigo` | alcance, aprovação, dano, debuff | `[{tipo:'dano'}, {tipo:'debuff'}]` |
| `antidoto` | debuff, alvo | `{ tipo:'remover_debuff', debuff }` |
| `multiplo` | — | usa `_itemDefEfeitos` direto |

Retorna `{ efeitos, alvo, alcance_m, requer_aprovacao }`.

**Dependências externas:** `_itemDefEfeitos`, `document.getElementById`.

---

#### `itemDefAddEfeito()` — linha 1081
Adiciona efeito padrão `{ tipo:'hp', valor:10, duracao_turnos:0 }` a `_itemDefEfeitos` e re-renderiza.

**Dependências externas:** `_itemDefEfeitos`, `_renderItemDefEfeitos`.

---

#### `_renderItemDefEfeitos()` — linha 1086
Renderiza a lista de efeitos no modal com selects de tipo e inputs de valor/nome/turnos. Cada linha tem botão ✕ que chama `_itemDefEfeitoRemover`.

**Dependências externas:** `_itemDefEfeitos`, `document.getElementById`.

---

#### `_itemDefEfeitoChange(idx, key, val)` — linha 1107
Atualiza `_itemDefEfeitos[idx][key] = val` (listener inline dos selects/inputs de efeito).

#### `_itemDefEfeitoRemover(idx)` — linha 1108
Remove o efeito no índice e re-renderiza.

---

#### `itemDefAddBonus()` — linha 1110
Adiciona entrada inicial em `_itemDefBonus` usando o primeiro `RPG_DATA.attrDefs` (fallback `'Força'`) como chave (com timestamp para unicidade) e re-renderiza.

**Dependências externas:** `RPG_DATA.attrDefs`, `_itemDefBonus`, `_renderItemDefBonus`.

---

#### `_renderItemDefBonus()` — linha 1117
Renderiza as linhas de bônus de atributos no modal: input de texto para o nome do atributo e input numérico para o valor, com botão de remoção.

**Dependências externas:** `_itemDefBonus`, `document.getElementById`.

---

#### `_itemDefBonusChaveChange(idx, novaChave)` — linha 1127
Renomeia uma chave de `_itemDefBonus`: remove a entrada antiga e cria nova com a mesma valor.

#### `_itemDefBonusValChange(idx, val)` — linha 1134
Atualiza o valor de `_itemDefBonus[chave]` pelo índice.

#### `_itemDefBonusRemover(idx)` — linha 1138
Remove chave de `_itemDefBonus` pelo índice e re-renderiza.

---

#### `salvarItemDef()` — linha 1144 *(async)*
Salva o item no catálogo (`item_catalog`). Fluxo:
1. Para consumíveis: chama `_idefColetarEfeitosSimples()` e escreve alvo/alcance/aprovação nos campos legados.
2. Limpa as chaves de timestamp dos bônus (sufixo `_<timestamp>`).
3. Monta `body` com todos os campos + `tipo_canonico` (derivado do `slot_padrao` para equipamentos).
4. Se `id` fornecido: PATCH. Senão: POST com `Prefer:return=representation`.
5. Atualiza cache local, fecha modal, chama `renderTabelasTab`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `sb` | função async | `js/core/supabase.js` |
| `RPG_DATA.rpgId` | global | `js/state.js` |
| `INV.itemDefs` | estado global | mesmo arquivo |
| `_idefColetarEfeitosSimples` | função | mesmo arquivo |
| `fecharModalItemDef`, `renderTabelasTab`, `mostrarToast` | funções | mesmo arquivo |

---

#### `deletarItemDef(id)` — linha 1203 *(async)*
Confirma com `confirm()`, DELETE em `item_catalog?id=eq.{id}`, remove de `INV.itemDefs` e de `INV.inventario` (itens com `item_catalog_id` ou `item_def_id` correspondente). Re-renderiza.

**Dependências externas:** `sb`, `INV`, `renderTabelasTab`, `mostrarToast`.

---

#### `abrirModalTabela(id)` — linha 1221
Abre o modal de criar/editar tabela. Se `id`: preenche campos com os dados da tabela existente e copia arrays de colunas/linhas para buffers editáveis (com proteção anti-congelamento via `Object.isFrozen`). Se novo: define valores padrão. Chama `_renderTabelaColunas` e `_renderTabelaLinhas`.

**Dependências externas:** `INV.tabelas`, `_tabelaColunasEdit`, `_tabelaLinhasEdit`, `_renderTabelaColunas`, `_renderTabelaLinhas`, `document.getElementById`.

---

#### `fecharModalTabela()` — linha 1249
Oculta `#modal-tabela-overlay`.

#### `tabelaAdicionarColuna()` — linha 1251
Adiciona nova coluna ao buffer `_tabelaColunasEdit` com key e label automáticos. Re-renderiza colunas e linhas.

#### `_renderTabelaColunas()` — linha 1257
Renderiza inputs de nome de coluna com botões de remoção.

#### `_tabelaColunaLabel(idx, val)` — linha 1265
Atualiza `label` e deriva `key` (lowercase, snake_case) de uma coluna.

#### `_tabelaRemoverColuna(idx)` — linha 1269
Remove coluna do buffer e re-renderiza colunas + linhas.

#### `tabelaAdicionarLinha()` — linha 1271
Adiciona linha ao buffer `_tabelaLinhasEdit` com chaves de todas as colunas atuais vazias.

#### `_renderTabelaLinhas()` — linha 1278
Renderiza o grid de inputs das linhas da tabela, uma célula por coluna × linha. Exibe mensagem guia se não há colunas ou linhas.

#### `_tabelaLinhaVal(li, key, val)` — linha 1288
Atualiza `_tabelaLinhasEdit[li][key] = val`.

#### `_tabelaRemoverLinha(li)` — linha 1289
Remove linha do buffer e re-renderiza.

---

#### `salvarTabela()` — linha 1291 *(async)*
Salva a tabela em `tabelas`. Se `id`: PATCH com colunas/linhas/nome/desc/visivel. Senão: POST. Atualiza cache local, fecha modal, re-renderiza.

**Dependências externas:** `sb`, `RPG_DATA.rpgId`, `INV.tabelas`, `fecharModalTabela`, `renderTabelasTab`, `mostrarToast`.

---

#### `deletarTabela(id)` — linha 1319 *(async)*
Confirma, DELETE em `tabelas`, remove de `INV.tabelas`, re-renderiza.

**Dependências externas:** `sb`, `INV.tabelas`, `renderTabelasTab`, `mostrarToast`.

---

#### `toggleVisibilidadeTabela(id, visivel)` — linha 1329 *(async)*
PATCH em `tabelas` com novo `visivel`, atualiza cache local e re-renderiza.

**Dependências externas:** `sb`, `INV.tabelas`, `renderTabelasTab`, `mostrarToast`.

---

#### `abrirCriarCampanha()` — linha 1421
Reseta `CRIAR_STATE` para valores iniciais, esconde `#hub`, exibe `#criar-screen` e chama `criarRenderEtapa`.

**Dependências externas:** `CRIAR_STATE`, `criarRenderEtapa`, `document.getElementById`.

---

#### `fecharCriarCampanha()` — linha 1431
Esconde `#criar-screen` e restaura `#hub`.

**Dependências externas:** `document.getElementById`.

---

#### `criarNavegar(dir)` — linha 1439
Avança (+1) ou volta (-1) no wizard. Ao avançar: valida a etapa atual (`criarValidarEtapa`) e salva os dados (`criarSalvarEtapa`). Atualiza `CRIAR_STATE.etapaIdx` e chama `criarRenderEtapa`.

**Dependências externas:** `CRIAR_STATE`, `criarValidarEtapa`, `criarSalvarEtapa`, `criarRenderEtapa`.

---

#### `criarValidarEtapa()` — linha 1450
Valida a etapa atual do wizard:
- `'nivel'`: exige `CRIAR_STATE.nivel` selecionado
- `'identidade'`: exige `#criar-nome` preenchido; deriva `rpg_id` via `gerarRpgId`
- `'personagens'`: exige ao menos 1 card `[data-char-idx]`
- Demais: passa sem validação

Retorna `true/false`.

**Dependências externas:** `CRIAR_STATE`, `gerarRpgId`, `mostrarToast`, `document.getElementById`, `document.querySelectorAll`.

---

#### `criarSalvarEtapa()` — linha 1470
Delega para a função de salvar específica da etapa atual:
- `'identidade'` → copia nome, descrição e `rpg_id` de `#criar-nome`/`#criar-desc`/`#criar-id`
- `'atributos'` → `criarSalvarAtributos()`
- `'personagens'` → `criarSalvarPersonagens()`
- `'habilidades'` → `criarSalvarHabilidades()`
- `'lore'` → `criarSalvarLore()`
- `'mecanicas'` → `criarSalvarMecanicas()`

**Dependências externas:** `CRIAR_STATE`, `gerarRpgId`, `document.getElementById`, funções de salvar por etapa.

---

#### `gerarRpgId(nome)` — linha 1485
Função pura. Transforma o nome da campanha em slug: lowercase, espaços → `_`, remove não-alfanuméricos, trunca em 32 chars e adiciona sufixo `Date.now().toString(36)`.

**Dependências externas:** *Nenhuma.*

---

#### `criarRenderEtapa()` — linha 1492
Renderiza a etapa atual do wizard:
1. Atualiza dots de progresso (`#criar-steps-dots`).
2. Exibe/oculta botão Prev, define texto do Next (`'✦ Criar Campanha!'` na etapa `'revisar'` ou `'Próximo →'`).
3. Despacha para a função de render específica da etapa via mapa `{ nivel, identidade, atributos, personagens, habilidades, lore, mecanicas, revisar }`.

**Dependências externas:** `CRIAR_STATE`, `criarSubmit`, `criarNavegar`, funções `criarRender*`, `document.getElementById`.

---

#### `criarRenderNivel(body)` — linha 1527
Injeta HTML dos 3 cards de nível (`basico`, `intermediario`, `detalhado`) no `body`. Cada card chama `criarSelecionarNivel(nivel)`.

**Dependências externas:** `CRIAR_STATE`, `criarSelecionarNivel`.

---

#### `criarSelecionarNivel(nivel)` — linha 1568
Armazena o nível escolhido em `CRIAR_STATE.nivel`, copia as etapas de `CRIAR_NIVEIS[nivel]`. Se `attrDefs` ainda vazio, inicializa com `ATTR_PRESETS[0]`. Re-renderiza.

**Dependências externas:** `CRIAR_STATE`, `CRIAR_NIVEIS`, `ATTR_PRESETS`, `criarRenderEtapa`.

---

#### `criarRenderIdentidade(body)` — linha 1579
Renderiza o formulário de identidade da campanha: nome, ID (com auto-geração), descrição, paleta de cores (`COR_PRESETS`) e grid de ícones (`ICONES_OPCOES`).

**Dependências externas:** `CRIAR_STATE.dados`, `COR_PRESETS`, `ICONES_OPCOES`, `criarAutoId`, `criarSetCor`, `criarSetIcone`.

---

#### `criarAutoId(nome)` — linha 1624
Derivia `rpg_id` do nome digitado (slug) e preenche `#criar-id`.

**Dependências externas:** `document.getElementById`.

---

#### `criarSetCor(cor)` — linha 1629
Atualiza `CRIAR_STATE.dados.cor`, `#criar-cor` e marca o preset ativo.

**Dependências externas:** `CRIAR_STATE`, `document.getElementById`, `document.querySelectorAll`.

---

#### `criarSetIcone(key, el)` — linha 1637
Atualiza `CRIAR_STATE.dados.icone`, remove `.ativo` de todos os botões de ícone e adiciona ao `el` clicado.

**Dependências externas:** `CRIAR_STATE`, `document.querySelectorAll`.

---

#### `criarRenderAtributos(body)` — linha 1644
Renderiza a etapa de atributos com seções condicionais por nível:
- `basico`: sempre visível
- `status` (Mana/Stamina): `intermediario`+`detalhado`
- `especial` (Sanidade, Karma…): `detalhado` apenas
- `resistencia` (Armadura…): `detalhado` apenas

Inclui botões de preset e botões `＋ Atributo` por categoria.

**Dependências externas:** `CRIAR_STATE`, `ATTR_PRESETS`, `_renderAttrsList`, `criarAplicarPreset`, `criarAddAttr`, `criarAddResistencia`.

---

#### `_renderAttrsList(cat)` — linha 1690
Renderiza inputs de nome para atributos da categoria `cat`. Cada input tem `onchange` que atualiza `CRIAR_STATE.dados.attrDefs[idx].nome` diretamente.

**Dependências externas:** `CRIAR_STATE`.

---

#### `criarAplicarPreset(idx)` — linha 1702
Substitui os atributos `'basico'` por aqueles do preset `ATTR_PRESETS[idx]`, mantendo atributos de outras categorias. Re-renderiza.

**Dependências externas:** `CRIAR_STATE`, `ATTR_PRESETS`, `criarRenderAtributos`, `mostrarToast`.

---

#### `criarAddAttr(cat)` — linha 1712
Adiciona atributo vazio à categoria `cat`, re-renderiza e foca o último input.

**Dependências externas:** `CRIAR_STATE`, `criarRenderAtributos`, `document.getElementById`, `document.querySelectorAll`.

---

#### `criarAddResistencia()` — linha 1723
Adiciona atributo padrão `'Armadura'` com `opcoes` JSON de resistência, re-renderiza.

**Dependências externas:** `CRIAR_STATE`, `criarRenderAtributos`, `mostrarToast`.

---

#### `criarRemoverAttr(idx)` — linha 1729
Remove atributo pelo índice e re-renderiza.

---

#### `criarSalvarAtributos()` — linha 1734
Filtra `attrDefs` removendo entradas com `nome` em branco (dados já salvos via `onchange`).

---

#### `criarRenderPersonagens(body)` — linha 1741
Renderiza a etapa de personagens: lista de cards via `_renderCharCard` e botão `＋`.

**Dependências externas:** `CRIAR_STATE`, `_renderCharCard`, `criarAddPersonagem`.

---

#### `_renderCharCard(p, i, attrs)` — linha 1757
Renderiza um card de personagem com: cor, nome, tipo, HP máximo, cor individual e grid de inputs de atributos básicos/status. Todos os inputs têm `onchange` que atualiza `CRIAR_STATE.dados.personagens[i]` inline.

**Dependências externas:** `CRIAR_STATE`.

---

#### `criarAddPersonagem()` — linha 1798
Adiciona personagem padrão (`{ nome:'', tipo:'jogador', cor:'#4fa3d1', hp_max:100, atributos:{} }`), re-renderiza e rola/foca o novo card.

---

#### `criarRemoverPersonagem(i)` — linha 1809
Remove personagem pelo índice e re-renderiza.

---

#### `criarSalvarPersonagens()` — linha 1814
No-op: dados já salvos via `onchange`.

---

#### `criarRenderHabilidades(body)` — linha 1819
Renderiza a etapa de habilidades. Mostra aviso se não há personagens. Renderiza cards via `_renderSkillCard` com campos condicionais por nível:
- `avancado` (`intermediario`+`detalhado`): custo e cooldown
- `formula` (`detalhado`): fórmula de dano e tipo de dano

**Dependências externas:** `CRIAR_STATE`, `_renderSkillCard`, `criarAddHabilidade`.

---

#### `_renderSkillCard(h, i, chars, mostrarAvancado, mostrarFormula)` — linha 1841
Renderiza card de habilidade com: nome, personagem (select), efeito (textarea), custo/cooldown (se `mostrarAvancado`), fórmula/tipo de dano (se `mostrarFormula`). Todos com `onchange` em `CRIAR_STATE.dados.habilidades[i]`.

---

#### `criarAddHabilidade()` — linha 1896
Adiciona habilidade padrão, re-renderiza e rola ao último card.

---

#### `criarRemoverHabilidade(i)` — linha 1906
Remove habilidade pelo índice e re-renderiza.

---

#### `criarSalvarHabilidades()` — linha 1911
No-op: dados já salvos via `onchange`.

---

#### `criarRenderLore(body)` — linha 1914
Renderiza a etapa de lore com categorias fixas (`mundo`, `magia`, `sociedade`, `história`, `facções`, `regras`). Renderiza cards via `_renderLoreCard`.

**Dependências externas:** `CRIAR_STATE`, `_renderLoreCard`, `criarAddLore`.

---

#### `_renderLoreCard(l, i, categs)` — linha 1931
Renderiza card de lore: input de título, select de categoria e textarea de conteúdo.

---

#### `criarAddLore()` — linha 1944
Adiciona entrada de lore vazia, re-renderiza e rola ao último card.

---

#### `criarRemoverLore(i)` — linha 1953
Remove lore pelo índice e re-renderiza.

---

#### `criarSalvarLore()` — linha 1958
No-op: dados já salvos via `onchange`.

---

#### `criarRenderMecanicas(body)` — linha 1962
Renderiza a etapa de mecânicas com seções:
- **Combate e Movimento**: velocidade base, fator de velocidade, seleção de modo de turno (Livre vs. Exclusivo).
- **HP e Progressão**: HP inicial, HP por nível, nível máximo, atributo que contribui com HP (+ multiplicador), pontos de atributo por nível.

Define `window.criarSetModoTurno` inline para alternar `CRIAR_STATE.dados.mecanicas.turno_modo_exclusivo`.

**Dependências externas:** `CRIAR_STATE`, `document.getElementById`, `document.querySelectorAll`.

---

#### `criarSetModoTurno(exclusivo)` — linha 2050 *(definida dentro de `criarRenderMecanicas`)*
Atualiza `CRIAR_STATE.dados.mecanicas.turno_modo_exclusivo` e alterna a classe `.selecionado` nos cards de modo de turno.

---

#### `criarSalvarMecanicas()` — linha 2059
Lê todos os inputs do formulário de mecânicas e persiste em `CRIAR_STATE.dados.mecanicas`: `velocidade_base`, `velocidade_fator`, `hp_base`, `hp_por_nivel`, `nivel_maximo`, `pontos_attr_por_nivel`, `hp_attr`, `hp_attr_mult`. `turno_modo_exclusivo` já salvo via click.

**Dependências externas:** `CRIAR_STATE`, `document.getElementById`.

---

#### `criarRenderRevisar(body)` — linha 2077
Renderiza a etapa de revisão com resumo de todas as seções do wizard: nome + cor + nível + ID, atributos (até 8, com ícone por categoria), personagens (com cor individual), habilidades e lore (opcionais). Exibe aviso sobre tutorial ativado por padrão.

**Dependências externas:** `CRIAR_STATE`, `gerarRpgId`.

---

#### `criarSubmit()` — linha 2127 *(async)*
Orquestrador final do wizard. Fluxo:
1. Valida nome e existência de ao menos 1 personagem.
2. Constrói `payload` compatível com `importRPG`: `config` (com mecânicas), `characters`, `skills`, `lore`, `attr_defs`.
3. Chama `await importRPG(payload)`.
4. Ativa tutorial da campanha via `localStorage` (`rpghub_tutorial_{rpgId}`).
5. Recarrega `HUB_DATA.rpgs` via `getAllRPGs()`, renderiza lista.
6. Após 1,2 s: chama `fecharCriarCampanha()` e `entrarRPG(rpgId)`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `CRIAR_STATE` | global | mesmo arquivo |
| `importRPG` | função async | `js/hub/import.js` |
| `gerarRpgId` | função | mesmo arquivo |
| `getAllRPGs` | função | `js/auth/auth.js` ou hub |
| `HUB_DATA` | global | `js/state.js` ou hub |
| `renderRPGList` | função | `js/hub/hub.js` ou similar |
| `entrarRPG` | função | `js/hub/hub.js` |
| `fecharCriarCampanha` | função | mesmo arquivo |
| `mostrarToast` | função | **não encontrada ainda** |
| `localStorage` | Browser API | Browser |

---

### Resolução de dependências — linhas 1962–2222

| Dependência marcada "não encontrada" | Encontrada em |
|--------------------------------------|---------------|
| `_resolveItemImgSrc` | — **não encontrada no arquivo** (provavelmente alias de lógica inline em `renderTabelasTab`) |
| `abrirEditarItemCatalogo` | — **não encontrada no arquivo** (possivelmente referência obsoleta, `abrirModalItemDef` é a função real) |
| `mostrarToast` | — **não encontrada neste arquivo** (definida em outro módulo, usada extensivamente aqui) |

---

### Sumário de dependências externas não resolvidas — `js/systems/inventory.js`

| Dependência | Tipo | Módulo provável |
|-------------|------|-----------------|
| `mostrarToast` | função | `js/ui/modals.js` ou `js/hub/hub.js` |
| `saveCharacterStats` | função | `js/characters/characters.js` |
| `uploadToStorage` | função | `js/core/supabase.js` |
| `getAllRPGs` | função | `js/auth/auth.js` |
| `HUB_DATA` | global | `js/state.js` ou `js/hub/hub.js` |
| `renderRPGList` | função | `js/hub/hub.js` |
| `importRPG` | função | `js/hub/import.js` |
| `arSb` | função | `js/systems/arena.js` |
| `renderArenaPersonagens`, `renderArenaEntidades` | funções | `js/systems/arena.js` |
| `mapaRenderStatus` | função | `js/maps/maps.js` |
| `itemDefCatChange` | função | mesmo arquivo — linha 1007 ✅ |

---

---

### Resolução de dependências — linhas 973–1472

| Dependência marcada "não encontrada" | Encontrada em |
|--------------------------------------|---------------|
| `abrirModalTabela` | linha 1221 (mesmo arquivo) |
| `deletarTabela` | linha 1319 (mesmo arquivo) |
| `toggleVisibilidadeTabela` | linha 1329 (mesmo arquivo) |
| `deletarItemDef` | linha 1203 (mesmo arquivo) |
| `abrirEditarItemCatalogo` | — não encontrada (possivelmente alias de `abrirModalItemDef`) |
| `_resolveItemImgSrc` | **não encontrada ainda** (linhas > 1472) |

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

> *(Continuação nas linhas 1444–1944 abaixo)*

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `BATALHA_ATUAL_ID`, `MAPA_STATE.batalhas` | globais | `js/state.js` |
| `document.getElementById('mapa-grid')` | DOM API | Browser |
| `mapaHideRangeCircle` | função | mesmo arquivo (linha 1499) ✅ |

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

---

### Funções definidas (linhas 1444–1944)

#### `_mesaShowRangeCircle(atacanteNome, alcance)` — linha 1444 *(completa)*
Busca a posição do atacante nos participantes da batalha e cria `#mapa-range-circle`: `div` circular absoluto no `#mapa-grid`, com borda tracejada âmbar e animação `pulseRange`. Injeta o `@keyframes` se ainda não existir.

**Dependências externas:** `BATALHA_ATUAL_ID`, `MAPA_STATE.batalhas`, `document.getElementById`, `mapaHideRangeCircle` (mesmo arquivo, linha 1499).

---

#### `mapaHideRangeCircle()` — linha 1499
Remove o elemento `#mapa-range-circle` do DOM se existir.

---

#### `mapaShowAoECircle(centerPos, radius)` — linha 1504
Cria `#mapa-aoe-circle`: círculo vermelho de AoE com animação `pulseAoE`. Atualiza `_AOE_STATE` (verificação defensiva). Injeta `@keyframes` se necessário.

**Dependências externas:** `document.getElementById('mapa-grid')`, `_AOE_STATE` (**não encontrado ainda**), `mapaHideAoECircle` (mesmo arquivo).

---

#### `mapaHideAoECircle()` — linha 1556
Remove `#mapa-aoe-circle` e limpa `_AOE_STATE.active/center/radius` (verificação defensiva).

---

#### `_atkMostrarTrigger()` — linha 1572
Exibe o card flutuante de confirmação de ataque (`#atk-trigger-card`). Lê `COMBATE.habilidadeSel`, `alvoNome` e `dadosRolados` para montar o HTML. Exibe resultado do dano, botões Cancelar/Aplicar e inicia countdown de 15s via `_atkTriggerStartCountdown`.

**Dependências externas:** `COMBATE`, `document.getElementById`, `document.body`, `_TRIGGER_CARD_STATE` (mesmo arquivo), `_atkOcultarTrigger` (mesmo arquivo), `_atkTriggerStartCountdown` (mesmo arquivo).

---

#### `_atkTriggerStartCountdown()` — linha 1652
Inicia intervalo de 1s que decrementa `_TRIGGER_CARD_STATE.countdown`. Ao chegar a zero, chama `_atkTriggerCancelar`.

**Dependências externas:** `_TRIGGER_CARD_STATE`, `document.getElementById('atk-trigger-countdown')`, `_atkTriggerCancelar` (mesmo arquivo).

---

#### `_atkOcultarTrigger()` — linha 1672
Oculta o card com animação `slideOutRight` (300ms), cancela o intervalo de countdown, reseta `_TRIGGER_CARD_STATE`.

---

#### `window._atkTriggerAplicar()` — linha 1688
Aplica o ataque do trigger card: verifica `COMBATE._jaAplicado`, chama `aplicarDanoBatalha` e `setCooldownBatalha`, emite `dano_aplicado` e `habilidade_usada` no `HUB_EVENTS`, mostra toast de sucesso e fecha o card.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `COMBATE` | objeto global | `js/combat/combat.js` (provável) |
| `mostrarToast` | função | **não encontrada ainda** |
| `aplicarDanoBatalha` | função | **não encontrada ainda** |
| `setCooldownBatalha` | função | **não encontrada ainda** |
| `HUB_EVENTS.emit` | método | `js/config.js` |
| `BATALHA_ATUAL_ID` | variável global | `js/state.js` |
| `_atkOcultarTrigger` | função | mesmo arquivo |

---

#### `window._atkTriggerCancelar()` — linha 1736
Fecha o trigger card e reseta `COMBATE._jaAplicado` e `_pendingTrigger`. Re-renderiza UI via `_aplicarEstadoBatalhaUI` se contexto for campanha.

**Dependências externas:** `_atkOcultarTrigger`, `COMBATE`, `_aplicarEstadoBatalhaUI` (`js/combat/combat.js` provável).

---

#### `_estadoBatalhaJogador(nomePersonagem)` — linha 1751
> ⚠ **Redefinição local:** esta função já foi mapeada em `js/core/events.js` linha 23 com lógica mais completa (suporta Arena + mapa). Esta versão em hub.js é uma reimplementação simplificada, sem suporte a Arena — retorna `'fora_combate'`, `'livre'` ou `'outro_turno'` consultando apenas `MAPA_STATE.batalhas`.

**Dependências externas:** `BATALHA_ATUAL_ID`, `MAPA_STATE.batalhas`.

---

#### `abrirModalAtaque(atacanteNome, contexto)` — linha 1783 *(parcial — continua além de 1944)*
Abre o modal de ataque. Verifica estado de batalha do jogador (bloqueia se não for a sua vez). Reseta completamente o objeto `COMBATE`. Carrega lista de habilidades via `atkGetHabilidadesArena` ou `atkGetHabilidadesCampanha` conforme o contexto. Monta HTML dos botões de habilidade com badges de cooldown/bloqueio/range. Exibe seção de ações criativas se o jogador tiver permissão. Chama `atkRenderizarSecaoPets` e `atkIrParaStep(1)`. Implementa lógica interna `_setModalModo` para posicionar o modal em desktop (painel direito da mesa) ou mobile (sidebar).

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `mostrarToast` | função | **não encontrada ainda** |
| `RPG_DATA.myRole` | propriedade | `js/state.js` |
| `_estadoBatalhaJogador` | função | mesmo arquivo (linha 1751) |
| `COMBATE` | objeto global | `js/combat/combat.js` (provável) |
| `_atkOcultarTrigger` | função | mesmo arquivo |
| `atkGetHabilidadesArena` | função | **não encontrada ainda** |
| `atkGetHabilidadesCampanha` | função | **não encontrada ainda** |
| `getCooldownsBatalhaSeguro` | função | mesmo arquivo (linha 1433) |
| `AR.estado.cooldowns` | propriedade | `js/systems/arena.js` |
| `atkVerificarBloqueioAtaque` | função | **não encontrada ainda** |
| `calcularRangeDano`, `calcModAtributo` | funções | mesmo arquivo |
| `temPermissao` | função | `js/core/events.js` |
| `criativoSetTipo`, `criativoSetAlvo` | funções | `js/systems/creative.js` (provável) |
| `atkRenderizarSecaoPets` | função | **não encontrada ainda** |
| `atkIrParaStep` | função | **não encontrada ainda** |
| `document.getElementById` | DOM API | Browser |

*(Continuação nas linhas 1783–2300 abaixo)*

---

### Resolução de dependências — linhas 1444–1944

| Função/Variável | Encontrada em |
|-----------------|---------------|
| `mapaHideRangeCircle` | `js/hub/hub.js` linha 1499 ✅ |
| `mapaShowAoECircle` | `js/hub/hub.js` linha 1504 ✅ |
| `mapaHideAoECircle` | `js/hub/hub.js` linha 1556 ✅ |
| `_atkMostrarTrigger` | `js/hub/hub.js` linha 1572 ✅ |
| `_atkTriggerAplicar` | `js/hub/hub.js` linha 1688 ✅ |
| `_atkTriggerCancelar` | `js/hub/hub.js` linha 1736 ✅ |

---

### Funções definidas (linhas 1783–2300)

#### `abrirModalAtaque(atacanteNome, contexto)` — linha 1783 *(completa)*
Abre o modal de ataque com suporte a 3 modos de exibição conforme o contexto e o layout:
- **`painel`** — embutido no `#mesa-acao-painel` (desktop 3-col) ou `#atk-sidebar-painel` (mobile)
- **`inline`** — posicionado absolutamente sobre `#atk-painel-campanha-anchor` (campanha com âncora visível)
- **`overlay`** — modal fullscreen fixo (`position:fixed`, z-index 9999) como fallback

Fluxo interno:
1. Valida estado de turno do jogador via `_estadoBatalhaJogador`
2. Reseta o objeto global `COMBATE` completamente
3. Carrega habilidades (`atkGetHabilidadesArena` / `atkGetHabilidadesCampanha`) e monta lista com badges de cooldown/bloqueio/range
4. Exibe ações criativas se `temPermissao('ataque_criativo')`
5. Renderiza seção de pets via `atkRenderizarSecaoPets`
6. Vai ao step 1 via `atkIrParaStep(1)`

---

#### `fecharModalAtaque()` — linha 2011
Fecha o modal de ataque. Devolve o elemento ao `document.body` se estava embutido no painel ou sidebar. Limpa círculos de alcance e AoE. Se `COMBATE._pendingTrigger`, exibe o trigger card em vez de simplesmente fechar. Se foi cancelado em contexto campanha, re-renderiza via `_aplicarEstadoBatalhaUI`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById` | DOM API | Browser |
| `COMBATE`, `ATAQUE_MAPA_STATE` | objetos globais | `js/combat/combat.js` (provável) |
| `mapaHideRangeCircle`, `mapaHideAoECircle` | funções | mesmo arquivo |
| `_mesaRenderAcoes` | função | mesmo arquivo |
| `_atkMostrarTrigger` | função | mesmo arquivo |
| `_aplicarEstadoBatalhaUI` | função | `js/combat/combat.js` (provável) |

---

#### `configurarAtalhosCombate()` — linha 2068
Registra listener `keydown` global para o modal de ataque. Atalhos:
- `1`–`9` → `atkSelecionarHabilidade(idx)`
- `Enter` → `_mesaAtaqueInlineRolar()` ou `_mesaAtaqueInlineConfirmar()` conforme botão visível
- `Escape` → `fecharModalAtaque()`
- `R` → `_mesaAtaqueInlineRolar()`

Inicializado imediatamente (ou no `DOMContentLoaded` se o documento ainda estiver carregando).

**Dependências externas:** `document.addEventListener`, `atkSelecionarHabilidade` (**não encontrada ainda**), `_mesaAtaqueInlineRolar`, `_mesaAtaqueInlineConfirmar`, `fecharModalAtaque` (mesmo arquivo).

---

#### `window._debugEstadoBatalha()` — linha 2122
Helper de debug. Loga no console o estado completo: variáveis globais (`BATALHA_ATUAL_ID`, `MAPA_STATE`, `RPG_DATA`, `COMBATE`, `ATAQUE_MAPA_STATE`, `_TRIGGER_CARD_STATE`, `_AOE_STATE`), lista de batalhas e participantes, lista de personagens e tokens no mapa, e resultado de `_mesaAtaqueInlineGetAlvos` para o atacante atual.

---

#### `ativarModoAtaqueMapa(atacanteNome)` — linha 2192
Ativa o modo de ataque clicável no mapa. Define `ATAQUE_MAPA_STATE.ativo = true`. Cria/exibe painel flutuante `#atk-mapa-float-panel` no canto superior direito. Chama `_marcarAlvosDisponiveis` para destacar tokens inimigos e aliados.

**Dependências externas:** `ATAQUE_MAPA_STATE` (`js/combat/combat.js` provável), `document.getElementById`, `document.body`, `_marcarAlvosDisponiveis` (mesmo arquivo).

---

#### `desativarModoAtaqueMapa()` — linha 2237
Reseta `ATAQUE_MAPA_STATE`, oculta o painel flutuante e remove classes de destaque de todos os `.mapa-token`.

---

#### `_marcarAlvosDisponiveis(atacanteNome)` — linha 2249
Destaca tokens no mapa conforme o lado do participante: inimigos recebem `atk-target-disponivel` (glow vermelho + `pulseTarget`), aliados recebem `atk-target-buff` (glow azul). Injeta `#atk-mapa-styles` com os keyframes se ainda não existir.

**Dependências externas:** `BATALHA_ATUAL_ID`, `MAPA_STATE.batalhas`, `document.querySelector`, `document.getElementById`, `document.head`.

---

### Resumo final de `js/hub/hub.js`

| Seção | Linhas | Funções/sistemas |
|-------|--------|-----------------|
| Mesa 3 colunas | 1–285 | `mesaModoVerificar`, `_mesaInjetarColunas`, `_mesaRenderizarColunas`, `_mesaRenderChars`, `_mesaRenderIniciativa`, `_mesaRenderBarraSkills`, `_mesaRenderAcoes`, `_mesaAtacarHab` |
| Feed + Notificações + Contexto | 288–396 | `feedAdicionarEntrada`, `feedRenderizar`, `barraContextoInicializar`, `barraContextoAtualizar`, `notifAdicionar`, `notifRenderizar` + 3 globais |
| Entrada/saída campanha | 398–565 | `entrarRPG`, monkey-patch entrarRPG+combateBroadcast, `aplicarTema`, `mostrarLoading`, `loadingEscapar`, `ocultarLoading`, `mostrarApp`, `voltarHub` |
| Globais de UI | 568–584 | `selecionarAlvoLista`, `_atualizarBadgeMesa` |
| Ataque inline (3 steps) | 600–957 | `_mesaDispararAnimacao`, `_mesaRenderAtaqueInline` |
| Navegação ataque inline | 963–1173 | `_mesaAtaqueInlineSelecionarHab/Alvo/Voltar`, `_mesaAtaquePet`, `_mesaAtaqueInlineRolar`, `_mesaAtaqueInlineConfirmar` |
| Alvos, pets, cálculos | 1180–1438 | `_mesaAtaqueInlineGetAlvos`, `_mesaPetGet*`, `_mesaPetDonoEstaAtivo`, `_calcularDistanciaSegura`, `calcularRangeDano`, `calcModAtributo`, `rolarFormulaDano`, `getCooldownsBatalhaSeguro` |
| Círculos visuais | 1444–1566 | `_mesaShowRangeCircle`, `mapaHideRangeCircle`, `mapaShowAoECircle`, `mapaHideAoECircle` |
| Trigger flutuante | 1572–1745 | `_atkMostrarTrigger`, `_atkTriggerStartCountdown`, `_atkOcultarTrigger`, `_atkTriggerAplicar`, `_atkTriggerCancelar` |
| Modal de ataque | 1751–2008 | `_estadoBatalhaJogador` (redefinição), `abrirModalAtaque`, `fecharModalAtaque` |
| Atalhos + Debug + Mapa | 2068–2296 | `configurarAtalhosCombate`, `_debugEstadoBatalha`, `ativarModoAtaqueMapa`, `desativarModoAtaqueMapa`, `_marcarAlvosDisponiveis` |

---

### Dependências globais ainda não resolvidas (ao fim do hub.js)

| Função/Variável | Referenciada em |
|-----------------|-----------------|
| `mostrarToast` | amplamente em todo o sistema |
| `atkGetHabilidadesArena` | `abrirModalAtaque` |
| `atkGetHabilidadesCampanha` | `_mesaRenderAcoes`, `abrirModalAtaque` |
| `atkVerificarBloqueioAtaque` | `_mesaRenderAtaqueInline`, `abrirModalAtaque` |
| `atkSelecionarHabilidade` | `configurarAtalhosCombate` |
| `atkRenderizarSecaoPets` | `abrirModalAtaque` |
| `atkIrParaStep` | `abrirModalAtaque` |
| `_atkAplicarDanoFinal` | `_mesaAtaqueInlineConfirmar` |
| `aplicarDanoBatalha` | `_atkTriggerAplicar` |
| `setCooldownBatalha` | `_atkTriggerAplicar` |
| `getCooldownsBatalha` | `getCooldownsBatalhaSeguro` |
| `verificarCritico` | `rolarFormulaDano` |
| `mostrarAnimacaoCritico` | `rolarFormulaDano` |
| `_AOE_STATE` | `mapaShowAoECircle`, `mapaHideAoECircle` |
| `ATAQUE_MAPA_STATE` | `fecharModalAtaque`, `ativarModoAtaqueMapa`, `desativarModoAtaqueMapa` |
| `TOKEN_CTRL` | `_mesaRenderAcoes`, `selecionarAlvoLista` |
| `salvarNav` | `entrarRPG` |
| `renderDados` | `entrarRPG` |
| `renderConfig` | `entrarRPG` |
| `_animMedia` | `_mesaDispararAnimacao` |

---

## 20. `js/ui/tabs.js` *(linhas 1–500 — Em progresso)*

**Linhas totais:** 2229  
**Descrição real:** Apesar do nome `tabs.js`, este arquivo implementa o **sistema de cenário tático do mapa**: paredes, portas (com trancas/chaves e transição de mapa), baús, chaves colecionáveis, obstáculos e o editor visual de cenário (`CENA_ED`). O nome do arquivo não reflete o conteúdo.

### Variáveis/constantes definidas (linhas 1–500)

| Nome | Linha | Tipo | Descrição |
|------|-------|------|-----------|
| `WALLS_STATE` | 13 | `const` objeto | Estado do modo de edição de paredes: `primeroPonto` (snap point aguardando 2º clique) e `configAtual` (`{ cor, largura }`) |
| `CENARIO_STATE` | 415 | `const` objeto | Estado do painel de cenário: `placement` (objeto aguardando clique no mapa) e `tabAtiva` (aba selecionada: `'porta'`/`'chave'`/`'bau'`/`'obstaculo'`) |

### Monkey-patches registrados na carga (linhas 1–500)

| Alvo | Linha | O que adiciona |
|------|-------|----------------|
| `window.ctxGerarBotoes` | 378 | Se há porta adjacente ao personagem, insere botão `'Abrir/Fechar Porta'` no início da lista de ações contextuais |
| `window.ctxExecutarAcao` | 400 | Intercepta `botao.acao === 'usar_porta'` e chama `usarPorta`; delega outros casos ao original |

### Funções definidas (linhas 1–500)

#### `paredeBloqueiaMovimento(mapId, colAtual, rowAtual, dc, dr)` — linha 19
Verifica se existe uma parede no `render_data.paredes[]` do mapa que bloqueia o movimento de `(colAtual, rowAtual)` na direção `(dc, dr)`. Normaliza paredes no formato genérico (`col1/row1/col2/row2`) para o formato canônico `{tipo, col, row}`. Suporta movimentos horizontais (parede vertical `tipo='v'`) e verticais (parede horizontal `tipo='h'`).

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `_getMapaById` | função | `js/maps/maps.js` |

---

#### `portaAdjacenteAo(mapId, col, row)` — linha 48
Retorna a primeira porta em `render_data.portas[]` dentro de distância Chebyshev ≤ 1 de `(col, row)`, ou `null`.

**Dependências externas:** `_getMapaById`.

---

#### `usarPorta(mapId, portaId, charNome)` — linha 57 *(async)*
Toggle `porta.aberta`. Antes: verifica trança — se `porta.trancada && porta.chave_palavra` e o personagem não tem a chave (`_charTemChave`), exibe toast e aborta. Após toggle: persiste via `salvarRenderData`, re-renderiza tokens. Se porta foi aberta e tem `mapa_destino`: chama `_portaTransportarChar`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `_getMapaById` | função | `js/maps/maps.js` |
| `_charTemChave` | função | mesmo arquivo (linha 124) |
| `TOKEN_CTRL.nomeSelecionado` | propriedade | `js/maps/maps.js` |
| `RPG_DATA.linked` | propriedade | `js/state.js` |
| `salvarRenderData` | função | mesmo arquivo (linha 365) |
| `mapaRenderTokens` | função | `js/maps/maps.js` |
| `_portaTransportarChar` | função | mesmo arquivo (linha 89) |
| `mostrarToast` | função | `js/ui/modals.js` |

---

#### `_portaTransportarChar(charNome, porta)` — linha 89 *(async)*
Transporta o personagem ao destino da porta: atualiza `map_positions[mapa_destino]` e `active_map_id`, persiste via PATCH em `characters`, navega para o mapa destino (tenta `navegarParaMapa` → `mapaCarregar` → `selecionarMapa`). Se `superficieVerificarEntrada` disponível: chama para a célula de chegada. Faz broadcast `'porta_transicao'` para outros jogadores.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA.characters`, `RPG_DATA.mapas` | globais | `js/state.js` |
| `sb` | função | `js/core/supabase.js` |
| `navegarParaMapa` / `mapaCarregar` / `selecionarMapa` | funções | `js/maps/maps.js` |
| `superficieVerificarEntrada` | função | `js/maps/maps.js` (opcional) |
| `realtimeBroadcast` | função | `js/core/realtime.js` |
| `mostrarToast` | função | `js/ui/modals.js` |

---

#### `_charTemChave(charNome, mapId, chavePalavra)` — linha 124
Verifica se o personagem tem a chave em `custom_attrs.chaves_coletadas` ou `custom_attrs.chaves`. Suporta chave como string simples ou objeto `{ chave_palavra }`.

**Dependências externas:** `RPG_DATA.characters`.

---

#### `paredePorRenderizar(m)` — linha 132
Renderiza paredes e portas no SVG overlay (`#mapa-dist-svg`). Remove elementos anteriores com classe `.mapa-parede`/`.mapa-porta`. Para cada parede: cria `<line>` SVG com coords calculadas a partir da célula (suporta `tipo:'v'`, `tipo:'h'` e formato genérico `col1/row1/col2/row2`). Para cada porta: cria `<circle>` + `<text>` SVG com cor/ícone refletindo estado `aberta`. Em modo `toolMode==='paredes'`: clique na parede chama `paredRemover`; clique na porta chama `portaEditar`. Fora do modo edição: clique na porta chama `usarPorta`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `MAPA_STATE.toolMode` | propriedade | `js/maps/maps.js` |
| `paredRemover` | função | mesmo arquivo (linha 308) |
| `portaEditar` | função | mesmo arquivo (linha 348) |
| `usarPorta` | função | mesmo arquivo (linha 57) |
| `document.getElementById` | DOM API | Browser |

---

#### `_snapParede(xPx, yPx, canvas, mapa)` — linha 233
Converte coordenadas de pixel para o snap point mais próximo na grade. Retorna `{ tipo:'v', col, row }` se a borda vertical for mais próxima, ou `{ tipo:'h', col, row }` caso contrário.

**Dependências externas:** *Nenhuma.*

---

#### `_gerarSegmentos(p1, p2)` — linha 256
Gera array de segmentos de parede entre dois snap points: se ambos `'v'` na mesma coluna → segmentos verticais sequenciais; se ambos `'h'` na mesma linha → segmentos horizontais sequenciais; caso contrário: retorna apenas `p1` (fallback).

**Dependências externas:** *Nenhuma.*

---

#### `paredAdicionarPonto(xPx, yPx)` — linha 271
Estado em 2 cliques: primeiro clique armazena snap em `WALLS_STATE.primeroPonto`; segundo clique gera segmentos via `_gerarSegmentos`, os adiciona a `render_data.paredes[]` com ID único, re-renderiza e persiste.

**Dependências externas:** `MAPA_STATE`, `_getMapaById`, `_snapParede`, `_gerarSegmentos`, `WALLS_STATE`, `RPG_DATA.mapas`, `paredePorRenderizar`, `salvarRenderData`, `mostrarToast`, `document.getElementById`.

---

#### `paredRemover(mapId, paredId)` — linha 308
Remove parede por ID de `render_data.paredes[]`, re-renderiza e persiste.

**Dependências externas:** `_getMapaById`, `RPG_DATA.mapas`, `paredePorRenderizar`, `salvarRenderData`.

---

#### `portaAdicionar(col, row)` — linha 318
Adiciona nova porta em `render_data.portas[]`. Lê configuração de `CENARIO_STATE.placement` (nome, trancada, chave_palavra, mapa_destino, coords de destino, cor, ícone) ou usa defaults. Persiste e re-renderiza.

**Dependências externas:** `MAPA_STATE.mapaAtualId`, `_getMapaById`, `CENARIO_STATE`, `RPG_DATA.mapas`, `paredePorRenderizar`, `salvarRenderData`.

---

#### `portaEditar(mapId, portaId)` — linha 348
Edição simples via `prompt()`: permite renomear a porta ou deletá-la (input vazio). Persiste e re-renderiza.

**Dependências externas:** `_getMapaById`, `RPG_DATA.mapas`, `paredePorRenderizar`, `salvarRenderData`.

---

#### `salvarRenderData(entryId, renderData)` — linha 365 *(async)*
PATCH em `mapas?id=eq.{entryId}` com o campo `render_data`. Erros logados mas não propagados.

**Dependências externas:** `sb`, `CURRENT_RPG`.

---

#### `abrirPainelCenario()` — linha 421
Verifica se há mapa selecionado, chama `cenarioRenderObjetos()` e exibe `#modal-cenario-overlay`.

**Dependências externas:** `MAPA_STATE.mapaAtualId`, `cenarioRenderObjetos`, `mostrarToast`, `document.getElementById`.

---

#### `fecharPainelCenario()` — linha 430
Fecha o painel, limpa `CENARIO_STATE.placement`, zera `MAPA_STATE.toolMode`, remove classe `.ativo` dos botões de ferramenta. Chama `atualizarResumoObjetosCenario` se disponível.

**Dependências externas:** `CENARIO_STATE`, `MAPA_STATE`, `atualizarResumoObjetosCenario` (opcional), `document.getElementById`, `document.querySelectorAll`.

---

#### `cenarioTab(tipo, btn)` — linha 442
Ativa a aba do painel de cenário: oculta todas as divs `.cenario-tab`, remove destaque de todos os botões, exibe `#cenario-tab-{tipo}` e aplica destaque roxo no `btn`.

**Dependências externas:** `CENARIO_STATE`, `document.querySelectorAll`, `document.getElementById`.

---

#### `cenarioBauLootChange()` — linha 456
Mostra/oculta as seções de loot do baú (`#cen-bau-aleatorio-wrap`, `#cen-bau-item-wrap`, `#cen-bau-ouro-wrap`) conforme o tipo selecionado em `#cen-bau-loot-tipo`.

**Dependências externas:** `document.getElementById`.

---

#### `cenarioBuscarItem()` — linha 463 *(async)*
Filtra `INV.itemDefs` pelo texto em `#cen-bau-item-busca` (até 8 resultados) e renderiza lista clicável. Cada item chama `cenarioSelecionarItem`.

**Dependências externas:** `INV.itemDefs`, `cenarioSelecionarItem`, `document.getElementById`.

---

#### `cenarioSelecionarItem(id, nome, icone)` — linha 478
Preenche `#cen-bau-item-id` com o ID selecionado, exibe confirmação em `#cen-bau-item-sel` e limpa a lista de busca.

**Dependências externas:** `document.getElementById`.

---

#### `cenarioAtivarPlacement(tipo)` — linha 486 *(parcial — continua além de 500)*
Coleta a configuração do formulário para o tipo de objeto (`porta`, `chave`, `bau`, `obstaculo`), armazena em `CENARIO_STATE.placement` e ativa o modo de clique no mapa.

> ⚠ Função não completamente lida. A próxima análise começa na linha 486.

---

### Variáveis/constantes definidas (linhas 486–985)

| Nome | Linha | Tipo | Descrição |
|------|-------|------|-----------|
| `CENA_ED` | 874 | `const` objeto | Estado do editor de cena avançado: `ferramenta`, `primeroPonto`, `mapa`, `undoStack`, `cfgBauItens` |

### Monkey-patches adicionais (linhas 486–985)

| Alvo | Linha | O que adiciona |
|------|-------|----------------|
| `window.ctxGerarBotoes` (2ª camada) | 830 | Para objetos de cenário adjacentes (Chebyshev ≤ 1): insere botões de ação para porta, chave e baú |
| `window.ctxExecutarAcao` (2ª camada) | 855 | Intercepta `botao.acao === 'cenario_obj'` e chama `cenarioInteragirObjeto` |

### Funções definidas (linhas 486–985)

#### `cenarioAtivarPlacement(tipo)` — linha 486 *(completa)*
Coleta configuração do formulário por tipo:
- `'porta'`: nome, trancada, chave_palavra, transição de mapa (mapa_destino, destino_col/row), cor, ícone
- `'chave'`: nome, chave_palavra, ícone
- `'bau'`: nome, trancado, chave_palavra, loot_tipo (`aleatorio`/`item_catalog`/`ouro`/`nenhum`) + campos específicos
- `'obstaculo'`: nome, ícone, tamanho

Armazena em `CENARIO_STATE.placement`, define `MAPA_STATE.toolMode = 'cenario_placement'` e fecha o painel aguardando clique no mapa.

**Dependências externas:** `CENARIO_STATE`, `MAPA_STATE`, `mostrarToast`, `document.getElementById`.

---

#### `cenarioHandleMapaClick(e, wrap)` — linha 539
Handler de clique no mapa quando `toolMode === 'cenario_placement'`. Converte coordenadas de pixel para célula (col/row), cria objeto com ID único em `render_data.objetos[]`, persiste, re-renderiza tokens, exibe toast e limpa o estado de placement.

**Dependências externas:** `MAPA_STATE`, `CENARIO_STATE`, `_getMapaById`, `RPG_DATA.mapas`, `mapaRenderTokens`, `salvarRenderData`, `cenarioRenderObjetos`, `mostrarToast`, `document.getElementById`.

---

#### `cenarioRenderObjetos()` — linha 577
Renderiza a lista de objetos do mapa no `#cenario-objetos-lista` dentro do modal. Mostra paredes (com botão de remover via `paredRemover`) e objetos (com ícone dinâmico por tipo/estado, coordenadas, botão de loot para baús via `cenarioAbrirBauEditor`, e botão de remover via `cenarioRemoverObjeto`).

**Dependências externas:** `_getMapaById`, `MAPA_STATE`, `paredRemover`, `cenarioAbrirBauEditor`, `cenarioRemoverObjeto`, `document.getElementById`.

---

#### `cenarioRemoverObjeto(id)` — linha 608
Remove objeto por ID de `render_data.objetos[]`, re-renderiza no mapa e persiste.

**Dependências externas:** `MAPA_STATE`, `_getMapaById`, `RPG_DATA.mapas`, `mapaRenderTokens`, `salvarRenderData`, `cenarioRenderObjetos`.

---

#### `cenarioAbrirBauEditor(bauId)` — linha 621
Edição simplificada de loot via `prompt()`: permite adicionar item por nome ao `bau.loot_itens[]`. Busca em `INV.itemDefs` por correspondência exata de nome. Persiste e atualiza lista.

**Dependências externas:** `_getMapaById`, `MAPA_STATE`, `INV.itemDefs`, `RPG_DATA.mapas`, `salvarRenderData`, `cenarioRenderObjetos`, `mostrarToast`.

---

#### `cenarioRenderObjetos_mapa(m)` — linha 639
Renderiza os objetos de cenário no overlay `#mapa-tokens` como divs absolutos com ícone + label. Objetos já coletados/abertos são omitidos. Cada elemento tem `click` → `cenarioInteragirObjeto`.

**Dependências externas:** `cenarioInteragirObjeto`, `document.getElementById`.

---

#### `cenarioInteragirObjeto(obj, mapId)` — linha 682
Dispatcher de interação por tipo:
- `'porta'` → `cenarioAbrirPorta`
- `'chave'` → `cenarioPegarChave`
- `'bau'` → `cenarioAbrirBau`
- `'obstaculo'` → toast informativo

Exige personagem selecionado (exceto para o mestre).

**Dependências externas:** `RPG_DATA.myRole`, `TOKEN_CTRL.nomeSelecionado`, `RPG_DATA.linked`, `cenarioAbrirPorta`, `cenarioPegarChave`, `cenarioAbrirBau`, `mostrarToast`.

---

#### `_cenarioSalvarObj(mapa, entry)` — linha 704
Helper interno: sincroniza `entry.mapa.render_data`, chama `mapaRenderTokens` e `salvarRenderData`.

**Dependências externas:** `mapaRenderTokens`, `salvarRenderData`.

---

#### `cenarioAbrirPorta(porta, mapId, charNome, mapa)` — linha 710
Toggle `porta.aberta`. Se trancada: verifica `custom_attrs.chaves_coletadas`. Persiste via `_cenarioSalvarObj`.

**Dependências externas:** `RPG_DATA.characters`, `RPG_DATA.mapas`, `_cenarioSalvarObj`, `mostrarToast`.

---

#### `cenarioPegarChave(chave, mapId, charNome, mapa)` — linha 729
Marca `chave.coletada = true`, adiciona `chave_palavra` a `char.custom_attrs.chaves_coletadas`. Persiste render_data e PATCH em `characters`.

**Dependências externas:** `RPG_DATA.characters`, `RPG_DATA.rpgId`, `_cenarioSalvarObj`, `sb`, `mostrarToast`.

---

#### `cenarioAbrirBau(bau, mapId, charNome, mapa)` — linha 752 *(async)*
Abre baú (se não já aberto e sem tranca/chave bloqueando). Distribui loot conforme `bau.loot_tipo`:

| loot_tipo | Ação |
|-----------|------|
| `'aleatorio'` | Gera drops via `calcularDrops`/`gerarStatusItem`/`gerarNomeItem`, insere em `item_catalog` e `loot_pendente` |
| `'item'` | POST direto em `inventario` |
| `'ouro'` | Incrementa `custom_attrs.ouro` do personagem + PATCH |
| `loot_itens` (array) | Insere cada item pré-definido em `inventario` |

Persiste com `_cenarioSalvarObj`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `calcularDrops`, `gerarStatusItem`, `gerarNomeItem` | funções | `js/systems/catalog.js` |
| `sb` | função | `js/core/supabase.js` |
| `RPG_DATA` | global | `js/state.js` |
| `_cenarioSalvarObj` | função | mesmo arquivo |
| `mostrarToast` | função | `js/ui/modals.js` |

---

#### `cenarioObstaculoBloqueiaMovimento(mapId, colDest, rowDest)` — linha 812
Retorna `true` se há obstáculo com `tamanho` cobrindo a célula destino, ou porta fechada exatamente na célula. Ignora objetos já coletados/abertos.

**Dependências externas:** `_getMapaById`.

---

#### `abrirEditorCena()` — linha 882
Verifica mapa ativo, inicializa `CENA_ED` com o mapa atual (garantindo arrays `paredes`/`portas`/`objetos`), exibe `#modal-cena-overlay` e agenda renderização do canvas e lista de objetos.

**Dependências externas:** `MAPA_STATE`, `RPG_DATA.mapas`, `CENA_ED`, `cenaRenderizarCanvas`, `cenaRenderizarObjetos`, `_cenaBotoesAtualizar`, `mostrarToast`, `document.getElementById`.

---

#### `fecharEditorCena()` — linha 899
Oculta `#modal-cena-overlay`.

---

#### `cenaSetFerramenta(f)` — linha 903
Define `CENA_ED.ferramenta`, limpa `primeroPonto`, atualiza botões e exibe instrução textual para a ferramenta (`parede`, `porta`, `porta_trancada`, `chave`, `objeto`, `bau`, `remover`).

**Dependências externas:** `CENA_ED`, `_cenaBotoesAtualizar`, `document.getElementById`.

---

#### `_cenaBotoesAtualizar()` — linha 919
Remove `.ativo` de todos `.cena-tool-btn` e adiciona ao botão da ferramenta atual.

---

#### `cenaRenderizarCanvas()` — linha 928
Redimensiona o `<canvas id="cena-canvas">` para o tamanho da área, limpa e desenha: primeiro a imagem de fundo (`m.img_url`) se existir (com callback `onload`), depois chama `cenaGrade` e `cenaRenderizarSVG`.

**Dependências externas:** `CENA_ED`, `cenaGrade`, `cenaRenderizarSVG`, `document.getElementById`.

---

#### `cenaGrade(ctx, m, W, H)` — linha 950
Desenha o grid no `CanvasRenderingContext2D` com linhas `rgba(200,168,75,0.12)` a cada célula.

**Dependências externas:** *Nenhuma.*

---

#### `cenaRenderizarSVG()` — linha 961 *(parcial — continua além de 985)*
Limpa e re-renderiza paredes e objetos do cenário no `<svg id="cena-svg">` usando `_cenaSvgEl`. Paredes: `<line>` com hit area transparente para clique. Continuação além da linha 985.

> ⚠ Função não completamente lida. A próxima análise começa na linha 961.

---

### Monkey-patches adicionais (linhas 961–1460)

| Alvo | Linha | O que adiciona |
|------|-------|----------------|
| `paredePorRenderizar` (global override) | 1269 | Após renderizar paredes/portas, chama `_renderizarObjetosNoMapa(m)` |
| `usarPorta` (global override) | 1354 | Substitui a função original com versão que chama `charTemChave` em vez de `_charTemChave` e suporta `porta.trancada = false` ao desbloquear |
| `paredeBloqueiaMovimento` (global override) | 1376 | Estende o original: também bloqueia se houver objeto `'blocker'` na célula destino |
| `window.ctxGerarBotoes` (4ª camada) | 1388 | Adiciona botões para: coletar chave, abrir baú, quebrar obstáculo destrutível (`atacar_obstaculo`) e portas destrutíveis (`atacar_porta`) |
| `window.ctxExecutarAcao` (4ª camada) | 1447 | Intercepta `coletar_chave`, `abrir_bau`, `atacar_porta`, `atacar_obstaculo` |

### Funções definidas (linhas 961–1460)

#### `cenaRenderizarSVG()` — linha 961 *(completa)*
Limpa `<svg id="cena-svg">` e re-renderiza: paredes como `<line>` com hit area transparente (12px de espessura) para clique fácil; portas e objetos como círculo + emoji + label via `renderObj` helper interno (closure). Paredes/objetos recebem `click` que chama `cenaRemoverParede`/`cenaRemoverObj` quando a ferramenta é `'remover'`. Exibe ponto dourado no primeiro ponto de parede pendente.

**Dependências externas:** `CENA_ED`, `_cenaSvgEl`, `cenaRemoverParede`, `cenaRemoverObj`, `document.getElementById`.

---

#### `_cenaSvgEl(tag, attrs)` — linha 1038
Helper que cria um elemento SVG com `createElementNS` e aplica todos os atributos do objeto `attrs`.

**Dependências externas:** `document.createElementNS`.

---

#### IIFE `_cenaClickInit` — linha 1045
Registra listener `'click'` em `#cena-mapa-area` via `DOMContentLoaded`. Ignora cliques em elementos SVG clicáveis (circles/lines); os demais chamam `_cenaHandleClick`.

**Dependências externas:** `_cenaHandleClick`, `document.addEventListener`, `document.getElementById`.

---

#### `_cenaHandleClick(e)` — linha 1056
Dispatcher de clique no editor por ferramenta:
- `'parede'`: 2 cliques → armazena 1º ponto e cria segmento com segundo
- `'porta'`/`'porta_trancada'`: preenche campos e abre `#modal-cfg-porta`
- `'chave'`: preenche campos e abre `#modal-cfg-chave`
- `'objeto'`: cria blocker direto em `render_data.objetos`
- `'bau'`: preenche campos e abre `#modal-cfg-bau`

Todas as operações que adicionam elementos registram no `CENA_ED.undoStack`.

**Dependências externas:** `CENA_ED`, `_cenaCoordsFromEvent`, `cenaRenderizarSVG`, `cfgBauTab`, `cfgBauRenderLista`, `cfgBauRenderSelecionados`, `mostrarToast`, `document.getElementById`.

---

#### `_cenaCoordsFromEvent(e)` — linha 1111
Converte coordenadas de clique para célula `{col, row}` clampadas aos limites do mapa.

**Dependências externas:** `CENA_ED`, `document.getElementById`.

---

#### `cenaRemoverParede(id)` — linha 1124
Remove parede por ID do buffer `CENA_ED.mapa.render_data.paredes` e re-renderiza SVG.

#### `cenaRemoverObj(id, tipo)` — linha 1130
Remove porta (se `tipo === 'porta'`) ou objeto de `render_data.objetos`/`portas` e re-renderiza SVG.

---

#### `cfgPortaConfirmar()` — linha 1139
Lê nome, col/row e tipo do modal de porta, cria entrada em `render_data.portas[]` com `trancada` e `chave_palavra`, empurra no `undoStack` e fecha o modal.

**Dependências externas:** `CENA_ED`, `cenaRenderizarSVG`, `document.getElementById`.

---

#### `cfgChaveConfirmar()` — linha 1153
Lê nome, col/row e `chave_palavra` do modal de chave, cria objeto `{tipo:'chave'}` em `render_data.objetos[]`, empurra no `undoStack` e fecha.

**Dependências externas:** `CENA_ED`, `cenaRenderizarSVG`, `document.getElementById`.

---

#### `cfgBauTab(tab)` — linha 1166
Alterna entre as abas `'itens'` e `'loot'` no modal de configuração do baú.

**Dependências externas:** `document.getElementById`.

---

#### `cfgBauRenderLista()` — linha 1175
Renderiza lista de `INV.itemDefs` filtrada por busca em `#cfg-bau-busca` (máx 30 itens). Items selecionados em `CENA_ED.cfgBauItens` ficam destacados.

**Dependências externas:** `INV.itemDefs`, `CENA_ED`, `cfgBauToggleItem`, `document.getElementById`.

---

#### `cfgBauToggleItem(defId, nome, icone)` — linha 1191
Toggle de seleção de item para o baú: remove se já selecionado, adiciona `{defId, nome, icone, quantidade:1}` se não. Re-renderiza lista e selecionados.

---

#### `cfgBauRenderSelecionados()` — linha 1199
Renderiza os itens já selecionados para o baú com input de quantidade e botão de remoção.

**Dependências externas:** `CENA_ED`, `document.getElementById`.

---

#### `cfgBauConfirmar()` — linha 1212
Cria ou atualiza objeto baú em `render_data.objetos[]` com: nome, col/row, lista de itens (modo `'itens'`) ou loot aleatório com raridade e quantidade (modo `'loot'`). Fecha modal e re-renderiza SVG.

**Dependências externas:** `CENA_ED`, `cenaRenderizarSVG`, `document.getElementById`.

---

#### `cenaLimparTudo()` — linha 1234
Confirma com `confirm()` e limpa `paredes`, `portas` e `objetos` do mapa no editor.

---

#### `cenaSalvar()` — linha 1241 *(async)*
Persiste `CENA_ED.mapa.render_data` via `salvarRenderData`. Se o mapa está ativo: chama `mapaRenderTokens` para atualizar ao vivo.

**Dependências externas:** `CENA_ED`, `RPG_DATA.mapas`, `salvarRenderData`, `MAPA_STATE`, `mapaRenderTokens`, `mostrarToast`.

---

#### Listener Ctrl+Z — linha 1253
Registrado globalmente via `document.addEventListener('keydown')`. Ativo apenas quando `#modal-cena-overlay` está visível. Desfaz a última operação de `undoStack` (remove parede/porta/objeto pelo ID armazenado).

---

#### `_renderizarObjetosNoMapa(m)` — linha 1275
Renderiza objetos de cenário (chave, blocker, baú) como `<g>` SVG no `#mapa-dist-svg` do mapa ao vivo. Blocker não tem clique; chave e baú chamam `_objetoClicar`.

**Dependências externas:** `_objetoClicar`, `document.getElementById`.

---

#### `_objetoClicar(mapId, objId)` — linha 1312
Roteia clique em objeto durante sessão: chave → `_coletarChave`; baú → `_abrirBauModal`. Exige personagem selecionado.

**Dependências externas:** `_getMapaById`, `TOKEN_CTRL`, `RPG_DATA.linked`, `_coletarChave`, `_abrirBauModal`, `mostrarToast`.

---

#### `_coletarChave(mapId, keyId, charNome)` — linha 1326
Adiciona `{id, nome, chave_palavra}` a `char.custom_attrs.chaves[]`, remove chave do `render_data.objetos`, persiste e re-renderiza. Chama `_mesaRenderAcoes?.()` para atualizar botões contextuais.

**Dependências externas:** `_getMapaById`, `RPG_DATA.characters`, `RPG_DATA.mapas`, `RPG_DATA.rpgId`, `paredePorRenderizar`, `salvarRenderData`, `_mesaRenderAcoes`, `mostrarToast`.

---

#### `charTemChave(charNome, chave_palavra)` — linha 1348
Verifica se `char.custom_attrs.chaves` contém entrada com `chave_palavra` correspondente. **Nota:** existe também `_charTemChave` (linha 124) que usa `chaves_coletadas` — duas implementações ligeiramente diferentes do mesmo conceito.

**Dependências externas:** `RPG_DATA.characters`.

---

#### `_abrirBauModal(mapId, bauId, charNome)` — linha 1458 *(parcial — continua além de 1460)*
Localiza baú no `render_data.objetos` e prepara o modal de interação com o baú.

> ⚠ Função não completamente lida. A próxima análise começa na linha 1458.

---

### Variáveis/constantes definidas (linhas 1458–1957)

| Nome | Linha | Tipo | Descrição |
|------|-------|------|-----------|
| `CANVAS_CONTEXT` | 1868 | `let` string\|null | Contexto de uso do modal de cenário: `'canvas'` (editor canvas) / `'canvas_editing'` (edição) / `null` (mapa ao vivo) |

### Monkey-patches adicionais (linhas 1458–1957)

| Alvo | Linha | O que adiciona |
|------|-------|----------------|
| `window.cenarioAtivarPlacement` (override) | 1890 | Intercepta: se `CANVAS_CONTEXT === 'canvas'`, adiciona listener de clique no canvas do editor; se `'canvas_editing'`, atualiza objeto existente via `window._editandoObjeto`; caso contrário: delega ao original |

### Funções definidas (linhas 1458–1957)

#### `_abrirBauModal(mapId, bauId, charNome)` — linha 1458 *(completa)*
Preenche e exibe `#modal-abrir-bau` com: nome do baú, conteúdo (lista de itens, info de loot aleatório ou mensagem de já aberto) e botão de confirmação (oculto se já aberto).

**Dependências externas:** `_getMapaById`, `document.getElementById`.

---

#### `abrirBauConfirmar()` — linha 1481 *(async)*
Confirma a abertura do baú: marca `bau.aberto = true`, distribui itens via `adicionarItemInventario` para cada item em `bau.itens` ou gera loot aleatório (filtra `INV.itemDefs` por raridade mínima via `_rarPeso`). Persiste e re-renderiza.

**Dependências externas:** `MAPA_STATE`, `_getMapaById`, `RPG_DATA.characters`, `INV.itemDefs`, `adicionarItemInventario` (função externa), `_rarPeso`, `salvarRenderData`, `paredePorRenderizar`, `mostrarToast`, `document.getElementById`.

---

#### `_rarPeso(r)` — linha 1518
Função pura. Mapeia raridade para peso numérico: `comum→1`, `incomum→2`, `raro→3`, `épico→4`, `lendário→5`.

**Dependências externas:** *Nenhuma.*

---

#### `_abrirModalAtacarPorta(mapId, portaId, charNome)` — linha 1521
Cria e appenda `#modal-atacar-porta-temp` ao `document.body` com lista de habilidades com `formula_dano` do personagem (via `atkGetHabilidadesCampanha`). Cada botão chama `_aplicarDanoPorta`.

**Dependências externas:** `_getMapaById`, `RPG_DATA.characters`, `atkGetHabilidadesCampanha`, `mostrarToast`, `document.body`.

---

#### `_aplicarDanoPorta(mapId, portaId, charNome, habilidade)` — linha 1563 *(async)*
Calcula dano via `calcularDanoHabilidade`, aplica a `porta.hp_atual`. Se HP ≤ 0: marca `porta.aberta = true` e `porta.trancada = false`. Persiste, re-renderiza, remove modal temp e chama `_mesaRenderizarColunas?.()`.

**Dependências externas:** `_getMapaById`, `RPG_DATA`, `calcularDanoHabilidade`, `salvarRenderData`, `paredePorRenderizar`, `_mesaRenderizarColunas`, `mostrarToast`, `document.getElementById`.

---

#### `_abrirModalAtacarObstaculo(mapId, obstaculoId, charNome)` — linha 1599
Análogo a `_abrirModalAtacarPorta` mas para objetos com `tipo === 'obstaculo'` e `destrutivel === true`. Cria `#modal-atacar-obstaculo-temp`.

**Dependências externas:** `_getMapaById`, `RPG_DATA.characters`, `atkGetHabilidadesCampanha`, `mostrarToast`.

---

#### `_aplicarDanoObstaculo(mapId, obstaculoId, charNome, habilidade)` — linha 1641 *(async)*
Aplica dano ao obstáculo. Se HP ≤ 0: remove o obstáculo de `render_data.objetos` (splice). Persiste, re-renderiza, fecha modal temp.

**Dependências externas:** (mesmas de `_aplicarDanoPorta`).

---

#### `calcularDanoHabilidade(hab, char)` — linha 1678
Função pura (exceto por `Math.random`). Parseia `hab.formula_dano` como string de dado (regex `NdX`), modificador fixo (`+N`) e atributos D&D clássicos (`FOR/DES/CON/INT/SAB/CAR`) com modificador `floor((valor - 10) / 2)`. Retorna mínimo de 1.

**Dependências externas:** *Nenhuma (usa apenas `char.atributos`).*

---

#### `nmAtivarModoParede()` — linha 1743
Lê cor e largura de `#nm-parede-cor`/`#nm-parede-largura`, atualiza `WALLS_STATE.configAtual`, define `MAPA_STATE.toolMode = 'paredes'` e fecha o modal.

**Dependências externas:** `WALLS_STATE`, `MAPA_STATE`, `fecharModalNovoMapa`, `mostrarToast`, `document.getElementById`.

---

#### `nmAtivarModoPorta()` — linha 1752
Preenche `CENARIO_STATE.placement` com defaults de porta e define `MAPA_STATE.toolMode = 'cenario_placement'`. Fecha o modal.

**Dependências externas:** `CENARIO_STATE`, `MAPA_STATE`, `fecharModalNovoMapa`, `mostrarToast`.

---

#### `nmRenderParedesList()` — linha 1765
Renderiza a lista de paredes e portas do mapa atual em `#nm-paredes-lista` com botões de remover (`paredRemover`) e editar (`portaEditar`).

**Dependências externas:** `_getMapaById`, `MAPA_STATE`, `paredRemover`, `portaEditar`, `document.getElementById`.

---

#### `cenarioPortaPopularMapas()` — linha 1795
Popula o `<select id="cen-porta-mapa-destino">` com os mapas disponíveis em `RPG_DATA.mapas` (somente se ainda não populado).

**Dependências externas:** `RPG_DATA.mapas`, `document.getElementById`.

---

#### `trocarAbaCenario(aba)` — linha 1806
Troca aba ativa no modal de cenário: oculta todas `.cenario-tab`, exibe `#cenario-tab-{aba}`. Aplica cor temática por aba ao botão ativo (`porta`→roxo, `chave`→dourado, `bau`→verde, `obstaculo`→vermelho).

**Dependências externas:** `document.querySelectorAll`, `document.getElementById`.

---

#### `atualizarResumoObjetosCenario()` — linha 1835
Renderiza `#cenario-objetos-resumo` com a lista de objetos do mapa atual (ícone, nome, coordenadas). Exibe mensagem vazia se não há objetos.

**Dependências externas:** `MAPA_STATE`, `_getMapaById`, `document.getElementById`.

---

#### `abrirModalCenarioNoCanvas(tipo)` — linha 1870
Define `CANVAS_CONTEXT = 'canvas'`, abre `#modal-cenario-overlay` e chama `trocarAbaCenario` para o tipo solicitado.

**Dependências externas:** `trocarAbaCenario`, `document.getElementById`.

---

#### Override `window.cenarioAtivarPlacement` — linha 1890 *(parcial — continua além de 1957)*
Camada de integração entre o modal de cenário e o editor canvas (`nmCE`). Dois modos:
- `CANVAS_CONTEXT === 'canvas'`: registra listener `once` no `#nmce-canvas`; no clique chama `nmceCoords`, `_nmceSnapCelula`, `coletarDadosFormularioCenario` e `adicionarObjetoAoCanvas`
- `CANVAS_CONTEXT === 'canvas_editing'`: atualiza objeto em `window.nmCE.renderData.portas[index]` ou `objetos[index]`

> ⚠ Função não completamente lida. A próxima análise começa na linha 1890.

---

### Funções definidas (linhas 1890–2229)

#### Override `window.cenarioAtivarPlacement` — linha 1890 *(completa)*
Três modos de operação via `CANVAS_CONTEXT`:
- `'canvas'`: registra listener `once` em `#nmce-canvas`; no clique: obtém coords via `window.nmceCoords`/`window._nmceSnapCelula`, coleta dados do formulário via `coletarDadosFormularioCenario`, adiciona objeto via `adicionarObjetoAoCanvas`, limpa `CANVAS_CONTEXT`.
- `'canvas_editing'`: lê `window._editandoObjeto {tipo, index}`, atualiza campos do objeto correspondente em `window.nmCE.renderData.portas[index]` (porta) ou `objetos[index]` (chave/bau/obstaculo), re-renderiza via `window._nmceRenderWalls`/`window._nmceAtualizarLista`, restaura texto dos botões e exibe toast.
- `null` (padrão): delega ao `cenarioAtivarPlacement_original`.

**Dependências externas:** `CANVAS_CONTEXT`, `coletarDadosFormularioCenario`, `adicionarObjetoAoCanvas`, `window.nmCE`, `window.nmceCoords`, `window._nmceSnapCelula`, `window._nmceRenderWalls`, `window._nmceAtualizarLista`, `mostrarToast`, `document.getElementById`, `document.querySelector`.

---

#### `coletarDadosFormularioCenario(tipo)` — linha 2017
Lê todos os campos do formulário do modal de cenário para o tipo solicitado e retorna objeto `dados`:

| tipo | Campos coletados |
|------|-----------------|
| `'porta'` | nome, icone, cor, trancada, chave_palavra, transicao, destrutivel, hp_max/hp_atual, mapa_destino, destino_col/row |
| `'chave'` | nome, palavra, icone |
| `'bau'` | nome, trancado, chave_palavra, loot_tipo + campos específicos (ouro/item_id+qtd/tier) |
| `'obstaculo'` | nome, icone, tamanho, destrutivel, hp_max/hp_atual |

**Dependências externas:** `document.getElementById`.

---

#### `adicionarObjetoAoCanvas(tipo, col, row, dados)` — linha 2070
Adiciona o objeto ao `window.nmCE.renderData` (destino `portas[]` para porta, `objetos[]` para demais). Cria estrutura com ID único (`Date.now()`), campos extraídos de `dados` e `aberto:false`. Re-renderiza via `window._nmceRenderWalls` e `window._nmceAtualizarLista`.

**Dependências externas:** `window.nmCE`, `window._nmceRenderWalls`, `window._nmceAtualizarLista`, `mostrarToast`, `document.getElementById`.

---

#### `editarObjetoCanvas(tipo, index)` — linha 2155
Abre o modal de cenário em modo edição (`CANVAS_CONTEXT = 'canvas_editing'`). Armazena `{tipo, index}` em `window._editandoObjeto`. Chama `trocarAbaCenario(tipoModal)` e preenche todos os campos do formulário com os valores do objeto existente. Altera texto dos botões para `'✓ Atualizar ...'`.

**Dependências externas:** `window.nmCE`, `CANVAS_CONTEXT`, `trocarAbaCenario`, `cenarioBauLootChange`, `mostrarToast`, `document.getElementById`, `document.querySelector`.

---

### Sumário de dependências externas não resolvidas — `js/ui/tabs.js`

| Dependência | Tipo | Módulo provável |
|-------------|------|-----------------|
| `_getMapaById` | função | `js/maps/maps.js` |
| `mapaRenderTokens` | função | `js/maps/maps.js` |
| `MAPA_STATE` | global | `js/maps/maps.js` |
| `TOKEN_CTRL` | global | `js/maps/maps.js` |
| `getPosicaoNoMapa` | função | `js/maps/maps.js` |
| `_mesaRenderAcoes` | função | `js/hub/hub.js` |
| `_mesaRenderizarColunas` | função | `js/hub/hub.js` |
| `fecharModalNovoMapa` | função | `js/maps/maps.js` |
| `superficieVerificarEntrada` | função | `js/maps/maps.js` (opcional) |
| `realtimeBroadcast` | função | `js/core/realtime.js` |
| `mostrarToast` | função | `js/ui/modals.js` |
| `atkGetHabilidadesCampanha` | função | `js/combat/combat.js` |
| `adicionarItemInventario` | função | `js/systems/inventory.js` |
| `calcularDrops`, `gerarStatusItem`, `gerarNomeItem` | funções | `js/systems/catalog.js` |
| `window.nmCE`, `window.nmceCoords`, `window._nmceSnapCelula`, `window._nmceRenderWalls`, `window._nmceAtualizarLista` | globais | `js/systems/catalog.js` |

---

---

## 21. `js/systems/creative.js` *(✅ Mapeado — 2456 linhas, 6 batches)*

**Linhas totais:** 2456  
**Descrição geral (parcial):** Apesar do nome, este arquivo contém 3 sistemas distintos: (1) **Tutorial de navegação** — guia por abas com estado persistido em localStorage; (2) **Fluxo de ataque da Arena** — aprovação pelo mestre, rolagem de efetividade, definição de dano; (3) **CRUD de cenário da Arena** (parcialmente lido).

### Variáveis/constantes definidas (linhas 1–500)

| Nome | Linha | Tipo | Descrição |
|------|-------|------|-----------|
| `TUTORIAL_STEPS` | 9 | `var` objeto | Conteúdo do tutorial por aba: `lore`, `personagem`, `atributos`, `dados`, `mapas`, `tabelas`, `config`. Cada entrada tem `titulo` e `passos: [{t, txt}]` |
| `_TUTORIAL_ABA` | 75 | `var` string\|null | Aba atual do tutorial |
| `_TUTORIAL_PASSO` | 76 | `var` number | Índice do passo atual |
| `_TUTORIAL_PASSOS` | 77 | `var` array | Array de passos da aba atual |

### Monkey-patches registrados na carga (linhas 1–500)

| Alvo | Linha | O que adiciona |
|------|-------|----------------|
| `window.renderConfig` | 214 | Após renderizar configs: sincroniza `#cfg-tutorial-toggle` com `tutorialIsAtivo()` |
| `window.abrirAba` | 228 | Após abrir aba: dispara `tutorialMostrar(chave)` com delay de 300ms |
| `window.arCarregarTudo` | 291 | Após carregar tudo: garante `AR.estado.ataques_arena = []` e chama `arRenderAtaquesArenaMestre()` |

### Funções definidas (linhas 1–500)

#### `tutorialGetState(rpgId)` — linha 79
Lê `localStorage['rpghub_tutorial_{rpgId}']` e retorna objeto `{ ativo, passos_vistos }`. Default: `{ ativo: true, passos_vistos: {} }`.

**Dependências externas:** `localStorage`.

---

#### `tutorialSetState(rpgId, state)` — linha 87
Serializa e salva o estado do tutorial em `localStorage`.

**Dependências externas:** `localStorage`.

---

#### `tutorialIsAtivo()` — linha 91
Retorna `true` se `RPG_DATA.rpgId` existe e `tutorialGetState().ativo !== false`.

**Dependências externas:** `RPG_DATA.rpgId`, `tutorialGetState`.

---

#### `tutorialMostrar(aba)` — linha 97
Verifica se tutorial está ativo e se a aba ainda não foi visitada nesta sessão. Se passar: inicializa `_TUTORIAL_ABA`/`_TUTORIAL_PASSO`/`_TUTORIAL_PASSOS`, chama `_tutorialAtualizarUI`, exibe `#tutorial-overlay` e `#tutorial-backdrop`.

**Dependências externas:** `tutorialIsAtivo`, `TUTORIAL_STEPS`, `tutorialGetState`, `RPG_DATA.rpgId`, `_tutorialAtualizarUI`, `document.getElementById`.

---

#### `_tutorialAtualizarUI()` — linha 115
Atualiza o conteúdo do modal de tutorial: título da aba, contador `X / total`, título e texto do passo, dots de progresso. No último passo, o botão muda para `'Entendido ✓'`.

**Dependências externas:** `TUTORIAL_STEPS`, `_TUTORIAL_ABA`, `_TUTORIAL_PASSO`, `_TUTORIAL_PASSOS`, `document.getElementById`.

---

#### `tutorialAvancar()` — linha 136
Avança para o próximo passo ou chama `tutorialFecharAba` no último.

#### `tutorialProximo()` — linha 145
Alias de `tutorialAvancar` (pular passo).

---

#### `tutorialFecharAba()` — linha 150
Marca a aba como visitada em `passos_vistos`, fecha o dialog. Após a primeira aba completa: exibe toast sugerindo desativar nas ⚙ Configurações.

**Dependências externas:** `tutorialGetState`, `tutorialSetState`, `RPG_DATA.rpgId`, `_fecharDialogTutorial`, `mostrarToast`.

---

#### `tutorialPularTudo()` — linha 170
Fecha o dialog sem marcar como visitado.

---

#### `tutorialDesativarPermanente(checked)` — linha 174
Se `checked`: chama `tutorialToggle(false)` e fecha. Exibe toast de confirmação.

**Dependências externas:** `tutorialToggle`, `_fecharDialogTutorial`, `RPG_DATA.rpgId`, `mostrarToast`.

---

#### `_fecharDialogTutorial()` — linha 184
Remove classes `.ativo`/`.visivel` de `#tutorial-overlay`/`#tutorial-dialog` e oculta `#tutorial-backdrop`.

---

#### `tutorialToggle(ativo)` — linha 191
Atualiza `state.ativo` em localStorage e exibe toast.

**Dependências externas:** `tutorialGetState`, `tutorialSetState`, `RPG_DATA.rpgId`, `mostrarToast`.

---

#### `tutorialReiniciar()` — linha 200
Limpa `passos_vistos`, redefine `ativo = true`, atualiza `#cfg-tutorial-toggle` e exibe toast.

**Dependências externas:** `tutorialGetState`, `tutorialSetState`, `RPG_DATA.rpgId`, `mostrarToast`, `document.getElementById`.

---

#### `arGetTheme()` — linha 253
Parseia `AR.session.theme_json` (objeto ou string JSON). Retorna `{}` em caso de erro.

**Dependências externas:** `AR.session`.

---

#### `arGetDadoEfetividade()` — linha 261
Retorna o número de faces do dado de efetividade do tema da arena (default 20).

#### `arGetPenalidades()` — linha 265
Retorna o array `penalidades_hp` do tema da arena.

---

#### `arCalcularPenalidadeHP(nomePersonagem)` — linha 270
Calcula a penalidade acumulada de HP para o personagem: usa `hp_max`/`hp_atual` para calcular `hpPct` e soma todas as penalidades cujo `hp` seja maior que `hpPct`. Penalidades são cumulativas (não exclusivas).

**Dependências externas:** `AR.chars`, `arGetPenalidades`.

---

#### `abrirModalSolicitarAtaque()` — linha 300
Verifica se o jogador tem personagem na arena e se está vivo. Preenche lista de alvos (excluindo o próprio) com indicador `[INCAP]` para HP ≤ 0. Abre `#ar-modal-atk-solicitar`.

**Dependências externas:** `arMeuChar`, `AR.chars`, `abrirModal`, `arToast`, `document.getElementById`.

---

#### `arEnviarSolicitacaoAtaque()` — linha 315 *(async)*
Cria objeto de ataque `{ id, atacante, alvo, descricao, status:'aguardando_mestre', ts }`, empurra em `AR.estado.ataques_arena`, persiste via `arSalvarEstado`, fecha modal, re-renderiza painel mestre e chama `mostrarAtaqueAguardando`.

**Dependências externas:** `arMeuChar`, `AR.estado`, `arSalvarEstado`, `fecharModal`, `arRenderAtaquesArenaMestre`, `mostrarAtaqueAguardando`, `arToast`, `document.getElementById`.

---

#### `mostrarAtaqueAguardando(id)` — linha 333
Polling a cada 2,5s (timeout 2min) em `rpg_registry` para verificar mudança de status do ataque. Se `'aprovado_dc'`: chama `abrirModalRolarEfetividade`; se `'rejeitado'`: exibe toast de negação.

**Dependências externas:** `AR.session`, `arSb`, `abrirModalRolarEfetividade`, `arToast`.

---

#### `arRenderAtaquesArenaMestre()` — linha 357
Renderiza o painel `#ar-ataques-pendentes` para o mestre: lista de solicitações `'aguardando_mestre'` (com botões Avaliar/Rejeitar) e rolagens `'rolagem_enviada'` (mostrando resultado vs DC com cor sucesso/falha e botões Definir Dano/Ignorar).

**Dependências externas:** `AR.myRole`, `AR.estado.ataques_arena`, `arGetDadoEfetividade`, `abrirModalAvaliarAtaque`, `arMestreRejeitarAtaqueId`, `abrirModalDefinirDano`, `document.getElementById`.

---

#### `abrirModalAvaliarAtaque(id)` — linha 417
Preenche `#ar-modal-atk-mestre-avaliar` com dados do ataque (atacante, alvo, descrição) e abre o modal.

**Dependências externas:** `AR.estado.ataques_arena`, `abrirModal`, `document.getElementById`.

---

#### `arMestreAprovarAtaque()` — linha 428 *(async)*
Lê DC do modal, valida, define `atk.status = 'aprovado_dc'` e `atk.dc`, persiste, fecha modal, re-renderiza.

**Dependências externas:** `AR.estado`, `arSalvarEstado`, `fecharModal`, `arRenderAtaquesArenaMestre`, `arToast`, `document.getElementById`.

---

#### `arMestreRejeitarAtaque()` — linha 442 *(async)*
Lê ID do modal e delega para `arMestreRejeitarAtaqueId`.

---

#### `arMestreRejeitarAtaqueId(id)` — linha 448 *(async)*
Define `atk.status = 'rejeitado'`, adiciona entrada de log via `arAddLog`, persiste, re-renderiza. Se combate por iniciativa ativo: avança o turno.

**Dependências externas:** `AR.estado`, `arAddLog`, `arSalvarEstado`, `arRenderAtaquesArenaMestre`, `arToast`, `AR.iniciativa`, `arProximoTurnoIniciativa`.

---

#### `arMestreSemDanoFechar()` — linha 463 *(async)*
Fecha o modal de dano sem aplicar dano (status `'concluido'`, `dano_aplicado: 0`). Persiste e avança turno se em combate.

**Dependências externas:** `AR.estado`, `arAddLog`, `arSalvarEstado`, `arRenderAtaquesArenaMestre`, `fecharModal`, `AR.iniciativa`, `arProximoTurnoIniciativa`, `document.getElementById`.

---

#### `abrirModalRolarEfetividade(id)` — linha 479
Preenche `#ar-modal-atk-rolar` com: descrição do ataque, label do dado (`d{N}`), DC, aviso de penalidade por HP (se aplicável). Oculta botão confirmar e exibe botão rolar.

**Dependências externas:** `AR.estado.ataques_arena`, `arGetDadoEfetividade`, `arCalcularPenalidadeHP`, `abrirModal`, `document.getElementById`.

---

#### `arRolarEfetividade()` — linha 499 *(parcial — continua além de 500)*
Processa a rolagem de efetividade do jogador.

> ⚠ Função não completamente lida. A próxima análise começa na linha 499.

---

---

### Batch 2 — linhas 499–998

#### `arRolarEfetividade()` — linha 499 *(continuação)*
Rola o dado de efetividade (`arGetDadoEfetividade()`), aplica penalidade de HP (`arCalcularPenalidadeHP`), compara com DC. Exibe resultado animado no elemento `#ar-atk-rl-resultado` (verde = sucesso, vermelho = falha). Oculta botão rolar e exibe botão confirmar com o valor final em `dataset.rolagem`.

**Dependências externas:** `AR.estado.ataques_arena`, `arGetDadoEfetividade`, `arCalcularPenalidadeHP`, `document.getElementById`.

---

#### `arConfirmarRolagemEfetividade()` — linha 523 *(async)*
Lê rolagem do `dataset.rolagem` do botão confirmar, define `atk.rolagem` e `atk.status = 'rolagem_enviada'`, persiste, fecha modal e inicia polling (2.5s) em `rpg_registry` aguardando `status === 'concluido'`. Timeout de 120s para o polling.

**Dependências externas:** `AR.estado`, `arSb`, `arSalvarEstado`, `fecharModal`, `arToast`, `renderArenaPersonagens`, `renderArenaEntidades`, `document.getElementById`.

---

#### `abrirModalDefinirDano(id)` — linha 551
Preenche `#ar-modal-atk-mestre-dano` com dados do ataque (atacante, alvo, descrição, DC, resultado da rolagem com cor sucesso/falha). Lista todos os personagens como checkboxes de alvo (alvo principal pré-marcado). Reseta modo dano para `'dado'`, reseta campos de animação.

**Dependências externas:** `AR.estado.ataques_arena`, `AR.chars`, `arAtkDnModo`, `arAnimDnTipoChange`, `abrirModal`, `document.getElementById/querySelector`.

---

#### `arAtkDnModo(modo)` — linha 594
Alterna visualmente entre modo `'dado'` (rolar dados) e modo `'fixo'` (valor fixo). Controla `display` dos painéis e estilo dos botões de seleção.

**Dependências externas:** `document.getElementById`.

---

#### `arAtkDnRolarDado()` — linha 610
Rola `qtd` dados de `faces` faces, exibe total e resultado individual no elemento `#ar-atk-dn-resultado-dado`.

**Dependências externas:** `document.getElementById`.

---

#### `arMestreAplicarDano()` — linha 620 *(async)*
Calcula dano (modo dado via `dataset.total` ou modo fixo via input). Lê alvos dos checkboxes marcados. Se animação configurada (`arAnimTipo !== 'nenhuma'`): faz broadcast com `animBroadcast` e renderiza animação local com `animarAtaque` para cada alvo. Aplica dano via `atkAplicarDano` para cada alvo. Define `atk.status = 'concluido'`, salva log via `arAddLog`, persiste, fecha modal, re-renderiza tudo. Avança turno de iniciativa se combate ativo.

**Dependências externas:** `AR.estado`, `AR.chars`, `atkAplicarDano`, `arAddLog`, `arSalvarEstado`, `fecharModal`, `renderArenaPersonagens`, `renderArenaEntidades`, `renderMesa`, `arRenderAtaquesArenaMestre`, `arToast`, `animBroadcast`, `animarAtaque`, `resolverTokenEl`, `AR.iniciativa`, `arProximoTurnoIniciativa`, `document.getElementById/querySelector`.

---

#### Monkey-patch `window.arAcaoAtacar` — linha 700
Sobrescreve `arAcaoAtacar`: se mestre, chama a versão original; se jogador, abre `abrirModalSolicitarAtaque()`.

---

#### `arPreviewCenarioListaImg(url)` — linha 709
Exibe ou oculta preview de imagem do cenário no modal de criação.

**Dependências externas:** `document.getElementById`.

---

#### `abrirModalCriarCenarioLista(idEditar?)` — linha 717
Abre modal de criação/edição de cenário. Se editando: pré-preenche campos (nome, desc, img, grid, escala). Se criando: limpa todos os campos. Reseta abas de background para `'url'` e limpa uploads pendentes.

**Dependências externas:** `arCenBgTab`, `arCenBgClearUpload`, `AR.estado.cenarios_lista`, `arCenBgUrlPreview`, `abrirModal`, `document.getElementById`.

---

#### `salvarCenarioLista()` — linha 757 *(async)*
Lê campos do modal (nome, desc, img via `arCenBgGetFinal`, grid, escala). Valida nome. Se mestre: salva ou atualiza diretamente em `AR.estado.cenarios_lista`. Se jogador: submete como `propostas_cenario` (tipo `'edicao'` ou `'criacao'`) aguardando aprovação do mestre. Persiste, fecha modal, re-renderiza.

**Dependências externas:** `arCenBgGetFinal`, `AR.estado`, `AR.myRole`, `AR.myNickname`, `arSalvarEstado`, `fecharModal`, `renderCenariosLista`, `renderArenaCenario`, `renderMesa`, `renderPropostasCenario`, `arToast`, `document.getElementById`.

---

#### `arAtivarCenarioLista(id)` — linha 821 *(async)*
Somente mestre. Ativa um cenário: define `AR.estado.cenario_ativo_id`, copia dados para `AR.estado.cenario` e `cenario_img`, aplica escala de grade em `MESA.escala`, força visão isométrica. Salva log, persiste, re-renderiza.

**Dependências externas:** `AR.myRole`, `AR.estado`, `MESA.escala`, `arAddLog`, `arSalvarEstado`, `renderArenaCenario`, `renderCenariosLista`, `renderMesa`, `arToast`.

---

#### `renderCenariosLista()` — linha 841
Renderiza lista de cenários no elemento `#ar-cenarios-lista`. Para cada cenário: exibe nome, autor, badge "ATIVO", descrição truncada, indicador de imagem/grade. Botões condicionais: Ativar (mestre, cenário não-ativo), Editar (mestre ou autor em cenário não-ativo), Deletar (mestre, cenário não-ativo).

**Dependências externas:** `AR.myRole`, `AR.estado.cenarios_lista`, `AR.estado.cenario_ativo_id`, `AR.myNickname`, `document.getElementById`.

---

#### `arDeletarCenario(id)` — linha 872 *(async)*
Somente mestre. Confirma e remove cenário de `AR.estado.cenarios_lista`, persiste, re-renderiza.

**Dependências externas:** `AR.myRole`, `AR.estado`, `arSalvarEstado`, `renderCenariosLista`, `arToast`.

---

#### Estado interno — linha 885
```js
var _arCenBgTab       = 'url';       // aba ativa no modal de cenário
var _arCenUploadDataUrl = null;      // data URL do upload de imagem
var _arCenSvgDataUrl    = null;      // data URL gerado do SVG colado
var _arCenCanvasDataUrl = null;      // data URL do canvas desenhado
```

---

#### `arCenBgTab(tab)` — linha 890
Ativa aba de background (`url`/`upload`/`svg`/`canvas`) no modal de cenário. Controla `display` dos painéis e estilo dos botões de aba.

**Dependências externas:** `document.getElementById`.

---

#### `arCenBgGetFinal()` — linha 904
Retorna a URL/data-URL final de acordo com a aba ativa (`_arCenBgTab`).

---

#### `arCenBgUrlPreview(url)` — linha 912
Exibe preview de imagem via URL no campo `#ar-cen-img-preview`.

**Dependências externas:** `document.getElementById`.

---

#### `arCenBgUpload(input)` — linha 919 *(async)*
Recebe arquivo de imagem, envia via `uploadToStorage(file, 'arena')`, armazena URL em `_arCenUploadDataUrl`, exibe preview.

**Dependências externas:** `uploadToStorage`, `mostrarToast`, `document.getElementById`.

---

#### `arCenBgClearUpload()` — linha 934
Limpa upload: reset de `_arCenUploadDataUrl`, input, preview.

**Dependências externas:** `document.getElementById`.

---

#### `arCenBgSvgPreview(svgText)` — linha 944
Valida e pré-visualiza SVG colado: verifica se começa com `<svg` ou `<?xml`, converte para `data:image/svg+xml;base64`, exibe em `#ar-cen-svg-preview`. Exibe aviso se inválido.

**Dependências externas:** `document.getElementById`.

---

#### `arCenCopiarPromptSVG()` — linha 968 *(parcial — continua além de 998)*
Gera prompt detalhado para IA criar mapa SVG isométrico (perspectiva dimétrica estilo Diablo 3) com base no nome/descrição do cenário. Copia para clipboard.

> ⚠ Função não completamente lida. A próxima análise começa na linha 968.

---

---

### Batch 3 — linhas 968–1467

#### `arCenCopiarPromptSVG()` — linha 968 *(continuação)*
Gera prompt de IA para mapa SVG isométrico (perspectiva dimétrica estilo Diablo 3, viewBox 800×500, sem scripts externos). Incorpora nome/descrição do cenário se preenchidos. Copia para clipboard via `navigator.clipboard.writeText`. Feedback visual no botão por 2s.

**Dependências externas:** `document.getElementById`, `navigator.clipboard`.

---

#### Estado — linha 1006
```js
var _nmceContext = 'nm'; // 'nm' = modal mapa campanha | 'ar-cen' = cenário arena
```
Controla qual contexto está usando o canvas editor compartilhado (`nmCE`).

---

#### `arCenAbrirCanvas()` — linha 1008
Configura o canvas editor para contexto `'ar-cen'`, pré-carrega imagem anterior se existir, chama `nmceInit()` e `nmceFullscreenAbrir()`. Restaura histórico de undo.

**Dependências externas:** `nmCE`, `nmceInit`, `nmceFullscreenAbrir`, `document.getElementById`.

---

#### Monkey-patch `window.renderPropostasCenario` — linha 1025
Sobrescreve a função original. Somente mestre. Renderiza lista de propostas de cenário pendentes em `#ar-cenario-propostas-list` (criação e edição de cenário por jogadores). Botões "Aprovar" → `arAprovarPropostaCenarioLista` e "Rejeitar" → `arRejeitarPropostaCenario`.

**Dependências externas:** `AR.myRole`, `AR.estado.propostas_cenario`, `document.getElementById`.

---

#### `arAprovarPropostaCenarioLista(id)` — linha 1051 *(async)*
Mestre aprova proposta de cenário: se tipo `'criacao'`, adiciona à `cenarios_lista`; se tipo `'edicao'`, atualiza o cenário existente pelo `cenario_id`. Remove proposta da lista, persiste, re-renderiza.

**Dependências externas:** `AR.estado`, `arSalvarEstado`, `renderCenariosLista`, `renderPropostasCenario`, `arToast`.

---

#### Monkey-patch `window.renderArenaCenario` — linha 1069
Após chamar a versão original: chama `renderCenariosLista()`, `renderPropostasCenario()` e `arRenderAtaquesArenaMestre()`.

---

#### Monkey-patch `window.arAtualizarUIpeloPapel` — linha 1081
Após chamar a versão original: chama `renderCenariosLista()` e `renderPropostasCenario()`.

---

#### Monkey-patch `window.arTab` — linha 1089
Após chamar a versão original: se aba `'cenario'`, renderiza listas e propostas + ataques de mestre; se aba `'mesa'`, renderiza ataques de mestre.

---

#### Monkey-patch `window.renderMesa` — linha 1101
Após chamar versão original: chama `arRenderAtaquesArenaMestre()`.

---

#### `window.scrollToPendingApprovals` — linha 1114
Localiza o painel `#criativos-mestre-wrap` (tentando DOM direto, `mesa-acao-painel`, ou `querySelector`). Força visibilidade com `display:block`, `zIndex:9999`, aplica cor vermelha temporária de debug, executa `scrollIntoView`. Remove estilo de debug após 3s. Emite toast se não encontrar o elemento.

**Dependências externas:** `criativoRenderMestre`, `mostrarToast`, `document.getElementById`.

**Nota:** Contém logs de debug extensivos e fundo vermelho de teste — aparentemente código de diagnóstico não removido.

---

#### `window.criativoRenderMestre()` — linha 1179
Renderiza o painel de aprovações de campanha para o mestre. Lógica:
1. Se modo arena (`AR.session` definido): retorna `null`
2. Localiza `#criativos-mestre-wrap` no DOM — tenta `getElementById`, `querySelector` em `mesa-acao-painel`, e cria dinamicamente inserindo em `mesa-acao-painel` ou `tab-mapas`
3. Se não é mestre (`RPG_DATA.myRole !== 'mestre'`): oculta painel e retorna
4. Filtra `CRIATIVOS_CAMP` por status `'pendente'`, `'dc_rolado_sucesso'`, `'aprovado_dc'`, `'aprovado_aguardando_rolagem'`
5. Se sem pendentes: oculta painel, chama `_limparNotifCreativo()`, retorna
6. Se com pendentes: renderiza cards com cor por tipo (`ataque`=vermelho, `suporte`=verde, `narrativo`=amarelo, `utilidade`=azul), botões "Aprovar" → `abrirModalAprovacaoCompleta` e "Rejeitar" → `rejeitarCriativo`
7. Retorna o elemento wrap

**Dependências externas:** `AR.session`, `RPG_DATA.myRole`, `CRIATIVOS_CAMP`, `_limparNotifCreativo`, `abrirModalAprovacaoCompleta`, `rejeitarCriativo`, `document.getElementById`.

**Nota:** Contém logs de debug extensivos (console.log).

---

#### `window.aprovarCriativo(criativoId)` — linha 1408 *(async, parcial — continua além de 1467)*
Localiza criativo em `CRIATIVOS_CAMP`, define `status = 'aprovado'`, persiste via PATCH em `criativos`. Re-renderiza painel. Se tipo `'ataque'`: abre `abrirModalDanoCriativo`; senão: chama `executarEfeitoCriativo`.

> ⚠ Função não completamente lida. A próxima análise começa na linha 1408.

---

---

### Batch 4 — linhas 1408–1907

#### `window.aprovarCriativo(criativoId)` — linha 1408 *(continuação/completa)*
Em caso de erro: reverte `status` para `'pendente'`. Implementação completa conforme descrito no batch 3.

**Dependências externas:** `CRIATIVOS_CAMP`, `RPG_DATA.rpgId`, `sb`, `mostrarToast`, `criativoRenderMestre`, `feedAdicionarEntrada`, `abrirModalDanoCriativo`, `executarEfeitoCriativo`.

---

#### `window.rejeitarCriativo(criativoId)` — linha 1480 *(async)*
Localiza criativo em `CRIATIVOS_CAMP`, define `status = 'rejeitado'`, persiste via PATCH em `criativos`. Após 1.5s: remove da array `CRIATIVOS_CAMP` e re-renderiza painel. Atualiza feed se disponível. Em erro: reverte para `'pendente'`.

**Dependências externas:** `CRIATIVOS_CAMP`, `RPG_DATA.rpgId`, `sb`, `mostrarToast`, `criativoRenderMestre`, `feedAdicionarEntrada`.

---

#### `window.inicializarSistemaAprovacoes()` — linha 1545
Chama `criativoRenderMestre()` inicialmente. Registra listeners em `HUB_EVENTS` para eventos `'criativo_adicionado'` e `'criativo_atualizado'`, re-renderizando o painel.

**Dependências externas:** `criativoRenderMestre`, `HUB_EVENTS`.

---

#### `window.abrirModalDanoCriativo(criativoId)` — linha 1576
Localiza criativo em `CRIATIVOS_CAMP`. Se `#modal-dano-criativo` não existe no DOM, cria dinamicamente com campos (atacante, alvo, descrição, input de dano) e botões Cancelar/Aplicar. Preenche dados do criativo, armazena ID no `modal.dataset.criativoId`, exibe o modal.

**Dependências externas:** `CRIATIVOS_CAMP`, `document.getElementById`, `document.createElement`, `document.body.appendChild`.

---

#### `window.fecharModalDanoCriativo()` — linha 1656
Oculta `#modal-dano-criativo`.

**Dependências externas:** `document.getElementById`.

---

#### `window.aplicarDanoCriativo()` — linha 1663 *(async)*
Lê `criativoId` do `modal.dataset`, lê dano do input `#dano-criativo-valor`. Localiza personagem alvo em `RPG_DATA.characters`. Calcula novo HP (`max(0, hp_atual - dano)`), persiste via PATCH em `characters`. Marca criativo como `'concluido'` e persiste em `criativos`. Atualiza `mapaRenderStatus` e `renderCharView` se disponíveis. Re-renderiza painel e fecha modal.

**Dependências externas:** `CRIATIVOS_CAMP`, `RPG_DATA`, `sb`, `mostrarToast`, `mapaRenderStatus`, `renderCharView`, `CHAR_VIEW`, `criativoRenderMestre`, `fecharModalDanoCriativo`, `document.getElementById`.

---

#### `window.executarEfeitoCriativo(criativo)` — linha 1749 *(async)*
Executa efeito por tipo: `'suporte'` → toast de suporte; `'utilidade'` → toast de utilidade; `'narrativo'` → toast narrativo. Marca criativo como `'concluido'` e persiste via PATCH em `criativos`. Re-renderiza painel.

**Nota:** Lógica de suporte/utilidade é apenas stub — `console.log` com "implementar lógica".

**Dependências externas:** `sb`, `mostrarToast`, `criativoRenderMestre`.

---

#### `abrirModalAprovacaoCompleta(criativoId)` — linha 1805
Preenche `#modal-aprovacao-completa` com dados do criativo. Lógica por tipo:
- `'ataque'`/`'area'`: mostra seção de dano, efeitos de ataque (debuff/DOT/imob/stun)
- `'suporte'`: oculta seção de dano, mostra efeitos de suporte (cura/HOT/boost/def/hptemp/removedebuff)
- `'narrativo'`: botão confirmar muda para "Confirmar Narrativo"
- `'area'`: mostra seção de alvos de área

Reseta: dado d20 selecionado por padrão, builder de dano, todos checkboxes de efeitos, efeito crítico. Exibe seção de cadastro de skill somente para mestre. Abre modal via `display='flex'`.

**Dependências externas:** `CRIATIVOS_CAMP`, `RPG_DATA.myRole`, `window._aprBuilder`, `aprBuilderAtualizar`, `aprEfeitoCriticoChange`, `document.getElementById/querySelectorAll`.

---

#### `aprSkillToggle()` — linha 1904 *(parcial — continua além de 1907)*
Alterna visibilidade dos campos de cadastro de skill com base no checkbox `#apr-cadastrar-skill`.

> ⚠ Função não completamente lida. A próxima análise começa na linha 1904.

---

---

### Batch 5 — linhas 1904–2403

#### `aprSkillToggle()` — linha 1904 *(continuação/completa)*
Alterna `display` de `#apr-skill-campos` com base no estado do checkbox `#apr-cadastrar-skill`.

---

#### `atualizarFormulaPreview()` — linha 1910
Alias de `aprBuilderAtualizar()`. Exposto para chamadas inline no HTML.

---

#### `aprSelecionarDado(btn, faces)` — linha 1912
Seleciona visualmente um botão de dado (`apr-dado-btn`), atualiza estilos de todos os botões e chama `aprDCPreview()`.

---

#### `aprDCPreview()` — linha 1924
Calcula e exibe preview de DC. Mostra limiar de crítico menor: `limiar = round((faces - dc) / 2 + dc)`. Exibe "Crítico se tirar > {limiar} · Natural {faces} = Crítico automático".

**Dependências externas:** `document.getElementById/querySelector`.

---

#### `aprBuilderAdd(faces)` — linha 1935
Incrementa quantidade do grupo `faces` em `window._aprBuilder` (criando novo grupo se necessário). Chama `aprBuilderAtualizar()`.

---

#### `aprBuilderRemove(faces)` — linha 1942
Decrementa quantidade do grupo `faces` em `window._aprBuilder`, removendo o grupo se `qtd <= 0`. Chama `aprBuilderAtualizar()`.

---

#### `aprBuilderAtualizar()` — linha 1951
Renderiza chips dos grupos de dados em `#apr-builder-chips` (com botão "−" por chip) e atualiza preview da fórmula em `#apr-formula-preview` (ex: `2d6+1d8+3`).

**Estado:** `window._aprBuilder` (array `[{faces, qtd}]`).

---

#### `aprEfeitoCriticoChange()` — linha 1967
Alterna visibilidade dos campos DOT/HOT do efeito crítico com base no `select #apr-efeito-critico`.

---

#### `_lerEfeitosModal()` — linha 1976
Lê todos os checkboxes de efeitos base e o efeito crítico do modal de aprovação. Retorna `{ efeitosBase: [...], efeitoCritico: {...}|null }`.

- **Suporte:** cura_imediata, HOT, boost_dano, boost_defesa, hp_temp, remover_debuff
- **Ataque:** DOT, debuff (mod_dano), imobilização, stun (sem_ataque)
- **Efeito crítico:** dot/hot (com fórmula + turnos), outros tipos

---

#### `aprovarCriativoCompleto()` — linha 2049 *(async)*
Fluxo completo de aprovação de ação criativa:
1. Lê tipo, alvo, dado de verificação, DC, builder de dano e efeitos do modal
2. Valida DC e presença de dados de dano (exceto suporte/narrativo)
3. Constrói objeto `prontoData` com todos os parâmetros e serializa como `'__PRONTO__' + JSON.stringify(prontoData)`
4. Persiste em `criativos` com `status: 'aprovado_pronto'`
5. Se mestre marcou "cadastrar skill": cria entrada na tabela `skills` via POST
6. Determina quem executa (mestre ou jogador): `mestreExecuta = isNpc || isVinculado || !temJogador || !online`
7. Se mestre executa: abre `abrirModalExecucaoCriativo` após 150ms

**Dependências externas:** `sb`, `CRIATIVOS_CAMP`, `RPG_DATA`, `mostrarToast`, `criativoRenderMestre`, `_lerEfeitosModal`, `aprBuilderAtualizar`, `personagemTemJogador`, `jogadorEstaOnline`, `abrirModalExecucaoCriativo`, `document.getElementById/querySelector`.

---

#### `fecharModalAprovacaoCompleta()` — linha 2152
Oculta `#modal-aprovacao-completa`.

---

#### Estado — linha 2158
```js
var EXEC_CRIATIVO_ATUAL = null; // criativo sendo executado
```

---

#### `abrirModalExecucaoCriativo(criativoId)` — linha 2160
Verifica `status === 'aprovado_pronto'`, deserializa `_pronto` de `formula_aprovada` se necessário. Preenche `#modal-executar-criativo` (descrição, alvo, DC, fórmula de dano). Reseta UI (mostra etapa de acerto, oculta dano/resultado final). Define `EXEC_CRIATIVO_ATUAL`.

**Dependências externas:** `CRIATIVOS_CAMP`, `mostrarToast`, `document.getElementById`.

---

#### `rolarAcertoCriativo()` — linha 2190
Rola dado de verificação (`pronto.dado_verificacao`), calcula `erro` (natural 1 em d20), `sucesso` (≥ DC), `tipoCritico` (crítico maior = natural máximo, crítico menor = ≥ limiar). Exibe resultado colorido em `#resultado-acerto`. Se falha/erro: chama `finalizarExecucaoCriativo()` com dano 0. Se sucesso em suporte/narrativo: finaliza direto. Se sucesso em ataque: exibe etapa de dano.

**Dependências externas:** `EXEC_CRIATIVO_ATUAL`, `document.getElementById`.

---

#### `rolarDanoCriativo()` — linha 2232
Rola dados de dano (`pronto.dados_dano`) suportando formato `grupos` (novo) e `{quantidade, tipo}` (legado). Exibe resultados parciais. Chama `calcularDanoCritico(subtotal, d20)` para ajuste de crítico. Renderiza dano final com efeitos base e efeito crítico extra (se aplicável).

**Dependências externas:** `EXEC_CRIATIVO_ATUAL`, `calcularDanoCritico`, `document.getElementById`.

---

#### `aplicarDanoFinalCriativo()` — linha 2307 *(async, parcial — continua além de 2403)*
Aplica todos os efeitos do criativo:
1. Dano de HP em cada alvo (suporta `alvos_area`)
2. Efeitos base via `atkAplicarEfeito` (cura_imediata tratada separadamente)
3. Efeito crítico extra se `_tipoCritico` definido

> ⚠ Função não completamente lida. A próxima análise começa na linha 2307.

---

---

### Batch 6 — linhas 2307–2456 *(último batch)*

#### `aplicarDanoFinalCriativo()` — linha 2307 *(async, continuação/completa)*
Fluxo completo de aplicação:
1. Dano HP em `alvos_area` ou alvo único via `saveCharacterStats`
2. Efeitos base: `cura_imediata` diretamente no HP com multiplicador de crítico (1.3×/1.2×/1×); demais efeitos via `atkAplicarEfeito`
3. Efeito crítico extra (DOT/HOT/debuff/boost/atordoar) via `atkAplicarEfeito` se `_tipoCritico` definido
4. Re-render de status via `mapaRenderStatus`
5. Persiste `status='concluido'` e `dano_aplicado` em `criativos`
6. Toast diferenciado (suporte/dano/sem dano), animação crítica via `mostrarAnimacaoCritico`
7. Fecha modal, limpa `EXEC_CRIATIVO_ATUAL`, chama `criativoRenderMestre` e `_finalizarAtaqueCampanha`

**Dependências externas:** `EXEC_CRIATIVO_ATUAL`, `RPG_DATA`, `sb`, `saveCharacterStats`, `mapaRenderStatus`, `atkAplicarEfeito`, `mostrarToast`, `mostrarAnimacaoCritico`, `criativoRenderMestre`, `_finalizarAtaqueCampanha`, `document.getElementById`.

---

#### `finalizarExecucaoCriativo()` — linha 2420
Pula para etapa final quando acerto/falha resulta em dano 0: oculta etapa de dano, exibe resultado "0 / SEM DANO" em cinza.

**Dependências externas:** `document.getElementById`.

---

#### `fecharModalExecucaoCriativo()` — linha 2434
Fecha modal de execução e limpa `EXEC_CRIATIVO_ATUAL`.

---

#### Exports globais — linhas 2441–2456
Exposição de todas as funções locais da seção "Sistema 2.0" em `window`:
`abrirModalAprovacaoCompleta`, `atualizarFormulaPreview`, `aprSelecionarDado`, `aprDCPreview`, `aprBuilderAdd`, `aprBuilderRemove`, `aprBuilderAtualizar`, `aprSkillToggle`, `aprovarCriativoCompleto`, `fecharModalAprovacaoCompleta`, `abrirModalExecucaoCriativo`, `rolarAcertoCriativo`, `rolarDanoCriativo`, `aplicarDanoFinalCriativo`, `finalizarExecucaoCriativo`, `fecharModalExecucaoCriativo`.

---

### Resumo arquitetural — `js/systems/creative.js`

Este arquivo é uma extensão/patch em cima dos sistemas de arena e campanha. Suas seções principais:

| Seção | Linhas | Descrição |
|---|---|---|
| Tutorial | 1–246 | `TUTORIAL_STEPS`, localStorage por rpgId, monkey-patch de `abrirAba` |
| Arena — fluxo de ataque | 248–695 | Solicitação → DC → rolagem efetividade → dano |
| Arena — lista de cenários | 706–1105 | CRUD de cenários, propostas de jogador, 4 modos de bg |
| Campanha — aprovações (legado) | 1108–1797 | `criativoRenderMestre`, `aprovarCriativo`/`rejeitarCriativo`, modal de dano simples, stubs de efeito |
| Campanha — Sistema 2.0 | 1799–2456 | Modal de aprovação completa (dados+efeitos+skill), modal de execução com rolagem de acerto e dano |

**Padrão dominante:** monkey-patching de funções globais (`arAcaoAtacar`, `renderArenaCenario`, `arTab`, `renderMesa`, `arAtualizarUIpeloPapel`, `renderPropostasCenario`) para injetar funcionalidade sem modificar os arquivos originais.

**Dados críticos:**
- `CRIATIVOS_CAMP` — array em memória de ações criativas de campanha
- `AR.estado.ataques_arena[]` — ataques da arena, persistidos em `rpg_registry.arena_estado`
- `window._aprBuilder` — estado do builder de dados de dano no modal
- `EXEC_CRIATIVO_ATUAL` — criativo sendo executado no modal de execução
- `_nmceContext` — contexto do canvas editor (`'nm'` vs `'ar-cen'`)

---

---

## 22. `js/hub/import.js` *(✅ Mapeado — 2676 linhas, 6 batches)*

**Linhas totais:** 2676  
**Papel no sistema:** Tela de importação de RPGs — leitura de CSVs/JSON, prompts de IA, parser CSV, fluxo de import/update.

---

### Batch 1 — linhas 1–500

#### Estado / Constantes

```js
let IMPORT_MODE = 'novo'; // modo atual da tela: 'novo' | 'atualizar'

const PLABELS = { novo: {...}, atualizar: {...} };
// Labels dos botões de prompt de IA por modo e por seção
// Seções: completo, config, characters, skills, lore, attr_defs, attr_grupos,
//         vocab_tematico, item_catalog, inventario

const SPECS = { config: `...`, characters: `...`, skills: `...` /*, ... */ };
// Objeto com specs técnicos detalhados de cada seção CSV para uso em prompts de IA
// config: ~100 linhas — documenta todas as colunas de config/theme (cores, fontes, SVGs, progressão)
// characters: documenta colunas de personagens (atributos, hp, tipo, imagens)
// skills: documenta colunas de habilidades + sistema completo de animação Pixi
// (SPECS continua além da linha 500)
```

---

#### `setImportMode(mode)` — linha 10
Alterna a tela entre modos `'novo'` e `'atualizar'`. Atualiza título, seletor de RPG, estilos dos botões de modo, texto do botão submit, texto de requisito de config, e labels de todos os botões de prompt via `PLABELS[mode]`.

**Dependências externas:** `PLABELS`, `document.getElementById`, `document.querySelectorAll`.

---

#### `preencherSeletorRPGs()` — linha 23
Preenche o `<select id="rpg-update-select">` com os RPGs de `HUB_DATA.rpgs`.

**Dependências externas:** `HUB_DATA.rpgs`, `document.getElementById`.

---

#### `abrirImport()` — linha 24
Abre a tela de importação: cancela loading pendente, limpa `IMPORT_CSVS`, reseta modo para `'novo'`, preenche seletor de RPGs, limpa status/inputs/textareas, preenche seletor de RPG para importação avulsa de mapas. Oculta `#hub` e exibe `#import-screen`.

**Dependências externas:** `IMPORT_CSVS`, `setImportMode`, `preencherSeletorRPGs`, `HUB_DATA.rpgs`, `document.getElementById`, `document.querySelectorAll`.

---

#### `fecharImport()` — linha 44
Oculta `#import-screen` e exibe `#hub`.

---

#### `lerCSV(tipo, input)` — linha 51
Lê arquivo CSV via `FileReader`, parseia com `parseCSV`, normaliza `\n` literais para quebras reais, salva em `IMPORT_CSVS[tipo]`. Exibe status de sucesso/erro.

**Dependências externas:** `IMPORT_CSVS`, `parseCSV`, `document.getElementById`.

---

#### `lerCSVPaste(tipo, texto)` — linha 54
Parseia texto CSV colado via `parseCSV`, normaliza `\n`, salva em `IMPORT_CSVS[tipo]`. Exibe status.

---

#### `lerAllInOne(input)` — linha 68
Lê arquivo all-in-one (múltiplas seções) via `FileReader`, parseia com `parseMultiSection`. Popula `IMPORT_CSVS` com cada seção encontrada.

---

#### `lerAllInOnePaste(texto)` — linha 71
Parseia texto all-in-one colado via `parseMultiSection`. Requer pelo menos uma seção `#SECTION:...`. Popula `IMPORT_CSVS`.

---

#### `lerMapasJSONFile(input)` — linha 86
Lê arquivo JSON de mapas via `FileReader` e delega a `_processarMapasJSONTexto`.

---

#### `lerMapasJSONPaste(texto)` — linha 98
Processa texto JSON de mapas colado via `_processarMapasJSONTexto`. Limpa `_mapasImportJSON` se texto vazio.

---

#### `_processarMapasJSONTexto(texto, st)` — linha 104
Parseia JSON de mapas (strip de markdown se necessário), valida presença de `map_id`, aceita array direto ou `{mapas:[...]}`. Salva em `_mapasImportJSON`. Exibe status com ícone por tipo (`🌍` geral / `🏰` local), dimensões e contagem de SVGs.

---

#### `importarSoMapas()` — linha 136 *(async)*
Importa apenas mapas para um RPG existente (sem CSV). Valida `rpgId` e `_mapasImportJSON`. Chama `importarMapasJSON(rpgId, _mapasImportJSON)`. Se o RPG ativo, recarrega `RPG_DATA.mapas` do banco e chama `renderMapasTab`. Exibe resultado.

**Dependências externas:** `_mapasImportJSON`, `importarMapasJSON`, `RPG_DATA`, `sb`, `renderMapasTab`, `document.getElementById`.

---

#### `parseMultiSection(text)` — linha 168
Parser de formato multi-seção: divide por `#SECTION:nome`, parseia cada bloco como CSV via `parseCSV`, normaliza `\n` literais. Retorna objeto `{secao: rows[]}`.

---

#### `parseCSV(text)` — linha 169
Parser CSV: divide por linhas, usa primeira linha como cabeçalho, mapeia campos com `parseCSVLine`. Emite warning no console se linha tem menos campos que o cabeçalho (campos faltantes recebem string vazia).

---

#### `parseCSVLine(line)` — linha 188
Parser de linha CSV: suporta aspas duplas, escape `""` → `"`. Emite warning se aspas não fechadas.

---

#### `enviarImport()` — linha 204 *(async)*
Executa o import/update dependendo do `IMPORT_MODE`:
- **`'atualizar'`**: valida `rpgId` e seções carregadas, chama `updateRPG(rpgId, IMPORT_CSVS)`, atualiza `HUB_DATA.rpgs`, fecha após 2s
- **`'novo'`**: valida seção `config` obrigatória, chama `importRPG(IMPORT_CSVS, _mapasImportJSON)`, atualiza lista, fecha após 2s

**Dependências externas:** `IMPORT_MODE`, `IMPORT_CSVS`, `_mapasImportJSON`, `updateRPG`, `importRPG`, `getAllRPGs`, `renderRPGList`, `HUB_DATA`, `showSt`, `fecharImport`, `document.getElementById`.

---

#### `showSt(id, msg, tipo)` — linha 225
Exibe mensagem de status em elemento por ID com classe CSS `'import-status ' + tipo`.

---

#### `SPECS` — linha 233 *(parcial — continua além de 500)*
Grande objeto com specs técnicos de cada seção CSV para composição de prompts de IA. Contém:
- `SPECS.config`: documentação completa de ~100 linhas das colunas de config (rpg_id, tema visual, tipografia, paleta, progressão de nível, movimento)
- `SPECS.characters`: documentação das colunas de personagens (nome, hp, tipo, imagens, atributos_json)
- `SPECS.skills`: documentação de habilidades + sistema completo de animações Pixi (7 camadas, paletas por tipo_dano, exemplos prontos)

> ⚠ Constante não completamente lida. A próxima análise começa na linha 500.

---

---

### Batch 2 — linhas 500–999

#### `SPECS` *(continuação — completa na linha 909)*
Seções documentadas neste batch:

| Seção | Linhas | Conteúdo |
|---|---|---|
| `skills` (cont.) | 500–566 | `custo_rsv`, `formula_dano`, `alcance_celulas`, `cooldown_turnos`, `tipo_dano`, `atributo_base`, `alvo_tipo`, `efeitos_bonus_json` (HOT/DOT/buff/debuff/rec_atributo), `critico_positivo/negativo` |
| `lore` | 571–588 | Colunas `secao/titulo/conteudo`; enum de seções: mundo/magia/sociedade/segredo/historia/facoes/regras |
| `attr_defs` | 594–664 | Colunas `nome/tipo/opcoes/ordem/categoria`; categorias: basico/especial/status/resistencia; JSON de resistência (`tipo:'armadura'` com `pct_geral`/`pct_fisico`; `tipo:'resistencia'` com `damage_type`/`modo`) |
| `attr_grupos` | 668–686 | Mapeamento nome_customizado → grupo_base (forca/destreza/constituicao/inteligencia) |
| `vocab_tematico` | 690–714 | tipo `prefixo_material`/`adjetivo_qualidade`/`nome_origem` — geração temática de nomes |
| `item_catalog` | 719–880 | Tipos: consumivel/equipamento/misc; slots; `atributos_bonus_json`; `efeitos_json` (hp/recurso/atributo/debuff/remover_debuff/dano); `unico_no_mundo`; importação JSON/CSV independente; tabela-mercado |
| `inventario` | 884–907 | Colunas `personagem/item/quantidade/equipado/notas` — instâncias iniciais do item_catalog |

---

#### `SPEC_MAPAS_CONFIG` — linha 912 *(constante, completa na linha 999)*
Template literal com especificação técnica do formato JSON de configuração de mapas (sem SVG). Documenta:
- Campos de cada mapa: `map_id`, `nome`, `tipo` (mundo/tatico), `parent_map_id`, `escala_val/unit`, `grid`, `largura/altura_total`, `fog_inicial`, `locais[]`
- Hierarquia: Mundo (nível 1) → Tático urbano (nível 2) → Tático interior (nível 3)
- `zona_tipo`: interesse/perigo/saida/bau_grupo/passagem (com cor de pulso)
- `fog_inicial`: fechado/revelado/sem_fog
- Exemplo completo de 2 mapas com hierarquia

---

---

### Batch 3 — linhas 999–1499

#### `gerarPromptMestre()` — linha 1003 *(parcial — continua além de 1499)*
Retorna uma string de prompt completa para uso com IA conversacional. Cobre:

**Seção 1 (linhas 1003–1101):** Capacidades do sistema — visão completa para a IA saber o que é suportado (personagens/tipos, sistema de pet, categorias de atributo, resistências, equipamentos, tabelas, catálogo, consumíveis, habilidades, batalha, mapas, lore, visual, pacote de sessão, multiplayer).

**Seção 2 (linhas 1103–1161):** Formato CSV — instruções de formatação + injeta conteúdo de `SPECS` via template literal (`Object.keys(SPECS).map(...)`) + injeta `SPEC_MAPAS_CONFIG`.

**Seção 3 (linhas 1163–1440) — Caminho 1 (Criar do zero):** 8 fases guiadas:
- Fase 1: Conceito/tom/gênero
- Fase 2: Atributos com exemplos por gênero e sistema de pool max derivado de atributo
- Fase 2.5: Sistema de defesa (opções A/B/C/D: nenhum/armadura/resistências/combinado)
- Fase 3: Combate + design de habilidades com todos os campos (DOT/HOT/buff/debuff/rec_atributo) e orientações de balanceamento
- Fase 4: Identidade visual
- Fase 5: Personagens completos (jogador/npc/criatura/objeto com diretrizes por archetype)
- Fase 6: Confirmação de habilidades e `habilidades_por_nivel_json`/`aumentos_automaticos_json`
- Fase 7: Catálogo completo (pool de consumíveis, equipamentos por slot, itens lendários, distribuição inicial, mercado)
- Fase 8: Lore e mapas
- Fase 8.5: Balanceamento geral (HP de criaturas × PCs, dano médio, progressão, checklist de verificações)

**Seção 4 (linhas 1443–1474) — Caminho 2 (Adaptar campanha):** 14 perguntas de investigação, mapeamento para RPG Hub, adaptações de D&D/Pathfinder.

**Seção 5 (linhas 1476–1499) — Caminho 3 (Gerar CSV):** Regras absolutas de transcrição + lista de seções obrigatórias.

> ⚠ Função não completamente lida. A próxima análise começa na linha 1499.

---

---

### Batch 4 — linhas 1499–1998

#### `gerarPromptMestre()` *(continuação/completa — termina na linha 1508)*
Seção final da string retornada: regras gerais de interação (uma fase por vez, resumir antes de avançar, gerar com dados parciais, nunca recusar, incluir seções obrigatórias mesmo se básicas).

---

#### Estado — linha 1516
```js
let _mapasImportJSON = null; // JSON de mapas pendentes de importação
```

---

#### `lerMapasJSON(input)` — linha 1517
Alias de compatibilidade — delega para `lerMapasJSONFile(input)`.

---

#### `importarMapasJSON(rpgId, mapas)` — linha 1520 *(async)*
Importa array de mapas para um RPG. Para cada mapa:
1. Converte SVG embutido para data-URL base64 (sanitizando `<script>` e atributos `on*`)
2. Mescla `render_data` preservando campos existentes; adiciona `visao` e `descricao_visual` se presentes
3. Constrói body completo com todos os campos de posicionamento hierárquico
4. Tenta POST; se erro 23505 (duplicata), faz PATCH (upsert por `map_id`)

**Dependências externas:** `sb`.

---

#### `abrirModalGerarMapaIA()` — linha 1588
Abre modal de geração de mapa por IA. Limpa campos do modal, lista mapas existentes como referência no aviso (`#ia-mapa-mesa-aviso`).

**Dependências externas:** `RPG_DATA.mapas`, `document.getElementById`.

---

#### `copiarPromptMapaMesa()` — linha 1617
Gera prompt de configuração de mapas (sem SVG) via `gerarPromptMapasConfig` e copia para clipboard. Feedback visual no botão por 2.5s.

**Dependências externas:** `RPG_DATA.mapas`, `gerarPromptMapasConfig`, `mostrarToast`, `navigator.clipboard`, `fbCopy`.

---

#### `copiarPromptMapaMesaSVG()` — linha 1636
Gera prompt de mapa com SVG via `gerarPromptMapasSVGAtualizacao` e copia para clipboard.

**Dependências externas:** `RPG_DATA.mapas`, `gerarPromptMapasSVGAtualizacao`, `mostrarToast`, `navigator.clipboard`, `fbCopy`.

---

#### `importarMapasMesaPaste()` — linha 1647 *(async)*
Lê JSON colado em `#ia-mapa-mesa-paste`, parseia (strip de markdown), valida `map_id`, importa via `importarMapasJSON`. Recarrega `RPG_DATA.mapas` do banco, chama `renderMapasTab`, fecha modal.

**Dependências externas:** `RPG_DATA`, `sb`, `importarMapasJSON`, `renderMapasTab`, `mostrarToast`, `document.getElementById`.

---

#### `gerarPromptMapasConfig(contexto, mapasExistentes)` — linha 1686
Gera prompt de IA para configuração de mapas (sem SVG). Inclui: contexto do usuário, lista de mapas existentes (com dimensões), instrução para retornar apenas array JSON. Injeta `SPEC_MAPAS_CONFIG`.

---

#### `mapaRenderCanvas(m)` — linha 1718
Renderizador procedural de mapas via Canvas 2D. Dispatch por `rd.estilo`:
- `'geral'` → `_renderGeral`
- `'dungeon'` → `_renderDungeon`
- `'edificio'` → `_renderEdificio`
- `'cidade'` → `_renderCidade`
- default → `_renderAreaAberta`

Após renderizar o bioma/estilo: renderiza pontos de interesse (cidades → cluster de tiles; outros → emoji+label), saídas (círculo tracejado dourado). Retorna `true` se renderizou.

**Dependências externas:** `document.getElementById`.

---

#### `_renderCidade(ctx, rd, W, H)` — linha 1809
Renderiza mapa de cidade com tile engine (TS=6px). Tipos de tile: `1`=rua-padrão, `2`=quarteirão, `3`=edifício, `4`=praça, `5`=muro. Preenche tiles por quarteirões/edifícios/praças/muros usando `render_data`. Renderiza ruas como faixas de tiles. Labels de quarteirões e ícones/labels de edifícios. Cores por `tipo` de quarteirão (residencial/comercial/nobre/militar/religioso/porto/pobre).

**Dependências externas:** `_tnoise`, `_th`, `_hex2rgb`, `_drawTile`.

---

#### Tile Engine — linhas 1895–1926

| Função | Linha | Descrição |
|---|---|---|
| `_th(x, y)` | 1895 | Hash determinístico `sin(x*127.1 + y*311.7)*43758.5453 − floor`. Sem `Math.random`, tiles consistentes entre renders. |
| `_tnoise(x, y)` | 1901 | Ruído bilinear interpolado com smoothstep: combina 4 valores de `_th` pelos vizinhos do tile. |
| `_hex2rgb(hex)` | 1910 | Converte hex string (3 ou 6 dígitos) para `{r, g, b}`. |
| `_drawTile(ctx, px, py, ts, r, g, b, noiseVal, alpha)` | 1917 | Pinta tile com variação de brilho (`v = 0.82 + noiseVal × 0.36`). Usa `rgba` se `alpha < 1`. |

---

#### `_renderBiomasTile(ctx, rd, W, H)` — linha 1929 *(parcial — continua além de 1998)*
Renderiza mapa geral/área aberta com biomas via Voronoi tile. Distribui tiles ao bioma mais próximo (com perturbação orgânica para bordas irregulares). Bordas de bioma ficam 28% mais escuras.

> ⚠ Função não completamente lida. A próxima análise começa na linha 1929.

---

---

### Batch 5 — linhas 1929–2428

#### `_renderBiomasTile(ctx, rd, W, H)` *(continuação/completa)*
Além do Voronoi: renderiza estradas como faixas de tiles terra (RGB 130,110,75 com perturbação), rios como faixa azul variável (40–60,80–110,160–180), labels dos biomas centralizados.

**Dependências externas:** `_tnoise`, `_th`, `_hex2rgb`, `_drawTile`.

---

#### `_renderGeral(ctx, rd, W, H)` — linha 2040
Alias — delega para `_renderBiomasTile`.

#### `_renderAreaAberta(ctx, rd, W, H)` — linha 2044
Alias — delega para `_renderBiomasTile`.

---

#### `_renderDungeon(ctx, rd, W, H)` — linha 2049
Renderiza dungeon com tile engine (TS=8px). Fundo: pedra (22,18,30). Tipos de tile: `0`=pedra, `1`=piso de sala, `2`=corredor. Normaliza coordenadas dos cômodos para caber no canvas com margem. Gera corredores L-shaped entre salas consecutivas. Bordas de sala ficam mais claras (+35/+30/+40 RGB). Labels dos cômodos proporcionais ao tamanho.

**Dependências externas:** `_tnoise`, `_hex2rgb`, `_drawTile`.

---

#### `_renderEdificio(ctx, rd, W, H)` — linha 2156
Renderiza edifício/interior com tile engine (TS=8px). Fundo: grama exterior (18,26,18). Tipos: `0`=exterior, `1`=parede (tijolo), `2`=piso. Paredes detectadas como tiles de piso adjacentes ao exterior (vizinhança 8). Parede com padrão de aparelhamento via `_th`. Labels dos cômodos.

**Dependências externas:** `_tnoise`, `_th`, `_hex2rgb`, `_drawTile`.

---

#### `_roundRect(ctx, x, y, w, h, r)` — linha 2248
Desenha retângulo com bordas arredondadas usando `quadraticCurveTo`. Não faz `fill`/`stroke` — apenas cria o path.

---

#### `SCHEMA_MAPA_SVG` — linha 2259 *(constante)*
Template literal com schema do formato SVG+JSON de mapas. Documenta:
- Estrutura de cada mapa (campos: `map_id`, `nome`, `tipo`, `visao`, `parent_map_id`, `escala_val/unit`, `grid`, `descricao`, `locais[]`, `svg`)
- Campo `visao`: `'top'` (ortogonal) vs `'iso'` (isométrico 2:1)
- Hierarquia de 3 níveis com exemplos por tipo
- Requisitos do SVG (viewBox 800×500, sem scripts, elementos permitidos, max 200KB)
- Guia de qualidade visual: gradientes multicamada, `feTurbulence`, `feDropShadow`, `<pattern>`
- Visão iso: perspectiva dimétrica estilo Diablo 3 (losangos 120×60px, 3 faces, iluminação superior-esquerda, sombras paralelas)

---

#### `gerarPromptMapasSVGInicio(contexto)` — linha 2348
Gera prompt de IA para criar mapas iniciais da campanha (SVG embutido). Estrutura obrigatória: nível 1 (mundo top-down) + 2-3 níveis táticos + 2-4 interiores. Todos top-down. Injeta `SCHEMA_MAPA_SVG`.

---

#### `gerarPromptMapasSVGAtualizacao(contexto, mapasExistentes)` — linha 2378
Gera prompt de IA para criar novos mapas em campanha existente. Inclui lista de mapas existentes (com tipo) para evitar `map_id` duplicados. Instrução para gerar apenas o necessário para a próxima sessão. Injeta `SCHEMA_MAPA_SVG`.

**Dependências externas:** `mapaGetTipo`.

---

#### `gerarPromptPacoteSessao()` — linha 2415 *(parcial — continua além de 2428)*
Gera prompt de IA para criar o Pacote de Sessão. Coleta contexto: nome da campanha, personagens ativos (com HP e posição no mapa atual), NPCs recentes, cenas já usadas, lista de mapas.

> ⚠ Função não completamente lida. A próxima análise começa na linha 2415.

---

---

### Batch 6 — linhas 2415–2676 *(último batch)*

#### `gerarPromptPacoteSessao()` *(continuação/completa — termina na linha 2472)*
Retorna string de prompt para criação do Pacote de Sessão. Injeta contexto real da sessão:
- Campanha (nome, sistema)
- Cenas já usadas
- Personagens ativos com nível, HP atual/máximo e posição no mapa (`A3`, etc.)
- NPCs vivos (até 8)
- Lista de mapas disponíveis

O prompt documenta a gramática completa do pacote de sessão: `SESSÃO`, `CENA`, `NARRAÇÃO`, `SPAWN`, `FOG`, `ZONA`, `BATALHA`, `ORGANOGRAMA`.

**Dependências externas:** `CURRENT_RPG`, `RPG_DATA`, `SESSAO_ATUAL`, `MAPA_STATE`, `mapaGetTipo`, `getPosicaoNoMapa`.

---

#### Exports — linha 2474
```js
window.gerarPromptPacoteSessao = gerarPromptPacoteSessao;
window.copiarPromptPacoteSessao = function() { /* clipboard */ };
```

---

#### `copiarPromptSecao(secao)` — linha 2481
Dispatcher central para todos os botões de prompt de IA da tela de importação. Ramificações:
- `'completo'` → `gerarPromptMestre()`
- `'pacote'` → `gerarPromptPacoteSessao()`
- `'mapas'` → `gerarPromptMapasConfig(contexto, mapasExistentes)`
- `'mapas-svg'` → `gerarPromptMapasSVGAtualizacao` ou `gerarPromptMapasSVGInicio` dependendo do `IMPORT_MODE`
- Demais seções → prompt direto com `SPECS[secao]` + regras de transcrição

Copia resultado para clipboard, animação no botão por 2.5s.

**Dependências externas:** `IMPORT_MODE`, `SPECS`, `gerarPromptMestre`, `gerarPromptPacoteSessao`, `gerarPromptMapasConfig`, `gerarPromptMapasSVGAtualizacao`, `gerarPromptMapasSVGInicio`, `RPG_DATA.mapas`, `navigator.clipboard`, `fbCopy`, `document.getElementById`.

---

#### `fbCopy(t, cb)` — linha 2518
Fallback de cópia para clipboard via `document.execCommand('copy')` quando `navigator.clipboard` não está disponível.

---

#### `salvarNav(screen, id)` — linha 2522
Persiste estado de navegação em `localStorage` (`rpghub_nav`).

#### `salvarAba(rpgId, aba)` — linha 2523
Persiste aba ativa de um RPG em `localStorage` (`rpghub_tab_{rpgId}`).

---

#### `_mapaInicializarLayout()` — linha 2529
Configura layout de 2 colunas (`tab-mapas`) para telas < 1100px. Executa apenas uma vez (verifica se `#mapa-sidebar` já existe). Cria sidebar direita (`#mapa-sidebar`) com subpainéis:
- `#ctx-sidebar-botoes` — ações contextuais
- `#atk-sidebar-painel` — painel de ataque inline
- `#atk-sidebar-trigger` — confirmação inline
- `#ficha-sidebar-painel` — ficha inline

Move elementos do DOM para os dois containers:
- Sidebar: `mapa-status`, `criativo-mapa-bar`, `atk-painel-campanha-anchor`, `feed-painel-inline`, `batalhas-selector`, `criativos-mestre-wrap`, etc.
- Coluna esquerda: `mapa-breadcrumb`, `mapa-lista`, `mapa-toolbar`, `mapa-wrap`, hints, etc.

Adiciona listener de `resize` para ativar/desativar classe `layout-2col`. Em portrait muito estreito (< 480px): sidebar fica abaixo com `maxHeight: 38vh`.

---

#### `_mapaAjustarAlturaLayout()` — linha 2629
Ajusta `height` do `#tab-mapas` para `100dvh − (headerH + navH)`. Em portrait estreito: `#mapa-area-esq` tem `minHeight: 55vh`.

---

#### `_ctxSidebarLimpar()` — linha 2647
Oculta `#ctx-sidebar-botoes` e limpa `#ctx-botoes-painel`.

---

#### `abrirAba(id, btn)` — linha 2654
**Função base** (definida aqui, monkey-patched em outros arquivos). Lógica:
1. Se aba `'mapas'`: agenda `mesaModoVerificar`, `_atualizarBannerControleMobile`, `_mapaInicializarLayout`
2. Remove classe `active` de todos os `.tab-content` e `.tab-btn`
3. Ativa `#tab-{id}` e `btn`
4. Se `'mapas'`: chama `renderMapasTab()`
5. Persiste aba via `salvarAba`

**Nota:** Esta é a definição original de `abrirAba`. O arquivo `creative.js` (tutorial) e `js/ui/tabs.js` a sobrescrevem via monkey-patch.

**Dependências externas:** `mesaModoVerificar`, `_atualizarBannerControleMobile`, `_mapaInicializarLayout`, `renderMapasTab`, `salvarAba`, `RPG_DATA`, `document`.

---

#### `mostrarToast(msg, tipo)` — linha 2667
**Função base** de toast. Exibe mensagem no elemento `#toast` com classe CSS `tipo` por 2.4s.

---

#### Service Worker — linhas 2669–2675
Registra `./sw.js` via `navigator.serviceWorker.register` no evento `'load'`.

---

### Resumo arquitetural — `js/hub/import.js`

| Seção | Linhas | Descrição |
|---|---|---|
| Tela de import | 1–226 | `abrirImport`, leitores CSV/JSON, `enviarImport`, `parseCSV*` |
| SPECS (prompts IA) | 233–909 | Documentação técnica das 8 seções CSV |
| SPEC_MAPAS_CONFIG | 912–999 | Spec JSON de configuração de mapas |
| Prompt conversacional | 1003–1508 | `gerarPromptMestre()` — 3 caminhos + 8.5 fases guiadas |
| Sistema de mapas IA | 1515–1711 | Import, modal, geração de prompts (config e SVG) |
| Canvas procedural | 1718–2256 | 5 renderers de tile (geral/bioma/dungeon/edifício/cidade) |
| SCHEMA + prompts SVG | 2259–2408 | Schema SVG+JSON, prompts de início e atualização |
| Pacote de sessão | 2415–2479 | `gerarPromptPacoteSessao` + exports |
| `copiarPromptSecao` | 2481–2517 | Dispatcher de todos os botões de prompt |
| Funções base | 2522–2667 | `abrirAba`, `mostrarToast`, layout de mapa 2 colunas |

**Funções-chave** definidas aqui (monkey-patched em outros arquivos):
- `window.abrirAba` — base, sobrescrita em `creative.js` (tutorial) e `tabs.js`
- `window.mostrarToast` — base, pode ser sobrescrita
- `window.renderConfig` — não definida aqui, referenciada em outros arquivos

---

---

## 23. `js/systems/arena.js` *(✅ Mapeado — 3720 linhas, 8 batches)*

**Arquivo:** `js/systems/arena.js` | **Total:** 3720 linhas

### Constantes e Estado Global (linhas 1–28)

#### `AR` — Objeto de estado global da Arena

| Campo | Tipo | Descrição |
|---|---|---|
| `session` | objeto | `{rpg_id, name, batalha_num, theme_json}` da arena ativa |
| `chars` | array | Personagens `[{nome, hp_atual, hp_max, custom_attrs, buffs, ...}]` |
| `estado` | objeto | `{cenario, turno, log[]}` — estado narrativo persistido |
| `estadoLoreId` | int\|null | ID do registro de lore do estado |
| `histList` | array | Histórico de batalhas `[{id, titulo, conteudo}]` |
| `d100Hist` | array | Histórico de rolagens d100 da sessão atual (memória local) |
| `ws` | WebSocket\|null | Conexão realtime |
| `charTipoModal` | string | Tipo de personagem sendo criado no modal (`'jogador'`) |
| `hpEditNome` | string\|null | Nome do personagem em edição de HP |
| `myRole` | string | Role do usuário: `'mestre'` ou `'jogador'` |
| `myNickname` | string | Nickname do player logado |
| `myCharNome` | string\|null | Personagem vinculado ao player logado |
| `iniciativa` | objeto\|null | Estado da iniciativa: `{ativa, fase, ordem, ordemAtual, round, ...}` |
| `arenaIdCriada` | string\|null | `rpg_id` da arena recém-criada |
| `bulkCriaturas` | array | Criaturas para criação em lote |
| `iniValorAtual` | int\|null | Valor rolado no modal de iniciativa |
| `vincularCriaturaNome` | string\|null | Criatura sendo vinculada |

#### `AR_CORES` (linha 28)
Array de 10 cores hex padrão para personagens.

### Injeção no Hub (linhas 33–48)

`window.addEventListener('load', ...)` — após 100ms injeta botão "Beyonders & PVP Dinâmico" no `.hub-body` com `onclick="abrirArenaHub()"`.

### Navegação (linhas 50–87)

| Função | Descrição |
|---|---|
| `abrirArenaHub()` | Oculta `#hub`, exibe `#arena-hub`, chama `carregarArenaList()` |
| `fecharArenaHub()` | `salvarNav('hub')`, volta para `#hub` |
| `sairArenaSession()` | `chatOcultar()`, `arFecharRealtime()`, volta para `#arena-hub` |
| `arTab(nome, btn)` | Troca aba ativa `.ar-tab-content`/`.ar-tab`; dispara render específico por aba; persiste em `localStorage` |

**Abas disponíveis:** `config`, `d100`, `efeitos`, `log`, `iniciativa`, `entidades`, `cenario` (mais outras).

### Supabase Helpers (linhas 92–104)

| Função | Descrição |
|---|---|
| `arSb(path, opts)` | Alias direto para `sb()` |
| `sbAnon(path)` | Busca pública com `apikey` sem JWT (usa Bearer se sessão ativa) |

### Gerenciamento de Arenas (linhas 106–311)

| Função | Descrição |
|---|---|
| `carregarArenaList()` | Busca arenas onde `is_arena=true`; filtra por `owner_id` ou `rpg_members`; renderiza lista |
| `criarArenaSession()` | Cria arena: gera código de acesso (5 chars maiúsculos), lê dado de efetividade e penalidades de HP; salva em `rpg_registry` + `rpg_members` (role=mestre); exibe código |
| `arEntrarArenaAposCriacao()` | Fecha modal e chama `entrarArena(AR.arenaIdCriada)` |
| `abrirModalCriarArena()` | Inicializa form com defaults: dado d20, 2 linhas de penalidades HP (75→-5, 25→-15) |
| `arAdicionarPenalidadeRow()` | Adiciona nova linha de penalidade de HP ao formulário |
| `arCopiarCodigo()` | Copia código de acesso para clipboard |
| `arEntrarPorCodigo()` | Busca arena por `codigo_acesso`; registra usuário em `rpg_members` (role=jogador) se não estiver; chama `entrarArena()` |

#### `entrarArena(rpgId)` (linhas 252–311)
1. `salvarNav('arena', rpgId)` — persiste navegação
2. Busca meta em `rpg_registry`; detecta `myRole` via `owner_id` ou `rpg_members`
3. Exibe badge de role (`#ar-role-badge`)
4. Chama `arCarregarTudo()`, `renderArenaDados()`, `arMesaRenderDados()`, `arAtualizarUIpeloPapel()`, `arIniciarRealtime()`, `chatMostrar()`
5. Restaura aba salva no `localStorage`

### `arAtualizarUIpeloPapel()` (linhas 314–354)

Controla visibilidade de elementos por `AR.myRole`:
- Cenário: `#ar-cenario-mestre-btns`, `#ar-cenario-jogador-btns`, `#ar-cenario-propostas-wrap`
- Personagens: botão mestre vs. player (player oculta se já tem personagem)
- Entidades: `#ar-entidades-btns-mestre/player`, `#ar-entidades-solicitacoes-wrap`
- Efeitos: `#ar-efeitos-btns-mestre`
- Mesa: `#ar-mesa-btns-mestre`
- Turno: `#ar-btn-avancar-turno`
- Chama: `renderArenaIniciativaUI()`, `renderPropostasCenario()`, `renderSolicitacoesEntidade()`

### `arCarregarTudo()` (linhas 356–415)

Carrega em paralelo: `characters`, `lore`, `attr_defs` do Supabase.
- Normaliza `custom_attrs` (parse JSON se string)
- Sincroniza campos dedicados do DB para `custom_attrs`: `nivel`, `hp_max`, `xp`, `pontos_attr`
- Lê `arena_estado` de `rpg_registry` (inclui `iniciativa_arena`)
- Dispara todos os renders: `renderArenaPersonagens`, `renderArenaEntidades`, `renderArenaEfeitos`, `renderArenaLog`, `renderArenaCenario`, `renderArenaD100Hist`, `renderArenaIniciativaUI`, `renderMesa`, `arAtualizarUIpeloPapel`
- Carrega criativos pendentes em `CRIATIVOS_CAMP` e chama `criativoRenderMestre()`

### Render: Personagens e Entidades (linhas 420–501)

| Função | Descrição |
|---|---|
| `renderArenaPersonagens()` | Filtra `tipo='jogador'`; renderiza com `arCharCardHTML()`; ajusta botão player |
| `renderArenaEntidades()` | Filtra `tipo` em `['criatura','objeto']`; renderiza com `arCharCardHTML()` |
| `arCharCardHTML(c)` | Gera HTML do card: barra HP colorida, badges de buff, botões contextuais (⚔ atacar, HP, inventário, aparência, editar, vincular) conforme role |

**Controle de permissão em `arCharCardHTML`:**
- `isMeuPersonagem` = mestre OU `myCharNome===c.nome` OU `owner_nickname===myNickname`
- NPCs: apenas mestre edita
- `podeAtacar` = meuPersonagem E não incapacitado

> ⚠ Função `arCharCardHTML` não completamente lida. A próxima análise começa na linha 501.

---

### Batch 2 — linhas 501–1000

#### Render: Cenário (linhas 506–533)

| Função | Descrição |
|---|---|
| `renderArenaCenario()` | Atualiza `#ar-turno-num` e `#ar-cenario-texto`; chama `renderAtaquesPendentes()` |
| `salvarCenario()` | Lê textarea e URL de imagem; atualiza `AR.estado`; chama `arSalvarEstado()` + `renderMesa()` |

#### Render: Efeitos (linhas 538–586)

| Função | Descrição |
|---|---|
| `atkResumoBuff(b)` | Helper — gera texto resumo de buff: DOT `🩸`, HOT `💚`, boost `⚡`, rec `🔷`, mod_dano `📉`, sem_ataque `⚔🚫`, sem_movimento `🚫` |
| `renderArenaEfeitos()` | Agrupa buffs de todos os personagens por ID de efeito; renderiza cards com cor por tipo (buff/debuff/DOT/boost) e botão de remoção |

#### Render: Log, D100, Config (linhas 591–652)

| Função | Descrição |
|---|---|
| `renderArenaLog()` | Renderiza `AR.estado.log` em ordem reversa com badge de turno |
| `renderArenaD100Hist()` | Renderiza histórico local de d100 com cores por resultado (95+: verde, 5-: vermelho) |
| `renderArenaConfig()` | Exibe código de convite (só mestre); renderiza lista de histórico de batalhas |
| `arCopiarCodigoCfg()` | Copia código de convite para clipboard |

#### Ações: HP (linhas 657–716)

| Função | Descrição |
|---|---|
| `abrirModalHP(nome)` | Inicializa slider e barra HP; abre `#ar-modal-hp` |
| `arHpSliderChange()` | Atualiza label e barra HP conforme slider |
| `arHpDelta(delta)` | Incrementa/decrementa valor do slider |
| `arAtualizarBarraHP(hp, hpMax)` | Atualiza classe CSS da barra (high/mid/low) |
| `confirmarHP()` | PATCH em `characters`; registra log `💢 nome: old/max → new/max`; atualiza mesa |

#### Ações: Personagens/Entidades (linhas 721–879)

| Função | Descrição |
|---|---|
| `abrirModalCriarChar(tipo)` | Inicializa form para novo personagem com HP default; label dinâmica por tipo |
| `abrirModalEditarChar(nome)` | Pré-popula form com dados existentes; exibe habilidades NPC se criatura |
| `renderCoresSwatch(corSel)` | Renderiza swatch de 10 cores; marca `sel` na cor ativa |
| `selecionarCor(el, cor)` | Alterna classe `.sel` no swatch |
| `getCorSelecionada()` | Retorna `data-cor` do item `.ar-cor.sel` |
| `salvarChar()` | Cria ou edita personagem; valida nome único; aplica regra 1 personagem por jogador; persiste `custom_attrs` com `tipo`, `cor`, `img_url`, `hp_max`, `habilidades`, `pos` aleatória para novo |
| `deletarChar()` | DELETE em `characters`; remove de `AR.chars`; registra log |

#### Ações: Efeitos / Buffs (linhas 884–1000)

| Função | Descrição |
|---|---|
| `arEfToggle(key)` | Exibe/oculta campos de configuração do efeito por checkbox |
| `arEfSelectGroup(grupo)` | Seleciona alvos em lote: `todos`, `jogadores`, `npcs`, `nenhum` |
| `arEfTipoChange()` | Reduz opacidade de seção positiva/negativa conforme tipo buff/debuff |
| `abrirModalCriarEfeito()` | Inicializa form; renderiza lista de alvos com cor por tipo |
| `salvarEfeito()` | Monta objeto de efeito com todos os sub-campos (heal, HOT, boost, rec, DOT, debuff, sem_mov, sem_atq, def); aplica cura imediata; appenda buff a `c.buffs`; PATCH em `characters`; registra log |

> ⚠ Função `salvarEfeito` não completamente lida. A próxima análise começa na linha 1001.

---

### Batch 3 — linhas 1001–1500

#### `salvarEfeito()` — conclusão (linhas 1001–1044)

Campo adicional: `mod_defesa` com `mod_defesa_turnos_restantes`.
Loop de aplicação por personagem: aplica cura imediata (rola fórmula), recuperação imediata de atributo, então persiste buff em `c.buffs` via PATCH em `characters`.

#### `removerEfeito(efId)` (linhas 1046–1065)

Itera todos os `AR.chars`, filtra `buffs` pelo ID, faz PATCH, registra log `🗑 Efeito removido`.

#### `avancarTurno()` (linhas 1070–1209)

Incrementa `AR.estado.turno`. Para cada personagem:
- **DOT** — rola `dot_formula`, aplica dano, decrementa `dot_turnos_restantes`
- **HOT** — rola `hot_formula`, cura HP, decrementa `hot_turnos_restantes`
- **Recuperação de atributo por turno** — rola `rec_formula`, soma ao atributo, decrementa `rec_turnos_restantes`
- Decrementa todos os contadores: `sem_movimento_turnos_restantes`, `sem_ataque_turnos_restantes`, `mod_dano_turnos_restantes`, `boost_dano_turnos_restantes`, `mod_defesa_turnos_restantes`, `turnos_restantes`
- Buff expira quando todos contadores chegam a zero: reverte `modificador_attr` temporário se aplicável
- **Invocações temporárias**: deleta personagens com `custom_attrs.invocado=true` quando `turno >= turno_expira`
- **Cooldowns**: decrementa `AR.estado.cooldowns[id]`, remove quando zero
- Salva estado, re-renderiza tudo, exibe toast resumindo DOT/HOT/expirados

#### Log Manual (linhas 1214–1227)

| Função | Descrição |
|---|---|
| `abrirModalLog()` | Abre `#ar-modal-log` com campo limpo |
| `adicionarLogManual()` | Adiciona `📝 texto` ao log, salva estado |

#### Dados Customizáveis (linhas 1232–1290)

| Função | Descrição |
|---|---|
| `AR_DADO_SEL` | Variável local — dado selecionado atual (default 20) |
| `getArenaDiceConfig()` | Lê array de faces ativas do `localStorage` (`rpghub_dice_arena_<id>`) |
| `setArenaDiceConfig(arr)` | Persiste array de faces ativas no `localStorage` |
| `renderArenaDados()` | Renderiza grid de botões SVG por face ativa; marca dado selecionado |
| `renderArenaDiceConfig()` | Renderiza grid de toggle por todas as faces em `TIPOS_DADO` |
| `toggleDadoArena(d)` | Toggle de face; mínimo 1 ativo; atualiza localStorage e re-renderiza |
| `arSelecionarDado(d)` | Seta `AR_DADO_SEL` e re-renderiza grid |
| `arRolarDadoSel()` | Rola dado selecionado; anima com CSS `.girar` |
| `svgDadoArena(d)` | Retorna SVG inline para d4/d6/d8/d10/d20/d100 |

#### D100 (linhas 1295–1311)

`arRolarD100()` — anima resultado; categoriza: 95+→`✦ PRODÍGIO`(verde), 80+→sucesso poderoso(dourado), 50+→sucesso, 20+→sucesso parcial, >5→falha significativa, ≤5→`✦ CATÁSTROFE`(vermelho); empurra para `AR.d100Hist`.

#### Histórico e Reset de Batalha (linhas 1316–1445)

| Função | Descrição |
|---|---|
| `salvarHistoricoArena()` | Persiste snapshot em `lore` (secao=`'historico'`): batalha_num, data, turno_final, chars_snapshot, log |
| `resetarBatalha()` | Incrementa `batalha_num` em `theme_json`; opção `deletar` (apaga todos) ou `manter` (mantém jogadores com HP cheio/sem buffs/nova pos, deleta criaturas/objetos/invocações); reset `AR.estado={cenario:'',turno:0,log:[]}` |
| `arResetToggleOpcao(el, opcao)` | Radio visual para opção de reset de personagens |
| `verHistorico(loreId)` | Exibe modal com snapshot: data, turnos, cenário, personagens, últimos 20 logs |
| `confirmarDeletarArena()` | DELETE em `characters`, `lore`, `rpg_registry`; retorna ao hub |

#### Utils: Estado e Realtime (linhas 1450–1590)

| Função | Descrição |
|---|---|
| `arAddLog(texto)` | Appenda `{turno, texto, ts}` ao `AR.estado.log`; limita a 200 entradas |
| `arSalvarEstado()` | Serializa `AR.estado` (inclui `iniciativa_arena` se ativa; limpa ataques finalizados); PATCH em `rpg_registry.arena_estado` |
| `arIniciarRealtime(rpgId)` | WebSocket com reconexão exponencial (até 30s); assina canais: `characters`, `rpg_registry`, `batalhas`, `criativos` |
| — | Characters: sync INSERT/UPDATE/DELETE em `AR.chars` e `RPG_DATA.characters`; re-renderiza |
| — | rpg_registry: sync `arena_estado` (estado, iniciativa); sync `batalha_estado` via `batalhaReceberEstadoRemoto()` |
| — | Batalhas/Criativos: delegam para `batalhaReceberLinhaRemota()` e `criativoReceberLinhaRemota()` |
| — | Broadcast: `chat_msg`, `chat_presence`, `anim_ataque`, `token_move`, `combate_evento` |
| `arFecharRealtime()` | Fecha WebSocket; oculta indicador `#ar-rdot` |

> ⚠ Realtime (`arIniciarRealtime`) continua na linha 1477. Próxima análise começa na linha 1501.

---

### Batch 4 — linhas 1501–2000

#### Realtime — conclusão (linhas 1501–1596)

Broadcast handlers:
- `chat_msg` → `chatReceberMensagem()`
- `chat_presence` → `chatReceberPresenca()`
- `anim_ataque` → `animReceberBroadcast()`
- `token_move` → `tokenMoveReceber()`
- `combate_evento` → `combateReceberBroadcast()`

Reconexão: `onclose` → backoff exponencial (2⁰×1s até 30s max), retenta `conectar()` se `AR.ws` ainda é a mesma instância.

`arFecharRealtime()` — fecha `AR.ws`, oculta `#ar-rdot`.

#### Utils: Modais / Toast / Misc (linhas 1601–1762)

| Função | Descrição |
|---|---|
| `abrirModal(id)` / `fecharModal(id)` | `display='flex'` / `'none'` |
| `abrirModalCenario()` | Abre modal de cenário (mestre only); pré-popula textarea e imagem com `AR.estado` |
| `abrirModalResetBatalha()` | Abre `#ar-modal-reset` |
| `abrirModalProporCenario()` | Abre modal de proposta de cenário (limpa campos) |
| `abrirModalSolicitarEntidade()` | Abre modal de solicitação de entidade (limpa campos) |
| `abrirModalVincular(nomeEntidade)` | Lista jogadores para vínculo; exibe vínculo atual; chama `abrirModal('ar-modal-vincular')` |
| `arVincularSel(el, jogNome)` | Seleciona radio visual + armazena `_vinculo` no DOM |
| `arConfirmarVinculo()` | PATCH `custom_attrs.vinculado_a`; se desvinculado + iniciativa ativa, chama `arInserirCriaturaIniciativa()` |
| `arPreviewCenarioImg(url)` | Preview de imagem no modal de cenário |
| `arImportarCenarioJSON()` | Parse JSON e pré-popula campos de cenário |
| `arImportarCenarioArquivo(input)` | FileReader para importar JSON de arquivo |
| `arImportarPropostaCenarioJSON()` | Parse JSON e pré-popula campos de proposta |
| `arToast(msg, tipo)` | Alias para `mostrarToast()` |
| `arChatToggle()` | Chama `chatToggle()` e sincroniza badge |
| `arSincronizarChatBadge()` | Atualiza `#ar-chat-badge` com `CHAT.naoLidos`; tinta botão quando chat aberto |
| `arSliderUpdate(sliderId, valId, suffix)` | Sync de label com slider |

**Event listeners globais:**
- `click` em `.ar-modal` → `fecharModal(id)`
- `input` em `#ar-char-img` → preview de imagem no modal de char

#### Criação de Personagem pelo Jogador (linhas 1767–1799)

| Função | Descrição |
|---|---|
| `arCriarMeuPersonagem()` | Verifica se jogador já tem personagem; abre `abrirModalCriarChar('jogador')` |
| `arAbrirAparencia(nome)` | Injeta char em `RPG_DATA.characters`, seta flags `_arAparenciaHook`/`_arAparenciaNome`, abre `abrirModalAparencia()` |
| `arAparenciaSalva` (event) | Listener: ao receber evento, sincroniza `custom_attrs.aparencia` do `RPG_DATA` para `AR.chars` + PATCH |

#### Propostas de Cenário (linhas 1804–1856)

Sistema colaborativo: jogadores propõem, mestre aprova ou rejeita.

| Função | Descrição |
|---|---|
| `arEnviarPropostaCenario()` | Empurra `{id, autor, texto, img, ts, status:'pendente'}` em `AR.estado.propostas_cenario`; salva estado |
| `renderPropostasCenario()` | Exibe cards de propostas pendentes (só mestre vê); botões Aprovar/Rejeitar |
| `arAprovarPropostaCenario(id)` | Aplica texto+img ao cenário principal; remove proposta; registra log; atualiza mesa |
| `arRejeitarPropostaCenario(id)` | Remove proposta sem aplicar |

#### Solicitações de Entidade (linhas 1861–1932)

| Função | Descrição |
|---|---|
| `arEnviarSolicitacaoEntidade()` | Empurra `{id, autor, nome, tipo, desc, hp, img}` em `AR.estado.solicitacoes_entidade` |
| `renderSolicitacoesEntidade()` | Cards de solicitações pendentes (só mestre); botões Criar e Vincular / Rejeitar |
| `arAprovarEntidade(id)` | Cria personagem em `characters`; vínculo automático com autor; cor aleatória; pos aleatória; marca `temporaria:true` |
| `arRejeitarEntidade(id)` | Remove solicitação sem criar |

#### Criação em Lote de Criaturas (linhas 1937–1999)

| Função | Descrição |
|---|---|
| `abrirModalBulkCriaturas()` | Inicia `AR.bulkCriaturas=[{}]`; abre modal |
| `renderBulkCriaturas()` | Renderiza formulário por criatura (nome, HP, descrição, imagem) |
| `arBulkAddCriatura()` | Appenda `{}` e re-renderiza |
| `arBulkRemoveCriatura(i)` | Remove índice e re-renderiza |
| `arBulkCriarCriaturas()` | Lê todos os campos do DOM; cria criaturas em loop em `characters`; todas marcadas `temporaria:true`; (continua na próx. linha) |

> ⚠ Função `arBulkCriarCriaturas` não completamente lida. A próxima análise começa na linha 2001.

---

### Batch 5 — linhas 2001–2500

#### `arBulkCriarCriaturas()` — conclusão (linhas 2001–2007)

Após loop de criação: `arSalvarEstado()`, fecha modal, re-renderiza entidades e mesa.

#### Sistema de Iniciativa (linhas 2012–2365)

**Estado `AR.iniciativa`:** `{ativa, fase, participantes[], iniciativas{}, ordem[], ordemAtual, round}`

| Função | Descrição |
|---|---|
| `renderArenaIniciativaUI()` | Renderiza UI por fase: pré-batalha (botões role-based), `'iniciativa'` (rolagem), `'combate'` (ordem) |
| `renderListaRolagem()` | Cards de participantes com valor rolado ou `'?'` e indicador de aguardo |
| `renderOrdemCombate()` | Strip horizontal de mini-cards por ordem (criaturas vinculadas ocultas); label "Vez de X"; painel de ações (meu turno ou mestre); lista de criaturas vinculadas do jogador atual |
| `arMeuChar()` | Retorna nome do personagem do usuário logado (via `myCharNome` ou busca por `owner_nickname`) |
| `hexToRgb(hex)` | Converte hex para `"r,g,b"` |
| `arDarVezPara(idx)` | Mestre seta `ordemAtual`; salva estado |
| `arIniciarIniciativa()` | Mestre: filtra participantes válidos (vivos, sem vínculo para criaturas); NPCs rolam d20 automaticamente; jogadores aguardam |
| `abrirModalArenaIniciativa()` | Abre modal de rolagem; reseta valor |
| `arRolarIniciativaModal()` | Rola d20 com animação; habilita botão Confirmar |
| `arConfirmarIniciativa()` | Registra `AR.iniValorAtual` no `AR.iniciativa.iniciativas[meuChar]` |
| `arCalcularOrdemIniciativa()` | Mestre: ordena participantes por iniciativa (maior → menor); troca para fase `'combate'`, round=1 |
| `_charMorto(p)` | Helper: `hp_atual <= 0` |
| `arProximoTurnoIniciativa()` | Mestre: avança `ordemAtual` pulando mortos e vinculados; ao completar volta para round+1 e chama `avancarTurno()` |
| `arEncerrarBatalhaIniciativa()` | Mestre: reverte todos `modificador_attr` pendentes; limpa todos os buffs; `AR.iniciativa = null` |
| `arInserirCriaturaIniciativa(nome, posicao)` | Insere criatura desvinculada na ordem: `'imediato'` (próxima), `'ultimo'` (fim), `'proximo'` (por valor de iniciativa) |
| `arAcaoAtacar()` | Abre `abrirModalAtaque()` para o personagem da vez (ou meu personagem) |
| `arAcaoPassar()` | Jogador ou mestre passa turno; avança `ordemAtual` + novo round se necessário |

#### Dado Rápido da Mesa (linhas 2374–2407)

| Função | Descrição |
|---|---|
| `AR_MESA_DADO_SEL` | Dado selecionado na mesa (null = nenhum) |
| `arMesaRenderDados()` | Renderiza botões de dado na mesa usando `getArenaDiceConfig()` |
| `arMesaSelecionarDado(d)` | Seta `AR_MESA_DADO_SEL` e re-renderiza |
| `arMesaRolarDado()` | Rola dado selecionado; anima com scale+opacity; cores especiais para d20 crítico/1 e d100=100 |

#### MESA — Campo de Batalha Top-down (linhas 2413–2500)

**Estado `MESA`:**

| Campo | Descrição |
|---|---|
| `toolMode` | `false`=arrastar, `true`=medir distância |
| `medindo` | `[nomeA, nomeB]` tokens em medição |
| `medicaoAtiva` | `{pA, pB, label}` linha de medição persistente |
| `escala` | `{val:1.5, unit:'m', grid:20}` — escala do mapa |
| `dragging` | `{nome, startX%, startY%, el}` — token sendo arrastado |
| `dragTimer` | Debounce para salvar posição |
| `zoom`, `panX`, `panY` | Zoom e translação do mapa |

| Função | Descrição |
|---|---|
| `mesaZoomApply()` | Aplica `translate(panX,panY) scale(zoom)` ao `#ar-mesa-bg` |
| `mesaZoomReset()` | Reseta zoom=1, pan=0 |
| `mesaZoomSet(z, pivotX, pivotY)` | Clamp zoom (0.05–20); ajusta pan para manter ponto pivot estático |
| `mesaZoomInit()` | Inicializa listeners: wheel (zoom centrado no cursor), pinch touch (2 dedos), pan com pointer; (continua na linha 2500) |

> ⚠ Função `mesaZoomInit` não completamente lida. A próxima análise começa na linha 2501.

---

### Batch 6 — linhas 2501–3000

#### `mesaZoomInit()` — conclusão (linhas 2501–2536)

Pan com pointer: capture em `pointerdown`, translata `MESA.panX/panY` em `pointermove`, libera em `pointerup/cancel`. Atalhos de teclado (aba mesa): `+`/`=` → ×2, `-` → ×0.5, `0` → reset (apenas quando `#ar-tab-mesa.ativo`).

#### `renderMesa()` (linhas 2539–2582)

Coordenador principal do campo de batalha:
1. Atualiza `#ar-mesa-turno` e `#ar-mesa-cenario-pill`
2. Chama: `mesaAtualizarBackground()`, `mesaDesenharGrade()`, `mesaRenderTokens()`
3. `setTimeout(mesaZoomInit, 100)` — inicializa listeners de zoom uma única vez
4. Chama: `mesaRenderEfeitosRow()`, `mesaRenderStatus()`, `renderArenaIniciativaUI()`, `criativoRenderMestre()`

#### Mesa Background e Grade (linhas 2584–2646)

| Função | Descrição |
|---|---|
| `mesaAtualizarBackground()` | Lê `AR.estado.cenario_img`; gerencia `<img class="ar-bg-img">`; aplica zoom/pan; remove wrapper legado `.ar-iso-wrap` |
| `mesaDesenharGrade()` | Canvas ortogonal: grade H/V com `strokeStyle rgba(200,168,75,0.15)`; colunas = `escala.grid` (20), linhas proporcional ao aspect ratio |

#### `mesaRenderTokens()` (linhas 2649–2661)

Limpa layer; cria tokens via `mesaCriarToken`; restaura linha de medição ativa se `MESA.medicaoAtiva`.

#### `mesaCriarToken(c, layer)` (linhas 2663–2769)

Token div `.ar-mesa-token` com:
- **Posicionamento** — `left/top` em `%`, `transform: translate(-50%,-50%) scale(arIsoDepth)` (profundidade iso: y=0→0.72, y=100→1.22)
- **Renderização de conteúdo** (3 modos):
  - ISO SVG via `apmodTokenSVG()` + equipamentos visuais com warp/skew/rotação
  - Imagem `img_url` com tint overlays
  - Iniciais do nome em texto
- **Badges**: HP (bottom, cor por saúde), nome (top), contagem de buffs (top-right), overlay 💀 se incapacitado
- **Eventos**: `pointerdown` → `mesaClicarToken()` se toolMode, senão `mesaIniciarDrag()`

#### Drag & Drop de Tokens (linhas 2773–2862)

| Função | Descrição |
|---|---|
| `mesaIniciarDrag(nome, el, e)` | Bloqueia se jogador com buff `sem_movimento`; captura pointer; registra listeners |
| `mesaOnDrag(e)` | Compensa zoom e pan (`localX = (clientX - wrapRect.left - panX) / zoom`); atualiza `c.custom_attrs.pos`; movimenta token via style direto; broadcast a 20fps via `tokenMoveBroadcast`; debounce 400ms para PATCH em `characters` |
| `mesaFimDrag(e)` | Cancela debounce; PATCH imediato; restaura cursor `grab` |

#### Ferramenta de Medição (linhas 2865–2947)

| Função | Descrição |
|---|---|
| `toggleMesaTool()` | Toggle `MESA.toolMode`; muda cursor/ícone botão; limpa linha; re-renderiza tokens |
| `mesaClicarToken(nome)` | 2-cliques: 1º seleciona A, 2º seleciona B e chama `mesaCalcularDistancia()` |
| `mesaCalcularDistancia()` | Distância euclidiana em células de grade, convertida por `MESA.escala.val/unit`; persiste em `MESA.medicaoAtiva` |
| `mesaRenderDistLine(pA, pB, label)` | Desenha linha SVG tracejada em `#ar-mesa-dist-svg` com rótulo de distância |
| `limparMedicaoArena()` | `MESA.medicaoAtiva = null`, limpa SVG |

#### Status Rápido e Efeitos na Mesa (linhas 2950–3000)

| Função | Descrição |
|---|---|
| `mesaRenderEfeitosRow()` | Badges de efeitos ativos deduplicados por ID em `#ar-mesa-efeitos-row` |
| `mesaRenderStatus()` | Cards HP horizontais por personagem; botão ⚔ com 3 estados: `livre` (red, clicável), `fora_combate` (dourado, aviso), bloqueado (cinza, não-clicável); clique no card abre `abrirModalHP` |

> ⚠ Função `mesaRenderStatus` não completamente lida. A próxima análise começa na linha 3001.

---

### Batch 7 — linhas 3001–3500

#### `mesaRenderStatus()` — conclusão (linhas 3001–3008)

Card HTML final: barra HP inline, cor HP por percentual, badge de buffs count, botão ⚔.

#### Escala da Mesa (linhas 3011–3025)

| Função | Descrição |
|---|---|
| `abrirModalEscala()` | Pré-popula campos com `MESA.escala` |
| `salvarEscala()` | Atualiza `MESA.escala.val/unit/grid`; redesenha grade |

#### Editor 3D da Arena (linhas 3029–3150)

| Função | Descrição |
|---|---|
| `arMp3dAtualizar()` | Lê 7 sliders (rx, ry, rz, persp, ox, oy, sc); atualiza labels; aplica `transform` no preview plane; renderiza grade de referência SVG; aplica ao `#ar-mesa-bg .ar-iso-wrap` em tempo real; atualiza escala iso dos tokens |
| `arPreset3D(preset)` | 4 presets: `flat` (0°), `dimetric` (rx60/rz45), `iso` (rx54/rz45), `reset` |
| `abrirModalArMapa()` | Abre modal; carrega imagem atual e `transform3d` de `AR.estado`; chama `arMp3dAtualizar()` |
| `salvarArMapa()` | Persiste `cenario_img` e `transform3d` (8 campos incl. `depth`) em `AR.estado`; chama `mesaAtualizarBackground()` + `arSalvarEstado()` |

#### Importar Mapa via JSON (linhas 3153–3240)

| Função | Descrição |
|---|---|
| `abrirModalArImportarMapa()` | Abre `#ar-modal-importar-mapa` |
| `executarArImportarMapa()` | Parse JSON (limpa markdown fences); suporte a SVG inline (converte para data URL base64); aplica `cenario_img`, `MESA.escala.val/unit/grid`; salva estado |

Resize listener: debounce 120ms → `mesaDesenharGrade()` + `mesaRenderTokens()`.

#### Modal de Imagem de Personagem (linhas 3243–3328)

| Função | Descrição |
|---|---|
| `abrirModalImg(nome)` | Cria modal dinamicamente se inexistente; preview via `normalizeImgUrl` |
| `modalImgPreview(url)` | Alterna entre `<img>` e placeholder `👤` |
| `attrImgPreview(url, cor, targetId)` | Preview genérico para atributos |
| `salvarImgPersonagem()` | PATCH `characters.custom_attrs.img`; atualiza views: `renderCharView`, `renderAttrView`, `renderConfig`, `mapaRenderTokens` |

#### Sistema de Batalha via IA (linhas 3334–3500)

| Função | Descrição |
|---|---|
| `abrirModalCriarBatalhaIA()` | Verifica role mestre; abre modal |
| `fecharModalCriarBatalha()` | Fecha overlay |
| `copiarPromptBatalha()` | Gera prompt com contexto real (personagens, campanha, local atual); instrui IA a gerar JSON de batalha com schema completo: `submapa`, `imagem_fundo_iso`, `render_data` (estilos dungeon/edificio/area_aberta, cômodos, saídas, biomas, POIs), `personagens`, `inimigos`, `npcs_especiais`; posicionamento isométrico dimétrico Diablo 3 |
| `_parseBatalhaCSV(csv)` | Parser CSV para formato alternativo de batalha; distingue tipo: `inimigo`, `npc_especial`, `aliado`, player |
| `importarBatalhaIA()` | Tenta JSON, fallback CSV; (continua na linha 3501) |

> ⚠ Função `importarBatalhaIA` não completamente lida. A próxima análise começa na linha 3501.

---

### Batch 8 — linhas 3501–3720 (conclusão)

#### `importarBatalhaIA()` — conclusão (linhas 3501–3718)

Fluxo de 6 etapas após parse do JSON/CSV:

**1. Criar ou sobrescrever submapa** (linhas 3516–3567)
- Gera `map_id` com slug + timestamp
- Se submapa com mesmo nome já existe: atualiza `render_data` via PATCH
- Se novo: cria em `mapas` com `tipo='local'`, `parent_map_id` do mapa atual, `render_data` se presente; atualiza `RPG_DATA.mapas`

**2. Posicionar personagens dos players** (linhas 3572–3586)
- Busca char em `RPG_DATA.characters` pelo nome exato
- `pctParaCelula(x, y, subMapId)` converte posição % para célula
- PATCH `characters` com `active_map_id` + `map_positions`

**3. Criar/reposicionar inimigos como NPCs genéricos** (linhas 3589–3642)
- `custom_attrs.npc_generico = true`, `tipo = 'npc'`
- Cria via POST se não existe; reposiciona via PATCH se já existe
- Campos: `cor`, `hp_max`, `ataque_padrao`, `descricao`, `map_positions`

**4. Criar/reposicionar NPCs especiais** (linhas 3645–3698)
- `npc_generico = false`, `aliado: bool`
- Cor padrão: azul (`#4fa3d1`) para aliados, laranja para neutros

**5. Navegar para o submapa** (linhas 3701–3711)
- Chama (se definidas): `selecionarMapa(subMapId)`, `renderMapasTab()`, `mapaRenderTokens()`, `mapaRenderStatus()`, `mapaRenderCanvas()` com delay 100ms

**6. Feedback final** (linhas 3713–3718)
- `fecharModalCriarBatalha()`; toast com contagem de players e NPCs criados + erros

---

### Resumo arquitetural — `js/systems/arena.js`

**Total:** 3720 linhas | **Batches:** 8

| Seção | Linhas | Descrição |
|---|---|---|
| Estado global + injeção | 1–48 | `AR` object, `AR_CORES`, hub injection |
| Navegação e CRUD de arenas | 53–311 | `arTab`, `carregarArenaList`, `criarArenaSession`, `entrarArena` |
| UI por papel + carga completa | 314–415 | `arAtualizarUIpeloPapel`, `arCarregarTudo` |
| Render: personagens/entidades | 420–501 | `renderArenaPersonagens`, `arCharCardHTML` |
| Render: cenário, efeitos, log | 506–652 | CRUD de cenário, `atkResumoBuff`, `renderArenaEfeitos` |
| Ações: HP, personagens | 657–879 | Modal HP, criar/editar/deletar chars, swatches de cor |
| Ações: efeitos/buffs | 884–1065 | `salvarEfeito` (7 campos), `removerEfeito` |
| Turno e iniciativa | 1070–2365 | `avancarTurno` (DOT/HOT/rec), sistema de iniciativa completo |
| Log, dados, d100, histórico | 1214–1445 | Gerenciamento de log, dice config, reset de batalha |
| Utils e realtime | 1450–1762 | `arSalvarEstado`, WebSocket reconectável, modais, toast |
| Jogador: personagem e aparência | 1767–1799 | `arCriarMeuPersonagem`, `arAbrirAparencia` |
| Colaboração: propostas e entidades | 1804–1932 | Cenário proposto, solicitações de entidade |
| Bulk de criaturas | 1937–2007 | Formulário em lote, criação paralela |
| Mesa top-down | 2413–3008 | Zoom/pan/pinch, grade canvas, tokens ISO, drag&drop, medição |
| Editor 3D + importar mapa | 3029–3240 | `arMp3dAtualizar`, presets, `executarArImportarMapa` |
| Batalha via IA | 3334–3720 | `copiarPromptBatalha` (schema completo), `importarBatalhaIA` (6 etapas) |

**Funções-chave exportadas:**
- `window.arTab`, `window.arAtualizarUIpeloPapel`, `window.renderPropostasCenario` — monkey-patched em `creative.js`
- `window.renderMesa` — monkey-patched em `creative.js`
- `window.arIniciarRealtime`, `window.arFecharRealtime` — controlam WebSocket da arena
- `window.importarBatalhaIA` — integração com IA para criação de batalhas

---

## 24. `js/combat/combat.js` *(✅ Mapeado — 4321 linhas, 8 batches)*

**Arquivo:** `js/combat/combat.js` | **Total:** 4321 linhas

### Parser e Rolagem de Dados (linhas 1–99)

| Função | Assinatura | Descrição |
|---|---|---|
| `parsearFormulaDano(formula)` | `str → [{tipo,qtd,faces}\|{tipo:'fixo',valor}]\|null` | Parser regex para fórmulas multi-grupo: `"2d6+1d8+3"`, `"d20"`, `"-2d6"`. Dados negativos → `tipo:'dado_negativo'`. Retorna `null` se inválido |
| `formulaDeGrupos(grupos)` | `grupos → str` | Reconstrói string de fórmula a partir de grupos de builder; agrupa dados por face |
| `rolarGrupos(grupos)` | `grupos → {total, dados[], bonus}` | Rola todos os grupos; `dado_negativo` subtrai do bônus; `total = Math.max(0, soma + bonus)` |
| `rolarFormula(parsed)` | `parsed → {total, rolls[], formula}` | Wrapper de compatibilidade — aceita array (novo) ou objeto simples `{tipo,qtd,faces,bonus}` (legado) |

### Atributos e Modificadores (linhas 103–116)

`calcModAtributo(habilidade, nomeAtacante, contexto)` — calcula bônus fixo de atributo: `ceil(valor * habilidade.mod_atributo_pct / 100)`. Busca char em `AR.chars` (arena) ou `RPG_DATA.characters` (campanha).

### Sistema de Cooldowns (linhas 119–185)

| Função | Descrição |
|---|---|
| `decrementarCooldowns(contexto)` | Arena: decrementa `AR.estado.cooldowns{}`; Campanha: decrementa `MAPA_STATE.batalhas[BATALHA_ATUAL_ID].cooldowns{}`; remove ao chegar a 0; persiste via `arSalvarEstado()` ou `salvarEstadoBatalha()` |
| `avancarTurnoComCooldowns(contexto)` | Incrementa turno (arena ou batalha), chama `decrementarCooldowns()`, exibe toast |

### Preview de Dano (linhas 196–221)

`calcularRangeDano(formula)` → `{min, max, media}` — calcula range sem rolar dados; `dados_negativo` subtrai; clamp min a 0.

### Log de Combate Persistente (linhas 227–328)

**`COMBATE_LOG`** — objeto singleton com limite de 50 eventos:

| Campo/Método | Descrição |
|---|---|
| `eventos[]` | Array de eventos com `{id, timestamp, tipo, ...dados}` |
| `adicionar(tipo, dados)` | Empurra evento; descarta mais antigo se >50; chama `renderizar()` e `combateBroadcast('log_evento', ...)` |
| `renderizar()` | Renderiza em `#combate-log-container` (ordem reversa); ícones/cores por tipo: ataque🗡️/dano💥/cura💚/efeito✨🔥/turno🔄/morte💀/critico🎯 |
| `limpar()` | Zera eventos e re-renderiza |

### Utilitários de Estado e Targeting (linhas 334–466)

| Função | Descrição |
|---|---|
| `getCooldownsBatalhaSeguro(batalhaId)` | Accessor seguro: retorna `{}` se batalha não existe, inicializa `cooldowns={}` se ausente |
| `determinarAlvoEfeito(efeito, habilidade, atacanteNome, alvosAtaque)` | Sistema determinístico de targeting: 1) `alvo_override` explícito; 2) habilidade aliada → efeito no alvo; 3) efeito positivo em habilidade ofensiva → self-buff no atacante; 4) padrão → debuff no alvo |
| `validarEstadoCombate()` | Valida `COMBATE.atacanteNome`, `contexto`, `habilidadeSel`, alvo e `dadosRolados`; loga warnings |
| `resetarEstadoCombate()` | Zera todos os campos de `COMBATE` para estado inicial limpo |

### Sistema de Críticos 2.0 (linhas 469–500)

`calcularDanoCritico(danoBase, d20)`:
- d20 = 1 → ERRO CRÍTICO (dano 0)
- d20 = 2–17 → Normal (×1.0)
- d20 = 18–19 → Crítico Menor (+20%)
- d20 = 20 → Crítico Maior (+30%)

> ⚠ Função `calcularDanoCritico` não completamente lida. A próxima análise começa na linha 501.

---

### Batch 2 — linhas 501–1000

#### `calcularDanoCritico` — conclusão (linhas 501–539)

- `d20 2–17` → normal (multiplicador 1, mensagem `null`)
- `d20 18–19` → `critico_menor` (×1.2, cor `#f39c12`)
- `d20 20` → `critico_maior` (×1.3, cor `#f0cc6a`)
- Retorna `{dano, tipo, multiplicador, mensagem, cor}`

#### Críticos — Funções Legacy e Animação (linhas 542–607)

| Função | Descrição |
|---|---|
| `verificarCritico(resultado)` | Wrapper legado: extrai d20 de `resultado.dados`; retorna `{critico, multiplicador, tipo}` |
| `aplicarCriticoAoDano(dano, criticoInfo)` | Aplica multiplicador 1.2/1.3 ou retorna 0 para erro |
| `mostrarAnimacaoCritico(tipo, atacante, danoBase, danoFinal)` | `navigator.vibrate` por tipo + toast + `COMBATE_LOG.adicionar('critico', ...)` |

#### Atalhos de Teclado (linhas 615–661)

`configurarAtalhosCombate()` — listener `keydown` ativo quando `#modal-ataque` visível:
- `1–9` → `atkSelecionarHabilidade(idx)`
- `Enter` → `atkRolarDados()` se btnRolar ativo, senão `atkConfirmarAtaque()`
- `Escape` → `fecharModalAtaque()`
- `R/r` → `atkRolarDados()`

Inicializado via `DOMContentLoaded` ou imediatamente se DOM já carregado.

#### Estado Global de Combate (linhas 663–676)

| Variável | Tipo | Descrição |
|---|---|---|
| `COMBATE` | objeto | `{contexto, atacanteNome, habilidadeSel, alvoNome, dadosRolados, step, _habilidades[], _alvos[], formulaBuilder[], rolando, _jaAplicado, _pendingTrigger, _estadoAtk}` |
| `NPC_HABILIDADES_TEMP` | array | Habilidades de NPC em edição temporária |
| `ATAQUE_MAPA_STATE` | objeto | `{ativo, atacanteNome, fase:'habilidades'|'alvos'}` — modo de ataque integrado ao mapa |

#### `abrirModalAtaque(atacanteNome, contexto)` (linhas 679–880)

1. **Pré-checks**: verifica `_estadoBatalhaJogador` para não-mestres; cancela trigger pendente
2. **Reset COMBATE** com `_jaAplicado: false`, `_pendingTrigger: false`
3. **Lista de habilidades**: `atkGetHabilidadesArena` ou `atkGetHabilidadesCampanha`; renderiza com badges:
   - Cooldown: `⏳ Nt`
   - Bloqueado: `🚫 Bloq.`
   - Com fórmula: `"2d6+3 (5-15)"` — preview via `calcularRangeDano` + `calcModAtributo`
   - Sem fórmula: `"Montar dados"`
4. **Ação criativa**: exibe `#atk-criativo-wrap` se `temPermissao('ataque_criativo')`
5. **Display mode** (3 modos via `_setModalModo`):
   - `'painel'` — desktop 3 colunas: move modal para `#mesa-acao-painel`
   - `'inline'` — âncora campanha visível: posiciona absolutamente sobre `#atk-painel-campanha-anchor`
   - `'overlay'` — fullscreen fixo (arena e fallback)

#### `fecharModalAtaque()` (linhas 882–922)

Restaura modal para `document.body`; oculta sidebar; limpa `ATAQUE_MAPA_STATE`; se `_pendingTrigger` → `_atkMostrarTrigger()`; se cancelado → `_aplicarEstadoBatalhaUI()`.

#### Modal de Efeito Crítico do Mestre (linhas 927–1000)

`_criticoCtx` — estado: `{alvos[], ehPositivo, texto, contexto}`.

`abrirModalCriticoMestre(alvos, ehPositivo, criticoTexto, contexto)`:
- Preenche header com ícone (✨/⚡) e subtítulo
- Exibe texto do efeito com fundo colorido por polaridade
- Lista checkboxes dos alvos atingidos (oculta se apenas 1 alvo — efeito automático)
- Reset tipo de efeito via `criticoEfTipoChange()`

`fecharModalCriticoMestre()` — oculta modal.

> ⚠ Função `criticoEfTipoChange` não completamente lida. A próxima análise começa na linha 1001.

---

### Batch 3 — linhas 1001–1500

#### `criticoEfTipoChange()` — conclusão (linhas 1001–1014)

Oculta todos os campos `critico-ef-campos-*`; exibe o campo correspondente ao tipo selecionado; esconde campo de turnos para `cura_imediata` e `livre`.

#### `criticoMestreAplicar()` (linhas 1016–1145)

Lê checkboxes de alvos; por tipo aplica efeito via `atkAplicarEfeito()` ou `atkAplicarCura()`:

| Tipo | Efeito criado |
|---|---|
| `dot` | `{dot_formula, dot_turnos_restantes}` |
| `hot` | `{hot_formula, hot_turnos_restantes}` |
| `debuff_mov` | `{sem_movimento, sem_movimento_turnos_restantes}` |
| `debuff_atk` | `{sem_ataque, sem_ataque_tipo:'todos'}` |
| `debuff_dano` | `{mod_dano, mod_dano_turnos_restantes}` |
| `boost` | `{boost_dano, boost_dano_turnos_restantes}` |
| `cura_imediata` | `atkAplicarCura(qtd)` |
| `debuff_stun` | sem_movimento + sem_ataque combinados |
| `livre` | buff/debuff genérico por `ehPositivo` |

Salva estado (arena ou campanha) e fecha modal.

#### Range Circle (linhas 1151–1220)

| Função | Descrição |
|---|---|
| `mapaShowRangeCircle(atacanteNome, alcanceCelulas)` | Cria `#atk-range-circle` em `#mapa-tokens`; posição em `%` via `getPosicaoNoMapa`; raio = `alcanceCelulas * (100 / larguraGrid)%`; cor extraída de `custom_attrs.cor`; animação `rangeCirclePulse` |
| `mapaHideRangeCircle()` | Oculta círculo, zera `MAPA_STATE._rangeCircle` |

#### Modo de Ataque Dinâmico no Mapa (linhas 1228–1500)

| Função | Descrição |
|---|---|
| `mapaAtaqueIniciar(atacanteNome)` | Valida turno, reseta COMBATE, seta `ATAQUE_MAPA_STATE.ativo=true`; mostra float panel (ou sidebar); chama `_mapaAtaqueRenderHabilidades()` |
| `_mapaAtaqueRenderHabilidades()` | Renderiza skills no painel com cooldown/bloqueio/range badges; seção de pets (clona via `atkRenderizarSecaoPets`); seção criativa inline com botões ataque/suporte/narrativo |
| `mapaAtaqueCriativoSetTipo(tipo, btn)` | Destaca botão selecionado (criativo/suporte/narrativo) com cor correspondente |
| `mapaAtaqueSelecionarCriativo()` | Valida descrição; monta `COMBATE.habilidadeSel.criativo=true`; para narrativo/próprio/área → `atkEnviarAtaqueCriativo()` diretamente; para alvo único → fase 2 de seleção |
| `mapaAtaqueSelecionarHabilidade(idx)` | Seta skill; exibe `mapaShowRangeCircle` se `alcance_celulas`; para `alvo_tipo='proprio'` → `atkAplicarSkillSuporte` imediato; para `todos_aliados` → (continua na próxima linha) |

> ⚠ Função `mapaAtaqueSelecionarHabilidade` não completamente lida. A próxima análise começa na linha 1501.

---

### Batch 4 — Linhas 1501–2000

#### `mapaAtaqueSelecionarHabilidade(idx)` — conclusão (linhas ~1500–1543)

Completando os ramos de `alvo_tipo`:

| Ramo | Comportamento |
|---|---|
| `todos_aliados` | Chama `atkMontarSelecaoAlvo()`, filtra aliados não fora-de-alcance, aplica `atkAplicarSkillSuporte(aliados)` e fecha o painel |
| `area` | Chama `atkMontarSelecaoAlvo()`, fecha painel de mapa, reabre `abrirModalAtaque()` em modo normal; usa `setTimeout(() => atkSelecionarHabilidade(idx), 100)` |
| `alvo único / todos_inimigos` | Chama `atkMontarSelecaoAlvo()`, renderiza `_mapaAtaqueRenderAlvos()`, atualiza UI para fase 2 (`atk-mapa-fase1` oculto, `atk-mapa-fase2` visível), chama `_mapaAtaqueDestacarAlvos()` |

Resumo da habilidade exibido em `#atk-mapa-hab-resumo` com cor diferente para buffs (`#5ee09a`) vs ataques (`#e8604c`).

---

#### `_mapaAtaqueRenderAlvos()` (linhas ~1545–1569)

Renderiza lista de alvos no painel flutuante do mapa.

- Fonte: `COMBATE._alvos` (preenchida por `atkMontarSelecaoAlvo()`)
- Exibe: nome, HP atual/máximo, distância em células
- Alvos fora do alcance: `opacity: 0.4`, click dispara toast de erro
- Alvos válidos: click chama `mapaAtaqueClicarAlvo(nome)`
- Fallback: `"Sem alvos disponíveis"` se lista vazia

---

#### `_mapaAtaqueDestacarAlvos()` (linhas ~1571–1593)

Aplica CSS de destaque nos tokens do mapa conforme status:

| Classe CSS | Quando |
|---|---|
| `.atk-target-disponivel` | Alvo inimigo dentro do alcance |
| `.atk-target-fora-alcance` | Alvo fora do alcance |
| `.atk-target-buff` | Alvo aliado (buff) |

Limpa todas as classes antes de re-aplicar. Só age se `ATAQUE_MAPA_STATE.ativo` e `fase === 'alvos'`.

---

#### `mapaAtaqueClicarAlvo(nomeAlvo)` (linhas ~1595–1669)

Roteia o clique num alvo do mapa para o fluxo correto de ataque.

1. Valida se alvo está em `COMBATE._alvos` e não está fora do alcance
2. Verifica custo de recurso via `verificarCustoSkill()` (exceto ataques criativos)
3. Define `COMBATE.alvoNome` e atualiza resumos visuais no modal
4. Roteamento:

| Condição | Ação |
|---|---|
| `h.criativo` | `atkEnviarAtaqueCriativo()` |
| Não-buff + fora_combate + não-mestre | `atkEnviarSolicitacaoSkill()` |
| `ehBuff` (aliado/próprio) | `atkAplicarSkillSuporte([a.nome])` |
| `todos_inimigos` | Coleta todos in-range → `_mapaAtaqueAbrirStep3Overlay()` |
| Normal | `_mapaAtaqueAbrirStep3Overlay()` |

---

#### `_mapaAtaqueAbrirStep3Overlay()` (linhas ~1671–1688)

Converte o `#modal-ataque` para modo overlay fullscreen antes de abrir o step 3.

- Move o modal para `document.body` se estiver em âncora lateral
- Define `modal._atkModo = 'overlay'`
- CSS: `position:fixed;inset:0;background:rgba(0,0,0,0.88);align-items:flex-end` (bottom sheet)
- Chama `atkPrepararStep3()` + `atkIrParaStep(3)`

---

#### `mapaAtaqueVoltarFase1()` (linhas ~1690–1701)

Retorna para a fase 1 (seleção de habilidade) no painel de mapa:

- Reseta `ATAQUE_MAPA_STATE.fase = 'habilidades'` e `COMBATE.habilidadeSel = null`
- Remove círculo de alcance e destaques de token
- Re-renderiza `_mapaAtaqueRenderHabilidades()`
- Mostra `atk-mapa-fase1`, oculta `atk-mapa-fase2`

---

#### `mapaAtaqueFechar()` (linhas ~1703–1717)

Reset completo do modo de ataque no mapa:

- `ATAQUE_MAPA_STATE = { ativo: false, atacanteNome: null, fase: 'habilidades' }`
- Oculta `#atk-sidebar-painel` e `#atk-mapa-float-panel`
- Remove classes de destaque de todos os tokens
- Chama `mapaHideRangeCircle()` e `mapaHideAoECircle()` (se existir)
- Restaura UI de batalha via `_aplicarEstadoBatalhaUI()`

---

#### `_mapaAtaqueAtualizarAposMovimento(nomeMovido)` (linhas ~1720–1729)

Hook chamado após movimentar um token no mapa.

- Só age se `ATAQUE_MAPA_STATE.ativo`, `fase === 'alvos'` e `nomeMovido === atacanteNome`
- Recalcula distâncias com `atkMontarSelecaoAlvo()`
- Atualiza lista e destaques em tempo real

---

#### `_mapaAdicionarBotaoAtaqueTurno()` (linhas ~1732–1765)

Adiciona badge ⚔ flutuante acima do token do personagem cuja vez é na batalha.

- Busca o participante atual em `BATALHA_ATUAL_ID` → `MAPA_STATE.batalhas[id]`
- Exibe apenas se: é o turno do jogador local OU o mestre deve jogar pelo NPC (`mestreDeveJogarPor()`)
- Não exibe se `ATAQUE_MAPA_STATE.ativo` (painel já aberto)
- Click: `e.stopPropagation()` + `mapaAtaqueIniciar(atual.nome)`

---

#### Sistema de Pet (linhas ~1768–1888)

Permite que pets/montarias do personagem usem habilidades próprias no combate.

##### `petGetHabilidadesPet(petNome, contexto)`

Retorna habilidades do pet conforme tipo:

| Tipo | Fonte |
|---|---|
| Criatura / NPC | `custom_attrs.habilidades` |
| Personagem jogador | `atkGetHabilidadesArena()` ou `atkGetHabilidadesCampanha()` |

##### `petGetPetsDoDono(donoNome, contexto)`

Filtra personagens com `ca.eh_pet === true && ca.pet_dono === donoNome`.

##### `petDonoEstaAtivo(donoNome, contexto, tipoDanoHabilidade)`

Verifica se o dono pode agir:

1. HP atual > 0
2. Sem buff `sem_ataque` ativo (tipo `'todos'`)
3. Sem bloqueio de ataque para `tipoDanoHabilidade` via `atkVerificarBloqueioAtaque()`

##### `atkRenderizarSecaoPets(donoNome, contexto)`

Renderiza seção de pets no step 1 do modal de ataque. Exibe HP, incapacitação, e lista de habilidades por pet. Botões desabilitados se dono incapacitado ou bloqueio de tipo.

##### `atkUsarAtaquePet(petNome, habilidadeIdx)`

Inicia ataque do pet:

1. Guarda `COMBATE._petAtacante = petNome` e `COMBATE._donoAtacante = COMBATE.atacanteNome`
2. Troca `COMBATE.atacanteNome = petNome` (para cálculo de alcance)
3. Define `COMBATE.habilidadeSel = h`
4. Chama `atkMontarSelecaoAlvo()` + `atkIrParaStep(2)`

##### `atkConfirmarAtaque()` (override)

Envolve o `atkConfirmarAtaque` original (guardado em `_atkConfirmarOriginal`). Após confirmar, restaura `COMBATE.atacanteNome` ao dono e limpa `_petAtacante`/`_donoAtacante`.

---

#### `atkGetHabilidadesArena(nome)` (linhas ~1890–1910)

Obtém habilidades de personagem de arena:

- Fonte: `c.custom_attrs.habilidades`
- Injeta efeitos de equipamentos visuais com `unlock_efeitos` em `efeitos_bonus`
- Filtro por `habilidades` ou `'*'` (todos)

#### `atkGetHabilidadesCampanha(nome)` (linhas ~1912–1958)

Obtém habilidades de personagem de campanha:

- Fonte: `RPG_DATA.skills` filtrado por `_skFiltrarPorChar()`
- Mapeamento de campos: `formula_dano`, `efeito`, `custo_rsv`, `custo_tipo`, `cooldown_turnos`, `tipo_dano`, `alcance_celulas`, `atributo_base`, `mod_atributo_pct`, `alvo_tipo`, `efeitos_bonus`, `animacao`, `critico_positivo`, `critico_negativo`, `invocar_nome`, `invocar_duracao_turnos`
- Converte `animacao` de string JSON para objeto
- Mesma injeção de `unlock_efeitos` via equipamentos visuais

---

#### Builder de Efeitos Bônus de Habilidade (linhas ~1960–1998)

Estado temporário `SK_EFEITOS_TEMP = []` para edição de efeitos bônus no modal de habilidade.

Funções toggle (show/hide de campos por checkbox):

| Função | Campo controlado |
|---|---|
| `skToggleDotFields()` | `#sef-dot-fields` |
| `skToggleHotFields()` | `#sef-hot-fields` |
| `skToggleBoostFields()` | `#sef-boost-fields` |
| `skToggleRecFields()` | `#sef-rec-fields` |
| `skToggleMovFields()` | `#sef-mov-fields` |
| `skToggleAtkFields()` | `#sef-atk-fields` |
| `skToggleDebFields()` | `#sef-deb-fields` |

##### `skAlvoTipoChange()`

Atualiza `#sk-alvo-dica` com texto explicativo para cada `alvo_tipo` (inimigo / próprio / aliado / todos_aliados / todos_inimigos / area).

##### `skTipoDanoChange()`

- Mostra `#sk-invocacao-wrap` se `tipo_dano === 'invocacao'`
- Auto-ajusta `alvo_tipo` para `'aliado'` se tipo for `cura`, `buff` ou `escudo` e alvo era inimigo

> ⚠ Análise até linha 2000. Próximo batch começa na linha 2001.

---

### Batch 5 — Linhas 2001–2500

#### `criativoSetTipo(tipo)` — conclusão / `criativoSetAlvo(tipoAlvo)` (linhas ~2477–2537)

`criativoSetTipo`: alterna botões ataque/suporte/narrativo com borderWidth/boxShadow; oculta `#criativo-alvo-wrap` se tipo = `narrativo`; chama `criativoSetAlvo(CRIATIVO_ALVO_TIPO)` ao final.

`criativoSetAlvo(tipoAlvo)`: alterna botões único/area/próprio — cor varia por `CRIATIVO_TIPO` (vermelho para ataque, verde para suporte).

---

#### `atkSelecionarCriativo()` (linhas ~2539–2572)

Valida descrição, monta `COMBATE.habilidadeSel` criativo:

```javascript
{ criativo: true, descricao, nome: 'Ação Criativa',
  criativo_tipo: CRIATIVO_TIPO,       // 'ataque'|'suporte'|'narrativo'
  criativo_alvo_tipo: CRIATIVO_ALVO_TIPO, // 'unico'|'area'|'proprio'
  alvo_tipo: suporte+proprio ? 'proprio' : suporte → 'aliado' : 'inimigo' }
```

Roteamento:

| Condição | Ação |
|---|---|
| `narrativo` OR `proprio` OR `area` | `alvoNome = atacanteNome` (ou null), vai para step `pendente`, chama `_criativoEnviarParaMestre()` |
| Outros | `atkMontarSelecaoAlvo()` + `atkIrParaStep(2)` |

---

#### `_criativoEnviarParaMestre()` (linhas ~2576–2673)

Envia ação criativa para a tabela `criativos` no Supabase.

Campos persistidos: `rpg_id`, `id` (`ac_<timestamp>`), `atacante`, `alvo`, `descricao`, `criativo_tipo`, `criativo_alvo_tipo`, `turno`, `status: 'pendente'`.

Fluxo por papel:

| Papel | Arena | Campanha |
|---|---|---|
| **Mestre** | Fecha modal, abre `abrirModalCriativoMestre(id)` | Idem |
| **Jogador** | Step pendente + `criativoIniciarPolling(id)` | Idem + `criativoRenderMestre()` + polling |

Em caso de erro na campanha: remove da `CRIATIVOS_CAMP` local e exibe toast.

---

#### `atkMontarSelecaoAlvo()` (linhas ~2675–2713)

Preenche o step 2 do modal com a lista de alvos:

- Atualiza `#atk-habilidade-resumo` com nome/fórmula/alcance
- Popula `COMBATE._alvos` via `atkListarAlvos()`
- Renderiza `#atk-alvos-lista`: para cada alvo exibe nome, tipo, faction, HP, distância
- Fogo amigo forte (`⚠️ FOGO AMIGO`) vs leve (`⚠ atingido`) com cores distintas
- Alvos fora do alcance: opacity 0.4, cursor default, click dispara toast

---

#### `atkListarAlvos()` (linhas ~2715–2837)

Engine central de filtragem e ordenação de alvos.

**Variáveis de controle:**
- `pvpAtivo` — `arena` ou `CURRENT_RPG.theme.pvp_ativo`
- `ffAtivo` — `arena` ou `CURRENT_RPG.theme.fogo_amigo_ativo`
- `_getFaction(c)` — retorna `'jogador'`, `'aliado'`, `'inimigo'` ou `'neutro'` baseado em `custom_attrs.tipo_personagem/npc_faction`

**Filtros — Arena:**

| Faction | Buff | Ataque |
|---|---|---|
| jogador/aliado | ✅ | Só se ffAtivo |
| inimigo | ❌ | ✅ sempre |
| neutro | ❌ | ✅ sempre |

**Filtros — Campanha (adicionais):**
- Restringe a participantes da batalha atual (`BATALHA_ATUAL_ID`)
- Restringe ao mesmo `active_map_id`
- Pets aliados incluídos em buffs (verifica `eh_pet` + `pet_dono`)
- Mestre pode atacar aliados/jogadores independente de pvp/ff

**Pós-filtro:** Calcula `distCelulas` via `atkDistanciaCelulas()`, marca `foraAlcance`, ordena in-range primeiro.

---

#### `atkSelecionarAlvo(idx)` (linhas ~2840–2876)

Step 2 → step 3 no modal padrão:

1. Define `COMBATE.alvoNome`
2. Verifica custo de recurso (`verificarCustoSkill`)
3. Roteamento:

| Condição | Ação |
|---|---|
| Criativo | `atkEnviarAtaqueCriativo()` |
| Buff (aliado/próprio) | `atkAplicarSkillSuporte([a.nome])` |
| `todos_inimigos` | `atkAplicarAoEInimigos(todos_in_range)` |
| `fora_combate` + não-mestre | `atkEnviarSolicitacaoSkill()` |
| Normal | `atkPrepararStep3()` + `atkIrParaStep(3)` |

---

#### `atkAplicarAoEInimigos(alvos)` (linhas ~2878–2884)

Armazena `COMBATE._alvosAoE = alvos`, chama `atkPrepararStep3()` + `atkIrParaStep(3)` (dano rolado uma vez e aplicado a todos).

---

#### `atkPrepararStep3()` (linhas ~2886–2966)

Prepara o step 3 (rolagem de dados):

1. Reseta `COMBATE.formulaBuilder/dadosRolados/rolando`
2. Parseia `h.formula_dano` via `parsearFormulaDano()`
3. Calcula e injeta `modAttr` via `calcModAtributo()` como grupo fixo
4. Soma `boost_dano` de buffs ativos do atacante como grupo fixo
5. Decide modo UI:

| Modo | Condição | UI |
|---|---|---|
| Fórmula | `grupos.length > 0` | `#atk-sec-formula` visível, botão "🎲 Rolar Dados" |
| Builder | Sem fórmula | `#atk-sec-builder` visível, botão "Delegar ao Mestre" |

Label exibido inclui: fórmula base + `+N% Atributo` (se `mod_atributo_pct`) + `+N ⚡buff` (se boost ativo).

---

#### Builder de Dados Manual (linhas ~2969–2999)

Para habilidades sem fórmula no banco, o jogador monta os dados manualmente:

| Função | Comportamento |
|---|---|
| `atkAdicionarDado(faces)` | Incrementa qtd do grupo existente ou cria novo |
| `atkRemoverDado(faces)` | Decrementa qtd; remove grupo se qtd ≤ 0 |
| `atkLimparBuilder()` | Reset completo de `COMBATE.formulaBuilder` |
| `atkAtualizarBuilder()` | Re-renderiza fórmula exibida, mostra/oculta botão Rolar, atualiza chips |

> ⚠ Análise até linha 2500. Próximo batch começa na linha 2501.

---

### Batch 6 — Linhas 3001–3500

#### `atkRolarDados()` (linhas ~3010–3125)

Função async de animação de rolagem de dados no step 3.

**Padrão Snapshot (BUG-01 FIX):** Antes de qualquer `await`, captura snapshot imutável de `habilidade`, `contexto`, `atacante`, `alvo`, `alvosAoE`, `role` e `grupos` para evitar race conditions caso `COMBATE` seja resetado durante a animação.

**Animação por dado:**
- Chip visual 44×44px com borderRadius e cor do dado
- Intervalo de 60ms por tick (~320ms total) com valor aleatório exibido
- Ao completar: valor real exibido; dado maxado (igual às faces) → highlight dourado
- Acumula total e atualiza `#atk-total-dano` em tempo real

**Pós-animação:**
1. Restaura `COMBATE` do snapshot (garante consistência)
2. Broadcast `'dados_rolados'` via `combateBroadcast`
3. Labels de crítico: `d20=20 → '🎯 Crítico Perfeito!'`, `d20=1 → '💀 Falha Crítica'`
4. Adiciona eventos ao `COMBATE_LOG` (critico + ataque)
5. Define `COMBATE._pendingTrigger = true`
6. Exibe botão "Ir ao Mapa" (`#atk-btn-ir-mapa`)

---

#### `atkDelegarAoMestre()` (linhas ~3128–3167)

Cria entry de delegação (`ap_<timestamp>`) na tabela `criativos` quando o jogador não tem fórmula definida e prefere que o mestre decida o dano.

- Persiste fórmula sugerida do builder: `"[Delegado] ${h.nome} — fórmula sugerida: ${formulaStr}"`
- Mestre → `abrirModalCriativoMestre(id)` direto
- Jogador → `criativoIniciarPolling(id)` + step `'pendente'`
- Broadcast `'aguardando_aprovacao'` para notificar todos

---

#### `_atkAplicarDanoFinal()` (linhas ~3170–3349)

Função async central de aplicação de dano após rolagem.

**Guard:** `COMBATE._jaAplicado` evita dupla aplicação.

**Roteamento de dano:**

| `tipo_dano` | Comportamento |
|---|---|
| `cura` | `atkAplicarCura()` por alvo |
| `suporte` / `buff` | Pula dano (apenas efeitos extras) |
| Outros | `atkAplicarDano()` por alvo |

**Efeitos bônus:**
- Usa `determinarAlvoEfeito(ef, h, atacanteNome, alvosAtaque)` para targeting determinístico (BUG-07 FIX)
- Aplica cada efeito via `atkAplicarEfeitoComRecuperacao()`
- Loga cada efeito em `COMBATE_LOG`

**Cooldowns:** Armazena `h.id → h.cooldown_turnos` em `AR.estado.cooldowns` (arena) ou `MAPA_STATE.batalhas[id].cooldowns` (campanha) + `salvarEstadoBatalha`.

**Log e broadcast:**
- Formato diferenciado suporte puro vs dano/cura
- Toast de sucesso com valor de dano/cura e efeitos
- Broadcast `'ataque_executado'` com atacante, alvo, dano, habilidade, efeitos

**Lifecycle de criativo:**
- Marca `CRIATIVOS_CAMP[idx].status = 'concluido'` + PATCH no Supabase
- Após 30s: remove do array local + DELETE no banco + `criativoRenderMestre()`
- `criativoStopPolling()` + `CRIATIVO_ID_ATUAL = null`

**Auto-avanço de turno (arena):**

| Papel | Ação |
|---|---|
| Mestre | `arProximoTurnoIniciativa()` |
| Jogador | Avança `ini.ordemAtual`, pula vinculados, incrementa round, `arSalvarEstado()` |

Ao final: abre `abrirModalCriticoMestre()` se `COMBATE._ehCritico` e é mestre.

---

#### `acaoEmpurrar(atacanteNome, alvoNome, batalhaId)` (linhas ~3355–3411)

Ação de combate: Empurrar / Arremessar (VOL II v2.1).

**Mecânica:**
- Disputa de Força: `d20 + Força` de cada lado
- Atacante vence → move o alvo 2 células na direção `atacante→alvo`
- Colisão com parede (`paredeBloqueiaMovimento`) → `1d6` de dano de impacto

**Resultado:**
- Atualiza `alvo.map_positions[mapId] = { col, row }` + PATCH Supabase
- Broadcast `'empurrao_executado'` com nova posição
- Re-renderiza tokens via `mapaRenderTokens()`
- Verifica superfície via `superficieVerificarEntrada()`

---

#### Handlers Realtime (linhas ~3417–3490)

##### `window.batalhaReceberLinhaRemota(rec)`

Receptor de atualizações de estado de batalha via WebSocket/Realtime:

1. Parseia `rec.estado` (string JSON → objeto)
2. Atualiza `MAPA_STATE.batalhas[rec.batalha_id]`
3. Se é a batalha ativa: re-renderiza ações (`_mesaRenderAcoes`), iniciativa (`_mesaRenderIniciativa`) e status (`mapaRenderStatus`)

##### `window.criativoReceberLinhaRemota(rec)`

Receptor de atualizações de ações criativas via Realtime:

1. Upsert em `CRIATIVOS_CAMP` (atualiza se existe, adiciona se novo)
2. Se mestre: `criativoRenderMestre()` + `_mesaRenderAcoes()` (atualiza contador de pendentes)

##### `window.batalhaReceberEstadoRemoto(estadoBatalha)` (linhas ~3496–)

Handler adicional de broadcast para estado de batalha via `rpg_registry` — partial.

> ⚠ Análise até linha 3500. Próximo batch começa na linha 3501.

---

### Batch 7 — Linhas 3501–4000

#### `window.animReceberBroadcast(payload)` (linhas ~3507–3514)

Receptor de broadcast de animações de ataque; delega para `executarAnimacaoAtaque(payload)` se existir.

---

#### `window.tokenMoveReceber(payload)` (linhas ~3516–3535)

Receptor de broadcast de movimento de token:

- Atualiza `char.map_positions[mapId] = { col, row }` no state local
- Se `MAPA_STATE.mapaAtualId === payload.mapId` → `mapaRenderTokens(entry.mapa)`

---

#### `window.combateReceberBroadcast(payload)` (linhas ~3537–3928)

Handler central de broadcast de combate. Estruturado em 3 fases de prioridade:

**FASE 1 — Handlers Críticos:**

| `payload.tipo` | Ação |
|---|---|
| `fase_mudou` | `bs.fase = fase`; triggers: `_aplicarEstadoBatalhaUI`, `batalhaRenderFaseIniciativa`, `_mesaRenderAcoes`, `_mesaRenderIniciativa` |
| `personagem_caiu` | `char.hp_atual = 0`, `moribundo = true`; re-renderiza status e personagens |
| `personagem_morto` | `morto = true`, `moribundo = false`; re-renderiza + `batalhaRenderOrdemStrip` |
| `personagem_estabilizou` | `moribundo = false`, `estabilizado = true`, limpa `salvaguardas`; re-renderiza |

**FASE 2 — Handlers Importantes:**

| `payload.tipo` | Ação |
|---|---|
| `batalha_pausada` | `bs.pausada = payload.pausada`; re-renderiza ações |
| `batalha_vitoria` | `mostrarTelaVitoria(stats, rounds)` + toast `'🎉 Vitória!'` |
| `ataque_oportunidade` | Re-renderiza ações |

**FASE 3 — Handlers Visuais/UX:**

| `payload.tipo` | Ação |
|---|---|
| `dados_rolados` | `executarAnimacaoDados(payload)` |
| `efeito_aplicado` | Toast com `payload.descricao` |
| `trigger_mostrar` | `mostrarTriggerVisual(payload)` |
| `trigger_ocultar` | `ocultarTriggerVisual()` |

**Handlers Legados (mantidos):**

| `payload.tipo` | Ação |
|---|---|
| `dano_aplicado` | `mapaRenderStatus()` |
| `turno_mudado` | `_mesaRenderAcoes()` + `_mesaRenderIniciativa()` |
| `habilidade_usada` | `_mesaRenderAcoes()` |
| `iniciativa_rolada` | Atualiza `bs.iniciativasRoladas[nome]` e `participante.iniciativa`; re-renderiza |
| `batalha_criada` | Adiciona ao `MAPA_STATE.batalhas`; triggers badge/seletor/UI |
| `batalha_estado` | Atualização bulk: `fase`, `participantes`, `iniciativasRoladas`, `empatados`, `ordemAtual`, `turnoRound` |
| `vez_passou` | Atualiza `ordemAtual`/`turnoRound`; re-renderiza `ordemStrip`, `vezLabel`, ações, iniciativa |
| `batalha_encerrada` | Remove de `MAPA_STATE.batalhas`; limpa `BATALHA_ATUAL_ID`; re-renderiza badge/seletor/UI |

---

#### Realtime — Inventário, Moedas e Loot (linhas ~3932–4000)

##### `window.inventarioReceberAtualização(rec, ev)`

Upsert/delete em `INVENTARIO_CACHE`; chama `renderInventario`, `renderEquipamentos`, `atualizarInventarioUI`.

##### `window.moedasReceberAtualização(rec, ev)`

Upsert/delete em `MOEDAS_CACHE`; chama `atualizarDisplayMoedas`, `renderMoedas`.

##### `window.lootReceberAtualização(rec, ev)` (partial)

Upsert/delete em `LOOT_CACHE`; deleta se `ev === 'DELETE'` ou `rec.saqueado === true`.

> ⚠ Análise até linha 4000. Próximo batch começa na linha 4001.

---

### Batch 8 — Linhas 4001–4321 (Final)

#### `lootReceberAtualização()` — conclusão (linhas ~4001–4010)

Após upsert em `LOOT_CACHE`: chama `renderBaus()` e `atualizarMapaLoot()` para re-renderizar baús no mapa.

---

#### `window.mercadoReceberAtualização(rec, ev)` (linhas ~4012–4030)

Upsert/delete em `MERCADO_CACHE`; chama `renderMercado()`.

#### `window.tradesReceberAtualização(rec, ev)` (linhas ~4032–4054)

Upsert/delete em `TRADES_CACHE`; chama `renderTrades()` e `atualizarTradesUI()`.

#### `window.itemCatalogReceberAtualização(rec, ev)` (linhas ~4056–4078)

Upsert/delete em `ITEMS_CATALOG` (catálogo global de itens); chama `renderCatalogo()` e `renderItemCatalog()`.

---

#### `window.pausarOuRetomarBatalha()` (linhas ~4092–4143)

Toggle pause/resume da batalha ativa:

1. Valida `BATALHA_ATUAL_ID`
2. Inverte `bs.pausado`
3. PATCH em `batalhas?batalha_id=eq.X` com estado completo
4. Toast: `'⏸ Batalha pausada'` ou `'▶ Batalha retomada'`
5. Re-renderiza ações (`_mesaRenderAcoes`) e status (`mapaRenderStatus`)

---

#### `window.encerrarBatalha()` (linhas ~4149–4209)

Encerra batalha com confirmação:

1. `confirm()` antes de prosseguir
2. DELETE em `batalhas?batalha_id=eq.X`
3. Remove de `MAPA_STATE.batalhas`
4. Limpa `BATALHA_ATUAL_ID = null`
5. Toast + re-renderiza ações/iniciativa/status
6. Broadcast `'batalha_encerrada'` para os outros jogadores

---

#### `window.batalhaJogarPorOffline()` (linhas ~4217–4256)

Permite ao mestre jogar pelo personagem de um jogador offline:

- Valida `fase === 'combate'`
- Define `TOKEN_CTRL.nomeSelecionado = atual.nome` (personagem da vez)
- Toast de aviso e re-renderiza ações com habilidades do personagem offline

---

#### Auto-avanço de Turno (linhas ~4264–4319)

Sistema de timer para avanço automático de turno após ataque.

##### `_timerAutoAvanco` (global)

`let _timerAutoAvanco = null` — referência ao `setTimeout` ativo.

##### `_finalizarAtaqueCampanha()`

Chamada ao concluir ataque em campanha:
- Re-renderiza UI (ações + status)
- Inicia `iniciarTimerAutoAvanco()`

##### `iniciarTimerAutoAvanco()`

1. Cancela timer anterior se existente
2. Toast: `'Turno avançará em 5s... (clique Pular para cancelar)'`
3. `setTimeout(5000)` → chama `batalhaPassarVez()` e limpa `_timerAutoAvanco`

##### `cancelarTimerAutoAvanco()`

`clearTimeout(_timerAutoAvanco)` + `_timerAutoAvanco = null`. Exportado como `window.cancelarTimerAutoAvanco` para uso no botão "Pular".

---

## 25. `js/app.js`

**Linhas:** 1  
**Descrição geral:** Arquivo placeholder. Contém apenas a string `aaa` — sem código funcional.

### Funções definidas

*Nenhuma.*

### Variáveis/constantes definidas

*Nenhuma.*

### Dependências externas

*Nenhuma.*

---

## 26. `js/ui/modals.js`

**Linhas:** 2591  
**Descrição geral:** Dois grandes sistemas independentes concatenados em um arquivo:
1. **Sistema de Informações Secretas do Mercado** (linhas 1–295): CRUD para itens do tipo `informacao` no mercado, compra com débito de moedas e visualização de conteúdo secreto adquirido.
2. **PixiParticles Plugin v7** (linhas 297–2591): IIFE que implementa um motor Canvas 2D de partículas com suporte a formas customizadas, efeitos de raio, trajetórias, decals com fade, preview embutido no painel de habilidades, e patches em funções globais de animação e salvamento.

---

### Parte 1 — Sistema de Informações Secretas do Mercado (linhas 1–295)

#### `mercadoSelecionarTipo(tipo)` (linha 11)

Alterna a exibição dos formulários de item e informação no painel do mercado.  
Se `tipo === 'informacao'`, popula o `<select>` de denominações chamando `_mercDenoms()` caso esteja vazio.

| Dependência | Tipo | Origem |
|---|---|---|
| `_mercDenoms()` | função | externo (inventory/mercado) |

---

#### `mercadoCriarInformacao()` (linha 42) — async

Cria um item do tipo `informacao` no mercado (apenas mestre). Lê o formulário, faz POST em `mercado`, atualiza `MERCADO_STATE.todos` e limpa o formulário.

| Dependência | Tipo | Origem |
|---|---|---|
| `_isMestre()` | função | externo |
| `mostrarToast()` | função | externo |
| `sb()` | função | `js/core/supabase.js` |
| `MERCADO_STATE` | objeto global | externo (inventory.js) |
| `_mercRpgId()` | função | externo |
| `renderMercadoItens()` | função | externo (inventory.js) |
| `_limparFormularioInformacao()` | função | local |

---

#### `_limparFormularioInformacao()` (linha 84)

Limpa os campos do formulário de criação de informação. Sem dependências externas.

---

#### `confirmarCompraInfo(rowId, preco, denom)` (linha 92)

Exibe `confirm()` antes de chamar `comprarInformacao()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto global | externo |
| `comprarInformacao()` | função | local |

---

#### `comprarInformacao(rowId, preco, denom)` (linha 105) — async

Fluxo completo de compra de informação secreta:
1. Valida personagem (`_mercCharId`)
2. Verifica saldo via SELECT em `moedas`; debita com `_moedaUpsert`
3. Registra compra em `informacoes_compradas`; reverte débito em caso de erro
4. Decrementa `estoque_atual` via PATCH em `mercado`
5. Chama `_moedaLog` e exibe `mostrarInformacaoAdquirida`

| Dependência | Tipo | Origem |
|---|---|---|
| `_mercCharId()` | função | externo |
| `_mercRpgId()` | função | externo |
| `sb()` | função | `js/core/supabase.js` |
| `MERCADO_STATE` | objeto global | externo |
| `_moedaUpsert()` | função | externo (inventory.js) |
| `_moedaLog()` | função | externo (inventory.js) |
| `mostrarToast()` | função | externo |
| `renderMercadoItens()` | função | externo |
| `mostrarInformacaoAdquirida()` | função | local |
| `_mercAtualizarSaldo()` | função | externo |

---

#### `mostrarInformacaoAdquirida(nome, conteudo)` (linha 167)

Cria e injeta no `<body>` um modal full-screen exibindo o conteúdo secreto adquirido.

| Dependência | Tipo | Origem |
|---|---|---|
| `mostrarToast()` | função | externo |

---

#### `verInformacoesCompradas()` (linha 185) — async

Consulta `informacoes_compradas` para o personagem atual e exibe lista de informações já compradas em um modal. Clicar em um item chama `mostrarInformacaoAdquirida`.

| Dependência | Tipo | Origem |
|---|---|---|
| `_mercCharId()` | função | externo |
| `_mercRpgId()` | função | externo |
| `sb()` | função | `js/core/supabase.js` |
| `mostrarToast()` | função | externo |
| `mostrarInformacaoAdquirida()` | função | local |

---

#### IIFE `_patchRenderMercadoItens()` (linha 228)

Monkey-patch de `window.renderMercadoItens`: quando o filtro de tipo for `'informacao'`, renderiza grade própria com cartões de informações e botões de compra. Para outros filtros, delega ao handler original.

| Dependência | Tipo | Origem |
|---|---|---|
| `window.renderMercadoItens` | função | externo (inventory.js) — substituída |
| `_isMestre()` | função | externo |
| `MERCADO_STATE` | objeto global | externo |
| `confirmarCompraInfo()` | função | local |
| `mercadoEditarItem()` | função | externo |

---

### Parte 2 — PixiParticles Plugin v7 — IIFE (linhas 302–2582)

#### Variáveis de módulo (IIFE)

| Variável | Tipo | Descrição |
|---|---|---|
| `PIXI_TYPE` | constante | `'pixi_particles'` — identificador do tipo de animação |
| `DECAL_CANVAS` | var | Canvas persistente para decalques |
| `DECAL_CTX` | var | Contexto 2D do canvas de decalques |
| `DECAL_ITEMS` | array | Lista de `{imageData, alpha, x, y, w, h, fadeRate}` |
| `DECAL_RAF` | var | Handle do `requestAnimationFrame` do loop de fade |
| `_previewEng` | var | Engine ativa no preview do painel |
| `_previewRaf` | var | Handle do rAF do preview |

---

#### `_getDecalCanvas()` (linha 313)

Cria (ou retorna) o canvas persistente de decalques, fixado sobre o `<body>`. Sem dependências externas.

---

#### `_clearDecals()` (linha 325)

Limpa `DECAL_ITEMS`, cancela o loop de fade e limpa o canvas. Sem dependências externas.

---

#### `_startDecalFadeLoop()` (linha 334)

Inicia loop rAF que decrementa `alpha` de cada decal proporcionalmente ao delta de tempo (`fadeRate * dt`) e redesenha todos os itens restantes. Para automaticamente quando `DECAL_ITEMS` fica vazio. Sem dependências externas.

---

#### `_executeCustomShapeCode(code, ctx, size, progress)` (linha 379)

Executa código de desenho Canvas 2D fornecido pelo usuário via `new Function()`. Injeta `ctx`, `size`, `progress` e funções do `Math`. Sem dependências externas.

---

#### `CUSTOM_SHAPES` — formas pré-definidas (linha 399)

Objeto com funções de desenho Canvas 2D. Todas recebem `(ctx, size, progress)`.

| Chave | Descrição |
|---|---|
| `lightning_bolt` | Raio zigzag com brilho interno |
| `electric_chain` | Corrente elétrica ondulada com elos brilhantes |
| `electric_arc` | Arco bezier com faíscas ao longo da curva |
| `plasma_ball` | Núcleo + 8 raios irradiantes irregulares |
| `spark` | Cruz brilhante com núcleo branco |
| `dragon_head` | Cabeça de dragão estilizada (mandíbulas + olho) |
| `fist` | Punho de energia com palma, dedos e brilho |
| `blade` | Lâmina/espada com guarda, cabo e rastro de movimento |
| `flame` | Chama tri-camadas (vermelho → laranja → amarelo) |
| `claw` | 3 garras/raízes convergentes com base circular |

---

#### `class PixiParticleEngine` (linha 790)

Motor Canvas 2D de partículas com suporte a sakuga features.

**Constructor:** `constructor(canvas, config, emitterPos)`  
Inicializa estado interno e chama `_parse()`.

##### Métodos internos

| Método | Descrição |
|---|---|
| `_parse()` | Lê `this.cfg` e define todas as propriedades do motor (físicas, visuais, recursos sakuga) |
| `_hex(h)` | Converte string hex para `{r,g,b}` |
| `_lerp(a,b,t)` | Interpolação linear |
| `_lerpColor(t)` | Interpola cor entre `colorStart`/`colorMid`/`colorEnd` |
| `_lerpC(a,b,t)` | Interpola dois objetos `{r,g,b}` |
| `_ease(t, curve)` | 7 curvas de easing: `linear`, `easeIn`, `easeOut`, `easeInOut`, `pulse`, `overshoot`, `elastic`, `bounce` |
| `_spawnPos()` | Calcula posição de spawn segundo `spawnType` (`point`/`circle`/`ring`/`rect`/`burst`) |
| `_spawn()` | Cria objeto de partícula com posição, velocidade, rotação e lifetime aleatórios |
| `update(dt)` | Atualiza emissão, física (velocidade, aceleração, turbulência, max speed, stretch&squash), posição, rotação e impact frames |
| `_createDecal(particle)` | Ao morrer, captura imageData em canvas temporário e adiciona a `DECAL_ITEMS` com fade |
| `_drawShape(ctx, shape, size, progress, particle)` | Dispatcher de formas: customShapeCode → customShape → composite → básica |
| `_drawBasicShape(ctx, shape, size, progress)` | Renderiza formas primitivas: `star`, `spark`/`blade`, `diamond`, `square`, `flame`, `circle` |
| `_blendOp(m)` | Mapeia nome de blend mode para operação canvas composite |
| `_renderParticles()` | Renderiza todas as partículas ativas com gradiente radial e camada de glow opcional |
| `draw()` | Limpa canvas e chama `_renderParticles()` |
| `drawNoClear()` | Chama `_renderParticles()` sem limpar |
| `get isAlive` | `true` se há partículas ou emissão ainda ativa |
| `start(onDone)` | Inicia loop rAF; chama `onDone()` quando `isAlive` torna-se falso |
| `stop()` | Cancela o rAF |

`_createDecal` depende de `_getDecalCanvas()` e `_startDecalFadeLoop()` (locais da IIFE).

---

#### `_injetarUI()` (linha 1365)

Injeta opção `'✨ Pixi Particles (IA Sakuga)'` no select de tipos de animação e insere painel de configuração completo no modal de skills (textarea de JSON, selects de posição/visual, botão de prompt, campo de preview canvas). Sem dependências externas.

---

#### `window.skAnimPixiPosicaoChange` (linha 1461)

Mostra/oculta o select de tipo de trajetória quando a posição escolhida é `'trajetoria'`. Sem dependências externas.

---

#### `window.skAnimTipoChange` (linha 1471) — patch

Estende o handler original de troca de tipo: quando `tipo === PIXI_TYPE`, oculta painéis canvas/mídia e exibe o painel pixi; caso contrário, delega ao original.

| Dependência | Tipo | Origem |
|---|---|---|
| `window.skAnimTipoChange` | função | externo (skills.js) — substituída |
| `skAnimPixiPosicaoChange()` | função | local |

---

#### `window.skAnimPixiGerarPrompt` (linha 1492)

Constrói um prompt extenso para IA externa (SAKUGA VFX) baseado nos campos do formulário. O prompt varia conforme `posicao`: inclui seção de raio contínuo, trajetória em arco ou reta, ou efeito fixo. Exibe o resultado num textarea readonly.

Sem dependências externas de runtime (acessa apenas DOM).

---

#### `window.skAnimPixiCopiarPrompt` (linha 1739)

Copia o prompt gerado para o clipboard via `navigator.clipboard` (fallback: `execCommand`). Sem dependências externas.

---

#### `window.skAnimPixiOnJsonChange` (linha 1752)

Valida o JSON no textarea de config pixi em tempo real; exibe mensagem de erro inline. Sem dependências externas.

---

#### `_drawPreviewMarkers(ctx, OX, OY, TX, TY)` (linha 1771)

Desenha círculos de marcação de origem (azul) e alvo (vermelho) no canvas de preview. Sem dependências externas.

---

#### `window.skAnimPixiPreviewPlay` (linha 1794)

Executa o preview da animação no canvas embutido do painel. Suporta três modos:
- **`raio`**: usa `_adaptarLayerParaRaio()`, loop contínuo que aponta motores para o alvo
- **`trajetoria`**: usa `_adaptarLayerParaTrajetoria()`, emissores seguem curva bézier ou linha reta; a ~88% do percurso dispara burst de impacto
- **fixo**: multi-layer loop que reinicia ao completar

| Dependência | Tipo | Origem |
|---|---|---|
| `PixiParticleEngine` | classe | local |
| `_adaptarLayerParaRaio()` | função | local |
| `_adaptarLayerParaTrajetoria()` | função | local |
| `_drawPreviewMarkers()` | função | local |

---

#### `_adaptarLayerParaTrajetoria(layerCfg, origem, alvo, totalMs, canvasRef, tipoTrajetoria)` (linha 2044)

Adapta um layer de partículas para modo trajetória: recalcula `speed`, `lifetime`, `frequency`, `emitterLifetime` e `acceleration` em função da distância e tipo (`arco`/`direta`). Retorna config com `_spreadAngle` extra. Sem dependências externas.

---

#### `_adaptarLayerParaRaio(layerCfg, origem, alvo, totalMs)` (linha 2106)

Adapta um layer para o modo raio contínuo: velocidade calculada para alcançar o alvo em ~0.3s, lifetime curto, frequência alta, emissor sempre ativo. Sem dependências externas.

---

#### `window.salvarSkill` (linha 2139) — patch

Estende o `salvarSkill` original: quando o tipo de animação é pixi, salva o JSON de partículas, chama o original (com tipo temporariamente setado para `'nenhuma'`), localiza o ID da skill recém-criada e faz PATCH em `skills` com o campo `animacao`.

| Dependência | Tipo | Origem |
|---|---|---|
| `window.salvarSkill` | função | externo (skills.js) — substituída |
| `sb()` | função | `js/core/supabase.js` |
| `mostrarToast()` | função | externo |
| `window.RPG_DATA` | objeto global | externo (state.js) |
| `_skCharId()` | função | externo (skills.js) |

---

#### `window.animarAtaque` (linha 2228) — patch

Estende `animarAtaque`: intercepta animações do tipo `pixi_particles` ou `pixi`, calcula posições de origem/alvo a partir dos elementos DOM e chama `_runPixi()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `window.animarAtaque` | função | externo (arena.js ou combat.js) — substituída |
| `_animCentro()` | função | externo (arena.js) |
| `_runPixi()` | função | local |

---

#### `_mkCanvas()` (linha 2249)

Cria canvas full-viewport fixo com `z-index: 8888`, appenda ao `<body>` e retorna o elemento. Sem dependências externas.

---

#### `_runPixi(animacao, origem, alvo, resolve)` (linha 2259)

Roteador principal de execução pixi: limpa decals, determina modo (`raio`/`trajetoria`/fixo) e delega para `_runRaio`, `_runTrajetoria` ou `_runFixo`. Para efeito único de 1 layer no modo fixo, usa `PixiParticleEngine.start()` diretamente.

| Dependência | Tipo | Origem |
|---|---|---|
| `_clearDecals()` | função | local |
| `_runRaio()` | função | local |
| `_runTrajetoria()` | função | local |
| `_runFixo()` | função | local |
| `PixiParticleEngine` | classe | local |
| `_mkCanvas()` | função | local |

---

#### `_runFixo(layers, emPos, durMs, resolve)` (linha 2325)

Executa efeito multi-layer em posição fixa via loop rAF. Cada frame atualiza e desenha todas as engines; resolve após `durMs + 800ms`.

| Dependência | Tipo | Origem |
|---|---|---|
| `PixiParticleEngine` | classe | local |
| `_mkCanvas()` | função | local |

---

#### `_runTrajetoria(layers, origem, alvo, totalMs, tipoTrajetoria, resolve)` (linha 2373)

Executa animação de trajetória (arco bézier ou linha reta). Emissores seguem a posição interpolada; a ~88% do percurso ativa burst de impacto (mais partículas, spread omnidirecional, velocidade aumentada). Resolve após `totalMs + 700ms`.

| Dependência | Tipo | Origem |
|---|---|---|
| `PixiParticleEngine` | classe | local |
| `_mkCanvas()` | função | local |
| `_adaptarLayerParaTrajetoria()` | função | local |

---

#### `_runRaio(layers, origem, alvo, totalMs, resolve)` (linha 2468)

Executa raio contínuo: emissores ficam na `origem` e são direcionados ao ângulo do `alvo` com pequeno spread. Resolve após `totalMs + 400ms`.

| Dependência | Tipo | Origem |
|---|---|---|
| `PixiParticleEngine` | classe | local |
| `_mkCanvas()` | função | local |
| `_adaptarLayerParaRaio()` | função | local |

---

#### `_populatePixiFields()` (linha 2526)

Ao abrir o modal de edição de uma skill que já possui animação pixi, popula todos os campos do formulário (JSON, posição, trajetória, duração, repetição) e ajusta visibilidade dos controles.

| Dependência | Tipo | Origem |
|---|---|---|
| `window.RPG_DATA` | objeto global | externo (state.js) |
| `_injetarUI()` | função | local |
| `window.skAnimTipoChange` | função | local (patch) |
| `skAnimPixiPosicaoChange()` | função | local |

---

#### `window.abrirModalSkill` (linha 2558) — patch

Estende `abrirModalSkill`: injeta UI pixi e popula campos caso a skill tenha animação pixi.

| Dependência | Tipo | Origem |
|---|---|---|
| `window.abrirModalSkill` | função | externo (skills.js) — substituída |
| `_injetarUI()` | função | local |
| `_populatePixiFields()` | função | local |

---

#### `_init()` (linha 2565)

Inicializa o plugin: injeta UI e observa o overlay do modal de skill para re-injetar ao reabrir.

| Dependência | Tipo | Origem |
|---|---|---|
| `_injetarUI()` | função | local |

Chamada via `DOMContentLoaded` ou `setTimeout(800)` dependendo do `document.readyState`.

---

### Globais fora da IIFE (linhas 2584–2591)

#### `window._abrirModalPacote` (linha 2585)

Exibe o modal `#modal-colar-pacote` (definido no HTML). Sem dependências externas.

---

#### Listener de evento (linha 2591)

```js
HUB_EVENTS.on('cena_carregada', () => sessionRenderPainel());
```

| Dependência | Tipo | Origem |
|---|---|---|
| `HUB_EVENTS` | objeto global | `js/core/events.js` |
| `sessionRenderPainel()` | função | externo (maps.js ou hub.js) |

---

## 27. `js/systems/catalog.js` *(linhas 1–500 — Batch 1)*

**Linhas totais:** 9233  
**Descrição geral:** Arquivo de maior volume do projeto. Contém quatro grandes sistemas independentes:
1. **Mapa BG Tabs** (linhas 1–366): quatro modos de fundo para novos mapas (URL, upload, SVG/IA, canvas de pintura).
2. **Canvas Editor — nmce** (linhas 368–719): editor de imagem Canvas 2D embutido no modal de mapa (pincel, borracha, fill, formas, layers de cenário isométrico).
3. **APMOD — Aparência de Personagens** (linhas 721–2885): sistema completo de aparência: modelos SVG de criaturas, builder visual por partes, modo imagem/SVG, tints, equipamentos visuais (warp matrix 3D), modal fullscreen.
4. **A1/A2 — Mapeamento de Atributos** (linhas 2886–3055): CRUD e cache de mapeamento de atributos customizados para grupos base (força, destreza, etc.).
5. **I1 — Catálogo de Itens** (linhas 3056–9233): CRUD completo de itens (armas, armaduras, consumíveis, etc.) com filtros, paginação, editor visual, import/export CSV, e integração com inventário.

---

### Bloco 1 — Declarações globais antecipadas (linhas 1–17)

#### `ATTR_MAPPING_CACHE` (linha 7)

Objeto global de cache de mapeamento de atributos. Declarado antes de qualquer função para estar disponível quando `supabase.js` o referencia na fase 0 de `_carregarProgressivo`.

---

#### Stubs preventivos (linhas 11–16)

`tintOverlayHtml` e `_limparNotifCreativo` são declarados como funções vazias no escopo global caso ainda não existam, evitando `ReferenceError` enquanto `catalog.js` não terminou de inicializar.

---

### Bloco 2 — Mapa BG Tabs (linhas 18–366)

#### `nmBgTab(tab)` (linha 28)

Alterna a aba ativa de fundo do novo mapa entre `url`, `upload`, `svg` e `canvas`. Atualiza estilos dos botões e painéis. Quando `tab === 'canvas'` inicia o editor de canvas e tenta carregar `render_data` do mapa em edição.

| Dependência | Tipo | Origem |
|---|---|---|
| `nmceInit()` | função | local |
| `nmceUpdateIsoGuide()` | função | local |
| `nmceCarregarRenderData()` | função | local |
| `nmceFullscreenAbrir()` | função | local |
| `MAPA_STATE` | objeto global | externo (maps.js) |
| `RPG_DATA` | objeto global | externo (state.js) |

---

#### `nmBgGetFinal()` (linha 55)

Retorna a URL ou DataURL final do fundo do mapa conforme a aba ativa (`_nmBgTab`). Para a aba `canvas` chama `nmceExport()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `nmceExport()` | função | local |

---

#### `nmceFullscreenAbrir()` (linha 64)

Abre o canvas editor em modo fullscreen: move o elemento `<canvas>` e os overlays SVG de parede/snap para dentro do overlay fullscreen. Sincroniza controles de cor e tamanho entre o modal normal e o fullscreen.

| Dependência | Tipo | Origem |
|---|---|---|
| `nmceUpdateIsoGuide()` | função | local |

---

#### `nmceFullscreenFechar()` (linha 95)

Fecha o fullscreen sem salvar nada, restaurando o canvas ao painel original.

| Dependência | Tipo | Origem |
|---|---|---|
| `_nmceRestaurarCanvas()` | função | local |

---

#### `nmceFullscreenConcluir()` (linha 102)

Conclui a edição no fullscreen: se o contexto for `'ar-cen'` (cenário de arena), salva o dataURL e retorna; caso contrário sincroniza controles de volta para o modal, chama `_nmceSalvarRenderData()` e restaura o canvas.

| Dependência | Tipo | Origem |
|---|---|---|
| `nmceExport()` | função | local |
| `_nmceSalvarRenderData()` | função | local |
| `_nmceRestaurarCanvas()` | função | local |

---

#### `_nmceRestaurarCanvas()` (linha 132)

Move o `<canvas>` e os overlays SVG de parede/snap de volta para o painel original dentro do modal. Sem dependências externas.

---

#### `nmBgUrlPreview(val)` (linha 149)

Exibe ou oculta o preview de imagem de fundo por URL; normaliza a URL via `normalizeImgUrl()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `normalizeImgUrl()` | função | externo |

---

#### `nmBgUpload(input)` async (linha 158)

Lê o arquivo selecionado e faz upload para o Storage via `uploadToStorage()`. Atualiza preview e remove aviso de tamanho.

| Dependência | Tipo | Origem |
|---|---|---|
| `mostrarToast()` | função | externo |
| `uploadToStorage()` | função | externo |

---

#### `nmBgClearUpload()` (linha 176)

Limpa o estado de upload (`_nmUploadDataUrl = null`) e restaura labels e preview. Sem dependências externas.

---

#### `_NM_SVG_PROMPT` const (linha 187)

String de prompt genérico para geração de mapas SVG com IA. Inclui instruções detalhadas para mapa geral (top-down ortogonal) e mapa local (dimétrico estilo Diablo 3), além de requisitos técnicos obrigatórios. Usada por `nmCopiarPromptSVG()`.

---

#### `nmBgSvgPreview(val)` (linha 245)

Valida a string SVG colada pelo usuário: verifica se começa com `<svg`, calcula tamanho em KB e exibe aviso. Renderiza preview inline (sanitizando scripts e handlers de evento) e converte para dataURL base64.

Sem dependências externas.

---

#### `nmCopiarPromptSVG()` (linha 287)

Copia `_NM_SVG_PROMPT` para o clipboard via `navigator.clipboard` (fallback `execCommand`). Atualiza temporariamente o label do botão para confirmar cópia. Sem dependências externas.

---

#### `nmCopiarPromptContextual()` (linha 299)

Monta um prompt SVG contextual enriquecido com: tipo de mapa atual, detalhes de perspectiva, descrição fornecida pelo usuário e lista de mapas já existentes na campanha. Copia para clipboard.

| Dependência | Tipo | Origem |
|---|---|---|
| `mostrarToast()` | função | externo |
| `RPG_DATA` | objeto global | externo (state.js) |
| `CURRENT_RPG` | objeto global | externo (state.js) |

---

### Bloco 3 — Canvas Editor (nmce) (linhas 368–500)

#### `nmCE` const (linha 373)

Objeto de estado do canvas editor: ferramenta ativa, flag de desenho, coordenadas, histórico (snapshots ImageData), snapshot temporário de shapes, dataURL de fundo, e dados de cenário (`renderData`: paredes, portas, objetos).

---

#### `nmceInit()` (linha 385)

Inicializa o canvas editor apenas uma vez por canvas (guarda por `_nmceInited`). Chama `nmceBgRender()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `nmceBgRender()` | função | local |

---

#### `nmceBgRender()` (linha 392)

Renderiza o fundo do canvas: se há imagem de referência (`nmCE._uploadDataUrl`), carrega e desenha; caso contrário preenche com cor escura. Preserva o conteúdo desenhado sobre o fundo. Sem dependências externas.

---

#### `nmceBgLoad(input)` (linha 411)

Lê arquivo de imagem via `FileReader` e o define como fundo de referência, recompondo o canvas preservando os desenhos existentes. Sem dependências externas.

---

#### `nmceSetTool(t)` (linha 433)

Define a ferramenta ativa do canvas editor. Atualiza estilos de todos os botões (normal e fullscreen), cursor do canvas, visibilidade do painel de cenário e hints de fullscreen. Limpa o primeiro ponto de snap ao trocar ferramenta.

Sem dependências externas.

---

#### `nmcePickColor(hex)` (linha 480)

Sincroniza a cor selecionada nos inputs do modal e do fullscreen. Sem dependências externas.

---

#### `nmcePushHistory()` (linha 487)

Salva snapshot `ImageData` do canvas no histórico de undo (máximo 20 entradas, descarta o mais antigo). Sem dependências externas.

---

#### `nmceUndo()` (linha 495)

Restaura o último snapshot do histórico de undo no canvas. Sem dependências externas.

---

## 27. `js/systems/catalog.js` *(linhas 501–1041 — Batch 2)*

### Bloco 3 (continuação) — Canvas Editor (nmce) (linhas 501–719)

#### `nmceClear()` (linha 502)

Empurra snapshot para o histórico e limpa o canvas por inteiro, depois re-renderiza o fundo via `nmceBgRender()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `nmcePushHistory()` | função | local |
| `nmceBgRender()` | função | local |

---

#### `nmceExport()` (linha 511)

Exporta o conteúdo do canvas como dataURL PNG via `toDataURL('image/png')`. Sem dependências externas.

---

#### `nmceCoords(e, c)` (linha 518)

Converte coordenadas de um evento `MouseEvent` ou `TouchEvent` para o espaço de pixels interno do canvas, levando em conta escala CSS (`getBoundingClientRect`). Sem dependências externas.

---

#### `nmceDown(e)` (linha 526)

Handler de `mousedown`/`touchstart`. Para ferramentas de cenário (`parede`, `porta`, `objeto`) delega a `_nmceSceneClick()`. Para `fill` empurra histórico e executa `nmceFill()`. Para formas (`linha`, `rect`, `circulo`) salva snapshot de início. Para pincel/borracha empurra histórico e desenha ponto inicial.

| Dependência | Tipo | Origem |
|---|---|---|
| `nmceCoords()` | função | local |
| `_nmceSceneClick()` | função | local |
| `nmcePushHistory()` | função | local |
| `nmceFill()` | função | local |

---

#### `nmceMove(e)` (linha 563)

Handler de `mousemove`/`touchmove`. Exibe indicador de snap quando a ferramenta é parede. Em modo de desenho: traça linhas para pincel/borracha ou renderiza preview do shape (linha, rect, círculo) restaurando o snapshot temporário a cada frame.

| Dependência | Tipo | Origem |
|---|---|---|
| `nmceCoords()` | função | local |
| `_nmceSnapPonto()` | função | local |
| `_nmceShowSnapIndicator()` | função | local |

---

#### `nmceUp(e)` (linha 618)

Handler de `mouseup`/`touchend`. Commita o shape no canvas (empurra histórico e redesenha o shape final sobre o snapshot temporário). Sem dependências externas além das variáveis de estado `nmCE`.

---

#### `nmceTDown(e)` / `nmceTMove(e)` (linha 646)

Wrappers touch que chamam `preventDefault()` antes de delegar para `nmceDown`/`nmceMove`, evitando scroll da página durante o desenho. Sem dependências externas.

---

#### `nmceFill(ctx, startX, startY, hexColor)` (linha 650)

Flood fill BFS pixel-a-pixel com limite de 200 000 iterações. Amostra a cor do pixel de origem e substitui todos os pixels adjacentes com a mesma cor pela cor de destino.

| Dependência | Tipo | Origem |
|---|---|---|
| `_nmceHex2rgb()` | função | local |

---

#### `_nmceHex2rgb(hex)` (linha 676)

Converte string hex (`#rrggbb`) para array `[r, g, b]`. Sem dependências externas.

---

#### `_drawIsoGrid(ctx, W, H, grid, color)` (linha 688)

Desenha grade de losangos isométricos 2:1 sobre o canvas. Traça duas famílias de linhas paralelas (NE e NW) espaçadas por `grid` pixels, cobrindo todo o canvas. Usado por sistemas de mapa e canvas editor.

Sem dependências externas.

---

#### `nmceUpdateIsoGuide()` (linha 715)

Stub vazio mantido para compatibilidade de chamadas (grade ISO foi removida). Sem dependências externas.

---

### Bloco 4 — APMOD: Dados e Modelos (linhas 721–828)

#### `APMOD_PARTS` var (linha 725)

Objeto global com arrays de partes visuais por categoria (`cabelo`, `rosto`, `camisa`, `calca`, `sapato`). Populado externamente (dados SVG de partes).

---

#### `CHAR_JSON_TEMPLATES` var (linha 732)

Array global de templates prontos de personagem para o modal de aparência. Populado externamente.

---

#### `EQUIP_SLOT_LIMITS` const (linha 733)

Mapa de limites de tamanho (px) por slot de equipamento visual: `arma_1m`, `arma_2m`, `escudo`, `elmo`, `capa`, `amuleto`, `anel`, `arco`, `lanca`, `geral`.

---

#### `CREATURE_MODELS` const (linha 740)

Objeto com modelos SVG layer de criaturas/NPCs. Cada entrada tem `label` e dois métodos que recebem a cor base (`c`) e retornam SVG inner content:
- `head(c)` — para viewBox `"2 2 28 24"` (tokens de mapa geral)
- `iso(c)` — para viewBox `"0 0 32 52"` (tokens de mapa local/combat)

Modelos disponíveis: `npc_generico`, `goblin`, `esqueleto`, `lobo`, `dragao`, `aranha`, `slime`, `demonio`.

Usa `_hexDarken2()` (helper local declarado logo abaixo) para gerar tons derivados da cor base.

---

#### `_hexDarken2(hex, a)` (linha 807)

Helper de escurecimento de cor hex para uso interno de `CREATURE_MODELS` (declarado logo após o objeto para garantir disponibilidade sem dependência de `_hexDarken`). Subtrai `a` de cada canal RGB. Sem dependências externas.

---

#### `_hexDarken(hex, amount)` (linha 810)

Versão alternativa de escurecimento de cor hex usada pelas funções de render APMOD. Subtrai `amount` de cada canal RGB. Sem dependências externas.

---

#### `_svgPart(template, c, c2)` (linha 821)

Substitui placeholders `{c}` e `{c2}` em um template SVG de parte APMOD pela cor primária e secundária. Sem dependências externas.

---

### Bloco 5 — APMOD: Renderização de Tokens (linhas 829–913)

#### `apmodRenderFront(aparencia, corBase)` (linha 830)

Gera SVG de frente completo de um personagem (viewBox `0 0 32 68`, 128×272 px) compondo as partes APMOD na ordem: camisa → calça → sapato → pescoço (pele) → rosto → cabelo.

| Dependência | Tipo | Origem |
|---|---|---|
| `APMOD_PARTS` | objeto global | local |
| `_svgPart()` | função | local |
| `_hexDarken()` | função | local |

---

#### `apmodRenderIso(aparencia, corBase)` (linha 831)

Gera SVG isométrico (viewBox `0 0 32 56`, 128×224 px) com as mesmas partes APMOD em perspectiva isométrica.

| Dependência | Tipo | Origem |
|---|---|---|
| `APMOD_PARTS` | objeto global | local |
| `_svgPart()` | função | local |
| `_hexDarken()` | função | local |

---

#### `apmodRenderHead(aparencia, corBase)` (linha 832)

Gera SVG apenas da cabeça (viewBox `2 2 28 22`, 80×64 px) para uso em tokens de mapa geral.

| Dependência | Tipo | Origem |
|---|---|---|
| `APMOD_PARTS` | objeto global | local |
| `_svgPart()` | função | local |
| `_hexDarken()` | função | local |

---

#### `apmodTokenSVG(char, tipoMapa)` (linha 834)

Roteador principal de renderização de token de personagem para o mapa. Seleciona a saída conforme o tipo de personagem e modo de aparência:
- **criatura + imagem**: `<img>` com dimensões escaladas por `tamanhoFator`
- **criatura + svg**: SVG inline com width/height reescritos
- **criatura (fallback)**: `CREATURE_MODELS[modelo].iso/head(cor)`
- **npc sem aparência**: `CREATURE_MODELS.npc_generico`
- **jogador + imagem/svg**: `<img>` ou SVG com tamanho ajustado
- **jogador + builder/json**: `apmodRenderIso()` ou `apmodRenderHead()` com dimensões reescritas

| Dependência | Tipo | Origem |
|---|---|---|
| `CREATURE_MODELS` | objeto | local |
| `apmodRenderIso()` | função | local |
| `apmodRenderHead()` | função | local |

---

### Bloco 6 — APMOD: Modal de Aparência (linhas 914–1041)

#### `abrirModalAparencia(nome)` (linha 915)

Abre o modal fullscreen de edição de aparência do personagem. Cria o elemento se não existir, monta HTML completo com: cabeçalho, painel de preview colapsível (preview ISO, token head, mini-token), abas de edição, e botão de salvar. As abas diferem conforme `tipoChar`: para criaturas mostra `criatura`, `svg`, `equip`, `tint`; para jogadores mostra `json`, `builder`, `svg`, `equip`, `tint`.

Após montar, inicializa estado global `_apmodNome`, `_apmodOriginal`, `_apmodTints`, `_apmodEquipsVisuais`, `_apmodCriaturaModelo` e navega para a aba correta memorizando a última usada.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | externo (state.js) |
| `_apmodTabCriatura()` | função | local |
| `_apmodTabSvg()` | função | local |
| `_apmodTabEquip()` | função | local |
| `_apmodTabTint()` | função | local |
| `_apmodTabJson()` | função | local |
| `_apmodTabBuilder()` | função | local |
| `apmodSwitchTab()` | função | local |
| `apmodPreencherBuilder()` | função | local |
| `apmodAtualizarPreview()` | função | local |

---

#### `_apmodTabJson()` (linha 977)

Gera HTML da aba "Templates": grid de botões para templates prontos de personagem. Usa `CHAR_JSON_TEMPLATES`.

| Dependência | Tipo | Origem |
|---|---|---|
| `CHAR_JSON_TEMPLATES` | array global | local |

---

#### `_apmodTabBuilder(aparencia)` (linha 978)

Gera HTML da aba "Criar": input de cor de pele + cinco seções de seleção de partes (cabelo, rosto, camisa, calça, sapato), cada uma com botões de filtro por estilo e grid de partes disponíveis.

| Dependência | Tipo | Origem |
|---|---|---|
| `APMOD_PARTS` | objeto global | local |

---

#### `_apmodTabSvg(ap)` (linha 979–1041)

Gera HTML da aba "SVG/Imagem": botões de prompt (frente e ISO), painel de upload de imagem real (URL ou arquivo), e seção colapsível de SVG manual (textareas para frente e iso, campo de paste JSON da IA).

Sem dependências externas de runtime (acessa apenas o objeto `ap` passado).

---

## 27. `js/systems/catalog.js` *(linhas 1042–1598 — Batch 3)*

### Bloco 6 (continuação) — APMOD: Controles do Modal (linhas 1042–1302)

#### `_apmodTabCriatura(aparencia, cor)` (linha 1043)

Gera HTML da aba "Modelo" para criaturas: seletor de cor + grid de botões com preview SVG para cada modelo de `CREATURE_MODELS`. O modelo atual fica com borda destacada.

| Dependência | Tipo | Origem |
|---|---|---|
| `CREATURE_MODELS` | objeto | local |

---

#### `apmodTogglePreviewPanel()` (linha 1045)

Anima abertura/fechamento do painel de preview no topo do modal APMOD usando `maxHeight` CSS para transição suave. Atualiza a seta indicadora de estado. Sem dependências externas.

---

#### `apmodSwitchTab(tab, btn)` (linha 1074)

Troca a aba visível no modal APMOD: oculta todos os `apmod-tab-content`, desfaz destaque de todos os botões, exibe a aba `tab` e destaca `btn`. Memoriza a última aba em `window._apmodLastTab`. Quando `tab === 'tint'` inicializa o sistema de tints com `setTimeout`.

| Dependência | Tipo | Origem |
|---|---|---|
| `apmodTintIniciar()` | função | local |
| `apmodTintAtualizarPreview()` | função | local |

---

#### `apmodFiltrarEstilo(tipo, estilo, btn)` (linha 1078)

Filtra o grid de partes de um tipo pelo atributo `estilo`: oculta botões cuja parte não corresponde ao estilo selecionado; destaca o botão de filtro clicado.

| Dependência | Tipo | Origem |
|---|---|---|
| `APMOD_PARTS` | objeto | local |

---

#### `apmodSelecionarParte(tipo, id, btn)` (linha 1079)

Marca a parte selecionada no grid (estilo ativo) e dispara `apmodAtualizarPreview()`. Seta `_apmodOriginalStale = true` para indicar mudança na aba base.

| Dependência | Tipo | Origem |
|---|---|---|
| `apmodAtualizarPreview()` | função | local |

---

#### `apmodSelecionarCriatura(key, btn)` (linha 1080)

Salva o modelo de criatura escolhido em `window._apmodCriaturaModelo`, destaca o botão e dispara preview.

| Dependência | Tipo | Origem |
|---|---|---|
| `apmodAtualizarPreview()` | função | local |

---

#### `apmodCarregarTemplate(id)` (linha 1081)

Carrega um template de `CHAR_JSON_TEMPLATES` pelo `id`, valida existência de partes e pede confirmação se alguma parte estiver faltando. Chama `apmodPreencherBuilder()`, troca para a aba builder e atualiza preview.

| Dependência | Tipo | Origem |
|---|---|---|
| `CHAR_JSON_TEMPLATES` | array | local |
| `APMOD_PARTS` | objeto | local |
| `mostrarToast()` | função | externo |
| `apmodPreencherBuilder()` | função | local |
| `apmodSwitchTab()` | função | local |
| `apmodAtualizarPreview()` | função | local |

---

#### `apmodPreencherBuilder(aparencia)` (linha 1091)

Popula os controles da aba Builder a partir de um objeto `aparencia`: define cor de pele, simula clique nas peças selecionadas e define as cores por categoria.

Sem dependências externas além de acesso ao DOM.

---

#### `apmodGetBaseAparencia(tipoTab)` (linha 1093)

Extrai o objeto de aparência base (sem `equipamentos_visuais` e `tints`) conforme a aba ativa:
- `svg`: lê URLs/SVGs dos inputs; prefere modo `imagem` se houver URL preenchida
- `criatura`: usa `_apmodCriaturaModelo` e cor do input
- `builder`: coleta partes ativas e cores por categoria
- `json`: usa `window._apmodJsonPartes`

Sem dependências externas além de DOM.

---

#### `apmodGetCurrentAparencia()` (linha 1134)

Coleta o objeto completo de aparência do estado atual da UI, incluindo `equipamentos_visuais` e `tints`. Para abas `equip` e `tint` preserva o base via `apmodGetBaseAparencia(window._apmodLastBaseTab)`. Para as demais abas coleta diretamente do DOM.

| Dependência | Tipo | Origem |
|---|---|---|
| `apmodGetBaseAparencia()` | função | local |

---

#### `apmodFecharModal()` (linha 1178)

Fecha o modal de aparência. Se houver mudanças não salvas (detectadas por comparação JSON com `_apmodOriginal`), exibe `confirm()` antes de fechar.

| Dependência | Tipo | Origem |
|---|---|---|
| `apmodGetCurrentAparencia()` | função | local |

---

#### `apmodAtualizarPreview()` (linha 1191)

Atualiza todos os elementos de preview do modal APMOD: token de cabeça, mini-cabeça da barra de toggle, preview ISO grande, lightbox (se aberto) e mini-preview com tamanho exato do mapa. Para cada preview renderiza camadas de equipamentos visuais (atras/frente) com suporte a warp perspectivo (`_aeqComputeMatrix3d`), rotação, flip horizontal e skew.

| Dependência | Tipo | Origem |
|---|---|---|
| `apmodGetCurrentAparencia()` | função | local |
| `RPG_DATA` | objeto global | externo (state.js) |
| `tintOverlayHtml()` | função | local |
| `CREATURE_MODELS` | objeto | local |
| `apmodRenderHead()` | função | local |
| `apmodRenderIso()` | função | local |
| `_aeqComputeMatrix3d()` | função | local |

---

#### `apmodTogglePreviewGrande(triggerEl)` (linha 1305)

Abre/fecha um lightbox de overlay fullscreen com a arte do personagem em tamanho real (240×360 px). Copia o `innerHTML` do preview ISO (incluindo equipamentos já compostos).

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | externo (state.js) |

---

#### `apmodSharpenImg(imgEl)` (linha 1329)

Aplica `image-rendering: high-quality` via CSS na imagem do token para sharpening. Executa apenas uma vez por elemento (guarda flag `_sharpened`). Sem dependências externas.

---

#### `apmodFileToBase64(input, targetId)` async (linha 1341)

Lê arquivo de imagem do input, faz upload via `uploadToStorage()` e preenche o campo `targetId` com a URL resultante, disparando preview.

| Dependência | Tipo | Origem |
|---|---|---|
| `mostrarToast()` | função | externo |
| `uploadToStorage()` | função | externo |
| `apmodAtualizarPreview()` | função | local |

---

#### `apmodCopiarPromptSvg(tipo)` (linha 1354)

Copia para o clipboard um prompt extenso para geração de asset PNG com IA (Midjourney, DALL-E, etc.). Para `tipo='frente'` gera prompt de vista frontal; para `tipo='iso'` gera prompt de perspectiva isométrica 45°. Ambos incluem requisitos de transparência (canal alpha) e liberdade de estilo artístico.

Sem dependências externas de runtime.

---

#### `apmodParseSvgJson()` (linha 1397)

Lê o textarea `apmod-svg-json-paste`, parseia como JSON e distribui `frente_svg` e `iso_svg` nos campos de SVG correspondentes. Valida se cada valor começa com `<svg` antes de aplicar.

| Dependência | Tipo | Origem |
|---|---|---|
| `apmodAtualizarPreview()` | função | local |
| `mostrarToast()` | função | externo |

---

### Bloco 7 — APMOD: Equipamentos Visuais — Geração de Imagem Composta (linhas 1413–1598)

#### `_aeqGenerateComposedImg(aparencia, equipVisuais, charNome)` async (linha 1413)

Gera uma imagem PNG composta (240×360 px) do personagem com seus equipamentos visuais renderizados sobre um canvas offscreen, e faz upload para o Storage.

**Helpers internos:**
- `isIdentityWarp(corners)` — detecta se os warpCorners representam a transformação identidade (sem warp real)
- `loadImg(src, isSvg, w, h)` — carrega imagem de URL ou string SVG (via dataURL) retornando uma `Promise<HTMLImageElement>`
- `drawImageWarped(img, srcW, srcH, corners)` — aplica warp perspectivo por subdivisão em N×N triângulos com interpolação bilinear dos corners normalizados
- `drawEquipLayer(camada)` — itera equipamentos filtrados por camada (`atras`/`frente`), posiciona e desenha cada um com suporte a warp, rotação, flip H, skewX/skewY

**Fluxo de renderização:** camada atras → personagem (iso/svg/criatura/builder) → camada frente → upload via `uploadToStorage()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `CREATURE_MODELS` | objeto | local |
| `apmodRenderIso()` | função | local |
| `uploadToStorage()` | função | externo |

---

## 27. `js/systems/catalog.js` *(linhas 1599–2101 — Batch 4)*

### Bloco 8 — APMOD: Salvar Aparência (linhas 1599–1675)

#### `apmodSalvar(nome)` async (linha 1601)

Salva a aparência do personagem no Supabase. Fluxo:
1. Dirty check: compara JSON atual com `_apmodOriginal`; se não mudou exibe toast e fecha.
2. Calcula delta de `bonus_attrs` dos equipamentos visuais (reverte antigos, aplica novos nos `atributos` do personagem).
3. Espelha `img_frente` → `img_retrato` e `img_iso` → `img_full` para leitura direta em outros sistemas.
4. Salva via PATCH imediato; atualiza token no mapa, view do personagem, view de atributos e inventário.
5. Gera `composed_img` em background via `_aeqGenerateComposedImg()` e faz segundo PATCH quando pronto.

| Dependência | Tipo | Origem |
|---|---|---|
| `apmodGetCurrentAparencia()` | função | local |
| `RPG_DATA` | objeto global | externo (state.js) |
| `mostrarToast()` | função | externo |
| `sb()` | função | `js/core/supabase.js` |
| `mapaRenderTokens()` | função | externo (maps.js) |
| `MAPA_STATE` | objeto global | externo (maps.js) |
| `renderCharView()` | função | externo |
| `renderAttrView()` | função | externo |
| `renderInvVisual()` | função | externo |
| `_aeqGenerateComposedImg()` | função | local |

---

### Bloco 9 — Tint System (linhas 1682–1820)

#### `tintOverlayHtml(tints)` (linha 1682)

Gera HTML de uma ou mais `<div>` absolutas com `mix-blend-mode` para sobreposição de cor (tint) em cima de imagem/token. Filtra tints sem cor ou com opacidade zero.

Sem dependências externas.

---

#### `tintFilterString(tints)` (linha 1692)

Stub vazio: retorna string vazia (fallback de `filter` CSS não utilizado pois `mix-blend-mode` tem suporte universal). Sem dependências externas.

---

#### `tintWrapImg(imgUrl, containerStyle, imgStyle, tints)` (linha 1698)

Gera HTML de um container `position:relative` com a imagem e as divs de overlay de tint. Convenência para uso fora do modal APMOD.

| Dependência | Tipo | Origem |
|---|---|---|
| `tintOverlayHtml()` | função | local |

---

#### `_apmodTabTint(aparencia)` (linha 1704)

Gera HTML da aba "Tint": lista de linhas de camada de cor (cor + modo + opacidade) com botão para adicionar nova, e painel de preview ao vivo (círculo de 80×80 px).

| Dependência | Tipo | Origem |
|---|---|---|
| `_apmodTintLinhaHtml()` | função | local |

---

#### `_apmodTintLinhaHtml(i, t, modosHtml)` (linha 1733)

Gera HTML de uma linha de tint: input de cor, select de blend-mode, range de opacidade + valor numérico, swatch de preview e botão de remoção. Sem dependências externas.

---

#### `apmodTintIniciar(aparencia)` (linha 1759)

Inicializa `window._apmodTints` com cópia deep dos tints da aparência e re-renderiza a lista.

| Dependência | Tipo | Origem |
|---|---|---|
| `apmodTintRefresh()` | função | local |

---

#### `apmodTintAdicionar()` (linha 1764)

Acrescenta tint padrão (`cor: #ff0000, opacidade: 0.35, modo: multiply`) e atualiza a lista.

| Dependência | Tipo | Origem |
|---|---|---|
| `apmodTintRefresh()` | função | local |

---

#### `apmodTintAtualizar(i, campo, valor)` (linha 1769)

Atualiza um campo de um tint pelo índice, atualizando também o swatch de cor inline se o campo for `cor`. Dispara `apmodTintAtualizarPreview()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `apmodTintAtualizarPreview()` | função | local |

---

#### `apmodTintRemover(i)` (linha 1780)

Remove o tint do índice `i` e re-renderiza.

| Dependência | Tipo | Origem |
|---|---|---|
| `apmodTintRefresh()` | função | local |

---

#### `apmodTintRefresh()` (linha 1785)

Re-renderiza a lista de tints (`apmod-tint-lista`) a partir de `window._apmodTints` e atualiza o preview.

| Dependência | Tipo | Origem |
|---|---|---|
| `_apmodTintLinhaHtml()` | função | local |
| `apmodTintAtualizarPreview()` | função | local |

---

#### `apmodTintAtualizarPreview()` (linha 1796)

Atualiza o preview de 80×80 px da aba Tint: aplica os overlays de tint sobre a imagem atual do personagem (ou o conteúdo do preview de cabeça se não houver imagem). Garante que o painel de preview principal está expandido.

| Dependência | Tipo | Origem |
|---|---|---|
| `apmodTogglePreviewPanel()` | função | local |
| `tintOverlayHtml()` | função | local |
| `RPG_DATA` | objeto global | externo (state.js) |
| `normalizeImgUrl()` | função | externo |

---

### Bloco 10 — APMOD: Equipamentos Visuais (linhas 1821–2101)

#### `apmodRemoverEquip(idx)` (linha 1824)

Remove o equipamento visual do índice `idx` de `window._apmodEquipsVisuais` e re-renderiza a lista.

| Dependência | Tipo | Origem |
|---|---|---|
| `_apmodRefreshEquipLista()` | função | local |

---

#### `_apmodTabEquip(aparencia, nome)` (linha 1826)

Gera HTML da aba "Equipamentos": lista de equipamentos visuais existentes com botões de editar, remover e alternar camada, mais botão para adicionar novo.

| Dependência | Tipo | Origem |
|---|---|---|
| `EQUIP_SLOT_LIMITS` | objeto | local |

---

#### `_apmodRefreshEquipLista()` (linha 1851)

Re-renderiza a lista de equipamentos visuais (`apmod-equip-lista`) a partir de `window._apmodEquipsVisuais`. Sem dependências externas além de `EQUIP_SLOT_LIMITS`.

---

#### `apmodToggleEquipCamada(idx)` (linha 1873)

Alterna o campo `camada` de um equipamento visual entre `'frente'` e `'atras'`, re-renderizando a lista.

| Dependência | Tipo | Origem |
|---|---|---|
| `_apmodRefreshEquipLista()` | função | local |

---

#### `_aeqSlots()` (linha 1880)

Gera HTML de `<option>` para o select de slots de equipamento a partir de `EQUIP_SLOT_LIMITS`. Sem dependências externas.

---

#### `apmodAbrirAdicionarEquip(editIdx)` (linha 1882)

Abre o overlay fullscreen de adição/edição de equipamento visual (`#aeq-overlay`). Inicializa `window._aeqWorking` com os valores do equipamento existente (se `editIdx >= 0`) ou padrões. Constrói HTML completo do overlay: painel esquerdo (canvas de posicionamento 220×300 px com drag/rotate/scale e warp) + painel direito (formulário com nome, slot, visibilidade, visual do item — URL/arquivo/SVG —, bônus de atributos e desbloqueio de efeitos).

| Dependência | Tipo | Origem |
|---|---|---|
| `_aeqSlots()` | função | local |
| `_aeqRenderChar()` | função | local |
| `_aeqSetCamada()` | função | local |
| `_aeqUpdateVisual()` | função | local |
| `_aeqPositionDrag()` | função | local |
| `_aeqAttachHandlers()` | função | local |

---

#### `_aeqRenderChar()` (linha 2048)

Renderiza o personagem no fundo do canvas de posicionamento do overlay de equipamento. Usa `_apmodOriginal` como fonte (em vez de `apmodGetCurrentAparencia`) para evitar leitura incorreta quando a aba ativa é `equip`.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | externo (state.js) |
| `CREATURE_MODELS` | objeto | local |
| `apmodRenderIso()` | função | local |

---

#### `_aeqUpdateVisual()` (linha 2076)

Atualiza o visual do item arrastável no canvas de posicionamento: lê URL ou SVG dos campos do DOM (se existirem), define dimensões e conteúdo do `#aeq-item-el`, e chama `_aeqPositionDrag()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `_aeqPositionDrag()` | função | local |

---

## 27. `js/systems/catalog.js` *(linhas 2102–2674 — Batch 5)*

### Bloco 10 (continuação) — APMOD: Equipamentos Visuais — Drag/Warp (linhas 2102–2545)

#### `_aeqPositionDrag()` (linha 2104)

Posiciona o elemento `#aeq-drag` no canvas de posicionamento com base nas coordenadas `x/y` (percentuais) e aplicações de transform. Em modo warp calcula a matrix3d via `_aeqComputeMatrix3d()` e reconstrói o layer de controles se não há gesto ativo. Em modo normal aplica rotação, flip H e skew encadeados. Sincroniza os inputs numéricos com os valores atuais de `_aeqWorking`.

| Dependência | Tipo | Origem |
|---|---|---|
| `_aeqComputeMatrix3d()` | função | local |
| `_aeqBuildWarpLayer()` | função | local |

---

#### `_aeqFromInputs()` (linha 2155)

Lê os inputs numéricos de posição (x, y, escala, rotação, giro H, skewX, skewY) e sincroniza `window._aeqWorking`, disparando `_aeqUpdateVisual()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `_aeqUpdateVisual()` | função | local |

---

#### `_aeqSetCamada(c)` (linha 2167)

Define a camada (`'frente'`/`'atras'`) em `_aeqWorking`, atualiza estilos dos botões e ajusta `z-index` do drag element para mostrar visualmente a sobreposição.

Sem dependências externas.

---

#### `_aeqAttachHandlers()` (linha 2185)

Registra handlers de pointer para o canvas de posicionamento:
- **Drag** (`pointerdown` no `#aeq-drag`): move o item
- **Rotate** (`pointerdown` no `#aeq-rot-handle`): gira pelo ângulo polar em relação ao centro
- **Scale** (`pointerdown` no `#aeq-scale-handle`): redimensiona pelo ratio de distância ao canto TL

Todos usam `setPointerCapture` para não perder eventos durante arrasto rápido.

| Dependência | Tipo | Origem |
|---|---|---|
| `_aeqOnMove()` | função | local |
| `_aeqOnUp()` | função | local |

---

#### `_aeqOnMove(e)` (linha 2229)

Handler `pointermove` de documento para os gestos de move/rotate/scale do equipment positioner. Atualiza `_aeqWorking` e chama `_aeqPositionDrag()` ou `_aeqUpdateVisual()` conforme o modo.

| Dependência | Tipo | Origem |
|---|---|---|
| `_aeqPositionDrag()` | função | local |
| `_aeqUpdateVisual()` | função | local |

---

#### `_aeqOnUp(e)` (linha 2249)

Handler `pointerup` de documento: limpa `window._aeqGesture` e restaura cursor para `grab`. Sem dependências externas.

---

#### `_aeqComputeMatrix3d(srcW, srcH, dst)` (linha 2257)

Calcula a transformação CSS `matrix3d` correspondente à homografia perspectiva entre os quatro cantos de origem (retângulo srcW×srcH) e os quatro cantos de destino `dst` (coordenadas absolutas em pixels). Utiliza adjugada de matrizes 3×3 (álgebra projetiva). Retorna `'none'` se os corners forem inválidos ou extremos demais.

Sem dependências externas.

---

#### `_aeqRepaintWarpLayer(corners, iW, iH)` (linha 2272)

Atualiza apenas posições dos handles e o SVG da grade de warp sem reconstruir o DOM, tornando-o seguro para chamar durante gestos de arrastar (sem destruir pointer capture). Sem dependências externas além de `_aeqWarpGridInner()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `_aeqWarpGridInner()` | função | local |

---

#### `_aeqWarpGridInner(corners, iW, iH)` (linha 2287)

Gera o innerHTML SVG da grade visual de warp: N×N linhas de grade interpolando os corners normalizados + contorno externo destacado. Sem dependências externas.

---

#### `_aeqBuildWarpLayer(corners, iW, iH)` (linha 2304)

Constrói do zero o layer de warp DOM (`#aeq-warp-layer`): cria SVG da grade e quatro handles arrastáveis nos cantos (`#aeq-wh-0` a `#aeq-wh-3`). Cada handle dispara `_aeqWarpMoveDoc`/`_aeqWarpUpDoc` via `setPointerCapture`. Chamado apenas quando não há gesto ativo.

| Dependência | Tipo | Origem |
|---|---|---|
| `_aeqWarpGridInner()` | função | local |
| `_aeqWarpMoveDoc()` | função | local |
| `_aeqWarpUpDoc()` | função | local |

---

#### `_aeqWarpMoveDoc(e)` (linha 2362)

Handler `pointermove` de documento para arrastar um corner de warp: atualiza `warpCorners[i]` em `_aeqWorking`, recalcula e aplica a `matrix3d` no elemento e repinta a grade sem rebuild do DOM.

| Dependência | Tipo | Origem |
|---|---|---|
| `_aeqComputeMatrix3d()` | função | local |
| `_aeqRepaintWarpLayer()` | função | local |

---

#### `_aeqWarpUpDoc(e)` (linha 2378)

Handler `pointerup` de documento para fim do arrasto de warp: limpa `window._aeqWarpGesture` e remove os próprios listeners. Sem dependências externas.

---

#### `_aeqToggleWarpMode()` (linha 2385)

Ativa/desativa o modo warp: ao ativar, inicializa `warpCorners` com a identidade (quadrado perfeito) se não existirem; ao desativar, remove o layer de warp e limpa todos os listeners. Atualiza UI dos botões e opacidade dos controles de skew.

| Dependência | Tipo | Origem |
|---|---|---|
| `_aeqPositionDrag()` | função | local |
| `_aeqWarpMoveDoc()` | função | local |
| `_aeqWarpUpDoc()` | função | local |

---

#### `_aeqResetWarp()` (linha 2426)

Reseta os `warpCorners` para a identidade (quadrado perfeito) e re-posiciona. Sem dependências externas além de `_aeqPositionDrag()`.

---

#### `_aeqClearWarp()` (linha 2432)

Remove completamente o warp: seta `warpCorners = null`, desativa warp mode, limpa layer e listeners, restaura botões.

| Dependência | Tipo | Origem |
|---|---|---|
| `_aeqPositionDrag()` | função | local |

---

#### `aeqModoVisual(modo)` (linha 2449)

Alterna o painel de visual do item entre os modos `'url'`, `'file'` e `'svg'`: exibe o painel correto, destaca o botão ativo, e dispara `_aeqUpdateVisual()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `_aeqUpdateVisual()` | função | local |

---

#### `aeqFileUpload(inp)` async (linha 2460)

Faz upload da imagem selecionada via `uploadToStorage()`, preenche o input de URL, muda para o modo `'url'` e atualiza o visual do item.

| Dependência | Tipo | Origem |
|---|---|---|
| `mostrarToast()` | função | externo |
| `uploadToStorage()` | função | externo |
| `aeqModoVisual()` | função | local |
| `_aeqUpdateVisual()` | função | local |

---

#### `aeqAdicionarBonusRow()` (linha 2475)

Acrescenta dinamicamente uma nova linha de bônus de atributo (input de nome + input numérico + botão de remover) na lista `#aeq-bonus-lista`. Sem dependências externas.

---

#### `apmodConfirmarEquip()` (linha 2485)

Coleta todos os dados do formulário de equipamento (nome, slot, visibilidade, camada, visual, posição/escala/rotação/skew/warp, bônus de atributos, unlock de efeitos), monta o objeto `eq` e o adiciona ou substitui em `window._apmodEquipsVisuais`. Remove o overlay e atualiza a lista de equipamentos.

| Dependência | Tipo | Origem |
|---|---|---|
| `mostrarToast()` | função | externo |
| `EQUIP_SLOT_LIMITS` | objeto | local |
| `_aeqOnMove()` / `_aeqOnUp()` | funções | local |
| `_apmodRefreshEquipLista()` | função | local |

---

### Bloco 11 — IIFE Sistema HD (linhas 2555–2674)

IIFE que sobrescreve funções APMOD para suportar renders em alta definição com viewBox expandida (personagens podem ter partes além do bounding box padrão).

#### Overrides internos:

**`apmodRenderFront`** — Expande viewBox para `-20 -28 72 124`; mantém tamanho de exibição 32×68; injeta partes com `estilo === 'ff_hd'` usando `front_hd` template.

**`apmodRenderIso`** — Expande viewBox para `-20 -28 72 108`; define tamanho de arte real 234×351 px; injeta partes com `iso_hd` template.

**`apmodAtualizarPreview`** — Chama o original e depois ajusta dimensões do `#apmod-prev-iso` (240×362 px) e `#apmod-prev-head` (60×60 px) para exibir a arte em tamanho real.

**`apmodCarregarTemplate`** — Antes de chamar o original, verifica se o template tem `modo === 'svg'`; se sim, aplica diretamente como aparência SVG sem passar pelo builder de partes.

**`window._apmodTabJson`** — Versão expandida que adiciona badge "FF HD" aos templates com estilo `ff_hd` ou `modo === 'svg'`.

| Dependência | Tipo | Origem |
|---|---|---|
| `apmodRenderFront` / `apmodRenderIso` | funções | local (substituídas) |
| `apmodAtualizarPreview` | função | local (estendida) |
| `apmodCarregarTemplate` | função | local (estendida) |
| `_apmodTabJson` | função | local (estendida) |
| `APMOD_PARTS` | objeto | local |
| `_hexDarken()` | função | local |
| `_svgPart()` | função | local |

---

### Bloco 12 — APMOD_PARTS: Arquétipos RPG Estáticos (linhas 2675–2879)

Declarações de dados (não funções) que populam `APMOD_PARTS` e `CHAR_JSON_TEMPLATES` com os 6 arquétipos RPG clássicos usando sprites ff_hd sem transparências no mapa.

Cada entrada de parte possui `id`, `nome`, `estilo:'ff_hd'` e strings SVG inline para `front`, `front_hd`, `iso`, `iso_hd` com placeholders `{c}` / `{c2}` para colorização dinâmica.

**Partes de cabelo/capacete** (`APMOD_PARTS.cabelo.push(...)` — linhas 2683–2721):

| ID | Nome |
|---|---|
| `h_gue` | ⚔ Elmo Fechado |
| `h_mag` | 🎩 Chapéu Arcano |
| `h_lad` | 🎭 Capuz Sombrio |
| `h_bar` | 💪 Crista Bárbara |
| `h_dru` | 🌿 Coroa de Galhos |
| `h_nec` | 💀 Capuz Espectral |

**Rostos** (`APMOD_PARTS.rosto.push(...)` — linhas 2724–2750):

| ID | Nome |
|---|---|
| `f_gue` | ⚔ Olhos de Aço |
| `f_mag` | ✨ Olhos Arcanos |
| `f_lad` | 👁 Olhos Solertes |
| `f_bar` | 💢 Olhos Ferozes |
| `f_dru` | 🌿 Olhos Calmos |
| `f_nec` | 💀 Olhos Espectrais |

**Camisas/torso** (`APMOD_PARTS.camisa.push(...)` — linhas 2753–2791):

| ID | Nome |
|---|---|
| `c_gue` | ⚔ Peitoral de Placa |
| `c_mag` | 🔮 Vestes Arcanas |
| `c_lad` | 🗡 Couro Sombrio |
| `c_bar` | 💪 Tronco Bárbaro |
| `c_dru` | 🌿 Manto Druídico |
| `c_nec` | 💀 Mortalha Espectral |

**Calças** (`APMOD_PARTS.calca.push(...)` — linhas 2794–2820):

| ID | Nome |
|---|---|
| `cl_gue` | ⚔ Grevas de Placa |
| `cl_mag` | 🔮 Veste Longa |
| `cl_lad` | 🗡 Calça Sombria |
| `cl_bar` | 💪 Calças Bárbaras |
| `cl_dru` | 🌿 Calça Natural |
| `cl_nec` | 💀 Mortalha Inferior |

**Sapatos** (`APMOD_PARTS.sapato.push(...)` — linhas 2823–2849):

| ID | Nome |
|---|---|
| `sp_gue` | ⚔ Sabatons de Placa |
| `sp_mag` | 🔮 Botas Arcanas |
| `sp_lad` | 🗡 Botas Silenciosas |
| `sp_bar` | 💪 Botas Bárbaras |
| `sp_dru` | 🌿 Sandálias Naturais |
| `sp_nec` | 💀 Mortalha dos Pés |

**Templates completos** (`CHAR_JSON_TEMPLATES.push(...)` — linhas 2852–2877): 6 presets pré-montados que combinam as partes acima com paletas de cores adequadas a cada arquétipo (guerreiro, mago, ladino, bárbaro, druida, necromante). Cada template tem `id`, `label`, `icon`, `estilo:'ff_hd'` e um objeto `partes` com referências de peças e cores.

| Dependência | Tipo | Origem |
|---|---|---|
| `APMOD_PARTS` | objeto | local (populado aqui) |
| `CHAR_JSON_TEMPLATES` | array | local (populado aqui) |

---

### Bloco 13 — A1: Serviço de Mapeamento de Atributos (linhas 2882–3068)

Serviço CRUD que vincula nomes de atributos customizados do sistema RPG (ex.: "Vigor", "Astúcia") aos 4 grupos base (`forca`, `destreza`, `constituicao`, `inteligencia`). O cache em memória `ATTR_MAPPING_CACHE` (por `rpgId`) evita requisições repetidas.

#### Constantes e helpers

**`GRUPOS_VALIDOS`** — linha 2886  
Array com os 4 grupos aceitos: `['forca','destreza','constituicao','inteligencia']`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`_normalizarAttr(nome)`** — linha 2888  
Normaliza um nome de atributo para lowercase e sem espaços extras. Usado como chave de comparação em todo o serviço A1.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

#### Funções CRUD (assíncronas)

**`carregarMapeamento(rpgId)`** — linha 2890  
Busca todos os mapeamentos do RPG na tabela `atributos_grupos` (Supabase). Popula e retorna `ATTR_MAPPING_CACHE[rpgId]`. Se já estiver em cache, retorna imediatamente.

| Dependência | Tipo | Origem |
|---|---|---|
| `ATTR_MAPPING_CACHE` | objeto global | local |
| `sb()` | função | Supabase helper |

---

**`salvarMapeamento(rpgId, nomeCustomizado, grupoBase)`** — linha 2902  
Valida o nome (regex unicode) e o grupo, faz DELETE do registro antigo (upsert manual) e POST do novo em `atributos_grupos`. Atualiza o cache local imediatamente após.

| Dependência | Tipo | Origem |
|---|---|---|
| `ATTR_MAPPING_CACHE` | objeto global | local |
| `GRUPOS_VALIDOS` | array | local |
| `_normalizarAttr()` | função | local |
| `carregarMapeamento()` | função | local |
| `sb()` | função | Supabase helper |

---

**`removerMapeamento(rpgId, nomeCustomizado)`** — linha 2928  
Antes de deletar, verifica se algum item do catálogo (`item_catalog`) ainda usa o atributo; lança erro descritivo se sim. Executa DELETE em `atributos_grupos` e limpa o cache local.

| Dependência | Tipo | Origem |
|---|---|---|
| `ATTR_MAPPING_CACHE` | objeto global | local |
| `_normalizarAttr()` | função | local |
| `sb()` | função | Supabase helper |

---

#### Funções de leitura síncrona (operam sobre o cache)

**`getGrupoDeAtributo(rpgId, nomeCustomizado)`** — linha 2954  
Retorna o `grupo_base` do atributo consultando somente o cache. Retorna `null` se não encontrado.

| Dependência | Tipo | Origem |
|---|---|---|
| `ATTR_MAPPING_CACHE` | objeto global | local |
| `_normalizarAttr()` | função | local |

---

**`getAtributosPorGrupo(rpgId, grupoBase)`** — linha 2960  
Retorna lista de nomes customizados mapeados para um dado grupo, filtrando o cache.

| Dependência | Tipo | Origem |
|---|---|---|
| `ATTR_MAPPING_CACHE` | objeto global | local |

---

#### Interface (A2)

**`GRUPO_INFO`** — linha 2967  
Objeto com metadados de exibição para cada grupo: `label` com ícone e `desc` descritiva.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`renderAttrMappingUI()`** — linha 2974  
Função assíncrona principal da UI de mapeamento. Exibe o card `#cfg-atrmapping-card` somente para o mestre. Se o cache já estiver populado, chama `_renderMappingGrid` imediatamente; caso contrário, busca via `carregarMapeamento` primeiro.

| Dependência | Tipo | Origem |
|---|---|---|
| `CURRENT_RPG` | objeto global | contexto RPG |
| `RPG_DATA` | objeto global | contexto RPG |
| `ATTR_MAPPING_CACHE` | objeto global | local |
| `carregarMapeamento()` | função | local |
| `_renderMappingGrid()` | função | local |

---

**`_renderMappingGrid(rpgId, attrDefs)`** — linha 3001  
Gera o HTML completo da grade de mapeamento: um painel por grupo, com chips dos atributos mapeados (com botão de remoção) e um `<select>` para adicionar novos atributos disponíveis.

| Dependência | Tipo | Origem |
|---|---|---|
| `GRUPO_INFO` | objeto | local |
| `ATTR_MAPPING_CACHE` | objeto global | local |
| `getAtributosPorGrupo()` | função | local |
| `_normalizarAttr()` | função | local |
| `atrMappingRemover()` | função | local |
| `atrMappingAdicionar()` | função | local |

---

**`atrMappingAdicionar(rpgId, grupo)`** — linha 3035  
Handler do botão "OK" no painel de mapeamento. Lê o `<select>` do grupo, chama `salvarMapeamento` e recarrega a UI.

| Dependência | Tipo | Origem |
|---|---|---|
| `salvarMapeamento()` | função | local |
| `mostrarToast()` | função | global UI |
| `GRUPO_INFO` | objeto | local |
| `renderAttrMappingUI()` | função | local |

---

**`atrMappingRemover(rpgId, nome, grupo)`** — linha 3046  
Handler do botão "×" nos chips. Pede confirmação, chama `removerMapeamento` e recarrega a UI.

| Dependência | Tipo | Origem |
|---|---|---|
| `removerMapeamento()` | função | local |
| `mostrarToast()` | função | global UI |
| `GRUPO_INFO` | objeto | local |
| `renderAttrMappingUI()` | função | local |

---

**Hook `abrirTab`** — linha 3056  
Intercepta `window.abrirTab` para chamar `renderAttrMappingUI` com delay de 100ms ao entrar na aba `config`. Fallback via listener de clique se `abrirTab` ainda não estiver definida.

| Dependência | Tipo | Origem |
|---|---|---|
| `window.abrirTab` | função | global (outra aba) |
| `renderAttrMappingUI()` | função | local |

---

### Bloco 14 — I1: Catálogo de Itens — Estado e Constantes (linhas 3070–3175)

Início do sistema de catálogo de itens (CRUD completo). Define o estado global, mapeamentos de defaults por tipo e paleta de raridade.

**`CATALOGO_STATE`** — linha 3073  
Objeto de estado do catálogo: `itens` (lista completa), `filtrados` (após filtros), `itemEditando` (item em edição), `bonusLinhas` (linhas de atributo-bônus do formulário), `efeitosLista` (lista de efeitos), `visualConfig` (configuração visual do card do item).

---

**`TIPO_DEFAULTS`** — linha 3082  
Mapa de `tipo_canonico → { slot, grupo, emoji }` para 12 tipos de item: arma, escudo, armadura, calcas, amuleto, capacete, botas, capa, consumivel, material, chave, customizado.

---

**`RARIDADE_CORES`** — linha 3097  
Mapa de `raridade → { borda, fundo, label, badge }` para 5 níveis: comum, incomum, raro, épico, lendário.

---

**`abrirCatalogo()`** — linha 3105  
Exibe o overlay `#modal-catalogo-overlay` e chama `carregarCatalogo`.

| Dependência | Tipo | Origem |
|---|---|---|
| `carregarCatalogo()` | função | local |

---

**`fecharCatalogo()`** — linha 3109  
Oculta o overlay `#modal-catalogo-overlay`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`carregarCatalogo()`** — linha 3113  
Async. Busca todos os itens do RPG atual em `item_catalog` ordenados por nome. Popula `CATALOGO_STATE.itens` e chama `filtrarCatalogo`.

| Dependência | Tipo | Origem |
|---|---|---|
| `CURRENT_RPG` | objeto global | contexto RPG |
| `CATALOGO_STATE` | objeto | local |
| `filtrarCatalogo()` | função | local |
| `sb()` | função | Supabase helper |

---

**`filtrarCatalogo()`** — linha 3125  
Aplica filtros de busca textual, `tipo_canonico` e `raridade` sobre `CATALOGO_STATE.itens`, popula `CATALOGO_STATE.filtrados` e chama `renderListaCatalogo`.

| Dependência | Tipo | Origem |
|---|---|---|
| `CATALOGO_STATE` | objeto | local |
| `renderListaCatalogo()` | função | local |

---

**`renderListaCatalogo()`** — linha 3138  
Renderiza o HTML da lista de itens filtrados em `#cat-lista`. Cada card exibe ícone visual, nome, badge de raridade, tipo/subtipo/nível e até 3 atributos-bônus coloridos. Botão 🎁 aciona `abrirDarItem`.

| Dependência | Tipo | Origem |
|---|---|---|
| `CATALOGO_STATE` | objeto | local |
| `RARIDADE_CORES` | objeto | local |
| `TIPO_DEFAULTS` | objeto | local |
| `abrirFormItem()` | função | local |
| `abrirDarItem()` | função | local |

---

### Bloco 15 — I1: Formulário de Item (linhas 3176–3272)

**`abrirFormItem(id)`** — linha 3176  
Abre o modal `#modal-item-overlay`. Se `id` for nulo, inicializa o formulário em branco (novo item). Se `id` for fornecido, localiza o item em `CATALOGO_STATE.itens`, preenche todos os campos do formulário (nome, tipo, raridade, subtipo, slot, grupo, descrição, flags, visual, bônus, efeitos) e exibe botões de duplicar/deletar.

| Dependência | Tipo | Origem |
|---|---|---|
| `CATALOGO_STATE` | objeto | local |
| `trocarAbaItem()` | função | local |
| `_aplicarVisualConfig()` | função | local |
| `renderLinhasBonus()` | função | local |
| `renderEfeitosLista()` | função | local |
| `atualizarPreviewCard()` | função | local |
| `toggleDropConfig()` | função | local |

---

**`fecharFormItem()`** — linha 3252  
Oculta o modal `#modal-item-overlay` e limpa `CATALOGO_STATE.itemEditando`.

| Dependência | Tipo | Origem |
|---|---|---|
| `CATALOGO_STATE` | objeto | local |

---

**`abrirEditarItemCatalogo(id)`** — linha 3258  
Sincroniza os itens de `INV.itemDefs` para `CATALOGO_STATE.itens` (atualiza entradas existentes) antes de chamar `abrirFormItem`. Usado para abrir o editor avançado a partir das tabelas de inventário.

| Dependência | Tipo | Origem |
|---|---|---|
| `INV` | objeto global | módulo de inventário |
| `CATALOGO_STATE` | objeto | local |
| `abrirFormItem()` | função | local |

---

### Bloco 16 — I1: Controles do Formulário de Item (linhas 3273–3460)

Funções que controlam abas, mudanças de tipo/raridade, visual e preview do formulário de item.

**`trocarAbaItem(aba)`** — linha 3274  
Alterna tabs no formulário de item: atualiza classes e cores dos botões `.item-form-tab` e exibe/oculta os divs `.item-form-aba` correspondentes.

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

**`itemTipoChange()`** — linha 3286  
Ao mudar o tipo canônico do item, preenche automaticamente `slot`, `grupo` e emoji inicial a partir de `TIPO_DEFAULTS`. Chama `atualizarPreviewCard`.

| Dependência | Tipo | Origem |
|---|---|---|
| `TIPO_DEFAULTS` | objeto | local |
| `CATALOGO_STATE` | objeto | local |
| `atualizarPreviewCard()` | função | local |

---

**`itemRaridadeChange()`** — linha 3298  
Ao mudar a raridade, preenche as cores de borda/fundo com os valores padrão de `RARIDADE_CORES` e atualiza o preview.

| Dependência | Tipo | Origem |
|---|---|---|
| `RARIDADE_CORES` | objeto | local |
| `CATALOGO_STATE` | objeto | local |
| `atualizarPreviewCard()` | função | local |

---

**`setVisualTipo(tipo)`** — linha 3310  
Alterna entre `emoji` e `url` no painel visual: atualiza estilos dos botões `.vis-tipo-btn`, mostra/oculta campos correspondentes e atualiza o preview.

| Dependência | Tipo | Origem |
|---|---|---|
| `CATALOGO_STATE` | objeto | local |
| `atualizarPreviewCard()` | função | local |

---

**`fiImgurlChange()`** — linha 3323  
Ao modificar a URL de imagem, atualiza o preview `#fi-img-preview` e chama `atualizarPreviewCard`.

| Dependência | Tipo | Origem |
|---|---|---|
| `atualizarPreviewCard()` | função | local |

---

**`fiUploadImagem(input)`** — linha 3332  
Async. Faz upload do arquivo selecionado para o bucket `items` via `uploadToStorage`, preenche o campo de URL e atualiza o preview.

| Dependência | Tipo | Origem |
|---|---|---|
| `uploadToStorage()` | função | global (storage helper) |
| `mostrarToast()` | função | global UI |
| `atualizarPreviewCard()` | função | local |

---

**`setAnimacao(anim)`** — linha 3349  
Define a animação do card (`none`, `pulse`, etc.): atualiza `CATALOGO_STATE.visualConfig.animacao`, estilos dos botões `.anim-btn` e chama `atualizarPreviewCard`.

| Dependência | Tipo | Origem |
|---|---|---|
| `CATALOGO_STATE` | objeto | local |
| `atualizarPreviewCard()` | função | local |

---

**`restaurarAparenciaPadrao()`** — linha 3360  
Reseta `CATALOGO_STATE.visualConfig` para os padrões do tipo e raridade atuais. Atualiza todos os campos visuais do formulário.

| Dependência | Tipo | Origem |
|---|---|---|
| `TIPO_DEFAULTS` | objeto | local |
| `RARIDADE_CORES` | objeto | local |
| `CATALOGO_STATE` | objeto | local |
| `setAnimacao()` | função | local |
| `atualizarPreviewCard()` | função | local |

---

**`_aplicarVisualConfig()`** — linha 3375  
Lê `CATALOGO_STATE.visualConfig` e aplica seus valores a todos os campos do formulário visual (tipo, emoji, URL, cores, animação).

| Dependência | Tipo | Origem |
|---|---|---|
| `CATALOGO_STATE` | objeto | local |
| `setVisualTipo()` | função | local |

---

**`atualizarPreviewCard()`** — linha 3399  
Atualiza o card de preview `#fi-preview-card` em tempo real: ícone (emoji ou imagem), nome, nível, badge de raridade com cor/borda/fundo, animação CSS e lista de bônus coloridos. Também atualiza `#fi-stats-preview-mecanica` na aba de mecânica.

| Dependência | Tipo | Origem |
|---|---|---|
| `CATALOGO_STATE` | objeto | local |
| `RARIDADE_CORES` | objeto | local |

---

### Bloco 17 — I1: Bônus, Efeitos e Persistência do Item (linhas 3462–3762)

**`adicionarLinhaBonus()`** — linha 3463  
Adiciona uma linha vazia em `CATALOGO_STATE.bonusLinhas` e chama `renderLinhasBonus`.

| Dependência | Tipo | Origem |
|---|---|---|
| `CATALOGO_STATE` | objeto | local |
| `renderLinhasBonus()` | função | local |

---

**`renderLinhasBonus()`** — linha 3468  
Renderiza as linhas de bônus em `#fi-bonus-lista`. Cada linha tem um `<select>` de atributo (filtrado de `RPG_DATA.attrDefs`), input numérico com cor dinâmica (verde/vermelho), selector fixo/%, e botão de remoção. Exibe aviso de penalidade se algum valor for negativo.

| Dependência | Tipo | Origem |
|---|---|---|
| `CATALOGO_STATE` | objeto | local |
| `RPG_DATA` | objeto global | contexto RPG |
| `atualizarPreviewCard()` | função | local |

---

**`adicionarEfeito()`** — linha 3501  
Adiciona um efeito padrão `proc` em `CATALOGO_STATE.efeitosLista` (30% ao atacar → debuff Atordoado 1 turno) e chama `renderEfeitosLista`.

| Dependência | Tipo | Origem |
|---|---|---|
| `CATALOGO_STATE` | objeto | local |
| `renderEfeitosLista()` | função | local |

---

**`renderEfeitosLista()`** — linha 3506  
Renderiza cada efeito em `CATALOGO_STATE.efeitosLista` como um painel interativo com seletores de tipo/gatilho/chance/efeito e campos condicionais (ex.: nome do debuff, atributo, valor, turnos) gerados por IIFE inline. A descrição é gerada por `_descreverEfeito`.

| Dependência | Tipo | Origem |
|---|---|---|
| `CATALOGO_STATE` | objeto | local |
| `RPG_DATA` | objeto global | contexto RPG |
| `_descreverEfeito()` | função | local |

---

**`_descreverEfeito(ef)`** — linha 3571  
Gera uma string legível descrevendo o efeito (ex.: "30% de chance de Atordoado por 1t ao atacar"). Cobre tipos `proc`, `aura` e `condicional`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`toggleDropConfig()`** — linha 3586  
Mostra/oculta `#fi-drop-config` com base no estado do checkbox `#fi-droppable`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

**`salvarItem()`** — linha 3592  
Async. Valida nome e tipo, alerta sobre trade-off severo. Monta o payload completo (campos do formulário + bônus + efeitos + visual_config + flags), executa PATCH (edição) ou POST (criação) em `item_catalog`. Sincroniza o `INV.itemDefs` em memória, fecha o formulário e recarrega o catálogo e as tabelas.

| Dependência | Tipo | Origem |
|---|---|---|
| `CATALOGO_STATE` | objeto | local |
| `CURRENT_RPG` | objeto global | contexto RPG |
| `INV` | objeto global | módulo de inventário |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `fecharFormItem()` | função | local |
| `carregarCatalogo()` | função | local |
| `renderTabelasTab()` | função | módulo tabelas |
| `trocarAbaItem()` | função | local |

---

**`duplicarItemAtual()`** — linha 3673  
Async. Cria uma cópia do item em edição (`CATALOGO_STATE.itemEditando`) sem o `id`, com nome " (cópia)". Fecha o formulário e recarrega o catálogo.

| Dependência | Tipo | Origem |
|---|---|---|
| `CATALOGO_STATE` | objeto | local |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `fecharFormItem()` | função | local |
| `carregarCatalogo()` | função | local |

---

**`deletarItemAtual()`** — linha 3687  
Async. Pede confirmação e deleta o item atual de `item_catalog`. Fecha o formulário e recarrega o catálogo.

| Dependência | Tipo | Origem |
|---|---|---|
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `fecharFormItem()` | função | local |
| `carregarCatalogo()` | função | local |

---

**`abrirDarItem(itemId)`** — linha 3702  
Abre o modal `#modal-dar-item-overlay`, populando o `<select>` com os personagens do RPG atual.

| Dependência | Tipo | Origem |
|---|---|---|
| `CATALOGO_STATE` | objeto | local |
| `RPG_DATA` | objeto global | contexto RPG |

---

**`confirmarDarItem()`** — linha 3712  
Async. Confirma a doação: insere em `inventario` (com `origin:'doacao_mestre'` e flag `bloqueado_por_nivel`). Emite evento `item_dropado` via `emitirEvento` para broadcast em tempo real.

| Dependência | Tipo | Origem |
|---|---|---|
| `CATALOGO_STATE` | objeto | local |
| `CURRENT_RPG` | objeto global | contexto RPG |
| `RPG_DATA` | objeto global | contexto RPG |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `emitirEvento()` | função | módulo realtime |

---

**`DOMContentLoaded` hook** — linha 3749  
Ao carregar a página, injeta botão "📦 Itens" na barra `#tabelas-mestre-btns` que aciona `abrirCatalogo`. Marcado com `data-mestre-only`.

| Dependência | Tipo | Origem |
|---|---|---|
| `abrirCatalogo()` | função | local |

---

### Bloco 18 — I2: Inventário Individual — Estado e Slots (linhas 3763–3869)

Início da PARTE 2 do catálogo. Gerencia o inventário por personagem, slots de equipamento e visualização.

**`INV_SLOTS`** — linha 3772  
Array com os 8 slots canônicos de equipamento: `arma_principal`, `arma_secundaria`, `cabeca`, `corpo`, `pernas`, `pes`, `capa`, `acessorio` — cada um com `id`, `label`, `emoji` e `col` (coluna na grade).

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`calcularMediaGrupo(rpgId, grupoBase)`** — linha 3784  
Async (A3). Carrega o mapeamento de atributos, obtém os nomes mapeados para o grupo, e calcula a média geral dos atributos do grupo entre todos os personagens jogadores vivos. Retorna `{ media, atributos, personagens }`.

| Dependência | Tipo | Origem |
|---|---|---|
| `carregarMapeamento()` | função | local (A1) |
| `getAtributosPorGrupo()` | função | local (A1) |
| `RPG_DATA` | objeto global | contexto RPG |

---

**`abrirInventario(nomeChar)`** — linha 3805  
Async. Localiza o personagem em `RPG_DATA.characters` ou `AR.chars` (arena), inicializa `INV.charAtivo/charId`, carrega `itemDefs` se necessário, exibe `#modal-inv-overlay` e chama `carregarInventarioChar`.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |
| `AR` | objeto global | módulo arena |
| `INV` | objeto global | módulo inventário |
| `invCarregarDados()` | função | módulo inventário |
| `invTrocarAba()` | função | local |
| `carregarInventarioChar()` | função | local |

---

**`fecharInventario()`** — linha 3824  
Oculta `#modal-inv-overlay`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

**`carregarInventarioChar(charId)`** — linha 3829  
Async (I2). Busca `inventario` com JOIN em `item_catalog` para o personagem e RPG atual. Popula `INV.inventarios[charId]` e chama `renderInvCompleto`.

| Dependência | Tipo | Origem |
|---|---|---|
| `INV` | objeto global | módulo inventário |
| `CURRENT_RPG` | objeto global | contexto RPG |
| `sb()` | função | Supabase helper |
| `renderInvCompleto()` | função | local |

---

**`renderInvCompleto()`** — linha 3846  
Orquestra a renderização do inventário chamando `renderInvSlots`, `renderInvMochila`, `renderInvCarga` e `renderInvVisual`.

| Dependência | Tipo | Origem |
|---|---|---|
| `renderInvSlots()` | função | local |
| `renderInvMochila()` | função | local |
| `renderInvCarga()` | função | local |
| `renderInvVisual()` | função | local |

---

**`renderInvSlots()`** — linha 3854  
Gera os cards de slot de equipamento em `#inv-slots-grid`. Para cada slot de `INV_SLOTS`, localiza o item equipado e o amuleto aninhado, chamando `renderSlotCard`.

| Dependência | Tipo | Origem |
|---|---|---|
| `INV` | objeto global | módulo inventário |
| `RPG_DATA` | objeto global | contexto RPG |
| `INV_SLOTS` | array | local |
| `podeEditarPersonagem()` | função | módulo personagem |
| `renderSlotCard()` | função | local |

---

**`renderSlotCard(slot, equipado, amuleto, podeEditar, charNivel)`** — linha 3871  
Gera o HTML de um slot de equipamento: vazio (com `onclick` para `invClicarSlotVazio`) ou preenchido (com ícone, nome, alerta de trade-off, cadeado de nível e overlay de amuleto). Usa `visual_config` para cores.

| Dependência | Tipo | Origem |
|---|---|---|
| `RARIDADE_CORES` | objeto | local |
| `_itemIcon()` | função | local |
| `invClicarItem()` | função | local |
| `invClicarSlotVazio()` | função | local |

---

**`invClicarSlotVazio(slotId)`** — linha 3897  
Ao clicar num slot vazio, filtra os itens da mochila compatíveis com aquele slot e, se houver algum, abre o detalhe do primeiro compatível via `invClicarItem`.

| Dependência | Tipo | Origem |
|---|---|---|
| `INV` | objeto global | módulo inventário |
| `mostrarToast()` | função | global UI |
| `invClicarItem()` | função | local |

---

### Bloco 19 — I2: Mochila, Carga e Visual (linhas 3917–4107)

**`renderInvMochila()`** — linha 3917  
Renderiza em `#inv-mochila-lista` os itens não equipados: ícone com cor de raridade, nome (com cadeado se bloqueado por nível e ⚠️ se tem trade-off), badge de raridade e quantidade. Exibe/oculta botão de adicionar conforme papel do usuário.

| Dependência | Tipo | Origem |
|---|---|---|
| `INV` | objeto global | módulo inventário |
| `RPG_DATA` | objeto global | contexto RPG |
| `RARIDADE_CORES` | objeto | local |
| `_itemIcon()` | função | local |
| `podeEditarPersonagem()` | função | módulo personagem |
| `invClicarItem()` | função | local |

---

**`renderInvCarga()`** — linha 3955  
I5 (encumbrance). Calcula carga atual somando `peso × quantidade` dos itens não equipados (default 1 por unidade). Limite: `ca.carga_maxima` ou `hp_max / 10`. Exibe em `#inv-carga-info` com cor dinâmica e aviso de mochila cheia.

| Dependência | Tipo | Origem |
|---|---|---|
| `INV` | objeto global | módulo inventário |
| `RPG_DATA` | objeto global | contexto RPG |
| `mostrarToast()` | função | global UI |

---

**`renderInvVisual()`** — linha 3987  
Aba visual do inventário. Exibe preview do personagem com equipamentos sobrepostos (usa `composed_img` se disponível, senão monta o SVG dinâmico com `apmodTokenSVG` + overlay de equipamentos visuais respeitando `camada`, `warpCorners`, `_aeqComputeMatrix3d`). Abaixo lista cada item equipado com status de posicionamento e botão "⟲ Posicionar".

| Dependência | Tipo | Origem |
|---|---|---|
| `INV` | objeto global | módulo inventário |
| `RPG_DATA` | objeto global | contexto RPG |
| `apmodTokenSVG()` | função | local (APMOD) |
| `_aeqComputeMatrix3d()` | função | local (AEQ) |
| `_resolveItemImgSrc()` | função | local |
| `invAbrirPosicionarEquip()` | função | local |
| `podeEditarPersonagem()` | função | módulo personagem |

---

**`_resolveItemImgSrc(it)`** — linha 4101  
Extrai a URL de imagem de um item suportando os dois sistemas de cadastro: campo `img_url` direto (sistema antigo) ou `visual_config.valor` quando `tipo_visual === 'url'` (sistema novo).

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`_normalizarSlotParaTipo(slot)`** — linha 4110  
Mapeia slugs de slot de inventário para os tipos reconhecidos pelo sistema visual de equipamentos (AEQ). Retorna `'geral'` para slots não mapeados.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

### Bloco 20 — I2: Posicionamento Visual de Equipamentos (linhas 4121–4325)

**`invAbrirPosicionarEquip(invId)`** — linha 4121  
Abre um overlay de posicionamento simplificado para um item equipado. Resolve os dados do item (suportando ambos os sistemas de cadastro), localiza ou cria a entrada em `equipamentos_visuais` da aparência do personagem, e monta um overlay completo com: canvas de drag/rotate/scale (`#aeq-canvas`), controles numéricos de X%, Y%, escala, rotação, giro horizontal (perspectiva), distorções skewX/Y, e botões de warp/camada. Inicializa o canvas chamando as funções AEQ já existentes.

| Dependência | Tipo | Origem |
|---|---|---|
| `INV` | objeto global | módulo inventário |
| `RPG_DATA` | objeto global | contexto RPG |
| `_resolveItemImgSrc()` | função | local |
| `_normalizarSlotParaTipo()` | função | local |
| `_aeqRenderChar()` | função | local (AEQ) |
| `_aeqSetCamada()` | função | local (AEQ) |
| `_aeqUpdateVisual()` | função | local (AEQ) |
| `_aeqPositionDrag()` | função | local (AEQ) |
| `_aeqAttachHandlers()` | função | local (AEQ) |

---

**`invConfirmarPosicionarEquip()`** — linha ~4236  
Async. Lê posição atual do working state + inputs numéricos, atualiza `equipamentos_visuais[idx]` com x/y/escala/rotação/skews/warpCorners/camada, nulifica `composed_img` (para forçar re-render dinâmico), e faz PATCH em `characters`. Após salvar, fecha o overlay, exibe toast, recarrega `renderInvVisual`, atualiza mapa/char view imediatamente. Em background gera nova `composed_img` via `_aeqGenerateComposedImg` e atualiza novamente.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `renderInvVisual()` | função | local |
| `_aeqGenerateComposedImg()` | função | local (AEQ) |
| `_aeqComputeMatrix3d()` | função | local (AEQ) |
| `_aeqOnMove` / `_aeqOnUp` | handlers | local (AEQ) |
| `apmodAtualizarPreview()` | função | local (APMOD) |
| `mapaRenderTokens()` | função | módulo mapa |
| `renderCharView()` | função | módulo char |
| `renderAttrView()` | função | módulo char |
| `MAPA_STATE` | objeto global | módulo mapa |

---

### Bloco 21 — I2: Detalhe de Item, Equip/Desequip, Remoção (linhas 4326–4587)

**`invClicarItem(invId)`** — linha 4326  
Abre o modal de detalhe de item `#modal-inv-item-overlay`. Renderiza card com ícone visual, badges de raridade/nível, descrição e lista colorida de bônus positivos/negativos e efeitos. Injeta botões contextuais: "⬆ Equipar" (bloqueado se nível insuficiente), "🔽 Desequipar", "🗑 Remover" (visíveis apenas para quem pode editar) e "Fechar".

| Dependência | Tipo | Origem |
|---|---|---|
| `INV` | objeto global | módulo inventário |
| `RPG_DATA` | objeto global | contexto RPG |
| `RARIDADE_CORES` | objeto | local |
| `_itemIcon()` | função | local |
| `_descreverEfeito()` | função | local |
| `podeEditarPersonagem()` | função | módulo personagem |
| `invEquipar()` | função | local |
| `invDesequipar()` | função | local |
| `invRemoverItem()` | função | local |

---

**`invEquipar(invId)`** — linha 4417  
Async (I3). Pipeline de equip:
1. Bloqueia se nível insuficiente.
2. Exibe aviso de trade-off e pede confirmação.
3. Resolve slot-alvo; amuletos são redirecionados para `slot_amuleto` se o slot principal estiver ocupado e aceitar aninhamento.
4. Se o slot estiver ocupado, desequipa o item atual silenciosamente (`invDesequipar(..., true)`).
5. Aplica `atributos_bonus` ao `custom_attrs` do personagem, calculando `delta` (absoluto ou `%`), e persiste o snapshot.
6. PATCH em `characters` e `inventario`. Atualiza estado local e chama `renderCharView`/`renderAttrView`.

| Dependência | Tipo | Origem |
|---|---|---|
| `INV` | objeto global | módulo inventário |
| `RPG_DATA` | objeto global | contexto RPG |
| `CURRENT_RPG` | objeto global | contexto RPG |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `invDesequipar()` | função | local |
| `renderInvCompleto()` | função | local |
| `renderCharView()` | função | módulo char |
| `renderAttrView()` | função | módulo char |

---

**`invDesequipar(invId, silencioso?)`** — linha 4517  
Async (I3). Reverte os atributos usando `bonus_snapshot` (ou fallback por `atributos_bonus` absolutos). PATCH em `characters` e `inventario` (limpa `equipado`, `slot_equipado`, `bonus_snapshot`). Se não silencioso, fecha o modal, exibe toast e recarrega a view.

| Dependência | Tipo | Origem |
|---|---|---|
| `INV` | objeto global | módulo inventário |
| `RPG_DATA` | objeto global | contexto RPG |
| `CURRENT_RPG` | objeto global | contexto RPG |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `renderInvCompleto()` | função | local |
| `renderCharView()` | função | módulo char |
| `renderAttrView()` | função | módulo char |

---

**`invRemoverItem(invId)`** — linha 4574  
Async. Desequipa silenciosamente se necessário, pede confirmação, executa DELETE em `inventario`, remove do estado local e fecha o modal.

| Dependência | Tipo | Origem |
|---|---|---|
| `INV` | objeto global | módulo inventário |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `invDesequipar()` | função | local |
| `renderInvCompleto()` | função | local |

---

### Bloco 22 — I2: Adicionar Item, Level-Up Unlock (linhas 4590–4696)

**`abrirAdicionarItemInv()`** — linha 4590  
Async. Abre `#modal-add-inv-overlay` e carrega `item_catalog` do RPG atual em `INV.catalogo`. Chama `filtrarAddInv` para renderizar a lista.

| Dependência | Tipo | Origem |
|---|---|---|
| `CURRENT_RPG` | objeto global | contexto RPG |
| `INV` | objeto global | módulo inventário |
| `sb()` | função | Supabase helper |
| `filtrarAddInv()` | função | local |

---

**`filtrarAddInv()`** — linha 4604  
Filtra `INV.catalogo` por busca textual (máx 50 resultados) e renderiza cada item como card clicável com ícone, raridade e aviso de bloqueio por nível.

| Dependência | Tipo | Origem |
|---|---|---|
| `INV` | objeto global | módulo inventário |
| `RPG_DATA` | objeto global | contexto RPG |
| `RARIDADE_CORES` | objeto | local |
| `_itemIcon()` | função | local |
| `addInvConfirmar()` | função | local |

---

**`addInvConfirmar(catalogId)`** — linha 4626  
Async. Insere em `inventario` com `origem:'doacao_mestre'`, definindo `bloqueado_por_nivel` se o nível do personagem for insuficiente. Fecha o modal, recarrega o inventário e emite broadcast via `_invBroadcastDrop`.

| Dependência | Tipo | Origem |
|---|---|---|
| `INV` | objeto global | módulo inventário |
| `RPG_DATA` | objeto global | contexto RPG |
| `CURRENT_RPG` | objeto global | contexto RPG |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `carregarInventarioChar()` | função | local |
| `_invBroadcastDrop()` | função | local |

---

**`verificarDesbloqueioItens(nomeChar, novoNivel)`** — linha 4653  
Async (I4). Busca todos os itens bloqueados por nível do personagem e, para os que o novo nível já permite, faz PATCH `bloqueado_por_nivel = false` e emite toast de desbloqueio. Recarrega o inventário se estiver aberto.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |
| `INV` | objeto global | módulo inventário |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `_invBroadcastDrop()` | função | local |
| `carregarInventarioChar()` | função | local |

---

**Hook `executarLevelUp`** — linha 4683  
Intercepta `window.executarLevelUp`: chama o original, compara o nível antes e depois e, se houve avanço, chama `verificarDesbloqueioItens`. Só instala o hook se a função original existir.

| Dependência | Tipo | Origem |
|---|---|---|
| `window.executarLevelUp` | função | módulo personagem |
| `verificarDesbloqueioItens()` | função | local |
| `RPG_DATA` | objeto global | contexto RPG |

---

### Bloco 23 — I6: Sistema de Moedas (linhas 4698–4825)

**`MOEDAS_DEFAULTS`** — linha 4699  
Array com 3 denominações padrão de moeda: Ouro (🟡, base 100), Prata (⚪, base 10), Cobre (🟤, base 1).

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`renderInvMoedas()`** — linha 4705  
Async (I6). Busca a bolsa do personagem em `moedas` e o histórico recente em `log_transacoes` (10 últimas entradas onde o personagem é dono ou destino). Renderiza cada denominação com saldo e botões "Adicionar / Remover / Transferir" (visíveis para editores e mestre), seguido de histórico colorido (verde=entrada, vermelho=saída).

| Dependência | Tipo | Origem |
|---|---|---|
| `INV` | objeto global | módulo inventário |
| `CURRENT_RPG` | objeto global | contexto RPG |
| `RPG_DATA` | objeto global | contexto RPG |
| `MOEDAS_DEFAULTS` | array | local |
| `sb()` | função | Supabase helper |
| `podeEditarPersonagem()` | função | módulo personagem |
| `abrirTxMoeda()` | função | local |

---

**`invTrocarAba(aba)`** — linha 4770  
Alterna tabs do inventário (`.inv-tab`) e exibe/oculta painéis `.inv-aba`. Ao selecionar `moedas`, `bau` ou `visual`, chama a função de renderização correspondente.

| Dependência | Tipo | Origem |
|---|---|---|
| `renderInvMoedas()` | função | local |
| `renderInvBau()` | função | local |
| `renderInvVisual()` | função | local |

---

**`_criarModalMoedaTxSeNecessario()`** — linha 4786  
Lazy-creates o overlay `#modal-moeda-tx-overlay` (se não existir no DOM) com campos para denominação, quantidade, destino (transferência) e descrição.

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

### Bloco 24 — I6: Transações de Moeda (linhas 4827–4903)

**`abrirTxMoeda(tipo, denomDefault)`** — linha 4827  
Abre o modal de transação (lazy-criado por `_criarModalMoedaTxSeNecessario`). Preenche os campos com título, denominações do RPG (ou `MOEDAS_DEFAULTS`), e exibe/oculta o campo de destino conforme o tipo (`transferir`).

| Dependência | Tipo | Origem |
|---|---|---|
| `_criarModalMoedaTxSeNecessario()` | função | local |
| `MOEDAS_DEFAULTS` | array | local |
| `CURRENT_RPG` | objeto global | contexto RPG |
| `RPG_DATA` | objeto global | contexto RPG |
| `INV` | objeto global | módulo inventário |

---

**`confirmarTransacaoMoeda()`** — linha 4847  
Async. Executa a transação monetária: para `dar`/`remover` chama `_moedaUpsert` direto; para `transferir` verifica saldo primeiro e faz dois upserts. Registra log via `_moedaLog` e atualiza a view.

| Dependência | Tipo | Origem |
|---|---|---|
| `INV` | objeto global | módulo inventário |
| `CURRENT_RPG` | objeto global | contexto RPG |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `_moedaUpsert()` | função | local |
| `_moedaLog()` | função | local |
| `renderInvMoedas()` | função | local |

---

**`_moedaUpsert(charId, denominacao, delta)`** — linha 4880  
Async. Busca o registro atual de moedas (`moedas` table), soma o delta e faz PATCH (se existe) ou POST (se novo). Garante saldo mínimo 0.

| Dependência | Tipo | Origem |
|---|---|---|
| `CURRENT_RPG` | objeto global | contexto RPG |
| `sb()` | função | Supabase helper |

---

**`_moedaLog(donoId, destinoId, denominacao, quantidade, tipo, descricao)`** — linha 4896  
Async. Insere registro em `log_transacoes`. Silencia erros (log é opcional).

| Dependência | Tipo | Origem |
|---|---|---|
| `CURRENT_RPG` | objeto global | contexto RPG |
| `sb()` | função | Supabase helper |

---

### Bloco 25 — I6: Configuração de Moedas e Broadcast (linhas 4905–5033)

**`_cfgMoedasTemp`** — linha 4907  
Estado temporário do editor de denominações de moeda (array local).

**`cfgMoedasRender()`** — linha 4909  
Renderiza em `#cfg-moedas-lista` a lista editável de denominações: campos de emoji, nome, valor base, botões de mover (▲/▼) e remover (🗑).

| Dependência | Tipo | Origem |
|---|---|---|
| `_cfgMoedasTemp` | variável | local |
| `_cfgMoedasMover()` / `_cfgMoedasRemover()` | funções | local |

---

**`cfgMoedasInit()`** — linha 4936  
Inicializa `_cfgMoedasTemp` com as denominações atuais do RPG (ou `MOEDAS_DEFAULTS`) e chama `cfgMoedasRender`.

| Dependência | Tipo | Origem |
|---|---|---|
| `CURRENT_RPG` | objeto global | contexto RPG |
| `MOEDAS_DEFAULTS` | array | local |
| `cfgMoedasRender()` | função | local |

---

**`_cfgMoedasRemover(i)`** / **`_cfgMoedasMover(i, dir)`** — linhas 4944 / 4949  
Remove ou reordena uma denominação em `_cfgMoedasTemp` e re-renderiza.

| Dependência | Tipo | Origem |
|---|---|---|
| `_cfgMoedasTemp` | variável | local |
| `cfgMoedasRender()` | função | local |

---

**`cfgMoedasAdicionar()`** — linha 4956  
Lê os campos `#cfg-moeda-nova-*`, adiciona a nova denominação em `_cfgMoedasTemp` e re-renderiza.

| Dependência | Tipo | Origem |
|---|---|---|
| `mostrarToast()` | função | global UI |
| `cfgMoedasRender()` | função | local |

---

**`cfgMoedasSalvar()`** — linha 4968  
Async. Valida a lista, lê `theme_json` de `rpg_registry`, substitui `denominacoes_moeda`, faz PATCH e atualiza `CURRENT_RPG.theme` localmente.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |
| `CURRENT_RPG` | objeto global | contexto RPG |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |

---

**`_invBroadcastDrop(it, personagemDestino, origem)`** — linha 4992  
Emite evento `item_dropado` via WebSocket (`ws`) no canal realtime do RPG. Silencia erros pois é broadcast opcional.

| Dependência | Tipo | Origem |
|---|---|---|
| `ws` | objeto global | WebSocket |
| `CURRENT_RPG` | objeto global | contexto RPG |

---

**`_itemIcon(it)`** — linha 5015  
Retorna HTML de ícone de um item: `<img>` se `img_url` ou `visual_config.valor` (url), emoji se `tipo_visual === 'emoji'`, ou fallback de `TIPO_DEFAULTS` / `it.icone`.

| Dependência | Tipo | Origem |
|---|---|---|
| `TIPO_DEFAULTS` | objeto | local |

---

**`window.emitirEvento`** — linha 5026  
Wrapper global que delega para `_invBroadcastDrop`. Exposto para que o módulo de Catálogo (Parte 1) possa emitir eventos de item doado.

| Dependência | Tipo | Origem |
|---|---|---|
| `_invBroadcastDrop()` | função | local |

---

**`_patchWsItemDropado(payload)`** + **`_wsCheckInterval`** — linhas 5037 / 5070  
`_patchWsItemDropado` exibe um card animado no canto superior direito ao receber evento `item_dropado` via WebSocket (cor/animação por raridade, bônus coloridos, destino). `_wsCheckInterval` faz monkey-patch no `ws.onmessage` quando o WebSocket estiver disponível (polling a cada 500ms, auto-limpa).

| Dependência | Tipo | Origem |
|---|---|---|
| `ws` | objeto global | WebSocket |
| `RARIDADE_CORES` | objeto | local |
| `_itemIcon()` | função | local |

---

### Bloco 26 — I7: Vocabulário Temático e Geração de Nomes (linhas 5087–5207)

Sistema de geração procedural de nomes de itens com 3 partes: material, adjetivo e origem (opcional para raro+).

**`VOCAB_FALLBACK`** — linha 5091  
Vocabulário genérico de fantasia com listas de `prefixo_material`, `adjetivo_qualidade` e `nome_origem`.

**`_vocabCache`** — linha 5098 / **`carregarVocabulario(rpgId)`** — linha 5100  
Cache de vocabulário por `rpgId`. `carregarVocabulario` busca `vocabulario_tematico` no Supabase, completa com `VOCAB_FALLBACK` e armazena no cache.

| Dependência | Tipo | Origem |
|---|---|---|
| `sb()` | função | Supabase helper |

---

**`NOMES_BASE_TIPO`** — linha 5120  
Mapa `tipo_canonico → { subtipo → nome_base_pt }` para 10 tipos de item.

**`_gerarPartesNome(rpgId, tipo, subtipo, raridade)`** — linha 5135  
Async. Carrega vocabulário, sorteia `material`, `adjetivo` e (raro+, 60%) `nome_origem`.

| Dependência | Tipo | Origem |
|---|---|---|
| `carregarVocabulario()` | função | local |
| `NOMES_BASE_TIPO` | objeto | local |

---

**`_montarNomeGerado(nomeBase, material, adjetivo, origem)`** — linha 5150  
Concatena as partes em string final.

**`itemGerarNome()`** — linha 5157 / **`itemAtualizarNomeGerado()`** — linha 5175 / **`itemAplicarNomeGerado()`** — linha 5186  
Funções UI: geram partes, atualizam preview e aplicam o nome final ao campo `#fi-nome`.

| Dependência | Tipo | Origem |
|---|---|---|
| `_gerarPartesNome()` / `_montarNomeGerado()` | funções | local |
| `NOMES_BASE_TIPO` | objeto | local |
| `RPG_DATA` | objeto global | contexto RPG |

---

**`gerarNomeItem(rpgId, tipo, subtipo, raridade)`** — linha 5204  
API pública async que retorna o nome completo gerado.

| Dependência | Tipo | Origem |
|---|---|---|
| `_gerarPartesNome()` / `_montarNomeGerado()` | funções | local |

---

### Bloco 27 — I8: Geração Automática de Status de Item (linhas 5211–5390)

Sistema que gera `atributos_bonus`, `trade_offs`, `efeitos` e `visual_config` automaticamente com base em tier, raridade e grupo de atributo.

**Constantes** (linhas 5215–5248): `_FATOR_ESCALA` (fator de bônus por tier/raridade), `_BORDA_RARIDADE`, `_ANIMACAO_RARIDADE`, `_EFEITOS_TIPO` (gatilhos por tipo), `_CHANCE_EFEITO` (5%–100% por raridade).

**`gerarStatusItem(rpgId, tipoCanônico, grupoAtributo, tierInimigo, raridade, slotFuncional, personagemAlvo?)`** — linha 5254  
Async (I8). Pipeline de 7 passos: (1) bônus base via `calcularMediaGrupo × fator × variância`; (2) clamp de progressão se há personagem alvo; (3) bônus secundário 40% chance; (4) trade-off 30% chance; (5) efeitos por `_EFEITOS_TIPO`/`_CHANCE_EFEITO`; (6) visual automático; (7) metadados de geração. Retorna `{ atributos_bonus, trade_offs, efeitos, nivel, visual_config, params_geracao }`.

| Dependência | Tipo | Origem |
|---|---|---|
| `calcularMediaGrupo()` | função | local (A3) |
| `carregarMapeamento()` | função | local (A1) |
| `sb()` | função | Supabase helper |
| `RPG_DATA` | objeto global | contexto RPG |

---

### Bloco 28 — I9: Drop Automático por Tier (linhas 5391–5603)

**Constantes** (linhas 5398–5426):

| Constante | Descrição |
|---|---|
| `_DROP_QTDE` | Configuração de drop por tier: chance de item, min/max itens e raridades possíveis |
| `_PESO_RARIDADE_TIER` | Pesos de raridade por tier para sorteio ponderado |
| `_CHANCE_NIVEL_ACIMA` / `_MAX_NIVEL_ACIMA` | Chance e limite de nível acima do NPC por raridade |

---

**`_sortearRaridade(tier)`** — linha 5413  
Sorteio ponderado de raridade dado um tier, usando `_PESO_RARIDADE_TIER`.

| Dependência | Tipo | Origem |
|---|---|---|
| `_PESO_RARIDADE_TIER` | objeto | local |

---

**`_calcularNivelItem(tier, raridade, npcNivel)`** — linha 5428  
Calcula o nível do item dropado: com pequena chance (`_CHANCE_NIVEL_ACIMA`) o item pode ser acima do nível do NPC.

| Dependência | Tipo | Origem |
|---|---|---|
| `_CHANCE_NIVEL_ACIMA` / `_MAX_NIVEL_ACIMA` | objetos | local |

---

**`calcularDrops(rpgId, npcTier, npcNivel, npcGrupoAtributo)`** — linha 5439  
Async. Sorteia quantos itens dropar (baseado em `_DROP_QTDE[tier]`), sorteia tipo, raridade e slot para cada item, e retorna a lista de specs `{ tipo, raridade, grupoAtributo, slot, nivel }`.

| Dependência | Tipo | Origem |
|---|---|---|
| `_DROP_QTDE` | objeto | local |
| `_sortearRaridade()` | função | local |
| `_calcularNivelItem()` | função | local |

---

**`_executarDropNPC(rpgId, npcNome, npcChar)`** — linha 5468  
Async. Orquestra o drop completo de um NPC morto: chama `calcularDrops`, para cada spec chama `gerarStatusItem` e `gerarNomeItem`, insere em `item_catalog`, cria registro em `loot_pendente`, faz broadcast via `emitirEvento`/`combateBroadcast`, exibe o card de drop localmente via `_patchWsItemDropado` (500ms entre cards), e atualiza `custom_attrs.morto/tem_loot` do NPC re-renderizando tokens.

| Dependência | Tipo | Origem |
|---|---|---|
| `calcularDrops()` | função | local |
| `gerarStatusItem()` | função | local (I8) |
| `gerarNomeItem()` | função | local (I7) |
| `sb()` | função | Supabase helper |
| `emitirEvento()` | função | local |
| `combateBroadcast()` | função | módulo combate |
| `_patchWsItemDropado()` | função | local |
| `RPG_DATA` | objeto global | contexto RPG |
| `MAPA_STATE` | objeto global | módulo mapa |
| `mapaRenderTokens()` | função | módulo mapa |

---

**`window._patchTokenLoot`** — linha 5588  
Patch aplicado pelo módulo de mapa ao renderizar tokens: adiciona badge `✝💰` animado sobre tokens de NPCs mortos com loot pendente. Clique abre `abrirModalLootNPC`.

| Dependência | Tipo | Origem |
|---|---|---|
| `abrirModalLootNPC()` | função | local (I10) |

---

**IIFE `injectStyles3A`** — linha 5611  
Injeta CSS de animações de I7 (painel `#fi-nome-partes`) e I9 (`.loot-badge` pulse) no `<head>`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

### Bloco 29 — I10: Saque no Mapa + I11: Baú do Grupo (linhas 5634–5903)

**`_renderItemCard(it, opts?)`** — linha 5642  
Helper compartilhado por I10/I11/I12/I13. Gera HTML de card de item com: badge de raridade colorido, ícone, nome, bônus positivos/negativos, efeitos (proc/aura), indicadores de bloqueio e trade-off severo, animação CSS e botão de ação opcional.

| Dependência | Tipo | Origem |
|---|---|---|
| `RARIDADE_CORES` | objeto | local |
| `_itemIcon()` | função | local |

---

**`LOOT_STATE`** — linha 5700  
Estado do modal de saque: `npcNome`, `itens`, `selecionados` (Set de índices).

**`window.abrirModalLootNPC(npcNome)`** — linha 5702  
Async (I10). Busca `loot_pendente` não saqueado do NPC, carrega detalhes dos itens, popula selector de personagem destino (jogadores vivos) e abre `#modal-loot-overlay`.

| Dependência | Tipo | Origem |
|---|---|---|
| `LOOT_STATE` | objeto | local |
| `RPG_DATA` | objeto global | contexto RPG |
| `CURRENT_RPG` | objeto global | contexto RPG |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `renderLootCards()` | função | local |

---

**`renderLootCards()`** — linha 5740  
Renderiza os cards de loot em `#loot-cards-grid` usando `_renderItemCard` com toggle de seleção.

| Dependência | Tipo | Origem |
|---|---|---|
| `LOOT_STATE` | objeto | local |
| `_renderItemCard()` | função | local |

---

**`window.toggleLootSel(i)`** — linha 5752  
Alterna seleção do item no índice `i` no `LOOT_STATE.selecionados` e re-renderiza.

| Dependência | Tipo | Origem |
|---|---|---|
| `LOOT_STATE` | objeto | local |
| `renderLootCards()` | função | local |

---

**`window.confirmarSaque()`** — linha 5758  
Async. Para cada item selecionado: insere em `inventario` (origem `'saque'`), faz PATCH em `loot_pendente` (marca `saqueado = true`), e chama `_invBroadcastDrop`. Fecha o modal.

| Dependência | Tipo | Origem |
|---|---|---|
| `LOOT_STATE` | objeto | local |
| `RPG_DATA` | objeto global | contexto RPG |
| `CURRENT_RPG` | objeto global | contexto RPG |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `_invBroadcastDrop()` | função | local |
| `INV` | objeto global | módulo inventário |

---

**`window.fecharModalLoot()`** — linha 5802  
Oculta `#modal-loot-overlay`.

---

**`BAU_STATE`** — linha 5810  
Estado do baú do grupo: `itens`, `carregado`.

**`renderInvBau()`** — linha 5812  
Async (I11). Busca `inventario` onde `personagem_nome = 'grupo'` com JOIN em `item_catalog`. Renderiza grid de cards com botão "⬇ Retirar" e seção de depósito do inventário do personagem ativo.

| Dependência | Tipo | Origem |
|---|---|---|
| `BAU_STATE` | objeto | local |
| `RPG_DATA` | objeto global | contexto RPG |
| `CURRENT_RPG` | objeto global | contexto RPG |
| `INV` | objeto global | módulo inventário |
| `sb()` | função | Supabase helper |
| `_renderItemCard()` | função | local |
| `renderBauDepositarLista()` | função | local |

---

**`renderBauDepositarLista()`** — linha 5869  
Renderiza em `#bau-depositar-lista` os itens não equipados do personagem ativo com botão "⬆ Depositar".

| Dependência | Tipo | Origem |
|---|---|---|
| `INV` | objeto global | módulo inventário |
| `_renderItemCard()` | função | local |

---

**`window.bauDepositarItem(instId)`** — linha 5883  
Async. Transfere item para o baú do grupo (PATCH `personagem_nome = 'grupo'`, `character_id = null`), emite broadcast e recarrega o baú.

| Dependência | Tipo | Origem |
|---|---|---|
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `_invBroadcastDrop()` | função | local |
| `INV` | objeto global | módulo inventário |
| `BAU_STATE` | objeto | local |
| `renderInvBau()` | função | local |

---

**`window.bauRetirarItem(instId)`** — linha 5905  
Async. Transfere item do baú de volta para o inventário do personagem ativo (PATCH `personagem_nome` e `character_id`), limpa caches `BAU_STATE.carregado` e `INV.carregado`, recarrega baú e inventário.

| Dependência | Tipo | Origem |
|---|---|---|
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `INV` | objeto global | módulo inventário |
| `BAU_STATE` | objeto | local |
| `renderInvBau()` | função | local |
| `carregarInventarioChar()` | função | local |

---

### Bloco 30 — I12: Trade entre Jogadores (linhas 5922–6097)

Sistema de troca direta de itens entre personagens via proposta/aceitação com broadcast WS.

**`TRADE_STATE`** — linha 5926  
Estado do trade: `{ remetente, remetenteId, destinatario, destinatarioId, itens_selecionados: Set(), proposta_pendente }`.

---

**`abrirModalTrade(charNome, charId)`** — linha 5933  
Async. Inicializa `TRADE_STATE`, carrega mochila do remetente via `INV`, popula select de destinatário com personagens vivos do RPG. Exibe `#modal-trade-overlay`.

| Dependência | Tipo | Origem |
|---|---|---|
| `TRADE_STATE` | objeto | local |
| `INV` | objeto global | módulo inventário |
| `RPG_DATA` | objeto global | contexto RPG |
| `_renderItemCard()` | função | local |

---

**`window.toggleTradeSel(instId)`** — linha 5965  
Alterna seleção de item no modal de trade. Aplica/remove destaque visual (`box-shadow` verde) em `#trade-item-${instId}` e atualiza `TRADE_STATE.itens_selecionados`.

| Dependência | Tipo | Origem |
|---|---|---|
| `TRADE_STATE` | objeto | local |

---

**`window.enviarProposta()`** — linha 5976  
Async. Insere registro em tabela `trades` (POST), obtém `tradeId` retornado, chama `_broadcastTradeEvento('trade_proposta', ...)`. Exibe toast de confirmação e fecha modal.

| Dependência | Tipo | Origem |
|---|---|---|
| `TRADE_STATE` | objeto | local |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `_broadcastTradeEvento()` | função | local |
| `RPG_DATA` | objeto global | contexto RPG |

---

**`window.responderTrade(acao)`** — linha 6013  
Async. Se `acao === 'aceitar'`: faz PATCH em cada registro `inventario` transferindo propriedade ao destinatário e broadcasts `trade_aceito`. Se `acao === 'recusar'`: broadcasts `trade_recusado`. Usa `proposta.tradeId` para filtro preciso.

| Dependência | Tipo | Origem |
|---|---|---|
| `TRADE_STATE` | objeto | local |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `_broadcastTradeEvento()` | função | local |
| `INV` | objeto global | módulo inventário |

---

**`_broadcastTradeEvento(evento, dados)`** — linha 6065  
Envia broadcast WS no canal `realtime:rpg:${rpgId}` com o evento e payload fornecidos.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |
| `realtimeWS` | WebSocket global | módulo realtime |

---

**`window.fecharModalTrade()`** — linha 6078  
Oculta `#modal-trade-overlay` e limpa `TRADE_STATE.itens_selecionados`.

| Dependência | Tipo | Origem |
|---|---|---|
| `TRADE_STATE` | objeto | local |

---

**`adicionarBotaoTrade(charNome, charId)`** — linha 6084  
Injeta botão "🔄 Propor Trade" após `#inv-mochila-lista`. Ao clicar, chama `abrirModalTrade(charNome, charId)`.

| Dependência | Tipo | Origem |
|---|---|---|
| `abrirModalTrade()` | função | local |

---

### Bloco 31 — Mobile Controls FASE 3B: Overlay + D-pad (linhas 6100–6450)

Sistema de controle mobile com overlay full-screen de 3 zonas (D-pad 8 direções, stats/skills/turno, botões contextuais). Ativa automaticamente em landscape ou manualmente via botão.

**`MOBILE_CTRL`** — linha 6105  
Estado do controle mobile: `ativo`, `ativadoManualmente`, `modoPet`, `petNome`, `_joystickEl`, `_joystickAtivo`, `_joystickOrigemX/Y`, `_joystickMoveTimer`, `_tradeBadgeEl`, `_tradeProposta`.

---

**`isMobileLandscape()`** — linha 6118  
Retorna `true` se dispositivo touch com `window.innerWidth > window.innerHeight` e altura ≤ 1024px.

| Dependência | Tipo | Origem |
|---|---|---|
| `navigator.maxTouchPoints` | propriedade browser | Web API |

---

**`_verificarModoMobile()`** — linha 6124  
Auto-ativa ou desativa o controle mobile com base na detecção de landscape. Ignora ação se `MOBILE_CTRL.ativadoManualmente` estiver definido.

| Dependência | Tipo | Origem |
|---|---|---|
| `MOBILE_CTRL` | objeto | local |
| `isMobileLandscape()` | função | local |
| `_ativarControleMobile()` | função | local |
| `_desativarControleMobile()` | função | local |

---

**`desbloquearOrientacaoPWA()`** — linha 6137  
Chama `screen.orientation.unlock()` com múltiplos fallbacks de vendor (`mozUnlockOrientation`, `msUnlockOrientation`) para liberar travamento de orientação em PWA.

| Dependência | Tipo | Origem |
|---|---|---|
| `screen.orientation` | Web API | browser |

---

**`_atualizarBannerControleMobile()`** — linha 6157  
Mostra/oculta `#mobile-controle-banner`. Visível apenas em dispositivos touch, na aba mapas, com personagem vinculado.

| Dependência | Tipo | Origem |
|---|---|---|
| `MOBILE_CTRL` | objeto | local |
| `RPG_DATA` | objeto global | contexto RPG |

---

**`toggleControleMobile()`** — linha 6170  
Toggle manual do modo controle mobile. Define `MOBILE_CTRL.ativadoManualmente` e delega para `_ativarControleMobile()` ou `_desativarControleMobile()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `MOBILE_CTRL` | objeto | local |
| `_ativarControleMobile()` | função | local |
| `_desativarControleMobile()` | função | local |
| `_atualizarBannerControleMobile()` | função | local |

---

**`_atualizarBotaoControleMobile()`** — linha 6183  
Atualiza texto e estilos de cor do `#btn-modo-controle` conforme `MOBILE_CTRL.ativo`.

| Dependência | Tipo | Origem |
|---|---|---|
| `MOBILE_CTRL` | objeto | local |

---

**`_ativarControleMobile()`** — linha 6202  
Ativa o modo controle mobile: verifica pré-condições (mapa ativo, personagem vinculado), cria e exibe `#mobile-ctrl-overlay` com grid 3-colunas (35%/30%/35%), bloqueia sidebar via `pointer-events:none`, adapta layout a mudanças de orientação.

| Dependência | Tipo | Origem |
|---|---|---|
| `MOBILE_CTRL` | objeto | local |
| `MAPA_STATE` | objeto global | módulo mapa |
| `RPG_DATA` | objeto global | contexto RPG |
| `mostrarToast()` | função | global UI |
| `isMobileLandscape()` | função | local |
| `_htmlControleMobile()` | função | local |
| `_iniciarJoystick()` | função | local |
| `_atualizarZonaCentral()` | função | local |
| `_atualizarZonaDireita()` | função | local |
| `_atualizarBotaoControleMobile()` | função | local |
| `_atualizarEstadoDpad()` | função | local |

---

**`_desativarControleMobile()`** — linha 6267  
Desativa modo controle mobile: oculta `#mobile-ctrl-overlay`, restaura `pointer-events` e `visibility` da sidebar, atualiza botão e banner.

| Dependência | Tipo | Origem |
|---|---|---|
| `MOBILE_CTRL` | objeto | local |
| `_atualizarBotaoControleMobile()` | função | local |
| `_atualizarBannerControleMobile()` | função | local |

---

**`_htmlControleMobile()`** — linha 6283  
Retorna string HTML com as 3 zonas do overlay mobile: zona esquerda (grid D-pad 8 direções 3×3), zona central (tab pet/personagem, stats HP/recurso/movimento, botão sair, skills próprias, status turno), zona direita (container de botões contextuais).

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

**IIFE `_injetarCssDpad()`** — linha 6340  
IIFE que injeta `<style id="css-dpad">` com estilos para `.mc-dpad-btn`, `.mc-dpad-main`, `.mc-dpad-diag` e estado `:active`/`.pressionado`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

**`window._dpadPress(dc, dr)`** — linha 6378  
Handler de `ontouchstart` do D-pad. Salva direção em `_DPAD_DC/DR`, chama `_dpadMoverToken()` imediatamente e dispara vibração tátil (18ms).

| Dependência | Tipo | Origem |
|---|---|---|
| `_dpadMoverToken()` | função | local |
| `navigator.vibrate` | Web API | browser |

---

**`window._dpadRelease()`** — linha 6385  
Handler de `ontouchend` do D-pad. Reseta `_DPAD_DC/DR` para 0 e cancela timer de repetição `_DPAD_TIMER`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`_dpadMoverToken(dc, dr)`** — linha 6393  
Move token pelo D-pad. Em batalha: verifica se é o turno do personagem e se há movimento restante; após mover, debita custo (1 por casa ortogonal, ⌈√2⌉ ≈ 2 para diagonais) de `bs.movimentoRestante` e atualiza UI. Fora de batalha: movimento livre.

| Dependência | Tipo | Origem |
|---|---|---|
| `MOBILE_CTRL` | objeto | local |
| `RPG_DATA` | objeto global | contexto RPG |
| `BATALHA_ATUAL_ID` | variável global | módulo batalha |
| `MAPA_STATE` | objeto global | módulo mapa |
| `movGetRestante()` | função | módulo movimento |
| `movCalcVelocidade()` | função | módulo movimento |
| `_moverTokenPorSeta()` | função | módulo mapa |
| `mostrarToast()` | função | global UI |
| `_atualizarMovInfo()` | função | local |
| `_atualizarZonaCentral()` | função | local |
| `_atualizarEstadoDpad()` | função | local |

---

### Bloco 32 — Mobile Controls FASE 3B: Funções Auxiliares + Trade Badge + WS (linhas 6451–7001)

Continuação do sistema de controle mobile: funções auxiliares de estado, zona central (stats/skills/turno), zona direita (botões contextuais de batalha e itens), badge de trade não-intrusivo e integração com WS.

**`_iniciarJoystick()`** — linha 6453  
Stub de compatibilidade. O D-pad funciona via `ontouchstart` — nada a inicializar.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`_podeMovimentarMobile(charNome)`** — linha 6461  
Retorna `true` se o personagem pode se mover: fora de batalha sempre pode; em batalha verifica se é o turno do char e se há movimento restante (`movGetRestante > 0`).

| Dependência | Tipo | Origem |
|---|---|---|
| `BATALHA_ATUAL_ID` | variável global | módulo batalha |
| `MAPA_STATE` | objeto global | módulo mapa |
| `movGetRestante()` | função | módulo movimento |

---

**`_atualizarEstadoDpad()`** — linha 6477  
Aplica `opacity:0.4` e `pointer-events:none` em todos os `.mc-dpad-btn` quando `_podeMovimentarMobile` retorna `false`. Atualiza indicador de movimento via `_atualizarMovInfo()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `MOBILE_CTRL` | objeto | local |
| `RPG_DATA` | objeto global | contexto RPG |
| `_podeMovimentarMobile()` | função | local |
| `_atualizarMovInfo()` | função | local |

---

**`_atualizarZonaCentral()`** — linha 6506  
Atualiza a zona central do overlay mobile. Renderiza barra de HP (colorida por %), até 2 recursos de status com barra, movimento restante em batalha, tab pet/personagem (3.8), botões de skills de alvo próprio quando é o turno (3.7) e indicador de turno.

| Dependência | Tipo | Origem |
|---|---|---|
| `MOBILE_CTRL` | objeto | local |
| `RPG_DATA` | objeto global | contexto RPG |
| `BATALHA_ATUAL_ID` | variável global | módulo batalha |
| `movGetRestante()` | função | módulo movimento |
| `movCalcVelocidade()` | função | módulo movimento |
| `_encontrarPetVinculado()` | função | local |
| `_esMeuTurnoMobile()` | função | local |
| `atkGetHabilidadesCampanha()` | função | módulo ataque |

---

**`_encontrarPetVinculado(donoNome)`** — linha 6612  
Percorre `RPG_DATA.characters` e retorna o nome do primeiro personagem com `custom_attrs.eh_pet === true` e `pet_dono === donoNome`.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |

---

**`_esMeuTurnoMobile(charNome)`** — linha 6621  
Retorna `true` se `charNome` é o participante atual na batalha ativa, a batalha está na fase `combate` e não está pausada.

| Dependência | Tipo | Origem |
|---|---|---|
| `BATALHA_ATUAL_ID` | variável global | módulo batalha |
| `MAPA_STATE` | objeto global | módulo mapa |

---

**`window.mobileCtrlSetModo(modoPet)`** — linha 6631  
Alterna entre controle de personagem e pet (`MOBILE_CTRL.modoPet`). Atualiza zona central, direita e estado do D-pad. Exibe toast indicando o personagem controlado.

| Dependência | Tipo | Origem |
|---|---|---|
| `MOBILE_CTRL` | objeto | local |
| `mostrarToast()` | função | global UI |
| `_atualizarZonaCentral()` | função | local |
| `_atualizarZonaDireita()` | função | local |
| `_atualizarEstadoDpad()` | função | local |
| `RPG_DATA` | objeto global | contexto RPG |

---

**`window.mobileUsarSkillPropria(nomeSkill)`** — linha 6644  
Inicia ataque/skill de alvo próprio a partir do mobile. Busca a habilidade em `atkGetHabilidadesCampanha` e delega para `mapaAtaqueIniciar`.

| Dependência | Tipo | Origem |
|---|---|---|
| `MOBILE_CTRL` | objeto | local |
| `RPG_DATA` | objeto global | contexto RPG |
| `atkGetHabilidadesCampanha()` | função | módulo ataque |
| `mapaAtaqueIniciar()` | função | módulo mapa |

---

**`_atualizarZonaDireita()`** — linha 6655  
Atualiza a zona direita do overlay mobile com botões contextuais: fase iniciativa (botão "Rolar Iniciativa" ou mensagem de espera), fase combate (botões "⚔ Atacar" e "→ Pular vez" ou "⚔ Iniciar Batalha" para mestre), botões de ações contextuais via `ctxGerarBotoes`/`ctxPriorizar` (máx 3 visíveis + "N ações"), seção de itens consumíveis/misc do inventário (máx 4).

| Dependência | Tipo | Origem |
|---|---|---|
| `MOBILE_CTRL` | objeto | local |
| `MAPA_STATE` | objeto global | módulo mapa |
| `RPG_DATA` | objeto global | contexto RPG |
| `BATALHA_ATUAL_ID` | variável global | módulo batalha |
| `ctxGerarBotoes()` | função | módulo contexto |
| `ctxPriorizar()` | função | módulo contexto |
| `ctxExecutarAcao()` | função | módulo contexto |
| `ctxMostrarOcultos()` | função | módulo contexto |
| `INV` | objeto global | módulo inventário |
| `abrirModalIniciativa()` | função | módulo batalha |
| `batalhaAtacarVez()` | função | módulo batalha |
| `batalhaPassarVez()` | função | módulo batalha |
| `abrirModalIniciarBatalha()` | função | módulo batalha |
| `abrirModalUsarItem()` | função | local |

---

**`_atualizarMovInfo()`** — linha 6784  
Atualiza `#mc-mov-info` com barra de progresso e valor `movRest/movMax`. Cor verde/amarelo/vermelho por percentual. Oculta fora de batalha.

| Dependência | Tipo | Origem |
|---|---|---|
| `MOBILE_CTRL` | objeto | local |
| `RPG_DATA` | objeto global | contexto RPG |
| `BATALHA_ATUAL_ID` | variável global | módulo batalha |
| `movGetRestante()` | função | módulo movimento |
| `movCalcVelocidade()` | função | módulo movimento |

---

**`tradeMostrarBadgeMobile(proposta)`** — linha 6816  
Cria/atualiza badge fixo `#trade-badge-mobile` com proposta de trade recebida. Exibe remetente, countdown de 30s e botões "Aceitar"/"Recusar". Busca assincronamente os nomes dos itens para exibir no body expandido.

| Dependência | Tipo | Origem |
|---|---|---|
| `MOBILE_CTRL` | objeto | local |
| `sb()` | função | Supabase helper |

---

**`window.tradeBadgeExpandir()`** — linha 6883  
Toggle de visibilidade do painel expandido `#trade-badge-expandido`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

**`window.tradeAceitarBadge()`** — linha 6888  
Async. Remove badge, cancela countdown e chama `aceitarTrade(tradeId)` se disponível.

| Dependência | Tipo | Origem |
|---|---|---|
| `MOBILE_CTRL` | objeto | local |
| `aceitarTrade()` | função | módulo trade |
| `mostrarToast()` | função | global UI |

---

**`window.tradeRecusarBadge()`** — linha 6898  
Async. Remove badge, cancela countdown e chama `recusarTrade(tradeId)` se disponível.

| Dependência | Tipo | Origem |
|---|---|---|
| `MOBILE_CTRL` | objeto | local |
| `recusarTrade()` | função | módulo trade |
| `mostrarToast()` | função | global UI |

---

**`window._mostrarPropostaRecebida` (override)** — linha 6910  
Monkey-patch: se `isMobileLandscape()` redireciona para `tradeMostrarBadgeMobile`, caso contrário chama a implementação desktop original.

| Dependência | Tipo | Origem |
|---|---|---|
| `isMobileLandscape()` | função | local |
| `tradeMostrarBadgeMobile()` | função | local |

---

**HUB_EVENTS listeners** — linhas 6923–6950  
Registra 4 listeners em `HUB_EVENTS`: `token_moveu` (atualiza zonas central/direita, movInfo e dpad), `turno_avancou` (atualiza zonas central/direita e dpad), `dano_aplicado` (atualiza zona central), `cura_aplicada` (atualiza zona central). Todos atuam apenas quando `MOBILE_CTRL.ativo`.

| Dependência | Tipo | Origem |
|---|---|---|
| `HUB_EVENTS` | EventEmitter global | módulo hub |
| `MOBILE_CTRL` | objeto | local |
| `_atualizarZonaCentral()` | função | local |
| `_atualizarZonaDireita()` | função | local |
| `_atualizarMovInfo()` | função | local |
| `_atualizarEstadoDpad()` | função | local |

---

**`const _origWsCheckTrade = setInterval(...)`** — linha 6953  
Polling (800ms) que aguarda `realtimeWS` existir e então patcha `onmessage` para interceptar eventos `trade_proposta` (armazena proposta, resolve nomes async, chama `_mostrarPropostaRecebida`), `trade_aceito` e `trade_recusado` (toasts). Cancela-se após primeira execução bem-sucedida.

| Dependência | Tipo | Origem |
|---|---|---|
| `realtimeWS` | WebSocket global | módulo realtime |
| `TRADE_STATE` | objeto | local |
| `INV` | objeto global | módulo inventário |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `_mostrarPropostaRecebida()` | função | local |

---

**`async function _mostrarPropostaRecebida(p)`** — linha 6986  
Versão desktop: renderiza proposta recebida em `#trade-proposta-recebida`, busca cards de item para cada `instId` da proposta via `sb()` + `_renderItemCard`, e exibe o painel.

| Dependência | Tipo | Origem |
|---|---|---|
| `sb()` | função | Supabase helper |
| `_renderItemCard()` | função | local |

---

### Bloco 33 — I13: Mercado (linhas 7002–7518)

Sistema completo de mercado integrado com I6 (moedas via `dono_id`). Mestre gerencia itens do catálogo ou itens custom; jogadores compram/vendem com débito/crédito automático de moedas. Inclui histórico de transações.

**`MERCADO_STATE`** — linha 7008  
Estado do mercado: `{ mercadoId, titulo, itens, todos, aba, modoGerenciar, gerTab, modoCustom, config: { taxaRevenda }, _catalogo }`.

---

**`_mercRpgId()`** / **`_mercCharNome()`** / **`_mercCharId()`** / **`_mercDenoms()`** — linhas 7014–7025  
Helpers de contexto: extraem respectivamente `RPG_DATA.rpgId`, `INV.charAtivo`, `INV.charId` e denominações de moeda do tema (ou `MOEDAS_DEFAULTS`). `_mercRarCor(r)` e `_mercRarEmoji(r)` mapeiam raridade para cor/emoji.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |
| `CURRENT_RPG` | objeto global | contexto RPG |
| `INV` | objeto global | módulo inventário |
| `MOEDAS_DEFAULTS` | constante | local |

---

**`abrirModalMercado(mercadoId, titulo)`** — linha 7028  
Async. Inicializa estado, exibe `#modal-mercado-overlay`, ajusta visibilidade de controles de mestre, preenche select de denominação e taxa de revenda, carrega itens e saldo em paralelo, muda para aba "comprar".

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |
| `RPG_DATA` | objeto global | contexto RPG |
| `_mercPreencherDenomSelect()` | função | local |
| `_mercPreencherTaxaRevenda()` | função | local |
| `carregarMercadoItens()` | função | local |
| `_mercAtualizarSaldo()` | função | local |
| `mercadoMudarAba()` | função | local |

---

**`window.fecharModalMercado()`** — linha 7046  
Oculta `#modal-mercado-overlay` e limpa `MERCADO_STATE.mercadoId`.

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |

---

**`_mercPreencherDenomSelect()`** — linha 7051  
Popula `#mercado-novo-denom` com opções de denominação de moeda via `_mercDenoms()`.

**`_mercPreencherTaxaRevenda()`** — linha 7056  
Sincroniza slider `#mercado-taxa-revenda` e label `#mercado-taxa-val` com `MERCADO_STATE.config.taxaRevenda`.

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |
| `_mercDenoms()` | função | local |

---

**`_mercAtualizarSaldo()`** — linha 7064  
Async. Busca moedas do personagem ativo por `dono_id` (alinhado com I6) e exibe saldo formatado em `#mercado-saldo`. Aliasado como `atualizarSaldoMercado`.

| Dependência | Tipo | Origem |
|---|---|---|
| `sb()` | função | Supabase helper |
| `_mercRpgId()` | função | local |
| `_mercCharId()` | função | local |
| `_mercCharNome()` | função | local |
| `_mercDenoms()` | função | local |

---

**`mercadoToggleModo()`** — linha 7086  
Toggle do painel de gerenciamento (mestre). Alterna `MERCADO_STATE.modoGerenciar`, mostra/oculta `#mercado-painel-gerenciar`, atualiza botão. Ao abrir gerenciar: ativa tab "adicionar" e carrega catálogo. Aliasado como `mercadoToggleGerenciar()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |
| `mercadoGerTabAtivar()` | função | local |
| `_mercadoCarregarCatalogo()` | função | local |

---

**`mercadoGerTabAtivar(tab)`** — linha 7101  
Ativa tab de gerenciamento (`adicionar`/`lista`/`config`): atualiza estilos dos botões `#gertab-*` e exibe painel correspondente `#gerpanel-*`. Se `lista`, chama `_mercadoRenderListaGerenciar()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |
| `_mercadoRenderListaGerenciar()` | função | local |

---

**`_mercadoCarregarCatalogo()`** — linha 7113  
Async. Popula `#mercado-sel-item` com itens do catálogo do RPG atual (`item_catalog` filtrado por `rpg_id`, ordenado por nome).

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |
| `sb()` | função | Supabase helper |
| `_mercRpgId()` | função | local |

---

**`mercadoToggleItemCustom()`** — linha 7125  
Toggle entre seleção de item do catálogo e item personalizado (custom). Mostra/oculta `#mercado-item-custom-fields` e ajusta opacidade do select.

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |

---

**`mercadoAdicionarItem()`** — linha 7142  
Async. Lê campos do formulário (preço, denominação, estoque, item do catálogo ou nome/desc custom) e faz POST em `mercado`. Limpa formulário e recarrega lista e grid de gerenciamento.

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `_mercRpgId()` | função | local |
| `carregarMercadoItens()` | função | local |
| `_mercadoRenderListaGerenciar()` | função | local |

---

**`_mercadoRenderListaGerenciar()`** — linha 7173  
Renderiza lista de todos os itens do mercado em `#mercado-lista-gerenciar` com input de preço editável inline, indicador de estoque e botão de remoção.

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |
| `mercadoEditarPreco()` | função | local |
| `mercadoRemoverItem()` | função | local |

---

**`mercadoEditarPreco(rowId, novoPreco, denom)`** — linha 7201  
Async. PATCH no preço de item do mercado, atualiza cache local e re-renderiza grid de compras.

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `renderMercadoItens()` | função | local |
| `_mercRpgId()` | função | local |

---

**`mercadoRemoverItem(rowId)`** — linha 7213  
Async. Confirma e remove item do mercado via DELETE. Atualiza caches `todos` e `itens`, re-renderiza lista e grid.

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `_mercadoRenderListaGerenciar()` | função | local |
| `renderMercadoItens()` | função | local |
| `_mercRpgId()` | função | local |

---

**`mercadoSalvarConfig()`** — linha 7225  
Lê valor do slider `#mercado-taxa-revenda` e salva em `MERCADO_STATE.config.taxaRevenda`. Exibe toast.

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |
| `mostrarToast()` | função | global UI |

---

**`carregarMercadoItens(mercadoId)`** — linha 7232  
Async. Busca todos os itens ativos do mercado (`mercado?ativo=eq.true`) com JOIN em `item_catalog`. Salva em `MERCADO_STATE.todos/itens` e renderiza grid.

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |
| `sb()` | função | Supabase helper |
| `_mercRpgId()` | função | local |
| `renderMercadoItens()` | função | local |

---

**`window.filtrarMercado()`** — linha 7245  
Filtra `MERCADO_STATE.itens` por texto de busca e tipo (inclui filtro `custom` para itens personalizados). Re-renderiza grid.

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |
| `renderMercadoItens()` | função | local |

---

**`renderMercadoItens()`** — linha 7258  
Renderiza `#mercado-itens-grid` com cards de todos os itens filtrados via `_mercRenderCard()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |
| `_mercRenderCard()` | função | local |

---

**`_mercRenderCard(row)`** — linha 7268  
Gera HTML de card de item do mercado com ícone de tipo, nome, raridade colorida, descrição (clamp 3 linhas), preço, estoque restante e botão "Comprar" (ou "Esgotado" desabilitado).

| Dependência | Tipo | Origem |
|---|---|---|
| `_mercRarCor()` | função | local |
| `_mercRarEmoji()` | função | local |
| `confirmarCompraMercado()` | função | local |

---

**`window.confirmarCompraMercado(rowId, preco, denom, nomeItem, ev)`** — linha 7308  
Verifica se há personagem ativo, exibe `confirm()` com preço e delega para `comprarItemMercado()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `_mercCharNome()` | função | local |
| `mostrarToast()` | função | global UI |
| `comprarItemMercado()` | função | local |

---

**`window.comprarItemMercado(rowId, preco, denom)`** — linha 7318  
Async. Pipeline de compra: (1) verifica saldo via `moedas?dono_id`, (2) debita com `_moedaUpsert`, (3) adiciona ao `inventario` (POST), (4) decrementa `estoque_atual` via PATCH, (5) registra log com `_moedaLog`. Estorna débito se POST de inventário falhar.

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `_mercRpgId()` | função | local |
| `_mercCharId()` | função | local |
| `_mercCharNome()` | função | local |
| `_moedaUpsert()` | função | local (I6) |
| `_moedaLog()` | função | local (I6) |
| `_invBroadcastDrop()` | função | local |
| `INV` | objeto global | módulo inventário |
| `renderMercadoItens()` | função | local |
| `_mercAtualizarSaldo()` | função | local |

---

**`_mercCarregarAbaVender()`** — linha 7386  
Async. Carrega itens não-equipados do personagem ativo via `inventario?equipado=eq.false`. Para cada item, calcula preço de revenda (`preco × taxaRevenda%`) com base nos preços do mercado. Renderiza lista com botão "Vender" ou "Sem cotação".

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |
| `sb()` | função | Supabase helper |
| `_mercRpgId()` | função | local |
| `_mercCharId()` | função | local |
| `_mercCharNome()` | função | local |
| `mercadoVenderItem()` | função | local |

---

**`window.mercadoVenderItem(invRowId, itemCatalogId, nomeItem, preco, denom, ev)`** — linha 7432  
Async. Remove item do inventário (DELETE), credita moedas via `_moedaUpsert(dono_id)`, registra log, atualiza saldo e re-carrega aba de venda.

| Dependência | Tipo | Origem |
|---|---|---|
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |
| `_mercRpgId()` | função | local |
| `_mercCharId()` | função | local |
| `_moedaUpsert()` | função | local (I6) |
| `_moedaLog()` | função | local (I6) |
| `_mercAtualizarSaldo()` | função | local |
| `_mercCarregarAbaVender()` | função | local |

---

**`mercadoCarregarHistorico()`** — linha 7452  
Async. Busca últimas 60 transações de `log_transacoes` (tipo `remover`/`receber`) ordenadas desc. Mapeia `dono_id` para nomes de personagens e renderiza lista com cor verde (crédito) ou vermelho (débito).

| Dependência | Tipo | Origem |
|---|---|---|
| `sb()` | função | Supabase helper |
| `_mercRpgId()` | função | local |
| `_mercCharId()` | função | local |
| `RPG_DATA` | objeto global | contexto RPG |

---

**`mercadoMudarAba(aba)`** — linha 7487  
Controla exibição das abas "comprar"/"vender"/"historico": atualiza estilos dos botões `#merc-aba-*`, mostra/oculta painéis, carrega dados das abas lazy (vender e historico).

| Dependência | Tipo | Origem |
|---|---|---|
| `MERCADO_STATE` | objeto | local |
| `_mercCarregarAbaVender()` | função | local |
| `mercadoCarregarHistorico()` | função | local |

---

**`window._verificarMercadoToken(c)`** — linha 7509  
Helper de token do mapa: retorna HTML de botão "🏪 Entrar no Mercado" se o personagem `c` tiver `custom_attrs.mercado_id`. Chama `abrirModalMercado` ao clicar.

| Dependência | Tipo | Origem |
|---|---|---|
| `abrirModalMercado()` | função | local |

---

### Bloco 34 — A5: Painel de Balanceamento + Integrações + Fixes (linhas 7519–8117)

A5 painel de status de balanceamento de atributos, integração de trade/mercado ao inventário, bloco de exports globais, IIFE de estilos, correções adicionais (AC/UX) e início do módulo FIXES.JS (BUG #1+#2+#3+#6+#7+#8).

**`_GRUPOS_INFO`** — linha 7526  
Array de 4 grupos base de balanceamento: `forca`, `destreza`, `constituicao`, `inteligencia` com label e descrição.

---

**`a5RecalcularPainel()`** — linha 7533  
Async. Calcula e renderiza o painel de status de balanceamento (`#a5-painel-grid`): (1) identifica atributos sem mapeamento e exibe alerta; (2) para cada grupo, calcula média via `calcularMediaGrupo` e busca itens do catálogo que têm bônus nesses atributos; (3) renderiza `<details>` expansível por grupo com atributos mapeados, per-personagem e itens.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |
| `CURRENT_RPG` | objeto global | contexto RPG |
| `carregarMapeamento()` | função | local (A1) |
| `calcularMediaGrupo()` | função | local |
| `sb()` | função | Supabase helper |
| `_GRUPOS_INFO` | constante | local |

---

**DOMContentLoaded hook A5** — linha 7620  
Observa `#cfg-status-inv-card` via `MutationObserver`. Dispara `a5RecalcularPainel()` quando o card fica visível (display ≠ 'none'), usando `dataset.carregado` para evitar recálculos duplicados.

| Dependência | Tipo | Origem |
|---|---|---|
| `a5RecalcularPainel()` | função | local |

---

**`window.abrirInventario` (monkey-patch)** — linha 7646  
Patcha `abrirInventario` para injetar botão "🔄 PROPOR TRADE" após `#inv-btn-adicionar-wrap` após a abertura do inventário. Usa `MutationObserver` com timeout de 5s para aguardar o elemento aparecer no DOM.

| Dependência | Tipo | Origem |
|---|---|---|
| `abrirInventario()` | função | local |
| `abrirModalTrade()` | função | local |

---

**Exports globais** — linhas 7676–7683  
Expõe no `window`: `abrirModalTrade`, `abrirModalMercado`, `a5RecalcularPainel`, `renderInvBau`, `mercadoToggleGerenciar`, `mercadoAdicionarItem`, `mercadoRemoverItem`.

---

**IIFE `injectStyles3B()`** — linha 7687  
Injeta CSS para: overlay de modais (I10/I12/I13 ocultos), animações `.anim-pulse`/`.anim-glow`/`.anim-shimmer` de item card, keyframes `fadeIn`/`slideUp`, aba baú I11, e `<details>` A5.

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

**`_getAlvosDisponiveisParaSuporte(contexto)`** — linha 7725  
Retorna lista de alvos disponíveis para habilidades de suporte: personagens (jogadores e NPCs) e pets (com label indicando o dono). Contexto `'arena'` usa `AR.session.characters`; `'campanha'` usa `RPG_DATA.characters`.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |
| `AR` | objeto global | módulo arena |

---

**`_notificarNovoCreativoPendente()`** — linha 7746  
Cria badge pulsante `<span class="badge-notif-criativo">` em `#mapa-btn-criativos` (com fallbacks). Injeta CSS de animação `@keyframes pulseNotif` se não existir. Dispara vibração tátil.

| Dependência | Tipo | Origem |
|---|---|---|
| `navigator.vibrate` | Web API | browser |

---

**`_limparNotifCreativo()`** — linha 7769  
Remove todos os elementos `.badge-notif-criativo` do DOM.

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

**`_aplicarTransicaoFaseModal()`** — linha 7774  
Injeta `<style id="style-transicao-fase-modal">` com CSS para transições suaves (`.modal-fase-content`, `fase-saindo`, `fase-entrando`, `@keyframes faseEntrar`).

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

**`_trocarFaseModalComTransicao(containerEl, novoConteudoHTML)`** — linha 7788  
Async. Aplica `fase-saindo` → aguarda 300ms → substitui `innerHTML` → aplica `fase-entrando` → remove classe após 300ms.

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

**`_formatarMensagemMestre(mensagem)`** — linha 7799  
Escapa HTML (`&`, `<`, `>`) e converte `\n` em `<br>` para preservar quebras de linha.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`_sincronizarAnimacaoCriativo(criativoId)`** — linha 7809  
Busca criativo em `CRIATIVOS_CAMP` e faz broadcast `criativo_animacao` via `combateBroadcast` para sincronizar animação com jogadores offline.

| Dependência | Tipo | Origem |
|---|---|---|
| `CRIATIVOS_CAMP` | array global | módulo criativo |
| `combateBroadcast()` | função | módulo combate |

---

**`_onReceberAnimacaoCriativo(data)`** — linha 7820  
Recebe evento de animação de criativo: cria ou atualiza entrada em `CRIATIVOS_CAMP` e aplica a animação via `_aplicarAnimacaoSkill` se disponível.

| Dependência | Tipo | Origem |
|---|---|---|
| `CRIATIVOS_CAMP` | array global | módulo criativo |
| `_aplicarAnimacaoSkill()` | função | módulo mapa |

---

**IIFE `_initCorrecoesAdicionais()`** — linha 7835  
Inicializa correções adicionais: chama `_aplicarTransicaoFaseModal()`, patcha campos `#criativo-msg-fase1/2` com `white-space:pre-wrap` via `MutationObserver` (desconecta após 60s).

| Dependência | Tipo | Origem |
|---|---|---|
| `_aplicarTransicaoFaseModal()` | função | local |

---

**IIFE `RPGHubFixes()`** — linha 7866 (início)  
Módulo de patches e correções de bugs. Agrupa 15+ correções como overrides de funções globais.

---

**`window.calcularDanoFinal` (patch BUG #1+#2+#8)** — linha 7882  
Override completo do cálculo de dano final. Correções: (1) cura bypassa armadura/resistência; (2) `mod_dano` de debuffs aplicado antes da armadura; (3) armadura (pct_geral/fisico/magico) aplicada; (4) `mod_defesa` de buffs aplicado após armadura; (5) resistências elementais com arredondamento correto para fraqueza (`Math.floor` em vez de `Math.ceil` para `valorRes < 0`); (6) fraqueza absoluta amplifica corretamente.

| Dependência | Tipo | Origem |
|---|---|---|
| `calcularDanoFinal()` | função original | global |

---

**`window._processarEfeitosCampanha` (patch BUG #3+#7)** — linha 7993  
Override do processamento de efeitos por turno na campanha. Correções: (3) DOT pode passar por `calcularDanoFinal` quando `dot_ignora_resistencia !== true` e `dot_tipo_dano` definido; (7) verifica expiração de invocações temporárias (`turno_expira`) comparando com `turnoRound` da batalha ativa. Também: decrementa contadores de buff/debuff, reverte `modificador_attr` ao expirar, persiste alterações via PATCH, emite toasts de log.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |
| `BATALHA_ATUAL_ID` | variável global | módulo batalha |
| `MAPA_STATE` | objeto global | módulo mapa |
| `sb()` | função | Supabase helper |
| `parsearFormulaDano()` | função | módulo combate |
| `rolarGrupos()` | função | módulo combate |
| `calcularDanoFinal()` | função | global (patchada) |
| `mostrarToast()` | função | global UI |
| `renderCharView()` | função | módulo personagem |
| `renderAttrView()` | função | módulo atributos |
| `mapaRenderStatus()` | função | módulo mapa |

---

### Bloco 35 — FIXES.JS: Patches de Bugs (linhas 8118–8650)

Continuação do módulo `RPGHubFixes`. Patches de 10 bugs e incoerências adicionais.

**`window.petGetHabilidadesPet` (patch BUG #6)** — linha 8130  
Override: gera `id` sintético (`${petNome}_hab_${i}`) para habilidades inline sem `id` do banco, permitindo rastrear cooldowns. Preserva fallback para `atkGetHabilidadesArena/Campanha` em personagens com ficha.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |
| `AR` | objeto global | módulo arena |
| `atkGetHabilidadesArena()` | função | módulo ataque |
| `atkGetHabilidadesCampanha()` | função | módulo ataque |

---

**`window.criativoJogadorRolarDano` (patch BUG #11)** — linha 8161  
Override: resolve `tipoDanoFinal` usando `c.tipo_dano` (salvo na fase 1) ou `c._skill_meta.tipo_dano` antes do fallback `'fisico'`. Restaura `COMBATE.atacanteNome` e `COMBATE.contexto` se resetados. Suporta AoE multi-alvo via `c._alvos_area`.

| Dependência | Tipo | Origem |
|---|---|---|
| `CRIATIVOS_CAMP` | array global | módulo criativo |
| `CRIATIVO_ID_ATUAL` | variável global | módulo criativo |
| `COMBATE` | objeto global | módulo combate |
| `AR` | objeto global | módulo arena |
| `_criativoHideAllPendente()` | função | módulo criativo |
| `atkPrepararStep3()` | função | módulo ataque |
| `atkIrParaStep()` | função | módulo ataque |

---

**`window.criativoMestreConcluirFase1` (patch BUG #11)** — linha 8231  
Salva `tipo_dano` selecionado pelo mestre (`#criativo-skill-tipo-dano`) no objeto criativo antes de chamar o original `criativoMestreConcluirFase1`.

| Dependência | Tipo | Origem |
|---|---|---|
| `CRIATIVOS_CAMP` | array global | módulo criativo |

---

**`window.batalhaVerificarIniciativasCompletas` (patch BUG #12)** — linha 8258  
Override: adiciona failsafe anti-loop para empate de iniciativa. Conta tentativas em `bs._rerollCount`; após 10 tentativas, aplica desempate automático por ordem alfabética com micro-diferença (0.01). Abaixo do limite: NPCs re-rolam automaticamente, humanos empatados são notificados.

| Dependência | Tipo | Origem |
|---|---|---|
| `MAPA_STATE` | objeto global | módulo mapa |
| `mostrarToast()` | função | global UI |
| `batalhaRenderFaseIniciativa()` | função | módulo batalha |
| `salvarEstadoBatalha()` | função | módulo batalha |
| `combateBroadcast()` | função | módulo combate |
| `_aplicarEstadoBatalhaUI()` | função | módulo batalha |
| `_atualizarBadgeMesa()` | função | módulo mesa |
| `_notificarVez()` | função | módulo batalha |

---

**`window.atkAplicarRecuperacaoAtributo` (patch BUG #14)** — linha 8353  
Async. Override: para recuperação positiva, calcula pool máximo a partir de `attrDef.opcoes` (`max_base + max_attr * max_mult`) e clampeia `Math.min(maxPool, atual + quantidade)`. Exibe toasts quando recurso zera ou atinge o máximo.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |
| `AR` | objeto global | módulo arena |
| `sb()` | função | Supabase helper |
| `arSb()` | função | Supabase arena helper |
| `mostrarToast()` | função | global UI |

---

**`window.parsearCustoRSV(custo_rsv)`** — linha 8411  
Normaliza string de custo de skill. Suporta custo único (`"2 Mana"`), custo múltiplo (`"2 Mana + 5 Stamina"`) e ignora `"passivo"`. Retorna `null`, objeto `{quantidade, atributo}` ou array de objetos para custos múltiplos.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`window.verificarCustoSkill` (patch INC #3)** — linha 8436  
Override: usa `parsearCustoRSV` e match case-insensitive de atributo. Suporta custos múltiplos (retorna `{ok:false}` no primeiro custo insuficiente).

| Dependência | Tipo | Origem |
|---|---|---|
| `parsearCustoRSV()` | função | local |
| `RPG_DATA` | objeto global | contexto RPG |
| `AR` | objeto global | módulo arena |

---

**`window.descontarCustoSkill` (patch INC #3)** — linha 8471  
Async override: usa `parsearCustoRSV` e itera sobre todos os custos (múltiplos), com match case-insensitive. Chama `atkAplicarRecuperacaoAtributo` para cada custo.

| Dependência | Tipo | Origem |
|---|---|---|
| `parsearCustoRSV()` | função | local |
| `atkAplicarRecuperacaoAtributo()` | função | local (patchada) |
| `mostrarToast()` | função | global UI |
| `RPG_DATA` | objeto global | contexto RPG |
| `AR` | objeto global | módulo arena |

---

**`_patchFactionParaObjetos()` (BUG #5)** — linha 8502  
Função imediatamente invocada que monitora via `MutationObserver` o modal de criação de personagem e adiciona listener `change` no select `#nc-tipo`/`#fc-tipo` para mostrar o campo de facção também quando `tipo === 'objeto'`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

**`window._normalizarTipoPersonagem(ca)`** — linha 8540  
Helper: garante consistência entre `ca.tipo` e `ca.tipo_personagem`. NPCs, criaturas e objetos têm `tipo_personagem = 'npc'`; demais tipos são espelhados diretamente.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`window._getTipoPersonagem(c)`** — linha 8553  
Helper: retorna `ca.tipo || ca.tipo_personagem || 'jogador'`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`window.getTodasHabilidades(nome, contexto)`** — linha 8565  
Unifica habilidades inline (com ID sintético, `_source:'inline'`) e habilidades do banco (`_source:'db'`). Deduplica por nome com prioridade ao banco.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |
| `AR` | objeto global | módulo arena |
| `atkGetHabilidadesArena()` | função | módulo ataque |
| `atkGetHabilidadesCampanha()` | função | módulo ataque |

---

**`window._personagemPodeAtacar(nome, contexto)`** — linha 8616  
Helper: retorna `false` se o personagem tiver buff `sem_ataque` com `turnos_restantes > 0` e `tipo = 'todos'`.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |
| `AR` | objeto global | módulo arena |

---

**`window.batalhaAtacarVez` (patch INC #4)** — linha 8634  
Override: verifica `_personagemPodeAtacar` antes de abrir o modal de ataque. Exibe toast de erro se bloqueado.

| Dependência | Tipo | Origem |
|---|---|---|
| `MAPA_STATE` | objeto global | módulo mapa |
| `BATALHA_ATUAL_ID` | variável global | módulo batalha |
| `_personagemPodeAtacar()` | função | local |
| `mostrarToast()` | função | global UI |

---

### Bloco 36 — FIXES.JS: Patches Finais + NMCE Ferramentas de Cenário (linhas 8651–9233)

Últimas correções do módulo `RPGHubFixes` (BUG #13, #4, #10, #15, XP, alcance, HP max) e sistema NMCE de edição de cenário (paredes/portas/objetos no canvas do modal de mapa).

**`window.recalcularHpMax(c)` (BUG #13)** — linha 8661  
Recalcula `hp_max` do personagem a partir de `RPG_DATA.level_config` via `calcularHpMaxComAtributos`. Se o valor mudou, ajusta `hp_atual` proporcionalmente.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |
| `calcularHpMaxComAtributos()` | função | módulo level |

---

**`window.atkRenderizarSecaoPets` (patch BUG #4)** — linha 8706  
Override: verifica `petDonoEstaAtivo` globalmente e, para cada habilidade do pet, verifica bloqueio por tipo (`petDonoEstaAtivo(dono, ctx, h.tipo_dano)`) e `atkVerificarBloqueioAtaque`. Renderiza botão com `opacity:0.4` e lock icon se bloqueado.

| Dependência | Tipo | Origem |
|---|---|---|
| `petGetPetsDoDono()` | função | módulo pet |
| `petGetHabilidadesPet()` | função | local (patchada) |
| `petDonoEstaAtivo()` | função | módulo pet |
| `atkVerificarBloqueioAtaque()` | função | módulo ataque |
| `atkSelecionarPetHabilidade()` | função | módulo ataque |
| `mostrarToast()` | função | global UI |

---

**`window._verificarAtributosEspeciais(personagemNome, tipo, atribs, attrDefs)` (BUG #10)** — linha 8764  
Emite toast de aviso para cada atributo da categoria `especial` que tiver valor definido em criaturas/objetos (será invisível na ficha genérica).

| Dependência | Tipo | Origem |
|---|---|---|
| `mostrarToast()` | função | global UI |

---

**`window._verificarAlcanceSkill(tipoDano, alcance)` (BUG #15)** — linha 8785  
Emite toast de dica quando skill física/mágica não tem `alcance_celulas` definido.

| Dependência | Tipo | Origem |
|---|---|---|
| `mostrarToast()` | função | global UI |

---

**`window.xpSalvarChar` (patch BUG-10 XP)** — linha 8800  
Async patch: garante `c.xp = ca.xp` antes de chamar o original. Fallback: PATCH direto em `characters` com `{ custom_attrs, xp }`.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |
| `sb()` | função | Supabase helper |
| `mostrarToast()` | função | global UI |

---

**`window.assertXpConsistente()`** — linha 8815  
Helper de diagnóstico: compara `c.xp` com `c.custom_attrs.xp` para todos os personagens. Imprime warnings no console para divergências. Retorna contagem de divergências.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |

---

**`_distanciaEntreTokens(nomeA, nomeB)`** — linha 8838  
Calcula distância Manhattan entre dois personagens no mapa atual usando `c.map_positions[mapaId]`. Retorna `null` se posição não encontrada.

| Dependência | Tipo | Origem |
|---|---|---|
| `MAPA_STATE` | objeto global | módulo mapa |
| `RPG_DATA` | objeto global | contexto RPG |

---

**`window.atkSelecionarAlvo` (patch BUG-11 alcance)** — linha 8853  
Override: antes de selecionar alvo em campanha, verifica `h.alcance_celulas` via `_distanciaEntreTokens`. Bloqueia e exibe toast detalhado se alvo estiver fora de alcance.

| Dependência | Tipo | Origem |
|---|---|---|
| `COMBATE` | objeto global | módulo combate |
| `_distanciaEntreTokens()` | função | local |
| `mostrarToast()` | função | global UI |

---

**`window.assertHpConsistente()`** — linha 8877  
Helper de diagnóstico: compara `c.hp_max` com `c.custom_attrs.hp_max`. Auto-corrige divergências usando a coluna top-level como fonte de verdade.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |

---

**`window.iniciarApp` (patch BUG-12 HP)** — linha 8897  
Patcha `iniciarApp` para chamar `assertHpConsistente()` 2 segundos após a inicialização, de forma não-bloqueante.

| Dependência | Tipo | Origem |
|---|---|---|
| `assertHpConsistente()` | função | local |
| `RPG_DATA` | objeto global | contexto RPG |

---

### Bloco 37 — NMCE: Editor de Cenário no Canvas (linhas 8910–9233)

Sistema de ferramentas de cenário integrado ao editor de mapa: permite desenhar paredes (segmentos SVG), portas e objetos/baús diretamente no canvas. Dados persistidos em `render_data` do mapa.

**`_nmceGridDims()`** — linha 8916  
Retorna `{ cols, rows }` lendo `#nm-grid` e derivando `rows = round(cols × 500/800)` (proporção do canvas interno 800×500).

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

**`_nmceSnapPonto(xPx, yPx, canvas)`** — linha 8924  
Calcula snap para a borda de grid mais próxima (vertical ou horizontal) dado um ponto em pixels. Retorna `{ tipo:'v'|'h', col, row, px, py }`.

| Dependência | Tipo | Origem |
|---|---|---|
| `_nmceGridDims()` | função | local |

---

**`_nmceSnapCelula(xPx, yPx, canvas)`** — linha 8942  
Converte coordenadas em pixels para `{ col, row }` da célula do grid (com clamp).

| Dependência | Tipo | Origem |
|---|---|---|
| `_nmceGridDims()` | função | local |

---

**`_nmceShowSnapIndicator(snap, canvas)`** — linha 8952  
Posiciona e exibe o ponto `#nmce-wall-snap` sobre o canvas, mapeando coordenadas internas do canvas para pixels CSS via `getBoundingClientRect`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

**`_nmceGerarSegmentos(p1, p2)`** — linha 8971  
Gera array de segmentos de parede entre dois pontos snap. Casos: (1) dois pontos verticais na mesma coluna → run vertical; (2) dois pontos horizontais na mesma linha → run horizontal; (3) caso misto → caminho em L (horizontal + vertical).

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`_nmceSceneClick(xPx, yPx, canvas)`** — linha 9014  
Handler de clique no canvas em modo de edição. Despacha para lógica da ferramenta ativa (`nmCE.tool`): `'parede'` (dois cliques para segmentos), `'porta'` (snapping de célula + config), `'objeto'` (obstáculo), `'bau'` (baú com loot configurável). Atualiza SVG e lista após cada ação.

| Dependência | Tipo | Origem |
|---|---|---|
| `nmCE` | objeto global | módulo mapa/NMCE |
| `_nmceSnapPonto()` | função | local |
| `_nmceSnapCelula()` | função | local |
| `_nmceShowSnapIndicator()` | função | local |
| `_nmceGerarSegmentos()` | função | local |
| `_nmceRenderWalls()` | função | local |
| `_nmceAtualizarLista()` | função | local |
| `mostrarToast()` | função | global UI |

---

**`_nmceRenderWalls(canvas)`** — linha 9082  
Renderiza todas as paredes (linhas SVG com área de clique expandida), portas e objetos (tokens SVG circulares com emoji) no `#nmce-walls-svg`. Clique simples → editar; Shift+clique → remover.

| Dependência | Tipo | Origem |
|---|---|---|
| `nmCE` | objeto global | módulo mapa/NMCE |
| `_nmceGridDims()` | função | local |
| `_nmceAtualizarLista()` | função | local |
| `window.editarObjetoCanvas()` | função | módulo mapa |

---

**`_nmceAtualizarLista()`** — linha 9176  
Atualiza `#nmce-cenario-lista` com chips de texto para cada parede, porta e objeto, cada um com botão "✕" para remoção.

| Dependência | Tipo | Origem |
|---|---|---|
| `nmCE` | objeto global | módulo mapa/NMCE |
| `_nmceRenderWalls()` | função | local |

---

**`nmceLimparParedes()`** — linha 9190  
Limpa todos os dados de paredes/portas/objetos, reseta `wallFirstSnap`, oculta dot e re-renderiza.

| Dependência | Tipo | Origem |
|---|---|---|
| `nmCE` | objeto global | módulo mapa/NMCE |
| `_nmceRenderWalls()` | função | local |
| `_nmceAtualizarLista()` | função | local |

---

**`nmceCarregarRenderData(renderData)`** — linha 9200  
Carrega `render_data` de um mapa existente em `nmCE.renderData` (com sanitização de arrays), e agenda re-renderização via `setTimeout(100ms)`.

| Dependência | Tipo | Origem |
|---|---|---|
| `nmCE` | objeto global | módulo mapa/NMCE |
| `_nmceRenderWalls()` | função | local |
| `_nmceAtualizarLista()` | função | local |

---

**`_nmceSalvarRenderData()`** — linha 9214  
Async. Encontra o mapa atual em `RPG_DATA.mapas`, atualiza `render_data.paredes/portas/objetos` com os dados de `nmCE.renderData` e persiste via `salvarRenderData`.

| Dependência | Tipo | Origem |
|---|---|---|
| `MAPA_STATE` | objeto global | módulo mapa |
| `RPG_DATA` | objeto global | contexto RPG |
| `salvarRenderData()` | função | módulo mapa |
| `nmCE` | objeto global | módulo mapa/NMCE |

---

**Exports globais NMCE** — linhas 9226–9233  
Expõe no `window`: `nmceLimparParedes`, `nmceCarregarRenderData`, `nmCE`, `nmceCoords`, `_nmceSnapCelula`, `_nmceRenderWalls`, `_nmceAtualizarLista`.

---

---

## `js/maps/maps.js` (10012 linhas)

Sistema de renderização de mapas, névoa de guerra, modo batalha e controles de movimento. Contém animações de skill, lógica de combate visual e gestão de tokens.

---

### Bloco 38 — Animações de Skill + Sistema de Efeitos (linhas 0–510)

Renderizadores de animação de ataque (mídia e canvas), UI do editor de skill, e pipeline de aplicação de buffs/debuffs.

**`window.TOKEN_CTRL` (guard)** — linha 8  
Inicializa `TOKEN_CTRL = { nomeControle, nomeSelecionado }` apenas se ainda não existir no `window`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`_animMedia(animacao, origem, alvo, resolve)`** — linha 16  
Renderiza overlay de mídia (gif/imagem/svg/iframe) para animações de skill. Suporta três modos de posição: `'atacante'`, `'alvo'`, `'meio'` e `'trajetoria'` (bezier quadrática com RAF). Fade in/hold/fade out com `transition` CSS. Remove overlay ao terminar e chama `resolve()`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM / RAF | browser |

---

**`_animImpacto(ctx, pos, rgb, cor, icone)`** — linha 111  
Anima impacto em canvas: gradiente radial que expande e faz fade em 10 frames via `requestAnimationFrame`. Suporta ícone emoji centralizado.

| Dependência | Tipo | Origem |
|---|---|---|
| — | Canvas API | browser |

---

**`skAnimValidarDuracao()`** — linha 131  
Valida duração total da animação de skill (duração × repetições) contra limite do mestre (10s) ou jogador (3s). Atualiza avisos `#sk-anim-dur-aviso` e `#sk-anim-dur-aviso-canvas` com cores progressivas (amarelo perto do limite, vermelho ao exceder).

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |

---

**`skAnimTipoChange()`** — linha 165  
Handler de mudança do tipo de animação no modal de skill. Mostra/oculta `#sk-anim-campos-canvas` (canvas types: projetil/onda/explosao/raio/aura) ou `#sk-anim-campos-midia` (gif/imagem/svg/iframe). Chama preview correspondente.

| Dependência | Tipo | Origem |
|---|---|---|
| `skAnimMidiaPreview()` | função | local |
| `skAnimPreview()` | função | local |

---

**`skAnimMidiaPreview()`** — linha 196  
Renderiza pré-visualização de mídia no `#sk-anim-midia-preview-inner`: tag `<img>` para gif/imagem, HTML inline para svg, texto de aviso para iframe.

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

**`criativoAnimTipoChange()`** — linha 221  
Análogo a `skAnimTipoChange` para o modal de ação criativa do mestre: mostra/oculta `#criativo-anim-campos-canvas` e `#criativo-anim-campos-midia`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

**`arAnimDnTipoChange()`** — linha 241  
Análogo para o modal de dano da arena: mostra/oculta `#ar-atk-dn-anim-canvas` e `#ar-atk-dn-anim-midia`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | DOM | — |

---

**`skAnimPreview()`** — linha 261  
Mostra/oculta `#sk-anim-preview-wrap` e delega para `skAnimPreviewPlay()` se o tipo for canvas.

| Dependência | Tipo | Origem |
|---|---|---|
| `skAnimPreviewPlay()` | função | local |

---

**`skAnimPreviewPlay()`** — linha 269  
Executa preview de animação canvas em loop no `#sk-anim-preview-canvas`. Renderiza 5 tipos: `projetil` (bezier com trilha opcional), `onda` (anéis concêntricos), `explosao` (partículas radiais), `raio` (zigzag regenerado a 80ms), `aura` (gradiente pulsante). Reinicia automaticamente após 500ms.

| Dependência | Tipo | Origem |
|---|---|---|
| `_animHexToRgb()` | função | local |
| `_animGerarZigzag()` | função | local |
| `_maps_skAnimPreviewRaf` | variável | local |

---

**`atkConfirmarAtaque()`** — linha 357  
Define `COMBATE._pendingTrigger = true` e fecha o modal de ataque. A animação e o dano são processados pelo card do mapa.

| Dependência | Tipo | Origem |
|---|---|---|
| `COMBATE` | objeto global | módulo combate |
| `fecharModalAtaque()` | função | módulo ataque |

---

**`atkAplicarEfeitoComRecuperacao(nomeAlvo, ef, contexto)`** — linha 365  
Async wrapper: trata recuperação imediata de atributo (`rec_modo === 'imediato'`) e cura imediata (`tipo === 'cura_imediata'`) antes de delegar para `atkAplicarEfeito`. A recuperação imediata faz PATCH direto sem criar buff de turno.

| Dependência | Tipo | Origem |
|---|---|---|
| `parsearFormulaDano()` | função | módulo combate |
| `rolarGrupos()` | função | módulo combate |
| `atkAplicarCura()` | função | local |
| `atkAplicarEfeito()` | função | local |
| `RPG_DATA` | objeto global | contexto RPG |
| `AR` | objeto global | módulo arena |
| `sb()` | função | Supabase helper |
| `arSb()` | função | Supabase arena helper |
| `mostrarToast()` | função | global UI |

---

**`atkAplicarEfeito(nomeAlvo, efeitoConfig, contexto)`** — linha 400  
Async. Cria e persiste objeto `buff/debuff` no personagem. Casos especiais inline: `hp_temp` (acumula HP temporário), `remover_debuff` (remove primeiro debuff). Para efeitos de duração > 0: monta objeto com todos os campos de buff (DOT, HOT, sem_movimento, sem_ataque, mod_dano, mod_defesa, boost_dano, rec_atributo, turnos_restantes). Descarta buffs "fantasma" com `turnos_restantes <= 0`.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |
| `AR` | objeto global | módulo arena |
| `sb()` | função | Supabase helper |
| `arSb()` | função | Supabase arena helper |
| `atkAplicarCura()` | função | local |
| `arLog()` | função | módulo arena |
| `logCombate()` | função | módulo combate |

---

---

### Bloco 39 — Sistema de Área de Efeito (AoE) (linhas 511–742)

Gerenciamento de ataques em área com círculo arrastável sobre o mapa. O estado global `_AOE_STATE` rastreia posição, raio, drag e alvos. O fluxo: `atkIniciarModoArea` → `_aoeRenderCircle` → drag events → `_aoeAtualizarAlvos` → `atkConfirmarAoE`. Detecção de friendly-fire integrada com badges visuais de aviso.

**`atkIniciarModoArea(h)`** — linha 518  
Inicia modo AoE: faz scroll para token do atacante, renderiza círculo no centro do mapa, registra pointer events de drag e ativa botão "Confirmar AoE". Salva skill `h` em `_AOE_STATE.skill`.

| Dependência | Tipo | Origem |
|---|---|---|
| `_AOE_STATE` | objeto global | local |
| `_aoeRenderCircle()` | função | local |
| `_aoeDrag()` / `_aoeStartDrag()` / `_aoeEndDrag()` | funções | local |
| `_aoeAtualizarAlvos()` | função | local |
| `COMBATE` | objeto global | módulo combate |

---

**`_aoeRenderCircle(cx, cy, raioCell)`** — linha 544  
Cria `<div class="aoe-circle">` posicionado em `%` relativo ao container do mapa, com raio em pixels calculado a partir de `raioCell * cellSizePx`. Chama `_aoeAtualizarAlvos()` após renderização. Remove círculo anterior se existente.

| Dependência | Tipo | Origem |
|---|---|---|
| `_AOE_STATE` | objeto global | local |
| `_aoeAtualizarAlvos()` | função | local |
| `MAPA_STATE` | objeto global | módulo mapa |

---

**`mapaHideAoECircle()`** — linha 573  
Remove o `div.aoe-circle` do DOM, limpa `_AOE_STATE`, remove event listeners de drag e restaura botão de confirmação para estado padrão.

| Dependência | Tipo | Origem |
|---|---|---|
| `_AOE_STATE` | objeto global | local |

---

**`atkAtivarAoECriativo(nomeChar)`** — linha 587  
Versão AoE para ataques criativos: busca personagem por nome em `RPG_DATA.characters`, configura `COMBATE` com dados do atacante, obtém raio do estado criativo (`COMBATE.criativo_raio`) e chama `atkIniciarModoArea`.

| Dependência | Tipo | Origem |
|---|---|---|
| `COMBATE` | objeto global | módulo combate |
| `RPG_DATA` | objeto global | contexto RPG |
| `atkIniciarModoArea()` | função | local |

---

**`atkConfirmarAoECriativo(nomeChar)`** — linha 611  
Confirma AoE criativo: valida que há alvos selecionados em `_AOE_STATE.alvos`, constrói payload de ataque criativo com lista de alvos e chama `atkEnviarAtaqueCriativo`.

| Dependência | Tipo | Origem |
|---|---|---|
| `_AOE_STATE` | objeto global | local |
| `COMBATE` | objeto global | módulo combate |
| `atkEnviarAtaqueCriativo()` | função | local |
| `mapaHideAoECircle()` | função | local |

---

**`_aoeStartDrag(e)`** — linha 627  
Handler `pointerdown`: registra offset entre posição do pointer e centro do círculo AoE para drag suave.

| Dependência | Tipo | Origem |
|---|---|---|
| `_AOE_STATE` | objeto global | local |

---

**`_aoeDrag(e)`** — linha 638  
Handler `pointermove`: recalcula posição do círculo em `%` do container considerando zoom e pan do mapa (`MAPA_STATE.zoom`, `MAPA_STATE.panX/Y`). Chama `_aoeAtualizarAlvos()` a cada movimento.

| Dependência | Tipo | Origem |
|---|---|---|
| `_AOE_STATE` | objeto global | local |
| `MAPA_STATE` | objeto global | módulo mapa |
| `_aoeAtualizarAlvos()` | função | local |

---

**`_aoeEndDrag(e)`** — linha 660  
Handler `pointerup`: finaliza drag, chama `_aoeAtualizarAlvos()` para snapshot final dos alvos.

| Dependência | Tipo | Origem |
|---|---|---|
| `_AOE_STATE` | objeto global | local |
| `_aoeAtualizarAlvos()` | função | local |

---

**`_aoeRemoverBadges()`** — linha 667  
Remove todos os elementos `.aoe-warning-badge` do DOM (badges de aviso de friendly-fire sobre tokens aliados).

| Dependência | Tipo | Origem |
|---|---|---|
| DOM | API browser | nativo |

---

**`_aoeAtualizarAlvos()`** — linha 671  
Verifica quais tokens estão dentro do raio do círculo AoE. Para cada token no mapa: converte posição `%` para px, calcula distância ao centro do círculo e marca como dentro/fora. Detecta friendly-fire (aliados dentro da área) e adiciona `.aoe-warning-badge`. Atualiza `_AOE_STATE.alvos` com lista de nomes dos alvos válidos (tipo inimigo/npc).

| Dependência | Tipo | Origem |
|---|---|---|
| `_AOE_STATE` | objeto global | local |
| `MAPA_STATE` | objeto global | módulo mapa |
| `RPG_DATA` | objeto global | contexto RPG |
| `_aoeRemoverBadges()` | função | local |

---

**`atkConfirmarAoE()`** — linha 734  
Confirma seleção AoE normal: valida alvos em `_AOE_STATE.alvos`, fecha modal AoE e chama `atkConfirmarAtaque` para cada alvo individualmente.

| Dependência | Tipo | Origem |
|---|---|---|
| `_AOE_STATE` | objeto global | local |
| `atkConfirmarAtaque()` | função | local |
| `mapaHideAoECircle()` | função | local |
| `mostrarToast()` | função | global UI |

---

### Bloco 40 — Invocação de Personagem + Cálculo de Dano Final (linhas 747–935)

Pipeline de invocação de personagens como pets e sistema de cálculo de dano bruto→final com aplicação de buffs/debuffs de mod_dano e mod_defesa, armadura e resistências elementais.

**`_atkInvocarPersonagem(skill, invocadorNome, contexto, critico)`** — linha 747  
Async. Invoca personagem como pet/summon. Em `arena`: cria novo character via POST ao banco com `tipo: 'pet'`, vincula ao invocador. Em `campanha`: busca personagem existente por nome de skill e o ativa como pet (`custom_attrs.invocado = true`, `custom_attrs.invocador = invocadorNome`). Salva no banco e atualiza estado local.

| Dependência | Tipo | Origem |
|---|---|---|
| `RPG_DATA` | objeto global | contexto RPG |
| `AR` | objeto global | módulo arena |
| `sb()` | função | Supabase helper |
| `arSb()` | função | Supabase arena helper |
| `saveCharacterStats()` | função | módulo persistência |
| `COMBATE` | objeto global | módulo combate |

---

**`_skEhInvocacao(h)`** — linha 841  
Verifica se skill `h` é do tipo invocação. Retorna `true` se `h.tipo_acao === 'invocacao'` ou se `h.efeitos` contém entrada com `tipo: 'invocacao'`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`calcularDanoFinal(danoBruto, tipoDano, char, attrDefs, atacanteChar)`** — linha 848  
Calcula dano final aplicando camadas em sequência: (1) buffs `mod_dano` do atacante (somados como multiplicador), (2) buffs `mod_defesa` do alvo (redução percentual), (3) armadura (`armor` de `attrDefs`), (4) resistências elementais via `calcularDanoComResistencia`. Retorna valor inteiro arredondado. Função original não-patcheada (versão base).

| Dependência | Tipo | Origem |
|---|---|---|
| `calcularDanoComResistencia()` | função | local |
| `attrDefs` | objeto | parâmetro |

---

**`getAttrDefsParaDano(contexto)`** — linha 932  
Retorna `attrDefs` correto para o contexto: `AR.attrDefs` para `'arena'`, `RPG_DATA.attrDefs` para `'campanha'`.

| Dependência | Tipo | Origem |
|---|---|---|
| `AR` | objeto global | módulo arena |
| `RPG_DATA` | objeto global | contexto RPG |

---

### Bloco 41 — Patches BUG/OPT + Estado de Batalha (linhas 947–1100)

Patches de correção de bugs e otimizações do sistema de dano, mais funções de persistência de estado de batalha (cooldowns, efeitos ativos, condições, stats).

**`obterHpAtualSeguro(personagem)`** — linha 947 *(BUG-03 FIX)*  
Retorna HP atual do personagem de forma segura. Prioriza `hp_atual` numérico; fallback para `custom_attrs.hp_atual`; fallback final para `hp_max` ou 100. Evita NaN por dados inconsistentes.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`calcularDanoComResistencia(danoBase, tipoDano, alvo)`** — linha 964 *(OPT-01)*  
Aplica multiplicador de resistência elemental do alvo ao dano base. Lê `alvo.custom_attrs.resistencias[tipoDano]` como percentual (0-100). Retorna `danoBase * (1 - resistencia/100)`. Sem resistência definida: retorna `danoBase` intacto.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`aplicarDanoComHpTemporario(personagem, danoTotal)`** — linha 987 *(OPT-02)*  
Absorve dano com HP temporário antes de aplicar ao HP real. Verifica `personagem.custom_attrs.hp_temp`; absorve até esgotar o escudo; dano residual vai para HP real via `obterHpAtualSeguro`. Retorna `{ novoHp, novoHpTemp, danoAbsorvido, danoReal }`.

| Dependência | Tipo | Origem |
|---|---|---|
| `obterHpAtualSeguro()` | função | local |

---

**`carregarEstadoBatalha(batalhaId)`** — linha 1025  
Async. Carrega estado completo de batalha do banco Supabase (`batalhas` table). Monta objeto local com: `id`, `nome`, `turno_atual`, `participantes`, `ordem_iniciativa`, `cooldowns` (FIX: persistência de cooldowns), `efeitos_ativos`, `condicoes`, `stats`. Armazena em `MAPA_STATE.batalhas[batalhaId]`.

| Dependência | Tipo | Origem |
|---|---|---|
| `sb()` | função | Supabase helper |
| `RPG_DATA` | objeto global | contexto RPG |
| `MAPA_STATE` | objeto global | módulo mapa |

---

**`salvarEstadoBatalha(batalhaId)`** — linha 1073  
Async. Persiste estado local de batalha de volta ao banco via PATCH. Salva: `turno_atual`, `cooldowns` (FIX), `efeitos_ativos`, `condicoes`, `stats`, `updated_at`.

| Dependência | Tipo | Origem |
|---|---|---|
| `sb()` | função | Supabase helper |
| `RPG_DATA` | objeto global | contexto RPG |
| `MAPA_STATE` | objeto global | módulo mapa |

---

---

### Bloco 42 — Aplicação de Dano + Pipeline de Ataques Criativos (linhas 1101–1413)

Camada de aplicação de dano que integra cálculo final, stats de batalha, estado moribundo/morte e drops de NPC. Ataques criativos: envio pelo jogador, polling de status, aprovação/rejeição pelo mestre (arena e campanha).

**`atkAplicarDano(nomeAlvo, dano, contexto, tipoDano)`** — linha 1102  
Async. Orquestra aplicação completa de dano. Em arena: aplica via `calcularDanoFinal` e PATCH direto. Em campanha: aplica `calcularDanoFinal` + `obterHpAtualSeguro`, registra stats de batalha (dano por atacante, dano recebido, maior dano único, habilidades usadas), persiste via `saveCharacterStats`, re-renderiza views. HP zero: detecta se é jogador (estado moribundo com salvaguardas) ou NPC (morte direta + drop automático via `_executarDropNPC`). Emite broadcast `personagem_caiu` / `personagem_morto`. Registra no `COMBATE_LOG`.

| Dependência | Tipo | Origem |
|---|---|---|
| `calcularDanoFinal()` | função | local |
| `obterHpAtualSeguro()` | função | local |
| `getAttrDefsParaDano()` | função | local |
| `saveCharacterStats()` | função | módulo persistência |
| `_executarDropNPC()` | função | local |
| `_verificarVitoriaBatalha()` | função | local |
| `combateBroadcast()` | função | módulo combate |
| `COMBATE_LOG` | objeto global | módulo combate |
| `MAPA_STATE` / `BATALHA_ATUAL_ID` | objetos globais | módulo mapa |
| `RPG_DATA` / `AR` | objetos globais | contextos |
| `renderCharView()` / `renderAttrView()` / `mapaRenderStatus()` | funções | UI |
| `sb()` / `arSb()` | funções | Supabase helpers |

---

**`atkEnviarAtaqueCriativo()`** — linha 1215  
Async. Envia ação criativa pendente. Cria objeto `pendente` com id, atacante, alvo, descrição, tipo criativo, tipo de alvo. Em arena: insere via `arSb` + se mestre abre aprovação direta, senão mostra UI "aguardando". Em campanha: insere via `criativoInserir` + mesma lógica de papéis. Inicia polling de fallback com `criativoIniciarPolling`.

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoInserir()` | função | local |
| `criativoIniciarPolling()` | função | local |
| `_abrirModalAprovacaoPorStatus()` | função | local |
| `CRIATIVOS_CAMP` / `CRIATIVO_ID_ATUAL` | globais | módulo criativos |
| `COMBATE` | objeto global | módulo combate |
| `arSb()` / `AR` | funções/global | módulo arena |
| `RPG_DATA` | objeto global | contexto RPG |

---

**`atkEnviarSolicitacaoSkill()`** — linha 1290  
Async. Envia solicitação de uso de skill fora de combate para aprovação do mestre. Serializa dados da skill em `descricao` com prefixo `[SKILL:{...}]`. Insere via `criativoInserir` e inicia polling. Se mestre, abre aprovação direto.

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoInserir()` | função | local |
| `criativoIniciarPolling()` | função | local |
| `_abrirModalAprovacaoPorStatus()` | função | local |
| `COMBATE` / `CRIATIVOS_CAMP` | globais | módulo combate/criativos |
| `RPG_DATA` | objeto global | contexto RPG |

---

**`renderAtaquesPendentes()`** — linha 1344  
Renderiza painel de ataques criativos pendentes da arena no elemento `ar-ataques-pendentes`. Exibe apenas se mestre e há pendentes. Para cada pendente: campo de quantidade de dados, select de tipo de dado, botão rolar, resultado, botões aprovar/rejeitar.

| Dependência | Tipo | Origem |
|---|---|---|
| `AR` | objeto global | módulo arena |
| `RPG_DATA` | objeto global | contexto RPG |

---

**`atkRolarParaPendente(apId)`** — linha 1379  
Rola dados para ataque criativo pendente. Lê quantidade e faces dos inputs do painel, chama `rolarFormula`, exibe resultado no span e salva em `dataset.total`.

| Dependência | Tipo | Origem |
|---|---|---|
| `rolarFormula()` | função | módulo dados |

---

**`atkMestreAprovar(apId)`** — linha 1391  
Async. Mestre aprova ataque criativo pendente: lê dano rolado do dataset, muda status para `'aprovado'`, aplica dano via `atkAplicarDano`, registra no log, salva estado e re-renderiza.

| Dependência | Tipo | Origem |
|---|---|---|
| `atkAplicarDano()` | função | local |
| `arAddLog()` / `arSalvarEstado()` | funções | módulo arena |
| `AR` | objeto global | módulo arena |

---

**`atkMestreRejeitar(apId)`** — linha 1405  
Async. Mestre rejeita ataque criativo: muda status para `'rejeitado'`, registra no log arena e salva estado.

| Dependência | Tipo | Origem |
|---|---|---|
| `arAddLog()` / `arSalvarEstado()` | funções | módulo arena |
| `AR` | objeto global | módulo arena |

---

### Bloco 43 — Sistema de Criativos: CRUD, Sync e Render (linhas 1422–1669)

Persistência e sincronização de ações criativas entre mestre e jogadores. Recepção de eventos realtime, normalização de dados, detecção de tipos (criativo/skill/combate_pedido/DC), notificações UX e renderização do painel do mestre com badges de status.

**`_parseDCData(formulaAprovada)`** — linha 1422  
Helper: parseia dados de DC armazenados em `formula_aprovada` com prefixo `__DC__`. Retorna objeto `{ dado, dc, eh_ataque, resultado, critico, natural_max, ... }` ou `null`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`criativoSalvar(apenasId)`** — linha 1427  
Async. Persiste criativos locais no banco via PATCH. Se `apenasId` fornecido, salva apenas esse registro. Campos: `status`, `formula_aprovada`, `mod_atributo`, `mod_atributo_pct`, `custo_cobrado`, `animacao`. Suporta arena (`arSb`) e campanha (`sb`).

| Dependência | Tipo | Origem |
|---|---|---|
| `sb()` / `arSb()` | funções | Supabase helpers |
| `CRIATIVOS_CAMP` | array global | módulo criativos |
| `AR` / `RPG_DATA` | globais | contextos |

---

**`criativoInserir(pendente)`** — linha 1451  
Async. Insere novo criativo no banco via POST (tabela `criativos`). Campos: `rpg_id`, `id`, `atacante`, `alvo`, `descricao`, `turno`, `status`, `criativo_tipo`, `criativo_alvo_tipo`.

| Dependência | Tipo | Origem |
|---|---|---|
| `sb()` | função | Supabase helper |
| `RPG_DATA` | objeto global | contexto RPG |

---

**`criativoReceberLinhaRemota(rec)`** — linha 1471  
Processa linha recebida do realtime Supabase. Normaliza objeto criativo (parse JSON de `animacao`, extração de DC via `_parseDCData`, restauração de `_alvos_area`). Detecta tipo por prefixo de descrição: `[COMBATE_PEDIDO]`, `[SKILL:{...}]`. Atualiza ou insere em `CRIATIVOS_CAMP`. Chama `criativoRenderMestre` e `criativoAtualizarStepJogador`. Emite toasts/notificações para mestre (nova solicitação, DC rolado com sucesso/falha, vibração mobile UX-02, badge pulsante no painel).

| Dependência | Tipo | Origem |
|---|---|---|
| `_parseDCData()` | função | local |
| `criativoRenderMestre()` | função | local |
| `criativoAtualizarStepJogador()` | função | local |
| `criativoNotifMostrar()` | função | local |
| `_limparNotifCreativo()` | função | local |
| `_abrirModalAprovacaoPorStatus()` | função | local |
| `CRIATIVOS_CAMP` / `CRIATIVO_ID_ATUAL` | globais | módulo criativos |
| `RPG_DATA` / `AR` | globais | contextos |
| `mostrarToast()` | função | global UI |

---

**`criativoRenderMestre()`** — linha 1579  
Renderiza painel do mestre com ações criativas aguardando resolução. Filtra `CRIATIVOS_CAMP` por status: `pendente`, `dc_rolado_sucesso`, `aprovado_dc`, `aprovado_aguardando_rolagem`, `dc_rolado_narrativo` (ataque mal marcado). Para cada criativo: card com badge de tipo (NPC/Jogador, Criativo/Skill/Combate/Buff/Dano), descrição contextualizada por fase, botões de ação (Definir Desafio / Montar Dano / Definir Buff / Gerenciar Combate / Rejeitar). Limpa badge de notificação UX-02.

| Dependência | Tipo | Origem |
|---|---|---|
| `CRIATIVOS_CAMP` | array global | módulo criativos |
| `_limparNotifCreativo()` | função | local |
| `_abrirModalAprovacaoPorStatus()` | função | local |
| `mestreAbrirModalCombatePedido()` | função | local |
| `criativoMestreLimparTodas()` | função | local |
| `criativoMestreRejeitarDireto()` | função | local |
| `personagemTemJogador()` | função | local |
| `AR` / `RPG_DATA` | globais | contextos |

---

---

### Bloco 44 — Modal Criativo Mestre: Fase 1, Fase 2 e Painel de Efeitos Extras (linhas 1670–2061)

Interface do mestre para resolução de ações criativas em duas fases. Fase 1: definição de DC e dado. Fase 2: builder de dados de dano/cura/buff com resultado do DC, animações e efeitos extras. Painel de extras injeta formulário dinâmico (buff/debuff/cura/HOT/DOT/imobilizar/atordoar) com re-hidratação de valores salvos.

**`_adicionarBadgeCriticoModalFase2(c)`** — linha 1672  
Helper de UI: retorna HTML de badge de crítico (dourado para crítico natural, dourado-claro para sucesso crítico). Exibido no cabeçalho do modal Fase 2.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`abrirModalCriativoMestre(id)`** — linha 1687  
Abre modal de resolução de ação criativa do mestre. Detecta Fase 1 (pendente/inicial, define DC) vs Fase 2 (dc_rolado_sucesso, monta dano). Popula header com badges de tipo (ataque/suporte/narrativo) e alvo. Em Fase 2: inicializa `CRIATIVO_MESTRE_BUILDER` com dados da skill, popula select de atributos, exibe resultado do DC com badge de crítico, reseta campos de animação, injeta `_injetarCriativoExtrasPanel`. Em Fase 1: reseta dado d20, campo DC, checkbox "é ataque", custo, cadastro de skill. Usa transição animada UX-03 entre fases.

| Dependência | Tipo | Origem |
|---|---|---|
| `_adicionarBadgeCriticoModalFase2()` | função | local |
| `_injetarCriativoExtrasPanel()` | função | local |
| `criativoMestreBuilderAtualizar()` | função | local |
| `criativoMestreAtributoMudou()` | função | local |
| `criativoEhAtaqueChange()` | função | local |
| `criativoAnimTipoChange()` | função | local |
| `parsearFormulaDano()` | função | módulo combate |
| `CRIATIVOS_CAMP` / `CRIATIVO_MESTRE_BUILDER` | globais | módulo criativos |
| `RPG_DATA` / `AR` | globais | contextos |

---

**`_abrirModalAprovacaoPorStatus(id)`** — linha 1894  
Helper: decide qual modal abrir baseado no status do criativo. Status `dc_rolado_sucesso` ou `aprovado_aguardando_rolagem` → `abrirModalCriativoMestre`. Demais status → `abrirModalAprovacaoCompleta` (novo modal unificado, se disponível) ou fallback para `abrirModalCriativoMestre`.

| Dependência | Tipo | Origem |
|---|---|---|
| `abrirModalCriativoMestre()` | função | local |
| `abrirModalAprovacaoCompleta()` | função | local (opcional) |
| `CRIATIVOS_CAMP` | array global | módulo criativos |

---

**`criativoCobrarCustoToggle()`** — linha 1910  
Toggle de UI: mostra/oculta campo de custo de ação criativa ao mestre. Ao ativar, chama `criativoCustoAtributoMudou()` para pré-visualização do valor atual.

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoCustoAtributoMudou()` | função | local |

---

**`criativoCustoAtributoMudou()`** — linha 1917  
Preview de custo: exibe valor atual do atributo selecionado do atacante no campo de preview.

| Dependência | Tipo | Origem |
|---|---|---|
| `CRIATIVOS_CAMP` | array global | módulo criativos |
| `RPG_DATA` / `AR` | globais | contextos |

---

**`fecharModalCriativoMestre()`** — linha 1929  
Fecha overlay do modal criativo do mestre.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`_injetarCriativoExtrasPanel(c)`** — linha 1934  
Injeta painel de efeitos extras no modal Fase 2. Cria `<div#criativo-extras-panel>` dinamicamente. Para **suporte**: checkboxes de Cura Imediata, HOT, Boost de Dano, Boost de Defesa (AC-05-G2), HP Temporário, Remover Debuff. Para **ataque**: checkboxes de DOT, Redução de Dano, Imobilizar, Atordoar. Se `criativo_alvo_tipo === 'area'`: campo de alvos separados por vírgula. Re-hidrata valores de `custo_cobrado._efeitos_extras` e `_alvos_area` ao reabrir modal.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

### Bloco 45 — Modal de Ação do Jogador (linhas 2066–2230)

Modal de ação do personagem para jogadores em campanha. Apresenta opções: ação criativa (com fluxo de tipo+alvo), solicitar combate, usar item. Subpainéis gerenciados por `_acaoMostrarPainel`.

**`abrirModalAcao(nomePersonagem)`** — linha 2066  
Abre modal de ação para personagem. Define `_acaoPersonagemAtual`. Verifica se tem skills cadastradas para mostrar botão de combate (mestre) ou criativa (jogador fora de combate).

| Dependência | Tipo | Origem |
|---|---|---|
| `_acaoMostrarPainel()` | função | local |
| `_estadoBatalhaJogador()` | função | local |
| `atkGetHabilidadesCampanha()` | função | módulo combate |
| `RPG_DATA` | objeto global | contexto RPG |

---

**`fecharModalAcao()`** — linha 2093  
Fecha overlay do modal de ação.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`_acaoMostrarPainel(id)`** — linha 2097  
Oculta todos os subpainéis do modal de ação e exibe apenas o indicado por `id`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`acaoVoltarRaiz()`** — linha 2106  
Volta ao painel raiz do modal de ação.

| Dependência | Tipo | Origem |
|---|---|---|
| `_acaoMostrarPainel()` | função | local |

---

**`acaoMostrarCriativa()`** — linha 2110  
Exibe subpainel de ação criativa. Reseta seleção de tipo e alvo, oculta seções dependentes.

| Dependência | Tipo | Origem |
|---|---|---|
| `_acaoMostrarPainel()` | função | local |

---

**`acaoSelecionarTipo(tipo, btn)`** — linha 2128  
Seleciona tipo de ação criativa (ataque/suporte/narrativo). Atualiza visual dos botões. Exibe painel de alvo correto. Narrativo: pula seleção de alvo e mostra descrição + botão enviar diretamente.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`acaoSelecionarAlvo(alvoTipo, btn)`** — linha 2165  
Seleciona tipo de alvo (único/área/próprio/aliado). Popula selects com personagens da batalha atual (filtrando inimigos ou aliados por `_getBattleChars`). Área: pré-preenche campo de texto com lista de nomes.

| Dependência | Tipo | Origem |
|---|---|---|
| `BATALHA_ATUAL_ID` / `MAPA_STATE` | globais | módulo mapa |
| `RPG_DATA` | objeto global | contexto RPG |

---

---

### Bloco 46 — Ações do Jogador: Item, Criativo e Pedido de Combate (linhas 2231–2414)

Subpainéis do modal de ação do jogador. Uso de itens consumíveis via inventário, envio de ação criativa com tipo/alvo, solicitação de entrada em combate ao mestre.

**`modalAcaoCriativa()`** — linha 2232  
Alias para `acaoMostrarCriativa()`.

| Dependência | Tipo | Origem |
|---|---|---|
| `acaoMostrarCriativa()` | função | local |

---

**`modalAcaoSolicitarCombate()`** — linha 2234  
Exibe subpainel de solicitação de combate e limpa campo de motivo.

| Dependência | Tipo | Origem |
|---|---|---|
| `_acaoMostrarPainel()` | função | local |

---

**`modalAcaoItem()`** — linha 2240  
Exibe subpainel de uso de itens. Carrega inventário via `carregarInventarioChar` se necessário (lazy load). Filtra consumíveis com quantidade > 0 e não equipados. Cada item clicável abre `abrirModalUsarItem`.

| Dependência | Tipo | Origem |
|---|---|---|
| `_acaoMostrarPainel()` | função | local |
| `carregarInventarioChar()` | função | módulo inventário |
| `abrirModalUsarItem()` | função | módulo inventário |
| `_efeitoLabel()` | função | local |
| `INV` | objeto global | módulo inventário |
| `RPG_DATA` | objeto global | contexto RPG |

---

**`usarItemConsumivel(nomeChar, idx)`** — linha 2297  
Usa item consumível por índice na lista legada (`custom_attrs.itens`). Cria criativo com prefixo `[USO DE ITEM]` e insere via `criativoInserir`. Se mestre, abre aprovação direta; senão, inicia polling.

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoInserir()` | função | local |
| `criativoIniciarPolling()` | função | local |
| `_abrirModalAprovacaoPorStatus()` | função | local |
| `CRIATIVOS_CAMP` / `CRIATIVO_ID_ATUAL` | globais | módulo criativos |
| `RPG_DATA` | objeto global | contexto RPG |

---

**`acaoEnviarCriativa()`** — linha 2336  
Async. Lê descrição, tipo e tipo-de-alvo do modal de ação, resolve alvo do select/input correto, cria objeto criativo e insere. Se mestre, abre aprovação; senão, polling + toast.

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoInserir()` | função | local |
| `criativoRenderMestre()` | função | local |
| `criativoIniciarPolling()` | função | local |
| `_abrirModalAprovacaoPorStatus()` | função | local |
| `CRIATIVOS_CAMP` / `CRIATIVO_ID_ATUAL` | globais | módulo criativos |
| `RPG_DATA` | objeto global | contexto RPG |

---

**`acaoEnviarPedidoCombate()`** — linha 2392  
Async. Envia pedido de entrada em combate ao mestre. Cria criativo com prefixo `[COMBATE_PEDIDO] mapa:<id>` e motivo opcional. Insere e renderiza painel do mestre.

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoInserir()` | função | local |
| `criativoRenderMestre()` | função | local |
| `CRIATIVOS_CAMP` | array global | módulo criativos |
| `MAPA_STATE` | objeto global | módulo mapa |
| `RPG_DATA` | objeto global | contexto RPG |

---

### Bloco 47 — Aprovação de Combate + Builder de Dados do Mestre (linhas 2417–2696)

Modal do mestre para gerenciar pedido de combate (listar elegíveis, criar batalha). Builder de dados para Fase 1 do criativo (seleção de dado + DC + animação de ataque).

**`mestreAbrirModalCombatePedido(id)`** — linha 2417  
Abre modal de aprovação de pedido de combate. Extrai `mapa_id` da descrição. Lista personagens elegíveis no mapa (HP > 0, não em batalha ativa) com checkboxes para seleção de participantes.

| Dependência | Tipo | Origem |
|---|---|---|
| `CRIATIVOS_CAMP` | array global | módulo criativos |
| `MAPA_STATE` | objeto global | módulo mapa |
| `RPG_DATA` | objeto global | contexto RPG |

---

**`fecharModalCombatePedido()`** — linha 2465  
Fecha overlay do modal de pedido de combate.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`mestreAprovarCombatePedido()`** — linha 2469  
Async. Valida mínimo 2 participantes selecionados. Remove pedido de `CRIATIVOS_CAMP` e do banco. Cria estrutura de batalha em `MAPA_STATE.batalhas`, auto-rola iniciativa para NPCs. Persiste via `criarBatalhaRemota`, emite broadcast `batalha_criada` e chama `batalhaVerificarIniciativasCompletas`.

| Dependência | Tipo | Origem |
|---|---|---|
| `batalhaNovaId()` | função | local |
| `criarBatalhaRemota()` | função | local |
| `combateBroadcast()` | função | módulo combate |
| `batalhaVerificarIniciativasCompletas()` | função | local |
| `_aplicarEstadoBatalhaUI()` / `_atualizarBadgeMesa()` / `_atualizarSeletorBatalhas()` | funções | local |
| `CRIATIVOS_CAMP` / `MAPA_STATE` / `BATALHA_ATUAL_ID` | globais | módulo mapa/criativos |
| `sb()` | função | Supabase helper |

---

**`mestreRejeitarCombatePedido()`** — linha 2517  
Async. Rejeita pedido de combate: remove de `CRIATIVOS_CAMP` e do banco via DELETE.

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoRenderMestre()` | função | local |
| `sb()` | função | Supabase helper |
| `CRIATIVOS_CAMP` / `RPG_DATA` | globais | contextos |

---

**`criativoCadastrarSkillToggle()`** — linha 2530  
Toggle: mostra/oculta campos de cadastro de skill no modal do mestre.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`criativoMestreBuilderAdd(faces)`** — linha 2536  
Adiciona dado ao builder de dano (incrementa quantidade se já existe, senão push novo grupo).

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoMestreBuilderAtualizar()` | função | local |
| `CRIATIVO_MESTRE_BUILDER` | array global | módulo criativos |

---

**`criativoMestreBuilderRemove(faces)`** — linha 2541  
Remove dado do builder (decrementa; remove grupo se qtd chegar a 0).

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoMestreBuilderAtualizar()` | função | local |
| `CRIATIVO_MESTRE_BUILDER` | array global | módulo criativos |

---

**`criativoMestreBuilderAtualizar()`** — linha 2548  
Atualiza label de fórmula e chips visuais do builder de dados no modal do mestre.

| Dependência | Tipo | Origem |
|---|---|---|
| `formulaDeGrupos()` | função | módulo combate |
| `CRIATIVO_MESTRE_BUILDER` | array global | módulo criativos |

---

**`criativoMestreAtributoMudou()`** — linha 2562  
Preview: exibe valor atual do atributo selecionado do atacante ao mestre.

| Dependência | Tipo | Origem |
|---|---|---|
| `CRIATIVOS_CAMP` | array global | módulo criativos |
| `RPG_DATA` / `AR` | globais | contextos |

---

**`criativoSelecionarDado(btn, faces)`** — linha 2577  
Seleciona dado DC: remove classe `dc-dado-sel` de todos os botões, adiciona ao clicado e chama `criativoDCPreview`.

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoDCPreview()` | função | local |

---

**`criativoToggleAtaque()`** — linha 2583  
Toggle do checkbox "é ataque / tem efeito" no modal do mestre.

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoEhAtaqueChange()` | função | local |

---

**`criativoEhAtaqueChange()`** — linha 2588  
Atualiza ícone e descrição do checkbox de ataque. Ligado: "Jogador rola DC; se passar, Fase 2". Desligado: "Resultado narrativo".

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`criativoDCPreview()`** — linha 2601  
Calcula e exibe preview do DC: limiar de crítico `(faces - dc) / 2 + dc` e regra de crítico natural (natural = faces).

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`_criativoAbrirModalOverlay(c)`** — linha 2613  
Restaura modal de ataque para modo overlay (CSS fixo, fullscreen). Garante que o modal está no `body` (não num anchor inline), redefine `cssText` e chama `criativoAtualizarStepJogador` + `atkIrParaStep('pendente')`.

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoAtualizarStepJogador()` | função | local |
| `atkIrParaStep()` | função | módulo combate |

---

**`criativoMestreConcluirFase1()`** — linha 2641  
Async. Conclui Fase 1 do criativo: lê dado, DC e flag "é ataque". Opcional: cobra custo de atributo (`custo_cobrado`). Serializa DC em `formula_aprovada` com prefixo `__DC__`. Salva intenção de cadastrar skill (`_cadastrar_skill`, `_skill_meta`). Persiste via `criativoSalvar`, renderiza painel. Se é a própria ação do mestre, abre overlay.

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoSalvar()` | função | local |
| `criativoRenderMestre()` | função | local |
| `_criativoAbrirModalOverlay()` | função | local |
| `CRIATIVOS_CAMP` / `CRIATIVO_ID_ATUAL` | globais | módulo criativos |

---

**`crLabelAcao(tipo)`** — linha 2694  
Helper: retorna label de ação por tipo (`'ataque'` → `'⚔ Dano'`, `'suporte'` → `'✨ Efeito'`, `'narrativo'` → `'📜 Ação'`).

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

### Bloco 48 — Criativo Fase 2: Definir Dano/Buff + Efeitos Extras (linhas 2699–2901)

Fase 2 do fluxo criativo: mestre define fórmula de dano, efeitos extras (DOT/HOT/buff/debuff/imobilizar/atordoar), animação e alvos de área. Opcionalmente cadastra a ação como skill permanente.

**`criativoMestreDefinirDano()`** — linha 2699  
Async. Coleta do modal Fase 2: fórmula de dados (`CRIATIVO_MESTRE_BUILDER`), atributo modificador, % de modificação, mensagem, animação (tipo, url/svg/cor/ícone/trilha/tamanho/duração/posição). Coleta efeitos extras do painel injetado (HOT, DOT, boost dano, boost defesa, HP temp, cura imediata, remover debuff, imobilizar, atordoar). Valida suporte sem efeito. Serializa alvos de área por vírgula. Preserva `custo_cobrado` original em `_custo_original`. Persiste tudo em `custo_cobrado` (campos `_dano_meta`, `_efeitos_extras`, `_alvos_area`, `_dc_data`). Se `_cadastrar_skill`: cria skill permanente via POST e empurra para `RPG_DATA.skills`. Salva via `criativoSalvar`, sincroniza animação via `_sincronizarAnimacaoCriativo`.

| Dependência | Tipo | Origem |
|---|---|---|
| `formulaDeGrupos()` | função | módulo combate |
| `criativoSalvar()` | função | local |
| `criativoRenderMestre()` | função | local |
| `_sincronizarAnimacaoCriativo()` | função | local |
| `_criativoAbrirModalOverlay()` | função | local |
| `_skCharId()` | função | local |
| `crLabelAcao()` | função | local |
| `fecharModalCriativoMestre()` | função | local |
| `CRIATIVO_MESTRE_BUILDER` / `CRIATIVOS_CAMP` | globais | módulo criativos |
| `RPG_DATA` / `AR` | globais | contextos |
| `sb()` | função | Supabase helper |

---

---

### Bloco 49 — Rejeição, Limpeza e Notificações de Criativos (linhas 2902–3133)

Ações finais do mestre sobre criativos (rejeitar com motivo, limpar todos, reclassificar), sistema de notificação in-app para jogadores e mestre, e helper de reset do painel pendente.

**`criativoMestreRejeitar()`** — linha 2903  
Async. Rejeita criativo pelo modal do mestre. Solicita motivo via `prompt` (cancelar = abort). Persiste `status: 'rejeitado'` e `motivo_rejeicao`. Após 3s transiciona para `'concluido'`; após mais 30s remove de `CRIATIVOS_CAMP` e deleta do banco.

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoSalvar()` | função | local |
| `criativoRenderMestre()` | função | local |
| `fecharModalCriativoMestre()` | função | local |
| `CRIATIVOS_CAMP` | array global | módulo criativos |
| `sb()` / `arSb()` / `AR` / `RPG_DATA` | globais | contextos |

---

**`criativoMestreRejeitarDireto(id)`** — linha 2953  
Async. Rejeita criativo diretamente do card sem abrir modal. Mesma lógica de rejeição/transição de `criativoMestreRejeitar` mas recebe `id` como parâmetro direto.

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoSalvar()` | função | local |
| `criativoRenderMestre()` | função | local |
| `CRIATIVOS_CAMP` | array global | módulo criativos |
| `sb()` / `arSb()` / `AR` / `RPG_DATA` | globais | contextos |

---

**`criativoMestreLimparTodas()`** — linha 3000  
Async. Remove todas as solicitações pendentes (status `pendente` ou `aprovado_dc`). Não inclui `dc_rolado_sucesso` (AC-09-B12: jogador já rolou). Remove de `CRIATIVOS_CAMP` e deleta do banco via Promise.all.

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoRenderMestre()` | função | local |
| `CRIATIVOS_CAMP` | array global | módulo criativos |
| `sb()` / `arSb()` / `AR` / `RPG_DATA` | globais | contextos |

---

**`criativoReclassificar(id)`** — linha 3023 *(AC-10-B13)*  
Async. Corrige criativo narrativo mal marcado como não-ataque: força `_dc.eh_ataque = true` e status `dc_rolado_sucesso`. Permite mestre montar dano após DC já rolado.

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoSalvar()` | função | local |
| `criativoRenderMestre()` | função | local |
| `_abrirModalAprovacaoPorStatus()` | função | local |
| `CRIATIVOS_CAMP` | array global | módulo criativos |

---

**`criativoNotifMostrar(tipo, titulo, msg, labelBotao)`** — linha 3040  
Exibe barra de notificação in-app para jogador/mestre. Tipos: `'aprovado'`, `'recusado'`, `'nova-solicitacao'`. Adapta cores e estilo. Move barra para sidebar se disponível (UX: não cobre mapa). Atualiza também `criativo-mapa-bar` (painel legado).

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`criativoNotifFechar()`** — linha 3088  
Oculta as barras de notificação (`criativo-notif-bar` e `criativo-mapa-bar`) e limpa `_criativoNotifId`.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`criativoNotifAcao()`** — linha 3096  
Handler do botão de ação da notificação. Mestre: navega para aba Mesa/Mapas e abre modal de aprovação. Jogador: reabre modal de ataque no step pendente com estado atualizado.

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoNotifFechar()` | função | local |
| `_abrirModalAprovacaoPorStatus()` | função | local |
| `criativoAtualizarStepJogador()` | função | local |
| `atkIrParaStep()` | função | módulo combate |
| `CRIATIVOS_CAMP` / `CRIATIVO_ID_ATUAL` / `_criativoNotifId` | globais | módulo criativos |
| `AR` / `RPG_DATA` | globais | contextos |

---

**`_criativoHideAllPendente()`** — linha 3126  
Oculta todos os sub-divs do step-pendente no modal de ataque e o painel inline do mapa.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

### Bloco 50 — Atualização de Step do Jogador, Polling e Rolagem de DC (linhas 3135–3511)

Ciclo de vida do jogador no fluxo de ação criativa: atualização visual do step-pendente por status, polling de fallback via Supabase e rolagem do dado de DC com animação visual.

**`criativoAtualizarStepJogador(c)`** — linha 3135  
Atualiza UI do step-pendente baseado no status do criativo. Casos:
- `aprovado_dc`: exibe div de DC definida com dado/valor/limiar de crítico e mensagem do mestre. Se modal fechado: painel inline ou notif.
- `dc_rolado_sucesso`: exibe "aguardando mestre montar dano/buff".
- `dc_rolado_narrativo` / `dc_rolado_falha`: exibe resultado narrativo (sucesso/falha com ícone).
- `aprovado_aguardando_rolagem`: exibe fórmula de dano/buff aprovada com label contextual (Rolar Dano / Rolar Efeito). Se modal fechado: painel inline ou notif.
- `rejeitado`: exibe div de rejeição com motivo.

| Dependência | Tipo | Origem |
|---|---|---|
| `_criativoHideAllPendente()` | função | local |
| `criativoNotifMostrar()` | função | local |
| `atkIrParaStep()` | função | módulo combate |
| `crLabelAcao()` | função | local |
| `CRIATIVOS_CAMP` / `CRIATIVO_ID_ATUAL` | globais | módulo criativos |

---

**`criativoIniciarPolling(id)`** — linha 3285  
Inicia polling de fallback a cada 3,5s (até 120 tentativas ≈ 7min). Consulta banco por mudança de status. Se mudou: chama `criativoReceberLinhaRemota` para atualizar UI. Reseta contagem se ainda há fases a percorrer. Para ao atingir status final (`rejeitado`, `concluido`, `dc_rolado_narrativo`, `dc_rolado_falha`).

| Dependência | Tipo | Origem |
|---|---|---|
| `criativoStopPolling()` | função | local |
| `criativoReceberLinhaRemota()` | função | local |
| `CRIATIVO_ID_ATUAL` | global | módulo criativos |
| `sb()` / `arSb()` / `AR` / `RPG_DATA` | globais | contextos |

---

**`criativoStopPolling()`** — linha 3324  
Para o timer de polling limpando o interval.

| Dependência | Tipo | Origem |
|---|---|---|
| — | — | — |

---

**`criativoJogadorRolarDC()`** — linha 3329  
Async. Jogador rola o dado de DC (Fase 1→2). Fluxo: (1) desconta custo de atributo se `custo_cobrado` definido; (2) exibe modal animado `_dcMostrarModalRolagem` com embaralhamento de 490ms; (3) calcula crítico (natural máx ou acima do limiar), sucesso, falha crítica AC-12-B14; (4) para críticos/falhas: aguarda clique em "Vi! Continuar" (UX-04, timeout 12s); (5) fecha modal, emite broadcast `dados_rolados`; (6) por status: falha → `dc_rolado_falha` + transição para concluído em 5s; sucesso narrativo → `dc_rolado_narrativo`; sucesso com ataque → `dc_rolado_sucesso` (aguarda Fase 2); (7) aplica consequência mecânica de falha crítica via `_aplicarConsequenciaFalhaCritica`. Persiste via `criativoSalvar`.

| Dependência | Tipo | Origem |
|---|---|---|
| `_dcMostrarModalRolagem()` / `_dcMostrarResultado()` / `_dcFecharModalRolagem()` | funções | local |
| `_aplicarConsequenciaFalhaCritica()` | função | local |
| `criativoAtualizarStepJogador()` | função | local |
| `criativoSalvar()` / `criativoRenderMestre()` | funções | local |
| `_criativoAbrirModalOverlay()` | função | local |
| `atkIrParaStep()` | função | módulo combate |
| `descontarCustoSkill()` | função | local |
| `combateBroadcast()` | função | módulo combate |
| `CRIATIVOS_CAMP` / `CRIATIVO_ID_ATUAL` | globais | módulo criativos |
| `RPG_DATA` / `AR` | globais | contextos |

---
