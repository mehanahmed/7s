import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function getCategoryBadgeClasses(category?: string | null): string {
  if (!category) return 'bg-gray-100 text-gray-700 border-gray-200';
  const norm = category.trim().toLowerCase();
  switch (norm) {
    case 'male':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'female':
      return 'bg-pink-50 text-pink-700 border-pink-200';
    case 'child':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'influencer':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'celebrity':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  }
}

interface ArtistCategoryBadgeProps {
  category?: string | null;
  className?: string;
}

export function ArtistCategoryBadge({ category, className }: ArtistCategoryBadgeProps) {
  if (!category) return <span className="text-muted-foreground text-xs">N/A</span>;
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border text-xs px-2.5 py-0.5 rounded-full transition-colors whitespace-nowrap",
        getCategoryBadgeClasses(category),
        className
      )}
    >
      {category}
    </Badge>
  );
}
