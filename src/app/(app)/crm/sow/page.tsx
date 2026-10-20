
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { TrackingLink, OrderItem, GlobalSettings, CustomStatus, SowDataEntry } from '@/types';
import { getOrders } from '@/lib/order-service';
import { getGlobalSettings } from '@/lib/settings-service';
import { getSowDataPaginated, SowData } from '@/lib/sow-service';
import { PackageSearch, ListChecks, ArrowUpDown, Phone, MapPin, PlusCircle } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRangePicker3 } from '@/components/dashboard/date-range-picker3';
import type { DateRange } from "react-day-picker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from '@/contexts/auth-context';
import { NewSowDialog } from '@/components/sow/NewSowDialog';


const ITEMS_PER_PAGE = 12;
const SOW_DATA_CACHE_KEY = 'sowDataCache';

type SortKey = 'orderDate' | 'loyaltyScore' | 'products';
type SortDirection = 'asc' | 'desc';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-BD', {
        style: 'currency',
        currency: 'BDT',
    }).format(value);
};

const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        return format(parseISO(dateString), 'd MMM, yyyy');
    } catch (e) {
        return 'Invalid Date';
    }
};

const getLoyaltyColorClass = (score: number) => {
    if (score <= 25) return 'bg-red-500';
    if (score <= 50) return 'bg-amber-500';
    if (score <= 75) return 'bg-blue-500';
    return 'bg-green-500';
};


export default function SOWPage() {
  const { currentUser } = useAuth();
  const [sowData, setSowData] = useState<SowData[]>([]);
  const [totalSowData, setTotalSowData] = useState(0);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBusiness, setSelectedBusiness] = useState<SowData | null>(null);
  const [isDialogVisible, setIsDialogVisible] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const startStr = (!debouncedSearchTerm && selectedDateRange?.from) ? startOfDay(selectedDateRange.from).toISOString() : undefined;
      const endStr = (!debouncedSearchTerm && selectedDateRange?.to) ? endOfDay(selectedDateRange.to).toISOString() : undefined;
      const role = currentUser?.role;
      const userId = (role === 'SYSTEM_ADMIN' || role === 'ADMIN') ? undefined : currentUser?.id;
      const res = await getSowDataPaginated(
        currentPage,
        ITEMS_PER_PAGE,
        startStr,
        endStr,
        role,
        userId,
        debouncedSearchTerm,
        sortConfig
      );
      setSowData(res.data);
      setTotalSowData(res.total);
      setGlobalSettings(res.globalSettings);
    } catch (error) {
      toast({
        title: "Error fetching data",
        description: "Could not load the necessary data for the SOW page.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, selectedDateRange, currentUser, debouncedSearchTerm, currentPage, sortConfig]);


   useEffect(() => {
    const cachedData = localStorage.getItem(SOW_DATA_CACHE_KEY);
    if (cachedData) {
      try {
        setSowData(JSON.parse(cachedData));
      } catch (e) {
        console.error("Failed to parse cached SOW data", e);
        localStorage.removeItem(SOW_DATA_CACHE_KEY);
      }
    }
    fetchData();
  }, [fetchData]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };
  
  const totalPages = Math.ceil(totalSowData / ITEMS_PER_PAGE);
  
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pageNumbers = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, currentPage + 2);

      if (currentPage < 3) {
        endPage = maxPagesToShow;
      } else if (currentPage > totalPages - 2) {
        startPage = totalPages - maxPagesToShow + 1;
      }

      if (startPage > 1) {
        pageNumbers.push(1);
        if (startPage > 2) {
          pageNumbers.push('...');
        }
      }

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pageNumbers.push('...');
        }
        pageNumbers.push(totalPages);
      }
    }

    return (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }}
              aria-disabled={currentPage === 1}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
          {pageNumbers.map((page, index) => (
            <PaginationItem key={index}>
              {page === '...' ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  href="#"
                  onClick={(e) => { e.preventDefault(); setCurrentPage(page as number); }}
                  isActive={currentPage === page}
                >
                  {page}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }}
              aria-disabled={currentPage === totalPages}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  if (!currentUser) {
    return <p>You need to be logged in to view this page.</p>;
  }

  const canCreateOrder = currentUser?.role === 'CR' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN';


  return (
    <>
      <div className="px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8 pt-0">
        <Card className="shadow-xl border bg-card rounded-lg overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>Business Report</CardTitle>
                <CardDescription>Statement of work based on recent order history.</CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input 
                  placeholder="Search by business name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-auto sm:max-w-xs"
                />
                <DateRangePicker3 initialRange={selectedDateRange} onDateRangeChange={(range) => setSelectedDateRange(range)} />
                {canCreateOrder && (
                  <NewSowDialog
                    currentUser={currentUser}
                    onSowCreated={fetchData}
                    allOrders={sowData.map(d => ({...d, companyName: `${d.id} • ${d.businessName}`, id:d.id, createdAt: d.orderDate, phoneNumber: d.phoneNumber, address: d.address, orderItems: [], currentStatus: '', isPublic: false, statusHistory: [], comments:[], crmUserId: currentUser.id, crmUserName: currentUser.name }))}
                    reportProductFilters={globalSettings?.reportProductFilters || []}
                  >
                    <Button
                      size="default"
                      className="w-full sm:w-auto"
                      disabled={isLoading}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      New SOW
                    </Button>
                  </NewSowDialog>
                )}
              </div>
          </CardHeader>
          <CardContent>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead className="w-[50px]">SL</TableHead>
                          <TableHead>
                             <Button variant="ghost" onClick={() => requestSort('orderDate')}>
                                  Order Date <ArrowUpDown className="ml-2 h-4 w-4" />
                             </Button>
                          </TableHead>
                          <TableHead>Business Name</TableHead>
                          <TableHead className="w-[40%]">
                             <Button variant="ghost" onClick={() => requestSort('products')}>
                                  Products <ArrowUpDown className="ml-2 h-4 w-4" />
                             </Button>
                          </TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-center w-[200px]">
                             <Button variant="ghost" onClick={() => requestSort('loyaltyScore')}>
                                  Loyalty Score <ArrowUpDown className="ml-2 h-4 w-4" />
                             </Button>
                          </TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {isLoading ? (
                           Array.from({ length: 5 }).map((_, index) => (
                             <TableRow key={index}>
                                  <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                                  <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-40 mx-auto" /></TableCell>
                             </TableRow>
                          ))
                      ) : sowData.length > 0 ? (
                          sowData.map((row, index) => {
                             const totalPurchasedCount = row.purchasedCategories.length + row.unmatchedPurchasedItems.length;
                             const totalPossibleCategories = row.allCategories.length;
                             return (
                              <TableRow key={row.id} className="hover:bg-muted/50">
                                  <TableCell className="font-medium text-muted-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</TableCell>
                                  <TableCell className="text-muted-foreground">{formatDate(row.orderDate)}</TableCell>
                                  <TableCell>
                                    <Button
                                      variant="link"
                                      className="font-medium text-foreground p-0 h-auto hover:text-primary"
                                      onClick={() => {
                                        setSelectedBusiness(row);
                                        setIsDialogVisible(true);
                                      }}
                                    >
                                      {row.businessName}
                                    </Button>
                                  </TableCell>
                                  <TableCell>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center gap-px w-full h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 shadow-inner">
                                                  {Array.from({ length: totalPossibleCategories }).map((_, index) => {
                                                    const isPurchased = index < totalPurchasedCount;
                                                    const hue = (index / Math.max(1, totalPossibleCategories - 1)) * 120;
                                                    return (
                                                      <div
                                                        key={index}
                                                        className="h-full flex-1"
                                                        style={{
                                                          backgroundColor: isPurchased ? `hsl(${hue}, 70%, 50%)` : 'rgba(209, 213, 219, 0.3)',
                                                        }}
                                                      />
                                                    );
                                                  })}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <div className="p-1 max-w-xs">
                                                <p className="font-semibold text-sm mb-2 flex items-center gap-1"><ListChecks className="h-4 w-4 text-primary"/> Defined Categories ({row.allCategories.length}):</p>
                                                  <ul className="list-disc list-inside text-xs space-y-0.5">
                                                      {row.allCategories.map(p => {
                                                        const isBought = row.purchasedCategories.includes(p);
                                                        return <li key={p} className={cn(isBought ? "font-semibold text-primary" : "text-muted-foreground")}>{p} {isBought ? '(Purchased)' : ''}</li>
                                                      })}
                                                  </ul>
                                                
                                                {row.unmatchedPurchasedItems.length > 0 && (
                                                  <>
                                                    <p className="font-semibold text-sm mt-3 mb-2 flex items-center gap-1"><PackageSearch className="h-4 w-4 text-primary"/> Other Purchased Items:</p>
                                                    <ul className="list-disc list-inside text-xs space-y-0.5">
                                                      {row.unmatchedPurchasedItems.map(p => <li key={p}>{p}</li>)}
                                                    </ul>
                                                  </>
                                                )}
                                              </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                  </TableCell>
                                  <TableCell className="text-right font-mono">{formatCurrency(row.amount)}</TableCell>
                                  <TableCell>
                                      <div className="flex items-center justify-center gap-3">
                                          <Progress value={row.loyaltyScore} className="w-24 h-2" indicatorClassName={getLoyaltyColorClass(row.loyaltyScore)} />
                                          <span className="font-semibold text-foreground">{row.loyaltyScore}%</span>
                                      </div>
                                  </TableCell>
                              </TableRow>
                             );
                          })
                      ) : (
                          <TableRow>
                              <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                  <PackageSearch className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                  No order data to display.
                              </TableCell>
                          </TableRow>
                      )}
                  </TableBody>
              </Table>
          </CardContent>
          <CardFooter className="py-4 border-t">
            {renderPagination()}
          </CardFooter>
        </Card>
      </div>

      <Dialog open={isDialogVisible} onOpenChange={setIsDialogVisible}>
        <DialogContent className="sm:max-w-md">
          {selectedBusiness && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedBusiness.businessName}</DialogTitle>
                <DialogDescription>
                  Contact information for this business.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-primary" />
                  <span className="font-mono text-lg">{selectedBusiness.phoneNumber}</span>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary mt-1" />
                  <p className="text-muted-foreground">{selectedBusiness.address}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
