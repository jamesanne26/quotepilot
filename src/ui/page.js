import { styles } from "./styles.js";
import { clientApp } from "../generated/client.js";

export { styles, clientApp };

export function renderPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#f7f8fc"><meta name="description" content="Create clear, professional service estimates with QuotePilot.">
<title>QuotePilot — Test workspace</title><link rel="stylesheet" href="/assets/styles.css">
</head>
<body>
<div id="authView" class="auth-wrap" hidden></div>
<div id="workspaceView" hidden>
<header class="top"><div class="brand"><div class="logo">Q</div>QuotePilot <span class="tag">TEST</span></div><div class="topright"><a class="btn" href="https://support-test.getqueuedrop.com/?product=QuotePilot" target="_blank" rel="noopener noreferrer">Support</a><span id="userEmail" class="user"></span><button class="btn" id="logoutBtn" type="button">Sign out</button></div></header>
<div class="layout"><aside><div class="navlabel">WORKSPACE</div><div class="nav active">▦ &nbsp; Quotes</div><div class="aside-note"><strong>Private test workspace</strong>Quotes are saved to your account. Use sample data only in this test environment.</div><div class="aside-note"><strong>Shared support portal</strong>Open the QueueDrop support portal to contact support.</div></aside>
<main><div class="crumb">Workspace / Quotes</div><div class="title-row"><div><h1>Create a quote</h1><div class="subtitle">Build a clear estimate your client can review.</div></div><button class="btn" id="newBtn" type="button">＋ New quote</button></div>
<div class="banner"><b>TEST ENVIRONMENT</b> &nbsp;Your quotes are saved to your private test account. AI generation, email sending, and payments are not connected.</div>
<div class="grid">
<section class="card form-card"><div class="cardhead"><h2>Quote details</h2><span class="tag" id="quoteBadge">New draft</span></div><div class="cardbody">
<div class="section">Your business</div><div class="fields">
<div class="field full"><label for="business">Business name</label><input id="business" autocomplete="organization" maxlength="100"></div>
<div class="field"><label for="businessEmail">Your email</label><input id="businessEmail" type="email" autocomplete="email" maxlength="254"></div>
<div class="field"><label for="valid">Valid until</label><input id="valid" type="date"></div></div>
<hr class="sep"><div class="section">Client</div><div class="fields">
<div class="field"><label for="client">Client name</label><input id="client" autocomplete="name" maxlength="100"></div>
<div class="field"><label for="clientEmail">Client email (optional)</label><input id="clientEmail" type="email" autocomplete="off" maxlength="254"></div></div>
<hr class="sep"><div class="section">Line items</div><div id="items"></div><button class="btn" id="addItemBtn" type="button">＋ Add line item</button>
<div class="fields" style="margin-top:14px"><div class="field"><label for="currency">Currency</label><select id="currency"><option value="USD">USD · US Dollar</option><option value="GBP">GBP · British Pound</option><option value="CAD">CAD · Canadian Dollar</option><option value="AUD">AUD · Australian Dollar</option></select></div><div class="field"><label for="taxPercent">Tax (%)</label><input id="taxPercent" type="number" min="0" max="100" step="0.01" value="0" inputmode="decimal"></div>
<div class="field full"><label for="terms">Payment terms</label><input id="terms" maxlength="300"></div></div>
<div class="actions"><button class="btn primary" id="saveBtn" type="button">Save quote</button><button class="btn" id="printBtn" type="button">Print / Save as PDF</button></div><div class="status" id="status" aria-live="polite"></div>
</div></section>
<section class="card preview-card"><div class="cardhead"><h2>Client preview</h2><span class="muted" style="font-size:12px">Live preview</span></div><div class="preview" id="preview"></div></section>
</div>
<section class="card saved"><div class="cardhead"><h2>Your quotes</h2><span class="muted" id="savedCount" style="font-size:12px"></span></div><div class="cardbody" id="savedList"></div></section>
</main></div></div>
<script src="/assets/app.js" defer></script></body></html>`;
}
