

"use server";

import { revalidatePath } from "next/cache";
import { addOfficeTime, updateOfficeTime, deleteOfficeTime } from "@/lib/office-time-service";
import type { OfficeTime, User, AttendanceRecord, UserRole } from "@/types";
import { saveAttendanceAction as saveAttendanceServiceAction } from '@/lib/attendance-service';
import { saveWeekendSettings } from "@/lib/weekend-service"; // Import the new service

export async function addOfficeTimeAction(
  officeTimeData: Omit<OfficeTime, 'id'>
): Promise<{ success: boolean; officeTime?: OfficeTime; error?: string }> {
  try {
    const newOfficeTime = await addOfficeTime(officeTimeData);
    if (newOfficeTime) {
      revalidatePath("/(app)/hrm/attendance");
      return { success: true, officeTime: newOfficeTime };
    }
    return { success: false, error: "Failed to add office time to database." };
  } catch (error) {
    console.error("Error in addOfficeTimeAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateOfficeTimeAction(
  officeTimeId: string,
  updates: Partial<Omit<OfficeTime, 'id'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const success = await updateOfficeTime(officeTimeId, updates);
    if (success) {
      revalidatePath("/(app)/hrm/attendance");
      return { success: true };
    }
    return { success: false, error: "Failed to update office time in database." };
  } catch (error) {
    console.error("Error in updateOfficeTimeAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function deleteOfficeTimeAction(officeTimeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const success = await deleteOfficeTime(officeTimeId);
    if (success) {
      revalidatePath("/(app)/hrm/attendance");
      return { success: true };
    }
    return { success: false, error: "Failed to delete office time from database." };
  } catch (error) {
    console.error("Error in deleteOfficeTimeAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

// Renaming the function from the old attendance/actions.ts to avoid conflict
export async function saveAttendanceAction(
  currentUser: User,
  recordData: Partial<Omit<AttendanceRecord, 'id' | 'employeeId' | 'employeeName'>> & { checkInTime: string }
): Promise<{ success: boolean; error?: string }> {
  const result = await saveAttendanceServiceAction(currentUser, recordData);
  if (result.success) {
    revalidatePath("/(app)/hrm/attendance");
  }
  return result;
}

// New action to save weekend settings
export async function saveWeekendSettingsAction(days: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const success = await saveWeekendSettings(days);
    if (success) {
      revalidatePath("/(app)/hrm/attendance");
      return { success: true };
    }
    return { success: false, error: "Failed to save weekend settings to the database." };
  } catch (error) {
    console.error("Error in saveWeekendSettingsAction:", error);
    return { success: false, error: "An unexpected error occurred while saving weekend settings." };
  }
}
