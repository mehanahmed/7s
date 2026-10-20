
"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Crown, ArrowUp, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User, UserRole } from '@/types';
import { cn } from '@/lib/utils';

// This interface is now defined in page.tsx and passed here
export interface CrmPerformanceData {
  userId: string;
  userName: string;
  userAvatar?: string;
  ordersCompleted: number; // This is the "points"
  target: number; // Not directly used in new design, but kept for data structure
  rank?: number;
  role?: UserRole; // Kept for potential future use or if logic depends on it
  trend?: 'up' | 'down' | 'same';
  pointChange?: number;
}

interface LeaderboardDisplayProps {
  performanceData: CrmPerformanceData[];
  currentUser: User | null; // Used to potentially highlight the current user, though not in design
  timePeriodLabel: string; // e.g., "This Month", "This Week" - not used in new design header
}

const getInitials = (name: string) => {
  if (!name || typeof name !== 'string') return '??';
  const names = name.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return names[0].charAt(0).toUpperCase() + (names[names.length - 1] ? names[names.length - 1].charAt(0).toUpperCase() : '');
};

const PodiumItem: React.FC<{ user: CrmPerformanceData; rank: number; isCenter?: boolean }> = ({ user, rank, isCenter }) => {
  const rankColors = {
    1: "bg-[hsl(var(--leaderboard-rank-badge-bg))]", // Teal/Blue
    2: "bg-[hsl(var(--leaderboard-rank-badge-bg))]", // Teal/Blue
    3: "bg-[hsl(var(--leaderboard-rank-badge-bg))]", // Teal/Blue
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: rank * 0.1 }}
      className={cn(
        "flex flex-col items-center text-center relative px-2 pt-3 pb-4 rounded-t-3xl shadow-lg bg-[hsl(var(--leaderboard-podium-bg))]",
        isCenter ? "w-[130px] sm:w-[150px] h-[190px] sm:h-[220px] mt-[-20px] z-10" : "w-[110px] sm:w-[130px] h-[170px] sm:h-[200px]"
      )}
    >
      <div className={cn(
        "absolute -top-3 left-1/2 -translate-x-1/2 flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full text-[hsl(var(--leaderboard-rank-badge-text))] font-bold text-sm sm:text-base border-2 border-white shadow-md",
        rankColors[rank as keyof typeof rankColors] || "bg-gray-400"
      )}>
        {rank}
      </div>
      <Avatar className={cn(
        "border-4 border-white shadow-xl overflow-hidden",
        isCenter ? "h-20 w-20 sm:h-24 sm:w-24 mt-3" : "h-16 w-16 sm:h-20 sm:w-20 mt-3"
      )}>
        <AvatarImage src={user.userAvatar || undefined} alt={user.userName} data-ai-hint="leaderboard user avatar" />
        <AvatarFallback className="bg-gray-700 text-white text-2xl sm:text-3xl">{getInitials(user.userName)}</AvatarFallback>
      </Avatar>
      <p className="font-semibold text-sm sm:text-base mt-2 truncate w-full px-1">{user.userName}</p>
      <p className="text-lg sm:text-xl font-bold mt-0.5">{user.ordersCompleted.toLocaleString()}</p>
    </motion.div>
  );
};

const RankListItem: React.FC<{ user: CrmPerformanceData; index: number }> = ({ user, index }) => (
  <motion.div
    layout
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20 }}
    transition={{ duration: 0.3, delay: index * 0.05 }}
    className="flex items-center py-3 px-4 border-b border-[hsl(var(--border))] last:border-b-0 bg-[hsl(var(--leaderboard-list-bg))] relative"
  >
    {/* Colored bar on the right edge */}
    {user.trend === 'up' && <div className="absolute right-0 top-0 bottom-0 w-1 bg-[hsl(var(--leaderboard-arrow-up))] rounded-l-sm"></div>}
    {user.trend === 'down' && <div className="absolute right-0 top-0 bottom-0 w-1 bg-[hsl(var(--leaderboard-arrow-down))] rounded-l-sm"></div>}
    {user.trend === 'same' && <div className="absolute right-0 top-0 bottom-0 w-1 bg-gray-300 dark:bg-gray-600 rounded-l-sm"></div>}

    <p className="font-semibold w-8 text-center text-sm text-[hsl(var(--leaderboard-list-text))]">{user.rank}</p>
    <Avatar className="mx-3 h-10 w-10 border-2 border-gray-200 dark:border-gray-700">
      <AvatarImage src={user.userAvatar || undefined} alt={user.userName} data-ai-hint="list user avatar" />
      <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{getInitials(user.userName)}</AvatarFallback>
    </Avatar>
    <div className="flex-1 min-w-0">
      <p className="font-medium truncate text-sm text-[hsl(var(--leaderboard-list-text))]">{user.userName}</p>
      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
        <div className="w-3 h-3 rounded-full bg-[hsl(var(--leaderboard-gold))] mr-1.5"></div>
        {user.ordersCompleted.toLocaleString()} pts
      </div>
    </div>
    {user.pointChange !== undefined && user.pointChange !== 0 && (
      <div className={cn(
        "flex items-center text-sm font-semibold ml-2",
        user.trend === 'up' ? "text-[hsl(var(--leaderboard-arrow-up))]" : "text-[hsl(var(--leaderboard-arrow-down))]"
      )}>
        {user.trend === 'up' ? "+" : "-"}
        {user.pointChange}
        {user.trend === 'up' ? <ArrowUp className="h-4 w-4 ml-0.5" /> : <ArrowDown className="h-4 w-4 ml-0.5" />}
      </div>
    )}
  </motion.div>
);

export function LeaderboardDisplay({ performanceData, currentUser, timePeriodLabel }: LeaderboardDisplayProps) {
  if (!performanceData || performanceData.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-10 text-[hsl(var(--leaderboard-text-light))]"
      >
        <p className="text-lg">No performance data available for {timePeriodLabel}.</p>
      </motion.div>
    );
  }

  const topThree = performanceData.slice(0, 3);
  const rest = performanceData.slice(3);

  // Ensure podium always has items in order 2, 1, 3 for layout
  const podiumUsers = {
    rank1: topThree.find(u => u.rank === 1),
    rank2: topThree.find(u => u.rank === 2),
    rank3: topThree.find(u => u.rank === 3),
  };

  return (
    <div className="relative z-10">
      {/* Podium Section */}
      {topThree.length > 0 && (
        <div className="px-4 pt-8 pb-12 sm:pt-10 sm:pb-16 relative">
          <Crown className="h-12 w-12 sm:h-16 sm:w-16 text-[hsl(var(--leaderboard-gold))] mx-auto mb-[-20px] sm:mb-[-25px] relative z-20 drop-shadow-lg" />
          <div className="flex justify-around items-end max-w-sm sm:max-w-md mx-auto">
            {podiumUsers.rank2 ? <PodiumItem user={podiumUsers.rank2} rank={2} /> : <div className="w-[110px] sm:w-[130px]"></div>}
            {podiumUsers.rank1 ? <PodiumItem user={podiumUsers.rank1} rank={1} isCenter /> : <div className="w-[130px] sm:w-[150px]"></div>}
            {podiumUsers.rank3 ? <PodiumItem user={podiumUsers.rank3} rank={3} /> : <div className="w-[110px] sm:w-[130px]"></div>}
          </div>
        </div>
      )}

      {/* List Section */}
      {performanceData.length > 0 && ( // Changed to check performanceData for the whole list container
        <div className="bg-[hsl(var(--leaderboard-list-bg))] rounded-t-[30px] sm:rounded-t-[40px] shadow-2xl pt-4 pb-8 min-h-[300px] mt-[-50px] sm:mt-[-60px]">
          <AnimatePresence>
            {rest.map((user, index) => (
              <RankListItem
                key={user.userId}
                user={user}
                index={index}
              />
            ))}
          </AnimatePresence>
          {rest.length === 0 && topThree.length > 0 && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">Only podium members this period.</p>
          )}
          {performanceData.length === 0 && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">No one on the leaderboard yet for {timePeriodLabel}.</p>
          )}
        </div>
      )}
    </div>
  );
}
