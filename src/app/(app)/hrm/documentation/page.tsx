"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, MoreVertical, Filter, Eye, FileText, Download, Trash2, Search, Upload } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import type { User, UserRoleDefinition } from "@/types";
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getUsers } from '@/lib/user-service';
import { getRoles } from '@/lib/user-role-service';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getContrastTextColor } from '@/lib/color-utils';
import { getSubmittedUserIds } from '@/lib/user-document-service';
import { clearUserDocumentsAction, getLatestDocumentAction } from './document-actions';


const UploadDocumentDialog = dynamic(() => import('@/components/users/upload-document-dialog').then(mod => mod.UploadDocumentDialog));

export default function DocumentationPage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [availableRoles, setAvailableRoles] = useState<UserRoleDefinition[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Banned'>('Active');
  
  // Track submitted documents (mocking persistence)
  const [submittedUserIds, setSubmittedUserIds] = useState<Set<string>>(new Set());

  const [selectedUserForUpload, setSelectedUserForUpload] = useState<User | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [clearConfirmUser, setClearConfirmUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const [fetchedUsers, fetchedRoles, submittedIds] = await Promise.all([
        getUsers(),
        getRoles(),
        getSubmittedUserIds()
      ]);
      setUsers(fetchedUsers);
      setAvailableRoles(fetchedRoles);
      setSubmittedUserIds(new Set(submittedIds));
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ title: "Error", description: "Could not load users for documentation.", variant: "destructive" });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SYSTEM_ADMIN')) {
      fetchUsers();
    } else if (currentUser) {
      router.replace('/dashboard');
    }
  }, [currentUser, router, fetchUsers]);

  const handleUploadSuccess = (userId: string) => {
    setSubmittedUserIds(prev => {
        const next = new Set(prev);
        next.add(userId);
        return next;
    });
  };

  const handleClearDocuments = async (userId: string) => {
    try {
      const result = await clearUserDocumentsAction(userId);
      if (result.success) {
        setSubmittedUserIds(prev => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
        });
        toast({
            title: "Documents Cleared",
            description: "All documents for this user have been removed.",
        });
      } else {
        toast({
            title: "Error",
            description: result.error || "Failed to clear documents.",
            variant: "destructive"
        });
      }
    } catch (error) {
       toast({
            title: "Error",
            description: "An unexpected error occurred.",
            variant: "destructive"
        });
    }
  };

  const handleOpenDocument = async (userId: string) => {
    try {
      const result = await getLatestDocumentAction(userId);
      if (result.success && result.doc) {
        window.open(result.doc.file_url, '_blank');
      } else {
        console.warn(`Document marked as submitted but not found in DB for user ${userId}`);
        toast({ 
          title: "Document Missing", 
          description: "The record was found but the actual file location is unavailable. Try uploading again.", 
          variant: "destructive" 
        });
      }
    } catch (error) {
       toast({ title: "Error", description: "Failed to open document due to a system error.", variant: "destructive" });
    }
  };

  const handleDownloadDocument = async (userId: string) => {
    try {
      const result = await getLatestDocumentAction(userId);
      if (result.success && result.doc) {
        const link = document.createElement('a');
        link.href = result.doc.file_url;
        link.download = result.doc.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        console.warn(`Document marked as submitted but not found in DB for user ${userId}`);
        toast({ 
          title: "Download Failed", 
          description: "Could not locate the document record. It may have been removed.", 
          variant: "destructive" 
        });
      }
    } catch (error) {
       toast({ title: "Error", description: "Failed to download document.", variant: "destructive" });
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return names[0].charAt(0).toUpperCase() + names[names.length - 1].charAt(0).toUpperCase();
  }

  const roleDefinitionsMap = useMemo(() => {
    return new Map(availableRoles.map(r => [r.id, r]));
  }, [availableRoles]);

  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Exclude vendors and filter by status
    filtered = filtered.filter(user => user.role !== 'VENDOR');
    
    if (statusFilter !== 'all') {
      const isBannedFilter = statusFilter === 'Banned';
      filtered = filtered.filter(user => (user.isBanned || false) === isBannedFilter);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().replace(/_/g, ' ').includes(searchTerm.toLowerCase()) ||
        (user.companyName && user.companyName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Sort the results by role priority then name
    const rolePriority = availableRoles.map(r => r.id);
    return filtered.sort((a, b) => {
      const roleAIndex = rolePriority.indexOf(a.role);
      const roleBIndex = rolePriority.indexOf(b.role);
      if (roleAIndex === -1 && roleBIndex !== -1) return 1;
      if (roleAIndex !== -1 && roleBIndex === -1) return -1;
      if (roleAIndex !== roleBIndex) return roleAIndex - roleBIndex;
      return a.name.localeCompare(b.name);
    });
  }, [users, searchTerm, statusFilter, availableRoles]);

  if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SYSTEM_ADMIN')) {
    return null;
  }

  const showBanStatusColumn = currentUser?.role === 'SYSTEM_ADMIN';

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Card className="shadow-xl border bg-card rounded-lg">
        <CardHeader className="sticky top-[4.5rem] z-20 bg-card/95 backdrop-blur-sm border-b p-5 rounded-t-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-card-foreground text-xl">User Documentation</CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <div className="relative flex-grow w-full sm:w-auto sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-background h-10 pl-9 rounded-md shadow-sm w-full"
                />
              </div>
              {showBanStatusColumn && (
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'Active' | 'Banned')}>
                  <SelectTrigger className="w-full sm:w-[150px] h-10 rounded-md bg-background">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Status" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Banned">Banned</SelectItem>
                    <SelectItem value="all">All Users</SelectItem>
                  </SelectContent>
                </Select>
              )}
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
                  <TableHead className="min-w-[150px]">Name</TableHead>
                  <TableHead className="min-w-[200px]">Email</TableHead>
                  <TableHead className="min-w-[120px]">Role</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="min-w-[120px]">Document</TableHead>
                  <TableHead className="pr-6 text-right min-w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
                {isLoadingUsers ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={`skel-doc-${i}`}>
                      <TableCell className="pl-6"><Skeleton className="h-5 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                      <TableCell className="pr-6 text-right">
                        <Skeleton className="h-9 w-9 inline-block rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user, index) => {
                    const roleDef = roleDefinitionsMap.get(user.role);
                    const badgeColor = roleDef?.color || '#6b7280';
                    const textColor = getContrastTextColor(badgeColor);
                    const isSubmitted = submittedUserIds.has(user.id);

                    return (
                      <TableRow key={user.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="pl-6 font-mono text-muted-foreground">{index + 1}</TableCell>
                        <TableCell>
                          <Avatar className="h-10 w-10 border border-border/70 shadow-sm">
                            <AvatarImage src={user.avatarUrl || undefined} alt={user.name} />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">{getInitials(user.name)}</AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{user.name}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <Badge
                            style={{ backgroundColor: badgeColor, color: textColor }}
                            className="border-none"
                          >
                            {user.role.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isBanned ? "destructive" : "default"} className={user.isBanned ? "bg-red-500/20 text-red-700 border-red-500/30" : "bg-green-500/20 text-green-700 border-green-500/30"}>
                            {user.isBanned ? "Banned" : "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "font-medium",
                              isSubmitted 
                                ? "bg-green-500/10 text-green-700 border-green-500/20" 
                                : "bg-yellow-500/10 text-yellow-700 border-yellow-500/20"
                            )}
                          >
                            {isSubmitted ? "Submitted" : "Pending"}
                          </Badge>
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
                                <DropdownMenuItem 
                                    className="cursor-pointer"
                                    onSelect={() => { setSelectedUserForUpload(user); setIsUploadDialogOpen(true); }}
                                >
                                  <Upload className="mr-2 h-4 w-4" /> Upload Document
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                    className="cursor-pointer" 
                                    disabled={!isSubmitted}
                                    onSelect={() => handleOpenDocument(user.id)}
                                >
                                  <Eye className="mr-2 h-4 w-4" /> Open Documents
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                    className="cursor-pointer" 
                                    disabled={!isSubmitted}
                                    onSelect={() => handleDownloadDocument(user.id)}
                                >
                                  <Download className="mr-2 h-4 w-4" /> Download
                                </DropdownMenuItem>
                                {currentUser.role === 'SYSTEM_ADMIN' && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                        className="cursor-pointer text-destructive focus:text-destructive"
                                        onSelect={() => setClearConfirmUser(user)}
                                        disabled={!isSubmitted}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" /> Clear Documents
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 h-[300px]">
                      <div className="flex flex-col items-center justify-center">
                        <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
                        <p className="text-lg text-muted-foreground font-medium">
                          {searchTerm ? "No users match your search." : "No users found."}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {searchTerm ? "Try searching for another user." : "Add users via User Management to manage documents here."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedUserForUpload && (
        <UploadDocumentDialog
            user={selectedUserForUpload}
            isOpen={isUploadDialogOpen}
            onOpenChange={(open) => {
                setIsUploadDialogOpen(open);
                if (!open) setSelectedUserForUpload(null);
            }}
            onUploadSuccess={handleUploadSuccess}
        />
      )}

      <AlertDialog open={!!clearConfirmUser} onOpenChange={(open) => { if (!open) setClearConfirmUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Documents?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all documents for{' '}
              <span className="font-semibold text-foreground">{clearConfirmUser?.name}</span>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (clearConfirmUser) {
                  handleClearDocuments(clearConfirmUser.id);
                  setClearConfirmUser(null);
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Yes, Clear Documents
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

