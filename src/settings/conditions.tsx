// ── Settings: the Conditions panel ─────────────────────────────
// Where a player makes their own conditions (a name, a color, an icon) to use alongside the default
// ones, and edits or removes them. The default ones are listed for reference and can't be changed.
// What is made is kept in this browser (conditions/library.ts). Editing one brings the copy on every
// token that has it up to date; removing one only takes it off the list to choose from.
//
// It is a Preact component (see ui/library.tsx), drawn into #cond-root. Its state is the form's (what is
// being edited, the name, color and icon, the problem shown); the list of their own conditions is read
// from conditions/library.ts, and drawn again after each change to it.

import { render } from 'preact';
import { useLayoutEffect, useReducer, useRef, useState } from 'preact/hooks';
import { type Condition, DEFAULT_CONDITIONS, ICON_NAMES } from '../conditions';
import { addCustom, customConditions, draftProblem, removeCustom, updateCustom } from '../conditions/library';
import { refreshCondition } from '../conditions/tokens';
import { byId } from '../core/dom';
import { Badge, Glyph } from '../ui/condition-badge';
import { showToast } from '../ui/toast';
import { flashSaved } from './saved';

// A choice of colors that read well behind a white icon, plus any color of their own.
const COLORS = [
  '#c0267a',
  '#a3322e',
  '#c2610c',
  '#a16207',
  '#2f7d32',
  '#0f766e',
  '#0e6f8f',
  '#1f4fae',
  '#6d4fc7',
  '#a22fb0',
  '#57534e',
  '#475569',
];
const FIRST_ICON = 'star';
const ARROW_STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

function Row({ condition, children }: { condition: Condition; children?: preact.ComponentChildren }) {
  return (
    <li class="cond-row">
      <Badge condition={condition} size={22} />
      <span class="cond-name">{condition.name}</span>
      {children}
    </li>
  );
}

function Conditions() {
  const [, listChanged] = useReducer((n: number) => n + 1, 0);
  const [editingId, setEditingId] = useState<string | null>(null); // the one being edited, or null for a new one
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState(FIRST_ICON);
  const [problem, setProblem] = useState('');

  const form = useRef<HTMLFormElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const icons = useRef<HTMLDivElement>(null);
  const focusName = useRef(false); // asked for by Edit, carried out once the form shows the condition

  useLayoutEffect(() => {
    if (!focusName.current) return;
    focusName.current = false;
    form.current?.scrollIntoView({ block: 'nearest' });
    nameField.current?.focus();
    nameField.current?.select();
  });

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setProblem('');
    setColor(COLORS[0]);
    setIcon(FIRST_ICON);
  };

  const startEditing = (condition: Condition) => {
    setEditingId(condition.id);
    setName(condition.name);
    setProblem('');
    setColor(condition.color);
    setIcon(condition.icon);
    focusName.current = true;
  };

  const remove = (condition: Condition) => {
    removeCustom(condition.id);
    flashSaved();
    if (editingId === condition.id) resetForm();
    listChanged(0);
    showToast('Removed. Tokens that already have it keep it.');
  };

  const submit = (e: Event) => {
    e.preventDefault();
    const draft = { name, color, icon };
    const why = draftProblem(draft, editingId ?? undefined);
    setProblem(why ?? '');
    if (why) {
      nameField.current?.focus();
      return;
    }
    if (editingId) {
      const updated = updateCustom(editingId, draft);
      if (updated) refreshCondition(updated); // the tokens that have it show the change
    } else {
      addCustom(draft);
    }
    flashSaved();
    listChanged(0);
    resetForm();
  };

  const mine = customConditions();
  const editing = editingId !== null;

  return (
    <>
      <div class="settings-field">
        <div class="settings-sublabel" id="cond-custom-heading">
          Your conditions
        </div>
        <ul class="cond-list" id="cond-custom-list" aria-labelledby="cond-custom-heading">
          {mine.map((condition) => (
            <Row condition={condition} key={condition.id}>
              <button
                type="button"
                aria-label={`Edit ${condition.name}`}
                onClick={() => startEditing(condition)}
              >
                Edit
              </button>
              <button type="button" aria-label={`Delete ${condition.name}`} onClick={() => remove(condition)}>
                Delete
              </button>
            </Row>
          ))}
        </ul>
        <p class="settings-example" id="cond-custom-empty" hidden={mine.length > 0}>
          None yet. Make one below.
        </p>
      </div>

      <form
        class="settings-field cond-form"
        id="cond-form"
        noValidate
        aria-labelledby="cond-form-title"
        data-editing={String(editing)}
        ref={form}
        onSubmit={submit}
      >
        <div class="settings-sublabel" id="cond-form-title">
          {editing ? 'Edit condition' : 'Add a condition'}
        </div>
        <div class="cond-form-top">
          <div class="cond-field">
            <label for="cond-name">Name</label>
            <input
              type="text"
              id="cond-name"
              maxLength={20}
              placeholder="e.g. Hexed"
              autoComplete="off"
              spellcheck={false}
              ref={nameField}
              value={name}
              onInput={(e) => {
                setName(e.currentTarget.value);
                setProblem('');
              }}
            />
          </div>
          <div class="cond-preview" aria-hidden="true">
            <span id="cond-preview-badge">
              <Badge condition={{ id: 'preview', name: name.trim(), color, icon }} size={26} />
            </span>
            <span id="cond-preview-name">{name.trim() || 'Condition'}</span>
          </div>
        </div>
        <fieldset class="cond-field">
          <legend>Color</legend>
          <div class="cond-colors" id="cond-colors">
            {COLORS.map((hex) => (
              <button
                type="button"
                class="token-swatch"
                style={{ background: hex }}
                data-color={hex}
                aria-label={`Color ${hex}`}
                aria-pressed={color === hex}
                onClick={() => setColor(hex)}
              />
            ))}
            <label
              class={`token-swatch token-swatch-custom${COLORS.includes(color) ? '' : ' selected'}`}
              title="Any color"
            >
              <input
                type="color"
                aria-label="Any color"
                value={color}
                onInput={(e) => setColor(e.currentTarget.value.toLowerCase())}
              />
            </label>
          </div>
        </fieldset>
        <fieldset class="cond-field">
          <legend>Icon</legend>
          {/* The arrow keys move between icons, as in any group of radio buttons. */}
          <div
            class="cond-icons"
            id="cond-icons"
            role="radiogroup"
            aria-label="Icon"
            ref={icons}
            onKeyDown={(e) => {
              const step = ARROW_STEP[e.key];
              if (!step) return;
              e.preventDefault();
              const at = ICON_NAMES.indexOf(icon);
              const next = ICON_NAMES[(at + step + ICON_NAMES.length) % ICON_NAMES.length];
              setIcon(next);
              icons.current?.querySelector<HTMLButtonElement>(`[data-icon="${next}"]`)?.focus();
            }}
          >
            {ICON_NAMES.map((iconName) => {
              const label = iconName.replace(/-/g, ' ');
              const on = iconName === icon;
              return (
                <button
                  type="button"
                  class="icon-choice"
                  data-icon={iconName}
                  role="radio"
                  aria-label={label}
                  aria-checked={on}
                  tabIndex={on ? 0 : -1} // one stop for the group; the arrow keys move within it
                  title={label}
                  onClick={() => setIcon(iconName)}
                >
                  <Glyph icon={iconName} size={20} />
                </button>
              );
            })}
          </div>
        </fieldset>
        <p class="settings-error" id="cond-problem" role="alert">
          {problem}
        </p>
        <div class="cond-actions">
          <button type="submit" class="btn-primary" id="cond-save">
            {editing ? 'Save changes' : 'Add condition'}
          </button>
          <button type="button" class="btn-secondary" id="cond-cancel" hidden={!editing} onClick={resetForm}>
            Cancel
          </button>
        </div>
      </form>

      <div class="settings-field">
        <div class="settings-sublabel" id="cond-default-heading">
          Default conditions
        </div>
        <ul
          class="cond-list cond-list-defaults"
          id="cond-default-list"
          aria-labelledby="cond-default-heading"
        >
          {DEFAULT_CONDITIONS.map((condition) => (
            <Row condition={condition} key={condition.id} />
          ))}
        </ul>
      </div>
    </>
  );
}

render(<Conditions />, byId('cond-root'));
