/** Official-ish Bangladesh extent (BBS / HDX admin boundaries), padded slightly for map chrome. */
export const BANGLADESH_SW: [number, number] = [20.55, 88.0];
export const BANGLADESH_NE: [number, number] = [26.7, 92.7];

export const BANGLADESH_CENTER: [number, number] = [23.685, 90.3563];

/** Floor only — LiveMap raises this to the zoom that exactly fits Bangladesh. */
export const BANGLADESH_MIN_ZOOM = 7;
export const BANGLADESH_MAX_ZOOM = 18;

export function isInBangladesh(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const [south, west] = BANGLADESH_SW;
  const [north, east] = BANGLADESH_NE;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}
