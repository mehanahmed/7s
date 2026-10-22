"use server";

import type { User, AttendanceRecord } from '@/types';
import { addOrUpdateAttendanceRecord } from '@/lib/attendance-service';
import { query } from '@/lib/mysql';

export interface UserLeaveRecord {
  id: string;
  date: string;
  allDates?: string[];
  days: number;
  reason: string;
  status: 'Approved' | 'Paid Leave' | 'Pending';
}

export interface UserLeaveData {
  totalQuota: number;
  takenDays: number;
  availableDays: number;
  records: UserLeaveRecord[];
}

export async function getUserLeaveHistoryAction(userId: string): Promise<UserLeaveData> {
  if (!userId) {
    return { totalQuota: 14, takenDays: 0, availableDays: 14, records: [] };
  }

  try {
    let employeeData: any = null;
    const empRows = await query<any[]>(
      `SELECT id, data_json FROM employees WHERE user_id = ?`,
      [userId]
    );

    if (empRows.length > 0) {
      const raw = empRows[0].data_json;
      employeeData = typeof raw === 'string' ? JSON.parse(raw) : raw;
    }

    const leaveHistory: any[] = employeeData?.leaveHistory || [];
    const yearlyQuota: number = typeof employeeData?.yearlyLeave === 'number' ? employeeData.yearlyLeave : 14;

    // Also fetch attendance records marked as Paid Leave
    const attRows = await query<any[]>(
      `SELECT id, date, check_in_time, status, late_reason FROM attendance_records WHERE employee_id = ? AND status = 'Paid Leave' ORDER BY date DESC`,
      [userId]
    );

    const mergedRecords: UserLeaveRecord[] = [];
    const recordedDates = new Set<string>();

    for (const item of leaveHistory) {
      const dates = item.allDates && item.allDates.length > 0 ? item.allDates : [item.date];
      dates.forEach((d: string) => {
        if (d) recordedDates.add(String(d).split('T')[0]);
      });
      mergedRecords.push({
        id: item.id || `leave-${item.date || Math.random()}`,
        date: item.date,
        allDates: item.allDates,
        days: typeof item.days === 'number' ? item.days : 1,
        reason: item.reason || 'Leave',
        status: 'Approved',
      });
    }

    for (const att of attRows) {
      const dateOnly = (att.date instanceof Date ? att.date.toISOString() : String(att.date)).split('T')[0];
      if (!recordedDates.has(dateOnly)) {
        recordedDates.add(dateOnly);
        mergedRecords.push({
          id: String(att.id || `att-${dateOnly}`),
          date: dateOnly,
          days: 1,
          reason: att.late_reason || 'Paid Leave',
          status: 'Paid Leave',
        });
      }
    }

    // Sort newest first
    mergedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const takenDays = typeof employeeData?.leaveTaken === 'number'
      ? employeeData.leaveTaken
      : mergedRecords.reduce((sum, r) => sum + (r.days || 1), 0);

    const availableDays = Math.max(0, yearlyQuota - takenDays);

    return {
      totalQuota: yearlyQuota,
      takenDays,
      availableDays,
      records: mergedRecords,
    };
  } catch (error) {
    console.error("Error in getUserLeaveHistoryAction:", error);
    return { totalQuota: 14, takenDays: 0, availableDays: 14, records: [] };
  }
}

// This is a new action to save attendance records.
export async function saveAttendanceAction(
  currentUser: User,
  recordData: Partial<Omit<AttendanceRecord, 'id' | 'employeeId' | 'employeeName'>> & { checkInTime: string }
): Promise<{ success: boolean; error?: string }> {
  if (!currentUser?.id) {
    return { success: false, error: "User not authenticated." };
  }
  if (currentUser?.isBanned) {
    return { success: false, error: "Your account is banned. Attendance access denied." };
  }

  const fullRecordData: Omit<AttendanceRecord, 'id'> = {
    employeeId: currentUser.id,
    employeeName: currentUser.name,
    date: recordData.checkInTime.split('T')[0], // YYYY-MM-DD from ISO string
    checkInTime: recordData.checkInTime,
    status: recordData.status || 'On Time', // Default status
    checkOutTime: recordData.checkOutTime || null,
    hoursWorked: recordData.hoursWorked || null,
    lateReason: recordData.lateReason || null,
    earlyOutReason: recordData.earlyOutReason || null,
    location: recordData.location || 'Unknown',
    checkInLocation: recordData.checkInLocation || undefined,
    checkOutLocation: recordData.checkOutLocation || undefined,
  };

  try {
    const result = await addOrUpdateAttendanceRecord(fullRecordData);
    if (result) {
      return { success: true };
    }
    return { success: false, error: "Failed to save attendance record." };
  } catch (error) {
    console.error("Error in saveAttendanceAction:", error);
    return { success: false, error: "An unexpected server error occurred." };
  }
}
