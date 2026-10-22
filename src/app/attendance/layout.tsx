
import { AttendanceGuard } from './AttendanceGuard';
import type { Viewport } from 'next';
import React from 'react';

// This layout wraps all pages inside the /attendance route group with AttendanceGuard
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function AttendanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AttendanceGuard>{children}</AttendanceGuard>;
}

