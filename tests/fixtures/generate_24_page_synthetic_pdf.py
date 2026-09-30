"""Create a synthetic PDF with measurements on four separate extraction batches."""

from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


ROOT = Path(__file__).parent / "pdf"
OUTPUT = ROOT / "synthetic-24-page.pdf"
MEASUREMENTS = {
    1: ["Collected: 2026-01-02", "Fasting glucose: 98 mg/dL"],
    7: ["Collected: 2026-01-02", "HbA1c: 5.6 %"],
    13: ["Collected: 2026-01-02", "Fasting glucose: 110 mg/dL"],
    19: ["Collected: 2026-01-02", "Albumin: 4.3 g/dL"],
}


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    document = canvas.Canvas(str(OUTPUT), pagesize=letter)
    for page_number in range(1, 25):
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
    print(f"Created {OUTPUT}")


if __name__ == "__main__":
    main()
