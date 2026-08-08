import http from "node:http";
import crypto from "node:crypto";
import process from "node:process";
import { Pool } from "pg";

const port = Number(process.env.API_PORT ?? 8787);
const password = process.env.APP_PASSWORD;
if (!password) throw new Error("APP_PASSWORD is required");

const pool = new Pool({
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
  max: 3,
  idleTimeoutMillis: 30000,
});

const sessions = new Set();

async function init() {
  await pool.query(`CREATE TABLE IF NOT EXISTS english_study_state (
    id smallint PRIMARY KEY CHECK (id = 1),
    payload jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
}

function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function authenticated(request) {
  const token = request.headers.cookie?.match(/(?:^|; )session=([^;]+)/)?.[1];
  return Boolean(token && sessions.has(token));
}

async function body(request) {
  let text = "";
  for await (const chunk of request) text += chunk;
  return text ? JSON.parse(text) : {};
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (request.method === "OPTIONS") return send(response, 204, {});
    if (url.pathname === "/health") return send(response, 200, { ok: true });
    if (url.pathname === "/api/login" && request.method === "POST") {
      const value = await body(request);
      if (value.password !== password) return send(response, 401, { error: "invalid_credentials" });
      const token = crypto.randomBytes(32).toString("hex");
      sessions.add(token);
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "set-cookie": `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000` });
      return response.end(JSON.stringify({ ok: true }));
    }
    if (url.pathname === "/api/logout" && request.method === "POST") {
      const token = request.headers.cookie?.match(/(?:^|; )session=([^;]+)/)?.[1];
      if (token) sessions.delete(token);
      response.writeHead(204, { "set-cookie": "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" });
      return response.end();
    }
    if (!authenticated(request)) return send(response, 401, { error: "unauthorized" });
    if (url.pathname === "/api/state" && request.method === "GET") {
      const result = await pool.query("SELECT payload, updated_at FROM english_study_state WHERE id = 1");
      return send(response, 200, result.rows[0] ?? { payload: null, updated_at: null });
    }
    if (url.pathname === "/api/state" && request.method === "PUT") {
      const value = await body(request);
      if (!value.payload || typeof value.payload !== "object") return send(response, 400, { error: "payload_required" });
      await pool.query("INSERT INTO english_study_state (id, payload) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()", [value.payload]);
      return send(response, 200, { ok: true });
    }
    return send(response, 404, { error: "not_found" });
  } catch (error) {
    console.error(error);
    return send(response, 500, { error: "server_error" });
  }
});

await init();
server.listen(port, "0.0.0.0", () => console.log(`English study API listening on ${port}`));
