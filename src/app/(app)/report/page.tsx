
import React, { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportPageClient } from './ReportPageClient';
import { Package, Users as UsersIcon } from 'lucide-react';

function ReportPageSkeleton() {
  return (
    <div className="space-y-6 p-1 sm:p-0">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:flex-1">
          <Skeleton className="h-[68px] mb-4" />
          <Skeleton className="h-[300px]" />
        </div>
        <div className="w-full lg:flex-1">
          <Skeleton className="h-[68px] mb-4" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<ReportPageSkeleton />}>
      <ReportPageClient />
    </Suspense>
  );
}
