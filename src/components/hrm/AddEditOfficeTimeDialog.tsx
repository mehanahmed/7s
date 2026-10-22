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
import { Loader2, ChevronsUpDown, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addOfficeTimeAction, updateOfficeTimeAction } from '@/app/(app)/hrm/attendance/actions';
import type { OfficeTime, UserRole, UserRoleDefinition } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface AddEditOfficeTimeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onOfficeTimeSaved: () => void;
  officeTime?: OfficeTime | null;
  availableRoles: UserRoleDefinition[];
}

export function AddEditOfficeTimeDialog({ isOpen, onOpenChange, onOfficeTimeSaved, officeTime, availableRoles }: AddEditOfficeTimeDialogProps) {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [graceTime, setGraceTime] = useState('');
  const [shift, setShift] = useState<'Day' | 'Night'>('Day');
  const [applicableRoles, setApplicableRoles] = useState<UserRole[] | 'all'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRolePopoverOpen, setIsRolePopoverOpen] = useState(false);
  const { toast } = useToast();

  const isEditMode = !!officeTime;

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && officeTime) {
        setName(officeTime.name);
        setStartTime(officeTime.startTime);
        setEndTime(officeTime.endTime);
        setGraceTime(officeTime.graceTime.toString());
        setShift(officeTime.shift);
        setApplicableRoles(officeTime.applicableRoles || 'all');
      } else {
        setName('');
        setStartTime('');
        setEndTime('');
        setGraceTime('');
        setShift('Day');
        setApplicableRoles('all');
      }
    }
  }, [isOpen, officeTime, isEditMode]);

  const handleRoleToggle = (role: UserRole) => {
    setApplicableRoles(prev => {
        if (prev === 'all') {
            return [role];
        }
        if (prev.includes(role)) {
            const nextRoles = prev.filter(r => r !== role);
            return nextRoles.length === 0 ? 'all' : nextRoles;
        }
        return [...prev, role];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startTime || !endTime || !graceTime) {
      toast({
        title: "Validation Error",
        description: "All fields except shift are required.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    const data = {
        name: name.trim(),
        startTime,
        endTime,
        graceTime: parseInt(graceTime, 10),
        shift,
        applicableRoles,
    };
    
    let result;
    if (isEditMode && officeTime) {
        result = await updateOfficeTimeAction(officeTime.id, data);
    } else {
        result = await addOfficeTimeAction(data);
    }

    setIsSubmitting(false);

    if (result.success) {
        toast({
            title: `Office Time ${isEditMode ? 'Updated' : 'Added'}`,
            description: `The office time configuration has been saved.`
        });
        onOfficeTimeSaved();
    } else {
        toast({ title: "Error", description: result.error || "Failed to save office time.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add New'} Office Time</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update the details for this office time configuration.' : 'Create a new office time configuration.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="py-4 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="office-hour-name">Office Hour Name</Label>
            <Input id="office-hour-name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
                <Label htmlFor="start-time">Start Time</Label>
                <Input id="start-time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
            </div>
            <div className="space-y-1">
                <Label htmlFor="end-time">End Time</Label>
                <Input id="end-time" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
            </div>
          </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="grace-time">Grace Time (minutes)</Label>
                <Input id="grace-time" type="number" value={graceTime} onChange={e => setGraceTime(e.target.value)} required min="0"/>
              </div>
              <div className="space-y-1">
                <Label htmlFor="shift">Shift</Label>
                <Select value={shift} onValueChange={(v) => setShift(v as 'Day' | 'Night')}>
                    <SelectTrigger id="shift">
                        <SelectValue placeholder="Select shift" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Day">Day</SelectItem>
                        <SelectItem value="Night">Night</SelectItem>
                    </SelectContent>
                </Select>
              </div>
          </div>

          <div className="space-y-2">
            <Label>Applicable Roles</Label>
            <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[40px] bg-background">
                {applicableRoles === 'all' ? (
                    <Badge variant="secondary">All Roles</Badge>
                ) : (
                    applicableRoles.map(role => (
                        <Badge key={role} variant="secondary" className="gap-1.5 py-1">
                            {role.replace(/_/g, ' ')}
                            <button type="button" onClick={() => handleRoleToggle(role)} className="rounded-full hover:bg-destructive/20 p-0.5 transition-colors">
                                <X className="h-3 w-3 text-destructive" />
                            </button>
                        </Badge>
                    ))
                )}
            </div>
            <Popover open={isRolePopoverOpen} onOpenChange={setIsRolePopoverOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                    >
                        {applicableRoles === 'all' ? 'All Roles (Click to specify)' : 'Add/Remove Roles...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder="Search role..." />
                        <CommandList>
                            <CommandEmpty>No role found.</CommandEmpty>
                            <CommandGroup>
                                <CommandItem onSelect={() => setApplicableRoles('all')} className="cursor-pointer">
                                    <Check className={cn("mr-2 h-4 w-4", applicableRoles === 'all' ? "opacity-100" : "opacity-0")} />
                                    All Roles
                                </CommandItem>
                                {availableRoles.map(role => (
                                    <CommandItem key={role.id} onSelect={() => handleRoleToggle(role.id)} className="cursor-pointer">
                                        <Check className={cn("mr-2 h-4 w-4", Array.isArray(applicableRoles) && applicableRoles.includes(role.id) ? "opacity-100" : "opacity-0")} />
                                        {role.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Saving...' : 'Save Configuration'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddEditOfficeTimeDialog;
