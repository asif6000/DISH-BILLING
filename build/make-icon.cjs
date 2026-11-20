// Generates build/icon.ico with proper multi-size entries:
// 16/32/48/64/128 as 32-bit BMP entries, 256 as PNG entry (best Windows compatibility)
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const BASE = 256
const px = Buffer.alloc(BASE * BASE * 4)

function set(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= BASE || y >= BASE) return
  const i = (y * BASE + x) * 4
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a
}
function get(x, y) {
  const i = (y * BASE + x) * 4
  return [px[i], px[i + 1], px[i + 2], px[i + 3]]
}

// ---- draw base 256 artwork (indigo rounded square + TV + signal) ----
const R = 48
for (let y = 0; y < BASE; y++) {
  for (let x = 0; x < BASE; x++) {
    const cx = Math.min(Math.max(x, R), BASE - 1 - R)
    const cy = Math.min(Math.max(y, R), BASE - 1 - R)
    const inside = (x - cx) * (x - cx) + (y - cy) * (y - cy) <= R * R || (x >= R && x < BASE - R) || (y >= R && y < BASE - R)
    if (inside) {
      const t = y / BASE
      set(x, y, Math.round(79 + 30 * t), Math.round(70 + 20 * t), Math.round(229 - 40 * t))
    }
  }
}
function inRounded(x, y, X, Y, W, H, rad) {
  const cx = Math.min(Math.max(x, X + rad), X + W - 1 - rad)
  const cy = Math.min(Math.max(y, Y + rad), Y + H - 1 - rad)
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= rad * rad ||
    (x >= X + rad && x <= X + W - 1 - rad && y >= Y && y <= Y + H - 1) ||
    (y >= Y + rad && y <= Y + H - 1 - rad && x >= X && x <= X + W - 1)
}
const bx = 52, by = 78, bw = 152, bh = 100, br = 14
for (let y = 0; y < BASE; y++) for (let x = 0; x < BASE; x++) {
  if (inRounded(x, y, bx, by, bw, bh, br)) set(x, y, 255, 255, 255)
  if (inRounded(x, y, bx + 12, by + 12, bw - 24, bh - 24, 8)) set(x, y, 99, 102, 241)
}
for (let y = by + bh; y < by + bh + 10; y++) for (let x = 108; x < 148; x++) set(x, y, 255, 255, 255)
// signal ring + dot
for (let y = 0; y < BASE; y++) for (let x = 0; x < BASE; x++) {
  const d = Math.sqrt((x - 196) ** 2 + (y - 66) ** 2)
  if (d <= 30 && d >= 22) set(x, y, 255, 255, 255)
}
for (let y = 62; y < 70; y++) for (let x = 192; x < 200; x++) set(x, y, 255, 255, 255)

// ---- scale to a size (box filter) ----
function scaled(size) {
  const out = Buffer.alloc(size * size * 4)
  const ratio = BASE / size
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0
      for (let sy = Math.floor(y * ratio); sy < Math.floor((y + 1) * ratio) && sy < BASE; sy++) {
        for (let sx = Math.floor(x * ratio); sx < Math.floor((x + 1) * ratio) && sx < BASE; sx++) {
          const [pr, pg, pb, pa] = get(sx, sy)
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa; n++
        }
      }
      const i = (y * size + x) * 4
      if (a > 0) {
        out[i] = Math.round(r / a); out[i + 1] = Math.round(g / a); out[i + 2] = Math.round(b / a); out[i + 3] = Math.round(a / n)
      }
    }
  }
  return out
}

// ---- PNG encode (for 256 entry) ----
function crc32(buf) {
  let c, table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function pngFrom(rgba, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---- BMP entry (32-bit BGRA, bottom-up + empty AND mask) ----
function bmpEntry(rgba, size) {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(size, 4)
  header.writeInt32LE(size * 2, 8) // XOR + AND heights
  header.writeUInt16LE(1, 12)      // planes
  header.writeUInt16LE(32, 14)     // bpp
  header.writeUInt32LE(0, 16)      // BI_RGB
  const imageSize = size * size * 4
  header.writeUInt32LE(imageSize, 20)
  const xor = Buffer.alloc(imageSize)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const si = (y * size + x) * 4
      const di = ((size - 1 - y) * size + x) * 4
      xor[di] = rgba[si + 2]     // B
      xor[di + 1] = rgba[si + 1] // G
      xor[di + 2] = rgba[si]     // R
      xor[di + 3] = rgba[si + 3] // A
    }
  }
  const andMask = Buffer.alloc(size * size / 8) // zeros = use alpha
  return Buffer.concat([header, xor, andMask])
}

// ---- assemble ICO ----
const sizes = [16, 24, 32, 48, 64, 128, 256]
const entries = []
for (const s of sizes) {
  const rgba = scaled(s)
  if (s === 256) entries.push({ size: s, data: pngFrom(rgba, s), png: true })
  else entries.push({ size: s, data: bmpEntry(rgba, s), png: false })
}

const count = entries.length
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(count, 4)

let offset = 6 + count * 16
const dirEntries = [], imageData = []
for (const e of entries) {
  const d = Buffer.alloc(16)
  d[0] = e.size === 256 ? 0 : e.size
  d[1] = e.size === 256 ? 0 : e.size
  d[4] = 1; d[5] = 0
  d.writeUInt16LE(32, 6)
  d.writeUInt32LE(e.data.length, 8)
  d.writeUInt32LE(offset, 12)
  dirEntries.push(d)
  imageData.push(e.data)
  offset += e.data.length
}

fs.mkdirSync('build', { recursive: true })
fs.writeFileSync(path.join('build', 'icon.ico'), Buffer.concat([header, ...dirEntries, ...imageData]))
console.log('build/icon.ico (multi-size) written:', fs.statSync(path.join('build', 'icon.ico')).size, 'bytes,', count, 'sizes')
