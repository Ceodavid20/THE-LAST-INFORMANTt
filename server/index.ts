import 'dotenv/config';
import express from 'express';
import { z } from 'zod';
import { evidence, hiddenCase, suspects } from './case.js';
import { generateReply, generateSpeech } from './services.js';

const app = express();
app.use(express.json({ limit: '16kb' }));
const throttle = new Map<string, { count: number; reset: number }>();
app.use('/api', (req, res, next) => {
  const key = req.ip || 'local'; const now = Date.now(); const current = throttle.get(key);
  if (!current || current.reset < now) throttle.set(key, { count: 1, reset: now + 60_000 });
  else if (++current.count > 40) return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  next();
});
app.get('/api/health', (_req, res) => res.json({ ok: true, audioConfigured: Boolean(process.env.FISH_AUDIO_API_KEY), audioEnabled: process.env.FISH_AUDIO_ENABLED !== 'false', dialogueMode: process.env.LLM_PROVIDER === 'openai' && process.env.OPENAI_API_KEY ? 'provider' : 'case-engine' }));
app.get('/api/case', (_req, res) => res.json({ title: 'THE LAST INFORMANT', company: 'NEXORA SYSTEMS', suspects, evidence, timeline: hiddenCase.timeline, briefing: 'At 22:03, a confidential AI research project called AURORA appeared on an external forum. Six people had access. One of them opened the door, created the blind spot, and arranged the exit. Find the chain.' }));

const interrogationSchema = z.object({ suspectId: z.enum(['marcus_vane','elena_cross','victor_hale','nadia_sterling','adrian_cole','silas_reed']), question: z.string().trim().min(2).max(500), evidenceIds: z.array(z.string().max(50)).max(8).default([]), history: z.array(z.object({ role: z.enum(['player','suspect']), text: z.string().max(1200) })).max(12).default([]) });
app.post('/api/interrogate', async (req, res) => {
  const parsed = interrogationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a question between 2 and 500 characters.' });
  try { res.json({ text: await generateReply(parsed.data) }); }
  catch (error) { console.error('Dialogue service failed:', error instanceof Error ? error.message : 'unknown error'); res.status(502).json({ error: 'The interview channel is unavailable. Try again.' }); }
});

app.post('/api/speech', async (req, res) => {
  const parsed = z.object({ suspectId: z.string().max(40), text: z.string().trim().min(1).max(1200) }).safeParse(req.body);
  if (!parsed.success || !suspects.some(person => person.id === parsed.data.suspectId) && parsed.data.suspectId !== 'narrator') return res.status(400).json({ error: 'Invalid speaker or dialogue.' });
  const controller = new AbortController(); res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  try { const audio = await generateSpeech(parsed.data.suspectId, parsed.data.text, controller.signal); res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=86400' }).send(audio); }
  catch (error) { console.error('Speech service failed:', error instanceof Error ? error.message : 'unknown error'); res.status(503).json({ error: error instanceof Error ? error.message : 'Audio is unavailable. Text dialogue remains available.' }); }
});

app.post('/api/accuse', (req, res) => {
  const parsed = z.object({ suspectId: z.enum(['marcus_vane','elena_cross','victor_hale','nadia_sterling','adrian_cole','silas_reed']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose a suspect before filing your accusation.' });
  const correct = parsed.data.suspectId === hiddenCase.culprit;
  res.json({ correct, culprit: hiddenCase.culprit, reveal: hiddenCase.truth });
});

app.post('/api/timeout', (_req, res) => {
  res.json({ timedOut: true, correct: false, culprit: hiddenCase.culprit, reveal: hiddenCase.truth });
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`Investigation API listening on http://localhost:${port}`));
