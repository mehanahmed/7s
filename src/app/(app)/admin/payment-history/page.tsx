
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Wallet, ArrowUpDown, Download, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAllPaymentHistory, getPaymentHistoryPaginated } from '@/lib/payment-history-service';
import { updateAdvancePaymentStatus } from '@/lib/order-service'; // Corrected import
import type { BillReport, AdvancePaymentRecord, TrackingLink } from '@/types';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, subDays, isAfter, startOfMonth, endOfMonth } from 'date-fns';
import { DateRangePicker, type DateRange } from '@/components/dashboard/date-range-picker';
import Papa from 'papaparse';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';


const ITEMS_PER_PAGE = 25;

const formatCurrency = (value?: number | null): string => {
  if (value === undefined || value === null || isNaN(value)) return 'BDT 0.00';
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(value);
};

const formatDateSafe = (dateValue?: string | Date) => {
  if (!dateValue) return 'No Date';
  try {
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : dateValue;
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    return format(date, 'd MMM, yyyy, h:mm a');
  } catch (e) {
    console.error("Invalid date value for formatting:", dateValue, e);
    return 'Invalid Date';
  }
};

type SortKey = 'vendorName' | 'date' | 'payment';
type SortDirection = 'asc' | 'desc';

type PaymentHistoryEntry = BillReport & { orderId?: string };


export default function PaymentHistoryPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const router = useRouter();

  const [allPayments, setAllPayments] = useState<PaymentHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [payments, setPayments] = useState<any[]>([]);
  const [totalPayments, setTotalPayments] = useState(0);
  const [periodTotalAmount, setPeriodTotalAmount] = useState(0);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return {
      from: startOfMonth(today),
      to: endOfMonth(today),
    };
  });
  const [paymentToUpdate, setPaymentToUpdate] = useState<PaymentHistoryEntry | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const startDateStr = selectedDateRange?.from ? startOfDay(selectedDateRange.from).toISOString() : undefined;
      const endDateStr = selectedDateRange?.to ? endOfDay(selectedDateRange.to).toISOString() : undefined;

      const res = await getPaymentHistoryPaginated(
        currentPage,
        ITEMS_PER_PAGE,
        debouncedSearchTerm,
        startDateStr,
        endDateStr,
        sortConfig
      );
      setPayments(res.payments);
      setTotalPayments(res.total);
      setPeriodTotalAmount(res.totalAmount ?? 0);
    } catch (error) {
      toast({ title: "Error", description: "Could not load payment history.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, currentPage, debouncedSearchTerm, selectedDateRange, sortConfig]);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role !== 'SYSTEM_ADMIN') {
        router.replace('/dashboard');
        return;
    }
    fetchData();
  }, [fetchData, currentUser, router]);

  const totalPayment = useMemo(() => payments.reduce((sum, p) => sum + (Number(p.payment) || 0), 0), [payments]);

  const totalPages = Math.ceil(totalPayments / ITEMS_PER_PAGE);
  
  const handleStatusDoubleClick = (payment: PaymentHistoryEntry) => {
    // Only allow changing status for payments linked to an order
    if (payment.orderId && (payment.status === 'Pending' || payment.status === 'Approved')) {
      setPaymentToUpdate(payment);
      setIsConfirmDialogOpen(true);
    }
  };

  const handleConfirmStatusUpdate = async () => {
    if (!paymentToUpdate || !paymentToUpdate.orderId) return;
    
    const newStatus = paymentToUpdate.status === 'Pending' ? 'Approved' : 'Pending';

    setIsUpdatingStatus(true);
    const result = await updateAdvancePaymentStatus(paymentToUpdate.orderId, paymentToUpdate.id, newStatus);

    if (result.success && result.order) {
      toast({ title: "Status Updated", description: `Payment for order ${paymentToUpdate.vendorName} marked as ${newStatus}.` });
      
      // Silent UI update
      setPayments(prevPayments => {
        return prevPayments.map(p => {
            if (p.id === paymentToUpdate.id) {
                return { ...p, status: newStatus };
            }
            return p;
        });
      });

    } else {
      toast({ title: "Update Failed", description: result.error || "Failed to update status in the database.", variant: "destructive" });
    }

    setIsUpdatingStatus(false);
    setIsConfirmDialogOpen(false);
    setPaymentToUpdate(null);
  };
  
  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };
  
  const getSortIndicator = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };
  
  const handleExport = () => {
    if (payments.length === 0) {
      toast({ title: "No Data to Export", description: "There is no data matching the current filters." });
      return;
    }
    const dataToExport = payments.map(p => ({
      'Order ID': p.vendorName,
      'Company': p.invoiceId, 
      'Payment Amount': p.payment,
      'Reference/Notes': p.notes?.toLowerCase().includes('steadfast webhook') ? 'SteadFast' : p.notes || p.id,
      'Status': p.status || 'Pending',
      'Method': p.method,
      'Date': formatDateSafe(p.date),
    }));
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'payment_history.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderTableRows = () => {
    if (isLoading) {
      return [...Array(10)].map((_, i) => (
        <TableRow key={`skel-${i}`}>
          <TableCell colSpan={7}>
            <Skeleton className="h-8 w-full" />
          </TableCell>
        </TableRow>
      ));
    }
    if (payments.length > 0) {
      return payments.map((p) => (
        <TableRow key={p.id}>
          <TableCell className="font-medium">{p.vendorName}</TableCell>
          <TableCell>{p.invoiceId}</TableCell>
          <TableCell className="text-right font-mono text-green-600">{p.payment > 0 ? formatCurrency(p.payment) : '-'}</TableCell>
          <TableCell className="font-mono text-xs">
            {p.notes?.toLowerCase().includes('steadfast webhook') ? 'SteadFast' : (p.notes || p.id)}
          </TableCell>
          <TableCell onDoubleClick={() => handleStatusDoubleClick(p)}>
            <Badge 
              variant={'secondary'} 
              className={cn(
                p.status === 'Pending' && 'cursor-pointer bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
                p.status === 'Approved' && 'cursor-pointer bg-green-100 text-green-800 hover:bg-green-200'
              )}
            >
                {p.status || 'Pending'}
            </Badge>
          </TableCell>
          <TableCell>{p.method}</TableCell>
          <TableCell>{formatDateSafe(p.date)}</TableCell>
        </TableRow>
      ));
    }
    return (
      <TableRow>
        <TableCell colSpan={7} className="text-center h-48">No payment records found for the selected criteria.</TableCell>
      </TableRow>
    );
  };

  if (!currentUser || currentUser.role !== 'SYSTEM_ADMIN') {
    return (
        <div className="flex h-[calc(100vh-10rem)] w-full items-center justify-center text-center">
            <div>
                <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
                <h2 className="mt-4 text-xl font-semibold">Access Denied</h2>
                <p className="mt-2 text-muted-foreground">You must be a System Administrator to view this page.</p>
            </div>
        </div>
    );
  }


  return (
    <>
    <div className="space-y-6">
      <Card className="shadow-lg border bg-card rounded-lg overflow-hidden">
        <CardHeader className="border-b p-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Wallet className="h-6 w-6 text-primary" />
                  Payment History
                </CardTitle>
                <CardDescription className="mt-1">
                  A comprehensive log of all advance payments from customer orders.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>
                 <DateRangePicker initialRange={selectedDateRange} onDateRangeChange={(r) => setSelectedDateRange(r)} />
                 <Button variant="outline" onClick={handleExport} disabled={payments.length === 0}><Download className="mr-2 h-4 w-4"/>Export</Button>
              </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => requestSort('vendorName')}>Order ID {getSortIndicator('vendorName')}</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => requestSort('payment')}>Payment Amount {getSortIndicator('payment')}</TableHead>
                  <TableHead>Reference/Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => requestSort('date')}>Date {getSortIndicator('date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderTableRows()}
              </TableBody>
            </Table>
          </div>
        </CardContent>
         <CardFooter className="py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm font-semibold flex flex-wrap items-center gap-2">
            <span>Total Paid in this Period:</span>
            <span className="text-primary font-bold">{formatCurrency(periodTotalAmount)}</span>
            {totalPages > 1 && (
              <span className="text-xs text-muted-foreground font-normal">
                (Page {currentPage}: {formatCurrency(totalPayment)})
              </span>
            )}
          </div>
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }} aria-disabled={currentPage === 1} className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}/>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#" isActive>
                    {currentPage}
                  </PaginationLink>
                </PaginationItem>
                 <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }} aria-disabled={currentPage === totalPages} className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}/>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardFooter>
      </Card>
    </div>

    <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Confirm Status Change
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to mark the payment for order <span className="font-semibold">{paymentToUpdate?.vendorName}</span> as '{paymentToUpdate?.status === 'Pending' ? 'Approved' : 'Pending'}'?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setIsConfirmDialogOpen(false)} disabled={isUpdatingStatus}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmStatusUpdate} disabled={isUpdatingStatus}>
            {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isUpdatingStatus ? 'Updating...' : `Mark as ${paymentToUpdate?.status === 'Pending' ? 'Approved' : 'Pending'}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    </>
  );
}
