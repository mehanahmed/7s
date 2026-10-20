
"use server";

import { revalidatePath } from "next/cache";
import {
  setCrmCompletionStatusIds,
  setCommentsVisibility,
  setRolesAllowedToEditOrders,
  setRolesAllowedToDeleteOrders,
  setRolesAllowedToViewFinancials,
  setToastSoundUrl,
  setVatPercentage,
  setSlaHours,
  setLeaderboardBackgroundImageUrl,
  setExpenseLoggingPermissions,
  setProjectStageAccess,
  setMaintenanceMode,
  setDrAssignmentNotificationTemplates,
  setRoleBasedTargets,
  setPipelineAccess,
  setLeadCategoryAccess,
  setPaymentValidationStatus,
  setTelegramSettings,
  setLeaderboardRestriction,
  setCourierNoteVisibility,
  setSalaryTransferBankSettings,
  setPaymentGatewaySettings,
} from "@/lib/settings-service";
import type { UserRole, User, ExpenseLoggingPermissions, ProjectStatusType, RoleBasedTarget, PipelineAccessSettings, LeadCategory, LeadCategoryAccessSettings } from "@/types";
import { getUsers as getAllUsersFromDb, getUserById } from '@/lib/user-service';
import { guard, requireRole } from '@/lib/guard';
import { DR_ROLES } from '@/lib/roles';


export async function updateCompletionStatusIdsAction(ids: string[]): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setCrmCompletionStatusIds(ids);
    if (success) {
      revalidatePath("/(app)/admin/settings");
      revalidatePath("/(app)/dashboard");
      revalidatePath("/(app)/leaderboard");
      return { success: true };
    }
    return { success: false, error: "Failed to update CR completion status settings in database." };
  } catch (error) {
    console.error("Error in updateCompletionStatusIdsAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateCommentsVisibilityAction(isVisible: boolean): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setCommentsVisibility(isVisible);
    if (success) {
      revalidatePath("/(app)/admin/settings");
      revalidatePath("/track/[trackingId]", "layout");
      return { success: true };
    }
    return { success: false, error: "Failed to update comments visibility setting in database." };
  } catch (error) {
    console.error("Error in updateCommentsVisibilityAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateRolesAllowedToEditOrdersAction(roles: UserRole[]): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setRolesAllowedToEditOrders(roles);
    if (success) {
      revalidatePath("/(app)/admin/settings");
      revalidatePath("/(app)/orders");
      return { success: true };
    }
    return { success: false, error: "Failed to update order editing permissions in database." };
  } catch (error) {
    console.error("Error in updateRolesAllowedToEditOrdersAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateRolesAllowedToDeleteOrdersAction(roles: UserRole[]): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setRolesAllowedToDeleteOrders(roles);
    if (success) {
      revalidatePath("/(app)/admin/settings");
      revalidatePath("/(app)/orders");
      return { success: true };
    }
    return { success: false, error: "Failed to update order deletion permissions in database." };
  } catch (error) {
    console.error("Error in updateRolesAllowedToDeleteOrdersAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateRolesAllowedToViewFinancialsAction(roles: UserRole[]): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setRolesAllowedToViewFinancials(roles);
    if (success) {
      revalidatePath("/(app)/admin/settings");
      revalidatePath("/track/[trackingId]", "layout");
      return { success: true };
    }
    return { success: false, error: "Failed to update financial visibility permissions in database." };
  } catch (error) {
    console.error("Error in updateRolesAllowedToViewFinancialsAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updatePaymentValidationAction(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setPaymentValidationStatus(enabled);
    if (success) {
      revalidatePath("/(app)/admin/custom-access");
      revalidatePath("/(app)/projects");
      return { success: true };
    }
    return { success: false, error: "Failed to update payment validation setting in database." };
  } catch (error) {
    console.error("Error in updatePaymentValidationAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateLeaderboardRestrictionAction(restricted: boolean): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setLeaderboardRestriction(restricted);
    if (success) {
      revalidatePath("/(app)/admin/custom-access");
      revalidatePath("/(app)/leaderboard");
      revalidatePath("/(app)", "layout");
      return { success: true };
    }
    return { success: false, error: "Failed to update leaderboard restriction setting." };
  } catch (error) {
    console.error("Error in updateLeaderboardRestrictionAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updatePipelineAccessAction(permissions: PipelineAccessSettings): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    // Basic validation
    if (!permissions || !Array.isArray(permissions.canViewAllLeads)) {
      return { success: false, error: "Invalid permission structure provided." };
    }

    const success = await setPipelineAccess(permissions);
    if (success) {
      revalidatePath("/(app)/admin/custom-access");
      revalidatePath("/(app)/pipeline");
      return { success: true };
    }
    return { success: false, error: "Failed to update pipeline access permissions in database." };
  } catch (error) {
    console.error("Error in updatePipelineAccessAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}


export async function updateSlaHoursAction(hours: Record<string, number>): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN', 'ADMIN']);
  try {
    const success = await setSlaHours(hours);
    if (success) {
      revalidatePath("/(app)/admin/settings");
      revalidatePath("/(app)/report");
      return { success: true };
    }
    return { success: false, error: "Each SLA must be between 1 and 720 hours." };
  } catch (error) {
    console.error("Error in updateSlaHoursAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateVatPercentageAction(percent: number): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN', 'ADMIN']);
  try {
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return { success: false, error: "VAT must be between 0 and 100." };
    const success = await setVatPercentage(percent);
    if (success) {
      revalidatePath("/(app)/admin/settings");
      revalidatePath("/(app)/quotation");
      return { success: true };
    }
    return { success: false, error: "Failed to update VAT in database." };
  } catch (error) {
    console.error("Error in updateVatPercentageAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateToastSoundUrlAction(soundUrl: string | null): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setToastSoundUrl(soundUrl);
    if (success) {
      revalidatePath("/(app)/admin/settings");
      return { success: true };
    }
    return { success: false, error: "Failed to update toast sound URL in database." };
  } catch (error) {
    console.error("Error in updateToastSoundUrlAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateLeaderboardBackgroundImageUrlAction(imageUrl: string | null): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setLeaderboardBackgroundImageUrl(imageUrl);
    if (success) {
      revalidatePath("/(app)/admin/settings");
      revalidatePath("/(app)/leaderboard");
      return { success: true };
    }
    return { success: false, error: "Failed to update leaderboard background image URL in database." };
  } catch (error) {
    console.error("Error in updateLeaderboardBackgroundImageUrlAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateExpenseLoggingPermissionsAction(permissions: ExpenseLoggingPermissions): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    // Validate permissions structure
    if (!permissions || !permissions.mode) {
      return { success: false, error: "Invalid permission structure provided." };
    }
    if (permissions.mode === 'specificRoles' && (!Array.isArray(permissions.allowedRoles) || permissions.allowedRoles.some(r => !['ADMIN', 'CR', ...DR_ROLES, 'VENDOR', 'LR'].includes(r)))) {
      return { success: false, error: "Invalid roles specified for expense logging." };
    }
    if (permissions.mode === 'specificUsers' && !Array.isArray(permissions.allowedUserIds)) {
      return { success: false, error: "Allowed user IDs must be an array for expense logging." };
    }

    const success = await setExpenseLoggingPermissions(permissions);
    if (success) {
      revalidatePath("/(app)/admin/settings");
      revalidatePath("/(app)/expenses");
      return { success: true };
    }
    return { success: false, error: "Failed to update expense logging permissions in database." };
  } catch (error) {
    console.error("Error in updateExpenseLoggingPermissionsAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateProjectStageAccessAction(
  permissions: Record<ProjectStatusType, UserRole[]>
): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setProjectStageAccess(permissions);
    if (success) {
      revalidatePath("/(app)/admin/settings");
      revalidatePath("/(app)/projects");
      return { success: true };
    }
    return { success: false, error: "Failed to update project stage access permissions in database." };
  } catch (error) {
    console.error("Error in updateProjectStageAccessAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateLeadCategoryAccessAction(
  permissions: Record<LeadCategory, LeadCategoryAccessSettings>
): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setLeadCategoryAccess(permissions);
    if (success) {
      revalidatePath("/(app)/admin/custom-access");
      revalidatePath("/(app)/pipeline");
      return { success: true };
    }
    return { success: false, error: "Failed to update lead category access permissions." };
  } catch (error) {
    console.error("Error in updateLeadCategoryAccessAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}


export async function updateMaintenanceModeAction(
  enabled: boolean,
  message: string | null
): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setMaintenanceMode(enabled, message);
    if (success) {
      // Revalidate all app pages to reflect maintenance mode change immediately
      revalidatePath('/(app)', 'layout');
      return { success: true };
    }
    return { success: false, error: "Failed to update maintenance mode settings in database." };
  } catch (error) {
    console.error("Error in updateMaintenanceModeAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

// New action for DR assignment notification templates
export async function updateDrAssignmentNotificationTemplatesAction(
  title: string | null,
  body: string | null
): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setDrAssignmentNotificationTemplates(title, body);
    if (success) {
      revalidatePath("/(app)/admin/settings");
      return { success: true };
    }
    return { success: false, error: "Failed to update DR assignment notification templates in database." };
  } catch (error) {
    console.error("Error in updateDrAssignmentNotificationTemplatesAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateTelegramSettingsAction(
  botToken: string | null,
  chatIds: string[] | null,
  redirectDomain: string | null
): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setTelegramSettings(botToken, chatIds, redirectDomain);
    if (success) {
      revalidatePath("/(app)/admin/settings");
      return { success: true };
    }
    return { success: false, error: "Failed to update Telegram settings in database." };
  } catch (error) {
    console.error("Error in updateTelegramSettingsAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}





export async function updateRoleBasedTargetsAction(targets: RoleBasedTarget): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setRoleBasedTargets(targets);
    if (success) {
      revalidatePath("/(app)/admin/settings");
      revalidatePath("/(app)/dashboard");
      return { success: true };
    }
    return { success: false, error: "Failed to update role-based targets in database." };
  } catch (error) {
    console.error("Error in updateRoleBasedTargetsAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateCourierNoteVisibilityAction(isVisible: boolean): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setCourierNoteVisibility(isVisible);
    if (success) {
      revalidatePath("/(app)/admin/settings");
      revalidatePath("/(app)/projects");
      return { success: true };
    }
    return { success: false, error: "Failed to update courier note visibility setting in database." };
  } catch (error) {
    console.error("Error in updateCourierNoteVisibilityAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateSalaryTransferBankSettingsAction(
  bankName: string | null,
  accountNo: string | null
): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setSalaryTransferBankSettings(bankName, accountNo);
    if (success) {
      revalidatePath("/(app)/admin/settings");
      return { success: true };
    }
    return { success: false, error: "Failed to update salary transfer bank settings in database." };
  } catch (error) {
    console.error("Error in updateSalaryTransferBankSettingsAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updatePaymentGatewaySettingsAction(settings: {
  merchantId: string | null;
  password: string | null;
  environment: 'sandbox' | 'production';
  callbackUrl: string | null;
  ipnUrl: string | null;
  payWithCharge: boolean;
  emi: boolean;
  enabled: boolean;
}): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    if (settings.enabled && (!settings.merchantId || !settings.password)) {
      return { success: false, error: "Merchant ID and Password are required when gateway is enabled." };
    }
    const success = await setPaymentGatewaySettings(settings);
    if (success) {
      revalidatePath("/(app)/admin/settings");
      return { success: true };
    }
    return { success: false, error: "Failed to update payment gateway settings in database." };
  } catch (error) {
    console.error("Error in updatePaymentGatewaySettingsAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}
