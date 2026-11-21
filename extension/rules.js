/**
 * VeriLink — Motor de reglas (rules.js)
 * ---------------------------------------------------------------------------
 * Funciones PURAS: solo entran datos, salen datos.
 *   - Sin acceso al DOM (nada de document/window).
 *   - Sin acceso a las APIs de Chrome (nada de chrome.*).
 *   - Sin dependencias externas; se ejecuta igual en el navegador (popup y
 *     content script) y en Node (para los tests con `node --test`).
 *
 * API pública:
 *   evaluatePage(url, pageFeatures) -> Analisis
 *   classify(score)                 -> 'bajo' | 'medio' | 'alto'
 *   DEFAULT_SAFE_SITE
 *
 * pageFeatures (opcional, aportado por quien tiene DOM, p. ej. el content script):
 *   { hasSensitiveField: boolean }  -> usado por R9.
 *
 * Reglas implementadas: R1..R9 de docs/MVP.md, más la regla de excepción
 * (dominio oficial => 0 puntos) y los umbrales de clasificación.
 * ---------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  /** Sitio de referencia para la opción "Regresar a un sitio seguro". */
  const DEFAULT_SAFE_SITE = 'https://www.google.com';

  /** Umbrales de clasificación (docs/MVP.md §7). */
  const THRESHOLDS = { MEDIO: 2, ALTO: 4 };

  /** R3: palabras de premio/urgencia/acceso/verificación en la URL. */
  const KEYWORDS_R3 = [
    'ganaste', 'ganador', 'ganadores', 'premio', 'premios',
    'urgente', 'urgencia',
    'verifica', 'verificacion', 'verificar', 'verificamos',
    'acceso', 'suspendida', 'suspendido',
    'gratis', 'oferta', 'ofertas',
  ];

  /** R7: dominios de nivel superior frecuentemente abusados. */
  const ABUSED_TLDS = [
    'top', 'xyz', 'click', 'zip', 'mov', 'icu', 'rest', 'buzz', 'gq',
  ];

  /** TLD de dos etiquetas (para calcular el "nombre" del sitio). */
  const MULTI_TLDS = [
    'com.mx', 'net.mx', 'org.mx', 'gob.mx', 'com.br', 'co.uk', 'org.uk',
    'gov.uk', 'com.ar', 'com.co', 'co.jp', 'com.au', 'net.au', 'org.au',
    'com.cn', 'com.tw', 'co.in', 'com.sg', 'com.hk', 'co.kr', 'com.pe',
    'com.uy', 'com.ec', 'com.es',
  ];

  // --------------------------------------------------------------------------
  // Utilidades puras
  // --------------------------------------------------------------------------

  /** Parsea una URL. Devuelve un objeto URL o null si no es válida. */
  function parseUrl(raw) {
    if (typeof raw !== 'string' || raw.length === 0) return null;
    try {
      return new URL(raw);
    } catch (_e) {
      return null;
    }
  }

  /** Distancia de Levenshtein (edición) entre dos cadenas cortas. */
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    let prev = new Array(b.length + 1);
    let curr = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j += 1) prev[j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      curr[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      const tmp = prev;
      prev = curr;
      curr = tmp;
    }
    return prev[b.length];
  }

  /** Sustituciones de números por letras (R1: "letras cambiadas"). */
  function digitVariants(name) {
    const mapA = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't' };
    const mapB = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't' };
    const apply = (map) => name.replace(/[0-9]/g, (d) => map[d] || d);
    return [apply(mapA), apply(mapB)];
  }

  function isIpAddress(hostname) {
    if (hostname.startsWith('[')) return true; // IPv6: [::1]
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
      return hostname.split('.').every((o) => Number(o) <= 255);
    }
    return false;
  }

  function tldOf(hostname) {
    const labels = hostname.split('.');
    return labels[labels.length - 1] || '';
  }

  /**
   * "Nombre" del sitio: la etiqueta inmediatamente antes del TLD
   * (o antes del TLD de dos etiquetas): paypa1.com -> 'paypa1',
   * bbva.com.mx -> 'bbva'.
   */
  function siteName(hostname) {
    const labels = hostname.split('.');
    if (labels.length < 2) return hostname;
    const two = labels.slice(-2).join('.');
    const offset = MULTI_TLDS.indexOf(two) !== -1 ? 3 : 2;
    if (labels.length < offset) return hostname;
    return labels[labels.length - offset];
  }

  /**
   * Etiquetas de subdominio (todo lo que está "antes" del dominio registrado
   * aproximado). Ej: banorte.login-seguro.xyz -> ['banorte'].
   */
  function subdomainLabels(hostname) {
    const labels = hostname.split('.');
    const two = labels.slice(-2).join('.');
    const offset = MULTI_TLDS.indexOf(two) !== -1 ? 3 : 2;
    return labels.slice(0, Math.max(labels.length - offset, 0));
  }

  /** Tokeniza una ruta/URL en palabras (minúsculas, sin símbolos). */
  function tokenize(text) {
    const lowered = String(text || '').toLowerCase();
    let decoded = lowered;
    try {
      decoded = decodeURIComponent(lowered);
    } catch (_e) {
      decoded = lowered;
    }
    return decoded.split(/[^a-z0-9]+/).filter(Boolean);
  }

  /** ¿El hostname coincide con uno de los dominios oficiales (o sus subdominios)? */
  function matchesOfficial(hostname, domains) {
    return domains.some((d) => hostname === d || hostname.endsWith('.' + d));
  }

  function getBrands() {
    const brands = global.VeriLinkBrands;
    return Array.isArray(brands) ? brands : [];
  }

  /** Limpia un nombre: solo minúsculas y dígitos (para comparar variantes). */
  function compact(name) {
    return name.replace(/[^a-z0-9]/g, '');
  }

  // --------------------------------------------------------------------------
  // Reglas (cada una devuelve una "señal" o null)
  // --------------------------------------------------------------------------

  /** R1 (3 pts): dominio parecido a una marca conocida. */
  function ruleR1(hostname) {
    const name = siteName(hostname);
    if (!name) return null;
    for (const brand of getBrands()) {
      const b = brand.name;
      if (b.length < 4) {
        // Marcas cortas: solo equivalencia exacta tras normalizar dígitos.
        if (digitVariants(name).indexOf(b) !== -1) {
          return { id: 'R1', points: 3, brand: b, match: name };
        }
        continue;
      }
      if (name === b) continue; // dominio legítimo de la marca (o excepción)
      const variants = digitVariants(name);
      if (variants.indexOf(b) !== -1) {
        return { id: 'R1', points: 3, brand: b, match: name };
      }
      const c = compact(name);
      if (c.indexOf(b) !== -1) {
        return { id: 'R1', points: 3, brand: b, match: name }; // letras añadidas
      }
      const tol = b.length >= 7 ? 2 : 1;
      const d = levenshtein(name, b);
      if (d > 0 && d <= tol) {
        return { id: 'R1', points: 3, brand: b, match: name }; // letras cambiadas
      }
    }
    return null;
  }

  /** R2 (2 pts): marca en el subdominio o la ruta, pero el dominio real es otro. */
  function ruleR2(hostname, pathname) {
    const subs = subdomainLabels(hostname);
    const pathTokens = tokenize(pathname);
    for (const brand of getBrands()) {
      if (matchesOfficial(hostname, brand.domains)) continue;
      const b = brand.name;
      const inSub = subs.some((l) => l === b || compact(l) === b);
      const inPath = pathTokens.some(
        (t) => t === b || (b.length >= 4 && t.indexOf(b) !== -1)
      );
      if (inSub || inPath) {
        return { id: 'R2', points: 2, brand: b, match: inSub ? subs.join('.') : pathname };
      }
    }
    return null;
  }

  /** R3 (1 a 2 pts): palabras de premio/urgencia/verificación en la URL. */
  function ruleR3(urlString) {
    const tokens = tokenize(urlString);
    const found = [];
    for (const kw of KEYWORDS_R3) {
      const hit = tokens.some(
        (t) => t === kw || (kw.length >= 5 && t.indexOf(kw) === 0)
      );
      if (hit && found.indexOf(kw) === -1) found.push(kw);
    }
    if (found.length === 0) return null;
    return { id: 'R3', points: Math.min(found.length, 2), match: found.join(', ') };
  }

  /** R4 (1 pt): guiones excesivos, mezcla de letras y números o 'xn--'. */
  function ruleR4(hostname) {
    const name = siteName(hostname);
    const hyphens = (hostname.match(/-/g) || []).length;
    const hasDigits = /\d/.test(name);
    const hasLetters = /[a-z]/.test(name);
    const reasons = [];
    if (hyphens >= 3) reasons.push('guiones en exceso');
    if (hasDigits && hasLetters) reasons.push('mezcla de letras y números');
    if (hostname.indexOf('xn--') !== -1) reasons.push('dominio codificado (xn--)');
    if (reasons.length === 0) return null;
    return { id: 'R4', points: 1, match: reasons.join(', ') };
  }

  /** R5 (2 pts): dirección IP en lugar de un nombre de dominio. */
  function ruleR5(hostname) {
    if (!isIpAddress(hostname)) return null;
    return { id: 'R5', points: 2, match: hostname };
  }

  /** R6 (1 pt): la página no usa HTTPS. */
  function ruleR6(protocol) {
    if (protocol === 'https:') return null;
    return { id: 'R6', points: 1, match: protocol.replace(':', '') };
  }

  /** R7 (1 pt): TLD frecuentemente abusado. */
  function ruleR7(hostname) {
    const tld = tldOf(hostname);
    if (ABUSED_TLDS.indexOf(tld) === -1) return null;
    return { id: 'R7', points: 1, match: '.' + tld };
  }

  /** R8 (1 pt): '@', URL > 100 caracteres o 4+ subdominios. */
  function ruleR8(rawUrl, hostname) {
    const reasons = [];
    if (rawUrl.indexOf('@') !== -1) reasons.push("contiene '@'");
    if (rawUrl.length > 100) reasons.push('longitud mayor a 100 caracteres');
    const subs = subdomainLabels(hostname);
    if (subs.length >= 4) reasons.push(subs.length + ' subdominios');
    if (reasons.length === 0) return null;
    return { id: 'R8', points: 1, match: reasons.join(', ') };
  }

  /** R9 (2 pts): campo de contraseña/datos sensibles + al menos 1 punto previo. */
  function ruleR9(previousScore, pageFeatures) {
    const sensitive =
      pageFeatures && pageFeatures.hasSensitiveField === true;
    if (!sensitive || previousScore < 1) return null;
    return { id: 'R9', points: 2, match: 'campo de datos sensibles' };
  }

  // --------------------------------------------------------------------------
  // Textos de las señales y guía (español)
  // --------------------------------------------------------------------------

  const SIGNAL_TEXTS = {
    R1: {
      title: 'La dirección es parecida a una marca conocida',
      why: 'El nombre del dominio se parece al de «{brand}» (letras cambiadas, números por letras o letras añadidas), una técnica habitual para hacer pasar una página falsa por la oficial.',
    },
    R2: {
      title: 'Una marca aparece en la dirección, pero el dominio real es otro',
      why: 'La palabra «{brand}» está en el subdominio o en la ruta de una dirección que no pertenece a {brand}. Quien ve la dirección puede creer que está en el sitio oficial.',
    },
    R3: {
      title: 'Palabras de premio, urgencia o verificación en la dirección',
      why: 'La URL contiene palabras asociadas a engaños frecuentes: «{match}».',
    },
    R4: {
      title: 'Características poco habituales en el dominio',
      why: 'El dominio presenta {match}, rasgos que suelen usar para crear direcciones confusas.',
    },
    R5: {
      title: 'Se usa una dirección IP en lugar de un nombre de dominio',
      why: 'La página está servida directamente desde la IP «{match}», poco habitual en sitios legítimos y fácil de cambiar por quien la ofrece.',
    },
    R6: {
      title: 'La conexión no está cifrada (sin HTTPS)',
      why: 'La página usa {match} en lugar de HTTPS. En una conexión sin cifrar, la información que envíes (contraseñas, datos) podría interceptarse.',
    },
    R7: {
      title: 'Dominio de nivel superior frecuentemente abusado',
      why: 'Termina en «{match}», una extensión barata y de registro fácil que aparece con mucha frecuencia en páginas fraudulentas.',
    },
    R8: {
      title: 'La dirección tiene un formato inusual',
      why: 'La URL {match}, algo que se usa para confundir a quien lee la dirección.',
    },
    R9: {
      title: 'La página pide datos sensibles y ya había señales de riesgo',
      why: 'La página contiene campos de contraseña o datos sensibles y, además, ya acumulaba puntos por otras reglas. Es la combinación típica de un intento de robo de credenciales.',
    },
  };

  const GUIDE_BY_LEVEL = {
    bajo: [
      'No se detectaron señales relevantes, pero esto no garantiza que la página sea segura.',
      'Antes de ingresar datos, revisa que la dirección sea la oficial y que aparezca el candado de HTTPS.',
    ],
    medio: [
      'No ingreses contraseñas ni datos bancarios sin antes verificar la página.',
      'Comprueba la dirección oficial directamente desde el sitio o desde una búsqueda.',
      'Si recibiste este enlace por correo, mensaje o publicidad, confírmalo por otro medio.',
    ],
    alto: [
      'No ingreses contraseñas, datos bancarios ni información personal en esta página.',
      'Verifica la página desde el sitio oficial o contacta directamente a la institución.',
      'Regresa a un sitio seguro y, si necesitabas ese trámite, búscalo tú manualmente.',
    ],
  };

  const GUIDE_BY_SIGNAL = {
    R6: 'La conexión no está cifrada: evita enviar cualquier dato por esta página.',
    R9: 'Esta página solicita datos sensibles en un contexto señalado como sospechoso.',
    R1: 'Si necesitas entrar a esa marca, escribe tú la dirección oficial en el navegador.',
    R2: 'La marca que ves no es el dominio real de la página: no confíes en el nombre mostrado.',
  };

  function fill(template, signal) {
    return template.replace(/\{brand\}/g, signal.brand || '').replace(/\{match\}/g, signal.match || '');
  }

  // --------------------------------------------------------------------------
  // Clasificación y evaluación completa
  // --------------------------------------------------------------------------

  /** 0-1 => bajo, 2-3 => medio, 4+ => alto (docs/MVP.md §7). */
  function classify(score) {
    if (score >= THRESHOLDS.ALTO) return 'alto';
    if (score >= THRESHOLDS.MEDIO) return 'medio';
    return 'bajo';
  }

  const RADAR_BY_LEVEL = { bajo: 'verde', medio: 'amarillo', alto: 'rojo' };

  function buildGuide(level, signals, exempt) {
    if (exempt) {
      return [
        'Este dominio coincide con la lista de sitios oficiales de referencia, por lo que no se evaluaron las reglas.',
        'Aun así, verifica siempre que la dirección sea exactamente la oficial antes de ingresar datos.',
      ];
    }
    const guide = (GUIDE_BY_LEVEL[level] || []).slice();
    for (const s of signals) {
      const extra = GUIDE_BY_SIGNAL[s.id];
      if (extra && guide.indexOf(extra) === -1) guide.push(extra);
    }
    return guide;
  }

  /**
   * Evalúa una página completa.
   *
   * @param {string} rawUrl     URL de la página.
   * @param {object} [features] Datos de página aportados por quien tiene DOM:
   *                            { hasSensitiveField: boolean }.
   * @returns {object} {
   *   url, hostname, score, level, radar, exempt,
   *   signals: [{ id, points, title, why }],
   *   guide: [string]
   * }
   */
  function evaluatePage(rawUrl, features) {
    const pageFeatures = features || {};
    const u = parseUrl(rawUrl);
    if (!u) {
      return {
        url: rawUrl || '',
        hostname: '',
        score: 0,
        level: 'bajo',
        radar: 'verde',
        exempt: false,
        invalid: true,
        signals: [],
        guide: ['No se pudo analizar la dirección de la página.'],
      };
    }

    const hostname = u.hostname.toLowerCase();
    const isOfficial = getBrands().some((b) => matchesOfficial(hostname, b.domains));

    // Regla de excepción: dominio oficial => 0 puntos (no se evalúa R1..R8).
    if (isOfficial) {
      return {
        url: u.href,
        hostname,
        score: 0,
        level: 'bajo',
        radar: 'verde',
        exempt: true,
        invalid: false,
        signals: [],
        guide: buildGuide('bajo', [], true),
      };
    }

    const ip = isIpAddress(hostname);
    const candidates = [];
    if (!ip) {
      candidates.push(ruleR1(hostname));
      candidates.push(ruleR2(hostname, u.pathname));
    }
    candidates.push(ruleR3(u.href));
    if (!ip) {
      candidates.push(ruleR4(hostname));
      candidates.push(ruleR7(hostname));
      candidates.push(ruleR8(u.href, hostname));
    }
    candidates.push(ruleR5(hostname)); // R5 solo aplica si hay IP
    candidates.push(ruleR6(u.protocol));

    const hits = candidates.filter(Boolean);
    const previousScore = hits.reduce((acc, h) => acc + h.points, 0);

    // R9 se evalúa al final, condicionada a los puntos de otras reglas.
    const r9 = ruleR9(previousScore, pageFeatures);
    if (r9) hits.push(r9);

    const score = previousScore + (r9 ? r9.points : 0);
    const level = classify(score);

    const signals = hits.map((h) => {
      const text = SIGNAL_TEXTS[h.id] || { title: h.id, why: '' };
      return {
        id: h.id,
        points: h.points,
        title: text.title,
        why: fill(text.why, h),
      };
    });

    return {
      url: u.href,
      hostname,
      score,
      level,
      radar: RADAR_BY_LEVEL[level],
      exempt: false,
      invalid: false,
      signals,
      guide: buildGuide(level, signals, false),
    };
  }

  global.VeriLinkRules = {
    evaluatePage,
    classify,
    DEFAULT_SAFE_SITE,
    // Exposiciones para tests:
    _internal: {
      parseUrl,
      levenshtein,
      siteName,
      subdomainLabels,
      isIpAddress,
      tokenize,
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
