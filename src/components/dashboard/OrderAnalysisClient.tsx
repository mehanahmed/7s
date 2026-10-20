
"use client";

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, LineChart, AreaChart, Layers, Download, Repeat, TrendingUp } from 'lucide-react';
import { Bar, BarChart as RechartsBarChart, Line, Area, AreaChart as RechartsAreaChart, LineChart as RechartsLineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { parseISO, format, getYear, getMonth } from 'date-fns';
import type { TrackingLink } from '@/types';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CANCELLED_STATUS_ID } from '@/lib/status-constants';

interface OrderAnalysisClientProps {
  allOrders: TrackingLink[];
}

interface MonthlyData {
  name: string;
  totalOrders: number;
  reorders: number;
}

const orderAnalysisChartConfig = {
  totalOrders: {
    label: "Orders",
    color: "hsl(var(--chart-1))",
  },
  reorders: {
    label: "Repeat",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function OrderAnalysisClient({ allOrders }: OrderAnalysisClientProps) {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('bar');
  const [selectedYear, setSelectedYear] = useState<number>(getYear(new Date()));

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentYear = getYear(new Date());

    for (let y = currentYear - 4; y <= currentYear; y++) {
      years.add(y);
    }

    if (allOrders && allOrders.length > 0) {
      allOrders.forEach(order => {
        try {
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

  const monthlyOrderData: MonthlyData[] = useMemo(() => {
    const customerOrderHistory: { [jobId: string]: boolean } = {}; // Use Client ID as the key
    const months: MonthlyData[] = Array.from({ length: 12 }, (_, i) => ({
      name: format(new Date(selectedYear, i), 'MMM'),
      totalOrders: 0,
      reorders: 0,
    }));

    // Filter out cancelled orders and sort by date
    const sortedOrders = [...allOrders]
      .filter(order => order.currentStatus !== CANCELLED_STATUS_ID)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    sortedOrders.forEach(order => {
      try {
        const orderDate = parseISO(order.createdAt);
        const orderYear = getYear(orderDate);

        const jobId = (order.companyName || '').split('•')[0].trim();

        let isReorder = false;
        if (jobId) {
          if (customerOrderHistory[jobId]) {
            isReorder = true;
          } else {
            customerOrderHistory[jobId] = true;
          }
        }

        // Only add to chart data if it's in the selected year
        if (orderYear === selectedYear) {
          const monthIndex = getMonth(orderDate);
          months[monthIndex].totalOrders += 1;
          
          if (isReorder) {
            months[monthIndex].reorders += 1;
          }
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
      data: monthlyOrderData,
      margin: { top: 10, right: 10, left: -20, bottom: 0 },
    };

    const xAxis = <XAxis dataKey="name" className="font-sans" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dy={10} interval={isMobile ? 1 : 0} minTickGap={12} />;
    const yAxis = <YAxis className="font-sans tabular-nums" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => value === 0 ? '' : value} />;
    const tooltip = <Tooltip content={<ChartTooltipContent />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />;
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
            {yAxis}
            {tooltip}
            {legend}
            <Line type="monotone" dataKey="totalOrders" name="Orders" stroke="var(--color-totalOrders)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--background))' }} activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={1500} />
            <Line type="monotone" dataKey="reorders" name="Repeat" stroke="var(--color-reorders)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--background))' }} activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={1500} />
          </RechartsLineChart>
        );
      case 'area':
        return (
          <RechartsAreaChart {...commonProps}>
            <defs>
              <linearGradient id="colorTotalOrdersAnalysis" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-totalOrders)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="var(--color-totalOrders)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorReordersAnalysis" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-reorders)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="var(--color-reorders)" stopOpacity={0} />
              </linearGradient>
            </defs>
            {xAxis}
            {yAxis}
            {tooltip}
            {legend}
            <Area type="monotone" dataKey="totalOrders" name="Orders" stroke="var(--color-totalOrders)" strokeWidth={3} fill="url(#colorTotalOrdersAnalysis)" animationDuration={1500} />
            <Area type="monotone" dataKey="reorders" name="Repeat" stroke="var(--color-reorders)" strokeWidth={3} fill="url(#colorReordersAnalysis)" animationDuration={1500} />
          </RechartsAreaChart>
        );
      case 'bar':
      default:
        return (
          <RechartsBarChart {...commonProps}>
            {xAxis}
            {yAxis}
            {tooltip}
            {legend}
            <Bar dataKey="totalOrders" name="Orders" fill="var(--color-totalOrders)" radius={[6, 6, 0, 0]} animationDuration={1500} />
            <Bar dataKey="reorders" name="Repeat" fill="var(--color-reorders)" radius={[6, 6, 0, 0]} animationDuration={1500} />
          </RechartsBarChart>
        );
    }
  };

  return (
    <Card className="bg-card/95 border-none sm:border border-border/30 shadow-xl sm:shadow-lg rounded-2xl sm:rounded-lg overflow-hidden group relative">
      {/* Premium background highlight for mobile */}
      <div className="absolute inset-0 opacity-[0.02] sm:hidden bg-gradient-to-br from-chart-1 via-transparent to-chart-2 pointer-events-none" />

      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-6 relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="p-2.5 bg-chart-1/10 rounded-xl sm:hidden">
              <Repeat className="h-5 w-5 text-chart-1" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
                <span className="hidden sm:inline"><Repeat className="h-5 w-5 text-chart-1" /></span>
                Order Analysis
              </CardTitle>
              <CardDescription className="font-sans text-[13px] leading-relaxed text-foreground/65 line-clamp-1 sm:line-clamp-none">
                Orders vs. Repeat for {selectedYear}
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
          <ChartContainer config={orderAnalysisChartConfig} className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CardContent>

      {/* Decorative background element for mobile */}
      <div className="absolute -right-6 -bottom-6 opacity-[0.03] sm:hidden pointer-events-none transform rotate-12 scale-150">
        <Repeat className="h-32 w-32 text-chart-1" />
      </div>
    </Card>
  );
}
