// bot.js
// Bot do Discord: comandos de administrador para gerar/revogar chaves,
// resetar HWID, banir usuario, etc. Compartilha o mesmo banco que a API.

const { Client, GatewayIntentBits } = require('discord.js');
const { pool } = require('./db');
const { generateLicenseKey } = require('./utils');
const { buildCommands } = require('./commands');

const ADMIN_ROLE_IDS = (process.env.ADMIN_ROLE_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isAdmin(interaction) {
  if (ADMIN_ROLE_IDS.length === 0) return false;
  return interaction.member?.roles?.cache?.some((r) => ADMIN_ROLE_IDS.includes(r.id));
}

function createBot() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (!isAdmin(interaction)) {
      return interaction.reply({ content: 'Voce nao tem permissao para usar este comando.', ephemeral: true });
    }

    try {
      if (interaction.commandName === 'genkey') {
        const dias = interaction.options.getInteger('dias');
        const dispositivos = interaction.options.getInteger('dispositivos') ?? 1;
        const nota = interaction.options.getString('nota') ?? null;

        const key = generateLicenseKey();
        await pool.query(
          `INSERT INTO licenses (license_key, duration_days, max_devices, note, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [key, dias, dispositivos, nota, interaction.user.tag]
        );

        return interaction.reply({
          content: `Chave gerada: \`${key}\`\nValidade: ${dias} dias | Dispositivos: ${dispositivos}`,
          ephemeral: true,
        });
      }

      if (interaction.commandName === 'revokekey') {
        const chave = interaction.options.getString('chave');
        const result = await pool.query('UPDATE licenses SET revoked = 1 WHERE license_key = $1', [chave]);
        return interaction.reply({
          content: result.rowCount ? `Chave \`${chave}\` revogada.` : 'Chave nao encontrada.',
          ephemeral: true,
        });
      }

      if (interaction.commandName === 'resethwid') {
        const usuario = interaction.options.getString('usuario');
        const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [usuario]);
        const user = rows[0];
        if (!user) return interaction.reply({ content: 'Usuario nao encontrado.', ephemeral: true });
        await pool.query('DELETE FROM devices WHERE user_id = $1', [user.id]);
        return interaction.reply({ content: `HWID de \`${usuario}\` resetado.`, ephemeral: true });
      }

      if (interaction.commandName === 'banuser') {
        const usuario = interaction.options.getString('usuario');
        const banir = interaction.options.getBoolean('banir');
        const result = await pool.query('UPDATE users SET banned = $1 WHERE username = $2', [banir ? 1 : 0, usuario]);
        return interaction.reply({
          content: result.rowCount ? `Usuario \`${usuario}\` ${banir ? 'banido' : 'desbanido'}.` : 'Usuario nao encontrado.',
          ephemeral: true,
        });
      }

      if (interaction.commandName === 'userinfo') {
        const usuario = interaction.options.getString('usuario');
        const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [usuario]);
        const user = rows[0];
        if (!user) return interaction.reply({ content: 'Usuario nao encontrado.', ephemeral: true });
        const { rows: devices } = await pool.query('SELECT hwid FROM devices WHERE user_id = $1', [user.id]);
        return interaction.reply({
          content: [
            `Usuario: \`${user.username}\``,
            `Chave: \`${user.license_key}\``,
            `Expira em: ${user.expires_at}`,
            `Banido: ${user.banned ? 'sim' : 'nao'}`,
            `Dispositivos (${devices.length}): ${devices.map((d) => d.hwid).join(', ') || '-'}`,
          ].join('\n'),
          ephemeral: true,
        });
      }
    } catch (err) {
      console.error(err);
      if (!interaction.replied) {
        await interaction.reply({ content: 'Ocorreu um erro ao executar o comando.', ephemeral: true });
      }
    }
  });

  return { client };
}

module.exports = createBot;
