import crypto from 'crypto';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import path from 'path';
import { ProviderFactory } from '@/providers/factory';
import { getModelById } from '@/providers/registry';
import { OpenAIImageResponse } from '@/providers/openai/types';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL
});

const outputDir = path.resolve(process.cwd(), 'generated-images');

// Define valid output formats for type safety
const VALID_OUTPUT_FORMATS = ['png', 'jpeg', 'webp'] as const;
type ValidOutputFormat = (typeof VALID_OUTPUT_FORMATS)[number];

// Validate and normalize output format
function validateOutputFormat(format: unknown): ValidOutputFormat {
    const normalized = String(format || 'png').toLowerCase();

    // Handle jpg -> jpeg normalization
    const mapped = normalized === 'jpg' ? 'jpeg' : normalized;

    if (VALID_OUTPUT_FORMATS.includes(mapped as ValidOutputFormat)) {
        return mapped as ValidOutputFormat;
    }

    return 'png'; // default fallback
}

async function ensureOutputDirExists(dirPath: string) {
    try {
        await fs.access(dirPath);
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            try {
                await fs.mkdir(dirPath, { recursive: true });
                console.log(`Created output directory: ${dirPath}`);
            } catch (mkdirError) {
                console.error(`Error creating output directory ${dirPath}:`, mkdirError);
                throw new Error('Failed to create image output directory.');
            }
        } else {
            console.error(`Error accessing output directory ${dirPath}:`, error);
            throw new Error(
                `Failed to access or ensure image output directory exists. Original error: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

export async function POST(request: NextRequest) {
    console.log('Received POST request to /api/images');

    if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY is not set.');
        return NextResponse.json({ error: 'Server configuration error: API key not found.' }, { status: 500 });
    }
    try {
        let effectiveStorageMode: 'fs' | 'indexeddb';
        const explicitMode = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;
        const isOnVercel = process.env.VERCEL === '1';

        if (explicitMode === 'fs') {
            effectiveStorageMode = 'fs';
        } else if (explicitMode === 'indexeddb') {
            effectiveStorageMode = 'indexeddb';
        } else if (isOnVercel) {
            effectiveStorageMode = 'indexeddb';
        } else {
            effectiveStorageMode = 'fs';
        }
        console.log(
            `Effective Image Storage Mode: ${effectiveStorageMode} (Explicit: ${explicitMode || 'unset'}, Vercel: ${isOnVercel})`
        );

        if (effectiveStorageMode === 'fs') {
            await ensureOutputDirExists(outputDir);
        }

        const formData = await request.formData();

        if (process.env.APP_PASSWORD) {
            const clientPasswordHash = formData.get('passwordHash') as string | null;
            if (!clientPasswordHash) {
                console.error('Missing password hash.');
                return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
            }
            const serverPasswordHash = sha256(process.env.APP_PASSWORD);
            if (clientPasswordHash !== serverPasswordHash) {
                console.error('Invalid password hash.');
                return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
            }
        }

        const mode = formData.get('mode') as 'generate' | 'edit' | null;
        const prompt = formData.get('prompt') as string | null;
        const modelId = (formData.get('model') as string | null) || 'gpt-image-2';

        // Get model info to determine provider
        const modelInfo = getModelById(modelId);
        if (!modelInfo) {
            return NextResponse.json({ error: `Model ${modelId} not found.` }, { status: 400 });
        }

        const providerId = modelInfo.providerId;

        console.log(`Mode: ${mode}, Model: ${modelId}, Provider: ${providerId}, Prompt: ${prompt ? prompt.substring(0, 50) + '...' : 'N/A'}`);

        if (!mode || !prompt) {
            return NextResponse.json({ error: 'Missing required parameters: mode and prompt' }, { status: 400 });
        }

        const streamEnabled = formData.get('stream') === 'true';
        const partialImagesCount = parseInt((formData.get('partial_images') as string) || '2', 10);

        if (streamEnabled) {
            if (providerId !== 'openai') {
                return NextResponse.json({ error: 'Streaming is only supported for OpenAI models.' }, { status: 400 });
            }

            const actualPartialImages = Math.max(1, Math.min(partialImagesCount, 3)) as 1 | 2 | 3;
            const encoder = new TextEncoder();
            const timestamp = Date.now();

            const streamParamsBase: Record<string, unknown> = {
                model: modelId,
                prompt
            };

            if (mode === 'generate') {
                const n = parseInt((formData.get('n') as string) || '1', 10);
                const size = (formData.get('size') as string) || '1024x1024';
                const quality = (formData.get('quality') as string) || 'auto';
                const output_format = (formData.get('output_format') as string) || 'png';
                const output_compression_str = formData.get('output_compression') as string | null;
                const background = (formData.get('background') as string) || 'auto';
                const moderation = (formData.get('moderation') as string) || 'auto';

                Object.assign(streamParamsBase, {
                    n: Math.max(1, Math.min(n || 1, 10)),
                    size,
                    quality,
                    output_format,
                    background,
                    moderation
                });

                if ((output_format === 'jpeg' || output_format === 'webp') && output_compression_str) {
                    const compression = parseInt(output_compression_str, 10);
                    if (!isNaN(compression) && compression >= 0 && compression <= 100) {
                        Object.assign(streamParamsBase, { output_compression: compression });
                    }
                }
            } else {
                const n = parseInt((formData.get('n') as string) || '1', 10);
                const size = (formData.get('size') as string) || 'auto';
                const quality = (formData.get('quality') as string) || 'auto';

                const imageFiles: File[] = [];
                for (const [key, value] of formData.entries()) {
                    if (key.startsWith('image_') && value instanceof File) {
                        imageFiles.push(value);
                    }
                }

                if (imageFiles.length === 0) {
                    return NextResponse.json({ error: 'No image file provided for editing.' }, { status: 400 });
                }

                Object.assign(streamParamsBase, {
                    n: Math.max(1, Math.min(n || 1, 10)),
                    size: size === 'auto' ? undefined : size,
                    quality: quality === 'auto' ? undefined : quality,
                    image: imageFiles
                });

                const maskFile = formData.get('mask') as File | null;
                if (maskFile) {
                    Object.assign(streamParamsBase, { mask: maskFile });
                }
            }

            const readableStream = new ReadableStream({
                async start(controller) {
                    try {
                        const completedImages: Array<{ filename: string; b64_json: string; path?: string; output_format: string }> = [];
                        let finalUsage: OpenAI.Images.ImagesResponse['usage'] | undefined;
                        let imageIndex = 0;

                        const stream =
                            mode === 'generate'
                                ? await openai.images.generate({
                                      ...(streamParamsBase as any),
                                      stream: true,
                                      partial_images: actualPartialImages
                                  })
                                : await openai.images.edit({
                                      ...(streamParamsBase as any),
                                      stream: true,
                                      partial_images: actualPartialImages
                                  });

                        for await (const event of stream as any) {
                            if (event.type === 'image_generation.partial_image') {
                                controller.enqueue(
                                    encoder.encode(
                                        `data: ${JSON.stringify({
                                            type: 'partial_image',
                                            index: imageIndex,
                                            partial_image_index: event.partial_image_index,
                                            b64_json: event.b64_json
                                        })}\n\n`
                                    )
                                );
                            } else if (event.type === 'image_generation.completed') {
                                const fileExtension = validateOutputFormat(
                                    mode === 'generate'
                                        ? (formData.get('output_format') as string)
                                        : 'png'
                                );
                                const filename = `${timestamp}-${imageIndex}.${fileExtension}`;

                                if (event.b64_json) {
                                    const buffer = Buffer.from(event.b64_json, 'base64');

                                    if (effectiveStorageMode === 'fs') {
                                        const modelSpecificDir = path.join(outputDir, providerId, modelId);
                                        await ensureOutputDirExists(modelSpecificDir);
                                        await fs.writeFile(path.join(modelSpecificDir, filename), buffer);
                                    }

                                    completedImages.push({
                                        filename,
                                        b64_json: event.b64_json,
                                        output_format: fileExtension,
                                        path:
                                            effectiveStorageMode === 'fs'
                                                ? `/api/image/${providerId}/${modelId}/${filename}`
                                                : undefined
                                    });
                                }

                                imageIndex += 1;
                                finalUsage = event.usage ?? finalUsage;
                            } else if (event.type === 'error') {
                                controller.enqueue(
                                    encoder.encode(`data: ${JSON.stringify({ type: 'error', error: event.error?.message || 'Streaming error occurred' })}\n\n`)
                                );
                                controller.close();
                                return;
                            }
                        }

                        controller.enqueue(
                            encoder.encode(
                                `data: ${JSON.stringify({
                                    type: 'done',
                                    images: completedImages,
                                    usage: finalUsage
                                })}\n\n`
                            )
                        );
                        controller.close();
                    } catch (error) {
                        controller.enqueue(
                            encoder.encode(
                                `data: ${JSON.stringify({
                                    type: 'error',
                                    error: error instanceof Error ? error.message : 'An unexpected streaming error occurred.'
                                })}\n\n`
                            )
                        );
                        controller.close();
                    }
                }
            });

            return new Response(readableStream, {
                headers: {
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'Cache-Control': 'no-cache, no-transform',
                    Connection: 'keep-alive'
                }
            });
        }

        let result: any;

        if (mode === 'generate') {
            const n = parseInt((formData.get('n') as string) || '1', 10);
            const size = (formData.get('size') as string) || '1024x1024';
            const quality = (formData.get('quality') as string) || 'auto';
            const output_format = (formData.get('output_format') as string) || 'png';
            const output_compression_str = formData.get('output_compression') as string | null;
            const background = (formData.get('background') as string) || 'auto';
            const moderation = (formData.get('moderation') as string) || 'auto';

            const params: any = {
                model: modelId,
                prompt,
                n: Math.max(1, Math.min(n || 1, 10)),
                size,
                quality,
                output_format,
                background,
                moderation
            };

            if ((output_format === 'jpeg' || output_format === 'webp') && output_compression_str) {
                const compression = parseInt(output_compression_str, 10);
                if (!isNaN(compression) && compression >= 0 && compression <= 100) {
                    params.output_compression = compression;
                }
            }

            console.log(`Calling ${providerId} generate with params:`, params);
            result = await ProviderFactory.generateImage(providerId, params);
        } else if (mode === 'edit') {
            const n = parseInt((formData.get('n') as string) || '1', 10);
            const size = (formData.get('size') as string) || 'auto';
            const quality = (formData.get('quality') as string) || 'auto';

            const imageFiles: File[] = [];
            for (const [key, value] of formData.entries()) {
                if (key.startsWith('image_') && value instanceof File) {
                    imageFiles.push(value);
                }
            }

            if (imageFiles.length === 0) {
                return NextResponse.json({ error: 'No image file provided for editing.' }, { status: 400 });
            }

            const maskFile = formData.get('mask') as File | null;

            const params: any = {
                model: modelId,
                prompt,
                image: imageFiles,
                n: Math.max(1, Math.min(n || 1, 10)),
                size: size === 'auto' ? undefined : size,
                quality: quality === 'auto' ? undefined : quality
            };

            if (maskFile) {
                params.mask = maskFile;
            }

            console.log(`Calling ${providerId} edit with params:`, {
                ...params,
                image: `[${imageFiles.map((f) => f.name).join(', ')}]`,
                mask: maskFile ? maskFile.name : 'N/A'
            });
            result = await ProviderFactory.editImage(providerId, params);
        } else {
            return NextResponse.json({ error: 'Invalid mode specified' }, { status: 400 });
        }

        console.log('OpenAI API call successful.');

        if (!result || !Array.isArray(result.data) || result.data.length === 0) {
            console.error('Invalid or empty data received from OpenAI API:', result);
            return NextResponse.json({ error: 'Failed to retrieve image data from API.' }, { status: 500 });
        }

        const savedImagesData = await Promise.all(
            (result.data ?? []).map(async (imageData: NonNullable<OpenAIImageResponse['data']>[0], index: number) => {
                if (!imageData.b64_json) {
                    console.error(`Image data ${index} is missing b64_json.`);
                    throw new Error(`Image data at index ${index} is missing base64 data.`);
                }
                const buffer = Buffer.from(imageData.b64_json, 'base64');
                const timestamp = Date.now();

                const fileExtension = validateOutputFormat(formData.get('output_format'));
                const filename = `${timestamp}-${index}.${fileExtension}`;

                if (effectiveStorageMode === 'fs') {
                    // Create provider/model specific directory
                    const modelSpecificDir = path.join(outputDir, providerId, modelId);
                    await ensureOutputDirExists(modelSpecificDir);
                    
                    const filepath = path.join(modelSpecificDir, filename);
                    console.log(`Attempting to save image to: ${filepath}`);
                    await fs.writeFile(filepath, buffer);
                    console.log(`Successfully saved image: ${filename}`);
                } else {
                }

                const imageResult: { filename: string; b64_json: string; path?: string; output_format: string } = {
                    filename: filename,
                    b64_json: imageData.b64_json,
                    output_format: fileExtension
                };

                if (effectiveStorageMode === 'fs') {
                    // Update path to include provider and model directories
                    imageResult.path = `/api/image/${providerId}/${modelId}/${filename}`;
                }

                return imageResult;
            })
        );

        console.log(`All images processed. Mode: ${effectiveStorageMode}`);

        return NextResponse.json({ images: savedImagesData, usage: result.usage });
    } catch (error: unknown) {
        console.error('Error in /api/images:', error);

        let errorMessage = 'An unexpected error occurred.';
        let status = 500;

        if (error instanceof Error) {
            errorMessage = error.message;
            if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') {
                status = error.status;
            }
        } else if (typeof error === 'object' && error !== null) {
            if ('message' in error && typeof error.message === 'string') {
                errorMessage = error.message;
            }
            if ('status' in error && typeof error.status === 'number') {
                status = error.status;
            }
        }

        return NextResponse.json({ error: errorMessage }, { status });
    }
}
