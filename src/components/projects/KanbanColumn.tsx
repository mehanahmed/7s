"use client";

import type { Project, CustomStatus, User } from '@/types';
import { ProjectCard } from './ProjectCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LucideIcon } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Loader2 } from 'lucide-react';


interface KanbanColumnProps {
  id: string;
  title: string;
  icon: LucideIcon;
  projects: Project[];
  headerBgClass: string;
  headerTextClass?: string;
  headerIconClass?: string;
  isLoading?: boolean;
  currentUser: User | null;
  allStatuses: CustomStatus[];
  allUsers: User[];
  onOpenAssignDrDialog: (project: Project) => void;
  onViewLead?: (project: Project) => void;
  isSearching?: boolean;
}

const PROJECTS_PER_PAGE = 20;

const KanbanColumnComponent = function KanbanColumn({
  id,
  title,
  icon: Icon,
  projects,
  headerBgClass,
  headerTextClass = "text-white",
  headerIconClass = "text-white",
  isLoading = false,
  currentUser,
  allStatuses,
  allUsers,
  onOpenAssignDrDialog,
  onViewLead = () => { },
  isSearching = false,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [visibleCount, setVisibleCount] = useState(PROJECTS_PER_PAGE);

  // Optimization: Only reset visible count when the search state changes, 
  // not on every data refresh to avoid double renders and jumping UI.
  const projectsLength = projects.length;
  const prevProjectsLength = React.useRef(projectsLength);

  useEffect(() => {
    // If the length changed significantly (likely a filter/search change), reset.
    // If it's just a minor change, keep the visible count.
    if (Math.abs(projectsLength - prevProjectsLength.current) > 5 || isSearching) {
       setVisibleCount(PROJECTS_PER_PAGE);
    }
    prevProjectsLength.current = projectsLength;
  }, [projectsLength, isSearching]);

  const handleLoadMore = () => {
    setVisibleCount(prevCount => prevCount + PROJECTS_PER_PAGE);
  };

  const visibleProjects = useMemo(() => projects.slice(0, visibleCount), [projects, visibleCount]);
  const hasMoreProjects = visibleCount < projects.length;

  const { ref: observerRef, inView } = useInView({
    threshold: 0.1,
  });

  useEffect(() => {
    if (inView && hasMoreProjects) {
      handleLoadMore();
    }
  }, [inView, hasMoreProjects]);


  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-[280px] sm:w-[300px] shrink-0 flex flex-col bg-muted/30 rounded-lg overflow-hidden transition-all duration-200 ease-in-out h-full",
        isOver ? 'border-primary ring-2 ring-primary shadow-xl scale-[1.01]' : 'border-border/30 shadow-sm'
      )}
    >
      <div className={`px-3 py-2.5 flex items-center justify-between ${headerBgClass} ${headerTextClass} rounded-t-lg shrink-0`}>
        <div className="flex items-center">
          <Icon className={`mr-2 h-4 w-4 ${headerIconClass}`} />
          <h2 className="font-semibold text-sm tracking-wide">{title}</h2>
        </div>
        <span className="text-xs px-2 py-0.5 bg-black/20 rounded-full">{isLoading ? <Skeleton className="h-4 w-4 inline-block" /> : projects.length}</span>
      </div>
      <ScrollArea className="flex-1 bg-background/10 custom-scrollbar">
        <div className="p-3 min-h-full">
          <motion.div layout className="space-y-3">
            {isLoading && projects.length === 0 ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-md" />
                <Skeleton className="h-20 w-full rounded-md" />
                <Skeleton className="h-20 w-full rounded-md" />
              </div>
            ) : visibleProjects.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-xs text-muted-foreground text-center italic">No projects in this stage.</p>
              </div>
            ) : (
              <AnimatePresence initial={false} mode="popLayout">
                {visibleProjects.map((project) => (
                  <motion.div
                    key={project.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{
                      opacity: 0,
                      scale: 0.9,
                      height: 0,
                      marginBottom: 0,
                      transition: { duration: 0.2 }
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <ProjectCard
                      project={project}
                      currentUser={currentUser}
                      allStatuses={allStatuses}
                      allUsers={allUsers}
                      onOpenAssignDrDialog={onOpenAssignDrDialog}
                      onViewLead={onViewLead}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </motion.div>
          {hasMoreProjects && (
            <div ref={observerRef} className="flex justify-center p-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export const KanbanColumn = React.memo(KanbanColumnComponent, (prev, next) => {
  return (
    prev.projects.length === next.projects.length &&
    prev.isLoading === next.isLoading &&
    prev.id === next.id &&
    prev.currentUser?.id === next.currentUser?.id &&
    prev.projects === next.projects // This is a shallow check but usually projects array is new if data changed
  );
});