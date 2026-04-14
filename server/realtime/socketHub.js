const { randomUUID } = require("crypto");

const { applyMove, createChessGame, serializeGame } = require("../services/chessService");

const WAITING_STATUS = {
  code: "waiting-opponent",
  message: "Waiting for an opponent to join."
};

const BLITZ_FIVE_TIME_CONTROL = {
  id: "blitz-5",
  label: "5 min",
  enabled: true,
  baseMs: 300000,
  incrementMs: 0
};

const UNTYPED_TIME_CONTROL = {
  id: "untimed",
  label: "Untimed",
  enabled: false,
  baseMs: 0,
  incrementMs: 0
};

const RECONNECT_WINDOW_MS = 60_000;

const roomRegistry = new Map();
const matchmakingQueue = [];
const queuedActors = new Map();

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
  if (!room.players.white || !room.players.white.socketId) {
    return "white";
  }

  if (!room.players.black || !room.players.black.socketId) {
    return "black";
  }

  return null;
};

const hasBothPlayers = (room) => Boolean(room.players.white?.socketId && room.players.black?.socketId);

const normalizeDisplayName = (value, fallback = "Player") => {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.slice(0, 40) : fallback;
};

const normalizeActorIdentity = (socket, payload = {}) => {
  const actor = payload.actor || {};
  const userId = typeof actor.userId === "string" ? actor.userId.trim() : "";
  const guestId = typeof actor.guestId === "string" ? actor.guestId.trim() : "";
  const displayName = normalizeDisplayName(actor.displayName, "Player");

  if (userId) {
    return {
      actorKey: `user:${userId}`,
      actorType: "user",
      userId,
      guestId: null,
      displayName
    };
  }

  if (guestId) {
    return {
      actorKey: `guest:${guestId}`,
      actorType: "guest",
      userId: null,
      guestId,
      displayName
    };
  }

  return {
    actorKey: `guest:socket-${socket.id}`,
    actorType: "guest",
    userId: null,
    guestId: null,
    displayName
  };
};

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

const getResolvedResult = (snapshot, hasStarted, manualOutcome = null) => {
  if (manualOutcome) {
    return {
      result: manualOutcome.result,
      resultLabel: manualOutcome.resultLabel || null,
      status: manualOutcome.status,
      turn: null,
      legalMoves: {},
      isGameOver: true,
      drawReason: manualOutcome.drawReason || null
    };
  }

  if (snapshot.ruleState?.checkmate) {
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

  if (snapshot.ruleState?.automaticDraw) {
    return {
      result: "draw",
      resultLabel: snapshot.status.outcomeLabel || "Draw",
      status: snapshot.status,
      turn: null,
      legalMoves: {},
      isGameOver: true,
      drawReason: snapshot.status.drawReason || null
    };
  }

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
};

const buildPerspectiveState = (room, playerColor) => {
  const snapshot = serializeGame(room.chess);
  const hasStarted = hasBothPlayers(room);
  const resolved = getResolvedResult(snapshot, hasStarted, room.manualOutcome || null);
  const timeControl = room.timeControl || UNTYPED_TIME_CONTROL;
  const pendingDrawOffer =
    !resolved.isGameOver && room.pendingDrawOffer
      ? {
          fromColor: room.pendingDrawOffer.fromColor,
          offeredAt: room.pendingDrawOffer.offeredAt,
          awaitingYourResponse: room.pendingDrawOffer.fromColor !== playerColor
        }
      : null;

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
      timeControl
    },
    persistence: {
      available: true,
      status: "socket-live"
    },
    ...snapshot,
    timeControl,
    clockState: null,
    turn: resolved.turn,
    legalMoves: resolved.legalMoves,
    isGameOver: resolved.isGameOver,
    status: resolved.status,
    resultLabel: resolved.resultLabel,
    drawReason: resolved.drawReason,
    pendingDrawOffer,
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

const getSocketById = (io, socketId) => io.sockets.sockets.get(socketId) || null;

const buildQueueStatus = ({ queued, position = null } = {}) => ({
  queued,
  position,
  timeControl: queued ? BLITZ_FIVE_TIME_CONTROL : null
});

const emitQueueStatus = (socket, status) => {
  socket.emit("queue:status", status);
};

const emitQueueError = (socket, message) => {
  socket.emit("queue:error", {
    message
  });
};

const removeQueueEntryByActorKey = (io, actorKey) => {
  if (!actorKey || !queuedActors.has(actorKey)) {
    return null;
  }

  const queueIndex = matchmakingQueue.findIndex((entry) => entry.actorKey === actorKey);
  const removedEntry = queuedActors.get(actorKey) || null;

  if (queueIndex >= 0) {
    matchmakingQueue.splice(queueIndex, 1);
  }

  queuedActors.delete(actorKey);

  if (removedEntry?.socketId) {
    const removedSocket = getSocketById(io, removedEntry.socketId);
    if (removedSocket) {
      emitQueueStatus(removedSocket, buildQueueStatus({ queued: false }));
    }
  }

  return removedEntry;
};

const broadcastQueueStatuses = (io) => {
  matchmakingQueue.forEach((entry, index) => {
    const queuedSocket = getSocketById(io, entry.socketId);

    if (!queuedSocket) {
      return;
    }

    emitQueueStatus(
      queuedSocket,
      buildQueueStatus({
        queued: true,
        position: index + 1
      })
    );
  });
};

const pruneQueue = (io) => {
  const staleKeys = matchmakingQueue
    .filter((entry) => !getSocketById(io, entry.socketId))
    .map((entry) => entry.actorKey);

  staleKeys.forEach((actorKey) => {
    removeQueueEntryByActorKey(io, actorKey);
  });
};

const createRoomFromQueuePair = (io, firstEntry, secondEntry) => {
  const firstSocket = getSocketById(io, firstEntry.socketId);
  const secondSocket = getSocketById(io, secondEntry.socketId);

  if (!firstSocket || !secondSocket) {
    return;
  }

  const roomId = createRoomId();
  const now = new Date().toISOString();
  const room = {
    id: roomId,
    chess: createChessGame(),
    createdAt: now,
    updatedAt: now,
    timeControl: BLITZ_FIVE_TIME_CONTROL,
    pendingDrawOffer: null,
    players: {
      white: {
        socketId: firstSocket.id,
        name: firstEntry.displayName
      },
      black: {
        socketId: secondSocket.id,
        name: secondEntry.displayName
      }
    }
  };

  roomRegistry.set(roomId, room);

  firstSocket.join(roomId);
  secondSocket.join(roomId);

  firstSocket.data.roomId = roomId;
  firstSocket.data.playerColor = "white";
  secondSocket.data.roomId = roomId;
  secondSocket.data.playerColor = "black";

  firstSocket.emit("match:found", {
    roomId,
    youAre: "white",
    opponentName: secondEntry.displayName,
    timeControl: BLITZ_FIVE_TIME_CONTROL
  });

  secondSocket.emit("match:found", {
    roomId,
    youAre: "black",
    opponentName: firstEntry.displayName,
    timeControl: BLITZ_FIVE_TIME_CONTROL
  });

  emitRoomState(io, room, {
    event: "match-started"
  });
};

const runMatchmaking = (io) => {
  pruneQueue(io);

  while (matchmakingQueue.length >= 2) {
    const firstEntry = matchmakingQueue.shift();
    const secondEntry = matchmakingQueue.shift();

    queuedActors.delete(firstEntry.actorKey);
    queuedActors.delete(secondEntry.actorKey);

    createRoomFromQueuePair(io, firstEntry, secondEntry);
  }

  broadcastQueueStatuses(io);
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
    room.players[color] = {
      ...room.players[color],
      socketId: null,
      disconnectedAt: Date.now()
    };
    room.updatedAt = new Date().toISOString();
    scheduleDisconnectForfeit(io, room, color);
  }

  const hasPlayers = Boolean(room.players.white?.socketId || room.players.black?.socketId);

  if (!hasPlayers) {
    clearDisconnectForfeitTimer(room);
    roomRegistry.delete(room.id);
    return;
  }

  emitRoomState(io, room, {
    event: "opponent-disconnected",
    reconnectDeadlineAt: room.disconnectState?.reconnectDeadlineAt || null
  });
};

const attachRealtimeHub = (io) => {
  io.on("connection", (socket) => {
    console.log("SOCKET CONNECTED:", socket.id);
    socket.data.roomId = null;
    socket.data.playerColor = null;
    socket.data.actorKey = null;

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
          timeControl: UNTYPED_TIME_CONTROL,
          pendingDrawOffer: null,
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
          name: payload.displayName || room.players[openColor]?.name || "Player"
        };
        room.updatedAt = new Date().toISOString();
        if (hasBothPlayers(room)) {
          clearDisconnectForfeitTimer(room);
        }

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

    socket.on("multiplayer:resign", (_payload = {}, callback = () => {}) => {
      try {
        const roomId = socket.data.roomId;

        if (!roomId) {
          throw new Error("Join a room before resigning.");
        }

        const room = roomRegistry.get(roomId);

        if (!room) {
          throw new Error("Room not found.");
        }

        const playerColor = getColorBySocket(room, socket.id);

        if (!playerColor) {
          throw new Error("You are not assigned to this room.");
        }

        const snapshot = serializeGame(room.chess);

        if (snapshot.isGameOver || room.manualOutcome) {
          throw new Error("The game is already over.");
        }

        room.pendingDrawOffer = null;
        const winnerColor = playerColor === "white" ? "black" : "white";
        room.manualOutcome = {
          result: winnerColor === "white" ? "white-win" : "black-win",
          resultLabel: "Resignation",
          drawReason: null,
          status: {
            code: "resignation",
            message: `${playerColor === "white" ? "White" : "Black"} resigned.`,
            outcomeLabel: "Resignation"
          }
        };
        room.updatedAt = new Date().toISOString();
        clearDisconnectForfeitTimer(room);

        callback({
          ok: true,
          state: {
            roomId,
            youAre: playerColor,
            players: getPublicPlayers(room),
            phase: hasBothPlayers(room) ? "active" : "waiting",
            game: buildPerspectiveState(room, playerColor)
          }
        });

        emitRoomState(io, room, {
          event: "resignation"
        });
      } catch (error) {
        callback({
          ok: false,
          message: error.message || "Unable to resign."
        });
      }
    });

    socket.on("multiplayer:draw", (_payload = {}, callback = () => {}) => {
      try {
        const roomId = socket.data.roomId;

        if (!roomId) {
          throw new Error("Join a room before offering a draw.");
        }

        const room = roomRegistry.get(roomId);

        if (!room) {
          throw new Error("Room not found.");
        }

        const playerColor = getColorBySocket(room, socket.id);

        if (!playerColor) {
          throw new Error("You are not assigned to this room.");
        }

        const snapshot = serializeGame(room.chess);

        if (snapshot.isGameOver || room.manualOutcome) {
          throw new Error("The game is already over.");
        }

        if (!hasBothPlayers(room)) {
          throw new Error("Waiting for an opponent.");
        }

        const pendingOffer = room.pendingDrawOffer;

        if (pendingOffer && pendingOffer.fromColor !== playerColor) {
          room.pendingDrawOffer = null;
          room.manualOutcome = {
            result: "draw",
            resultLabel: "Draw agreed",
            drawReason: "agreed",
            status: {
              code: "draw-agreed",
              message: "Draw agreed.",
              outcomeLabel: "Draw agreed",
              drawReason: "agreed"
            }
          };
        } else if (pendingOffer && pendingOffer.fromColor === playerColor) {
          throw new Error("Draw offer already sent. Waiting for opponent response.");
        } else {
          room.pendingDrawOffer = {
            fromColor: playerColor,
            offeredAt: Date.now()
          };
        }

        room.updatedAt = new Date().toISOString();
        if (room.manualOutcome) {
          clearDisconnectForfeitTimer(room);
        }

        const eventName = room.manualOutcome ? "draw-agreed" : "draw-offered";

        callback({
          ok: true,
          state: {
            roomId,
            youAre: playerColor,
            players: getPublicPlayers(room),
            phase: hasBothPlayers(room) ? "active" : "waiting",
            game: buildPerspectiveState(room, playerColor),
            event: eventName
          }
        });

        emitRoomState(io, room, {
          event: eventName,
          offeredBy: playerColor
        });
      } catch (error) {
        callback({
          ok: false,
          message: error.message || "Unable to agree draw."
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

        if (snapshot.isGameOver || room.manualOutcome) {
          throw new Error("The game is already over.");
        }

        if (snapshot.turn !== playerColor) {
          throw new Error("It is not your turn.");
        }

        const hadPendingDrawOffer = Boolean(room.pendingDrawOffer);
        room.pendingDrawOffer = null;

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
          drawOfferDeclinedByMove: hadPendingDrawOffer,
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

    socket.on("queue:join", (payload = {}, callback = () => {}) => {
      try {
        if (socket.data.roomId) {
          throw new Error("Leave the current room before joining quick play queue.");
        }

        const actor = normalizeActorIdentity(socket, payload);
        socket.data.actorKey = actor.actorKey;

        removeQueueEntryByActorKey(io, actor.actorKey);

        const queueEntry = {
          ...actor,
          socketId: socket.id,
          queuedAt: Date.now()
        };

        matchmakingQueue.push(queueEntry);
        queuedActors.set(actor.actorKey, queueEntry);

        runMatchmaking(io);

        const position = matchmakingQueue.findIndex((entry) => entry.actorKey === actor.actorKey) + 1;

        callback({
          ok: true,
          state: buildQueueStatus({
            queued: position > 0,
            position: position > 0 ? position : null
          })
        });
      } catch (error) {
        emitQueueError(socket, error.message || "Unable to join queue.");
        callback({
          ok: false,
          message: error.message || "Unable to join queue."
        });
      }
    });

    socket.on("queue:leave", (_payload = {}, callback = () => {}) => {
      try {
        removeQueueEntryByActorKey(io, socket.data.actorKey);
        broadcastQueueStatuses(io);

        callback({
          ok: true,
          state: buildQueueStatus({ queued: false })
        });
      } catch (error) {
        callback({
          ok: false,
          message: error.message || "Unable to leave queue."
        });
      }
    });

    socket.on("queue:status-request", (_payload = {}, callback = () => {}) => {
      const position = matchmakingQueue.findIndex(
        (entry) => entry.actorKey && entry.actorKey === socket.data.actorKey
      );

      callback({
        ok: true,
        state: buildQueueStatus({
          queued: position >= 0,
          position: position >= 0 ? position + 1 : null
        })
      });
    });

    socket.on("disconnect", () => {
      removeQueueEntryByActorKey(io, socket.data.actorKey);
      broadcastQueueStatuses(io);
      removeSocketFromRoom(io, socket);
    });
  });

  return io;
};

module.exports = {
  attachRealtimeHub
};

const clearDisconnectForfeitTimer = (room) => {
  if (room.disconnectState?.timerId) {
    clearTimeout(room.disconnectState.timerId);
  }

  room.disconnectState = null;
};

const buildDisconnectForfeitOutcome = (winnerColor) => ({
  result: winnerColor === "white" ? "white-win" : "black-win",
  resultLabel: "Disconnect timeout",
  drawReason: null,
  status: {
    code: "timeout",
    message: `${winnerColor === "white" ? "White" : "Black"} wins on disconnect timeout.`,
    outcomeLabel: "Disconnect timeout"
  }
});

const scheduleDisconnectForfeit = (io, room, disconnectedColor) => {
  clearDisconnectForfeitTimer(room);

  if (!disconnectedColor) {
    return;
  }

  const opponentColor = disconnectedColor === "white" ? "black" : "white";

  if (!room.players[opponentColor]?.socketId) {
    return;
  }

  const snapshot = serializeGame(room.chess);
  if (snapshot.isGameOver || room.manualOutcome) {
    return;
  }

  const reconnectDeadlineAt = Date.now() + RECONNECT_WINDOW_MS;
  room.disconnectState = {
    disconnectedColor,
    reconnectDeadlineAt,
    timerId: setTimeout(() => {
      const stillDisconnected = !room.players[disconnectedColor]?.socketId;

      if (!stillDisconnected || room.manualOutcome) {
        return;
      }

      room.manualOutcome = buildDisconnectForfeitOutcome(opponentColor);
      room.updatedAt = new Date().toISOString();
      clearDisconnectForfeitTimer(room);
      emitRoomState(io, room, {
        event: "disconnect-forfeit"
      });
    }, RECONNECT_WINDOW_MS)
  };
};