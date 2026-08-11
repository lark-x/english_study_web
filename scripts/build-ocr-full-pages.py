import json
import re
from pathlib import Path

import pypdfium2 as pdfium


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = PROJECT_ROOT / "英语(二)自学教程2012年版00015 (主编张敬源、张虹) (z-library.sk, 1lib.sk, z-lib.sk).pdf"
OCR_DIR = PROJECT_ROOT / "app" / "study" / "textbook-units" / "ocr"
RAW_OCR_PATH = OCR_DIR / "ocr_raw_pages.json"
FULL_OCR_PATH = OCR_DIR / "ocr_full_pages.json"


def clean_line(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\x00", "")).strip()


def flags_for(text: str, source: str) -> list[str]:
    flags = [source]
    compact = clean_line(text)
    if not compact:
        flags.append("empty")
    if 0 < len(compact) < 80:
        flags.append("short_text")
    if not re.search(r"[A-Za-z]", compact):
        flags.append("no_latin_text")
    if len(re.findall(r"[\u4e00-\u9fff]", compact)) < 3 and re.search(r"[\^{}|]", compact):
        flags.append("noisy_text_layer")
    return flags


def text_page_to_record(document: pdfium.PdfDocument, page_number: int) -> dict:
    page = document[page_number - 1]
    text_page = page.get_textpage()
    text = text_page.get_text_range() or ""
    lines = [{"text": line, "confidence": 1.0} for line in (clean_line(item) for item in text.splitlines()) if line]
    final_text = "\n".join(line["text"] for line in lines)
    return {
        "pdf_page": page_number,
        "engine": "pdf_text_pypdfium2",
        "quality_flags": flags_for(final_text, "pdf_text"),
        "lines_count": len(lines),
        "lines": lines,
        "text": final_text,
    }


def normalize_existing(page_number: int, record: dict) -> dict:
    text = str(record.get("text") or "")
    lines = record.get("lines")
    if not isinstance(lines, list):
        lines = [{"text": line, "confidence": 1.0} for line in text.splitlines() if clean_line(line)]
    normalized = {
        "pdf_page": int(record.get("pdf_page") or page_number),
        "engine": record.get("engine") or "existing_ocr",
        "quality_flags": sorted(set([*(record.get("quality_flags") or []), *flags_for(text, "existing_ocr")])),
        "lines_count": int(record.get("lines_count") or len(lines)),
        "lines": lines,
        "text": text,
    }
    return normalized


def main() -> None:
    OCR_DIR.mkdir(parents=True, exist_ok=True)
    existing = {}
    if RAW_OCR_PATH.exists():
        existing = json.loads(RAW_OCR_PATH.read_text(encoding="utf-8"))

    document = pdfium.PdfDocument(str(PDF_PATH))
    total_pages = len(document)
    full = {}
    reused = 0
    filled = 0

    for page_number in range(1, total_pages + 1):
        key = str(page_number)
        current = existing.get(key)
        if current and (current.get("text") or current.get("lines")):
            full[key] = normalize_existing(page_number, current)
            reused += 1
        else:
            full[key] = text_page_to_record(document, page_number)
            filled += 1

    FULL_OCR_PATH.write_text(json.dumps(full, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(FULL_OCR_PATH),
        "totalPages": total_pages,
        "reusedExistingPages": reused,
        "filledFromPdfText": filled,
        "emptyPages": [int(key) for key, value in full.items() if value["lines_count"] == 0],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
