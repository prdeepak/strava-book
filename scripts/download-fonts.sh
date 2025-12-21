#!/bin/bash

# Script to download a comprehensive font collection for Strava Book templates
# This provides a broad range of fonts for different content types and moods

set -e  # Exit on error

FONTS_DIR="web/public/fonts"
GITHUB_FONTS_BASE="https://github.com/google/fonts/raw/main"

echo "📦 Downloading fonts to ${FONTS_DIR}..."
echo ""

# Create fonts directory if it doesn't exist
mkdir -p "${FONTS_DIR}"

# Function to download a font
download_font() {
    local url=$1
    local filename=$2
    local category=$3
    
    if [ -f "${FONTS_DIR}/${filename}" ]; then
        echo "  ⏭️  ${filename} (already exists)"
    else
        echo "  ⬇️  ${filename}"
        curl -sL -o "${FONTS_DIR}/${filename}" "${url}" || {
            echo "  ❌ Failed to download ${filename}"
            return 1
        }
    fi
}

# ============================================
# SERIF FONTS (Professional, Traditional, Elegant)
# ============================================
echo "📖 Serif Fonts (Professional, Traditional, Elegant)"
download_font "${GITHUB_FONTS_BASE}/ofl/merriweather/Merriweather-Regular.ttf" "Merriweather-Regular.ttf" "serif"
download_font "${GITHUB_FONTS_BASE}/ofl/merriweather/Merriweather-Bold.ttf" "Merriweather-Bold.ttf" "serif"
download_font "${GITHUB_FONTS_BASE}/ofl/playfairdisplay/PlayfairDisplay-Bold.ttf" "PlayfairDisplay-Bold.ttf" "serif"
download_font "${GITHUB_FONTS_BASE}/ofl/playfairdisplay/PlayfairDisplay-Regular.ttf" "PlayfairDisplay-Regular.ttf" "serif"
download_font "${GITHUB_FONTS_BASE}/ofl/lora/Lora-Regular.ttf" "Lora-Regular.ttf" "serif"
download_font "${GITHUB_FONTS_BASE}/ofl/lora/Lora-Bold.ttf" "Lora-Bold.ttf" "serif"
download_font "${GITHUB_FONTS_BASE}/ofl/crimsontext/CrimsonText-Regular.ttf" "CrimsonText-Regular.ttf" "serif"
download_font "${GITHUB_FONTS_BASE}/ofl/crimsontext/CrimsonText-Bold.ttf" "CrimsonText-Bold.ttf" "serif"
echo ""

# ============================================
# SANS-SERIF FONTS (Modern, Clean, Sporty)
# ============================================
echo "🏃 Sans-Serif Fonts (Modern, Clean, Sporty)"
download_font "${GITHUB_FONTS_BASE}/apache/roboto/Roboto-Regular.ttf" "Roboto-Regular.ttf" "sans-serif"
download_font "${GITHUB_FONTS_BASE}/apache/roboto/Roboto-Bold.ttf" "Roboto-Bold.ttf" "sans-serif"
download_font "${GITHUB_FONTS_BASE}/apache/roboto/Roboto-Light.ttf" "Roboto-Light.ttf" "sans-serif"
download_font "${GITHUB_FONTS_BASE}/apache/opensans/OpenSans-Regular.ttf" "OpenSans-Regular.ttf" "sans-serif"
download_font "${GITHUB_FONTS_BASE}/apache/opensans/OpenSans-Bold.ttf" "OpenSans-Bold.ttf" "sans-serif"
download_font "${GITHUB_FONTS_BASE}/ofl/montserrat/Montserrat-Regular.ttf" "Montserrat-Regular.ttf" "sans-serif"
download_font "${GITHUB_FONTS_BASE}/ofl/montserrat/Montserrat-Bold.ttf" "Montserrat-Bold.ttf" "sans-serif"
download_font "${GITHUB_FONTS_BASE}/ofl/inter/Inter-Regular.ttf" "Inter-Regular.ttf" "sans-serif"
download_font "${GITHUB_FONTS_BASE}/ofl/inter/Inter-Bold.ttf" "Inter-Bold.ttf" "sans-serif"
download_font "${GITHUB_FONTS_BASE}/ofl/oswald/Oswald-Regular.ttf" "Oswald-Regular.ttf" "sans-serif"
download_font "${GITHUB_FONTS_BASE}/ofl/oswald/Oswald-Bold.ttf" "Oswald-Bold.ttf" "sans-serif"
echo ""

# ============================================
# DISPLAY/DECORATIVE FONTS (Bold Statements, Titles)
# ============================================
echo "💪 Display/Decorative Fonts (Bold Statements, Titles)"
download_font "${GITHUB_FONTS_BASE}/ofl/bebasneue/BebasNeue-Regular.ttf" "BebasNeue-Regular.ttf" "display"
download_font "${GITHUB_FONTS_BASE}/ofl/anton/Anton-Regular.ttf" "Anton-Regular.ttf" "display"
download_font "${GITHUB_FONTS_BASE}/ofl/righteous/Righteous-Regular.ttf" "Righteous-Regular.ttf" "display"
download_font "${GITHUB_FONTS_BASE}/ofl/archivoblack/ArchivoBlack-Regular.ttf" "ArchivoBlack-Regular.ttf" "display"
download_font "${GITHUB_FONTS_BASE}/ofl/bangers/Bangers-Regular.ttf" "Bangers-Regular.ttf" "display"
echo ""

# ============================================
# HANDWRITTEN/SCRIPT FONTS (Personal, Casual, Scrapbook-style)
# ============================================
echo "✍️  Handwritten/Script Fonts (Personal, Casual, Scrapbook-style)"
# IndieFlower and PatrickHand already exist, but download if missing
download_font "${GITHUB_FONTS_BASE}/ofl/indieflower/IndieFlower-Regular.ttf" "IndieFlower-Regular.ttf" "handwritten"
download_font "${GITHUB_FONTS_BASE}/ofl/patrickhand/PatrickHand-Regular.ttf" "PatrickHand-Regular.ttf" "handwritten"
download_font "${GITHUB_FONTS_BASE}/ofl/caveat/Caveat-Regular.ttf" "Caveat-Regular.ttf" "handwritten"
download_font "${GITHUB_FONTS_BASE}/apache/permanentmarker/PermanentMarker-Regular.ttf" "PermanentMarker-Regular.ttf" "handwritten"
download_font "${GITHUB_FONTS_BASE}/ofl/shadowsintolight/ShadowsIntoLight-Regular.ttf" "ShadowsIntoLight-Regular.ttf" "handwritten"
download_font "${GITHUB_FONTS_BASE}/ofl/dancingscript/DancingScript-Regular.ttf" "DancingScript-Regular.ttf" "handwritten"
download_font "${GITHUB_FONTS_BASE}/ofl/dancingscript/DancingScript-Bold.ttf" "DancingScript-Bold.ttf" "handwritten"
echo ""

# ============================================
# MONOSPACE FONTS (Data, Technical, Stats)
# ============================================
echo "🔢 Monospace Fonts (Data, Technical, Stats)"
download_font "${GITHUB_FONTS_BASE}/apache/robotomono/RobotoMono-Regular.ttf" "RobotoMono-Regular.ttf" "monospace"
download_font "${GITHUB_FONTS_BASE}/apache/robotomono/RobotoMono-Bold.ttf" "RobotoMono-Bold.ttf" "monospace"
download_font "${GITHUB_FONTS_BASE}/ofl/sourcecodepro/SourceCodePro-Regular.ttf" "SourceCodePro-Regular.ttf" "monospace"
download_font "${GITHUB_FONTS_BASE}/ofl/sourcecodepro/SourceCodePro-Bold.ttf" "SourceCodePro-Bold.ttf" "monospace"
echo ""

# ============================================
# CONDENSED FONTS (Space-efficient for data)
# ============================================
echo "📊 Condensed Fonts (Space-efficient for data)"
download_font "${GITHUB_FONTS_BASE}/apache/robotocondensed/RobotoCondensed-Regular.ttf" "RobotoCondensed-Regular.ttf" "condensed"
download_font "${GITHUB_FONTS_BASE}/apache/robotocondensed/RobotoCondensed-Bold.ttf" "RobotoCondensed-Bold.ttf" "condensed"
download_font "${GITHUB_FONTS_BASE}/ofl/barlowcondensed/BarlowCondensed-Regular.ttf" "BarlowCondensed-Regular.ttf" "condensed"
download_font "${GITHUB_FONTS_BASE}/ofl/barlowcondensed/BarlowCondensed-Bold.ttf" "BarlowCondensed-Bold.ttf" "condensed"
echo ""

echo "✅ Font download complete!"
echo ""
echo "📋 Summary:"
echo "   Total fonts available in ${FONTS_DIR}:"
ls -1 "${FONTS_DIR}" | grep -E '\.(ttf|woff|woff2)$' | wc -l | xargs echo "  "
echo ""
echo "💡 Usage Tips:"
echo "   - Serif: Professional, traditional, elegant (Merriweather, Playfair Display, Lora)"
echo "   - Sans-Serif: Modern, clean, sporty (Roboto, Open Sans, Montserrat, Inter, Oswald)"
echo "   - Display: Bold statements, titles (Bebas Neue, Anton, Righteous)"
echo "   - Handwritten: Personal, casual, scrapbook (Indie Flower, Patrick Hand, Caveat)"
echo "   - Monospace: Data, technical, stats (Roboto Mono, Source Code Pro)"
echo "   - Condensed: Space-efficient (Roboto Condensed, Barlow Condensed)"
echo ""
