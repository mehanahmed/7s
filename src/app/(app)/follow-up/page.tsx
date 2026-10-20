"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getLeads, getEventsPaginatedAction, updateLeadAction } from '@/app/(app)/pipeline/actions';
import { getUsers } from '@/lib/user-service';
import { LEAD_CATEGORY_LABELS } from '@/lib/pipeline-constants';
import type { Lead, User } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { useSocket } from '@/contexts/socket-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ViewLeadDialog } from '@/components/pipeline/ViewLeadDialog';
import { AddEditLeadDialog } from '@/components/pipeline/AddEditLeadDialog';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  Pagination, PaginationContent, PaginationItem, PaginationLink, 
  PaginationNext, PaginationPrevious, PaginationEllipsis 
} from "@/components/ui/pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, PlusCircle, Check, ChevronsUpDown, 
  Search, Building, Clock, AlertCircle, Eye, Edit, MoreVertical, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isBefore, startOfDay, endOfDay, isToday } from 'date-fns';
import { DateRangePicker3 } from '@/components/dashboard/date-range-picker3';
import type { DateRange } from "react-day-picker";

const ITEMS_PER_PAGE = 15;

const getCategoryColorClass = (category: string) => {
  switch (category) {
    case 'POP': return 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800';
    case 'APPOINTMENT': return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800';
    case 'PROSPECT': return 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800';
    case 'POG': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
    case 'OC': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800';
    case 'BUDGET_ISSUE': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';
    case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800';
    default: return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-800';
  }
};

const formatDateSafe = (dateString?: string | null) => {
  if (!dateString) return 'N/A';
  try {
    return format(parseISO(dateString), 'd MMM, yyyy');
  } catch (e) {
    return 'Invalid Date';
  }
};

const getInitials = (name?: string) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return parts[0].charAt(0).toUpperCase() + parts[parts.length - 1].charAt(0).toUpperCase();
};

const getRecentActivityNote = (lead: Lead): string => {
  if (!lead.activityHistory || lead.activityHistory.length === 0) {
    return lead.notes || 'Initial lead entry created.';
  }
  const sortedActivities = [...lead.activityHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const latest = sortedActivities[0];
  if (latest.activity === 'Lead Created') {
    return lead.notes || 'Initial lead entry created.';
  }
  return latest.notes || latest.activity;
};

export default function EventsPage() {
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { socket } = useSocket();
  const { toast } = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [currentPage, setCurrentPage] = useState(1);
  const [timeFilter, setTimeFilter] = useState<'today' | 'all'>('all');

  const [allCrmUsers, setAllCrmUsers] = useState<User[]>([]);
  const [selectedCrmId, setSelectedCrmId] = useState<string>('all');
  const [isCrmFilterOpen, setIsCrmFilterOpen] = useState(false);
  const [crmSearchQuery, setCrmSearchQuery] = useState("");

  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [leadToView, setLeadToView] = useState<Lead | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [eventToRemove, setEventToRemove] = useState<Lead | null>(null);
  const [isRemovingEvent, setIsRemovingEvent] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, timeFilter, selectedCrmId, selectedDateRange]);

  const fetchLeadsAndUsers = useCallback(async (isSilent = false) => {
    if (!currentUser) return;
    if (!isSilent) {
      setIsLoading(true);
    }
    try {
      const startStr = (!debouncedSearchTerm && selectedDateRange?.from) ? startOfDay(selectedDateRange.from).toISOString() : undefined;
      const endStr = (!debouncedSearchTerm && selectedDateRange?.to) ? endOfDay(selectedDateRange.to).toISOString() : undefined;
      const role = currentUser?.role;
      const userId = (role === 'SYSTEM_ADMIN' || role === 'ADMIN') ? undefined : currentUser?.id;
      const scheduleStart = timeFilter === 'today' ? startOfDay(new Date()).toISOString() : undefined;
      const scheduleEnd = timeFilter === 'today' ? endOfDay(new Date()).toISOString() : undefined;
      const crmFilterId = selectedCrmId === 'all' ? undefined : selectedCrmId;
      const queryUserId = (role === 'SYSTEM_ADMIN' || role === 'ADMIN') ? crmFilterId : userId;

      const [paginatedResult, fetchedUsers] = await Promise.all([
        getEventsPaginatedAction(
          currentPage,
          ITEMS_PER_PAGE,
          startStr,
          endStr,
          role,
          queryUserId,
          debouncedSearchTerm,
          scheduleStart,
          scheduleEnd
        ),
        getUsers()
      ]);
      setLeads(paginatedResult.leads);
      setTotalEvents(paginatedResult.total);
      setAllUsers(fetchedUsers);
    } catch (error) {
      toast({ 
        title: "Error fetching data", 
        description: "Could not load events or user data.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, currentUser, selectedDateRange, debouncedSearchTerm, currentPage, timeFilter, selectedCrmId]);

  useEffect(() => {
    if (currentUser) {
      fetchLeadsAndUsers();
    }
  }, [fetchLeadsAndUsers, currentUser]);

  useEffect(() => {
    if (!socket) return;
    socket.on("lead-updated", () => {
      fetchLeadsAndUsers(true);
    });
    return () => {
      socket.off("lead-updated");
    };
  }, [socket, fetchLeadsAndUsers]);

  useEffect(() => {
    const crms = allUsers.filter(u => u.role === 'CR');
    setAllCrmUsers(crms);
  }, [allUsers]);

  // Set default filter based on role
  useEffect(() => {
    if (currentUser?.role === 'CR') {
      setSelectedCrmId(currentUser.id);
    }
  }, [currentUser]);

  // Reset page number on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCrmId, timeFilter]);

  const handleRemoveEventClick = (lead: Lead) => {
    setEventToRemove(lead);
  };

  const handleConfirmRemoveEvent = async () => {
    if (!eventToRemove) return;
    setIsRemovingEvent(true);
    try {
      const result = await updateLeadAction(eventToRemove.id, { schedule: null });
      if (result.success) {
        toast({
          title: "Follow UP Removed",
          description: `Scheduled date for "${eventToRemove.contactName}" has been removed.`
        });
        fetchLeadsAndUsers(true);
      } else {
        toast({
          title: "Error",
          description: result.error || "Could not remove the event schedule.",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsRemovingEvent(false);
      setEventToRemove(null);
    }
  };

  const handleLeadSaved = (savedLead?: Lead, isEdit?: boolean) => {
    setIsAddEditOpen(false);
    setEditingLead(null);
    fetchLeadsAndUsers(true);
  };

  const handleLeadUpdatedFromView = (updatedLead: Lead) => {
    setLeads(prev => prev.map(l => (l.id === updatedLead.id ? updatedLead : l)));
  };

  const openViewDialog = (lead: Lead) => {
    setLeadToView(lead);
    setIsViewDialogOpen(true);
  };

  const openEditDialogFromView = (lead: Lead) => {
    setIsViewDialogOpen(false);
    setLeadToView(null);
    setEditingLead(lead);
    setIsAddEditOpen(true);
  };

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN';

  // Pagination calculation from server total
  const totalPages = Math.ceil(totalEvents / ITEMS_PER_PAGE);

  const selectedCrmName = useMemo(() => {
    if (selectedCrmId === 'all') return 'All CRMs';
    return allCrmUsers.find(u => u.id === selectedCrmId)?.name || "Select CR";
  }, [selectedCrmId, allCrmUsers]);

  const filteredCrmUsersForDropdown = useMemo(() => {
    const allCrmsOption = { id: 'all', name: 'All CRMs', role: 'SYSTEM_ADMIN' as const, email: '' };
    const baseUsers = [allCrmsOption, ...allCrmUsers.filter(u => !u.isBanned)];
    if (!crmSearchQuery) return baseUsers;
    return baseUsers.filter(user =>
      user.name.toLowerCase().includes(crmSearchQuery.toLowerCase())
    );
  }, [allCrmUsers, crmSearchQuery]);

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pageNumbers = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, currentPage + 2);

      if (currentPage < 3) endPage = maxPagesToShow;
      else if (currentPage > totalPages - 2) startPage = totalPages - maxPagesToShow + 1;

      if (startPage > 1) {
        pageNumbers.push(1);
        if (startPage > 2) pageNumbers.push('...');
      }
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pageNumbers.push('...');
        pageNumbers.push(totalPages);
      }
    }

    return (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }}
              aria-disabled={currentPage === 1}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
          {pageNumbers.map((page, index) => (
            <PaginationItem key={index}>
              {page === '...' ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  href="#"
                  onClick={(e) => { e.preventDefault(); setCurrentPage(page as number); }}
                  isActive={currentPage === page}
                >
                  {page}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }}
              aria-disabled={currentPage === totalPages}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  if (isAuthLoading || !currentUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const hasAccess = ['SYSTEM_ADMIN', 'ADMIN', 'CR'].includes(currentUser.role);
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] p-4 text-center">
        <AlertCircle className="h-16 w-16 text-destructive mb-4 animate-pulse" />
        <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          You do not have the required permissions to view this CR page. Please contact your system administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8 pt-0 flex flex-col space-y-4">
      {/* Table View Card */}
      <Card className="shadow-lg border bg-card rounded-lg overflow-hidden">
        <CardHeader className="border-b pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-lg font-bold">Scheduled Follow UPs</CardTitle>
            <CardDescription>
              Showing all {totalEvents} scheduled CR leads & appointments.
            </CardDescription>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {/* Time Filter Tabs */}
            <Tabs 
              value={timeFilter} 
              onValueChange={(value) => setTimeFilter(value as 'today' | 'all')} 
              className="w-full sm:w-auto"
            >
              <TabsList className="grid w-full grid-cols-2 h-10 bg-muted p-1 rounded-md border border-border/50">
                <TabsTrigger value="all" className="text-xs font-semibold">All Time</TabsTrigger>
                <TabsTrigger value="today" className="text-xs font-semibold">Today</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search events..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-9 bg-background border-border/50 focus:border-primary h-10"
                id="events-search-input"
              />
            </div>
            <DateRangePicker3 initialRange={selectedDateRange} onDateRangeChange={(range) => setSelectedDateRange(range)} />

            {/* CR Dropdown Filter */}
            {isAdmin && (
              <Popover open={isCrmFilterOpen} onOpenChange={setIsCrmFilterOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    role="combobox" 
                    aria-expanded={isCrmFilterOpen} 
                    className="w-full sm:w-48 justify-between bg-background border-border/50 focus:border-primary h-10"
                    id="crm-filter-dropdown"
                  >
                    <span className="truncate">{selectedCrmName}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput 
                      placeholder="Search CR..." 
                      value={crmSearchQuery} 
                      onValueChange={setCrmSearchQuery} 
                    />
                    <CommandList>
                      <CommandEmpty>No CR found.</CommandEmpty>
                      <CommandGroup>
                        {filteredCrmUsersForDropdown.map(crm => (
                          <CommandItem 
                            key={crm.id} 
                            value={crm.name} 
                            onSelect={() => { 
                              setSelectedCrmId(crm.id); 
                              setIsCrmFilterOpen(false); 
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", crm.id === selectedCrmId ? "opacity-100" : "opacity-0")} />
                            {crm.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] text-center">SL</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Contact Name</TableHead>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Assigned CR</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      <TableCell className="text-center"><div className="h-4 w-4 bg-muted animate-pulse mx-auto rounded" /></TableCell>
                      <TableCell><div className="h-5 w-24 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-5 w-32 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-5 w-28 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-5 w-24 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-6 w-16 bg-muted animate-pulse rounded-full" /></TableCell>
                      <TableCell><div className="h-5 w-36 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
                          <div className="h-5 w-24 bg-muted animate-pulse rounded" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right"><div className="h-8 w-8 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : leads.length > 0 ? (
                  leads.map((lead, index) => {
                    const scheduleDate = lead.schedule ? parseISO(lead.schedule) : null;
                    const isPast = scheduleDate ? isBefore(scheduleDate, startOfDay(new Date())) && !isToday(scheduleDate) : false;

                    return (
                      <TableRow key={lead.id} className="hover:bg-muted/50">
                        <TableCell className="text-center font-medium text-muted-foreground">
                          {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {scheduleDate ? (
                            <Badge variant="outline" className={cn(
                              "border-none py-0.5 px-2",
                              isPast
                                ? 'text-red-800 bg-red-100/70 dark:bg-red-900/30 dark:text-red-300'
                                : 'text-green-800 bg-green-100/70 dark:bg-green-900/30 dark:text-green-300'
                            )}>
                              {formatDateSafe(lead.schedule)}
                            </Badge>
                          ) : 'N/A'}
                        </TableCell>
                        <TableCell className="font-medium">{lead.contactName}</TableCell>
                        <TableCell>{lead.businessName || 'N/A'}</TableCell>
                        <TableCell>{lead.phone}</TableCell>
                        <TableCell>
                          <Badge className={cn("hover:opacity-85 font-medium shadow-none text-xs border border-transparent", getCategoryColorClass(lead.category))}>
                            {LEAD_CATEGORY_LABELS[lead.category] || lead.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground" title={getRecentActivityNote(lead)}>
                          {getRecentActivityNote(lead)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8 text-xs">
                              <AvatarImage src={allUsers.find(u => u.id === lead.crmId)?.avatarUrl || undefined} alt={lead.crmName} />
                              <AvatarFallback>{getInitials(lead.crmName)}</AvatarFallback>
                            </Avatar>
                            <span>{lead.crmName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => openViewDialog(lead)} className="cursor-pointer">
                                <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                                <span>View</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => openEditDialogFromView(lead)} className="cursor-pointer">
                                <Edit className="mr-2 h-4 w-4 text-muted-foreground" />
                                <span>Edit</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="my-0.5" />
                              <DropdownMenuItem 
                                onSelect={() => handleRemoveEventClick(lead)} 
                                className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Remove Follow UP</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-48 text-center text-muted-foreground">
                      <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-55 text-primary" />
                      <p className="font-medium text-sm">No scheduled Follow UPs found</p>
                      <p className="text-xs max-w-xs mx-auto mt-1">Try resetting the search or filters to see available scheduled leads.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="py-4 border-t flex justify-center">
          {renderPagination()}
        </CardFooter>
      </Card>

      {/* Dialogs */}
      <AddEditLeadDialog 
        isOpen={isAddEditOpen} 
        onOpenChange={setIsAddEditOpen} 
        onLeadSaved={handleLeadSaved} 
        lead={editingLead} 
        currentUser={currentUser} 
      />
      
      {leadToView && (
        <ViewLeadDialog 
          isOpen={isViewDialogOpen} 
          onOpenChange={setIsViewDialogOpen} 
          onLeadUpdated={handleLeadUpdatedFromView} 
          onEditRequest={openEditDialogFromView} 
          lead={leadToView} 
          currentUser={currentUser} 
        />
      )}

      {eventToRemove && (
        <AlertDialog open={!!eventToRemove} onOpenChange={() => setEventToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Remove Follow UP Schedule?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove the scheduled date for "<span className="font-semibold">{eventToRemove.contactName}</span>"? 
                <br /><br />
                <span className="font-medium text-foreground">Note:</span> This will only clear the schedule date and remove it from the Events page. The lead record itself will NOT be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRemovingEvent}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmRemoveEvent} 
                disabled={isRemovingEvent}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {isRemovingEvent ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Removing...</>
                ) : (
                  "Yes, remove schedule"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
