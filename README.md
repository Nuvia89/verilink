# VeriLink — MVP

Extensión para Chrome (Manifest V3, HTML/CSS/JS vanilla, sin dependencias) que
detecta señales de riesgo en páginas web, explica qué encontró y sugiere cómo
actuar. Especificación completa en [`docs/MVP.md`](docs/MVP.md).

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/MVP.md`](docs/MVP.md) | Especificación del producto (qué es y qué debe hacer) |
| [`docs/USUARIO.md`](docs/USUARIO.md) | Manual de usuario: radar, alerta, opciones y privacidad |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Estructura, capas, flujo de datos, permisos y decisiones técnicas |
| [`docs/REGLAS.md`](docs/REGLAS.md) | Especificación operativa de R1–R9, listas configurables y cómo agregar reglas |
| [`docs/DESARROLLO.md`](docs/DESARROLLO.md) | Guía técnica: tests, iconos, checklist de cambios y límites conocidos |

## Estructura

```
extension/
├── manifest.json          # Manifest V3 (permisos: solo host_permissions http/https)
├── rules.js               # ⚙ Motor de reglas: funciones puras, sin DOM ni chrome.*
├── data/brands.js         # Marcas y dominios oficiales (ampliable)
├── popup/                 # Ficha de análisis al hacer clic en el icono
│   ├── popup.html
│   ├── popup.css
│   └── popup.js           # Orquestación: URL + features -> rules.js -> pintar
├── content/               # Alerta inyectada en la página (Shadow DOM)
│   ├── content.js         # Detección de pageFeatures + overlay + mensajes
│   └── overlay.css
├── icons/                 # Generados con tools/generate-icons.mjs
└── tests/rules.test.js    # Tests del motor (node:test, sin dependencias)
tools/generate-icons.mjs   # Regenera los iconos PNG
```

**Separación de capas:** `rules.js` es un motor puro (entran datos, salen
datos). `popup.js` y `content.js` solo obtienen datos, llaman al motor y
pintan. `R9` recibe `pageFeatures.hasSensitiveField` como entrada, aportada
por el content script (quien tiene acceso al DOM).

## Instalar en modo desarrollador

1. Abrir `chrome://extensions`
2. Activar **Modo de desarrollador**
3. **Cargar descomprimida** → seleccionar la carpeta `extension/`
4. Visitar una página de prueba (ver abajo) y hacer clic en el icono VeriLink

## Pruebas del motor (sin instalar nada)

```bash
node --test extension/tests/rules.test.js
```

Cubren R1–R9, la regla de excepción (dominio oficial), los umbrales
(0–1 verde / 2–3 amarillo / 4+ rojo) y casos de ejemplo de `docs/MVP.md`.

Regenerar iconos:

```bash
node tools/generate-icons.mjs
```

## Páginas de prueba

| Página esperada | Ejemplo |
|---|---|
| Rojo (alto) | `https://paypa1.com/` · `https://paypa1.com/login` (con campo de contraseña) |
| Amarillo (medio) | `https://banorte.login-seguro.xyz/` · `http://192.0.2.10/login` |
| Verde (bajo) | `https://example.com/` · cualquier sitio normal sin HTTPS raro |
| Excepción (oficial, 0 pts) | `https://www.google.com/` · `https://mail.google.com/` |

> Nota: el overlay en la página aparece solo en riesgo **medio/alto**; el
> popup muestra el análisis siempre. «Continuar bajo mi responsabilidad»
> oculta la alerta durante la carga actual de la página.
>
> Límites del MVP: solo se evalúa el **frame principal** de la página (los
> formularios dentro de iframes embebidos no aportan datos a R9) y «continuar»
> se olvida al recargar. Ambos puntos están documentados como posibles mejoras.
