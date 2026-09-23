const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function createPng(width, height, rgbaBuffer) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdr);

  const scanlines = [];
  for (let y = 0; y < height; y++) {
    scanlines.push(Buffer.from([0])); // filter type: none
    scanlines.push(rgbaBuffer.subarray(y * width * 4, (y + 1) * width * 4));
  }
  const idatData = zlib.deflateSync(Buffer.concat(scanlines));
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

// Parse hex/rgba to [r, g, b, a]
function parseColor(str) {
  if (!str || str === 'transparent') return [0, 0, 0, 0];
  if (str.startsWith('#')) {
    const hex = str.slice(1);
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      255
    ];
  }
  if (str.startsWith('rgba')) {
    const m = str.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
    if (m) {
      return [
        parseInt(m[1], 10),
        parseInt(m[2], 10),
        parseInt(m[3], 10),
        Math.round(parseFloat(m[4]) * 255)
      ];
    }
  }
  return [0, 0, 0, 0];
}

// 16-color authentic pixel-art palette matched to reference
const PALETTE = {
  '.': 'transparent',
  '#': '#1A2531', // Bold pixel outline
  'G': '#162E1D', // Deep pine foliage shadow
  'g': '#2A5331', // Rich forest pine green body
  'L': '#668F3A', // Sunlit olive-green needle highlight
  'l': '#7EA648', // Brightest warm needle tip
  'W': '#FFFFFF', // Pure brilliant white sunlit snow
  's': '#E4EEF6', // Soft light snow transition
  'S': '#C4D5E5', // Crisp ambient powder snow blue
  'd': '#7992A8', // Shaded snow slate-blue
  'D': '#4C647C', // Deep snow crease / underside shadow
  't': '#2A1C18', // Trunk outline & fissure crevices
  'T': '#4F352F', // Trunk dark brown bark
  'm': '#755047', // Trunk midtone body bark
  'h': '#996C5F', // Trunk highlight bark ridge
  'O': 'rgba(84, 107, 131, 0.42)', // Inner core ground shadow
  'o': 'rgba(122, 145, 169, 0.30)', // Mid ground shadow
  'p': 'rgba(152, 174, 196, 0.18)', // Outer soft snow shadow rim
};

const SPRUCE_A_GRID = [
  "..............................................",
  "......................##......................",
  ".....................#SS#.....................",
  ".....................#WS#.....................",
  "....................#WWS#.....................",
  "...................#WWWSS#....................",
  "..................#WWWSSd#....................",
  "..................#WWSSdd#....................",
  ".................#lGSSddd#....................",
  "................#LlG#ddd#g#...................",
  "...............#lLgg#WW#ggg#..................",
  "..............#lGgg#WWWW#Ggg#.................",
  ".............#lL#WWWWWWWW#Ggg#................",
  "............#Lg#WWWWWWWWWS#GG#................",
  "...........#Lg#WWWWWWWWWWSS#G#................",
  "..........#Lgg#WWWWWWWWWSSdd##................",
  ".........#Lggg#WWWWWWWWSSSddD#................",
  "..........#Lg#d#WWWWWWSSSSddD#g#..............",
  ".........#lG#ddd#WWWWSSSSddD#ggg#.............",
  "........#LlGg#dd#d##SSSddD##Ggggg#............",
  ".......#lLgggG####..####D##GGggggg#...........",
  "......#lLggggG#WW#..#WW##Gggggggggg#..........",
  ".....#lLgggg#WWWW####WWW##GGgggggggG#.........",
  "....#lL#WW##WWWWWWWWWWWWWW#GggggggggG#........",
  "...#Lg#WWWWWWWWWWWWWWWWWWWS#Gggggggggg#.......",
  "..#lG#WWWWWWWWWWWWWWWWWWWSSd#GggggggggG#......",
  "..#Lg#WWWWWWWWWWWWWWWWWWSSddd#GgggggggG#......",
  ".#lLgg#WWWWWW#WWWWWWWWWSSSSddD#GgggggggG#.....",
  "#llLgg#d##WW#d#WWWWWWWSSSSdddD##GggggggG#.....",
  "#LlGg#ddd#W#ddd#WWWWWWSSSdddD#WW#GggggggG#....",
  ".#G#dddD##W##ddd#WWWWWSSdddD#WWWW#GGggggG#....",
  "..#DddD#WWWW##dd#d##SSdddD##WWWWWSS#GGggG#....",
  "..#L#WWWWWWWW##d#...####D##WWWWWWSSdd#GGG#....",
  ".#lL#WWWWWWWWWS##...#WW##GWWWWWWSSSddD#G#.....",
  "#llLg#WWWWWWWSSdd#.#WWWW#GWWWWWSSSSddD##......",
  "#LlGgg#WWWWWSSSddD##WWWW#GWWWWSSSSSddD#.......",
  ".#lGggg#d##SSSSddD##WWWW#GGWWSSSSSddD#........",
  "..#GGggG#..###DdD##G#WWW##GGWSSSSddD#.........",
  "...#GGGG#...#TthhthtT#WW##GG#SSdddD#..........",
  "....####....#TmhhhhhT#dd##G#..####............",
  "............#TmhhhhhT#D##G#...................",
  "...........#p#TmhhhhT#d####...................",
  "........#ooOO#TmhhhhT#OOooo#..................",
  "......#ooOOOO#TmmhhhT#OOOOOoo#................",
  ".....#ooOOOOO#TmmmmhT#OOOOOOoo#...............",
  "......#ooOOOO#TtttttT#OOOOOoo#................",
  ".......#oooOO#########OOOooo#.................",
  ".........#ooooooooooooooo#....................",
  "...........#ooooooooooo#......................",
  ".............#ppppppp#........................",
  "..............................................",
  "..............................................",
];

function gridToRgba(lines, scale = 1) {
  const srcH = lines.length;
  const srcW = lines[0].length;
  const dstW = srcW * scale;
  const dstH = srcH * scale;
  const buf = Buffer.alloc(dstW * dstH * 4);

  for (let y = 0; y < srcH; y++) {
    const row = lines[y];
    for (let x = 0; x < srcW; x++) {
      const ch = row[x] || '.';
      const [r, g, b, a] = parseColor(PALETTE[ch]);

      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const idx = ((y * scale + sy) * dstW + (x * scale + sx)) * 4;
          buf[idx] = r;
          buf[idx + 1] = g;
          buf[idx + 2] = b;
          buf[idx + 3] = a;
        }
      }
    }
  }
  return { width: dstW, height: dstH, buffer: buf };
}

// 1. Export 1x spruce.png
const img1x = gridToRgba(SPRUCE_A_GRID, 1);
const png1x = createPng(img1x.width, img1x.height, img1x.buffer);
fs.writeFileSync(path.join(__dirname, '../public/spruce.png'), png1x);
console.log('Created public/spruce.png (', img1x.width, 'x', img1x.height, ')');

// 2. Export 4x spruce_x4.png (for high-res pixel-crisp viewing)
const img4x = gridToRgba(SPRUCE_A_GRID, 4);
const png4x = createPng(img4x.width, img4x.height, img4x.buffer);
fs.writeFileSync(path.join(__dirname, '../public/spruce_x4.png'), png4x);
console.log('Created public/spruce_x4.png (', img4x.width, 'x', img4x.height, ')');

// 3. Export 8x spruce_x8.png (crystal clear preview)
const img8x = gridToRgba(SPRUCE_A_GRID, 8);
const png8x = createPng(img8x.width, img8x.height, img8x.buffer);
fs.writeFileSync(path.join(__dirname, '../public/spruce_x8.png'), png8x);
console.log('Created public/spruce_x8.png (', img8x.width, 'x', img8x.height, ')');
