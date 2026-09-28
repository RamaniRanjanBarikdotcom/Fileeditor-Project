# Blog Studio Upstream Parity Contract

The approved upstream baseline is `tanmay-sahoo/Blog-generator` at commit
`d5663bbfd26ceaad55bc664ced140ae4947768f1`. AppToolkitLab ports reviewed behavior into its
native Next.js, NestJS, PostgreSQL, BullMQ and MinIO architecture. It never merges or executes
upstream code automatically.

## Current capability matrix

| Upstream capability | Native implementation | Verification | Release state |
|---|---|---|---|
| Ten-stage generation | `packages/blog-engine` | `packages/blog-engine/test/blog-engine.test.cjs` | Implemented |
| Progress, cancellation, checkpoints | `BlogStudioProcessor`, persisted checkpoints and SSE | engine unit tests; live E2E required | Implemented |
| Rich editing and autosave | TipTap editor at `/app/blog-studio/[blogId]` | production web build | Implemented |
| History and search | organization-scoped Blog Studio APIs and pages | API contract/live E2E required | Implemented |
| SEO metadata and scoring | generation finalizer and editor side panel | engine unit tests | Implemented |
| Image generation | managed image API, credit settlement, MinIO and signed URLs | provider sandbox E2E required | Guarded by `FEATURE_BLOG_STUDIO_IMAGES` |
| WordPress, Shopify, custom and JTL publishing | DNS-pinned connectors and publication history | provider sandbox E2E required | Guarded by `FEATURE_BLOG_STUDIO_PUBLISHING` |
| Scheduler | delayed BullMQ jobs, runs and generation/publish continuation | live queue E2E required | Guarded by `FEATURE_BLOG_STUDIO_SCHEDULER` |
| Product context | manual products plus auto-detected Shopify, WooCommerce, Magento, PrestaShop, BigCommerce, JTL, React/Next.js and custom storefront import; optional custom CSS mappings | authenticated/bot-protected stores and broader hostile storefront fixtures remain provider-specific | Guarded by full-suite/scraping flags |
| Provider settings (BYOK) | encrypted credentials, current curated models, live provider discovery and custom future model IDs | provider sandbox E2E required | Guarded by `FEATURE_BLOG_STUDIO_BYOK` |
| Research settings and prompts | organization settings and versioned stage templates | API integration coverage required | Guarded by `FEATURE_BLOG_STUDIO_FULL_SUITE` |
| Usage analytics | settled credit, image, generation and publication metrics | API/live database E2E required | Guarded by `FEATURE_BLOG_STUDIO_ANALYTICS` |
| Logs and notifications | real audit-log queries and persistent in-app notifications | API integration coverage required | Implemented behind full suite |
| Organization permissions | JWT organization identity plus membership/owner checks | authorization E2E required | Implemented |
| Windows application | standalone Electron renderer, SQLite, `safeStorage`, signed offline license | desktop security/license unit tests; clean-VM smoke pending | Preview |
| English/German interface | no complete translation catalog yet | none | Deferred |
| Remote-post synchronization | WordPress/Shopify remote listing, normalized records, manual sync, rename and remote deletion | provider sandbox E2E required | Guarded by `FEATURE_BLOG_STUDIO_SYNC` |
| WordPress category mapping | remote category discovery/creation plus organization-scoped keyword-to-category mappings applied during publication | provider sandbox E2E required | Guarded by publishing/full-suite flags |

“Implemented” means code is present and passes the current compile/unit gate. It does not mean an
external integration may be enabled in production. Provider-dependent production flags stay
disabled until their named sandbox E2E suite passes; local development may enable them for testing.

## Safe update procedure

1. Run `pnpm blog-studio:upstream:check`. The command is read-only and compares the lock commit to
   the configured upstream branch through the GitHub API.
2. If changes exist, review the compare URL and classify each changed file as behavior, UI, data,
   security, dependency or documentation.
3. Confirm ownership and licensing before copying any code or assets.
4. Update this matrix with the proposed native component and acceptance test. Do not update the
   lock file yet.
5. Port behavior in a review branch. Never add the upstream application as a submodule, iframe,
   second authentication system, MongoDB service or remote Electron shell.
6. Run `pnpm blog-studio:verify`, database migration tests, provider sandbox E2E and a regression run
   of existing document tools.
7. Local development may enable guarded capabilities for integration work. Keep the corresponding
   production flags disabled until their external-service tests pass.
8. After review and acceptance, update `blog-studio-upstream.lock.json` with the reviewed commit,
   audit date and complete supported-feature inventory.

The weekly workflow `.github/workflows/check-blog-studio-upstream.yml` only reports changes by
opening or updating a GitHub issue. It does not modify the baseline or application code.
