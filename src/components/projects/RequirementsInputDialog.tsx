"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import NextImage from 'next/image';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Globe, FileText, UploadCloud, XCircle, Loader2, ShieldCheck, ArrowRight, Link as LinkIcon, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Project } from '@/types';

interface RequirementsInputDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onConfirm: (data: {
    pageUrl?: string;
    websiteUrl?: string;
    reference?: string;
    proofUrl: string;
  }) => void;
}

export function RequirementsInputDialog({ isOpen, onOpenChange, project, onConfirm }: RequirementsInputDialogProps) {
  const [pageUrl, setPageUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setPageUrl(project.pageUrl ?? '');
      setWebsiteUrl(project.websiteUrl ?? '');
      setReference(project.reference ?? '');
      setFile(null);
      setPreview(null);
      setIsSubmitting(false);
    }
  }, [isOpen, project]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const takeFile = useCallback((f: File | null) => {
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

  // Support Ctrl+V paste of screenshot
  useEffect(() => {
    if (!isOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image')) {
          if (takeFile(items[i].getAsFile())) {
            e.preventDefault();
            toast({ title: "Image pasted", description: "Screenshot attached as group creation proof." });
          }
          return;
        }
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [isOpen, takeFile, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({
        title: "Proof required",
        description: "Upload a group creation proof screenshot before proceeding to assign Operation Manager.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body });
      const json = await res.json();
      if (!res.ok || !json.success || !json.file_url) {
        throw new Error(json.message || `Upload failed (${res.status})`);
      }

      onConfirm({
        pageUrl: pageUrl.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        reference: reference.trim() || undefined,
        proofUrl: json.file_url,
      });
      onOpenChange(false);
    } catch (err) {
      console.error('Handover requirements error:', err);
      toast({
        title: "Upload failed",
        description: "Could not upload the proof image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSubmitting) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-teal-600" /> Handover to Operation Manager
          </DialogTitle>
          <DialogDescription>
            Input client requirements & group creation proof for <span className="font-semibold text-foreground">{project.name}</span> before selecting the Operation Manager.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Page URL & Website URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="req-page-url" className="text-xs font-semibold flex items-center gap-1.5">
                <Share2 className="h-3.5 w-3.5 text-muted-foreground" /> Client Page URL
              </Label>
              <Input
                id="req-page-url"
                type="text"
                placeholder="https://facebook.com/..."
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                disabled={isSubmitting}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-website-url" className="text-xs font-semibold flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" /> Client Website URL
              </Label>
              <Input
                id="req-website-url"
                type="text"
                placeholder="https://clientwebsite.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                disabled={isSubmitting}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* References & Requirements Note */}
          <div className="space-y-1.5">
            <Label htmlFor="req-references" className="text-xs font-semibold flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Requirements & References
            </Label>
            <Textarea
              id="req-references"
              placeholder="Google drive links, video references, guidelines, or client notes..."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          {/* Group Creation Proof Screenshot */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-teal-600" /> Group Creation Proof *
              </span>
              <span className="text-[11px] text-muted-foreground font-normal">Click to browse or Ctrl+V</span>
            </Label>

            <div
              onClick={() => inputRef.current?.click()}
              className={cn(
                "relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all",
                preview ? "border-teal-500/50 bg-teal-50/20 dark:bg-teal-950/20" : "border-muted-foreground/25 bg-muted/30 hover:border-teal-500/50 hover:bg-muted/50"
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                disabled={isSubmitting}
                onChange={(e) => takeFile(e.target.files?.[0] ?? null)}
              />

              {preview ? (
                <div className="relative h-28 w-full max-w-xs overflow-hidden rounded-lg border bg-background shadow-sm">
                  <NextImage src={preview} alt="Proof preview" fill className="object-contain" unoptimized />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setPreview(null);
                    }}
                    className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 text-destructive shadow hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    title="Remove image"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <UploadCloud className="h-7 w-7 text-teal-600" />
                  <p className="text-xs font-medium">Click to select or paste screenshot (Ctrl+V)</p>
                  <p className="text-[10px]">JPG, PNG, GIF, WEBP up to 5MB</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t pt-3 flex items-center justify-between sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !file} className="bg-teal-600 hover:bg-teal-700 text-white min-w-36">
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
              ) : (
                <>Next: Select Manager <ArrowRight className="ml-1.5 h-4 w-4" /></>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
