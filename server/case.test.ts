import { describe, expect, it } from 'vitest';
import { hiddenCase, makeMockReply, suspects } from './case.js';

describe('deterministic case engine', () => {
  it('keeps the truth server-owned and defines six suspects', () => {
    expect(hiddenCase.culprit).toBe('elena_cross');
    expect(suspects).toHaveLength(6);
    expect(hiddenCase.truth).toContain('Elena Cross');
  });
  it('changes testimony when evidence is presented', () => {
    const plain = makeMockReply('victor_hale', 'Tell me about the outage', [], 0);
    const evidenceReply = makeMockReply('victor_hale', 'Tell me about the outage', ['camera-gap'], 1);
    expect(plain).not.toBe(evidenceReply);
    expect(evidenceReply).toContain('override');
  });
  it('provides a spoken introduction and relationship for each suspect', () => {
    for (const person of suspects) {
      expect(person.introduction).toContain(person.name);
      expect(person.relationship.length).toBeGreaterThan(10);
    }
  });
});
