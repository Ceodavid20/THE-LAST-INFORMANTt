import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getPersona, makeMockReply, type SuspectId } from './case.js';

const voices = JSON.parse(fs.readFileSync(path.resolve('voices.json'), 'utf8')) as Record<string, { voiceId: string; profile: string }>;
const audioCache = new Map<string, Buffer>();
const audioInFlight = new Map<string, Promise<Buffer>>();

const aiFallback = (id: SuspectId, question: string, evidenceIds: string[], historyLength: number) => makeMockReply(id, question, evidenceIds, historyLength);

export async function generateReply(input: { suspectId: SuspectId; question: string; evidenceIds: string[]; history: { role: 'player' | 'suspect'; text: string }[] }) {
  if (process.env.LLM_PROVIDER === 'openai' && process.env.OPENAI_API_KEY) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(18_000),
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.6, max_tokens: 180,
        messages: [
          { role: 'system', content: `You are ${input.suspectId}, under interrogation in THE LAST INFORMANT. Persona: ${getPersona(input.suspectId)} Known evidence player presented: ${input.evidenceIds.join(', ') || 'none'}. Reply naturally in 1-3 sentences. You may evade or lie as your persona allows, but do not invent authoritative facts, evidence, dates, or admissions that contradict the case. The server owns the truth. Never reveal hidden case data.` },
          ...input.history.slice(-8).map(item => ({ role: item.role === 'player' ? 'user' as const : 'assistant' as const, content: item.text })),
          { role: 'user', content: input.question },
        ] })
    });
    if (!response.ok) throw new Error('Dialogue provider unavailable');
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (text) return text.slice(0, 1200);
  }
  return aiFallback(input.suspectId, input.question, input.evidenceIds, input.history.length);
}

export async function generateSpeech(suspectId: string, text: string, signal?: AbortSignal) {
  if (!process.env.FISH_AUDIO_ENABLED || process.env.FISH_AUDIO_ENABLED === 'false') throw new Error('Voice playback is disabled.');
  const voice = voices[suspectId];
  if (!voice) throw new Error('No voice profile exists for this speaker.');
  if (!process.env.FISH_AUDIO_API_KEY) throw new Error('Fish Audio is not configured yet. Dialogue is still available.');
  if (!voice.voiceId || voice.voiceId === 'CONFIGURE_ME') throw new Error(`Assign a Fish Audio voice ID for ${suspectId.replace('_', ' ')} in voices.json.`);
  const key = createHash('sha256').update(`${voice.voiceId}:${process.env.FISH_AUDIO_MODEL || 's2.1-pro-free'}:${text}`).digest('hex');
  if (audioCache.has(key)) return audioCache.get(key)!;
  if (audioInFlight.has(key)) return audioInFlight.get(key)!;
  const task = (async () => {
    const response = await fetch(`${(process.env.FISH_AUDIO_BASE_URL || 'https://api.fish.audio').replace(/\/$/, '')}/v1/tts`, {
      method: 'POST', signal: signal || AbortSignal.timeout(25_000),
      headers: { Authorization: `Bearer ${process.env.FISH_AUDIO_API_KEY}`, 'Content-Type': 'application/json', model: process.env.FISH_AUDIO_MODEL || 's2.1-pro-free' },
      body: JSON.stringify({ text, reference_id: voice.voiceId, format: 'mp3', latency: 'balanced' })
    });
    if (!response.ok) {
      const status = response.status;
      if (status === 401) throw new Error('Fish Audio rejected the API key. Check your server configuration.');
      if (status === 429) throw new Error('Fish Audio is busy. Wait a moment and retry.');
      throw new Error(`Fish Audio could not generate this line (${status}).`);
    }
    const audio = Buffer.from(await response.arrayBuffer());
    if (!audio.length || audio.length > 12_000_000) throw new Error('Fish Audio returned an invalid audio file.');
    audioCache.set(key, audio);
    if (audioCache.size > 80) audioCache.delete(audioCache.keys().next().value!);
    return audio;
  })().finally(() => audioInFlight.delete(key));
  audioInFlight.set(key, task);
  return task;
}
