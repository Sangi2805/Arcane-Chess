FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

COPY . .

EXPOSE 4000

# Bind to all interfaces for external reachability in containers
ENV HOST=0.0.0.0

# Health check ensures orchestrators know the app is ready to serve traffic
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "server/server.js"]

