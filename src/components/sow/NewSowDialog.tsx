
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { User, TrackingLink } from "@/types";
import { useToast } from '@/hooks/use-toast';
import { addSowEntryAction } from '@/app/(app)/crm/sow/actions';
import { Loader2, ChevronsUpDown, Check, X, Calendar as CalendarIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';


interface NewSowDialogProps {
  currentUser: User;
  onSowCreated: () => void;
  children: React.ReactNode;
  allOrders: TrackingLink[];
  reportProductFilters: string[];
}

export function NewSowDialog({ currentUser, onSowCreated, children, allOrders, reportProductFilters }: NewSowDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [jobId, setJobId] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState('');
  const [orderDate, setOrderDate] = useState<Date | undefined>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = useState(false);


  const { toast } = useToast();
  
  const validatePhone = (number: string) => {
    if (!number) {
        setPhoneError("Phone number is required.");
        return;
    }
    const phoneRegex = /^0\d{10}$/;
    if (!phoneRegex.test(number)) {
        if (!number.startsWith('0')) {
            setPhoneError("Phone number must start with 0.");
        } else if (number.length !== 11) {
            setPhoneError("Phone number must be exactly 11 digits.");
        } else {
            setPhoneError("Invalid phone number format.");
        }
    } else {
        setPhoneError(null);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = e.target.value.replace(/[^0-9]/g, '');
    if (numericValue.length <= 11) {
      setPhoneNumber(numericValue);
      validatePhone(numericValue);
    }
  };

  const resetForm = useCallback(() => {
    setJobId('');
    setBusinessName('');
    setAddress('');
    setPhoneNumber('');
    setPhoneError(null);
    setAmount('');
    setSelectedCategories([]);
    setCustomCategory('');
    setOrderDate(new Date());
    setIsSubmitting(false);
    setIsAutoFilled(false);
    setIsCategoryPopoverOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);
  
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
      if (!trimmedJobId || !allOrders.length) {
        if(isAutoFilled) {
          setBusinessName('');
          setAddress('');
          setPhoneNumber('');
          setPhoneError(null);
          setIsAutoFilled(false);
        }
        return;
      }

      const existingOrder = allOrders.find(order => {
        const orderJobId = (order.companyName || '').split(' • ')[0].trim();
        return orderJobId.toLowerCase() === trimmedJobId.toLowerCase();
      });

      if (existingOrder) {
        if (!isAutoFilled) {
            const nameParts = (existingOrder.companyName || '').split(' • ');
            const actualBusinessName = nameParts.length > 1 ? nameParts.slice(1).join(' • ').trim() : existingOrder.companyName;

            setBusinessName(actualBusinessName);
            setAddress(existingOrder.address);
            setPhoneNumber(existingOrder.phoneNumber);
            validatePhone(existingOrder.phoneNumber);
            setIsAutoFilled(true);

            toast({
              title: "Existing Client ID Found",
              description: `Details for "${trimmedJobId}" have been auto-filled.`,
            });
        }
      } else if (isAutoFilled) {
        setBusinessName('');
        setAddress('');
        setPhoneNumber('');
        setPhoneError(null);
        setIsAutoFilled(false);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [jobId, allOrders, toast, isAutoFilled]);

  const handleCategoryToggle = (categoryToToggle: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryToToggle)
        ? prev.filter(c => c !== categoryToToggle)
        : [...prev, categoryToToggle]
    );
  };
  
  const handleAddCustomCategory = () => {
    const trimmedCategory = customCategory.trim();
    if (trimmedCategory && !selectedCategories.some(c => c.toLowerCase() === trimmedCategory.toLowerCase())) {
        setSelectedCategories(prev => [...prev, trimmedCategory]);
        setCustomCategory('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    validatePhone(phoneNumber);
    if (phoneError) {
        toast({ title: "Validation Error", description: phoneError, variant: "destructive" });
        return;
    }
    
    setIsSubmitting(true);
    
    const finalCategory = selectedCategories.join(', ');
    const numericAmount = parseFloat(amount);

    if (!jobId || !businessName || !address || !phoneNumber || !finalCategory || isNaN(numericAmount) || !orderDate) {
      toast({ title: "Validation Error", description: "All fields are required, and at least one category must be selected.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const sowData = {
      jobId,
      businessName,
      address,
      phoneNumber,
      amount: numericAmount,
      category: finalCategory,
      createdAt: orderDate.toISOString(),
    };

    const result = await addSowEntryAction(sowData, currentUser);
    setIsSubmitting(false);

    if (result.success) {
      toast({ title: "SOW Entry Created", description: `A new entry for ${businessName} has been added.` });
      onSowCreated();
      setIsOpen(false);
    } else {
      toast({ title: "SOW Creation Failed", description: result.error, variant: "destructive" });
    }
  };

  const canSubmit = useMemo(() => {
    const isAmountValid = !isNaN(parseFloat(amount)) && parseFloat(amount) > 0;
    
    return !isSubmitting &&
      jobId.trim() !== '' &&
      businessName.trim() !== '' &&
      address.trim() !== '' &&
      phoneNumber.trim() !== '' &&
      !phoneError &&
      amount.trim() !== '' &&
      isAmountValid &&
      selectedCategories.length > 0 &&
      !!orderDate;
  }, [
    isSubmitting,
    jobId,
    businessName,
    address,
    phoneNumber,
    phoneError,
    amount,
    selectedCategories,
    orderDate
  ]);


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New SOW Entry</DialogTitle>
          <DialogDescription>Manually create a new entry for the Statement of Work report.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="sow-jobId">Client ID *</Label>
                <Input id="sow-jobId" value={jobId} onChange={handleJobIdChange} required placeholder="e.g., CUST101" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sow-businessName">Business Name *</Label>
                <Input id="sow-businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required placeholder="e.g., Acme Restaurant" disabled={isAutoFilled}/>
              </div>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="sow-address">Address *</Label>
              <Input id="sow-address" value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="e.g., 123 Main St, Anytown" disabled={isAutoFilled}/>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="space-y-1">
                <Label htmlFor="sow-phoneNumber">Phone Number *</Label>
                <Input
                  id="sow-phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  required
                  maxLength={11}
                  placeholder="01xxxxxxxxx"
                  disabled={isAutoFilled}
                  className={cn(phoneError && "border-destructive focus-visible:ring-destructive")}
                />
                {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="sow-orderDate">Order Date *</Label>
                 <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal", !orderDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {orderDate ? format(orderDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={orderDate}
                        onSelect={setOrderDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
               <div className="space-y-2">
                  <Label htmlFor="sow-category">Categories *</Label>
                  {selectedCategories.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/50 min-h-[40px]">
                          {selectedCategories.map(cat => (
                              <Badge key={cat} variant="secondary" className="gap-1.5 py-1 text-sm">
                                  {cat}
                                  <button type="button" onClick={() => handleCategoryToggle(cat)} className="rounded-full hover:bg-destructive/20 p-0.5 transition-colors">
                                      <X className="h-3 w-3 text-destructive" />
                                  </button>
                              </Badge>
                          ))}
                      </div>
                  )}
                  <Popover open={isCategoryPopoverOpen} onOpenChange={setIsCategoryPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isCategoryPopoverOpen}
                      className="w-full justify-between"
                    >
                      {selectedCategories.length > 0 ? "Select more..." : "Select categories..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Search category..." />
                      <CommandList>
                        <CommandEmpty>No category found.</CommandEmpty>
                        <CommandGroup>
                          {reportProductFilters.map((filter) => (
                            <CommandItem
                              key={filter}
                              value={filter}
                              onSelect={() => handleCategoryToggle(filter)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCategories.includes(filter) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {filter}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sow-amount">Total Amount *</Label>
                <Input id="sow-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="e.g., 5000.00" />
              </div>
            </div>

             <div className="space-y-1">
                <Label htmlFor="sow-custom-category">Add Custom Category</Label>
                <div className="flex items-center gap-2">
                    <Input
                        id="sow-custom-category"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="Type a new category and click Add"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomCategory(); }}}
                    />
                    <Button type="button" onClick={handleAddCustomCategory}>Add</Button>
                </div>
            </div>

            <DialogFooter className="pt-4 sticky bottom-0 bg-background py-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={!canSubmit}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Creating...' : 'Create Entry'}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
