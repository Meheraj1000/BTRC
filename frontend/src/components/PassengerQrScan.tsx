"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Keyboard } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ErrorState } from "@/components/StatCard";
import { boardedBusPath, parseBusQrPayload } from "@/lib/qrBus";

export function PassengerQrScan() {
  const router = useRouter();
  const scannerId = useId().replace(/:/g, "");
  const elementId = `passenger-qr-reader-${scannerId}`;
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const handledRef = useRef(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);

  function goToBus(raw: string) {
    const token = parseBusQrPayload(raw);
    if (!token) {
      setError("That code is not a Nirapad bus QR. Scan the sticker on the vehicle, or paste the /bus/… link.");
      return;
    }
    if (typeof window !== "undefined") {
      sessionStorage.setItem("nt_last_boarded_qr", token);
    }
    router.push(boardedBusPath(token));
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false);
      return;
    }

    let cancelled = false;
    handledRef.current = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;
        setScanning(true);
        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (handledRef.current) return;
            handledRef.current = true;
            void scanner.stop().catch(() => undefined);
            goToBus(decoded);
          },
          () => undefined,
        );
      } catch {
        if (!cancelled) {
          setCameraSupported(false);
          setScanning(false);
          setError("Camera unavailable. Enter the QR link or token manually below.");
        }
      }
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) void scanner.stop().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementId]);

  return (
    <AppShell allow={["PASSENGER", "SUPER_ADMIN"]} title="Scan bus QR">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <section className="card border-l-4 border-l-[var(--brand-primary)] p-4 sm:p-6">
          <h2 className="font-display text-lg font-semibold tracking-tight">Board a bus</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            After you log in, point your camera at the QR code on the bus. You will see vehicle and driver details,
            then you can lodge a complaint or trigger an emergency SOS for that bus.
          </p>
        </section>

        {error && <ErrorState message={error} />}

        <section className="card overflow-hidden p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Camera className="h-4 w-4 text-brand-600" aria-hidden />
            Camera scan
            {scanning && <span className="text-xs font-normal text-[var(--text-muted)]">· looking for QR…</span>}
          </div>
          <div
            id={elementId}
            className="overflow-hidden rounded-xl bg-[var(--ink-950)] [&_video]:max-h-[min(55vh,22rem)] [&_video]:w-full [&_video]:object-cover"
          />
          {!cameraSupported && (
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Use a phone browser with camera permission, or paste the QR URL / token below.
            </p>
          )}
        </section>

        <section className="card space-y-3 p-4 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Keyboard className="h-4 w-4 text-brand-600" aria-hidden />
            Enter code manually
          </div>
          <label className="block text-sm" htmlFor="qr-manual">
            Bus QR link or token
          </label>
          <input
            id="qr-manual"
            className="input"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="https://…/bus/… or token"
            autoComplete="off"
          />
          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={() => {
              setError("");
              goToBus(manual);
            }}
          >
            Open bus details
          </button>
          <p className="text-xs text-[var(--text-muted)]">
            Demo tip: open any vehicle in Admin/Owner → Buses, copy its QR link, and paste it here.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
