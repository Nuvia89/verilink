/**
 * VeriLink — Content script (alerta en la página).
 * Orquestación: detecta datos de la página (pageFeatures), ejecuta el motor
 * de reglas (rules.js) y dibuja la alerta dentro de un Shadow DOM para que
 * los estilos de la página no la rompan. No contiene lógica de detección:
 * toda la evaluación vive en rules.js.
 */
(function () {
  'use strict';

  const RULES = globalThis.VeriLinkRules;
  const LEVEL_LABEL = { bajo: 'Riesgo bajo', medio: 'Riesgo medio', alto: 'Riesgo elevado' };

  let dismissed = false; // "Continuar bajo mi responsabilidad" (duración de la carga)
  let shown = false;
  let hostEl = null; // referencia propia del host (no se busca en el DOM de la página)

  // --------------------------------------------------------------- features

  /** Datos de la página que solo puede conocer quien tiene acceso al DOM. */
  function detectSensitiveFields() {
    const inputs = document.querySelectorAll('input, textarea');
    for (const el of inputs) {
      if (el.type === 'password') return true;
      const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
      if (ac.indexOf('cc-') === 0) return true; // números de tarjeta
    }
    return false;
  }

  function getFeatures() {
    return { hasSensitiveField: detectSensitiveFields() };
  }

  // ------------------------------------------------------------ construcción

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function buildRadar(radar) {
    const radarEl = el('div', 'vl-radar');
    radarEl.dataset.radar = radar;
    radarEl.append(el('span', 'vl-blip'));
    return radarEl;
  }

  function buildCard(signal, radar) {
    const li = el('li', 'vl-card');
    li.style.setProperty('--radar', 'var(--' + radar + ')');

    const top = el('div', 'vl-card-top');
    top.append(
      el('span', 'vl-card-title', signal.title),
      el('span', 'vl-card-points', '+' + signal.points)
    );
    li.append(top, el('span', 'vl-card-why', signal.why));
    return li;
  }

  /** variant: 'vl-primary' (acción principal), 'vl-link' (acción discreta) o vacío. */
  function button(label, action, variant) {
    const b = el('button', variant || '', label);
    b.type = 'button';
    b.dataset.action = action;
    return b;
  }

  function buildOverlay(result) {
    // Sin id ni clases en el DOM de la página: solo la referencia hostEl.
    const host = document.createElement('div');
    // Posicionamiento por CSSOM (no bloqueado por la CSP de la página).
    host.style.cssText =
      'position:fixed; right:16px; bottom:16px; z-index:2147483647;' +
      'max-width:400px; width:calc(100vw - 32px);';

    const shadow = host.attachShadow({ mode: 'closed' });

    // Hoja compartida con el popup (ui/ui.css) + contenedor propio de la alerta.
    for (const path of ['ui/ui.css', 'content/overlay.css']) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL(path);
      shadow.appendChild(link);
    }

    const alert = el('div', 'vl-alert vl-root');
    alert.setAttribute('role', 'alert');
    // Color del nivel/tarjetas heredado por todos los descendientes.
    alert.style.setProperty('--radar', 'var(--' + result.radar + ')');

    // Cabecera
    const header = el('header', 'vl-header');
    header.append(buildRadar(result.radar));
    const title = el('div', 'vl-title');
    title.append(
      el('p', 'vl-brand', 'RADAR VERILINK'),
      el('p', 'vl-level', LEVEL_LABEL[result.level] || result.level),
      el('p', 'vl-score', result.score === 1 ? '1 punto detectado' : result.score + ' puntos detectados')
    );
    header.append(title);
    alert.append(header);

    // ¿Qué encontramos?
    const signalsSection = el('section', 'vl-section');
    signalsSection.dataset.section = 'signals';
    signalsSection.append(el('h2', null, '¿Qué encontramos?'));
    const cards = el('ul', 'vl-cards');
    for (const s of result.signals) cards.append(buildCard(s, result.radar));
    signalsSection.append(cards);
    alert.append(signalsSection);

    // ¿Qué te recomendamos?
    const guideSection = el('section', 'vl-section');
    guideSection.dataset.section = 'guide';
    guideSection.append(el('h2', null, '¿Qué te recomendamos?'));
    const guide = el('ul', 'vl-guide');
    for (const item of result.guide) guide.append(el('li', null, item));
    guideSection.append(guide);
    alert.append(guideSection);

    // Acciones (docs/MVP.md §3)
    const actions = el('div', 'vl-actions');
    actions.append(
      button('Regresar a un sitio seguro', 'safe', 'vl-primary'),
      // Las secciones nacen visibles, por tanto las etiquetas iniciales son "Ocultar…"
      button('Ocultar análisis', 'toggle-signals'),
      button('Ocultar guía de seguridad', 'toggle-guide'),
      button('Continuar bajo mi responsabilidad', 'continue', 'vl-link')
    );
    alert.append(actions);

    shadow.append(alert);

    // Interacciones
    actions.addEventListener('click', (ev) => {
      const target = ev.target;
      if (!target || !target.dataset || !target.dataset.action) return;
      const action = target.dataset.action;

      if (action === 'toggle-signals') {
        const hidden = signalsSection.hidden;
        signalsSection.hidden = !hidden;
        target.textContent = hidden ? 'Ocultar análisis' : 'Ver análisis';
      } else if (action === 'toggle-guide') {
        const hidden = guideSection.hidden;
        guideSection.hidden = !hidden;
        target.textContent = hidden ? 'Ocultar guía' : 'Ver guía de seguridad';
      } else if (action === 'safe') {
        window.location.href = RULES.DEFAULT_SAFE_SITE;
      } else if (action === 'continue') {
        dismissed = true;
        hideOverlay();
      }
    });

    return host;
  }

  // ------------------------------------------------------------ mostrar/ocultar

  function showOverlay(result) {
    if (shown || dismissed || hostEl) return;
    hostEl = buildOverlay(result);
    (document.documentElement || document.body).appendChild(hostEl);
    shown = true;
  }

  function hideOverlay() {
    if (hostEl) {
      hostEl.remove();
      hostEl = null;
    }
    shown = false;
  }

  function evaluateAndMaybeShow() {
    if (shown || dismissed) return;
    const url = window.location.href;
    const result = RULES.evaluatePage(url, getFeatures());
    if (result.invalid) return;
    if (result.score >= 2) showOverlay(result); // solo riesgo medio o alto
  }

  // ------------------------------------------------------------------ arranque

  evaluateAndMaybeShow();

  // Reevalúa si, después de cargar, aparece un campo de contraseña (R9):
  // al enfocarlo o al insertarse dinámicamente en el DOM.
  document.addEventListener(
    'focusin',
    (ev) => {
      const t = ev.target;
      if (t && t.type === 'password') evaluateAndMaybeShow();
    },
    true
  );

  let reevalTimer = null;
  const observer = new MutationObserver(() => {
    if (shown || dismissed || reevalTimer) return;
    reevalTimer = setTimeout(() => {
      reevalTimer = null;
      evaluateAndMaybeShow();
    }, 300);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Mensajes desde el popup
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'verilink:features') {
      sendResponse(getFeatures());
      return false;
    }
    if (msg && msg.type === 'verilink:dismiss') {
      dismissed = true;
      hideOverlay();
      sendResponse({ ok: true });
      return false;
    }
    return false;
  });
})();
