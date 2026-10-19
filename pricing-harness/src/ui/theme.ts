import {useSyncExternalStore} from 'react';
export type Theme = 'light' | 'dark';
const query = () => window.matchMedia('(prefers-color-scheme: dark)');
export const currentTheme = (): Theme => (query().matches ? 'dark' : 'light');
// Follows the system preference; the Critias tokens switch on [data-theme="dark"].
export function applyTheme() {
  const set = () => {
    document.documentElement.dataset.theme = currentTheme();
  };
  set();
  query().addEventListener('change', set);
}
const subscribe = (callback: () => void) => {
  const q = query();
  q.addEventListener('change', callback);
  return () => q.removeEventListener('change', callback);
};
export const useTheme = () => useSyncExternalStore(subscribe, currentTheme, (): Theme => 'light');
export const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
