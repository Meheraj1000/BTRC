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
const teamSlug = "team_8VxbMGQGRbI8x2VON2hmSPsl";
const slug = "nirapad-origin";

const VERCEL_CLI_CLIENT_ID = "cl_HYyOPBNtFMfHhaUn9L4QPfTZz6TP47bp";

async function readAuth() {
  const auth = JSON.parse(readFileSync(authPath, "utf8"));
  if (!auth.token) {
    console.error("Vercel CLI is not signed in.");
    process.exit(1);
  }
  if (!auth.expiresAt || auth.expiresAt > Math.floor(Date.now() / 1000) + 60) return auth;
  if (!auth.refreshToken) {
    console.error("Vercel CLI session expired. Run `vercel login` and try again.");
    process.exit(1);
  }
  const discovery = await fetch(new URL(".well-known/openid-configuration", "https://vercel.com"));
  const metadata = await discovery.json();
  const refreshed = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: VERCEL_CLI_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: auth.refreshToken,
    }),
  });
  const tokens = await refreshed.json();
  if (!refreshed.ok || typeof tokens.access_token !== "string") {
    console.error("Vercel CLI session expired. Run `vercel login` and try again.");
    process.exit(1);
  }
  auth.token = tokens.access_token;
  auth.expiresAt = Math.floor(Date.now() / 1000) + Number(tokens.expires_in || 0);
  if (typeof tokens.refresh_token === "string" && tokens.refresh_token) {
    auth.refreshToken = tokens.refresh_token;
  }
  writeFileSync(authPath, JSON.stringify(auth, null, 2));
  return auth;
}

const auth = await readAuth();
const token = auth.token;

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
