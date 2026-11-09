import { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { askAI } from './aiClient';

type Section = { title: string; purpose: string; minutes: number; claim: string; evidence: string; visual: string; concern: string };
type Review = { readback: string; understood: string[]; gaps: string[]; suggestions: string[] };
export function AudienceReview({ project, aiEnabled, accessCode, onNavigate }: {
  project: { audience: string; knowledge: string; message: string; parts: Section[] };
  aiEnabled: boolean;
  accessCode: string;
  onNavigate: (step: number) => void;
}) {
  const [result, setResult] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const presented = project.parts.map(x => x.claim).filter(Boolean).join(' → ');
  const review = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await askAI<Review>('review', {
        audience: project.audience,
        knowledge: project.knowledge,
        storyboard: project.parts.map(({ title, purpose, minutes, claim, evidence, visual, concern }) => ({ title, purpose, minutes, claim, evidence, visual, concern })),
      }, accessCode);
      setResult(response);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '이해 점검을 완료하지 못했습니다.');
    } finally { setBusy(false); }
  };
  return <div className="stack">
    <div className="note">{aiEnabled ? 'AI는 아래 점검을 위해 발표자의 원고와 의도한 핵심 메시지를 보지 않고 스토리보드만 읽습니다. 실제 청중 반응을 보장하지는 않습니다.' : '데모 모드: 아래는 스토리보드의 입력 상태 점검입니다. 실제 청중의 이해나 AI의 독립적인 재설명이 아닙니다.'}</div>
    {aiEnabled && <div className="review-run"><div><strong>가상 청중에게 발표안을 보여주기</strong><p>스토리보드만 읽고 무엇을 이해했는지 자기 말로 설명하도록 요청합니다.</p></div><button className="primary" onClick={review} disabled={busy}><Sparkles size={16}/>{busy ? '점검 중…' : result ? '다시 점검하기' : 'AI 이해 점검 시작'}</button></div>}
    {error && <div className="note">{error}</div>}
    <div className="compare"><div><span className="eyebrow">PRESENTER INTENT</span><h2>내가 전달하려는 한 문장</h2><p>{project.message}</p></div><div><span className="eyebrow">AUDIENCE READBACK</span><h2>{result ? 'AI 청중이 이해한 내용' : '발표안에 드러난 주장'}</h2><p>{result?.readback || presented || '아직 스토리보드에 주장이 적혀 있지 않습니다.'}</p></div></div>
    {result ? <><h2>청중의 반응에서 살펴볼 지점</h2><div className="review"><strong>이해한 내용</strong>{result.understood.length ? result.understood.map((x, i) => <p key={i}>• {x}</p>) : <p>명확히 이해한 내용이 기록되지 않았습니다.</p>}</div><div className="review"><strong>불명확하거나 빠진 연결</strong>{result.gaps.length ? result.gaps.map((x, i) => <p key={i}>• {x}</p>) : <p>특별한 공백을 찾지 못했습니다.</p>}</div><div className="review"><strong>수정 제안</strong>{result.suggestions.length ? result.suggestions.map((x, i) => <p key={i}>• {x}</p>) : <p>추가 제안이 없습니다.</p>}<button onClick={() => onNavigate(3)}>스토리보드 수정 <ArrowRight size={14}/></button></div></> :
    <><h2>직접 확인할 항목</h2><div className="review"><strong>핵심 메시지</strong><p>발표안의 주장과 의도한 메시지가 같은 의미로 읽히는지 확인해 보세요.</p><button onClick={() => onNavigate(3)}>스토리보드 수정 →</button></div><div className="review"><strong>주장과 근거</strong><p>{project.parts.some(x => x.claim && x.evidence) ? '주장과 근거가 함께 적힌 구간이 있습니다. 실제 원자료가 주장을 뒷받침하는지 확인해 보세요.' : '주장과 근거가 함께 적힌 구간이 없습니다.'}</p><button onClick={() => onNavigate(3)}>근거 추가 →</button></div></>}
  </div>;
}
