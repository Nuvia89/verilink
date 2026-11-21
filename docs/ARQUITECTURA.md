# Arquitectura de VeriLink

Esta describe cómo está construida la extensión: capas, flujo de datos y
decisiones técnicas. Especificación del producto: [`MVP.md`](MVP.md).
Reglas de detección: [`REGLAS.md`](REGLAS.md). Guía técnica: [`DESARROLLO.md`](DESARROLLO.md).

## Vista general

```
                    ┌────────────────────────────┐
                    │        rules.js            │  Motor puro de reglas
                    │  evaluatePage(url, feats)  │  (sin DOM, sin chrome.*)
                    └─────────▲──────────▲───────┘
                              │          │
              pageFeatures    │          │  pageFeatures
              (URL + DOM)     │          │
                              │          │
        ┌─────────────────────┴──┐    ┌──┴──────────────────────┐
        │ content/content.js     │    │ popup/popup.js          │
        │ • detecta campos de    │◄──►│ • pide features por     │
        │   contraseña (R9)      │msg │   mensaje               │
        │ • dibuja el overlay    │    │ • pinta la ficha        │
        │   (Shadow DOM)         │    │   de análisis           │
        └───────────────────────┘    └─────────────────────────┘
```

**Regla de oro:** toda la lógica de detección y puntuación vive en `rules.js`.
`content.js` y `popup.js` son orquestación: obtienen datos, llaman al motor y
pintan. El motor es una función pura, por lo que se ejecuta igual en el
navegador y en Node (de ahí que sea testeable sin un navegador).

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `extension/manifest.json` | Manifest V3: popup, content script, permisos, iconos |
| `extension/rules.js` | Motor: R1–R9, excepción de dominio oficial, umbrales, textos |
| `extension/data/brands.js` | Lista ampliable de marcas y dominios oficiales |
| `extension/popup/popup.{html,css,js}` | Ficha de análisis al hacer clic en el icono |
| `extension/content/content.js` | Detección de datos de página y overlay de alerta |
| `extension/content/overlay.css` | Estilos de la alerta (inyectado en el Shadow DOM) |
| `extension/icons/` | Iconos PNG (16/48/128) |
| `extension/tests/rules.test.js` | Tests del motor con `node:test` |
| `tools/generate-icons.mjs` | Regenerador de iconos sin dependencias |

## Cómo se carga el motor en los tres contextos

`rules.js` es un script clásico (IIFE que publica `globalThis.VeriLinkRules`),
no un módulo ES, porque los content scripts de MV3 no admiten `import`:

- **Content script:** el manifest lista `data/brands.js`, `rules.js`,
  `content.js` en ese orden; comparten el espacio aislado de la extensión.
- **Popup:** las mismas dos primeras vías se cargan con `<script src>` antes
  de `popup.js`.
- **Node (tests):** `require('../data/brands.js')` + `require('../rules.js')`
  y se lee `globalThis.VeriLinkRules`.

`data/brands.js` publica `globalThis.VeriLinkBrands`; el motor lo lee en el
momento de evaluar (por eso se puede ampliar la lista sin tocar `rules.js`).

## Permisos

Solo `host_permissions: ["http://*/*", "https://*/*"]`, necesarios para:

1. Que el content script se inyecte automáticamente en las páginas.
2. Que el popup pueda leer la URL de la pestaña activa.

No hay permisos de almacenamiento, pestañas ni scripting: la decisión
«Continuar bajo mi responsabilidad» vive en memoria del content script y se
olvida al recargar. **Ningún dato sale del navegador**: no hay llamadas a
servicios externos.

## Flujo de una visita

1. `document_idle`: el content script evalúa `evaluatePage(location.href, features)`.
2. Si `score >= 2` (riesgo medio o alto), dibuja el overlay en un Shadow DOM
   (`mode: 'closed'`, con posicionamiento vía CSSOM para no chocar con la CSP
   de la página). Los textos se crean con `textContent` (nunca `innerHTML`).
3. Si la página inserta un campo de contraseña después (formularios
   dinámicos), un `focusin` y un `MutationObserver` (con throttle de 300 ms)
   reevalúan para que R9 se sume a tiempo.
4. Al hacer clic en el icono, el popup consulta la URL activa y pide
   `pageFeatures` al content script por mensaje (`verilink:features`); si el
   content script aún no está listo, reintenta una vez a los 400 ms.
5. El popup pinta la misma evaluación que vería el overlay (pueden diferir
   solo si la página cambia entre ambos momentos).

## Mensajería popup ↔ content

| Mensaje | Dirección | Respuesta |
|---|---|---|
| `{type: 'verilink:features'}` | popup → content | `{hasSensitiveField: boolean}` |
| `{type: 'verilink:dismiss'}` | popup → content | `{ok: true}` (oculta la alerta) |

Sin content script (páginas `chrome://`, pestañas sin cargar), el popup
devuelve `{}`: R9 queda sin evaluar y el análisis de URL sigue funcionando.

## Decisiones técnicas y alternativas descartadas

| Decisión | Motivo |
|---|---|
| Sin service worker (`background`) | Todo se resuelve con el content script y mensajes; menos piezas que romper |
| Overlay en **Shadow DOM** | Los estilos/JS de la página (potencialmente hostil) no pueden romper la alerta |
| `host_permissions` amplios | El MVP pide alerta automática al entrar a la página; la alternativa `activeTab` exigiría clic previo |
| Excepción por **sufijo** de dominio | `mail.google.com` también es oficial; el punto final evita falsos positivos (`paypal.com.evil.com` no exime) |
| Motor compartido por script clásico | Único archivo ejecutable en navegador y Node sin build ni dependencias |
| Solo frame principal | Simplifica mensajería; anotado como límite en [`DESARROLLO.md`](DESARROLLO.md) |
