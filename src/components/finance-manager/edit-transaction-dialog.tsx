
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Transaction, TransactionType, User } from "@/types";
import { useToast } from '@/hooks/use-toast';
import { updateTransactionAction } from '@/app/(app)/expenses/actions';
import { Loader2, CalendarIcon, Paperclip, UploadCloud, XCircle, Link as LinkIcon, Edit, AlertTriangle, Save, X, Check, ChevronsUpDown } from 'lucide-react';
import * as Lucide from 'lucide-react';
import { format, parseISO } from 'date-fns';
import NextLink from 'next/link';
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface EditTransactionDialogProps {
  currentUser: User;
  transaction: Transaction;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onTransactionUpdated: () => void;
  categories?: any[];
}

const getIconComponent = (iconName: string) => {
  return (Lucide as any)[iconName] || Lucide.HelpCircle;
};

export function EditTransactionDialog({ currentUser, transaction, isOpen, onOpenChange, onTransactionUpdated, categories = [] }: EditTransactionDialogProps) {
  const [type, setType] = useState<TransactionType>(transaction.type);
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [category, setCategory] = useState(transaction.category);
  const [description, setDescription] = useState(transaction.description || '');
  const [date, setDate] = useState<Date | undefined>(parseISO(transaction.date));
  const [currentDocumentUrl, setCurrentDocumentUrl] = useState<string | null>(transaction.documentUrl || null);
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const documentFileRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && transaction) {
      setType(transaction.type);
      setAmount(transaction.amount.toString());
      setCategory(transaction.category);
      setDescription(transaction.description || '');
      setDate(parseISO(transaction.date));
      setCurrentDocumentUrl(transaction.documentUrl || null);
      setSelectedDocumentFile(null);
      if (documentFileRef.current) documentFileRef.current.value = "";
      setIsUploadingDocument(false);
      setIsDraggingOver(false);
    }
  }, [isOpen, transaction]);
  
  const filteredCategories = React.useMemo(() => {
    if (type === 'income') return categories;
    return categories.filter(cat => cat.type === type);
  }, [categories, type]);

  // Reset category if it's not in the filtered list when type changes
  useEffect(() => {
    if (isOpen && category && type !== 'income') {
      const isValid = filteredCategories.some(c => c.value === category);
      if (!isValid && !(type === 'expense' && !!transaction.sentToUserId)) {
        setCategory('');
      }
    }
  }, [type, filteredCategories, isOpen, transaction.sentToUserId]);

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
      setCurrentDocumentUrl(null); // Clear existing URL if new file is chosen
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
    // Revert to showing currentDocumentUrl if it exists and was cleared because a new file was selected
    if (transaction.documentUrl) {
      setCurrentDocumentUrl(transaction.documentUrl);
    }
  };

  const handleRemoveExistingDocument = () => {
    setCurrentDocumentUrl(null);
    setSelectedDocumentFile(null);
    if (documentFileRef.current) documentFileRef.current.value = "";
    toast({ title: "Document Marked for Removal", description: "The existing document will be removed when you save changes." })
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  useEffect(() => {
    const isDocRequired = (type === 'expense' || type === 'purchase');
    const handlePaste = (event: ClipboardEvent) => {
      if (!isOpen || !isDocRequired) return;
      const items = event.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              const processed = processFile(file);
              if (processed) toast({ title: "File Pasted", description: "Image from clipboard has been attached." });
              event.preventDefault(); return;
            }
          }
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => { document.removeEventListener('paste', handlePaste); };
  }, [isOpen, type, transaction.sentToUserId, processFile, toast]);


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

    let newUploadedDocumentUrl: string | null = currentDocumentUrl;

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
          toast({ title: "Document Upload Failed", description: errorData.message || "Could not upload new document.", variant: "destructive" });
          return;
        }
        const result = await response.json();
        if (result.success && result.file_url) {
          newUploadedDocumentUrl = result.file_url;
          toast({ title: "New Document Uploaded", description: "New document successfully attached." });
        } else {
          toast({ title: "Document Upload Failed", description: result.message || "Could not get file URL from server.", variant: "destructive" });
          return;
        }
      } catch (uploadError) {
        setIsUploadingDocument(false);
        console.error("Document upload error:", uploadError);
        toast({ title: "Document Upload Error", description: "An error occurred while uploading the new document.", variant: "destructive" });
        return;
      }
    }

    if ((type === 'expense' || type === 'purchase') && !newUploadedDocumentUrl) {
      toast({ title: "Validation Error", description: "Document is required for expenses and purchases.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const updates: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>> = {
      type,
      amount: numericAmount,
      category: type === 'income' ? (category.trim() || 'Income') : category.trim(),
      description: description.trim() || null,
      date: date.toISOString(),
      documentUrl: newUploadedDocumentUrl,
    };

    const result = await updateTransactionAction(transaction.id, updates, currentUser.id, currentUser.role);
    setIsSubmitting(false);

    if (result.success) {
      onTransactionUpdated();
    } else {
      toast({ title: "Error", description: result.error || "Could not update transaction.", variant: "destructive" });
    }
  };

  const getCategoryPlaceholder = () => {
    if (type === 'income') return "e.g., Salary, Sales";
    if (type === 'purchase') return "e.g., Inventory, Supplies";
    return "e.g., Utilities, Rent";
  };

  const isDocumentNowRequired = (type === 'expense' || type === 'purchase');
  const isDocumentMissingForRequiredType = isDocumentNowRequired && !currentDocumentUrl && !selectedDocumentFile;


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogDescription>Update the details for this transaction.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-1">
              <Label htmlFor="edit-transaction-type">Type *</Label>
              <Select value={type} onValueChange={(value) => setType(value as TransactionType)} required disabled={isSubmitting || isUploadingDocument}>
                <SelectTrigger id="edit-transaction-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-transaction-amount">Amount (BDT) *</Label>
              <Input id="edit-transaction-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g., 50.00" min="0.01" step="0.01" required disabled={isSubmitting || isUploadingDocument} />
            </div>
            {type !== 'income' && (
              <div className="space-y-1">
                <Label htmlFor="transaction-category">Category *</Label>
                <Popover open={isCategoryPopoverOpen} onOpenChange={setIsCategoryPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isCategoryPopoverOpen}
                      className="w-full justify-between font-normal"
                      disabled={isSubmitting || isUploadingDocument}
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
            <div className="space-y-1">
              <Label htmlFor="edit-transaction-date">Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className="w-full justify-start text-left font-normal"
                    disabled={isSubmitting || isUploadingDocument}
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
            <div className="space-y-1">
              <Label htmlFor="edit-transaction-description">Description (Optional)</Label>
              <Input id="edit-transaction-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Weekly supermarket run" disabled={isSubmitting || isUploadingDocument} />
            </div>

            {isDocumentNowRequired && (
              <div className="space-y-1">
                <Label htmlFor="edit-transaction-document">Document Attachment {isDocumentNowRequired ? "*" : "(Optional)"}</Label>
                <div
                  ref={dropZoneRef}
                  className={cn(
                    "mt-1 flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-md cursor-pointer hover:border-primary transition-colors",
                    isDraggingOver ? "border-primary bg-primary/10" : "border-zinc-300 dark:border-zinc-700 bg-card",
                    (selectedDocumentFile || currentDocumentUrl) ? "border-green-500 bg-green-500/5" : ""
                  )}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => !selectedDocumentFile && !currentDocumentUrl && documentFileRef.current?.click()} // Only click if no file/link shown
                >
                  {selectedDocumentFile ? (
                    <div className="text-center">
                      <Paperclip className="h-8 w-8 mb-2 text-green-600 mx-auto" />
                      <p className="text-sm text-foreground font-medium truncate max-w-xs">{selectedDocumentFile.name}</p>
                      <p className="text-xs text-muted-foreground">({(selectedDocumentFile.size / (1024 * 1024)).toFixed(2)} MB)</p>
                      <div className="flex gap-2 mt-2 justify-center">
                        <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); documentFileRef.current?.click(); }} className="text-xs h-7">Change</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRemoveSelectedFile(); }} className="text-xs text-destructive h-7">Remove</Button>
                      </div>
                    </div>
                  ) : currentDocumentUrl ? (
                    <div className="text-center">
                      <LinkIcon className="h-8 w-8 mb-2 text-primary mx-auto" />
                      <p className="text-sm text-foreground font-medium">Existing document attached</p>
                      <NextLink href={currentDocumentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline" onClick={e => e.stopPropagation()}>View Current</NextLink>
                      <div className="flex gap-2 mt-2 justify-center">
                        <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); documentFileRef.current?.click(); }} className="text-xs h-7">Replace</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRemoveExistingDocument(); }} className="text-xs text-destructive h-7">Remove</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className={cn("h-8 w-8 mb-2 text-muted-foreground", isDraggingOver ? "text-primary" : "")} />
                      <p className="text-sm text-muted-foreground">
                        {isDraggingOver ? "Drop file here" : "Drag & drop, paste, or click to upload"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Max 50MB. (Images Only)</p>
                    </>
                  )}
                </div>
                <Input
                  id="edit-transaction-document-input"
                  type="file"
                  ref={documentFileRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*"
                />
                {isDocumentMissingForRequiredType && <p className="text-xs text-destructive mt-1">A document is required for this transaction type.</p>}
              </div>
            )}


          </div>
          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting || isUploadingDocument}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || isUploadingDocument || isDocumentMissingForRequiredType}>
              {isUploadingDocument ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> :
                isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
