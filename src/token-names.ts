// ── Numbered token names ───────────────────────────────────────
// A pack of enemies is "Goblin 1", "Goblin 2", ... Duplicating a token whose name ends in a number
// gives the copy the next free number, so nobody has to rename each one.

// A token name is at most this long (the name field's maxlength says the same).
export const MAX_TOKEN_NAME = 20;

// "Goblin 12": the words, the gap before the number (possibly none: "Goblin12"), and the number. At
// most six digits, and no digit right before them, so a long run of digits is just part of a name
// and not a count.
const NUMBERED = /^(.*?)(\s*)(?<!\d)(\d{1,6})$/;

function split(name: string): { base: string; gap: string; digits: string } | null {
  const match = NUMBERED.exec(name.trim());
  return match ? { base: match[1], gap: match[2], digits: match[3] } : null;
}

// The name for a copy of a token called `name`, given every name already in use. If `name` doesn't
// end in a number it is returned as it is (a copy of "Gandalf" is just another "Gandalf"). If it
// does, the copy is the same words with the next number after the highest one already used with
// those words ("Goblin 1" when "Goblin 1", "Goblin 2" and "Goblin 3" exist gives "Goblin 4", not
// "Goblin 2" again). Which words count as the same ignores capitals. A number written with leading
// zeros keeps them ("Orc 09" gives "Orc 10", "Orc 007" gives "Orc 008").
export function nextTokenName(name: string, taken: Iterable<string>): string {
  const parts = split(name);
  if (!parts) return name;
  const words = parts.base.toLowerCase();

  let highest = Number(parts.digits);
  for (const other of taken) {
    const found = split(other);
    if (found && found.base.toLowerCase() === words) highest = Math.max(highest, Number(found.digits));
  }

  const next = String(highest + 1);
  const digits = parts.digits.startsWith('0') ? next.padStart(parts.digits.length, '0') : next;
  const result = `${parts.base}${parts.gap}${digits}`;
  return result.length > MAX_TOKEN_NAME ? name : result;
}
