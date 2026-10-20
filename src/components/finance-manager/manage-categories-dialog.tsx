
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TransactionCategory } from "@/types";
import { Trash2, Edit2, Check, X } from 'lucide-react';
import * as Lucide from 'lucide-react';
import { cn } from "@/lib/utils";
import { updateTransactionCategoriesAction } from '@/app/(app)/expenses/actions';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { getFinanceColorClasses } from '@/lib/finance-colors';

interface ManageCategoriesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categories: TransactionCategory[];
  onCategoriesUpdated: () => void;
}

const COMMON_ICONS = ["Home", "Lightbulb", "Car", "ClipboardIcon", "Utensils", "Megaphone", "ShoppingBag", "SendHorizonal", "Banknote", "Briefcase", "Braces", "Tag", "ShoppingCart", "Plane", "Music", "Coffee", "Gift", "Smartphone", "Heart", "Star", "Package", "Truck", "Scissors", "Pencil"];

const COMMON_COLORS = [
  { label: "Blue", value: "text-blue-600" },
  { label: "Green", value: "text-green-600" },
  { label: "Red", value: "text-red-600" },
  { label: "Yellow", value: "text-yellow-600" },
  { label: "Purple", value: "text-purple-600" },
  { label: "Pink", value: "text-pink-600" },
  { label: "Indigo", value: "text-indigo-600" },
  { label: "Teal", value: "text-teal-600" },
  { label: "Rose", value: "text-rose-600" },
  { label: "Amber", value: "text-amber-600" },
  { label: "Emerald", value: "text-emerald-600" },
];

const getIconComponent = (iconName: string) => {
  return (Lucide as any)[iconName] || Lucide.HelpCircle;
};

function IconPicker({ value, onChange, colorClass }: { value: string; onChange: (v: string) => void; colorClass: string }) {
  const Icon = getIconComponent(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-10 w-10 shrink-0 p-0" aria-label="Choose icon">
          <Icon className={cn("h-5 w-5", colorClass)} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="grid grid-cols-6 gap-1">
          {COMMON_ICONS.map((icon) => {
            const I = getIconComponent(icon);
            return (
              <button key={icon} type="button" onClick={() => onChange(icon)} className={cn("flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted", value === icon && "bg-primary/10 ring-1 ring-primary")}>
                <I className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
            {COMMON_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          title={color.label}
          aria-label={color.label}
          onClick={() => onChange(color.value)}
          className={cn("h-5 w-5 rounded-full", getFinanceColorClasses(color.value).bg, value === color.value && "ring-2 ring-offset-2 ring-primary")}
        />
      ))}
    </div>
  );
}

export const ManageCategoriesDialog = ({ isOpen, onClose, categories, onCategoriesUpdated }: ManageCategoriesDialogProps) => {
  const { toast } = useToast();
  const [localCategories, setLocalCategories] = useState<TransactionCategory[]>(categories);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("Tag");
  const [newCatColor, setNewCatColor] = useState("text-blue-600");
  const [newCatType, setNewCatType] = useState<'expense' | 'purchase'>('expense');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editType, setEditType] = useState<'expense' | 'purchase'>('expense');

  // Reset only when the dialog opens; the parent re-renders (and re-sends `categories`) often,
  // which would otherwise wipe unsaved additions/edits.
  React.useEffect(() => {
    if (isOpen) {
      setLocalCategories(categories);
      setEditingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleAddCategory = () => {
    if (!newCatLabel.trim()) return;
    
    const newCategory: TransactionCategory = {
      id: uuidv4(),
      value: newCatLabel.trim(),
      label: newCatLabel.trim(),
      icon: newCatIcon,
      colorClass: newCatColor,
      type: newCatType,
      isSystem: false
    };

    setLocalCategories([...localCategories, newCategory]);
    setNewCatLabel("");
    setNewCatIcon("Tag");
    setNewCatColor("text-blue-600");
  };

  const handleStartEdit = (cat: TransactionCategory) => {
    if (cat.isSystem) return;
    setEditingId(cat.id);
    setEditLabel(cat.label);
    setEditIcon(cat.icon);
    setEditColor(cat.colorClass);
    setEditType(cat.type);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    setLocalCategories(localCategories.map(cat => 
      cat.id === editingId ? { ...cat, label: editLabel, value: editLabel, icon: editIcon, colorClass: editColor, type: editType } : cat
    ));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const cat = localCategories.find(c => c.id === id);
    if (cat?.isSystem) return;
    setLocalCategories(localCategories.filter(c => c.id !== id));
  };

  const handleSaveAll = async () => {
    setIsSubmitting(true);
    const result = await updateTransactionCategoriesAction(localCategories);
    setIsSubmitting(false);
    if (result.success) {
      toast({ title: "Success", description: "Categories updated successfully." });
      onCategoriesUpdated();
      onClose();
    } else {
      toast({ title: "Error", description: result.error || "Failed to update categories.", variant: "destructive" });
    }
  };
  
  const customCategories = localCategories.filter(c => !c.isSystem);

  const renderCategoryItem = (cat: TransactionCategory) => {
    const Icon = getIconComponent(cat.icon);

    if (editingId === cat.id) {
      return (
        <div key={cat.id} className="space-y-3 py-3">
          <div className="flex items-center gap-2">
            <IconPicker value={editIcon} onChange={setEditIcon} colorClass={editColor} />
            <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Category name" className="flex-1" autoFocus />
            <Button size="icon" variant="ghost" onClick={handleSaveEdit} disabled={!editLabel.trim()} aria-label="Save"><Check className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} aria-label="Cancel"><X className="h-4 w-4" /></Button>
          </div>
          <ColorPicker value={editColor} onChange={setEditColor} />
        </div>
      );
    }

    return (
      <div key={cat.id} className="flex items-center gap-3 py-2.5">
        <Icon className={cn("h-4 w-4 shrink-0", cat.colorClass)} />
        <span className="min-w-0 flex-1 truncate text-sm">{cat.label}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => handleStartEdit(cat)} aria-label="Edit category">
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(cat.id)} aria-label="Delete category">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>Add or edit your custom categories.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto py-2 custom-scrollbar">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <IconPicker value={newCatIcon} onChange={setNewCatIcon} colorClass={newCatColor} />
              <Input
                id="new-cat-label"
                value={newCatLabel}
                onChange={(e) => setNewCatLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); } }}
                placeholder="New category name"
                className="flex-1"
              />
              <Button onClick={handleAddCategory} disabled={!newCatLabel.trim()}>Add</Button>
            </div>
            <ColorPicker value={newCatColor} onChange={setNewCatColor} />
          </div>

          <div className="divide-y border-t">
            {customCategories.length > 0 ? (
              customCategories.map((cat) => renderCategoryItem(cat))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No custom categories.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSaveAll} disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
