// Provider Registry
import { BaseProviderConfig, BaseModelConfig } from './types';

// Provider configurations
export const PROVIDER_CONFIGS: BaseProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_API_BASE_URL,
    enabled: true
  }
];

// Model configurations
export const MODEL_CONFIGS: BaseModelConfig[] = [
  {
    id: 'gpt-image-1',
    name: 'GPT Image 1',
    providerId: 'openai',
    parameters: {
      sizes: ['1024x1024', '1536x1024', '1024x1536'],
      qualities: ['low', 'medium', 'high', 'auto'],
      outputFormats: ['png', 'jpeg', 'webp'],
      supportsCompression: true,
      supportsBackground: true,
      supportsModeration: true
    }
  },
  {
    id: 'gpt-image-1.5',
    name: 'GPT Image 1.5',
    providerId: 'openai',
    parameters: {
      sizes: ['1024x1024', '1536x1024', '1024x1536'],
      qualities: ['low', 'medium', 'high', 'auto'],
      outputFormats: ['png', 'jpeg', 'webp'],
      supportsCompression: true,
      supportsBackground: true,
      supportsModeration: true
    }
  },
  {
    id: 'gpt-image-1-mini',
    name: 'GPT Image 1 Mini',
    providerId: 'openai',
    parameters: {
      sizes: ['1024x1024', '1536x1024', '1024x1536'],
      qualities: ['low', 'medium', 'high', 'auto'],
      outputFormats: ['png', 'jpeg', 'webp'],
      supportsCompression: true,
      supportsBackground: true,
      supportsModeration: true
    }
  },
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    providerId: 'openai',
    parameters: {
      sizes: ['auto', 'custom', '2048x2048', '3072x2048', '2048x3072'],
      qualities: ['low', 'medium', 'high', 'auto'],
      outputFormats: ['png', 'jpeg', 'webp'],
      supportsCompression: true,
      supportsBackground: false,
      supportsModeration: true
    }
  }
];

// Get enabled providers
export const getEnabledProviders = () => {
  return PROVIDER_CONFIGS.filter(provider => provider.enabled);
};

// Get models for a provider
export const getModelsForProvider = (providerId: string) => {
  return MODEL_CONFIGS.filter(model => model.providerId === providerId);
};

// Get all models grouped by provider
export const getAllModelsGrouped = () => {
  const providers = getEnabledProviders();
  const grouped: Record<string, BaseModelConfig[]> = {};
  
  providers.forEach(provider => {
    grouped[provider.id] = getModelsForProvider(provider.id);
  });
  
  return grouped;
};

// Get model by ID
export const getModelById = (modelId: string) => {
  return MODEL_CONFIGS.find(model => model.id === modelId);
};

// Get provider by ID
export const getProviderById = (providerId: string) => {
  return PROVIDER_CONFIGS.find(provider => provider.id === providerId);
};