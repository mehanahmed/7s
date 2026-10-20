

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { PlusCircle, Search, Eye, Users2, Loader2, Trash2, Edit3, MoreVertical, Package as PackageIcon, Settings2, Layers, RefreshCw, Repeat, FileText, CheckCircle, Ban, Hourglass, Download } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import type { TrackingLink, User, CustomStatus, GlobalSettings } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getContrastTextColor } from '@/lib/color-utils';
import { getQuotationsPaginated } from '@/lib/quotation-service';
import { getOrders } from '@/lib/order-service';
import { getGlobalSettings } from '@/lib/settings-service';
import { getStatuses } from '@/lib/status-service';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteQuotationAction, updateQuotationStatusAction, getDeletedQuotationsAction, restoreQuotationAction, permanentlyDeleteQuotationAction } from './actions';
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis
} from "@/components/ui/pagination";

const CreateQuotationDialog = dynamic(() => import('@/components/quotations/create-quotation-dialog').then(mod => mod.CreateQuotationDialog));
const EditQuotationDialog = dynamic(() => import('@/components/quotations/edit-quotation-dialog').then(mod => mod.EditQuotationDialog));
const CreateOrderDialog = dynamic(() => import('@/components/orders/create-order-dialog').then(mod => mod.CreateOrderDialog), { ssr: false });
import { TrashDialog } from '@/components/shared/trash-dialog';



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

export default function QuotationsPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [quotations, setQuotations] = useState<TrackingLink[]>([]);
  const [totalQuotations, setTotalQuotations] = useState(0);
  const [allStatuses, setAllStatuses] = useState<CustomStatus[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [globalAppSettings, setGlobalAppSettings] = useState<GlobalSettings | null>(null);

  const [quotationToDelete, setQuotationToDelete] = useState<TrackingLink | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingQuotation, setIsDeletingQuotation] = useState(false);

  const [quotationToEdit, setQuotationToEdit] = useState<TrackingLink | null>(null);
  const [isEditQuotationDialogOpen, setIsEditQuotationDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewType, setViewType] = useState<'quotations' | 're-quotations'>('quotations');
  const [isTrashDialogOpen, setIsTrashDialogOpen] = useState(false);
  const [deletedQuotations, setDeletedQuotations] = useState<TrackingLink[]>([]);
  const [isTrashLoading, setIsTrashLoading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<string | null>(null);

  const [allOrders, setAllOrders] = useState<TrackingLink[]>([]);
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false);
  const [quotationForOrder, setQuotationForOrder] = useState<TrackingLink | null>(null);
  const [availableOrderStatuses, setAvailableOrderStatuses] = useState<CustomStatus[]>([]);



  const currentUserRole = currentUser?.role;
  const currentUserId = currentUser?.id;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const userId = (currentUserRole === 'SYSTEM_ADMIN' || currentUserRole === 'ADMIN') ? undefined : currentUserId;

      const [fetchedResult, fetchedStatuses, fetchedSettings, fetchedOrderStatuses] = await Promise.all([
        getQuotationsPaginated(currentPage, ITEMS_PER_PAGE, debouncedSearchTerm, currentUserRole, userId, viewType),
        Promise.resolve([
          { id: 'Pending', name: 'Pending', color: '#8B5CF6', xid: 'pending' },
          { id: 'Approved', name: 'Approved', color: '#10B981', xid: 'approved' },
          { id: 'Canceled', name: 'Canceled', color: '#EF4444', xid: 'canceled' },
        ]),
        getGlobalSettings(),
        getStatuses()
      ]);
      setQuotations(fetchedResult.quotations);
      setTotalQuotations(fetchedResult.total);
      setAllStatuses(fetchedStatuses);
      setGlobalAppSettings(fetchedSettings);
      setAvailableOrderStatuses(fetchedOrderStatuses.filter(s => s.isVisible !== false));
    } catch (error) {
      console.error("Failed to fetch quotations, statuses, or settings:", error);
      toast({ title: "Error", description: "Could not load quotation data or settings.", variant: "destructive" });
      setQuotations([]);
      setAllStatuses([]);
      setGlobalAppSettings(null);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, currentPage, viewType, currentUserRole, currentUserId]);

  const fetchQuotationData = useCallback(async () => {
    if (!currentUser) {
      return;
    }
    setCurrentPage(1);
    await fetchData();
  }, [currentUser, fetchData]);

  useEffect(() => {
    setIsClient(true);
    fetchData();
  }, [fetchData]);


  const memoizedAvailableStatusesForDialog = useMemo(() => {
    return allStatuses.filter(s => s.isVisible !== false);
  }, [allStatuses]);

  const totalPages = Math.ceil(totalQuotations / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, viewType]);

  // Load allOrders lazily only when the CreateOrderDialog is opened
  useEffect(() => {
    if (isCreateOrderDialogOpen && allOrders.length === 0) {
      const fetchOrdersForDialog = async () => {
        try {
          const fetchedOrders = await getOrders();
          setAllOrders(fetchedOrders);
        } catch (err) {
          console.error("Failed to load orders for dialog autofill:", err);
        }
      };
      fetchOrdersForDialog();
    }
  }, [isCreateOrderDialogOpen, allOrders.length]);

  const [quotationStatusDisplay, setQuotationStatusDisplay] = useState<Record<string, { name: string; color: string; textColor: string }>>({});

  const getStatusDisplayInfo = useCallback((statusId: string): { name: string; color: string; textColor: string } => {
    const status = allStatuses.find(s => s.id === statusId);
    if (status) {
      return { name: status.name, color: status.color, textColor: getContrastTextColor(status.color) };
    }
    return { name: statusId, color: '#A1A1AA', textColor: '#FFFFFF' };
  }, [allStatuses]);

  useEffect(() => {
    if (allStatuses.length > 0 && quotations.length > 0) {
      const newDisplayInfoMap: Record<string, { name: string; color: string; textColor: string }> = {};
      const uniqueStatusIdsInScope = new Set<string>();
      quotations.forEach(quotation => uniqueStatusIdsInScope.add(quotation.currentStatus));

      uniqueStatusIdsInScope.forEach(statusId => {
        newDisplayInfoMap[statusId] = getStatusDisplayInfo(statusId);
      });

      setQuotationStatusDisplay(prevMap => {
        if (JSON.stringify(newDisplayInfoMap) !== JSON.stringify(prevMap)) {
          return newDisplayInfoMap;
        }
        return prevMap;
      });
    } else if (Object.keys(quotationStatusDisplay).length > 0 && (allStatuses.length === 0 || quotations.length === 0)) {
      setQuotationStatusDisplay({});
    }
  }, [quotations, allStatuses, getStatusDisplayInfo]);


  const canCreateQuotation = currentUser?.role === 'CR' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN';

  const canEditQuotation = useMemo(() => {
    if (!currentUser || !globalAppSettings) return false;
    if (currentUser.role === 'SYSTEM_ADMIN') return true;
    return (globalAppSettings.rolesAllowedToEditOrders?.includes(currentUser.role) ?? false);
  }, [currentUser, globalAppSettings]);

  const canDeleteQuotation = useMemo(() => {
    if (!currentUser || !globalAppSettings) return false;
    if (currentUser.role === 'SYSTEM_ADMIN') return true;
    return (globalAppSettings.rolesAllowedToDeleteOrders?.includes(currentUser.role) ?? false);
  }, [currentUser, globalAppSettings]);

  const handleDeleteQuotation = async () => {
    if (!quotationToDelete || !canDeleteQuotation || !currentUser) return;
    setIsDeletingQuotation(true);
    const result = await deleteQuotationAction(quotationToDelete.id, currentUser);
    if (result.success) {
      toast({ title: "Moved to Trash", description: `Quotation ${quotationToDelete.id} has been moved to the trash bin.` });
      setQuotations(prev => prev.filter(q => q.id !== quotationToDelete.id));
      setTotalQuotations(prev => Math.max(0, prev - 1));
    } else {
      toast({ title: "Deletion Failed", description: result.error || "Could not delete the quotation.", variant: "destructive" });
    }
    setIsDeletingQuotation(false);
    setIsDeleteDialogOpen(false);
    setQuotationToDelete(null);
  };

  const fetchDeletedQuotations = useCallback(async () => {
    setIsTrashLoading(true);
    try {
      const fetched = await getDeletedQuotationsAction();
      setDeletedQuotations(fetched);
    } catch (error) {
      console.error("Failed to fetch deleted quotations:", error);
      toast({ title: "Error", description: "Could not load deleted quotations.", variant: "destructive" });
    } finally {
      setIsTrashLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isTrashDialogOpen) {
      fetchDeletedQuotations();
    }
  }, [isTrashDialogOpen, fetchDeletedQuotations]);

  const handleRestoreQuotation = async (id: string) => {
    const result = await restoreQuotationAction(id);
    if (result.success) {
      toast({ title: "Quotation Restored", description: `Quotation ${id} has been restored.` });
      fetchDeletedQuotations();
      fetchData();
    } else {
      toast({ title: "Restore Failed", description: result.error, variant: "destructive" });
    }
  };

  const handlePermanentlyDeleteQuotation = async (id: string) => {
    const result = await permanentlyDeleteQuotationAction(id);
    if (result.success) {
      toast({ title: "Quotation Permanently Deleted", description: `Quotation ${id} has been permanently removed.` });
      fetchDeletedQuotations();
    } else {
      toast({ title: "Deletion Failed", description: result.error, variant: "destructive" });
    }
  };

  const handleOpenEditQuotationDialog = (quotation: TrackingLink) => {
    if (!currentUser || !currentUser.role) {
      toast({ title: "Authentication Error", description: "Cannot edit quotation. User not properly authenticated.", variant: "destructive" });
      console.error("QuotationsPage/handleOpenEditQuotationDialog: currentUser is invalid.", currentUser);
      return;
    }
    console.log("QuotationsPage/handleOpenEditQuotationDialog: Opening for quotation:", quotation.id, "with currentUser:", JSON.stringify(currentUser));
    setQuotationToEdit(quotation);
    setIsEditQuotationDialogOpen(true);
  };

  const handleQuotationUpdated = useCallback(async (updatedQuotation: TrackingLink) => {
    setQuotations(prevQuotations =>
      prevQuotations.map(o => o.id === updatedQuotation.id ? updatedQuotation : o)
    );
    toast({ title: "Quotation Updated", description: "Quotation details have been successfully updated." });
    setIsEditQuotationDialogOpen(false);
    setQuotationToEdit(null);
  }, [toast]);

  const handleDownloadPDF = async (quotation: TrackingLink) => {
    setIsGeneratingPDF(quotation.id);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { QuotationPDF } = await import('@/components/quotations/QuotationPDF');
      
      const { getGlobalSettings } = await import('@/lib/settings-service');
      const defaultVatPercent = Number((await getGlobalSettings()).vatPercentage) || 0;
      const blob = await pdf(<QuotationPDF quotation={quotation} defaultVatPercent={defaultVatPercent} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Quotation_${quotation.id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "Quotation PDF downloaded successfully." });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setIsGeneratingPDF(null);
    }
  };

  const handleChangeStatus = async (quotation: TrackingLink, newStatus: string) => {
    if (!currentUser) return;
    const result = await updateQuotationStatusAction(quotation.id, newStatus, currentUser);
    if (result.success && result.quotation) {
      toast({ title: "Status Updated", description: `Quotation status changed to ${newStatus}.` });
      setQuotations(prev => prev.map(q => q.id === result.quotation?.id ? result.quotation : q));
      
      if (newStatus === 'Approved') {
        setQuotationForOrder(result.quotation);
        setIsCreateOrderDialogOpen(true);
      }
    } else {
      toast({ title: "Update Failed", description: result.error, variant: "destructive" });
    }
  };

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 page-header">
        <div>
          <h1 className="page-title">Quotation Management</h1>
          <p className="page-description">
            View, track, and manage all customer quotations.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(currentUser.role === 'SYSTEM_ADMIN') && (
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full sm:w-auto h-10 rounded-md shadow-md hover:shadow-lg transition-shadow text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setIsTrashDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Trash
            </Button>
          )}
          {(currentUser.role === 'ADMIN') && (
            <Link href="/admin/model-management" passHref>
              <Button variant="outline" size="lg" className="w-full sm:w-auto h-10 rounded-md shadow-md hover:shadow-lg transition-shadow">
                <Layers className="mr-2 h-4 w-4" /> Configure Models
              </Button>
            </Link>
          )}
          {canCreateQuotation && (
            <CreateQuotationDialog
              currentUser={currentUser}
              availableStatuses={memoizedAvailableStatusesForDialog}
              onQuotationCreated={(newQuotation) => {
                setQuotations(prev => {
                  const filtered = prev.filter(q => q.id !== newQuotation.id);
                  return [newQuotation, ...filtered].slice(0, ITEMS_PER_PAGE);
                });
                setTotalQuotations(prev => prev + 1);
              }}
              allQuotations={quotations}
            >
              <Button
                size="lg"
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground rounded-md shadow-md hover:shadow-lg transition-shadow font-semibold h-10"
                disabled={isLoading || (allStatuses.length === 0 && memoizedAvailableStatusesForDialog.length === 0)}
              >
                {(isLoading && allStatuses.length === 0 && memoizedAvailableStatusesForDialog.length === 0) ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <PlusCircle className="mr-2 h-5 w-5" />
                )}
                {(isLoading && allStatuses.length === 0 && memoizedAvailableStatusesForDialog.length === 0) ? "Loading Data..." : "Create New Quotation"}
              </Button>
            </CreateQuotationDialog>
          )}
        </div>
      </div>

      <Card className="shadow-xl border bg-card rounded-lg overflow-hidden">
        <CardHeader className="border-b p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-card-foreground text-xl">All Quotations</CardTitle>
            <div className="relative flex-grow sm:flex-grow-0 sm:max-w-xs w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search quotations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background h-10 rounded-md w-full"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Quotation ID</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>CR Contact</TableHead>
                  <TableHead>Date Created</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(10)].map((_, i) => (
                    <TableRow key={`skel-${i}`}>
                      <TableCell className="pl-6"><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell className="pr-6 text-right space-x-2">
                        <Skeleton className="h-9 w-9 inline-block rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : quotations.length > 0 ? (
                  quotations.map((quotation) => {
                    const nameParts = (quotation.companyName || '').split(' • ');
                    const contactPerson = nameParts[0].trim();
                    const companyName = nameParts.length > 1 ? nameParts.slice(1).join(' • ').trim() : 'N/A';
                    const statusInfo = quotationStatusDisplay[quotation.currentStatus] || { name: quotation.currentStatus, color: '#A1A1AA', textColor: '#FFFFFF' };
                    return (
                      <TableRow key={quotation.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="pl-6 font-mono text-primary font-bold">
                          <Link href={`/quotation/${quotation.id}`} className="hover:underline">
                            {quotation.id}
                          </Link>
                        </TableCell>
                        <TableCell className="text-card-foreground font-medium">{contactPerson}</TableCell>
                        <TableCell className="text-card-foreground">{companyName}</TableCell>
                        <TableCell>
                          <Badge style={{ backgroundColor: statusInfo.color, color: statusInfo.textColor }} className="border-transparent">
                            {statusInfo.name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-card-foreground">{quotation.crmUserName}</TableCell>
                        <TableCell className="text-muted-foreground">{isClient ? formatDate(quotation.createdAt) : <Skeleton className="h-4 w-20" />}</TableCell>
                        <TableCell className="pr-6 text-right space-x-2 whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9" title="Quotation Actions">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => handleOpenEditQuotationDialog(quotation)} className="cursor-pointer">
                                <Edit3 className="mr-2 h-4 w-4" /> Edit Quotation
                              </DropdownMenuItem>
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="cursor-pointer">
                                  <Hourglass className="mr-2 h-4 w-4" /> Change Status
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                  <DropdownMenuSubContent>
                                    <DropdownMenuItem onSelect={() => handleChangeStatus(quotation, 'Pending')} className="cursor-pointer text-white bg-purple-600 focus:bg-purple-700 focus:text-white">Pending</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleChangeStatus(quotation, 'Approved')} className="cursor-pointer text-white bg-green-600 focus:bg-green-700 focus:text-white">Approved</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleChangeStatus(quotation, 'Canceled')} className="cursor-pointer text-white bg-red-600 focus:bg-red-700 focus:text-white">Canceled</DropdownMenuItem>
                                  </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                              </DropdownMenuSub>
                              <DropdownMenuItem 
                                onSelect={() => handleDownloadPDF(quotation)} 
                                className="cursor-pointer"
                                disabled={isGeneratingPDF === quotation.id}
                              >
                                {isGeneratingPDF === quotation.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="mr-2 h-4 w-4" />
                                )}
                                {isGeneratingPDF === quotation.id ? 'Preparing PDF...' : 'Download PDF'}
                              </DropdownMenuItem>
                                {canDeleteQuotation && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      setQuotationToDelete(quotation);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                    className="cursor-pointer text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Quotation
                                  </DropdownMenuItem>
                                </>
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
                      <FileText className="mx-auto h-12 w-12 opacity-50 mb-3 text-muted-foreground" />
                      <p className="text-lg text-muted-foreground font-medium">
                        {searchTerm ? "No quotations match your search." :
                          (currentUser?.role === 'CR' ? "You have no quotations." :
                            "No quotations found.")
                        }
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {searchTerm ? "Try a different search term." :
                          (canCreateQuotation ? "Start by creating a new one!" :
                            "Check back later for updates.")}
                      </p>
                      {canCreateQuotation && !searchTerm && (
                        <CreateQuotationDialog
                          currentUser={currentUser}
                          availableStatuses={memoizedAvailableStatusesForDialog}
                          onQuotationCreated={async () => {
                            await fetchQuotationData();
                          }}
                          allQuotations={quotations}
                        >
                          <Button size="sm" className="mt-4" disabled={isLoading || (allStatuses.length === 0)}>
                            {(isLoading && allStatuses.length === 0) ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <PlusCircle className="mr-2 h-4 w-4" />
                            )}
                            {(isLoading && allStatuses.length === 0) ? "Loading Data..." : "Create Quotation"}
                          </Button>
                        </CreateQuotationDialog>
                      )}
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

      {isEditQuotationDialogOpen && quotationToEdit && currentUser && globalAppSettings && (
        <EditQuotationDialog
          isOpen={isEditQuotationDialogOpen}
          onOpenChange={(open) => {
            setIsEditQuotationDialogOpen(open);
            if (!open) setQuotationToEdit(null);
          }}
          quotation={quotationToEdit}
          currentUser={currentUser}
          onQuotationUpdated={handleQuotationUpdated}
        />
      )}

      {quotationToDelete && isDeleteDialogOpen && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                Move to Trash Bin?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Quotation "<span className="font-semibold">{quotationToDelete.id}</span>" will be moved to the trash bin. It can be restored or permanently deleted from there.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setQuotationToDelete(null); setIsDeleteDialogOpen(false); }} disabled={isDeletingQuotation}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteQuotation}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                disabled={isDeletingQuotation}
              >
                {isDeletingQuotation ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Moving to Trash...</> : "Move to Trash"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <TrashDialog 
        isOpen={isTrashDialogOpen} 
        onOpenChange={setIsTrashDialogOpen} 
        title="Quotation Trash Bin"
        items={deletedQuotations}
        isLoading={isTrashLoading}
        onRestore={handleRestoreQuotation}
        onDeletePermanently={handlePermanentlyDeleteQuotation}
      />

      {isCreateOrderDialogOpen && quotationForOrder && (
        <CreateOrderDialog
          currentUser={currentUser}
          availableStatuses={availableOrderStatuses}
          onOrderCreated={() => {
            fetchData();
          }}
          allOrders={allOrders}
          isOpen={isCreateOrderDialogOpen}
          onOpenChange={setIsCreateOrderDialogOpen}
          initialData={quotationForOrder}
        >
          <div className="hidden" />
        </CreateOrderDialog>
      )}
    </div>
  );
}
