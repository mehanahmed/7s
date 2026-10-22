
"use server";

import { query } from './mysql';

const GLOBAL_SETTINGS_TABLE = 'global_settings';
const WEEKEND_SETTINGS_ID = 'weekend';

export interface WeekendSettings {
    days: string[]; // e.g., ["Friday", "Saturday"]
}

export const getWeekendSettings = async (): Promise<WeekendSettings> => {
    try {
        const results = await query<any[]>(`SELECT settings_json FROM ${GLOBAL_SETTINGS_TABLE} WHERE id = ?`, [WEEKEND_SETTINGS_ID]);

        if (results.length > 0) {
            const data = typeof results[0].settings_json === 'string' ? JSON.parse(results[0].settings_json) : results[0].settings_json;
            return { days: data.days || ["Friday", "Saturday"] };
        } else {
            const defaultSettings = { days: ["Friday", "Saturday"] };
            await query(`INSERT INTO ${GLOBAL_SETTINGS_TABLE} (id, settings_json) VALUES (?, ?)`, [WEEKEND_SETTINGS_ID, JSON.stringify(defaultSettings)]);
            return defaultSettings;
        }
    } catch (error) {
        console.error("Error fetching weekend settings from MySQL:", error);
        return { days: ["Friday", "Saturday"] };
    }
};

export const saveWeekendSettings = async (days: string[]): Promise<boolean> => {
    try {
        const payload = { days };
        await query(
            `INSERT INTO ${GLOBAL_SETTINGS_TABLE} (id, settings_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json)`,
            [WEEKEND_SETTINGS_ID, JSON.stringify(payload)]
        );
        return true;
    } catch (error) {
        console.error("Error saving weekend settings to MySQL:", error);
        return false;
    }
};
