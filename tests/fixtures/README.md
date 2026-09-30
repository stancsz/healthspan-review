# Synthetic PDF fixtures

Every PDF in `pdf/` is generated test data and is labeled as a synthetic record.
The fixtures cover selectable text, scanned pages, supported unit conversions,
conflicts, duplicate sources, ambiguous dates, and page citations across batches.
They contain no patient records or credentials.

Regenerate the fixtures from the repository root with temporary generator
dependencies; these packages are not required to run the Node regression tests:

```powershell
uv run --with reportlab --with pillow python tests/fixtures/generate_synthetic_pdf_fixtures.py
uv run --with reportlab python tests/fixtures/generate_24_page_synthetic_pdf.py
```

The generators overwrite the corresponding fixtures and include PDF creation
metadata. Git treats PDFs as binary files to preserve their exact bytes.
