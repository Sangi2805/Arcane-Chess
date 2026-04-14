# Arcane Chess Multiplayer Blueprint

## Goal

Add live player-vs-player chess to Arcane Chess without abandoning the project's dark-academia identity or the existing solo-vs-Stockfish experience.

This blueprint defines the product shape, user flow, time-control catalog, backend architecture, and phased rollout for multiplayer mode.

## Experience Principles

- Keep Arcane Chess feeling like a curated duel chamber, not a copy of another chess site.
- Preserve solo play as a first-class mode for guests and practice sessions.
- Gate live multiplayer behind signed-in accounts so identity, invites, history, and ratings are stable.
- Be honest in the UI while features are being phased in. Preview structure first, then wire in real-time behavior.
- Disable coaching assistance during live PvP to protect fair play.

## User Flow

### Layer 1: Entry Choice

The left control column becomes the entry point for how a player wants to use Arcane Chess.

- `Solo Archive`
  - Available to everyone
  - Guests can practice against Stockfish immediately
  - Signed-in users can still play solo and keep their archived games
- `Multiplayer Hall`
  - Guests see a sign-in gate with a clear explanation
  - Signed-in users see the live-play dashboard

### Layer 2: Command Hall Dashboard

Once authenticated, the Multiplayer Hall should expose:

- `Quick Duel`
  - Choose time control
  - Choose casual vs rated
  - Join or leave matchmaking queue
- `Custom Challenge`
  - Invite a specific online player
  - Choose color preference and time control
- `Hall of Players`
  - Presence list
  - Online, in game, or away states
- `Invites`
  - Incoming challenge cards
  - Accept, decline, or ignore
- `PvP Archives`
  - Recent multiplayer games
  - Result, opponent, time control, and replay entry

## UI Direction

The multiplayer UI should stay inside the existing compact Arcane panel system.

- Use stacked parchment-like cards inside the left rail instead of a new full-screen lobby
- Keep the board as the main stage
- Use warm brass highlights and carved-panel styling instead of bright green gaming UI
- Treat multiplayer as a "Command Hall" rather than a generic lobby
- Reuse pills, labels, and segmented controls already present in the app

## Time-Control Catalog

The current preset list is too narrow for multiplayer and weak for solo practice. The catalog should become:

### Solo Only

- `Untimed`

### Bullet

- `30 sec`
- `1 min`
- `1 | 1`
- `2 | 1`

### Blitz

- `3 min`
- `3 | 2`
- `5 min`
- `5 | 2`
- `5 | 5`

### Rapid

- `10 min`
- `10 | 5`
- `15 | 10`
- `20 min`
- `30 min`
- `60 min`

## Real-Time Architecture

### Transport

Add `Socket.IO` on top of the existing Express server.

- REST remains responsible for:
  - auth
  - session bootstrap
  - saved games
  - history fetches
  - static page load
- Socket.IO becomes responsible for:
  - presence
  - matchmaking queue
  - direct challenges
  - live move sync
  - live clock sync
  - reconnect and resume

### Core Services

- `presenceService`
  - Tracks connected users
  - Exposes online or away state
- `matchmakingService`
  - Join queue
  - Leave queue
  - Match compatible players by time control and rated mode
- `challengeService`
  - Create direct challenge
  - Accept, decline, cancel
- `multiplayerGameService`
  - Validate turns
  - Apply moves
  - Broadcast board updates
  - Manage clocks
  - Handle resign, draw, disconnect, and timeout

### Socket Event Draft

Client to server:

- `presence:join`
- `presence:heartbeat`
- `queue:join`
- `queue:leave`
- `challenge:create`
- `challenge:accept`
- `challenge:decline`
- `game:move`
- `game:resign`
- `game:offer-draw`
- `game:accept-draw`
- `game:sync-request`

Server to client:

- `presence:list`
- `presence:update`
- `queue:status`
- `match:found`
- `challenge:received`
- `challenge:updated`
- `game:state`
- `game:clock`
- `game:ended`
- `game:error`

## Data Model Changes

### User

Extend the user profile with multiplayer metadata:

- `rating`
- `provisional`
- `presenceStatus`
- `lastSeenAt`

### New Challenge Model

Store invite lifecycle for direct challenges:

- challenger id
- opponent id
- time control
- rated flag
- challenge status
- expiry

### Existing Models to Reuse

- `Game`
  - already supports `mode: "multiplayer"`
  - should remain the durable match archive
- `MatchmakingQueue`
  - already exists
  - should gain rated mode and availability metadata if needed

## Fair-Play Rules

During live multiplayer:

- Arcane Coach should not analyze the current position
- best-move suggestions must be suppressed
- move review is allowed only after the game ends

## Recommended Phases

### Phase 1

- Add multiplayer dashboard UI
- Expand time controls
- Add Socket.IO server bootstrap
- Signed-in presence
- Queue join or leave
- Casual matchmaking only

### Phase 2

- Real-time live games
- Reconnect and resume
- Direct challenges
- Multiplayer history

### Phase 3

- Rated mode
- Rating adjustments
- Presence filters
- Friend list and private room polish

## Current Implementation Baseline

This repository already contains useful groundwork:

- persistent `Game` records for multiplayer mode
- a `MatchmakingQueue` model
- multiplayer persistence helpers

What is still missing:

- Socket.IO transport
- authenticated presence tracking
- queue orchestration
- direct challenge lifecycle
- live board synchronization between browsers

## Build Recommendation

Ship multiplayer in this order:

1. Visual Command Hall shell
2. Expanded time controls
3. Presence and queue
4. Live casual duels
5. Direct challenges
6. Rated progression

This keeps Arcane Chess stable while adding multiplayer in a way that can be demoed, tested, and explained cleanly in the project presentation.
