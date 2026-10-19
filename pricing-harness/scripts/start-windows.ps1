$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This launcher targets Windows.' }
$root = Split-Path -Parent $PSScriptRoot
if ($args.Count -lt 1 -or $args.Count -gt 2) { throw 'Usage: powershell -ExecutionPolicy Bypass -File scripts\start-windows.ps1 C:\absolute\workspace [explicit/openrouter-model-id]' }
$env:PRICING_WORKSPACE = $args[0]
if ($args.Count -eq 2) { $env:PRICING_MODEL = $args[1] }
$env:PRICING_PROVIDER = 'openrouter'
$env:PRICING_PYTHON = "$root\.venv\Scripts\python.exe"
# Python reads and writes UTF-8 by default, as on macOS, instead of the Windows code page.
$env:PYTHONUTF8 = '1'
& node --env-file-if-exists="$root\.env" "$root\dist\server.js"
exit $LASTEXITCODE
