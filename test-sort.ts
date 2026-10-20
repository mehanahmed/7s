import { query } from './src/lib/mysql';

async function testSorting() {
  try {
    console.log("Fetching leads with new sorting...");
    const rows = await query<any[]>(
      `SELECT id, 
              JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.contactName')) as name,
              JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.categoryUpdatedAt')) as categoryUpdatedAt, 
              JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.date')) as date,
              COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.categoryUpdatedAt')), ''), JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.date'))) as sortKey
       FROM leads 
       ORDER BY COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.categoryUpdatedAt')), ''), JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.date'))) DESC 
       LIMIT 10`
    );
    console.table(rows);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

testSorting();
