
import { Suspense } from 'react';
import { getBillById } from '@/lib/vendor-bill-service';
import { notFound } from 'next/navigation';
import { BillDetailsClient } from './BillDetailsClient';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { getUserById } from '@/lib/user-service';

interface BillPageProps {
  params: Promise<{ billId: string }>;
}

export default async function BillPage({ params }: BillPageProps) {
  const { billId } = await params;

  const billDataResult = await getBillById(billId);

  if (!billDataResult) {
    notFound();
  }

  const vendorDataResult = billDataResult.vendorId
    ? await getUserById(billDataResult.vendorId)
    : null;

  const plainBillData = JSON.parse(JSON.stringify(billDataResult));
  const plainVendorData = vendorDataResult ? JSON.parse(JSON.stringify(vendorDataResult)) : null;

  return (
    <div className="min-h-screen bg-background py-6 sm:py-10 px-4 sm:px-6 lg:px-8 selection:bg-primary/20 selection:text-primary print:p-0 print:m-0 print:bg-white">


      <Suspense fallback={<BillPageSkeleton />}>
        <BillDetailsClient
          bill={plainBillData}
          vendor={plainVendorData}
        />
      </Suspense>

      <footer className="text-center mt-16 sm:mt-20 py-8 sm:py-10 border-t border-border/30 print:hidden">
        <p className="text-sm sm:text-md text-muted-foreground">&copy; {new Date().getFullYear()} <span className="font-bold">Seven Solution</span>. All rights reserved.</p>
        <p className="text-xs sm:text-sm text-muted-foreground/70 mt-1 sm:mt-1.5">Precision Vendor Management, Simplified.</p>
      </footer>
    </div>
  );
}

function BillPageSkeleton() {
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
          </div>
        </div>
        <Skeleton className="h-px w-full my-6" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-6 w-32 mb-4 mt-8" />
        <Skeleton className="h-40 w-full" />
        <div className="flex justify-end mt-8">
          <div className="w-full max-w-sm space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-8 w-full mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

