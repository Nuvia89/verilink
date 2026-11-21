/**
 * VeriLink — Lista inicial de marcas y dominios oficiales de referencia.
 * Se usa en R1 (dominio parecido a una marca), R2 (marca en subdominio/ruta)
 * y en la regla de excepción (dominio oficial => 0 puntos).
 *
 * Formato:
 *   { name: '<token de marca en minúsculas>', domains: ['<dominio oficial>', ...] }
 *
 * Es ampliable: para agregar una marca basta con añadir un objeto a este arreglo.
 * El motor (rules.js) lo lee desde globalThis.VeriLinkBrands.
 */
globalThis.VeriLinkBrands = [
  { name: 'paypal', domains: ['paypal.com'] },
  { name: 'google', domains: ['google.com'] },
  { name: 'microsoft', domains: ['microsoft.com'] },
  { name: 'apple', domains: ['apple.com'] },
  { name: 'amazon', domains: ['amazon.com.mx'] },
  { name: 'facebook', domains: ['facebook.com'] },
  { name: 'instagram', domains: ['instagram.com'] },
  { name: 'whatsapp', domains: ['whatsapp.com'] },
  { name: 'netflix', domains: ['netflix.com'] },
  { name: 'mercadolibre', domains: ['mercadolibre.com.mx'] },
  { name: 'bbva', domains: ['bbva.mx'] },
  { name: 'banorte', domains: ['banorte.com'] },
  { name: 'santander', domains: ['santander.com.mx'] },
  { name: 'citibanamex', domains: ['citibanamex.com'] },
  { name: 'sat', domains: ['sat.gob.mx'] },
];
