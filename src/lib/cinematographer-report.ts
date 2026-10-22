import { addDays, differenceInCalendarDays, endOfDay, format, startOfDay, subDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import type { TrackingLink, User } from '@/types';
import { CANCELLED_STATUS_ID, ON_HOLD_STATUS_ID } from './status-constants';
import { orderStatusIdForStage } from './project-stages';

const CG_ASSIGNMENT_STATUS_ID = orderStatusIdForStage('Cinematographer');

const dateOf = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

export function calculateCinematographerReport(orders: TrackingLink[], users: User[], userId: string, range?: DateRange, now = new Date()) {
  const from = range?.from ? startOfDay(range.from) : null;
  const to = from ? endOfDay(range?.to ?? from) : null;
  const inRange = (date: Date) => (!from || date >= from) && (!to || date <= to);
  const userMap = new Map(users.map(user => [user.id, user]));
  const rows = new Map<string, { id: string; name: string; avatarUrl?: string | null; assigned: number; completed: number; pending: number; productionMs: number; timedCompletions: number }>();
  for (const user of users.filter(user => user.role === 'CG' && (userId === 'all' || user.id === userId))) {
    rows.set(user.id, { id: user.id, name: user.name, avatarUrl: user.avatarUrl, assigned: 0, completed: 0, pending: 0, productionMs: 0, timedCompletions: 0 });
  }
  let assigned = 0, completed = 0, inProduction = 0, onHold = 0, newAssignments = 0, productionMs = 0, timedCompletions = 0;
  const dailyCompletions = new Map<string, number>();
  const attention: { id: string; companyName: string; cinematographerId: string; cinematographerName: string; stage: 'Cinematographer' | 'Approval Period' | 'On Hold'; deadline: string | null; priority: 'Overdue' | 'Due today' | 'On hold'; priorityOrder: number }[] = [];

  for (const order of orders) {
    if (order.currentStatus === CANCELLED_STATUS_ID) continue;
    const cinematographer = order.stageAssignees?.CG ?? (order.designerRepresentativeId && userMap.get(order.designerRepresentativeId)?.role === 'CG'
      ? { id: order.designerRepresentativeId, name: order.designerRepresentativeName || userMap.get(order.designerRepresentativeId)!.name, assignedAt: undefined }
      : null);
    if (!cinematographer || (userId !== 'all' && cinematographer.id !== userId)) continue;
    const history = (order.statusHistory ?? []).filter(entry => !!dateOf(entry.timestamp)).slice().sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const assignmentEntry = history.filter(entry => entry.status === CG_ASSIGNMENT_STATUS_ID).slice(-1)[0];
    const assignedAt = dateOf(cinematographer.assignedAt) ?? dateOf(assignmentEntry?.timestamp) ?? dateOf(order.createdAt);
    if (!assignedAt || (to && assignedAt > to)) continue;
    const doneEntry = history.find(entry => entry.status === 'cg-complete' && Date.parse(entry.timestamp) >= assignedAt.getTime());
    const doneAt = dateOf(doneEntry?.timestamp);
    const isDone = !!doneAt && (!to || doneAt <= to);
    const person = userMap.get(cinematographer.id);
    const row = rows.get(cinematographer.id) ?? { id: cinematographer.id, name: person?.name || cinematographer.name, avatarUrl: person?.avatarUrl, assigned: 0, completed: 0, pending: 0, productionMs: 0, timedCompletions: 0 };
    rows.set(cinematographer.id, row);
    assigned++; row.assigned++;
    if (inRange(assignedAt)) newAssignments++;
    if (doneAt) {
      const key = format(doneAt, 'yyyy-MM-dd');
      dailyCompletions.set(key, (dailyCompletions.get(key) ?? 0) + 1);
    }
    if (isDone) {
      completed++; row.completed++;
      if (inRange(doneAt!)) {
        const duration = doneAt!.getTime() - assignedAt.getTime();
        productionMs += duration; timedCompletions++; row.productionMs += duration; row.timedCompletions++;
      }
      continue;
    }
    row.pending++;
    const held = order.currentStatus === ON_HOLD_STATUS_ID;
    if (held) onHold++; else inProduction++;
    const deadline = dateOf(order.acceptedDeliveryDate);
    let priority: 'Overdue' | 'Due today' | 'On hold' | null = held ? 'On hold' : null;
    let priorityOrder = held ? 2 : 3;
    if (deadline && endOfDay(deadline) < startOfDay(now)) { priority = 'Overdue'; priorityOrder = 0; }
    else if (deadline && startOfDay(deadline).getTime() === startOfDay(now).getTime()) { priority = 'Due today'; priorityOrder = 1; }
    if (priority) attention.push({ id: order.id, companyName: order.companyName, cinematographerId: cinematographer.id, cinematographerName: row.name, stage: held ? 'Approval Period' : 'Cinematographer', deadline: deadline ? order.acceptedDeliveryDate! : null, priority, priorityOrder });
  }
  const performance = Array.from(rows.values()).map(row => ({ ...row,
    completionPercent: row.assigned > 0 ? row.completed / row.assigned * 100 : 0,
    averageProductionDays: row.timedCompletions ? row.productionMs / row.timedCompletions / 86400000 : null,
  })).sort((a, b) => b.completed - a.completed || b.assigned - a.assigned || a.name.localeCompare(b.name));
  attention.sort((a, b) => a.priorityOrder - b.priorityOrder || (dateOf(a.deadline)?.getTime() ?? Infinity) - (dateOf(b.deadline)?.getTime() ?? Infinity) || a.id.localeCompare(b.id));
  const trend: { label: string; date: string; completed: number; previous: number; previousDate: string }[] = [];
  const days = from && to ? differenceInCalendarDays(to, from) + 1 : 0;
  const weeklyTrend = days > 90;
  if (from && days > 0) {
    const previousStart = subDays(from, days);
    const bucket = weeklyTrend ? 7 : 1;
    for (let offset = 0; offset < days; offset += bucket) {
      let current = 0, previous = 0;
      for (let day = offset; day < Math.min(days, offset + bucket); day++) {
        current += dailyCompletions.get(format(addDays(from, day), 'yyyy-MM-dd')) ?? 0;
        previous += dailyCompletions.get(format(addDays(previousStart, day), 'yyyy-MM-dd')) ?? 0;
      }
      const date = addDays(from, offset);
      trend.push({ label: format(date, 'MMM dd'), date: format(date, 'dd MMM yyyy'), completed: current, previous, previousDate: format(addDays(previousStart, offset), 'dd MMM yyyy') });
    }
  }
  return { assigned, completed, pending: assigned - completed, inProduction, onHold, newAssignments, performance, attention, trend, weeklyTrend,
    completionPercent: assigned > 0 ? completed / assigned * 100 : 0,
    averageProductionDays: timedCompletions ? productionMs / timedCompletions / 86400000 : null,
  };
}
