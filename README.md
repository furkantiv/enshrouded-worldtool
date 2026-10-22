# ewt — Enshrouded World Tool

Reset every area outside your Flame Altar **on the next world load** — no 30-minute idle wait.

*Türkçe: [README.tr.md](README.tr.md)*

## Why

Enshrouded only keeps what is inside a Flame Altar's radius. Everything else lives in one save section, `chunk_persistent_data`, which the engine prunes over time — that is the "world reset" players notice. `ewt` removes that section from a world save, so terraforming, looted chests and POI state outside your bases are regenerated on the next load. Base sections (`baseNN`) are copied byte-for-byte.

## Requirements

- Windows
- Node.js 20+
- Enshrouded 1.0+ saves (`.ksd`). Pre-1.0 hex-named saves are not supported.

## Install

```bat
git clone https://github.com/furkantiv/enshrouded-worldtool.git
cd enshrouded-worldtool
ewt
```

No dependencies and no build step — Node.js is all you need. A ZIP download works too: unpack it and run `ewt.cmd`.

## Usage

```
ewt            interactive menu
ewt list       find worlds and show their state
```

| Command | Description |
| --- | --- |
| `ewt` | interactive menu |
| `ewt list [--json]` | list worlds with sizes, revision and chunk state |
| `ewt reset [--world n] [--dry-run] [--yes]` | drop `chunk_persistent_data` |
| `ewt verify [--world n]` | recompute every section hash |
| `ewt backup` / `ewt backups` | create / list backups |
| `ewt restore [--from <file>]` | restore a backup |
| `ewt where` | show save locations (physical path + Explorer name) |
| `ewt open [--backups]` | open a folder in Explorer |

Selection: `--world <n>` (number from `list`) or `--path <file>`. Extra search folders: `--dir <folder>`, repeatable — e.g. a dedicated server's `savegame`.

Language: `--lang en|tr`. The menu also switches language, and the choice is remembered in `ewt.config.json`. Default is English.

## Save discovery

- **Steam Cloud** — `<Steam>\userdata\<id>\1203620\remote\world*.ksd` (Steam path read from the registry)
- **Local** — `%USERPROFILE%\Saved Games\keen games\Enshrouded\**\world*.ksd`
- **Extra** — folders passed with `--dir`

On non-English Windows some folders are displayed localized, e.g. `Saved Games` → `Kaydedilen Oyunlar`. The physical path stays English; `ewt where` prints both.

## Safety

- Refuses to write while `enshrouded.exe` is running.
- Backup before every write: `_backups/<world>-<guid>/<timestamp>.bak` plus a JSON manifest (sha256, revision, source path).
- The rebuild is verified: section count, section names, and every retained block must be byte-identical; hashes stay untouched because blocks are never recompressed.
- Atomic write (temp file + rename). If verification fails, the backup is restored automatically.
- Backups rotate, 25 per world.

If Steam reports a cloud conflict after editing, choose **upload local file**.

### Dedicated servers

`ewt` edits the save file, so the world must not be running. Stop the server, apply, start it again:

```bat
ewt list  --dir "D:\server\savegame"
ewt reset --dir "D:\server\savegame" --world 1
```

The server writes the world on shutdown, so never edit while it is up. The restart is what makes the change take effect.

## How it works

A world save is an `SV2C` container made of named sections: `baseNN` (Flame Altar areas), `entity_chunk00`, `chunk_persistent_data`, metadata and so on. `chunk_persistent_data` holds per-chunk deltas with a small index; the game removes entries from it over time, which is exactly the "reset". Dropping the whole section performs the same operation at once.

This is a valid state: worlds that never had edits outside a base come without that section at all.

## Limitations

- The whole section is dropped. Surgical per-chunk removal is not implemented (the section's internal checksum is not reverse-engineered).
- A compressed `chunk_persistent_data` cannot be listed, but can still be dropped.
- Save-file tool only: it does not talk to a running game, and it is not an in-game console.

## License

MIT — see [LICENSE](LICENSE).
