
import { Suspense } from 'react';
import { getOrderById } from '@/lib/order-service';
import { getStatuses } from '@/lib/status-service';
import { getGlobalSettings } from '@/lib/settings-service';
import { getUsers } from '@/lib/user-service';
import { notFound } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Package } from 'lucide-react';
import { OrderDetailsLoader } from './OrderDetailsLoader';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/session';
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

export async function generateMetadata({ params }: PublicTrackingPageProps): Promise<Metadata> {
  const { trackingId } = await params;
  const order = await getOrderById(trackingId);

  if (!order) {
    return {
      title: 'Order Not Found',
    };
  }

  const companyNameParts = order.companyName.split('•').map((part: string) => part.trim());
  const businessName = companyNameParts.length > 1 ? companyNameParts[companyNameParts.length - 1] : order.companyName;

  return {
    title: `${businessName} | Seven Solution`,
  };
}


function TrackingPageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 sm:space-y-10 animate-pulse">
      <div className="shadow-2xl overflow-hidden border-border/40 bg-card rounded-xl">
        <div className="bg-card p-6 sm:p-8 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6">
            <div className="h-16 w-16 sm:h-20 sm:w-20 bg-primary/10 rounded-lg border border-primary/20 flex items-center justify-center mb-4 sm:mb-0 flex-shrink-0">
              <Package className="h-8 w-8 sm:h-10 sm:w-10 text-primary opacity-50" />
            </div>
            <div>
              <Skeleton className="h-8 w-72 mb-2 sm:h-10" />
              <Skeleton className="h-5 w-48 sm:h-6" />
            </div>
          </div>
        </div>
        <div className="p-6 sm:p-8 space-y-8">
          <div>
            <Skeleton className="h-7 w-40 mb-2" />
            <Skeleton className="h-10 w-56 mb-1" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </div>
    </div>
  );
}


interface PublicTrackingPageProps {
  params: Promise<{ trackingId: string }>;
}

export default async function PublicTrackingPage({ params }: PublicTrackingPageProps) {
  const { trackingId } = await params;

  // View count increment has been removed to prevent quota exhaustion.
  // if (trackingId) {
  //   await incrementOrderViewCount(trackingId);
  // }

  const [orderDataResult, allStatusesResult, globalSettingsResult, allUsersResult] = await Promise.all([
    getOrderById(trackingId),
    getStatuses(),
    getGlobalSettings(),
    getUsers()
  ]);

  if (!orderDataResult) {
    notFound();
  }

  const currentUser = await getSessionUser();

  const plainOrderData = JSON.parse(JSON.stringify(orderDataResult));
  const plainAllStatuses = JSON.parse(JSON.stringify(allStatusesResult));
  const plainGlobalSettings = JSON.parse(JSON.stringify(globalSettingsResult));
  const plainAllUsers = JSON.parse(JSON.stringify(allUsersResult));

  const areCommentsVisible = plainGlobalSettings.areCommentsVisibleOnPublicPage ?? true;

  return (
    <div className="min-h-screen bg-background pt-0 pb-6 sm:pb-10 px-2 sm:px-4 lg:px-3 selection:bg-primary/20 selection:text-primary print:p-0 print:m-0 print:bg-white">
      <Suspense fallback={<TrackingPageSkeleton />}>
        <OrderDetailsLoader
          order={plainOrderData}
          allStatuses={plainAllStatuses}
          allUsersForMentions={plainAllUsers}
          areCommentsVisible={areCommentsVisible}
          rolesAllowedToViewFinancials={plainGlobalSettings.rolesAllowedToViewFinancials ?? []}
          currentUser={currentUser}
          designApprovalStatusIds={plainGlobalSettings.designApprovalStatusIds ?? []}
          docsApprovalStatusIds={plainGlobalSettings.docsApprovalStatusIds ?? []}
          isOnlinePaymentEnabled={Boolean(plainGlobalSettings.paymentGatewayEnabled && plainGlobalSettings.paymentGatewayMerchantId)}
        />
      </Suspense>

      <footer className="text-center mt-16 sm:mt-20 py-8 sm:py-10 border-t border-border/30 print:hidden">
        <p className="text-sm sm:text-md text-muted-foreground">&copy; {new Date().getFullYear()} <span className="font-bold">Seven Solution</span>. All rights reserved.</p>
      </footer>
    </div>
  );
}
