
"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import type { User } from "@/types";
import { Loader2 } from 'lucide-react';

interface DeleteUserDialogProps {
  user: User;
  onConfirmDelete: () => Promise<void>; // Callback to trigger deletion logic in parent
  isDeleting: boolean; // To show loading state on the button
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteUserDialog({ user, onConfirmDelete, isDeleting, isOpen, onOpenChange }: DeleteUserDialogProps) {
  
  const handleDelete = async () => {
    // The actual deletion logic (calling server action, toast, re-fetch)
    // is now handled by `onConfirmDelete` which points to `handleConfirmDeleteUser` in UsersPage.
    await onConfirmDelete(); 
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { if (!isDeleting) onOpenChange(open)}}>
      {/* DialogTrigger is handled by parent controlling isOpen */}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete this user?</AlertDialogTitle>
          <AlertDialogDescription>
            This action will permanently delete the user <span className="font-semibold">{user.name}</span> ({user.email}) from the database. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => { if (!isDeleting) onOpenChange(false) }} disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete} 
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90" 
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : "Delete User"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

