
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar2({
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
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-3 flex flex-col flex-grow",
        caption: "hidden", // We use a custom header outside the calendar
        caption_label: "text-base font-semibold",
        nav: "hidden",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse flex flex-col flex-grow",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-full font-semibold text-xs",
        tbody: "flex-1 grid grid-cols-7 grid-rows-5 gap-1",
        row: "flex-1 contents",
        cell: "p-0 relative text-center text-sm focus-within:relative focus-within:z-20",
        day: "h-full w-full",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground font-semibold",
        day_outside: "text-muted-foreground opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      formatters={{
        formatWeekdayName: (day, options) => {
          const isFriday = day.getDay() === 5;
          const dayColorClass = isFriday ? 'text-destructive' : 'text-foreground';
          return (
            <span className={cn('font-bold', dayColorClass)}>
                {format(day, "EE", { locale: options?.locale })}
            </span>
          )
        },
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
Calendar2.displayName = "Calendar"

export { Calendar2 }
