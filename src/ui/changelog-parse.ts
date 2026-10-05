// ── CHANGELOG.md parser ───────────────────────────────────────
// Reads the small subset of Markdown CHANGELOG.md uses: a `## version - date`
// heading per release, each followed by `- ` bullets. A bullet may wrap onto
// indented continuation lines. Anything else (the title, intro text, blank
// lines) is ignored.

export interface ChangelogEntry {
  version: string;
  date: string | null;
  changes: string[];
}

export function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+(\S+)(?:\s+-\s+(.+?))?\s*$/.exec(line);
    if (heading) {
      entries.push({ version: heading[1], date: heading[2] ?? null, changes: [] });
      continue;
    }
    const changes = entries.at(-1)?.changes;
    if (!changes) continue;
    const bullet = /^[-*]\s+(.+?)\s*$/.exec(line);
    if (bullet) {
      changes.push(bullet[1]);
    } else if (/^\s+\S/.test(line) && changes.length > 0) {
      changes[changes.length - 1] += ` ${line.trim()}`;
    }
  }
  return entries;
}
