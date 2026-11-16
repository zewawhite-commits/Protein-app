/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_BUSINESS_NAME?: string;
  readonly VITE_BUSINESS_ADDRESS?: string;
  readonly VITE_PHONE_SIGNIN?: string;
}
declare const __APP_VERSION__: string;
