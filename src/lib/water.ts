/** Part of the day a drink was had: people often catch up on water at night, so we keep when. */
export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';
export interface WaterDrink { id: string; ml: number; part: DayPart; at: number }

export const DAY_PARTS: { v: DayPart; label: string }[] = [
  { v: 'morning', label: 'Morning' }, { v: 'afternoon', label: 'Afternoon' }, { v: 'evening', label: 'Evening' }, { v: 'night', label: 'Night' },
];

export function dayPartNow(d = new Date()): DayPart {
  const h = d.getHours();
  return h >= 5 && h < 12 ? 'morning' : h < 17 && h >= 12 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night';
}

/** Hours slept between a bedtime and a wake time (HH:MM), crossing midnight when needed. */
export function hoursBetween(bed: string, wake: string): number | null {
  const m = (t: string) => { const [h, mi] = t.split(':').map(Number); return Number.isFinite(h) && Number.isFinite(mi) ? h * 60 + mi : NaN; };
  const a = m(bed), b = m(wake);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  let d = b - a;
  if (d <= 0) d += 24 * 60;
  return d / 60;
}

export const BOTTLES = [330, 500, 750, 1000, 1500, 2000] as const;
export const fmtMl = (ml: number) => (ml >= 1000 ? `${+(ml / 1000).toFixed(2)} ${ml === 1000 ? 'litre' : 'litres'}` : `${ml} ml`);
