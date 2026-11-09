export type AIAction = 'question' | 'outline' | 'flow' | 'review';
const errors: Record<string, string> = {
  invalid_access_code: 'AI 사용 코드가 맞지 않습니다.',
  ai_not_configured: '서버에 AI 설정이 아직 완료되지 않았습니다.',
  rate_limited: 'AI 호출 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.',
  provider_auth_failed: 'OpenAI API 키를 확인해 주세요.',
  provider_error: 'AI 서비스에서 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  ai_request_failed: 'AI 요청에 실패했습니다. 다시 시도해 주세요.',
  empty_ai_response: 'AI가 결과를 반환하지 않았습니다. 다시 시도해 주세요.',
};
export async function getAIStatus(): Promise<boolean> {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' });
    if (!response.ok) return false;
    return Boolean((await response.json()).configured);
  } catch { return false; }
}
export async function askAI<T>(action: AIAction, data: unknown, accessCode: string): Promise<T> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ai-access-code': accessCode },
    body: JSON.stringify({ action, data }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errors[body.error] || 'AI 요청을 완료하지 못했습니다.');
  return body.result as T;
}
