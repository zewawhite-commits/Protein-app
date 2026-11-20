import { describe, expect, it } from 'vitest';
import { cleanImported, pageText, safeRecipeUrl } from './recipeImport';

describe('recipe import', () => {
  it('cleans AI output and strips invisible characters', () => {
    const r = cleanImported({ isRecipe: true, title: 'Jollof​ rice', servings: 0, note: '', ingredients: [{ original: '2 cups rice', name: 'rice﻿', searchQueries: ['rice white raw'], grams: 370, form: 'dry', guessed: false }, { original: 'x', name: '', searchQueries: [], grams: -4, form: 'bad', guessed: 'yes' }] });
    expect(r.title).toBe('Jollof rice');
    expect(r.servings).toBe(1);
    expect(r.ingredients).toHaveLength(1);
    expect(r.ingredients[0]).toMatchObject({ name: 'rice', grams: 370, form: 'dry', guessed: false });
  });
  it('keeps structured recipe data from web pages', () => {
    const t = pageText('<html><script>evil()</script><script type="application/ld+json">{"@type":"Recipe","recipeIngredient":["500 g beef"]}</script><p>Hello&nbsp;there</p></html>');
    expect(t).toContain('recipeIngredient');
    expect(t).not.toContain('evil');
    expect(t).toContain('Hello there');
  });
  it('only opens normal public https links', () => {
    expect(safeRecipeUrl('https://www.allnigerianrecipes.com/rice/jollof')).not.toBeNull();
    for (const bad of ['http://example.com', 'https://localhost/x', 'https://127.0.0.1/', 'https://[::1]/', 'https://user:pw@example.com', 'https://example.com:8080/', 'https://intranet', 'ftp://x.com']) expect(safeRecipeUrl(bad), bad).toBeNull();
  });
});
