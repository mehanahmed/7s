

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar as CalendarIcon, ClipboardList, PlusCircle, AlertTriangle, Trash2 } from 'lucide-react';
import type { Employee, LeaveRecord, User, AttendanceRecord } from '@/types';
import { addLeaveRecordAction, deleteLeaveRecordAction } from '@/app/(app)/payroll/actions';
import { format, parseISO, getYear, getMonth, differenceInMonths, isAfter, startOfDay, isBefore, isSameDay } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


interface ManageLeaveDialogProps {
  employee: Employee | null;
  onLeaveUpdated: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: User;
  attendanceRecords?: AttendanceRecord[];
  weekendDays?: string[];
}

export function ManageLeaveDialog({ employee, onLeaveUpdated, isOpen, onOpenChange, currentUser, attendanceRecords = [], weekendDays = [] }: ManageLeaveDialogProps) {
  const [selectedDates, setSelectedDates] = useState<Date[] | undefined>([]);
  const [leaveReason, setLeaveReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editedLeaveTaken, setEditedLeaveTaken] = useState<string>('');
  const [recordToDelete, setRecordToDelete] = useState<LeaveRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();

  const totalLeaveAccrued = useMemo(() => {
    if (!employee?.joiningDate) return 0;
    
    const joiningDate = new Date(employee.joiningDate);
    const now = new Date();
    
    if (isAfter(joiningDate, now)) return 0;
    
    const joiningMonth = getMonth(joiningDate);
    const joiningYear = getYear(joiningDate);
    const currentMonth = getMonth(now);
    const currentFullYear = getYear(now);
    
    let accrued = 0;
    
    // For years between joining and current year
    if (currentFullYear > joiningYear) {
      // Months left in the joining year
      accrued += (12 - (joiningMonth + 1));
      // Full years in between
      accrued += (currentFullYear - joiningYear - 1) * 12;
      // Months in the current year
      accrued += currentMonth; // We don't add 1 because we don't count the current month until it's over
    } else { // Same year
      // Only count full months passed since joining
      accrued += currentMonth - (joiningMonth + 1);
    }
    
    return Math.max(0, accrued + 1);
  }, [employee?.joiningDate]);


  const years = useMemo(() => {
    if (!employee?.joiningDate) return [new Date().getFullYear()];
    const startYear = getYear(new Date(employee.joiningDate));
    const endYear = new Date().getFullYear() + 1;
    const yearsArray = [];
    for (let i = startYear; i <= endYear; i++) {
      yearsArray.push(i);
    }
    return yearsArray.reverse();
  }, [employee?.joiningDate]);


  const stats = useMemo(() => {
    if (!employee?.joiningDate) return { accrued: 0, taken: 0, available: 0 };
    
    const joiningDate = new Date(employee.joiningDate);
    const now = new Date();
    const currentYearNum = now.getFullYear();
    const history = employee.leaveHistory || [];

    if (selectedYear === 'all') {
      const taken = history.reduce((sum, leave) => sum + leave.days, 0);
      return {
        accrued: totalLeaveAccrued,
        taken: taken,
        available: totalLeaveAccrued - taken
      };
    }

    // Year specific stats
    let accrued = 0;
    if (selectedYear === getYear(joiningDate)) {
      // Pro-rated for joining year
      const startMonth = getMonth(joiningDate);
      const isCurrentYear = selectedYear === currentYearNum;
      const endMonth = isCurrentYear ? getMonth(now) : 11;
      accrued = Math.max(0, endMonth - startMonth + 1);
    } else if (selectedYear < getYear(joiningDate) || selectedYear > currentYearNum) {
      accrued = 0;
    } else if (selectedYear === currentYearNum) {
      // Current year up to current month
      accrued = getMonth(now) + 1;
    } else {
      // Full past year
      accrued = 12;
    }

    const taken = history
      .filter(record => getYear(parseISO(record.date)) === selectedYear)
      .reduce((sum, leave) => sum + leave.days, 0);

    return {
      accrued,
      taken,
      available: accrued - taken
    };
  }, [employee, selectedYear, totalLeaveAccrued]);


  const leaveTaken = stats.taken;
  const availableLeave = stats.available;
  const displayAccrued = stats.accrued;
  
  const canAdminEdit = currentUser.role === 'ADMIN' || currentUser.role === 'SYSTEM_ADMIN';

  useEffect(() => {
    if (!isOpen) {
      setSelectedDates([]);
      setLeaveReason('');
      setEditedLeaveTaken('');
      setRecordToDelete(null);
      setSelectedYear(new Date().getFullYear());
      setCurrentMonth(new Date());
    } else if (employee) {
      setEditedLeaveTaken(leaveTaken.toString());
    }
  }, [isOpen, employee, leaveTaken]);

  useEffect(() => {
    if (selectedYear !== 'all' && selectedYear !== currentMonth.getFullYear()) {
      const newMonth = new Date(currentMonth);
      newMonth.setFullYear(selectedYear);
      setCurrentMonth(newMonth);
    }
  }, [selectedYear]);
  
  const filteredLeaveHistory = useMemo(() => {
    if (!employee?.leaveHistory) return [];
    return (employee.leaveHistory as LeaveRecord[])
      .filter((record: LeaveRecord) => selectedYear === 'all' || getYear(parseISO(record.date)) === selectedYear)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [employee?.leaveHistory, selectedYear]);

  const recordedLeaveDates = useMemo(() => {
    if (!employee?.leaveHistory) return new Set<string>();
    const dates: string[] = [];
    (employee.leaveHistory as LeaveRecord[]).forEach((record: LeaveRecord) => {
      if (record.allDates && record.allDates.length > 0) {
        record.allDates.forEach((d: string) => dates.push(format(parseISO(d), 'yyyy-MM-dd')));
      } else if (record.date) {
        dates.push(format(parseISO(record.date), 'yyyy-MM-dd'));
      }
    });
    return new Set(dates);
  }, [employee?.leaveHistory]);

  const absentDates = useMemo(() => {
    if (!employee || !attendanceRecords.length) return [];
    
    // We only care about dates where status is specifically 'Absent'
    // or dates that are in the past, not weekends, and have no attendance record.
    const absences: Date[] = [];
    const today = new Date();
    const joiningDate = employee.joiningDate ? new Date(employee.joiningDate) : new Date(0);
    
    const attendedDates = new Set(
      attendanceRecords
        .filter(r => r.employeeId === employee.userId)
        .map(r => format(parseISO(r.date), 'yyyy-MM-dd'))
    );
    
    const weekendDayIndexes = weekendDays.map(day => 
      ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(day)
    );

    // Filter attendance records that are explicitly 'Absent'
    attendanceRecords.forEach(r => {
      const dateKey = format(parseISO(r.date), 'yyyy-MM-dd');
      if (r.employeeId === employee.userId && r.status === 'Absent' && !recordedLeaveDates.has(dateKey)) {
        absences.push(parseISO(r.date));
      }
    });

    // Check for gaps in the last 2 years (same as AttendancePage fetch range)
    const startDate = new Date(today);
    startDate.setFullYear(today.getFullYear() - 2);
    const actualStartDate = joiningDate > startDate ? joiningDate : startDate;

    let curr = startOfDay(actualStartDate);
    const end = startOfDay(today);

    while (curr <= end) {
      const dateKey = format(curr, 'yyyy-MM-dd');
      const dayOfWeek = curr.getDay();
      
      if (!attendedDates.has(dateKey) && !weekendDayIndexes.includes(dayOfWeek) && !recordedLeaveDates.has(dateKey)) {
        // Double check it's not already in absences
        if (!absences.some(d => isSameDay(d, curr))) {
            absences.push(new Date(curr));
        }
      }
      curr = new Date(curr.getTime() + 24 * 60 * 60 * 1000);
    }

    return absences;
  }, [employee, attendanceRecords, weekendDays, recordedLeaveDates]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    const days = selectedDates?.length || 0;
    if (days <= 0) {
      toast({ title: "Validation Error", description: "Please select at least one leave date.", variant: "destructive" });
      return;
    }
    if (!leaveReason.trim()) {
      toast({ title: "Validation Error", description: "A reason for the leave is required.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    
    const newLeaveRecord: Omit<LeaveRecord, 'id'> = {
      date: format(selectedDates![0], "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"),
      allDates: selectedDates!.map(d => format(d, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")).sort(),
      days,
      reason: leaveReason.trim(),
      recordedByUserId: currentUser.id,
      recordedByUserName: currentUser.name,
    };
    
    const finalLeaveTaken = editedLeaveTaken !== leaveTaken.toString() ? parseInt(editedLeaveTaken, 10) : undefined;
    
    const result = await addLeaveRecordAction(employee.id, newLeaveRecord, finalLeaveTaken);
    setIsSubmitting(false);

    if (result.success) {
      toast({ title: "Leave Recorded", description: `${days} day(s) of leave recorded for ${employee.name}.` });
      onLeaveUpdated();
      onOpenChange(false);
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };

  const handleConfirmDelete = async () => {
    if (!employee || !recordToDelete) return;
    setIsDeleting(true);
    const result = await deleteLeaveRecordAction(employee.id, recordToDelete.id);
    setIsDeleting(false);
    setRecordToDelete(null);
    if (result.success) {
        toast({ title: "History Deleted", description: "The leave record has been removed." });
        onLeaveUpdated();
        onOpenChange(false); 
    } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };
  

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Leave for {employee?.name}</DialogTitle>
            <div className="flex items-center justify-between mt-1.5">
              <DialogDescription className="text-sm text-muted-foreground mr-4">
                View and record leave for this employee.
              </DialogDescription>
              <Select value={selectedYear.toString()} onValueChange={val => setSelectedYear(val === 'all' ? 'all' : parseInt(val))}>
                <SelectTrigger className="w-[110px] h-7 text-[11px] font-bold uppercase tracking-wider border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-[11px] font-bold">All Time</SelectItem>
                  {years.map(y => (
                    <SelectItem key={y} value={y.toString()} className="text-[11px] font-bold">{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-3 gap-0 py-6 px-2 bg-[#f0f2f5] rounded-xl border border-slate-100 mb-6">
              <div className="flex flex-col items-center justify-center border-r border-slate-200">
                <Label className="text-[11px] text-[#919db1] uppercase font-bold tracking-[0.05em] mb-3 leading-none">Accrued</Label>
                <div className="text-[24px] font-bold text-[#1a1f2c] leading-none h-[24px] flex items-center justify-center">
                  {displayAccrued}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center border-r border-slate-200 px-1">
                <Label htmlFor="leave-taken-edit" className="text-[11px] text-[#919db1] uppercase font-bold tracking-[0.05em] mb-3 leading-none cursor-pointer">Taken</Label>
                <div className="h-[24px] w-full flex items-center justify-center">
                  <input
                    id="leave-taken-edit"
                    name="leaveTaken"
                    type="number"
                    value={editedLeaveTaken}
                    onChange={e => setEditedLeaveTaken(e.target.value)}
                    className="h-full w-full p-0 m-0 border-none bg-transparent text-center text-[24px] font-bold text-[#e11d48] leading-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    readOnly={!canAdminEdit || selectedYear !== 'all'}
                    title={selectedYear !== 'all' ? "Switch to 'All Time' to edit total leave taken" : ""}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="flex flex-col items-center justify-center">
                <Label className="text-[11px] text-[#919db1] uppercase font-bold tracking-[0.05em] mb-3 leading-none">Available</Label>
                <div className={cn("text-[24px] font-bold leading-none h-[24px] flex items-center justify-center", availableLeave < 0 ? "text-[#e11d48]" : "text-[#059669]")}>
                  {availableLeave}
                </div>
              </div>
            </div>
            
            <Separator />

            <div className="flex justify-between items-center">
                 <h4 className="text-md font-semibold flex items-center">
                    <ClipboardList className="mr-2 h-5 w-5 text-primary" />
                    Leave History
                </h4>
            </div>
            <ScrollArea className="h-40 border rounded-md p-2 bg-muted/50">
              {filteredLeaveHistory.length > 0 ? (
                  filteredLeaveHistory.map(record => (
                        <div
                          key={record.id}
                          className="text-sm p-1.5 border-b last:border-b-0 hover:bg-muted/80 rounded-sm"
                          onDoubleClick={() => canAdminEdit && setRecordToDelete(record)}
                          title={canAdminEdit ? "Double-click to delete" : ""}
                        >
                          <p>
                            <span className="font-semibold text-primary/80">{record.days} day(s)</span> on{' '}
                            <span className="font-medium">
                              {record.allDates && record.allDates.length > 0 
                                ? record.allDates.map((d: string, i: number) => {
                                    const dateObj = parseISO(d);
                                    const isLast = i === record.allDates!.length - 1;
                                    const showYear = isLast;
                                    return format(dateObj, showYear ? 'd MMM, yyyy' : 'd MMM') + (isLast ? '' : ', ');
                                  }).join('')
                                : format(parseISO(record.date), 'd MMM, yyyy')}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground italic leading-tight mt-0.5">Reason: {record.reason}</p>
                        </div>
                  ))
              ) : (
                  <div className="text-center text-sm text-muted-foreground py-10">No leave history recorded.</div>
              )}
            </ScrollArea>
            
            <Separator />

            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <h4 className="text-md font-semibold flex items-center">
                <PlusCircle className="mr-2 h-5 w-5 text-primary" />
                Record New Leave
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Leave Dates *</Label>
                  <Popover>
                      <PopoverTrigger asChild>
                          <Button
                              variant="outline"
                              className={cn("w-full justify-start text-left font-normal h-10 px-3", !selectedDates?.length && "text-muted-foreground")}
                          >
                              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                              {selectedDates?.length ? (
                                  <span className="truncate">{selectedDates.length} date(s)</span>
                              ) : (
                                  <span>Pick dates</span>
                              )}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                              mode="multiple"
                              selected={selectedDates}
                              onSelect={setSelectedDates}
                              month={currentMonth}
                              onMonthChange={setCurrentMonth}
                              initialFocus
                              disabled={(date) => {
                                // Joining date check
                                const isBeforeJoining = employee?.joiningDate ? isBefore(date, startOfDay(new Date(employee.joiningDate))) : false;
                                if (isBeforeJoining) return true;

                                // Preserve function: Allow selecting future dates
                                const today = startOfDay(new Date());
                                const isFuture = isAfter(startOfDay(date), today);
                                if (isFuture) return false;

                                // Don't allow selecting dates that already have leave recorded
                                const dateKey = format(date, 'yyyy-MM-dd');
                                if (recordedLeaveDates.has(dateKey)) return true;

                                // For past dates (including today), only allow "absent" dates
                                const isAbsent = absentDates.some(absentDate => isSameDay(absentDate, date));
                                return !isAbsent;
                              }}
                              modifiers={{
                                absent: (date) => absentDates.some(d => isSameDay(d, date)),
                                recorded: (date) => recordedLeaveDates.has(format(date, 'yyyy-MM-dd'))
                              }}
                              modifiersClassNames={{
                                absent: "bg-red-50 text-red-600 font-bold hover:bg-red-100",
                                recorded: "bg-green-100 text-green-700 font-bold opacity-100"
                              }}
                          />
                      </PopoverContent>
                  </Popover>
                </div>
                
                 <div className="space-y-1">
                    <Label htmlFor="leave-reason">Reason *</Label>
                    <Input 
                      id="leave-reason" 
                      value={leaveReason} 
                      onChange={(e) => setLeaveReason(e.target.value)} 
                      required 
                      placeholder="e.g., Sick"
                      className="h-10"
                    />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting || !selectedDates || selectedDates.length === 0 || !leaveReason}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording...</> : "Record Leave"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
      
      {recordToDelete && (
          <AlertDialog open={!!recordToDelete} onOpenChange={() => setRecordToDelete(null)}>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-6 w-6 text-destructive" />
                          Delete Leave Entry?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                          Are you sure you want to delete the <span className="font-semibold">{recordToDelete.days} day(s)</span> leave record from <span className="font-semibold">{format(parseISO(recordToDelete.date), 'd MMM, yyyy')}</span>? This will automatically update the total leave taken.
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setRecordToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                          {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin mr-2"/>Deleting...</> : "Yes, Delete"}
                      </AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
      )}
    </>
  );
}
