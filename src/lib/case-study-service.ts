"use server";

import type { CaseStudyMessage } from '@/types';
import { query } from './mysql';
import { v4 as uuidv4 } from 'uuid';
import { guard } from '@/lib/guard';

const TABLE_NAME = 'case_study_messages';

export const getMessages = async (team: 'CR' | 'DR' | 'LR'): Promise<CaseStudyMessage[]> => {
  await guard();
  try {
    const rows = await query<any[]>(`SELECT id, data_json FROM ${TABLE_NAME} WHERE team = ? ORDER BY id ASC`, [team]);
    return rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as CaseStudyMessage)).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch (error) {
    console.error(`Error fetching case study messages for ${team} from MySQL:`, error);
    return [];
  }
};

export const addMessage = async (team: 'CR' | 'DR' | 'LR', messageData: Omit<CaseStudyMessage, 'id' | 'timestamp'>): Promise<CaseStudyMessage | null> => {
  await guard();
  try {
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    const dataWithTimestamp: CaseStudyMessage = {
      ...messageData,
      id,
      timestamp,
    } as CaseStudyMessage;

    await query(`INSERT INTO ${TABLE_NAME} (id, team, data_json) VALUES (?, ?, ?)`,
      [id, team, JSON.stringify(dataWithTimestamp)]);

    return dataWithTimestamp;
  } catch (error) {
    console.error(`Error adding case study message to team ${team} in MySQL:`, error);
    return null;
  }
};

export const deleteMessage = async (team: 'CR' | 'DR' | 'LR', messageId: string): Promise<boolean> => {
  await guard();
  try {
    await query(`DELETE FROM ${TABLE_NAME} WHERE id = ? AND team = ?`, [messageId, team]);
    return true;
  } catch (error) {
    console.error(`Error deleting case study message ${messageId} from MySQL:`, error);
    return false;
  }
};
