import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestDialogue } from './dialogue';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('dialogue requests', () => {
  it('returns a validated reply for the selected investigation', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ caseId: 'aurora', text: '  I approved the maintenance window.  ', source: 'ai' })));
    vi.stubGlobal('fetch', fetch);
    await expect(requestDialogue('/api/interrogate', { caseId: 'aurora', question: 'What happened?' })).resolves.toEqual({ caseId: 'aurora', text: 'I approved the maintenance window.', source: 'ai' });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ caseId: 'aurora', question: 'What happened?' });
  });

  it.each([
    { caseId: 'aurora', text: '', source: 'ai' },
    { caseId: 'another-case', text: 'An unrelated reply', source: 'ai' },
    { caseId: 'aurora', text: 'Unidentified reply', source: 'unknown' },
  ])('rejects incomplete or unrelated dialogue: %j', async reply => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(reply))));
    await expect(requestDialogue('/api/introduction', { caseId: 'aurora', suspectId: 'elena_cross' })).rejects.toThrow('incomplete reply');
  });

  it('preserves actionable provider errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Groq rate limit reached. Wait briefly, then retry.' }), { status: 429 })));
    await expect(requestDialogue('/api/interrogate', { caseId: 'aurora' })).rejects.toThrow('Groq rate limit reached');
  });

  it('times out a stalled request and aborts its fetch', async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      requestSignal = options.signal as AbortSignal;
      requestSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const request = requestDialogue('/api/interrogate', { caseId: 'aurora' });
    const assertion = expect(request).rejects.toThrow('took too long');
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    expect(requestSignal?.aborted).toBe(true);
  });

  it('cancels a pending request when its investigation is closed', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const controller = new AbortController();
    const request = requestDialogue('/api/interrogate', { caseId: 'aurora' }, controller.signal);
    const assertion = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await assertion;
  });
});
