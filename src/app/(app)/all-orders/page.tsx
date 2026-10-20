
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Package as PackageIcon, Eye, Edit3, Search, RefreshCw, Loader2, MoreVertical, Calendar as CalendarIcon, X } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import { useSocket } from "@/contexts/socket-context";
import Link from "next/link";
import type { TrackingLink, User, CustomStatus, GlobalSettings } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getOrders, getOrdersWithTotal } from '@/lib/order-service';
import { getStatuses } from '@/lib/status-service';
import { getUsers } from '@/lib/user-service';
import { getGlobalSettings } from '@/lib/settings-service';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getLatestOrderAssignee } from '@/lib/latest-order-assignee';
import { getContrastTextColor } from '@/lib/color-utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { DateRangePicker3, type PredefinedRange } from '@/components/dashboard/date-range-picker3';
import type { DateRange } from "react-day-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis
} from "@/components/ui/pagination";
import { cn } from '@/lib/utils';
import { DR_ROLES } from '@/lib/roles';

const EditTrackingLinkDialog = dynamic(() => import('@/components/all-orders/edit-tracking-link-dialog').then(mod => mod.EditTrackingLinkDialog));

const ITEMS_PER_PAGE = 25;

export default function AllOrdersPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  const [selectedLink, setSelectedLink] = useState<TrackingLink | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleDateRangeChange = (range: DateRange | undefined, label: string, predefined: PredefinedRange | "custom" | null) => {
    setSelectedDateRange(range);
  };

  const { data: queryData, isLoading: isQueryLoading, refetch } = useQuery({
    queryKey: [
      'allOrders',
      currentUser?.role,
      selectedDateRange?.from?.toISOString(),
      selectedDateRange?.to?.toISOString(),
      currentPage,
      debouncedSearchTerm,
    ],
    queryFn: async () => {
      const startStr = (!debouncedSearchTerm && selectedDateRange?.from) ? format(startOfDay(selectedDateRange.from), 'yyyy-MM-dd HH:mm:ss') : undefined;
      const endStr = (!debouncedSearchTerm && selectedDateRange?.to) ? format(endOfDay(selectedDateRange.to), 'yyyy-MM-dd HH:mm:ss') : undefined;
      const role = currentUser?.role;
      const userId = undefined;

      const [fetchedResult, fetchedStatuses, fetchedUsers, fetchedSettings] = await Promise.all([
        getOrdersWithTotal(startStr, endStr, role, userId, currentPage, ITEMS_PER_PAGE, debouncedSearchTerm),
        getStatuses(),
        getUsers(),
        getGlobalSettings()
      ]);

      const uMap: Record<string, User> = {};
      fetchedUsers.forEach(u => { uMap[u.id] = u; });

      return {
        trackingLinks: fetchedResult.orders,
        totalOrders: fetchedResult.total,
        allStatuses: fetchedStatuses,
        usersMap: uMap,
        globalAppSettings: fetchedSettings,
      };
    },
    enabled: !!currentUser,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const trackingLinks = queryData?.trackingLinks ?? [];
  const totalOrders = queryData?.totalOrders ?? 0;
  const allStatuses = queryData?.allStatuses ?? [];
  const usersMap = queryData?.usersMap ?? {};
  const globalAppSettings = queryData?.globalAppSettings ?? null;
  const isLoading = isQueryLoading && !queryData;

  const fetchData = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['allOrders'] });
  }, [queryClient]);

  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on("order-updated", (data: any) => {
      console.log("AllOrdersPage: Order updated remotely:", data);
      queryClient.invalidateQueries({ queryKey: ['allOrders'] });
    });

    return () => {
      socket.off("order-updated");
    };
  }, [socket, queryClient]);

  const getStatusDisplayInfoCallback = useCallback((statusId: string): { name: string; color: string; textColor: string } => {
    const status = allStatuses.find(s => s.id === statusId);
    if (status) {
      return { name: status.name, color: status.color, textColor: getContrastTextColor(status.color) };
    }
    return { name: statusId, color: '#A1A1AA', textColor: '#FFFFFF' };
  }, [allStatuses]);

  const getInitials = (name: string) => {
    if (!name) return "U";
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return names[0].charAt(0).toUpperCase() + names[names.length - 1].charAt(0).toUpperCase();
  };

  const canEditSpecificLink = (link: TrackingLink) => {
    if (!currentUser) return false;
    return ['ADMIN', 'SYSTEM_ADMIN', 'CR', ...DR_ROLES, 'CO'].includes(currentUser.role);
  };

  const handleTrackingLinkUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['allOrders'] });
    setIsEditDialogOpen(false);
    setSelectedLink(null);
  };

  const totalPages = Math.ceil(totalOrders / ITEMS_PER_PAGE);
  const paginatedLinks = trackingLinks;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDateRange]);

  const [orderStatusDisplay, setOrderStatusDisplay] = useState<Record<string, { name: string; color: string; textColor: string }>>({});

  useEffect(() => {
    if (allStatuses.length > 0) {
      const newDisplayInfoMap: Record<string, { name: string; color: string; textColor: string }> = {};
      const uniqueStatusIdsInScope = new Set<string>();
      paginatedLinks.forEach(link => uniqueStatusIdsInScope.add(link.currentStatus));

      uniqueStatusIdsInScope.forEach(statusId => {
        newDisplayInfoMap[statusId] = getStatusDisplayInfoCallback(statusId);
      });

      setOrderStatusDisplay(prevMap => {
        if (JSON.stringify(newDisplayInfoMap) !== JSON.stringify(prevMap)) {
          return newDisplayInfoMap;
        }
        return prevMap;
      });
    } else if (Object.keys(orderStatusDisplay).length > 0) {
      setOrderStatusDisplay({});
    }
  }, [paginatedLinks, allStatuses, getStatusDisplayInfoCallback]);

  const renderPagination = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, currentPage + 2);

      if (currentPage < 3) endPage = maxPagesToShow;
      else if (currentPage > totalPages - 2) startPage = totalPages - maxPagesToShow + 1;

      if (startPage > 1) {
        pageNumbers.push(1);
        if (startPage > 2) pageNumbers.push('...');
      }
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pageNumbers.push('...');
        pageNumbers.push(totalPages);
      }
    }
    return pageNumbers.map((page, index) => (
      <PaginationItem key={index}>
        {page === '...' ? <PaginationEllipsis />
          : <PaginationLink href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(page as number); }} className={cn(currentPage === page && 'bg-primary text-primary-foreground hover:bg-primary/90')}>
            {page}
          </PaginationLink>
        }
      </PaginationItem>
    ));
  };


  if (!currentUser) return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6 p-1 sm:p-0">
      <Card className="shadow-xl border bg-card rounded-lg overflow-hidden">
        <CardHeader className="border-b p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-grow">
              <CardTitle className="text-card-foreground text-xl">All Orders</CardTitle>
              <CardDescription className="text-muted-foreground text-sm mt-0.5">Overview of all orders and their current status.</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <DateRangePicker3
                initialRange={selectedDateRange}
                onDateRangeChange={handleDateRangeChange}
                className="h-10"
              />

              <div className="relative flex-grow sm:flex-grow-0 sm:max-w-xs w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background h-10 rounded-md w-full"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Order ID</TableHead>
                  <TableHead>Date Created</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Order Status</TableHead>
                  <TableHead>CR Contact</TableHead>
                  <TableHead>On Assigned</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={`skel-link-${i}`}>
                      <TableCell className="pl-6"><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="pr-6 text-right space-x-2">
                        <Skeleton className="h-9 w-9 inline-block rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedLinks.length > 0 ? (
                  paginatedLinks.map((link) => {
                    const latestAssignee = getLatestOrderAssignee(link);
                    const statusInfo = orderStatusDisplay[link.currentStatus] || { name: link.currentStatus, color: '#A1A1AA', textColor: '#FFFFFF' };
                    return (
                      <TableRow key={link.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="pl-6">
                          <Link href={`/track/${link.id}`} className="font-medium text-primary hover:underline">
                            {link.id}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {link.createdAt ? new Date(link.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          }) : 'N/A'}
                        </TableCell>
                        <TableCell className="text-card-foreground">{link.companyName}</TableCell>
                        <TableCell>
                          <Badge style={{ backgroundColor: statusInfo.color, color: statusInfo.textColor }} className="border-transparent">
                            {statusInfo.name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-card-foreground">
                          <div className="flex items-center gap-2">
                            {(globalAppSettings?.showAvatarsInOrders ?? true) && (
                              <Avatar className="h-6 w-6">
                                <AvatarImage 
                                  src={usersMap[link.crmUserId]?.avatarUrl || undefined} 
                                />
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                  {getInitials(link.crmUserName)}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <span>{link.crmUserName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-card-foreground">
                          {latestAssignee ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7 shrink-0 border border-blue-400">
                                <AvatarImage src={usersMap[latestAssignee.id]?.avatarUrl || undefined} alt={usersMap[latestAssignee.id]?.name || latestAssignee.name} />
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getInitials(usersMap[latestAssignee.id]?.name || latestAssignee.name)}</AvatarFallback>
                              </Avatar>
                              <span>{usersMap[latestAssignee.id]?.name || latestAssignee.name}</span>
                            </div>
                          ) : 'N/A'}
                        </TableCell>
                        <TableCell className="pr-6 text-right whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9" title="Actions">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild className="cursor-pointer">
                                <Link href={`/track/${link.id}`}>
                                  <Eye className="mr-2 h-4 w-4" /> View
                                </Link>
                              </DropdownMenuItem>
                              {canEditSpecificLink(link) && (
                                <DropdownMenuItem
                                  onSelect={() => { setSelectedLink(link); setIsEditDialogOpen(true); }}
                                  className="cursor-pointer"
                                >
                                  <Edit3 className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 h-[300px]">
                      <PackageIcon className="mx-auto h-12 w-12 opacity-50 mb-3 text-muted-foreground" />
                      <p className="text-lg text-muted-foreground font-medium">
                        {searchTerm ? "No orders match your search." : "No orders found."}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {searchTerm ? "Try a different search term." : "Orders will appear here once created."}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="py-4 border-t">
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }}
                    aria-disabled={currentPage === 1}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                {renderPagination()}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }}
                    aria-disabled={currentPage === totalPages}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardFooter>
      </Card>

      {selectedLink && currentUser && allStatuses.length > 0 && isEditDialogOpen && (
        <EditTrackingLinkDialog
          isOpen={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) setSelectedLink(null);
          }}
          trackingLink={selectedLink}
          currentUser={currentUser}
          availableStatuses={allStatuses}
          onTrackingLinkUpdated={handleTrackingLinkUpdated}
        />
      )}
    </div>
  );
}
