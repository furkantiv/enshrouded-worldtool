import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readWorld } from './world.mjs';

const APP_ID = '1203620';
const KSD_WORLD = /^world\d+\.ksd$/i;

function uniqueExisting(dirs) {
  const seen = new Set();
  const out = [];
  for (const d of dirs) {
    if (!d) continue;
    try {
      if (!fs.statSync(d).isDirectory()) continue;
      const abs = path.resolve(d);
      const key = abs.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(abs);
    } catch {}
  }
  return out;
}

/** Steam installation roots: env, registry, then common locations. */
export function steamRoots() {
  const cands = [];
  if (process.env.STEAM_PATH) cands.push(process.env.STEAM_PATH);
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { encoding: 'utf8' });
    const m = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (m) cands.push(m[1].trim());
  } catch {}
  cands.push(
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    'D:\\Steam',
    'D:\\SteamLibrary',
    'E:\\Steam',
    'E:\\SteamLibrary',
  );
  // only keep real Steam roots (they contain a userdata folder)
  return uniqueExisting(cands).filter(r => fs.existsSync(path.join(r, 'userdata')));
}

/** Save folders the game itself uses. */
export function localRoots() {
  const home = os.homedir();
  return uniqueExisting([
    path.join(home, 'Saved Games', 'keen games', 'Enshrouded'),
    path.join(home, 'Saved Games', 'enshrouded'),
  ]);
}

function walk(dir, depth, visit) {
  if (depth < 0) return;
  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) walk(p, depth - 1, visit);
    else visit(p, it.name);
  }
}

/**
 * Discover world saves.
 * Returns { worlds: [...], legacy: [...], sources: [...] }
 */
export function discover({ extraDirs = [], maxDepth = 3, strict = false } = {}) {
  const sources = [];
  const files = new Map(); // lowercased realpath -> { file, source, detail }

  const addFile = (file, source, detail) => {
    let real = file;
    try { real = fs.realpathSync.native(file); } catch { try { real = fs.realpathSync(file); } catch {} }
    const key = real.toLowerCase();
    if (!files.has(key)) files.set(key, { file: real, source, detail });
  };

  for (const root of steamRoots()) {
    const userdata = path.join(root, 'userdata');
    let ids = [];
    try { ids = fs.readdirSync(userdata, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch {}
    for (const id of ids) {
      const remote = path.join(userdata, id, APP_ID, 'remote');
      if (!fs.existsSync(remote)) continue;
      let n = 0;
      walk(remote, 1, (p, name) => {
        if (KSD_WORLD.test(name)) { addFile(p, 'SteamCloud', `SteamID ${id}`); n++; }
      });
      if (n) sources.push({ kind: 'SteamCloud', root: remote, account: id, files: n });
    }
  }

  for (const root of localRoots()) {
    let n = 0;
    walk(root, maxDepth, (p, name) => {
      if (KSD_WORLD.test(name)) { addFile(p, 'Local', root); n++; }
    });
    sources.push({ kind: 'Local', root, files: n });
  }

  for (const d of extraDirs) {
    const root = path.resolve(d);
    let n = 0;
    walk(root, maxDepth, (p, name) => {
      if (KSD_WORLD.test(name)) { addFile(p, 'Custom', root); n++; }
    });
    sources.push({ kind: 'Custom', root, files: n });
  }

  const worlds = [];
  const legacy = [];
  for (const { file, source, detail } of files.values()) {
    try {
      const w = readWorld(file);
      worlds.push({ ...w, source, sourceDetail: detail });
    } catch (e) {
      // not an SV2C world: could be an Early Access (0.9) hex-named save or a foreign file
      legacy.push({ file, source, reason: e.message });
    }
  }
  worlds.sort((a, b) => b.mtime - a.mtime);
  return { worlds, legacy, sources };
}

export function findLegacySets(dirs) {
  const sets = [];
  for (const dir of dirs) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch { continue; }
    for (const n of names) {
      if (/^[0-9a-f]{8}$/i.test(n) && names.includes(`${n}-index`)) {
        sets.push({ dir, stem: n });
      }
    }
  }
  return sets;
}
