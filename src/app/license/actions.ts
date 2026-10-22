"use server";

import { headers } from 'next/headers';
import {
  verifyLicenseKey,
  saveLicenseKey,
  getSystemLicenseStatus,
  normalizeHost,
  isLocalDevHost,
  LicenseVerificationResult
} from '@/lib/license-service';
import { markPublic } from '@/lib/guard';

export interface LicenseInfoResponse {
  host: string;
  isActivated: boolean;
  isDev: boolean;
  client?: string;
  type?: string;
  expiresAt?: string | null;
  error?: string;
}

export async function getLicenseInfoAction(): Promise<LicenseInfoResponse> {
  markPublic();
  const h = await headers();
  const host = normalizeHost(h.get('x-forwarded-host') || h.get('host') || 'localhost');
  const isDev = process.env.NODE_ENV !== 'production' && isLocalDevHost(host);

  const status = await getSystemLicenseStatus(host);

  return {
    host,
    isActivated: status.valid,
    isDev,
    client: status.payload?.client,
    type: status.payload?.type,
    expiresAt: status.payload?.exp ? new Date(status.payload.exp * 1000).toLocaleDateString() : 'Never (Lifetime)',
    error: status.error
  };
}

export async function activateLicenseAction(rawKey: string): Promise<{ success: boolean; message: string }> {
  markPublic();
  if (!rawKey || !rawKey.trim()) {
    return { success: false, message: 'Please enter a valid license key.' };
  }

  const h = await headers();
  const host = normalizeHost(h.get('x-forwarded-host') || h.get('host') || 'localhost');

  const verification: LicenseVerificationResult = verifyLicenseKey(rawKey.trim(), host);
  if (!verification.valid || !verification.payload) {
    return {
      success: false,
      message: verification.error || 'License verification failed.'
    };
  }

  await saveLicenseKey(rawKey.trim(), verification.payload);

  return {
    success: true,
    message: `System successfully activated for '${verification.payload.domain}'!`
  };
}
