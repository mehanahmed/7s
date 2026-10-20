

"use server";

import { revalidatePath } from "next/cache";
import type { Lead, User, LeadActivity, LeadCategory, LeadStatusType } from '@/types';
import {
  getLeads as getLeadsFromDb,
  getLeadsPaginated as getLeadsPaginatedFromDb,
  getEventsPaginated as getEventsPaginatedFromDb,
  addLead,
  updateLead,
  deleteLead,
  getLeadById,
  getLeadByPhone,
  getUniqueLeadCrmIds,
} from '@/lib/lead-service';
import { getUserById as getUserFromDb } from "@/lib/user-service";
import { v4 as uuidv4 } from 'uuid';
import { getIO } from "@/lib/socket-io";
import { LEAD_CATEGORY_LABELS, LEAD_TEMPERATURES } from "@/lib/pipeline-constants";
import { guard } from '@/lib/guard';

const isValidTemperature = (t: unknown) => t == null || (LEAD_TEMPERATURES as readonly unknown[]).includes(t);


export async function getLeads(
  startDate?: string,
  endDate?: string,
  role?: string,
  userId?: string,
  category?: string,
  activity?: string,
  searchTerm?: string,
  temperature?: string
): Promise<Lead[]> {
  await guard();
  try {
    return await getLeadsFromDb(startDate, endDate, role, userId, category, activity, searchTerm, temperature);
  } catch (error) {
    console.error("Error in getLeads server action:", error);
    return [];
  }
}

export async function getLeadsPaginatedAction(
  page: number = 1,
  limit: number = 10,
  startDate?: string,
  endDate?: string,
  role?: string,
  userId?: string,
  category?: string,
  activity?: string,
  searchTerm?: string,
  temperature?: string
): Promise<{ leads: Lead[]; total: number }> {
  await guard();
  try {
    return await getLeadsPaginatedFromDb(page, limit, startDate, endDate, role, userId, category, activity, searchTerm, temperature);
  } catch (error) {
    console.error("Error in getLeadsPaginatedAction server action:", error);
    return { leads: [], total: 0 };
  }
}

export async function getEventsPaginatedAction(
  page: number = 1,
  limit: number = 10,
  startDate?: string,
  endDate?: string,
  role?: string,
  userId?: string,
  searchTerm?: string,
  scheduleStart?: string,
  scheduleEnd?: string
): Promise<{ leads: Lead[]; total: number }> {
  await guard();
  try {
    return await getEventsPaginatedFromDb(page, limit, startDate, endDate, role, userId, searchTerm, scheduleStart, scheduleEnd);
  } catch (error) {
    console.error("Error in getEventsPaginatedAction server action:", error);
    return { leads: [], total: 0 };
  }
}

export async function getLeadByIdAction(leadId: string): Promise<Lead | null> {
  await guard();
  return getLeadById(leadId);
}


export async function addLeadAction(
  leadData: Omit<Lead, 'id' | 'crmId' | 'crmName' | 'activityHistory' | 'category' | 'status' | 'updatedAt'> & { category?: LeadCategory, status?: LeadStatusType },
  currentUser: User
): Promise<{ success: boolean; lead?: Lead; error?: string }> {
  await guard();
  try {
    const phoneRegex = /^(0\d{10}|\+\d{9,14})$/;
    if (!phoneRegex.test(leadData.phone)) {
      return { success: false, error: "Invalid phone number. Use 11 digits starting with 0, or an international number starting with + (up to 15 digits)." };
    }

    if (!isValidTemperature(leadData.temperature)) {
      return { success: false, error: "Invalid temperature value." };
    }

    const existingLead = await getLeadByPhone(leadData.phone);
    if (existingLead) {
      return { success: false, error: "A lead with this phone number already exists." };
    }

    const initialActivity: LeadActivity = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      activity: "Lead Created",
      notes: `Lead initially entered in ${LEAD_CATEGORY_LABELS[leadData.category || 'POP']}`,
      changedByUserId: currentUser.id,
      changedByUserName: currentUser.name,
    };

    const leadDataWithUser: Omit<Lead, 'id'> = {
      ...leadData,
      crmId: currentUser.id,
      crmName: currentUser.name,
      category: leadData.category || 'POP',
      status: leadData.status || 'New Lead',
      activityHistory: [initialActivity],
      updatedAt: new Date().toISOString(),
      categoryUpdatedAt: new Date().toISOString(),
    };
    const newLead = await addLead(leadDataWithUser);
    if (newLead) {
      revalidatePath("/(app)/pipeline");
      const io = getIO();
      if (io) io.emit("lead-updated", { id: newLead.id, type: 'create' });
      return { success: true, lead: newLead };
    }
    return { success: false, error: "Failed to add lead to database." };
  } catch (error) {
    console.error("Error in addLeadAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function addLeadActivityAction(
  leadId: string,
  activityData: { activity: string; notes?: string | null },
  currentUser: User,
  existingLead: Lead // Pass the current lead state from the client
): Promise<{ success: boolean; lead?: Lead; error?: string }> {
  await guard();
  try {
    const newActivity: LeadActivity = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      activity: activityData.activity,
      notes: activityData.notes || null,
      changedByUserId: currentUser.id,
      changedByUserName: currentUser.name,
    };

    // Use the client's state of the lead to avoid race conditions
    const updatedHistory = [...(existingLead.activityHistory || []), newActivity];
    const success = await updateLead(leadId, { activityHistory: updatedHistory, updatedAt: new Date().toISOString() });

    if (success) {
      // Revalidation is still useful for other clients.
      revalidatePath("/(app)/pipeline");
      const io = getIO();
      if (io) io.emit("lead-updated", { id: leadId, type: 'activity' });
      // For instant update, now fetch the definitive state from the DB.
      const updatedLead = await getLeadById(leadId);
      if (!updatedLead) {
        return { success: false, error: "Failed to retrieve updated lead after adding activity." };
      }
      return { success: true, lead: updatedLead };
    }
    return { success: false, error: "Failed to add activity to lead." };
  } catch (error) {
    console.error("Error in addLeadActivityAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function deleteLeadActivityAction(
  leadId: string,
  activityId: string,
  actingUser: User
): Promise<{ success: boolean; lead?: Lead; error?: string }> {
  await guard();
  if (actingUser.role !== 'SYSTEM_ADMIN') {
    return { success: false, error: "Permission denied." };
  }
  try {
    const lead = await getLeadById(leadId);
    if (!lead) {
      return { success: false, error: "Lead not found." };
    }

    const updatedHistory = lead.activityHistory?.filter(act => act.id !== activityId) || [];

    if (lead.activityHistory && updatedHistory.length === lead.activityHistory.length) {
      return { success: false, error: "Activity to delete was not found." };
    }

    const success = await updateLead(leadId, { activityHistory: updatedHistory, updatedAt: new Date().toISOString() });

    if (success) {
      revalidatePath("/(app)/pipeline");
      const io = getIO();
      if (io) io.emit("lead-updated", { id: leadId, type: 'activity-delete' });
      const updatedLead = await getLeadById(leadId);
      if (!updatedLead) {
        return { success: false, error: "Failed to retrieve updated lead after deleting activity." };
      }
      return { success: true, lead: updatedLead };
    }
    return { success: false, error: "Failed to delete activity from lead." };
  } catch (error) {
    console.error("Error in deleteLeadActivityAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}


export async function addLeadsBatchAction(
  leadsData: Omit<Lead, 'id' | 'crmId' | 'crmName'>[],
  currentUser: User
): Promise<{ success: boolean; createdCount: number; errorCount: number; errors: string[] }> {
  await guard();
  let createdCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (const lead of leadsData) {
    try {
      if (lead.phone) {
        const existingLead = await getLeadByPhone(lead.phone);
        if (existingLead) {
          errorCount++;
          errors.push(`Lead with phone number ${lead.phone} already exists (Contact: ${lead.contactName || 'Unknown'})`);
          continue;
        }
      }

      const leadDataWithUser = {
        ...lead,
        crmId: currentUser.id,
        crmName: currentUser.name,
        updatedAt: new Date().toISOString(),
      };
      const newLead = await addLead(leadDataWithUser);
      if (newLead) {
        createdCount++;
      } else {
        errorCount++;
        errors.push(`Failed to add lead for contact: ${lead.contactName || 'Unknown'}`);
      }
    } catch (error) {
      errorCount++;
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      errors.push(`Error for ${lead.contactName || 'Unknown'}: ${errorMessage}`);
    }
  }

  if (createdCount > 0) {
    revalidatePath("/(app)/pipeline");
    const io = getIO();
    if (io) io.emit("lead-updated", { type: 'batch-create', count: createdCount });
  }

  return {
    success: errorCount === 0,
    createdCount,
    errorCount,
    errors,
  };
}


export async function updateLeadAction(
  leadId: string,
  updates: Partial<Omit<Lead, 'id'>>,
  currentUser?: User
): Promise<{ success: boolean; lead?: Lead; error?: string }> {
  await guard();
  try {
    if (!isValidTemperature(updates.temperature)) {
      return { success: false, error: "Invalid temperature value." };
    }

    if (updates.phone) {
      const phoneRegex = /^(0\d{10}|\+\d{9,14})$/;
      if (!phoneRegex.test(updates.phone)) {
        return { success: false, error: "Invalid phone number. Use 11 digits starting with 0, or an international number starting with + (up to 15 digits)." };
      }

      const existingLead = await getLeadByPhone(updates.phone);
      if (existingLead && existingLead.id !== leadId) {
        return { success: false, error: "A lead with this phone number already exists." };
      }
    }

    const currentLead = await getLeadById(leadId);
    if (!currentLead) {
      return { success: false, error: "Lead not found." };
    }

    const finalUpdates: any = { 
      ...updates, 
      date: new Date().toISOString(),
      categoryUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString() 
    };

    // Check if notes or CR owner changed
    const activitiesToAdd: LeadActivity[] = [];

    if (updates.notes !== undefined && updates.notes !== currentLead.notes) {
      activitiesToAdd.push({
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        activity: "Note Updated",
        notes: updates.notes,
        changedByUserId: currentUser?.id || "SYSTEM",
        changedByUserName: currentUser?.name || "System",
      });
    }

    if (updates.crmId !== undefined && updates.crmId !== currentLead.crmId) {
      activitiesToAdd.push({
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        activity: "Lead Reassigned",
        notes: `Lead assigned to ${updates.crmName || 'a new owner'}`,
        changedByUserId: currentUser?.id || "SYSTEM",
        changedByUserName: currentUser?.name || "System",
      });
    }

    if (activitiesToAdd.length > 0) {
      finalUpdates.activityHistory = [...(currentLead.activityHistory || []), ...activitiesToAdd];
    }

    const success = await updateLead(leadId, finalUpdates);
    if (success) {
      revalidatePath("/(app)/pipeline");
      const io = getIO();
      if (io) io.emit("lead-updated", { id: leadId, type: 'update' });
      const updatedLead = await getLeadById(leadId);
      return { success: true, lead: updatedLead || undefined };
    }
    return { success: false, error: "Failed to update lead in database." };
  } catch (error) {
    console.error("Error in updateLeadAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function deleteLeadAction(leadId: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  try {
    const success = await deleteLead(leadId);
    if (success) {
      revalidatePath("/(app)/pipeline");
      const io = getIO();
      if (io) io.emit("lead-updated", { id: leadId, type: 'delete' });
      return { success: true };
    }
    return { success: false, error: "Failed to delete lead from database." };
  } catch (error) {
    console.error("Error in deleteLeadAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function transferLeadAction(
  leadId: string,
  newCrmId: string,
  actingUser: User
): Promise<{ success: boolean; error?: string }> {
  await guard();
  if (!['ADMIN', 'SYSTEM_ADMIN', 'CR'].includes(actingUser.role)) {
    return { success: false, error: "Permission denied." };
  }
  try {
    const newCrmUser = await getUserFromDb(newCrmId);
    if (!newCrmUser) {
      return { success: false, error: "The new assigned user was not found." };
    }

    const updates = {
      crmId: newCrmUser.id,
      crmName: newCrmUser.name,
      updatedAt: new Date().toISOString(),
    };

    const success = await updateLead(leadId, updates);
    if (success) {
      revalidatePath("/(app)/pipeline");
      const io = getIO();
      if (io) io.emit("lead-updated", { id: leadId, type: 'transfer' });
      return { success: true };
    }
    return { success: false, error: "Failed to update lead in the database during transfer." };
  } catch (error) {
    console.error("Error in transferLeadAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred during lead transfer." };
  }
}

export async function transferLeadsBatchAction(
  sourceCrmId: string,
  targetCrmIds: string[],
  numberOfLeadsPerCrm: number,
  actingUser: User
): Promise<{ success: boolean, transferredCount: number, error?: string }> {
  await guard();
  if (!['ADMIN', 'SYSTEM_ADMIN'].includes(actingUser.role)) {
    return { success: false, transferredCount: 0, error: "Permission denied." };
  }

  try {
    const allLeads = await getLeadsFromDb();

    let leadsToTransfer: Lead[];
    if (sourceCrmId === 'unassigned') {
      leadsToTransfer = allLeads.filter(lead => !lead.crmId);
    } else if (sourceCrmId === 'all') {
      leadsToTransfer = allLeads;
    } else if (sourceCrmId.startsWith('[Deleted User:')) {
      const deletedUserId = sourceCrmId.substring(15, sourceCrmId.length - 1);
      leadsToTransfer = allLeads.filter(lead => lead.crmId === deletedUserId);
    } else {
      leadsToTransfer = allLeads.filter(lead => lead.crmId === sourceCrmId);
    }

    if (leadsToTransfer.length === 0) {
      return { success: true, transferredCount: 0, error: "No leads found for the selected source." };
    }

    let availableLeads = [...leadsToTransfer];
    let totalTransferredCount = 0;

    for (const targetCrmId of targetCrmIds) {
      const targetCrmUser = await getUserFromDb(targetCrmId);
      if (!targetCrmUser) {
        console.warn(`Target CR user with ID ${targetCrmId} not found. Skipping.`);
        continue;
      }

      const leadsForThisTarget = availableLeads.filter(lead => lead.crmId !== targetCrmId);
      const shuffledLeads = [...leadsForThisTarget].sort(() => 0.5 - Math.random());
      const leadsToAssign = shuffledLeads.slice(0, numberOfLeadsPerCrm);

      if (leadsToAssign.length === 0) {
        continue;
      }

      const updatePromises: Promise<boolean>[] = [];
      for (const lead of leadsToAssign) {
        const updates = {
          crmId: targetCrmUser.id,
          crmName: targetCrmUser.name,
          updatedAt: new Date().toISOString(),
        };
        updatePromises.push(updateLead(lead.id, updates));
      }

      const results = await Promise.all(updatePromises);
      const successfulCount = results.filter(Boolean).length;
      totalTransferredCount += successfulCount;

      const assignedLeadIds = new Set(leadsToAssign.map(l => l.id));
      availableLeads = availableLeads.filter(l => !assignedLeadIds.has(l.id));
    }

    if (totalTransferredCount > 0) {
      revalidatePath("/(app)/pipeline");
    }

    return { success: true, transferredCount: totalTransferredCount };

  } catch (error) {
    console.error("Error in transferLeadsBatchAction:", error);
    return { success: false, transferredCount: 0, error: error instanceof Error ? error.message : "An unexpected error occurred during bulk transfer." };
  }
}

export async function transferSelectedLeadsAction(
  leadIds: string[],
  targetCrmId: string,
  actingUser: User
): Promise<{ success: boolean; transferredCount: number; error?: string }> {
  await guard();
  if (!['ADMIN', 'SYSTEM_ADMIN', 'CR'].includes(actingUser.role)) {
    return { success: false, transferredCount: 0, error: "Permission denied." };
  }
  if (leadIds.length === 0) {
    return { success: false, transferredCount: 0, error: "No leads were selected for transfer." };
  }

  try {
    const targetCrmUser = await getUserFromDb(targetCrmId);
    if (!targetCrmUser) {
      return { success: false, transferredCount: 0, error: "The target CR user was not found." };
    }

    const updates = {
      crmId: targetCrmUser.id,
      crmName: targetCrmUser.name,
      updatedAt: new Date().toISOString(),
    };

    let successfulTransfers = 0;

    for (const leadId of leadIds) {
      try {
        const success = await updateLead(leadId, updates);
        if (success) {
          successfulTransfers++;
        }
      } catch (error) {
        console.error(`Failed to transfer lead ${leadId}:`, error);
      }
    }


    if (successfulTransfers > 0) {
      revalidatePath("/(app)/pipeline");
    }

    if (successfulTransfers < leadIds.length) {
      return {
        success: false,
        transferredCount: successfulTransfers,
        error: `Could not transfer all selected leads. ${successfulTransfers} of ${leadIds.length} were successful.`,
      };
    }

    return { success: true, transferredCount: successfulTransfers };
  } catch (error) {
    console.error("Error in transferSelectedLeadsAction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return { success: false, transferredCount: 0, error: errorMessage };
  }
}

export async function getLeadByPhoneAction(phone: string): Promise<Lead | null> {
  await guard();
  try {
    return await getLeadByPhone(phone);
  } catch (error) {
    console.error("Error in getLeadByPhoneAction:", error);
    return null;
  }
}

export async function getUniqueLeadCrmIdsAction(): Promise<Array<{ crmId: string; crmName: string }>> {
  await guard();
  try {
    return await getUniqueLeadCrmIds();
  } catch (error) {
    console.error("Error in getUniqueLeadCrmIdsAction:", error);
    return [];
  }
}
