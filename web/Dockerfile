FROM node:20-alpine

# Install poppler-utils for PDF to image conversion
# Install fonts for proper text rendering
RUN apk add --no-cache \
    poppler-utils \
    fontconfig \
    ttf-dejavu \
    ttf-liberation \
    font-noto

# Pre-install node_modules to a cache directory
# This gets copied to the volume at startup (see smart-npm-install.sh)
WORKDIR /opt/node_modules_cache
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Store checksum of package.json for change detection
RUN md5sum package.json > /opt/package.json.md5

WORKDIR /app
