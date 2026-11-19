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
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 120000 }, key, 256));
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
  return env.DB.prepare(`SELECT u.id, u.email, w.id AS workspace_id, w.name AS workspace_name FROM sessions s JOIN users u ON u.id=s.user_id JOIN workspace_members m ON m.user_id=u.id JOIN workspaces w ON w.id=m.workspace_id WHERE s.token_hash=? AND s.expires_at>? ORDER BY m.created_at LIMIT 1`).bind(await hash(token), now()).first();
}
function quoteRow(row, items) { return { id: row.id, quoteNumber: row.quote_number, businessName: row.business_name, businessEmail: row.business_email, clientName: row.client_name, clientEmail: row.client_email, currency: row.currency, taxPercent: row.tax_percent, paymentTerms: row.payment_terms, validUntil: row.valid_until, status: row.status, subtotal: row.subtotal, tax: row.tax, total: row.total, createdAt: row.created_at, updatedAt: row.updated_at, items }; }
async function getQuote(db, id, workspaceId) {
  const row = await db.prepare("SELECT * FROM quotes WHERE id=? AND workspace_id=?").bind(id, workspaceId).first();
  if (!row) return null;
  const { results } = await db.prepare("SELECT name,description,quantity,rate,amount FROM quote_items WHERE quote_id=? ORDER BY position").bind(id).all();
  return quoteRow(row, results);
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
  const totals = calculateQuote(q.items, q.taxPercent); const timestamp = now(); const quoteId = id || uid();
  if (id && !(await env.DB.prepare("SELECT id FROM quotes WHERE id=? AND workspace_id=?").bind(id, user.workspace_id).first())) return json({ ok: false, error: "Quote not found." }, 404);
  const existing = id ? await env.DB.prepare("SELECT quote_number,created_at FROM quotes WHERE id=? AND workspace_id=?").bind(id,user.workspace_id).first() : null;
  const count = id ? null : await env.DB.prepare("SELECT COUNT(*) AS count FROM quotes WHERE workspace_id=?").bind(user.workspace_id).first();
  const quoteNumber = existing?.quote_number || `QP-${String((count?.count || 0) + 1).padStart(5,"0")}`;
  const statements = [env.DB.prepare(`INSERT INTO quotes(id,workspace_id,quote_number,business_name,business_email,client_name,client_email,currency,tax_percent,payment_terms,valid_until,status,subtotal,tax,total,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'draft',?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET business_name=excluded.business_name,business_email=excluded.business_email,client_name=excluded.client_name,client_email=excluded.client_email,currency=excluded.currency,tax_percent=excluded.tax_percent,payment_terms=excluded.payment_terms,valid_until=excluded.valid_until,subtotal=excluded.subtotal,tax=excluded.tax,total=excluded.total,updated_at=excluded.updated_at`).bind(quoteId,user.workspace_id,quoteNumber,q.businessName,q.businessEmail,q.clientName,q.clientEmail,q.currency,q.taxPercent,q.paymentTerms,q.validUntil,totals.subtotal,totals.tax,totals.total,existing?.created_at || timestamp,timestamp), env.DB.prepare("DELETE FROM quote_items WHERE quote_id=?").bind(quoteId)];
  for (const [position,item] of totals.items.entries()) statements.push(env.DB.prepare("INSERT INTO quote_items(id,quote_id,position,name,description,quantity,rate,amount) VALUES(?,?,?,?,?,?,?,?)").bind(uid(),quoteId,position,item.name,item.description,item.quantity,item.rate,item.amount));
  await env.DB.batch(statements);
  return json({ ok: true, quote: await getQuote(env.DB, quoteId, user.workspace_id) }, id ? 200 : 201);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url); const path = url.pathname;
    if (!["GET","HEAD","POST","PUT","DELETE"].includes(request.method)) return text("Method not allowed","text/plain; charset=utf-8",405);
    if (path === "/" && !["GET","HEAD"].includes(request.method)) return text("Method not allowed","text/plain; charset=utf-8",405);
    if (request.method === "GET" && path === "/") return text(renderPage(), "text/html; charset=utf-8");
    if (request.method === "GET" && path === "/assets/styles.css") return text(styles, "text/css; charset=utf-8");
    if (request.method === "GET" && path === "/assets/app.js") return text(clientApp, "text/javascript; charset=utf-8");
    if (request.method === "GET" && path === "/api/health") return json({ ok: true, app: "QuotePilot", environment: "test", database: Boolean(env.DB) });
    if (path.startsWith("/api/") && !env.DB) return json({ ok: false, error: "Database is not configured." }, 503);
    if (path.startsWith("/api/") && ["POST","PUT","PATCH","DELETE"].includes(request.method) && !originOK(request)) return json({ ok: false, error: "Invalid request origin." }, 403);
    try {
      if (path === "/api/auth/signup" && request.method === "POST") {
        const data = await body(request); const email = String(data.email || "").trim().toLowerCase(); const password = String(data.password || "");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ ok:false,error:"Enter a valid email address." },400);
        if (password.length < 12 || password.length > 200) return json({ ok:false,error:"Use a password between 12 and 200 characters." },400);
        if (await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first()) return json({ ok:false,error:"An account with this email already exists. Sign in instead." },409);
        const userId=uid(), workspaceId=uid(), salt=crypto.randomUUID(), timestamp=now(), token=crypto.randomUUID()+crypto.randomUUID();
        const pwh=await passwordHash(password,salt);
        await env.DB.batch([env.DB.prepare("INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)").bind(userId,email,`${salt}:${pwh}`,timestamp),env.DB.prepare("INSERT INTO workspaces(id,name,owner_user_id,created_at) VALUES(?,?,?,?)").bind(workspaceId,"My workspace",userId,timestamp),env.DB.prepare("INSERT INTO workspace_members(workspace_id,user_id,role,created_at) VALUES(?,?,'owner',?)").bind(workspaceId,userId,timestamp),env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(await hash(token),userId,timestamp+60*60*24*14,timestamp)]);
        return json({ok:true,user:{email,workspaceName:"My workspace"}},201,{"Set-Cookie":cookieHeader(token,60*60*24*14)});
      }
      if (path === "/api/auth/login" && request.method === "POST") {
        const data=await body(request),email=String(data.email||"").trim().toLowerCase(),password=String(data.password||"");
        const user=await env.DB.prepare("SELECT id,email,password_hash FROM users WHERE email=?").bind(email).first();
        if (!user) return json({ok:false,error:"Email or password is incorrect."},401);
        const [salt,stored]=user.password_hash.split(":"); if (!salt || await passwordHash(password,salt)!==stored) return json({ok:false,error:"Email or password is incorrect."},401);
        const token=crypto.randomUUID()+crypto.randomUUID(),timestamp=now(); await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(await hash(token),user.id,timestamp+60*60*24*14,timestamp).run();
        const membership=await env.DB.prepare("SELECT w.name FROM workspace_members m JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=? ORDER BY m.created_at LIMIT 1").bind(user.id).first();
        return json({ok:true,user:{email:user.email,workspaceName:membership?.name||"My workspace"}},200,{"Set-Cookie":cookieHeader(token,60*60*24*14)});
      }
      if (path === "/api/auth/logout" && request.method === "POST") { const token=cookie(request); if(token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hash(token)).run(); return json({ok:true},200,{"Set-Cookie":cookieHeader("",0)}); }
      const user = await session(request,env);
      if (path === "/api/auth/me" && request.method === "GET") return user ? json({ok:true,user:{email:user.email,workspaceName:user.workspace_name}}) : json({ok:false},401);
      if (!user) return json({ok:false,error:"Please sign in to continue."},401);
      if (path === "/api/quotes" && request.method === "GET") {
        const {results}=await env.DB.prepare("SELECT * FROM quotes WHERE workspace_id=? ORDER BY updated_at DESC LIMIT 100").bind(user.workspace_id).all();
        const quotes=[]; for(const row of results) quotes.push(await getQuote(env.DB,row.id,user.workspace_id)); return json({ok:true,quotes});
      }
      if (path === "/api/quotes" && request.method === "POST") return await saveQuote(request,env,user);
      const match=path.match(/^\/api\/quotes\/([0-9a-f-]{36})$/i);
      if (match && request.method === "GET") { const quote=await getQuote(env.DB,match[1],user.workspace_id); return quote?json({ok:true,quote}):json({ok:false,error:"Quote not found."},404); }
      if (match && request.method === "PUT") return await saveQuote(request,env,user,match[1]);
      if (match && request.method === "DELETE") { const result=await env.DB.prepare("DELETE FROM quotes WHERE id=? AND workspace_id=?").bind(match[1],user.workspace_id).run(); return result.meta.changes?json({ok:true}):json({ok:false,error:"Quote not found."},404); }
      if (path === "/api/quotes/validate" && request.method === "POST") { const input=await body(request); const errors=validateQuote(input); if(errors.length)return json({ok:false,errors},400); const totals=calculateQuote(input.items,input.taxPercent); return json({ok:true,...totals,totalFormatted:formatMoney(totals.total,input.currency)}); }
      return text("Not found","text/plain; charset=utf-8",404);
    } catch(error) {
      const status=error instanceof SyntaxError?400:error instanceof RangeError?413:500;
      return json({ok:false,error:status===500?"Something went wrong. Please try again.":error.message},status);
    }
  },
};
