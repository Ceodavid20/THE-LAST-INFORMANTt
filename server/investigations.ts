import { evidence, getPersona, hiddenCase, makeMockReply, suspects, type SuspectId } from './case.js';

type Subject = { id: SuspectId; name: string; role: string; initials: string; color: string; relationship: string; introduction: string; status: string };
type Exhibit = { id: string; name: string; type: string; detail: string; time: string; icon: string };
type Testimony = Record<SuspectId, string>;
export type Investigation = {
  id: string; number: string; title: string; category: string; location: string; incidentTime: string;
  briefing: string; objective: string; suspects: readonly Subject[]; evidence: readonly Exhibit[];
  timeline: readonly { time: string; event: string }[]; culprit: SuspectId; truth: string;
  persona: (suspectId: SuspectId) => string;
  mockReply: (suspectId: SuspectId, question: string, evidenceIds: string[], historyLength: number) => string;
};

function caseSubjects(relationships: Testimony): Subject[] {
  return suspects.map(person => ({ ...person, relationship: relationships[person.id], introduction: `I'm ${person.name}, ${person.role}. ${relationships[person.id]}.`, status: 'PERSON OF INTEREST' }));
}

function testimonyCase(details: Omit<Investigation, 'persona' | 'mockReply'>, testimony: Testimony): Investigation {
  return {
    ...details,
    persona: suspectId => `${details.suspects.find(person => person.id === suspectId)!.role}. ${testimony[suspectId]} Keep your account consistent with these facts; protect your own interests without inventing records.`,
    mockReply: suspectId => testimony[suspectId],
  };
}

const aurora: Investigation = {
  id: 'aurora', number: '09-441', title: 'AURORA Research Leak', category: 'Research theft', location: 'NEXORA / NORTH TOWER', incidentTime: '22:03',
  briefing: 'At 22:03, a confidential AI research project called AURORA appeared on an external forum. Six people had access. One of them opened the door, created the blind spot, and arranged the exit. Find the chain.',
  objective: 'Connect the camera override, lab access, and archive transfer to identify who arranged the leak.',
  suspects, evidence, timeline: hiddenCase.timeline, culprit: hiddenCase.culprit, truth: hiddenCase.truth, persona: getPersona, mockReply: makeMockReply,
};

const blackout = testimonyCase({
  id: 'blackout', number: '09-442', title: 'The Midnight Blackout', category: 'Sabotage', location: 'NEXORA / OPERATIONS CENTRE', incidentTime: '00:07',
  briefing: 'At 00:07, NEXORA lost its primary servers and standby power together. A ransom note appeared seconds later, but the demand may be a diversion. Reconstruct who disabled the recovery system before the shutdown.',
  objective: 'Connect the recovery hold, console access, and planted ransom note to the person who staged the outage.',
  suspects: caseSubjects({ marcus_vane: 'I approved the overnight resilience test, with standby power required to stay online', elena_cross: 'I supervised the server maintenance plan and signed off only on the primary restart', victor_hale: 'I controlled emergency access to the power console and its local security key', nadia_sterling: 'I was validating standby server recovery during the maintenance window', adrian_cole: 'I compared the ransom message with the outage and console records', silas_reed: 'I supplied the standby power unit and inspected its failed recovery after the outage' }),
  evidence: [
    { id: 'recovery-hold', name: 'Standby recovery hold', type: 'SYSTEM RECORD', detail: 'At 23:48, a local command disabled automatic standby recovery. The command used Victor Hale’s hardware security key; remote maintenance sessions cannot issue it.', time: '23:48:12', icon: 'DATA' },
    { id: 'power-console', name: 'Power room door record', type: 'ACCESS RECORD', detail: 'Victor Hale entered the locked power room alone at 23:46 and left at 23:53. The door record shows no other entry before the outage.', time: '23:46:05', icon: 'ACCESS' },
    { id: 'ransom-draft', name: 'Ransom draft recovery', type: 'DOCUMENT', detail: 'A deleted draft matching the ransom note was recovered from Victor’s offline incident tablet. Its creation time was 23:54, thirteen minutes before the outage.', time: '23:54:31', icon: 'NOTE' },
    { id: 'test-order', name: 'Signed resilience test order', type: 'MAINTENANCE ORDER', detail: 'Elena’s signed test order allowed a primary-server restart at 00:07 and explicitly required automatic standby recovery to remain enabled. Silas’s standby-unit inspection passed at 22:30.', time: '22:30:00', icon: 'VIDEO' },
  ],
  timeline: [ { time: '22:30', event: 'The standby power inspection passes.' }, { time: '23:46', event: 'Victor enters the power room.' }, { time: '23:48', event: 'Automatic recovery is disabled locally.' }, { time: '23:54', event: 'The ransom note is drafted before the outage.' }, { time: '00:07', event: 'The scheduled restart becomes a complete outage.' } ],
  culprit: 'victor_hale', truth: 'Victor Hale sabotaged the recovery system to manufacture a security emergency and protect his department from planned cuts. His key disabled recovery while he was alone in the power room, and his tablet held the ransom draft before the outage. Elena’s restart was authorized; Silas’s standby unit was working. The ransom demand disguised an internal act as an outside attack.',
}, {
  marcus_vane: 'I approved a controlled restart, not a shutdown of standby recovery. Victor had argued against the planned security budget cuts that afternoon. I was not in the power room.',
  elena_cross: 'My signed order required standby recovery to stay enabled. A primary restart should not have caused a blackout. The recovery hold was not part of my maintenance plan.',
  victor_hale: 'I was alone in the power room from 23:46 to 23:53, and my local key issued the recovery hold at 23:48. I describe it as a precaution during the test. The ransom draft was on my tablet before the outage; I claim it was an incident exercise. I had opposed cuts to my department. I resist calling those actions sabotage.',
  nadia_sterling: 'The standby recovery check passed earlier. At 23:48 I saw it change to a local hold, which I could not undo remotely. Elena’s restart was scheduled for 00:07.',
  adrian_cole: 'The ransom note was drafted before the outage. Compare its authoring device with the key used to disable standby recovery; the timing matters more than the threat wording.',
  silas_reed: 'My standby unit passed its 22:30 inspection. It did not fail mechanically: a local recovery hold prevented it from starting. I do not possess Victor’s hardware key.',
});

const ledger = testimonyCase({
  id: 'glass-ledger', number: '09-443', title: 'The Glass Ledger', category: 'Financial fraud', location: 'NEXORA / FINANCE WING', incidentTime: '18:40',
  briefing: 'A routine supplier payment sent ₦48 million to a substitute bank account. The chief executive’s approval appears genuine, but the beneficiary changed after he signed. Follow the approval versions and audit trail to find who redirected the money.',
  objective: 'Separate the original payment approval from the later beneficiary substitution and find the person who concealed it.',
  suspects: caseSubjects({ marcus_vane: 'I approved the original supplier payment before its beneficiary was changed', elena_cross: 'I maintain the payment service and its versioned approval records', victor_hale: 'I reviewed sign-in records for the finance approval terminal', nadia_sterling: 'I compared the two payment payloads after the supplier reported nonpayment', adrian_cole: 'I managed the payment audit exceptions and final compliance release', silas_reed: 'I represented the supplier and supplied its original bank confirmation' }),
  evidence: [
    { id: 'signed-payment', name: 'Original signed payment', type: 'APPROVAL RECORD', detail: 'Marcus approved payment version 17 at 17:55. Its beneficiary account ends 1182, matching the supplier’s bank confirmation. His signature does not cover version 18.', time: '17:55:04', icon: 'NOTE' },
    { id: 'beneficiary-edit', name: 'Beneficiary change history', type: 'SYSTEM RECORD', detail: 'At 18:12, Adrian Cole’s compliance account created version 18 and replaced account 1182 with account 9076. The new account had no supplier authorization.', time: '18:12:19', icon: 'DATA' },
    { id: 'terminal-proof', name: 'Approval terminal record', type: 'ACCESS RECORD', detail: 'The version 18 edit came from terminal F-03 while Adrian’s badge and hardware key were present. The terminal’s remote access was disabled throughout that period.', time: '18:11:56', icon: 'ACCESS' },
    { id: 'audit-suppression', name: 'Suppressed mismatch alert', type: 'AUDIT TRACE', detail: 'Adrian’s account dismissed the signature-mismatch warning as a supplier correction at 18:15 and released version 18. The ₦48 million transfer settled at 18:40.', time: '18:15:03', icon: 'VIDEO' },
  ],
  timeline: [ { time: '17:55', event: 'Marcus signs the original supplier payment.' }, { time: '18:11', event: 'Adrian authenticates locally at terminal F-03.' }, { time: '18:12', event: 'The beneficiary is replaced in version 18.' }, { time: '18:15', event: 'The mismatch alert is dismissed and payment released.' }, { time: '18:40', event: 'The transfer settles to the substituted account.' } ],
  culprit: 'adrian_cole', truth: 'Adrian Cole redirected the supplier payment. Marcus approved version 17 with the correct bank account. Adrian used his local terminal and hardware key to substitute the beneficiary in version 18, then dismissed the mismatch warning and released the transfer. Silas supplied the genuine bank details; the CEO’s earlier signature was used to make the altered payment look authorized.',
}, {
  marcus_vane: 'I approved version 17 at 17:55 with account 1182. I did not sign a beneficiary change. A signature displayed beside a later version does not extend my approval to that version.',
  elena_cross: 'Payment signatures cover an exact version. The approval service kept both versions and recorded Adrian’s compliance account creating version 18. The service did not automatically substitute a beneficiary.',
  victor_hale: 'Adrian’s badge and hardware key were present at F-03 during the edit. Remote access was disabled. The record does not support an outsider operating the terminal remotely.',
  nadia_sterling: 'The bank account is the material difference between versions 17 and 18. Account 1182 matches the supplier confirmation; account 9076 does not. The original signature is attached to version 17.',
  adrian_cole: 'I created version 18 at F-03 and dismissed the mismatch warning as a supplier correction. I claim I was keeping the payment on schedule. There was no supplier authorization for account 9076; I avoid explaining that gap. I cannot credibly blame remote access or deny using my own hardware key.',
  silas_reed: 'The supplier’s confirmed account ends 1182. I sent no instruction to switch it to 9076. The supplier called because the scheduled payment never reached its account.',
});

const prototype = testimonyCase({
  id: 'hollow-vault', number: '09-444', title: 'The Hollow Vault', category: 'Prototype theft', location: 'NEXORA / HARDWARE LAB', incidentTime: '07:10',
  briefing: 'A sealed prototype case returned from calibration weighing exactly what it should. At the morning demonstration, the prototype was gone and ballast sat in its place. Establish where the swap happened and who controlled the shipment during that window.',
  objective: 'Use the custody scan, serial number, and replacement seal to locate the swap and identify the thief.',
  suspects: caseSubjects({ marcus_vane: 'I commissioned the morning prototype demonstration and signed the inventory policy', elena_cross: 'I authorized calibration of the prototype without allowing it to leave the facility', victor_hale: 'I recorded the sealed case leaving and returning to the hardware vault', nadia_sterling: 'I built prototype P-17 and photographed its serial before calibration', adrian_cole: 'I reconstructed custody from vault scans and the loading-bay manifest', silas_reed: 'I handled the calibration case and its loading-bay paperwork' }),
  evidence: [
    { id: 'prototype-serial', name: 'Pre-calibration serial photograph', type: 'INVENTORY RECORD', detail: 'Nadia photographed prototype P-17 inside case C-08 at 16:05. The case weighed 6.2 kg and carried seal N-220 before Silas collected it for calibration.', time: '16:05:17', icon: 'NOTE' },
    { id: 'custody-gap', name: 'Unscheduled custody window', type: 'ACCESS RECORD', detail: 'Silas held case C-08 alone in loading bay B for twelve minutes, from 16:24 to 16:36. The approved internal route went directly from the vault to calibration and did not include the bay.', time: '16:24:00', icon: 'ACCESS' },
    { id: 'replacement-seal', name: 'Replacement seal issue log', type: 'SYSTEM RECORD', detail: 'Silas signed out seal N-241 at 16:22. The returned case carried N-241 rather than its original N-220. Inside, a ballast block preserved the original 6.2 kg weight.', time: '16:22:09', icon: 'DATA' },
    { id: 'outbound-manifest', name: 'Outbound calibration manifest', type: 'SHIPPING RECORD', detail: 'A parcel recorded by Silas as an empty calibration housing left loading bay B at 16:34. The dispatch scan shows prototype serial P-17; no export authorization exists.', time: '16:34:41', icon: 'VIDEO' },
  ],
  timeline: [ { time: '16:05', event: 'P-17 is photographed in case C-08 under seal N-220.' }, { time: '16:22', event: 'Silas signs out a replacement seal.' }, { time: '16:24', event: 'The case enters an unscheduled loading-bay custody window.' }, { time: '16:34', event: 'A parcel carrying serial P-17 is dispatched as empty housing.' }, { time: '07:10', event: 'The next morning, the opened case contains ballast.' } ],
  culprit: 'silas_reed', truth: 'Silas Reed removed P-17 during his unscheduled loading-bay custody window. He dispatched it as empty calibration housing, replaced it with equal-weight ballast, and used seal N-241 to make the returned case appear intact. Nadia’s photograph proves the prototype existed before his collection; the dispatch serial, replacement seal, and sole custody tie the swap to him.',
}, {
  marcus_vane: 'I authorized the demonstration, not an export. Our inventory policy requires serial scans because a matching case weight alone cannot prove its contents.',
  elena_cross: 'I approved internal calibration only. The authorized route did not include loading bay B. There is no signed permission for P-17 to leave the facility.',
  victor_hale: 'The returned case had the expected weight, but its seal was N-241 instead of N-220. The custody scan places Silas alone with it during the unscheduled loading-bay stop.',
  nadia_sterling: 'My 16:05 photograph shows P-17 inside C-08 before Silas collected it. The serial is visible. The next morning I found ballast, not a failed or dismantled prototype.',
  adrian_cole: 'The outgoing parcel’s scan shows P-17 even though its manifest calls it empty housing. Compare that 16:34 scan with Silas’s custody window and the replacement seal issue time.',
  silas_reed: 'I collected C-08, signed out seal N-241, and took an unscheduled stop in loading bay B. I described the outgoing parcel as empty calibration housing, but the scan shows P-17. I claim the reseal was routine and resist admitting a swap. I cannot deny the signed seal log, the parcel serial, or my sole custody.',
});

export const investigations: readonly Investigation[] = [aurora, blackout, ledger, prototype];

export function findInvestigation(caseId: string) {
  return investigations.find(investigation => investigation.id === caseId);
}

export function getDailyInvestigation(date = new Date()) {
  const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  const day = Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86_400_000);
  return { date: dateKey, investigation: investigations[day % investigations.length] };
}

export function publicInvestigation(investigation: Investigation) {
  const { id, number, title, category, location, incidentTime, briefing, objective, suspects: subjects, evidence: exhibits, timeline } = investigation;
  return { id, number, title, category, company: 'NEXORA SYSTEMS', location, incidentTime, briefing, objective, suspects: subjects, evidence: exhibits, timeline, durationSeconds: 900 };
}
