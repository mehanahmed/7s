
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { getUsers } from '@/lib/user-service';
import { getOrders } from '@/lib/order-service';
import { getGlobalSettings } from '@/lib/settings-service';
import { Crown, ArrowUp, ArrowDown } from 'lucide-react';
import { LeaderboardDisplay } from '@/components/leaderboard/LeaderboardDisplay';
import type { User, TrackingLink, GlobalSettings, UserRole } from '@/types';
import {
  isWithinInterval,
  differenceInDays,
  startOfDay,
  endOfDay,
  sub,
  format,
} from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { DateRangePicker, type PredefinedRange } from '@/components/dashboard/date-range-picker';
import type { DateRange } from "react-day-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LEADERBOARD_BOARDS, getProjectPerformanceCounts } from '@/lib/leaderboard-boards';

// CrmPerformanceData type
export interface CrmPerformanceData {
  userId: string;
  userName: string;
  userAvatar?: string;
  ordersCompleted: number; // This is the "points" for CRs
  reorderCount: number;
  target: number;
  designsAssigned?: number; // Specific for DRs
  designsDone?: number; // Specific for DRs
  rank?: number;
  role?: UserRole;
  trend?: 'up' | 'down' | 'same';
  pointChange?: number;
}

export default function LeaderboardPage() {
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [performanceData, setPerformanceData] = useState<CrmPerformanceData[]>([]);
  const [rolePerformanceData, setRolePerformanceData] = useState<Record<string, CrmPerformanceData[]>>({});
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return {
      from: startOfDay(today),
      to: endOfDay(today),
    };
  });
  const [currentDateRangeLabel, setCurrentDateRangeLabel] = useState("Today");
  const [selectedPredefinedRange, setSelectedPredefinedRange] = useState<PredefinedRange | "custom" | null>("today");

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allOrders, setAllOrders] = useState<TrackingLink[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);

  const [activeTab, setActiveTab] = useState('cr_board');

  useEffect(() => {
    const defaultBoard = currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN'
      ? 'cr_board'
      : LEADERBOARD_BOARDS.find(board => board.roles.includes(currentUser?.role ?? ''))?.id ?? 'cr_board';
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      const valid = LEADERBOARD_BOARDS.some(board => board.id === hash);
      setActiveTab(valid ? hash : defaultBoard);
      if (hash && !valid) window.history.replaceState(null, '', '#' + defaultBoard);
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentUser?.role]);

  const handleTabChange = useCallback((value: string) => {
    if (!LEADERBOARD_BOARDS.some(board => board.id === value)) return;
    setActiveTab(value);
    window.history.replaceState(null, '', '#' + value);
  }, []);

  const [currentLeaderboardBackground, setCurrentLeaderboardBackground] = useState<string | null | undefined>(undefined);

  const calculatePerformance = useCallback((
    users: User[],
    orders: TrackingLink[],
    globalSettings: GlobalSettings,
    dateRange: DateRange | undefined,
    boardId: string,
    predefinedRange: PredefinedRange | "custom" | null
  ): CrmPerformanceData[] => {
    if (!dateRange?.from || !dateRange?.to) {
      return [];
    }
    const periodStart = startOfDay(dateRange.from);
    const periodEnd = endOfDay(dateRange.to);

    const board = LEADERBOARD_BOARDS.find(item => item.id === boardId);
    if (!board) return [];
    const roleFilteredUsers = users.filter(user => board.roles.includes(user.role) && user.role !== 'ARTIST' && !user.isBanned);

    const performanceDataList = roleFilteredUsers.map(user => {
      let ordersCompleted = 0;
      let designsAssigned = 0;
      let designsDone = 0;

      if (board.assignmentKey === 'CR') {
        ordersCompleted = orders.filter(order =>
          order.crmUserId === user.id &&
          isWithinInterval(new Date(order.createdAt), { start: periodStart, end: periodEnd })
        ).length;

      } else {
        ({ designsAssigned, designsDone } = getProjectPerformanceCounts(user, orders, boardId, periodStart, periodEnd));
      }

      const roleBasedTargets = globalSettings.roleBasedTargets || {};
      const monthlyTarget = (user.monthlyOrderTarget ?? roleBasedTargets[user.role as keyof typeof roleBasedTargets] ?? 0);

      let target = 0;
      if (predefinedRange === 'thisMonth' || predefinedRange === 'lastMonth') {
        target = monthlyTarget;
      } else {
        const numDaysInRange = differenceInDays(periodEnd, periodStart) + 1;
        const dailyTarget = monthlyTarget / 30; // Assume a 30-day month for proration
        target = Math.round(dailyTarget * numDaysInRange);
      }

      return {
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatarUrl || undefined,
        ordersCompleted: ordersCompleted,
        reorderCount: 0,
        designsAssigned,
        designsDone,
        target: target,
        role: user.role,
        trend: 'same',
        pointChange: 0,
      } as CrmPerformanceData;
    });

    const sortKey = board.assignmentKey !== 'CR' ? 'designsDone' : 'ordersCompleted';

    performanceDataList.sort((a, b) => {
      const aTotal = (a[sortKey as keyof CrmPerformanceData] as number || 0);
      const bTotal = (b[sortKey as keyof CrmPerformanceData] as number || 0);
      return bTotal - aTotal || a.userName.localeCompare(b.userName);
    });
    performanceDataList.forEach((user, index) => {
      user.rank = index + 1;
    });

    return performanceDataList;
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) {
        setIsLoadingData(false);
        return;
      }
      setIsLoadingData(true);
      setFetchError(null);
      try {
        const [fetchedUsers, fetchedOrders, fetchedSettings] = await Promise.all([
          getUsers(),
          getOrders(),
          getGlobalSettings(),
        ]);

        if (fetchedSettings.isLeaderboardRestrictedToAdmin && currentUser.role !== 'ADMIN' && currentUser.role !== 'SYSTEM_ADMIN') {
          router.replace('/dashboard');
          toast({ title: "Access Restricted", description: "The leaderboard is currently only available to administrators.", variant: "destructive" });
          return;
        }

        setAllUsers(fetchedUsers);
        setAllOrders(fetchedOrders);
        setGlobalSettings(fetchedSettings);
        setCurrentLeaderboardBackground(fetchedSettings.leaderboardBackgroundImageUrl);

      } catch (error) {
        console.error("Failed to fetch leaderboard data:", error);
        setFetchError("Could not load leaderboard data. Please try again later.");
        toast({ title: "Error", description: "Could not load leaderboard data.", variant: "destructive" });
      } finally {
        setIsLoadingData(false);
      }
    };

    if (currentUser && !isAuthLoading) {
      fetchData();
    }
  }, [currentUser, isAuthLoading, toast, router]);

  useEffect(() => {
    if (isLoadingData || !allUsers.length || !globalSettings || !selectedDateRange?.from || !selectedDateRange?.to) return;

    const rangeDuration = differenceInDays(selectedDateRange.to, selectedDateRange.from);
    const previousPeriodStart = sub(selectedDateRange.from, { days: rangeDuration + 1 });
    const previousPeriodEnd = endOfDay(sub(selectedDateRange.to, { days: rangeDuration + 1 }));
    const previousPeriodRange = { from: previousPeriodStart, to: previousPeriodEnd };

    let crData = calculatePerformance(allUsers, allOrders, globalSettings, selectedDateRange, 'cr_board', selectedPredefinedRange);
    const prevCrData = calculatePerformance(allUsers, allOrders, globalSettings, previousPeriodRange, 'cr_board', selectedPredefinedRange);

    const prevCrMap = new Map(prevCrData.map(d => [d.userId, d]));
    crData = crData.map(currentData => {
      const prevData = prevCrMap.get(currentData.userId);
      const prevPoints = (prevData?.ordersCompleted || 0);
      const currentPoints = currentData.ordersCompleted;
      const pointChange = currentPoints - prevPoints;
      return {
        ...currentData,
        trend: pointChange > 0 ? 'up' : pointChange < 0 ? 'down' : 'same',
        pointChange: Math.abs(pointChange)
      };
    });

    const nextRoleData: Record<string, CrmPerformanceData[]> = {};
    for (const board of LEADERBOARD_BOARDS.filter(board => board.id !== 'cr_board')) {
      const data = calculatePerformance(allUsers, allOrders, globalSettings, selectedDateRange, board.id, selectedPredefinedRange);
      const previousData = calculatePerformance(allUsers, allOrders, globalSettings, previousPeriodRange, board.id, selectedPredefinedRange);
      const previousMap = new Map(previousData.map(item => [item.userId, item]));
      nextRoleData[board.id] = data.map(item => {
        const pointChange = (item.designsDone ?? 0) - (previousMap.get(item.userId)?.designsDone ?? 0);
        return { ...item, trend: pointChange > 0 ? 'up' : pointChange < 0 ? 'down' : 'same', pointChange: Math.abs(pointChange) };
      });
    }
    setPerformanceData(crData);
    setRolePerformanceData(nextRoleData);

  }, [isLoadingData, allUsers, allOrders, globalSettings, selectedDateRange, calculatePerformance, selectedPredefinedRange]);

  const handleDateRangeChange = (range: DateRange | undefined, displayLabel: string, predefinedValue: PredefinedRange | "custom" | null) => {
    setSelectedDateRange(range);
    setCurrentDateRangeLabel(displayLabel);
    setSelectedPredefinedRange(predefinedValue);
  };

  const showTabs = useMemo(() => {
    if (!currentUser) return false;
    return ['SYSTEM_ADMIN', 'ADMIN'].includes(currentUser.role);
  }, [currentUser]);

  const isLoadingContent = isAuthLoading || isLoadingData || !selectedDateRange;

  if (isLoadingContent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--leaderboard-bg-main-start))] to-[hsl(var(--leaderboard-bg-main-end))] text-[hsl(var(--leaderboard-text-light))] p-4 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center blur-lg scale-110"
          style={{ backgroundImage: "url('https://i.ibb.co/PGBMbxBc/360-F-338486227-q-Qit-Uvh3n-ILq-Yiu-QOUGxdfindo-NMbtp-H.jpg')" }}
          data-ai-hint="abstract orange fire particles"
        ></div>
        <header className="relative z-10 flex items-center justify-center text-center py-3 px-2 mb-6">
          <h1 className="text-xl font-semibold tracking-wider">LEADERBOARD</h1>
          <div className="absolute right-4"><Skeleton className="h-9 w-36 rounded-md bg-white/10" /></div>
        </header>
        <div className="relative z-10 text-center mb-8">
          <Crown className="h-10 w-10 text-[hsl(var(--leaderboard-gold))] mx-auto mb-2 opacity-50" />
          <div className="flex justify-around items-end max-w-md mx-auto">
            <Skeleton className="h-40 w-24 rounded-t-full bg-[hsl(var(--leaderboard-podium-bg))] opacity-50" />
            <Skeleton className="h-48 w-28 rounded-t-full bg-[hsl(var(--leaderboard-podium-bg))] opacity-50" />
            <Skeleton className="h-40 w-24 rounded-t-full bg-[hsl(var(--leaderboard-podium-bg))] opacity-50" />
          </div>
        </div>
        <div className="relative z-10 bg-[hsl(var(--leaderboard-list-area-bg))] p-4 rounded-t-3xl mt-[-30px] shadow-2xl">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={`list-skel-${i}`} className="h-16 w-full rounded-lg mb-2 bg-gray-200/50" />
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--leaderboard-bg-main-start))] to-[hsl(var(--leaderboard-bg-main-end))] text-[hsl(var(--leaderboard-text-light))] p-4 flex flex-col items-center justify-center">
        <h1 className="text-xl font-semibold mb-4">Error</h1>
        <p>{fetchError}</p>
      </div>
    );
  }

  const bgStyle = currentLeaderboardBackground
    ? { backgroundImage: `url('${currentLeaderboardBackground}')` }
    : { backgroundImage: "url('https://i.ibb.co/PGBMbxBc/360-F-338486227-q-Qit-Uvh3n-ILq-Yiu-QOUGxdfindo-NMbtp-H.jpg')" };

  const dataForActiveTab = activeTab === 'cr_board' ? performanceData : rolePerformanceData[activeTab] ?? [];
  const currentLeaderboardData = dataForActiveTab.map(d =>
    currentUser && d.userId === currentUser.id
      ? { ...d, userName: "You" }
      : d
  );

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--leaderboard-bg-main-start))] to-[hsl(var(--leaderboard-bg-main-end))] text-[hsl(var(--leaderboard-text-light))] p-0 sm:p-0 md:p-0 lg:p-0 relative overflow-x-hidden print:hidden">
        <div
          className="absolute inset-0 bg-cover bg-center blur-lg scale-110"
          style={bgStyle}
          data-ai-hint={currentLeaderboardBackground ? "" : "abstract orange fire particles"}
        ></div>
        <header className="relative z-10 flex items-center justify-center text-center py-4 px-4 sm:px-6 mb-4 sm:mb-6">
          <h1 className="text-lg sm:text-xl font-semibold tracking-wider text-[hsl(var(--leaderboard-text-light))]">LEADERBOARD</h1>
          <div className="absolute right-4 sm:right-6 flex items-center gap-2">
            {selectedDateRange && (
              <DateRangePicker
                initialRange={selectedDateRange}
                onDateRangeChange={handleDateRangeChange}
                className="w-auto bg-black/40 border-[hsl(var(--leaderboard-subtle-border))] text-[hsl(var(--leaderboard-text-light))] hover:bg-black/60 focus:ring-[hsl(var(--leaderboard-gold))] h-9 text-xs sm:text-sm"
              />
            )}
          </div>
        </header>

        {showTabs ? (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full relative z-10">
            <TabsList className="flex h-auto w-fit max-w-[calc(100%-32px)] flex-wrap justify-center gap-1 mx-auto bg-black/30 border-none text-white/80 p-1.5 rounded-xl">
              {LEADERBOARD_BOARDS.map(board => <TabsTrigger key={board.id} value={board.id} className="rounded-lg px-4 py-2">{board.label}</TabsTrigger>)}
            </TabsList>
            {LEADERBOARD_BOARDS.map(board => (
              <TabsContent key={board.id} value={board.id} className="mt-4">
                <LeaderboardDisplay performanceData={currentLeaderboardData} currentUser={currentUser} timePeriodLabel={currentDateRangeLabel} />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="mt-4">
            <LeaderboardDisplay
              performanceData={currentLeaderboardData}
              currentUser={currentUser}
              timePeriodLabel={currentDateRangeLabel}
            />
          </div>
        )}
      </div>

      <div className="hidden print:block p-8">
        <h1 className="text-2xl font-bold text-center mb-2">Leaderboard Report</h1>
        <p className="text-center text-muted-foreground text-sm mb-6">
          Date Range: {currentDateRangeLabel} ({format(selectedDateRange?.from || new Date(), 'd MMM yyyy')} - {format(selectedDateRange?.to || new Date(), 'd MMM yyyy')})
        </p>

        <div className={cn('print-cr-section', activeTab === 'cr_board' ? 'block' : 'hidden')}>
          <h2 className="text-lg font-semibold mb-2">Sales Executive Performance</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-center">Sales</TableHead>
                <TableHead className="text-center">Target</TableHead>
                <TableHead className="text-center">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {performanceData.map(user => {
                const totalPoints = user.ordersCompleted;
                return (
                  <TableRow key={`print-cr-${user.userId}`}>
                    <TableCell className="font-bold text-lg">{user.rank}</TableCell>
                    <TableCell>{user.userName}</TableCell>
                    <TableCell className="text-center font-mono">{totalPoints}</TableCell>
                    <TableCell className="text-center font-mono">{user.target}</TableCell>
                    <TableCell className={cn(
                      "text-center font-semibold flex items-center justify-center gap-1",
                      user.trend === 'up' && 'text-green-600',
                      user.trend === 'down' && 'text-red-600',
                    )}>
                      {user.trend === 'up' && <ArrowUp className="h-4 w-4" />}
                      {user.trend === 'down' && <ArrowDown className="h-4 w-4" />}
                      {user.pointChange !== 0 ? user.pointChange : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className={cn('print-dr-section', activeTab !== 'cr_board' ? 'block' : 'hidden')}>
          <h2 className="text-lg font-semibold mb-2 mt-8">{LEADERBOARD_BOARDS.find(board => board.id === activeTab)?.label} Performance</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-center">Projects Completed</TableHead>
                <TableHead className="text-center">Projects Assigned</TableHead>
                <TableHead className="text-center">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataForActiveTab.map(user => {
                return (
                  <TableRow key={`print-dr-${user.userId}`}>
                    <TableCell className="font-bold text-lg">{user.rank}</TableCell>
                    <TableCell>{user.userName}</TableCell>
                    <TableCell className="text-center font-mono">{user.designsDone}</TableCell>
                    <TableCell className="text-center font-mono">{user.designsAssigned}</TableCell>
                    <TableCell className={cn(
                      "text-center font-semibold flex items-center justify-center gap-1",
                      user.trend === 'up' && 'text-green-600',
                      user.trend === 'down' && 'text-red-600',
                    )}>
                      {user.trend === 'up' && <ArrowUp className="h-4 w-4" />}
                      {user.trend === 'down' && <ArrowDown className="h-4 w-4" />}
                      {user.pointChange !== 0 ? user.pointChange : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
