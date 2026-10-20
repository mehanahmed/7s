
"use server";

import type { Lead, LeadStatusType } from '@/types';
import { query } from './mysql';
import { v4 as uuidv4 } from 'uuid';
import { guard } from '@/lib/guard';

const LEADS_TABLE = 'leads';

const addTemperatureCondition = (conditions: string[], params: any[], temperature?: string) => {
  if (!temperature || temperature === 'all') return;
  conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.temperature')) = ?`);
  params.push(String(Number(temperature)));
};

export const getLeads = async (
  startDate?: string,
  endDate?: string,
  role?: string,
  userId?: string,
  category?: string,
  activity?: string,
  searchTerm?: string,
  temperature?: string
): Promise<Lead[]> => {
  await guard();
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    addTemperatureCondition(conditions, params, temperature);
    if (startDate && endDate) {
      conditions.push(`(
        (JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.date')) >= ? AND JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.date')) <= ?)
        OR
        (JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.categoryUpdatedAt')) >= ? AND JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.categoryUpdatedAt')) <= ?)
      )`);
      params.push(startDate, endDate, startDate, endDate);
    } else {
      if (startDate) {
        conditions.push(`(JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.date')) >= ? OR JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.categoryUpdatedAt')) >= ?)`);
        params.push(startDate, startDate);
      }
      if (endDate) {
        conditions.push(`(JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.date')) <= ? OR JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.categoryUpdatedAt')) <= ?)`);
        params.push(endDate, endDate);
      }
    }
    if ((role === 'CR' && userId) || ((role === 'SYSTEM_ADMIN' || role === 'ADMIN') && userId && userId !== 'all')) {
      conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.crmId')) = ?`);
      params.push(userId);
    }
    if (category && category !== 'all') {
      conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.category')) = ?`);
      params.push(category);
    }
    if (activity && activity !== 'all') {
      conditions.push(`LOWER(data_json) LIKE LOWER(?)`);
      params.push(`%${activity}%`);
    }
    if (searchTerm) {
      conditions.push(`LOWER(data_json) LIKE LOWER(?)`);
      params.push(`%${searchTerm}%`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query<any[]>(`SELECT id, data_json FROM ${LEADS_TABLE} ${whereClause} ORDER BY COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.categoryUpdatedAt')), ''), JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.date'))) DESC`, params);
    return rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as Lead)).sort((a, b) => new Date(b.categoryUpdatedAt || b.date).getTime() - new Date(a.categoryUpdatedAt || a.date).getTime());
  } catch (error) {
    console.error(`Error fetching leads from MySQL:`, error);
    return [];
  }
};

export const getLeadById = async (leadId: string): Promise<Lead | null> => {
  await guard();
  if (!leadId) return null;
  try {
    const rows = await query<any[]>(`SELECT id, data_json FROM ${LEADS_TABLE} WHERE id = ?`, [leadId]);
    if (rows.length > 0) {
      return { id: rows[0].id, ...(typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json) } as Lead;
    }
  } catch (error) {
    console.error(`Error fetching lead ${leadId} from MySQL:`, error);
  }
  return null;
};

export const getLeadByPhone = async (phone: string): Promise<Lead | null> => {
  await guard();
  if (!phone) return null;
  try {
    const rows = await query<any[]>(`SELECT id, data_json FROM ${LEADS_TABLE} WHERE phone = ?`, [phone]);
    if (rows.length > 0) {
      return { id: rows[0].id, ...(typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json) } as Lead;
    }
  } catch (error) {
    console.error(`Error fetching lead by phone ${phone} from MySQL:`, error);
  }
  return null;
};

export const addLead = async (leadData: Omit<Lead, 'id'>): Promise<Lead | null> => {
  await guard();
  try {
    const id = uuidv4();
    const dataWithStatus = {
      ...leadData,
      status: 'New Lead' as LeadStatusType,
      customerType: leadData.customerType || null,
    };

    await query(`INSERT INTO ${LEADS_TABLE} (id, business_name, contact_name, phone, status, crm_id, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, dataWithStatus.businessName || null, dataWithStatus.contactName || null, dataWithStatus.phone || null, dataWithStatus.status || null, dataWithStatus.crmId || null, JSON.stringify(dataWithStatus)]);

    return { id, ...dataWithStatus } as Lead;
  } catch (error) {
    console.error("Error adding lead to MySQL:", error);
    return null;
  }
};

export const updateLead = async (leadId: string, updates: Partial<Omit<Lead, 'id'>>): Promise<boolean> => {
  await guard();
  try {
    const existingLead = await getLeadById(leadId);
    if (!existingLead) throw new Error("Lead to update not found.");

    const finalData = { ...existingLead, ...updates };
    const id = finalData.id;
    delete (finalData as any).id;

    await query(`UPDATE ${LEADS_TABLE} SET business_name = ?, contact_name = ?, phone = ?, status = ?, crm_id = ?, data_json = ? WHERE id = ?`,
      [finalData.businessName || null, finalData.contactName || null, finalData.phone || null, finalData.status || null, finalData.crmId || null, JSON.stringify(finalData), id]);

    return true;
  } catch (error) {
    console.error(`Error updating lead ${leadId} in MySQL:`, error);
    return false;
  }
};

export const deleteLead = async (leadId: string): Promise<boolean> => {
  await guard();
  try {
    await query(`DELETE FROM ${LEADS_TABLE} WHERE id = ?`, [leadId]);
    return true;
  } catch (error) {
    console.error(`Error deleting lead ${leadId} from MySQL:`, error);
    return false;
  }
};

export const getLeadsPaginated = async (
  page: number = 1,
  limit: number = 10,
  startDate?: string,
  endDate?: string,
  role?: string,
  userId?: string,
  category?: string,
  activity?: string,
  searchTerm?: string,
  temperature?: string
): Promise<{ leads: Lead[]; total: number }> => {
  await guard();
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    addTemperatureCondition(conditions, params, temperature);
    if (startDate && endDate) {
      conditions.push(`(
        (JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.date')) >= ? AND JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.date')) <= ?)
        OR
        (JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.categoryUpdatedAt')) >= ? AND JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.categoryUpdatedAt')) <= ?)
      )`);
      params.push(startDate, endDate, startDate, endDate);
    } else {
      if (startDate) {
        conditions.push(`(JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.date')) >= ? OR JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.categoryUpdatedAt')) >= ?)`);
        params.push(startDate, startDate);
      }
      if (endDate) {
        conditions.push(`(JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.date')) <= ? OR JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.categoryUpdatedAt')) <= ?)`);
        params.push(endDate, endDate);
      }
    }
    if ((role === 'CR' && userId) || ((role === 'SYSTEM_ADMIN' || role === 'ADMIN') && userId && userId !== 'all')) {
      conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.crmId')) = ?`);
      params.push(userId);
    }
    if (category && category !== 'all') {
      conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.category')) = ?`);
      params.push(category);
    }
    if (activity && activity !== 'all') {
      conditions.push(`LOWER(data_json) LIKE LOWER(?)`);
      params.push(`%${activity}%`);
    }
    if (searchTerm) {
      conditions.push(`LOWER(data_json) LIKE ?`);
      params.push(`%${searchTerm.toLowerCase()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM ${LEADS_TABLE} ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const offset = Math.max(0, (page - 1) * limit);
    const rows = await query<any[]>(
      `SELECT id, data_json FROM ${LEADS_TABLE} ${whereClause} ORDER BY COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.categoryUpdatedAt')), ''), JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.date'))) DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const leads = rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as Lead)).sort((a, b) => new Date(b.categoryUpdatedAt || b.date).getTime() - new Date(a.categoryUpdatedAt || a.date).getTime());

    return { leads, total };
  } catch (error) {
    console.error(`Error fetching paginated leads from MySQL:`, error);
    return { leads: [], total: 0 };
  }
};

export const getEventsPaginated = async (
  page: number = 1,
  limit: number = 10,
  startDate?: string,
  endDate?: string,
  role?: string,
  userId?: string,
  searchTerm?: string,
  scheduleStart?: string,
  scheduleEnd?: string
): Promise<{ leads: Lead[]; total: number }> => {
  await guard();
  try {
    const conditions: string[] = [
      `JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.schedule')) IS NOT NULL`,
      `JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.schedule')) != 'null'`,
      `JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.schedule')) != ''`
    ];
    const params: any[] = [];

    if (startDate && endDate) {
      conditions.push(`(
        (JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.date')) >= ? AND JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.date')) <= ?)
        OR
        (JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.categoryUpdatedAt')) >= ? AND JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.categoryUpdatedAt')) <= ?)
      )`);
      params.push(startDate, endDate, startDate, endDate);
    } else {
      if (startDate) {
        conditions.push(`(JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.date')) >= ? OR JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.categoryUpdatedAt')) >= ?)`);
        params.push(startDate, startDate);
      }
      if (endDate) {
        conditions.push(`(JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.date')) <= ? OR JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.categoryUpdatedAt')) <= ?)`);
        params.push(endDate, endDate);
      }
    }
    
    if (scheduleStart) {
      conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.schedule')) >= ?`);
      params.push(scheduleStart);
    }
    if (scheduleEnd) {
      conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.schedule')) <= ?`);
      params.push(scheduleEnd);
    }

    if ((role === 'CR' && userId) || ((role === 'SYSTEM_ADMIN' || role === 'ADMIN') && userId && userId !== 'all')) {
      conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.crmId')) = ?`);
      params.push(userId);
    }
    
    if (searchTerm) {
      conditions.push(`LOWER(data_json) LIKE LOWER(?)`);
      params.push(`%${searchTerm}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM ${LEADS_TABLE} ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const offset = Math.max(0, (page - 1) * limit);
    const rows = await query<any[]>(
      `SELECT id, data_json FROM ${LEADS_TABLE} ${whereClause} ORDER BY JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.schedule')) ASC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const leads = rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as Lead)).sort((a, b) => {
      if (!a.schedule || !b.schedule) return 0;
      return new Date(a.schedule).getTime() - new Date(b.schedule).getTime();
    });

    return { leads, total };
  } catch (error) {
    console.error(`Error fetching paginated events from MySQL:`, error);
    return { leads: [], total: 0 };
  }
};

export const getUniqueLeadCrmIds = async (): Promise<Array<{ crmId: string; crmName: string }>> => {
  await guard();
  try {
    const rows = await query<any[]>(`SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.crmId')) as crmId, JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.crmName')) as crmName FROM ${LEADS_TABLE}`);
    return rows
      .filter(r => r.crmId && r.crmId !== 'null')
      .map(r => ({ crmId: r.crmId as string, crmName: (r.crmName || '') as string }));
  } catch (error) {
    console.error(`Error fetching unique CR IDs from leads:`, error);
    return [];
  }
};
