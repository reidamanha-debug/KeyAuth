// api.js
// Rotas HTTP que o cliente C++ vai chamar: /register, /login, /validate
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');
const { nowPlusDays, isExpired } = require('./utils');

const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_HOURS = Number(process.env.SESSION_HOURS || 12);

function createApi() {
  const app = express();
  app.use(helmet());
  app.use(express.json());

  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(['/api/register', '/api/login'], authLimiter);

  // POST /api/register { license_key, username, password, hwid }
  app.post('/api/register', async (req, res) => {
    const { license_key, username, password, hwid } = req.body || {};
    if (!license_key || !username || !password || !hwid) {
      return res.status(400).json({ ok: false, error: 'campos_faltando' });
    }
    if (String(password).length < 4) {
      return res.status(400).json({ ok: false, error: 'senha_muito_curta' });
    }

    const { rows: licenseRows } = await pool.query('SELECT * FROM licenses WHERE license_key = $1', [license_key]);
    const license = licenseRows[0];
    if (!license) return res.status(404).json({ ok: false, error: 'chave_invalida' });
    if (license.revoked) return res.status(403).json({ ok: false, error: 'chave_revogada' });
    if (license.redeemed) return res.status(409).json({ ok: false, error: 'chave_ja_usada' });

    const { rows: existingRows } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingRows[0]) return res.status(409).json({ ok: false, error: 'usuario_ja_existe' });

    const passwordHash = await bcrypt.hash(String(password), 12);
    const expiresAt = nowPlusDays(license.duration_days);

    const { rows: userRows } = await pool.query(
      `INSERT INTO users (username, password_hash, license_key, hwid, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [username, passwordHash, license_key, hwid, expiresAt]
    );
    const userId = userRows[0].id;

    await pool.query('INSERT INTO devices (user_id, hwid) VALUES ($1, $2)', [userId, hwid]);
    await pool.query('UPDATE licenses SET redeemed = 1 WHERE id = $1', [license.id]);

    return res.json({ ok: true, message: 'conta_criada', expires_at: expiresAt });
  });

  // POST /api/login { username, password, hwid }
  app.post('/api/login', async (req, res) => {
    const { username, password, hwid } = req.body || {};
    if (!username || !password || !hwid) {
      return res.status(400).json({ ok: false, error: 'campos_faltando' });
    }

    const { rows: userRows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = userRows[0];
    if (!user) return res.status(401).json({ ok: false, error: 'credenciais_invalidas' });
    if (user.banned) return res.status(403).json({ ok: false, error: 'usuario_banido' });

    const validPassword = await bcrypt.compare(String(password), user.password_hash);
    if (!validPassword) return res.status(401).json({ ok: false, error: 'credenciais_invalidas' });

    if (isExpired(user.expires_at)) {
      return res.status(403).json({ ok: false, error: 'licenca_expirada' });
    }

    const { rows: licenseRows } = await pool.query('SELECT * FROM licenses WHERE license_key = $1', [user.license_key]);
    const license = licenseRows[0];

    const { rows: knownDeviceRows } = await pool.query(
      'SELECT id FROM devices WHERE user_id = $1 AND hwid = $2',
      [user.id, hwid]
    );

    if (!knownDeviceRows[0]) {
      const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS c FROM devices WHERE user_id = $1', [user.id]);
      const deviceCount = countRows[0].c;
      const maxDevices = license ? license.max_devices : 1;
      if (deviceCount >= maxDevices) {
        return res.status(403).json({ ok: false, error: 'limite_de_dispositivos_atingido' });
      }
      await pool.query('INSERT INTO devices (user_id, hwid) VALUES ($1, $2)', [user.id, hwid]);
    }

    const token = jwt.sign(
      { sub: user.id, username: user.username, hwid },
      JWT_SECRET,
      { expiresIn: `${SESSION_HOURS}h` }
    );

    return res.json({ ok: true, token, expires_at: user.expires_at });
  });

  // POST /api/validate { token, hwid }
  app.post('/api/validate', async (req, res) => {
    const { token, hwid } = req.body || {};
    if (!token || !hwid) return res.status(400).json({ ok: false, error: 'campos_faltando' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ ok: false, error: 'token_invalido' });
    }

    if (payload.hwid !== hwid) {
      return res.status(403).json({ ok: false, error: 'hwid_nao_confere' });
    }

    const { rows: userRows } = await pool.query('SELECT * FROM users WHERE id = $1', [payload.sub]);
    const user = userRows[0];
    if (!user || user.banned) return res.status(403).json({ ok: false, error: 'usuario_invalido' });
    if (isExpired(user.expires_at)) return res.status(403).json({ ok: false, error: 'licenca_expirada' });

    return res.json({ ok: true, username: user.username, expires_at: user.expires_at });
  });

  return app;
}

module.exports = createApi;
