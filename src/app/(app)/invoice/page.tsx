
"use client";

import { vatAmountFor } from '@/lib/vat';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Printer, Search, Package, X, Loader2, Download, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TrackingLink, CustomStatus, AdvancePaymentRecord, User } from '@/types';
import { getOrdersWithTotal } from '@/lib/order-service';
import { getStatuses } from '@/lib/status-service';
import { getContrastTextColor } from '@/lib/color-utils';
import { getUsers } from '@/lib/user-service';
import { getFullOrdersByIds } from './actions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { Checkbox } from "@/components/ui/checkbox";
import { InvoiceDetailsClient } from '../invoice/[orderId]/InvoiceDetailsClient';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis
} from "@/components/ui/pagination";


const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  const amount = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(amount)) return 'N/A';
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export default function InvoiceListPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [allOrders, setAllOrders] = useState<TrackingLink[]>([]);
  const [allStatuses, setAllStatuses] = useState<CustomStatus[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [ordersToPrint, setOrdersToPrint] = useState<TrackingLink[] | null>(null);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState<string | null>(null);
  const [isDownloadingMultiple, setIsDownloadingMultiple] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const ITEMS_PER_PAGE = 25;

  const fetchInvoiceData = useCallback(async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const role = currentUser.role;
      const userId = (role === 'SYSTEM_ADMIN' || role === 'ADMIN') ? undefined : currentUser.id;

      const promises: any[] = [
        getOrdersWithTotal(
          undefined, 
          undefined, 
          role, 
          userId, 
          currentPage, 
          ITEMS_PER_PAGE, 
          debouncedSearchTerm, 
          undefined, 
          selectedStatus
        ),
      ];

      if (allStatuses.length === 0) promises.push(getStatuses());
      if (allUsers.length === 0) promises.push(getUsers());

      const [ordersResult, fetchedStatuses, fetchedUsers] = await Promise.all(promises);

      setAllOrders(ordersResult.orders);
      setTotalOrders(ordersResult.total);
      if (fetchedStatuses) setAllStatuses(fetchedStatuses);
      if (fetchedUsers) setAllUsers(fetchedUsers);
    } catch (error) {
      console.error("Failed to fetch orders or statuses:", error);
      toast({ title: "Error", description: "Could not load invoice data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast, allStatuses.length, allUsers.length, debouncedSearchTerm, currentPage, selectedStatus]);

  useEffect(() => {
    fetchInvoiceData();
  }, [currentUser, fetchInvoiceData]);

  const totalPages = Math.ceil(totalOrders / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedStatus]);

  const renderPagination = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, currentPage + 2);

      if (currentPage < 3) endPage = maxPagesToShow;
      else if (currentPage > totalPages - 2) startPage = totalPages - maxPagesToShow + 1;

      if (startPage > 1) {
        pageNumbers.push(1);
        if (startPage > 2) pageNumbers.push('...');
      }
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pageNumbers.push('...');
        pageNumbers.push(totalPages);
      }
    }
    return pageNumbers.map((page, index) => (
      <PaginationItem key={index}>
        {page === '...' ? <PaginationEllipsis />
          : <PaginationLink href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(page as number); }} className={cn(currentPage === page && 'bg-primary text-primary-foreground hover:bg-primary/90')}>
            {page}
          </PaginationLink>
        }
      </PaginationItem>
    ));
  };


  const handlePrintInvoices = async (orderIds: string[]) => {
    if (orderIds.length === 0) return;
    setIsPreparingPrint(true);
    try {
      const fullOrders = await getFullOrdersByIds(orderIds);
      if (fullOrders.length !== orderIds.length) {
        toast({ title: "Print Warning", description: "Some selected invoices could not be found.", variant: "destructive" });
      }
      if (fullOrders.length > 0) {
        setOrdersToPrint(fullOrders);
      } else {
        setIsPreparingPrint(false);
      }
    } catch (error) {
      console.error("Failed to fetch full orders for printing:", error);
      toast({ title: "Print Error", description: "Could not prepare invoices for printing.", variant: "destructive" });
      setIsPreparingPrint(false);
    }
  };

  useEffect(() => {
    if (ordersToPrint) {
      const handleAfterPrint = () => {
        setOrdersToPrint(null);
        setIsPreparingPrint(false);
        setSelectedRowIds(new Set());
        window.removeEventListener('afterprint', handleAfterPrint);
      };

      window.addEventListener('afterprint', handleAfterPrint);

      const timer = setTimeout(() => {
        window.print();
      }, 800);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('afterprint', handleAfterPrint);
      };
    }
  }, [ordersToPrint]);

  const triggerPdfPrint = (url: string) => {
    // Create a hidden off-screen iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '1024px';
    iframe.style.height = '768px';
    iframe.style.border = '0';
    iframe.src = url;
    
    document.body.appendChild(iframe);
    
    // Backup programmatic print trigger in case embedded script execution is delayed
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.warn("Direct iframe print call blocked or not supported by browser PDF viewer. Relying on embedded PDF auto-print script.", e);
      }
    };
    
    // Clean up the iframe after 15 seconds to ensure print completes loading
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 15000);
  };

  const handleDownloadPDF = async (order: TrackingLink) => {
    setIsDownloadingPDF(order.id);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { InvoicePDF } = await import('@/components/invoices/InvoicePDF');
      
      const initialBlob = await pdf(<InvoicePDF orders={[order]} />).toBlob();
      
      // Inject auto-print action using pdf-lib
      const { PDFDocument } = await import('pdf-lib');
      const arrayBuffer = await initialBlob.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      pdfDoc.addJavaScript('print', 'this.print({bUI: true, bSilent: false, bShrinkToFit: true});');
      const modifiedPdfBytes = await pdfDoc.save();
      const printBlob = new Blob([modifiedPdfBytes as any], { type: 'application/pdf' });
      
      const url = URL.createObjectURL(printBlob);
      
      // Trigger print dialog directly (no download)
      triggerPdfPrint(url);
      
      toast({ title: "Print Ready", description: `Print dialog opened for Invoice ${order.id}.` });
      
      // Revoke the object URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setIsDownloadingPDF(null);
    }
  };

  const handleDownloadMultiplePDFs = async (orderIds: string[]) => {
    if (orderIds.length === 0) return;
    setIsDownloadingMultiple(true);
    try {
      const fullOrders = await getFullOrdersByIds(orderIds);
      if (fullOrders.length === 0) {
        toast({ title: "Print Error", description: "Could not retrieve selected orders.", variant: "destructive" });
        return;
      }
      
      const { pdf } = await import('@react-pdf/renderer');
      const { InvoicePDF } = await import('@/components/invoices/InvoicePDF');

      const initialBlob = await pdf(<InvoicePDF orders={fullOrders} />).toBlob();
      
      // Inject auto-print action using pdf-lib
      const { PDFDocument } = await import('pdf-lib');
      const arrayBuffer = await initialBlob.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      pdfDoc.addJavaScript('print', 'this.print({bUI: true, bSilent: false, bShrinkToFit: true});');
      const modifiedPdfBytes = await pdfDoc.save();
      const printBlob = new Blob([modifiedPdfBytes as any], { type: 'application/pdf' });
      
      const url = URL.createObjectURL(printBlob);
      
      if (fullOrders.length === 1) {
        toast({ title: "Print Ready", description: `Print dialog opened for Invoice ${fullOrders[0].id}.` });
      } else {
        toast({ title: "Print Ready", description: `${fullOrders.length} Invoices merged. Print dialog opened.` });
      }
      
      // Trigger print dialog directly (no download)
      triggerPdfPrint(url);
      
      setSelectedRowIds(new Set());
      
      // Revoke the object URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error("Multiple PDF generation error:", error);
      toast({ title: "Error", description: "Failed to generate multiple PDFs.", variant: "destructive" });
    } finally {
      setIsDownloadingMultiple(false);
    }
  };

  useEffect(() => {
    setSelectedRowIds(new Set());
  }, [searchTerm, selectedStatus]);
  

  const getOrderFinancials = useCallback((order: TrackingLink) => {
    const orderSubtotal = (order.orderItems || []).reduce((acc, item) => acc + (item.isGift ? 0 : (Number(item.lineItemTotalPrice) || 0)), 0);
    const effectiveDiscount = Number(order.specialClientDiscount) || 0;
    const netPayable = orderSubtotal - effectiveDiscount;
    const shippingCharge = Number(order.shippingCharge) || 0;

    const allAdvancePaymentRecords: AdvancePaymentRecord[] = [];
    if (order.advancePayments && order.advancePayments.length > 0) {
      allAdvancePaymentRecords.push(...order.advancePayments);
    } else if (order.advancePayment && Number(order.advancePayment) > 0) {
      allAdvancePaymentRecords.push({
        id: 'legacy-advance',
        amount: Number(order.advancePayment),
        date: order.createdAt,
        paymentMethod: order.paymentMethod || "Unknown",
        notes: "Initial advance payment (legacy data).",
        recordedByUserId: order.crmUserId,
        recordedByUserName: order.crmUserName,
      });
    }

    const totalAdvancePaid = allAdvancePaymentRecords.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
    const grandTotal = netPayable + vatAmountFor(netPayable, order.vatPercentage) + shippingCharge;
    const amountDue = grandTotal - totalAdvancePaid;

    return { netPayable, paidAmount: totalAdvancePaid, dueAmount: amountDue };
  }, []);

  const getStatusDisplayInfo = useCallback((statusId: string): { name: string; color: string; textColor: string } => {
    const status = allStatuses.find(s => s.id === statusId);
    if (status) {
      return { name: status.name, color: status.color, textColor: getContrastTextColor(status.color) };
    }
    return { name: 'N/A', color: '#A1A1AA', textColor: '#FFFFFF' };
  }, [allStatuses]);

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedRowIds(prev => {
        const newSelection = new Set(prev);
        allOrders.forEach((o: any) => newSelection.add(o.id));
        return newSelection;
      });
    } else {
      setSelectedRowIds(prev => {
        const newSelection = new Set(prev);
        allOrders.forEach((o: any) => newSelection.delete(o.id));
        return newSelection;
      });
    }
  };

  const handleSelectRow = (orderId: string, checked: boolean) => {
    setSelectedRowIds(prev => {
      const newSelection = new Set(prev);
      if (checked) {
        newSelection.add(orderId);
      } else {
        newSelection.delete(orderId);
      }
      return newSelection;
    });
  };

  const numSelected = selectedRowIds.size;
  const tableHeaderTopClass = numSelected > 0 ? "lg:top-[13.25rem]" : "lg:top-[9.5rem]";

  const isAllPageSelected = useMemo(() => {
    return allOrders.length > 0 && allOrders.every(o => selectedRowIds.has(o.id));
  }, [allOrders, selectedRowIds]);

  const isSomePageSelected = useMemo(() => {
    return allOrders.some(o => selectedRowIds.has(o.id)) && !isAllPageSelected;
  }, [allOrders, selectedRowIds, isAllPageSelected]);

  return (
    <>
      <div className="space-y-6 print:hidden">
        <Card className="shadow-xl border bg-card rounded-lg">
          <CardHeader className="border-b p-5 lg:sticky lg:top-[4.5rem] lg:z-20 lg:bg-card lg:rounded-t-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex-grow">
                <CardTitle className="text-card-foreground text-xl">All Order Invoices</CardTitle>
                <CardDescription className="text-muted-foreground text-sm mt-0.5">
                  A list of all generated orders and their financial status.
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-grow sm:flex-grow-0 sm:min-w-[280px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-background h-10 rounded-md w-full"
                  />
                </div>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full sm:w-[180px] h-10 bg-background">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {[
                      'order-submitted',
                      'co-clearance',
                      'ready-for-design',
                      'on-hold',
                      'logistics',
                      'shipped',
                      'delivered',
                      'cancelled'
                    ].map((statusId) => {
                      const status = allStatuses.find(s => s.id === statusId);
                      if (!status) return null;
                      return (
                        <SelectItem key={status.id} value={status.id}>
                          {status.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {numSelected > 0 && (
              <div className="flex items-center gap-4 px-5 h-[60px] bg-secondary/95 backdrop-blur-sm border-b lg:sticky lg:top-[9.5rem] lg:z-20">
                <div className="text-sm font-semibold text-foreground flex-1">
                  {numSelected} row{numSelected > 1 ? 's' : ''} selected.
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadMultiplePDFs(Array.from(selectedRowIds))}
                    disabled={isDownloadingMultiple}
                  >
                    {isDownloadingMultiple ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Printing...</>
                    ) : (
                      <><Printer className="mr-2 h-4 w-4" /> Print</>
                    )}
                  </Button>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setSelectedRowIds(new Set())}>
                  <X className="h-4 w-4" />
                  <span className="sr-only">Clear selection</span>
                </Button>
              </div>
            )}
            <div className="lg:overflow-visible">
              <Table containerClassName="overflow-auto lg:overflow-visible">
                <TableHeader className={`lg:sticky ${tableHeaderTopClass} bg-card z-20 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]`}>
                  <TableRow>
                    <TableHead className={`w-12 text-center pl-4 lg:sticky ${tableHeaderTopClass} bg-card z-20`}>
                      <Checkbox
                        checked={
                          isSomePageSelected
                            ? 'indeterminate'
                            : isAllPageSelected
                        }
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all rows"
                      />
                    </TableHead>
                    <TableHead className={`lg:sticky ${tableHeaderTopClass} bg-card z-20`}>Order ID</TableHead>
                    <TableHead className={`lg:sticky ${tableHeaderTopClass} bg-card z-20`}>Company</TableHead>
                    <TableHead className={`lg:sticky ${tableHeaderTopClass} bg-card z-20`}>Net Payable</TableHead>
                    <TableHead className={`lg:sticky ${tableHeaderTopClass} bg-card z-20`}>Paid</TableHead>
                    <TableHead className={`lg:sticky ${tableHeaderTopClass} bg-card z-20`}>Due</TableHead>
                    <TableHead className={`lg:sticky ${tableHeaderTopClass} bg-card z-20`}>Status</TableHead>
                    <TableHead className={`lg:sticky ${tableHeaderTopClass} bg-card z-20 text-right pr-6`}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(8)].map((_, i) => (
                      <TableRow key={`skel-invoice-${i}`}>
                        <TableCell className="text-center pl-4"><Skeleton className="h-5 w-5" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                        <TableCell className="text-right pr-6"><Skeleton className="h-8 w-8 ml-auto rounded" /></TableCell>
                      </TableRow>
                    ))
                  ) : allOrders.length > 0 ? (
                    allOrders.map((order) => {
                      const financials = getOrderFinancials(order);
                      const statusInfo = getStatusDisplayInfo(order.currentStatus);
                      const isSelected = selectedRowIds.has(order.id);
                      return (
                        <TableRow key={order.id} className="hover:bg-muted/50 transition-colors" data-state={isSelected ? "selected" : ""}>
                          <TableCell className="text-center pl-4">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleSelectRow(order.id, !!checked)}
                              aria-label={`Select row for order ${order.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-primary">
                            <Link href={`/invoice/${order.id}`} className="hover:underline" target="_blank" rel="noopener noreferrer">
                              {order.id}
                            </Link>
                          </TableCell>
                          <TableCell className="text-card-foreground">{order.companyName}</TableCell>
                          <TableCell className="text-card-foreground font-mono">{formatCurrency(financials.netPayable)}</TableCell>
                          <TableCell className="text-green-600 font-mono">{formatCurrency(financials.paidAmount)}</TableCell>
                          <TableCell className={cn("font-mono", financials.dueAmount > 0.01 ? "text-red-600" : "text-green-600")}>
                            {formatCurrency(financials.dueAmount)}
                          </TableCell>
                          <TableCell>
                            <Badge style={{ backgroundColor: statusInfo.color, color: statusInfo.textColor }} className="border-transparent">
                              {statusInfo.name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Actions">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() => handleDownloadPDF(order)}
                                  className="cursor-pointer"
                                  disabled={isDownloadingPDF === order.id}
                                >
                                  {isDownloadingPDF === order.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Printer className="mr-2 h-4 w-4" />
                                  )}
                                  Print PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => handlePrintInvoices([order.id])}
                                  className="cursor-pointer"
                                >
                                  <Printer className="mr-2 h-4 w-4" />
                                  Print Invoice
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 h-[300px]">
                        <Package className="mx-auto h-12 w-12 opacity-50 mb-3 text-muted-foreground" />
                        <p className="text-lg text-muted-foreground font-medium">No orders found.</p>
                        <p className="text-sm text-muted-foreground">
                          {searchTerm ? "Try adjusting your search term." : "Create a new order to see it here."}
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          {totalPages > 1 && (
            <CardFooter className="py-4 border-t">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }}
                      aria-disabled={currentPage === 1}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                  {renderPagination()}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }}
                      aria-disabled={currentPage === totalPages}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </CardFooter>
          )}

        </Card>
      </div>

      {/* Hidden container for printing */}
      {ordersToPrint && (
        <div className="absolute left-[-9999px] top-[-9999px] opacity-0 pointer-events-none print:static print:opacity-100 print:pointer-events-auto print:block print:w-full print:h-auto print:overflow-visible">
          {ordersToPrint.map(order => (
            <div key={`print-${order.id}`} className="invoice-page">
              <InvoiceDetailsClient
                order={order}
                allStatuses={allStatuses}
                allUsers={allUsers}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
