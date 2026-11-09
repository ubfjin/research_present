import { timingSafeEqual } from 'node:crypto';

const sectionSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    purpose: { type: 'string' },
    minutes: { type: 'number' },
    claim: { type: 'string' },
    evidence: { type: 'string' },
    visual: { type: 'string' },
    concern: { type: 'string' },
  },
  required: ['title', 'purpose', 'minutes', 'claim', 'evidence', 'visual', 'concern'],
  additionalProperties: false,
};
const schemas = {
  question: {
    type: 'object',
    properties: { question: { type: 'string' }, focus: { type: 'string' } },
    required: ['question', 'focus'],
    additionalProperties: false,
  },
  outline: {
    type: 'object',
    properties: { rationale: { type: 'string' }, sections: { type: 'array', items: sectionSchema } },
    required: ['rationale', 'sections'],
    additionalProperties: false,
  },
  flow: {
    type: 'object',
    properties: { explanation: { type: 'string' }, sections: { type: 'array', items: sectionSchema } },
    required: ['explanation', 'sections'],
    additionalProperties: false,
  },
  review: {
    type: 'object',
    properties: {
      readback: { type: 'string' },
      understood: { type: 'array', items: { type: 'string' } },
      gaps: { type: 'array', items: { type: 'string' } },
      suggestions: { type: 'array', items: { type: 'string' } },
    },
    required: ['readback', 'understood', 'gaps', 'suggestions'],
    additionalProperties: false,
  },
};
const instructions = {
  question: '당신은 연구 발표를 처음 듣는 가상 청중이다. 연구자의 청중 설정과 사전 지식을 반영해 한 번에 질문 하나만 하라. 이전 질문을 반복하지 말고 방금 답변의 불명확한 연결을 우선 짚어라. 연구자가 답할 수 있는 구체적 질문으로 작성하라. 연구 자료에 없는 사실을 사실처럼 말하지 마라.',
  outline: '당신은 연구 발표 설계 도우미다. 청중과 핵심 메시지, 대화 답변을 바탕으로 발표 구간 4~7개를 제안하라. 각 구간의 목적, 한 문장 주장, 근거와 원자료 위치, 시각 자료 아이디어, 예상 오해, 분 단위 시간을 제시하라. 자료에 없는 수치나 Figure 번호를 지어내지 마라. 근거가 없으면 evidence에 "근거 확인 필요"라고 적어라. 시간 합계는 목표 발표 시간과 가깝게 하라.',
  flow: '당신은 발표 흐름 편집 도우미다. 사용자의 변경 요청에 맞춰 기존 sections 전체를 수정한 제안본을 반환하라. 요청과 무관한 내용은 가능한 한 보존하라. 연구에 없는 결과나 근거를 만들지 마라. 기존 구간의 제목과 목적을 존중하라.',
  review: '당신은 설정된 사전 지식을 가진 가상 청중이다. 발표자의 원고나 의도한 정답을 보지 않고, 제공된 발표 스토리보드만 근거로 발표 후 무엇을 이해했는지 자기 말로 설명하라. 보이지 않는 내용을 알아서 보충하지 마라. 불명확한 부분과 수정할 구간을 구체적으로 알려라. 실제 인간 청중 반응의 예측이라고 주장하지 마라.',
};
function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function validInput(action, data) {
  if (!schemas[action] || !data || typeof data !== 'object') return false;
  const text = JSON.stringify(data);
  return text.length <= 45000;
}
function extractText(response) {
  return (response.output || [])
    .flatMap(item => item.type === 'message' ? item.content || [] : [])
    .filter(item => item.type === 'output_text')
    .map(item => item.text || '')
    .join('');
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin) {
    try { if (new URL(origin).host !== host) return res.status(403).json({ error: 'origin_not_allowed' }); }
    catch { return res.status(403).json({ error: 'origin_not_allowed' }); }
  }
  if (!process.env.OPENAI_API_KEY || !process.env.AI_ACCESS_CODE) return res.status(503).json({ error: 'ai_not_configured' });
  if (!equal(req.headers['x-ai-access-code'], process.env.AI_ACCESS_CODE)) return res.status(401).json({ error: 'invalid_access_code' });
  const { action, data } = req.body || {};
  if (!validInput(action, data)) return res.status(400).json({ error: 'invalid_input' });
  try {
    const prompt = action === 'review'
      ? { audience: data.audience, knowledge: data.knowledge, storyboard: data.storyboard }
      : data;
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        store: false,
        max_output_tokens: 2200,
        instructions: instructions[action],
        input: JSON.stringify(prompt),
        text: { format: { type: 'json_schema', name: `presentation_${action}`, strict: true, schema: schemas[action] } },
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) {
      const kind = response.status === 429 ? 'rate_limited' : response.status === 401 ? 'provider_auth_failed' : 'provider_error';
      return res.status(502).json({ error: kind });
    }
    const body = await response.json();
    const text = extractText(body);
    if (!text) return res.status(502).json({ error: 'empty_ai_response' });
    return res.status(200).json({ result: JSON.parse(text) });
  } catch {
    return res.status(502).json({ error: 'ai_request_failed' });
  }
}
