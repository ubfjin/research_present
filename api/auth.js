import { timingSafeEqual } from 'node:crypto';

function sameCode(candidate, expected) {
  if (typeof candidate !== 'string' || typeof expected !== 'string') return false;
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const origin = req.headers?.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'origin_not_allowed' });
    } catch {
      return res.status(403).json({ error: 'origin_not_allowed' });
    }
  }
  if (!process.env.OPENAI_API_KEY || !process.env.AI_ACCESS_CODE) {
    return res.status(503).json({ error: 'ai_not_configured' });
  }
  if (!sameCode(req.headers?.['x-ai-access-code'], process.env.AI_ACCESS_CODE)) {
    return res.status(401).json({ error: 'invalid_access_code' });
  }
  return res.status(200).json({ authenticated: true });
}
