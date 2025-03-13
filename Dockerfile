# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY database.db /data/database.db
COPY database.db-shm /data/database.db-shm
COPY database.db-wal /data/database.db-wal
COPY . .
CMD ["node", "server.js"]