const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const videoCatalog = [
  {
    id: "v1",
    title: "Калейдоскоп — Выпуск 1",
    meta: "VK Video",
    embedUrl: "https://vk.com/video_ext.php?oid=-222378310&id=456239380&access_key=e2ac15f282f4b995dd&hd=2"
  }
];

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
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
  if (req.method === "GET" && req.url === "/api/videos") {
    const videos = videoCatalog.map((video) => ({
      id: video.id,
      title: video.title,
      meta: video.meta
    }));

    return sendJson(res, 200, { videos });
  }

  if (req.method === "GET" && req.url.startsWith("/api/videos/") && req.url.endsWith("/embed")) {
    const parts = req.url.split("/");
    const videoId = parts[3];
    const video = videoCatalog.find((item) => item.id === videoId);

    if (!video) {
      return sendJson(res, 404, { error: "Видео не найдено" });
    }

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
