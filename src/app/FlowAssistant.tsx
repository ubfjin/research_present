import { useState } from 'react';
import { Check, MessageCircle, Send, X } from 'lucide-react';
import { askAI } from './aiClient';

type Part = { id: string; title: string; purpose: string; minutes: number; claim: string; evidence: string; visual: string; concern: string };
type Proposal = { title: string; detail: string; parts: Part[] };
const newId = () => Math.random().toString(36).slice(2, 10);

function suggest(text: string, parts: Part[]): Proposal | null {
  const q = text.replace(/\s/g, '');
  const copy = parts.map(x => ({ ...x }));
  const find = (word: string) => copy.findIndex(x => x.title.includes(word));
  if (q.includes('결과') && /(앞|먼저|초반|당겨)/.test(q)) {
    const index = find('발견');
    if (index < 0 || index <= 1) return null;
    const [part] = copy.splice(index, 1);
    copy.splice(1, 0, part);
    return { title: '결과를 앞부분으로 이동', detail: `“${part.title}”을 두 번째 구간에 놓습니다. 앞부분에서 결과를 먼저 보여준 뒤 연구 과정으로 돌아갑니다.`, parts: copy };
  }
  if (/(방법|접근|무엇을했)/.test(q) && /(줄|짧|축소)/.test(q)) {
    const index = find('했나');
    if (index < 0) return null;
    copy[index].minutes = Math.max(.5, copy[index].minutes - 1);
    return { title: '연구 방법 설명 1분 줄이기', detail: `“${copy[index].title}” 시간을 ${copy[index].minutes}분으로 조정합니다.`, parts: copy };
  }
  if (/(도입|문제|시작)/.test(q) && /(늘|길|추가)/.test(q)) {
    if (!copy.length) return null;
    copy[0].minutes += 1;
    return { title: '도입 1분 늘리기', detail: `“${copy[0].title}” 시간을 ${copy[0].minutes}분으로 조정합니다.`, parts: copy };
  }
  if (q.includes('한계') && /(추가|넣|분리)/.test(q)) {
    copy.push({ id: newId(), title: '연구의 한계와 다음 질문', purpose: '결과가 적용되는 범위와 후속 연구를 설명합니다.', minutes: 1, claim: '', evidence: '', visual: '', concern: '' });
    return { title: '한계 구간 추가', detail: '발표 끝에 1분짜리 한계 구간을 추가합니다.', parts: copy };
  }
  if (q.includes('배경') && /(줄|짧|축소)/.test(q)) {
    const index = find('밝혀지지');
    if (index < 0) return null;
    copy[index].minutes = Math.max(.5, copy[index].minutes - 1);
    return { title: '배경 설명 1분 줄이기', detail: `“${copy[index].title}” 시간을 ${copy[index].minutes}분으로 조정합니다.`, parts: copy };
  }
  return null;
}

export function FlowAssistant({ parts, onApply, aiEnabled, accessCode, context }: { parts: Part[]; onApply: (parts: Part[]) => void; aiEnabled: boolean; accessCode: string; context: { research: string; audience: string; knowledge: string; message: string; minutes: number } }) {
  const [input, setInput] = useState('');
  const [log, setLog] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async (value = input) => {
    const query = value.trim();
    if (!query || busy) return;
    setInput('');
    setLog(xs => [...xs, { role: 'user', text: query }]);
    setBusy(true);
    try {
      let next: Proposal | null;
      if (aiEnabled) {
        const result = await askAI<{ explanation: string; sections: Omit<Part, 'id'>[] }>('flow', {
          ...context,
          research: context.research.slice(0, 18000),
          request: query,
          sections: parts,
        }, accessCode);
        if (!Array.isArray(result.sections) || !result.sections.length || result.sections.length > 10) throw new Error('변경안 형식을 확인할 수 없습니다.');
        const used = new Set<string>();
        next = { title: 'AI가 제안한 발표 흐름', detail: result.explanation, parts: result.sections.map((section, index) => {
          const original = parts.find(x => x.title === section.title && !used.has(x.id)) || (parts[index] && !used.has(parts[index].id) ? parts[index] : undefined);
          if (original) used.add(original.id);
          return { ...section, id: original?.id || newId(), minutes: Math.max(.5, Number(section.minutes) || 1) };
        }) };
      } else {
        next = suggest(query, parts);
      }
      setLog(xs => [...xs, { role: 'assistant', text: next ? next.detail : '현재 데모에서 처리할 수 없는 요청입니다. 아래 예시를 선택하거나 왼쪽 흐름을 직접 수정해 주세요.' }]);
      setProposal(next);
    } catch (reason) {
      setLog(xs => [...xs, { role: 'assistant', text: reason instanceof Error ? reason.message : '변경안을 만들지 못했습니다.' }]);
      setProposal(null);
    } finally { setBusy(false); }
  };
  return <aside className="flow-assistant">
    <div className="flow-assistant-head"><MessageCircle size={19}/><div><strong>흐름 조정 도우미</strong><small>{aiEnabled ? 'OpenAI 연결됨' : '규칙 기반 데모'}</small></div></div>
    <p className="flow-assistant-intro">원하는 변화를 말해 보세요. 제안을 확인한 뒤 적용할 수 있습니다.</p>
    <div className="quick-prompts">{['결과를 앞에서 먼저 보여줘', '방법 설명을 줄여줘', '도입을 늘려줘', '한계 구간을 추가해줘'].map(x => <button key={x} disabled={busy} onClick={() => send(x)}>{x}</button>)}</div>
    <div className="flow-chat">{log.length ? log.map((m, i) => <div key={i} className={`flow-chat-item ${m.role}`}><small>{m.role === 'user' ? '나' : '도우미'}</small><p>{m.text}</p></div>) : <p className="flow-chat-empty">예시를 누르거나 아래에 요청을 적어 보세요.</p>}</div>
    {proposal && <div className="proposal"><strong>변경안 미리보기</strong><p>{proposal.title}</p><small>{proposal.detail}</small><div><button className="primary" onClick={() => { onApply(proposal.parts); setLog(xs => [...xs, { role: 'assistant', text: '변경안을 흐름에 적용했습니다. 왼쪽에서 직접 더 수정할 수 있습니다.' }]); setProposal(null); }}><Check size={15}/> 적용</button><button className="secondary" onClick={() => setProposal(null)}><X size={15}/> 취소</button></div></div>}
    <div className="flow-compose"><textarea rows={3} value={input} onChange={e => setInput(e.target.value)} placeholder="예: 결과를 더 먼저 보여줘"/><button onClick={() => send()} disabled={!input.trim() || busy}><Send size={17}/></button></div>{busy && <small>변경안을 준비하고 있습니다…</small>}
  </aside>;
}
