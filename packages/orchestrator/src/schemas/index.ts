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

export const PlanificadorOutputSchema = z.object({
  objetivo: z.string().min(1).max(200),
  alcance: z.array(z.string().max(120)).max(5),
  fuera_de_alcance: z.array(z.string().max(120)).max(3),
  pantallas_afectadas: z.array(z.string().max(120)).max(8),
  flujos_esperados: z.array(z.string().max(200)).max(5),
  criterios_aceptacion: z.array(z.string().max(300)).max(4),
  riesgos: z.array(z.string().max(150)).max(3),
  preguntas_pendientes: z.array(z.string().max(200)).max(2),
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
  ]),
  reason: z.string().max(300).optional(),
});
export type AgentError = z.infer<typeof AgentErrorSchema>;
