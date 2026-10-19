$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This setup script targets Windows.' }
function Check { if ($LASTEXITCODE) { throw "Setup step failed with exit code $LASTEXITCODE." } }
Set-Location (Split-Path -Parent $PSScriptRoot)
if ([version](node -p process.versions.node) -lt [version]'22.19') { throw 'Node >=22.19 required' }
# The analyst's shell commands run in Git for Windows' bash.exe, as the agent SDK requires.
$gitBash = @("$env:ProgramFiles\Git\bin\bash.exe", "${env:ProgramFiles(x86)}\Git\bin\bash.exe") | Where-Object { Test-Path $_ }
if (-not $gitBash) { throw 'Git for Windows is required: install it from https://git-scm.com/download/win' }
if ($env:PRICING_BOOTSTRAP_PYTHON) { & $env:PRICING_BOOTSTRAP_PYTHON -m venv .venv } else { py -3.12 -m venv .venv }
Check
.venv\Scripts\python.exe -m pip install -r requirements.txt; Check
npm ci; Check
if (Test-Path src) { npm run build; Check }
Write-Output 'Setup complete. Configure OpenRouter locally, then run powershell -ExecutionPolicy Bypass -File scripts\start-windows.ps1 C:\absolute\workspace explicit/model-id'
