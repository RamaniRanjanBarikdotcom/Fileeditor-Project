# AppToolkitLab Project Audit — 2026-09-10

## Executive assessment

The repository has a sound monorepo foundation and all packages currently
compile, but the product is **not production-ready as a complete SaaS and
software marketplace**. Document conversion, public pages, authentication,
basic catalog/checkout, storage and licensing foundations exist. Recurring
subscriptions, a usable license-delivery flow, the admin application, complete
quota/accounting enforcement and production security hardening are incomplete.

The highest-impact conversion defect was PDF-to-DOCX. The former fallback
extracted plain text and rebuilt paragraphs, so it necessarily discarded page
geometry, fonts, images and tables. The worker now invokes the isolated
`pdf2docx` CLI for layout-aware, editable conversion, validates the DOCX package
and only permits the text-focused fallback when the engine is configured as
`auto`.

## Remediation update — 2026-09-10

The following audit findings were repaired and reverified after this report was
first written:

- payment fulfillment now claims a pending order and creates entitlements and
  licenses inside one serializable transaction, backed by a unique
  order/product license constraint;
- full license keys are encrypted at rest and authenticated customers can copy
  the usable decrypted key from their software library;
- Razorpay verification is bound to the authenticated customer, internal order,
  provider and provider order ID, and malformed signatures fail safely;
- checkout completion and cancellation URLs are restricted to exact configured
  application origins;
- cart contents remain intact until confirmed fulfillment and item removal
  preserves the selected currency;
- CSRF checks no longer trust a caller-supplied application header, forwarded IP
  values are no longer read directly, and production Swagger is opt-in;
- unsupported subscription and admin feature flags now default to disabled;
- workspace cancellation calls the API, reconnect state handles terminal job
  states, and public downloads retain the target format of the active job;
- the PDF editor now declares its PDF.js worker dependency directly and the
  missing optional CSS optimizer dependency no longer causes development-mode
  500 responses;
- the fixed header, shared public layouts, tool detail shell and workspace shell
  have consistent responsive spacing, focus treatment and landmark structure.

Current verification: Prisma validation, API build, Next.js production build,
the complete monorepo test suite and lint command pass. A live development scan
covered 46 public, legal, authentication, dynamic tool, product, workspace and
SEO routes with zero non-200 responses. Chrome visual inspection covered the
tools directory, Rotate PDF detail page, software, automations, SaaS and pricing.

Remaining production work is still accurately described below where applicable,
especially recurring subscriptions/admin, dependency vulnerability remediation,
malware scanning, organization-level authorization, engine-specific readiness
and broader commerce/security end-to-end tests.

## Verified state

| Area | Status | Evidence |
| --- | --- | --- |
| Monorepo build | VERIFIED | Root production build passed for API, worker, web and shared packages |
| Web application | VERIFIED | Next.js generated 30 public, auth, workspace and dynamic routes |
| Unit/regression tests | VERIFIED | URL security 7/7, processing core 2/2, worker 11/11, API router 5/5, browser processing 6/6 |
| PDF-to-DOCX engine | VERIFIED | Real PDF converted to a valid editable DOCX through the layout-aware branch |
| Docker worker | VERIFIED | Worker image rebuilt; a real in-container conversion produced a valid OOXML DOCX archive |
| Native Node mode | PARTIAL | Full mode can run API, worker and web when Redis and native executables are installed |
| Managed Node mode | LIMITED BY DESIGN | Starts API and web without Redis/worker; server conversions, URL capture and OCR are unavailable |
| Production dependency security | FAILED | `pnpm audit --prod` reports 23 transitive/direct findings: 1 critical, 12 high, 7 moderate, 3 low |

## Architecture

The major boundaries are sensible:

- `apps/web`: Next.js App Router frontend and browser-side tools.
- `apps/api`: NestJS HTTP API, auth, catalog, commerce, files and job creation.
- `apps/worker`: BullMQ conversion consumer and native conversion adapters.
- `packages/*`: shared types, storage, logging, registry, validation, security and processing contracts.
- PostgreSQL/Prisma for durable data, Redis/BullMQ for jobs, MinIO/S3 for objects,
  and Gotenberg plus native tools for conversion.

This separation should be preserved. Native converters do not need to be
rewritten in JavaScript merely because the hosting process is Node.js. The Node
worker can safely orchestrate isolated CLI programs. Docker is one packaging
option; it is not the application architecture.

## Production blockers

### P0 — purchased licenses cannot be used

License creation returns a plaintext key once, but payment fulfillment discards
it. Only a hash and masked value remain in the database, while the customer
library displays/copies the masked value. That value cannot activate a product.
Fulfillment must atomically create the entitlement and license, persist an
encrypted one-time delivery secret or send the plaintext key, and mark delivery.

### P0 — payment fulfillment is not concurrency-safe

Webhook idempotency checks and fulfillment do not form one atomic claim.
Licensing also uses the root Prisma client from inside payment fulfillment
instead of the active transaction client. Concurrent webhook deliveries can
therefore partially fulfill an order or issue duplicate licenses. Add unique
fulfillment constraints and execute the order transition, entitlement and
license creation in one database transaction.

### P0 — recurring SaaS subscriptions are advertised but not implemented

Subscription-related Prisma models exist, but there is no complete subscription
service or lifecycle synchronization. Stripe checkout currently uses one-time
payment mode. `/app/billing`, `/app/team` and `/admin` routes are absent even
though corresponding feature flags default to enabled. Disable unsupported
flags and marketing actions until subscription checkout, webhook lifecycle,
seat management and billing UI are implemented.

### P0 — managed Node mode cannot deliver the advertised server tools

`hostinger:start` intentionally disables Redis and native processing and starts
only API plus web. It therefore cannot execute PDF-to-DOCX, OCR, URL-to-PDF,
URL-to-DOCX or other queued native jobs. Production must choose one of:

1. full native Node deployment with Redis, worker, Chromium/Gotenberg and native
   executables;
2. Docker/Compose on a host that supports containers; or
3. web/API on managed Node with conversion delegated to a separate worker service.

The capability endpoint should report each engine independently and the UI must
hide or disable unavailable tools.

## High-priority security flaws

1. CSRF origin comparison uses permissive headers and prefix matching. Parse and
   compare exact origins; never trust a caller-supplied client marker as a bypass.
2. Anonymous quota identity trusts `x-forwarded-for`. Use `req.ip` behind an
   explicitly configured trusted proxy to prevent quota evasion by spoofing.
3. Razorpay client verification does not sufficiently bind the internal order to
   the authenticated user and provider order before fulfillment.
4. Payment return URLs are caller-provided strings. Enforce an application-owned
   allowlist and construct redirects server-side.
5. Uploads are buffered in memory at a much larger transport limit than several
   tool limits; malware scanning currently always reports `SKIPPED`.
6. Development JWT, HMAC, storage and database defaults must fail closed in
   production. Docker Compose credentials and published infrastructure ports are
   local-development settings only.
7. Swagger should be disabled or protected in production.
8. The current production dependency graph includes vulnerable `tar`, `multer`,
   `qs`, `dompurify` and `deepmerge-ts` paths. Upgrade and rerun the audit.

## Conversion and tool quality gaps

- PDF-to-DOCX is improved, but layout reconstruction is heuristic. Complex
  magazines, unusual fonts, forms, multi-column documents and scanned PDFs need
  a golden-fixture visual comparison suite. Scanned documents should route
  through OCR before DOCX reconstruction.
- The text-focused PDF fallback must be described as reduced quality; it should
  not silently represent itself as high fidelity.
- Workspace cancellation currently stops the browser UI but does not cancel the
  API job, so processing may continue and consume resources.
- Polling hides transient network failures until timeout and has no reconnect
  state. SSE or resilient polling is still needed.
- The public converter has a stale target-format dependency that can produce an
  incorrect download filename after a target change.
- The standalone PDF editor is not in the canonical registry and its white-box
  replacement approach loses original background, font, color and transform
  fidelity. It should remain experimental until linked, tested and constrained.
- Capability health checks are too coarse: Gotenberg health does not prove that
  Redis, the queue worker, pdf2docx, Pandoc, Poppler and Tesseract are each ready.

## Commerce and data lifecycle gaps

- Cart contents are cleared when checkout is created, before payment succeeds.
- Removing an item can return the wrong displayed currency.
- Email verification is not required before sensitive commerce operations.
- Quota reservation, settlement, usage records, API keys, audit logs and
  subscription events are modeled but not fully wired into product behavior.
- Completed conversion jobs are later changed to `EXPIRED` during file cleanup,
  which makes history semantics confusing. Separate artifact expiry from job
  completion status.
- File access is primarily scoped to user ID rather than consistently enforcing
  organization/workspace ownership.

## Repository structure and maintainability

- `workers/conversion-worker` is empty and should be removed after confirming no
  deployment script references it.
- Root scratch/runtime artifacts (`conversion*.json`, `login*.json`,
  `register*.json`, `paste*.json`, `result.pdf`, `scratch.js`, `scratch.url`)
  should be reviewed and removed through Cleanup Mode, not deleted blindly.
- Both `package-lock.json` and `pnpm-lock.yaml` exist. pnpm is canonical; remove
  the obsolete npm lock after verification.
- Generated data currently occupies roughly 2.2 GB, dominated by `node_modules`
  and `.next`. Cleanup Mode can remove and regenerate those safely.
- API startup uses `prisma db push` and seeding. Production should use reviewed,
  immutable Prisma migrations and a separately invoked idempotent seed process.
- Lint exits successfully but reports numerous warnings, including React effect
  dependencies/state updates and unused code. Treat warning cleanup as a tracked
  quality task rather than accepting a permanently noisy baseline.

## Test gaps

Passing tests do not yet cover the riskiest business flows. Add:

1. payment webhook concurrency and replay tests;
2. checkout ownership and return-URL security tests;
3. license issue, reveal, email, activation and revocation end-to-end tests;
4. subscription creation, renewal, failed payment, cancellation and grace-period tests;
5. admin/support/customer authorization tests;
6. organization-scoped file access tests;
7. real queue cancellation and retention tests;
8. PDF-to-DOCX visual golden tests that render the source PDF and generated DOCX
   to images and compare page geometry, text blocks, images and tables.

## Recommended execution order

1. Repair license delivery and make fulfillment atomic/idempotent.
2. Fix checkout ownership, Razorpay validation, redirect allowlisting and CSRF/IP handling.
3. Decide the production topology and make capability-driven UI truthful.
4. Upgrade vulnerable production dependencies and add upload streaming/scanning.
5. Build the real recurring subscription lifecycle, then enable billing/team UI.
6. Implement admin routes and role-tested APIs, then enable the admin flag.
7. Add quota reservation/settlement and consistent organization ownership.
8. Complete cancellation, reconnect handling and per-engine readiness checks.
9. Add visual conversion fixtures and decide whether difficult documents require
   a commercial PDF SDK.
10. Run verified Cleanup Mode for obsolete files, lockfiles and generated artifacts.

## Definition of production-ready

The product is production-ready only when payment fulfillment is atomic and
replay-safe, customers receive usable licenses, subscription marketing matches
real recurring billing, enabled tools match deployed capabilities, secrets fail
closed, high/critical dependency findings are resolved or formally accepted,
and the commerce/conversion/security end-to-end suites pass in the selected
deployment topology.
