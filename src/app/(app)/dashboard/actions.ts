"use server";

import { revalidatePath } from 'next/cache';
import { getOrderById, updateOrdersBatch, deleteShippedOrderEntry, autoSettleOrderIfDelivered, getShippedOrders } from '@/lib/order-service';

import { DELIVERED_STATUS_ID, SHIPPED_STATUS_ID } from '@/lib/status-constants';
import { getUsers } from '@/lib/user-service';
import { OrderLogEntry, TrackingLink, User, UserRole } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { addTaskEntry } from '@/lib/team-performance-service';
import { format } from 'date-fns';

import { getLeads } from '@/lib/lead-service';
import { sendTelegramMessage } from '@/lib/notification-utils';
import { formatDisplayName } from '@/lib/utils';
import { getGlobalSettings } from '@/lib/settings-service';
import { guard } from '@/lib/guard';

// This function is no longer used for setting targets, it might be removed in the future.
// The logic is kept for historical purposes or if it needs to be reinstated.
async function updateTargetInDb(targetType: 'monthly' | 'weekly', newTarget: number): Promise<boolean> {
  // This function would interact with a database service to update the target.
  // For this example, we'll assume it's a placeholder.
  console.log(`Updating ${targetType} target to ${newTarget}`);
  return true;
}

export async function setGlobalTargetAction(targetType: 'monthly' | 'weekly', newTarget: number): Promise<{ success: boolean; error?: string }> {
  await guard();
  if (newTarget < 0 || isNaN(newTarget)) {
    return { success: false, error: "Target must be a non-negative number." };
  }

  try {
    const success = await updateTargetInDb(targetType, newTarget);
    if (success) {
      revalidatePath('/(app)/dashboard');
      return { success: true };
    }
    return { success: false, error: "Failed to update target in database." };
  } catch (error) {
    console.error("Error in setGlobalTargetAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function settleAllDeliveredOrdersAction(): Promise<{ success: boolean; settledCount: number; statusUpdateCount: number; error?: string }> {
  await guard();
  try {
    const allUsers = await getUsers();
    const systemAdmin = allUsers.find(u => u.role === 'SYSTEM_ADMIN');

    if (!systemAdmin) {
      return { success: false, settledCount: 0, statusUpdateCount: 0, error: "System Admin user not found to perform settlement." };
    }
    const actingUser = { id: systemAdmin.id, name: systemAdmin.name };

    let statusUpdateCount = 0;
    const settledOrderIds: string[] = [];

    // 1. Fetch from MySQL instead of API
    const ordersToCheckCourier = await getShippedOrders();

    if (ordersToCheckCourier.length > 0) {
      console.log(`[SettleAction] Checking courier status for ${ordersToCheckCourier.length} shipped orders from MySQL.`);
      const apiKey = process.env.STEADFAST_API_KEY || '';
      const secretKey = process.env.STEADFAST_SECRET_KEY || '';
      if (!apiKey || !secretKey) throw new Error('Steadfast credentials are not configured.');

      for (const shippedOrder of ordersToCheckCourier) {
        try {
          const response = await fetch(`https://portal.packzy.com/api/v1/status_by_trackingcode/${shippedOrder.packzyTrackingCode}`, {
            method: 'GET',
            headers: { 'Api-Key': apiKey, 'Secret-Key': secretKey, 'Content-Type': 'application/json' },
            cache: 'no-store',
          });

          if (!response.ok) {
            throw new Error(`Packzy API responded with status: ${response.status}`);
          }

          const data = await response.json();

          if (data.status === 200 && data.delivery_status === 'delivered') {
            console.log(`[SettleAction] Courier confirmed delivery for order ${shippedOrder.orderId}. Triggering settlement.`);

            const settlementReason = `Order delivered. Status updated via SteadFast webhook. Consignment ID: ${data.consignment_id || 'N/A'}.`;
            const settlementSuccess = await autoSettleOrderIfDelivered(shippedOrder.orderId, settlementReason, actingUser);

            if (settlementSuccess) {
              statusUpdateCount++;
              settledOrderIds.push(shippedOrder.orderId);
              console.log(`[SettleAction] Successfully settled order ${shippedOrder.orderId}.`);
            } else {
              console.error(`[SettleAction] autoSettleOrderIfDelivered failed for order ${shippedOrder.orderId}.`);
            }
          }
        } catch (courierError) {
          console.error(`[SettleAction] Error fetching courier status for order ${shippedOrder.orderId}:`, courierError);
        }
      }

      // Clean up successfully settled orders from the shippedOrders collection
      if (settledOrderIds.length > 0) {
        for (const orderId of settledOrderIds) {
          await deleteShippedOrderEntry(orderId);
        }
      }
    }

    if (statusUpdateCount > 0) {
      revalidatePath("/(app)/dashboard", "layout");
      revalidatePath("/(app)/orders", "layout");
      revalidatePath("/(app)/invoice", "layout");
      revalidatePath("/(app)/projects", "layout");
    }

    return { success: true, settledCount: statusUpdateCount, statusUpdateCount }; // settledCount is the same as statusUpdateCount now
  } catch (error) {
    console.error("Error in settleAllDeliveredOrdersAction:", error);
    return { success: false, settledCount: 0, statusUpdateCount: 0, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

// New action to add a task entry for team performance
export async function addTaskEntryAction(
  user: User,
  taskCount: number
): Promise<{ success: boolean; error?: string }> {
  await guard();
  if (!user || !user.id || !user.role) {
    return { success: false, error: "Invalid user data provided." };
  }
  if (isNaN(taskCount) || taskCount < 0) {
    return { success: false, error: "Task count must be a non-negative number." };
  }

  try {
    const now = new Date();
    const dateTimeStr = format(now, "yyyy-MM-dd'T'HH:mm:ss");
    const entryData = {
      date: dateTimeStr,
      userId: user.id,
      userName: user.name,
      role: user.role,
      taskCount: taskCount,
    };

    const result = await addTaskEntry(entryData);
    if (result) {
      revalidatePath('/(app)/dashboard');
      return { success: true };
    } else {
      return { success: false, error: "Failed to save the task entry in the database." };
    }
  } catch (error) {
    console.error("Error in addTaskEntryAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function remindActiveCrmSchedulesAction(): Promise<{
  success: boolean;
  totalRemindersSent: number;
  details: Array<{ crmName: string; scheduledCount: number; message: string }>;
  error?: string;
}> {
  await guard();
  try {
    const settings = await getGlobalSettings();
    const scheduleChannelId = process.env.TELEGRAM_SCHEDULE_CHANNEL_ID || settings.telegramScheduleChannelId || '-1004447610171';

    const allUsers = await getUsers();
    // Filter active CR users only (role === 'CR' and not banned)
    const activeCrmUsers = allUsers.filter(u => u.role === 'CR' && !u.isBanned);

    if (activeCrmUsers.length === 0) {
      console.log("[Schedule Cron] No active CR users found.");
      return { success: true, totalRemindersSent: 0, details: [] };
    }

    // Get current date string in Bangladesh (UTC+6) YYYY-MM-DD
    const now = new Date();
    const bdDateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }); // Format: "YYYY-MM-DD"

    const details: Array<{ crmName: string; scheduledCount: number; message: string }> = [];
    const userBlocks: string[] = [];

    for (const crmUser of activeCrmUsers) {
      // Fetch leads for this specific CR user
      const leads = await getLeads(undefined, undefined, 'CR', crmUser.id);

      // Filter scheduled leads for today (comparing YYYY-MM-DD in BD time)
      const todaysScheduledLeads = leads.filter(lead => {
        if (!lead.schedule) return false;
        try {
          const leadDate = new Date(lead.schedule);
          const leadBdDateStr = leadDate.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
          return leadBdDateStr === bdDateStr;
        } catch {
          return false;
        }
      });

      const scheduledCount = todaysScheduledLeads.length;
      const displayName = formatDisplayName(crmUser.name);

      let userMsg = '';
      if (scheduledCount > 0) {
        userMsg = `<b>👤 ${displayName}</b>, you have <b>${scheduledCount}</b> schedule${scheduledCount === 1 ? '' : 's'} today`;
      } else {
        userMsg = `<b>👤 ${displayName}</b>, you don't have schedules today`;
      }

      userBlocks.push(userMsg);
      details.push({
        crmName: crmUser.name,
        scheduledCount,
        message: `${displayName}, ${scheduledCount > 0 ? `you have ${scheduledCount} schedule(s) today` : `you don't have schedules today`}`,
      });
    }

    if (userBlocks.length > 0) {
      const separator = '\n━━━━━━━━━━━━━━━━━━━━\n';
      const headerBlock = `<blockquote><b>📅 TODAY SCHEDULE</b></blockquote>`;
      const fullTelegramMessage = `${headerBlock}\n${separator}${userBlocks.join(separator)}`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: '📊 Open Dashboard',
              url: `${settings.telegramRedirectDomain || 'https://app.colorhutbd.xyz'}/dashboard`
            }
          ]
        ]
      };

      console.log(`[Schedule Cron] Sending consolidated TODAY SCHEDULE notification to Telegram channel...`);
      await sendTelegramMessage(fullTelegramMessage, inlineKeyboard, scheduleChannelId);
    }

    console.log(`[Schedule Cron] Completed schedule reminder cron job for ${activeCrmUsers.length} CR users.`);
    return { success: true, totalRemindersSent: activeCrmUsers.length, details };
  } catch (error) {
    console.error("Error in remindActiveCrmSchedulesAction:", error);
    return { success: false, totalRemindersSent: 0, details: [], error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}
