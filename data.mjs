// Postle Engine cloud sync: one copy of your data in Netlify Blobs.
// GET  /api/data  -> the saved data
// PUT  /api/data  -> replace it (the app merges before saving)
// Every save also keeps a dated copy, so a bad sync can always be rolled back.
import { getStore } from "@netlify/blobs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  const secret = (globalThis.Netlify?.env.get("SYNC_KEY")) || process.env.SYNC_KEY;
  if (!secret) return json({ error: "SYNC_KEY is not set in Netlify" }, 500);
  if (req.headers.get("x-sync-key") !== secret) return json({ error: "Wrong sync key" }, 401);

  const store = getStore({ name: "postle", consistency: "strong" });

  if (req.method === "GET") {
    const data = await store.get("data", { type: "json" });
    return json(data || { v: 1, keys: {} });
  }

  if (req.method === "PUT") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
    if (!body || typeof body.keys !== "object") return json({ error: "Bad data" }, 400);
    body.updated = new Date().toISOString();
    await store.setJSON("data", body);
    await store.setJSON("backup-" + body.updated.slice(0, 10), body); // one per day
    return json({ ok: true, updated: body.updated });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/data" };
