

"use client";

import { DonutChart } from '@/components/dashboard/DonutChart';
import { TodayScheduleCard } from '@/components/dashboard/TodayScheduleCard';
import { TimeTrackerCard } from '@/components/dashboard/TimeTrackerCard';
import { ScriptAssignmentChart } from '@/components/dashboard/ScriptAssignmentChart';
import { vatAmountFor } from '@/lib/vat';
import { PROJECT_STAGES } from '@/lib/project-stages';
import { getScriptWriterSummary } from '@/lib/script-writer-summary';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/auth-context';
import { useSocket } from '@/contexts/socket-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { format, isWithinInterval, parseISO, subDays, getHours, getYear, getMonth, startOfMonth, endOfMonth, differenceInDays, startOfYear, endOfYear, startOfDay, endOfDay, getDaysInMonth, isSameDay, addDays, subMonths, isValid } from "date-fns";
import {
  Hand,
  ShoppingCart,
  BadgeDollarSign,
  FileText,
  Undo2,
  Download,
  AlertTriangle,
  BadgePercent,
  Receipt,
  BarChartBig,
  Users,
  CalendarDays,
  ChevronDown,
  Loader2,
  Briefcase,
  ClipboardCheck,
  ClipboardX,
  DraftingCompass,
  PauseCircle,
  Truck,
  Handshake,
  CheckCircle,
  PackageCheck,
  PieChart as PieChartIcon,
  User as UserIcon,
  BaggageClaim,
  Landmark, // For Payment Methods
  MessageSquare, // For Feedback
  Star, // For Feedback stars
  Trash2, // For delete icon
  ClipboardList,
  TrendingUp, // For Assets icon
  LineChart as LineChartIcon,
  Gift,
  Clock,
  ChevronRight,
  Phone,
  ShieldCheck,
  UserCog,
  PenLine,
  FileCheck,
  UserCheck,
  Camera,
  Sparkles,
  Clapperboard,
  RefreshCcw,
  CheckCircle2,
  Wallet, XCircle, CalendarClock } from 'lucide-react';
import Link from 'next/link';
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend as RechartsLegend,
  Pie,
  PieChart as RechartsPieChart,
  Cell,
  Bar,
  BarChart as RechartsBarChart,
  LabelList,
  Label as RechartsLabel,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import type { TrackingLink, OrderItem, ServiceModelItem, User, Project, ProjectStatusType, GlobalSettings, Lead, LeadCategory, UserRole, Feedback } from '@/types';
import { getOrders } from '@/lib/order-service';
import { getModels, getPaymentMethods } from '@/lib/service-options-service';
import { useToast } from '@/hooks/use-toast';
import { getUsers } from '@/lib/user-service';
import { getProjects } from '@/lib/project-service';
import { getLeads } from '@/lib/lead-service';
import { getMeetings } from '@/lib/meeting-service';
import { getQuotations } from '@/lib/quotation-service';
import type { Meeting } from '@/types';
import { getFeedback, deleteFeedbackAction } from '@/lib/feedback-service'; // Import getFeedback and deleteFeedbackAction
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"; // Added AlertDialog
import { getGlobalSettings } from '@/lib/settings-service';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatDisplayName } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { divisions } from '@/lib/district-data'; // Import divisions data
import type { DateRange, PredefinedRange } from "@/components/dashboard/date-range-picker";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getTaskEntries, type TaskEntry, getMonthlyTargetHistory, setMonthlyTargetHistory } from '@/lib/team-performance-service'; // Import new service
import { getDr2oEntries } from '@/lib/dr2o-service';
import { CANCELLED_STATUS_ID } from '@/lib/status-constants'; // Import CANCELLED_STATUS_ID
import { LEAD_CATEGORY_LABELS } from '@/lib/pipeline-constants';
import { getAllTransactionsAction } from '@/app/(app)/expenses/actions';
import { isDrRole, DR_ROLES, roleInTeam, isAssignedTo } from '@/lib/roles';


// Lazy loading components
const DateRangePicker = dynamic(() => import('@/components/dashboard/date-range-picker').then(mod => mod.DateRangePicker), {
  ssr: false,
  loading: () => <Skeleton className="h-10 w-full sm:w-[260px]" />
});

const SalesPerformanceClient = dynamic(() => import('@/components/leaderboard/SalesPerformanceClient').then(mod => mod.SalesPerformanceClient), {
  ssr: false,
  loading: () => <Skeleton className="h-[400px] w-full" />
});

const OrderAnalysisClient = dynamic(() => import('@/components/dashboard/OrderAnalysisClient').then(mod => mod.OrderAnalysisClient), {
  ssr: false,
  loading: () => <Skeleton className="h-[400px] w-full" />
});

const StatusTimeline = dynamic(() => import('./StatusTimeline').then(mod => mod.StatusTimeline), {
  ssr: false,
  loading: () => <Skeleton className="h-24 w-full" />
});

const chartConfig = {
  sales: {
    label: "Total Sales (BDT)",
    color: "hsl(var(--chart-1))",
  },
  orders: { // Added for CR view
    label: "Sales",
    color: "hsl(var(--chart-1))",
  },
  expenses: {
    label: "Expenses",
    color: "hsl(var(--destructive))",
  },
} satisfies ChartConfig;

// brand colours for the lead sources
const TRAFFIC_SOURCE_COLORS: Record<string, string> = {
  Facebook: '#1877F2',
  WhatsApp: '#25D366',
  'Office Visit': '#7B4BB7',
  'Phone Call': '#F59E0B',
  Others: '#94A3B8',
};

const trafficSourcesChartConfig = {
  "Facebook": { label: "Facebook", color: "hsl(var(--chart-3))" },
  "WhatsApp": { label: "WhatsApp", color: "hsl(var(--chart-2))" },
  "Office Visit": { label: "Office Visit", color: "hsl(var(--chart-5))" },
  "Phone Call": { label: "Phone Call", color: "hsl(var(--chart-1))" },
  "Others": { label: "Others", color: "hsl(var(--muted-foreground))" },
} satisfies ChartConfig;

const paymentMethodsChartConfig: ChartConfig = {
  count: {
    label: "Count",
    color: "hsl(var(--chart-2))",
  },
};


const formatCurrency = (value: number): string => {
  const numberPart = value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `৳${numberPart}`;
};

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  iconColorClass?: string;
  circleBgClass?: string;
  isLoading?: boolean;
  currentUser: User | null;
  hideValue?: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon: Icon, iconColorClass = "text-primary", circleBgClass = "bg-primary/10", isLoading, currentUser, hideValue }) => {
  if (isLoading) {
    return (
      <Card className="bg-card p-4 shadow-sm sm:shadow-md rounded-2xl sm:rounded-lg border-none sm:border min-h-[100px] flex flex-col justify-center">
        <div className="flex sm:flex-row flex-col items-center sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 text-center sm:text-left">
          <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-full" />
          <div className="space-y-1.5 flex-1 w-full">
            <Skeleton className="h-3 w-16 sm:h-4 sm:w-24 mx-auto sm:mx-0" />
            <Skeleton className="h-5 w-24 sm:h-7 sm:w-32 mx-auto sm:mx-0" />
          </div>
        </div>
      </Card>
    );
  }
  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg active:scale-95 sm:active:scale-100 bg-card p-2.5 sm:p-4 rounded-2xl sm:rounded-lg border-none sm:border shadow-sm sm:shadow-md">
      {/* Premium background highlight for mobile */}
      <div className={cn("absolute inset-0 opacity-[0.03] sm:hidden bg-gradient-to-br transition-opacity group-active:opacity-[0.06]", circleBgClass)} />

      <div className="flex sm:flex-row flex-col items-center sm:items-center space-y-2.5 sm:space-y-0 sm:space-x-4 text-center sm:text-left relative z-10">
        <div className={cn(
          "p-2.5 sm:p-3 rounded-xl sm:rounded-full transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm sm:shadow-none",
          circleBgClass
        )}>
          <Icon className={cn("h-5 w-5 sm:h-6 sm:w-6", iconColorClass)} />
        </div>
        <div className="flex-1 min-w-0 w-full">
          <p className="font-sans text-xs sm:text-sm font-medium tracking-normal text-muted-foreground truncate px-1">
            {title}
          </p>
          <p className="font-sans text-base sm:text-2xl font-semibold tracking-tight tabular-nums text-foreground mt-0.5 sm:mt-0 px-1 leading-tight">
            <spoiler-span key={value}>{value}</spoiler-span>
          </p>
        </div>
      </div>

      {/* Decorative element for mobile - subtle large icon */}
      <div className="absolute -right-4 -bottom-4 opacity-[0.04] sm:hidden pointer-events-none transform rotate-12 scale-110">
        <Icon className={cn("h-20 w-20", iconColorClass)} />
      </div>

      {/* Subtle border glow for mobile dark mode */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent sm:hidden" />
    </Card>
  );
};


const ALL_PROJECT_STATUSES_CONFIG: Array<{ title: string; status: ProjectStatusType; icon: React.ElementType; color: string; gradient: string; shadow: string; }> = [
  { title: 'CR Clearance', status: 'CR Clearance', icon: ShieldCheck, color: '#3b82f6', gradient: 'linear-gradient(to right, #3b82f6, #60a5fa)', shadow: '0 4px 15px 0 rgba(59, 130, 246, 0.4)' },
  { title: 'Operation Manager', status: 'Operation Manager', icon: UserCog, color: '#10b981', gradient: 'linear-gradient(to right, #10b981, #34d399)', shadow: '0 4px 15px 0 rgba(16, 185, 129, 0.4)' },
  { title: 'On Script', status: 'On Script', icon: PenLine, color: '#8b5cf6', gradient: 'linear-gradient(to right, #8b5cf6, #a78bfa)', shadow: '0 4px 15px 0 rgba(139, 92, 246, 0.4)' },
  { title: 'On Hold', status: 'On Hold', icon: PauseCircle, color: '#f97316', gradient: 'linear-gradient(to right, #f97316, #fb923c)', shadow: '0 4px 15px 0 rgba(249, 115, 22, 0.4)' },
  { title: 'Script Done', status: 'Script Done', icon: FileCheck, color: '#7c3aed', gradient: 'linear-gradient(to right, #7c3aed, #a78bfa)', shadow: '0 4px 15px 0 rgba(124, 58, 237, 0.4)' },
  { title: 'Artist Booked', status: 'Artist Booked', icon: UserCheck, color: '#db2777', gradient: 'linear-gradient(to right, #db2777, #f472b6)', shadow: '0 4px 15px 0 rgba(219, 39, 119, 0.4)' },
  { title: 'Cinematographer', status: 'Cinematographer', icon: Camera, color: '#2563eb', gradient: 'linear-gradient(to right, #2563eb, #60a5fa)', shadow: '0 4px 15px 0 rgba(37, 99, 235, 0.4)' },
  { title: 'CG Complete', status: 'CG Complete', icon: Sparkles, color: '#0891b2', gradient: 'linear-gradient(to right, #0891b2, #22d3ee)', shadow: '0 4px 15px 0 rgba(8, 145, 178, 0.4)' },
  { title: 'On Editor', status: 'On Editor', icon: Clapperboard, color: '#4f46e5', gradient: 'linear-gradient(to right, #4f46e5, #818cf8)', shadow: '0 4px 15px 0 rgba(79, 70, 229, 0.4)' },
  { title: 'Client Revision', status: 'Client Revision', icon: RefreshCcw, color: '#ea580c', gradient: 'linear-gradient(to right, #ea580c, #fb923c)', shadow: '0 4px 15px 0 rgba(234, 88, 12, 0.4)' },
  { title: 'Project Complete', status: 'Project Complete', icon: CheckCircle2, color: '#16a34a', gradient: 'linear-gradient(to right, #16a34a, #4ade80)', shadow: '0 4px 15px 0 rgba(22, 163, 74, 0.4)' },
  { title: 'Due Payment', status: 'Due Payment', icon: Wallet, color: '#dc2626', gradient: 'linear-gradient(to right, #dc2626, #f87171)', shadow: '0 4px 15px 0 rgba(220, 38, 38, 0.4)' },
  { title: 'Project Delivered', status: 'Project Delivered', icon: PackageCheck, color: '#65a30d', gradient: 'linear-gradient(to right, #65a30d, #84cc16)', shadow: '0 4px 15px 0 rgba(101, 163, 13, 0.4)' },
];

const ALL_LEAD_CATEGORIES_CONFIG: Array<{ title: string; category: LeadCategory; icon: React.ElementType; color: string; gradient: string; shadow: string; }> = [
  { title: LEAD_CATEGORY_LABELS['POP'], category: 'POP', icon: UserIcon, color: '#0ea5e9', gradient: 'linear-gradient(to right, #0ea5e9, #38bdf8)', shadow: '0 4px 15px 0 rgba(14, 165, 233, 0.4)' },
  { title: LEAD_CATEGORY_LABELS['APPOINTMENT'], category: 'APPOINTMENT', icon: CalendarDays, color: '#6366f1', gradient: 'linear-gradient(to right, #6366f1, #818cf8)', shadow: '0 4px 15px 0 rgba(99, 102, 241, 0.4)' },
  { title: LEAD_CATEGORY_LABELS['PROSPECT'], category: 'PROSPECT', icon: Users, color: '#ec4899', gradient: 'linear-gradient(to right, #ec4899, #f472b6)', shadow: '0 4px 15px 0 rgba(236, 72, 153, 0.4)' },
  { title: LEAD_CATEGORY_LABELS['POG'], category: 'POG', icon: Users, color: '#1d4ed8', gradient: 'linear-gradient(to right, #1d4ed8, #3b82f6)', shadow: '0 4px 15px 0 rgba(29, 78, 216, 0.4)' },
  { title: LEAD_CATEGORY_LABELS['OC'], category: 'OC', icon: BaggageClaim, color: '#9333ea', gradient: 'linear-gradient(to right, #9333ea, #a855f7)', shadow: '0 4px 15px 0 rgba(147, 51, 234, 0.4)' },
  { title: LEAD_CATEGORY_LABELS['BUDGET_ISSUE'], category: 'BUDGET_ISSUE', icon: Wallet, color: '#d97706', gradient: 'linear-gradient(to right, #d97706, #f59e0b)', shadow: '0 4px 15px 0 rgba(217, 119, 6, 0.4)' },
  { title: LEAD_CATEGORY_LABELS['CANCELLED'], category: 'CANCELLED', icon: XCircle, color: '#dc2626', gradient: 'linear-gradient(to right, #dc2626, #ef4444)', shadow: '0 4px 15px 0 rgba(220, 38, 38, 0.4)' },
];

const LeftAlignedTick = ({ y, payload }: any) => {
  return (
    <g>
      <text x={0} y={y} dy={4} fontSize={13} fontWeight={500} textAnchor="start" fill="currentColor" className="font-sans fill-foreground/70">
        {payload.value}
      </text>
      <text x={135} y={y} dy={4} fontSize={13} fontWeight={500} textAnchor="start" fill="currentColor" className="font-sans fill-foreground/70">
        :
      </text>
    </g>
  );
};

export default function DashboardPage() {
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isAuthLoading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, isAuthLoading, router]);

  if (isAuthLoading || !isClient) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) {
    return null; // Redirect is handled by the useEffect above
  }

  return <DashboardContent />;
}

const getInitials = (name: string | undefined): string => {
  if (!name) return '??';
  const names = name.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return names[0].charAt(0).toUpperCase() + (names[names.length - 1] ? names[names.length - 1].charAt(0).toUpperCase() : '');
};


function DashboardContent() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on("order-updated", (data: any) => {
      console.log("Dashboard: Order updated remotely, refreshing queries:", data);
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
    });

    return () => {
      socket.off("order-updated");
    };
  }, [socket, queryClient]);

  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const now = new Date();
    return {
      from: startOfMonth(now),
      to: endOfMonth(now),
    };
  });
  const [currentDateRangeLabel, setCurrentDateRangeLabel] = useState("This Month");
  const [selectedPredefinedValue, setSelectedPredefinedValue] = useState<PredefinedRange | "custom" | null>("thisMonth");
  const [chartGranularity, setChartGranularity] = useState<'daily' | 'hourly' | 'monthly'>('daily');
  const [selectedCrmId, setSelectedCrmId] = useState<string>('all');
  const [feedbackToDelete, setFeedbackToDelete] = useState<Feedback | null>(null);
  const [isDeletingFeedback, setIsDeletingFeedback] = useState(false);
  const [displayMode, setDisplayMode] = useState<'amount'|'quantity'>('quantity');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = sessionStorage.getItem('dashboardDisplayMode') as 'amount'|'quantity' || 'quantity';
      setDisplayMode(savedMode);

      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'dashboardDisplayMode' && e.newValue) {
          setDisplayMode(e.newValue as 'amount'|'quantity');
        }
      };
      
      const handleCustomEvent = (e: any) => {
        setDisplayMode(e.detail.mode);
      };

      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('dashboardDisplayModeChanged', handleCustomEvent);
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('dashboardDisplayModeChanged', handleCustomEvent);
      };
    }
  }, []);


  const isDesignerRepOrLrOrCo = (currentUser && isDrRole(currentUser.role)) || currentUser?.role === 'LR' || currentUser?.role === 'CO';


  const fetchDashboardData = useCallback(async () => {
    if (!currentUser) {
      return null;
    }
    const startStr = selectedDateRange?.from ? format(startOfDay(selectedDateRange.from), 'yyyy-MM-dd HH:mm:ss') : undefined;
    const endStr = selectedDateRange?.to ? format(endOfDay(selectedDateRange.to), 'yyyy-MM-dd HH:mm:ss') : undefined;
    const role = currentUser?.role;
    const userId = (role === 'SYSTEM_ADMIN' || role === 'ADMIN') ? (selectedCrmId && selectedCrmId !== 'all' ? selectedCrmId : undefined) : currentUser?.id;
    try {
      const [fetchedOrders, fetchedYearOrders, fetchedModels, fetchedUsers, fetchedProjects, fetchedSettings, fetchedLeads, fetchedTodayScheduledLeads, fetchedTasks, fetchedFeedback, fetchedCrWorkflowEntries, fetchedTransactions, fetchedPaymentMethods] = await Promise.all([
        getOrders(startStr, endStr, role, userId), getOrders(undefined, undefined, role, userId), getModels(), getUsers(), getProjects(role === 'SW' ? undefined : startStr, role === 'SW' ? undefined : endStr, role, userId), getGlobalSettings(), getLeads(startStr, endStr, role, userId), getLeads(undefined, undefined, role, userId), getTaskEntries(), getFeedback(), getDr2oEntries('CR'), getAllTransactionsAction(startStr, endStr, role, userId),
        role === 'SYSTEM_ADMIN' || role === 'ADMIN' ? getPaymentMethods() : Promise.resolve([]),
      ]);

      // Merge CR workflow sale counts into allTasks for CR users
      const crmWorkflowTasks: TaskEntry[] = fetchedCrWorkflowEntries.map(entry => ({
        id: entry.id,
        date: entry.date,
        userId: entry.crmId,
        userName: entry.crmName,
        role: 'CR',
        taskCount: entry.saleCount || 0,
        createdAt: entry.date,
      }));

      return {
        allOrders: fetchedOrders, allYearOrders: fetchedYearOrders, allModels: fetchedModels, allUsers: fetchedUsers,
        allProjects: fetchedProjects, globalSettings: fetchedSettings, allLeads: fetchedLeads, allTodayScheduledLeads: fetchedTodayScheduledLeads,
        allTasks: [...fetchedTasks, ...crmWorkflowTasks], 
        allFeedback: fetchedFeedback,
        allTransactions: fetchedTransactions,
        allPaymentMethods: fetchedPaymentMethods,
      };
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      toast({ title: "Error", description: "Could not load dashboard data.", variant: "destructive" });
      throw new Error("Data fetch failed");
    }
  }, [currentUser, toast, selectedDateRange, selectedCrmId]);

  const { data: queryData, isLoading: isLoadingQuery, refetch } = useQuery({
    queryKey: ['dashboardData', currentUser?.id, selectedCrmId, selectedDateRange?.from?.toISOString(), selectedDateRange?.to?.toISOString()],
    queryFn: fetchDashboardData,
    enabled: !!currentUser,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    refetchOnMount: 'always',
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const isLoadingData = isLoadingQuery && !queryData;

  const { allOrders = [], allYearOrders = [], allModels = [], allUsers = [], allProjects = [], globalSettings = null, allLeads = [], allTodayScheduledLeads = [], allTasks = [], allFeedback = [], allTransactions = [], allPaymentMethods = [] } = queryData || {};
  const [summaryNow, setSummaryNow] = useState(() => new Date());
  useEffect(() => {
    if (currentUser?.role !== 'SW') return;
    const timer = window.setInterval(() => setSummaryNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [currentUser?.role]);
  const scriptWriterSummary = useMemo(() => currentUser?.role === 'SW'
    ? getScriptWriterSummary(allProjects, allYearOrders, currentUser.id, selectedDateRange, summaryNow)
    : null, [allProjects, allYearOrders, currentUser?.role, currentUser?.id, selectedDateRange, summaryNow]);
  const allCrmUsers = useMemo(() => allUsers.filter(u => u.role === 'CR' && !u.isBanned), [allUsers]);

  const getDateRangeInterval = () => {
    if (!selectedDateRange?.from || !selectedDateRange?.to) return null;
    const startDate = new Date(selectedDateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(selectedDateRange.to);
    endDate.setHours(23, 59, 59, 999);
    return { start: startDate, end: endDate };
  };

  const filteredOrders = useMemo(() => {
    let ordersToFilter = [...allOrders];

    if (currentUser?.role === 'CR') {
      ordersToFilter = ordersToFilter.filter(order => order.crmUserId === currentUser.id);
    } else if ((currentUser && isDrRole(currentUser.role))) {
      ordersToFilter = ordersToFilter.filter(order => isAssignedTo(order, currentUser.id));
    } else if ((currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.role === 'ADMIN') && selectedCrmId !== 'all') {
      ordersToFilter = ordersToFilter.filter(order => order.crmUserId === selectedCrmId);
    }

    return ordersToFilter;
  }, [allOrders, currentUser, selectedCrmId]);

  const validFilteredOrders = useMemo(() => {
    return filteredOrders.filter(order => order.currentStatus !== CANCELLED_STATUS_ID);
  }, [filteredOrders]);

  const validAllOrdersForPayments = useMemo(() => {
    const ordersSource = allYearOrders && allYearOrders.length > 0 ? allYearOrders : allOrders;
    let ordersToFilter = [...ordersSource];

    if (currentUser?.role === 'CR') {
      ordersToFilter = ordersToFilter.filter(order => order.crmUserId === currentUser.id);
    } else if ((currentUser && isDrRole(currentUser.role))) {
      ordersToFilter = ordersToFilter.filter(order => isAssignedTo(order, currentUser.id));
    } else if ((currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.role === 'ADMIN') && selectedCrmId !== 'all') {
      ordersToFilter = ordersToFilter.filter(order => order.crmUserId === selectedCrmId);
    }

    return ordersToFilter.filter(order => order.currentStatus !== CANCELLED_STATUS_ID);
  }, [allYearOrders, allOrders, currentUser, selectedCrmId]);

  const filteredLeads = useMemo(() => {
    let leadsToFilter = [...allLeads];

    if (currentUser?.role === 'CR') {
      leadsToFilter = leadsToFilter.filter(l => l.crmId === currentUser.id);
    } else if ((currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.role === 'ADMIN') && selectedCrmId !== 'all') {
      leadsToFilter = leadsToFilter.filter(l => l.crmId === selectedCrmId);
    }
    return leadsToFilter;
  }, [allLeads, currentUser, selectedCrmId]);

  const totalNewLeads = useMemo(() => {
    const interval = getDateRangeInterval();
    if (!interval) return 0;

    return filteredLeads.filter(lead => {
      const date = parseISO(lead.date);
      return isValid(date) && isWithinInterval(date, interval);
    }).length;
  }, [filteredLeads, selectedDateRange]);

  const todayScheduledLeads = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let leadsToFilter = [...allTodayScheduledLeads];

    if (currentUser?.role === 'CR') {
      leadsToFilter = leadsToFilter.filter(l => l.crmId === currentUser.id);
    } else if ((currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.role === 'ADMIN') && selectedCrmId !== 'all') {
      leadsToFilter = leadsToFilter.filter(l => l.crmId === selectedCrmId);
    }

    return leadsToFilter.filter(lead => {
      if (!lead.schedule) return false;
      try {
        const dt = parseISO(lead.schedule);
        return isValid(dt) && format(dt, 'yyyy-MM-dd') === todayStr;
      } catch {
        return false;
      }
    }).sort((a, b) => {
      try {
        return new Date(a.schedule!).getTime() - new Date(b.schedule!).getTime();
      } catch {
        return 0;
      }
    });
  }, [allTodayScheduledLeads, currentUser, selectedCrmId]);

  const filteredProjects = useMemo(() => {
    let projectsToFilter = [...allProjects];

    if (currentUser?.role === 'CR') {
      projectsToFilter = projectsToFilter.filter(p => p.assigneeId === currentUser.id);
    } else if ((currentUser && isDrRole(currentUser.role))) {
      projectsToFilter = projectsToFilter.filter(p => isAssignedTo(p, currentUser.id));
    } else if (currentUser?.role === 'LR') {
      projectsToFilter = projectsToFilter.filter(p => p.assigneeId === currentUser.id || p.status === 'Project Complete' || p.status === 'Project Delivered');
    } else if ((currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.role === 'ADMIN') && selectedCrmId !== 'all') {
      projectsToFilter = projectsToFilter.filter(p => p.assigneeId === selectedCrmId);
    }

    return projectsToFilter;
  }, [allProjects, currentUser, selectedCrmId]);


  const topSalesAreaData = useMemo(() => {
    const salesByDivision: Record<string, number> = {};
    const simplifyString = (str: string) => str.replace(/['’.,\s-]/g, '').toLowerCase();
    let totalSalesAllDivisions = 0;

    validFilteredOrders.forEach(order => {
      let longestMatch: { name: string; division: string; } | null = null;
      let longestMatchLength = 0;
      const simplifiedAddress = simplifyString(order.address);

      for (const div of divisions) {
        for (const dist of div.districts) {
          const namesToMatch = [dist.name, ...(dist.aliases || [])];
          for (const name of namesToMatch) {
            const simplifiedDistName = simplifyString(name);
            if (simplifiedDistName.length > 0 && simplifiedAddress.includes(simplifiedDistName)) {
              if (simplifiedDistName.length > longestMatchLength) {
                longestMatchLength = simplifiedDistName.length;
                longestMatch = { name: dist.name, division: div.division };
              }
            }
          }
        }
      }

      const divisionName = longestMatch ? longestMatch.division : "Unknown";
      const orderTotal = (order.orderItems || []).reduce((acc, item) => acc + (item.isGift ? 0 : (Number(item.lineItemTotalPrice) || 0)), 0) - (Number(order.specialClientDiscount) || 0);
      salesByDivision[divisionName] = (salesByDivision[divisionName] || 0) + orderTotal;
      totalSalesAllDivisions += orderTotal;
    });

    if (totalSalesAllDivisions === 0) return [];

    return Object.entries(salesByDivision)
      .map(([name, sales]) => ({
        name,
        sales,
        percentage: (sales / totalSalesAllDivisions) * 100
      }))
      .sort((a, b) => b.sales - a.sales);

  }, [validFilteredOrders]);

  const paymentMethodData = useMemo(() => {
    const interval = getDateRangeInterval();
    if (!interval) return [];

    const stats = new Map<string, { name: string; count: number; amount: number }>();
    const ensureMethod = (name: string) => {
      const trimmedName = name.trim();
      const normalizedName = ['system auto-settled', 'courier', 'cod'].includes(trimmedName.toLowerCase()) ? 'COD' : trimmedName;
      if (!normalizedName) return undefined;
      const key = normalizedName.toLowerCase();
      if (!stats.has(key)) stats.set(key, { name: normalizedName, count: 0, amount: 0 });
      return stats.get(key);
    };
    allPaymentMethods.forEach(method => ensureMethod(method.name));

    validAllOrdersForPayments.forEach(order => {
      if (Array.isArray(order.advancePayments)) {
        order.advancePayments.forEach(payment => {
          if (payment.date && isWithinInterval(parseISO(payment.date), interval)) {
            if (payment.paymentMethod) {
              const method = ensureMethod(payment.paymentMethod);
              if (method) {
                method.count += 1;
                method.amount += (Number(payment.amount) || 0);
              }
            }
          }
        });
      }
    });

    const totalPaymentsCount = Array.from(stats.values()).reduce((sum, { count }) => sum + count, 0);

    return Array.from(stats.values())
      .map((data) => ({
        name: data.name,
        count: data.count,
        amount: data.amount,
        percentage: totalPaymentsCount > 0 ? (data.count / totalPaymentsCount) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [validAllOrdersForPayments, selectedDateRange, allPaymentMethods]);




  const trafficSourcesData = useMemo(() => {
    if (!filteredLeads.length) return [];
    const sourceCounts: Record<string, number> = {};
    filteredLeads.forEach(lead => {
      const source = lead.source || "Others";
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });

    const total = filteredLeads.length;
    if (total === 0) return [];

    return Object.entries(sourceCounts)
      .map(([name, value]) => ({
        name,
        value,
        fill: trafficSourcesChartConfig[name as keyof typeof trafficSourcesChartConfig]?.color || "hsl(var(--muted-foreground))"
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredLeads]);

  const projectCounts = useMemo(() => {
    if (scriptWriterSummary) return scriptWriterSummary.projectCounts;
    const counts = Object.fromEntries(PROJECT_STAGES.map((st) => [st, 0])) as Record<ProjectStatusType, number>;

    let projectsToCount = filteredProjects;

    projectsToCount.forEach(p => {
      if (counts[p.status] !== undefined) {
        counts[p.status]++;
      }
    });
    return counts;
  }, [filteredProjects, scriptWriterSummary]);

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  useEffect(() => {
    if (!currentUser || !['SYSTEM_ADMIN', 'ADMIN', 'CR'].includes(currentUser.role)) return;
    getMeetings().then(setMeetings).catch(() => setMeetings([]));
  }, [currentUser]);

  const [quotations, setQuotations] = useState<TrackingLink[]>([]);
  useEffect(() => {
    if (!currentUser || !['SYSTEM_ADMIN', 'ADMIN', 'CR'].includes(currentUser.role)) return;
    getQuotations().then(setQuotations).catch(() => setQuotations([]));
  }, [currentUser]);

  const { quotationCount, quotationAmount } = useMemo(() => {
    const interval = getDateRangeInterval();
    let count = 0;
    let amount = 0;
    quotations.forEach((q) => {
      if (currentUser?.role === 'CR' && q.crmUserId !== currentUser.id) return;
      if (interval && !isWithinInterval(parseISO(q.createdAt), interval)) return;
      count++;
      const items = (q.orderItems || []).reduce((sum, it) => sum + (it.isGift ? 0 : (Number(it.lineItemTotalPrice) || 0)), 0);
      amount += items - (Number(q.specialClientDiscount) || 0) + (Number(q.shippingCharge) || 0);
    });
    return { quotationCount: count, quotationAmount: amount };
  }, [quotations, currentUser, getDateRangeInterval]);

  const scheduledMeetingCount = useMemo(() => {
    const interval = getDateRangeInterval();
    return meetings.filter((m) => m.status === 'Scheduled' && (!interval || isWithinInterval(parseISO(m.meetingAt), interval))).length;
  }, [meetings, getDateRangeInterval]);

  const leadCategoryCounts = useMemo(() => {
    const counts: Record<LeadCategory, number> = {
      'POP': 0, 'APPOINTMENT': 0, 'PROSPECT': 0, 'POG': 0, 'OC': 0, 'BUDGET_ISSUE': 0, 'CANCELLED': 0
    };
    let leadsToCount = filteredLeads;
    leadsToCount.forEach(l => {
      if (counts[l.category] !== undefined) {
        counts[l.category]++;
      }
    });
    return counts;
  }, [filteredLeads]);

  const { totalSales, invoiceDue, totalPurchase, totalPurchaseCount, netValue, salesChartData, deliveredCount, ordersWithDueCount, invoicePaid, invoicePaidCount, invoiceCodPaid, invoiceCodPaidCount, salesCount, repeatSalesCount, repeatSalesAmount, invoicePayment, invoicePaymentCount, dueCollection, dueCollectionCount, totalExpenses, totalExpensesCount, giftValue, giftCount, discountAmount, discountCount } = useMemo(() => {
    const interval = getDateRangeInterval();
    if (!interval) {
      return { totalSales: 0, invoiceDue: 0, totalPurchase: 0, totalPurchaseCount: 0, netValue: 0, salesChartData: [], deliveredCount: '0', ordersWithDueCount: 0, invoicePaid: 0, invoicePaidCount: 0, invoiceCodPaid: 0, invoiceCodPaidCount: 0, salesCount: 0, repeatSalesCount: 0, repeatSalesAmount: 0, invoicePayment: 0, invoicePaymentCount: 0, dueCollection: 0, dueCollectionCount: 0, totalExpenses: 0, totalExpensesCount: 0, giftValue: 0, giftCount: 0, discountAmount: 0, discountCount: 0 };
    }

    let currentTotalSales = 0;
    let currentGiftValue = 0;
    let currentGiftCount = 0;
    let currentTotalPurchaseValue = 0;
    let currentTotalPurchaseItemQuantity = 0;
    let currentOrdersWithDueCount = 0;
    let currentInvoiceDue = 0;
    let currentInvoicePaid = 0;
    let currentInvoiceCodPaid = 0;
    let currentInvoiceCodPaidCount = 0;
    let currentInvoicePaidCount = 0;
    let currentRepeatSalesCount = 0;
    let currentRepeatSalesAmount = 0;
    let currentInvoicePayment = 0;
    let currentInvoicePaymentCount = 0;
    let currentDueCollection = 0;
    const dueCollectionOrderIds = new Set<string>();
    let currentTotalExpenses = 0;
    let currentTotalExpensesCount = 0;
    let currentDiscountAmount = 0;
    let currentDiscountCount = 0;

    const customerOrderHistory = new Set<string>();
    const repeatOrderIds = new Set<string>();
    const advancePaidOrderIds = new Set<string>();
    const codPaidOrderIds = new Set<string>();
    
    // Sort history of non-cancelled orders by date to identify repeat orders accurately
    const historyOrders = allYearOrders.length > 0 ? allYearOrders : allOrders;
    const sortedValidOrders = [...historyOrders]
      .filter(o => o.currentStatus !== CANCELLED_STATUS_ID)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    sortedValidOrders.forEach(o => {
      const jobId = (o.companyName || '').split('•')[0].trim();
      if (jobId) {
        if (customerOrderHistory.has(jobId)) {
          repeatOrderIds.add(o.id);
        } else {
          customerOrderHistory.add(jobId);
        }
      }
    });

    const ordersForCalcs = validFilteredOrders;

    ordersForCalcs.forEach(order => {
      const orderCreatedAt = parseISO(order.createdAt);
      // Sales, Purchase, Due calculations based on orders *created* in the date range
      if (isWithinInterval(orderCreatedAt, interval)) {
        const orderTotal = (order.orderItems || []).reduce((sum, item) => sum + (item.isGift ? 0 : (Number(item.lineItemTotalPrice) || 0)), 0);
        const effectiveDiscount = Number(order.specialClientDiscount) || 0;
        const shipping = Number(order.shippingCharge) || 0;
        const netPayable = orderTotal - effectiveDiscount;
        const grandTotal = netPayable + vatAmountFor(netPayable, order.vatPercentage) + shipping;
        currentTotalSales += netPayable;
        if (effectiveDiscount > 0) {
          currentDiscountAmount += effectiveDiscount;
          currentDiscountCount++;
        }

        if (Array.isArray(order.orderItems)) {
          order.orderItems.forEach((item: OrderItem) => {
            if (item.isGift) {
              currentGiftValue += (Number(item.lineItemTotalPrice) || 0);
              currentGiftCount += (Number(item.quantity) || 0);
            }
          });
        }

        const totalOrderAdvance = (order.advancePayments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const orderDue = Math.max(0, grandTotal - totalOrderAdvance);
        currentInvoiceDue += orderDue;

        if (orderDue > 0.01) {
          currentOrdersWithDueCount++;
        }

        if (repeatOrderIds.has(order.id)) {
          currentRepeatSalesCount++;
          currentRepeatSalesAmount += netPayable;
        }
      }
    });

    // Payments made in the date range (scanned across all valid historical orders)
    validAllOrdersForPayments.forEach(order => {
      if (Array.isArray(order.advancePayments)) {
        order.advancePayments.forEach((payment, paymentIndex) => {
          if (payment.date && isWithinInterval(parseISO(payment.date), interval)) {
            const paymentAmt = Number(payment.amount) || 0;
            // 2nd payment onwards = adjustment payment, i.e. due collected after the advance
            if (paymentIndex > 0) {
              currentDueCollection += paymentAmt;
              dueCollectionOrderIds.add(order.id);
            }
            currentInvoicePayment += paymentAmt;
            currentInvoicePaymentCount++;

            const methodName = payment.paymentMethod?.toLowerCase() || '';
            const isCod = methodName === 'cod' || methodName === 'system auto-settled' || methodName === 'courier';
            if (isCod) {
              currentInvoiceCodPaid += paymentAmt;
              codPaidOrderIds.add(order.id);
            } else {
              currentInvoicePaid += paymentAmt;
              advancePaidOrderIds.add(order.id);
            }
          }
        });
      }
    });

    currentInvoicePaidCount = advancePaidOrderIds.size;
    currentInvoiceCodPaidCount = codPaidOrderIds.size;

    let currentDeliveredCount = 0;
    let ordersForDeliveryCount = allOrders; // Start with all orders
    if (currentUser?.role === 'CR') {
      ordersForDeliveryCount = allOrders.filter(order => order.crmUserId === currentUser.id);
    } else if ((currentUser && isDrRole(currentUser.role))) {
      ordersForDeliveryCount = allOrders.filter(order => isAssignedTo(order, currentUser.id));
    } else if ((currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.role === 'ADMIN') && selectedCrmId !== 'all') {
      ordersForDeliveryCount = allOrders.filter(order => order.crmUserId === selectedCrmId);
    }

    ordersForDeliveryCount = ordersForDeliveryCount.filter(order => order.currentStatus !== CANCELLED_STATUS_ID);

    const deliveredStatusId = globalSettings?.crmCompletionStatusIds?.find(id => id === 'delivered') || 'delivered';

    currentDeliveredCount = ordersForDeliveryCount.filter(order =>
      (order.statusHistory || []).some(log => {
        if (log.status !== deliveredStatusId) return false;
        try {
          return isWithinInterval(parseISO(log.timestamp), interval);
        } catch (e) {
          return false;
        }
      })
    ).length;

    let chartData: Array<{ date: string; sales: number; orders: number; deliveries: number; expenses: number; expenseCount: number; }> = [];
    if (selectedPredefinedValue === 'today' || selectedPredefinedValue === 'yesterday') {
      const hourlyData = new Map<number, { sales: number; orders: number; deliveries: number }>();
      for (let i = 0; i < 24; i++) hourlyData.set(i, { sales: 0, orders: 0, deliveries: 0 });

      validFilteredOrders.forEach(order => {
        if (order.createdAt) {
          try {
            const hour = getHours(parseISO(order.createdAt));
            const orderTotalForChart = (order.orderItems || []).reduce((sum, item) => sum + (item.isGift ? 0 : (Number(item.lineItemTotalPrice) || 0)), 0) - (Number(order.specialClientDiscount) || 0);
            const existing = hourlyData.get(hour) || { sales: 0, orders: 0, deliveries: 0 };
            hourlyData.set(hour, { ...existing, sales: existing.sales + orderTotalForChart, orders: existing.orders + 1 });
          } catch (e) { /* ignore */ }
        }
      });

      ordersForDeliveryCount.forEach(order => {
        (order.statusHistory || []).forEach(log => {
          if (log.status === deliveredStatusId && log.timestamp) {
            try {
              const deliveryDate = parseISO(log.timestamp);
              if (isWithinInterval(deliveryDate, interval)) {
                const hour = getHours(deliveryDate);
                const existing = hourlyData.get(hour);
                if (existing) {
                  existing.deliveries += 1;
                }
              }
            } catch (e) { /* ignore */ }
          }
        });
      });

      chartData = Array.from(hourlyData.entries())
        .map(([hour, data]) => ({ date: hour.toString(), sales: data.sales, orders: data.orders, deliveries: data.deliveries, expenses: 0, expenseCount: 0 }))
        .sort((a, b) => parseInt(a.date) - parseInt(b.date));
    } else if (selectedDateRange?.from && selectedDateRange?.to) {
      if (chartGranularity === 'monthly') {
        const monthlyData = new Map<string, { sales: number; orders: number; deliveries: number }>();
        let tempDate = startOfMonth(new Date(selectedDateRange.from));
        const endRangeDate = endOfMonth(new Date(selectedDateRange.to));
        
        while (tempDate <= endRangeDate) {
          monthlyData.set(format(tempDate, 'yyyy-MM'), { sales: 0, orders: 0, deliveries: 0 });
          tempDate = addDays(endOfMonth(tempDate), 1);
        }

        validFilteredOrders.forEach(order => {
          if (order.createdAt) {
            try {
              const orderDateStr = format(parseISO(order.createdAt), 'yyyy-MM');
              if (monthlyData.has(orderDateStr)) {
                const orderTotalForChart = (order.orderItems || []).reduce((sum, item) => sum + (item.isGift ? 0 : (Number(item.lineItemTotalPrice) || 0)), 0) - (Number(order.specialClientDiscount) || 0);
                const existing = monthlyData.get(orderDateStr) || { sales: 0, orders: 0, deliveries: 0 };
                monthlyData.set(orderDateStr, { ...existing, sales: existing.sales + orderTotalForChart, orders: existing.orders + 1 });
              }
            } catch (e) { /* ignore */ }
          }
        });

        ordersForDeliveryCount.forEach(order => {
          (order.statusHistory || []).forEach(log => {
            if (log.status === deliveredStatusId && log.timestamp) {
              try {
                const deliveryDate = parseISO(log.timestamp);
                if (isWithinInterval(deliveryDate, interval)) {
                  const deliveryDateStr = format(deliveryDate, 'yyyy-MM');
                  const existing = monthlyData.get(deliveryDateStr);
                  if (existing) {
                    existing.deliveries += 1;
                  }
                }
              } catch (e) { /* ignore */ }
            }
          });
        });

        chartData = Array.from(monthlyData.entries())
          .map(([date, data]) => ({ date, sales: data.sales, orders: data.orders, deliveries: data.deliveries, expenses: 0, expenseCount: 0 }))
          .sort((a, b) => a.date.localeCompare(b.date));
      } else {
        const dailyData = new Map<string, { sales: number; orders: number; deliveries: number }>();
        let tempDate = new Date(selectedDateRange.from);
        while (tempDate <= selectedDateRange.to) {
          dailyData.set(format(tempDate, 'yyyy-MM-dd'), { sales: 0, orders: 0, deliveries: 0 });
          tempDate = addDays(tempDate, 1);
        }

        validFilteredOrders.forEach(order => {
          if (order.createdAt) {
            try {
              const orderDateStr = format(parseISO(order.createdAt), 'yyyy-MM-dd');
              if (dailyData.has(orderDateStr)) {
                const orderTotalForChart = (order.orderItems || []).reduce((sum, item) => sum + (item.isGift ? 0 : (Number(item.lineItemTotalPrice) || 0)), 0) - (Number(order.specialClientDiscount) || 0);
                const existing = dailyData.get(orderDateStr) || { sales: 0, orders: 0, deliveries: 0 };
                dailyData.set(orderDateStr, { ...existing, sales: existing.sales + orderTotalForChart, orders: existing.orders + 1 });
              }
            } catch (e) { /* ignore */ }
          }
        });

        ordersForDeliveryCount.forEach(order => {
          (order.statusHistory || []).forEach(log => {
            if (log.status === deliveredStatusId && log.timestamp) {
              try {
                const deliveryDate = parseISO(log.timestamp);
                if (isWithinInterval(deliveryDate, interval)) {
                  const deliveryDateStr = format(deliveryDate, 'yyyy-MM-dd');
                  const existing = dailyData.get(deliveryDateStr);
                  if (existing) {
                    existing.deliveries += 1;
                  }
                }
              } catch (e) { /* ignore */ }
            }
          });
        });

        chartData = Array.from(dailyData.entries())
          .map(([date, data]) => ({ date, sales: data.sales, orders: data.orders, deliveries: data.deliveries, expenses: 0, expenseCount: 0 }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
    }

    allTransactions.forEach(t => {
      if (t.type === 'expense') {
        try {
          const transactionDate = parseISO(t.date);
          if (isWithinInterval(transactionDate, interval)) {
            if (currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.role === 'ADMIN') {
              if (selectedCrmId !== 'all') {
                if (t.userId !== selectedCrmId) return;
              }
            } else {
              if (t.userId !== currentUser?.id) return;
            }
            currentTotalExpenses += (Number(t.amount) || 0);
            currentTotalExpensesCount++;
            const bucketKey = selectedPredefinedValue === 'today' || selectedPredefinedValue === 'yesterday'
              ? getHours(transactionDate).toString()
              : format(transactionDate, chartGranularity === 'monthly' ? 'yyyy-MM' : 'yyyy-MM-dd');
            const bucket = chartData.find((row) => row.date === bucketKey);
            if (bucket) {
              bucket.expenses += Number(t.amount) || 0;
              bucket.expenseCount += 1;
            }
          }
        } catch (e) {
          console.error("Error parsing transaction date for dashboard:", t.date, e);
        }
      }
    });

    return {
      totalSales: currentTotalSales,
      invoiceDue: currentInvoiceDue,
      totalPurchase: currentTotalPurchaseValue,
      totalPurchaseCount: currentTotalPurchaseItemQuantity,
      netValue: currentTotalSales - currentTotalExpenses,
      salesChartData: chartData,
      deliveredCount: currentDeliveredCount.toString(),
      ordersWithDueCount: currentOrdersWithDueCount,
      invoicePaid: currentInvoicePaid,
      invoicePaidCount: currentInvoicePaidCount,
      dueCollection: currentDueCollection,
      dueCollectionCount: dueCollectionOrderIds.size,
      invoiceCodPaid: currentInvoiceCodPaid,
      invoiceCodPaidCount: currentInvoiceCodPaidCount,
      salesCount: validFilteredOrders.length,
      repeatSalesCount: currentRepeatSalesCount,
      repeatSalesAmount: currentRepeatSalesAmount,
      invoicePayment: currentInvoicePayment,
      invoicePaymentCount: currentInvoicePaymentCount,
      totalExpenses: currentTotalExpenses,
      totalExpensesCount: currentTotalExpensesCount,
      giftValue: currentGiftValue,
      giftCount: currentGiftCount,
      discountAmount: currentDiscountAmount,
      discountCount: currentDiscountCount,
    };
  }, [validFilteredOrders, validAllOrdersForPayments, allOrders, allYearOrders, allModels, selectedDateRange, selectedPredefinedValue, globalSettings, currentUser, selectedCrmId, chartGranularity, allTransactions]);

  const [teamPerformanceDateRange, setTeamPerformanceDateRange] = useState<DateRange | undefined>(() => {
    const now = new Date();
    return {
      from: startOfMonth(now),
      to: endOfMonth(now),
    };
  });
  const [selectedTeam, setSelectedTeam] = useState<UserRole | 'all'>('CR');
  const [specificUserId, setSpecificUserId] = useState<string | 'all'>('all'); // New state for specific user filter

  const isAdminView = useMemo(() => {
    if (!currentUser) return false;
    return ['SYSTEM_ADMIN', 'ADMIN'].includes(currentUser.role);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && !isAdminView && (isDrRole(currentUser.role) || currentUser.role === 'LR' || currentUser.role === 'CO')) {
      setSelectedTeam(currentUser.role);
    }
  }, [currentUser, isAdminView]);

  const specificUserOptions = useMemo(() => {
    let filtered = allUsers.filter(u => !u.isBanned);
    if (selectedTeam !== 'all') {
      filtered = filtered.filter(u => roleInTeam(u.role, selectedTeam));
    } else {
      filtered = filtered.filter(u => u.role === 'CR' || isDrRole(u.role) || u.role === 'LR' || u.role === 'CO');
    }
    return filtered;
  }, [allUsers, selectedTeam]);

  const { teamPerformanceData, totalPerformanceTarget } = useMemo(() => {
    if (!teamPerformanceDateRange?.from || !globalSettings?.roleBasedTargets) {
      return { teamPerformanceData: [], totalPerformanceTarget: 0 };
    }

    const startDate = startOfDay(teamPerformanceDateRange.from);
    const endDate = endOfDay(teamPerformanceDateRange.to || teamPerformanceDateRange.from);
    const roleBasedTargets = globalSettings.roleBasedTargets;

    let usersToInclude = allUsers.filter(u => !u.isBanned);
    if (isAdminView) {
      if (specificUserId !== 'all') {
        usersToInclude = allUsers.filter(u => u.id === specificUserId);
      } else if (selectedTeam !== 'all') {
        usersToInclude = allUsers.filter(u => roleInTeam(u.role, selectedTeam));
      }
    } else if (currentUser) {
      usersToInclude = allUsers.filter(u => u.role === currentUser.role && !u.isBanned);
    }

    const numDaysInRange = differenceInDays(endDate, startDate) + 1;
    const currentMonthStartDate = startOfMonth(startDate);
    const previousMonthStartDate = subMonths(currentMonthStartDate, 1);
    const previousMonthEndDate = endOfMonth(previousMonthStartDate);

    // Calculate previous month's total sales
    const previousMonthSales = allTasks.filter(task => {
      const taskDate = parseISO(task.date);
      return isWithinInterval(taskDate, { start: previousMonthStartDate, end: previousMonthEndDate });
    }).reduce((sum, task) => sum + task.taskCount, 0);

    // New target is previous month's sales + 10
    const dynamicTarget = previousMonthSales + 10;

    let totalTarget = 0;

    if (isAdminView) {
      if (specificUserId !== 'all') {
        const user = usersToInclude[0];
        if (user) {
          const monthlyTarget = roleBasedTargets[user.role as keyof typeof roleBasedTargets] || 0;
          totalTarget = (monthlyTarget / getDaysInMonth(startDate)) * numDaysInRange;
        }
      } else if (selectedTeam === 'all') {
        totalTarget = (allUsers.filter(u => u.role === 'CR' && !u.isBanned).length * roleBasedTargets.CR) +
          (allUsers.filter(u => isDrRole(u.role) && !u.isBanned).length * roleBasedTargets.DR_TEAM) +
          roleBasedTargets.LR;
      } else if (selectedTeam === 'LR') {
        totalTarget = roleBasedTargets.LR;
      } else {
        totalTarget = usersToInclude.length * (roleBasedTargets[selectedTeam as keyof typeof roleBasedTargets] || 0);
      }
    } else if (currentUser) {
      if (currentUser.role === 'LR') {
        totalTarget = roleBasedTargets.LR;
      } else {
        totalTarget = roleBasedTargets[currentUser.role as keyof typeof roleBasedTargets] || 0;
      }
    }

    const monthlyTotalTarget = totalTarget;
    totalTarget = Math.round((monthlyTotalTarget / getDaysInMonth(startDate)) * numDaysInRange);

    const dateMap = new Map<string, { totalDone: number; userData: { [userId: string]: { done: number; role: UserRole } } }>();

    let currentDate = startDate;
    while (currentDate <= endDate) {
      dateMap.set(format(currentDate, 'd MMM'), { totalDone: 0, userData: {} });
      currentDate = addDays(currentDate, 1);
    }

    allTasks.forEach(entry => {
      try {
        const entryDate = parseISO(entry.date);
        if (isWithinInterval(entryDate, { start: startDate, end: endDate }) && usersToInclude.some(u => u.id === entry.userId)) {
          const dateKey = format(entryDate, 'd MMM');
          const dayData = dateMap.get(dateKey);
          if (dayData) {
            dayData.totalDone += entry.taskCount;
            if (!dayData.userData[entry.userId]) {
              dayData.userData[entry.userId] = { done: 0, role: entry.role };
            }
            dayData.userData[entry.userId].done += entry.taskCount;
          }
        }
      } catch (e) { /* ignore invalid dates */ }
    });

    const finalData = Array.from(dateMap.entries()).map(([date, data]) => ({
      name: date,
      ...data,
      totalTarget: Math.round(dynamicTarget / numDaysInRange), // Distribute target evenly for graph
    }));

    return { teamPerformanceData: finalData, totalPerformanceTarget: Math.round(dynamicTarget * numDaysInRange / getDaysInMonth(startDate)) };

  }, [allTasks, allUsers, teamPerformanceDateRange, globalSettings, selectedTeam, specificUserId, currentUser, isAdminView]);


  useEffect(() => {
    if (selectedPredefinedValue === 'today' || selectedPredefinedValue === 'yesterday') {
      setChartGranularity('hourly');
    } else if (selectedPredefinedValue === 'thisYear' || selectedPredefinedValue === 'lastYear') {
      setChartGranularity('monthly');
    } else if (selectedPredefinedValue === 'custom' && selectedDateRange?.from && selectedDateRange?.to) {
      const days = differenceInDays(selectedDateRange.to, selectedDateRange.from);
      if (days > 31) {
        setChartGranularity('monthly');
      } else {
        setChartGranularity('daily');
      }
    } else {
      // For thisMonth, lastMonth, last7Days, last30Days
      setChartGranularity('daily');
    }
  }, [selectedPredefinedValue, selectedDateRange]);

  const handleDateRangeChange = (range: DateRange | undefined, label: string, predefined: PredefinedRange | "custom" | null) => {
    setSelectedDateRange(range);
    setCurrentDateRangeLabel(label);
    setSelectedPredefinedValue(predefined);
  };

  const handleTeamPerformanceDateRangeChange = (range: DateRange | undefined, label: string, predefined: PredefinedRange | "custom" | null) => {
    setTeamPerformanceDateRange(range);
  };

  const handleTeamChange = (team: UserRole | 'all') => {
    setSelectedTeam(team);
    setSpecificUserId('all'); // Reset specific user when team changes
  };

  const handleSpecificUserChange = (userId: string) => {
    setSpecificUserId(userId);
    if (userId !== 'all') {
      const user = allUsers.find(u => u.id === userId);
      if (user) {
        setSelectedTeam(user.role);
      }
    } else {
      setSelectedTeam('all');
    }
  }

  const isSystemAdmin = useMemo(() => currentUser?.role === 'SYSTEM_ADMIN', [currentUser]);
  const isCrm = useMemo(() => currentUser?.role === 'CR', [currentUser]);
  const isDr = useMemo(() => (currentUser && isDrRole(currentUser.role)), [currentUser]);

  const hideFinancials = useMemo(() => {
    if (!currentUser || !globalSettings) return false;
    const allowedRoles = globalSettings.rolesAllowedToViewFinancials || ['ADMIN', 'SYSTEM_ADMIN'];
    return !allowedRoles.includes(currentUser.role);
  }, [currentUser, globalSettings]);

  const summaryCardDefinitions = useMemo(() => {
    const showAmount = isSystemAdmin && displayMode === 'amount';

    return [
      { 
        title: isDr ? "Designed" : (isCrm ? "Sales" : "Total Sales"), 
        value: showAmount ? formatCurrency(totalSales) : salesCount.toString(), 
        icon: ShoppingCart, iconColorClass: "text-blue-600", circleBgClass: "bg-blue-100 dark:bg-blue-500/20", isLoading: isLoadingData, currentUser, hideValue: hideFinancials 
      },
      {
        title: "Total Quotation",
        value: showAmount ? formatCurrency(quotationAmount) : quotationCount.toString(),
        icon: ClipboardList, iconColorClass: "text-fuchsia-600", circleBgClass: "bg-fuchsia-100 dark:bg-fuchsia-500/20", isLoading: isLoadingData, roles: ['SYSTEM_ADMIN', 'ADMIN', 'CR'], currentUser, hideValue: hideFinancials
      },
      {
        title: "Invoice due", 
        value: showAmount ? formatCurrency(invoiceDue) : ordersWithDueCount.toString(), 
        icon: FileText, iconColorClass: "text-amber-600", circleBgClass: "bg-amber-100 dark:bg-amber-500/20", isLoading: isLoadingData, currentUser, hideValue: hideFinancials 
      },
      { 
        title: "Advance Paid", 
        value: showAmount ? formatCurrency(invoicePaid) : invoicePaidCount.toString(), 
        icon: Receipt, iconColorClass: "text-teal-600", circleBgClass: "bg-teal-100 dark:bg-teal-500/20", isLoading: isLoadingData, roles: ['SYSTEM_ADMIN', 'ADMIN', 'CR'], currentUser, hideValue: hideFinancials 
      },
      { 
        title: "Due Payment Collection", 
        value: showAmount ? formatCurrency(dueCollection) : dueCollectionCount.toString(), 
        icon: Wallet, iconColorClass: "text-orange-600", circleBgClass: "bg-orange-100 dark:bg-orange-500/20", isLoading: isLoadingData, roles: ['SYSTEM_ADMIN', 'ADMIN', 'CR'], currentUser, hideValue: hideFinancials 
      },
      { 
        title: "Discount",
        value: showAmount ? formatCurrency(discountAmount) : discountCount.toString(),
        icon: BadgePercent, iconColorClass: "text-violet-600", circleBgClass: "bg-violet-100 dark:bg-violet-500/20", isLoading: isLoadingData, roles: ['SYSTEM_ADMIN', 'ADMIN'], currentUser, hideValue: hideFinancials },
      { 
        title: "Repeat Sales", 
        value: showAmount ? formatCurrency(repeatSalesAmount) : repeatSalesCount.toString(), 
        icon: Undo2, iconColorClass: "text-rose-600", circleBgClass: "bg-rose-100 dark:bg-rose-500/20", isLoading: isLoadingData, roles: ['SYSTEM_ADMIN', 'ADMIN'], currentUser, hideValue: hideFinancials 
      },
      {
        title: "Expense",
        value: showAmount ? formatCurrency(totalExpenses) : totalExpensesCount.toString(),
        icon: Receipt, iconColorClass: "text-red-600", circleBgClass: "bg-red-100 dark:bg-red-500/20", isLoading: isLoadingData, roles: ['SYSTEM_ADMIN', 'ADMIN'], currentUser, hideValue: hideFinancials
      },
      {
        title: "Net Profits", 
        value: showAmount ? formatCurrency(netValue) : salesCount.toString(), 
        icon: BadgeDollarSign, iconColorClass: "text-indigo-600", circleBgClass: "bg-indigo-100 dark:bg-indigo-500/20", isLoading: isLoadingData, roles: ['SYSTEM_ADMIN', 'ADMIN'], currentUser, hideValue: hideFinancials 
      },
      {
        title: "Scheduled Meeting",
        value: scheduledMeetingCount.toString(),
        icon: CalendarClock, iconColorClass: "text-sky-600", circleBgClass: "bg-sky-100 dark:bg-sky-500/20", isLoading: isLoadingData, roles: ['SYSTEM_ADMIN', 'ADMIN', 'CR'], currentUser
      },
      { 
        title: "Delivered", 
        value: deliveredCount, 
        icon: PackageCheck, iconColorClass: "text-lime-600", circleBgClass: "bg-lime-100 dark:bg-lime-500/20", isLoading: isLoadingData, roles: ['CR', ...DR_ROLES], currentUser 
      },
      {
        title: "Project Complete",
        value: projectCounts['Project Complete'].toString(),
        icon: CheckCircle2, iconColorClass: "text-green-600", circleBgClass: "bg-green-100 dark:bg-green-500/20", isLoading: isLoadingData, roles: ['SYSTEM_ADMIN', 'ADMIN', 'CR'], currentUser
      },
      {
        title: "Project Delivered",
        value: projectCounts['Project Delivered'].toString(),
        icon: Handshake, iconColorClass: "text-emerald-600", circleBgClass: "bg-emerald-100 dark:bg-emerald-500/20", isLoading: isLoadingData, roles: ['SYSTEM_ADMIN', 'ADMIN', 'CR'], currentUser
      },
    ];
  }, [isCrm, isSystemAdmin, displayMode, salesCount, totalSales, ordersWithDueCount, invoiceDue, invoicePaid, invoicePaidCount, invoiceCodPaid, invoiceCodPaidCount, deliveredCount, netValue, totalPurchase, totalPurchaseCount, isLoadingData, currentUser, hideFinancials, invoicePayment, invoicePaymentCount, dueCollection, dueCollectionCount, totalExpenses, totalExpensesCount, giftValue, giftCount, discountAmount, discountCount, repeatSalesAmount, repeatSalesCount, scheduledMeetingCount, projectCounts, quotationAmount, quotationCount]);

  const summaryCardData = useMemo(() => {
    return summaryCardDefinitions.filter(card => {
      if (currentUser?.role === 'CR' && card.title === 'Total Quotation') return false;
      if (!card.roles) return true;
      return card.roles.includes(currentUser?.role || '');
    });
  }, [currentUser, summaryCardDefinitions]);

  const selectedCrmName = useMemo(() => {
    if (selectedCrmId === 'all') return "All CRs";
    return allCrmUsers.find(u => u.id === selectedCrmId)?.name || "Select CR";
  }, [selectedCrmId, allCrmUsers]);

  const showAmount = isSystemAdmin && displayMode === 'amount';
  const chartDataKey = showAmount ? 'sales' : 'orders';

  const canSeeAdminCharts = useMemo(() => {
    if (!currentUser) return false;
    return ['SYSTEM_ADMIN', 'ADMIN'].includes(currentUser.role);
  }, [currentUser]);

  const canSeeSystemAdminCharts = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'SYSTEM_ADMIN';
  }, [currentUser]);


  const CustomTooltipContent = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <div className="grid grid-cols-1 gap-2">
            <div className="flex flex-col">
              <span className="text-[0.70rem] uppercase text-muted-foreground">
                {chartGranularity === 'hourly' ? 'Time' : 'Date'}
              </span>
              <span className="font-bold text-muted-foreground">
                {label ? (
                  chartGranularity === 'hourly' ?
                    (() => {
                      const hour = parseInt(label);
                      if (isNaN(hour)) return label;
                      if (hour === 0) return '12 AM';
                      if (hour === 12) return '12 PM';
                      if (hour < 12) return `${hour} AM`;
                      return `${hour - 12} PM`;
                    })()
                    : (() => {
                        try {
                          // Handle yyyy-MM or yyyy-MM-dd
                          const dateStr = (chartGranularity === 'monthly' && label.length === 7) ? `${label}-01` : label;
                          const date = parseISO(dateStr);
                          if (!isValid(date)) return label;
                          return format(date, chartGranularity === 'monthly' ? 'MMMM yyyy' : 'd MMM, yyyy');
                        } catch (e) {
                          return label;
                        }
                      })()
                ) : 'N/A'}
              </span>
            </div>
            {payload.map((p: any) => {
              let labelText = p.name || p.dataKey;
              if (p.dataKey === 'sales') {
                labelText = showAmount ? `Sales (${p.payload.orders} orders)` : 'Sales';
              } else if (p.dataKey === 'orders') {
                labelText = 'Sales Count';
              } else if (p.dataKey === 'expenses' || p.dataKey === 'expenseCount') {
                labelText = 'Expenses';
              }
              const formattedValue = p.dataKey === 'sales' || p.dataKey === 'expenses' ? formatCurrency(p.value as number) : p.value;
              return (
                <div key={p.dataKey} className="flex flex-col">
                  <span className="text-[0.70rem] uppercase text-muted-foreground" style={{ color: p.color }}>
                    {labelText}
                  </span>
                  <span className="font-bold" style={{ color: p.color }}>
                    {formattedValue}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  const isLoadingContent = isLoadingData || !selectedDateRange || !globalSettings;

  const canSelectCR = currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN';

  const visibleProjectStatusDisplayConfig = useMemo(() => {
    if (isLoadingContent || !currentUser || !globalSettings?.projectStageAccess) {
      return [];
    }
    // If user is System Admin, show all configured stages
    if (currentUser.role === 'SYSTEM_ADMIN') {
      return ALL_PROJECT_STATUSES_CONFIG;
    }
    // For all other roles, filter based on their permissions
    const userPermissions = globalSettings.projectStageAccess;
    return ALL_PROJECT_STATUSES_CONFIG.filter(column =>
      userPermissions[column.status as ProjectStatusType]?.includes(currentUser.role)
    );
  }, [currentUser, globalSettings, isLoadingContent]);

  const salesPerformanceOrders = useMemo(() => {
    if (currentUser?.role === 'CR') {
      return allOrders.filter(order => order.crmUserId === currentUser.id);
    }
    if ((currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.role === 'ADMIN') && selectedCrmId !== 'all') {
      return allOrders.filter(order => order.crmUserId === selectedCrmId);
    }
    return allOrders;
  }, [allOrders, currentUser, selectedCrmId]);

  const recentFeedback = useMemo(() => {
    if (!allFeedback || !currentUser) return [];

    let filteredByRole = allFeedback;
    if (currentUser.role === 'CR') {
      filteredByRole = allFeedback.filter(feedback => feedback.crmUserId === currentUser.id);
    } else if (isDrRole(currentUser.role)) {
      filteredByRole = allFeedback.filter(feedback => feedback.designerRepresentativeId === currentUser.id);
    }

    return filteredByRole
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .slice(0, 5);
  }, [allFeedback, currentUser]);

  const userMap = useMemo(() => new Map(allUsers.map(u => [u.id, u])), [allUsers]);

  const renderFeedbackText = (text: string) => {
    try {
      const feedbackJson = JSON.parse(text);
      const role = currentUser?.role;

      const fieldsToShow: string[] = [];

      if (role === 'CR') {
        fieldsToShow.push('Customer Service', 'ওপেন ফিডব্যাক');
      } else if (role === 'LR') {
        fieldsToShow.push('Printing Quality', 'Product Quality', 'ওপেন ফিডব্যাক');
      } else if (isDrRole(role)) {
        fieldsToShow.push('Design Satisfaction', 'ওপেন ফিডব্যাক');
      } else {
        // Admins/System Admins see the raw text
        return `"${text}"`;
      }

      const filteredFeedback = Object.entries(feedbackJson)
        .filter(([key]) => fieldsToShow.some(field => key.includes(field)))
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | ');

      return filteredFeedback ? `"${filteredFeedback}"` : <span className="italic text-muted-foreground">No relevant feedback for your role.</span>;

    } catch (e) {
      // Fallback for non-JSON or malformed JSON text
      return `"${text}"`;
    }
  };

  const handleDeleteFeedback = async () => {
    if (!feedbackToDelete || !feedbackToDelete.id) {
      toast({ title: "Error", description: "Invalid feedback ID.", variant: "destructive" });
      setFeedbackToDelete(null);
      return;
    }
    setIsDeletingFeedback(true);
    const result = await deleteFeedbackAction(feedbackToDelete.id);
    if (result.success) {
      toast({ title: "Feedback Deleted", description: "The feedback entry has been removed." });
      refetch();
    } else {
      toast({ title: "Error", description: result.error || "Could not delete feedback.", variant: "destructive" });
    }
    setIsDeletingFeedback(false);
    setFeedbackToDelete(null);
  };

  const canDeleteFeedback = useMemo(() => {
    if (!currentUser) return false;
    return ['SYSTEM_ADMIN', 'ADMIN'].includes(currentUser.role);
  }, [currentUser]);

  const renderTodayScheduleCard = () => <TodayScheduleCard leads={todayScheduledLeads} isLoading={isLoadingData} />;

  const renderTrafficSourcesCard = () => {
    const newLeadsSummary = (
      <div className="relative isolate w-full translate-x-4 -translate-y-3 overflow-hidden rounded-2xl rounded-tl-none rounded-br-none border border-white/15 bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 p-4 font-sans text-white shadow-lg shadow-blue-600/15 sm:w-[200px] sm:shrink-0 sm:translate-x-6 sm:-translate-y-4">
        <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" aria-hidden="true" />
        <div className="relative flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-blue-50">Total New Leads</p>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/20">
            <Users className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        {isLoadingContent ? <Skeleton className="mt-1 h-9 w-14 bg-white/20" /> : (
          <p className="relative mt-1 text-3xl font-semibold leading-tight tracking-tight tabular-nums">{totalNewLeads.toLocaleString()}</p>
        )}
        <p className="relative mt-1 text-[11px] text-blue-50/90">Added in selected period</p>
      </div>
    );

    return (
      <Card className={cn("shadow-xl bg-card rounded-2xl sm:rounded-lg border-none sm:border overflow-hidden flex flex-col w-full", isCrm && "h-full min-h-[380px] sm:min-h-[420px]")}>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0 bg-muted/5 sm:bg-transparent px-4 py-3 sm:px-6 sm:py-4 shrink-0">
          <CardTitle className="flex items-center text-lg sm:text-xl font-bold tracking-tight text-foreground">
            <div className="p-2 bg-primary/10 rounded-lg mr-3 sm:hidden">
              <PieChartIcon className="h-5 w-5 text-primary" />
            </div>
            <span className="hidden sm:inline-flex items-center">
              <PieChartIcon className="mr-2 h-6 w-6 text-primary" />
            </span>
            Traffic Sources
          </CardTitle>
          {newLeadsSummary}
        </CardHeader>
        <CardContent className={cn("p-2 sm:p-4 sm:-mb-20 flex flex-col justify-center min-h-0", isCrm ? "flex-1 min-h-[300px] sm:min-h-[340px]" : "min-h-[300px] py-4")}>
          {isLoadingContent ? (
            <div className="flex items-center justify-center h-full">
              <Skeleton className={cn(isCrm ? "h-64 w-64" : "h-36 w-36", "rounded-full")} />
            </div>
          ) : trafficSourcesData.length > 0 ? (
            <DonutChart data={trafficSourcesData.map((d) => ({ name: d.name, value: d.value, color: TRAFFIC_SOURCE_COLORS[d.name] }))} showLeadPercentage centerLabel="" className="-translate-y-6 sm:-translate-y-20" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 h-full text-muted-foreground">
              <p>No lead source data available.</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderRecentFeedbackCard = () => {
    return (
      <Card className="bg-card/95 border-none sm:border border-border/30 shadow-xl sm:shadow-lg rounded-2xl sm:rounded-lg overflow-hidden group relative">
        {/* Premium background highlight for mobile */}
        <div className="absolute inset-0 opacity-[0.02] sm:hidden bg-gradient-to-br from-primary via-transparent to-primary pointer-events-none" />

        <CardHeader className="p-4 sm:p-6 pb-0 sm:pb-6 relative z-10">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="p-2.5 bg-primary/10 rounded-xl sm:hidden">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
                <span className="hidden sm:inline"><MessageSquare className="mr-2 h-6 w-6 text-primary" /></span>
                Recent Feedback
              </CardTitle>
              <CardDescription className="font-sans text-[13px] leading-relaxed text-foreground/65 line-clamp-1 sm:line-clamp-none">Latest client feedback from tracking pages.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-2 sm:pt-6 relative z-10">
          {isLoadingContent ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : recentFeedback.length > 0 ? (
            <ScrollArea className="h-[400px] pr-3 -mr-3 sm:mr-0 sm:pr-3">
              <div className="space-y-0 sm:space-y-4">
                {recentFeedback.map((feedback, index) => {
                  const crmUser = userMap.get(feedback.crmUserId || '');
                  return (
                    <div
                      key={feedback.id}
                      className={cn(
                        "py-5 sm:p-4 transition-colors",
                        "sm:border sm:rounded-lg sm:bg-secondary/30",
                        "border-none bg-transparent rounded-none",
                        index !== recentFeedback.length - 1 && "border-b border-border/40 sm:border-none"
                      )}
                      onDoubleClick={canDeleteFeedback ? () => setFeedbackToDelete(feedback) : undefined}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 sm:h-10 sm:w-10 border-2 border-primary/10">
                            <AvatarImage src={crmUser?.avatarUrl || undefined} alt={crmUser?.name} />
                            <AvatarFallback className="bg-primary/5 text-primary text-xs">{getInitials(crmUser?.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-bold sm:font-semibold text-foreground text-sm sm:text-base leading-tight">
                              {feedback.companyName}
                            </p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Order ID: {feedback.orderId}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 text-amber-500 scale-90 sm:scale-100 origin-right">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={cn("h-3.5 w-3.5", i < feedback.rating ? "fill-amber-400 text-amber-400" : "fill-muted stroke-muted-foreground/30")}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 relative">
                        <p className="text-sm text-foreground/80 sm:text-foreground/90 italic border-l-2 border-primary/40 pl-4 py-0.5 leading-relaxed">
                          {renderFeedbackText(feedback.text)}
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-3">
                        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-tighter">
                          {format(parseISO(feedback.submittedAt), "d MMM, yyyy")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground/50">
              <div className="p-4 bg-muted/20 rounded-full mb-4">
                <MessageSquare className="h-10 w-10 opacity-20" />
              </div>
              <p className="font-medium text-sm">No feedback yet.</p>
            </div>
          )}
        </CardContent>

        {/* Decorative background icon for mobile */}
        <div className="absolute -right-8 -bottom-8 opacity-[0.03] sm:hidden pointer-events-none transform rotate-12 scale-150">
          <MessageSquare className="h-32 w-32 text-primary" />
        </div>
      </Card>
    );
  };

  return (
    <>
      <div className="space-y-6 px-1.5 py-4 sm:p-6 lg:p-8 custom-scrollbar-hidden print:p-0">
        <div className="relative isolate overflow-hidden bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.28),transparent_55%),linear-gradient(115deg,#312e81_0%,#1d4ed8_55%,#0e7490_100%)] text-white p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl shadow-lg shadow-indigo-950/15 ring-1 ring-inset ring-white/10 print:hidden">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold flex items-center tracking-tight">
            Welcome {formatDisplayName(currentUser?.name)}
            <Hand className="ml-1.5 sm:ml-2 h-5 w-5 sm:h-7 sm:w-7 md:h-8 md:w-8 transform rotate-[20deg] text-yellow-300 shrink-0" />
          </h1>
          <p className="text-xs sm:text-sm md:text-base lg:text-lg text-blue-50 mt-0.5 sm:mt-1">
            Here&apos;s an overview of your business activity.
          </p>
        </div>

        {currentUser?.role === 'SW' && scriptWriterSummary && (
          <div className="space-y-4 print:hidden">
            <Card className="shadow-sm bg-card rounded-xl sm:rounded-lg">
              <CardContent className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><CalendarDays className="h-4 w-4 text-primary" />Script assignments</span>
                {selectedDateRange ? <DateRangePicker initialRange={selectedDateRange} onDateRangeChange={handleDateRangeChange} /> : <Skeleton className="h-10 w-[200px]" />}
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <SummaryCard title="Total Assigned" value={scriptWriterSummary.totalAssigned.toLocaleString()} icon={ClipboardList} iconColorClass="text-blue-600" circleBgClass="bg-blue-100 dark:bg-blue-500/20" isLoading={isLoadingContent} currentUser={currentUser} />
              <SummaryCard title="Scripts Completed" value={scriptWriterSummary.completed.toLocaleString()} icon={FileCheck} iconColorClass="text-violet-600" circleBgClass="bg-violet-100 dark:bg-violet-500/20" isLoading={isLoadingContent} currentUser={currentUser} />
              <SummaryCard title="SLA Breach" value={scriptWriterSummary.slaBreach.toLocaleString()} icon={AlertTriangle} iconColorClass="text-red-600" circleBgClass="bg-red-100 dark:bg-red-500/20" isLoading={isLoadingContent} currentUser={currentUser} />
              <SummaryCard title="On Time" value={scriptWriterSummary.onTime.toLocaleString()} icon={Clock} iconColorClass="text-emerald-600" circleBgClass="bg-emerald-100 dark:bg-emerald-500/20" isLoading={isLoadingContent} currentUser={currentUser} />
            </div>
          </div>
        )}

        {!isDesignerRepOrLrOrCo && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 print:hidden">
              <Card className="shadow-sm bg-card rounded-xl sm:rounded-lg">
                <CardContent className="p-2.5 sm:p-4 flex flex-col sm:flex-row items-center sm:justify-between space-y-2 sm:space-y-0 text-center sm:text-left">
                  <div className="flex items-center text-[10px] sm:text-sm text-muted-foreground font-semibold sm:font-normal uppercase sm:capitalize tracking-wider sm:tracking-normal">
                    <Users className="h-3.5 w-3.5 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 text-primary/80" />
                    <span>Select CR</span>
                  </div>
                  {canSelectCR ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="text-xs h-9 sm:h-10 truncate">
                          {selectedCrmName} <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-70" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Filter by CR</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setSelectedCrmId('all')}>All CRs</DropdownMenuItem>
                        {allCrmUsers.map(crm => (
                          <DropdownMenuItem key={crm.id} onSelect={() => setSelectedCrmId(crm.id)}>
                            {crm.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Button variant="outline" size="sm" className="text-[10px] sm:text-xs h-8 sm:h-10 w-full sm:w-auto" disabled>
                      Your Data
                    </Button>
                  )}
                </CardContent>
              </Card>
              <Card className="shadow-sm bg-card rounded-xl sm:rounded-lg">
                <CardContent className="p-2.5 sm:p-4 flex flex-col sm:flex-row items-center sm:justify-between space-y-2 sm:space-y-0 text-center sm:text-left">
                  <div className="flex items-center text-[10px] sm:text-sm text-muted-foreground font-semibold sm:font-normal uppercase sm:capitalize tracking-wider sm:tracking-normal">
                    <CalendarDays className="h-3.5 w-3.5 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 text-primary/80" />
                    <span>Filter</span>
                  </div>
                  {selectedDateRange ? (
                    <DateRangePicker initialRange={selectedDateRange} onDateRangeChange={handleDateRangeChange} />
                  ) : (
                    <Skeleton className="h-10 w-full sm:w-[260px]" />
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 print:hidden">
              {summaryCardData.map((card) => (
                <SummaryCard
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  icon={card.icon}
                  iconColorClass={card.iconColorClass}
                  circleBgClass={card.circleBgClass}
                  isLoading={isLoadingContent}
                  currentUser={currentUser}
                  hideValue={card.hideValue}
                />
              ))}
            </div>

            {currentUser?.role === 'CR' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start print:hidden">
                {renderTrafficSourcesCard()}
                {renderTodayScheduleCard()}
              </div>
            )}


            <div className="flex flex-col gap-6 print:hidden">
              {currentUser?.role !== 'CR' && (
                <Card className="shadow-xl bg-card rounded-2xl sm:rounded-lg border-none sm:border overflow-hidden w-full">
                  <CardHeader className="border-b bg-muted/5 sm:bg-transparent px-4 py-3 sm:px-6 sm:py-4">
                    <CardTitle className="flex items-center text-lg sm:text-xl font-bold tracking-tight text-foreground">
                      <div className="p-2 bg-primary/10 rounded-lg mr-3 sm:hidden">
                        <BarChartBig className="h-5 w-5 text-primary" />
                      </div>
                      <span className="hidden sm:inline-flex items-center">
                        <BarChartBig className="mr-2 h-6 w-6 text-primary" />
                      </span>
                      Sales ({currentDateRangeLabel})
                      {currentUser?.role === 'CR' && <span className="ml-2 text-xs sm:text-sm font-normal text-muted-foreground">(Your Sales)</span>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[280px] sm:h-[350px] p-1.5 sm:p-4 mt-2">
                    {isLoadingContent ? (
                      <div className="flex items-center justify-center h-full">
                        <Skeleton className="h-full w-full" />
                      </div>
                    ) : (
                      <ChartContainer config={chartConfig} className="w-full h-full">
                        <RechartsLineChart
                          data={salesChartData}
                          margin={{
                            top: 5,
                            right: 20,
                            left: -10,
                            bottom: 0,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.5)" />
                          <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickFormatter={(value) => {
                              if (chartGranularity === 'hourly') {
                                const hour = parseInt(value);
                                if (isNaN(hour)) return value;
                                if (hour === 0) return '12 AM';
                                if (hour === 12) return '12 PM';
                                if (hour < 12) return `${hour} AM`;
                                return `${hour - 12} PM`;
                              }
                              if (chartGranularity === 'monthly') {
                                try {
                                  const dateStr = value.length === 7 ? `${value}-01` : value;
                                  const date = parseISO(dateStr);
                                  if (!isValid(date)) return value;
                                  return format(date, 'MMM');
                                } catch (e) { return value; }
                              }
                              try {
                                const date = parseISO(value);
                                if (!isValid(date)) return value;
                                return format(date, 'd MMM');
                              } catch (e) { return value; }
                            }}
                            className="text-xs"
                            interval={chartGranularity === 'hourly' && salesChartData.length > 12 ? 'preserveStartEnd' : undefined}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickFormatter={(value) => showAmount ? `৳${Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : value}
                            className="text-xs"
                          />
                          <ChartTooltip
                            cursor={false}
                            content={<CustomTooltipContent />}
                          />
                          <RechartsLegend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ padding: '10px' }} />
                          <Line
                            dataKey={chartDataKey}
                            name={chartDataKey === 'sales' ? 'Sales' : 'Sales'}
                            type="monotone"
                            stroke="var(--color-sales)"
                            strokeWidth={2}
                            dot={{
                              r: 4,
                              fill: "var(--color-sales)",
                              strokeWidth: 2,
                              stroke: "hsl(var(--background))",
                            }}
                            activeDot={{
                              r: 6,
                              fill: "var(--color-sales)",
                              strokeWidth: 2,
                              stroke: "hsl(var(--background))",
                            }}
                          />
                          <Line
                            dataKey={showAmount ? 'expenses' : 'expenseCount'}
                            name="Expenses"
                            type="monotone"
                            stroke="var(--color-expenses)"
                            strokeWidth={2}
                            dot={{
                              r: 4,
                              fill: "var(--color-expenses)",
                              strokeWidth: 2,
                              stroke: "hsl(var(--background))",
                            }}
                            activeDot={{
                              r: 6,
                              fill: "var(--color-expenses)",
                              strokeWidth: 2,
                              stroke: "hsl(var(--background))",
                            }}
                          />
                        </RechartsLineChart>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {currentUser?.role !== 'CR' && renderTrafficSourcesCard()}

                {canSeeSystemAdminCharts && (
                  <Card className="shadow-xl bg-card rounded-2xl sm:rounded-lg border-none sm:border overflow-hidden flex flex-col">
                    <CardHeader className="bg-muted/5 sm:bg-transparent px-4 py-3 sm:px-6 sm:py-4 shrink-0">
                      <CardTitle className="flex items-center text-lg sm:text-xl font-bold tracking-tight text-foreground">
                        <div className="p-2 bg-primary/10 rounded-lg mr-3 sm:hidden">
                          <Landmark className="h-5 w-5 text-primary" />
                        </div>
                        <span className="hidden sm:inline-flex items-center">
                          <Landmark className="mr-2 h-6 w-6 text-primary" />
                        </span>
                        Payments
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[220px] sm:h-[250px] lg:h-auto lg:min-h-[300px] lg:flex-1 p-2 sm:p-4">
                      {isLoadingContent ? (
                        <Skeleton className="h-[200px] w-full" />
                      ) : paymentMethodData.length > 0 ? (
                        <div className="h-full max-h-[220px] sm:max-h-[250px] lg:max-h-[300px] overflow-y-auto">
                        <ChartContainer config={paymentMethodsChartConfig} className="w-full aspect-auto" style={{ height: Math.max(200, paymentMethodData.length * 44) }}>
                          <RechartsBarChart data={paymentMethodData} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                            <YAxis dataKey="name" type="category" interval={0} tick={<LeftAlignedTick />} width={145} stroke="hsl(var(--border))" axisLine={false} tickLine={false} />
                            <XAxis type="number" hide />
                            <ChartTooltip
                              cursor={{ fill: 'hsl(var(--muted))' }}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                                      <div className="grid grid-cols-1 gap-1.5">
                                        <span className="text-sm font-bold text-foreground">{payload[0].payload.name}</span>
                                        {showAmount ? (
                                          <span className="text-xs text-muted-foreground">Amount: {formatCurrency(payload[0].payload.amount)}</span>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">Count: {payload[0].payload.count}</span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="percentage" fill="var(--color-count)" radius={[0, 8, 8, 0]} barSize={22}>
                              <LabelList
                                dataKey="percentage"
                                position="right"
                                offset={8}
                                className="font-sans fill-foreground text-xs font-medium tabular-nums"
                                formatter={(value: number) => `${value.toFixed(1)}%`}
                              />
                            </Bar>
                          </RechartsBarChart>
                        </ChartContainer>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          No payment data for this period.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

              </div>
            </div>
          </>
        )}

        {(canSeeSystemAdminCharts || canSeeAdminCharts) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 print:hidden">
          {canSeeSystemAdminCharts && (
            <SalesPerformanceClient
              allOrders={allYearOrders.length > 0 ? allYearOrders : allOrders}
              allCrmUsers={allUsers}
              displayMode={displayMode}
            />
          )}
          {canSeeAdminCharts && (
            <OrderAnalysisClient allOrders={allYearOrders.length > 0 ? allYearOrders : allOrders} />
          )}
        </div>
        )}



        {(!isDesignerRepOrLrOrCo || currentUser?.role === 'SW') && (
          <div className={cn("grid grid-cols-1 gap-6 !mt-1.5 print:hidden", currentUser?.role === 'SW' ? 'lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start' : !(currentUser && isDrRole(currentUser.role)) && currentUser?.role !== 'VENDOR' && currentUser?.role !== 'LR' ? 'xl:grid-cols-2' : 'xl:grid-cols-1')}>
            {currentUser?.role === 'SW' && <TimeTrackerCard key={currentUser.id} userId={currentUser.id} />}
            {currentUser?.role === 'SW' && scriptWriterSummary && (
              <div className="min-w-0">
                <ScriptAssignmentChart projects={allProjects} orders={allYearOrders} userId={currentUser.id} now={summaryNow} isLoading={isLoadingContent} />
              </div>
            )}

            <Card className={cn("bg-card/95 border-none sm:border border-border/30 shadow-xl sm:shadow-lg rounded-2xl sm:rounded-lg overflow-hidden group relative", currentUser?.role === 'SW' && 'lg:col-span-2')}>
              {/* Premium background highlight for mobile */}
              <div className="absolute inset-0 opacity-[0.02] sm:hidden bg-gradient-to-br from-primary via-transparent to-primary pointer-events-none" />

              <CardHeader className="p-4 sm:p-6 pb-0 sm:pb-6 relative z-10">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="p-2.5 bg-primary/10 rounded-xl sm:hidden">
                    <Briefcase className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
                      <span className="hidden sm:inline"><Briefcase className="mr-2 h-6 w-6 text-primary" /></span>
                      Project Overview
                    </CardTitle>
                    <CardDescription className="font-sans text-[13px] leading-relaxed text-foreground/65 line-clamp-1 sm:line-clamp-none">Project distribution by status for the selected period.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-2 sm:pt-6 relative z-10">
                <StatusTimeline
                  counts={projectCounts}
                  config={visibleProjectStatusDisplayConfig}
                  isLoading={isLoadingContent}
                  title="Project Status"
                />
              </CardContent>
              {/* Decorative background icon for mobile */}
              <div className="absolute -right-8 -bottom-8 opacity-[0.03] sm:hidden pointer-events-none transform rotate-12 scale-150">
                <Briefcase className="h-32 w-32 text-primary" />
              </div>
            </Card>

            {!(currentUser && isDrRole(currentUser.role)) && currentUser?.role !== 'VENDOR' && currentUser?.role !== 'LR' && (
              <Card className="bg-card/95 border-none sm:border border-border/30 shadow-xl sm:shadow-lg rounded-2xl sm:rounded-lg overflow-hidden group relative">
                {/* Premium background highlight for mobile */}
                <div className="absolute inset-0 opacity-[0.02] sm:hidden bg-gradient-to-br from-primary via-transparent to-primary pointer-events-none" />

                <CardHeader className="p-4 sm:p-6 pb-0 sm:pb-6 relative z-10">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="p-2.5 bg-primary/10 rounded-xl sm:hidden">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
                        <span className="hidden sm:inline"><Users className="mr-2 h-6 w-6 text-primary" /></span>
                        Pipeline Overview
                      </CardTitle>
                      <CardDescription className="font-sans text-[13px] leading-relaxed text-foreground/65 line-clamp-1 sm:line-clamp-none">Lead distribution by category for the selected period.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-2 sm:pt-6 relative z-10">
                  <StatusTimeline
                    counts={leadCategoryCounts}
                    config={ALL_LEAD_CATEGORIES_CONFIG}
                    isLoading={isLoadingContent}
                    title="Lead Category"
                  />
                </CardContent>
                {/* Decorative background icon for mobile */}
                <div className="absolute -right-8 -bottom-8 opacity-[0.03] sm:hidden pointer-events-none transform rotate-12 scale-150">
                  <Users className="h-32 w-32 text-primary" />
                </div>
              </Card>
            )}
          </div>
        )}

      </div>

      {feedbackToDelete && (
        <AlertDialog open={!!feedbackToDelete} onOpenChange={() => setFeedbackToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                Delete Feedback?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete the feedback for order <span className="font-semibold">{feedbackToDelete.orderId}</span>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setFeedbackToDelete(null)} disabled={isDeletingFeedback}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteFeedback} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={isDeletingFeedback}>
                {isDeletingFeedback ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

    </>
  );
}

const DoneTargetTooltipContent = ({ active, payload, label, userMap, currentUser }: any) => {
  if (active && payload && payload.length) {
    const donePayload = payload.find((p: any) => p.dataKey === 'totalDone');
    const targetPayload = payload.find((p: any) => p.dataKey === 'totalTarget');
    const userData = donePayload?.payload?.userData || {};

    let userBreakdown: { user: User, done: number }[] = [];

    if (currentUser) {
      if (currentUser.role === 'SYSTEM_ADMIN' || currentUser.role === 'ADMIN') {
        userBreakdown = Object.entries(userData)
          .map(([userId, data]: [string, any]) => ({ user: userMap.get(userId), done: data.done }))
          .filter(item => item.user && item.done >= 0)
          .sort((a, b) => b.done - a.done) as { user: User, done: number }[];
      } else {
        userBreakdown = Object.entries(userData)
          .filter(([userId, data]: [string, any]) => data.role === currentUser.role && data.done >= 0)
          .map(([userId, data]: [string, any]) => ({ user: userMap.get(userId), done: data.done }))
          .filter(item => item.user)
          .sort((a, b) => b.done - a.done) as { user: User, done: number }[];
      }
    }

    return (
      <div className="rounded-lg border bg-background p-2.5 shadow-sm min-w-[220px]">
        <div className="grid grid-cols-1 gap-1.5">
          <p className="font-semibold text-foreground">{label}</p>
          {donePayload && <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: donePayload.color }}></div>
            <span className="text-sm text-muted-foreground">Tasks Done:</span>
            <span className="text-sm font-medium ml-auto">{donePayload.value}</span>
          </div>}
          {targetPayload && <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: targetPayload.color }}></div>
            <span className="text-sm text-muted-foreground">Target:</span>
            <span className="text-sm font-medium ml-auto">{targetPayload.value}</span>
          </div>}
        </div>
        {userBreakdown.length > 0 && (
          <>
            <div className="border-t border-dashed my-1.5"></div>
            <p className="font-semibold text-xs text-muted-foreground mt-1">Contributors:</p>
            <ScrollArea className="max-h-32 pr-2 -mr-2">
              <div className="space-y-1.5 mt-1">
                {userBreakdown.map(({ user, done }) => (
                  <div key={user.id} className="flex items-center gap-2 text-xs">
                    <Avatar className="h-5 w-5 border">
                      <AvatarImage src={user.avatarUrl || undefined} alt={user.name} />
                      <AvatarFallback className="text-[9px] bg-muted">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground truncate flex-1">{user.name}</span>
                    <span className="font-medium text-foreground">{done} tasks</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    )
  }
  return null;
}

