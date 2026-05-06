# Onboarding — vincular tus apps al bot

Este documento describe cómo decirle al bot de Telegram a qué app(s)
corresponde cada solicitud.

## Modelo

Cada solicitud que envías al bot necesita saber sobre qué app aplica:
- Si tu solicitud es **`software_nuevo`**, no necesitas linkear nada — la
  fábrica crea el repo y lo agrega al registry sola.
- Si tu solicitud es **`bug`, `feature`, `cambio_visual`, `qa_only` o
  `refactor`**, el bot necesita saber qué app es la objetivo. Para eso vas a
  tener que **linkear** la app primero.

## Modelo de proyecto activo

El bot mantiene un *sticky context* por chat_id: cuando eliges un proyecto,
el siguiente mensaje asume el mismo proyecto, hasta que cambies con `/use`.

Resolución por mensaje (en orden):

1. **Sticky**: si tienes `last_active_slug` y todavía está autorizado, se usa.
2. **Única app**: si tienes solo una app linkeada, se usa y se vuelve sticky.
3. **N apps sin sticky**: el bot abre el Issue con `state:pending-app-selection`
   y te muestra botones inline para que elijas. Cuando clickeas, el Issue
   se transiciona a `state:received` y el flujo arranca.
4. **Cero apps**: el bot te muestra el menú de onboarding (este documento).

## Comandos del bot

| Comando | Descripción |
|---|---|
| `/start`, `/id`, `/whoami` | Devuelve tu chat_id (incluso sin auth). |
| `/apps` | Lista tus apps linkeadas, marca la activa. |
| `/use <slug>` | Cambia el proyecto activo. |
| `/current` | Muestra el proyecto activo. |
| `/link <slug> <owner/repo>` | Abre PR para linkear app existente. |
| `/help` | Lista los comandos. |

Cualquier mensaje que no empiece con `/` se trata como solicitud sobre el
proyecto activo (o dispara el menú de selección si no hay activo).

## Cada respuesta del bot lleva header

El bot prepende a cada mensaje:

```
📁 Proyecto: <slug>
```

Si no hay activo: `📁 Proyecto: (sin elegir)`.

## Linkear una app existente — paso a paso

**Pre-requisito.** El código de tu app debe vivir en GitHub bajo tu cuenta
`dmnavalon` (cualquier repo, público o privado).

### Opción A — desde Telegram (recomendado)

```
/link <slug> <owner/repo>
```

Ejemplo:

```
/link mi-tienda dmnavalon/mi-tienda-online
```

El bot abre un PR sobre `dmnavalon/autonomus` que agrega tu app a
`registry/apps.json`. Tienes que mergear ese PR para activar el linkeo.
Después de mergear, espera ~60s (cache del webhook) y ya puedes mandarle
solicitudes al bot sobre esa app.

**Reglas para el slug:**
- lowercase kebab-case
- empieza con letra
- ≤ 30 caracteres

**Reglas para el repo:**
- formato `owner/name`

### Opción B — manual

1. Clona el repo: `gh repo clone dmnavalon/autonomus`
2. Edita `registry/apps.json` y agrega:
   ```json
   {
     "slug": "mi-tienda",
     "repo": "dmnavalon/mi-tienda-online",
     "default_branch": "main",
     "stack": "nextjs",
     "vercel_project_id": null,
     "owner_chat_id": <tu chat_id>,
     "collaborators": [],
     "created_at": "2026-05-05T00:00:00Z"
   }
   ```
3. Commit + push.
4. Espera ~60s para que el cache expire.

## Crear una app nueva (no linkear)

No uses `/link`. Solo describe la app:

> Quiero una app para subir una foto y detectar colores

El bot detecta `software_nuevo`, abre Issue, y la fábrica:

1. Crea el repo `dmnavalon/<slug>` desde el template.
2. Crea el proyecto Vercel.
3. Agrega la entrada en `registry/apps.json`.
4. Abre PR inicial con la feature pedida.

Phase 5 conecta esto a Vercel automáticamente. Mientras tanto, después del
linkeo manual del repo creado, el slug queda disponible para más solicitudes.
