/**
 * All Premium endpoints behind one server function (Vercel's Hobby plan allows 12 per project):
 *   GET  /api/premium/plans      POST /api/premium/checkout   POST /api/premium/activate
 *   POST /api/premium/manage     POST /api/premium/billing
 *   POST /api/premium/trial      POST /api/premium/invite
 *   GET  /api/premium/health     (is the AI key working?)
 * Each handler lives in api/_premium/ (underscore folders aren't deployed as functions).
 */
import { json } from '../_lib/premium.js';
import { GET as plans } from '../_premium/plans.js';
import { GET as health } from '../_premium/health.js';
import { POST as checkout } from '../_premium/checkout.js';
import { POST as activate } from '../_premium/activate.js';
import { POST as manage, CANCEL as cancel } from '../_premium/manage.js';
import { POST as billing } from '../_premium/billing.js';
import { invite, trial } from '../_premium/perks.js';

const action = (request: Request) => new URL(request.url).pathname.replace(/\/+$/, '').split('/').pop() ?? '';

export async function GET(request: Request): Promise<Response> {
  const a = action(request);
  if (a === 'health') return health();
  return a === 'plans' ? plans() : json({ error: 'Not found.' }, 404);
}

const POSTS: Record<string, (request: Request) => Promise<Response>> = { checkout, activate, manage, cancel, billing, trial, invite };

export async function POST(request: Request): Promise<Response> {
  const handler = POSTS[action(request)];
  return handler ? handler(request) : json({ error: 'Not found.' }, 404);
}
