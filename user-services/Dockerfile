# ---------- Build Stage ----------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN npm ci

COPY src ./src
COPY utils ./utils
COPY app.js ./

RUN npx prisma generate


# ---------- Production Stage ----------
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# IMPORTANT: prisma before npm ci
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN npm ci --omit=dev

COPY --from=builder /app/src ./src
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/app.js ./

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 5002
CMD ["sh","-c","npx prisma migrate deploy && npm start"]
