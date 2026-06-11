import { describe, it, expect } from 'vitest';
import {
  RecepcionistaOutputSchema,
  ClasificadorOutputSchema,
  PlanificadorOutputSchema,
  ArquitectoOutputSchema,
  AgentErrorSchema,
} from '../../packages/orchestrator/src/schemas';

describe('Zod schemas (inter-agent JSON)', () => {
  it('Recepcionista accepts valid bug intent', () => {
    const r = RecepcionistaOutputSchema.parse({
      texto_limpio: 'No funciona cerrar sesión',
      intencion_inicial: 'bug',
      falta_info_critica: false,
      preguntas: [],
    });
    expect(r.preguntas).toEqual([]);
  });

  it('Recepcionista rejects unknown tipo enum', () => {
    expect(() =>
      RecepcionistaOutputSchema.parse({
        texto_limpio: 'x',
        intencion_inicial: 'random',
        falta_info_critica: false,
      }),
    ).toThrow();
  });

  it('Clasificador requires every requiere_* boolean', () => {
    expect(() =>
      ClasificadorOutputSchema.parse({
        tipo: 'bug',
        complejidad: 'baja',
        riesgo: 'bajo',
        siguiente_agente: 'planificador',
      }),
    ).toThrow();
  });

  it('Clasificador accepts the canonical bug case', () => {
    const c = ClasificadorOutputSchema.parse({
      tipo: 'bug',
      complejidad: 'baja',
      requiere_frontend: true,
      requiere_backend: false,
      requiere_db: false,
      requiere_auth: true,
      requiere_integraciones: false,
      riesgo: 'bajo',
      siguiente_agente: 'planificador',
    });
    expect(c.tipo).toBe('bug');
  });

  it('Planificador caps array sizes', () => {
    expect(() =>
      PlanificadorOutputSchema.parse({
        objetivo: 'x',
        alcance: Array(10).fill('y'),
        fuera_de_alcance: [],
        pantallas_afectadas: [],
        flujos_esperados: [],
        criterios_aceptacion: [],
        riesgos: [],
        preguntas_pendientes: [],
      }),
    ).toThrow();
  });

  it('Planificador rejects lazy specs (no criterios, no preguntas)', () => {
    const base = {
      objetivo: 'x',
      alcance: [],
      fuera_de_alcance: [],
      pantallas_afectadas: [],
      flujos_esperados: [],
      riesgos: [],
    };
    expect(() =>
      PlanificadorOutputSchema.parse({ ...base, criterios_aceptacion: [], preguntas_pendientes: [] }),
    ).toThrow();
    expect(() =>
      PlanificadorOutputSchema.parse({ ...base, criterios_aceptacion: [], preguntas_pendientes: ['q'] }),
    ).not.toThrow();
    expect(() =>
      PlanificadorOutputSchema.parse({ ...base, criterios_aceptacion: ['Given/When/Then'], preguntas_pendientes: [] }),
    ).not.toThrow();
  });

  it('Arquitecto accepts a minimal output', () => {
    const a = ArquitectoOutputSchema.parse({
      archivos_probables: ['app/page.tsx'],
      estructura: 'edits in app/page.tsx',
      dependencias_nuevas: [],
      requiere_migracion_db: false,
      requiere_env_vars: [],
      riesgos_tecnicos: [],
      plan_pasos: ['edit page.tsx', 'add test'],
    });
    expect(a.dependencias_nuevas).toEqual([]);
    expect(a.requiere_env_vars).toEqual([]);
  });

  it('AgentError accepts known error codes', () => {
    const e = AgentErrorSchema.parse({ error: 'out_of_scope', reason: 'no app context' });
    expect(e.error).toBe('out_of_scope');
  });

  it('AgentError rejects unknown error codes', () => {
    expect(() => AgentErrorSchema.parse({ error: 'random' })).toThrow();
  });
});
