import test from 'node:test';
import assert from 'node:assert/strict';
import auth from '../api/auth.js';
import status from '../api/status.js';
import { codeStatus, aiMode } from '../src/app/aiState.mjs';
import { askAI, getAIStatus, observeAIRequests, verifyAICode } from '../src/app/aiClient.ts';

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
function request(code) {
  return { method: 'POST', headers: { host: 'example.test', origin: 'https://example.test', 'x-ai-access-code': code } };
}

test('valid code authenticates without an OpenAI request', async () => {
  process.env.OPENAI_API_KEY = 'test-only-provider-key';
  process.env.AI_ACCESS_CODE = 'long-test-access-code';
  const server = response();
  status({ method: 'GET' }, server);
  assert.equal(server.payload.configured, true);
  const result = response();
  auth(request('long-test-access-code'), result);
  assert.equal(result.code, 200);
  assert.equal(result.payload.authenticated, true);
  assert.equal(codeStatus('long-test-access-code', 'long-test-access-code', '', ''), 'authenticated');
  assert.equal(aiMode('configured', 'long-test-access-code', 'long-test-access-code', '', ''), true);
});

test('wrong code is rejected and remains in demo mode', () => {
  process.env.OPENAI_API_KEY = 'test-only-provider-key';
  process.env.AI_ACCESS_CODE = 'long-test-access-code';
  const result = response();
  auth(request('wrong-code'), result);
  assert.equal(result.code, 401);
  assert.equal(codeStatus('wrong-code', '', 'wrong-code', 'invalid'), 'invalid');
  assert.equal(aiMode('configured', 'wrong-code', '', 'wrong-code', 'invalid'), false);
});

test('editing a verified code returns to unchecked state', () => {
  assert.equal(codeStatus('changed-code', 'old-code', '', ''), 'unchecked');
  assert.equal(aiMode('configured', 'changed-code', 'old-code', '', ''), false);
  assert.equal(codeStatus('', 'old-code', '', ''), 'empty');
});

test('missing server setting cannot authenticate', () => {
  process.env.OPENAI_API_KEY = 'test-only-provider-key';
  delete process.env.AI_ACCESS_CODE;
  const server = response();
  status({ method: 'GET' }, server);
  assert.equal(server.payload.configured, false);
  const result = response();
  auth(request('any-code'), result);
  assert.equal(result.code, 503);
  assert.equal(aiMode('unconfigured', 'any-code', 'any-code', '', ''), false);
});

test('client authentication uses only the local auth endpoint', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ authenticated: true }) };
  };
  try {
    assert.equal(await verifyAICode('long-test-access-code'), 'authenticated');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/auth');
    assert.equal(calls[0].options.headers['x-ai-access-code'], 'long-test-access-code');
  } finally { globalThis.fetch = original; }
});

test('client reports invalid code and AI request failure separately', async () => {
  const original = globalThis.fetch;
  const events = [];
  const stop = observeAIRequests((event, code) => events.push({ event, code }));
  try {
    globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: 'invalid_access_code' }) });
    assert.equal(await verifyAICode('wrong-code'), 'invalid');
    await assert.rejects(askAI('question', {}, 'wrong-code'), /코드가 맞지/);
    assert.deepEqual(events.at(-1), { event: 'invalid', code: 'wrong-code' });
    globalThis.fetch = async () => ({ ok: false, status: 502, json: async () => ({ error: 'provider_error' }) });
    await assert.rejects(askAI('question', {}, 'valid-code'), /응답하지 못했습니다/);
    assert.deepEqual(events.at(-1), { event: 'failed', code: 'valid-code' });
  } finally { stop(); globalThis.fetch = original; }
});

test('status lookup does not authenticate a stored code', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ configured: true }) });
  try {
    assert.equal(await getAIStatus(), 'configured');
    assert.equal(codeStatus('stored-code', '', '', ''), 'unchecked');
  } finally { globalThis.fetch = original; }
});
