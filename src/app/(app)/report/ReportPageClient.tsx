
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from "@/components/ui/progress";
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { TrackingLink, GlobalSettings, User, TaskEntry, UserRole } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Package, Settings, X, PlusCircle, Loader2, Users as UsersIcon, BarChart3, ClipboardList, Edit, Trash2, Download, LineChart as LineChartIcon, ChevronsUpDown, Check, Briefcase, BadgeDollarSign, PenLine, Clapperboard, Scissors, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateTaskEntryAction, deleteTaskEntryAction, updateReportFiltersAction, getReportDataAction } from './actions';
import { AnimatePresence, motion } from 'framer-motion';
import { DateRangePicker3, type PredefinedRange } from '@/components/dashboard/date-range-picker3';
import type { DateRange } from "react-day-picker";
import { isWithinInterval, parseISO, subDays, startOfDay, endOfDay, getYear, format, startOfMonth, endOfMonth } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import dynamic from 'next/dynamic';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AddEditTaskDialog } from '@/components/report/AddEditTaskDialog';
import { DeleteTaskDialog } from '@/components/report/DeleteTaskDialog';
import { BarChart as RechartsBarChart, Line, Area, AreaChart as RechartsAreaChart, LineChart as RechartsLineChart } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import { roleInTeam } from '@/lib/roles';
import { CompanySummary } from '@/components/report/CompanySummary';
import { SalesExecutiveCards } from '@/components/report/SalesExecutiveCards';
import { SalesExecutiveCharts } from '@/components/report/SalesExecutiveCharts';
import { ExecutivePerformance } from '@/components/report/ExecutivePerformance';
import { OperationManagerCards } from '@/components/report/OperationManagerCards';
import { OperationManagerDetails } from '@/components/report/OperationManagerDetails';
import { ScriptWriterReport } from '@/components/report/ScriptWriterReport';
import { CinematographerReport } from '@/components/report/CinematographerReport';
import { EditorReport } from '@/components/report/EditorReport';
import { getSalesExecutiveUsers, calculateSalesExecutiveSummary } from '@/lib/sales-executive-summary';
import { DueAmountReport } from '@/components/report/DueAmountReport';


const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-BD', {
        style: 'currency',
        currency: 'BDT',
    }).format(value);
};

const formatDateSafe = (dateString?: string) => {
  if (!dateString) return 'No Date';
  try {
    return format(parseISO(dateString), 'd MMM, yyyy');
  } catch (e) {
    return 'Invalid Date';
  }
};


interface ProductSalesData {
  product: string;
  sales: number;
  quantity: number;
  percentage: number;
}

interface CrmSalesData {
  crmId: string;
  crmName: string;
  totalSales: number;
  avatarUrl?: string | null;
}

const salesBreakdownChartConfig = {
  totalSales: {
    label: "Total Sales",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const dailySalesChartConfig = {
  salesCount: {
    label: "Sales Count",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;


interface ReportFilterSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialFilters: string[];
  onSave: (newFilters: string[]) => Promise<void>;
}

function ReportFilterSettingsDialog({ isOpen, onOpenChange, initialFilters, onSave }: ReportFilterSettingsDialogProps) {
  const [filters, setFilters] = useState(initialFilters);
  const [newFilter, setNewFilter] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFilters(initialFilters);
      setNewFilter("");
    }
  }, [isOpen, initialFilters]);

  const handleAddFilter = () => {
    if (newFilter.trim() && !filters.some(f => f.toLowerCase() === newFilter.trim().toLowerCase())) {
      setFilters([...filters, newFilter.trim()]);
      setNewFilter("");
    }
  };

  const handleRemoveFilter = (filterToRemove: string) => {
    setFilters(filters.filter(f => f !== filterToRemove));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(filters);
    setIsSaving(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center"><Settings className="mr-2 h-5 w-5" />Report Filter Settings</DialogTitle>
          <DialogDescription>
            Manage keywords that group individual products into a single category on the report page.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Current Filter Keywords</Label>
            {filters.length > 0 ? (
              <div className="flex flex-wrap gap-2 rounded-md border p-3 bg-muted/50">
                <AnimatePresence>
                  {filters.map(filter => (
                    <motion.div
                      key={filter}
                      layout
                      initial={{ opacity: 0, y: -10, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -20, scale: 0.8 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                    >
                      <Badge variant="secondary" className="text-base py-1 pl-3 pr-2 shadow-sm">
                        {filter}
                        <button onClick={() => handleRemoveFilter(filter)} className="ml-2 rounded-full hover:bg-destructive/20 p-0.5 transition-colors">
                          <X className="h-3 w-3 text-destructive" />
                        </button>
                      </Badge>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
                No filters configured. All products will be reported individually.
              </div>
            )}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-grow space-y-1">
              <Label htmlFor="new-filter">Add New Filter</Label>
              <Input
                id="new-filter"
                value={newFilter}
                onChange={e => setNewFilter(e.target.value)}
                placeholder="e.g., Combo Package"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFilter(); } }}
              />
            </div>
            <Button onClick={handleAddFilter} type="button" variant="outline" size="icon">
              <PlusCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const getInitials = (name: string | undefined): string => {
  if (!name) return '??';
  const names = name.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return names[0].charAt(0).toUpperCase() + (names.length > 1 ? names[names.length - 1].charAt(0).toUpperCase() : '');
};


const ROLE_FILTERS: Array<{ role: UserRole; plural: string; singular: string; icon: React.ElementType }> = [
  { role: 'ADMIN', plural: 'Operation Manager', singular: 'Operation Manager', icon: Briefcase },
  { role: 'CR', plural: 'Sales Executives', singular: 'Sales Executive', icon: BadgeDollarSign },
  { role: 'SW', plural: 'Script Writers', singular: 'Script Writer', icon: PenLine },
  { role: 'CG', plural: 'Cinematographers', singular: 'Cinematographer', icon: Clapperboard },
  { role: 'EDITOR', plural: 'Editors', singular: 'Editor', icon: Scissors },
];

const initialsOf = (name: string) => {
  const p = name.trim().split(/s+/);
  return ((p[0]?.[0] ?? '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
};

function UserAvatar({ user, className }: { user: User; className?: string }) {
  return (
    <Avatar className={cn('h-6 w-6 shrink-0', className)}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
      <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">{initialsOf(user.name)}</AvatarFallback>
    </Avatar>
  );
}

/** Searchable picker for the users of the chosen department. */
function UserSelect({ users, value, disabled, onChange }: { users: User[]; value: string; disabled?: boolean; onChange: (user: User | null) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = users.find((u) => u.id === value);
  const shown = useMemo(() => users.filter((u) => !query || u.name.toLowerCase().includes(query.toLowerCase())), [users, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} aria-label="Select user" disabled={disabled} className="h-10 w-[200px] justify-between">
          <span className="flex min-w-0 items-center gap-2">
            {selected && <UserAvatar user={selected} className="h-5 w-5" />}
            <span className="truncate">{selected ? selected.name : 'Select User'}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search user..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No user found.</CommandEmpty>
            <CommandGroup>
              {shown.map((u) => (
                // picking the selected user again clears the selection
                <CommandItem key={u.id} value={u.id} onSelect={() => { onChange(u.id === value ? null : u); setOpen(false); setQuery(''); }}>
                  <UserAvatar user={u} className="mr-2" />
                  <span className="flex-1 truncate">{u.name}</span>
                  {u.id === value && <Check className="ml-2 h-4 w-4 shrink-0" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ReportPageClient() {
  const [orders, setOrders] = useState<TrackingLink[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allTasks, setAllTasks] = useState<TaskEntry[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  }));
  const [activeTab, setActiveTab] = useState("daily_sales");

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'daily_sales') {
        setActiveTab(hash);
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

  const [selectedTeam, setSelectedTeam] = useState<UserRole | 'all'>('CR');

  const [taskToEdit, setTaskToEdit] = useState<TaskEntry | null>(null);
  const [isAddEditTaskOpen, setIsAddEditTaskOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<TaskEntry | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [productViewMode, setProductViewMode] = useState<'single' | 'category'>('single');
  
  const [selectedCrmId, setSelectedCrmId] = useState<string>('all');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [selectedDept, setSelectedDept] = useState<UserRole | 'ALL' | ''>('CR');
  const [isCrmFilterOpen, setIsCrmFilterOpen] = useState(false);
  const [crmSearchQuery, setCrmSearchQuery] = useState("");
  const allCrmUsers = useMemo(() => allUsers.filter(u => u.role === 'CR'), [allUsers]);
  const salesExecutiveUsers = useMemo(() => getSalesExecutiveUsers(orders, allUsers), [orders, allUsers]);

  const handleDateRangeChange = useCallback((range: DateRange | undefined, displayLabel: string, predefinedValue: PredefinedRange | "custom" | null) => {
    setSelectedDateRange(range);
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { orders, settings, users, tasks } = await getReportDataAction();
      setOrders(orders);
      setGlobalSettings(settings);
      setAllUsers(users);
      setAllTasks(tasks); 
    } catch (error) {
      console.error("Failed to fetch data for report:", error);
      toast({
        title: "Error",
        description: "Could not load data for the report.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleSaveFilters = async (newFilters: string[]) => {
    const result = await updateReportFiltersAction(newFilters);
    if (result.success) {
        toast({ title: "Settings Saved", description: "Report product filters have been updated." });
        setGlobalSettings(prev => prev ? { ...prev, reportProductFilters: newFilters } : { reportProductFilters: newFilters } as GlobalSettings);
        setIsSettingsOpen(false);
    } else {
        toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    }
  };
  
  const handleTaskSaved = () => {
    setIsAddEditTaskOpen(false);
    setTaskToEdit(null);
    fetchData();
  };

  const handleOpenEditTaskDialog = (task: TaskEntry) => {
    setTaskToEdit(task);
    setIsAddEditTaskOpen(true);
  };

  const handleDeleteTask = (task: TaskEntry) => {
    setTaskToDelete(task);
  };
  
  const handleConfirmDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsDeletingTask(true);
    const result = await deleteTaskEntryAction(taskToDelete.id);
    if (result.success) {
        toast({ title: "Task Entry Deleted" });
        fetchData();
    } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
    }
    setIsDeletingTask(false);
    setTaskToDelete(null);
  };

  const crSummary = useMemo(() => {
    return calculateSalesExecutiveSummary(orders, allUsers, globalSettings, selectedUserId, selectedDateRange);
  }, [orders, allUsers, globalSettings, selectedUserId, selectedDateRange]);

  const filteredOrdersByDate = useMemo(() => {
    let dateFiltered = orders;
    if (selectedDateRange?.from) {
      const startDate = startOfDay(selectedDateRange.from);
      const endDate = selectedDateRange.to ? endOfDay(selectedDateRange.to) : endOfDay(startDate);

      dateFiltered = orders.filter(order => {
        if (!order.createdAt) return false;
        try {
          const orderDate = parseISO(order.createdAt);
          return isWithinInterval(orderDate, { start: startDate, end: endDate });
        } catch {
          return false;
        }
      });
    }
    if (selectedCrmId !== 'all') {
      return dateFiltered.filter(order => order.crmUserId === selectedCrmId);
    }
    return dateFiltered;
  }, [orders, selectedDateRange, selectedCrmId]);

  const filteredTasksByDate = useMemo(() => {
    let tasksToFilter = allTasks;
    
    // Filter by date
    if (selectedDateRange?.from) {
        const startDate = startOfDay(selectedDateRange.from);
        const endDate = selectedDateRange.to ? endOfDay(selectedDateRange.to) : endOfDay(startDate);
        tasksToFilter = tasksToFilter.filter(task => {
            try {
                const taskDate = parseISO(task.date);
                return isWithinInterval(taskDate, { start: startDate, end: endDate });
            } catch { return false; }
        });
    }
    
    // Filter by team/user
    if (selectedCrmId !== 'all') {
      tasksToFilter = tasksToFilter.filter(task => task.userId === selectedCrmId);
    } else if (selectedTeam !== 'all') {
      tasksToFilter = tasksToFilter.filter(task => roleInTeam(task.role, selectedTeam));
    }

    return tasksToFilter.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allTasks, selectedDateRange, selectedTeam, selectedCrmId]);

  const { totalTasksCount } = useMemo(() => {
    const totalTasks = filteredTasksByDate.reduce((sum, task) => sum + task.taskCount, 0);
    return { totalTasksCount: totalTasks };
  }, [filteredTasksByDate]);

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN';
  
  const productSalesData: ProductSalesData[] = useMemo(() => {
    const salesMap: Map<string, { sales: number; quantity: number }> = new Map();
    const filters = globalSettings?.reportProductFilters || [];
  
    filteredOrdersByDate.forEach(order => {
      if (!order.orderItems) return;
  
      order.orderItems.forEach(item => {
        let productName = item.model;
        let quantity = item.quantity;
        let sales = item.isGift ? 0 : (item.lineItemTotalPrice || 0);
  
        if (productViewMode === 'category') {
          const matchingFilter = filters.find(filter =>
            productName.toLowerCase().includes(filter.toLowerCase())
          );
          if (matchingFilter) {
            productName = matchingFilter; // Use the keyword as the category name
          }
        }
  
        const existing = salesMap.get(productName) || { sales: 0, quantity: 0 };
        salesMap.set(productName, {
          sales: existing.sales + sales,
          quantity: existing.quantity + quantity,
        });
      });
    });
  
    const totalSales = Array.from(salesMap.values()).reduce((acc, { sales }) => acc + sales, 0);
    if (totalSales === 0) return [];
  
    return Array.from(salesMap.entries())
      .map(([product, data]) => ({
        product,
        sales: data.sales,
        quantity: data.quantity,
        percentage: (data.sales / totalSales) * 100,
      }))
      .sort((a, b) => b.sales - a.sales);
  }, [filteredOrdersByDate, productViewMode, globalSettings]);
  
  const crmSalesData: CrmSalesData[] = useMemo(() => {
    if (filteredOrdersByDate.length === 0 || allUsers.length === 0) {
      return [];
    }
  
    const salesByCrm: Record<string, { totalSales: number }> = {};
  
    filteredOrdersByDate.forEach(order => {
      if (order.crmUserId) {
        if (!salesByCrm[order.crmUserId]) {
          salesByCrm[order.crmUserId] = { totalSales: 0 };
        }
        const orderTotal = order.orderItems.reduce((sum, item) => sum + (item.isGift ? 0 : (item.lineItemTotalPrice || 0)), 0);
        salesByCrm[order.crmUserId].totalSales += orderTotal;
      }
    });
  
    const crmUsers = allUsers.filter(u => u.role === 'CR');
  
    return crmUsers
      .map(crm => ({
        crmId: crm.id,
        crmName: crm.name,
        avatarUrl: crm.avatarUrl,
        totalSales: salesByCrm[crm.id]?.totalSales || 0,
      }))
      .filter(data => data.totalSales > 0)
      .sort((a, b) => b.totalSales - a.totalSales);
  
  }, [filteredOrdersByDate, allUsers]);

  const dailySalesData = useMemo(() => {
    const salesByDayAndCrm: { [date: string]: { [crmName: string]: { salesCount: number; totalSale: number } } } = {};
  
    filteredOrdersByDate.forEach(order => {
      try {
        const dateKey = formatDateSafe(order.createdAt);
        if (!salesByDayAndCrm[dateKey]) {
          salesByDayAndCrm[dateKey] = {};
        }
        const crmName = order.crmUserName || 'Unknown CR';
        if (!salesByDayAndCrm[dateKey][crmName]) {
          salesByDayAndCrm[dateKey][crmName] = { salesCount: 0, totalSale: 0 };
        }
        salesByDayAndCrm[dateKey][crmName].salesCount += 1;
        salesByDayAndCrm[dateKey][crmName].totalSale += order.orderItems.reduce((sum, item) => sum + (item.isGift ? 0 : (item.lineItemTotalPrice || 0)), 0);
      } catch (e) {
        // ignore invalid dates
      }
    });
  
    const flattenedData = Object.entries(salesByDayAndCrm).flatMap(([date, crmSales]) => 
      Object.entries(crmSales).map(([crmName, data]) => ({
        date,
        crmName,
        salesCount: data.salesCount,
        totalSale: data.totalSale,
      }))
    );
  
    return flattenedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredOrdersByDate]);

  const selectedCrmName = useMemo(() => {
    if (selectedCrmId === 'all') return 'All CRMs';
    return allCrmUsers.find(u => u.id === selectedCrmId)?.name || "Select CR";
  }, [selectedCrmId, allCrmUsers]);
  
  const filteredCrmUsersForDropdown = useMemo(() => {
    const allCrmsOption = { id: 'all', name: 'All CRMs', role: 'SYSTEM_ADMIN' as const, email: '' };
    const baseUsers = [allCrmsOption, ...allCrmUsers];
    if (!crmSearchQuery) return baseUsers;
    return baseUsers.filter(user =>
      user.name.toLowerCase().includes(crmSearchQuery.toLowerCase())
    );
  }, [allCrmUsers, crmSearchQuery]);

  return (
    <>
      <div className="space-y-6 p-1 sm:p-0">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h1 className="page-title text-2xl sm:text-3xl">Reports & Analytics</h1>
              <p className="page-description text-sm mt-0.5">Overview of company performance, sales, and operations</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
                {isAdmin && (
                  <>
                    <Select
                      value={selectedDept}
                      onValueChange={(v) => {
                        setSelectedDept(v as UserRole | 'ALL');
                        setSelectedUserId('all'); // users belong to a department: reset when it changes
                        setSelectedCrmId('all');
                      }}
                    >
                      <SelectTrigger className="h-10 w-[190px] bg-card" aria-label="Select department">
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL" className="pl-2 [&>span:first-child]:hidden">
                          <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />All Departments</span>
                        </SelectItem>
                        {ROLE_FILTERS.map(({ role, singular, icon: Icon }) => (
                          <SelectItem key={role} value={role} className="pl-2 [&>span:first-child]:hidden">
                            <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" aria-hidden />{singular}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <UserSelect
                      users={selectedDept === 'CR' ? salesExecutiveUsers : allUsers.filter((u) => selectedDept !== 'ALL' && u.role === selectedDept)}
                      value={selectedUserId}
                      disabled={!selectedDept || selectedDept === 'ALL'}
                      onChange={(user) => {
                        setSelectedUserId(user ? user.id : 'all');
                        setSelectedCrmId(user && selectedDept === 'CR' ? user.id : 'all');
                      }}
                    />
                  </>
                )}
                <DateRangePicker3 
                    initialRange={selectedDateRange} 
                    onDateRangeChange={handleDateRangeChange}
                    className="h-10"
                />
              </div>
          </div>
        </Tabs>
        {isAdmin && selectedDept === 'ALL' && currentUser && (
          <CompanySummary viewerRole={currentUser.role} dateRange={selectedDateRange} />
        )}
        {isAdmin && selectedDept === 'ADMIN' && (
          <>
            <OperationManagerCards orders={orders} userId={selectedUserId} dateRange={selectedDateRange} isLoading={isLoading} />
            <OperationManagerDetails orders={orders} users={allUsers} userId={selectedUserId} dateRange={selectedDateRange} isLoading={isLoading} />
          </>
        )}
        {isAdmin && selectedDept === 'SW' && (
          <ScriptWriterReport orders={orders} users={allUsers} userId={selectedUserId} dateRange={selectedDateRange} isLoading={isLoading} />
        )}
        {isAdmin && selectedDept === 'CG' && (
          <CinematographerReport orders={orders} users={allUsers} userId={selectedUserId} dateRange={selectedDateRange} isLoading={isLoading} />
        )}
        {isAdmin && selectedDept === 'EDITOR' && (
          <EditorReport orders={orders} users={allUsers} userId={selectedUserId} dateRange={selectedDateRange} isLoading={isLoading} />
        )}
        {isAdmin && selectedDept === 'CR' && (
          <>
            <SalesExecutiveCards orders={orders} users={allUsers} settings={globalSettings} userId={selectedUserId} dateRange={selectedDateRange} isLoading={isLoading} />
            <SalesExecutiveCharts orders={orders} users={allUsers} settings={globalSettings} userId={selectedUserId} dateRange={selectedDateRange} isLoading={isLoading} />
            <DueAmountReport invoices={crSummary.outstandingInvoices} isLoading={isLoading} />
            <ExecutivePerformance orders={orders} users={allUsers} settings={globalSettings} userId={selectedUserId} dateRange={selectedDateRange} isLoading={isLoading} />
          </>
        )}
      </div>

      {isAdmin && (
        <ReportFilterSettingsDialog
          isOpen={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          initialFilters={globalSettings?.reportProductFilters || []}
          onSave={handleSaveFilters}
        />
      )}

      {taskToEdit && currentUser && (
        <AddEditTaskDialog
            isOpen={isAddEditTaskOpen}
            onOpenChange={setIsAddEditTaskOpen}
            onTaskSaved={handleTaskSaved}
            task={taskToEdit}
            currentUser={currentUser}
        />
      )}
      
      {taskToDelete && (
        <DeleteTaskDialog
            isOpen={!!taskToDelete}
            onOpenChange={() => setTaskToDelete(null)}
            onConfirmDelete={handleConfirmDeleteTask}
            task={taskToDelete}
            isDeleting={isDeletingTask}
        />
      )}
    </>
  );
}
