/**
 * VeriLink — generador de iconos (sin dependencias: solo módulos de Node).
 * Uso:  node tools/generate-icons.mjs
 * Dibuja un radar (anillos + barrido + punto) sobre fondo azul oscuro.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'extension', 'icons');

// ---------------------------------------------------------------- PNG básico

function crc32(buf) {
  if (!crc32.table) {
    crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crc32.table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) {
    c = crc32.table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, pixelAt) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  let o = 0;
  for (let y = 0; y < size; y += 1) {
    raw[o] = 0; // filtro: ninguno
    o += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixelAt(x, y, size);
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
      o += 4;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // color RGBA
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ el radar

const BG = [11, 22, 38]; // #0b1626
const GREEN = [34, 197, 94]; // #22c55e
const SWEEP_ANGLE = -Math.PI / 4; // barrido hacia arriba-derecha

function iconPixel(x, y, size) {
  const c = (size - 1) / 2;
  const r0 = size * 0.40; // radio exterior del radar
  const dx = x - c;
  const dy = y - c;
  const d = Math.hypot(dx, dy);

  // Fondo con degradado vertical sutil
  const shade = Math.round((y / size) * 14);
  let px = [BG[0] + shade, BG[1] + shade, BG[2] + shade];

  const stroke = Math.max(1, size / 26);
  const inCircle = d <= r0 + stroke;

  if (inCircle) {
    // Anillos
    for (const f of [1, 0.66, 0.33]) {
      if (Math.abs(d - r0 * f) <= stroke / 2 + 0.4) {
        px = [Math.round(GREEN[0] * 0.55), Math.round(GREEN[1] * 0.55), Math.round(GREEN[2] * 0.55)];
      }
    }
    // Líneas de mira
    if (Math.abs(dx) <= stroke / 2 || Math.abs(dy) <= stroke / 2) {
      px = [40, 70, 100];
    }
    // Barrido (abanico)
    const ang = Math.atan2(dy, dx);
    let diff = Math.abs(ang - SWEEP_ANGLE);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < 0.5 && d <= r0) {
      const t = 1 - diff / 0.5; // más brillante cerca del eje del barrido
      px = [
        Math.round(GREEN[0] * (0.35 + 0.65 * t)),
        Math.round(GREEN[1] * (0.35 + 0.65 * t)),
        Math.round(GREEN[2] * (0.35 + 0.65 * t)),
      ];
      if (diff < 0.08) px = [110, 240, 160]; // eje brillante
    }
    // Punto (blip) del radar
    const bx = Math.cos(SWEEP_ANGLE + 0.7) * r0 * 0.62;
    const by = Math.sin(SWEEP_ANGLE + 0.7) * r0 * 0.62;
    if (Math.hypot(dx - bx, dy - by) <= Math.max(1, size / 14)) {
      px = [160, 255, 190];
    }
    // Borde exterior
    if (d > r0 - stroke * 0.6 && d <= r0 + stroke) px = GREEN;
  }

  return [px[0], px[1], px[2], 255];
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 48, 128]) {
  const file = join(OUT_DIR, `icon${size}.png`);
  writeFileSync(file, encodePng(size, iconPixel));
  console.log('generado:', file);
}
