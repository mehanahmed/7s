
"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";
import { LogOut, User as UserIcon, Settings, Edit3, Calculator, Hash, BadgeCheck, KeyRound, ShieldCheck } from "lucide-react";
import { EditProfileDialog } from "@/components/users/edit-profile-dialog";
import { PinSettingsDialog } from "@/components/users/PinSettingsDialog";
import { TwoFactorSettingsDialog } from "@/components/users/TwoFactorSettingsDialog";
import { getRoles } from "@/lib/user-role-service";

const GyroscopeIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <ellipse cx="12" cy="12" rx="10" ry="3" transform="rotate(45 12 12)" />
    <ellipse cx="12" cy="12" rx="10" ry="3" transform="rotate(-45 12 12)" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

export function UserNav() {
  const { currentUser, logout } = useAuth();
  const [displayMode, setDisplayMode] = useState<'amount'|'quantity'>('quantity');
  const [roleName, setRoleName] = useState<string>("");

  const isSystemAdmin = currentUser?.role === 'SYSTEM_ADMIN';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = sessionStorage.getItem('dashboardDisplayMode') as 'amount'|'quantity' || 'quantity';
      setDisplayMode(savedMode);
    }
  }, []);

  useEffect(() => {
    async function fetchRoleName() {
      if (!currentUser?.role) return;
      try {
        const roles = await getRoles();
        const roleDef = roles.find(r => r.id === currentUser.role);
        if (roleDef) {
          setRoleName(roleDef.name);
        }
      } catch (error) {
        console.error("Failed to fetch roles in UserNav:", error);
      }
    }
    fetchRoleName();
  }, [currentUser]);

  const toggleDisplayMode = () => {
    const newMode = displayMode === 'amount' ? 'quantity' : 'amount';
    setDisplayMode(newMode);
    sessionStorage.setItem('dashboardDisplayMode', newMode);
    window.dispatchEvent(new CustomEvent('dashboardDisplayModeChanged', { detail: { mode: newMode } }));
  };

  if (!currentUser) {
    return null;
  }

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return names[0].charAt(0).toUpperCase() + names[names.length - 1].charAt(0).toUpperCase();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-full p-0 shrink-0 focus-visible:ring-1 focus-visible:ring-primary">
          <Avatar className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 border-2 border-primary">
            <AvatarImage 
              src={currentUser.avatarUrl || undefined} 
              alt={currentUser.name} 
              data-ai-hint={currentUser.avatarUrl ? "user uploaded" : "abstract lettermark"} 
            />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm md:text-base font-semibold">
              {getInitials(currentUser.name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 sm:w-60 max-w-[calc(100vw-2rem)]" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium leading-none">{currentUser.name}</p>
              {currentUser.isLeader && (
                <BadgeCheck className="h-4 w-4 fill-[#6F4E37] text-white shrink-0" />
              )}
            </div>
            <p className="text-xs leading-none text-muted-foreground">
              {currentUser.email}
            </p>
            <p className="text-xs leading-none text-muted-foreground font-semibold pt-1">
              Role: {roleName || currentUser.role.replace(/_/g, " ")}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <EditProfileDialog>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
              <Edit3 className="mr-2 h-4 w-4" /> 
              <span>Edit Profile</span>
            </DropdownMenuItem>
          </EditProfileDialog>
          <PinSettingsDialog>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
              <KeyRound className="mr-2 h-4 w-4" />
              <span>{currentUser.hasPinCode ? "Security PIN" : "Set PIN Code"}</span>
            </DropdownMenuItem>
          </PinSettingsDialog>
          <TwoFactorSettingsDialog>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
              <ShieldCheck className="mr-2 h-4 w-4" />
              <span>Two-Factor Auth</span>
            </DropdownMenuItem>
          </TwoFactorSettingsDialog>
          {isSystemAdmin && (
            <DropdownMenuItem 
              onDoubleClick={toggleDisplayMode} 
              onSelect={(e) => e.preventDefault()} 
              className="cursor-pointer"
            >
              <GyroscopeIcon className="mr-2 h-4 w-4" />
              <span>Gyroscope</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem disabled>
            <UserIcon className="mr-2 h-4 w-4" />
            <span>Profile (Soon)</span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings (Soon)</span>
          </DropdownMenuItem>

        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
