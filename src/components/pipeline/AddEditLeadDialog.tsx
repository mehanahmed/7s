
"use client";

import React, { useState, useEffect, useRef } from 'react';
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
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Lead, User, LeadCategory, LeadStatusType } from '@/types';
import { LEAD_CATEGORY_LABELS } from '@/lib/pipeline-constants';
import { useToast } from '@/hooks/use-toast';
import { addLeadAction, updateLeadAction, getLeadByPhoneAction } from '@/app/(app)/pipeline/actions';
import { Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { format, parseISO } from "date-fns";
import { cn } from '@/lib/utils';
import { divisions } from '@/lib/district-data';
import { LEAD_TEMPERATURES } from '@/lib/pipeline-constants';
import { TemperatureGauge } from './TemperatureGauge';

interface AddEditLeadDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onLeadSaved: (savedLead?: Lead, isEdit?: boolean) => void;
  lead?: Lead | null;
  currentUser: User;
}

const LEAD_SOURCES =["Facebook", "WhatsApp", "Office Visit", "Phone Call", "Others"];

export function AddEditLeadDialog({ isOpen, onOpenChange, onLeadSaved, lead, currentUser }: AddEditLeadDialogProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [schedule, setSchedule] = useState<Date | undefined>();
  const [contactName, setContactName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [source, setSource] = useState('');
  const [division, setDivision] = useState('');
  const [district, setDistrict] = useState('');
  const [thana, setThana] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<LeadCategory | ''>('');
  const [temperature, setTemperature] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [isSchedulePopoverOpen, setIsSchedulePopoverOpen] = useState(false);
  const [foundExistingLead, setFoundExistingLead] = useState<Lead | null>(null);
  const { toast } = useToast();
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!lead;

  const validatePhone = (phoneNumber: string) => {
    if (phoneNumber.length > 0) {
      if (phoneNumber.startsWith('0')) {
        if (phoneNumber.length !== 11) {
          setPhoneError("Local phone number must be exactly 11 digits.");
        } else {
          setPhoneError(null);
        }
      } else if (phoneNumber.startsWith('+')) {
        if (phoneNumber.length < 10 || phoneNumber.length > 15) {
          setPhoneError("International phone number must be between 10 and 15 characters.");
        } else {
          setPhoneError(null);
        }
      } else {
        setPhoneError("Phone number must start with 0 or +.");
      }
    } else {
      setPhoneError(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsDatePopoverOpen(false);
      setIsSchedulePopoverOpen(false);
      setFoundExistingLead(null);
      if (isEditMode && lead) {
        setDate(parseISO(lead.date));
        setSchedule(lead.schedule ? parseISO(lead.schedule) : undefined);
        setContactName(lead.contactName);
        setBusinessName(lead.businessName);
        setPhone(lead.phone);
        setSource(lead.source);
        setDivision(lead.division || '');
        setDistrict(lead.district || '');
        setThana(lead.thana || '');
        setNotes(lead.notes || '');
        setCategory(lead.category || '');
        setTemperature(lead.temperature != null ? String(lead.temperature) : '');
        setPhoneError(null);
      } else {
        // Reset for add mode
        setDate(new Date());
        setSchedule(undefined);
        setContactName('');
        setBusinessName('');
        setPhone('');
        setSource('');
        setDivision('');
        setDistrict('');
        setThana('');
        setNotes('');
        setCategory('');
        setTemperature('');
        setPhoneError(null);
      }
      setTimeout(() => {
        phoneInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, lead, isEditMode]);

  useEffect(() => {
    if (isEditMode) return;

    const checkPhoneAndAutofill = async () => {
      const isLocal = phone.startsWith('0') && phone.length === 11;
      const isIntl = phone.startsWith('+') && phone.length >= 10 && phone.length <= 15;
      
      if (isLocal || isIntl) {
        try {
          const existingLead = await getLeadByPhoneAction(phone);
          if (existingLead) {
            setFoundExistingLead(existingLead);
            setContactName(existingLead.contactName || '');
            setBusinessName(existingLead.businessName || '');
            setDivision(existingLead.division || '');
            setTimeout(() => {
              setDistrict(existingLead.district || '');
              setThana(existingLead.thana || '');
            }, 100);
          } else {
            setFoundExistingLead(null);
          }
        } catch (error) {
          console.error("Error checking phone and autofilling:", error);
          setFoundExistingLead(null);
        }
      } else {
        setFoundExistingLead(null);
      }
    };

    checkPhoneAndAutofill();
  }, [phone, isEditMode, toast]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Allow '+' at the beginning, then only digits
    if (value.startsWith('+')) {
      value = '+' + value.slice(1).replace(/[^0-9]/g, '');
    } else {
      value = value.replace(/[^0-9]/g, '');
    }

    const maxLen = value.startsWith('+') ? 15 : 11;
    if (value.length <= maxLen) {
        setPhone(value);
        validatePhone(value);
    }
  };

  const handleDivisionChange = (value: string) => {
    setDivision(value);
    setDistrict(''); // Reset district when division changes
  };

  const districtOptions = division ? divisions.find(d => d.division === division)?.districts || [] : [];


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    validatePhone(phone);
    if (phoneError) {
        toast({ title: "Validation Error", description: phoneError, variant: "destructive" });
        return;
    }

    if (!date || !contactName || !businessName || !phone || !source || !division || !district || !thana || !category) {
      toast({ title: "Validation Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    const phoneRegex = /^(0\d{10}|\+\d{9,14})$/;
    if (!phoneRegex.test(phone)) {
      toast({
        title: "Validation Error",
        description: "Invalid phone number. Use 11 digits starting with 0, or an international number starting with +.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    const addressParts = [];
    if (thana) addressParts.push(thana.trim());
    // Only add district if it's different from the division
    if (district && district.trim().toLowerCase() !== division.trim().toLowerCase()) {
      addressParts.push(district.trim());
    }
    if (division) {
      addressParts.push(division.trim());
    }
    const combinedAddress = addressParts.filter(Boolean).join(', ');

    const leadData: Omit<Lead, 'id' | 'crmId' | 'crmName' | 'activityHistory' | 'category' | 'status' | 'updatedAt'> & { category?: LeadCategory, status?: LeadStatusType } = {
      date: date.toISOString(),
      schedule: schedule ? schedule.toISOString() : null,
      contactName, businessName, phone, source, 
      address: combinedAddress,
      division: division || null,
      district: district || null,
      thana: thana || null,
      notes: notes || null,
      category: category || undefined,
      temperature: temperature === '' ? null : Number(temperature) as Lead['temperature'],
    };
    
    let result;
    const targetLead = isEditMode ? lead : foundExistingLead;
    if (targetLead) {
      const updateData = {
        ...leadData,
        crmId: currentUser.id,
        crmName: currentUser.name,
      };
      result = await updateLeadAction(targetLead.id, updateData, currentUser);
      if (result.success && result.lead) {
        onLeadSaved(result.lead, true);
      }
    } else {
        const createData: Omit<Lead, 'id' | 'crmId' | 'crmName' | 'activityHistory' | 'category' | 'status' | 'updatedAt'> & { category?: LeadCategory, status?: LeadStatusType } = leadData;
        result = await addLeadAction(createData, currentUser);
        if (result.success && result.lead) {
            onLeadSaved(result.lead, false);
        }
    }
    
    setIsSubmitting(false);

    if (result.success) {
      toast({ title: `Lead ${isEditMode || foundExistingLead ? 'Updated' : 'Added'}`, description: `Lead for "${contactName}" has been saved.` });
    } else {
      toast({ title: "Error", description: result.error || `Could not ${isEditMode || foundExistingLead ? 'update' : 'add'} lead.`, variant: "destructive" });
    }
  };

  const isFormInvalid = 
    !date || 
    !contactName.trim() || 
    !businessName.trim() || 
    !phone.trim() || 
    !source || 
    !division || 
    !district || 
    !thana.trim() || 
    !category || 
    !!phoneError;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? `Update details for the lead: ${lead.contactName}` : 'Enter the details for the new sales lead.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-1 py-2 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_0.9fr] gap-1">
              <div className="space-y-0.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                    id="phone"
                    ref={phoneInputRef}
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    required
                    maxLength={15}
                    placeholder="01xxxxxxxxx or +xxxxxxxxxx"
                    className={cn(phoneError && "border-destructive focus-visible:ring-destructive")}
                />
                {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="source">Source</Label>
                <Select value={source} onValueChange={setSource} required>
                  <SelectTrigger id="source">
                    <SelectValue placeholder="Select a source" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_0.9fr] gap-1">
              <div className="space-y-0.5">
                <Label htmlFor="contactName">Contact Name</Label>
                <Input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} required />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as LeadCategory)} required>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LEAD_CATEGORY_LABELS) as LeadCategory[]).map((key) => (
                      <SelectItem key={key} value={key}>{LEAD_CATEGORY_LABELS[key]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_0.9fr] gap-1">
              <div className="space-y-0.5">
                <Label htmlFor="businessName">Business Name</Label>
                <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required placeholder="e.g., Seven Solution"/>
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="temperature">Temperature</Label>
                <Select value={temperature} onValueChange={setTemperature}>
                  <SelectTrigger id="temperature">
                    <SelectValue placeholder="Select temperature" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_TEMPERATURES.map(t => (
                      <SelectItem key={t} value={String(t)}>
                        <span className="flex items-center gap-2">
                          <TemperatureGauge value={t} />
                          {t}%
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              <div className="space-y-0.5">
                <Label htmlFor="date">Date</Label>
                <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar 
                      mode="single" 
                      selected={date} 
                      onSelect={(newDate) => {
                        setDate(newDate);
                        setIsDatePopoverOpen(false);
                      }} 
                      initialFocus 
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="schedule">Schedule (Optional)</Label>
                <Popover open={isSchedulePopoverOpen} onOpenChange={setIsSchedulePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {schedule ? format(schedule, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={schedule}
                      onSelect={(newDate) => {
                        setSchedule(newDate);
                        setIsSchedulePopoverOpen(false);
                      }}
                      disabled={{ before: new Date() }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                <div className="space-y-0.5">
                    <Label htmlFor="division">Division</Label>
                    <Select value={division} onValueChange={handleDivisionChange}>
                        <SelectTrigger id="division"><SelectValue placeholder="Select Division" /></SelectTrigger>
                        <SelectContent>
                            {divisions.map(d => <SelectItem key={d.division} value={d.division}>{d.division}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-0.5">
                    <Label htmlFor="district">District</Label>
                    <Select value={district} onValueChange={setDistrict} disabled={!division}>
                        <SelectTrigger id="district"><SelectValue placeholder="Select District" /></SelectTrigger>
                        <SelectContent>
                            {districtOptions.map(d => <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-0.5">
                    <Label htmlFor="thana">Thana</Label>
                    <Input id="thana" value={thana} onChange={(e) => setThana(e.target.value)} placeholder="Enter Thana/Upazila" required/>
                </div>
            </div>
            <div className="space-y-0.5">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || isFormInvalid}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : (isEditMode || foundExistingLead ? 'Save Changes' : 'Add Lead')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
