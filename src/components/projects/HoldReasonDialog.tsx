
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
          <DialogTitle>Reason for Hold</DialogTitle>
          <DialogDescription>
            Please provide a reason for putting this project on hold. This will be logged in the order history.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="hold-reason">Hold Reason</Label>
          <Textarea
            id="hold-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Awaiting client feedback on design..."
            className="mt-1"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!reason.trim()}>Confirm Hold</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
