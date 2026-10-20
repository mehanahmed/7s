
"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"
import {
  Label,
  Pie,
  PieChart as RechartsPieChart,
  Sector,
} from "recharts"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

const Chart = ChartContainer

const PieChart = RechartsPieChart

const RadialChart = RechartsPieChart

const PieLabel = React.forwardRef<
  SVGTextElement,
  React.ComponentProps<typeof Label> & {
    value?: number
  }
>(({ className, value, ...props }, ref) => {
  return (
    <Label
      ref={ref}
      className={cn(
        "fill-foreground text-sm font-medium",
        className
      )}
      value={value}
      {...props}
    />
  )
})
PieLabel.displayName = Label.displayName

const PieLabelList = RechartsPrimitive.LabelList

const PieSector = Sector

export {
  Chart as RadialChartContainer,
  PieChart as RadialChart,
  Pie as RadialChartPie,
  PieLabel as RadialChartLabel,
  PieLabelList as RadialChartLabelList,
  PieSector as RadialChartSector,
  ChartTooltip as RadialChartTooltip,
  ChartTooltipContent as RadialChartTooltipContent,
}
