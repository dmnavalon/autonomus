# 08 — UX / UI y accesibilidad

**Aplicación**: Obligatorio para agentes que crean o revisan interfaz, textos visibles,
formularios, estados, responsive y navegación.

Referencia: WCAG 2.2 (https://www.w3.org/TR/WCAG22/).

## Reglas

1. Mantener el look and feel existente salvo instrucción contraria.
2. Todo estado crítico debe tener `loading`, `empty`, `error` y `success`.
3. Formularios deben tener labels, validaciones, errores comprensibles y navegación por teclado.
4. Cumplir contrastes, foco visible, tamaños de click / tap y estructura semántica razonable
   según WCAG 2.2.
5. NO rediseñar por gusto: cambios visuales deben estar justificados por la solicitud.

## Checklist por feature

- [ ] Estados loading / empty / error / success cubiertos.
- [ ] Labels en `<input>` (no solo placeholder).
- [ ] Errores user-friendly (no stack traces).
- [ ] `tabIndex` y orden de foco coherente.
- [ ] Contraste WCAG AA (≥ 4.5:1 texto normal, ≥ 3:1 texto grande).
- [ ] Touch targets ≥ 44×44 px en mobile.
- [ ] Imágenes con `alt` descriptivo (vacío `alt=""` solo si decorativa).
- [ ] Skip links / landmarks (`<main>`, `<nav>`, `<aside>`).
- [ ] Mensajes de éxito / error vía `aria-live` cuando dinámicos.

## Selectors estables (para Playwright)

Preferencia: `data-testid` > role-based (`getByRole`) > label-based (`getByLabel`) > text > CSS.

## Responsive

- Mobile-first cuando posible.
- Test viewport 375px (mobile) además de desktop default.
- No hidden content via `display: none` para evitar accesibilidad.

## Anti-patrones

- Botones sin `aria-label` cuando solo tienen ícono.
- Confiar en color para transmitir estado (color-blind).
- Texto hardcodeado en imágenes (no readable por screen reader).
- Modales que atrapan el foco mal o sin escape key.
