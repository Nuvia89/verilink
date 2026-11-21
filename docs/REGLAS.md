# Reglas de detección de VeriLink (R1–R9)

Especificación operativa de las reglas implementadas en `extension/rules.js`.
Fuente normativa del producto: [`MVP.md`](MVP.md) §7. Esta documento describe
**cómo se implementa** cada regla, para que se pueda revisar o ampliar sin
leer el código.

## Contrato del motor

```js
evaluatePage(url, pageFeatures) -> Analisis
```

- **`url`** (string): dirección de la página. Si no es válida, el resultado
  trae `invalid: true` y 0 puntos (nunca lanza excepciones).
- **`pageFeatures`** (objeto opcional): datos que solo conoce quien tiene
  acceso al DOM. Actualmente un único campo:
  `{ hasSensitiveField: boolean }` — la página contiene un campo de
  contraseña o datos de tarjeta (`input[type=password]`,
  `autocomplete^="cc-"`).
- **`Analisis`** (salida):

| Campo | Tipo | Descripción |
|---|---|---|
| `score` | number | Puntos totales |
| `level` | `'bajo' \| 'medio' \| 'alto'` | Nivel de riesgo |
| `radar` | `'verde' \| 'amarillo' \| 'rojo'` | Color del radar (deriva del nivel) |
| `exempt` | boolean | Dominio oficial: no se evaluaron R1–R8 |
| `invalid` | boolean | URL no interpretable |
| `signals` | array | Señales detectadas: `{id, points, title, why}` |
| `guide` | string[] | Recomendaciones para el usuario |

## Orden de evaluación

1. **Excepción:** si el hostname coincide (exacto o como subdominio) con un
   dominio oficial de `data/brands.js` → **0 puntos**, no se evalúa R1–R8 y
   R9 tampoco se activa (requiere puntos previos).
2. **R1, R2, R4, R7, R8** sobre el hostname (no se evalúan si la dirección
   es una IP: `ruleR5` se encarga de ese caso).
3. **R3** sobre la URL completa.
4. **R5** (solo si hay IP) y **R6**.
5. **R9** al final, condicionada al total acumulado.
6. **Clasificación:** `0–1 → bajo/verde`, `2–3 → medio/amarillo`,
   `4+ → alto/rojo`.

## Tabla de reglas

| ID | Puntos | Qué evalúa | Detalle de implementación |
|---|---|---|---|
| **R1** | 3 | Nombre del dominio parecido a una marca | Toma la etiqueta antes del TLD (con soporte de TLD de dos etiquetas: `com.mx`, `gob.mx`…). Compara contra cada `name` de `data/brands.js`: (a) normaliza números por letras (`0→o, 1→l/i, 3→e, 4→a, 5→s, 7→t`) y compara; (b) compara sin separadores (`bbva-mexico` → `bbvamexico` contiene `bbva`); (c) distancia de Levenshtein ≤ 1 (≤ 2 para marcas de 7+ letras). Marcas de menos de 4 letras solo usan (a). Se puntúa una vez aunque haya varias marcas. |
| **R2** | 2 | Marca en el subdominio o la ruta con dominio real distinto | Las etiquetas "antes" del dominio registrado aproximado y los tokens de la ruta deben coincidir con el `name` de una marca cuyo dominio oficial **no** sea este hostname. Token exacto en subdominio; en ruta acepta contención para marcas de 4+ letras. |
| **R3** | 1 a 2 | Palabras de premio/urgencia/acceso/verificación en la URL | La URL se decodifica y se tokeniza (letras y dígitos). Cada palabra distinta de la lista `KEYWORDS_R3` que aparezca como token (o como prefijo de token, para palabras de 5+ letras) suma 1; **tope de 2**. |
| **R4** | 1 | Guiones en exceso, mezcla de letras y números o `xn--` | ≥ 3 guiones en el hostname, o dígitos y letras juntos en el nombre del sitio, o presencia de `xn--`. Cuenta **una sola vez** aunque concurran varios motivos (el motivo se lista en el texto). |
| **R5** | 2 | Dirección IP en lugar de nombre de dominio | IPv4 con octetos ≤ 255 o IPv6 (hostname entre corchetes). |
| **R6** | 1 | La página no usa HTTPS | Cualquier protocolo distinto de `https:`. |
| **R7** | 1 | TLD frecuentemente abusado | Lista `ABUSED_TLDS`: `top, xyz, click, zip, mov, icu, rest, buzz, gq`. |
| **R8** | 1 | Formato inusual de la URL | Contiene `@`, supera 100 caracteres, o tiene 4+ subdominios. Cuenta una sola vez. |
| **R9** | 2 | Datos sensibles en una página ya señalada | `pageFeatures.hasSensitiveField === true` **y** el total de R1–R8 ≥ 1. Se evalúa siempre al final. |

## Listas configurables

| Lista | Ubicación | Uso |
|---|---|---|
| Marcas y dominios oficiales | `extension/data/brands.js` (`globalThis.VeriLinkBrands`) | R1, R2 y la excepción |
| Palabras clave R3 | `rules.js` → `KEYWORDS_R3` | R3 |
| TLD abusados | `rules.js` → `ABUSED_TLDS` | R7 |
| TLD de dos etiquetas | `rules.js` → `MULTI_TLDS` | Cálculo del nombre del sitio (R1/R4/R8) |
| Umbrales | `rules.js` → `THRESHOLDS` | Clasificación |

Formato de una marca (agregar al arreglo de `brands.js`):

```js
{ name: 'bbva', domains: ['bbva.mx'] }
```

- `name`: token en minúsculas sin acentos con el que se compara el dominio.
- `domains`: dominios oficiales; cualquier subdominio de ellos también queda
  exento (`mail.google.com` → 0 puntos).

## Textos y guía

- `SIGNAL_TEXTS`: título y explicación (con `{brand}` y `{match}`
  rellenables) de cada señal, en español.
- `GUIDE_BY_LEVEL`: recomendaciones base por nivel (bajo/medio/alto).
- `GUIDE_BY_SIGNAL`: recomendación adicional específica (p. ej. R6 sin
  cifrar, R9 credenciales). Se agregan a la base sin duplicar.

## Cómo agregar o cambiar una regla

1. Añadir la función `ruleXX(...)` pura en `rules.js` que devuelva
   `{id, points, match, brand?}` o `null`.
2. Invocarla en `evaluatePage` en el punto de orden correcto (R9 siempre
   al final, después de totalizar).
3. Añadir la entrada en `SIGNAL_TEXTS` (y `GUIDE_BY_SIGNAL` si aplica).
4. Escribir los casos en `extension/tests/rules.test.js` y ejecutar
   `node --test extension/tests/rules.test.js`.

Detalle: `docs/DESARROLLO.md`.
