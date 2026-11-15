// Local bridge between the Event Planner app (5173) and the Staff Console (5174). No dependencies.
//   node bridge/server.mjs        → http://localhost:5175
// Public endpoints (used by the customer app): send a request, read request status, read published prices/templates.
// Staff endpoints (need the x-staff-key header): pull new requests, publish prices/templates/statuses.
// Prototype storage: bridge/data.json. In production this becomes the real backend + database.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const PORT = 5175;
const STAFF_KEY = process.env.STAFF_BRIDGE_KEY || "dev-only-staff-key";
// Each app has its own address (…​.localhost resolves to this machine, no hosts-file edit needed).
const ORIGINS = new Set(["http://eventplanner.localhost:5173", "http://staff.eventplanner.localhost:5174", "http://localhost:5173", "http://localhost:5174"]);
const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "data.json");
const empty = () => ({ inbox: [], chats: {}, published: { plans: null, web: null, design: null, templates: [], statuses: {} } });
let db = (() => { try { return { ...empty(), ...JSON.parse(fs.readFileSync(FILE, "utf8")) }; } catch { return empty(); } })();
const save = () => fs.writeFileSync(FILE, JSON.stringify(db));
const clip = (v, n) => String(v ?? "").slice(0, n);
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

const send = (res, code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((ok, bad) => {
  let n = 0; const chunks = [];
  req.on("data", (c) => { n += c.length; if (n > 2_000_000) { bad(new Error("too large")); req.destroy(); } else chunks.push(c); });
  req.on("end", () => { try { ok(JSON.parse(Buffer.concat(chunks).toString() || "{}")); } catch (e) { bad(e); } });
});

http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ORIGINS.has(origin)) { res.setHeader("access-control-allow-origin", origin); res.setHeader("vary", "origin"); res.setHeader("access-control-allow-headers", "content-type, x-staff-key"); res.setHeader("access-control-allow-methods", "GET, POST, PUT, OPTIONS"); }
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, "http://x");
  const staff = same(req.headers["x-staff-key"] || "", STAFF_KEY);
  try {
    // ── public ──
    if (req.method === "POST" && url.pathname === "/api/requests") {
      const b = await readBody(req);
      const kind = b.kind === "design" ? "design" : "support";
      if (!clip(b.title, 200).trim()) return send(res, 400, { error: "title required" });
      const ref = "REQ-" + crypto.randomBytes(4).toString("hex");
      db.inbox.push({ ref, kind, title: clip(b.title, 200), description: clip(b.description, 4000), customerName: clip(b.customerName, 120), customerEmail: clip(b.customerEmail, 200), priority: ["low", "normal", "high", "urgent"].includes(b.priority) ? b.priority : "normal", channel: b.channel === "chat" ? "chat" : "written", at: Date.now(), acked: false });
      save(); return send(res, 201, { ref });
    }
    // live chat: the customer sends messages, staff answer from the console (answers travel as the reply notes of the chat's task)
    if (req.method === "POST" && url.pathname === "/api/chats") {
      const b = await readBody(req);
      const text = clip(b.text, 2000).trim();
      if (!text) return send(res, 400, { error: "text required" });
      let c = typeof b.chatId === "string" ? db.chats[b.chatId] : undefined;
      if (!c) {
        if (Object.keys(db.chats).length > 5000) return send(res, 503, { error: "busy" });
        c = { id: "CHAT-" + crypto.randomBytes(5).toString("hex"), customerName: clip(b.customerName, 120), customerEmail: clip(b.customerEmail, 200), msgs: [], startedAt: Date.now() };
        db.chats[c.id] = c;
      }
      if (c.msgs.length > 500) return send(res, 429, { error: "chat too long, start a new one" });
      c.msgs.push({ id: crypto.randomBytes(6).toString("hex"), text, at: Date.now() });
      save(); return send(res, 201, { chatId: c.id });
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/chats/") && url.pathname !== "/api/chats/pull") {
      const id = decodeURIComponent(url.pathname.slice(11));
      const c = db.chats[id];
      if (!c) return send(res, 404, { error: "not found" });
      const st = db.published.statuses[id];
      const out = [...c.msgs.map((m) => ({ id: m.id, from: "me", text: m.text, at: m.at })), ...((st && st.replies) || []).map((r, i) => ({ id: "a" + r.at + "-" + i, from: "support", text: r.text, at: r.at }))].sort((a, b) => a.at - b.at);
      return send(res, 200, { messages: out, closed: !!(st && st.status === "done") });
    }
    if (req.method === "GET" && url.pathname === "/api/requests/status") {
      const refs = clip(url.searchParams.get("refs"), 2000).split(",").filter(Boolean).slice(0, 100);
      const out = {};
      for (const r of refs) { const s = db.published.statuses[r]; const pending = db.inbox.find((i) => i.ref === r); if (s) out[r] = s; else if (pending) out[r] = { taskId: "", status: "received", replies: [] }; }
      return send(res, 200, out);
    }
    if (req.method === "GET" && url.pathname === "/api/public") {
      const p = db.published;
      return send(res, 200, { plans: p.plans, web: p.web && { maintenance: p.web.maintenance, banner: p.web.banner, seoTitle: p.web.seoTitle, seoDescription: p.web.seoDescription }, design: p.design, templates: p.templates });
    }
    // ── staff ──
    if (url.pathname === "/api/chats/pull") {
      if (!staff) return send(res, 401, { error: "unauthorized" });
      // Stateless on purpose: every staff console may pull (each keeps its own copy and skips messages it already has).
      return send(res, 200, Object.values(db.chats).sort((a, b) => b.startedAt - a.startedAt).slice(0, 200));
    }
    if (url.pathname.startsWith("/api/inbox") || (req.method === "PUT" && url.pathname === "/api/published")) {
      if (!staff) return send(res, 401, { error: "unauthorized" });
      if (req.method === "GET" && url.pathname === "/api/inbox") return send(res, 200, db.inbox.filter((i) => !i.acked));
      if (req.method === "POST" && url.pathname === "/api/inbox/ack") {
        const b = await readBody(req);
        for (const a of Array.isArray(b.acks) ? b.acks : []) { const i = db.inbox.find((x) => x.ref === a.ref); if (i) { i.acked = true; i.taskId = clip(a.taskId, 40); } }
        save(); return send(res, 200, { ok: true });
      }
      if (req.method === "PUT" && url.pathname === "/api/published") {
        const b = await readBody(req);
        db.published = { plans: b.plans ?? null, web: b.web ?? null, design: b.design ?? null, templates: Array.isArray(b.templates) ? b.templates.slice(0, 200) : [], statuses: b.statuses && typeof b.statuses === "object" ? b.statuses : {} };
        save(); return send(res, 200, { ok: true });
      }
    }
    send(res, 404, { error: "not found" });
  } catch { send(res, 400, { error: "bad request" }); }
}).listen(PORT, "127.0.0.1", () => console.log(`Bridge listening on http://localhost:${PORT}`));
