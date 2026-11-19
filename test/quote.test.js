import test from "node:test";
import assert from "node:assert/strict";
import { calculateQuote, validateQuote } from "../src/domain/quote.js";
import { formatMoney } from "../src/domain/format.js";

const valid = {
  businessName: "BrightSide Services",
  clientName: "Taylor Morgan",
  clientEmail: "taylor@example.com",
  currency: "USD",
  taxPercent: 8.25,
  items: [
    { name: "Painting", quantity: 2, rate: 185.5 },
    { name: "Materials", quantity: 1, rate: 40 },
  ],
};

test("calculates line amounts, subtotal, tax, and total using cents", () => {
  assert.deepEqual(calculateQuote(valid.items, valid.taxPercent), {
    items: [
      { name: "Painting", description: "", quantity: 2, rate: 185.5, amount: 371 },
      { name: "Materials", description: "", quantity: 1, rate: 40, amount: 40 },
    ],
    subtotal: 411,
    tax: 33.91,
    total: 444.91,
    taxPercent: 8.25,
  });
});

test("rejects empty quote, invalid quantity, and unsupported tax", () => {
  assert.throws(() => calculateQuote([], 0), /at least one/);
  assert.throws(() => calculateQuote([{ name: "Work", quantity: 0, rate: 10 }], 0), /quantity/);
  assert.throws(() => calculateQuote([{ name: "Work", quantity: 1, rate: 10 }], 101), /Tax/);
});

test("validates required business/client details and client email", () => {
  assert.deepEqual(validateQuote(valid), []);
  assert.ok(validateQuote({ ...valid, clientEmail: "bad-email" }).includes("Enter a valid client email."));
  assert.ok(validateQuote({ ...valid, businessName: "" }).includes("Business name is required."));
});

test("formats supported currencies", () => {
  assert.match(formatMoney(1234.5, "USD", "en-US"), /1,234\.50/);
  assert.match(formatMoney(1234.5, "GBP", "en-GB"), /1,234\.50/);
});
