# Plan: Invoice Studio + Inventory (new SaaS app in AppToolkitLab)

## Context

You want a second SaaS app next to Blog Studio:
- **Invoice Studio:** users enter their business, customer and line-item data and produce
  professional invoices in any language and in many invoice formats.
- **Inventory:** stock is managed in the same software. Issuing an invoice deducts stock, and
  purchases add it.

**Your decisions:**
- First release does India GST **and** EU VAT properly.
- Free tier plus paid plans.
- Inventory = core stock **plus** purchasing (suppliers, purchase orders, goods received).
- Online payment of invoices comes later; release 1 records payments manually and prints UPI
  and SEPA (EPC) QR codes.

The plan reuses what the platform already has, so only invoice and inventory logic is new:
- NestJS API, Prisma/Postgres and organisations with roles;
- MinIO storage with ClamAV scanning, and Resend email;
- Stripe/Razorpay subscriptions and feature flags;
- Gotenberg (Chromium) with the **full Noto font set** (CJK, Arabic, Urdu, Hebrew, Devanagari,
  Bengali, Thai…, verified in the running container), so any script prints correctly;
- PDF/A conversion, which we already have and which Factur-X/ZUGFeRD needs later.

## Product shape

- **App:** `/app/invoices` (sales), `/app/inventory` (items and stock), `/app/purchases`
  (suppliers, POs, receipts, bills), `/app/invoices/settings`.
- **Public pages:** a share link `/i/[token]` and a marketing page `/saas/invoice-inventory`.
- **Document language ≠ app language.** Any invoice can be printed in any language (or
  bilingual, e.g. English + Hindi or English + Arabic) while the dashboard stays in the user's UI
  language.
- **"Every format" = two independent axes**, both registry-driven so new kinds need no schema
  change:
  1. **Document types:**
     - Tax invoice, Bill of supply (India composition/exempt), Export invoice (LUT / with IGST);
     - Proforma, Quotation/Estimate, Credit note, Debit note, Delivery challan, Payment receipt;
     - Purchasing side: Purchase order, Purchase bill.
  2. **Layouts/templates:**
     - Classic, Modern, Minimal;
     - GST detailed (with HSN summary), EU VAT (rate breakdown);
     - Thermal receipt 58/80 mm, Letterhead.

   Users can set colours, logo, signature, column visibility, custom fields and custom labels.

## Architecture

### New shared packages (pure TypeScript, framework-free, heavily unit-tested)

1. **`packages/invoice-engine`:**
   - **Money:** `decimal.js` only, never JS floats. ISO 4217 minor units (JPY 0, INR/EUR 2,
     KWD 3). Line and invoice rounding modes, plus an India "round off" line.
   - **Tax engine**, data-driven with effective-dated rate tables:
     - *India GST:* place-of-supply resolution → CGST+SGST (same state) or IGST
       (inter-state); exports/SEZ zero-rated with or without payment (LUT); reverse charge;
       cess; composition (bill of supply); HSN digit rules by turnover; GSTIN format and
       checksum validation.
     - *EU VAT:* domestic rates per member state; intra-EU B2B reverse charge (VAT-ID format
       check, optional online VIES check); exports zero-rated; OSS destination-country rate for
       B2C distance sales; the mandatory per-rate breakdown and legal wording.
     - *Generic mode:* any named taxes and percentages, for every other country until it gets
       its own rules.
   - **Document-type registry** (same idea as `packages/tool-registry`). Each type declares:
     - its numbering series and allowed status transitions;
     - its stock effect (`out` / `in` / none) and whether tax applies;
     - required fields, its label keys and its default template.

     Adding a new invoice kind later is a registry entry plus a template.
   - **Numbering formatter:** patterns such as `INV/{FY}/{SEQ:5}`. Supports the India April–March
     financial year and the 16-character GST limit; gapless numbers are assigned only at issue.
2. **`packages/invoice-templates`:**
   - **Renderer:** an escaped HTML renderer, with every user value escaped. Templates are data
     plus CSS.
   - **Label packs:** JSON per language. Start with en, hi, bn, ta, de, fr, es, it, nl, pt, ar,
     zh, ja, plus bilingual mode. Per-business label overrides make **any** language usable on
     day one, even without a shipped pack.
   - **Formatting:** `Intl` for numbers, dates and currency (Indian lakh grouping via `en-IN`);
     `dir="rtl"` for ar/he/fa/ur; a Noto font stack.
   - **Amount in words:** en, en-IN (lakh/crore) and hi first, behind a pluggable interface.
   - **QR codes:** UPI (`upi://pay…`) and EPC/SEPA payment QR.
   - **One renderer everywhere:** the browser live preview (iframe `srcdoc`) and the server PDF
     use the same code, so the preview matches the PDF exactly.
3. **Gotenberg HTML→PDF client:** move the HTML→PDF and PDF/A calls out of
   `apps/worker/src/adapters/gotenberg.ts` into a small shared package, so the API can render
   invoices synchronously (about 1 s) without the conversion queue. The queue would charge
   conversion quota and its outputs expire after 10 minutes.

### API modules (`apps/api/src/…`), following the Blog Studio module pattern

- **`business/`:**
  - business profiles: several per org, limited by plan (e.g. branches with separate GSTINs);
  - contacts (customers and suppliers), items/services, tax-rate tables;
  - numbering series, templates, label overrides.
- **`invoicing/`:**
  - documents and their lines;
  - issue (number assignment + stock + PDF snapshot in **one transaction**), void, convert
    (quote → invoice, PO → bill), credit and debit notes;
  - recorded payments, share links, email sending (extend
    `auth/transactional-email.service.ts` to support attachments).
- **`inventory/`:**
  - warehouses; an **append-only stock ledger** (`StockMovement`) plus a `StockLevel` table
    updated in the same transaction;
  - adjustments, transfers; suppliers, purchase orders, goods receipts, purchase bills;
  - weighted-average cost; low-stock alerts; stock and valuation reports.
- **`saas-plans/` (generalised from Blog Studio):** plan catalogue, entitlements and usage
  counters shared by every SaaS app (details in Phase 0).

### Rules that keep data correct

- **Issued documents are immutable.**
  - Corrections go through credit/debit notes; void keeps the number with a reason. This is
    required by both GST and EU VAT.
  - Seller and buyer details are **snapshotted** into the document at issue, so later edits to a
    contact never change an old invoice.
- **Numbering never duplicates or skips.**
  - Numbers come from an atomic `UPDATE … RETURNING` on the series row inside the issue
    transaction.
  - Drafts have no number.
  - An idempotency key on "Issue" makes a double click impossible.
- **Stock:**
  - Issuing deducts stock and voiding or a return credit note restores it, through ledger rows
    linked to the document.
  - Per-business negative-stock policy: block / warn / allow.
  - Concurrent sales of the last unit are serialised by row locks on `StockLevel`.
- **Issued PDFs are archived permanently** via `FilesService.storeGeneratedAsset`, with a
  SHA-256 hash; draft PDFs are rendered on demand only.
- **Security:**
  - Every query is scoped by `organizationId`.
  - Every request body uses a validated DTO, never a plain type; this was the root cause of the
    `platformRole` hole fixed on 2026-10-15.
  - Share-link tokens are 128-bit random, stored hashed, with an expiry and revocable.
  - Logos go through the existing ClamAV upload path.
  - Template HTML is fully escaped and self-contained (logo as a data URI, no network fetches),
    and Gotenberg already denies private IPs.
- **Roles (release 1):** org roles OWNER/ADMIN = everything; MEMBER = create/issue documents and
  manage stock; VIEWER = read-only. Fine-grained permissions come later, the same way as
  `BlogStudioPermission`.
- **Hosting without Gotenberg** (`DEPLOYMENT_MODE=HOSTINGER`): fall back to "Print / Save as PDF"
  from the same HTML preview.

### Data model (new Prisma models, all with `organizationId` and indexes)

| Area | Models |
| --- | --- |
| Business | `Business`, `TaxRegistration`, `DocumentSeries`, `InvoiceTemplateSetting`, `LabelOverride`, `TaxRate` (country, code, rate, effectiveFrom/To) |
| Parties and items | `Contact` (customer/supplier flags, addresses, tax IDs, language, currency), `Item` (goods/service, SKU, barcode, unit/UQC, HSN/SAC, tax category, prices, `trackInventory`, reorder level) |
| Documents | `Document` (type string checked against the registry, status, number, dates, place of supply, currency, exchange rate, language, template, seller/buyer snapshots, totals, tax breakdown, linked document, archived PDF file and hash), `DocumentLine`, `DocumentPayment`, `DocumentShareLink` |
| Inventory | `Warehouse`, `StockLevel`, `StockMovement` (type, quantity delta, unit cost, source document) |
| Purchasing | `PurchaseOrder`(+lines), `GoodsReceipt`(+lines), purchase bills = `Document` with type `PURCHASE_BILL` |
| SaaS (shared) | `SaasPlan`, `SaasPlanPrice`, `SaasUsageCounter` (org, product, metric, window, used) |

Quantities and prices use `Decimal`; document totals are stored rounded to the currency's minor
units.

## Phases

Release 1 (public launch) = Phases 0–3. Later releases add compliance, payments and integrations.

### Phase 0 — Shared foundations (size: M)

- **Generic SaaS plans:**
  - `SaasPlan`/`SaasPlanPrice` with monthly and yearly USD and INR prices. This replaces the
    `prices @@unique([productId, currency])` limit noted in `docs/BLOG_STUDIO_SAAS_PLAN.md`
    Phase 1, so Blog Studio tiers are unblocked too.
  - `SaasEntitlementsService.limit(org, product, metric)` and an atomic
    `consume(org, product, metric)`.
  - Generalise `payments/saas-subscriptions.service.ts` checkout, cancel and portal from the
    hard-coded `blog-studio-addon` to any SaaS product and plan.
- Shared Gotenberg client package; feature flags `invoicing`, `inventory`, `invoicingCheckout`
  (fail-closed in production, as Blog Studio does).
- App-shell navigation entries and empty pages.

**Exit:** Blog Studio still passes its tests on the generic plan code.

### Phase 1 — Invoicing core with GST + EU VAT (size: L)

- **Onboarding:** country → business profile → tax registration → numbering → template →
  language. Pre-filled from the country, e.g. India gets the FY series and GST rate tables; EU
  states get their VAT rates.
- **Records:** contacts and items (no stock yet), with CSV import/export.
- **Document editor:** split view with a live preview; HSN/SAC; discounts; the tax engine
  applied automatically from place of supply / VAT IDs.
- **Document types:** tax invoice, bill of supply, export invoice, quotation, proforma, credit
  note, debit note, payment receipt; conversions (quote → invoice).
- **Templates:** 7 templates; 13 label packs, bilingual mode and custom label overrides;
  amount in words; UPI and EPC QR.
- **Lifecycle:** issue → archived PDF → share link and email; record payments; statuses (draft,
  issued, partly paid, paid, overdue, void).

**Exit:** golden tax tests pass (§Verification); a Hindi, Arabic (RTL) and Chinese invoice
prints correctly; numbering stays gapless under concurrent issuing.

### Phase 2 — Inventory and purchasing (size: L)

- **Stock:** warehouses, opening stock, stock ledger and levels; invoices and delivery challans
  deduct stock; return credit notes restore it; adjustments with reasons; transfers between
  warehouses.
- **Purchasing:** suppliers, purchase orders (draft → sent → partly received → received →
  closed), goods receipts against POs (stock in + weighted-average cost), purchase bills with
  input tax.
- **Tools:** low-stock alerts (in-app notification and email); barcode/SKU lookup in the invoice
  editor.
- **Reports:** stock on hand, valuation, movement history, items below reorder level.

**Exit:**
- the ledger always reconciles to the level table (a check job runs and is tested);
- two simultaneous invoices for the last unit cannot both succeed under the "block" policy;
- cancelling a goods receipt reverses its stock.

### Phase 3 — Plans, reports, launch (size: M)

Plan gating (suggested starting point; you set the prices):

| | Free | Pro | Business |
| --- | --- | --- | --- |
| Invoices / month | 20 | Unlimited | Unlimited |
| Businesses (branches/GSTINs) | 1 | 2 | 10 |
| Items | 100 | 5,000 | Unlimited |
| Warehouses | 1 | 3 | Unlimited |
| Purchasing (POs, receipts, bills) | — | ✓ | ✓ |
| Recurring invoices and reminders | — | ✓ | ✓ |
| Team seats | 1 | 3 | 10 |
| "Made with AppToolkitLab" footer | Yes | No | No |

Also in this phase:
- **Reports:** GSTR-1 data export (B2B, B2C, HSN summary, credit notes) as Excel/JSON; EU VAT
  return totals and EC Sales List data; sales, receivables ageing and top-items dashboard.
- **Recurring invoices** and overdue reminders, using the existing scheduler/outbox pattern.
- **Launch:** marketing page `/saas/invoice-inventory`, pricing-page entry, checkout through the
  Phase 0 generic plans.

### Later releases (registry-driven, no rework needed)

- **Release 2 — e-invoicing compliance:**
  - Factur-X/ZUGFeRD (PDF/A-3 + embedded CII XML, reusing our PDF/A conversion), Peppol BIS 3.0
    UBL export, XRechnung;
  - India e-invoice (IRN + signed QR from the IRP) and e-way bills through a GSP provider
    (**owner decision:** which provider; it has per-call costs).
- **Release 3 — get paid online:**
  - Stripe Connect / Razorpay Route onboarding per user, "Pay now" on share links, automatic
    payment matching;
  - a customer portal; automatic FX rates.
- **Release 4 — reach:**
  - full app-UI localisation (the dashboard itself in many languages);
  - more country tax packs (UK VAT, US sales tax, Gulf VAT, Australia GST…) as data packs for
    the tax engine;
  - FIFO costing, product variants/batches/serials/expiry;
  - accounting exports (Tally XML, QuickBooks/Xero CSV);
  - Shopify/WooCommerce order → invoice import;
  - a public API and webhooks; mobile/PWA.

## Critical files

- **New:**
  - packages: `packages/invoice-engine/`, `packages/invoice-templates/`, the shared Gotenberg
    client package;
  - API: `apps/api/src/{business,invoicing,inventory,saas-plans}/`, and a Prisma migration
    `apps/api/prisma/migrations/2026…_invoice_inventory/`;
  - web: `apps/web/src/app/app/{invoices,inventory,purchases}/`, `apps/web/src/app/i/[token]/`,
    `apps/web/src/app/saas/invoice-inventory/`.
- **Changed:**
  - `apps/api/prisma/schema.prisma`, `apps/api/src/app.module.ts`;
  - `apps/api/src/feature-flags/feature-flags.service.ts`;
  - `apps/api/src/payments/saas-subscriptions.service.ts` (generalise);
  - `apps/api/src/blog-studio/blog-usage.service.ts` (read limits from `SaasPlan`);
  - `apps/worker/src/adapters/gotenberg.ts` (use the shared client);
  - `apps/api/src/auth/transactional-email.service.ts` (attachments);
  - `apps/web/src/app/app/layout.tsx` (navigation), `apps/web/src/app/pricing/page.tsx`;
  - `apps/api/prisma/seed.ts` (products, plans, GST/VAT rate tables).

**Reuse:**
- `FilesService.uploadFile` / `storeGeneratedAsset` (logos, archived PDFs);
- `StorageClient.getSignedDownloadUrl`; the `RedisService` and outbox patterns;
- `AuditLog` (issue, void and stock-adjustment trail);
- `@RequireFeatures`, `JwtAuthGuard`, the org membership checks used in
  `saas-subscriptions.service.ts`;
- the Blog Studio theme approach for template colours.

## Verification

- **Engine unit tests (golden cases):**
  - GST: intra-state (CGST/SGST split), inter-state (IGST), export with LUT, reverse charge,
    cess, round-off;
  - EU: domestic, intra-EU reverse charge, OSS B2C, non-EU export;
  - currencies with 0/2/3 decimals; GSTIN and VAT-ID validation; numbering patterns across the
    FY boundary.
- **Template tests:** each template × several languages, including RTL Arabic and bilingual;
  escaping of malicious input (`<script>`, `"><img onerror>`).
- **API integration tests (live Docker):**
  - full flow quote → invoice → PDF → share link → payment → paid;
  - credit note restores stock; PO → receipt raises stock and average cost;
  - gapless numbering with 20 parallel issues;
  - last-unit race; plan limits (Free stops at 20 invoices);
  - org isolation (user B cannot read user A's documents or links).
- **PDF checks:** extract text with `pdftotext` from Hindi, Arabic and Chinese invoices to
  confirm the text is real and selectable, not boxes; archived PDF hash matches.
- **Real-browser E2E (Puppeteer, like the theme test):** onboarding → create item → invoice →
  preview equals PDF → stock drops → purchase order → receive → stock rises.
- **Release gate:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, then
  rebuild containers and check that the migration applies on start.

## Owner decisions still open (not blocking Phase 0–1)

1. Final plan prices (USD and INR) and Free-tier limits.
2. GSP provider for India IRN / e-way bill (Release 2).
3. A tax professional's review of GST and VAT wording and rules before launch. Rate tables are
   data, seeded from official sources and editable by admins, never hard-coded.
4. App name: "Invoice Studio" is used as the placeholder.

## Implementation status (2026-10-16)

Release 1 (Phases 0–3) is implemented and verified.

| Phase | Delivered |
| --- | --- |
| 0 | Generic SaaS plans (`saas_plans`, `saas_plan_prices`, `saas_usage_counters`), `SaasEntitlementsService` (atomic metered usage), generic checkout/cancel/portal at `/saas/:slug/*`, `@docconv/pdf-render`, feature flags `invoicing` / `inventory` / `invoicingCheckout`. |
| 1 | `@docconv/invoice-engine` (exact decimals, GST/EU VAT/generic tax, registry of 11 document types, numbering, GSTIN/VAT-ID checks), `@docconv/invoice-templates` (8 layouts, 13 language packs, bilingual, any-language label overrides, amount in words, UPI/SEPA QR), API for businesses, contacts, items and documents (drafts, live preview, issue, void, convert, payments, share links, email, archived legal PDF), web app under `/app/invoices` and public `/i/[token]`. |
| 2 | Warehouses, append-only stock ledger with locked levels and weighted-average cost, adjustments, transfers, purchase orders, goods receipts (partial, cancellable), purchase bills, stock reports, ledger reconciliation. |
| 3 | Free / Pro / Business plans with limits and features, GSTR-1 workbook, EU VAT + EC Sales List + OSS workbook, receivables ageing, CSV import/export, recurring invoices, payment reminders, daily low-stock email, marketing page `/saas/invoice-inventory`, pricing entry. |

Deviations from the plan, by design:

- Exact money maths uses a small BigInt decimal type (`packages/invoice-engine/src/decimal.ts`) instead of `decimal.js`: same guarantees, no dependency.
- The worker keeps its own Gotenberg adapter; the API uses `@docconv/pdf-render`.
- Models are prefixed `Inv*` (tables `inv_*`) to avoid clashing with generic names.

Verification: `packages/invoice-engine/test` (23 golden tax cases), `packages/invoice-templates/test` (9), `apps/api/test/invoicing.e2e.test.cjs` (13 live cases: gapless numbering under 12 parallel issues, last-unit race, PO → receipts → average cost, credit-note returns, voids, share links, archived PDF hash, GSTR-1 contents, CSV round trip, recurring, plan limits, workspace isolation, ledger reconciliation), and real-browser journeys (onboarding → invoice → payment → share → stock; reports, CSV, recurring). Multilingual PDFs (Hindi, Arabic RTL, Chinese, German/English bilingual, 80 mm thermal) were rendered through Gotenberg and their text extracted.

Before going live: set plan prices (seeded placeholders), have a tax adviser review GST/VAT wording and the GSTR-1 column mapping against the current GSTN offline template, have native speakers review the label packs, configure `RESEND_API_KEY` for email, and set `FEATURE_INVOICING_CHECKOUT=true` after a sandbox checkout.
