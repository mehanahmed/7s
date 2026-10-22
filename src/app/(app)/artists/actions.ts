

"use server";

import { revalidatePath } from "next/cache";
import type { BillReport } from "@/types";
import { addBillReport as addBillReportService } from '@/lib/bill-report-service';
import { guard, requireRole } from '@/lib/guard';
import { DEFAULT_ARTIST_CATEGORIES } from '@/types';
import { getArtistCategories } from '@/lib/user-service';
import { getGlobalSettings, setArtistCategories } from '@/lib/settings-service';


export async function addBillReportAction(
  reportData: Omit<BillReport, 'id'>
): Promise<{ success: boolean; report?: BillReport; error?: string }> {
  await guard();
  try {
    if (!reportData.vendorId || !reportData.invoiceId || !reportData.amount) {
      return { success: false, error: "Missing required bill data." };
    }
    // When adding a bill, payment is always 0 initially.
    const dataWithZeroPayment = {
      ...reportData,
      payment: 0,
      method: 'N/A' // Default method for a bill with no payment yet
    };
    const newReport = await addBillReportService(dataWithZeroPayment);
    if (newReport) {
      revalidatePath("/(app)/artists");
      return { success: true, report: newReport };
    }
    return { success: false, error: "Failed to add bill report to the database." };
  } catch (error) {
    console.error("Error in addBillReportAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function addBillPaymentAction(
  reportData: Omit<BillReport, 'id'>
): Promise<{ success: boolean; report?: BillReport; error?: string }> {
  await guard();
  try {
    if (!reportData.vendorId || !reportData.payment || !reportData.method) {
      return { success: false, error: "Missing required payment data." };
    }
    // When adding a payment, the amount is 0 and invoice ID is a placeholder.
    const dataWithZeroAmount = {
      ...reportData,
      invoiceId: `PAY-${Date.now()}`,
      amount: 0,
    };
    const newReport = await addBillReportService(dataWithZeroAmount);
    if (newReport) {
      revalidatePath("/(app)/artists");
      return { success: true, report: newReport };
    }
    return { success: false, error: "Failed to add bill payment to the database." };
  } catch (error) {
    console.error("Error in addBillPaymentAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateBillReportAction(
  id: string,
  updates: Partial<BillReport>
): Promise<{ success: boolean; error?: string }> {
  await guard();
  try {
    const { updateBillReport } = await import('@/lib/bill-report-service');
    const success = await updateBillReport(id, updates);
    if (success) {
      revalidatePath("/(app)/artists");
      return { success: true };
    }
    return { success: false, error: "Failed to update bill report in the database." };
  } catch (error) {
    console.error("Error in updateBillReportAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}


export async function getArtistCategoriesAction(): Promise<{
  defaults: string[];
  custom: string[];
  all: string[];
}> {
  await guard();
  const settings = await getGlobalSettings();
  const custom = settings.artistCategories || [];
  const all = await getArtistCategories();
  return {
    defaults: DEFAULT_ARTIST_CATEGORIES,
    custom,
    all,
  };
}

export async function addArtistCategoryAction(categoryName: string): Promise<{
  success: boolean;
  error?: string;
  categories?: { defaults: string[]; custom: string[]; all: string[] };
}> {
  await requireRole(['SYSTEM_ADMIN', 'ADMIN']);
  try {
    const trimmed = categoryName.trim();
    if (!trimmed) {
      return { success: false, error: 'Category name cannot be empty.' };
    }
    if (trimmed.length > 50) {
      return { success: false, error: 'Category name is too long (max 50 characters).' };
    }

    const settings = await getGlobalSettings();
    const existingCustom = settings.artistCategories || [];
    const all = await getArtistCategories();

    if (all.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, error: `Category "${trimmed}" already exists.` };
    }

    const updated = [...existingCustom, trimmed];
    await setArtistCategories(updated);
    revalidatePath("/(app)/artists");

    const newAll = await getArtistCategories();
    return {
      success: true,
      categories: {
        defaults: DEFAULT_ARTIST_CATEGORIES,
        custom: updated,
        all: newAll,
      },
    };
  } catch (error) {
    console.error("Error in addArtistCategoryAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to add category." };
  }
}

export async function deleteArtistCategoryAction(categoryName: string): Promise<{
  success: boolean;
  error?: string;
  categories?: { defaults: string[]; custom: string[]; all: string[] };
}> {
  await requireRole(['SYSTEM_ADMIN', 'ADMIN']);
  try {
    const trimmed = categoryName.trim();
    if (DEFAULT_ARTIST_CATEGORIES.some(d => d.toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, error: 'Cannot delete default system category.' };
    }

    const settings = await getGlobalSettings();
    const existingCustom = settings.artistCategories || [];
    const updated = existingCustom.filter(c => c.toLowerCase() !== trimmed.toLowerCase());
    await setArtistCategories(updated);
    revalidatePath("/(app)/artists");

    const newAll = await getArtistCategories();
    return {
      success: true,
      categories: {
        defaults: DEFAULT_ARTIST_CATEGORIES,
        custom: updated,
        all: newAll,
      },
    };
  } catch (error) {
    console.error("Error in deleteArtistCategoryAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete category." };
  }
}
