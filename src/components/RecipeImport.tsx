import { useRef, useState } from 'react';
import { Camera, Link2, Loader2, TextQuote } from 'lucide-react';
import { aiHeaders } from '@/lib/premium';
import { blobToBase64, resizeImage } from '@/lib/photos';
import { confidentMatch, splitName } from '@/lib/foods';
import type { ImportedRecipe } from '@/lib/recipeImport';
import type { RecipeDef } from '@/lib/types';
import { Segmented, cx } from './ui';
import { haptic } from './fx';

type Mode = 'paste' | 'link' | 'photo';
export interface ImportResult { title: string; servings: number; items: RecipeDef['ingredients']; unmatched: string[]; guessed: string[]; note: string }

/**
 * Bring a recipe in from text, a web link or a photo. The AI reads the ingredient list;
 * each line is matched to the food database, and anything unsure is listed to check.
 */
export function RecipeImport({ onImported }: { onImported: (r: ImportResult) => void }) {
  const [mode, setMode] = useState<Mode>('paste');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(input: Record<string, unknown>) {
    setErr(''); setBusy(true);
    try {
      const res = await fetch('/api/recipe', { method: 'POST', headers: await aiHeaders(), body: JSON.stringify({ import: input }) });
      const isJson = res.headers.get('content-type')?.includes('json');
      if (!isJson || res.status === 404 || res.status === 501) throw new Error('Recipe import isn’t switched on yet.');
      const data = (await res.json()) as ImportedRecipe & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Couldn’t read that recipe.');
      if (!data.isRecipe || !data.ingredients.length) throw new Error(data.note || 'No ingredients found. Check it’s a recipe with an ingredient list.');
      const items: RecipeDef['ingredients'] = [];
      const unmatched: string[] = [];
      for (const ing of data.ingredients) {
        const food = confidentMatch([...ing.searchQueries, ing.name]);
        if (food && ing.grams > 0) items.push({ foodId: food.id, name: splitName(food.name).title, grams: ing.grams, per100: food.per100 });
        else unmatched.push(ing.original || ing.name);
      }
      haptic([10, 30, 10]);
      onImported({ title: data.title, servings: data.servings, items, unmatched, guessed: data.ingredients.filter((i) => i.guessed).map((i) => i.original || i.name), note: data.note });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function photo(f?: File) {
    if (!f) return;
    const small = await resizeImage(f, 1600);
    await run({ image: { data: await blobToBase64(small), mediaType: 'image/jpeg' } });
  }

  return (
    <div className="card p-4">
      <p className="font-bold">Import a recipe</p>
      <p className="mt-0.5 text-sm text-silver">Paste it, add a link, or snap a recipe page. You can check every ingredient before saving.</p>
      <div className="mt-3"><Segmented full value={mode} onChange={setMode} options={[{ value: 'paste', label: 'Paste' }, { value: 'link', label: 'Link' }, { value: 'photo', label: 'Photo' }]} /></div>
      {mode === 'paste' && (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={15000} placeholder={'Ingredients\n500 g beef\n2 cups rice\n3 tbsp palm oil…'} className="field mt-3 !h-auto resize-none py-3 text-[15px]" aria-label="Recipe text" />
          <button disabled={busy || text.trim().length < 15} onClick={() => run({ text })} className="btn-primary mt-3 w-full">{busy ? <Loader2 size={18} className="animate-spin" /> : <TextQuote size={18} />} Read recipe</button>
        </>
      )}
      {mode === 'link' && (
        <>
          <input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… recipe page" className="field mt-3" aria-label="Recipe link" />
          <button disabled={busy || !/^https:\/\/\S+\.\S+/.test(url.trim())} onClick={() => run({ url: url.trim() })} className="btn-primary mt-3 w-full">{busy ? <Loader2 size={18} className="animate-spin" /> : <Link2 size={18} />} Import from link</button>
        </>
      )}
      {mode === 'photo' && (
        <>
          <button disabled={busy} onClick={() => fileRef.current?.click()} className={cx('btn-primary mt-3 w-full')}>{busy ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />} {busy ? 'Reading…' : 'Take or choose a photo'}</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void photo(e.target.files?.[0]); e.target.value = ''; }} />
        </>
      )}
      {err && <p className="mt-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{err}</p>}
    </div>
  );
}
