// Moves a database to the new default roles:
//   SYSTEM_ADMIN, ADMIN, CR, SW, CG, EDITOR, ARTIST
//   - CRM becomes CR (users.role, user_roles, status allowed_roles, stored settings JSON)
//   - DESIGNER_REPRESENTATIVE / LR / CO / VENDOR are removed from user_roles ONLY if no user still has them
//   - the new roles are inserted when missing
//
//   node scripts/migrate-roles.js           # dry run
//   node scripts/migrate-roles.js --apply   # write changes
require('dotenv').config();
const mysql = require('mysql2/promise');

const NEW_ROLES = [
  ['SYSTEM_ADMIN', 'SYSTEM ADMIN', '#dc2626'],
  ['ADMIN', 'ADMIN', '#9333ea'],
  ['CR', 'CR', '#f97316'],
  ['SW', 'SW', '#16a34a'],
  ['CG', 'CG', '#2563eb'],
  ['EDITOR', 'EDITOR', '#0891b2'],
  ['ARTIST', 'ARTIST', '#db2777'],
];
const RETIRED = ['DESIGNER_REPRESENTATIVE', 'LR', 'CO', 'VENDOR'];

(async () => {
  const apply = process.argv.includes('--apply');
  const db = await mysql.createConnection({
    host: process.env.DATABASE_HOST, user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME,
    port: Number(process.env.DATABASE_PORT) || 3306,
  });
  const run = async (label, sql, params = []) => {
    if (apply) { const [r] = await db.query(sql, params); console.log(`${label}: ${r.affectedRows ?? 0} row(s)`); }
    else console.log(`would run: ${label}`);
  };

  // users + role definitions
  await run('users CRM -> CR', "UPDATE users SET role = 'CR' WHERE role = 'CRM'");
  const [hasCR] = await db.query("SELECT 1 FROM user_roles WHERE id = 'CR'");
  if (!hasCR.length) await run('user_roles CRM -> CR', "UPDATE user_roles SET id = 'CR', name = 'CR' WHERE id = 'CRM'");
  else await run('user_roles drop CRM', "DELETE FROM user_roles WHERE id = 'CRM'");

  // new roles
  const [maxP] = await db.query('SELECT COALESCE(MAX(priority), -1) m FROM user_roles');
  let priority = maxP[0].m;
  for (const [id, name, color] of NEW_ROLES) {
    const [ex] = await db.query('SELECT 1 FROM user_roles WHERE id = ?', [id]);
    if (ex.length) continue;
    priority++;
    await run(`insert role ${id}`, 'INSERT INTO user_roles (id, name, color, is_default, priority) VALUES (?, ?, ?, 1, ?)', [id, name, color, priority]);
  }

  // retired roles: only when nobody uses them
  for (const id of RETIRED) {
    const [u] = await db.query('SELECT COUNT(*) n FROM users WHERE role = ?', [id]);
    if (u[0].n > 0) { console.log(`keep ${id}: ${u[0].n} user(s) still use it, reassign them first`); continue; }
    await run(`remove role ${id}`, 'DELETE FROM user_roles WHERE id = ?', [id]);
  }

  // JSON that stores role ids: exact quoted token only, so "CRM Team" etc. stay untouched
  await run('order_statuses.allowed_roles', `UPDATE order_statuses SET allowed_roles = REPLACE(allowed_roles, '"CRM"', '"CR"') WHERE allowed_roles LIKE '%"CRM"%'`);
  await run('global_settings.settings_json', `UPDATE global_settings SET settings_json = REPLACE(CAST(settings_json AS CHAR), '"CRM"', '"CR"') WHERE CAST(settings_json AS CHAR) LIKE '%"CRM"%'`);

  // DESIGNER_REPRESENTATIVE is gone: drop it from role lists, and its team-target key becomes DR_TEAM
  const strip = (col) =>
    // key rename first, otherwise the ',"DESIGNER_REPRESENTATIVE"' pattern would also eat object keys
    `REPLACE(REPLACE(REPLACE(REPLACE(${col}, '"DESIGNER_REPRESENTATIVE":', '"DR_TEAM":'), ',"DESIGNER_REPRESENTATIVE"', ''), '"DESIGNER_REPRESENTATIVE",', ''), '["DESIGNER_REPRESENTATIVE"]', '[]')`;
  await run('order_statuses: drop DESIGNER_REPRESENTATIVE', `UPDATE order_statuses SET allowed_roles = ${strip('allowed_roles')} WHERE allowed_roles LIKE '%DESIGNER_REPRESENTATIVE%'`);
  await run('global_settings: drop DESIGNER_REPRESENTATIVE', `UPDATE global_settings SET settings_json = ${strip('CAST(settings_json AS CHAR)')} WHERE CAST(settings_json AS CHAR) LIKE '%DESIGNER_REPRESENTATIVE%'`);

  if (!apply) console.log('\n(dry run, nothing changed)');
  await db.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
