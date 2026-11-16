/**
 * All Premium endpoints behind one server function (Vercel's Hobby plan allows 12 per project):
 *   GET  /api/premium/plans      POST /api/premium/checkout   POST /api/premium/activate
 *   POST /api/premium/manage     POST /api/premium/billing
 *   POST /api/premium/trial      POST /api/premium/invite
 * Each handler lives in api/_premium/ (underscore folders aren't deployed as functions).
 */
import { json } from '../_lib/premium.js';
import { GET as plans } from '../_premium/plans.js';
import { POST as checkout } from '../_premium/checkout.js';
import { POST as activate } from '../_premium/activate.js';
import { POST as manage } from '../_premium/manage.js';
import { POST as billing } from '../_premium/billing.js';
import { invite, trial } from '../_premium/perks.js';

const action = (request: Request) => new URL(request.url).pathname.replace(/\/+$/, '').split('/').pop() ?? '';

export async function GET(request: Request): Promise<Response> {
  return action(request) === 'plans' ? plans() : json({ error: 'Not found.' }, 404);
}

const POSTS: Record<string, (request: Request) => Promise<Response>> = { checkout, activate, manage, billing, trial, invite };

export async function POST(request: Request): Promise<Response> {
  const handler = POSTS[action(request)];
  return handler ? handler(request) : json({ error: 'Not found.' }, 404);
}
