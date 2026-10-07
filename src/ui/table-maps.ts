// ── The table's maps ───────────────────────────────────────────
// In the Share popover: the maps this table holds (the floors of a building, say), the one it is on marked.
// Choosing another moves the table there at once, for everyone: the table keeps each map as it was left, so
// there is nothing to lose and nothing to ask. A map can be taken off the table (after asking, since what is
// drawn on it goes with it); one can't be taken off while the table is on it. A new map is brought to the table
// from the library (ui/maps.ts), which asks.
//
// Plain DOM, built from nodes, never an HTML string: a map's name is text a player typed.

import { dropTableMap, gotoTableMap, onTableChanged, tableInfo } from '../collab/collab';
import { byId } from '../core/dom';
import { showConfirm } from './modal';

const list = byId('share-maps');

function item(id: string, name: string, current: boolean, removable: boolean): HTMLLIElement {
  const title = name || 'Untitled map';
  const li = document.createElement('li');
  li.className = current ? 'table-map is-current' : 'table-map';

  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'table-map-go';
  go.textContent = title;
  if (current) go.setAttribute('aria-current', 'true');
  go.addEventListener('click', () => gotoTableMap(id));
  li.append(go);

  if (removable) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'table-map-remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Take ${title} off the table`);
    remove.title = 'Take it off the table';
    remove.addEventListener('click', () =>
      showConfirm(
        `Take "${title}" off the table? Everything drawn on it goes with it.`,
        () => dropTableMap(id),
        'Take it off',
      ),
    );
    li.append(remove);
  }
  return li;
}

function render(): void {
  const { current, maps } = tableInfo();
  list.replaceChildren(...maps.map((m) => item(m.id, m.name, m.id === current, m.id !== current)));
}

onTableChanged(render);
