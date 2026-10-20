

"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Generic Timeline Component
interface StatusTimelineProps {
  counts: Record<string, number>;
  config: { title: string; icon: React.ElementType; color: string; gradient: string; shadow: string;[key: string]: any }[];
  isLoading: boolean;
  title: string;
}

export const StatusTimeline: React.FC<StatusTimelineProps> = ({ counts, config, isLoading, title }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);


  useEffect(() => {
    if (isLoading || config.length === 0 || !isClient) return;
    const interval = setInterval(() => {
      setActiveIndex((prevIndex) => (prevIndex + 1) % config.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isLoading, config.length, isClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-between p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 flex-1">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (config.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        No {title.toLowerCase()} stages are visible for your role.
      </div>
    );
  }

  const progressPercentage = activeIndex > 0 ? (activeIndex / (config.length - 1)) * 100 : 0;

  const getGradient = () => {
    if (activeIndex === 0) {
      return config[0]?.gradient || 'hsl(var(--primary))';
    }
    const colors = config.slice(0, activeIndex + 1).map(step => step.color);
    return `linear-gradient(to right, ${colors.join(', ')})`;
  };

  return (
    <div className="w-full overflow-x-auto py-2 sm:py-4 custom-scrollbar-hidden select-none">
      <div className="relative flex items-center justify-between min-w-max px-4">
        {/* The background line */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-muted/40 dark:bg-muted/10 rounded-full transform -translate-y-[calc(50%+1.2rem)] sm:-translate-y-[calc(50%+1rem)]"></div>

        {/* The animated progress bar */}
        <div className="absolute top-1/2 left-0 h-1 rounded-full transform -translate-y-[calc(50%+1.2rem)] sm:-translate-y-[calc(50%+1rem)]" style={{ width: '100%' }}>
          <motion.div
            className="h-full rounded-full"
            animate={{
              width: `${progressPercentage}%`,
              background: getGradient(),
              boxShadow: config[activeIndex]?.shadow || 'none',
            }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </div>

        {config.map((step, index) => {
          const isActive = index === activeIndex;
          const key = step.status || step.category;
          return (
            <motion.div
              key={key}
              className="relative z-10 flex flex-col items-center flex-1 min-w-[70px] sm:min-w-[90px]"
              animate={{ scale: isActive ? 1.05 : 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              {/* The colored circle */}
              <div
                className={cn(
                  "rounded-full flex items-center justify-center text-white font-bold transition-all shadow-md",
                  "h-12 w-12 sm:h-16 sm:w-16 border-2 sm:border-4 text-base sm:text-xl"
                )}
                style={{
                  backgroundColor: step.color,
                  borderColor: isActive ? step.color : 'hsl(var(--background))'
                }}
              >
                {counts[key as keyof typeof counts]}
              </div>
              {/* The label */}
              <p
                className="mt-2 text-[10px] sm:text-xs font-bold sm:font-medium text-center transition-colors uppercase tracking-tight sm:tracking-normal"
                style={{ color: isActive ? step.color : 'hsl(var(--muted-foreground))' }}
              >
                {step.title}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
