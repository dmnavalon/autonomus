import { describe, it, expect } from 'vitest';
import { nameToSlug } from '../../packages/telegram-webhook/lib/slug-generator';

describe('nameToSlug', () => {
  it('converts spaces to dashes and lowercases', () => {
    expect(nameToSlug('Cotizador de Vuelos')).toBe('cotizador-de-vuelos');
  });

  it('strips diacritics', () => {
    expect(nameToSlug('Aplicación Móvil')).toBe('aplicacion-movil');
  });

  it('strips punctuation and collapses runs', () => {
    expect(nameToSlug('!! Mi @# Tienda !!')).toBe('mi-tienda');
  });

  it('falls back to "proyecto" when name yields empty', () => {
    expect(nameToSlug('___')).toBe('proyecto');
  });

  it('prepends "p-" if leading char would be non-letter', () => {
    expect(nameToSlug('123 cosa')).toBe('p-123-cosa');
  });

  it('caps at 30 chars', () => {
    const result = nameToSlug('a'.repeat(60));
    expect(result.length).toBeLessThanOrEqual(30);
  });

  it('appends -2 on collision, -3 on next collision', () => {
    expect(nameToSlug('Cotizador', new Set(['cotizador']))).toBe('cotizador-2');
    expect(nameToSlug('Cotizador', new Set(['cotizador', 'cotizador-2']))).toBe('cotizador-3');
  });

  it('truncates base when adding suffix would exceed cap', () => {
    const long = 'a'.repeat(30);
    const r = nameToSlug(long, new Set([long]));
    expect(r.endsWith('-2')).toBe(true);
    expect(r.length).toBeLessThanOrEqual(30);
  });
});
