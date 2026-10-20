

"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, UploadCloud, Image as ImageIcon, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import NextImage from 'next/image';

interface DocsCompleteDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (notes: string) => void;
}

export function DocsCompleteDialog({ isOpen, onOpenChange, onConfirm }: DocsCompleteDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetState = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsUploading(false);
  };

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen]);

  const processFile = useCallback((file: File | null) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "File too large", description: "Please select an image smaller than 5MB.", variant: "destructive" });
        return false;
      }
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
        toast({ title: "Invalid file type", description: "Please select a JPG, PNG, GIF, or WEBP image.", variant: "destructive" });
        return false;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      return true;
    }
    return false;
  }, [toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFile(event.target.files?.[0] || null);
  };

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (!isOpen) return;

      const items = event.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              const processed = processFile(file);
              if (processed) {
                toast({ title: "Image Pasted", description: "Image from clipboard has been attached as proof." });
              }
              event.preventDefault();
              return;
            }
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [isOpen, processFile, toast]);


  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleUploadAndConfirm = async () => {
    if (!selectedFile) {
      toast({ title: "Validation Error", description: "Please upload proof that the documents are complete.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.file_url) {
        onConfirm(`Docs complete validation proof: ${result.file_url}`);
        toast({ title: "Validation Submitted", description: "Project has been moved to 'On Design'." });
      } else {
        throw new Error(result.message || "Failed to get file URL.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Upload Failed", description: "Could not upload proof image. Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePreview = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isUploading) onOpenChange(open); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-primary" />
            Docs Complete Validation
          </DialogTitle>
          <DialogDescription>
            Please upload proof that all required documents are complete before moving this project to the "On Design" stage.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div
            className={cn(
              "mt-1 flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer hover:border-primary transition-colors",
              previewUrl ? "border-green-500 bg-green-500/5" : "border-border"
            )}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {previewUrl ? (
              <div className="text-center relative group/preview">
                <NextImage
                  src={previewUrl}
                  alt="Preview"
                  width={120}
                  height={120}
                  unoptimized={true}
                  className="rounded-md object-cover max-h-32 w-auto mx-auto mb-2"
                />
                <p className="text-sm text-foreground font-medium truncate max-w-xs">{selectedFile?.name}</p>
                <p className="text-xs text-muted-foreground">({selectedFile ? (selectedFile.size / (1024 * 1024)).toFixed(2) : 0} MB)</p>
                <button type="button" onClick={handleRemovePreview} className="absolute -top-2 -right-2 h-6 w-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity">
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Drag & drop, paste, or click to upload proof</p>
                <p className="text-xs text-muted-foreground">(Required, Max 5MB, Images Only)</p>
              </>
            )}
          </div>
          <input
            id="file-upload"
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>Cancel</Button>
          <Button onClick={handleUploadAndConfirm} disabled={isUploading || !selectedFile}>
            {isUploading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading & Confirming...</>
            ) : (
              "Confirm & Proceed"
            )}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
