import { describe, expect, it } from 'vitest';
import { findInvestigation, getDailyInvestigation, investigations, publicInvestigation } from './investigations.js';

describe('investigation archive', () => {
  it('provides distinct mysteries, evidence, and culprits', () => {
    expect(investigations).toHaveLength(4);
    expect(new Set(investigations.map(investigation => investigation.id)).size).toBe(4);
    expect(new Set(investigations.map(investigation => investigation.culprit)).size).toBe(4);
    const exhibitIds = investigations.flatMap(investigation => investigation.evidence.map(item => item.id));
    expect(new Set(exhibitIds).size).toBe(exhibitIds.length);
    for (const investigation of investigations) {
      expect(investigation.suspects.some(person => person.id === investigation.culprit)).toBe(true);
      expect(investigation.evidence.length).toBeGreaterThanOrEqual(4);
      expect(investigation.timeline.length).toBeGreaterThanOrEqual(4);
      for (const person of investigation.suspects) expect(investigation.persona(person.id).length).toBeGreaterThan(20);
    }
  });

  it('keeps solutions and private testimony out of the public case payload', () => {
    for (const investigation of investigations) {
      const publicCase = publicInvestigation(investigation);
      expect(publicCase.id).toBe(investigation.id);
      expect(publicCase).not.toHaveProperty('culprit');
      expect(publicCase).not.toHaveProperty('truth');
      expect(publicCase).not.toHaveProperty('persona');
      expect(publicCase).not.toHaveProperty('mockReply');
      expect(JSON.stringify(publicCase)).not.toContain(investigation.truth);
    }
  });

  it('rejects unknown cases rather than silently selecting Aurora', () => {
    expect(findInvestigation('unknown-case')).toBeUndefined();
  });
});

describe('daily investigation', () => {
  it('features every case over four consecutive days', () => {
    const featured = Array.from({ length: 4 }, (_, offset) => getDailyInvestigation(new Date(Date.UTC(2026, 10, 16 + offset, 12))).investigation.id);
    expect(new Set(featured).size).toBe(4);
    expect(getDailyInvestigation(new Date('2026-11-20T12:00:00Z')).investigation.id).toBe(featured[0]);
  });

  it('changes at midnight in Lagos and remains stable throughout the day', () => {
    const beforeMidnight = getDailyInvestigation(new Date('2026-11-16T22:59:59Z'));
    const afterMidnight = getDailyInvestigation(new Date('2026-11-16T23:00:00Z'));
    expect(beforeMidnight.date).toBe('2026-11-16');
    expect(afterMidnight.date).toBe('2026-11-17');
    expect(beforeMidnight.investigation.id).not.toBe(afterMidnight.investigation.id);
    expect(getDailyInvestigation(new Date('2026-11-17T18:30:00Z')).investigation.id).toBe(afterMidnight.investigation.id);
  });
});
