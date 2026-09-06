// index.js
require('dotenv').config();
const createApi = require('./api');
const createBot = require('./bot');
const { init } = require('./db');

if (!process.env.JWT_SECRET || !process.env.DISCORD_TOKEN || !process.env.DATABASE_URL) {
  console.error('Configure o arquivo .env (copie .env.example para .env e preencha, incluindo DATABASE_URL).');
  process.exit(1);
}

(async () => {
  await init(); // garante que as tabelas existem no Postgres/Supabase

  const app = createApi();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`API rodando na porta ${port}`));

  const { client } = createBot();
  client.once('ready', () => console.log(`Bot conectado como ${client.user.tag}`));
  client.login(process.env.DISCORD_TOKEN);
})();
