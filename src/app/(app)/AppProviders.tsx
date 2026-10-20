
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { SidebarProvider } from '@/components/ui/sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { GlobalSettings, User } from '@/types';
import { Construction } from 'lucide-react';

const AccountSuspendedDialog = dynamic(() => import('@/components/auth/AccountSuspendedDialog').then(mod => mod.AccountSuspendedDialog), { ssr: false });
const PinLockDialog = dynamic(() => import('@/components/auth/PinLockDialog').then(mod => mod.PinLockDialog), { ssr: false });

const MaintenancePage: React.FC<{ message: string | null }> = ({ message }) => {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground p-6 text-center overflow-hidden">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,theme(colors.border/0.1)_1px,transparent_1px),linear-gradient(to_bottom,theme(colors.border/0.1)_1px,transparent_1px)] bg-[size:30px_30px] opacity-50 dark:opacity-20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,theme(colors.background)_80%)]"></div>
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, rotate: -15 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.7, ease: "easeOut", type: "spring", stiffness: 100 }}
        className="mb-8"
      >
        <Construction className="h-24 w-24 text-primary drop-shadow-[0_5px_15px_rgba(var(--primary-hsl),0.3)]" />
      </motion.div>
      <motion.h1
        className="text-4xl font-bold mb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        Under Maintenance
      </motion.h1>
      <motion.p
        className="text-lg text-muted-foreground max-w-lg mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        {message || "We are currently performing scheduled maintenance. We should be back online shortly. Thank you for your patience."}
      </motion.p>
    </div>
  );
};

// This new component will contain the logic that uses the useAuth hook.
// Pure CSS so the ring starts animating on first paint (no JS/hydration delay).
function LoadingRing() {
  return (
    <div className="relative h-44 w-44">
      <style>{`
        @keyframes svRing{from{stroke-dashoffset:289}to{stroke-dashoffset:26}}
        @keyframes svPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
      `}</style>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" fill="none" strokeWidth="4" className="stroke-primary/15" />
        <circle
          cx="50" cy="50" r="46" fill="none" strokeWidth="4" strokeLinecap="round"
          className="stroke-primary"
          style={{ strokeDasharray: 289, strokeDashoffset: 289, animation: 'svRing 3s cubic-bezier(.2,.8,.2,1) forwards' }}
        />
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/loading.png" alt="Loading" className="absolute inset-0 m-auto h-32 w-32 object-contain" style={{ animation: 'svPulse 2s ease-in-out infinite' }} />
    </div>
  );
}
function AppShell({
  children,
  initialGlobalSettings,
}: {
  children: React.ReactNode;
  initialGlobalSettings: GlobalSettings;
}) {
  const { currentUser, isLoading, logout, isSuspendedDialogOpen, originalUser } = useAuth();
  const router = useRouter();
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);

  useEffect(() => {
    setShowLoadingScreen(isLoading);
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading && !currentUser && !isSuspendedDialogOpen) {
      router.replace('/login');
    } else if (!isLoading && currentUser) {
      // Guard for custom roles: They cannot access internal (app) routes
      // If originalUser is present, it means an admin is impersonating, so we allow them to stay
      const systemRoles = ["SYSTEM_ADMIN", "ADMIN", "CR", "VENDOR", "LR", "CO", "HRM", "ACCOUNTANT", "MANAGER", "SW", "CG", "EDITOR", "ARTIST"];
      if (!systemRoles.includes(currentUser.role) && !originalUser) {
        // Custom roles only had the attendance app, which no longer exists.
        logout();
      }
    }
  }, [currentUser, isLoading, router, isSuspendedDialogOpen, originalUser]);

  const inMaintenanceMode = useMemo(() => {
    if (isLoading || !initialGlobalSettings) return false;
    if (!initialGlobalSettings.maintenanceMode) return false;
    if (currentUser?.role === 'SYSTEM_ADMIN') return false;
    return true;
  }, [isLoading, initialGlobalSettings, currentUser]);

  if (!currentUser && showLoadingScreen) {
    return (
      <AnimatePresence>
        {showLoadingScreen && (
          <motion.div
            key="loadingScreen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            className="fixed inset-0 z-50 flex h-screen w-full flex-col items-center justify-center bg-background text-foreground"
          >
            <LoadingRing />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (inMaintenanceMode) {
    return <MaintenancePage message={initialGlobalSettings?.maintenanceMessage ?? null} />;
  }

  return (
    <SidebarProvider className="w-full max-w-full min-w-0">
      <div
        className="flex-grow w-full max-w-full min-w-0 min-h-svh"
      >
        {currentUser && !isSuspendedDialogOpen ? children : null}
      </div>
      {isSuspendedDialogOpen && <AccountSuspendedDialog isOpen={isSuspendedDialogOpen} onConfirmLogout={logout} />}
      <PinLockDialog />
    </SidebarProvider>
  );
}

// AppProviders is now simpler and primarily sets up the context.
export function AppProviders({
  children,
  initialUser, // This prop is no longer used here but kept for structural consistency
  initialGlobalSettings,
}: {
  children: React.ReactNode;
  initialUser: User | null;
  initialGlobalSettings: GlobalSettings;
}) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // Render a basic loading state on the server to prevent errors
    return (
      <div className="fixed inset-0 z-50 flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
        <LoadingRing />
      </div>
    );
  }

  return (
    <AppShell initialGlobalSettings={initialGlobalSettings}>
      {children}
    </AppShell>
  );
}
