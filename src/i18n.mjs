import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// UI strings. Add a language by adding a key with the same shape.
const dict = {
  en: {
    app: 'Enshrouded World Tool',
    tagline: 'Reset everything outside your Flame Altar — instantly.',

    'title.worlds': 'Enshrouded worlds',
    'title.locations': 'Save locations',
    'title.done': 'Done',
    'title.dry': 'Dry run',

    'th.num': '#',
    'th.world': 'World',
    'th.source': 'Source',
    'th.size': 'Size',
    'th.rev': 'Rev',
    'th.saved': 'Last save',
    'th.base': 'Base',
    'th.chunk': 'chunk_persistent_data',

    'cell.none': 'none (clean)',
    'cell.compressed': '(compressed)',
    'cell.unreadable': '(unreadable)',
    'cell.chunkRow': '{size} · {n} chunks',

    'l.file': 'file',
    'l.explorer': 'Explorer',
    'l.source': 'source',
    'l.size': 'size',
    'l.saved': 'last save',
    'l.sections': 'sections',
    'l.chunk': 'chunk',
    'l.chunkDetail': '{size} · {n} chunks ({spatial} spatial, {other} other) · {records} records',
    'l.base': 'base',

    'p.world': 'World number (l = language, q = quit)',
    'p.choice': 'Choice',
    'p.back': 'Press Enter to return to the menu',
    'p.restore': 'Backup number to restore (empty = cancel)',
    'p.confirmReset': 'All changes outside Flame Altar bases on this world will be reset (terrain, chest states, POIs).',
    'p.confirmRestore': 'This backup will be restored:',

    'm.title': 'Actions',
    'm.reset': 'Apply chunk reset (reset everything outside bases)',
    'm.verify': 'Verify integrity (section hashes)',
    'm.backup': 'Create a backup',
    'm.backups': 'List / restore backups',
    'm.open': 'Open folder in Explorer',
    'm.lang': 'Change language / Dili değiştir',
    'm.back': 'Back to worlds',
    'm.quit': 'Quit',

    'msg.noWorlds': 'No world*.ksd found. Use --dir to point at a folder.',
    'msg.legacy': '{n} legacy (pre-1.0, hex-named) save(s) found — not supported.',
    'msg.total': 'total {n} worlds · local time',
    'msg.noChunk': 'This world has no chunk_persistent_data; nothing to do.',
    'msg.cancelled': 'cancelled',
    'msg.gameRunning': 'Enshrouded is running — quit the game first.',
    'msg.clientRunning': 'Enshrouded is running — quit the game first.',
    'msg.serverRunning': 'The dedicated server is running — stop it first (it writes the world on shutdown).',
    'msg.verifyFailed': 'verification failed, backup restored: {detail}',
    'msg.noBackups': 'no backups',
    'msg.badNumber': 'invalid number',
    'msg.verified': '{name}: {n} section hashes OK',
    'msg.badSections': 'corrupt section(s): {list}',
    'msg.backup': 'backup: {path}',
    'msg.restored': 'restored · copy of previous state: {path}',
    'msg.opened': 'opened: {path}',
    'msg.folderMissing': 'folder not found: {path}',
    'msg.dryInfo': 'no file was modified (--dry-run)',
    'msg.dropped': 'dropped: {list}',
    'msg.sizeRev': 'size {a} → {b} · rev {from} → {to}',
    'msg.basesKept': '{n} Flame Altar base section(s) kept byte-for-byte',
    'msg.steam': 'Steam is running. If it asks about a cloud conflict, choose "upload local file".',
    'msg.next': 'Start the game and load the world: everything outside altars is back to its original state.',
    'msg.unknown': 'unknown command: {cmd}',
    'msg.langSet': 'Language set to English. It will be remembered.',
    'msg.needWorld': '--world <n> or --path <file> is required',
    'msg.badWorld': 'invalid world number: {n}',
    'msg.worldsMissing': 'no worlds found',
    'msg.fileMissing': 'file not found: {path}',
    'msg.dropList': 'drop',

    'h.usage': 'Usage',
    'h.selection': 'Selection',
    'h.notes': 'Notes',
    'h.cmd.menu': 'interactive menu',
    'h.cmd.list': 'list worlds',
    'h.cmd.reset': 'reset a world',
    'h.cmd.verify': 'verify section hashes',
    'h.cmd.backup': 'create a backup',
    'h.cmd.backups': 'list backups',
    'h.cmd.restore': 'restore a backup',
    'h.cmd.where': 'show save locations (physical + Explorer name)',
    'h.cmd.open': 'open a folder in Explorer',
    'h.arg.world': 'world number from the list (1-based)',
    'h.arg.path': 'path to a worldN.ksd file',
    'h.arg.dir': 'extra search folder (e.g. server savegame); repeatable',
    'h.arg.lang': 'ui language: en (default) or tr',
    'h.note.reset': 'reset drops the chunk_persistent_data section; Flame Altar (baseNN) data is kept as-is.',
    'h.note.write': 'Writing is refused while the game or the dedicated server is running. A backup is taken before every write.',
    'h.note.steam': 'If Steam asks about a cloud conflict, choose "upload local file".',
    'h.note.loc': 'Windows localizes some folders: "Saved Games" is shown as "Kaydedilen Oyunlar" on Turkish systems.',
  },

  tr: {
    app: 'Enshrouded Dünya Aracı',
    tagline: 'Flame Altar dışındaki her şeyi anında sıfırla.',

    'title.worlds': 'Enshrouded dünyaları',
    'title.locations': 'Kayıt konumları',
    'title.done': 'Tamamlandı',
    'title.dry': 'Kuru çalıştırma',

    'th.num': '#',
    'th.world': 'Dünya',
    'th.source': 'Kaynak',
    'th.size': 'Boyut',
    'th.rev': 'Rev',
    'th.saved': 'Son kayıt',
    'th.base': 'Base',
    'th.chunk': 'chunk_persistent_data',

    'cell.none': 'yok (temiz)',
    'cell.compressed': '(sıkıştırılmış)',
    'cell.unreadable': '(okunamadı)',
    'cell.chunkRow': '{size} · {n} chunk',

    'l.file': 'dosya',
    'l.explorer': 'Explorer',
    'l.source': 'kaynak',
    'l.size': 'boyut',
    'l.saved': 'son kayıt',
    'l.sections': 'bölümler',
    'l.chunk': 'chunk',
    'l.chunkDetail': '{size} · {n} chunk ({spatial} mekânsal, {other} diğer) · {records} kayıt',
    'l.base': 'base',

    'p.world': 'Dünya numarası (l = dil, q = çıkış)',
    'p.choice': 'Seçim',
    'p.back': 'Menüye dönmek için Enter',
    'p.restore': 'Geri yüklenecek numara (boş = vazgeç)',
    'p.confirmReset': 'Bu dünyada Flame Altar dışındaki tüm değişiklikler sıfırlanacak (terrain, sandık durumları, POI).',
    'p.confirmRestore': 'Bu yedek geri yüklenecek:',

    'm.title': 'İşlemler',
    'm.reset': 'Chunk reset uygula (base dışındaki her şeyi sıfırla)',
    'm.verify': 'Bütünlük doğrula (bölüm hash\'leri)',
    'm.backup': 'Yedek al',
    'm.backups': 'Yedekleri listele / geri yükle',
    'm.open': 'Klasörü Explorer\'da aç',
    'm.lang': 'Dili değiştir / Change language',
    'm.back': 'Dünyalara dön',
    'm.quit': 'Çıkış',

    'msg.noWorlds': 'Hiç world*.ksd bulunamadı. --dir ile klasör gösterebilirsin.',
    'msg.legacy': '{n} adet 1.0 öncesi (hex adlı) kayıt görüldü — desteklenmiyor.',
    'msg.total': 'toplam {n} dünya · tarih/saat yerel',
    'msg.noChunk': 'Bu dünyada chunk_persistent_data yok; yapılacak bir şey yok.',
    'msg.cancelled': 'iptal edildi',
    'msg.gameRunning': 'Enshrouded çalışıyor — önce oyundan tamamen çık.',
    'msg.clientRunning': 'Enshrouded çalışıyor — önce oyundan tamamen çık.',
    'msg.serverRunning': 'Dedicated sunucu çalışıyor — önce durdur (kapanırken dünyayı diske yazar).',
    'msg.verifyFailed': 'doğrulama başarısız, yedek geri yüklendi: {detail}',
    'msg.noBackups': 'yedek yok',
    'msg.badNumber': 'geçersiz numara',
    'msg.verified': '{name}: {n} bölüm hash\'i doğru',
    'msg.badSections': 'bozuk bölüm: {list}',
    'msg.backup': 'yedek: {path}',
    'msg.restored': 'geri yüklendi · mevcut hâlin kopyası: {path}',
    'msg.opened': 'açıldı: {path}',
    'msg.folderMissing': 'klasör yok: {path}',
    'msg.dryInfo': 'hiçbir dosya değiştirilmedi (--dry-run)',
    'msg.dropped': 'düşürüldü: {list}',
    'msg.sizeRev': 'boyut {a} → {b} · rev {from} → {to}',
    'msg.basesKept': '{n} Flame Altar base bölümü baytına kadar korundu',
    'msg.steam': 'Steam açık. Bulut çakışması sorarsa "yerel dosyayı yükle" seç.',
    'msg.next': 'Şimdi oyunu aç, dünyayı yükle: altar dışı her şey orijinal hâline döner.',
    'msg.unknown': 'bilinmeyen komut: {cmd}',
    'msg.langSet': 'Dil Türkçe olarak ayarlandı. Hatırlanacak.',
    'msg.needWorld': '--world <n> ya da --path <dosya> gerekli',
    'msg.badWorld': 'geçersiz dünya numarası: {n}',
    'msg.worldsMissing': 'dünya bulunamadı',
    'msg.fileMissing': 'dosya yok: {path}',
    'msg.dropList': 'düşürülecek',

    'h.usage': 'Kullanım',
    'h.selection': 'Seçim',
    'h.notes': 'Notlar',
    'h.cmd.menu': 'etkileşimli menü',
    'h.cmd.list': 'dünyaları listele',
    'h.cmd.reset': 'bir dünyayı sıfırla',
    'h.cmd.verify': 'bölüm hash\'lerini doğrula',
    'h.cmd.backup': 'yedek al',
    'h.cmd.backups': 'yedekleri listele',
    'h.cmd.restore': 'yedeği geri yükle',
    'h.cmd.where': 'kayıt konumları (fiziksel + Explorer adı)',
    'h.cmd.open': 'klasörü Explorer\'da aç',
    'h.arg.world': 'listedeki dünya numarası (1\'den başlar)',
    'h.arg.path': 'worldN.ksd dosyasının yolu',
    'h.arg.dir': 'ek arama klasörü (örn. sunucu savegame); tekrarlanabilir',
    'h.arg.lang': 'arayüz dili: en (varsayılan) veya tr',
    'h.note.reset': 'reset, chunk_persistent_data bölümünü düşürür; Flame Altar (baseNN) verisi aynen korunur.',
    'h.note.write': 'Oyun ya da dedicated sunucu çalışırken yazma reddedilir. Her yazmadan önce yedek alınır.',
    'h.note.steam': 'Steam bulut çakışması sorarsa "yerel dosyayı yükle" seç.',
    'h.note.loc': 'Windows bazı klasörleri yerelleştirir: "Saved Games" Türkçe sistemde "Kaydedilen Oyunlar" görünür.',
  },
};

const SUPPORTED = Object.keys(dict);
const CONFIG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ewt.config.json');

let lang = 'en';

export const supported = () => [...SUPPORTED];
export const getLang = () => lang;

export function setLang(l, { persist = true } = {}) {
  if (!SUPPORTED.includes(l)) return false;
  lang = l;
  if (persist) {
    try {
      const cfg = readConfig();
      cfg.lang = l;
      fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));
    } catch {}
  }
  return true;
}

export function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { return {}; }
}

export function resolveLang(argv = []) {
  const i = argv.indexOf('--lang');
  const fromArg = i >= 0 ? argv[i + 1] : null;
  const fromEnv = process.env.EWT_LANG;
  const fromCfg = readConfig().lang;
  for (const c of [fromArg, fromEnv, fromCfg]) {
    if (c && SUPPORTED.includes(String(c).toLowerCase())) return String(c).toLowerCase();
  }
  return 'en';
}

export function t(key, vars) {
  const d = dict[lang] ?? dict.en;
  let s = d[key] ?? dict.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
