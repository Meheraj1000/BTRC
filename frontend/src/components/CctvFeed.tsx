"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

export type CameraView = {
  id: string;
  code: string;
  name: string;
  city: string;
  area: string;
  latitude: number;
  longitude: number;
  status: "ONLINE" | "OFFLINE" | "MAINTENANCE";
  source: "SIMULATED" | "HLS";
  facing: string | null;
  streamUrl: string | null;
  dataLabel: "SIMULATED" | "EXTERNAL";
};

export type PlateMark = {
  registration: string;
  slot: number;
};

function hashCode(code: string) {
  let h = 2166136261;
  for (let i = 0; i < code.length; i += 1) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function vehicleRects(code: string, frame: number, width: number, height: number) {
  const seed = hashCode(code);
  const lanes = [0.62, 0.8, 0.91];
  return [0, 1, 2, 3].map((index) => {
    const speed = 2.2 + ((seed >> (index * 3)) & 7) * 0.45;
    const span = width + 180;
    const direction = index % 2 === 0 ? 1 : -1;
    const travel = (seed + index * 220 + frame * speed * 6) % span;
    return {
      x: direction === 1 ? travel - 90 : span - travel - 90,
      y: height * lanes[index % lanes.length],
      w: 92,
      h: 32,
    };
  });
}

function frameForSlot(code: string, slot: number, width: number, height: number) {
  for (let frame = 0; frame < 240; frame += 1) {
    const box = vehicleRects(code, frame, width, height)[slot];
    if (box && box.x > 24 && box.x + box.w < width - 24) return frame;
  }
  return 0;
}

function paint(ctx: CanvasRenderingContext2D, camera: CameraView, frame: number, mark: PlateMark | null) {
  const { width: w, height: h } = ctx.canvas;
  const seed = hashCode(camera.code);
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, "#243044");
  sky.addColorStop(1, "#1a2838");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 8; i += 1) {
    const bw = 78 + ((seed >> (i % 8)) & 46);
    const bh = 70 + ((seed >> i) & 110);
    const x = i * (w / 8);
    ctx.fillStyle = i % 2 === 0 ? "#2c3b4e" : "#33465c";
    ctx.fillRect(x, h * 0.5 - bh, bw, bh);
    ctx.fillStyle = "rgba(255, 214, 120, 0.38)";
    for (let wy = h * 0.5 - bh + 14; wy < h * 0.5 - 12; wy += 18) {
      for (let wx = x + 12; wx < x + bw - 10; wx += 18) {
        if (((seed + i + wx + wy) & 7) > 1) ctx.fillRect(wx, wy, 8, 10);
      }
    }
  }

  ctx.fillStyle = "#2f6b45";
  ctx.fillRect(0, h * 0.5, w, h * 0.045);
  ctx.fillStyle = "#3d444c";
  ctx.fillRect(0, h * 0.545, w, h * 0.455);

  ctx.strokeStyle = "#efe6c4";
  ctx.lineWidth = 4;
  ctx.setLineDash([36, 24]);
  ctx.lineDashOffset = camera.status === "ONLINE" ? -((frame * 4) % 60) : 0;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.74);
  ctx.lineTo(w, h * 0.74);
  ctx.stroke();
  ctx.setLineDash([]);

  if (camera.status === "ONLINE") {
    const colors = ["#b23b32", "#1f6f8b", "#c8962e", "#ece7dc"];
    vehicleRects(camera.code, frame, w, h).forEach((box, index) => {
      ctx.fillStyle = colors[index];
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = "rgba(186, 224, 255, 0.8)";
      const direction = index % 2 === 0 ? 1 : -1;
      ctx.fillRect(box.x + (direction === 1 ? 58 : 10), box.y + 7, 22, 14);
    });
  }

  const shade = ctx.createRadialGradient(w / 2, h / 2, h * 0.15, w / 2, h / 2, h * 0.78);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(8, 12, 18, 0.78)";
  ctx.fillRect(16, 16, 280, 64);
  ctx.fillStyle = "#f4efe4";
  ctx.font = "600 20px sans-serif";
  ctx.fillText(camera.code, 28, 44);
  ctx.font = "15px sans-serif";
  ctx.fillStyle = "#d7deea";
  ctx.fillText(new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka", hour12: false }), 28, 66);

  ctx.fillStyle = "rgba(8, 12, 18, 0.78)";
  ctx.fillRect(16, h - 72, Math.min(w - 32, 560), 52);
  ctx.fillStyle = "#f4efe4";
  ctx.font = "600 18px sans-serif";
  ctx.fillText(`${camera.area}, ${camera.city}`, 28, h - 42);
  ctx.font = "14px sans-serif";
  ctx.fillStyle = "#f0c14a";
  ctx.fillText("DEMONSTRATION — not a street camera", 28, h - 20);

  if (camera.status !== "ONLINE") {
    ctx.fillStyle = "rgba(8, 12, 18, 0.58)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = camera.status === "OFFLINE" ? "#e35d5d" : "#e0b15a";
    ctx.font = "700 48px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(camera.status, w / 2, h / 2);
    ctx.textAlign = "left";
  } else if (!mark && frame % 48 < 28) {
    ctx.fillStyle = "#e35d5d";
    ctx.beginPath();
    ctx.arc(w - 36, 36, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (camera.status === "ONLINE" && mark) {
    const box = vehicleRects(camera.code, frame, w, h)[mark.slot] ?? vehicleRects(camera.code, frame, w, h)[0];
    ctx.strokeStyle = "#e10600";
    ctx.lineWidth = 6;
    ctx.strokeRect(box.x - 8, box.y - 8, box.w + 16, box.h + 16);
    ctx.fillStyle = "#e10600";
    ctx.font = "700 18px sans-serif";
    ctx.fillText(mark.registration, Math.min(Math.max(16, box.x - 8), w - 300), Math.max(28, box.y - 16));
  }
}

export function CctvFeed({ camera, large = false, mark = null }: { camera: CameraView; large?: boolean; mark?: PlateMark | null }) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [camera.id, camera.streamUrl]);

  useEffect(() => {
    if (camera.source === "HLS" && camera.streamUrl) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const paused = Boolean(mark);
    let frame = paused ? frameForSlot(camera.code, mark?.slot ?? 0, canvas.width, canvas.height) : 0;
    let raf = 0;
    const draw = () => {
      paint(ctx, camera, frame, paused ? mark : null);
      frame += 1;
      if (camera.status === "ONLINE" && !paused) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [camera, mark]);

  if (camera.source === "HLS" && camera.streamUrl) {
    return (
      <div className="overflow-hidden rounded-lg bg-ink-950">
        {failed ? (
          <p className="grid aspect-video place-items-center px-4 text-center text-sm text-white">{t("This stream did not start.")}</p>
        ) : (
          <video
            key={camera.streamUrl}
            className="aspect-video w-full bg-black object-cover"
            src={camera.streamUrl}
            autoPlay
            muted
            playsInline
            controls={large}
            onError={() => setFailed(true)}
          />
        )}
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={960}
      height={540}
      className="aspect-video w-full rounded-lg bg-ink-950"
      aria-label={mark ? `${mark.registration}, ${camera.name}, ${camera.city}` : `${camera.name}, ${camera.city}`}
    />
  );
}
