const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

const DB_HOST = process.env.DATABASE_HOST || 'localhost';
const DB_USER = process.env.DATABASE_USER || 'root';
const DB_PASS = process.env.DATABASE_PASSWORD || '';
const DB_NAME = process.env.DATABASE_NAME || 'erp_database';
const DB_PORT = Number(process.env.DATABASE_PORT) || 3306;

const ADMIN_EMAIL = 'admin@sevensolution.dev';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345678';

const DEFAULT_ROLES = [
  { id: 'SYSTEM_ADMIN', name: 'SYSTEM ADMIN', color: '#dc2626', priority: 0 },
  { id: 'ADMIN', name: 'ADMIN', color: '#9333ea', priority: 1 },
  { id: 'CR', name: 'CR', color: '#f97316', priority: 2 },
  { id: 'SW', name: 'SW', color: '#16a34a', priority: 3 },
  { id: 'CG', name: 'CG', color: '#2563eb', priority: 4 },
  { id: 'EDITOR', name: 'EDITOR', color: '#0891b2', priority: 5 },
  { id: 'ARTIST', name: 'ARTIST', color: '#db2777', priority: 6 },
];

const DEFAULT_STATUSES = [
  { id: 'order-submitted', name: 'Order Submitted', color: '#8B5CF6', allowedRoles: ['CR', 'ADMIN', 'SYSTEM_ADMIN'] },
  { id: 'ready-for-design', name: 'On Script', color: '#14B8A6', allowedRoles: ['CR', 'ADMIN', 'SYSTEM_ADMIN'] },
  { id: 'delivered', name: 'Delivered', color: '#65A30D', allowedRoles: ['ADMIN', 'SYSTEM_ADMIN', 'LR'] },
  { id: 'on-hold', name: 'On Hold', color: '#A1A1AA', allowedRoles: ['ADMIN', 'SYSTEM_ADMIN'] },
  { id: 'co-clearance', name: 'Operation Manager', color: '#0D9488', allowedRoles: ['CR', 'ADMIN', 'SYSTEM_ADMIN'] },
  { id: 'script-done', name: 'Script Done', color: '#7C3AED', allowedRoles: ['CR', 'ADMIN', 'SYSTEM_ADMIN'] },
  { id: 'artist-booked', name: 'Artist Booked', color: '#DB2777', allowedRoles: ['CR', 'ADMIN', 'SYSTEM_ADMIN'] },
  { id: 'cinematographer', name: 'Cinematographer', color: '#2563EB', allowedRoles: ['CR', 'ADMIN', 'SYSTEM_ADMIN'] },
  { id: 'cg-complete', name: 'CG Complete', color: '#0891B2', allowedRoles: ['CR', 'ADMIN', 'SYSTEM_ADMIN'] },
  { id: 'on-editor', name: 'On Editor', color: '#4F46E5', allowedRoles: ['CR', 'ADMIN', 'SYSTEM_ADMIN'] },
  { id: 'client-revision', name: 'Client Revision', color: '#EA580C', allowedRoles: ['CR', 'ADMIN', 'SYSTEM_ADMIN'] },
  { id: 'project-complete', name: 'Project Complete', color: '#16A34A', allowedRoles: ['CR', 'ADMIN', 'SYSTEM_ADMIN'] },
  { id: 'due-payment', name: 'Due Payment', color: '#DC2626', allowedRoles: ['CR', 'ADMIN', 'SYSTEM_ADMIN'] },
];

async function main() {
  console.log(`1. Connecting to MySQL at ${DB_HOST}:${DB_PORT} as ${DB_USER}...`);
  const rootConn = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    port: DB_PORT,
  });

  console.log(`2. Ensuring database '${DB_NAME}' exists...`);
  try {
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } catch (e) {
    console.log(`Note: Database check/creation skipped (${e.message}), proceeding to connect directly.`);
  }
  await rootConn.end();

  console.log(`3. Connecting to database '${DB_NAME}'...`);
  const db = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    port: DB_PORT,
  });

  console.log('4. Creating tables...');

  // user_roles
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      color VARCHAR(20) DEFAULT '#6b7280',
      is_default BOOLEAN DEFAULT FALSE,
      priority INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // users
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'CR',
      role_id VARCHAR(50) DEFAULT NULL,
      company_name VARCHAR(255) DEFAULT NULL,
      phone VARCHAR(20) DEFAULT NULL,
      address TEXT DEFAULT NULL,
      category VARCHAR(100) DEFAULT NULL,
      avatar_url LONGTEXT DEFAULT NULL,
      monthly_order_target INT DEFAULT 0,
      monthly_sales_target DECIMAL(15,2) NOT NULL DEFAULT 0,
      weekly_order_target INT DEFAULT 0,
      is_banned BOOLEAN DEFAULT FALSE,
      fcm_token TEXT DEFAULT NULL,
      is_leader BOOLEAN DEFAULT FALSE,
      join_date DATE DEFAULT NULL,
      employee_id VARCHAR(50) DEFAULT NULL,
      pin_code VARCHAR(255) DEFAULT NULL,
      pin_locked_until DATETIME DEFAULT NULL,
      two_factor_secret VARCHAR(255) DEFAULT NULL,
      two_factor_enabled BOOLEAN DEFAULT FALSE,
      two_factor_backup_codes TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_users_role (role),
      KEY idx_users_banned (is_banned)
    )
  `);

  // order_statuses
  await db.query(`
    CREATE TABLE IF NOT EXISTS order_statuses (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      color VARCHAR(20) NOT NULL,
      is_system_status BOOLEAN DEFAULT FALSE,
      is_visible BOOLEAN DEFAULT TRUE,
      allowed_roles JSON NULL,
      xid VARCHAR(50) NULL,
      is_deleted BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // clients
  await db.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id VARCHAR(50) PRIMARY KEY,
      company_name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(20) NOT NULL,
      address TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // orders
  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(50) PRIMARY KEY,
      client_id VARCHAR(50) NOT NULL,
      order_items JSON NULL,
      special_client_discount DECIMAL(10, 2) DEFAULT 0,
      shipping_charge DECIMAL(10, 2) DEFAULT 0,
      vat_percentage DECIMAL(5,2) NULL,
      order_notes TEXT,
      crm_user_id VARCHAR(50) NULL,
      crm_user_name VARCHAR(255) NULL,
      designer_representative_id VARCHAR(50) NULL,
      designer_representative_name VARCHAR(255) NULL,
      stage_assignees JSON NULL,
      assignee_avatar_url TEXT NULL,
      designer_representative_avatar_url TEXT NULL,
      packzy_consignment_id VARCHAR(100) NULL,
      packzy_tracking_code VARCHAR(100) NULL,
      is_public BOOLEAN DEFAULT FALSE,
      is_starred DECIMAL(2,1) DEFAULT 0.0,
      current_status VARCHAR(50) NULL,
      status_history JSON NULL,
      comments JSON NULL,
      advance_payments JSON NULL,
      view_count INT DEFAULT 0,
      accepted_delivery_date DATETIME NULL,
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at DATETIME NULL,
      deleted_by_id VARCHAR(50) NULL,
      deleted_by_name VARCHAR(255) NULL,
      deleted_by_avatar_url TEXT NULL,
      updated_by_user_id VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_orders_status (current_status),
      KEY idx_orders_crm_user (crm_user_id),
      KEY idx_orders_designer_rep (designer_representative_id),
      KEY idx_orders_deleted_created (is_deleted, created_at DESC)
    )
  `);

  // global_settings
  await db.query(`
    CREATE TABLE IF NOT EXISTS global_settings (
      id VARCHAR(50) PRIMARY KEY,
      settings_json JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // refresh_tokens
  await db.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id VARCHAR(36) PRIMARY KEY,
      family_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      revoked_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_token_hash (token_hash),
      KEY idx_family (family_id),
      KEY idx_user (user_id)
    )
  `);

  // projects
  await db.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id VARCHAR(50) PRIMARY KEY,
      data_json JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // shipped_orders
  await db.query(`
    CREATE TABLE IF NOT EXISTS shipped_orders (
      order_id VARCHAR(50) PRIMARY KEY,
      tracking_code VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // leads
  await db.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id VARCHAR(50) PRIMARY KEY,
      crm_id VARCHAR(50),
      contact_name VARCHAR(255) NOT NULL,
      business_name VARCHAR(255),
      phone VARCHAR(20) NOT NULL,
      source VARCHAR(100),
      address TEXT,
      division VARCHAR(100),
      district VARCHAR(100),
      thana VARCHAR(100),
      category VARCHAR(50) DEFAULT 'POP',
      status VARCHAR(50) DEFAULT 'New Lead',
      customer_type VARCHAR(50) DEFAULT 'WARM',
      notes TEXT,
      schedule TIMESTAMP NULL,
      data_json JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // lead_activities
  await db.query(`
    CREATE TABLE IF NOT EXISTS lead_activities (
      id VARCHAR(50) PRIMARY KEY,
      lead_id VARCHAR(50),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      activity VARCHAR(255) NOT NULL,
      notes TEXT,
      changed_by_user_id VARCHAR(50)
    )
  `);

  // employees
  await db.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id VARCHAR(50) PRIMARY KEY,
      user_id VARCHAR(50),
      employee_id_display VARCHAR(20) UNIQUE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      mobile_no VARCHAR(20) NOT NULL,
      designation VARCHAR(100),
      salary DECIMAL(10, 2) NOT NULL,
      joining_date DATE NOT NULL,
      dob DATE,
      status VARCHAR(20) DEFAULT 'Active',
      provident_fund_status VARCHAR(20) DEFAULT 'Active',
      national_id VARCHAR(50),
      account_no VARCHAR(50)
    )
  `);

  // team_performance_tasks
  await db.query(`
    CREATE TABLE IF NOT EXISTS team_performance_tasks (
      id VARCHAR(100) PRIMARY KEY,
      data_json JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // team_monthly_targets
  await db.query(`
    CREATE TABLE IF NOT EXISTS team_monthly_targets (
      id VARCHAR(100) PRIMARY KEY,
      data_json JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // finance_records
  await db.query(`
    CREATE TABLE IF NOT EXISTS finance_records (
      id VARCHAR(50) PRIMARY KEY,
      user_id VARCHAR(50),
      date DATETIME,
      amount DECIMAL(10,2),
      category VARCHAR(100),
      type VARCHAR(50),
      data_json JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // personal_notes
  await db.query(`
    CREATE TABLE IF NOT EXISTS personal_notes (
      id VARCHAR(50) PRIMARY KEY,
      user_id VARCHAR(50),
      content TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // feedback
  await db.query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id VARCHAR(50) PRIMARY KEY,
      data_json JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // workflow_entries
  await db.query(`
    CREATE TABLE IF NOT EXISTS workflow_entries (
      id VARCHAR(50) PRIMARY KEY,
      team VARCHAR(20),
      data_json JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // service options tables
  const serviceTables = ['service_models', 'service_laminations', 'service_payment_methods', 'service_gifts', 'service_variations', 'service_courier_notes'];
  for (const t of serviceTables) {
    await db.query(`CREATE TABLE IF NOT EXISTS ${t} (id VARCHAR(255) PRIMARY KEY, data_json JSON NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  }

  console.log('5. Inserting default roles...');
  for (const r of DEFAULT_ROLES) {
    await db.query(
      `INSERT INTO user_roles (id, name, color, is_default, priority)
       VALUES (?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), color = VALUES(color), priority = VALUES(priority)`,
      [r.id, r.name, r.color, r.priority]
    );
  }

  console.log('6. Inserting default order statuses...');
  for (const s of DEFAULT_STATUSES) {
    await db.query(
      `INSERT INTO order_statuses (id, name, color, is_system_status, is_visible, allowed_roles)
       VALUES (?, ?, ?, 1, 1, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), color = VALUES(color), allowed_roles = VALUES(allowed_roles)`,
      [s.id, s.name, s.color, JSON.stringify(s.allowedRoles)]
    );
  }

  console.log('7. Seeding SYSTEM_ADMIN user...');
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [ADMIN_EMAIL]);
  if (existing.length > 0) {
    await db.query(
      'UPDATE users SET password = ?, role = ?, role_id = ?, is_banned = 0, pin_code = NULL, pin_locked_until = NULL, two_factor_enabled = 0 WHERE email = ?',
      [hash, 'SYSTEM_ADMIN', 'SYSTEM_ADMIN', ADMIN_EMAIL]
    );
    console.log(`✓ Admin user '${ADMIN_EMAIL}' updated successfully.`);
  } else {
    const adminId = randomUUID();
    await db.query(
      `INSERT INTO users (id, name, email, password, role, role_id, company_name, is_banned, is_leader, two_factor_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
      [adminId, 'System Admin', ADMIN_EMAIL, hash, 'SYSTEM_ADMIN', 'SYSTEM_ADMIN', 'Seven Solution']
    );
    console.log(`✓ Admin user '${ADMIN_EMAIL}' created successfully.`);
  }

  await db.end();
  console.log('--- Database Setup Complete! ---');
}

main().catch(err => {
  console.error('Database setup failed:', err);
  process.exit(1);
});
