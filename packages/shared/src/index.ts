/**
 * Autonomus shared types and utilities.
 *
 * Phase 0: only the minimal types needed for the webhook to compile.
 * Zod schemas for inter-agent JSON arrive in Phase 3.
 */

export const FACTORY_REPO = 'dmnavalon/autonomus' as const;
export const FACTORY_APPS_OWNER = 'dmnavalon' as const;

export const STATE_LABELS = [
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

export type StateLabel = (typeof STATE_LABELS)[number];

export const TYPE_LABELS = [
  'type:software_nuevo',
  'type:feature',
  'type:bug',
  'type:cambio_visual',
  'type:qa_only',
  'type:refactor',
  'type:pregunta',
  'type:desconocido',
] as const;

export type TypeLabel = (typeof TYPE_LABELS)[number];

export const REPAIR_LABELS = [
  'repair:1',
  'repair:2',
  'repair:3',
  'repair:4',
  'repair:5',
] as const;

export const COST_LABELS = ['cost:warning', 'cost:over-budget'] as const;
