"use client";

import { useEffect, useState } from 'react';
import { ArrowUpRight, Pause, Play, TimerReset } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { elapsedWorkTime, emptyWorkTimer, formatWorkTime, pauseWorkTimer, restoreWorkTimer, startWorkTimer, type WorkTimerState } from '@/lib/work-timer';

export function TimeTrackerCard({ userId }: { userId: string }) {
  const storageKey = `seven-solution:sw-work-timer:${userId}`;
  const [timer, setTimer] = useState<WorkTimerState | null>(null);
  const [now, setNow] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const timestamp = Date.now();
    let restored = emptyWorkTimer();
    try { restored = restoreWorkTimer(localStorage.getItem(storageKey), timestamp); } catch { /* Storage can be unavailable. */ }
    setTimer(restored);
    setNow(timestamp);
    const sync = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return;
      setTimer(restoreWorkTimer(event.newValue, Date.now()));
      setNow(Date.now());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [storageKey]);

  useEffect(() => {
    if (!timer) return;
    try { localStorage.setItem(storageKey, JSON.stringify(timer)); } catch { /* Keep the timer usable without storage. */ }
  }, [timer, storageKey]);

  const running = timer?.startedAt !== null && timer?.startedAt !== undefined;
  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [running]);

  const elapsedMs = timer ? elapsedWorkTime(timer, now) : 0;
  const circumference = 2 * Math.PI * 72;
  const progress = Math.min(elapsedMs / 3_600_000, 1);
  const start = () => {
    const timestamp = Date.now();
    setNow(timestamp);
    setTimer(previous => previous ? startWorkTimer(previous, timestamp) : previous);
  };
  const pause = () => {
    const timestamp = Date.now();
    setNow(timestamp);
    setTimer(previous => previous ? pauseWorkTimer(previous, timestamp) : previous);
  };
  const reset = () => { setTimer(emptyWorkTimer()); setNow(Date.now()); };

  const content = (large = false) => (
    <div className="relative overflow-hidden rounded-[28px] border border-amber-100/80 bg-gradient-to-br from-stone-50 via-[#fffdec] to-[#fff8d6] p-5 font-sans text-stone-800 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium tracking-tight">Time tracker</h2>
        {!large && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white/80 text-stone-600 hover:bg-white" aria-label="Expand time tracker" onClick={() => setExpanded(true)}><ArrowUpRight /></Button>}
      </div>
      <div className="relative mx-auto my-3 w-full max-w-[220px]" role="timer" aria-label={`Work time ${formatWorkTime(elapsedMs)}`}>
        <svg viewBox="0 0 184 184" className="w-full" aria-hidden="true">
          <circle cx="92" cy="92" r="72" fill="none" stroke="#78716c" strokeWidth="5" strokeDasharray="1 6" opacity="0.65" />
          <circle cx="92" cy="92" r="64" fill="#fffef5" />
          <circle cx="92" cy="92" r="72" fill="none" stroke="#ffda62" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - progress)} transform="rotate(-90 92 92)" className={progress === 0 ? 'opacity-0' : 'opacity-100'} />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="text-[28px] sm:text-[30px] font-normal leading-none tracking-tight tabular-nums">{formatWorkTime(elapsedMs)}</span>
          <span className="text-[11px] text-stone-500">Work Time</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Start work timer" disabled={!timer || running} onClick={start} className="h-9 w-9 rounded-full bg-white text-stone-600 shadow-sm hover:bg-amber-50 disabled:opacity-40"><Play className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" aria-label="Pause work timer" disabled={!timer || !running} onClick={pause} className="h-9 w-9 rounded-full bg-white text-stone-600 shadow-sm hover:bg-amber-50 disabled:opacity-40"><Pause className="h-3.5 w-3.5" /></Button>
        </div>
        <Button variant="ghost" size="icon" aria-label="Reset work timer" disabled={!timer || elapsedMs === 0} onClick={reset} className="h-10 w-10 rounded-full bg-stone-800 text-white shadow-sm hover:bg-stone-700 hover:text-white"><TimerReset /></Button>
      </div>
    </div>
  );

  return (
    <>
      <Card className="w-full max-w-[300px] rounded-[28px] border-0 bg-transparent shadow-none">{content()}</Card>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-[380px] rounded-[28px] border-0 bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">Time tracker</DialogTitle>
          <DialogDescription className="sr-only">Track your work time. Start, pause, or reset the timer.</DialogDescription>
          {content(true)}
        </DialogContent>
      </Dialog>
    </>
  );
}
