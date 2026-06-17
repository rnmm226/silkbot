from pathlib import Path
import fitz

BASE_DIR = Path(__file__).parent
pdf_path = BASE_DIR / "docs" / "Loi2024_48.pdf"

pdf = fitz.open(str(pdf_path))

print("Pages :", pdf.page_count)