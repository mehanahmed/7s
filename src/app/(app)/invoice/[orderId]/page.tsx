
import { Suspense } from 'react';
import { getOrderById } from '@/lib/order-service';
import { getStatuses } from '@/lib/status-service';
import { getUsers } from '@/lib/user-service';
import { notFound } from 'next/navigation';
import { InvoiceDetailsClient } from './InvoiceDetailsClient'; // New component
import { Package } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';

interface InvoicePageProps {
  params: Promise<{ orderId: string }>;
}

import { cookies } from 'next/headers';
import type { User } from '@/types';
import type { Metadata, Viewport } from 'next';

export async function generateViewport(): Promise<Viewport> {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get('colorhut-user');
  let currentUser: User | null = null;
  if (userCookie && userCookie.value) {
    try {
      const rawVal = userCookie.value.startsWith('%7B') ? decodeURIComponent(userCookie.value) : userCookie.value;
      currentUser = JSON.parse(rawVal);
    } catch (e) {
      try {
        currentUser = JSON.parse(decodeURIComponent(userCookie.value));
      } catch (e2) {
        currentUser = null;
      }
    }
  }

  if (!currentUser) {
    return {
      width: 'device-width',
      initialScale: 1,
    };
  }

  return {
    width: 1024,
  };
}

export async function generateMetadata({ params }: InvoicePageProps): Promise<Metadata> {
  const { orderId } = await params;
  const order = await getOrderById(orderId);

  if (!order) {
    return {
      title: 'Invoice Not Found',
    };
  }

  const companyNameParts = order.companyName.split('•').map((part: string) => part.trim());
  const businessName = companyNameParts.length > 1 ? companyNameParts[companyNameParts.length - 1] : order.companyName;

  return {
    title: `${businessName} | Seven Solution`,
  };
}

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { orderId } = await params;

  const [orderDataResult, allStatusesResult, allUsersResult] = await Promise.all([
    getOrderById(orderId),
    getStatuses(),
    getUsers()
  ]);

  if (!orderDataResult) {
    notFound();
  }

  // Ensure data is plain before passing to Client Component
  const plainOrderData = JSON.parse(JSON.stringify(orderDataResult));
  const plainAllStatuses = JSON.parse(JSON.stringify(allStatusesResult));
  const plainAllUsers = JSON.parse(JSON.stringify(allUsersResult));

  return (
    <div className="selection:bg-primary/20 selection:text-primary print:p-0 print:m-0 print:bg-white">


      <Suspense fallback={<InvoicePageSkeleton />}>
        <InvoiceDetailsClient
          order={plainOrderData}
          allStatuses={plainAllStatuses}
          allUsers={plainAllUsers}
        />
      </Suspense>

    </div>
  );
}

function InvoicePageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 sm:space-y-10 animate-pulse">
      <div className="shadow-2xl overflow-hidden border-border/40 bg-card rounded-xl p-6 sm:p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <Skeleton className="h-10 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-72 mt-1" />
          </div>
          <div className="text-right">
            <Skeleton className="h-6 w-32 mb-1" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-12 w-32 mt-2" />
          </div>
        </div>
        <Skeleton className="h-px w-full my-6" />
        <div className="grid grid-cols-2 gap-6 mb-8">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-40 w-full" />
        <div className="flex justify-end mt-8">
          <div className="w-full max-w-sm space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-8 w-full mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

