
"use server";

import type { Dr2oEntry } from '@/types';
import { query } from './mysql';
import { guard } from '@/lib/guard';

const TABLE_NAME = 'workflow_entries';

export const getDr2oEntries = async (team: 'CR' | 'DR' | 'LR' | 'CO' = 'CR'): Promise<Dr2oEntry[]> => {
  await guard();
  try {
    const rows = await query<any[]>(`SELECT id, data_json FROM ${TABLE_NAME} WHERE team = ? ORDER BY id DESC`, [team]);
    return rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json),
    } as Dr2oEntry));
  } catch (error) {
    console.error(`Error fetching DR 2.O entries for ${team} from MySQL:`, error);
    return [];
  }
};

export const addDr2oEntry = async (entryData: Omit<Dr2oEntry, 'id'>, team: 'CR' | 'DR' | 'LR' | 'CO' = 'CR'): Promise<Dr2oEntry | null> => {
  await guard();
  try {
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    const dataWithId = { ...entryData, id };

    await query(`INSERT INTO ${TABLE_NAME} (id, team, data_json) VALUES (?, ?, ?)`,
      [id, team, JSON.stringify(dataWithId)]);

    return dataWithId as Dr2oEntry;
  } catch (error) {
    console.error(`Error adding DR 2.O entry to team ${team} in MySQL:`, error);
    if (error instanceof Error) throw error;
    return null;
  }
};

export const updateDr2oEntry = async (id: string, updates: Partial<Dr2oEntry>, team: 'CR' | 'DR' | 'LR' | 'CO' = 'CR'): Promise<boolean> => {
  await guard();
  try {
    const rows = await query<any[]>(`SELECT data_json FROM ${TABLE_NAME} WHERE id = ? AND team = ?`, [id, team]);
    if (rows.length === 0) return false;

    const existingData = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json;
    const finalData = { ...existingData, ...updates };

    await query(`UPDATE ${TABLE_NAME} SET data_json = ? WHERE id = ? AND team = ?`,
      [JSON.stringify(finalData), id, team]);
    return true;
  } catch (error) {
    console.error(`Error updating DR 2.O entry ${id} in MySQL:`, error);
    return false;
  }
};

export const deleteDr2oEntry = async (id: string, team: 'CR' | 'DR' | 'LR' | 'CO'): Promise<boolean> => {
  await guard();
  try {
    await query(`DELETE FROM ${TABLE_NAME} WHERE id = ? AND team = ?`, [id, team]);
    return true;
  } catch (error) {
    console.error(`Error deleting entry ${id} from MySQL:`, error);
    return false;
  }
};
