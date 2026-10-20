import { NextRequest, NextResponse } from "next/server";
import { settlePayment } from "@/lib/paystation";

async function readBody(request: NextRequest): Promise<Record<string, any>> {
  const raw = await request.text();
  try {
    return JSON.parse(raw);
  } catch {
    return Object.fromEntries(new URLSearchParams(raw));
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await readBody(request);
    const invoiceNumber = data.invoice_number;
    if (!invoiceNumber) {
      return NextResponse.json({ status: "error" }, { status: 400 });
    }

    const recorded = await settlePayment(String(invoiceNumber), data.trx_id || data.trxId || null);
    return NextResponse.json({ status: recorded ? "success" : "error" }, { status: recorded ? 200 : 422 });
  } catch (error) {
    console.error("IPN handler error:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
