import { useState } from 'react';
import { ArrowRight, MessageCircle, Send } from 'lucide-react';

export type DialogueMessage = { role: 'audience' | 'researcher'; text: string };
type Project = { audience: string; knowledge: string; relevance: string; message: string; dialogue?: DialogueMessage[] };

function question(project: Project, replies: string[]) {
  const prompts = [
    `${project.audience}이(가) 이 연구에 왜 관심을 가져야 하나요? 발표 첫머리에 보여줄 구체적인 상황을 들려주세요.`,
    `방금 설명한 상황을 처음 듣는 청중이라면 어떤 점이 여전히 궁금할까요? 실제 사례 하나로 더 설명해 주세요.`,
    `${project.knowledge ? `“${project.knowledge}”를 아는 청중에게` : '이 청중에게'} 결과를 이해시키려면 먼저 알아야 할 개념이나 비교 기준은 무엇인가요?`,
    `이 연구에서 가장 중요한 결과는 무엇이며, 어떤 Figure나 수치가 그 주장을 뒷받침하나요?`,
    `“${project.message}”를 듣고 청중이 지나치게 일반화할 수 있는 부분은 무엇인가요? 연구의 적용 범위나 한계를 알려주세요.`,
  ];
  if (replies.length < prompts.length) return prompts[replies.length];
  const last = replies.at(-1) || '';
  if (last.trim().length < 35) return '그 설명을 발표에서 바로 사용할 수 있도록 조금 더 구체적인 사례나 근거를 덧붙여 주실 수 있나요?';
  return '여기까지 들으면 핵심 흐름이 잡힙니다. 청중이 더 물을 것 같은 점을 하나 골라 설명해 주시거나, 발표 흐름 초안으로 넘어가세요.';
}

export function PresentationDialogue({ project, onChange, onContinue }: {
  project: Project;
  onChange: (messages: DialogueMessage[]) => void;
  onContinue: () => void;
}) {
  const [input, setInput] = useState('');
  const messages = project.dialogue || [];
  const replies = messages.filter(x => x.role === 'researcher').map(x => x.text);
  const current = question(project, replies);
  const send = () => {
    if (!input.trim()) return;
    onChange([...messages, { role: 'audience', text: current }, { role: 'researcher', text: input.trim() }]);
    setInput('');
  };
  return <div className="stack">
    <div className="intro"><MessageCircle size={21}/><div><strong>청중의 눈으로 하나씩 질문합니다</strong><p>대답을 이어가며 발표에 필요한 설명을 찾아보세요. 충분하다고 생각하면 언제든 다음 단계로 넘어갈 수 있습니다.</p></div></div>
    <div className="note">데모 모드: 질문은 답변 수와 길이에 따른 규칙 기반 예시입니다. 실제 AI가 답변의 의미를 이해해 묻는 것은 아닙니다.</div>
    <div className="dialogue-thread">
      {messages.map((m, i) => <div key={i} className={`chat-bubble ${m.role}`}><small>{m.role === 'audience' ? '가상 청중 · 데모' : '나의 답변'}</small><p>{m.text}</p></div>)}
      <div className="chat-bubble audience current"><small>가상 청중 · 다음 질문</small><p>{current}</p></div>
    </div>
    <div className="chat-compose"><textarea rows={3} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }} placeholder="청중에게 어떻게 설명할지 적어보세요..."/><button className="primary" onClick={send} disabled={!input.trim()}><Send size={16}/> 답변 보내기</button></div>
    <div className="dialogue-check"><strong>흐름 초안에 활용할 내용</strong><div><span className={replies.length > 0 ? 'ready' : ''}>청중의 관심</span><span className={replies.length > 2 ? 'ready' : ''}>필요한 배경</span><span className={replies.length > 3 ? 'ready' : ''}>결과와 근거</span><span className={replies.length > 4 ? 'ready' : ''}>의미와 한계</span></div><small>미완성 항목이 있어도 초안을 만들 수 있습니다. 빠진 내용은 직접 보완해 주세요.</small></div>
    <div className="actions"><span className="subtle">{replies.length}개 답변 작성</span><button className="primary" onClick={onContinue}>이 정도면 충분해요 · 흐름 초안 만들기 <ArrowRight size={17}/></button></div>
  </div>;
}
