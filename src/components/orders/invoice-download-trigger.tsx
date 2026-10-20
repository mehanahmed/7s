"use client";

import React, { useState, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ClientInvoiceDocument } from '@/components/invoices/ClientInvoicePDF';
import type { TrackingLink, CustomStatus } from '@/types';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface InvoiceDownloadTriggerProps {
  order: TrackingLink;
  allStatuses: CustomStatus[];
  onComplete: () => void;
}

export function InvoiceDownloadTrigger({
  order,
  allStatuses,
  onComplete,
}: InvoiceDownloadTriggerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 bg-background/50 backdrop-blur-sm z-[100] flex items-center justify-center">
      <Card className="w-80 shadow-2xl border border-border/40 p-6 flex flex-col items-center text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        <div>
          <h4 className="font-semibold text-foreground text-sm">Generating PDF Invoice</h4>
          <p className="text-xs text-muted-foreground mt-1">Please wait while we prepare order #{order.id}</p>
        </div>
        <div className="hidden">
          <PDFDownloadLink
            document={<ClientInvoiceDocument orders={[order]} allStatuses={allStatuses} />}
            fileName={`Invoice_${order.id}.pdf`}
          >
            {({ blob, url, loading }) => {
              if (!loading && url) {
                // Auto trigger download
                const link = window.document.createElement('a');
                link.href = url;
                link.download = `Invoice_${order.id}.pdf`;
                window.document.body.appendChild(link);
                link.click();
                window.document.body.removeChild(link);
                // Delay complete to allow browser download dialog to trigger
                setTimeout(onComplete, 500);
              }
              return null;
            }}
          </PDFDownloadLink>
        </div>
      </Card>
    </div>
  );
}
