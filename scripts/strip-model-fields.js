// Removes the retired price/stock/variation fields from service_models.data_json.
// Models now only keep: id, name, description, imageUrl.
//
//   node scripts/strip-model-fields.js           # dry run
//   node scripts/strip-model-fields.js --apply   # update rows
require('dotenv').config();
const mysql = require('mysql2/promise');

const KEEP = ['id', 'name', 'description', 'imageUrl'];

(async () => {
  const apply = process.argv.includes('--apply');
  const db = await mysql.createConnection({
    host: process.env.DATABASE_HOST, user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME,
    port: Number(process.env.DATABASE_PORT) || 3306,
  });
  const [rows] = await db.query('SELECT id, data_json FROM service_models');
  let changed = 0;
  for (const row of rows) {
    const data = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json;
    const extra = Object.keys(data).filter((k) => !KEEP.includes(k));
    if (!extra.length) continue;
    changed++;
    console.log(`${apply ? 'strip' : 'would strip'} "${data.name}": ${extra.join(', ')}`);
    if (apply) {
      const clean = Object.fromEntries(KEEP.filter((k) => k in data).map((k) => [k, data[k]]));
      await db.query('UPDATE service_models SET data_json = ? WHERE id = ?', [JSON.stringify(clean), row.id]);
    }
  }
  console.log(`${changed}/${rows.length} model(s) ${apply ? 'updated' : 'would change (dry run)'}`);
  await db.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
