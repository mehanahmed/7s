"use client";

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileText } from 'lucide-react';
import { Area, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DateRange } from 'react-day-picker';
import type { GlobalSettings, TrackingLink, User } from '@/types';
import { calculateSalesExecutiveSummary } from '@/lib/sales-executive-summary';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const formatBdt = (value: number) => `BDT ${value.toLocaleString('en-BD', { maximumFractionDigits: 2 })}`;
const chartColors = { collected: '#2563eb', outstanding: '#fbbf24' };

interface Props {
  orders: TrackingLink[];
  users: User[];
  settings: GlobalSettings | null;
  userId: string;
  dateRange?: DateRange;
  isLoading: boolean;
}

export function SalesExecutiveCharts({ orders, users, settings, userId, dateRange, isLoading }: Props) {
  const data = useMemo(() => calculateSalesExecutiveSummary(orders, users, settings, userId, dateRange), [orders, users, settings, userId, dateRange]);
  const gradientId = `sales-${useId().replace(/:/g, '')}`;
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const collectionData = [
    { name: 'Collected', value: data.collected, color: chartColors.collected },
    { name: 'Outstanding', value: data.outstanding, color: chartColors.outstanding },
  ];
  const noInvoices = data.collected + data.outstanding === 0;
  const panelClass = 'min-w-0 rounded-2xl border border-border/60 bg-card p-5 shadow-sm';

  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <section aria-label="Sales trend" className={panelClass}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold tracking-tight">Sales Trend</h3>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />Actual Sales</span>
              <span className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-slate-400" />Previous period</span>
            </div>
          </div>
          {isLoading ? <Skeleton className="h-60 w-full rounded-xl" /> : data.trend.length ? (
            <div className="h-60 w-full" role="img" aria-label={`Sales trend: ${formatBdt(data.totalSales)} in the selected period, compared with the previous period.`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.trend} margin={{ top: 8, right: 10, bottom: 0, left: 0 }} accessibilityLayer>
                  <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={32} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} dy={8} />
                  <YAxis tickLine={false} axisLine={false} width={62} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={value => Number(value).toLocaleString('en', { notation: 'compact', maximumFractionDigits: 1 })} />
                  <Tooltip content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as typeof data.trend[number] | undefined;
                    return active && point ? <div className="rounded-xl border bg-popover p-3 text-xs text-popover-foreground shadow-lg"><p className="mb-2 font-semibold">{point.date}</p><p className="text-blue-600">Actual: {formatBdt(point.sales)}</p><p className="mt-1 text-muted-foreground">Previous: {formatBdt(point.previousSales)}</p><p className="mt-1 text-[10px] text-muted-foreground">Compared with {point.previousDate}{data.weeklyTrend ? ' (weekly totals)' : ''}</p></div> : null;
                  }} />
                  <Area type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2.5} fill={`url(#${gradientId})`} dot={data.trend.length <= 31 ? { r: 3, fill: '#2563eb', strokeWidth: 0 } : false} activeDot={{ r: 5 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="previousSales" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">Select a date range to view sales.</div>}
          <p className="mt-2 text-[10px] text-muted-foreground">{data.weeklyTrend ? 'Weekly' : 'Daily'} sales in BDT, excluding VAT and shipping.</p>
        </section>
        <section aria-label="Collection overview" className={panelClass}>
          <h3 className="mb-5 text-base font-semibold tracking-tight">Collection Overview</h3>
          {isLoading ? <Skeleton className="h-60 w-full rounded-xl" /> : (
            <div className="flex min-h-60 flex-col items-center justify-center gap-4 sm:flex-row xl:flex-col 2xl:flex-row">
              <div className="relative h-44 w-44 shrink-0" role="img" aria-label={`${data.collectionPercent.toFixed(1)} percent collected; ${formatBdt(data.collected)} collected and ${formatBdt(data.outstanding)} outstanding.`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={noInvoices ? [{ name: 'No invoices', value: 1, color: 'hsl(var(--muted))' }] : collectionData} dataKey="value" innerRadius={62} outerRadius={82} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                      {(noInvoices ? [{ color: 'hsl(var(--muted))' }] : collectionData).map((item, index) => <Cell key={index} fill={item.color} />)}
                    </Pie>
                    {!noInvoices && <Tooltip formatter={(value: number) => formatBdt(value)} contentStyle={{ borderRadius: 12, background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', borderColor: 'hsl(var(--border))' }} />}
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-bold tabular-nums">{data.collectionPercent.toFixed(1)}%</span><span className="mt-1 text-xs text-muted-foreground">{noInvoices ? 'No invoices' : 'Collected'}</span></div>
              </div>
              <div className="min-w-0 flex-1 space-y-5">
                {collectionData.map(item => <div key={item.name} className="flex items-start gap-2.5"><span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><div><p className="text-xs font-medium text-muted-foreground">{item.name}</p><p className="mt-1 break-words text-base font-semibold tabular-nums">{formatBdt(item.value)}</p></div></div>)}
                <Button variant="outline" className="h-auto min-h-9 gap-2 whitespace-normal border-blue-200 px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950" disabled={!data.outstandingInvoices.length} onClick={() => setInvoicesOpen(true)}>View outstanding invoices<ArrowRight className="h-4 w-4 shrink-0" /></Button>
              </div>
            </div>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">Invoice balances for orders in the selected period, including VAT and shipping.</p>
        </section>
      </div>
      <Dialog open={invoicesOpen} onOpenChange={setInvoicesOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader><DialogTitle>Outstanding Invoices</DialogTitle><DialogDescription>Orders matching the selected Sales Executive and date range. Total due: {formatBdt(data.outstanding)}.</DialogDescription></DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <Table><TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Company</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader>
              <TableBody>{data.outstandingInvoices.map(invoice => <TableRow key={invoice.id}><TableCell><Link href={`/invoice/${encodeURIComponent(invoice.id)}`} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"><FileText className="h-3.5 w-3.5" />{invoice.id}</Link></TableCell><TableCell>{invoice.companyName}</TableCell><TableCell className="text-right font-semibold tabular-nums">{formatBdt(invoice.due)}</TableCell></TableRow>)}
              {!data.outstandingInvoices.length && <TableRow><TableCell colSpan={3} className="h-20 text-center text-muted-foreground">No outstanding invoices.</TableCell></TableRow>}</TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
