/**
 * Coordinator spec ↔ ops consistency.
 *
 * Verifies that every label referenced in agents/13-coordinador/instructions.md
 * exists in scripts/setup-labels.sh. Catches drift between the spec layer and
 * the operational labels created in the GitHub repo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function extractLabelsFromSetupScript(): Set<string> {
  const content = readFileSync(join(repoRoot, 'scripts', 'setup-labels.sh'), 'utf8');
  const labels = new Set<string>();
  // Format: "name|color|description" inside the LABELS=( … ) array.
  const re = /^\s*"([a-z]+:[a-z0-9_-]+)\|/gm;
  for (const m of content.matchAll(re)) {
    labels.add(m[1]!);
  }
  return labels;
}

function extractLabelsFromCoordinatorSpec(): Set<string> {
  const content = readFileSync(
    join(repoRoot, 'agents', '13-coordinador', 'instructions.md'),
    'utf8',
  );
  const labels = new Set<string>();
  // Match concrete labels like state:received, repair:1, cost:warning, etc.
  const re = /\b(state|type|repair|cost|source):[a-z0-9_-]+\b/g;
  for (const m of content.matchAll(re)) {
    labels.add(m[0]);
  }
  return labels;
}

describe('coordinator spec ↔ setup-labels.sh consistency', () => {
  const ops = extractLabelsFromSetupScript();
  const spec = extractLabelsFromCoordinatorSpec();

  it('setup-labels.sh defines a sufficient label set', () => {
    expect(ops.size).toBeGreaterThanOrEqual(30);
  });

  it('every label in coordinator spec exists in setup-labels.sh', () => {
    const missing: string[] = [];
    for (const label of spec) {
      if (!ops.has(label)) missing.push(label);
    }
    expect(
      missing,
      `labels referenced in coordinator spec but not defined in setup-labels.sh: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('coordinator spec references at least the core state machine labels', () => {
    const required = [
      'state:received',
      'state:classifying',
      'state:planning',
      'state:coding',
      'state:qa-running',
      'state:repairing',
      'state:human-review-required',
      'state:failed-needs-human',
    ];
    for (const lbl of required) {
      expect(spec.has(lbl), `spec missing canonical label ${lbl}`).toBe(true);
    }
  });
});
