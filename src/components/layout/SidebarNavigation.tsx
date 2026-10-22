
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, useSidebar, SidebarMenuButton } from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Package,
  Users,
  Link2,
  Settings2,
  FileText,
  Award,
  BarChart3,
  ListChecks,
  Layers,
  Target,
  DollarSign,
  Briefcase,
  MessageCircle,
  Landmark,
  Shield,
  ChevronDown,
  Map,
  ShoppingCart,
  FolderHeart,
  DatabaseZap,
  MapPin,
  ClipboardList,
  Gift,
  Palette,
  Box,
  Shrink,
  GlobeLock,
  Wallet,
  Archive,
  Phone,
  Activity,
  ShoppingBag,
  CreditCard,
  Calendar,
  CalendarClock,
  Truck,
  Fingerprint,
} from "lucide-react";
import type { UserRole, GlobalSettings } from "@/types";
import { cn } from "@/lib/utils";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getGlobalSettings } from '@/lib/settings-service';
import { AnimatePresence, motion } from "framer-motion";


interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  disabled?: boolean;
  isHeader?: boolean;
  subItems?: NavItem[];
  external?: boolean;
}

// solid rounded-square icon badges (white glyph); same 22px footprint as before so row height does not change
const MENU_ICON_BG: Record<string, string> = {
  Dashboard: 'bg-blue-500',
  Report: 'bg-violet-500',
  CRM: 'bg-red-500',
  Orders: 'bg-orange-500',
  Quotations: 'bg-purple-500',
  Artists: 'bg-pink-500',
  Expenses: 'bg-green-500',
  Invoice: 'bg-sky-500',
  Leaderboard: 'bg-amber-500',
  Projects: 'bg-teal-500',
  Administration: 'bg-slate-500',
  'All Orders': 'bg-orange-500',
  Attendance: 'bg-emerald-500',
  HRM: 'bg-cyan-500',
  'Attendance Log': 'bg-emerald-500',
  'Geoforce & Office': 'bg-indigo-500',
  Documentation: 'bg-blue-500',
  // sub menu
  'Pipe Line': 'bg-blue-500',
  'Follow UP': 'bg-green-500',
  Meeting: 'bg-violet-500',
  SOW: 'bg-pink-500',
  'Manage Users': 'bg-sky-500',
  'Role & Permission': 'bg-red-500',
  Settings: 'bg-purple-500',
  'Payment methods': 'bg-teal-500',
  Services: 'bg-orange-500',
  'Payment History': 'bg-amber-500',
};

function MenuIcon({ icon: Icon, label, small }: { icon: React.ElementType; label: string; small?: boolean }) {
  return (
    <span className={cn('mr-3 flex shrink-0 items-center justify-center rounded-md text-white shadow-sm', small ? '-my-0.5 h-5 w-5' : '-my-px h-[22px] w-[22px]', MENU_ICON_BG[label] ?? 'bg-slate-500')}>
      <Icon className={small ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
    </span>
  );
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["SYSTEM_ADMIN", "ADMIN", "CR", "SW", "CG", "EDITOR", "ARTIST", "VENDOR", "LR", "CO"] },
  { href: "/report", label: "Report", icon: BarChart3, roles: ["SYSTEM_ADMIN", "ADMIN"] },
  {
    isHeader: true,
    label: "CRM",
    icon: Shield,
    roles: ["SYSTEM_ADMIN", "ADMIN", "CR"],
    href: "",
    subItems: [
      { href: "/pipeline", label: "Pipe Line", icon: Briefcase, roles: ["SYSTEM_ADMIN", "ADMIN", "CR"] },
      { href: "/follow-up", label: "Follow UP", icon: Calendar, roles: ["SYSTEM_ADMIN", "ADMIN", "CR"] },
      { href: "/crm/meetings", label: "Meeting", icon: CalendarClock, roles: ["SYSTEM_ADMIN", "ADMIN", "CR"] },
      { href: "/crm/sow", label: "SOW", icon: FolderHeart, roles: ["SYSTEM_ADMIN", "ADMIN", "CR"] },
    ]
  },
  { href: "/orders", label: "Orders", icon: Package, roles: ["SYSTEM_ADMIN", "ADMIN", "CR"] },
  { href: "/all-orders", label: "All Orders", icon: ShoppingBag, roles: ["CR", "SW", "CG", "EDITOR", "ARTIST", "CO"] },
  { href: "/quotation", label: "Quotations", icon: ClipboardList, roles: ["SYSTEM_ADMIN", "ADMIN", "CR"] },
  { href: "/artists", label: "Artists", icon: Palette, roles: ["SYSTEM_ADMIN", "ADMIN"] },
  { href: "/expenses", label: "Expenses", icon: DollarSign, roles: ["SYSTEM_ADMIN", "ADMIN", "CR", "SW", "CG", "EDITOR", "ARTIST", "LR"] },
  { href: "/invoice", label: "Invoice", icon: FileText, roles: ["SYSTEM_ADMIN", "ADMIN", "CR"] },
  { href: "/leaderboard", label: "Leaderboard", icon: Award, roles: ["SYSTEM_ADMIN", "ADMIN", "CR", "SW", "CG", "EDITOR", "ARTIST"] },
  { href: "/projects", label: "Projects", icon: Briefcase, roles: ["SYSTEM_ADMIN", "ADMIN", "CR", "SW", "CG", "EDITOR", "ARTIST", "LR", "CO"] },
  {
    isHeader: true,
    label: "HRM",
    icon: Users,
    roles: ["SYSTEM_ADMIN", "ADMIN"],
    href: "",
    subItems: [
      { href: "/hrm/attendance", label: "Attendance Log", icon: Fingerprint, roles: ["SYSTEM_ADMIN", "ADMIN"] },
      { href: "/hrm/geoforce", label: "Geoforce & Office", icon: GlobeLock, roles: ["SYSTEM_ADMIN", "ADMIN"] },
      { href: "/hrm/documentation", label: "Documentation", icon: FileText, roles: ["SYSTEM_ADMIN", "ADMIN"] },
    ]
  },
  {
    isHeader: true,
    label: "Administration",
    icon: Settings2,
    roles: ["SYSTEM_ADMIN", "ADMIN"],
    href: "",
    subItems: [
      { href: "/users", label: "Manage Users", icon: Users, roles: ["SYSTEM_ADMIN", "ADMIN"] },
      { href: "/admin/custom-access", label: "Role & Permission", icon: Shield, roles: ["SYSTEM_ADMIN"] },
      { href: "/admin/settings", label: "Settings", icon: Target, roles: ["SYSTEM_ADMIN"] },
      { href: "/admin/model-management", label: "Services", icon: Layers, roles: ["SYSTEM_ADMIN", "ADMIN"] },
      { href: "/admin/payment-history", label: "Payment History", icon: Wallet, roles: ["SYSTEM_ADMIN"] },
    ]
  },
];

export function SidebarNavigation() {
  const pathname = usePathname();
  const { currentUser } = useAuth();
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const { state: sidebarState, isMobile, openMobile, setOpenMobile } = useSidebar();

  useEffect(() => {
    async function fetchSettings() {
      if (currentUser) {
        const settings = await getGlobalSettings();
        setGlobalSettings(settings);
      }
    }
    fetchSettings();
  }, [currentUser]);

  useEffect(() => {
    const activeHeader = navItems.find(
      item => item.isHeader && item.subItems?.some(sub => sub.href && pathname?.startsWith(sub.href))
    );
    setOpenMenus(activeHeader ? { [activeHeader.label]: true } : {});
  }, [pathname]);


  const toggleMenu = (label: string) => {
    setOpenMenus(prev => {
      const isCurrentlyOpen = !!prev[label];
      return { [label]: !isCurrentlyOpen };
    });
  };

  const canUserLogExpense = useMemo(() => {
    if (!currentUser || !globalSettings?.expenseLoggingPermissions) return false;
    if (currentUser.role === 'SYSTEM_ADMIN') return true;

    const perms = globalSettings.expenseLoggingPermissions;
    switch (perms.mode) {
      case 'all': return true;
      case 'none': return false;
      case 'specificRoles': return perms.allowedRoles.includes(currentUser.role);
      case 'specificUsers': return perms.allowedUserIds.includes(currentUser.id);
      default: return false;
    }
  }, [currentUser, globalSettings]);

  if (!currentUser) return null;

  const userRole = currentUser.role;

  const isSidebarExpanded = isMobile ? openMobile : sidebarState === 'expanded';

  const renderNavItems = (items: NavItem[]) => {
    return items.map((item) => {

      let shouldShowItem = item.roles.includes(userRole);

      // Special check for Finance Manager
      if (item.href === "/expenses" && !canUserLogExpense) {
        shouldShowItem = false;
      }

      // Special check for Leaderboard restriction
      if (item.href === "/leaderboard" && globalSettings?.isLeaderboardRestrictedToAdmin) {
        if (userRole !== 'ADMIN' && userRole !== 'SYSTEM_ADMIN') {
          shouldShowItem = false;
        }
      }

      // If it's a header, check if any sub-item should be shown
      if (item.isHeader && item.subItems) {
        shouldShowItem = item.subItems.some(sub => {
          const roleMatch = sub.roles.includes(userRole);
          if (!roleMatch) return false;

          if (sub.href === "/expenses" && !canUserLogExpense) return false;

          if (sub.href === "/leaderboard" && globalSettings?.isLeaderboardRestrictedToAdmin) {
            return (userRole === 'ADMIN' || userRole === 'SYSTEM_ADMIN');
          }

          return true;
        });
      }

      if (!shouldShowItem) return null;

      if (item.subItems && item.subItems.length > 0) {
        const isMenuOpen = openMenus[item.label] || false;

        return (
          <React.Fragment key={item.label}>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => toggleMenu(item.label)}
                isActive={false} // Set to false to prevent highlighting
                className={cn(
                  "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium py-2.5 px-3 h-auto rounded-lg transition-all duration-200 ease-in-out transform hover:translate-x-1"
                )}
              >
                <MenuIcon icon={item.icon} label={item.label} />
                <span className="truncate group-data-[collapsible=icon]:hidden text-sm flex-1 text-left">
                  {item.label}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200 group-data-[collapsible=icon]:hidden",
                    isMenuOpen && "rotate-180"
                  )}
                />
              </SidebarMenuButton>
            </SidebarMenuItem>
            <AnimatePresence>
              {isMenuOpen && isSidebarExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <SidebarMenuSub>
                    {item.subItems.map(subItem => {
                      if (!subItem.roles.includes(userRole) || (subItem.href === "/expenses" && !canUserLogExpense)) {
                        return null;
                      }

                      if (subItem.href === "/leaderboard" && globalSettings?.isLeaderboardRestrictedToAdmin) {
                        if (userRole !== 'ADMIN' && userRole !== 'SYSTEM_ADMIN') {
                          return null;
                        }
                      }

                      const isSubActive = !!(pathname && subItem.href && (pathname === subItem.href || pathname.startsWith(subItem.href)));

                      const linkProps = subItem.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {};

                      return (
                        <SidebarMenuSubItem key={subItem.href}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isSubActive}
                            disabled={subItem.disabled}
                          >
                            <Link 
                              href={subItem.href} 
                              className="flex items-center w-full" 
                              onClick={() => { if (isMobile) setOpenMobile(false); }}
                              {...linkProps}
                            >
                              <MenuIcon icon={subItem.icon} label={subItem.label} small />
                              <span className="truncate text-sm">{subItem.label}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </motion.div>
              )}
            </AnimatePresence>
          </React.Fragment>
        );
      }

      const isActive = !!(pathname && item.href && (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))));

      return (
        <SidebarMenuItem key={`${item.href}-${item.label}`}>
          <SidebarMenuButton
            asChild
            isActive={isActive}
            onClick={() => {
              setOpenMenus({});
              if (isMobile) setOpenMobile(false);
            }}
            tooltip={{
              children: item.label,
              side: 'right',
              align: 'center',
              className: "bg-primary text-primary-foreground shadow-lg border-none text-xs px-2.5 py-1.5 rounded-md"
            }}
            disabled={item.disabled}
            aria-disabled={item.disabled}
            className={
              cn(
                "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium py-2.5 px-3 h-auto rounded-lg transition-all duration-200 ease-in-out transform hover:translate-x-1",
                isActive && "bg-gradient-to-r from-primary to-blue-500 text-primary-foreground font-semibold shadow-md hover:shadow-lg",
                item.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-sidebar-foreground/80 hover:translate-x-0"
              )
            }
          >
            <Link href={item.href} className="flex items-center w-full">
              <MenuIcon icon={item.icon} label={item.label} />
              <span className="truncate group-data-[collapsible=icon]:hidden text-sm">
                {item.label}
              </span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });
  };

  return <>{renderNavItems(navItems)}</>;
}
