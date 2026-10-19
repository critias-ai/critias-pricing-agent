import {useState} from 'react';
import type {ExplorationResult} from '../../exploration.js';
import {ResultTable} from './ResultTable.js';
import {ChartCard} from './ChartCard.js';
import {explorationViews} from './views.js';
// F9: the first view inline; the rest one click away so the answer and composer stay close.
export function Exploration({result}: {result: ExplorationResult}) {
  const views = explorationViews(result);
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? views : views.slice(0, 1);
  const more = views.length - 1;
  return (
    <div className="exploration">
      <div className="result-scope">
        <strong>Verified result</strong>
        {result.coverage.length > 0 && (
          <ul>
            {result.coverage.map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ul>
        )}
      </div>
      {shown.map(view =>
        view.kind === 'chart' ? (
          <ChartCard key={view.id} chart={view.chart} table={view.table} />
        ) : (
          <ResultTable key={view.id} table={view.table} />
        ),
      )}
      {!expanded && more > 0 && (
        <button type="button" className="more-views" onClick={() => setExpanded(true)}>
          Show {more} more {more === 1 ? 'view' : 'views'}
        </button>
      )}
    </div>
  );
}
