
"use client";

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from 'lucide-react';

interface AccountSuspendedDialogProps {
  isOpen: boolean;
  onConfirmLogout: () => void;
}

export function AccountSuspendedDialog({ isOpen, onConfirmLogout }: AccountSuspendedDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => {
      // If the dialog is closed by any means (e.g., Escape key, overlay click),
      // we should still log the user out.
      if (!open) {
        onConfirmLogout();
      }
    }}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            Account Suspended
          </AlertDialogTitle>
          <AlertDialogDescription className="pt-2">
            Your account has been suspended by an administrator. You will now be logged out.
            Please contact support if you believe this is an error.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {/* Footer is removed to prevent cancel, logout is forced */}
        <div className="flex justify-end pt-4">
            <AlertDialogAction
                onClick={onConfirmLogout}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
                OK
            </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
