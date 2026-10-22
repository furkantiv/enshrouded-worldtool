# Findings

Investigation notes behind `ewt`. Everything here was produced by inspecting local
Enshrouded 1.0 save files, the game log, and public sources. Nothing was recovered
from original source code.

## Contents

| File | What it covers |
| --- | --- |
| [findings/save-format.md](findings/save-format.md) | `SV2C` container: header, section table, block layout |
| [findings/chunk-persistent-data.md](findings/chunk-persistent-data.md) | Internal layout of the `chunk_persistent_data` section |
| [findings/world-reset.md](findings/world-reset.md) | How the game resets areas outside Flame Altars, and the timer history |
| [findings/experiment-2026-10-22.md](findings/experiment-2026-10-22.md) | Controlled before/after measurement on one world |
| [findings/sources.md](findings/sources.md) | Public sources, dates, and what each one claims |

## Evidence conventions

- **Observed** — measured directly on a file or log (`observed`).
- **Derived** — follows from a validated structure (for example: an offset chain that
  closes exactly at the end of the section).
- **Inferred** — a reading of observed data that was not independently confirmed.
- **Unknown** — not established; listed explicitly instead of guessed.

## Scope and privacy

- Notes reference paths as `%USERPROFILE%\Saved Games\...` and `<SteamID>`; no account
  identifiers or absolute personal paths are recorded.
- Measurements come from save files that were backed up before any modification.
- The tool never ran against a save without a byte-identical backup.
