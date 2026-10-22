"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDays, differenceInMinutes, format, formatDistanceToNowStrict, isBefore, isToday, isTomorrow, startOfDay,
} from 'date-fns';
import {
  AlertTriangle, CalendarCheck, CalendarClock, CalendarDays, Check, Clock, Edit, ExternalLink, MapPin, Phone, PlusCircle,
  LayoutList, Search, Trash2, Users, Video, XCircle, Globe, FileText,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { getMeetings, updateMeeting, deleteMeeting } from '@/lib/meeting-service';
import { MeetingDialog } from '@/components/crm/MeetingDialog';
import { MeetingCalendarView } from '@/components/crm/MeetingCalendarView';
import type { Meeting, MeetingStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

type Filter = 'today' | 'upcoming' | 'all' | 'Completed' | 'Cancelled';
type TypeFilter = 'all' | 'Online' | 'In-person' | 'Phone';

const TYPE_ICON = { Online: Video, 'In-person': Users, Phone } as const;
const isUrl = (v?: string | null) => !!v && /^https?:\/\//i.test(v);
const toDate = (iso: string) => new Date(iso);
const endOf = (m: Meeting) => new Date(toDate(m.meetingAt).getTime() + m.durationMin * 60_000);

// Status is never conveyed by colour alone: every badge carries an icon and a word.
const STATUS_STYLE: Record<MeetingStatus | 'Overdue', { cls: string; Icon: React.ElementType; label: string }> = {
  Scheduled: { cls: 'border-blue-200 bg-blue-50 text-blue-700', Icon: Clock, label: 'Scheduled' },
  Completed: { cls: 'border-green-200 bg-green-50 text-green-700', Icon: CalendarCheck, label: 'Completed' },
  Cancelled: { cls: 'border-zinc-200 bg-zinc-100 text-zinc-600', Icon: XCircle, label: 'Cancelled' },
  Overdue: { cls: 'border-amber-300 bg-amber-50 text-amber-800', Icon: AlertTriangle, label: 'Overdue' },
};

const dayLabel = (d: Date) => (isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEEE, dd MMM yyyy'));

function StatCard({ icon: Icon, label, value, tone, active, onClick }: {
  icon: React.ElementType; label: string; value: number; tone: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group flex min-h-[72px] cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-all',
        'hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        active ? 'border-primary ring-1 ring-primary/40' : 'border-zinc-200',
      )}
    >
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', tone)}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span>
        <span className="block text-2xl font-semibold leading-none tabular-nums">{value}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}

export default function MeetingsPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view] = useState<'list' | 'calendar'>('calendar');
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [toDelete, setToDelete] = useState<Meeting | null>(null);
  const [now, setNow] = useState(() => new Date());

  // keeps "in 2h" / "Overdue" honest while the page stays open
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setMeetings(await getMeetings());
    } catch {
      toast({ title: "Error", description: "Could not load meetings. Please retry.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const todayStart = startOfDay(now);
    const weekEnd = addDays(todayStart, 7);
    const scheduled = meetings.filter((m) => m.status === 'Scheduled');
    return {
      today: scheduled.filter((m) => isToday(toDate(m.meetingAt))).length,
      week: scheduled.filter((m) => { const d = toDate(m.meetingAt); return d >= todayStart && d < weekEnd; }).length,
      completed: meetings.filter((m) => m.status === 'Completed').length,
      cancelled: meetings.filter((m) => m.status === 'Cancelled').length,
    };
  }, [meetings, now]);

  const nextUp = useMemo(
    () => meetings
      .filter((m) => m.status === 'Scheduled' && endOf(m) >= now)
      .sort((a, b) => a.meetingAt.localeCompare(b.meetingAt))[0],
    [meetings, now],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const todayStart = startOfDay(now);
    return meetings
      .filter((m) => {
        const d = toDate(m.meetingAt);
        if (filter === 'today') return m.status === 'Scheduled' && isToday(d);
        if (filter === 'upcoming') return m.status === 'Scheduled' && d >= todayStart;
        if (filter === 'Completed' || filter === 'Cancelled') return m.status === filter;
        return true;
      })
      .filter((m) => typeFilter === 'all' || m.type === typeFilter)
      .filter((m) => !q || [m.title, m.contactName, m.companyName, m.phone, m.location, m.ownerName, m.clientWebsite, m.serviceRequirement].some((v) => (v ?? '').toLowerCase().includes(q)))
      .sort((a, b) => (filter === 'upcoming' || filter === 'today' ? a.meetingAt.localeCompare(b.meetingAt) : b.meetingAt.localeCompare(a.meetingAt)));
  }, [meetings, filter, typeFilter, search, now]);

  const calendarMeetings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meetings
      .filter((m) => typeFilter === 'all' || m.type === typeFilter)
      .filter((m) => !q || [m.title, m.contactName, m.companyName, m.phone, m.location, m.ownerName, m.clientWebsite, m.serviceRequirement].some((v) => (v ?? '').toLowerCase().includes(q)));
  }, [meetings, typeFilter, search]);

  const groups = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of visible) {
      const key = m.meetingAt.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), m]);
    }
    return Array.from(map.entries());
  }, [visible]);

  const setStatus = async (m: Meeting, status: MeetingStatus) => {
    const previous = m.status;
    setMeetings((prev) => prev.map((x) => (x.id === m.id ? { ...x, status } : x))); // optimistic
    try {
      await updateMeeting(m.id, { status });
      toast({ title: status === 'Completed' ? 'Marked as completed' : 'Meeting cancelled', description: m.title });
    } catch (e) {
      setMeetings((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: previous } : x)));
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteMeeting(toDelete.id);
      setMeetings((prev) => prev.filter((x) => x.id !== toDelete.id));
      toast({ title: "Meeting deleted", description: toDelete.title });
    } catch (e) {
      toast({ title: "Could not delete", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setToDelete(null);
    }
  };

  const openNew = () => { setEditing(null); setDialogOpen(true); };

  if (!currentUser) return null;

  const filterLabel: Record<Filter, string> = { today: 'today', upcoming: 'upcoming', all: '', Completed: 'completed', Cancelled: 'cancelled' };

  return (
    <div className="flex w-full flex-col gap-5 px-4 pb-4 pt-3 sm:px-6 sm:pb-6">
      {/* at-a-glance numbers double as filters */}
      {view === 'list' && <section aria-label="Meeting summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Today" value={stats.today} tone="bg-blue-100 text-blue-700" active={filter === 'today'} onClick={() => setFilter('today')} />
        <StatCard icon={CalendarClock} label="Next 7 days" value={stats.week} tone="bg-violet-100 text-violet-700" active={filter === 'upcoming'} onClick={() => setFilter('upcoming')} />
        <StatCard icon={CalendarCheck} label="Completed" value={stats.completed} tone="bg-green-100 text-green-700" active={filter === 'Completed'} onClick={() => setFilter('Completed')} />
        <StatCard icon={XCircle} label="Cancelled" value={stats.cancelled} tone="bg-zinc-100 text-zinc-600" active={filter === 'Cancelled'} onClick={() => setFilter('Cancelled')} />
      </section>}

      {/* what is next */}
      {view === 'list' && nextUp && (
        <section aria-label="Next meeting" className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Clock className="h-5 w-5" aria-hidden /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Next up · {isBefore(toDate(nextUp.meetingAt), now) ? 'in progress' : `in ${formatDistanceToNowStrict(toDate(nextUp.meetingAt))}`}
              </p>
              <p className="font-semibold">{nextUp.title}</p>
              <p className="text-sm text-muted-foreground">
                {format(toDate(nextUp.meetingAt), 'EEE, dd MMM · hh:mm a')}
                {(nextUp.contactName || nextUp.companyName) && ` · ${[nextUp.contactName, nextUp.companyName].filter(Boolean).join(', ')}`}
              </p>
            </div>
          </div>
          {isUrl(nextUp.location) && (
            <Button asChild className="h-11 gap-2 sm:w-auto">
              <a href={nextUp.location!} target="_blank" rel="noreferrer"><Video className="h-4 w-4" aria-hidden /> Join now</a>
            </Button>
          )}
        </section>
      )}

      {/* filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, contact, company, phone or link"
            aria-label="Search meetings"
            className="h-11 pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
          <SelectTrigger className="h-11 sm:w-44" aria-label="Filter by meeting type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="Online">Online</SelectItem>
            <SelectItem value="In-person">In-person</SelectItem>
            <SelectItem value="Phone">Phone</SelectItem>
          </SelectContent>
        </Select>
        {view === 'list' && <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="h-11 sm:w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="all">All meetings</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>}
        <Button onClick={openNew} className="h-11 w-full gap-2 sm:ml-auto sm:w-auto">
          <PlusCircle className="h-4 w-4" aria-hidden /> Add Meeting
        </Button>
      </div>

      {/* list, grouped by day */}
      {view === 'calendar' ? (
        isLoading ? <Skeleton className="h-[640px] w-full rounded-xl" /> : <MeetingCalendarView meetings={calendarMeetings} currentUserId={currentUser.id} onEdit={(m) => { setEditing(m); setDialogOpen(true); }} onCreate={openNew} />
      ) : (
      <div className="flex flex-col gap-6" aria-live="polite">
        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-zinc-300 bg-card/60 px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><CalendarDays className="h-7 w-7" aria-hidden /></span>
            <div>
              <p className="font-semibold">No {filterLabel[filter]} meetings{search ? ` matching "${search}"` : ''}</p>
              <p className="text-sm text-muted-foreground">Schedule one to keep every client conversation on track.</p>
            </div>
            <Button onClick={openNew} className="h-11 gap-2"><PlusCircle className="h-4 w-4" aria-hidden /> Add Meeting</Button>
          </div>
        ) : (
          groups.map(([day, items]) => (
            <section key={day} aria-label={dayLabel(new Date(day + 'T00:00:00'))}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground/80">
                {dayLabel(new Date(day + 'T00:00:00'))}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{items.length}</span>
              </h2>
              <ul className="flex flex-col gap-3">
                {items.map((m) => {
                  const start = toDate(m.meetingAt);
                  const overdue = m.status === 'Scheduled' && endOf(m) < now;
                  const st = STATUS_STYLE[overdue ? 'Overdue' : m.status];
                  const TypeIcon = TYPE_ICON[m.type as keyof typeof TYPE_ICON] ?? Video;
                  const minsLeft = differenceInMinutes(start, now);
                  return (
                    <li key={m.id} className={cn('flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center', overdue ? 'border-amber-300' : 'border-zinc-200', m.status === 'Cancelled' && 'opacity-75')}>
                      {/* time block */}
                      <div className="flex shrink-0 items-center gap-3 sm:w-28 sm:flex-col sm:items-start sm:gap-0">
                        <p className="font-mono text-lg font-semibold tabular-nums">{format(start, 'hh:mm')}<span className="ml-1 text-xs font-medium text-muted-foreground">{format(start, 'a')}</span></p>
                        <p className="text-xs text-muted-foreground">{m.durationMin} min</p>
                      </div>

                      {/* details */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className={cn('break-words font-semibold', m.status === 'Cancelled' && 'line-through')}>{m.title}</p>
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5"><TypeIcon className="h-4 w-4" aria-hidden />{m.type}</span>
                          {(m.contactName || m.companyName) && <span>{[m.contactName, m.companyName].filter(Boolean).join(' · ')}</span>}
                          {m.phone && <span className="inline-flex items-center gap-1 tabular-nums"><Phone className="h-3.5 w-3.5" aria-hidden />{m.phone}</span>}
                        </p>
                        {m.location && (
                          <p className="flex items-center gap-1.5 text-sm [overflow-wrap:anywhere]">
                            {isUrl(m.location)
                              ? <a href={m.location} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ExternalLink className="h-3.5 w-3.5" aria-hidden />Join link</a>
                              : <span className="inline-flex items-start gap-1.5 text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{m.location}</span>}
                          </p>
                        )}
                        {m.clientWebsite && (
                          <p className="flex items-center gap-1.5 text-sm [overflow-wrap:anywhere]">
                            <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            <a
                              href={m.clientWebsite.startsWith('http') ? m.clientWebsite : `https://${m.clientWebsite}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                            >
                              {m.clientWebsite}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </p>
                        )}
                        {m.serviceRequirement && (
                          <div className="flex items-start gap-1.5 text-sm text-foreground/90">
                            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="font-medium text-muted-foreground">Requirement:</span>
                            <span>{m.serviceRequirement}</span>
                          </div>
                        )}
                        {m.notes && <p className="line-clamp-2 text-sm text-muted-foreground">{m.notes}</p>}
                        <p className="text-xs text-muted-foreground">Owner: {m.ownerName}</p>
                      </div>

                      {/* status + actions */}
                      <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
                        <div className="flex flex-col items-start gap-1 sm:items-end">
                          <Badge variant="outline" className={cn('gap-1 font-medium', st.cls)}><st.Icon className="h-3.5 w-3.5" aria-hidden />{st.label}</Badge>
                          {m.status === 'Scheduled' && !overdue && minsLeft >= 0 && minsLeft <= 180 && (
                            <span className="text-xs font-medium text-primary">starts in {formatDistanceToNowStrict(start)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {m.status === 'Scheduled' && (
                            <>
                              <Button size="icon" variant="ghost" className="h-10 w-10 text-green-600 hover:bg-green-50 hover:text-green-700" aria-label={`Mark "${m.title}" completed`} title="Mark completed" onClick={() => setStatus(m, 'Completed')}><Check className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-10 w-10 text-muted-foreground" aria-label={`Cancel "${m.title}"`} title="Cancel meeting" onClick={() => setStatus(m, 'Cancelled')}><XCircle className="h-4 w-4" /></Button>
                            </>
                          )}
                          <Button size="icon" variant="ghost" className="h-10 w-10" aria-label={`Edit "${m.title}"`} title="Edit" onClick={() => { setEditing(m); setDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-10 w-10 text-destructive hover:bg-destructive/10" aria-label={`Delete "${m.title}"`} title="Delete" onClick={() => setToDelete(m)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
      )}

      <MeetingDialog isOpen={dialogOpen} onOpenChange={setDialogOpen} meeting={editing} currentUser={currentUser} onSaved={load} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this meeting?</AlertDialogTitle>
            <AlertDialogDescription>"{toDelete?.title}" will be removed permanently. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
