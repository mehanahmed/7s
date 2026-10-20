
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, UserCog, Target, UserX, UserCheck, AlertTriangle, Edit3 as EditInfoIcon, MoreVertical, KeyRound, Edit, Trash2, RefreshCw, Loader2, Filter, LogIn, Eye, BadgeCheck, Unlock, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import type { User, UserRole, UserRoleDefinition } from "@/types";
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  getUsers,
  updateUserRole,
  updateUserPassword,
  updateUserAvatar,
  updateUserTargets,
} from '@/lib/user-service';
import { getRoles } from '@/lib/user-role-service';
import { toggleUserBanStatusAction, updateUserInfoAction, deleteUserAction, unlockUserPinAccountAction, updateUserAssignedDivisionsAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getContrastTextColor } from '@/lib/color-utils';
import { isDrRole } from '@/lib/roles';
import { format } from 'date-fns';

const AddUserDialog = dynamic(() => import('@/components/users/add-user-dialog').then(mod => mod.AddUserDialog));
const EditUserInfoDialog = dynamic(() => import('@/components/users/edit-user-info-dialog').then(mod => mod.EditUserInfoDialog));
const EditUserRoleDialog = dynamic(() => import('@/components/users/edit-user-role-dialog').then(mod => mod.EditUserRoleDialog));
const ChangePasswordDialog = dynamic(() => import('@/components/users/change-password-dialog').then(mod => mod.ChangePasswordDialog));
const SetUserAvatarDialog = dynamic(() => import('@/components/users/set-user-avatar-dialog').then(mod => mod.SetUserAvatarDialog));
const SetUserSalesTargetDialog = dynamic(() => import('@/components/users/set-user-sales-target-dialog').then(mod => mod.SetUserSalesTargetDialog));
const DeleteUserDialog = dynamic(() => import('@/components/users/delete-user-dialog').then(mod => mod.DeleteUserDialog));
const AdminSetUserPinDialog = dynamic(() => import('@/components/users/admin-set-user-pin-dialog').then(mod => mod.AdminSetUserPinDialog));
const AssignZoneDialog = dynamic(() => import('@/components/users/AssignZoneDialog').then(mod => mod.AssignZoneDialog));


export default function UsersPage() {
  const { currentUser, refreshCurrentUser, impersonate } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading: isLoadingUsersList, refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => getUsers(),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: Boolean(currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SYSTEM_ADMIN')),
  });

  const { data: availableRoles = [], refetch: refetchRoles } = useQuery<UserRoleDefinition[]>({
    queryKey: ['user-roles'],
    queryFn: () => getRoles(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const isLoadingUsers = isLoadingUsersList && users.length === 0;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Locked' | 'Banned'>('Active');

  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);

  const [userToToggleBan, setUserToToggleBan] = useState<User | null>(null);
  const [isBanDialogVisible, setIsBanDialogVisible] = useState(false);

  const [userToEditInfo, setUserToEditInfo] = useState<User | null>(null);
  const [isEditInfoDialogOpen, setIsEditInfoDialogOpen] = useState(false);

  const [userToEditRole, setUserToEditRole] = useState<User | null>(null);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);

  const [userToChangePassword, setUserToChangePassword] = useState<User | null>(null);
  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false);

  const [userToSetAvatar, setUserToSetAvatar] = useState<User | null>(null);
  const [isSetAvatarDialogOpen, setIsSetAvatarDialogOpen] = useState(false);

  const [userToSetTargets, setUserToSetTargets] = useState<User | null>(null);
  const [isSetTargetsDialogOpen, setIsSetTargetsDialogOpen] = useState(false);

  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const [userToManagePin, setUserToManagePin] = useState<User | null>(null);
  const [isAdminSetPinDialogOpen, setIsAdminSetPinDialogOpen] = useState(false);

  const [userToAssignZone, setUserToAssignZone] = useState<User | null>(null);
  const [isAssignZoneDialogOpen, setIsAssignZoneDialogOpen] = useState(false);

  const fetchUsers = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['users'] }),
      queryClient.invalidateQueries({ queryKey: ['user-roles'] }),
    ]);
  }, [queryClient]);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN' && currentUser.role !== 'SYSTEM_ADMIN') {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  const handleUserAdded = async () => {
    toast({ title: "User Added", description: `New user has been added. Default password is 'password'.` });
    await fetchUsers();
    setIsAddUserDialogOpen(false);
  };

  const handleUserRoleUpdated = async () => {
    toast({ title: "Role Updated", description: `User role has been updated.` });
    await fetchUsers();
    if (currentUser && userToEditRole && userToEditRole.id === currentUser.id && typeof refreshCurrentUser === 'function') {
      await refreshCurrentUser();
    }
    setIsEditRoleDialogOpen(false);
    setUserToEditRole(null);
  };

  const handlePasswordChanged = async () => {
    toast({ title: "Password Updated", description: `Password for user has been updated successfully.` });
    await fetchUsers();
    if (currentUser && userToChangePassword && userToChangePassword.id === currentUser.id && typeof refreshCurrentUser === 'function') {
      await refreshCurrentUser();
    }
    setIsChangePasswordDialogOpen(false);
    setUserToChangePassword(null);
  };

  const handleUserAvatarSetByAdmin = async () => {
    toast({ title: "Avatar Updated", description: "User's avatar has been set." });
    await fetchUsers();
    if (currentUser && userToSetAvatar && userToSetAvatar.id === currentUser.id && typeof refreshCurrentUser === 'function') {
      await refreshCurrentUser();
    }
    setIsSetAvatarDialogOpen(false);
    setUserToSetAvatar(null);
  };

  const handleUserTargetsSetByAdmin = async () => {
    toast({ title: "Sales Targets Updated", description: "User's sales targets have been set." });
    await fetchUsers();
    if (currentUser && userToSetTargets && userToSetTargets.id === currentUser.id && typeof refreshCurrentUser === 'function') {
      await refreshCurrentUser();
    }
    setIsSetTargetsDialogOpen(false);
    setUserToSetTargets(null);
  };

  const handleToggleBanStatus = async () => {
    if (!userToToggleBan) return;
    const currentBanStatus = userToToggleBan.isBanned || false;
    const result = await toggleUserBanStatusAction(userToToggleBan.id, currentBanStatus);

    if (result.success) {
      toast({
        title: `User ${result.newBanStatus ? 'Banned' : 'Unbanned'}`,
        description: `${userToToggleBan.name} has been ${result.newBanStatus ? 'banned' : 'unbanned'}.`,
      });
      await fetchUsers();
      if (currentUser && userToToggleBan.id === currentUser.id && result.newBanStatus && typeof refreshCurrentUser === 'function') {
        await refreshCurrentUser();
      }
    } else {
      toast({
        title: "Operation Failed",
        description: result.error || `Could not ${currentBanStatus ? 'unban' : 'ban'} user.`,
        variant: "destructive",
      });
    }
    setIsBanDialogVisible(false);
    setUserToToggleBan(null);
  };

  const handleUserInfoUpdated = async () => {
    toast({ title: "User Info Updated", description: "User's information has been updated." });
    await fetchUsers();
    if (currentUser && userToEditInfo && userToEditInfo.id === currentUser.id && typeof refreshCurrentUser === 'function') {
      await refreshCurrentUser();
    }
    setIsEditInfoDialogOpen(false);
    setUserToEditInfo(null);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);

    const result = await deleteUserAction(userToDelete.id);
    setIsDeletingUser(false);

    if (result.success) {
      toast({
        title: "User Deleted",
        description: `User ${userToDelete.name} has been successfully deleted.`,
      });
      await fetchUsers();
      setIsDeleteUserDialogOpen(false);
      setUserToDelete(null);
    } else {
      toast({
        title: "Deletion Failed",
        description: result.error || "Could not delete the user.",
        variant: "destructive",
      });
    }
  };


  const getInitials = (name: string) => {
    if (!name) return '??';
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return names[0].charAt(0).toUpperCase() + names[names.length - 1].charAt(0).toUpperCase();
  }

  const usersToDisplay = useMemo(() => {
    if (!currentUser) return [];
    let displayableUsers = users;
    if (currentUser.role === 'ADMIN') {
      displayableUsers = users.filter(user => user.role !== 'SYSTEM_ADMIN');
    }
    return displayableUsers;
  }, [users, currentUser]);

  const roleDefinitionsMap = useMemo(() => {
    return new Map(availableRoles.map(r => [r.id, r]));
  }, [availableRoles]);

  const filteredUsers = useMemo(() => {
    let filtered = usersToDisplay;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => {
        const isLocked = Boolean(user.pinLockedUntil && new Date(user.pinLockedUntil) > new Date());
        if (statusFilter === 'Locked') return isLocked;
        if (statusFilter === 'Banned') return user.isBanned && !isLocked;
        if (statusFilter === 'Active') return !user.isBanned && !isLocked;
        return true;
      });
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(user => {
        const roleName = roleDefinitionsMap.get(user.role)?.name || user.role.replace(/_/g, ' ');
        return (
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          roleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ((user.companyName || 'Seven Solution').toLowerCase().includes(searchTerm.toLowerCase()))
        );
      });
    }

    // Sort the results by role priority then name
    const rolePriority = availableRoles.map(r => r.id);
    return filtered.sort((a, b) => {
      const roleAIndex = rolePriority.indexOf(a.role);
      const roleBIndex = rolePriority.indexOf(b.role);

      if (roleAIndex === -1 && roleBIndex !== -1) return 1;
      if (roleAIndex !== -1 && roleBIndex === -1) return -1;

      if (roleAIndex !== roleBIndex) {
        return roleAIndex - roleBIndex;
      }

      return a.name.localeCompare(b.name);
    });
  }, [usersToDisplay, searchTerm, statusFilter, availableRoles, roleDefinitionsMap]);

  const canCurrentUserEditRoleOf = useCallback((targetUser: User): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'SYSTEM_ADMIN') return true;
    if (currentUser.role === 'ADMIN') {
      return !(currentUser.id === targetUser.id || targetUser.role === 'ADMIN' || targetUser.role === 'SYSTEM_ADMIN');
    }
    return false;
  }, [currentUser]);

  const canAdminModifyTargetUser = useCallback((targetUser: User): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'SYSTEM_ADMIN') {
      return targetUser.id !== currentUser.id && targetUser.role !== 'SYSTEM_ADMIN';
    }
    if (currentUser.role === 'ADMIN') {
      if (targetUser.id === currentUser.id) return true;
      return targetUser.role === 'CR' || isDrRole(targetUser.role) || targetUser.role === 'VENDOR' || targetUser.role === 'LR' || targetUser.role === 'CO';
    }
    return false;
  }, [currentUser]);

  const canAdminDeleteTargetUser = useCallback((targetUser: User): boolean => {
    if (!currentUser) return false;
    if (targetUser.id === currentUser.id) return false;
    if (currentUser.role === 'SYSTEM_ADMIN') return targetUser.role !== 'SYSTEM_ADMIN';
    if (currentUser.role === 'ADMIN') {
      return targetUser.role === 'CR' || isDrRole(targetUser.role) || targetUser.role === 'VENDOR' || targetUser.role === 'LR' || targetUser.role === 'CO';
    }
    return false;
  }, [currentUser]);

  const canSystemAdminToggleBan = useCallback((targetUser: User): boolean => {
    if (!currentUser || currentUser.role !== 'SYSTEM_ADMIN') return false;
    if (targetUser.id === currentUser.id) return false;
    if (targetUser.role === 'SYSTEM_ADMIN') return false;
    return true;
  }, [currentUser]);

  const showBanStatusColumn = currentUser?.role === 'SYSTEM_ADMIN';

  if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SYSTEM_ADMIN')) {
    return null;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">


      <Card className="shadow-xl border bg-card rounded-lg">
        <CardHeader className="sticky top-[4.5rem] z-20 bg-card/95 backdrop-blur-sm border-b p-5 rounded-t-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-card-foreground text-xl">All Users</CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <div className="relative flex-grow w-full sm:w-auto sm:max-w-xs">
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-background h-10 rounded-md shadow-sm w-full"
                />
              </div>
              {showBanStatusColumn && (
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'Active' | 'Locked' | 'Banned')}>
                  <SelectTrigger className="w-full sm:w-[150px] h-10 rounded-md bg-background">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Filter by status" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Locked">Locked</SelectItem>
                    <SelectItem value="Banned">Banned</SelectItem>
                    <SelectItem value="all">All Users</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <AddUserDialog
                onUserAdded={handleUserAdded}
                currentUser={currentUser}
                isOpen={isAddUserDialogOpen}
                onOpenChange={setIsAddUserDialogOpen}
              >
                <Button
                  size="sm"
                  className="w-full sm:w-auto rounded-md h-10 bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <PlusCircle className="mr-2 h-4 w-4 text-white" />
                  Add New User
                </Button>
              </AddUserDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6 w-[50px]">SL</TableHead>
                  <TableHead className="w-[80px]">Avatar</TableHead>
                  <TableHead className="min-w-[110px]">Employee ID</TableHead>
                  <TableHead className="min-w-[150px]">Name</TableHead>
                  <TableHead className="min-w-[200px]">Email</TableHead>
                  <TableHead className="min-w-[120px]">Role</TableHead>
                  {showBanStatusColumn && <TableHead className="min-w-[100px]">Status</TableHead>}
                  <TableHead className="min-w-[130px]">Phone</TableHead>
                  <TableHead className="min-w-[110px]">Join Date</TableHead>
                  <TableHead className="pr-6 text-right min-w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingUsers && [...Array(10)].map((_, i) => (
                  <TableRow key={`skel-user-${i}`}>
                    <TableCell className="pl-6"><Skeleton className="h-5 w-6" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    {showBanStatusColumn && <TableCell><Skeleton className="h-5 w-16" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="pr-6 text-right"><Skeleton className="h-9 w-9 inline-block rounded-md" /></TableCell>
                  </TableRow>
                ))}

                {!isLoadingUsers && filteredUsers.length > 0 && filteredUsers.map((user, index) => {
                  const roleDef = roleDefinitionsMap.get(user.role);
                  const badgeColor = roleDef?.color || '#6b7280';
                  const textColor = getContrastTextColor(badgeColor);
                  const isUserLocked = Boolean(user.pinLockedUntil && new Date(user.pinLockedUntil) > new Date());

                  return (
                    <TableRow key={user.id || `user-${index}`} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="pl-6 font-mono text-muted-foreground">{index + 1}</TableCell>
                      <TableCell>
                        <Avatar className="h-10 w-10 border border-border/70 shadow-sm">
                          <AvatarImage src={user.avatarUrl || undefined} alt={user.name} data-ai-hint="user face" />
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-sm text-muted-foreground">{user.employeeId || '-'}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>{user.name}</span>
                          {user.isLeader && (
                            <BadgeCheck className="h-4 w-4 fill-[#6F4E37] text-white shrink-0" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge
                          style={{ backgroundColor: badgeColor, color: textColor }}
                          className="border-none"
                        >
                          {roleDef?.name || user.role.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      {showBanStatusColumn && (
                        <TableCell>
                          {isUserLocked ? (
                            <Badge variant="outline" className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40 font-semibold">Locked</Badge>
                          ) : user.isBanned ? (
                            <Badge variant="destructive" className="bg-red-500/20 text-red-700 border-red-500/30">Banned</Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-500/20 text-green-700 border-green-500/30">Active</Badge>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="whitespace-nowrap font-mono text-sm text-muted-foreground">{user.phone || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {user.joinDate ? format(new Date(user.joinDate + 'T00:00:00'), 'dd MMM yyyy') : '-'}
                      </TableCell>
                      <TableCell className="pr-6 text-right space-x-1.5 whitespace-nowrap">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9" title="User Actions">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions for {user.name}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              {currentUser?.role === 'SYSTEM_ADMIN' && user.role !== 'SYSTEM_ADMIN' && roleDef?.isDefault && (
                                <DropdownMenuItem
                                  onSelect={() => impersonate(user)}
                                  className="cursor-pointer text-blue-600 focus:text-blue-700"
                                >
                                  <Eye className="mr-2 h-4 w-4" /> View as
                                </DropdownMenuItem>
                              )}

                              {isUserLocked && (
                                <DropdownMenuItem
                                  onSelect={async () => {
                                    const res = await unlockUserPinAccountAction(user.id);
                                    if (res.success) {
                                      toast({ title: "Account Unlocked", description: `PIN lock on ${user.name}'s account has been unlocked.` });
                                      fetchUsers();
                                    }
                                  }}
                                  className="cursor-pointer text-amber-600 focus:text-amber-700 font-semibold"
                                >
                                  <Unlock className="mr-2 h-4 w-4" /> Unlock PIN Account
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuItem
                                onSelect={() => { setUserToEditInfo(user); setIsEditInfoDialogOpen(true); }}
                                disabled={!canAdminModifyTargetUser(user)}
                                className="cursor-pointer"
                              >
                                <EditInfoIcon className="mr-2 h-4 w-4" /> Edit Info
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onSelect={() => { setUserToManagePin(user); setIsAdminSetPinDialogOpen(true); }}
                                disabled={!canAdminModifyTargetUser(user)}
                                className="cursor-pointer"
                              >
                                <KeyRound className="mr-2 h-4 w-4" /> Manage PIN Code
                              </DropdownMenuItem>

                              {currentUser?.role === 'SYSTEM_ADMIN' && (
                                <DropdownMenuItem
                                  onSelect={() => { setUserToToggleBan(user); setIsBanDialogVisible(true); }}
                                  className={`cursor-pointer ${user.isBanned ? "text-green-600 focus:text-green-700" : "text-destructive focus:text-destructive"}`}
                                  disabled={!canSystemAdminToggleBan(user)}
                                >
                                  {user.isBanned ? <UserCheck className="mr-2 h-4 w-4" /> : <UserX className="mr-2 h-4 w-4" />}
                                  {user.isBanned ? "Unban User" : "Ban User"}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onSelect={() => { setUserToSetAvatar(user); setIsSetAvatarDialogOpen(true); }}
                                disabled={!canAdminModifyTargetUser(user)}
                                className="cursor-pointer"
                              >
                                <UserCog className="mr-2 h-4 w-4" /> Set Avatar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => { setUserToChangePassword(user); setIsChangePasswordDialogOpen(true); }}
                                disabled={!canAdminModifyTargetUser(user)}
                                className="cursor-pointer"
                              >
                                <KeyRound className="mr-2 h-4 w-4" /> Change Password
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => { setUserToEditRole(user); setIsEditRoleDialogOpen(true); }}
                                disabled={!canCurrentUserEditRoleOf(user)}
                                className="cursor-pointer"
                              >
                                <Edit className="mr-2 h-4 w-4" /> Edit Role
                              </DropdownMenuItem>
                              {user.role === 'CR' && (
                                <DropdownMenuItem
                                  onSelect={() => { setUserToSetTargets(user); setIsSetTargetsDialogOpen(true); }}
                                  disabled={!canAdminModifyTargetUser(user)}
                                  className="cursor-pointer"
                                >
                                  <Target className="mr-2 h-4 w-4" /> Set Sales Targets
                                </DropdownMenuItem>
                              )}
                              {(user.role === 'CR' || user.role === 'CR') && (
                                <DropdownMenuItem
                                  onSelect={() => { setUserToAssignZone(user); setIsAssignZoneDialogOpen(true); }}
                                  disabled={!canAdminModifyTargetUser(user)}
                                  className="cursor-pointer text-blue-600 focus:text-blue-700"
                                >
                                  <MapPin className="mr-2 h-4 w-4" /> Zone Assign
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => { setUserToDelete(user); setIsDeleteUserDialogOpen(true); }}
                              disabled={!canAdminDeleteTargetUser(user)}
                              className="cursor-pointer text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}

                 {!isLoadingUsers && filteredUsers.length === 0 && (
                  <TableRow key="empty-users">
                    <TableCell colSpan={showBanStatusColumn ? 10 : 9} className="text-center py-12 h-[300px]">
                      <svg
                        width="64"
                        height="64"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className={cn("text-primary drop-shadow-[0_2px_3px_hsl(var(--primary)/0.5)] mx-auto mb-6 opacity-50", "h-16 w-16")}
                      >
                        <path
                          d="M12 2L2 7V17L12 22L22 17V7L12 2Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M2 7L12 12M12 12L22 7M12 12V22M12 2V12"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M17 4.5L7 9.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <p className="text-lg text-muted-foreground font-medium">
                        {searchTerm ? "No users match your search." : "No users found in database."}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {searchTerm ? "Try a different search term." : (currentUser.role === 'SYSTEM_ADMIN' || currentUser.role === 'ADMIN') ? "Add users to manage them here." : "User data could not be loaded."}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>



      {isEditInfoDialogOpen && userToEditInfo && (
        <EditUserInfoDialog
          user={userToEditInfo}
          onUserInfoUpdated={handleUserInfoUpdated}
          isOpen={isEditInfoDialogOpen}
          onOpenChange={(open) => {
            setIsEditInfoDialogOpen(open);
            if (!open) setUserToEditInfo(null);
          }}
        />
      )}

      {userToToggleBan && isBanDialogVisible && (
        <AlertDialog open={isBanDialogVisible} onOpenChange={(open) => { if (!open) { setUserToToggleBan(null); setIsBanDialogVisible(false); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className={`h-6 w-6 ${userToToggleBan.isBanned ? 'text-green-600' : 'text-destructive'}`} />
                Are you sure?
              </AlertDialogTitle>
              <AlertDialogDescription>
                You are about to {userToToggleBan.isBanned ? 'unban' : 'ban'} the user
                "<span className="font-semibold">{userToToggleBan.name}</span>".
                {userToToggleBan.isBanned ? ' They will be able to log in again.' : ' They will no longer be able to log in.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setUserToToggleBan(null); setIsBanDialogVisible(false); }} disabled={isLoadingUsers}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleToggleBanStatus} className={userToToggleBan.isBanned ? "bg-green-600 hover:bg-green-700 text-white" : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"} disabled={isLoadingUsers}>
                {userToToggleBan.isBanned ? "Yes, Unban User" : "Yes, Ban User"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {isSetAvatarDialogOpen && userToSetAvatar && (
        <SetUserAvatarDialog
          user={userToSetAvatar}
          onAvatarChanged={async (userId, avatarUrl) => {
            const success = await updateUserAvatar(userId, avatarUrl);
            if (success) handleUserAvatarSetByAdmin();
            return success;
          }}
          isOpen={isSetAvatarDialogOpen}
          onOpenChange={(open) => {
            setIsSetAvatarDialogOpen(open);
            if (!open) setUserToSetAvatar(null);
          }}
        />
      )}

      {isChangePasswordDialogOpen && userToChangePassword && (
        <ChangePasswordDialog
          user={userToChangePassword}
          onPasswordChanged={async (userId, newPassword) => {
            const success = await updateUserPassword(userId, newPassword);
            if (success) handlePasswordChanged();
            return success;
          }}
          isOpen={isChangePasswordDialogOpen}
          onOpenChange={(open) => {
            setIsChangePasswordDialogOpen(open);
            if (!open) setUserToChangePassword(null);
          }}
        />
      )}

      {isEditRoleDialogOpen && userToEditRole && currentUser && (
        <EditUserRoleDialog
          user={userToEditRole}
          currentUser={currentUser}
          onUserRoleUpdated={async (userId, newRole) => {
            const success = await updateUserRole(userId, newRole);
            if (success) handleUserRoleUpdated();
          }}
          isOpen={isEditRoleDialogOpen}
          onOpenChange={(open) => {
            setIsEditRoleDialogOpen(open);
            if (!open) setUserToEditRole(null);
          }}
        />
      )}

      {isSetTargetsDialogOpen && userToSetTargets && userToSetTargets.role === 'CR' && (
        <SetUserSalesTargetDialog
          user={userToSetTargets}
          onTargetsSet={async (userId, amountTarget) => {
            const success = await updateUserTargets(userId, amountTarget);
            if (success) handleUserTargetsSetByAdmin();
            else toast({ title: 'Update Failed', description: 'Could not save sales targets. Please check the values and try again.', variant: 'destructive' });
            return success;
          }}
          isOpen={isSetTargetsDialogOpen}
          onOpenChange={(open) => {
            setIsSetTargetsDialogOpen(open);
            if (!open) setUserToSetTargets(null);
          }}
        />
      )}

      {isAssignZoneDialogOpen && userToAssignZone && (userToAssignZone.role === 'CR' || userToAssignZone.role === 'CR') && (
        <AssignZoneDialog
          user={userToAssignZone}
          onZonesAssigned={async (userId, divisions) => {
            const res = await updateUserAssignedDivisionsAction(userId, divisions);
            if (res.success) {
              toast({
                title: "Zones Assigned",
                description: `Successfully assigned ${divisions.length} zone(s) to ${userToAssignZone.name}.`,
              });
              await fetchUsers();
              if (currentUser && currentUser.id === userId && typeof refreshCurrentUser === 'function') {
                await refreshCurrentUser();
              }
              return true;
            } else {
              toast({
                title: "Zone Assignment Failed",
                description: res.error || "Could not update assigned zones.",
                variant: "destructive",
              });
              return false;
            }
          }}
          isOpen={isAssignZoneDialogOpen}
          onOpenChange={(open) => {
            setIsAssignZoneDialogOpen(open);
            if (!open) setUserToAssignZone(null);
          }}
        />
      )}

      {isDeleteUserDialogOpen && userToDelete && (
        <DeleteUserDialog
          user={userToDelete}
          onConfirmDelete={handleConfirmDeleteUser}
          isDeleting={isDeletingUser}
          isOpen={isDeleteUserDialogOpen}
          onOpenChange={(open) => {
            if (!isDeletingUser) {
              setIsDeleteUserDialogOpen(open);
              if (!open) setUserToDelete(null);
            }
          }}
        />
      )}

      {isAdminSetPinDialogOpen && userToManagePin && (
        <AdminSetUserPinDialog
          user={userToManagePin}
          isOpen={isAdminSetPinDialogOpen}
          onOpenChange={(open) => {
            setIsAdminSetPinDialogOpen(open);
            if (!open) setUserToManagePin(null);
          }}
          onPinUpdated={fetchUsers}
        />
      )}
    </div>
  );
}
