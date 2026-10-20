
"use server";

import type { CaseStudyMessage, User } from "@/types";
import { getMessages, addMessage, deleteMessage } from "@/lib/case-study-service";
import { revalidatePath } from "next/cache";
import { guard } from '@/lib/guard';

export async function getMessagesAction(team: 'CR' | 'DR' | 'LR'): Promise<CaseStudyMessage[]> {
  await guard();
  return getMessages(team);
}

export async function addMessageAction(
  team: 'CR' | 'DR' | 'LR',
  message: string,
  imageUrl: string | null,
  replyingTo: { name: string; message: string } | null,
  currentUser: User
): Promise<{ success: boolean; message?: CaseStudyMessage; error?: string }> {
  await guard();
  if (!message.trim() && !imageUrl) {
    return { success: false, error: "Message cannot be empty." };
  }

  try {
    const messageData: Omit<CaseStudyMessage, 'id' | 'timestamp'> = {
      team,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      userAvatarUrl: currentUser.avatarUrl,
      message,
      imageUrl,
      replyingTo,
    };
    const newMessage = await addMessage(team, messageData);
    if (newMessage) {
      revalidatePath("/(app)/layout", "layout");
      return { success: true, message: newMessage };
    }
    return { success: false, error: "Failed to save message." };
  } catch (error) {
    console.error("Error in addMessageAction:", error);
    return { success: false, error: "An unexpected server error occurred." };
  }
}

export async function deleteMessageAction(
  team: 'CR' | 'DR' | 'LR',
  messageId: string,
): Promise<{ success: boolean; error?: string }> {
  await guard();
  try {
    const success = await deleteMessage(team, messageId);
    if (success) {
      revalidatePath("/(app)/layout", "layout");
      return { success: true };
    }
    return { success: false, error: "Failed to delete message from the database." };
  } catch (error) {
    console.error("Error in deleteMessageAction:", error);
    return { success: false, error: "An unexpected error occurred while deleting the message." };
  }
}
