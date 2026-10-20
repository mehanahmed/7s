"use client";

import { PROJECT_STAGE_CONFIG, timestampFieldForStage, STAGE_ASSIGN_ROLE } from '@/lib/project-stages';
import type { Project, CustomStatus, User } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarDays, User as UserIconLucide, ReceiptText, UserCheck, Star, BadgeCheck } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import NextLink from 'next/link';
import { Progress } from '@/components/ui/progress';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { parseISO, differenceInSeconds, isAfter, isBefore, addHours, addDays, formatDistanceToNowStrict } from 'date-fns';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { removeOrderApprovalAction } from '@/app/track/[trackingId]/actions';
import { isDrRole } from '@/lib/roles';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Inline SVG Stopwatch Icon Component
const StopwatchIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="14" r="8" />
    <line x1="12" y1="6" x2="12" y2="2" />
    <line x1="10" y1="2" x2="14" y2="2" />
    <path d="M12 14l2-2" />
  </svg>
);

interface ProjectCardProps {
  project: Project;
  isOverlay?: boolean;
  currentUser: User | null;
  allStatuses: CustomStatus[];
  allUsers: User[];
  onOpenAssignDrDialog: (project: Project) => void;
  onViewLead: (project: Project) => void;
}

function formatDurationPrecise(totalSeconds: number): string {
  if (totalSeconds <= 0) return "Due";

  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  let parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 && days < 1) parts.push(`${minutes}m`);
  } else if (hours > 0) {
    parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 && hours < 1) parts.push(`${seconds}s`);
  } else if (minutes > 0) {
    parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);
  } else if (seconds > 0) {
    return "<1s";
  }

  if (parts.length === 0) {
    return "Due";
  }

  return parts.join(' ');
}

interface ProgressInfo {
  showProgressBar: boolean;
  percentage: number;
  displayText: string;
  isOverdue: boolean;
  progressColorClass: string;
  stageTargetDate: string;
}

// Every active stage gets an equal share of the delivery window.
const STAGE_WEIGHTS: Record<string, number> = {};
const TOTAL_WEIGHT = 12;

const formatSlaHours = (hours: number): string => {
  const d = Math.floor(hours / 24);
  const h = hours % 24;

  if (h === 0) {
    if (d === 1) return `1 Day SLA`;
    return `${d} Days SLA`;
  } else {
    if (d === 0) {
      if (h === 1) return `1 Hour SLA`;
      return `${h} Hours SLA`;
    }
    return `${d}d ${h}H SLA`;
  }
};

const calculateProgressInfo = (
  project: Project,
  now: Date
): ProgressInfo => {

  const { status, createdAt, updatedAt, endDate, deliveredAt } = project;

  let effectiveStartDateIso: string | null | undefined;

  const startField = timestampFieldForStage(status);
  effectiveStartDateIso = startField ? (project[startField] as string | null | undefined) : undefined;

  if (!effectiveStartDateIso) {
    effectiveStartDateIso = createdAt || updatedAt;
  }

  if (!effectiveStartDateIso) {
    return { showProgressBar: true, percentage: 0, displayText: "Start date missing", isOverdue: false, progressColorClass: "bg-muted", stageTargetDate: 'N/A' };
  }

  let effectiveStartDate = parseISO(effectiveStartDateIso);
  let effectiveTargetDate = endDate ? parseISO(endDate) : now;
  let slaStageName: string | null = null;
  let showProgressBar = true;
  let progressColorClass = 'progress-indicator-gradient';

  if (status === 'Project Delivered') {
    showProgressBar = false;
    let stageTargetDate = 'N/A';
    if (status === 'Project Delivered') {
      const dateToUse = deliveredAt || endDate || updatedAt || createdAt;
      if (dateToUse) {
        try {
          stageTargetDate = parseISO(dateToUse).toLocaleDateString();
        } catch (e) {
          stageTargetDate = 'N/A';
        }
      }
    } else {
      const dateToUse = endDate || updatedAt || createdAt;
      if (dateToUse) {
        try {
          stageTargetDate = parseISO(dateToUse).toLocaleDateString();
        } catch (e) {
          stageTargetDate = 'N/A';
        }
      }
    }
    return { showProgressBar, percentage: 0, displayText: "", isOverdue: false, progressColorClass: "", stageTargetDate };
  }

  if (endDate) {
    const timestamps = [createdAt, updatedAt, ...PROJECT_STAGE_CONFIG.map((st) => project[st.timestampField] as string | null | undefined)]
    .filter(Boolean).map(t => parseISO(t!));

    const projectStart = timestamps.length > 0 
      ? new Date(Math.min(...timestamps.map(d => d.getTime()))) 
      : effectiveStartDate;

    const projectEnd = parseISO(endDate);
    const totalDeliveryDays = Math.max(1, differenceInSeconds(projectEnd, projectStart) / 86400);

    if (status === 'On Hold') {
      effectiveTargetDate = addDays(effectiveStartDate, 15);
      slaStageName = " (Max 15 Days)";
    } else {
      const weight = STAGE_WEIGHTS[status] || 1.0;
      const allocatedDays = (weight / TOTAL_WEIGHT) * totalDeliveryDays;
      effectiveTargetDate = new Date(effectiveStartDate.getTime() + Math.round(allocatedDays * 86400000));
      
      const totalHours = Math.max(1, Math.round(allocatedDays * 24));
      slaStageName = ` (${formatSlaHours(totalHours)})`;
    }
  } else {
    switch (status) {
      case 'On Script':
        effectiveTargetDate = addHours(effectiveStartDate, 48);
        slaStageName = ` (${formatSlaHours(48)})`;
        break;
      case 'On Hold':
        effectiveTargetDate = addDays(effectiveStartDate, 15);
        slaStageName = " (Max 15 Days)";
        break;
      default:
        effectiveTargetDate = addHours(effectiveStartDate, 24);
        slaStageName = ` (${formatSlaHours(24)})`;
    }
  }

  let currentPercentage: number;
  let currentDisplayText: string;
  let currentIsOverdue = false;

  if (isAfter(now, effectiveTargetDate)) {
    currentIsOverdue = true;
    const timeOver = formatDistanceToNowStrict(effectiveTargetDate, { addSuffix: false });
    currentDisplayText = `Overdue by ${timeOver}`;
    progressColorClass = 'bg-destructive';
    currentPercentage = 100;
  } else if (
    isBefore(now, effectiveStartDate) && status !== 'On Hold'
  ) {
    const timeUntilStart = formatDistanceToNowStrict(effectiveStartDate, { addSuffix: false });
    currentDisplayText = `Starts in ${timeUntilStart}`;
    currentPercentage = 0;
  } else {
    const secondsRemaining = differenceInSeconds(effectiveTargetDate, now);
    if (secondsRemaining <= 0) {
      currentDisplayText = (status === 'On Hold') ? "Hold period ended" : (endDate ? "Delivery date reached" : "Stage due");
      currentPercentage = 100;
      progressColorClass = isAfter(now, effectiveTargetDate) ? 'bg-destructive' : 'bg-yellow-500';
    } else {
      currentDisplayText = `${formatDurationPrecise(secondsRemaining)} remaining`;
      const totalDurationSeconds = differenceInSeconds(effectiveTargetDate, effectiveStartDate);
      const elapsedDurationSeconds = differenceInSeconds(now, effectiveStartDate);
      currentPercentage = totalDurationSeconds > 0 ? Math.max(0, Math.min(100, (elapsedDurationSeconds / totalDurationSeconds) * 100)) : (isAfter(now, effectiveStartDate) ? 100 : 0);
    }
  }

  if (slaStageName && !currentIsOverdue) {
    currentDisplayText += slaStageName;
  } else if (currentIsOverdue && slaStageName) {
    currentDisplayText += slaStageName;
  }

  return {
    showProgressBar,
    percentage: Math.round(currentPercentage),
    displayText: currentDisplayText,
    isOverdue: currentIsOverdue,
    progressColorClass,
    stageTargetDate: effectiveTargetDate.toLocaleDateString(),
  };
};

const ProjectCardComponent = function ProjectCard({ project, isOverlay = false, currentUser, allStatuses, allUsers, onOpenAssignDrDialog, onViewLead }: ProjectCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleRemoveApprovalClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentUser?.role !== 'SYSTEM_ADMIN') return;

    if (window.confirm("Are you sure you want to remove the client's approval for this project?")) {
      try {
        const result = await removeOrderApprovalAction(project.id);
        if ('error' in result) {
          alert(`Failed to remove approval: ${result.error}`);
        } else {
          toast({
            title: "Approval Removed",
            description: "The client's approval has been successfully removed.",
          });
          router.refresh();
        }
      } catch (err) {
        console.error(err);
        alert("An error occurred while removing approval.");
      }
    }
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
    data: { project },
    disabled: isOverlay || !isMounted,
  });


  const style = !isOverlay && transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined;

  const getInitials = (name: string | undefined): string => {
    if (!name) return '??';
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return names[0].charAt(0).toUpperCase() + (names[names.length - 1] ? names[names.length - 1].charAt(0).toUpperCase() : '');
  };

  const [progressInfo, setProgressInfo] = useState<ProgressInfo>(() =>
    calculateProgressInfo(project, new Date())
  );

  useEffect(() => {
    const updateInfo = () => {
      setProgressInfo(calculateProgressInfo(project, new Date()));
    };
    updateInfo();
    const intervalId = setInterval(updateInfo, 5000);
    return () => clearInterval(intervalId);
  }, [project]);

  const crmUser = allUsers.find(user => user.id === project.assigneeId);
  const drUser = allUsers.find(user => user.id === project.designerRepresentativeId);
  const truncatedProjectName = project.name.length > 35
    ? project.name.substring(0, 35) + '...'
    : project.name;

  const canAssignDrPermission =
    (currentUser?.role === 'SYSTEM_ADMIN' ||
      currentUser?.role === 'ADMIN' ||
      currentUser?.role === 'CR' ||
      ((currentUser && isDrRole(currentUser.role)) && currentUser.isLeader));

  const canOpenDialogFromProjectCard = (project.status === 'CR Clearance' || project.status === 'On Script' || project.status === 'Operation Manager');


  const crmInfoClickable = canAssignDrPermission && canOpenDialogFromProjectCard && !project.designerRepresentativeName;
  const drInfoClickable = canAssignDrPermission && canOpenDialogFromProjectCard && !!project.designerRepresentativeName;

  const dndAttributes = isMounted ? listeners : {};
  const dndProps = isMounted ? { ...attributes, ...listeners } : {};

  return (
    <motion.div
      ref={!isOverlay ? setNodeRef : null}
      style={style}
      {...(!isOverlay ? dndProps : {})}
      animate={{
        scale: !isOverlay && isDragging ? 1.05 : (isOverlay ? 0.95 : 1),
        opacity: !isOverlay && isDragging ? 0.4 : 1,
        boxShadow: isOverlay
          ? "0px 10px 25px -5px rgba(0, 0, 0, 0.2), 0px 5px 10px -6px rgba(0, 0, 0, 0.2)"
          : "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
        rotate: isOverlay ? 2 : 0,
      }}
      transition={{ duration: 0.15, ease: "easeInOut" }}
      className={cn(
        "relative group",
        isOverlay ? "z-50" : (isDragging ? "z-50" : "")
      )}
      onClick={() => isMounted && !isOverlay && onViewLead(project)}
    >
      <Card
        className={cn(
          "bg-card w-full shadow-none",
          isOverlay ? "cursor-grabbing" : (isDragging ? "ring-2 ring-primary cursor-grabbing" : "cursor-grab active:cursor-grabbing")
        )}
      >
        <CardContent className="p-3 space-y-2.5">
          <div className="flex justify-between items-start">
            <span className="text-sm font-semibold text-foreground truncate">{project.projectIdDisplay}</span>
            {!isOverlay && (
              <NextLink
                href={`/track/${project.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), "h-6 w-6")}
                onClick={(e) => e.stopPropagation()}
                title="View Invoice / Order Details"
              >
                <ReceiptText className="h-4 w-4 text-muted-foreground hover:text-primary" />
              </NextLink>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground" title={project.name}>{truncatedProjectName}</p>
          </div>

          <NextLink
            href={`/track/${project.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="View Public Tracking Page"
          >
            <div className={cn(
              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors",
              project.status === 'Project Delivered'
                ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/30"
                : "border-destructive/30 bg-destructive/20 text-destructive hover:bg-destructive/30"
            )}>
              <CalendarDays className="mr-1.5 h-3 w-3" />
              {project.status === 'Project Delivered' ? 'Delivered' : 'Target'}: {progressInfo.stageTargetDate}
            </div>
          </NextLink>

          {progressInfo.showProgressBar && (
            <div className="pt-1">
              <div className="flex items-center space-x-2 mb-1">
                <StopwatchIcon className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs font-medium text-muted-foreground truncate" title={progressInfo.displayText}>{progressInfo.displayText}</span>
              </div>
              <Progress
                value={progressInfo.percentage}
                className="h-2.5 rounded-full bg-secondary shadow-inner"
                indicatorClassName={progressInfo.progressColorClass}
              />
            </div>
          )}

          <div className="flex items-center justify-start mt-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn('hover:bg-muted/50 p-1 -m-1 rounded-md transition-colors', crmInfoClickable && 'cursor-pointer')}
                    onClick={crmInfoClickable ? event => { event.stopPropagation(); onOpenAssignDrDialog(project); } : undefined}>
                    <Avatar className="h-7 w-7 text-xs border bg-muted">
                      <AvatarImage src={crmUser?.avatarUrl || undefined} alt={project.assigneeName} data-ai-hint="assignee avatar" />
                      <AvatarFallback className="text-muted-foreground font-semibold">{getInitials(project.assigneeInitials || project.assigneeName)}</AvatarFallback>
                    </Avatar>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>CR: {project.assigneeName}</p>
                  {crmInfoClickable && <p className="text-xs text-primary">(Click to assign DR)</p>}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {project.designerRepresentativeName && (
              <>
                <div className="w-px h-5 bg-border mx-1.5"></div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn('hover:bg-muted/50 p-1 -m-1 rounded-md transition-colors', drInfoClickable && 'cursor-pointer')}
                        onClick={drInfoClickable ? event => { event.stopPropagation(); onOpenAssignDrDialog(project); } : undefined}>
                        <Avatar className="h-7 w-7 text-xs border border-blue-400 bg-muted">
                          <AvatarImage src={drUser?.avatarUrl || project.designerRepresentativeAvatarUrl || undefined} alt={project.designerRepresentativeName} data-ai-hint="assignee avatar" />
                          <AvatarFallback className="text-blue-500 font-semibold">{getInitials(project.designerRepresentativeName)}</AvatarFallback>
                        </Avatar>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>DR: {project.designerRepresentativeName}</p>
                      {drInfoClickable && <p className="text-xs text-primary">(Click to re-assign DR)</p>}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
            {Object.keys(project.stageAssignees ?? {}).length > 0 && (
              <>
                <div className="mx-1.5 h-5 w-px bg-border"></div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex cursor-default items-center">
                        {Object.entries(project.stageAssignees ?? {}).map(([role, who]) => {
                          const person = allUsers.find(user => user.id === who.id);
                          return (
                            <Avatar key={role} className="-ml-2 h-7 w-7 border border-blue-400 bg-muted text-xs ring-2 ring-card first:ml-0">
                              <AvatarImage src={person?.avatarUrl || undefined} alt={who.name} data-ai-hint="assignee avatar" />
                              <AvatarFallback className="font-semibold text-blue-500">{getInitials(who.name)}</AvatarFallback>
                            </Avatar>
                          );
                        })}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="p-2">
                      <div className="space-y-1.5">
                        {Object.entries(project.stageAssignees ?? {}).map(([role, who]) => {
                          const person = allUsers.find(user => user.id === who.id);
                          const roleLabel = Object.values(STAGE_ASSIGN_ROLE).find(config => config?.role === role)?.label ?? role;
                          return (
                            <div key={role} className="flex items-center gap-2">
                              <Avatar className="h-6 w-6 border border-blue-400 bg-muted text-[10px]">
                                <AvatarImage src={person?.avatarUrl || undefined} alt={who.name} />
                                <AvatarFallback className="font-semibold text-blue-500">{getInitials(who.name)}</AvatarFallback>
                              </Avatar>
                              <div className="leading-tight">
                                <p className="text-xs font-medium">{who.name}</p>
                                <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
            <div className="ml-auto flex items-center gap-1 shrink-0">
              {project.isDesignApproved ? (
                <BadgeCheck 
                  className={cn(
                    "h-4 w-4 text-white fill-green-600 dark:fill-green-500 dark:text-black shrink-0",
                    currentUser?.role === 'SYSTEM_ADMIN' && "cursor-pointer hover:scale-110 transition-transform"
                  )}
                  onClick={currentUser?.role === 'SYSTEM_ADMIN' ? handleRemoveApprovalClick : undefined}
                />
              ) : project.isDocsApproved ? (
                <BadgeCheck 
                  className={cn(
                    "h-4 w-4 text-white fill-black dark:fill-white dark:text-black shrink-0",
                    currentUser?.role === 'SYSTEM_ADMIN' && "cursor-pointer hover:scale-110 transition-transform"
                  )}
                  onClick={currentUser?.role === 'SYSTEM_ADMIN' ? handleRemoveApprovalClick : undefined}
                />
              ) : null}
              {project.isStarred !== undefined && project.isStarred > 0 && (
                <div className="flex items-center gap-0.5 shrink-0" title={`${project.isStarred.toFixed(1)} Stars Priority`}>
                  {[1, 2, 3, 4, 5].map((starIndex) => {
                    const rating = project.isStarred || 0;
                    const isFull = rating >= starIndex;
                    const isHalf = !isFull && rating >= starIndex - 0.5;

                    return (
                      <div key={starIndex} className="relative shrink-0">
                        {isFull ? (
                          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                        ) : isHalf ? (
                          <div className="relative">
                            <Star className="h-3.5 w-3.5 text-muted-foreground/30 dark:text-muted-foreground/20" />
                            <div className="absolute top-0 left-0 overflow-hidden w-[50%] h-full">
                              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                            </div>
                          </div>
                        ) : (
                          <Star className="h-3.5 w-3.5 text-muted-foreground/30 dark:text-muted-foreground/20" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export const ProjectCard = React.memo(ProjectCardComponent, (prevProps, nextProps) => {
  // Only re-render if essential props change
  return (
    prevProps.project.id === nextProps.project.id &&
    prevProps.project.status === nextProps.project.status &&
    prevProps.project.updatedAt === nextProps.project.updatedAt &&
    prevProps.project.name === nextProps.project.name &&
    prevProps.project.endDate === nextProps.project.endDate &&
    prevProps.project.deliveredAt === nextProps.project.deliveredAt &&
    prevProps.project.cancelAt === nextProps.project.cancelAt &&
    prevProps.project.isStarred === nextProps.project.isStarred &&
    prevProps.project.isDocsApproved === nextProps.project.isDocsApproved &&
    prevProps.project.isDesignApproved === nextProps.project.isDesignApproved &&
    prevProps.project.designerRepresentativeId === nextProps.project.designerRepresentativeId &&
    JSON.stringify(prevProps.project.stageAssignees ?? null) === JSON.stringify(nextProps.project.stageAssignees ?? null) &&
    prevProps.currentUser?.id === nextProps.currentUser?.id &&
    prevProps.isOverlay === nextProps.isOverlay &&
    prevProps.allStatuses.length === nextProps.allStatuses.length &&
    prevProps.allUsers.length === nextProps.allUsers.length
  );
});