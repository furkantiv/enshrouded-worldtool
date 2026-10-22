import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { readContainer } from './ksd.mjs';
import { worldKey } from './world.mjs';

export const DEFAULT_BACKUP_ROOT = path.join(os.homedir(), 'Saved Games', 'keen games', 'Enshrouded', '_backups');
const KEEP = 25;

const stamp = (d = new Date()) => d.toISOString().replace(/[:.]/g, '-');

export function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function backupRoot(override) {
  return override || process.env.EWT_BACKUP_DIR || DEFAULT_BACKUP_ROOT;
}

export function backupWorld(w, { root } = {}) {
  const key = worldKey(w);
  const dir = path.join(backupRoot(root), key);
  fs.mkdirSync(dir, { recursive: true });
  const ts = stamp();
  const bak = path.join(dir, `${ts}.bak`);
  fs.copyFileSync(w.file, bak);
  const manifest = {
    key, createdAt: new Date().toISOString(), sourceFile: w.file,
    worldName: w.worldName, guid: w.guid, revision: w.revision,
    size: w.size, sha256: sha256(bak), reason: 'pre-reset',
  };
  fs.writeFileSync(path.join(dir, `${ts}.json`), JSON.stringify(manifest, null, 2));
  prune(dir);
  return { bak, manifest };
}

function prune(dir) {
  let entries = [];
  try { entries = fs.readdirSync(dir).filter(n => n.endsWith('.bak')).sort(); } catch { return; }
  for (const old of entries.slice(0, Math.max(0, entries.length - KEEP))) {
    const base = old.replace(/\.bak$/, '');
    for (const f of [`${base}.bak`, `${base}.json`]) {
      try { fs.unlinkSync(path.join(dir, f)); } catch {}
    }
  }
}

export function listBackups(w, { root } = {}) {
  const dir = path.join(backupRoot(root), worldKey(w));
  let names = [];
  try { names = fs.readdirSync(dir).filter(n => n.endsWith('.json')); } catch { return []; }
  return names.map(n => {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
    return { ...meta, bak: path.join(dir, n.replace(/\.json$/, '.bak')) };
  }).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Restore a backup over the live save, keeping the current file as a safety copy. */
export function restoreBackup(bak, targetFile) {
  const buf = fs.readFileSync(bak);
  readContainer(buf); // structural sanity check before touching the live file
  const safetyDir = path.join(backupRoot(), '_pre-restore');
  fs.mkdirSync(safetyDir, { recursive: true });
  const safety = path.join(safetyDir, `${path.basename(targetFile)}.${stamp()}.bak`);
  if (fs.existsSync(targetFile)) fs.copyFileSync(targetFile, safety);
  writeAtomic(targetFile, buf);
  return { safety };
}

export function writeAtomic(targetFile, buf) {
  const tmp = `${targetFile}.ewt-tmp`;
  fs.writeFileSync(tmp, buf);
  try {
    fs.renameSync(tmp, targetFile);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch {}
    throw e;
  }
}
