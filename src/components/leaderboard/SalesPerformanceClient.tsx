
"use client";

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, LineChart, AreaChart, Layers, Download, Repeat, TrendingUp, Target } from 'lucide-react';
import { Bar, BarChart as RechartsBarChart, Line, Area, AreaChart as RechartsAreaChart, LineChart as RechartsLineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Cell } from 'recharts';
import { ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { parseISO, format, getYear, getMonth } from 'date-fns';
import type { TrackingLink, User, UserRole } from '@/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CANCELLED_STATUS_ID } from '@/lib/status-constants';

interface SalesPerformanceClientProps {
  allOrders: TrackingLink[];
  allCrmUsers: User[];
  displayMode?: 'amount' | 'quantity';
}

interface MonthlySalesData {
  name: string; // month name
  sales: number;
  orders: number; // New field for sales count
  crmSales: { [crmId: string]: { sales: number; orders: number; crmUserName?: string } };
}

const formatCurrencyBdt = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BDT' }).format(value);
};

const getInitials = (name: string | undefined): string => {
  if (!name) return '??';
  const names = name.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return names[0].charAt(0).toUpperCase() + (names.length > 1 ? names[names.length - 1].charAt(0).toUpperCase() : '');
};


export function SalesPerformanceClient({ allOrders, allCrmUsers, displayMode = 'amount' }: SalesPerformanceClientProps) {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('bar');
  const [selectedYear, setSelectedYear] = useState<number>(getYear(new Date()));
  const [selectedTeam, setSelectedTeam] = useState<UserRole | 'all'>('all');

  const showAmount = displayMode === 'amount';
  const userMap = useMemo(() => new Map(allCrmUsers.map(u => [u.id, u])), [allCrmUsers]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentYear = getYear(new Date());

    for (let y = currentYear - 4; y <= currentYear; y++) {
      years.add(y);
    }

    if (allOrders && allOrders.length > 0) {
      allOrders.forEach(order => {
        try {
          if (order.currentStatus === CANCELLED_STATUS_ID) return;
          if (order.createdAt) {
            const yr = getYear(parseISO(order.createdAt));
            if (!isNaN(yr)) {
              years.add(yr);
            }
          }
        } catch {
          // Ignore invalid dates
        }
      });
    }

    return Array.from(years).sort((a, b) => b - a);
  }, [allOrders]);

  const monthlySalesData: MonthlySalesData[] = useMemo(() => {
    const months: MonthlySalesData[] = Array.from({ length: 12 }, (_, i) => ({
      name: format(new Date(selectedYear, i), 'MMM'),
      sales: 0,
      orders: 0,
      crmSales: {},
    }));

    allOrders.forEach(order => {
      try {
        if (order.currentStatus === CANCELLED_STATUS_ID) return;
        const orderDate = parseISO(order.createdAt);
        if (getYear(orderDate) === selectedYear && order.crmUserId) {
          const monthIndex = getMonth(orderDate);
          const rawTotal = (order.orderItems || []).reduce((sum, item) => sum + (item.isGift ? 0 : (item.lineItemTotalPrice || 0)), 0);
          const orderTotal = Math.max(0, rawTotal - (Number(order.specialClientDiscount) || 0));
          months[monthIndex].sales += orderTotal;
          months[monthIndex].orders += 1;

          if (!months[monthIndex].crmSales[order.crmUserId]) {
            months[monthIndex].crmSales[order.crmUserId] = { sales: 0, orders: 0, crmUserName: order.crmUserName };
          }
          months[monthIndex].crmSales[order.crmUserId].sales += orderTotal;
          months[monthIndex].crmSales[order.crmUserId].orders += 1;
        }
      } catch (e) {
        // Ignore invalid date formats
      }
    });

    return months;
  }, [allOrders, selectedYear]);

  const renderChart = () => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const currentChartType = isMobile && chartType === 'bar' ? 'area' : chartType;

    const commonProps = {
      data: monthlySalesData,
      margin: { top: 10, right: 10, left: -20, bottom: 0 },
    };

    const xAxis = <XAxis dataKey="name" className="font-sans" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dy={10} interval={isMobile ? 1 : 0} minTickGap={12} />;
    const yAxisLeft = <YAxis yAxisId="left" className="font-sans tabular-nums" stroke="hsl(var(--primary))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => value === 0 ? '' : `${Number(value) / 1000}k`} />;
    const yAxisRight = <YAxis yAxisId="right" className="font-sans tabular-nums" orientation={showAmount ? "right" : "left"} stroke="hsl(var(--chart-2))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => value === 0 ? '' : value} />;
    const tooltip = <Tooltip content={<ChartTooltipContentCustom active={false} payload={[]} label={""} userMap={userMap} displayMode={displayMode} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />;
    const legend = (
      <Legend verticalAlign="bottom" height={36} content={(props) => (
        <div className="flex justify-center gap-6 mt-6 select-none">
          {props.payload?.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center gap-2 group cursor-default">
              <div className="h-2 w-2 rounded-full transition-transform group-hover:scale-125" style={{ backgroundColor: entry.color }}></div>
              <span className="font-sans text-xs sm:text-sm font-medium leading-none tracking-normal text-muted-foreground">{entry.value}</span>
            </div>
          ))}
        </div>
      )} />
    );

    switch (currentChartType) {
      case 'line':
        return (
          <RechartsLineChart {...commonProps}>
            {xAxis}
            {showAmount && yAxisLeft}
            {yAxisRight}
            {tooltip}
            {legend}
            {showAmount && <Line yAxisId="left" type="monotone" dataKey="sales" name="Sales" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--background))' }} activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={1500} />}
            <Line yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="hsl(var(--chart-2))" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--background))' }} activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={1500} />
          </RechartsLineChart>
        );
      case 'area':
        return (
          <RechartsAreaChart {...commonProps}>
            <defs>
              <linearGradient id="colorSalesPerformance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorOrdersPerformance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.15} />
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
              </linearGradient>
            </defs>
            {xAxis}
            {showAmount && yAxisLeft}
            {yAxisRight}
            {tooltip}
            {legend}
            {showAmount && <Area yAxisId="left" type="monotone" dataKey="sales" name="Sales" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#colorSalesPerformance)" animationDuration={1500} />}
            <Area yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="hsl(var(--chart-2))" strokeWidth={3} fill="url(#colorOrdersPerformance)" animationDuration={1500} />
          </RechartsAreaChart>
        );
      case 'bar':
      default:
        return (
          <RechartsBarChart {...commonProps}>
            {xAxis}
            {showAmount && yAxisLeft}
            {yAxisRight}
            {tooltip}
            {legend}
            {showAmount && <Bar yAxisId="left" dataKey="sales" name="Sales" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} animationDuration={1500} />}
            <Bar yAxisId="right" dataKey="orders" name="Orders" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} animationDuration={1500} />
          </RechartsBarChart>
        );
    }
  };

  return (
    <>
      <Card className="bg-card/95 border-none sm:border border-border/30 shadow-xl sm:shadow-lg rounded-2xl sm:rounded-lg overflow-hidden group relative">
        {/* Premium background highlight for mobile */}
        <div className="absolute inset-0 opacity-[0.02] sm:hidden bg-gradient-to-br from-primary via-transparent to-chart-2 pointer-events-none" />

        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-6 relative z-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="p-2.5 bg-primary/10 rounded-xl sm:hidden">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
                  <span className="hidden sm:inline"><TrendingUp className="h-5 w-5 text-primary" /></span>
                  Sales Performance Analysis
                </CardTitle>
                <CardDescription className="font-sans text-[13px] leading-relaxed text-foreground/65 line-clamp-1 sm:line-clamp-none">
                  Monthly revenue trends for {selectedYear}
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto bg-muted/30 sm:bg-transparent p-1.5 sm:p-0 rounded-xl sm:rounded-none">
              <div className="flex items-center bg-background sm:bg-muted p-1 rounded-lg shadow-sm sm:shadow-none flex-1 sm:flex-none justify-between sm:justify-start">
                <Button variant="ghost" size="sm" className={cn("h-8 flex-1 sm:flex-none", chartType === 'bar' && "bg-muted sm:bg-background shadow-none sm:shadow-sm")} onClick={() => setChartType('bar')}>
                  <BarChart className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className={cn("h-8 flex-1 sm:flex-none", chartType === 'line' && "bg-muted sm:bg-background shadow-none sm:shadow-sm")} onClick={() => setChartType('line')}>
                  <LineChart className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className={cn("h-8 flex-1 sm:flex-none", chartType === 'area' && "bg-muted sm:bg-background shadow-none sm:shadow-sm")} onClick={() => setChartType('area')}>
                  <AreaChart className="h-4 w-4" />
                </Button>
              </div>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value, 10))}>
                <SelectTrigger className="w-[100px] sm:w-[120px] h-10 sm:h-9 bg-background sm:bg-transparent border-none sm:border shadow-sm sm:shadow-none rounded-lg text-xs sm:text-sm">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0 relative z-10">
          <div className="h-[280px] sm:h-[400px] w-full mt-4 sm:mt-0">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </CardContent>

        {/* Decorative background element for mobile */}
        <div className="absolute -right-6 -bottom-6 opacity-[0.03] sm:hidden pointer-events-none transform rotate-12 scale-150">
          <TrendingUp className="h-32 w-32 text-primary" />
        </div>
      </Card>

    </>
  );
}

const ChartTooltipContentCustom = ({ active, payload, label, userMap, displayMode }: any) => {
  if (active && payload && payload.length) {
    const salesPayload = payload.find((p: any) => p.dataKey === 'sales');
    const ordersPayload = payload.find((p: any) => p.dataKey === 'orders');
    const showAmount = displayMode === 'amount';
    // Fallback to orders if sales is missing or amount is hidden
    const activePayload = showAmount && salesPayload ? salesPayload : ordersPayload;
    if (!activePayload) return null;

    const crmSalesData = activePayload?.payload?.crmSales;

    const crmBreakdown = crmSalesData ? Object.entries(crmSalesData)
      .map(([crmId, data]: [string, any]) => {
        const user = userMap.get(crmId);
        return {
          crmId,
          sales: data.sales as number,
          orders: data.orders as number,
          user: user || (data.crmUserName ? { name: data.crmUserName, avatarUrl: null } : { name: `User (${crmId.slice(0, 6)})`, avatarUrl: null }),
        };
      })
      .sort((a, b) => showAmount ? b.sales - a.sales : b.orders - a.orders) : [];

    return (
      <div className="rounded-lg border bg-background p-2.5 shadow-md min-w-[240px] max-w-[280px]">
        <div className="grid grid-cols-1 gap-1.5">
          <p className="font-semibold text-foreground">{label}</p>
          {showAmount && salesPayload && (
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: salesPayload.color }}></div>
              <span className="text-sm text-muted-foreground">Total Sales:</span>
              <span className="text-sm font-medium ml-auto">{formatCurrencyBdt(salesPayload.value as number)}</span>
            </div>
          )}
          {ordersPayload && (
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ordersPayload.color }}></div>
              <span className="text-sm text-muted-foreground">Total Orders:</span>
              <span className="text-sm font-medium ml-auto">{ordersPayload.value}</span>
            </div>
          )}

          {crmBreakdown.length > 0 && (
            <>
              <div className="border-t border-dashed my-1"></div>
              <p className="font-semibold text-xs text-muted-foreground mt-1">Top Contributors ({crmBreakdown.length}):</p>
              <ScrollArea className="max-h-56 pr-2">
                <div className="space-y-1.5">
                  {crmBreakdown.map(({ crmId, sales, orders, user }) => (
                    <div key={crmId} className="flex items-center gap-2 text-xs">
                      <Avatar className="h-5 w-5 border">
                        <AvatarImage src={user?.avatarUrl || undefined} alt={user?.name} />
                        <AvatarFallback className="text-[9px]">{getInitials(user?.name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-muted-foreground truncate flex-1">{user?.name}</span>
                      <span className="font-medium text-right">{orders} orders</span>
                      {showAmount && <span className="font-medium text-right">{formatCurrencyBdt(sales)}</span>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </div>
    );
  }
  return null;
}
