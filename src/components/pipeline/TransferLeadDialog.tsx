
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { Lead, User } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { transferLeadAction } from '@/app/(app)/pipeline/actions';
import { Loader2, Users, ChevronsUpDown, Check } from 'lucide-react';

interface TransferLeadDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onLeadTransferred: () => void;
  lead: Lead | null;
  allCrmUsers: User[];
  currentUser: User | null;
}

export function TransferLeadDialog({ isOpen, onOpenChange, onLeadTransferred, lead, allCrmUsers, currentUser }: TransferLeadDialogProps) {
  const [newCrmId, setNewCrmId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !newCrmId || !currentUser) {
      toast({ title: "Error", description: "Missing required information for transfer.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    const result = await transferLeadAction(lead.id, newCrmId, currentUser);
    setIsSubmitting(false);

    if (result.success) {
      const newCrmName = allCrmUsers.find(u => u.id === newCrmId)?.name || 'the new user';
      toast({ title: "Lead Transferred", description: `Lead for "${lead.contactName}" has been transferred to ${newCrmName}.` });
      onLeadTransferred();
    } else {
      toast({ title: "Transfer Failed", description: result.error || "Could not transfer lead.", variant: "destructive" });
    }
  };

  if (!lead) return null;

  const selectedCrmName = allCrmUsers.find(u => u.id === newCrmId)?.name || "Select a new CR user...";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Transfer Lead</DialogTitle>
          <DialogDescription>
            Re-assign lead for <span className="font-semibold">{lead.contactName}</span> from <span className="font-semibold">{lead.crmName}</span> to a new CR.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="py-4 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="new-crm-owner">New CR Owner *</Label>
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isPopoverOpen}
                  className="w-full justify-between"
                  disabled={isSubmitting}
                >
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
                       {allCrmUsers.length === 0 && <CommandItem disabled>No other CRMs to transfer to.</CommandItem>}
                       {allCrmUsers.map(user => (
                        <CommandItem
                          key={user.id}
                          value={user.name}
                          onSelect={() => {
                            setNewCrmId(user.id);
                            setIsPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              newCrmId === user.id ? "opacity-100" : "opacity-0"
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
          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !newCrmId}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Transferring...</> : "Confirm Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
