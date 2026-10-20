
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building, MapPin, Phone, UserCheck, FileText, StickyNote, Percent, ReceiptText, CheckCircle, Truck, Info } from "lucide-react";
import JsBarcode from 'jsbarcode';
import type { CustomStatus, TrackingLink, User, AdvancePaymentRecord } from "@/types";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from '@/components/ui/skeleton';
import { getPackzyDeliveryStatusAction } from '../actions';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from '@/contexts/auth-context';
import { PaymentProofCell } from '@/components/common/PaymentProofCell';
import { TornPaperTerms } from '@/components/invoices/TornPaperTerms';

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

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return "Loading date...";
  try {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${day} ${month}, ${year} at ${time}`;
  } catch (e) {
    return "Invalid Date";
  }
};


const DESIGN_W = 794; // A4 at 96dpi: the page is drawn at this width and scaled down on small screens
const BLUE = '#4b5fa5';

const formatShortDate = (dateString: string | undefined) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}, ${d.getFullYear()}`;
  } catch { return ''; }
};

const numberOnly = (n: number) => {
  const v = Number.isFinite(n) ? n : 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};
const tk = (n: number | string | null | undefined) => `TK ${numberOnly(Number(n) || 0)}`;

/** Grey hairline with a short blue segment on the left. */
function Rule() {
  return (
    <div className="relative h-[3px] w-full bg-[#c8c8cc]">
      <span className="absolute left-0 top-0 h-full w-[84px]" style={{ background: BLUE }} />
    </div>
  );
}

function TotalRow({ label, value, blue }: { label: string; value: string; blue?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-6 text-[12px] font-bold" style={{ lineHeight: '33px' }}>
      <span style={blue ? { color: BLUE } : undefined}>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

interface InvoiceDetailsClientProps {
  order: TrackingLink;
  allStatuses: CustomStatus[];
  allUsers: User[];
}

export function InvoiceDetailsClient({ order: initialOrder, allStatuses, allUsers }: InvoiceDetailsClientProps) {
  const { currentUser } = useAuth();
  const isClientViewer = !currentUser || currentUser.role === 'Client';
  const [order, setOrder] = useState(initialOrder);
  const [isClient, setIsClient] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pageHeight, setPageHeight] = useState(1123);

  useEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / DESIGN_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = invoiceRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPageHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [packzyDeliveryStatus, setPackzyDeliveryStatus] = useState<string | null>(null);

  useEffect(() => {
    if (barcodeRef.current && order.id) {
      try {
        JsBarcode(barcodeRef.current, order.id, {
          format: "CODE128",
          displayValue: false,
          width: 1.4,
          height: 30,
          margin: 2,
        });
      } catch (e) {
        console.error("JsBarcode error:", e);
      }
    }
  }, [order.id]);

  useEffect(() => {
    setIsClient(true);
    setOrder(initialOrder);

    const fetchPackzyStatus = async () => {
      if (initialOrder.packzyTrackingCode) {
        const result = await getPackzyDeliveryStatusAction(initialOrder.packzyTrackingCode);
        if ('delivery_status' in result) {
          setPackzyDeliveryStatus(result.delivery_status);
        } else {
          console.warn("Could not fetch Steadfast status for invoice:", result.error);
        }
      }
    };
    fetchPackzyStatus();

  }, [initialOrder]);

  const lastEditedByEntry = order.updatedAt && order.updatedByUserName ? { timestamp: order.updatedAt, changedByUserName: order.updatedByUserName } : null;
  const orderSubtotal = Array.isArray(order.orderItems)
    ? order.orderItems.reduce((acc, item) => acc + (item.isGift ? 0 : (Number(item.lineItemTotalPrice) || 0)), 0)
    : 0;
  const effectiveDiscount = Number(order.specialClientDiscount) || 0;
  const netPayable = orderSubtotal - effectiveDiscount;

  const allAdvancePaymentRecords = useMemo(() => {
    const records: AdvancePaymentRecord[] = [];
    if (order.advancePayments && order.advancePayments.length > 0) {
      records.push(...order.advancePayments.map(r => ({ ...r, amount: Number(r.amount) })));
    } else if (order.advancePayment && Number(order.advancePayment) > 0) {
      records.push({
        id: 'legacy-advance',
        amount: Number(order.advancePayment),
        date: order.createdAt,
        paymentMethod: order.paymentMethod || "Unknown",
        notes: "Initial advance payment (legacy data).",
        recordedByUserId: order.crmUserId,
        recordedByUserName: order.crmUserName,
      });
    }
    return records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [order]);

  const totalAdvancePaid = allAdvancePaymentRecords.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  const shippingCharge = Number(order.shippingCharge) || 0;
  const vatPercent = Number(order.vatPercentage) || 0;
  const vatAmount = Math.round(netPayable * vatPercent) / 100;
  const grandTotal = netPayable + vatAmount + shippingCharge;
  const amountDue = grandTotal - totalAdvancePaid;

  const giftTotal = Array.isArray(order.orderItems)
    ? order.orderItems.reduce((acc, item) => acc + (item.isGift ? (Number(item.lineItemTotalPrice) || 0) : 0), 0)
    : 0;
  const { contactPerson, businessName } = useMemo(() => {
    const parts = (order.companyName || '').split(' • ');
    return parts.length > 1
      ? { contactPerson: parts[0].trim(), businessName: parts.slice(1).join(' • ').trim() }
      : { contactPerson: order.companyName, businessName: '' };
  }, [order.companyName]);

  const isDeliveredByCourier = packzyDeliveryStatus === 'delivered';
  const showPaidBadge = (grandTotal > 0 && amountDue <= 0.01) || isDeliveredByCourier;


  return (
    <>
      <div ref={fitRef} className="mx-auto w-full max-w-[794px] print:max-w-none">
        <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-zinc-300/60 print:!h-auto print:overflow-visible print:rounded-none print:shadow-none" style={{ height: pageHeight * scale }}>
          <div
            ref={invoiceRef}
            className="invoice-page absolute left-0 top-0 flex min-h-[1123px] flex-col bg-white text-[#333] print:!static print:!w-full print:!min-h-0 print:![transform:none]"
            style={{ width: DESIGN_W, transform: `scale(${scale})`, transformOrigin: 'top left', padding: '48px 36px 40px 36px' }}
          >
            {/* header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="m-0 text-[45px] font-extrabold leading-none tracking-[0.5px]" style={{ color: BLUE }}>INVOICE.</h1>
                <p className="m-0 mt-[9px] text-[20px] font-bold leading-[26px]">Date: <span>{isClient ? formatShortDate(order.createdAt) : ''}</span></p>
              </div>
              <div className="flex flex-col items-end">
                <Image src="/logo-trim.png" alt="Seven Solution Logo" width={1200} height={429} priority unoptimized className="h-[46px] w-auto object-contain" />
                <svg ref={barcodeRef} className="mt-[10px] h-[30px] max-w-full object-contain" data-ai-hint="barcode scan" />
              </div>
            </div>

            {/* office / client */}
            <div className="mt-[41px] flex text-[11.5px] font-bold leading-[22px]">
              <div className="w-[180px] shrink-0">
                <p className="m-0">Office Address:</p>
                <p className="m-0 mt-1 max-w-[165px] text-[11px] font-normal leading-[16px] text-[#555]">Mirpur, Section - 12, Road - 02 Block - A, House - 133, 1216</p>
              </div>
              <div>
                <p className="m-0">Client: <span className="font-normal">{contactPerson}{businessName ? ` · ${businessName}` : ''}</span></p>
                <p className="m-0">Phone: <span className="font-normal">{order.phoneNumber}</span></p>
                {order.address && <p className="m-0">Address: <span className="font-normal">{order.address}</span></p>}
              </div>
            </div>

            <div className="mt-[34px]"><Rule /></div>

            {/* items */}
            <div className="ml-[64px] mr-[-8px] mt-[26px]">
              <div className="grid h-[34px] grid-cols-[66px_204px_111px_79px_93px] items-center rounded-full text-[13.5px] font-bold leading-none text-white shadow-md shadow-[#4b5fa5]/30 print:shadow-none" style={{ background: BLUE }}>
                <span className="text-center">No</span>
                <span className="pr-[24px] text-center">Service Description</span>
                <span className="pl-0">Unit Price</span>
                <span>QTA</span>
                <span>Total Price</span>
              </div>
              <div className="mt-[25px]">
                {(order.orderItems || []).map((item, index) => (
                  <div key={item.id || index} className="grid min-h-[43px] grid-cols-[66px_204px_111px_79px_93px] items-start border-b border-zinc-100 py-[3px] text-[13.5px] leading-[17px] last:border-b-0">
                    <span className="text-center">{index + 1}</span>
                    <span className="pr-[24px] text-center">
                      <span className="block">{item.unit ? `${item.unit} • ` : ''}{item.model}{item.variation ? ` — ${item.variation}` : ''}</span>
                      {item.lamination && item.lamination !== 'N/A' && <span className="block text-[9px] leading-[12px]">{item.lamination}</span>}
                      {item.isGift && <span className="block text-[9px] font-bold leading-[12px]" style={{ color: BLUE }}>Gift</span>}
                    </span>
                    <span>{tk(item.unitPrice)}</span>
                    <span>{String(item.quantity).padStart(2, '0')}</span>
                    <span style={item.isGift ? { textDecoration: 'line-through', textDecorationColor: '#ef4444', color: '#6b7280' } : undefined}>{tk(item.lineItemTotalPrice)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-[20px]"><Rule /></div>

            {/* totals */}
            <div className="relative mt-[26px] flex justify-between">
              <div>
                <p className="m-0 text-[17px] font-bold uppercase leading-[22px]" style={{ color: BLUE }}>Total Due:</p>
                <p className="m-0 flex items-baseline gap-2 leading-none" style={{ color: BLUE }}>
                  <span className="text-[48px] font-extrabold tracking-[-2px]">{numberOnly(Math.max(0, amountDue))}</span>
                  <span className="text-[20px] font-bold">BDT</span>
                </p>
              </div>
              <div className="w-[300px] rounded-2xl bg-slate-50 px-5 py-2 print:bg-transparent print:px-0">
                <TotalRow label="Subtotal:" value={tk(orderSubtotal)} blue />
                {giftTotal > 0 && <TotalRow label="Gift Value:" value={tk(giftTotal)} />}
                {effectiveDiscount > 0 && <TotalRow label="Discount:" value={`- ${tk(effectiveDiscount)}`} />}
                <TotalRow label={`VAT ${vatPercent}%:`} value={`+ ${tk(vatAmount)}`} />
                {shippingCharge > 0 && <TotalRow label="Shipping:" value={`+ ${tk(shippingCharge)}`} />}
                {totalAdvancePaid > 0 && <TotalRow label={showPaidBadge ? 'Total Paid:' : 'Advance Paid:'} value={`- ${tk(totalAdvancePaid)}`} />}
              </div>
              {showPaidBadge && (
                <Image
                  src="/paid-stamp.png"
                  alt="Paid Stamp"
                  width={110}
                  height={110}
                  unoptimized
                  className="pointer-events-none absolute left-[260px] top-[-14px] -rotate-[16deg] opacity-80"
                />
              )}
            </div>

            {/* payments history */}
            {allAdvancePaymentRecords.length > 0 && (
              <div className="mt-[30px]">
                <p className="m-0 mb-2 text-[12px] font-bold">Payments History:</p>
                <div className="overflow-hidden rounded-xl border border-zinc-100 bg-slate-50/70 px-3 print:border-0 print:bg-transparent print:px-0"><table className="w-full text-left text-[10.5px]">
                  <thead>
                    <tr className="border-b border-[#c8c8cc] text-[#666]">
                      <th className="py-1.5 pr-3 font-bold">Date</th>
                      <th className="py-1.5 pr-3 font-bold">Amount</th>
                      <th className="py-1.5 pr-3 font-bold">Method</th>
                      <th className="py-1.5 pr-3 font-bold">Notes</th>
                      <th className="py-1.5 font-bold">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allAdvancePaymentRecords.map((record) => (
                      <tr key={record.id} className="border-b border-[#ececf0]">
                        <td className="whitespace-nowrap py-1.5 pr-3 text-[#666]">{isClient ? formatDate(record.date) : ''}</td>
                        <td className="py-1.5 pr-3 font-bold" style={{ color: BLUE }}>{formatCurrency(record.amount)}</td>
                        <td className="py-1.5 pr-3"><PaymentProofCell method={record.paymentMethod} proofUrl={record.documentUrl} amountLabel={formatCurrency(record.amount)} /></td>
                        <td className="py-1.5 pr-3 text-[#666]">{record.notes || 'N/A'}</td>
                        <td className="py-1.5 text-[#666]">{record.recordedByUserName || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            )}

            {order.orderNotes && (
              <div className="mt-[24px] rounded-xl border-l-4 bg-slate-50 px-4 py-3 print:bg-transparent" style={{ borderColor: BLUE }}>
                <p className="m-0 text-[12px] font-bold">Notes:</p>
                <p className="m-0 mt-1 whitespace-pre-wrap text-[11px] leading-[16px] text-[#555]">{order.orderNotes}</p>
              </div>
            )}

            {/* terms */}
            <div className="mt-[34px]">
              <p className="m-0 text-[13px] font-bold">Terms &amp; Conditions:</p>
              <ul className="m-0 mt-2 max-w-[470px] list-disc space-y-[3px] pl-4 text-[9.5px] leading-[14px] text-[#555]">
                <li><b>Advance Payment:</b> Minimum 50% advance required with official work order.</li>
                <li><b>Delivery Timeline:</b> Maximum delivery time is 1 month from confirmation.</li>
                <li><b>Excluded Charges:</b> Tax, VAT &amp; delivery charges are excluded.</li>
                <li><b>Refund Policy:</b> Advance payment is strictly non-refundable.</li>
              </ul>
            </div>

            {/* footer */}
            <div className="mt-auto flex items-end justify-between pt-[40px]">
              <div className="border-l-4 pl-[11px] leading-[19px]" style={{ borderColor: BLUE }}>
                <p className="m-0 text-[12.5px] font-bold">Questions?</p>
                <p className="m-0 text-[11.5px]">Email us at: savensolution@gmail.com</p>
                <p className="m-0 text-[11.5px]">or call us at: +880 14100-28884</p>
              </div>
              <p className="m-0 pr-[20px] text-[11px] tracking-[0.4px] text-[#6b6b6b]">Account Manager: {order.crmUserName || ''}</p>
            </div>
          </div>
        </div>
      </div>

      {isClientViewer && (
        <div className="max-w-4xl mx-auto mt-6 print:hidden">
          <Card className="border border-border/40 bg-card/60 backdrop-blur-md rounded-xl shadow-xl p-5 sm:p-6 hover:shadow-2xl transition-all duration-300">
            <CardHeader className="p-0 pb-3 mb-3 border-b border-border/30 flex flex-row items-center gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/20">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">Terms & Conditions</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Important guidelines for our clients</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0 space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <div className="flex gap-2.5 items-start">
                <span className="font-semibold text-primary/80 mt-0.5">•</span>
                <p>
                  <strong>Advance Payment:</strong> A minimum of 50% advance payment is required to process and lock the order. The remaining balance must be paid before or upon delivery.
                </p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="font-semibold text-primary/80 mt-0.5">•</span>
                <p>
                  <strong>Design & Changes:</strong> Once the design is approved by the client, it will proceed directly to the production queue. No alterations can be made post-approval.
                </p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="font-semibold text-primary/80 mt-0.5">•</span>
                <p>
                  <strong>Delivery & Timelines:</strong> While we strive to meet all estimated delivery dates, shipping delays caused by couriers, weather, or unexpected circumstances are beyond our control.
                </p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="font-semibold text-primary/80 mt-0.5">•</span>
                <p>
                  <strong>Cancellations:</strong> Custom order requests cannot be cancelled or refunded once production has begun.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
