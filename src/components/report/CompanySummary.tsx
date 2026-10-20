"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { endOfDay, format, isWithinInterval, parseISO, startOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Banknote, CircleDollarSign, Landmark, Percent, ReceiptText, Timer, TrendingUp, Wallet } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { getOrders } from '@/lib/order-service';
import { getAllTransactionsAction } from '@/app/(app)/expenses/actions';
import { PROJECT_STAGE_CONFIG, stageForOrderStatus } from '@/lib/project-stages';
import { CANCELLED_STATUS_ID, DELIVERED_STATUS_ID } from '@/lib/status-constants';
import { vatAmountFor } from '@/lib/vat';
import type { ProjectStatusType, Transaction, TrackingLink } from '@/types';

interface CompanySummaryProps {
  viewerRole: string;
  dateRange?: DateRange;
}

const formatBdt = (n: number) => `BDT ${n.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;

/** Whole-company numbers: revenue, collection, expenses / profit, delivery time and the project pipeline (where work piles up). */
export function CompanySummary({ viewerRole, dateRange }: CompanySummaryProps) {
  const [orders, setOrders] = useState<TrackingLink[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const startStr = dateRange?.from ? format(startOfDay(dateRange.from), 'yyyy-MM-dd HH:mm:ss') : undefined;
  const endStr = dateRange?.to ? format(endOfDay(dateRange.to), 'yyyy-MM-dd HH:mm:ss') : undefined;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      getOrders(undefined, undefined, viewerRole, undefined).catch(() => [] as TrackingLink[]),
      getAllTransactionsAction(startStr, endStr, viewerRole, undefined).catch(() => [] as Transaction[]),
    ]).then(([o, t]) => {
      if (cancelled) return;
      setOrders(o);
      setTransactions(t);
    }).finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [viewerRole, startStr, endStr]);

  const data = useMemo(() => {
    const inRange = (iso?: string | null) => {
      if (!iso) return false;
      if (!dateRange?.from || !dateRange?.to) return true;
      try { return isWithinInterval(parseISO(iso), { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) }); } catch { return false; }
    };
    let sales = 0, billed = 0, paidOnBilled = 0, collected = 0, deliveryDays = 0, delivered = 0;
    orders.filter((o) => o.currentStatus !== CANCELLED_STATUS_ID).forEach((o) => {
      const items = (o.orderItems || []).reduce((sum, it) => sum + (it.isGift ? 0 : (Number(it.lineItemTotalPrice) || 0)), 0);
      const net = items - (Number(o.specialClientDiscount) || 0);
      const grand = net + vatAmountFor(net, o.vatPercentage) + (Number(o.shippingCharge) || 0);
      const paid = (o.advancePayments || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      if (inRange(o.createdAt)) { sales += net; billed += grand; paidOnBilled += paid; }
      (o.advancePayments || []).forEach((r) => { if (inRange(r.date)) collected += Number(r.amount) || 0; });
      const del = [...(o.statusHistory || [])].reverse().find((h) => h.status === DELIVERED_STATUS_ID);
      if (del && inRange(del.timestamp)) {
        const days = (new Date(del.timestamp).getTime() - new Date(o.createdAt).getTime()) / 86_400_000;
        if (days >= 0) { deliveryDays += days; delivered++; }
      }
    });
    const expenses = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // pipeline: where every live order sits now
    const counts = new Map<ProjectStatusType, number>();
    orders.filter((o) => o.currentStatus !== CANCELLED_STATUS_ID).forEach((o) => {
      const st = stageForOrderStatus(o.currentStatus);
      counts.set(st, (counts.get(st) || 0) + 1);
    });
    const stages = PROJECT_STAGE_CONFIG.map((c) => ({ status: c.status, color: c.color, count: counts.get(c.status) || 0 }));
    const live = stages.filter((s) => s.status !== 'Project Delivered');
    const max = Math.max(0, ...live.map((s) => s.count));
    const bottleneck = max > 0 ? live.find((s) => s.count === max)?.status : undefined;

    return {
      sales, collected, expenses,
      due: Math.max(0, billed - paidOnBilled),
      collectionPct: billed > 0 ? Math.round((paidOnBilled / billed) * 100) : 0,
      profit: sales - expenses,
      avgDelivery: delivered > 0 ? deliveryDays / delivered : 0,
      stages, bottleneck, maxCount: Math.max(1, ...stages.map((s) => s.count)),
    };
  }, [orders, transactions, dateRange]);

  const cards = [
    { key: 'sales', label: 'Total Sales', icon: CircleDollarSign, color: 'text-blue-600', bg: 'bg-blue-100', value: formatBdt(data.sales) },
    { key: 'collected', label: 'Collected', icon: Banknote, color: 'text-green-600', bg: 'bg-green-100', value: formatBdt(data.collected) },
    { key: 'due', label: 'Outstanding Due', icon: Wallet, color: 'text-orange-600', bg: 'bg-orange-100', value: formatBdt(data.due) },
    { key: 'pct', label: 'Collection %', icon: Percent, color: 'text-teal-600', bg: 'bg-teal-100', value: `${data.collectionPct}%` },
    { key: 'exp', label: 'Expenses', icon: ReceiptText, color: 'text-red-600', bg: 'bg-red-100', value: formatBdt(data.expenses) },
    { key: 'profit', label: 'Net Profit', icon: TrendingUp, color: data.profit >= 0 ? 'text-emerald-600' : 'text-red-600', bg: data.profit >= 0 ? 'bg-emerald-100' : 'bg-red-100', value: formatBdt(data.profit) },
    { key: 'delivery', label: 'Avg Delivery Time', icon: Timer, color: 'text-violet-600', bg: 'bg-violet-100', value: `${data.avgDelivery.toFixed(1)} days` },
    { key: 'ratio', label: 'Expense / Sales', icon: Landmark, color: 'text-amber-600', bg: 'bg-amber-100', value: data.sales > 0 ? `${Math.round((data.expenses / data.sales) * 100)}%` : '0%' },
  ];

  return (
    <div className="space-y-4">
      <section aria-label="Company summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ key, label, icon: Icon, color, bg, value }) => (
          <div key={key} className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-card p-4 shadow-sm">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
              {isLoading ? <Skeleton className="mt-1 h-6 w-20" /> : (
                <p className="text-[15px] font-bold leading-tight text-foreground font-mono sm:text-2xl">
                  <spoiler-span key={String(value)}>{value}</spoiler-span>
                </p>
              )}
            </div>
          </div>
        ))}
      </section>

      <section aria-label="Project pipeline" className="rounded-xl border border-zinc-100 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Project pipeline</h3>
            <p className="text-xs text-muted-foreground">Live orders in each stage right now (cancelled excluded).</p>
          </div>
          {data.bottleneck && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Bottleneck: {data.bottleneck}</Badge>}
        </div>
        {isLoading ? <Skeleton className="h-40 w-full" /> : (
          <ul className="space-y-2.5">
            {data.stages.map((s) => (
              <li key={s.status} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 truncate text-muted-foreground">{s.status}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-md bg-muted/60">
                  <div className="h-full rounded-md transition-all" style={{ width: `${(s.count / data.maxCount) * 100}%`, background: s.color, minWidth: s.count > 0 ? 6 : 0 }} />
                </div>
                <span className={`w-8 shrink-0 text-right font-mono tabular-nums ${s.status === data.bottleneck ? 'font-bold text-amber-600' : ''}`}>{s.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
