
"use server";

import { revalidatePath } from "next/cache";
import type { CustomStatus, UserRole } from "@/types";
import { addStatus, updateStatus, deleteStatus, getDeletedStatuses, permanentDeleteStatus, restoreStatus } from '@/lib/status-service';
import { guard, requireRole } from '@/lib/guard';

export async function addStatusAction(
  name: string, 
  color: string, 
  isVisible: boolean,
  allowedRoles: UserRole[],
  isSystemStatus?: boolean
): Promise<{ success: boolean; status?: CustomStatus; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const newStatus = await addStatus(name, color, isVisible, allowedRoles, isSystemStatus);
    if (newStatus) {
      revalidatePath("/(app)/admin/statuses");
      revalidatePath("/(app)/orders"); 
      revalidatePath("/(app)/all-orders"); 
      return { success: true, status: newStatus };
    }
    return { success: false, error: "Failed to add status to database." };
  } catch (error) {
    console.error("Error in addStatusAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred while adding status." };
  }
}

export async function updateStatusAction(
  id: string, 
  name: string, 
  color: string, 
  isVisible: boolean,
  allowedRoles: UserRole[],
  actingUserRole: UserRole,
  isSystemStatus?: boolean
): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await updateStatus(id, name, color, isVisible, allowedRoles, actingUserRole, isSystemStatus);
    if (success) {
      revalidatePath("/(app)/admin/statuses");
      revalidatePath("/(app)/orders");
      revalidatePath("/(app)/all-orders");
      revalidatePath("/track/[trackingId]", "layout"); 
      return { success: true };
    }
    return { success: false, error: "Failed to update status in database." };
  } catch (error) {
    console.error("Error in updateStatusAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred while updating status." };
  }
}

export async function deleteStatusAction(id: string, actingUserRole: UserRole): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await deleteStatus(id, actingUserRole);
    if (success) {
      revalidatePath("/(app)/admin/statuses");
      revalidatePath("/(app)/orders");
      revalidatePath("/(app)/all-orders");
      return { success: true };
    }
    return { success: false, error: "Failed to delete status from database." };
  } catch (error) {
    console.error("Error in deleteStatusAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred while deleting status." };
  }
}

export async function getDeletedStatusesAction(): Promise<{ success: boolean; statuses?: CustomStatus[]; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const statuses = await getDeletedStatuses();
    return { success: true, statuses };
  } catch (error) {
    console.error("Error in getDeletedStatusesAction server action:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch deleted statuses." };
  }
}

export async function permanentDeleteStatusAction(id: string, actingUserRole: UserRole): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await permanentDeleteStatus(id, actingUserRole);
    if (success) {
      revalidatePath("/(app)/admin/statuses");
      revalidatePath("/(app)/orders");
      revalidatePath("/(app)/all-orders");
      return { success: true };
    }
    return { success: false, error: "Failed to permanently delete status." };
  } catch (error) {
    console.error("Error in permanentDeleteStatusAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function restoreStatusAction(id: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await restoreStatus(id);
    if (success) {
      revalidatePath("/(app)/admin/statuses");
      revalidatePath("/(app)/orders");
      revalidatePath("/(app)/all-orders");
      return { success: true };
    }
    return { success: false, error: "Failed to restore status." };
  } catch (error) {
    console.error("Error in restoreStatusAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}
