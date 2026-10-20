import { getUserById } from '@/lib/user-service';
import { getSessionUserId } from '@/lib/session-core';
import type { User } from '@/types';

export * from '@/lib/session-core';
/** Logged-in user loaded fresh from the DB (never from client data). */
export async function getSessionUser(): Promise<User | null> {
  const id = await getSessionUserId();
  if (!id) return null;
  const user = await getUserById(id);
  if (!user) return null;
  const { password, ...rest } = user;
  return rest as User;
}

/** Allow only the user themself, or an admin (admins can view-as / manage others). */
export async function requireSelfOrAdmin(userId: string): Promise<void> {
  const me = await getSessionUser();
  if (!me || (me.id !== userId && me.role !== 'SYSTEM_ADMIN' && me.role !== 'ADMIN')) {
    throw new Error('Unauthorized');
  }
}

