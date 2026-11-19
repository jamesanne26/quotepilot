export function formatMoney(amount, currency = "USD", locale) {
  if (!Number.isFinite(Number(amount))) throw new TypeError("Amount must be numeric.");
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(amount));
}
