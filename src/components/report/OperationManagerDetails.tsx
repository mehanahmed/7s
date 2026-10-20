"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, CircleAlert, Clock } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import type { TrackingLink, User } from '@/types';
import { calculateOperationManagerSummary } from '@/lib/operation-manager-summary';
import { STAGE_BADGE_CLASS } from '@/lib/project-stages';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Props { orders: TrackingLink[]; users: User[]; userId: string; dateRange?: DateRange; isLoading: boolean }
const priorityClasses: Record<string, string> = {
  Overdue: 'bg-red-100 text-red-700 hover:bg-red-100',
  'Due today': 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  Blocked: 'bg-red-100 text-red-700 hover:bg-red-100',
  'Handover pending': 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  'Client response': 'bg-slate-100 text-slate-600 hover:bg-slate-100',
};

export function OperationManagerDetails({ orders, users, userId, dateRange, isLoading }: Props) {
  const data = useMemo(() => calculateOperationManagerSummary(orders, userId, dateRange), [orders, userId, dateRange]);
  const userMap = useMemo(() => new Map(users.map(user => [user.id, user])), [users]);
  const maxCount = Math.max(1, ...data.flow.map(stage => stage.count));
  const deliveryData = [
    { name: 'On time', value: data.onTime, color: '#2563eb' },
    { name: 'Late', value: data.lateDeliveries, color: '#fbbf24' },
    ...(data.undatedDeliveries ? [{ name: 'No due date', value: data.undatedDeliveries, color: '#94a3b8' }] : []),
  ];
  const insights = [
    { label: 'Completed Projects', value: String(data.completedProjects), icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Blocked Projects', value: String(data.blockedProjects), icon: CircleAlert, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-500/10' },
    { label: 'Average Handover Time', value: data.averageHandoverDays === null ? '—' : `${data.averageHandoverDays.toFixed(1)} days`, icon: Clock, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-500/10' },
  ];
  const panelClass = 'min-w-0 rounded-2xl border border-border/60 bg-card p-5 shadow-sm';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-label="Project flow" className={panelClass}>
          <h3 className="text-base font-semibold tracking-tight">Project Flow</h3>
          <p className="mb-5 mt-1 text-xs text-muted-foreground">Current workload by stage</p>
          {isLoading ? <Skeleton className="h-44 w-full rounded-xl" /> : <ul className="space-y-3">
            {data.flow.map(stage => <li key={stage.stage} className="grid grid-cols-[130px_minmax(0,1fr)_24px] items-center gap-3 text-xs sm:grid-cols-[150px_minmax(0,1fr)_28px]"><span className="text-foreground/80">{stage.stage}</span><div className="h-3.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${stage.stage}: ${stage.count} projects`}><div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${stage.count / maxCount * 100}%`, backgroundColor: stage.color }} /></div><span className="text-right font-semibold tabular-nums">{stage.count}</span></li>)}
          </ul>}
          {!isLoading && !data.activeProjects && <p className="mt-4 text-xs text-muted-foreground">No active projects in this portfolio.</p>}
        </section>
        <section aria-label="Delivery overview" className={panelClass}>
          <h3 className="mb-4 text-base font-semibold tracking-tight">Delivery Overview</h3>
          {isLoading ? <Skeleton className="h-48 w-full rounded-xl" /> : <div className="flex flex-col items-center justify-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
            <div className="relative h-44 w-44 shrink-0" role="img" aria-label={`${data.delivered} delivered: ${data.onTime} on time, ${data.lateDeliveries} late, ${data.undatedDeliveries} without a due date.`}>
              <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.delivered ? deliveryData : [{ name: 'No deliveries', value: 1, color: 'hsl(var(--muted))' }]} dataKey="value" innerRadius={62} outerRadius={82} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>{(data.delivered ? deliveryData : [{ color: 'hsl(var(--muted))' }]).map((slice, index) => <Cell key={index} fill={slice.color} />)}</Pie>{data.delivered > 0 && <Tooltip contentStyle={{ borderRadius: 12, background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', borderColor: 'hsl(var(--border))' }} />}</PieChart></ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-bold tabular-nums">{data.delivered}</span><span className="mt-1 text-xs text-muted-foreground">Delivered</span></div>
            </div>
            <div className="w-full min-w-0 flex-1 space-y-4">{deliveryData.map(slice => <div key={slice.name} className="flex items-center gap-2.5 text-xs"><span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} /><span className="flex-1 text-muted-foreground">{slice.name}</span><span className="font-semibold tabular-nums">{slice.value}</span></div>)}<div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4 text-xs"><span className="text-muted-foreground">Average turnaround</span><span className="font-semibold tabular-nums">{data.averageTurnaroundDays === null ? '—' : `${data.averageTurnaroundDays.toFixed(1)} days`}</span></div></div>
          </div>}
          <p className="mt-3 text-[10px] text-muted-foreground">Deliveries recorded in the selected period.</p>
        </section>
      </div>
      <section aria-label="Projects requiring attention" className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="px-5 pb-4 pt-5"><h3 className="text-base font-semibold tracking-tight">Projects Requiring Attention</h3><p className="mt-1 text-xs text-muted-foreground">Prioritized by delivery date and handover status.</p></div>
        <div className="px-4"><Table className="min-w-[850px]"><TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40"><TableHead scope="col" className="rounded-l-lg">Project</TableHead><TableHead scope="col">Company</TableHead><TableHead scope="col">Current Stage</TableHead><TableHead scope="col">Latest Assignee</TableHead><TableHead scope="col">Delivery Date</TableHead><TableHead scope="col" className="rounded-r-lg">Priority</TableHead></TableRow></TableHeader><TableBody>
          {isLoading ? Array.from({ length: 4 }, (_, index) => <TableRow key={index}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>) : data.attention.length ? data.attention.map(project => {
            const person = project.assignee ? userMap.get(project.assignee.id) : null;
            const name = person?.name || project.assignee?.name || 'Unassigned';
            return <TableRow key={project.id}><TableCell><Link href={`/projects#${encodeURIComponent(project.id)}`} className="font-medium text-primary hover:underline">{project.id}</Link></TableCell><TableCell>{project.companyName}</TableCell><TableCell><Badge className={cn('border-transparent whitespace-nowrap', STAGE_BADGE_CLASS[project.stage])}>{project.stage}</Badge></TableCell><TableCell><div className="flex items-center gap-2"><Avatar className="h-7 w-7 shrink-0"><AvatarImage src={person?.avatarUrl || undefined} alt={name} /><AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">{name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</AvatarFallback></Avatar><span className="text-xs">{name}</span></div></TableCell><TableCell className="whitespace-nowrap text-xs">{project.deliveryDate ? format(new Date(project.deliveryDate), 'dd MMM yyyy') : 'Not set'}</TableCell><TableCell><Badge variant="secondary" className={cn('border-transparent whitespace-nowrap', priorityClasses[project.priority])}>{project.priority}</Badge></TableCell></TableRow>;
          }) : <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No projects need attention.</TableCell></TableRow>}
        </TableBody></Table></div>
        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-5 py-3"><p className="flex items-center gap-2 text-xs text-muted-foreground"><CircleAlert className="h-4 w-4 text-red-500" />{isLoading ? 'Loading projects...' : `${data.attention.length} projects need attention`}</p><Button variant="outline" size="sm" asChild className="gap-1.5 text-xs text-primary"><Link href="/projects">View projects<ArrowRight className="h-3.5 w-3.5" /></Link></Button></div>
      </section>
      <section aria-label="Operational insights" className="grid grid-cols-1 gap-4 sm:grid-cols-3">{insights.map(insight => <div key={insight.label} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-sm"><span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', insight.bg, insight.color)}><insight.icon className="h-5 w-5" aria-hidden /></span><div><h3 className="text-xs text-muted-foreground">{insight.label}</h3>{isLoading ? <Skeleton className="mt-1 h-6 w-16" /> : <p className="mt-1 text-lg font-semibold tabular-nums">{insight.value}</p>}</div></div>)}</section>
    </div>
  );
}
