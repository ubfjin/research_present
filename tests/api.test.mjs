import test from 'node:test';
import assert from 'node:assert/strict';
import ai from '../api/ai.js';
import status from '../api/status.js';

function response() {
  return {
    code: 200,
    payload: null,
    headers: {},
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return this; },
    setHeader(name, value) { this.headers[name] = value; },
  };
}
function request(action, data, code = 'long-test-access-code') {
  return { method: 'POST', headers: { host: 'example.test', origin: 'https://example.test', 'x-ai-access-code': code }, body: { action, data } };
}
test('AI remains unavailable until both server secrets exist', async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.AI_ACCESS_CODE;
  const s = response();
  status({ method: 'GET' }, s);
  assert.equal(s.payload.configured, false);
  assert.equal(s.payload.keyConfigured, false);
  assert.equal(s.payload.codeConfigured, false);
  const r = response();
  await ai(request('question', {}), r);
  assert.equal(r.code, 503);
});
test('rejects invalid access code before calling provider', async () => {
  process.env.OPENAI_API_KEY = 'test-only-key';
  process.env.AI_ACCESS_CODE = 'long-test-access-code';
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw Error('provider should not be called'); };
  try {
    const r = response();
    await ai(request('question', {}, 'wrong-code'), r);
    assert.equal(r.code, 401);
  } finally { globalThis.fetch = original; }
});
test('review sends only storyboard and audience context to provider', async () => {
  process.env.OPENAI_API_KEY = 'test-only-key';
  process.env.AI_ACCESS_CODE = 'long-test-access-code';
  const original = globalThis.fetch;
  let sent;
  globalThis.fetch = async (_url, options) => {
    sent = JSON.parse(options.body);
    return { ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ readback: '연구 결과', understood: [], gaps: [], suggestions: [] }) }] }] }) };
  };
  try {
    const r = response();
    await ai(request('review', { audience: '대학원생', knowledge: '기초 지식', storyboard: [{ title: '결과' }], message: '비밀 정답', research: '비공개 원고' }), r);
    assert.equal(r.code, 200);
    assert.equal(sent.store, false);
    assert.equal(sent.text.format.type, 'json_schema');
    assert.equal(sent.text.format.strict, true);
    assert.equal(sent.input.includes('비밀 정답'), false);
    assert.equal(sent.input.includes('비공개 원고'), false);
  } finally { globalThis.fetch = original; }
});
