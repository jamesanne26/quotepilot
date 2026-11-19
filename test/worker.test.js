import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

const base = "https://quotepilot-test.example";

test("serves the application and security headers", async () => {
  const response = await worker.fetch(new Request(base + "/"), {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(await response.text(), /Create a quote/);
});

test("exposes healthy test status and static assets", async () => {
  const health = await worker.fetch(new Request(base + "/api/health"), {});
  assert.deepEqual(await health.json(), { ok: true, app: "QuotePilot", environment: "test", database: false });
  const appJs = await worker.fetch(new Request(base + "/assets/app.js"), {});
  assert.match(await appJs.text(), /saveQuote/);
  const css = await worker.fetch(new Request(base + "/assets/styles.css"), {});
  assert.match(await css.text(), /--blue:#315efb/);
});

test("requires a configured database before exposing account APIs", async () => {
  const response = await worker.fetch(new Request(base + "/api/quotes/validate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessName: "Painter", clientName: "Taylor", clientEmail: "taylor@example.com", currency: "USD", taxPercent: 10, items: [{ name: "Painting", quantity: 2, rate: 100 }] }),
  }), {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "Database is not configured.");
});

test("rejects invalid quote input and unsupported methods", async () => {
  const invalid = await worker.fetch(new Request(base + "/api/quotes/validate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessName: "", clientName: "", currency: "USD", taxPercent: 0, items: [] }),
  }), {});
  assert.equal(invalid.status, 503);
  assert.equal((await invalid.json()).ok, false);
  const method = await worker.fetch(new Request(base + "/", { method: "PUT" }), {});
  assert.equal(method.status, 405);
});
