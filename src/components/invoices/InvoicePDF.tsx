import React from 'react';
import { Document } from '@react-pdf/renderer';
import type { TrackingLink } from '@/types';
import { InvoicePdfPage } from './InvoicePdfPage';

interface InvoicePDFProps {
  orders: TrackingLink[];
}

export const InvoicePDF = ({ orders }: InvoicePDFProps) => {
  return (
    <Document>
      {orders.map((order) => (
        <InvoicePdfPage key={order.id} order={order} />
      ))}
    </Document>
  );
};
