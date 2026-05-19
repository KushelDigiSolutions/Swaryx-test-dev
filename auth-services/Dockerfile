FROM node:22-alpine

WORKDIR /app

# Dependency layer (best for cache)
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Application code only
COPY src ./src
COPY utils ./utils
COPY app.js ./
COPY prisma.config.ts ./

RUN npx prisma generate

EXPOSE 5001

CMD ["sh","-c","npx prisma migrate deploy && npm start"]