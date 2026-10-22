import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { getSessionUserId, isRateLimited, recordFail } from "@/lib/session-core";

const MAX_STAFF_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_PUBLIC_SIZE = 10 * 1024 * 1024; // 10MB

// Executable / script / markup types that must never be stored.
const BLOCKED_EXT = new Set([
    '.html', '.htm', '.xhtml', '.shtml', '.js', '.mjs', '.cjs', '.php', '.phtml',
    '.exe', '.dll', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.jar', '.vbs', '.com',
    '.scr', '.htaccess', '.svg', '.svgz', '.xml', '.jsp', '.asp', '.aspx', '.cgi'
]);

// Public (unauthenticated) uploads allowed for payment proof and document submissions
const PUBLIC_ALLOWED_EXT = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.pdf', '.gif'
]);

export async function POST(request: NextRequest) {
    try {
        const sessionUserId = await getSessionUserId();
        const isPublicCaller = !sessionUserId;

        // Rate limiting for public unauthenticated uploads
        if (isPublicCaller) {
            const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
            const rateKey = `upload:public:${ip}`;
            if (isRateLimited(rateKey)) {
                return NextResponse.json({
                    success: false,
                    message: "Too many upload requests. Please try again in a few minutes."
                }, { status: 429 });
            }
            recordFail(rateKey);
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ success: false, message: "No file uploaded" }, { status: 400 });
        }

        const maxAllowedSize = isPublicCaller ? MAX_PUBLIC_SIZE : MAX_STAFF_SIZE;
        if (file.size > maxAllowedSize) {
            const limitLabel = isPublicCaller ? "10MB" : "25MB";
            return NextResponse.json({ success: false, message: `File too large (max ${limitLabel})` }, { status: 413 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const originalName = file.name || "upload";
        const extension = path.extname(originalName).toLowerCase();

        if (BLOCKED_EXT.has(extension) || !/^([.][a-z0-9]{1,10})?$/.test(extension)) {
            return NextResponse.json({ success: false, message: "File type not allowed" }, { status: 400 });
        }

        if (isPublicCaller && !PUBLIC_ALLOWED_EXT.has(extension)) {
            return NextResponse.json({
                success: false,
                message: "File type not allowed for public uploads. Only PNG, JPG, WEBP, and PDF are accepted."
            }, { status: 400 });
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
