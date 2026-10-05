import { describe, expect, it } from 'vitest';
import { parseChangelog } from '../../../src/ui/changelog-parse';

describe('parseChangelog', () => {
  it('reads versions, dates and bullets, newest first as written', () => {
    const md =
      '# Changelog\n\n## 1.2.0 - 2026-01-02\n- Added a thing\n- Fixed another\n\n## 1.1.0 - 2025-12-01\n- Older\n';
    expect(parseChangelog(md)).toEqual([
      { version: '1.2.0', date: '2026-01-02', changes: ['Added a thing', 'Fixed another'] },
      { version: '1.1.0', date: '2025-12-01', changes: ['Older'] },
    ]);
  });

  it('allows a heading with no date and * bullets', () => {
    expect(parseChangelog('## 0.1.0\n* One\n')).toEqual([{ version: '0.1.0', date: null, changes: ['One'] }]);
  });

  it('joins a bullet wrapped onto indented lines', () => {
    const md = '## 1.0.0 - 2026-01-01\n- A long bullet that\n  wraps onto\n  three lines\n- Next\n';
    expect(parseChangelog(md)[0].changes).toEqual(['A long bullet that wraps onto three lines', 'Next']);
  });

  it('ignores the title, intro text and stray lines', () => {
    const md = '# Changelog\n\nSome intro.\n\n## 1.0.0\nstray line\n- Real\n';
    expect(parseChangelog(md)).toEqual([{ version: '1.0.0', date: null, changes: ['Real'] }]);
  });

  it('handles Windows line endings', () => {
    expect(parseChangelog('## 1.0.0 - 2026-01-01\r\n- One\r\n  more\r\n')[0].changes).toEqual(['One more']);
  });

  it('returns nothing for text with no releases', () => {
    expect(parseChangelog('')).toEqual([]);
    expect(parseChangelog('# Changelog\n- orphan bullet\n')).toEqual([]);
  });
});
