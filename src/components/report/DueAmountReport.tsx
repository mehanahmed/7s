"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Search, ExternalLink, CircleAlert, CheckCircle2 } from 'lucide-react';
import type { OutstandingInvoice } from '@/lib/sales-executive-summary';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';

const formatBdt = (value: number) => `BDT ${value.toLocaleString('en-BD', { maximumFractionDigits: 2 })}`;

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'dd MMM yyyy');
  } catch {
    return iso;
  }
};

interface DueAmountReportProps {
  invoices: OutstandingInvoice[];
  isLoading: boolean;
}

export function DueAmountReport({ invoices, isLoading }: DueAmountReportProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredInvoices = useMemo(() => {
    if (!searchTerm.trim()) return invoices;
    const term = searchTerm.toLowerCase();
    return invoices.filter(inv =>
      inv.id.toLowerCase().includes(term) ||
      inv.companyName.toLowerCase().includes(term) ||
      inv.crmName.toLowerCase().includes(term)
    );
  }, [invoices, searchTerm]);

  const totalDue = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + inv.due, 0);
  }, [invoices]);

  return (
    <section aria-label="Due amount report" className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight text-foreground">Due Amount Report</h3>
            {!isLoading && invoices.length > 0 && (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                {invoices.length} Pending
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {isLoading
              ? 'Loading due report...'
              : `Total outstanding balance: ${formatBdt(totalDue)} across ${invoices.length} order(s)`}
          </p>
        </div>

        {invoices.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Search by client, ID, CR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-9 text-xs"
            />
          </div>
        )}
      </div>

      <div className="overflow-x-auto px-4 py-2">
        <Table className="min-w-[850px]">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead scope="col" className="w-12 text-center">#</TableHead>
              <TableHead scope="col">Order ID</TableHead>
              <TableHead scope="col">Client / Company</TableHead>
              <TableHead scope="col">CRM Executive</TableHead>
              <TableHead scope="col">Order Date</TableHead>
              <TableHead scope="col" className="text-right">Billed Amount</TableHead>
              <TableHead scope="col" className="text-right">Paid Amount</TableHead>
              <TableHead scope="col" className="text-right">Due Amount</TableHead>
              <TableHead scope="col" className="text-center w-20">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={9}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredInvoices.length > 0 ? (
              filteredInvoices.map((inv, index) => (
                <TableRow key={inv.id} className="hover:bg-muted/30">
                  <TableCell className="text-center text-xs font-mono text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/invoice/${encodeURIComponent(inv.id)}`}
                      className="inline-flex items-center gap-1.5 font-medium font-mono text-primary hover:underline text-xs"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      {inv.id}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium text-xs">
                    {inv.companyName}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {inv.crmName}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(inv.createdAt)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {formatBdt(inv.totalBilled)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatBdt(inv.paidAmount)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    {formatBdt(inv.due)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
                      <Link href={`/invoice/${encodeURIComponent(inv.id)}`} target="_blank">
                        View
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    <p className="text-sm font-medium">No outstanding dues for this period</p>
                    <p className="text-xs text-muted-foreground">All orders within the selected filter are fully paid.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
