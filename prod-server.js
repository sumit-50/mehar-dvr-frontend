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

// Dynamically import the compiled TanStack Start SSR Server Bundle
try {
  if (fs.existsSync(SERVER_BUNDLE)) {
    const serverModule = await import(`file://${SERVER_BUNDLE.replace(/\\/g, "/")}`);
    if (serverModule?.default?.fetch && typeof serverModule.default.fetch === "function") {
      ssrHandler = serverModule.default.fetch;
      console.log("✅ TanStack Start SSR handler loaded successfully.");
    }
  }
} catch (err) {
  console.error("❌ Failed to load SSR bundle:", err);
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

  // 1. Serve static client asset if file exists in dist/client
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

  // 2. Delegate page route to TanStack Start SSR Handler
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

      const webRes = await ssrHandler(webReq, {}, {});

      const resHeaders = {};
      webRes.headers.forEach((val, key) => {
        resHeaders[key] = val;
      });

      res.writeHead(webRes.status || 200, resHeaders);

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
      console.error("[SSR Render Error]", ssrErr);
    }
  }

  res.writeHead(500, { "Content-Type": "text/plain" });
  res.end("Internal Server Error rendering page");
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Mehar DVR Frontend production server running on http://${HOST}:${PORT}`);
});
