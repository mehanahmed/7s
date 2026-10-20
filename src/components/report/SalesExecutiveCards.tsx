"use client";

import { useMemo } from 'react';
import { BarChart3, Target, Coins, FileText, ArrowUp, ArrowDown, CircleAlert, CheckCircle2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import type { GlobalSettings, TrackingLink, User } from '@/types';
import { calculateSalesExecutiveSummary } from '@/lib/sales-executive-summary';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
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

export function SalesExecutiveCards({ orders, users, settings, userId, dateRange, isLoading }: Props) {
  const data = useMemo(() => calculateSalesExecutiveSummary(orders, users, settings, userId, dateRange), [orders, users, settings, userId, dateRange]);
  const valueClass = 'mt-1 break-words text-xl font-bold leading-tight tracking-tight text-foreground tabular-nums lg:text-2xl';
  const cardClass = 'flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5';
  const iconClass = 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full';
  const GrowthIcon = (data.salesChange ?? 0) < 0 ? ArrowDown : ArrowUp;

  return (
    <section aria-label="Sales Executive summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className={cardClass}>
        <span className={cn(iconClass, 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10')}><BarChart3 className="h-6 w-6" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-foreground/70">Total Sales</h3>
          {isLoading ? <Skeleton className="mt-2 h-7 w-32" /> : <p className={valueClass}>{formatBdt(data.totalSales)}</p>}
          {isLoading ? <Skeleton className="mt-3 h-3 w-36" /> : data.salesChange !== null ? (
            <p className="mt-3 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
              <span className={cn('inline-flex items-center gap-1 font-semibold', data.salesChange < 0 ? 'text-red-600' : 'text-emerald-600')}><GrowthIcon className="h-3.5 w-3.5" />{data.salesChange >= 0 ? '+' : ''}{data.salesChange.toFixed(1)}%</span> vs previous period
            </p>
          ) : <p className="mt-3 text-[11px] text-muted-foreground">No previous sales to compare</p>}
        </div>
      </div>
      <div className={cardClass}>
        <span className={cn(iconClass, 'bg-blue-50 text-blue-600 dark:bg-blue-500/10')}><Target className="h-6 w-6" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-foreground/70">Target Achievement</h3>
          {isLoading ? <Skeleton className="mt-2 h-7 w-20" /> : <p className={valueClass}>{data.achievement === null ? '—' : `${data.achievement.toFixed(1)}%`}</p>}
          <p className="mt-1.5 text-[11px] text-muted-foreground">{isLoading ? 'Loading target...' : data.target > 0 ? `${formatBdt(data.target)} ${data.isMonthly ? 'monthly' : 'period'} target` : 'No sales amount target configured'}</p>
          {!isLoading && data.target > 0 && <Progress value={Math.min(100, data.achievement ?? 0)} aria-label="Sales amount target achievement" className="mt-2 h-2 bg-blue-100 dark:bg-blue-950" indicatorClassName="bg-blue-600" />}
          {!isLoading && data.target > 0 && <p className="mt-1 text-[10px] text-muted-foreground">{formatBdt(data.totalSales)} sales in this period</p>}
        </div>
      </div>
      <div className={cardClass}>
        <span className={cn(iconClass, 'bg-blue-50 text-blue-600 dark:bg-blue-500/10')}><Coins className="h-6 w-6" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-foreground/70">Collected</h3>
          {isLoading ? <Skeleton className="mt-2 h-7 w-32" /> : <p className={valueClass}>{formatBdt(data.collected)}</p>}
          <p className="mt-3 text-[11px] text-muted-foreground" title="Payments received against orders created in the selected period, including VAT and shipping.">{isLoading ? 'Loading collections...' : `${data.collectionPercent.toFixed(1)}% of invoiced amount`}</p>
        </div>
      </div>
      <div className={cardClass}>
        <span className={cn(iconClass, 'bg-amber-50 text-amber-600 dark:bg-amber-500/10')}><FileText className="h-6 w-6" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-foreground/70">Outstanding</h3>
          {isLoading ? <Skeleton className="mt-2 h-7 w-32" /> : <p className={valueClass}>{formatBdt(data.outstanding)}</p>}
          {!isLoading && <p className={cn('mt-3 flex items-center gap-1.5 text-[11px] font-medium', data.outstanding > 0 ? 'text-amber-600' : 'text-emerald-600')}>
            {data.outstanding > 0 ? <CircleAlert className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{data.outstanding > 0 ? 'Follow up required' : 'No outstanding balance'}
          </p>}
        </div>
      </div>
    </section>
  );
}
