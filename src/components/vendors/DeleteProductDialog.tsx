
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
import type { VendorProduct } from "@/types";
import { Loader2 } from 'lucide-react';

interface DeleteProductDialogProps {
  product: VendorProduct;
  onConfirmDelete: () => Promise<void>;
  isDeleting: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteProductDialog({ product, onConfirmDelete, isDeleting, isOpen, onOpenChange }: DeleteProductDialogProps) {
  
  const handleDelete = async () => {
    await onConfirmDelete();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { if (!isDeleting) onOpenChange(open)}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the product "<span className="font-semibold">{product.name}</span>". This action cannot be undone.
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
            ) : "Delete Product"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteProductDialog;
