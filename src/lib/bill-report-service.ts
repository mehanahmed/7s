

"use server";
import { query } from './mysql';
import type { BillReport } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { guard } from '@/lib/guard';

const BILL_REPORTS_TABLE = 'bill_reports';

export const initBillReportsTable = async () => {
  await guard();
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS ${BILL_REPORTS_TABLE} (
        id VARCHAR(255) PRIMARY KEY,
        vendor_id VARCHAR(255) NOT NULL,
        vendor_name VARCHAR(255) NOT NULL,
        amount DECIMAL(15, 2) DEFAULT 0,
        payment DECIMAL(15, 2) DEFAULT 0,
        method VARCHAR(255),
        date DATETIME NOT NULL,
        invoice_id VARCHAR(255),
        status VARCHAR(255),
        notes TEXT
      )
    `);
  } catch (error) {
    console.error("Error creating bill_reports table:", error);
  }
};

export const getBillReports = async (): Promise<BillReport[]> => {
  await guard();
  try {
    await initBillReportsTable();
    const results = await query<any[]>(`SELECT * FROM ${BILL_REPORTS_TABLE} ORDER BY date DESC`);
    return results.map(row => ({
      id: row.id,
      vendorId: row.vendor_id,
      vendorName: row.vendor_name,
      amount: Number(row.amount) || 0,
      payment: Number(row.payment) || 0,
      method: row.method,
      date: row.date,
      invoiceId: row.invoice_id
    } as BillReport));
  } catch (error) {
    console.error("Error fetching bill reports from MySQL:", error);
    return [];
  }
};

export const addBillReport = async (reportData: Omit<BillReport, 'id'>): Promise<BillReport | null> => {
  await guard();
  try {
    await initBillReportsTable();
    const id = uuidv4();
    const parsedDate = new Date(reportData.date);
    const formattedDate = isNaN(parsedDate.getTime()) ? format(new Date(), 'yyyy-MM-dd HH:mm:ss') : format(parsedDate, 'yyyy-MM-dd HH:mm:ss');

    await query(
      `INSERT INTO ${BILL_REPORTS_TABLE} (id, vendor_id, vendor_name, amount, payment, method, date, invoice_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, reportData.vendorId, reportData.vendorName, reportData.amount || 0, reportData.payment || 0, reportData.method, formattedDate, reportData.invoiceId]
    );

    return { id, ...reportData } as BillReport;
  } catch (error) {
    console.error("Error adding bill report to MySQL:", error);
    return null;
  }
};

export const updateBillReport = async (id: string, updates: Partial<BillReport>): Promise<boolean> => {
  await guard();
  try {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.vendorId !== undefined) { fields.push('vendor_id = ?'); values.push(updates.vendorId); }
    if (updates.vendorName !== undefined) { fields.push('vendor_name = ?'); values.push(updates.vendorName); }
    if (updates.amount !== undefined) { fields.push('amount = ?'); values.push(updates.amount); }
    if (updates.payment !== undefined) { fields.push('payment = ?'); values.push(updates.payment); }
    if (updates.method !== undefined) { fields.push('method = ?'); values.push(updates.method); }
    if (updates.date !== undefined) {
      fields.push('date = ?');
      const parsedDate = new Date(updates.date);
      values.push(isNaN(parsedDate.getTime()) ? format(new Date(), 'yyyy-MM-dd HH:mm:ss') : format(parsedDate, 'yyyy-MM-dd HH:mm:ss'));
    }
    if (updates.invoiceId !== undefined) { fields.push('invoice_id = ?'); values.push(updates.invoiceId); }

    if (fields.length === 0) return true;

    values.push(id);
    await query(`UPDATE ${BILL_REPORTS_TABLE} SET ${fields.join(', ')} WHERE id = ?`, values);
    return true;
  } catch (error) {
    console.error(`Error updating bill report ${id} in MySQL:`, error);
    return false;
  }
};


export const deleteBillReport = async (id: string): Promise<{ success: boolean, error?: string }> => {
  await guard();
  try {
    await query(`DELETE FROM ${BILL_REPORTS_TABLE} WHERE id = ?`, [id]);
    return { success: true };
  } catch (error) {
    console.error(`Error deleting bill report ${id} from MySQL:`, error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
};
