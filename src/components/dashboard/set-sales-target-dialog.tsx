
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

interface SetSalesTargetDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentTarget: number;
  onSetTarget: (newTarget: number) => void;
  targetType: 'monthly' | 'weekly';
}

export function SetSalesTargetDialog({ 
  isOpen, 
  onOpenChange, 
  currentTarget, 
  onSetTarget,
  targetType
}: SetSalesTargetDialogProps) {
  const [targetQuantity, setTargetQuantity] = useState<string>(currentTarget.toString());
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setTargetQuantity(currentTarget.toString());
    }
  }, [isOpen, currentTarget]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTarget = parseInt(targetQuantity, 10);
    if (isNaN(newTarget) || newTarget < 0) {
      toast({
        title: "Invalid Target",
        description: "Please enter a valid positive number for the target quantity.",
        variant: "destructive",
      });
      return;
    }
    onSetTarget(newTarget);
    toast({
      title: `${targetType === 'monthly' ? 'Monthly' : 'Weekly'} Order Target Updated`,
      description: `${targetType === 'monthly' ? 'Monthly' : 'Weekly'} order target set to ${newTarget} orders.`,
    });
  };

  const dialogTitle = targetType === 'monthly' ? 'Set Monthly Order Target (CR)' : 'Set Weekly Order Target (CR)';
  const dialogDescription = `Enter the new ${targetType} order target quantity for CRMs. This will be visible on the dashboard.`;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="targetQuantity">Target Quantity (Orders)</Label>
              <Input
                id="targetQuantity"
                type="number"
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(e.target.value)}
                placeholder="e.g., 100"
                min="0"
                step="1"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Set Target</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

