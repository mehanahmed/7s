"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { format, isValid, parseISO } from 'date-fns';
import { CalendarDays, Phone, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Lead, Meeting } from '@/types';

const NOTE_STYLES = [
  { bg: "bg-[#94b9e9] text-[#0f3460] border-[#7aa5e2] dark:bg-[#1e293b] dark:text-[#93c5fd] dark:border-blue-800", torn: "text-[#94b9e9] dark:text-[#1e293b]" },
  { bg: "bg-[#a8e6cf] text-[#054a29] border-[#8edbbd] dark:bg-[#064e3b] dark:text-[#6ee7b7] dark:border-emerald-800", torn: "text-[#a8e6cf] dark:text-[#064e3b]" },
  { bg: "bg-[#fce1d6] text-[#632c1c] border-[#f9cabb] dark:bg-[#7c2d12] dark:text-[#fdba74] dark:border-amber-800", torn: "text-[#fce1d6] dark:text-[#7c2d12]" },
  { bg: "bg-[#fca370] text-[#4a1c03] border-[#f88f54] dark:bg-[#7c2d12] dark:text-[#fed7aa] dark:border-amber-900", torn: "text-[#fca370] dark:text-[#7c2d12]" },
  { bg: "bg-[#ff8b94] text-[#4a0a10] border-[#ff7580] dark:bg-[#881337] dark:text-[#fecdd3] dark:border-rose-900", torn: "text-[#ff8b94] dark:text-[#881337]" },
  { bg: "bg-[#b8a7ea] text-[#2c1854] border-[#a592e3] dark:bg-[#4c1d95] dark:text-[#ddd6fe] dark:border-purple-900", torn: "text-[#b8a7ea] dark:text-[#4c1d95]" },
];

interface TodayScheduleCardProps {
  /** leads scheduled for today, already filtered and sorted */
  leads: Lead[];
  /** today's meetings; when given, a Meeting / Appointment switch shows beside the heading */
  meetings?: Meeting[];
  isLoading?: boolean;
  /** heading on the yellow note */
  title?: string;
  /** empty-state text */
  emptyTitle?: string;
  emptyHint?: string;
}

/** "Today Schedule" sticky-note board (shared by the dashboard and the report page). */
export function TodayScheduleCard({ leads, meetings, isLoading, title = 'TODAY SCHEDULE', emptyTitle = 'No appointments scheduled for today', emptyHint = 'Add schedules to leads in your Pipeline to pin them here.' }: TodayScheduleCardProps) {
  const [mode, setMode] = useState<'appointment' | 'meeting'>('appointment');
  const showMeetings = !!meetings && mode === 'meeting';

  // one note shape for both leads (appointments) and meetings
  const items = useMemo(() => {
    const fmt = (iso?: string | null, withTime = false) => {
      try { const d = parseISO(iso || ''); return isValid(d) ? format(d, withTime ? 'd MMM, yyyy · h:mm a' : 'd MMM, yyyy') : ''; } catch { return ''; }
    };
    if (showMeetings) {
      return (meetings || []).map((m) => ({
        id: m.id,
        name: m.contactName || m.title,
        sub: m.contactName ? m.title : (m.companyName || ''),
        phone: m.phone || '',
        date: fmt(m.meetingAt, true),
        notes: m.notes || '',
      }));
    }
    return leads.map((l) => ({
      id: l.id,
      name: l.contactName,
      sub: l.businessName || '',
      phone: l.phone || '',
      date: fmt(l.schedule),
      notes: l.notes || '',
    }));
  }, [leads, meetings, showMeetings]);

  const noun = showMeetings ? 'Meeting' : 'Appointment';
  const emptyTitleShown = showMeetings ? 'No meetings scheduled for today' : emptyTitle;
  const emptyHintShown = showMeetings ? 'Add a meeting from the Meetings page to see it here.' : emptyHint;

  return (
    <Card className="bg-card border shadow-xl rounded-2xl overflow-hidden group relative flex flex-col h-full min-h-[380px] sm:min-h-[420px] w-full">
      {/* SVG Graph Paper Background */}
      <div className="absolute inset-0 opacity-25 pointer-events-none z-0">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="mindmap-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.6" className="text-muted-foreground/60" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mindmap-grid)" />
        </svg>
      </div>

      <CardContent className="p-3 sm:p-4 pt-5 pb-3 sm:pb-4 relative z-10 flex-1 flex flex-col justify-start">
        {/* Permanent Top Header: Mind Map Center Yellow Node */}
        <div className={cn("mb-1 relative z-10", meetings ? "grid grid-cols-[1fr_auto_1fr] items-center gap-3" : "flex justify-center")}>
        {meetings && (
          <button type="button" onClick={() => setMode('meeting')} aria-pressed={mode === 'meeting'}
            className={cn("justify-self-end inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors", mode === 'meeting' ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted")}>
            <Users className="h-3.5 w-3.5" aria-hidden /> Meeting
          </button>
        )}
          <div className="relative">
            {/* Top Tape */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-4 bg-white/85 dark:bg-white/40 border border-black/10 shadow-xs transform rotate-2 z-30 pointer-events-none rounded-xs" />
            
            {/* Main Yellow Center Node */}
            <div className="bg-[#fef08a] dark:bg-[#713f12] text-[#854d0e] dark:text-[#fef08a] border-t border-x border-[#fde047] dark:border-[#a16207] px-6 py-2.5 rounded-t-lg shadow-md text-center transform -rotate-1 relative z-20">
              <h3 className="font-extrabold text-sm sm:text-base tracking-widest uppercase font-serif">
                {title}
              </h3>
              <p className="text-[11px] font-bold opacity-80 mt-0.5">
                {items.length} Scheduled {noun}{items.length === 1 ? '' : 's'}
              </p>
            </div>

            {/* SVG Torn Edge Bottom */}
            <svg className="w-full h-3 shrink-0 -mt-0.5 relative z-20 block transform -rotate-1" viewBox="0 0 100 12" preserveAspectRatio="none">
              <path d="M0,0 L0,4 Q4,9 8,3 Q12,0 16,5 Q20,10 24,4 Q28,0 32,5 Q36,10 40,3 Q44,0 48,5 Q52,10 56,4 Q60,0 64,5 Q68,10 72,3 Q76,0 80,5 Q84,10 88,4 Q92,0 96,5 Q100,10 100,0 Z" fill="currentColor" className="text-[#fef08a] dark:text-[#713f12]" />
            </svg>
          </div>
        {meetings && (
          <button type="button" onClick={() => setMode('appointment')} aria-pressed={mode === 'appointment'}
            className={cn("justify-self-start inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors", mode === 'appointment' ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted")}>
            <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Appointment
          </button>
        )}
        </div>

        {/* Hand-drawn Connecting SVG Arrows */}
        <div className="flex justify-center -mt-1 mb-2 relative z-10 pointer-events-none">
          <svg className="w-full max-w-[500px] h-9 text-foreground/80" viewBox="0 0 300 35" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <marker id="mindmap-arrowhead" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" className="text-foreground/80" />
              </marker>
            </defs>
            <path d="M 150 2 Q 100 15 45 28" markerEnd="url(#mindmap-arrowhead)" />
            <path d="M 150 2 L 150 28" markerEnd="url(#mindmap-arrowhead)" />
            <path d="M 150 2 Q 200 15 255 28" markerEnd="url(#mindmap-arrowhead)" />
          </svg>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : items.length > 0 ? (
          <ScrollArea className="h-[280px] sm:h-[320px] w-full pr-2 -mr-2 sm:mr-0 sm:pr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 pt-1 pb-1">
              {items.map((lead, index) => {
                const formattedDate = lead.date;

                const style = NOTE_STYLES[index % NOTE_STYLES.length];

                return (
                  <motion.div
                    key={lead.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className="relative group/note flex flex-col transition-all duration-200 hover:-translate-y-1 drop-shadow-sm hover:drop-shadow-md"
                  >
                    {/* Top Tape Strip */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-14 sm:w-16 h-4 bg-white/75 dark:bg-white/35 border border-black/10 shadow-xs transform -rotate-1 z-30 pointer-events-none rounded-xs backdrop-blur-2xs opacity-90" />

                    {/* Sticky Note Body */}
                    <div className={cn("p-3.5 sm:p-4 rounded-t-xl border-t border-x flex-1 flex flex-col justify-between relative z-10", style.bg)}>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-extrabold text-xs sm:text-sm uppercase tracking-wide truncate">
                            {lead.name}
                          </h4>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-black/10 shrink-0">
                            #{String(index + 1).padStart(2, '0')}
                          </span>
                        </div>

                        {lead.sub && (
                          <p className="text-[11px] font-bold opacity-85 truncate">
                            ({lead.sub})
                          </p>
                        )}

                        <div className="flex flex-col gap-1 text-[11px] opacity-90 pt-1 font-semibold">
                          {lead.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3 opacity-70 shrink-0" />
                              {lead.phone}
                            </span>
                          )}
                          {formattedDate && (
                            <span className="flex items-center gap-1 font-bold">
                              <CalendarDays className="h-3 w-3 opacity-70 shrink-0" />
                              {formattedDate}
                            </span>
                          )}
                        </div>

                        {lead.notes && (
                          <p className="text-[11px] italic opacity-85 line-clamp-2 pt-1.5 border-t border-black/10 mt-1.5">
                            "{lead.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* SVG Torn Edge Bottom (Snug Overlap -mt-1) */}
                    <svg className="w-full h-3 shrink-0 -mt-1 relative z-10 block" viewBox="0 0 100 12" preserveAspectRatio="none">
                      <path d="M0,0 L0,4 Q4,9 8,3 Q12,0 16,5 Q20,10 24,4 Q28,0 32,5 Q36,10 40,3 Q44,0 48,5 Q52,10 56,4 Q60,0 64,5 Q68,10 72,3 Q76,0 80,5 Q84,10 88,4 Q92,0 96,5 Q100,10 100,0 Z" fill="currentColor" className={style.torn} />
                    </svg>
                  </motion.div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground/60 text-center my-auto relative z-10">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 rounded-2xl mb-2.5 border border-amber-300 dark:border-amber-700 shadow-xs">
              <CalendarDays className="h-8 w-8 opacity-80" />
            </div>
            <p className="font-bold text-sm text-foreground">{emptyTitleShown}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
              {emptyHintShown}
            </p>
            <Button asChild size="sm" variant="outline" className="mt-3 text-xs rounded-lg shadow-xs border-border/60 hover:bg-primary hover:text-primary-foreground">
              <Link href="/pipeline">
                Go to Pipeline
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
