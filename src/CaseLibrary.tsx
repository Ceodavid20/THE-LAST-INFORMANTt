import { useEffect, useState } from 'react';
import { Check, ChevronRight, Clock3, FileText, Fingerprint, RefreshCw } from 'lucide-react';
import './cases.css';

type CaseSummary = { id: string; number: string; title: string; category: string; briefing: string; location: string; durationSeconds: number; suspectCount: number; evidenceCount: number };
type Catalog = { dailyCaseId: string; date: string; cases: CaseSummary[] };

export default function CaseLibrary({ onSelect, completedCases }: { onSelect: (caseId: string) => void; completedCases: string[] }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [theme] = useState(() => { try { return localStorage.getItem('informant-theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } });

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch('/api/cases', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('The case archive is unavailable. Start the case server and retry.');
      setCatalog(await response.json());
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'The case archive is unavailable.'); });
    return () => controller.abort();
  }, [retry]);

  const daily = catalog?.cases.find(investigation => investigation.id === catalog.dailyCaseId);
  const date = catalog ? new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'Africa/Lagos' }).format(new Date(`${catalog.date}T12:00:00+01:00`)) : '';

  return <main className="case-library" data-theme={theme}>
    <header className="library-header"><div className="library-brand"><span>N</span><div><b>NEXORA SYSTEMS</b><small>INTELLIGENCE DIVISION</small></div></div><span>THE LAST INFORMANT / CASE ARCHIVE</span></header>
    <section className="library-intro"><div className="eyebrow"><span className="eyebrow-line"/> NEW FILE. NEW QUESTIONS.</div><h1>Every case leaves<br/><i>a different trail.</i></h1><p>Choose an investigation. Follow the evidence, question the people involved, and uncover who is responsible.</p></section>
    {error && <div className="library-error" role="alert"><p>{error}</p><button className="outline-button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={14}/> RETRY</button></div>}
    {!catalog && !error && <p className="library-loading" role="status">RETRIEVING CASE FILES…</p>}
    {daily && <section className="daily-case"><div><span className="library-tag">DAILY INVESTIGATION · {date}</span><h2>{daily.title}</h2><p>{daily.briefing}</p><small>A different case is featured each day. The full archive is always open.</small></div><button className="primary-button" onClick={() => onSelect(daily.id)}>{completedCases.includes(daily.id) ? 'REPLAY DAILY CASE' : 'OPEN DAILY CASE'} <ChevronRight size={16}/></button></section>}
    {catalog && <section className="library-archive"><div className="library-section-heading"><div><span className="micro-label">AVAILABLE OPERATIONS</span><h2>Choose your next investigation</h2></div><span>{catalog.cases.filter(investigation => completedCases.includes(investigation.id)).length} / {catalog.cases.length} COMPLETED</span></div><div className="library-grid">{catalog.cases.map((investigation, index) => <article className="library-card" key={investigation.id}>
      <div className="library-card-top"><span>CASE {investigation.number}</span><span>{completedCases.includes(investigation.id) ? <><Check size={12}/> COMPLETED</> : investigation.id === catalog.dailyCaseId ? 'TODAY’S CASE' : `FILE 0${index + 1}`}</span></div>
      <div className="library-card-category"><Fingerprint size={18}/><span>{investigation.category}</span></div><h3>{investigation.title}</h3><p>{investigation.briefing}</p>
      <div className="library-card-facts"><span><Clock3 size={12}/>{investigation.durationSeconds / 60} MIN</span><span>{investigation.suspectCount} SUBJECTS</span><span><FileText size={12}/>{investigation.evidenceCount} EXHIBITS</span></div>
      <button className="outline-button" onClick={() => onSelect(investigation.id)}>{completedCases.includes(investigation.id) ? 'REPLAY INVESTIGATION' : 'OPEN INVESTIGATION'} <ChevronRight size={15}/></button>
    </article>)}</div></section>}
    <footer className="library-footer">SIX RECURRING CHARACTERS. INDEPENDENT CASES. TRUST THE EVIDENCE.</footer>
  </main>;
}
