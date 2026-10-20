import { NextRequest, NextResponse } from "next/server";
import { extractOrderId, settlePayment } from "@/lib/paystation";

function getOrigin(request: NextRequest): string {
  const proto = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
  return request.headers.get("x-forwarded-host")
    ? `${proto}://${request.headers.get("x-forwarded-host")}`
    : request.nextUrl.origin;
}

function isSuccessStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "success" || s === "successful";
}

async function handle(origin: string, get: (key: string) => string | null) {
  const invoiceNumber = get("invoice_number");
  if (!invoiceNumber) return NextResponse.redirect(`${origin}/orders`);

  const status = get("trx_status") || get("status") || "failed";
  const trxId = get("trx_id");
  const orderId = extractOrderId(invoiceNumber);

  const extra: Record<string, string> = {};
  if (trxId) extra.trx_id = trxId;

  if (isSuccessStatus(status)) {
    const recorded = await settlePayment(invoiceNumber, trxId).catch(() => false);
    if (recorded) {
      return NextResponse.redirect(`${origin}/pay/${orderId}/success?${new URLSearchParams(extra)}`);
    }
    extra.reason = "We could not confirm your payment yet. If money was deducted, it will be added to your invoice automatically.";
  } else {
    const message = get("message");
    if (message) extra.reason = message;
  }
  return NextResponse.redirect(`${origin}/pay/${orderId}/failed?${new URLSearchParams(extra)}`);
}

export async function POST(request: NextRequest) {
  const origin = getOrigin(request);
  try {
    const formData = await request.formData();
    return handle(origin, key => formData.get(key) as string | null);
  } catch {
    return NextResponse.redirect(`${origin}/orders`);
  }
}

export async function GET(request: NextRequest) {
  const origin = getOrigin(request);
  return handle(origin, key => request.nextUrl.searchParams.get(key));
}
