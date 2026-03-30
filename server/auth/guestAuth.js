const { createGuestGame } = require("../game/gameManager");

const createGuestSession = () => {
  const guestPrefix = process.env.GUEST_NAME_PREFIX || "Guest";
  const guestId = `guest_${Date.now()}`;

  return {
    id: guestId,
    name: `${guestPrefix}-${guestId.slice(-4)}`,
    role: "guest",
    game: createGuestGame()
  };
};

module.exports = {
  createGuestSession
};

