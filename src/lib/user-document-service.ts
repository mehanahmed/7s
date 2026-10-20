"use server";

import { query } from './mysql';
import { v4 as uuidv4 } from 'uuid';
import { guard } from '@/lib/guard';

export interface UserDocument {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  uploaded_at: string;
}

const DOCUMENTS_TABLE = 'user_documents';

export const initDocumentsTable = async () => {
  await guard();
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS ${DOCUMENTS_TABLE} (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50),
        file_name VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        file_size INT NOT NULL,
        file_type VARCHAR(100) DEFAULT 'application/pdf',
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  } catch (error) {
    console.error("Error creating user_documents table:", error);
  }
};

export const getUserDocuments = async (userId: string): Promise<UserDocument[]> => {
  await guard();
  try {
    await initDocumentsTable();
    const results = await query<any[]>(`SELECT * FROM ${DOCUMENTS_TABLE} WHERE user_id = ? ORDER BY uploaded_at DESC`, [userId]);
    return results.map(row => ({
      ...row,
      uploaded_at: row.uploaded_at instanceof Date ? row.uploaded_at.toISOString() : new Date(row.uploaded_at).toISOString()
    } as UserDocument));
  } catch (error) {
    console.error(`Error fetching documents for user ${userId}:`, error);
    return [];
  }
};

export const addUserDocument = async (userId: string, doc: Omit<UserDocument, 'id' | 'user_id' | 'uploaded_at'>): Promise<UserDocument | null> => {
  await guard();
  try {
    await initDocumentsTable();
    const id = uuidv4();
    await query(
      `INSERT INTO ${DOCUMENTS_TABLE} (id, user_id, file_name, file_url, file_size, file_type) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, doc.file_name, doc.file_url, doc.file_size, doc.file_type]
    );
    return { id, user_id: userId, ...doc, uploaded_at: new Date().toISOString() };
  } catch (error) {
    console.error(`Error adding document for user ${userId}:`, error);
    return null;
  }
};

export const deleteUserDocument = async (id: string): Promise<boolean> => {
  await guard();
  try {
    await initDocumentsTable();
    await query(`DELETE FROM ${DOCUMENTS_TABLE} WHERE id = ?`, [id]);
    return true;
  } catch (error) {
    console.error(`Error deleting document ${id}:`, error);
    return false;
  }
};

export const clearUserDocuments = async (userId: string): Promise<boolean> => {
  await guard();
    try {
      await initDocumentsTable();
      await query(`DELETE FROM ${DOCUMENTS_TABLE} WHERE user_id = ?`, [userId]);
      return true;
    } catch (error) {
      console.error(`Error clearing documents for user ${userId}:`, error);
      return false;
    }
  };

export const getLatestUserDocument = async (userId: string): Promise<UserDocument | null> => {
  await guard();
  try {
    await initDocumentsTable();
    const results = await query<any[]>(`SELECT * FROM ${DOCUMENTS_TABLE} WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT 1`, [userId]);
    if (results.length > 0) {
      const row = results[0];
      return {
        ...row,
        uploaded_at: row.uploaded_at instanceof Date ? row.uploaded_at.toISOString() : new Date(row.uploaded_at).toISOString()
      } as UserDocument;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching latest document for user ${userId}:`, error);
    return null;
  }
};

export const getSubmittedUserIds = async (): Promise<string[]> => {
  await guard();
  try {
    await initDocumentsTable();
    const results = await query<any[]>(`SELECT DISTINCT user_id FROM ${DOCUMENTS_TABLE}`);
    return results.map(row => row.user_id);
  } catch (error) {
    console.error("Error fetching submitted user IDs:", error);
    return [];
  }
};
