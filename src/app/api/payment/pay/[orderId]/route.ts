import { NextRequest, NextResponse } from "next/server";
import { vatAmountFor } from '@/lib/vat';
import { getOrderById } from "@/lib/order-service";
import { getGlobalSettings } from "@/lib/settings-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const [order, settings] = await Promise.all([
      getOrderById(orderId),
      getGlobalSettings(),
    ]);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!settings.paymentGatewayEnabled) {
      return NextResponse.json({ error: "Payment gateway is not enabled" }, { status: 503 });
    }

    if (!settings.paymentGatewayMerchantId || !settings.paymentGatewayPassword) {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
    }

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

    if (amountDue <= 0) {
      return NextResponse.json({ error: "No amount due for this order" }, { status: 400 });
    }

    const customAmount = Number(request.nextUrl.searchParams.get("amount")) || 0;
    const paymentAmount = (customAmount >= 1 && customAmount <= amountDue)
      ? Math.ceil(customAmount)
      : Math.ceil(amountDue);

    const invoiceSuffix = `-P${Date.now()}`;

    const baseUrl = settings.paymentGatewayEnvironment === "production"
      ? "https://api.paystation.com.bd"
      : "https://sandbox.paystation.com.bd";

    const proto = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
    const origin = request.headers.get("x-forwarded-host")
      ? `${proto}://${request.headers.get("x-forwarded-host")}`
      : request.nextUrl.origin;

    const callbackUrl = settings.paymentGatewayCallbackUrl || `${origin}/api/payment/callback`;
    const ipnUrl = settings.paymentGatewayIpnUrl || `${origin}/api/payment/ipn`;

    const body = new URLSearchParams({
      merchantId: settings.paymentGatewayMerchantId,
      password: settings.paymentGatewayPassword,
      invoice_number: `${orderId}${invoiceSuffix}`,
      currency: "BDT",
      payment_amount: String(paymentAmount),
      pay_with_charge: settings.paymentGatewayPayWithCharge ? "1" : "0",
      cust_name: order.companyName || "Customer",
      cust_phone: order.phoneNumber || "",
      cust_email: "",
      callback_url: callbackUrl,
      ipn_url: ipnUrl,
      reference: orderId,
      ...(settings.paymentGatewayEmi ? { emi: "1" } : {}),
    });

    const response = await fetch(`${baseUrl}/initiate-payment`, {
      method: "POST",
      headers: { Accept: "application/json" },
      body,
    });

    const data = await response.json();

    if (data.status_code === "200" && data.payment_url) {
      return NextResponse.redirect(data.payment_url);
    }

    return NextResponse.json(
      { error: data.message || "Failed to initiate payment", details: data },
      { status: 400 }
    );
  } catch (error) {
    console.error("Payment initiation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
