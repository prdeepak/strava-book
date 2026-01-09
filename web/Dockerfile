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
