import {expect, it} from 'vitest';
import {DEFAULT_LIMITS} from '../../src/defaults.js';
import {loadConfig} from '../../src/runtime.js';
it('uses src/defaults.ts for limits when no config file is loaded', () => {
  const config = loadConfig({
    PRICING_CONFIG_FILE: '',
    PRICING_WORKSPACE: '/tmp/pricing-defaults',
    PRICING_PROVIDER: 'openrouter',
    PRICING_MODEL: 'explicit/model',
    PRICING_PYTHON: '/usr/bin/python3',
  });
  expect(config.workflowLimits).toEqual({
    milliseconds: DEFAULT_LIMITS.seconds * 1000,
    model: DEFAULT_LIMITS.modelAttempts,
    tool: DEFAULT_LIMITS.toolCalls,
  });
});
