# ======================
# Build Stage
# ======================
FROM node:22-alpine AS builder

WORKDIR /app

# package + prisma
COPY auth-services/package*.json ./
COPY auth-services/prisma ./prisma/
COPY auth-services/prisma.config.ts ./

RUN npm ci

# source code
COPY auth-services/src ./src
COPY utils ./utils
COPY auth-services/app.js ./

RUN npx prisma generate


# ======================
# Production Stage
# ======================
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# package + prisma
COPY auth-services/package*.json ./
COPY auth-services/prisma ./prisma/
COPY auth-services/prisma.config.ts ./

RUN npm ci --omit=dev

# app files
COPY --from=builder /app/src ./src
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/app.js ./

# Create compatibility paths
RUN mkdir -p /utils \
    && cp -r /app/utils/* /utils/ \
    && ln -s /app/node_modules /node_modules

# Prisma runtime
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 5001

CMD ["sh","-c","npx prisma migrate deploy && npm start"]
