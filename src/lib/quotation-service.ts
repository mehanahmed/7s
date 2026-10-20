"use server";

import type { TrackingLink, OrderLogEntry, OrderItem, AdvancePaymentRecord } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { query } from './mysql';
import { parseISO } from 'date-fns';
import { guard } from '@/lib/guard';
import { isDrRole } from '@/lib/roles';

const QUOTATIONS_TABLE = 'quotations';

const ensureQuotationsTableExists = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS ${QUOTATIONS_TABLE} (
        id VARCHAR(255) PRIMARY KEY,
        data_json LONGTEXT,
        is_deleted TINYINT(1) DEFAULT 0,
        deleted_at DATETIME NULL,
        deleted_by_id VARCHAR(255) NULL,
        deleted_by_name VARCHAR(255) NULL
      )
    `);
  } catch (error) {
    console.error(`Error ensuring table '${QUOTATIONS_TABLE}' exists:`, error);
  }
};
ensureQuotationsTableExists();

export const getQuotations = async (searchTerm?: string): Promise<TrackingLink[]> => {
  await guard();
  try {
    let queryStr = `SELECT id, data_json FROM ${QUOTATIONS_TABLE} WHERE is_deleted = FALSE`;
    const params: any[] = [];
    if (searchTerm) {
      queryStr += ` AND data_json LIKE ?`;
      params.push(`%${searchTerm}%`);
    }
    queryStr += ` ORDER BY id DESC`;
    const rows = await query<any[]>(queryStr, params);
    return rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as TrackingLink)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Error fetching quotations from MySQL:", error);
    return [];
  }
};

export const getQuotationById = async (id: string): Promise<TrackingLink | undefined> => {
  await guard();
  if (!id) return undefined;
  try {
    const rows = await query<any[]>(`SELECT id, data_json FROM ${QUOTATIONS_TABLE} WHERE id = ? AND is_deleted = FALSE`, [id]);
    if (rows.length > 0) {
      return { id: rows[0].id, ...(typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json) } as TrackingLink;
    }
  } catch (error) {
    console.error("Error fetching quotation by ID from MySQL:", error);
  }
  return undefined;
};

export const addQuotation = async (quotationData: {
  companyName: string;
  address: string;
  phoneNumber: string;
  orderItems: OrderItem[];
  advancePaymentAmount?: number | null;
  specialClientDiscount?: number | null;
  shippingCharge?: number | null;
  advancePaymentMethod?: string | null;
  advancePaymentDocumentUrl?: string | null;
  vatPercentage?: number | null;
  orderNotes?: string | null;
  initialStatusId: string;
  crmUserId: string;
  crmUserName: string;
  createdAt: string;
}): Promise<TrackingLink | null> => {
  await guard();
  const transactionTime = new Date().toISOString();

  try {
    let finalCreatedAt = quotationData.createdAt;
    try {
      const parsedDate = parseISO(quotationData.createdAt);
      if (!isNaN(parsedDate.getTime())) {
        finalCreatedAt = parsedDate.toISOString();
      } else {
        finalCreatedAt = new Date().toISOString();
      }
    } catch (e) {
      finalCreatedAt = new Date().toISOString();
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const quotationPrefix = `Q${currentYear}${currentMonth}`;

    const existingRows = await query<any[]>(`SELECT id FROM ${QUOTATIONS_TABLE} WHERE id LIKE ?`, [`${quotationPrefix}%`]);
    let maxSequence = 0;
    if (existingRows && existingRows.length > 0) {
      maxSequence = existingRows
        .map(row => row.id)
        .map(id => parseInt(id.substring(quotationPrefix.length), 10))
        .filter(num => !isNaN(num))
        .reduce((max, current) => (current > max ? current : max), 0);
    }
    let newSequence = maxSequence + 1;
    let quotationId = `${quotationPrefix}${String(newSequence).padStart(2, '0')}`;

    let collisionChecks = 0;
    while (collisionChecks < 100) {
      const collisionRow = await query<any[]>(`SELECT id FROM ${QUOTATIONS_TABLE} WHERE id = ?`, [quotationId]);
      if (!collisionRow || collisionRow.length === 0) {
        break;
      }
      newSequence++;
      quotationId = `${quotationPrefix}${String(newSequence).padStart(2, '0')}`;
      collisionChecks++;
    }

    const initialLogEntry: OrderLogEntry = {
      id: uuidv4(), timestamp: finalCreatedAt, status: quotationData.initialStatusId,
      changedByUserId: quotationData.crmUserId, changedByUserName: quotationData.crmUserName, notes: "Quotation created.",
    };

    const initialAdvancePayments: AdvancePaymentRecord[] = [];
    if (quotationData.advancePaymentAmount && quotationData.advancePaymentAmount > 0) {
      initialAdvancePayments.push({
        id: uuidv4(), amount: quotationData.advancePaymentAmount, date: finalCreatedAt,
        paymentMethod: quotationData.advancePaymentMethod || "Unknown", notes: "Initial advance payment.", documentUrl: quotationData.advancePaymentDocumentUrl || null,
        recordedByUserId: quotationData.crmUserId, recordedByUserName: quotationData.crmUserName,
      });
    }

    const newQuotationData: Omit<TrackingLink, 'id'> = {
      companyName: quotationData.companyName, address: quotationData.address, phoneNumber: quotationData.phoneNumber,
      orderItems: quotationData.orderItems, specialClientDiscount: quotationData.specialClientDiscount ?? null,
      shippingCharge: quotationData.shippingCharge ?? null, vatPercentage: quotationData.vatPercentage ?? null, orderNotes: quotationData.orderNotes || null,
      crmUserId: quotationData.crmUserId, crmUserName: quotationData.crmUserName,
      designerRepresentativeId: null, designerRepresentativeName: null,
      assigneeAvatarUrl: null,
      designerRepresentativeAvatarUrl: null,
      createdAt: finalCreatedAt, updatedAt: transactionTime,
      updatedByUserId: quotationData.crmUserId, updatedByUserName: quotationData.crmUserName,
      isPublic: false, currentStatus: quotationData.initialStatusId,
      statusHistory: [initialLogEntry], comments: [], viewCount: 0,
      advancePayments: initialAdvancePayments,
      packzyConsignmentId: null, packzyTrackingCode: null,
    };

    await query(`INSERT INTO ${QUOTATIONS_TABLE} (id, data_json) VALUES (?, ?)`, [quotationId, JSON.stringify(newQuotationData)]);

    return { id: quotationId, ...newQuotationData };
  } catch (error) {
    console.error("Error adding quotation to MySQL:", error);
    throw error;
  }
};

export const updateQuotation = async (id: string, updates: Partial<TrackingLink>): Promise<boolean> => {
  await guard();
  try {
    const existingQuotation = await getQuotationById(id);
    if (!existingQuotation) throw new Error(`Quotation ${id} not found.`);

    const finalData = { ...existingQuotation, ...updates };
    const qid = finalData.id;
    delete (finalData as any).id;

    await query(`UPDATE ${QUOTATIONS_TABLE} SET data_json = ? WHERE id = ?`, [JSON.stringify(finalData), qid]);
    return true;
  } catch (error) {
    console.error(`Error updating quotation ${id} in MySQL:`, error);
    return false;
  }
};

export const deleteQuotation = async (quotationId: string, userId: string): Promise<boolean> => {
  await guard();
  try {
    const mysqlDeletedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query(`UPDATE ${QUOTATIONS_TABLE} SET is_deleted = TRUE, deleted_at = ?, deleted_by_id = ? WHERE id = ?`, [mysqlDeletedAt, userId, quotationId]);
    return true;
  } catch (error) {
    console.error(`Error soft deleting quotation ${quotationId} from MySQL:`, error);
    return false;
  }
};

export const getDeletedQuotations = async (): Promise<TrackingLink[]> => {
  await guard();
  try {
    const rows = await query<any[]>(`
      SELECT q.id, q.data_json, q.deleted_at, q.deleted_by_id, u.name as deleted_by_name, u.avatar_url as deleted_by_avatar_url 
      FROM ${QUOTATIONS_TABLE} q
      LEFT JOIN users u ON q.deleted_by_id = u.id
      WHERE q.is_deleted = TRUE 
      ORDER BY q.deleted_at DESC
    `);
    return rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json),
      deletedAt: row.deleted_at,
      deletedById: row.deleted_by_id,
      deletedByName: row.deleted_by_name, // Using name from users table
      deletedByAvatarUrl: row.deleted_by_avatar_url,
    } as TrackingLink));
  } catch (error) {
    console.error("Error fetching deleted quotations from MySQL:", error);
    return [];
  }
};

export const restoreQuotation = async (quotationId: string): Promise<boolean> => {
  await guard();
  try {
    await query(`UPDATE ${QUOTATIONS_TABLE} SET is_deleted = FALSE, deleted_at = NULL WHERE id = ?`, [quotationId]);
    return true;
  } catch (error) {
    console.error(`Error restoring quotation ${quotationId} from MySQL:`, error);
    return false;
  }
};

export const permanentlyDeleteQuotation = async (quotationId: string): Promise<boolean> => {
  await guard();
  try {
    await query(`DELETE FROM ${QUOTATIONS_TABLE} WHERE id = ?`, [quotationId]);
    return true;
  } catch (error) {
    console.error(`Error permanently deleting quotation ${quotationId} from MySQL:`, error);
    return false;
  }
};

export const getQuotationsPaginated = async (
  page: number = 1,
  limit: number = 25,
  searchTerm?: string,
  role?: string,
  userId?: string,
  viewType: 'quotations' | 're-quotations' = 'quotations'
): Promise<{ quotations: TrackingLink[], total: number }> => {
  await guard();
  try {
    const conditions = ['is_deleted = FALSE'];
    const params: any[] = [];

    if (role === 'CR' && userId) {
      conditions.push("JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.crmUserId')) = ?");
      params.push(userId);
    } else if (isDrRole(role) && userId) {
      conditions.push("JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.designerRepresentativeId')) = ?");
      params.push(userId);
    }

    if (searchTerm) {
      const likeTerm = `%${searchTerm}%`;
      conditions.push(`(id LIKE ? OR data_json LIKE ?)`);
      params.push(likeTerm, likeTerm);
    }

    if (viewType === 're-quotations') {
      conditions.push(`
        SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.companyName')), ' • ', 1) IN (
          SELECT SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.companyName')), ' • ', 1) as jobId
          FROM ${QUOTATIONS_TABLE}
          WHERE is_deleted = FALSE
          GROUP BY jobId
          HAVING COUNT(*) > 1
        )
      `);
    }

    const whereClause = conditions.join(' AND ');

    const countQuery = `SELECT COUNT(*) as total FROM ${QUOTATIONS_TABLE} WHERE ${whereClause}`;
    const countResult = await query<any[]>(countQuery, params);
    const total = countResult[0]?.total || 0;

    const offset = Math.max(0, (page - 1) * limit);
    const dataQuery = `
      SELECT id, data_json 
      FROM ${QUOTATIONS_TABLE} 
      WHERE ${whereClause} 
      ORDER BY JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.createdAt')) DESC 
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, Number(limit), Number(offset)];
    const rows = await query<any[]>(dataQuery, dataParams);

    const quotations = rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as TrackingLink));

    return { quotations, total };
  } catch (error) {
    console.error("Error fetching paginated quotations from MySQL:", error);
    return { quotations: [], total: 0 };
  }
};
