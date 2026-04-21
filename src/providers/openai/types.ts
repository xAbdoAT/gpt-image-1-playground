// OpenAI Provider Types

export type OpenAIImageGenerateParams = {
  model: 'gpt-image-1' | 'gpt-image-1-mini' | 'gpt-image-1.5' | 'gpt-image-2';
  prompt: string;
  n?: number;
  size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto' | string;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  output_format?: 'png' | 'jpeg' | 'webp';
  output_compression?: number;
  background?: 'transparent' | 'opaque' | 'auto';
  moderation?: 'low' | 'auto';
};

export type OpenAIImageEditParams = {
  model: 'gpt-image-1' | 'gpt-image-1-mini' | 'gpt-image-1.5' | 'gpt-image-2';
  prompt: string;
  image: File | File[];
  mask?: File;
  n?: number;
  size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto' | string;
  quality?: 'low' | 'medium' | 'high' | 'auto';
};

export type OpenAIImageResponse = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    url?: string;
  }>;
  usage?: {
    input_tokens_details?: {
      text_tokens?: number;
      image_tokens?: number;
    };
    output_tokens?: number;
  };
};