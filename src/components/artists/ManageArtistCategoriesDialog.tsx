"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus, Trash2, Tag, ShieldCheck, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ArtistCategoryBadge } from './ArtistCategoryBadge';
import {
  getArtistCategoriesAction,
  addArtistCategoryAction,
  deleteArtistCategoryAction,
} from '@/app/(app)/artists/actions';

interface ManageArtistCategoriesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoriesChanged?: (allCategories: string[]) => void;
}

export function ManageArtistCategoriesDialog({
  isOpen,
  onOpenChange,
  onCategoriesChanged,
}: ManageArtistCategoriesDialogProps) {
  const { toast } = useToast();
  const [newCategory, setNewCategory] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const [defaults, setDefaults] = useState<string[]>(['Male', 'Female', 'Child', 'Influencer', 'Celebrity']);
  const [custom, setCustom] = useState<string[]>([]);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getArtistCategoriesAction();
      setDefaults(data.defaults);
      setCustom(data.custom);
      onCategoriesChanged?.(data.all);
    } catch (error) {
      console.error('Failed to load artist categories:', error);
      toast({
        title: 'Error',
        description: 'Failed to load artist categories.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, onCategoriesChanged]);

  useEffect(() => {
    if (isOpen) {
      setNewCategory('');
      loadCategories();
    }
  }, [isOpen, loadCategories]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategory.trim();
    if (!trimmed) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a category name.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addArtistCategoryAction(trimmed);
      if (result.success && result.categories) {
        setDefaults(result.categories.defaults);
        setCustom(result.categories.custom);
        setNewCategory('');
        toast({
          title: 'Category Added',
          description: `"${trimmed}" has been added to artist categories.`,
        });
        onCategoriesChanged?.(result.categories.all);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to add category.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while adding the category.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (categoryName: string) => {
    setDeletingName(categoryName);
    try {
      const result = await deleteArtistCategoryAction(categoryName);
      if (result.success && result.categories) {
        setDefaults(result.categories.defaults);
        setCustom(result.categories.custom);
        toast({
          title: 'Category Removed',
          description: `"${categoryName}" has been removed.`,
        });
        onCategoriesChanged?.(result.categories.all);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to remove category.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while deleting the category.',
        variant: 'destructive',
      });
    } finally {
      setDeletingName(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 pb-4 bg-muted/20 border-b">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Manage Artist Categories</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Standard and custom categories available when creating and filtering artists.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Add Category Form */}
          <form onSubmit={handleAdd} className="space-y-2">
            <Label htmlFor="new-artist-category" className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-primary" /> Add New Category
            </Label>
            <div className="flex gap-2">
              <Input
                id="new-artist-category"
                placeholder="e.g. Musician, Voice Artist, Model..."
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                maxLength={50}
                disabled={isSubmitting || isLoading}
                className="h-10 text-sm"
              />
              <Button
                type="submit"
                disabled={isSubmitting || isLoading || !newCategory.trim()}
                className="h-10 px-4 shrink-0 font-medium"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1.5" /> Add
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Categories List */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-500" /> Default System Categories
                </span>
                <span className="text-[11px] text-muted-foreground">Standard</span>
              </div>
              <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-muted/30 border">
                {defaults.map((cat) => (
                  <div key={cat} className="flex items-center gap-1.5 bg-background border px-2.5 py-1 rounded-full shadow-xs">
                    <ArtistCategoryBadge category={cat} />
                    <span className="text-[10px] text-muted-foreground font-medium px-1">Fixed</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-purple-500" /> Custom Admin Categories
                </span>
                <span className="text-[11px] text-muted-foreground">{custom.length} total</span>
              </div>

              {isLoading ? (
                <div className="h-24 flex items-center justify-center border rounded-xl bg-muted/20">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : custom.length === 0 ? (
                <div className="py-6 px-4 text-center border border-dashed rounded-xl bg-muted/10">
                  <p className="text-xs text-muted-foreground">No custom categories added yet.</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    Use the input above to add special categories for your roster.
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-48 border rounded-xl p-2 bg-muted/10">
                  <div className="space-y-1.5">
                    {custom.map((cat) => (
                      <div
                        key={cat}
                        className="flex items-center justify-between px-3 py-1.5 bg-background border rounded-lg hover:border-muted-foreground/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <ArtistCategoryBadge category={cat} />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(cat)}
                          disabled={deletingName === cat}
                          title={`Delete ${cat}`}
                        >
                          {deletingName === cat ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-3 bg-muted/20 border-t flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
