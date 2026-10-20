"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { endOfDay, isWithinInterval, parseISO, startOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { AlertTriangle, CheckCircle2, ClipboardList, FileCheck2, FileX2, Hourglass, Layers, PauseCircle, Percent, RotateCcw, Timer, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { orderStatusIdForStage, hasProofInNote } from '@/lib/project-stages';
import { ON_HOLD_STATUS_ID } from '@/lib/status-constants';
import { getOrders } from '@/lib/order-service';
import { getUsers } from '@/lib/user-service';
import { getGlobalSettings } from '@/lib/settings-service';
import type { ProjectStatusType, TrackingLink, User, UserRole } from '@/types';

interface DepartmentSlaSummaryProps {
  /** department = user role (ADMIN = Operation Manager, SW, CG, EDITOR) */
  dept: UserRole;
  /** selected user of the department; 'all' = everyone in it */
  userId: string;
  dateRange?: DateRange;
  viewerRole: string;
}

/**
 * How each department's work is measured: a project is assigned when its order enters the `from` stage
 * and complete when it enters the `to` stage afterwards (read from the order's status history),
 * within the SLA hours. SLA hours come from Settings (SLA Hours card); the numbers below are only the fallback.
 */
const DEPT: Record<string, { assignee: string; from: ProjectStatusType; to: ProjectStatusType; slaHours: number }> = {
  ADMIN: { assignee: 'OM', from: 'Operation Manager', to: 'On Script', slaHours: 24 },
  SW: { assignee: 'SW', from: 'On Script', to: 'Script Done', slaHours: 48 },
  CG: { assignee: 'CG', from: 'Cinematographer', to: 'CG Complete', slaHours: 72 },
  EDITOR: { assignee: 'EDITOR', from: 'On Editor', to: 'Client Revision', slaHours: 72 },
};

const HOUR = 3_600_000;
const initialsOf = (name: string) => {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
};
const fmtDuration = (hours: number) => (hours >= 24 ? `${(hours / 24).toFixed(1)}d` : `${hours.toFixed(1)}h`);

interface Row { id: string; name: string; assigned: number; complete: number; pending: number; breach: number; onTime: number; totalMs: number }

export function DepartmentSlaSummary({ dept, userId, dateRange, viewerRole }: DepartmentSlaSummaryProps) {
  const cfg = DEPT[dept];
  const [orders, setOrders] = useState<TrackingLink[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [slaHours, setSlaHours] = useState<Record<string, number>>({});

  useEffect(() => {
    getGlobalSettings().then((g) => setSlaHours(g.slaHours ?? {})).catch(() => setSlaHours({}));
    getUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getOrders(undefined, undefined, viewerRole, undefined)
      .then((o) => { if (!cancelled) setOrders(o); })
      .catch(() => { if (!cancelled) setOrders([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [viewerRole]);

  const { rows, workload, revisions, om } = useMemo(() => {
    if (!cfg) return { rows: [] as Row[], workload: 0, revisions: 0, om: { proofOk: 0, proofMissing: 0, holdCount: 0, holdAvgDays: 0 } };
    const inRange = (iso?: string | null) => {
      if (!iso) return false;
      if (!dateRange?.from || !dateRange?.to) return true;
      try { return isWithinInterval(parseISO(iso), { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) }); } catch { return false; }
    };
    const now = Date.now();
    const sla = Number(slaHours[dept]) > 0 ? Number(slaHours[dept]) : cfg.slaHours;
    const fromId = orderStatusIdForStage(cfg.from);
    const toId = orderStatusIdForStage(cfg.to);
    const map = new Map<string, Row>();
    let open = 0; // all open assignments (not limited to the date range)
    let rev = 0;

    orders.forEach((o) => {
      // orders where nobody was assigned at this stage still count, under "Unassigned"
      const who = o.stageAssignees?.[cfg.assignee] ?? { id: 'unassigned', name: 'Unassigned' };
      if (userId !== 'all' && who.id !== userId) return;
      const hist = o.statusHistory || [];
      // latest time the order entered the assign stage, and the first time it reached the finish stage after that
      let startIdx = -1;
      hist.forEach((h, i) => { if (h.status === fromId) startIdx = i; });
      let doneIdx = hist.findIndex((h, i) => i > startIdx && h.status === toId);
      const foundStart = startIdx >= 0;
      if (foundStart && doneIdx < 0 && o.currentStatus !== fromId && o.currentStatus !== ON_HOLD_STATUS_ID && hist[startIdx + 1]) {
        doneIdx = startIdx + 1; // moved on from this stage without passing the finish stage: the move away ends it
      }
      if (startIdx < 0) {
        // the assign stage was skipped: measure from the previous move to the finish stage
        if (doneIdx < 0) return;
        startIdx = doneIdx - 1;
        if (startIdx < 0) return;
      }
      const start = hist[startIdx].timestamp;
      const done = doneIdx >= 0 ? hist[doneIdx].timestamp : undefined;
      if (!done) open++;
      if (!inRange(start)) return;
      const r = map.get(who.id) ?? { id: who.id, name: who.name, assigned: 0, complete: 0, pending: 0, breach: 0, onTime: 0, totalMs: 0 };
      r.assigned++;
      const startMs = new Date(start).getTime();
      if (done) {
        const took = new Date(done).getTime() - startMs;
        r.complete++;
        r.totalMs += took;
        if (took <= sla * HOUR) r.onTime++; else r.breach++;
      } else {
        r.pending++;
        if (now - startMs > sla * HOUR) r.breach++; // still open and already past the SLA
      }
      if (dept === 'EDITOR') rev += hist.filter((h) => h.status === 'client-revision').length;
      map.set(who.id, r);
    });

    // Operation Manager only: group-creation proof on the orders sitting in that stage, and orders on hold now
    const om = { proofOk: 0, proofMissing: 0, holdCount: 0, holdAvgDays: 0 };
    if (dept === 'ADMIN') {
      const omId = orderStatusIdForStage('Operation Manager');
      let holdMs = 0;
      orders.forEach((o) => {
        const hist = o.statusHistory || [];
        if (o.currentStatus === omId) {
          const last = [...hist].reverse().find((h) => h.status === omId);
          if (hasProofInNote(last?.notes)) om.proofOk++; else om.proofMissing++;
        }
        if (o.currentStatus === ON_HOLD_STATUS_ID) {
          om.holdCount++;
          const last = [...hist].reverse().find((h) => h.status === ON_HOLD_STATUS_ID);
          if (last) holdMs += now - new Date(last.timestamp).getTime();
        }
      });
      om.holdAvgDays = om.holdCount > 0 ? holdMs / om.holdCount / (24 * HOUR) : 0;
    }
    return { om, rows: Array.from(map.values()).sort((a, b) => b.assigned - a.assigned), workload: open, revisions: rev };
  }, [orders, cfg, userId, dateRange, slaHours, dept]);

  if (!cfg) return null;

  const total = rows.reduce((t, r) => ({
    assigned: t.assigned + r.assigned, complete: t.complete + r.complete, pending: t.pending + r.pending,
    breach: t.breach + r.breach, onTime: t.onTime + r.onTime, totalMs: t.totalMs + r.totalMs,
  }), { assigned: 0, complete: 0, pending: 0, breach: 0, onTime: 0, totalMs: 0 });
  const onTimePct = total.complete > 0 ? `${Math.round((total.onTime / total.complete) * 100)}%` : '0%';
  const avg = total.complete > 0 ? fmtDuration(total.totalMs / total.complete / HOUR) : '0h';

  const cards: Array<{ key: string; label: string; icon: React.ElementType; color: string; bg: string; value: string | number }> = [
    { key: 'breach', label: 'SLA Breach', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100', value: total.breach },
    { key: 'complete', label: 'Complete', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100', value: total.complete },
    { key: 'assigned', label: 'Assigned', icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-100', value: total.assigned },
    { key: 'ontime', label: 'On Time', icon: Timer, color: 'text-emerald-600', bg: 'bg-emerald-100', value: total.onTime },
    { key: 'pending', label: 'Pending', icon: Hourglass, color: 'text-amber-600', bg: 'bg-amber-100', value: total.pending },
    { key: 'pct', label: 'On-time %', icon: Percent, color: 'text-teal-600', bg: 'bg-teal-100', value: onTimePct },
    { key: 'avg', label: 'Avg Completion', icon: Zap, color: 'text-violet-600', bg: 'bg-violet-100', value: avg },
    { key: 'workload', label: 'Workload (Open now)', icon: Layers, color: 'text-orange-600', bg: 'bg-orange-100', value: workload },
    ...(dept === 'ADMIN' ? [
      { key: 'proofok', label: 'Group Proof Submitted', icon: FileCheck2, color: 'text-green-600', bg: 'bg-green-100', value: om.proofOk },
      { key: 'proofmiss', label: 'Group Proof Missing', icon: FileX2, color: 'text-red-600', bg: 'bg-red-100', value: om.proofMissing },
      { key: 'hold', label: 'On Hold (avg days)', icon: PauseCircle, color: 'text-yellow-600', bg: 'bg-yellow-100', value: `${om.holdCount} (${om.holdAvgDays.toFixed(1)}d)` },
    ] : []),
    ...(dept === 'EDITOR' ? [{ key: 'rev', label: 'Client Revisions', icon: RotateCcw, color: 'text-pink-600', bg: 'bg-pink-100', value: revisions }] : []),
  ];

  const avatarOf = (id: string) => users.find((u) => u.id === id)?.avatarUrl || undefined;

  return (
    <div className="space-y-4">
      <section aria-label="Department summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ key, label, icon: Icon, color, bg, value }) => (
          <div key={key} className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-card p-4 shadow-sm">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
              {isLoading ? <Skeleton className="mt-1 h-6 w-10" /> : (
                <p className="text-[15px] font-bold leading-tight text-foreground font-mono sm:text-2xl">
                  <spoiler-span key={String(value)}>{value}</spoiler-span>
                </p>
              )}
            </div>
          </div>
        ))}
      </section>

      <section aria-label="Per user performance" className="overflow-hidden rounded-xl border border-zinc-100 bg-card shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-3">
          <h3 className="text-sm font-semibold">Performance by user</h3>
          <p className="text-xs text-muted-foreground">SLA: {Number(slaHours[dept]) > 0 ? Number(slaHours[dept]) : cfg.slaHours} hours per project. Sorted by assigned. "Unassigned" = no user was assigned at that stage.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">User</TableHead>
              <TableHead className="text-right">Assigned</TableHead>
              <TableHead className="text-right">Complete</TableHead>
              <TableHead className="text-right">Pending</TableHead>
              <TableHead className="text-right">SLA Breach</TableHead>
              <TableHead className="text-right">On-time %</TableHead>
              <TableHead className="pr-5 text-right">Avg time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-20 text-center text-muted-foreground">No assigned projects in this period.</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="pl-5">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={avatarOf(r.id)} alt={r.name} />
                      <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">{initialsOf(r.name)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{r.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.assigned}</TableCell>
                <TableCell className="text-right tabular-nums text-green-600">{r.complete}</TableCell>
                <TableCell className="text-right tabular-nums text-amber-600">{r.pending}</TableCell>
                <TableCell className={`text-right tabular-nums ${r.breach > 0 ? 'font-semibold text-red-600' : ''}`}>{r.breach}</TableCell>
                <TableCell className="text-right tabular-nums">{r.complete > 0 ? `${Math.round((r.onTime / r.complete) * 100)}%` : '-'}</TableCell>
                <TableCell className="pr-5 text-right tabular-nums">{r.complete > 0 ? fmtDuration(r.totalMs / r.complete / HOUR) : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
