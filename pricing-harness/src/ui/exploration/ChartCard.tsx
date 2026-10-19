import {useState} from 'react';
import type {ChartSpec, ResultTable as ResultTableData} from '../../exploration.js';
import {PlotlyChart} from './PlotlyChart.js';
import {ResultTable} from './ResultTable.js';
export function ChartCard({chart, table}: {chart: ChartSpec; table: ResultTableData}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <section className="view-card result-chart" aria-label={chart.title}>
      <header className="view-head">
        <h3>{chart.title}</h3>
        <div className="toggle" role="group" aria-label={`${chart.title} view`}>
          <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')}>
            Chart
          </button>
          <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>
            Table
          </button>
        </div>
      </header>
      {view === 'chart' ? <PlotlyChart chart={chart} table={table} /> : <ResultTable table={table} titled={false} />}
    </section>
  );
}
