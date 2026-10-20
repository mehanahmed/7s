"use client";

import { PaymentProofField } from '@/components/common/PaymentProofField';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { User, CustomStatus, ServiceModelItem, ServiceLaminationItem, ServiceVariationItem, OrderItem, ServicePaymentMethodItem, AdvancePaymentRecord, TrackingLink } from "@/types";
import { useToast } from '@/hooks/use-toast';
import { createQuotationAction } from '@/app/(app)/quotation/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getGlobalSettings } from '@/lib/settings-service';
import { getModels, getLaminations, getPaymentMethods, getVariations } from '@/lib/service-options-service';
import { Loader2, PlusCircle, Trash2, ChevronsUpDown, Check, Info, Percent, CalendarDays, Gift } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { format, parseISO } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface CreateQuotationDialogProps {
  currentUser: User;
  availableStatuses: CustomStatus[];
  onQuotationCreated: (newQuotation: TrackingLink) => void;
  children: React.ReactNode;
  allQuotations: TrackingLink[];
}

interface DialogOrderItem {
  id: string;
  model: string;
  quantity: string;
  lamination: string;
  variation?: string;
  unit?: string;
  unitPrice: number | null;
  lineItemTotalPrice: number | null;
  isGift?: boolean;
}

const formatCurrencyBdt = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BDT' }).format(value);
};

const initialOrderItemState: DialogOrderItem = {
  id: uuidv4(),
  model: '',
  quantity: '1',
  lamination: '',
  unitPrice: null,
  lineItemTotalPrice: null,
  isGift: false,
};

/** Uploads a payment proof (image / PDF) and returns its URL. */
async function uploadPaymentProof(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body });
  const json = await res.json();
  if (!res.ok || !json.success || !json.file_url) throw new Error(json.message || 'File upload failed');
  return json.file_url as string;
}

export function CreateQuotationDialog({ currentUser, availableStatuses, onQuotationCreated, children, allQuotations }: CreateQuotationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [jobId, setJobId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [initialStatusId, setInitialStatusId] = useState<string>('');
  const [advancePaymentAmount, setAdvancePaymentAmount] = useState<string>('');
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<string>('');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [specialClientDiscount, setSpecialClientDiscount] = useState<string>('');
  const [showCustomPaymentInput, setShowCustomPaymentInput] = useState(false);
  const [customPaymentMethodText, setCustomPaymentMethodText] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoFilled, setIsAutoFilled] = useState(false);

  const [orderItems, setOrderItems] = useState<DialogOrderItem[]>([{ ...initialOrderItemState, id: uuidv4() }]);
  const [orderItemsTotal, setOrderItemsTotal] = useState<number>(0);
  const [calculatedDiscountAmount, setCalculatedDiscountAmount] = useState<number>(0);
  const [netPayable, setNetPayable] = useState<number>(0);
  const [amountDue, setAmountDue] = useState<number>(0);
  const [vatPercent, setVatPercent] = useState<number>(0);
  const vatAmount = Math.round(netPayable * vatPercent) / 100;

  const [modelOptions, setModelOptions] = useState<ServiceModelItem[]>([]);
  const [laminationOptions, setLaminationOptions] = useState<ServiceLaminationItem[]>([]);
  const [variationOptions, setVariationOptions] = useState<ServiceVariationItem[]>([]);
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<ServicePaymentMethodItem[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [popoverOpenStates, setPopoverOpenStates] = useState<Record<string, boolean>>({});
  const [isPaymentMethodPopoverOpen, setIsPaymentMethodPopoverOpen] = useState(false);
  const [currentOrderDate, setCurrentOrderDate] = useState<Date | undefined>(new Date());

  const { toast } = useToast();

  const resetForm = useCallback(() => {
    setJobId('');
    setCompanyName('');
    setAddress('');
    setPhoneNumber('');
    setInitialStatusId('');
    setAdvancePaymentAmount('');
    setAdvancePaymentMethod('');
    setPaymentProof(null);
    setSpecialClientDiscount('');
    setShowCustomPaymentInput(false);
    setCustomPaymentMethodText('');
    setOrderNotes('');
    setOrderItems([{ ...initialOrderItemState, id: uuidv4() }]);
    setPopoverOpenStates({});
    setIsPaymentMethodPopoverOpen(false);
    setOrderItemsTotal(0);
    setCalculatedDiscountAmount(0);
    setNetPayable(0);
    setAmountDue(0);
    setIsSubmitting(false);
    setCurrentOrderDate(new Date());
    setIsAutoFilled(false);
  }, []);

  const fetchOptions = useCallback(async () => {
    setIsLoadingOptions(true);
    try {
      const [fetchedModels, fetchedLaminations, fetchedVariations, fetchedPaymentMethods] = await Promise.all([
        getModels(),
        getLaminations(),
        getVariations(),
        getPaymentMethods(),
      ]);
      setModelOptions(fetchedModels);
      setLaminationOptions(fetchedLaminations);
      setVariationOptions(fetchedVariations);
      setPaymentMethodOptions(fetchedPaymentMethods);
      getGlobalSettings().then((g) => setVatPercent(Number(g.vatPercentage) || 0)).catch(() => setVatPercent(0));
    } catch (error) {
      console.error("Failed to fetch order options:", error);
      toast({ title: "Error", description: "Could not load order options.", variant: "destructive" });
    } finally {
      setIsLoadingOptions(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isOpen) {
      fetchOptions();
      setCurrentOrderDate(new Date());
      setJobId('');
    } else {
      resetForm();
    }
  }, [isOpen, fetchOptions, resetForm]);

  useEffect(() => {
    if (isOpen && availableStatuses.length > 0) {
      const isCurrentStatusInAvailable = initialStatusId && availableStatuses.some(s => s.id === initialStatusId);
      if (!initialStatusId || !isCurrentStatusInAvailable) {
        const orderSubmittedStatus = availableStatuses.find(s => s.id === "order-submitted");
        if (orderSubmittedStatus) {
          setInitialStatusId(orderSubmittedStatus.id);
        } else if (availableStatuses.length > 0 && availableStatuses[0]) {
          setInitialStatusId(availableStatuses[0].id);
        } else {
          setInitialStatusId('');
        }
      }
    } else if (isOpen && availableStatuses.length === 0) {
      setInitialStatusId('');
    }
  }, [isOpen, availableStatuses, initialStatusId]);

  useEffect(() => {
    const currentItemsTotal = orderItems.reduce((sum, item) => sum + (item.isGift ? 0 : (item.lineItemTotalPrice || 0)), 0);
    setOrderItemsTotal(currentItemsTotal);

    let discountNum = 0;
    const discountStr = specialClientDiscount.trim();
    if (discountStr.endsWith('%')) {
      const percentage = parseFloat(discountStr.substring(0, discountStr.length - 1));
      if (!isNaN(percentage) && percentage >= 0) {
        discountNum = (percentage / 100) * currentItemsTotal;
      }
    } else {
      const fixedAmount = parseFloat(discountStr);
      if (!isNaN(fixedAmount) && fixedAmount >= 0) {
        discountNum = fixedAmount;
      }
    }
    discountNum = Math.min(discountNum, currentItemsTotal);
    setCalculatedDiscountAmount(discountNum);

    const currentNetPayable = Math.max(0, currentItemsTotal - discountNum);
    setNetPayable(currentNetPayable);

    const advanceNum = parseFloat(advancePaymentAmount) || 0;
    const grandTotal = currentNetPayable + Math.round(currentNetPayable * vatPercent) / 100;
    setAmountDue(Math.max(0, grandTotal - advanceNum));
  }, [orderItems, specialClientDiscount, advancePaymentAmount, vatPercent]);

  const advancePaymentValue = parseFloat(advancePaymentAmount);
  const isAdvancePaymentEntered = !isNaN(advancePaymentValue) && advancePaymentValue > 0;

  useEffect(() => {
    if (!isAdvancePaymentEntered) {
      setAdvancePaymentMethod('');
      setCustomPaymentMethodText('');
      setShowCustomPaymentInput(false);
    }
  }, [isAdvancePaymentEntered]);

  const calculateLineItemTotal = (unitPrice: number | null, quantityStr: string, unitStr?: string): number | null => {
    if (unitPrice === null) return null;
    const quantity = parseInt(quantityStr, 10);
    if (isNaN(quantity) || quantity < 1) return null;
    let unitMultiplier = 1;
    if (unitStr) {
      const parsedUnit = parseFloat(unitStr);
      if (!isNaN(parsedUnit) && parsedUnit > 0) {
        unitMultiplier = parsedUnit;
      }
    }
    return unitPrice * quantity * unitMultiplier;
  };

  const handleItemChange = (itemId: string, field: keyof DialogOrderItem | 'modelName', value: string | number | null) => {
    setOrderItems(prevItems => prevItems.map(item => {
      if (item.id !== itemId) return item;
      const updatedItem = { ...item };
      if (field === 'modelName') updatedItem.model = modelOptions.find(opt => opt.name === value)?.name ?? '';
      else if (field === 'lamination') updatedItem.lamination = value as string;
      else if (field === 'quantity') updatedItem.quantity = value as string;
      else if (field === 'unitPrice') {
        const n = parseFloat(String(value));
        updatedItem.unitPrice = isNaN(n) || n < 0 ? null : n;
      }
      updatedItem.lineItemTotalPrice = calculateLineItemTotal(updatedItem.unitPrice, updatedItem.quantity);
      return updatedItem;
    }));
  };

  const handleJobIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newJobId = e.target.value;
    setJobId(newJobId);
    if (isAutoFilled && newJobId.trim() === '') {
      setIsAutoFilled(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      const trimmedJobId = jobId.trim();
      if (!trimmedJobId || !allQuotations.length) {
        if (isAutoFilled) {
          setCompanyName('');
          setAddress('');
          setPhoneNumber('');
          setIsAutoFilled(false);
        }
        return;
      }

      const existingQuotation = allQuotations.find(quotation => {
        const quotationJobId = (quotation.companyName || '').split(' • ')[0].trim();
        return quotationJobId.toLowerCase() === trimmedJobId.toLowerCase();
      });

      if (existingQuotation) {
        if (!isAutoFilled) {
          const nameParts = (existingQuotation.companyName || '').split(' • ');
          const actualCompanyName = nameParts.length > 1 ? nameParts.slice(1).join(' • ').trim() : existingQuotation.companyName;

          setCompanyName(actualCompanyName);
          setAddress(existingQuotation.address);
          setPhoneNumber(existingQuotation.phoneNumber);
          setIsAutoFilled(true);

          toast({
            title: "Existing Contact Person Found",
            description: `Details for "${trimmedJobId}" have been auto-filled.`,
          });
        }
      } else if (isAutoFilled) {
        setCompanyName('');
        setAddress('');
        setPhoneNumber('');
        setIsAutoFilled(false);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [jobId, allQuotations, toast, isAutoFilled]);

  const handleAddItem = () => {
    setOrderItems([...orderItems, { ...initialOrderItemState, id: uuidv4() }]);
  };

  const handleRemoveItem = (id: string) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter(item => item.id !== id));
    }
  };

  const lastTapRef = useRef<{ [key: string]: number }>({});

  const handleToggleGift = (itemId: string) => {
    setOrderItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId ? { ...item, isGift: !item.isGift } : item
      )
    );
  };

  const handleItemTouchEnd = (itemId: string, e: React.TouchEvent) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[itemId] || 0;
    if (now - lastTap < 350) {
      e.preventDefault();
      handleToggleGift(itemId);
      lastTapRef.current[itemId] = 0;
    } else {
      lastTapRef.current[itemId] = now;
    }
  };

  const togglePopover = (itemId: string, open?: boolean) => {
    setPopoverOpenStates(prev => ({ ...prev, [itemId]: open === undefined ? !prev[itemId] : open }));
  };

  const handleAdvancePaymentMethodChange = (value: string) => {
    setAdvancePaymentMethod(value);
    if (value.toLowerCase() === 'other') {
      setShowCustomPaymentInput(true);
      setCustomPaymentMethodText('');
    } else {
      setShowCustomPaymentInput(false);
      setCustomPaymentMethodText('');
    }
  };

  const handleAdvancePaymentAmountChange = (value: string) => {
    setAdvancePaymentAmount(value);
    const numericValue = parseFloat(value);
    const grandTotal = netPayable + vatAmount;
    if (!isNaN(numericValue) && numericValue > grandTotal && grandTotal > 0) {
      toast({
        title: "Validation Warning",
        description: `Advance payment cannot exceed grand total of ${formatCurrencyBdt(grandTotal)}.`,
        variant: "destructive",
      });
    }
  };

  const handleDiscountChange = (value: string) => {
    setSpecialClientDiscount(value);
    let discountVal = 0;
    const discountStr = value.trim();
    if (discountStr.endsWith('%')) {
      const percentage = parseFloat(discountStr.substring(0, discountStr.length - 1));
      if (!isNaN(percentage) && percentage >= 0) {
        discountVal = (percentage / 100) * orderItemsTotal;
      }
    } else {
      const fixedAmount = parseFloat(discountStr);
      if (!isNaN(fixedAmount) && fixedAmount >= 0) {
        discountVal = fixedAmount;
      }
    }

    if (discountVal > orderItemsTotal && orderItemsTotal > 0) {
      toast({
        title: "Validation Warning",
        description: `Special Client Discount cannot exceed total items price of ${formatCurrencyBdt(orderItemsTotal)}.`,
        variant: "destructive"
      });
    }
  };

  const canSubmit = useMemo(() => {
    const parsedAdvPayment = parseFloat(advancePaymentAmount) || 0;
    const grandTotal = netPayable + vatAmount;
    const isAdvPaymentValid = parsedAdvPayment <= grandTotal || grandTotal === 0;
    const isDiscountValid = calculatedDiscountAmount <= orderItemsTotal || orderItemsTotal === 0;

    return !isSubmitting &&
      jobId.trim() &&
      companyName.trim() && address.trim() && phoneNumber.trim() && initialStatusId && currentOrderDate &&
      (availableStatuses.length > 0 || !!initialStatusId) &&
      modelOptions.length > 0 &&
      !isLoadingOptions &&
      orderItems.length > 0 &&
      orderItems.every(item =>
        item.model &&
        item.quantity &&
        parseInt(item.quantity) > 0 &&
        item.unitPrice !== null &&
        item.lineItemTotalPrice !== null
      ) &&
      !(isAdvancePaymentEntered && !advancePaymentMethod.trim()) &&
      !(isAdvancePaymentEntered && advancePaymentMethod.toLowerCase() === 'other' && !customPaymentMethodText.trim()) &&
      isAdvPaymentValid && isDiscountValid;
  }, [isSubmitting, jobId, companyName, address, phoneNumber, initialStatusId, currentOrderDate, availableStatuses, modelOptions, laminationOptions, isLoadingOptions, orderItems, isAdvancePaymentEntered, advancePaymentMethod, customPaymentMethodText, advancePaymentAmount, netPayable, calculatedDiscountAmount, orderItemsTotal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!jobId.trim() || !companyName.trim() || !address.trim() || !phoneNumber.trim() || !initialStatusId || !currentOrderDate) {
      toast({ title: "Validation Error", description: "Contact Person, Company Name, Address, Phone Number, Quotation Date and Initial Status are required.", variant: "destructive" });
      setIsSubmitting(false); return;
    }
    if (orderItems.length === 0 || orderItems.some(item => !item.model || parseInt(item.quantity) < 1 || item.unitPrice === null || item.lineItemTotalPrice === null)) {
      toast({ title: "Validation Error", description: "All quotation items must be complete with Service, Quantity, Lamination, and valid pricing.", variant: "destructive" });
      setIsSubmitting(false); return;
    }

    const currentIsAdvancePaymentEnteredLogic = (parseFloat(advancePaymentAmount) || 0) > 0;
    let finalAdvancePaymentMethod = advancePaymentMethod.trim() || null;
    if (currentIsAdvancePaymentEnteredLogic) {
      if (!advancePaymentMethod.trim()) {
        toast({ title: "Validation Error", description: "Payment Method is required when Advance Payment is entered.", variant: "destructive" });
        setIsSubmitting(false); return;
      }
      if (advancePaymentMethod.toLowerCase() === 'other') {
        if (!customPaymentMethodText.trim()) {
          toast({ title: "Validation Error", description: "Please specify the 'Other' payment method.", variant: "destructive" });
          setIsSubmitting(false); return;
        }
        finalAdvancePaymentMethod = customPaymentMethodText.trim();
      }
    } else {
      finalAdvancePaymentMethod = null;
    }

    const parsedAdvPayment = parseFloat(advancePaymentAmount) || 0;
    const grandTotal = netPayable + vatAmount;

    if (parsedAdvPayment > grandTotal && grandTotal > 0) {
      toast({ title: "Validation Error", description: `Advance payment (${formatCurrencyBdt(parsedAdvPayment)}) cannot exceed grand total of ${formatCurrencyBdt(grandTotal)}.`, variant: "destructive" });
      setIsSubmitting(false); return;
    }
    if (calculatedDiscountAmount > orderItemsTotal && orderItemsTotal > 0) {
      toast({ title: "Validation Error", description: `Special Client Discount (${formatCurrencyBdt(calculatedDiscountAmount)}) cannot exceed total items price of ${formatCurrencyBdt(orderItemsTotal)}.`, variant: "destructive" });
      setIsSubmitting(false); return;
    }

    const parsedOrderItems: OrderItem[] = orderItems.map(item => ({
      id: item.id,
      model: item.model,
      quantity: parseInt(item.quantity, 10),
      lamination: item.lamination,
      variation: item.variation?.trim() || undefined,
      unit: item.unit?.trim() || undefined,
      unitPrice: item.unitPrice!,
      lineItemTotalPrice: item.lineItemTotalPrice!,
      isGift: item.isGift || false,
    }));

    let proofUrl: string | null = null;
    if (parsedAdvPayment > 0 && paymentProof) {
      try {
        proofUrl = await uploadPaymentProof(paymentProof);
      } catch (err) {
        toast({ title: "Payment Proof Upload Failed", description: err instanceof Error ? err.message : "Could not upload the proof.", variant: "destructive" });
        setIsSubmitting(false); return;
      }
    }

    const quotationDataForAction = {
      jobId: jobId.trim(),
      companyName: companyName.trim(),
      address: address.trim(),
      phoneNumber: phoneNumber.trim(),
      createdAt: currentOrderDate.toISOString(),
      orderItems: parsedOrderItems,
      advancePaymentAmount: parsedAdvPayment > 0 ? parsedAdvPayment : null,
      advancePaymentMethod: finalAdvancePaymentMethod,
      advancePaymentDocumentUrl: proofUrl,
      specialClientDiscount: calculatedDiscountAmount > 0 ? calculatedDiscountAmount : null,
      orderNotes: orderNotes.trim() || null,
      initialStatusId,
      crmUserId: currentUser.id,
      crmUserName: currentUser.name,
    };

    const result = await createQuotationAction(quotationDataForAction, currentUser);
    setIsSubmitting(false);

    if ('error' in result) {
      toast({ title: "Quotation Creation Failed", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Quotation Created", description: `Quotation ${result.id} for ${result.companyName} has been created.` });
      onQuotationCreated(result as TrackingLink);
      setIsOpen(false);
      resetForm();
    }
  };
  const giftTotal = orderItems.reduce((sum, item) => sum + (item.isGift ? (item.lineItemTotalPrice || 0) : 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="w-[95vw] sm:w-full max-w-[95vw] sm:max-w-lg md:max-w-xl lg:max-w-3xl xl:max-w-4xl max-h-[92vh] sm:max-h-[90vh] p-3.5 sm:p-6 overflow-hidden flex flex-col">
        <DialogHeader className="pb-1 sm:pb-2 pr-8 sm:pr-0">
          <DialogTitle className="text-base sm:text-lg">Create New Quotation</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">Enter company details and add quotation items. Required fields are marked with a visual hint.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden w-full max-w-full min-w-0">
          <div className="grid gap-3 sm:gap-4 py-2 sm:py-4 max-h-[68vh] sm:max-h-[70vh] overflow-y-auto overflow-x-hidden w-full max-w-full min-w-0 pr-1 sm:pr-2 custom-scrollbar">
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 w-full min-w-0">
              <div className="space-y-1 min-w-0">
                <Label htmlFor="jobId" className="text-xs sm:text-sm truncate block">Contact Person</Label>
                <Input id="jobId" value={jobId} onChange={handleJobIdChange} required placeholder="e.g., Mr. Awal" className="w-full text-xs sm:text-sm h-9" />
              </div>
              <div className="space-y-1 min-w-0">
                <Label htmlFor="companyName" className="text-xs sm:text-sm truncate block">Company Name</Label>
                <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required placeholder="e.g., Seven Solution" readOnly={isAutoFilled} className={cn("w-full text-xs sm:text-sm h-9", isAutoFilled && "bg-muted/50 cursor-not-allowed")} />
              </div>
            </div>
            <div className="space-y-1 min-w-0">
              <Label htmlFor="address" className="text-xs sm:text-sm">Address</Label>
              <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} required readOnly={isAutoFilled} className={cn("w-full text-xs sm:text-sm min-h-[60px]", isAutoFilled && "bg-muted/50 cursor-not-allowed")} />
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 w-full min-w-0">
              <div className="space-y-1 min-w-0">
                <Label htmlFor="phoneNumber" className="text-xs sm:text-sm h-5 flex items-center truncate">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    const numericValue = e.target.value.replace(/[^0-9]/g, '');
                    if (numericValue.length <= 11) {
                      setPhoneNumber(numericValue);
                    }
                  }}
                  required
                  pattern="0\d{10}"
                  maxLength={11}
                  title="Phone number must be an 11-digit number starting with 0."
                  placeholder="01xxxxxxxxx"
                  readOnly={isAutoFilled}
                  className={cn("w-full text-xs sm:text-sm h-9", isAutoFilled && "bg-muted/50 cursor-not-allowed")}
                />
              </div>
              <div className="space-y-1 min-w-0">
                <Label htmlFor="orderDate" className="text-xs sm:text-sm h-5 flex items-center truncate">Quotation Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal min-w-0 text-xs sm:text-sm h-9 px-2.5",
                        !currentOrderDate && "text-muted-foreground"
                      )}
                      disabled={isSubmitting}
                    >
                      <CalendarDays className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{currentOrderDate ? format(currentOrderDate, "PP") : "Pick a date"}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={currentOrderDate}
                      onSelect={setCurrentOrderDate}
                      initialFocus
                      disabled={isSubmitting}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-1 min-w-0">
              <Label htmlFor="orderNotes">Notes (Optional)</Label>
              <Textarea
                id="orderNotes"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Add any specific instructions or requirements..."
                rows={3}
                className="w-full"
              />
            </div>

            <div className="space-y-3 mt-3 sm:mt-4 border-t border-border pt-3 sm:pt-4 w-full min-w-0">
              <Label className="text-base sm:text-lg font-semibold">Quotation Items</Label>
              <div className="w-full max-w-full overflow-x-auto rounded-md border bg-background custom-scrollbar">
                <Table className="w-full min-w-[620px] table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Service *</TableHead>
                      <TableHead className="w-[15%]">Quantity *</TableHead>
                      <TableHead className="w-[20%]">Unit Price *</TableHead>
                      <TableHead className="w-[20%] text-right pr-4">Total Price</TableHead>
                      <TableHead className="w-[5%] text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.map((item) => (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="p-2 align-middle">
                          <div className="flex items-center gap-1.5">
                            <Popover open={popoverOpenStates[item.id] || false} onOpenChange={(open) => togglePopover(item.id, open)} modal={true}>
                              <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" aria-expanded={popoverOpenStates[item.id] || false} className="flex-1 min-w-0 justify-between bg-card text-sm" disabled={isLoadingOptions || modelOptions.length === 0}>
                                  <span className="flex items-center gap-1.5 flex-1 text-left whitespace-nowrap overflow-hidden">
                                    {item.model && modelOptions.find((option) => option.name === item.model)?.imageUrl ? (
                                      <Avatar className="h-4 w-4 rounded-sm shrink-0">
                                        <AvatarImage src={modelOptions.find((option) => option.name === item.model)?.imageUrl || undefined} alt={item.model} />
                                        <AvatarFallback className="rounded-sm bg-muted text-xs">IMG</AvatarFallback>
                                      </Avatar>
                                    ) : null}
                                    <span className="truncate">
                                      {item.model ? modelOptions.find((option) => option.name === item.model)?.name : (isLoadingOptions ? "Loading..." : (modelOptions.length === 0 ? "No services" : "Select service..."))}
                                    </span>
                                  </span>
                                  <ChevronsUpDown className="ml-1.5 h-3 w-3 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="min-w-[var(--radix-popover-trigger-width)] w-[90vw] sm:w-max max-w-lg p-0 z-[60]" align="start" side="bottom" sideOffset={4}>
                                <Command className="max-h-96 overflow-hidden flex flex-col">
                                  <CommandInput placeholder="Search service..." />
                                  <CommandList className="max-h-80 overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                                    <CommandEmpty>No service found.</CommandEmpty>
                                    <CommandGroup>
                                      {modelOptions.map((option) => (
                                        <CommandItem key={option.id} value={option.name} onSelect={(currentValue) => { handleItemChange(item.id, 'modelName', currentValue === item.model ? '' : currentValue); togglePopover(item.id, false); }} className="flex items-center gap-2">
                                          <Check className={cn("h-4 w-4 shrink-0", item.model === option.name ? "opacity-100" : "opacity-0")} />
                                          <Avatar className="h-8 w-8 rounded-sm shrink-0">
                                            <AvatarImage src={option.imageUrl || undefined} alt={option.name} data-ai-hint="product photo" />
                                            <AvatarFallback className="rounded-sm bg-muted text-xs">IMG</AvatarFallback>
                                          </Avatar>
                                          <span className="flex-1 truncate">{option.name}</span>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>

                          </div>
                        </TableCell>
                        <TableCell className="p-2 align-middle">
                          <Input id={`quantity-${item.id}`} type="number" value={item.quantity} onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)} placeholder="e.g., 100" min="1" required className="bg-card text-sm h-9" />
                        </TableCell>
                        <TableCell className="p-2 align-middle">
                          <Input type="number" min="0" step="0.01" value={item.unitPrice ?? ''} onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)} placeholder="0.00" required disabled={isSubmitting} className="bg-card text-sm h-9" />
                        </TableCell>
                        <TableCell 
                          className="p-2 align-middle text-right pr-4 font-semibold text-sm whitespace-nowrap cursor-pointer select-none"
                          onDoubleClick={() => handleToggleGift(item.id)}
                          onTouchEnd={(e) => handleItemTouchEnd(item.id, e)}
                        >
                          <span style={item.isGift ? { textDecoration: 'line-through', textDecorationColor: '#ef4444', color: '#6b7280' } : undefined}>
                            {formatCurrencyBdt(item.lineItemTotalPrice)}
                          </span>
                          {item.isGift && " (Gift)"}
                        </TableCell>
                        <TableCell className="p-2 align-middle text-right">
                          <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} disabled={isSubmitting || orderItems.length <= 1} className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive-foreground" title="Remove item"><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {(isLoadingOptions && (orderItems.length === 0 || (modelOptions.length === 0 || paymentMethodOptions.length === 0))) &&
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading order options...
                </div>
              }
              <Button type="button" variant="outline" onClick={handleAddItem} className="mt-2" disabled={isSubmitting || isLoadingOptions}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Another Item
              </Button>
            </div>

            <Separator className="my-3 sm:my-4" />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 items-start">
              <div className="space-y-1">
                <Label htmlFor="specialClientDiscount">Special Client Discount</Label>
                <div className="relative">
                  <Input
                    id="specialClientDiscount"
                    type="text"
                    value={specialClientDiscount}
                    onChange={(e) => handleDiscountChange(e.target.value)}
                    placeholder="e.g., 100 or 10%"
                    disabled={isSubmitting}
                    className="pl-7"
                  />
                  <Percent className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="advancePaymentAmount">Advance Payment (Optional)</Label>
                <Input
                  id="advancePaymentAmount"
                  type="number"
                  value={advancePaymentAmount}
                  onChange={(e) => handleAdvancePaymentAmountChange(e.target.value)}
                  placeholder="Amount (BDT)"
                  min="0"
                  step="0.01"
                />
              </div>

              {isAdvancePaymentEntered && (
                <div className="space-y-1">
                  <Label htmlFor="advancePaymentMethod">Payment Method <span className="text-destructive">*</span></Label>
                  <Popover open={isPaymentMethodPopoverOpen} onOpenChange={setIsPaymentMethodPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between bg-background"
                        disabled={isLoadingOptions || paymentMethodOptions.length === 0}
                      >
                        <span className="flex-1 text-left whitespace-nowrap">
                          {advancePaymentMethod
                            ? paymentMethodOptions.find(opt => opt.name === advancePaymentMethod)?.name || advancePaymentMethod
                            : (isLoadingOptions ? "Loading..." : (paymentMethodOptions.length === 0 ? "No methods" : "Select method..."))}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="min-w-[var(--radix-popover-trigger-width)] w-max max-w-md p-0">
                      <Command>
                        <CommandInput placeholder="Search method..." />
                        <CommandList>
                          <CommandEmpty>No method found.</CommandEmpty>
                          <CommandGroup>
                            {paymentMethodOptions.map((opt) => (
                              <CommandItem
                                key={opt.id}
                                value={opt.name}
                                onSelect={(val) => {
                                  handleAdvancePaymentMethodChange(paymentMethodOptions.find(o => o.name.toLowerCase() === val.toLowerCase())?.name || val);
                                  setIsPaymentMethodPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    advancePaymentMethod === opt.name ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="whitespace-nowrap">{opt.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {showCustomPaymentInput && (
                    <div className="mt-2 space-y-1">
                      <Label htmlFor="customPaymentText">Specify Other Method <span className="text-destructive">*</span></Label>
                      <Input
                        id="customPaymentText"
                        value={customPaymentMethodText}
                        onChange={(e) => setCustomPaymentMethodText(e.target.value)}
                        placeholder="e.g., City Bank Transfer"
                        required={advancePaymentMethod.toLowerCase() === 'other'}
                      />
                    </div>
                  )}
                </div>
              )}
              {isAdvancePaymentEntered && (
                <PaymentProofField file={paymentProof} onChange={setPaymentProof} disabled={isSubmitting} />
              )}
            </div>

            <div className="mt-3 sm:mt-4 p-3 sm:p-4 border rounded-md bg-muted/30 space-y-2">
              <h4 className="text-sm sm:text-md font-semibold text-foreground mb-2">Quotation Summary</h4>
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">Items Total:</span>
                <span className="font-medium text-foreground">{formatCurrencyBdt(orderItemsTotal)}</span>
              </div>
              {giftTotal > 0 && (
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground flex items-center">
                    <Gift className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 text-yellow-500" />
                    Gift Value:
                  </span>
                  <span className="font-medium text-yellow-500">{formatCurrencyBdt(giftTotal)}</span>
                </div>
              )}
              {(calculatedDiscountAmount || 0) > 0 && (
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Discount:</span>
                  <span className="font-medium text-red-600">- {formatCurrencyBdt(calculatedDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs sm:text-sm font-semibold">
                <span className="text-foreground">Net Payable:</span>
                <span className="text-foreground">{formatCurrencyBdt(netPayable)}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">VAT ({vatPercent}%):</span>
                <span className="font-medium text-foreground">+ {formatCurrencyBdt(vatAmount)}</span>
              </div>
              {isAdvancePaymentEntered && (
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Advance Paid:</span>
                  <span className="font-medium text-green-600">- {formatCurrencyBdt(parseFloat(advancePaymentAmount))}</span>
                </div>
              )}
              <div className="flex justify-between text-base sm:text-lg font-bold mt-1 pt-1 border-t border-border">
                <span className="text-primary">Amount Due:</span>
                <span className="text-primary">{formatCurrencyBdt(amountDue)}</span>
              </div>
            </div>

          </div>
          <DialogFooter className="pt-3 sm:pt-4 border-t flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => { setIsOpen(false); }} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Quotation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
