

"use server";

import { revalidatePath } from "next/cache";
import type { TrackingLink, User, OrderLogEntry, CustomStatus, UserRole } from "@/types";
import { updateOrder, getOrderById, autoSettleOrderIfDelivered } from "@/lib/order-service";
import { getStatusById } from "@/lib/status-service";
import { DELIVERED_STATUS_ID } from "@/lib/status-constants";
import { v4 as uuidv4 } from 'uuid';
import { guard } from '@/lib/guard';
import { isDrRole, isAssignedTo } from '@/lib/roles';

export async function updateTrackingLinkAction(
  orderId: string,
  updates: {
    isPublic?: boolean;
    currentStatus?: string;
    statusNotes?: string;
  },
  currentUser: User
): Promise<TrackingLink | { error: string }> {
  await guard();
  if (!currentUser || !currentUser.id || !currentUser.name) {
    return { error: "Current user information is missing." };
  }

  try {
    const currentOrder = await getOrderById(orderId);
    if (!currentOrder) {
      return { error: `Order ${orderId} not found.` };
    }

    if (currentUser.role === 'CR' && currentOrder.crmUserId !== currentUser.id) {
      return { error: "Permission Denied: CRMs can only modify orders assigned to them." };
    }
    if (isDrRole(currentUser.role) && !isAssignedTo(currentOrder, currentUser.id)) {
      return { error: "Permission Denied: Designer Representatives can only modify orders assigned to them." };
    }

    const dataToUpdate: Partial<TrackingLink> = {};
    let newLogEntries: OrderLogEntry[] = [];
    let statusChangedToDelivered = false;

    if (updates.isPublic !== undefined && updates.isPublic !== currentOrder.isPublic) {
      dataToUpdate.isPublic = updates.isPublic;
    }

    if (updates.currentStatus && updates.currentStatus !== currentOrder.currentStatus) {
      if (currentUser.role !== 'SYSTEM_ADMIN') {
        const targetStatus = await getStatusById(updates.currentStatus);
        if (!targetStatus) {
          return { error: `Status with ID ${updates.currentStatus} not found.` };
        }
        if (targetStatus.allowedRoles && targetStatus.allowedRoles.length > 0 && !targetStatus.allowedRoles.includes(currentUser.role)) {
          return { error: `You do not have permission to set the order to "${targetStatus.name}".` };
        }
      }

      dataToUpdate.currentStatus = updates.currentStatus;
      if (updates.currentStatus === DELIVERED_STATUS_ID) {
        statusChangedToDelivered = true;
      }

      const newStatusObject = await getStatusById(updates.currentStatus);
      const newStatusName = newStatusObject ? newStatusObject.name : updates.currentStatus;

      let logNotes = `Status changed to ${newStatusName}.`;
      if (updates.statusNotes && updates.statusNotes.trim() !== "") {
        logNotes = updates.statusNotes.trim();
      }

      newLogEntries.push({
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        status: updates.currentStatus,
        changedByUserId: currentUser.id,
        changedByUserName: currentUser.name,
        notes: logNotes,
      });
    }

    if (newLogEntries.length > 0) {
      dataToUpdate.statusHistory = [...currentOrder.statusHistory, ...newLogEntries];
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return currentOrder;
    }

    const success = await updateOrder(orderId, dataToUpdate);
    if (!success) {
      return { error: "Failed to update tracking link in the database." };
    }

    if (statusChangedToDelivered) {
      await autoSettleOrderIfDelivered(orderId, `System auto-settled: Status changed to '${DELIVERED_STATUS_ID}'.`, currentUser);
    }

    revalidatePath("/(app)/all-orders");
    revalidatePath(`/track/${orderId}`);
    revalidatePath("/(app)/dashboard");
    revalidatePath("/(app)/active-orders");

    const updatedOrder = await getOrderById(orderId);
    if (!updatedOrder) {
      return { error: "Failed to retrieve updated order after update." };
    }
    return updatedOrder;

  } catch (error) {
    console.error("Error in updateTrackingLinkAction:", error);
    return { error: error instanceof Error ? error.message : "An unexpected error occurred while updating the tracking link." };
  }
}
