import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { basename, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".sql": "text/plain; charset=utf-8"
};

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://cdn.jsdelivr.net https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join("; ");

const publicRoots = new Set(["assets", "docs"]);
const publicFiles = new Set(["index.html", "manifest.webmanifest", "sw.js", "config.js"]);

function isPublicRequest(pathname) {
  const clean = pathname.replace(/^\/+/, "");
  if (!clean) return true;
  const first = clean.split("/")[0];
  return publicFiles.has(clean) || publicRoots.has(first);
}

function safePath(urlPath) {
  let clean;
  try {
    clean = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  const normalized = normalize(clean).replace(/^([/\\])+/, "");
  if (normalized.split(/[\\/]/).some((segment) => segment.startsWith("."))) return null;
  const candidate = resolve(root, normalized);
  const rootPath = resolve(root);
  return candidate === rootPath || candidate.startsWith(`${rootPath}${sep}`) ? candidate : null;
}

function headers(pathname) {
  return {
    "Content-Type": mime[extname(pathname).toLowerCase()] || "application/octet-stream",
    "Cache-Control": /^config(?:\.local)?\.js$/i.test(basename(pathname)) ? "no-store" : "no-cache",
    "Content-Security-Policy": contentSecurityPolicy,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
  };
}

function sendText(res, status, message) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(message);
}

const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method || "GET")) {
    res.setHeader("Allow", "GET, HEAD");
    sendText(res, 405, "Method not allowed");
    return;
  }

  let requestUrl;
  try {
    requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  } catch {
    sendText(res, 400, "Bad request");
    return;
  }

  let pathname = requestUrl.pathname;
  if (!isPublicRequest(pathname) || pathname === "/config.local.js") {
    sendText(res, 404, "Not found");
    return;
  }
  if (pathname === "/config.js" && existsSync(join(root, "config.local.js"))) {
    pathname = "/config.local.js";
  }

  let filePath = safePath(pathname);
  if (!filePath) {
    sendText(res, 400, "Bad request");
    return;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    const acceptsHtml = String(req.headers.accept || "").includes("text/html");
    if (acceptsHtml || !extname(pathname)) {
      filePath = join(root, "index.html");
    } else {
      sendText(res, 404, "Not found");
      return;
    }
  }

  res.writeHead(200, headers(filePath));
  if (req.method === "HEAD") res.end();
  else createReadStream(filePath).pipe(res);
});

server.on("clientError", (_error, socket) => {
  socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
});

server.listen(port, host, () => {
  console.log(`CuriousStride is running at http://${host}:${port}`);
  console.log(`Mode: ${existsSync(join(root, "config.local.js")) ? "Supabase configuration" : "safe setup mode"}`);
  console.log("Press Ctrl+C to stop.");
});
