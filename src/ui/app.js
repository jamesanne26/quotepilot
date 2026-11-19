const $ = (id) => document.getElementById(id);
const CURRENCIES = new Set(["USD", "GBP", "CAD", "AUD"]);
const formIds = ["business", "businessEmail", "valid", "client", "clientEmail", "currency", "taxPercent", "terms"];
let items = [{ name: "", description: "", quantity: 1, rate: 0 }];
let currentId = null;
let currentUser = null;
let quotes = [];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = (amount, currency) => new Intl.NumberFormat(undefined, { style:"currency", currency:CURRENCIES.has(currency)?currency:"USD" }).format(Number(amount)||0);
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, credentials:"same-origin", headers:{ ...(options.body?{"Content-Type":"application/json"}:{}), ...(options.headers||{}) } });
  const data = await response.json().catch(()=>({error:"Unexpected server response."}));
  if (!response.ok) throw new Error(data.error || data.errors?.[0] || "Request failed.");
  return data;
}
function authView(mode="login", error="") {
  $("workspaceView").hidden = true; $("authView").hidden = false;
  $("authView").innerHTML = `<div class="auth-card"><div class="brand"><div class="logo">Q</div>QuotePilot <span class="tag">TEST</span></div><h1>${mode==="signup"?"Create your account":"Welcome back"}</h1><p class="subtitle">${mode==="signup"?"Start your private QuotePilot test workspace.":"Sign in to open your saved quotes."}</p><form id="authForm"><label>Email</label><input id="authEmail" type="email" autocomplete="email" maxlength="254" required><label>Password</label><input id="authPassword" type="password" autocomplete="${mode==="signup"?"new-password":"current-password"}" minlength="${mode==="signup"?12:1}" maxlength="200" required>${mode==="signup"?'<small>Use at least 12 characters.</small>':''}<button class="btn primary auth-submit" type="submit">${mode==="signup"?"Create account":"Sign in"}</button><div class="status ${error?"error":""}" id="authError" aria-live="polite">${esc(error)}</div></form><p class="auth-switch">${mode==="signup"?'Already have an account? <button type="button" id="switchAuth">Sign in</button>':'New to QuotePilot? <button type="button" id="switchAuth">Create account</button>'}</p><div class="auth-foot">Test environment · Do not use sensitive client data</div></div>`;
  $("switchAuth").onclick = () => authView(mode==="signup"?"login":"signup");
  $("authForm").onsubmit = async event => {
    event.preventDefault(); const button=$("authForm").querySelector("button[type=submit]"); button.disabled=true;
    try { const result=await api(`/api/auth/${mode}`,{method:"POST",body:JSON.stringify({email:$("authEmail").value,password:$("authPassword").value})}); currentUser=result.user; await showWorkspace(); }
    catch(error){ $("authError").textContent=error.message; $("authError").classList.add("error"); button.disabled=false; }
  };
}
function readQuote() { return { businessName:$ ("business").value.trim(), businessEmail:$ ("businessEmail").value.trim(), validUntil:$ ("valid").value, clientName:$ ("client").value.trim(), clientEmail:$ ("clientEmail").value.trim(), currency:$ ("currency").value, taxPercent:Number($("taxPercent").value), paymentTerms:$ ("terms").value.trim(), items:items.map(x=>({name:x.name,description:x.description,quantity:Number(x.quantity),rate:Number(x.rate)})) }; }
function showStatus(message,error=false) { $("status").textContent=message; $("status").classList.toggle("error",error); }
function renderItems() {
  $("items").innerHTML=items.map((item,i)=>`<div class="item-editor" data-item="${i}"><div class="item-tools"><span>Item ${i+1}</span>${items.length>1?`<button class="btn danger" type="button" data-remove="${i}">Remove</button>`:""}</div><div class="item-fields"><input data-key="name" aria-label="Item ${i+1} name" placeholder="Service or product" maxlength="120" value="${esc(item.name)}"><input data-key="quantity" aria-label="Item ${i+1} quantity" type="number" min="0.01" step="0.01" value="${esc(item.quantity)}"><input data-key="rate" aria-label="Item ${i+1} rate" type="number" min="0" step="0.01" value="${esc(item.rate)}"></div><div class="item-desc"><input data-key="description" aria-label="Item ${i+1} details" placeholder="Short details (optional)" maxlength="300" value="${esc(item.description)}"></div></div>`).join("");
  $("items").querySelectorAll("[data-key]").forEach(input=>input.addEventListener("input",()=>{items[Number(input.closest("[data-item]").dataset.item)][input.dataset.key]=input.value;renderPreview();}));
  $("items").querySelectorAll("[data-remove]").forEach(button=>button.onclick=()=>{items.splice(Number(button.dataset.remove),1);renderItems();renderPreview();});
}
function renderPreview() {
  const q=readQuote(), currency=CURRENCIES.has(q.currency)?q.currency:"USD";
  const subtotal=items.reduce((s,x)=>s+(Number(x.quantity)||0)*(Number(x.rate)||0),0), tax=subtotal*(Number(q.taxPercent)||0)/100;
  const valid=q.validUntil?new Date(q.validUntil+"T00:00:00").toLocaleDateString():"—";
  $("preview").innerHTML=`<div class="previewtop"><div><div class="quote-brand">${esc(q.businessName||"Your business")}</div><div class="quote-no">ESTIMATE · ${esc(currentId?quotes.find(x=>x.id===currentId)?.quoteNumber||"SAVED":"DRAFT")}</div></div><div style="text-align:right">VALID UNTIL<br><b>${valid}</b></div></div><h2 class="qt">Estimate</h2><div class="billgrid"><div><strong>PREPARED FOR</strong><span>${esc(q.clientName||"Client name")}</span><div class="muted">${esc(q.clientEmail)}</div></div><div><strong>FROM</strong><span>${esc(q.businessName||"Your business")}</span><div class="muted">${esc(q.businessEmail)}</div></div></div><div class="itemhead"><div>DESCRIPTION</div><div>QTY</div><div>AMOUNT</div></div>${items.map(x=>`<div class="item"><div><div class="itemname">${esc(x.name||"Service")}</div><div class="itemdesc">${esc(x.description)}</div></div><div>${esc(x.quantity||0)}</div><div>${money((Number(x.quantity)||0)*(Number(x.rate)||0),currency)}</div></div>`).join("")}<div class="totalrow"><span>Subtotal</span><span>${money(subtotal,currency)}</span></div><div class="totalrow"><span>Tax (${Number(q.taxPercent)||0}%)</span><span>${money(tax,currency)}</span></div><div class="totalrow grand"><span>Total</span><span>${money(subtotal+tax,currency)}</span></div><div class="terms"><strong>Payment terms</strong>${esc(q.paymentTerms||"Add payment terms")}</div>`;
}
function renderSaved() {
  $("savedCount").textContent=`${quotes.length} saved`;
  $("savedList").innerHTML=quotes.length?quotes.map(q=>`<div class="saved-row"><div><strong>${esc(q.quoteNumber)} · ${esc(q.clientName)}</strong><small>${esc(new Date(q.updatedAt*1000).toLocaleString())} · ${money(q.total,q.currency)}</small></div><div class="row-actions"><button type="button" data-open="${esc(q.id)}">Open</button><button type="button" data-delete="${esc(q.id)}">Delete</button></div></div>`).join(""):'<div class="empty">Your saved quotes will appear here.</div>';
  $("savedList").querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openQuote(b.dataset.open));
  $("savedList").querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteQuote(b.dataset.delete));
}
async function refreshQuotes() { const result=await api("/api/quotes"); quotes=result.quotes; renderSaved(); }
function openQuote(id) { const q=quotes.find(x=>x.id===id); if(!q)return; currentId=q.id; $("quoteBadge").textContent=q.quoteNumber; const values={business:q.businessName,businessEmail:q.businessEmail,valid:q.validUntil,client:q.clientName,clientEmail:q.clientEmail,currency:q.currency,taxPercent:q.taxPercent,terms:q.paymentTerms}; for(const [key,value] of Object.entries(values))$(key).value=value??""; items=q.items.map(x=>({...x})); renderItems();renderPreview();showStatus("Quote opened.");window.scrollTo({top:0,behavior:"smooth"}); }
async function deleteQuote(id) { if(!confirm("Delete this quote permanently?"))return; try{await api(`/api/quotes/${id}`,{method:"DELETE"});if(currentId===id)newQuote();await refreshQuotes();showStatus("Quote deleted.");}catch(e){showStatus(e.message,true);} }
async function saveQuote() { const button=$("saveBtn");button.disabled=true;try{const result=await api(currentId?`/api/quotes/${currentId}`:"/api/quotes",{method:currentId?"PUT":"POST",body:JSON.stringify(readQuote())});currentId=result.quote.id;await refreshQuotes();$("quoteBadge").textContent=result.quote.quoteNumber;renderPreview();showStatus("Quote saved to your account.");}catch(error){showStatus(error.message,true);}finally{button.disabled=false;} }
function newQuote() {currentId=null;items=[{name:"",description:"",quantity:1,rate:0}];for(const key of formIds)$(key).value=key==="currency"?"USD":key==="taxPercent"?"0":"";const d=new Date();d.setDate(d.getDate()+14);$("valid").value=d.toISOString().slice(0,10);$("quoteBadge").textContent="New draft";renderItems();renderPreview();showStatus("");}
async function showWorkspace() { $("authView").hidden=true;$("workspaceView").hidden=false;$("userEmail").textContent=`${currentUser.email} · ${currentUser.workspaceName}`;try{await refreshQuotes();newQuote();}catch(error){quotes=[];renderSaved();newQuote();showStatus(`Signed in, but the workspace did not finish loading: ${error.message}`,true);} }
async function initialize() {
  $("logoutBtn").onclick=async()=>{await api("/api/auth/logout",{method:"POST"});currentUser=null;authView("login");};
  $("addItemBtn").onclick=()=>{items.push({name:"",description:"",quantity:1,rate:0});renderItems();renderPreview();};
  $("saveBtn").onclick=saveQuote; $("newBtn").onclick=newQuote; $("printBtn").onclick=()=>window.print();
  formIds.forEach(id=>$(id).addEventListener("input",renderPreview));
  try { const data=await api("/api/auth/me");currentUser=data.user;await showWorkspace(); } catch { authView("login"); }
}
initialize();
