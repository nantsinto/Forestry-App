import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Create clean Brand SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#05070a"/>
      <stop offset="100%" stop-color="#14241e"/>
    </linearGradient>
    <linearGradient id="pine" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#52b788"/>
      <stop offset="100%" stop-color="#2d6a4f"/>
    </linearGradient>
    <linearGradient id="shield" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1b4332"/>
      <stop offset="100%" stop-color="#081c15"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <path d="M256 64 C360 64, 400 96, 400 180 C400 320, 256 432, 256 432 C256 432, 112 320, 112 180 C112 96, 152 64, 256 64 Z" fill="url(#shield)" stroke="#52b788" stroke-width="8"/>
  <!-- Central stylized pine & telemetry beacon -->
  <polygon points="256,120 310,210 278,210 324,290 286,290 336,370 176,370 226,290 188,290 234,210 202,210" fill="url(#pine)"/>
  <rect x="246" y="370" width="20" height="34" rx="3" fill="#2d6a4f"/>
  <!-- Telemetry pulses -->
  <circle cx="256" cy="116" r="12" fill="#52b788"/>
  <path d="M226,116 A30,30 0 0,1 286,116" fill="none" stroke="#52b788" stroke-width="4" stroke-linecap="round"/>
  <path d="M206,116 A50,50 0 0,1 306,116" fill="none" stroke="#52b788" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);

// Helper to generate an uncompressed/compressed raw RGBA PNG
function createPng(width, height) {
  const rowSize = width * 4 + 1; // 1 filter byte per line
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      // Distance from center
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Deep dark forest background with rounded square
      const cornerR = width * 0.22;
      const inCornerX = Math.abs(dx) > width / 2 - cornerR;
      const inCornerY = Math.abs(dy) > height / 2 - cornerR;
      let alpha = 255;
      if (inCornerX && inCornerY) {
        const cdx = Math.abs(dx) - (width / 2 - cornerR);
        const cdy = Math.abs(dy) - (height / 2 - cornerR);
        if (Math.sqrt(cdx * cdx + cdy * cdy) > cornerR) {
          alpha = 0;
        }
      }

      if (alpha === 0) {
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      } else {
        // Shield and tree pattern
        const inTree = (y > height * 0.25 && y < height * 0.75 && Math.abs(dx) < (y - height * 0.2) * 0.45);
        if (inTree) {
          // Emerald Green
          rawData[pxOffset] = 82;     // R
          rawData[pxOffset + 1] = 183; // G
          rawData[pxOffset + 2] = 136; // B
          rawData[pxOffset + 3] = 255;
        } else if (dist < width * 0.42) {
          // Deep pine
          rawData[pxOffset] = 27;
          rawData[pxOffset + 1] = 67;
          rawData[pxOffset + 2] = 50;
          rawData[pxOffset + 3] = 255;
        } else {
          // Tactical dark
          rawData[pxOffset] = 5;
          rawData[pxOffset + 1] = 7;
          rawData[pxOffset + 2] = 10;
          rawData[pxOffset + 3] = 255;
        }
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);
    const crc = crc32(Buffer.concat([Buffer.from(type), data]));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  // Precomputed CRC table
  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  table[i] = c;
}

const png192 = createPng(192, 192);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png192);

const png512 = createPng(512, 512);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), png512);

console.log('Successfully generated PWA assets: icon.svg, pwa-192x192.png, pwa-512x512.png, apple-touch-icon.png');
