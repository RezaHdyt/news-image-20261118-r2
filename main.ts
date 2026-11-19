// news-image-20261118 round 2: a one-page newspaper front page summing up
// Wednesday 18 November 2026 in 46 verified, date-checked stories, with
// 16 drawn panels and a day-in-numbers band. The finished image lives
// beside this file as entry.png; this program validates it against the
// competition gate (a whole PNG, at most 1 MiB, at most 1024x1024) and
// copies it to the output directory. Node 22, standard library only.
//
// Run it locally with:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 1048576; // 1 MiB
const MAX_SIDE = 1024; // pixels
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, 'entry.png');

if (!existsSync(source)) {
  throw new Error('entry.png is missing from the repository');
}
const png = readFileSync(source);

function reject(reason) {
  throw new Error(`entry.png rejected by the gate: ${reason}`);
}

// The 8-byte PNG signature comes first; anything else is not a PNG.
if (png.length < 8 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) {
  reject('bad PNG signature');
}
// Walk the chunk chain (length + type + data + CRC) to confirm the file
// is whole: it must end exactly on an IEND chunk, with no trailing bytes.
let offset = 8;
let sawIend = false;
while (offset + 12 <= png.length) {
  const length = png.readUInt32BE(offset);
  const type = png.toString('latin1', offset + 4, offset + 8);
  if (offset + 12 + length > png.length) {
    reject(`chunk ${type} overruns the end of the file`);
  }
  offset += 12 + length;
  if (type === 'IEND') {
    sawIend = true;
    break;
  }
}
if (!sawIend || offset !== png.length) {
  reject('file is not a whole PNG (no clean IEND end)');
}
// IHDR must be the first chunk: width and height are big-endian uint32s
// at byte offsets 16 and 20 of the file.
if (png.toString('latin1', 12, 16) !== 'IHDR') {
  reject('first chunk is not IHDR');
}
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
if (width > MAX_SIDE || height > MAX_SIDE) {
  reject(`dimensions ${width}x${height} exceed the ${MAX_SIDE}x${MAX_SIDE} limit`);
}
if (png.length > MAX_BYTES) {
  reject(`size ${png.length} bytes exceeds the ${MAX_BYTES}-byte limit`);
}

const destination = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(destination, { recursive: true });
// A plain byte copy: every run writes exactly the repository's image, so
// repeated runs are deterministic by construction.
copyFileSync(source, join(destination, 'entry.png'));
