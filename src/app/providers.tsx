
"use client";

import { AuthProvider } from '@/contexts/auth-context';
import { SocketProvider } from '@/contexts/socket-context';
import { Toaster } from "@/components/ui/toaster";
import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const ROUTE_TITLE_MAP: Record<string, string> = {
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/orders': 'Orders',
  '/orders/monthly': 'Monthly Orders',
  '/all-orders': 'All Orders',
  '/projects': 'Projects',
  '/workflow': 'Workflow',
  '/artists': 'Artists',
  '/quotation': 'Quotation',
  '/pipeline': 'Pipeline',
  '/leaderboard': 'Leaderboard',
  '/invoice': 'Invoices',
  '/expenses': 'Expenses',
  '/crm/meetings': 'Meetings',
  '/crm/sow': 'SOW',
  '/admin/settings': 'Settings',
  '/admin/statuses': 'Order Status Management',
  '/admin/payment-history': 'Payment History',
  '/admin/model-management': 'Services',
  '/admin/custom-access': 'Role & Permission',
  '/report': 'Reports',
  '/terms-approve': 'Terms Approval',
  '/track': 'Track Order',
};

function getPageTitle(pathname: string): string {
  // Direct exact match
  if (ROUTE_TITLE_MAP[pathname]) {
    return ROUTE_TITLE_MAP[pathname];
  }

  // Handle dynamic routes by prefix
  if (pathname.startsWith('/track/')) {
    return 'Track Order';
  }

  // Fallback: parse last segment nicely
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return '';

  const lastSegment = segments[segments.length - 1];
  
  // Format kebab-case or snake_case to Title Case
  return lastSegment
    .split(/[-_]/)
    .map(word => {
      if (word.toUpperCase() === 'CR') return 'CR';
      if (word.toUpperCase() === 'SOW') return 'SOW';
      if (word.toUpperCase() === 'HRM') return 'HRM';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname || '');
  const displayTitle = pageTitle && pageTitle !== 'Home' ? `${pageTitle} | Seven Solution` : 'Seven Solution';

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute fresh
        gcTime: 5 * 60 * 1000, // 5 minutes in memory cache
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  const isSpecialPage = pathname ? (
    pathname.startsWith('/track/') ||
    pathname.startsWith('/invoice/') ||
    pathname.startsWith('/pay/')
  ) : false;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isSpecialPage) return;

    const targetTitle = displayTitle;
    document.title = targetTitle;

    // Observe changes to the head element directly (covers title replacement & updates)
    const observer = new MutationObserver(() => {
      if (document.title !== targetTitle) {
        document.title = targetTitle;
      }
    });

    observer.observe(document.head, {
      subtree: true,
      characterData: true,
      childList: true
    });

    return () => {
      observer.disconnect();
    };
  }, [displayTitle, isSpecialPage]);

  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        <AuthProvider>
          {!isSpecialPage && <title>{displayTitle}</title>}
          {children}
          <Toaster />
        </AuthProvider>
      </SocketProvider>
    </QueryClientProvider>
  );
}

