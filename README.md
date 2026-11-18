# THE LAST INFORMANT

A browser based investigation thriller with four independent cases at NEXORA SYSTEMS. Choose a research leak, sabotage, financial fraud, or prototype theft. The case engine and hidden solutions run on the server. The React client collects evidence, interrogates six recurring characters, assembles each case's event timeline, and accepts a final accusation.

## Investigation archive

The home screen offers a daily investigation and the full case archive:

| Case | Incident |
| --- | --- |
| AURORA Research Leak | Trace a research archive through a camera blind spot, lab access, and consultant relay. |
| The Midnight Blackout | Distinguish an authorized server restart from deliberate recovery sabotage. |
| The Glass Ledger | Follow a supplier payment through a substituted beneficiary and suppressed audit warning. |
| The Hollow Vault | Reconstruct a prototype swap using custody records, seal numbers, and dispatch scans. |

Each case has a different culprit, evidence, timeline, character knowledge, and final reveal. The daily feature rotates through the four cases at midnight in `Africa/Lagos`; every case remains available for immediate play. Completed case IDs are remembered in local storage on the device. Use **CASE ARCHIVE** to switch cases or **CHOOSE ANOTHER CASE** after a reveal. Switching starts a fresh timer, transcript, evidence file, and roll call and stops the previous case's audio and requests.

## Architecture

- React and TypeScript frontend, served by Vite in development.
- Express TypeScript API for case data, evidence aware interrogation, accusations, and audio.
- Deterministic case engine owns each case's culprit, timeline, and evidence. Dialogue uses case-specific character knowledge and presented records through OpenAI/Groq/Xingchi, or local testimony when `LLM_PROVIDER=mock` is explicitly selected. The language model does not choose the culprit or grade accusations.
- Fish Audio TTS runs only on the server. Requests use the official `POST /v1/tts` endpoint and return MP3 bytes. Audio is cached in memory by voice ID, model, and exact dialogue.
- Before the case briefing, an animated cast roll-call shows original vector mugshots, generates each suspect's identity statement with the selected dialogue provider, speaks the generated text through their assigned Fish Audio voice, and moves the character's mouth from the playback audio signal. No real-person photos are used.
- The AURORA Signal rises with interview activity, filed evidence, and the final five-minute window. It raises the procedural suspense sound bed. Dark/light appearance and room ambience are separately toggleable and remembered on the device.
- No database is required. Active investigation progress is held in client memory and resets when the page is refreshed; completed case IDs persist locally on the device.

## Visual asset credit

The interrogation-room background uses a photograph by [Nesnad](https://commons.wikimedia.org/wiki/User:Nesnad), [Japanese police interrogation room - movie set - October 2014](https://commons.wikimedia.org/wiki/File:Japanese_police_interrogation_room_-_movie_set_-_October_2014.jpg), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The local image is darkened and cropped for the game interface.

## Requirements and setup

Node.js 20 or later and npm are required.

```bash
npm install
cp .env.example .env
npm run dev
```

The default dialogue provider is Groq. Create a key in the [Groq console](https://console.groq.com/keys), add it to `.env` as `GROQ_API_KEY`, and restart `npm run dev` after changing `.env`. The default model is `openai/gpt-oss-20b`; free-tier requests are subject to [Groq's model and token limits](https://console.groq.com/docs/rate-limits). Missing credentials and provider failures show an error instead of switching to local dialogue.

Interview prompts include the active case's character knowledge, full text of presented evidence, and recent conversation history. Successful AI replies are labeled `AI GENERATED`; the API includes the case ID, provider, model, and upstream request ID when supplied. `/api/health` reports the active provider and model. `/api/cases` lists public case summaries and the daily feature; `/api/case?caseId=...` loads a case without its solution. Interviews, introductions, accusations, and timeouts require the selected `caseId`; evidence from another case is rejected. Scripted responses are available only when `LLM_PROVIDER=mock` is explicitly selected. Refresh the page after updating the app to open the archive.

Open the Vite URL shown in the terminal (normally http://localhost:5173). The API listens on http://localhost:8787. The development server proxies `/api` calls to the API.

For checks:

```bash
npm test
npm run typecheck
npm run build
```

## Fish Audio voices

1. Create a Fish Audio account and API key at [Fish Audio API Keys](https://fish.audio/app/api-keys).
2. Put the key in the server-only `.env` file as `FISH_AUDIO_API_KEY=...`. Do not use a `VITE_` variable or put this key in browser code.
3. Choose an authorized voice from the Fish Audio Voice Library, or create a voice you have permission to use. Copy its voice model ID (the `reference_id`). Do not clone or imitate a real person without authorization.
4. Replace each `CONFIGURE_ME` value in `voices.json` with the selected model ID. Each profile has a character description to help match the voice. Configure the `narrator` entry as well.
5. Leave `FISH_AUDIO_MODEL=s2.1-pro-free` for development, or choose a model available to your account. `FISH_AUDIO_BASE_URL` defaults to `https://api.fish.audio` and `FISH_AUDIO_ENABLED` defaults to true.
6. Restart the server. In the interrogation room, ask a question with Auto Voice enabled, or use PLAY VOICE on a generated response. The displayed text is the exact text sent to speech generation.

The official API uses `Authorization: Bearer <key>`, a `model` header, and JSON including `text`, `reference_id`, and `format`. Current docs list MP3, WAV, PCM, and Opus. This integration requests MP3. Since the voice IDs and credentials are account-specific, no voice is preselected. Without a key or assigned voice, text interrogation remains playable and the response includes a retryable audio state.

To use local case-engine responses, set `LLM_PROVIDER=mock`. To enable OpenAI dialogue, set `LLM_PROVIDER=openai`, add `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in `.env`. To use Groq's free tier, set `LLM_PROVIDER=groq`, add `GROQ_API_KEY`, and optionally set `GROQ_MODEL` (the default is `openai/gpt-oss-20b`). To use Xingchi, set `LLM_PROVIDER=xingchi`, add `XINGCHI_API_KEY`, and optionally set `XINGCHI_BASE_URL` and `XINGCHI_MODEL`. The Xingchi defaults are `https://api.xingchiapi.com/v1` and `gpt-6-astra`. For backwards compatibility, `OPENAI_API_KEY` is also read as the Xingchi key when the provider is set to `xingchi`; move that value to `XINGCHI_API_KEY` when convenient. The language model only drafts suspect replies; deterministic case facts and the final answer remain server-owned.

## Audio and accessibility

Dialogue text is always displayed. Sound can be toggled globally from the header or audio panel. Auto Voice controls whether new replies play automatically; when disabled, speech still generates for manual playback. The audio panel has a volume slider. Errors do not block the interview. In development, missing credentials use browser speech synthesis and are labeled `DEVELOPMENT MOCK`; production shows the Fish Audio error and allows retry. Browser playback may require the player's first tap/click due to autoplay policies.

## Security and deployment

`.env` is ignored by git. The server validates input lengths, limits requests, applies timeouts, limits generated audio size, and does not log credentials. The API currently rate limits to 40 requests per minute per IP. Memory audio cache clears on server restart and caps at 80 items.

For production, build the frontend with `npm run build`, run the API with `npm run dev:server` or compile/deploy the server with your Node process manager, and serve `dist/` from a static host or reverse proxy. Set secrets in the deployment provider's environment settings. Configure HTTPS, origin restrictions, a persistent shared rate limiter, and production logging before public launch. This prototype does not persist game sessions or provide user accounts.

## Troubleshooting

- `Fish Audio is not configured yet`: add a server-side key to `.env` and restart.
- `Assign a Fish Audio voice ID`: update that speaker in `voices.json` and restart.
- `OpenAI API has no credits available`: add API billing/credits or raise the project's spend limit in the OpenAI Platform. This is separate from having a valid API key.
- `Groq free-tier rate limit reached`: wait for the Groq rate limit window to reset, or use the local case engine with `LLM_PROVIDER=mock`.
- Xingchi `403 client_not_allowed` or `/v1/messages dispatch`: this key group blocks custom server calls. Use a Xingchi group/key that allows app API requests, or select another provider.
- Fish Audio `401`: check the key. `429`: wait and retry. Other provider errors are shown without stopping text gameplay.
- Case server unavailable: confirm both processes are running with `npm run dev` and port 8787 is free.
- Autoplay blocked: use the manual PLAY VOICE control after interacting with the page.

## Fish Audio documentation

- [Text-to-Speech API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech)
- [Text-to-Speech overview and request examples](https://docs.fish.audio/features/text-to-speech)
- [API quick start](https://docs.fish.audio/developer-guide/getting-started/quickstart)
