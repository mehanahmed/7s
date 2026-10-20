
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import NextImage from 'next/image';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Edit, Trash2, Layers, RefreshCw, AlertTriangle, Search, UploadCloud, ImageIcon, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import type { ServiceModelItem } from "@/types";
import { getModels } from '@/lib/service-options-service';
import {
  addModelAction, updateModelAction, deleteModelAction
} from '../service-management/actions';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function SafeModelImage({ src, alt, size = 48, className }: { src?: string | null; alt: string; size?: number; className?: string }) {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [src]);

  if (!src || error) {
    return (
      <div
        className={cn(
          "rounded-md bg-secondary/80 border border-border/40 flex items-center justify-center shrink-0 text-muted-foreground/50 select-none shadow-inner",
          className
        )}
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <ImageIcon style={{ width: `${Math.max(16, Math.round(size * 0.45))}px`, height: `${Math.max(16, Math.round(size * 0.45))}px` }} className="opacity-50" />
      </div>
    );
  }

  return (
    <NextImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn("rounded-md object-cover bg-muted border border-border/30", className)}
      data-ai-hint="product photo"
      unoptimized={true}
      onError={() => setError(true)}
    />
  );
}

interface ItemToEdit {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
}
interface ItemToDelete {
  id: string;
  name: string;
}

export default function ModelManagementPage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [models, setModels] = useState<ServiceModelItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modelSearchTerm, setModelSearchTerm] = useState('');

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');

  const [editingItem, setEditingItem] = useState<ItemToEdit | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);

  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedModels = await getModels();
      setModels(fetchedModels);
    } catch (error) {
      console.error("Error fetching models:", error);
      toast({ title: "Error", description: "Could not load data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SYSTEM_ADMIN')) {
      fetchData();
    } else if (currentUser) {
      router.replace('/dashboard');
    }
  }, [currentUser, router, fetchData]);

  const filteredModels = useMemo(() => {
    if (!modelSearchTerm) return models;

    return models.filter(model =>
      model.name.toLowerCase().includes(modelSearchTerm.toLowerCase())
    );
  }, [models, modelSearchTerm]);

  const openAddDialog = () => {
    setEditingItem(null);
    setItemName('');
    setItemDescription('');
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    setIsAddEditDialogOpen(true);
  };

  const openEditDialog = (item: ServiceModelItem) => {
    setEditingItem({ id: item.id, name: item.name, description: item.description, imageUrl: item.imageUrl });
    setItemName(item.name);
    setItemDescription(item.description || '');
    setSelectedImageFile(null);
    setImagePreviewUrl(item.imageUrl || null);
    setIsAddEditDialogOpen(true);
  };

  const openDeleteDialog = (item: ServiceModelItem) => {
    setItemToDelete({ id: item.id, name: item.name });
    setIsDeleteDialogOpen(true);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ title: "File too large", description: "Please select an image smaller than 2MB.", variant: "destructive" });
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
        toast({ title: "Invalid file type", description: "Please select a JPG, PNG, or GIF image.", variant: "destructive" });
        return;
      }
      setSelectedImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };


  const handleAddEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      toast({ title: "Validation Error", description: "Name cannot be empty.", variant: "destructive" });
      return;
    }


    setIsSubmitting(true);
    let finalImageUrl: string | null = editingItem?.imageUrl || null;

    if (selectedImageFile) {
      // Upload new image
      const formData = new FormData();
      formData.append('file', selectedImageFile);

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Upload failed with status: ${response.status}. Response: ${errorText}`);
        }

        const result = await response.json();

        if (result.success && result.file_url) {
          finalImageUrl = result.file_url;
        } else {
          toast({ title: "Image Upload Failed", description: result.message || "Could not save the image.", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        toast({ title: "Upload Error", description: uploadError instanceof Error ? uploadError.message : "An error occurred while uploading the image.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
    } else if (imagePreviewUrl === null && editingItem?.imageUrl) {
      // Image was removed
      finalImageUrl = null;
    }


    let result;
    if (editingItem) {
      result = await updateModelAction(editingItem.id, itemName.trim(), finalImageUrl, itemDescription);
      if (result.success) {
        toast({ title: "Success", description: `Service "${itemName.trim()}" updated.` });
      }
    } else {
      result = await addModelAction(itemName.trim(), finalImageUrl, itemDescription);
      if (result.success) {
        toast({ title: "Success", description: `Service "${itemName.trim()}" added.` });
      }
    }

    if (result && result.success) {
      setIsAddEditDialogOpen(false);
      await fetchData();
    } else if (result) {
      toast({ title: "Error", description: result.error || `Could not save service.`, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleDeleteSubmit = async () => {
    if (!itemToDelete) return;
    setIsSubmitting(true);
    const result = await deleteModelAction(itemToDelete.id);

    if (result.success) {
      toast({ title: "Success", description: `Service "${itemToDelete.name}" deleted.` });
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      await fetchData();
    } else {
      toast({ title: "Error", description: result.error || `Could not delete service. It might be in use.`, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SYSTEM_ADMIN')) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Access Denied. You must be an Administrator or System Administrator to view this page.</p>
      </div>
    );
  }

  const renderItemList = (items: ServiceModelItem[], title: string, Icon: React.ElementType) => {
    return (
      <div className="flex flex-col gap-3 w-full flex-1 min-h-0">
        <div className="flex-none sticky top-[72px] z-20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-background py-3 -mt-3">
          <h2 className="text-xl font-medium tracking-tight text-foreground flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" /> Manage Services
          </h2>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${title}...`}
                value={modelSearchTerm}
                onChange={(e) => setModelSearchTerm(e.target.value)}
                className="pl-9 h-9 bg-white dark:bg-card border-input shadow-sm"
              />
            </div>
            <Button size="sm" onClick={openAddDialog} className="h-9 shrink-0">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New
            </Button>
          </div>
        </div>

        <Card className="flex-1 min-h-0 w-full overflow-hidden rounded-2xl border-zinc-100 bg-card shadow-lg shadow-zinc-200/50">
          <CardContent className="p-0 h-full">
          <div className="h-full overflow-auto rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-16 pl-5 text-[11px] font-semibold uppercase tracking-wider">SL</TableHead>
                  <TableHead className="w-[32%] text-[11px] font-semibold uppercase tracking-wider">Service</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Description</TableHead>
                  <TableHead className="w-28 pr-5 text-right text-[11px] font-semibold uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-16 w-full rounded-md" /></TableCell></TableRow>)
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="p-6 text-center text-muted-foreground">
                      <Icon className="mx-auto h-10 w-10 opacity-50 mb-2" />
                      No {modelSearchTerm ? `${title.toLowerCase()} found for "${modelSearchTerm}"` : `${title.toLowerCase()} found.`}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => {
                    return (
                      <TableRow key={item.id} className="border-zinc-100 hover:bg-primary/[0.03] transition-colors">
                        <TableCell className="pl-5 font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, '0')}</TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-3">
                            <SafeModelImage src={item.imageUrl} alt={item.name} size={40} />
                            <span className="font-semibold text-foreground">{item.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md text-sm text-muted-foreground">
                          <span className="line-clamp-2">{item.description || '—'}</span>
                        </TableCell>
                      <TableCell className="pr-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="icon" onClick={() => openEditDialog(item)} title={`Edit service`} className="h-8 w-8">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(item)}
                            title={`Delete service`}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive-foreground"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
  };

  return (
    <div className="flex flex-col p-4 sm:p-6 lg:p-8 pt-0 sm:pt-0 lg:pt-0" style={{ height: 'calc(100vh - 4.5rem)' }}>
      <div className="flex flex-col flex-1 min-h-0">
        {renderItemList(filteredModels, 'Services', Layers)}
      </div>

      <Dialog open={isAddEditDialogOpen} onOpenChange={(open) => {
        if (!isSubmitting) setIsAddEditDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit' : 'Add New'} Service</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the name, description and image of this service.' : 'Enter the name, description and image for the new service.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddEditSubmit} className="space-y-4 py-2">
            {/* Top Section: Image Upload Box + Name & Toggles */}
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {/* Left Side: Image Upload Box */}
              <div className="relative inline-block shrink-0">
                <div
                  onClick={() => !isSubmitting && fileInputRef.current?.click()}
                  className="relative h-24 w-24 rounded-md bg-muted flex items-center justify-center border border-dashed border-muted-foreground/40 hover:border-primary cursor-pointer group transition-all"
                  title="Click to upload/change image"
                >
                  {imagePreviewUrl ? (
                    <div className="relative w-full h-full">
                      <SafeModelImage src={imagePreviewUrl} alt="Model preview" size={96} className="w-full h-full" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-md">
                        <UploadCloud className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground group-hover:text-primary transition-colors">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>
                {imagePreviewUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage();
                    }}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full p-1 shadow-md transition-transform hover:scale-110 flex items-center justify-center z-10"
                    title="Remove Image"
                    disabled={isSubmitting}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Right Side: Name Input & Toggles */}
              <div className="flex-1 w-full flex flex-col sm:flex-row items-start gap-3">
                <div className="flex-1 w-full space-y-1">
                  <Label htmlFor="itemName" className="text-xs font-semibold">Name *</Label>
                  <Input
                    id="itemName"
                    placeholder="Name"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="itemDescription" className="text-xs font-semibold">Description</Label>
              <Textarea
                id="itemDescription"
                placeholder="Short description (optional)"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <Input
              id="modelImageFile"
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/jpeg,image/png,image/gif"
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddEditDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : (editingItem ? "Save Changes" : "Add Service")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {itemToDelete && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive" /> Are you absolutely sure?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the service "<span className="font-semibold">{itemToDelete.name}</span>".
                Ensure this option is not currently used by any orders before proceeding.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setItemToDelete(null)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSubmit} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={isSubmitting}>
                {isSubmitting ? "Deleting..." : `Yes, delete service`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

