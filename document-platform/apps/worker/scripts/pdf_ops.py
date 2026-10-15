#!/usr/bin/env python3
"""Server-side PDF operations for AppToolkitLab, built on PyMuPDF.

Usage: pdf_ops.py <operation> <input.pdf> <output>
Options (and secrets such as passwords) are read as JSON from stdin so they
never appear in the process list. Errors are written to stderr as a single
line beginning with "USER_ERROR:" when they are safe to show to customers.
"""

import io
import json
import os
import re
import sys
import zipfile

import pymupdf

SAFE_PREFIX = "USER_ERROR:"


class UserError(Exception):
    """An error whose message is safe and useful to show to the customer."""


def find_tessdata():
    candidates = [os.environ.get("TESSDATA_PREFIX", "")]
    for root in ("/usr/share/tesseract-ocr", "/opt/homebrew/share", "/usr/local/share"):
        if os.path.isdir(root):
            for dirpath, dirnames, _ in os.walk(root):
                if os.path.basename(dirpath) == "tessdata":
                    candidates.append(dirpath)
    for candidate in candidates:
        if candidate and os.path.isfile(os.path.join(candidate, "eng.traineddata")):
            return candidate
    raise UserError("OCR is not available on this server.")


def open_pdf(path, password=None):
    try:
        doc = pymupdf.open(path)
    except Exception:
        raise UserError("This file is damaged beyond repair or is not a PDF.")
    if doc.needs_pass:
        if not password:
            raise UserError("This PDF is password-protected. Enter its password, or unlock it first.")
        if not doc.authenticate(password):
            raise UserError("The password is incorrect.")
    return doc


def save_pdf(doc, output, **kwargs):
    options = {"garbage": 3, "deflate": True}
    options.update(kwargs)
    doc.save(output, **options)


# ── Operations ───────────────────────────────────────────────────────────


def compress(input_path, output, options):
    level = options.get("compressionLevel", "recommended")
    settings = {
        "low": None,
        "recommended": {"dpi_threshold": 200, "dpi_target": 150, "quality": 75},
        "extreme": {"dpi_threshold": 120, "dpi_target": 96, "quality": 50},
    }
    if level not in settings:
        raise UserError("Choose a valid compression level.")
    doc = open_pdf(input_path)
    if settings[level]:
        doc.rewrite_images(**settings[level])
    try:
        doc.subset_fonts()
    except Exception:
        pass  # Font subsetting is an optimisation; never fail the job over it.
    save_pdf(doc, output, garbage=4, deflate=True, deflate_images=True, deflate_fonts=True, clean=True, use_objstms=1)
    doc.close()
    # Never hand back a "compressed" file that is larger than the original.
    if os.path.getsize(output) >= os.path.getsize(input_path):
        with open(input_path, "rb") as source, open(output, "wb") as target:
            target.write(source.read())


def protect(input_path, output, options, secret):
    password = (secret or {}).get("password", "")
    if len(password) < 4 or len(password) > 40:
        raise UserError("Choose a password between 4 and 40 characters.")
    doc = open_pdf(input_path)
    permissions = pymupdf.PDF_PERM_ACCESSIBILITY
    if options.get("allowPrinting", "yes") == "yes":
        permissions |= pymupdf.PDF_PERM_PRINT | pymupdf.PDF_PERM_PRINT_HQ
    if options.get("allowCopying", "no") == "yes":
        permissions |= pymupdf.PDF_PERM_COPY
    if options.get("allowEditing", "no") == "yes":
        permissions |= pymupdf.PDF_PERM_MODIFY | pymupdf.PDF_PERM_ANNOTATE | pymupdf.PDF_PERM_FORM
    owner = os.urandom(16).hex()  # 32 chars; PDF passwords are limited to 40
    save_pdf(
        doc,
        output,
        encryption=pymupdf.PDF_ENCRYPT_AES_256,
        user_pw=password,
        owner_pw=owner,
        permissions=permissions,
    )
    doc.close()


def unlock(input_path, output, options, secret):
    try:
        doc = pymupdf.open(input_path)
    except Exception:
        raise UserError("This file is damaged beyond repair or is not a PDF.")
    if not doc.is_encrypted and not doc.needs_pass:
        raise UserError("This PDF is not password-protected.")
    if doc.needs_pass and not doc.authenticate((secret or {}).get("password", "")):
        raise UserError("The password is incorrect.")
    save_pdf(doc, output, encryption=pymupdf.PDF_ENCRYPT_NONE)
    doc.close()


def repair(input_path, output, options):
    try:
        doc = pymupdf.open(input_path, filetype="pdf")
    except Exception:
        raise UserError("This file is damaged beyond repair or is not a PDF.")
    if doc.needs_pass:
        raise UserError("This PDF is password-protected. Unlock it first.")
    if doc.page_count == 0:
        raise UserError("No recoverable pages were found in this file.")
    save_pdf(doc, output, garbage=4, deflate=True, clean=True)
    doc.close()


def grayscale(input_path, output, options):
    doc = open_pdf(input_path)
    doc.recolor(1)
    save_pdf(doc, output, garbage=4)
    doc.close()


def ocr_searchable(input_path, output, options):
    language = options.get("ocrLanguage", "eng")
    if not re.fullmatch(r"[a-z_]{3,8}(\+[a-z_]{3,8}){0,2}", language):
        raise UserError("Choose a supported OCR language.")
    tessdata = find_tessdata()
    for code in language.split("+"):
        if not os.path.isfile(os.path.join(tessdata, f"{code}.traineddata")):
            raise UserError("That OCR language is not installed on this server.")
    force = options.get("ocrMode", "skip") == "all"
    doc = open_pdf(input_path)
    recognised = 0
    for page in doc:
        if not force and page.get_text("text").strip():
            continue  # Already has a text layer.
        textpage = page.get_textpage_ocr(language=language, dpi=300, full=True, tessdata=tessdata)
        words = page.get_text("words", textpage=textpage)
        # Invisible text (render mode 3) over the original page: the page looks
        # unchanged but becomes searchable and selectable.
        for x0, y0, x1, y1, word, *_ in words:
            height = max(1.0, y1 - y0)
            fontsize = height * 0.86
            width = pymupdf.get_text_length(word, fontname="helv", fontsize=fontsize)
            morph = None
            if width > 0:
                scale = (x1 - x0) / width
                morph = (pymupdf.Point(x0, y1), pymupdf.Matrix(scale, 1))
            page.insert_text(
                (x0, y1 - height * 0.18),
                word,
                fontsize=fontsize,
                fontname="helv",
                render_mode=3,
                morph=morph,
            )
            recognised += 1
    if recognised == 0 and not any(page.get_text("text").strip() for page in doc):
        raise UserError("No readable text was found in this PDF. Check that the scan is sharp and the text is printed.")
    save_pdf(doc, output, garbage=3)
    doc.close()


EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# Spaces and tabs only, never newlines: a match that spans two lines (e.g. two
# numbers on consecutive lines) cannot be located by search_for and would
# silently stay unredacted.
PHONE_RE = re.compile(r"(?<!\w)(?:\+?\d[\d \t().-]{7,}\d)(?!\w)")
CARD_RE = re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)")


def redact(input_path, output, options):
    terms = [
        term.strip()
        for term in re.split(r"[\n,]", options.get("redactTerms", ""))
        if term.strip()
    ][:200]
    patterns = []
    if options.get("redactEmails") == "yes":
        patterns.append(EMAIL_RE)
    if options.get("redactPhones") == "yes":
        patterns.append(PHONE_RE)
    if options.get("redactCardNumbers") == "yes":
        patterns.append(CARD_RE)
    if not terms and not patterns:
        raise UserError("Enter words to redact or choose at least one pattern.")
    doc = open_pdf(input_path)
    total = 0
    for page in doc:
        needles = set(terms)
        if patterns:
            text = page.get_text("text")
            for pattern in patterns:
                needles.update(match.group(0).strip() for match in pattern.finditer(text))
        hits = 0
        for needle in needles:
            if not needle:
                continue
            for rect in page.search_for(needle):
                page.add_redact_annot(rect, fill=(0, 0, 0))
                hits += 1
        if hits:
            # Removes the underlying text and image pixels, not just covers them.
            page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_PIXELS)
            total += hits
    if total == 0:
        raise UserError("None of the words or patterns were found in this PDF, so nothing was redacted.")
    # Hidden data can leak redacted content; remove it too.
    doc.scrub(metadata=True, xml_metadata=True, attached_files=True, embedded_files=True, thumbnails=True, reset_fields=False)
    save_pdf(doc, output, garbage=4, clean=True)
    doc.close()


def extract_images(input_path, output, options):
    minimum = int(options.get("minImageSize", 32) or 32)
    doc = open_pdf(input_path)
    seen = set()
    count = 0
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for page_number, page in enumerate(doc, start=1):
            for image in page.get_images(full=True):
                xref = image[0]
                if xref in seen:
                    continue
                seen.add(xref)
                data = doc.extract_image(xref)
                if not data or data["width"] < minimum or data["height"] < minimum:
                    continue
                count += 1
                archive.writestr(f"page-{page_number}-image-{count}.{data['ext']}", data["image"])
    doc.close()
    if count == 0:
        raise UserError("This PDF contains no embedded images large enough to extract.")


def tables_to_json(input_path, output, options):
    doc = open_pdf(input_path)
    tables = []
    for page_number, page in enumerate(doc, start=1):
        try:
            found = page.find_tables()
        except Exception:
            continue
        for index, table in enumerate(found.tables, start=1):
            rows = [[cell if cell is not None else "" for cell in row] for row in table.extract()]
            if any(any(str(cell).strip() for cell in row) for row in rows):
                tables.append({"page": page_number, "index": index, "rows": rows})
    if not tables and options.get("textFallback", "yes") == "yes":
        # No ruled tables: export each page's text lines so the content is still usable.
        for page_number, page in enumerate(doc, start=1):
            lines = [[line] for line in page.get_text("text").splitlines() if line.strip()]
            if lines:
                tables.append({"page": page_number, "index": 0, "rows": lines})
    doc.close()
    if not tables:
        raise UserError("No tables or text were found in this PDF.")
    with open(output, "w", encoding="utf-8") as target:
        json.dump({"tables": tables}, target)


OPERATIONS = {
    "pdf.compress": lambda i, o, opts, s: compress(i, o, opts),
    "pdf.protect": protect,
    "pdf.unlock": unlock,
    "pdf.repair": lambda i, o, opts, s: repair(i, o, opts),
    "pdf.grayscale": lambda i, o, opts, s: grayscale(i, o, opts),
    "pdf.ocrSearchable": lambda i, o, opts, s: ocr_searchable(i, o, opts),
    "pdf.redact": lambda i, o, opts, s: redact(i, o, opts),
    "pdf.extractImages": lambda i, o, opts, s: extract_images(i, o, opts),
    "pdf.toExcel": lambda i, o, opts, s: tables_to_json(i, o, opts),
}


def main():
    if len(sys.argv) != 4 or sys.argv[1] not in OPERATIONS:
        print(f"{SAFE_PREFIX} Unsupported PDF operation.", file=sys.stderr)
        return 2
    payload = json.loads(sys.stdin.read() or "{}")
    try:
        OPERATIONS[sys.argv[1]](sys.argv[2], sys.argv[3], payload.get("options", {}), payload.get("secret"))
    except UserError as error:
        print(f"{SAFE_PREFIX} {error}", file=sys.stderr)
        return 3
    return 0


if __name__ == "__main__":
    pymupdf.TOOLS.mupdf_display_errors(False)
    sys.exit(main())
