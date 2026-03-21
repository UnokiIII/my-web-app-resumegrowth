import base64
import json
import sys
from pathlib import Path

import fitz


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing pdf path"}, ensure_ascii=False))
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    max_pages = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    mode = sys.argv[3] if len(sys.argv) > 3 else "images"

    if not pdf_path.exists():
        print(json.dumps({"error": f"pdf not found: {pdf_path}"}, ensure_ascii=False))
        sys.exit(1)

    doc = fitz.open(pdf_path)

    if mode == "text":
        texts = []
        for i, page in enumerate(doc):
            if i >= max_pages:
                break
            texts.append(page.get_text("text") or "")
        print(json.dumps({"text": "\n".join(texts)}, ensure_ascii=False))
        return

    images = []
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        png_bytes = pix.tobytes("png")
        images.append(base64.b64encode(png_bytes).decode("utf-8"))

    print(json.dumps({"images": images}, ensure_ascii=False))


if __name__ == "__main__":
    main()
