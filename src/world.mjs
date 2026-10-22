import fs from 'node:fs';
import path from 'node:path';
import { readContainer, u32 } from './ksd.mjs';
import { parseChunkSection, CHUNK_SECTION } from './chunks.mjs';

const td = new TextDecoder();
const tdFatal = new TextDecoder('utf-8', { fatal: true });

/** World name lives in world_metadata as a length-prefixed UTF-8 string. */
function extractName(body) {
  for (let o = 40; o + 5 <= body.length; o++) {
    const len = u32(body, o);
    if (len < 1 || len > 64 || o + 4 + len > body.length) continue;
    let s;
    try { s = tdFatal.decode(body.subarray(o + 4, o + 4 + len)); } catch { continue; }
    if (!/^[\p{L}\p{N}\p{P}\p{Zs}]+$/u.test(s)) continue;
    return s;
  }
  return null;
}

/** Read one world save: container facts + world name + base count + chunk persistence summary. */
export function readWorld(file) {
  const stat = fs.statSync(file);
  const buf = fs.readFileSync(file);
  const c = readContainer(buf);
  const meta = c.sections.find(s => s.name === 'world_metadata');
  const bases = c.sections.filter(s => /^base\d+$/.test(s.name));
  const chunkSection = c.sections.find(s => s.name === CHUNK_SECTION) ?? null;

  let chunk = null;
  if (chunkSection) {
    if (chunkSection.compressed === 1) {
      chunk = { present: true, size: chunkSection.size, compressed: true, ok: false, reason: 'bölüm sıkıştırılmış; kayıt listesi okunamadı' };
    } else {
      const parsed = parseChunkSection(chunkSection.body);
      chunk = { present: true, size: chunkSection.size, compressed: false, ...parsed };
    }
  } else {
    chunk = { present: false };
  }

  return {
    file, dir: path.dirname(file), name: path.basename(file),
    size: buf.length, mtime: stat.mtimeMs,
    revision: c.revision,
    timestamp: c.timestamp,
    guid: [...c.guid].map(x => x.toString(16).padStart(2, '0')).join(''),
    worldName: meta ? extractName(meta.body) : null,
    sections: c.sections,
    sectionCount: c.sections.length,
    bases,
    baseCount: bases.length,
    chunk,
    container: c,
  };
}

export function worldKey(w) {
  return `${(w.worldName || w.name).replace(/[^\p{L}\p{N}._ -]+/gu, '_').trim()}-${w.guid.slice(0, 8)}`;
}
