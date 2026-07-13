# Guia de Configuração e Deploy

## Pré-requisitos

- Conta no [Supabase](https://supabase.com) (plano gratuito é suficiente)
- Conta no [hCaptcha](https://www.hcaptcha.com) (plano gratuito)
- Servidor HTTP estático para servir os arquivos (Nginx, Apache, Vercel, Netlify, GitHub Pages, etc.)

---

## 1. Configurar o Supabase

### 1.1 Criar projeto

1. Acesse [app.supabase.com](https://app.supabase.com) e crie um novo projeto
2. Escolha a região mais próxima dos seus usuários
3. Anote a **URL do projeto** e a **chave anon** em:
   - `Settings → API → Project URL`
   - `Settings → API → Project API Keys → anon public`

### 1.2 Criar tabelas

Execute os seguintes SQLs no **SQL Editor** do Supabase (`SQL Editor → New Query`):

```sql
-- Campanhas (registry)
CREATE TABLE rpg_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  theme_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dados gerais da campanha (characters, skills, lore, mapas, etc.)
CREATE TABLE rpg_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rpg_id UUID REFERENCES rpg_registry(id) ON DELETE CASCADE,
  section TEXT NOT NULL,    -- 'characters', 'skills', 'lore', 'mapas', etc.
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Membros da campanha
CREATE TABLE rpg_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rpg_id UUID REFERENCES rpg_registry(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'jogador',   -- 'mestre', 'jogador', 'espectador'
  char_nome TEXT,
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batalhas ativas
CREATE TABLE batalhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rpg_id UUID REFERENCES rpg_registry(id) ON DELETE CASCADE,
  mapa_id TEXT,
  estado JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.3 Configurar Row Level Security (RLS)

Habilite RLS em todas as tabelas e crie políticas de acesso. Exemplo básico:

```sql
-- Habilitar RLS
ALTER TABLE rpg_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpg_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpg_members ENABLE ROW LEVEL SECURITY;

-- Donos podem ver e modificar suas campanhas
CREATE POLICY "owners_full_access" ON rpg_registry
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Membros podem ler dados da campanha
CREATE POLICY "members_read" ON rpg_data
  USING (
    rpg_id IN (
      SELECT rpg_id FROM rpg_members WHERE user_id = auth.uid()
    )
  );
```

### 1.4 Configurar Supabase Auth

1. Em `Authentication → Settings`:
   - Habilite **Email** como provider
   - Configure **Confirm email** conforme preferir
   - Defina **Site URL** para o domínio de produção

2. Se usar confirmação de e-mail via Resend:
   - Configure o DNS e as credenciais SMTP em `Authentication → SMTP Settings`
   - Após propagação do DNS, defina `EMAIL_CONFIRMATION_ENABLED = true` no `js/app.js`

### 1.5 Configurar Supabase Realtime

Em `Database → Replication`, adicione as tabelas que devem ter eventos em tempo real:
- `rpg_registry`
- `rpg_data`
- `batalhas`

---

## 2. Configurar hCaptcha

1. Acesse [dashboard.hcaptcha.com](https://dashboard.hcaptcha.com)
2. Crie um novo site e anote a **Site Key**
3. Configure o domínio onde o app será hospedado

---

## 3. Configurar o Código

Abra `js/app.js` e preencha as variáveis no início do arquivo:

```javascript
// ============================================================
// ⚠️  CONFIGURE SUAS CREDENCIAIS SUPABASE AQUI
// ============================================================
const SUPABASE_URL = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_KEY = 'SUA_CHAVE_ANON';
const HCAPTCHA_SITEKEY = 'SUA_SITE_KEY_HCAPTCHA';

// Defina como true após configurar o DNS do e-mail
const EMAIL_CONFIRMATION_ENABLED = false;
```

---

## 4. Deploy

O RPG Hub é um app **puramente estático** — não precisa de servidor de aplicação. Basta hospedar os arquivos em qualquer servidor HTTP.

### Estrutura de arquivos para deploy

```
/
├── index.html
├── manifest.json
├── sw.js
├── css/
│   └── styles.css
├── js/
│   └── app.js
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

### Opção A: Vercel / Netlify

1. Crie um repositório Git com os arquivos
2. Conecte ao Vercel ou Netlify
3. Defina o diretório raiz como `/` (sem build step)
4. O deploy acontece automaticamente a cada push

### Opção B: GitHub Pages

1. Suba os arquivos para um repositório público (ou privado com Pages habilitado)
2. Em `Settings → Pages`, selecione a branch e pasta root `/`
3. Acesse via `https://seu-usuario.github.io/seu-repo`

### Opção C: Nginx

```nginx
server {
    listen 80;
    server_name seu-dominio.com;
    root /var/www/rpg-hub;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache para assets estáticos
    location ~* \.(css|js|png|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Opção D: Desenvolvimento local

Para testar localmente (necessário servidor HTTP — não funciona via `file://`):

```bash
# Python
python3 -m http.server 8080

# Node.js (npx)
npx serve .

# PHP
php -S localhost:8080
```

Acesse `http://localhost:8080`

---

## 5. Configurar PWA (Opcional)

Para que o app seja instalável como PWA, é necessário:

1. **HTTPS** — obrigatório para Service Worker (Vercel, Netlify, GitHub Pages já incluem)
2. **manifest.json** — já configurado
3. **sw.js** — já configurado (Service Worker minimalista)

Após deploy em HTTPS, o navegador exibirá automaticamente o botão "Instalar app".

---

## 6. Variáveis de Configuração Adicionais

Dentro de `js/app.js`, outras constantes que podem ser ajustadas:

| Constante | Padrão | Descrição |
|---|---|---|
| `TIPOS_DADO` | Array | Configuração padrão dos tipos de dados (d4–d100) |
| `MAX_CHARS_CHAT` | `1000` | Limite de caracteres no histórico de chat salvo |
| `CHAT_SAVE_INTERVAL` | `30000` | Intervalo em ms para salvar chat no banco |

---

## Solução de Problemas

### App não carrega / tela em branco
- Abra o Console do navegador (F12) e verifique erros
- Confirme que `SUPABASE_URL` e `SUPABASE_KEY` estão corretos em `js/app.js`
- Verifique se todos os arquivos estão sendo servidos (css/, js/, icons/)

### Erro de CORS
- Verifique se o domínio está na lista de `Allowed Origins` no Supabase (`Settings → API`)

### hCaptcha não aparece
- Confirme que a `HCAPTCHA_SITEKEY` está correta
- Verifique se o domínio está cadastrado no dashboard do hCaptcha

### Chat / Realtime não funciona
- Confirme que o Supabase Realtime está habilitado para as tabelas
- Verifique se a conexão WebSocket não está sendo bloqueada por firewall/proxy

### PWA não instala
- Certifique-se de que o app está em HTTPS
- Verifique o manifest.json com `Application → Manifest` no Chrome DevTools
- Garanta que o `sw.js` está sendo servido com Content-Type correto (`application/javascript`)

## TURN server (opcional — melhora conexão P2P do Modo Aventura)

O Modo Aventura usa WebRTC P2P entre os jogadores, com STUN público do Google.
Jogadores atrás de NAT simétrico/CGNAT não conseguem abrir DataChannel direto e
caem silenciosamente para o fallback Supabase (latência maior). Um servidor TURN
resolve esses casos.

1. Instale um TURN (ex.: [coturn](https://github.com/coturn/coturn)) num VPS:
   ```bash
   sudo apt install coturn
   # /etc/turnserver.conf (mínimo):
   #   listening-port=3478
   #   fingerprint
   #   lt-cred-mech
   #   user=rpghub:SENHA_FORTE
   #   realm=seu-dominio.com
   sudo systemctl enable --now coturn
   ```
2. Configure as variáveis de build (Vite) num arquivo `.env` na raiz:
   ```
   VITE_TURN_URL=turn:seu-dominio.com:3478
   VITE_TURN_USER=rpghub
   VITE_TURN_PASS=SENHA_FORTE
   ```
3. `npm run build` — o cliente anexa o TURN ao `iceServers` automaticamente
   (js/core/rtnet.ts). Sem as variáveis, o comportamento continua STUN-only.

Diagnóstico: ative o overlay de desempenho (`?perf=1` ou menu ⚙ Gráficos →
"Medidor de desempenho") — ele mostra o modo de rede (P2P/mixed/fallback), o RTT
ao host e quantos peers estão em fallback WebSocket.

No jogo, o indicador de transporte ao lado do nome da sala resume o estado:
🟢 P2P completo, 🟡 P2P parcial e 🔴 fallback Supabase — quando 🟡/🔴 persistem
com jogadores conectados, é o sintoma clássico de NAT restrito que o TURN acima
resolve (o cliente também mostra um aviso único por sessão nesse caso).
