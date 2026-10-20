
"use client";

import React from 'react';
import type { Transaction, User } from '@/types';
import { format, parseISO } from 'date-fns';
import { TrendingUp, TrendingDown, Trash2, Edit3, UserCircle, ShoppingBag, SendHorizonal, Download, Paperclip, Utensils, Car, Lightbulb, Clipboard as ClipboardIcon, Home, Landmark, Megaphone, Braces, Banknote, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getFinanceColorClasses } from '@/lib/finance-colors';

interface TransactionListItemProps {
  transaction: Transaction;
  currentUser: User | null;
  onDelete: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
  userName?: string;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(value);
};

const expenseCategories = [
  { value: "Office Rent", label: "Office Rent", icon: Home, colorClass: "text-green-600" },
  { value: "Utilities", label: "Utilities (Gas, Water, Electric)", icon: Lightbulb, colorClass: "text-yellow-600" },
  { value: "Transportation", label: "Transportation", icon: Car, colorClass: "text-blue-600" },
  { value: "Office Supplies", label: "Office Supplies", icon: ClipboardIcon, colorClass: "text-indigo-600" },
  { value: "Food & Drinks", label: "Food & Drinks", icon: Utensils, colorClass: "text-blue-600" },
  { value: "Marketing", label: "Marketing", icon: Megaphone, colorClass: "text-pink-600" },
  { value: "Purchase", label: "Purchase", icon: ShoppingBag, colorClass: "text-sky-600" },
  { value: "Sent Money", label: "Sent Money", icon: SendHorizonal, colorClass: "text-teal-600" },
  { value: "Withdraw", label: "Withdraw", icon: Banknote, colorClass: "text-rose-600" },
  { value: "Official Expend", label: "Official Expend", icon: Briefcase, colorClass: "text-gray-600" },
  { value: "Miscellaneous", label: "Miscellaneous", icon: Braces, colorClass: "text-purple-600" },
];

const getCategoryDetails = (category: string) => {
  const matchedCategory = expenseCategories.find(c => c.value === category);
  return {
    icon: matchedCategory?.icon || TrendingDown,
    colorClass: matchedCategory?.colorClass || "text-red-600"
  };
};


export function TransactionListItem({ transaction, currentUser, onDelete, onEdit, userName }: TransactionListItemProps) {
  const isIncome = transaction.type === 'income';

  let finalCanModify = false;
  if (currentUser?.role === 'SYSTEM_ADMIN') {
    finalCanModify = true;
  } else if (currentUser?.id === transaction.userId) {
    const isReceivedSystemIncome = transaction.type === 'income' && !!transaction.receivedFromUserId;
    if (!isReceivedSystemIncome) {
      finalCanModify = true;
    }
  }

  let IconComponent;
  let iconColorClass;
  let amountPrefix = '';
  let amountColorClass = '';

  const categoryDetails = getCategoryDetails(transaction.category);

  if (isIncome) {
    if (transaction.receivedFromUserId) {
      IconComponent = Download;
      iconColorClass = "bg-purple-500/10 text-purple-600";
    } else {
      IconComponent = TrendingUp;
      iconColorClass = "bg-green-500/10 text-green-600";
    }
    amountPrefix = '+';
    amountColorClass = "text-green-600";
  } else { // Expense or Purchase
    if (transaction.category === 'Purchase') {
      IconComponent = ShoppingBag;
    } else if (transaction.category.startsWith('Sent Money')) {
      IconComponent = SendHorizonal;
    } else {
      IconComponent = categoryDetails.icon;
    }
    amountPrefix = '-';
    amountColorClass = categoryDetails.colorClass;
    iconColorClass = cn(getFinanceColorClasses(categoryDetails.colorClass).bgLight, "dark:bg-opacity-20");
  }


  return (
    <div className="flex items-center justify-between p-3 sm:p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
      <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.1, rotate: -5 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className={cn(
            "p-2 rounded-full",
            iconColorClass
          )}
        >
          <IconComponent className={cn("h-5 w-5 sm:h-6 sm:w-6", amountColorClass)} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-md font-semibold text-foreground truncate" title={transaction.category}>
            {transaction.category}
          </p>
          {userName && (currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.id !== transaction.userId) && (
            <div className="flex items-center text-xs text-primary truncate mt-0.5" title={`User: ${userName}`}>
              <UserCircle className="h-3.5 w-3.5 mr-1 opacity-80" />
              {userName}
            </div>
          )}
          <p className="text-xs text-muted-foreground truncate" title={transaction.description || undefined}>
            {transaction.description || 'No description'}
          </p>
          <div className="flex items-center text-xs text-muted-foreground mt-0.5 gap-x-2 flex-wrap">
            <span>{format(parseISO(transaction.date), "MMM d, yyyy")}</span>
            {transaction.documentUrl && (
              <Link
                href={transaction.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-primary hover:underline hover:text-primary/80 min-w-0" // Added min-w-0
                title={transaction.documentUrl.split('/').pop() || "View Document"}
              >
                <Paperclip className="h-3 w-3 mr-0.5 shrink-0" /> {/* Added shrink-0 */}
                <span className="truncate">View Document</span> {/* Wrapped in span with truncate */}
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end ml-2 sm:ml-4">
        <p className={cn(
          "text-md sm:text-lg font-bold",
          amountColorClass
        )}>
          {amountPrefix} {formatCurrency(transaction.amount)}
        </p>
        {finalCanModify && (
          <div className="flex items-center space-x-1 mt-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={() => onEdit(transaction)}
              title="Edit Transaction"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(transaction)}
              title="Delete Transaction"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
