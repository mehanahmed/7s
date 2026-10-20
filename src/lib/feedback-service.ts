
"use server";

import { query } from './mysql';
import type { Feedback } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { guard } from '@/lib/guard';

const FEEDBACK_TABLE = 'feedback';

export const getFeedback = async (): Promise<Feedback[]> => {
  await guard();
  try {
    const rows = await query<any[]>(`SELECT id, data_json FROM ${FEEDBACK_TABLE} ORDER BY id DESC`);
    return rows.map(row => {
      const parsed = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json;
      return {
        ...parsed,
        id: parsed.id || row.id // Ensure ID is present from column if missing in JSON
      } as Feedback;
    });
  } catch (error) {
    console.error("Error fetching feedback from MySQL:", error);
    return [];
  }
};

export const getFeedbackForOrder = async (orderId: string): Promise<Feedback[]> => {
  await guard();
  if (!orderId) return [];
  try {
    const rows = await query<any[]>(`SELECT id, data_json FROM ${FEEDBACK_TABLE} WHERE order_id = ?`, [orderId]);
    return rows.map(row => {
      const parsed = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json;
      return {
        ...parsed,
        id: parsed.id || row.id // Ensure ID is present from column if missing in JSON
      } as Feedback;
    });
  } catch (error) {
    console.error(`Error fetching feedback for order ${orderId} from MySQL:`, error);
    return [];
  }
};

export const addFeedback = async (feedbackData: Omit<Feedback, 'id'>): Promise<boolean> => {
  await guard();
  try {
    const id = uuidv4();
    await query(`INSERT INTO ${FEEDBACK_TABLE} (id, order_id, data_json) VALUES (?, ?, ?)`,
      [id, feedbackData.orderId || null, JSON.stringify({ ...feedbackData, id })]);
    return true;
  } catch (error) {
    console.error("Error adding feedback to MySQL:", error);
    return false;
  }
};

export async function deleteFeedbackAction(feedbackId: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  try {
    await query(`DELETE FROM ${FEEDBACK_TABLE} WHERE id = ?`, [feedbackId]);
    return { success: true };
  } catch (error) {
    console.error(`Error deleting feedback ${feedbackId} from MySQL:`, error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unknown error occurred during deletion.' };
  }
}
