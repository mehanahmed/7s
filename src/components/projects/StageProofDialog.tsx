"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import NextImage from 'next/image';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldCheck, UploadCloud, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface StageProofDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Called with the uploaded proof's URL once the upload succeeded. */
  onConfirm: (proofUrl: string) => void;
}

/** A proof image is mandatory before a project can enter certain stages (e.g. Operation Manager: group created). */
export function StageProofDialog({ isOpen, onOpenChange, title, description, onConfirm }: StageProofDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) { setFile(null); setPreview(null); setIsUploading(false); }
  }, [isOpen]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const take = useCallback((f: File | null) => {
    if (!f) return false;
    if (f.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image smaller than 5MB.", variant: "destructive" });
      return false;
    }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(f.type)) {
      toast({ title: "Invalid file type", description: "Please select a JPG, PNG, GIF or WEBP image.", variant: "destructive" });
      return false;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    return true;
  }, [toast]);

  // allow Ctrl+V of a screenshot
  useEffect(() => {
    if (!isOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image')) {
          if (take(items[i].getAsFile())) { e.preventDefault(); toast({ title: "Image pasted", description: "Screenshot attached as proof." }); }
          return;
        }
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [isOpen, take, toast]);

  const submit = async () => {
    if (!file) {
      toast({ title: "Proof required", description: "Upload a proof image to continue.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body });
      const json = await res.json();
      if (!res.ok || !json.success || !json.file_url) throw new Error(json.message || `Upload failed (${res.status})`);
      onConfirm(json.file_url);
      onOpenChange(false);
    } catch (err) {
      console.error('Proof upload error:', err);
      toast({ title: "Upload failed", description: "Could not upload the proof. Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isUploading) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); take(e.dataTransfer.files?.[0] ?? null); }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors hover:border-primary",
              preview ? "border-green-500 bg-green-500/5" : "border-zinc-300 bg-card",
            )}
          >
            {preview ? (
              <div className="group relative text-center">
                <NextImage src={preview} alt="Proof preview" width={160} height={120} unoptimized className="mx-auto mb-2 max-h-32 w-auto rounded-md object-cover" />
                <p className="max-w-[220px] truncate text-xs text-muted-foreground">{file?.name}</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); if (inputRef.current) inputRef.current.value = ''; }}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                  aria-label="Remove image"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <UploadCloud className="mb-2 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Drag & drop, paste, or click to upload</p>
                <p className="mt-1 text-xs font-semibold text-destructive">Required, max 5MB, images only</p>
              </>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => take(e.target.files?.[0] ?? null)} />
        </div>

        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={isUploading || !file}>
            {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : "Upload & Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
