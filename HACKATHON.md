# Operation Leather Jacket

## One-page rules

**The case:** A confidential AURORA research archive has leaked from fictional company NEXORA SYSTEMS. The player is an investigator. Six fictional suspects had access; only one arranged the leak.

**Round length:** The 15-minute clock starts when the player opens the case file. At zero, the server closes the round and reveals the solution.

**Play:**

1. Watch the six-person identity roll call. Each animated mugshot introduces the suspect and their relationship to AURORA.
2. Interrogate suspects. Ask questions and present recovered evidence. Statements remain in the case notebook.
3. Compare testimony with the access log, camera gap, transfer trace, and lab note. Use the timeline to order events.
4. File one final accusation before the clock expires.

**Win:** Name Elena Cross as the person who arranged the leak. The final reveal explains the roles of Victor Hale, Nadia Sterling, and Silas Reed. A wrong accusation closes the case with the correct solution revealed.

**AURORA Signal:** Evidence, interview statements, and the final five-minute window raise the interference meter. That signal changes the generated room tone, moving from a restrained low hum toward a more unstable pulse as the case tightens. The sound bed has its own toggle and never replaces spoken dialogue or text.

The hackathon's 1-4 limit applies to the participating build team. This prototype is a single-player investigation.

## AI stack

- **Dialogue:** The server sends each question, recent interview history, presented evidence, and the suspect's role/persona to the configured OpenAI Chat Completions provider. The model can evade or mislead in-character. It does not receive or control the culprit, evidence, timeline, or final solution; those stay in the deterministic case engine.
- **Voice:** Fish Audio speaks the exact identity statements and suspect replies using the assigned voice model IDs. The browser analyzes playback to animate the fictional vector character's mouth. Character voices must be authorized, non-cloned voices for this event.
- **AURORA Signal:** A lightweight game-state pressure score drives a procedural Web Audio bed. No voice clip, external soundtrack, or secret data is needed for that effect.

For the judged demo, set `LLM_PROVIDER=openai` and add `OPENAI_API_KEY` to the server's private `.env`. With `LLM_PROVIDER=mock` or no key, the fallback keeps the case playable but does not demonstrate live LLM dialogue. Fish Audio and OpenAI keys stay server-side.

## Three-minute demo path

Show the animated roll call, ask Elena about the project, present the access log, challenge Victor with the camera gap, and compare Silas's relay account against the transfer trace. Point out the rising AURORA Signal, then accuse Elena before the 15-minute clock expires.
