## Plan: VPS Docker Production Hardening

Prepare Arcane Chess for seamless professor evaluation on a VPS using Docker Compose by fixing deployment blockers (network binding, cookie/session transport, env config, docs), then validating end-to-end gameplay/auth/persistence over HTTPS with persistent MongoDB volumes.

**Steps**
1. Phase 1 - Runtime and networking hardening.
2. Update [server/server.js](server/server.js) so the HTTP server binds to `HOST` (default `0.0.0.0`) and logs deployed host/port clearly. This is required for container external reachability.
3. In [server/server.js](server/server.js), make production env validation explicit: require `MONGODB_URI` and `CLIENT_ORIGIN` when `NODE_ENV=production` so startup fails fast instead of silently running in degraded mode.
4. Add resilient health signaling in [server/api/health.js](server/api/health.js): include clear persistence/auth readiness fields and return non-OK status when production dependencies are missing or disconnected.

5. Phase 2 - Session/auth transport reliability (depends on Phase 1).
6. Update API request helper in [client/app.js](client/app.js) to send cookies with `credentials: include` for all auth-protected and session-backed calls.
7. Refine secure cookie behavior in [server/services/authService.js](server/services/authService.js) to support HTTPS behind reverse proxies by honoring explicit env override and trusted proxy deployment mode.
8. Ensure CORS/session compatibility in [server/server.js](server/server.js) by accepting configured production origin and preserving `credentials: true` for browser cookie flow.

9. Phase 3 - Docker/VPS deployment correctness (parallel with Phase 2 after Phase 1).
10. Update [docker/Dockerfile](docker/Dockerfile) for production defaults (`HOST=0.0.0.0`), and add container healthcheck for `/api/health`.
11. Update [docker/docker-compose.yml](docker/docker-compose.yml) for VPS deployment: persistent Mongo volume, restart policies, environment variables, optional app healthcheck/dependency conditions, and a production-friendly service naming/network pattern.
12. Add production env template guidance in [.env.example](.env.example) for VPS/Compose (`CLIENT_ORIGIN=https://<your-domain>`, `MONGODB_URI` using Compose service DNS, cookie security flags, node env).

13. Phase 4 - Documentation and operator UX (depends on Phases 1-3).
14. Resolve merge conflict and replace conflicting content in [README.md](README.md) with a single authoritative deploy/run guide.
15. Document VPS deploy workflow in [README.md](README.md): DNS + reverse proxy TLS (Nginx/Caddy), compose commands, first-run checks, backup/restore for Mongo volume, and professor-facing test checklist.
16. Add explicit troubleshooting section for common failures (CORS mismatch, cookie not set, Mongo unreachable, engine timeouts).

17. Phase 5 - Verification and smoke tests (depends on all previous phases).
18. Run backend startup and API checks via Compose: `/api/health`, `/api/auth/session`, `/api/game/new`, `/api/game/move`, `/api/game/engine`, save/resume/history flows.
19. Perform browser verification over public HTTPS domain: register/login/logout persistence, guest-to-user transfer behavior, move playability in 2D/3D, save/history continuity after container restart.
20. Validate persistence durability by restarting stack and confirming previously saved and completed games are still available.

**Relevant files**
- [server/server.js](server/server.js) - host binding, env validation, CORS/session deployment behavior.
- [client/app.js](client/app.js) - fetch credential mode for cookie-backed sessions.
- [server/services/authService.js](server/services/authService.js) - secure cookie policy and deployment toggles.
- [server/api/health.js](server/api/health.js) - production readiness/health response semantics.
- [docker/Dockerfile](docker/Dockerfile) - container runtime defaults and healthcheck.
- [docker/docker-compose.yml](docker/docker-compose.yml) - VPS service orchestration and persistence.
- [.env.example](.env.example) - local vs production configuration contract.
- [README.md](README.md) - merge-conflict resolution and deployment instructions.

**Verification**
1. Build and run stack on VPS with `docker compose -f docker/docker-compose.yml up -d --build`.
2. Confirm app container listens externally and responds at `https://<domain>/api/health` with production-ready state.
3. Register account, log out, log in, refresh browser, and verify session persistence.
4. Play multiple turns against engine, verify coach feedback and engine replies resolve without stale-lock issues.
5. Save a game, restart containers, resume game, and verify completed history entries remain.
6. Validate CORS/cookie behavior from browser devtools: session cookie present and API requests include credentials.

**Decisions**
- Deployment target: VPS with Docker Compose.
- Required capabilities: full login/register + guest flow and persistent Mongo-backed saves/history.
- Included scope: production hardening, deployment config, docs, and smoke-testing guidance.
- Excluded scope: multiplayer feature development, major UI redesign, and advanced observability stack.

**Further Considerations**
1. Reverse proxy choice recommendation: Caddy (simpler auto-TLS) over manual Nginx for fastest professor-ready setup.
2. Optional hardening after launch: add basic rate limiting on auth endpoints and request timeout caps around engine calls.
3. Optional operational safety: schedule Mongo volume backups if professor evaluation spans multiple days.
