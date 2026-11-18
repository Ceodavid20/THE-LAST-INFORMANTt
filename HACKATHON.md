# Operation Leather Jacket

## One-page rules

**The cases:** The archive contains four independent investigations: AURORA Research Leak, The Midnight Blackout, The Glass Ledger, and The Hollow Vault. Each has its own culprit, records, character knowledge, timeline, and reveal. The same six fictional characters return in different roles in each incident. A daily feature rotates through the archive at midnight in Lagos. The demo path below uses AURORA.

**Round length:** The 15-minute clock starts when the player opens the case file. At zero, the server closes the round and reveals the solution.

**Play:**

1. Choose an investigation from the archive, then watch or skip the six-person identity roll call. Each animated mugshot introduces the suspect and their relationship to the selected case.
2. Interrogate suspects. Ask questions and present recovered evidence. Statements remain in the case notebook.
3. Compare testimony with the access log, camera gap, transfer trace, and lab note. Use the timeline to order events.
4. File one final accusation before the clock expires.

**Win:** Identify the culprit for the selected case. In AURORA, Elena Cross arranged the leak; the other cases have different culprits. A wrong accusation closes that case with its solution revealed. The player can then choose another investigation, and completed files are remembered on the device.

**AURORA Signal:** Evidence, interview statements, and the final five-minute window raise the interference meter. That signal changes the generated room tone, moving from a restrained low hum toward a more unstable pulse as the case tightens. The sound bed has its own toggle and never replaces spoken dialogue or text.

The hackathon's 1-4 limit applies to the participating build team. This prototype is a single-player investigation.

## AI stack

- **Dialogue:** The server sends each question, recent interview history, presented evidence, and the selected case's character knowledge to the configured Groq/OpenAI/Xingchi provider. The model can evade or mislead in character. The deterministic case engine owns the records and solution and grades the accusation independently of the generated dialogue.
- **Voice:** Fish Audio speaks the exact identity statements and suspect replies using the assigned voice model IDs. The browser analyzes playback to animate the fictional vector character's mouth. Character voices must be authorized, non-cloned voices for this event.
- **AURORA Signal:** A lightweight game-state pressure score drives a procedural Web Audio bed. No voice clip, external soundtrack, or secret data is needed for that effect.

For the judged demo, set `LLM_PROVIDER=groq` and add `GROQ_API_KEY` to the server's private `.env`. Explicit `LLM_PROVIDER=mock` keeps the case playable without live LLM dialogue; missing provider credentials show an error. Fish Audio and dialogue-provider keys stay server-side.

## Three-minute demo path

Choose AURORA Research Leak from the archive. Show the animated roll call, ask Elena about the project, present the access log, challenge Victor with the camera gap, and compare Silas's relay account against the transfer trace. Point out the rising case pressure, then accuse Elena before the 15-minute clock expires. Return to the archive to show the other investigations.
