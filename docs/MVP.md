# 3.2 Producto mínimo viable: VeriLink

El producto mínimo viable de VeriLink consiste en una extensión para navegador capaz de identificar posibles señales de riesgo en páginas web, informar al usuario sobre las razones por las que una página podría ser sospechosa y proporcionar recomendaciones para navegar de manera más segura.

La extensión funcionará mediante un sistema de análisis basado en reglas de verificación, que evaluará determinadas características de las páginas visitadas, como la estructura de su URL, el uso de dominios sospechosos, palabras relacionadas con engaños, posibles intentos de suplantación de identidad y otros indicadores de riesgo.

Cuando VeriLink detecte señales sospechosas, mostrará una alerta visual que no solamente advertirá al usuario, sino que también explicará qué encontró, por qué podría representar un riesgo y qué acciones se recomienda realizar antes de continuar.

## 1. Funcionamiento del prototipo

1. **Detección de una página sospechosa.** Al ingresar a una página web, VeriLink analizará su dirección y ciertas características para determinar si presenta señales de riesgo.
2. **Alerta visual de riesgo.** Si encuentra indicadores sospechosos, desplegará una alerta llamativa que permitirá al usuario conocer el nivel de riesgo detectado: bajo, medio o alto.
3. **Explicación de las señales detectadas.** La extensión mostrará las características que provocaron la alerta, por ejemplo, un dominio que imita a una marca, una dirección extraña o la presencia de elementos sospechosos.
4. **Guía de acciones recomendadas.** VeriLink presentará una pequeña guía con recomendaciones para que el usuario sepa cómo actuar, como no ingresar información personal, verificar la dirección oficial o buscar información por otro medio.

## 2. Elemento creativo: «Radar VeriLink»

Para que el prototipo no sea una extensión genérica, proponemos incorporar un **Radar VeriLink**, un elemento visual que represente el análisis de la página.

En lugar de mostrar únicamente un mensaje de advertencia, el usuario verá un indicador visual estilo radar que cambia según las señales encontradas. Puede acompañarse de una clasificación de riesgo y una especie de ficha de análisis.

El radar tendrá tres estados:

- **Verde (riesgo bajo) – Sin señales importantes:** durante el análisis no se encontraron indicadores de riesgo relevantes. Esto no significa que la página esté garantizada como segura.
- **Amarillo (riesgo medio) – Precaución:** se encontraron características que requieren atención o verificación.
- **Rojo (riesgo alto) – Riesgo elevado:** se identificaron varias señales sospechosas y se recomienda evitar ingresar información o continuar sin verificar.

Además, la alerta incluirá una sección denominada **«¿Qué encontramos?»**, donde cada señal aparezca como una tarjeta explicativa.

Ejemplo:

> **RADAR VERILINK**
> **Riesgo elevado**
>
> **¿Qué encontramos?**
> - La dirección presenta características similares a las de un dominio conocido.
> - Se detectaron palabras relacionadas con urgencia.
> - La dirección web contiene elementos poco habituales.
>
> **¿Qué te recomendamos?**
> No ingreses contraseñas ni datos bancarios. Verifica la página desde el sitio oficial o contacta directamente a la institución.

La idea es que el usuario comprenda la alerta y no solamente reciba un aviso que pueda ignorar.

## 3. Interacción del usuario con la alerta

Cuando la extensión detecte señales sospechosas, el usuario tendrá la posibilidad de elegir cómo proceder. VeriLink no bloqueará automáticamente todas las páginas, sino que ofrecerá información para que la persona tome una decisión informada.

| Opción | Función |
|---|---|
| Ver análisis | Mostrar las señales detectadas y explicar por qué generan sospecha. |
| Ver guía de seguridad | Mostrar los pasos recomendados para verificar la página. |
| Regresar a un sitio seguro | Facilitar que el usuario salga de la página sospechosa. |
| Continuar bajo mi responsabilidad | Permitir continuar después de mostrar la advertencia, dejando claro que existen riesgos. |

En caso de riesgo elevado, la opción de regresar a un sitio seguro será la más destacada visualmente.

## 4. Funcionalidades que incluirá el MVP

| Funcionalidad | Descripción |
|---|---|
| Análisis de URL | Examinar la dirección de la página visitada. |
| Detección por reglas | Buscar características sospechosas previamente definidas. |
| Radar VeriLink | Mostrar visualmente el nivel de riesgo detectado. |
| Alertas preventivas | Avisar al usuario cuando se encuentren señales de riesgo. |
| Explicación del riesgo | Informar qué características provocaron la alerta. |
| Guía de seguridad | Mostrar recomendaciones sencillas para actuar. |
| Decisión del usuario | Permitir regresar o continuar después de la advertencia. |
| Interfaz de extensión | Acceder a las funciones desde el navegador mediante un icono. |

## 5. ¿En qué se basará la detección?

Para que sea desarrollable y no dependa de servicios de pago o inteligencia artificial, la primera versión de VeriLink utilizará un sistema de reglas de análisis de URL y características de páginas web.

Se definen reglas que detectan:

- Direcciones que utilizan nombres similares a marcas conocidas, pero con modificaciones.
- Dominios con combinaciones extrañas de caracteres.
- Uso de subdominios que pueden intentar confundir al usuario.
- Direcciones que contienen palabras relacionadas con premios, urgencia, acceso a cuentas o supuestas verificaciones.
- Páginas que solicitan información sensible en contextos sospechosos.
- Características técnicas básicas de la URL que ameriten revisión.

Cada regla aporta puntos al análisis. Dependiendo de la cantidad y relevancia de las señales, VeriLink determina si muestra una advertencia de precaución o de riesgo elevado.

**Alcance realista:** el prototipo no identificará todas las páginas fraudulentas ni tendrá acceso a una base mundial de amenazas. Su función será analizar señales definidas por el equipo, demostrar el funcionamiento de la prevención y probar su utilidad con usuarios.

## 6. ¿Cómo se desarrollará?

- **HTML:** estructura de las alertas y panel de la extensión.
- **CSS:** diseño visual, colores del radar, animaciones y tarjetas informativas.
- **JavaScript:** análisis de las direcciones web, reglas de detección y funcionamiento de las interacciones.
- **Chrome Extensions API (Manifest V3):** integración de la extensión con el navegador.
- **Visual Studio Code y opencode:** entorno de desarrollo.
- **Git y GitHub:** almacenamiento y control de versiones del proyecto.

El prototipo podrá probarse inicialmente en Google Chrome o en un navegador compatible con extensiones basadas en Chromium.

## 7. Reglas de detección y puntajes

Cada regla suma puntos a la puntuación total de la página. Todas las reglas se evalúan localmente, sin servicios externos.

| ID | Regla | Puntos | Ejemplo |
|---|---|---|---|
| R1 | Dominio parecido a una marca conocida (letras cambiadas, números por letras, letras añadidas) | 3 | `paypa1.com`, `bbva-mexico.com` |
| R2 | Nombre de una marca en el subdominio o la ruta, pero el dominio real es otro | 2 | `banorte.login-seguro.xyz` |
| R3 | Palabras de premio, urgencia, acceso a cuentas o verificación en la URL (1 punto por palabra, máximo 2) | 1 a 2 | `ganaste`, `urgente`, `verifica`, `acceso`, `suspendida` |
| R4 | Dominio con guiones excesivos (3 o más), mezcla de letras y números, o caracteres especiales (`xn--`) | 1 | `mi-banco-seguro-2026.com` |
| R5 | Dirección IP en lugar de nombre de dominio | 2 | `http://192.0.2.10/login` |
| R6 | La página no usa HTTPS | 1 | `http://...` |
| R7 | Dominio de nivel superior frecuentemente abusado | 1 | `.top`, `.xyz`, `.click`, `.zip` |
| R8 | URL con `@`, excesivamente larga (más de 100 caracteres) o con 4 o más subdominios | 1 | `https://sitio.com@otro.com` |
| R9 | La página contiene un campo de contraseña o datos sensibles **y** ya existe al menos 1 punto de otras reglas | 2 | Formulario de login en dominio sospechoso |

**Regla de excepción:** si el dominio coincide con uno de la lista de dominios oficiales de referencia (o es un subdominio de uno de ellos), la página recibe 0 puntos (sin evaluar R1 a R8).

**Umbrales de clasificación:**

| Puntos totales | Estado del radar | Nivel |
|---|---|---|
| 0 a 1 | Verde | Bajo |
| 2 a 3 | Amarillo | Medio |
| 4 o más | Rojo | Alto |

**Lista inicial de marcas y dominios oficiales de referencia** (para R1, R2 y la excepción; ampliable):
paypal.com, google.com, microsoft.com, apple.com, amazon.com.mx, facebook.com, instagram.com, whatsapp.com, netflix.com, mercadolibre.com.mx, bbva.mx, banorte.com, santander.com.mx, citibanamex.com, sat.gob.mx.

## 8. Resultado esperado del MVP

Al finalizar esta etapa, se espera contar con una extensión funcional que pueda instalarse en modo desarrollador, analizar páginas de prueba previamente seleccionadas, desplegar alertas visuales, explicar las señales encontradas y proporcionar recomendaciones de seguridad.

El prototipo permitirá demostrar de forma práctica la propuesta de VeriLink y realizar pruebas con usuarios para conocer si las alertas son comprensibles, útiles y fáciles de utilizar.
