# Arcane Chess

Arcane Chess is a full-stack browser chess application with a 2D and optional 3D board, Stockfish opponent, guest and account sessions, save and resume, and completed game history.

This README is the canonical run and deployment guide for local development and VPS hosting.

## What Is Included

- Express backend that serves API and static client
- Chess rules and state powered by chess.js
- Stockfish engine integration
- Guest and user account flow with session cookies
- MongoDB-backed save, resume, and history records
- Docker and Docker Compose deployment support

## Repository Layout

- [server](server): API, auth, game logic, persistence, engine integration
- [client](client): UI, gameplay interactions, 2D and 3D board view
- [docker](docker): Dockerfile and Docker Compose stack
- [.env.example](.env.example): environment template for local and production

## Quick Start (Local Development)

### 1. Install dependencies

```bash
cd server
npm install
```

### 2. Create environment file

```bash
cd ..
cp .env.example .env
```

Use local defaults in `.env`:

```env
PORT=4000
NODE_ENV=development
HOST=localhost
MONGODB_URI=mongodb://mongodb:27017/arcane_chess
CLIENT_ORIGIN=http://localhost:4000
GUEST_NAME_PREFIX=Guest
```

### 3. Start MongoDB and app

Option A: Local MongoDB service

```bash
cd server
npm run dev
```

Option B: Docker MongoDB only

```bash
docker compose -f docker/docker-compose.yml up mongodb -d
cd server
npm run dev
```

### 4. Open app

- http://localhost:4000

## Docker Stack (Single Command)

To run app and MongoDB in containers:

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

Then open:

- http://localhost:4000

Stop stack:

```bash
docker compose -f docker/docker-compose.yml down
```

## Production VPS Deployment

This section is the final deployment flow intended for professor evaluation.

### 1. VPS prerequisites

- Docker Engine + Docker Compose plugin installed
- Domain name pointing to VPS public IP (A record)
- Open ports 80 and 443

### 2. Deploy project on VPS

```bash
git clone <your-repo-url>
cd Arcane-Chess
cp .env.example .env
```

Edit `.env` for production values:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=4000
MONGODB_URI=mongodb://mongodb:27017/arcane_chess
CLIENT_ORIGIN=https://arcane-chess.yourdomain.com
GUEST_NAME_PREFIX=Guest
```

Notes:

- `MONGODB_URI` must use the compose service name `mongodb` in container deployments.
- `CLIENT_ORIGIN` must exactly match your public HTTPS domain.
- Compose already sets `TRUST_PROXY=true` and `SESSION_COOKIE_SECURE=false` for reverse-proxy HTTPS termination.

### 3. Start production stack

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

Check status:

```bash
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml logs -f arcane-chess
```

Health endpoint:

- `https://arcane-chess.yourdomain.com/api/health`

### 4. Put TLS reverse proxy in front (Caddy recommended)

Create Caddyfile:

```caddyfile
arcane-chess.yourdomain.com {
    reverse_proxy 127.0.0.1:4000
}
```

Start Caddy (example with system package installation):

```bash
sudo systemctl enable caddy
sudo systemctl restart caddy
```

Caddy automatically provisions and renews TLS certificates.

If you prefer Nginx, proxy HTTPS traffic to `127.0.0.1:4000` and preserve standard forwarded headers.

## Operations

### Update deployment

```bash
git pull
docker compose -f docker/docker-compose.yml up -d --build
```

### Restart services

```bash
docker compose -f docker/docker-compose.yml restart arcane-chess
docker compose -f docker/docker-compose.yml restart mongodb
```

### Backup MongoDB volume

```bash
docker run --rm \
  -v arcane-chess_mongodb_data:/data/db \
  -v "$(pwd)":/backup \
  mongo:7 \
  bash -c "mongodump --out /backup/mongo-backup"
```

### Restore MongoDB backup

```bash
docker run --rm \
  -v arcane-chess_mongodb_data:/data/db \
  -v "$(pwd)":/backup \
  mongo:7 \
  bash -c "mongorestore /backup/mongo-backup"
```

## Professor Evaluation Checklist

- App loads over HTTPS at your public domain
- Register, login, logout all work
- Session persists after page refresh
- New game starts and Stockfish replies correctly
- Save game works
- Resume saved game works
- Completed games appear in history
- 2D board works and 3D mode is available on WebGL-supported devices
- `/api/health` returns ready state

## Troubleshooting

### CORS blocked in browser

- Verify `CLIENT_ORIGIN` exactly matches public URL including protocol
- Rebuild and restart stack after env changes

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

### Login works but session does not persist

- Confirm requests include cookies in browser devtools
- Confirm app is running behind HTTPS at the same domain as `CLIENT_ORIGIN`
- Confirm compose sets `TRUST_PROXY=true` and `SESSION_COOKIE_SECURE=false`

### MongoDB unavailable or degraded health

- Check Mongo container status and logs

```bash
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml logs mongodb
```

- Verify `MONGODB_URI=mongodb://mongodb:27017/arcane_chess` in `.env`

### Engine move delays or failures

- Check app logs for Stockfish startup or timeout errors

```bash
docker compose -f docker/docker-compose.yml logs arcane-chess
```

- Use lower difficulty if VPS has limited CPU resources

## API Summary

- `GET /api/health`
- `GET /api/game`
- `POST /api/game/new`
- `POST /api/game/move`
- `POST /api/game/coach`
- `POST /api/game/engine`
- `POST /api/game/resign`
- `POST /api/game/draw`
- `POST /api/game/claim-draw`
- `POST /api/game/reset`
- `GET /api/games`
- `POST /api/games/current/save`
- `POST /api/games/:gameId/resume`
- `GET /api/history`
- `GET /api/auth/session`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`

## License

Academic project repository.
