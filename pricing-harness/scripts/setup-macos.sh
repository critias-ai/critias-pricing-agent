#!/usr/bin/env bash
set -euo pipefail
if [[ "$(uname -s)" != Darwin ]]; then echo 'This setup script targets macOS.' >&2; exit 1; fi
task_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$task_root"
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22||(a===22&&b<19)){throw Error("Node >=22.19 required")}'
task_python="${PRICING_BOOTSTRAP_PYTHON:-python3.12}"
"$task_python" -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm ci
if [[ -d src ]]; then npm run build; fi
echo 'Setup complete. Configure OpenRouter locally, then run bash scripts/start-macos.sh /absolute/workspace explicit/model-id'
