"use client";

import { useMemo } from 'react';
import { Target, CheckCircle2, XCircle, Coins, FileText, ArrowUp, ArrowDown, CircleAlert } from 'lucide-react';
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
  const valueClass = 'mt-1 break-words text-lg font-bold leading-tight tracking-tight text-foreground tabular-nums sm:text-xl lg:text-2xl';
  const cardClass = 'flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm';
  const iconClass = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full';

  return (
    <section aria-label="Sales Executive summary" className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {/* 1. Total Sales Target */}
      <div className={cardClass}>
        <span className={cn(iconClass, 'bg-blue-50 text-blue-600 dark:bg-blue-500/10')}>
          <Target className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-foreground/70">Total Sales Target</h3>
          {isLoading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className={valueClass}>{formatBdt(data.target)}</p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground truncate">
            {isLoading ? 'Loading target...' : data.target > 0 ? `${data.isMonthly ? 'Monthly' : 'Period'} target` : 'No target configured'}
          </p>
        </div>
      </div>

      {/* 2. Target Achieved */}
      <div className={cardClass}>
        <span className={cn(iconClass, 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10')}>
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <h3 className="text-xs font-semibold text-foreground/70">Target Achieved</h3>
            {!isLoading && data.achievement !== null && (
              <span className={cn(
                'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                (data.achievement ?? 0) >= 100
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
              )}>
                {data.achievement.toFixed(1)}%
              </span>
            )}
          </div>
          {isLoading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className={valueClass}>{formatBdt(data.targetAchieved)}</p>
          )}
          {!isLoading && data.target > 0 && (
            <Progress
              value={Math.min(100, data.achievement ?? 0)}
              aria-label="Sales target achievement"
              className="mt-2 h-1.5 bg-muted"
              indicatorClassName={data.achievement && data.achievement >= 100 ? 'bg-emerald-600' : 'bg-blue-600'}
            />
          )}
          <p className="mt-1.5 text-[11px] text-muted-foreground truncate">
            {isLoading ? '...' : `${data.orderCount} orders in period`}
          </p>
        </div>
      </div>

      {/* 3. Target Failed */}
      <div className={cardClass}>
        <span className={cn(
          iconClass,
          data.targetFailed > 0
            ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10'
            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'
        )}>
          {data.targetFailed > 0 ? (
            <XCircle className="h-5 w-5" aria-hidden />
          ) : (
            <CheckCircle2 className="h-5 w-5" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-foreground/70">Target Failed</h3>
          {isLoading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className={cn(valueClass, data.targetFailed > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
              {formatBdt(data.targetFailed)}
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground truncate">
            {isLoading
              ? '...'
              : data.targetFailed > 0
              ? 'Target shortfall / remaining'
              : 'Target fully achieved 🎉'}
          </p>
        </div>
      </div>

      {/* 4. Collected Amount */}
      <div className={cardClass}>
        <span className={cn(iconClass, 'bg-teal-50 text-teal-600 dark:bg-teal-500/10')}>
          <Coins className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-foreground/70">Collected Amount</h3>
          {isLoading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className={valueClass}>{formatBdt(data.collected)}</p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground truncate" title="Total collected from orders created in selected period">
            {isLoading ? 'Loading collections...' : `${data.collectionPercent.toFixed(1)}% of invoiced amount`}
          </p>
        </div>
      </div>

      {/* 5. Due Amount */}
      <div className={cardClass}>
        <span className={cn(
          iconClass,
          data.outstanding > 0
            ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10'
            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'
        )}>
          <FileText className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-foreground/70">Due Amount</h3>
          {isLoading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className={cn(valueClass, data.outstanding > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
              {formatBdt(data.outstanding)}
            </p>
          )}
          <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground truncate">
            {isLoading ? (
              '...'
            ) : data.outstanding > 0 ? (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <CircleAlert className="h-3 w-3 shrink-0" />
                {data.outstandingInvoices.length} order(s) with dues
              </span>
            ) : (
              <span className="text-emerald-600 font-medium">No outstanding dues</span>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
