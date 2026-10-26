"""Generate the bundled demo artifacts (PDF deviation report, .eml email).

Run:  backend\\.venv\\Scripts\\python.exe scripts\\generate_samples.py
"""
from __future__ import annotations

import html
import re
import shutil
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent.parent
SAMPLES = ROOT / "samples"
SOURCE = SAMPLES / "deviation-report.txt"
OUTPUT = SAMPLES / "deviation-report.pdf"

INK = colors.HexColor("#0f172a")
MUTED = colors.HexColor("#64748b")
LINE = colors.HexColor("#d8dee7")
ACCENT = colors.HexColor("#0f766e")
TINT = colors.HexColor("#f1f5f9")

styles = getSampleStyleSheet()
BODY = ParagraphStyle("body", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.4,
                      leading=13.2, textColor=INK, alignment=TA_LEFT, spaceAfter=4)
BULLET = ParagraphStyle("bullet", parent=BODY, leftIndent=10, bulletIndent=2, spaceAfter=2)
H1 = ParagraphStyle("h1", parent=BODY, fontName="Helvetica-Bold", fontSize=8.2,
                    textColor=ACCENT, spaceBefore=10, spaceAfter=5, leading=10)
TITLE = ParagraphStyle("title", parent=BODY, fontName="Helvetica-Bold", fontSize=16,
                       leading=20, spaceAfter=2)
SUBTITLE = ParagraphStyle("sub", parent=BODY, fontName="Helvetica", fontSize=9,
                          textColor=MUTED, spaceAfter=10)
CELL = ParagraphStyle("cell", parent=BODY, fontSize=8.6, leading=11, spaceAfter=0)


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved = []

    def showPage(self):
        self._saved.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._saved)
        for state in self._saved:
            self.__dict__.update(state)
            self._footer(total)
            super().showPage()
        super().save()

    def _footer(self, total: int) -> None:
        self.setStrokeColor(LINE)
        self.setLineWidth(0.5)
        self.line(18 * mm, 15 * mm, A4[0] - 18 * mm, 15 * mm)
        self.setFont("Helvetica", 7.4)
        self.setFillColor(MUTED)
        self.drawString(18 * mm, 10.5 * mm, "CONFIDENTIAL - INTERNAL QUALITY RECORD")
        self.drawRightString(A4[0] - 18 * mm, 10.5 * mm, f"Page {self._pageNumber} of {total}")
        self.drawString(18 * mm, A4[1] - 13 * mm, "AIVOA API MANUFACTURING - UNIT 2, PUNE")
        self.drawRightString(A4[0] - 18 * mm, A4[1] - 13 * mm, "QA/DEV/2026/0142  |  v1.0")


def parse_sections(text: str) -> tuple[list[tuple[str, str]], list[tuple[str, list[str]]]]:
    meta: list[tuple[str, str]] = []
    sections: list[tuple[str, list[str]]] = []
    current = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if re.match(r"^\d+\.\s+[A-Z]", line):
            current = line
            sections.append((current, []))
            continue
        if line.startswith(("AIVOA API", "Document:", "DEVIATION REPORT")):
            continue
        if current is None:
            if ":" in line:
                key, val = line.split(":", 1)
                meta.append((key.strip(), val.strip()))
            continue
        sections[-1][1].append(line)
    return meta, sections


def build() -> None:
    meta, sections = parse_sections(SOURCE.read_text(encoding="utf-8"))
    doc = BaseDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=22 * mm,
        bottomMargin=22 * mm,
        title="Deviation Report DEV-2026-0142",
        author="AIVOA API Manufacturing - Quality Assurance",
        subject="OOS impurity result, batch AT-24118",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="page", frames=[frame])])

    story: list = [
        Paragraph("DEVIATION REPORT", TITLE),
        Paragraph("Out-of-specification result - Atorvastatin Calcium USP, batch AT-24118", SUBTITLE),
    ]

    if meta:
        rows = [
            [Paragraph(f"<b>{html.escape(k)}</b>", CELL), Paragraph(html.escape(v), CELL)]
            for k, v in meta
        ]
        table = Table(rows, colWidths=[48 * mm, doc.width - 48 * mm])
        table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                    ("BACKGROUND", (0, 0), (0, -1), TINT),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story += [table, Spacer(1, 4)]

    for heading, lines in sections:
        story.append(Paragraph(html.escape(heading).upper(), H1))
        for line in lines:
            safe = html.escape(line)
            if line.startswith("- "):
                story.append(Paragraph(safe[2:], BULLET, bulletText="\u2022"))
            elif re.match(r"^\d+\.\s", line):
                story.append(Paragraph(safe, BULLET, bulletText="\u2022"))
            else:
                story.append(Paragraph(safe, BODY))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size / 1024:.0f} KB)")

    # email artifact for the upload path
    email_src = SAMPLES / "deviation-email.txt"
    eml = SAMPLES / "deviation-email.eml"
    shutil.copyfile(email_src, eml)
    print(f"wrote {eml}")


if __name__ == "__main__":
    build()
