import { describe, expect, it } from 'vitest';
import { MAX_TOKEN_NAME, nextTokenName } from '../../../src/elements/token-names';

describe('nextTokenName', () => {
  it('adds one to a number at the end of the name', () => {
    expect(nextTokenName('Goblin 1', ['Goblin 1'])).toBe('Goblin 2');
    expect(nextTokenName('Goblin 9', ['Goblin 9'])).toBe('Goblin 10');
    expect(nextTokenName('Goblin 99', ['Goblin 99'])).toBe('Goblin 100');
  });

  it('leaves a name with no number at the end alone', () => {
    expect(nextTokenName('Gandalf', ['Gandalf'])).toBe('Gandalf');
    expect(nextTokenName('Goblin 1 the Bold', ['Goblin 1 the Bold'])).toBe('Goblin 1 the Bold');
    expect(nextTokenName('2nd Guard', ['2nd Guard'])).toBe('2nd Guard');
  });

  it('keeps the gap before the number, or the lack of one', () => {
    expect(nextTokenName('Goblin1', ['Goblin1'])).toBe('Goblin2');
    expect(nextTokenName('Goblin  3', ['Goblin  3'])).toBe('Goblin  4');
    expect(nextTokenName('Goblin #1', ['Goblin #1'])).toBe('Goblin #2');
    expect(nextTokenName('Guard-1', ['Guard-1'])).toBe('Guard-2');
  });

  it('takes the next number after the highest already used, not one that is taken', () => {
    expect(nextTokenName('Goblin 1', ['Goblin 1', 'Goblin 2', 'Goblin 3'])).toBe('Goblin 4');
    expect(nextTokenName('Goblin 2', ['Goblin 1', 'Goblin 2', 'Goblin 5'])).toBe('Goblin 6');
  });

  it('is not held back by a gap: it is the highest that counts, not the first free', () => {
    expect(nextTokenName('Goblin 1', ['Goblin 1', 'Goblin 4'])).toBe('Goblin 5');
  });

  it('only counts names with the same words', () => {
    expect(nextTokenName('Goblin 1', ['Goblin 1', 'Orc 7', 'Goblin Chief 9'])).toBe('Goblin 2');
  });

  it('does not mind capitals when deciding what is the same pack', () => {
    expect(nextTokenName('Goblin 1', ['Goblin 1', 'goblin 3', 'GOBLIN 4'])).toBe('Goblin 5');
  });

  it('keeps leading zeros, and widens when it has to', () => {
    expect(nextTokenName('Orc 09', ['Orc 09'])).toBe('Orc 10');
    expect(nextTokenName('Orc 007', ['Orc 007'])).toBe('Orc 008');
    expect(nextTokenName('Orc 01', ['Orc 01'])).toBe('Orc 02');
    expect(nextTokenName('Orc 99', ['Orc 99'])).toBe('Orc 100');
  });

  it('works for a bare number, and for names that end in a number inside a word', () => {
    expect(nextTokenName('7', ['7'])).toBe('8');
    expect(nextTokenName('R2D2', ['R2D2'])).toBe('R2D3');
  });

  it('ignores spaces at the ends of the name', () => {
    expect(nextTokenName('  Goblin 1  ', ['Goblin 1'])).toBe('Goblin 2');
  });

  it('does not count a very long run of digits as a number', () => {
    expect(nextTokenName('Goblin 12345678', ['Goblin 12345678'])).toBe('Goblin 12345678');
  });

  it('does not make a name longer than a name can be', () => {
    const name = `${'x'.repeat(MAX_TOKEN_NAME - 2)} 9`; // 20 characters
    expect(name).toHaveLength(MAX_TOKEN_NAME);
    expect(nextTokenName(name, [name])).toBe(name); // "…10" would be 21
  });

  it('copes with nothing else in use, and with names that are not numbered', () => {
    expect(nextTokenName('Goblin 1', [])).toBe('Goblin 2');
    expect(nextTokenName('Goblin 1', ['Gandalf', '', 'Goblin'])).toBe('Goblin 2');
  });

  it('numbers a batch in turn when each result is added to what is taken', () => {
    const taken = ['Orc 1', 'Orc 2'];
    const first = nextTokenName('Orc 1', taken);
    taken.push(first);
    const second = nextTokenName('Orc 2', taken);
    expect([first, second]).toEqual(['Orc 3', 'Orc 4']);
  });
});
