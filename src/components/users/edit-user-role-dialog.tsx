
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { User, UserRole, UserRoleDefinition } from "@/types";
import { getRoles } from '@/lib/user-role-service';

interface EditUserRoleDialogProps {
  user: User;
  currentUser: User; 
  onUserRoleUpdated: (userId: string, newRole: UserRole) => Promise<void>; 
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserRoleDialog({ user, currentUser, onUserRoleUpdated, isOpen, onOpenChange }: EditUserRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<UserRoleDefinition[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSelectedRole(user.role);
      const fetchRoles = async () => {
        const roles = await getRoles();
        setAvailableRoles(roles);
      };
      fetchRoles();
    }
  }, [user, isOpen]);

  const canChangeRole = () => {
    if (!currentUser) return false;
    if (currentUser.role === 'SYSTEM_ADMIN') return true; 
    if (currentUser.role === 'ADMIN') {
      return !(currentUser.id === user.id || user.role === 'ADMIN' || user.role === 'SYSTEM_ADMIN');
    }
    return false;
  };
  const isRoleChangeAllowed = canChangeRole();

  const filteredRolesForSelection = useMemo(() => {
    if (currentUser.role === 'SYSTEM_ADMIN') return availableRoles; 
    if (currentUser.role === 'ADMIN') {
      if (user.id === currentUser.id || user.role === 'SYSTEM_ADMIN' || user.role === 'ADMIN') {
        return availableRoles.filter(r => r.id === user.role);
      }
      return availableRoles.filter(r => r.id !== 'SYSTEM_ADMIN');
    }
    return availableRoles.filter(r => r.id === user.role);
  }, [availableRoles, currentUser.role, user.id, user.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRoleChangeAllowed) return;
    if (selectedRole === user.role) {
        onOpenChange(false);
        return;
    }
    setIsSubmitting(true);
    try {
      await onUserRoleUpdated(user.id, selectedRole);
    } catch (error) {
      console.error("Error in EditUserRoleDialog handleSubmit:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User Role</DialogTitle>
          <DialogDescription>Change the role for {user.name} ({user.email}).</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role-edit" className="text-right">Role</Label>
              <Select 
                value={selectedRole} 
                onValueChange={(value) => setSelectedRole(value as UserRole)}
                disabled={!isRoleChangeAllowed || (filteredRolesForSelection.length <= 1) || isSubmitting}
              >
                <SelectTrigger id="role-edit" className="col-span-3">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {filteredRolesForSelection.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isRoleChangeAllowed && (
              <p className="col-span-4 text-sm text-destructive text-center">
                {currentUser.role === 'ADMIN' && (currentUser.id === user.id) ? "Admins cannot change their own role." :
                 currentUser.role === 'ADMIN' && (user.role === 'ADMIN' || user.role === 'SYSTEM_ADMIN') ? `Admins cannot change ${user.role.replace(/_/g, ' ')} roles.` :
                 "You do not have permission to change this role."}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={!isRoleChangeAllowed || selectedRole === user.role || isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
