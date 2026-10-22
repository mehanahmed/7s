"use client";

import { LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { currentUser, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && currentUser) {
      router.replace('/dashboard');
    }
  }, [currentUser, isLoading, router]);

  if (isLoading || (!isLoading && currentUser)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-sky-300 via-sky-200 to-sky-50 p-0 sm:p-5 selection:bg-primary/20 selection:text-primary">
      {/* soft rings behind the card */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50" />
        <div className="absolute left-1/2 top-1/2 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" />
        <div className="absolute left-1/2 top-1/2 h-[1020px] w-[1020px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
      </div>

      {/* clouds */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2">
        <div className="absolute -bottom-24 -left-24 h-72 w-[60%] rounded-full bg-white/80 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-80 w-[55%] rounded-full bg-white/90 blur-3xl" />
        <div className="absolute -bottom-20 -right-24 h-72 w-[55%] rounded-full bg-white/80 blur-3xl" />
        <div className="absolute bottom-24 left-[8%] h-24 w-56 rounded-full bg-white/60 blur-2xl" />
        <div className="absolute bottom-32 right-[10%] h-28 w-64 rounded-full bg-white/60 blur-2xl" />
      </div>

      <LoginForm />
    </div>
  );
}
