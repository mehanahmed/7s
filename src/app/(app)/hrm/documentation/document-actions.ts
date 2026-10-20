"use server";

import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { addUserDocument, deleteUserDocument, clearUserDocuments, getLatestUserDocument } from "@/lib/user-document-service";
import { guard } from '@/lib/guard';

export async function uploadPDFDocumentAction(formData: FormData, userId: string): Promise<{ success: boolean; file_url?: string; error?: string }> {
  await guard();
    const file = formData.get('file') as File;
    if (!file) {
        return { success: false, error: "No file provided." };
    }

    if (file.type !== 'application/pdf') {
        return { success: false, error: "Only PDF files are allowed." };
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const filename = `${uuidv4()}.pdf`;
        const uploadDir = path.join(process.cwd(), "storage", "uploads", "documents");

        // Ensure directory exists
        await fs.mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, filename);
        await fs.writeFile(filePath, buffer);

        const fileUrl = `/uploads/documents/${filename}`;

        // Save to DB
        await addUserDocument(userId, {
            file_name: file.name,
            file_url: fileUrl,
            file_size: file.size,
            file_type: file.type
        });

        return { success: true, file_url: fileUrl };

    } catch (error) {
        console.error("Document Upload Error:", error);
        return { 
            success: false, 
            error: error instanceof Error ? error.message : "Internal server error during document storage." 
        };
    }
}

export async function clearUserDocumentsAction(userId: string) {
  await guard();
    try {
        const result = await clearUserDocuments(userId);
        return { success: result };
    } catch (error) {
        return { success: false, error: "Failed to clear documents." };
    }
}

export async function getLatestDocumentAction(userId: string) {
  await guard();
    try {
        const doc = await getLatestUserDocument(userId);
        return { success: !!doc, doc };
    } catch (error) {
        return { success: false, error: "Failed to fetch document." };
    }
}
