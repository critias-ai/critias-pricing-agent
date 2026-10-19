#!/usr/bin/env bash
set -euo pipefail
if [[ "$(uname -s)" != Darwin ]]; then echo 'This launcher targets macOS.' >&2; exit 1; fi
task_root="$(cd "$(dirname "$0")/.." && pwd)"
if [[ $# -lt 1 || $# -gt 2 ]]; then echo 'Usage: bash scripts/start-macos.sh /absolute/workspace [explicit/openrouter-model-id]' >&2; exit 1; fi
export PRICING_WORKSPACE="$1"
if [[ $# -eq 2 ]]; then export PRICING_MODEL="$2"; fi
export PRICING_PROVIDER=openrouter
export PRICING_PYTHON="$task_root/.venv/bin/python"
exec node --env-file-if-exists="$task_root/.env" "$task_root/dist/server.js"
