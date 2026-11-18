const crypto = require("node:crypto");
const { promisify } = require("node:util");
const scrypt = promisify(crypto.scrypt);
const id = () => crypto.randomUUID();
const token = () => crypto.randomBytes(32).toString("base64url");
const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

function validUsername(value) {
  return (
    typeof value === "string" &&
    /^[a-zA-Z0-9_][a-zA-Z0-9_.-]{2,31}$/.test(value)
  );
}
function validPassword(value) {
  return (
    typeof value === "string" &&
    value.length >= 12 &&
    Buffer.byteLength(value) <= 256
  );
}
async function hashPassword(password) {
  if (!validPassword(password)) throw new Error("PASSWORD_REQUIREMENTS");
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt}$${hash.toString("base64url")}`;
}
async function verifyPassword(password, stored) {
  if (
    typeof password !== "string" ||
    Buffer.byteLength(password) > 256 ||
    typeof stored !== "string"
  )
    return false;
  const [algorithm, salt, encoded] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !encoded) return false;
  const expected = Buffer.from(encoded, "base64url");
  if (expected.length !== 64) return false;
  const actual = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}
function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
function sessionCookie(value, secure, maxAge = 604800) {
  return `random_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
function makeLimiter({ limit = 12, windowMs = 15 * 60 * 1000 } = {}) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    for (const [k, value] of hits) if (value.until <= now) hits.delete(k);
    const item = hits.get(key) ?? { count: 0, until: now + windowMs };
    item.count++;
    hits.set(key, item);
    return item.count <= limit;
  };
}
module.exports = {
  id,
  token,
  digest,
  validUsername,
  validPassword,
  hashPassword,
  verifyPassword,
  parseCookies,
  sessionCookie,
  makeLimiter,
};
