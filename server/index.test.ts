import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from './index.js';
import { investigations } from './investigations.js';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(() => vi.stubEnv('LLM_PROVIDER', 'mock'));
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => { if (server?.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

const post = (route: string, body: unknown) => fetch(`${baseUrl}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('case API', () => {
  it('lists available cases without exposing their answers', async () => {
    const response = await fetch(`${baseUrl}/api/cases`);
    const catalog = await response.json();
    expect(response.status).toBe(200);
    expect(catalog.cases).toHaveLength(4);
    expect(catalog.cases.some((investigation: { id: string }) => investigation.id === catalog.dailyCaseId)).toBe(true);
    expect(JSON.stringify(catalog)).not.toContain('culprit');
    expect(JSON.stringify(catalog)).not.toContain('truth');
  });

  it.each(investigations)('loads $id and grades its own culprit rather than the Aurora answer', async investigation => {
    const response = await fetch(`${baseUrl}/api/case?caseId=${investigation.id}`);
    const publicCase = await response.json();
    expect(publicCase.id).toBe(investigation.id);
    expect(publicCase.evidence.map((item: { id: string }) => item.id)).toEqual(investigation.evidence.map(item => item.id));
    expect(publicCase).not.toHaveProperty('culprit');
    expect(publicCase).not.toHaveProperty('truth');

    const correct = await post('/api/accuse', { caseId: investigation.id, suspectId: investigation.culprit });
    expect(await correct.json()).toMatchObject({ caseId: investigation.id, correct: true, reveal: investigation.truth });
    const wrongSuspect = investigation.suspects.find(person => person.id !== investigation.culprit)!.id;
    const wrong = await post('/api/accuse', { caseId: investigation.id, suspectId: wrongSuspect });
    expect(await wrong.json()).toMatchObject({ caseId: investigation.id, correct: false, culprit: investigation.culprit });

    const timeout = await post('/api/timeout', { caseId: investigation.id });
    expect(await timeout.json()).toMatchObject({ caseId: investigation.id, timedOut: true, culprit: investigation.culprit, reveal: investigation.truth });
  });

  it.each(investigations)('routes $id interviews and introductions to its own characters', async investigation => {
    const interview = await post('/api/interrogate', { caseId: investigation.id, suspectId: 'victor_hale', question: 'What happened?', evidenceIds: [investigation.evidence[0].id], history: [] });
    expect(interview.status).toBe(200);
    expect(await interview.json()).toMatchObject({ caseId: investigation.id, source: 'scripted', text: investigation.mockReply('victor_hale', 'What happened?', [investigation.evidence[0].id], 0) });
    const introduction = await post('/api/introduction', { caseId: investigation.id, suspectId: 'victor_hale' });
    expect(introduction.status).toBe(200);
    expect(await introduction.json()).toMatchObject({ caseId: investigation.id, text: investigation.suspects.find(person => person.id === 'victor_hale')!.introduction });
  });

  it('rejects unknown cases, missing case IDs, and evidence from another case', async () => {
    expect((await fetch(`${baseUrl}/api/case?caseId=missing`)).status).toBe(404);
    expect((await post('/api/accuse', { suspectId: 'elena_cross' })).status).toBe(400);
    expect((await post('/api/timeout', { caseId: 'missing' })).status).toBe(400);
    const response = await post('/api/interrogate', { caseId: 'blackout', suspectId: 'victor_hale', question: 'Explain this evidence.', evidenceIds: ['access-log'] });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'Present evidence from the active case only.' });
  });
});
