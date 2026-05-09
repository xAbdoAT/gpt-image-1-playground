import { db } from './db';

export interface DownloadableImage {
    filename: string;
    path: string;
    blob?: Blob;
}

function isDirectDownloadPath(path: string): boolean {
    return path.startsWith('/api/image/') || path.startsWith('blob:');
}

function buildDownloadHref(path: string): string {
    if (!path.startsWith('/api/image/')) {
        return path;
    }

    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}download=1`;
}

function triggerDownload(href: string, filename: string): void {
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    link.rel = 'noopener';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Downloads a single image
 */
export async function downloadSingleImage(image: DownloadableImage): Promise<void> {
    try {
        if (image.blob) {
            const url = URL.createObjectURL(image.blob);
            triggerDownload(url, image.filename);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            return;
        }

        if (isDirectDownloadPath(image.path)) {
            triggerDownload(buildDownloadHref(image.path), image.filename);
            return;
        }

        throw new Error('Invalid image path format');
    } catch (error) {
        console.error('Error downloading single image:', error);
        throw new Error('Failed to download image');
    }
}

/**
 * Downloads multiple images as individual files (not as a zip)
 */
export async function downloadMultipleImagesIndividually(images: DownloadableImage[]): Promise<void> {
    try {
        // Process images sequentially to avoid overwhelming the browser
        for (let i = 0; i < images.length; i++) {
            const image = images[i];

            if (image.blob) {
                const url = URL.createObjectURL(image.blob);
                triggerDownload(url, image.filename);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            } else if (isDirectDownloadPath(image.path)) {
                triggerDownload(buildDownloadHref(image.path), image.filename);
            } else {
                console.warn(`Skipping invalid image: ${image.filename}`);
                continue;
            }

            
            // Small delay between downloads to prevent browser issues
            if (i < images.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    } catch (error) {
        console.error('Error downloading multiple images individually:', error);
        throw new Error('Failed to download images');
    }
}

/**
 * Gets blob data for an image from IndexedDB if available
 */
export async function getImageBlob(filename: string): Promise<Blob | null> {
    try {
        const record = await db.images.get(filename);
        return record?.blob || null;
    } catch (error) {
        console.error('Error getting image blob from IndexedDB:', error);
        return null;
    }
}

/**
 * Prepares images for download by ensuring they have blob data when possible
 */
export async function prepareImagesForDownload(images: DownloadableImage[]): Promise<DownloadableImage[]> {
    const preparedImages: DownloadableImage[] = [];
    
    for (const image of images) {
        if (image.blob) {
            preparedImages.push(image);
        } else {
            // Try to get blob from IndexedDB if available
            const blob = await getImageBlob(image.filename);
            if (blob) {
                preparedImages.push({ ...image, blob });
            } else {
                preparedImages.push(image);
            }
        }
    }
    
    return preparedImages;
}
