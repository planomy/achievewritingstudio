#!/usr/bin/env node
/**
 * Local server for Achieve Key Skills Studio.
 * Serves index.html and proxies /proxy/v1/chat/completions → OpenAI (avoids browser CORS).
 *
 * Usage: node server.mjs
 * Open: http://localhost:3847
 *
 * Requires Node 18+ (global fetch).
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3847;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...headers });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

async function proxyOpenAI(req, res) {
  const auth = req.headers.authorization;
  if (!auth || !String(auth).startsWith("Bearer ")) {
    send(res, 401, JSON.stringify({ error: { message: "Missing Authorization bearer token." } }), {
      "Content-Type": "application/json",
      ...CORS,
    });
    return;
  }
  let body;
  try {
    body = await readBody(req);
  } catch {
    send(res, 400, JSON.stringify({ error: { message: "Bad body" } }), { "Content-Type": "application/json", ...CORS });
    return;
  }
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body,
    });
    const text = await r.text();
    send(res, r.status, text, {
      "Content-Type": r.headers.get("content-type") || "application/json",
      ...CORS,
    });
  } catch (e) {
    send(res, 502, JSON.stringify({ error: { message: e.message || "Proxy error" } }), {
      "Content-Type": "application/json",
      ...CORS,
    });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 204, "", CORS);
    return;
  }

  const urlPath = (req.url || "/").split("?")[0];

  if (urlPath.startsWith("/proxy/v1/chat/completions") && req.method === "POST") {
    await proxyOpenAI(req, res);
    return;
  }

  let filePath = urlPath === "/" ? "/index.html" : urlPath;
  const full = path.normalize(path.join(__dirname, filePath));
  if (!full.startsWith(__dirname)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(full, (err, data) => {
    if (err) {
      send(res, 404, "Not found");
      return;
    }
    const ext = path.extname(full);
    send(res, 200, data, { "Content-Type": MIME[ext] || "application/octet-stream" });
  });
});

server.listen(PORT, () => {
  console.log(`Achieve Key Skills Studio → http://localhost:${PORT}`);
  console.log(`(API key stays in the browser; this server only proxies requests.)`);
});
