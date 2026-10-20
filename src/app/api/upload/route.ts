
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const MAX_SIZE = 25 * 1024 * 1024;
// Executable / script / markup types that must never be stored.
const BLOCKED_EXT = new Set(['.html', '.htm', '.xhtml', '.shtml', '.js', '.mjs', '.cjs', '.php', '.phtml', '.exe', '.dll', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.jar', '.vbs', '.com', '.scr', '.htaccess']);

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ success: false, message: "No file uploaded" }, { status: 400 });
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ success: false, message: "File too large (max 25MB)" }, { status: 413 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const originalName = file.name;
        const extension = path.extname(originalName).toLowerCase();
        if (BLOCKED_EXT.has(extension) || !/^([.][a-z0-9]{1,10})?$/.test(extension)) {
            return NextResponse.json({ success: false, message: "File type not allowed" }, { status: 400 });
        }
        const filename = `${uuidv4()}${extension}`;
        const uploadDir = path.join(process.cwd(), "storage", "uploads");

        // Ensure directory exists
        await fs.mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, filename);
        await fs.writeFile(filePath, buffer);

        const fileUrl = `/uploads/${filename}`;

        return NextResponse.json({
            success: true,
            file_url: fileUrl,
            message: "File uploaded successfully"
        });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({
            success: false,
            message: error instanceof Error ? error.message : "Internal Server Error"
        }, { status: 500 });
    }
}
