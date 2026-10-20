

"use server";

import { revalidatePath } from "next/cache";
import type { Transaction, TransactionType, User, UserRole, PersonalNote, TransactionCategory } from "@/types";
import {
  addTransaction as addTransactionService,
  deleteTransaction as deleteTransactionService,
  updateTransaction as updateTransactionService,
  getTransactionById,
  getAllTransactions as getAllTransactionsService,
  getTransactionsForUser as getTransactionsForUserService,
  addPersonalNote as addPersonalNoteService,
  getPersonalNotesForUser as getPersonalNotesForUserService,
  updatePersonalNote as updatePersonalNoteService,
  deletePersonalNote as deletePersonalNoteService,
} from "@/lib/personal-finance-service";
import { getUserById } from '@/lib/user-service';
import { getGlobalSettings, setTransactionCategories } from '@/lib/settings-service';
import { guard } from '@/lib/guard';

export async function updateTransactionCategoriesAction(categories: TransactionCategory[]): Promise<{ success: boolean; error?: string }> {
  await guard();
  const success = await setTransactionCategories(categories);
  if (success) {
    revalidatePath("/(app)/expenses");
    return { success: true };
  }
  return { success: false, error: "Failed to update categories." };
}

const formatAmountForNotification = (amount: number): string => {
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(amount);
};

// Action to add a new transaction
export async function addTransactionAction(
  currentUser: User,
  transactionData: {
    type: TransactionType;
    amount: number;
    category: string;
    description?: string | null;
    date: string;
    sentToUserId?: string | null;
    sentToUserName?: string | null;
    documentUrl?: string | null; // Added documentUrl
  }
): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
  await guard();
  if (!currentUser || !currentUser.id) {
    return { success: false, error: "User not authenticated." };
  }
  if (!transactionData.type || !transactionData.amount || !transactionData.category || !transactionData.date) {
    return { success: false, error: "Missing required transaction fields (type, amount, category, date)." };
  }
  if (transactionData.amount <= 0) {
    return { success: false, error: "Amount must be a positive number." };
  }
  // Allow admins to skip document uploads, but not regular users for these types
  if (currentUser.role !== 'SYSTEM_ADMIN' && (transactionData.type === 'expense' || transactionData.type === 'purchase') && !transactionData.documentUrl && !transactionData.sentToUserId) { // Don't require doc for sent money
    return { success: false, error: "Document is required for expenses and purchases." };
  }


  try {
    const primaryTransactionPayload = {
      type: transactionData.type,
      amount: transactionData.amount,
      category: transactionData.category,
      description: transactionData.description || null,
      date: transactionData.date,
      sentToUserId: transactionData.sentToUserId || null,
      sentToUserName: transactionData.sentToUserName || null,
      documentUrl: transactionData.documentUrl || null, // Pass documentUrl
    };

    const primaryTransaction = await addTransactionService(currentUser.id, primaryTransactionPayload);

    if (!primaryTransaction) {
      return { success: false, error: "Failed to add primary transaction to database." };
    }

    if (currentUser.role === 'SYSTEM_ADMIN' && transactionData.type === 'expense' && transactionData.sentToUserId) {
      console.log(`Admin ${currentUser.name} sending money to ${transactionData.sentToUserName}. Creating income record for recipient.`);
      const recipientIncomePayload = {
        type: 'income' as TransactionType,
        amount: transactionData.amount,
        category: `Funds from ${currentUser.name}`,
        description: `Payment from ${currentUser.name}. Notes: ${transactionData.description || 'N/A'}`,
        date: transactionData.date,
        receivedFromUserId: currentUser.id,
        receivedFromUserName: currentUser.name,
        // Document URL from the admin's expense transaction is not typically copied to the recipient's income record.
        // If this is desired, add: documentUrl: transactionData.documentUrl || null,
      };
      const recipientTransaction = await addTransactionService(transactionData.sentToUserId, recipientIncomePayload);

      if (!recipientTransaction) {
        console.error(`Failed to add corresponding income transaction for recipient ${transactionData.sentToUserId}. Admin expense ID: ${primaryTransaction.id}. This is a critical issue and may require manual correction.`);
        return {
          success: true,
          transaction: primaryTransaction,
          error: "Admin expense recorded, but failed to record income for recipient. Please check logs for recipient ID: " + transactionData.sentToUserId
        };
      }
      console.log(`Successfully created income transaction ${recipientTransaction.id} for recipient ${transactionData.sentToUserName} (ID: ${transactionData.sentToUserId})`);
    }
    revalidatePath("/(app)/expenses");
    return { success: true, transaction: primaryTransaction };
  } catch (error) {
    console.error("Error in addTransactionAction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return { success: false, error: errorMessage };
  }
}


export async function deleteTransactionAction(
  transactionId: string,
  userIdVerifying: string,
  userRoleVerifying: UserRole
): Promise<{ success: boolean; error?: string }> {
  await guard();
  if (!userIdVerifying) {
    return { success: false, error: "User not authenticated for deletion." };
  }
  try {
    const transaction = await getTransactionById(transactionId);
    if (!transaction) {
      return { success: false, error: "Transaction not found." };
    }
    if (userRoleVerifying === 'SYSTEM_ADMIN') {
      const success = await deleteTransactionService(transactionId);
      if (success) {
        revalidatePath("/(app)/expenses");
        return { success: true };
      }
      return { success: false, error: "Failed to delete transaction from database (Admin)." };
    }
    if (transaction.type === 'income' && transaction.receivedFromUserId && userIdVerifying === transaction.userId && userRoleVerifying !== 'SYSTEM_ADMIN') {
      return { success: false, error: "Cannot delete income transactions received from system transfers." };
    }
    if (transaction.userId !== userIdVerifying) {
      return { success: false, error: "You do not have permission to delete this transaction." };
    }
    const success = await deleteTransactionService(transactionId);
    if (success) {
      revalidatePath("/(app)/expenses");
      return { success: true };
    }
    return { success: false, error: "Failed to delete transaction from database." };
  } catch (error) {
    console.error("Error in deleteTransactionAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateTransactionAction(
  transactionId: string,
  updates: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>,
  userIdVerifying: string,
  userRoleVerifying: UserRole
): Promise<{ success: boolean; error?: string }> {
  await guard();
  if (!userIdVerifying) {
    return { success: false, error: "User not authenticated for update." };
  }
  if (updates.amount !== undefined && updates.amount <= 0) {
    return { success: false, error: "Amount must be a positive number." };
  }
  try {
    const transaction = await getTransactionById(transactionId);
    if (!transaction) {
      return { success: false, error: "Transaction not found." };
    }

    const sanitizedUpdates = { ...updates };
    if (sanitizedUpdates.description === '') sanitizedUpdates.description = null;
    if (sanitizedUpdates.documentUrl === '') sanitizedUpdates.documentUrl = null; // Allow removing documentUrl


    if (userRoleVerifying === 'SYSTEM_ADMIN') {
      const success = await updateTransactionService(transactionId, sanitizedUpdates);
      if (success) {
        revalidatePath("/(app)/expenses");
        return { success: true };
      }
      return { success: false, error: "Failed to update transaction (Admin)." };
    }
    if (transaction.type === 'income' && transaction.receivedFromUserId && userIdVerifying === transaction.userId && userRoleVerifying !== 'SYSTEM_ADMIN') {
      return { success: false, error: "Cannot edit income transactions received from system transfers." };
    }
    if (transaction.userId !== userIdVerifying) {
      return { success: false, error: "You do not have permission to edit this transaction." };
    }

    // Non-admin can't change type of 'expense' (sent money) to something else if it's a system-generated pair.
    if (transaction.type === 'expense' && transaction.sentToUserId && updates.type && updates.type !== 'expense') {
      return { success: false, error: "Cannot change the type of a 'Sent Money' transaction." };
    }
    // Similarly for 'income' (received money)
    if (transaction.type === 'income' && transaction.receivedFromUserId && updates.type && updates.type !== 'income') {
      return { success: false, error: "Cannot change the type of a 'Received Money' transaction." };
    }

    const success = await updateTransactionService(transactionId, sanitizedUpdates);
    if (success) {
      revalidatePath("/(app)/expenses");
      return { success: true };
    }
    return { success: false, error: "Failed to update transaction." };
  } catch (error) {
    console.error("Error in updateTransactionAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

// Server action to get transactions for the current user
export async function getTransactionsForUserAction(userId: string): Promise<Transaction[]> {
  await guard();
  return getTransactionsForUserService(userId);
}

export async function getAllTransactionsAction(startDate?: string, endDate?: string, role?: string, userId?: string): Promise<Transaction[]> {
  await guard();
  return getAllTransactionsService(startDate, endDate, role, userId);
}


// Note Actions
export async function addNoteAction(
  noteData: Omit<PersonalNote, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ success: boolean; note?: PersonalNote; error?: string }> {
  await guard();
  if (!noteData.userId) {
    return { success: false, error: "User ID is required to add a note." };
  }
  if (!noteData.title?.trim()) {
    return { success: false, error: "Note title cannot be empty." };
  }
  try {
    const newNote = await addPersonalNoteService(noteData);
    if (newNote) {
      revalidatePath("/(app)/expenses");
      return { success: true, note: newNote };
    }
    return { success: false, error: "Failed to add note to database." };
  } catch (error) {
    console.error("Error in addNoteAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function getNotesForUserAction(userId: string): Promise<PersonalNote[]> {
  await guard();
  if (!userId) {
    console.error("getNotesForUserAction: userId is required.");
    return [];
  }
  return getPersonalNotesForUserService(userId);
}

export async function updateNoteAction(
  noteId: string,
  updates: Partial<Omit<PersonalNote, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<{ success: boolean; error?: string }> {
  await guard();
  if (!updates.title?.trim()) {
    return { success: false, error: "Note title cannot be empty." };
  }
  try {
    const success = await updatePersonalNoteService(noteId, updates);
    if (success) {
      revalidatePath("/(app)/expenses");
      return { success: true };
    }
    return { success: false, error: "Failed to update note in database." };
  } catch (error) {
    console.error("Error in updateNoteAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function deleteNoteAction(noteId: string, userIdVerifying: string): Promise<{ success: boolean; error?: string }> {
  await guard();
  try {
    // Optional: Verify if the user owns the note before deleting, if needed.
    // For now, assuming deletion is allowed if the action is called.
    const success = await deletePersonalNoteService(noteId, userIdVerifying); // Pass userIdVerifying
    if (success) {
      revalidatePath("/(app)/expenses");
      return { success: true };
    }
    return { success: false, error: "Failed to delete note from database or permission denied." };
  } catch (error) {
    console.error("Error in deleteNoteAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}
