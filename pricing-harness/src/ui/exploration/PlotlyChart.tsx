import {useEffect, useRef, useState} from 'react';
import type {ChartSpec, ResultTable} from '../../exploration.js';
import {buildPlotlyFigure, type PlotPalette} from './plotly-adapter.js';
import {token, useTheme} from '../theme.js';
const palette = (): PlotPalette => ({
  series: ['--color-primary', '--color-accent-warm', '--color-accent-secondary', '--sea-mist'].map(token),
  text: token('--color-text'),
  grid: token('--color-border'),
});
// Reset is Plotly's own toolbar button or a double-click on the plot.
export function PlotlyChart({chart, table}: {chart: ChartSpec; table: ResultTable}) {
  const container = useRef<HTMLDivElement>(null),
    plotly = useRef<typeof import('plotly.js-basic-dist-min').default | null>(null);
  const [error, setError] = useState(false);
  const theme = useTheme();
  useEffect(() => {
    const element = container.current!;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    setError(false);
    void import('plotly.js-basic-dist-min')
      .then(async module => {
        if (disposed) return;
        plotly.current = module.default;
        const figure = buildPlotlyFigure(chart, table, palette());
        await module.default.react(
          element,
          structuredClone(figure.data),
          structuredClone(figure.layout),
          structuredClone(figure.config),
        );
        if (disposed) {
          module.default.purge(element);
          return;
        }
        observer = new ResizeObserver(() => {
          void module.default.Plots.resize(element).catch(() => {});
        });
        observer.observe(element);
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      plotly.current?.purge(element);
      plotly.current = null;
    };
  }, [chart, table, theme]);
  return error ? (
    <p className="chart-error" role="status">
      This chart could not be displayed. The verified text and data table remain available.
    </p>
  ) : (
    <div
      className="plotly-chart"
      role="img"
      aria-label={`${chart.title}. Switch to Table for the data.`}
      ref={container}
    />
  );
}
