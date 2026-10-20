import { z } from 'zod';

const timerSchema = z.object({
  elapsedMs: z.number().finite().nonnegative(),
  startedAt: z.number().finite().nonnegative().nullable(),
});

export type WorkTimerState = z.infer<typeof timerSchema>;
export const emptyWorkTimer = (): WorkTimerState => ({ elapsedMs: 0, startedAt: null });

export function restoreWorkTimer(raw: string | null, now: number): WorkTimerState {
  try {
    const result = timerSchema.safeParse(raw ? JSON.parse(raw) : null);
    if (!result.success || (result.data.startedAt !== null && result.data.startedAt > now)) return emptyWorkTimer();
    return result.data;
  } catch {
    return emptyWorkTimer();
  }
}

export const elapsedWorkTime = (state: WorkTimerState, now: number): number =>
  state.elapsedMs + (state.startedAt === null ? 0 : Math.max(0, now - state.startedAt));

export const startWorkTimer = (state: WorkTimerState, now: number): WorkTimerState =>
  state.startedAt === null ? { ...state, startedAt: now } : state;

export const pauseWorkTimer = (state: WorkTimerState, now: number): WorkTimerState =>
  ({ elapsedMs: elapsedWorkTime(state, now), startedAt: null });

export function formatWorkTime(elapsedMs: number): string {
  const seconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
