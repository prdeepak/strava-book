#!/bin/bash
# Convert a PDF to PNG images, one per page

set -e

PDF_PATH="${1:-outputs/TrainingSparkle Strava book to 20250609.pdf}"
OUTPUT_DIR="${2:-outputs/trainingsparkle}"

if [ ! -f "$PDF_PATH" ]; then
    echo "Error: PDF not found: $PDF_PATH"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Converting: $PDF_PATH"
echo "Output dir: $OUTPUT_DIR"

# Use pdftoppm to convert PDF to PNG (one file per page)
# -png: output PNG format
# -r 300: 300 DPI resolution
pdftoppm -png -r 300 "$PDF_PATH" "$OUTPUT_DIR/page"

echo "Done! Files created:"
ls -la "$OUTPUT_DIR"
