
"use server";

import { query } from './mysql';
import type { SowDataEntry, TrackingLink, OrderItem, GlobalSettings } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { getOrders } from './order-service';
import { getGlobalSettings } from './settings-service';
import { guard } from '@/lib/guard';
import { isDrRole } from '@/lib/roles';

const TABLE_NAME = 'sow_data';

export const getSowEntries = async (startDate?: string, endDate?: string, role?: string, userId?: string, searchTerm?: string): Promise<SowDataEntry[]> => {
  await guard();
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    if (startDate) {
      conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.createdAt')) >= ?`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.createdAt')) <= ?`);
      params.push(endDate);
    }
    if (userId && userId !== 'all' && (role === 'CR' || isDrRole(role))) {
      conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.createdByUserId')) = ?`);
      params.push(userId);
    }
    if (searchTerm) {
      conditions.push(`data_json LIKE ?`);
      params.push(`%${searchTerm}%`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query<any[]>(`SELECT id, data_json FROM ${TABLE_NAME} ${whereClause} ORDER BY id DESC`, params);
    return rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as SowDataEntry)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Error fetching SOW entries from MySQL:", error);
    return [];
  }
};

export const addSowEntry = async (data: Omit<SowDataEntry, 'id'>): Promise<SowDataEntry | null> => {
  await guard();
  try {
    const id = uuidv4();
    const dataWithId: SowDataEntry = { ...data, id } as SowDataEntry;
    await query(`INSERT INTO ${TABLE_NAME} (id, data_json) VALUES (?, ?)`, [id, JSON.stringify(dataWithId)]);
    return dataWithId;
  } catch (error) {
    console.error("Error adding SOW entry to MySQL:", error);
    return null;
  }
};

export interface SowData {
  id: string; // Client ID
  orderDate: string;
  businessName: string;
  address: string;
  phoneNumber: string;
  purchasedCategories: string[];
  unmatchedPurchasedItems: string[];
  allCategories: string[];
  amount: number;
  loyaltyScore: number;
}

export const getSowDataPaginated = async (
  page: number = 1,
  limit: number = 12,
  startDate?: string,
  endDate?: string,
  role?: string,
  userId?: string,
  searchTerm?: string,
  sortConfig?: { key: 'orderDate' | 'loyaltyScore' | 'products'; direction: 'asc' | 'desc' } | null
): Promise<{ data: SowData[]; total: number; globalSettings: GlobalSettings | null }> => {
  await guard();
  try {
    const [orders, sowEntries, globalSettings] = await Promise.all([
      getOrders(startDate, endDate, role, userId, undefined, undefined, searchTerm),
      getSowEntries(startDate, endDate, role, userId, searchTerm),
      getGlobalSettings(),
    ]);

    const filters = globalSettings?.reportProductFilters || [];
    const ordersByJobId = new Map<string, { orders: TrackingLink[]; businessName: string; latestDate: string; address: string; phoneNumber: string; manualAmount: number }>();

    orders.forEach(order => {
      const companyNameParts = (order.companyName || '').split(' • ');
      const jobId = companyNameParts[0].trim();
      if (!jobId) return;

      const businessName = companyNameParts.length > 1 ? companyNameParts.slice(1).join(' • ').trim() : order.companyName;
      const existing = ordersByJobId.get(jobId) || { orders: [], businessName, latestDate: order.createdAt, address: order.address, phoneNumber: order.phoneNumber, manualAmount: 0 };
      existing.orders.push(order);

      if (new Date(order.createdAt) > new Date(existing.latestDate)) {
        existing.latestDate = order.createdAt;
        existing.businessName = businessName;
        existing.address = order.address;
        existing.phoneNumber = order.phoneNumber;
      }
      ordersByJobId.set(jobId, existing);
    });

    sowEntries.forEach(entry => {
      const jobId = entry.jobId;
      const existing = ordersByJobId.get(jobId) || { orders: [], businessName: entry.businessName, latestDate: entry.createdAt, address: entry.address, phoneNumber: entry.phoneNumber, manualAmount: 0 };
      
      const sowAsOrderItem: OrderItem = {
        id: entry.id,
        model: entry.category,
        quantity: 1,
        lamination: 'N/A',
        unitPrice: entry.amount || 0,
        lineItemTotalPrice: entry.amount || 0,
      };

      const pseudoOrder: TrackingLink = {
        id: entry.id,
        companyName: `${entry.jobId} • ${entry.businessName}`,
        address: entry.address,
        phoneNumber: entry.phoneNumber,
        orderItems: [sowAsOrderItem],
        createdAt: entry.createdAt,
        crmUserId: entry.crmUserId,
        crmUserName: entry.crmUserName,
        currentStatus: 'sow-entry',
        isPublic: false,
        statusHistory: [],
        comments: []
      };
      
      existing.orders.push(pseudoOrder);
      existing.manualAmount += entry.amount || 0;

      if (new Date(entry.createdAt) > new Date(existing.latestDate)) {
        existing.latestDate = entry.createdAt;
        existing.businessName = entry.businessName;
        existing.address = entry.address;
        existing.phoneNumber = entry.phoneNumber;
      }
      ordersByJobId.set(jobId, existing);
    });

    let allSowData: SowData[] = Array.from(ordersByJobId.entries()).map(([jobId, group]) => {
      const allItemsFromGroup = group.orders.flatMap(o => o.orderItems || []);
      const matchedFilters = new Set<string>();
      const unmatchedItems = new Set<string>();

      if (allItemsFromGroup.length > 0) {
        allItemsFromGroup.forEach(item => {
          let isItemMatched = false;
          if (filters.length > 0) {
            for (const filter of filters) {
              if (item.model.toLowerCase().includes(filter.toLowerCase())) {
                matchedFilters.add(filter);
                isItemMatched = true;
              }
            }
          }
          if (!isItemMatched) {
            unmatchedItems.add(item.model);
          }
        });
      }

      const totalAmount = group.orders.reduce((sum, order) => {
        const orderTotal = (order.orderItems || []).reduce((itemSum, item) => itemSum + (item.isGift ? 0 : (item.lineItemTotalPrice || 0)), 0);
        return sum + orderTotal;
      }, 0);

      const loyaltyScore = Math.min(100, Math.floor(totalAmount / 1000));

      return {
        id: jobId,
        orderDate: group.latestDate,
        businessName: group.businessName,
        address: group.address,
        phoneNumber: group.phoneNumber,
        purchasedCategories: Array.from(matchedFilters),
        unmatchedPurchasedItems: Array.from(unmatchedItems),
        allCategories: filters,
        amount: totalAmount,
        loyaltyScore
      };
    });

    if (sortConfig) {
      allSowData.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        if (sortConfig.key === 'orderDate') {
          aValue = new Date(a.orderDate).getTime();
          bValue = new Date(b.orderDate).getTime();
        } else if (sortConfig.key === 'loyaltyScore') {
          aValue = a.loyaltyScore;
          bValue = b.loyaltyScore;
        } else if (sortConfig.key === 'products') {
          aValue = a.purchasedCategories.length;
          bValue = b.purchasedCategories.length;
        }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      allSowData.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    }

    const total = allSowData.length;
    const startIndex = (page - 1) * limit;
    const paginatedData = allSowData.slice(startIndex, startIndex + limit);

    return {
      data: paginatedData,
      total,
      globalSettings
    };
  } catch (error) {
    console.error("Error fetching SOW paginated data:", error);
    return { data: [], total: 0, globalSettings: null };
  }
};
