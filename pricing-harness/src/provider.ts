import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {getAgentDir} from '@earendil-works/pi-coding-agent';
import {PROVIDERS} from './defaults.js';
export type Provider = (typeof PROVIDERS)[number];
export const PROVIDER_ENV: Record<Provider, {key: string; model: string}> = {
  openai: {key: 'OPENAI_API_KEY', model: 'OPENAI_MODEL'},
  openrouter: {key: 'OPENROUTER_API_KEY', model: 'OPENROUTER_MODEL'},
  google: {key: 'GEMINI_API_KEY', model: 'GEMINI_MODEL'},
  anthropic: {key: 'ANTHROPIC_API_KEY', model: 'ANTHROPIC_MODEL'},
};
// Pi keeps saved logins (such as "Sign in with ChatGPT") in auth.json, keyed by provider.
export function storedCredentialProviders(): string[] {
  try {
    return Object.keys(JSON.parse(readFileSync(join(getAgentDir(), 'auth.json'), 'utf8')));
  } catch {
    return [];
  }
}
const set = (value: string | undefined) => value?.trim() || undefined;
// Which provider answers is decided by .env alone: the first of PROVIDERS with a key and a model.
// PRICING_PROVIDER and PRICING_MODEL override it (evals, scripted runs, the launcher's model argument).
export function chooseProvider(env: NodeJS.ProcessEnv, stored: string[] = storedCredentialProviders()) {
  const modelFor = (p: Provider) => set(env.PRICING_MODEL) ?? set(env[PROVIDER_ENV[p].model]);
  const explicit = set(env.PRICING_PROVIDER);
  if (explicit) {
    if (!(PROVIDERS as readonly string[]).includes(explicit))
      throw new Error(`PRICING_PROVIDER must be one of ${PROVIDERS.join(', ')}`);
    const modelId = modelFor(explicit as Provider);
    if (!modelId) throw new Error(`PRICING_MODEL or ${PROVIDER_ENV[explicit as Provider].model} is required`);
    return {provider: explicit as Provider, modelId};
  }
  for (const provider of PROVIDERS) {
    const modelId = modelFor(provider);
    if (modelId && (set(env[PROVIDER_ENV[provider].key]) || stored.includes(provider))) return {provider, modelId};
  }
  throw new Error(
    'No model provider is configured. Set a key and a model in .env, for example ANTHROPIC_API_KEY and ANTHROPIC_MODEL ' +
      '(or OPENAI_*, OPENROUTER_*, GEMINI_*).',
  );
}
