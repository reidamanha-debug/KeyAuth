// register-commands.js
// Rode "npm run register-commands" uma vez (ou sempre que mudar os comandos)
// Nao depende do banco de dados de proposito, so da lista de comandos.
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { buildCommands } = require('./commands');

const commands = buildCommands();
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registrando comandos slash...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: commands }
    );
    console.log('Comandos registrados com sucesso.');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
})();
