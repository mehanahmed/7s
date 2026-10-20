

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Eye, Trash2, Loader2, AlertTriangle, MoreVertical } from "lucide-react";
import type { Dr2oEntry, User, LrEntryItem } from '@/types';
import { getDr2oEntries } from '@/lib/dr2o-service';
import { getUsers } from '@/lib/user-service';
import { useAuth } from '@/contexts/auth-context';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { deleteDr2oEntryAction } from './actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { isDrRole, roleInTeam } from '@/lib/roles';

const AddEditDr2oDialog = dynamic(() => import('@/components/dr2o/AddEditDr2oDialog').then(mod => mod.AddEditDr2oDialog));
const ViewLrEntryDialog = dynamic(() => import('@/components/dr2o/ViewLrEntryDialog').then(mod => mod.ViewLrEntryDialog));

const getInitials = (name: string) => {
  if (!name) return '??';
  const names = name.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return names[0].charAt(0).toUpperCase() + (names.length > 1 ? names[names.length - 1].charAt(0).toUpperCase() : '');
};

type TeamType = 'CR' | 'DR' | 'LR' | 'CO';

export default function DR2OPage() {
  const { currentUser } = useAuth();
  const [dr2oEntries, setDr2oEntries] = useState<Dr2oEntry[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Dr2oEntry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<Dr2oEntry | null>(null);
  const [activeTab, setActiveTab] = useState<TeamType>("CR");

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        setActiveTab(hash as any);
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as any);
    window.history.replaceState(null, '', `#${value}`);
  }, []);

  
  const [entryToDelete, setEntryToDelete] = useState<Dr2oEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const isAdmin = useMemo(() => currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN', [currentUser]);

  useEffect(() => {
    if (currentUser) {
      if (isAdmin) {
        // For admin, default to CR but allow switching
        // No change needed here, state is managed by Tabs component
      } else {
        // For non-admins, lock to their role's tab
        switch (currentUser.role) {
          case 'CR':
            setActiveTab('CR');
            break;
          case 'DR_TEAM':
          case 'SW':
          case 'CG':
          case 'EDITOR':
          case 'ARTIST':
            setActiveTab('DR');
            break;
          case 'LR':
            setActiveTab('LR');
            break;
          case 'CO':
            setActiveTab('CO');
            break;
          default:
            setActiveTab('CR'); // Fallback for any other roles
            break;
        }
      }
    }
  }, [currentUser, isAdmin]);

  const fetchData = useCallback(async (team: TeamType) => {
    setIsLoading(true);
    try {
      const [entries, users] = await Promise.all([
          getDr2oEntries(team),
          getUsers()
      ]);
      setDr2oEntries(entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setAllUsers(users);
    } catch (error) {
      console.error(`Error fetching DR 2.O entries for ${team}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) { // Only fetch if user is loaded
        if (isAdmin) {
             fetchData(activeTab); // Admin fetches based on active tab
        } else if (currentUser.role === 'CR') {
            fetchData('CR');
        } else if (isDrRole(currentUser.role)) {
            fetchData('DR');
        } else if (currentUser.role === 'LR') {
            fetchData('LR');
        } else if (currentUser.role === 'CO') {
            fetchData('CO');
        }
    }
  }, [currentUser, activeTab, isAdmin, fetchData]);

  const handleOpenAddDialog = () => {
    setEditingEntry(null);
    setIsDialogOpen(true);
  };
  
  const handleOpenEditDialog = (entry: Dr2oEntry) => {
    setEditingEntry(entry);
    setIsDialogOpen(true);
  };

  const handleOpenViewDialog = (entry: Dr2oEntry) => {
    setViewingEntry(entry);
    setIsViewDialogOpen(true);
  };

  const handleDr2oSaved = () => {
    fetchData(activeTab);
    setIsDialogOpen(false);
  };
  
  const handleConfirmDelete = async () => {
    if (!entryToDelete) return;
    setIsDeleting(true);
    const result = await deleteDr2oEntryAction(entryToDelete.id, activeTab);
    setIsDeleting(false);
    setEntryToDelete(null);

    if (result.success) {
      toast({ title: "Entry Deleted", description: "The daily report has been removed." });
      fetchData(activeTab);
    } else {
      toast({ title: "Error", description: result.error || "Could not delete the entry.", variant: "destructive" });
    }
  };


  const canAddNew = useMemo(() => {
    if (!currentUser || !dr2oEntries) return false;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return !dr2oEntries.some(entry => entry.crmId === currentUser.id && format(parseISO(entry.date), 'yyyy-MM-dd') === todayStr);
  }, [currentUser, dr2oEntries]);

  const userEntries = useMemo(() => {
      if (!currentUser) return [];
      if (isAdmin) {
          return dr2oEntries;
      }
      if (currentUser.role === 'LR' && activeTab === 'LR') {
          // LR users see all LR entries
          return dr2oEntries;
      }
      // Other roles see only their own entries
      return dr2oEntries.filter(entry => entry.crmId === currentUser.id);
  }, [currentUser, dr2oEntries, activeTab, isAdmin]);
  
  const PlaceholderContent = ({ teamName }: { teamName: string }) => (
    <Card className="shadow-xl border bg-card rounded-lg overflow-hidden">
        <CardHeader>
            <CardTitle>{teamName} Dashboard</CardTitle>
            <CardDescription>Content for the {teamName} will be displayed here.</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center">
            <p className="text-muted-foreground">Coming soon...</p>
        </CardContent>
    </Card>
  );

  const getDialogTitle = (team: TeamType) => {
    switch(team) {
      case 'CR': return 'CR Team';
      case 'DR': return 'DR Team';
      case 'LR': return 'LR Team';
      case 'CO': return 'CO Team';
      default: return 'Team';
    }
  };


  const renderActiveTabContent = () => {
    const entriesByUser = userEntries.reduce((acc, entry) => {
        const userId = entry.crmId;
        if (!acc[userId]) {
            acc[userId] = [];
        }
        acc[userId].push(entry);
        return acc;
    }, {} as Record<string, Dr2oEntry[]>);
    
    switch (activeTab) {
      case 'CR':
        return (
          <Card className="shadow-xl border bg-card rounded-lg overflow-hidden">
            <CardHeader className="border-b p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-card-foreground text-xl">CR Team Daily Reports</CardTitle>
                    <CardDescription className="text-muted-foreground text-sm mt-0.5">
                        Daily reports for customer relations and payments.
                    </CardDescription>
                  </div>
                  <Button onClick={handleOpenAddDialog} disabled={!canAddNew && currentUser?.role !== 'ADMIN' && currentUser?.role !== 'SYSTEM_ADMIN'}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add New
                  </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : Object.keys(entriesByUser).length > 0 ? (
                isAdmin ? (
                  <Accordion type="single" collapsible className="w-full space-y-3">
                    {Object.entries(entriesByUser).map(([userId, entries], userIndex) => {
                      const crUser = allUsers.find(u => u.id === userId);
                      return (
                        <div key={userId} className="group relative bg-muted/30 rounded-lg shadow-sm border">
                          <AccordionItem value={`user-${userIndex}`} className="border-b-0">
                            <AccordionTrigger className="px-4 py-3 text-left font-semibold text-foreground hover:no-underline">
                              <div className="flex items-center gap-4 flex-1">
                                  {crUser && (
                                      <Avatar className="h-9 w-9">
                                          <AvatarImage src={crUser.avatarUrl || undefined} alt={crUser.name} />
                                          <AvatarFallback>{getInitials(crUser.name)}</AvatarFallback>
                                      </Avatar>
                                  )}
                                  <div className="flex-1">
                                      <p className="text-sm font-medium">{crUser?.name || 'Unknown User'}</p>
                                      <p className="text-xs text-muted-foreground">{entries.length} report(s)</p>
                                  </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-2 sm:px-4 pt-0 pb-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Appointment</TableHead>
                                    <TableHead>Prospect</TableHead>
                                    <TableHead>Sale</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {entries.map(row => (
                                      <TableRow key={row.id}>
                                        <TableCell>{format(parseISO(row.date), 'd MMM, yyyy')}</TableCell>
                                        <TableCell>{row.appointmentCount || 0}</TableCell>
                                        <TableCell>{row.prospectCount || 0}</TableCell>
                                        <TableCell>{row.saleCount || 0}</TableCell>
                                        <TableCell className="text-right">
                                           <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                  <MoreVertical className="h-4 w-4" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                  <DropdownMenuItem onSelect={() => handleOpenEditDialog(row)} disabled={!(currentUser?.id === row.crmId || isAdmin)} className="cursor-pointer">
                                                      <Edit className="mr-2 h-4 w-4" /> Edit
                                                  </DropdownMenuItem>
                                                  {isAdmin && (
                                                      <DropdownMenuItem onSelect={() => setEntryToDelete(row)} className="cursor-pointer text-destructive focus:text-destructive">
                                                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                      </DropdownMenuItem>
                                                  )}
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                      </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </AccordionContent>
                          </AccordionItem>
                        </div>
                      )
                    })}
                  </Accordion>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Appointment</TableHead>
                        <TableHead>Prospect</TableHead>
                        <TableHead>Sale</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userEntries.map(row => (
                          <TableRow key={row.id}>
                            <TableCell>{format(parseISO(row.date), 'd MMM, yyyy')}</TableCell>
                            <TableCell>{row.appointmentCount || 0}</TableCell>
                            <TableCell>{row.prospectCount || 0}</TableCell>
                            <TableCell>{row.saleCount || 0}</TableCell>
                            <TableCell className="text-right">
                               <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                      <DropdownMenuItem onSelect={() => handleOpenEditDialog(row)} disabled={!(currentUser?.id === row.crmId || isAdmin)} className="cursor-pointer">
                                          <Edit className="mr-2 h-4 w-4" /> Edit
                                      </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                          </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              ) : (
                <div className="text-center py-12 text-muted-foreground">No reports found.</div>
              )}
            </CardContent>
          </Card>
        );
      case 'DR':
      case 'CO':
        const headers = activeTab === 'CO' 
            ? ["Date", "Docx 1", "Docx 2", "Docx 3", "Docx 4", "Docx 5", "Docx 6", "Docx 7", "Action"]
            : ["Date", "New Customer 1", "New Customer 2", "New Customer 3", "Follow-Up 1", "Follow-Up 2", "Follow-Up 3", "Follow-Up 4", "Action"];
        return (
          <Card className="shadow-xl border bg-card rounded-lg overflow-hidden">
            <CardHeader className="border-b p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-card-foreground text-xl">{activeTab} Team Daily Reports</CardTitle>
                    <CardDescription className="text-muted-foreground text-sm mt-0.5">
                        Daily follow-up reports for new and old customers from the {activeTab} team.
                    </CardDescription>
                  </div>
                  <Button onClick={handleOpenAddDialog} disabled={!canAddNew && currentUser?.role !== 'ADMIN' && currentUser?.role !== 'SYSTEM_ADMIN'}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add New
                  </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : Object.keys(entriesByUser).length > 0 ? (
                isAdmin ? (
                  <Accordion type="single" collapsible className="w-full space-y-3">
                    {Object.entries(entriesByUser).map(([userId, entries], userIndex) => {
                      const user = allUsers.find(u => u.id === userId);
                      return (
                        <div key={userId} className="group relative bg-muted/30 rounded-lg shadow-sm border">
                          <AccordionItem value={`user-${userIndex}`} className="border-b-0">
                            <AccordionTrigger className="px-4 py-3 text-left font-semibold text-foreground hover:no-underline">
                              <div className="flex items-center gap-4 flex-1">
                                  {user && (
                                      <Avatar className="h-9 w-9">
                                          <AvatarImage src={user.avatarUrl || undefined} alt={user.name} />
                                          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                                      </Avatar>
                                  )}
                                  <div className="flex-1">
                                      <p className="text-sm font-medium">{user?.name || 'Unknown User'}</p>
                                      <p className="text-xs text-muted-foreground">{entries.length} report(s)</p>
                                  </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-2 sm:px-4 pt-0 pb-4">
                              <Table>
                                <TableHeader>
                                    <TableRow>
                                        {headers.map(h => <TableHead key={h} className={h === 'Action' ? 'text-right' : ''}>{h}</TableHead>)}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {entries.map(row => (
                                      <TableRow key={row.id}>
                                        <TableCell>{format(parseISO(row.date), 'd MMM, yyyy')}</TableCell>
                                        <TableCell>{row.newCustomer1 || 'N/A'}</TableCell>
                                        <TableCell>{row.newCustomer2 || 'N/A'}</TableCell>
                                        <TableCell>{row.newCustomer3 || 'N/A'}</TableCell>
                                        <TableCell>{row.oldCustomer1 || 'N/A'}</TableCell>
                                        <TableCell>{row.oldCustomer2 || 'N/A'}</TableCell>
                                        <TableCell>{row.oldCustomer3 || 'N/A'}</TableCell>
                                        <TableCell>{row.oldCustomer4 || 'N/A'}</TableCell>
                                        <TableCell className="text-right">
                                           <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                  <MoreVertical className="h-4 w-4" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                  <DropdownMenuItem onSelect={() => handleOpenEditDialog(row)} disabled={!(currentUser?.id === row.crmId || isAdmin)} className="cursor-pointer">
                                                      <Edit className="mr-2 h-4 w-4" /> Edit
                                                  </DropdownMenuItem>
                                                  {isAdmin && (
                                                      <DropdownMenuItem onSelect={() => setEntryToDelete(row)} className="cursor-pointer text-destructive focus:text-destructive">
                                                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                      </DropdownMenuItem>
                                                  )}
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                      </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </AccordionContent>
                          </AccordionItem>
                        </div>
                      )
                    })}
                  </Accordion>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {headers.map(h => <TableHead key={h} className={h === 'Action' ? 'text-right' : ''}>{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userEntries.map(row => (
                          <TableRow key={row.id}>
                            <TableCell>{format(parseISO(row.date), 'd MMM, yyyy')}</TableCell>
                            <TableCell>{row.newCustomer1 || 'N/A'}</TableCell>
                            <TableCell>{row.newCustomer2 || 'N/A'}</TableCell>
                            <TableCell>{row.newCustomer3 || 'N/A'}</TableCell>
                            <TableCell>{row.oldCustomer1 || 'N/A'}</TableCell>
                            <TableCell>{row.oldCustomer2 || 'N/A'}</TableCell>
                            <TableCell>{row.oldCustomer3 || 'N/A'}</TableCell>
                            <TableCell>{row.oldCustomer4 || 'N/A'}</TableCell>
                            <TableCell className="text-right">
                               <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                      <DropdownMenuItem onSelect={() => handleOpenEditDialog(row)} disabled={!(currentUser?.id === row.crmId || isAdmin)} className="cursor-pointer">
                                          <Edit className="mr-2 h-4 w-4" /> Edit
                                      </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                          </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              ) : (
                <div className="text-center py-12 text-muted-foreground">No reports found.</div>
              )}
            </CardContent>
          </Card>
        );
      case 'LR':
        const entriesByDate = userEntries.reduce((acc, entry) => {
            const dateKey = format(parseISO(entry.date), 'yyyy-MM-dd');
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(entry);
            return acc;
        }, {} as Record<string, Dr2oEntry[]>);

        return (
          <Card className="shadow-xl border bg-card rounded-lg overflow-hidden">
            <CardHeader className="border-b p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-card-foreground text-xl">LR Team Daily Tasks</CardTitle>
                  <CardDescription className="text-muted-foreground text-sm mt-0.5">
                    Logistics and fulfillment team daily entries.
                  </CardDescription>
                </div>
                <Button onClick={handleOpenAddDialog} disabled={!canAddNew && !isAdmin}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : Object.keys(entriesByDate).length > 0 ? (
                <Accordion type="single" collapsible className="w-full space-y-3">
                  {Object.entries(entriesByDate).map(([date, entries], dateIndex) => {
                    const totalItems = entries.reduce((sum, entry) => sum + (entry.lrItems?.length || 0), 0);
                    const uniqueUsers = Array.from(new Set(entries.map(e => e.crmId)));
                    return (
                      <div key={date} className="group relative bg-muted/30 rounded-lg shadow-sm border">
                        <AccordionItem value={`date-${dateIndex}`} className="border-b-0">
                          <AccordionTrigger className="px-4 py-3 text-left font-semibold text-foreground hover:no-underline">
                            <div className="flex items-center gap-4 flex-1">
                              <p className="text-sm font-medium">{format(parseISO(date), 'PPP')}</p>
                              <div className="flex items-center -space-x-2">
                                {uniqueUsers.slice(0, 3).map(userId => {
                                  const user = allUsers.find(u => u.id === userId);
                                  return (
                                    <div key={userId} className="flex items-center gap-2">
                                      <Avatar className="h-6 w-6 border-2 border-background">
                                          <AvatarImage src={user?.avatarUrl || undefined} />
                                          <AvatarFallback className="text-xs">{getInitials(user?.name || '')}</AvatarFallback>
                                      </Avatar>
                                      {isAdmin && <span className="text-xs font-medium text-muted-foreground">{user?.name}</span>}
                                    </div>
                                  )
                                })}
                                {uniqueUsers.length > 3 && <div className="h-6 w-6 rounded-full bg-muted-foreground text-background text-xs flex items-center justify-center border-2 border-background">+{uniqueUsers.length - 3}</div>}
                              </div>
                              <p className="text-xs text-muted-foreground ml-auto">{totalItems} Reports</p>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-2 sm:px-4 pt-0 pb-4">
                            <Table>
                               <TableHeader>
                                 <TableRow>
                                  <TableHead>Company</TableHead>
                                  <TableHead>Product</TableHead>
                                  <TableHead>Qty</TableHead>
                                  <TableHead>Courier ID</TableHead>
                                  <TableHead>Due Order</TableHead>
                                  <TableHead>Due Qty</TableHead>
                                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                                 </TableRow>
                               </TableHeader>
                               <TableBody>
                                 {entries.flatMap(entry =>
                                   entry.lrItems?.map(item => (
                                       <TableRow key={item.id}>
                                         <TableCell>{item.companyName}</TableCell>
                                         <TableCell>{item.productName}</TableCell>
                                         <TableCell>{item.productQty}</TableCell>
                                         <TableCell>{item.courierId}</TableCell>
                                         <TableCell>{item.dueOrderName}</TableCell>
                                         <TableCell>{item.dueOrderQty}</TableCell>
                                         {isAdmin && (
                                           <TableCell className="text-right">
                                             <DropdownMenu>
                                               <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                               <DropdownMenuContent align="end">
                                                 <DropdownMenuItem onSelect={() => handleOpenEditDialog(entry)} className="cursor-pointer"><Edit className="mr-2 h-4 w-4" /> Edit Entry</DropdownMenuItem>
                                                 <DropdownMenuItem onSelect={() => setEntryToDelete(entry)} className="cursor-pointer text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete Entry</DropdownMenuItem>
                                               </DropdownMenuContent>
                                             </DropdownMenu>
                                           </TableCell>
                                         )}
                                       </TableRow>
                                   ))
                                 )}
                               </TableBody>
                             </Table>
                          </AccordionContent>
                        </AccordionItem>
                      </div>
                    )
                  })}
                </Accordion>
              ) : (
                <div className="text-center py-12 text-muted-foreground">No reports found.</div>
              )}
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            {isAdmin && (
              <TabsList className="inline-flex h-10 items-center justify-center text-muted-foreground bg-white p-1 rounded-full shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                  <TabsTrigger value="CR" className="rounded-full data-[state=active]:bg-gray-800 data-[state=active]:text-white dark:data-[state=active]:bg-gray-950">CR Team</TabsTrigger>
                  <TabsTrigger value="DR" className="rounded-full data-[state=active]:bg-gray-800 data-[state=active]:text-white dark:data-[state=active]:bg-gray-950">DR Team</TabsTrigger>
                  <TabsTrigger value="CO" className="rounded-full data-[state=active]:bg-gray-800 data-[state=active]:text-white dark:data-[state=active]:bg-gray-950">CO Team</TabsTrigger>
                  <TabsTrigger value="LR" className="rounded-full data-[state=active]:bg-gray-800 data-[state=active]:text-white dark:data-[state=active]:bg-gray-950">LR Team</TabsTrigger>
              </TabsList>
            )}
            <div className="mt-6">
                {renderActiveTabContent()}
            </div>
        </Tabs>
      </div>
      {currentUser && (
        <AddEditDr2oDialog 
            isOpen={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            onDr2oSaved={handleDr2oSaved}
            entry={editingEntry}
            currentUser={currentUser}
            team={activeTab}
        />
      )}
       {viewingEntry && (
        <ViewLrEntryDialog
          isOpen={isViewDialogOpen}
          onOpenChange={setIsViewDialogOpen}
          entry={viewingEntry}
        />
      )}
      {entryToDelete && (
        <AlertDialog open={!!entryToDelete} onOpenChange={() => setEntryToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive"/>
                        Are you sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the report from <span className="font-semibold">{format(parseISO(entryToDelete.date), 'PPP')}</span> submitted by <span className="font-semibold">{entryToDelete.crmName}</span>. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setEntryToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Deleting...</> : "Yes, Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
