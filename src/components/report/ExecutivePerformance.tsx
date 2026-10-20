"use client";

import { useMemo } from 'react';
import { Award, BarChart3, Repeat2, TrendingUp } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import type { GlobalSettings, TrackingLink, User } from '@/types';
import { calculateExecutivePerformance } from '@/lib/sales-executive-summary';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const formatBdt = (value: number) => `BDT ${value.toLocaleString('en-BD', { maximumFractionDigits: 2 })}`;

interface Props {
  orders: TrackingLink[];
  users: User[];
  settings: GlobalSettings | null;
  userId: string;
  dateRange?: DateRange;
  isLoading: boolean;
}

export function ExecutivePerformance({ orders, users, settings, userId, dateRange, isLoading }: Props) {
  const data = useMemo(() => calculateExecutivePerformance(orders, users, settings, userId, dateRange), [orders, users, settings, userId, dateRange]);
  const metrics = [
    { label: 'Quotation Conversion', value: 'Not tracked', icon: TrendingUp, color: 'text-emerald-600', hint: 'Quotation-to-order conversion links are not recorded yet.' },
    { label: 'Repeat Sales', value: data.repeatSalesPercent === null ? '—' : `${data.repeatSalesPercent.toFixed(1)}%`, icon: Repeat2, color: 'text-violet-600', hint: data.repeatSalesPercent === null ? 'Some orders have no client ID, so repeat sales cannot be measured reliably.' : 'Share of sales from clients with an earlier non-cancelled order in the available history.' },
    { label: 'Average Order Value', value: formatBdt(data.averageOrderValue), icon: BarChart3, color: 'text-blue-600', hint: 'Total net sales divided by the number of non-cancelled orders in this period.' },
  ];

  return (
    <section aria-label="Executive performance" className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="px-5 pb-4 pt-5">
        <h3 className="text-base font-semibold tracking-tight">Executive Performance</h3>
        <p className="mt-1 text-xs text-muted-foreground">Ranked by total sales. Achievement is based on sales amount targets.</p>
      </div>
      <div className="px-4">
        <Table className="min-w-[850px]">
          <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead scope="col" className="w-12 rounded-l-lg text-center">#</TableHead>
            <TableHead scope="col">Executive</TableHead>
            <TableHead scope="col" className="text-right">Orders</TableHead>
            <TableHead scope="col" className="text-right">Sales</TableHead>
            <TableHead scope="col" className="text-right">Monthly Target</TableHead>
            <TableHead scope="col" className="min-w-56">Achievement</TableHead>
            <TableHead scope="col" className="rounded-r-lg text-right">Collected</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 4 }, (_, index) => <TableRow key={index}><TableCell colSpan={7}><Skeleton className="h-9 w-full" /></TableCell></TableRow>) : data.rows.length ? data.rows.map((row, index) => (
              <TableRow key={row.id}>
                <TableCell className="text-center">
                  {index < 3 ? <span className="relative inline-flex h-7 w-7 items-center justify-center" aria-label={`Rank ${index + 1}`}>
                    <Award className={cn('absolute h-7 w-7', index === 0 ? 'fill-amber-400 text-amber-500' : index === 1 ? 'fill-slate-300 text-slate-400' : 'fill-orange-300 text-orange-500')} />
                    <span className="relative -mt-1 text-[10px] font-bold text-white">{index + 1}</span>
                  </span> : <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{index + 1}</span>}
                </TableCell>
                <TableCell><div className="flex items-center gap-2.5"><Avatar className="h-8 w-8"><AvatarImage src={row.avatarUrl || undefined} alt={row.name} /><AvatarFallback className="bg-blue-100 text-[11px] font-semibold text-blue-700">{row.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</AvatarFallback></Avatar><span className="font-medium">{row.name}</span></div></TableCell>
                <TableCell className="text-right tabular-nums">{row.orders}</TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">{formatBdt(row.sales)}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">{row.monthlyTarget > 0 ? formatBdt(row.monthlyTarget) : 'Not set'}</TableCell>
                <TableCell><div className="flex items-center gap-3" title={`${formatBdt(row.sales)} sales / ${formatBdt(row.periodTarget)} ${data.isMonthly ? 'monthly' : 'period'} target`}>
                  <span className="w-14 shrink-0 text-xs font-semibold tabular-nums text-blue-600">{row.achievement === null ? '—' : `${row.achievement.toFixed(1)}%`}</span>
                  <Progress value={Math.min(100, row.achievement ?? 0)} aria-label={`${row.name} target achievement`} className="h-2 min-w-24 flex-1 bg-blue-100 dark:bg-blue-950" indicatorClassName="bg-blue-600" />
                </div></TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">{formatBdt(row.collected)}</TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan={7} className="h-28 text-center text-muted-foreground">No Sales Executives match the selected filter.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-4 border-t border-border/60 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="shrink-0 text-xs text-muted-foreground">{isLoading ? 'Loading performance...' : `${data.totalOrders} orders · ${data.rows.length} executives`}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {metrics.map(metric => <div key={metric.label} className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5" title={metric.hint}><metric.icon className={cn('h-5 w-5 shrink-0', metric.color)} aria-hidden /><div className="min-w-0"><p className="text-[10px] font-medium text-muted-foreground">{metric.label}</p>{isLoading ? <Skeleton className="mt-1 h-4 w-20" /> : <p className="mt-0.5 break-words text-xs font-semibold tabular-nums">{metric.value}</p>}</div></div>)}
        </div>
      </div>
    </section>
  );
}
