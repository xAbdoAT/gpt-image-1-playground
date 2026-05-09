// OpenAI Provider API Implementation
import OpenAI from 'openai';
import { 
  OpenAIImageGenerateParams, 
  OpenAIImageEditParams, 
  OpenAIImageResponse 
} from './types';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL
});

export class OpenAIProvider {
  static async generateImage(params: OpenAIImageGenerateParams): Promise<OpenAIImageResponse> {
    // Map our parameters to OpenAI's API
    const openaiParams: any = {
      model: params.model,
      prompt: params.prompt,
      n: params.n,
      size: params.size,
      quality: params.quality,
      output_format: params.output_format,
      background: params.background,
      moderation: params.moderation
    };

    // Handle output compression for JPEG/WebP
    if ((params.output_format === 'jpeg' || params.output_format === 'webp') && 
        params.output_compression !== undefined) {
      openaiParams.output_compression = params.output_compression;
    }

    // Remove undefined values
    Object.keys(openaiParams).forEach(key => {
      if (openaiParams[key] === undefined) {
        delete openaiParams[key];
      }
    });

    return await openai.images.generate(openaiParams);
  }

  static async editImage(params: OpenAIImageEditParams): Promise<OpenAIImageResponse> {
    // Map our parameters to OpenAI's API
    const openaiParams: any = {
      model: params.model,
      prompt: params.prompt,
      image: params.image,
      n: params.n,
      size: params.size === 'auto' ? undefined : params.size,
      quality: params.quality === 'auto' ? undefined : params.quality
    };

    // Add mask if provided
    if (params.mask) {
      openaiParams.mask = params.mask;
    }

    // Remove undefined values
    Object.keys(openaiParams).forEach(key => {
      if (openaiParams[key] === undefined) {
        delete openaiParams[key];
      }
    });

    return await openai.images.edit(openaiParams);
  }
}