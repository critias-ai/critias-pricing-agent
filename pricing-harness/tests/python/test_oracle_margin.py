import csv
import importlib.util
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def oracle():
    module_path = ROOT / "tests/evals/oracle_margin.py"
    assert module_path.exists(), "independent margin oracle has not been implemented"
    spec = importlib.util.spec_from_file_location("oracle_margin", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.compute_margin_oracle


def rows(name):
    with (ROOT / "tests/evals/inputs" / name).open(newline="") as source:
        return list(csv.DictReader(source))


def test_weighted_oracle_uses_totals_not_mean_of_rates():
    result = {item["product"]: item for item in oracle()(rows("weighted/sales.csv"))}
    assert result["low"]["group_margin"] == Decimal("0.275")
    assert result["high"]["group_margin"] == Decimal("0.275")
    assert result["high"]["detail_needed"] is True
    assert result["high"]["outlier"] is False


def test_boundary_oracle_uses_inclusive_bps_and_strict_revenue():
    result = {item["product"]: item for item in oracle()(rows("boundaries/sales.csv"))}
    assert result["A"]["group_margin"] == Decimal("0.30")
    assert result["A"]["deviation_bps"] == Decimal("500")
    assert result["B"]["deviation_bps"] == Decimal("-500")
    assert result["A"]["outlier"] is True
    assert result["A"]["detail_needed"] is False
    assert result["B"]["outlier"] is True
    assert result["B"]["detail_needed"] is True

def test_exact_boundary_with_recurring_rates_and_rounded_non_outliers():
    # Group profit 40 / revenue 440 = 1/11. A profit 31/220 differs by exactly .05.
    recurring=[{'year':'2021','group':'X','product':'A','revenue':'220','cogs':'189'},
               {'year':'2021','group':'X','product':'B','revenue':'220','cogs':'211'}]
    result=oracle()(recurring)
    assert all(row['outlier'] for row in result)
    near=[{'year':'2021','group':'X','product':'A','revenue':'1000000','cogs':'650001'},
          {'year':'2021','group':'X','product':'B','revenue':'1000000','cogs':'749999'}]
    assert all(not row['outlier'] for row in oracle()(near))
