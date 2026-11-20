import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code2, Link2, Mail, MoreHorizontal, Users } from 'lucide-react';
import type { SharedRecipe } from '@/lib/social';
import type { CustomFood } from '@/lib/types';
import { Sheet } from './ui';
import { haptic, toast } from './fx';
import { toShared } from './SharedRecipeCard';

/**
 * Recipes travel inside the link itself (after the #, so it never reaches a server):
 * the whole recipe, compressed. Anyone who opens it sees the recipe and can save it.
 */
function slim(r: SharedRecipe): SharedRecipe {
  const keep = (p: Record<string, number | null>) => Object.fromEntries(Object.entries(p).filter(([, v]) => v != null).map(([k, v]) => [k, Math.round((v as number) * 100) / 100]));
  return { ...r, per100: keep(r.per100), ingredients: r.ingredients.map((i) => ({ ...i, per100: keep(i.per100) })) };
}
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export async function recipeLink(r: SharedRecipe): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(slim(r)));
  let data = `j${b64url(json)}`;
  try {
    const z = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    data = `z${b64url(z)}`;
  } catch { /* older browser: uncompressed */ }
  return `${location.origin}/r#${data}`;
}

export async function readRecipeLink(hash: string): Promise<SharedRecipe | null> {
  try {
    const s = hash.replace(/^#/, '');
    let bytes = unb64url(s.slice(1));
    if (s[0] === 'z') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    const r = JSON.parse(new TextDecoder().decode(bytes)) as SharedRecipe;
    return r && typeof r.name === 'string' && Array.isArray(r.ingredients) ? r : null;
  } catch { return null; }
}

/** Share a recipe: copy link, WhatsApp, X, the phone's share menu, a message, or the feed. */
export function ShareRecipeSheet({ food, open, onClose }: { food: CustomFood; open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const recipe = toShared(food);
  if (!recipe) return null;
  const text = `${food.name} — my recipe on Nutivili AI`;
  const withLink = async (f: (url: string) => void | Promise<void>) => {
    setBusy(true);
    try { await f(await recipeLink(recipe)); } finally { setBusy(false); }
  };
  const rows: { icon: React.ReactNode; label: string; run: () => void }[] = [
    { icon: <Link2 size={20} />, label: 'Copy link', run: () => void withLink(async (u) => { await navigator.clipboard.writeText(u); toast('Link copied'); onClose(); }) },
    { icon: <Code2 size={20} />, label: 'Embed', run: () => void withLink(async (u) => { await navigator.clipboard.writeText(`<a href="${u}">${food.name} on Nutivili AI</a>`); toast('Embed code copied'); onClose(); }) },
    { icon: <span className="text-[19px] font-black leading-none">𝕏</span>, label: 'X', run: () => void withLink((u) => { window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(u)}`, '_blank', 'noopener'); }) },
    { icon: <WhatsAppIcon />, label: 'WhatsApp', run: () => void withLink((u) => { window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${u}`)}`, '_blank', 'noopener'); }) },
    { icon: <Mail size={20} />, label: 'Send in Messages', run: () => { onClose(); nav(`/messages?recipe=${encodeURIComponent(food.id)}`); } },
    { icon: <Users size={20} />, label: 'Post to the feed', run: () => { onClose(); nav(`/feed?recipe=${encodeURIComponent(food.id)}`); } },
    { icon: <MoreHorizontal size={20} />, label: 'More options', run: () => void withLink(async (u) => { try { await navigator.share({ title: food.name, text, url: u }); } catch { await navigator.clipboard.writeText(u); toast('Link copied'); } }) },
  ];
  return (
    <Sheet open={open} onClose={onClose} title="Share recipe">
      <div className="divide-y divide-line overflow-hidden rounded-[22px] bg-surface" style={{ boxShadow: 'var(--shadow)' }}>
        {rows.map((r) => (
          <button key={r.label} disabled={busy} onClick={() => { haptic(); r.run(); }} className="flex w-full items-center gap-4 px-5 py-4 text-left text-[16px] font-medium transition active:bg-raised">
            <span className="grid w-6 place-items-center">{r.icon}</span>{r.label}
          </button>
        ))}
      </div>
      <p className="mt-3 px-1 text-xs text-dim">Anyone with the link can see the recipe and save a copy (you’re credited). Nothing else from your account is shared.</p>
    </Sheet>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3.5 20.5l1.3-4A8.5 8.5 0 1 1 8 19.6z" strokeLinejoin="round" />
      <path d="M9 8.5c0 3 2.5 6 6 6.5l1.2-1.3-1.8-1-1 .8c-1-.4-2-1.4-2.4-2.4l.8-1-1-1.8z" fill="currentColor" stroke="none" />
    </svg>
  );
}
