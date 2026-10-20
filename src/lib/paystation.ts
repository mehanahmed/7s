import { v4 as uuidv4 } from "uuid";
import { getGlobalSettings } from "./settings-service";
import { getOrderById, updateOrder } from "./order-service";
import { sendTelegramMessage } from "./notification-utils";
import { getAppUrl } from "./server-utils";
import type { AdvancePaymentRecord } from "@/types";

interface VerifiedTransaction {
  invoiceNumber: string;
  trxId: string;
  amount: number;
  method: string | null;
}

export function extractOrderId(invoiceNumber: string): string {
  return invoiceNumber.replace(/-P\d+$/, "");
}

async function post(baseUrl: string, path: string, merchantId: string, body: string, contentType: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": contentType, merchantId },
    body,
    cache: "no-store",
  });
  return res.json().catch(() => ({}));
}

function parse(json: any): VerifiedTransaction | null {
  const data = json?.data;
  if (String(json?.status_code) !== "200" || !data) return null;
  const status = String(data.trx_status || "").toLowerCase();
  if (status !== "success" && status !== "successful") return null;
  const amount = Number(data.request_amount || data.payment_amount || data.trx_amount) || 0;
  if (!data.trx_id || amount <= 0) return null;
  return {
    invoiceNumber: String(data.invoice_number || ""),
    trxId: String(data.trx_id),
    amount,
    method: data.payment_method ? String(data.payment_method) : null,
  };
}

export async function verifyPayment(invoiceNumber: string, trxId?: string | null): Promise<VerifiedTransaction | null> {
  const settings = await getGlobalSettings();
  const merchantId = settings.paymentGatewayMerchantId;
  if (!merchantId) return null;

  const baseUrl = settings.paymentGatewayEnvironment === "production"
    ? "https://api.paystation.com.bd"
    : "https://sandbox.paystation.com.bd";

  try {
    const v1 = parse(await post(baseUrl, "/transaction-status", merchantId,
      new URLSearchParams({ invoice_number: invoiceNumber }).toString(), "application/x-www-form-urlencoded"));
    if (v1) return v1;

    if (trxId) {
      const v2 = parse(await post(baseUrl, "/v2/transaction-status", merchantId,
        JSON.stringify({ trxId }), "application/json"));
      if (v2 && extractOrderId(v2.invoiceNumber) === extractOrderId(invoiceNumber)) return v2;
    }
  } catch (error) {
    console.error("[PayStation] verify error:", error);
  }
  return null;
}

// ponytail: in-process per-order lock, stops callback+IPN double-insert on one server; needs DB lock if app runs multi-instance
const locks = new Map<string, Promise<unknown>>();

export async function settlePayment(invoiceNumber: string, trxId?: string | null): Promise<boolean> {
  const orderId = extractOrderId(invoiceNumber);
  const prev = locks.get(orderId) ?? Promise.resolve();
  const run = prev.then(() => settle(invoiceNumber, orderId, trxId));
  locks.set(orderId, run.catch(() => {}));
  return run;
}

async function settle(invoiceNumber: string, orderId: string, trxId?: string | null): Promise<boolean> {
  const verified = await verifyPayment(invoiceNumber, trxId);
  if (!verified) {
    console.warn(`[PayStation] not verified: invoice=${invoiceNumber} trx_id=${trxId ?? "-"} — payment NOT recorded`);
    return false;
  }

  const order = await getOrderById(orderId);
  if (!order) return false;

  if ((order.advancePayments || []).some(p => p.notes === verified.trxId)) return true;

  const payment: AdvancePaymentRecord = {
    id: uuidv4(),
    amount: verified.amount,
    date: new Date().toISOString(),
    paymentMethod: verified.method || "PayStation",
    notes: verified.trxId,
    recordedByUserId: "system",
    recordedByUserName: "PayStation",
    status: "Approved",
  };

  const ok = await updateOrder(orderId, { advancePayments: [...(order.advancePayments || []), payment] });
  console.log(`[PayStation] recorded ${verified.amount} BDT for ${orderId}, trx_id=${verified.trxId}, ok=${ok}`);
  if (ok) void notifyTelegram(orderId, order.companyName, payment, (order.advancePayments || []).length > 0);
  return ok;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function notifyTelegram(orderId: string, companyName: string, payment: AdvancePaymentRecord, isAdjustment: boolean) {
  const amount = new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" }).format(payment.amount);
  const title = isAdjustment ? "Adjustment Payment Received!" : "Advance Payment Received!";
  const message = `
<b>🎉 ${title}</b>

<b>Order ID:</b> <code>${orderId}</code>
<b>Company:</b> ${escapeHtml(companyName || "N/A")}
<b>Amount:</b> ${amount}
<b>Method:</b> ${escapeHtml(payment.paymentMethod || "PayStation")} (Online)
<b>Reference:</b> <code>${escapeHtml(payment.notes || "N/A")}</code>
<b>Recorded By:</b> PayStation
  `;
  const appUrl = await getAppUrl();
  await sendTelegramMessage(message, {
    inline_keyboard: [[
      { text: "📄 View Order", url: `${appUrl}/track/${orderId}` },
      { text: "💰 Payment History", url: `${appUrl}/admin/payment-history` },
    ]],
  }).catch(err => console.error("[PayStation] telegram error:", err));
}
