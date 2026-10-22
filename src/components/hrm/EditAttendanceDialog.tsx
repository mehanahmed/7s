"use client";

import React, { useState, useEffect } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { saveAttendanceAction } from '@/app/(app)/hrm/attendance/actions';
import type { AttendanceStatus, User } from '@/types';
import { format, parseISO, set, isValid } from 'date-fns';

interface EditAttendanceDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAttendanceSaved: () => void;
  attendance: any | null;
}

export function EditAttendanceDialog({ isOpen, onOpenChange, onAttendanceSaved, attendance }: EditAttendanceDialogProps) {
  const [status, setStatus] = useState<AttendanceStatus>('On Time');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && attendance) {
      // Placeholder rows (no saved record) have no check-in time; default them to On Time
      const initialStatus = attendance.checkInTime ? attendance.status : 'On Time';
      setStatus(initialStatus as AttendanceStatus);

      if (attendance.checkInTime) {
        try {
          setCheckInTime(format(parseISO(attendance.checkInTime), 'HH:mm'));
        } catch (e) {
          setCheckInTime('09:00');
        }
      } else {
        setCheckInTime('09:00');
      }

      if (attendance.checkOutTime) {
        try {
          setCheckOutTime(format(parseISO(attendance.checkOutTime), 'HH:mm'));
        } catch (e) {
          setCheckOutTime('');
        }
      } else {
        setCheckOutTime('');
      }
    }
  }, [isOpen, attendance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendance) return;

    setIsSubmitting(true);

    const attDate = attendance.date instanceof Date ? attendance.date : parseISO(attendance.date);

    const createIso = (timeStr: string) => {
      if (!timeStr) return null;
      const [hours, minutes] = timeStr.split(':').map(Number);
      const dateWithTime = set(attDate, { hours, minutes, seconds: 0, milliseconds: 0 });
      return dateWithTime.toISOString();
    };

    const finalCheckIn = createIso(checkInTime);
    const finalCheckOut = createIso(checkOutTime);

    let hoursWorked = null;
    if (finalCheckIn && finalCheckOut) {
      const diffMs = new Date(finalCheckOut).getTime() - new Date(finalCheckIn).getTime();
      if (diffMs > 0) {
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        hoursWorked = `${String(diffHrs).padStart(2, '0')}:${String(diffMins).padStart(2, '0')}`;
      }
    }

    const payload = {
      date: format(attDate, 'yyyy-MM-dd'),
      checkInTime: finalCheckIn!,
      checkOutTime: finalCheckOut,
      status: status,
      hoursWorked: hoursWorked,
      location: attendance.location || 'Manual Entry',
      checkInLocation: attendance.checkInLocation,
      checkOutLocation: attendance.checkOutLocation,
    };

    const targetUser = {
      id: attendance.employeeId,
      name: attendance.employeeName,
    } as User;

    const result = await saveAttendanceAction(targetUser, payload);
    setIsSubmitting(false);

    if (result.success) {
      toast({ title: "Success", description: "Attendance record has been saved." });
      onAttendanceSaved();
      onOpenChange(false);
    } else {
      toast({ title: "Error", description: result.error || "Failed to save attendance.", variant: "destructive" });
    }
  };

  const displayDate = attendance ? (attendance.date instanceof Date ? attendance.date : parseISO(attendance.date)) : new Date();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Attendance</DialogTitle>
          <DialogDescription>
            Modify attendance for {attendance?.employeeName} on {isValid(displayDate) ? format(displayDate, 'PPP') : ''}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="py-4 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="att-status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as AttendanceStatus)}>
              <SelectTrigger id="att-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="On Time">On Time</SelectItem>
                <SelectItem value="Late">Late</SelectItem>
                <SelectItem value="Absent">Absent</SelectItem>
                <SelectItem value="Paid Leave">Paid Leave</SelectItem>
                <SelectItem value="Weekend">Weekend</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="att-checkin">Check-In Time</Label>
              <Input id="att-checkin" type="time" value={checkInTime} onChange={e => setCheckInTime(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="att-checkout">Check-Out Time</Label>
              <Input id="att-checkout" type="time" value={checkOutTime} onChange={e => setCheckOutTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
