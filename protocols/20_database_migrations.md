# 20 — Base de datos y migraciones

**Aplicación**: Obligatorio si hay schema, migraciones, RLS, seed data o cambios destructivos.

## Reglas

1. Toda migración debe ser revisable, reversible cuando sea posible y NO destructiva por default.
2. NO borrar tablas / columnas / datos sin aprobación humana.
3. Documentar impacto, rollback y datos afectados.
4. Separar cambios de schema de seed / test data.
5. Validar RLS / permisos si aplica.

## Patrón de migración segura

### Fase 1: aditiva (no rompe lectores existentes)
```sql
-- Adds new column with safe default. Existing readers ignore it.
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'viewer';
```

### Fase 2: backfill (poblar datos)
```sql
UPDATE users SET role = 'owner' WHERE id = 1;
```

### Fase 3: switch (los lectores empiezan a usar la nueva columna)
Deploy de código que lee `role`.

### Fase 4 (opcional): cleanup (después de N días sin lectores antiguos)
```sql
-- Solo si N días pasaron y nadie lee la versión vieja.
ALTER TABLE users DROP COLUMN legacy_field;
```

## Operaciones BLOQUEADAS por el Guardian

- `DROP TABLE` (cualquier tabla)
- `TRUNCATE`
- `DELETE FROM <tabla> ;` (sin WHERE)
- Cambio de tipo de columna que pierde datos (TEXT → INTEGER no implícitamente seguro)
- `ALTER TABLE ... DROP COLUMN` sin proceso de fase 4
- Removal de constraints (FK, NOT NULL, UNIQUE) sin justificación

## RLS (Row-Level Security)

Si usas Supabase / Postgres con RLS:
- Cada tabla nueva debe tener policy explícita.
- Default deny: `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`
- Test las policies con usuarios de cada rol.

## Seed data

- Separar `migrations/` (schema) de `seed/` (datos test).
- NO commitear datos reales.
- Seed debe ser idempotente (re-ejecutable sin error).

## Rollback documentation

Cada migración debe acompañarse de rollback:
```sql
-- migration: 0042_add_role.sql
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'viewer';

-- rollback: 0042_add_role.down.sql
ALTER TABLE users DROP COLUMN role;
```

## Anti-patrones

- Migración que combina schema change + data change en una transacción.
- `DROP COLUMN` sin period de transición.
- Migración sin rollback documentado.
- Seed con datos de producción reales.
