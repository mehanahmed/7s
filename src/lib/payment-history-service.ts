

"use server";
import { format } from 'date-fns';
import type { BillReport, AdvancePaymentRecord } from '@/types';
import { getOrders } from './order-service';
import { getBillReports } from './bill-report-service';
import { CANCELLED_STATUS_ID } from './status-constants';
import { guard } from '@/lib/guard';

// This type alias is for clarity within this service
type PaymentHistoryEntry = BillReport & { orderId?: string };


export async function getAllPaymentHistory(): Promise<PaymentHistoryEntry[]> {
  await guard();
    const allPayments: PaymentHistoryEntry[] = [];

    try {
        const allOrders = await getOrders();

        allOrders.forEach(order => {
            if (order.currentStatus === CANCELLED_STATUS_ID) {
                return;
            }
            const processPayment = (payment: AdvancePaymentRecord) => {
                let displayNotes = payment.notes || null;
                if (displayNotes && displayNotes.toLowerCase().includes('steadfast webhook')) {
                    displayNotes = 'SteadFast';
                }

                allPayments.push({
                    id: payment.id,
                    orderId: order.id, // Add orderId for back-reference
                    vendorId: order.crmUserId,
                    vendorName: order.id,
                    date: payment.date,
                    invoiceId: order.companyName,
                    amount: 0,
                    payment: payment.amount,
                    method: payment.paymentMethod || 'N/A',
                    status: payment.status || 'Pending',
                    notes: displayNotes,
                } as any);
            };

            if (order.advancePayments && order.advancePayments.length > 0) {
                order.advancePayments.forEach(processPayment);
            } else if (order.advancePayment && order.advancePayment > 0) {
                const legacyPaymentId = `${order.id}-legacy`;
                allPayments.push({
                    id: legacyPaymentId,
                    orderId: order.id,
                    vendorId: order.crmUserId,
                    vendorName: order.id,
                    date: order.createdAt,
                    invoiceId: order.companyName,
                    amount: 0,
                    payment: order.advancePayment,
                    method: order.paymentMethod || 'Unknown',
                    status: 'Approved',
                    notes: "Initial advance payment (legacy).",
                } as any);
            }
        });
    } catch (error) {
        console.error("Error transforming order payments into payment history:", error);
    }

    // Now, fetch bill reports from MySQL
    try {
        const billReports = await getBillReports();
        allPayments.push(...billReports);
    } catch (error) {
        console.error("Error fetching bill reports for payment history:", error);
    }

    return allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Deprecated
export async function updatePaymentStatus(paymentId: string, newStatus: 'Approved' | 'Pending'): Promise<boolean> {
  await guard();
    console.warn("DEPRECATION WARNING: updatePaymentStatus in payment-history-service.ts is called. This logic has moved to order-service.ts.");
    return false;
}

// No-op now as bill-report-service handles storage
export async function addPaymentToHistory(reportData: Omit<BillReport, 'id'> & { id: string }) {
  await guard();
    // No operation required with MySQL migration
}

export async function getPaymentHistoryPaginated(
    page: number = 1,
    limit: number = 20,
    searchTerm?: string,
    startDateStr?: string,
    endDateStr?: string,
    sortConfig?: { key: string; direction: 'asc' | 'desc' } | null
): Promise<{ payments: PaymentHistoryEntry[]; total: number; totalAmount: number }> {
  await guard();
    const allPayments = await getAllPaymentHistory();
    let results = [...allPayments];

    if (startDateStr && endDateStr) {
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        results = results.filter(p => {
            try {
                const paymentDate = new Date(p.date);
                return paymentDate >= startDate && paymentDate <= endDate && paymentDate > new Date('2025-11-13');
            } catch (e) {
                return false;
            }
        });
    }

    if (searchTerm && searchTerm.trim()) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        results = results.filter(p =>
            (p.vendorName && p.vendorName.toLowerCase().includes(lowerSearchTerm)) ||
            (p.invoiceId && p.invoiceId.toLowerCase().includes(lowerSearchTerm)) ||
            (p.method && p.method.toLowerCase().includes(lowerSearchTerm)) ||
            (p.notes && p.notes.toLowerCase().includes(lowerSearchTerm)) ||
            (p.status && p.status.toLowerCase().includes(lowerSearchTerm))
        );
    }

    if (sortConfig) {
        results.sort((a, b) => {
            let aVal: any = (a as any)[sortConfig.key];
            let bVal: any = (b as any)[sortConfig.key];
            if (sortConfig.key === 'date') {
                aVal = new Date(a.date).getTime();
                bVal = new Date(b.date).getTime();
            }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    const total = results.length;
    const totalAmount = results.reduce((sum, p) => sum + (Number(p.payment) || 0), 0);
    const startIndex = (page - 1) * limit;
    const payments = results.slice(startIndex, startIndex + limit);

    return { payments, total, totalAmount };
}
