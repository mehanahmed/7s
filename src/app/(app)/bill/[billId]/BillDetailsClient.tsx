
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Store, MapPin, Phone, FileText, StickyNote, Percent, ReceiptText, CheckCircle, Truck, User } from "lucide-react";
import type { VendorBill, BillPaymentRecord, User as VendorUser } from "@/types";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from '@/components/ui/skeleton';
import { parseISO, format } from 'date-fns';
import JsBarcode from 'jsbarcode';

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BDT' }).format(value);
};

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return "Loading date...";
  try {
    const date = parseISO(dateString);
    return format(date, "d MMM, yyyy");
  } catch (e) {
    return "Invalid Date";
  }
};


interface BillDetailsClientProps {
  bill: VendorBill;
  vendor: VendorUser | null;
}

export function BillDetailsClient({ bill: initialBill, vendor }: BillDetailsClientProps) {
  const [bill, setBill] = useState(initialBill);
  const [isClient, setIsClient] = useState(false);
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && bill.id) {
      try {
        JsBarcode(barcodeRef.current, bill.id, {
          format: "CODE128",
          displayValue: false,
          width: 2,
          height: 50,
          margin: 10,
        });
      } catch (e) {
        console.error("JsBarcode error:", e);
      }
    }
  }, [bill.id]);

  useEffect(() => {
    setIsClient(true);
    setBill(initialBill);
  }, [initialBill]);

  const showPaidBadge = bill.status === 'Paid';

  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-8 bg-card border border-border/40 rounded-xl shadow-2xl print:shadow-none print:border-none print:p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start mb-6 pb-6 border-b border-border/30 print:mb-4 print:pb-4">
        <div>
          <h2 className="text-3xl font-bold text-primary mb-2 flex items-center"><FileText className="h-8 w-8 mr-3" /> INVOICE</h2>
          <div className="mb-2">
            <Image
              src="/logo.png"
              alt="Seven Solution Logo"
              width={160}
              height={40}
              priority
              className="object-contain rounded-md"
            />
          </div>
          <p className="text-muted-foreground text-sm">Mirpur, Section - 12, Road - 02 Block - A, House - 133, 1216</p>
          <p className="text-muted-foreground text-sm">savensolution@gmail.com | +880 14100-28884</p>
        </div>
        <div className="text-left sm:text-right mt-4 sm:mt-0">
          <p className="text-lg font-semibold">Bill ID: <span className="text-foreground">{bill.id}</span></p>
          <div className="text-sm text-muted-foreground">Bill Date: {isClient ? formatDate(bill.billDate) : <div className="h-4 w-40"><Skeleton className="h-full w-full" /></div>}</div>
          {bill.dueDate && <div className="text-sm text-destructive font-medium">Due Date: {isClient ? formatDate(bill.dueDate) : <div className="h-4 w-40"><Skeleton className="h-full w-full" /></div>}</div>}
          <div className="mt-2"><svg ref={barcodeRef} className="object-contain" data-ai-hint="barcode scan"></svg></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 print:mb-4">
        <div className="space-y-1 p-4 bg-secondary/40 border border-border/20 rounded-lg shadow-sm">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2"><Store className="h-4 w-4" />Bill To:</h4>
          {vendor ? (
            <>
              <p className="text-lg font-semibold text-foreground">{vendor.companyName || vendor.name}</p>
              <p className="text-foreground/90 text-sm flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />{vendor.address}</p>
              <p className="text-foreground/90 text-sm flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{vendor.phone}</p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Vendor information not available.</p>
          )}
        </div>
      </div>


      {Array.isArray(bill.items) && bill.items.length > 0 && (
        <div className="mb-6 print:mb-4">
          <h3 className="text-lg font-semibold mb-3 text-foreground flex items-start">Bill Items</h3>
          <div className="overflow-x-auto rounded-lg border border-border/30 bg-background shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Product</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-center">Quantity</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">Unit Price</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">Total Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bill.items.map((item, index) => (
                  <TableRow key={item.id || index} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium text-card-foreground">{item.productName}</TableCell>
                    <TableCell className="text-center text-card-foreground">{item.quantity}</TableCell>
                    <TableCell className="text-right text-card-foreground">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right font-semibold text-card-foreground">{formatCurrency(item.lineItemTotalPrice)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {bill.notes && (
        <div className="mb-8 print:mb-4">
          <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center"><StickyNote className="mr-2 h-5 w-5 text-primary/80" />Notes:</h3>
          <Card className="bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700/40 shadow-sm">
            <CardContent className="p-4 text-sm text-amber-800 dark:text-amber-200 whitespace-pre-wrap">{bill.notes}</CardContent>
          </Card>
        </div>
      )}

      {bill.payments && bill.payments.length > 0 && (
        <div className="mb-8 print:mb-4">
          <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center"><ReceiptText className="mr-2 h-5 w-5 text-primary/80" />Payments History</h3>
          <div className="overflow-x-auto rounded-lg border border-border/30 bg-background shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Recorded By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bill.payments.map((record) => (
                  <TableRow key={record.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="text-xs text-muted-foreground">{isClient ? formatDate(record.date) : <Skeleton className="h-4 w-24" />}</TableCell>
                    <TableCell className="font-medium text-green-600">{formatCurrency(record.amount)}</TableCell>
                    <TableCell className="text-card-foreground">{record.paymentMethod || 'N/A'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record.notes || 'N/A'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record.recordedByUserName || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="flex justify-end mt-8 pt-6 border-t border-border/30 print:mt-4 print:pt-4">
        <div className="w-full max-w-xs sm:max-w-sm relative">
          <div className="flex justify-between mb-1"><span className="text-md text-muted-foreground">Items Subtotal:</span><span className="text-md font-medium text-foreground">{formatCurrency(bill.subtotal)}</span></div>
          {bill.discount > 0 && (<div className="flex justify-between mb-1"><span className="text-md text-muted-foreground flex items-center"><Percent className="h-4 w-4 mr-1 text-red-500" />Discount:</span><span className="text-md font-medium text-red-500">- {formatCurrency(bill.discount)}</span></div>)}
          <div className="flex justify-between mb-2 pt-1 border-t border-dashed border-border/40"><span className="text-md font-semibold text-foreground">Net Total:</span><span className="text-md font-bold text-foreground">{formatCurrency(bill.total)}</span></div>

          {bill.paidAmount > 0 && (
            <div className="flex justify-between mb-2">
              <span className="text-md text-muted-foreground">{showPaidBadge ? "Total Paid:" : "Total Advance Paid:"}</span>
              <span className="font-medium text-green-600">- {formatCurrency(bill.paidAmount)}</span>
            </div>
          )}

          {showPaidBadge ? (
            <div className="absolute -left-16 -top-12 sm:-left-24 sm:-top-16 transform -rotate-[20deg]">
              <Image
                src="/paid-stamp.png"
                alt="Paid Stamp"
                width={150}
                height={150}
                className="opacity-80"
                unoptimized
              />
            </div>
          ) : (bill.dueAmount > 0.01) && (
            <>
              <Separator className="my-2 bg-border/50" />
              <div className="flex justify-between">
                <span className="text-lg font-bold text-primary">Amount Due:</span>
                <span className="text-lg font-bold text-primary">{formatCurrency(bill.dueAmount)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
