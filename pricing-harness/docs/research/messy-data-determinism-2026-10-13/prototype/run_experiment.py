"""Run one benchmark question for one variant chain (baseline | index | index_view) on several models.

Each run gets a fresh workspace copy, so no cache or conversation carries over. A run is stopped
when the variant's spend would pass its budget. Results go to <evidence>/<variant>/summary.json.

Usage: python -I run_experiment.py <app root> <evidence dir> <variant> <budget USD> <question> <model:cap> ...
"""

import json
import os
import shutil
import signal
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

app, evidence, variant, budget, question = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], float(sys.argv[4]), sys.argv[5]
models = [(m.rsplit(':', 1)[0], float(m.rsplit(':', 1)[1])) for m in sys.argv[6:]]
template = Path(os.environ.get('TEMPLATE', app / 'workspace/northbridge-test'))
builder = Path(__file__).with_name('build_index.py')
out = evidence / variant
out.mkdir(parents=True, exist_ok=True)


def run_cost(ws):
    total, calls, tokens = 0.0, 0, {'input': 0, 'output': 0, 'cacheRead': 0, 'reasoning': 0}
    for f in ws.glob('analyses/*/*/sessions/*.jsonl'):
        for line in f.read_text().splitlines():
            try:
                message = json.loads(line).get('message') or {}
            except ValueError:
                continue
            usage = message.get('usage') if isinstance(message, dict) else None
            if usage:
                calls += 1
                total += usage.get('cost', {}).get('total', 0)
                for k in tokens:
                    tokens[k] += usage.get(k, 0)
    return total, calls, tokens


spent, results = 0.0, []
for model, cap in models:
    slug = model.split('/')[-1]
    ws = out / f'ws-{slug}'
    if ws.exists():
        shutil.rmtree(ws)
    (ws / '.pricing').mkdir(parents=True)
    subprocess.run(['cp', '-Rc', str(template / 'files'), str(ws / 'files')], check=True)
    subprocess.run(['cp', '-Rc', str(template / '.pricing/data-cache'), str(ws / '.pricing/data-cache')], check=True)
    for name in ('context.md', 'files.json'):
        shutil.copy(template / '.pricing' / name, ws / '.pricing' / name)
    env = dict(os.environ, PRICING_PYTHON=str(app / '.venv/bin/python'), PRICING_WORKSPACE=str(ws), PRICING_MODEL=model, PRICING_PROVIDER='openrouter', PRICING_THINKING_LEVEL='high')
    for name in ('PRICING_WORKSPACE_INDEX', 'PRICING_INDEX_DIAGNOSTICS', 'PRICING_CONFIG_FILE'):
        env.pop(name, None)
    if variant != 'baseline':
        index_dir = ws / '.pricing/index'
        flags = {'index': [], 'index_view': ['--prepared-view'], 'code_checks': ['--prepared-view', '--code-checks'],
                 'code_checks_noverify': ['--prepared-view', '--code-checks']}[variant]
        subprocess.run([sys.executable, '-I', str(builder), str(ws / 'files/data'), str(index_dir)] + flags, check=True, stdout=subprocess.DEVNULL)
        env['PRICING_WORKSPACE_INDEX'] = str(index_dir / 'index.md')
        if '--code-checks' in flags:
            env['PRICING_INDEX_DIAGNOSTICS'] = str(index_dir / 'diagnostics.json')
        if variant == 'code_checks_noverify':
            # Review routing sends only reconciliation, scope, unclassified and definition beyond notes.
            env['PRICING_CONFIG_FILE'] = str(evidence / 'harness.config.noverify.json')
    allowed = min(cap, budget - spent)
    started = time.time()
    with open(out / f'{slug}.stdout.jsonl', 'w') as so, open(out / f'{slug}.stderr.txt', 'w') as se:
        proc = subprocess.Popen(['node', '--env-file-if-exists=.env', 'node_modules/tsx/dist/cli.mjs', 'src/headless.ts', '--question', question],
                                cwd=app, env=env, stdout=so, stderr=se, start_new_session=True)
        stopped = None
        while proc.poll() is None:
            time.sleep(10)
            cost = run_cost(ws)[0]
            if cost > allowed and not stopped:
                stopped = f'budget: ${cost:.4f} > ${allowed:.4f}'
                os.killpg(proc.pid, signal.SIGINT)
                stop_at = time.time()
            if stopped and time.time() - stop_at > 90 and proc.poll() is None:
                os.killpg(proc.pid, signal.SIGKILL)
        proc.wait()
    wall = time.time() - started
    cost, calls, tokens = run_cost(ws)
    spent += cost
    run = {}
    for line in (out / f'{slug}.stdout.jsonl').read_text().splitlines():
        try:
            item = json.loads(line)
        except ValueError:
            continue
        if item.get('type') == 'turn_end':
            run = item.get('run') or {}
    stages = [{k: s.get(k) for k in ('role', 'operation', 'elapsedMs', 'model', 'tool', 'estimatedCostUSD', 'modelTiming')} for s in (run.get('workflow') or {}).get('stages', [])]
    messages = []
    conv = ws / '.pricing/workflow/conversation.json'
    if conv.exists():
        data = json.loads(conv.read_text())
        items = data.get('messages', data) if isinstance(data, dict) else data
        messages = [m.get('text') for m in items if isinstance(m, dict) and m.get('role') == 'assistant']
    results.append(dict(model=model, variant=variant, wallSeconds=round(wall), costUSD=round(cost, 4), allowedUSD=round(allowed, 4),
                        stopped=stopped, outcome=run.get('outcome'), state=run.get('state'), modelCalls=calls, tokens=tokens,
                        stages=stages, reply=messages, runId=run.get('id'), finished=datetime.now().isoformat(timespec='seconds')))
    (out / 'summary.json').write_text(json.dumps(dict(question=question, budgetUSD=budget, spentUSD=round(spent, 4), runs=results), indent=1))
    print(json.dumps(results[-1])[:600], flush=True)
