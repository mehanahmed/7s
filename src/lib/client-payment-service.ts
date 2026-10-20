"use server";

import { query } from './mysql';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { guard } from '@/lib/guard';

const CLIENT_PAYMENTS_TABLE = 'client_payments';

export const initClientPaymentsTable = async () => {
  await guard();
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS ${CLIENT_PAYMENTS_TABLE} (
        id VARCHAR(50) PRIMARY KEY,
        order_id VARCHAR(50) NOT NULL,
        amount DECIMAL(15, 2) DEFAULT 0,
        payment_method VARCHAR(255),
        notes TEXT,
        document_url VARCHAR(500),
        status VARCHAR(50) DEFAULT 'Pending',
        recorded_by_user_id VARCHAR(50),
        recorded_by_user_name VARCHAR(255),
        created_at DATETIME,
        updated_at DATETIME
      )
    `);

    // Check and alter table if columns are missing
    const cols = await query<any[]>(`SHOW COLUMNS FROM ${CLIENT_PAYMENTS_TABLE} LIKE 'recorded_by_user_id'`);
    if (cols.length === 0) {
      await query(`ALTER TABLE ${CLIENT_PAYMENTS_TABLE} ADD COLUMN recorded_by_user_id VARCHAR(50), ADD COLUMN recorded_by_user_name VARCHAR(255)`);
    }
  } catch (error) {
    console.error("Error creating client_payments table:", error);
  }
};

export const addClientPayment = async (paymentData: {
  orderId: string;
  amount: number;
  paymentMethod: string;
  notes: string;
  documentUrl?: string | null;
  recordedByUserId?: string | null;
  recordedByUserName?: string | null;
}) => {
  await guard();
  try {
    await initClientPaymentsTable();
    const id = uuidv4();
    const createdAt = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const updatedAt = createdAt;

    await query(
      `INSERT INTO ${CLIENT_PAYMENTS_TABLE} (id, order_id, amount, payment_method, notes, document_url, status, recorded_by_user_id, recorded_by_user_name, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        paymentData.orderId,
        paymentData.amount,
        paymentData.paymentMethod,
        paymentData.notes,
        paymentData.documentUrl || null,
        'Pending',
        paymentData.recordedByUserId || 'client-proof',
        paymentData.recordedByUserName || 'Client',
        createdAt,
        updatedAt
      ]
    );

    return { id, ...paymentData, status: 'Pending', createdAt, updatedAt };
  } catch (error) {
    console.error("Error adding client payment to MySQL:", error);
    throw error;
  }
};

export const getClientPayments = async (orderId: string): Promise<any[]> => {
  await guard();
  try {
    await initClientPaymentsTable();
    const results = await query<any[]>(
      `SELECT * FROM ${CLIENT_PAYMENTS_TABLE} WHERE order_id = ? ORDER BY created_at DESC`,
      [orderId]
    );
    return results.map(row => ({
      id: row.id,
      orderId: row.order_id,
      amount: Number(row.amount),
      paymentMethod: row.payment_method,
      notes: row.notes,
      documentUrl: row.document_url,
      status: row.status,
      recordedByUserId: row.recorded_by_user_id,
      recordedByUserName: row.recorded_by_user_name,
      createdAt: row.created_at ? (row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)) : null,
      updatedAt: row.updated_at ? (row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at)) : null
    }));
  } catch (error) {
    console.error("Error fetching client payments:", error);
    return [];
  }
};

export const deleteClientPayment = async (id: string): Promise<boolean> => {
  await guard();
  try {
    await query(`DELETE FROM ${CLIENT_PAYMENTS_TABLE} WHERE id = ?`, [id]);
    return true;
  } catch (error) {
    console.error("Error deleting client payment:", error);
    return false;
  }
};

export const deleteClientPaymentsBatch = async (ids: string[]): Promise<boolean> => {
  await guard();
  if (ids.length === 0) return true;
  try {
    const placeholders = ids.map(() => '?').join(',');
    await query(`DELETE FROM ${CLIENT_PAYMENTS_TABLE} WHERE id IN (${placeholders})`, ids);
    return true;
  } catch (error) {
    console.error("Error batch deleting client payments:", error);
    return false;
  }
};
