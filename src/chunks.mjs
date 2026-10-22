// chunk_persistent_data section body parser.
// Layout (validated on shipped saves):
//   @0  u32 constant (0x00136CD3 in observed saves)
//   @4  u32 dataTotal = bodyLength - 8
//   @8  u32 checksum/identifier (algorithm not identified)
//   @12 u32 recordCount
//   @16 u32 chunkCount
//   @20 u32 reserved/flags (256 observed)
//   @24 chunkCount * 12 bytes: u32 chunkId, u32 offset, u32 size   (offsets relative to body+8)
//   data region starts at body+8+entries[0].offset, blobs are contiguous and end at bodyLength.

const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

export function parseChunkSection(body) {
  if (!body || body.length < 32) return { ok: false, reason: 'bölüm gövdesi çok küçük' };
  const dataTotal = u32(body, 4);
  const chunkCount = u32(body, 16);
  const recordCount = u32(body, 12);
  if (chunkCount === 0 || chunkCount > 65536) return { ok: false, reason: `makul olmayan chunk sayısı: ${chunkCount}` };
  const indexEnd = 24 + 12 * chunkCount;
  if (indexEnd > body.length) return { ok: false, reason: 'chunk indeksi gövde dışına taşıyor' };
  if (dataTotal !== body.length - 8) return { ok: false, reason: `uzunluk alanı uyuşmuyor (${dataTotal} != ${body.length - 8})` };
  const entries = [];
  for (let i = 0; i < chunkCount; i++) {
    const at = 24 + 12 * i;
    entries.push({ id: u32(body, at), offset: u32(body, at + 4), size: u32(body, at + 8) });
  }
  // contiguity chain: data base is body+8, first blob starts right after the index
  let cursor = 8 + entries[0].offset;
  if (cursor !== indexEnd) return { ok: false, reason: `veri başlangıcı uyuşmuyor (${cursor} != ${indexEnd})`, entries };
  for (const e of entries) {
    if (8 + e.offset !== cursor) return { ok: false, reason: `blob zinciri kopuk (id ${e.id})`, entries };
    cursor += e.size;
  }
  if (cursor !== body.length) return { ok: false, reason: 'son blob gövde sonunda bitmiyor', entries };
  return {
    ok: true, chunkCount, recordCount, entries,
    spatial: entries.filter(e => e.id < 256).length,
    global: entries.filter(e => e.id >= 256).length,
    totalBytes: entries.reduce((n, e) => n + e.size, 0),
  };
}

export const CHUNK_SECTION = 'chunk_persistent_data';
