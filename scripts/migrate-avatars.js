// Moves old base64 avatars (users.avatar_url = "data:image/...") out of the DB into storage/uploads.
// Big base64 strings get copied into every order/lead row that joins users, which slows list queries.
//
//   node scripts/migrate-avatars.js           # dry run, only reports
//   node scripts/migrate-avatars.js --apply   # writes files + updates users.avatar_url
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { randomUUID } = require('crypto');

const EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

(async () => {
  const apply = process.argv.includes('--apply');
  const db = await mysql.createConnection({
    host: process.env.DATABASE_HOST, user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME,
    port: Number(process.env.DATABASE_PORT) || 3306,
  });
  const [rows] = await db.query("SELECT id, avatar_url FROM users WHERE avatar_url LIKE 'data:%'");
  const dir = path.join(__dirname, '..', 'storage', 'uploads');
  if (apply) fs.mkdirSync(dir, { recursive: true });

  let bytes = 0;
  for (const row of rows) {
    const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/s.exec(row.avatar_url);
    if (!m || !EXT[m[1]]) { console.log(`skip ${row.id}: unsupported format`); continue; }
    const buf = Buffer.from(m[2], 'base64');
    bytes += row.avatar_url.length;
    const name = `${randomUUID()}.${EXT[m[1]]}`;
    console.log(`${apply ? 'migrate' : 'would migrate'} ${row.id}: ${(buf.length / 1024).toFixed(1)} KB -> /uploads/${name}`);
    if (apply) {
      fs.writeFileSync(path.join(dir, name), buf);
      await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [`/uploads/${name}`, row.id]);
    }
  }
  console.log(`${rows.length} base64 avatar(s), ${(bytes / 1024).toFixed(1)} KB removed from DB${apply ? '' : ' (dry run, nothing changed)'}`);
  await db.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
