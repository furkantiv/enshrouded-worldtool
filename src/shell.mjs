import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

// Windows may show localized display names for shell folders (e.g. on Turkish
// Windows "Saved Games" is shown as "Kaydedilen Oyunlar"). The physical path is
// still the English one, so we resolve the display name per segment via the shell.

const cache = new Map();
const q = (s) => String(s).replace(/'/g, "''");

function hasDesktopIni(dir) {
  try { return fs.existsSync(path.join(dir, 'desktop.ini')); } catch { return false; }
}

/** Localized display name of one folder, or null. */
export function displayName(dir) {
  const abs = path.resolve(dir);
  const key = abs.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  let name = null;
  try {
    const parent = path.dirname(abs);
    const leaf = path.basename(abs);
    const ps = "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;" +
      "$s=New-Object -ComObject Shell.Application;" +
      `$f=$s.Namespace('${q(parent)}');` +
      (leaf ? `$i=$f.ParseName('${q(leaf)}');if($i){$i.Name}` : '');
    const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps],
      { encoding: 'utf8', windowsHide: true, timeout: 15000 });
    name = out.trim() || null;
  } catch { name = null; }
  cache.set(key, name);
  return name;
}

/** Path as Explorer shows it: localized segments where Windows localizes them. */
export function renderPath(p) {
  const abs = path.resolve(p);
  const root = path.parse(abs).root;
  const parts = abs.slice(root.length).split(path.sep).filter(Boolean);
  let cur = root.replace(/[\\/]$/, '');
  const shown = [];
  for (const part of parts) {
    cur = path.join(cur, part);
    let s = part;
    if (hasDesktopIni(cur)) {
      const dn = displayName(cur);
      if (dn && dn !== part) s = dn;
    }
    shown.push(s);
  }
  return root + shown.join('\\');
}

/** True when Explorer shows a different name than the physical one. */
export function isLocalized(p) {
  return renderPath(p) !== path.resolve(p);
}

export function openInExplorer(target) {
  if (!fs.existsSync(target)) return false;
  spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' }).unref();
  return true;
}
