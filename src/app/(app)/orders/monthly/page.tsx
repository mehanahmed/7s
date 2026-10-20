
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { ArrowLeft, Eye, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TrackingLink, CustomStatus } from '@/types';
import { getOrders } from '@/lib/order-service';
import { getStatuses } from '@/lib/status-service';
import { getContrastTextColor } from '@/lib/color-utils';
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format as formatDateFns } from 'date-fns';

const formatDateForDisplay = (dateString: string | undefined) => {
  if (!dateString) return "N/A";
  try {
    return formatDateFns(parseISO(dateString), 'd MMM yyyy');
  } catch (e) {
    console.error("Invalid date string for formatting:", dateString, e);
    return "Invalid Date";
  }
};

export default function MonthlyOrdersPage() {
  const { toast } = useToast();
  const [monthlyOrders, setMonthlyOrders] = useState<TrackingLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allStatuses, setAllStatuses] = useState<CustomStatus[]>([]);
  const [currentMonthName, setCurrentMonthName] = useState('');

  const fetchMonthlyOrders = useCallback(async () => {
    setIsLoading(true);
    const now = new Date();
    setCurrentMonthName(formatDateFns(now, 'MMMM yyyy'));
    try {
      const [fetchedOrders, fetchedStatuses] = await Promise.all([
        getOrders(),
        getStatuses(),
      ]);
      setAllStatuses(fetchedStatuses);

      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const filteredMonthlyOrders = fetchedOrders.filter(order => {
        return isWithinInterval(parseISO(order.createdAt), { start: monthStart, end: monthEnd });
      });

      setMonthlyOrders(filteredMonthlyOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

    } catch (error) {
      console.error("Failed to fetch monthly orders:", error);
      toast({ title: "Error", description: "Could not load monthly orders.", variant: "destructive" });
      setMonthlyOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMonthlyOrders();
  }, [fetchMonthlyOrders]);

  const getStatusDisplayInfo = useCallback((statusId: string): { name: string; color: string; textColor: string } => {
    const status = allStatuses.find(s => s.id === statusId);
    if (status) {
      return { name: status.name, color: status.color, textColor: getContrastTextColor(status.color) };
    }
    return { name: statusId, color: '#A1A1AA', textColor: '#FFFFFF' };
  }, [allStatuses]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 page-header">
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8 text-primary flex-shrink-0" />
          <div>
            <h1 className="page-title">Monthly Orders Created</h1>
            <p className="page-description">
              Orders created in {currentMonthName || "the current month"}.
            </p>
          </div>
        </div>
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <Card className="shadow-xl border bg-card rounded-lg overflow-hidden">
        <CardHeader className="border-b p-5">
          <CardTitle className="text-card-foreground text-xl">Orders Created ({currentMonthName})</CardTitle>
          <CardDescription className="text-muted-foreground text-sm mt-0.5">
            List of all orders created within {currentMonthName || "the current month"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Order ID</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Current Status</TableHead>
                  <TableHead>Created On</TableHead>
                  <TableHead>CR Contact</TableHead>
                  <TableHead>Assigned DR</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={`skel-${i}`}>
                      <TableCell className="pl-6"><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="pr-6 text-right"><Skeleton className="h-9 w-9 inline-block rounded-md" /></TableCell>
                    </TableRow>
                  ))
                ) : monthlyOrders.length > 0 ? (
                  monthlyOrders.map((order) => {
                    const statusInfo = getStatusDisplayInfo(order.currentStatus);
                    return (
                      <TableRow key={order.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="pl-6">
                          <Link href={`/track/${order.id}`} className="font-medium text-primary hover:underline">
                            {order.id}
                          </Link>
                        </TableCell>
                        <TableCell className="text-card-foreground">{order.companyName}</TableCell>
                        <TableCell>
                          <Badge style={{ backgroundColor: statusInfo.color, color: statusInfo.textColor }} className="border-transparent">
                            {statusInfo.name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDateForDisplay(order.createdAt)}</TableCell>
                        <TableCell className="text-card-foreground">{order.crmUserName}</TableCell>
                        <TableCell className="text-card-foreground">{order.designerRepresentativeName || "N/A"}</TableCell>
                        <TableCell className="pr-6 text-right">
                          <Link href={`/track/${order.id}`} passHref>
                            <Button variant="outline" size="sm" className="h-9 px-3">
                              <Eye className="mr-1.5 h-4 w-4" /> View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 h-[300px]">
                      <Package className="mx-auto h-12 w-12 opacity-50 mb-3 text-muted-foreground" />
                      <p className="text-lg text-muted-foreground font-medium">No orders created this month.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
