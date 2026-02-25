# ⚔ RPG Hub

**Plataforma web colaborativa para gerenciamento de campanhas de RPG de mesa.**

RPG Hub é um Progressive Web App (PWA) que permite a mestres e jogadores gerenciar campanhas completas de RPG em tempo real: fichas de personagem, inventário, batalhas, mapas, chat e muito mais — tudo diretamente no navegador, sem instalação.

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Configuração e Instalação](#configuração-e-instalação)
- [Arquitetura](#arquitetura)
- [Tecnologias](#tecnologias)
- [Documentação Técnica](#documentação-técnica)

---

## Funcionalidades

| Módulo | Descrição |
|---|---|
| **Autenticação** | Login/cadastro com e-mail, senha e validação hCaptcha |
| **Hub de Campanhas** | Listagem, criação e importação de campanhas |
| **Ficha de Personagem** | Atributos, habilidades, status e vinculação |
| **Inventário** | Slots de equipamento, consumíveis e efeitos |
| **Sistema de Batalha** | Iniciativa, turnos, ataques, dano e histórico |
| **Mapa de Batalha** | Editor de mapas SVG/Canvas com tokens e zoom |
| **Dados** | Rolagem de d4–d100 com animações e histórico |
| **Lore** | Criação e gerenciamento de lore da campanha |
| **Chat em Tempo Real** | Mensagens ao vivo com presença de jogadores |
| **NPCs / Entidades** | Criação em massa, geração e vinculação a mapas |
| **Ações Criativas** | Sistema de aprovação de ações especiais pelo mestre |
| **Arena** | Modo PvP/PvE dinâmico com Beyonders |
| **Catálogo / Mercado** | Banco de itens e NPCs por campanha |

---

## Estrutura do Projeto

```
RPG-Hub/
├── index.html          # Ponto de entrada (somente estrutura HTML)
├── manifest.json       # Manifesto PWA
├── sw.js               # Service Worker (instalabilidade PWA)
├── README.md           # Esta documentação
│
├── css/
│   └── styles.css      # Todos os estilos do app (725 linhas)
│
├── js/
│   └── app.js          # Toda a lógica do app (~25 mil linhas)
│
├── docs/
│   ├── architecture.md # Arquitetura e padrões adotados
│   ├── modules.md      # Documentação de módulos e funções
│   └── setup.md        # Guia de configuração e deploy
│
└── icons/
    ├── icon-192.png    # Ícone PWA 192×192
    └── icon-512.png    # Ícone PWA 512×512
```

---

## Configuração e Instalação

Veja o guia completo em [`docs/setup.md`](docs/setup.md).

**Resumo rápido:**

1. Clone o repositório
2. Configure as credenciais Supabase em `js/app.js` (variáveis no topo do arquivo)
3. Sirva os arquivos com qualquer servidor HTTP estático
4. Acesse `index.html` no navegador

---

## Arquitetura

Veja a documentação detalhada em [`docs/architecture.md`](docs/architecture.md).

RPG Hub é um **SPA (Single-Page Application)** com arquitetura **PWA**, usando:
- **Supabase** como backend (banco de dados, auth e WebSockets em tempo real)
- **Vanilla JavaScript** sem frameworks — sem etapa de build
- **CSS com variáveis customizadas** para theming consistente

---

## Tecnologias

| Tecnologia | Uso |
|---|---|
| [Supabase](https://supabase.com) | Backend, banco de dados PostgreSQL, Auth e Realtime |
| [hCaptcha](https://www.hcaptcha.com) | Verificação humana no cadastro |
| [Google Fonts](https://fonts.google.com) | Fontes Cinzel e Crimson Text |
| Vanilla JS (ES6+) | Toda a lógica do frontend, sem frameworks |
| CSS3 | Layout, animações e temas via variáveis |
| Canvas API | Editor de mapas e desenho livre |
| SVG | Renderização de mapas e ícones de dados |
| Service Worker | Instalabilidade como PWA |

---

## Documentação Técnica

- [`docs/architecture.md`](docs/architecture.md) — Visão geral da arquitetura, fluxos e padrões
- [`docs/modules.md`](docs/modules.md) — Módulos, funções principais e estado global
- [`docs/setup.md`](docs/setup.md) — Configuração do Supabase, variáveis de ambiente e deploy

---

## Licença

Projeto privado. Todos os direitos reservados.
