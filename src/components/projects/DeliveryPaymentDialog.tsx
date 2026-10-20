"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Loader2, UploadCloud, FileText, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPaymentMethods } from '@/lib/service-options-service';
import { useToast } from '@/hooks/use-toast';
import type { DeliveryPaymentInput } from '@/types';

interface DeliveryPaymentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  due: number;
  onConfirm: (payment: DeliveryPaymentInput) => void | Promise<void>;
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Shown when a project with an unpaid balance is moved to Project Delivered. */
export function DeliveryPaymentDialog({ isOpen, onOpenChange, projectName, due, onConfirm }: DeliveryPaymentDialogProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [methods, setMethods] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFile(null);
    setMethod('');
    setReference('');
    setIsSaving(false);
    getPaymentMethods().then((list) => setMethods(list.map((m) => m.name))).catch(() => setMethods([]));
  }, [isOpen, due]);

  const takeFile = (f: File | null) => {
    if (!f) return;
    const okType = f.type.startsWith('image/') || f.type === 'application/pdf';
    if (!okType) return toast({ title: "Invalid file", description: "Upload an image or a PDF.", variant: "destructive" });
    if (f.size > 10 * 1024 * 1024) return toast({ title: "File too large", description: "Max size is 10MB.", variant: "destructive" });
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!method) return toast({ title: "Method required", description: "Select a payment method.", variant: "destructive" });
    if (!reference.trim()) return toast({ title: "Reference required", description: "Enter a transaction / reference number.", variant: "destructive" });
    if (!file) return toast({ title: "Proof required", description: "Upload an image or PDF as payment proof.", variant: "destructive" });
    setIsSaving(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body });
      const json = await res.json();
      if (!res.ok || !json.success || !json.file_url) throw new Error(json.message || `Upload failed (${res.status})`);
      await onConfirm({ amount: due, paymentMethod: method, reference: reference.trim(), proofUrl: json.file_url });
      onOpenChange(false);
    } catch (err) {
      console.error('Payment proof upload error:', err);
      toast({ title: "Upload failed", description: "Could not upload the proof. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!isSaving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b pb-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-400 text-white shadow-md shadow-primary/30"><Wallet className="h-5 w-5" aria-hidden /></span>
          <div className="min-w-0">
            <DialogTitle className="text-lg">Payment required</DialogTitle>
            <DialogDescription className="truncate">Record the payment to move <span className="font-medium text-foreground">{projectName}</span> to Project Delivered.</DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 py-1">
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <span className="text-sm font-medium text-red-700">Due Amount</span>
            <span className="text-xl font-bold tabular-nums text-red-600">{fmt(due)}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Payment method *</Label>
              <Select value={method} onValueChange={setMethod} disabled={isSaving}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  {methods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="dp-ref">Reference *</Label>
              <Input id="dp-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction ID / receipt no." disabled={isSaving} />
            </div>
            <div className="space-y-1">
              <Label>Payment proof *</Label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => !isSaving && inputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); takeFile(e.dataTransfer.files?.[0] ?? null); }}
                className={cn(
                  'flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 text-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  file ? 'border-green-500 bg-green-500/5' : 'border-input bg-card text-muted-foreground',
                )}
              >
                {file ? (
                  <>
                    <FileText className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-foreground">{file.name}</span>
                    <button type="button" aria-label="Remove file" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); setFile(null); if (inputRef.current) inputRef.current.value = ''; }}>
                      <XCircle className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">Image or PDF</span>
                  </>
                )}
              </div>
              <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => takeFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter className="border-t pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving} className="min-w-36">
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : 'Confirm & Move'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
