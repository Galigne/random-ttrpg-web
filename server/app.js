const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { createGzip } = require("node:zlib");
const { createLive } = require("./live");
const { digest, parseCookies } = require("./security");

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
function fail(status, code) {
  throw new HttpError(status, code);
}
function createApplication(db, options = {}) {
  const live = createLive(db, options.clock);
  const routes = [];
  const root = path.resolve(__dirname, "..");
  const secureCookies =
    options.secureCookies ?? process.env.SECURE_COOKIES === "1";
  function route(method, pattern, handler, settings = {}) {
    const names = [];
    const regex = new RegExp(
      "^" +
        pattern.replace(/:([a-zA-Z]+)/g, (_, key) => {
          names.push(key);
          return "([^/]+)";
        }) +
        "$",
    );
    routes.push({ method, regex, names, handler, settings });
  }
  function diceAppearance(userId) {
    return db.prepare("SELECT skin, glow FROM dice_preferences WHERE user_id=?").get(userId)
      || { skin: "marble", glow: null };
  }
  const entities = require("./entity-service").createEntityService(db, live, fail);
  const ctx = { db, live, route, fail, secureCookies, diceAppearance, entities };
  route("GET", "/api/locale", ({ user }) => {
    const translations = require(
      `../rpg/locales/${user.language === "fr" ? "fr" : "en"}.json`,
    );
    return {
      character: translations.character,
      creature: translations.creature,
      generatorFields: translations.generatorFields,
      errors: translations.errors,
    };
  });
  require("./auth-routes")(ctx);
  require("./campaign-routes")(ctx);
  require("./entity-routes")(ctx);
  require("./battle-routes")(ctx);
  function session(req) {
    const raw = parseCookies(req.headers.cookie).random_session;
    if (!raw || !/^[A-Za-z0-9_-]{43}$/.test(raw)) return null;
    const hash = digest(raw);
    const row = db
      .prepare(
        `SELECT u.id,u.username,u.role,u.status,u.language,s.csrf,s.expires_at
      FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?`,
      )
      .get(hash);
    return row && row.status === "active" && row.expires_at > Date.now()
      ? { user: row, hash, csrf: row.csrf }
      : null;
  }
  function header(res, contentType) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'",
    );
    if (contentType) res.setHeader("Content-Type", contentType);
  }
  function json(res, status, payload) {
    if (res.writableEnded) return;
    header(res, "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.statusCode = status;
    res.end(JSON.stringify(payload));
  }
  async function body(req) {
    if (
      !String(req.headers["content-type"] || "").startsWith("application/json")
    )
      fail(415, "JSON_REQUIRED");
    let length = 0;
    const chunks = [];
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 6 * 1024 * 1024) fail(413, "UPLOAD_TOO_LARGE");
      chunks.push(chunk);
    }
    try {
      const result = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      if (!result || typeof result !== "object" || Array.isArray(result))
        throw new Error();
      return result;
    } catch {
      fail(400, "INVALID_JSON");
    }
  }
  const fileVersions = new Map();
  function fileVersion(file, stat = fs.statSync(file)) {
    const stamp = `${stat.size}:${stat.mtimeMs}`;
    const cached = fileVersions.get(file);
    if (cached?.stamp === stamp) return cached.hash;
    const hash = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    fileVersions.set(file, { stamp, hash });
    return hash;
  }
  function versionedIndex() {
    const file = path.join(root, "public/index.html");
    return fs.readFileSync(file, "utf8").replace(/(src|href)="(\/(?:[a-zA-Z0-9/-]+\.(?:js|css)))(?:\?[^"\s]*)?"/g,
      (match, attribute, url) => {
        const asset = path.join(root, "public", url.slice(1));
        return fs.existsSync(asset) ? `${attribute}="${url}?v=${fileVersion(asset).slice(0, 16)}"` : match;
      });
  }
  function staticFile(req, res, url, auth) {
    let filename;
    if (url.pathname === "/") filename = "public/index.html";
    else if (["/app.js", "/core.js", "/translations.js", "/navigation.js", "/campaign-screen.js", "/generators.js", "/sheet-editor.js"].includes(url.pathname)) filename = `public${url.pathname}`;
    else if (url.pathname === "/style.css") filename = "public/style.css";
    else if (/^\/dice\/(?:(?:coin|d20|classic|skins|playback)\.js|art\/[a-z0-9-]+\.webp)$/.test(url.pathname))
      filename = `public${url.pathname}`;
    else if (
      /^\/media\/(?:characters|cover|dice|combat)\.webp$/.test(url.pathname)
    )
      filename = `media/rulebook/${path.basename(url.pathname)}`;
    else if (
      /^\/media\/(?:D20-(?:[1-9]|1[0-9]|20)\.gif|HEADS\.gif|TAILS\.gif|[a-z0-9_-]+\.(?:webp|png))$/.test(
        url.pathname,
      )
    )
      filename = `public${url.pathname}`;
    else if (/^\/fonts\/[A-Za-z-]+\.(?:ttf|woff2)$/.test(url.pathname))
      filename = `documentation/rulebook${url.pathname}`;
    else if (/^\/rulebook\/assets\/[a-z0-9_-]+\.webp$/.test(url.pathname)) {
      if (!auth) { json(res, 401, { error: "LOGIN_REQUIRED" }); return true; }
      filename = `public/rulebook-art/${path.basename(url.pathname)}`;
    }
    else if (
      url.pathname === "/rulebook/en" ||
      url.pathname === "/rulebook/fr"
    ) {
      if (!auth) {
        json(res, 401, { error: "LOGIN_REQUIRED" });
        return true;
      }
      filename = url.pathname.endsWith("/fr")
        ? "documentation/website-rules-fr.html"
        : "documentation/website-rules-en.html";
    } else return false;
    const types = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".png": "image/png",
      ".ttf": "font/ttf",
      ".woff2": "font/woff2",
    };
    const file = path.join(root, filename);
    if (!fs.existsSync(file)) {
      json(res, 404, { error: "NOT_FOUND" });
      return true;
    }
    const privateAsset = filename.startsWith("public/rulebook-art/");
    const privatePage = filename.startsWith("documentation/") && filename.endsWith(".html");
    const index = filename === "public/index.html";
    const stat = fs.statSync(file);
    const contents = index ? Buffer.from(versionedIndex()) : null;
    const version = index ? createHash("sha256").update(contents).digest("hex") : fileVersion(file, stat);
    const etag = `W/"${version}"`;
    const textAsset = /\.(?:html|js|css)$/.test(filename);
    header(res, types[path.extname(file)] || "application/octet-stream");
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", privatePage ? "private, no-store" : privateAsset ? "private, no-cache" :
      url.searchParams.get("v") === version.slice(0, 16) ? "public, max-age=31536000, immutable" :
      textAsset ? "no-cache" : "public, max-age=3600");
    if (textAsset) res.setHeader("Vary", "Accept-Encoding");
    if (!privatePage && req.headers["if-none-match"]?.split(/\s*,\s*/).includes(etag)) {
      res.statusCode = 304;
      res.end();
      return true;
    }
    const gzip = textAsset && /(?:^|,)\s*gzip\s*(?:;\s*q=(?!0(?:\.0*)?(?:,|$))[^,]+)?(?:,|$)/i.test(req.headers["accept-encoding"] || "");
    if (gzip) res.setHeader("Content-Encoding", "gzip");
    if (contents) {
      if (gzip) require("node:zlib").gzip(contents, (error, result) => error ? res.destroy(error) : res.end(result));
      else res.end(contents);
    } else {
      const stream = fs.createReadStream(file);
      stream.on("error", error => res.destroy(error));
      if (gzip) stream.pipe(createGzip()).pipe(res);
      else stream.pipe(res);
    }
    return true;
  }
  async function handler(req, res) {
    try {
      const url = new URL(req.url, "http://localhost");
      const auth = session(req);
      if (req.method === "GET" && staticFile(req, res, url, auth)) return;
      const matchRoute = routes.find(
        (item) => item.method === req.method && item.regex.test(url.pathname),
      );
      if (!matchRoute) fail(404, "NOT_FOUND");
      const matched = matchRoute.regex.exec(url.pathname);
      const params = Object.fromEntries(
        matchRoute.names.map((name, index) => [
          name,
          decodeURIComponent(matched[index + 1]),
        ]),
      );
      if (!matchRoute.settings.public && !auth) fail(401, "LOGIN_REQUIRED");
      if (!["GET", "HEAD"].includes(req.method)) {
        if (req.headers.origin) {
          let origin;
          try {
            origin = new URL(req.headers.origin);
          } catch {
            fail(403, "ORIGIN_DENIED");
          }
          if (origin.host !== req.headers.host) fail(403, "ORIGIN_DENIED");
        }
        if (
          auth &&
          !matchRoute.settings.noCsrf &&
          req.headers["x-csrf-token"] !== auth.csrf
        )
          fail(403, "CSRF");
      }
      const payload = ["GET", "HEAD"].includes(req.method)
        ? {}
        : await body(req);
      const result = await matchRoute.handler({
        req,
        res,
        url,
        params,
        body: payload,
        auth,
        user: auth?.user,
      });
      if (result !== undefined && !res.writableEnded) json(res, 200, result);
    } catch (error) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (error instanceof HttpError)
        json(res, error.status, { error: error.code });
      else if (/^(INVALID_|DICE_|MODIFIER_)/.test(error.code || error.message))
        json(res, 400, {
          error: error.translationKey || error.code || error.message,
        });
      else {
        console.error("Request failed:", error.message);
        json(res, 500, { error: "INTERNAL_ERROR" });
      }
    }
  }
  return { handler, live };
}
module.exports = { createApplication, HttpError };
