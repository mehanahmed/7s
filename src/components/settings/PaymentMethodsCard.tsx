"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, Edit, PlusCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getPaymentMethods } from '@/lib/service-options-service';
import { addPaymentMethodAction, updatePaymentMethodAction, deletePaymentMethodAction } from '@/app/(app)/admin/service-management/actions';
import type { ServicePaymentMethodItem } from '@/types';

/** Add / rename / delete the payment methods offered on orders and quotations. */
export function PaymentMethodsCard() {
  const { toast } = useToast();
  const [items, setItems] = useState<ServicePaymentMethodItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServicePaymentMethodItem | null>(null);
  const [name, setName] = useState('');
  const [toDelete, setToDelete] = useState<ServicePaymentMethodItem | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setItems(await getPaymentMethods());
    } catch {
      toast({ title: 'Error', description: 'Could not load payment methods.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setName(''); setDialogOpen(true); };
  const openEdit = (item: ServicePaymentMethodItem) => { setEditing(item); setName(item.name); setDialogOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = name.trim();
    if (!value) {
      toast({ title: 'Validation Error', description: 'Name cannot be empty.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    const result = editing ? await updatePaymentMethodAction(editing.id, value) : await addPaymentMethodAction(value);
    setIsSubmitting(false);
    if (result.success) {
      toast({ title: editing ? 'Payment method updated' : 'Payment method added', description: value });
      setDialogOpen(false);
      load();
    } else {
      toast({ title: 'Failed', description: result.error || 'Could not save the payment method.', variant: 'destructive' });
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setIsSubmitting(true);
    const result = await deletePaymentMethodAction(toDelete.id);
    setIsSubmitting(false);
    if (result.success) {
      toast({ title: 'Payment method deleted', description: toDelete.name });
      setToDelete(null);
      load();
    } else {
      toast({ title: 'Delete failed', description: result.error || 'Could not delete the payment method.', variant: 'destructive' });
    }
  };

  return (
    <>
      <Card className="shadow-xl border bg-card rounded-lg overflow-hidden">
        <CardHeader className="border-b p-5 flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-card-foreground text-xl flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-primary" /> Payment Methods
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm mt-0.5">
              Methods offered when recording a payment on orders and quotations.
            </CardDescription>
          </div>
          <Button onClick={openAdd} className="h-9 shrink-0 shadow-md">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card/50 p-8 text-center text-muted-foreground">
              <CreditCard className="mx-auto mb-2 h-10 w-10 opacity-50" />
              No payment methods yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-3 transition-all hover:bg-muted/30 hover:shadow-sm">
                  <span className="min-w-0 flex-1 truncate pr-2 text-sm font-semibold text-foreground" title={item.name}>{item.name}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => openEdit(item)} title="Edit payment method" className="h-8 w-8">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setToDelete(item)} title="Delete payment method" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!isSubmitting) setDialogOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Add New'} Payment Method</DialogTitle>
            <DialogDescription>{editing ? 'Update the name of this payment method.' : 'Enter the name of the new payment method.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4 py-2">
            <Input placeholder="e.g., Bank Transfer" value={name} onChange={(e) => setName(e.target.value)} required disabled={isSubmitting} maxLength={100} autoFocus />
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : editing ? 'Save Changes' : 'Add Method'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o && !isSubmitting) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" /> Delete payment method?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes "<span className="font-semibold">{toDelete?.name}</span>". Payments already recorded with it keep their saved name.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isSubmitting}>
              {isSubmitting ? 'Deleting...' : 'Yes, delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
