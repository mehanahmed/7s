
"use server";

import { query } from './mysql';
import type { UserRole } from '@/types';
import { guard } from '@/lib/guard';

const TASKS_TABLE = 'team_performance_tasks';
const TARGETS_TABLE = 'team_monthly_targets';

export interface TaskEntry {
  id: string;
  date: string;
  userId: string;
  userName: string;
  role: UserRole;
  taskCount: number;
  createdAt: string;
}

export interface MonthlyTargetHistory {
  id: string;
  team: UserRole | 'all';
  month: string;
  target: number;
  achieved: number;
  undone: number;
}

export const getTaskEntries = async (): Promise<TaskEntry[]> => {
  await guard();
  try {
    const rows = await query<any[]>(`SELECT id, data_json FROM ${TASKS_TABLE}`);
    return rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as TaskEntry));
  } catch (error) {
    console.error("Error fetching task entries from MySQL:", error);
    return [];
  }
};

export const addTaskEntry = async (entry: Omit<TaskEntry, 'id' | 'createdAt'>): Promise<TaskEntry | null> => {
  await guard();
  if (!entry.userId || !entry.date) return null;
  const hourKey = entry.date.substring(0, 13).replace(' ', '-');
  const docId = `${entry.userId}-${hourKey}`;
  try {
    const rows = await query<any[]>(`SELECT data_json FROM ${TASKS_TABLE} WHERE id = ?`, [docId]);

    if (rows.length > 0) {
      const existingData = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json;
      const finalData = {
        ...existingData,
        taskCount: (existingData.taskCount || 0) + entry.taskCount,
      };
      await query(`UPDATE ${TASKS_TABLE} SET data_json = ? WHERE id = ?`, [JSON.stringify(finalData), docId]);
      return { id: docId, ...finalData } as TaskEntry;
    } else {
      const dataWithTimestamp = { ...entry, createdAt: new Date().toISOString() };
      await query(`INSERT INTO ${TASKS_TABLE} (id, user_id, date, data_json) VALUES (?, ?, ?, ?)`,
        [docId, entry.userId, entry.date, JSON.stringify(dataWithTimestamp)]);
      return { id: docId, ...dataWithTimestamp } as TaskEntry;
    }
  } catch (error) {
    console.error("Error adding/updating task entry in MySQL:", error);
    return null;
  }
};

export async function updateTaskEntry(
  taskId: string,
  updates: Partial<Omit<TaskEntry, 'id' | 'userId' | 'userName' | 'role' | 'createdAt'>>
): Promise<boolean> {
  await guard();
  try {
    const rows = await query<any[]>(`SELECT data_json FROM ${TASKS_TABLE} WHERE id = ?`, [taskId]);
    if (rows.length === 0) throw new Error(`Task entry ${taskId} not found.`);
    const updatedData = { ...(typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json), ...updates };
    await query(`UPDATE ${TASKS_TABLE} SET data_json = ? WHERE id = ?`, [JSON.stringify(updatedData), taskId]);
    return true;
  } catch (error) {
    console.error(`Error updating task entry ${taskId} in MySQL:`, error);
    return false;
  }
}

export async function deleteTaskEntry(taskId: string): Promise<boolean> {
  await guard();
  try {
    await query(`DELETE FROM ${TASKS_TABLE} WHERE id = ?`, [taskId]);
    return true;
  } catch (error) {
    console.error(`Error deleting task entry ${taskId} from MySQL:`, error);
    return false;
  }
}

export const getMonthlyTargetHistory = async (team: UserRole | 'all'): Promise<MonthlyTargetHistory[]> => {
  await guard();
  try {
    const rows = await query<any[]>(`SELECT data_json FROM ${TARGETS_TABLE} WHERE team = ? ORDER BY month DESC`, [team]);
    return rows.map(row => ({
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as MonthlyTargetHistory));
  } catch (error) {
    console.error(`Error fetching monthly target history for team ${team} from MySQL:`, error);
    return [];
  }
};

export const setMonthlyTargetHistory = async (entry: Omit<MonthlyTargetHistory, 'id'>): Promise<MonthlyTargetHistory | null> => {
  await guard();
  const docId = `${entry.team}-${entry.month}`;
  try {
    await query(`INSERT INTO ${TARGETS_TABLE} (id, team, month, data_json) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE team=VALUES(team), month=VALUES(month), data_json=VALUES(data_json)`,
      [docId, entry.team, entry.month, JSON.stringify({ ...entry, id: docId })]);
    return { id: docId, ...entry };
  } catch (error) {
    console.error("Error setting monthly target history in MySQL:", error);
    return null;
  }
};

export { deleteTaskEntry as deleteTaskEntryFromDb };
