FROM node:22-alpine

WORKDIR /app

# Copy dependency files first
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy only application code
COPY src ./src
COPY utils ./utils
COPY app.js ./
COPY prisma.config.ts ./

# Generate Prisma client
RUN npx prisma generate

EXPOSE 5002

CMD ["sh","-c","npx prisma migrate deploy && npm start"]