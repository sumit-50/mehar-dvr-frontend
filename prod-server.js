import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || process.env.NITRO_PORT || 3000);
const HOST = "0.0.0.0";
const CLIENT_DIR = path.join(__dirname, "dist", "client");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
};

// Find the main HTML entry file
function getIndexHtmlPath() {
  const directIndex = path.join(CLIENT_DIR, "index.html");
  if (fs.existsSync(directIndex)) return directIndex;

  if (fs.existsSync(CLIENT_DIR)) {
    const htmlFiles = fs.readdirSync(CLIENT_DIR).filter((f) => f.endsWith(".html"));
    if (htmlFiles.length > 0) {
      return path.join(CLIENT_DIR, htmlFiles[0]);
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Health check endpoint for Coolify / Docker
  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("healthy\n");
    return;
  }

  // 1. Check if the exact static asset exists in dist/client
  const filePath = path.join(CLIENT_DIR, pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // 2. Serve SPA Client Entry HTML for all page routes (/, /auth, /dashboard, /visit, /admin/*)
  const indexHtml = getIndexHtmlPath();
  if (indexHtml && fs.existsSync(indexHtml)) {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(indexHtml).pipe(res);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Page Not Found");
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Mehar DVR Frontend client production server running on http://${HOST}:${PORT}`);
});
