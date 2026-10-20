
"use server";

import { query } from './mysql';
import type { UserRole } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { guard } from '@/lib/guard';

const TABLE_NAME = 'dialogue';

export interface Faq {
  id: string;
  question: string;
  answer: string;
  role: UserRole | 'ALL';
  createdAt: string; // ISO string
}

export const getFaqs = async (): Promise<Faq[]> => {
  await guard();
  try {
    const rows = await query<any[]>(`SELECT id, data_json FROM ${TABLE_NAME}`);
    return rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as Faq)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Error fetching FAQs from MySQL:", error);
    return [];
  }
};

export const addFaq = async (faqData: Omit<Faq, 'id' | 'createdAt'>): Promise<Faq | null> => {
  await guard();
  try {
    const id = uuidv4();
    const dataWithTimestamp: Faq = {
      ...faqData,
      id,
      createdAt: new Date().toISOString(),
    } as Faq;

    await query(`INSERT INTO ${TABLE_NAME} (id, data_json) VALUES (?, ?)`, [id, JSON.stringify(dataWithTimestamp)]);
    return dataWithTimestamp;
  } catch (error) {
    console.error("Error adding FAQ to MySQL:", error);
    if (error instanceof Error) throw error;
    return null;
  }
};

export const updateFaq = async (faqId: string, updates: Partial<Omit<Faq, 'id' | 'createdAt'>>): Promise<boolean> => {
  await guard();
  try {
    const rows = await query<any[]>(`SELECT data_json FROM ${TABLE_NAME} WHERE id = ?`, [faqId]);
    if (rows.length === 0) return false;

    const existingData = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json;
    const finalData = { ...existingData, ...updates };

    await query(`UPDATE ${TABLE_NAME} SET data_json = ? WHERE id = ?`, [JSON.stringify(finalData), faqId]);
    return true;
  } catch (error) {
    console.error(`Error updating FAQ ${faqId} in MySQL:`, error);
    return false;
  }
};

export const deleteFaq = async (faqId: string): Promise<boolean> => {
  await guard();
  try {
    await query(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [faqId]);
    return true;
  } catch (error) {
    console.error(`Error deleting FAQ ${faqId} from MySQL:`, error);
    return false;
  }
};
