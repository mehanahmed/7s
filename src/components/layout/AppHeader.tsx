
"use client";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { UserNav } from "./UserNav";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import Image from 'next/image';
import { NotificationBell } from './NotificationBell';
import { FaqDialog } from './FaqDialog';


export function AppHeader() {
  const { currentUser, stopImpersonating, originalUser } = useAuth();
  const { state: sidebarState, isMobile, openMobile } = useSidebar();
  const isSidebarExpanded = isMobile ? openMobile : sidebarState === 'expanded';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/90 backdrop-blur-lg supports-[backdrop-filter]:bg-background/75 shadow-sm print:hidden">
      {originalUser && (
        <div className="bg-primary/10 border-b border-primary/20 py-1.5 sm:py-2 px-3 sm:px-4 flex flex-col sm:flex-row justify-center items-center gap-1.5 sm:gap-4 text-center">
          <p className="text-xs sm:text-sm font-medium text-primary flex items-center justify-center flex-wrap gap-1.5 sm:gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span>Currently viewing as <span className="font-bold underline">{currentUser?.name}</span> ({currentUser?.role?.replace(/_/g, ' ') || 'User'})</span>
          </p>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-6 sm:h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-none px-2.5 sm:px-3 rounded shrink-0"
            onClick={stopImpersonating}
          >
            Return to My Account ({originalUser.name})
          </Button>
        </div>
      )}
      <div className="w-full flex h-16 sm:h-[4.5rem] md:h-20 items-center justify-between max-w-full px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center">
          <SidebarTrigger className="text-foreground hover:bg-accent hover:text-accent-foreground -ml-1 sm:-ml-2 p-1.5 rounded-md md:hidden h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center shrink-0" />
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center space-x-1.5 sm:space-x-2 text-primary hover:text-primary/80 transition-colors ml-1.5 sm:ml-2",
              !isMobile && isSidebarExpanded && "hidden"
            )}
          >
            <Image
              src="/logo-trim.png"
              alt="Seven Solution Logo"
              width={1200}
              height={429}
              priority
              unoptimized
              className="h-8 w-auto shrink-0 object-contain sm:h-10 lg:h-[46px]"
            />
          </Link>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
          {currentUser?.role !== 'VENDOR' && (
            <>
              <FaqDialog>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-foreground hover:bg-accent hover:text-accent-foreground h-8 sm:h-9 md:h-10 px-2 sm:px-2.5 md:px-3 text-xs sm:text-sm"
                  title="Dialogue"
                >
                  <HelpCircle className="h-4 w-4 sm:h-4.5 sm:w-4.5 sm:mr-1.5 shrink-0" />
                  <span className="hidden sm:inline">Dialogue</span>
                </Button>
              </FaqDialog>
            </>
          )}

          {currentUser && <NotificationBell key={currentUser.id} />}
          <UserNav />
        </div>
      </div>
    </header>
  );
}
