import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Download, FileText, Plus, Upload } from 'lucide-react';
import './app.css';
import './dialogue.css';
import { PresentationDialogue, type DialogueMessage } from './PresentationDialogue';
import { FlowAssistant } from './FlowAssistant';
import { askAI, getAIStatus } from './aiClient';
import { AudienceReview } from './AudienceReview';

type Part = { id: string; title: string; purpose: string; minutes: number; claim: string; evidence: string; visual: string; concern: string };
type Project = { id: string; title: string; research: string; audience: string; knowledge: string; relevance: string; context: string; minutes: number; message: string; answers: string[]; dialogue?: DialogueMessage[]; parts: Part[]; updated: string };
const KEY = 'research-story-studio-v1';
const steps = ['연구와 청중', '청중 질문', '발표 흐름', '스토리보드', '이해 점검'];
const id = () => Math.random().toString(36).slice(2, 10);
const fresh = (): Project => ({ id: id(), title: '', research: '', audience: '', knowledge: '', relevance: '', context: '', minutes: 10, message: '', answers: ['', '', ''], dialogue: [], parts: [], updated: new Date().toISOString() });
const sections = (p: Project): Part[] => [
  ['왜 이 문제인가', '청중의 관심과 문제를 연결합니다.', .18],
  ['무엇이 아직 밝혀지지 않았나', '기존 지식의 빈틈을 보여줍니다.', .15],
  ['우리는 무엇을 했나', '연구 질문과 접근을 이해시킵니다.', .2],
  ['무엇을 발견했나', '가장 중요한 결과를 근거와 함께 제시합니다.', .32],
  ['그래서 무엇이 달라지나', '의미와 적용 범위를 정리합니다.', .15],
].map(([title, purpose, weight], index) => {
  const replies = (p.dialogue || []).filter(x => x.role === 'researcher').map(x => x.text);
  const contextualPurpose = index === 0 && replies[0] ? `${purpose} 연구자의 설명: ${replies[0].slice(0, 140)}` : index === 1 && replies[2] ? `${purpose} 필요한 배경: ${replies[2].slice(0, 140)}` : purpose;
  return { id: id(), title: String(title), purpose: String(contextualPurpose), minutes: Math.round(p.minutes * Number(weight) * 2) / 2, claim: index === 4 ? p.message : '', evidence: index === 3 && replies[3] ? replies[3].slice(0, 160) : '', visual: '', concern: '' };
});
function load(): Project[] { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
function download(p: Project) { const u = URL.createObjectURL(new Blob([JSON.stringify({ app: 'research-story-studio', project: p }, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = u; a.download = (p.title || '발표 프로젝트').replace(/[\\/:*?"<>|]/g, '-') + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;

export default function App() {
  const [projects, setProjects] = useState<Project[]>(load);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Project | null>(null);
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState('');
  const [aiConfigured, setAiConfigured] = useState(false);
  const [accessCode, setAccessCode] = useState(() => sessionStorage.getItem('research-story-ai-code') || '');
  const [aiBusy, setAiBusy] = useState(false);
  const aiEnabled = aiConfigured && Boolean(accessCode.trim());
  const p = draft || projects.find(x => x.id === selected);
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(projects)), [projects]);
  useEffect(() => { getAIStatus().then(setAiConfigured); }, []);
  useEffect(() => { if (accessCode) sessionStorage.setItem('research-story-ai-code', accessCode); else sessionStorage.removeItem('research-story-ai-code'); }, [accessCode]);
  const update = (patch: Partial<Project>) => { if (!p) return; const next = { ...p, ...patch, updated: new Date().toISOString() }; if (draft) setDraft(next); else setProjects(xs => xs.map(x => x.id === next.id ? next : x)); };
  const setPart = (partId: string, patch: Partial<Part>) => update({ parts: p!.parts.map(x => x.id === partId ? { ...x, ...patch } : x) });
  const home = () => { setDraft(null); setSelected(null); setNotice(''); };
  const next = async () => {
    if (!p || aiBusy) return;
    if (step === 0 && draft) {
      if (!p.title.trim() || !p.research.trim() || !p.audience.trim() || !p.message.trim()) { setNotice('제목, 연구 내용, 청중, 핵심 메시지를 입력해 주세요.'); return; }
      setProjects(xs => [p, ...xs]); setSelected(p.id); setDraft(null);
    }
    if (step === 1 && !p.parts.length) {
      if (aiEnabled) {
        setAiBusy(true);
        try {
          const result = await askAI<{ rationale: string; sections: Omit<Part, 'id'>[] }>('outline', {
            research: p.research.slice(0, 18000), audience: p.audience, knowledge: p.knowledge,
            relevance: p.relevance, context: p.context, minutes: p.minutes, message: p.message,
            dialogue: (p.dialogue || []).slice(-16),
          }, accessCode);
          if (!Array.isArray(result.sections) || result.sections.length < 2 || result.sections.length > 10) throw new Error('발표 흐름 초안 형식을 확인할 수 없습니다.');
          update({ parts: result.sections.map(s => ({ ...s, id: id(), minutes: Math.max(.5, Number(s.minutes) || 1) })) });
          setNotice(result.rationale || 'AI 발표 흐름 초안을 만들었습니다.');
        } catch (reason) {
          setNotice(reason instanceof Error ? reason.message : '발표 흐름 초안을 만들지 못했습니다.');
          setAiBusy(false);
          return;
        }
        setAiBusy(false);
      } else update({ parts: sections(p) });
    }
    setStep(Math.min(4, step + 1));
  };
  const importFile = async (f?: File) => { if (!f) return; try { const v = JSON.parse(await f.text()); if (v.app !== 'research-story-studio' || !v.project?.title || !Array.isArray(v.project.parts)) throw Error(); const item: Project = { ...fresh(), ...v.project, id: id() }; setProjects(xs => [item, ...xs]); setSelected(item.id); setStep(0); setNotice('프로젝트를 가져왔습니다.'); } catch { setNotice('이 앱에서 내보낸 JSON 파일을 선택해 주세요.'); } };
  const total = p?.parts.reduce((n, x) => n + Number(x.minutes || 0), 0) || 0;
  return <div className="app">
    <header className="header"><button className="brand" onClick={home}><span className="brand-icon"><BookOpen size={20}/></span><span>연구의 이야기<small>Research Story Studio</small></span></button><div className="ai-header">{aiConfigured && <label className="ai-code">AI 사용 코드 <input type="password" value={accessCode} onChange={e => setAccessCode(e.target.value)} placeholder="사용 코드 입력" autoComplete="off"/></label>}<span className="demo">● {aiEnabled ? 'OpenAI 연결' : aiConfigured ? '사용 코드 입력 시 AI 사용' : 'AI 미설정 · 데모'}</span></div></header>
    {!p ? <main className="home"><section className="hero"><span className="eyebrow">연구 발표 설계 워크스페이스</span><h1>내 연구를,<br/><em>청중이 이해하는 이야기</em>로.</h1><p>연구를 정리하고, 청중의 질문을 살펴보고, 발표를 설계하고, 전달된 메시지를 점검하세요.</p><button className="primary" onClick={() => { setDraft(fresh()); setStep(0); }}><Plus size={18}/> 새 발표 시작하기 <ArrowRight size={17}/></button></section><section className="home-projects"><div className="row"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>내 발표 프로젝트</h2></div><label className="secondary upload"><Upload size={16}/> 가져오기<input type="file" accept=".json" onChange={e => importFile(e.target.files?.[0])}/></label></div>{projects.length ? <div className="projects">{projects.map(x => <button className="project" key={x.id} onClick={() => { setSelected(x.id); setStep(0); }}><span className="project-icon"><FileText size={22}/></span><strong>{x.title}</strong><small>{x.audience} · {x.minutes}분</small><span className="project-foot">마지막 수정 {new Date(x.updated).toLocaleDateString('ko-KR')} <ArrowRight size={16}/></span></button>)}</div> : <div className="empty"><BookOpen size={30}/><strong>아직 만든 발표가 없습니다</strong><span>첫 연구 발표를 시작해 보세요.</span></div>}</section></main> :
    <div className="workspace"><aside className="sidebar"><button className="back" onClick={home}><ArrowLeft size={16}/> 모든 프로젝트</button><div className="side-title"><span className="eyebrow">CURRENT PROJECT</span><strong>{p.title || '새 발표'}</strong><small>{p.audience || '청중 미입력'} · {p.minutes}분</small></div><nav>{steps.map((name, i) => <button key={name} className={step === i ? 'active' : ''} disabled={!!draft && i > 0} onClick={() => setStep(i)}><span>{String(i + 1).padStart(2, '0')}</span>{name}<ArrowRight size={15}/></button>)}</nav><div className="side-bottom"><button onClick={() => download(p)}><Download size={16}/> 프로젝트 내보내기</button>{!draft && <button onClick={() => { if (confirm('이 프로젝트를 삭제할까요?')) { setProjects(xs => xs.filter(x => x.id !== p.id)); home(); } }}>프로젝트 삭제</button>}</div></aside>
    <main className="main"><div className="main-head"><div><span className="eyebrow">STEP {String(step + 1).padStart(2, '0')} / 05</span><h1>{steps[step]}</h1></div><small>{draft ? '작성 중' : '이 브라우저에 자동 저장'}</small></div>
    {step === 0 && <div className="stack"><div className="intro"><BookOpen size={21}/><div><strong>발표의 기준점부터 정해 보세요</strong><p>핵심 메시지는 처음에는 임시 문장이어도 됩니다. 작업하며 수정할 수 있어요.</p></div></div><div className="card"><h2>연구 내용</h2><Field label="발표 제목 *"><input value={p.title} onChange={e => update({ title: e.target.value })} placeholder="예: AI 기반 학습 지원의 효과"/></Field><Field label="초록 또는 원고의 핵심 내용 *" hint="현재 데모는 PDF를 자동 분석하지 않습니다. 초록, 결과, 한계를 붙여 넣어 주세요."><textarea rows={8} value={p.research} onChange={e => update({ research: e.target.value })} placeholder="연구 문제, 방법, 주요 결과, 한계..."/><label className="secondary upload"><Upload size={16}/> .txt / .md 불러오기<input type="file" accept=".txt,.md" onChange={async e => { const f = e.target.files?.[0]; if (f) update({ research: await f.text() }); }}/></label></Field></div><div className="card"><h2>청중과 발표 상황</h2><div className="grid2"><Field label="주요 청중 *"><input value={p.audience} onChange={e => update({ audience: e.target.value })} placeholder="예: 타 분야 대학원생"/></Field><Field label="발표 시간 (분)"><input type="number" min="5" value={p.minutes} onChange={e => update({ minutes: Math.max(5, Number(e.target.value) || 5) })}/></Field></div><Field label="청중이 이미 아는 것"><input value={p.knowledge} onChange={e => update({ knowledge: e.target.value })} placeholder="예: 분야는 알지만 분석 방법은 모름"/></Field><Field label="청중이 관심을 가질 이유"><input value={p.relevance} onChange={e => update({ relevance: e.target.value })} placeholder="예: 자신의 발표에도 적용 가능"/></Field><Field label="발표 맥락"><input value={p.context} onChange={e => update({ context: e.target.value })} placeholder="예: 학회 구두발표"/></Field></div><div className="card key-card"><h2>청중이 한 가지만 기억한다면?</h2><p>발표 후 청중이 자기 말로 설명하길 바라는 내용을 적어 주세요.</p><textarea rows={3} value={p.message} onChange={e => update({ message: e.target.value })} placeholder="예: 우리 연구는 ○○ 조건에서 △△가 효과적임을 보여준다."/></div><div className="actions"><button className="primary" onClick={next}>저장하고 청중 질문 보기 <ArrowRight size={17}/></button></div></div>}
    {step === 1 && <PresentationDialogue project={p} onChange={dialogue => update({ dialogue })} onContinue={next} aiEnabled={aiEnabled} accessCode={accessCode}/>}
    {step === 2 && <div className="flow-layout"><div className="stack"><div className="intro"><BookOpen size={21}/><div><strong>청중과의 대화에서 발표 흐름으로</strong><p>대화 내용을 반영한 초안입니다. 구간을 직접 수정하거나 오른쪽 도우미의 변경안을 확인해 적용하세요.</p></div></div><div className="note">{aiEnabled ? 'OpenAI가 연구 자료와 청중 대화를 바탕으로 만든 초안입니다. 주장과 근거를 직접 확인해 주세요.' : '데모 모드: 이 초안은 기본 구조와 대화 일부를 조합했습니다. 실제 AI 분석 결과가 아닙니다.'}</div><div className="metrics"><div>목표 시간<strong>{p.minutes}분</strong></div><div>현재 배분<strong>{total}분</strong></div><div>핵심 메시지<strong>{p.message}</strong></div></div>{Math.abs(total - p.minutes) > 1 && <div className="note">목표 시간과 배분 시간이 {Math.abs(total - p.minutes)}분 차이 납니다.</div>}{p.parts.map((x, i) => <div className="part" key={x.id}><span className="part-no">{String(i + 1).padStart(2, '0')}</span><div><input className="part-title" value={x.title} onChange={e => setPart(x.id, { title: e.target.value })}/><textarea rows={2} value={x.purpose} onChange={e => setPart(x.id, { purpose: e.target.value })}/><div className="part-actions"><label>시간 <input type="number" min=".5" step=".5" value={x.minutes} onChange={e => setPart(x.id, { minutes: Number(e.target.value) || .5 })}/> 분</label><button disabled={i === 0} onClick={() => { const a = [...p.parts]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; update({ parts: a }); }}>↑ 위로</button><button disabled={i === p.parts.length - 1} onClick={() => { const a = [...p.parts]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; update({ parts: a }); }}>↓ 아래로</button><button onClick={() => update({ parts: p.parts.filter(y => y.id !== x.id) })}>삭제</button></div></div></div>)}<button className="add" onClick={() => update({ parts: [...p.parts, { id: id(), title: '새 구간', purpose: '', minutes: 1, claim: '', evidence: '', visual: '', concern: '' }] })}><Plus size={17}/> 구간 추가</button><div className="actions"><button className="secondary" onClick={() => setStep(1)}>청중 대화로</button><button className="primary" onClick={next}>스토리보드 만들기 <ArrowRight size={17}/></button></div></div><FlowAssistant parts={p.parts} onApply={parts => update({ parts })} aiEnabled={aiEnabled} accessCode={accessCode} context={{ research: p.research, audience: p.audience, knowledge: p.knowledge, message: p.message, minutes: p.minutes }}/></div>}
    {step === 3 && <div className="stack"><div className="intro"><FileText size={21}/><div><strong>한 구간에 하나의 주장과 근거</strong><p>각 구간의 주장, 원자료, 보여줄 자료, 예상 질문을 적어 주세요.</p></div></div>{p.parts.map((x, i) => <div className="card story" key={x.id}><div className="story-head"><span className="eyebrow">SCENE {String(i + 1).padStart(2, '0')}</span><strong>{x.title}</strong><small>{x.minutes}분</small></div><Field label="청중에게 전달할 주장"><input value={x.claim} onChange={e => setPart(x.id, { claim: e.target.value })} placeholder="이 구간의 핵심 한 문장"/></Field><Field label="근거 · 원자료 위치"><input value={x.evidence} onChange={e => setPart(x.id, { evidence: e.target.value })} placeholder="예: Figure 2, 결과 표 3"/></Field><div className="grid2"><Field label="보여줄 시각 자료"><input value={x.visual} onChange={e => setPart(x.id, { visual: e.target.value })} placeholder="그래프·도식 아이디어"/></Field><Field label="예상 질문 또는 오해"><input value={x.concern} onChange={e => setPart(x.id, { concern: e.target.value })} placeholder="용어, 비교 기준, 한계"/></Field></div></div>)}<div className="actions"><button className="secondary" onClick={() => setStep(2)}>흐름으로</button><button className="primary" onClick={next}>이해 점검하기 <ArrowRight size={17}/></button></div></div>}
    {step === 4 && <AudienceReview project={p} aiEnabled={aiEnabled} accessCode={accessCode} onNavigate={setStep}/>}
    </main></div>}
    {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')}>닫기</button></div>}
  </div>;
}


