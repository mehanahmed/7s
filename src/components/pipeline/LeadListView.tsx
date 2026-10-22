
"use client";

import React, { useMemo } from 'react';
import type { Lead, User, LeadCategory } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuPortal,
    DropdownMenuSubContent
} from '@/components/ui/dropdown-menu';
import { Edit, Trash2, Users, MoreVertical, Briefcase, FolderEdit, Eye, Check, History } from 'lucide-react';
import { format, parseISO, isBefore, startOfDay, isToday } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { LEAD_CATEGORY_LABELS } from '@/lib/pipeline-constants';
import { TemperatureGauge } from './TemperatureGauge';

interface LeadListViewProps {
    leads: Lead[];
    isLoading: boolean;
    currentUser: User | null;
    onViewLead: (lead: Lead) => void;
    onDeleteLead: (lead: Lead) => void;
    onTransferLead: (lead: Lead) => void;
    onUpdateLeadCategory: (lead: Lead, newCategory: LeadCategory) => void;
    onHistoryView: (lead: Lead) => void;
    onEditLead: (lead: Lead) => void;
    allUsers: User[];
    isSelectionMode?: boolean;
    selectedLeadIds?: Set<string>;
    onSelectionChange?: (leadId: string, isSelected: boolean) => void;
    onSelectAll?: (isSelected: boolean) => void;
}

const formatDateSafe = (dateString?: string | null) => {
    if (!dateString) return null; // Return null for blank output
    try {
        return format(parseISO(dateString), 'd MMM, yyyy');
    } catch (e) {
        return 'Invalid Date';
    }
};

const getInitials = (name: string | undefined) => {
    if (!name) return '??';
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return names[0].charAt(0).toUpperCase() + (names.length > 1 ? names[names.length - 1].charAt(0).toUpperCase() : '');
};

const getStatusBadgeClass = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('won')) return 'bg-green-100 text-green-800 border-green-200';
    if (s.includes('lost')) return 'bg-red-100 text-red-800 border-red-200';
    if (s.includes('proposal') || s.includes('negotiation')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (s.includes('qualified')) return 'bg-sky-100 text-sky-800 border-sky-200';
    if (s.includes('contacted')) return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    return 'bg-yellow-100 text-yellow-800 border-yellow-200'; // Default for New Lead
};

const getCategoryColorClass = (category: LeadCategory) => {
    switch (category) {
        case 'POP': return 'bg-sky-100 text-sky-800 border-sky-200';
        case 'APPOINTMENT': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
        case 'PROSPECT': return 'bg-pink-100 text-pink-800 border-pink-200';
        case 'POG': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'OC': return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'BUDGET_ISSUE': return 'bg-amber-100 text-amber-800 border-amber-200';
        case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-200';
        default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
};

const LEAD_CATEGORIES: LeadCategory[] = ['POP', 'APPOINTMENT', 'PROSPECT', 'POG', 'OC', 'BUDGET_ISSUE', 'CANCELLED'];

export function LeadListView({ leads, isLoading, currentUser, onViewLead, onDeleteLead, onTransferLead, onUpdateLeadCategory, onHistoryView, onEditLead, allUsers, isSelectionMode = false, selectedLeadIds = new Set(), onSelectionChange = () => { }, onSelectAll = () => { } }: LeadListViewProps) {
    const canEdit = (lead: Lead) => currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.role === 'ADMIN' || currentUser?.id === lead.crmId;
    const canDelete = (lead: Lead) => currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.role === 'ADMIN';
    const canTransfer = (lead: Lead) => currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.role === 'ADMIN' || currentUser?.id === lead.crmId;

    const isAllSelected = leads.length > 0 && selectedLeadIds.size === leads.length;
    const isSomeSelected = selectedLeadIds.size > 0 && selectedLeadIds.size < leads.length;

    const duplicatePhoneNumbers = useMemo(() => {
        const phoneCounts = new Map<string, number>();
        leads.forEach(lead => {
            if (lead.phone) {
                phoneCounts.set(lead.phone, (phoneCounts.get(lead.phone) || 0) + 1);
            }
        });

        const duplicates = new Set<string>();
        for (const [phone, count] of phoneCounts.entries()) {
            if (count > 1) {
                duplicates.add(phone);
            }
        }
        return duplicates;
    }, [leads]);


    return (
        <div className="mt-4 border rounded-lg overflow-hidden bg-card">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {isSelectionMode && (
                                <TableHead className="w-12 pl-4">
                                    <Checkbox
                                        checked={isAllSelected ? true : (isSomeSelected ? 'indeterminate' : false)}
                                        onCheckedChange={(checked) => onSelectAll(checked === true)}
                                        aria-label="Select all leads on this page"
                                    />
                                </TableHead>
                            )}
                            <TableHead>Contact</TableHead>
                            <TableHead>Business</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Temperature</TableHead>
                            <TableHead>Assigned CR</TableHead>
                            <TableHead>Onboarding Date</TableHead>
                            <TableHead>Schedule</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && [...Array(12)].map((_, i) => (
                            <TableRow key={`skel-${i}`}>
                                {isSelectionMode && <TableCell className="pl-4"><Skeleton className="h-5 w-5" /></TableCell>}
                                <TableCell><div className="flex items-center gap-2"><Skeleton className="h-5 w-24" /></div></TableCell>
                                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                <TableCell><div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-5 w-24" /></div></TableCell>
                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                            </TableRow>
                        ))}

                        {!isLoading && leads.length > 0 && leads.map((lead, index) => {
                            const crmUser = allUsers.find(u => u.id === lead.crmId);
                            const scheduleDate = lead.schedule ? parseISO(lead.schedule) : null;
                            const isPast = scheduleDate ? isBefore(scheduleDate, startOfDay(new Date())) && !isToday(scheduleDate) : false;
                            const isDuplicatePhone = lead.phone && duplicatePhoneNumbers.has(lead.phone);
                            const wasUpdatedToday = lead.updatedAt ? isToday(parseISO(lead.updatedAt)) : false;

                            return (
                                <TableRow
                                    key={lead.id || `lead-${index}`}
                                    className={cn(
                                        "hover:bg-muted/50",
                                        isDuplicatePhone && "bg-red-100/50 dark:bg-red-900/20",
                                        wasUpdatedToday && !isDuplicatePhone && "bg-green-100/50 dark:bg-green-900/20"
                                    )}
                                    data-state={selectedLeadIds.has(lead.id) ? "selected" : ""}
                                >
                                    {isSelectionMode && (
                                        <TableCell className="pl-4">
                                            <Checkbox
                                                checked={selectedLeadIds.has(lead.id)}
                                                onCheckedChange={(checked) => onSelectionChange(lead.id, checked === true)}
                                                aria-label={`Select lead ${lead.contactName}`}
                                            />
                                        </TableCell>
                                    )}
                                    <TableCell className="font-medium text-foreground">{lead.contactName}</TableCell>
                                    <TableCell>{lead.businessName}</TableCell>
                                    <TableCell>{lead.phone}</TableCell>
                                    <TableCell>{lead.source}</TableCell>
                                    <TableCell>
                                        <Badge className={cn("hover:opacity-80 transition-opacity", getCategoryColorClass(lead.category))}>
                                            {LEAD_CATEGORY_LABELS[lead.category]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        {lead.temperature != null && (
                                            <span className="flex items-center gap-1.5 text-sm font-medium">
                                                <TemperatureGauge value={lead.temperature} />
                                                {lead.temperature}%
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-8 w-8 text-xs">
                                                <AvatarImage src={crmUser?.avatarUrl || undefined} alt={lead.crmName} />
                                                <AvatarFallback>{getInitials(lead.crmName)}</AvatarFallback>
                                            </Avatar>
                                            <span>{lead.crmName}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{formatDateSafe(lead.date || lead.categoryUpdatedAt)}</TableCell>
                                    <TableCell>
                                        {scheduleDate ? (
                                            <Badge variant="outline" className={cn(
                                                isPast
                                                    ? 'border-red-300 text-red-800 bg-red-50'
                                                    : 'border-green-300 text-green-800 bg-green-50'
                                            )}>
                                                {formatDateSafe(lead.schedule)}
                                            </Badge>
                                        ) : (
                                            null
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onSelect={() => onViewLead(lead)} className="cursor-pointer"><Eye className="mr-2 h-4 w-4" /> View</DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => onHistoryView(lead)} className="cursor-pointer"><History className="mr-2 h-4 w-4" /> History</DropdownMenuItem>
                                                {canEdit(lead) && <DropdownMenuItem onSelect={() => onEditLead(lead)} className="cursor-pointer"><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>}

                                                {canEdit(lead) && (
                                                    <DropdownMenuSub>
                                                        <DropdownMenuSubTrigger className="cursor-pointer">
                                                            <FolderEdit className="mr-2 h-4 w-4" /> Change Category
                                                        </DropdownMenuSubTrigger>
                                                        <DropdownMenuPortal>
                                                            <DropdownMenuSubContent>
                                                                {LEAD_CATEGORIES.map(category => (
                                                                    <DropdownMenuItem
                                                                        key={category}
                                                                        disabled={lead.category === category}
                                                                        onSelect={() => onUpdateLeadCategory(lead, category)}
                                                                        className="cursor-pointer"
                                                                    >
                                                                        {LEAD_CATEGORY_LABELS[category]}
                                                                    </DropdownMenuItem>
                                                                ))}
                                                            </DropdownMenuSubContent>
                                                        </DropdownMenuPortal>
                                                    </DropdownMenuSub>
                                                )}

                                                {canDelete(lead) && <DropdownMenuItem onSelect={() => onDeleteLead(lead)} className="cursor-pointer text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}

                        {!isLoading && leads.length === 0 && (
                            <TableRow key="empty-leads">
                                <TableCell colSpan={isSelectionMode ? 11 : 10} className="h-48 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <Briefcase className="h-10 w-10 opacity-50" />
                                        <span>No leads found.</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
