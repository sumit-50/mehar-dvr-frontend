import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || process.env.NITRO_PORT || 3000);
const HOST = "0.0.0.0";
const CLIENT_DIR = path.join(__dirname, "dist", "client");
const SERVER_BUNDLE = path.join(__dirname, "dist", "server", "server.js");

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

let ssrHandler = null;

// Dynamically load TanStack Start SSR handler if available
if (fs.existsSync(SERVER_BUNDLE)) {
  try {
    const imported = await import(`file://${SERVER_BUNDLE.replace(/\\/g, "/")}`);
    if (imported.default && typeof imported.default.fetch === "function") {
      ssrHandler = imported.default.fetch;
      console.log("[Server] Loaded TanStack Start SSR handler successfully.");
    }
  } catch (err) {
    console.warn("[Server] SSR bundle load notice, falling back to SPA mode:", err.message);
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Health check endpoint for Coolify / Docker
  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("healthy\n");
    return;
  }

  // Check if requested path matches a static client file
  let filePath = path.join(CLIENT_DIR, pathname);
  
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

  // Handle SSR request if available
  if (ssrHandler) {
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v));
          } else {
            headers.set(key, value);
          }
        }
      }

      const body = req.method !== "GET" && req.method !== "HEAD" ? req : undefined;
      const webReq = new Request(parsedUrl.toString(), {
        method: req.method,
        headers,
        body,
        duplex: "half",
      });

      const webRes = await ssrHandler(webReq);
      
      const resHeaders = {};
      webRes.headers.forEach((val, key) => {
        resHeaders[key] = val;
      });

      res.writeHead(webRes.status, resHeaders);
      
      if (webRes.body) {
        const reader = webRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
      return;
    } catch (ssrErr) {
      console.error("[SSR Error]", ssrErr);
    }
  }

  // Fallback to index.html for client SPA routing
  const indexHtmlPath = path.join(CLIENT_DIR, "index.html");
  if (fs.existsSync(indexHtmlPath)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    fs.createReadStream(indexHtmlPath).pipe(res);
    return;
  }

  // If index.html doesn't exist, search for HTML in dist/client
  const htmlFiles = fs.existsSync(CLIENT_DIR) ? fs.readdirSync(CLIENT_DIR).filter(f => f.endsWith(".html")) : [];
  if (htmlFiles.length > 0) {
    const firstHtml = path.join(CLIENT_DIR, htmlFiles[0]);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    fs.createReadStream(firstHtml).pipe(res);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Mehar DVR Frontend production server running on http://${HOST}:${PORT}`);
});
