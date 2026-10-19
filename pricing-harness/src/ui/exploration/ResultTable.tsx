import {useId, useState} from 'react';
import type {ResultTable as ResultTableData} from '../../exploration.js';
import {selectTableRows, type TableState} from './table-state.js';
import {formatValue} from './format.js';
export function ResultTable({table, titled = true}: {table: ResultTableData; titled?: boolean}) {
  const [state, setState] = useState<TableState>({query: '', page: 1});
  const id = useId();
  const selected = selectTableRows(table, state);
  const sort = (key: string) =>
    setState(old => ({
      ...old,
      page: 1,
      sort: {key, direction: old.sort?.key === key && old.sort.direction === 'asc' ? 'desc' : 'asc'},
    }));
  return (
    <section className={`result-table${titled ? ' view-card' : ''}`} aria-label={table.title}>
      {titled && <h3>{table.title}</h3>}
      <div className="table-controls">
        <label htmlFor={id}>Search table labels</label>
        <input
          id={id}
          type="search"
          value={state.query}
          onChange={event => setState(old => ({...old, query: event.target.value, page: 1}))}
        />
        <button onClick={() => setState({query: '', page: 1})}>Reset table</button>
      </div>
      <p className="table-count">
        {selected.filtered} of {selected.total} rows ·{' '}
        {selected.filtered ? `${(selected.page - 1) * 25 + 1}–${Math.min(selected.page * 25, selected.filtered)}` : '0'}{' '}
        shown
      </p>
      <p className="scroll-hint">Table controls affect this table only. Scroll sideways for more columns.</p>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={`${table.title} data, scroll horizontally`}>
        <table>
          <thead>
            <tr>
              <th scope="col">{table.rowHeader}</th>
              {table.columns.map(column => (
                <th
                  scope="col"
                  key={column.key}
                  className="num"
                  aria-sort={
                    state.sort?.key === column.key
                      ? state.sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button onClick={() => sort(column.key)}>
                    {column.label} ({column.unit}){' '}
                    {state.sort?.key === column.key ? (state.sort.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {selected.rows.map(row => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                {table.columns.map(column => {
                  const cell = row.cells[column.key]!;
                  return (
                    <td key={column.key} className={cell.text === undefined ? 'num' : undefined}>
                      {cell.text ?? formatValue(cell.value, column.unit)}
                      {cell.status === 'held' && <span className="held-reason">{cell.reason}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!selected.filtered && (
          <p className="empty-table">No matching rows. Reset the table to see all delivered results.</p>
        )}
      </div>
      <div className="table-pages">
        <button disabled={selected.page === 1} onClick={() => setState(old => ({...old, page: selected.page - 1}))}>
          Previous page
        </button>
        <span>
          Page {selected.page} of {selected.pages}
        </span>
        <button
          disabled={selected.page === selected.pages}
          onClick={() => setState(old => ({...old, page: selected.page + 1}))}
        >
          Next page
        </button>
      </div>
    </section>
  );
}
