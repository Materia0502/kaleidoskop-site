const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const USERS_FILE = path.join(ROOT, "data", "users.json");

const SHOP_ID = process.env.YOOKASSA_SHOP_ID || "";
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || "";
const APP_BASE_URL = process.env.APP_BASE_URL || "";
const SUBSCRIPTION_PRICE_RUB = 99;
const SUBSCRIPTION_DAYS = 30;

const sessions = new Map();
let memoryUsers = [];

const videoCatalog = [
  {
    id: "v1",
    title: "Калейдоскоп — Выпуск 1",
    meta: "VK Video",
    embedUrl: "https://vk.com/video_ext.php?oid=-222378310&id=456239380&access_key=e2ac15f282f4b995dd&hd=2"
  }
];

function ensureUsersFile() {
  if (!fs.existsSync(path.dirname(USERS_FILE))) {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}

function readUsers() {
  ensureUsersFile();
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf8").replace(/^\uFEFF/, "");
    const data = JSON.parse(raw || "{}");
    const users = Array.isArray(data.users) ? data.users : [];
    memoryUsers = users;
    return users;
  } catch (error) {
    console.warn("Could not read users.json, using in-memory users:", error.message);
    return memoryUsers;
  }
}

function writeUsers(users) {
  memoryUsers = users;
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2));
  } catch (error) {
    console.warn("Could not write users.json, keeping users in memory:", error.message);
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return;
    out[key] = decodeURIComponent(rest.join("="));
  });
  return out;
}

function createSession(res, email) {
  const sid = crypto.randomBytes(24).toString("hex");
  sessions.set(sid, { email, createdAt: Date.now() });
  res.setHeader("Set-Cookie", `sid=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`);
}

function clearSession(req, res) {
  const cookies = parseCookies(req);
  if (cookies.sid) sessions.delete(cookies.sid);
  res.setHeader("Set-Cookie", "sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
}

function getCurrentUser(req) {
  const sid = parseCookies(req).sid;
  if (!sid) return null;
  const session = sessions.get(sid);
  if (!session) return null;
  const users = readUsers();
  return users.find((u) => u.email === session.email) || null;
}

function sanitizeUser(user) {
  return {
    email: user.email,
    subscriptionActive: Boolean(user.subscriptionActive),
    subscriptionExpiresAt: user.subscriptionExpiresAt || null
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hashed = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hashed}`;
}

function verifyPassword(password, stored) {
  const [salt, originalHash] = String(stored || "").split(":");
  if (!salt || !originalHash) return false;
  const checkHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(originalHash, "hex"), Buffer.from(checkHash, "hex"));
}

function isSubscriptionActive(user) {
  if (!user || !user.subscriptionActive) return false;
  if (!user.subscriptionExpiresAt) return false;
  return Date.now() < new Date(user.subscriptionExpiresAt).getTime();
}

function extendSubscription(user) {
  const now = Date.now();
  const prevExpiry = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).getTime() : 0;
  const base = Math.max(now, prevExpiry);
  const newExpiry = new Date(base + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  user.subscriptionActive = true;
  user.subscriptionExpiresAt = newExpiry;
}

function resolveBaseUrl(req) {
  if (APP_BASE_URL) return APP_BASE_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

function yookassaEnabled() {
  return Boolean(SHOP_ID && SECRET_KEY);
}

function yookassaRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const auth = Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString("base64");
    const options = {
      hostname: "api.yookassa.ru",
      path: `/v3${endpoint}`,
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "Idempotence-Key": crypto.randomUUID()
      }
    };

    const request = https.request(options, (response) => {
      let data = "";
      response.on("data", (chunk) => {
        data += chunk;
      });
      response.on("end", () => {
        let parsed = {};
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch (_e) {
          parsed = {};
        }

        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(parsed);
          return;
        }

        const description = parsed.description || parsed.type || "Ошибка ЮKassa";
        reject(new Error(description));
      });
    });

    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
}

function serveStatic(req, res) {
  let filePath = req.url === "/" ? "/index.html" : req.url;
  filePath = filePath.split("?")[0];

  const safePath = path.normalize(filePath).replace(/^([.][.][/\\])+/, "");
  const fullPath = path.join(ROOT, safePath);

  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml"
  };

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        fs.readFile(path.join(ROOT, "index.html"), (fallbackErr, fallback) => {
          if (fallbackErr) {
            res.writeHead(404);
            return res.end("Not found");
          }
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(fallback);
        });
        return;
      }
      res.writeHead(500);
      return res.end("Server error");
    }

    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
}

async function handleApi(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  if (req.method === "GET" && pathname === "/api/auth/me") {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 200, { user: null });

    const active = isSubscriptionActive(user);
    if (user.subscriptionActive !== active) {
      const users = readUsers();
      const idx = users.findIndex((u) => u.email === user.email);
      if (idx !== -1) {
        users[idx].subscriptionActive = active;
        writeUsers(users);
      }
      user.subscriptionActive = active;
    }

    return sendJson(res, 200, { user: sanitizeUser(user) });
  }

  if (req.method === "POST" && pathname === "/api/auth/register") {
    let body;
    try {
      body = await readBody(req);
    } catch (_e) {
      return sendJson(res, 400, { error: "Некорректный JSON" });
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password || password.length < 6) {
      return sendJson(res, 400, { error: "Введите email и пароль от 6 символов" });
    }

    const users = readUsers();
    if (users.some((u) => u.email === email)) {
      return sendJson(res, 409, { error: "Пользователь уже существует" });
    }

    const user = {
      email,
      passwordHash: hashPassword(password),
      subscriptionActive: false,
      subscriptionExpiresAt: null,
      createdAt: new Date().toISOString()
    };

    users.push(user);
    writeUsers(users);
    createSession(res, email);
    return sendJson(res, 201, { user: sanitizeUser(user) });
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    let body;
    try {
      body = await readBody(req);
    } catch (_e) {
      return sendJson(res, 400, { error: "Некорректный JSON" });
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    const users = readUsers();
    const user = users.find((u) => u.email === email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return sendJson(res, 401, { error: "Неверный email или пароль" });
    }

    const active = isSubscriptionActive(user);
    user.subscriptionActive = active;
    createSession(res, email);
    writeUsers(users);
    return sendJson(res, 200, { user: sanitizeUser(user) });
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    clearSession(req, res);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/subscription/create-payment") {
    const current = getCurrentUser(req);
    if (!current) return sendJson(res, 401, { error: "Нужен вход в аккаунт" });
    if (!yookassaEnabled()) {
      return sendJson(res, 500, { error: "ЮKassa не настроена. Добавьте переменные YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY" });
    }

    const baseUrl = resolveBaseUrl(req);
    const payment = await yookassaRequest("POST", "/payments", {
      amount: {
        value: `${SUBSCRIPTION_PRICE_RUB}.00`,
        currency: "RUB"
      },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: `${baseUrl}/?payment=return`
      },
      description: `Подписка Калейдоскоп ${SUBSCRIPTION_PRICE_RUB} RUB / месяц`,
      metadata: {
        user_email: current.email,
        plan: "monthly_99_rub"
      }
    });

    return sendJson(res, 200, {
      paymentId: payment.id,
      confirmationUrl: payment.confirmation && payment.confirmation.confirmation_url
    });
  }

  if (req.method === "GET" && pathname === "/api/subscription/confirm") {
    const current = getCurrentUser(req);
    if (!current) return sendJson(res, 401, { error: "Нужен вход в аккаунт" });
    if (!yookassaEnabled()) {
      return sendJson(res, 500, { error: "ЮKassa не настроена" });
    }

    const paymentId = requestUrl.searchParams.get("paymentId");
    if (!paymentId) return sendJson(res, 400, { error: "Не передан paymentId" });

    const payment = await yookassaRequest("GET", `/payments/${paymentId}`);
    if (payment.metadata && payment.metadata.user_email && payment.metadata.user_email !== current.email) {
      return sendJson(res, 403, { error: "Платеж привязан к другому аккаунту" });
    }

    if (payment.status !== "succeeded") {
      return sendJson(res, 200, {
        ok: false,
        status: payment.status,
        message: "Платеж пока не завершен"
      });
    }

    const users = readUsers();
    const idx = users.findIndex((u) => u.email === current.email);
    if (idx === -1) return sendJson(res, 404, { error: "Пользователь не найден" });

    extendSubscription(users[idx]);
    writeUsers(users);

    return sendJson(res, 200, {
      ok: true,
      status: payment.status,
      user: sanitizeUser(users[idx])
    });
  }

  if (req.method === "POST" && pathname === "/api/yookassa/webhook") {
    let body;
    try {
      body = await readBody(req);
    } catch (_e) {
      return sendJson(res, 400, { error: "Некорректный JSON" });
    }

    const event = body && body.event;
    const object = body && body.object;

    if (event === "payment.succeeded" && object && object.metadata && object.metadata.user_email) {
      const users = readUsers();
      const idx = users.findIndex((u) => u.email === object.metadata.user_email);
      if (idx !== -1) {
        extendSubscription(users[idx]);
        writeUsers(users);
      }
    }

    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/videos") {
    const user = getCurrentUser(req);
    const canWatch = isSubscriptionActive(user);

    const list = videoCatalog.map((video) => ({
      id: video.id,
      title: video.title,
      meta: video.meta,
      locked: !canWatch
    }));

    return sendJson(res, 200, { videos: list, canWatch, priceRub: SUBSCRIPTION_PRICE_RUB });
  }

  if (req.method === "GET" && pathname.startsWith("/api/videos/") && pathname.endsWith("/embed")) {
    const user = getCurrentUser(req);
    if (!isSubscriptionActive(user)) {
      return sendJson(res, 403, { error: "Нужна активная подписка" });
    }

    const parts = pathname.split("/");
    const videoId = parts[3];
    const video = videoCatalog.find((v) => v.id === videoId);
    if (!video) return sendJson(res, 404, { error: "Видео не найдено" });

    return sendJson(res, 200, {
      id: video.id,
      title: video.title,
      embedUrl: video.embedUrl
    });
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      const handled = await handleApi(req, res);
      if (handled !== false) return;
      return sendJson(res, 404, { error: "API route not found" });
    }

    serveStatic(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Kaleidoskop server started on http://localhost:${PORT}`);
});
