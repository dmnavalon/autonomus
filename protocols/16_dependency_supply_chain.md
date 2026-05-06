# 16 — Dependencias y supply chain

**Aplicación**: Obligatorio cuando se agregan paquetes, scripts, GitHub Actions o
dependencias externas.

## Reglas

1. NO instalar paquetes innecesarios.
2. Preferir dependencias mantenidas, populares y compatibles con el stack.
3. Revisar licencias y riesgos si aplica.
4. NO usar scripts `postinstall` sospechosos ni paquetes abandonados para tareas críticas.
5. Registrar toda dependencia nueva en PR.

## Criterios para aceptar dep nueva

- [ ] Listada en `dependencias_nuevas` del Arquitecto con `reason`.
- [ ] Última versión en npm < 30 días old O package mainstream.
- [ ] Última publicación < 1 año (no abandoned).
- [ ] No tiene `postinstall` script suspicious (descarga binarios, ejecuta shell).
- [ ] License compatible (MIT, Apache 2.0, BSD, ISC). GPL / AGPL → review humana.
- [ ] No es typosquatting (verifica nombre exacto, no `expresss` ni `lodassh`).

## GitHub Actions

- Pin actions a SHA, no a tag mutable: `actions/checkout@v4` está OK (verified by GitHub).
- Tercera party actions: pin a SHA + audit del repo source.
- No actions con permisos write sin necesidad.

## Stack canónico (no agregar deps que dupliquen estas)

- Test runner: vitest
- E2E: Playwright
- Schema validation: Zod
- HTTP client: built-in `fetch`
- GitHub API: `@octokit/rest`
- Web framework: Next.js App Router (en `packages/telegram-webhook`)
- TypeScript: strict mode

## Anti-patrones

- Lock file commiteado pero deps en `dependencies` desactualizadas.
- Dep con `postinstall: "node setup.js"` sin auditar.
- Múltiples libs para lo mismo (`lodash` + `ramda` + `underscore`).
- Pinning de major sin lock file.
