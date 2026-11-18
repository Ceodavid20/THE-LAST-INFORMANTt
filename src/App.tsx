import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AudioLines, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, FileText, Fingerprint, Headphones, LockKeyhole, MessageSquareText, Moon, Pause, Play, Plus, Search, Send, ShieldAlert, Siren, Sun, Volume2, VolumeX, X } from 'lucide-react';
import CastRollCall from './CastRollCall';
import CaseLibrary from './CaseLibrary';
import CharacterPortrait from './CharacterPortrait';
import { setAtmosphereEnabled, setAtmosphereTension, stopAtmosphere } from './atmosphere';
import { requestDialogue } from './dialogue';

type Suspect = { id: string; name: string; role: string; initials: string; color: string; relationship: string; introduction: string; status: string };
type Evidence = { id: string; name: string; type: string; detail: string; time: string; icon: string };
type Message = { role: 'player' | 'suspect' | 'error'; text: string; evidenceIds?: string[]; audioUrl?: string; audioError?: string; audioBusy?: boolean; audioMock?: boolean };
type CaseData = { id: string; number: string; title: string; category: string; location: string; incidentTime: string; objective: string; durationSeconds: number; company: string; suspects: Suspect[]; evidence: Evidence[]; timeline: { time: string; event: string }[]; briefing: string };
const nav = [{ id: 'command', label: 'Command centre', icon: Activity }, { id: 'interrogation', label: 'Interrogation room', icon: MessageSquareText }, { id: 'evidence', label: 'Evidence locker', icon: Fingerprint }, { id: 'timeline', label: 'Event timeline', icon: Clock3 }, { id: 'notebook', label: 'Case notebook', icon: FileText }];
const readPreference = (key: string, fallback: string) => {
  try { return window.localStorage.getItem(key) || fallback; } catch { return fallback; }
};

export default function App() {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [completedCases, setCompletedCases] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(readPreference('informant-completed-cases', '[]'));
      return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : [];
    } catch { return []; }
  });
  const completeCase = useCallback((completedId: string) => setCompletedCases(current => current.includes(completedId) ? current : [...current, completedId]), []);
  useEffect(() => { try { localStorage.setItem('informant-completed-cases', JSON.stringify(completedCases)); } catch {} }, [completedCases]);
  return caseId ? <Investigation key={caseId} caseId={caseId} onChooseCase={() => setCaseId(null)} onComplete={completeCase}/> : <CaseLibrary onSelect={setCaseId} completedCases={completedCases}/>;
}

function Investigation({ caseId, onChooseCase, onComplete }: { caseId: string; onChooseCase: () => void; onComplete: (caseId: string) => void }) {
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [caseError, setCaseError] = useState('');
  const [activeNav, setActiveNav] = useState('command');
  const [suspectId, setSuspectId] = useState('elena_cross');
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [question, setQuestion] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [sound, setSound] = useState(true);
  const [volume, setVolume] = useState(72);
  const [autoPlay, setAutoPlay] = useState(true);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [clock, setClock] = useState(900);
  const [roundStarted, setRoundStarted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [accuseOpen, setAccuseOpen] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; culprit: string; reveal: string; timedOut?: boolean } | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(true);
  const [rollCallOpen, setRollCallOpen] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => readPreference('informant-theme', 'dark') === 'light' ? 'light' : 'dark');
  const [ambience, setAmbience] = useState(() => readPreference('informant-ambience', 'true') !== 'false');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioKeyRef = useRef<string | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const audioUrls = useRef(new Set<string>());
  const playbackPreferences = useRef({ sound, volume, autoPlay, suspectId, closed: Boolean(result) });
  playbackPreferences.current = { sound, volume, autoPlay, suspectId, closed: Boolean(result) };
  const activeSuspect = caseData?.suspects.find(x => x.id === suspectId);
  const activeMessages = messages[suspectId] || [];
  const focusedEvidence = caseData?.evidence.find(item => item.id === selectedEvidence.at(-1));
  const suggestedQuestions = caseData && activeSuspect
    ? focusedEvidence
      ? [
        `What can you tell me about the ${focusedEvidence.name}?`,
        `How does this record relate to your role in the incident?`,
        'Who else could help explain what this record shows?',
      ]
      : [
        `What were you doing around ${caseData.incidentTime}?`,
        `How were you involved in ${caseData.title}?`,
        'Which records could help verify your account?',
      ]
    : [];
  const subjectSpeaking = Boolean(playing?.startsWith(`${suspectId}-`));
  const voiceGenerating = activeMessages.some(message => message.role === 'suspect' && message.audioBusy);
  const interviewState = busy ? 'REVIEWING QUESTION' : voiceGenerating ? 'GENERATING RESPONSE' : subjectSpeaking ? 'SUBJECT SPEAKING' : 'AWAITING RESPONSE';
  const evidenceCount = selectedEvidence.length;
  const suspectReplyCount = Object.values(messages).flat().filter(message => message.role === 'suspect').length;
  const signalLevel = Math.min(100, 22 + evidenceCount * 9 + suspectReplyCount * 7 + (clock < 300 ? 15 : 0));
  const signalState = signalLevel >= 72 ? 'critical' : signalLevel >= 48 ? 'elevated' : 'steady';
  useEffect(() => { setAtmosphereTension(signalLevel / 100); }, [signalLevel]);
  const elapsed = useMemo(() => startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0, [startedAt, clock]);

  useEffect(() => {
    const controller = new AbortController();
    requestController.current = controller;
    fetch(`/api/case?caseId=${encodeURIComponent(caseId)}`, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The case could not be loaded.');
      setCaseData(data);
      setClock(data.durationSeconds);
      setSuspectId(data.suspects[0].id);
    }).catch(error => { if (!controller.signal.aborted) setCaseError(error instanceof Error ? error.message : 'The case could not be loaded.'); });
    return () => controller.abort();
  }, [caseId]);
  useEffect(() => { if (result) onComplete(caseId); }, [result, caseId, onComplete]);
  useEffect(() => {
    if (!roundStarted || result) return;
    const id = window.setInterval(() => setClock(current => {
      if (current <= 1) { window.clearInterval(id); return 0; }
      return current - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [roundStarted, result]);
  useEffect(() => {
    if (!roundStarted || clock !== 0 || result) return;
    let active = true;
    fetch('/api/timeout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId }), signal: requestController.current?.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The case could not be closed.');
      if (active) setResult({ ...data, timedOut: true });
    }).catch(() => {
      if (active) setResult({ timedOut: true, correct: false, culprit: '', reveal: 'The investigation window expired before the case could be closed.' });
    });
    return () => { active = false; };
  }, [roundStarted, clock, result, caseId]);
  useEffect(() => { try { window.localStorage.setItem('informant-theme', theme); } catch { /* storage can be unavailable in private contexts */ } }, [theme]);
  useEffect(() => { try { window.localStorage.setItem('informant-ambience', String(ambience)); } catch { /* storage can be unavailable in private contexts */ } }, [ambience]);
  useEffect(() => { setAtmosphereTension(signalLevel / 100); }, [signalLevel]);
  useEffect(() => { const urls = audioUrls.current; return () => { if (audioRef.current) audioRef.current.pause(); for (const url of urls) URL.revokeObjectURL(url); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); stopAtmosphere(); }; }, []);
  useEffect(() => {
    audioRef.current?.pause();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setPlaying(null);
  }, [suspectId, result]);

  const append = (id: string, message: Message) => setMessages(old => ({ ...old, [id]: [...(old[id] || []), message] }));
  const speech = async (who: string, text: string, index: number) => {
    const mark = (change: Partial<Message>) => setMessages(old => ({ ...old, [who]: (old[who] || []).map((m, i) => i === index ? { ...m, ...change } : m) }));
    mark({ audioBusy: true, audioError: undefined });
    try {
      const response = await fetch('/api/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suspectId: who, text }), signal: requestController.current?.signal });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Audio could not be generated.'); }
      const blob = await response.blob(); if (requestController.current?.signal.aborted) return; const url = URL.createObjectURL(blob); audioUrls.current.add(url); mark({ audioBusy: false, audioUrl: url });
      const preferences = playbackPreferences.current;
      if (preferences.autoPlay && preferences.sound && preferences.suspectId === who && !preferences.closed) play(url, `${who}-${index}`);
    } catch (error) {
      if (requestController.current?.signal.aborted) return;
      const reason = error instanceof Error ? error.message : 'Audio could not be generated.';
      if (import.meta.env.DEV && 'speechSynthesis' in window) {
        mark({ audioBusy: false, audioError: undefined, audioMock: true });
        const preferences = playbackPreferences.current;
        if (preferences.autoPlay && preferences.sound && preferences.suspectId === who && !preferences.closed) playMockVoice(text, `${who}-${index}`);
      } else mark({ audioBusy: false, audioError: reason });
    }
  };
  const play = (url: string, id: string) => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (audioRef.current && audioKeyRef.current === id) {
      if (audioRef.current.paused) {
        if (audioRef.current.ended) audioRef.current.currentTime = 0;
        audioRef.current.play().then(() => setPlaying(id)).catch(() => setPlaying(null));
      }
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const preferences = playbackPreferences.current;
    const audio = new Audio(url); audio.volume = preferences.sound ? preferences.volume / 100 : 0; audioRef.current = audio; audioKeyRef.current = id; setPlaying(id);
    const finish = () => { if (audioKeyRef.current === id) setPlaying(null); };
    audio.onended = finish; audio.onerror = finish; audio.play().catch(finish);
  };
  const playMockVoice = (text: string, id: string) => {
    if (!('speechSynthesis' in window)) return;
    audioRef.current?.pause();
    if (audioKeyRef.current === id && window.speechSynthesis.paused) {
      window.speechSynthesis.resume(); setPlaying(id); return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text); utterance.rate = 0.96;
    const preferences = playbackPreferences.current;
    utterance.volume = preferences.sound ? preferences.volume / 100 : 0;
    const finish = () => { if (audioKeyRef.current === id) setPlaying(null); };
    utterance.onend = finish; utterance.onerror = finish;
    audioKeyRef.current = id; setPlaying(id); window.speechSynthesis.speak(utterance);
  };
  const toggleSound = () => {
    const next = !sound; setSound(next);
    if (audioRef.current) audioRef.current.volume = next ? volume / 100 : 0;
    if (!next && 'speechSynthesis' in window) { window.speechSynthesis.cancel(); setPlaying(null); }
  };
  const toggleTheme = () => setTheme(current => current === 'dark' ? 'light' : 'dark');
  const toggleAmbience = () => {
    const next = !ambience;
    setAmbience(next);
    void setAtmosphereEnabled(next);
  };
  const enterCaseBriefing = () => {
    if (ambience) void setAtmosphereEnabled(true);
    setRollCallOpen(false);
  };
  const beginInvestigation = () => {
    setClock(caseData?.durationSeconds || 900);
    setStartedAt(Date.now());
    setRoundStarted(true);
    setBriefingOpen(false);
  };
  const adjustVolume = (value: number) => {
    setVolume(value);
    if (audioRef.current && sound) audioRef.current.volume = value / 100;
  };
  const interrogate = async (event: React.FormEvent) => {
    event.preventDefault(); if (question.trim().length < 2 || busy || !activeSuspect || result || clock === 0) return;
    const prompt = question.trim(); setQuestion(''); setBusy(true);
    append(suspectId, { role: 'player', text: prompt });
    try {
      const history = activeMessages.filter(message => message.role !== 'error').slice(-8).map(({ role, text }) => ({ role, text }));
      const data = await requestDialogue('/api/interrogate', { caseId, suspectId, question: prompt, evidenceIds: selectedEvidence, history }, requestController.current?.signal);
      const index = (messages[suspectId] || []).length + 1; append(suspectId, { role: 'suspect', text: data.text, evidenceIds: [...selectedEvidence] });
      if (sound) void speech(suspectId, data.text, index);
    } catch (error) {
      if (!requestController.current?.signal.aborted) {
        append(suspectId, { role: 'error', text: error instanceof Error ? error.message : 'The interview channel is unavailable.' });
        if (playbackPreferences.current.suspectId === suspectId) setQuestion(current => current || prompt);
      }
    }
    finally { setBusy(false); }
  };
  const toggleEvidence = (id: string) => setSelectedEvidence(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  const accuse = async (id: string) => {
    try {
      const response = await fetch('/api/accuse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId, suspectId: id }), signal: requestController.current?.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The accusation could not be filed.');
      setResult(data); setAccuseOpen(false);
    } catch (error) { if (!requestController.current?.signal.aborted) setCaseError(error instanceof Error ? error.message : 'The accusation could not be filed.'); }
  };
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const evidenceById = (id: string) => caseData?.evidence.find(item => item.id === id);

  if (!caseData) return <div className="boot"><div className="boot-mark">N</div><span>{caseError || 'ESTABLISHING SECURE SESSION'}</span>{caseError && <button className="outline-button" onClick={onChooseCase}>CASE ARCHIVE</button>}</div>;
  if (rollCallOpen) return <CastRollCall caseId={caseData.id} caseNumber={caseData.number} caseTitle={caseData.title} suspects={caseData.suspects} theme={theme} ambienceEnabled={ambience} onToggleTheme={toggleTheme} onToggleAmbience={toggleAmbience} onStartAtmosphere={() => { if (ambience) void setAtmosphereEnabled(true); }} onContinue={enterCaseBriefing} onChooseCase={onChooseCase} />;
  return <div className="app-shell" data-theme={theme}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><span>N</span><i /></div><div><strong>NEXORA</strong><small>INTELLIGENCE DIVISION</small></div></div>
      <div className="case-label"><span>ACTIVE OPERATION</span><b>CASE {caseData.number} / {caseData.category.toUpperCase()}</b></div>
      <div className="nav-list">{nav.map(item => { const Icon = item.icon; return <button key={item.id} className={`nav-item ${activeNav === item.id ? 'active' : ''}`} onClick={() => setActiveNav(item.id)}><Icon size={17}/><span>{item.label}</span>{item.id === 'evidence' && evidenceCount > 0 && <em>{evidenceCount}</em>}</button>; })}</div>
      <div className="sidebar-spacer" />
      <div className="status-box"><div className="status-line"><span className="live-dot"/> SECURE CHANNEL <span className="status-right">LIVE</span></div><div className="status-divider"/><div className="status-line muted"><LockKeyhole size={13}/> ENCRYPTION <span className="status-right">AES-256</span></div><div className="status-line muted"><Activity size={13}/> ACTIVE OPERATIVES <span className="status-right">01</span></div></div>
      <div className="user-row"><div className="user-avatar">IA</div><div><b>INVESTIGATOR</b><small>FIELD AUTHORIZATION</small></div><ChevronDown size={15} className="user-chevron"/></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><button className="archive-link" onClick={onChooseCase}>CASE ARCHIVE</button><ChevronRight size={13}/><b>{nav.find(x => x.id === activeNav)?.label.toUpperCase()}</b></div><div className="top-actions"><div className="round-status"><span className="live-dot"/> OPERATION IN PROGRESS</div><div className={`aurora-signal ${signalState}`} title="Case pressure rises as evidence and interviews accumulate"><span>CASE PRESSURE</span><i><b style={{ width: `${signalLevel}%` }}/></i><strong>{signalLevel}%</strong></div><button className="icon-button" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={toggleTheme}>{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}</button><button className={`icon-button ${ambience ? 'ambient-on' : ''}`} aria-label={ambience ? 'Turn off suspense ambience' : 'Turn on suspense ambience'} aria-pressed={ambience} title={ambience ? 'Suspense ambience on' : 'Suspense ambience off'} onClick={toggleAmbience}><AudioLines size={17}/></button><button className="icon-button" aria-label="Dialogue sound" title="Toggle character voices" onClick={toggleSound}>{sound ? <Volume2 size={17}/> : <VolumeX size={17}/>}</button><button className="help-button" title="Case information" onClick={() => setBriefingOpen(true)}><CircleHelp size={16}/></button></div></header>
      {caseError && <p className="library-error" role="alert">{caseError}</p>}

      <section className="case-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> CONFIDENTIAL // EYES ONLY</div><h1>The Last <i>Informant</i></h1><p>{caseData.category} / {caseData.title}</p></div><div className="round-clock"><div className="clock-caption"><Clock3 size={14}/> INVESTIGATION WINDOW</div><strong className={clock < 120 ? 'urgent' : ''}>{formatTime(clock)}</strong><small>MAXIMUM {caseData.durationSeconds / 60} MINUTES</small></div></section>
      <div className="case-strip"><div><span>CASE</span><b>{caseData.number}</b></div><i/><div><span>SUBJECT</span><b>{caseData.title.toUpperCase()}</b></div><i/><div><span>FACILITY</span><b>{caseData.location}</b></div><i/><div><span>STATUS</span><b className="status-investigating">INVESTIGATING</b></div></div>

      <div className="workspace">
        <section className="center-column" key={activeNav}>
          {activeNav === 'command' && <>
            <div className="section-heading"><div><div className="micro-label">OPERATION OVERVIEW</div><h2>Command centre</h2></div><button className="outline-button" onClick={() => setBriefingOpen(true)}><FileText size={14}/> CASE BRIEFING</button></div>
            <div className="overview-grid"><div className="overview-panel operation-panel"><div className="panel-top"><span className="panel-tag"><Siren size={12}/> PRIORITY ONE</span><span className="micro-label">{caseData.incidentTime} / INCIDENT</span></div><h3>{caseData.title}</h3><p>{caseData.briefing}</p><div className="panel-stats"><div><b>{String(caseData.suspects.length).padStart(2, '0')}</b><small>SUBJECTS</small></div><div><b>{String(caseData.evidence.length).padStart(2, '0')}</b><small>LEADS FOUND</small></div><div><b>{evidenceCount.toString().padStart(2,'0')}</b><small>IN YOUR FILE</small></div></div></div>
              <div className="overview-panel lead-panel"><div className="micro-label">INVESTIGATION PROGRESS</div><div className="progress-number">{Math.min(92, 12 + evidenceCount * 15 + Object.values(messages).flat().filter(x => x.role === 'suspect').length * 4)}<sup>%</sup></div><div className="progress-bar"><span style={{ width: `${Math.min(92, 12 + evidenceCount * 15 + Object.values(messages).flat().filter(x => x.role === 'suspect').length * 4)}%` }}/></div><p>{caseData.objective}</p><button className="text-link" onClick={() => setActiveNav('interrogation')}>CONTINUE INVESTIGATION <ChevronRight size={14}/></button></div></div>
            <div className="section-heading compact"><div><div className="micro-label">PERSONS OF INTEREST</div><h2>Six with access. One with intent.</h2></div><button className="text-link" onClick={() => setActiveNav('interrogation')}>OPEN INTERROGATION ROOM <ChevronRight size={14}/></button></div>
            <div className="suspect-grid">{caseData.suspects.map(person => <button key={person.id} className="suspect-card" onClick={() => { setSuspectId(person.id); setActiveNav('interrogation'); }}><div className="portrait" style={{ '--portrait': person.color } as React.CSSProperties}><CharacterPortrait id={person.id} name={person.name} initials={person.initials}/></div><div className="suspect-info"><b>{person.name}</b><small>{person.role}</small><span className={`mini-status ${person.status === 'CLEARED' ? 'cleared' : ''}`}>{person.status}</span></div><ChevronRight size={15} className="suspect-arrow"/></button>)}</div>
            <div className="latest-row"><div className="micro-label">LATEST DEVELOPMENT</div><span className="latest-mark"><Fingerprint size={15}/></span><div><b>{selectedEvidence.length ? evidenceById(selectedEvidence[selectedEvidence.length-1])?.name : 'No evidence added to your case file'}</b><small>{selectedEvidence.length ? 'New material linked to active investigation' : 'Review the evidence locker to start building your case.'}</small></div><button className="text-link" onClick={() => setActiveNav('evidence')}>VIEW FILE <ChevronRight size={14}/></button></div>
          </>}

          {activeNav === 'interrogation' && <>
            <div className="section-heading"><div><div className="micro-label">SECURE INTERVIEW // ROOM 04</div><h2>Interrogation room</h2></div><div className="audio-toggle"><Headphones size={14}/><span>AUTO VOICE</span><button className={`switch ${autoPlay && sound ? 'on' : ''}`} aria-label="Toggle automatic voice playback" onClick={() => setAutoPlay(!autoPlay)}><i/></button></div></div>
            <div className="interview-layout"><div className="subject-rail">{caseData.suspects.map(p => <button key={p.id} onClick={() => setSuspectId(p.id)} className={`rail-person ${suspectId === p.id ? 'selected' : ''}`}><span className="rail-avatar"><CharacterPortrait id={p.id} name={p.name} initials={p.initials}/></span><span><b>{p.name}</b><small>{p.role}</small></span><i/></button>)}</div>
              <div className="interview-room"><div className="room-subject"><CharacterPortrait id={activeSuspect!.id} name={activeSuspect!.name} initials={activeSuspect!.initials} className={`large-portrait ${subjectSpeaking ? 'speaking' : ''} ${busy || voiceGenerating ? 'listening' : ''}`} speaking={subjectSpeaking}/><div className="room-person-info"><div className="micro-label">SUBJECT 0{caseData.suspects.findIndex(p => p.id === suspectId) + 1} / ACTIVE INTERVIEW</div><h3>{activeSuspect?.name}</h3><p>{activeSuspect?.role}</p><div className={`subject-status ${subjectSpeaking ? 'speaking' : ''} ${voiceGenerating || busy ? 'processing' : ''}`} aria-live="polite"><span className="live-dot"/> {interviewState}</div></div><button className="sound-profile" title="Voice profile"><AudioLines size={17}/></button></div>
                <div className="transcript" key={suspectId}>{activeMessages.length === 0 && <div className="transcript-empty"><div className="transcript-line"/><span>INTERVIEW RECORD BEGINS</span><div className="transcript-line"/><p>Select evidence below and ask your first question.</p></div>}{activeMessages.map((message, index) => <article key={index} className={`message ${message.role}`}><div className="message-label"><span>{message.role === 'player' ? 'YOU / INVESTIGATOR' : message.role === 'error' ? 'INTERVIEW CHANNEL' : activeSuspect?.name.toUpperCase()}</span><span>{message.role === 'error' ? 'REQUEST FAILED' : message.role === 'player' ? 'TRANSMITTED' : message.role === 'suspect' ? 'RECORDED' : ''}</span></div><p>{message.text}</p>{message.role === 'suspect' && <div className="message-tools">{(message.audioUrl || message.audioMock) && <button className={`playback ${playing === `${suspectId}-${index}` ? 'is-playing' : ''}`} onClick={() => { const id = `${suspectId}-${index}`; if (playing === id) { if (message.audioMock) window.speechSynthesis.pause(); else audioRef.current?.pause(); setPlaying(null); } else if (message.audioMock) playMockVoice(message.text, id); else play(message.audioUrl!, id); }}>{playing === `${suspectId}-${index}` ? <Pause size={13}/> : <Play size={13}/>} {playing === `${suspectId}-${index}` ? 'PAUSE' : message.audioMock ? 'MOCK VOICE' : 'PLAY VOICE'}</button>}{message.audioMock && <span className="used-evidence">DEVELOPMENT MOCK · BROWSER VOICE</span>}{message.audioBusy && <span className="audio-progress"><span className="loader-dot"/> GENERATING VOICE</span>}{message.audioError && <button className="audio-error" onClick={() => speech(suspectId, message.text, index)} title="Retry voice generation"><span>{message.audioError}</span><b>RETRY</b></button>}{message.evidenceIds?.length ? <span className="used-evidence">EVIDENCE PRESENTED · {message.evidenceIds.length}</span> : null}</div>}</article>)}{busy && <div className="thinking"><span className="loader-dot"/> SUBJECT IS CONSIDERING RESPONSE</div>}</div>
                <div className="evidence-chips"><span>PRESENT EVIDENCE</span>{caseData.evidence.map(e => <button key={e.id} className={selectedEvidence.includes(e.id) ? 'chip selected' : 'chip'} onClick={() => toggleEvidence(e.id)} title={e.name}>{selectedEvidence.includes(e.id) ? <Check size={12}/> : <Plus size={12}/>} {e.name}</button>)}</div>
                <div className="suggested-questions"><div className="suggested-questions-heading">SUGGESTED QUESTIONS <span>· TAP TO ADD</span></div><div className="suggested-questions-list">{suggestedQuestions.map(suggestion => <button key={suggestion} type="button" className="suggested-question" disabled={busy || Boolean(result) || clock === 0} onClick={() => setQuestion(suggestion)}>{suggestion}</button>)}</div></div>
                <form className="question-form" onSubmit={interrogate}><input value={question} onChange={e => setQuestion(e.target.value)} placeholder={`Ask ${activeSuspect?.name.split(' ')[0]} a question...`} maxLength={500} aria-label="Ask a question; choose a suggestion above or type your own"/><span className="char-count">{question.length}/500</span><button className="send-button" disabled={question.trim().length < 2 || busy || Boolean(result) || clock === 0} title="Send question"><Send size={16}/></button></form><div className="interview-footer"><span><LockKeyhole size={12}/> ENCRYPTED INTERVIEW</span><span>TEXT ALWAYS AVAILABLE · {sound ? 'VOICE ENABLED' : 'VOICE MUTED'}</span></div>
              </div></div>
          </>}

          {activeNav === 'evidence' && <><div className="section-heading"><div><div className="micro-label">FORENSIC MATERIAL / 04 RECOVERED</div><h2>Evidence locker</h2></div><div className="evidence-counter"><b>{evidenceCount.toString().padStart(2,'0')}</b><span>IN CASE FILE</span></div></div><div className="evidence-list">{caseData.evidence.map((item, i) => <div key={item.id} className={`evidence-item ${selectedEvidence.includes(item.id) ? 'filed' : ''}`}><div className="evidence-icon">{item.icon}</div><div className="evidence-content"><div className="evidence-meta"><span>{item.type}</span><span>RECOVERED AT {item.time}</span></div><h3>{item.name}</h3><p>{item.detail}</p><div className="evidence-actions"><span>EXHIBIT 0{i+1}</span><button onClick={() => toggleEvidence(item.id)}>{selectedEvidence.includes(item.id) ? <><Check size={13}/> ADDED TO CASE</> : <><Plus size={13}/> ADD TO CASE</>}</button><button onClick={() => { setActiveNav('interrogation'); if (!selectedEvidence.includes(item.id)) toggleEvidence(item.id); }}>PRESENT IN INTERVIEW <ChevronRight size={13}/></button></div></div></div>)}</div><div className="secure-note"><LockKeyhole size={14}/> Evidence chain of custody verified. All exhibits are read-only originals.</div></>}

          {activeNav === 'timeline' && <><div className="section-heading"><div><div className="micro-label">FACILITY EVENT LOG / UTC+0</div><h2>Event timeline</h2></div><span className="timeline-badge"><Activity size={13}/> RECONSTRUCTED</span></div><div className="timeline-list">{caseData.timeline.map((event, index) => <div className="timeline-event" key={event.time}><div className="timeline-time">{event.time}</div><div className={`timeline-node ${index === 2 ? 'highlight' : ''}`}><i/></div><div className="timeline-copy"><span>{index === 0 ? 'INTERNAL DOCUMENT' : index === 1 ? 'SURVEILLANCE' : index === 2 ? 'ACCESS CONTROL' : index === 3 ? 'NETWORK ACTIVITY' : 'EXTERNAL ALERT'}</span><p>{event.event}</p></div></div>)}</div><div className="timeline-footnote"><ShieldAlert size={15}/> Timeline order is based on server logs and recovered records. Correlate events before drawing conclusions.</div></>}

          {activeNav === 'notebook' && <><div className="section-heading"><div><div className="micro-label">INVESTIGATOR WORKING FILE</div><h2>Case notebook</h2></div><span className="evidence-counter"><b>{evidenceCount.toString().padStart(2,'0')}</b><span>LINKED EXHIBITS</span></span></div><div className="notebook-paper"><div className="notebook-header"><div><span>CONFIDENTIAL / CASE {caseData.number}</span><h3>Working theory</h3></div><span className="notebook-stamp">ACTIVE</span></div><p className="notebook-intro">Build the chain of events before filing a final accusation. Your working file is stored for this session.</p><div className="notebook-rule"/><h4>LEADS IN EVIDENCE</h4>{selectedEvidence.length ? selectedEvidence.map(id => { const item = evidenceById(id); return <div className="notebook-evidence" key={id}><Check size={14}/><div><b>{item?.name}</b><small>{item?.detail}</small></div><button title="Remove exhibit" onClick={() => toggleEvidence(id)}><X size={14}/></button></div>; }) : <div className="notebook-empty">No exhibits linked yet. Add material from the evidence locker to begin your working theory.</div>}<div className="notebook-rule"/><h4>INTERVIEW RECORD</h4>{Object.entries(messages).flatMap(([id, list]) => list.filter(x => x.role === 'suspect').map((m, i) => <div className="notebook-quote" key={`${id}-${i}`}><span>{caseData.suspects.find(p => p.id === id)?.name.toUpperCase()}</span><p>“{m.text}”</p></div>))}<div className="notebook-empty">{Object.values(messages).flat().length ? '' : 'Interview statements will appear here as you question the six subjects.'}</div></div></>}
        </section>

        <aside className="right-column"><div className="rail-heading"><div><span className="micro-label">CASE FILE</span><h3>Investigation desk</h3></div><button className="icon-button mini" title="Search file"><Search size={15}/></button></div><div className="rail-tabs"><button className="selected">EVIDENCE <span>{evidenceCount.toString().padStart(2,'0')}</span></button><button onClick={() => setActiveNav('timeline')}>TIMELINE</button></div>
          <div className="rail-evidence-list">{caseData.evidence.map((item, i) => <button key={item.id} className={`rail-evidence ${selectedEvidence.includes(item.id) ? 'linked' : ''}`} onClick={() => toggleEvidence(item.id)}><span className="rail-evidence-icon">{item.icon}</span><span className="rail-evidence-copy"><small>EXHIBIT 0{i+1} / {item.type}</small><b>{item.name}</b><span>{item.detail}</span><i>{selectedEvidence.includes(item.id) ? <><Check size={11}/> LINKED TO CASE</> : <><Plus size={11}/> LINK TO CASE</>}</i></span></button>)}</div>
          <div className="right-divider"/><div className="rail-heading subjects-heading"><div><span className="micro-label">PERSONS OF INTEREST</span><h3>Suspect roster</h3></div><button className="text-link" onClick={() => setActiveNav('interrogation')}>VIEW ALL</button></div><div className="suspect-rail-list">{caseData.suspects.map(p => <button key={p.id} onClick={() => { setSuspectId(p.id); setActiveNav('interrogation'); }} className="compact-suspect"><span className="compact-avatar"><CharacterPortrait id={p.id} name={p.name} initials={p.initials}/></span><span><b>{p.name}</b><small>{p.role}</small></span><i className={p.status === 'CLEARED' ? 'cleared' : ''}/></button>)}</div>
          <div className="right-divider"/><div className="audio-control"><div className="audio-control-head"><span><AudioLines size={14}/> AUDIO CHANNEL</span><button className={sound ? 'audio-state' : 'audio-state off'} onClick={toggleSound}>{sound ? 'ON' : 'OFF'}</button></div><div className="volume-row"><VolumeX size={14}/><input type="range" min="0" max="100" value={volume} onChange={e => adjustVolume(Number(e.target.value))} aria-label="Audio volume"/><Volume2 size={14}/><b>{volume}%</b></div><div className="audio-note">{sound ? autoPlay ? 'Auto-play enabled for new dialogue.' : 'Manual playback only.' : 'Text dialogue remains available.'}</div></div>
          <button className="accuse-button" onClick={() => setAccuseOpen(true)}><Fingerprint size={16}/> FILE FINAL ACCUSATION <ChevronRight size={15}/></button>
        </aside>
      </div>
      <footer className="footer"><span>© NEXORA SYSTEMS / INTERNAL INTELLIGENCE</span><span><span className="live-dot"/> CLASSIFICATION: EYES ONLY</span><span>SESSION ELAPSED {formatTime(elapsed)}</span></footer>
    </main>

    {briefingOpen && <div className="modal-scrim" onClick={() => setBriefingOpen(false)}><section className="briefing-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setBriefingOpen(false)}><X size={17}/></button><div className="eyebrow"><span className="eyebrow-line"/> CLASSIFIED CASE BRIEFING</div><div className="briefing-seal"><span>N</span></div><div className="micro-label">CASE {caseData.number} / INCIDENT RESPONSE</div><h2>{caseData.title}</h2><p>{caseData.briefing}</p><div className="briefing-facts"><div><span>INCIDENT</span><b>{caseData.category.toUpperCase()}</b></div><div><span>SUBJECTS</span><b>{caseData.suspects.length} PEOPLE TO QUESTION</b></div><div><span>TIME LIMIT</span><b>{caseData.durationSeconds / 60} MINUTES</b></div></div><button className="primary-button" onClick={beginInvestigation}>OPEN THE CASE FILE <ChevronRight size={15}/></button><small>ALL ACTIVITY IS RECORDED / AUTHORIZATION {caseData.number}</small></section></div>}
    {accuseOpen && <div className="modal-scrim" onClick={() => setAccuseOpen(false)}><section className="accuse-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setAccuseOpen(false)}><X size={17}/></button><div className="micro-label">FINAL ACTION / CASE {caseData.number}</div><h2>Who is <i>responsible?</i></h2><p>Submit your accusation to close the active investigation. Your evidence file will be reviewed against the recovered event chain.</p><div className="accuse-choices">{caseData.suspects.map(p => <button key={p.id} onClick={() => void accuse(p.id)}><span className="compact-avatar"><CharacterPortrait id={p.id} name={p.name} initials={p.initials}/></span><span><b>{p.name}</b><small>{p.role}</small></span><ChevronRight size={16}/></button>)}</div><button className="cancel-button" onClick={() => setAccuseOpen(false)}>RETURN TO INVESTIGATION</button></section></div>}
    {result && <div className="modal-scrim"><section className={`result-modal ${result.correct ? 'correct' : 'incorrect'} ${result.timedOut ? 'timedout' : ''}`}><div className="result-symbol">{result.correct ? <Check size={26}/> : <ShieldAlert size={26}/>}</div><div className="eyebrow"><span className="eyebrow-line"/> {result.timedOut ? 'INVESTIGATION WINDOW CLOSED' : 'INVESTIGATION CLOSED'}</div><h2>{result.timedOut ? 'Time is up.' : result.correct ? 'You found the culprit.' : 'The accusation was wrong.'}</h2><div className="result-culprit">RESPONSIBLE PARTY <b>{caseData.suspects.find(p => p.id === result.culprit)?.name.toUpperCase()}</b></div><p>{result.timedOut ? `The investigation window expired. ${result.reveal}` : result.reveal}</p><button className="primary-button" onClick={onChooseCase}>CHOOSE ANOTHER CASE <ChevronRight size={15}/></button></section></div>}
  </div>;
}
