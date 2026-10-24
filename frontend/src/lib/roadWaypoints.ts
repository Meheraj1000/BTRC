export type LatLng = { lat: number; lng: number };

/** Keep in step with backend `routingWaypoints` and the GPS simulator. */
export function routingWaypoints(points: LatLng[], max = 18): LatLng[] {
  if (points.length <= 2 || points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: LatLng[] = [];
  for (let i = 0; i < max; i += 1) out.push(points[Math.round(i * step)]!);
  out[0] = points[0]!;
  out[out.length - 1] = points[points.length - 1]!;
  return out;
}
