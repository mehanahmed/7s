
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
import type { User } from "@/types";
import { Target } from 'lucide-react';

interface SetUserSalesTargetDialogProps {
  user: User;
  onTargetsSet: (userId: string, amountTarget: number) => Promise<boolean>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetUserSalesTargetDialog({ user, onTargetsSet, isOpen, onOpenChange }: SetUserSalesTargetDialogProps) {
  const [amountTarget, setAmountTarget] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  // Toast is handled by UsersPage

  useEffect(() => {
    if (isOpen && user) {
      setAmountTarget((user.monthlySalesTarget || 0).toString());
    }
  }, [isOpen, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const salesAmount = Number(amountTarget);

    if (!amountTarget.trim() || !Number.isFinite(salesAmount) || salesAmount < 0 || salesAmount > 999999999999.99 || Math.abs(salesAmount * 100 - Math.round(salesAmount * 100)) >= 0.01) {
      alert("Enter a valid non-negative BDT amount with up to two decimal places.");
      return;
    }

    setIsLoading(true);
    try { await onTargetsSet(user.id, salesAmount); }
    finally { setIsLoading(false); }
    // Parent (UsersPage) will close the dialog on success
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {/* DialogTrigger is handled by parent controlling isOpen */}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Target className="mr-2 h-5 w-5 text-primary" /> Set Sales Targets for {user.name}
          </DialogTitle>
          <DialogDescription>
            Define the monthly sales amount target for {user.name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="amountTarget-set">Monthly Sales Amount Target (BDT)</Label>
              <Input
                id="amountTarget-set"
                type="number"
                value={amountTarget}
                onChange={(e) => setAmountTarget(e.target.value)}
                placeholder="e.g., 500000"
                min="0"
                max="999999999999.99"
                step="0.01"
                required
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Updating..." : "Set Targets"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
