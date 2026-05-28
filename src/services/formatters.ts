const brCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const brQuantityFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3
});

export function formatCurrency(value: number | null | undefined): string {
  return brCurrencyFormatter.format(value ?? 0).replace(/[\u00A0\u202F]/g, ' ');
}

export function formatQuantity(value: number | null | undefined): string {
  return brQuantityFormatter.format(value ?? 0).replace(/[\u00A0\u202F]/g, ' ');
}

export function formatSignedCurrency(value: number | null | undefined): string {
  const amount = value ?? 0;
  if (amount > 0) return `+${formatCurrency(amount)}`;
  return formatCurrency(amount);
}

export function parseFormattedCurrency(value: string): number {
  return Number(value.replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
}
