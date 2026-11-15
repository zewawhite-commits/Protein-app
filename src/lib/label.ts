/**
 * Nutrition-label reading (shared by api/recognize.ts). The AI only transcribes what is
 * printed on the pack — these are the manufacturer's own numbers, like barcode data —
 * and the person checks them against the label before saving.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { RECOGNITION_MODEL } from './recognition';
import type { Per100 } from './types';

export interface LabelRead {
  isLabel: boolean;
  name: string;
  /** What the printed column is per: 100 g, 100 ml, or one serving. */
  basis: 'per100g' | 'per100ml' | 'perServing';
  servingGrams: number;
  kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null;
  sugar: number | null; satFat: number | null; sodiumMg: number | null; saltG: number | null;
  note: string;
}

const N = { type: ['number', 'null'] } as const;
const SCHEMA = {
  type: 'object',
  properties: {
    isLabel: { type: 'boolean' }, name: { type: 'string' },
    basis: { type: 'string', enum: ['per100g', 'per100ml', 'perServing'] }, servingGrams: { type: 'number' },
    kcal: N, protein: N, carbs: N, fat: N, fiber: N, sugar: N, satFat: N, sodiumMg: N, saltG: N,
    note: { type: 'string' },
  },
  required: ['isLabel', 'name', 'basis', 'servingGrams', 'kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'satFat', 'sodiumMg', 'saltG', 'note'],
  additionalProperties: false,
} as const;

const SYSTEM = `You read the nutrition information panel printed on food packaging for a nutrition-tracking app.

Transcribe ONLY what is printed. Never estimate, fill in or correct a value: if a nutrient isn't printed or you can't read it clearly, return null for it.
- Prefer the "per 100 g" (or "per 100 ml") column when the label has one and set "basis" accordingly. If the label only gives values per serving, use those and set "basis" to "perServing".
- "servingGrams": the serving size in grams (or ml) if printed, else 0.
- "kcal": energy in kilocalories. If only kJ is printed, convert (kJ ÷ 4.184) and say so in "note".
- "sodiumMg" if sodium is printed (in mg); "saltG" if salt is printed (in g). Don't convert between them.
- "carbs" = total carbohydrate; "sugar" = of which sugars; "fat" = total fat; "satFat" = saturates; "fiber" = fibre.
- "name": the product name if visible in the photo, else "".
- "note": one short line on anything the person should double-check (blurry digits, cut-off rows, kJ conversion), else "".
If the photo is not a nutrition label, set isLabel to false, all values null, and explain briefly in "note".`;

export async function readLabelWithClient(client: Anthropic, imageBase64: string, mediaType: string): Promise<LabelRead> {
  const response = await client.beta.messages.create({
    model: RECOGNITION_MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
    system: SYSTEM,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg', data: imageBase64 } },
      { type: 'text', text: 'Read this nutrition label.' },
    ] }],
  });
  if (response.stop_reason === 'refusal') throw new Error('The photo could not be read. Try another photo.');
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No result from the label reader.');
  return sanitizeLabel(JSON.parse(text.text));
}

const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null);

export function sanitizeLabel(raw: Partial<LabelRead>): LabelRead {
  return {
    isLabel: !!raw.isLabel,
    name: String(raw.name ?? '').slice(0, 80),
    basis: raw.basis === 'perServing' || raw.basis === 'per100ml' ? raw.basis : 'per100g',
    servingGrams: num(raw.servingGrams, 2000) ?? 0,
    kcal: num(raw.kcal, 5000), protein: num(raw.protein, 1000), carbs: num(raw.carbs, 1000), fat: num(raw.fat, 1000), fiber: num(raw.fiber, 1000),
    sugar: num(raw.sugar, 1000), satFat: num(raw.satFat, 1000), sodiumMg: num(raw.sodiumMg, 100000), saltG: num(raw.saltG, 1000),
    note: String(raw.note ?? '').slice(0, 200),
  };
}

/**
 * Label values as per-100 g (or per-100 ml) numbers. Per-serving labels are scaled by the
 * printed serving size; without one they can't be converted, so this returns null.
 * A label must at least give energy or protein, and no value may exceed what 100 g can hold.
 */
export function labelPer100(l: LabelRead): Per100 | null {
  if (!l.isLabel || (l.kcal == null && l.protein == null)) return null;
  const k = l.basis === 'perServing' ? (l.servingGrams > 0 ? 100 / l.servingGrams : 0) : 1;
  if (!k) return null;
  const s = (v: number | null, d = 1) => (v == null ? null : Math.round(v * k * 10 ** d) / 10 ** d);
  const sodium = l.sodiumMg ?? (l.saltG != null ? l.saltG * 400 : null);
  const out: Per100 = { protein: s(l.protein) ?? 0, kcal: s(l.kcal, 0), fat: s(l.fat), carbs: s(l.carbs), fiber: s(l.fiber), sugar: s(l.sugar), satFat: s(l.satFat), sodium: s(sodium, 0) };
  const mass = (out.protein ?? 0) + (out.fat ?? 0) + (out.carbs ?? 0);
  if (mass > 101 || (out.kcal ?? 0) > 905) return null; // more than 100 g of macros in 100 g, or denser than pure fat: misread
  return out;
}
