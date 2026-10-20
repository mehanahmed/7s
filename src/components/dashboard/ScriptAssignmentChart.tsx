"use client";

import { useMemo, useState } from 'react';
import { addDays, differenceInCalendarDays, endOfYear, format, isValid, parseISO, startOfDay, startOfWeek, startOfYear } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { emptyScriptActivityDay, getScriptWriterSummary, scriptActivityStatus, type ScriptActivityDay } from '@/lib/script-writer-summary';
import type { Project, TrackingLink } from '@/types';

const completedLevels = [
  'bg-muted border-border/50',
  'bg-emerald-200 border-emerald-300 dark:bg-emerald-950 dark:border-emerald-900',
  'bg-emerald-400 border-emerald-500 dark:bg-emerald-800 dark:border-emerald-700',
  'bg-emerald-600 border-emerald-700 dark:bg-emerald-600 dark:border-emerald-500',
  'bg-emerald-800 border-emerald-900 dark:bg-emerald-400 dark:border-emerald-300',
];
const activityStyles = {
  'no-activity': { label: 'No activity', color: 'bg-transparent border-border/30' },
  gap: { label: 'Day gap', color: 'bg-slate-50 border-slate-200/60 dark:bg-slate-900/30 dark:border-slate-800' },
  assigned: { label: 'Assigned', color: 'bg-slate-100 border-slate-300/70 dark:bg-slate-800 dark:border-slate-700' },
  missed: { label: 'Missed deadline', color: 'bg-red-100 border-red-200 dark:bg-red-950 dark:border-red-900' },
  'sla-breach': { label: 'SLA breach', color: 'bg-yellow-100 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-900' },
  'on-time': { label: 'On time', color: 'bg-emerald-400 border-emerald-500 dark:bg-emerald-700 dark:border-emerald-600' },
};

export function ScriptAssignmentChart({ projects, orders, userId, now, isLoading }: { projects: Project[]; orders: TrackingLink[]; userId: string; now: Date; isLoading: boolean }) {
  const [year, setYear] = useState(() => now.getFullYear());
  const years = useMemo(() => {
    const available = new Set(Array.from({ length: 5 }, (_, index) => now.getFullYear() - index));
    for (const order of orders) {
      for (const value of [order.stageAssignees?.SW?.assignedAt, ...(order.statusHistory ?? []).map(entry => entry.timestamp)]) {
        if (!value) continue;
        const date = parseISO(value);
        if (isValid(date) && date <= now) available.add(date.getFullYear());
      }
    }
    return Array.from(available).sort((a, b) => b - a);
  }, [orders, now]);
  const data = useMemo(() => getScriptWriterSummary(projects, orders, userId, {
    from: startOfYear(new Date(year, 0, 1)), to: endOfYear(new Date(year, 0, 1)),
  }, now).dailyActivity, [projects, orders, userId, year, now]);
  const today = startOfDay(now);
  const heatmap = useMemo(() => {
    if (!data.length) return { weeks: [] as (ScriptActivityDay | null)[][], assigned: 0, completed: 0, activeDays: 0, maxOnTime: 0 };
    const points = [...data].sort((a, b) => a.date.localeCompare(b.date));
    const start = parseISO(points[0].date);
    const end = parseISO(points[points.length - 1].date);
    const gridStart = startOfWeek(start, { weekStartsOn: 0 });
    const map = new Map(points.map(point => [point.date, point]));
    const weekCount = Math.ceil((differenceInCalendarDays(end, gridStart) + 1) / 7);
    const weeks = Array.from({ length: weekCount }, (_, week) => Array.from({ length: 7 }, (_, day) => {
      const date = addDays(gridStart, week * 7 + day);
      return date < start || date > end ? null : map.get(format(date, 'yyyy-MM-dd')) ?? emptyScriptActivityDay(format(date, 'yyyy-MM-dd'));
    }));
    return { weeks, assigned: points.reduce((sum, point) => sum + point.assigned, 0), completed: points.reduce((sum, point) => sum + point.completed, 0), activeDays: points.filter(point => point.assigned > 0 || point.completed > 0).length, maxOnTime: Math.max(0, ...points.map(point => point.onTime)) };
  }, [data]);
  const levelFor = (value: number, max: number) => value === 0 ? 0 : Math.max(1, Math.ceil(value / max * 4));

  return (
    <Card className="overflow-hidden rounded-2xl border-none bg-card/95 shadow-xl sm:rounded-lg sm:border sm:border-border/30 sm:shadow-lg">
      <CardContent className="p-4 sm:p-6">
        {isLoading ? <Skeleton className="h-[200px] w-full rounded-xl" /> : !data.length ? <p className="py-10 text-center text-sm text-muted-foreground">No activity in this period.</p> : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-sans">
              <p className="flex items-center gap-2 text-sm font-medium"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300" /><span className="tabular-nums">{heatmap.assigned}</span> assigned</p>
              <p className="flex items-center gap-2 text-sm font-medium"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /><span className="tabular-nums">{heatmap.completed}</span> completed</p>
              <span className="text-xs text-muted-foreground">{heatmap.activeDays} active {heatmap.activeDays === 1 ? 'day' : 'days'}</span>
              <div className="ml-auto">
          <Select value={String(year)} onValueChange={value => setYear(Number(value))}>
            <SelectTrigger aria-label="Activity year" className="h-9 w-[110px] rounded-lg bg-background text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(value => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent>
          </Select>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border/60 p-4">
              <TooltipProvider delayDuration={120}>
                <div className="flex w-max gap-2 pb-1">
                  <div className="flex shrink-0 flex-col gap-[4px] pt-6 text-[10px] text-muted-foreground">
                    {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((label, index) => <span key={index} className="flex h-[18px] items-center">{label}</span>)}
                  </div>
                  <div className="flex gap-[4px]">
                    {heatmap.weeks.map((week, weekIndex) => {
                      const first = week.find(point => point !== null);
                      const monthStart = week.find(point => point && parseISO(point.date).getDate() === 1);
                      const monthLabel = first && (weekIndex === 0 || monthStart) ? format(parseISO(monthStart?.date ?? first.date), 'MMM') : '';
                      return <div key={weekIndex} className="relative flex flex-col gap-[4px] pt-6">
                        <span className="absolute left-0 top-0 text-[10px] text-muted-foreground">{monthLabel}</span>
                        {week.map((point, dayIndex) => !point ? <span key={dayIndex} className="h-[18px] w-[18px]" /> : (
                          <Tooltip key={point.date}>
                            <TooltipTrigger asChild>
                              <button type="button" aria-label={format(parseISO(point.date), 'd MMM yyyy') + ': ' + activityStyles[scriptActivityStatus(point)].label + ', ' + point.assigned + ' assigned, ' + point.completed + ' completed'} className={cn('h-[18px] w-[18px] rounded-[4px] border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2', scriptActivityStatus(point) === 'on-time' ? completedLevels[levelFor(point.onTime, heatmap.maxOnTime)] : activityStyles[scriptActivityStatus(point)].color, parseISO(point.date) > today && 'opacity-35')} />
                            </TooltipTrigger>
                            <TooltipContent className="font-sans text-xs">
                              <p className="font-semibold">{format(parseISO(point.date), 'EEE, d MMM yyyy')}</p>
                              <p className="mt-1">{point.assigned} assigned · {point.completed} completed</p>
                              <p className="mt-1 font-medium">{activityStyles[scriptActivityStatus(point)].label}</p>
                              {(point.onTime > 0 || point.slaBreach > 0 || point.missed > 0) && <p className="mt-1">{point.onTime} on time · {point.slaBreach} SLA breach · {point.missed} missed deadline</p>}
                              {scriptActivityStatus(point) === 'gap' && <p className="mt-1">Assigned work pending; no assignment or completion recorded today.</p>}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>;
                    })}
                  </div>
                </div>
              </TooltipProvider>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <span>One square per day. Deadline issues take priority on mixed days.</span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="Activity status legend">
                {Object.values(activityStyles).map(status => <span key={status.label} aria-label={status.label} className="flex items-center"><span className={cn('h-3 w-3 rounded-[3px] border', status.color)} /></span>)}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
