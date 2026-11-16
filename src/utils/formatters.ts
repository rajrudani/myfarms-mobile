/**
 * Indian & standard number / currency formatters for MyFarms app.
 * Formats numbers into readable Indian lakh/crore formats (e.g. ₹1,25,000).
 */

export interface CurrencyFormatOptions {
  showDecimals?: boolean;
  symbol?: string;
  fallback?: string;
}

/**
 * Formats a number or string into Indian currency notation:
 * e.g. 125000 -> ₹1,25,000
 * e.g. 12500000 -> ₹1,25,00,000
 * e.g. 540.5 -> ₹540.50 (if showDecimals is true or default)
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  options: CurrencyFormatOptions = {}
): string {
  const { showDecimals = false, symbol = '₹', fallback = '₹0' } = options;

  if (amount === null || amount === undefined || amount === '') {
    return fallback;
  }

  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) {
    return fallback;
  }

  const isNegative = num < 0;
  const absNum = Math.abs(num);

  let formattedNum = '';
  if (showDecimals || absNum % 1 !== 0) {
    formattedNum = absNum.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else {
    formattedNum = absNum.toLocaleString('en-IN', {
      maximumFractionDigits: 0,
    });
  }

  return `${isNegative ? '-' : ''}${symbol}${formattedNum}`;
}

/**
 * Formats quantities with thousand separators and unit:
 * e.g. formatQuantity(1250.5, 'Bag') -> '1,250.50 Bag'
 */
export function formatQuantity(
  qty: number | string | null | undefined,
  unit?: string
): string {
  if (qty === null || qty === undefined || qty === '') {
    return `0${unit ? ` ${unit}` : ''}`;
  }

  const num = typeof qty === 'string' ? parseFloat(qty) : qty;
  if (isNaN(num)) {
    return `0${unit ? ` ${unit}` : ''}`;
  }

  const formatted = num % 1 !== 0
    ? num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : num.toLocaleString('en-IN');

  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Compact Indian notation for tight tiles:
 * e.g. 1500000 -> '15L', 25000 -> '25K', 12000000 -> '1.2Cr'
 */
export function formatCompactCurrency(
  amount: number | string | null | undefined,
  symbol = '₹'
): string {
  if (amount === null || amount === undefined || amount === '') {
    return `${symbol}0`;
  }

  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${symbol}0`;

  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 10000000) {
    return `${sign}${symbol}${(abs / 10000000).toFixed(1).replace(/\.0$/, '')}Cr`;
  }
  if (abs >= 100000) {
    return `${sign}${symbol}${(abs / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  }
  if (abs >= 1000) {
    return `${sign}${symbol}${(abs / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }

  return `${sign}${symbol}${abs.toLocaleString('en-IN')}`;
}
