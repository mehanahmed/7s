
"use server";

import { revalidatePath } from "next/cache";
import {
  addModel,
  updateModel,
  deleteModel,
  addLamination,
  updateLamination,
  deleteLamination,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  addGift,
  updateGift,
  deleteGift,
  addCourierNote,
  updateCourierNote,
  deleteCourierNote,
  addVariation,
  updateVariation,
  deleteVariation,
} from "@/lib/service-options-service";
import type { ServiceModelItem, ServiceLaminationItem, ServicePaymentMethodItem, ServiceGiftItem, ServiceCourierNoteItem, ServiceVariationItem } from "@/types";
import { guard, requireRole } from '@/lib/guard';

const SERVICE_MANAGEMENT_PATH = "/(app)/admin/service-management";
const MODEL_MANAGEMENT_PATH = "/(app)/admin/model-management";
const CREATE_ORDER_DIALOG_REVALIDATION_TARGET = "/(app)/orders"; // To refresh CreateOrderDialog options

// Model Actions
export async function addModelAction(name: string, imageUrl?: string | null, description?: string | null): Promise<{ success: boolean; model?: ServiceModelItem; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const newModel = await addModel(name, imageUrl, description);
    if (newModel) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(MODEL_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true, model: newModel };
    }
    return { success: false, error: "Failed to add model to database." };
  } catch (error) {
    console.error("Error in addModelAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateModelAction(id: string, name: string, imageUrl?: string | null, description?: string | null): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const success = await updateModel(id, name, imageUrl, description);
    if (success) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(MODEL_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true };
    }
    return { success: false, error: "Failed to update model in database." };
  } catch (error) {
    console.error("Error in updateModelAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function deleteModelAction(id: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const success = await deleteModel(id);
    if (success) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(MODEL_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true };
    }
    return { success: false, error: "Failed to delete model from database. It might be in use by existing orders." };
  } catch (error) {
    console.error("Error in deleteModelAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

// Lamination Actions
export async function addLaminationAction(name: string): Promise<{ success: boolean; lamination?: ServiceLaminationItem; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const newLamination = await addLamination(name);
    if (newLamination) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true, lamination: newLamination };
    }
    return { success: false, error: "Failed to add lamination to database." };
  } catch (error) {
    console.error("Error in addLaminationAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateLaminationAction(id: string, name: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const success = await updateLamination(id, name);
    if (success) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true };
    }
    return { success: false, error: "Failed to update lamination in database." };
  } catch (error) {
    console.error("Error in updateLaminationAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function deleteLaminationAction(id: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const success = await deleteLamination(id);
    if (success) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true };
    }
    return { success: false, error: "Failed to delete lamination from database. It might be in use by existing orders." };
  } catch (error) {
    console.error("Error in deleteLaminationAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

// Payment Method Actions
export async function addPaymentMethodAction(name: string): Promise<{ success: boolean; paymentMethod?: ServicePaymentMethodItem; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const newPaymentMethod = await addPaymentMethod(name);
    if (newPaymentMethod) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true, paymentMethod: newPaymentMethod };
    }
    return { success: false, error: "Failed to add payment method to database." };
  } catch (error) {
    console.error("Error in addPaymentMethodAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updatePaymentMethodAction(id: string, name: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const success = await updatePaymentMethod(id, name);
    if (success) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true };
    }
    return { success: false, error: "Failed to update payment method in database." };
  } catch (error) {
    console.error("Error in updatePaymentMethodAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function deletePaymentMethodAction(id: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const success = await deletePaymentMethod(id);
    if (success) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true };
    }
    return { success: false, error: "Failed to delete payment method from database. It might be in use by existing orders." };
  } catch (error) {
    console.error("Error in deletePaymentMethodAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

// Gift Actions
export async function addGiftAction(name: string): Promise<{ success: boolean; gift?: ServiceGiftItem; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const newGift = await addGift(name);
    if (newGift) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true, gift: newGift };
    }
    return { success: false, error: "Failed to add gift to database." };
  } catch (error) {
    console.error("Error in addGiftAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateGiftAction(id: string, name: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const success = await updateGift(id, name);
    if (success) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true };
    }
    return { success: false, error: "Failed to update gift in database." };
  } catch (error) {
    console.error("Error in updateGiftAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function deleteGiftAction(id: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const success = await deleteGift(id);
    if (success) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true };
    }
    return { success: false, error: "Failed to delete gift from database. It might be in use by existing orders." };
  } catch (error) {
    console.error("Error in deleteGiftAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

// Courier Note Actions
export async function addCourierNoteAction(name: string): Promise<{ success: boolean; courierNote?: ServiceCourierNoteItem; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const newCourierNote = await addCourierNote(name);
    if (newCourierNote) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true, courierNote: newCourierNote };
    }
    return { success: false, error: "Failed to add courier note to database." };
  } catch (error) {
    console.error("Error in addCourierNoteAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateCourierNoteAction(id: string, name: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const success = await updateCourierNote(id, name);
    if (success) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true };
    }
    return { success: false, error: "Failed to update courier note in database." };
  } catch (error) {
    console.error("Error in updateCourierNoteAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function deleteCourierNoteAction(id: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const success = await deleteCourierNote(id);
    if (success) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true };
    }
    return { success: false, error: "Failed to delete courier note from database." };
  } catch (error) {
    console.error("Error in deleteCourierNoteAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

// Variation Actions
export async function addVariationAction(name: string): Promise<{ success: boolean; variation?: ServiceVariationItem; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const newVariation = await addVariation(name);
    if (newVariation) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true, variation: newVariation };
    }
    return { success: false, error: "Failed to add variation to database." };
  } catch (error) {
    console.error("Error in addVariationAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateVariationAction(id: string, name: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const success = await updateVariation(id, name);
    if (success) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true };
    }
    return { success: false, error: "Failed to update variation in database." };
  } catch (error) {
    console.error("Error in updateVariationAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function deleteVariationAction(id: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN','ADMIN']);
  try {
    const success = await deleteVariation(id);
    if (success) {
      revalidatePath(SERVICE_MANAGEMENT_PATH);
      revalidatePath(CREATE_ORDER_DIALOG_REVALIDATION_TARGET);
      return { success: true };
    }
    return { success: false, error: "Failed to delete variation from database." };
  } catch (error) {
    console.error("Error in deleteVariationAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}
