
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
import type { TaskEntry } from "@/types";
import { Loader2, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface DeleteTaskDialogProps {
  task: TaskEntry;
  onConfirmDelete: () => Promise<void>;
  isDeleting: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteTaskDialog({ task, onConfirmDelete, isDeleting, isOpen, onOpenChange }: DeleteTaskDialogProps) {

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { if (!isDeleting) onOpenChange(open) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Task Entry?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the task entry for <span className="font-semibold">{task.userName}</span> from <span className="font-semibold">{format(parseISO(task.date), 'PPP')}</span>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)} disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirmDelete} 
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90" 
            disabled={isDeleting}
          >
            {isDeleting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>
            ) : "Yes, Delete Entry"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
