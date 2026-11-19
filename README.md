# QuotePilot

QuotePilot is a quote builder test environment deployed on Cloudflare Workers with Cloudflare D1 persistence.

## Test workspace

https://quotepilot-test.jamesrae-rosario18.workers.dev

## Features

- Live quote preview, line items, tax, and USD/GBP/CAD/AUD currencies
- Email and password registration and sign in
- Private workspace per account
- Server-side quote persistence, reopen, and delete
- Print or save as PDF
- Secure session cookies, salted PBKDF2 password hashes, input bounds, origin checks, and response security headers
- Link to the shared QueueDrop test support portal

This is a test environment. Use sample data only. AI generation, email delivery, client quote links, and payments are not connected. The shared Support link opens the QueueDrop test portal; QuotePilot account single sign-on has not yet been added.

## Database

The `quotepilot-test-db` D1 database is in APAC. The initial schema is in `migrations/0001_initial.sql`. Apply schema changes with `npx wrangler d1 migrations apply quotepilot-test-db --remote`.

## Project structure

- `src/worker.js` — HTTP routes, auth, quote persistence, and security headers
- `src/domain/` — quote calculations and currency formatting
- `src/ui/` — page shell, styles, and browser application
- `scripts/build.mjs` — packages the browser client for Worker delivery
- `migrations/` — D1 database schema
- `test/` — unit and Worker route tests
- `.github/workflows/quality.yml` — automated build, syntax, and test checks

## Quality checks

Requires Node.js 20 or later.

```sh
npm run build
npm run check
npm test
```

## Deployment

The test Worker is `quotepilot-test`. With Cloudflare credentials configured, deploy using `npx wrangler deploy`.
