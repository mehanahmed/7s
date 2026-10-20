
"use server";

import { smartCompress } from "@/lib/image-utils";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { guard } from '@/lib/guard';

export async function uploadOptimizedAvatarAction(formData: FormData): Promise<{ success: boolean; file_url?: string; error?: string }> {
  await guard();
    const file = formData.get('file') as File;
    if (!file) {
        console.error("Avatar Upload: No file in formData.");
        return { success: false, error: "No file provided." };
    }

    console.log(`Avatar Upload: Starting processing for file: ${file.name}, size: ${file.size} bytes`);

    try {
        // 1. Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log(`Avatar Upload: File converted to buffer (${buffer.length} bytes).`);

        // 2. Compress to 100KB target
        let optimizedBuffer: Buffer;
        try {
            optimizedBuffer = await smartCompress(buffer, 100);
            console.log(`Avatar Upload: Image optimized successfully (${optimizedBuffer.length} bytes).`);
        } catch (compressError) {
            console.error("Avatar Upload: smartCompress failed:", compressError);
            // Fallback: Use original buffer if compression fails
            optimizedBuffer = buffer;
        }

        // 3. Create a unique filename
        const filename = `${uuidv4()}.jpg`;
        const uploadDir = path.join(process.cwd(), "storage", "uploads");

        // Ensure directory exists
        try {
            await fs.mkdir(uploadDir, { recursive: true });
        } catch (dirError) {
            console.error("Avatar Upload: Failed to create/verify storage directory:", dirError);
            throw new Error(`Storage directory inaccessible: ${dirError instanceof Error ? dirError.message : String(dirError)}`);
        }

        const filePath = path.join(uploadDir, filename);

        // 4. Save to storage/uploads
        try {
            await fs.writeFile(filePath, optimizedBuffer);
            console.log(`Avatar Upload: File saved successfully to ${filePath}`);
        } catch (writeError) {
            console.error("Avatar Upload: Failed to write file:", writeError);
            throw new Error(`Failed to save image to disk: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
        }

        // 5. Return the local URL
        const fileUrl = `/uploads/${filename}`;
        return { success: true, file_url: fileUrl };

    } catch (error) {
        console.error("Avatar Upload: Final catch-all error:", error);
        return { 
            success: false, 
            error: error instanceof Error ? error.message : "Internal server error during local image storage." 
        };
    }
}
