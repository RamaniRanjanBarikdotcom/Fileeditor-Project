# Universal URL-to-File Converter
## Production Implementation Blueprint

**Project:** Document + Web Content Conversion Platform  
**Module:** Universal URL Intake and Conversion System  
**Status:** Architecture specification  
**Primary language:** TypeScript  
**Primary backend:** NestJS  
**Primary frontend:** React  
**Primary browser engines:** Gotenberg/Chromium + Playwright/Chromium

---

# 1. Objective

Extend the existing document-conversion platform so a user can provide either:

```text
FILE
HTML
MARKDOWN
TEXT
URL
STRUCTURED DATA
```

and receive supported outputs such as:

```text
PDF
DOCX
HTML
MARKDOWN
TXT
XLSX
CSV
PNG
JPEG
```

The URL system must support the widest practical range of normal `http://` and `https://` URLs.

Examples:

```text
https://example.com

https://example.com/article

https://shop.example.com/product/100

https://app.example.com/dashboard

https://example.com/report.pdf

https://example.com/report.docx

https://example.com/report.xlsx

https://example.com/export?id=123

https://api.example.com/products

https://example.com/feed.xml

https://example.com/image.jpg
```

The user should not need to know whether the URL is:

- HTML
- React
- Next.js
- PDF
- DOCX
- XLSX
- JSON
- XML
- an image
- a download endpoint
- an authenticated page

The platform determines this automatically.

---

# 2. Core User Experience

The main conversion screen becomes:

```text
┌──────────────────────────────────────────────────────────────┐
│ New Conversion                                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Source                                                       │
│                                                              │
│ [ Upload File ] [ URL ] [ HTML ] [ Markdown ] [ Text ]      │
│                                                              │
│ URL                                                          │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ https://example.com/page                               │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Output                                                       │
│                                                              │
│ [ PDF ▼ ]                                                    │
│                                                              │
│ Mode                                                         │
│                                                              │
│ [ Auto ▼ ]                                                   │
│                                                              │
│                 [ Convert ]                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

The default URL mode is:

```text
AUTO
```

The system performs all detection automatically.

---

# 3. User-Facing URL Modes

Keep the interface simple.

Available modes:

```text
AUTO

FULL PAGE

READER

EDITABLE DOCUMENT

VISUAL CAPTURE

VIEWPORT
```

## AUTO

Recommended default.

The backend decides:

```text
Is this a file?

Is it HTML?

Is it dynamic?

Is it an article?

Does it require Playwright?

Is it JSON?

Is it XML?

Is it authenticated?
```

---

# 4. FULL PAGE Mode

Designed primarily for:

```text
URL -> PDF
URL -> PNG
URL -> JPEG
```

Captures the complete webpage including scrollable content up to configured limits.

---

# 5. READER Mode

Designed for:

```text
articles
blogs
documentation
knowledge bases
news pages
research pages
```

Removes unnecessary webpage chrome where possible.

Potential outputs:

```text
PDF
DOCX
Markdown
HTML
TXT
```

---

# 6. EDITABLE DOCUMENT Mode

Designed primarily for:

```text
URL -> DOCX
URL -> Markdown
URL -> HTML
```

Prioritizes semantic structure:

```text
headings
paragraphs
tables
images
lists
links
```

rather than pixel-perfect webpage appearance.

---

# 7. VISUAL CAPTURE Mode

Prioritizes appearance.

Best for:

```text
complex dashboards
charts
maps
applications
visual reports
```

Outputs:

```text
PDF
PNG
JPEG
```

Optional future output:

```text
Visual DOCX
```

where screenshots or rendered pages are inserted into Word.

---

# 8. Universal URL Architecture

The URL pipeline must NOT be:

```text
URL
 ↓
Gotenberg
 ↓
PDF
```

That is insufficient.

The correct architecture is:

```text
                           USER URL
                              │
                              ▼
                     URL Intake Service
                              │
                              ▼
                     URL Security Guard
                              │
                              ▼
                       URL Inspector
                              │
                              ▼
                      URL Classifier
                              │
       ┌──────────────────────┼───────────────────────┐
       │                      │                       │
       ▼                      ▼                       ▼
   WEB CONTENT            DIRECT FILE          STRUCTURED DATA
       │                      │                       │
       ▼                      ▼                       ▼
 Browser Renderer       Safe Downloader         Data Parser
       │                      │                       │
  ┌────┴─────┐                │                       │
  │          │                │                       │
  ▼          ▼                ▼                       ▼
Gotenberg Playwright    Existing File       JSON/XML/CSV
                        Conversion Pipeline      Pipeline
  │          │
  └────┬─────┘
       │
       ▼
 Rendered DOM
       │
  ┌────┴──────────────────────────┐
  │                               │
  ▼                               ▼
Visual Output              Semantic Extraction
  │                               │
PDF / Image                 Readability
                                  │
                                  ▼
                             Sanitization
                                  │
                                  ▼
                          Normalized HTML
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
                  DOCX         Markdown        HTML
```

---

# 9. Existing Technology Stack

Keep the previously selected project stack.

## Frontend

```text
React
TypeScript
Vite
shadcn/ui
Tiptap
Monaco Editor
PDF.js
Uppy
TanStack Query
Zustand
```

## Backend

```text
NestJS
TypeScript
PostgreSQL
Prisma
Redis
BullMQ
```

## Existing Conversion Engines

```text
Gotenberg
Chromium
LibreOffice
Pandoc
Mammoth
SheetJS
docx
PDFBox / pdfcpu / qpdf
Tesseract later
```

## Storage

```text
Cloudflare R2 / S3-compatible storage
```

## Infrastructure

```text
Docker
Docker Compose
GitHub
GitHub Actions
Railway initially
Cloudflare
```

---

# 10. New Technologies Added for URL Conversion

Add:

```text
Playwright
@mozilla/readability
DOMPurify
jsdom
URL Security Gateway
Controlled outbound proxy
Asset localization service
```

---

# 11. Why We Need Gotenberg AND Playwright

They solve different problems.

## Gotenberg

Use as the normal fast webpage-to-PDF path.

Excellent for:

```text
normal webpages
static webpages
many JavaScript pages
normal SPAs
articles
reports
print-ready web content
```

Gotenberg supports Chromium URL conversion and can wait for selectors or JavaScript expressions before generating the PDF. This is useful for SPA pages whose content appears asynchronously.

---

# 12. Playwright

Use for pages requiring advanced browser behavior.

Examples:

```text
lazy loading
infinite scrolling
clicking
authentication
cookie state
dynamic dashboards
download buttons
popups
complex SPA state
custom wait logic
```

Playwright BrowserContexts provide independent browser sessions without sharing cookies or cache. This is appropriate for job isolation.

---

# 13. URL Conversion Pipeline

Every URL job follows these top-level stages:

```text
RECEIVED
    ↓
NORMALIZED
    ↓
SECURITY_CHECK
    ↓
DNS_CHECK
    ↓
INSPECTION
    ↓
CLASSIFICATION
    ↓
ROUTING
    ↓
FETCHING / RENDERING
    ↓
EXTRACTION
    ↓
CONVERSION
    ↓
VALIDATION
    ↓
STORAGE
    ↓
COMPLETED
```

---

# 14. Step 1 — Receive URL

Example API request:

```json
{
  "source": {
    "type": "url",
    "url": "https://example.com/report"
  },
  "targetFormat": "pdf",
  "settings": {
    "urlMode": "auto"
  }
}
```

---

# 15. Step 2 — URL Normalization

Use the standard WHATWG `URL` implementation.

Normalize:

```text
scheme
hostname
port
path
fragment
```

Do not perform dangerous homemade URL parsing.

---

# 16. Supported Schemes

Initially allow only:

```text
https://
http://
```

Prefer HTTPS.

Reject:

```text
file://
ftp://
smb://
ssh://
gopher://
javascript:
data:
blob:
chrome:
about:
```

OWASP notes that SSRF is not limited to HTTP and that alternate schemes such as `file://` and `gopher://` can be abused when applications blindly accept user-controlled URLs.

---

# 17. Step 3 — SSRF Security Check

This is one of the most important components in the entire project.

Without proper protection, an attacker could submit:

```text
http://localhost

http://127.0.0.1

http://10.0.0.5

http://192.168.1.1

http://169.254.169.254
```

and potentially access your infrastructure.

OWASP explicitly treats server-side user-controlled URL fetching as an SSRF attack surface and recommends application- and network-level defenses.

---

# 18. Create UrlSecurityService

Path:

```text
packages/url-security/
```

or:

```text
apps/api/src/modules/url-security/
```

Recommended package location:

```text
packages/url-security/
```

because workers will also use it.

---

# 19. URL Security Checks

Check:

```text
protocol

hostname syntax

port

DNS A records

DNS AAAA records

resolved IPs

redirect destinations

resource subrequests where possible
```

---

# 20. Block Private IPv4 Ranges

Block at minimum:

```text
0.0.0.0/8

10.0.0.0/8

127.0.0.0/8

169.254.0.0/16

172.16.0.0/12

192.168.0.0/16

224.0.0.0/4
```

and all relevant special/private/reserved ranges.

OWASP specifically identifies localhost, RFC1918 private addresses, link-local addresses and cloud metadata endpoints as destinations that should be blocked in this kind of scenario.

---

# 21. Block Private IPv6

Include at minimum:

```text
::1

fc00::/7

fe80::/10

ff00::/8
```

and other non-public ranges.

Use a battle-tested IP parser library.

Do not implement IP classification using regular expressions.

---

# 22. Cloud Metadata Blocking

Explicitly block infrastructure metadata services.

Example:

```text
169.254.169.254
metadata.google.internal
```

plus provider-specific metadata endpoints.

---

# 23. Docker/Internal Host Blocking

Prevent URL conversion workers from accessing:

```text
postgres
redis
api
worker
gotenberg internal management endpoint
clamav
Docker socket
Railway internal domains
internal Kubernetes services
```

Network isolation should back up application-level checks.

---

# 24. Redirect Security

Never automatically trust redirects.

Example:

```text
public-site.com
      ↓
redirect
      ↓
127.0.0.1
```

must fail.

Process:

```text
Initial URL
 ↓
validate
 ↓
request without uncontrolled redirects
 ↓
receive Location
 ↓
normalize destination
 ↓
resolve DNS
 ↓
validate IP
 ↓
continue
```

Repeat for every redirect.

Maximum:

```text
10 redirects
```

OWASP specifically discusses redirect handling as an SSRF consideration.

---

# 25. DNS Rebinding Defense

Checking a hostname once is insufficient.

We need protection against:

```text
hostname initially resolves to public IP

then later resolves to private IP
```

Use:

```text
DNS resolution validation
+
connection pinning
+
controlled egress proxy
```

where possible.

---

# 26. Controlled Outbound Proxy

Recommended production design:

```text
Browser Worker
      |
      v
Outbound Security Proxy
      |
      v
Destination validation
      |
      v
Internet
```

Browser containers should not have unrestricted direct access to internal infrastructure.

---

# 27. URL Inspection

After security approval, inspect the resource.

Create:

```text
UrlInspectorService
```

It obtains:

```text
HTTP status

final URL

content-type

content-length

content-disposition

filename where available

redirect chain

initial body signature

server response characteristics
```

Do not download huge bodies during initial classification.

---

# 28. Content Type Detection

Never depend only on:

```text
URL extension
```

Example:

```text
https://example.com/download?id=123
```

could be XLSX.

Use:

```text
Content-Type
+
Content-Disposition
+
magic bytes
+
filename where available
```

---

# 29. URL Classification

Create this enum:

```typescript
export enum UrlContentType {
  STATIC_WEBPAGE = 'STATIC_WEBPAGE',
  ARTICLE = 'ARTICLE',
  DYNAMIC_WEBPAGE = 'DYNAMIC_WEBPAGE',
  SPA = 'SPA',

  DIRECT_PDF = 'DIRECT_PDF',
  DIRECT_DOCX = 'DIRECT_DOCX',
  DIRECT_XLSX = 'DIRECT_XLSX',
  DIRECT_PPTX = 'DIRECT_PPTX',
  DIRECT_CSV = 'DIRECT_CSV',
  DIRECT_MARKDOWN = 'DIRECT_MARKDOWN',
  DIRECT_TEXT = 'DIRECT_TEXT',
  DIRECT_IMAGE = 'DIRECT_IMAGE',

  JSON_API = 'JSON_API',
  XML = 'XML',
  RSS = 'RSS',

  GENERIC_DOWNLOAD = 'GENERIC_DOWNLOAD',

  AUTH_REQUIRED = 'AUTH_REQUIRED',
  MEDIA = 'MEDIA',
  BLOCKED = 'BLOCKED',
  UNKNOWN = 'UNKNOWN'
}
```

---

# 30. Detection Example

URL:

```text
https://example.com/download?id=1823
```

Response:

```text
Content-Type:
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

Classification:

```text
DIRECT_XLSX
```

Then:

```text
URL pipeline ends
        ↓
existing XLSX pipeline begins
```

---

# 31. Conversion Router Integration

Modify the existing Conversion Router.

Current idea:

```text
FileAdapter

HtmlAdapter

MarkdownAdapter

TextAdapter
```

Add:

```text
UrlAdapter
```

---

# 32. UrlAdapter

Concept:

```typescript
export class UrlAdapter implements ConversionAdapter {

  supports(request: ConversionRequest) {
    return request.source.type === 'url';
  }

  async convert(request: ConversionRequest) {

    const inspection = await urlInspector.inspect(
      request.source.url
    );

    const route = urlRouter.resolve({
      inspection,
      targetFormat: request.targetFormat,
      settings: request.settings
    });

    return route.execute();
  }
}
```

---

# 33. URL Router

Create:

```text
packages/url-router/
```

or preferably:

```text
packages/conversion-router/src/url/
```

The router selects:

```text
DIRECT_DOWNLOAD

GOTENBERG

PLAYWRIGHT

READABILITY

FILE_PIPELINE

DATA_PIPELINE

IMAGE_PIPELINE
```

---

# 34. Routing Rules

Example:

```typescript
if (source === DIRECT_PDF && target === PDF)
    DIRECT_DOWNLOAD;

if (source === DIRECT_DOCX && target === PDF)
    FILE_PIPELINE;

if (source === DIRECT_XLSX && target === PDF)
    FILE_PIPELINE;

if (source === STATIC_WEBPAGE && target === PDF)
    GOTENBERG;

if (source === DYNAMIC_WEBPAGE && target === PDF)
    PLAYWRIGHT;

if (source === ARTICLE && target === DOCX)
    READABILITY_DOCX_PIPELINE;

if (source === JSON_API && target === XLSX)
    DATA_PIPELINE;
```

---

# 35. Direct File Pipeline

If URL represents a downloadable file:

```text
URL
 ↓
Safe Downloader
 ↓
File Signature Validation
 ↓
ClamAV
 ↓
Private R2 input storage
 ↓
Existing File Conversion Router
```

This allows us to reuse our original platform.

---

# 36. Safe Downloader

Create:

```text
workers/url-worker/src/services/safe-downloader.service.ts
```

Responsibilities:

```text
security validation

redirect validation

streaming download

file-size enforcement

timeout enforcement

hash calculation

content-type capture

content-disposition parsing

temporary storage

malware scan
```

---

# 37. Streaming Downloads

Do not load huge files entirely into application memory.

Wrong:

```typescript
const buffer = await response.arrayBuffer();
```

for large files.

Prefer streamed transfer:

```text
HTTP response
   ↓ stream
temporary file
   ↓
scan
   ↓
object storage
```

---

# 38. Maximum Download Size

Initial defaults:

```text
Free:
25 MB

Pro:
100 MB

Business:
250 MB

Enterprise:
configurable
```

Abort transfer as soon as limit is exceeded.

---

# 39. Static Webpage PDF Pipeline

For normal pages:

```text
URL
 ↓
Gotenberg
 ↓
Chromium
 ↓
PDF
 ↓
PDF Validation
 ↓
R2
```

Gotenberg remains the preferred normal path because it already provides a purpose-built URL-to-PDF Chromium API.

---

# 40. Gotenberg Worker

Do not call Gotenberg directly from the browser frontend.

Flow:

```text
Browser
 ↓
NestJS
 ↓
BullMQ
 ↓
URL Worker
 ↓
Gotenberg private service
```

---

# 41. Dynamic Page Detection

A simple initial inspection may not reliably tell whether a page is dynamic.

Therefore use progressive enhancement.

Strategy:

```text
Try Gotenberg
      ↓
validate output
      ↓
looks correct?
    /     \
  YES      NO
  ↓         ↓
return    Playwright fallback
```

---

# 42. Playwright Worker

Create a separate worker:

```text
workers/browser-worker/
```

Do not put Playwright inside the NestJS API.

Structure:

```text
workers/browser-worker/

src/
  main.ts

  workers/
    browser-render.worker.ts

  services/
    playwright.service.ts
    page-stability.service.ts
    scroll.service.ts
    resource-filter.service.ts
    authentication.service.ts
    download-capture.service.ts
```

---

# 43. Browser Isolation

Each conversion gets a new BrowserContext.

```typescript
const context = await browser.newContext();

try {
  const page = await context.newPage();
  // process URL
} finally {
  await context.close();
}
```

Playwright BrowserContexts are independent browser sessions and do not share cookies/cache by default.

---

# 44. Chromium Process Strategy

Do not necessarily launch one whole Chromium process per tiny job.

Possible production architecture:

```text
Browser Worker Container
      |
      └── Chromium process
            |
            ├── Context Job A
            ├── Context Job B
            └── Context Job C
```

Set low concurrency initially.

Benchmark before increasing.

---

# 45. Browser Job Lifecycle

```text
Create context

Configure permissions

Configure viewport

Configure network rules

Register download handlers

Register popup rules

Open page

Wait

Scroll if enabled

Process cookie overlays where possible

Capture

Close context
```

---

# 46. Page Navigation

Use:

```typescript
await page.goto(url, {
  waitUntil: 'domcontentloaded',
  timeout: NAVIGATION_TIMEOUT
});
```

Do NOT depend exclusively on:

```text
networkidle
```

because modern applications may continuously poll APIs or maintain WebSockets.

---

# 47. Page Stability Service

Create:

```text
PageStabilityService
```

It considers:

```text
DOMContentLoaded

DOM mutations

document height changes

pending fonts

pending images

known loading indicators

optional selector

optional JS expression

short stability interval
```

---

# 48. AUTO Wait Algorithm

Example:

```text
Navigate
 ↓
DOMContentLoaded
 ↓
Wait 300–500 ms
 ↓
Observe DOM changes
 ↓
Wait for fonts
 ↓
Wait for important images
 ↓
Scroll if requested
 ↓
Observe DOM changes
 ↓
Stable for configured interval?
 ↓
Capture
```

---

# 49. Manual Wait Modes

Advanced users/API can request:

```text
AUTO

SELECTOR

EXPRESSION

DELAY
```

Example:

```json
{
  "waitFor": {
    "type": "selector",
    "value": "#report-ready"
  }
}
```

---

# 50. Gotenberg Wait Integration

When appropriate, use Gotenberg:

```text
waitForSelector
```

or:

```text
waitForExpression
```

rather than arbitrary fixed delays. Gotenberg documents both capabilities explicitly for delayed/SPAs rendering.

---

# 51. Lazy Loading

Create:

```text
ScrollService
```

Algorithm:

```text
currentHeight = documentHeight

scroll downward

wait

newHeight = documentHeight

if newHeight > currentHeight:
    continue

otherwise:
    stop
```

---

# 52. Infinite Scroll Protection

Hard limits:

```text
maxScrollIterations

maxDocumentHeight

maxRenderDuration

maxNetworkBytes

maxRequests
```

Suggested starting values:

```text
maxScrollIterations = 25

maxRenderDuration = 60 seconds

maxDocumentHeight = 100000 px
```

These are initial operational values, not permanent product promises.

---

# 53. Resource Filtering

The browser worker should optionally block unnecessary resources.

Potentially block:

```text
video

audio

large media

known tracking hosts

advertising where safe
```

Do NOT block:

```text
stylesheets

fonts

essential scripts

API calls required for page content

images
```

unless configured.

---

# 54. Resource Budgets

Track:

```text
request count

downloaded bytes

response sizes

elapsed time
```

Abort pathological pages.

---

# 55. JavaScript Dialogs

Prevent:

```text
alert()

confirm()

prompt()
```

from hanging conversions.

Playwright automatically dismisses dialogs when no custom listener is installed; explicit handling can be added where required.

---

# 56. Popup Handling

Default:

```text
block unnecessary popups
```

If a popup becomes the actual desired document:

```text
capture popup URL
 ↓
run security validation
 ↓
continue
```

---

# 57. Browser Download Detection

A webpage may trigger a downloadable file.

Example:

```text
Click "Download Report"
       ↓
browser downloads XLSX
```

Playwright exposes download events and allows the downloaded file to be saved and processed.

Pipeline:

```text
Download event
 ↓
temporary file
 ↓
type detection
 ↓
scan
 ↓
normal file pipeline
```

---

# 58. Webpage-to-PDF Modes

Support:

```text
SCREEN

PRINT

FULL_PAGE

VIEWPORT

READER
```

---

# 59. SCREEN Mode

Try to preserve how the page looks in a normal browser.

Useful for:

```text
dashboards
product pages
landing pages
web applications
```

---

# 60. PRINT Mode

Allow the website's:

```css
@media print
```

styles to control output.

Useful for:

```text
articles
reports
invoices
documentation
```

---

# 61. PDF Options

Existing output settings can apply:

```text
A4

A3

A5

Letter

Legal

Custom

Portrait

Landscape

Margins

Header

Footer

Page numbers

Background graphics

Scale
```

---

# 62. Webpage-to-DOCX Pipeline

This pipeline differs fundamentally from PDF.

Do not primarily use:

```text
URL
 ↓
PDF
 ↓
DOCX
```

Instead:

```text
URL
 ↓
Playwright
 ↓
Rendered DOM
 ↓
Content detection
 ↓
Readability or Full DOM Normalizer
 ↓
Sanitization
 ↓
Asset Localization
 ↓
Pandoc
 ↓
DOCX
```

---

# 63. Rendered DOM

Use the DOM after JavaScript has executed.

Example:

```typescript
const html = await page.content();
```

This captures the rendered HTML state more accurately than fetching the initial source.

---

# 64. Article Detection

Use:

```text
@mozilla/readability
```

First check:

```text
isProbablyReaderable()
```

Then:

```text
Readability.parse()
```

Mozilla notes that `isProbablyReaderable()` is heuristic and may produce false positives/negatives, so it should not be our only decision-maker.

---

# 65. Readability Output

Typical result:

```text
title

byline

content

textContent

siteName

language

publishedTime
```

This is ideal for creating:

```text
DOCX
Markdown
clean HTML
TXT
```

---

# 66. Full DOM Fallback

If Readability produces weak results:

```text
Rendered DOM
 ↓
DOM Normalizer
```

Normalize:

```text
headings

paragraphs

lists

tables

images

links

code blocks

blockquote

horizontal rules
```

Remove:

```text
script

style where unnecessary

hidden elements

tracking widgets

navigation where mode permits

interactive controls
```

---

# 67. HTML Sanitization

Readability does NOT sanitize untrusted output.

Mozilla explicitly recommends using a sanitizer such as DOMPurify and adding CSP defense in depth.

Pipeline:

```text
Rendered HTML
 ↓
Readability / Normalizer
 ↓
DOMPurify
 ↓
Safe HTML
```

---

# 68. Asset Localization

Create:

```text
AssetLocalizerService
```

Purpose:

Convert webpage dependencies into stable local document assets.

Example:

```html
<img src="/img/product.jpg">
```

resolve to:

```text
https://example.com/img/product.jpg
```

then:

```text
security validation
 ↓
safe download
 ↓
size check
 ↓
image validation
 ↓
temporary local asset
 ↓
embed in DOCX
```

---

# 69. Relative URL Resolution

Resolve:

```text
/images/pic.jpg

../images/pic.jpg

/product/123
```

using the final page URL as base.

Readability also recommends providing the source page URI to the DOM implementation so relative images/links can be resolved correctly.

---

# 70. External Images

Each external image is itself a URL.

Therefore every image request must pass through:

```text
URL Security Guard
```

Do not permit asset localization to bypass SSRF protection.

---

# 71. Image Failures

If a non-critical image fails:

```text
continue conversion
+
add warning
```

Example:

```text
3 of 28 remote images could not be embedded.
```

---

# 72. Canvas Content

Canvas elements do not translate naturally to semantic DOCX.

For DOCX:

```text
canvas
 ↓
browser screenshot of element
 ↓
PNG
 ↓
embed
```

---

# 73. SVG

Try to preserve SVG if supported by target engine.

Otherwise:

```text
SVG
 ↓
rasterize
 ↓
PNG
```

---

# 74. WebGL

For visual output:

```text
capture rendered result
```

For editable Word:

```text
embed screenshot
```

No attempt should be made to translate a WebGL scene into editable Word graphics.

---

# 75. Iframes

For PDF:

Chromium captures what is visibly rendered.

For semantic extraction:

```text
same-origin iframe
 → potentially extract

cross-origin iframe
 → visual fallback or link
```

---

# 76. Embedded Video

For document output:

represent as:

```text
thumbnail

video title

source link
```

Do not try to embed a streaming video into normal PDF output.

---

# 77. Direct Media URLs

Examples:

```text
.mp4
.mp3
.m3u8
```

Initial classification:

```text
MEDIA
```

Return:

```text
This URL points to media rather than a supported document/web resource.
```

Media conversion can become a separate product module later.

---

# 78. JSON URL Pipeline

Example:

```text
https://api.example.com/products
```

Response:

```json
[
  {
    "sku": "A1",
    "price": 22.5
  }
]
```

Pipeline:

```text
URL
 ↓
Safe Fetch
 ↓
JSON Parser
 ↓
Schema Detection
 ↓
Normalized rows
 ↓
SheetJS / document generator
```

Outputs:

```text
JSON
CSV
XLSX
HTML
PDF
DOCX
```

---

# 79. XML URL Pipeline

```text
URL
 ↓
Safe Fetch
 ↓
secure XML parser
 ↓
normalized structure
 ↓
output pipeline
```

Disable:

```text
external entities
DTD processing where unnecessary
remote entity loading
```

to avoid XXE-style problems.

---

# 80. RSS / Atom

Detect feed response.

Extract:

```text
title

items

publication date

author

links

summary
```

Possible output:

```text
PDF
DOCX
HTML
CSV
XLSX
```

---

# 81. Direct Markdown URL

Pipeline:

```text
URL
 ↓
safe download
 ↓
Markdown
 ↓
Pandoc
```

Outputs:

```text
PDF
DOCX
HTML
TXT
```

---

# 82. Direct CSV URL

Pipeline:

```text
URL
 ↓
safe download
 ↓
CSV parser / SheetJS
```

Outputs:

```text
XLSX
CSV
JSON
HTML
PDF
```

---

# 83. Authentication — Phase 1

MVP should support:

```text
PUBLIC URL
```

and optionally controlled API headers for developer/API use.

Do not ask users for arbitrary website usernames/passwords.

---

# 84. Authentication — Phase 2

Support:

```text
Authorization header

approved cookies

temporary browser session
```

All credentials must be encrypted.

---

# 85. Authentication — Phase 3

Support official integrations where appropriate:

```text
OAuth

Google

Microsoft

Notion

Confluence

other enterprise systems
```

---

# 86. Browser Authentication State

Playwright supports persisting/reusing browser authentication state, but its documentation warns that authentication files can contain sensitive cookies and headers capable of impersonating the user.

Therefore:

```text
Never commit auth state

Encrypt at rest

Limit scope

Limit lifetime

Delete after use unless user explicitly saves connection
```

---

# 87. Auth Session Database

Create:

```text
web_auth_sessions
```

Fields:

```text
id

organization_id

user_id

domain

encrypted_state_key

created_at

expires_at

last_used_at

revoked_at
```

Do NOT store raw cookie JSON directly in normal database columns.

Store encrypted state in private object storage or secrets storage.

---

# 88. CAPTCHA Handling

Do not attempt CAPTCHA bypass.

If detected:

```text
CAPTCHA_REQUIRED
```

User message:

```text
This page requires interactive verification.
Use browser capture or an authorized integration.
```

---

# 89. Anti-Bot Handling

Possible indicators:

```text
403

429

challenge page

automation-block page
```

Return:

```text
PAGE_BLOCKED_BY_REMOTE_SITE
```

Do not endlessly retry.

---

# 90. Browser Extension Fallback

This should be part of the long-term universal URL strategy.

Architecture:

```text
User opens webpage normally

User is authenticated normally

Browser extension captures authorized rendered page

Snapshot sent to our backend

Snapshot converted to:
PDF / DOCX / HTML / Markdown
```

This is particularly useful for:

```text
MFA-protected sites

private portals

complex browser sessions

sites that reject server browsers
```

---

# 91. What Browser Extension Sends

Prefer sending:

```text
rendered DOM snapshot

styles required for rendering

selected local assets

page metadata
```

or:

```text
print-ready snapshot
```

depending on conversion mode.

Do not blindly transmit all browser data.

---

# 92. New Database Fields

Modify:

```text
conversion_jobs
```

Add:

```text
source_type

source_url_id

render_strategy

fallback_strategy

quality_level
```

---

# 93. source_type Enum

```text
FILE

HTML

MARKDOWN

TEXT

URL

STRUCTURED_DATA
```

---

# 94. url_sources Table

```text
id

organization_id

user_id

original_url

normalized_url

final_url

hostname

scheme

http_status

content_type

content_length

classification

requires_auth

redirect_count

created_at
```

---

# 95. URL Sensitive Data

Do not store full query strings blindly.

Example:

```text
?token=abc
?signature=xyz
?access_token=...
```

Create:

```text
safe_display_url
```

Example:

```text
https://example.com/download?token=[REDACTED]
```

---

# 96. url_fetch_events Table

Optional but useful:

```text
id

url_source_id

event_type

safe_url

status_code

content_type

duration_ms

created_at
```

Do not persist sensitive response bodies.

---

# 97. Conversion Strategy Enum

```text
DIRECT_DOWNLOAD

GOTENBERG

PLAYWRIGHT

READABILITY

DOM_NORMALIZER

FILE_PIPELINE

DATA_PIPELINE

IMAGE_PIPELINE

BROWSER_CAPTURE
```

---

# 98. Quality Level

Store:

```text
EXACT

HIGH

GOOD

BEST_EFFORT

PARTIAL
```

Examples:

```text
Direct PDF → PDF
EXACT

Public webpage → PDF
HIGH

Article → DOCX
HIGH/GOOD

Complex dashboard → DOCX
BEST_EFFORT
```

---

# 99. URL Job Statuses

Extend job lifecycle:

```text
CREATED

URL_VALIDATING

URL_RESOLVING

URL_INSPECTING

URL_CLASSIFIED

QUEUED

FETCHING

RENDERING

EXTRACTING

CONVERTING

OUTPUT_VALIDATING

COMPLETED

FAILED

CANCELLED

EXPIRED
```

---

# 100. Queue Architecture

Create dedicated queues:

```text
url:inspect

url:download

url:render

url:extract
```

Existing queues remain:

```text
conversion:office

conversion:pdf

conversion:data

conversion:image
```

---

# 101. Why Use BullMQ

Browser and document conversion tasks should not block API requests.

BullMQ allows independent workers and horizontal scaling; its documentation recommends multiple workers for improved availability.

---

# 102. Worker Architecture

```text
NestJS API
   |
   v
Redis / BullMQ
   |
   ├── url-inspector-worker
   |
   ├── browser-worker
   |
   ├── office-worker
   |
   ├── data-worker
   |
   └── pdf-worker
```

---

# 103. CPU-Intensive Tasks

Do not assume high Node concurrency is beneficial for Chromium/OCR/heavy conversions.

BullMQ documentation notes that increasing concurrency helps I/O-heavy workloads, while CPU-intensive workloads can suffer and may benefit from isolated/sandboxed processing.

Therefore:

```text
Browser workers:
low concurrency

LibreOffice:
low concurrency

OCR:
very low concurrency
```

Benchmark actual values.

---

# 104. Retry Policy

Retry:

```text
temporary DNS problem

temporary remote server error

worker crash

storage interruption

browser process crash
```

Do not automatically retry:

```text
invalid URL

blocked private IP

malware

CAPTCHA

unsupported protocol

unsupported media

authentication required
```

---

# 105. Retry Configuration

Example:

```typescript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  }
}
```

BullMQ supports automatic retries and fixed/exponential backoff strategies.

---

# 106. URL Error Codes

Implement:

```text
INVALID_URL

UNSUPPORTED_PROTOCOL

DNS_FAILURE

BLOCKED_IP

BLOCKED_HOST

BLOCKED_PRIVATE_NETWORK

REDIRECT_LIMIT

REDIRECT_BLOCKED

CONNECTION_TIMEOUT

PAGE_LOAD_TIMEOUT

PAGE_RENDER_TIMEOUT

REMOTE_401

REMOTE_403

REMOTE_404

REMOTE_429

REMOTE_5XX

AUTH_REQUIRED

CAPTCHA_REQUIRED

BOT_CHALLENGE

DOWNLOAD_TOO_LARGE

RESOURCE_BUDGET_EXCEEDED

UNSUPPORTED_MEDIA

UNKNOWN_CONTENT_TYPE

MALWARE_DETECTED

CONVERSION_FAILED

OUTPUT_INVALID
```

---

# 107. Frontend Errors

Do not show:

```text
ECONNRESET
Navigation timeout of 30000 ms exceeded
```

Show:

```text
The webpage took too long to load.
```

or:

```text
The website prevented automated access.
```

or:

```text
This URL points to a private or restricted network address.
```

---

# 108. Conversion Warnings

Warnings should not fail a successful output.

Examples:

```text
2 remote images could not be loaded.

A custom font was replaced.

Infinite scrolling was captured up to the configured limit.

An iframe could not be included.

Interactive charts were converted to static images.
```

---

# 109. API

Reuse:

```http
POST /api/v1/conversions
```

---

# 110. Standard URL Request

```json
{
  "source": {
    "type": "url",
    "url": "https://example.com"
  },

  "targetFormat": "pdf",

  "settings": {
    "urlMode": "auto"
  }
}
```

---

# 111. Advanced URL Request

```json
{
  "source": {
    "type": "url",
    "url": "https://example.com/report"
  },

  "targetFormat": "pdf",

  "settings": {
    "urlMode": "full-page",

    "pageSize": "A4",

    "orientation": "portrait",

    "includeBackground": true,

    "autoScroll": true,

    "waitStrategy": {
      "type": "auto"
    }
  }
}
```

---

# 112. DOCX Request

```json
{
  "source": {
    "type": "url",
    "url": "https://example.com/article"
  },

  "targetFormat": "docx",

  "settings": {
    "urlMode": "editable-document",

    "includeImages": true,

    "includeLinks": true,

    "includeSourceUrl": true
  }
}
```

---

# 113. Response

```json
{
  "id": "conv_9812",
  "status": "URL_INSPECTING",
  "sourceType": "URL",
  "targetFormat": "PDF",
  "progress": 10
}
```

---

# 114. Status Endpoint

```http
GET /api/v1/conversions/:id
```

Response:

```json
{
  "id": "conv_9812",

  "status": "RENDERING",

  "progress": 68,

  "classification": "DYNAMIC_WEBPAGE",

  "warnings": []
}
```

---

# 115. Realtime Updates

Use:

```text
Server-Sent Events
```

initially.

Example:

```text
10% Inspecting URL

20% Loading webpage

55% Rendering page

80% Creating PDF

95% Validating

100% Complete
```

---

# 116. Updated Repository Structure

```text
document-platform/

├── apps/
│   ├── web/
│   ├── api/
│   └── admin/
│
├── workers/
│   ├── url-inspector-worker/
│   ├── browser-worker/
│   ├── conversion-worker/
│   ├── office-worker/
│   ├── data-worker/
│   ├── image-worker/
│   └── pdf-worker/
│
├── packages/
│   ├── conversion-router/
│   ├── url-security/
│   ├── url-types/
│   ├── storage/
│   ├── file-validation/
│   ├── api-contracts/
│   ├── logging/
│   ├── telemetry/
│   └── shared-types/
│
├── infrastructure/
│   ├── docker/
│   ├── railway/
│   ├── network/
│   └── monitoring/
│
└── tests/
    ├── urls/
    ├── files/
    ├── security/
    ├── integration/
    └── regression/
```

---

# 117. browser-worker Structure

```text
browser-worker/

src/

├── main.ts

├── browser/
│   ├── browser-manager.ts
│   ├── context-factory.ts
│   └── browser-limits.ts

├── rendering/
│   ├── page-renderer.ts
│   ├── pdf-renderer.ts
│   ├── screenshot-renderer.ts
│   └── dom-capture.ts

├── stability/
│   ├── stability-detector.ts
│   ├── scroll-manager.ts
│   └── wait-strategy.ts

├── security/
│   ├── request-interceptor.ts
│   └── resource-policy.ts

├── downloads/
│   └── browser-download-handler.ts

└── extraction/
    ├── readability-extractor.ts
    ├── dom-normalizer.ts
    └── asset-localizer.ts
```

---

# 118. Docker Architecture

Development:

```text
docker-compose.yml
```

Services:

```text
web

api

postgres

redis

gotenberg

clamav

url-inspector-worker

browser-worker

office-worker

data-worker
```

---

# 119. Browser Worker Container

Use official Playwright-compatible base image or carefully pinned Chromium environment.

Pin:

```text
Playwright version

Chromium version
```

Never use uncontrolled latest versions in production.

---

# 120. Network Segmentation

Create separate Docker networks.

Example:

```text
frontend-network

application-network

conversion-network

egress-network
```

Browser workers should not have direct database access unless absolutely required.

Ideally:

```text
Browser worker
  can access:
    Redis
    storage
    controlled internet

Browser worker
  cannot access:
    PostgreSQL directly
    internal admin endpoints
```

---

# 121. Gotenberg Network

Keep Gotenberg:

```text
private
```

Never expose Gotenberg directly to the public internet.

Only:

```text
authorized backend/worker services
```

should access it.

---

# 122. Storage

R2 buckets:

```text
converter-quarantine

converter-inputs

converter-outputs

converter-assets

converter-auth-state

converter-previews
```

---

# 123. Temporary URL Assets

Example:

```text
job-assets/
  job_812/
    image-1.jpg
    image-2.png
    screenshot-chart.png
```

Delete after job completion unless required in final output.

---

# 124. Cleanup

Every job must use:

```text
try
finally
```

equivalent cleanup logic.

Delete:

```text
temporary browser context

downloaded temporary files

temporary HTML

temporary screenshots

temporary asset files
```

---

# 125. Browser Timeouts

Initial:

```text
DNS:
5 seconds

Connection:
10 seconds

Navigation:
30 seconds

Render:
60 seconds

Total job:
120 seconds
```

Higher limits can apply by plan.

---

# 126. Request Limits

Initial:

```text
Maximum resource count:
1000

Maximum network download:
100 MB

Maximum HTML:
20 MB

Maximum direct file:
100 MB

Maximum scroll loops:
25
```

These should be configurable centrally.

---

# 127. Central Limits Configuration

Create:

```typescript
interface UrlProcessingLimits {

  navigationTimeoutMs: number;

  renderTimeoutMs: number;

  maxRequests: number;

  maxNetworkBytes: number;

  maxDirectFileBytes: number;

  maxHtmlBytes: number;

  maxRedirects: number;

  maxScrollIterations: number;
}
```

---

# 128. Logging

Log:

```text
job ID

safe domain

classification

strategy

fallback used

duration

HTTP status

bytes transferred

render time

conversion time

warnings
```

Never log:

```text
cookies

authorization tokens

raw query secrets

document body

full private content
```

---

# 129. Metrics

Track:

```text
url_jobs_total

url_jobs_success

url_jobs_failed

url_gotenberg_success

url_playwright_fallback

url_direct_file

url_json

url_auth_required

url_captcha

url_blocked_ssrf

url_render_duration

url_download_bytes

url_output_validation_failures
```

---

# 130. Monitoring Dashboard

Grafana panels:

```text
URL Conversion Volume

Success %

Failure %

Gotenberg vs Playwright %

Average Render Time

Queue Depth

Browser Worker CPU

Browser Worker Memory

Top Error Codes

SSRF Blocks

Remote 429 Rate

Remote 403 Rate
```

---

# 131. Health Endpoints

Browser worker:

```text
/health/live

/health/ready
```

Check:

```text
Redis

Chromium startup

temporary disk

object storage

Gotenberg connectivity where applicable
```

---

# 132. Testing Strategy

URL conversion requires a dedicated test suite.

---

# 133. Local Test Website

Create your own controlled web test application.

Example:

```text
tests/url-fixtures-server/
```

Routes:

```text
/static

/article

/react-spa

/lazy-load

/infinite-scroll

/canvas

/svg

/iframe

/redirect

/multi-redirect

/download/pdf

/download/docx

/download/xlsx

/json

/xml

/rss

/auth

/slow

/huge

/error/500
```

Do not depend solely on real external websites for automated regression tests.

---

# 134. Static Page Test

Validate:

```text
text

images

CSS

fonts

links

tables
```

---

# 135. React SPA Test

Page initially:

```text
Loading...
```

then JavaScript inserts:

```text
Report Ready
```

Ensure final document contains:

```text
Report Ready
```

---

# 136. Lazy Loading Test

Page loads:

```text
image 1
```

only after scrolling.

Ensure output contains it.

---

# 137. Infinite Scroll Test

Page generates content indefinitely.

Ensure:

```text
worker stops at configured limit

job succeeds

warning returned
```

---

# 138. Direct File Test

Test URLs that return:

```text
PDF

DOCX

XLSX

CSV

PNG
```

without useful filename extensions.

---

# 139. Redirect Tests

Test:

```text
public → public

multiple public redirects

redirect loop

public → private IP
```

Last case must be blocked.

---

# 140. SSRF Security Tests

Mandatory tests:

```text
localhost

127.0.0.1

0.0.0.0

private IPv4

private IPv6

link-local

metadata endpoint

redirect to private IP

hostname resolving to private IP

malformed IP encodings

alternate numeric representations
```

OWASP recommends canonical parsing and public/private address validation rather than fragile string matching.

---

# 141. Malware Test

Direct file URL serves:

```text
malware test fixture
```

Expected:

```text
MALWARE_DETECTED

conversion blocked
```

---

# 142. Resource Bomb Test

Page references:

```text
thousands of assets
```

Expected:

```text
RESOURCE_BUDGET_EXCEEDED
```

without taking down worker.

---

# 143. Slow Page Test

Server intentionally responds slowly.

Ensure:

```text
timeout

worker cleanup

clear user error
```

---

# 144. Browser Crash Test

Kill Chromium during conversion.

Expected:

```text
worker detects failure

eligible retry

no orphan temp data
```

---

# 145. Golden PDF Tests

For controlled fixture pages:

```text
URL
 ↓
PDF
 ↓
render pages to images
 ↓
compare against baseline
```

Use tolerances.

---

# 146. DOCX Structural Tests

Check:

```text
headings exist

paragraph count

images embedded

tables preserved

links correct
```

Do not rely solely on file existence.

---

# 147. Output Validation

PDF:

```text
valid signature

parses successfully

at least 1 page

non-empty
```

DOCX:

```text
valid ZIP

required DOCX package files

non-empty document.xml
```

XLSX:

```text
valid workbook structure
```

---

# 148. Browser Version Regression

Before updating:

```text
Playwright

Chromium

Gotenberg
```

run complete URL golden test corpus.

---

# 149. Phase 1 — Foundation

Build:

```text
URL input frontend

URL API model

URL normalization

URL Security Service

DNS/IP validation

redirect validator

URL inspector

URL classification

url_sources database table

url:inspect queue
```

No browser rendering initially.

---

# 150. Phase 2 — Direct URL Files

Implement:

```text
direct PDF URL

direct DOCX URL

direct XLSX URL

direct CSV URL

direct image URL
```

Reuse original conversion pipelines.

This gives immediate production value.

---

# 151. Phase 3 — Basic Webpage PDF

Add:

```text
Gotenberg URL conversion
```

Support:

```text
static webpage → PDF

normal SPA → PDF

screen/print modes
```

---

# 152. Phase 4 — Advanced Browser Worker

Add:

```text
Playwright

BrowserContext isolation

auto wait

lazy loading

scrolling

download detection

Gotenberg fallback
```

---

# 153. Phase 5 — URL to Word

Add:

```text
Rendered DOM

Readability

DOMPurify

DOM normalization

asset localization

Pandoc

DOCX templates
```

---

# 154. Phase 6 — Structured URLs

Add:

```text
JSON URL

XML URL

RSS URL

CSV endpoint
```

---

# 155. Phase 7 — Authenticated URLs

Add:

```text
authorization headers

temporary cookies

encrypted session storage
```

---

# 156. Phase 8 — Browser Extension

Add:

```text
Chrome extension

Edge extension

capture current page

send authorized snapshot

convert
```

---

# 157. Phase 9 — Enterprise Internal URLs

Only for controlled deployments.

Implement:

```text
domain allowlists

private network allowlists

admin policies

network segmentation

audit logs
```

---

# 158. Build Order — Exact Sequence

Recommended engineering sequence:

```text
1. Extend source-type contracts with URL.

2. Add URL input UI.

3. Add url_sources migration.

4. Implement UrlSecurityService.

5. Implement public/private IP classification.

6. Implement safe DNS resolution.

7. Implement redirect validation.

8. Build UrlInspectorService.

9. Build ContentTypeDetector.

10. Build URL classification enum.

11. Create url:inspect BullMQ queue.

12. Create url-inspector-worker.

13. Implement SafeDownloader.

14. Add streaming file download.

15. Integrate ClamAV.

16. Route direct PDF URLs.

17. Route direct DOCX URLs.

18. Route direct XLSX URLs.

19. Route image URLs.

20. Integrate Gotenberg URL rendering.

21. Implement static webpage → PDF.

22. Add PDF validation.

23. Add URL conversion progress events.

24. Build browser-worker.

25. Install Playwright Chromium.

26. Add BrowserContext isolation.

27. Add page navigation.

28. Add stability detector.

29. Add auto scrolling.

30. Add resource budgets.

31. Add browser download handling.

32. Add Gotenberg → Playwright fallback.

33. Add DOM capture.

34. Add Readability.

35. Add DOMPurify.

36. Add DOM normalizer.

37. Add asset localization.

38. Add URL → DOCX.

39. Add URL → Markdown.

40. Add URL → HTML.

41. Add JSON URLs.

42. Add XML/RSS URLs.

43. Add authenticated session architecture.

44. Add monitoring.

45. Add URL security dashboard.

46. Add complete URL fixture test site.

47. Add SSRF test suite.

48. Add browser regression tests.

49. Load test browser workers.

50. Deploy staging.

51. Security review.

52. Production rollout.
```

---

# 159. MVP Definition

URL MVP should not include everything immediately.

MVP is successful when these reliably work:

```text
Public webpage → PDF

React/SPA webpage → PDF

lazy-loaded page → PDF

direct PDF URL → PDF

direct DOCX URL → PDF

direct XLSX URL → PDF

direct image URL → PDF

article → DOCX

article → Markdown

public webpage → screenshot
```

And:

```text
private/internal URLs are blocked

malicious direct files are blocked

redirect attacks are blocked

timeouts work

workers recover

outputs are validated
```

---

# 160. Version 2 Definition

Add:

```text
JSON API → XLSX

JSON API → PDF

XML → XLSX

RSS → PDF

complex webpage → DOCX

browser downloads

authenticated headers

temporary cookies

saved presets
```

---

# 161. Version 3

Add:

```text
Browser extension

OAuth integrations

enterprise private URL conversion

saved authenticated connections

desktop capture

bulk URL conversion

scheduled URL conversion

change monitoring
```

---

# 162. Bulk URL Conversion Later

Example:

```text
100 URLs
 ↓
queue
 ↓
parallel controlled workers
 ↓
100 PDFs
 ↓
ZIP
```

Apply:

```text
domain rate limits

worker limits

total job limits
```

so the platform does not hammer third-party websites.

---

# 163. Scheduled URL Conversion Later

Potential feature:

```text
Convert this URL every Monday.
```

Useful for:

```text
reports

dashboards

snapshots

archives
```

This should require explicit user configuration.

---

# 164. URL Change Monitoring Later

Potential feature:

```text
Check this authorized webpage daily.

If content changes:
    create new PDF.
```

This becomes a separate monitoring product feature.

---

# 165. Product Reliability Strategy

There should be multiple fallback levels.

For webpage PDF:

```text
Gotenberg
   ↓ fail
Gotenberg advanced wait
   ↓ fail
Playwright
   ↓ fail
specific diagnostic
```

For DOCX:

```text
Readability
   ↓ unsuitable
Full DOM normalization
   ↓ poor fidelity
Visual DOCX fallback
```

---

# 166. Do Not Hide Failures

Never create an empty PDF and report:

```text
Success
```

Success requires:

```text
valid source

successful rendering/fetch

valid output

non-empty output

format validation
```

---

# 167. Supported URL Promise

The product can confidently say:

> Convert public webpages, JavaScript applications, online documents, downloadable files, images, structured data endpoints and authorized private web content into supported file formats.

Do NOT claim:

> Literally every URL on the internet always works.

Some resources can intentionally prevent automated access.

---

# 168. Controlled Limitations

Return explicit status for:

```text
CAPTCHA

strong anti-bot block

DRM

expired link

unauthorized resource

unsupported streaming media

broken server

inaccessible page

private network resource
```

These are controlled outcomes, not system crashes.

---

# 169. Final Production Architecture

```text
                              USER
                                │
                                ▼
                           React Web
                                │
                                ▼
                           NestJS API
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
           PostgreSQL         Redis             R2
                                │
                                ▼
                              BullMQ
                                │
                 ┌──────────────┼───────────────┐
                 │              │               │
                 ▼              ▼               ▼
          URL Inspector    Browser Worker   File Workers
                 │              │               │
                 ▼              ▼               ▼
          Security Guard    Gotenberg       LibreOffice
                 │          Playwright       Pandoc
                 │              │            SheetJS
                 │              │               │
                 └──────────────┼───────────────┘
                                │
                                ▼
                        Conversion Router
                                │
                                ▼
                         Output Validation
                                │
                                ▼
                           R2 Storage
                                │
                                ▼
                        Preview / Download
```

---

# 170. Critical Architecture Rules

These should be locked.

## Rule 1

Never perform Chromium rendering inside the API process.

---

## Rule 2

Never allow browser workers unrestricted access to internal networks.

---

## Rule 3

Never trust URL extensions.

---

## Rule 4

Never trust `Content-Type` alone.

---

## Rule 5

Validate every redirect.

---

## Rule 6

Validate every remotely downloaded asset.

---

## Rule 7

Use fresh browser contexts per job.

---

## Rule 8

Always close browser contexts.

---

## Rule 9

Apply hard CPU, memory, network and execution limits.

---

## Rule 10

Always scan direct downloadable files.

---

## Rule 11

Sanitize extracted HTML.

---

## Rule 12

Do not log URL authentication secrets.

---

## Rule 13

Do not automatically bypass CAPTCHA or anti-bot systems.

---

## Rule 14

Pin Chromium/Gotenberg/Playwright versions.

---

## Rule 15

Run regression tests before browser engine upgrades.

---

## Rule 16

Validate output before marking conversion successful.

---

## Rule 17

Use fallbacks instead of one universal renderer.

---

## Rule 18

Do not promise perfect DOCX fidelity for arbitrary web applications.

---

## Rule 19

Do not store temporary webpage data longer than necessary.

---

## Rule 20

Keep URL conversion as part of the same central Conversion Router as file conversion.

---

# 171. Final Combined Product Inputs

Our platform should ultimately accept:

```text
FILE

URL

HTML

MARKDOWN

TEXT

JSON

XML

CSV

IMAGE
```

---

# 172. Final Combined Product Outputs

Depending on the source:

```text
PDF

DOCX

HTML

MARKDOWN

TXT

XLSX

CSV

JSON

PNG

JPEG
```

---

# 173. Final System Philosophy

URL conversion is not a single:

```text
URL → PDF
```

function.

It is:

```text
URL
 ↓
Understand
 ↓
Secure
 ↓
Classify
 ↓
Render / Download / Parse
 ↓
Extract
 ↓
Normalize
 ↓
Convert
 ↓
Validate
 ↓
Store
 ↓
Deliver
```

That architecture is what makes the system robust.

---

# 174. Final Definition

The completed platform becomes:

> **A universal document and web-content conversion platform that intelligently accepts uploaded files, raw content, structured data and URLs; identifies the source type; securely downloads, renders or extracts it; routes it through specialized conversion engines; validates the generated output; and delivers PDF, Word, spreadsheet, web, text or image formats through one unified application.**

---

# 175. Engineering Decision

For the URL subsystem, lock the following:

```text
Normal webpage PDF
→ Gotenberg + Chromium

Complex/dynamic webpage
→ Playwright + Chromium

Direct downloadable file
→ Safe Downloader + existing file pipeline

Article / webpage → DOCX
→ Playwright + Readability + DOMPurify + Pandoc

General webpage → DOCX
→ Playwright + DOM Normalizer + Asset Localizer + Pandoc

JSON
→ Structured Data Pipeline + SheetJS

XML/RSS
→ Secure Parser + Structured Data Pipeline

Authentication
→ Playwright BrowserContext / official OAuth later

CAPTCHA / strong anti-bot
→ controlled failure + browser-extension fallback

Security
→ URL Security Guard + network isolation + SSRF protection

Queue
→ Redis + BullMQ

Storage
→ Private Cloudflare R2 / S3

Application
→ React + NestJS + PostgreSQL
```

This should be treated as the implementation baseline for the Universal URL-to-File feature.