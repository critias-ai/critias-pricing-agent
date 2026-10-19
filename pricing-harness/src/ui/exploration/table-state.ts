import type {ResultTable} from '../../exploration.js';
export type TableState = {query: string; sort?: {key: string; direction: 'asc' | 'desc'}; page: number};
export function selectTableRows(table: ResultTable, state: TableState) {
  const query = state.query.trim().toLocaleLowerCase();
  const filtered = table.rows
    .map((row, index) => ({row, index}))
    .filter(({row}) => !query || row.label.toLocaleLowerCase().includes(query));
  if (state.sort) {
    const {key, direction} = state.sort;
    filtered.sort((a, b) => {
      const av = a.row.cells[key]?.value ?? null,
        bv = b.row.cells[key]?.value ?? null;
      if (av === null && bv === null) return a.index - b.index;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (direction === 'asc' ? av - bv : bv - av) || a.index - b.index;
    });
  }
  const pages = Math.max(1, Math.ceil(filtered.length / 25)),
    page = Math.max(1, Math.min(pages, Math.trunc(state.page) || 1));
  return {
    rows: filtered.slice((page - 1) * 25, page * 25).map(item => item.row),
    filtered: filtered.length,
    total: table.rows.length,
    page,
    pages,
  };
}
