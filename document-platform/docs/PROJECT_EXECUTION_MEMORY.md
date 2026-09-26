# AppToolkitLab Project Execution Memory

**Product:** AppToolkitLab by Gonexel  
**Website:** https://apptoolkitlab.com/  
**Parent company:** https://gonexel.com/  
**Repository:** `document-platform`  
**Purpose:** Permanent record of project plans, active work, completed work, verification evidence, decisions, blockers and remaining tasks.  
**Last updated:** 2026-09-21

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
| Public tools            | Twenty-six canonical tools, including the dedicated browser PDF editor   |
| Tool execution          | Capability-routed browser or queued server workflow                      |

The existence of an adapter does not prove that its output quality is production-ready.

---

## 5. Existing public tools

| ID         | Tool            | Current status | Main problem                                                                                                |
| ---------- | --------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| `TOOL-001` | PDF to DOCX     | `IMPLEMENTED`  | Valid DOCX output is verified; complex layout fidelity is still limited.                                    |
| `TOOL-002` | PDF OCR         | `IMPLEMENTED`  | Native OCR is capability-gated; preprocessing/confidence UX remains.                                        |
| `TOOL-003` | URL to PDF      | `VERIFIED`     | Real Chromium Docker smoke test produced a valid PDF from an external URL.                                  |
| `TOOL-004` | URL to DOCX     | `IMPLEMENTED`  | Semantic HTML-to-DOCX path exists; broader webpage fixture coverage remains.                                |
| `TOOL-005` | HTML to PDF     | `VERIFIED`     | Real Gotenberg smoke test produced a valid PDF.                                                             |
| `TOOL-006` | Markdown to PDF | `VERIFIED`     | GFM-compatible Pandoc path and baseline output test pass.                                                   |
| `TOOL-007` | Image to PDF    | `IMPLEMENTED`  | Multiple PNG/JPEG inputs and page settings pass deterministic tests.                                        |
| `TOOL-008` | Document Editor | `IMPLEMENTED`  | Existing editor/export remains available; unified export coverage remains.                                  |
| `TOOL-017` | PDF Text Editor | `IMPLEMENTED`  | Direct editing works for selectable text; scanned pages require OCR and cross-browser verification remains. |

### Phase-one private browser PDF tools

The canonical registry also exposes merge, split, extract pages, delete pages,
rotate, watermark, add page numbers, edit metadata, organize, alternate/mix,
crop, resize, N-up, header/footer, Bates numbering and form flattening. Their
processing code and deterministic package-level tests pass. They remain
`IMPLEMENTED` until an actual
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
| `BPDF-001` | PDF.js viewer and thumbnails | `IMPLEMENTED` |
| `BPDF-002` | Browser memory estimator     | `VERIFIED`    |
| `BPDF-003` | Merge PDF                    | `IMPLEMENTED` |
| `BPDF-004` | Split PDF                    | `IMPLEMENTED` |
| `BPDF-005` | Organize PDF                 | `IMPLEMENTED` |
| `BPDF-006` | Delete PDF pages             | `IMPLEMENTED` |
| `BPDF-007` | Extract PDF pages            | `IMPLEMENTED` |
| `BPDF-008` | Rotate PDF                   | `IMPLEMENTED` |
| `BPDF-009` | Watermark PDF                | `IMPLEMENTED` |
| `BPDF-010` | Add page numbers             | `IMPLEMENTED` |
| `BPDF-011` | PDF metadata tools           | `IMPLEMENTED` |
| `BPDF-012` | PDF to images                | `PLANNED`     |
| `BPDF-013` | Direct PDF text editor       | `IMPLEMENTED` |
| `BPDF-014` | Alternate and mix PDF        | `IMPLEMENTED` |
| `BPDF-015` | Crop PDF                     | `IMPLEMENTED` |
| `BPDF-016` | Resize PDF                   | `IMPLEMENTED` |
| `BPDF-017` | N-up PDF                     | `IMPLEMENTED` |
| `BPDF-018` | Header and footer            | `IMPLEMENTED` |
| `BPDF-019` | Bates numbering              | `IMPLEMENTED` |
| `BPDF-020` | Flatten PDF forms            | `IMPLEMENTED` |
| `BPDF-021` | Workspace tools catalog      | `IMPLEMENTED` |

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

| Date       | Task                          | Previous status | New status    | Summary                                                                                                                                                                                                                                      | Evidence                                                                                                                                                                                                                                      |
| ---------- | ----------------------------- | --------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-03 | Architecture review           | —               | `VERIFIED`    | Compared the master implementation plan with the current codebase                                                                                                                                                                            | Repository and library review                                                                                                                                                                                                                 |
| 2026-09-03 | Conversion reliability review | —               | `PLANNED`     | Identified timeout, limit, settings, validation and adapter-quality problems                                                                                                                                                                 | Source inspection                                                                                                                                                                                                                             |
| 2026-09-03 | Cleanup Mode                  | —               | `PLANNED`     | Defined audit, safe and deep cleanup stages                                                                                                                                                                                                  | Repository file and dependency inventory                                                                                                                                                                                                      |
| 2026-09-03 | Execution memory              | —               | `VERIFIED`    | Created permanent project task and decision ledger                                                                                                                                                                                           | Document inspection passed                                                                                                                                                                                                                    |
| 2026-09-03 | FOUND-001                     | `PLANNED`       | `IN_PROGRESS` | Started creating deterministic conversion fixture corpus                                                                                                                                                                                     | —                                                                                                                                                                                                                                             |
| 2026-09-03 | FOUND-001                     | `IN_PROGRESS`   | `VERIFIED`    | Created standardized text and binary conversion test fixtures                                                                                                                                                                                | `pnpm run test:fixtures` successfully generated all binary files                                                                                                                                                                              |
| 2026-09-03 | FOUND-002                     | `PLANNED`       | `IN_PROGRESS` | Started building baseline conversion test runner                                                                                                                                                                                             | —                                                                                                                                                                                                                                             |
| 2026-09-03 | FOUND-002                     | `IN_PROGRESS`   | `VERIFIED`    | Created baseline conversion test runner using node:test                                                                                                                                                                                      | Verified test suites exist and run                                                                                                                                                                                                            |
| 2026-09-03 | FOUND-003                     | `PLANNED`       | `IN_PROGRESS` | Started writing API contract tests                                                                                                                                                                                                           | —                                                                                                                                                                                                                                             |
| 2026-09-03 | FOUND-003                     | `IN_PROGRESS`   | `VERIFIED`    | Created API contract test suite                                                                                                                                                                                                              | Verified validation logic and status codes                                                                                                                                                                                                    |
| 2026-09-03 | CLEAN-001                     | `PLANNED`       | `IN_PROGRESS` | Started creating read-only cleanup audit script                                                                                                                                                                                              | —                                                                                                                                                                                                                                             |
| 2026-09-03 | CLEAN-001                     | `IN_PROGRESS`   | `VERIFIED`    | Created cleanup-audit.js script                                                                                                                                                                                                              | Execution successfully mapped 712MB artifact footprint and 9 legacy Vite files                                                                                                                                                                |
| 2026-09-03 | REL-001                       | `PLANNED`       | `IN_PROGRESS` | Started frontend timeout fix                                                                                                                                                                                                                 | —                                                                                                                                                                                                                                             |
| 2026-09-03 | REL-001                       | `IN_PROGRESS`   | `VERIFIED`    | Implemented 240s deadline and localStorage reconnection                                                                                                                                                                                      | Verified next build succeeds without type errors                                                                                                                                                                                              |
| 2026-09-03 | FOUND-004/005                 | `PLANNED`       | `VERIFIED`    | Added deterministic baseline, worker, Docker and Redis-free managed-Node checks                                                                                                                                                              | Docker baseline passed 6/6; HTML-to-PDF and URL-to-PDF produced valid `%PDF` outputs; Redis-free API health returned 200                                                                                                                      |
| 2026-09-03 | REL-002..008                  | `PLANNED`       | `IMPLEMENTED` | Added dynamic limits, option propagation, error codes, validators, cancellation, capabilities and independent expiry cleanup                                                                                                                 | Shared/core/worker/security tests and production builds pass; live cancellation/expiry timing still needs browser/system verification                                                                                                         |
| 2026-09-03 | CORE-001..007                 | `PLANNED`       | `IMPLEMENTED` | Added canonical registry, shared contracts, processing router, browser engine and capability-disabled native paths                                                                                                                           | Processing-core tests pass; Docker capability response reports correct native/Chromium state                                                                                                                                                  |
| 2026-09-03 | BPDF-002                      | `PLANNED`       | `VERIFIED`    | Added aggregate browser working-set estimator and a device-aware 128–512MB safety budget                                                                                                                                                     | Deterministic estimator test passes and web production TypeScript build passes                                                                                                                                                                |
| 2026-09-03 | BPDF-003/004/006..011         | `PLANNED`       | `IMPLEMENTED` | Added private browser merge, split, delete, extract, rotate, watermark, numbering and metadata tools                                                                                                                                         | Six browser-engine tests pass; generated outputs reopen with pdf-lib                                                                                                                                                                          |
| 2026-09-03 | TOOL-003/005/006              | `PLANNED`       | `VERIFIED`    | Repaired Chromium/Pandoc conversion paths including Pandoc 3 GFM compatibility                                                                                                                                                               | Docker URL/HTML smoke tests and full baseline suite pass                                                                                                                                                                                      |
| 2026-09-03 | CLEAN-004..006                | `BLOCKED`       | `VERIFIED`    | Removed approved legacy Vite implementation and dependencies after equivalence checks                                                                                                                                                        | Next.js production build generated all 29 routes; rebuilt Docker web image remained healthy                                                                                                                                                   |
| 2026-09-03 | Managed Node hosting          | —               | `VERIFIED`    | Added Redis-free startup, process-local anonymous quota and fail-fast server conversion behavior                                                                                                                                             | API started with `REDIS_ENABLED=false` and invalid Redis port without connection errors; health and capabilities returned 200                                                                                                                 |
| 2026-09-03 | Final regression audit        | —               | `VERIFIED`    | Corrected stale CSRF/status assumptions in the API contract fixture and reran the complete live regression set                                                                                                                               | API contracts 16/16, baseline 6/6, worker/router/security 20/20 and browser engine 6/6 passed; Docker tool route returned 200                                                                                                                 |
| 2026-09-03 | CORE-006                      | `PLANNED`       | `IMPLEMENTED` | Moved private PDF/image processing into a lazily bundled module Web Worker and wired cancellation to worker termination                                                                                                                      | Next.js production compilation and six deterministic browser-engine tests pass; cross-browser runtime verification remains                                                                                                                    |
| 2026-09-06 | Public-page layout audit      | —               | `VERIFIED`    | Removed duplicated fixed-header spacing, normalized public hero rhythm and body copy, and moved crowded tablet navigation to the mobile menu                                                                                                 | Next.js production build generated 29 routes; 30 root, detail, legal, authentication and workspace URLs returned HTTP 200; diff check passed                                                                                                  |
| 2026-09-06 | Tool-detail responsive repair | —               | `VERIFIED`    | Rebuilt the shared `/tools/[slug]` layout and converter shell with explicit centered containers, responsive option grids, consistent section rhythm, and mobile overflow protection                                                          | Formatting, lint (warnings only), browser-processing tests 6/6, local and Docker production builds passed; all 16 registered tool-detail URLs returned HTTP 200                                                                               |
| 2026-09-10 | UI and runtime route repair   | —               | `VERIFIED`    | Fixed shared navigation/workspace responsiveness, landmarks, focus states, catalog failure copy, PDF editor dependency resolution and development runtime 500s                                                                               | Chrome checked six representative page families; 46 public, tool, auth, workspace and SEO routes returned HTTP 200; web production build passed                                                                                               |
| 2026-09-10 | Commerce security remediation | `PLANNED`       | `IMPLEMENTED` | Added atomic order fulfillment, encrypted usable license delivery, exact return-origin checks, customer-bound Razorpay verification, cart preservation and stronger CSRF/IP handling                                                         | Prisma validation, API build and full monorepo tests pass; dedicated concurrent webhook and license lifecycle E2E coverage remains                                                                                                            |
| 2026-09-15 | BPDF-013 direct text editing  | `PLANNED`       | `IMPLEMENTED` | Rebuilt the PDF editor as an in-place text workspace with selectable PDF.js text runs, direct replacement, bold/italic/size/color controls, delete, annotations, undo/redo and PDF export; corrected inaccurate image/DOCX capability claims | Tool-registry build, web lint and Next.js production build pass; isolated Chrome fixture test found 3 editable areas, changed rendered text, downloaded `basic-edited.pdf`, reopened it with PDF.js and confirmed the replacement text exists |
| 2026-09-15 | PDF editor spacing repair     | `DISCOVERED`    | `VERIFIED`    | Removed the unlayered universal margin/padding reset that overrode Tailwind spacing utilities, restoring centered canvas, toolbar spacing and property-panel layout                                                                          | Before/after Chrome screenshots inspected at 1440x1000; fixture interaction test still passes after the CSS correction                                                                                                                        |

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

The foundation, first reliability batch, legacy cleanup, visual page workspace
and the expanded structural PDF batch are implemented. The next bounded batch is:

1. Run Chrome, Firefox and Safari compatibility tests for the module Web Worker and promote successful browser PDF tools from `IMPLEMENTED` to `VERIFIED`.
2. Add PDF-to-images (`BPDF-012`) and validate real browser downloads.
3. Add the isolated qpdf/Ghostscript/OCRmyPDF native worker before publishing compression, security, repair or searchable-OCR tools.
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

### Session handoff — 2026-09-06 Asia/Kolkata

- Active task IDs: cross-browser visual compatibility audit
- Last working repository state: production web build passes and all 30 audited routes return HTTP 200
- Changes made: one shared header offset, reduced hero whitespace, readable card copy, stable desktop/tablet/mobile navigation breakpoints
- Tests passed: Next.js production build, all-route response audit, formatting and diff integrity
- Tests failed: Docker rebuild could not refresh base-image metadata because Docker Hub timed out; local production verification replaced it
- Current blocker: macOS Computer Use permission is not granted, so screenshot-level Chrome/Safari comparison cannot be recorded
- Exact next action: grant Computer Use permission and visually inspect representative desktop/mobile routes before marking cross-browser visual QA complete
- User-owned changes preserved: yes

### Tool-detail page repair — 2026-09-06 Asia/Kolkata

- Scope: every dynamic route rendered by `apps/web/src/app/tools/[slug]/page.tsx`
- Routes covered: merge, split, extract, delete, rotate, watermark, page numbering, metadata, PDF-to-DOCX, OCR, URL-to-PDF, URL-to-DOCX, HTML-to-PDF, Markdown-to-PDF, image-to-PDF and document studio
- Layout changes: full-width page canvas, centered 68rem converter, centered 72rem information sections, three-column steps, two-column features, consistent FAQ cards, balanced upgrade banner and single-column mobile fallbacks
- Converter changes: wrapping quota bar, stable content padding, full-width drop zone, responsive option controls, long-copy overflow protection and mobile-safe call-to-action layout
- Functional impact: none; upload, browser worker, server job, polling, quota and download behavior were preserved
- Verification: Prettier passed; web lint completed with pre-existing warnings only; browser-processing suite passed 6/6; host and Docker Next.js builds generated all 29 routes; all 16 tool URLs returned HTTP 200 after the Docker web image was rebuilt
- Visual QA limitation: macOS Computer Use permission remains unavailable, so automated screenshot comparison could not be captured; the user can refresh the already-running Docker site at `http://localhost:5173/tools/rotate-pdf`

### PDF fidelity repair and full project audit — 2026-09-10 Asia/Kolkata

- Scope: PDF-to-DOCX fidelity, Node/Docker parity and repository-wide architecture, product, security and test audit
- Root cause: the reduced-quality PDF path extracted plain text and rebuilt paragraphs, necessarily losing geometry, fonts, images and tables; the partial layout-aware implementation invoked system Python instead of the isolated `pdf2docx` environment
- Changes made: worker now invokes the configurable `pdf2docx` CLI with a timeout, buffer limit and DOCX package validation; explicit `pdf2docx` mode fails visibly instead of silently degrading; Docker worker is configured to use `/usr/local/bin/pdf2docx`
- Tests passed: complete monorepo production build; URL security 7/7; processing core 2/2; worker 11/11; API router 5/5; browser processing 6/6; real local PDF-to-DOCX conversion; Docker worker rebuild; real in-container PDF-to-DOCX conversion produced a valid OOXML archive
- Audit result: architecture is fundamentally sound, but the complete SaaS/marketplace is not production-ready; critical gaps include unusable masked-only license delivery, non-atomic fulfillment, missing recurring subscriptions/admin/billing/team applications and managed-Node conversion capability mismatch
- Security result: production dependency audit reports 23 findings (1 critical, 12 high, 7 moderate, 3 low); CSRF origin, forwarded-IP trust, checkout ownership/redirects, upload scanning and production secret defaults require hardening
- Durable audit: `docs/PROJECT_AUDIT_2026-09-10.md`
- Deployment result: both full native Node and Docker worker designs are supported; restricted managed Node mode cannot run queued/native conversion tools without a separate worker service
- Next action: repair atomic license fulfillment and payment security before enabling marketplace sales, then select and validate the production deployment topology

### UI, route and commerce hardening — 2026-09-10 Asia/Kolkata

- Scope: all public page families, dynamic tool pages, authentication pages, workspace routes, PDF editor runtime, converter recovery, checkout fulfillment and customer license delivery
- Runtime defects fixed: undeclared direct PDF.js worker dependency and an enabled optional CSS optimizer without `critters`; both had caused development-only HTTP 500 responses despite a successful webpack production build
- UI changes: exact fixed-header offset, centered shared content widths, tablet-safe navigation breakpoint, mobile workspace navigation, single root main landmark, skip link, keyboard focus indicators and reduced-motion support
- Commerce changes: exact checkout origin allowlist, authenticated Razorpay order binding, serializable fulfillment claim, transaction-scoped license issuance, encrypted full-key delivery and cart clearing only after payment
- Tests passed: Prisma schema validation; API build; Next.js production build; full monorepo tests (URL security 7/7, processing core 2/2, worker 11/11, API router 5/5, browser PDF 6/6); lint command
- Live verification: 46/46 routes returned HTTP 200, including all 17 tool URLs, PDF editor, five workspace routes, legal/auth pages and SEO files
- Visual verification: Chrome screenshots inspected tools directory, Rotate PDF detail, software, automations, SaaS and pricing at desktop width; spacing, centering and shared navigation were consistent
- Remaining production work: subscriptions/admin, dependency audit remediation, malware scanning, organization-level authorization, engine-by-engine readiness and dedicated payment/license concurrency E2E tests
- User-owned changes preserved: yes; no unrelated changes were reverted

### Session handoff — 2026-09-15 Asia/Kolkata

- Active task IDs: `BPDF-013`, followed by `BPDF-001`, `BPDF-005`, `BPDF-012`, `BIMG-001..011`, `REL-009`
- Last working repository state: PDF direct-text editor compiles and passes an isolated Chrome interaction test; Docker Desktop is stopped, so the updated image has not yet been rebuilt
- Changes made: selectable PDF.js text hit areas, direct in-place replacement, text formatting bar, selected-text properties, standard-font bold/italic export, accurate local-only capability claims, scanned-page guidance and global Tailwind spacing repair
- Files changed: `apps/web/src/app/tools/pdf-editor/pdf-editor-content.tsx`, `apps/web/src/index.css`, `apps/web/src/lib/tools-registry.ts`, `packages/tool-registry/src/index.ts`, `docs/PROJECT_EXECUTION_MEMORY.md`
- Tests passed: tool-registry TypeScript build; web lint; Next.js production build; Chrome fixture E2E found 3 editable text areas, opened the inline input and formatting controls, changed text to `Edited in place`, downloaded the edited PDF, reopened it with PDF.js and confirmed the replacement text
- Tests failed: Docker web rebuild could not start because the Docker daemon socket was absent
- Services required: none for the private browser editor; Docker Desktop is required only to refresh the Docker deployment image
- Current blocker: full Firefox/Safari and complex-font PDF compatibility are not yet verified; image-only scans require OCR before existing text can be selected
- Exact next action: rebuild the web image when Docker is running, then add an export-download assertion and run the compatibility fixture matrix before promoting `BPDF-013` to `VERIFIED`
- Files requiring special care: PDF coordinate transforms and font substitution in `pdf-editor-content.tsx`; global reset behavior in `index.css`
- User-owned changes preserved: yes; no unrelated dirty-worktree files were reverted
- Temporary files created: `/private/tmp/pdf-editor-e2e.mjs` and `/private/tmp/pdf-editor-direct-edit.png`
- Cleanup required: temporary E2E artifacts may be removed after review

### Sejda-class PDF expansion batch — 2026-09-16 Asia/Kolkata

- Scope: quality-gated PDF catalog expansion without regressing the existing 17 tools
- Registry result: canonical catalog expanded from 17 to 26 published tools; every newly published tool has a real processing route
- New private browser tools: Organize PDF, Alternate & Mix, Crop PDF, Resize PDF, N-up PDF, Header & Footer, Bates Numbering and Flatten Forms
- New server tool: Word to PDF using the existing LibreOffice/Gotenberg conversion route and deployment capability gate
- Workspace changes: added authenticated `/app/tools` catalog, searchable categories, browser/server privacy labels and an All Tools sidebar entry
- Shared page UX: added PDF.js thumbnails, page count, selectable thumbnails, drag/keyboard reordering and a 60-thumbnail responsiveness guard while retaining manual full-document ranges
- Reliability repair: live development QA found `DOMMatrix is not defined` from server-evaluating the thumbnail renderer; the component now loads client-only and the affected tool routes return HTTP 200
- Tests passed: browser engine 12/12; URL security 7/7; processing core 2/2; worker 11/11; API router 5/5; tool-registry build; web lint; web production build; API production build; repository diff check
- Output assertions: generated PDFs reopen successfully; organize duplication, unequal-document mixing, crop geometry, A4/Letter dimensions, N-up sheet count, header/footer, Bates numbering and AcroForm flattening are covered
- Visual QA: headless Chrome screenshots inspected the 26-tool directory plus Resize and Organize tool pages at 1440x1200; layout and converter spacing are consistent
- Intentionally not published: compress, protect/unlock, repair, advanced OCR, advanced split variants, PDF-to-Office additions and commercial-SDK features until their native engines and golden fixtures pass
- Services required: none for the eight new private browser tools; Word to PDF requires the existing native worker plus Gotenberg
- Current blocker: Docker daemon is stopped, so the updated Docker image and real Word-to-PDF container path were not rebuilt in this batch
- Exact next action: implement and validate the isolated qpdf/Ghostscript/OCRmyPDF worker, then publish compression/security/repair tools one by one
- User-owned changes preserved: yes; PDF-editor and global CSS work from the preceding session were retained

### Tool-page visual system polish — 2026-09-16 Asia/Kolkata

- Scope: the shared `/tools/[slug]` template and converter used by all 26 published tool routes
- Hero changes: reduced excess vertical space and added consistent privacy, file-limit and output-format trust indicators
- Workspace changes: centered upload content, improved visual hierarchy, ordered multi-file list with move/remove controls and responsive option layout
- Result changes: replaced the generic completion block with named output cards, direct download actions and a clearer conversion reset action
- Content changes: converted FAQs into compact accessible accordions and added category-matched related-tool cards to every applicable page
- Functional impact: browser/server processing, quota, upload, polling, cancellation and download behavior remain unchanged
- Verification: Prettier, web lint, Next.js production build and repository diff check passed
- Visual QA: headless Chrome full-page inspection of Merge PDF confirmed consistent hero, converter, steps, capabilities, FAQ and related-tools composition at desktop width
- Responsive implementation: mobile fallbacks cover stacked trust indicators, one-column cards, wrapped result actions and compact FAQ spacing
- User-owned changes preserved: yes; no unrelated files or prior PDF-editor behavior were reverted

### Server-tool availability and localhost session repair — 2026-09-17 Asia/Kolkata

- User-visible failure: server-backed tool pages showed `Server quota unavailable` and `Cannot read properties of null (reading 'error')`
- Root cause 1: only the Docker web container was running; API, worker, PostgreSQL, Redis, MinIO and Gotenberg had been stopped for roughly 47 hours, so Next.js could not resolve the internal `api` hostname
- Root cause 2: the converter parsed an empty proxy response as `null` and then dereferenced `error`, masking the actual service-unavailable condition
- Root cause 3: production-mode Docker marked anonymous and refresh cookies `Secure` even when the public development URL was plain `http://localhost`, preventing browser persistence needed for job ownership, polling and downloads
- Code changes: server conversion submission now uses the shared defensive API client; cookie security follows `COOKIE_SECURE` or the configured public URL protocol instead of `NODE_ENV` alone
- Runtime repair: rebuilt the web, API and worker images and restored PostgreSQL, Redis, MinIO, Gotenberg, API, worker and web containers
- Verification: all Docker services healthy; web-to-API health and anonymous quota endpoints return 200; anonymous cookie is HttpOnly/SameSite without Secure on localhost
- End-to-end proof: PDF-to-DOCX fixture reached `COMPLETED` and returned a protected DOCX download URL; URL-to-PDF for `https://example.com/` reached `COMPLETED` using the Chromium engine
- Deployment rule: set `COOKIE_SECURE=true` when the public site is served over HTTPS; local Docker explicitly uses `false`

### Permanent full-stack lifecycle repair — 2026-09-17 Asia/Kolkata

- Repeated symptom: the public website remained available while every server dependency was stopped, causing all server-backed PDF, Office, OCR and URL tools to return temporary-service errors
- Confirmed lifecycle root cause: backend containers were explicitly stopped and Docker's former `unless-stopped` policy remembered that state; later starting only `docconv-web` produced a healthy-looking frontend with an unresolvable internal `api` hostname
- Docker policy change: PostgreSQL, Redis, MinIO, Gotenberg, API, worker and web now use `restart: always`, allowing the full platform to return after Docker Desktop or host restarts
- Dependency-health change: the web container health check now verifies both its own page and the internal API; a frontend-only stack is no longer reported healthy
- Startup contract: root `pnpm start` and `pnpm docker:up` execute `scripts/start-platform.mjs`, which checks Docker, starts the entire Compose graph, waits for service health and verifies the browser-facing API proxy
- Recovery command: `corepack pnpm docker:repair` starts and validates all existing images without a rebuild
- Documentation: README warns against `docker start docconv-web` and records the canonical full-stack start and repair commands
- Recovery proof: the new repair command was executed against the exact broken state and restored every dependency; all long-running services and the web-to-API chain reached healthy state
- Conversion proof: a new anonymous PDF-to-DOCX job submitted through `localhost:5173/api/v1` reached `COMPLETED` after the lifecycle repair

### PDF export fidelity and new conversion routes — 2026-09-18 Asia/Kolkata

- Scope: PDF-to-Word output fidelity plus production PDF-to-Markdown and PDF-to-Image tools
- Word fidelity contract: the PDF-to-Word page now exposes `Editable layout` and `Exact visual` modes instead of promising an impossible single-mode combination of perfect fixed positioning and freely reflowable text
- Editable mode: continues to use isolated `pdf2docx` layout reconstruction for text, images, columns, shapes and supported tables; OCR remains the fallback for image-only pages
- Exact visual mode: Poppler renders every PDF page at 180 DPI and the worker anchors it to a zero-margin, same-sized Word page; this preserves appearance and positioning precisely, while intentionally making page text non-editable
- Markdown tool: added `/tools/pdf-to-markdown`, server routing, database seed metadata and structured normalization for headings, lists, page boundaries and OCR-extracted content
- Image tool: added `/tools/pdf-to-images` with private browser rendering, PNG/JPG choices and 96/150/300 DPI output for every source page
- UI: added format-specific labels, Word fidelity guidance, image-resolution controls, presentation content, directory entries and footer links
- Verification: shared types, worker and Next.js production builds passed; worker 13/13 and browser engine 12/12 tests passed; exact-visual DOCX test confirmed embedded page media; Docker images rebuilt; all services healthy; 27 tools reseeded
- End-to-end proof: exact-visual PDF-to-DOCX and PDF-to-Markdown jobs both reached `COMPLETED`; both new public tool routes returned HTTP 200
- Browser QA limitation: the computer-use browser surface was unavailable, so PDF-to-Image was verified by production compilation and the browser engine integration rather than a UI-driven file upload in this session

### Fixed-position editable Word export — 2026-09-18 Asia/Kolkata

- User need: retain the visual positioning of Exact Visual mode while allowing individual text edits in Word
- New mode: `Fixed editable — precise positioned text` is now the default PDF-to-Word choice; the existing reflowable Editable Layout and non-editable Exact Visual modes remain available
- Engine: PyMuPDF removes only detected PDF text objects from a preserved page-artwork layer, then generates editable Word VML text boxes at each original line coordinate
- Formatting: font family, size, color, bold and italic properties are mapped per extracted span; PDF base fonts map to metrically compatible Office fonts to avoid unintended serif substitution
- Compatibility controls: text boxes include edit-width tolerance for font substitution, expanded ascent/descent space to prevent clipping and zero-margin same-sized Word sections
- Verification: generated DOCX contains editable text-box XML and preserved page artwork; LibreOffice reopened and rendered it successfully; worker suite passed 14/14; web, worker and shared-type production builds passed
- End-to-end proof: the rebuilt Docker stack completed fixed-editable job `e144183c-4e64-462d-8f93-bb38fad595d0`; API, web and infrastructure services are healthy
- Known limit: scanned PDFs without a real text layer require OCR, and highly decorative/custom fonts can still use a metrically close substitute unless the original font is installed on the worker and viewer

### Microsoft Word DOCX compatibility repair — 2026-09-18 Asia/Kolkata

- User-visible failure: fixed-editable exports were valid ZIP packages and opened in LibreOffice, but Microsoft Word for macOS rejected them as damaged files
- Root cause 1: the generated `wp:anchor` placed `wp:wrapNone` before the required `wp:extent`, which violates the Wordprocessing Drawing child order that Word enforces
- Root cause 2: every editable VML text box referenced `_x0000_t202`, but the document never declared that shape type; LibreOffice silently repaired the missing definition while Word did not
- Permanent generator fix: page anchors now emit the ECMA-376-compatible child order and the first text-box run declares the shared VML text-box shape type with unique Office shape IDs
- Regression coverage: the worker test now asserts both the `_x0000_t202` declaration and `wp:extent` before `wp:wrapNone`
- Verification: archive and XML validation passed; worker build and all 14 worker tests passed; Microsoft Word for macOS opened the regenerated DOCX and exposed the exported lines as editable text boxes without a recovery warning
- Runtime note: Docker Desktop was stopped before this repair, so no containers were started or rebuilt; the corrected source will be used by the next normal platform build/start

### Persistent AI project memory — 2026-09-19 Asia/Kolkata

- Scope: production persistent project-aware assistant memory without changing document conversion, marketplace or existing public tool behavior
- Architecture: new NestJS `AiMemoryModule`, PostgreSQL/Prisma project-conversation-message-memory-summary models, existing BullMQ/Redis maintenance queue, provider-neutral OpenAI-compatible server adapter and a dedicated context builder
- Memory behavior: explicit and automatic source types, structured extraction validation, secret rejection, project/user visibility, active-only retrieval, lexical/embedding ranking, configurable budgets, duplicate convergence, supersession history, provenance and soft deletion
- Security: every operation revalidates live organization membership and project scope; conversations remain owner-scoped; stored memory is delimited as untrusted data; vectors and provider credentials are not returned to the browser
- UI: added `/app/assistant` for projects and conversations and `/app/memory` for summary, search, filters, creation, editing, pinning, archiving, deletion and provenance
- Operations: `corepack pnpm start` applies the additive memory migration, builds current sources and starts the full healthy Docker graph; manual memory works without AI credentials while chat/extraction/embeddings/summaries clearly remain provider-dependent
- Tests passed: API memory/core 9/9 plus routing 5/5; live memory API 7/7; existing API contracts 16/16; URL security 7/7; processing core 2/2; worker 14/14; browser processing 12/12; NestJS and Next.js production builds
- Live proof: later-conversation UTC retrieval, two-organization direct-ID isolation, cross-project exclusion, exact duplicate convergence, 30-to-60-second supersession, archived/deleted exclusion, prompt-injection containment, secret rejection and message durability during provider outage all passed against PostgreSQL
- Remaining provider validation: automatic LLM extraction, generated session/project summaries and semantic embeddings require a real server-side `AI_API_KEY`; no credential was present, so those paths are compiled and failure-tested but not claimed as live-model validated
- User-owned changes preserved: yes; existing dirty-worktree conversion, PDF editor, UI and marketplace changes were not reverted

### PDF-to-image missing-glyph repair — 2026-09-19 Asia/Kolkata

- User-visible failure: PDF-to-Image preserved the page geometry and colours, but rendered document text as empty square glyphs
- Initial diagnosis: browser PDF.js calls configured only the worker script; required standard-font files, Adobe CMaps, ICC profiles and image-decoder WASM assets were neither published by Next.js nor passed to `getDocument`; publishing these assets was necessary but did not fix the reported PDF
- Confirmed root cause: the reported resume embeds subset Type 1C/CFF fonts; PDF.js font-face mode parsed them but registered unusable browser glyphs, producing squares even with every runtime resource available
- Confirmed repair: PDF.js glyph-path rendering (`disableFontFace: true`, `useSystemFonts: false`) rendered the exact source PDF correctly and remains compatible with OffscreenCanvas
- Permanent asset lifecycle: `apps/web/scripts/copy-pdfjs-assets.mjs` copies the version-matched resources from `pdfjs-dist` before both development and production builds; generated assets remain out of source control
- Shared renderer contract: conversion, tool-page thumbnails and the PDF editor now use the same `PDFJS_DOCUMENT_OPTIONS`, including glyph-path rendering and complete runtime resource URLs
- Regression coverage: browser processing suite now asserts the complete PDF.js runtime configuration and passes 13/13
- Build verification: Next.js production compilation and type checking passed; web lint completed with only three pre-existing assistant/memory warnings; repository diff check passed
- Exact-file visual proof: `Ramaniranjan_resume up.pdf` reproduced the defect under font-face rendering and rendered all names, headings and body text correctly under glyph-path rendering at the same 1241 x 1754 output size
- Deployment verification: Docker web image rebuilt with the corrected renderer; web and API containers are healthy; the live route returns HTTP 200 and the running container contains `disableFontFace: true` and `useSystemFonts: false`

### Universal-font PDF-to-image engine — 2026-09-19 Asia/Kolkata

- Goal: make PDF-to-PNG/JPG reliable for embedded, subset and uncommon fonts while retaining a no-upload mode
- Default engine: the tool now uses the native Poppler renderer and returns a validated ZIP containing every page in numeric order; PNG and high-quality JPG are supported at 96, 150 and 300 DPI
- Font coverage: Poppler consumes embedded Type 1, Type 1C/CFF, TrueType and OpenType font programs directly; the worker also installs Fontconfig plus Noto, Noto CJK, Noto Emoji, Liberation and DejaVu fallbacks for PDFs that omit required fonts
- Privacy fallback: users can explicitly select the private browser renderer, which uses PDF.js glyph paths with font-face installation disabled
- API contract: public PNG/JPG selections remain unchanged; the API internally routes multi-page output to `OutputFormat.ZIP`, preserves the selected image format and exposes the real archive filename in job status
- Integrity controls: the worker rejects an empty render, an excessive page count, empty archive entries, unexpected archive file types and invalid ZIP output before marking a job complete
- UI: added a rendering-engine selector with Universal compatibility as the recommended default, accurate temporary-processing language and ZIP result naming
- Automated verification: shared types, router, tool registry, worker, API and Next.js builds passed; worker suite passes 15/15 including PNG and JPG Poppler archives; router suite passes 6/6; browser PDF suite passes 13/13
- Exact-file proof: the previously failing `Ramaniranjan_resume up.pdf` completed through the anonymous API, Redis queue, native worker and MinIO download; the validated archive contained a 1241 x 1754 PNG with all original text and custom subset fonts rendered correctly, and a second JPG export completed after the expanded font image was deployed
- Native runtime contract: `node:doctor` now verifies `fc-match`; the rebuilt worker exposes 317 font faces and resolves generic sans-serif plus Noto CJK successfully
- Runtime state: database reseeded with 27 tools; API, worker, web, PostgreSQL, Redis, MinIO and Gotenberg are running, and `/tools/pdf-to-images` plus the API health endpoint return HTTP 200
- Honest limit: no renderer can guarantee recovery of a damaged, encrypted-without-password or intentionally malformed PDF; those documents must be unlocked or repaired before rendering

### Re-audit completion and live acceptance — 2026-09-21 Asia/Kolkata

- **Migration chain — VERIFIED**:
  - Added forward-only migrations for refresh-token families and conversion outbox/usage fields without rewriting prior migrations.
  - `scripts/test-migrations.mjs` creates isolated PostgreSQL databases and verifies both a completely fresh `migrate deploy` plus seed and a current-schema `db push` adoption followed by `migrate deploy`.
  - The guarded `db:adopt` path fails on subprocess errors, refuses any non-empty/partial migration history, requires backup confirmation for mutation and changes history only after Prisma reports zero live-schema differences.
  - Live result: `Fresh and adopted database migration paths passed.`
- **Database initialization — VERIFIED**:
  - Docker uses a one-shot `db-init` service and starts API/worker only after migration and the idempotent seed complete successfully.
  - Live seed result: 3 subscription plans, 27 tool definitions, the anonymous identity/organization and initial marketplace records exist.
  - `prisma.config.ts` loads the repository `.env`; `pnpm node:setup` completed generate, deploy and seed without manually exporting `DATABASE_URL`.
- **Authentication and feature isolation — VERIFIED**:
  - Login creates a token-family identifier, rotation preserves it and atomically claims one unrevoked token. Replay revokes only that family; refresh/logout accept only the HttpOnly cookie.
  - Live API contracts proved one winner for concurrent refresh, family-scoped replay revocation, multi-device isolation, logout revocation and rejection of body-supplied refresh tokens.
  - Backend feature guards now hide disabled checkout, payment, licensing and download workflows; matching customer UI actions are hidden or disabled. Public tools remain anonymous.
- **Reliability and security — VERIFIED**:
  - Conversion creation atomically commits the job, quota reservation, audit record and real outbox event. A retrying dispatcher uses stable idempotent queue IDs.
  - Authenticated quota uses plan billing windows, tool `costUnits`, reservations, expiry and settled `UsageRecord` rows. Anonymous device/IP counters use one Redis Lua transaction and fail closed.
  - Production uploads require available ClamAV scanning. Compose provides a healthy multi-architecture ClamAV service.
  - Worker URL and redirect requests use DNS-pinned safe agents. Cancellation reaches active child processes and partial object output is deleted.
  - Gotenberg is pinned to `8.37.0`. Its former catch-all Chromium allow-list was removed because allow-list matches bypass private-IP checks; Chromium, LibreOffice, remote-download and webhook private-IP denial are enabled.
  - Worker heartbeats are per process and report Poppler, Tesseract, Pandoc, LibreOffice, pdf2docx and fontconfig availability. Strict readiness returns HTTP 200 only when database, Redis, storage, workers, Gotenberg, ClamAV and queues are up.
  - API and Next.js responses include CSP and related production security headers.
- **Conversion quality — VERIFIED**:
  - Poppler is the default PDF-to-image renderer; PDF.js is an explicit private-browser fallback. Browser missing-glyph indicators trigger the server Poppler path when available.
  - A checked-in multilingual visual fixture covers embedded/subset fonts, CFF/Base14 text, CID/CJK, Devanagari, Arabic, transparency, page rotation and an image-only scan. CI compares Poppler output to approved pixels with defined thresholds.
  - PDF preflight gives explicit encrypted, corrupt and unsupported-file errors.
  - DOCX output is structurally checked and, when required, reopened and rendered to PDF by LibreOffice before a job may complete.
  - The three Word contracts remain explicit: fixed editable, flowing editable and exact visual (intentionally image-based).
- **AI memory and commercial exposure — VERIFIED**:
  - Persistent memory/project/conversation/retrieval/isolation pages remain available.
  - Live AI-memory E2E passed lifecycle, relevance, organization/project isolation, supersession, archive/delete, manual editing, prompt-injection containment and unavailable-provider durability checks.
  - Incomplete commercial features are disabled by default at both frontend and backend until payment-specific E2E is supplied.
- **Live runtime acceptance — VERIFIED**:
  - Healthy services: PostgreSQL, Redis, MinIO, Gotenberg, ClamAV, API, worker and web.
  - API contracts: 18 passed, 0 failed, 0 skipped.
  - Conversion/visual suite: 7 passed, 0 failed, 0 skipped.
  - AI-memory suite: 8 passed, 0 failed, 0 skipped.
  - Queue-disabled live API suite: 1 passed, 0 failed, 0 skipped; the API starts without BullMQ and returns HTTP 503 before creating a server conversion.
  - Anonymous smoke flows: HTML-to-PDF and URL-to-PDF both completed and downloaded non-empty PDFs.
  - SSRF acceptance: a public `https://example.com` URL completed through Chromium, while `http://169.254.169.254/latest/meta-data/` was rejected with HTTP 400 before a job was created.
  - Docker startup deadlock found during live verification was repaired by using API liveness for the worker dependency while retaining strict readiness for external health.
- **Native-mode host prerequisite — EXTERNAL**:
  - The code path and `pnpm node:setup` are verified. This Mac currently lacks a host-installed LibreOffice executable, so strict fully native conversion readiness correctly fails `pnpm node:doctor`; Docker includes and verifies LibreOffice.
- **Source-control handoff**:
  - The worktree predates this re-audit and contains mixed user/manual changes. No commit was created automatically because doing so would combine ownership and unrelated historical edits. Review and commit the logical groups after owner approval.

### Native Blog Studio SaaS integration — 2026-09-22 Asia/Kolkata

- **Architecture — VERIFIED**:
  - Added framework-independent `packages/blog-engine` with the ten planned research-to-finalize stages, dependency-injected provider/research/checkpoint/progress/cancellation/logging adapters, deterministic prompts, persisted stage checkpoints, structured result validation and bounded provider retries.
  - Added native NestJS `blog-studio` API and dedicated BullMQ queue; no MongoDB, duplicate authentication server, second hosted frontend or customer provider-key UI was introduced.
  - Job creation atomically commits the generation job, usage reservation, audit record and outbox event. The dispatcher publishes stable queue IDs and retries failed delivery.
- **Usage and tenant security — VERIFIED**:
  - Added Free 1/25, Pro 5/100, Business 15/300 and add-on replacement 40/800 blog/credit limits with monthly windows, expiring reservations, actual model-price settlement and release on failure/cancellation.
  - Every blog, job, source, image and export lookup is organization scoped. Live two-organization testing confirmed direct blog IDs return 404 outside the owner organization.
  - Generated and edited HTML is sanitized through an allow-listed tag/attribute policy that rejects active tags, event handlers, unsafe data URLs and quoted, unquoted or entity-obfuscated script URLs.
  - Optional brand website context uses DNS-pinned HTTP agents, redirect revalidation, private-network denial, response-size limits and HTML/plain-text content-type enforcement.
- **Hosted product experience — VERIFIED**:
  - Added `/saas/blog-studio`, `/app/blog-studio`, `/app/blog-studio/new`, `/app/blog-studio/[blogId]`, `/app/blog-studio/history`, `/app/blog-studio/usage` and `/app/billing` integrations.
  - Generator inputs cover topic, keywords, focus keyword, language, style, tone, target length, brand context and optional safe website context. The UI displays estimated credit reservation and reconnects to authenticated persisted progress through SSE with snapshot fallback.
  - Added TipTap editing, five-second autosave, optimistic version conflicts, version-safe regenerate, SEO/source panels, searchable history, separate blog/credit meters and HTML/Markdown/DOCX/PDF export actions.
  - Blog Studio is linked from SaaS navigation, workspace navigation, pricing and sitemap; all 39 Next.js routes compile in the production build.
- **Billing, catalog and flags — VERIFIED SAFE-DISABLED**:
  - Seeded `blog-studio-addon` at USD 19 / INR 1,599 recurring and unpublished `blog-studio-desktop-windows` at USD 99 / INR 8,299 one-time, plus the versioned AI model-price catalog.
  - Added Stripe subscription Checkout and Razorpay subscription-plan creation plus signature-verified, idempotent lifecycle webhook synchronization. Browser success redirects never activate access.
  - `FEATURE_BLOG_STUDIO_CHECKOUT`, `FEATURE_BLOG_STUDIO_IMAGES` and `FEATURE_BLOG_DESKTOP_SALES` remain false; live contracts confirmed disabled checkout and image endpoints return backend 404 responses.
- **Windows desktop source — VERIFIED AT SOURCE LEVEL**:
  - Added a packaged local Electron renderer, SQLite persistence, shared BlogEngine adapter, native save dialogs, narrow validated IPC, `contextIsolation`, sandboxing and no renderer Node integration.
  - Provider keys are encrypted only through Electron `safeStorage`; offline Ed25519 certificates bind product and machine, enforce the two-device server limit and retain perpetual-use/update-expiry claims.
  - Security verification and offline-certificate tamper/machine-binding tests pass. Ownership/relicensing assumptions are recorded in `docs/BLOG_GENERATOR_SOURCE_RECORD.md`.
- **Verification evidence — VERIFIED**:
  - Production build: API, worker, web, desktop security boundary and all shared packages passed.
  - Static checks: repository type checks, zero-warning oxlint and `git diff --check` passed.
  - Unit suite: 66 passed, 0 failed, 0 skipped, including 5 BlogEngine pipeline/security tests and 2 desktop certificate tests.
  - Migration chain: fresh database plus schema-first adopted database both migrated and seeded successfully.
  - Live API suites: 26 passed, 0 failed, 0 skipped; Blog Studio coverage includes separate usage limits, unavailable-provider no-reservation behavior, tenant isolation, XSS sanitization, optimistic conflicts, downloadable HTML/Markdown exports, soft deletion and disabled commercial endpoints.
  - Existing regression suites remained green: conversion/visual 7/7, AI memory 8/8, queue-disabled 1/1, anonymous HTML-to-PDF and URL-to-PDF smoke flows.
  - Docker images were rebuilt from the final source; PostgreSQL, Redis, MinIO, Gotenberg, ClamAV, API, worker and web are healthy.
- **External release gates — NOT CLAIMED COMPLETE**:
  - A real managed `AI_API_KEY` was not available, so an actual provider-backed ten-stage hosted generation and image generation were not executed. Core generation stays enabled but returns a clear 503 before reserving usage when no provider is configured; images stay flag-hidden.
  - Stripe/Razorpay sandbox product IDs, webhook secrets and accounts were unavailable, so checkout remains flag-hidden until provider lifecycle E2E passes.
  - Windows installer Authenticode signing and a clean Windows x64 VM smoke test require external signing credentials and a Windows release environment; desktop sales remain unpublished and flag-hidden.
  - The computer-use browser surface was unavailable for screenshot QA. The public Blog Studio page returned HTTP 200 and the complete Next.js production route build passed, but no new visual screenshot is claimed.

## Administrator entitlement and subscription enforcement — 2026-09-22 Asia/Kolkata

### Completed

- Added an optional-JWT public-tool path. Anonymous visitors keep the free daily allowance, while a
  signed-in account uses its organization plan and owns its conversion jobs directly.
- Invalid or expired supplied bearer tokens now fail authentication instead of silently falling
  back to anonymous access.
- Added database-authoritative platform administrator bypasses for tool minimum-plan checks,
  monthly conversion quotas, plan file-size ceilings, Blog Studio completed-blog limits, and Blog
  Studio credit limits.
- Technical per-tool limits, feature flags, malware scanning, organization isolation, and provider
  availability remain enforced for administrators.
- Active, unexpired core subscriptions now take precedence over the organization base plan in
  conversion, public tool, Blog Studio, profile, and quota calculations.
- Administrator Blog Studio activity still creates reservations and settles actual usage records;
  the UI reports unlimited access instead of presenting the internal high ceiling.
- Added an idempotent, environment-driven administrator seed. It has no committed default password,
  rejects incomplete or short credentials, and requires explicit acknowledgement in production.
- Updated tool, workspace, settings, Blog Studio dashboard, and Blog Studio usage UI to display the
  effective administrator or subscription access state.

### Verified

- Local development administrator seed completed successfully against PostgreSQL.
- Live login returned the seeded account with `platformRole: ADMIN`.
- Live tool quota returned `accessLevel: ADMIN`, `unlimited: true`, and null quota ceilings.
- Live Blog Studio usage returned administrator unlimited access.
- A live anonymous request retained its separate five-operation daily allowance.
- A live customer account returned `SUBSCRIPTION`, tier `FREE`, and the seeded 300-unit monthly
  allowance rather than receiving the administrator bypass.
- An authenticated administrator HTML-to-PDF job completed through the public tool endpoint and
  issued an authorized signed download URL.
- Full production build completed for all packages, API, worker, web, and desktop; Next.js generated
  all 39 routes.
- TypeScript checks passed.
- All 66 unit tests passed, including the administrator Blog Studio allowance assertion.
- Oxlint and `git diff --check` passed.

### Security note

- The local administrator credential is stored only in the ignored repository `.env` file and is
  intentionally not copied into this execution document or committed templates.

## Blog Studio full-suite re-audit and hardening — 2026-09-23 Asia/Kolkata

### Manual implementation audit

- Confirmed that the manually added schema, migrations, Blog Studio routes, shared engine, desktop
  application and upstream watcher were substantive foundations rather than empty folders.
- Replaced remaining placeholder behavior in publishing, product import, image generation,
  notifications, audit logs, analytics and administration with organization-scoped services.
- Corrected the permission guard to trust the JWT organization rather than a caller-controlled
  organization header. Organization owners/admins manage credentials, destinations, settings and
  prompt templates; ordinary members retain normal writing access.

### Completed in this pass

- Added real WordPress, Shopify, custom/JTL publishing connectors with encrypted credentials,
  DNS-pinned networking, redirect denial, bounded payloads and persistent remote publication data.
- Added real Shopify, WooCommerce and JSON-LD product-context ingestion with safe URL validation.
- Added managed image generation, credit settlement, private MinIO storage, signed gallery links,
  featured-image selection and cleanup. Short-lived signed links are not persisted inside article
  HTML, preventing saved articles from acquiring broken image URLs.
- Added encrypted organization BYOK adapters, safe provider connection tests, organization settings
  and versioned stage prompt management.
- Added optional Tavily source research using either a managed key or an encrypted organization
  credential. Missing research credentials fail soft without inventing external citations.
- Added durable scheduled generation, generate-and-publish continuation, cancellation, run records,
  bulk CSV schedule import and outbox recovery after an interrupted publish claim.
- Added persistent notifications and audit-log views, real organization analytics, product context,
  media gallery, provider/destination configuration and the platform administrator overview.
- Improved the dedicated responsive Blog Studio workspace and made the SaaS directory launch it in
  a separate browser tab. Advanced navigation/actions are hidden unless their backend feature flag
  is enabled.
- Added a read-only pinned upstream comparison command and weekly GitHub workflow. The pinned
  `tanmay-sahoo/Blog-generator` commit matched the latest `main` commit during this run.

### Verification in this pass

- All 66 unit tests passed with zero failures or skips.
- Full monorepo production build passed; Next.js generated all 47 routes.
- API TypeScript checks, web TypeScript build, desktop security verification, zero-warning oxlint
  and `git diff --check` passed.
- Docker Desktop was not running during the final re-audit. Therefore migration-chain, provider,
  payment, publishing, scheduler and full browser E2E suites were not rerun and are not claimed as
  current live verification in this section. Earlier live results above are historical evidence,
  not a statement about the current stopped runtime.

### Remaining external release gates

- Keep image generation, publishing, scheduling, scraping, BYOK, analytics and checkout flags off
  until their actual provider/sandbox credentials are configured and the corresponding live E2E
  suites pass.
- No administrator password is committed or printed. Provision it through ignored `.env` values
  `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, run the idempotent seed, then remove or rotate the
  seed secret from the runtime environment.
- Desktop public release still needs Authenticode signing and a clean Windows x64 installer smoke
  test. Complete interface localization and bidirectional remote-post/category synchronization are
  explicitly recorded as deferred in the upstream parity contract.
