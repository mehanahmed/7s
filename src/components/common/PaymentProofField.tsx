"use client";

import React, { useRef } from 'react';
import { UploadCloud, FileText, XCircle } from 'lucide-react';
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PaymentProofFieldProps {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  required?: boolean;
}

/** Image / PDF picker for a payment proof. The parent uploads the file (POST /api/upload) on submit. */
export function PaymentProofField({ file, onChange, disabled, required }: PaymentProofFieldProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const take = (f: File | null) => {
    if (!f) return;
    if (!(f.type.startsWith('image/') || f.type === 'application/pdf')) {
      toast({ title: "Invalid file", description: "Upload an image or a PDF.", variant: "destructive" });
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max size is 10MB.", variant: "destructive" });
      return;
    }
    onChange(f);
  };

  return (
    <div className="space-y-1">
      <Label>Payment proof{required ? ' *' : ' (Optional)'}</Label>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!disabled) inputRef.current?.click(); } }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (!disabled) take(e.dataTransfer.files?.[0] ?? null); }}
        className={cn(
          'flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 text-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          file ? 'border-green-500 bg-green-500/5' : 'border-input bg-card text-muted-foreground',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        {file ? (
          <>
            <FileText className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-foreground">{file.name}</span>
            <button
              type="button"
              aria-label="Remove file"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onChange(null); if (inputRef.current) inputRef.current.value = ''; }}
            >
              <XCircle className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <UploadCloud className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">Upload image or PDF</span>
          </>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => take(e.target.files?.[0] ?? null)} />
    </div>
  );
}
