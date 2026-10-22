
"use server";

import {
  getUserByEmail,
  seedInitialAdminUser,
  getUserById,
  verifyUserPassword,
  updateUserAvatar as updateUserAvatarService,
  updateUserPinCode as updateUserPinCodeService,
  verifyUserPinCode as verifyUserPinCodeService,
  verifyUserPinCodeWithLock as verifyUserPinCodeWithLockService,
  lockUserAccount72h as lockUserAccount72hService,
  setupTwoFactorSecret as setupTwoFactorSecretService,
  enableTwoFactor as enableTwoFactorService,
  disableTwoFactor as disableTwoFactorService,
  verifyTwoFactorCode as verifyTwoFactorCodeService,
  getUserBackupCodes as getUserBackupCodesService,
  type PinVerificationResult,
  type SetupTwoFactorResult
} from '@/lib/user-service';
import type { User } from '@/types';
import {
  startSession, startPending2FA, clearSession, clearPending2FA,
  getSessionUserId, getPending2FAUserId, requireSelfOrAdmin,
  isRateLimited, recordFail, clearFails,
} from '@/lib/session';
import { markPublic } from '@/lib/guard';

export async function serverSeedInitialAdminUser() {
  markPublic();
  await seedInitialAdminUser();
}

export async function serverGetUserById(userId: string): Promise<User | null> {
  try {
    if (!(await getSessionUserId())) return null;
    const user = await getUserById(userId);
    if (!user) return null;
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  } catch {
    return null;
  }
}

export async function serverVerifyUserPassword(email: string, pass: string): Promise<User | null> {
  markPublic(); // login entry point; protected by rate limiting below
  const key = 'login:' + String(email).toLowerCase();
  if (isRateLimited(key)) return null;
  const user = await verifyUserPassword(email, pass);
  if (!user) {
    recordFail(key);
    return null;
  }
  clearFails(key);
  // 2FA users get only a short-lived pending token; the real session starts after the code is verified.
  if (user.hasTwoFactor && !user.isBanned) await startPending2FA(user.id);
  else await startSession(user.id);
  return user;
}

export async function serverLogout(): Promise<void> {
  await clearSession();
}

export async function serverUpdateUserAvatar(userId: string, avatarUrl: string | null): Promise<boolean> {
  await requireSelfOrAdmin(userId);
  return await updateUserAvatarService(userId, avatarUrl);
}

export async function serverUpdateUserPinCode(userId: string, pinCode: string | null): Promise<boolean> {
  await requireSelfOrAdmin(userId);
  return await updateUserPinCodeService(userId, pinCode);
}

export async function serverVerifyUserPinCode(userId: string, pinInput: string): Promise<boolean> {
  await requireSelfOrAdmin(userId);
  return await verifyUserPinCodeService(userId, pinInput);
}

export async function serverVerifyUserPinCodeWithLock(userId: string, pinInput: string): Promise<PinVerificationResult> {
  await requireSelfOrAdmin(userId);
  return await verifyUserPinCodeWithLockService(userId, pinInput);
}

export async function serverLockUserAccount72h(userId: string): Promise<{ success: boolean; lockedUntil: string }> {
  await requireSelfOrAdmin(userId);
  return await lockUserAccount72hService(userId);
}

export async function serverSetupTwoFactor(userId: string): Promise<SetupTwoFactorResult | null> {
  await requireSelfOrAdmin(userId);
  return await setupTwoFactorSecretService(userId);
}

export async function serverEnableTwoFactor(userId: string, token: string, secret: string, backupCodes: string[]): Promise<{ success: boolean; message?: string }> {
  await requireSelfOrAdmin(userId);
  return await enableTwoFactorService(userId, token, secret, backupCodes);
}

export async function serverDisableTwoFactor(userId: string): Promise<{ success: boolean; message?: string }> {
  await requireSelfOrAdmin(userId);
  return await disableTwoFactorService(userId);
}

export async function serverVerifyTwoFactorCode(userId: string, tokenInput: string): Promise<{ success: boolean; isBackupCode?: boolean; remainingBackupCodes?: number; message?: string }> {
  // Only valid right after a successful password check (pending cookie), and rate limited.
  if ((await getPending2FAUserId()) !== userId) return { success: false, message: 'Session expired. Please log in again.' };
  markPublic(); // pending-2FA cookie already proved the password step
  const key = '2fa:' + userId;
  if (isRateLimited(key)) return { success: false, message: 'Too many attempts. Try again in 15 minutes.' };
  const res = await verifyTwoFactorCodeService(userId, tokenInput);
  if (!res.success) {
    recordFail(key);
    return res;
  }
  clearFails(key);
  await clearPending2FA();
  await startSession(userId);
  return res;
}

export async function serverGetUserBackupCodes(userId: string): Promise<string[]> {
  await requireSelfOrAdmin(userId);
  return await getUserBackupCodesService(userId);
}
