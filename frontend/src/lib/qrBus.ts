/** Extract a bus QR token from a scanned URL or raw hex token. */
export function parseBusQrPayload(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  // Direct token (24+ hex chars from newQrToken)
  if (/^[a-f0-9]{16,64}$/i.test(value)) {
    return value.toLowerCase();
  }

  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const busIdx = parts.findIndex((p) => p === "bus" || p === "board");
    if (busIdx >= 0 && parts[busIdx + 1]) {
      const token = parts[busIdx + 1];
      if (/^[a-f0-9]{16,64}$/i.test(token)) return token.toLowerCase();
    }
  } catch {
    // not a URL
  }

  // Path-only: /bus/{token} or passenger/board/{token}
  const match = value.match(/(?:\/|^)(?:bus|board)\/([a-f0-9]{16,64})(?:[/?#]|$)/i);
  if (match?.[1]) return match[1].toLowerCase();

  return null;
}

export function boardedBusPath(token: string) {
  return `/passenger/board/${token.toLowerCase()}`;
}

export function publicBusPath(token: string) {
  return `/bus/${token.toLowerCase()}`;
}
