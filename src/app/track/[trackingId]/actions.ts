


"use server";

import { revalidatePath } from "next/cache";
import type { Comment, TrackingLink, User, UserRole } from "@/types";
import { addCommentToOrder, addReplyToComment, toggleReaction, getOrderByTrackingCode, autoSettleOrderIfDelivered, deleteComment as deleteCommentFromOrder, updateOrder, getOrderById } from "@/lib/order-service";
import { DELIVERED_STATUS_ID } from '@/lib/status-constants';
import { v4 as uuidv4 } from 'uuid';
import { addClientPayment, getClientPayments } from "@/lib/client-payment-service";
import { getIO } from "@/lib/socket-io";
import { sendTelegramMessage, sendTelegramPhoto } from "@/lib/notification-utils";
import { getAppUrl } from "@/lib/server-utils";
import { getGlobalSettings } from "@/lib/settings-service";
import { guard, markPublic } from '@/lib/guard';
import { getSessionUserId, isRateLimited, recordFail } from '@/lib/session-core';
import { headers } from 'next/headers';

/**
 * The public tracking page works without a login, so its client actions are public entry points.
 * Visitors without a session are limited to a few writes per IP (in-memory, per process) and cannot post as staff.
 * Returns true when a logged-in user is calling.
 */
async function publicWriteGate(action: string): Promise<boolean> {
  markPublic();
  await guard();
  if (await getSessionUserId()) return true;
  let ip = 'unknown';
  try { ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'; } catch { /* no request scope */ }
  const key = `track:${action}:${ip}`;
  if (isRateLimited(key)) throw new Error('Too many requests. Please try again in a few minutes.');
  recordFail(key);
  return false;
}


// For top-level comments from the main form (typically by client or general update)
export async function submitCommentAction(
  orderId: string,
  commentData: {
    userName: string;
    text: string;
    isInternal: boolean;
    userId?: string;
    userRole?: UserRole | 'Client';
  }
): Promise<TrackingLink | { error: string }> {
  if (!(await publicWriteGate('comment'))) {
    commentData = { ...commentData, isInternal: false, userRole: 'Client', userId: undefined };
  }
  if (!commentData.text.trim()) {
    return { error: "Comment text cannot be empty." };
  }

  try {
    const payloadForService: Omit<Comment, 'id' | 'timestamp' | 'replies' | 'likes'> = {
      userName: commentData.userName,
      userRole: commentData.userRole || 'Client',
      text: commentData.text,
      isInternal: commentData.isInternal,
    };
    if (commentData.userId) {
      payloadForService.userId = commentData.userId;
    }


    const updatedOrder = await addCommentToOrder(orderId, payloadForService);

    if (!updatedOrder) {
      return { error: "Failed to add comment to order." };
    }

    revalidatePath(`/track/${orderId}`);

    const io = getIO();
    if (io) {
      io.emit("order-updated", { id: orderId, action: 'comment' });
    }

    return updatedOrder;
  } catch (error) {
    console.error("Error in submitCommentAction:", error);
    return { error: error instanceof Error ? error.message : "Failed to submit comment." };
  }
}

// For replies submitted by authenticated users
export async function submitReplyAction(
  orderId: string,
  parentCommentId: string,
  replyText: string,
  isInternal: boolean,
  actingUser: User
): Promise<TrackingLink | { error: string }> {
  await guard();
  if (!replyText.trim()) {
    return { error: "Reply text cannot be empty." };
  }
  if (!actingUser || !actingUser.id || !actingUser.name || !actingUser.role) {
    return { error: "Authenticated user information is missing for reply." };
  }

  try {
    const replyDataForService: Omit<Comment, 'id' | 'timestamp' | 'replies' | 'likes'> = {
      userName: actingUser.name,
      userRole: actingUser.role,
      text: replyText,
      isInternal: isInternal,
      userId: actingUser.id,
    };

    const updatedOrder = await addReplyToComment(orderId, parentCommentId, replyDataForService);

    if (!updatedOrder) {
      return { error: "Failed to add reply to comment." };
    }

    revalidatePath(`/track/${orderId}`);

    const io = getIO();
    if (io) {
      io.emit("order-updated", { id: orderId, action: 'reply' });
    }

    return updatedOrder;
  } catch (error) {
    console.error("Error in submitReplyAction (authenticated):", error);
    return { error: error instanceof Error ? error.message : "Failed to submit reply." };
  }
}


// For replies submitted by unauthenticated clients
export async function submitClientReplyAction(
  orderId: string,
  parentCommentId: string,
  replyText: string
  // clientName parameter can be added here if you want clients to provide a name
): Promise<TrackingLink | { error: string }> {
  await publicWriteGate('reply');
  if (!replyText.trim()) {
    return { error: "Reply text cannot be empty." };
  }

  try {
    const replyDataForService: Omit<Comment, 'id' | 'timestamp' | 'replies' | 'likes'> = {
      userName: "Client", // Or use clientName if you add an input for it
      userRole: 'Client',
      text: replyText,
      isInternal: false,
    };

    const updatedOrder = await addReplyToComment(orderId, parentCommentId, replyDataForService);

    if (!updatedOrder) {
      return { error: "Failed to add client reply to comment." };
    }

    revalidatePath(`/track/${orderId}`);

    const io = getIO();
    if (io) {
      io.emit("order-updated", { id: orderId, action: 'client-reply' });
    }

    return updatedOrder;
  } catch (error) {
    console.error("Error in submitClientReplyAction:", error);
    return { error: error instanceof Error ? error.message : "Failed to submit client reply." };
  }
}


export async function toggleOrderCommentReactionAction(
  orderId: string,
  targetCommentId: string,
  isReply: boolean,
  parentCommentIdIfReply: string | undefined,
  reactorId: string,
  reactionType: 'like'
): Promise<TrackingLink | { error: string }> {
  await publicWriteGate('react');
  if (!reactorId) {
    return { error: "Reactor ID is missing." };
  }
  if (!reactionType) {
    return { error: "Reaction type is missing." };
  }

  try {
    const updatedOrder = await toggleReaction(
      orderId,
      targetCommentId,
      isReply,
      parentCommentIdIfReply,
      reactorId,
      reactionType
    );

    if (!updatedOrder) {
      return { error: "Failed to toggle reaction on comment/reply." };
    }

    revalidatePath(`/track/${orderId}`);

    const io = getIO();
    if (io) {
      io.emit("order-updated", { id: orderId, action: 'reaction' });
    }

    return updatedOrder;
  } catch (error) {
    console.error("Error in toggleOrderCommentReactionAction:", error);
    return { error: error instanceof Error ? error.message : "Failed to toggle reaction." };
  }
}

export async function deleteCommentAction(
  orderId: string,
  targetCommentId: string,
  isReply: boolean,
  parentCommentIdIfReply: string | undefined,
  actingUser: User | null
): Promise<TrackingLink | { error: string }> {
  await guard();
  if (!actingUser || actingUser.role !== 'SYSTEM_ADMIN') {
    return { error: "Permission denied. Only System Administrators can delete comments." };
  }

  try {
    const updatedOrder = await deleteCommentFromOrder(
      orderId,
      targetCommentId,
      isReply,
      parentCommentIdIfReply,
    );
    if (!updatedOrder) {
      return { error: "Failed to delete comment from order." };
    }
    revalidatePath(`/track/${orderId}`);

    const io = getIO();
    if (io) {
      io.emit("order-updated", { id: orderId, action: 'comment-deleted' });
    }

    return updatedOrder;
  } catch (error) {
    console.error("Error in deleteCommentAction:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete comment." };
  }
}


export async function getPackzyDeliveryStatusAction(trackingCode: string): Promise<{ delivery_status: string } | { error: string }> {
  markPublic();
  await guard();
  if (!trackingCode) {
    return { error: 'Tracking code is required.' };
  }

  const apiKey = process.env.STEADFAST_API_KEY || '';
  const secretKey = process.env.STEADFAST_SECRET_KEY || '';
  if (!apiKey || !secretKey) return { error: 'Steadfast credentials are not configured.' };

  try {
    const response = await fetch(`https://portal.packzy.com/api/v1/status_by_trackingcode/${trackingCode}`, {
      method: 'GET',
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Ensure we always get the latest status
    });

    const responseData = await response.json();

    if (responseData.status !== 200) {
      console.error('Steadfast API Error:', responseData);
      return { error: responseData.message || 'Failed to fetch delivery status from Steadfast.' };
    }

    const deliveryStatus = responseData.delivery_status;
    const isDeliveredLike = deliveryStatus === 'delivered' || deliveryStatus === 'delivered_approval_pending';

    if (responseData.status === 200 && isDeliveredLike) {
      try {
        const order = await getOrderByTrackingCode(trackingCode);
        if (order) {
          // Trigger settlement if the conditions are met (due amount > 0 or status not yet Delivered)
          await autoSettleOrderIfDelivered(
            order.id,
            `System auto-settled: Courier confirmed delivery (Status: ${deliveryStatus}).`,
            { id: order.crmUserId, name: order.crmUserName }
          );
        }
      } catch (settleError) {
        console.error(`[getPackzyDeliveryStatusAction] Failed to auto-settle order for tracking code ${trackingCode}:`, settleError);
        // Don't block the return of the status, just log the error.
      }
    }

    return { delivery_status: responseData.delivery_status };
  } catch (error) {
    console.error('Error calling Packzy API:', error);
    return { error: 'An unexpected error occurred while fetching delivery status.' };
  }
}

export async function approveOrderAction(orderId: string): Promise<TrackingLink | { error: string }> {
  await publicWriteGate('approve');
  try {
    const order = await getOrderById(orderId);
    if (!order) {
      return { error: "Order not found." };
    }

    const settings = await getGlobalSettings();
    const isDocsApproval = settings.docsApprovalStatusIds && settings.docsApprovalStatusIds.length > 0
      ? settings.docsApprovalStatusIds.includes(order.currentStatus)
      : order.currentStatus === 'co-clearance';
    const changedByUserId = isDocsApproval ? 'client-approved-docs' : 'client-approved-design';
    const notes = isDocsApproval 
      ? 'Terms accepted and documents approved by client.' 
      : 'Terms accepted and design approved by client.';

    const newLogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      status: order.currentStatus,
      changedByUserId,
      changedByUserName: 'Client',
      notes
    };

    const updatedHistory = [...(order.statusHistory || []), newLogEntry];

    const success = await updateOrder(orderId, {
      statusHistory: updatedHistory
    });

    if (!success) {
      return { error: "Failed to update order status." };
    }

    const updatedOrder = await getOrderById(orderId);
    if (!updatedOrder) {
      return { error: "Failed to fetch updated order." };
    }

    revalidatePath(`/track/${orderId}`);
    revalidatePath(`/client`);

    const io = getIO();
    if (io) {
      io.emit("order-updated", { id: orderId, action: 'approved' });
      io.emit("project-updated", { id: orderId });
    }

    return updatedOrder;
  } catch (error) {
    console.error("Error in approveOrderAction:", error);
    return { error: error instanceof Error ? error.message : "Failed to approve order." };
  }
}

export async function submitPaymentProofAction(
  orderId: string,
  paymentData: {
    amount: number;
    paymentMethod: string;
    notes: string;
    documentUrl?: string | null;
  }
): Promise<TrackingLink | { error: string }> {
  await publicWriteGate('payment');
  try {
    const order = await getOrderById(orderId);
    if (!order) {
      return { error: "Order not found." };
    }

    // Save payment proof to the separate client_payments table
    await addClientPayment({
      orderId,
      amount: paymentData.amount,
      paymentMethod: paymentData.paymentMethod,
      notes: paymentData.notes,
      documentUrl: paymentData.documentUrl || null,
      recordedByUserId: 'client-proof',
      recordedByUserName: 'Client'
    });

    // Auto-post a comment to notify the team
    try {
      const commentText = `Submitted payment proof of BDT ${paymentData.amount.toLocaleString()} via ${paymentData.paymentMethod}. Notes/TrxID: ${paymentData.notes}${paymentData.documentUrl ? ` [View Receipt](${paymentData.documentUrl})` : ''}`;
      await addCommentToOrder(orderId, {
        userName: 'Client',
        userRole: 'Client',
        text: commentText,
        isInternal: false,
      });
    } catch (commentError) {
      console.error("Failed to auto-post comment for payment proof:", commentError);
    }

    // Send Telegram Notification to @chclientpay
    try {
      const formattedAmount = paymentData.amount.toLocaleString('en-IN', { style: 'currency', currency: 'BDT' });
      const captionText = `<b>🔔 New Client Payment Submitted!</b>\n\n` +
        `<b>Order ID:</b> <code>${orderId}</code>\n` +
        `<b>Company:</b> ${order.companyName}\n` +
        `<b>Amount:</b> ${formattedAmount}\n` +
        `<b>Method:</b> ${paymentData.paymentMethod}\n\n` +
        `Please review and approve this payment in the admin panel.`;

      const appUrl = await getAppUrl();
      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: "📄 View Order",
              url: `${appUrl}/track/${orderId}`
            },
            {
              text: "💰 Payment History",
              url: `${appUrl}/admin/payment-history`
            }
          ]
        ]
      };

      const hasImage = paymentData.documentUrl && /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(paymentData.documentUrl);

      if (hasImage && paymentData.documentUrl) {
        await sendTelegramPhoto(paymentData.documentUrl, captionText, inlineKeyboard, '@chclientpay');
      } else {
        await sendTelegramMessage(captionText, inlineKeyboard, '@chclientpay');
      }
    } catch (telegramError) {
      console.error("Failed to send Telegram notification for payment proof:", telegramError);
    }

    const updatedOrder = await getOrderById(orderId);
    if (!updatedOrder) {
      return { error: "Failed to fetch updated order." };
    }

    revalidatePath(`/track/${orderId}`);

    const io = getIO();
    if (io) {
      io.emit("order-updated", { id: orderId, action: 'payment-proof' });
    }

    return updatedOrder;
  } catch (error) {
    console.error("Error in submitPaymentProofAction:", error);
    return { error: error instanceof Error ? error.message : "Failed to submit payment proof." };
  }
}

export async function removeOrderApprovalAction(orderId: string): Promise<TrackingLink | { error: string }> {
  await guard();
  try {
    const order = await getOrderById(orderId);
    if (!order) {
      return { error: "Order not found." };
    }

    const updatedHistory = (order.statusHistory || []).filter(
      entry => entry.changedByUserId !== 'client-approved-docs' && entry.changedByUserId !== 'client-approved-design'
    );

    const success = await updateOrder(orderId, {
      statusHistory: updatedHistory
    });

    if (!success) {
      return { error: "Failed to update order status." };
    }

    const updatedOrder = await getOrderById(orderId);
    if (!updatedOrder) {
      return { error: "Failed to fetch updated order." };
    }

    revalidatePath(`/track/${orderId}`);
    revalidatePath(`/client`);

    const io = getIO();
    if (io) {
      io.emit("order-updated", { id: orderId, action: 'approval-removed' });
      io.emit("project-updated", { id: orderId });
    }

    return updatedOrder;
  } catch (error) {
    console.error("Error in removeOrderApprovalAction:", error);
    return { error: error instanceof Error ? error.message : "Failed to remove order approval." };
  }
}

export async function hasPendingClientPaymentAction(orderId: string): Promise<boolean> {
  markPublic(); // the public tracking page asks this for visitors without a session; it only returns a yes/no
  await guard();
  try {
    const payments = await getClientPayments(orderId);
    return payments.length > 0;
  } catch (error) {
    console.error("Error in hasPendingClientPaymentAction:", error);
    return false;
  }
}

export async function getOrderByIdAction(orderId: string): Promise<TrackingLink | null> {
  markPublic();
  await guard();
  try {
    const order = await getOrderById(orderId);
    if (!order) return null;
    return JSON.parse(JSON.stringify(order));
  } catch (error) {
    console.error("Error in getOrderByIdAction:", error);
    return null;
  }
}

