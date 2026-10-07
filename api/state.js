import { get, put } from "@vercel/blob";

const PATH = "missao-mexico/state.json";
const KEY_RE = /^[A-Za-z0-9_-]{1,60}$/;

async function readState() {
  const r = await get(PATH, { access: "private", useCache: false });
  if (!r) return {};
  try {
    return JSON.parse(await new Response(r.stream).text());
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      return res.status(200).json({ state: await readState() });
    }
    if (req.method === "POST") {
      const patch = req.body && req.body.patch;
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        return res.status(400).json({ error: "patch must be an object" });
      }
      const entries = Object.entries(patch);
      if (entries.length > 100) return res.status(400).json({ error: "patch too large" });
      const clean = {};
      for (const [k, v] of entries) {
        if (!KEY_RE.test(k) || typeof v !== "boolean") {
          return res.status(400).json({ error: "invalid entry: " + k });
        }
        clean[k] = v;
      }
      const state = { ...(await readState()), ...clean };
      await put(PATH, JSON.stringify(state), {
        access: "private",
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: "application/json",
      });
      return res.status(200).json({ state });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
}
