# Blog Studio — SaaS & licence review and upgrade plan

**Date:** 2026-10-14 · **Upstream compared:** `tanmay-sahoo/Blog-generator` @ `d5663bb` (latest; same
commit as `blog-studio-upstream.lock.json`, so nothing new upstream).

Blog Studio is sold two ways:

| Edition | Model | How it is sold today |
| --- | --- | --- |
| **Blog Studio (web)** | SaaS subscription, monthly | `blog-studio-addon` — one plan: $19 / ₹1,599 per month, 40 blogs + 800 AI credits |
| **Blog Studio Desktop (Windows)** | One-time purchase + digital licence key | `blog-studio-desktop-windows` — $99 / ₹8,299, 2 machine activations, 12 months of updates |

The upstream repository has **no billing, plans or licensing**. It is a web port of the internal
generator. All commerce is AppToolkitLab's own code, so this review covers our implementation.

## 1. Review result

### Working correctly (verified by reading the code and by tests)

- Subscription checkout: Stripe (USD) and Razorpay (INR), with webhook signature checks,
  idempotent events, and out-of-order protection (a late event can't reactivate a cancelled plan).
- Usage metering: monthly blog and credit windows, reservations released on failure, and
  serialisable transactions, so concurrent generations can't overspend.
- One-time orders: server-side prices, idempotent fulfilment, and a licence key issued per order.
  Keys are stored hashed and encrypted, and shown masked.
- Activation: seat limits enforced atomically; Ed25519-signed offline certificates bound to the
  machine and product.

### Defects found and fixed in this pass

| # | Severity | Problem | Fix |
| --- | --- | --- | --- |
| 1 | Critical | The desktop app read its licence public key from an environment variable that customer PCs never have, so **every activation failed**. | Key is embedded at packaging (`scripts/embed-license-key.mjs`); `package:win` refuses to build without it. |
| 2 | Critical | Nothing could create a downloadable release, and checkout refuses products without one, so **the desktop edition could not be sold**. | `pnpm release:publish -- --product … --version … --file … [--publish]` uploads the installer, records its SHA-256 and makes it current. |
| 3 | High | Without `LICENSE_SIGNING_PRIVATE_KEY`, a new signing key was generated on every restart, invalidating every issued certificate. | Production refuses to start without it whenever the store or desktop sales are enabled. |
| 4 | High | Refunds were ignored: refunded buyers kept downloads and working licences. | Stripe `charge.refunded` and Razorpay `refund.processed` revoke the order's entitlements and keys (partial refunds are logged only). |
| 5 | High | Deactivating a machine never stopped it: certificates were permanent, so 2 seats could be reused without limit. | New `POST /licenses/validate`. The desktop app re-checks every 12 hours when online and drops a deactivated, revoked or refunded licence (offline use continues). |
| 6 | High | The Razorpay one-time checkout passed no order reference, so the webhook could not fulfil a payment if the buyer closed the tab. | Order notes are sent, and the webhook also finds the order by its Razorpay order ID. |
| 7 | High | Customers could not cancel a subscription or manage billing. | Cancel at period end, resume (Stripe) and the Stripe billing portal, for workspace owners/admins only, with buttons on the Billing page. |
| 8 | Medium | Order and cart checkout accepted any price, including recurring and SaaS, and allowed buying the same product twice. | One-time prices only; SaaS products excluded; owned products refused. |
| 9 | Medium | If Stripe returned no checkout URL, the buyer was sent straight to the success page. | Now an error. |
| 10 | Medium | Cart showed the price in the wrong currency after switching currency. | Shows the selected currency's price. |
| 11 | Low | Installers downloaded with a `.zip` name; re-seeding unlisted the desktop product; customers had no way to free a seat. | Real extension kept; seed no longer unpublishes; Library lists devices with **Deactivate**. |

Tests: `apps/api/test/commerce.test.cjs` covers refunds, webhooks and licence validation. The API
suite passes 45/45 and the live API suites 24/24.

### Still missing (needs decisions or provider setup, covered in §3)

- **The PRO/BUSINESS platform plans cannot be bought.** The pricing page's "Choose Pro" and
  "Choose Business" lead to a free registration; no code creates a platform `Subscription`.
- **Only one Blog Studio plan.** `prices` has a unique constraint on (product, currency), which
  rules out monthly + yearly prices or several tiers. The add-on allowance (40/800) is hard-coded
  in `blog-usage.service.ts`.
- No trials, coupons, annual billing, plan up/downgrade, tax invoices (GST) or dunning grace
  period: a failed renewal cuts access immediately.
- Desktop: no update feed (`publish: null`) and no Windows code signing, so SmartScreen will warn.
  The "12 months of updates" promise is not enforced, and there is no limit on how long the app
  can stay offline.
- Upstream features not yet ported: bulk export ZIP, history CSV export, Shopify OAuth app
  install, full German UI, user/seat management screens.

## 2. Before going live (owner checklist)

1. Generate an Ed25519 key pair; set `LICENSE_SIGNING_PRIVATE_KEY` (server) and build the
   desktop app with the matching public key. **Never rotate it** without a migration plan.
2. Set `LICENSE_ENCRYPTION_KEY`. It currently falls back to `JWT_SECRET`, which would make stored
   keys unreadable if the JWT secret is rotated.
3. Create the Stripe price and Razorpay plan for Blog Studio. Set `STRIPE_BLOG_STUDIO_PRICE_ID` and
   `RAZORPAY_BLOG_STUDIO_PLAN_ID`, then re-seed.
4. Webhooks:
   - Stripe: `checkout.session.completed`, `customer.subscription.*` and `charge.refunded`.
   - Razorpay: `payment.captured`, `order.paid`, `subscription.*` and `refund.processed`.
5. Configure the Stripe customer portal (cancellation, invoices, payment methods).
6. Package and sign the installer, run `release:publish --publish`, then enable
   `FEATURE_STORE_CHECKOUT`, `FEATURE_BLOG_DESKTOP_SALES` and `FEATURE_BLOG_STUDIO_CHECKOUT`.
7. Sandbox run-through: buy, activate, deactivate, refund, then confirm the licence stops working;
   subscribe, cancel and confirm access ends at period end.

## 3. Upgrade plan

### Phase 1 — Billing foundation (needed before more plans can be sold)

- **Plan catalogue.** Add a `SaasPlan` table: product, key (`starter` / `pro` / `agency`), blog
  and credit limits, seats, features, sort order. Allow several prices per plan (monthly and
  yearly, USD and INR) by replacing the unique (product, currency) with (plan, currency,
  interval). Read limits from the plan instead of the hard-coded 40/800.
- **Plan changes.** Upgrade takes effect immediately with proration (Stripe subscription update;
  Razorpay plan update). Downgrade takes effect at renewal.
- **Trials and coupons.** A 7-day trial with a small credit allowance; promotion codes (Stripe
  coupons, Razorpay offers).
- **Dunning.** Keep access for 7 days while `PAST_DUE`, send reminder emails, then suspend.
- **Invoices and tax.** Stripe Tax or Razorpay invoices, with GSTIN capture for Indian businesses
  and an invoice list on the Billing page.
- **Credit top-ups.** One-time credit packs for customers who exceed their monthly allowance.
- **Platform plans.** Either sell PRO/BUSINESS through the same engine, or remove "Choose Pro /
  Business" until they can be bought. **Decision needed.**

Suggested Blog Studio tiers, a starting point for you to price:

| | Starter | Pro (today's plan) | Agency |
| --- | --- | --- | --- |
| Blogs / month | 15 | 40 | 150 |
| AI credits | 300 | 800 | 3,000 |
| Seats | 1 | 3 | 10 |
| Publishing destinations | 1 | 5 | Unlimited |
| Scheduler, bulk CSV, API | — | Scheduler | All + API + white-label exports |

### Phase 2 — Desktop licence edition

- **Updates.** Ship an update feed through electron-updater's generic provider, served via
  signed download URLs. Only offer updates released before `updatesValidUntil`.
- **Renewals.** Sell a yearly "updates & support" renewal as a one-time product that extends
  `updatesValidUntil`.
- **Distribution.** Sign the Windows installer with a code-signing certificate.
- **Machine binding.**
  - Use the Windows `MachineGuid` for the machine fingerprint (renaming the PC currently breaks
    activation).
  - Require an online check at least every 30 days.
- **Customer self-service.** Customers can already free a seat from the Library. Add "transfer
  licence" for support staff.
- **Admin screens:** releases, licence lookup/revoke/reset, refunds, customer search.

### Phase 3 — Product upgrades (what makes customers pay more)

- **Port the upstream gaps:**
  - bulk export ZIP and history CSV;
  - Shopify OAuth app install instead of pasted tokens;
  - full German interface;
  - team and seat management screens.
- **SEO depth:**
  - SERP and competitor outline analysis;
  - keyword-coverage score;
  - internal-link suggestions from the customer's sitemap;
  - FAQ/Article schema (JSON-LD);
  - readability score.
- **Brand voice.** Upload a style guide, sample posts and product documents, reusing the existing
  AI-memory module for retrieval.
- **Performance loop.** Connect Google Search Console to show clicks and rankings per published
  post, and suggest refreshes for posts that are declining.
- **Collaboration.** Draft → review → approve workflow with comments (fits the Agency tier).
- **Publishing.** Add Webflow and Ghost, plus a content calendar view over the existing scheduler.
- **Automation.** Public API, webhooks and Zapier/Make integration (Agency tier).

### Phase 4 — Growth and operations

- Onboarding wizard (site URL → brand voice → first article).
- Usage emails at 80% and 100% of the allowance.
- Referral or affiliate programme.
- Revenue dashboard (MRR, churn, refunds).
- Per-model AI cost tracking against plan price, using the existing `ai_model_prices` table.
- Abuse limits on trials.

## 4. Order of work

1. Owner checklist (§2). This is enough to sell **one** SaaS plan and the desktop licence.
2. Phase 1: plan catalogue, plan changes, dunning and invoices, then the platform-plan decision.
3. Phase 2 (desktop updates and signing) alongside Phase 3's upstream ports.
4. Phase 3 SEO and brand voice, which are the main reasons to upgrade tiers. Then Phase 4.

## 5. Themes (shipped 2026-10-15)

**What users get.** Four Blog Studio themes, each in light and dark mode:

| Theme | Accents | Neutrals |
| --- | --- | --- |
| Cobalt (default) | Blue and cyan | Slate |
| Forest | Emerald and teal | Slate |
| Sunset | Orange and amber | Stone |
| Midnight | Violet and fuchsia | Zinc |

**How saving works.**
- The theme is stored on the user's account (`users.blog_studio_theme`), so it follows them to
  every device and every sign-in.
- The first time a user opens Blog Studio, a picker appears once; choosing any theme, Cobalt
  included, saves it.
- After that it is never asked again. Users change it from the sidebar **Theme** button or from
  Settings → **Appearance**.
- The browser caches the last saved theme for instant first paint. The account value always
  wins, and the cache is cleared on sign-out.

**How it is built.**
- `apps/web/src/blog-studio-themes.css` redefines the Tailwind palette variables on the Blog
  Studio root, so every page is themed without per-page edits.
- Accent shades are shifted so text and buttons keep WCAG AA contrast; a unit test enforces this.
- API: `PATCH /users/preferences` accepts only the four theme IDs.

**Security fix made at the same time.** `PATCH /users/profile` passed its unvalidated body
straight to the database, so any signed-in user could set their own `platformRole` to `ADMIN`
or change `status`/`email`. It now uses a validated DTO and copies only first and last name.

**Next steps for themes:**
- Agency tier: a custom brand colour, generating the palette from one hex value.
- Density (comfortable/compact) and editor font-size preferences, stored next to the theme.
- Apply the chosen theme to exported HTML previews.
