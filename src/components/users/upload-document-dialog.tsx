"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { User } from "@/types";
import { FileText, UploadCloud, XCircle, Loader2, FileIcon, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadPDFDocumentAction } from '@/app/(app)/hrm/documentation/document-actions';
import { PDFDocument } from 'pdf-lib';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface UploadDocumentDialogProps {
  user: User;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadSuccess: (userId: string) => void;
}

const DOCUMENT_LEVELS = [
  { id: 'nid_birth', label: '1. NID/Birth Certificate', accept: '.pdf,image/*' },
  { id: 'recent_photo', label: '2. Recent Photo', accept: 'image/*' },
  { id: 'nominee_nid', label: '3. Nominee NID', accept: '.pdf,image/*' },
  { id: 'nominee_photo', label: '4. Nominee Photo', accept: 'image/*' },
  { id: 'edu_cert', label: '5. Original educational certificate', accept: '.pdf,image/*' },
  { id: 'utility_bill', label: '6. Utility Bill Copy', accept: '.pdf,image/*' },
  { id: 'cv', label: '7. Update CV', accept: '.pdf' },
];

export function UploadDocumentDialog({ user, isOpen, onOpenChange, onUploadSuccess }: UploadDocumentDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (isOpen) {
      setSelectedFiles({});
    }
  }, [isOpen]);

  const handleFileChange = (levelId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Basic size validation
      if (file.size > 10 * 1024 * 1024) { // 10MB limit per file
        toast({
          title: "File too large",
          description: `${file.name} is larger than 10MB limit.`,
          variant: "destructive"
        });
        return;
      }
      setSelectedFiles(prev => ({ ...prev, [levelId]: file }));
    }
  };

  const mergeFilesToPdf = async (files: Record<string, File>) => {
    const mergedPdf = await PDFDocument.create();
    
    for (const level of DOCUMENT_LEVELS) {
      const file = files[level.id];
      if (!file) continue;

      try {
        const arrayBuffer = await file.arrayBuffer();
        
        if (file.type === 'application/pdf') {
          const pdf = await PDFDocument.load(arrayBuffer);
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        } else if (file.type.startsWith('image/')) {
          let image;
          if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
            image = await mergedPdf.embedJpg(arrayBuffer);
          } else if (file.type === 'image/png') {
            image = await mergedPdf.embedPng(arrayBuffer);
          } else {
            console.warn(`Skipping unsupported image type: ${file.type}`);
            continue;
          }

          const page = mergedPdf.addPage();
          const { width, height } = page.getSize();
          const margin = 40;
          const dims = image.scaleToFit(width - margin * 2, height - margin * 2);
          
          page.drawImage(image, {
            x: width / 2 - dims.width / 2,
            y: height / 2 - dims.height / 2,
            width: dims.width,
            height: dims.height,
          });
        }
      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err);
        throw new Error(`Failed to process ${file.name}. It might be corrupted or incompatible.`);
      }
    }

    const pdfBytes = await mergedPdf.save();
    return new File([pdfBytes as any], `merged_docs_${user.name.replace(/\s+/g, '_')}.pdf`, { type: 'application/pdf' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(selectedFiles).length === 0) {
        toast({ title: "No files", description: "Please upload at least one document.", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    
    try {
      // 1. Merge files
      const mergedFile = await mergeFilesToPdf(selectedFiles);

      // 2. Upload merged file
      const formData = new FormData();
      formData.append('file', mergedFile);

      const result = await uploadPDFDocumentAction(formData, user.id);

      if (result.success) {
        toast({
          title: "All Documents Saved",
          description: `All files merged and uploaded for ${user.name}.`,
        });
        onUploadSuccess(user.id);
        onOpenChange(false);
      } else {
        toast({
          title: "Upload Failed",
          description: result.error || "Could not save the merged document.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred during merging or upload.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const allFilesUploaded = DOCUMENT_LEVELS.every(level => selectedFiles[level.id]);
  const uploadedCount = Object.keys(selectedFiles).length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 border-b">
          <DialogTitle className="flex items-center text-xl">
            <FileText className="mr-2 h-6 w-6 text-primary" /> Documentation for {user.name}
          </DialogTitle>
          <DialogDescription>
            Upload required documents. They will be merged into a single PDF.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-3">
            {DOCUMENT_LEVELS.map((level) => (
              <div 
                key={level.id}
                className={cn(
                  "relative group border rounded-xl p-4 transition-all",
                  selectedFiles[level.id] 
                    ? "bg-primary/5 border-primary/20" 
                    : "bg-muted/5 border-muted-foreground/10 hover:border-primary/20"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
                        selectedFiles[level.id] ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                    )}>
                        {selectedFiles[level.id] ? <CheckCircle2 className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </div>
                    <div>
                        <p className={cn(
                            "text-sm font-medium",
                            selectedFiles[level.id] ? "text-primary" : "text-foreground"
                        )}>
                            {level.label}
                        </p>
                        {selectedFiles[level.id] ? (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {selectedFiles[level.id].name} ({(selectedFiles[level.id].size / 1024).toFixed(0)} KB)
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground italic">Pending upload</p>
                        )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedFiles[level.id] ? (
                        <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setSelectedFiles(prev => {
                                const next = { ...prev };
                                delete next[level.id];
                                return next;
                            })}
                        >
                            <XCircle className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => fileInputRefs.current[level.id]?.click()}
                        >
                            Choose
                        </Button>
                    )}
                  </div>
                </div>

                <Input
                  type="file"
                  accept={level.accept}
                  className="hidden"
                  ref={el => { fileInputRefs.current[level.id] = el; }}
                  onChange={(e) => handleFileChange(level.id, e)}
                  disabled={isLoading}
                />
              </div>
            ))}
          </div>

          {!allFilesUploaded && (
            <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-3 text-amber-800">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div className="text-sm">
                    <p className="font-semibold">Incomplete Profile</p>
                    <p className="opacity-80">You have uploaded {uploadedCount} of {DOCUMENT_LEVELS.length} documents. You can still save, but a complete profile is recommended.</p>
                </div>
            </div>
          )}
        </ScrollArea>
        
        <DialogFooter className="p-6 border-t bg-muted/5">
          <div className="flex w-full items-center justify-between">
            <div className="text-xs text-muted-foreground">
                {uploadedCount} files selected
            </div>
            <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
                    Cancel
                </Button>
                <Button 
                    type="submit" 
                    onClick={handleSubmit}
                    disabled={isLoading || uploadedCount === 0}
                    className="bg-primary hover:bg-primary/90 min-w-[120px]"
                >
                    {isLoading ? (
                        <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Merging...
                        </>
                    ) : (
                        "Merge & Save"
                    )}
                </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
