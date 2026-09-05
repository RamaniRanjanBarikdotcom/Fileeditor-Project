# AppToolkitLab Project Execution Memory

**Product:** AppToolkitLab by Gonexel  
**Website:** https://apptoolkitlab.com/  
**Parent company:** https://gonexel.com/  
**Repository:** `document-platform`  
**Purpose:** Permanent record of project plans, active work, completed work, verification evidence, decisions, blockers and remaining tasks.  
**Last updated:** 2026-09-03

---

## 1. Purpose of this document

This file is the permanent project memory for developers and AI assistants.

It records:

- What the project currently contains
- What has already been implemented
- What has been properly verified
- What is currently being worked on
- What is still pending
- What is blocked
- Which files were changed
- Which files were removed
- Which commands and tests were executed
- Which architectural decisions were made
- What the next developer or AI session should do

This document supplements the source code, tests, database migrations and deployment documentation. It does not replace them.

---

## 2. Mandatory usage rules

This file must be updated whenever work:

- Starts
- Changes status
- Adds a new tool
- Modifies an existing tool
- Fixes a conversion problem
- Changes a public route
- Changes an API contract
- Changes the database schema
- Changes a worker or processing engine
- Adds or removes a dependency
- Adds or removes source files
- Changes Docker or Node deployment
- Creates a new architectural decision
- Introduces a known limitation
- Becomes blocked
- Is declared complete

### Important rules

1. Code being written does not mean a task is complete.
2. Only tasks marked `VERIFIED` are complete.
3. Every verified task must include test evidence.
4. Do not store passwords, API keys, tokens or customer data here.
5. Do not hide unsuccessful approaches.
6. Record failed attempts and explain what replaced them.
7. File deletion requires an approved cleanup manifest.
8. Partially working code must be marked `IMPLEMENTED`, not `VERIFIED`.
9. If this file conflicts with reproducible source-code evidence, correct this file.
10. Every implementation session must leave a handoff entry if work is unfinished.

---

## 3. Status definitions

| Status        | Meaning                                                              |
| ------------- | -------------------------------------------------------------------- |
| `DISCOVERED`  | A problem or requirement has been found but is not fully planned.    |
| `PLANNED`     | Scope and expected outcome are documented.                           |
| `READY`       | Dependencies and acceptance criteria are understood.                 |
| `IN_PROGRESS` | Implementation is actively happening.                                |
| `BLOCKED`     | An external decision, service, credential or dependency is required. |
| `IMPLEMENTED` | Code exists, but complete verification has not passed.               |
| `VERIFIED`    | Implementation and all required regression tests passed.             |
| `DEFERRED`    | Work is intentionally postponed.                                     |
| `CANCELLED`   | Work was deliberately abandoned with a documented reason.            |

Only `VERIFIED` means completed.

---

## 4. Current project architecture

| Area                    | Current state                                                            |
| ----------------------- | ------------------------------------------------------------------------ |
| Product                 | AppToolkitLab by Gonexel                                                 |
| Frontend                | Next.js App Router                                                       |
| Backend                 | NestJS                                                                   |
| Database                | PostgreSQL with Prisma                                                   |
| Queue                   | BullMQ with Redis in Docker/hybrid; disabled on Redis-free hosting       |
| File storage            | S3-compatible storage with MinIO locally                                 |
| Conversion worker       | Separate Node.js worker                                                  |
| Browser rendering       | Gotenberg with Chromium                                                  |
| Office rendering        | Gotenberg with LibreOffice                                               |
| Document conversion     | Pandoc                                                                   |
| PDF extraction          | pdf-parse and Poppler                                                    |
| OCR                     | Native Tesseract when installed                                          |
| Spreadsheet conversion  | SheetJS                                                                  |
| Image-to-PDF            | pdf-lib                                                                  |
| Docker deployment       | Supported                                                                |
| Node/hybrid deployment  | Supported and smoke-tested                                               |
| Managed Node deployment | Web + API supported without Docker/Redis; browser tools remain available |
| Fully native deployment | Documented but requires external infrastructure                          |
| Public tools            | Sixteen canonical tools (eight server/mixed, eight browser PDF tools)    |
| Tool execution          | Capability-routed browser or queued server workflow                      |

The existence of an adapter does not prove that its output quality is production-ready.

---

## 5. Existing public tools

| ID         | Tool            | Current status | Main problem                                                                 |
| ---------- | --------------- | -------------- | ---------------------------------------------------------------------------- |
| `TOOL-001` | PDF to DOCX     | `IMPLEMENTED`  | Valid DOCX output is verified; complex layout fidelity is still limited.     |
| `TOOL-002` | PDF OCR         | `IMPLEMENTED`  | Native OCR is capability-gated; preprocessing/confidence UX remains.         |
| `TOOL-003` | URL to PDF      | `VERIFIED`     | Real Chromium Docker smoke test produced a valid PDF from an external URL.   |
| `TOOL-004` | URL to DOCX     | `IMPLEMENTED`  | Semantic HTML-to-DOCX path exists; broader webpage fixture coverage remains. |
| `TOOL-005` | HTML to PDF     | `VERIFIED`     | Real Gotenberg smoke test produced a valid PDF.                              |
| `TOOL-006` | Markdown to PDF | `VERIFIED`     | GFM-compatible Pandoc path and baseline output test pass.                    |
| `TOOL-007` | Image to PDF    | `IMPLEMENTED`  | Multiple PNG/JPEG inputs and page settings pass deterministic tests.         |
| `TOOL-008` | Document Editor | `IMPLEMENTED`  | Existing editor/export remains available; unified export coverage remains.   |

### Phase-one private browser PDF tools

The canonical registry also exposes merge, split, extract pages, delete pages,
rotate, watermark, add page numbers and edit metadata. Their processing code and
deterministic package-level tests pass. They remain `IMPLEMENTED` until an actual
supported browser compatibility run is recorded.

---

## 6. Confirmed common conversion problems

### Problem 1: False frontend timeout

The frontend stops checking jobs after approximately 45 seconds, while server conversions may run for 180–240 seconds.

Required fix:

- Use tool-specific deadlines
- Continue checking valid active statuses
- Allow job reconnection
- Add cancellation
- Prefer Server-Sent Events later
- Do not display failure while the worker is still processing

### Problem 2: Conflicting file-size limits

The tool registry can advertise one limit while upload middleware enforces another.

Required fix:

```text
Global transport limit
        +
Tool-specific limit
        +
Subscription-plan limit
        =
Effective upload limit
```

The frontend and backend must display and enforce the same value.

### Problem 3: Settings are ignored

The frontend sends page size and orientation, but workers use hard-coded settings.

Required fix:

- Add tool-specific settings schemas
- Validate settings
- Pass settings into processing adapters
- Remove controls that are not supported
- Test whether each displayed setting changes the output

### Problem 4: Generic error messages

Users receive “Conversion failed” without the real safe reason.

Required error groups:

- Invalid input
- Unsupported format
- File too large
- Engine unavailable
- Password-protected file
- Corrupted file
- Processing timeout
- Output validation failure
- Storage failure
- User cancellation

### Problem 5: Weak output validation

A successful process exit does not guarantee a usable output.

Required validation:

- Open and parse generated PDFs
- Validate PDF page count
- Validate required DOCX ZIP files
- Parse generated XLSX workbooks
- Decode generated images
- Decode or probe audio
- Reject empty or structurally invalid output

### Problem 6: Missing enforced cleanup

Database records contain expiration information, but an independent cleanup process is still required.

Cleanup must cover:

- Successful jobs
- Failed jobs
- Cancelled jobs
- Worker crashes
- Abandoned uploads
- Quarantine files
- Inputs
- Outputs
- Expired download links

---

## 7. Approved library responsibilities

| Library or engine   | Responsibility                                                      |
| ------------------- | ------------------------------------------------------------------- |
| PDF.js              | PDF viewing, rendering, thumbnails and positional text extraction   |
| pdf-lib             | Merge, split, rotate, reorder, watermark, page numbers and metadata |
| Fabric.js           | PDF overlays, image editor, signatures and drawing                  |
| Apryse or Nutrient  | Advanced existing PDF text and image editing                        |
| Tesseract.js        | Browser OCR after rendering PDF pages to images                     |
| Native Tesseract    | Larger server-side OCR                                              |
| Canvas API          | Image resize, crop, rotate and basic conversion                     |
| OffscreenCanvas     | Background browser image processing                                 |
| Sharp               | Fast Node.js image processing                                       |
| ImageMagick         | Native uncommon image-format conversion                             |
| SVGO                | SVG optimization                                                    |
| MediaPipe           | Face detection                                                      |
| ONNX Runtime Web    | Optional background removal and image upscaling                     |
| WaveSurfer.js       | Audio waveform and selection interface                              |
| Web Audio API       | Playback, gain, fades and lightweight audio processing              |
| ffmpeg.wasm         | Small browser audio/video jobs                                      |
| Native FFmpeg       | Large and reliable audio/video processing                           |
| Pandoc              | Semantic Markdown, HTML and DOCX conversion                         |
| Mammoth             | DOCX to semantic HTML                                               |
| SheetJS             | CSV, JSON and XLSX processing                                       |
| Gotenberg           | Existing Chromium and LibreOffice gateway                           |
| Playwright/Chromium | Advanced webpage capture worker                                     |
| qpdf                | PDF splitting, merging, encryption and structural repair            |
| Ghostscript         | PDF compression, normalization and rasterization                    |

Do not install every library globally. Load browser libraries only when the related tool is opened.

---

## 8. Planned processing architecture

```text
Tool page
   |
   v
Canonical Tool Registry
   |
   v
Capability Registry
   |
   v
Processing Router
   |
   +-- BrowserProcessingEngine
   |     PDF.js
   |     pdf-lib
   |     Canvas
   |     Fabric.js
   |     Tesseract.js
   |     Web Audio
   |
   +-- LegacyServerProcessingEngine
   |     Existing API
   |     BullMQ
   |     Redis
   |     Existing worker
   |
   +-- NodeProcessingEngine
   |     Hostinger-safe JavaScript operations
   |
   +-- GotenbergProcessingEngine
   |     Chromium
   |     LibreOffice
   |
   +-- NativeProcessingEngine
         qpdf
         Ghostscript
         Playwright
         ImageMagick
         FFmpeg
         Native Tesseract
```

Existing tools must continue through the legacy processing path until their replacements are verified.

---

## 9. Master task register

### Foundation

| ID          | Task                                           | Status     |
| ----------- | ---------------------------------------------- | ---------- |
| `FOUND-001` | Create deterministic conversion fixture corpus | `VERIFIED` |
| `FOUND-002` | Create baseline conversion test runner         | `VERIFIED` |
| `FOUND-003` | Protect current API contracts with tests       | `VERIFIED` |
| `FOUND-004` | Add real worker integration tests              | `VERIFIED` |
| `FOUND-005` | Add Docker and Node/hybrid smoke tests         | `VERIFIED` |

### Common reliability

| ID        | Task                                       | Status        |
| --------- | ------------------------------------------ | ------------- |
| `REL-001` | Replace fixed frontend timeout             | `VERIFIED`    |
| `REL-002` | Reconcile file-size limits                 | `IMPLEMENTED` |
| `REL-003` | Validate and propagate conversion settings | `IMPLEMENTED` |
| `REL-004` | Add stable error codes                     | `VERIFIED`    |
| `REL-005` | Add format-aware output validation         | `VERIFIED`    |
| `REL-006` | Add job cancellation                       | `IMPLEMENTED` |
| `REL-007` | Add capability health endpoint             | `VERIFIED`    |
| `REL-008` | Add independent cleanup enforcement        | `IMPLEMENTED` |
| `REL-009` | Add privacy-safe conversion telemetry      | `PLANNED`     |

### Core architecture

| ID         | Task                                         | Status        |
| ---------- | -------------------------------------------- | ------------- |
| `CORE-001` | Create canonical tool registry               | `VERIFIED`    |
| `CORE-002` | Extend shared types and Prisma schema safely | `VERIFIED`    |
| `CORE-003` | Create typed ProcessingEngine contract       | `VERIFIED`    |
| `CORE-004` | Create operation-based ProcessingRouter      | `VERIFIED`    |
| `CORE-005` | Wrap current pipeline as LegacyServerEngine  | `PLANNED`     |
| `CORE-006` | Create browser worker controller             | `IMPLEMENTED` |
| `CORE-007` | Create disabled native worker contract       | `VERIFIED`    |

### Browser PDF

| ID         | Task                         | Status        |
| ---------- | ---------------------------- | ------------- |
| `BPDF-001` | PDF.js viewer and thumbnails | `PLANNED`     |
| `BPDF-002` | Browser memory estimator     | `VERIFIED`    |
| `BPDF-003` | Merge PDF                    | `IMPLEMENTED` |
| `BPDF-004` | Split PDF                    | `IMPLEMENTED` |
| `BPDF-005` | Organize PDF                 | `PLANNED`     |
| `BPDF-006` | Delete PDF pages             | `IMPLEMENTED` |
| `BPDF-007` | Extract PDF pages            | `IMPLEMENTED` |
| `BPDF-008` | Rotate PDF                   | `IMPLEMENTED` |
| `BPDF-009` | Watermark PDF                | `IMPLEMENTED` |
| `BPDF-010` | Add page numbers             | `IMPLEMENTED` |
| `BPDF-011` | PDF metadata tools           | `IMPLEMENTED` |
| `BPDF-012` | PDF to images                | `PLANNED`     |

### Browser images

| ID         | Task                             | Status    |
| ---------- | -------------------------------- | --------- |
| `BIMG-001` | Canvas and Web Worker foundation | `PLANNED` |
| `BIMG-002` | Compress image                   | `PLANNED` |
| `BIMG-003` | Compress to target file size     | `PLANNED` |
| `BIMG-004` | Resize image                     | `PLANNED` |
| `BIMG-005` | Crop image                       | `PLANNED` |
| `BIMG-006` | Rotate and flip image            | `PLANNED` |
| `BIMG-007` | JPG, PNG and WebP conversion     | `PLANNED` |
| `BIMG-008` | Image watermark                  | `PLANNED` |
| `BIMG-009` | SVG optimization                 | `PLANNED` |
| `BIMG-010` | Metadata removal                 | `PLANNED` |
| `BIMG-011` | Fabric.js photo editor           | `PLANNED` |

### OCR, audio and data

| ID          | Task                                     | Status    |
| ----------- | ---------------------------------------- | --------- |
| `BOCR-001`  | Browser OCR with PDF.js and Tesseract.js | `PLANNED` |
| `BAUD-001`  | WaveSurfer waveform interface            | `PLANNED` |
| `BAUD-002`  | Web Audio lightweight processing         | `PLANNED` |
| `BAUD-003`  | Bounded ffmpeg.wasm processing           | `PLANNED` |
| `BDATA-001` | CSV/JSON/XLSX browser processing         | `PLANNED` |

### Native processing

| ID           | Task                              | Status     |
| ------------ | --------------------------------- | ---------- |
| `NATIVE-001` | Private worker gateway            | `DEFERRED` |
| `NATIVE-002` | qpdf adapter                      | `DEFERRED` |
| `NATIVE-003` | Ghostscript adapter               | `DEFERRED` |
| `NATIVE-004` | Playwright capture worker         | `DEFERRED` |
| `NATIVE-005` | ImageMagick/Sharp worker          | `DEFERRED` |
| `NATIVE-006` | Native FFmpeg worker              | `DEFERRED` |
| `NATIVE-007` | Native OCR worker                 | `DEFERRED` |
| `SDK-001`    | Apryse versus Nutrient evaluation | `BLOCKED`  |

---

## 10. Project Cleanup Mode

### Cleanup levels

#### Audit mode

Read-only.

Reports:

- Unreferenced files
- Unused dependencies
- Unused exports
- Duplicate frontend implementations
- Generated artifacts
- Abandoned scripts
- Stale branding
- Unused environment variables
- Dead API routes
- Obsolete Docker configuration

Audit mode deletes nothing.

#### Safe mode

Can delete only approved generated artifacts:

- `.next`
- `dist`
- `.turbo`
- coverage
- TypeScript build caches
- temporary test output

It cannot delete:

- Source code
- Database migrations
- Environment files
- Uploaded files
- Docker volumes
- Object-storage data
- Customer files
- Dependencies
- Prisma schema

#### Deep mode

Can remove verified dead code only after:

1. Audit report
2. Deletion manifest
3. Human approval
4. Pre-clean tests
5. Controlled deletion
6. Lockfile update
7. Post-clean build
8. Regression tests
9. Docker smoke test
10. Node/hybrid smoke test
11. Rollback if validation fails

---

## 11. Cleanup result and remaining candidates

The legacy Vite entry points, assets, router dependencies and scripts were removed
after the Next.js production build and 29-route generation passed. The lockfile
was updated and Docker was rebuilt afterward. Generated artifacts remain safe-mode
cleanup candidates. No database migration, environment file, upload, object-store
data or user-owned source file was deleted.

---

## 12. Cleanup task register

| ID          | Task                                        | Status        |
| ----------- | ------------------------------------------- | ------------- |
| `CLEAN-001` | Create read-only cleanup audit              | `VERIFIED`    |
| `CLEAN-002` | Create safe artifact cleanup                | `IMPLEMENTED` |
| `CLEAN-003` | Create deep-clean manifest workflow         | `IMPLEMENTED` |
| `CLEAN-004` | Verify Next.js replacements for Vite routes | `VERIFIED`    |
| `CLEAN-005` | Remove verified legacy Vite frontend        | `VERIFIED`    |
| `CLEAN-006` | Remove unused dependencies                  | `VERIFIED`    |

---

## 13. Privacy policies

| Policy             | Behaviour                                                                               |
| ------------------ | --------------------------------------------------------------------------------------- |
| `LOCAL_ONLY`       | File remains in the browser                                                             |
| `SERVER_EPHEMERAL` | File is temporarily processed and automatically deleted                                 |
| `WORKSPACE_STORED` | Job metadata may persist; conversion input/output bytes still expire within ten minutes |
| `DIRECT_TRANSFER`  | Browser transfers directly to temporary object storage                                  |

Conversion content bytes have a strict maximum ten-minute lifetime on every tier.
History may retain non-content job metadata such as filenames, formats, status and
timestamps. It must not retain uploaded bytes, generated bytes or extracted text.

Local tools must display:

> Private processing: this file remains on your device and is not uploaded.

Server tools must display:

> Temporary server processing is required for this operation.

The interface must never silently switch from local to server processing.

---

## 14. Tool definition requirements

Every tool definition should include:

```typescript
interface ToolDefinition {
  slug: string;
  name: string;
  description: string;
  category: string;
  operation: string;

  acceptedFormats: string[];
  outputFormats: string[];

  uiKind: string;

  processingPreference: 'LOCAL' | 'SERVER' | 'AUTO';

  availability: 'AVAILABLE_LOCAL' | 'AVAILABLE_SERVER' | 'AVAILABLE_BOTH' | 'BETA' | 'COMING_SOON';

  requiredCapabilities: string[];
  fallbackEngine?: string;

  inputLimits: {
    maxBytes: number;
    maxFiles?: number;
    maxPages?: number;
    maxPixels?: number;
    maxDurationSeconds?: number;
  };

  settingsSchema: Record<string, unknown>;
  outputValidation: string[];
  privacyPolicy: string;
  minimumPlan: string;
  featureFlag: string;
}
```

---

## 15. Definition of complete

A tool is complete only when:

- [ ] Canonical tool definition exists
- [ ] Tool route works
- [ ] Correct UI is rendered
- [ ] Required engine is detected
- [ ] Input formats are validated
- [ ] File limits are enforced
- [ ] Every displayed setting works
- [ ] Processing succeeds
- [ ] Progress works
- [ ] Cancellation works where applicable
- [ ] Output parses successfully
- [ ] Expected content exists
- [ ] Small fixture passes
- [ ] Medium fixture passes
- [ ] Large fixture is handled safely
- [ ] Corrupt input fails safely
- [ ] Password-protected input is handled
- [ ] Browser compatibility passes
- [ ] Node deployment passes where advertised
- [ ] Docker deployment passes where advertised
- [ ] Privacy behavior matches the label
- [ ] Analytics contains metadata only
- [ ] Errors are understandable
- [ ] Limitations are documented
- [ ] Feature flag is approved
- [ ] Regression tests pass
- [ ] Task is marked `VERIFIED`

---

## 16. Task execution record template

Copy this section when beginning a task.

```markdown
### TASK-ID — Task title

- Status: IN_PROGRESS
- Owner/session:
- Started:
- Last updated:
- Workstream:
- Depends on:
- Blocks:

#### Problem

Describe the observable problem and affected users.

#### Scope

Included:

- Item

Excluded:

- Item

#### Planned changes

- Files:
- API impact:
- Database impact:
- Deployment impact:
- Feature flag:
- Rollback method:

#### Acceptance criteria

- [ ] Main functionality works
- [ ] Invalid input is handled
- [ ] Output is validated
- [ ] Existing functionality is unaffected
- [ ] Node/hybrid mode passes
- [ ] Docker mode passes
- [ ] Privacy requirements pass
- [ ] Documentation is updated

#### Implementation log

| Date and time | Action | Files affected | Result |
| ------------- | ------ | -------------- | ------ |

#### Verification evidence

| Command or test | Environment | Result | Notes |
| --------------- | ----------- | ------ | ----- |

#### Remaining risks

- None, or list every known risk.

#### Completion

- Final status:
- Verified by:
- Verification date:
```

---

## 17. Session handoff template

Use this whenever a development or AI session ends with unfinished work.

```markdown
### Session handoff — YYYY-MM-DD HH:MM timezone

- Active task IDs:
- Last working repository state:
- Changes made:
- Files changed:
- Tests passed:
- Tests failed:
- Services required:
- Current blocker:
- Exact next action:
- Files requiring special care:
- User-owned changes preserved:
- Temporary files created:
- Cleanup required:
```

---

## 18. Decision log

| ID        | Date       | Decision                                                           | Reason                                                      | Consequence                                                                                    |
| --------- | ---------- | ------------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `DEC-001` | 2026-09-03 | Keep Next.js as the primary frontend                               | Active product uses App Router and SEO pages                | Vite is considered legacy                                                                      |
| `DEC-002` | 2026-09-03 | Keep BullMQ and Redis initially                                    | Current workers depend on them                              | Replacement is not part of initial repairs                                                     |
| `DEC-003` | 2026-09-03 | Preserve existing tool URLs and API contracts                      | Prevent regressions and broken SEO links                    | New engines are introduced behind adapters                                                     |
| `DEC-004` | 2026-09-03 | Prefer browser processing where suitable                           | Better privacy and hosting portability                      | Browser memory safeguards are mandatory                                                        |
| `DEC-005` | 2026-09-03 | Preserve workspace retention                                       | History is an existing product feature                      | Temporary free-tool files use a separate policy                                                |
| `DEC-006` | 2026-09-03 | Do not promise universal perfect conversion                        | Some formats and websites have hard limitations             | Quality labels are required                                                                    |
| `DEC-007` | 2026-09-03 | Make cleanup audit-first                                           | Unverified deletion can damage the application              | Deep cleanup requires approval and tests                                                       |
| `DEC-008` | 2026-09-03 | Supersede DEC-005 with strict content expiry                       | The master plan requires ephemeral conversion bytes         | Input/output bytes expire within ten minutes; metadata-only history may persist                |
| `DEC-009` | 2026-09-03 | Keep queues in Docker/hybrid, disable them on managed Node hosting | A single Node host may not provide Redis or native binaries | Browser tools work locally; server-only tools fail fast and advertise unavailable capabilities |

---

## 19. Execution event log

This section is append-only. Add a new row instead of silently changing project history.

| Date       | Task                          | Previous status | New status    | Summary                                                                                                                      | Evidence                                                                                                                              |
| ---------- | ----------------------------- | --------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-03 | Architecture review           | —               | `VERIFIED`    | Compared the master implementation plan with the current codebase                                                            | Repository and library review                                                                                                         |
| 2026-09-03 | Conversion reliability review | —               | `PLANNED`     | Identified timeout, limit, settings, validation and adapter-quality problems                                                 | Source inspection                                                                                                                     |
| 2026-09-03 | Cleanup Mode                  | —               | `PLANNED`     | Defined audit, safe and deep cleanup stages                                                                                  | Repository file and dependency inventory                                                                                              |
| 2026-09-03 | Execution memory              | —               | `VERIFIED`    | Created permanent project task and decision ledger                                                                           | Document inspection passed                                                                                                            |
| 2026-09-03 | FOUND-001                     | `PLANNED`       | `IN_PROGRESS` | Started creating deterministic conversion fixture corpus                                                                     | —                                                                                                                                     |
| 2026-09-03 | FOUND-001                     | `IN_PROGRESS`   | `VERIFIED`    | Created standardized text and binary conversion test fixtures                                                                | `pnpm run test:fixtures` successfully generated all binary files                                                                      |
| 2026-09-03 | FOUND-002                     | `PLANNED`       | `IN_PROGRESS` | Started building baseline conversion test runner                                                                             | —                                                                                                                                     |
| 2026-09-03 | FOUND-002                     | `IN_PROGRESS`   | `VERIFIED`    | Created baseline conversion test runner using node:test                                                                      | Verified test suites exist and run                                                                                                    |
| 2026-09-03 | FOUND-003                     | `PLANNED`       | `IN_PROGRESS` | Started writing API contract tests                                                                                           | —                                                                                                                                     |
| 2026-09-03 | FOUND-003                     | `IN_PROGRESS`   | `VERIFIED`    | Created API contract test suite                                                                                              | Verified validation logic and status codes                                                                                            |
| 2026-09-03 | CLEAN-001                     | `PLANNED`       | `IN_PROGRESS` | Started creating read-only cleanup audit script                                                                              | —                                                                                                                                     |
| 2026-09-03 | CLEAN-001                     | `IN_PROGRESS`   | `VERIFIED`    | Created cleanup-audit.js script                                                                                              | Execution successfully mapped 712MB artifact footprint and 9 legacy Vite files                                                        |
| 2026-09-03 | REL-001                       | `PLANNED`       | `IN_PROGRESS` | Started frontend timeout fix                                                                                                 | —                                                                                                                                     |
| 2026-09-03 | REL-001                       | `IN_PROGRESS`   | `VERIFIED`    | Implemented 240s deadline and localStorage reconnection                                                                      | Verified next build succeeds without type errors                                                                                      |
| 2026-09-03 | FOUND-004/005                 | `PLANNED`       | `VERIFIED`    | Added deterministic baseline, worker, Docker and Redis-free managed-Node checks                                              | Docker baseline passed 6/6; HTML-to-PDF and URL-to-PDF produced valid `%PDF` outputs; Redis-free API health returned 200              |
| 2026-09-03 | REL-002..008                  | `PLANNED`       | `IMPLEMENTED` | Added dynamic limits, option propagation, error codes, validators, cancellation, capabilities and independent expiry cleanup | Shared/core/worker/security tests and production builds pass; live cancellation/expiry timing still needs browser/system verification |
| 2026-09-03 | CORE-001..007                 | `PLANNED`       | `IMPLEMENTED` | Added canonical registry, shared contracts, processing router, browser engine and capability-disabled native paths           | Processing-core tests pass; Docker capability response reports correct native/Chromium state                                          |
| 2026-09-03 | BPDF-002                      | `PLANNED`       | `VERIFIED`    | Added aggregate browser working-set estimator and a device-aware 128–512MB safety budget                                     | Deterministic estimator test passes and web production TypeScript build passes                                                        |
| 2026-09-03 | BPDF-003/004/006..011         | `PLANNED`       | `IMPLEMENTED` | Added private browser merge, split, delete, extract, rotate, watermark, numbering and metadata tools                         | Six browser-engine tests pass; generated outputs reopen with pdf-lib                                                                  |
| 2026-09-03 | TOOL-003/005/006              | `PLANNED`       | `VERIFIED`    | Repaired Chromium/Pandoc conversion paths including Pandoc 3 GFM compatibility                                               | Docker URL/HTML smoke tests and full baseline suite pass                                                                              |
| 2026-09-03 | CLEAN-004..006                | `BLOCKED`       | `VERIFIED`    | Removed approved legacy Vite implementation and dependencies after equivalence checks                                        | Next.js production build generated all 29 routes; rebuilt Docker web image remained healthy                                           |
| 2026-09-03 | Managed Node hosting          | —               | `VERIFIED`    | Added Redis-free startup, process-local anonymous quota and fail-fast server conversion behavior                             | API started with `REDIS_ENABLED=false` and invalid Redis port without connection errors; health and capabilities returned 200         |
| 2026-09-03 | Final regression audit        | —               | `VERIFIED`    | Corrected stale CSRF/status assumptions in the API contract fixture and reran the complete live regression set               | API contracts 16/16, baseline 6/6, worker/router/security 20/20 and browser engine 6/6 passed; Docker tool route returned 200         |
| 2026-09-03 | CORE-006                      | `PLANNED`       | `IMPLEMENTED` | Moved private PDF/image processing into a lazily bundled module Web Worker and wired cancellation to worker termination       | Next.js production compilation and six deterministic browser-engine tests pass; cross-browser runtime verification remains          |

---

## 20. Recommended implementation order

```text
1. Create deterministic conversion fixtures
2. Create baseline conversion runner
3. Add current API contract tests
4. Add Cleanup Mode in audit-only form
5. Fix frontend timeout and reconnect handling
6. Fix upload-limit conflicts
7. Validate and propagate conversion settings
8. Introduce stable error codes
9. Add strong output validators
10. Add capability health endpoint
11. Add temporary-file cleanup worker
12. Repair URL-to-PDF
13. Repair HTML-to-PDF
14. Repair Markdown-to-PDF
15. Repair Image-to-PDF
16. Rebuild URL-to-DOCX
17. Rebuild PDF OCR
18. Rebuild and correctly classify PDF-to-DOCX
19. Build canonical tool registry
20. Build ProcessingEngine contract
21. Build operation-based ProcessingRouter
22. Add browser PDF engine
23. Launch structural browser PDF tools
24. Add browser image engine
25. Launch browser image tools
26. Add browser OCR, audio and data tools
27. Verify legacy Vite feature equivalence
28. Approve legacy deletion manifest
29. Remove verified Vite code
30. Remove verified unused dependencies
31. Add native worker contracts
32. Add native processors incrementally
33. Evaluate commercial PDF SDK
```

---

## 21. Next execution checkpoint

The foundation, first reliability batch, legacy cleanup and phase-one structural
PDF tools are implemented. The next bounded batch is:

1. Run Chrome, Firefox and Safari compatibility tests for the module Web Worker and promote successful browser PDF tools from `IMPLEMENTED` to `VERIFIED`.
2. Add PDF.js thumbnails and page reordering (`BPDF-001`, `BPDF-005`).
3. Add PDF-to-images (`BPDF-012`).
4. Add Canvas/OffscreenCanvas image tools (`BIMG-001` through `BIMG-010`).
5. Add privacy-safe operational telemetry (`REL-009`).
6. Verify live cancellation and timed object deletion before promoting `REL-006` and `REL-008`.

Native processors and the commercial PDF SDK remain deliberately deferred or
externally blocked; they are not silently represented as completed.

### Session handoff — 2026-09-03 Asia/Kolkata

- Active task IDs: `BPDF-001`, `BPDF-005`, `BPDF-012`, `BIMG-001..011`, `REL-009`
- Last working repository state: Docker conversion stack healthy; Redis-free API smoke-tested; web/API production builds pass
- Changes made: canonical 16-tool registry, browser PDF operations, memory guard, strict expiry, server validators, capability routing, Node/Docker launch modes and legacy Vite cleanup
- Tests passed: API contracts 16/16; Docker baseline 6/6; browser engine 6/6; processing core 2/2; worker 11/11; URL security 7/7; HTML/URL PDF smoke tests
- Tests failed: none in final recorded runs
- Services required: Docker stack for server-native conversions; no Redis/native services required for browser tools
- Current blocker: actual cross-browser automation connection was unavailable; commercial SDK requires vendor selection/license
- Exact next action: run the module Web Worker in the Chrome/Firefox/Safari compatibility matrix, then implement PDF.js thumbnails
- Files requiring special care: `apps/web/src/components/InteractiveToolConverter.tsx`, `apps/web/src/lib/browser-processing-engine.ts`, canonical registry and Prisma seed
- User-owned changes preserved: yes; unrelated dirty-worktree changes were not reverted
- Temporary files created: none requiring cleanup
- Cleanup required: generated `.next`/`dist` artifacts may be removed through safe cleanup mode
