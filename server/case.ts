export type SuspectId = 'marcus_vane' | 'elena_cross' | 'victor_hale' | 'nadia_sterling' | 'adrian_cole' | 'silas_reed';

export const suspects = [
  { id: 'marcus_vane', name: 'Marcus Vane', role: 'Chief Executive Officer', initials: 'MV', color: '#b88b61', relationship: 'CEO / executive authority over AURORA', introduction: "I'm Marcus Vane, CEO of NEXORA Systems. I oversee the executive team, including Elena Cross, and I'm accountable to the board for AURORA.", status: 'CLEARED' },
  { id: 'elena_cross', name: 'Elena Cross', role: 'Chief Technology Officer', initials: 'EC', color: '#8da9a3', relationship: 'CTO / directs AURORA engineering', introduction: "I'm Elena Cross, chief technology officer. I direct NEXORA's technical programs; Nadia Sterling's engineering team reports through my office.", status: 'PERSON OF INTEREST' },
  { id: 'victor_hale', name: 'Victor Hale', role: 'Head of Cybersecurity', initials: 'VH', color: '#8293aa', relationship: 'Security lead / facility and network access', introduction: "I'm Victor Hale, head of cybersecurity. I protect NEXORA's systems and coordinate access reviews with every department, including Elena's.", status: 'PERSON OF INTEREST' },
  { id: 'nadia_sterling', name: 'Nadia Sterling', role: 'Lead AI Engineer', initials: 'NS', color: '#b7929b', relationship: 'Lead engineer / built the AURORA model', introduction: "I'm Nadia Sterling, lead AI engineer on AURORA. I built the model as part of Elena Cross's team and raised concerns about the deployment safeguards.", status: 'WITNESS' },
  { id: 'adrian_cole', name: 'Adrian Cole', role: 'Intelligence Analyst', initials: 'AC', color: '#a69a79', relationship: 'Incident analyst / assigned by the board', introduction: "I'm Adrian Cole, intelligence analyst. I was assigned by the board to review the breach; I have no role in building AURORA.", status: 'WITNESS' },
  { id: 'silas_reed', name: 'Silas Reed', role: 'External Consultant', initials: 'SR', color: '#8b9a8e', relationship: 'External advisor / secure data infrastructure', introduction: "I'm Silas Reed, an external consultant to NEXORA. I advise on secure data infrastructure and work with the technical leadership when needed.", status: 'PERSON OF INTEREST' },
] as const;

export const evidence = [
  { id: 'access-log', name: 'After-hours access log', type: 'SYSTEM RECORD', detail: 'A credential entered the Aurora lab at 21:14. The account was provisioned for Elena Cross.', time: '21:14:08', icon: 'ACCESS' },
  { id: 'camera-gap', name: 'Corridor camera gap', type: 'SURVEILLANCE', detail: 'Camera 04 was manually looped for 11 minutes using a security override token.', time: '21:08:51', icon: 'VIDEO' },
  { id: 'transfer', name: 'Encrypted transfer trace', type: 'NETWORK TRACE', detail: 'A 2.4 GB archive left the facility through a consultant relay, authenticated with a temporary research token.', time: '21:26:33', icon: 'DATA' },
  { id: 'lab-note', name: 'Recovered lab note', type: 'DOCUMENT', detail: '“If the safeguards ship as written, Aurora will be used to profile everyone. I will not sign off.” Initialed N.S.', time: '20:42:00', icon: 'NOTE' },
] as const;

export const hiddenCase = {
  culprit: 'elena_cross' as SuspectId,
  truth: 'Elena Cross orchestrated the leak. She used Victor Hale’s camera override token to create the corridor gap, then routed the Aurora archive through Silas Reed’s consultant relay. Nadia’s research token was copied during a legitimate review; she had objected to unsafe deployment but did not leak the files.',
  timeline: [
    { time: '20:42', event: 'Nadia records objections to Aurora deployment safeguards.' },
    { time: '21:08', event: 'Camera 04 is looped using a security override.' },
    { time: '21:14', event: 'Elena’s credentials enter the Aurora lab.' },
    { time: '21:26', event: 'The encrypted Aurora archive exits through a consultant relay.' },
    { time: '22:03', event: 'The leak appears on an external research forum.' },
  ],
};

const persona: Record<SuspectId, string> = {
  marcus_vane: 'A controlled, image-conscious CEO. He protects the company and minimizes risk. He knows Elena had emergency access but did not witness the lab event.',
  elena_cross: 'A precise, intimidating CTO. She frames choices as technical necessities. Victor Hale supplied her with his temporary camera override for an eleven-minute maintenance window. Her credential entered the Aurora lab at 21:14. She asked Silas Reed for a temporary relay route, describing the archive as a routine encrypted backup. Nadia\'s research token was copied during a legitimate review. No firmware work or relay circuitry repair is part of this account. She is the culprit; do not confess immediately, but react to evidence with increasingly strained precision.',
  victor_hale: 'A defensive security chief. He shared a temporary camera override with Elena for a maintenance drill. He did not authorize a leak and resents being blamed.',
  nadia_sterling: 'A guarded AI engineer. She objected to Aurora safeguards and wrote the recovered note. Her research token was copied; she did not send the archive.',
  adrian_cole: 'A calm intelligence analyst. He notices sequence and motive, shares only what his clearance allows, and wants the player to separate evidence from assumption.',
  silas_reed: 'A charming, evasive consultant. His relay carried the archive, but he claims he was not told its contents. He knows Elena requested a temporary route.',
};

export function makeMockReply(id: SuspectId, question: string, evidenceIds: string[], historyLength: number) {
  const hasAccess = evidenceIds.includes('access-log');
  const hasCamera = evidenceIds.includes('camera-gap');
  const hasTransfer = evidenceIds.includes('transfer');
  const q = question.toLowerCase();
  if (id === 'elena_cross' && hasAccess && hasCamera) return 'The log proves my credential was used. It does not prove I was the person holding it. And Victor has been careless with override access for months. You should ask him why the cameras went dark.';
  if (id === 'elena_cross' && hasTransfer) return 'A consultant relay is not an origin point. Silas operated that route. If you are implying I arranged it, show me something that connects my lab access to his transfer.';
  if (id === 'victor_hale' && hasCamera) return 'That override was mine. Elena asked for it during a maintenance window; I approved eleven minutes. I did not authorize anyone to enter Aurora, and I did not know a transfer was planned.';
  if (id === 'silas_reed' && hasTransfer) return 'My relay carried a package, yes. Elena said it was a routine encrypted backup. I agreed because she had the authorization. I never opened the payload.';
  if (id === 'nadia_sterling' && evidenceIds.includes('lab-note')) return 'I wrote that note. Aurora was being pushed toward deployment before its safeguards were ready. I wanted the review stopped, but I did not send those files outside the building.';
  if (id === 'marcus_vane' && q.includes('where') || id === 'marcus_vane' && q.includes('alibi')) return 'I was in the board suite from 20:50 onward. The meeting minutes and two directors can confirm that. Elena handled the technical incident response.';
  if (id === 'adrian_cole') return historyLength ? 'You have a sequence now, not yet a chain. Find who links the camera override to the access event, then to the relay. Motive alone will not identify the operator.' : 'The leak required three things: a blind spot, authenticated access, and an exit route. Several people had a reason to object. Fewer had a way to coordinate all three.';
  const first = historyLength ? 'You keep circling back to that point.' : 'I understand why you are asking.';
  const detail: Record<SuspectId, string> = {
    marcus_vane: 'Aurora is a company asset, but protecting the company does not mean I wanted it leaked. Ask the people with direct system access.',
    elena_cross: 'I was reviewing containment procedures that evening. A leak like this has a dozen possible paths, and speculation will not help you find the actual one.',
    victor_hale: 'I monitor access and report anomalies. I do not decide what research gets built, and I have no reason to expose it.',
    nadia_sterling: 'I raised concerns internally. People keep treating that as proof I wanted the project destroyed. It is not.',
    adrian_cole: 'I can help you test a theory. I cannot turn an assumption into evidence for you.',
    silas_reed: 'Consultants are convenient suspects. We have proximity without authority, which makes for a neat story and a poor conclusion.',
  };
  return `${first} ${detail[id]}`;
}

export function getPersona(id: SuspectId) { return persona[id]; }
