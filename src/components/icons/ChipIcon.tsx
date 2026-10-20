
"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface ChipIconProps extends React.SVGProps<SVGSVGElement> {}

export function ChipIcon({ className, ...props }: ChipIconProps) {
  return (
    <svg
      viewBox="0 0 32 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-auto", className)}
      {...props}
    >
        <defs>
            <linearGradient id="chipGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "hsl(var(--chart-2))" }} />
            <stop offset="100%" style={{ stopColor: "hsl(var(--chart-3))" }} />
            </linearGradient>
        </defs>
      <rect width="32" height="24" rx="3" fill="url(#chipGradient)" />
      <path
        d="M9 12H23"
        stroke="#FFFFFF"
        strokeOpacity="0.7"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M16 5V19"
        stroke="#FFFFFF"
        strokeOpacity="0.7"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="12"
        y="8"
        width="8"
        height="8"
        rx="1.5"
        stroke="#FFFFFF"
        strokeOpacity="0.7"
        strokeWidth="1.5"
      />
    </svg>
  );
}
