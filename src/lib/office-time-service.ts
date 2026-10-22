
"use server";

import { query } from './mysql';
import type { OfficeTime } from '@/types';

const TABLE_NAME = 'office_times';

export const getOfficeTimes = async (): Promise<OfficeTime[]> => {
    try {
        const rows = await query<any[]>(`SELECT id, data_json FROM ${TABLE_NAME}`);
        return rows.map(row => ({
            id: row.id,
            ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
        } as OfficeTime));
    } catch (error) {
        console.error("Error fetching office times from MySQL:", error);
        return [];
    }
};

export const addOfficeTime = async (officeTimeData: Omit<OfficeTime, 'id'>): Promise<OfficeTime | null> => {
    try {
        const { v4: uuidv4 } = require('uuid');
        const id = uuidv4();
        const dataWithId = {
            ...officeTimeData,
            id,
            applicableRoles: officeTimeData.applicableRoles || 'all'
        };
        await query(`INSERT INTO ${TABLE_NAME} (id, data_json) VALUES (?, ?)`, [id, JSON.stringify(dataWithId)]);
        return dataWithId as OfficeTime;
    } catch (error) {
        console.error("Error adding office time to MySQL:", error);
        return null;
    }
};

export const updateOfficeTime = async (id: string, updates: Partial<OfficeTime>): Promise<boolean> => {
    try {
        const rows = await query<any[]>(`SELECT data_json FROM ${TABLE_NAME} WHERE id = ?`, [id]);
        if (rows.length === 0) return false;

        const existingData = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json;
        const finalData = { ...existingData, ...updates };

        await query(`UPDATE ${TABLE_NAME} SET data_json = ? WHERE id = ?`, [JSON.stringify(finalData), id]);
        return true;
    } catch (error) {
        console.error(`Error updating office time ${id} in MySQL:`, error);
        return false;
    }
};

export const deleteOfficeTime = async (id: string): Promise<boolean> => {
    try {
        await query(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
        return true;
    } catch (error) {
        console.error(`Error deleting office time ${id} from MySQL:`, error);
        return false;
    }
};
