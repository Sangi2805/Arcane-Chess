const { promisify } = require("util");
const { randomBytes, scrypt: scryptCallback, timingSafeEqual, createHash } = require("crypto");

const User = require("../models/User");
const UserSession = require("../models/UserSession");
const { getMongoStatus, isMongoAvailable } = require("../db/mongo");

const scrypt = promisify(scryptCallback);
const DEFAULT_SESSION_COOKIE_NAME = "arcane_session";
const DEFAULT_SESSION_TTL_DAYS = 14;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class AuthenticationError extends Error {
  constructor(message = "Authentication failed.", statusCode = 401) {
    super(message);
    this.name = "AuthenticationError";
    this.statusCode = statusCode;
  }
}

const ensureAuthPersistence = () => {
  if (!isMongoAvailable()) {
    const error = new AuthenticationError(
      `Authentication is unavailable because MongoDB is ${getMongoStatus()}.`,
      503
    );
    throw error;
  }
};

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

const normalizeDisplayName = (displayName, email = "") => {
  const trimmedDisplayName =
    typeof displayName === "string" ? displayName.trim() : "";

  if (trimmedDisplayName) {
    return trimmedDisplayName.slice(0, 40);
  }

  const emailPrefix = normalizeEmail(email).split("@")[0] || "Arcane Player";
  return emailPrefix.slice(0, 40);
};

const validateRegistrationInput = ({ email, password, displayName }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedDisplayName = normalizeDisplayName(displayName, normalizedEmail);

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new AuthenticationError("Enter a valid email address.", 400);
  }

  if (typeof password !== "string" || password.length < 8) {
    throw new AuthenticationError(
      "Choose a password with at least 8 characters.",
      400
    );
  }

  if (!normalizedDisplayName) {
    throw new AuthenticationError("Enter a display name.", 400);
  }

  return {
    email: normalizedEmail,
    displayName: normalizedDisplayName,
    password
  };
};

const hashSessionToken = (token) =>
  createHash("sha256").update(String(token)).digest("hex");

const buildPasswordHash = async (password, salt = randomBytes(16).toString("hex")) => {
  const derivedKey = await scrypt(password, salt, 64);

  return {
    salt,
    hash: Buffer.from(derivedKey).toString("hex")
  };
};

const verifyPassword = async (password, { salt, hash }) => {
  const derivedKey = await scrypt(password, salt, 64);
  const derivedBuffer = Buffer.from(derivedKey);
  const expectedBuffer = Buffer.from(hash, "hex");

  if (derivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedBuffer, expectedBuffer);
};

const getSessionCookieName = () =>
  process.env.SESSION_COOKIE_NAME || DEFAULT_SESSION_COOKIE_NAME;

const getSessionTtlDays = () => {
  const configuredDays = Number.parseInt(
    process.env.SESSION_TTL_DAYS || DEFAULT_SESSION_TTL_DAYS,
    10
  );

  return Number.isFinite(configuredDays) && configuredDays > 0
    ? configuredDays
    : DEFAULT_SESSION_TTL_DAYS;
};

const getSessionTtlMs = () => getSessionTtlDays() * 24 * 60 * 60 * 1000;

const shouldUseSecureCookies = () => {
  const configuredValue = process.env.SESSION_COOKIE_SECURE;

  if (configuredValue === "true") {
    return true;
  }

  if (configuredValue === "false") {
    return false;
  }

  return process.env.NODE_ENV === "production";
};

const serializeUser = (user) => ({
  id: String(user._id),
  email: user.email,
  displayName: user.displayName,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  lastLoginAt: user.lastLoginAt || null
});

const getCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: shouldUseSecureCookies(),
  path: "/",
  maxAge: getSessionTtlMs()
});

const setSessionCookie = (response, token) => {
  response.cookie(getSessionCookieName(), token, getCookieOptions());
};

const clearSessionCookie = (response) => {
  response.clearCookie(getSessionCookieName(), {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/"
  });
};

const createSession = async (user, metadata = {}) => {
  ensureAuthPersistence();

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + getSessionTtlMs());

  await UserSession.create({
    userId: user._id,
    tokenHash: hashSessionToken(token),
    expiresAt,
    lastSeenAt: new Date(),
    userAgent: metadata.userAgent || null,
    ipAddress: metadata.ipAddress || null
  });

  return {
    token,
    expiresAt
  };
};

const registerUser = async ({ email, password, displayName }) => {
  ensureAuthPersistence();

  const normalizedInput = validateRegistrationInput({
    email,
    password,
    displayName
  });
  const existingUser = await User.findOne({
    email: normalizedInput.email
  }).lean();

  if (existingUser) {
    throw new AuthenticationError("An account with that email already exists.", 409);
  }

  const passwordRecord = await buildPasswordHash(normalizedInput.password);
  const user = await User.create({
    email: normalizedInput.email,
    displayName: normalizedInput.displayName,
    passwordHash: passwordRecord.hash,
    passwordSalt: passwordRecord.salt,
    lastLoginAt: new Date()
  });

  return user;
};

const authenticateUser = async ({ email, password }) => {
  ensureAuthPersistence();

  const normalizedEmail = normalizeEmail(email);

  if (!EMAIL_PATTERN.test(normalizedEmail) || typeof password !== "string" || !password) {
    throw new AuthenticationError("Enter your email and password.", 400);
  }

  const user = await User.findOne({
    email: normalizedEmail
  });

  if (!user) {
    throw new AuthenticationError("Incorrect email or password.");
  }

  const passwordMatches = await verifyPassword(password, {
    salt: user.passwordSalt,
    hash: user.passwordHash
  });

  if (!passwordMatches) {
    throw new AuthenticationError("Incorrect email or password.");
  }

  user.lastLoginAt = new Date();
  await user.save();

  return user;
};

const getSessionFromToken = async (token) => {
  if (!token || !isMongoAvailable()) {
    return null;
  }

  const session = await UserSession.findOne({
    tokenHash: hashSessionToken(token)
  }).lean();

  if (!session) {
    return null;
  }

  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    await UserSession.deleteOne({ _id: session._id });
    return null;
  }

  const user = await User.findById(session.userId).lean();

  if (!user) {
    await UserSession.deleteOne({ _id: session._id });
    return null;
  }

  return {
    session,
    user: serializeUser(user)
  };
};

const destroySessionByToken = async (token) => {
  if (!token || !isMongoAvailable()) {
    return;
  }

  await UserSession.deleteOne({
    tokenHash: hashSessionToken(token)
  });
};

const getAuthPersistence = () => ({
  available: isMongoAvailable(),
  status: getMongoStatus()
});

module.exports = {
  AuthenticationError,
  authenticateUser,
  clearSessionCookie,
  createSession,
  destroySessionByToken,
  getAuthPersistence,
  getSessionCookieName,
  getSessionFromToken,
  getSessionTtlDays,
  hashSessionToken,
  registerUser,
  serializeUser,
  setSessionCookie
};
