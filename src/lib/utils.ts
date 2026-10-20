import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDisplayName(name?: string | null): string {
  if (!name) return 'User';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'User';
  if (parts.length === 1) return parts[0];

  const cleanFirstWord = parts[0].replace(/[^a-zA-Z0-9]/g, '');
  if (cleanFirstWord.length < 4 && parts.length > 1) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0];
}

