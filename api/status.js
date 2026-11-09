export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    configured: Boolean(process.env.OPENAI_API_KEY && process.env.AI_ACCESS_CODE),
    accessRequired: true,
  });
}
