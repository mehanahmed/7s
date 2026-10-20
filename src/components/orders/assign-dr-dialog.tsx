
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TrackingLink, User, CustomStatus } from "@/types";
import { useToast } from '@/hooks/use-toast';
import { assignDrToOrderAction } from '@/app/(app)/orders/actions'; 
import { getUsers } from '@/lib/user-service';
import { Loader2, AlertTriangle, ChevronsUpDown, Check } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { isDrRole } from '@/lib/roles';


interface AssignDrDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  order: TrackingLink;
  currentUser: User;
  allStatuses: CustomStatus[]; 
  onDrAssigned: (updatedOrder: TrackingLink) => void;
}

const TARGET_READY_FOR_DESIGN_STATUS_ID = 'ready-for-design';

const getInitials = (name: string | undefined): string => {
  if (!name) return '??';
  const names = name.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return names[0].charAt(0).toUpperCase() + (names.length > 1 ? names[names.length - 1].charAt(0).toUpperCase() : '');
};


export function AssignDrDialog({ isOpen, onOpenChange, order, currentUser, allStatuses, onDrAssigned }: AssignDrDialogProps) {
  const [selectedDrId, setSelectedDrId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [designerReps, setDesignerReps] = useState<User[]>([]);
  const [isLoadingDrs, setIsLoadingDrs] = useState(true);
  const [readyForDesignStatus, setReadyForDesignStatus] = useState<CustomStatus | undefined>(undefined);
  const { toast } = useToast();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  useEffect(() => {
    if (isOpen) {
      setSelectedDrId(order.designerRepresentativeId || ''); 
      
      if (allStatuses && allStatuses.length > 0) {
          console.log("AssignDrDialog: Received allStatuses prop. Count:", allStatuses.length, "IDs:", allStatuses.map(s => s.id).join(', '));
      } else {
          console.warn("AssignDrDialog: Received empty or no allStatuses prop for order:", order.id);
      }

      const foundStatus = allStatuses.find(s => s.id === TARGET_READY_FOR_DESIGN_STATUS_ID);
      if (!foundStatus) {
          console.error(`AssignDrDialog: CRITICAL - Status with ID '${TARGET_READY_FOR_DESIGN_STATUS_ID}' NOT FOUND in allStatuses prop. AllStatuses:`, JSON.stringify(allStatuses.map(s=>({id: s.id, name: s.name}))));
          toast({
              title: "Configuration Alert!",
              description: `The required system status '${TARGET_READY_FOR_DESIGN_STATUS_ID}' (typically 'Ready for Design') is missing or not configured correctly. Please contact an administrator. Assignment is not possible.`,
              variant: "destructive",
              duration: 10000, 
          });
      } else {
        console.log("AssignDrDialog: Found target status object (ID: 'ready-for-design'):", JSON.stringify(foundStatus));
      }
      setReadyForDesignStatus(foundStatus);

      const fetchDrs = async () => {
        setIsLoadingDrs(true);
        try {
          const allUsers = await getUsers();
          const drs = allUsers.filter(user => isDrRole(user.role) && !user.isBanned);
          setDesignerReps(drs);
        } catch (error) {
          console.error("Failed to fetch designer representatives:", error);
          toast({ title: "Error", description: "Could not load designer representatives.", variant: "destructive" });
          setDesignerReps([]);
        } finally {
          setIsLoadingDrs(false);
        }
      };
      fetchDrs();
    }
  }, [isOpen, order, allStatuses, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDrId) {
      toast({ title: "Validation Error", description: "Please select a Designer Representative.", variant: "destructive" });
      return;
    }
    if (!readyForDesignStatus) {
      toast({ title: "Configuration Error", description: `The required system status (ID: ${TARGET_READY_FOR_DESIGN_STATUS_ID}) was not found. Assignment cannot proceed.`, variant: "destructive", duration: 10000 });
      return;
    }

    const selectedDr = designerReps.find(dr => dr.id === selectedDrId);
    if (!selectedDr) {
      toast({ title: "Error", description: "Selected Designer Representative not found.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const result = await assignDrToOrderAction(
      order.id,
      selectedDr.id,
      selectedDr.name,
      currentUser,
      readyForDesignStatus.id 
    );
    setIsSubmitting(false);

    if ('error' in result) {
      toast({ title: "Assignment Failed", description: result.error, variant: "destructive" });
    } else {
      onDrAssigned(result); 
      onOpenChange(false); 
    }
  };

  const currentReadyForDesignStatusName = readyForDesignStatus ? readyForDesignStatus.name : `Status ID '${TARGET_READY_FOR_DESIGN_STATUS_ID}' Not Found`;

  const filteredDesignerReps = designerReps.filter(dr =>
    dr.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Designer Representative</DialogTitle>
          <DialogDescription>
            Assign order <span className="font-semibold">{order.id}</span> for <span className="font-semibold">{order.companyName}</span> to a Designer Representative.
            The order status will be set to: <span className="font-semibold">{currentReadyForDesignStatusName}</span>.
          </DialogDescription>
        </DialogHeader>
        
        {!readyForDesignStatus && isOpen && (
            <div className="my-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                    <p className="font-semibold">Configuration Alert!</p>
                    <p>The system status identified by ID <code className="font-mono bg-destructive/20 px-1 py-0.5 rounded text-xs">{TARGET_READY_FOR_DESIGN_STATUS_ID}</code> (typically 'Ready for Design') is missing or not configured correctly. DR assignment is not possible.</p>
                </div>
            </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="drSelect">Designer Representative</Label>
              {isLoadingDrs ? (
                <div className="flex items-center justify-center h-10 border rounded-md bg-muted/50">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isPopoverOpen}
                      className="w-full justify-between"
                      disabled={designerReps.length === 0 || !readyForDesignStatus}
                    >
                      <span className="truncate">
                        {selectedDrId
                          ? designerReps.find((dr) => dr.id === selectedDrId)?.name
                          : "Select a DR..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search DR..."
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                      />
                      <CommandList>
                        <CommandEmpty>No DR found.</CommandEmpty>
                        <CommandGroup>
                          {filteredDesignerReps.map((dr) => (
                            <CommandItem
                              key={dr.id}
                              value={dr.name}
                              onSelect={() => {
                                setSelectedDrId(dr.id);
                                setIsPopoverOpen(false);
                              }}
                              className="flex items-center gap-2"
                            >
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  selectedDrId === dr.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                               <Avatar className="h-6 w-6">
                                <AvatarImage src={dr.avatarUrl || undefined} alt={dr.name} />
                                <AvatarFallback className="text-xs">{getInitials(dr.name)}</AvatarFallback>
                              </Avatar>
                              <span>{dr.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || isLoadingDrs || !selectedDrId || designerReps.length === 0 || !readyForDesignStatus}
            >
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Assigning...</> : "Assign DR"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
