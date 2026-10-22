import { AttendanceGuard } from './AttendanceGuard';
import type { Viewport } from 'next';
import React from 'react';
import { headers } from 'next/headers';
import { getSystemLicenseStatus, normalizeHost } from '@/lib/license-service';
import { redirect } from 'next/navigation';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function AttendanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const host = normalizeHost(h.get('x-forwarded-host') || h.get('host') || 'localhost');
  const lic = await getSystemLicenseStatus(host);
  if (!lic.valid) {
    redirect('/license');
  }

  return <AttendanceGuard>{children}</AttendanceGuard>;
}
