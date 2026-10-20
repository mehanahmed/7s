"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { User } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Loader2, ShieldCheck, ShieldAlert, Unlock, Trash2 } from 'lucide-react';
import { adminSetUserPinAction, unlockUserPinAccountAction } from '@/app/(app)/users/actions';
import { format } from 'date-fns';
import { PinInput } from '@/components/ui/pin-input';

interface AdminSetUserPinDialogProps {
  user: User;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPinUpdated: () => void;
}

export function AdminSetUserPinDialog({
  user,
  isOpen,
  onOpenChange,
  onPinUpdated,
}: AdminSetUserPinDialogProps) {
  const [pinCode, setPinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const isLocked = Boolean(user.pinLockedUntil && new Date(user.pinLockedUntil) > new Date());

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pinCode.trim())) {
      toast({
        title: "Invalid PIN Code",
        description: "PIN code must be 4 to 6 numeric digits (0-9).",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await adminSetUserPinAction(user.id, pinCode.trim());
      if (res.success) {
        toast({
          title: "PIN Code Updated",
          description: `Security PIN code for ${user.name} has been set.`,
        });
        onPinUpdated();
        onOpenChange(false);
        setPinCode('');
      } else {
        throw new Error(res.error || "Failed to set PIN code.");
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to set PIN code.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlockAccount = async () => {
    setIsLoading(true);
    try {
      const res = await unlockUserPinAccountAction(user.id);
      if (res.success) {
        toast({
          title: "Account Unlocked",
          description: `PIN lock on ${user.name}'s account has been unlocked successfully.`,
        });
        onPinUpdated();
        onOpenChange(false);
      } else {
        throw new Error(res.error || "Failed to unlock account.");
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to unlock account.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePin = async () => {
    setIsLoading(true);
    try {
      const res = await adminSetUserPinAction(user.id, null);
      if (res.success) {
        toast({
          title: "PIN Removed",
          description: `PIN code for ${user.name} has been removed.`,
        });
        onPinUpdated();
        onOpenChange(false);
        setPinCode('');
      } else {
        throw new Error(res.error || "Failed to remove PIN code.");
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to remove PIN code.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-2xl p-6">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
            Manage User PIN
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            User: <span className="font-semibold text-foreground">{user.name}</span>
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Status Indicator */}
          {isLocked ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-xs">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Account Locked (3 Wrong Attempts)</span>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleUnlockAccount}
                disabled={isLoading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white h-9"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Unlock className="mr-1.5 h-3.5 w-3.5" /> Unlock Account</>}
              </Button>
            </div>
          ) : user.hasPinCode ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-xl">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 text-green-600" /> Active PIN Code
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemovePin}
                disabled={isLoading}
                className="h-7 text-xs text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="mr-1 h-3 w-3" /> Remove
              </Button>
            </div>
          ) : null}

          {/* Set / Change PIN Form */}
          <form onSubmit={handleSavePin} className="space-y-4">
            <div className="space-y-1 text-center">
              <p className="text-xs font-semibold text-foreground">
                {user.hasPinCode ? "Set New PIN Code" : "Create PIN Code"}
              </p>
              <PinInput
                value={pinCode}
                onChange={setPinCode}
                length={6}
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancel
              </Button>

              <Button type="submit" size="sm" disabled={isLoading || !/^\d{4,6}$/.test(pinCode)} className="px-5">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save PIN"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
