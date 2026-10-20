import 'dotenv/config';
import { query } from '../src/lib/mysql';

async function safeAddIndex(table: string, indexName: string, columns: string) {
  try {
    const existing = await query<any[]>(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [indexName]);
    if (existing.length === 0) {
      console.log(`Adding index ${indexName} on ${table}(${columns})...`);
      await query(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (${columns})`);
      console.log(`✓ Index ${indexName} added successfully.`);
    } else {
      console.log(`- Index ${indexName} already exists on ${table}.`);
    }
  } catch (err: any) {
    console.error(`Error adding index ${indexName} on ${table}:`, err?.message || err);
  }
}

async function run() {
  console.log('--- Optimizing Database Performance with Indexes ---');
  
  // 1. Orders Table Indexes
  // Optimizes: ORDER BY created_at DESC with WHERE is_deleted = FALSE
  await safeAddIndex('orders', 'idx_orders_deleted_created', '`is_deleted`, `created_at` DESC');
  
  // Optimizes: Status filtering & status tabs (e.g. current_status = 'delivered', 'project-pending', etc.)
  await safeAddIndex('orders', 'idx_orders_status', '`current_status`');
  
  // Optimizes: Staff/CRM user assigned orders lookup
  await safeAddIndex('orders', 'idx_orders_crm_user', '`crm_user_id`');
  
  // Optimizes: Designer representative jobs lookup
  await safeAddIndex('orders', 'idx_orders_designer_rep', '`designer_representative_id`');
  
  // 2. Users Table Indexes
  // Optimizes: Filtering users by role (CR, CRM, SYSTEM_ADMIN, etc.) and active status
  await safeAddIndex('users', 'idx_users_role', '`role`');
  await safeAddIndex('users', 'idx_users_banned', '`is_banned`');

  console.log('--- Database Index Optimization Complete ---');
  process.exit(0);
}

run();
