# Receipt Designer

A local Windows tool for designing an 80 mm thermal receipt template for your brand, previewing it live, and exporting an implementation spec.

## Run
Double-click `ReceiptDesigner.exe`. A console window opens and the designer opens in your default browser. Close the console window to quit.

- Your design autosaves to `receipt-design.json` next to the .exe.
- **Export spec** writes `receipt-spec.md`, `receipt-design.json` and `logo.png` (rasterised at the exact print width in dots) to `exports/<date-time>/` next to the .exe.
- **Print / Save PDF** prints the preview at real size (choose your 80 mm printer, scale 100%, margins none), or saves it as a PDF to share for approval.
- **Import JSON** loads a design that was exported earlier.

## What you can adjust
- Page: paper width, margins, font family, line height, RTL/LTR, printer dpi, currency and decimals.
- Every section (logo, header, separator, served by, order number, items, total, payment, change, customer, footer, order reference, date): show or hide it, reorder it (↑/↓), and set its font size, weight, alignment and space above/below, plus section-specific options.
- Sample data: items, quantities and prices. Totals and change are recalculated automatically.

## Rebuild
```
GOOS=windows GOARCH=amd64 go build -ldflags "-s -w" -o ReceiptDesigner.exe .
```
