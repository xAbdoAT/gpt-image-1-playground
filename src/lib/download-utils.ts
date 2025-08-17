import { db } from './db';

export interface DownloadableImage {
    filename: string;
    path: string;
    blob?: Blob;
}

/**
 * Downloads a single image
 */
export async function downloadSingleImage(image: DownloadableImage): Promise<void> {
    try {
        let blob: Blob;
        
        if (image.blob) {
            // If we already have the blob, use it directly
            blob = image.blob;
        } else if (image.path.startsWith('blob:')) {
            // If it's a blob URL, fetch the blob
            const response = await fetch(image.path);
            blob = await response.blob();
        } else if (image.path.startsWith('/api/image/')) {
            // If it's a filesystem path, fetch from API
            const response = await fetch(image.path);
            blob = await response.blob();
        } else {
            throw new Error('Invalid image path format');
        }

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = image.filename;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(url);
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
            let blob: Blob;
            
            if (image.blob) {
                blob = image.blob;
            } else if (image.path.startsWith('blob:')) {
                const response = await fetch(image.path);
                blob = await response.blob();
            } else if (image.path.startsWith('/api/image/')) {
                const response = await fetch(image.path);
                blob = await response.blob();
            } else {
                console.warn(`Skipping invalid image: ${image.filename}`);
                continue;
            }
            
            // Create download link for this individual image
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = image.filename;
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up this URL immediately
            URL.revokeObjectURL(url);
            
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
