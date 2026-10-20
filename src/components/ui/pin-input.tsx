"use client";

import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  mask?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

export function PinInput({
  value = '',
  onChange,
  length = 6,
  disabled = false,
  autoFocus = true,
  mask = true,
  size = 'default',
  className,
}: PinInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const digits = Array.from({ length }).map((_, idx) => value[idx] || '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const val = e.target.value;
    const digit = val.replace(/\D/g, '').slice(-1); // Only take last typed digit

    const newDigits = [...digits];
    newDigits[idx] = digit;
    const newPin = newDigits.join('');
    onChange(newPin);

    // Auto-advance focus to next box
    if (digit && idx < length - 1 && inputRefs.current[idx + 1]) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace') {
      if (!digits[idx] && idx > 0 && inputRefs.current[idx - 1]) {
        // Move back to previous input if current is empty
        inputRefs.current[idx - 1]?.focus();
        const newDigits = [...digits];
        newDigits[idx - 1] = '';
        onChange(newDigits.join(''));
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pastedData) {
      onChange(pastedData);
      const nextFocusIdx = Math.min(pastedData.length, length - 1);
      if (inputRefs.current[nextFocusIdx]) {
        inputRefs.current[nextFocusIdx]?.focus();
      }
    }
  };

  return (
    <div className={cn("flex items-center justify-center gap-2 sm:gap-3 py-2", className)}>
      {Array.from({ length }).map((_, idx) => {
        const isFilled = Boolean(digits[idx]);
        return (
          <input
            key={idx}
            ref={(el) => { inputRefs.current[idx] = el; }}
            type={mask ? "password" : "text"}
            inputMode="numeric"
            maxLength={1}
            value={digits[idx] || ''}
            onChange={(e) => handleChange(e, idx)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            onPaste={handlePaste}
            disabled={disabled}
            className={cn(
              size === 'sm'
                ? "w-8 h-9 sm:w-9 sm:h-10 text-center text-base font-bold font-mono rounded-lg border-2 transition-all duration-150 outline-none select-none bg-background shadow-sm"
                : "w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold font-mono rounded-xl border-2 transition-all duration-150 outline-none select-none bg-background shadow-sm",
              isFilled
                ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20 scale-105"
                : "border-input hover:border-primary/50 text-foreground focus:border-primary focus:ring-4 focus:ring-primary/20",
              disabled && "opacity-50 cursor-not-allowed bg-muted"
            )}
          />
        );
      })}
    </div>
  );
}
