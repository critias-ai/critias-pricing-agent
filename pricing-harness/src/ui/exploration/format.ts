const number = new Intl.NumberFormat('en-GB', {maximumFractionDigits: 2});
export function formatValue(value: number | null, unit: string): string {
  if (value === null || !Number.isFinite(value)) return 'Unavailable';
  if (['GBP', 'USD', 'EUR', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY', 'INR'].includes(unit))
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: unit,
      maximumFractionDigits: unit === 'JPY' ? 0 : 2,
    }).format(value);
  return number.format(value) + (unit === '%' ? '%' : ` ${unit}`);
}
