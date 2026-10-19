// Built-in fallbacks. harness.config.json and PRICING_* variables override every value here.
export const PROVIDERS = ['openrouter', 'openai'] as const;
export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export const DEFAULT_LIMITS = {seconds: 900, modelAttempts: 100, toolCalls: 150} as const;
