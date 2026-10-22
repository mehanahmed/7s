
"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  ChevronRight,
  LogOut,
  Bell,
  User as UserIcon,
  Loader2,
  MapPin,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Briefcase,
  Target,
  BarChart3,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { getUserLeaveHistoryAction, type UserLeaveData, type UserLeaveRecord } from '@/app/attendance/actions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO, isSameMonth, getDaysInMonth, startOfMonth, getDay, subMonths, addMonths, getYear, isToday, isSameDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getAttendanceForMonth } from '@/lib/attendance-service';
import type { AttendanceRecord, User, TaskEntry } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getWeekendSettings } from '@/lib/weekend-service';
import { getTaskEntries } from '@/lib/team-performance-service';
import { addTaskEntryAction } from '@/app/(app)/dashboard/actions';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Separator } from '@/components/ui/separator';


const getInitials = (name: string | undefined): string => {
  if (!name) return '??';
  const names = name.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return names[0].charAt(0).toUpperCase() + (names.length > 1 ? names[names.length - 1].charAt(0).toUpperCase() : '');
};

interface ProfileLinkProps {
  href: string;
  icon: React.ElementType;
  label: string;
  isExternal?: boolean;
}

const ProfileLink: React.FC<ProfileLinkProps> = ({ href, icon: Icon, label, isExternal }) => (
  <Link href={href} target={isExternal ? '_blank' : '_self'} rel={isExternal ? 'noopener noreferrer' : ''}>
    <div className="flex items-center p-3 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer">
      <Icon className="h-5 w-5 mr-4 text-muted-foreground" />
      <span className="flex-1 font-medium text-foreground">{label}</span>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </div>
  </Link>
);

interface StatCardProps {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  value: string;
  isFaded?: boolean;
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, title, subtitle, value, isFaded, isLoading }) => {
  if (isLoading) {
    return (
      <Card className="bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16 mt-1" />
            </div>
          </div>
          <Skeleton className="h-8 w-24 mt-3" />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className={cn("bg-card shadow-sm transition-all", isFaded && "opacity-40")}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0",
            isFaded ? "bg-gray-200 dark:bg-gray-700" : "bg-orange-100 dark:bg-orange-900"
          )}>
            <Icon className={cn("h-5 w-5", isFaded ? "text-gray-400 dark:text-gray-500" : "text-orange-600 dark:text-orange-300")} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <p className="text-3xl font-bold text-foreground mt-3">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const { currentUser, logout, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState('');
  const [locationAddress, setLocationAddress] = useState('Loading location...');

  const [monthlyRecords, setMonthlyRecords] = useState<AttendanceRecord[]>([]);
  const [allTasks, setAllTasks] = useState<TaskEntry[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [weekendDays, setWeekendDays] = useState<string[]>([]);

  const [lrTaskCount, setLrTaskCount] = useState('');
  const [isLrTaskSubmitted, setIsLrTaskSubmitted] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const { toast } = useToast();

  const [leaveData, setLeaveData] = useState<UserLeaveData>({
    totalQuota: 14,
    takenDays: 0,
    availableDays: 14,
    records: [],
  });
  const [isLeaveLoading, setIsLeaveLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.id) {
      setIsLeaveLoading(true);
      getUserLeaveHistoryAction(currentUser.id)
        .then((data) => setLeaveData(data))
        .catch((err) => console.error("Failed to load leave history:", err))
        .finally(() => setIsLeaveLoading(false));
    }
  }, [currentUser?.id]);

  const formatLeaveDates = (record: UserLeaveRecord) => {
    if (record.allDates && record.allDates.length > 0) {
      if (record.allDates.length === 1) {
        try {
          return format(parseISO(record.allDates[0]), 'd MMM, yyyy');
        } catch {
          return record.allDates[0];
        }
      }
      try {
        const sorted = [...record.allDates].sort();
        const first = format(parseISO(sorted[0]), 'd MMM');
        const last = format(parseISO(sorted[sorted.length - 1]), 'd MMM, yyyy');
        return `${first} - ${last}`;
      } catch {
        return record.allDates.join(', ');
      }
    }
    try {
      return format(parseISO(record.date), 'd MMM, yyyy');
    } catch {
      return record.date;
    }
  };


  useEffect(() => {
    setIsClient(true);
    setSelectedDate(new Date());
  }, []);

  const fetchAttendanceData = useCallback(async (month: Date) => {
    if (!currentUser) return;
    setIsDataLoading(true);
    try {
      const [records, weekendSettings, tasks] = await Promise.all([
        getAttendanceForMonth(month),
        getWeekendSettings(),
        getTaskEntries() // Fetch tasks
      ]);
      setMonthlyRecords(records.filter(r => r.employeeId === currentUser.id));
      setWeekendDays(weekendSettings.days || []);
      setAllTasks(tasks); // Store all tasks
    } catch (error) {
      console.error("Failed to fetch attendance or weekend settings:", error);
    } finally {
      setIsDataLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (isClient) {
      setCurrentDate(format(new Date(), "eeee, d MMMM yyyy"));

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            if (!response.ok) throw new Error('Failed to fetch address');
            const data = await response.json();
            setLocationAddress(data.display_name || `Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`);
          } catch (error) {
            setLocationAddress("Could not determine address");
          }
        }, () => {
          setLocationAddress("Location permission denied");
        });
      } else {
        setLocationAddress("Geolocation not supported");
      }
    }
  }, [isClient]);

  useEffect(() => {
    if (currentUser && selectedDate) {
      fetchAttendanceData(selectedDate);
    }
  }, [currentUser, selectedDate, fetchAttendanceData]);

  // Check if LR user has submitted tasks for today
  useEffect(() => {
    if (currentUser?.role === 'LR' && allTasks.length > 0) {
      const today = new Date();
      const hasSubmitted = allTasks.some(task =>
        task.userId === currentUser.id && isSameDay(parseISO(task.date), today)
      );
      setIsLrTaskSubmitted(hasSubmitted);
    }
  }, [currentUser, allTasks]);


  useEffect(() => {
    if (!isAuthLoading && !currentUser) {
      router.replace('/attendance/login');
    }
  }, [currentUser, isAuthLoading, router]);

  const attendanceStats = useMemo(() => {
    if (isDataLoading || !selectedDate || !currentUser) {
      return { checkIn: '--:--', checkOut: '--:--', absenceDays: 0, attendedDays: 0 };
    }

    const recordsForSelectedMonth = monthlyRecords.filter(r => isSameMonth(parseISO(r.date), selectedDate));

    const today = new Date();
    const todaysRecord = monthlyRecords.find(r => isSameDay(parseISO(r.date), today));
    const checkIn = todaysRecord ? format(parseISO(todaysRecord.checkInTime), 'HH:mm') : '--:--';
    const checkOut = todaysRecord?.checkOutTime ? format(parseISO(todaysRecord.checkOutTime), 'HH:mm') : '--:--';

    const attendedDays = recordsForSelectedMonth.length;

    const totalDaysInMonth = getDaysInMonth(selectedDate);
    let workingDaysSoFar = 0;
    const weekendDayIndexes = weekendDays.map(day => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day));

    const loopEndDate = isSameMonth(selectedDate, today) ? today.getDate() : totalDaysInMonth;

    for (let i = 1; i <= loopEndDate; i++) {
      const dayOfWeek = getDay(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i));
      if (!weekendDayIndexes.includes(dayOfWeek)) {
        workingDaysSoFar++;
      }
    }

    const absenceDays = Math.max(0, workingDaysSoFar - attendedDays);

    return { checkIn, checkOut, absenceDays, attendedDays };
  }, [monthlyRecords, selectedDate, weekendDays, isDataLoading, currentUser]);

  const handleMonthChange = (monthIndex: string) => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setMonth(parseInt(monthIndex, 10));
      setSelectedDate(newDate);
    }
  };

  const handleYearChange = (year: string) => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setFullYear(parseInt(year, 10));
      setSelectedDate(newDate);
    }
  };

  const handleLrTaskSubmit = async () => {
    if (!currentUser || !lrTaskCount) {
      toast({ title: "Invalid Input", description: "Please enter a valid number of tasks.", variant: "destructive" });
      return;
    }
    const taskCount = parseInt(lrTaskCount, 10);
    if (isNaN(taskCount) || taskCount < 0) {
      toast({ title: "Invalid Input", description: "Task count must be a non-negative number.", variant: "destructive" });
      return;
    }

    setIsSubmittingTask(true);
    const result = await addTaskEntryAction(currentUser, taskCount);
    setIsSubmittingTask(false);

    if (result.success) {
      toast({ title: "Tasks Submitted", description: `${taskCount} tasks have been recorded for today.` });
      setIsLrTaskSubmitted(true);
      fetchAttendanceData(currentDate ? new Date(currentDate) : new Date()); // Re-fetch to update submission status
    } else {
      toast({ title: "Submission Failed", description: result.error || "Could not save your task entry.", variant: "destructive" });
    }
  };

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 1; i++) {
      years.push(i);
    }
    return years.reverse();
  }, []);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    value: i.toString(),
    label: format(new Date(0, i), 'MMMM'),
  })), []);


  if (isAuthLoading || !currentUser || !selectedDate) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const isAdminOrLr = currentUser.role === 'ADMIN' || currentUser.role === 'SYSTEM_ADMIN' || currentUser.role === 'LR';

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-2xl mx-auto p-4 sm:p-6 space-y-6 pb-28">

        {/* User Info Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-4 border-background shadow-md">
              <AvatarImage src={currentUser?.avatarUrl || undefined} alt={currentUser?.name} />
              <AvatarFallback className="text-2xl bg-muted">{getInitials(currentUser?.name)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{currentUser?.name}</h1>
              <p className="text-md text-muted-foreground">{currentUser?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>


        {/* Attendance Summary Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <Select value={selectedDate.getMonth().toString()} onValueChange={handleMonthChange}>
                <SelectTrigger className="w-full sm:w-[150px] h-9 rounded-md border-gray-200 bg-white">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedDate.getFullYear().toString()} onValueChange={handleYearChange}>
                <SelectTrigger className="w-full sm:w-[120px] h-9 rounded-md border-gray-200 bg-white">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground text-right">{currentDate}</p>
          </div>
          <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200/50 py-1.5 px-3 max-w-full">
            <MapPin className="h-4 w-4 mr-2" />
            <span className="truncate">{locationAddress}</span>
          </Badge>
          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={ArrowDown} title="Check In" subtitle="Today" value={attendanceStats.checkIn} isLoading={isDataLoading} />
            <StatCard icon={ArrowUp} title="Check Out" subtitle="Today" value={attendanceStats.checkOut} isFaded={attendanceStats.checkOut === '--:--'} isLoading={isDataLoading} />
            <StatCard icon={ArrowUp} title="Absence" subtitle="This Month" value={`${attendanceStats.absenceDays} Days`} isLoading={isDataLoading} />
            <StatCard icon={ArrowUp} title="Attended" subtitle="This Month" value={`${attendanceStats.attendedDays} Days`} isLoading={isDataLoading} />
          </div>
        </div>

        {/* Leave History Section */}
        <Card className="bg-card shadow-sm border border-border/50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <CalendarDays className="h-4 w-4" />
              </div>
              <CardTitle className="text-lg font-bold">Leave History</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 border-primary/30 text-primary bg-primary/5">
              {leaveData.availableDays} Days Available
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 3-stat summary strip */}
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/40 text-center">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Allowed</p>
                <p className="text-base font-bold text-foreground mt-0.5">{leaveData.totalQuota} <span className="text-xs font-normal text-muted-foreground">Days</span></p>
              </div>
              <div className="border-x border-border/40">
                <p className="text-[11px] font-medium text-muted-foreground">Taken</p>
                <p className="text-base font-bold text-orange-600 dark:text-orange-400 mt-0.5">{leaveData.takenDays} <span className="text-xs font-normal text-muted-foreground">Days</span></p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Available</p>
                <p className={cn("text-base font-bold mt-0.5", leaveData.availableDays > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                  {leaveData.availableDays} <span className="text-xs font-normal text-muted-foreground">Days</span>
                </p>
              </div>
            </div>

            {/* Records List */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Recent Leaves</p>
              {isLeaveLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full rounded-lg" />
                  <Skeleton className="h-14 w-full rounded-lg" />
                </div>
              ) : leaveData.records.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {leaveData.records.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/50 hover:bg-muted/40 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">{formatLeaveDates(rec)}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {rec.days} {rec.days === 1 ? 'Day' : 'Days'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{rec.reason || 'General Leave'}</p>
                      </div>
                      <Badge className={cn("text-[11px] font-medium shrink-0",
                        rec.status === 'Approved' ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-none" : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-none"
                      )}>
                        {rec.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 px-4 rounded-xl border border-dashed border-border/60 bg-muted/20">
                  <CalendarClock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-1.5" />
                  <p className="text-sm font-medium text-foreground">No leave history recorded yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Approved and paid leaves will appear here.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Daily Task Submission for LR */}
        {currentUser.role === 'LR' && (
          <Card className="bg-card shadow-sm border border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" /> Daily Task Submission
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLrTaskSubmitted ? (
                <div className="flex flex-col items-center gap-4 text-center py-2">
                  <p className="text-green-600 font-semibold">Your tasks for today have been submitted!</p>
                  <Button asChild>
                    <Link href="/workflow">Open Desk</Link>
                  </Button>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="lr-tasks" className="sr-only">Team Tasks Done</Label>
                    <Input id="lr-tasks" type="number" value={lrTaskCount} onChange={e => setLrTaskCount(e.target.value)} placeholder="Enter task count" />
                  </div>
                  <Button onClick={handleLrTaskSubmit} disabled={isSubmittingTask || !lrTaskCount}>
                    {isSubmittingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}

