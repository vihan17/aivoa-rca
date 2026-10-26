"""Document ingestion: PDF, .eml email and plain text."""
from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from email import policy
from email.parser import BytesParser
from pathlib import Path

from pypdf import PdfReader


class DocumentError(ValueError):
    pass


@dataclass
class ParsedDocument:
    kind: str
    filename: str | None
    text: str
    meta: dict = field(default_factory=dict)


def _clean(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{4,}", "\n\n\n", text)
    return text.strip()


def parse_pdf(data: bytes, filename: str | None) -> ParsedDocument:
    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as exc:  # pragma: no cover - message clarity
        raise DocumentError(f"Could not read PDF: {exc}") from exc

    pages: list[str] = []
    for idx, page in enumerate(reader.pages, start=1):
        try:
            raw = page.extract_text() or ""
        except Exception:
            raw = ""
        pages.append(f"--- Page {idx} ---\n{_clean(raw)}")

    text = "\n\n".join(pages).strip()
    if len(text) < 40:
        raise DocumentError(
            "No selectable text found. This PDF looks scanned; paste the text instead."
        )
    return ParsedDocument(
        kind="pdf",
        filename=filename,
        text=text,
        meta={"pages": len(reader.pages), "chars": len(text)},
    )


def _html_to_text(html: str) -> str:
    html = re.sub(r"(?is)<(script|style).*?</\1>", " ", html)
    html = re.sub(r"(?i)<br\s*/?>|</p>|</tr>|</div>", "\n", html)
    html = re.sub(r"<[^>]+>", "", html)
    return _clean(re.sub(r"&nbsp;", " ", html))


def parse_eml(data: bytes, filename: str | None) -> ParsedDocument:
    try:
        msg = BytesParser(policy=policy.default).parsebytes(data)
    except Exception as exc:
        raise DocumentError(f"Could not read email: {exc}") from exc

    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            disp = (part.get("Content-Disposition") or "").lower()
            if "attachment" in disp:
                continue
            if ctype == "text/plain":
                body += part.get_content() + "\n"
            elif ctype == "text/html" and not body:
                body += _html_to_text(part.get_content()) + "\n"
    else:
        content = msg.get_content()
        body = _html_to_text(content) if msg.get_content_type() == "text/html" else content

    header = (
        f"From: {msg.get('From', '')}\n"
        f"To: {msg.get('To', '')}\n"
        f"Cc: {msg.get('Cc', '')}\n"
        f"Date: {msg.get('Date', '')}\n"
        f"Subject: {msg.get('Subject', '')}\n"
        f"Attachments: {', '.join(a.get_filename() or '' for a in msg.iter_attachments()) or 'none'}\n"
    )
    text = _clean(header + "\n" + body)
    if len(text) < 30:
        raise DocumentError("The email body appears to be empty.")
    return ParsedDocument(
        kind="email",
        filename=filename,
        text=text,
        meta={
            "subject": msg.get("Subject", ""),
            "from": msg.get("From", ""),
            "date": msg.get("Date", ""),
            "chars": len(text),
        },
    )


def parse_upload(data: bytes, filename: str) -> ParsedDocument:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        return parse_pdf(data, filename)
    if suffix in {".eml", ".email"}:
        return parse_eml(data, filename)
    if suffix in {".txt", ".md", ".log"}:
        text = _clean(data.decode("utf-8", errors="replace"))
        if len(text) < 20:
            raise DocumentError("The text file is empty.")
        return ParsedDocument(kind="text", filename=filename, text=text, meta={"chars": len(text)})
    if suffix == ".msg":
        raise DocumentError("Outlook .msg is not supported. Save the email as .eml or paste the text.")
    raise DocumentError("Unsupported file type. Upload a PDF, .eml email, or .txt file.")


def parse_pasted(text: str, label: str | None = None) -> ParsedDocument:
    cleaned = _clean(text or "")
    if len(cleaned) < 40:
        raise DocumentError("Paste at least a few sentences of the incident description.")
    kind = "email" if re.search(r"(?im)^(from|subject|to):", cleaned) else "text"
    return ParsedDocument(
        kind=kind,
        filename=label or ("Pasted email" if kind == "email" else "Pasted text"),
        text=cleaned,
        meta={"chars": len(cleaned)},
    )
