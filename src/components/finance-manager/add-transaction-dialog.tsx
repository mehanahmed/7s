

"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TransactionType, User } from "@/types";
import { useToast } from '@/hooks/use-toast';
import { addTransactionAction } from '@/app/(app)/expenses/actions';
import { Loader2, CalendarIcon, UploadCloud, Paperclip, XCircle, Check, ChevronsUpDown } from 'lucide-react';
import * as Lucide from 'lucide-react';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

type DialogMode = 'addIncome' | 'addExpenseOrPurchase';

interface AddTransactionDialogProps {
  currentUser: User;
  onTransactionAdded: () => void;
  children: React.ReactNode;
  dialogMode: DialogMode;
  categories?: any[];
}

const getIconComponent = (iconName: string) => {
  return (Lucide as any)[iconName] || Lucide.HelpCircle;
};

export function AddTransactionDialog({
  currentUser,
  onTransactionAdded,
  children,
  dialogMode,
  categories = []
}: AddTransactionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const documentFileRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = useState(false);



  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const availableTransactionTypes = useMemo(() => {
    if (dialogMode === 'addIncome') {
      return [{ value: 'income', label: 'Income' }];
    }
    // For addExpenseOrPurchase
    return [
      { value: 'expense', label: 'Expense' },
      { value: 'purchase', label: 'Purchase' },
    ];
  }, [dialogMode]);

  const resetForm = useCallback(() => {
    let defaultType: TransactionType = 'expense';
    let defaultCategory = "";

    if (dialogMode === 'addIncome') {
      defaultType = 'income';
      defaultCategory = 'Income';
    } else { // addExpenseOrPurchase
      defaultType = 'expense';
    }

    setType(defaultType);
    setAmount('');
    setDescription('');
    setDate(new Date());
    setCategory(defaultCategory);
    setSelectedDocumentFile(null);
    if (documentFileRef.current) documentFileRef.current.value = "";
    setIsUploadingDocument(false);
    setIsSubmitting(false);
    setIsDraggingOver(false);
  }, [dialogMode]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);





  useEffect(() => {
    // Ensure the selected type is valid for the current mode
    if (!availableTransactionTypes.some(t => t.value === type)) {
      setType((availableTransactionTypes[0]?.value as TransactionType) || 'expense');
    }
  }, [availableTransactionTypes, type]);
  
  const filteredCategories = useMemo(() => {
    if (type === 'income') return categories;
    return categories.filter(cat => cat.type === type);
  }, [categories, type]);

  const isDocumentRequired = useMemo(() => {
    if (currentUser?.role === 'SYSTEM_ADMIN') {
      return false;
    }
    return (type === 'expense' || type === 'purchase') && dialogMode !== 'addIncome';
  }, [type, dialogMode, currentUser]);

  const processFile = useCallback((file: File | null) => {
    if (file) {
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        toast({ title: "File too large", description: "Please select a file smaller than 50MB.", variant: "destructive" });
        return false;
      }
      if (!file.type.startsWith('image/')) {
        toast({ title: "Invalid File Type", description: "Please select an image file.", variant: "destructive" });
        return false;
      }
      setSelectedDocumentFile(file);
      return true;
    }
    return false;
  }, [toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    processFile(file || null);
  };

  const handleRemoveSelectedFile = () => {
    setSelectedDocumentFile(null);
    if (documentFileRef.current) documentFileRef.current.value = "";
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (!isOpen || !isDocumentRequired) return;

      const items = event.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              const processed = processFile(file);
              if (processed) {
                toast({ title: "File Pasted", description: "Image from clipboard has been attached." });
              }
              event.preventDefault();
              return;
            }
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [isOpen, isDocumentRequired, processFile, toast]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isCategoryRequired = type !== 'income';
    if (!amount || (isCategoryRequired && !category) || !date) {
      toast({ title: "Validation Error", description: `Amount, ${isCategoryRequired ? "Category, " : ""}and Date are required.`, variant: "destructive" });
      return;
    }
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({ title: "Validation Error", description: "Amount must be a positive number.", variant: "destructive" });
      return;
    }

    let uploadedDocumentUrl: string | null = null;

    // Upload if a file is selected, regardless of whether it's required.
    // If it's required but no file is selected, the canSubmit check will already prevent this handler from being called.
    if (selectedDocumentFile) {
      setIsUploadingDocument(true);
      const formData = new FormData();
      formData.append('file', selectedDocumentFile);
      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        setIsUploadingDocument(false);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "Upload failed with status: " + response.status }));
          toast({ title: "Document Upload Failed", description: errorData.message || "Could not upload document.", variant: "destructive" });
          return;
        }
        const result = await response.json();
        if (result.success && result.file_url) {
          uploadedDocumentUrl = result.file_url;
          toast({ title: "Document Uploaded", description: "Document successfully attached." });
        } else {
          toast({ title: "Document Upload Failed", description: result.message || "Could not get file URL from server.", variant: "destructive" });
          return;
        }
      } catch (uploadError) {
        setIsUploadingDocument(false);
        console.error("Document upload error:", uploadError);
        toast({ title: "Document Upload Error", description: "An error occurred while uploading the document.", variant: "destructive" });
        return;
      }
    }

    setIsSubmitting(true);
    const finalCategory = type === 'income' ? (category.trim() || 'Income') : category.trim();

    const transactionPayload = {
      type: type, // Type is now set based on dialogMode
      amount: numericAmount,
      category: finalCategory,
      description: description.trim() || null,
      date: date.toISOString(),
      sentToUserId: null,
      sentToUserName: null,
      documentUrl: uploadedDocumentUrl,
    };

    const result = await addTransactionAction(currentUser, transactionPayload);
    setIsSubmitting(false);

    if (result.success && result.transaction) {
      const successType = type.charAt(0).toUpperCase() + type.slice(1);
      toast({ title: `${successType} Recorded`, description: `${finalCategory} of ${numericAmount} recorded.` });
      if (result.error) {
        toast({ title: "Notice", description: result.error, variant: "default", duration: 7000 });
      }
      onTransactionAdded();
      setIsOpen(false);
    } else {
      toast({ title: "Error", description: result.error || "Could not add transaction.", variant: "destructive" });
    }
  };

  const dialogTitleText = useMemo(() => {
    if (dialogMode === 'addIncome') return "Add New Income";
    return "Add New Transaction";
  }, [dialogMode]);

  const dialogDescriptionText = useMemo(() => {
    if (dialogMode === 'addIncome') return "Log a new income entry.";
    return "Log a new transaction entry.";
  }, [dialogMode]);


  const canSubmit = useMemo(() => {
    const baseValid = !isSubmitting && !isUploadingDocument &&
      amount.trim() && parseFloat(amount) > 0 &&
      date;

    let docValid = true;
    if (isDocumentRequired) {
      docValid = !!selectedDocumentFile;
    }

    return baseValid && category.trim() && docValid;
  }, [isSubmitting, isUploadingDocument, amount, category, date, isDocumentRequired, selectedDocumentFile]);


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dialogTitleText}</DialogTitle>
          <DialogDescription>{dialogDescriptionText}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            {dialogMode === 'addIncome' && (
              <div className="space-y-1">
                <Label>Type</Label>
                <Input value="Income" readOnly disabled className="bg-muted/50" />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="transaction-amount">Amount (BDT) *</Label>
              <Input id="transaction-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g., 50.00" min="0.01" step="0.01" required />
            </div>

            {dialogMode !== 'addIncome' && (
              <div className="space-y-1">
                <Label htmlFor="transaction-category">Category *</Label>
                <Popover open={isCategoryPopoverOpen} onOpenChange={setIsCategoryPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isCategoryPopoverOpen}
                      className="w-full justify-between font-normal"
                    >
                      {category ? (
                        <div className="flex items-center gap-2 truncate">
                          {React.createElement(getIconComponent(filteredCategories.find(c => c.value === category)?.icon || "Tag"), { className: cn("h-4 w-4", filteredCategories.find(c => c.value === category)?.colorClass) })}
                          <span>{filteredCategories.find(c => c.value === category)?.label || category}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Select a category...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search category..." className="h-9" />
                      <CommandList>
                        <CommandEmpty>No category found.</CommandEmpty>
                        <CommandGroup>
                          {filteredCategories.map((cat) => (
                            <CommandItem
                              key={cat.id || cat.value}
                              value={cat.value}
                              onSelect={(currentValue) => {
                                setCategory(currentValue === category ? "" : currentValue);
                                setIsCategoryPopoverOpen(false);
                              }}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                {React.createElement(getIconComponent(cat.icon), { className: cn("h-4 w-4", cat.colorClass) })}
                                <span>{cat.label}</span>
                              </div>
                              <Check
                                className={cn(
                                  "ml-auto h-4 w-4",
                                  category === cat.value ? "opacity-100" : "opacity-0"
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="transaction-date">Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="transaction-description">Description / Notes (Optional)</Label>
              <Input id="transaction-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Weekly supermarket run" />
            </div>

            {(type === 'expense' || type === 'purchase') && dialogMode !== 'addIncome' && (
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="transaction-document">Document Attachment {isDocumentRequired ? "*" : "(Optional)"}</Label>
                <div
                  ref={dropZoneRef}
                  className={cn(
                    "mt-1 flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-md cursor-pointer hover:border-primary transition-colors",
                    isDraggingOver ? "border-primary bg-primary/10" : "border-zinc-300 dark:border-zinc-700 bg-card",
                    selectedDocumentFile ? "border-green-500 bg-green-500/5" : ""
                  )}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => documentFileRef.current?.click()}
                >
                  <UploadCloud className={cn("h-8 w-8 mb-2", selectedDocumentFile ? "text-green-600" : "text-muted-foreground", isDraggingOver ? "text-primary" : "")} />
                  <p className="text-sm text-muted-foreground">
                    {isDraggingOver ? "Drop file here" : selectedDocumentFile ? "File selected:" : "Drag & drop or click to upload"}
                  </p>
                  {selectedDocumentFile && (
                    <div className="mt-1 text-xs text-foreground font-medium flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-green-600" />
                      <span>{selectedDocumentFile.name} ({(selectedDocumentFile.size / 1024).toFixed(1)} KB)</span>
                      <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleRemoveSelectedFile(); }} title="Clear selection" className="text-muted-foreground hover:text-destructive h-6 w-6">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {!selectedDocumentFile && <p className="text-xs text-muted-foreground mt-0.5">Max 50MB. (Images Only)</p>}
                  {!selectedDocumentFile && <p className="text-xs text-muted-foreground mt-0.5">You can also paste an image from clipboard.</p>}
                </div>
                <Input
                  id="transaction-document"
                  type="file"
                  ref={documentFileRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*"
                />
              </div>
            )}

          </div>
          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting || isUploadingDocument}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit || isUploadingDocument}>
              {isUploadingDocument ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> :
                isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> :
                  (dialogMode === 'addIncome' ? "Add Income" : "Add Transaction")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

