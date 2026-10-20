"use server";

import { revalidatePath } from "next/cache";
import {
  setCrmCompletionStatusIds,
  setCommentsVisibility,
  setRolesAllowedToEditOrders,
  setRolesAllowedToDeleteOrders,
  setRolesAllowedToViewFinancials,
  setToastSoundUrl,
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
  setShowAvatarsInOrders,
  setDesignApprovalStatusIds,
  setDocsApprovalStatusIds,
} from "@/lib/settings-service";
import { addCustomRole, updateCustomRole, deleteCustomRole, updateRolesOrder } from "@/lib/user-role-service";
import type { UserRole, User, ExpenseLoggingPermissions, ProjectStatusType, RoleBasedTarget, PipelineAccessSettings, LeadCategory, LeadCategoryAccessSettings } from "@/types";
import { getUsers as getAllUsersFromDb, getUserById } from '@/lib/user-service';
import { guard, requireRole } from '@/lib/guard';
import { DR_ROLES } from '@/lib/roles';


export async function addCustomRoleAction(name: string, color: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const role = await addCustomRole(name, color);
    if (role) {
      revalidatePath("/(app)/admin/custom-access");
      revalidatePath("/(app)/users");
      return { success: true };
    }
    return { success: false, error: "Failed to add role." };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to add role." };
  }
}

export async function updateCustomRoleAction(id: string, name: string, color: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await updateCustomRole(id, name, color);
    if (success) {
      revalidatePath("/(app)/admin/custom-access");
      revalidatePath("/(app)/users");
      return { success: true };
    }
    return { success: false, error: "Failed to update role." };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to update role." };
  }
}

export async function deleteCustomRoleAction(id: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await deleteCustomRole(id);
    if (success) {
      revalidatePath("/(app)/admin/custom-access");
      revalidatePath("/(app)/users");
      return { success: true };
    }
    return { success: false, error: "Failed to delete role." };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to delete role." };
  }
}

export async function reorderRolesAction(roleIds: string[]): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await updateRolesOrder(roleIds);
    if (success) {
      revalidatePath("/(app)/admin/custom-access");
      revalidatePath("/(app)/users");
      return { success: true };
    }
    return { success: false, error: "Failed to save new roles order." };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to save new roles order." };
  }
}

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

export async function updateShowAvatarsInOrdersAction(show: boolean): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setShowAvatarsInOrders(show);
    if (success) {
      revalidatePath("/(app)/admin/custom-access");
      revalidatePath("/(app)/orders");
      revalidatePath("/(app)/all-orders");
      return { success: true };
    }
    return { success: false, error: "Failed to update avatars visibility setting." };
  } catch (error) {
    console.error("Error in updateShowAvatarsInOrdersAction:", error);
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

export async function updateDesignApprovalStatusIdsAction(ids: string[]): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setDesignApprovalStatusIds(ids);
    if (success) {
      revalidatePath("/(app)/admin/custom-access");
      revalidatePath("/track/[trackingId]", "layout");
      return { success: true };
    }
    return { success: false, error: "Failed to update Design Approval statuses in database." };
  } catch (error) {
    console.error("Error in updateDesignApprovalStatusIdsAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateDocsApprovalStatusIdsAction(ids: string[]): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  try {
    const success = await setDocsApprovalStatusIds(ids);
    if (success) {
      revalidatePath("/(app)/admin/custom-access");
      revalidatePath("/track/[trackingId]", "layout");
      return { success: true };
    }
    return { success: false, error: "Failed to update Docs Approval statuses in database." };
  } catch (error) {
    console.error("Error in updateDocsApprovalStatusIdsAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}
