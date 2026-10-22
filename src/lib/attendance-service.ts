

"use server";

import { query } from './mysql';
import type { AttendanceRecord, User, AttendanceStatus } from '@/types';
import { format, isToday, parseISO } from 'date-fns';

const ATTENDANCE_TABLE = 'attendance_records';
const MARK_TABLE = 'attendance_marks';

const safeParse = (str: any) => {
  if (typeof str !== 'string') return str;
  if (!str || str === 'null') return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
};

export const getAttendanceForMonth = async (date: Date): Promise<AttendanceRecord[]> => {
  const monthStart = format(date, 'yyyy-MM-01');
  const nextMonth = new Date(date);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const monthEnd = format(nextMonth, 'yyyy-MM-01');

  try {
    const results = await query<any[]>(
      `SELECT * FROM ${ATTENDANCE_TABLE} WHERE date >= ? AND date < ? ORDER BY check_in_time DESC`,
      [monthStart, monthEnd]
    );

    return results.map(row => {
      const dbDate = new Date(row.date);
      const dateStr = format(dbDate, 'yyyy-MM-dd');

      // Use "-1 date logic" for records until 2026-02-12 (legacy behavior due to UTC shift)
      // For the rest, use the actual date (new behavior)
      const displayDate = dateStr <= '2026-02-12'
        ? row.date.toISOString().split('T')[0]
        : dateStr;

      return {
        id: row.id,
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        date: displayDate,
        checkInTime: row.check_in_time.toISOString(),
        checkOutTime: row.check_out_time ? row.check_out_time.toISOString() : null,
        status: row.status,
        hoursWorked: row.hours_worked,
        lateReason: row.late_reason,
        earlyOutReason: row.early_out_reason,
        location: row.location,
        checkInLocation: safeParse(row.check_in_location),
        checkOutLocation: safeParse(row.check_out_location),
      } as AttendanceRecord;
    });
  } catch (error) {
    console.error(`Error fetching attendance from MySQL:`, error);
    return [];
  }
};

export const getAttendanceForDateRange = async (startDate: Date, endDate: Date): Promise<AttendanceRecord[]> => {
  const start = format(startDate, 'yyyy-MM-dd');
  const end = format(endDate, 'yyyy-MM-dd');

  try {
    const results = await query<any[]>(
      `SELECT * FROM ${ATTENDANCE_TABLE} WHERE date >= ? AND date <= ? ORDER BY check_in_time DESC`,
      [start, end]
    );

    return results.map(row => {
      const dbDate = new Date(row.date);
      const dateStr = format(dbDate, 'yyyy-MM-dd');

      // Use "-1 date logic" for records until 2026-02-12 (legacy behavior due to UTC shift)
      // For the rest, use the actual date (new behavior)
      const displayDate = dateStr <= '2026-02-12'
        ? row.date.toISOString().split('T')[0]
        : dateStr;

      return {
        id: row.id,
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        date: displayDate,
        checkInTime: row.check_in_time.toISOString(),
        checkOutTime: row.check_out_time ? row.check_out_time.toISOString() : null,
        status: row.status,
        hoursWorked: row.hours_worked,
        lateReason: row.late_reason,
        earlyOutReason: row.early_out_reason,
        location: row.location,
        checkInLocation: safeParse(row.check_in_location),
        checkOutLocation: safeParse(row.check_out_location),
      } as AttendanceRecord;
    });
  } catch (error) {
    console.error(`Error fetching attendance from MySQL:`, error);
    return [];
  }
};

export const getAttendancePaginated = async (
  startDate: Date,
  endDate: Date,
  page: number = 1,
  limit: number = 50,
  searchTerm?: string
): Promise<{ records: AttendanceRecord[]; total: number }> => {
  const allRecords = await getAttendanceForDateRange(startDate, endDate);
  let results = Array.from(new Map(allRecords.map(item => [item.id, item])).values());
  if (searchTerm && searchTerm.trim()) {
    const lower = searchTerm.toLowerCase();
    results = results.filter(r =>
      (r.employeeName && r.employeeName.toLowerCase().includes(lower)) ||
      (r.employeeId && r.employeeId.toLowerCase().includes(lower))
    );
  }
  const total = results.length;
  const startIndex = (page - 1) * limit;
  return { records: results.slice(startIndex, startIndex + limit), total };
};

export const addOrUpdateAttendanceRecord = async (recordData: Omit<AttendanceRecord, 'id'>): Promise<AttendanceRecord | null> => {
  let finalDate = recordData.date;
  let finalCheckIn = recordData.checkInTime;
  let finalCheckOut = recordData.checkOutTime;

  // Legacy date correction: Records until 2026-02-12 were affected by a UTC shift.
  // To ensure they are updated correctly and displayed properly, we shift them by +1 day during save
  // if their intended display date is 2026-02-11 or earlier.
  if (finalDate <= '2026-02-11') {
    const d = parseISO(finalDate);
    d.setDate(d.getDate() + 1);
    finalDate = format(d, 'yyyy-MM-dd');

    const dIn = parseISO(finalCheckIn);
    dIn.setDate(dIn.getDate() + 1);
    finalCheckIn = dIn.toISOString();

    if (finalCheckOut) {
      const dOut = parseISO(finalCheckOut);
      dOut.setDate(dOut.getDate() + 1);
      finalCheckOut = dOut.toISOString();
    }
  }

  const documentId = `${recordData.employeeId}_${finalDate}`;

  try {
    const checkInTime = format(parseISO(finalCheckIn), 'yyyy-MM-dd HH:mm:ss');
    const checkOutTime = finalCheckOut ? format(parseISO(finalCheckOut), 'yyyy-MM-dd HH:mm:ss') : null;
    const date = finalDate; // already YYYY-MM-DD

    await query(
      `INSERT INTO ${ATTENDANCE_TABLE} (id, employee_id, employee_name, date, check_in_time, check_out_time, status, hours_worked, late_reason, early_out_reason, location, check_in_location, check_out_location) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       employee_name = VALUES(employee_name), 
       check_in_time = VALUES(check_in_time), 
       check_out_time = VALUES(check_out_time), 
       status = VALUES(status), 
       hours_worked = VALUES(hours_worked), 
       late_reason = VALUES(late_reason), 
       early_out_reason = VALUES(early_out_reason), 
       location = VALUES(location), 
       check_in_location = VALUES(check_in_location), 
       check_out_location = VALUES(check_out_location)`,
      [
        documentId, recordData.employeeId, recordData.employeeName, date, checkInTime, checkOutTime,
        recordData.status, recordData.hoursWorked, recordData.lateReason, recordData.earlyOutReason,
        recordData.location, JSON.stringify(recordData.checkInLocation || null), JSON.stringify(recordData.checkOutLocation || null)
      ]
    );

    return { id: documentId, ...recordData } as AttendanceRecord;
  } catch (error) {
    console.error(`Error adding/updating attendance record in MySQL:`, error);
    if (error instanceof Error) throw error;
    return null;
  }
};

export const getAttendanceMark = async (userId: string): Promise<{ status: 'Checked In' | 'Checked Out', lastCheckInTime: string | null, lastCheckOutTime: string | null, attendanceStatus: AttendanceStatus, date: string, checkInLocation?: { lat: number; lng: number; } } | null> => {
  if (!userId) return null;
  try {
    const results = await query<any[]>(`SELECT * FROM ${MARK_TABLE} WHERE user_id = ?`, [userId]);
    if (results.length > 0) {
      const row = results[0];
      // Check if the mark is from today
      if (row.date && isToday(row.date)) {
        return {
          status: row.status,
          lastCheckInTime: row.last_check_in_time ? row.last_check_in_time.toISOString() : null,
          lastCheckOutTime: row.last_check_out_time ? row.last_check_out_time.toISOString() : null,
          attendanceStatus: row.attendance_status,
          date: format(new Date(row.date), 'yyyy-MM-dd'),
          checkInLocation: safeParse(row.check_in_location),
        };
      }
    }
    return null;
  } catch (error) {
    console.error(`Error fetching attendance mark from MySQL for user ${userId}:`, error);
    return null;
  }
};

export const setAttendanceMark = async (userId: string, data: any): Promise<boolean> => {
  if (!userId) return false;
  try {
    const checkInTime = data.lastCheckInTime ? format(parseISO(data.lastCheckInTime), 'yyyy-MM-dd HH:mm:ss') : null;
    const checkOutTime = data.lastCheckOutTime ? format(parseISO(data.lastCheckOutTime), 'yyyy-MM-dd HH:mm:ss') : null;
    const date = data.date || format(new Date(), 'yyyy-MM-dd');

    await query(
      `INSERT INTO ${MARK_TABLE} (user_id, status, last_check_in_time, last_check_out_time, attendance_status, check_in_location, date) 
             VALUES (?, ?, ?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             status = VALUES(status), 
             last_check_in_time = VALUES(last_check_in_time), 
             last_check_out_time = VALUES(last_check_out_time), 
             attendance_status = VALUES(attendance_status), 
             check_in_location = VALUES(check_in_location), 
             date = VALUES(date)`,
      [
        userId, data.status, checkInTime, checkOutTime,
        data.attendanceStatus, JSON.stringify(data.checkInLocation || null), date
      ]
    );
    return true;
  } catch (error) {
    console.error(`Error setting attendance mark in MySQL for user ${userId}:`, error);
    return false;
  }
};

export const saveAttendanceAction = async (
  currentUser: User,
  recordData: Partial<Omit<AttendanceRecord, 'id' | 'employeeId' | 'employeeName'>>
): Promise<{ success: boolean; error?: string }> => {
  if (!currentUser?.id) {
    return { success: false, error: "User not authenticated." };
  }
  if (currentUser?.isBanned) {
    return { success: false, error: "Your account is banned. Attendance access denied." };
  }

  if (!recordData.checkInTime) {
    return { success: false, error: "Check-in time is missing." };
  }

  const fullRecordData: Omit<AttendanceRecord, 'id'> = {
    employeeId: currentUser.id,
    employeeName: currentUser.name,
    date: recordData.date || recordData.checkInTime.split('T')[0],
    checkInTime: recordData.checkInTime,
    status: recordData.status || 'On Time',
    checkOutTime: recordData.checkOutTime || null,
    hoursWorked: recordData.hoursWorked || null,
    lateReason: recordData.lateReason || null,
    earlyOutReason: recordData.earlyOutReason || null,
    location: recordData.location || 'Unknown',
    checkInLocation: recordData.checkInLocation,
    checkOutLocation: recordData.checkOutLocation,
  };

  try {
    // Save historical record
    const historyResult = await addOrUpdateAttendanceRecord(fullRecordData);
    if (!historyResult) {
      return { success: false, error: "Failed to save historical attendance record." };
    }

    // Save current day mark
    const markData = {
      date: fullRecordData.date,
      status: recordData.checkOutTime ? 'Checked Out' : 'Checked In',
      lastCheckInTime: recordData.checkInTime,
      lastCheckOutTime: recordData.checkOutTime || null,
      attendanceStatus: recordData.status || 'On Time',
      checkInLocation: recordData.checkInLocation,
    };
    const markResult = await setAttendanceMark(currentUser.id, markData);
    if (!markResult) {
      console.warn(`[saveAttendanceAction] Historical record saved, but failed to save current day mark for user ${currentUser.id}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Error in saveAttendanceAction:", error);
    return { success: false, error: "An unexpected server error occurred." };
  }
};

export const deleteAttendanceRecord = async (employeeId: string, date: string): Promise<boolean> => {
    try {
        const documentId = `${employeeId}_${date}`;
        await query(`DELETE FROM ${ATTENDANCE_TABLE} WHERE id = ?`, [documentId]);
        return true;
    } catch (error) {
        console.error(`Error deleting attendance record ${employeeId}_${date}:`, error);
        return false;
    }
};
