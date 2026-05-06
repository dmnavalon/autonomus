# Onboarding — empezar a trabajar con el bot

Este documento describe cómo elegir, crear o vincular un proyecto desde Telegram, sin tipear comandos técnicos.

## Cómo se eligen los proyectos

El bot mantiene un proyecto activo por usuario. Cada respuesta del bot lo
muestra en el header:

```
📁 Proyecto: <nombre>
```

Cuando mandás un mensaje:

1. Si tenés un proyecto activo, se usa ese y se crea el Issue.
2. Si tenés varios proyectos pero ninguno activo, el bot te muestra una lista
   de botones para elegir.
3. Si tenés un solo proyecto, se usa automáticamente y queda como activo.
4. Si no tenés ninguno, el bot te muestra un menú con tres opciones:

```
[➕ Crear proyecto]
[🔗 Vincular GitHub]
[❌ Cancelar]
```

## Crear un proyecto nuevo (asistente, 4 pasos)

1. Click en **➕ Crear proyecto**.
2. El bot pregunta: *"¿Cómo quieres llamar a tu proyecto?"*. Respondes con un
   nombre humano (ej. `Cotizador de vuelos`).
3. *"¿Una descripción corta?"* (opcional, escribí `skip` para saltar).
4. *"¿Qué tipo de app es?"* — elegí entre `Web`, `SaaS`, `Dashboard`, `Bot`,
   `API`, `Otro`.
5. El bot te muestra un resumen con el nombre interno auto-generado (ej.
   `cotizador-de-vuelos`) y el repo destino. Click en **✅ Confirmar**.

Al confirmar, el bot:

- Crea un repo privado nuevo en `dmnavalon/<nombre-interno>`.
- Abre un PR en `dmnavalon/autonomus` agregando tu proyecto al registro.
- Te manda el link del repo y del PR.

Para que el bot empiece a aceptar solicitudes sobre ese proyecto, **mergea el
PR**. ~60 segundos después ya está activo.

## Vincular un proyecto existente de GitHub

1. Click en **🔗 Vincular GitHub**.
2. El bot lista tus repos disponibles (excluyendo los ya vinculados, los
   archivados y los forks). Hasta 8 por página, con paginación.
3. Click en el repo que querés vincular.
4. El bot pregunta: *"¿Cómo quieres llamar a este proyecto en el bot?"*. Si
   escribís `skip` usa el nombre del repo.
5. Abre un PR en `dmnavalon/autonomus`. Mergealo y el proyecto queda activo.

## Comandos útiles

| Comando | Para qué sirve |
|---|---|
| `/apps` | Lista tus proyectos vinculados |
| `/use <nombre>` | Cambia el proyecto activo (acepta nombre o slug, prefijo) |
| `/current` | Muestra el proyecto activo |
| `/cancel` | Aborta el asistente actual |
| `/help` | Lista los comandos |
| `/start`, `/id`, `/whoami` | Devuelve tu chat_id |

## Modo avanzado (opcional)

Si preferís no usar el asistente, también podés escribir el comando manual:

```
/link <nombre-interno> <usuario/repo>
```

Ejemplo:

```
/link mi-tienda dmnavalon/mi-tienda-online
```

El nombre interno (`slug`) debe ser kebab-case lowercase, ≤30 caracteres.
El bot abre un PR de la misma forma que el asistente.

## Crear una app desde cero con código generado por IA

Si en lugar de "vincular un repo que ya existe" o "crear un repo vacío" querés
que la fábrica genere código desde cero (UI + backend basados en una
descripción), describí la app directamente:

> "Quiero una app para subir una foto y detectar colores"

El bot detecta esto como tipo `software_nuevo` y la fábrica se encarga de
crear el repo + scaffolding + primer feature.
