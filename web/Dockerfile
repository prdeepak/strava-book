FROM node:20-alpine

# Install poppler-utils for PDF to image conversion
# Install fonts for proper text rendering
RUN apk add --no-cache \
    poppler-utils \
    fontconfig \
    ttf-dejavu \
    ttf-liberation \
    font-noto

WORKDIR /app

# Copy package files and install dependencies
# This ensures native modules are built for Linux
COPY package*.json ./
RUN npm install --legacy-peer-deps
