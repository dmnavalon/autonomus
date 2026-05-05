# Flow: cambio_visual

A user wants to change copy, images, colors, layout, or other purely-visual aspects.

## Entry

Clasificador returns `tipo=cambio_visual`. Target app required.

## Steps

1. Recepcionista → Clasificador.
2. **Skip Planificador** — visual changes have no behavioral spec. The Coordinator
   constructs a minimal `spec` from the cleaned text directly.
3. Arquitecto identifies the file(s) (component, asset, CSS module).
4. Programador edits only the files listed; never touches state, data fetching, or routes.
5. QA Planner emits 1 `visual` test (screenshot diff) + 1 `responsive` test if layout was
   touched. No flow tests.
6. Playwright captures screenshots; Analista compares against baseline if one exists.

## Special rules

- Image replacements: the user must attach the image to Telegram. The webhook downloads it
  via Telegram `getFile` API and commits it to the target repo's `public/` folder. New
  filename = original kebab-case slug.
- Color / token changes: only valid if the app uses a centralized theme file (Tailwind
  config, CSS variables). If hardcoded throughout, Architect returns
  `{ "error": "out_of_scope", "reason": "color usage decentralized" }`.
- Tier always `mid` (Programador can use mid here, not strong) → cheaper jobs.
