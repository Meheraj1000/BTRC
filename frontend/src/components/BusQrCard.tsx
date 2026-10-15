"use client";

import { QRCodeSVG } from "qrcode.react";
import { useMemo } from "react";

function resolveQrUrl(qrToken?: string | null, qrUrl?: string | null) {
  const token = qrToken?.trim();
  if (token && typeof window !== "undefined") {
    return `${window.location.origin}/bus/${token}`;
  }
  if (qrUrl?.trim()) return qrUrl.trim();
  return "";
}

export function BusQrCard({
  registrationNo,
  qrUrl,
  qrToken,
  compact = false,
}: {
  registrationNo: string;
  qrUrl?: string | null;
  qrToken?: string | null;
  compact?: boolean;
}) {
  const url = useMemo(() => resolveQrUrl(qrToken, qrUrl), [qrToken, qrUrl]);
  const safeId = `bus-qr-${registrationNo.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  if (!url) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-secondary)] p-3">
        <p className="text-xs text-[var(--text-muted)]">
          No QR token yet. Refresh the vehicle list, or re-save the bus so a code can be generated.
        </p>
      </div>
    );
  }

  function downloadSvg() {
    const svg = document.getElementById(safeId)?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${registrationNo}-qr.svg`;
    a.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className={`rounded-xl border border-[var(--border)] bg-white shadow-sm ${compact ? "p-3" : "p-4"}`}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Vehicle QR code</div>
      <div id={safeId} className="mx-auto flex w-fit items-center justify-center rounded-lg border border-[var(--border)] bg-white p-3">
        <QRCodeSVG
          value={url}
          size={compact ? 148 : 180}
          level="M"
          includeMargin
          bgColor="#ffffff"
          fgColor="#0B1F33"
          className="block h-auto max-w-full"
        />
      </div>
      <p className="mt-2 break-all text-center text-[11px] text-[var(--text-muted)]">{url}</p>
      <p className="mt-1 text-center text-xs text-[var(--text-secondary)]">
        Passengers scan for vehicle &amp; driver details, complaints, and emergency SOS.
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => void navigator.clipboard.writeText(url)}>
          Copy link
        </button>
        <button type="button" className="btn btn-primary" onClick={downloadSvg}>
          Download QR
        </button>
        <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">
          Open page
        </a>
      </div>
    </div>
  );
}
