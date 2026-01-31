# Polygon Workspace Tool Ghana

Offline land polygon coordinate processing tool for Ghana.

## Features

- ✅ Manual or pasted polygon coordinate input
- ✅ Automatic mean coordinate calculation
- ✅ QR code generation for polygon coordinates and GAPA number
- ✅ Barcode generation for mean coordinates and job codes
- ✅ Single-page A4 PDF export
- ✅ Fully offline (no backend, no APIs, no database)
- ✅ Editable inputs with live preview

## Installation

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm start
```

3. Open browser at `http://localhost:3000`

## Usage

1. **Input Polygon Coordinates**
   - Paste coordinates in format: `lat, lng` per line
   - Click "Parse Coordinates" to validate

2. **Enter GAPA Number**
   - Input the GAPA number in the text field

3. **Calculate Mean**
   - Click "Calculate Mean" to compute mean coordinates
   - Mean value displays before generation

4. **Generate Codes**
   - Click "Generate Codes" to create all QR codes and barcodes
   - Preview appears on the right side (A4 layout)

5. **Export PDF**
   - Click "Export to PDF" to download the A4 document
   - File is saved with GAPA number and timestamp

## Build for Production

```bash
npm run build
```

The `build` folder will contain the production-ready files that can be hosted on any static file server or opened directly in a browser (file://).

## Technical Stack

- React 18 (JavaScript only)
- qrcode.react (QR code generation)
- JsBarcode (barcode generation)
- jsPDF + html2canvas (PDF export)
- Pure CSS (no frameworks)

## License

For internal use in Ghana only.
