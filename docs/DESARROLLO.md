# Desarrollo de VeriLink

Guía técnica para trabajar con el código. Especificación del producto:
[`MVP.md`](MVP.md) · Arquitectura: [`ARQUITECTURA.md`](ARQUITECTURA.md) ·
Reglas: [`REGLAS.md`](REGLAS.md).

## Requisitos

- Google Chrome (o navegador Chromium) para probar la extensión.
- Node.js 18+ para los tests y regenerar iconos. **No hay dependencias que
  instalar**: no existe `package.json` ni `node_modules`.

## Cargar la extensión en modo desarrollador

1. Abrir `chrome://extensions`
2. Activar **Modo de desarrollador** (esquina superior derecha)
3. **Cargar descomprimida** → seleccionar la carpeta `extension/`
4. Tras cambiar código, pulsar el ícono de recargar en la tarjeta de la
   extensión y recargar las pestañas de prueba.

## Ejecutar los tests

```bash
node --test extension/tests/rules.test.js
```

27 casos que cubren R1–R9, la excepción de dominio oficial, los umbrales de
clasificación, la salida completa del motor y URLs inválidas. El motor es
puro: los tests corren sin navegador y sin red.

## Regenerar iconos

```bash
node tools/generate-icons.mjs
```

Genera `icons/icon{16,48,128}.png` (radar sobre fondo azul oscuro) usando
solo módulos de Node (`node:zlib`). Para cambiar el diseño, se modifica la
función `iconPixel` del propio script.

## Páginas de prueba

| Esperado | Ejemplos |
|---|---|
| Rojo (alto) | `https://paypa1.com/`, `https://paypa1.com/login` (con campo de contraseña → R9) |
| Amarillo (medio) | `https://banorte.login-seguro.xyz/`, `http://192.0.2.10/login` |
| Verde (bajo) | `https://example.com/`, sitios normales |
| Excepción (oficial) | `https://www.google.com/`, `https://mail.google.com/` |

Notas al probar:

- El overlay en la página aparece solo en riesgo **medio/alto**; el popup
  muestra el análisis siempre (incluso en verde).
- «Continuar bajo mi responsabilidad» oculta la alerta hasta recargar.
- En páginas con contenido dinámico, si aparece un campo de contraseña
  después de cargar, la alerta se reevalúa automáticamente.

## Cómo funciona el código (orientación rápida)

| Si quiero… | Ir a |
|---|---|
| Cambiar cómo se calcula el riesgo | `rules.js` → `evaluatePage`, `classify` |
| Editar textos de señales o guía | `rules.js` → `SIGNAL_TEXTS`, `GUIDE_BY_*` |
| Agregar una marca o dominio oficial | `data/brands.js` |
| Cambiar palabras clave o TLD | `rules.js` → `KEYWORDS_R3`, `ABUSED_TLDS` |
| Modificar la alerta en la página | `content/content.js` (estructura), `content/overlay.css` (estilo) |
| Modificar la ficha del popup | `popup/popup.{html,css,js}` |
| Cambiar permisos o qué se inyecta | `manifest.json` |

Convenciones:

- `rules.js` es **puro**: prohibido `document`, `window` y `chrome.*` ahí.
  Los textos derivados de la URL se pintan siempre con `textContent`, nunca
  `innerHTML` (la URL es dato hostil).
- `popup.js` y `content.js` solo orquestan: obtener datos → `evaluatePage` →
  pintar.
- El motor se expone como `globalThis.VeriLinkRules` (script clásico, no
  módulo ES, porque los content scripts de MV3 no admiten `import`).

## Checklist al agregar una regla

1. Función pura `ruleXX` en `rules.js` → `{id, points, match}` o `null`.
2. Invocarla en `evaluatePage` en el orden que corresponda (R9 al final).
3. Texto en `SIGNAL_TEXTS` (+ `GUIDE_BY_SIGNAL` si aporta recomendación).
4. Tests en `tests/rules.test.js` con los ejemplos de la tabla del §7.
5. `node --test extension/tests/rules.test.js` en verde.
6. Actualizar la tabla de [`REGLAS.md`](REGLAS.md) y, si cambia el alcance,
   [`MVP.md`](MVP.md).

## Límites conocidos del MVP

- **Solo el frame principal:** los campos de contraseña dentro de iframes
  embebidos no aportan datos a R9 (`all_frames` está fuera del alcance).
- **«Continuar» no persiste:** se olvida al recargar la pestaña (decisión de
  no usar `chrome.storage`; queda como mejora futura junto con recordar por
  dominio).
- **Listas estáticas:** marcas, palabras y TLDs viven en el código; no hay
  base de amenazas en vivo ni actualización automática (por diseño: todo se
  evalúa localmente, sin servicios externos).
- **La alerta no bloquea:** VeriLink informa y sugiere; la decisión final es
  del usuario (requisito del MVP §3).
- **Posibles falsos positivos:** la comparación por contención (R1/R2) puede
  señalar dominios inocentes que contengan el nombre de una marca. Los
  umbrales (2 puntos para alertar) están puestos para mitigarlo; se ajustan
  con tests si las pruebas con usuarios lo indican.
