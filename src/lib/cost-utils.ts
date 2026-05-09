type ApiUsage = {
    input_tokens_details?: {
        text_tokens?: number;
        image_tokens?: number;
    };
    output_tokens?: number;
};

export type CostDetails = {
    estimated_cost_usd: number;
    text_input_tokens: number;
    image_input_tokens: number;
    image_output_tokens: number;
};

// Pricing configuration object
const MODEL_PRICING = {
  'gpt-image-1': {
    textInput: 0.000005,      // $5.00/1M tokens
    imageInput: 0.00001,       // $10.00/1M tokens
    imageOutput: 0.00004       // $40.00/1M tokens
  },
  'gpt-image-1-mini': {
    textInput: 0.000002,       // $2.00/1M tokens
    imageInput: 0.0000025,     // $2.50/1M tokens
    imageOutput: 0.000008      // $8.00/1M tokens
  }
} as const;

// Type for model keys
type SupportedModel = keyof typeof MODEL_PRICING;

// Type guard to check if a model is supported
function isSupportedModel(model: string): model is SupportedModel {
  return model in MODEL_PRICING;
}

/**
 * Estimates the cost of an API call based on token usage.
 * @param usage - The usage object from the API response.
 * @param model - The model used.
 * @returns CostDetails object or null if usage data is invalid or model is not supported.
 */
export function calculateApiCost(
    usage: ApiUsage | undefined | null,
    model: string = 'gpt-image-1'
): CostDetails | null {
    if (!usage || !usage.input_tokens_details || usage.output_tokens === undefined || usage.output_tokens === null) {
        console.warn('Invalid or missing usage data for cost calculation:', usage);
        return null;
    }

    // Check if the model is supported
    if (!isSupportedModel(model)) {
        console.warn(`Unsupported model for cost calculation: ${model}. Returning null.`);
        return null;
    }

    const textInT = usage.input_tokens_details.text_tokens ?? 0;
    const imgInT = usage.input_tokens_details.image_tokens ?? 0;
    const imgOutT = usage.output_tokens ?? 0;

    // Basic validation for token types
    if (typeof textInT !== 'number' || typeof imgInT !== 'number' || typeof imgOutT !== 'number') {
        console.error('Invalid token types in usage data:', usage);
        return null;
    }

    // Get pricing for the specific model
    const pricing = MODEL_PRICING[model];
    
    const costUSD = 
        textInT * pricing.textInput + 
        imgInT * pricing.imageInput + 
        imgOutT * pricing.imageOutput;

    // Round to 4 decimal places
    const costRounded = Math.round(costUSD * 10000) / 10000;

    return {
        estimated_cost_usd: costRounded,
        text_input_tokens: textInT,
        image_input_tokens: imgInT,
        image_output_tokens: imgOutT
    };
}
