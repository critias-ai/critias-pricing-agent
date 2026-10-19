import {isAbsolute} from 'node:path';
import {Type} from 'typebox';
export const filePathParameters = Type.Object({
  filePath: Type.String({
    description: 'Absolute path to the generated file. No interpreter, command, quoting or arguments.',
  }),
});
export function toolFilePath(args: unknown): string {
  const path = (args as {filePath?: unknown})?.filePath;
  if (typeof path !== 'string' || !isAbsolute(path))
    throw new Error('Expected an absolute filePath, without a shell command');
  return path;
}
