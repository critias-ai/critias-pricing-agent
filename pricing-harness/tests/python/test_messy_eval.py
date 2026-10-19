"""The messy eval set: the solution's cleaning must give back the generator's clean truth exactly."""
import csv
import importlib.util
import json
import subprocess
import sys
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_cleaning_the_exports_gives_back_the_truth(tmp_path):
    make = load("make_messy", "tests/evals/generators/make_messy.py")
    truth, rebates, files = make.build(7)
    for name, rows in files.items():
        with (tmp_path / name).open("w", newline="") as f:
            csv.writer(f, lineterminator="\n").writerows(rows)
    lines, read_rebates = load("messy", "tests/evals/solutions/messy.py").clean(tmp_path)
    expected = sorted((r[0], r[1], r[2], r[3], r[4], r[5], r[6], None if make.no_cost(r) else r[7]) for r in truth)
    assert lines == expected
    assert read_rebates == rebates
    assert sum(1 for r in truth if make.no_cost(r)) > 0 and len(rebates) == 16


def test_the_saved_figures_reconcile_to_the_truth_to_the_penny():
    make = load("make_messy", "tests/evals/generators/make_messy.py")
    truth, rebates, _ = make.build(7)
    out = subprocess.run([sys.executable, "-I", str(ROOT / "tests/evals/solutions/messy.py"),
                          str(ROOT / "tests/evals/inputs/messy"), "messy-conversation"],
                         capture_output=True, text=True, check=True)
    yearly = {r["year"]: r for r in json.loads(out.stdout)["files"]["yearly.csv"]}
    want = defaultdict(lambda: [Decimal(0)] * 3)
    for r in truth:
        w = want[r[1][:4]]
        if make.no_cost(r):
            w[2] += r[5] * r[6]
        else:
            w[0], w[1] = w[0] + r[5] * r[6], w[1] + r[5] * (r[6] - r[7])
    want["2025"][1] -= sum(rebates.values())
    for year, (ns, gp, ex) in want.items():
        assert (Decimal(yearly[year]["net_sales"]), Decimal(yearly[year]["gross_profit"]),
                Decimal(yearly[year]["excluded_sales"])) == (ns, gp, ex)
