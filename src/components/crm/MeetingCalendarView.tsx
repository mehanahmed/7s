"use client";

import React from 'react';
import {
  addDays, addMonths, format, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Edit, ExternalLink, Plus, Search } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Meeting } from '@/types';

interface MeetingCalendarViewProps {
  meetings: Meeting[];
  currentUserId: string;
  onEdit: (meeting: Meeting) => void;
  onCreate: () => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const isUrl = (v?: string | null) => !!v && /^https?:\/\//i.test(v);
const keyOf = (iso: string) => iso.slice(0, 10);
const initials = (name: string) => {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
};

// solid pill for what is still to happen, softer for finished, grey for cancelled
const pillClass = (status: string) =>
  status === 'Completed' ? 'border-green-200 bg-green-50 text-green-700' : status === 'Cancelled' ? 'border-red-200 bg-red-50 text-red-600 line-through' : 'border-primary/20 bg-primary/10 text-primary';

function DayCell({ date, inMonth, items, onEdit }: { date: Date; inMonth: boolean; items: Meeting[]; onEdit: (m: Meeting) => void }) {
  const today = isToday(date);
  const shown = items.slice(0, 2);
  const body = (
    <div
      className={cn(
        'relative h-full min-h-[118px] w-full border-b border-r border-zinc-100 p-2 text-left transition-colors group',
        inMonth ? 'bg-card' : 'bg-zinc-50/70',
        today && 'bg-primary/[0.06] ring-1 ring-inset ring-primary/30',
        items.length > 0 && 'cursor-pointer hover:bg-primary/[0.04]',
      )}
    >
      <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium tabular-nums', !inMonth && 'text-zinc-300', inMonth && !today && (date.getDay() === 0 || date.getDay() === 6) && 'text-rose-400', today && 'bg-primary font-semibold text-primary-foreground shadow-md shadow-primary/30')}>
        {format(date, 'd')}
      </span>
      <div className="mt-1 space-y-1">
        {shown.map((m) => (
          <span key={m.id} className={cn('block truncate rounded-full border-l-0 border px-2 py-0.5 text-[11px] font-medium leading-4', pillClass(m.status), !inMonth && 'opacity-60')}>
            <b className="font-semibold">{format(new Date(m.meetingAt), 'h:mm a')}</b> {m.title}
          </span>
        ))}
        {items.length > 2 && <span className="block pl-1.5 text-[11px] font-medium text-muted-foreground">+{items.length - 2} more</span>}
      </div>
    </div>
  );
  if (items.length === 0) return body;
  return (
    <Popover>
      <PopoverTrigger asChild>{body}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="center" collisionPadding={16}>
        <div className="px-3 pt-3 text-sm font-semibold">{format(date, 'EEEE, PPP')}</div>
        <div className="custom-scrollbar max-h-72 overflow-y-auto overscroll-contain px-1">
          <div className="space-y-1 p-2">
            {items.map((m) => (
              <div key={m.id} className="rounded-md p-2 hover:bg-muted">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', m.status === 'Completed' ? 'bg-green-500' : m.status === 'Cancelled' ? 'bg-red-500' : 'bg-primary')} />
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{format(new Date(m.meetingAt), 'hh:mm a')}</span>
                  <span className={cn('truncate text-sm font-medium', m.status === 'Cancelled' && 'line-through')}>{m.title}</span>
                </div>
                <p className="ml-4 truncate text-xs text-muted-foreground">
                  {[m.contactName, m.companyName].filter(Boolean).join(' · ') || m.type} · {m.status}
                </p>
                <div className="mt-1 flex justify-end gap-1">
                  {isUrl(m.location) && (
                    <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                      <a href={m.location!} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-3 w-3" aria-hidden />Join</a>
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onEdit(m)}>
                    <Edit className="mr-1 h-3 w-3" aria-hidden />Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MeetingCalendarView({ meetings, currentUserId, onEdit, onCreate }: MeetingCalendarViewProps) {
  const [month, setMonth] = React.useState(new Date());
  const [ownerFilter, setOwnerFilter] = React.useState<string | null>(null); // owner id, null = everybody
  const [peopleSearch, setPeopleSearch] = React.useState('');

  const people = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatar?: string | null; count: number }>();
    meetings.forEach((m) => {
      const cur = map.get(m.ownerId) ?? { id: m.ownerId, name: m.ownerName, avatar: m.ownerAvatar, count: 0 };
      cur.count += 1;
      map.set(m.ownerId, cur);
    });
    const q = peopleSearch.trim().toLowerCase();
    return Array.from(map.values()).filter((p) => !q || p.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  }, [meetings, peopleSearch]);

  const visible = React.useMemo(() => (ownerFilter ? meetings.filter((m) => m.ownerId === ownerFilter) : meetings), [meetings, ownerFilter]);

  const byDay = React.useMemo(() => {
    const map: Record<string, Meeting[]> = {};
    visible.forEach((m) => { (map[keyOf(m.meetingAt)] ||= []).push(m); });
    Object.values(map).forEach((list) => list.sort((a, b) => a.meetingAt.localeCompare(b.meetingAt)));
    return map;
  }, [visible]);

  const monthCount = React.useMemo(() => visible.filter((m) => isSameMonth(new Date(m.meetingAt), month)).length, [visible, month]);

  // 6 full weeks so the grid never changes height between months
  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* side panel */}
      <aside className="flex flex-col gap-5 rounded-3xl border border-zinc-100 bg-card shadow-xl shadow-zinc-200/50 p-4">
        <div className="rounded-xl bg-zinc-50 p-1">
          <Calendar
            mode="single"
            month={month}
            onMonthChange={setMonth}
            selected={new Date()}
            onSelect={(d) => d && setMonth(d)}
            className="w-full p-1"
            classNames={{
              months: 'flex flex-col',
              month: 'w-full space-y-2',
              head_cell: 'w-8 text-[0.75rem] font-normal text-muted-foreground',
              cell: 'h-8 w-8 p-0 text-center text-sm relative',
              day: 'h-8 w-8 p-0 font-normal aria-selected:opacity-100',
              head_row: 'flex justify-between',
              row: 'mt-1 flex w-full justify-between',
            }}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <p className="text-sm font-semibold">People</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={peopleSearch} onChange={(e) => setPeopleSearch(e.target.value)} placeholder="Search for People" aria-label="Search people" className="h-9 bg-muted/40 pl-8 text-sm" />
          </div>
          <ScrollArea className="max-h-56">
            <ul className="space-y-1">
              {people.length === 0 && <li className="px-1 py-2 text-xs text-muted-foreground">No one yet.</li>}
              {people.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setOwnerFilter(ownerFilter === p.id ? null : p.id)}
                    aria-pressed={ownerFilter === p.id}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      ownerFilter === p.id && 'bg-primary/10 ring-1 ring-primary/40',
                    )}
                  >
                    <Avatar className="h-9 w-9">{p.avatar && <AvatarImage src={p.avatar} alt={p.name} />}<AvatarFallback className="bg-gradient-to-br from-primary to-blue-400 text-xs font-semibold text-white">{initials(p.name)}</AvatarFallback></Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">{p.count} meeting{p.count === 1 ? '' : 's'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>

        <Button
          variant="outline"
          className={cn('h-10 w-full rounded-xl border-zinc-200 font-medium', ownerFilter === currentUserId && 'border-primary bg-primary/10 text-primary')}
          aria-pressed={ownerFilter === currentUserId}
          onClick={() => setOwnerFilter(ownerFilter === currentUserId ? null : currentUserId)}
        >
          My Schedule
        </Button>
      </aside>

      {/* month grid: cells touch, no gutters */}
      <section aria-label="Month calendar" className="overflow-hidden rounded-3xl border border-zinc-100 bg-card shadow-xl shadow-zinc-200/50">
        <div className="flex items-center justify-between bg-gradient-to-r from-primary to-blue-500 px-5 py-4 text-white">
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl font-bold tracking-tight">{format(month, 'MMMM yyyy')}</h2>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">{monthCount} meeting{monthCount === 1 ? '' : 's'}</span>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-white/20 p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white hover:bg-white/25 hover:text-white" onClick={() => setMonth(subMonths(month, 1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-8 rounded-full border border-white/40 px-4 text-xs font-semibold text-white hover:bg-white/25 hover:text-white" onClick={() => setMonth(new Date())}>Today</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white hover:bg-white/25 hover:text-white" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 border-b border-zinc-100 bg-primary/[0.04]">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-3 text-center text-[11px] font-bold uppercase tracking-widest text-primary/70">{d}</div>
              ))}
            </div>
            <div className="grid auto-rows-fr grid-cols-7 [&>*:nth-child(7n)>div]:border-r-0">
              {days.map((d) => (
                <div key={d.toISOString()} className="contents">
                  <DayCell date={d} inMonth={isSameMonth(d, month)} items={byDay[format(d, 'yyyy-MM-dd')] || []} onEdit={onEdit} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
