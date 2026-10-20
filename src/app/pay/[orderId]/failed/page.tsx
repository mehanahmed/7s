import { getOrderById } from "@/lib/order-service";
import { notFound } from "next/navigation";
import { FailedClient } from "./FailedClient";

export default async function PaymentFailedPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ reason?: string }> }) {
  const { orderId } = await params;
  const query = await searchParams;
  const order = await getOrderById(orderId);

  if (!order) return notFound();

  return (
    <FailedClient
      orderId={order.id}
      companyName={order.companyName}
      reason={query.reason || null}
    />
  );
}
