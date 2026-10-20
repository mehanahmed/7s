"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Link2 } from 'lucide-react';

interface PaymentProofCellProps {
  method?: string | null;
  proofUrl?: string | null;
  amountLabel?: string;
}

const isPdf = (url: string) => /\.pdf(\?|#|$)/i.test(url);

/** Payment method text that opens the payment proof (image or PDF) in a popup when clicked. */
export function PaymentProofCell({ method, proofUrl }: PaymentProofCellProps) {
  const [open, setOpen] = useState(false);
  const label = method || 'N/A';

  // no proof: plain text, nothing to click
  if (!proofUrl) return <span className="text-card-foreground">{label}</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="View payment proof"
        className="inline-flex cursor-pointer items-center gap-1.5 rounded font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary print:text-card-foreground"
      >
        {label}
        <Link2 className="h-3.5 w-3.5 print:hidden" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-auto max-w-[88vw] border-0 bg-transparent p-0 shadow-none sm:max-w-md [&>button]:right-2 [&>button]:top-2 [&>button]:z-10 [&>button]:rounded-full [&>button]:bg-black/60 [&>button]:p-1.5 [&>button]:text-white [&>button]:opacity-100 hover:[&>button]:bg-black/80">
          <DialogTitle className="sr-only">Payment proof: {label}</DialogTitle>
          <DialogDescription className="sr-only">Uploaded proof for this payment.</DialogDescription>
          {isPdf(proofUrl) ? (
            <iframe src={proofUrl} title="Payment proof" className="h-[65vh] w-full rounded-lg bg-white" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={proofUrl} alt="Payment proof" className="mx-auto h-auto max-h-[60vh] w-auto max-w-full rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
