#!/usr/bin/env node
// ewt — Enshrouded World Tool (1.0 .ksd saves)
// Drops chunk_persistent_data: everything outside Flame Altar bases regenerates on the next load.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discover, localRoots, steamRoots } from './src/discover.mjs';
import { readWorld } from './src/world.mjs';
import { resetWorld, verifyWorld, gameRunning, runningProcess } from './src/actions.mjs';
import { backupWorld, listBackups, restoreBackup, backupRoot } from './src/backup.mjs';
import { renderPath, openInExplorer } from './src/shell.mjs';
import { t, setLang, resolveLang, getLang } from './src/i18n.mjs';
import { c, table, bytes, when, ask, confirm, title, ok, warn, err, info, rlClose } from './src/ui.mjs';

const canon = (p) => { try { return fs.realpathSync.native(p); } catch { return p; } };
const loadWorlds = (dirs) => discover({ extraDirs: dirs });

/** Message for the process that blocks writing (client or dedicated server). */
function blockedText() {
  return runningProcess() === 'enshrouded_server.exe' ? t('msg.serverRunning') : t('msg.clientRunning');
}

function handleResetError(e) {
  const m = String(e?.message ?? e);
  if (m === 'game-running') { console.log(err(blockedText())); return; }
  if (m.startsWith('verify-failed: ')) { console.log(err(t('msg.verifyFailed', { detail: m.slice(15) }))); return; }
  console.log(err(m));
}

function parseArgs(argv) {
  const out = { _: [], dirs: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') out.dirs.push(argv[++i]);
    else if (a === '--world') out.flags.world = Number(argv[++i]);
    else if (a === '--path') out.flags.path = argv[++i];
    else if (a === '--from') out.flags.from = argv[++i];
    else if (a === '--lang') out.flags.lang = argv[++i];
    else if (a.startsWith('--')) out.flags[a.slice(2)] = true;
    else out._.push(a);
  }
  return out;
}

function helpText() {
  const row = (cmd, desc) => `  ${cmd.padEnd(32)}${c.dim(desc)}`;
  return `
${c.bold('ewt')} — ${t('app')}
${t('tagline')}

${c.bold(t('h.usage'))}
${row('ewt', t('h.cmd.menu'))}
${row('ewt list', t('h.cmd.list'))}
${row('ewt reset [sel] [--dry-run]', t('h.cmd.reset'))}
${row('ewt verify [sel]', t('h.cmd.verify'))}
${row('ewt backup [sel]', t('h.cmd.backup'))}
${row('ewt backups [sel]', t('h.cmd.backups'))}
${row('ewt restore [sel] [--from <f>]', t('h.cmd.restore'))}
${row('ewt where', t('h.cmd.where'))}
${row('ewt open [--backups]', t('h.cmd.open'))}

${c.bold(t('h.selection'))}
${row('--world <n>', t('h.arg.world'))}
${row('--path <file>', t('h.arg.path'))}
${row('--dir <folder>', t('h.arg.dir'))}
${row('--lang en|tr', t('h.arg.lang'))}

${c.bold(t('h.notes'))}
  • ${t('h.note.reset')}
  • ${t('h.note.write')}
  • ${t('h.note.steam')}
  • ${t('h.note.loc')}
`;
}

function chunkCell(w) {
  if (!w.chunk.present) return c.dim(t('cell.none'));
  if (w.chunk.compressed) return `${bytes(w.chunk.size)} ${t('cell.compressed')}`;
  if (!w.chunk.ok) return `${bytes(w.chunk.size)} ${t('cell.unreadable')}`;
  return t('cell.chunkRow', { size: bytes(w.chunk.size), n: w.chunk.chunkCount });
}

function printList({ worlds, legacy, sources }) {
  console.log(title(t('title.worlds')));
  for (const s of sources) {
    console.log(c.dim(`  ${s.kind.padEnd(11)} ${renderPath(canon(s.root))}${s.account ? ` (${s.account})` : ''} → ${s.files}`));
  }
  console.log();
  if (!worlds.length) {
    console.log(warn(t('msg.noWorlds')));
    if (legacy.length) console.log(info(t('msg.legacy', { n: legacy.length })));
    return;
  }
  const rows = worlds.map((w, i) => [
    String(i + 1),
    w.worldName || c.dim('-'),
    w.source,
    bytes(w.size),
    String(w.revision),
    when(w.mtime),
    String(w.baseCount),
    chunkCell(w),
  ]);
  console.log(table([t('th.num'), t('th.world'), t('th.source'), t('th.size'), t('th.rev'), t('th.saved'), t('th.base'), t('th.chunk')], rows));
  console.log(c.dim(`\n  ${t('msg.total', { n: worlds.length })}`));
}

function printDetails(w) {
  console.log(title(`${w.worldName || w.name}  ${c.dim(w.guid.slice(0, 8))}`));
  console.log(`  ${t('l.file').padEnd(9)} ${w.file}`);
  const shown = renderPath(w.file);
  if (shown !== path.resolve(w.file)) console.log(`  ${t('l.explorer').padEnd(9)} ${c.dim(shown)}`);
  console.log(`  ${t('l.source').padEnd(9)} ${w.source}${w.sourceDetail ? ` (${w.sourceDetail})` : ''}`);
  console.log(`  ${t('l.size').padEnd(9)} ${bytes(w.size)}   ${t('th.rev')} ${w.revision}`);
  console.log(`  ${t('l.saved').padEnd(9)} ${when(w.mtime)}`);
  console.log(`  ${t('l.sections').padEnd(9)} ${w.sectionCount}   ${t('l.base')}: ${w.baseCount}`);
  if (!w.chunk.present) {
    console.log(`  ${t('l.chunk').padEnd(9)} ${c.green(t('cell.none'))}`);
  } else if (w.chunk.ok) {
    console.log(`  ${t('l.chunk').padEnd(9)} ${t('l.chunkDetail', {
      size: bytes(w.chunk.size), n: w.chunk.chunkCount,
      spatial: w.chunk.spatial, other: w.chunk.global, records: w.chunk.recordCount,
    })}`);
  } else {
    console.log(`  ${t('l.chunk').padEnd(9)} ${bytes(w.chunk.size)} ${c.dim(w.chunk.reason || '')}`);
  }
}

function pick(list, sel) {
  if (sel.path) {
    if (!fs.existsSync(sel.path)) throw new Error(t('msg.fileMissing', { path: sel.path }));
    return { ...readWorld(sel.path), source: 'Custom', sourceDetail: path.dirname(sel.path) };
  }
  if (!list.worlds.length) throw new Error(t('msg.worldsMissing'));
  const n = sel.world ?? (list.worlds.length === 1 ? 1 : null);
  if (!n) throw new Error(t('msg.needWorld'));
  if (n < 1 || n > list.worlds.length) throw new Error(t('msg.badWorld', { n }));
  return list.worlds[n - 1];
}

function reportReset(r) {
  if (r.noop) { console.log(info(t('msg.noChunk'))); return; }
  const list = r.dropped.map(d => `${d.name} (${bytes(d.size)})`).join(', ');
  if (r.dryRun) {
    console.log(title(t('title.dry')));
    console.log(`  ${t('msg.dropList').padEnd(12)}: ${list}`);
    console.log(`  ${t('l.size').padEnd(12)}: ${bytes(r.before)} → ${bytes(r.after)}`);
    console.log(`  ${t('l.base').padEnd(12)}: ${r.bases}`);
    console.log(info(t('msg.dryInfo')));
    return;
  }
  console.log(title(t('title.done')));
  console.log(ok(t('msg.dropped', { list })));
  console.log(ok(t('msg.sizeRev', { a: bytes(r.before), b: bytes(r.after), from: r.revision.from, to: r.revision.to })));
  console.log(ok(t('msg.basesKept', { n: r.bases })));
  console.log(ok(t('msg.backup', { path: r.backup.bak })));
  if (r.steamWarning) console.log(warn(t('msg.steam')));
  console.log(`\n${info(t('msg.next'))}`);
}

async function doReset(w, flags) {
  if (!flags.force && gameRunning()) { console.log(err(blockedText())); return; }
  printDetails(w);
  if (!w.chunk.present) { console.log(info(t('msg.noChunk'))); return; }
  if (flags['dry-run']) {
    try { reportReset(resetWorld(w, { dryRun: true, force: flags.force })); } catch (e) { handleResetError(e); }
    return;
  }
  if (!flags.yes) {
    if (!(await confirm(`\n${c.yellow(t('p.confirmReset'))}`, 'RESET'))) { console.log(info(t('msg.cancelled'))); return; }
  }
  try { reportReset(resetWorld(w, { force: flags.force })); } catch (e) { handleResetError(e); }
}

async function chooseLang() {
  console.log(`\n  1  English\n  2  Türkçe`);
  const a = (await ask('Language / Dil')).trim();
  if (a === '1' && setLang('en')) console.log(ok(t('msg.langSet')));
  else if (a === '2' && setLang('tr')) console.log(ok(t('msg.langSet')));
}

async function worldMenu(w0) {
  let w = w0;
  for (;;) {
    printDetails(w);
    console.log(`
  ${c.bold('1')}  ${t('m.reset')}
  ${c.bold('2')}  ${t('m.verify')}
  ${c.bold('3')}  ${t('m.backup')}
  ${c.bold('4')}  ${t('m.backups')}
  ${c.bold('o')}  ${t('m.open')}
  ${c.bold('b')}  ${t('m.back')}
  ${c.bold('q')}  ${t('m.quit')}`);

    const act = (await ask(t('p.choice'))).trim().toLowerCase();
    if (act === '' || act === 'b') return;
    if (act === 'q') { rlClose(); process.exit(0); }

    if (act === '1') await doReset(w, {});
    else if (act === '2') {
      const v = verifyWorld(w);
      console.log(v.bad.length
        ? err(t('msg.badSections', { list: v.bad.map(b => b.name).join(', ') }))
        : ok(t('msg.verified', { name: w.worldName || w.name, n: v.total })));
    } else if (act === '3') {
      console.log(ok(t('msg.backup', { path: backupWorld(w).bak })));
    } else if (act === '4') {
      const items = listBackups(w);
      if (!items.length) { console.log(info(t('msg.noBackups'))); }
      else {
        items.forEach((b, i) => console.log(`  ${i + 1}  ${b.createdAt}  rev ${b.revision}  ${bytes(b.size)}  ${path.basename(b.bak)}`));
        const n = (await ask(t('p.restore'))).trim();
        if (n) {
          const target = items[Number(n) - 1];
          if (!target) console.log(err(t('msg.badNumber')));
          else if (gameRunning()) console.log(err(blockedText()));
          else if (await confirm(`${t('p.confirmRestore')} ${path.basename(target.bak)} (rev ${target.revision})`, 'RESTORE')) {
            try {
              const r = restoreBackup(target.bak, w.file);
              console.log(ok(t('msg.restored', { path: r.safety })));
            } catch (e) { console.log(err(e.message)); }
          } else console.log(info(t('msg.cancelled')));
        }
      }
    } else if (act === 'o') {
      const dir = path.dirname(w.file);
      if (openInExplorer(dir)) console.log(ok(t('msg.opened', { path: renderPath(dir) })));
      else console.log(err(t('msg.folderMissing', { path: dir })));
    } else {
      console.log(err(t('msg.badNumber')));
      continue;
    }

    // reload the world from disk so the menu reflects the new state
    try { w = { ...readWorld(w.file), source: w.source, sourceDetail: w.sourceDetail }; } catch {}
    await ask(`\n${c.dim(t('p.back'))}`);
  }
}

async function menu() {
  for (;;) {
    const list = loadWorlds([]);
    printList(list);
    if (!list.worlds.length) { await ask(t('p.back')); return; }
    const raw = (await ask(`\n${t('p.world')}`)).trim().toLowerCase();
    if (!raw || raw === 'q') return;
    if (raw === 'l') { await chooseLang(); continue; }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > list.worlds.length) { console.log(err(t('msg.badNumber'))); continue; }
    await worldMenu(list.worlds[n - 1]);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] ?? 'menu';

  if (args.flags.lang) {
    if (!setLang(String(args.flags.lang).toLowerCase(), { persist: false })) {
      console.error(err(`unsupported language: ${args.flags.lang}`));
      process.exitCode = 2;
      return;
    }
  } else {
    setLang(resolveLang([]), { persist: false });
  }

  if (args.flags.help || cmd === 'help' || cmd === '-h') { console.log(helpText()); return; }

  let cached = null;
  const getList = () => (cached ??= loadWorlds(args.dirs));

  if (cmd === 'where') {
    console.log(title(t('title.locations')));
    const line = (tag, p) => {
      const full = canon(p);
      console.log(`  ${tag.padEnd(8)}${full}`);
      const shown = renderPath(full);
      if (shown !== path.resolve(full)) console.log(`  ${''.padEnd(8)}${c.dim(`${t('l.explorer')}: ${shown}`)}`);
    };
    for (const r of steamRoots()) line('Steam', r);
    for (const r of localRoots()) line('Local', r);
    for (const d of args.dirs) line('Extra', path.resolve(d));
    line('Backup', backupRoot());
    console.log(c.dim(`\n  ${t('h.note.loc')}`));
    return;
  }

  if (cmd === 'open') {
    const toolDir = fileURLToPath(new URL('.', import.meta.url));
    let target;
    if (args.flags.backups) target = backupRoot();
    else if (args.flags.tool) target = toolDir;
    else if (args.flags.world || args.flags.path) target = path.dirname(pick(getList(), args.flags).file);
    else target = getList().worlds[0] ? path.dirname(getList().worlds[0].file) : (localRoots()[0] ?? toolDir);
    if (!openInExplorer(target)) { console.log(err(t('msg.folderMissing', { path: target }))); process.exitCode = 1; return; }
    console.log(ok(t('msg.opened', { path: renderPath(target) })));
    return;
  }

  const list = getList();

  if (cmd === 'list') {
    if (args.flags.json) {
      console.log(JSON.stringify(list.worlds.map(w => ({
        file: w.file, source: w.source, sourceDetail: w.sourceDetail, worldName: w.worldName,
        guid: w.guid, size: w.size, revision: w.revision, mtime: new Date(w.mtime).toISOString(),
        sections: w.sectionCount, bases: w.baseCount,
        chunk: w.chunk.present ? { size: w.chunk.size, chunks: w.chunk.chunkCount ?? null, ok: w.chunk.ok ?? null } : null,
      })), null, 2));
    } else printList(list);
    return;
  }

  if (cmd === 'verify') {
    const w = pick(list, args.flags);
    const v = verifyWorld(w);
    console.log(v.bad.length
      ? err(t('msg.badSections', { list: v.bad.map(b => `${b.name} (${b.stored} != ${b.calc})`).join(', ') }))
      : ok(t('msg.verified', { name: w.worldName || w.name, n: v.total })));
    return;
  }

  if (cmd === 'backup') {
    console.log(ok(t('msg.backup', { path: backupWorld(pick(list, args.flags)).bak })));
    return;
  }

  if (cmd === 'backups') {
    const items = listBackups(pick(list, args.flags));
    if (!items.length) { console.log(info(t('msg.noBackups'))); return; }
    items.forEach((b, i) => console.log(`  ${i + 1}  ${b.createdAt}  rev ${b.revision}  ${bytes(b.size)}  ${path.basename(b.bak)}`));
    return;
  }

  if (cmd === 'restore') {
    const w = pick(list, args.flags);
    const items = listBackups(w);
    if (!items.length && !args.flags.from) { console.log(err(t('msg.noBackups'))); return; }
    const target = args.flags.from ? { bak: args.flags.from } : items[0];
    if (gameRunning() && !args.flags.force) { console.log(err(blockedText())); return; }
    if (!args.flags.yes && !(await confirm(`\n${path.basename(target.bak)}`, 'RESTORE'))) { console.log(info(t('msg.cancelled'))); return; }
    const r = restoreBackup(target.bak, w.file);
    console.log(ok(t('msg.restored', { path: r.safety })));
    return;
  }

  if (cmd === 'reset') { await doReset(pick(list, args.flags), args.flags); return; }

  if (cmd === 'menu') { await menu(); return; }

  console.log(err(t('msg.unknown', { cmd })));
  console.log(helpText());
  process.exitCode = 2;
}

main()
  .catch(e => { console.error(err(e.message)); process.exitCode = 1; })
  .finally(() => rlClose());
