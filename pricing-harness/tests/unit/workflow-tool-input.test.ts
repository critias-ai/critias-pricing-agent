import {expect, it} from 'vitest';
import {toolFilePath} from '../../src/agent/workflow/tool-input.js';
it('takes an absolute file path without interpreting shell commands or relative paths', () => {
  expect(toolFilePath({filePath: '/tmp/my analysis.py'})).toBe('/tmp/my analysis.py');
  for (const args of [
    {command: 'python /tmp/a.py'},
    {filePath: 'python /tmp/a.py'},
    {filePath: "'/tmp/a.py'"},
    {filePath: 'a.py'},
    {filePath: null},
  ])
    expect(() => toolFilePath(args)).toThrow(/absolute filePath/);
});
