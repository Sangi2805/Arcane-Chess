import { state } from "./state.js";

let realtimeHandlers = {};

export const initializeMultiplayerRealtime = (handlers = {}) => {
  realtimeHandlers = handlers;
};

export const ensureMultiplayerSocket = () => {
  if (state.multiplayer.socket) {
    return state.multiplayer.socket;
  }

  if (typeof window.io !== "function") {
    realtimeHandlers.onSocketUnavailable?.();
    return null;
  }

  const socket = window.io(window.location.origin, {
    transports: ["websocket", "polling"]
  });

  socket.on("connect", () => {
    console.log("CLIENT CONNECTED:", socket.id);
    state.multiplayer.connected = true;
    realtimeHandlers.onConnected?.();

    void emitMultiplayerEvent("queue:status-request")
      .then((queueState) => {
        realtimeHandlers.onQueueStatus?.(queueState);
      })
      .catch(() => {
        realtimeHandlers.onQueueStatus?.({ queued: false });
      });
  });

  socket.on("disconnect", () => {
    state.multiplayer.connected = false;
    realtimeHandlers.onQueueStatus?.({ queued: false });
    realtimeHandlers.onDisconnected?.();
  });

  socket.on("queue:status", (queueState) => {
    realtimeHandlers.onQueueStatus?.(queueState);
  });

  socket.on("queue:error", (payload = {}) => {
    realtimeHandlers.onQueueError?.(payload);
  });

  socket.on("match:found", (payload = {}) => {
    state.multiplayer.queued = false;
    state.multiplayer.queuePosition = null;
    state.multiplayer.queueTimeControlId = null;
    state.multiplayer.phase = "active";
    realtimeHandlers.onMatchFound?.(payload);
  });

  socket.on("multiplayer:state", (socketState) => {
    realtimeHandlers.onMultiplayerState?.(socketState);
  });

  state.multiplayer.socket = socket;

  return socket;
};

export const emitMultiplayerEvent = (eventName, payload = {}) => {
  const socket = ensureMultiplayerSocket();

  if (!socket) {
    return Promise.reject(new Error("Multiplayer socket is unavailable."));
  }

  return new Promise((resolve, reject) => {
    socket.timeout(7000).emit(eventName, payload, (error, response) => {
      if (error) {
        reject(new Error("Multiplayer request timed out."));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.message || "Multiplayer request failed."));
        return;
      }

      resolve(response.state || null);
    });
  });
};

export const leaveMultiplayerRoom = () => {
  if (!state.multiplayer.socket || !state.multiplayer.roomId) {
    return;
  }

  state.multiplayer.socket.emit("multiplayer:leave");
  state.multiplayer.roomId = null;
  state.multiplayer.color = null;
  state.multiplayer.phase = "idle";
};