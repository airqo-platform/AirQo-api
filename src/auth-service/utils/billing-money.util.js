/**
 * Pure money helpers for invoices and receipts. Amounts are stored in major
 * units (27000.5 = $27,000.50) like the existing transactions, but every
 * calculation runs on integer minor units so totals never drift, and every
 * stored value is rounded to the currency's own precision (UGX has none).
 */

const decimalsCache = new Map();

const currencyDecimals = (currency) => {
  const code = String(currency || "USD").toUpperCase();
  if (!decimalsCache.has(code)) {
    let decimals = 2;
    try {
      decimals = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
      }).resolvedOptions().maximumFractionDigits;
    } catch (error) {
      decimals = 2;
    }
    decimalsCache.set(code, decimals);
  }
  return decimalsCache.get(code);
};

const isValidCurrency = (currency) => {
  try {
    new Intl.NumberFormat("en-US", { style: "currency", currency });
    return /^[A-Z]{3}$/.test(currency);
  } catch (error) {
    return false;
  }
};

const factor = (currency) => 10 ** currencyDecimals(currency);

const toMinor = (amount, currency) =>
  Math.round((Number(amount) || 0) * factor(currency));

const fromMinor = (minor, currency) => minor / factor(currency);

const roundMoney = (amount, currency) =>
  fromMinor(toMinor(amount, currency), currency);

const formatMoney = (amount, currency) => {
  const code = String(currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(Number(amount) || 0);
  } catch (error) {
    return `${code} ${Number(amount || 0).toFixed(2)}`;
  }
};

/**
 * Computes line amounts and invoice totals. The discount is a fixed amount
 * taken off the subtotal (capped at the subtotal) and tax applies to what
 * remains, i.e. discounts are applied before tax.
 */
const computeTotals = ({
  line_items = [],
  discount_amount = 0,
  tax_rate = 0,
  amount_paid = 0,
  currency = "USD",
}) => {
  const lines = line_items.map((line) => {
    const quantity = Number(line.quantity);
    const unitPrice = roundMoney(line.unit_price, currency);
    const amountMinor = Math.round(quantity * toMinor(unitPrice, currency));
    return {
      ...line,
      quantity,
      unit_price: unitPrice,
      amount: fromMinor(amountMinor, currency),
      _minor: amountMinor,
    };
  });

  const subtotalMinor = lines.reduce((sum, line) => sum + line._minor, 0);
  const discountMinor = Math.min(
    Math.max(toMinor(discount_amount, currency), 0),
    subtotalMinor,
  );
  const taxableMinor = subtotalMinor - discountMinor;
  const taxMinor = Math.round((taxableMinor * (Number(tax_rate) || 0)) / 100);
  const totalMinor = taxableMinor + taxMinor;
  const paidMinor = toMinor(amount_paid, currency);

  return {
    line_items: lines.map(({ _minor, ...line }) => line),
    subtotal: fromMinor(subtotalMinor, currency),
    discount_amount: fromMinor(discountMinor, currency),
    tax_amount: fromMinor(taxMinor, currency),
    total: fromMinor(totalMinor, currency),
    amount_paid: fromMinor(paidMinor, currency),
    amount_due: fromMinor(Math.max(totalMinor - paidMinor, 0), currency),
  };
};

/**
 * Status of an issued invoice after its paid amount changes. Drafts, voided
 * and converted documents keep their status.
 */
const deriveStatus = ({ status, total, amount_paid, currency }) => {
  if (["draft", "void", "converted"].includes(status)) return status;
  const totalMinor = toMinor(total, currency);
  const paidMinor = toMinor(amount_paid, currency);
  if (paidMinor >= totalMinor) return "paid";
  if (paidMinor > 0) return "partially_paid";
  return "open";
};

module.exports = {
  currencyDecimals,
  isValidCurrency,
  toMinor,
  fromMinor,
  roundMoney,
  formatMoney,
  computeTotals,
  deriveStatus,
};
