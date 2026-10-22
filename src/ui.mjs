import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const tty = output.isTTY && !process.env.NO_COLOR;
const wrap = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export const c = {
  bold: wrap('1'), dim: wrap('2'), red: wrap('31'), green: wrap('32'),
  yellow: wrap('33'), blue: wrap('36'), magenta: wrap('35'),
};

export const bytes = (n) => {
  if (n == null) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

export const when = (ms) => new Date(ms).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

const width = (s) => [...String(s)].reduce((w, ch) => w + (ch.codePointAt(0) > 0x2e80 ? 2 : 1), 0);
export const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - width(s)));

export function table(headers, rows) {
  const widths = headers.map((h, i) => Math.max(...[h, ...rows.map(r => r[i] ?? '')].map(width)));
  const line = (cells) => cells.map((v, i) => pad(v ?? '', widths[i])).join('  ');
  return [c.bold(line(headers)), c.dim(widths.map(w => '─'.repeat(w)).join('  ')), ...rows.map(line)].join('\n');
}

let rl;
export function rlOpen() {
  if (!rl) rl = readline.createInterface({ input, output });
  return rl;
}
export function rlClose() {
  if (rl) { try { rl.close(); } catch {} rl = null; }
}

export async function ask(question, { def = '' } = {}) {
  const suffix = def ? c.dim(` [${def}]`) : '';
  try {
    const r = rlOpen();
    const answer = (await r.question(`${question}${suffix}: `)).trim();
    return answer || def;
  } catch {
    return ''; // stdin closed (piped input ended) — callers treat empty as quit/back
  }
}

/** Asks for an exact word. The question text is passed in (already localized). */
export async function confirm(question, word) {
  const answer = await ask(`${question} ${c.dim(`[${word}]`)}`);
  return answer.trim().toUpperCase() === word.toUpperCase();
}

export const title = (s) => `\n${c.bold(s)}\n${c.dim('─'.repeat(Math.min(72, width(s) + 8)))}`;

export const ok = (s) => `${c.green('✔')} ${s}`;
export const warn = (s) => `${c.yellow('!')} ${s}`;
export const err = (s) => `${c.red('✘')} ${s}`;
export const info = (s) => `${c.blue('i')} ${s}`;
