# Manual de usuario — VeriLink

VeriLink es una extensión que analiza las páginas que visitas, te avisa si
encuentra señales de riesgo, te explica **por qué** y te sugiere **qué hacer**.
No bloquea páginas ni decide por ti: te da información para que decidas.

> Este prototipo analiza señales definidas por el equipo. No identifica todas
> las páginas fraudulentas y su lista de marcas es limitada. Un aviso verde
> **no garantiza** que la página sea segura.

## El Radar VeriLink

Al detectar señales, verás un indicador tipo radar con tres estados:

| Radar | Nivel | Significado |
|---|---|---|
| 🟢 Verde | Riesgo bajo | No se encontraron indicadores relevantes (no es una garantía de seguridad). |
| 🟡 Amarillo | Riesgo medio | Se encontraron características que requieren atención o verificación. |
| 🔴 Rojo | Riesgo elevado | Se identificaron varias señales sospechosas: evita ingresar información sin verificar. |

## Dónde aparece

1. **En la página** (alerta emergente): cuando entras a una dirección con
   riesgo **medio o alto**, aparece una tarjeta con el radar, el análisis y
   las recomendaciones.
2. **En el icono de la extensión** (ficha de análisis): al hacer clic en el
   icono de VeriLink en la barra de herramientas, siempre puedes ver el
   análisis de la página actual, aunque no haya alerta.

Ambos muestran lo mismo: el radar, las señales y la guía.

## La alerta, sección por sección

- **RADAR VERILINK / Riesgo…** — nivel detectado y puntos acumulados.
- **¿Qué encontramos?** — cada señal como una tarjeta que explica la
  característica detectada, por qué podría ser un riesgo y cuántos puntos
  aportó.
- **¿Qué te recomendamos?** — pasos sencillos para actuar con seguridad
  (no ingresar datos, verificar la dirección oficial, buscar información por
  otro medio).

## Las cuatro opciones

| Opción | Qué hace |
|---|---|
| **Ver análisis** | Muestra u oculta la lista de señales detectadas. |
| **Ver guía de seguridad** | Muestra u oculta los recomendaciones paso a paso. |
| **Regresar a un sitio seguro** | Te lleva a un sitio de referencia (Google) para salir de la página sospechosa. En riesgo elevado es el botón más destacado. |
| **Continuar bajo mi responsabilidad** | Cierra la advertencia en esta visita y te deja continuar. El aviso volverá a aparecer si recargas la página. |

## Ejemplos de señales que detecta

- Direcciones parecidas a marcas conocidas con letras cambiadas o números
  por letras (`paypa1.com`).
- El nombre de una marca aparece en la dirección, pero el dominio real es
  otro (`banorte.login-seguro.xyz`).
- Palabras de premio, urgencia o verificación en la URL (`ganaste`,
  `urgente`, `verifica`).
- Dominios con guiones en exceso o mezcla extraña de letras y números.
- Páginas servidas desde una dirección IP o sin HTTPS (conexión sin cifrar).
- Extensiones de dominio frecuentemente abusadas (`.top`, `.xyz`, `.click`…).
- Direcciones con formato inusual (`@`, demasiado largas, muchos subdominios).
- Un formulario de contraseña o datos de tarjeta **en una página que ya
  tenía otras señales**.

## Privacidad

- Todo el análisis se hace **en tu navegador**, con reglas locales.
- VeriLink **no envía** tu historial, las direcciones que visitas ni ningún
  dato a servidores externos (no tiene servidores).
- No requiere permisos para leer tu correo, tus archivos ni tus pestañas:
  solo analiza las páginas web que abres.

## Preguntas frecuentes

**¿Por qué VeriLink no bloquea la página?**
Porque el objetivo es que entiendas el riesgo y decidas. Bloquear todo
generaría falsos positivos molestos; la alerta explica el motivo para que
tú elijas.

**La página es legítima pero aparece una alerta.**
Puede ocurrir con dominios nuevos o nombres parecidos a marcas. Revisa la
dirección: si es oficial y correcta, puedes continuar. Reportar estos casos
ayuda a ajustar las reglas.

**¿Qué pasa si ignoro la alerta?**
Nada se bloquea ni se rompe: continuarás bajo tu responsabilidad. Si era
realmente phishing, nadie te impedirá entrar; por eso conviene leer la guía.

**¿Afecta a todos los sitios?**
No: los dominios oficiales de la lista de referencia (Google, BBVA, SAT…)
no generan alerta. Las páginas sin señales muestran solo verde en el icono.
