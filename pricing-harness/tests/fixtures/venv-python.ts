import {resolve} from 'node:path';
// The app's virtualenv Python, where setup-macos.sh or setup-windows.ps1 put it.
export const venvPython = resolve(process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
