# 17 — Privacidad y datos

**Aplicación**: Obligatorio si hay datos personales, documentos de usuarios, logs sensibles
o contenido de clientes.

## Reglas

1. Minimizar datos personales en prompts, logs y artifacts.
2. NO exponer datos de clientes en mensajes de Telegram si no es necesario.
3. Redactar o resumir información sensible antes de enviarla a modelos.
4. NO usar datos privados para ejemplos salvo que el usuario lo entregue explícitamente.
5. Registrar riesgos de privacidad en PR cuando corresponda.

## Datos sensibles típicos

- `chat_id`, `username`, IP del usuario.
- Email, teléfono, dirección.
- IDs internos (DB, GUIDs).
- Contenido de mensajes / documentos del usuario más allá del strictly necesario.

## Sanitización antes de pasar al LLM

- Trunca mensaje a `≤ 500 chars` después de cleaning.
- Strip de URLs sin sentido.
- No incluir `attachments_metadata` con paths de filesystem del usuario.
- Para logs: redactar emails, IPs, tokens patterns.

## Storage y retención

- Issue body: contiene `chat_id` (lo mínimo para correlación). NO incluir email ni teléfono.
- Artifacts: retention 14 días por default. Logs sensibles → retention reducido.
- `registry/users.json`: solo `chat_id`, `username`, `role`. NO email.

## Mensaje al usuario (Telegram)

- Lo mínimo para que entienda el resultado.
- Cero stack traces.
- Cero paths del filesystem.
- Cero contenido de otros usuarios (multi-tenant safety).

## Anti-patrones

- Logear `update.message` completo de Telegram (incluye `from.id`, `from.username`, etc.).
- Pasar el body completo de Issue como contexto al LLM cuando un resumen alcanza.
- Enviar datos del usuario en feedback al desarrollador sin consent.
- Usar datos reales en tests / fixtures.
