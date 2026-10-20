"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarDays, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type PredefinedRange4 =
  | "3Months"
  | "6Months"
  | "12Months";

interface DateRangePicker4Props {
  value: PredefinedRange4;
  onValueChange: (value: PredefinedRange4) => void;
  align?: "start" | "center" | "end";
  className?: string;
}

const PREDEFINED_RANGES_CONFIG: { label: string; value: PredefinedRange4 }[] = [
  { label: "3 Months", value: "3Months" },
  { label: "6 Months", value: "6Months" },
  { label: "12 Months", value: "12Months" },
];

export function DateRangePicker4({
  value,
  onValueChange,
  align = "end",
  className,
}: DateRangePicker4Props) {
  const displayLabel = PREDEFINED_RANGES_CONFIG.find(r => r.value === value)?.label || "Select Range";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start text-left font-normal sm:w-auto h-9 sm:h-10", className)}
        >
          <CalendarDays className="mr-2 h-4 w-4" />
          <span className="truncate">{displayLabel}</span>
          <ChevronDown className="ml-auto h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel>Filter by Inactivity</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PREDEFINED_RANGES_CONFIG.map((range) => (
          <DropdownMenuItem
            key={range.value}
            onSelect={() => onValueChange(range.value)}
            className={value === range.value ? "bg-accent text-accent-foreground" : ""}
          >
            {range.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
