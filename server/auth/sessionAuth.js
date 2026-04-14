const {
  getSessionCookieName,
  getSessionFromToken
} = require("../services/authService");

const parseCookies = (cookieHeader = "") =>
  cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const separatorIndex = entry.indexOf("=");

      if (separatorIndex === -1) {
        return cookies;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();

      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});

const attachRequestAuth = async (request, response, next) => {
  try {
    const cookies = parseCookies(request.headers.cookie || "");
    const sessionToken = cookies[getSessionCookieName()] || null;
    const sessionState = await getSessionFromToken(sessionToken);

    request.auth = {
      authenticated: Boolean(sessionState?.user),
      token: sessionToken,
      user: sessionState?.user || null,
      session: sessionState?.session || null
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  attachRequestAuth
};
