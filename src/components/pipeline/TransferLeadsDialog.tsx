
"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { User } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { transferSelectedLeadsAction } from '@/app/(app)/pipeline/actions';
import { Loader2, ChevronsUpDown, Check } from 'lucide-react';

interface TransferLeadsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onLeadsTransferred: () => void;
  allCrmUsers: User[];
  currentUser: User;
  selectedLeadIds?: string[];
}

export function TransferLeadsDialog({ isOpen, onOpenChange, onLeadsTransferred, allCrmUsers, currentUser, selectedLeadIds = [] }: TransferLeadsDialogProps) {
  const [targetCrmId, setTargetCrmId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTargetPopoverOpen, setIsTargetPopoverOpen] = useState(false);
  const { toast } = useToast();

  // Filter out non-assignable pseudo-users like "Unassigned" or "Deleted User"
  const assignableCrmUsers = useMemo(() => {
    return allCrmUsers.filter(user => user.id && !user.id.startsWith('['));
  }, [allCrmUsers]);


  const handleSubmit = async () => {
    if (!targetCrmId) {
      toast({ title: "Missing Information", description: "Please select a CR user to transfer the leads to.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const result = await transferSelectedLeadsAction(
      selectedLeadIds,
      targetCrmId,
      currentUser
    );
    setIsSubmitting(false);

    if (result.success) {
      toast({ title: "Transfer Successful", description: `${result.transferredCount} lead(s) have been transferred.` });
      onLeadsTransferred();
      onOpenChange(false);
    } else {
      toast({ title: "Transfer Failed", description: result.error || "An error occurred.", variant: "destructive" });
    }
  };
  
  useEffect(() => {
    if(!isOpen) {
      setTargetCrmId('');
    }
  }, [isOpen]);

  const selectedCrmName = assignableCrmUsers.find(u => u.id === targetCrmId)?.name || "Select target CR...";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Selected Leads</DialogTitle>
          <DialogDescription>
            You are about to transfer <span className="font-semibold text-foreground">{selectedLeadIds.length}</span> selected lead(s). Choose a CR user to assign them to.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1">
            <Label htmlFor="target-crm">To CR User *</Label>
            <Popover open={isTargetPopoverOpen} onOpenChange={setIsTargetPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={isTargetPopoverOpen} className="w-full justify-between h-10">
                  <span className="truncate">{selectedCrmName}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Search CR user..." />
                  <CommandList>
                    <CommandEmpty>No user found.</CommandEmpty>
                    <CommandGroup>
                       {assignableCrmUsers.map(user => (
                        <CommandItem
                          key={user.id}
                          value={user.name}
                          onSelect={() => {
                            setTargetCrmId(user.id);
                            setIsTargetPopoverOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              targetCrmId === user.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {user.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !targetCrmId}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Transferring...</> : "Confirm Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TransferLeadsDialog;
