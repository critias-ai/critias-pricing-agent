import sys
from pathlib import Path

import duckdb
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'bundled/harness-tools'))
from same_rows import mismatches, note, stop_message  # noqa: E402


@pytest.fixture
def conn():
    c = duckdb.connect()
    # Line 3 has a blank cost; line 4 is Q3. The customer name is blank on line 2 and must never matter.
    c.execute("""CREATE TABLE lines AS SELECT * FROM (VALUES
        ('Q2', 'Ann', 100.0, 60.0, 0), ('Q2', NULL, 50.0, 20.0, 0),
        ('Q2', 'Bo', 40.0, NULL, 1), ('Q3', 'Cy', 80.0, 50.0, 0)) t(q, customer, sales, cogs, bad)""")
    c.execute('SET enable_external_access=false')
    return c


def test_a_rate_over_rows_where_one_value_is_missing_is_found(conn):
    found = mismatches(conn, 'SELECT q, 1 - sum(cogs) / sum(sales) AS margin FROM lines GROUP BY q')
    assert note(found) == ''
    assert [(f['expression'], f['onlyFirst'], f['onlySecond'], f['onlySecondValue']) for f in found] == [
        ('margin', 0, 1, 40.0)]
    assert 'In margin, 1 rows count in sum(sales) but not in sum(cogs) (their values in sum(sales) total 40.00)' \
        in stop_message(found)


def test_a_filter_on_one_side_only_is_found(conn):
    # The shape a live run used: gross profit over all sales but cost only on usable lines.
    found = mismatches(conn, 'SELECT sum(sales) - sum(cogs) FILTER (WHERE bad = 0) AS gp FROM lines')
    assert [(f['combined'], f['onlyFirst']) for f in found] == [(True, 1)]


def test_the_same_rows_on_both_sides_pass(conn):
    assert mismatches(conn, 'SELECT 1 - sum(cogs) / sum(sales) AS m FROM lines WHERE cogs IS NOT NULL') == []
    assert mismatches(conn, 'SELECT 1 - sum(cogs) FILTER (WHERE cogs IS NOT NULL) / '
                            'sum(sales) FILTER (WHERE cogs IS NOT NULL) AS m FROM lines') == []


def test_totals_side_by_side_run_with_a_note_and_counts_of_other_columns_are_left_alone(conn):
    # Sales and cost next to each other may run, but the reader is told they cover different rows.
    found = mismatches(conn, 'SELECT sum(sales) AS s, sum(cogs) AS c FROM lines')
    assert [f['combined'] for f in found] == [False]
    assert note(found).startswith('Note: these totals come from different rows: 1 rows count in sum(sales)')
    # A blank customer name is not a value being added up.
    assert mismatches(conn, 'SELECT count(customer) AS named, sum(sales) AS s FROM lines') == []
    assert mismatches(conn, 'SELECT customer, sum(sales) AS s FROM lines GROUP BY customer') == []


def test_comparisons_between_disjoint_rows_and_shares_of_one_column_pass(conn):
    pivot = "SELECT sum(sales) FILTER (WHERE q = 'Q3') - sum(sales) FILTER (WHERE q = 'Q2') AS change FROM lines"
    share = "SELECT sum(sales) FILTER (WHERE q = 'Q3') / sum(sales) AS q3_share FROM lines"
    assert mismatches(conn, pivot) == []
    assert mismatches(conn, share) == []


def test_ctes_subqueries_and_create_view_are_checked(conn):
    cte = 'WITH x AS (SELECT * FROM lines) SELECT sum(sales) - sum(cogs) AS gp FROM x'
    sub = 'SELECT gp FROM (SELECT q, sum(sales) - sum(cogs) AS gp FROM lines GROUP BY q)'
    view = 'CREATE OR REPLACE VIEW m AS SELECT 1 - sum(cogs) / sum(sales) AS margin FROM lines'
    assert [len(mismatches(conn, s)) for s in (cte, sub, view)] == [1, 1, 1]


def test_statements_it_cannot_read_are_never_stopped(conn):
    assert mismatches(conn, 'DESCRIBE lines') == []
    assert mismatches(conn, 'SELECT sum(nope) - sum(sales) FROM lines') == []


def test_rows_that_add_nothing_and_filtered_subtotals_pass(conn):
    share = "SELECT sum(CASE WHEN q = 'Q3' THEN cogs ELSE 0 END) / sum(cogs) AS q3_cost_share FROM lines"
    assert mismatches(conn, share) == []
    assert mismatches(conn, 'SELECT sum(sales) AS s, sum(cogs) FILTER (WHERE bad = 0) AS c FROM lines') == []


def test_a_note_names_each_gap_once_per_session(conn):
    shown = set()
    found = mismatches(conn, 'SELECT sum(sales) AS s, sum(cogs) AS c FROM lines')
    assert note(found, shown) and note(found, shown) == ''


def test_totals_combined_through_a_cte_or_a_saved_view_are_found(conn):
    # The live shape: a CTE puts sales and cost side by side, the outer select divides them.
    cte = 'WITH t AS (SELECT q, sum(sales) AS sales, sum(cogs) AS cogs FROM lines GROUP BY q) ' \
          'SELECT q, (sales - cogs) / sales AS margin FROM t'
    found = mismatches(conn, cte)
    assert [(f['combined'], f['expression']) for f in found] == [(True, 'margin')]
    conn.execute('CREATE VIEW totals AS SELECT q, sum(sales) AS sales, sum(cogs) AS cogs FROM lines GROUP BY q')
    found = mismatches(conn, 'SELECT q, 1 - cogs / sales AS margin FROM totals')
    assert [(f['combined'], f['expression']) for f in found] == [(True, 'margin')]
    # Reading the view without combining its totals is not news.
    assert mismatches(conn, 'SELECT q, sales FROM totals') == []


def test_two_rates_compared_do_not_mix_their_parts(conn):
    # Each rate is checked on its own; a product sold only in one quarter does not make the comparison wrong.
    conn.execute("""CREATE TABLE p AS SELECT * FROM (VALUES (10.0, 6.0, 12.0, 7.0), (5.0, 2.0, NULL, NULL),
        (NULL, NULL, 8.0, 5.0)) t(s0, c0, s1, c1)""")
    assert mismatches(conn, 'SELECT (1 - sum(c1) / sum(s1)) - (1 - sum(c0) / sum(s0)) AS movement FROM p') == []
    cte = 'WITH t AS (SELECT sum(s0) AS s0, sum(c0) AS c0, sum(s1) AS s1, sum(c1) AS c1 FROM p) ' \
          'SELECT (1 - c1 / s1) - (1 - c0 / s0) AS movement FROM t'
    assert [f for f in mismatches(conn, cte) if f['combined']] == []
