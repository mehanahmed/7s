
"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Dr2oEntry } from '@/types';
import { format, parseISO } from 'date-fns';

interface ViewLrEntryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  entry: Dr2oEntry | null;
}

export function ViewLrEntryDialog({ isOpen, onOpenChange, entry }: ViewLrEntryDialogProps) {
  if (!entry) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>LR Entry Details</DialogTitle>
          <DialogDescription>
            Viewing items for {entry.crmName} on {format(parseISO(entry.date), 'PPP')}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            <ScrollArea className="h-auto max-h-[60vh] border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-muted">
                        <TableRow>
                            <TableHead>Company Name</TableHead>
                            <TableHead>Product Name</TableHead>
                            <TableHead>Product Qty</TableHead>
                            <TableHead>Courier ID</TableHead>
                            <TableHead>Due Order Name</TableHead>
                            <TableHead>Due Order Qty</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {entry.lrItems && entry.lrItems.length > 0 ? (
                            entry.lrItems.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.companyName}</TableCell>
                                    <TableCell>{item.productName}</TableCell>
                                    <TableCell>{item.productQty}</TableCell>
                                    <TableCell>{item.courierId}</TableCell>
                                    <TableCell>{item.dueOrderName}</TableCell>
                                    <TableCell>{item.dueOrderQty}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                    No items were recorded for this entry.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ViewLrEntryDialog;
