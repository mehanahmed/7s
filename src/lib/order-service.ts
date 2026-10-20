

"use server";

import { vatAmountFor } from '@/lib/vat';
import { getGlobalSettings } from '@/lib/settings-service';
import { query } from './mysql';
import type { TrackingLink, Comment, OrderLogEntry, OrderItem, AdvancePaymentRecord, User } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { getStatusById } from './status-service';
import { READY_FOR_DESIGN_STATUS_ID, DELIVERED_STATUS_ID } from './status-constants';
import { format, parseISO } from 'date-fns';
import { sendTelegramMessage } from './notification-utils';
import { getAppUrl } from './server-utils';
import { PROJECT_STAGE_CONFIG } from './project-stages';
import { cached } from '@/lib/ttl-cache';
import { guard, getActionScope } from '@/lib/guard';
import { isDrRole } from '@/lib/roles';

const ORDERS_TABLE = 'orders';
const PROJECTS_TABLE = 'projects';
const SHIPPED_ORDERS_TABLE = 'shipped_orders';

// Ensure the `is_starred` column exists in the orders table
const ensureStarredColumnExists = async () => {
  try {
    const columns = await query<any[]>(`SHOW COLUMNS FROM ${ORDERS_TABLE} LIKE 'is_starred'`);
    if (columns.length === 0) {
      console.log(`Column 'is_starred' not found in table '${ORDERS_TABLE}'. Creating it...`);
      await query(`ALTER TABLE ${ORDERS_TABLE} ADD COLUMN is_starred DECIMAL(2,1) DEFAULT 0.0`);
      console.log(`Column 'is_starred' created successfully.`);
    }
  } catch (error) {
    console.error(`Error ensuring 'is_starred' column exists:`, error);
  }
};
ensureStarredColumnExists();

let performanceIndexesEnsured = false;
const ensurePerformanceIndexesExist = async () => {
  if (performanceIndexesEnsured) return;
  try {
    const existing = await query<any[]>(`SHOW INDEX FROM \`${ORDERS_TABLE}\` WHERE Key_name = 'idx_orders_deleted_created'`);
    if (existing.length === 0) {
      await query(`ALTER TABLE \`${ORDERS_TABLE}\` ADD INDEX \`idx_orders_deleted_created\` (\`is_deleted\`, \`created_at\` DESC)`);
      await query(`ALTER TABLE \`${ORDERS_TABLE}\` ADD INDEX \`idx_orders_status\` (\`current_status\`)`);
      await query(`ALTER TABLE \`${ORDERS_TABLE}\` ADD INDEX \`idx_orders_crm_user\` (\`crm_user_id\`)`);
      await query(`ALTER TABLE \`${ORDERS_TABLE}\` ADD INDEX \`idx_orders_designer_rep\` (\`designer_representative_id\`)`);
    }
    performanceIndexesEnsured = true;
  } catch (e) {
    // Ignore if table doesn't exist yet or already indexed
  }
};
ensurePerformanceIndexesExist();

let stageAssigneesColumnEnsured = false;
const ensureStageAssigneesColumn = async () => {
  if (stageAssigneesColumnEnsured) return;
  try {
    const cols = await query<any[]>(`SHOW COLUMNS FROM \`${ORDERS_TABLE}\` LIKE 'stage_assignees'`);
    if (cols.length === 0) {
      await query(`ALTER TABLE \`${ORDERS_TABLE}\` ADD COLUMN stage_assignees JSON NULL`);
    }
    stageAssigneesColumnEnsured = true;
  } catch (e) {
    console.error('Could not ensure orders.stage_assignees column:', e);
  }
};
ensureStageAssigneesColumn();

let vatColumnEnsured = false;
const ensureVatColumn = async () => {
  if (vatColumnEnsured) return;
  try {
    const cols = await query<any[]>(`SHOW COLUMNS FROM \`${ORDERS_TABLE}\` LIKE 'vat_percentage'`);
    if (cols.length === 0) {
      await query(`ALTER TABLE \`${ORDERS_TABLE}\` ADD COLUMN vat_percentage DECIMAL(5,2) NULL`);
    }
    vatColumnEnsured = true;
  } catch (e) {
    console.error('Could not ensure orders.vat_percentage column:', e);
  }
};
ensureVatColumn();

const mapRowToOrder = (row: any): TrackingLink => ({
  id: row.id,
  projectIdDisplay: row.id,
  clientId: row.client_id,
  companyName: row.company_name ? `${row.client_id} • ${row.company_name}` : row.client_id,
  address: row.address,
  phoneNumber: row.phone_number,
  orderItems: typeof row.order_items === 'string' ? JSON.parse(row.order_items) : row.order_items,
  specialClientDiscount: row.special_client_discount,
  shippingCharge: row.shipping_charge,
  vatPercentage: row.vat_percentage != null ? Number(row.vat_percentage) : null,
  orderNotes: row.order_notes,
  crmUserId: row.crm_user_id,
  crmUserName: row.crm_user_name,
  designerRepresentativeId: row.designer_representative_id,
  designerRepresentativeName: row.designer_representative_name,
  stageAssignees: typeof row.stage_assignees === 'string' ? JSON.parse(row.stage_assignees) : (row.stage_assignees ?? null),
  assigneeAvatarUrl: row.assignee_avatar_url,
  designerRepresentativeAvatarUrl: row.designer_representative_avatar_url,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  acceptedDeliveryDate: row.accepted_delivery_date instanceof Date ? row.accepted_delivery_date.toISOString() : row.accepted_delivery_date,
  updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  updatedByUserId: row.updated_by_user_id,
  updatedByUserName: row.updated_by_user_name,
  isPublic: Boolean(row.is_public),
  isStarred: Number(row.is_starred || 0),
  currentStatus: row.current_status,
  statusHistory: typeof row.status_history === 'string' ? JSON.parse(row.status_history) : row.status_history,
  comments: typeof row.comments === 'string' ? JSON.parse(row.comments) : row.comments,
  viewCount: row.view_count,
  advancePayments: typeof row.advance_payments === 'string' ? JSON.parse(row.advance_payments) : row.advance_payments,
  packzyConsignmentId: row.packzy_consignment_id,
  packzyTrackingCode: row.packzy_tracking_code,
  deletedAt: row.deleted_at,
  deletedById: row.deleted_by_id,
  deletedByName: row.deleted_by_name,
});

export const getOrders = async (startDate?: string, endDate?: string, role?: string, userId?: string, page?: number, limit?: number, searchTerm?: string): Promise<TrackingLink[]> => {
  await guard();
  await ensureStageAssigneesColumn();
  const scope = await getActionScope();
  if (scope && isDrRole(scope.role)) { role = scope.role; userId = scope.userId; } // production roles only ever see their assigned orders
  // Short cache: dashboards call getOrders several times per load with identical args.
  return cached('orders', 5000, () => loadOrders(startDate, endDate, role, userId, page, limit, searchTerm), JSON.stringify([startDate, endDate, role, userId, page, limit, searchTerm]));
};

const loadOrders = async (startDate?: string, endDate?: string, role?: string, userId?: string, page?: number, limit?: number, searchTerm?: string): Promise<TrackingLink[]> => {
  try {
    const conditions = ['o.is_deleted = FALSE'];
    const params: any[] = [];

    if (startDate) {
      conditions.push('o.created_at >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('o.created_at <= ?');
      params.push(endDate);
    }

    if (role === 'CR' && userId) {
      conditions.push('o.crm_user_id = ?');
      params.push(userId);
    } else if (isDrRole(role) && userId) {
      conditions.push("(o.designer_representative_id = ? OR JSON_SEARCH(o.stage_assignees, 'one', ?) IS NOT NULL)");
      params.push(userId, userId);
    } else if ((role === 'SYSTEM_ADMIN' || role === 'ADMIN') && userId && userId !== 'all') {
      conditions.push('o.crm_user_id = ?');
      params.push(userId);
    }

    if (searchTerm) {
      const likeTerm = `%${searchTerm}%`;
      conditions.push(`(o.id LIKE ? OR c.company_name LIKE ? OR o.client_id LIKE ? OR CONCAT(o.client_id, ' • ', c.company_name) LIKE ? OR c.phone_number LIKE ? OR uc.name LIKE ? OR ud.name LIKE ? OR c.address LIKE ?)`);
      params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
    }

    const whereSql = conditions.join(' AND ');

    let limitSql = '';
    if (page && limit) {
      const offset = (page - 1) * limit;
      limitSql = `LIMIT ${limit} OFFSET ${offset}`;
    }

    const results = await query<any[]>(`
      SELECT o.*, c.company_name, c.phone_number, c.address,
             uc.name as crm_user_name, uc.avatar_url as assignee_avatar_url,
             ud.name as designer_representative_name, ud.avatar_url as designer_representative_avatar_url,
             uu.name as updated_by_user_name
      FROM ${ORDERS_TABLE} o 
      JOIN clients c ON o.client_id = c.id 
      LEFT JOIN users uc ON o.crm_user_id = uc.id
      LEFT JOIN users ud ON o.designer_representative_id = ud.id
      LEFT JOIN users uu ON o.updated_by_user_id = uu.id
      WHERE ${whereSql} 
      ORDER BY o.created_at DESC
      ${limitSql}
    `, params);
    return results.map(mapRowToOrder);
  } catch (error) {
    console.error("Error fetching orders from MySQL:", error);
    return [];
  }
};

export const getOrdersWithTotal = async (
  startDate?: string, 
  endDate?: string, 
  role?: string, 
  userId?: string, 
  page: number = 1, 
  limit: number = 25, 
  searchTerm?: string, 
  viewType?: 'orders' | 'reorders' | 'pending_payment',
  statusFilter?: string
): Promise<{ orders: TrackingLink[], total: number }> => {
  await guard();
  await ensureStageAssigneesColumn();
  const scope = await getActionScope();
  if (scope && isDrRole(scope.role)) { role = scope.role; userId = scope.userId; } // production roles only ever see their assigned orders
  try {
    const conditions = ['o.is_deleted = FALSE'];
    const params: any[] = [];

    if (statusFilter && statusFilter !== 'all') {
      conditions.push('o.current_status = ?');
      params.push(statusFilter);
    }

    if (startDate) {
      conditions.push('o.created_at >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('o.created_at <= ?');
      params.push(endDate);
    }

    if (role === 'CR' && userId) {
      conditions.push('o.crm_user_id = ?');
      params.push(userId);
    } else if (isDrRole(role) && userId) {
      conditions.push("(o.designer_representative_id = ? OR JSON_SEARCH(o.stage_assignees, 'one', ?) IS NOT NULL)");
      params.push(userId, userId);
    } else if ((role === 'SYSTEM_ADMIN' || role === 'ADMIN') && userId && userId !== 'all') {
      conditions.push('o.crm_user_id = ?');
      params.push(userId);
    }

    if (searchTerm) {
      const likeTerm = `%${searchTerm}%`;
      conditions.push(`(o.id LIKE ? OR c.company_name LIKE ? OR o.client_id LIKE ? OR CONCAT(o.client_id, ' • ', c.company_name) LIKE ? OR c.phone_number LIKE ? OR uc.name LIKE ? OR ud.name LIKE ?)`);
      params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
    }
    
    if (viewType === 'pending_payment') {
      conditions.push(`(o.advance_payments IS NULL OR JSON_LENGTH(o.advance_payments) = 0 OR o.advance_payments = '[]')`);
    } else if (viewType === 'reorders') {
      const baseConditions = [...conditions];
      const subquery = `
        SELECT inner_o.client_id
        FROM ${ORDERS_TABLE} inner_o
        JOIN clients inner_c ON inner_o.client_id = inner_c.id
        LEFT JOIN users inner_uc ON inner_o.crm_user_id = inner_uc.id
        LEFT JOIN users inner_ud ON inner_o.designer_representative_id = inner_ud.id
        WHERE ${baseConditions.join(' AND ').replace(/o\./g, 'inner_o.').replace(/c\./g, 'inner_c.').replace(/uc\./g, 'inner_uc.').replace(/ud\./g, 'inner_ud.')}
        GROUP BY inner_o.client_id
        HAVING COUNT(inner_o.id) > 1
      `;
      conditions.push(`o.client_id IN (${subquery})`);
      params.push(...params);
    }

    const whereSql = conditions.join(' AND ');

    const countQuery = `
      SELECT COUNT(DISTINCT o.id) as total
      FROM ${ORDERS_TABLE} o
      JOIN clients c ON o.client_id = c.id
      LEFT JOIN users uc ON o.crm_user_id = uc.id
      LEFT JOIN users ud ON o.designer_representative_id = ud.id
      WHERE ${whereSql}
    `;
    const countResult = await query<any[]>(countQuery, params);
    const total = countResult[0]?.total || 0;

    const offset = (page - 1) * limit;
    const limitSql = ` LIMIT ${limit} OFFSET ${offset}`;

    const results = await query<any[]>(`
      SELECT o.*, c.company_name, c.phone_number, c.address,
             uc.name as crm_user_name, uc.avatar_url as assignee_avatar_url,
             ud.name as designer_representative_name, ud.avatar_url as designer_representative_avatar_url,
             uu.name as updated_by_user_name
      FROM ${ORDERS_TABLE} o 
      JOIN clients c ON o.client_id = c.id 
      LEFT JOIN users uc ON o.crm_user_id = uc.id
      LEFT JOIN users ud ON o.designer_representative_id = ud.id
      LEFT JOIN users uu ON o.updated_by_user_id = uu.id
      WHERE ${whereSql} 
      ORDER BY o.created_at DESC
      ${limitSql}
    `, params);

    return { orders: results.map(mapRowToOrder), total };
  } catch (error) {
    console.error("Error fetching orders with total from MySQL:", error);
    return { orders: [], total: 0 };
  }
};

export const getOrdersPaginated = async (limit: number, offset: number, searchTerm: string = '', statusId: string = ''): Promise<{ orders: TrackingLink[], total: number }> => {
  await guard();
  try {
    let whereClauseParts = ['o.is_deleted = FALSE'];
    const params: any[] = [];

    if (searchTerm) {
      whereClauseParts.push(`(o.id LIKE ? OR c.company_name LIKE ? OR o.client_id LIKE ? OR CONCAT(o.client_id, ' • ', c.company_name) LIKE ? OR c.phone_number LIKE ? OR uc.name LIKE ?)`);
      const searchParam = `%${searchTerm}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
    }


    if (statusId) {
      const stage = PROJECT_STAGE_CONFIG.find((st) => st.status === statusId);
      if (stage?.status === 'CR Clearance') {
        // default bucket: anything not claimed by another stage (legacy statuses included)
        const claimed = PROJECT_STAGE_CONFIG.filter((st) => st.status !== 'CR Clearance').map((st) => st.orderStatusId);
        whereClauseParts.push(`o.current_status NOT IN (${claimed.map(() => '?').join(', ')}) AND o.current_status NOT LIKE '%design%' AND o.current_status NOT IN ('shipped', 'logistics')`);
        params.push(...claimed);
      } else if (stage?.status === 'On Script') {
        whereClauseParts.push(`(o.current_status = 'ready-for-design' OR o.current_status LIKE '%design%')`);
      } else if (stage?.status === 'Project Delivered') {
        whereClauseParts.push(`o.current_status IN ('delivered', 'shipped')`);
      } else if (stage?.status === 'Project Complete') {
        whereClauseParts.push(`o.current_status IN ('project-complete', 'logistics')`);
      } else if (stage) {
        whereClauseParts.push(`o.current_status = ?`);
        params.push(stage.orderStatusId);
      } else {
        whereClauseParts.push(`o.current_status = ?`);
        params.push(statusId);
      }
    }


    const whereClause = whereClauseParts.length > 0 ? `WHERE ${whereClauseParts.join(' AND ')}` : '';

    const countResults = await query<any[]>(`
      SELECT COUNT(*) as total 
      FROM ${ORDERS_TABLE} o 
      JOIN clients c ON o.client_id = c.id 
      LEFT JOIN users uc ON o.crm_user_id = uc.id
      ${whereClause}
    `, params);
    const total = countResults[0].total;

    const queryStr = `
      SELECT o.*, c.company_name, c.phone_number, c.address,
             uc.name as crm_user_name, uc.avatar_url as assignee_avatar_url,
             ud.name as designer_representative_name, ud.avatar_url as designer_representative_avatar_url,
             uu.name as updated_by_user_name
       FROM ${ORDERS_TABLE} o 
       JOIN clients c ON o.client_id = c.id 
       LEFT JOIN users uc ON o.crm_user_id = uc.id
       LEFT JOIN users ud ON o.designer_representative_id = ud.id
       LEFT JOIN users uu ON o.updated_by_user_id = uu.id
       ${whereClause} 
       ORDER BY o.created_at DESC 
       LIMIT ? OFFSET ?
     `;
    const results = await query<any[]>(queryStr, [...params, limit, offset]);

    return {
      orders: results.map(mapRowToOrder),
      total
    };
  } catch (error) {
    console.error("Error fetching paginated orders from MySQL:", error);
    return { orders: [], total: 0 };
  }
};




export const getOrderById = async (id: string): Promise<TrackingLink | undefined> => {
  await guard();
  if (!id) return undefined;
  try {
    const results = await query<any[]>(`
      SELECT o.*, c.company_name, c.phone_number, c.address,
             uc.name as crm_user_name, uc.avatar_url as assignee_avatar_url,
             ud.name as designer_representative_name, ud.avatar_url as designer_representative_avatar_url,
             uu.name as updated_by_user_name
      FROM ${ORDERS_TABLE} o 
      JOIN clients c ON o.client_id = c.id 
      LEFT JOIN users uc ON o.crm_user_id = uc.id
      LEFT JOIN users ud ON o.designer_representative_id = ud.id
      LEFT JOIN users uu ON o.updated_by_user_id = uu.id
      WHERE o.id = ? AND o.is_deleted = FALSE
    `, [id]);
    if (results.length > 0) {
      return mapRowToOrder(results[0]);
    }
    return undefined;
  } catch (error) {
    console.error("Error fetching order by ID from MySQL:", error);
    return undefined;
  }
};

export const getOrderByTrackingCode = async (trackingCode: string): Promise<TrackingLink | null> => {
  await guard();
  if (!trackingCode) return null;
  try {
    const results = await query<any[]>(`
      SELECT o.*, c.company_name, c.phone_number, c.address,
             uc.name as crm_user_name, uc.avatar_url as assignee_avatar_url,
             ud.name as designer_representative_name, ud.avatar_url as designer_representative_avatar_url,
             uu.name as updated_by_user_name
      FROM ${ORDERS_TABLE} o 
      JOIN clients c ON o.client_id = c.id 
      LEFT JOIN users uc ON o.crm_user_id = uc.id
      LEFT JOIN users ud ON o.designer_representative_id = ud.id
      LEFT JOIN users uu ON o.updated_by_user_id = uu.id
      WHERE o.packzy_tracking_code = ? AND o.is_deleted = FALSE
    `, [trackingCode]);
    if (results.length > 0) {
      return mapRowToOrder(results[0]);
    }
    return null;
  } catch (error) {
    console.error(`Error fetching order by tracking code "${trackingCode}" from MySQL:`, error);
    return null;
  }
};

export const getOrdersByStatusAndTracking = async (statusId: string, onlyWithDue: boolean = false): Promise<TrackingLink[]> => {
  await guard();
  try {
    const results = await query<any[]>(`
      SELECT o.*, c.company_name, c.phone_number, c.address,
             uc.name as crm_user_name, uc.avatar_url as assignee_avatar_url,
             ud.name as designer_representative_name, ud.avatar_url as designer_representative_avatar_url,
             uu.name as updated_by_user_name
      FROM ${ORDERS_TABLE} o 
      JOIN clients c ON o.client_id = c.id 
      LEFT JOIN users uc ON o.crm_user_id = uc.id
      LEFT JOIN users ud ON o.designer_representative_id = ud.id
      LEFT JOIN users uu ON o.updated_by_user_id = uu.id
      WHERE o.current_status = ? AND o.is_deleted = FALSE
    `, [statusId]);
    const orders = results.map(mapRowToOrder);

    if (onlyWithDue) {
      return orders.filter(order => {
        const orderSubtotal = (order.orderItems || []).reduce((acc, item) => acc + (item.isGift ? 0 : (Number(item.lineItemTotalPrice) || 0)), 0);
        const effectiveDiscount = Number(order.specialClientDiscount) || 0;
        const netPayable = orderSubtotal - effectiveDiscount;
        const totalAdvancePaid = (order.advancePayments || []).reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
        const shippingCharge = Number(order.shippingCharge) || 0;
        const dueAmount = netPayable + vatAmountFor(netPayable, order.vatPercentage) + shippingCharge - totalAdvancePaid;
        return dueAmount > 0.01;
      });
    } else {
      return orders.filter(order => !!order.packzyTrackingCode);
    }
  } catch (error) {
    console.error(`Error fetching orders with status ${statusId} from MySQL:`, error);
    return [];
  }
};


export const addOrder = async (orderData: {
  clientId?: string | null;
  companyName: string;
  address: string;
  phoneNumber: string;
  orderItems: OrderItem[];
  advancePaymentAmount?: number | null;
  advancePaymentMethod?: string | null;
  advancePaymentDocumentUrl?: string | null;
  newAdvancePaymentNotes?: string | null;
  specialClientDiscount?: number | null;
  shippingCharge?: number | null;
  orderNotes?: string | null;
  initialStatusId: string;
  crmUserId: string;
  crmUserName: string;
  createdAt: string;
  acceptedDeliveryDate?: string | null;
  isStarred?: number;
}): Promise<TrackingLink | null> => {
  await guard();
  const transactionTime = new Date().toISOString();

  try {
    let finalCreatedAt = orderData.createdAt;
    try {
      finalCreatedAt = parseISO(orderData.createdAt).toISOString();
    } catch (e) {
      finalCreatedAt = new Date().toISOString();
    }

    const currentDate = parseISO(finalCreatedAt);
    const datePrefix = `ORD-${format(currentDate, 'yyyyMMdd')}`;

    const sameDayResults = await query<any[]>(`SELECT id FROM ${ORDERS_TABLE} WHERE id LIKE ?`, [`${datePrefix}%`]);
    let newSequence = 1;
    if (sameDayResults.length > 0) {
      const lastSequence = Math.max(...sameDayResults.map(row => {
        const numPart = parseInt(row.id.split('-').pop() || '0', 10);
        return isNaN(numPart) ? 0 : numPart;
      }));
      newSequence = lastSequence + 1;
    }

    const orderId = `${datePrefix}-${String(newSequence).padStart(3, '0')}`;

    // Determine or generate client ID
    let clientId = orderData.clientId?.trim();
    let cleanCompanyName = orderData.companyName.trim();
    const nameParts = cleanCompanyName.split(' • ');
    if (nameParts.length > 1) {
      if (!clientId) {
        clientId = nameParts[0].trim();
      }
      cleanCompanyName = nameParts.slice(1).join(' • ').trim();
    }

    if (!clientId) {
      // Query the database to find the maximum numeric ID in the clients table
      const clientRows = await query<any[]>(`SELECT id FROM clients WHERE id REGEXP '^[0-9]+$'`);
      let maxClientId = 0;
      for (const row of clientRows) {
        const idNum = parseInt(row.id, 10);
        if (!isNaN(idNum) && idNum > maxClientId) {
          maxClientId = idNum;
        }
      }
      clientId = (maxClientId + 1).toString();
    }

    const combinedCompanyName = `${clientId} • ${cleanCompanyName}`;

    const initialLogEntry: OrderLogEntry = {
      id: uuidv4(), timestamp: finalCreatedAt, status: orderData.initialStatusId,
      changedByUserId: orderData.crmUserId, changedByUserName: orderData.crmUserName, notes: "Order created.",
    };

    const initialAdvancePayments: AdvancePaymentRecord[] = [];
    if (orderData.advancePaymentAmount && orderData.advancePaymentAmount > 0) {
      const newPayment: AdvancePaymentRecord = {
        id: uuidv4(), amount: orderData.advancePaymentAmount, date: finalCreatedAt,
        paymentMethod: orderData.advancePaymentMethod || "Unknown",
        notes: orderData.newAdvancePaymentNotes || "Initial advance payment.",
        documentUrl: orderData.advancePaymentDocumentUrl || null,
        recordedByUserId: orderData.crmUserId, recordedByUserName: orderData.crmUserName,
        status: 'Pending',
      };
      initialAdvancePayments.push(newPayment);

      const message = `
<b>🎉 New Advance Payment Received!</b>

<b>Order ID:</b> <code>${orderId}</code>
<b>Company:</b> ${combinedCompanyName}
<b>Amount:</b> ${orderData.advancePaymentAmount.toLocaleString('en-IN', { style: 'currency', currency: 'BDT' })}
<b>Method:</b> ${newPayment.paymentMethod}
<b>Reference:</b> ${newPayment.notes || 'N/A'}
<b>Recorded By:</b> ${orderData.crmUserName}
      `;

      const appUrl = await getAppUrl();
      const paymentReplyMarkup = {
        inline_keyboard: [
          [
            {
              text: "📄 View Order",
              url: `${appUrl}/track/${orderId}`
            },
            {
              text: "💰 Payment History",
              url: `${appUrl}/admin/payment-history`
            }
          ]
        ]
      };

      sendTelegramMessage(message, paymentReplyMarkup);
    }

    const mysqlCreatedAt = format(parseISO(finalCreatedAt), 'yyyy-MM-dd HH:mm:ss');
    const mysqlUpdatedAt = format(parseISO(transactionTime), 'yyyy-MM-dd HH:mm:ss');

    // 1. Upsert client info into clients table
    await query(
      `INSERT INTO clients (id, company_name, phone_number, address) 
       VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
         company_name = VALUES(company_name), 
         phone_number = VALUES(phone_number), 
         address = VALUES(address)`,
      [clientId, cleanCompanyName, orderData.phoneNumber, orderData.address]
    );

    // 2. Insert order with client_id. VAT is read from the admin setting on the server and stored on the order.
    await ensureVatColumn();
    const vatPercentage = Number((await getGlobalSettings()).vatPercentage) || 0;
    await query(
      `INSERT INTO ${ORDERS_TABLE} (
        id, client_id, order_items, special_client_discount, shipping_charge, 
        order_notes, crm_user_id, created_at, accepted_delivery_date, updated_at, updated_by_user_id, 
        is_public, is_starred, current_status, status_history, comments, view_count, advance_payments, vat_percentage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId, clientId, JSON.stringify(orderData.orderItems),
        orderData.specialClientDiscount ?? null, orderData.shippingCharge ?? null, orderData.orderNotes || null,
        orderData.crmUserId, mysqlCreatedAt, 
        orderData.acceptedDeliveryDate ? format(parseISO(orderData.acceptedDeliveryDate), 'yyyy-MM-dd HH:mm:ss') : null,
        mysqlUpdatedAt, orderData.crmUserId,
        false, orderData.isStarred ?? 0, orderData.initialStatusId, JSON.stringify([initialLogEntry]),
        JSON.stringify([]), 0, JSON.stringify(initialAdvancePayments), vatPercentage > 0 ? vatPercentage : null
      ]
    );

    return {
      id: orderId,
      clientId: clientId,
      companyName: combinedCompanyName, address: orderData.address, phoneNumber: orderData.phoneNumber,
      orderItems: orderData.orderItems, specialClientDiscount: orderData.specialClientDiscount ?? null,
      shippingCharge: orderData.shippingCharge ?? null, vatPercentage: vatPercentage > 0 ? vatPercentage : null, orderNotes: orderData.orderNotes || null,
      crmUserId: orderData.crmUserId, crmUserName: orderData.crmUserName,
      designerRepresentativeId: null, designerRepresentativeName: null,
      assigneeAvatarUrl: null, designerRepresentativeAvatarUrl: null,
      createdAt: finalCreatedAt, 
      acceptedDeliveryDate: orderData.acceptedDeliveryDate || null,
      updatedAt: transactionTime,
      updatedByUserId: orderData.crmUserId, updatedByUserName: orderData.crmUserName,
      isPublic: false, isStarred: orderData.isStarred ?? 0, currentStatus: orderData.initialStatusId,
      statusHistory: [initialLogEntry], comments: [], viewCount: 0,
      advancePayments: initialAdvancePayments,
      packzyConsignmentId: null, packzyTrackingCode: null,
    };

  } catch (error: any) {
    console.error("Error adding order to MySQL:", error);
    if (error instanceof Error) throw error;
    throw new Error("An unknown error occurred while creating the order.");
  }
};


export const updateOrder = async (id: string, updates: Partial<TrackingLink>): Promise<boolean> => {
  await guard();
  try {
    const existingOrder = await getOrderById(id);
    if (!existingOrder) {
      throw new Error(`Order ${id} not found.`);
    }

    const mysqlUpdateAt = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const fields: string[] = [];
    const params: any[] = [];

    const clientId = updates.clientId !== undefined ? updates.clientId : existingOrder.clientId;
    if (clientId) {
      if (updates.clientId !== undefined || updates.companyName !== undefined || updates.address !== undefined || updates.phoneNumber !== undefined) {
        const companyNameRaw = updates.companyName !== undefined ? updates.companyName : existingOrder.companyName;
        const addressVal = updates.address !== undefined ? updates.address : existingOrder.address;
        const phoneVal = updates.phoneNumber !== undefined ? updates.phoneNumber : existingOrder.phoneNumber;

        const nameParts = companyNameRaw.split(' • ');
        const cleanCompanyName = nameParts.length > 1 ? nameParts.slice(1).join(' • ').trim() : companyNameRaw.trim();

        await query(
          `INSERT INTO clients (id, company_name, phone_number, address) 
           VALUES (?, ?, ?, ?) 
           ON DUPLICATE KEY UPDATE 
             company_name = VALUES(company_name), 
             phone_number = VALUES(phone_number), 
             address = VALUES(address)`,
          [clientId, cleanCompanyName, phoneVal, addressVal]
        );
      }
    }

    if (updates.clientId !== undefined) { fields.push('client_id = ?'); params.push(updates.clientId); }
    if (updates.orderItems !== undefined) { fields.push('order_items = ?'); params.push(JSON.stringify(updates.orderItems)); }
    if (updates.specialClientDiscount !== undefined) { fields.push('special_client_discount = ?'); params.push(updates.specialClientDiscount); }
    if (updates.shippingCharge !== undefined) { fields.push('shipping_charge = ?'); params.push(updates.shippingCharge); }
    if (updates.vatPercentage !== undefined) { await ensureVatColumn(); fields.push('vat_percentage = ?'); params.push(updates.vatPercentage); }
    if (updates.orderNotes !== undefined) { fields.push('order_notes = ?'); params.push(updates.orderNotes); }
    if (updates.crmUserId !== undefined) { fields.push('crm_user_id = ?'); params.push(updates.crmUserId); }
    if (updates.designerRepresentativeId !== undefined) { fields.push('designer_representative_id = ?'); params.push(updates.designerRepresentativeId); }
    if (updates.stageAssignees !== undefined) { await ensureStageAssigneesColumn(); fields.push('stage_assignees = ?'); params.push(updates.stageAssignees === null ? null : JSON.stringify(updates.stageAssignees)); }
    if (updates.updatedByUserId !== undefined) { fields.push('updated_by_user_id = ?'); params.push(updates.updatedByUserId); }
    if (updates.isPublic !== undefined) { fields.push('is_public = ?'); params.push(updates.isPublic); }
    if (updates.isStarred !== undefined) { fields.push('is_starred = ?'); params.push(updates.isStarred); }
    if (updates.currentStatus !== undefined) { fields.push('current_status = ?'); params.push(updates.currentStatus); }
    if (updates.statusHistory !== undefined) { fields.push('status_history = ?'); params.push(JSON.stringify(updates.statusHistory)); }
    if (updates.comments !== undefined) { fields.push('comments = ?'); params.push(JSON.stringify(updates.comments)); }
    if (updates.viewCount !== undefined) { fields.push('view_count = ?'); params.push(updates.viewCount); }
    if (updates.advancePayments !== undefined) { fields.push('advance_payments = ?'); params.push(JSON.stringify(updates.advancePayments)); }
    if (updates.packzyConsignmentId !== undefined) { fields.push('packzy_consignment_id = ?'); params.push(updates.packzyConsignmentId); }
    if (updates.packzyTrackingCode !== undefined) { fields.push('packzy_tracking_code = ?'); params.push(updates.packzyTrackingCode); }
    if (updates.createdAt !== undefined) { 
        fields.push('created_at = ?'); 
        params.push(updates.createdAt ? format(parseISO(updates.createdAt), 'yyyy-MM-dd HH:mm:ss') : null); 
    }
    if (updates.acceptedDeliveryDate !== undefined) { 
        fields.push('accepted_delivery_date = ?'); 
        params.push(updates.acceptedDeliveryDate ? format(parseISO(updates.acceptedDeliveryDate), 'yyyy-MM-dd HH:mm:ss') : null); 
    }

    if (fields.length === 0) return true;

    fields.push('updated_at = ?');
    params.push(mysqlUpdateAt);

    params.push(id);

    await query(`UPDATE ${ORDERS_TABLE} SET ${fields.join(', ')} WHERE id = ?`, params);

    // Clean up old client if client_id changed and old client has no more orders
    if (updates.clientId !== undefined && existingOrder.clientId && updates.clientId !== existingOrder.clientId) {
      const oldClientId = existingOrder.clientId;
      const remainingOrders = await query<any[]>(`SELECT id FROM ${ORDERS_TABLE} WHERE client_id = ?`, [oldClientId]);
      if (remainingOrders.length === 0) {
        await query(`DELETE FROM clients WHERE id = ?`, [oldClientId]);
        console.log(`[UpdateClient] Deleted orphan client ${oldClientId} since its last order was moved to a new client ID.`);
      }
    }

    return true;
  } catch (error) {
    console.error(`Error updating order ${id} in MySQL:`, error);
    return false;
  }
};

export async function updateAdvancePaymentStatus(
  orderId: string,
  paymentId: string,
  newStatus: 'Approved' | 'Pending'
): Promise<{ success: boolean; error?: string, order?: TrackingLink }> {
  await guard();
  try {
    const order = await getOrderById(orderId);
    if (!order || !order.advancePayments) {
      return { success: false, error: `Order or payment history not found for order ${orderId}.` };
    }

    let paymentUpdated = false;
    const updatedPayments = (order.advancePayments || []).map(p => {
      if (p.id === paymentId) {
        if (p.status !== newStatus) {
          paymentUpdated = true;
          return { ...p, status: newStatus };
        }
      }
      return p;
    });

    if (!paymentUpdated) {
      return { success: true, order: order }; // No change needed
    }

    const success = await updateOrder(orderId, { advancePayments: updatedPayments });
    if (success) {
      const updatedOrder = { ...order, advancePayments: updatedPayments };

      // If the new status is 'Approved', send a Telegram notification
      if (newStatus === 'Approved') {
        const payment = updatedPayments.find(p => p.id === paymentId);
        if (payment) {
          const message = `
<b>✅ Payment Approved!</b>

<b>Order ID:</b> <code>${orderId}</code>
<b>Company:</b> ${order.companyName}
<b>Amount:</b> ${payment.amount.toLocaleString('en-IN', { style: 'currency', currency: 'BDT' })}
<b>Method:</b> ${payment.paymentMethod}
<b>Reference:</b> ${payment.notes || 'N/A'}
<b>Recorded By:</b> ${payment.recordedByUserName}
          `;

          const appUrl = await getAppUrl();
          const paymentReplyMarkup = {
            inline_keyboard: [
              [
                {
                  text: "📄 View Order",
                  url: `${appUrl}/track/${orderId}`
                }
              ]
            ]
          };

          sendTelegramMessage(message, paymentReplyMarkup);
        }
      }

      return { success: true, order: updatedOrder };
    } else {
      return { success: false, error: "Failed to save the updated order to the database." };
    }
  } catch (error) {
    console.error(`Error updating payment status for order ${orderId} in MySQL:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update status." };
  }
}

export const updateOrdersBatch = async (updates: { id: string, data: Partial<TrackingLink> }[]): Promise<boolean> => {
  await guard();
  if (updates.length === 0) return true;
  try {
    for (const update of updates) {
      await updateOrder(update.id, update.data);
    }
    return true;
  } catch (error) {
    console.error("Error performing batch update on orders in MySQL:", error);
    return false;
  }
};


export const deleteOrder = async (orderId: string, userId: string): Promise<boolean> => {
  await guard();
  try {
    const mysqlDeletedAt = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    await query(`UPDATE ${ORDERS_TABLE} SET is_deleted = TRUE, deleted_at = ?, deleted_by_id = ? WHERE id = ?`, [mysqlDeletedAt, userId, orderId]);
    // We keep entries in projects and shipped_orders for now to maintain consistency if restored
    return true;
  } catch (error) {
    console.error(`Error soft deleting order ${orderId} from MySQL:`, error);
    return false;
  }
};

export const getDeletedOrders = async (): Promise<TrackingLink[]> => {
  await guard();
  try {
    const results = await query<any[]>(`
      SELECT o.*, c.company_name, c.phone_number, c.address, 
             u.name as deleted_by_name, u.avatar_url as deleted_by_avatar_url,
             uc.name as crm_user_name, uc.avatar_url as assignee_avatar_url,
             ud.name as designer_representative_name, ud.avatar_url as designer_representative_avatar_url,
             uu.name as updated_by_user_name
      FROM ${ORDERS_TABLE} o
      JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.deleted_by_id = u.id
      LEFT JOIN users uc ON o.crm_user_id = uc.id
      LEFT JOIN users ud ON o.designer_representative_id = ud.id
      LEFT JOIN users uu ON o.updated_by_user_id = uu.id
      WHERE o.is_deleted = TRUE 
      ORDER BY o.deleted_at DESC
    `);
    return results.map(row => ({
      ...mapRowToOrder(row),
      deletedByName: row.deleted_by_name,
      deletedByAvatarUrl: row.deleted_by_avatar_url,
    }));
  } catch (error) {
    console.error("Error fetching deleted orders from MySQL:", error);
    return [];
  }
};

export const restoreOrder = async (orderId: string): Promise<boolean> => {
  await guard();
  try {
    await query(`UPDATE ${ORDERS_TABLE} SET is_deleted = FALSE, deleted_at = NULL WHERE id = ?`, [orderId]);
    return true;
  } catch (error) {
    console.error(`Error restoring order ${orderId} from MySQL:`, error);
    return false;
  }
};

export const permanentlyDeleteOrder = async (orderId: string): Promise<boolean> => {
  await guard();
  try {
    const orderRows = await query<any[]>(`SELECT client_id FROM ${ORDERS_TABLE} WHERE id = ?`, [orderId]);
    const clientId = orderRows.length > 0 ? orderRows[0].client_id : null;

    await query(`DELETE FROM ${ORDERS_TABLE} WHERE id = ?`, [orderId]);
    await query(`DELETE FROM ${PROJECTS_TABLE} WHERE id = ?`, [orderId]);
    await query(`DELETE FROM ${SHIPPED_ORDERS_TABLE} WHERE order_id = ?`, [orderId]);

    if (clientId) {
      const remainingOrders = await query<any[]>(`SELECT id FROM ${ORDERS_TABLE} WHERE client_id = ?`, [clientId]);
      if (remainingOrders.length === 0) {
        await query(`DELETE FROM clients WHERE id = ?`, [clientId]);
        console.log(`[DeleteClient] Deleted orphan client ${clientId} after permanently deleting its last order.`);
      }
    }

    return true;
  } catch (error) {
    console.error(`Error permanently deleting order ${orderId} from MySQL:`, error);
    return false;
  }
};

export async function autoSettleOrderIfDelivered(
  orderId: string,
  settlementReason: string,
  actingUser: { id: string; name: string }
): Promise<boolean> {
  await guard();
  try {
    const order = await getOrderById(orderId);
    if (!order) {
      console.warn(`[autoSettleOrderIfDelivered] Order ${orderId} not found. Cannot settle.`);
      return false;
    }

    const isAlreadyDelivered = order.currentStatus === DELIVERED_STATUS_ID;

    const orderSubtotal = (order.orderItems || []).reduce((acc, item) => acc + (item.isGift ? 0 : (Number(item.lineItemTotalPrice) || 0)), 0);
    const effectiveDiscount = Number(order.specialClientDiscount) || 0;
    const netPayable = orderSubtotal - effectiveDiscount;
    const totalAdvancePaid = (order.advancePayments || []).reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
    const shippingCharge = Number(order.shippingCharge) || 0;
    const dueAmount = netPayable + vatAmountFor(netPayable, order.vatPercentage) + shippingCharge - totalAdvancePaid;

    const updates: Partial<TrackingLink> = {};
    let needsUpdate = false;

    if (dueAmount > 0.01) {
      const settlementRecord: AdvancePaymentRecord = {
        id: uuidv4(), amount: dueAmount, date: new Date().toISOString(), paymentMethod: "COD",
        notes: settlementReason, recordedByUserId: actingUser.id, recordedByUserName: actingUser.name,
        status: 'Approved', // Auto-approve COD payments
      };
      updates.advancePayments = [...(order.advancePayments || []), settlementRecord];
      needsUpdate = true;
    }

    if (!isAlreadyDelivered) {
      updates.currentStatus = DELIVERED_STATUS_ID;
      const newStatusLogEntry: OrderLogEntry = {
        id: uuidv4(), timestamp: new Date().toISOString(), status: DELIVERED_STATUS_ID,
        changedByUserId: actingUser.id, changedByUserName: actingUser.name, notes: settlementReason,
      };
      updates.statusHistory = [...order.statusHistory, newStatusLogEntry];
      needsUpdate = true;
    }

    if (needsUpdate) {
      updates.updatedAt = new Date().toISOString();
      updates.updatedByUserId = actingUser.id;
      updates.updatedByUserName = actingUser.name;
      await updateOrder(orderId, updates);
    }

    // Sync project status if it exists in projects table
    try {
      const projectResults = await query<any[]>(`SELECT * FROM ${PROJECTS_TABLE} WHERE id = ?`, [orderId]);
      if (projectResults.length > 0) {
        const projectData = JSON.parse(projectResults[0].data_json);
        if (projectData.status !== 'Delivered') {
          projectData.status = 'Delivered';
          projectData.deliveredAt = new Date().toISOString();
          projectData.updatedAt = new Date().toISOString();
          await query(`UPDATE ${PROJECTS_TABLE} SET data_json = ? WHERE id = ?`, [JSON.stringify(projectData), orderId]);
          console.log(`[autoSettleOrderIfDelivered] Synced project ${orderId} to 'Delivered' in MySQL.`);
        }
      }
    } catch (projectError) {
      console.warn(`[autoSettleOrderIfDelivered] Could not sync project status for ${orderId}:`, projectError);
    }
    return true;
  } catch (error) {
    console.error(`Error auto-settling order ${orderId} in MySQL:`, error);
    return false;
  }
}

export const unsettleOrderPayment = async (
  orderId: string,
  unsettleReason: string,
  actingUser: { id: string; name: string }
): Promise<boolean> => {
  await guard();
  try {
    const order = await getOrderById(orderId);
    if (!order) {
      console.warn(`[unsettleOrderPayment] Order ${orderId} not found. Cannot unsettle.`);
      return false;
    }

    const autoSettlePaymentIndex = (order.advancePayments || []).findIndex(
      p => p.notes?.startsWith("System auto-settled:") || p.paymentMethod === "COD" || p.notes?.startsWith("Order delivered.")
    );

    if (autoSettlePaymentIndex === -1) {
      console.log(`[unsettleOrderPayment] No auto-settled payment found for order ${orderId}. No action needed.`);
      return true;
    }

    const updatedPayments = [...(order.advancePayments || [])];
    updatedPayments.splice(autoSettlePaymentIndex, 1);

    const updates: Partial<TrackingLink> = {
      advancePayments: updatedPayments,
      updatedAt: new Date().toISOString(),
      updatedByUserId: actingUser.id,
      updatedByUserName: actingUser.name,
    };

    const newStatusLogEntry: OrderLogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      status: order.currentStatus, // Keep current status but add note
      changedByUserId: actingUser.id,
      changedByUserName: actingUser.name,
      notes: unsettleReason,
    };
    updates.statusHistory = [...order.statusHistory, newStatusLogEntry];

    await updateOrder(orderId, updates);
    console.log(`[unsettleOrderPayment] Successfully removed auto-settled payment for order ${orderId} in MySQL.`);
    return true;

  } catch (error) {
    console.error(`Error unsettling payment for order ${orderId} in MySQL:`, error);
    return false;
  }
};

export const addCommentToOrder = async (orderId: string, commentData: Omit<Comment, 'id' | 'timestamp' | 'replies' | 'likes'>): Promise<TrackingLink | undefined> => {
  await guard();
  try {
    const order = await getOrderById(orderId);
    if (!order) throw new Error("Order not found");

    const newComment: Comment = {
      id: uuidv4(),
      userName: commentData.userName,
      userRole: commentData.userRole,
      text: commentData.text,
      isInternal: commentData.isInternal,
      timestamp: new Date().toISOString(),
      replies: [],
      likes: { count: 0, reactedBy: [] },
      ...(commentData.userId && { userId: commentData.userId }),
    };

    const updatedComments = [...(order.comments || []), newComment];
    await updateOrder(orderId, { comments: updatedComments });
    return { ...order, comments: updatedComments };
  } catch (error) {
    console.error(`Error adding comment to order ${orderId} in MySQL:`, error);
    return undefined;
  }
};

export const addReplyToComment = async (
  orderId: string, parentCommentId: string, replyData: Omit<Comment, 'id' | 'timestamp' | 'replies' | 'likes'>
): Promise<TrackingLink | undefined> => {
  await guard();
  try {
    const order = await getOrderById(orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    const comments = order.comments || [];
    const parentCommentIndex = comments.findIndex(c => c.id === parentCommentId);
    if (parentCommentIndex === -1) throw new Error(`Parent comment ${parentCommentId} not found.`);

    const newReply: Comment = {
      id: uuidv4(),
      userName: replyData.userName,
      userRole: replyData.userRole,
      text: replyData.text,
      isInternal: replyData.isInternal,
      timestamp: new Date().toISOString(),
      replies: [],
      likes: { count: 0, reactedBy: [] },
      ...(replyData.userId && { userId: replyData.userId }),
    };

    const parentComment = comments[parentCommentIndex];
    parentComment.replies = [...(parentComment.replies || []), newReply];
    comments[parentCommentIndex] = parentComment;

    await updateOrder(orderId, { comments });
    return { ...order, comments };
  } catch (error) {
    console.error(`Error adding reply to comment ${parentCommentId} in order ${orderId} in MySQL:`, error);
    return undefined;
  }
};

export const toggleReaction = async (
  orderId: string, targetCommentId: string, isReply: boolean, parentCommentIdIfReply: string | undefined, reactorId: string, reactionType: 'like'
): Promise<TrackingLink | undefined> => {
  await guard();
  try {
    const order = await getOrderById(orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    const comments = [...(order.comments || [])];
    let targetComment: Comment | undefined;

    if (isReply) {
      if (!parentCommentIdIfReply) throw new Error("parentCommentIdIfReply is required for a reply reaction.");
      const parentComment = comments.find(c => c.id === parentCommentIdIfReply);
      if (!parentComment || !parentComment.replies) throw new Error(`Parent comment ${parentCommentIdIfReply} or its replies not found.`);
      targetComment = parentComment.replies.find(r => r.id === targetCommentId);
    } else {
      targetComment = comments.find(c => c.id === targetCommentId);
    }
    if (!targetComment) throw new Error(`Target comment/reply ${targetCommentId} not found.`);

    targetComment.likes = targetComment.likes || { count: 0, reactedBy: [] };
    const reactedByIndex = targetComment.likes.reactedBy.indexOf(reactorId);
    if (reactedByIndex > -1) {
      targetComment.likes.reactedBy.splice(reactedByIndex, 1);
      targetComment.likes.count = Math.max(0, targetComment.likes.count - 1);
    } else {
      targetComment.likes.reactedBy.push(reactorId);
      targetComment.likes.count += 1;
    }

    await updateOrder(orderId, { comments });
    return { ...order, comments };
  } catch (error) {
    console.error(`Error toggling reaction on comment ${targetCommentId} in order ${orderId} in MySQL:`, error);
    return undefined;
  }
};


export const deleteComment = async (
  orderId: string, targetCommentId: string, isReply: boolean, parentCommentIdIfReply: string | undefined
): Promise<TrackingLink | undefined> => {
  await guard();
  try {
    const order = await getOrderById(orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    let comments = [...(order.comments || [])];

    if (isReply) {
      if (!parentCommentIdIfReply) throw new Error("parentCommentIdIfReply is required for a reply.");
      const parentCommentIndex = comments.findIndex(c => c.id === parentCommentIdIfReply);
      if (parentCommentIndex === -1) throw new Error(`Parent comment ${parentCommentIdIfReply} not found.`);
      const parentComment = comments[parentCommentIndex];
      parentComment.replies = (parentComment.replies || []).filter(r => r.id !== targetCommentId);
      comments[parentCommentIndex] = parentComment;
    } else {
      comments = comments.filter(c => c.id !== targetCommentId);
    }

    await updateOrder(orderId, { comments });
    return { ...order, comments };
  } catch (error) {
    console.error(`Error deleting comment ${targetCommentId} in order ${orderId} in MySQL:`, error);
    return undefined;
  }
};

export const addShippedOrderEntry = async (orderId: string, trackingCode: string): Promise<boolean> => {
  await guard();
  try {
    await query(
      `INSERT INTO ${SHIPPED_ORDERS_TABLE} (order_id, tracking_code) VALUES (?, ?) ON DUPLICATE KEY UPDATE tracking_code = VALUES(tracking_code)`,
      [orderId, trackingCode]
    );
    console.log(`[ShippedOrders] Upserted entry for order ${orderId} in MySQL`);
    return true;
  } catch (error) {
    console.error(`Error upserting to shippedOrders in MySQL for order ${orderId}:`, error);
    return false;
  }
};

export const deleteShippedOrderEntry = async (orderId: string): Promise<boolean> => {
  await guard();
  try {
    await query(`DELETE FROM ${SHIPPED_ORDERS_TABLE} WHERE order_id = ?`, [orderId]);
    console.log(`[ShippedOrders] Removed entry for order ${orderId} from MySQL`);
    return true;
  } catch (error) {
    console.error(`Error deleting from shippedOrders in MySQL for order ${orderId}:`, error);
    return false;
  }
};

export const getShippedOrders = async (): Promise<{ orderId: string; packzyTrackingCode: string }[]> => {
  await guard();
  try {
    const rows = await query<any[]>(`SELECT order_id, tracking_code FROM ${SHIPPED_ORDERS_TABLE}`);
    return rows.map(row => ({
      orderId: row.order_id,
      packzyTrackingCode: row.tracking_code,
    }));
  } catch (error) {
    console.error("Error fetching shipped orders from MySQL:", error);
    return [];
  }
};



export const getClientById = async (id: string): Promise<any | null> => {
  await guard();
  if (!id) return null;
  try {
    const results = await query<any[]>(`SELECT * FROM clients WHERE id = ?`, [id]);
    if (results.length > 0) {
      return results[0];
    }
    return null;
  } catch (error) {
    console.error("Error fetching client by ID from MySQL:", error);
    return null;
  }
};

export const getDeliveredOrdersByDateRange = async (
  startDate?: string,
  endDate?: string,
  deliveredStatusId?: string,
  limit: number = 25,
  offset: number = 0
): Promise<{ orders: TrackingLink[]; total: number }> => {
  await guard();
  try {
    const conditions = ['o.is_deleted = FALSE'];
    const params: any[] = [];

    if (deliveredStatusId) {
      conditions.push('o.current_status = ?');
      params.push(deliveredStatusId);
    } else {
      conditions.push('o.current_status = "delivered"');
    }

    if (startDate && endDate) {
      conditions.push(`
        COALESCE(
          STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(o.status_history, CONCAT('$[', JSON_LENGTH(o.status_history) - 1, '].timestamp'))), 19), '%Y-%m-%dT%H:%i:%s'),
          o.updated_at,
          o.created_at
        ) BETWEEN ? AND ?
      `);
      params.push(startDate, endDate);
    }

    const whereSql = conditions.join(' AND ');

    const countResults = await query<any[]>(`
      SELECT COUNT(*) as total
      FROM ${ORDERS_TABLE} o 
      JOIN clients c ON o.client_id = c.id 
      WHERE ${whereSql}
    `, params);
    const total = countResults[0]?.total || 0;

    const results = await query<any[]>(`
      SELECT o.*, c.company_name, c.phone_number, c.address,
             uc.name as crm_user_name, uc.avatar_url as assignee_avatar_url,
             ud.name as designer_representative_name, ud.avatar_url as designer_representative_avatar_url,
             uu.name as updated_by_user_name,
             COALESCE(
               JSON_UNQUOTE(JSON_EXTRACT(o.status_history, CONCAT('$[', JSON_LENGTH(o.status_history) - 1, '].timestamp'))),
               o.updated_at,
               o.created_at
             ) as delivered_at
      FROM ${ORDERS_TABLE} o 
      JOIN clients c ON o.client_id = c.id 
      LEFT JOIN users uc ON o.crm_user_id = uc.id
      LEFT JOIN users ud ON o.designer_representative_id = ud.id
      LEFT JOIN users uu ON o.updated_by_user_id = uu.id
      WHERE ${whereSql}
      ORDER BY delivered_at DESC
      LIMIT ? OFFSET ?
    `, [...params, Number(limit), Number(offset)]);

    return {
      orders: results.map(mapRowToOrder),
      total
    };
  } catch (error) {
    console.error("Error fetching delivered orders by date range from MySQL:", error);
    return { orders: [], total: 0 };
  }
};

export interface OrderPulse {
  id: string; // customer_key
  companyName: string;
  phoneNumber: string;
  crmUserName?: string;
  designerRepresentativeName?: string;
  lastOrderDate: string;
  totalOrders: number;
  lastOrderId: string;
  lastOrderStatus: string;
  status?: string;
  statusColor?: string;
  monthsDiff?: number;
}

export const getOrderPulsesPaginated = async (
  startDate?: string,
  endDate?: string,
  inactivityThresholdMonths: number = 3,
  pulseStatusFilter: 'Active' | 'Inactive' | 'All' = 'All',
  page: number = 1,
  limit: number = 25,
  searchTerm?: string
): Promise<{ pulses: OrderPulse[], total: number }> => {
  await guard();
  try {
    const conditions = ['o.is_deleted = FALSE', 'LOWER(s.name) NOT LIKE ?'];
    const params: any[] = ['%cancel%'];

    if (startDate) {
      conditions.push('o.created_at >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('o.created_at <= ?');
      params.push(endDate);
    }

    const baseWhere = conditions.join(' AND ');

    const rankedQuery = `
      SELECT 
        o.id as lastOrderId,
        c.company_name as companyName,
        c.phone_number as phoneNumber,
        o.current_status as lastOrderStatus,
        o.created_at as lastOrderDate,
        uc.name as crmUserName,
        ud.name as designerRepresentativeName,
        COALESCE(NULLIF(TRIM(c.company_name), ''), NULLIF(TRIM(c.phone_number), ''), 'Unknown Customer') as customer_key,
        ROW_NUMBER() OVER(
          PARTITION BY COALESCE(NULLIF(TRIM(c.company_name), ''), NULLIF(TRIM(c.phone_number), ''), 'Unknown Customer') 
          ORDER BY o.created_at DESC
        ) as rn
      FROM ${ORDERS_TABLE} o
      JOIN clients c ON o.client_id = c.id
      LEFT JOIN order_statuses s ON o.current_status = s.id
      LEFT JOIN users uc ON o.crm_user_id = uc.id
      LEFT JOIN users ud ON o.designer_representative_id = ud.id
      WHERE ${baseWhere}
    `;

    const countQuery = `
      SELECT 
        COALESCE(NULLIF(TRIM(c.company_name), ''), NULLIF(TRIM(c.phone_number), ''), 'Unknown Customer') as customer_key,
        COUNT(o.id) as totalOrders
      FROM ${ORDERS_TABLE} o
      JOIN clients c ON o.client_id = c.id
      LEFT JOIN order_statuses s ON o.current_status = s.id
      WHERE ${baseWhere}
      GROUP BY customer_key
    `;

    const filterConditions = ['ro.rn = 1'];
    const extraFilterParams: any[] = [];

    if (pulseStatusFilter === 'Active') {
      filterConditions.push(`TIMESTAMPDIFF(MONTH, ro.lastOrderDate, NOW()) < 3`);
    } else if (pulseStatusFilter === 'Inactive') {
      filterConditions.push(`TIMESTAMPDIFF(MONTH, ro.lastOrderDate, NOW()) >= ?`);
      extraFilterParams.push(inactivityThresholdMonths);
    }

    if (searchTerm) {
      const likeTerm = `%${searchTerm}%`;
      filterConditions.push(`(
        ro.lastOrderId LIKE ? OR 
        ro.companyName LIKE ? OR 
        ro.phoneNumber LIKE ? OR 
        ro.crmUserName LIKE ? OR 
        ro.lastOrderStatus LIKE ?
      )`);
      extraFilterParams.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
    }

    const filterWhere = filterConditions.join(' AND ');

    const finalQuery = `
      WITH RankedOrders AS (${rankedQuery}),
           OrderCounts AS (${countQuery})
      SELECT 
        ro.customer_key as id,
        ro.companyName,
        ro.phoneNumber,
        ro.crmUserName,
        ro.designerRepresentativeName,
        ro.lastOrderDate,
        oc.totalOrders,
        ro.lastOrderId,
        ro.lastOrderStatus,
        TIMESTAMPDIFF(MONTH, ro.lastOrderDate, NOW()) as monthsDiff
      FROM RankedOrders ro
      JOIN OrderCounts oc ON ro.customer_key = oc.customer_key
      WHERE ${filterWhere}
      ORDER BY ro.lastOrderDate DESC
      LIMIT ? OFFSET ?
    `;

    const totalCountQuery = `
      WITH RankedOrders AS (${rankedQuery})
      SELECT COUNT(*) as total
      FROM RankedOrders ro
      WHERE ${filterWhere}
    `;

    const totalParams = [...params, ...extraFilterParams];
    const totalResult = await query<any[]>(totalCountQuery, totalParams);
    const total = totalResult[0]?.total || 0;

    const offset = Math.max(0, (page - 1) * limit);
    const finalParams = [...params, ...params, ...extraFilterParams, Number(limit), Number(offset)];
    
    const rows = await query<any[]>(finalQuery, finalParams);

    const pulses: OrderPulse[] = rows.map(row => {
      let status = 'Active';
      let statusColor = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      const monthsDiff = row.monthsDiff;
      
      if (monthsDiff >= 3) {
        status = `Inactive (${monthsDiff}+ Months)`;
        if (monthsDiff >= 6) {
          statusColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
        } else {
          statusColor = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
        }
      }

      return {
        id: row.id,
        companyName: row.companyName,
        phoneNumber: row.phoneNumber,
        crmUserName: row.crmUserName,
        designerRepresentativeName: row.designerRepresentativeName,
        lastOrderDate: row.lastOrderDate,
        totalOrders: row.totalOrders,
        lastOrderId: row.lastOrderId,
        lastOrderStatus: row.lastOrderStatus,
        status,
        statusColor,
        monthsDiff
      };
    });

    return { pulses, total };
  } catch (error) {
    console.error("Error fetching paginated order pulses from MySQL:", error);
    return { pulses: [], total: 0 };
  }
};




