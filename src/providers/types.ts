// Generic Provider Types

export type ProviderType = 'openai' | 'google' | ' StabilityAI' | 'other';

export interface BaseProviderConfig {
  id: string;
  name: string;
  provider: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface BaseModelConfig {
  id: string;
  name: string;
  providerId: string;
  parameters: Record<string, any>;
}

export interface GenerateParams {
  model: string;
  prompt: string;
  [key: string]: any;
}

export interface EditParams {
  model: string;
  prompt: string;
  image: File | File[];
  [key: string]: any;
}

export interface ImageResponse {
  data: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
  usage?: {
    input_tokens_details?: {
      text_tokens?: number;
      image_tokens?: number;
    };
    output_tokens?: number;
  };
}