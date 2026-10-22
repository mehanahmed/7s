import { addDays, differenceInCalendarDays, endOfDay, endOfMonth, format, getDaysInMonth, startOfDay, startOfMonth, subDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import type { GlobalSettings, TrackingLink, User } from '@/types';
import { CANCELLED_STATUS_ID } from './status-constants';
import { vatAmountFor } from './vat';

const amount = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

export interface OutstandingInvoice {
  id: string;
  companyName: string;
  crmName: string;
  crmUserId: string;
  createdAt: string;
  totalBilled: number;
  paidAmount: number;
  due: number;
}

/** Include recorded sales contacts even when they currently have an admin/other role.
 * Historical sales must not disappear when a user's role or suspension changes.
 */
export function getSalesExecutiveUsers(orders: TrackingLink[], users: User[]): User[] {
  const contactIds = new Set(orders.filter(order => order.currentStatus !== CANCELLED_STATUS_ID).map(order => order.crmUserId));
  return users.filter(user => user.role === 'CR' || contactIds.has(user.id));
}

export function calculateSalesExecutiveSummary(orders: TrackingLink[], users: User[], settings: GlobalSettings | null, userId: string, range?: DateRange) {
  const executives = getSalesExecutiveUsers(orders, users).filter(user => userId === 'all' || user.id === userId);
  const ids = new Set(executives.map(user => user.id));
  const start = range?.from ? startOfDay(range.from) : null;
  const end = start ? endOfDay(range?.to ?? start) : null;
  const inPeriod = (createdAt: string, from = start, to = end) => {
    const date = new Date(createdAt);
    return Number.isFinite(date.getTime()) && (!from || date >= from) && (!to || date <= to);
  };
  const eligible = orders.filter(order => ids.has(order.crmUserId) && order.currentStatus !== CANCELLED_STATUS_ID);
  const netSales = (order: TrackingLink) => Math.max(0,
    (order.orderItems ?? []).reduce((sum, item) => sum + (item.isGift ? 0 : amount(item.lineItemTotalPrice)), 0) - amount(order.specialClientDiscount)
  );
  let totalSales = 0, billed = 0, collected = 0, outstanding = 0, completedOrders = 0, orderCount = 0;
  const outstandingInvoices: OutstandingInvoice[] = [];
  const completionStatuses = settings?.crmCompletionStatusIds ?? [];
  for (const order of eligible.filter(order => inPeriod(order.createdAt))) {
    orderCount++;
    const net = netSales(order);
    const invoice = net + vatAmountFor(net, order.vatPercentage) + amount(order.shippingCharge);
    const paid = (order.advancePayments ?? []).reduce((sum, payment) => sum + amount(payment.amount), 0);
    totalSales += net;
    billed += invoice;
    collected += Math.min(paid, invoice);
    outstanding += Math.max(0, invoice - paid);
    if (invoice > paid) {
      outstandingInvoices.push({
        id: order.id,
        companyName: order.companyName,
        crmName: order.crmUserName || 'Unassigned',
        crmUserId: order.crmUserId,
        createdAt: order.createdAt,
        totalBilled: invoice,
        paidAmount: paid,
        due: invoice - paid,
      });
    }
    if (!completionStatuses.length || completionStatuses.includes(order.currentStatus)) completedOrders++;
  }
  let monthFraction = 0;
  if (start && end && start <= end) {
    for (let month = startOfMonth(start); month <= end; month = startOfMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))) {
      const from = month < start ? start : month;
      const monthEnd = endOfMonth(month);
      const to = monthEnd > end ? end : monthEnd;
      monthFraction += (differenceInCalendarDays(to, from) + 1) / getDaysInMonth(month);
    }
  }
  const target = executives.reduce((sum, user) => sum + amount(user.monthlySalesTarget), 0) * monthFraction;
  const targetFailed = Math.max(0, target - totalSales);
  const targetAchieved = totalSales;

  let salesChange: number | null = null;
  const trend: { date: string; label: string; sales: number; previousSales: number; previousDate: string }[] = [];
  if (start && end) {
    const days = differenceInCalendarDays(end, start) + 1;
    const previousStart = subDays(start, days);
    const previousEnd = endOfDay(subDays(start, 1));
    const previousSales = eligible.filter(order => inPeriod(order.createdAt, previousStart, previousEnd)).reduce((sum, order) => sum + netSales(order), 0);
    if (previousSales > 0) salesChange = ((totalSales - previousSales) / previousSales) * 100;
    const dailySales = new Map<string, number>();
    for (const order of eligible) {
      const date = new Date(order.createdAt);
      if (!Number.isFinite(date.getTime())) continue;
      const key = format(date, 'yyyy-MM-dd');
      dailySales.set(key, (dailySales.get(key) ?? 0) + netSales(order));
    }
    const bucketDays = days > 90 ? 7 : 1;
    for (let offset = 0; offset < days; offset += bucketDays) {
      const date = addDays(start, offset);
      let sales = 0, previousSales = 0;
      for (let day = offset; day < Math.min(days, offset + bucketDays); day++) {
        sales += dailySales.get(format(addDays(start, day), 'yyyy-MM-dd')) ?? 0;
        previousSales += dailySales.get(format(addDays(previousStart, day), 'yyyy-MM-dd')) ?? 0;
      }
      trend.push({ date: format(date, 'dd MMM yyyy'), label: format(date, 'MMM dd'), sales, previousSales, previousDate: format(addDays(previousStart, offset), 'dd MMM yyyy') });
    }
  }
  return {
    totalSales,
    collected,
    outstanding,
    completedOrders,
    orderCount,
    target,
    targetAchieved,
    targetFailed,
    trend,
    outstandingInvoices,
    weeklyTrend: trend.length > 0 && !!start && !!end && differenceInCalendarDays(end, start) + 1 > 90,
    achievement: target > 0 ? totalSales / target * 100 : null,
    collectionPercent: billed > 0 ? collected / billed * 100 : 0,
    salesChange,
    isMonthly: !!start && !!end && start.getDate() === 1 && end.getDate() === getDaysInMonth(start) && start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear(),
    usesCompletionStatuses: completionStatuses.length > 0,
  };
}

export function calculateExecutivePerformance(orders: TrackingLink[], users: User[], settings: GlobalSettings | null, userId: string, range?: DateRange) {
  const executives = getSalesExecutiveUsers(orders, users).filter(user => userId === 'all' || user.id === userId);
  const rows = executives.map(user => {
    const summary = calculateSalesExecutiveSummary(orders, users, settings, user.id, range);
    return { id: user.id, name: user.name, avatarUrl: user.avatarUrl,
      orders: summary.orderCount, sales: summary.totalSales, collected: summary.collected,
      monthlyTarget: amount(user.monthlySalesTarget),
      periodTarget: summary.target, achievement: summary.achievement, completedOrders: summary.completedOrders,
    };
  }).sort((a, b) => b.sales - a.sales || b.orders - a.orders || a.name.localeCompare(b.name));
  const totals = calculateSalesExecutiveSummary(orders, users, settings, userId, range);
  const firstOrderByClient = new Map<string, string>();
  const validOrders = orders.filter(order => order.currentStatus !== CANCELLED_STATUS_ID && Number.isFinite(Date.parse(order.createdAt)))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
  for (const order of validOrders) {
    if (order.clientId && !firstOrderByClient.has(order.clientId)) firstOrderByClient.set(order.clientId, order.id);
  }
  const ids = new Set(executives.map(user => user.id));
  const from = range?.from ? startOfDay(range.from) : null;
  const to = from ? endOfDay(range?.to ?? from) : null;
  const selectedOrders = validOrders.filter(order => ids.has(order.crmUserId) && (!from || new Date(order.createdAt) >= from) && (!to || new Date(order.createdAt) <= to));
  const repeatSales = selectedOrders.reduce((sum, order) => {
    if (!order.clientId || firstOrderByClient.get(order.clientId) === order.id) return sum;
    return sum + Math.max(0, (order.orderItems ?? []).reduce((value, item) => value + (item.isGift ? 0 : amount(item.lineItemTotalPrice)), 0) - amount(order.specialClientDiscount));
  }, 0);
  return { rows, totalOrders: totals.orderCount, totalSales: totals.totalSales,
    averageOrderValue: totals.orderCount > 0 ? totals.totalSales / totals.orderCount : 0,
    repeatSalesPercent: selectedOrders.some(order => !order.clientId) ? null : totals.totalSales > 0 ? repeatSales / totals.totalSales * 100 : 0,
    isMonthly: totals.isMonthly,
  };
}
