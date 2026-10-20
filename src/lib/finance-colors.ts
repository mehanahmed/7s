
import { cn } from "./utils";

export const FINANCE_COLORS: Record<string, { text: string, bg: string, bgLight: string, bgExtraLight: string }> = {
  "text-blue-600": {
    text: "text-blue-600",
    bg: "bg-blue-600",
    bgLight: "bg-blue-100",
    bgExtraLight: "bg-blue-50"
  },
  "text-green-600": {
    text: "text-green-600",
    bg: "bg-green-600",
    bgLight: "bg-green-100",
    bgExtraLight: "bg-green-50"
  },
  "text-red-600": {
    text: "text-red-600",
    bg: "bg-red-600",
    bgLight: "bg-red-100",
    bgExtraLight: "bg-red-50"
  },
  "text-yellow-600": {
    text: "text-yellow-600",
    bg: "bg-yellow-600",
    bgLight: "bg-yellow-100",
    bgExtraLight: "bg-yellow-50"
  },
  "text-purple-600": {
    text: "text-purple-600",
    bg: "bg-purple-600",
    bgLight: "bg-purple-100",
    bgExtraLight: "bg-purple-50"
  },
  "text-pink-600": {
    text: "text-pink-600",
    bg: "bg-pink-600",
    bgLight: "bg-pink-100",
    bgExtraLight: "bg-pink-50"
  },
  "text-indigo-600": {
    text: "text-indigo-600",
    bg: "bg-indigo-600",
    bgLight: "bg-indigo-100",
    bgExtraLight: "bg-indigo-50"
  },
  "text-teal-600": {
    text: "text-teal-600",
    bg: "bg-teal-600",
    bgLight: "bg-teal-100",
    bgExtraLight: "bg-teal-50"
  },
  "text-rose-600": {
    text: "text-rose-600",
    bg: "bg-rose-600",
    bgLight: "bg-rose-100",
    bgExtraLight: "bg-rose-50"
  },
  "text-amber-600": {
    text: "text-amber-600",
    bg: "bg-amber-600",
    bgLight: "bg-amber-100",
    bgExtraLight: "bg-amber-50"
  },
  "text-emerald-600": {
    text: "text-emerald-600",
    bg: "bg-emerald-600",
    bgLight: "bg-emerald-100",
    bgExtraLight: "bg-emerald-50"
  },
  "text-sky-600": {
    text: "text-sky-600",
    bg: "bg-sky-600",
    bgLight: "bg-sky-100",
    bgExtraLight: "bg-sky-50"
  },
  "text-gray-600": {
    text: "text-gray-600",
    bg: "bg-gray-600",
    bgLight: "bg-gray-100",
    bgExtraLight: "bg-gray-50"
  },
  "text-cyan-600": {
    text: "text-cyan-600",
    bg: "bg-cyan-600",
    bgLight: "bg-cyan-100",
    bgExtraLight: "bg-cyan-50"
  },
  "text-lime-600": {
    text: "text-lime-600",
    bg: "bg-lime-600",
    bgLight: "bg-lime-100",
    bgExtraLight: "bg-lime-50"
  },
};

export function getFinanceColorClasses(colorClass: string | undefined) {
  const defaultColors = {
    text: "text-gray-600",
    bg: "bg-gray-600",
    bgLight: "bg-gray-100",
    bgExtraLight: "bg-gray-50"
  };

  if (!colorClass) return defaultColors;
  
  // If it's already one of our mapped keys
  if (FINANCE_COLORS[colorClass]) {
    return FINANCE_COLORS[colorClass];
  }

  // Fallback for cases where only the color name might be passed or a different shade
  // This is a safety net, but ideally we use the keys above
  return defaultColors;
}
