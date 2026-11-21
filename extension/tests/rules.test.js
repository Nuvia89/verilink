/**
 * VeriLink — Tests del motor de reglas (R1..R9, excepción y umbrales).
 * Ejecutar con:  node --test extension/tests/
 * Sin dependencias externas: usa el módulo de tests integrado de Node.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// El motor es un script clásico (igual que en la extensión): lo cargamos y
// leemos desde el espacio global, igual que harán popup y content script.
require('../data/brands.js');
require('../rules.js');

const { evaluatePage, classify } = globalThis.VeriLinkRules;

function ids(result) {
  return result.signals.map((s) => s.id);
}

// ---------------------------------------------------------------------------
// Regla de excepción: dominio oficial
// ---------------------------------------------------------------------------

test('excepción: dominio oficial exacto => 0 puntos, sin evaluar R1..R8', () => {
  const r = evaluatePage('https://www.sat.gob.mx/tramites/305499');
  assert.equal(r.exempt, true);
  assert.equal(r.score, 0);
  assert.equal(r.level, 'bajo');
  assert.equal(r.signals.length, 0);
});

test('excepción: subdominio de un dominio oficial también cuenta', () => {
  const r = evaluatePage('https://mail.google.com/inbox');
  assert.equal(r.exempt, true);
  assert.equal(r.score, 0);
});

test('excepción: un dominio oficial sin HTTPS no suma R6 (no se evalúan R1..R8)', () => {
  const r = evaluatePage('http://www.bbva.mx/');
  assert.equal(r.exempt, true);
  assert.equal(r.score, 0);
});

// ---------------------------------------------------------------------------
// R1 — dominio parecido a una marca (3 pts)
// ---------------------------------------------------------------------------

test('R1: número por letra (paypa1.com) y mezcla R4 => 4 puntos (alto)', () => {
  const r = evaluatePage('https://paypa1.com/');
  assert.ok(ids(r).includes('R1'), 'debe detectar R1');
  assert.ok(ids(r).includes('R4'), 'paypa1 mezcla letras y números (R4)');
  assert.equal(r.score, 4);
  assert.equal(r.level, 'alto');
});

test('R1: letras añadidas (bbva-mexico.com) => 3 puntos (medio)', () => {
  const r = evaluatePage('https://bbva-mexico.com/');
  assert.ok(ids(r).includes('R1'));
  assert.equal(r.score, 3);
  assert.equal(r.level, 'medio');
});

test('R1: variante con separadores (pay-pal.com) => detecta R1', () => {
  const r = evaluatePage('https://pay-pal.com/');
  assert.ok(ids(r).includes('R1'));
});

// ---------------------------------------------------------------------------
// R2 — marca en subdominio/ruta con dominio real distinto (2 pts)
// ---------------------------------------------------------------------------

test('R2: marca en el subdominio de otro dominio (banorte.login-seguro.xyz)', () => {
  const r = evaluatePage('https://banorte.login-seguro.xyz/');
  assert.ok(ids(r).includes('R2'));
  assert.ok(ids(r).includes('R7'), 'el TLD .xyz también suma');
  assert.equal(r.score, 3); // R2 (2) + R7 (1)
  assert.equal(r.level, 'medio');
});

test('R2: marca en la ruta de un dominio ajeno', () => {
  const r = evaluatePage('https://evil-mx.com/banorte/login');
  assert.ok(ids(r).includes('R2'));
  assert.ok(r.score >= 2);
});

test('R2: la marca como subdominio de su propio dominio oficial no cuenta (excepción)', () => {
  const r = evaluatePage('https://www.banorte.com/personas');
  assert.equal(r.exempt, true);
  assert.equal(r.score, 0);
});

// ---------------------------------------------------------------------------
// R3 — palabras de premio/urgencia/verificación (1 a 2 pts)
// ---------------------------------------------------------------------------

test('R3: suma 1 punto por palabra y máximo 2', () => {
  const r = evaluatePage('https://promo.ganaste-urgente.top/premio-oferta');
  const r3 = r.signals.find((s) => s.id === 'R3');
  assert.ok(r3, 'debe detectar R3');
  assert.equal(r3.points, 2); // ganaste, urgente, premio, oferta => tope 2
});

test('R3: una sola palabra => 1 punto', () => {
  const r = evaluatePage('https://verifica-datos.com/');
  const r3 = r.signals.find((s) => s.id === 'R3');
  assert.ok(r3);
  assert.equal(r3.points, 1);
});

test('R3: direcciones normales no disparan palabras clave', () => {
  const r = evaluatePage('https://documentacion.ejemplo.com/guias');
  assert.ok(!ids(r).includes('R3'));
});

// ---------------------------------------------------------------------------
// R4 — dominios con rasgos poco habituales (1 pt)
// ---------------------------------------------------------------------------

test('R4: guiones excesivos y mezcla de letras y números => 1 punto', () => {
  const r = evaluatePage('https://mi-banco-seguro-2026.com/');
  const r4 = r.signals.find((s) => s.id === 'R4');
  assert.ok(r4);
  assert.equal(r4.points, 1); // la regla cuenta una sola vez
  assert.equal(r.score, 1);
  assert.equal(r.level, 'bajo');
});

// ---------------------------------------------------------------------------
// R5 y R6 — IP y falta de HTTPS
// ---------------------------------------------------------------------------

test('R5 + R6: IP sin HTTPS => 3 puntos (medio)', () => {
  const r = evaluatePage('http://192.0.2.10/login');
  assert.ok(ids(r).includes('R5'));
  assert.ok(ids(r).includes('R6'));
  assert.equal(r.score, 3);
  assert.equal(r.level, 'medio');
});

test('R5: IPv6 también se reconoce como IP', () => {
  const r = evaluatePage('http://[::1]/');
  assert.ok(ids(r).includes('R5'));
});

test('R6: HTTPS no suma puntos', () => {
  const r = evaluatePage('https://example.com/');
  assert.ok(!ids(r).includes('R6'));
});

// ---------------------------------------------------------------------------
// R7 — TLD abusado
// ---------------------------------------------------------------------------

test('R7: TLD frecuentemente abusado => 1 punto', () => {
  const r = evaluatePage('https://noticiaszip.zip/');
  assert.ok(ids(r).includes('R7'));
});

// ---------------------------------------------------------------------------
// R8 — formato inusual de la URL
// ---------------------------------------------------------------------------

test('R8: URL con @ => 1 punto', () => {
  const r = evaluatePage('https://sitio.com@otro.com/');
  assert.ok(ids(r).includes('R8'));
  assert.equal(r.score, 1);
});

test('R8: URL de más de 100 caracteres => 1 punto', () => {
  const longUrl = 'https://example.com/' + 'a'.repeat(95);
  const r = evaluatePage(longUrl);
  assert.ok(ids(r).includes('R8'));
});

test('R8: 4 o más subdominios => 1 punto', () => {
  const r = evaluatePage('https://a.b.c.d.example.com/');
  assert.ok(ids(r).includes('R8'));
});

// ---------------------------------------------------------------------------
// R9 — datos sensibles con puntos previos
// ---------------------------------------------------------------------------

test('R9: campo sensible + puntos de otras reglas => +2 puntos', () => {
  const r = evaluatePage('https://paypa1.com/login', { hasSensitiveField: true });
  assert.ok(ids(r).includes('R9'));
  assert.equal(r.score, 6); // R1 (3) + R4 (1) + R9 (2)
  assert.equal(r.level, 'alto');
});

test('R9: sin puntos de otras reglas no se activa', () => {
  const r = evaluatePage('https://example.com/', { hasSensitiveField: true });
  assert.ok(!ids(r).includes('R9'));
  assert.equal(r.score, 0);
});

test('R9: sin datos de página no se activa (popup sin content script)', () => {
  const r = evaluatePage('https://paypa1.com/login');
  assert.ok(!ids(r).includes('R9'));
});

// ---------------------------------------------------------------------------
// Umbrales de clasificación
// ---------------------------------------------------------------------------

test('umbrales: 0-1 bajo, 2-3 medio, 4+ alto', () => {
  assert.equal(classify(0), 'bajo');
  assert.equal(classify(1), 'bajo');
  assert.equal(classify(2), 'medio');
  assert.equal(classify(3), 'medio');
  assert.equal(classify(4), 'alto');
  assert.equal(classify(9), 'alto');
});

// ---------------------------------------------------------------------------
// Salida general
// ---------------------------------------------------------------------------

test('la salida siempre incluye nivel, radar, señales y guía', () => {
  const r = evaluatePage('https://banorte.login-seguro.xyz/');
  assert.equal(typeof r.score, 'number');
  assert.ok(['bajo', 'medio', 'alto'].includes(r.level));
  assert.ok(['verde', 'amarillo', 'rojo'].includes(r.radar));
  assert.ok(Array.isArray(r.signals) && r.signals.length > 0);
  assert.ok(Array.isArray(r.guide) && r.guide.length > 0);
  for (const s of r.signals) {
    assert.ok(s.title.length > 0, 'toda señal tiene título');
    assert.ok(s.why.length > 0, 'toda señal tiene explicación');
  }
});

test('URL inválida no lanza excepciones', () => {
  const r = evaluatePage('esto no es una URL');
  assert.equal(r.invalid, true);
  assert.equal(r.score, 0);
  assert.equal(r.signals.length, 0);
});

test('el radar coincide con el nivel', () => {
  assert.equal(evaluatePage('https://example.com/').radar, 'verde');
  assert.equal(evaluatePage('http://192.0.2.10/').radar, 'amarillo');
  assert.equal(evaluatePage('https://paypa1.com/login', { hasSensitiveField: true }).radar, 'rojo');
});
