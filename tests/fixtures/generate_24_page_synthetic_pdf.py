"""Create synthetic multipage PDFs with measurements across extraction batches."""

import argparse
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


ROOT = Path(__file__).parent / "pdf"
MEASUREMENTS = {
    1: ["Collected: 2026-01-02", "Fasting glucose: 98 mg/dL"],
    7: ["Collected: 2026-01-02", "HbA1c: 5.6 %"],
    13: ["Collected: 2026-01-02", "Fasting glucose: 110 mg/dL"],
    19: ["Collected: 2026-01-02", "Albumin: 4.3 g/dL"],
    49: ["Collected: 2026-01-02", "HbA1c: 6.0 %"],
    50: ["Collected: 2026-01-02", "Albumin: 4.5 g/dL"],
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pages", type=int, default=24)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.pages < 1:
        parser.error("--pages must be positive")
    output = args.output or ROOT / f"synthetic-{args.pages}-page.pdf"
    output.parent.mkdir(parents=True, exist_ok=True)
    document = canvas.Canvas(str(output), pagesize=letter, invariant=1)
    for page_number in range(1, args.pages + 1):
        document.setFont("Helvetica-Bold", 18)
        document.drawString(60, 730, "SYNTHETIC TEST RECORD - NOT A PATIENT")
        document.setFont("Helvetica", 14)
        document.drawString(60, 690, f"Source page {page_number}")
        for index, line in enumerate(
            MEASUREMENTS.get(page_number, ["Synthetic filler page."])
        ):
            document.drawString(60, 650 - index * 30, line)
        document.showPage()
    document.save()
    print(f"Created {output}")


if __name__ == "__main__":
    main()
