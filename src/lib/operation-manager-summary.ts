import { endOfDay, startOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import type { TrackingLink } from '@/types';
import { CANCELLED_STATUS_ID, DELIVERED_STATUS_ID } from './status-constants';
import { orderStatusIdForStage, PROJECT_STAGE_CONFIG, stageForOrderStatus } from './project-stages';
import { getLatestOrderAssignee } from './latest-order-assignee';

const validDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

export function calculateOperationManagerSummary(orders: TrackingLink[], userId: string, range?: DateRange, now = new Date()) {
  const from = range?.from ? startOfDay(range.from) : null;
  const to = from ? endOfDay(range?.to ?? from) : null;
  const inRange = (date: Date | null) => !!date && (!from || date >= from) && (!to || date <= to);
  const managerStage = orderStatusIdForStage('Operation Manager');
  const finishedStages = new Set([orderStatusIdForStage('Project Complete'), orderStatusIdForStage('Due Payment'), DELIVERED_STATUS_ID, 'shipped', 'logistics']);
  let assignedProjects = 0, newAssignments = 0, activeProjects = 0, pendingHandover = 0, onTime = 0, datedDeliveries = 0;
  let delivered = 0, completedProjects = 0, blockedProjects = 0, turnaroundMs = 0, turnaroundCount = 0, handoverMs = 0, handoverCount = 0;
  const stageCounts = new Map<string, number>();
  const attention: { id: string; companyName: string; stage: ReturnType<typeof stageForOrderStatus>; assignee: ReturnType<typeof getLatestOrderAssignee>; deliveryDate: string | null; priority: string; priorityOrder: number }[] = [];

  for (const order of orders) {
    const manager = order.stageAssignees?.OM;
    if (!manager || order.currentStatus === CANCELLED_STATUS_ID || (userId !== 'all' && manager.id !== userId)) continue;
    const history = order.statusHistory ?? [];
    const assignmentEntry = [...history].reverse().find(entry => entry.status === managerStage);
    const assignedAt = validDate(manager.assignedAt) ?? validDate(assignmentEntry?.timestamp) ?? validDate(order.createdAt);
    if (!assignedAt || (to && assignedAt > to)) continue;
    assignedProjects++;
    if (inRange(assignedAt)) newAssignments++;
    const isActive = !finishedStages.has(order.currentStatus);
    if (isActive) {
      activeProjects++;
      const stage = stageForOrderStatus(order.currentStatus);
      stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
    }
    if (order.currentStatus === managerStage) pendingHandover++;

    const deliveryEntry = [...history].filter(entry => entry.status === DELIVERED_STATUS_ID || entry.status === 'shipped')
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
    const deliveredAt = validDate(deliveryEntry?.timestamp);
    const deadline = validDate(order.acceptedDeliveryDate);
    if (inRange(deliveredAt)) {
      delivered++;
      const created = validDate(order.createdAt);
      if (created && deliveredAt! >= created) { turnaroundMs += deliveredAt!.getTime() - created.getTime(); turnaroundCount++; }
    }
    if (inRange(deliveredAt) && deadline) {
      datedDeliveries++;
      if (deliveredAt! <= endOfDay(deadline)) onTime++;
    }
    const completionEntry = history.filter(entry => entry.status === orderStatusIdForStage('Project Complete') || entry.status === 'logistics')
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
    if (inRange(validDate(completionEntry?.timestamp))) completedProjects++;
    if (order.currentStatus === orderStatusIdForStage('On Hold')) blockedProjects++;
    const handoverEntry = history.filter(entry => entry.status === orderStatusIdForStage('On Script') && (validDate(entry.timestamp)?.getTime() ?? -Infinity) >= assignedAt.getTime())
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))[0];
    const handedOverAt = validDate(handoverEntry?.timestamp);
    if (inRange(handedOverAt)) { handoverMs += handedOverAt!.getTime() - assignedAt.getTime(); handoverCount++; }

    if (isActive) {
      let priority = '', priorityOrder = 5;
      if (deadline && endOfDay(deadline) < startOfDay(now)) { priority = 'Overdue'; priorityOrder = 0; }
      else if (deadline && startOfDay(deadline).getTime() === startOfDay(now).getTime()) { priority = 'Due today'; priorityOrder = 1; }
      else if (order.currentStatus === orderStatusIdForStage('On Hold')) { priority = 'Blocked'; priorityOrder = 2; }
      else if (order.currentStatus === managerStage) { priority = 'Handover pending'; priorityOrder = 3; }
      else if (order.currentStatus === orderStatusIdForStage('Client Revision')) { priority = 'Client response'; priorityOrder = 4; }
      if (priority) attention.push({ id: order.id, companyName: order.companyName, stage: stageForOrderStatus(order.currentStatus), assignee: getLatestOrderAssignee(order), deliveryDate: deadline ? order.acceptedDeliveryDate! : null, priority, priorityOrder });
    }
  }
  const primaryStages = new Set(['Operation Manager', 'On Script', 'Artist Booked', 'Cinematographer', 'On Editor', 'Client Revision']);
  const flow = PROJECT_STAGE_CONFIG.filter(config => primaryStages.has(config.status) || (stageCounts.get(config.status) ?? 0) > 0)
    .map(config => ({ stage: config.status, color: config.color, count: stageCounts.get(config.status) ?? 0 }));
  attention.sort((a, b) => a.priorityOrder - b.priorityOrder || (validDate(a.deliveryDate)?.getTime() ?? Infinity) - (validDate(b.deliveryDate)?.getTime() ?? Infinity) || a.id.localeCompare(b.id));
  return { assignedProjects, newAssignments, activeProjects, pendingHandover, onTime, datedDeliveries, delivered,
    lateDeliveries: datedDeliveries - onTime, undatedDeliveries: delivered - datedDeliveries,
    completedProjects, blockedProjects, flow, attention,
    averageTurnaroundDays: turnaroundCount > 0 ? turnaroundMs / turnaroundCount / 86400000 : null,
    averageHandoverDays: handoverCount > 0 ? handoverMs / handoverCount / 86400000 : null,
    onTimePercent: datedDeliveries > 0 ? onTime / datedDeliveries * 100 : null,
  };
}
