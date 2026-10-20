
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
import { Loader2 } from 'lucide-react';
import type { VendorCategory } from '@/types';
import { addVendorCategory, updateVendorCategory } from '@/lib/vendor-category-service';

interface AddEditCategoryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCategorySaved: () => void;
  category?: VendorCategory | null;
}

export function AddEditCategoryDialog({ isOpen, onOpenChange, onCategorySaved, category }: AddEditCategoryDialogProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const isEditMode = !!category;

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && category) {
        setName(category.name);
      } else {
        setName('');
      }
      setIsSubmitting(false);
    }
  }, [isOpen, category, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    let result;
    if (isEditMode && category) {
        result = await updateVendorCategory(category.id, { name: name.trim() });
    } else {
        const newCategory = await addVendorCategory({ name: name.trim() });
        result = !!newCategory;
    }
    
    setIsSubmitting(false);
    
    if (result) {
        toast({ title: `Category ${isEditMode ? 'Updated' : 'Added'}`, description: `Category "${name.trim()}" has been saved.`});
        onCategorySaved();
    } else {
        toast({ title: "Error", description: `Could not save category.`, variant: "destructive"});
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add New'} Category</DialogTitle>
          <DialogDescription>
            {isEditMode ? `Update the name for the "${category?.name}" category.` : 'Enter the name for a new product category.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="py-4 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="category-name">Category Name *</Label>
            <Input id="category-name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : (isEditMode ? 'Save Changes' : 'Add Category')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddEditCategoryDialog;
