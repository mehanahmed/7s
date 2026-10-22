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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface HoldReasonDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (reason: string) => void;
}

export function HoldReasonDialog({ isOpen, onOpenChange, onConfirm }: HoldReasonDialogProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(reason);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to Approval Period</DialogTitle>
          <DialogDescription>
            Please provide a reason or note for placing this project into the approval period. This will be logged in the order history.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="hold-reason">Approval Note / Reason</Label>
          <Textarea
            id="hold-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Awaiting client review and approval of the script..."
            className="mt-1"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!reason.trim()} className="bg-amber-600 hover:bg-amber-700 text-white">
            Confirm Approval Period
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
