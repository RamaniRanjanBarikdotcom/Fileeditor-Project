#!/usr/bin/env python3
"""Maintainer utility for refreshing the checked-in Poppler visual fixture.

It uses macOS system fonts to create an embedded-font PDF. CI consumes only
the resulting base64 manifest, so the fonts are not needed at test time.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

import pymupdf as fitz

fitz.TOOLS.mupdf_display_errors(False)


FONTS = {
    "devanagari": "/System/Library/Fonts/Supplemental/Devanagari Sangam MN.ttc",
    "arabic": "/System/Library/Fonts/SFArabic.ttf",
}


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="apptoolkit-visual-fixture-") as tmp:
        folder = Path(tmp)
        pdf_path = folder / "multilingual.pdf"
        document = fitz.open()
        archive = fitz.Archive("/System/Library/Fonts")

        page = document.new_page(width=420, height=320)
        html = """
        <h2>AppToolkitLab PDF renderer</h2>
        <p>Latin CFF/Base14: café — ﬁ ligature</p>
        <p class="dev">नमस्ते दुनिया • दस्तावेज़ परीक्षण</p>
        <p class="arabic" dir="rtl">مرحبا بالعالم • اختبار المستند</p>
        """
        css = """
        @font-face { font-family: dev; src: url('/Supplemental/Devanagari Sangam MN.ttc'); }
        @font-face { font-family: arabic; src: url('/SFArabic.ttf'); }
        body { font-family: Helvetica; font-size: 15px; color: #10233f; }
        h2 { color: #5b4bdb; font-size: 23px; }
        .dev { font-family: dev; } .arabic { font-family: arabic; }
        """
        result = page.insert_htmlbox(fitz.Rect(24, 20, 396, 290), html, css=css, archive=archive)
        if result[0] < 0:
            raise RuntimeError("Multilingual fixture text did not fit")
        page.insert_text((24, 282), "你好世界 - 文档转换测试", fontsize=15, fontname="china-s")
        scan_source = page.get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False)

        rotated = document.new_page(width=420, height=320)
        shape = rotated.new_shape()
        shape.draw_rect(fitz.Rect(30, 35, 390, 285))
        shape.finish(color=(0.25, 0.2, 0.7), fill=(0.9, 0.85, 1), fill_opacity=0.55)
        shape.commit()
        rotated.insert_text((55, 145), "Transparency and rotated-page fixture", fontsize=18)
        rotated.set_rotation(90)

        scanned = document.new_page(width=420, height=320)
        scanned.insert_image(scanned.rect, stream=scan_source.tobytes("png"))

        document.subset_fonts()
        document.save(pdf_path, garbage=4, deflate=True)
        document.close()

        subprocess.run(
            ["pdftoppm", "-r", "96", str(pdf_path), str(folder / "reference")],
            check=True,
            stdout=subprocess.DEVNULL,
        )
        pages = sorted(folder.glob("reference-*.ppm"))
        manifest = {
            "description": "Embedded subset/CFF, CID/CJK, Devanagari, Arabic, transparency, rotation and scanned-page fixture",
            "dpi": 96,
            "pdfSha256": hashlib.sha256(pdf_path.read_bytes()).hexdigest(),
            "pdfGzipBase64": base64.b64encode(gzip.compress(pdf_path.read_bytes(), 9)).decode(),
            "referencePpmGzipBase64": [
                base64.b64encode(gzip.compress(item.read_bytes(), 9)).decode() for item in pages
            ],
        }
        print(json.dumps(manifest, separators=(",", ":")))


if __name__ == "__main__":
    main()
