import { getOrderById } from "@/lib/order-service";
import { vatAmountFor } from '@/lib/vat';
import { getGlobalSettings } from "@/lib/settings-service";
import { notFound } from "next/navigation";
import { PaymentClient } from "./PaymentClient";

export default async function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const [order, settings] = await Promise.all([
    getOrderById(orderId),
    getGlobalSettings(),
  ]);

  if (!order) return notFound();

  const orderSubtotal = Array.isArray(order.orderItems)
    ? order.orderItems.reduce((acc, item) => acc + (item.isGift ? 0 : (Number(item.lineItemTotalPrice) || 0)), 0)
    : 0;
  const effectiveDiscount = Number(order.specialClientDiscount) || 0;
  const netPayable = orderSubtotal - effectiveDiscount;
  const shippingCharge = Number(order.shippingCharge) || 0;
  const grandTotal = netPayable + vatAmountFor(netPayable, order.vatPercentage) + shippingCharge;
  const totalAdvancePaid = Array.isArray(order.advancePayments)
    ? order.advancePayments.reduce((sum, record) => sum + (Number(record.amount) || 0), 0)
    : 0;
  const amountDue = Math.max(0, grandTotal - totalAdvancePaid);

  const gatewayEnabled = settings.paymentGatewayEnabled ?? false;

  return (
    <PaymentClient
      orderId={order.id}
      companyName={order.companyName}
      grandTotal={grandTotal}
      totalPaid={totalAdvancePaid}
      amountDue={amountDue}
      gatewayEnabled={gatewayEnabled}
    />
  );
}
