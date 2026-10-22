"use client";

import React from 'react';
import { useAuth } from '@/contexts/auth-context';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { AccountSuspendedDialog } from '@/components/auth/AccountSuspendedDialog';

export function AttendanceGuard({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading, logout, isSuspendedDialogOpen } = useAuth();

  const isBanned = Boolean(currentUser?.isBanned || isSuspendedDialogOpen);

  if (isBanned) {
    return <AccountSuspendedDialog isOpen={true} onConfirmLogout={logout} />;
  }

  return (
    <>
      <main>{children}</main>
      {!isLoading && currentUser && <BottomNavigation />}
    </>
  );
}
