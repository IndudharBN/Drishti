export const currency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);

export const compactCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);

export const compactNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

export const percent = (value: number) =>
  `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

export const plainPercent = (value: number) => `${value.toFixed(2)}%`;

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
