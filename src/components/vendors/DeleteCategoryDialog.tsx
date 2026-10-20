
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
import type { VendorCategory } from "@/types";
import { Loader2 } from 'lucide-react';

interface DeleteCategoryDialogProps {
  category: VendorCategory;
  onConfirmDelete: () => Promise<void>;
  isDeleting: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteCategoryDialog({ category, onConfirmDelete, isDeleting, isOpen, onOpenChange }: DeleteCategoryDialogProps) {
  
  const handleDelete = async () => {
    await onConfirmDelete();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { if (!isDeleting) onOpenChange(open)}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the category "<span className="font-semibold">{category.name}</span>". This action cannot be undone.
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
            ) : "Delete Category"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteCategoryDialog;
