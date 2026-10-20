

"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, LineChart, AreaChart, Target, Users, CalendarDays, TrendingUp, Printer, User as UserIcon, Download, CheckCircle } from 'lucide-react';
import { Bar, BarChart as RechartsBarChart, Line, Area, AreaChart as RechartsAreaChart, LineChart as RechartsLineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import type { User as UserType, UserRole } from '@/types';
import { cn, formatDisplayName } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { parseISO, startOfDay, isSameDay, getDaysInMonth, startOfMonth, subMonths, format, differenceInDays, endOfDay, isWithinInterval, addDays, endOfMonth, startOfHour, eachHourOfInterval, eachDayOfInterval, eachMonthOfInterval, isValid } from 'date-fns';
import { DateRangePicker, type PredefinedRange } from '@/components/dashboard/date-range-picker';
import type { DateRange } from "react-day-picker";
import { Input } from '@/components/ui/input';
import { Loader2, ChevronsUpDown, Check } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Label } from "@/components/ui/label";
import { addTaskEntryAction } from '@/app/(app)/dashboard/actions';
import { useToast } from '@/hooks/use-toast';
import { getTaskEntries, TaskEntry, getMonthlyTargetHistory, setMonthlyTargetHistory } from '@/lib/team-performance-service';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GlobalSettings } from '@/types';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import Image from 'next/image';
import Papa from 'papaparse';
import { isDrRole, DR_ROLES, roleInTeam } from '@/lib/roles';


interface DailyTargetData {
  name: string;
  totalDone: number;
  totalTarget: number;
  userData: {
    [userId: string]: {
      done: number;
      role: UserRole;
    };
  };
}

interface TeamPerformanceGraphProps {
  allTasks: TaskEntry[];
  allUsers: UserType[]; // Added this prop
  monthlyTargetData: DailyTargetData[];
  totalPerformanceTarget: number;
  selectedDateRange: DateRange | undefined;
  userMap: Map<string, UserType>;
  globalSettings: GlobalSettings | null;
  onDateRangeChange: (range: DateRange | undefined, label: string, predefinedValue: PredefinedRange | "custom" | null) => void;
  onTeamChange?: (team: UserRole | 'all') => void;
  onSpecificUserChange?: (userId: string) => void;
  selectedTeam?: UserRole | 'all';
  specificUserId?: string;
  isAdminView?: boolean;
  refetchData: () => void;
  specificUserOptions: UserType[];
}

const getInitials = (name: string | undefined): string => {
  if (!name) return '??';
  const names = name.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return names[0].charAt(0).toUpperCase() + (names.length > 1 ? names[names.length - 1].charAt(0).toUpperCase() : '');
};


export function TeamPerformanceGraph({
  allTasks,
  allUsers, // Accepting the new prop
  monthlyTargetData: initialMonthlyTargetData,
  totalPerformanceTarget: initialTotalPerformanceTarget,
  selectedDateRange,
  userMap,
  globalSettings,
  onDateRangeChange,
  onTeamChange,
  onSpecificUserChange,
  selectedTeam = 'CR',
  specificUserId = 'all',
  isAdminView,
  refetchData,
  specificUserOptions = [],
}: TeamPerformanceGraphProps) {
  const [chartType, setChartType] = useState<'line'>('line');
  const [tasksDone, setTasksDone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionsTodayCount, setSubmissionsTodayCount] = useState(0);
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [isUserPopoverOpen, setIsUserPopoverOpen] = useState(false);

  const [monthlyTargetData, setMonthlyTargetData] = useState(initialMonthlyTargetData);
  const [totalPerformanceTarget, setTotalPerformanceTarget] = useState(initialTotalPerformanceTarget);
  const [chartGranularity, setChartGranularity] = useState<'hourly' | 'daily' | 'monthly'>('daily');

  // Automatic granularity based on range
  useEffect(() => {
    if (!selectedDateRange?.from || !selectedDateRange?.to) {
      setChartGranularity('daily');
      return;
    }
    const days = differenceInDays(selectedDateRange.to, selectedDateRange.from);
    if (days <= 2) {
      setChartGranularity('hourly');
    } else if (days > 62) {
      setChartGranularity('monthly');
    } else {
      setChartGranularity('daily');
    }
  }, [selectedDateRange]);

  const performanceTitle = useMemo(() => {
    const isCrmTeam = selectedTeam === 'CR' || (specificUserId !== 'all' && userMap.get(specificUserId)?.role === 'CR');
    const isDrTeam = selectedTeam === 'DR_TEAM' || (specificUserId !== 'all' && isDrRole(userMap.get(specificUserId)?.role));
    const isLrTeam = selectedTeam === 'LR' || (specificUserId !== 'all' && userMap.get(specificUserId)?.role === 'LR');
    const isCoTeam = selectedTeam === 'CO' || (specificUserId !== 'all' && userMap.get(specificUserId)?.role === 'CO');
    
    if (isAdminView) {
      if (isCrmTeam) return "Sellers Performance";
      if (isDrTeam) return "Designers Performance";
      if (isLrTeam) return "Logistics Performance";
      if (isCoTeam) return "CO Performance";
      return "Team Performance";
    }
    
    if (currentUser?.role === 'CR') return "My Sales Performance";
    if ((currentUser && isDrRole(currentUser.role))) return "My Design Performance";
    if (currentUser?.role === 'LR') return "Logistics Performance";
    if (currentUser?.role === 'CO') return "My Docs Performance";
    
    return "Team Performance";
  }, [currentUser, isAdminView, selectedTeam, specificUserId, userMap]);


  useEffect(() => {
    if (!allTasks || !selectedDateRange?.from || !globalSettings?.roleBasedTargets) {
      setMonthlyTargetData([]);
      setTotalPerformanceTarget(0);
      return;
    }

    const startDate = startOfDay(selectedDateRange.from);
    const endDate = endOfDay(selectedDateRange.to || selectedDateRange.from);
    const roleBasedTargets = globalSettings.roleBasedTargets;

    let usersToInclude = allUsers.filter(u => userMap.has(u.id) && !u.isBanned);
    if (isAdminView) {
      if (specificUserId !== 'all') {
        usersToInclude = usersToInclude.filter(u => u.id === specificUserId);
      } else if (selectedTeam !== 'all') {
        usersToInclude = usersToInclude.filter(u => roleInTeam(u.role, selectedTeam));
      }
    } else if (currentUser) {
      usersToInclude = allUsers.filter(u => u.role === currentUser.role && !u.isBanned);
    }

    const numDaysInRange = differenceInDays(endDate, startDate) + 1;
    const daysInSelectedMonth = getDaysInMonth(startDate);

    let monthlyTotalTarget = 0;
    if (isAdminView) {
      if (specificUserId !== 'all') {
        const user = usersToInclude[0];
        if (user) {
          monthlyTotalTarget = roleBasedTargets[user.role as keyof typeof roleBasedTargets] || 0;
        }
      } else if (selectedTeam === 'all') {
        monthlyTotalTarget = (allUsers.filter(u => u.role === 'CR').length * roleBasedTargets.CR) +
          (allUsers.filter(u => isDrRole(u.role)).length * roleBasedTargets.DR_TEAM) +
          roleBasedTargets.LR;
      } else if (selectedTeam === 'LR') {
        monthlyTotalTarget = roleBasedTargets.LR;
      } else {
        const countOfUsersInTeam = allUsers.filter(u => roleInTeam(u.role, selectedTeam)).length;
        monthlyTotalTarget = countOfUsersInTeam * (roleBasedTargets[selectedTeam as keyof typeof roleBasedTargets] || 0);
      }
    } else if (currentUser) {
      if (currentUser.role === 'LR') {
        monthlyTotalTarget = roleBasedTargets.LR;
      } else {
        monthlyTotalTarget = roleBasedTargets[currentUser.role as keyof typeof roleBasedTargets] || 0;
      }
    }

    const totalTargetForRange = Math.round((monthlyTotalTarget / daysInSelectedMonth) * numDaysInRange);
    
    let stepTarget = 0;
    let intervals: Date[] = [];

    if (chartGranularity === 'hourly') {
      intervals = eachHourOfInterval({ start: startDate, end: endDate });
      stepTarget = totalTargetForRange / (numDaysInRange * 24);
    } else if (chartGranularity === 'monthly') {
      intervals = eachMonthOfInterval({ start: startOfMonth(startDate), end: endOfMonth(endDate) });
      stepTarget = totalTargetForRange / intervals.length;
    } else {
      intervals = eachDayOfInterval({ start: startDate, end: endDate });
      stepTarget = totalTargetForRange / intervals.length;
    }

    const dateMap = new Map<string, { totalDone: number; userData: { [userId: string]: { done: number; role: UserRole } } }>();

    intervals.forEach(date => {
      let key = '';
      if (chartGranularity === 'hourly') key = format(date, 'yyyy-MM-dd HH:00');
      else if (chartGranularity === 'monthly') key = format(date, 'yyyy-MM');
      else key = format(date, 'yyyy-MM-dd');
      
      dateMap.set(key, { totalDone: 0, userData: {} });
    });

    allTasks.forEach(entry => {
      try {
        const entryDate = parseISO(entry.date);
        if (isWithinInterval(entryDate, { start: startDate, end: endDate }) && usersToInclude.some(u => u.id === entry.userId)) {
          let dateKey = '';
          if (chartGranularity === 'hourly') dateKey = format(startOfHour(entryDate), 'yyyy-MM-dd HH:00');
          else if (chartGranularity === 'monthly') dateKey = format(startOfMonth(entryDate), 'yyyy-MM');
          else dateKey = format(startOfDay(entryDate), 'yyyy-MM-dd');

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
      totalTarget: Math.round(stepTarget),
    }));

    setMonthlyTargetData(finalData);
    setTotalPerformanceTarget(totalTargetForRange);

  }, [allTasks, allUsers, selectedDateRange, globalSettings, selectedTeam, specificUserId, currentUser, isAdminView, userMap, chartGranularity]);



  useEffect(() => {
    if (!currentUser) return;

    const today = new Date();

    let count = 0;
    if (currentUser.role === 'LR') {
      count = allTasks.some(entry => entry.role === 'LR' && isSameDay(parseISO(entry.date), today)) ? 1 : 0;
    } else {
      count = allTasks.filter(entry =>
        entry.userId === currentUser.id && isSameDay(parseISO(entry.date), today)
      ).length;
    }
    setSubmissionsTodayCount(count);

  }, [currentUser, allTasks]);


  const handleDateChange = (range: DateRange | undefined, displayLabel: string, predefinedValue: PredefinedRange | "custom" | null) => {
    onDateRangeChange(range, displayLabel, predefinedValue);
  };

  const handleDoneClick = async () => {
    if (!currentUser) {
      toast({ title: "Error", description: "You must be logged in to submit tasks.", variant: "destructive" });
      return;
    }
    const taskCount = parseInt(tasksDone, 10);

    if (isNaN(taskCount) || taskCount < 0) {
      toast({ title: "Invalid Input", description: "Please enter a valid non-negative number of tasks.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    const result = await addTaskEntryAction(currentUser, taskCount);

    if (result.success) {
      toast({ title: "Entry Submitted", description: `Your entry has been recorded.` });
      setTasksDone('');
      refetchData();
    } else {
      toast({ title: "Submission Failed", description: result.error, variant: "destructive" });
    }

    setIsSubmitting(false);
  };

  const isInputVisible = useMemo(() => {
    if (!currentUser) return false;
    const visibleRoles: UserRole[] = ['CR', ...DR_ROLES, 'LR', 'CO'];
    return visibleRoles.includes(currentUser.role);
  }, [currentUser]);

  const inputLabel = useMemo(() => {
    if (currentUser?.role === 'CR') return "My Sales Done";
    if ((currentUser && isDrRole(currentUser.role))) return "My Designs Done";
    if (currentUser?.role === 'LR') return "Team Tasks Done";
    if (currentUser?.role === 'CO') return "My Docs Done";
    return "My Tasks Done";
  }, [currentUser?.role]);

  const hasCompletedDailySubmissions = useMemo(() => {
    if (currentUser?.role === 'CR' || (currentUser && isDrRole(currentUser.role)) || currentUser?.role === 'LR' || currentUser?.role === 'CO') {
      return submissionsTodayCount > 0;
    }
    return false;
  }, [currentUser, submissionsTodayCount]);

  const canSubmitTasks = useMemo(() => {
    if (!currentUser) return false;
    return submissionsTodayCount === 0;
  }, [submissionsTodayCount, currentUser]);


  const totals = useMemo(() => {
    if (!monthlyTargetData || monthlyTargetData.length === 0) {
      return { totalDone: 0 };
    }

    let doneCount = 0;

    if (isAdminView) {
      doneCount = monthlyTargetData.reduce((acc, day) => acc + day.totalDone, 0);
    } else if (currentUser) {
      doneCount = monthlyTargetData.reduce((acc, day) => {
        const userDoneToday = day.userData[currentUser.id]?.done || 0;
        return acc + userDoneToday;
      }, 0);
    }

    return { totalDone: doneCount };
  }, [monthlyTargetData, isAdminView, currentUser]);


  const handlePrint = () => {
    if (!selectedDateRange?.from) {
      toast({ title: "Date Range Required", description: "Please select a date range before printing.", variant: "destructive" });
      return;
    }

    const from = format(selectedDateRange.from, 'yyyy-MM-dd');
    const to = format(selectedDateRange.to || selectedDateRange.from, 'yyyy-MM-dd');

    let url = `/tmphistory?from=${from}&to=${to}`;

    if (specificUserId !== 'all') {
      const user = userMap.get(specificUserId);
      if (user) {
        url += `&team=${user.role}`;
      }
    } else if (selectedTeam !== 'all') {
      url += `&team=${selectedTeam}`;
    } else {
      toast({ title: "Selection Required", description: "Please select a specific team to print a report.", variant: "destructive" });
      return;
    }

    window.open(url, '_blank');
  };

  const handleExport = () => {
    if (selectedTeam === 'all' || specificUserId !== 'all') {
      toast({ title: "Export Not Available", description: "Please select a specific team (not 'All Teams') and ensure no specific user is selected to export team data.", variant: "destructive" });
      return;
    }

    const { teamReportData } = calculateTeamReportData();

    if (!teamReportData) {
      toast({ title: "No Data", description: "No data available to export for the selected team and date range.", variant: "destructive" });
      return;
    }

    const { users, data, totals } = teamReportData;

    const headers = ["Date"];
    users.forEach(user => {
      const userMonthlyTarget = totals.find(t => t.userId === user.id)?.monthlyTarget || 0;
      const firstName = formatDisplayName(user.name);
      headers.push(`${firstName} (Target: ${userMonthlyTarget})`);
    });

    const rows = data.map(row => {
      const rowData: Record<string, any> = { 'Date': format(parseISO(row.date), 'd-MMM-yy') };
      users.forEach(user => {
        const userMonthlyTarget = totals.find(t => t.userId === user.id)?.monthlyTarget || 0;
        const firstName = formatDisplayName(user.name);
        const userTasks = (row as any)[user.id] || { tasks: 0 };
        rowData[`${firstName} (Target: ${userMonthlyTarget})`] = `tasks: ${userTasks.tasks}`;
      });
      return rowData;
    });

    const totalsRow: Record<string, any> = { 'Date': 'Total' };
    users.forEach(user => {
      const userTotal = totals.find(t => t.userId === user.id) || { totalTasks: 0, monthlyTarget: 0 };
      const firstName = formatDisplayName(user.name);
      totalsRow[`${firstName} (Target: ${userTotal.monthlyTarget})`] = `tasks: ${userTotal.totalTasks}`;
    });
    rows.push(totalsRow);

    const csv = Papa.unparse({
      fields: headers,
      data: rows,
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const safeTeamName = selectedTeam.replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('download', `team_performance_${safeTeamName}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Export Successful", description: "Team performance data has been downloaded." });
  };

  const calculateTeamReportData = () => {
    if (!allTasks || !selectedDateRange?.from || !globalSettings) {
      return { teamReportData: null };
    }

    const startDate = startOfDay(selectedDateRange.from);
    const endDate = endOfDay(selectedDateRange.to || selectedDateRange.from);

    let filteredTasks = allTasks.filter(task => {
      try {
        const taskDate = parseISO(task.date);
        return isWithinInterval(taskDate, { start: startDate, end: endDate });
      } catch {
        return false;
      }
    });

    if (selectedTeam !== 'all') {
      filteredTasks = filteredTasks.filter(task => roleInTeam(task.role, selectedTeam));
    }

    const teamUsers = Array.from(new Set(filteredTasks.map(t => t.userId)))
      .map(id => userMap.get(id))
      .filter((u): u is UserType => !!u)
      .sort((a, b) => a.name.localeCompare(b.name));

    const tasksByDate = new Map<string, Record<string, { tasks: number }>>();

    filteredTasks.forEach(task => {
      const dateStr = format(parseISO(task.date), 'yyyy-MM-dd');
      if (!tasksByDate.has(dateStr)) {
        tasksByDate.set(dateStr, {});
      }
      const dayEntry = tasksByDate.get(dateStr)!;
      if (!dayEntry[task.userId]) {
        dayEntry[task.userId] = { tasks: 0 };
      }
      dayEntry[task.userId].tasks += task.taskCount;
    });

    const pivotedData = Array.from(tasksByDate.entries())
      .map(([date, userTasks]) => ({ date, ...userTasks }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const userTotals = teamUsers.map(user => {
      const totalTasks = filteredTasks.filter(t => t.userId === user.id).reduce((sum, t) => sum + t.taskCount, 0);
      const monthlyTarget = user.monthlyOrderTarget || globalSettings?.roleBasedTargets?.[user.role as keyof typeof globalSettings.roleBasedTargets] || 0;
      return { userId: user.id, totalTasks, monthlyTarget };
    });

    return {
      teamReportData: {
        users: teamUsers,
        data: pivotedData,
        totals: userTotals,
      }
    };
  };


  const renderChart = () => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

    const chartData = monthlyTargetData;

    switch (chartType) {
      case 'line':
        return (
          <RechartsAreaChart data={chartData} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorDone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
              content={({ active, payload, label }) => <DoneTargetTooltipContent active={active} payload={payload} label={label} userMap={userMap} currentUser={currentUser} doneLabel={selectedTeam === 'CR' ? "Sales" : selectedTeam === 'DR_TEAM' ? "Designed" : selectedTeam === 'CO' ? "Docs" : "Tasks Done"} selectedTeam={selectedTeam} />}
            />
            <Legend verticalAlign="bottom" height={30} content={(props) => (
              <div className="flex justify-center gap-4 mt-2 select-none">
                {props.payload?.map((entry: any, index: number) => (
                  <div key={`item-${index}`} className="flex items-center gap-1.5 cursor-default group">
                    <div className="h-2 w-2 rounded-full transition-transform group-hover:scale-125" style={{ backgroundColor: entry.color }}></div>
                    <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground/80 tracking-wide uppercase">{entry.value}</span>
                  </div>
                ))}
              </div>
            )} />
            <XAxis
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={5}
              padding={{ left: 15, right: 15 }}
              interval={chartGranularity === 'hourly' ? (isMobile ? 3 : 0) : isMobile ? (chartData.length > 7 ? 2 : 0) : 0}
              tickFormatter={(value) => {
                if (chartGranularity === 'hourly') {
                  try {
                    const date = parseISO(value);
                    return format(date, 'ha');
                  } catch { return value; }
                }
                if (chartGranularity === 'monthly') {
                  try {
                    const date = parseISO(`${value}-01`);
                    return format(date, 'MMM');
                  } catch { return value; }
                }
                try {
                  const date = parseISO(value);
                  if (isValid(date)) return format(date, 'd MMM');
                  return value;
                } catch { return value; }
              }}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value === 0 ? '' : value}
            />
            <Area
              type="monotone"
              dataKey="totalDone"
              name={selectedTeam === 'CR' ? "Sales" : selectedTeam === 'DR_TEAM' ? "Designed" : selectedTeam === 'CO' ? "Docs" : "Tasks Done"}
              stroke="hsl(var(--chart-2))"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorDone)"
              animationDuration={1500}
            />
            <Area
              type="monotone"
              dataKey="totalTarget"
              name="Target"
              stroke="hsl(var(--chart-4))"
              strokeWidth={2}
              strokeDasharray="6 6"
              fill="transparent"
              animationDuration={1500}
            />
          </RechartsAreaChart>
        );
      default:
        return (
          <RechartsBarChart data={chartData} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
              content={({ active, payload, label }) => <DoneTargetTooltipContent active={active} payload={payload} label={label} userMap={userMap} currentUser={currentUser} doneLabel={selectedTeam === 'CR' ? "Sales" : selectedTeam === 'DR_TEAM' ? "Designed" : selectedTeam === 'CO' ? "Docs" : "Tasks Done"} selectedTeam={selectedTeam} />}
            />
            <Legend verticalAlign="bottom" height={30} content={(props) => (
              <div className="flex justify-center gap-4 mt-2 select-none">
                {props.payload?.map((entry: any, index: number) => (
                  <div key={`item-${index}`} className="flex items-center gap-1.5 cursor-default group">
                    <div className="h-2 w-2 rounded-full transition-transform group-hover:scale-125" style={{ backgroundColor: entry.color }}></div>
                    <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground/80 tracking-wide uppercase">{entry.value}</span>
                  </div>
                ))}
              </div>
            )} />
            <XAxis
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={5}
              padding={{ left: 15, right: 15 }}
              interval={chartGranularity === 'hourly' ? (isMobile ? 3 : 0) : isMobile ? (chartData.length > 7 ? 2 : 0) : 0}
              tickFormatter={(value) => {
                if (chartGranularity === 'hourly') {
                  try {
                    const date = parseISO(value);
                    return format(date, 'ha');
                  } catch { return value; }
                }
                if (chartGranularity === 'monthly') {
                  try {
                    const date = parseISO(`${value}-01`);
                    return format(date, 'MMM');
                  } catch { return value; }
                }
                try {
                  const date = parseISO(value);
                  if (isValid(date)) return format(date, 'd MMM');
                  return value;
                } catch { return value; }
              }}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value === 0 ? '' : value}
            />
            <Bar dataKey="totalDone" name={selectedTeam === 'CR' ? "Sales" : selectedTeam === 'DR_TEAM' ? "Designed" : selectedTeam === 'CO' ? "Docs" : "Tasks Done"} fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} animationDuration={1500} />
            <Bar dataKey="totalTarget" name="Target" fill="hsl(var(--chart-4))" radius={[6, 6, 0, 0]} animationDuration={1500} opacity={0.8} />
          </RechartsBarChart>
        );
    }
  };

  const selectedSpecificUserName = useMemo(() => {
    if (specificUserId === 'all') return 'Specific User';
    return userMap.get(specificUserId)?.name || 'Select User';
  }, [specificUserId, userMap]);

  return (
    <>
      <Card className="bg-card border shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="p-6 sm:p-8 pb-4 print-hide">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="p-2.5 bg-primary/10 rounded-xl sm:hidden">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl sm:text-2xl font-medium tracking-tight flex items-center gap-2">
                  <span className="hidden sm:inline"><Target className="h-5 w-5 text-primary" /></span>
                  {performanceTitle}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm line-clamp-1 sm:line-clamp-none">Daily completion against targets.</CardDescription>
              </div>
            </div>

            {/* Minimal Stat Blocks for Mobile */}
            {/* Modern Stat Blocks */}
            <div className="flex gap-4 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
              <motion.div 
                whileHover={{ y: -1, scale: 1.01 }}
                className="flex flex-row items-center justify-between min-w-[110px] sm:min-w-[140px] p-2 sm:p-2.5 bg-gradient-to-br from-green-500/10 to-green-500/[0.02] dark:from-green-500/20 dark:to-transparent rounded-xl border border-green-500/20 backdrop-blur-md shadow-sm group transition-all gap-2"
              >
                <div className="flex flex-col items-start gap-1">
                  <div className="p-1 bg-green-500/20 rounded-md text-green-600 dark:text-green-400 w-fit">
                    <CheckCircle className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-green-600/70 dark:text-green-400/70 uppercase tracking-tight leading-none truncate max-w-[60px] sm:max-w-none">{selectedTeam === 'CR' ? "Sales" : selectedTeam === 'DR_TEAM' ? "Designed" : selectedTeam === 'CO' ? "Docs" : "Done"}</span>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-lg sm:text-2xl font-medium text-foreground tabular-nums tracking-tight leading-none">
                    {totals.totalDone.toLocaleString()}
                  </p>
                  <span className="text-[8px] text-muted-foreground font-medium uppercase tracking-tighter opacity-50">Total</span>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -1, scale: 1.01 }}
                className="flex flex-row items-center justify-between min-w-[110px] sm:min-w-[140px] p-2 sm:p-2.5 bg-gradient-to-br from-amber-500/10 to-amber-500/[0.02] dark:from-amber-500/20 dark:to-transparent rounded-xl border border-amber-500/20 backdrop-blur-md shadow-sm group transition-all gap-2"
              >
                <div className="flex flex-col items-start gap-1">
                  <div className="p-1 bg-amber-500/20 rounded-md text-amber-600 dark:text-amber-400 w-fit">
                    <Target className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-amber-600/70 dark:text-amber-400/70 uppercase tracking-tight leading-none">Goal</span>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-lg sm:text-2xl font-medium text-foreground tabular-nums tracking-tight leading-none">
                    {totalPerformanceTarget.toLocaleString()}
                  </p>
                  <span className="text-[8px] text-muted-foreground font-medium uppercase tracking-tighter opacity-50">Target</span>
                </div>
              </motion.div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:items-center order-2 sm:order-1">
                {isInputVisible && (
                  <div className="contents">
                    {(currentUser?.role === 'CR' || hasCompletedDailySubmissions) &&
                      <Button asChild className="h-10 w-full sm:w-auto">
                        <Link href="/workflow">
                          Open Desk
                        </Link>
                      </Button>
                    }
                  </div>
                )}
                {isAdminView && (
                  <Button asChild className="h-10 w-full sm:w-auto">
                    <Link href="/workflow">
                      Open Desk
                    </Link>
                  </Button>
                )}
                {isAdminView && onTeamChange && (
                  <Select value={selectedTeam} onValueChange={(value) => onTeamChange(value as UserRole | 'all')}>
                    <SelectTrigger className="w-full sm:w-[150px] h-10">
                      <SelectValue placeholder="Select Team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CR">CR Team</SelectItem>
                      <SelectItem value="DR_TEAM">DR Team</SelectItem>
                      <SelectItem value="CO">CO Team</SelectItem>
                      <SelectItem value="LR">LR Team</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:items-center order-3 sm:order-2">
                {isAdminView && onSpecificUserChange && (
                  <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={isUserPopoverOpen} className="w-full sm:w-[180px] justify-between h-10 px-3">
                        <span className="truncate text-xs sm:text-sm">{selectedSpecificUserName}</span>
                        <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0 border-none shadow-2xl rounded-2xl overflow-hidden bg-background/95 backdrop-blur-md" align="end">
                      <Command>
                        <CommandInput placeholder="Search team member..." className="h-12 border-none focus:ring-0 text-sm" />
                        <CommandList>
                          <CommandEmpty>No user found.</CommandEmpty>
                          <CommandGroup heading="Team Members" className="px-2 pb-2">
                            {specificUserOptions.map(user => (
                              <CommandItem
                                key={user.id}
                                onSelect={() => { if (onSpecificUserChange) { onSpecificUserChange(user.id); setIsUserPopoverOpen(false); } }}
                                className={cn(
                                  "cursor-pointer mx-1 my-0.5 rounded-lg py-2.5 transition-all duration-200 active:scale-[0.98] group",
                                  "data-[selected=true]:bg-primary/5 data-[selected=true]:text-primary",
                                  specificUserId === user.id ? "bg-primary/20 shadow-sm" : ""
                                )}
                              >
                                <div className="flex items-center gap-3 w-full px-1">
                                  <div className="relative">
                                    <Avatar className="h-9 w-9 shrink-0 border-2 border-background shadow-sm transition-transform group-hover:scale-105">
                                      <AvatarImage src={user.avatarUrl || undefined} alt={user.name} />
                                      <AvatarFallback className={cn(
                                        "text-xs font-bold",
                                        specificUserId === user.id ? "bg-primary/20 text-primary" : "bg-primary/5 text-primary"
                                      )}>
                                        {getInitials(user.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    {specificUserId === user.id && (
                                      <div className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 bg-primary rounded-full border-2 border-background flex items-center justify-center animate-in zoom-in duration-300 shadow-sm">
                                        <Check className="h-2 w-2 text-primary-foreground" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-col flex-1 min-w-0 justify-center">
                                    <span className={cn(
                                      "truncate text-sm font-semibold transition-colors",
                                      specificUserId === user.id ? "text-primary" : "text-foreground/90 group-hover:text-foreground"
                                    )}>
                                      {user.name}
                                    </span>
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
                {selectedDateRange && <DateRangePicker
                  initialRange={selectedDateRange}
                  onDateRangeChange={handleDateChange}
                  className="w-full sm:w-auto h-10"
                />}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end order-1 sm:order-3">
                {isInputVisible && canSubmitTasks && currentUser?.role !== 'CR' && (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Input
                      id="tasks-done-input"
                      type="number"
                      placeholder={`${inputLabel}...`}
                      value={tasksDone}
                      onChange={(e) => setTasksDone(e.target.value)}
                      className="h-10 w-full sm:w-32"
                      min="0"
                    />
                    <Button
                      onClick={handleDoneClick}
                      disabled={isSubmitting || tasksDone.trim() === ''}
                      className="h-10 px-6 shadow-lg shadow-primary/20 transition-all hover:shadow-primary/40 active:scale-95"
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Done"}
                    </Button>
                  </div>
                )}
                {isAdminView && null}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 print-hide">
          <div className="h-[280px] sm:h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
}


const DoneTargetTooltipContent = ({ active, payload, label, userMap, currentUser, doneLabel = "Tasks Done", selectedTeam }: any) => {
  if (active && payload && payload.length) {
    const donePayload = payload.find((p: any) => p.dataKey === 'totalDone');
    const targetPayload = payload.find((p: any) => p.dataKey === 'totalTarget');
    const userData = donePayload?.payload?.userData || {};

    let userBreakdown: { user: UserType, done: number }[] = [];

    if (currentUser) {
      if (currentUser.role === 'SYSTEM_ADMIN' || currentUser.role === 'ADMIN') {
        userBreakdown = Object.entries(userData)
          .map(([userId, data]: [string, any]) => ({ user: userMap.get(userId), done: data.done }))
          .filter(item => item.user && !item.user.isBanned && item.done >= 0)
          .sort((a, b) => b.done - a.done) as { user: UserType, done: number }[];
      } else {
        userBreakdown = Object.entries(userData)
          .filter(([userId, data]: [string, any]) => data.role === currentUser.role && data.done >= 0)
          .map(([userId, data]: [string, any]) => ({ user: userMap.get(userId), done: data.done }))
          .filter(item => item.user && !item.user.isBanned)
          .sort((a, b) => b.done - a.done) as { user: UserType, done: number }[];
      }
    }

    return (
      <div className="rounded-2xl border border-border/50 bg-background/80 backdrop-blur-xl p-4 shadow-2xl min-w-[240px] animate-in fade-in zoom-in duration-200">
        <div className="grid grid-cols-1 gap-3">
          <p className="font-bold text-base text-foreground tracking-tight border-b border-border/50 pb-2 mb-1">{label}</p>
          {donePayload && <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: donePayload.color }}></div>
            <span className="text-sm text-muted-foreground">{doneLabel}:</span>
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
                    <span className="font-medium text-foreground">{done} {selectedTeam === 'CR' ? 'sales' : selectedTeam === 'DR_TEAM' ? 'designs' : selectedTeam === 'CO' ? 'docs' : 'tasks'}</span>
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


