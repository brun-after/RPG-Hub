# Guia de Módulos — RPG Hub

> **Para colaboradores (humanos ou IA):** Leia este documento antes de qualquer alteração.  
> Ele descreve onde está cada parte do sistema e o que você precisa abrir para cada tipo de mudança.

---

## Como o código está organizado

O JavaScript do RPG Hub foi dividido em **25 arquivos** dentro da pasta `js/`, organizados por domínio. Não existe build step, bundler ou npm — os arquivos são carregados diretamente no `index.html` em ordem de dependência.

```
js/
├── config.js                  # Credenciais e constantes globais
├── state.js                   # Variáveis de estado global da aplicação
├── init.js                    # Sinal de inicialização (carregado por último)
│
├── core/                      # Infraestrutura base (sem features)
│   ├── events.js              # Helpers de permissão e utilitários de batalha
│   ├── utils.js               # Ícones, animações CSS, configuração de dados
│   ├── supabase.js            # Cliente Supabase: leitura, escrita, upload
│   └── realtime.js            # WebSocket / sincronização em tempo real
│
├── auth/
│   └── auth.js                # Login, registro, recuperação de senha, sessão
│
├── chat/
│   └── chat.js                # Chat em tempo real via Supabase Broadcast
│
├── characters/
│   ├── characters.js          # Fichas de personagem, atributos, level up, XP
│   └── skills.js              # Habilidades: CRUD, builder de fórmulas, lore, novo mapa
│
├── combat/
│   ├── combat.js              # Sistema de combate: iniciativa, turnos, dano, críticos
│   └── animations.js          # Animações de combate no Canvas 2D
│
├── maps/
│   ├── camera.js              # Efeitos visuais, zonas, tokens mortos, inicialização
│   └── maps.js                # Editor de mapas, fog of war, tokens, movimento
│
├── systems/
│   ├── inventory.js           # Inventário, equipamentos, itens, wizard de campanha
│   ├── lore.js                # Lore: renderização, filtros, CRUD de entradas
│   ├── npcs.js                # Geração e posicionamento de NPCs genéricos
│   ├── creative.js            # Ações criativas, tutorial, fluxo de ataque da arena
│   ├── catalog.js             # Aparência (APMOD), mapeamento de atributos, catálogo
│   └── arena.js               # Modo Arena (PvP/PvE): estado, navegação, combate
│
├── hub/
│   ├── hub.js                 # Hub de campanhas: lista, mesa 3 colunas, iniciarApp()
│   └── import.js              # Importação de campanhas, geração por IA, tabs, toasts
│
└── ui/
    ├── modals.js              # Mercado secreto, painel de sessão, sistema de paredes
    └── tabs.js                # Editor de cena: paredes, portas, chaves, baús, obstáculos
```

---

## Detalhamento por arquivo

---

### `js/config.js` — 91 linhas
**Credenciais e constantes da aplicação.**

Contém:
- `SUPABASE_URL`, `SUPABASE_KEY` — credenciais de acesso ao banco
- `HCAPTCHA_SITEKEY` — chave do captcha de registro
- `HUB_EVENTS` — event bus central (pub/sub entre módulos)
- `EMAIL_CONFIRMATION_ENABLED` — liga/desliga confirmação de e-mail

**Edite aqui quando:** precisar trocar as credenciais do Supabase, mudar a chave do hCaptcha, ou ativar/desativar confirmação de e-mail.

---

### `js/state.js` — 441 linhas
**Todas as variáveis de estado global da aplicação.**

Contém:
- `SESSION` — sessão do usuário autenticado `{ access_token, user: { id, email } }`
- `RPG_DATA` — dados completos da campanha ativa (personagens, habilidades, mapas, etc.)
- `CURRENT_RPG` — ID da campanha aberta
- `HUB_DATA` — lista de campanhas do usuário `{ rpgs: [] }`
- `MAPA_ZOOM`, `MAPA_STATE`, `BATALHA_ATUAL_ID` — estado do mapa e batalha
- `CHAT` — objeto com mensagens, online, não lidos
- `HISTORICO` — histórico de rolagens de dados
- `TIPOS_DADO`, `IMPORT_CSVS` — configurações de dados e importação
- Utilitários de câmera automática e tamanho de personagem por dispositivo

**Edite aqui quando:** precisar adicionar uma nova variável de estado global, ou mudar o valor padrão de algum estado.

---

### `js/core/supabase.js` — 506 linhas
**Cliente Supabase: toda a comunicação com o banco de dados.**

Funções principais:
- `sb(method, path, body)` — chamada REST genérica ao Supabase
- `sbUpload(bucket, path, file)` — upload de arquivos para Storage
- `getAllRPGs()` — lista todas as campanhas do usuário
- `lerRPG(id)` — carrega todos os dados de uma campanha
- `importRPG(data)` — cria campanha com dados importados
- `updateRPGData(rpgId, section, data)` — salva seção de dados na campanha
- `deleteRPGData(id)` — remove entrada do banco
- Lógica de retry com backoff exponencial

**Edite aqui quando:** precisar mudar como dados são lidos/salvos no banco, adicionar nova tabela, ou alterar queries ao Supabase.

---

### `js/core/realtime.js` — 240 linhas
**Conexão WebSocket para sincronização em tempo real entre jogadores.**

Funções principais:
- `iniciarRealtime(rpgId)` — abre canal WebSocket da campanha
- `fecharRealtime()` — encerra a conexão e limpa listeners
- Handlers de presença, chat, movimentação de tokens, batalha

**Edite aqui quando:** precisar adicionar um novo evento em tempo real (ex: sincronizar novo tipo de dado entre jogadores) ou mudar o comportamento de reconexão.

---

### `js/core/events.js` — 50 linhas
**Helpers de permissão e utilitários para processamento de eventos.**

Funções:
- `temPermissao(acao)` — verifica se o usuário pode executar uma ação
- `podeEditarPersonagem(nome)` — verifica se pode editar um personagem específico
- `_estadoBatalhaJogador()` — retorna estado atual da batalha do jogador

> Nota: O event bus `HUB_EVENTS` em si fica em `config.js`.

**Edite aqui quando:** precisar mudar regras de permissão ou adicionar utilitários de verificação de estado.

---

### `js/core/utils.js` — 64 linhas
**Utilitários de animação e configuração visual de ícones.**

Funções:
- `injectCustomCSS(css)` — injeta CSS personalizado no documento
- `processCustomSVG(config)` — processa SVGs customizados
- `getCardIconSVG(tipo)` — retorna SVG de ícone de card
- `getLoadingAnimSVG()` — retorna SVG de animação de carregamento

**Edite aqui quando:** precisar alterar ícones customizáveis ou animações de loading.

---

### `js/auth/auth.js` — 482 linhas
**Sistema completo de autenticação.**

Funções principais:
- `authTab(aba)` — alterna entre abas Login / Registro
- `fazerLogin()` — autentica com e-mail e senha
- `registrar()` — cria nova conta com hCaptcha
- `recuperarSenha()` — envia e-mail de recuperação
- `refreshSession()` — renova token JWT automaticamente
- `logout()` — encerra sessão e limpa estado

**Edite aqui quando:** precisar mudar o fluxo de login, adicionar outro método de autenticação, ou alterar a tela de registro.

---

### `js/chat/chat.js` — 324 linhas
**Chat em tempo real entre jogadores da campanha.**

Contém o objeto `CHAT` e funções:
- Envio e recebimento de mensagens via Supabase Broadcast
- Persistência do histórico de mensagens
- Renderização do chat na tela
- Controle de presença online e badge de mensagens não lidas

**Edite aqui quando:** precisar mudar como o chat funciona, adicionar tipos de mensagem, ou alterar a exibição de usuários online.

---

### `js/characters/characters.js` — 567 linhas
**Exibição e gerenciamento de fichas de personagem.**

Funções principais:
- `renderCharButtons()` — renderiza botões de seleção de personagens
- `renderCharView(nome)` — exibe ficha completa do personagem
- `abrirModalLevelUp(nome)` — modal de level up
- `renderAttrView(nome)` — renderiza painel de atributos
- Controle de XP, HP, atributos derivados

**Edite aqui quando:** precisar alterar a exibição da ficha de personagem, adicionar campos, mudar o sistema de XP/level, ou modificar como atributos são calculados.

---

### `js/characters/skills.js` — 627 linhas
**Sistema de habilidades (skills) e suas fórmulas.**

Contém:
- `abrirModalSkill(nome, idx)` — abre modal de criação/edição de habilidade
- `SK_FB` — builder visual de fórmulas de habilidade
- `abrirModalLore(idx)` — modal de entrada de lore (duplicado funcional com `systems/lore.js`)
- `abrirModalNovoMapa()` — modal de criação de mapa

**Edite aqui quando:** precisar alterar como habilidades são criadas, editar o builder de fórmulas, ou modificar o sistema de cooldown e efeitos de skills.

---

### `js/combat/combat.js` — 2.721 linhas
**Sistema central de combate — o maior módulo do jogo.**

Contém:
- `parsearFormulaDano(formula)` — parser de fórmulas de dano (`2d6+1d8+3`)
- `rolarFormula(formula)` — executa rolagem e retorna resultado
- Sistema de iniciativa e ordem de turnos
- Modais de ataque (`atkModal*`)
- `COMBATE` — objeto de estado da batalha atual
- Aplicação de dano, cura, efeitos e condições
- Resolução de críticos e falhas críticas

**Edite aqui quando:** precisar alterar mecânicas de combate, parser de dados, sistema de iniciativa, ou como dano/cura é calculado e aplicado.

---

### `js/combat/animations.js` — 284 linhas
**Animações visuais de combate no Canvas 2D.**

Funções:
- `combateBroadcast(dados)` — transmite evento de combate via Realtime
- `animBroadcast(dados)` — transmite animação para outros jogadores
- `runAttackAnim(config)` — executa animação de ataque no canvas
- `_animExec(frame)` — loop interno de animação

**Edite aqui quando:** precisar adicionar novos efeitos visuais de combate ou mudar como ataques são animados na tela.

---

### `js/maps/camera.js` — 394 linhas
**Efeitos visuais do mapa e inicialização dos tokens.**

Contém (Fase 7 do sistema visual):
- `_injetarCssEfeitos()` — injeta CSS de efeitos (pulso, brilho, sombra)
- `zonasPulso()` — animação de zonas de efeito no mapa
- `tokenMorto(nome)` — aplica visual de token morto
- Inicialização de efeitos de estado nos tokens

**Edite aqui quando:** precisar alterar efeitos visuais dos tokens no mapa (brilhos, pulsos, indicadores de estado).

---

### `js/maps/maps.js` — 8.976 linhas
**Sistema principal de mapas — editor, tokens e batalha.**

Contém:
- Renderização de mapas táticos e mapas de mundo
- Editor de mapas com ferramentas Canvas (desenho livre, grid)
- Sistema de tokens: posicionamento, movimento, sincronização
- Fog of war (névoa de guerra)
- Controles de zoom e pan do mapa
- Modo de batalha no mapa
- Sincronização de tokens via Realtime

**Edite aqui quando:** precisar alterar o editor de mapas, comportamento de tokens, sistema de fog of war, ferramentas de desenho, ou movimento de personagens no mapa.

---

### `js/systems/inventory.js` — 2.190 linhas
**Sistema de inventário e equipamentos.**

Contém:
- `INV` — objeto de estado do inventário ativo
- `renderInventarioChar(nome)` — renderiza inventário do personagem
- Modais de item: criação, edição, uso, descarte
- Slots de equipamento (cabeça, torso, arma, etc.)
- Itens consumíveis com empilhamento
- Cálculo de bônus de equipamento
- `CRIAR_STATE` — wizard de criação de campanha

**Edite aqui quando:** precisar alterar o sistema de inventário, adicionar tipos de item, mudar slots de equipamento, ou modificar o wizard de criação de campanha.

---

### `js/systems/lore.js` — 416 linhas
**Sistema de lore e narrativa da campanha.**

Funções:
- `renderLore()` — renderiza lista de entradas de lore
- `filtrarLore(termo)` — busca no lore por texto
- `abrirModalLore(idx)` — abre modal de criação/edição
- `salvarLore(dados)` — persiste entrada no banco
- `removerLore(idx)` — remove entrada de lore

**Edite aqui quando:** precisar alterar como o lore é exibido, filtrado ou editado.

---

### `js/systems/npcs.js` — 176 linhas
**Geração e posicionamento de NPCs genéricos.**

Funções:
- `abrirModalNpcGenerico()` — abre modal de criação de NPC rápido
- `criarNpcGenerico(dados)` — cria e posiciona NPC no mapa
- `PLACEMENT_STATE` — estado do fluxo de posicionamento

**Edite aqui quando:** precisar alterar como NPCs são criados rapidamente ou como são colocados no mapa.

---

### `js/systems/creative.js` — 1.108 linhas
**Ações criativas dos jogadores e tutorial.**

Contém:
- `TUTORIAL_STEPS` — passos do tutorial de boas-vindas
- `tutorialMostrar(passo)` — exibe passo do tutorial
- Modais de ataque criativo na arena
- CRUD de cenários da arena
- Fluxo de aprovação de ações criativas pelo mestre

**Edite aqui quando:** precisar alterar o tutorial, o sistema de ações criativas, ou o gerenciamento de cenários.

---

### `js/systems/catalog.js` — 8.693 linhas
**Aparência de personagens, mapeamento de atributos e catálogo de itens.**

Contém:
- `nmBgTab()` — alternância de abas de fundo do mapa
- Editor canvas para customização visual
- `APMOD` — sistema completo de aparência (partes, templates, cores)
- Mapeamento A1/A2 de atributos customizados
- `I1` — CRUD completo do catálogo de itens por campanha
- Mercado NPC e marketplace de equipamentos
- Partes 2 e 3 do sistema de inventário

**Edite aqui quando:** precisar alterar o sistema de aparência de personagens, customização visual, o catálogo de itens da campanha, ou o marketplace.

---

### `js/systems/arena.js` — 3.720 linhas
**Modo Arena — PvP e PvE.**

Contém:
- `AR` — objeto de estado completo da arena
- `arTab(aba)` — navegação entre abas da arena
- `carregarArenaList()` — lista arenas disponíveis
- Sistema de combate específico da arena
- Gerenciamento de iniciativas na arena
- Arena Hub (tela de entrada) e sessão ativa

**Edite aqui quando:** precisar alterar mecânicas do modo arena, criar novos tipos de sessão, ou modificar como o combate PvP funciona.

---

### `js/hub/hub.js` — 607 linhas
**Hub principal — lista de campanhas e entrada no jogo.**

Funções principais:
- `renderRPGList()` — renderiza cards das campanhas do usuário
- `mesaModoVerificar()` — verifica/ativa modo mesa (3 colunas)
- `iniciarApp(rpgId)` — carrega campanha e entra no jogo
- `voltarHub()` — retorna à tela do hub

**Edite aqui quando:** precisar alterar a tela de listagem de campanhas, o fluxo de entrada em uma campanha, ou o layout da mesa.

---

### `js/hub/import.js` — 2.676 linhas
**Importação de campanhas e geração assistida por IA.**

Contém:
- `abrirImport()` — abre tela de importação
- `importRPGJSON(json)` — importa campanha a partir de JSON
- Geração de mapas por IA (prompts e processamento)
- `abrirAba(id)` — controle de abas da aplicação
- `mostrarToast(msg, tipo)` — notificações toast globais

**Edite aqui quando:** precisar alterar o sistema de importação de campanhas, a geração por IA, ou as funções de navegação entre abas e notificações.

---

### `js/ui/modals.js` — 3.124 linhas
**Mercado secreto, painel de sessão e sistema de paredes.**

Contém:
- `mercadoSelecionarTipo(tipo)` — seleção no mercado secreto
- `mostrarInformacaoAdquirida(item)` — exibe item obtido
- `WALLS_STATE` — estado do editor de paredes/obstáculos
- `paredeBloqueiaMovimento(de, para)` — verifica colisão com parede

**Edite aqui quando:** precisar alterar o mercado secreto, o painel de sessão do mestre, ou a lógica de colisão do sistema de paredes.

---

### `js/ui/tabs.js` — 1.361 linhas
**Editor de cena: paredes, portas, chaves, baús e obstáculos.**

Contém:
- `CENARIO_STATE`, `CENA_ED` — estado do editor de cena
- `abrirEditorCena(mapaId)` — abre editor visual de cena
- Gerenciamento de paredes e portas (criação, edição, remoção)
- Sistema de chaves e baús (interação, travamento)
- Posicionamento de obstáculos no mapa

**Edite aqui quando:** precisar alterar o editor de cenários, o sistema de portas/chaves, ou como obstáculos são adicionados ao mapa.

---

### `js/init.js` — 5 linhas
**Sinal de inicialização — carregado por último.**

Indica ao sistema que todos os módulos foram carregados com sucesso.

---

## Referência rápida: "O que devo abrir?"

| Quero alterar... | Arquivo(s) |
|---|---|
| Credenciais do Supabase | `js/config.js` |
| Nova variável de estado global | `js/state.js` |
| Como dados são lidos/salvos no banco | `js/core/supabase.js` |
| Novo evento em tempo real entre jogadores | `js/core/realtime.js` |
| Regras de permissão (mestre/jogador) | `js/core/events.js` |
| Tela de login ou registro | `js/auth/auth.js` |
| Chat entre jogadores | `js/chat/chat.js` |
| Ficha de personagem | `js/characters/characters.js` |
| Habilidades e seus efeitos | `js/characters/skills.js` |
| Mecânicas de combate, dados, dano | `js/combat/combat.js` |
| Animações visuais de ataque | `js/combat/animations.js` |
| Editor de mapas, tokens, fog of war | `js/maps/maps.js` |
| Efeitos visuais nos tokens (brilho, pulso) | `js/maps/camera.js` |
| Inventário e equipamentos | `js/systems/inventory.js` |
| Lore e narrativa da campanha | `js/systems/lore.js` |
| Geração de NPCs rápidos | `js/systems/npcs.js` |
| Ações criativas dos jogadores | `js/systems/creative.js` |
| Aparência de personagem, catálogo de itens | `js/systems/catalog.js` |
| Modo Arena (PvP/PvE) | `js/systems/arena.js` |
| Hub de campanhas, entrada no jogo | `js/hub/hub.js` |
| Importação de campanhas, geração por IA | `js/hub/import.js` |
| Mercado secreto, sistema de paredes | `js/ui/modals.js` |
| Editor de cena (portas, baús, obstáculos) | `js/ui/tabs.js` |

---

## Ordem de carregamento no `index.html`

Os arquivos são carregados em ordem de dependência. Não altere essa ordem sem motivo:

```html
<script src="js/config.js"></script>       <!-- 1. Constantes e event bus -->
<script src="js/state.js"></script>         <!-- 2. Estado global -->
<script src="js/core/utils.js"></script>    <!-- 3. Utilitários base -->
<script src="js/core/supabase.js"></script> <!-- 4. API do banco -->
<script src="js/core/realtime.js"></script> <!-- 5. WebSocket -->
<script src="js/core/events.js"></script>   <!-- 6. Helpers de permissão -->
<script src="js/chat/chat.js"></script>     <!-- 7. Chat -->
<script src="js/combat/combat.js"></script> <!-- 8. Combate -->
<script src="js/combat/animations.js"></script>
<script src="js/maps/camera.js"></script>   <!-- 9. Mapa -->
<script src="js/maps/maps.js"></script>
<script src="js/auth/auth.js"></script>     <!-- 10. Autenticação -->
<script src="js/hub/hub.js"></script>       <!-- 11. Hub -->
<script src="js/systems/lore.js"></script>  <!-- 12. Sistemas -->
<script src="js/characters/characters.js"></script>
<script src="js/characters/skills.js"></script>
<script src="js/systems/npcs.js"></script>
<script src="js/hub/import.js"></script>
<script src="js/systems/arena.js"></script>
<script src="js/systems/inventory.js"></script>
<script src="js/systems/creative.js"></script>
<script src="js/systems/catalog.js"></script>
<script src="js/ui/modals.js"></script>     <!-- 13. UI -->
<script src="js/ui/tabs.js"></script>
<script src="js/init.js"></script>          <!-- 14. Inicialização -->
```

---

## Arquitetura geral

- **Tecnologia:** JavaScript vanilla (ES6+), sem framework, sem bundler
- **Backend:** Supabase (PostgreSQL + Auth + Realtime WebSocket + Storage)
- **Estado:** variáveis globais declaradas em `state.js`, acessíveis em todos os módulos
- **Comunicação entre módulos:** via `HUB_EVENTS` (pub/sub) e variáveis globais compartilhadas
- **Sem build step:** edite o arquivo, salve, recarregue o browser — pronto
