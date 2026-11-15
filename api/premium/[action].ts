/**
 * All Premium endpoints behind one server function (Vercel's Hobby plan allows 12 per project):
 *   GET  /api/premium/plans      POST /api/premium/checkout   POST /api/premium/activate
 *   POST /api/premium/manage     POST /api/premium/billing
 * Each handler lives in api/_premium/ (underscore folders aren't deployed as functions).
 */
import { json } from '../_lib/premium';
import { GET as plans } from '../_premium/plans';
import { POST as checkout } from '../_premium/checkout';
import { POST as activate } from '../_premium/activate';
import { POST as manage } from '../_premium/manage';
import { POST as billing } from '../_premium/billing';

const action = (request: Request) => new URL(request.url).pathname.replace(/\/+$/, '').split('/').pop() ?? '';

export async function GET(request: Request): Promise<Response> {
  return action(request) === 'plans' ? plans() : json({ error: 'Not found.' }, 404);
}

const POSTS: Record<string, (request: Request) => Promise<Response>> = { checkout, activate, manage, billing };

export async function POST(request: Request): Promise<Response> {
  const handler = POSTS[action(request)];
  return handler ? handler(request) : json({ error: 'Not found.' }, 404);
}
