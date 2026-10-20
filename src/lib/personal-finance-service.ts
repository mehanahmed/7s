"use server";

import { query } from './mysql';
import type { Transaction, TransactionType, PersonalNote } from '@/types';
import { format, parseISO } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { guard } from '@/lib/guard';

const FINANCE_TABLE = 'finance_records';
const NOTES_TABLE = 'personal_notes';

export async function addTransaction(
  userId: string,
  transactionData: {
    type: TransactionType;
    amount: number;
    category: string;
    description?: string | null;
    date: string;
    sentToUserId?: string | null;
    sentToUserName?: string | null;
    receivedFromUserId?: string | null;
    receivedFromUserName?: string | null;
    documentUrl?: string | null;
  }
): Promise<Transaction | null> {
  await guard();
  if (!userId) return null;
  try {
    const id = uuidv4();
    const dataWithUser = {
      ...transactionData,
      userId,
      createdAt: new Date().toISOString()
    };

    const mysqlDate = format(parseISO(transactionData.date), 'yyyy-MM-dd HH:mm:ss');

    await query(`INSERT INTO ${FINANCE_TABLE} (id, user_id, date, amount, category, type, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, mysqlDate, transactionData.amount, transactionData.category, transactionData.type, JSON.stringify(dataWithUser)]);

    return { id, ...dataWithUser } as Transaction;
  } catch (error) {
    console.error("Error adding transaction to MySQL:", error);
    return null;
  }
}

export async function getTransactionsForUser(userId: string): Promise<Transaction[]> {
  await guard();
  if (!userId) return [];
  try {
    const rows = await query<any[]>(`SELECT id, data_json FROM ${FINANCE_TABLE} WHERE user_id = ? ORDER BY date DESC`, [userId]);
    return rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as Transaction));
  } catch (error) {
    console.error("Error fetching transactions from MySQL:", error);
    return [];
  }
}

export async function getAllTransactions(startDate?: string, endDate?: string, role?: string, userId?: string): Promise<Transaction[]> {
  await guard();
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    if (startDate) {
      conditions.push(`date >= ?`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`date <= ?`);
      params.push(endDate);
    }
    if (userId && userId !== 'all' && (role !== 'SYSTEM_ADMIN' && role !== 'ADMIN')) {
      conditions.push(`user_id = ?`);
      params.push(userId);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query<any[]>(`SELECT id, data_json FROM ${FINANCE_TABLE} ${whereClause} ORDER BY date DESC`, params);
    return rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as Transaction));
  } catch (error) {
    console.error("Error fetching all transactions from MySQL:", error);
    return [];
  }
}

export async function getTransactionById(transactionId: string): Promise<Transaction | null> {
  await guard();
  try {
    const rows = await query<any[]>(`SELECT data_json FROM ${FINANCE_TABLE} WHERE id = ?`, [transactionId]);
    if (rows.length > 0) {
      return { id: transactionId, ...(typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json) } as Transaction;
    }
    return null;
  } catch (error) {
    console.error("Error fetching transaction from MySQL:", error);
    return null;
  }
}

export async function updateTransaction(
  transactionId: string,
  updates: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>
): Promise<boolean> {
  await guard();
  try {
    const existingDoc = await getTransactionById(transactionId);
    if (!existingDoc) throw new Error("Transaction not found.");

    const updatedData = { ...existingDoc, ...updates };
    const id = updatedData.id;
    delete (updatedData as any).id;

    const mysqlDate = format(parseISO(updatedData.date), 'yyyy-MM-dd HH:mm:ss');

    await query(`UPDATE ${FINANCE_TABLE} SET date = ?, amount = ?, category = ?, type = ?, data_json = ? WHERE id = ?`,
      [mysqlDate, updatedData.amount, updatedData.category, updatedData.type, JSON.stringify(updatedData), id]);

    return true;
  } catch (error) {
    console.error("Error updating transaction in MySQL:", error);
    return false;
  }
}

export async function deleteTransaction(transactionId: string): Promise<boolean> {
  await guard();
  try {
    await query(`DELETE FROM ${FINANCE_TABLE} WHERE id = ?`, [transactionId]);
    return true;
  } catch (error) {
    console.error("Error deleting transaction from MySQL:", error);
    return false;
  }
}

export async function addPersonalNote(
  noteData: Omit<PersonalNote, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PersonalNote | null> {
  await guard();
  try {
    const id = uuidv4();
    const now = new Date().toISOString();
    const dataToSave = { ...noteData, id, createdAt: now, updatedAt: now };

    await query(`INSERT INTO ${NOTES_TABLE} (id, user_id, title, data_json) VALUES (?, ?, ?, ?)`,
      [id, noteData.userId, noteData.title, JSON.stringify(dataToSave)]);

    return dataToSave as PersonalNote;
  } catch (error) {
    console.error("Error adding personal note to MySQL:", error);
    return null;
  }
}

export async function getPersonalNotesForUser(userId: string): Promise<PersonalNote[]> {
  await guard();
  try {
    const rows = await query<any[]>(`SELECT data_json FROM ${NOTES_TABLE} WHERE user_id = ? ORDER BY id DESC`, [userId]);
    return rows.map(row => ({
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as PersonalNote));
  } catch (error) {
    console.error("Error fetching personal notes from MySQL:", error);
    return [];
  }
}

export async function updatePersonalNote(
  noteId: string,
  updates: Partial<Omit<PersonalNote, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> {
  await guard();
  try {
    const rows = await query<any[]>(`SELECT data_json FROM ${NOTES_TABLE} WHERE id = ?`, [noteId]);
    if (rows.length === 0) throw new Error("Note not found.");

    const currentData = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json;
    const updatedData = { ...currentData, ...updates, updatedAt: new Date().toISOString() };

    await query(`UPDATE ${NOTES_TABLE} SET title = ?, data_json = ? WHERE id = ?`,
      [updatedData.title, JSON.stringify(updatedData), noteId]);

    return true;
  } catch (error) {
    console.error("Error updating personal note in MySQL:", error);
    return false;
  }
}

export async function deletePersonalNote(noteId: string, _userIdVerifying: string): Promise<boolean> {
  await guard();
  try {
    await query(`DELETE FROM ${NOTES_TABLE} WHERE id = ?`, [noteId]);
    return true;
  } catch (error) {
    console.error("Error deleting personal note from MySQL:", error);
    return false;
  }
}
