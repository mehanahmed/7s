
"use client";

import React, { useState, FormEvent, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Timeline, TimelineItem, TimelineConnector, TimelineHeader, TimelineTitle, TimelineIcon, TimelineDescription } from '@/components/ui/timeline';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { addLeadActivityAction, getLeadByIdAction, deleteLeadActivityAction } from '@/app/(app)/pipeline/actions';
import type { Lead, User, LeadActivity } from '@/types';
import { Loader2, Edit, Phone, Building, MapPin, StickyNote, Bot, CalendarDays, User as UserIcon, Activity, Briefcase, PhoneCall, FileText, Users, MessageSquare, PlusCircle, Trash2, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { LEAD_CATEGORY_LABELS } from '@/lib/pipeline-constants';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";


interface ViewLeadDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onLeadUpdated: (updatedLead: Lead) => void;
  onEditRequest: (lead: Lead) => void;
  lead: Lead | null;
  currentUser: User;
}

const formatDateSafe = (dateString?: string, includeTime: boolean = false) => {
  if (!dateString) return 'No Date';
  try {
    const formatString = includeTime ? 'd MMM yyyy, h:mm a' : 'd MMM yyyy';
    return format(parseISO(dateString), formatString);
  } catch (e) {
    return 'Invalid Date';
  }
};

const getCategoryClass = (category: string) => {
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

const getActivityIcon = (activityType: string) => {
    switch (activityType) {
        case 'Follow-up Call':
            return <PhoneCall className="h-4 w-4" />;
        case 'Sent Proposal':
            return <FileText className="h-4 w-4" />;
        case 'Meeting':
            return <Users className="h-4 w-4" />;
        case 'Site Visit':
            return <MapPin className="h-4 w-4" />;
        case 'Negotiation':
            return <MessageSquare className="h-4 w-4" />;
        case 'Lead Created':
             return <PlusCircle className="h-4 w-4" />;
        case 'No Response':
            return <PhoneCall className="h-4 w-4" />;
        default:
            return <Activity className="h-4 w-4" />;
    }
}

export function ViewLeadDialog({ isOpen, onOpenChange, onLeadUpdated, onEditRequest, lead: initialLead, currentUser }: ViewLeadDialogProps) {
  const [lead, setLead] = useState<Lead | null>(initialLead);
  const [newActivity, setNewActivity] = useState('');
  const [newActivityNotes, setNewActivityNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<LeadActivity | null>(null);
  const [isDeletingActivity, setIsDeletingActivity] = useState(false);
  const { toast } = useToast();

  const activityHistory = useMemo(() => {
    return [...(lead?.activityHistory || [])]
      .filter(item => !item.activity.startsWith('Category:'))
      .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [lead?.activityHistory]);

  useEffect(() => {
    setLead(initialLead); // Sync with prop when it changes
  }, [initialLead]);
  
  useEffect(() => {
    if (!isOpen || !lead?.id) return;

    const intervalId = setInterval(async () => {
      console.log(`[ViewLeadDialog] Auto-refreshing lead data for ID: ${lead.id}`);
      const updatedLead = await getLeadByIdAction(lead.id);
      if (updatedLead) {
        setLead(updatedLead);
      }
    }, 10000); // 10 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [isOpen, lead?.id]);


  const handleSubmitActivity = async (e: FormEvent) => {
    e.preventDefault();
    if (!lead || !newActivity.trim()) {
      toast({ title: "Validation Error", description: "Please select an activity type.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const originalLeadState = lead;

    const result = await addLeadActivityAction(lead.id, {
      activity: newActivity,
      notes: newActivityNotes,
    }, currentUser, originalLeadState);

    setIsSubmitting(false);

    if (result.success && result.lead) {
      toast({ title: "Activity Added", description: "New activity has been logged for this lead." });
      setLead(result.lead);
      onLeadUpdated(result.lead);
      setNewActivity('');
      setNewActivityNotes('');
    } else {
      toast({ title: "Error", description: result.error || "Failed to add activity. Please try again.", variant: "destructive" });
      setLead(originalLeadState);
    }
  };
  
  const handleDeleteActivity = async () => {
    if (!lead || !activityToDelete || !currentUser) return;
    
    setIsDeletingActivity(true);
    const result = await deleteLeadActivityAction(lead.id, activityToDelete.id, currentUser);
    setIsDeletingActivity(false);

    if (result.success && result.lead) {
        toast({ title: "Activity Deleted", description: "The activity has been removed from the log." });
        setLead(result.lead);
        onLeadUpdated(result.lead);
    } else {
        toast({ title: "Error", description: result.error || "Could not delete activity.", variant: "destructive" });
    }
    setActivityToDelete(null);
  };


  if (!lead) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg md:max-w-2xl lg:max-w-4xl max-h-[90vh]">
          <DialogHeader className="pr-12">
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Briefcase className="h-6 w-6 text-primary"/>
              Lead Details
            </DialogTitle>
            <DialogDescription>
              Viewing lead for <span className="font-semibold text-foreground">{lead.contactName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-4">
            {/* Lead Info Column */}
            <div className="lg:col-span-1 space-y-4">
              <div className="p-4 border rounded-lg bg-card space-y-3 shadow-sm">
                  <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-lg text-foreground">{lead.contactName}</h3>
                      <Badge variant="secondary" className={cn("capitalize", getCategoryClass(lead.category))}>{LEAD_CATEGORY_LABELS[lead.category]}</Badge>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2"><Building className="h-4 w-4 text-primary/80"/><span>{lead.businessName}</span></div>
                      <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary/80"/><span>{lead.phone}</span></div>
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary/80"/><span>{lead.address}</span></div>
                      <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary/80"/><span>Source: {lead.source}</span></div>
                      <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary/80"/><span>Onboarding Date: {formatDateSafe(lead.date)}</span></div>
                      {lead.schedule && <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium"><CalendarDays className="h-4 w-4"/><span>Schedule: {formatDateSafe(lead.schedule)}</span></div>}
                      <div className="flex items-center gap-2"><UserIcon className="h-4 w-4 text-primary/80"/><span>CR: {lead.crmName}</span></div>
                  </div>
                   {lead.notes && <div className="pt-2 border-t border-dashed">
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <StickyNote className="h-4 w-4 mt-0.5 text-primary/80 shrink-0"/>
                          <p className="whitespace-pre-wrap">{lead.notes}</p>
                      </div>
                   </div>}
                   <div className="flex justify-end pt-2">
                      <Button variant="outline" size="sm" onClick={() => onEditRequest(lead)}>
                          <Edit className="h-4 w-4 mr-2" /> Edit Lead
                      </Button>
                   </div>
              </div>
            </div>
            {/* Activity Column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="p-4 border rounded-lg bg-card shadow-sm">
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><Activity className="h-5 w-5 text-primary"/>Activity Log</h3>
                  <ScrollArea className="h-64 pr-4 -mr-4">
                      <Timeline>
                          {activityHistory.map((item, index) => (
                          <TimelineItem key={item.id}>
                              <TimelineConnector />
                              <TimelineHeader>
                              <TimelineIcon>{getActivityIcon(item.activity)}</TimelineIcon>
                              <TimelineTitle>{item.activity}</TimelineTitle>
                              <span className="text-xs text-muted-foreground ml-auto">{formatDateSafe(item.timestamp, true)}</span>
                              </TimelineHeader>
                              <TimelineDescription className="flex justify-between items-start">
                                  <div>
                                    <p>{item.activity === 'Lead Created' ? (lead.notes || 'Initial lead entry created.') : item.notes}</p>
                                    <p className="text-xs text-muted-foreground italic mt-1">- {item.changedByUserName}</p>
                                  </div>
                                  {currentUser.role === 'SYSTEM_ADMIN' && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => setActivityToDelete(item)} title="Delete Activity">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                              </TimelineDescription>
                          </TimelineItem>
                          ))}
                      </Timeline>
                      {activityHistory.length === 0 && (
                          <div className="text-center text-muted-foreground py-10">No activities logged yet.</div>
                      )}
                  </ScrollArea>
                  <Separator className="my-4"/>
                  <form onSubmit={handleSubmitActivity} className="space-y-3">
                      <h4 className="font-semibold text-md">Add New Activity</h4>
                      <div className="space-y-1">
                          <Label htmlFor="activity-type">Activity Type *</Label>
                          <Select value={newActivity} onValueChange={setNewActivity} required>
                              <SelectTrigger id="activity-type"><SelectValue placeholder="Select an activity..." /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="Follow-up Call">Follow-up Call</SelectItem>
                                  <SelectItem value="Sent Proposal">Sent Proposal</SelectItem>
                                  <SelectItem value="Meeting">Meeting</SelectItem>
                                  <SelectItem value="Site Visit">Site Visit</SelectItem>
                                  <SelectItem value="Negotiation">Negotiation</SelectItem>
                                  <SelectItem value="No Response">No Response</SelectItem>
                                  <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                       <div className="space-y-1">
                          <Label htmlFor="activity-notes">Notes (Optional)</Label>
                          <Textarea id="activity-notes" value={newActivityNotes} onChange={(e) => setNewActivityNotes(e.target.value)} placeholder="Add details about the activity..."/>
                      </div>
                      <div className="flex justify-end">
                          <Button type="submit" disabled={isSubmitting || !newActivity}>
                              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Adding...</> : "Add Activity"}
                          </Button>
                      </div>
                  </form>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {activityToDelete && (
        <AlertDialog open={!!activityToDelete} onOpenChange={() => setActivityToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Delete Activity?</AlertDialogTitle>
              <div className="pt-2 text-sm text-muted-foreground">
                <p>Are you sure you want to delete this activity?</p>
                <blockquote className="mt-2 p-2 border-l-4 border-muted-foreground bg-muted text-foreground italic rounded-r-md">"{activityToDelete.activity}"</blockquote>
                <p className="mt-2">This action cannot be undone.</p>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setActivityToDelete(null)} disabled={isDeletingActivity}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteActivity} disabled={isDeletingActivity} className="bg-destructive hover:bg-destructive/90">
                {isDeletingActivity ? <><Loader2 className="h-4 w-4 animate-spin mr-2"/>Deleting...</> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
