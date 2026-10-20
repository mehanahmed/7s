
"use server";

import { revalidatePath } from "next/cache";
import type { UserRole } from '@/types';
import { addFaq as addFaqService, updateFaq as updateFaqService, deleteFaq as deleteFaqService } from '@/lib/faq-service';
import { guard } from '@/lib/guard';

export async function addFaqAction(
  question: string,
  answer: string,
  role: UserRole | 'ALL'
): Promise<{ success: boolean; error?: string }> {
  await guard();
  try {
    if (!question.trim() || !answer.trim()) {
      return { success: false, error: "Question and Answer are required." };
    }

    const newFaq = await addFaqService({ question, answer, role });

    if (newFaq) {
      // This revalidation might not be strictly necessary if the dialog refetches,
      // but it's good practice for data consistency across the app.
      revalidatePath("/(app)/layout", "layout"); 
      return { success: true };
    }
    return { success: false, error: "Failed to add FAQ to the database." };
  } catch (error) {
    console.error("Error in addFaqAction:", error);
    return { success: false, error: "An unexpected server error occurred." };
  }
}

export async function updateFaqAction(
  faqId: string,
  question: string,
  answer: string,
  role: UserRole | 'ALL'
): Promise<{ success: boolean; error?: string }> {
  await guard();
  try {
    if (!question.trim() || !answer.trim()) {
      return { success: false, error: "Question and Answer are required." };
    }
    const success = await updateFaqService(faqId, { question, answer, role });
    if (success) {
      revalidatePath("/(app)/layout", "layout");
      return { success: true };
    }
    return { success: false, error: "Failed to update FAQ in the database." };
  } catch (error) {
    console.error("Error in updateFaqAction:", error);
    return { success: false, error: "An unexpected server error occurred." };
  }
}

export async function deleteFaqAction(faqId: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  try {
    const success = await deleteFaqService(faqId);
    if (success) {
      revalidatePath("/(app)/layout", "layout");
      return { success: true };
    }
    return { success: false, error: "Failed to delete FAQ from the database." };
  } catch (error) {
    console.error("Error in deleteFaqAction:", error);
    return { success: false, error: "An unexpected server error occurred." };
  }
}
