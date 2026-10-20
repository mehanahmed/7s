
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
import type { User, ServicePaymentMethodItem, BillReport } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { addBillPaymentAction, updateBillReportAction } from '@/app/(app)/artists/actions';


interface AddEditBillPaymentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: () => void;
  vendors: User[];
  paymentMethods: ServicePaymentMethodItem[];
  reportToEdit?: BillReport | null;
}

export function AddEditBillPaymentDialog({ isOpen, onOpenChange, onSave, vendors, paymentMethods, reportToEdit }: AddEditBillPaymentDialogProps) {
  const [payment, setPayment] = useState('');
  const [method, setMethod] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const { toast } = useToast();

  const isEditMode = !!reportToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && reportToEdit) {
        setPayment(reportToEdit.payment.toString());
        setMethod(reportToEdit.method);
        setSelectedVendor(reportToEdit.vendorId);
        setSelectedDate(new Date(reportToEdit.date));
      } else {
        setPayment('');
        setMethod('');
        setSelectedVendor('');
        setSelectedDate(new Date());
      }
    }
  }, [isOpen, reportToEdit, isEditMode]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment || !method || !selectedVendor || !selectedDate) {
      toast({ title: "Validation Error", description: "All fields are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const reportData = {
      vendorId: selectedVendor,
      vendorName: vendors.find(v => v.id === selectedVendor)?.name || 'Unknown',
      date: selectedDate.toISOString(),
      invoiceId: isEditMode ? reportToEdit.invoiceId : `PAY-${Date.now()}`,
      amount: isEditMode ? reportToEdit.amount : 0,
      payment: parseFloat(payment),
      method,
    };

    let result;
    if (isEditMode && reportToEdit) {
      result = await updateBillReportAction(reportToEdit.id, reportData);
    } else {
      result = await addBillPaymentAction(reportData);
    }

    setIsSubmitting(false);

    if (result && result.success) {
      toast({ title: "Success", description: `Bill payment has been ${isEditMode ? 'updated' : 'added'}.` });
      onSave();
      onOpenChange(false);
    } else {
      const errorMessage = result?.error || "Failed to save payment.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add'} Bill Payment</DialogTitle>
          <DialogDescription>
            Record a payment made to a vendor.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="py-4 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="vendor">Vendor *</Label>
            <Select value={selectedVendor} onValueChange={setSelectedVendor} required disabled={isEditMode}>
              <SelectTrigger id="vendor" disabled={isEditMode}>
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
            <Label htmlFor="method">Method *</Label>
            <Select value={method} onValueChange={setMethod} required>
              <SelectTrigger id="method">
                <SelectValue placeholder="Select a method" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map(pm => (
                  <SelectItem key={pm.id} value={pm.name}>{pm.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="payment">Payment Amount *</Label>
            <Input id="payment" type="number" value={payment} onChange={e => setPayment(e.target.value)} required min="0.01" step="any" />
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddEditBillPaymentDialog;
