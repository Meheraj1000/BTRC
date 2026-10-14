"use client";

import { QRCodeSVG } from "qrcode.react";
import { useMemo } from "react";

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
  const url = useMemo(() => {
    if (qrUrl) return qrUrl;
    if (qrToken && typeof window !== "undefined") {
      return `${window.location.origin}/bus/${qrToken}`;
    }
    return "";
  }, [qrUrl, qrToken]);

  if (!url) {
    return <p className="text-xs text-[var(--text-muted)]">QR code will appear after the vehicle is saved.</p>;
  }

  function downloadPng() {
    const svg = document.getElementById(`bus-qr-${registrationNo}`)?.querySelector("svg");
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
    <div className={`rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] ${compact ? "p-3" : "p-4"}`}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Vehicle QR code</div>
      <div id={`bus-qr-${registrationNo}`} className="mx-auto w-fit rounded-lg bg-white p-3">
        <QRCodeSVG value={url} size={compact ? 128 : 168} level="M" includeMargin bgColor="#ffffff" fgColor="#0B1F33" />
      </div>
      <p className="mt-2 break-all text-center text-[11px] text-[var(--text-muted)]">{url}</p>
      <p className="mt-1 text-center text-xs text-[var(--text-secondary)]">
        Passengers scan after login (or open this link) for vehicle &amp; driver details, complaints, and emergency SOS.
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => void navigator.clipboard.writeText(url)}>
          Copy link
        </button>
        <button type="button" className="btn btn-primary" onClick={downloadPng}>
          Download QR
        </button>
        <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">
          Open page
        </a>
      </div>
    </div>
  );
}
