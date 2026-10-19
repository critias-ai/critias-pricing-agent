"""Before a statement runs: do aggregates that one expression combines cover the same rows?

sum(x) skips rows where x is NULL and FILTER (WHERE ...) skips rows by condition, so in sum(sales) - sum(cogs) the
two totals can come from different rows. The check parses the statement with DuckDB, and for each expression that
combines aggregates over different columns it counts, on the statement's own FROM and WHERE, the rows that only one
of them covers. SQL facts only: which columns matter is read from the statement, never assumed."""
import json
import re

AGGREGATES = {'sum', 'avg', 'mean', 'count', 'fsum', 'sumkahan', 'kahan_sum'}
CREATE = re.compile(r'^\s*create\s+(or\s+replace\s+)?(temp(orary)?\s+)?(view|table)\s+\S+\s+as\s+', re.I)
CLAUSES = ('group_expressions', 'group_sets', 'having', 'qualify', 'sample')


def _ast(conn, sql):
    tree = json.loads(conn.execute('SELECT json_serialize_sql(?)', [sql]).fetchone()[0])
    return None if tree.get('error') else tree


def _sql(conn, tree):
    return conn.execute('SELECT json_deserialize_sql(?)', [json.dumps(tree)]).fetchone()[0]


def _expression(conn, template, expr):
    """SQL text of one expression, rendered by DuckDB through a one-column SELECT."""
    tree = json.loads(json.dumps(template))
    tree['statements'][0]['node']['select_list'] = [dict(expr, alias='')]
    return re.sub(r'^SELECT\s+', '', _sql(conn, tree))


def _aggregates(expr):
    """Plain aggregate calls in an expression, without descending into them or into subqueries."""
    if isinstance(expr, list):
        return [a for e in expr for a in _aggregates(e)]
    if not isinstance(expr, dict) or expr.get('class') == 'SUBQUERY':
        return []
    if expr.get('class') == 'FUNCTION' and expr.get('function_name', '').lower() in AGGREGATES:
        return [] if expr.get('distinct') else [expr]
    return [a for k, v in expr.items() if k != 'filter' for a in _aggregates(v)]


def _columns(expr):
    if isinstance(expr, list):
        return {c for e in expr for c in _columns(e)}
    if not isinstance(expr, dict):
        return set()
    own = {expr['column_names'][-1].lower()} if expr.get('class') == 'COLUMN_REF' else set()
    return own | {c for v in expr.values() for c in _columns(v)}


DIVISION = {'/', '//', 'divide'}


def _meets(expr, leaf):
    """Pairs of leaves (aggregates, or columns) that one calculation puts together. A division is its own unit: in
    c1 / s1 - c0 / s0, c1 meets s1 and c0 meets s0, but the two rates do not mix their parts."""
    pairs = []

    def walk(e):
        if not isinstance(e, dict) or e.get('class') == 'SUBQUERY':
            return []
        key = leaf(e)
        if key is not None:
            return [key]
        parts = [p for k, v in e.items() if k != 'filter' for x in (v if isinstance(v, list) else [v])
                 for p in [walk(x)] if p]
        pairs.extend((a, b) for i, p in enumerate(parts) for q in parts[i + 1:] for a in p for b in q)
        is_division = e.get('class') == 'FUNCTION' and e.get('function_name', '').lower() in DIVISION
        return [] if is_division else [x for p in parts for x in p]

    walk(expr)
    return pairs


def _select_nodes(node):
    """Every SELECT node in a statement: CTE bodies, FROM subqueries and set-operation branches."""
    if isinstance(node, list):
        return [n for x in node for n in _select_nodes(x)]
    if not isinstance(node, dict):
        return []
    own = [node] if node.get('type') == 'SELECT_NODE' else []
    return own + [n for v in node.values() for n in _select_nodes(v)]


def _differ(a, b):
    return _columns(a.get('children', [])) != _columns(b.get('children', []))


def _with_views(conn, top, depth=0, seen=None):
    """The statement's SELECT nodes, plus those of the views it reads (their totals may be combined here), each with
    the node that owns its CTEs."""
    seen = set() if seen is None else seen
    nodes = [(n, top) for n in _select_nodes(top)]
    if depth < 3:
        views = dict(conn.execute('SELECT lower(view_name), sql FROM duckdb_views() WHERE NOT internal').fetchall())
        for name in {t['table_name'].lower() for t in _tables(top)} - seen:
            seen.add(name)
            tree = _ast(conn, CREATE.sub('', views[name], count=1)) if name in views else None
            if tree:
                nodes += _with_views(conn, tree['statements'][0]['node'], depth + 1, seen)
    return nodes


def _tables(node):
    if isinstance(node, list):
        return [t for x in node for t in _tables(x)]
    if not isinstance(node, dict):
        return []
    own = [node] if node.get('type') == 'BASE_TABLE' and node.get('table_name') else []
    return own + [t for v in node.values() for t in _tables(v)]


def mismatches(conn, sql):
    """Pairs of aggregates over different columns that cover different but overlapping rows, with how many rows (and
    how much of each argument) only one of them covers. 'combined' pairs meet in one expression, such as a rate or a
    difference, directly or through the columns of a CTE, subquery or view; the others are sums or averages shown
    side by side. A statement the parser cannot handle, or a probe that fails, gives no finding: the check never
    stops a statement it cannot read."""
    try:
        tree = _ast(conn, CREATE.sub('', sql, count=1))
        if not tree or len(tree['statements']) != 1:
            return []
        top = tree['statements'][0]['node']
        template = _ast(conn, 'SELECT TRUE')
        true = template['statements'][0]['node']['select_list'][0]
        nodes = _with_views(conn, top)
        # Where two named columns meet in one expression of this statement, a rate or difference is built from them.
        column = lambda e: e['column_names'][-1].lower() if e.get('class') == 'COLUMN_REF' else None
        meet = [(item.get('alias') or _expression(conn, template, item), {frozenset(p) for p in _meets(item, column)})
                for node in _select_nodes(top) for item in node.get('select_list', [])]
        own = {id(n) for n in _select_nodes(top)}
        found, seen = [], set()
        for node, owner in nodes:
            items = [(item, _aggregates(item)) for item in node.get('select_list', [])]
            aggregate = lambda e: e if e in _aggregates(e) else None
            pairs = [(item, a, b, True) for item, _ in items for a, b in _meets(item, aggregate) if _differ(a, b)]
            # Side by side, a COUNT of a sometimes-blank column (a name, say) is not a value someone adds up, and a
            # filtered subtotal next to its total is deliberate.
            totals = [(item, a) for item, aggs in items for a in aggs
                      if a['function_name'].lower() != 'count' and not a.get('filter')]
            pairs += [((x, y), a, b, False) for i, (x, a) in enumerate(totals) for y, b in totals[i + 1:]
                      if x is not y and _differ(a, b)]
            for f in (_probe(conn, owner, node, pairs, template, true) if pairs else []):
                if not f['combined'] and len(f['aliases']) == 2:
                    used = [name for name, met in meet if frozenset(f['aliases']) in met]
                    if used:
                        f.update(combined=True, expression=used[0])
                key = (f['combined'], f['expression'] if f['combined'] else '', f['first'], f['second'])
                # A view's own side-by-side totals were noted when it was made; only a combination is news here.
                if key not in seen and (f['combined'] or id(node) in own):
                    seen.add(key)
                    found.append(f)
        return found
    except Exception:
        return []


def _probe(conn, top, node, pairs, template, true):
    distinct = list({id(a): a for _, x, y, _ in pairs for a in (x, y)}.values())
    index = {id(a): i for i, a in enumerate(distinct)}
    inner = json.loads(json.dumps(node))
    inner['select_list'] = []
    for i, a in enumerate(distinct):
        value = a['children'][0] if a.get('children') else true
        inner['select_list'] += [dict(value, alias=f'v{i}'), dict(a.get('filter') or true, alias=f'f{i}')]
    for clause in CLAUSES:
        inner.pop(clause, None)
    inner['modifiers'] = []
    if node is not top:
        inner['cte_map'] = top.get('cte_map', inner.get('cte_map'))
    shell = json.loads(json.dumps(template))
    shell['statements'][0]['node'] = inner
    covered = [f'(coalesce(f{i}, false) AND v{i} IS NOT NULL)' for i in range(len(distinct))]
    counts = []
    for _, a, b, _ in pairs:
        x, y = covered[index[id(a)]], covered[index[id(b)]]
        va, vb = f'TRY_CAST(v{index[id(a)]} AS DOUBLE)', f'TRY_CAST(v{index[id(b)]} AS DOUBLE)'
        for one, other, v in ((x, y, va), (y, x, vb)):
            only = f'FILTER (WHERE {one} AND NOT {other})'
            counts += [f'count(*) {only}', f'sum({v}) {only}', f'sum(abs({v})) {only}']
        counts.append(f'count(*) FILTER (WHERE {x} AND {y})')
    row = conn.execute(f'SELECT {", ".join(counts)} FROM ({_sql(conn, shell)})').fetchone()
    out = []
    for k, (item, a, b, combined) in enumerate(pairs):
        only_a, value_a, size_a, only_b, value_b, size_b, both = row[7 * k: 7 * k + 7]
        # Rows that add nothing (a CASE ... ELSE 0) do not change a total.
        only_a, only_b = (only_a if size_a else 0), (only_b if size_b else 0)
        # Aggregates over disjoint rows (Q2 against Q3) are a deliberate comparison, not a mixed population.
        if both and (only_a or only_b):
            aliases = {i.get('alias', '').lower() for i in item} - {''} if not combined else set()
            out.append({'combined': combined, 'aliases': aliases,
                        'expression': '' if not combined else item.get('alias') or _expression(conn, template, item),
                        'first': _expression(conn, template, a), 'second': _expression(conn, template, b),
                        'onlyFirst': only_a, 'onlyFirstValue': value_a,
                        'onlySecond': only_b, 'onlySecondValue': value_b})
    return out


def _gap(f):
    rows, inside, outside, value = (f['onlyFirst'], f['first'], f['second'], f['onlyFirstValue']) if f['onlyFirst'] \
        else (f['onlySecond'], f['second'], f['first'], f['onlySecondValue'])
    worth = f' (their values in {inside} total {value:,.2f})' if value is not None else ''
    return f'{rows:,} rows count in {inside} but not in {outside}{worth}'


def stop_message(found):
    """Why a statement that combines totals from different rows was not run."""
    gaps = ' '.join(dict.fromkeys(f'In {f["expression"]}, {_gap(f)}.' for f in found if f['combined']))
    return (f'Not run: {gaps} Aggregates skip NULLs and filtered rows, so this combines totals from different rows. '
            'Calculate them on the same rows (the same FILTER, or a WHERE that keeps only rows where every value they '
            'need is present) and report the left-out rows separately. If combining different rows is intended, send '
            'the same statement again unchanged and it will run.')


def note(found, shown=None):
    """A line under a result whose side-by-side totals come from different rows. A gap already in `shown` (the same
    rows and value, told earlier in the session) is not repeated."""
    shown = set() if shown is None else shown
    fresh = []
    for f in found:
        key = (f['onlyFirst'], round(f['onlyFirstValue'] or 0, 2), f['onlySecond'], round(f['onlySecondValue'] or 0, 2))
        if not f['combined'] and key not in shown:
            shown.add(key)
            fresh.append(_gap(f))
    gaps = '; '.join(fresh)
    return (f'Note: these totals come from different rows: {gaps}. Do not combine them into a rate or difference; '
            'calculate both on the same rows and report the left-out rows separately.') if gaps else ''
