"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { format, startOfDay, endOfDay, parseISO, isWithinInterval } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getUsers } from '@/lib/user-service';
import { getLeads } from '@/lib/lead-service';
import { getOrders } from '@/lib/order-service';
import { getQuotations } from '@/lib/quotation-service';
import { CANCELLED_STATUS_ID } from '@/lib/status-constants';
import type { Lead, TrackingLink, User } from '@/types';

interface SalesExecutiveSummaryProps {
  /** viewer role (the lead query scopes by it) */
  viewerRole: string;
  /** selected Sales Executive; 'all' = every executive */
  userId: string;
  dateRange?: DateRange;
}

const formatBdt = (n: number) => `BDT ${n.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;

/** Performance table for the chosen Sales Executive and date range. */
export function SalesExecutiveSummary({ viewerRole, userId, dateRange }: SalesExecutiveSummaryProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const startStr = dateRange?.from ? format(startOfDay(dateRange.from), 'yyyy-MM-dd HH:mm:ss') : undefined;
  const endStr = dateRange?.to ? format(endOfDay(dateRange.to), 'yyyy-MM-dd HH:mm:ss') : undefined;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getLeads(startStr, endStr, viewerRole, userId === 'all' ? undefined : userId)
      .then((rows) => { if (!cancelled) setLeads(rows); })
      .catch(() => { if (!cancelled) setLeads([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [startStr, endStr, viewerRole, userId]);

  // Orders and quotations for the executive performance table.
  const [orders, setOrders] = useState<TrackingLink[]>([]);
  const [quotations, setQuotations] = useState<TrackingLink[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => { getUsers().then(setUsers).catch(() => setUsers([])); }, []);

  useEffect(() => {
    let cancelled = false;
    const uid = userId === 'all' ? undefined : userId;
    Promise.all([
      getOrders(undefined, undefined, viewerRole, uid).catch(() => [] as TrackingLink[]),
      getQuotations().catch(() => [] as TrackingLink[]),
    ]).then(([o, q]) => {
      if (cancelled) return;
      setOrders(o);
      setQuotations(q.filter((x) => !uid || x.crmUserId === uid));
    });
    return () => { cancelled = true; };
  }, [startStr, endStr, viewerRole, userId]);

  // one row per Sales Executive (leaderboard)
  const execRows = useMemo(() => {
    const inRange = (iso?: string | null) => {
      if (!iso) return false;
      if (!dateRange?.from || !dateRange?.to) return true;
      try { return isWithinInterval(parseISO(iso), { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) }); } catch { return false; }
    };
    type R = { id: string; name: string; leads: number; sales: number; orders: number; quotations: number; amount: number };
    const map = new Map<string, R>();
    const row = (id: string, name: string): R => {
      let r = map.get(id);
      if (!r) { r = { id, name: users.find((u) => u.id === id)?.name || name || 'Unknown', leads: 0, sales: 0, orders: 0, quotations: 0, amount: 0 }; map.set(id, r); }
      return r;
    };
    leads.forEach((l) => { if (!l.crmId) return; const r = row(l.crmId, (l as any).crmName || ''); r.leads++; if (l.category === 'OC') r.sales++; });
    quotations.forEach((q) => { if (q.crmUserId && inRange(q.createdAt)) row(q.crmUserId, q.crmUserName).quotations++; });
    orders.filter((o) => o.currentStatus !== CANCELLED_STATUS_ID && o.crmUserId && inRange(o.createdAt)).forEach((o) => {
      const items = (o.orderItems || []).reduce((sum, it) => sum + (it.isGift ? 0 : (Number(it.lineItemTotalPrice) || 0)), 0);
      const r = row(o.crmUserId, o.crmUserName);
      r.orders++;
      r.amount += items - (Number(o.specialClientDiscount) || 0);
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount || b.leads - a.leads);
  }, [leads, quotations, orders, users, dateRange]);

  return (
    <div className="space-y-4">
    <section aria-label="Performance by executive" className="overflow-hidden rounded-xl border border-zinc-100 bg-card shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-3">
        <h3 className="text-sm font-semibold">Performance by Sales Executive</h3>
        <p className="text-xs text-muted-foreground">Sorted by total sales in the selected period.</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Executive</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">Sales (leads)</TableHead>
            <TableHead className="text-right">Conversion</TableHead>
            <TableHead className="text-right">Quotations</TableHead>
            <TableHead className="text-right">Orders</TableHead>
            <TableHead className="pr-5 text-right">Total Sales</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            [...Array(3)].map((_, i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)
          ) : execRows.length === 0 ? (
            <TableRow><TableCell colSpan={7} className="h-20 text-center text-muted-foreground">No activity in this period.</TableCell></TableRow>
          ) : execRows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="pl-5">
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={users.find((u) => u.id === r.id)?.avatarUrl || undefined} alt={r.name} />
                    <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">{r.name.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{r.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.leads}</TableCell>
              <TableCell className="text-right tabular-nums text-green-600">{r.sales}</TableCell>
              <TableCell className="text-right tabular-nums">{r.leads > 0 ? `${Math.round((r.sales / r.leads) * 100)}%` : '-'}</TableCell>
              <TableCell className="text-right tabular-nums">{r.quotations}</TableCell>
              <TableCell className="text-right tabular-nums">{r.orders}</TableCell>
              <TableCell className="pr-5 text-right font-medium tabular-nums">{formatBdt(r.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
    </div>
  );
}
