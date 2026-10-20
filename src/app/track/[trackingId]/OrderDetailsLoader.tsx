
"use client";

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { Package } from 'lucide-react';
import type { TrackingLink, CustomStatus, User, UserRole } from '@/types';

// Define skeleton here as it's used in loading
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

const OrderDetailsClient = dynamic(() => import('./OrderDetailsClient').then(mod => mod.OrderDetailsClient), {
  ssr: false, // Ensure this component is only rendered on the client side
  loading: () => <TrackingPageSkeleton />,
});

interface OrderDetailsLoaderProps {
  order: TrackingLink;
  allStatuses: CustomStatus[];
  allUsersForMentions: User[];
  areCommentsVisible: boolean;
  rolesAllowedToViewFinancials: UserRole[];
  currentUser: User | null;
  hideStatusHeader?: boolean;
  designApprovalStatusIds?: string[];
  docsApprovalStatusIds?: string[];
  isOnlinePaymentEnabled?: boolean;
}

export function OrderDetailsLoader({
  order,
  allStatuses,
  allUsersForMentions,
  areCommentsVisible,
  rolesAllowedToViewFinancials,
  currentUser,
  hideStatusHeader = false,
  designApprovalStatusIds = [],
  docsApprovalStatusIds = [],
  isOnlinePaymentEnabled = false,
}: OrderDetailsLoaderProps) {
  // Pass the currentUser to the client component
  // The AuthProvider will hydrate the true current user state on the client side, but passing it from the server
  // ensures the initial render has access to it for permission checks.
  return (
    <OrderDetailsClient
        order={order}
        allStatuses={allStatuses}
        allUsersForMentions={allUsersForMentions}
        areCommentsVisible={areCommentsVisible}
        rolesAllowedToViewFinancials={rolesAllowedToViewFinancials}
        initialCurrentUser={currentUser}
        hideStatusHeader={hideStatusHeader}
        designApprovalStatusIds={designApprovalStatusIds}
        docsApprovalStatusIds={docsApprovalStatusIds}
        isOnlinePaymentEnabled={isOnlinePaymentEnabled}
    />
  );
}
