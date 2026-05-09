import fs from 'fs/promises';
import { lookup } from 'mime-types';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// Base directory where images are stored
const imageBaseDir = path.resolve(process.cwd(), 'generated-images');

function toResponseBody(buffer: Buffer): ArrayBuffer {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path: pathSegments } = await params;
    const isDownloadRequest = request.nextUrl.searchParams.get('download') === '1';
    const cacheHeaders = isDownloadRequest
        ? {
              'Cache-Control': 'no-store'
          }
        : {
              'Cache-Control': 'public, max-age=31536000, immutable'
          };

    console.log(`IMAGE ROUTE HANDLING REQUEST: pathSegments =`, pathSegments);

    if (!pathSegments || pathSegments.length === 0) {
        return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    // Handle different path formats:
    // 1. New format: [provider, model, filename] -> /api/image/openai/gpt-image-1/filename.png
    // 2. Old format: [filename] -> /api/image/filename.png
    
    let filename: string;
    let potentialProvider: string | null = null;
    let potentialModel: string | null = null;
    
    if (pathSegments.length === 1) {
        // Old format: just the filename
        filename = pathSegments[0];
        console.log(`Handling OLD FORMAT request for filename: ${filename}`);
    } else if (pathSegments.length >= 2) {
        // New format: provider/model/filename or more segments
        potentialProvider = pathSegments[0];
        potentialModel = pathSegments[1];
        filename = pathSegments.slice(2).join(path.sep);
        console.log(`Handling NEW FORMAT request for provider: ${potentialProvider}, model: ${potentialModel}, filename: ${filename}`);
    } else {
        return NextResponse.json({ error: 'Invalid path format' }, { status: 400 });
    }
    
    // Basic security: Prevent obvious directory traversal attempts
    if (filename.includes('..') || filename.startsWith('/') || filename.startsWith('\\')) {
        console.log(`Rejecting path due to obvious directory traversal attempt: ${filename}`);
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Try different locations based on the path format
    try {
        // If this is a new format request, try the full path first
        if (potentialProvider && potentialModel) {
            const fullPath = path.join(imageBaseDir, potentialProvider, potentialModel, filename);
            console.log(`Trying full path: ${fullPath}`);
            
            try {
                await fs.access(fullPath);
                
                // Security check
                const normalizedFullPath = path.resolve(fullPath);
                const normalizedBaseDir = path.resolve(imageBaseDir);
                
                if (!normalizedFullPath.startsWith(normalizedBaseDir)) {
                    console.log(`Rejecting path due to security check: ${normalizedFullPath}`);
                    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
                }
                
                const fileBuffer = await fs.readFile(fullPath);
                const contentType = lookup(filename) || 'application/octet-stream';

                console.log(`SUCCESS: Found file at full path: ${fullPath}`);
                return new NextResponse(toResponseBody(fileBuffer), {
                    status: 200,
                    headers: {
                        'Content-Type': contentType,
                        'Content-Length': fileBuffer.length.toString(),
                        ...cacheHeaders,
                        ...(isDownloadRequest
                            ? {
                                  'Content-Disposition': `attachment; filename="${filename}"`
                              }
                            : {})
                    }
                });
            } catch (accessError) {
                console.log(`File not found at full path: ${fullPath}`);
                // Continue to fallback logic
            }
        }
        
        // Fallback logic for all formats - search through possible locations
        console.log(`Searching for file ${filename} in all possible locations...`);
        
        // Case 1: Check if it's in the base directory (oldest format)
        const basePath = path.join(imageBaseDir, filename);
        try {
            await fs.access(basePath);
            
            // Security check
            const normalizedBasePath = path.resolve(basePath);
            const normalizedBaseDir = path.resolve(imageBaseDir);
            
            if (!normalizedBasePath.startsWith(normalizedBaseDir)) {
                console.log(`Rejecting path due to security check: ${normalizedBasePath}`);
                return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
            }
            
            const fileBuffer = await fs.readFile(basePath);
            const contentType = lookup(filename) || 'application/octet-stream';
            
            console.log(`SUCCESS: Found file in base directory: ${basePath}`);
            return new NextResponse(toResponseBody(fileBuffer), {
                status: 200,
                headers: {
                    'Content-Type': contentType,
                    'Content-Length': fileBuffer.length.toString(),
                    ...cacheHeaders,
                    ...(isDownloadRequest
                        ? {
                              'Content-Disposition': `attachment; filename="${filename}"`
                          }
                        : {})
                }
            });
        } catch {
            console.log(`File not found in base directory: ${basePath}`);
        }
        
        // Case 2: Check if it's in provider directories (intermediate format)
        try {
            const providers = await fs.readdir(imageBaseDir);
            console.log(`Found providers: ${providers}`);
            
            for (const provider of providers) {
                const providerPath = path.join(imageBaseDir, provider);
                const providerStats = await fs.stat(providerPath);
                
                if (providerStats.isDirectory()) {
                    console.log(`Checking provider directory: ${providerPath}`);
                    
                    // Check if file is directly in provider directory
                    const providerFilePath = path.join(providerPath, filename);
                    try {
                        await fs.access(providerFilePath);
                        
                        // Security check
                        const normalizedProviderFilePath = path.resolve(providerFilePath);
                        const normalizedBaseDir = path.resolve(imageBaseDir);
                        
                        if (!normalizedProviderFilePath.startsWith(normalizedBaseDir)) {
                            console.log(`Rejecting path due to security check: ${normalizedProviderFilePath}`);
                            return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
                        }
                        
                        const fileBuffer = await fs.readFile(providerFilePath);
                        const contentType = lookup(filename) || 'application/octet-stream';
                        
                        console.log(`SUCCESS: Found file in provider directory: ${providerFilePath}`);
                        return new NextResponse(toResponseBody(fileBuffer), {
                            status: 200,
                            headers: {
                                'Content-Type': contentType,
                                'Content-Length': fileBuffer.length.toString(),
                                ...cacheHeaders,
                                ...(isDownloadRequest
                                    ? {
                                          'Content-Disposition': `attachment; filename="${filename}"`
                                      }
                                    : {})
                            }
                        });
                    } catch {
                        console.log(`File not found in provider directory: ${providerFilePath}`);
                    }
                    
                    // Check model subdirectories
                    try {
                        const models = await fs.readdir(providerPath);
                        console.log(`Found models for provider ${provider}: ${models}`);
                        
                        for (const model of models) {
                            const modelPath = path.join(providerPath, model);
                            const modelStats = await fs.stat(modelPath);
                            
                            if (modelStats.isDirectory()) {
                                console.log(`Checking model directory: ${modelPath}`);
                                const filePath = path.join(modelPath, filename);
                                try {
                                    await fs.access(filePath);
                                    
                                    // Security check
                                    const normalizedFilePath = path.resolve(filePath);
                                    const normalizedBaseDir = path.resolve(imageBaseDir);
                                    
                                    if (!normalizedFilePath.startsWith(normalizedBaseDir)) {
                                        console.log(`Rejecting path due to security check: ${normalizedFilePath}`);
                                        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
                                    }
                                    
                                    // Found the file, serve it
                                    const fileBuffer = await fs.readFile(filePath);
                                    const contentType = lookup(filename) || 'application/octet-stream';
                                    
                                    console.log(`SUCCESS: Found file in model directory: ${filePath}`);
                                    return new NextResponse(toResponseBody(fileBuffer), {
                                        status: 200,
                                        headers: {
                                            'Content-Type': contentType,
                                            'Content-Length': fileBuffer.length.toString(),
                                            ...cacheHeaders,
                                            ...(isDownloadRequest
                                                ? {
                                                      'Content-Disposition': `attachment; filename="${filename}"`
                                                  }
                                                : {})
                                        }
                                    });
                                } catch {
                                    console.log(`File not found in model directory: ${filePath}`);
                                }
                            }
                        }
                    } catch (readdirError) {
                        console.log(`Could not read models directory for provider ${provider}:`, readdirError);
                    }
                }
            }
        } catch (providersError) {
            console.log(`Could not read providers directory:`, providersError);
        }
        
        // File not found anywhere
        console.log(`File not found anywhere: ${filename}`);
        return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    } catch (error) {
        console.error(`Error serving image ${filename}:`, error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}