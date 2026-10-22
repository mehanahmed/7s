
"use server";

import { query } from './mysql';

const TABLE_NAME = 'office_locations';

export interface CompanyLocation {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
}

export const getOfficeLocations = async (): Promise<CompanyLocation[]> => {
    try {
        const rows = await query<any[]>(`SELECT id, data_json FROM ${TABLE_NAME}`);
        return rows.map(row => ({
            id: row.id,
            ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
        } as CompanyLocation));
    } catch (error) {
        console.error("Error fetching office locations from MySQL:", error);
        return [];
    }
};

export const addOfficeLocation = async (locationData: Omit<CompanyLocation, 'id'>): Promise<CompanyLocation | null> => {
    try {
        const { v4: uuidv4 } = require('uuid');
        const id = uuidv4();
        const dataWithId = { ...locationData, id };
        await query(`INSERT INTO ${TABLE_NAME} (id, data_json) VALUES (?, ?)`, [id, JSON.stringify(dataWithId)]);
        return dataWithId as CompanyLocation;
    } catch (error) {
        console.error("Error adding office location to MySQL:", error);
        return null;
    }
};

export const updateOfficeLocation = async (id: string, updates: Partial<CompanyLocation>): Promise<boolean> => {
    try {
        const rows = await query<any[]>(`SELECT data_json FROM ${TABLE_NAME} WHERE id = ?`, [id]);
        if (rows.length === 0) return false;

        const existingData = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json;
        const finalData = { ...existingData, ...updates };

        await query(`UPDATE ${TABLE_NAME} SET data_json = ? WHERE id = ?`, [JSON.stringify(finalData), id]);
        return true;
    } catch (error) {
        console.error(`Error updating office location ${id} in MySQL:`, error);
        return false;
    }
};

export const deleteOfficeLocation = async (id: string): Promise<boolean> => {
    try {
        await query(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
        return true;
    } catch (error) {
        console.error(`Error deleting office location ${id} from MySQL:`, error);
        return false;
    }
};
