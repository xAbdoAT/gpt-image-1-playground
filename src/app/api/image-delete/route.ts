import crypto from 'crypto';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readdir } from 'fs/promises';

const outputDir = path.resolve(process.cwd(), 'generated-images');

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

type DeleteRequestBody = {
    filenames: string[];
    passwordHash?: string;
};

type FileDeletionResult = {
    filename: string;
    success: boolean;
    error?: string;
};

// Helper function to find a file in all subdirectories
async function findFileInSubdirs(filename: string): Promise<string | null> {
    try {
        const providers = await readdir(outputDir);
        
        for (const provider of providers) {
            const providerPath = path.join(outputDir, provider);
            const stats = await fs.stat(providerPath);
            
            if (stats.isDirectory()) {
                const models = await readdir(providerPath);
                
                for (const model of models) {
                    const modelPath = path.join(providerPath, model);
                    const modelStats = await fs.stat(modelPath);
                    
                    if (modelStats.isDirectory()) {
                        const filePath = path.join(modelPath, filename);
                        try {
                            await fs.access(filePath);
                            return filePath; // Found the file
                        } catch {
                            // File not in this directory, continue searching
                        }
                    }
                }
            }
        }
        
        // If not found in subdirectories, check the base directory (for legacy files)
        const basePath = path.join(outputDir, filename);
        try {
            await fs.access(basePath);
            return basePath;
        } catch {
            // File not found anywhere
            return null;
        }
    } catch (error) {
        console.error('Error searching for file in subdirectories:', error);
        return null;
    }
}

export async function POST(request: NextRequest) {
    console.log('Received POST request to /api/image-delete');

    let requestBody: DeleteRequestBody;
    try {
        // Clone the request to read the body for auth, then allow the original request to be read again
        const clonedRequest = request.clone();
        const tempBodyForAuth = await clonedRequest.json();

        if (process.env.APP_PASSWORD) {
            const clientPasswordHash = tempBodyForAuth.passwordHash as string | null;

            if (!clientPasswordHash) {
                console.error('Missing password hash for delete operation.');
                return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
            }
            const serverPasswordHash = sha256(process.env.APP_PASSWORD);
            if (clientPasswordHash !== serverPasswordHash) {
                console.error('Invalid password hash for delete operation.');
                return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
            }
        }
        // Now read the original request body for processing
        requestBody = await request.json();
    } catch (e) {
        console.error('Error parsing request body for /api/image-delete:', e);
        return NextResponse.json({ error: 'Invalid request body: Must be JSON.' }, { status: 400 });
    }

    const { filenames } = requestBody;

    if (!Array.isArray(filenames) || filenames.some((fn) => typeof fn !== 'string')) {
        return NextResponse.json({ error: 'Invalid filenames: Must be an array of strings.' }, { status: 400 });
    }

    if (filenames.length === 0) {
        return NextResponse.json({ message: 'No filenames provided to delete.', results: [] }, { status: 200 });
    }

    const deletionResults: FileDeletionResult[] = [];

    for (const filename of filenames) {
        if (!filename || filename.includes('..')) {
            console.warn(`Invalid filename for deletion: ${filename}`);
            deletionResults.push({ filename, success: false, error: 'Invalid filename format.' });
            continue;
        }

        // Find the file in the directory structure
        const filepath = await findFileInSubdirs(filename);

        if (!filepath) {
            console.warn(`File not found for deletion: ${filename}`);
            deletionResults.push({ filename, success: false, error: 'File not found.' });
            continue;
        }

        try {
            await fs.unlink(filepath);
            console.log(`Successfully deleted image: ${filepath}`);
            deletionResults.push({ filename, success: true });
        } catch (error: unknown) {
            console.error(`Error deleting image ${filepath}:`, error);
            deletionResults.push({ filename, success: false, error: 'Failed to delete file.' });
        }
    }

    const allSucceeded = deletionResults.every((r) => r.success);

    return NextResponse.json(
        {
            message: allSucceeded ? 'All files deleted successfully.' : 'Some files could not be deleted.',
            results: deletionResults
        },
        { status: allSucceeded ? 200 : 207 } // 207 Multi-Status if some failed
    );
}