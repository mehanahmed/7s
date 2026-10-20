
import sharp from 'sharp';

/**
 * Optimized image compression using Binary Search to reach a target file size.
 * @param buffer Input image as a Buffer
 * @param targetKB Target size in Kilobytes (default: 100)
 * @returns Compressed image as a Buffer
 */
export async function smartCompress(buffer: Buffer, targetKB: number = 100): Promise<Buffer> {
    const targetBytes = targetKB * 1024;
    let low = 10;
    let high = 100;
    let bestBuffer: Buffer | null = null;
    let quality = 80;

    const image = sharp(buffer).rotate(); // Auto-rotate based on EXIF

    // 1. Binary search for the optimal quality percentage
    while (low <= high) {
        quality = Math.floor((low + high) / 2);

        const currentBuffer = await image
            .clone()
            .jpeg({
                quality,
                mozjpeg: true,
                chromaSubsampling: '4:2:0',
                progressive: true
            })
            .withMetadata() // Strip EXIF for smaller size
            .toBuffer();

        if (currentBuffer.length <= targetBytes) {
            bestBuffer = currentBuffer;
            low = quality + 1; // Try to get better quality
        } else {
            high = quality - 1; // Still too big
        }
    }

    // 2. If even quality 10 is too big, resize the image dimensions
    if (!bestBuffer || bestBuffer.length > targetBytes) {
        return await sharp(buffer)
            .rotate()
            .resize(1000, 1000, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 70, mozjpeg: true })
            .withMetadata()
            .toBuffer();
    }

    return bestBuffer;
}
