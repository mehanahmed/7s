"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TrackingLink, CustomStatus, OrderLogEntry, User as UserType } from "@/types";
import { format } from 'date-fns';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileText, ReceiptText, Landmark, Percent, History, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface OrderHistoryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  order: TrackingLink;
  allStatuses: CustomStatus[];
  allUsers: UserType[];
}

export function OrderHistoryDialog({ isOpen, onOpenChange, order, allStatuses, allUsers }: OrderHistoryDialogProps) {
  const getStatusName = (statusId: string) => {
    const status = allStatuses.find(s => s.id === statusId);
    return status ? status.name : statusId;
  };

  const getStatusColor = (statusId: string) => {
    const status = allStatuses.find(s => s.id === statusId);
    return status ? status.color : '#A1A1AA';
  };

  const sortedHistory = [...(order.statusHistory || [])].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const groupedHistory = React.useMemo(() => {
    const groups: OrderLogEntry[][] = [];
    let currentGroup: OrderLogEntry[] = [];

    sortedHistory.forEach((log, index) => {
      if (index === 0) {
        currentGroup.push(log);
      } else {
        const prevLog = sortedHistory[index - 1];
        // Exact timestamp match and same user match
        const isSameTime = log.timestamp === prevLog.timestamp;
        const isSameUser = log.changedByUserId === prevLog.changedByUserId;

        if (isSameTime && isSameUser) {
          currentGroup.push(log);
        } else {
          groups.push(currentGroup);
          currentGroup = [log];
        }
      }
    });

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }, [sortedHistory]);

  const getIcon = (log: OrderLogEntry) => {
    switch (log.type) {
      case 'invoice':
        return <ReceiptText className="h-4 w-4 text-blue-500" />;
      case 'payment':
        return <Landmark className="h-4 w-4 text-green-500" />;
      case 'discount':
        return <Percent className="h-4 w-4 text-purple-500" />;
      case 'system':
        return <History className="h-4 w-4 text-gray-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4" style={{ color: getStatusColor(log.status) }} />;
    }
  };

  const getTypeLabel = (log: OrderLogEntry) => {
    switch (log.type) {
      case 'invoice': return 'Invoice Update';
      case 'payment': return 'Payment Recorded';
      case 'discount': return 'Discount Adjustment';
      case 'system': return 'System Event';
      default: return getStatusName(log.status);
    }
  };

  const getUserData = (userId: string) => {
    return allUsers.find(u => u.id === userId);
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-background/95 backdrop-blur-sm">
        <DialogHeader className="p-8 pb-6 bg-gradient-to-br from-primary/95 to-primary text-primary-foreground relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <History className="h-24 w-24" />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md">
              <History className="h-5 w-5" />
            </div>
            Order History
          </DialogTitle>
          <p className="text-primary-foreground/70 text-sm mt-2 font-medium">
            Order <span className="text-white font-bold px-1.5 py-0.5 bg-white/10 rounded uppercase tracking-wider text-[10px]">{order.id}</span> • Detail audit trail
          </p>
        </DialogHeader>

        <ScrollArea className="flex-grow px-8 py-6">
          <div className="space-y-10 relative before:absolute before:inset-0 before:left-3.5 before:w-[1.5px] before:bg-gradient-to-b before:from-primary/20 before:via-muted/50 before:to-transparent before:h-full">
            {groupedHistory.length > 0 ? (
              groupedHistory.map((group, groupIndex) => {
                const firstLog = group[0];
                const isStatusChange = group.length === 1 && !firstLog.type;

                return (
                  <div key={groupIndex} className="relative pl-12 group animate-in fade-in slide-in-from-left-4 duration-500">
                    {/* Timeline Dot/Icon */}
                    <div className={cn(
                      "absolute left-0 top-1 h-7 w-7 rounded-full border-2 border-background flex items-center justify-center z-10 shadow-md transition-all duration-300 group-hover:scale-110",
                      isStatusChange ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border-muted-foreground/10"
                    )}>
                      {group.length > 1 ? (
                        <History className="h-3 w-3" />
                      ) : (
                        <div className="scale-75">{getIcon(firstLog)}</div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 bg-card/40 backdrop-blur-sm p-5 rounded-2xl border border-border/40 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-lg hover:bg-card/60 transition-all duration-300">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-xs text-muted-foreground/70 uppercase tracking-[0.15em]">
                            {group.length > 1 ? "Order Transaction" : getTypeLabel(firstLog)}
                          </span>
                          <div className="flex items-center gap-2">
                             <h3 className="font-semibold text-foreground text-sm">
                               {group.length > 1 ? "Multiple Updates" : "System Entry"}
                             </h3>
                             {group.length > 1 && (
                               <Badge variant="secondary" className="text-[9px] h-3.5 px-1.5 leading-none font-bold bg-primary/10 text-primary border-none">
                                 {group.length} ACTIONS
                               </Badge>
                             )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold whitespace-nowrap bg-muted/30 px-2.5 py-1 rounded-full border border-border/30">
                          <Clock className="h-2.5 w-2.5 opacity-60" />
                          {format(new Date(firstLog.timestamp), 'h:mm a')}
                          <span className="opacity-30">•</span>
                          {format(new Date(firstLog.timestamp), 'd MMM yyyy')}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {group.map((log) => (
                          <div key={log.id} className={cn(
                            "text-[13px] leading-relaxed py-2.5 px-4 rounded-xl border-l-[3px] transition-colors",
                            log.type === 'invoice' ? "bg-blue-50/20 border-blue-500/50 text-foreground" :
                            log.type === 'payment' ? "bg-emerald-50/20 border-emerald-500/50 text-foreground" :
                            log.type === 'discount' ? "bg-blue-50/20 border-blue-500/50 text-foreground" :
                            "bg-muted/10 border-muted-foreground/20 text-muted-foreground"
                          )}>
                             <div className="flex items-center gap-2 mb-1 opacity-50 font-bold text-[9px] uppercase tracking-wider">
                                {log.type || 'status'}
                             </div>
                             {(log.notes ?? '').split(/(Proof:\s*(?:\/uploads\/|https?:\/\/)\S+)/i).map((part, i) =>
                               /^Proof:/i.test(part)
                                 ? <a key={i} href={part.replace(/^Proof:\s*/i, '')} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">View proof</a>
                                 : <React.Fragment key={i}>{part}</React.Fragment>
                             )}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 mt-2 pt-3 border-t border-border/5">
                        <div className="relative">
                          <Avatar className="h-6 w-6 border-2 border-background ring-1 ring-border/10">
                            <AvatarImage src={getUserData(firstLog.changedByUserId)?.avatarUrl || ''} />
                            <AvatarFallback className="text-[9px] bg-muted text-muted-foreground font-bold">
                              {getInitials(firstLog.changedByUserName)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Processed by <span className="font-bold text-foreground/80">{firstLog.changedByUserId === order.crmUserId ? "System Logic" : firstLog.changedByUserName}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-20 flex flex-col items-center gap-5">
                <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center relative">
                   <div className="absolute inset-0 rounded-full bg-primary/5 animate-ping opacity-20" />
                   <Clock className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-lg text-foreground/80 tracking-tight">Timeline Empty</p>
                  <p className="text-sm text-muted-foreground w-64 mx-auto leading-relaxed">This order hasn't recorded any status changes or updates yet.</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
