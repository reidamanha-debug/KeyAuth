// commands.js
// Apenas a definicao dos comandos slash (sem tocar no banco).
// Separado do bot.js para que "register-commands.js" nao precise carregar o
// better-sqlite3 (evita um crash nativo conhecido do better-sqlite3 no Windows
// na hora do processo terminar).

const { SlashCommandBuilder } = require('discord.js');

function buildCommands() {
  return [
    new SlashCommandBuilder()
      .setName('genkey')
      .setDescription('Gera uma nova chave de licenca')
      .addIntegerOption((o) => o.setName('dias').setDescription('Validade em dias').setRequired(true))
      .addIntegerOption((o) => o.setName('dispositivos').setDescription('Max. de HWIDs permitidos').setRequired(false))
      .addStringOption((o) => o.setName('nota').setDescription('Observacao interna').setRequired(false)),

    new SlashCommandBuilder()
      .setName('revokekey')
      .setDescription('Revoga uma chave de licenca (nao podera mais ser resgatada)')
      .addStringOption((o) => o.setName('chave').setDescription('A chave de licenca').setRequired(true)),

    new SlashCommandBuilder()
      .setName('resethwid')
      .setDescription('Remove todos os dispositivos vinculados a um usuario')
      .addStringOption((o) => o.setName('usuario').setDescription('Nome de usuario').setRequired(true)),

    new SlashCommandBuilder()
      .setName('banuser')
      .setDescription('Bane ou desbane um usuario')
      .addStringOption((o) => o.setName('usuario').setDescription('Nome de usuario').setRequired(true))
      .addBooleanOption((o) => o.setName('banir').setDescription('true = banir, false = desbanir').setRequired(true)),

    new SlashCommandBuilder()
      .setName('userinfo')
      .setDescription('Mostra informacoes de um usuario')
      .addStringOption((o) => o.setName('usuario').setDescription('Nome de usuario').setRequired(true)),
  ].map((c) => c.toJSON());
}

module.exports = { buildCommands };
