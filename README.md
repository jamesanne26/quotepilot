# QuotePilot

A lightweight QuotePilot quote builder prototype deployed to Cloudflare Workers.

## Test workspace
https://quotepilot-test.jamesrae-rosario18.workers.dev

## Current features
- Live quote preview with multiple line items
- USD, GBP, CAD, and AUD
- Tax calculation and input validation
- Save, reopen, and delete drafts
- Print or save the preview as PDF
- Responsive layout and basic security headers

Drafts are stored in local browser storage. Use sample data only: this test version has no login, shared database, AI generation, email delivery, or payment processing.

## Project structure
- `src/worker.js` — HTTP routes and response security headers
- `src/domain/` — quote calculations, validation, and currency formatting
- `src/ui/` — page shell, styles, and browser application
- `scripts/build.mjs` — packages the browser client for Worker delivery
- `test/` — domain and Worker route tests
- `.github/workflows/quality.yml` — automated build, syntax, and test checks

## Local quality checks
Requires Node.js 20 or later.

```sh
npm run build
npm run check
npm test
```

## Cloudflare deploy
The test Worker is named `quotepilot-test`. Deploy it with Wrangler after configuring Cloudflare credentials for the repository environment.
