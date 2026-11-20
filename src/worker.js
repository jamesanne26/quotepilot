import { renderPage, styles, clientApp } from "./ui/page.js";
import { calculateQuote, validateQuote } from "./domain/quote.js";
import { formatMoney } from "./domain/format.js";

const HEADERS = {
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY", "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};
const json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { ...HEADERS, "Cache-Control": "no-store", ...extra } });
const text = (body, type, status = 200) => new Response(body, { status, headers: { ...HEADERS, "Content-Type": type, "Cache-Control": "no-store" } });
const now = () => Math.floor(Date.now() / 1000);
const uid = () => crypto.randomUUID();
const encoder = new TextEncoder();
const hex = (bytes) => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
async function hash(value) { return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value))); }
async function rpc(env, name, payload) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) throw new Error("Supabase is not configured.");
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.message || data.details || "Supabase request failed."); error.code = data.code; throw error; }
  return data;
}
async function body(request) {
  const n = Number(request.headers.get("content-length") || 0);
  if (n > 20_000) throw new RangeError("Request body is too large.");
  const raw = await request.text();
  if (encoder.encode(raw).length > 20_000) throw new RangeError("Request body is too large.");
  return JSON.parse(raw);
}
function cookie(request) { return request.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith("qp_session="))?.slice(11) || ""; }
function cookieHeader(value, maxAge) { return `qp_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
function originOK(request) { const origin = request.headers.get("origin"); return !origin || origin === new URL(request.url).origin; }
async function session(request, env) {
  const token = cookie(request); if (!token) return null;
  const data = await rpc(env, "auth_me", { p_token_hash: await hash(token), p_now: now() });
  return data?.user ? { ...data.user, workspace_name: data.user.workspaceName, token_hash: await hash(token) } : null;
}
function normalizeQuote(input) {
  const q = { businessName: String(input?.businessName || "").trim(), businessEmail: String(input?.businessEmail || "").trim(), clientName: String(input?.clientName || "").trim(), clientEmail: String(input?.clientEmail || "").trim(), currency: input?.currency, taxPercent: Number(input?.taxPercent), paymentTerms: String(input?.paymentTerms || "").trim(), validUntil: String(input?.validUntil || ""), items: input?.items };
  const errors = validateQuote(q);
  if (q.businessName.length > 100 || q.clientName.length > 100 || q.businessEmail.length > 254 || q.clientEmail.length > 254 || q.paymentTerms.length > 300 || q.validUntil.length > 10 || q.items?.length > 50) errors.push("One or more fields exceed the allowed length.");
  if (q.businessEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.businessEmail)) errors.push("Enter a valid business email.");
  return { q, errors };
}
async function saveQuote(request, env, user, id = null) {
  const { q, errors } = normalizeQuote(await body(request));
  if (errors.length) return json({ ok: false, errors }, 400);
  const totals = calculateQuote(q.items, q.taxPercent);
  const data = await rpc(env, "save_quote", { p_token_hash: user.token_hash, p_id: id, p_quote: q, p_totals: totals, p_now: now() });
  return json(data, id ? 200 : 201);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url); const path = url.pathname;
    if (!["GET","HEAD","POST","PUT","DELETE"].includes(request.method)) return text("Method not allowed","text/plain; charset=utf-8",405);
    if (path === "/" && !["GET","HEAD"].includes(request.method)) return text("Method not allowed","text/plain; charset=utf-8",405);
    if (request.method === "GET" && path === "/") return text(renderPage(), "text/html; charset=utf-8");
    if (request.method === "GET" && path === "/assets/styles.css") return text(styles, "text/css; charset=utf-8");
    if (request.method === "GET" && path === "/assets/app.js") return text(clientApp, "text/javascript; charset=utf-8");
    if (request.method === "GET" && path === "/api/health") {
      if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return json({ ok: false, app: "QuotePilot", environment: "test", database: false }, 503);
      try { await rpc(env, "auth_logout", { p_token_hash: "health-check" }); return json({ ok: true, app: "QuotePilot", environment: "test", database: "supabase" }); }
      catch { return json({ ok: false, app: "QuotePilot", environment: "test", database: false }, 503); }
    }
    if (path.startsWith("/api/") && (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY)) return json({ ok: false, error: "Supabase is not configured." }, 503);
    if (path.startsWith("/api/") && ["POST","PUT","PATCH","DELETE"].includes(request.method) && !originOK(request)) return json({ ok: false, error: "Invalid request origin." }, 403);
    try {
      if (path === "/api/auth/signup" && request.method === "POST") {
        const data = await body(request); const email = String(data.email || "").trim().toLowerCase(); const password = String(data.password || "");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ ok:false,error:"Enter a valid email address." },400);
        if (password.length < 12 || password.length > 200) return json({ ok:false,error:"Use a password between 12 and 200 characters." },400);
        const timestamp=now(), token=crypto.randomUUID()+crypto.randomUUID();
        const result=await rpc(env,"auth_signup",{p_email:email,p_password:password,p_token_hash:await hash(token),p_now:timestamp});
        return json(result,201,{"Set-Cookie":cookieHeader(token,60*60*24*14)});
      }
      if (path === "/api/auth/login" && request.method === "POST") {
        const data=await body(request),email=String(data.email||"").trim().toLowerCase(),password=String(data.password||"");
        const token=crypto.randomUUID()+crypto.randomUUID(),timestamp=now();
        const result=await rpc(env,"auth_login",{p_email:email,p_password:password,p_token_hash:await hash(token),p_now:timestamp});
        return json(result,200,{"Set-Cookie":cookieHeader(token,60*60*24*14)});
      }
      if (path === "/api/auth/logout" && request.method === "POST") { const token=cookie(request); if(token) await rpc(env,"auth_logout",{p_token_hash:await hash(token)}); return json({ok:true},200,{"Set-Cookie":cookieHeader("",0)}); }
      const user = await session(request,env);
      if (path === "/api/auth/me" && request.method === "GET") return user ? json({ok:true,user:{email:user.email,workspaceName:user.workspace_name}}) : json({ok:false},401);
      if (!user) return json({ok:false,error:"Please sign in to continue."},401);
      if (path === "/api/quotes/generate" && request.method === "POST") {
        if (!env.AI) return json({ ok: false, error: "AI draft generation is not configured." }, 503);
        const data = await body(request);
        const prompt = String(data.prompt || "").trim();
        if (prompt.length < 10 || prompt.length > 2000) return json({ ok: false, error: "Describe the work in 10 to 2,000 characters." }, 400);
        let generated;
        try {
          generated = await env.AI.run("@cf/meta/llama-3.2-3b-instruct", {
            messages: [
              { role: "system", content: "Create a concise service quote draft from the user's description. Return only a JSON object with an items array; each item has name, description, quantity, and rate. Do not invent prices: use rate 0 unless the user explicitly gives a price. If quantity is not specified, use 1. Keep descriptions factual, concise, and based only on the request. Do not include customer names, business details, tax, currency, or payment terms." },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            max_tokens: 500,
            temperature: 0.2
          });
        } catch {
          return json({ ok: false, error: "AI draft generation is temporarily unavailable. Please try again." }, 503);
        }
        let draft = generated?.response ?? generated?.choices?.[0]?.message?.content;
        try { if (typeof draft === "string") draft = JSON.parse(draft); } catch { return json({ ok: false, error: "AI returned an invalid draft. Please try again." }, 502); }
        if (!Array.isArray(draft?.items) || draft.items.length < 1 || draft.items.length > 20) return json({ ok: false, error: "AI returned an invalid draft. Please try again." }, 502);
        const items = draft.items.map(item => ({
          name: String(item?.name || "").trim().slice(0, 120),
          description: String(item?.description || "").trim().slice(0, 300),
          quantity: Number(item?.quantity),
          rate: Number(item?.rate)
        }));
        if (items.some(item => !item.name || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 100000 || !Number.isFinite(item.rate) || item.rate < 0 || item.rate > 1000000000)) return json({ ok: false, error: "AI returned an invalid draft. Please try again." }, 502);
        return json({ ok: true, items });
      }
      if (path === "/api/quotes" && request.method === "GET") return json(await rpc(env,"list_quotes",{p_token_hash:user.token_hash,p_now:now()}));
      if (path === "/api/quotes" && request.method === "POST") return await saveQuote(request,env,user);
      const match=path.match(/^\/api\/quotes\/([0-9a-f-]{36})$/i);
      if (match && request.method === "GET") { const result=await rpc(env,"get_quote",{p_token_hash:user.token_hash,p_id:match[1],p_now:now()}); return json(result,result.ok?200:404); }
      if (match && request.method === "PUT") return await saveQuote(request,env,user,match[1]);
      if (match && request.method === "DELETE") { const result=await rpc(env,"delete_quote",{p_token_hash:user.token_hash,p_id:match[1],p_now:now()}); return json(result,result.ok?200:404); }
      if (path === "/api/quotes/validate" && request.method === "POST") { const input=await body(request); const errors=validateQuote(input); if(errors.length)return json({ok:false,errors},400); const totals=calculateQuote(input.items,input.taxPercent); return json({ok:true,...totals,totalFormatted:formatMoney(totals.total,input.currency)}); }
      return text("Not found","text/plain; charset=utf-8",404);
    } catch(error) {
      const status=error instanceof SyntaxError?400:error instanceof RangeError?413:error.code==="23505"?409:error.code==="28000"?401:error.code==="22023"?400:500;
      return json({ok:false,error:status===500?"Something went wrong. Please try again.":error.message},status);
    }
  },
};
