FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY app.js ./
COPY utils ./utils

EXPOSE 5000

CMD ["npm","start"]