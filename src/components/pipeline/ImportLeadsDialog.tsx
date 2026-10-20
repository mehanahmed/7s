
"use client";

import React, { useState } from 'react';
import Papa from 'papaparse';
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
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { addLeadsBatchAction } from '@/app/(app)/pipeline/actions';
import { Loader2, FileCheck2, AlertTriangle, Search, Info, Link2 } from 'lucide-react';
import type { Lead, User } from '@/types';

interface ImportLeadsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onLeadsImported: () => void;
  currentUser: User;
}

const REQUIRED_HEADERS = ["date", "contactName", "businessName", "phone", "source", "address", "category"];

export function ImportLeadsDialog({ isOpen, onOpenChange, onLeadsImported, currentUser }: ImportLeadsDialogProps) {
  const [sheetUrl, setSheetUrl] = useState('');
  const [parsedData, setParsedData] = useState<Omit<Lead, 'id' | 'crmId' | 'crmName'>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parseStats, setParseStats] = useState({ total: 0, unique: 0, duplicates: 0 });
  const { toast } = useToast();

  const resetState = () => {
    setSheetUrl('');
    setParsedData([]);
    setError(null);
    setIsParsing(false);
    setIsSubmitting(false);
    setParseStats({ total: 0, unique: 0, duplicates: 0 });
  };

  const handleFetchSheet = async () => {
    if (!sheetUrl) {
      setError("Please enter a Google Sheet URL.");
      return;
    }

    try {
      setIsParsing(true);
      setError(null);

      // Convert view URL to export CSV URL
      let exportUrl = sheetUrl;
      const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (sheetIdMatch) {
        const sheetId = sheetIdMatch[1];
        exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
        const gidMatch = sheetUrl.match(/gid=(\d+)/);
        if (gidMatch) {
            exportUrl += `&gid=${gidMatch[1]}`;
        }
      }

      const response = await fetch(exportUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch sheet. Ensure it is shared as 'Anyone with the link can view'.");
      }

      const csvText = await response.text();
      parseCSVContent(csvText);
    } catch (err: any) {
      setError(err.message || "Failed to import from URL.");
      setIsParsing(false);
    }
  };

  const parseCSVContent = (content: string) => {
    Papa.parse<any>(content, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const headers = results.meta.fields || [];
        const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
          setError(`Missing required columns: ${missingHeaders.join(', ')}`);
          setParsedData([]);
          setIsParsing(false);
          return;
        }

        const validLeads: Omit<Lead, 'id' | 'crmId' | 'crmName'>[] = [];
        const validationErrors: string[] = [];
        const seenPhones = new Set<string>();

        let total = 0;
        let unique = 0;
        let duplicates = 0;

        results.data.forEach((row, index) => {
          if (Object.values(row).every(v => !v)) return;
          total++;

          if (!row.contactName || !row.date || !row.phone) {
            validationErrors.push(`Row ${index + 2}: Missing required data.`);
            return;
          }

          if (seenPhones.has(row.phone)) {
            duplicates++;
            return;
          }

          const parsedDate = new Date(row.date);
          if (isNaN(parsedDate.getTime())) {
            validationErrors.push(`Row ${index + 2}: Invalid date format.`);
            return;
          }

          seenPhones.add(row.phone);
          unique++;

          validLeads.push({
            date: parsedDate.toISOString(),
            contactName: row.contactName,
            businessName: row.businessName || '',
            phone: row.phone,
            source: row.source || 'CSV Import',
            address: row.address || '',
            category: row.category || 'POG',
            status: row.status || 'New Lead',
            notes: row.notes || null,
            schedule: row.schedule ? new Date(row.schedule).toISOString() : null,
          });
        });

        setParseStats({ total, unique, duplicates });

        if (validationErrors.length > 0) {
          setError(validationErrors.slice(0, 3).join('\n'));
          setParsedData([]);
        } else {
          setParsedData(validLeads);
          setError(null);
        }
        setIsParsing(false);
      },
      error: (err: any) => {
        setError(`Parsing Error: ${err.message}`);
        setIsParsing(false);
      }
    });
  };

  const handleSubmit = async () => {
    if (parsedData.length === 0) {
      toast({ title: "No Data", description: "No valid leads to import.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await addLeadsBatchAction(parsedData, currentUser);
    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: "Import Successful",
        description: `Successfully imported ${result.createdCount} new leads.`,
      });
      onLeadsImported();
      onOpenChange(false);
    } else {
      toast({
        title: "Import Partially Failed",
        description: `Imported ${result.createdCount} leads. ${result.errorCount} failed.`,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); if (!open) resetState(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 bg-background border-none shadow-2xl rounded-3xl">
        <DialogHeader className="p-8 pb-4 bg-muted/5 relative">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Link2 className="h-24 w-24" />
            </div>
          <DialogTitle className="text-2xl font-semibold tracking-wide flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <FileCheck2 className="h-6 w-6" />
            </div>
            Import Leads
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Import multiple leads directly from a Google Sheet.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-4 space-y-6">
           <div className="space-y-4">
               <div className="space-y-3">
                  <Label htmlFor="sheet-url" className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <Search className="h-3 w-3" /> Google Sheet URL (Public Link)
                  </Label>
                  <div className="flex gap-2">
                    <Input 
                        id="sheet-url"
                        placeholder="https://docs.google.com/spreadsheets/d/..." 
                        value={sheetUrl}
                        onChange={(e) => setSheetUrl(e.target.value)}
                        className="rounded-xl h-12 bg-muted/20 border-muted-foreground/20 focus-visible:ring-primary/20 transition-all font-medium"
                    />
                    <Button 
                        onClick={handleFetchSheet}
                        disabled={isParsing || isSubmitting || !sheetUrl}
                        className="h-12 rounded-xl px-6 bg-primary font-bold shadow-lg shadow-primary/10"
                    >
                        {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
                    </Button>
                  </div>
               </div>

              {parseStats.total > 0 && !error && (
                <div className="p-4 bg-green-500/5 text-green-700 text-sm rounded-2xl flex items-center gap-3 border border-green-500/20 animate-in fade-in zoom-in-95">
                  <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                    <FileCheck2 className="h-4 w-4" />
                  </div>
                  <p className="font-medium">
                    Successfully parsed <span className="font-bold underline">{parseStats.total}</span> records. 
                    <span className="ml-1 text-green-600 font-bold">{parseStats.unique}</span> unique & 
                    <span className="ml-1 text-amber-600 font-bold">{parseStats.duplicates}</span> duplicate records.
                  </p>
                </div>
              )}

              {error && (
                <div className="px-5 py-4 bg-destructive/10 text-destructive text-sm rounded-2xl flex items-start gap-3 border border-destructive/20 animate-in fade-in slide-in-from-top-2">
                  <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold uppercase tracking-tight text-xs mb-1">Configuration Error</p>
                    <p className="whitespace-pre-wrap leading-relaxed">{error}</p>
                  </div>
                </div>
              )}
           </div>
        </div>

        <DialogFooter className="p-8 border-t bg-muted/5">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="rounded-2xl h-11 px-6 font-semibold">Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || isParsing || parsedData.length === 0 || !!error}
            className="rounded-2xl h-11 px-8 font-bold shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 transition-all gap-2"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Finalizing...</>
            ) : (
              <>
                <FileCheck2 className="h-4 w-4" /> Import {parsedData.length > 0 ? parsedData.length : ''} Leads
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
