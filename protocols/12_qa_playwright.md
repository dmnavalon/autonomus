# 12 — QA con Playwright

**Aplicación**: Obligatorio para QA Planner, Playwright Agent, Log Analyst,
Final Verifier y Reparador.

Referencias: Playwright CI (https://playwright.dev/docs/ci) +
Trace Viewer (https://playwright.dev/docs/trace-viewer).

## Reglas

1. Priorizar smoke tests y flujos críticos.
2. Playwright debe correr contra **Vercel Preview** cuando exista.
3. Guardar screenshots / traces / reports en artifacts SOLO cuando falle.
4. Cada bug reparado debe tener al menos un test que lo cubra si es viable.
5. NO declarar aprobación si falta build / lint / typecheck / QA crítico.

## Configuración estándar

`playwright.config.ts` debe enforcing:

```typescript
use: {
  baseURL: process.env.PREVIEW_URL,
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
}
```

## Selectors estables

Preferencia: `data-testid` > `getByRole` > `getByLabel` > text > CSS selector.

## Reglas de tests generados

1. `page.goto(preview_url + "/...")` — nunca hardcodear localhost.
2. Cada test termina con `expect(...)`.
3. Sin `test.skip` ni `test.fixme`.
4. Determinismo: NO `Math.random`, NO `waitForTimeout` (usar `waitFor*`).
5. Mobile responsive: viewport 375px cuando aplique.

## Plan QA (`11_qa_planner` output)

- Máximo 5 tests (8 para `qa_only`).
- Siempre 1 `critica` (happy path) + 1 `alta` (error case principal).
- Para `cambio_visual`: 1 `visual` (screenshot diff).
- Para responsive: 1 `responsive` (375px).

## Workflow

`.github/workflows/qa-playwright.yml`:
- Trigger: `deployment_status` con `state=success` y URL Vercel.
- Run: `npx playwright test --reporter=list,json`.
- Parse `playwright-report/results.json`.
- Comment Issue con `PlaywrightExecutionOutput`.
- Upload artifact `playwright-report-<run_id>` (retention 14d).

## Anti-patrones

- Tests sin `expect`.
- Selectors frágiles (CSS deep, índice de array).
- Esperar tiempo fijo (`page.waitForTimeout(5000)`).
- Tests que dependen de orden.
- Tests que usan datos reales de producción.
