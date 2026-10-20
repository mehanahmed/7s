"use client";

import React, { useState, useEffect } from 'react';
import { Document, PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import type { TrackingLink, CustomStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Download, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InvoicePdfPage } from './InvoicePdfPage';

interface InvoicePageProps {
  order: TrackingLink;
  allStatuses: CustomStatus[];
  designApprovalStatusIds?: string[];
  docsApprovalStatusIds?: string[];
}

// the client copy uses the same page as the staff invoice
const ClientInvoicePage = ({ order }: InvoicePageProps) => <InvoicePdfPage order={order} />;

// Document wrapper containing the custom client pages
export const ClientInvoiceDocument = ({
  orders,
  allStatuses,
  designApprovalStatusIds = [],
  docsApprovalStatusIds = [],
}: {
  orders: TrackingLink[];
  allStatuses: CustomStatus[];
  designApprovalStatusIds?: string[];
  docsApprovalStatusIds?: string[];
}) => {
  return (
    <Document>
      {orders.map((order) => (
        <ClientInvoicePage
          key={order.id}
          order={order}
          allStatuses={allStatuses}
          designApprovalStatusIds={designApprovalStatusIds}
          docsApprovalStatusIds={docsApprovalStatusIds}
        />
      ))}
    </Document>
  );
};

interface ClientInvoicePDFProps {
  order: TrackingLink;
  allStatuses: CustomStatus[];
  designApprovalStatusIds?: string[];
  docsApprovalStatusIds?: string[];
}

function DownloadTrigger({ url, loading, fileName, onComplete }: { url: string | null; loading: boolean; fileName: string; onComplete: () => void }) {
  useEffect(() => {
    if (!loading && url) {
      const link = window.document.createElement('a');
      link.href = url;
      link.download = fileName;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      onComplete();
    }
  }, [url, loading, fileName, onComplete]);

  return (
    <span
      className="inline-flex items-center justify-center gap-2 h-10 px-5 bg-primary/85 text-primary-foreground font-semibold rounded-md shadow-sm transition-all text-sm select-none cursor-wait"
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      Preparing PDF...
    </span>
  );
}

export function ClientInvoicePDF({ order, allStatuses, designApprovalStatusIds = [], docsApprovalStatusIds = [] }: ClientInvoicePDFProps) {
  const [shouldDownload, setShouldDownload] = useState(false);

  return (
    <Card className="shadow-none border-0 bg-transparent rounded-none overflow-visible mt-6 print:hidden md:shadow-2xl md:border md:border-border/40 md:bg-card md:rounded-xl md:overflow-hidden">
      <CardHeader className="bg-transparent p-0 border-b-0 flex flex-col sm:flex-row justify-between items-center gap-4 md:bg-muted/30 md:p-6 md:border-b md:border-border/40">
        <div className="hidden md:block">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Official Invoice Document
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            View or download a PDF copy of your invoice for Order #{order.id}
          </CardDescription>
        </div>
        
        <div className="flex gap-2 w-auto justify-end">
          {!shouldDownload ? (
            <span
              onClick={() => setShouldDownload(true)}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-md shadow-sm hover:shadow transition-all text-sm select-none cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Download Invoice
            </span>
          ) : (
            <PDFDownloadLink
              document={
                <ClientInvoiceDocument
                  orders={[order]}
                  allStatuses={allStatuses}
                  designApprovalStatusIds={designApprovalStatusIds}
                  docsApprovalStatusIds={docsApprovalStatusIds}
                />
              }
              fileName={`Invoice_${order.id}.pdf`}
              className="w-auto"
            >
              {({ blob, url, loading }) => (
                <DownloadTrigger
                  url={url}
                  loading={loading}
                  fileName={`Invoice_${order.id}.pdf`}
                  onComplete={() => setShouldDownload(false)}
                />
              )}
            </PDFDownloadLink>
          )}
        </div>
      </CardHeader>
      <CardContent className="hidden md:flex p-0 bg-secondary/10 justify-center items-center h-[600px] sm:h-[750px]">
        <div className="w-full h-full hidden md:block">
          <PDFViewer width="100%" height="100%" className="border-0" showToolbar={false}>
            <ClientInvoiceDocument
              orders={[order]}
              allStatuses={allStatuses}
              designApprovalStatusIds={designApprovalStatusIds}
              docsApprovalStatusIds={docsApprovalStatusIds}
            />
          </PDFViewer>
        </div>
        <div className="md:hidden p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Invoice Ready for Download</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            PDF preview is not supported on mobile browsers. Please tap the button above to download your PDF invoice.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
