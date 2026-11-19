const SUPPORTED_CURRENCIES = new Set(["USD", "GBP", "CAD", "AUD"]);
function formatMoney(amount, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(amount) || 0);
}
function calculateQuote(lines, taxPercent = 0) {
  const normalized = lines.map((line, index) => {
    const quantity = Number(line.quantity), rate = Number(line.rate);
    if (!String(line.name || "").trim()) throw new Error("Line " + (index + 1) + " needs a description.");
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Line " + (index + 1) + " quantity must be greater than zero.");
    if (!Number.isFinite(rate) || rate < 0) throw new Error("Line " + (index + 1) + " rate cannot be negative.");
    const amount = Math.round((quantity * rate + Number.EPSILON) * 100) / 100;
    return { ...line, name: String(line.name).trim(), quantity, rate, amount };
  });
  if (!normalized.length) throw new Error("Add at least one line item.");
  const subtotal = Math.round((normalized.reduce((sum, item) => sum + item.amount, 0) + Number.EPSILON) * 100) / 100;
  const tax = Math.round((subtotal * Number(taxPercent) / 100 + Number.EPSILON) * 100) / 100;
  return { items: normalized, subtotal, tax, total: Math.round((subtotal + tax + Number.EPSILON) * 100) / 100 };
}
function validateQuote(input) {
  if (!input.business.trim()) return "Business name is required.";
  if (!input.client.trim()) return "Client name is required.";
  if (input.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.clientEmail)) return "Enter a valid client email.";
  if (!SUPPORTED_CURRENCIES.has(input.currency)) return "Choose a supported currency.";
  if (!Number.isFinite(input.taxPercent) || input.taxPercent < 0 || input.taxPercent > 100) return "Tax must be between 0 and 100 percent.";
  try { calculateQuote(input.items, input.taxPercent); } catch (error) { return error.message; }
  return "";
}
const STORAGE_KEY = "quotepilot.test.quotes.v1";
const $ = (id) => document.getElementById(id);
const formIds = ["business", "email", "valid", "client", "clientEmail", "currency", "taxPercent", "terms"];
let items = [{ name: "Interior painting", description: "Living room and hallway · two coats · materials included", quantity: 1, rate: 1850 }];
let currentId = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function readDraft() {
  return Object.fromEntries(formIds.map((key) => [key, $(key).value]));
}
function toQuote() {
  const v = readDraft();
  return {
    ...v, businessName: v.business, clientName: v.client,
    taxPercent: Number(v.taxPercent), currency: v.currency,
    items: items.map((item) => ({ ...item, quantity: Number(item.quantity), rate: Number(item.rate) })),
  };
}
function showStatus(message, error = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
}
function renderItems() {
  $("items").innerHTML = items.map((item, index) => `
    <div class="item-editor" data-item="${index}">
      <div class="item-tools"><span>Item ${index + 1}</span>${items.length > 1 ? `<button class="btn danger" type="button" data-remove="${index}" aria-label="Remove item ${index + 1}">Remove</button>` : ""}</div>
      <div class="item-fields">
        <input data-key="name" aria-label="Item ${index + 1} name" placeholder="Service or product" maxlength="120" value="${escapeHtml(item.name)}">
        <input data-key="quantity" aria-label="Item ${index + 1} quantity" type="number" min="0.01" step="0.01" inputmode="decimal" value="${escapeHtml(item.quantity)}">
        <input data-key="rate" aria-label="Item ${index + 1} rate" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(item.rate)}">
      </div>
      <div class="item-desc"><input data-key="description" aria-label="Item ${index + 1} details (optional)" placeholder="Short details (optional)" maxlength="300" value="${escapeHtml(item.description)}"></div>
    </div>`).join("");
  $("items").querySelectorAll("[data-key]").forEach((input) => input.addEventListener("input", () => {
    const row = Number(input.closest("[data-item]").dataset.item);
    items[row][input.dataset.key] = input.value;
    renderPreview();
  }));
  $("items").querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => {
    items.splice(Number(button.dataset.remove), 1);
    renderItems(); renderPreview();
  }));
}
function renderPreview() {
  const quote = toQuote();
  let totals;
  try { totals = calculateQuote(quote.items.length ? quote.items : [{ name: "-", quantity: 0.01, rate: 0 }], quote.taxPercent || 0); } catch { totals = { items: [], subtotal: 0, tax: 0, total: 0 }; }
  const issued = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const valid = quote.valid ? new Date(quote.valid + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
  const currency = SUPPORTED_CURRENCIES.has(quote.currency) ? quote.currency : "USD";
  $("preview").innerHTML = `
    <div class="previewtop"><div><div class="quote-brand">${escapeHtml(quote.business || "Your business")}</div><div class="quote-no">ESTIMATE · ${currentId ? currentId.slice(-6).toUpperCase() : "DRAFT"}</div></div><div style="text-align:right">ISSUED<br><b style="color:#56627a">${issued}</b></div></div>
    <h2 class="qt">Estimate</h2><div class="muted" style="font-size:12px">Valid until ${valid}</div>
    <div class="billgrid"><div><strong>PREPARED FOR</strong><span>${escapeHtml(quote.client || "Client name")}</span><div class="muted" style="font-size:11px">${escapeHtml(quote.clientEmail)}</div></div><div><strong>FROM</strong><span>${escapeHtml(quote.business || "Your business")}</span><div class="muted" style="font-size:11px">${escapeHtml(quote.email)}</div></div></div>
    <div class="itemhead"><div>DESCRIPTION</div><div>QTY</div><div>AMOUNT</div></div>
    ${items.map((item) => `<div class="item"><div><div class="itemname">${escapeHtml(item.name || "Service")}</div><div class="itemdesc">${escapeHtml(item.description)}</div></div><div>${escapeHtml(item.quantity || "0")}</div><div>${formatMoney((Number(item.quantity) || 0) * (Number(item.rate) || 0), currency)}</div></div>`).join("")}
    <div class="totalrow"><span>Subtotal</span><span>${formatMoney(totals.subtotal, currency)}</span></div>
    <div class="totalrow"><span>Tax (${Number(quote.taxPercent) || 0}%)</span><span>${formatMoney(totals.tax, currency)}</span></div>
    <div class="totalrow grand"><span>Total</span><span>${formatMoney(totals.total, currency)}</span></div>
    <div class="terms"><strong>Payment terms</strong>${escapeHtml(quote.terms || "Add payment terms")}</div>`;
}
function loadDrafts() {
  try {
    const drafts = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(drafts) ? drafts.filter((x) => x && typeof x === "object" && Array.isArray(x.items)) : [];
  } catch { return []; }
}
function saveDrafts(drafts) { localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.slice(0, 50))); }
function renderSaved() {
  const drafts = loadDrafts();
  $("savedCount").textContent = `${drafts.length} saved`;
  $("savedList").innerHTML = drafts.length ? drafts.map((draft) => `
    <div class="saved-row"><div><strong>${escapeHtml(draft.client || "Untitled client")} · ${escapeHtml(draft.items[0]?.name || "Quote")}</strong><small>${new Date(draft.savedAt).toLocaleString()} · ${formatMoney(draft.total || 0, draft.currency || "USD")}</small></div>
    <div class="row-actions"><button type="button" data-open="${escapeHtml(draft.id)}">Open</button><button type="button" data-delete="${escapeHtml(draft.id)}" aria-label="Delete saved quote">Delete</button></div></div>`).join("") : '<div class="empty">Your saved drafts will appear here.</div>';
  $("savedList").querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", () => openDraft(button.dataset.open)));
  $("savedList").querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => deleteDraft(button.dataset.delete)));
}
function openDraft(id) {
  const draft = loadDrafts().find((x) => x.id === id);
  if (!draft) return;
  currentId = draft.id;
  formIds.forEach((key) => { $(key).value = draft[key] ?? ""; });
  items = draft.items.map((item) => ({ ...item }));
  renderItems(); renderPreview(); showStatus("Draft opened.");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function deleteDraft(id) {
  saveDrafts(loadDrafts().filter((draft) => draft.id !== id));
  renderSaved(); showStatus("Draft deleted from this browser.");
}
function saveDraft() {
  const quote = toQuote();
  const error = validateQuote(quote);
  if (error) { showStatus(error, true); return; }
  const totals = calculateQuote(quote.items, quote.taxPercent);
  const saved = { ...quote, items: totals.items, subtotal: totals.subtotal, tax: totals.tax, total: totals.total, id: currentId || crypto.randomUUID(), savedAt: new Date().toISOString() };
  const drafts = loadDrafts();
  const index = drafts.findIndex((draft) => draft.id === saved.id);
  if (index >= 0) drafts[index] = saved; else drafts.unshift(saved);
  try { saveDrafts(drafts); currentId = saved.id; renderPreview(); renderSaved(); showStatus("Draft saved in this browser."); }
  catch { showStatus("Could not save. Browser storage may be full or disabled.", true); }
}
function newQuote() {
  currentId = null; items = [{ name: "", description: "", quantity: 1, rate: 0 }];
  formIds.forEach((key) => { if (key !== "currency" && key !== "taxPercent" && key !== "terms") $(key).value = ""; });
  $("currency").value = "USD"; $("taxPercent").value = "0"; $("terms").value = "";
  renderItems(); renderPreview(); showStatus("");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function initialize() {
  const expiry = new Date(); expiry.setDate(expiry.getDate() + 14); $("valid").value = expiry.toISOString().slice(0, 10);
  renderItems(); renderPreview(); renderSaved();
  formIds.forEach((key) => $(key).addEventListener("input", renderPreview));
  $("addItemBtn").addEventListener("click", () => { items.push({ name: "", description: "", quantity: 1, rate: 0 }); renderItems(); renderPreview(); });
  $("saveBtn").addEventListener("click", saveDraft);
  $("printBtn").addEventListener("click", () => window.print());
  $("newBtn").addEventListener("click", newQuote);
}
initialize();
