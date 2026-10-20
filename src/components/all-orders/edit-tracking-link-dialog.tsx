
"use client";

import React, { useState, useEffect, useMemo } from 'react'; 
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea"; 
import type { TrackingLink, CustomStatus, User, UserRole } from "@/types";
import { useToast } from '@/hooks/use-toast';
import { updateTrackingLinkAction } from '@/app/(app)/all-orders/actions'; 
import { AlertTriangle } from 'lucide-react';
import { isDrRole } from '@/lib/roles';

interface EditTrackingLinkDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  trackingLink: TrackingLink;
  currentUser: User;
  availableStatuses: CustomStatus[];
  onTrackingLinkUpdated: () => void; 
}

export function EditTrackingLinkDialog({ 
  isOpen, 
  onOpenChange, 
  trackingLink, 
  currentUser, 
  availableStatuses,
  onTrackingLinkUpdated 
}: EditTrackingLinkDialogProps) {
  const [isPublic, setIsPublic] = useState(trackingLink.isPublic);
  const [currentStatusId, setCurrentStatusId] = useState<string>(trackingLink.currentStatus);
  const [statusNotes, setStatusNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setIsPublic(trackingLink.isPublic);
      setCurrentStatusId(trackingLink.currentStatus);
      setStatusNotes(''); 
    }
  }, [trackingLink, isOpen]);

  const isCrmEditingOthersOrder = useMemo(() => {
    return currentUser.role === 'CR' && currentUser.id !== trackingLink.crmUserId;
  }, [currentUser, trackingLink]);

  const isDrEditingUnassignedOrder = useMemo(() => {
    return isDrRole(currentUser.role) && currentUser.id !== trackingLink.designerRepresentativeId;
  }, [currentUser, trackingLink]);

  const displayableStatuses = useMemo(() => {
    if (!availableStatuses) return [];
    
    // System Admin can see all visible statuses, plus the current one if it's hidden.
    if (currentUser.role === 'SYSTEM_ADMIN') {
        return availableStatuses
          .filter(status => status.isVisible !== false || status.id === trackingLink.currentStatus)
          .sort((a,b) => a.name.localeCompare(b.name));
    }
    
    // For other roles, this is not strictly needed as they won't see the dropdown,
    // but it's good practice to keep it correct.
    return availableStatuses;

  }, [availableStatuses, trackingLink.currentStatus, currentUser.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCrmEditingOthersOrder) {
      toast({ title: "Permission Denied", description: "CRMs can only modify orders assigned to them.", variant: "destructive" });
      return;
    }
    if (isDrEditingUnassignedOrder) {
      toast({ title: "Permission Denied", description: "Designer Representatives can only modify orders assigned to them.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const updates: { isPublic?: boolean; currentStatus?: string; statusNotes?: string } = {};
    let statusChanged = false;

    if (isPublic !== trackingLink.isPublic) {
      updates.isPublic = isPublic;
    }
    if (currentStatusId !== trackingLink.currentStatus && currentUser.role === 'SYSTEM_ADMIN') {
      updates.currentStatus = currentStatusId;
      statusChanged = true;
    }

    if (statusChanged && statusNotes.trim()) {
      updates.statusNotes = statusNotes.trim();
    }


    if (Object.keys(updates).length === 0) {
      toast({ title: "No Changes", description: "No changes were made to the tracking link." });
      setIsSubmitting(false);
      onOpenChange(false); 
      return;
    }
    
    const result = await updateTrackingLinkAction(trackingLink.id, updates, currentUser);
    setIsSubmitting(false);

    if ('error' in result) {
      toast({ title: "Update Failed", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Tracking Link Updated", description: `Link ${trackingLink.id} has been updated.` });
      onTrackingLinkUpdated(); 
    }
  };
  
  const canEditAnyField = 
    (currentUser.role === 'ADMIN' || currentUser.role === 'SYSTEM_ADMIN') || 
    (currentUser.role === 'CR' && !isCrmEditingOthersOrder) ||
    (isDrRole(currentUser.role) && !isDrEditingUnassignedOrder);


  const canEditVisibility = 
    (currentUser.role === 'ADMIN' || currentUser.role === 'SYSTEM_ADMIN') ||
    (currentUser.role === 'CR' && !isCrmEditingOthersOrder) ||
    (isDrRole(currentUser.role) && !isDrEditingUnassignedOrder);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-6">
        <DialogHeader>
          <DialogTitle>Edit Tracking Link: {trackingLink.id}</DialogTitle>
          <DialogDescription>Order for: {trackingLink.companyName} (CR: {trackingLink.crmUserName})</DialogDescription>
        </DialogHeader>

        {isCrmEditingOthersOrder && (
          <div className="my-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md text-yellow-700 dark:text-yellow-400 text-sm flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Permission Restricted</p>
              <p>As a CR, you can only modify orders assigned to you. These fields are disabled.</p>
            </div>
          </div>
        )}
        {isDrEditingUnassignedOrder && (
          <div className="my-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md text-yellow-700 dark:text-yellow-400 text-sm flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Permission Restricted</p>
              <p>As a Designer Representative, you can only modify orders assigned to you. These fields are disabled.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="flex items-center justify-between space-x-2 p-3 bg-secondary/30 rounded-md border border-border/20">
              <Label htmlFor="isPublic" className="flex flex-col space-y-1 cursor-pointer">
                <span>Publicly Accessible</span>
                <span className="font-normal leading-snug text-muted-foreground text-xs">
                  Allow clients to view this tracking link.
                </span>
              </Label>
              <Switch
                id="isPublic"
                checked={isPublic}
                onCheckedChange={setIsPublic}
                disabled={!canEditVisibility || isSubmitting || isCrmEditingOthersOrder || isDrEditingUnassignedOrder}
              />
            </div>

            {currentUser.role === 'SYSTEM_ADMIN' && (
              <div className="space-y-3 p-3 bg-secondary/30 rounded-md border border-border/20">
                <div>
                  <Label htmlFor="currentStatus">Order Status</Label>
                   <Select 
                    value={currentStatusId} 
                    onValueChange={(value) => setCurrentStatusId(value)}
                    disabled={isSubmitting || displayableStatuses.length === 0}
                  >
                    <SelectTrigger id="currentStatus" className="mt-1">
                      <SelectValue placeholder="Select order status" />
                    </SelectTrigger>
                    <SelectContent>
                      {displayableStatuses.map(status => (
                        <SelectItem key={status.id} value={status.id}>{status.name}</SelectItem>
                      ))}
                      {availableStatuses.length === 0 && (
                         <div className="p-2 text-sm text-muted-foreground text-center">Loading statuses...</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {currentStatusId !== trackingLink.currentStatus && ( 
                  <div>
                    <Label htmlFor="statusNotes">Status Update Notes (Optional)</Label>
                    <Textarea
                      id="statusNotes"
                      placeholder="Add any relevant notes for this status change..."
                      value={statusNotes}
                      onChange={(e) => setStatusNotes(e.target.value)}
                      className="mt-1 min-h-[80px]"
                      disabled={isSubmitting}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="pt-4 border-t mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={!canEditAnyField || isSubmitting || isCrmEditingOthersOrder || isDrEditingUnassignedOrder || (currentStatusId === trackingLink.currentStatus && isPublic === trackingLink.isPublic)}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
