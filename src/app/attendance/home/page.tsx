"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { LogIn, BarChart } from 'lucide-react';

export default function AttendanceHomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-500/10 via-green-500/5 to-background p-4">
       <div className="absolute inset-0 -z-10 h-full w-full bg-background">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,theme(colors.border/0.1)_1px,transparent_1px),linear-gradient(to_bottom,theme(colors.border/0.1)_1px,transparent_1px)] bg-[size:30px_30px] opacity-50 dark:opacity-20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,theme(colors.background)_90%)]"></div>
      </div>
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200 tracking-tight">Attendance Portal</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">Welcome to the attendance module.</p>
        <div className="mt-8 flex justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/attendance/login">
                <LogIn className="mr-2 h-5 w-5" />
                Log In
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/attendance">
                <BarChart className="mr-2 h-5 w-5" />
                View Report
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
