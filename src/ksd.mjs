// SV2C container: read / rebuild (drop sections) / verify.
// Layout (validated against shipped saves):
//   0x00 "SV2C" | u16 version | u16 headerSize=48 | u32 fileSize | 16B guid
//   0x1c u32 revision | 0x20 u64 timestamp
//   0x28 u32 (tableOffset - 0x28) | 0x2c u32 sectionCount
//   section table @ tableOffset: 20B entries
//     u32 nameOffset(rel to entry) | u32 nameLen | u32 dataOffset | u32 dataSize | u32 xxh3_low32(block)
//   each section block: "S2BH" | u32 blockVersion | u8 typeId | u8 compressed | u32 dataVersion | body
//   body: zstd frame when compressed=1, raw otherwise

export const HEADER = 48;
export const ENTRY = 20;

const td = new TextDecoder();

export const u16 = (b, o) => b[o] | (b[o + 1] << 8);
export const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
export const w32 = (b, o, v) => {
  b[o] = v & 255; b[o + 1] = (v >>> 8) & 255; b[o + 2] = (v >>> 16) & 255; b[o + 3] = (v >>> 24) & 255;
};

export class KsdError extends Error {}

/** Parse an SV2C container from a Buffer. Throws KsdError on structural problems. */
export function readContainer(buf, { strict = true } = {}) {
  if (buf.length < HEADER) throw new KsdError('dosya bir .ksd kaydı için çok küçük');
  if (td.decode(buf.subarray(0, 4)) !== 'SV2C') throw new KsdError('SV2C imzası yok (1.0 öncesi/eski format olabilir)');
  const version = u16(buf, 4);
  const headerSize = u16(buf, 6);
  const fileSize = u32(buf, 8);
  if (headerSize !== HEADER) throw new KsdError(`desteklenmeyen başlık boyutu: ${headerSize}`);
  if (strict && fileSize !== buf.length) throw new KsdError(`başlık ${fileSize} bayt diyor, dosya ${buf.length} bayt (kesik/bozuk)`);
  const tableAt = 0x28 + u32(buf, 0x28);
  const count = u32(buf, 0x2c);
  if (count > 4096) throw new KsdError(`makul olmayan bölüm sayısı: ${count}`);
  const sections = [];
  for (let i = 0; i < count; i++) {
    const at = tableAt + ENTRY * i;
    if (at + ENTRY > buf.length) throw new KsdError('bölüm tablosu dosya dışına taşıyor');
    const nameAt = at + u32(buf, at);
    const nameLen = u32(buf, at + 4);
    const offset = u32(buf, at + 8);
    const size = u32(buf, at + 12);
    const hash = u32(buf, at + 16);
    if (nameAt + nameLen > buf.length || offset + size > buf.length) throw new KsdError(`bölüm ${i} sınır dışı`);
    const block = buf.subarray(offset, offset + size);
    if (td.decode(block.subarray(0, 4)) !== 'S2BH') throw new KsdError(`bölüm ${i} S2BH başlığı taşımıyor`);
    sections.push({
      name: td.decode(buf.subarray(nameAt, nameAt + nameLen)),
      block,
      offset, size, hash,
      typeId: block[8],
      compressed: block[9],
      blockVersion: u32(block, 4),
      dataVersion: u32(block, 10),
      body: block.subarray(14),
    });
  }
  return {
    buffer: buf, version, revision: u32(buf, 28),
    timestamp: u32(buf, 32) + u32(buf, 36) * 4294967296,
    guid: buf.subarray(12, 28),
    sections,
  };
}

/** Rebuild the container, dropping the named sections. Retained blocks are copied verbatim. */
export function buildWithout(parsed, dropNames) {
  const keep = parsed.sections.filter(s => !dropNames.includes(s.name));
  const dropped = parsed.sections.filter(s => dropNames.includes(s.name));
  if (dropped.length !== dropNames.length) {
    const missing = dropNames.filter(n => !dropped.some(d => d.name === n));
    throw new KsdError(`bölüm(ler) bulunamadı: ${missing.join(', ')}`);
  }
  const now = Math.floor(Date.now() / 1000);
  let pos = HEADER;
  const offsets = keep.map(s => { const o = pos; pos += s.block.length; return o; });
  const tableAt = (pos + 15) & ~15;
  const names = keep.map(s => Buffer.from(s.name, 'utf8'));
  const total = tableAt + ENTRY * keep.length + names.reduce((n, x) => n + x.length, 0);

  const out = Buffer.alloc(total);
  parsed.buffer.copy(out, 0, 0, HEADER);
  w32(out, 8, total);
  w32(out, 28, (parsed.revision + 1) >>> 0);
  w32(out, 32, now % 4294967296);
  w32(out, 36, Math.floor(now / 4294967296));
  w32(out, 0x28, tableAt - 0x28);
  w32(out, 0x2c, keep.length);
  keep.forEach((s, i) => s.block.copy(out, offsets[i]));
  let nameAt = tableAt + ENTRY * keep.length;
  keep.forEach((s, i) => {
    const at = tableAt + ENTRY * i;
    w32(out, at, nameAt - at);
    w32(out, at + 4, names[i].length);
    w32(out, at + 8, offsets[i]);
    w32(out, at + 12, s.block.length);
    w32(out, at + 16, s.hash);
    names[i].copy(out, nameAt);
    nameAt += names[i].length;
  });
  return { buffer: out, keep, dropped };
}

/** Structural verification of a rebuilt container: nothing but the dropped sections may differ. */
export function verifyRebuild(outBuffer, keep, droppedNames) {
  const problems = [];
  let parsed;
  try { parsed = readContainer(outBuffer); } catch (e) { return { ok: false, problems: [e.message], parsed: null }; }
  if (parsed.sections.length !== keep.length) problems.push(`bölüm sayısı ${parsed.sections.length}, beklenen ${keep.length}`);
  for (const name of droppedNames) {
    if (parsed.sections.some(s => s.name === name)) problems.push(`düşürülmesi gereken bölüm hâlâ var: ${name}`);
  }
  keep.forEach((s, i) => {
    const got = parsed.sections[i];
    if (!got) return;
    if (got.name !== s.name) { problems.push(`sıra uyuşmuyor: ${got.name} != ${s.name}`); return; }
    if (Buffer.compare(Buffer.from(got.block), Buffer.from(s.block)) !== 0) problems.push(`blok baytları değişmiş: ${s.name}`);

    if (got.hash !== s.hash) problems.push(`hash alanı değişmiş: ${s.name}`);
  });
  return { ok: problems.length === 0, problems, parsed };
}
