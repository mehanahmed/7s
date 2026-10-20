

"use server";

import { revalidatePath } from "next/cache";
import type { Dr2oEntry } from "@/types";
import {
  addDr2oEntry,
  updateDr2oEntry,
  deleteDr2oEntry,
} from "@/lib/dr2o-service";
import { guard } from '@/lib/guard';

export async function addDr2oEntryAction(
  data: Omit<Dr2oEntry, 'id'>,
  team: 'CR' | 'DR' | 'LR' | 'CO'
): Promise<{ success: boolean; data?: Dr2oEntry; error?: string }> {
  await guard();
  try {
    const newEntry = await addDr2oEntry(data, team);
    if (newEntry) {
      revalidatePath("/(app)/workflow");
      return { success: true, data: newEntry };
    }
    return { success: false, error: "Failed to add DR 2.O entry to database." };
  } catch (error) {
    console.error("Error in addDr2oEntryAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateDr2oEntryAction(
  id: string,
  updates: Partial<Omit<Dr2oEntry, 'id'>>,
  team: 'CR' | 'DR' | 'LR' | 'CO'
): Promise<{ success: boolean; data?: Dr2oEntry; error?: string }> {
  await guard();
    try {
        const success = await updateDr2oEntry(id, updates, team);
        if (success) {
            revalidatePath("/(app)/workflow");
            return { success: true };
        }
        return { success: false, error: "Failed to update DR 2.O entry." };
    } catch (error) {
        console.error("Error in updateDr2oEntryAction:", error);
        return { success: false, error: error instanceof Error ? error.message : "An unexpected server error occurred." };
    }
}

export async function deleteDr2oEntryAction(
    id: string,
    team: 'CR' | 'DR' | 'LR' | 'CO'
): Promise<{ success: boolean; error?: string }> {
  await guard();
    try {
        const success = await deleteDr2oEntry(id, team);
        if (success) {
            revalidatePath("/(app)/workflow");
            return { success: true };
        }
        return { success: false, error: "Failed to delete entry from database." };
    } catch (error) {
        console.error("Error in deleteDr2oEntryAction:", error);
        return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
    }
}
