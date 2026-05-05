import { describe, it, expect } from 'vitest';
import { chooseModel } from '../../packages/orchestrator/src/router';

describe('router', () => {
  it('uses cheap tier for clasificador', () => {
    const c = chooseModel('clasificador');
    expect(c.tier).toBe('cheap');
    expect(c.model).toMatch(/haiku|gpt-5-mini/);
    expect(c.reasoningEnabled).toBe(false);
  });

  it('uses strong tier for programador, always', () => {
    const c = chooseModel('programador');
    expect(c.tier).toBe('strong');
  });

  it('upgrades arquitecto to strong when complejidad=alta', () => {
    expect(chooseModel('arquitecto', { complejidad: 'media' }).tier).toBe('mid');
    expect(chooseModel('arquitecto', { complejidad: 'alta' }).tier).toBe('strong');
    expect(chooseModel('arquitecto', { riesgo: 'alto' }).tier).toBe('strong');
  });

  it('upgrades revisor to strong on huge diffs', () => {
    expect(chooseModel('revisor_codigo', { prDiffLoc: 200 }).tier).toBe('mid');
    expect(chooseModel('revisor_codigo', { prDiffLoc: 1500 }).tier).toBe('strong');
  });

  it('enables reasoning on reparador attempt >=3', () => {
    expect(chooseModel('reparador', { repairAttempt: 1 }).reasoningEnabled).toBe(false);
    expect(chooseModel('reparador', { repairAttempt: 2 }).reasoningEnabled).toBe(false);
    expect(chooseModel('reparador', { repairAttempt: 3 }).reasoningEnabled).toBe(true);
    expect(chooseModel('reparador', { repairAttempt: 5 }).reasoningEnabled).toBe(true);
  });
});
