"use client";

import { useState } from "react";
import { CreditCard, ShieldCheck, Banknote } from "lucide-react";

function formatBDT(value: number) {
  return `৳${value.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

interface Props {
  orderId: string;
  companyName: string;
  grandTotal: number;
  totalPaid: number;
  amountDue: number;
  gatewayEnabled: boolean;
}

export function PaymentClient({ orderId, companyName, grandTotal, totalPaid, amountDue, gatewayEnabled }: Props) {
  const [payAmount, setPayAmount] = useState(String(Math.ceil(amountDue)));
  const [isRedirecting, setIsRedirecting] = useState(false);

  const numericAmount = Number(payAmount) || 0;
  const isValid = numericAmount >= 1 && numericAmount <= amountDue;

  const handlePay = () => {
    if (!isValid || isRedirecting) return;
    setIsRedirecting(true);
    window.location.href = `/api/payment/pay/${orderId}?amount=${Math.ceil(numericAmount)}`;
  };

  if (amountDue <= 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-neutral-950 dark:to-neutral-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-border/50 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Fully Paid</h1>
          <p className="text-muted-foreground">Order <span className="font-mono font-semibold text-foreground">{orderId}</span> has no outstanding balance.</p>
        </div>
      </div>
    );
  }

  if (!gatewayEnabled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 dark:from-neutral-950 dark:to-neutral-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-border/50 p-8 text-center">
          <CreditCard className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Online Payment Unavailable</h1>
          <p className="text-muted-foreground text-sm">Please contact Seven Solution for payment instructions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <CreditCard className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Make Payment</h1>
          <p className="text-muted-foreground text-sm mt-1">Order <span className="font-mono font-semibold text-foreground">{orderId}</span></p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-border/50 overflow-hidden">
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Customer</span>
              <span className="font-semibold text-foreground">{companyName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Grand Total</span>
              <span className="font-medium text-foreground">{formatBDT(grandTotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Paid</span>
              <span className="font-medium text-green-600 dark:text-green-400">{formatBDT(totalPaid)}</span>
            </div>
            <div className="border-t border-dashed border-border pt-3 flex justify-between items-center">
              <span className="text-sm font-semibold text-foreground">Amount Due</span>
              <span className="text-lg font-bold text-primary">{formatBDT(amountDue)}</span>
            </div>
          </div>

          <div className="border-t border-border bg-muted/30 p-6 space-y-4">
            <div>
              <label htmlFor="pay-amount" className="block text-sm font-medium text-foreground mb-1.5">
                Pay Amount (BDT)
              </label>
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  id="pay-amount"
                  type="number"
                  min={1}
                  max={Math.ceil(amountDue)}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-lg font-semibold rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              {numericAmount > amountDue && (
                <p className="text-xs text-destructive mt-1">Cannot exceed due amount ({formatBDT(amountDue)})</p>
              )}
              {numericAmount < 1 && payAmount !== "" && (
                <p className="text-xs text-destructive mt-1">Minimum payment is ৳1</p>
              )}
            </div>

            <div className="flex gap-2">
              {amountDue > 100 && (
                <button
                  type="button"
                  onClick={() => setPayAmount(String(Math.ceil(amountDue / 2)))}
                  className="flex-1 py-2 px-3 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors text-foreground"
                >
                  Half ({formatBDT(Math.ceil(amountDue / 2))})
                </button>
              )}
              <button
                type="button"
                onClick={() => setPayAmount(String(Math.ceil(amountDue)))}
                className="flex-1 py-2 px-3 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors text-foreground"
              >
                Full ({formatBDT(Math.ceil(amountDue))})
              </button>
            </div>

            <button
              onClick={handlePay}
              disabled={!isValid || isRedirecting}
              className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base flex items-center justify-center gap-2"
            >
              {isRedirecting ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Redirecting to PayStation...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-5 w-5" />
                  Pay {formatBDT(numericAmount)}
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Secured by PayStation — bKash, Nagad, Rocket, Visa, Mastercard</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
