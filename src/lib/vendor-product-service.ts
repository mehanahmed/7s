"use server";

import { query } from './mysql';
import type { VendorProduct } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { guard } from '@/lib/guard';

const VENDOR_PRODUCTS_TABLE = 'vendor_products';

export const initVendorProductsTable = async () => {
  await guard();
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS ${VENDOR_PRODUCTS_TABLE} (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(255),
        price DECIMAL(15, 2) DEFAULT 0,
        description TEXT
      )
    `);
  } catch (error) {
    console.error("Error creating vendor_products table:", error);
  }
};

export const getVendorProducts = async (): Promise<VendorProduct[]> => {
  await guard();
  try {
    await initVendorProductsTable();
    const results = await query<any[]>(`SELECT * FROM ${VENDOR_PRODUCTS_TABLE} ORDER BY name ASC`);
    return results.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      price: row.price,
      description: row.description
    } as VendorProduct));
  } catch (error) {
    console.error("Error fetching vendor products from MySQL:", error);
    return [];
  }
};

export const addVendorProduct = async (productData: Omit<VendorProduct, 'id'>): Promise<VendorProduct | null> => {
  await guard();
  try {
    await initVendorProductsTable();
    const id = uuidv4();
    await query(
      `INSERT INTO ${VENDOR_PRODUCTS_TABLE} (id, name, category, price, description) VALUES (?, ?, ?, ?, ?)`,
      [id, productData.name, productData.category, productData.price || 0, productData.description || '']
    );
    return { id, ...productData } as VendorProduct;
  } catch (error) {
    console.error("Error adding vendor product to MySQL:", error);
    return null;
  }
};

export const updateVendorProduct = async (id: string, updates: Partial<VendorProduct>): Promise<boolean> => {
  await guard();
  try {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category); }
    if (updates.price !== undefined) { fields.push('price = ?'); values.push(updates.price); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }

    if (fields.length === 0) return true;

    values.push(id);
    await query(`UPDATE ${VENDOR_PRODUCTS_TABLE} SET ${fields.join(', ')} WHERE id = ?`, values);
    return true;
  } catch (error) {
    console.error(`Error updating vendor product ${id} from MySQL:`, error);
    return false;
  }
};

export const deleteVendorProduct = async (id: string): Promise<boolean> => {
  await guard();
  try {
    await query(`DELETE FROM ${VENDOR_PRODUCTS_TABLE} WHERE id = ?`, [id]);
    return true;
  } catch (error) {
    console.error(`Error deleting vendor product ${id} from MySQL:`, error);
    return false;
  }
};
