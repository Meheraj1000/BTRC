// Publishes the current API address where the live site can read it
// without a new Vercel build.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const origin = (process.argv[2] ?? "").replace(/\/$/, "");
if (!origin.startsWith("https://")) {
  console.error("Usage: node scripts/set-origin.mjs https://example.trycloudflare.com");
  process.exit(1);
}

const root = join(import.meta.dirname, "..");
const localPath = join(root, ".edge-config.json");
const authPath = join(homedir(), "AppData/Roaming/com.vercel.cli/Data/auth.json");
const teamSlug = "meherajs-projects-19a7c1f7";
const slug = "nirapad-origin";

const auth = JSON.parse(readFileSync(authPath, "utf8"));
const token = auth.token;
if (!token) {
  console.error("Vercel CLI is not signed in.");
  process.exit(1);
}

async function api(path, options = {}) {
  const url = new URL(path, "https://api.vercel.com");
  url.searchParams.set("teamId", teamSlug);
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(body.error?.message || body.message || `Vercel API ${res.status}`);
  }
  return body;
}

let saved = existsSync(localPath) ? JSON.parse(readFileSync(localPath, "utf8")) : {};

if (!saved.id) {
  const listed = await api("/v1/edge-config");
  const existing = (listed.edgeConfigs ?? listed ?? []).find?.((item) => item.slug === slug);
  if (existing?.id) {
    saved.id = existing.id;
  } else {
    const created = await api("/v1/edge-config", {
      method: "POST",
      body: JSON.stringify({ slug }),
    });
    saved.id = created.id;
  }
}

if (!saved.readToken) {
  const created = await api(`/v1/edge-config/${saved.id}/token`, {
    method: "POST",
    body: JSON.stringify({ label: "nirapad-site" }),
  });
  saved.readToken = created.token;
}

await api(`/v1/edge-config/${saved.id}/items`, {
  method: "PATCH",
  body: JSON.stringify({
    items: [{ operation: "upsert", key: "origin", value: origin }],
  }),
});

saved.connection = `https://edge-config.vercel.com/${saved.id}?token=${saved.readToken}`;
saved.origin = origin;
writeFileSync(localPath, JSON.stringify({ id: saved.id, readToken: saved.readToken, connection: saved.connection, origin }, null, 2));
console.log(`UPDATED ${saved.id}`);
