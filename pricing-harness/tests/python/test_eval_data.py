"""Every generated eval dataset is reproducible: rebuilding it gives the committed files byte for byte."""
import filecmp
import subprocess
import sys
from pathlib import Path

import pytest

EVALS = Path(__file__).resolve().parents[2] / "tests/evals"


@pytest.mark.parametrize("data, generator, args", [
    ("retail", "make_retail.py", []),
    ("retail-holdout", "make_retail.py", ["11"]),
    ("retail-outliers", "make_retail.py", ["--outliers"]),
    ("retail-ladder", "make_retail.py", ["--ladder"]),
    ("retail-ladder-neutral", "make_retail.py", ["--ladder", "--neutral"]),
    ("retail-fy", "make_retail.py", ["--until", "2025-11-14"]),
    ("messy", "make_messy.py", []),
    ("b2b", "make_b2b.py", []),
    ("b2b-clean", "make_b2b.py", ["--clean"]),
    ("saas", "make_saas.py", []),
    ("saas-clean", "make_saas.py", ["--clean"]),
    ("retail-mix", "make_retail.py", ["--mix"]),
    ("founder", "make_founder.py", ["--scale", "0.02"]),
    ("founder-clean", "make_founder.py", ["--scale", "0.02", "--clean"]),
    *[(f"b2b-{v}", "make_b2b_edges.py", [v]) for v in ("currency", "list-change", "peers", "uom", "credits", "kits", "po", "columns")],
])
def test_generators_rebuild_the_committed_data(tmp_path, data, generator, args):
    subprocess.run([sys.executable, "-I", str(EVALS / "generators" / generator), str(tmp_path), *args], check=True)
    built = sorted(p.name for p in tmp_path.iterdir())
    assert built and all(filecmp.cmp(tmp_path / n, EVALS / "inputs" / data / n, shallow=False) for n in built)
