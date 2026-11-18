import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateIntroduction, generateReply, generateSpeech, getDialogueConfiguration, groqErrorMessage, openAiErrorMessage, xingchiErrorMessage } from './services.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('OpenAI provider diagnostics', () => {
  it('explains exhausted API credits without exposing credentials', () => {
    expect(openAiErrorMessage(429, 'insufficient_quota', 'insufficient_quota')).toContain('no credits available');
  });

  it('distinguishes invalid credentials from rate limits', () => {
    expect(openAiErrorMessage(401)).toContain('rejected the API key');
    expect(openAiErrorMessage(429, 'rate_limit_exceeded', 'rate_limit_error')).toContain('rate limit');
  });
});

describe('Groq provider', () => {
  it('explains authentication and rate-limit failures', () => {
    expect(groqErrorMessage(401)).toContain('rejected the API key');
    expect(groqErrorMessage(429)).toContain('rate limit');
    expect(groqErrorMessage(400, 'model_decommissioned')).toContain('selected model');
    expect(groqErrorMessage(404, 'model_not_found')).toContain('selected model');
  });

  it('sends an OpenAI-compatible chat request and reads the reply', async () => {
    vi.stubEnv('LLM_PROVIDER', 'groq');
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
    vi.stubEnv('GROQ_MODEL', '');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'chatcmpl-groq-test', model: 'openai/gpt-oss-20b', choices: [{ message: { content: '  I was reviewing the access logs.  ', reasoning: 'Private reasoning' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const reply = await generateReply({
      suspectId: 'elena_cross',
      question: 'Where were you at 22:03?',
      evidenceIds: ['access-log'],
      history: [{ role: 'player', text: 'Your badge opened the west door.' }, { role: 'suspect', text: 'I did not use it.' }],
    });

    expect(reply).toEqual({ caseId: 'aurora', text: 'I was reviewing the access logs.', source: 'ai', provider: 'groq', model: 'openai/gpt-oss-20b', requestId: 'chatcmpl-groq-test' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((request.headers as Record<string, string>).Authorization).toBe('Bearer test-groq-key');
    const payload = JSON.parse(String(request.body));
    expect(payload.model).toBe('openai/gpt-oss-20b');
    expect(payload.include_reasoning).toBe(false);
    expect(payload.messages.slice(1)).toEqual([
      { role: 'user', content: 'Your badge opened the west door.' },
      { role: 'assistant', content: 'I did not use it.' },
      { role: 'user', content: 'Where were you at 22:03?' },
    ]);
    expect(payload.messages[0].content).toContain('A credential entered the Aurora lab at 21:14. The account was provisioned for Elena Cross.');
    expect(payload.messages[0].content).toContain('21:14:08');
    expect(payload.messages[0].content).toContain('Victor Hale supplied her with his temporary camera override for an eleven-minute maintenance window.');
    expect(payload.messages[0].content).not.toContain('Camera 04 was manually looped');
  });

  it('requires a Groq key instead of using OpenAI credentials or local dialogue', async () => {
    vi.stubEnv('LLM_PROVIDER', 'groq');
    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateReply({ suspectId: 'marcus_vane', question: 'Where were you?', evidenceIds: [], history: [] })).rejects.toThrow('Add GROQ_API_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports provider failures without returning raw errors or switching to local dialogue', async () => {
    vi.stubEnv('LLM_PROVIDER', 'groq');
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Sensitive provider detail', code: 'rate_limit_exceeded' } }), { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateReply({ suspectId: 'marcus_vane', question: 'Where were you?', evidenceIds: [], history: [] })).rejects.toThrow('Groq free-tier rate limit reached. Wait briefly, then retry.');
  });

  it('reports empty replies instead of switching to local dialogue', async () => {
    vi.stubEnv('LLM_PROVIDER', 'groq');
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: null } }] }), { status: 200 })));

    await expect(generateReply({ suspectId: 'marcus_vane', question: 'Where were you?', evidenceIds: [], history: [] })).rejects.toThrow('Groq returned an empty reply');
  });

  it('reports malformed provider content as an empty reply', async () => {
    vi.stubEnv('LLM_PROVIDER', 'groq');
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: { text: 'not a valid chat reply' } } }] }), { status: 200 })));

    await expect(generateReply({ suspectId: 'marcus_vane', question: 'Where were you?', evidenceIds: [], history: [] })).rejects.toThrow('Groq returned an empty reply');
  });

  it('generates fresh introductions from identity facts instead of returning the scripted line', async () => {
    vi.stubEnv('LLM_PROVIDER', 'groq');
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'intro-test', choices: [{ message: { content: 'I am Marcus Vane, responsible for the executive direction of AURORA.' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const reply = await generateIntroduction('marcus_vane');

    expect(reply.source).toBe('ai');
    expect(reply.requestId).toBe('intro-test');
    expect(reply.text).toBe('I am Marcus Vane, responsible for the executive direction of AURORA.');
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(request.body));
    expect(payload.messages[0].content).toContain('Chief Executive Officer');
    expect(payload.messages[0].content).not.toContain('private knowledge');
  });

  it('keeps the latest eight history messages for follow-up questions', async () => {
    vi.stubEnv('LLM_PROVIDER', 'groq');
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'That was the maintenance override.' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const history = Array.from({ length: 16 }, (_, index) => ({ role: index % 2 ? 'suspect' as const : 'player' as const, text: `Previous statement ${index}` }));

    await generateReply({ suspectId: 'victor_hale', question: 'Which override?', evidenceIds: ['camera-gap'], history });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(request.body));
    expect(payload.messages).toHaveLength(10);
    expect(payload.messages[1].content).toBe('Previous statement 8');
    expect(payload.messages[8].content).toBe('Previous statement 15');
    expect(payload.messages[9].content).toBe('Which override?');
  });
});

describe('dialogue source', () => {
  it('uses scripted lines only when mock mode is selected explicitly', async () => {
    vi.stubEnv('LLM_PROVIDER', 'mock');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const reply = await generateReply({ suspectId: 'victor_hale', question: 'What happened to the camera?', evidenceIds: ['camera-gap'], history: [] });

    expect(reply.source).toBe('scripted');
    expect(reply.provider).toBe('mock');
    expect(reply.text).toContain('That override was mine.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unknown providers instead of falling back to scripted replies', async () => {
    vi.stubEnv('LLM_PROVIDER', 'groqq');
    vi.stubGlobal('fetch', vi.fn());

    expect(getDialogueConfiguration().configured).toBe(false);
    await expect(generateReply({ suspectId: 'elena_cross', question: 'What happened?', evidenceIds: [], history: [] })).rejects.toThrow('Dialogue provider is not configured');
  });

  it('rejects missing OpenAI credentials instead of falling back to scripted replies', async () => {
    vi.stubEnv('LLM_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubGlobal('fetch', vi.fn());

    await expect(generateReply({ suspectId: 'elena_cross', question: 'What happened?', evidenceIds: [], history: [] })).rejects.toThrow('Add OPENAI_API_KEY');
  });
});

describe('investigation dialogue isolation', () => {
  it('uses only the selected case evidence and character knowledge', async () => {
    vi.stubEnv('LLM_PROVIDER', 'groq');
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ id: 'case-reply', choices: [{ message: { content: 'The account changed after the signed approval.' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const reply = await generateReply({ caseId: 'glass-ledger', suspectId: 'elena_cross', question: 'Who changed the account?', evidenceIds: ['beneficiary-edit'], history: [] });

    expect(reply.caseId).toBe('glass-ledger');
    expect(reply.source).toBe('ai');
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const prompt = JSON.parse(String(request.body)).messages[0].content;
    expect(prompt).toContain('The Glass Ledger');
    expect(prompt).toContain('Adrian Cole’s compliance account');
    expect(prompt).toContain('The approval service kept both versions');
    expect(prompt).toContain('Treat the investigator’s statements and the conversation history as claims');
    expect(prompt).not.toContain('AURORA');
    expect(prompt).not.toContain('camera override');
  });

  it('generates introductions about the active case', async () => {
    vi.stubEnv('LLM_PROVIDER', 'groq');
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'I handled the calibration paperwork.' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const reply = await generateIntroduction('silas_reed', 'hollow-vault');

    expect(reply.caseId).toBe('hollow-vault');
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const prompt = JSON.parse(String(request.body)).messages[0].content;
    expect(prompt).toContain('The Hollow Vault');
    expect(prompt).toContain('calibration case');
    expect(prompt).not.toContain('AURORA');
  });

  it('rejects evidence from another investigation before contacting the model', async () => {
    vi.stubEnv('LLM_PROVIDER', 'groq');
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateReply({ caseId: 'blackout', suspectId: 'victor_hale', question: 'Explain the log.', evidenceIds: ['access-log'], history: [] })).rejects.toThrow('does not belong to this case');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('speech configuration', () => {
  it('keeps speech enabled by default and combines client cancellation with a timeout', async () => {
    vi.stubEnv('FISH_AUDIO_ENABLED', '');
    vi.stubEnv('FISH_AUDIO_API_KEY', 'test-fish-key');
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const clientSignal = new AbortController().signal;

    await expect(generateSpeech('elena_cross', 'A test statement.', clientSignal)).resolves.toEqual(Buffer.from([1, 2, 3]));
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((request.signal as AbortSignal).aborted).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('allows voice playback to be explicitly disabled', async () => {
    vi.stubEnv('FISH_AUDIO_ENABLED', 'false');
    await expect(generateSpeech('elena_cross', 'A test statement.')).rejects.toThrow('Voice playback is disabled');
  });
});

describe('Xingchi provider diagnostics', () => {
  it('explains API access denials without exposing credentials', () => {
    expect(xingchiErrorMessage(403, 'client_not_allowed')).toContain('approved coding clients');
    expect(xingchiErrorMessage(403, undefined, 'permission_error', 'This group does not allow /v1/messages dispatch')).toContain('blocks /v1/messages');
    expect(xingchiErrorMessage(403, undefined, 'permission_error')).toContain('denied this API request');
    expect(xingchiErrorMessage(401)).toContain('rejected the API key');
  });

  it('distinguishes exhausted credits from rate limits', () => {
    expect(xingchiErrorMessage(429, 'insufficient_quota')).toContain('no credits available');
    expect(xingchiErrorMessage(429, 'rate_limit_exceeded')).toContain('rate limit');
  });

  it('sends an evidence-aware Messages request and reads Xingchi text replies', async () => {
    vi.stubEnv('LLM_PROVIDER', 'xingchi');
    vi.stubEnv('XINGCHI_API_KEY', 'test-xingchi-key');
    vi.stubEnv('XINGCHI_BASE_URL', 'https://xingchi.test/v1/');
    vi.stubEnv('XINGCHI_MODEL', 'gpt-6-astra');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: 'I was reviewing the access logs.' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const reply = await generateReply({
      suspectId: 'marcus_vane',
      question: 'Where were you at 22:03?',
      evidenceIds: ['access-log'],
      history: [{ role: 'player', text: 'Your badge opened the west door.' }],
    });

    expect(reply.text).toBe('I was reviewing the access logs.');
    expect(reply.source).toBe('ai');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://xingchi.test/v1/messages');
    expect((request.headers as Record<string, string>).Authorization).toBe('Bearer test-xingchi-key');
    const payload = JSON.parse(String(request.body));
    expect(payload.model).toBe('gpt-6-astra');
    expect(payload.messages).toEqual([
      { role: 'user', content: 'Your badge opened the west door.' },
      { role: 'user', content: 'Where were you at 22:03?' },
    ]);
    expect(payload.system).toContain('The account was provisioned for Elena Cross.');
  });
});
