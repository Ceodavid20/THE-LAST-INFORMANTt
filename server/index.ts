import 'dotenv/config';
import express from 'express';
import { z } from 'zod';
import { suspects } from './case.js';
import { findInvestigation, getDailyInvestigation, investigations, publicInvestigation } from './investigations.js';
import { generateIntroduction, generateReply, generateSpeech, getDialogueConfiguration } from './services.js';

export const app = express();
app.use(express.json({ limit: '16kb' }));
const throttle = new Map<string, { count: number; reset: number }>();
app.use('/api', (req, res, next) => {
  const key = req.ip || 'local'; const now = Date.now(); const current = throttle.get(key);
  if (!current || current.reset < now) throttle.set(key, { count: 1, reset: now + 60_000 });
  else if (++current.count > 40) return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  next();
});
app.get('/api/health', (_req, res) => {
  const dialogue = getDialogueConfiguration();
  res.json({ ok: true, audioConfigured: Boolean(process.env.FISH_AUDIO_API_KEY), audioEnabled: process.env.FISH_AUDIO_ENABLED !== 'false', dialogueMode: dialogue.provider === 'mock' ? 'case-engine' : dialogue.configured ? 'provider' : 'unavailable', dialogueProvider: dialogue.provider, dialogueModel: dialogue.model });
});
app.get('/api/cases', (_req, res) => {
  const daily = getDailyInvestigation();
  res.json({ dailyCaseId: daily.investigation.id, date: daily.date, cases: investigations.map(investigation => {
    const { id, number, title, category, briefing, location } = investigation;
    return { id, number, title, category, briefing, location, durationSeconds: 900, suspectCount: investigation.suspects.length, evidenceCount: investigation.evidence.length };
  }) });
});
app.get('/api/case', (req, res) => {
  const investigation = findInvestigation(typeof req.query.caseId === 'string' ? req.query.caseId : getDailyInvestigation().investigation.id);
  if (!investigation) return res.status(404).json({ error: 'Investigation not found. Choose a case from the archive.' });
  res.json(publicInvestigation(investigation));
});

const caseIdSchema = z.string().refine(caseId => Boolean(findInvestigation(caseId)));
const suspectIdSchema = z.enum(['marcus_vane','elena_cross','victor_hale','nadia_sterling','adrian_cole','silas_reed']);
const interrogationSchema = z.object({ caseId: caseIdSchema, suspectId: suspectIdSchema, question: z.string().trim().min(2).max(500), evidenceIds: z.array(z.string().max(50)).max(8).default([]), history: z.array(z.object({ role: z.enum(['player','suspect']), text: z.string().max(1200) })).max(12).default([]) });
app.post('/api/interrogate', async (req, res) => {
  const parsed = interrogationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose a valid case and enter a question between 2 and 500 characters.' });
  const investigation = findInvestigation(parsed.data.caseId)!;
  if (parsed.data.evidenceIds.some(evidenceId => !investigation.evidence.some(item => item.id === evidenceId))) return res.status(400).json({ error: 'Present evidence from the active case only.' });
  try { res.json(await generateReply(parsed.data)); }
  catch (error) {
    const detail = error instanceof Error ? error.message : '';
    const message = detail.startsWith('OpenAI ') || detail.startsWith('Groq ') || detail.startsWith('Xingchi ') || detail.startsWith('Dialogue provider ') ? detail : 'The interview channel is unavailable. Try again.';
    console.error('Dialogue service failed:', message);
    res.status(502).json({ error: message });
  }
});

app.post('/api/introduction', async (req, res) => {
  const parsed = interrogationSchema.pick({ caseId: true, suspectId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose a valid case and subject.' });
  try { res.json(await generateIntroduction(parsed.data.suspectId, parsed.data.caseId)); }
  catch (error) {
    const detail = error instanceof Error ? error.message : '';
    const message = /^(OpenAI |Groq |Xingchi |Dialogue provider )/.test(detail) ? detail : 'The introduction channel is unavailable. Try again.';
    console.error('Introduction service failed:', message);
    res.status(502).json({ error: message });
  }
});

app.post('/api/speech', async (req, res) => {
  const parsed = z.object({ suspectId: z.string().max(40), text: z.string().trim().min(1).max(1200) }).safeParse(req.body);
  if (!parsed.success || !suspects.some(person => person.id === parsed.data.suspectId) && parsed.data.suspectId !== 'narrator') return res.status(400).json({ error: 'Invalid speaker or dialogue.' });
  const controller = new AbortController(); res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  try { const audio = await generateSpeech(parsed.data.suspectId, parsed.data.text, controller.signal); res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=86400' }).send(audio); }
  catch (error) { console.error('Speech service failed:', error instanceof Error ? error.message : 'unknown error'); res.status(503).json({ error: error instanceof Error ? error.message : 'Audio is unavailable. Text dialogue remains available.' }); }
});

app.post('/api/accuse', (req, res) => {
  const parsed = z.object({ caseId: caseIdSchema, suspectId: suspectIdSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose a valid case and suspect before filing your accusation.' });
  const investigation = findInvestigation(parsed.data.caseId)!;
  const correct = parsed.data.suspectId === investigation.culprit;
  res.json({ caseId: investigation.id, correct, culprit: investigation.culprit, reveal: investigation.truth });
});

app.post('/api/timeout', (req, res) => {
  const parsed = z.object({ caseId: caseIdSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose a valid case.' });
  const investigation = findInvestigation(parsed.data.caseId)!;
  res.json({ caseId: investigation.id, timedOut: true, correct: false, culprit: investigation.culprit, reveal: investigation.truth });
});

const port = Number(process.env.PORT || 8787);
if (process.env.NODE_ENV !== 'test') app.listen(port, () => console.log(`Investigation API listening on http://localhost:${port}`));
