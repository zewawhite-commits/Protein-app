import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// BASE_PATH is set for GitHub Pages (e.g. /Protein-app/); defaults to / everywhere else.
const base = process.env.BASE_PATH ?? '/';

// Public Supabase settings. Accept our own names, or the ones Vercel's Supabase
// integration creates (SUPABASE_URL / SUPABASE_ANON_KEY / NEXT_PUBLIC_*).
const env = process.env;
// Vercel's Supabase integration may add a custom prefix (e.g. STORAGE_SUPABASE_URL), so match by suffix.
const bySuffix = (...suffixes: string[]) => {
  for (const sfx of suffixes) {
    const key = Object.keys(env).sort((a, b) => a.length - b.length).find((k) => k.endsWith(sfx) && env[k]);
    if (key) return env[key]!;
  }
  return '';
};
const supabaseUrl = env.VITE_SUPABASE_URL || bySuffix('SUPABASE_URL');
// Only public keys — never the service-role/secret key.
const supabaseAnon = env.VITE_SUPABASE_ANON_KEY || bySuffix('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY');

export default defineConfig({
  base,
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnon),
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0'),
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Nutivili — nutrition, precisely',
        short_name: 'Nutivili',
        description: 'Snap or weigh your food and track calories, protein and nutrients — foods from around the world, from official food composition tables.',
        id: base,
        categories: ['health', 'fitness', 'food'],
        // Long-press the app icon for these.
        shortcuts: [
          { name: 'Snap a meal', short_name: 'Snap', url: `${base}snap`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Add food', short_name: 'Add food', url: `${base}add`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Scan a barcode', short_name: 'Barcode', url: `${base}barcode`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
        theme_color: '#F9F7F2',
        background_color: '#F9F7F2',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  test: { environment: 'node' },
} as never);
