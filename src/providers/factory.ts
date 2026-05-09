// Provider Factory
import { OpenAIProvider } from './openai/api';
import { GenerateParams, EditParams, ImageResponse } from './types';

export class ProviderFactory {
  static async generateImage(providerId: string, params: GenerateParams): Promise<ImageResponse> {
    switch (providerId) {
      case 'openai':
        return await OpenAIProvider.generateImage(params as any);
      default:
        throw new Error(`Provider ${providerId} not supported`);
    }
  }

  static async editImage(providerId: string, params: EditParams): Promise<ImageResponse> {
    switch (providerId) {
      case 'openai':
        return await OpenAIProvider.editImage(params as any);
      default:
        throw new Error(`Provider ${providerId} not supported`);
    }
  }
}