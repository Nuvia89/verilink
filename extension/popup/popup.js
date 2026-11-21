/**
 * VeriLink — Popup (ficha de análisis).
 * Solo orquestación: obtiene la URL y los datos de la página, llama al motor
 * de reglas (rules.js) y pinta el resultado. No contiene lógica de detección.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const els = {
    radar: $('radar'),
    level: $('level'),
    score: $('score'),
    signals: $('signals'),
    signalsEmpty: $('signals-empty'),
    guide: $('guide'),
    sectionSignals: $('section-signals'),
    sectionGuide: $('section-guide'),
    btnSignals: $('btn-signals'),
    btnGuide: $('btn-guide'),
    btnSafe: $('btn-safe'),
    btnContinue: $('btn-continue'),
    note: $('note'),
  };

  const LEVEL_LABEL = { bajo: 'Riesgo bajo', medio: 'Riesgo medio', alto: 'Riesgo elevado' };

  let activeTabId = null;

  /** Pide al content script los datos de la página (p. ej. campos de contraseña). */
  async function getPageFeatures(tabId) {
    if (tabId == null) return {};
    const ask = () => chrome.tabs.sendMessage(tabId, { type: 'verilink:features' });
    try {
      const resp = await ask();
      return resp && typeof resp === 'object' ? resp : {};
    } catch (_e) {
      // El content script puede no estar inyectado aún: un reintento breve.
      await new Promise((resolve) => setTimeout(resolve, 400));
      try {
        const resp = await ask();
        return resp && typeof resp === 'object' ? resp : {};
      } catch (_e2) {
        return {}; // sin content script: R9 quedará sin evaluar
      }
    }
  }

  const EMPTY_GENERIC =
    'No se detectaron señales de riesgo en esta página. Recuerda que esto no garantiza que sea segura.';
  const EMPTY_EXEMPT =
    'Este dominio está en la lista de sitios oficiales de referencia: no se evaluaron las reglas.';
  const EMPTY_INVALID =
    'No se pudo analizar esta dirección. Solo se analizan páginas web (http/https).';

  function render(result) {
    // El color del nivel y de las tarjetas se hereda desde el body.
    document.body.style.setProperty('--radar', 'var(--' + result.radar + ')');
    els.radar.dataset.radar = result.radar;

    // Rama "no se pudo analizar": nada que mostrar.
    if (result.invalid) {
      els.level.textContent = 'Sin análisis';
      els.score.textContent = '';
      els.signals.hidden = true;
      els.signalsEmpty.hidden = false;
      els.signalsEmpty.textContent = EMPTY_INVALID;
      els.guide.textContent = '';
      els.sectionSignals.hidden = true;
      els.sectionGuide.hidden = true;
      els.btnSignals.disabled = true;
      els.btnGuide.disabled = true;
      return;
    }

    els.level.textContent = result.exempt
      ? 'Dominio oficial'
      : LEVEL_LABEL[result.level] || result.level;
    els.score.textContent = result.exempt
      ? 'Lista de dominios oficiales de referencia'
      : result.score === 1
        ? '1 punto detectado'
        : result.score + ' puntos detectados';

    // Señales ("¿Qué encontramos?")
    els.signals.textContent = '';
    for (const s of result.signals) {
      const li = document.createElement('li');
      li.className = 'vl-card';
      li.style.setProperty('--radar', 'var(--' + result.radar + ')');

      const top = document.createElement('div');
      top.className = 'vl-card-top';

      const title = document.createElement('span');
      title.className = 'vl-card-title';
      title.textContent = s.title;

      const points = document.createElement('span');
      points.className = 'vl-card-points';
      points.textContent = '+' + s.points;

      const why = document.createElement('span');
      why.className = 'vl-card-why';
      why.textContent = s.why;

      top.append(title, points);
      li.append(top, why);
      els.signals.append(li);
    }

    if (result.exempt) {
      els.signals.hidden = true;
      els.signalsEmpty.hidden = false;
      els.signalsEmpty.textContent = EMPTY_EXEMPT;
    } else if (result.signals.length === 0) {
      els.signals.hidden = true;
      els.signalsEmpty.hidden = false;
      els.signalsEmpty.textContent = EMPTY_GENERIC;
    } else {
      els.signals.hidden = false;
      els.signalsEmpty.hidden = true;
    }

    // Guía ("¿Qué te recomendamos?")
    els.guide.textContent = '';
    for (const item of result.guide) {
      const li = document.createElement('li');
      li.textContent = item;
      els.guide.append(li);
    }

    // Estado inicial: análisis visible, guía visible.
    els.sectionSignals.hidden = false;
    els.sectionGuide.hidden = false;
    els.btnSignals.disabled = false;
    els.btnGuide.disabled = false;
    els.btnSignals.textContent = 'Ocultar análisis';
    els.btnGuide.textContent = 'Ocultar guía';
  }

  function toggle(section, button, showLabel, hideLabel) {
    const willShow = section.hidden;
    section.hidden = !willShow;
    button.textContent = willShow ? hideLabel : showLabel;
  }

  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tab ? tab.id : null;
    const url = tab && tab.url;

    if (!url || !/^https?:/i.test(url)) {
      render({ invalid: true, radar: 'verde' });
      els.btnSafe.disabled = true;
      els.btnContinue.disabled = true;
      return;
    }

    const features = await getPageFeatures(activeTabId);
    const result = globalThis.VeriLinkRules.evaluatePage(url, features);
    render(result);
  }

  els.btnSignals.addEventListener('click', () => {
    toggle(els.sectionSignals, els.btnSignals, 'Ver análisis', 'Ocultar análisis');
  });

  els.btnGuide.addEventListener('click', () => {
    toggle(els.sectionGuide, els.btnGuide, 'Ver guía de seguridad', 'Ocultar guía');
  });

  els.btnSafe.addEventListener('click', async () => {
    try {
      if (activeTabId != null) {
        await chrome.tabs.update(activeTabId, {
          url: globalThis.VeriLinkRules.DEFAULT_SAFE_SITE,
        });
      }
    } catch (_e) {
      // Pestaña cerrada o URL no navegable: se cierra igual el popup.
    }
    window.close();
  });

  els.btnContinue.addEventListener('click', async () => {
    if (activeTabId != null) {
      try {
        await chrome.tabs.sendMessage(activeTabId, { type: 'verilink:dismiss' });
      } catch (_e) {
        // Sin content script no hay alerta que ocultar.
      }
    }
    window.close();
  });

  init().catch((err) => {
    els.level.textContent = 'Error de análisis';
    els.note.hidden = false;
    els.note.textContent = String(err && err.message ? err.message : err);
  });
})();
