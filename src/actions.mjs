import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { buildWithout, verifyRebuild, readContainer } from './ksd.mjs';
import { CHUNK_SECTION } from './chunks.mjs';
import { backupWorld, writeAtomic } from './backup.mjs';
import XXH3 from './xxh3.mjs';

function procRunning(image) {
  try {
    const out = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${image}`, '/NH', '/FO', 'CSV'],
      { encoding: 'utf8', windowsHide: true, timeout: 10000 });
    return out.toLowerCase().includes(`"${image.toLowerCase()}"`);
  } catch {
    return false;
  }
}

export const clientRunning = () => procRunning('enshrouded.exe');
export const serverRunning = () => procRunning('enshrouded_server.exe');
export const steamRunning = () => procRunning('steam.exe');
export const gameRunning = () => clientRunning() || serverRunning();

/** Which blocking process is alive, if any. */
export function runningProcess() {
  if (clientRunning()) return 'enshrouded.exe';
  if (serverRunning()) return 'enshrouded_server.exe';
  return null;
}

/** Recompute every section hash and compare with the stored value. */
export function verifyWorld(w) {
  let ok = 0;
  const bad = [];
  for (const s of w.container.sections) {
    const calc = XXH3.low32(s.block);
    if (calc === s.hash) ok++;
    else bad.push({ name: s.name, stored: s.hash.toString(16), calc: calc.toString(16) });
  }
  return { ok, bad, total: w.container.sections.length };
}

/**
 * Drop chunk_persistent_data so the world regenerates every area outside Flame Altar bases.
 * Base sections (base00..baseNN) are copied verbatim.
 */
export function resetWorld(w, { dryRun = false, force = false } = {}) {
  if (!force && gameRunning()) throw new Error('game-running');
  if (!w.chunk.present) return { noop: true, reason: 'no-chunk' };
  const container = readContainer(fs.readFileSync(w.file));
  const { buffer, keep, dropped } = buildWithout(container, [CHUNK_SECTION]);
  const projected = buffer.length;

  if (dryRun) {
    return {
      dryRun: true, before: w.size, after: projected,
      dropped: dropped.map(d => ({ name: d.name, size: d.size })),
      bases: w.baseCount, chunk: w.chunk,
    };
  }

  const backup = backupWorld(w);
  writeAtomic(w.file, buffer);
  const check = verifyRebuild(buffer, keep, [CHUNK_SECTION]);

  if (!check.ok) {
    // roll back immediately, never leave a half-consistent world behind
    fs.copyFileSync(backup.bak, w.file);
    throw new Error(`verify-failed: ${check.problems.join('; ')}`);
  }
  return {
    before: w.size, after: buffer.length,
    dropped: dropped.map(d => ({ name: d.name, size: d.size })),
    bases: w.baseCount, chunk: w.chunk, backup, verify: check,
    revision: { from: w.revision, to: check.parsed.revision },
    steamWarning: w.source === 'SteamCloud' && steamRunning(),
  };
}
