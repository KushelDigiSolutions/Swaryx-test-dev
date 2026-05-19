# ---------- Build Stage ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Dependency layer
COPY package*.json ./

RUN npm ci

# Application source
COPY app.js ./
COPY utils ./utils

# ---------- Production Stage ----------
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

# Install production deps only
RUN npm ci --omit=dev

# Copy runtime files only
COPY --from=builder /app/app.js ./
COPY --from=builder /app/utils ./utils

EXPOSE 5000

CMD ["npm","start"]