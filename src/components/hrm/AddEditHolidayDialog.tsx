
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
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Holiday {
    id: string;
    title: string;
    date: string;
}

interface AddEditHolidayDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onHolidaySaved: () => void;
  holiday?: Holiday | null;
}

export function AddEditHolidayDialog({ isOpen, onOpenChange, onHolidaySaved, holiday }: AddEditHolidayDialogProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const isEditMode = !!holiday;

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && holiday) {
        setTitle(holiday.title);
        setDate(new Date(holiday.date));
      } else {
        setTitle('');
        setDate(new Date());
      }
    }
  }, [isOpen, holiday, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) {
      toast({
        title: "Validation Error",
        description: "Title and date are required.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    // In a real app, you would call a server action here, e.g.:
    // const result = isEditMode 
    //   ? await updateHolidayAction(holiday.id, { title, date: date.toISOString() })
    //   : await addHolidayAction({ title, date: date.toISOString() });
    
    // Simulating API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSubmitting(false);

    // Assuming the action was successful
    toast({
        title: `Holiday ${isEditMode ? 'Updated' : 'Added'}`,
        description: `The holiday "${title}" has been saved.`
    });
    onHolidaySaved();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add New'} Holiday</DialogTitle>
          <DialogDescription>
            {isEditMode ? `Update the details for the "${holiday?.title}" holiday.` : 'Enter the details for a new company holiday.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="py-4 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="holiday-title">Title *</Label>
            <Input 
              id="holiday-title" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              required 
              placeholder="e.g., Independence Day"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="holiday-date">Date *</Label>
             <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
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
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Saving...' : 'Save Holiday'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddEditHolidayDialog;
