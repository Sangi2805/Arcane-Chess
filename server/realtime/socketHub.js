const { randomUUID } = require("crypto");

const { applyMove, createChessGame, serializeGame } = require("../services/chessService");

const WAITING_STATUS = {
  code: "waiting-opponent",
  message: "Waiting for an opponent to join."
};

const UNTYPED_TIME_CONTROL = {
  id: "untimed",
  label: "Untimed",
  enabled: false,
  baseMs: 0,
  incrementMs: 0
};

const roomRegistry = new Map();

const createRoomId = () => randomUUID().split("-")[0].toUpperCase();

const getColorBySocket = (room, socketId) => {
  if (room.players.white?.socketId === socketId) {
    return "white";
  }

  if (room.players.black?.socketId === socketId) {
    return "black";
  }

  return null;
};

const getOpenColor = (room) => {
  if (!room.players.white) {
    return "white";
  }

  if (!room.players.black) {
    return "black";
  }

  return null;
};

const hasBothPlayers = (room) => Boolean(room.players.white && room.players.black);

const getPublicPlayers = (room) => ({
  white: room.players.white
    ? {
        name: room.players.white.name
      }
    : null,
  black: room.players.black
    ? {
        name: room.players.black.name
      }
    : null
});

const getResolvedResult = (snapshot, hasStarted) => {
  if (!hasStarted) {
    return {
      result: "not-started",
      resultLabel: null,
      status: WAITING_STATUS,
      turn: null,
      legalMoves: {},
      isGameOver: false,
      drawReason: null
    };
  }

  if (!snapshot.isGameOver) {
    return {
      result: "in-progress",
      resultLabel: null,
      status: snapshot.status,
      turn: snapshot.turn,
      legalMoves: snapshot.legalMoves,
      isGameOver: false,
      drawReason: null
    };
  }

  if (snapshot.status.code === "checkmate") {
    return {
      result: snapshot.turn === "white" ? "black-win" : "white-win",
      resultLabel: snapshot.status.outcomeLabel || "Checkmate",
      status: snapshot.status,
      turn: null,
      legalMoves: {},
      isGameOver: true,
      drawReason: null
    };
  }

  return {
    result: "draw",
    resultLabel: snapshot.status.outcomeLabel || "Draw",
    status: snapshot.status,
    turn: null,
    legalMoves: {},
    isGameOver: true,
    drawReason: snapshot.status.drawReason || null
  };
};

const buildPerspectiveState = (room, playerColor) => {
  const snapshot = serializeGame(room.chess);
  const hasStarted = hasBothPlayers(room);
  const resolved = getResolvedResult(snapshot, hasStarted);

  return {
    id: room.id,
    actorType: "multiplayer",
    guestId: null,
    userId: null,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    hasStarted,
    result: resolved.result,
    settings: {
      difficulty: "easy",
      playerColor,
      engineColor: playerColor === "white" ? "black" : "white",
      timeControl: UNTYPED_TIME_CONTROL
    },
    persistence: {
      available: true,
      status: "socket-live"
    },
    ...snapshot,
    timeControl: UNTYPED_TIME_CONTROL,
    clockState: null,
    turn: resolved.turn,
    legalMoves: resolved.legalMoves,
    isGameOver: resolved.isGameOver,
    status: resolved.status,
    resultLabel: resolved.resultLabel,
    drawReason: resolved.drawReason,
    coachFeedback: null
  };
};

const emitRoomState = (io, room, extras = {}) => {
  ["white", "black"].forEach((color) => {
    const player = room.players[color];

    if (!player) {
      return;
    }

    io.to(player.socketId).emit("multiplayer:state", {
      roomId: room.id,
      youAre: color,
      players: getPublicPlayers(room),
      phase: hasBothPlayers(room) ? "active" : "waiting",
      game: buildPerspectiveState(room, color),
      ...extras
    });
  });
};

const removeSocketFromRoom = (io, socket) => {
  const roomId = socket.data.roomId;

  if (!roomId) {
    return;
  }

  const room = roomRegistry.get(roomId);

  socket.data.roomId = null;
  socket.data.playerColor = null;

  if (!room) {
    return;
  }

  const color = getColorBySocket(room, socket.id);

  if (color) {
    room.players[color] = null;
    room.updatedAt = new Date().toISOString();
  }

  const hasPlayers = Boolean(room.players.white || room.players.black);

  if (!hasPlayers) {
    roomRegistry.delete(room.id);
    return;
  }

  emitRoomState(io, room, {
    event: "opponent-disconnected"
  });
};

const attachRealtimeHub = (io) => {
  io.on("connection", (socket) => {
    console.log("SOCKET CONNECTED:", socket.id);
    socket.data.roomId = null;
    socket.data.playerColor = null;

    socket.on("multiplayer:create", (payload = {}, callback = () => {}) => {
      try {
        removeSocketFromRoom(io, socket);

        const roomId = createRoomId();
        const now = new Date().toISOString();
        const room = {
          id: roomId,
          chess: createChessGame(),
          createdAt: now,
          updatedAt: now,
          players: {
            white: {
              socketId: socket.id,
              name: payload.displayName || "Player 1"
            },
            black: null
          }
        };

        roomRegistry.set(roomId, room);
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.playerColor = "white";

        const state = {
          roomId,
          youAre: "white",
          players: getPublicPlayers(room),
          phase: "waiting",
          game: buildPerspectiveState(room, "white")
        };

        callback({ ok: true, state });
        emitRoomState(io, room);
      } catch (error) {
        callback({
          ok: false,
          message: error.message || "Unable to create room."
        });
      }
    });

    socket.on("multiplayer:join", (payload = {}, callback = () => {}) => {
      try {
        const roomId = String(payload.roomId || "").trim().toUpperCase();

        if (!roomId) {
          throw new Error("Room ID is required.");
        }

        const room = roomRegistry.get(roomId);

        if (!room) {
          throw new Error("Room not found.");
        }

        removeSocketFromRoom(io, socket);

        const openColor = getOpenColor(room);

        if (!openColor) {
          throw new Error("Room is full.");
        }

        room.players[openColor] = {
          socketId: socket.id,
          name: payload.displayName || "Player"
        };
        room.updatedAt = new Date().toISOString();

        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.playerColor = openColor;

        const state = {
          roomId,
          youAre: openColor,
          players: getPublicPlayers(room),
          phase: hasBothPlayers(room) ? "active" : "waiting",
          game: buildPerspectiveState(room, openColor)
        };

        callback({ ok: true, state });
        emitRoomState(io, room);
      } catch (error) {
        callback({
          ok: false,
          message: error.message || "Unable to join room."
        });
      }
    });

    socket.on("multiplayer:move", (payload = {}, callback = () => {}) => {
      try {
        const roomId = socket.data.roomId;

        if (!roomId) {
          throw new Error("Join a room before making a move.");
        }

        const room = roomRegistry.get(roomId);

        if (!room) {
          throw new Error("Room not found.");
        }

        if (!hasBothPlayers(room)) {
          throw new Error("Waiting for an opponent.");
        }

        const playerColor = getColorBySocket(room, socket.id);

        if (!playerColor) {
          throw new Error("You are not assigned to this room.");
        }

        const snapshot = serializeGame(room.chess);

        if (snapshot.isGameOver) {
          throw new Error("The game is already over.");
        }

        if (snapshot.turn !== playerColor) {
          throw new Error("It is not your turn.");
        }

        const move = applyMove(room.chess, {
          from: payload.from,
          to: payload.to,
          promotion: payload.promotion || undefined
        });

        if (!move) {
          throw new Error("Illegal move.");
        }

        room.updatedAt = new Date().toISOString();

        const state = {
          roomId,
          youAre: playerColor,
          players: getPublicPlayers(room),
          phase: hasBothPlayers(room) ? "active" : "waiting",
          game: buildPerspectiveState(room, playerColor)
        };

        callback({ ok: true, state });
        emitRoomState(io, room, {
          event: "move",
          lastMove: {
            from: move.from,
            to: move.to,
            san: move.san,
            color: playerColor
          }
        });
      } catch (error) {
        callback({
          ok: false,
          message: error.message || "Move failed."
        });
      }
    });

    socket.on("multiplayer:leave", () => {
      removeSocketFromRoom(io, socket);
    });

    socket.on("disconnect", () => {
      removeSocketFromRoom(io, socket);
    });
  });

  return io;
};

module.exports = {
  attachRealtimeHub
};