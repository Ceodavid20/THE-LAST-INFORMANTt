let context: AudioContext | null = null;
let master: GainNode | null = null;
let sources: AudioScheduledSourceNode[] = [];
let roomFilter: BiquadFilterNode | null = null;
let tension = 0.16;
let isEnabled = false;

function applyAtmosphere() {
  if (!context || !master) return;
  const now = context.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(isEnabled ? 0.075 + tension * 0.12 : 0, now, isEnabled ? 1.4 : 0.45);
  if (roomFilter) roomFilter.frequency.setTargetAtTime(110 + tension * 390, now, 1.8);
}

function createSoundBed() {
  context = new AudioContext();
  master = context.createGain();
  master.gain.value = 0;
  roomFilter = context.createBiquadFilter();
  roomFilter.type = 'lowpass';
  roomFilter.frequency.value = 170;

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -26;
  compressor.ratio.value = 4;
  master.connect(roomFilter).connect(compressor).connect(context.destination);

  for (const [frequency, waveform, level] of [[42.7, 'sine', 0.27], [43.4, 'sine', 0.18], [64.2, 'triangle', 0.075]] as const) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    oscillator.type = waveform;
    oscillator.frequency.value = frequency;
    gain.gain.value = level;
    oscillator.connect(filter).connect(gain).connect(master);
    oscillator.start();
    sources.push(oscillator);
  }

  const sampleRate = context.sampleRate;
  const buffer = context.createBuffer(1, sampleRate * 4, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i += 1) channel[i] = (Math.random() * 2 - 1) * 0.16;
  const noise = context.createBufferSource();
  const noiseFilter = context.createBiquadFilter();
  const noiseGain = context.createGain();
  noise.buffer = buffer;
  noise.loop = true;
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 260;
  noiseGain.gain.value = 0.22;
  noise.connect(noiseFilter).connect(noiseGain).connect(master);
  noise.start();
  sources.push(noise);
}

export async function setAtmosphereEnabled(enabled: boolean) {
  if (!enabled && (!context || !master)) return;
  if (!context || !master) createSoundBed();
  if (!context || !master) return;
  if (context.state === 'suspended') await context.resume();
  isEnabled = enabled;
  applyAtmosphere();
}

export function setAtmosphereTension(value: number) {
  tension = Math.max(0, Math.min(1, value));
  applyAtmosphere();
}

export function stopAtmosphere() {
  if (!context) return;
  for (const source of sources) {
    try { source.stop(); } catch { /* already stopped */ }
    source.disconnect();
  }
  sources = [];
  void context.close();
  context = null;
  master = null;
  roomFilter = null;
  isEnabled = false;
}
