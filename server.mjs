import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const port = 8765;
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const relative = requested.replace(/^[/\\]+/, "");
    let filePath = path.resolve(root, relative);

    if (!filePath.startsWith(`${path.resolve(root)}${path.sep}`)) {
      response.writeHead(403).end("Acceso denegado");
      return;
    }

    if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, "index.html");
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    response.end(content);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Archivo no encontrado");
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") process.exit(0);
  throw error;
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Control Tarifario disponible en http://127.0.0.1:${port}/`);
});
