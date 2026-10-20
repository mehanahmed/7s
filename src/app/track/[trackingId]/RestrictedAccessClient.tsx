"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

export function RestrictedAccessClient() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <Lock className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-2xl font-semibold mb-2">Access Restricted</h2>
      <p className="text-muted-foreground mb-6">
        This tracking link is private. Please log in to view the order details.
      </p>
      <Button asChild>
        <Link href="/login">Go to Login</Link>
      </Button>
    </div>
  );
}
