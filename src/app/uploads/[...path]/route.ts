import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path: pathSegments } = await params;
    const uploadDir = path.join(process.cwd(), "storage", "uploads");
    const filePath = path.join(uploadDir, ...pathSegments);

    // Block path traversal outside the uploads dir
    if (!path.resolve(filePath).startsWith(path.resolve(uploadDir) + path.sep)) {
        return new NextResponse("File not found", { status: 404 });
    }

    try {
        // Read the file from the storage directory
        const fileBuffer = await fs.readFile(filePath);

        // Basic MIME type detection based on extension
        const filename = pathSegments[pathSegments.length - 1];
        const ext = path.extname(filename).toLowerCase();
        let contentType = "application/octet-stream";

        switch (ext) {
            case ".jpg":
            case ".jpeg":
                contentType = "image/jpeg";
                break;
            case ".png":
                contentType = "image/png";
                break;
            case ".gif":
                contentType = "image/gif";
                break;
            case ".webp":
                contentType = "image/webp";
                break;
            case ".svg":
                contentType = "image/svg+xml";
                break;
            case ".pdf":
                contentType = "application/pdf";
                break;
            case ".txt":
                contentType = "text/plain";
                break;
        }

        return new NextResponse(fileBuffer as any, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Content-Type-Options": "nosniff",
                "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
            },
        });
    } catch (error) {
        // Fallback or 404
        return new NextResponse("File not found", { status: 404 });
    }
}
