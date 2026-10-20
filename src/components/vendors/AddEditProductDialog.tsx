
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
import { Textarea } from "@/components/ui/textarea";
import type { User, VendorProduct, VendorCategory } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addVendorProduct, updateVendorProduct } from '@/lib/vendor-product-service';

interface AddEditProductDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onProductSaved: () => void;
  product?: VendorProduct | null;
  currentUser: User;
  categories: VendorCategory[];
}

export function AddEditProductDialog({ isOpen, onOpenChange, onProductSaved, product, currentUser, categories = [] }: AddEditProductDialogProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const isEditMode = !!product;

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && product) {
        setName(product.name);
        setCategory(product.category);
        setPrice(product.price.toString());
        setDescription(product.description || '');
      } else {
        setName('');
        setCategory('');
        setPrice('');
        setDescription('');
      }
      setIsSubmitting(false);
    }
  }, [isOpen, product, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = parseFloat(price);
    if (!name || !category || isNaN(numericPrice) || numericPrice < 0) {
      toast({
        title: "Validation Error",
        description: "Please fill all fields with valid data.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const productData = {
        name,
        category,
        price: numericPrice,
        description,
    };
    
    let result;
    if (isEditMode && product) {
        result = await updateVendorProduct(product.id, productData);
    } else {
        const newProduct = await addVendorProduct(productData);
        result = !!newProduct;
    }
    
    setIsSubmitting(false);
    
    if (result) {
        toast({ title: `Product ${isEditMode ? 'Updated' : 'Added'}`, description: `Product "${name}" has been saved.`});
        onProductSaved();
    } else {
        toast({ title: "Error", description: "Could not save product.", variant: "destructive"});
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add New'} Product</DialogTitle>
          <DialogDescription>
            {isEditMode ? `Update details for "${product?.name}"` : 'Enter the details for a new product.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="py-4 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="product-name">Product Name *</Label>
            <Input id="product-name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-category">Category *</Label>
            <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger id="product-category">
                    <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                    {categories && categories.length > 0 ? (
                        categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                        ))
                    ) : (
                        <div className="p-2 text-sm text-muted-foreground">No categories found.</div>
                    )}
                </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-price">Unit Price (BDT) *</Label>
            <Input id="product-price" type="number" value={price} onChange={e => setPrice(e.target.value)} required min="0" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-description">Description (Optional)</Label>
            <Textarea id="product-description" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : (isEditMode ? 'Save Changes' : 'Add Product')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
