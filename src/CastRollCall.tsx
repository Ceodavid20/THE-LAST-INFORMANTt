import { useEffect, useRef, useState } from 'react';
import { Activity, AudioLines, Camera, Check, ChevronRight, LockKeyhole, Moon, Play, Radio, RotateCcw, SkipForward, Sun, Volume2, VolumeX } from 'lucide-react';
import CharacterPortrait from './CharacterPortrait';
import { setAtmosphereTension } from './atmosphere';

type CastMember = { id: string; name: string; role: string; initials: string; color: string; relationship: string; introduction: string };
type Phase = 'ready' | 'capturing' | 'generating' | 'speaking' | 'voiceReady' | 'error' | 'complete';

export default function CastRollCall({ suspects, theme, ambienceEnabled, onToggleTheme, onToggleAmbience, onStartAtmosphere, onContinue }: {
  suspects: CastMember[];
  theme: 'dark' | 'light';
  ambienceEnabled: boolean;
  onToggleTheme: () => void;
  onToggleAmbience: () => void;
  onStartAtmosphere: () => void;
  onContinue: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [completed, setCompleted] = useState<string[]>([]);
  const [audioUrl, setAudioUrl] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [muted, setMuted] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const runRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const current = suspects[activeIndex];
  const progress = completed.length;

  useEffect(() => () => {
    runRef.current = false;
    requestRef.current?.abort();
    audioRef.current?.pause();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') void audioContextRef.current.close();
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
  }, []);

  const ensureAudioContext = () => {
    if (!audioContextRef.current && typeof window.AudioContext !== 'undefined') audioContextRef.current = new AudioContext();
    const context = audioContextRef.current;
    if (context?.state === 'suspended') void context.resume();
    return context;
  };

  const playUrl = async (url: string): Promise<'ended' | 'blocked' | 'stopped'> => {
    const audio = new Audio(url);
    audio.volume = muted ? 0 : 1;
    audioRef.current = audio;
    const context = ensureAudioContext();
    let analyser: AnalyserNode | null = null;
    let frame = 0;
    let source: MediaElementAudioSourceNode | null = null;
    if (context) {
      try {
        analyser = context.createAnalyser();
        analyser.fftSize = 256;
        source = context.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(context.destination);
      } catch {
        analyser = null;
      }
    }
    let ended = false;
    const data = analyser ? new Uint8Array(analyser.fftSize) : null;
    let lastUpdate = 0;
    const sample = (now: number) => {
      if (!analyser || !data || audio.paused || audio.ended) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) { const normalized = (value - 128) / 128; sum += normalized * normalized; }
      if (now - lastUpdate > 45) {
        setMouthOpen(Math.min(1, Math.sqrt(sum / data.length) * 6));
        lastUpdate = now;
      }
      frame = requestAnimationFrame(sample);
    };
    const result = await new Promise<'ended' | 'blocked' | 'stopped'>(resolve => {
      audio.onended = () => { ended = true; resolve('ended'); };
      audio.onerror = () => resolve('stopped');
      audio.onpause = () => { if (!ended) resolve('stopped'); };
      void audio.play().then(() => { if (analyser) frame = requestAnimationFrame(sample); }).catch(() => resolve('blocked'));
    });
    cancelAnimationFrame(frame);
    source?.disconnect();
    analyser?.disconnect();
    setMouthOpen(0);
    if (audioRef.current === audio) audioRef.current = null;
    return result;
  };

  const wait = (duration: number) => new Promise(resolve => window.setTimeout(resolve, duration));
  const runRollCall = async (from = 0) => {
    runRef.current = true;
    onStartAtmosphere();
    void ensureAudioContext();
    setVoiceError('');
    setPhase('capturing');
    if (from === 0) setCompleted([]);
    for (let index = from; index < suspects.length; index += 1) {
      if (!runRef.current) return;
      const person = suspects[index];
      setActiveIndex(index);
        setAtmosphereTension(0.12 + index / Math.max(suspects.length - 1, 1) * 0.3);
      setAudioUrl('');
      setPhase('capturing');
      await wait(1050);
      if (!runRef.current) return;
      setPhase('generating');
      const controller = new AbortController();
      requestRef.current = controller;
      try {
        const response = await fetch('/api/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ suspectId: person.id, text: person.introduction }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Voice generation failed.');
        }
        const nextUrl = URL.createObjectURL(await response.blob());
        objectUrlsRef.current.push(nextUrl);
        setAudioUrl(nextUrl);
        setPhase('speaking');
        const result = await playUrl(nextUrl);
        if (!runRef.current) return;
        if (result === 'blocked') {
          runRef.current = false;
          setPhase('voiceReady');
          setVoiceError('Audio playback was blocked. Tap play to hear this introduction.');
          return;
        }
        if (result === 'stopped') {
          setPhase('voiceReady');
          setVoiceError('Playback stopped before the introduction finished.');
          return;
        }
        setCompleted(old => old.includes(person.id) ? old : [...old, person.id]);
      } catch (error) {
        if (!runRef.current) return;
        setPhase('error');
        setVoiceError(error instanceof Error ? error.message : 'Voice generation failed.');
        runRef.current = false;
        return;
      }
      await wait(480);
    }
    if (runRef.current) {
      runRef.current = false;
      setPhase('complete');
      setActiveIndex(suspects.length - 1);
    }
  };

  const stopAndContinue = () => {
    runRef.current = false;
    requestRef.current?.abort();
    audioRef.current?.pause();
    onContinue();
  };

  const playCurrentAndContinue = async () => {
    if (!audioUrl || !current) return;
    setPhase('speaking');
    const result = await playUrl(audioUrl);
    if (result === 'ended') {
      setCompleted(old => old.includes(current.id) ? old : [...old, current.id]);
      setPhase(activeIndex === suspects.length - 1 ? 'complete' : 'voiceReady');
      setVoiceError('');
    }
  };

  const continueSequence = () => {
    if (activeIndex + 1 >= suspects.length) setPhase('complete');
    else void runRollCall(activeIndex + 1);
  };

  const setMute = () => {
    const next = !muted;
    setMuted(next);
    if (audioRef.current) audioRef.current.volume = next ? 0 : 1;
  };

  return <main className="cast-intro" data-theme={theme}>
    <div className="interrogation-room-bg" aria-hidden="true"><img src="/interrogation-room.jpg" alt=""/><div className="room-blind"/><div className="room-lamp"/><div className="room-wall-seam"/><div className="room-table"/><div className="room-glass"/></div>
    <header className="cast-header">
      <div className="cast-brand"><span className="cast-brand-mark">N</span><div><b>NEXORA SYSTEMS</b><small>INTERNAL SECURITY / INCIDENT RESPONSE</small></div></div>
      <div className="cast-header-case"><span>CASE 09-441</span><i/> AURORA / SUBJECT INTAKE</div>
      <div className="cast-header-tools">
        <button className="cast-tool" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={onToggleTheme}>{theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}</button>
        <button className={`cast-tool ${ambienceEnabled ? 'selected' : ''}`} aria-label={ambienceEnabled ? 'Turn off suspense ambience' : 'Turn on suspense ambience'} aria-pressed={ambienceEnabled} title={ambienceEnabled ? 'Suspense ambience on' : 'Suspense ambience off'} onClick={onToggleAmbience}><AudioLines size={16}/></button>
        <button className="cast-sound" aria-label={muted ? 'Enable character voices' : 'Mute character voices'} aria-pressed={!muted} title="Character voice audio" onClick={setMute}>{muted ? <VolumeX size={16}/> : <Volume2 size={16}/>}<span>{muted ? 'VOICE MUTED' : 'VOICE ON'}</span></button>
      </div>
    </header>

    <div className="cast-workspace">
      <aside className="cast-roster">
        <div className="cast-section-tag"><span>PERSONNEL FILES</span><b>06</b></div>
        <div className="cast-roster-title">Identity register</div>
        <div className="cast-roster-list">{suspects.map((person, index) => {
          const isActive = index === activeIndex;
          const isDone = completed.includes(person.id);
          return <button key={person.id} className={`cast-roster-row ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`} onClick={() => { if (!runRef.current && phase !== 'complete') { setActiveIndex(index); setPhase('ready'); setAudioUrl(''); setVoiceError(''); } }} disabled={runRef.current}>
            <span className="cast-row-number">0{index + 1}</span><span className="cast-row-initials">{person.initials}</span><span className="cast-row-copy"><b>{person.name}</b><small>{person.role}</small></span><span className="cast-row-check">{isDone ? <Check size={14}/> : <i/>}</span>
          </button>;
        })}</div>
        <div className="cast-roster-bottom"><LockKeyhole size={13}/><span>SECURE IDENTITY CAPTURE</span><b>ENCRYPTED</b></div>
      </aside>

      <section className="cast-main" aria-label="Animated suspect mugshot">
        <div className="cast-feed-bar"><span><Radio size={13}/> INTERROGATION ROOM / CAM 04</span><span className={`feed-state ${phase === 'speaking' ? 'live' : ''}`}><i/>{phase === 'speaking' ? 'SUBJECT TRANSMITTING' : phase === 'generating' ? 'VOICE SYNTHESIS' : phase === 'capturing' ? 'CAPTURING IDENTITY' : phase === 'complete' ? 'ROSTER COMPLETE' : 'STANDBY'}</span></div>
        <div className={`cast-camera phase-${phase}`} key={current.id}>
          <div className="camera-grid"/>
          <div className="camera-corner top-left"/><div className="camera-corner top-right"/><div className="camera-corner bottom-left"/><div className="camera-corner bottom-right"/>
          <div className="camera-side-label">NEXORA / BIOMETRIC INTAKE</div>
          <div className="camera-subject">
            <div className="camera-subject-light"/>
            <CharacterPortrait id={current.id} name={current.name} initials={current.initials} speaking={phase === 'speaking'} mouthOpen={mouthOpen}/>
            <span className="face-track track-a"/><span className="face-track track-b"/>
          </div>
          <div className="camera-nameplate"><span>SUBJECT 0{activeIndex + 1}</span><b>{current.name.toUpperCase()}</b></div>
          <div className="camera-rec"><i/> REC <span>TAKE 0{activeIndex + 1}</span></div>
          <div className="camera-scanline"/>
          {phase === 'capturing' && <div className="camera-flash" key={`${current.id}-flash`}/>}
          {phase === 'generating' && <div className="camera-generating"><span className="camera-spinner"/> PREPARING SUBJECT AUDIO</div>}
          {phase === 'speaking' && <div className="camera-audio-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>}
        </div>
        <div className="cast-feed-footer"><span>FACE MATCH <b>99.8%</b></span><span>SUBJECT <b>0{activeIndex + 1} / 06</b></span><span>LIGHTING <b>CONTROLLED</b></span><span>FEED <b>SECURE</b></span></div>
      </section>

      <aside className="cast-statement">
        <div className="cast-section-tag"><span>IDENTITY STATEMENT</span><b>0{activeIndex + 1} / 06</b></div>
        <div className="cast-profile-heading"><span>{current.initials}</span><div><h1>{current.name}</h1><p>{current.role}</p></div></div>
        <div className="statement-rule"><i/></div>
        <div className="statement-label">RELATION TO AURORA</div>
        <p className="statement-relation">{current.relationship}</p>
        <div className="statement-label spoken-label"><span><Activity size={13}/> SPOKEN STATEMENT</span><small>{phase === 'speaking' ? 'LIVE' : 'VERBATIM'}</small></div>
        <blockquote>{current.introduction}</blockquote>
        {voiceError && <div className={`cast-voice-error ${phase === 'voiceReady' ? 'notice' : ''}`}>{voiceError}</div>}
        <div className="cast-statement-bottom"><span><span className="live-dot"/> {phase === 'speaking' ? 'VOICE MATCHED TO SUBJECT' : phase === 'generating' ? 'GENERATING VOICE' : phase === 'complete' ? 'ALL SUBJECTS RECORDED' : 'AWAITING ROLL CALL'}</span><span>TEXT TRANSCRIPT ACTIVE</span></div>
      </aside>
    </div>

    <footer className="cast-controls">
      <div className="cast-progress"><div><span>IDENTIFICATION PROGRESS</span><b>{String(progress).padStart(2, '0')} <i>/</i> 06</b></div><div className="cast-progress-track"><span style={{ width: `${progress / Math.max(suspects.length, 1) * 100}%` }}/></div></div>
      <div className="cast-actions">
        {phase === 'ready' && <button className="cast-primary" onClick={() => void runRollCall(0)}><Camera size={16}/> BEGIN FULL ROLL CALL <ChevronRight size={15}/></button>}
        {phase === 'speaking' && <button className="cast-secondary" onClick={() => { runRef.current = false; audioRef.current?.pause(); setPhase('voiceReady'); }}><SkipForward size={15}/> STOP THIS LINE</button>}
        {(phase === 'error' || phase === 'voiceReady') && <>
          {audioUrl && <button className="cast-secondary" onClick={() => void playCurrentAndContinue()}><Play size={15}/> PLAY STATEMENT</button>}
          {phase === 'error' && <button className="cast-secondary" onClick={() => void runRollCall(activeIndex)}><RotateCcw size={14}/> RETRY VOICE</button>}
          {activeIndex < suspects.length - 1 && <button className="cast-primary" onClick={continueSequence}><SkipForward size={15}/> NEXT SUBJECT <ChevronRight size={14}/></button>}
          {activeIndex === suspects.length - 1 && completed.includes(current.id) && <button className="cast-primary" onClick={onContinue}>ENTER CASE BRIEFING <ChevronRight size={15}/></button>}
        </>}
        {phase === 'complete' && <button className="cast-primary" onClick={onContinue}><Check size={16}/> ENTER CASE BRIEFING <ChevronRight size={15}/></button>}
        <button className="cast-skip" onClick={stopAndContinue}>SKIP TO CASE BRIEFING</button>
      </div>
    </footer>
  </main>;
}
