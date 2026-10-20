"use server";

import type { UserRoleDefinition } from '@/types';
import { query } from './mysql';
import { cached } from '@/lib/ttl-cache';
import { guard } from '@/lib/guard';

const ROLES_TABLE = 'user_roles';

const DEFAULT_ROLES: Omit<UserRoleDefinition, 'createdAt' | 'priority'>[] = [
  { id: "SYSTEM_ADMIN", name: "SYSTEM ADMIN", color: "#dc2626", isDefault: true },
  { id: "ADMIN", name: "ADMIN", color: "#9333ea", isDefault: true },
  { id: "CR", name: "CR", color: "#f97316", isDefault: true },
  { id: "SW", name: "SW", color: "#16a34a", isDefault: true },
  { id: "CG", name: "CG", color: "#2563eb", isDefault: true },
  { id: "EDITOR", name: "EDITOR", color: "#0891b2", isDefault: true },
  { id: "ARTIST", name: "ARTIST", color: "#db2777", isDefault: true },
];

export const getRoles = async (): Promise<UserRoleDefinition[]> => {
  await guard();
  return cached('user_roles', 30000, loadRoles);
};

const loadRoles = async (): Promise<UserRoleDefinition[]> => {
  try {
    let results = await query<any[]>(`SELECT * FROM ${ROLES_TABLE} ORDER BY priority ASC, created_at ASC`);

    // Check for missing default roles even if some roles exist
    const existingIds = new Set(results.map(r => r.id));
    const missingDefaults = DEFAULT_ROLES.filter(dr => !existingIds.has(dr.id));

    if (missingDefaults.length > 0) {
      console.log(`Found ${missingDefaults.length} missing default roles, syncing...`);
      const maxPriority = results.length > 0 ? Math.max(...results.map(r => r.priority)) : -1;
      
      for (let i = 0; i < missingDefaults.length; i++) {
        const role = missingDefaults[i];
        const priority = maxPriority + 1 + i;
        const createdAt = new Date().toISOString();
        await query(
          `INSERT INTO ${ROLES_TABLE} (id, name, color, is_default, priority, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [role.id, role.name, role.color, role.isDefault, priority, createdAt]
        );
        // Add to local results to avoid second DB call
        results.push({
          id: role.id,
          name: role.name,
          color: role.color,
          is_default: 1,
          priority,
          created_at: createdAt
        });
      }
      // Re-sort results to maintain order if necessary (though they are added to the end)
      results.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    }

    if (results.length > 0) {
      return results.map(row => ({
        id: row.id,
        name: row.name,
        color: row.color,
        isDefault: Boolean(row.is_default),
        priority: row.priority,
        createdAt: row.created_at ? (row.created_at instanceof Date ? row.created_at : new Date(row.created_at)).toISOString() : new Date().toISOString(),
      } as UserRoleDefinition));
    } else {
      return []; // Should not happen now due to sync logic above
    }
  } catch (error) {
    console.error("Error fetching user roles from MySQL:", error);
    return DEFAULT_ROLES.map((r, i) => ({ ...r, priority: i, createdAt: new Date().toISOString() } as UserRoleDefinition));
  }
};

export const addCustomRole = async (name: string, color: string): Promise<UserRoleDefinition> => {
  await guard();
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Role name cannot be empty.");
  }
  const id = trimmedName.toUpperCase().replace(/\s+/g, '_');

  try {
    const existingRoles = await getRoles();
    const duplicate = existingRoles.find(r => r.id === id || r.name.toLowerCase() === trimmedName.toLowerCase());
    if (duplicate) {
      throw new Error(`Role "${duplicate.name}" already exists.`);
    }

    const maxPriority = existingRoles.reduce((max, r) => Math.max(max, r.priority || 0), -1);

    const createdAt = new Date().toISOString();
    const roleData = {
      id,
      name: trimmedName.toUpperCase(),
      color: color || "#6b7280",
      isDefault: false,
      priority: maxPriority + 1,
      createdAt
    };

    await query(
      `INSERT INTO ${ROLES_TABLE} (id, name, color, is_default, priority, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
      [roleData.id, roleData.name, roleData.color, 0, roleData.priority]
    );

    return roleData as UserRoleDefinition;
  } catch (error: any) {
    console.error("Error adding custom role to MySQL:", error);
    if (error?.code === 'ER_DUP_ENTRY') {
      throw new Error(`Role "${trimmedName.toUpperCase()}" already exists in the database.`);
    }
    throw error;
  }
};

export const updateCustomRole = async (id: string, name: string, color: string): Promise<boolean> => {
  await guard();
  const trimmedName = name.trim();
  if (!id || !trimmedName) {
    throw new Error("Invalid role details provided.");
  }
  try {
    const existingRoles = await getRoles();
    const duplicate = existingRoles.find(r => r.id !== id && r.name.toLowerCase() === trimmedName.toLowerCase());
    if (duplicate) {
      throw new Error(`Another role named "${duplicate.name}" already exists.`);
    }

    await query(
      `UPDATE ${ROLES_TABLE} SET name = ?, color = ? WHERE id = ?`,
      [trimmedName.toUpperCase(), color || "#6b7280", id]
    );
    return true;
  } catch (error) {
    console.error(`Error updating role ${id} in MySQL:`, error);
    throw error;
  }
};

export const deleteCustomRole = async (id: string): Promise<boolean> => {
  await guard();
  if (!id) {
    throw new Error("No role ID provided for deletion.");
  }
  try {
    // Prevent deleting default roles
    const results = await query<any[]>(`SELECT is_default FROM ${ROLES_TABLE} WHERE id = ?`, [id]);
    if (results.length > 0 && results[0].is_default) {
      throw new Error("Default system roles cannot be deleted.");
    }

    await query(`DELETE FROM ${ROLES_TABLE} WHERE id = ?`, [id]);
    return true;
  } catch (error) {
    console.error(`Error deleting role ${id} from MySQL:`, error);
    throw error;
  }
};

export const updateRolesOrder = async (roleIds: string[]): Promise<boolean> => {
  await guard();
  try {
    for (let i = 0; i < roleIds.length; i++) {
      await query(`UPDATE ${ROLES_TABLE} SET priority = ? WHERE id = ?`, [i, roleIds[i]]);
    }
    return true;
  } catch (error) {
    console.error("Error updating roles priority order in MySQL:", error);
    throw error;
  }
};

