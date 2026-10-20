
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, DropdownProps } from "react-day-picker"
import { format, getMonth, getYear } from "date-fns"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar3({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-0", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-3",
        caption: "hidden", // We use a custom header outside the calendar
        caption_label: "text-lg font-semibold",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 rounded-full bg-transparent p-0 opacity-60 hover:opacity-100 transition"
        ),
        table: "w-full border-collapse",
        head_row: "flex justify-around",
        head_cell:
          "text-muted-foreground rounded-md w-full font-medium text-xs sm:text-sm text-center",
        row: "flex w-full mt-2 justify-around",
        cell: "flex-1 h-14 relative text-center text-sm p-0 focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-full w-full p-0 font-normal aria-selected:opacity-100 rounded-md"
        ),
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today:
          "bg-accent text-accent-foreground font-semibold",
        day_outside: "text-muted-foreground opacity-30",
        day_disabled: "text-muted-foreground opacity-30 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      formatters={{
        formatWeekdayName: (day) => format(day, "EEEEE"), // Single letter for day of the week
      }}
      components={{
        // We're not using the internal nav buttons, so they can be empty
        IconLeft: () => <></>,
        IconRight: () => <></>,
      }}
      {...props}
    />
  )
}

Calendar3.displayName = "Calendar3"
export { Calendar3 }
