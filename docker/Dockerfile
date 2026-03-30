FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

COPY . .

EXPOSE 4000

CMD ["node", "server/server.js"]

