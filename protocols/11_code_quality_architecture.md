# 11 — Calidad de código y arquitectura

**Aplicación**: Obligatorio para Arquitecto, Programador, Revisor de Código y Reparador.

## Reglas

1. Preferir cambios pequeños, reversibles y localizados.
2. NO agregar dependencias sin justificar (cada una con `reason` no vacío).
3. Respetar estructura del repo, convenciones, TypeScript y lint.
4. Mantener separación de responsabilidades.
5. Actualizar tests cuando el cambio modifica comportamiento user-visible.

## Convenciones del monorepo

- TypeScript strict (`strict: true`, `noUncheckedIndexedAccess`).
- Workspaces: `packages/orchestrator`, `packages/telegram-webhook`, `packages/shared`.
- Imports relative dentro del package, `@autonomus/<workspace>` cross-package.
- Exports nombrados (no `default export` salvo Next.js routes).
- Sin emojis en código (sí permitidos en mensajes de Telegram).

## Reglas de cambio

- **Pequeño**: 5 líneas mejor que 50.
- **Reversible**: feature flag o config-driven cuando posible.
- **Localizado**: stay within `archivos_probables` del Arquitecto.
- **Reusable**: si ya existe `lib/auth.ts`, NO crear `lib/auth2.ts`.

## Tests

- Unit tests via Vitest en `tests/factory/`.
- E2E via Playwright en `e2e/factory/<n>.spec.ts` (rama del job).
- 1-3 tests focalizados > 50 tests irrelevantes.
- Cada bug reparado debe tener test que lo cubra cuando viable.

## Lint / typecheck

- `npm run lint` (Prettier + reglas mínimas).
- `npm run typecheck` (tsc --noEmit en cada workspace).
- `npm run test:factory` antes de commit.

## Anti-patrones

- Refactor masivo sin justificación.
- Dep nueva por conveniencia (si una función estándar alcanza, no usar lib).
- `any` en TypeScript salvo justificado con comentario.
- "Drive-by" cleanup de archivos no relacionados al cambio.
