
"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface MultiColorCalculatorIconProps extends React.SVGProps<SVGSVGElement> {}

export function MultiColorCalculatorIcon({ className, ...props }: MultiColorCalculatorIconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-5 w-5", className)} // Default size, can be overridden
      {...props}
    >
      <defs>
        <linearGradient id="calcGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "hsl(var(--primary))", stopOpacity: 1 }} />
          <stop offset="50%" style={{ stopColor: "hsl(var(--chart-2))", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "hsl(var(--chart-3))", stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      {/* Calculator Body */}
      <rect x="4" y="2" width="16" height="20" rx="2" stroke="url(#calcGradient)" strokeWidth="1.5" fill="hsl(var(--card))" />
      {/* Screen */}
      <rect x="6" y="4" width="12" height="5" rx="1" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="0.5" />
      {/* Buttons - can be styled with gradients or solid theme colors */}
      <rect x="6" y="11" width="2.5" height="2.5" rx="0.5" fill="url(#calcGradient)" />
      <rect x="9.75" y="11" width="2.5" height="2.5" rx="0.5" fill="url(#calcGradient)" />
      <rect x="13.5" y="11" width="2.5" height="2.5" rx="0.5" fill="url(#calcGradient)" />
      <rect x="17.25" y="11" width="2.5" height="2.5" rx="0.5" fill="hsl(var(--primary))" /> {/* Operator button example */}

      <rect x="6" y="14.75" width="2.5" height="2.5" rx="0.5" fill="url(#calcGradient)" />
      <rect x="9.75" y="14.75" width="2.5" height="2.5" rx="0.5" fill="url(#calcGradient)" />
      <rect x="13.5" y="14.75" width="2.5" height="2.5" rx="0.5" fill="url(#calcGradient)" />
      <rect x="17.25" y="14.75" width="2.5" height="2.5" rx="0.5" fill="hsl(var(--primary))" /> {/* Operator button example */}
      
      <rect x="6" y="18.5" width="6.25" height="2.5" rx="0.5" fill="url(#calcGradient)" /> {/* Zero button example */}
      <rect x="13.5" y="18.5" width="2.5" height="2.5" rx="0.5" fill="hsl(var(--muted-foreground))" /> {/* Equals button example */}
      <rect x="17.25" y="18.5" width="2.5" height="2.5" rx="0.5" fill="hsl(var(--primary))" /> {/* Operator button example */}
    </svg>
  );
}
