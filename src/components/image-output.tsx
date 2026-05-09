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
    streamingPreviewImages?: Map<number, string>;
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
    baseImagePreviewUrl,
    streamingPreviewImages
}: ImageOutputProps) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);
    const showCarousel = imageBatch && imageBatch.length > 1;
    const isSingleImageView = typeof viewMode === 'number';
    const canSendToEdit = !isLoading && isSingleImageView && imageBatch && imageBatch[viewMode];
    const canDownload = !isLoading && imageBatch && imageBatch.length > 0;
    const isSingleImage = imageBatch && imageBatch.length === 1;

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
            const images: DownloadableImage[] = imageBatch.map(img => ({
                filename: img.filename,
                path: img.path,
                blob: img.blob
            }));
            await downloadMultipleImagesIndividually(images);
            setDownloadProgress({ current: images.length, total: images.length });
            console.log(`Successfully downloaded ${images.length} images`);
            
        } catch (error) {
            console.error('Bulk download failed:', error);
            // You could add a toast notification here
        } finally {
            setIsDownloading(false);
            setDownloadProgress(null);
        }
    };

    return (
        <div className='flex h-full min-h-[300px] w-full flex-col items-center justify-between gap-4 overflow-hidden rounded-lg border border-white/20 bg-black p-4'>
            <div className='relative flex h-full w-full flex-grow items-center justify-center overflow-hidden'>
                {isLoading ? (
                    streamingPreviewImages && streamingPreviewImages.size > 0 ? (
                        // Show streaming preview images - single image centered like final view
                        <div className='relative flex h-full w-full items-center justify-center'>
                            {/* Show the latest preview image (highest index) */}
                            {(() => {
                                const entries = Array.from(streamingPreviewImages.entries());
                                const latestEntry = entries[entries.length - 1];
                                if (!latestEntry) return null;
                                const [, dataUrl] = latestEntry;
                                return (
                                    <Image
                                        src={dataUrl}
                                        alt='Streaming preview'
                                        width={512}
                                        height={512}
                                        className='max-h-full max-w-full object-contain'
                                        unoptimized
                                    />
                                );
                            })()}
                            {/* Overlay loader at bottom center */}
                            <div className='absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-white/80'>
                                <Loader2 className='h-4 w-4 animate-spin' />
                                <p className='text-sm'>Streaming...</p>
                            </div>
                        </div>
                    ) : currentMode === 'edit' && baseImagePreviewUrl ? (
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
                    <div className='flex w-full items-center gap-2 rounded-xl border border-white/15 bg-neutral-900/80 p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur sm:w-auto sm:max-w-full'>
                        <Button
                            variant='ghost'
                            size='icon'
                            className={cn(
                                'h-9 w-9 rounded-lg border border-white/10 p-1.5 transition-colors flex-shrink-0',
                                viewMode === 'grid'
                                    ? 'bg-white/20 text-white'
                                    : 'bg-transparent text-white/55 hover:bg-white/10 hover:text-white/90'
                            )}
                            onClick={() => onViewChange('grid')}
                            aria-label='Show grid view'>
                            <Grid className='h-4 w-4' />
                        </Button>
                        
                        {/* Scrollable thumbnail container */}
                        <div
                            className='relative flex w-full items-center gap-2 overflow-x-auto overflow-y-hidden scrollbar-hide overscroll-x-contain overscroll-y-none px-0.5 sm:w-auto'
                            style={{ touchAction: 'pan-x' }}>
                            {imageBatch.map((img, index) => (
                                <Button
                                    key={img.filename}
                                    variant='ghost'
                                    size='sm'
                                    className={cn(
                                        'h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border p-0.5 transition-all duration-200',
                                        viewMode === index
                                            ? 'scale-[1.04] border-white/70 bg-white/10 ring-2 ring-white/60 ring-offset-1 ring-offset-black'
                                            : 'border-white/15 opacity-65 hover:opacity-100 hover:border-white/40'
                                    )}
                                    onClick={() => onViewChange(index)}
                                    aria-label={`Select image ${index + 1}`}>
                                    <Image
                                        src={img.path}
                                        alt={`Thumbnail ${index + 1}`}
                                        width={36}
                                        height={36}
                                        draggable={false}
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
