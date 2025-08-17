'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Download, Loader2, Send, Grid, DownloadCloud } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { downloadSingleImage, downloadMultipleImagesIndividually, type DownloadableImage } from '@/lib/download-utils';

type ImageInfo = {
    path: string;
    filename: string;
    blob?: Blob;
};

type ImageOutputProps = {
    imageBatch: ImageInfo[] | null;
    viewMode: 'grid' | number;
    onViewChange: (view: 'grid' | number) => void;
    altText?: string;
    isLoading: boolean;
    onSendToEdit: (filename: string) => void;
    currentMode: 'generate' | 'edit';
    baseImagePreviewUrl: string | null;
};

const getGridColsClass = (count: number): string => {
    if (count <= 1) return 'grid-cols-1';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 9) return 'grid-cols-3';
    return 'grid-cols-3';
};

export function ImageOutput({
    imageBatch,
    viewMode,
    onViewChange,
    altText = 'Generated image output',
    isLoading,
    onSendToEdit,
    currentMode,
    baseImagePreviewUrl
}: ImageOutputProps) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);

    const handleSendClick = () => {
        // Send to edit only works when a single image is selected
        if (typeof viewMode === 'number' && imageBatch && imageBatch[viewMode]) {
            onSendToEdit(imageBatch[viewMode].filename);
        }
    };

    const handleSingleImageDownload = async () => {
        if (!imageBatch || typeof viewMode !== 'number' || !imageBatch[viewMode]) return;
        
        setIsDownloading(true);
        try {
            const image: DownloadableImage = {
                filename: imageBatch[viewMode].filename,
                path: imageBatch[viewMode].path,
                blob: imageBatch[viewMode].blob
            };
            await downloadSingleImage(image);
        } catch (error) {
            console.error('Download failed:', error);
            // You could add a toast notification here
        } finally {
            setIsDownloading(false);
        }
    };

    const handleBulkDownload = async () => {
        if (!imageBatch || imageBatch.length === 0) return;
        
        setIsDownloading(true);
        setDownloadProgress({ current: 0, total: imageBatch.length });
        
        try {
            // Download all images as individual files (not as a ZIP)
            const images: DownloadableImage[] = imageBatch.map(img => ({
                filename: img.filename,
                path: img.path,
                blob: img.blob
            }));
            
            // Download images one by one with progress updates
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
                
                // Update progress
                setDownloadProgress({ current: i + 1, total: images.length });
                
                // Small delay between downloads to prevent browser issues
                if (i < images.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            // Show success feedback
            console.log(`Successfully downloaded ${images.length} images`);
            // You could add a toast notification here: "Downloaded X images successfully!"
            
        } catch (error) {
            console.error('Bulk download failed:', error);
            // You could add a toast notification here
        } finally {
            setIsDownloading(false);
            setDownloadProgress(null);
        }
    };

    const showCarousel = imageBatch && imageBatch.length > 1;
    const isSingleImageView = typeof viewMode === 'number';
    const canSendToEdit = !isLoading && isSingleImageView && imageBatch && imageBatch[viewMode];
    const canDownload = !isLoading && imageBatch && imageBatch.length > 0;
    const isSingleImage = imageBatch && imageBatch.length === 1;

    return (
        <div className='flex h-full min-h-[300px] w-full flex-col items-center justify-between gap-4 overflow-hidden rounded-lg border border-white/20 bg-black p-4'>
            <div className='relative flex h-full w-full flex-grow items-center justify-center overflow-hidden'>
                {isLoading ? (
                    currentMode === 'edit' && baseImagePreviewUrl ? (
                        <div className='relative flex h-full w-full items-center justify-center'>
                            <Image
                                src={baseImagePreviewUrl}
                                alt='Base image for editing'
                                fill
                                style={{ objectFit: 'contain' }}
                                className='blur-md filter'
                                unoptimized
                            />
                            <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white/80'>
                                <Loader2 className='mb-2 h-8 w-8 animate-spin' />
                                <p>Editing image...</p>
                            </div>
                        </div>
                    ) : (
                        <div className='flex flex-col items-center justify-center text-white/60'>
                            <Loader2 className='mb-2 h-8 w-8 animate-spin' />
                            <p>Generating image...</p>
                        </div>
                    )
                ) : imageBatch && imageBatch.length > 0 ? (
                    viewMode === 'grid' ? (
                        <div
                            className={`grid ${getGridColsClass(imageBatch.length)} max-h-full w-full max-w-full gap-1 p-1`}>
                            {imageBatch.map((img, index) => (
                                <div
                                    key={img.filename}
                                    className='relative aspect-square overflow-hidden rounded border border-white/10'>
                                    <Image
                                        src={img.path}
                                        alt={`Generated image ${index + 1}`}
                                        fill
                                        style={{ objectFit: 'contain' }}
                                        sizes='(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw'
                                        unoptimized
                                        onError={(e) => {
                                            console.error(`Failed to load image ${img.filename}:`, e);
                                        }}
                                        onLoad={() => {
                                            console.log(`Successfully loaded image ${img.filename}`);
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : imageBatch[viewMode] ? (
                        <Image
                            src={imageBatch[viewMode].path}
                            alt={altText}
                            width={512}
                            height={512}
                            className='max-h-full max-w-full object-contain'
                            unoptimized
                            onError={(e) => {
                                console.error(`Failed to load single image ${imageBatch[viewMode].filename}:`, e);
                            }}
                            onLoad={() => {
                                console.log(`Successfully loaded single image ${imageBatch[viewMode].filename}`);
                            }}
                        />
                    ) : (
                        <div className='text-center text-white/40'>
                            <p>Error displaying image.</p>
                        </div>
                    )
                ) : (
                    <div className='text-center text-white/40'>
                        <p>Your generated image will appear here.</p>
                    </div>
                )}
            </div>

            <div className='flex h-auto min-h-[60px] w-full shrink-0 flex-col items-center justify-center gap-3 p-2 sm:h-10 sm:flex-row sm:gap-4 sm:p-0'>
                {showCarousel && (
                    <div className='flex w-full items-center gap-1.5 rounded-md border border-white/10 bg-neutral-800/50 p-1 max-w-full overflow-hidden sm:w-auto'>
                        <Button
                            variant='ghost'
                            size='icon'
                            className={cn(
                                'h-8 w-8 rounded p-1 flex-shrink-0',
                                viewMode === 'grid'
                                    ? 'bg-white/20 text-white'
                                    : 'text-white/50 hover:bg-white/10 hover:text-white/80'
                            )}
                            onClick={() => onViewChange('grid')}
                            aria-label='Show grid view'>
                            <Grid className='h-4 w-4' />
                        </Button>
                        
                        {/* Scrollable thumbnail container */}
                        <div className='relative flex items-center gap-1 overflow-x-auto scrollbar-hide max-w-[200px] sm:max-w-none'>
                            {imageBatch.map((img, index) => (
                                <Button
                                    key={img.filename}
                                    variant='ghost'
                                    size='icon'
                                    className={cn(
                                        'h-8 w-8 overflow-hidden rounded p-0.5 flex-shrink-0',
                                        viewMode === index
                                            ? 'ring-2 ring-white ring-offset-1 ring-offset-black'
                                            : 'opacity-60 hover:opacity-100'
                                    )}
                                    onClick={() => onViewChange(index)}
                                    aria-label={`Select image ${index + 1}`}>
                                    <Image
                                        src={img.path}
                                        alt={`Thumbnail ${index + 1}`}
                                        width={28}
                                        height={28}
                                        className='h-full w-full object-cover'
                                        unoptimized
                                        onError={(e) => {
                                            console.error(`Failed to load thumbnail ${img.filename}:`, e);
                                        }}
                                        onLoad={() => {
                                            console.log(`Successfully loaded thumbnail ${img.filename}`);
                                        }}
                                    />
                                </Button>
                            ))}
                            
                            {/* Scroll indicator for mobile */}
                            <div className='hidden sm:hidden md:block absolute -right-1 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-white/20 rounded-full opacity-60'></div>
                        </div>
                    </div>
                )}

                {/* Download Buttons */}
                {canDownload && (
                    <div className='flex flex-wrap items-center gap-2 justify-center min-w-0 w-full sm:w-auto'>
                        {/* Single Image Download - Show when in single image view or when there's only one image */}
                        {(isSingleImageView || isSingleImage) && (
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={handleSingleImageDownload}
                                disabled={isDownloading}
                                className='shrink-0 border-white/20 text-white/80 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-50 min-w-[80px] sm:min-w-[100px]'>
                                {isDownloading ? (
                                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                ) : (
                                    <Download className='mr-2 h-4 w-4' />
                                )}
                                <span className='hidden sm:inline'>Download</span>
                                <span className='sm:hidden'>Download</span>
                            </Button>
                        )}

                        {/* Bulk Download - Show when in grid view with multiple images */}
                        {showCarousel && viewMode === 'grid' && (
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={handleBulkDownload}
                                disabled={isDownloading}
                                className='shrink-0 border-white/20 text-white/80 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-50 min-w-[80px] sm:min-w-[100px]'>
                                {isDownloading ? (
                                    <>
                                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                        {downloadProgress && (
                                            <span className='text-xs'>
                                                {downloadProgress.current}/{downloadProgress.total}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <DownloadCloud className='mr-2 h-4 w-4' />
                                        <span className='hidden sm:inline'>Download All Images</span>
                                        <span className='sm:hidden'>Download All Images</span>
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                )}

                <Button
                    variant='outline'
                    size='sm'
                    onClick={handleSendClick}
                    disabled={!canSendToEdit}
                    className={cn(
                        'shrink-0 border-white/20 text-white/80 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-50 min-w-[80px] sm:min-w-[100px] w-full sm:w-auto',
                        // Hide button completely if grid view is active and there are multiple images
                        showCarousel && viewMode === 'grid' ? 'invisible' : 'visible'
                    )}>
                    <Send className='mr-2 h-4 w-4' />
                    <span className='hidden sm:inline'>Send to Edit</span>
                    <span className='sm:hidden'>Edit</span>
                </Button>
            </div>
        </div>
    );
}
