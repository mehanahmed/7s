
"use server";

import { query } from './mysql';
import type { ProvidentFundRecord } from '@/types';

const TABLE_NAME = 'provident_fund';

/**
 * Fetches all provident fund records, optionally filtered by employee ID.
 * @param employeeId Optional ID to filter records by.
 * @returns A list of provident fund records.
 */
export const getProvidentFundRecords = async (employeeId?: string): Promise<ProvidentFundRecord[]> => {
  try {
    let sql = `SELECT id, data_json FROM ${TABLE_NAME}`;
    let params: any[] = [];

    // In MySQL version, we might fetch all and filter in JS if the schema is JSON-based, 
    // or use JSON_EXTRACT if we want to filter in SQL. 
    // Given the current pattern, let's fetch and filter in JS for consistency with the JSON blob strategy.

    const rows = await query<any[]>(sql, params);
    const records = rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as ProvidentFundRecord));

    if (employeeId) {
      return records.filter(r => r.employeeId === employeeId);
    }
    return records;
  } catch (error) {
    console.error("Error fetching Provident Fund records from MySQL:", error);
    return [];
  }
};

/**
 * Adds or updates a provident fund record.
 * @param record The record to save.
 * @returns True if successful, false otherwise.
 */
export const updateProvidentFundRecord = async (record: ProvidentFundRecord): Promise<boolean> => {
  try {
    const docId = record.id;
    await query(
      `INSERT INTO ${TABLE_NAME} (id, data_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE data_json = VALUES(data_json)`,
      [docId, JSON.stringify(record)]
    );
    return true;
  } catch (error) {
    console.error(`Error updating Provident Fund record ${record.id} in MySQL:`, error);
    return false;
  }
};

/**
 * Deletes a provident fund record.
 * @param id The ID of the record to delete.
 * @returns True if successful, false otherwise.
 */
export const deleteProvidentFundRecord = async (id: string): Promise<boolean> => {
  try {
    await query(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
    return true;
  } catch (error) {
    console.error(`Error deleting Provident Fund record ${id} from MySQL:`, error);
    return false;
  }
};
