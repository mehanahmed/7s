
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { PlusCircle, Edit, Trash2, Palette, AlertTriangle, Eye, EyeOff, RefreshCw, Users, Undo, List } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import type { CustomStatus, UserRole } from "@/types";
import { getStatuses } from '@/lib/status-service';
import { 
  addStatusAction, 
  updateStatusAction, 
  deleteStatusAction,
  getDeletedStatusesAction,
  permanentDeleteStatusAction,
  restoreStatusAction
} from './actions';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox'; // For selecting roles
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DR_ROLES } from '@/lib/roles';

const AVAILABLE_ROLES_FOR_STATUS_ASSIGNMENT: UserRole[] = ['CR', ...DR_ROLES, 'ADMIN', 'VENDOR', 'LR'];

export default function AdminStatusesPage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [statuses, setStatuses] = useState<CustomStatus[]>([]);
  const [isTrashDialogOpen, setIsTrashDialogOpen] = useState(false);
  const [deletedStatuses, setDeletedStatuses] = useState<CustomStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [trashSearchQuery, setTrashSearchQuery] = useState('');

  const filteredStatuses = useMemo(() => {
    if (!searchQuery.trim()) return statuses;
    const q = searchQuery.toLowerCase().trim();
    return statuses.filter(status => 
      status.name.toLowerCase().includes(q) ||
      (status.allowedRoles && status.allowedRoles.some(role => role.toLowerCase().includes(q)))
    );
  }, [statuses, searchQuery]);

  const filteredDeletedStatuses = useMemo(() => {
    if (!trashSearchQuery.trim()) return deletedStatuses;
    const q = trashSearchQuery.toLowerCase().trim();
    return deletedStatuses.filter(status => 
      status.name.toLowerCase().includes(q) ||
      (status.allowedRoles && status.allowedRoles.some(role => role.toLowerCase().includes(q)))
    );
  }, [deletedStatuses, trashSearchQuery]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPermanentDeleteDialogOpen, setIsPermanentDeleteDialogOpen] = useState(false);

  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#0EA5E9');
  const [newStatusIsVisible, setNewStatusIsVisible] = useState(true);
  const [newStatusAllowedRoles, setNewStatusAllowedRoles] = useState<UserRole[]>([]);
  const [newStatusIsSystemStatus, setNewStatusIsSystemStatus] = useState(false);


  const [editingStatus, setEditingStatus] = useState<CustomStatus | null>(null);
  const [statusToDelete, setStatusToDelete] = useState<CustomStatus | null>(null);
  const [statusToPermanentlyDelete, setStatusToPermanentlyDelete] = useState<CustomStatus | null>(null);

  const fetchStatuses = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedStatuses = await getStatuses();
      setStatuses(fetchedStatuses);
      const deletedResult = await getDeletedStatusesAction();
      if (deletedResult.success && deletedResult.statuses) {
        setDeletedStatuses(deletedResult.statuses);
      }
    } catch (error) {
      console.error("Error fetching statuses:", error);
      toast({ title: "Error", description: "Could not load statuses.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUser && (currentUser.role === 'SYSTEM_ADMIN')) { // Only SYSTEM_ADMIN can access this page now
      fetchStatuses();
    } else if (currentUser) {
      router.replace('/dashboard');
    }
  }, [currentUser, router, fetchStatuses]);


  const handleAddStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusName.trim() || !newStatusColor.trim()) {
      toast({ title: "Validation Error", description: "Status name and color are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await addStatusAction(newStatusName, newStatusColor, newStatusIsVisible, newStatusAllowedRoles, newStatusIsSystemStatus);
    if (result.success && result.status) {
      toast({ title: "Success", description: `Status "${result.status.name}" added.` });
      setIsAddDialogOpen(false);
      setNewStatusName('');
      setNewStatusColor('#0EA5E9');
      setNewStatusIsVisible(true);
      setNewStatusAllowedRoles([]);
      setNewStatusIsSystemStatus(false);
      await fetchStatuses();
    } else {
      toast({ title: "Error", description: result.error || "Could not add status.", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const openEditDialog = (status: CustomStatus) => {
    setEditingStatus(status);
    setNewStatusName(status.name);
    setNewStatusColor(status.color);
    setNewStatusIsVisible(status.isVisible !== false);
    setNewStatusAllowedRoles(status.allowedRoles || []);
    setNewStatusIsSystemStatus(status.isSystemStatus || false);
    setIsEditDialogOpen(true);
  };

  const handleEditStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast({ title: "Authentication Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    if (!editingStatus || !newStatusName.trim() || !newStatusColor.trim()) {
      toast({ title: "Validation Error", description: "Status name and color are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await updateStatusAction(editingStatus.id, newStatusName, newStatusColor, newStatusIsVisible, newStatusAllowedRoles, currentUser.role, newStatusIsSystemStatus);
    if (result.success) {
      toast({ title: "Success", description: `Status "${editingStatus.name}" updated.` });
      setIsEditDialogOpen(false);
      setEditingStatus(null);
      setNewStatusIsSystemStatus(false);
      await fetchStatuses();
    } else {
      toast({ title: "Error updating status", description: result.error || "Could not update status.", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const openDeleteDialog = (status: CustomStatus) => {
    if (status.isSystemStatus && currentUser?.role !== 'SYSTEM_ADMIN') {
      toast({ title: "Action Denied", description: "System statuses can only be deleted by System Administrators.", variant: "destructive" });
      return;
    }
    setStatusToDelete(status);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteStatus = async () => {
    if (!statusToDelete || !currentUser) return;
    setIsSubmitting(true);
    const result = await deleteStatusAction(statusToDelete.id, currentUser.role);
    if (result.success) {
      toast({ title: "Success", description: `Status "${statusToDelete.name}" deleted.` });
      setIsDeleteDialogOpen(false);
      setStatusToDelete(null);
      await fetchStatuses();
    } else {
      toast({ title: "Error", description: result.error || "Could not delete status.", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleRestoreStatus = async (statusId: string, statusName: string) => {
    if (!currentUser) return;
    setIsSubmitting(true);
    const result = await restoreStatusAction(statusId);
    if (result.success) {
      toast({ title: "Success", description: `Status "${statusName}" restored.` });
      await fetchStatuses();
    } else {
      toast({ title: "Error", description: result.error || "Could not restore status.", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const openPermanentDeleteDialog = (status: CustomStatus) => {
    if (status.isSystemStatus && currentUser?.role !== 'SYSTEM_ADMIN') {
      toast({ title: "Action Denied", description: "System statuses can only be deleted by System Administrators.", variant: "destructive" });
      return;
    }
    setStatusToPermanentlyDelete(status);
    setIsPermanentDeleteDialogOpen(true);
  };

  const handlePermanentDeleteStatus = async () => {
    if (!statusToPermanentlyDelete || !currentUser) return;
    setIsSubmitting(true);
    const result = await permanentDeleteStatusAction(statusToPermanentlyDelete.id, currentUser.role);
    if (result.success) {
      toast({ title: "Success", description: `Status "${statusToPermanentlyDelete.name}" permanently deleted.` });
      setIsPermanentDeleteDialogOpen(false);
      setStatusToPermanentlyDelete(null);
      await fetchStatuses();
    } else {
      toast({ title: "Error", description: result.error || "Could not permanently delete status.", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleAllowedRoleChange = (role: UserRole, checked: boolean | "indeterminate") => {
    if (checked === true) {
      setNewStatusAllowedRoles(prev => [...prev, role]);
    } else {
      setNewStatusAllowedRoles(prev => prev.filter(r => r !== role));
    }
  };


  if (!currentUser || currentUser.role !== 'SYSTEM_ADMIN') { // Strict check for SYSTEM_ADMIN
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Access Denied. You must be a System Administrator to view this page.</p>
      </div>
    );
  }

  const StatusColorPreview = ({ color }: { color: string }) => (
    <div className="w-6 h-6 rounded-md border border-border" style={{ backgroundColor: color }} />
  );

  const renderAllowedRolesCheckboxes = (isEditingDialog: boolean) => {
    const currentSelectedRoles = isEditingDialog && editingStatus ? newStatusAllowedRoles : newStatusAllowedRoles;
    const isSystemStatusBeingEdited = isEditingDialog && editingStatus?.isSystemStatus;
    // System Admins can always edit system status roles. Regular Admins cannot.
    const disabledForNonSysAdminOnSystemStatus = isSystemStatusBeingEdited && currentUser?.role !== 'SYSTEM_ADMIN';

    return (
      <div className="space-y-3">
        <Label>Restrict Assignment To Roles:</Label>
        <div className="grid grid-cols-2 gap-3">
          {AVAILABLE_ROLES_FOR_STATUS_ASSIGNMENT.map(role => (
            <div key={role} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50">
              <Checkbox
                id={`${isEditingDialog ? 'edit' : 'add'}-role-${role}`}
                checked={currentSelectedRoles.includes(role)}
                onCheckedChange={(checked) => handleAllowedRoleChange(role, checked)}
                disabled={isSubmitting || disabledForNonSysAdminOnSystemStatus}
              />
              <Label htmlFor={`${isEditingDialog ? 'edit' : 'add'}-role-${role}`} className="text-sm font-normal">
                {role.replace(/_/g, ' ')}
              </Label>
            </div>
          ))}
        </div>
        {disabledForNonSysAdminOnSystemStatus && (
          <p className="text-xs text-muted-foreground mt-1">Assignment permissions for system statuses can only be changed by a System Administrator.</p>
        )}
        <p className="text-xs text-muted-foreground">
          If no roles are selected, any user with permission to change statuses can assign this status. System Admins always have permission.
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 page-header">
        <div>
          <h1 className="page-title">Order Status Management</h1>
          <p className="page-description">
            Define custom order statuses, colors, visibility, and role-based assignment permissions.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setIsTrashDialogOpen(true)} 
            disabled={isLoading}
            className="h-10 w-10 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all hover:scale-105" 
            title="View Trash (Deleted Statuses)"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
          <Button size="lg" onClick={() => setIsAddDialogOpen(true)} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground rounded-md shadow-md hover:shadow-lg transition-shadow h-10">
            <PlusCircle className="mr-2 h-5 w-5" />
            Add New Status
          </Button>
        </div>
      </div>

      <Card className="shadow-xl border bg-card rounded-lg overflow-hidden">
        <CardHeader className="border-b p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-card-foreground text-xl">Current Statuses</CardTitle>
            <CardDescription className="text-muted-foreground text-sm mt-0.5">
              Manage status properties. System status names and permissions can only be fully edited by System Admins.
            </CardDescription>
          </div>
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search statuses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 bg-background rounded-md shadow-sm border border-input/60 focus-visible:ring-1 focus-visible:ring-primary w-full"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px] text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">Color</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Visibility</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Allowed Roles</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-4 pl-6"><Skeleton className="h-6 w-6 rounded-md" /></TableCell>
                      <TableCell className="py-4"><Skeleton className="h-5 w-32 rounded" /></TableCell>
                      <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded" /></TableCell>
                      <TableCell className="py-4 text-center">
                        <div className="flex justify-center">
                          <Skeleton className="h-5 w-20 rounded" />
                        </div>
                      </TableCell>
                      <TableCell className="py-4"><Skeleton className="h-5 w-48 rounded" /></TableCell>
                      <TableCell className="text-right py-4 pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <Skeleton className="h-8 w-8 rounded-md" />
                          <Skeleton className="h-8 w-8 rounded-md" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : statuses.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Palette className="mx-auto h-12 w-12 opacity-50 mb-3" />
              No custom statuses found. Add one to get started!
            </div>
          ) : filteredStatuses.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Palette className="mx-auto h-12 w-12 opacity-50 mb-3" />
              No statuses match your search query.
            </div>
          ) : (
            <div className="overflow-x-auto animate-in fade-in duration-300">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px] text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">Color</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Visibility</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Allowed Roles</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStatuses.map((status) => (
                    <TableRow key={status.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="py-3.5 pl-6">
                        <StatusColorPreview color={status.color} />
                      </TableCell>
                      <TableCell className="font-semibold text-foreground py-3.5">
                        {status.name}
                      </TableCell>
                      <TableCell className="py-3.5">
                        {status.isSystemStatus ? (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">
                            System
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-750">
                            Custom
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center py-3.5">
                        {status.isVisible !== false ? (
                          <span className="inline-flex items-center text-xs font-medium text-green-600 dark:text-green-400 gap-1.5 justify-center w-full" title="Visible in dropdowns">
                            <Eye className="h-4 w-4 text-green-500" />
                            <span className="text-[11px] font-semibold">Visible</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-medium text-muted-foreground gap-1.5 justify-center w-full" title="Hidden in dropdowns">
                            <EyeOff className="h-4 w-4" />
                            <span className="text-[11px]">Hidden</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5 text-xs text-foreground/80 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span>
                            {status.allowedRoles && status.allowedRoles.length > 0 
                              ? status.allowedRoles.map(r => r.replace(/_/g, ' ')).join(', ') 
                              : 'All Permitted'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-3.5 pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="icon" onClick={() => openEditDialog(status)} title="Edit Status" className="h-8 w-8 hover:bg-muted/80 transition-colors">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(status)}
                            title="Delete Status"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive-foreground transition-colors"
                            disabled={status.isSystemStatus && currentUser?.role !== 'SYSTEM_ADMIN'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Status Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-lg" onFocusOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Add New Order Status</DialogTitle>
            <DialogDescription>Define properties for the new status.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddStatus} className="space-y-4 py-2">
            <div>
              <Label htmlFor="newStatusName">Status Name</Label>
              <Input id="newStatusName" value={newStatusName} onChange={(e) => setNewStatusName(e.target.value)} required disabled={isSubmitting} />
            </div>
            <div className="flex items-center gap-4">
              <Label htmlFor="newStatusColor">Status Color</Label>
              <Input id="newStatusColor" type="color" value={newStatusColor} onChange={(e) => setNewStatusColor(e.target.value)} className="w-20 h-10 p-1" required disabled={isSubmitting} />
              <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: newStatusColor }} />
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center space-x-2">
                <Switch id="newStatusIsVisible" checked={newStatusIsVisible} onCheckedChange={setNewStatusIsVisible} disabled={isSubmitting} />
                <Label htmlFor="newStatusIsVisible">Visible in dropdowns</Label>
              </div>
              {currentUser?.role === 'SYSTEM_ADMIN' && (
                <div className="flex items-center space-x-2">
                  <Switch id="newStatusIsSystemStatus" checked={newStatusIsSystemStatus} onCheckedChange={setNewStatusIsSystemStatus} disabled={isSubmitting} />
                  <Label htmlFor="newStatusIsSystemStatus">System Status</Label>
                </div>
              )}
            </div>
            <Separator />
            {renderAllowedRolesCheckboxes(false)}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Adding..." : "Add Status"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Status Dialog */}
      {editingStatus && currentUser && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-lg" onFocusOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Edit Order Status: {editingStatus.name}</DialogTitle>
              <DialogDescription>Update properties for this status.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditStatus} className="space-y-4 py-2">
              <div>
                <Label htmlFor="editStatusName">Status Name</Label>
                <Input
                  id="editStatusName"
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  required
                  disabled={isSubmitting || (editingStatus.isSystemStatus && currentUser.role !== 'SYSTEM_ADMIN')}
                />
                {editingStatus.isSystemStatus && currentUser.role !== 'SYSTEM_ADMIN' &&
                  <p className="text-xs text-muted-foreground mt-1">System status names can only be changed by a System Administrator.</p>}
              </div>
              <div className="flex items-center gap-4">
                <Label htmlFor="editStatusColor">Status Color</Label>
                <Input id="editStatusColor" type="color" value={newStatusColor} onChange={(e) => setNewStatusColor(e.target.value)} className="w-20 h-10 p-1" required disabled={isSubmitting} />
                <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: newStatusColor }} />
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center space-x-2">
                  <Switch id="editStatusIsVisible" checked={newStatusIsVisible} onCheckedChange={setNewStatusIsVisible} disabled={isSubmitting} />
                  <Label htmlFor="editStatusIsVisible">Visible in dropdowns</Label>
                </div>
                {currentUser?.role === 'SYSTEM_ADMIN' && (
                  <div className="flex items-center space-x-2">
                    <Switch id="editStatusIsSystemStatus" checked={newStatusIsSystemStatus} onCheckedChange={setNewStatusIsSystemStatus} disabled={isSubmitting} />
                    <Label htmlFor="editStatusIsSystemStatus">System Status</Label>
                  </div>
                )}
              </div>
              <Separator />
              {renderAllowedRolesCheckboxes(true)}
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Updating..." : "Save Changes"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {statusToDelete && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive" /> Delete Status
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will delete the status "<span className="font-semibold">{statusToDelete.name}</span>". 
                The status will be moved to the Trash list, and you can restore it later if needed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setStatusToDelete(null)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteStatus} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={isSubmitting}>
                {isSubmitting ? "Deleting..." : "Move to Trash"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {statusToPermanentlyDelete && (
        <AlertDialog open={isPermanentDeleteDialogOpen} onOpenChange={setIsPermanentDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive animate-pulse" /> Permanently Delete Status
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action <span className="font-bold text-destructive">cannot</span> be undone. This will permanently and physically delete the status
                "<span className="font-semibold">{statusToPermanentlyDelete.name}</span>" from the database.
                <span className="block mt-2 font-medium text-destructive">
                  Warning: If any existing orders are currently using this status, permanently deleting it will cause them to show no status. Ensure no orders are currently using this status before proceeding.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setStatusToPermanentlyDelete(null)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handlePermanentDeleteStatus} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold" disabled={isSubmitting}>
                {isSubmitting ? "Deleting Permanently..." : "Yes, permanently delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Trash Dialog */}
      <Dialog open={isTrashDialogOpen} onOpenChange={setIsTrashDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-destructive">
              <Trash2 className="h-5 w-5" /> Deleted Statuses (Trash)
            </DialogTitle>
            <DialogDescription>
              View and manage soft-deleted statuses. System administrators can restore or permanently delete them.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {deletedStatuses.length > 0 && (
              <div className="w-full max-w-sm">
                <Input
                  placeholder="Search deleted statuses..."
                  value={trashSearchQuery}
                  onChange={(e) => setTrashSearchQuery(e.target.value)}
                  className="h-9 bg-background text-sm rounded-md shadow-sm border border-input/60 focus-visible:ring-1 focus-visible:ring-primary w-full"
                />
              </div>
            )}

            {deletedStatuses.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                <Trash2 className="mx-auto h-12 w-12 opacity-50 mb-3" />
                No deleted statuses found in trash.
              </div>
            ) : filteredDeletedStatuses.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                <Trash2 className="mx-auto h-12 w-12 opacity-50 mb-3" />
                No deleted statuses match your search.
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[100px] text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">Color</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Visibility</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Allowed Roles</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeletedStatuses.map((status) => (
                      <TableRow key={status.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="py-3.5 pl-6">
                          <StatusColorPreview color={status.color} />
                        </TableCell>
                        <TableCell className="font-semibold text-foreground py-3.5">
                          {status.name}
                        </TableCell>
                        <TableCell className="py-3.5">
                          {status.isSystemStatus ? (
                            <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">
                              System
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-750">
                              Custom
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center py-3.5">
                          {status.isVisible !== false ? (
                            <span className="inline-flex items-center text-xs font-medium text-green-600 dark:text-green-400 gap-1.5 justify-center w-full" title="Visible in dropdowns">
                              <Eye className="h-4 w-4 text-green-500" />
                              <span className="text-[11px] font-semibold">Visible</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-xs font-medium text-muted-foreground gap-1.5 justify-center w-full" title="Hidden in dropdowns">
                              <EyeOff className="h-4 w-4" />
                              <span className="text-[11px]">Hidden</span>
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5 text-xs text-foreground/80 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span>
                              {status.allowedRoles && status.allowedRoles.length > 0 
                                ? status.allowedRoles.map(r => r.replace(/_/g, ' ')).join(', ') 
                                : 'All Permitted'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-3.5 pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="icon" 
                              onClick={() => handleRestoreStatus(status.id, status.name)} 
                              title="Restore Status" 
                              className="h-8 w-8 hover:bg-green-50 dark:hover:bg-green-950/20 text-green-650 dark:text-green-400 hover:text-green-750 border-green-200 dark:border-green-900/50 transition-colors"
                              disabled={isSubmitting}
                            >
                              <Undo className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openPermanentDeleteDialog(status)}
                              title="Permanently Delete Status"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive-foreground transition-colors"
                              disabled={isSubmitting || (status.isSystemStatus && currentUser?.role !== 'SYSTEM_ADMIN')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setIsTrashDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
