"use client";

import { useMemo } from 'react';
import { Folder, Play, Check, Clock } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import type { TrackingLink } from '@/types';
import { calculateOperationManagerSummary } from '@/lib/operation-manager-summary';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Props {
  orders: TrackingLink[];
  userId: string;
  dateRange?: DateRange;
  isLoading: boolean;
}

export function OperationManagerCards({ orders, userId, dateRange, isLoading }: Props) {
  const data = useMemo(() => calculateOperationManagerSummary(orders, userId, dateRange), [orders, userId, dateRange]);
  const cards = [
    { label: 'Assigned Projects', value: data.assignedProjects.toLocaleString(), hint: `${data.newAssignments} new this period`, icon: Folder, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10', explanation: 'Projects assigned to this manager through the selected end date; cancelled projects are excluded.' },
    { label: 'Active Projects', value: data.activeProjects.toLocaleString(), hint: 'Across production stages', icon: Play, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', explanation: 'Currently active projects in this assigned portfolio, excluding completed, due-payment and delivered projects.' },
    { label: 'On-Time Delivery', value: data.onTimePercent === null ? '—' : `${data.onTimePercent.toFixed(1)}%`, hint: data.datedDeliveries ? `${data.onTime} of ${data.datedDeliveries} delivered on time` : 'No deliveries with a due date', icon: Check, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', explanation: 'Deliveries recorded in the selected period, compared with the accepted delivery date. Projects without a delivery date are excluded.' },
    { label: 'Pending Handover', value: data.pendingHandover.toLocaleString(), hint: data.pendingHandover ? 'Needs your attention' : 'No pending handovers', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10', explanation: 'Assigned projects currently waiting in the Operation Manager stage for handover to production.' },
  ];

  return (
    <section aria-label="Operation Manager summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => (
        <div key={card.label} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5" title={card.explanation}>
          <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full', card.bg, card.color)}><card.icon className="h-6 w-6" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-semibold text-foreground/70">{card.label}</h3>
            {isLoading ? <Skeleton className="mt-2 h-7 w-20" /> : <p className={cn('mt-1 text-2xl font-bold leading-tight tracking-tight tabular-nums', card.label === 'Pending Handover' ? 'text-amber-600' : 'text-foreground')}>{card.value}</p>}
            {isLoading ? <Skeleton className="mt-3 h-3 w-32" /> : <p className="mt-2 text-[11px] text-muted-foreground">{card.hint}</p>}
          </div>
        </div>
      ))}
    </section>
  );
}
