

"use server";

import { revalidatePath } from "next/cache";
import { setReportProductFilters } from "@/lib/settings-service";
import type { TaskEntry } from '@/types';
import { updateTaskEntry, deleteTaskEntry as deleteTaskEntryFromDb, getTaskEntries } from '@/lib/team-performance-service';
import { getOrders } from "@/lib/order-service";
import { getGlobalSettings } from "@/lib/settings-service";
import { getUsers } from "@/lib/user-service";
import { guard } from '@/lib/guard';

export async function getReportDataAction() {
  await guard();
  const [orders, settings, users, tasks] = await Promise.all([
    getOrders(),
    getGlobalSettings(),
    getUsers(),
    getTaskEntries(),
  ]);
  return { orders, settings, users, tasks };
}


export async function updateReportFiltersAction(filters: string[]): Promise<{ success: boolean; error?: string }> {
  await guard();
  try {
    const success = await setReportProductFilters(filters);
    if (success) {
      revalidatePath("/(app)/report");
      return { success: true };
    }
    return { success: false, error: "Failed to save filters to the database." };
  } catch (error) {
    console.error("Error in updateReportFiltersAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateTaskEntryAction(
  taskId: string,
  updates: Partial<Omit<TaskEntry, 'id' | 'userId' | 'userName' | 'role' | 'createdAt'>>
): Promise<{ success: boolean; error?: string }> {
  await guard();
  try {
    const success = await updateTaskEntry(taskId, updates);
    if (success) {
      revalidatePath("/(app)/report");
      return { success: true };
    }
    return { success: false, error: "Failed to update task entry in database." };
  } catch (error) {
    console.error("Error in updateTaskEntryAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected server error occurred." };
  }
}

export async function deleteTaskEntryAction(taskId: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  try {
    const success = await deleteTaskEntryFromDb(taskId);
    if (success) {
      revalidatePath("/(app)/report");
      return { success: true };
    }
    return { success: false, error: "Failed to delete task entry from database." };
  } catch (error) {
    console.error("Error in deleteTaskEntryAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected server error occurred." };
  }
}
