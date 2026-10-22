
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import type { Transaction, User, TransactionType, GlobalSettings, PersonalNote, UserRole } from "@/types";
import { getUsers } from '@/lib/user-service';
import { getGlobalSettings } from '@/lib/settings-service';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, ArrowDownCircle, ArrowUpCircle, Wallet, AlertTriangle, Calculator, NotebookPen, Loader2, Minus, Send, Edit2, Trash2, X, Construction, Search, Filter, CalendarDays as CalendarIcon, User as UserIcon, ChevronsUpDown, PieChart, Landmark, ChevronDown, TrendingUp, TrendingDown, ShoppingBag, SendHorizonal, Banknote, Briefcase, Megaphone, Braces, Paperclip, MoreVertical, ImagePlus, Utensils, Car, Lightbulb, Clipboard as ClipboardIcon, Home, Check, Settings2 } from 'lucide-react';
import * as Lucide from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  addTransactionAction,
  deleteTransactionAction,
  updateTransactionAction,
  getTransactionsForUserAction,
  getAllTransactionsAction,
  updateTransactionCategoriesAction,
} from './actions';
import { DateRangePicker3, type PredefinedRange } from '@/components/dashboard/date-range-picker3';
import type { DateRange } from "react-day-picker";
import { isWithinInterval, parseISO, subDays, format } from "date-fns";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Pie,
  PieChart as RechartsPieChart,
  Cell,
  Label as RechartsLabel,
} from "recharts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import NextLink from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { motion } from 'framer-motion';
import { getFinanceColorClasses } from '@/lib/finance-colors';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const AddTransactionDialog = dynamic(() => import('@/components/finance-manager/add-transaction-dialog').then(mod => mod.AddTransactionDialog));
const EditTransactionDialog = dynamic(() => import('@/components/finance-manager/edit-transaction-dialog').then(mod => mod.EditTransactionDialog));
const ManageCategoriesDialog = dynamic(() => import('@/components/finance-manager/manage-categories-dialog').then(mod => mod.ManageCategoriesDialog));

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(value);
};

const TRANSACTION_TYPES_FOR_FILTER: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Transactions' },
  { value: 'income', label: 'Income' },
  { value: 'expense_only', label: 'Expenses' },
  { value: 'purchase', label: 'Purchases' },
];

const COLORS = [
  "#2563eb", // blue-600
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ec4899", // pink-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#f43f5e", // rose-500
  "#6366f1", // indigo-500
  "#14b8a6", // teal-500
  "#f97316", // blue-500
  "#84cc16", // lime-500
  "#a855f7", // purple-500
];

const getIconComponent = (iconName: string) => {
  return (Lucide as any)[iconName] || Lucide.HelpCircle;
};


export default function FinanceManagerPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allUsersForFilter, setAllUsersForFilter] = useState<User[]>([]);
  const [selectedUserIdFilter, setSelectedUserIdFilter] = useState<string>('all');
  const [isUserFilterPopoverOpen, setIsUserFilterPopoverOpen] = useState(false);

  const [globalAppSettings, setGlobalAppSettings] = useState<GlobalSettings | null>(null);
  const [transactionSearchTerm, setTransactionSearchTerm] = useState('');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('all');

  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(() => ({
    from: subDays(new Date(), 29),
    to: new Date(),
  }));

  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [isEditDialogVisible, setIsEditDialogVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [isCategoryManageOpen, setIsCategoryManageOpen] = useState(false);
  const [previewDocumentUrl, setPreviewDocumentUrl] = useState<string | null>(null);

  const expenseCategories = useMemo(() => {
    return globalAppSettings?.transactionCategories || [];
  }, [globalAppSettings]);

  const getCategoryDetails = useCallback((category: string) => {
    const matchedCategory = expenseCategories.find(c => c.value === category);
    const colorClasses = getFinanceColorClasses(matchedCategory?.colorClass);
    return {
      icon: matchedCategory ? getIconComponent(matchedCategory.icon) : Lucide.TrendingDown,
      colorClass: colorClasses.text,
      bgLightClass: colorClasses.bgLight
    };
  }, [expenseCategories]);
  



  const fetchFinancialData = useCallback(async (isBackgroundRefresh = false) => {
    if (!currentUser) return;
    if (!isBackgroundRefresh) {
      setIsLoading(true);
    }
    try {
      let fetchedTransactions: Transaction[];
      let fetchedUsers: User[] = [];

      const settings = await getGlobalSettings();
      setGlobalAppSettings(settings);

      const dataPromises: any[] = [];
      if (currentUser.role === 'SYSTEM_ADMIN') {
        dataPromises.push(getAllTransactionsAction(), getUsers());
      } else {
        dataPromises.push(getTransactionsForUserAction(currentUser.id));
      }

      const results = await Promise.all(dataPromises);
      fetchedTransactions = results[0] as Transaction[];

      if (currentUser.role === 'SYSTEM_ADMIN') {
        fetchedUsers = results[1] as User[];
        const newUserMap = new Map(fetchedUsers.map(user => [user.id, user.name]));
        setUserMap(newUserMap);

        const perms = settings.expenseLoggingPermissions || { mode: 'none' };
        const permittedUsers = fetchedUsers.filter(u => {
          if (u.id === currentUser.id) return true;
          if (u.role === 'SYSTEM_ADMIN') return true;
          switch (perms.mode) {
            case 'all': return true;
            case 'specificRoles': return perms.allowedRoles?.includes(u.role);
            case 'specificUsers': return perms.allowedUserIds?.includes(u.id);
            case 'none': return false;
            default: return false;
          }
        });
        setAllUsersForFilter(permittedUsers);
        setAllUsers(fetchedUsers);
      } else {
        setUserMap(new Map([[currentUser.id, currentUser.name]])); // Add self to map for personal view
        setAllUsersForFilter([]);
        setAllUsers([]);
      }

      setTransactions(fetchedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error("Failed to fetch financial data, users, or settings:", error);
      toast({ title: "Error", description: "Could not load page data. Please try again.", variant: "destructive" });
      setTransactions([]);
      setUserMap(new Map());
      setAllUsersForFilter([]);
      setAllUsers([]);
      setGlobalAppSettings(null);
    } finally {
      if (!isBackgroundRefresh) {
        setIsLoading(false);
      }
    }
  }, [currentUser, toast]);

  useEffect(() => {
    if (currentUser) {
      fetchFinancialData(false); // Initial fetch with loading state

      const intervalId = setInterval(() => {
        fetchFinancialData(true); // Background refresh without loading state
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(intervalId); // Cleanup on unmount
    }
  }, [currentUser, fetchFinancialData]);


  const handleDeleteRequest = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
    setIsDeleteAlertOpen(true);
  };

  const confirmDeleteTransaction = async () => {
    if (!transactionToDelete || !currentUser) return;
    setIsDeleting(true);
    const result = await deleteTransactionAction(transactionToDelete.id, currentUser.id, currentUser.role);
    setIsDeleting(false);
    setIsDeleteAlertOpen(false);
    if (result.success) {
      toast({ title: "Transaction Deleted", description: "The transaction has been removed." });
      fetchFinancialData();
    } else {
      toast({ title: "Deletion Failed", description: result.error || "Could not delete transaction.", variant: "destructive" });
    }
    setTransactionToDelete(null);
  };

  const handleOpenEditDialog = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
    setIsEditDialogVisible(true);
  };

  const handleTransactionUpdated = () => {
    setIsEditDialogVisible(false);
    setTransactionToEdit(null);
    fetchFinancialData();
    toast({ title: "Transaction Updated", description: "The transaction has been successfully updated." })
  };


  const filteredTransactions = useMemo(() => {
    let results = transactions;

    // For System Admin, default to global view unless a specific user is filtered.
    // For other roles, it's always their personal view.
    if (currentUser?.role === 'SYSTEM_ADMIN') {
      if (selectedUserIdFilter !== 'all') {
        results = results.filter(t => t.userId === selectedUserIdFilter);
      }
    } else if (currentUser) {
      results = results.filter(t => t.userId === currentUser.id);
    }

    if (selectedDateRange?.from) {
      const startDate = new Date(selectedDateRange.from);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(selectedDateRange.to ?? selectedDateRange.from);
      endDate.setHours(23, 59, 59, 999);

      results = results.filter(t => {
        try {
          const transactionDate = new Date(t.date);
          if (isNaN(transactionDate.getTime())) return false;
          return isWithinInterval(transactionDate, { start: startDate, end: endDate });
        } catch (e) {
          console.error("Error parsing transaction date for filtering:", t.date, e);
          return false;
        }
      });
    }

    if (transactionTypeFilter !== 'all') {
      results = results.filter(t => {
        if (transactionTypeFilter === 'income') return t.type === 'income';
        if (transactionTypeFilter === 'expense_only') return t.type === 'expense';
        if (transactionTypeFilter === 'purchase') return t.type === 'purchase';
        return true;
      });
    }



    if (transactionSearchTerm.trim()) {
      const lowerSearchTerm = transactionSearchTerm.toLowerCase();
      results = results.filter(t => {
        const userName = userMap.get(t.userId)?.toLowerCase() || '';
        const matchesSearch = (
          t.category.toLowerCase().includes(lowerSearchTerm) ||
          (t.description && t.description.toLowerCase().includes(lowerSearchTerm)) ||
          t.amount.toString().includes(lowerSearchTerm) ||
          (userName && userName.includes(lowerSearchTerm)) ||
          t.type.toLowerCase().includes(lowerSearchTerm) ||
          (t.sentToUserName && t.sentToUserName.toLowerCase().includes(lowerSearchTerm)) ||
          (t.receivedFromUserName && t.receivedFromUserName.toLowerCase().includes(lowerSearchTerm))
        );
        return matchesSearch;
      });
    }
    return results;
  }, [transactions, transactionSearchTerm, userMap, transactionTypeFilter, selectedDateRange, selectedUserIdFilter, currentUser]);

  const { totalIncome, totalExpenses, availableBalance, expenseChartData } = useMemo(() => {
    let income = 0;
    let expensesSum = 0;
    const categoryTotals: Record<string, number> = {};

    filteredTransactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') {
        income += amt;
      } else if (t.type === 'expense' || t.type === 'purchase') {
        expensesSum += amt;
        const categoryKey = t.category || "Uncategorized";
        categoryTotals[categoryKey] = (categoryTotals[categoryKey] || 0) + amt;
      }
    });

    const chartData = Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value, fill: 'var(--color-expenses)' })) // All expenses are one color initially
      .sort((a, b) => b.value - a.value);

    return {
      totalIncome: income,
      totalExpenses: expensesSum,
      availableBalance: income - expensesSum,
      expenseChartData: chartData,
    };
  }, [filteredTransactions]);

  const expenseChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    expenseChartData.forEach((item, index) => {
      const uniqueKey = item.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      config[uniqueKey] = {
        label: item.name,
        color: COLORS[index % COLORS.length],
      };
    });
    // Add a total entry for the center label
    config.total = {
      label: "Total Expenses",
    };
    return config;
  }, [expenseChartData]);

  const canUserAddExpense = useMemo(() => {
    if (!currentUser || !globalAppSettings?.expenseLoggingPermissions) return false;
    if (currentUser.role === 'SYSTEM_ADMIN') return true;

    const perms = globalAppSettings.expenseLoggingPermissions;
    switch (perms.mode) {
      case 'all': return true;
      case 'none': return false;
      case 'specificRoles': return perms.allowedRoles.includes(currentUser.role);
      case 'specificUsers': return perms.allowedUserIds.includes(currentUser.id);
      default: return false;
    }
  }, [currentUser, globalAppSettings]);

  const summaryCardsToDisplay = useMemo(() => {
    return [
      { title: "Total Income", value: totalIncome, icon: ArrowUpCircle, iconColorClass: "text-green-600", circleBgClass: "bg-green-100 dark:bg-green-700/20", hint: "green money" },
      { title: "Total Expenses", value: totalExpenses, icon: ArrowDownCircle, iconColorClass: "text-red-600", circleBgClass: "bg-red-100 dark:bg-red-700/20", hint: "red money" },
      {
        title: "Available Balance",
        value: availableBalance,
        icon: Wallet,
        iconColorClass: availableBalance >= 0 ? "text-blue-600" : "text-red-600",
        circleBgClass: availableBalance >= 0 ? "bg-blue-100 dark:bg-blue-700/20" : "bg-red-100 dark:bg-red-700/20",
        hint: "wallet coins"
      },
    ].filter(card => {
      if (currentUser?.role === 'SYSTEM_ADMIN') return true;
      if (card.title.toLowerCase().includes("expense") && !canUserAddExpense) return false;
      return true;
    });
  }, [totalIncome, totalExpenses, availableBalance, canUserAddExpense, currentUser]);

  const handleDateRangeChange = (
    range: DateRange | undefined,
    label: string,
    predefined: PredefinedRange | "custom" | null
  ) => {
    setSelectedDateRange(range);
  };


  if (!currentUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const isLoadingContent = isLoading || !selectedDateRange;

  const selectedUserNameForFilter = useMemo(() => {
    if (selectedUserIdFilter === 'all') return 'All Users';
    return allUsersForFilter.find(u => u.id === selectedUserIdFilter)?.name || 'Select User';
  }, [selectedUserIdFilter, allUsersForFilter]);

  const getAmountColor = (t: Transaction) => {
    if (t.type === 'income') return "text-green-600";
    if (t.type === 'expense') return "text-red-600";
    return "text-sky-600";
  }

  const getInitials = (name: string | undefined): string => {
    if (!name) return '??';
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return names[0].charAt(0).toUpperCase() + (names.length > 1 ? names[names.length - 1].charAt(0).toUpperCase() : '');
  };

  return (
    <div className="flex flex-col gap-4 min-h-[calc(100vh-140px)]">
      <div className="flex flex-col sm:flex-row gap-3 items-center pt-1 pb-2 [&_button]:shadow-md [&_input]:shadow-md">
        {currentUser.role === 'SYSTEM_ADMIN' && (
          <Popover open={isUserFilterPopoverOpen} onOpenChange={setIsUserFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto order-2 sm:order-none flex-shrink-0 h-10">
                <UserIcon className="mr-2 h-4 w-4 text-primary" />
                <span className="truncate">{selectedUserNameForFilter}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] max-h-80 overflow-y-auto p-0">
              <Command>
                <CommandInput
                  placeholder="Search user..."
                  value={userSearchQuery}
                  onValueChange={setUserSearchQuery}
                />
                <CommandList>
                  <CommandEmpty>No user found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem onSelect={() => { setSelectedUserIdFilter('all'); setIsUserFilterPopoverOpen(false); }}>
                      <Check className={cn("mr-2 h-4 w-4", selectedUserIdFilter === 'all' ? "opacity-100" : "opacity-0")} />
                      All Users
                    </CommandItem>
                    {allUsersForFilter.map((user) => (
                      <CommandItem key={user.id} onSelect={() => { setSelectedUserIdFilter(user.id); setIsUserFilterPopoverOpen(false); }}>
                        <Check className={cn("mr-2 h-4 w-4", selectedUserIdFilter === user.id ? "opacity-100" : "opacity-0")} />
                        {user.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
        <div className="w-full sm:w-auto grow sm:grow-0 order-3 sm:order-none sm:min-w-[200px] md:min-w-[240px]">
          <Label htmlFor="transaction-type-filter" className="sr-only">Filter by type</Label>
          <Select value={transactionTypeFilter} onValueChange={setTransactionTypeFilter}>
            <SelectTrigger id="transaction-type-filter" className="w-full h-10 bg-card border-zinc-300 shadow-md transition-all focus:ring-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <SelectValue placeholder="Filter by type" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {TRANSACTION_TYPES_FOR_FILTER.map((filterType) => (
                <SelectItem key={filterType.value} value={filterType.value}>
                  {filterType.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-auto grow sm:grow-0 order-4 sm:order-none">
          {isClient ? (
            <DateRangePicker3
              initialRange={selectedDateRange}
              onDateRangeChange={handleDateRangeChange}
              compactOnMobile={true}
              className="h-10"
            />
          ) : (
            <Skeleton className="h-10 w-full sm:w-[260px]" />
          )}
        </div>
        <div className="relative w-full sm:w-auto grow sm:flex-1 order-5 sm:order-none sm:max-w-md sm:ml-auto flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
            <Input
              type="search"
              placeholder="Search transactions..."
              value={transactionSearchTerm}
              onChange={(e) => setTransactionSearchTerm(e.target.value)}
              className="pl-10 bg-card h-10 shadow-md border-zinc-300 transition-all focus:ring-2"
            />
          </div>
          {currentUser.role === 'SYSTEM_ADMIN' && (
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setIsCategoryManageOpen(true)} title="Manage Categories">
              <Settings2 className="h-4 w-4 text-primary" />
            </Button>
          )}
        </div>
      </div>


      {/* Summary grid removed to unify in Financial Overview card */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-stretch">
        <Card className="shadow-xl border bg-card rounded-xl flex flex-col lg:col-span-2 overflow-hidden">
          <CardHeader className="border-b p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-card-foreground text-xl">Recent Transactions</CardTitle>
                <CardDescription className="text-muted-foreground text-sm mt-0.5">
                  {currentUser.role === 'SYSTEM_ADMIN' && selectedUserIdFilter === 'all' ? "Latest transactions from all users." :
                    currentUser.role === 'SYSTEM_ADMIN' && selectedUserIdFilter !== 'all' ? `Latest transactions for selected user.` :
                      "Your latest income, expense and purchase entries."}
                  {transactionTypeFilter !== 'all' && ` (Filtered by: ${TRANSACTION_TYPES_FOR_FILTER.find(f => f.value === transactionTypeFilter)?.label})`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
                {canUserAddExpense && (
                  <AddTransactionDialog 
                    currentUser={currentUser} 
                    onTransactionAdded={fetchFinancialData} 
                    dialogMode="addExpenseOrPurchase"
                    categories={expenseCategories}
                  >
                    <Button size="sm">
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Expenses
                    </Button>
                  </AddTransactionDialog>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 relative overflow-hidden">
            <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                  <TableRow>
                    <TableHead className="pl-6">Transaction</TableHead>
                    {currentUser.role === 'SYSTEM_ADMIN' && <TableHead>Recorded By</TableHead>}
                    <TableHead>Date</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="pr-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingContent ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={`skel-${i}`}>
                        <TableCell colSpan={currentUser.role === 'SYSTEM_ADMIN' ? 6 : 5} className="p-0">
                          <Skeleton className="h-16 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredTransactions.length > 0 ? (
                    filteredTransactions.map(t => {
                      const user = currentUser.role === 'SYSTEM_ADMIN' ? allUsers.find(u => u.id === t.userId) : null;
                      const { icon: IconComponent, colorClass, bgLightClass } = getCategoryDetails(t.category);
                      return (
                        <TableRow key={t.id} className="hover:bg-muted/30">
                          <TableCell className="pl-6">
                            <motion.div
                              className="flex items-center space-x-3"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <motion.div
                                whileHover={{ scale: 1.1, rotate: -5 }}
                                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                className={cn(
                                  "p-2 rounded-full transition-transform",
                                  bgLightClass,
                                  "dark:bg-opacity-20"
                                )}
                              >
                                <IconComponent className={cn("h-5 w-5", colorClass)} />
                              </motion.div>
                              <div className="min-w-0">
                                <p className="font-semibold truncate" title={t.category}>{t.category}</p>
                                <p className="text-xs text-muted-foreground truncate" title={t.description || undefined}>{t.description || 'No description'}</p>
                              </div>
                            </motion.div>
                          </TableCell>
                          {currentUser.role === 'SYSTEM_ADMIN' && (
                            <TableCell>
                              {user ? (
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-7 w-7 border">
                                    <AvatarImage src={user.avatarUrl || undefined} alt={user.name} />
                                    <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs text-muted-foreground">{user.name}</span>
                                </div>
                              ) : (<span className="text-xs text-muted-foreground italic">Unknown User</span>)}
                            </TableCell>
                          )}
                          <TableCell className="text-xs text-muted-foreground">{format(parseISO(t.date), "d MMM, yyyy")}</TableCell>
                          <TableCell>
                            {t.documentUrl ? (
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => setPreviewDocumentUrl(t.documentUrl || null)}
                                title="View Document"
                              >
                                <Paperclip className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground/60">-</span>
                            )}
                          </TableCell>
                                                     <TableCell className="text-right">
                             <Badge variant="outline" className={cn(
                               "px-2 py-0.5 border-0 font-bold font-mono min-w-[100px] justify-center",
                               t.type === 'income' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" :
                               (t.type === 'expense' && t.category.startsWith('Sent Money')) ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" :
                               "bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400"
                             )}>
                               {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                             </Badge>
                           </TableCell>
                          <TableCell className="pr-6 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => handleOpenEditDialog(t)} disabled={isSubmitting || (t.type === 'income' && !!t.receivedFromUserId) || (t.type === 'expense' && !!t.sentToUserId && currentUser.id !== t.userId)} className="cursor-pointer">
                                  <Edit2 className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleDeleteRequest(t)} className="cursor-pointer text-destructive focus:text-destructive" disabled={isDeleting}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow key="no-transactions">
                      <TableCell colSpan={currentUser.role === 'SYSTEM_ADMIN' ? 6 : 5} className="h-48 text-center text-muted-foreground">
                        <Banknote className="h-16 w-16 mx-auto opacity-30 mb-3" />
                        <p className="text-lg font-medium">No transactions found.</p>
                        <p className="text-sm">Try adjusting your filters.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col h-full">
          <Card className="shadow-xl border bg-card rounded-xl overflow-hidden flex flex-col h-full">
            <CardHeader className="border-b pb-4 bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                Financial Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Stats Section */}
              <div className="grid grid-cols-1 divide-y divide-border/40">
                {summaryCardsToDisplay.map((card) => (
                  <div key={card.title} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", card.circleBgClass)}>
                        <card.icon className={cn("h-4 w-4", card.iconColorClass)} />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">{card.title}</span>
                    </div>
                    {isLoadingContent ? (
                       <Skeleton className="h-5 w-24" />
                    ) : (
                      <Badge variant="outline" className={cn(
                        "font-mono font-bold text-sm border-0 px-3 py-1",
                        card.title === 'Total Income' && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                        card.title.includes('Expenses') && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                        card.title === 'Available Balance' && (
                          (availableBalance as number) >= 0 
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        )
                      )}>
                        {formatCurrency(card.value as number)}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>

              {/* Chart Section */}
              <div className="p-6 pt-2">
                <div className="flex flex-col items-center justify-center min-h-[220px]">
                  {isLoadingContent || !isClient ? (
                    <Skeleton className="h-40 w-40 rounded-full" />
                  ) : expenseChartData.length > 0 ? (
                    <ChartContainer config={expenseChartConfig} className="mx-auto aspect-square w-full max-w-[220px]">
                      <RechartsPieChart>
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent hideLabel />}
                        />
                        <Pie
                          data={expenseChartData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={72}
                          outerRadius={88}
                          paddingAngle={4}
                          cornerRadius={8}
                          strokeWidth={0}
                        >
                          <RechartsLabel
                            content={({ viewBox }) => {
                              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                return (
                                  <text
                                    x={viewBox.cx}
                                    y={viewBox.cy}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                  >
                                    <tspan
                                      x={viewBox.cx}
                                      y={(viewBox.cy || 0) - 10}
                                      className="fill-foreground text-xl font-bold font-mono tracking-tight"
                                    >
                                      {formatCurrency(totalExpenses).replace('BDT', '৳')}
                                    </tspan>
                                    <tspan
                                      x={viewBox.cx}
                                      y={(viewBox.cy || 0) + 14}
                                      className="fill-muted-foreground text-[10px] uppercase tracking-widest font-semibold"
                                    >
                                      Expenses
                                    </tspan>
                                  </text>
                                )
                              }
                            }}
                            position="center"
                          />
                          {expenseChartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={expenseChartConfig[entry.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()]?.color || COLORS[index % COLORS.length]}
                              className="focus:outline-none"
                            />
                          ))}
                        </Pie>
                      </RechartsPieChart>
                    </ChartContainer>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <p className="text-sm">No expense data available.</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {isDeleteAlertOpen && transactionToDelete && (
        <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive" /> Are you sure?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action will permanently delete the transaction for "<span className="font-semibold">{transactionToDelete.category}</span>" of {formatCurrency(transactionToDelete.amount)}.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsDeleteAlertOpen(false)} disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteTransaction}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                disabled={isDeleting}
              >
                {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</> : "Yes, delete it"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {isEditDialogVisible && transactionToEdit && currentUser && (
        <EditTransactionDialog
          isOpen={isEditDialogVisible}
          onOpenChange={setIsEditDialogVisible}
          transaction={transactionToEdit}
          currentUser={currentUser}
          onTransactionUpdated={handleTransactionUpdated}
          categories={expenseCategories}
        />
      )}
      <ManageCategoriesDialog
        isOpen={isCategoryManageOpen}
        onClose={() => setIsCategoryManageOpen(false)}
        categories={expenseCategories}
        onCategoriesUpdated={fetchFinancialData}
      />

      {previewDocumentUrl && (
        <Dialog open={!!previewDocumentUrl} onOpenChange={(open) => { if (!open) setPreviewDocumentUrl(null); }}>
          <DialogContent className="w-fit max-w-[95vw] p-0 overflow-hidden bg-transparent border-none shadow-none" hideCloseButton={true}>
            <DialogTitle className="sr-only">Document Preview</DialogTitle>
            <DialogDescription className="sr-only">Preview of transaction document attachment</DialogDescription>
            <div className="relative flex items-center justify-center bg-transparent">
              {previewDocumentUrl.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)/) ? (
                <img 
                  src={previewDocumentUrl} 
                  alt="Document Preview" 
                  className="max-h-[80vh] max-w-[90vw] object-contain animate-in fade-in-50 duration-200"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== '/placeholder.svg' && !target.src.endsWith('/placeholder.svg')) {
                      target.src = '/placeholder.svg';
                    }
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground p-12 min-h-[300px] bg-background rounded-lg border shadow-lg w-[400px] max-w-full">
                  <Paperclip className="h-16 w-16 mb-4 opacity-50" />
                  <p className="mb-4">This file cannot be previewed directly.</p>
                  <Button asChild>
                    <a href={previewDocumentUrl} target="_blank" rel="noopener noreferrer">
                      Download File
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}








