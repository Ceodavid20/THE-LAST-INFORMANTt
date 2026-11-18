type DialogueReply = { caseId: string; text: string; source: 'ai' | 'scripted' };

export async function requestDialogue(path: '/api/interrogate' | '/api/introduction', input: { caseId: string; [key: string]: unknown }, signal?: AbortSignal): Promise<DialogueReply> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 30_000);
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input), signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'The interview channel is unavailable. Try again.';
      throw new Error(message);
    }
    if (!data || typeof data !== 'object' || !('caseId' in data) || data.caseId !== input.caseId
      || !('text' in data) || typeof data.text !== 'string' || !data.text.trim()
      || !('source' in data) || data.source !== 'ai' && data.source !== 'scripted') {
      throw new Error('The interview channel returned an incomplete reply. Please retry your question.');
    }
    return { caseId: data.caseId as string, text: data.text.trim(), source: data.source };
  } catch (error) {
    if (timedOut) throw new Error('The subject took too long to respond. Please retry your question.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
