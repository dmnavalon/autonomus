# Flow: software_nuevo

A user wants a brand-new application.

## Entry condition

Clasificador returns `tipo=software_nuevo`.

## Steps

1. **Recepcionista** → confirm intent, no `falta_info_critica`.
2. **Clasificador** → confirms `tipo=software_nuevo`, sets `complejidad=alta`.
3. **Planificador** → minimal viable spec: name (slug), purpose, 1–3 screens, 3–5 acceptance
   criteria. If user did not give a name, derive a slug like `<verb>-<noun>`.
4. **Arquitecto** → confirms template `templates/nextjs-vercel-app/`, lists initial files,
   identifies env vars (e.g. none for a static demo).
5. **Coordinator side-effect**: create new GitHub repo `dmnavalon/<slug>` from the template,
   add entry to `registry/apps.json` with `{ slug, repo, vercel_project_id, owner_chat_id }`.
6. **Coordinator side-effect**: trigger Vercel project creation linked to the new repo
   (via Vercel REST API, default branch `main`).
7. **Programador** → opens initial PR `factory/<issue-number>` against `main` with the
   user-requested feature on top of the template (so the PR is reviewable, not the whole
   template).
8. **Vercel Preview** appears on the PR. **Playwright** runs the auto-generated
   "smoke + happy path" suite.
9. Standard repair loop if needed.

## Special rules

- Slug must be lowercase kebab-case, ≤30 chars, unique under `dmnavalon/*`.
- The new repo is private by default.
- Vercel project name = slug. Production deploys are NOT enabled.
- Telegram message on completion uses the human-review-required template, plus:
  `"App creada: dmnavalon/<slug>. Preview: <url>. PR: <url>."`
