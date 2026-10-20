

import React, { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PipelineClient } from '@/components/pipeline/PipelineClient';
import { Briefcase } from 'lucide-react';

function PipelinePageSkeleton() {
  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.24))] p-1 sm:p-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48 rounded-md" />
            <Skeleton className="h-4 w-96 mt-2 rounded-md" />
          </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-4 mb-4 mt-4">
        <Skeleton className="h-10 w-full lg:max-w-xs rounded-md" />
        <div className="flex-grow flex flex-col sm:flex-row items-center gap-2">
            <Skeleton className="h-10 w-full sm:w-48 rounded-md" />
            <div className="flex items-center bg-muted p-1 rounded-md ml-auto">
                <Skeleton className="h-8 w-16 rounded-md" />
            </div>
            <Skeleton className="h-10 w-32 rounded-md" />
            <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>
       <div className="mt-4 border rounded-lg overflow-hidden bg-card p-4">
          <div className="overflow-x-auto">
            <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
            </div>
             <div className="mt-4">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 border-b">
                        <Skeleton className="h-5 w-5" />
                        <Skeleton className="h-10 w-32" />
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-8 w-8 rounded-full ml-auto" />
                    </div>
                ))}
            </div>
          </div>
       </div>
    </div>
  );
}


export default function PipeLinePage() {
  // Data fetching is now handled inside PipelineClient
  return (
    <Suspense fallback={<PipelinePageSkeleton />}>
      <PipelineClient />
    </Suspense>
  );
}
