
"use server";

import { revalidatePath } from "next/cache";
import type { SowDataEntry, User } from "@/types";
import { addSowEntry } from "@/lib/sow-service";
import { guard } from '@/lib/guard';

export async function addSowEntryAction(
  data: Omit<SowDataEntry, 'id' | 'crmUserId' | 'crmUserName'>,
  currentUser: User
): Promise<{ success: boolean; data?: SowDataEntry; error?: string }> {
  await guard();
  try {
    const phoneRegex = /^0\d{10}$/;
    if (!phoneRegex.test(data.phoneNumber)) {
      return { success: false, error: "Invalid phone number. It must be an 11-digit number starting with 0." };
    }
    
    const dataWithUser = {
      ...data,
      crmUserId: currentUser.id,
      crmUserName: currentUser.name,
      // createdAt is now passed from the dialog
    };

    const newEntry = await addSowEntry(dataWithUser);
    if (newEntry) {
      revalidatePath("/(app)/crm/sow");
      return { success: true, data: newEntry };
    }
    return { success: false, error: "Failed to add SOW entry to database." };
  } catch (error) {
    console.error("Error in addSowEntryAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}
