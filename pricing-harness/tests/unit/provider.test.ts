import {describe, expect, it} from 'vitest';
import {chooseProvider} from '../../src/provider.js';
describe('provider choice', () => {
  it('uses the only provider that has a key and a model', () => {
    expect(chooseProvider({ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'claude-sonnet-5-5'}, [])).toEqual({
      provider: 'anthropic',
      modelId: 'claude-sonnet-5-5',
    });
    expect(chooseProvider({GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-flash-latest'}, []).provider).toBe('google');
  });
  it('prefers openai, then openrouter, then google, then anthropic', () => {
    const all = {
      OPENAI_API_KEY: 'k',
      OPENAI_MODEL: 'a',
      OPENROUTER_API_KEY: 'k',
      OPENROUTER_MODEL: 'b',
      GEMINI_API_KEY: 'k',
      GEMINI_MODEL: 'c',
      ANTHROPIC_API_KEY: 'k',
      ANTHROPIC_MODEL: 'd',
    };
    expect(chooseProvider(all, []).provider).toBe('openai');
    const {OPENAI_API_KEY, ...noOpenai} = all;
    expect(chooseProvider(noOpenai, []).provider).toBe('openrouter');
    const {OPENROUTER_API_KEY, ...noRouter} = noOpenai;
    expect(chooseProvider(noRouter, []).provider).toBe('google');
  });
  it('counts a stored ChatGPT login as the OpenAI key', () => {
    expect(chooseProvider({OPENAI_MODEL: 'gpt-6-luna'}, ['openai'])).toEqual({
      provider: 'openai',
      modelId: 'gpt-6-luna',
    });
    expect(() => chooseProvider({OPENAI_MODEL: 'gpt-6-luna'}, [])).toThrow(/No model provider/);
  });
  it('skips a provider with a key but no model, and one with a model but no key', () => {
    expect(
      chooseProvider({OPENAI_API_KEY: 'k', ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'm', GEMINI_MODEL: 'g'}, [])
        .provider,
    ).toBe('anthropic');
  });
  it('lets PRICING_PROVIDER and PRICING_MODEL override the choice', () => {
    expect(chooseProvider({PRICING_PROVIDER: 'openrouter', PRICING_MODEL: 'x/y'}, [])).toEqual({
      provider: 'openrouter',
      modelId: 'x/y',
    });
    expect(chooseProvider({ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'm', PRICING_MODEL: 'other'}, []).modelId).toBe(
      'other',
    );
    expect(() => chooseProvider({PRICING_PROVIDER: 'other', PRICING_MODEL: 'x'}, [])).toThrow(
      /openai, openrouter, google, anthropic/,
    );
    expect(() => chooseProvider({PRICING_PROVIDER: 'google'}, [])).toThrow(/PRICING_MODEL or GEMINI_MODEL/);
  });
  it('names what to set when nothing is configured', () => {
    expect(() => chooseProvider({}, [])).toThrow(/ANTHROPIC_API_KEY and ANTHROPIC_MODEL/);
  });
});
