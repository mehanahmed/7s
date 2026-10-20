// Usage: node scripts/set-admin.js
// Creates/updates the SYSTEM_ADMIN user using SEED_ADMIN_PASSWORD from .env.
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const EMAIL = 'admin@sevensolution.dev';

(async () => {
  const pw = process.env.SEED_ADMIN_PASSWORD;
  if (!pw || pw.length < 12) throw new Error('Set SEED_ADMIN_PASSWORD (12+ chars) in .env first.');
  const db = await mysql.createConnection({
    host: process.env.DATABASE_HOST, user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME,
    port: Number(process.env.DATABASE_PORT) || 3306,
  });
  const hash = await bcrypt.hash(pw, 10);
  const [r] = await db.query('UPDATE users SET password = ?, role = ?, is_banned = 0 WHERE email = ?', [hash, 'SYSTEM_ADMIN', EMAIL]);
  if (r.affectedRows) console.log('Admin password updated.');
  else {
    const cols = (c) => `INSERT INTO users (id, name, email, password, ${c}, is_banned, is_leader) VALUES (?, ?, ?, ?, ?, 0, 0)`;
    const vals = [randomUUID(), 'Admin', EMAIL, hash, 'SYSTEM_ADMIN'];
    try { await db.query(cols('role'), vals); } catch (e) {
      if (e.code !== 'ER_BAD_FIELD_ERROR') throw e;
      await db.query(cols('role_id'), vals);
    }
    console.log('Admin created.');
  }
  await db.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
