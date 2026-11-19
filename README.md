# QuotePilot TEST

Early interactive QuotePilot prototype, served from Cloudflare Workers.

## Test URL
https://quotepilot-test.workers.dev

## Current scope
- Live quote / estimate preview
- USD, GBP, CAD and AUD currency formatting
- Save and reopen up to 20 draft quotes in browser local storage
- Copy a plain-text quote summary

## Prototype limits
No account system, shared database, AI generation, PDF export, email delivery, payment processing, tax calculation, or production data. Saved drafts stay in the current browser only.

## Deploy
`npx wrangler deploy`
