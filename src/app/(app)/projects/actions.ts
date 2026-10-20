
"use server";

import { vatAmountFor } from '@/lib/vat';
import { revalidatePath } from "next/cache";
import type { Project, ProjectStatusType, User, OrderLogEntry, AdvancePaymentRecord, DeliveryPaymentInput, TrackingLink } from "@/types";
import { updateProjectStatus as updateProjectStatusInDb, getProjectById } from '@/lib/project-service';
import { getUserById } from '@/lib/user-service';
import { getOrderById, updateOrder, autoSettleOrderIfDelivered, unsettleOrderPayment } from '@/lib/order-service';

import { v4 as uuidv4 } from 'uuid';
import { getGlobalSettings } from '@/lib/settings-service';
import { sendTelegramMessage } from "@/lib/notification-utils";
import { getIO } from "@/lib/socket-io";
import { getAppUrl } from "@/lib/server-utils";
import { guard } from '@/lib/guard';
import { orderStatusIdForStage, STAGE_ASSIGN_ROLE, PROOF_REQUIRED_STAGES, hasProofInNote, LINK_REQUIRED_STAGES, hasLinkInNote } from '@/lib/project-stages';

const orderDueAmount = (order: TrackingLink): number => {
  const subtotal = (order.orderItems || []).reduce((sum, item) => sum + (item.isGift ? 0 : (Number(item.lineItemTotalPrice) || 0)), 0);
  const net = subtotal - (Number(order.specialClientDiscount) || 0);
  const grandTotal = net + vatAmountFor(net, order.vatPercentage) + (Number(order.shippingCharge) || 0);
  const paid = (order.advancePayments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return Math.max(0, grandTotal - paid);
};

/** Outstanding balance of a project's order, used to decide whether delivery needs a payment first. */
export async function getProjectDueAction(projectId: string): Promise<{ due: number }> {
  await guard();
  const order = await getOrderById(projectId);
  return { due: order ? Math.round(orderDueAmount(order) * 100) / 100 : 0 };
}

export async function updateProjectStatusAction(
  project: Project,
  newStatus: ProjectStatusType,
  actingUser: User,
  notes?: string, // Added optional notes parameter
  deliveryPayment?: DeliveryPaymentInput,
): Promise<{ success: boolean; error?: string }> {
  await guard();
  try {
    const settings = await getGlobalSettings();
    if (actingUser.role !== 'SYSTEM_ADMIN') {
      const permissions = settings.projectStageAccess;
      if (permissions && permissions[newStatus] && !permissions[newStatus].includes(actingUser.role)) {
        return { success: false, error: `You do not have permission to move projects to the '${newStatus}' stage.` };
      }
    }

    // Proof-gated stages: the move is refused unless an uploaded proof came with it (also for admins).
    if (PROOF_REQUIRED_STAGES[newStatus] && project.status !== newStatus && !hasProofInNote(notes)) {
      return { success: false, error: `A proof image is required to move a project to '${newStatus}'.` };
    }

    // Link-gated stages (Script Done, CG Complete, Project Complete): the move is refused without a submitted URL.
    if (LINK_REQUIRED_STAGES[newStatus] && project.status !== newStatus && !hasLinkInNote(notes)) {
      return { success: false, error: `A link is required to move a project to '${newStatus}'.` };
    }

    // Delivering a project that still has a balance needs a payment (amount, method, reference) with the move.
    let paymentRecord: AdvancePaymentRecord | null = null;
    if (newStatus === 'Project Delivered' && project.status !== newStatus) {
      const orderToDeliver = await getOrderById(project.id);
      const due = orderToDeliver ? orderDueAmount(orderToDeliver) : 0;
      if (orderToDeliver && due > 0.01) {
        const amount = Number(deliveryPayment?.amount);
        const method = deliveryPayment?.paymentMethod?.trim();
        const reference = deliveryPayment?.reference?.trim();
        const proofUrl = deliveryPayment?.proofUrl?.trim();
        if (!deliveryPayment || !(amount > 0) || !method || !reference || !proofUrl) {
          return { success: false, error: `Payment required: ${due.toLocaleString('en-US')} is still due. Add method, reference and a payment proof to deliver.` };
        }
        if (amount > due + 0.01) {
          return { success: false, error: `Payment amount cannot exceed the due balance (${due.toLocaleString('en-US')}).` };
        }
        paymentRecord = {
          id: uuidv4(),
          amount,
          date: new Date().toISOString(),
          paymentMethod: method,
          notes: `Delivery payment. Ref: ${reference}`,
          recordedByUserId: actingUser.id,
          recordedByUserName: actingUser.name,
          documentUrl: proofUrl,
          status: 'Approved',
        };
      }
    }

    const originalStatus = project.status; // Capture original status before update
    const projectUpdateSuccess = await updateProjectStatusInDb(project.id, newStatus, project);
    if (!projectUpdateSuccess) {
      return { success: false, error: "Failed to update project status in database." };
    }

    if (paymentRecord) {
      const current = await getOrderById(project.id);
      await updateOrder(project.id, {
        advancePayments: [...(current?.advancePayments || []), paymentRecord],
        updatedAt: new Date().toISOString(),
        updatedByUserId: actingUser.id,
        updatedByUserName: actingUser.name,
      });
    }

    const order = await getOrderById(project.id);
    if (order) {
      let targetOrderStatusId: string | null = null;
      let statusUpdateNote: string | null = null;

      if (originalStatus === 'Project Delivered' && newStatus !== 'Project Delivered') {
        const unsettleReason = `Payment unsettled: Project moved from 'Project Delivered' to '${newStatus}' by ${actingUser.name}.`;
        await unsettleOrderPayment(project.id, unsettleReason, actingUser);
      }

      targetOrderStatusId = orderStatusIdForStage(newStatus) ?? null;
      statusUpdateNote = newStatus === 'On Hold'
        ? `Order put on hold from project board by ${actingUser.name}. Reason: ${notes || 'Not specified.'}`
        : `Order moved to '${newStatus}' via project board by ${actingUser.name}.${notes ? ' ' + notes : ''}`;

      if (targetOrderStatusId && statusUpdateNote && order.currentStatus !== targetOrderStatusId) {
        const newLogEntry: OrderLogEntry = {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          status: targetOrderStatusId,
          changedByUserId: actingUser.id,
          changedByUserName: actingUser.name,
          notes: statusUpdateNote,
        };
        const orderUpdateSuccess = await updateOrder(order.id, {
          currentStatus: targetOrderStatusId,
          statusHistory: [...order.statusHistory, newLogEntry],
          updatedAt: new Date().toISOString(),
          updatedByUserId: actingUser.id,
          updatedByUserName: actingUser.name,
        });

        if (!orderUpdateSuccess) {
          console.warn(`Project ${project.id} status updated to ${newStatus}, but failed to update corresponding order ${order.id} to target status ${targetOrderStatusId}.`);
        } else {
          console.log(`Order ${order.id} status updated to ${targetOrderStatusId} due to project ${project.id} being ${newStatus}.`);
          if (newStatus === 'Project Delivered') {
            await autoSettleOrderIfDelivered(project.id, `System auto-settled: Project moved to '${newStatus}'.`, actingUser);
          }
        }
      }
    }

    revalidatePath("/(app)/projects");
    revalidatePath("/(app)/orders");
    revalidatePath("/(app)/active-orders");
    revalidatePath(`/track/${project.id}`);
    revalidatePath("/(app)/invoice/[orderId]", "page");

    // Emit socket events for real-time updates
    const io = getIO();
    if (io) {
      io.emit("project-updated", { id: project.id, status: newStatus });
      io.emit("order-updated", { id: project.id });
    }

    return { success: true };
  } catch (error) {
    console.error("Error in updateProjectStatusAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

/**
 * Move a project into a production stage and record who is assigned for it
 * (On Script -> SW, Artist Booked -> ARTIST, Cinematographer -> CG, On Editor -> EDITOR).
 */
export async function assignStageRoleAction(
  projectId: string,
  newStatus: ProjectStatusType,
  assigneeId: string,
  actingUser: User,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  await guard();
  try {
    const cfg = STAGE_ASSIGN_ROLE[newStatus];
    if (!cfg) return { success: false, error: `Stage '${newStatus}' does not take an assignee.` };

    const assignee = await getUserById(assigneeId);
    if (!assignee || assignee.isBanned) return { success: false, error: "Selected user was not found or is suspended." };
    if (!(cfg.roles ?? [cfg.role]).includes(assignee.role)) return { success: false, error: `Selected user is not a ${cfg.label}.` };

    const order = await getOrderById(projectId);
    if (!order) return { success: false, error: `Order ${projectId} not found.` };
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: `Project ${projectId} not found.` };

    // 1. move the stage (permission check + order status + project timestamps)
    const moved = await updateProjectStatusAction(project, newStatus, actingUser, notes);
    if (!moved.success) return moved;

    // 2. remember the assignee on the order
    const fresh = await getOrderById(projectId);
    const stageAssignees = { ...(fresh?.stageAssignees ?? order.stageAssignees ?? {}), [cfg.role]: { id: assignee.id, name: assignee.name, assignedAt: new Date().toISOString() } };
    // One history line per move: fold the assignment into the entry the move just wrote.
    // (Only when re-assigning someone on a stage the project is already in is a separate line added.)
    const assignedNote = `Assigned ${cfg.label}: ${assignee.name}.`;
    const history = [...(fresh?.statusHistory ?? order.statusHistory ?? [])];
    const last = history[history.length - 1];
    const justMoved = !!last
      && last.status === (fresh?.currentStatus ?? order.currentStatus)
      && last.changedByUserId === actingUser.id
      && /^Order moved to /.test(last.notes ?? '')
      && Date.now() - new Date(last.timestamp).getTime() < 60_000;
    if (justMoved) {
      history[history.length - 1] = { ...last, notes: `${last.notes} ${assignedNote}` };
    } else {
      history.push({
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        status: fresh?.currentStatus ?? order.currentStatus,
        changedByUserId: actingUser.id,
        changedByUserName: actingUser.name,
        notes: `${assignedNote} (by ${actingUser.name})`,
      });
    }
    const ok = await updateOrder(projectId, {
      stageAssignees,
      statusHistory: history,
      updatedAt: new Date().toISOString(),
      updatedByUserId: actingUser.id,
      updatedByUserName: actingUser.name,
    });
    if (!ok) return { success: false, error: "Stage moved, but saving the assignee failed." };

    revalidatePath("/(app)/projects");
    revalidatePath("/(app)/orders");
    revalidatePath(`/track/${projectId}`);
    const io = getIO();
    if (io) {
      io.emit("project-updated", { id: projectId, status: newStatus });
      io.emit("order-updated", { id: projectId });
    }
    return { success: true };
  } catch (error) {
    console.error("Error in assignStageRoleAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}
