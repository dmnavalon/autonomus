import { describe, it, expect } from 'vitest';
import { parseRepo } from '../../packages/orchestrator/src/tools/github-target';

describe('parseRepo', () => {
  it('parses owner/name', () => {
    expect(parseRepo('dmnavalon/autonomus')).toEqual({ owner: 'dmnavalon', repo: 'autonomus' });
  });

  it('throws on bad input', () => {
    expect(() => parseRepo('invalid')).toThrow();
    expect(() => parseRepo('')).toThrow();
  });
});
