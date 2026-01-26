FROM node:20-bookworm

# System dependencies
RUN apt-get update && apt-get install -y \
    poppler-utils fontconfig fonts-dejavu fonts-liberation fonts-noto \
    git curl bash ripgrep jq make \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN curl -fsSL https://claude.ai/install.sh | bash
ENV PATH="/root/.local/bin:${PATH}"

# Pre-cache node_modules
WORKDIR /opt/node_modules_cache
COPY web/package*.json ./
RUN npm install --legacy-peer-deps
RUN md5sum package.json > /opt/package.json.md5

# Install Playwright browsers and dependencies
RUN npx playwright install --with-deps chromium

WORKDIR /app
SHELL ["/bin/bash", "-c"]
