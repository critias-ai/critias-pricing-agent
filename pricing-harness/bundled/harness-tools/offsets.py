"""After a grouped statement runs: in which groups do negative rows cancel much of a count?

For each plain sum of a whole-number column in a GROUP BY statement (sum(quantity) by product and quarter, say), a
group is noted when its negative rows offset at least OFFSET of its positive rows but the net stays positive: returns
that cancel most of what was sold. A per-unit value in such a group (a sum divided by that count) rests on little net
quantity. Groups whose net is zero or negative are not noted here. SQL facts only: no column is assumed to be a
quantity, and nothing is changed or excluded.

Out of scope for now: figures computed in Python scripts are not checked, only SQL run through the query tool."""
import json

from same_rows import CLAUSES, CREATE, _aggregates, _ast, _expression, _select_nodes, _sql

OFFSET, SHOWN = 0.5, 5


def _keys(node):
    """The node's grouping expressions, with GROUP BY 1 and GROUP BY alias resolved to the select items they name,
    and GROUP BY ALL resolved to the select items that do not aggregate."""
    items = node.get('select_list', [])
    named = {i.get('alias', '').lower(): i for i in items if i.get('alias')}
    if node.get('aggregate_handling') == 'FORCE_AGGREGATES':
        return [dict(i, alias='') for i in items if not _aggregates(i)]
    keys = []
    for g in node.get('groups', {}).get('group_expressions', []) or node.get('group_expressions', []):
        if g.get('class') == 'CONSTANT' and str(g.get('value', {}).get('value', '')).isdigit():
            g = items[int(g['value']['value']) - 1]
        elif g.get('class') == 'COLUMN_REF' and len(g['column_names']) == 1 and g['column_names'][0].lower() in named:
            g = named[g['column_names'][0].lower()]
        keys.append(dict(g, alias=''))
    return keys


class Offsets:
    """Session state: groups already noted, so the same finding is told once."""

    def __init__(self):
        self.noted = set()

    def note(self, conn, sql):
        try:
            found = self._find(conn, sql)
        except Exception:  # the check never blocks or breaks a statement
            return ''
        lines = []
        for f in found:
            key = (f['expression'], tuple(f['examples']), f['groups'])
            if key in self.noted:
                continue
            self.noted.add(key)
            shown = '; '.join(f['examples'])
            lines.append(f"in {f['groups']:,} of the {f['total']:,} groups this statement returns, negative rows offset at "
                         f"least half, but not all, of the positive rows in {f['expression']} ({shown}"
                         f"{', …' if f['groups'] > len(f['examples']) else ''})")
        return ('Note: ' + '. '.join(s[0].upper() + s[1:] for s in lines) + '. A value per unit in these groups (a sum '
                'divided by that net amount) rests on little net quantity. They may be returns: check whether they '
                'change the answer.') if lines else ''

    def _find(self, conn, sql):
        tree = _ast(conn, CREATE.sub('', sql, count=1))
        if not tree or len(tree['statements']) != 1:
            return []
        top = tree['statements'][0]['node']
        template = _ast(conn, 'SELECT TRUE')
        true = template['statements'][0]['node']['select_list'][0]
        found = []
        for node in _select_nodes(top):
            keys = _keys(node)
            sums = [a for item in node.get('select_list', []) for a in _aggregates(item)
                    if a['function_name'].lower() == 'sum' and not a.get('filter') and len(a.get('children', [])) == 1
                    and a['children'][0].get('class') == 'COLUMN_REF']
            if keys and sums:
                found += self._probe(conn, top, node, keys, sums, template, true)
        return found

    def _probe(self, conn, top, node, keys, sums, template, true):
        inner = json.loads(json.dumps(node))
        inner['select_list'] = [dict(k, alias=f'g{i}') for i, k in enumerate(keys)]
        for i, a in enumerate(sums):
            inner['select_list'] += [dict(a['children'][0], alias=f'v{i}'), dict(a.get('filter') or true, alias=f'f{i}')]
        for clause in CLAUSES + ('groups', 'group_expressions'):
            inner.pop(clause, None)
        inner['aggregate_handling'] = 'STANDARD_HANDLING'
        inner['modifiers'] = []
        if node is not top:
            inner['cte_map'] = top.get('cte_map', inner.get('cte_map'))
        shell = json.loads(json.dumps(template))
        shell['statements'][0]['node'] = inner
        source = _sql(conn, shell)
        kinds = dict(conn.execute(f'SELECT column_name, column_type FROM (DESCRIBE {source})').fetchall())
        counts = [i for i in range(len(sums)) if any(t in kinds.get(f'v{i}', '') for t in ('INT', 'HUGEINT'))]
        if not counts:
            return []
        g = ', '.join(f'g{i}' for i in range(len(keys)))
        label = " || ', ' || ".join(f"coalesce(CAST(g{i} AS VARCHAR), 'NULL')" for i in range(len(keys)))
        cells = ', '.join(f'sum(TRY_CAST(v{i} AS DOUBLE)) FILTER (WHERE coalesce(f{i}, false) AND TRY_CAST(v{i} AS DOUBLE) > 0) AS p{i}, '
                          f'-sum(TRY_CAST(v{i} AS DOUBLE)) FILTER (WHERE coalesce(f{i}, false) AND TRY_CAST(v{i} AS DOUBLE) < 0) AS n{i}'
                          for i in range(len(sums)))
        far = [f'(p{i} > 0 AND n{i} >= {OFFSET} * p{i} AND n{i} < p{i})' if i in counts else 'false' for i in range(len(sums))]
        cols = ', '.join(f'count(*) FILTER (WHERE {far[i]}), list(label ORDER BY n{i} / p{i} DESC) FILTER (WHERE {far[i]})'
                         for i in range(len(sums)))
        row = conn.execute(f'SELECT count(*), {cols} FROM (SELECT {label} AS label, {cells} FROM ({source}) GROUP BY {g})').fetchone()
        total, out = row[0], []
        for i, a in enumerate(sums):
            groups, labels = row[1 + 2 * i], row[2 + 2 * i] or []
            if groups:
                out.append({'expression': _expression(conn, template, a), 'groups': groups, 'total': total,
                            'examples': labels[:SHOWN]})
        # Several sums often flag the same groups (quantity and value); tell each set of groups once.
        seen, unique = set(), []
        for f in out:
            if tuple(f['examples']) not in seen:
                seen.add(tuple(f['examples']))
                unique.append(f)
        return unique
