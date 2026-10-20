
"use client";

import React, { useState, useEffect } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar as CalendarIcon } from 'lucide-react';
import type { User, BillReport } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { addBillReportAction } from '@/app/(app)/artists/actions';
import { updateBillReport } from '@/lib/bill-report-service';


interface AddEditBillReportDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: () => void;
  vendors: User[];
  reportToEdit?: BillReport | null;
}

export function AddEditBillReportDialog({ isOpen, onOpenChange, onSave, vendors, reportToEdit }: AddEditBillReportDialogProps) {
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const { toast } = useToast();

  const isEditMode = !!reportToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && reportToEdit) {
        setInvoiceId(reportToEdit.invoiceId);
        setAmount(reportToEdit.amount.toString());
        setSelectedVendor(reportToEdit.vendorId);
        setSelectedDate(new Date(reportToEdit.date));
      } else {
        setInvoiceId('');
        setAmount('');
        setSelectedVendor('');
        setSelectedDate(new Date());
      }
    }
  }, [isOpen, reportToEdit, isEditMode]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceId || !amount || !selectedVendor || !selectedDate) {
      toast({ title: "Validation Error", description: "All fields are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const reportData = {
      vendorId: selectedVendor,
      vendorName: vendors.find(v => v.id === selectedVendor)?.name || 'Unknown',
      date: selectedDate.toISOString(),
      invoiceId,
      amount: parseFloat(amount),
      // In edit mode, preserve payment info, in add mode, initialize it
      payment: (isEditMode && reportToEdit) ? reportToEdit.payment : 0,
      method: (isEditMode && reportToEdit) ? reportToEdit.method : 'N/A',
    };

    let result: boolean | { success: boolean; error?: string };
    if (isEditMode && reportToEdit) {
      result = await updateBillReport(reportToEdit.id, reportData);
    } else {
      result = await addBillReportAction(reportData);
    }

    setIsSubmitting(false);

    const isSuccess = typeof result === 'boolean' ? result : (result as any).success;

    if (isSuccess) {
      toast({ title: "Success", description: "Bill has been saved." });
      onSave();
      onOpenChange(false); // This line ensures the dialog closes on success
    } else {
      const errorMessage = (typeof result === 'object' && result && (result as any).error) ? (result as any).error : "Failed to save bill.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add New'} Bill</DialogTitle>
          <DialogDescription>
            Enter the details for the vendor bill.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="py-4 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="vendor">Vendor *</Label>
            <Select value={selectedVendor} onValueChange={setSelectedVendor} required>
              <SelectTrigger id="vendor">
                <SelectValue placeholder="Select a vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map(vendor => (
                  <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="date">Date *</Label>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setIsDatePickerOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label htmlFor="invoice-id">Invoice ID *</Label>
            <Input id="invoice-id" value={invoiceId} onChange={e => setInvoiceId(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="amount">Amount *</Label>
            <Input id="amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} required min="0" />
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Bill'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddEditBillReportDialog;
