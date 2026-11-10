export type AIAction = 'question' | 'outline' | 'flow' | 'review';
export type ServerStatus = 'checking' | 'configured' | 'unconfigured' | 'unreachable';
type RequestEvent = 'success' | 'invalid' | 'failed';
let observer: ((event: RequestEvent, code: string) => void) | null = null;
export function observeAIRequests(listener: (event: RequestEvent, code: string) => void) {
  observer = listener;
  return () => { if (observer === listener) observer = null; };
}

const errors: Record<string, string> = {
  invalid_access_code: 'AI 사용 코드가 맞지 않습니다.',
  ai_not_configured: '서버에 AI 설정이 아직 완료되지 않았습니다.',
  rate_limited: 'AI 호출 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.',
  provider_auth_failed: 'OpenAI API 키를 확인해 주세요.',
  provider_error: 'AI 서비스에서 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  ai_request_failed: 'AI 요청에 실패했습니다. 다시 시도해 주세요.',
  empty_ai_response: 'AI가 결과를 반환하지 않았습니다. 다시 시도해 주세요.',
};

export async function getAIStatus(): Promise<ServerStatus> {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' });
    if (!response.ok) return 'unreachable';
    return (await response.json()).configured ? 'configured' : 'unconfigured';
  } catch { return 'unreachable'; }
}

export async function verifyAICode(code: string): Promise<'authenticated' | 'invalid'> {
  try {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'x-ai-access-code': code },
      cache: 'no-store',
    });
    if (response.status === 401) return 'invalid';
    if (!response.ok) throw new Error('AI 인증 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    const body = await response.json();
    if (body.authenticated !== true) throw new Error('AI 인증 응답을 확인하지 못했습니다.');
    return 'authenticated';
  } catch (reason) {
    if (reason instanceof Error) throw reason;
    throw new Error('AI 인증 요청에 실패했습니다.');
  }
}

export async function askAI<T>(action: AIAction, data: unknown, accessCode: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ai-access-code': accessCode },
      body: JSON.stringify({ action, data }),
    });
  } catch {
    observer?.('failed', accessCode);
    throw new Error('AI 서버 연결에 실패했습니다. 다시 시도하거나 데모를 이용해 주세요.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    observer?.(body.error === 'invalid_access_code' ? 'invalid' : 'failed', accessCode);
    throw new Error(errors[body.error] || 'AI 요청을 완료하지 못했습니다.');
  }
  if (!('result' in body)) {
    observer?.('failed', accessCode);
    throw new Error('AI 응답을 확인하지 못했습니다.');
  }
  observer?.('success', accessCode);
  return body.result as T;
}
