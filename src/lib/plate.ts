/**
 * "okra soup with assorted meat and eba", "rice + beans + plantain", "salmon, rice, broccoli":
 * split a meal into its parts so each can be found and weighed on its own. Works for any cuisine,
 * because it only looks at the joining words, not at the food names.
 */
export function plateParts(q: string): string[] {
  const parts = q.toLowerCase()
    .replace(/\b(a|an|some|plate of|bowl of|side of)\b/g, ' ')
    .split(/\s*(?:\+|,|&|\bwith\b|\band\b|\bplus\b|\bserved with\b|\bon the side\b)\s*/)
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter((x) => x.length >= 2);
  return [...new Set(parts)].slice(0, 8);
}
