# 19 — Assets y multimedia

**Aplicación**: Obligatorio para cambios de imagen, video, documentos, uploads, storage
y medios.

## Reglas

1. Cambios de imagen o media deben preservar performance y accesibilidad.
2. Usar `alt` text descriptivo si la imagen transmite información.
3. Optimizar tamaño / formato cuando sea razonable.
4. NO usar assets con derechos dudosos.
5. NO borrar assets existentes sin comprobar referencias.

## Formatos recomendados

| Tipo | Formato | Notas |
|---|---|---|
| Foto | WebP, AVIF (fallback JPEG) | calidad 80-85 |
| Ilustración | SVG | inline cuando posible |
| Logo | SVG | optimizado con SVGO |
| Video | MP4 (H.264) + WebM | poster image obligatoria |
| Audio | MP3 + Ogg | controls visibles |
| Documento | PDF | size < 5MB cuando posible |

## Performance budget

- Imagen above-the-fold: ≤ 200 KB.
- Imagen lazy-loaded: ≤ 500 KB.
- Total page weight (HTML + CSS + JS + images): ≤ 1 MB para pages estáticas.
- Video: usa lazy load; no autoplay con sonido.

## Accesibilidad

- `<img alt="...">` descriptivo.
- `alt=""` solo cuando la imagen es decorativa pura.
- Video: subtítulos / captions cuando contiene voz / información crítica.
- Color: nunca usar color como única señal.

## Storage

- Vercel Blob para uploads dinámicos.
- `/public/` solo para assets estáticos versionados con el código.
- NO commitear binarios > 1 MB sin justificación (Git LFS o storage externo).

## Borrado de assets

Antes de borrar:
- [ ] grep referencias en código (`grep -r "filename"`).
- [ ] grep en CSS / SCSS.
- [ ] grep en docs / markdown.
- [ ] verificar OG tags / metadata.

## Anti-patrones

- PNG cuando WebP/AVIF alcanza.
- Imagen sin `width` / `height` (CLS issues).
- Video autoplay con sonido.
- Asset con copyright incierto.
- Borrar imagen referenciada en `<meta property="og:image">`.
