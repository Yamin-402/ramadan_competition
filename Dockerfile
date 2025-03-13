# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY database.db /data/database.db
COPY . .
CMD ["node", "server.js"]