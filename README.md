# THE LAST INFORMANT

A browser based investigation thriller about the AURORA research leak at NEXORA SYSTEMS. The case engine and hidden solution run on the server. The React client collects evidence, interrogates six suspects, assembles the event timeline, and accepts a final accusation.

## Architecture

- React and TypeScript frontend, served by Vite in development.
- Express TypeScript API for case data, evidence aware interrogation, accusations, and audio.
- Deterministic case engine owns the culprit, timeline, and evidence. Dialogue is either an evidence aware case-engine response (`LLM_PROVIDER=mock`) or a configurable OpenAI Chat Completions provider. The language model never receives the solution.
- Fish Audio TTS runs only on the server. Requests use the official `POST /v1/tts` endpoint and return MP3 bytes. Audio is cached in memory by voice ID, model, and exact dialogue.
- Before the case briefing, an animated cast roll-call shows original vector mugshots, speaks each suspect's identity and relationship through their assigned Fish Audio voice, and moves the character's mouth from the playback audio signal. No real-person photos are used.
- The AURORA Signal rises with interview activity, filed evidence, and the final five-minute window. It raises the procedural suspense sound bed. Dark/light appearance and room ambience are separately toggleable and remembered on the device.
- No database is required for the single browser session. Session progress is held in client memory and resets when the page is refreshed.

## Visual asset credit

The interrogation-room background uses a photograph by [Nesnad](https://commons.wikimedia.org/wiki/User:Nesnad), [Japanese police interrogation room - movie set - October 2014](https://commons.wikimedia.org/wiki/File:Japanese_police_interrogation_room_-_movie_set_-_October_2014.jpg), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The local image is darkened and cropped for the game interface.

## Requirements and setup

Node.js 20 or later and npm are required.

```bash
npm install
cp .env.example .env
npm run dev
```

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

To use local case-engine responses, set `LLM_PROVIDER=mock`. To enable provider-generated dialogue, set `LLM_PROVIDER=openai`, add `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in `.env`. This provider only drafts a suspect reply; deterministic case facts and the final answer remain server-owned.

## Audio and accessibility

Dialogue text is always displayed. Sound can be toggled globally from the header or audio panel. Auto Voice controls whether new replies play automatically; when disabled, speech still generates for manual playback. The audio panel has a volume slider. Errors do not block the interview. In development, missing credentials use browser speech synthesis and are labeled `DEVELOPMENT MOCK`; production shows the Fish Audio error and allows retry. Browser playback may require the player's first tap/click due to autoplay policies.

## Security and deployment

`.env` is ignored by git. The server validates input lengths, limits requests, applies timeouts, limits generated audio size, and does not log credentials. The API currently rate limits to 40 requests per minute per IP. Memory audio cache clears on server restart and caps at 80 items.

For production, build the frontend with `npm run build`, run the API with `npm run dev:server` or compile/deploy the server with your Node process manager, and serve `dist/` from a static host or reverse proxy. Set secrets in the deployment provider's environment settings. Configure HTTPS, origin restrictions, a persistent shared rate limiter, and production logging before public launch. This prototype does not persist game sessions or provide user accounts.

## Troubleshooting

- `Fish Audio is not configured yet`: add a server-side key to `.env` and restart.
- `Assign a Fish Audio voice ID`: update that speaker in `voices.json` and restart.
- Fish Audio `401`: check the key. `429`: wait and retry. Other provider errors are shown without stopping text gameplay.
- Case server unavailable: confirm both processes are running with `npm run dev` and port 8787 is free.
- Autoplay blocked: use the manual PLAY VOICE control after interacting with the page.

## Fish Audio documentation

- [Text-to-Speech API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech)
- [Text-to-Speech overview and request examples](https://docs.fish.audio/features/text-to-speech)
- [API quick start](https://docs.fish.audio/developer-guide/getting-started/quickstart)
