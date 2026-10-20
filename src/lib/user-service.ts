'use server';

import { query } from './mysql';
import type { User, UserRole } from '@/types';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import { getRoles } from './user-role-service';
import { generateBase32Secret, generateBackupCodes, generateOtpAuthUrl, verifyTOTP } from './totp';
import { guard } from '@/lib/guard';
import { requireRole } from '@/lib/guard';
import { z } from 'zod';

const USERS_TABLE = 'users';

let salesTargetColumnPromise: Promise<void> | null = null;
const ensureSalesTargetColumn = async () => {
  if (!salesTargetColumnPromise) {
    salesTargetColumnPromise = (async () => {
      const columns = await query<any[]>(`SHOW COLUMNS FROM ${USERS_TABLE} LIKE 'monthly_sales_target'`);
      if (!columns.length) {
        try {
          await query(`ALTER TABLE ${USERS_TABLE} ADD COLUMN monthly_sales_target DECIMAL(15,2) NOT NULL DEFAULT 0`);
        } catch (error: any) { if (error?.code !== 'ER_DUP_FIELDNAME') throw error; }
      }
    })().catch(error => { salesTargetColumnPromise = null; throw error; });
  }
  await salesTargetColumnPromise;
};

const salesTargetsSchema = z.object({
  userId: z.string().trim().min(1).max(50),
  amountTarget: z.number().finite().min(0).max(999999999999.99).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.01, 'Use at most two decimal places.'),
});

let categoryColumnPromise: Promise<void> | null = null;
const ensureCategoryColumn = async () => {
  if (!categoryColumnPromise) {
    categoryColumnPromise = (async () => {
      const columns = await query<any[]>(`SHOW COLUMNS FROM ${USERS_TABLE} LIKE 'category'`);
      if (columns.length === 0) {
        try {
          await query(`ALTER TABLE ${USERS_TABLE} ADD COLUMN category VARCHAR(100) DEFAULT NULL`);
        } catch (error: any) {
          if (error?.code !== 'ER_DUP_FIELDNAME') throw error;
        }
      }
    })().catch(error => {
      categoryColumnPromise = null;
      throw error;
    });
  }
  await categoryColumnPromise;
};

export const getArtistCategories = async (): Promise<string[]> => {
  await guard();
  await ensureCategoryColumn();
  const rows = await query<{ category: string }[]>(
    `SELECT DISTINCT TRIM(category) AS category FROM ${USERS_TABLE} WHERE role = ? AND category IS NOT NULL AND TRIM(category) <> '' ORDER BY category ASC`,
    ['ARTIST'],
  );
  return rows.map(row => row.category);
};

let avatarColumnCapacityEnsured = false;
const ensureAvatarColumnCapacity = async () => {
  if (avatarColumnCapacityEnsured) return;
  try {
    await query(`ALTER TABLE ${USERS_TABLE} MODIFY COLUMN avatar_url LONGTEXT`);
    avatarColumnCapacityEnsured = true;
  } catch (e) {
    // Ignore if table/column does not exist yet or user lacks alter privileges
  }
};

let pinCodeColumnEnsured = false;
const ensurePinCodeColumnExists = async () => {
  if (pinCodeColumnEnsured) return;
  try {
    const columns = await query<any[]>(`SHOW COLUMNS FROM ${USERS_TABLE} LIKE 'pin_code'`);
    if (columns.length === 0) {
      console.log(`Column 'pin_code' not found in table '${USERS_TABLE}'. Creating it...`);
      await query(`ALTER TABLE ${USERS_TABLE} ADD COLUMN pin_code VARCHAR(255) DEFAULT NULL`);
    }
    const lockCol = await query<any[]>(`SHOW COLUMNS FROM ${USERS_TABLE} LIKE 'pin_locked_until'`);
    if (lockCol.length === 0) {
      await query(`ALTER TABLE ${USERS_TABLE} ADD COLUMN pin_locked_until DATETIME DEFAULT NULL`);
    }
    pinCodeColumnEnsured = true;
  } catch (e) {
    console.error(`Error ensuring PIN columns exist:`, e);
  }
};
ensurePinCodeColumnExists();

let twoFactorColumnsEnsured = false;
const ensureTwoFactorColumnsExist = async () => {
  if (twoFactorColumnsEnsured) return;
  try {
    const colSecret = await query<any[]>(`SHOW COLUMNS FROM ${USERS_TABLE} LIKE 'two_factor_secret'`);
    if (colSecret.length === 0) {
      await query(`ALTER TABLE ${USERS_TABLE} ADD COLUMN two_factor_secret VARCHAR(255) DEFAULT NULL`);
    }
    const colEnabled = await query<any[]>(`SHOW COLUMNS FROM ${USERS_TABLE} LIKE 'two_factor_enabled'`);
    if (colEnabled.length === 0) {
      await query(`ALTER TABLE ${USERS_TABLE} ADD COLUMN two_factor_enabled TINYINT(1) DEFAULT 0`);
    }
    const colBackup = await query<any[]>(`SHOW COLUMNS FROM ${USERS_TABLE} LIKE 'two_factor_backup_codes'`);
    if (colBackup.length === 0) {
      await query(`ALTER TABLE ${USERS_TABLE} ADD COLUMN two_factor_backup_codes TEXT DEFAULT NULL`);
    }
    twoFactorColumnsEnsured = true;
  } catch (e) {
    console.error(`Error ensuring 2FA columns exist:`, e);
  }
};
ensureTwoFactorColumnsExist();

// DATE columns come back as local-time Date objects; keep them as plain YYYY-MM-DD strings.
const toDateOnly = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};


let employeeIdColumnEnsured = false;

/** YYMMDD of a YYYY-MM-DD join date (today when missing/invalid). */
const employeeIdPrefix = (joinDate?: string | null): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(joinDate || '');
  const [y, mo, d] = m
    ? [m[1], m[2], m[3]]
    : (() => { const t = new Date(); return [String(t.getFullYear()), String(t.getMonth() + 1).padStart(2, '0'), String(t.getDate()).padStart(2, '0')]; })();
  return y.slice(2) + mo + d;
};

/** Employee ID = YYMMDD of the join date + running number for that day: 2026-10-12 -> 26101201, 26101202, ... */
const nextEmployeeId = async (joinDate?: string | null): Promise<string> => {
  const prefix = employeeIdPrefix(joinDate);
  const rows = await query<any[]>(
    `SELECT MAX(CAST(SUBSTRING(employee_id, 7) AS UNSIGNED)) AS m FROM ${USERS_TABLE} WHERE employee_id REGEXP ?`,
    ['^' + prefix + '[0-9]+$'],
  );
  return prefix + String((Number(rows[0]?.m) || 0) + 1).padStart(2, '0');
};

const ensureEmployeeIdColumn = async () => {
  if (employeeIdColumnEnsured) return;
  try {
    const cols = await query<any[]>(`SHOW COLUMNS FROM ${USERS_TABLE} LIKE 'employee_id'`);
    if (cols.length === 0) {
      await query(`ALTER TABLE ${USERS_TABLE} ADD COLUMN employee_id VARCHAR(30) DEFAULT NULL`);
      await query(`ALTER TABLE ${USERS_TABLE} ADD UNIQUE INDEX uq_users_employee_id (employee_id)`);
    }
    // users without an ID (or still on the old EMP-0001 style) get one based on their join date
    const missing = await query<any[]>(
      `SELECT id, join_date FROM ${USERS_TABLE} WHERE employee_id IS NULL OR employee_id LIKE 'EMP-%' ORDER BY join_date ASC, name ASC`,
    );
    for (const row of missing) {
      const eid = await nextEmployeeId(toDateOnly(row.join_date));
      await query(`UPDATE ${USERS_TABLE} SET employee_id = ? WHERE id = ?`, [eid, row.id]);
    }
    employeeIdColumnEnsured = true;
  } catch (e) {
    console.error('Error ensuring employee_id column exists:', e);
  }
};
ensureEmployeeIdColumn();

let joinDateColumnEnsured = false;
const ensureJoinDateColumn = async () => {
  if (joinDateColumnEnsured) return;
  try {
    const cols = await query<any[]>(`SHOW COLUMNS FROM ${USERS_TABLE} LIKE 'join_date'`);
    if (cols.length === 0) await query(`ALTER TABLE ${USERS_TABLE} ADD COLUMN join_date DATE DEFAULT NULL`);
    joinDateColumnEnsured = true;
  } catch (e) {
    console.error('Error ensuring join_date column exists:', e);
  }
};
ensureJoinDateColumn();

let assignedDivisionsColumnEnsured = false;
export const ensureAssignedDivisionsColumnExists = async () => {
  await guard();
  if (assignedDivisionsColumnEnsured) return;
  try {
    const columns = await query<any[]>(`SHOW COLUMNS FROM ${USERS_TABLE} LIKE 'assigned_divisions'`);
    if (columns.length === 0) {
      console.log(`Column 'assigned_divisions' not found in table '${USERS_TABLE}'. Creating it...`);
      await query(`ALTER TABLE ${USERS_TABLE} ADD COLUMN assigned_divisions TEXT DEFAULT NULL`);
    }
    assignedDivisionsColumnEnsured = true;
  } catch (e) {
    console.error(`Error ensuring assigned_divisions column exists:`, e);
  }
};
ensureAssignedDivisionsColumnExists();

const parseAssignedDivisions = (val: any): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    // fallback comma-separated string
  }
  return String(val).split(',').map((s: string) => s.trim()).filter(Boolean);
};

export interface PinVerificationResult {
  success: boolean;
  isLocked: boolean;
  lockedUntil?: string | null;
  message?: string;
}

// Lock user account for 72 hours in DB after 3 wrong attempts
export const lockUserAccount72h = async (userId: string): Promise<{ success: boolean; lockedUntil: string }> => {
  await guard();
  try {
    await ensurePinCodeColumnExists();
    const lockedUntilDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
    await query(
      `UPDATE ${USERS_TABLE} SET pin_locked_until = ?, is_banned = 1 WHERE id = ?`,
      [lockedUntilDate, userId]
    );
    return { success: true, lockedUntil: lockedUntilDate.toISOString() };
  } catch (error) {
    console.error(`Error locking user account for ${userId}:`, error);
    return { success: false, lockedUntil: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() };
  }
};

// Update user's PIN code in MySQL (hashed)
export const updateUserPinCode = async (userId: string, pinCode: string | null): Promise<boolean> => {
  await guard();
  try {
    await ensurePinCodeColumnExists();
    let hashedPin: string | null = null;
    if (pinCode && pinCode.trim().length > 0) {
      hashedPin = await bcrypt.hash(pinCode.trim(), 10);
    }
    await query(`UPDATE ${USERS_TABLE} SET pin_code = ?, pin_locked_until = NULL WHERE id = ?`, [hashedPin, userId]);
    return true;
  } catch (error) {
    console.error("Error updating user PIN code in MySQL:", error);
    return false;
  }
};

// Verify user PIN code
export const verifyUserPinCodeWithLock = async (userId: string, pinInput: string): Promise<PinVerificationResult> => {
  await guard();
  try {
    await ensurePinCodeColumnExists();
    const results = await query<any[]>(`SELECT pin_code, pin_locked_until FROM ${USERS_TABLE} WHERE id = ?`, [userId]);
    if (results.length === 0) {
      return { success: false, isLocked: false, message: "User not found." };
    }

    const row = results[0];
    const now = new Date();

    // Check if account is currently locked for 72 hours
    if (row.pin_locked_until) {
      const lockedUntilDate = new Date(row.pin_locked_until);
      if (lockedUntilDate > now) {
        return {
          success: false,
          isLocked: true,
          lockedUntil: lockedUntilDate.toISOString(),
          message: `Account is locked for 72 hours due to 3 consecutive wrong PIN attempts.`
        };
      } else {
        // Lock period expired -> auto unlock
        await query(`UPDATE ${USERS_TABLE} SET pin_locked_until = NULL, is_banned = 0 WHERE id = ?`, [userId]);
        row.pin_locked_until = null;
      }
    }

    const storedPin = row.pin_code;
    if (!storedPin) {
      return { success: false, isLocked: false, message: "No PIN code configured." };
    }

    let isMatch = false;
    if (storedPin.startsWith('$2a$') || storedPin.startsWith('$2b$')) {
      isMatch = await bcrypt.compare(pinInput.trim(), storedPin);
    } else {
      isMatch = pinInput.trim() === storedPin;
    }

    if (isMatch) {
      if (row.pin_locked_until) {
        await query(`UPDATE ${USERS_TABLE} SET pin_locked_until = NULL WHERE id = ?`, [userId]);
      }
      return { success: true, isLocked: false };
    } else {
      return { success: false, isLocked: false, message: "Incorrect PIN code. Please try again." };
    }
  } catch (error) {
    console.error(`Error verifying PIN code for user "${userId}":`, error);
    return { success: false, isLocked: false, message: "Server error verifying PIN code." };
  }
};

// Simple verifyUserPinCode wrapper for backward compatibility
export const verifyUserPinCode = async (userId: string, pinInput: string): Promise<boolean> => {
  await guard();
  const result = await verifyUserPinCodeWithLock(userId, pinInput);
  return result.success;
};


// Add a new user to MySQL
export const addUser = async (userData: Omit<User, 'id'> & { id?: string }): Promise<User | null> => {
  await guard();
  await ensureSalesTargetColumn();
  await ensureCategoryColumn();
  await ensureAvatarColumnCapacity();
  let userId = userData.id;

  if (!userId) {
    // Generate a unique ID using UUID
    userId = uuidv4();
  } else {
    // Check if custom ID already exists
    const existingUser = await getUserById(userId);
    if (existingUser) {
      throw new Error(`User ID "${userId}" already exists. Please choose another.`);
    }
  }

  if (userData.email) {
    const existingEmail = await getUserByEmail(userData.email.trim());
    if (existingEmail) {
      throw new Error(`Email "${userData.email.trim()}" is already registered to another user.`);
    }
  }

  if (userData.role) {
    try {
      const roles = await getRoles();
      const roleExists = roles.some(r => r.id === userData.role);
      if (!roleExists) {
        throw new Error(`Role "${userData.role}" does not exist in the system. Please ensure the role is created under Custom Access first.`);
      }
    } catch (e: any) {
      if (e?.message?.includes("does not exist")) throw e;
    }
  }

  await ensureJoinDateColumn();
  await ensureEmployeeIdColumn();
  const employeeId = await nextEmployeeId(userData.joinDate); // always generated: join date + running number
  const hashedPassword = userData.password ? await bcrypt.hash(userData.password, 10) : await bcrypt.hash('password', 10);

  const newUser: User = {
    ...userData,
    id: userId,
    email: userData.email.trim(),
    companyName: userData.companyName || null,
    phone: userData.phone || null,
    address: userData.address || null,
    category: userData.category?.trim() || null,
    avatarUrl: userData.avatarUrl || null,
    monthlyOrderTarget: userData.monthlyOrderTarget ?? 0,
    monthlySalesTarget: userData.monthlySalesTarget ?? 0,
    weeklyOrderTarget: userData.weeklyOrderTarget ?? 0,
    isBanned: false,
    fcmToken: null,
    isLeader: userData.isLeader || false,
    employeeId,
  };

  try {
    await query(
      `INSERT INTO ${USERS_TABLE} (id, name, email, password, role, company_name, phone, address, category, avatar_url, monthly_order_target, monthly_sales_target, weekly_order_target, is_banned, fcm_token, is_leader, join_date, employee_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newUser.id, newUser.name, newUser.email, hashedPassword,
        newUser.role, newUser.companyName, newUser.phone, newUser.address, newUser.category,
        newUser.avatarUrl, newUser.monthlyOrderTarget, newUser.monthlySalesTarget, newUser.weeklyOrderTarget,
        newUser.isBanned ? 1 : 0, newUser.fcmToken, newUser.isLeader ? 1 : 0, newUser.joinDate || null, newUser.employeeId
      ]
    );

    return newUser;
  } catch (error: any) {
    console.error("Error adding user to MySQL:", error);
    if (error?.code === 'ER_DUP_ENTRY') {
      throw new Error(`A user with email "${newUser.email}" already exists.`);
    }
    if (error?.code === 'ER_NO_REFERENCED_ROW_2' || error?.code === 'ER_NO_REFERENCED_ROW') {
      throw new Error(`Role "${newUser.role}" is invalid or does not exist in the database.`);
    }
    if (error?.code === 'ER_DATA_TOO_LONG') {
      throw new Error("Avatar image file size is too large for database storage. Please choose a smaller image.");
    }
    if (error?.code === 'ER_BAD_FIELD_ERROR' && error?.message?.includes('role')) {
      await query(
        `INSERT INTO ${USERS_TABLE} (id, name, email, password, role_id, company_name, phone, address, category, avatar_url, monthly_order_target, monthly_sales_target, weekly_order_target, is_banned, fcm_token, is_leader, join_date, employee_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newUser.id, newUser.name, newUser.email, hashedPassword,
          newUser.role, newUser.companyName, newUser.phone, newUser.address, newUser.category,
          newUser.avatarUrl, newUser.monthlyOrderTarget, newUser.monthlySalesTarget, newUser.weeklyOrderTarget,
          newUser.isBanned ? 1 : 0, newUser.fcmToken, newUser.isLeader ? 1 : 0, newUser.joinDate || null, newUser.employeeId
        ]
      );
      return newUser;
    }
    if (error instanceof Error) throw error;
    throw new Error("Failed to insert user into database.");
  }
};

// Admin unlock user PIN account
export const unlockUserPinAccount = async (userId: string): Promise<boolean> => {
  await guard();
  try {
    await ensurePinCodeColumnExists();
    await query(`UPDATE ${USERS_TABLE} SET pin_locked_until = NULL, is_banned = 0 WHERE id = ?`, [userId]);
    return true;
  } catch (error) {
    console.error(`Error unlocking user PIN account for ${userId}:`, error);
    return false;
  }
};

// Get all users from MySQL
export const getUsers = async (): Promise<User[]> => {
  await guard();
  try {
    await ensureSalesTargetColumn();
    await ensureCategoryColumn();
    await ensurePinCodeColumnExists();
    await ensureTwoFactorColumnsExist();
    await ensureAssignedDivisionsColumnExists();
    const results = await query<any[]>(`SELECT * FROM ${USERS_TABLE} ORDER BY name ASC`);
    return results.map(row => {
      const isLocked = Boolean(row.pin_locked_until && new Date(row.pin_locked_until) > new Date());
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        companyName: row.company_name,
        phone: row.phone,
        address: row.address,
        category: row.category ?? null,
        password: row.password,
        avatarUrl: row.avatar_url,
        monthlyOrderTarget: row.monthly_order_target,
        monthlySalesTarget: Number(row.monthly_sales_target) || 0,
        weeklyOrderTarget: row.weekly_order_target,
        isBanned: Boolean(row.is_banned) || isLocked,
        fcmToken: row.fcm_token,
        isLeader: Boolean(row.is_leader),
        hasPinCode: Boolean(row.pin_code && String(row.pin_code).length > 0),
        pinLockedUntil: row.pin_locked_until ? new Date(row.pin_locked_until).toISOString() : null,
        hasTwoFactor: Boolean(Number(row.two_factor_enabled) === 1 && row.two_factor_secret && String(row.two_factor_secret).trim().length > 0),
        assignedDivisions: parseAssignedDivisions(row.assigned_divisions),
        joinDate: toDateOnly(row.join_date),
        employeeId: row.employee_id ?? null,
      } as User;
    });
  } catch (error) {
    console.error("Error fetching users from MySQL:", error);
    return [];
  }
};

// Get a single user by ID from MySQL
export const getUserById = async (userId: string): Promise<User | null> => {
  await guard();
  if (!userId) return null;
  try {
    await ensurePinCodeColumnExists();
    await ensureTwoFactorColumnsExist();
    await ensureAssignedDivisionsColumnExists();
    const results = await query<any[]>(`SELECT * FROM ${USERS_TABLE} WHERE id = ?`, [userId]);
    if (results.length > 0) {
      const row = results[0];
      const isLocked = Boolean(row.pin_locked_until && new Date(row.pin_locked_until) > new Date());
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        companyName: row.company_name,
        phone: row.phone,
        address: row.address,
        category: row.category ?? null,
        password: row.password,
        avatarUrl: row.avatar_url,
        monthlyOrderTarget: row.monthly_order_target,
        monthlySalesTarget: Number(row.monthly_sales_target) || 0,
        weeklyOrderTarget: row.weekly_order_target,
        isBanned: Boolean(row.is_banned) || isLocked,
        fcmToken: row.fcm_token,
        isLeader: Boolean(row.is_leader),
        hasPinCode: Boolean(row.pin_code && String(row.pin_code).length > 0),
        pinLockedUntil: row.pin_locked_until ? new Date(row.pin_locked_until).toISOString() : null,
        hasTwoFactor: Boolean(Number(row.two_factor_enabled) === 1 && row.two_factor_secret && String(row.two_factor_secret).trim().length > 0),
        assignedDivisions: parseAssignedDivisions(row.assigned_divisions),
        joinDate: toDateOnly(row.join_date),
        employeeId: row.employee_id ?? null,
      } as User;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching user by ID "${userId}" from MySQL:`, error);
    return null;
  }
};

// Get user by email from MySQL
export const getUserByEmail = async (email: string): Promise<User | null> => {
  await guard();
  try {
    await ensurePinCodeColumnExists();
    await ensureTwoFactorColumnsExist();
    await ensureAssignedDivisionsColumnExists();
    const results = await query<any[]>(`SELECT * FROM ${USERS_TABLE} WHERE email = ?`, [email]);
    if (results.length > 0) {
      const row = results[0];
      const isLocked = Boolean(row.pin_locked_until && new Date(row.pin_locked_until) > new Date());
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        companyName: row.company_name,
        phone: row.phone,
        address: row.address,
        category: row.category ?? null,
        password: row.password,
        avatarUrl: row.avatar_url,
        monthlyOrderTarget: row.monthly_order_target,
        monthlySalesTarget: Number(row.monthly_sales_target) || 0,
        weeklyOrderTarget: row.weekly_order_target,
        isBanned: Boolean(row.is_banned) || isLocked,
        fcmToken: row.fcm_token,
        isLeader: Boolean(row.is_leader),
        hasPinCode: Boolean(row.pin_code && String(row.pin_code).length > 0),
        pinLockedUntil: row.pin_locked_until ? new Date(row.pin_locked_until).toISOString() : null,
        hasTwoFactor: Boolean(Number(row.two_factor_enabled) === 1 && row.two_factor_secret && String(row.two_factor_secret).trim().length > 0),
        assignedDivisions: parseAssignedDivisions(row.assigned_divisions),
        joinDate: toDateOnly(row.join_date),
        employeeId: row.employee_id ?? null,
      } as User;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching user by email "${email}" from MySQL:`, error);
    return null;
  }
};

// Update user's assigned divisions (zones) in MySQL
export const updateUserAssignedDivisions = async (userId: string, divisions: string[]): Promise<boolean> => {
  await guard();
  try {
    await ensureAssignedDivisionsColumnExists();
    const cleanDivisions = Array.isArray(divisions) ? divisions.map(d => String(d).trim()).filter(Boolean) : [];
    await query(`UPDATE ${USERS_TABLE} SET assigned_divisions = ? WHERE id = ?`, [
      JSON.stringify(cleanDivisions),
      userId
    ]);
    return true;
  } catch (error) {
    console.error(`Error updating assigned divisions for user ${userId}:`, error);
    return false;
  }
};

// Update user's role in MySQL
export const updateUserRole = async (userId: string, role: UserRole): Promise<boolean> => {
  await guard();
  try {
    await query(`UPDATE ${USERS_TABLE} SET role = ? WHERE id = ?`, [role, userId]);
    return true;
  } catch (error) {
    console.error("Error updating user role in MySQL:", error);
    return false;
  }
};

// Update user's password in MySQL (hashed)
export const updateUserPassword = async (userId: string, newPasswordPlainText: string): Promise<boolean> => {
  await guard();
  try {
    const hashedPassword = await bcrypt.hash(newPasswordPlainText, 10);
    await query(`UPDATE ${USERS_TABLE} SET password = ? WHERE id = ?`, [hashedPassword, userId]);
    return true;
  } catch (error) {
    console.error("Error updating user password in MySQL:", error);
    return false;
  }
};

// Verify user password
export const verifyUserPassword = async (email: string, passwordPlainText: string): Promise<User | null> => {
  await guard();
  try {
    await ensurePinCodeColumnExists();
    await ensureTwoFactorColumnsExist();
    const results = await query<any[]>(`SELECT * FROM ${USERS_TABLE} WHERE email = ?`, [email]);
    if (results.length > 0) {
      const row = results[0];
      const isMatch = await bcrypt.compare(passwordPlainText, row.password);
      if (isMatch) {
        const isLocked = Boolean(row.pin_locked_until && new Date(row.pin_locked_until) > new Date());
        return {
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          companyName: row.company_name,
          phone: row.phone,
          address: row.address,
        category: row.category ?? null,
          avatarUrl: row.avatar_url,
          monthlyOrderTarget: row.monthly_order_target,
        monthlySalesTarget: Number(row.monthly_sales_target) || 0,
          weeklyOrderTarget: row.weekly_order_target,
          isBanned: Boolean(row.is_banned) || isLocked,
          fcmToken: row.fcm_token,
          isLeader: Boolean(row.is_leader),
          hasPinCode: Boolean(row.pin_code && String(row.pin_code).length > 0),
          pinLockedUntil: row.pin_locked_until ? new Date(row.pin_locked_until).toISOString() : null,
          hasTwoFactor: Boolean(Number(row.two_factor_enabled) === 1 && row.two_factor_secret && String(row.two_factor_secret).trim().length > 0),
        } as User;
      }
    }
    return null;
  } catch (error) {
    console.error(`Error verifying password for email "${email}":`, error);
    return null;
  }
};

// Update user's avatar in MySQL
export const updateUserAvatar = async (userId: string, avatarUrl: string | null): Promise<boolean> => {
  await guard();
  try {
    await ensureAvatarColumnCapacity();
    await query(`UPDATE ${USERS_TABLE} SET avatar_url = ? WHERE id = ?`, [avatarUrl, userId]);
    return true;
  } catch (error) {
    console.error("Error updating user avatar in MySQL:", error);
    return false;
  }
};

// Update user's sales targets in MySQL
export const updateUserTargets = async (userId: string, amountTarget: number): Promise<boolean> => {
  await guard();
  await requireRole(['SYSTEM_ADMIN', 'ADMIN']);
  const validated = salesTargetsSchema.safeParse({ userId, amountTarget });
  if (!validated.success) return false;
  try {
    await ensureSalesTargetColumn();
    await query(
      `UPDATE ${USERS_TABLE} SET monthly_sales_target = ? WHERE id = ?`,
      [validated.data.amountTarget, validated.data.userId]
    );
    return true;
  } catch (error) {
    console.error("Error updating user targets in MySQL:", error);
    return false;
  }
};

// Delete a user from MySQL with safety checks
export const deleteUser = async (userId: string): Promise<boolean> => {
  await guard();
  try {
    const targetUser = await getUserById(userId);
    if (!targetUser) {
      console.warn(`[deleteUser] User ${userId} not found.`);
      return false;
    }

    if (targetUser.role === 'SYSTEM_ADMIN') {
      console.error(`[deleteUser] Blocked attempt to delete SYSTEM_ADMIN user: ${userId} (${targetUser.email})`);
      return false;
    }

    console.log(`[deleteUser] Deleting user ${userId} (${targetUser.name} - ${targetUser.email})`);

    // Clean up related user documents
    try {
      await query(`DELETE FROM user_documents WHERE user_id = ?`, [userId]);
    } catch (docErr) {
      console.warn(`[deleteUser] Non-critical error deleting user documents for ${userId}:`, docErr);
    }

    await query(`DELETE FROM ${USERS_TABLE} WHERE id = ?`, [userId]);
    return true;
  } catch (error) {
    console.error("Error deleting user from MySQL:", error);
    return false;
  }
};

// Update user's ban status in MySQL
export const updateUserBanStatus = async (userId: string, isBanned: boolean): Promise<boolean> => {
  await guard();
  try {
    await query(`UPDATE ${USERS_TABLE} SET is_banned = ? WHERE id = ?`, [isBanned, userId]);
    return true;
  } catch (error) {
    console.error(`Error updating ban status for user ${userId} in MySQL:`, error);
    return false;
  }
};

// Update user's basic information in MySQL
/** The Employee ID a user would get for a given join date (used for the live preview in the edit dialog). */
export const previewEmployeeId = async (joinDate?: string | null): Promise<string> => {
  await guard();
  await ensureEmployeeIdColumn();
  return nextEmployeeId(joinDate);
};

export const updateUserInfo = async (
  userId: string,
  updates: Partial<Pick<User, 'name' | 'email' | 'companyName' | 'phone' | 'address' | 'category' | 'isLeader' | 'joinDate'>>
): Promise<boolean> => {
  await guard();
  await ensureJoinDateColumn();
  await ensureEmployeeIdColumn();
  try {
    // Employee ID is never typed in: when the join date moves to another day, re-issue it for that day.
    let newEmployeeId: string | null = null;
    if (updates.joinDate !== undefined) {
      const cur = await query<any[]>(`SELECT join_date, employee_id FROM ${USERS_TABLE} WHERE id = ?`, [userId]);
      if (cur[0]) {
        const newDate = updates.joinDate || null;
        if (newDate !== toDateOnly(cur[0].join_date) && !String(cur[0].employee_id ?? '').startsWith(employeeIdPrefix(newDate))) {
          newEmployeeId = await nextEmployeeId(newDate);
        }
      }
    }
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
    if (updates.companyName !== undefined) { fields.push('company_name = ?'); values.push(updates.companyName || null); }
    if (updates.phone !== undefined) { fields.push('phone = ?'); values.push(updates.phone || null); }
    if (updates.address !== undefined) { fields.push('address = ?'); values.push(updates.address || null); }
    if (updates.category !== undefined) { await ensureCategoryColumn(); fields.push('category = ?'); values.push(updates.category?.trim() || null); }
    if (updates.isLeader !== undefined) { fields.push('is_leader = ?'); values.push(updates.isLeader); }
    if (updates.joinDate !== undefined) { fields.push('join_date = ?'); values.push(updates.joinDate || null); }
    if (newEmployeeId) { fields.push('employee_id = ?'); values.push(newEmployeeId); }

    if (fields.length === 0) return true;

    values.push(userId);
    await query(`UPDATE ${USERS_TABLE} SET ${fields.join(', ')} WHERE id = ?`, values);
    return true;
  } catch (error) {
    console.error(`Error updating user info for ${userId} in MySQL:`, error);
    return false;
  }
};

// Update user's FCM token in MySQL
export async function updateUserFCMToken(userId: string, fcmToken: string | null): Promise<boolean> {
  await guard();
  if (!userId) return false;
  try {
    await query(`UPDATE ${USERS_TABLE} SET fcm_token = ? WHERE id = ?`, [fcmToken, userId]);
    return true;
  } catch (error) {
    console.error(`Error updating FCM token for user ${userId} in MySQL:`, error);
    return false;
  }
}

// Seed admin user in MySQL
export const seedInitialAdminUser = async () => {
  await guard();
  const adminEmail = "admin@sevensolution.dev";
  // No hardcoded default password: only seed when one is explicitly provided via env.
  const seedPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!seedPassword) return;
  try {
    // await ensureCoreTablesExist(); // Removed non-existent call
    const existingAdmin = await getUserByEmail(adminEmail);
    if (!existingAdmin) {
      await addUser({
        name: 'Default Admin',
        email: adminEmail,
        role: 'SYSTEM_ADMIN',
        companyName: 'Seven Solution Inc.',
        password: seedPassword,
        avatarUrl: null,
        monthlyOrderTarget: 0,
        weeklyOrderTarget: 0,
        isBanned: false,
        fcmToken: null,
        isLeader: false,
      });
    }
  } catch (error) {
    console.error("Error seeding admin user in MySQL:", error);
  }
};

// -------------------------------------------------------------
// TWO FACTOR AUTHENTICATION (2FA) SERVICE FUNCTIONS
// -------------------------------------------------------------

export interface SetupTwoFactorResult {
  secret: string;
  otpAuthUrl: string;
  backupCodes: string[];
  qrCodeUrl: string;
}

export const setupTwoFactorSecret = async (userId: string): Promise<SetupTwoFactorResult | null> => {
  await guard();
  try {
    await ensureTwoFactorColumnsExist();
    const user = await getUserById(userId);
    if (!user) return null;

    const secret = generateBase32Secret(32);
    const backupCodes = generateBackupCodes(8);
    const otpAuthUrl = generateOtpAuthUrl(secret, user.email, 'Seven Solution');
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpAuthUrl)}`;

    return { secret, otpAuthUrl, backupCodes, qrCodeUrl };
  } catch (error) {
    console.error(`Error setting up 2FA secret for user ${userId}:`, error);
    return null;
  }
};

export const enableTwoFactor = async (
  userId: string,
  token: string,
  secret: string,
  backupCodes: string[]
): Promise<{ success: boolean; message?: string }> => {
  await guard();
  try {
    await ensureTwoFactorColumnsExist();
    const isValid = verifyTOTP(secret, token);
    if (!isValid) {
      return { success: false, message: 'Invalid 6-digit authenticator code. Please check your app and try again.' };
    }

    await query(
      `UPDATE ${USERS_TABLE} SET two_factor_secret = ?, two_factor_enabled = 1, two_factor_backup_codes = ? WHERE id = ?`,
      [secret, JSON.stringify(backupCodes), userId]
    );

    return { success: true };
  } catch (error: any) {
    console.error(`Error enabling 2FA for user ${userId}:`, error);
    return { success: false, message: error?.message || 'Failed to enable 2FA.' };
  }
};

export const disableTwoFactor = async (userId: string): Promise<{ success: boolean; message?: string }> => {
  await guard();
  try {
    await ensureTwoFactorColumnsExist();
    await query(
      `UPDATE ${USERS_TABLE} SET two_factor_secret = NULL, two_factor_enabled = 0, two_factor_backup_codes = NULL WHERE id = ?`,
      [userId]
    );
    return { success: true };
  } catch (error: any) {
    console.error(`Error disabling 2FA for user ${userId}:`, error);
    return { success: false, message: error?.message || 'Failed to disable 2FA.' };
  }
};

export const verifyTwoFactorCode = async (
  userId: string,
  tokenInput: string
): Promise<{ success: boolean; isBackupCode?: boolean; remainingBackupCodes?: number; message?: string }> => {
  await guard();
  try {
    await ensureTwoFactorColumnsExist();
    const results = await query<any[]>(
      `SELECT two_factor_secret, two_factor_enabled, two_factor_backup_codes FROM ${USERS_TABLE} WHERE id = ?`,
      [userId]
    );

    if (results.length === 0 || !results[0].two_factor_enabled || !results[0].two_factor_secret) {
      return { success: false, message: '2FA is not enabled for this account.' };
    }

    const { two_factor_secret: secret, two_factor_backup_codes: rawBackupCodes } = results[0];
    const cleanToken = tokenInput.trim();

    // 1. Try TOTP code
    if (cleanToken.length === 6 && verifyTOTP(secret, cleanToken)) {
      return { success: true };
    }

    // 2. Try single-use Backup Code
    let backupCodes: string[] = [];
    if (rawBackupCodes) {
      try {
        backupCodes = typeof rawBackupCodes === 'string' ? JSON.parse(rawBackupCodes) : rawBackupCodes;
      } catch (e) {
        backupCodes = [];
      }
    }

    const uppercaseInput = cleanToken.toUpperCase().replace(/\s+/g, '');
    const codeIndex = backupCodes.findIndex(code => code.replace('-', '') === uppercaseInput.replace('-', ''));

    if (codeIndex !== -1) {
      // Consume backup code
      backupCodes.splice(codeIndex, 1);
      await query(
        `UPDATE ${USERS_TABLE} SET two_factor_backup_codes = ? WHERE id = ?`,
        [JSON.stringify(backupCodes), userId]
      );

      return {
        success: true,
        isBackupCode: true,
        remainingBackupCodes: backupCodes.length,
      };
    }

    return { success: false, message: 'Invalid 6-digit 2FA code or backup code. Please try again.' };
  } catch (error: any) {
    console.error(`Error verifying 2FA code for user ${userId}:`, error);
    return { success: false, message: 'Server error verifying 2FA code.' };
  }
};

export const getUserBackupCodes = async (userId: string): Promise<string[]> => {
  await guard();
  try {
    await ensureTwoFactorColumnsExist();
    const results = await query<any[]>(`SELECT two_factor_backup_codes FROM ${USERS_TABLE} WHERE id = ?`, [userId]);
    if (results.length > 0 && results[0].two_factor_backup_codes) {
      const raw = results[0].two_factor_backup_codes;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    }
    return [];
  } catch (error) {
    console.error(`Error fetching backup codes for ${userId}:`, error);
    return [];
  }
};
