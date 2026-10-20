
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { Lead, User, LeadCategory, LeadStatusType, GlobalSettings } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { useSocket } from '@/contexts/socket-context';
import { DndContext, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent, type DragCancelEvent, closestCorners, DragOverlay } from '@dnd-kit/core';
import { getLeads, getLeadsPaginatedAction, updateLeadAction, deleteLeadAction, transferSelectedLeadsAction, getUniqueLeadCrmIdsAction } from '@/app/(app)/pipeline/actions';
import { getUsers } from '@/lib/user-service';
import { getGlobalSettings } from '@/lib/settings-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, isSameWeek, isSameMonth, isSameYear } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from '@/lib/utils';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis
} from "@/components/ui/pagination";
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePicker, type PredefinedRange } from '@/components/dashboard/date-range-picker';
import type { DateRange } from "react-day-picker";
import { isWithinInterval, subDays, startOfDay, endOfDay } from 'date-fns';
import { LeadCalendarView } from './LeadCalendarView';
import { ViewLeadDialog } from './ViewLeadDialog';
import {
  PlusCircle, Search, FileSpreadsheet, UploadCloud, Download, Bot, ShoppingCart, PhoneCall,
  Briefcase, Users, User as UserIcon, BaggageClaim, AlertTriangle, Loader2, ChevronDown, Check,
  ChevronsUpDown, LayoutGrid, List, Calendar as CalendarIcon, Eye, X, Activity, BarChart3, LucideIcon, Thermometer, Wallet, XCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import Papa from 'papaparse';
import { PipelineKanbanColumn } from '@/components/pipeline/PipelineKanbanColumn';
import { LeadListView } from './LeadListView';
import { LeadReportView } from './LeadReportView';
import { LeadHistoryDialog } from './LeadHistoryDialog';

import { LEAD_CATEGORY_LABELS, LEAD_TEMPERATURES } from '@/lib/pipeline-constants';
import { TemperatureGauge } from './TemperatureGauge';
const LeadCard = dynamic(() => import('@/components/pipeline/LeadCard').then(mod => mod.LeadCard), {
  ssr: false,
  loading: () => <Skeleton className="h-20 w-full rounded-md" />
});
const AddEditLeadDialog = dynamic(() => import('@/components/pipeline/AddEditLeadDialog').then(mod => mod.AddEditLeadDialog));
const ImportLeadsDialog = dynamic(() => import('@/components/pipeline/ImportLeadsDialog').then(mod => mod.ImportLeadsDialog));
const TransferLeadDialog = dynamic(() => import('@/components/pipeline/TransferLeadDialog').then(mod => mod.TransferLeadDialog));
const TransferLeadsDialog = dynamic(() => import('@/components/pipeline/TransferLeadsDialog').then(mod => mod.TransferLeadsDialog));


const KANBAN_COLUMNS_CONFIG: Array<{ title: string; category: LeadCategory; icon: LucideIcon; headerBgClass: string }> = [
  { title: LEAD_CATEGORY_LABELS['POP'], category: 'POP', icon: UserIcon, headerBgClass: 'bg-sky-600' },
  { title: LEAD_CATEGORY_LABELS['APPOINTMENT'], category: 'APPOINTMENT', icon: CalendarIcon, headerBgClass: 'bg-indigo-600' },
  { title: LEAD_CATEGORY_LABELS['PROSPECT'], category: 'PROSPECT', icon: Users, headerBgClass: 'bg-pink-600' },
  { title: LEAD_CATEGORY_LABELS['POG'], category: 'POG', icon: Users, headerBgClass: 'bg-blue-600' },
  { title: LEAD_CATEGORY_LABELS['OC'], category: 'OC', icon: BaggageClaim, headerBgClass: 'bg-purple-600' },
  { title: LEAD_CATEGORY_LABELS['BUDGET_ISSUE'], category: 'BUDGET_ISSUE', icon: Wallet, headerBgClass: 'bg-amber-600' },
  { title: LEAD_CATEGORY_LABELS['CANCELLED'], category: 'CANCELLED', icon: XCircle, headerBgClass: 'bg-red-600' },
];

const ITEMS_PER_PAGE = 25;

const LEAD_CATEGORIES: LeadCategory[] = ['POP', 'APPOINTMENT', 'PROSPECT', 'POG', 'OC', 'BUDGET_ISSUE', 'CANCELLED'];

const ACTIVITY_TYPES = [
  'Follow-up Call',
  'Sent Proposal',
  'Meeting',
  'Site Visit',
  'Negotiation',
  'No Response',
  'Other'
];

export function PipelineClient() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const { socket } = useSocket();

  const [allCrmUsers, setAllCrmUsers] = useState<User[]>([]);
  const [crmInfoWithLeads, setCrmInfoWithLeads] = useState<Array<{ crmId: string; crmName: string }>>([]);
  const [selectedCrmId, setSelectedCrmId] = useState<string>('all');
  const [isCrmFilterOpen, setIsCrmFilterOpen] = useState(false);
  const [crmSearchQuery, setCrmSearchQuery] = useState("");
  const [crmDropdownTab, setCrmDropdownTab] = useState<'active' | 'leave'>('active');

  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isBulkTransferOpen, setIsBulkTransferOpen] = useState(false);

  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [isDeletingLead, setIsDeletingLead] = useState(false);

  const [leadToTransfer, setLeadToTransfer] = useState<Lead | null>(null);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);

  const [leadToView, setLeadToView] = useState<Lead | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const [leadForHistory, setLeadForHistory] = useState<Lead | null>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'calendar' | 'report'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE);
  const [totalLeadsCount, setTotalLeadsCount] = useState<number>(0);

  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [temperatureFilter, setTemperatureFilter] = useState<string>('all');

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState(new Set<string>());
  const [isTransferSelectedDialogOpen, setIsTransferSelectedDialogOpen] = useState(false);


  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const fetchLeadsAndUsers = useCallback(async (isSilent = false) => {
    if (!currentUser) return;
    if (!isSilent) {
      setIsLoading(true);
    }
    try {
      const startStr = (!debouncedSearchTerm && selectedDateRange?.from) ? startOfDay(selectedDateRange.from).toISOString() : undefined;
      const endStr = (!debouncedSearchTerm && selectedDateRange?.to) ? endOfDay(selectedDateRange.to).toISOString() : undefined;
      const role = currentUser?.role;
      const userId = (role === 'SYSTEM_ADMIN' || role === 'ADMIN') ? (selectedCrmId && selectedCrmId !== 'all' ? selectedCrmId : undefined) : currentUser?.id;

      let fetchedLeads: Lead[] = [];
      let fetchedTotal = 0;

      const [usersData, settingsData, crmIdsData] = await Promise.all([
        getUsers(),
        getGlobalSettings(),
        getUniqueLeadCrmIdsAction()
      ]);

      if (viewMode === 'list' || viewMode === 'report') {
        const paginatedResult = await getLeadsPaginatedAction(
          currentPage,
          itemsPerPage,
          startStr,
          endStr,
          role,
          userId,
          categoryFilter,
          activityFilter,
          debouncedSearchTerm,
          temperatureFilter
        );
        fetchedLeads = paginatedResult.leads;
        fetchedTotal = paginatedResult.total;
      } else {
        fetchedLeads = await getLeads(startStr, endStr, role, userId, categoryFilter, activityFilter, debouncedSearchTerm, temperatureFilter);
        fetchedTotal = fetchedLeads.length;
      }

      setLeads(fetchedLeads);
      setTotalLeadsCount(fetchedTotal);
      setAllUsers(usersData);
      setGlobalSettings(settingsData);
      setCrmInfoWithLeads(crmIdsData);
    } catch (error) {
      console.error("Failed to fetch leads or users:", error);
      toast({ title: "Error", description: "Could not load data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast, selectedDateRange, selectedCrmId, viewMode, currentPage, itemsPerPage, categoryFilter, activityFilter, debouncedSearchTerm, temperatureFilter]);

  useEffect(() => {
    fetchLeadsAndUsers();
  }, [fetchLeadsAndUsers]);

  useEffect(() => {
    if (!socket) return;

    socket.on("lead-updated", (data: any) => {
      fetchLeadsAndUsers(true); // refresh leads silently
    });

    return () => {
      socket.off("lead-updated");
    };
  }, [socket, fetchLeadsAndUsers]);

  useEffect(() => {
    const crms = allUsers.filter(u => u.role === 'CR');
    setAllCrmUsers(crms);
  }, [allUsers]);

  const sourceCrmOptions = useMemo(() => {
    return allUsers.filter(u => u.role === 'CR');
  }, [allUsers]);

  useEffect(() => {
    if (currentUser?.role === 'CR') {
      setSelectedCrmId(currentUser.id);
    }
  }, [currentUser]);


  const filteredLeads = useMemo(() => {
    let baseLeads = [...leads];

    // Filter by CR first
    if (selectedCrmId !== 'all') {
      baseLeads = baseLeads.filter(lead => lead.crmId === selectedCrmId);
    }

    // Activity filter
    if (activityFilter !== 'all') {
      baseLeads = baseLeads.filter(lead =>
        lead.activityHistory?.some(activity => activity.activity === activityFilter)
      );
    }

    // Category filter (only for list view)
    if (viewMode === 'list' && categoryFilter !== 'all') {
      baseLeads = baseLeads.filter(lead => lead.category === categoryFilter);
    }

    // Search term is now handled entirely on the server side via debouncedSearchTerm

    return baseLeads.sort((a, b) => new Date(b.categoryUpdatedAt || b.date).getTime() - new Date(a.categoryUpdatedAt || a.date).getTime());

  }, [leads, searchTerm, selectedCrmId, selectedDateRange, categoryFilter, viewMode, activityFilter]);

  const totalPages = (viewMode === 'list' || viewMode === 'report')
    ? Math.ceil(totalLeadsCount / itemsPerPage)
    : Math.ceil(filteredLeads.length / itemsPerPage);

  const paginatedLeads = useMemo(() => {
    if (viewMode === 'list' || viewMode === 'report') {
      return filteredLeads;
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLeads.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLeads, currentPage, itemsPerPage, viewMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCrmId, viewMode, selectedDateRange, categoryFilter, activityFilter, temperatureFilter]);

  const activeCrmUsers = useMemo(() => {
    return allUsers.filter(u => u.role === 'CR' && !u.isBanned);
  }, [allUsers]);

  const leaveCrmUsers = useMemo(() => {
    const activeIds = new Set(activeCrmUsers.map(u => u.id));
    const dbCrmMap = new Map(crmInfoWithLeads.map(item => [item.crmId, item.crmName]));

    const inactiveWithLeads = allUsers.filter(u =>
      !activeIds.has(u.id) && dbCrmMap.has(u.id)
    );

    const handledDbIds = new Set<string>();
    allUsers.forEach(u => {
      if (dbCrmMap.has(u.id)) handledDbIds.add(u.id);
    });

    const unhandledDbEntries = crmInfoWithLeads.filter(item => !activeIds.has(item.crmId) && !handledDbIds.has(item.crmId));

    const missingUsers = unhandledDbEntries.map(item => {
      const sampleLead = leads.find(l => l.crmId === item.crmId);
      return {
        id: item.crmId,
        name: item.crmName || sampleLead?.crmName || item.crmId,
        email: '',
        role: 'CR' as const,
        isBanned: true,
      };
    });

    return [...inactiveWithLeads, ...missingUsers];
  }, [allUsers, activeCrmUsers, crmInfoWithLeads, leads]);

  const selectedCrmName = useMemo(() => {
    if (selectedCrmId === 'all') return 'All CRMs';
    const foundUser = allUsers.find(u => u.id === selectedCrmId);
    if (foundUser) return foundUser.name;
    const dbCrm = crmInfoWithLeads.find(item => item.crmId === selectedCrmId);
    if (dbCrm?.crmName) return dbCrm.crmName;
    const sampleLead = leads.find(l => l.crmId === selectedCrmId);
    if (sampleLead?.crmName) return sampleLead.crmName;
    return "Select CR";
  }, [selectedCrmId, allUsers, crmInfoWithLeads, leads]);

  const filteredCrmUsersForDropdown = useMemo(() => {
    const allCrmsOption = { id: 'all', name: 'All CRMs', role: 'CR' as const, email: '' };
    const baseList = crmDropdownTab === 'active'
      ? [allCrmsOption, ...activeCrmUsers]
      : leaveCrmUsers;

    if (!crmSearchQuery) return baseList;
    return baseList.filter(user =>
      user.name.toLowerCase().includes(crmSearchQuery.toLowerCase())
    );
  }, [crmDropdownTab, activeCrmUsers, leaveCrmUsers, crmSearchQuery]);

  const leadsByCategory = useMemo(() => {
    const grouped: Record<LeadCategory, Lead[]> = {
      'POP': [], 'APPOINTMENT': [], 'PROSPECT': [], 'POG': [], 'OC': [], 'BUDGET_ISSUE': [], 'CANCELLED': []
    };
    filteredLeads.forEach(lead => {
      if (grouped[lead.category]) {
        grouped[lead.category].push(lead);
      }
    });
    return grouped;
  }, [filteredLeads]);

  const kanbanServerFilters = useMemo(() => ({
    startDate: (!debouncedSearchTerm && selectedDateRange?.from) ? format(startOfDay(selectedDateRange.from), 'yyyy-MM-dd HH:mm:ss') : undefined,
    endDate: (!debouncedSearchTerm && selectedDateRange?.to) ? format(endOfDay(selectedDateRange.to), 'yyyy-MM-dd HH:mm:ss') : undefined,
    role: currentUser?.role,
    userId: (currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.role === 'ADMIN') ? (selectedCrmId && selectedCrmId !== 'all' ? selectedCrmId : undefined) : currentUser?.id,
    activity: activityFilter,
    searchTerm: debouncedSearchTerm,
    temperature: temperatureFilter,
  }), [selectedDateRange, currentUser?.role, currentUser?.id, selectedCrmId, activityFilter, debouncedSearchTerm, temperatureFilter]);

  const handleOpenAddDialog = () => {
    setEditingLead(null);
    setIsAddEditOpen(true);
  };

  const handleLeadSaved = (savedLead?: Lead, isEdit?: boolean) => {
    setIsAddEditOpen(false);
    setEditingLead(null);
    if (savedLead) {
      if (isEdit) {
        setLeads(prev => prev.map(l => (l.id === savedLead.id ? savedLead : l)));
      } else {
        setLeads(prev => [savedLead, ...prev]);
      }
    } else {
      fetchLeadsAndUsers(true);
    }
  };

  const handleLeadUpdatedFromView = (updatedLead: Lead) => {
    setLeads(prev => prev.map(l => (l.id === updatedLead.id ? updatedLead : l)));
  };

  const handleDeleteRequest = (lead: Lead) => {
    setLeadToDelete(lead);
  };

  const handleTransferRequest = (lead: Lead) => {
    setLeadToTransfer(lead);
    setIsTransferDialogOpen(true);
  };

  const handleLeadTransferred = () => {
    setIsTransferDialogOpen(false);
    setLeadToTransfer(null);
    fetchLeadsAndUsers(true);
  }

  const handleConfirmDelete = async () => {
    if (!leadToDelete) return;
    setIsDeletingLead(true);
    const result = await deleteLeadAction(leadToDelete.id);
    setIsDeletingLead(false);
    if (result.success) {
      toast({ title: "Lead Deleted", description: `Lead for "${leadToDelete.contactName}" was deleted.` });
      setLeads(prev => prev.filter(l => l.id !== leadToDelete.id));
    } else {
      toast({ title: "Error", description: result.error || "Could not delete the lead.", variant: "destructive" });
    }
    setLeadToDelete(null);
  };

  const handleUpdateLeadCategory = async (lead: Lead, newCategory: LeadCategory) => {
    const originalCategory = lead.category;
    if (newCategory === originalCategory) return;
    
    const now = new Date().toISOString();
    const newActivity = {
      id: Math.random().toString(36).substr(2, 9), // Simple ID for optimistic update
      timestamp: now,
      activity: `Category: ${LEAD_CATEGORY_LABELS[newCategory]}`,
      notes: `Moved from ${LEAD_CATEGORY_LABELS[originalCategory]}`,
      changedByUserId: currentUser?.id || '',
      changedByUserName: currentUser?.name || 'System',
    };

    setLeads(prev => prev.map(l => l.id === lead.id ? { 
      ...l, 
      category: newCategory, 
      categoryUpdatedAt: now, 
      updatedAt: now,
      activityHistory: [newActivity, ...(l.activityHistory || [])]
    } : l));

    const result = await updateLeadAction(lead.id, { 
      category: newCategory,
      activityHistory: [newActivity, ...(lead.activityHistory || [])]
    });

    if (!result.success) {
      toast({ title: "Update Failed", description: result.error || "Could not update lead category.", variant: "destructive" });
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, category: originalCategory } : l));
    } else {
      toast({ title: "Lead Updated", description: `Lead "${lead.contactName}" moved to ${newCategory}.` });
    }
  };

  const handleExport = () => {
    if (filteredLeads.length === 0) {
      toast({ title: "No Data to Export", description: "There is no data matching the current filters." });
      return;
    }
    const dataToExport = filteredLeads.map(lead => ({
      date: lead.date, contactName: lead.contactName, businessName: lead.businessName, phone: lead.phone,
      source: lead.source, address: lead.address, category: lead.category, status: lead.status,
      notes: lead.notes, schedule: lead.schedule, crmName: lead.crmName
    }));
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'pipeline_leads_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Export Successful", description: "Lead data has been downloaded." });
  };

  const handleDragStart = (event: DragStartEvent) => { setActiveLead(event.active.data.current?.lead as Lead); };
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = event;

    if (!over || !active.data.current?.lead) return;
    const lead = active.data.current.lead as Lead;
    const newCategory = over.id as LeadCategory;
    await handleUpdateLeadCategory(lead, newCategory);
  };
  const handleDragCancel = () => { setActiveLead(null); };

  const handleSelectionChange = (leadId: string, isSelected: boolean) => {
    setSelectedLeadIds(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(leadId);
      } else {
        newSet.delete(leadId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedLeadIds(new Set(paginatedLeads.map(l => l.id)));
    } else {
      setSelectedLeadIds(new Set());
    }
  };

  const renderPagination = () => {
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
    return pageNumbers.map((page, index) => (
      <PaginationItem key={index}>
        {page === '...' ? <PaginationEllipsis />
          : <PaginationLink href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(page as number); }} className={cn(currentPage === page && 'bg-primary text-primary-foreground hover:bg-primary/90')}>
            {page}
          </PaginationLink>
        }
      </PaginationItem>
    ));
  };

  const handleDateRangeChange = (
    range: DateRange | undefined,
    displayLabel: string,
    predefinedValue: PredefinedRange | "custom" | null
  ) => {
    setSelectedDateRange(range);
  };

  const openViewDialog = (lead: Lead) => {
    setLeadToView(lead);
    setIsViewDialogOpen(true);
  };

  const openHistoryDialog = (lead: Lead) => {
    setLeadForHistory(lead);
    setIsHistoryDialogOpen(true);
  };

  const openEditDialogFromView = (lead: Lead) => {
    setIsViewDialogOpen(false);
    setLeadToView(null);
    setEditingLead(lead);
    setIsAddEditOpen(true);
  };

  const handleOpenBulkTransferDialog = () => {
    setIsBulkTransferOpen(true);
  };

  const cancelSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedLeadIds(new Set());
  };

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN';
  const isLeader = currentUser?.isLeader;
  const showCrmFilter = isAdmin || isLeader;


  if (!currentUser) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      collisionDetection={closestCorners}
    >
      <div className={cn("flex flex-col", viewMode !== 'list' ? 'h-[calc(100vh-theme(spacing.24))]' : '')}>
        <div className="flex flex-col lg:flex-row gap-4 mb-4 px-4 sm:px-0">
          <Input placeholder="Search leads..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-card border-border/50 focus:border-primary lg:max-w-xs" />
          <div className="flex-grow flex flex-col sm:flex-row items-center gap-2">
            {showCrmFilter && (
              <Popover open={isCrmFilterOpen} onOpenChange={setIsCrmFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={isCrmFilterOpen} className="w-full sm:w-auto justify-between bg-card border-border/50 focus:border-primary h-10">
                    <span className="truncate">{selectedCrmName}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto min-w-[240px] p-0">
                  <Command>
                    <CommandInput placeholder="Search CR..." value={crmSearchQuery} onValueChange={setCrmSearchQuery} />
                    <div className="flex border-b border-border/50 p-1 bg-muted/40 gap-1">
                      <button
                        type="button"
                        onClick={() => setCrmDropdownTab('active')}
                        className={cn(
                          "flex-1 text-xs font-semibold py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1",
                          crmDropdownTab === 'active' ? "bg-primary text-primary-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        Active ({activeCrmUsers.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCrmDropdownTab('leave')}
                        className={cn(
                          "flex-1 text-xs font-semibold py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1",
                          crmDropdownTab === 'leave' ? "bg-primary text-primary-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        Leave ({leaveCrmUsers.length})
                      </button>
                    </div>
                    <CommandList>
                      <CommandEmpty>
                        {crmDropdownTab === 'active' ? 'No active CR found.' : 'No leave/former CR found.'}
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredCrmUsersForDropdown.map(crm => (
                          <CommandItem
                            key={crm.id}
                            value={crm.name}
                            onSelect={() => {
                              setSelectedCrmId(crm.id);
                              if (crmDropdownTab === 'leave' && crm.id !== 'all') {
                                setSelectedDateRange(undefined);
                              }
                              setIsCrmFilterOpen(false);
                            }}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center truncate">
                              <Check className={cn("mr-2 h-4 w-4 shrink-0", crm.id === selectedCrmId ? "opacity-100 text-primary" : "opacity-0")} />
                              <span className="truncate">{crm.name}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
            <DateRangePicker initialRange={selectedDateRange} onDateRangeChange={handleDateRangeChange} />

            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger className="w-full sm:w-[180px] bg-card border-border/50 focus:border-primary h-10">
                <div className="flex items-center gap-2 truncate">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Filter by activity..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Activity</SelectItem>
                {ACTIVITY_TYPES.map(act => <SelectItem key={act} value={act}>{act}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={temperatureFilter} onValueChange={setTemperatureFilter}>
              <SelectTrigger className="w-full sm:w-[160px] bg-card border-border/50 focus:border-primary h-10">
                <SelectValue placeholder="Filter by temperature..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2 whitespace-nowrap"><Thermometer className="h-4 w-4 text-muted-foreground" />Temp</span>
                </SelectItem>
                {LEAD_TEMPERATURES.map(t => (
                  <SelectItem key={t} value={String(t)}>
                    <span className="flex items-center gap-2 whitespace-nowrap"><TemperatureGauge value={t} />{t}%</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {viewMode === 'list' && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px] bg-card border-border/50 focus:border-primary h-10"><SelectValue placeholder="Filter by category..." /></SelectTrigger>
                <SelectContent><SelectItem value="all">Category</SelectItem>{LEAD_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{LEAD_CATEGORY_LABELS[cat]}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <div className="flex items-center bg-muted p-1 rounded-md ml-auto">
              <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="h-8"><List className="h-4 w-4" /></Button>
              <Button variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')} className="h-8"><LayoutGrid className="h-4 w-4" /></Button>
              <Button variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('calendar')} className="h-8"><CalendarIcon className="h-4 w-4" /></Button>
            </div>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto h-10">Actions <ChevronDown className="ml-2 h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setViewMode('report')}><BarChart3 className="mr-2 h-4 w-4" />Lead Reports</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setIsImportOpen(true)}><FileSpreadsheet className="mr-2 h-4 w-4" />Import Leads</DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleExport} disabled={filteredLeads.length === 0}><Download className="mr-2 h-4 w-4" />Export Leads</DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleOpenBulkTransferDialog}><Users className="mr-2 h-4 w-4" /> Bulk Transfer</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {isAdmin && viewMode === 'list' && !isSelectionMode && (
              <Button onClick={() => setIsSelectionMode(true)} variant="outline" className="w-full sm:w-auto h-10">
                <Check className="mr-2 h-4 w-4" /> Select to Transfer
              </Button>
            )}

            {viewMode === 'list' && isSelectionMode && (
              <>
                <Button onClick={() => setIsTransferSelectedDialogOpen(true)} disabled={selectedLeadIds.size === 0} className="w-full sm:w-auto h-10 bg-blue-600 hover:bg-blue-700">
                  <Users className="mr-2 h-4 w-4" /> Transfer Selected ({selectedLeadIds.size})
                </Button>
                <Button onClick={cancelSelectionMode} variant="ghost" className="w-full sm:w-auto h-10 text-destructive hover:text-destructive hover:bg-destructive/10">
                  <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
              </>
            )}

            <Button onClick={handleOpenAddDialog} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground h-10"><PlusCircle className="mr-2 h-5 w-5" />Add Lead</Button>
          </div>
        </div>

        {viewMode === 'kanban' ? (
          <div className="flex-1 mt-4 overflow-x-auto pb-4 custom-scrollbar">
            <div className="flex space-x-4 h-full min-w-max px-4 sm:px-0">
              {KANBAN_COLUMNS_CONFIG.map((col) => (
                <PipelineKanbanColumn
                  key={col.category} id={col.category} title={col.title} icon={col.icon}
                  leads={leadsByCategory[col.category] || []} headerBgClass={col.headerBgClass}
                  isLoading={isLoading} currentUser={currentUser}
                  onViewLead={openViewDialog} onDeleteLead={handleDeleteRequest} onTransferLead={handleTransferRequest} 
                  onHistoryView={openHistoryDialog}
                  allUsers={allUsers}
                  serverFilters={kanbanServerFilters}
                />
              ))}
            </div>
          </div>
        ) : viewMode === 'list' ? (
          <>
            <LeadListView
              leads={paginatedLeads} isLoading={isLoading} currentUser={currentUser}
              onViewLead={openViewDialog} onDeleteLead={handleDeleteRequest} onTransferLead={handleTransferRequest}
              onUpdateLeadCategory={handleUpdateLeadCategory} allUsers={allUsers}
              onHistoryView={openHistoryDialog}
              onEditLead={openEditDialogFromView}
              isSelectionMode={isSelectionMode}
              selectedLeadIds={selectedLeadIds}
              onSelectionChange={handleSelectionChange}
              onSelectAll={handleSelectAll}
            />
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                <span>Show</span>
                <Select value={itemsPerPage.toString()} onValueChange={(val) => { setItemsPerPage(Number(val)); setCurrentPage(1); }}>
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue placeholder={itemsPerPage.toString()} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[10, 25, 50, 100].map(size => (
                      <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="whitespace-nowrap">of {viewMode === 'list' ? totalLeadsCount : filteredLeads.length} leads</span>
              </div>

              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => { e.preventDefault(); if (currentPage > 1) setCurrentPage(p => p - 1); }}
                        aria-disabled={currentPage === 1}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {renderPagination()}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage(p => p + 1); }}
                        aria-disabled={currentPage === totalPages}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </>
        ) : viewMode === 'report' ? (
          <LeadReportView
            leads={paginatedLeads}
            allUsers={allUsers}
            serverPagination={{
              currentPage,
              totalPages,
              onPageChange: (p) => setCurrentPage(p),
            }}
          />
        ) : (
          <div className="flex-1 mt-4 flex flex-col">
            <LeadCalendarView
              leads={filteredLeads}
              onViewLead={openViewDialog}
            />
          </div>
        )}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeLead ? <LeadCard lead={activeLead} isOverlay currentUser={currentUser} onViewLead={() => { }} onDeleteLead={() => { }} onTransferLead={() => { }} onHistoryView={() => { }} allUsers={allUsers} headerBgClass={KANBAN_COLUMNS_CONFIG.find(c => c.category === activeLead.category)?.headerBgClass || 'bg-gray-500'} /> : null}
      </DragOverlay>

      <AddEditLeadDialog isOpen={isAddEditOpen} onOpenChange={setIsAddEditOpen} onLeadSaved={handleLeadSaved} lead={editingLead} currentUser={currentUser} />
      <ImportLeadsDialog isOpen={isImportOpen} onOpenChange={setIsImportOpen} onLeadsImported={handleLeadSaved} currentUser={currentUser} />
      {currentUser.role !== 'CR' && <TransferLeadsDialog isOpen={isBulkTransferOpen} onOpenChange={setIsBulkTransferOpen} onLeadsTransferred={() => fetchLeadsAndUsers(true)} allCrmUsers={allCrmUsers} currentUser={currentUser} />}
      {leadToTransfer && (<TransferLeadDialog isOpen={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen} onLeadTransferred={handleLeadTransferred} lead={leadToTransfer} allCrmUsers={allCrmUsers.filter(u => u.id !== leadToTransfer.crmId)} currentUser={currentUser} />)}
      {leadToView && (<ViewLeadDialog isOpen={isViewDialogOpen} onOpenChange={setIsViewDialogOpen} onLeadUpdated={handleLeadUpdatedFromView} onEditRequest={openEditDialogFromView} lead={leadToView} currentUser={currentUser} />)}
      {leadForHistory && (<LeadHistoryDialog isOpen={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen} lead={leadForHistory} allUsers={allUsers} />)}
      {leadToDelete && (
        <AlertDialog open={!!leadToDelete} onOpenChange={() => setLeadToDelete(null)}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-destructive" /> Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the lead for "<span className="font-semibold">{leadToDelete.contactName}</span>".</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel disabled={isDeletingLead}>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" onClick={handleConfirmDelete} disabled={isDeletingLead}>{isDeletingLead ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : "Yes, delete lead"}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {isSelectionMode && currentUser && (
        <TransferLeadsDialog
          isOpen={isTransferSelectedDialogOpen}
          onOpenChange={setIsTransferSelectedDialogOpen}
          onLeadsTransferred={() => {
            setIsTransferSelectedDialogOpen(false);
            cancelSelectionMode();
            fetchLeadsAndUsers(true);
          }}
          selectedLeadIds={Array.from(selectedLeadIds)}
          allCrmUsers={allCrmUsers}
          currentUser={currentUser}
        />
      )}
    </DndContext>
  );
}
