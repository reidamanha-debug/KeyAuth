// utils.js
const crypto = require('crypto');

// Gera uma chave de licenca no formato XXXX-XXXX-XXXX-XXXX
function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem caracteres ambiguos (0/O, 1/I)
  const groups = [];
  for (let g = 0; g < 4; g++) {
    let group = '';
    for (let i = 0; i < 4; i++) {
      group += chars[crypto.randomInt(0, chars.length)];
    }
    groups.push(group);
  }
  return groups.join('-');
}

function nowPlusDays(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toISOString();
}

function isExpired(isoDate) {
  return new Date(isoDate).getTime() < Date.now();
}

module.exports = { generateLicenseKey, nowPlusDays, isExpired };
