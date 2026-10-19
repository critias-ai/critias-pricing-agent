"""After a statement sums source rows: are some of those rows priced far from their peers?

Data findings picks the source columns whose values a key's median describes well (a unit price by product, say).
Here a row counts as far when its value is at least RATIO times, or at most 1/RATIO of, its key's median. When the
far rows summed by an aggregate of the statement carry at least SHARE of its total, the result gets a note; otherwise
the model is told nothing. SQL facts only: no column is assumed to be a price or a cost.

Out of scope for now: figures computed in Python scripts are not checked, only SQL run through the query tool."""
import json
import re

from same_rows import CLAUSES, _aggregates, _ast, _expression, _select_nodes, _sql

RATIO, SHARE = 5, 0.005
SUMS = {'sum', 'avg', 'mean', 'fsum', 'sumkahan', 'kahan_sum'}


def _sources(node):
    """Base tables in a SELECT node's own FROM (joins included, subqueries not)."""
    out = []

    def walk(t):
        if not isinstance(t, dict):
            return
        if t.get('type') == 'BASE_TABLE':
            out.append((t['table_name'].lower(), t.get('alias') or t['table_name']))
        elif t.get('type') == 'JOIN':
            walk(t.get('left'))
            walk(t.get('right'))

    walk(node.get('from_table'))
    return out


class PeerRatio:
    """Session state: per peer column a table of its key's bounds, and the notes already given."""

    def __init__(self, conn, peers, views):
        self.peers, self.noted = [], set()
        for n, p in enumerate(peers):
            view = views.get(p['source'])
            if not view:
                continue
            column, key, table = p['column'], p['key'], f'_peer_{n}'
            try:
                conn.execute(f'''CREATE OR REPLACE TEMP TABLE {table} AS SELECT "{key}" AS g,
                    median(TRY_CAST("{column}" AS DOUBLE)) / {RATIO} AS lo, median(TRY_CAST("{column}" AS DOUBLE)) * {RATIO} AS hi
                    FROM "{view}" WHERE isfinite(TRY_CAST("{column}" AS DOUBLE)) GROUP BY 1
                    HAVING count("{column}") >= 3 AND median(TRY_CAST("{column}" AS DOUBLE)) > 0''')
                self.peers.append({'view': view, 'column': column, 'key': key, 'table': table})
            except Exception:  # a column the typed view does not have, or cannot cast, is skipped
                pass

    def note(self, conn, sql):
        """A line under the result when far rows carry a material share of something it sums, else ''."""
        if not self.peers:
            return ''
        try:
            found = self._find(conn, sql)
        except Exception:  # the check never blocks or breaks a statement
            return ''
        made = re.match(r'^\s*create\s+(?:or\s+replace\s+)?(?:temp(?:orary)?\s+)?(view|table)\b', sql, re.I)
        groups = {}
        for f in found:
            key = (f['view'], f['column'], f['rows'], round(f['value'], 2))
            if key not in self.noted:
                self.noted.add(key)
                groups.setdefault((f['kind'], f['view'], f['column'], f['key']), []).append(f)
        sentences = []
        for (kind, view, column, key), fs in groups.items():
            rows = max(f['rows'] for f in fs)
            where = f'in this {made.group(1).lower()}' if kind == 'held' and made else 'this statement sums'
            whose = f"this {made.group(1).lower()}'s total" if kind == 'held' and made else 'its total here'
            held = (f"{fs[0]['value']:,.2f} of {fs[0]['expression']}, {fs[0]['share']:.1%} of {whose}" if len(fs) == 1 else
                    ' and '.join(f"{f['value']:,.2f} of {f['expression']} ({f['share']:.1%})" for f in fs))
            sentences.append(f'{rows:,} of the rows {where} have {column} at least {RATIO} times, or at most a fifth of, '
                             f"their {key}'s median across {view}. They hold {held}.")
        return (f'Note: {" ".join(sentences)} They may be entry errors: check whether they change the answer.'
                if sentences else '')

    def _find(self, conn, sql):
        from same_rows import CREATE
        tree = _ast(conn, CREATE.sub('', sql, count=1))
        if not tree or len(tree['statements']) != 1:
            return []
        creates = bool(CREATE.match(sql))
        top = tree['statements'][0]['node']
        template = _ast(conn, 'SELECT TRUE')
        true = template['statements'][0]['node']['select_list'][0]
        ref = _ast(conn, 'SELECT "a"."b"')['statements'][0]['node']['select_list'][0]
        by_view = {}
        for p in self.peers:
            by_view.setdefault(p['view'].lower(), []).append(p)
        found = []
        for node in _select_nodes(top):
            peers = [(alias, p) for name, alias in _sources(node) for p in by_view.get(name, [])]
            if not peers:
                continue
            items = node.get('select_list', [])
            measures = [(_expression(conn, template, a), a['children'][0], a.get('filter'), 'sum', None)
                        for item in items for a in _aggregates(item) if a['function_name'].lower() in SUMS and a.get('children')]
            # A view or table that keeps source rows without summing them defines a population: its numeric columns
            # are what later statements will sum, so they are measured here, once.
            if creates and not any(_aggregates(item) for item in items):
                for item in items:
                    if item.get('class') == 'STAR':
                        for alias, p in {a: p for a, p in peers}.items():
                            for column, kind in conn.execute(f'SELECT column_name, data_type FROM (DESCRIBE "{p["view"]}")').fetchall():
                                if any(t in kind for t in ('INT', 'DECIMAL', 'DOUBLE', 'FLOAT', 'NUMERIC')):
                                    measures.append((column, dict(ref, column_names=[alias, column]), None, 'held', column.lower()))
                    else:
                        plain = item['column_names'][-1] if item.get('class') == 'COLUMN_REF' else None
                        label = item.get('alias') or plain or _expression(conn, template, item)
                        measures.append((label, dict(item, alias=''), None, 'held', plain and plain.lower()))
            if measures:
                found += self._probe(conn, top, node, peers, measures[:30], template, true, ref)
        return found

    def _probe(self, conn, top, node, peers, measures, template, true, ref):
        inner = json.loads(json.dumps(node))
        inner['select_list'] = []
        for i, (_, value, condition, _, _) in enumerate(measures):
            inner['select_list'] += [dict(value, alias=f'v{i}'), dict(condition or true, alias=f'f{i}')]
        for k, (alias, p) in enumerate(peers):
            for part, column in (('m', p['column']), ('g', p['key'])):
                inner['select_list'].append(dict(ref, column_names=[alias, column], alias=f'{part}{k}'))
        for clause in CLAUSES:
            inner.pop(clause, None)
        inner['modifiers'] = []
        if node is not top:
            inner['cte_map'] = top.get('cte_map', inner.get('cte_map'))
        shell = json.loads(json.dumps(template))
        shell['statements'][0]['node'] = inner
        joins = ' '.join(f'LEFT JOIN {p["table"]} b{k} ON b{k}.g = x.g{k}' for k, (_, p) in enumerate(peers))
        far = [f'(TRY_CAST(x.m{k} AS DOUBLE) <> 0 AND (TRY_CAST(x.m{k} AS DOUBLE) < b{k}.lo OR TRY_CAST(x.m{k} AS DOUBLE) > b{k}.hi))'
               for k in range(len(peers))]
        cols, cells, totals = [], [], {}
        for i in range(len(measures)):
            v, f = f'abs(TRY_CAST(x.v{i} AS DOUBLE))', f'coalesce(x.f{i}, false)'
            totals[i] = len(cols)
            cols.append(f'sum({v}) FILTER (WHERE {f})')
            for k in range(len(peers)):
                if measures[i][4] == peers[k][1]['column'].lower():
                    continue  # the compared column itself (a price, say) is not something to add up
                cells.append((i, k, len(cols)))
                cols += [f'sum({v}) FILTER (WHERE {f} AND {far[k]})', f'count(x.v{i}) FILTER (WHERE {f} AND {far[k]})']
        row = conn.execute(f'SELECT {", ".join(cols)} FROM ({_sql(conn, shell)}) x {joins}').fetchone()
        material = {}
        for i, k, at in cells:
            total, value, rows = row[totals[i]], row[at], row[at + 1]
            if total and value and rows and value / total >= SHARE:
                p = peers[k][1]
                material.setdefault(k, []).append({'expression': measures[i][0], 'kind': measures[i][3], 'rows': rows,
                                                   'value': value, 'share': value / total, 'view': p['view'],
                                                   'column': p['column'], 'key': p['key']})
        # Several columns can flag the same rows; the note names the one whose far rows weigh most.
        return max(material.values(), key=lambda fs: max(f['share'] for f in fs), default=[])
