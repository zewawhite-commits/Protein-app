/**
 * Premium (Paystack subscription) — browser side. The server issues a signed pass that
 * the app stores and sends with Premium requests; it is renewed by asking the server,
 * which checks Paystack. Payments only exist when the app is deployed with its api/
 * functions (e.g. Vercel) and Paystack is configured; otherwise everything stays free.
 */
import { useStore } from '@/store/useStore';

export interface PremiumPass { token: string; exp: number; email: string; plan: string }
export interface PlanInfo { id: 'monthly' | 'yearly'; name: string; amount: number; currency: string; interval: string }

async function call<T>(path: string, init?: { body?: unknown; token?: string }): Promise<T> {
  const res = await fetch(`/api/premium/${path}`, {
    method: init?.body !== undefined || init?.token ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(init?.token && { authorization: `Bearer ${init.token}` }) },
    body: init?.body !== undefined ? JSON.stringify(init.body) : init?.token ? '{}' : undefined,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  if (!isJson) throw new PaymentsUnavailableError();
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}

export class PaymentsUnavailableError extends Error {
  constructor() {
    super('Payments are not available on this version of the app.');
  }
}

/** Plans with live prices, or null when payments aren't set up on this deployment. */
export async function fetchPlans(): Promise<PlanInfo[] | null> {
  try {
    const r = await call<{ enabled: boolean; plans: PlanInfo[] }>('plans');
    return r.enabled && r.plans.length ? r.plans : null;
  } catch {
    return null;
  }
}

export async function startCheckout(email: string, plan: PlanInfo['id']): Promise<void> {
  const { url } = await call<{ url: string }>('checkout', { body: { email, plan } });
  window.location.assign(url);
}

export async function activate(input: { reference: string; email?: string }): Promise<PremiumPass> {
  const pass = await call<PremiumPass>('activate', { body: input });
  useStore.getState().setPremium(pass);
  return pass;
}

export async function manageSubscription(): Promise<void> {
  const token = useStore.getState().premium?.token;
  if (!token) return;
  const { url } = await call<{ url: string }>('manage', { token });
  window.open(url, '_blank', 'noopener');
}

export const isPremiumActive = (p: PremiumPass | null | undefined) => !!p && p.exp > Date.now();

/**
 * Renew the pass when it has expired or is about to (subscriptions renew monthly/yearly).
 * Drops it if Paystack says the subscription ended. Network errors leave it untouched.
 */
export async function refreshPremium(force = false): Promise<void> {
  const { premium, setPremium } = useStore.getState();
  if (!premium) return;
  if (!force && premium.exp - Date.now() > 24 * 3600_000) return;
  try {
    const pass = await call<PremiumPass>('activate', { body: { token: premium.token } });
    setPremium(pass);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 401 || status === 402) setPremium(null);
  }
}

export function formatPrice(p: PlanInfo): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency, maximumFractionDigits: 0 }).format(p.amount);
  } catch {
    return `${p.currency} ${p.amount.toLocaleString()}`;
  }
}

export const intervalLabel = (i: string) => ({ monthly: 'month', annually: 'year', quarterly: 'quarter', weekly: 'week', biannually: '6 months', daily: 'day' })[i] ?? i;
