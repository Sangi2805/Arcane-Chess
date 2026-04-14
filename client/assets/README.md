<<<<<<< HEAD
# Arcane Chess

Arcane Chess is a browser-based chess project. Phase 2 delivers the first fully playable local milestone: a responsive 2D board in the browser, legal move validation through `chess.js`, and bot play against Stockfish.

## Libraries Used And Why

- **Express**: production-friendly HTTP server and static asset host.
- **Mongoose**: keeps the Phase 1 MongoDB wiring intact for later persistence phases.
- **dotenv**: loads local environment configuration cleanly.
- **cors**: keeps browser/server communication predictable in local development.
- **chess.js**: reliable legal move generation, move validation, FEN, PGN, and game status logic without reinventing chess rules.
- **stockfish**: practical Stockfish engine integration via a local UCI process so the project can play complete games now.

## Project Structure

```text
Arcane-Chess/
|-- client/
|   |-- app.js
|   |-- index.html
|   `-- styles.css
|-- docker/
|   |-- Dockerfile
|   `-- docker-compose.yml
|-- server/
|   |-- api/
|   |   |-- game.js
|   |   |-- health.js
|   |   `-- index.js
|   |-- auth/
|   |   `-- guestAuth.js
|   |-- db/
|   |   `-- mongo.js
|   |-- game/
|   |   `-- gameManager.js
|   |-- services/
|   |   |-- chessService.js
|   |   `-- engineService.js
|   |-- package-lock.json
|   |-- package.json
|   `-- server.js
|-- .env
|-- .env.example
`-- README.md
```

## Phase 2 Features

- Responsive 2D chessboard with click-to-move interaction
- Legal move validation only
- Selected-square, legal-target, and last-move highlighting
- Game status display for turn, check, checkmate, and draw states
- Move list panel
- New game flow with side selection
- Stockfish opponent with four difficulty levels
- Single in-memory local game session for this phase

## Difficulty Mapping

The engine uses Stockfish UCI settings with a combined `Skill Level`, `depth`, and `movetime` preset:

| Difficulty | Skill Level | Depth | Move Time |
| --- | --- | --- | --- |
| Easy | 4 | 6 | 250ms |
| Intermediate | 8 | 10 | 500ms |
| Hard | 14 | 14 | 900ms |
| Grand Master | 20 | 18 | 1500ms |

This keeps the implementation simple while making each difficulty feel meaningfully different.

## API Endpoints

- `GET /api/health`
- `GET /api/game`
- `POST /api/game/new`
- `POST /api/game/move`
- `POST /api/game/engine`
- `POST /api/game/reset`

## Local Setup

### 1. Install server dependencies

```bash
cd server
npm install
```

### 2. Confirm environment config

The starter `.env` already works for local development:

```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/arcane_chess
CLIENT_ORIGIN=http://localhost:4000
GUEST_NAME_PREFIX=Guest
```

### 3. Start MongoDB

Use a local MongoDB instance, or start one with Docker:

```bash
docker compose -f docker/docker-compose.yml up mongodb
```

### 4. Run Arcane Chess

```bash
cd server
npm run dev
```

Then open:

```text
http://localhost:4000
```

## Manual Install Step Required

Yes. Phase 2 adds two gameplay dependencies:

```bash
cd server
npm install chess.js stockfish
```

If you run `npm install` from `server/`, both are included automatically from `package.json`.

## Notes For This Phase

- Gameplay state is intentionally **in-memory only**.
- If the player starts as Black, Stockfish automatically makes the opening move.
- Promotion choices are handled in the UI.
- Full accounts, saved history, analysis, multiplayer, and 3D are intentionally deferred.

## Docker

```bash
docker compose -f docker/docker-compose.yml up --build
```
=======
# AI6001_Arcane-Chess

Instructions:

* Click the `Use this template` green button in the top-right of the repo
* Create a new *PRIVATE* repository from this template
* Add user `davechurchill` as a collaborator (Settings > Manage Access > Add People)
* Click the pencil icon in the top-right of this section to edit straight from the GitHub website
* Edit your `README.md` file to include your group info, and remove this instruction section
* Once your project has been submitted, you can change it to public

Project Group Members:

* Sangaranarayanan Sangaranarayanan Viswanathan 202583140 ssangaranara@mun.ca
* Md Shahriar Rashid 202580849 msrashid@mun.ca

Project URL

* Paste your hosted web application URL here so I can test it

Project Videos:

* Project Presentation: YouTube URL

Project Setup / Installation:

* Your project setup and installation instructions go here
* Feel free to include screenshots if you want
>>>>>>> c00a71464d80fa91ff795d1d36a8f100111933ac
