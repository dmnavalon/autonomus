/**
 * State-label utilities. The Issue's labels are the durable state machine.
 */

export const STATES = [
  'state:received',
  'state:classifying',
  'state:planning',
  'state:coding',
  'state:pr-created',
  'state:waiting-preview',
  'state:preview-ready',
  'state:qa-planning',
  'state:qa-running',
  'state:qa-failed',
  'state:repairing',
  'state:retesting',
  'state:auto-approved',
  'state:human-review-required',
  'state:failed-needs-human',
  'state:cancelled',
] as const;

export type StateLabel = (typeof STATES)[number];

export function currentState(labels: string[]): StateLabel | null {
  const found = labels.find((l) => l.startsWith('state:'));
  return (found as StateLabel | undefined) ?? null;
}

export function currentTypeLabel(labels: string[]): string | null {
  return labels.find((l) => l.startsWith('type:')) ?? null;
}

export function currentRepairAttempt(labels: string[]): number {
  const m = labels
    .map((l) => l.match(/^repair:(\d+)$/))
    .find((m) => m !== null);
  return m ? Number(m[1]) : 0;
}
