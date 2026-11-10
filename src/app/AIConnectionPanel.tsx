import type { ServerStatus } from './aiClient';

type AuthStatus = 'empty' | 'unchecked' | 'authenticated' | 'invalid' | 'failed';
export function AIConnectionPanel({ server, code, auth, checking, requestFailed, demoChosen, onCodeChange, onVerify, onUseDemo, onUseAI, onRetryStatus }: {
  server: ServerStatus;
  code: string;
  auth: AuthStatus;
  checking: boolean;
  requestFailed: boolean;
  demoChosen: boolean;
  onCodeChange: (value: string) => void;
  onVerify: () => void;
  onUseDemo: () => void;
  onUseAI: () => void;
  onRetryStatus: () => void;
}) {
  const serverLabel = server === 'configured' ? 'AI 서버 설정 완료' : server === 'checking' ? 'AI 서버 확인 중' : server === 'unreachable' ? 'AI 서버 상태 확인 실패' : 'AI 서버 미설정';
  const authLabel = checking ? '사용 코드 확인 중' : auth === 'empty' ? '코드 미입력' : auth === 'unchecked' ? '인증 전' : auth === 'authenticated' ? '인증 성공' : auth === 'invalid' ? '잘못된 코드' : '인증 요청 실패';
  return <div className="ai-connection" aria-live="polite">
    <span className={`ai-state server-${server}`}>{serverLabel}</span>
    {server === 'configured' ? <>
      <label className="ai-code">AI 사용 코드
        <input type="password" value={code} disabled={checking} onChange={e => onCodeChange(e.target.value)} placeholder="사용 코드 입력" autoComplete="off"/>
      </label>
      <span className={`ai-state auth-${auth}`}>{authLabel}{auth === 'authenticated' && demoChosen ? ' · 데모 사용 중' : ''}</span>
      {(auth === 'unchecked' || auth === 'invalid' || auth === 'failed') && !checking && <button className="ai-mini-button" onClick={onVerify}>{auth === 'unchecked' ? '코드 확인' : '다시 확인'}</button>}
      {auth === 'authenticated' && requestFailed && !demoChosen && <span className="ai-state auth-failed">AI 요청 실패 · 다시 시도하거나 데모를 이용하세요</span>}
      {!demoChosen && auth !== 'empty' && <button className="ai-mini-button" onClick={onUseDemo}>데모 사용</button>}
      {demoChosen && auth === 'authenticated' && <button className="ai-mini-button" onClick={onUseAI}>AI 사용</button>}
    </> : <>
      {server === 'unreachable' && <button className="ai-mini-button" onClick={onRetryStatus}>다시 확인</button>}
      <span className="ai-demo-label">규칙 기반 데모 사용 가능</span>
    </>}
  </div>;
}
