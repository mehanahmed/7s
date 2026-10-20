"use server";

import { query } from './mysql';
import type { VendorCategory } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { guard } from '@/lib/guard';

const VENDOR_CATEGORIES_TABLE = 'vendor_categories';

export const initVendorCategoriesTable = async () => {
  await guard();
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS ${VENDOR_CATEGORIES_TABLE} (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      )
    `);
  } catch (error) {
    console.error("Error creating vendor_categories table:", error);
  }
};

export const getVendorCategories = async (): Promise<VendorCategory[]> => {
  await guard();
  try {
    await initVendorCategoriesTable();
    const results = await query<any[]>(`SELECT * FROM ${VENDOR_CATEGORIES_TABLE} ORDER BY name ASC`);
    return results.map(row => ({
      id: row.id,
      name: row.name
      // add other fields if they exist in type definition, but valid minimal map based on table
    } as VendorCategory));
  } catch (error) {
    console.error("Error fetching vendor categories from MySQL:", error);
    return [];
  }
};

export const addVendorCategory = async (categoryData: Omit<VendorCategory, 'id'>): Promise<VendorCategory | null> => {
  await guard();
  try {
    await initVendorCategoriesTable();
    const id = uuidv4();
    await query(`INSERT INTO ${VENDOR_CATEGORIES_TABLE} (id, name) VALUES (?, ?)`, [id, categoryData.name]);
    return { id, ...categoryData } as VendorCategory;
  } catch (error) {
    console.error("Error adding vendor category to MySQL:", error);
    return null;
  }
};

export const updateVendorCategory = async (id: string, updates: Partial<VendorCategory>): Promise<boolean> => {
  await guard();
  try {
    if (!updates.name) return true; // Nothing to update if name is missing? Or handle generic updates
    await query(`UPDATE ${VENDOR_CATEGORIES_TABLE} SET name = ? WHERE id = ?`, [updates.name, id]);
    return true;
  } catch (error) {
    console.error(`Error updating vendor category ${id} in MySQL:`, error);
    return false;
  }
};

export const deleteVendorCategory = async (id: string): Promise<boolean> => {
  await guard();
  try {
    await query(`DELETE FROM ${VENDOR_CATEGORIES_TABLE} WHERE id = ?`, [id]);
    return true;
  } catch (error) {
    console.error(`Error deleting vendor category ${id} from MySQL:`, error);
    return false;
  }
};
