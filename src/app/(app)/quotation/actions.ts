

"use server";

import { revalidatePath } from "next/cache";
import type { TrackingLink, User, OrderItem, AdvancePaymentRecord, ServiceModelItem, OrderLogEntry } from "@/types";
import { 
  addQuotation as addQuotationService, 
  getQuotationById, 
  deleteQuotation as deleteQuotationFromDb, 
  updateQuotation as updateQuotationService,
  getDeletedQuotations,
  restoreQuotation as restoreQuotationFromDb,
  permanentlyDeleteQuotation as permanentlyDeleteQuotationFromDb
} from "@/lib/quotation-service";
import { getGlobalSettings } from "@/lib/settings-service";
import { v4 as uuidv4 } from 'uuid';
import { parseISO } from 'date-fns';
import { getUserById as getUserFromDb } from "@/lib/user-service";
import { getModels } from '@/lib/service-options-service';
import { guard, requireRole } from '@/lib/guard';
import { getSessionUser } from '@/lib/session';



interface CreateQuotationDialogFormData {
  jobId: string;
  companyName: string;
  address: string;
  phoneNumber: string;
  createdAt: string;
  orderItems: Array<{
    id: string;
    model: string;
    quantity: number;
    lamination: string;
    variation?: string;
    unit?: string;
    unitPrice: number | null;
    lineItemTotalPrice: number | null;
    isGift?: boolean;
  }>;
  advancePaymentAmount?: number | null;
  advancePaymentMethod?: string | null;
  advancePaymentDocumentUrl?: string | null;
  specialClientDiscount?: number | null;
  customPaymentMethodText?: string;
  orderNotes?: string | null;
  initialStatusId: string;
}

export async function createQuotationAction(
  data: CreateQuotationDialogFormData,
  currentUser: User
): Promise<TrackingLink | { error: string }> {
  await guard();
  try {
    if (!currentUser || !currentUser.id || !currentUser.name) {
      return { error: "User information is missing. Please re-authenticate." };
    }
    if (!data.jobId?.trim()) return { error: "Contact Person is required." };
    if (!data.companyName?.trim()) return { error: "Company Name is required." };
    if (!data.address?.trim()) return { error: "Address is required." };

    const phoneNumber = data.phoneNumber?.trim();
    if (!phoneNumber) return { error: "Phone Number is required." };
    const phoneRegex = /^0\d{10}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return { error: "Invalid phone number. It must be an 11-digit number starting with 0." };
    }

    if (!data.initialStatusId) return { error: "Initial status ID is required." };
    if (!data.createdAt) return { error: "Quotation creation date is required." };
    try {
      parseISO(data.createdAt);
    } catch (e) {
      return { error: "Invalid quotation creation date format." };
    }
    if (!data.orderItems || data.orderItems.length === 0) {
      return { error: "At least one quotation item is required." };
    }

    const allModels = await getModels();
    let orderItemsTotal = 0;
    const processedOrderItems: OrderItem[] = [];
    for (const item of data.orderItems) {
      if (!item.model?.trim()) return { error: `Model is required for all quotation items.` };
      const quantity = item.quantity;
      if (isNaN(quantity) || quantity < 0) return { error: `Invalid quantity for model "${item.model}". Quantity must be a non-negative number.` };

      const lamination = item.lamination?.trim() || 'N/A';

      const unitPrice = item.unitPrice === undefined || item.unitPrice === null || isNaN(Number(item.unitPrice)) ? 0 : Number(item.unitPrice);
      const lineItemTotalPrice = item.lineItemTotalPrice === undefined || item.lineItemTotalPrice === null || isNaN(Number(item.lineItemTotalPrice)) ? 0 : Number(item.lineItemTotalPrice);


      processedOrderItems.push({
        id: item.id || uuidv4(),
        model: item.model.trim(),
        quantity: quantity,
        lamination: lamination,
        variation: item.variation?.trim() || undefined,
        unit: item.unit?.trim() || undefined,
        unitPrice: unitPrice,
        lineItemTotalPrice: lineItemTotalPrice,
        isGift: item.isGift || false,
      });
      orderItemsTotal += (item.isGift ? 0 : lineItemTotalPrice);
    }

    if (data.specialClientDiscount !== null && data.specialClientDiscount !== undefined && data.specialClientDiscount < 0) {
      return { error: "Special Client Discount must be a non-negative number." };
    }
    if (data.specialClientDiscount !== null && data.specialClientDiscount !== undefined && data.specialClientDiscount > orderItemsTotal && orderItemsTotal > 0) {
      return { error: "Special Client Discount cannot exceed the total quotation price." };
    }

    let parsedAdvancePaymentAmount: number | null = null;
    if (data.advancePaymentAmount !== null && data.advancePaymentAmount !== undefined) {
      const numAdvancePayment = Number(data.advancePaymentAmount);
      if (isNaN(numAdvancePayment) || numAdvancePayment < 0) return { error: "Advance Payment Amount must be a non-negative number." };
      parsedAdvancePaymentAmount = numAdvancePayment;
    }

    const netPayable = orderItemsTotal - (data.specialClientDiscount || 0);
    const grandTotal = netPayable;
    if (parsedAdvancePaymentAmount !== null && parsedAdvancePaymentAmount > grandTotal && grandTotal > 0) {
      return { error: `Advance payment (${parsedAdvancePaymentAmount}) cannot exceed grand total amount (${grandTotal}).` };
    }

    let finalAdvancePaymentMethod: string | null = null;
    if (parsedAdvancePaymentAmount !== null && parsedAdvancePaymentAmount > 0) {
      if (data.advancePaymentMethod && typeof data.advancePaymentMethod === 'string' && data.advancePaymentMethod.trim() !== '') {
        if (data.advancePaymentMethod.toLowerCase() === 'other') {
          if (!data.customPaymentMethodText || !data.customPaymentMethodText.trim()) return { error: "Please specify the 'Other' payment method for the advance." };
          finalAdvancePaymentMethod = data.customPaymentMethodText.trim();
        } else {
          finalAdvancePaymentMethod = data.advancePaymentMethod.trim();
        }
      } else {
        return { error: "Payment Method is required when Advance Payment is entered." };
      }
    }

    // VAT is read from the admin setting on the server and stored on the quotation, so later changes do not alter it.
    const vatPercentage = Number((await getGlobalSettings()).vatPercentage) || 0;

    const finalCombinedCompanyName = `${data.jobId.trim()} • ${data.companyName.trim()}`;

    const newQuotationDataForService = {
      companyName: finalCombinedCompanyName,
      address: data.address.trim(),
      phoneNumber: phoneNumber,
      createdAt: data.createdAt,
      orderItems: processedOrderItems,
      advancePaymentAmount: parsedAdvancePaymentAmount,
      advancePaymentMethod: finalAdvancePaymentMethod,
      advancePaymentDocumentUrl: data.advancePaymentDocumentUrl || null,
      vatPercentage: vatPercentage > 0 ? vatPercentage : null,
      specialClientDiscount: data.specialClientDiscount,
      shippingCharge: null,
      orderNotes: data.orderNotes?.trim() || null,
      initialStatusId: data.initialStatusId,
      crmUserId: currentUser.id,
      crmUserName: currentUser.name,
    };

    let createdQuotation: TrackingLink | null = null;
    try {
      createdQuotation = await addQuotationService(newQuotationDataForService);
    } catch (err: any) {
      console.error("addQuotationService error:", err);
      return { error: err?.message || "Failed to create quotation due to a database service error." };
    }

    if (!createdQuotation) return { error: "Failed to create quotation due to a service error." };

    revalidatePath("/(app)/quotation");
    return createdQuotation;

  } catch (error: any) {
    console.error("Unexpected error in createQuotationAction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected server error occurred. Please try again later.";
    return { error: errorMessage };
  }
}

export async function updateQuotationAction(
  quotationId: string,
  updates: Partial<TrackingLink> & {
    specialClientDiscountString?: string | null;
    newAdvancePaymentAmount?: number | null;
    newAdvancePaymentMethod?: string | null;
    newAdvancePaymentNotes?: string | null;
  },
  currentUser: User
): Promise<{ success: boolean; error?: string; quotation?: TrackingLink }> {
  await guard();
  if (!currentUser || !currentUser.role) {
    return { success: false, error: "User authentication error. Please log in again." };
  }

  try {
    if (!quotationId) return { success: false, error: "Quotation ID is required." };

    const existingQuotation = await getQuotationById(quotationId);
    if (!existingQuotation) return { success: false, error: `Quotation with ID ${quotationId} not found.` };

    let currentOrderItemsTotal = (updates.orderItems || existingQuotation.orderItems).reduce((sum, item) => sum + (item.isGift ? 0 : (item.lineItemTotalPrice || 0)), 0);

    const finalUpdates: any = { ...updates };
    delete finalUpdates.newAdvancePaymentAmount;
    delete finalUpdates.newAdvancePaymentMethod;
    delete finalUpdates.newAdvancePaymentNotes;
    delete finalUpdates.specialClientDiscountString;

    if (updates.createdAt) {
      try {
        finalUpdates.createdAt = parseISO(updates.createdAt).toISOString();
      } catch (e) {
        return { success: false, error: "Invalid Date Created format." };
      }
    }

    if (updates.shippingCharge !== undefined) {
      const charge = Number(updates.shippingCharge);
      if (isNaN(charge) || charge < 0) {
        return { success: false, error: "Shipping charge must be a non-negative number." };
      }
      finalUpdates.shippingCharge = charge > 0 ? charge : null;
    }

    if (updates.specialClientDiscountString !== undefined) {
      if (updates.specialClientDiscountString && updates.specialClientDiscountString.trim() !== '') {
        const discountStr = updates.specialClientDiscountString.trim();
        let numericDiscount = 0;
        if (discountStr.endsWith('%')) {
          const percentage = parseFloat(discountStr.substring(0, discountStr.length - 1));
          if (isNaN(percentage) || percentage < 0) return { success: false, error: "Invalid percentage for Special Client Discount." };
          numericDiscount = (percentage / 100) * currentOrderItemsTotal;
        } else {
          const fixedAmount = parseFloat(discountStr);
          if (isNaN(fixedAmount) || fixedAmount < 0) return { success: false, error: "Special Client Discount must be a non-negative number." };
          numericDiscount = fixedAmount;
        }
        if (numericDiscount > currentOrderItemsTotal && currentOrderItemsTotal > 0) return { success: false, error: "Special Client Discount cannot exceed the total quotation price." };
        finalUpdates.specialClientDiscount = numericDiscount;
      } else {
        finalUpdates.specialClientDiscount = null;
      }
    }

    if (updates.companyName !== undefined && !updates.companyName.trim()) return { success: false, error: "Company Name (Contact Person • Name) cannot be empty." };
    if (updates.address !== undefined && !updates.address.trim()) return { success: false, error: "Address cannot be empty." };

    if (updates.phoneNumber !== undefined) {
      const phoneNumber = updates.phoneNumber.trim();
      if (!phoneNumber) return { success: false, error: "Phone Number cannot be empty." };
      const phoneRegex = /^0\d{10}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return { success: false, error: "Invalid phone number. It must be an 11-digit number starting with 0." };
      }
      finalUpdates.phoneNumber = phoneNumber;
    }

    if (updates.orderNotes !== undefined) finalUpdates.orderNotes = updates.orderNotes?.trim() || null;

    if (updates.orderItems) {
      if (!Array.isArray(updates.orderItems) || updates.orderItems.length === 0) return { success: false, error: "Quotation must have at least one item." };
      finalUpdates.orderItems = updates.orderItems;
    }


    if (updates.newAdvancePaymentAmount && updates.newAdvancePaymentAmount > 0) {
      if (!updates.newAdvancePaymentMethod || !updates.newAdvancePaymentMethod.trim()) {
        return { success: false, error: "Payment method is required for new advance payment." };
      }
      const newAdvanceRecord: AdvancePaymentRecord = {
        id: uuidv4(),
        amount: updates.newAdvancePaymentAmount,
        date: new Date().toISOString(),
        paymentMethod: updates.newAdvancePaymentMethod,
        notes: updates.newAdvancePaymentNotes?.trim() || null,
        recordedByUserId: currentUser.id,
        recordedByUserName: currentUser.name,
      };
      finalUpdates.advancePayments = [...(existingQuotation.advancePayments || []), newAdvanceRecord];

    } else if (updates.advancePayments) {
      finalUpdates.advancePayments = updates.advancePayments;
    }

    if (Object.keys(finalUpdates).length === 0 && updates.specialClientDiscountString === undefined) {
      return { success: true, quotation: existingQuotation, error: "No changes detected to save." };
    }

    finalUpdates.updatedAt = new Date().toISOString();
    finalUpdates.updatedByUserId = currentUser.id;
    finalUpdates.updatedByUserName = currentUser.name;

    const success = await updateQuotationService(quotationId, finalUpdates);
    if (!success) return { success: false, error: "Failed to update quotation in database." };

    const updatedQuotation = await getQuotationById(quotationId);
    if (!updatedQuotation) return { success: false, error: "Failed to retrieve updated quotation after update." };

    revalidatePath("/(app)/quotation");
    revalidatePath(`/track/${quotationId}`);

    return { success: true, quotation: updatedQuotation };
  } catch (error: any) {
    console.error("Unexpected error in updateQuotationAction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected server error occurred while updating quotation.";
    return { success: false, error: errorMessage };
  }
}

export async function updateQuotationStatusAction(
  quotationId: string,
  newStatus: string,
  currentUser: User
): Promise<{ success: boolean; error?: string; quotation?: TrackingLink }> {
  await guard();
  if (!currentUser || !currentUser.id || !currentUser.name) {
    return { success: false, error: "Current user information is missing." };
  }

  try {
    const currentQuotation = await getQuotationById(quotationId);
    if (!currentQuotation) {
      return { success: false, error: `Quotation ${quotationId} not found.` };
    }

    if (currentQuotation.currentStatus === newStatus) {
      return { success: true, quotation: currentQuotation }; // No change needed
    }

    const logEntry: OrderLogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      status: newStatus,
      changedByUserId: currentUser.id,
      changedByUserName: currentUser.name,
      notes: `Status changed to ${newStatus} by ${currentUser.name}.`,
    };

    const updatedQuotationData: Partial<TrackingLink> = {
      currentStatus: newStatus,
      statusHistory: [...(currentQuotation.statusHistory || []), logEntry],
      updatedAt: new Date().toISOString(),
      updatedByUserId: currentUser.id,
      updatedByUserName: currentUser.name,
    };

    const success = await updateQuotationService(quotationId, updatedQuotationData);
    if (!success) {
      return { success: false, error: "Failed to update quotation with new status." };
    }

    revalidatePath("/(app)/quotation");
    revalidatePath(`/track/${quotationId}`);

    const updatedQuotation = await getQuotationById(quotationId);
    if (!updatedQuotation) {
      return { success: false, error: "Failed to retrieve updated quotation after status change." };
    }
    return { success: true, quotation: updatedQuotation };

  } catch (error: any) {
    console.error("Unexpected error in updateQuotationStatusAction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected server error occurred.";
    return { success: false, error: errorMessage };
  }
}

export async function deleteQuotationAction(
  quotationId: string,
  currentUser?: User
): Promise<{ success: boolean; error?: string }> {
  await guard();
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return { success: false, error: "Unauthorized. Please log in." };
  }
  try {
    if (!quotationId) {
      return { success: false, error: "Quotation ID is required for deletion." };
    }

    const settings = await getGlobalSettings();
    const canDelete = sessionUser.role === 'SYSTEM_ADMIN' || (settings.rolesAllowedToDeleteOrders?.includes(sessionUser.role) ?? false);

    if (!canDelete) {
      return { success: false, error: "You do not have permission to delete this quotation." };
    }

    const success = await deleteQuotationFromDb(quotationId, sessionUser.id);
    if (success) {
      revalidatePath("/(app)/quotation");
      return { success: true };
    }
    return { success: false, error: "Failed to delete quotation from database. Service returned failure." };
  } catch (error: any) {
    console.error("Error in deleteQuotationAction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred while deleting quotation.";
    return { success: false, error: errorMessage };
  }
}

export async function getDeletedQuotationsAction(): Promise<TrackingLink[]> {
  await guard();
  return await getDeletedQuotations();
}

export async function restoreQuotationAction(quotationId: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN', 'ADMIN']);
  const success = await restoreQuotationFromDb(quotationId);
  if (success) {
    revalidatePath("/(app)/quotation");
    return { success: true };
  }
  return { success: false, error: "Failed to restore quotation." };
}

export async function permanentlyDeleteQuotationAction(quotationId: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  await requireRole(['SYSTEM_ADMIN']);
  const success = await permanentlyDeleteQuotationFromDb(quotationId);
  if (success) {
    revalidatePath("/(app)/quotation");
    return { success: true };
  }
  return { success: false, error: "Failed to permanently delete quotation." };
}
