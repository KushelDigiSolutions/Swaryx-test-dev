# ======================
# Stage 1: Builder
# ======================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY utils ./utils
COPY app.js ./

# Generate Prisma client
RUN npx prisma generate


# ======================
# Stage 2: Production
# ======================
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Install production deps only
RUN npm ci --omit=dev

# Copy built app from builder
COPY --from=builder /app/src ./src
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/app.js ./
COPY --from=builder /app/prisma.config.ts ./

EXPOSE 5003

CMD ["sh","-c","npx prisma migrate deploy && npm start"]