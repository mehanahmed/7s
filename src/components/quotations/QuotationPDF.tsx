
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import type { TrackingLink } from '@/types';
import { format, parseISO } from 'date-fns';

/**
 * A4 quotation, drawn to match the on-screen Quotation page (794px design width -> 595pt, i.e. px * 0.75).
 */

Font.register({
  family: 'Hind Siliguri',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/hindsiliguri/HindSiliguri-Regular.ttf' },
    { src: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/hindsiliguri/HindSiliguri-Bold.ttf', fontWeight: 'bold' },
  ],
});

const BLUE = '#4b5fa5';
const TEXT = '#333333';
const MUTED = '#555555';
const HAIR = '#c8c8cc';

// table column widths (px 66/204/111/79/93 -> pt)
const COL = { no: 49.5, service: 153, unit: 83.25, qty: 59.25, total: 69.75 };

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingHorizontal: 27,
    paddingBottom: 24,
    fontFamily: 'Hind Siliguri',
    fontSize: 10,
    color: TEXT,
    backgroundColor: '#FFFFFF',
    flexDirection: 'column',
  },
  // header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 34, fontWeight: 'bold', color: BLUE, letterSpacing: 0.4, lineHeight: 1 },
  date: { fontSize: 15, fontWeight: 'bold', marginTop: 7 },
  logoWrap: { alignItems: 'flex-end' },
  logo: { height: 34.5, objectFit: 'contain' },
  barcode: { width: 90, height: 22, marginTop: 7 },
  // office / client
  infoRow: { flexDirection: 'row', marginTop: 24 },
  officeCol: { width: 135 },
  label: { fontSize: 8.6, fontWeight: 'bold', lineHeight: 1.9 },
  address: { fontSize: 8.2, color: MUTED, lineHeight: 1.45, width: 124, marginTop: 2 },
  value: { fontWeight: 'normal' },
  // rule
  rule: { height: 2.25, backgroundColor: HAIR, marginTop: 25, position: 'relative' },
  ruleBlue: { position: 'absolute', left: 0, top: 0, height: 2.25, width: 63, backgroundColor: BLUE },
  // table
  table: { marginLeft: 48, marginTop: 19.5 },
  pill: { height: 25.5, borderRadius: 13, backgroundColor: BLUE, flexDirection: 'row', alignItems: 'center' },
  th: { color: '#FFFFFF', fontSize: 10.1, fontWeight: 'bold' },
  rows: { marginTop: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 32, paddingVertical: 2.25, borderBottomWidth: 0.75, borderBottomColor: '#f1f1f4', borderBottomStyle: 'solid' },
  cell: { fontSize: 10.1, lineHeight: 1.25 },
  sub: { fontSize: 6.75, lineHeight: 1.3, textAlign: 'center' },
  center: { textAlign: 'center' },
  // totals
  totals: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 19.5, position: 'relative' },
  dueLabel: { fontSize: 12.75, fontWeight: 'bold', color: BLUE, textTransform: 'uppercase' },
  dueRow: { flexDirection: 'row', alignItems: 'flex-end', color: BLUE },
  dueNumber: { fontSize: 36, fontWeight: 'bold', color: BLUE, letterSpacing: -1.5, lineHeight: 1 },
  dueCurrency: { fontSize: 15, fontWeight: 'bold', color: BLUE, marginLeft: 6, marginBottom: 3 },
  totalsBox: { width: 225, borderRadius: 12, backgroundColor: '#f8fafc', paddingHorizontal: 15, paddingVertical: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 24.75 },
  totalLabel: { fontSize: 9, fontWeight: 'bold' },
  totalValue: { fontSize: 9 },
  stamp: { position: 'absolute', left: 195, top: -10, width: 82, height: 82, opacity: 0.8, transform: 'rotate(-16deg)' },
  // sections
  sectionTitle: { fontSize: 9, fontWeight: 'bold', marginBottom: 6 },
  payBox: { borderRadius: 9, backgroundColor: '#f8fafc', paddingHorizontal: 9 },
  payHead: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.75, borderBottomColor: HAIR, borderBottomStyle: 'solid' },
  payRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.75, borderBottomColor: '#ececf0', borderBottomStyle: 'solid' },
  payTh: { fontSize: 7.9, fontWeight: 'bold', color: '#666666' },
  payTd: { fontSize: 7.9, color: '#666666' },
  notes: { marginTop: 18, borderLeftWidth: 3, borderLeftColor: BLUE, borderLeftStyle: 'solid', backgroundColor: '#f8fafc', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  notesText: { fontSize: 8.2, color: MUTED, lineHeight: 1.45, marginTop: 3 },
  // payment details
  bankRow: { flexDirection: 'row', marginTop: 9 },
  bankCol: { flex: 1, fontSize: 7.9 },
  bankName: { fontSize: 8.6, fontWeight: 'bold', color: BLUE, marginBottom: 3 },
  bankLine: { fontSize: 7.9, lineHeight: 1.6, color: '#444444' },
  bankBold: { fontWeight: 'bold', color: '#222222' },
  // terms
  term: { fontSize: 7.1, lineHeight: 1.5, color: MUTED, marginBottom: 2 },
  // footer
  spacer: { flexGrow: 1, minHeight: 10 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  footerBar: { borderLeftWidth: 3, borderLeftColor: BLUE, borderLeftStyle: 'solid', paddingLeft: 8 },
  footerTitle: { fontSize: 9.4, fontWeight: 'bold', lineHeight: 1.9 },
  footerLine: { fontSize: 8.6, lineHeight: 1.9 },
  manager: { fontSize: 8.25, color: '#6b6b6b', letterSpacing: 0.3, paddingRight: 15 },
});

const numberOnly = (n: number) => {
  const v = Number.isFinite(n) ? n : 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};
const tk = (n: number | string | null | undefined) => `TK ${numberOnly(Number(n) || 0)}`;
const bdt = (n: number) => `BDT ${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const shortDate = (s?: string) => {
  try { return s ? format(parseISO(s), 'd MMM, yyyy') : ''; } catch { return ''; }
};
const longDate = (s?: string) => {
  try { return s ? format(parseISO(s), 'd MMM, yyyy hh:mm a') : ''; } catch { return s || ''; }
};

const Rule = () => (
  <View style={styles.rule}>
    <View style={styles.ruleBlue} />
  </View>
);

const TotalRow = ({ label, value, blue }: { label: string; value: string; blue?: boolean }) => (
  <View style={styles.totalRow}>
    <Text style={[styles.totalLabel, blue ? { color: BLUE } : {}]}>{label}</Text>
    <Text style={styles.totalValue}>{value}</Text>
  </View>
);

interface QuotationPDFProps {
  quotation: TrackingLink;
  /** admin VAT %, used when the quotation has no stored rate */
  defaultVatPercent?: number;
}

export const QuotationPDF = ({ quotation, defaultVatPercent = 0 }: QuotationPDFProps) => {
  const items = quotation.orderItems || [];
  const subtotal = items.reduce((acc, item) => acc + (item.isGift ? 0 : (Number(item.lineItemTotalPrice) || 0)), 0);
  const giftTotal = items.reduce((acc, item) => acc + (item.isGift ? (Number(item.lineItemTotalPrice) || 0) : 0), 0);
  const discount = Number(quotation.specialClientDiscount) || 0;
  const shipping = Number(quotation.shippingCharge) || 0;
  const netPayable = subtotal - discount;
  const vatPercent = quotation.vatPercentage != null ? Number(quotation.vatPercentage) || 0 : defaultVatPercent;
  const vatAmount = Math.round(netPayable * vatPercent) / 100;
  const total = netPayable + vatAmount + shipping;

  const payments = [...(quotation.advancePayments || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const totalPaid = payments.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const amountDue = total - totalPaid;
  const showPaid = total > 0 && amountDue <= 0.01;
  const showApproved = quotation.currentStatus === 'Approved';

  const parts = (quotation.companyName || '').split(' • ');
  const contactPerson = parts[0].trim();
  const businessName = parts.length > 1 ? parts.slice(1).join(' • ').trim() : '';

  const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(quotation.id)}&scale=2&rotate=N&includetext=false`;

  return (
    <Document title={`Quotation ${quotation.id}`}>
      <Page size="A4" style={styles.page}>
        {/* header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>QUOTATION.</Text>
            <Text style={styles.date}>Date: {shortDate(quotation.createdAt)}</Text>
          </View>
          <View style={styles.logoWrap}>
            <Image src="/logo-trim.png" style={styles.logo} />
            <Image src={barcodeUrl} style={styles.barcode} />
          </View>
        </View>

        {/* office / client */}
        <View style={styles.infoRow}>
          <View style={styles.officeCol}>
            <Text style={styles.label}>Office Address:</Text>
            <Text style={styles.address}>Mirpur, Section - 12, Road - 02 Block - A, House - 133, 1216</Text>
          </View>
          <View>
            <Text style={styles.label}>Client: <Text style={styles.value}>{contactPerson}{businessName ? ` · ${businessName}` : ''}</Text></Text>
            <Text style={styles.label}>Phone: <Text style={styles.value}>{quotation.phoneNumber}</Text></Text>
            {!!quotation.address && <Text style={styles.label}>Address: <Text style={styles.value}>{quotation.address}</Text></Text>}
          </View>
        </View>

        <Rule />

        {/* items */}
        <View style={styles.table}>
          <View style={styles.pill}>
            <Text style={[styles.th, styles.center, { width: COL.no }]}>No</Text>
            <Text style={[styles.th, styles.center, { width: COL.service, paddingRight: 18 }]}>Service Description</Text>
            <Text style={[styles.th, { width: COL.unit }]}>Unit Price</Text>
            <Text style={[styles.th, { width: COL.qty }]}>QTA</Text>
            <Text style={[styles.th, { width: COL.total }]}>Total Price</Text>
          </View>
          <View style={styles.rows}>
            {items.map((item, index) => (
              <View key={item.id || index} style={styles.row} wrap={false}>
                <Text style={[styles.cell, styles.center, { width: COL.no }]}>{index + 1}</Text>
                <View style={{ width: COL.service, paddingRight: 18 }}>
                  <Text style={[styles.cell, styles.center]}>{item.unit ? `${item.unit} • ` : ''}{item.model}{item.variation ? ` — ${item.variation}` : ''}</Text>
                  {!!item.lamination && item.lamination !== 'N/A' && <Text style={styles.sub}>{item.lamination}</Text>}
                  {item.isGift && <Text style={[styles.sub, { color: BLUE, fontWeight: 'bold' }]}>Gift</Text>}
                </View>
                <Text style={[styles.cell, { width: COL.unit }]}>{tk(item.unitPrice)}</Text>
                <Text style={[styles.cell, { width: COL.qty }]}>{String(item.quantity).padStart(2, '0')}</Text>
                <Text style={[styles.cell, { width: COL.total }, item.isGift ? { textDecoration: 'line-through', color: '#6b7280' } : {}]}>{tk(item.lineItemTotalPrice)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ marginTop: -15 }}><Rule /></View>

        {/* totals */}
        <View style={styles.totals} wrap={false}>
          <View>
            <Text style={styles.dueLabel}>Total Due:</Text>
            <View style={styles.dueRow}>
              <Text style={styles.dueNumber}>{numberOnly(Math.max(0, amountDue))}</Text>
              <Text style={styles.dueCurrency}>BDT</Text>
            </View>
          </View>
          <View style={styles.totalsBox}>
            <TotalRow label="Subtotal:" value={tk(subtotal)} blue />
            {giftTotal > 0 && <TotalRow label="Gift Value:" value={tk(giftTotal)} />}
            {discount > 0 && <TotalRow label="Discount:" value={`- ${tk(discount)}`} />}
            <TotalRow label={`VAT ${vatPercent}%:`} value={`+ ${tk(vatAmount)}`} />
            {shipping > 0 && <TotalRow label="Shipping:" value={`+ ${tk(shipping)}`} />}
            {totalPaid > 0 && <TotalRow label={showPaid ? 'Total Paid:' : 'Advance Paid:'} value={`- ${tk(totalPaid)}`} />}
          </View>
          {(showApproved || showPaid) && <Image src={showApproved ? '/approved-stamp.png' : '/paid-stamp.png'} style={styles.stamp} />}
        </View>

        {/* payments history */}
        {payments.length > 0 && (
          <View style={{ marginTop: 12 }} wrap={false}>
            <Text style={styles.sectionTitle}>Payments History:</Text>
            <View style={styles.payBox}>
              <View style={styles.payHead}>
                <Text style={[styles.payTh, { width: '25%' }]}>Date</Text>
                <Text style={[styles.payTh, { width: '17%' }]}>Amount</Text>
                <Text style={[styles.payTh, { width: '16%' }]}>Method</Text>
                <Text style={[styles.payTh, { width: '26%' }]}>Notes</Text>
                <Text style={[styles.payTh, { width: '16%' }]}>Recorded By</Text>
              </View>
              {payments.map((r) => (
                <View key={r.id} style={styles.payRow}>
                  <Text style={[styles.payTd, { width: '25%' }]}>{longDate(r.date)}</Text>
                  <Text style={[styles.payTd, { width: '17%', color: BLUE, fontWeight: 'bold' }]}>{bdt(Number(r.amount))}</Text>
                  <Text style={[styles.payTd, { width: '16%', color: TEXT }]}>{r.paymentMethod || 'N/A'}</Text>
                  <Text style={[styles.payTd, { width: '26%' }]}>{r.notes || 'N/A'}</Text>
                  <Text style={[styles.payTd, { width: '16%' }]}>{r.recordedByUserName || 'N/A'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* notes */}
        {!!quotation.orderNotes && (
          <View style={styles.notes} wrap={false}>
            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>Notes:</Text>
            <Text style={styles.notesText}>{quotation.orderNotes}</Text>
          </View>
        )}

        {/* payment details */}
        <View style={{ marginTop: 16 }} wrap={false}>
          <Text style={{ fontSize: 9.75, fontWeight: 'bold' }}>Payment Details:</Text>
          <View style={styles.bankRow}>
            <View style={[styles.bankCol, { paddingRight: 12 }]}>
              <Text style={styles.bankName}>Brack Bank</Text>
              <Text style={styles.bankLine}>Branch - Begum Rokeya Sharani</Text>
              <Text style={styles.bankLine}>Account Name - Saven Solution</Text>
              <Text style={styles.bankLine}>Account Number - <Text style={styles.bankBold}>2080068460001</Text></Text>
            </View>
            <View style={[styles.bankCol, { paddingHorizontal: 12, borderLeftWidth: 0.75, borderLeftColor: '#e3e3e8', borderLeftStyle: 'solid' }]}>
              <Text style={styles.bankName}>City Bank</Text>
              <Text style={styles.bankLine}>Branch - Rokeya Sarani Branch</Text>
              <Text style={styles.bankLine}>Account Name - Saven Solution</Text>
              <Text style={styles.bankLine}>Account Number - <Text style={styles.bankBold}>1504609340001</Text></Text>
            </View>
            <View style={[styles.bankCol, { paddingLeft: 12, borderLeftWidth: 0.75, borderLeftColor: '#e3e3e8', borderLeftStyle: 'solid' }]}>
              <Text style={styles.bankName}>Bkash / Nagad</Text>
              <Text style={[styles.bankLine, styles.bankBold]}>01888388604</Text>
              <Text style={styles.bankLine}>(Send Money)</Text>
              <Text style={[styles.bankLine, { color: '#777777' }]}>Please add cashout charge also</Text>
            </View>
          </View>
        </View>

        {/* terms */}
        <View style={{ marginTop: 16 }} wrap={false}>
          <Text style={{ fontSize: 9.75, fontWeight: 'bold', marginBottom: 6 }}>Terms & Conditions:</Text>
          <Text style={styles.term}>•  <Text style={{ fontWeight: 'bold' }}>Advance Payment:</Text> Minimum 50% advance required with official work order.</Text>
          <Text style={styles.term}>•  <Text style={{ fontWeight: 'bold' }}>Delivery Timeline:</Text> Maximum delivery time is 1 month from confirmation.</Text>
          <Text style={styles.term}>•  <Text style={{ fontWeight: 'bold' }}>Excluded Charges:</Text> Tax, VAT & delivery charges are excluded.</Text>
          <Text style={styles.term}>•  <Text style={{ fontWeight: 'bold' }}>Refund Policy:</Text> Advance payment is strictly non-refundable.</Text>
        </View>

        <View style={styles.spacer} />

        {/* footer */}
        <View style={styles.footer} wrap={false}>
          <View style={styles.footerBar}>
            <Text style={styles.footerTitle}>Questions?</Text>
            <Text style={styles.footerLine}>Email us at: savensolution@gmail.com</Text>
            <Text style={styles.footerLine}>or call us at: +880 14100-28884</Text>
          </View>
          <Text style={styles.manager}>Account Manager: {quotation.crmUserName || ''}</Text>
        </View>
      </Page>
    </Document>
  );
};
