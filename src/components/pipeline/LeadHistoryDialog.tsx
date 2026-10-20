
"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Timeline, TimelineItem, TimelineConnector, TimelineHeader, TimelineTitle, TimelineIcon, TimelineDescription } from '@/components/ui/timeline';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Lead, User } from '@/types';
import { History, Activity, PhoneCall, FileText, Users, MapPin, MessageSquare, PlusCircle, User as UserIcon, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface LeadHistoryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  lead: Lead | null;
  allUsers: User[];
}

const formatDateSafe = (dateString?: string) => {
  if (!dateString) return 'No Date';
  try {
    return format(parseISO(dateString), 'd MMM yyyy, h:mm a');
  } catch (e) {
    return 'Invalid Date';
  }
};

const getInitials = (name: string | undefined) => {
  if (!name) return '??';
  const names = name.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return names[0].charAt(0).toUpperCase() + (names[names.length - 1] ? names[names.length - 1].charAt(0).toUpperCase() : '');
};

const getActivityIcon = (activityType: string) => {
    switch (activityType) {
        case 'Follow-up Call': return <PhoneCall className="h-4 w-4" />;
        case 'Sent Proposal': return <FileText className="h-4 w-4" />;
        case 'Meeting': return <Users className="h-4 w-4" />;
        case 'Site Visit': return <MapPin className="h-4 w-4" />;
        case 'Negotiation': return <MessageSquare className="h-4 w-4" />;
        case 'Lead Created': return <PlusCircle className="h-4 w-4" />;
        case 'No Response': return <PhoneCall className="h-4 w-4" />;
        default: 
            if (activityType.startsWith('Category:')) return <History className="h-4 w-4" />;
            return <Activity className="h-4 w-4" />;
    }
}

const getCategoryClass = (label: string) => {
    const LABEL_TO_CATEGORY: Record<string, string> = {
        'Intake Leads': 'POP',
        'New Lead': 'POP',
        'Proposal Sent': 'POG',
        'Budget Issue': 'BUDGET_ISSUE',
        'Cancelled': 'CANCELLED',
        'POG': 'POG',
        'Sales': 'OC',
        'Appointment': 'APPOINTMENT',
        'Prospect': 'PROSPECT',
    };
    const category = LABEL_TO_CATEGORY[label];
    switch (category) {
        case 'POP': return 'text-sky-800 bg-sky-100 border-sky-200';
        case 'APPOINTMENT': return 'text-indigo-800 bg-indigo-100 border-indigo-200';
        case 'PROSPECT': return 'text-pink-800 bg-pink-100 border-pink-200';
        case 'POG': return 'text-blue-800 bg-blue-100 border-blue-200';
        case 'OC': return 'text-purple-800 bg-purple-100 border-purple-200';
        case 'BUDGET_ISSUE': return 'text-amber-800 bg-amber-100 border-amber-200';
        case 'CANCELLED': return 'text-red-800 bg-red-100 border-red-200';
        default: return 'text-slate-800 bg-slate-100 border-slate-200';
    }
}

export function LeadHistoryDialog({ isOpen, onOpenChange, lead, allUsers }: LeadHistoryDialogProps) {
  if (!lead) return null;

  const sortedHistory = [...(lead.activityHistory || [])]
    .filter(item => item.activity.startsWith('Category:'))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Category Update History
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            Viewing history for <span className="font-semibold text-foreground">{lead.contactName}</span>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] mt-4 pr-4">
          <Timeline>
            {sortedHistory.map((item) => {
              const user = allUsers.find(u => u.id === item.changedByUserId);
              return (
                <TimelineItem key={item.id}>
                  <TimelineConnector />
                  <TimelineHeader>
                    <TimelineIcon>{getActivityIcon(item.activity)}</TimelineIcon>
                    <TimelineTitle className="text-sm font-semibold">
                        {item.activity === 'Lead Created' ? (
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-muted/50 text-[10px] py-0 px-2 font-medium border-primary/20">Initial</Badge>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                {(() => {
                                    const label = item.notes?.replace('Lead initially entered in ', '') || '';
                                    return <Badge className={cn("text-[10px] py-0 px-2 font-semibold shadow-none", getCategoryClass(label))}>{label}</Badge>
                                })()}
                            </div>
                        ) : item.activity.startsWith('Category:') ? (
                            <div className="flex items-center gap-2">
                                {(() => {
                                    const fromLabel = item.notes?.replace('Moved from ', '') || '';
                                    return <Badge variant="outline" className={cn("text-[10px] py-0 px-2 font-medium", getCategoryClass(fromLabel))}>{fromLabel}</Badge>
                                })()}
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                {(() => {
                                    const toLabel = item.activity.replace('Category: ', '') || '';
                                    return <Badge className={cn("text-[10px] py-0 px-2 font-semibold shadow-none", getCategoryClass(toLabel))}>{toLabel}</Badge>
                                })()}
                            </div>
                        ) : (
                            item.activity
                        )}
                    </TimelineTitle>
                    <span className="text-[10px] text-muted-foreground ml-auto">{formatDateSafe(item.timestamp)}</span>
                  </TimelineHeader>
                  <TimelineDescription className="space-y-2 pb-4">
                    {(!item.activity.startsWith('Category:') && item.activity !== 'Lead Created' && item.notes) && (
                        <p className="text-xs text-foreground/80 bg-muted/30 p-2 rounded-md border border-border/50">{item.notes}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5 text-[8px]">
                        <AvatarImage src={user?.avatarUrl || undefined} alt={item.changedByUserName} />
                        <AvatarFallback>{getInitials(item.changedByUserName)}</AvatarFallback>
                      </Avatar>
                      <span className="text-[10px] text-muted-foreground italic">Updated by: {item.changedByUserName}</span>
                    </div>
                  </TimelineDescription>
                </TimelineItem>
              );
            })}
            {sortedHistory.length === 0 && (
              <div className="text-center text-muted-foreground py-10 text-sm">
                No activity history found.
              </div>
            )}
          </Timeline>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
