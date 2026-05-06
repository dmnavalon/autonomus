# 09 — Auth, password y sesiones

**Aplicación**: Obligatorio cuando hay login, logout, password, recovery, roles, permisos,
sesiones o MFA.

Referencia: NIST SP 800-63B (https://pages.nist.gov/800-63-4/sp800-63b.html).

## Reglas

1. Logout debe invalidar estado local Y sesión servidor si aplica.
2. NO guardar passwords en texto plano ni logs.
3. Usar mecanismos seguros de reset, rate limit y MFA si el contexto lo requiere.
4. Passwords deben aceptarse como `memorized secrets` robustos, evitando reglas arbitrarias
   innecesarias (la única regla canónica es longitud mínima ≥ 8).
5. NO exponer tokens en URL, consola, storage inseguro ni PR.

## Checklist por flujo

### Login
- [ ] Rate limit (≥ 5 intentos / minuto / IP).
- [ ] Hashing: bcrypt / argon2 / scrypt; NO MD5 / SHA1.
- [ ] Cookies con `HttpOnly`, `Secure`, `SameSite=Lax|Strict`.
- [ ] Mensajes de error genéricos (no revelar si email existe).

### Logout
- [ ] `cookie.delete('session')` (o equivalent).
- [ ] Server-side session invalidate.
- [ ] Redirect a `/login` o landing pública.

### Password reset
- [ ] Token único, expiración ≤ 1 hora.
- [ ] Rate limit por email.
- [ ] No reutilizar password anteriores N veces si la app lo requiere.

### MFA (cuando aplique)
- [ ] TOTP (RFC 6238) o WebAuthn.
- [ ] Recovery codes (10 códigos one-time).
- [ ] No exponer secret TOTP en logs.

## Anti-patrones

- Comparar password con `==` (timing attack).
- Logear el password (incluso en error).
- Token de reset persistente.
- "Forgot password?" que confirma si email existe.
