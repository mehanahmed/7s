import { differenceInSeconds, differenceInCalendarDays, eachDayOfInterval, eachMonthOfInterval, endOfDay, format, isValid, parseISO, startOfDay, startOfMonth } from 'date-fns';
import type { Project, ProjectStatusType, TrackingLink } from '@/types';
import { PROJECT_STAGE_CONFIG, orderStatusIdForStage } from './project-stages';
import { CANCELLED_STATUS_ID } from './status-constants';

const validDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
};

export interface ScriptAssignmentTrend {
  date: string;
  assigned: number;
  completed: number;
}

export interface ScriptActivityDay extends ScriptAssignmentTrend {
  onTime: number;
  slaBreach: number;
  missed: number;
  pending: number;
}

export const emptyScriptActivityDay = (date: string): ScriptActivityDay => ({
  date, assigned: 0, completed: 0, onTime: 0, slaBreach: 0, missed: 0, pending: 0,
});

export function scriptActivityStatus(day: ScriptActivityDay) {
  if (day.missed > 0) return 'missed';
  if (day.slaBreach > 0) return 'sla-breach';
  if (day.onTime > 0) return 'on-time';
  if (day.assigned > 0) return 'assigned';
  if (day.pending > 0) return 'gap';
  return 'no-activity';
}

/** Assignment cohort for one script writer; completed work stays counted after handover. */
export function getScriptWriterSummary(
  projects: Project[], orders: TrackingLink[], userId: string,
  range?: { from?: Date; to?: Date }, now = new Date(),
) {
  const projectCounts = Object.fromEntries(PROJECT_STAGE_CONFIG.map(stage => [stage.status, 0])) as Record<ProjectStatusType, number>;
  const summary = { totalAssigned: 0, completed: 0, slaBreach: 0, onTime: 0, projectCounts };
  const from = range?.from ? startOfDay(range.from) : null;
  const to = range?.from ? endOfDay(range.to ?? range.from) : null;
  const monthly = !!from && !!to && differenceInCalendarDays(to, from) > 62;
  const trend = new Map<string, ScriptAssignmentTrend>();
  const dailyActivity = new Map<string, ScriptActivityDay>();
  const bucketKey = (date: Date) => format(date, monthly ? 'yyyy-MM' : 'yyyy-MM-dd');
  if (from && to && isValid(from) && isValid(to) && from <= to) {
    const dates = monthly
      ? eachMonthOfInterval({ start: startOfMonth(from), end: to })
      : eachDayOfInterval({ start: from, end: to });
    dates.forEach(date => { const key = bucketKey(date); trend.set(key, { date: key, assigned: 0, completed: 0 }); });
    eachDayOfInterval({ start: from, end: to }).forEach(date => {
      const key = format(date, 'yyyy-MM-dd');
      dailyActivity.set(key, emptyScriptActivityDay(key));
    });
  }
  const recordActivity = (date: Date, metric: Exclude<keyof ScriptActivityDay, 'date'>) => {
    if (date > now || (from && date < from) || (to && date > to)) return;
    const key = format(date, 'yyyy-MM-dd');
    const point = dailyActivity.get(key) ?? emptyScriptActivityDay(key);
    point[metric]++;
    dailyActivity.set(key, point);
  };
  const orderMap = new Map(orders.map(order => [order.id, order]));
  const scriptStatus = orderStatusIdForStage('On Script');
  const doneStatus = orderStatusIdForStage('Script Done');

  for (const project of projects) {
    const order = orderMap.get(project.id);
    if (!order || order.currentStatus === CANCELLED_STATUS_ID) continue;
    const writer = project.stageAssignees?.SW ?? order.stageAssignees?.SW;
    // Explicit SW assignments take precedence over the legacy representative field.
    if (writer ? writer.id !== userId : project.designerRepresentativeId !== userId) continue;

    const history = (order.statusHistory ?? [])
      .map(entry => ({ status: entry.status, date: validDate(entry.timestamp) }))
      .filter((entry): entry is { status: string; date: Date } => entry.date !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const scriptEntries = history.filter(entry => entry.status === scriptStatus);
    const assignedAt = validDate(writer?.assignedAt) ?? scriptEntries.at(-1)?.date ?? validDate(project.onDesignAt);
    if (!assignedAt || assignedAt > now) continue;
    const startedAt = scriptEntries.filter(entry => entry.date >= assignedAt).at(-1)?.date ?? assignedAt;
    const completedAt = history.find(entry => entry.status === doneStatus && entry.date >= startedAt && entry.date <= now)?.date
      ?? validDate(project.scriptDoneAt);
    const completed = !!completedAt && completedAt >= startedAt && completedAt <= now;
    recordActivity(assignedAt, 'assigned');
    if (completed) recordActivity(completedAt!, 'completed');
    // Match ProjectCard: one twelfth of the delivery window, or 48h without a delivery date.
    const delivery = validDate(project.endDate);
    let deadline: Date;
    if (delivery) {
      const dates = [project.createdAt, project.updatedAt, ...PROJECT_STAGE_CONFIG.map(stage => project[stage.timestampField])]
        .map(value => typeof value === 'string' ? validDate(value) : null)
        .filter((date): date is Date => date !== null);
      const projectStart = dates.length ? new Date(Math.min(...dates.map(date => date.getTime()))) : startedAt;
      const deliveryDays = Math.max(1, differenceInSeconds(delivery, projectStart) / 86400);
      deadline = new Date(startedAt.getTime() + Math.round(deliveryDays / 12 * 86400000));
    } else {
      deadline = new Date(startedAt.getTime() + 48 * 3600000);
    }

    if (completed) {
      recordActivity(completedAt!, completedAt! <= deadline ? 'onTime' : 'slaBreach');
    } else if (project.status === 'On Script' && now > deadline) {
      recordActivity(deadline, now > endOfDay(deadline) ? 'missed' : 'slaBreach');
    }
    // A red day means the deadline date passed without a script completion.
    if (completed && completedAt! > endOfDay(deadline)) recordActivity(deadline, 'missed');
    const pendingEnd = completed ? completedAt! : project.status === 'On Script' ? now : null;
    if (pendingEnd) {
      const pendingStart = from && from > startedAt ? from : startedAt;
      const pendingTo = to && to < pendingEnd ? to : pendingEnd;
      if (pendingStart <= pendingTo) {
        eachDayOfInterval({ start: pendingStart, end: pendingTo }).forEach(day => recordActivity(day, 'pending'));
      }
    }

    if ((from && assignedAt < from) || (to && assignedAt > to)) continue;
    summary.totalAssigned++;
    if (projectCounts[project.status] !== undefined) projectCounts[project.status]++;
    if (completed) summary.completed++;
    const dateKey = bucketKey(assignedAt);
    const bucket = trend.get(dateKey) ?? { date: dateKey, assigned: 0, completed: 0 };
    bucket.assigned++;
    if (completed) bucket.completed++;
    trend.set(dateKey, bucket);

    if (completed) {
      if (completedAt! <= deadline) summary.onTime++;
      else summary.slaBreach++;
    } else if (project.status === 'On Script' && now > deadline) {
      summary.slaBreach++;
    }
  }
  return {
    ...summary,
    assignmentTrend: Array.from(trend.values()).sort((a, b) => a.date.localeCompare(b.date)),
    dailyActivity: Array.from(dailyActivity.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
}
