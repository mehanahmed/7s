

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { PlusCircle, Search, Eye, Users2, Loader2, Trash2, Edit3, MoreVertical, Package as PackageIcon, Settings2, Layers, RefreshCw, Repeat, CreditCard, Star, Download, Filter, CalendarDays, Link2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useSocket } from "@/contexts/socket-context";
import Link from "next/link";
import type { TrackingLink, User, CustomStatus, GlobalSettings } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getStatuses } from '@/lib/status-service';
import { getContrastTextColor } from '@/lib/color-utils';
import { getOrders, getOrdersWithTotal } from '@/lib/order-service';
import { getGlobalSettings } from '@/lib/settings-service';
import { getUsers } from '@/lib/user-service';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getLatestOrderAssignee } from '@/lib/latest-order-assignee';
import { STAGE_ASSIGN_ROLE } from "@/lib/project-stages";
import { Skeleton } from '@/components/ui/skeleton';
import { deleteOrderAction, updateOrderAction, getDeletedOrdersAction, restoreOrderAction, permanentlyDeleteOrderAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format, parseISO, startOfDay, endOfDay, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis
} from "@/components/ui/pagination";
import { DateRangePicker3, type PredefinedRange } from '@/components/dashboard/date-range-picker3';
import type { DateRange } from "react-day-picker";

const CreateOrderDialog = dynamic(() => import('@/components/orders/create-order-dialog').then(mod => mod.CreateOrderDialog), { ssr: false });
const AssignDrDialog = dynamic(() => import('@/components/orders/assign-dr-dialog').then(mod => mod.AssignDrDialog), { ssr: false });
const EditOrderDialog = dynamic(() => import('@/components/orders/edit-order-dialog').then(mod => mod.EditOrderDialog), { ssr: false });
const InvoiceDownloadTrigger = dynamic(() => import('@/components/orders/invoice-download-trigger').then(mod => mod.InvoiceDownloadTrigger), { ssr: false });
import { TrashDialog } from '@/components/shared/trash-dialog';
import { isDrRole } from '@/lib/roles';



const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    return format(parseISO(dateString), 'd MMM yyyy');
  } catch (e) {
    console.error("Invalid date string for formatting:", dateString, e);
    return "Invalid Date";
  }
};

const ITEMS_PER_PAGE = 25;

export default function OrdersPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isClient, setIsClient] = useState(false);

  const [selectedOrderForDrAssignment, setSelectedOrderForDrAssignment] = useState<TrackingLink | null>(null);
  const [isAssignDrDialogOpen, setIsAssignDrDialogOpen] = useState(false);
  const [statusesForDialog, setStatusesForDialog] = useState<CustomStatus[] | null>(null);

  const [orderToDelete, setOrderToDelete] = useState<TrackingLink | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  const [orderToEdit, setOrderToEdit] = useState<TrackingLink | null>(null);
  const [isEditOrderDialogOpen, setIsEditOrderDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewType, setViewType] = useState<'orders' | 'reorders' | 'pending_payment'>('orders');

  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  const [isTrashDialogOpen, setIsTrashDialogOpen] = useState(false);
  const [deletedOrders, setDeletedOrders] = useState<TrackingLink[]>([]);
  const [isTrashLoading, setIsTrashLoading] = useState(false);
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false);
  const [orderToDownload, setOrderToDownload] = useState<TrackingLink | null>(null);

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: queryData, isLoading: isQueryLoading, refetch } = useQuery({
    queryKey: [
      'orders',
      currentUser?.id,
      currentUser?.role,
      selectedDateRange?.from?.toISOString(),
      selectedDateRange?.to?.toISOString(),
      currentPage,
      debouncedSearchTerm,
      viewType,
    ],
    queryFn: async () => {
      if (!currentUser) return null;
      const startStr = (!debouncedSearchTerm && selectedDateRange?.from) ? format(startOfDay(selectedDateRange.from), 'yyyy-MM-dd HH:mm:ss') : undefined;
      const endStr = (!debouncedSearchTerm && selectedDateRange?.to) ? format(endOfDay(selectedDateRange.to), 'yyyy-MM-dd HH:mm:ss') : undefined;
      const role = currentUser.role;
      const userId = (role === 'SYSTEM_ADMIN' || role === 'ADMIN') ? undefined : currentUser.id;

      const [fetchedResult, fetchedStatuses, fetchedSettings, fetchedUsers] = await Promise.all([
        getOrdersWithTotal(startStr, endStr, role, userId, currentPage, ITEMS_PER_PAGE, debouncedSearchTerm, viewType),
        getStatuses(),
        getGlobalSettings(),
        getUsers()
      ]);

      const uMap: Record<string, User> = {};
      fetchedUsers.forEach(u => { uMap[u.id] = u; });

      return {
        orders: fetchedResult.orders,
        totalOrders: fetchedResult.total,
        allStatuses: fetchedStatuses,
        globalAppSettings: fetchedSettings,
        usersMap: uMap,
      };
    },
    enabled: !!currentUser,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const orders = queryData?.orders ?? [];
  const totalOrders = queryData?.totalOrders ?? 0;
  const allStatuses = queryData?.allStatuses ?? [];
  const globalAppSettings = queryData?.globalAppSettings ?? null;
  const usersMap = queryData?.usersMap ?? {};
  const isLoading = isQueryLoading && !queryData;

  const fetchOrderData = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['orders'] });
  }, [queryClient]);

  const fetchDeletedOrders = useCallback(async () => {
    setIsTrashLoading(true);
    try {
      const fetched = await getDeletedOrdersAction();
      setDeletedOrders(fetched);
    } catch (error) {
      console.error("Failed to fetch deleted orders:", error);
      toast({ title: "Error", description: "Could not load deleted orders.", variant: "destructive" });
    } finally {
      setIsTrashLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on("order-updated", (data: any) => {
      console.log("Order updated remotely:", data);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (isTrashDialogOpen) {
        fetchDeletedOrders();
      }
    });

    return () => {
      socket.off("order-updated");
    };
  }, [socket, queryClient, isTrashDialogOpen, fetchDeletedOrders]);

  const memoizedAvailableStatusesForDialog = useMemo(() => {
    return allStatuses.filter(s => s.isVisible !== false);
  }, [allStatuses]);

  const handleDateRangeChange = (range: DateRange | undefined, label: string, predefined: PredefinedRange | "custom" | null) => {
    setSelectedDateRange(range);
  };

  const filteredOrders = orders;
  const totalPages = Math.ceil(totalOrders / ITEMS_PER_PAGE);
  const paginatedOrders = orders;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, viewType, selectedDateRange]);

  const [orderStatusDisplay, setOrderStatusDisplay] = useState<Record<string, { name: string; color: string; textColor: string }>>({});

  const getInitials = (name: string) => {
    if (!name) return "U";
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return names[0].charAt(0).toUpperCase() + names[names.length - 1].charAt(0).toUpperCase();
  };

  const getStatusDisplayInfo = useCallback((statusId: string): { name: string; color: string; textColor: string } => {
    const status = allStatuses.find(s => s.id === statusId);
    if (status) {
      return { name: status.name, color: status.color, textColor: getContrastTextColor(status.color) };
    }
    return { name: statusId, color: '#A1A1AA', textColor: '#FFFFFF' };
  }, [allStatuses]);

  useEffect(() => {
    if (allStatuses.length > 0 && filteredOrders.length > 0) {
      const newDisplayInfoMap: Record<string, { name: string; color: string; textColor: string }> = {};
      const uniqueStatusIdsInScope = new Set<string>();
      filteredOrders.forEach(order => uniqueStatusIdsInScope.add(order.currentStatus));

      uniqueStatusIdsInScope.forEach(statusId => {
        newDisplayInfoMap[statusId] = getStatusDisplayInfo(statusId);
      });

      setOrderStatusDisplay(prevMap => {
        if (JSON.stringify(newDisplayInfoMap) !== JSON.stringify(prevMap)) {
          return newDisplayInfoMap;
        }
        return prevMap;
      });
    } else if (Object.keys(orderStatusDisplay).length > 0 && (allStatuses.length === 0 || filteredOrders.length === 0)) {
      setOrderStatusDisplay({});
    }
  }, [filteredOrders, allStatuses, getStatusDisplayInfo]);


  const canCreateOrder = currentUser?.role === 'CR' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN';
  const canAssignDr = currentUser?.role === 'CR' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN';

  const canEditOrder = useMemo(() => {
    if (!currentUser || !globalAppSettings) return false;
    if (currentUser.role === 'SYSTEM_ADMIN') return true;
    return (globalAppSettings.rolesAllowedToEditOrders?.includes(currentUser.role) ?? false);
  }, [currentUser, globalAppSettings]);

  const canDeleteOrder = useMemo(() => {
    if (!currentUser || !globalAppSettings) return false;
    if (currentUser.role === 'SYSTEM_ADMIN') return true;
    return (globalAppSettings.rolesAllowedToDeleteOrders?.includes(currentUser.role) ?? false);
  }, [currentUser, globalAppSettings]);


  const handleOpenAssignDrDialog = useCallback(async (orderToAssign: TrackingLink) => {
    try {
      console.log("OrdersPage/handleOpenAssignDrDialog: Opening for order:", orderToAssign.id);
      const freshStatuses = await getStatuses();
      if (!Array.isArray(freshStatuses)) {
        console.error("OrdersPage/handleOpenAssignDrDialog: getStatuses() did not return an array. Received:", freshStatuses);
        toast({ title: "Error", description: "Failed to load status configuration for DR assignment. Please try again.", variant: "destructive" });
        return;
      }

      const rfdCheck = freshStatuses.find(s => s.id === 'ready-for-design');
      if (!rfdCheck) {
        console.error("OrdersPage/handleOpenAssignDrDialog: CRITICAL - 'ready-for-design' status (ID: 'ready-for-design') NOT FOUND in freshStatuses from getStatuses().");
        toast({
          title: "Configuration Alert!",
          description: "The required system status 'On Script' (ID: ready-for-design) is missing or not configured correctly. Please contact an administrator. DR assignment is not possible.",
          variant: "destructive",
          duration: 10000,
        });
        return;
      }

      setStatusesForDialog(freshStatuses);
      setSelectedOrderForDrAssignment(orderToAssign);
      setIsAssignDrDialogOpen(true);
    } catch (error) {
      console.error("OrdersPage/handleOpenAssignDrDialog: Error preparing assign DR dialog:", error);
      toast({ title: "Error", description: "Could not prepare DR assignment dialog. Check console.", variant: "destructive" });
    }
  }, [toast]);

  const handleDrAssignmentSuccess = useCallback(async (updatedOrderFromAction: TrackingLink) => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    toast({ title: "DR Assigned", description: `${updatedOrderFromAction.designerRepresentativeName} assigned to order ${updatedOrderFromAction.id}.` });
  }, [toast, queryClient]);

  const handleDeleteOrder = async () => {
    if (!orderToDelete || !canDeleteOrder || !currentUser) return;
    setIsDeletingOrder(true);
    const result = await deleteOrderAction(orderToDelete.id, currentUser);
    if (result.success) {
      toast({ title: "Moved to Trash", description: `Order ${orderToDelete.id} has been moved to the trash bin.` });
      await fetchOrderData();
    } else {
      toast({ title: "Deletion Failed", description: result.error || "Could not delete the order.", variant: "destructive" });
    }
    setIsDeletingOrder(false);
    setIsDeleteDialogOpen(false);
    setOrderToDelete(null);
  };

  const handleOpenEditOrderDialog = (order: TrackingLink) => {
    if (!currentUser || !currentUser.role) {
      toast({ title: "Authentication Error", description: "Cannot edit order. User not properly authenticated.", variant: "destructive" });
      console.error("OrdersPage/handleOpenEditOrderDialog: currentUser is invalid.", currentUser);
      return;
    }
    console.log("OrdersPage/handleOpenEditOrderDialog: Opening for order:", order.id, "with currentUser:", JSON.stringify(currentUser));
    setOrderToEdit(order);
    setIsEditOrderDialogOpen(true);
  };


  useEffect(() => {
    if (isTrashDialogOpen) {
      fetchDeletedOrders();
    }
  }, [isTrashDialogOpen, fetchDeletedOrders]);

  const handleRestoreOrder = async (id: string) => {
    const result = await restoreOrderAction(id);
    if (result.success) {
      toast({ title: "Order Restored", description: `Order ${id} has been restored.` });
      fetchDeletedOrders();
      fetchOrderData();
    } else {
      toast({ title: "Restore Failed", description: result.error, variant: "destructive" });
    }
  };

  const handlePermanentlyDeleteOrder = async (id: string) => {
    const result = await permanentlyDeleteOrderAction(id);
    if (result.success) {
      toast({ title: "Order Permanently Deleted", description: `Order ${id} has been permanently removed.` });
      fetchDeletedOrders();
    } else {
      toast({ title: "Deletion Failed", description: result.error, variant: "destructive" });
    }
  };

  const handleOrderUpdated = useCallback(async (updatedOrder: TrackingLink) => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    toast({ title: "Order Updated", description: "Order details have been successfully updated." });
    setIsEditOrderDialogOpen(false);
    setOrderToEdit(null);
  }, [toast, queryClient]);

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
    <div className="space-y-4 sm:space-y-6 p-0 sm:p-0 w-full max-w-full min-w-0">
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 w-full page-header min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {(currentUser.role === 'SYSTEM_ADMIN') && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 sm:h-10 px-2.5 sm:px-4 rounded-md shadow-md hover:shadow-lg transition-shadow text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
              onClick={() => setIsTrashDialogOpen(true)}
              title="Trash"
            >
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Trash</span>
            </Button>
          )}
          {(currentUser.role === 'ADMIN') && (
            <Link href="/admin/model-management" passHref>
              <Button variant="outline" size="sm" className="h-9 sm:h-10 px-2.5 sm:px-4 rounded-md shadow-md hover:shadow-lg transition-shadow shrink-0" title="Configure Models">
                <Layers className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Configure Models</span>
              </Button>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 justify-end min-w-0">
          {canCreateOrder && (
            <CreateOrderDialog
              currentUser={currentUser}
              availableStatuses={memoizedAvailableStatusesForDialog}
              onOrderCreated={async () => {
                await fetchOrderData();
              }}
              allOrders={orders}
              isOpen={isCreateOrderDialogOpen}
              onOpenChange={setIsCreateOrderDialogOpen}
            >
              <Button
                size="default"
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md shadow-md hover:shadow-lg transition-shadow font-semibold h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm shrink-0"
                disabled={isLoading || (allStatuses.length === 0 && memoizedAvailableStatusesForDialog.length === 0)}
              >
                {(isLoading && allStatuses.length === 0 && memoizedAvailableStatusesForDialog.length === 0) ? (
                  <Loader2 className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                ) : (
                  <PlusCircle className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                )}
                <span>{(isLoading && allStatuses.length === 0 && memoizedAvailableStatusesForDialog.length === 0) ? "Loading..." : "Create Order"}</span>
              </Button>
            </CreateOrderDialog>
          )}
        </div>
      </div>

      <Card className="shadow-xl border bg-card rounded-lg overflow-hidden w-full max-w-full min-w-0">
        <CardHeader className="border-b p-3.5 sm:p-5 min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4 min-w-0">
            <div className="flex-grow" />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <DateRangePicker3
                initialRange={selectedDateRange}
                onDateRangeChange={handleDateRangeChange}
                compactOnMobile={true}
                className="h-10"
              />
              <div className="relative flex-1 sm:w-64 sm:flex-initial">
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
        <CardContent className="p-0 w-full max-w-full min-w-0 overflow-hidden">
          <div className="w-full max-w-full overflow-x-auto custom-scrollbar">
            <Table containerClassName="w-full max-w-full overflow-x-auto" className="w-full min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Order ID</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>CR Contact</TableHead>
                  <TableHead>On Assigned</TableHead>
                  <TableHead>Date Created</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && [...Array(10)].map((_, i) => (
                  <TableRow key={`skel-order-${i}`}>
                    <TableCell className="pl-6"><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="pr-6 text-right space-x-2">
                      <Skeleton className="h-9 w-9 inline-block rounded-md" />
                    </TableCell>
                  </TableRow>
                ))}

                {!isLoading && paginatedOrders.length > 0 && paginatedOrders.map((order, index) => {
                  const latestAssignee = getLatestOrderAssignee(order);
                  const statusInfo = orderStatusDisplay[order.currentStatus] || { name: order.currentStatus, color: '#A1A1AA', textColor: '#FFFFFF' };
                  return (
                    <TableRow key={order.id || `order-${index}`} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/track/${order.id}`} className="font-medium text-primary hover:underline">
                            {order.id}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="text-card-foreground">
                        <div>{order.companyName}</div>
                      </TableCell>
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
                                src={usersMap[order.crmUserId]?.avatarUrl || undefined} 
                              />
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                {getInitials(order.crmUserName)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <span>{order.crmUserName}</span>
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
                      <TableCell className="text-muted-foreground">{isClient ? formatDate(order.createdAt) : <Skeleton className="h-4 w-20" />}</TableCell>
                      <TableCell className="pr-6 text-right space-x-2 whitespace-nowrap">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9" title="Order Actions">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canEditOrder && (
                              <DropdownMenuItem
                                onSelect={() => handleOpenEditOrderDialog(order)}
                                disabled={!currentUser || !currentUser.role}
                                className="cursor-pointer"
                              >
                                <Edit3 className="mr-2 h-4 w-4" /> Edit Order
                              </DropdownMenuItem>
                            )}
                            {canAssignDr && (
                              <DropdownMenuItem
                                onSelect={() => handleOpenAssignDrDialog(order)}
                                className="cursor-pointer"
                              >
                                <Users2 className="mr-2 h-4 w-4" />
                                {order.designerRepresentativeId ? "Re-assign DR" : "Assign DR"}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem asChild className="cursor-pointer">
                              <Link href={`/track/${order.id}`}>
                                <Eye className="mr-2 h-4 w-4" /> View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => setOrderToDownload(order)}
                              className="cursor-pointer"
                            >
                              <Download className="mr-2 h-4 w-4" /> Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                const paymentLink = `${window.location.origin}/pay/${order.id}`;
                                navigator.clipboard.writeText(paymentLink).then(() => {
                                  toast({ title: "Payment Link Copied", description: `Link for ${order.id} copied to clipboard.` });
                                }).catch(() => {
                                  toast({ title: "Copy Failed", description: "Could not copy payment link.", variant: "destructive" });
                                });
                              }}
                              className="cursor-pointer"
                            >
                              <Link2 className="mr-2 h-4 w-4" /> Payment Link
                            </DropdownMenuItem>
                            {canDeleteOrder && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setOrderToDelete(order);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                  className="cursor-pointer text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Order
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!isLoading && paginatedOrders.length === 0 && (
                  <TableRow key="empty-orders">
                    <TableCell colSpan={7} className="text-center py-12 h-[300px]">
                      <PackageIcon className="mx-auto h-12 w-12 opacity-50 mb-3 text-muted-foreground" />
                      <p className="text-lg text-muted-foreground font-medium">
                        {searchTerm ? "No orders match your search." :
                          (currentUser?.role === 'CR' ? "You have no orders." :
                            (currentUser && isDrRole(currentUser.role)) ? "No orders assigned to you." :
                              "No orders found.")
                        }
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {searchTerm ? "Try a different search term." :
                          (canCreateOrder ? "Start by creating a new one!" :
                            (currentUser && isDrRole(currentUser.role)) ? "Check back later for assigned orders." :
                              "Check back later for updates.")}
                      </p>
                      {canCreateOrder && !searchTerm && (
                        <CreateOrderDialog
                          currentUser={currentUser}
                          availableStatuses={memoizedAvailableStatusesForDialog}
                          onOrderCreated={async () => {
                            await fetchOrderData();
                          }}
                          allOrders={orders}
                          isOpen={isCreateOrderDialogOpen}
                          onOpenChange={setIsCreateOrderDialogOpen}
                        >
                          <Button size="sm" className="mt-4" disabled={isLoading || (allStatuses.length === 0)}>
                            {(isLoading && allStatuses.length === 0) ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <PlusCircle className="mr-2 h-4 w-4" />
                            )}
                            {(isLoading && allStatuses.length === 0) ? "Loading Data..." : "Create Order"}
                          </Button>
                        </CreateOrderDialog>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>


        </CardContent>
        <CardFooter className="py-4 border-t flex-col sm:flex-row items-center justify-between gap-4 min-w-0">
          <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left min-w-0">
            Showing <span className="font-medium text-foreground">1</span> to <span className="font-medium text-foreground">25</span> of{" "}
            <span className="font-medium text-foreground">{totalOrders}</span> orders
          </div>
          {totalPages > 1 && (
            <Pagination className="flex-wrap">
              <PaginationContent className="flex-wrap justify-center">
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

      {statusesForDialog && selectedOrderForDrAssignment && currentUser && isAssignDrDialogOpen && (
        <AssignDrDialog
          isOpen={isAssignDrDialogOpen}
          onOpenChange={(open) => {
            setIsAssignDrDialogOpen(open);
            if (!open) {
              setSelectedOrderForDrAssignment(null);
              setStatusesForDialog(null);
            }
          }}
          order={selectedOrderForDrAssignment}
          currentUser={currentUser}
          allStatuses={statusesForDialog}
          onDrAssigned={handleDrAssignmentSuccess}
        />
      )}

      {isEditOrderDialogOpen && orderToEdit && currentUser && globalAppSettings && (
        <EditOrderDialog
          isOpen={isEditOrderDialogOpen}
          onOpenChange={(open) => {
            setIsEditOrderDialogOpen(open);
            if (!open) setOrderToEdit(null);
          }}
          order={orderToEdit}
          currentUser={currentUser}
          onOrderUpdated={handleOrderUpdated}
          allOrders={orders}
        />
      )}

      {orderToDelete && isDeleteDialogOpen && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                Move to Trash Bin?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Order "<span className="font-semibold">{orderToDelete.id}</span>" will be moved to the trash bin. It can be restored or permanently deleted from there.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setOrderToDelete(null); setIsDeleteDialogOpen(false); }} disabled={isDeletingOrder}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteOrder}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                disabled={isDeletingOrder}
              >
                {isDeletingOrder ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Moving to Trash...</> : "Move to Trash"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <TrashDialog 
        isOpen={isTrashDialogOpen} 
        onOpenChange={setIsTrashDialogOpen} 
        title="Order Trash Bin"
        items={deletedOrders}
        isLoading={isTrashLoading}
        onRestore={handleRestoreOrder}
        onDeletePermanently={handlePermanentlyDeleteOrder}
      />

      {orderToDownload && (
        <InvoiceDownloadTrigger
          order={orderToDownload}
          allStatuses={allStatuses}
          onComplete={() => setOrderToDownload(null)}
        />
      )}
    </div>
  );
}
