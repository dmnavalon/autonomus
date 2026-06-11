/**
 * Zod schemas for each agent's output. Source of truth for inter-agent JSON.
 * Mirrors prompts/shared/json-schemas.md.
 */
import { z } from 'zod';

export const TipoEnum = z.enum([
  'software_nuevo',
  'feature',
  'bug',
  'cambio_visual',
  'qa_only',
  'refactor',
  'pregunta',
  'desconocido',
]);

export const RecepcionistaOutputSchema = z.object({
  texto_limpio: z.string().min(1).max(500),
  intencion_inicial: TipoEnum,
  falta_info_critica: z.boolean(),
  preguntas: z.array(z.string().max(200)).max(2),
});
export type RecepcionistaOutput = z.infer<typeof RecepcionistaOutputSchema>;

export const ClasificadorOutputSchema = z.object({
  tipo: TipoEnum,
  complejidad: z.enum(['baja', 'media', 'alta']),
  requiere_frontend: z.boolean(),
  requiere_backend: z.boolean(),
  requiere_db: z.boolean(),
  requiere_auth: z.boolean(),
  requiere_integraciones: z.boolean(),
  riesgo: z.enum(['bajo', 'medio', 'alto']),
  siguiente_agente: z.enum(['planificador', 'qa_planner', 'finalizar', 'preguntar_humano']),
});
export type ClasificadorOutput = z.infer<typeof ClasificadorOutputSchema>;

export const PlanificadorOutputSchema = z
  .object({
    objetivo: z.string().min(1).max(200),
    alcance: z.array(z.string().max(120)).max(5),
    fuera_de_alcance: z.array(z.string().max(120)).max(3),
    pantallas_afectadas: z.array(z.string().max(120)).max(8),
    flujos_esperados: z.array(z.string().max(200)).max(5),
    criterios_aceptacion: z.array(z.string().max(300)).max(4),
    riesgos: z.array(z.string().max(150)).max(3),
    preguntas_pendientes: z.array(z.string().max(200)).max(2),
  })
  // A spec with no blocking questions must be actionable: lazy empty specs
  // fail validation and the llm retry loop re-asks the model.
  .refine((o) => o.preguntas_pendientes.length > 0 || o.criterios_aceptacion.length > 0, {
    message: 'criterios_aceptacion no puede estar vacio cuando no hay preguntas_pendientes',
    path: ['criterios_aceptacion'],
  });
export type PlanificadorOutput = z.infer<typeof PlanificadorOutputSchema>;

export const ArquitectoOutputSchema = z.object({
  archivos_probables: z.array(z.string().max(200)).max(15),
  estructura: z.string().max(400),
  dependencias_nuevas: z
    .array(z.object({ name: z.string(), reason: z.string().max(150) }))
    .max(5),
  requiere_migracion_db: z.boolean(),
  requiere_env_vars: z.array(z.string().max(80)).max(8),
  riesgos_tecnicos: z.array(z.string().max(150)).max(3),
  plan_pasos: z.array(z.string().max(200)).max(5),
});
export type ArquitectoOutput = z.infer<typeof ArquitectoOutputSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Doc-maestro additions: schemas for the 15 agents not yet implemented as code.
// Each schema mirrors the `output_contract` block in agents/<folder>/instructions.md.
// ═══════════════════════════════════════════════════════════════════════════

export const ProgramadorOutputSchema = z.object({
  branch: z.string().regex(/^factory\/\d+$/),
  pr_number: z.number().int().nonnegative(),
  pr_url: z.string().url(),
  commits: z.array(z.string()).max(20),
  archivos_modificados: z.array(z.string().max(200)).max(20),
  diff_resumen: z.string().max(300),
});
export type ProgramadorOutput = z.infer<typeof ProgramadorOutputSchema>;

/**
 * The Programmer LLM produces this PLAN: file contents + commit/PR text.
 * The GithubOperator (deterministic) takes this plan and produces the final
 * ProgramadorOutput by creating a branch, committing the files, and opening the PR.
 */
export const ProgramadorPlanSchema = z.object({
  archivos_modificados: z
    .array(
      z.object({
        path: z.string().min(1).max(200).regex(/^[A-Za-z0-9_./-]+$/),
        content: z.string().max(80_000),
        operation: z.enum(['create', 'update', 'delete']),
      }),
    )
    .min(1)
    .max(15),
  commit_message: z.string().min(5).max(72),
  commit_body: z.string().max(500),
  pr_title: z.string().min(5).max(80),
  pr_summary: z.string().min(10).max(2000),
  diff_resumen: z.string().max(300),
});
export type ProgramadorPlan = z.infer<typeof ProgramadorPlanSchema>;

export const RevisorOutputSchema = z.object({
  aprobado: z.boolean(),
  observaciones: z.array(z.string().max(200)).max(5),
  cambios_solicitados: z.array(z.string().max(200)).max(5),
});
export type RevisorOutput = z.infer<typeof RevisorOutputSchema>;

const QaTestSchema = z.object({
  nombre: z.string().regex(/^[a-z0-9-]+$/),
  prioridad: z.enum(['critica', 'alta', 'media']),
  tipo: z.enum(['flujo', 'error', 'visual', 'responsive']),
  pasos: z.array(z.string().max(200)).max(6),
  esperado: z.string().max(300),
});
export const QaPlannerOutputSchema = z.object({
  tests: z.array(QaTestSchema).max(8),
  manual_review_notes: z.array(z.string().max(200)).max(3),
});
export type QaPlannerOutput = z.infer<typeof QaPlannerOutputSchema>;

export const PlaywrightGenerationOutputSchema = z.object({
  files_emitted: z.array(z.string().max(200)).max(8),
  config_changes: z.array(z.string().max(200)).max(3),
});
export type PlaywrightGenerationOutput = z.infer<typeof PlaywrightGenerationOutputSchema>;

export const PlaywrightExecutionOutputSchema = z.object({
  estado: z.enum(['passed', 'failed']),
  totales: z.object({
    ran: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
  }),
  fallos: z
    .array(
      z.object({
        nombre: z.string().max(200),
        error_resumen: z.string().max(200),
        trace_artifact: z.string().max(200),
      }),
    )
    .max(20),
  duration_ms: z.number().int().nonnegative(),
});
export type PlaywrightExecutionOutput = z.infer<typeof PlaywrightExecutionOutputSchema>;

export const AnalistaLogsOutputSchema = z.object({
  estado: z.enum(['passed', 'failed']),
  tipo_error: z.enum(['producto', 'fabrica', 'infraestructura', 'credenciales', 'desconocido']),
  resumen: z.string().max(200),
  causa_probable: z.string().max(200),
  archivos_probables: z.array(z.string().max(200)).max(10),
  accion_recomendada: z.enum(['reparar', 'escalar_humano', 'reintentar', 'ignorar']),
  bloqueante: z.boolean(),
  evidence_refs: z.array(z.string().max(200)).max(10),
});
export type AnalistaLogsOutput = z.infer<typeof AnalistaLogsOutputSchema>;

export const ReparadorOutputSchema = z.object({
  intento: z.number().int().min(1).max(5),
  branch: z.string().regex(/^factory\/\d+$/),
  commit_sha: z.string().max(40),
  cambios: z.string().max(300),
  agotados_los_intentos: z.boolean(),
  tests_updated: z.array(z.string().max(200)).max(10),
});
export type ReparadorOutput = z.infer<typeof ReparadorOutputSchema>;

/** What the Reparador LLM produces; the GithubOperator commits these edits. */
export const ReparadorPlanSchema = z.object({
  archivos_modificados: z
    .array(
      z.object({
        path: z.string().min(1).max(200).regex(/^[A-Za-z0-9_./-]+$/),
        content: z.string().max(80_000),
        operation: z.enum(['create', 'update', 'delete']),
      }),
    )
    .min(1)
    .max(10),
  commit_message: z.string().min(5).max(72),
  commit_body: z.string().max(500),
  cambios: z.string().min(5).max(300),
});
export type ReparadorPlan = z.infer<typeof ReparadorPlanSchema>;

export const VerificadorChecklistSchema = z.object({
  branch_existe: z.boolean(),
  pr_existe: z.boolean(),
  preview_existe: z.boolean(),
  build_ok: z.boolean(),
  lint_ok: z.boolean(),
  typecheck_ok: z.boolean(),
  tests_ok: z.boolean(),
  no_bloqueantes: z.boolean(),
  revisor_aprobo: z.boolean(),
  ultimo_commit_testeado: z.boolean(),
});
export const VerificadorOutputSchema = z.object({
  go: z.boolean(),
  checklist: VerificadorChecklistSchema,
  razon_si_no_go: z.string().max(200),
});
export type VerificadorOutput = z.infer<typeof VerificadorOutputSchema>;

export const ProtocolBinderOutputSchema = z.object({
  required_protocols: z.array(z.string().max(200)).max(20),
  missing_protocols: z.array(z.string().max(200)).max(20),
  protocol_violations: z.array(
    z.object({ protocol: z.string().max(200), reason: z.string().max(300) }),
  ).max(20),
  fix_recommendations: z.array(z.string().max(300)).max(20),
});
export type ProtocolBinderOutput = z.infer<typeof ProtocolBinderOutputSchema>;

export const GithubOperatorOutputSchema = z.object({
  operation_status: z.enum(['ok', 'failed', 'blocked']),
  refs: z.object({
    branch: z.string().optional(),
    commit_sha: z.string().optional(),
    pr_number: z.number().int().nonnegative().optional(),
    issue_number: z.number().int().nonnegative().optional(),
  }),
  urls: z.record(z.string(), z.string().url()),
  errors: z.array(z.string().max(300)).max(10),
});
export type GithubOperatorOutput = z.infer<typeof GithubOperatorOutputSchema>;

export const TelegramNotifierOutputSchema = z.object({
  sent_message_id: z.number().int().nonnegative(),
  message_text: z.string().max(4096),
  pending_user_response: z.boolean(),
});
export type TelegramNotifierOutput = z.infer<typeof TelegramNotifierOutputSchema>;

export const FactoryEvaluatorOutputSchema = z.object({
  eval_status: z.enum(['passed', 'failed']),
  failed_cases: z.array(
    z.object({
      suite: z.string().max(80),
      case_id: z.string().max(120),
      expected: z.unknown(),
      actual: z.unknown(),
      diff: z.string().max(500).optional(),
    }),
  ).max(50),
  handoff_accuracy: z.number().min(0).max(1),
  classification_accuracy: z.number().min(0).max(1).optional(),
  protocol_compliance: z.number().min(0).max(1),
  recommendations: z.array(z.string().max(300)).max(10),
});
export type FactoryEvaluatorOutput = z.infer<typeof FactoryEvaluatorOutputSchema>;

export const SecurityGuardOutputSchema = z.object({
  allowed: z.boolean(),
  blocked_reason: z.string().max(300).nullable(),
  required_human_approval: z.boolean(),
  remediation: z.array(z.string().max(300)).max(10),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
});
export type SecurityGuardOutput = z.infer<typeof SecurityGuardOutputSchema>;

export const PromptChangeManagerOutputSchema = z.object({
  change_summary: z.string().max(300),
  impacted_agents: z.array(z.string().max(80)).max(20),
  required_evals: z.array(z.string().max(80)).max(10),
  approval_recommendation: z.enum(['approve', 'block', 'request_changes']),
  version_bumps: z.record(z.string(), z.string().regex(/^\d+\.\d+\.\d+$/)),
  changelog_entry: z.string().max(2000),
});
export type PromptChangeManagerOutput = z.infer<typeof PromptChangeManagerOutputSchema>;

/** Error envelope every agent may return instead of its normal output. */
export const AgentErrorSchema = z.object({
  error: z.enum([
    'max_repair_cycles_reached',
    'input_truncated_insufficient',
    'out_of_scope',
    'invalid_input',
    'provider_error',
    'scope_expansion_required',
    'diagnosis_unactionable',
    'blocked_by_guardian',
    'eval_failed',
    'loop_detected',
    'timeout',
  ]),
  reason: z.string().max(300).optional(),
});
export type AgentError = z.infer<typeof AgentErrorSchema>;
