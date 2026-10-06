// ── The token card's conditions ────────────────────────────────
// What the token is under, as pills with a remove button, and a picker of every condition there is
// (the default ones and the player's own) to switch on and off. Each switch is one undo step.

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Condition } from '../conditions';
import { conditionBadge } from '../conditions/icon';
import { allConditions } from '../conditions/library';
import { hasCondition, toggleCondition } from '../conditions/tokens';
import type { TokenElement } from '../core/types';

// The badge is built from DOM nodes (never an HTML string: names and colors are text players typed),
// so it is put in place by hand. The wrapper takes no room of its own.
function Badge({ condition, size }: { condition: Condition; size: number }) {
  return (
    <span
      style={{ display: 'contents' }}
      ref={(el) => el?.replaceChildren(conditionBadge(condition, size))}
    />
  );
}

export function TokenConditions({ token }: { token: TokenElement }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [choices, setChoices] = useState<readonly Condition[]>([]);
  const addButton = useRef<HTMLButtonElement>(null);
  const filterField = useRef<HTMLInputElement>(null);
  const conditions = token.conditions ?? [];

  // Another token: start with the picker shut.
  useEffect(() => setOpen(false), [token]);
  // Focus goes into the field as soon as the picker is there, before anything else can be pressed (a layout effect:
  // an ordinary one waits until after the next paint).
  useLayoutEffect(() => {
    if (open) filterField.current?.focus();
  }, [open]);

  const toggle = () => {
    if (!open) {
      setFilter('');
      setChoices(allConditions()); // fresh each time, so conditions made in Settings are there
    }
    setOpen(!open);
  };

  const wanted = filter.trim().toLowerCase();
  const matches = (c: Condition) => !wanted || c.name.toLowerCase().includes(wanted);

  return (
    <div id="token-conditions" role="group" aria-label="Token conditions">
      <div class="tc-head">
        <span class="tc-label">Conditions</span>
        <button
          type="button"
          id="token-cond-add"
          class="tc-add"
          aria-expanded={open}
          aria-controls="token-cond-picker"
          ref={addButton}
          onClick={toggle}
        >
          {open ? 'Done' : '+ Add'}
        </button>
      </div>
      <div id="token-cond-pills" class="tc-pills">
        {conditions.length === 0 && <span class="tc-none">None</span>}
        {conditions.map((condition) => (
          <span class="tc-pill" key={condition.id}>
            <Badge condition={condition} size={18} />
            <span>{condition.name}</span>
            <button
              type="button"
              aria-label={`Remove ${condition.name}`}
              onClick={() => toggleCondition(token, condition)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: one keydown handler for the whole picker (Escape shuts it, Enter in its field switches the first match) */}
      <div
        id="token-cond-picker"
        class="tc-picker"
        hidden={!open}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            addButton.current?.focus();
            e.stopPropagation(); // Escape here shuts the picker; it does not also deselect the token
          } else if (e.key === 'Enter' && e.target === filterField.current) {
            // Enter switches the first condition the filter leaves, so "pro", Enter is Prone.
            const first = choices.find(matches);
            if (first) toggleCondition(token, first);
            e.preventDefault();
          }
        }}
      >
        <input
          type="text"
          id="token-cond-filter"
          placeholder="Type to filter"
          aria-label="Filter conditions"
          autoComplete="off"
          spellcheck={false}
          value={filter}
          ref={filterField}
          onInput={(e) => setFilter(e.currentTarget.value)}
        />
        <div id="token-cond-grid" class="tc-grid" role="group" aria-label="Conditions to choose from">
          {choices.map((condition) => (
            <button
              type="button"
              class="tc-cond"
              key={condition.id}
              data-id={condition.id}
              hidden={!matches(condition)}
              aria-pressed={hasCondition(token, condition.id)}
              onClick={() => toggleCondition(token, condition)}
            >
              <Badge condition={condition} size={20} />
              <span>{condition.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
