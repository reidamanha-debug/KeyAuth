# KeyAuth

Sistema de licença próprio, no estilo keyauth.cc. Duas partes:

- **`server/`** — bot de Discord (Node.js + discord.js) e API REST (Express) que gerenciam
  chaves de licenca, contas de usuario, HWID e sessoes. Compartilham o mesmo banco SQLite.
- **`cpp-client/`** — biblioteca C++ que o seu programa usa para resgatar a chave, logar e
  validar a sessao periodicamente.

## Fluxo

1. Admin gera uma chave no Discord: `/genkey dias:30 dispositivos:1`
2. Usuario final abre seu programa C++ pela primeira vez, informa a chave e cria
   usuario+senha (`AuthClient::Register`). O servidor amarra a chave a essa conta e ao HWID.
3. Nas proximas vezes, o programa faz `AuthClient::Login(usuario, senha)` e recebe um token.
4. O programa chama `AuthClient::Validate(token)` periodicamente para confirmar que a
   sessao continua valida (nao expirou, nao foi banida, HWID confere).

## Banco de dados (Supabase)

1. Crie um projeto em https://supabase.com (gratuito).
2. No painel do projeto: **Settings → Database → Connection string → URI**. Copie a string
   (algo como `postgresql://postgres:SUA_SENHA@db.xxxxxxxxxxxx.supabase.co:5432/postgres`).
3. Cole essa string em `DATABASE_URL` no seu `.env`.
4. Não precisa criar as tabelas manualmente — o servidor cria automaticamente na primeira
   vez que sobe (`init()` em `db.js`).

Se for hospedar em algo como Render com poucos processos, a porta `5432` (conexão direta)
já é suficiente. Se um dia escalar para vários processos/instâncias, troque pela string do
**connection pooler** do Supabase (porta `6543`) para não estourar o limite de conexões.

## Subindo o servidor

```bash
cd server
npm install
cp .env.example .env
# edite o .env: DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID, ADMIN_ROLE_IDS, JWT_SECRET, DATABASE_URL
npm run register-commands   # registra os comandos slash uma vez
npm start                   # sobe o bot + a API na porta definida em .env
```

Para hospedar de verdade (Render, VPS, etc.), lembre de:
- Colocar a API atras de **HTTPS** (nunca em http puro para usuarios reais).
- Trocar `JWT_SECRET` por uma string longa e aleatoria.
- Restringir `ADMIN_ROLE_IDS` ao cargo certo no seu servidor.
- Com o banco no Supabase, você **não precisa** de disco persistente na hospedagem
  (Render, etc.) — os dados já ficam salvos no Postgres do Supabase entre deploys.

## Comandos do bot (exigem o cargo em `ADMIN_ROLE_IDS`)

| Comando | O que faz |
|---|---|
| `/genkey dias dispositivos nota` | Gera uma chave nova |
| `/revokekey chave` | Revoga uma chave (nao pode mais ser resgatada) |
| `/resethwid usuario` | Libera o usuario para logar em outro PC |
| `/banuser usuario banir` | Bane/desbane uma conta |
| `/userinfo usuario` | Mostra detalhes da conta |

## Compilando o cliente C++

Precisa de **libcurl** instalado (`apt install libcurl4-openssl-dev` no Linux,
ou vcpkg/Conan no Windows).

```bash
cd cpp-client
g++ -std=c++17 main_example.cpp AuthClient.cpp -lcurl -o auth_example
./auth_example
```

No Windows (MSVC/MinGW), linke contra `libcurl` e, para o `AuthClient.cpp`, contra `advapi32`
(ja usado implicitamente pelas funções do Windows chamadas em `GetHWID`).

## Sobre seguranca

- Senhas ficam com hash `bcrypt` (nunca em texto puro).
- Sessao usa JWT assinado, amarrado ao HWID que fez o login.
- O `AuthClient.h` inclui um parser de JSON bem simples (regex), suficiente para as
  respostas planas desta API — se voce expandir as respostas com objetos aninhados,
  troque por uma lib de JSON de verdade (ex: nlohmann/json).
- **Isso e uma trava de licenca (identifica maquina + gerencia contas), nao é
  proteção anti-cheat/anti-debug.** Um usuario com engenharia reversa consegue
  contornar qualquer trava client-side dada tempo suficiente — o objetivo aqui e
  dificultar o compartilhamento casual de contas/chaves, nao impedir um atacante
  determinado.
