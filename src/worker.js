import { renderPage, styles, clientApp } from "./ui/page.js";
import { calculateQuote, validateQuote } from "./domain/quote.js";
import { formatMoney } from "./domain/format.js";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};

function response(body, contentType, status = 200) {
  return new Response(body, { status, headers: { ...SECURITY_HEADERS, "Content-Type": contentType, "Cache-Control": "no-store" } });
}
async function readJson(request, maxBytes = 20_000) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new RangeError("Request is too large.");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new RangeError("Request is too large.");
  return JSON.parse(text);
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") return response(renderPage(), "text/html; charset=utf-8");
    if (request.method === "GET" && url.pathname === "/assets/styles.css") return response(styles, "text/css; charset=utf-8");
    if (request.method === "GET" && url.pathname === "/assets/app.js") return response(clientApp, "text/javascript; charset=utf-8");
    if (request.method === "GET" && url.pathname === "/api/health") return Response.json({ ok: true, app: "QuotePilot", environment: "test" }, { headers: SECURITY_HEADERS });
    if (url.pathname === "/api/quotes/validate" && request.method === "POST") {
      try {
        const input = await readJson(request);
        const errors = validateQuote(input);
        if (errors.length) return Response.json({ ok: false, errors }, { status: 400, headers: SECURITY_HEADERS });
        const totals = calculateQuote(input.items, input.taxPercent);
        return Response.json({ ok: true, ...totals, totalFormatted: formatMoney(totals.total, input.currency) }, { headers: SECURITY_HEADERS });
      } catch (error) {
        return Response.json({ ok: false, errors: [error instanceof SyntaxError ? "Request body must be valid JSON." : error.message] }, { status: error instanceof SyntaxError ? 400 : 413, headers: SECURITY_HEADERS });
      }
    }
    if (request.method !== "GET" && request.method !== "HEAD") return response("Method not allowed", "text/plain; charset=utf-8", 405);
    return response("Not found", "text/plain; charset=utf-8", 404);
  },
};
