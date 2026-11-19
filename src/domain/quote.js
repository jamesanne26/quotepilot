export const SUPPORTED_CURRENCIES = new Set(["USD", "GBP", "CAD", "AUD"]);

export function calculateQuote(items, taxPercent = 0) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new TypeError("Add at least one line item.");
  }
  if (!Number.isFinite(Number(taxPercent)) || Number(taxPercent) < 0 || Number(taxPercent) > 100) {
    throw new RangeError("Tax must be between 0 and 100 percent.");
  }

  const normalizedItems = items.map((item, index) => {
    const quantity = Number(item.quantity);
    const rate = Number(item.rate);
    if (!String(item.name || "").trim()) throw new TypeError(`Line ${index + 1} needs a description.`);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new RangeError(`Line ${index + 1} quantity must be greater than zero.`);
    if (!Number.isFinite(rate) || rate < 0) throw new RangeError(`Line ${index + 1} rate cannot be negative.`);
    return { name: String(item.name).trim(), description: String(item.description || "").trim(), quantity, rate, amount: roundMoney(quantity * rate) };
  });

  const subtotal = roundMoney(normalizedItems.reduce((sum, item) => sum + item.amount, 0));
  const tax = roundMoney(subtotal * Number(taxPercent) / 100);
  return { items: normalizedItems, subtotal, tax, total: roundMoney(subtotal + tax), taxPercent: Number(taxPercent) };
}

export function validateQuote(input) {
  const errors = [];
  if (!input || typeof input !== "object") return ["Quote details are required."];
  if (!String(input.businessName || "").trim()) errors.push("Business name is required.");
  if (!String(input.clientName || "").trim()) errors.push("Client name is required.");
  if (input.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.clientEmail)) errors.push("Enter a valid client email.");
  if (!SUPPORTED_CURRENCIES.has(input.currency)) errors.push("Choose a supported currency.");
  try { calculateQuote(input.items, input.taxPercent); } catch (error) { errors.push(error.message); }
  return errors;
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
