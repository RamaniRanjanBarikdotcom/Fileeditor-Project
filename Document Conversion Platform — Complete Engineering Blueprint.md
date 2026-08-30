# Document Conversion Platform — Complete Engineering Blueprint

## 1. Project Overview

### 1.1 Product Name

Working name:

**Document Conversion Platform**

The final commercial name can be decided later.

---

## 1.2 What We Are Building

We are building a **web-first document conversion, document editing, document generation, and export platform**.

Users will be able to:

- Upload files.
- Paste HTML.
- Paste Markdown.
- Paste plain text.
- Upload Word documents.
- Upload Excel spreadsheets.
- Upload CSV files.
- Upload images.
- Preview documents.
- Edit supported document content.
- Configure output settings.
- Convert documents.
- Export to supported formats.
- Download generated files.
- View conversion history.
- Re-run previous conversions.
- Delete files.
- Use saved conversion presets.
- Eventually use an API.
- Eventually use a desktop application.

The first product will be a:

> Web application with server-side document conversion.

---

# 2. How the System Works

The user interacts with the application through a browser.

Heavy document processing happens on the server.

```text
Browser
   |
   v
React Web Application
   |
   v
NestJS Backend API
   |
   v
Conversion Job Queue
   |
   v
Conversion Workers
   |
   +--> Chromium / Gotenberg
   +--> LibreOffice
   +--> Pandoc
   +--> Mammoth
   +--> SheetJS
   +--> DOCX Generator
   +--> PDF Tools
   |
   v
Generated Document
   |
   v
Object Storage
   |
   v
Preview / Download
```

---

# 3. Product Type

The system will initially be a:

## Web Application

Users access it from:

- Chrome
- Edge
- Firefox
- Safari

It can work on:

- Windows
- macOS
- Linux
- Android
- iOS/iPadOS

No installation will be required for the web version.

---

## Future Product Types

Later, the same platform can become:

### SaaS Platform

Hosted online and sold using monthly or usage-based plans.

### Public API

Other software can programmatically convert documents.

### Desktop Application

Using Tauri.

Supported operating systems:

- Windows
- macOS
- Linux

### Self-Hosted Enterprise Version

Companies can install the complete platform inside their own infrastructure.

---

# 4. Core Architectural Principle

We will **not build our own Word, Excel, PDF, HTML, OCR, or browser rendering engines**.

We will use mature existing technologies.

Our own software will control:

- User experience
- File management
- Conversion orchestration
- Conversion routing
- Authentication
- Security
- Storage
- Queueing
- Templates
- Error handling
- Previewing
- History
- Usage limits
- Billing
- API access
- Worker management
- Monitoring

---

# 5. Locked Technology Stack

## 5.1 Main Programming Language

**TypeScript**

Use TypeScript across:

- Frontend
- Backend
- Shared libraries
- Workers where appropriate
- API contracts

---

# 6. Frontend Stack

## 6.1 Framework

**React**

---

## 6.2 Build System

**Vite**

---

## 6.3 UI Components

Recommended:

**shadcn/ui**

Supporting libraries:

- Radix UI
- Tailwind CSS
- Lucide icons

Alternative:

- Ant Design

Recommended final choice:

> shadcn/ui for primary frontend.

---

## 6.4 Rich Text Editor

**Tiptap**

Use it for:

- Paragraph editing
- Headings
- Bold
- Italic
- Underline
- Lists
- Tables
- Links
- Images
- Alignment
- Document structure

---

## 6.5 HTML / Markdown Editor

**Monaco Editor**

Use it for:

- HTML source editing
- Markdown editing
- JSON editing
- Raw text editing

Features:

- Syntax highlighting
- Search
- Auto indentation
- Line numbers
- Error markers
- Code formatting

---

## 6.6 File Uploading

**Uppy**

Optional large-file support:

**tus**

Features:

- Drag and drop
- Multiple files
- Upload progress
- Retry
- Resumable uploads

---

## 6.7 PDF Preview

**PDF.js**

Features:

- Page navigation
- Zoom
- Fit page
- Fit width
- Print
- Download
- Thumbnail sidebar

---

## 6.8 Frontend State

Recommended:

**Zustand**

---

## 6.9 Server State

Recommended:

**TanStack Query**

Use for:

- API fetching
- Caching
- Polling
- Job status
- Mutation handling

---

# 7. Backend Stack

## 7.1 Backend Framework

**NestJS**

---

## 7.2 API Style

Primary:

**REST API**

Documentation:

**OpenAPI / Swagger**

Potential later additions:

- Webhooks
- SDK
- GraphQL only if genuinely required

Do not introduce GraphQL initially.

---

# 8. Database

Use:

**PostgreSQL**

The database stores structured application information.

It does not store large files directly.

---

# 9. ORM

Recommended options:

- Prisma
- TypeORM

Recommended for new project:

**Prisma**

Use Prisma for:

- Schemas
- Migrations
- Queries
- Type generation

---

# 10. Queue System

Use:

**Redis + BullMQ**

Redis stores:

- Job queue
- Job state
- Temporary cache
- Rate limiting
- Distributed locks

BullMQ manages:

- Conversion queues
- Retries
- Delays
- Concurrency
- Worker coordination

---

# 11. File Storage

Use S3-compatible object storage.

Recommended initial option:

**Cloudflare R2**

Alternative options:

- Amazon S3
- Backblaze B2
- DigitalOcean Spaces
- Railway Object Storage
- MinIO

---

# 12. Conversion Engines

## 12.1 HTML to PDF

Use:

**Gotenberg + Chromium**

Fallback:

**Puppeteer + Chromium**

Primary recommendation:

> Gotenberg.

---

## 12.2 Word to PDF

Use:

**LibreOffice**

Prefer running it through:

**Gotenberg**

---

## 12.3 Excel to PDF

Use:

**LibreOffice**

---

## 12.4 PowerPoint to PDF

Future:

**LibreOffice**

---

## 12.5 Markdown Conversion

Use:

**Pandoc**

Useful conversions:

- Markdown -> DOCX
- Markdown -> HTML
- Markdown -> PDF
- DOCX -> Markdown
- HTML -> Markdown
- HTML -> DOCX

---

## 12.6 DOCX to Editable HTML

Use:

**Mammoth**

Important:

Mammoth prioritizes semantic HTML rather than pixel-perfect Word reproduction.

Sanitize generated HTML before displaying it.

---

## 12.7 Spreadsheet Processing

Use:

**SheetJS**

Useful for:

- XLSX -> JSON
- XLSX -> CSV
- CSV -> XLSX
- JSON -> XLSX
- Spreadsheet preview
- Reading worksheets
- Writing simple spreadsheets

---

## 12.8 DOCX Generation

Use:

**docx**

Useful for generating new structured Word documents.

Supports:

- Paragraphs
- Tables
- Images
- Headers
- Footers
- Page layout
- Styles

---

## 12.9 PDF Manipulation

Use one or more of:

- PDFBox
- pdfcpu
- qpdf
- PDF-LIB

Capabilities:

- Merge
- Split
- Rotate
- Reorder
- Delete pages
- Add watermark
- Add page numbers
- Encrypt
- Decrypt where authorized

---

## 12.10 OCR

Future:

**Tesseract OCR**

For:

- Scanned PDFs
- Images containing text
- Searchable PDFs
- Text extraction

OCR should not be included in the first small MVP unless required.

---

# 13. Malware Protection

Use:

**ClamAV**

Files should be scanned before they enter normal conversion processing.

---

# 14. Containerization

Use:

**Docker**

Use:

**Docker Compose**

during development and early deployment.

Every major service should run separately.

Example:

```yaml
services:
  frontend:
  api:
  worker:
  postgres:
  redis:
  gotenberg:
  clamav:
```

---

# 15. Initial Hosting

Recommended:

## Source Code

GitHub private repository.

## Application

Railway.

## File Storage

Cloudflare R2.

## Domain / DNS / CDN

Cloudflare.

## CI/CD

GitHub Actions.

---

# 16. Production Hosting Later

At larger scale migrate to:

- AWS
- Google Cloud
- Azure
- Kubernetes
- ECS
- Cloud Run
- Managed Kubernetes

Recommended AWS architecture later:

```text
CloudFront
   |
Load Balancer
   |
API Containers
   |
Redis / Queue
   |
Worker Containers
   |
S3

Database:
RDS PostgreSQL
```

---

# 17. Application Architecture

Start with:

> Modular monolith backend + independent conversion workers.

Do not start with dozens of microservices.

Architecture:

```text
Frontend
   |
   v
NestJS API
   |
   +-------------------------+
   |                         |
PostgreSQL                 Redis
                             |
                             v
                           BullMQ
                             |
             +---------------+----------------+
             |               |                |
         PDF Worker     Office Worker     Data Worker
             |               |                |
         Chromium      LibreOffice        SheetJS
         Gotenberg     Pandoc             DOCX
```

---

# 18. Repository Structure

Use a monorepo.

Recommended:

```text
document-platform/
|
+-- apps/
|   |
|   +-- web/
|   |   +-- React frontend
|   |
|   +-- api/
|   |   +-- NestJS API
|   |
|   +-- admin/
|       +-- Admin dashboard
|
+-- workers/
|   |
|   +-- conversion-worker/
|   +-- office-worker/
|   +-- pdf-worker/
|   +-- spreadsheet-worker/
|
+-- packages/
|   |
|   +-- ui/
|   +-- shared-types/
|   +-- api-contracts/
|   +-- conversion-router/
|   +-- storage/
|   +-- security/
|   +-- templates/
|   +-- logging/
|
+-- infrastructure/
|   |
|   +-- docker/
|   +-- railway/
|   +-- monitoring/
|
+-- tests/
|   |
|   +-- fixtures/
|   +-- integration/
|   +-- e2e/
|   +-- conversion/
|
+-- docs/
|   |
|   +-- architecture.md
|   +-- api.md
|   +-- security.md
|   +-- conversion-matrix.md
|
+-- docker-compose.yml
+-- package.json
+-- README.md
```

---

# 19. Recommended Monorepo Tooling

Use:

**pnpm workspaces**

Optional:

**Turborepo**

Recommended:

```text
pnpm
+
Turborepo
```

---

# 20. User Flow

Main user flow:

```text
User opens application
        |
        v
New Conversion
        |
        +-- Upload file
        |
        +-- Paste HTML
        |
        +-- Paste Markdown
        |
        +-- Paste text
        |
        v
Application identifies source format
        |
        v
Preview
        |
        v
Select output format
        |
        v
Configure export
        |
        v
Convert
        |
        v
Processing
        |
        v
Validate generated result
        |
        v
Preview
        |
        v
Download
```

---

# 21. Main Application Navigation

Recommended navigation:

```text
Dashboard

New Conversion

History

Batch Convert

Templates

Files

API

Settings

Billing

Help
```

Admin:

```text
Admin Dashboard

Users

Organizations

Conversion Jobs

Failed Jobs

Worker Health

Storage

Usage

Security

System Settings

Logs
```

---

# 22. New Conversion Screen

Recommended UI:

```text
+--------------------------------------------------------------+
| New Conversion                                               |
+----------------------------+---------------------------------+
|                            |                                 |
| INPUT                      | PREVIEW                         |
|                            |                                 |
| Drop File                  |                                 |
|                            |       Document preview          |
| DOCX                       |                                 |
| XLSX                       |                                 |
| HTML                       |                                 |
| Markdown                   |                                 |
| CSV                        |                                 |
| Images                     |                                 |
|                            |                                 |
+----------------------------+---------------------------------+
|                                                              |
| Output Format: [ PDF v ]                                     |
|                                                              |
| Page Size:   [ A4 v ]                                        |
| Orientation: [ Portrait v ]                                  |
| Margins:     [ Default v ]                                   |
|                                                              |
|                     [ Convert Document ]                     |
+--------------------------------------------------------------+
```

---

# 23. Input Formats — MVP

Support initially:

- HTML
- Markdown
- TXT
- DOCX
- XLSX
- CSV
- JSON
- PNG
- JPG/JPEG

Optional early support:

- ODT
- ODS

---

# 24. Output Formats — MVP

Support:

- PDF
- DOCX
- HTML
- Markdown
- TXT
- XLSX
- CSV

Only expose output formats that make sense for the current input.

---

# 25. Conversion Matrix

## High Reliability

| Input | Output | Engine |
|---|---|---|
| HTML | PDF | Gotenberg/Chromium |
| Markdown | PDF | Markdown -> HTML -> Chromium |
| Markdown | HTML | Pandoc |
| Markdown | DOCX | Pandoc |
| TXT | PDF | Template -> HTML -> Chromium |
| TXT | DOCX | docx/Pandoc |
| CSV | XLSX | SheetJS |
| JSON | XLSX | SheetJS |
| XLSX | CSV | SheetJS |
| DOCX | PDF | LibreOffice |
| XLSX | PDF | LibreOffice |
| Image | PDF | PDF worker |

---

## Medium Reliability

| Input | Output | Notes |
|---|---|---|
| DOCX | HTML | Semantic, not pixel perfect |
| DOCX | Markdown | Complex layouts may simplify |
| HTML | DOCX | Complex CSS will not map perfectly |
| XLSX | HTML | Good for data, less exact visually |

---

## Difficult Conversions

These should not be marketed as perfect.

Examples:

- PDF -> DOCX
- PDF -> editable XLSX
- Scan -> DOCX
- Complex PowerPoint -> Word
- Pixel-perfect Word -> HTML

Warn users when fidelity may be reduced.

---

# 26. Conversion Router

Create a central routing system.

Pseudo structure:

```typescript
interface ConversionRequest {
  inputFormat: string;
  outputFormat: string;
  options: ConversionOptions;
}

interface ConversionAdapter {
  supports(input: string, output: string): boolean;
  convert(request: ConversionRequest): Promise<ConversionResult>;
}
```

Adapters:

```text
ChromiumAdapter
LibreOfficeAdapter
PandocAdapter
MammothAdapter
SpreadsheetAdapter
DocxAdapter
PdfAdapter
ImageAdapter
OcrAdapter
```

Router:

```typescript
class ConversionRouter {
  async convert(request: ConversionRequest) {
    const adapter = this.findAdapter(
      request.inputFormat,
      request.outputFormat
    );

    if (!adapter) {
      throw new UnsupportedConversionError();
    }

    return adapter.convert(request);
  }
}
```

---

# 27. Job Lifecycle

Use clear states.

```text
CREATED
UPLOADING
UPLOADED
SCANNING
VALIDATING
QUEUED
PROCESSING
OUTPUT_VALIDATION
COMPLETED
FAILED
CANCELLED
EXPIRED
```

---

# 28. Full Conversion Workflow

```text
1. User selects file.

2. Frontend checks:
   - file size
   - allowed extension

3. API creates upload session.

4. File uploads to quarantine storage.

5. Backend verifies:
   - actual file signature
   - MIME type
   - allowed file type

6. Malware scan runs.

7. Source file metadata is saved.

8. Conversion job is created.

9. Conversion Router determines engine.

10. BullMQ job is created.

11. Worker claims job.

12. Worker creates isolated temporary directory.

13. Worker downloads input.

14. Conversion engine runs.

15. Worker verifies output.

16. Generated result uploads to object storage.

17. Job changes to COMPLETED.

18. Frontend receives status update.

19. Preview loads.

20. User downloads generated document.

21. Temporary files are deleted.

22. Stored source/output files expire according to policy.
```

---

# 29. Database Schema

## users

```text
id
email
password_hash
first_name
last_name
status
email_verified_at
created_at
updated_at
```

---

## organizations

```text
id
name
slug
owner_user_id
plan_id
created_at
updated_at
```

---

## organization_members

```text
id
organization_id
user_id
role
created_at
```

Roles:

```text
OWNER
ADMIN
MEMBER
VIEWER
```

---

## stored_files

```text
id
organization_id
user_id

original_filename
storage_key

extension
mime_type
detected_type

size_bytes
sha256

status

malware_scan_status

created_at
updated_at
expires_at
deleted_at
```

---

## conversion_jobs

```text
id

organization_id
user_id

source_file_id
output_file_id

source_format
target_format

engine
engine_version

status

progress

attempt_count

settings_json

warning_json

error_code
error_message

created_at
queued_at
started_at
completed_at
expires_at
```

---

## conversion_events

```text
id

conversion_job_id

event_type
message
metadata_json

created_at
```

---

## templates

```text
id

organization_id

name
description

template_type

storage_key

version

is_active

created_at
updated_at
```

---

## conversion_presets

```text
id

organization_id
user_id

name

source_format
target_format

settings_json

created_at
updated_at
```

---

## api_keys

```text
id

organization_id
created_by_user_id

name
key_hash

permissions

last_used_at
expires_at

created_at
revoked_at
```

---

## usage_records

```text
id

organization_id
user_id

conversion_job_id

operation

input_bytes
output_bytes
processing_ms

created_at
```

---

## audit_logs

```text
id

organization_id
user_id

action

resource_type
resource_id

ip_address
user_agent

metadata_json

created_at
```

---

# 30. File Storage Architecture

Use buckets such as:

```text
converter-quarantine

converter-inputs

converter-outputs

converter-previews

converter-templates
```

Example object path:

```text
organizations/
  org_123/
    users/
      user_456/
        input/
          file_uuid.docx
```

Do not use raw filenames as object identifiers.

Use UUIDs.

---

# 31. Private File Access

Files must not be permanently public.

The backend generates temporary signed URLs.

Example expiration:

```text
5 minutes
15 minutes
1 hour
```

depending on the operation.

---

# 32. File Retention

Recommended default:

Free:

```text
24 hours
```

Paid:

```text
7 days
```

Optional permanent storage:

```text
User-controlled
```

Users should be able to immediately delete their files.

---

# 33. Temporary Worker Storage

Each conversion must use an isolated folder.

Example:

```text
/tmp/conversions/job-123/
```

Contents:

```text
input.docx
intermediate.html
output.pdf
```

After conversion:

```text
rm -rf /tmp/conversions/job-123
```

Cleanup must happen:

- on success
- on failure
- on timeout
- on worker shutdown where possible

---

# 34. Security Requirements

Security is mandatory because uploaded documents are untrusted.

Implement:

## Upload Validation

Validate:

- extension
- MIME type
- magic bytes
- size
- filename
- compression ratio

Never trust browser-provided `Content-Type`.

---

## Malware Scanning

Use ClamAV.

Flow:

```text
Upload
   |
Quarantine
   |
Malware Scan
   |
Clean?
 /    \
Yes    No
 |      |
Process Reject
```

---

## HTML Sanitization

Use a proper HTML sanitizer.

Possible library:

**DOMPurify**

Server-side equivalent where appropriate.

Remove:

- scripts
- dangerous event handlers
- unsafe iframe content
- malicious URLs
- dangerous embedded content

---

# 35. SSRF Protection

HTML and URLs can attempt to load:

```text
localhost
127.0.0.1
internal network addresses
cloud metadata services
private APIs
```

Block private network access from conversion workers.

Workers should normally have:

```text
No unrestricted outbound internet access
```

unless the conversion specifically requires remote resources.

---

# 36. Worker Security

Workers should:

- run as non-root
- have limited filesystem access
- have memory limits
- have CPU limits
- have conversion timeouts
- have page count limits
- have file size limits
- use isolated temporary directories
- have restricted network access

---

# 37. Secret Management

Never commit secrets.

Examples:

```text
DATABASE_URL
REDIS_URL
JWT_SECRET
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
ENCRYPTION_KEY
CLAMAV_HOST
```

Use:

- Railway secrets initially
- AWS Secrets Manager later
- Vault later if necessary

---

# 38. Authentication

Start with:

- Email
- Password
- Email verification
- Forgot password
- Password reset

Later:

- Google login
- Microsoft login
- SSO
- SAML
- OIDC

---

# 39. Authorization

Use RBAC.

Roles:

```text
OWNER

ADMIN

MEMBER

VIEWER
```

Permissions should control:

- conversions
- file deletion
- template management
- API keys
- billing
- organization settings
- user management

---

# 40. API Structure

Base path:

```text
/api/v1
```

---

# 41. Authentication APIs

```http
POST /api/v1/auth/register

POST /api/v1/auth/login

POST /api/v1/auth/logout

POST /api/v1/auth/refresh

POST /api/v1/auth/forgot-password

POST /api/v1/auth/reset-password

GET /api/v1/auth/me
```

---

# 42. File APIs

```http
POST /api/v1/files/upload-session

POST /api/v1/files/complete-upload

GET /api/v1/files

GET /api/v1/files/:id

DELETE /api/v1/files/:id

GET /api/v1/files/:id/download
```

---

# 43. Conversion APIs

Create:

```http
POST /api/v1/conversions
```

Example:

```json
{
  "sourceFileId": "file_123",
  "targetFormat": "pdf",
  "settings": {
    "pageSize": "A4",
    "orientation": "portrait",
    "marginTopMm": 15,
    "marginRightMm": 15,
    "marginBottomMm": 15,
    "marginLeftMm": 15
  }
}
```

Response:

```json
{
  "id": "conv_123",
  "status": "QUEUED"
}
```

---

Get conversion:

```http
GET /api/v1/conversions/:id
```

Response:

```json
{
  "id": "conv_123",
  "status": "PROCESSING",
  "progress": 65,
  "sourceFormat": "docx",
  "targetFormat": "pdf"
}
```

---

List:

```http
GET /api/v1/conversions
```

Cancel:

```http
POST /api/v1/conversions/:id/cancel
```

Retry:

```http
POST /api/v1/conversions/:id/retry
```

Delete:

```http
DELETE /api/v1/conversions/:id
```

---

# 44. Template APIs

```http
GET /api/v1/templates

POST /api/v1/templates

GET /api/v1/templates/:id

PATCH /api/v1/templates/:id

DELETE /api/v1/templates/:id
```

---

# 45. Preset APIs

```http
GET /api/v1/presets

POST /api/v1/presets

PATCH /api/v1/presets/:id

DELETE /api/v1/presets/:id
```

---

# 46. API Keys

Later:

```http
GET /api/v1/api-keys

POST /api/v1/api-keys

DELETE /api/v1/api-keys/:id
```

Never store raw API keys after creation.

Store only a hash.

---

# 47. Webhooks

Future event types:

```text
conversion.started

conversion.completed

conversion.failed

file.expired
```

---

# 48. Conversion Options

PDF options:

```text
Page size

Orientation

Margins

Header

Footer

Page numbers

Print background

Scale

Watermark

Metadata

PDF version

PDF/A later
```

---

# 49. Standard Page Sizes

Support:

```text
A4
A3
A5
Letter
Legal
Custom
```

---

# 50. Orientation

```text
Portrait
Landscape
```

---

# 51. HTML to PDF CSS

Example:

```css
@page {
  size: A4;
  margin: 15mm;
}

body {
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

.page-break {
  break-before: page;
}

.avoid-break {
  break-inside: avoid;
}

img {
  max-width: 100%;
}
```

---

# 52. Font Handling

Fonts are extremely important for document fidelity.

Create a controlled font library.

Initially include common open fonts.

Examples:

```text
Arial-compatible alternative
Liberation Sans
Liberation Serif
Noto Sans
Noto Serif
Roboto
Inter
DejaVu
```

Do not distribute commercial fonts without appropriate licenses.

---

# 53. Missing Font Handling

When a document references an unavailable font:

```text
Detect missing font
      |
      v
Apply fallback
      |
      v
Add conversion warning
```

Example:

```text
"Calibri was unavailable and was replaced with Carlito."
```

---

# 54. External Images

HTML may contain:

```html
<img src="https://example.com/image.jpg">
```

Choices:

### Safe default

Block remote network requests.

### Optional controlled mode

Backend downloads approved assets first.

Then converts HTML using local copies.

---

# 55. Error Handling

Create standardized error codes.

Examples:

```text
UNSUPPORTED_FORMAT

UNSUPPORTED_CONVERSION

FILE_TOO_LARGE

INVALID_FILE_SIGNATURE

MALWARE_DETECTED

PASSWORD_PROTECTED_FILE

CONVERSION_TIMEOUT

CONVERSION_ENGINE_FAILURE

OUTPUT_VALIDATION_FAILED

STORAGE_FAILURE

INSUFFICIENT_STORAGE

RATE_LIMIT_EXCEEDED
```

---

# 56. User-Friendly Error

Never show:

```text
LibreOffice process exit status 127
```

Show:

```text
We couldn't convert this document.

The file may contain unsupported or corrupted Office content.

Try another file or remove advanced embedded objects.
```

Store technical details internally.

---

# 57. Retry Strategy

Retry only errors that may be temporary.

Example:

```text
Storage network error
Worker crashed
Temporary engine failure
```

Do not retry:

```text
Invalid file
Unsupported conversion
Malware
Password-protected document
```

Recommended:

```text
Attempt 1

Attempt 2 after short delay

Attempt 3 after longer delay

Then FAILED
```

---

# 58. Conversion Timeouts

Example starting limits:

```text
Normal conversion:
60 seconds

Large document:
180 seconds

Very large enterprise:
configured separately
```

Do not allow unlimited processing time.

---

# 59. File Size Limits

Example MVP:

Free user:

```text
25 MB
```

Paid:

```text
100 MB
```

Enterprise:

```text
500 MB+
```

Exact limits can change later.

---

# 60. Job Queue Design

Separate queues where useful.

Example:

```text
conversion:html

conversion:office

conversion:spreadsheet

conversion:pdf

conversion:image

conversion:ocr
```

This allows separate scaling.

---

# 61. Worker Concurrency

Do not use the same concurrency for every worker.

Example:

```text
HTML worker:
4 concurrent jobs

LibreOffice worker:
2 concurrent jobs

OCR worker:
1-2 concurrent jobs
```

Actual limits should be benchmarked.

---

# 62. Health Checks

Each service needs:

```text
/health

/health/ready

/health/live
```

Check:

- database
- Redis
- storage
- conversion engine
- queue
- worker

---

# 63. Logging

Use structured JSON logs.

Recommended:

**Pino**

Fields:

```text
requestId
jobId
userId
organizationId
engine
duration
status
errorCode
```

Never log full document content.

---

# 64. Observability

Use:

**OpenTelemetry**

Metrics:

- conversions per minute
- success rate
- failure rate
- average conversion duration
- queue depth
- worker utilization
- storage usage
- conversion type frequency
- engine failures
- retry counts

---

# 65. Metrics Platform

Use:

**Prometheus**

---

# 66. Dashboard

Use:

**Grafana**

Important dashboards:

```text
System Overview

Conversions

Queue Health

Worker Health

Storage

Database

API Performance

Errors

Security Events
```

---

# 67. Frontend Pages

## Public

```text
Landing page

Pricing

Features

Supported Formats

API Documentation

Security

Privacy

Terms

Login

Register
```

---

## Application

```text
Dashboard

New Conversion

History

Files

Templates

Batch Convert

API Keys

Usage

Settings

Billing
```

---

## Admin

```text
System Overview

Users

Organizations

Jobs

Failed Jobs

Workers

Queues

Storage

Security

System Logs

Feature Flags
```

---

# 68. Dashboard

Show:

```text
Conversions Today

Successful

Failed

Storage Used

Recent Jobs

Favorite Conversions

Usage This Month
```

---

# 69. Conversion History

Columns:

```text
File

Source

Output

Status

Size

Created

Duration

Actions
```

Actions:

```text
Download

Preview

Convert Again

Delete
```

---

# 70. Batch Conversion

Version 2.

Flow:

```text
Upload 20 files
      |
      v
Choose PDF
      |
      v
Convert all
      |
      v
Download ZIP
```

---

# 71. Templates

Support reusable document templates.

Examples:

```text
Invoice

Business Report

Letterhead

Proposal

Resume

SEO Report

Product Catalog

Meeting Notes

Technical Report
```

---

# 72. DOCX Templates

Pandoc supports reference DOCX files.

Store:

```text
templates/reference/business-report.docx
```

Users can choose:

```text
Professional Report
Minimal Report
Corporate Report
```

---

# 73. HTML Templates

Use template variables.

Example:

```html
<h1>{{title}}</h1>

<p>{{description}}</p>

<table>
  {{rows}}
</table>
```

Potential templating engine:

**Handlebars**

---

# 74. Preview Architecture

For PDF:

```text
Generated PDF
     |
     v
Signed URL
     |
     v
PDF.js
```

For HTML:

```text
Sanitized HTML
     |
     v
Sandboxed iframe
```

For spreadsheet:

```text
SheetJS
   |
   v
Table Preview
```

For DOCX:

Prefer:

```text
DOCX
 |
Convert temporary preview to PDF
 |
PDF.js
```

This provides consistent previewing.

---

# 75. Realtime Progress

Recommended initial approach:

**Server-Sent Events**

Alternative:

WebSockets.

Example events:

```json
{
  "jobId": "conv_123",
  "status": "PROCESSING",
  "progress": 55
}
```

---

# 76. Billing Later

Potential integration:

**Stripe**

Plans could be:

```text
Free

Pro

Business

Enterprise
```

Measure:

```text
Conversions

Storage

File size

OCR pages

API requests

Processing minutes
```

---

# 77. Rate Limiting

Apply to:

```text
Login

Registration

Upload

Conversion

Download

API
```

Use:

- Redis
- NestJS throttling

---

# 78. Desktop Application — Future

Use:

**Tauri**

Architecture:

```text
Tauri
 |
React frontend
 |
NestJS cloud API
```

Later optionally add local conversion engines.

---

# 79. Desktop Features

Possible later:

```text
Drag files onto desktop app

Right-click Convert to PDF

Watch folders

Offline conversion

Local history

System tray

Automatic export folder

Local privacy mode
```

---

# 80. Public API — Future

Example:

```http
POST /v1/conversions
Authorization: Bearer api_key
```

Request:

```json
{
  "inputFileId": "file_123",
  "outputFormat": "pdf"
}
```

Response:

```json
{
  "conversionId": "conv_987",
  "status": "queued"
}
```

---

# 81. API Webhook Example

```json
{
  "event": "conversion.completed",
  "data": {
    "conversionId": "conv_987",
    "outputFileId": "file_999"
  }
}
```

---

# 82. Testing Strategy

Testing document conversion is extremely important.

We need:

```text
Unit Tests

Integration Tests

End-to-End Tests

Conversion Regression Tests

Security Tests

Performance Tests
```

---

# 83. Unit Tests

Test:

- conversion routing
- format detection
- file validation
- pricing logic
- permissions
- job state transitions
- API key validation

---

# 84. Integration Tests

Test:

```text
API + PostgreSQL

API + Redis

Worker + Redis

Worker + R2

Worker + Gotenberg

Worker + LibreOffice
```

---

# 85. Golden File Tests

Create a test corpus.

Example:

```text
tests/fixtures/

docx/
  simple.docx
  table.docx
  images.docx
  headers.docx
  landscape.docx
  100-pages.docx

xlsx/
  basic.xlsx
  formulas.xlsx
  charts.xlsx
  merged-cells.xlsx

html/
  basic.html
  complex-css.html
  table.html
  page-breaks.html

markdown/
  basic.md
  tables.md
  images.md
```

Store expected outputs or validation rules.

---

# 86. Output Validation

Never assume conversion succeeded because the process returned exit code 0.

Check:

```text
Output exists

Output size > minimum

Expected file signature

Expected page count where available

No corrupted output

Valid PDF structure

Valid DOCX ZIP package
```

---

# 87. Visual Regression Testing

For important conversions:

```text
Reference PDF
     |
Render pages to images
     |
Compare
     |
Detect unexpected changes
```

Useful before updating:

- LibreOffice
- Chromium
- Gotenberg
- Pandoc

---

# 88. Performance Testing

Test:

```text
10 simultaneous jobs

50 simultaneous jobs

100 simultaneous jobs

large Word document

large spreadsheet

100-page HTML PDF
```

Measure:

- CPU
- memory
- processing time
- queue wait
- failure rate

---

# 89. Security Testing

Test:

```text
Malicious HTML

Oversized files

Fake extensions

ZIP bombs

SVG scripts

Office macros

Malformed PDFs

SSRF attempts

Path traversal

Dangerous filenames

Expired signed URLs
```

---

# 90. Backup Strategy

PostgreSQL:

```text
Daily backup

Point-in-time recovery later
```

Templates:

```text
Versioned object storage
```

User files:

Usually temporary.

Do not unnecessarily back up short-lived customer files.

---

# 91. Disaster Recovery

Document:

```text
How to restore database

How to recreate infrastructure

How to restore configuration

How to redeploy workers

How to rotate secrets
```

Infrastructure should be reproducible from code.

---

# 92. Environment Separation

Use:

```text
development

staging

production
```

Never test dangerous conversion updates directly in production.

---

# 93. Development Environment

Developer runs:

```bash
docker compose up
```

Start:

```text
PostgreSQL
Redis
Gotenberg
ClamAV
API
Worker
Frontend
```

---

# 94. CI/CD

Use:

**GitHub Actions**

Pipeline:

```text
Push code
   |
Lint
   |
Type check
   |
Unit tests
   |
Integration tests
   |
Build Docker images
   |
Security scan
   |
Deploy staging
   |
Smoke tests
   |
Deploy production
```

---

# 95. Branch Strategy

Recommended:

```text
main

feature/*
fix/*
```

Keep it simple.

Use pull requests.

Protect `main`.

---

# 96. Code Quality

Use:

```text
ESLint

Prettier

TypeScript strict mode
```

Enable:

```json
{
  "strict": true
}
```

---

# 97. Dependency Updates

Use:

- Renovate
- Dependabot

Do not automatically deploy major conversion engine updates.

Test them against the golden corpus first.

---

# 98. MVP Phase 1

Build foundation.

### Backend

- NestJS
- PostgreSQL
- Prisma
- Redis
- BullMQ
- Authentication
- Storage integration
- Conversion jobs

### Frontend

- React
- Vite
- shadcn/ui
- Authentication
- Dashboard
- Upload
- Conversion
- History

### Conversion

Implement:

```text
HTML -> PDF

Markdown -> PDF

DOCX -> PDF

XLSX -> PDF

CSV -> XLSX
```

---

# 99. MVP Phase 2

Add:

```text
HTML editor

Markdown editor

PDF preview

Conversion settings

Download links

File deletion

Automatic expiry

Conversion warnings

Retry handling
```

---

# 100. MVP Phase 3

Add:

```text
Markdown -> DOCX

HTML -> DOCX

DOCX -> HTML

XLSX -> CSV

JSON -> XLSX

Images -> PDF
```

---

# 101. Version 2

Add:

```text
Batch conversions

ZIP downloads

PDF merge

PDF split

PDF page management

Watermarks

Headers

Footers

Page numbering

Templates

Saved presets

Team accounts

API keys

Webhooks
```

---

# 102. Version 3

Add:

```text
OCR

PDF/A

Advanced PDF processing

Desktop application

Enterprise SSO

Private deployments

Usage billing

Developer SDK

Audit exports

Advanced template designer
```

---

# 103. Build Order

Recommended actual development sequence:

```text
1. Create monorepo

2. Configure TypeScript

3. Configure React

4. Configure NestJS

5. Add PostgreSQL

6. Add Prisma

7. Add Redis

8. Add BullMQ

9. Add authentication

10. Add organization model

11. Add Cloudflare R2

12. Add upload flow

13. Add file validation

14. Add ClamAV

15. Add conversion job model

16. Add worker framework

17. Add Conversion Router

18. Add Gotenberg

19. Implement HTML -> PDF

20. Add conversion status UI

21. Add PDF.js preview

22. Add LibreOffice

23. Implement DOCX -> PDF

24. Implement XLSX -> PDF

25. Add Pandoc

26. Implement Markdown conversions

27. Add SheetJS

28. Implement spreadsheet conversions

29. Add history

30. Add deletion and expiry

31. Add settings

32. Add admin dashboard

33. Add monitoring

34. Add regression test suite

35. Deploy staging

36. Load test

37. Security test

38. Production release
```

---

# 104. First Docker Services

Initial `docker-compose.yml` should contain approximately:

```yaml
services:

  postgres:
    image: postgres

  redis:
    image: redis

  gotenberg:
    image: gotenberg/gotenberg

  clamav:
    image: clamav/clamav

  api:
    build:
      context: .
      dockerfile: ./apps/api/Dockerfile

  worker:
    build:
      context: .
      dockerfile: ./workers/conversion-worker/Dockerfile

  web:
    build:
      context: .
      dockerfile: ./apps/web/Dockerfile
```

Pin actual production versions rather than using unrestricted `latest` tags.

---

# 105. Environment Variables

Example:

```env
NODE_ENV=development

DATABASE_URL=

REDIS_URL=

JWT_SECRET=

APP_URL=

API_URL=

R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_INPUT_BUCKET=
R2_OUTPUT_BUCKET=
R2_TEMPLATE_BUCKET=

GOTENBERG_URL=

CLAMAV_HOST=
CLAMAV_PORT=

MAX_UPLOAD_SIZE=

FILE_RETENTION_HOURS=
```

---

# 106. Conversion Worker Interface

Example:

```typescript
export interface ConversionJobData {
  conversionId: string;
  sourceFileId: string;
  sourceFormat: string;
  targetFormat: string;
  options: {
    pageSize?: string;
    orientation?: string;
    margins?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  };
}
```

---

# 107. Conversion Result Interface

```typescript
export interface ConversionResult {
  success: boolean;

  outputPath?: string;

  outputFormat?: string;

  mimeType?: string;

  sizeBytes?: number;

  warnings?: string[];

  metadata?: Record<string, unknown>;
}
```

---

# 108. Frontend Status Component

Example:

```text
Converting annual-report.docx

Status:
Processing

Progress:
████████████████░░░░ 78%

Engine:
Office Document Processor
```

Do not expose low-level internal engine names unless useful.

---

# 109. Supported Formats Page

Show users a matrix:

```text
               PDF   DOCX   HTML   MD   XLSX   CSV

HTML           YES   YES    -      YES
Markdown       YES   YES    YES    -
DOCX           YES          YES    YES
XLSX           YES                       YES
CSV            YES                       YES
Image          YES
```

Only show tested combinations.

---

# 110. Conversion Quality Levels

Internally classify conversions:

```text
A = Very reliable

B = Reliable with possible visual differences

C = Best effort

D = Experimental
```

Only A/B conversions should initially be public.

---

# 111. Product Reliability Principle

Never promise:

> Every document converts perfectly.

Instead promise:

> Reliable conversions for supported file formats with validation, preview, warnings, and controlled fallbacks.

---

# 112. High Availability Later

When traffic grows:

```text
Multiple API instances

Multiple worker instances

Managed PostgreSQL

Managed Redis

Object storage

Load balancer

Autoscaling
```

---

# 113. Scaling Workers

Suppose HTML jobs increase.

Scale:

```text
HTML Worker 1
HTML Worker 2
HTML Worker 3
HTML Worker 4
```

LibreOffice can scale independently.

```text
Office Worker 1
Office Worker 2
```

No need to scale the entire application together.

---

# 114. Future Worker Architecture

```text
BullMQ
 |
 +-- html.queue
 |      |
 |      +-- chromium workers
 |
 +-- office.queue
 |      |
 |      +-- LibreOffice workers
 |
 +-- data.queue
 |      |
 |      +-- SheetJS workers
 |
 +-- pdf.queue
 |      |
 |      +-- PDF workers
 |
 +-- ocr.queue
        |
        +-- OCR workers
```

---

# 115. Admin Alerts

Notify administrators if:

```text
Queue becomes too long

Workers unavailable

Conversion failure rate increases

Database storage becomes high

Object storage fails

Malware is detected repeatedly

Conversion engine crashes repeatedly
```

---

# 116. File Privacy

Files should:

- be private by default
- be encrypted in transit
- use HTTPS
- use encrypted storage
- have automatic expiration
- not be included in logs
- be deletable by users

---

# 117. Privacy Mode Later

Optional:

```text
Zero-retention conversion
```

Flow:

```text
Upload

Convert

Download

Immediately delete
```

Useful for businesses handling sensitive data.

---

# 118. Enterprise Mode Later

Offer:

```text
Dedicated environment

Private object storage

Private conversion workers

Custom retention

SSO

Audit logs

Custom domains

On-premise installation
```

---

# 119. Product Architecture Summary

```text
                         USER
                           |
                           v
                  React Web Application
                           |
                           v
                    NestJS Backend
                           |
       +-------------------+--------------------+
       |                   |                    |
       v                   v                    v
 PostgreSQL              Redis             Object Storage
                           |
                           v
                         BullMQ
                           |
              +------------+-------------+
              |            |             |
              v            v             v
        HTML Worker   Office Worker  Data Worker
              |            |             |
              v            v             v
        Gotenberg      LibreOffice     SheetJS
        Chromium       Pandoc           DOCX
              |
              v
        Generated Output
              |
              v
        Object Storage
              |
              v
       Preview / Download
```

---

# 120. Locked Architecture Decisions

The following should be treated as the current default architecture:

## Product

Web-first SaaS.

## Frontend

React + TypeScript + Vite.

## UI

shadcn/ui.

## Rich Editor

Tiptap.

## Code Editor

Monaco.

## Backend

NestJS + TypeScript.

## Database

PostgreSQL.

## ORM

Prisma.

## Queue

Redis + BullMQ.

## File Storage

S3-compatible storage, initially Cloudflare R2.

## HTML/PDF Engine

Gotenberg + Chromium.

## Office Conversion

LibreOffice.

## Markdown Conversion

Pandoc.

## DOCX Import

Mammoth.

## Spreadsheet Processing

SheetJS.

## DOCX Generation

docx.

## PDF Manipulation

PDFBox / pdfcpu / qpdf as required.

## OCR

Tesseract later.

## Malware Protection

ClamAV.

## Containers

Docker.

## Local Development

Docker Compose.

## Source Control

GitHub.

## CI/CD

GitHub Actions.

## Initial Hosting

Railway.

## CDN / DNS

Cloudflare.

## Monitoring

OpenTelemetry + Prometheus + Grafana.

## Desktop Later

Tauri.

---

# 121. Final Goal

The finished system should allow a user to:

```text
Open browser

Upload or paste content

Preview content

Edit supported content

Choose output

Configure document

Convert

Preview result

Download result

View history

Reuse templates

Batch process files

Use API

Eventually install desktop version
```

without needing to understand any of the underlying conversion engines.

The user sees one simple product.

Internally, the system intelligently selects the correct processing technology.

---

# 122. Final Engineering Philosophy

Follow these principles throughout development:

1. Never build mature document rendering technology from scratch when reliable engines already exist.

2. Keep the user-facing application independent from conversion engines.

3. Make all conversions go through a central Conversion Router.

4. Run dangerous or resource-heavy conversions in isolated workers.

5. Never use the web API server itself as the document conversion worker.

6. Keep uploaded files outside the application filesystem.

7. Store files in private object storage.

8. Store metadata in PostgreSQL.

9. Use Redis only for temporary queue/cache functionality.

10. Make conversion engines replaceable.

11. Pin production engine versions.

12. Test engine upgrades against a golden test corpus.

13. Never claim perfect conversion fidelity for every possible file.

14. Provide warnings when formatting may change.

15. Validate generated output before marking jobs successful.

16. Automatically clean temporary files.

17. Build security into file handling from Day 1.

18. Build Docker support from Day 1.

19. Start as a modular monolith plus workers, not dozens of microservices.

20. Scale conversion workers independently as demand grows.

21. Build the browser application first.

22. Add public API second.

23. Add desktop client later using the same core platform.

---

# 123. Definition of MVP Success

The MVP is considered successful when a user can reliably:

- Create an account.
- Sign in.
- Upload supported files.
- Paste HTML.
- Paste Markdown.
- Request a conversion.
- See conversion progress.
- Convert HTML to PDF.
- Convert Markdown to PDF.
- Convert Markdown to DOCX.
- Convert DOCX to PDF.
- Convert XLSX to PDF.
- Convert CSV to XLSX.
- Preview generated PDFs.
- Download generated files.
- View conversion history.
- Retry failed eligible conversions.
- Delete documents.
- Have files automatically expire.
- Receive understandable errors.
- Have uploads scanned and validated.
- Use the system from a normal web browser.

When all of these work reliably in staging and production, Version 1 is ready.

---

# 124. Final Product Definition

**Document Conversion Platform**

A secure web-based application for uploading, editing, converting, generating, previewing, and exporting documents between supported formats including HTML, Markdown, Word, Excel, CSV, text, images, and PDF.

The platform uses specialized conversion engines behind a unified application interface, allowing the system to deliver reliable document processing while remaining scalable, maintainable, secure, and expandable into API, desktop, and enterprise products.