import { describe, expect, it } from 'vitest';

describe('sanity', () => {
  it('keeps the test runner wired up until Phase 1+ adds real unit tests', () => {
    expect(1 + 1).toBe(2);
  });
});
