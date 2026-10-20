import { getOrderById } from "@/lib/order-service";
import { notFound } from "next/navigation";
import { SuccessClient } from "./SuccessClient";

export default async function PaymentSuccessPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ trx_id?: string; amount?: string }> }) {
  const { orderId } = await params;
  const query = await searchParams;
  const order = await getOrderById(orderId);

  if (!order) return notFound();

  return (
    <SuccessClient
      orderId={order.id}
      companyName={order.companyName}
      trxId={query.trx_id || null}
      amount={query.amount || null}
    />
  );
}
