// ── The feedback dialog ────────────────────────────────────────
// The speech-bubble button in the top bar opens a small form: a message, an email if the player would like an
// answer, and a choice to attach their map (it helps most when something isn't working). It goes through the relay
// to the owner's private channel (feedback-send.ts, party/feedback.js). The text is kept if sending fails, and the
// form starts fresh the next time after one was sent.
//
// A Preact component (see library.tsx), drawn into #feedback-root; what every modal does is use-modal.ts.

import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { version } from '../../package.json';
import { byId } from '../core/dom';
import {
  feedbackBody,
  feedbackProblem,
  MAX_EMAIL,
  MAX_MAP,
  MAX_MESSAGE,
  SEND_PROBLEMS,
} from '../core/feedback';
import { state } from '../core/state';
import { sendFeedback } from '../feedback-send';
import { currentMapText } from './map-text';
import { useModal } from './use-modal';

type Status = 'writing' | 'sending' | 'sent';

function Feedback() {
  const { open, close, modal, onBackdropClick } = useModal(byId('btn-feedback'));
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // the hidden field
  const [attach, setAttach] = useState(false);
  const [status, setStatus] = useState<Status>('writing');
  const [problem, setProblem] = useState('');

  // Opened again after one was sent: a fresh form.
  useEffect(() => {
    if (open && status === 'sent') {
      setMessage('');
      setAttach(false);
      setProblem('');
      setStatus('writing');
    }
  }, [open]);

  const hasMap = state.elements.length > 0;

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    if (status === 'sending') return;
    const found = feedbackProblem({ message, email });
    if (found) {
      setProblem(found);
      return;
    }
    // The map goes as it is, or without its pictures if that is too big, and not at all if it still is.
    let map: string | null = null;
    if (attach && hasMap) {
      map = currentMapText();
      if (map.length > MAX_MAP) map = currentMapText(false);
      if (map.length > MAX_MAP) {
        setProblem("Your map is too big to attach. Untick that and send your message, and say what's wrong.");
        return;
      }
    }
    setProblem('');
    setStatus('sending');
    const result = await sendFeedback(
      feedbackBody(
        { message, email, website },
        { version, screen: `${window.innerWidth}x${window.innerHeight}`, page: 'editor', map },
      ),
    );
    if (result === 'sent') setStatus('sent');
    else {
      setProblem(SEND_PROBLEMS[result]);
      setStatus('writing');
    }
  }

  return (
    // A click on the blurred page outside the dialog closes it.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it (use-modal.ts); the click is only for the backdrop
    // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop, not a control
    <div id="feedback-overlay" class={open ? undefined : 'hidden'} onClick={onBackdropClick}>
      <div
        id="feedback-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        tabIndex={-1}
        ref={modal}
      >
        <div id="feedback-header">
          <h2 id="feedback-title">Send feedback</h2>
          <button type="button" class="icon-btn" id="feedback-close" aria-label="Close" onClick={close}>
            <svg width="18" height="18" aria-hidden="true">
              <use href="/icons.svg#icon-close" />
            </svg>
          </button>
        </div>
        {status === 'sent' ? (
          <div id="feedback-thanks">
            <p>Thank you. Your message has been sent to the person who makes Inkstone.</p>
            <button type="button" class="btn-primary" onClick={close}>
              Close
            </button>
          </div>
        ) : (
          <form id="feedback-form" noValidate onSubmit={submit}>
            <p class="feedback-intro">A bug, an idea, or what you were trying to do. Anything helps.</p>
            <label for="feedback-message">Your message</label>
            <textarea
              id="feedback-message"
              rows={5}
              maxLength={MAX_MESSAGE}
              value={message}
              onInput={(e) => {
                setMessage(e.currentTarget.value);
                setProblem('');
              }}
            />
            <label for="feedback-email">
              Email <span class="feedback-optional">(optional, only so you can be answered)</span>
            </label>
            <input
              type="email"
              id="feedback-email"
              maxLength={MAX_EMAIL}
              autoComplete="email"
              spellcheck={false}
              value={email}
              onInput={(e) => {
                setEmail(e.currentTarget.value);
                setProblem('');
              }}
            />
            <label class="feedback-attach">
              <input
                type="checkbox"
                id="feedback-attach"
                checked={attach && hasMap}
                disabled={!hasMap}
                onChange={(e) => setAttach(e.currentTarget.checked)}
              />
              <span>
                Attach my map
                <small>
                  {hasMap
                    ? "It helps when something isn't working. It is sent with your message and nowhere else."
                    : 'There is nothing on the map to attach yet.'}
                </small>
              </span>
            </label>
            {/* Hidden from people: only a script fills this in, and its message goes nowhere */}
            <input
              type="text"
              class="feedback-trap"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onInput={(e) => setWebsite(e.currentTarget.value)}
            />
            <p class="settings-error" id="feedback-problem" role="alert">
              {problem}
            </p>
            <div class="modal-actions">
              <button type="button" class="btn-secondary" onClick={close}>
                Cancel
              </button>
              <button type="submit" class="btn-primary" id="feedback-send" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

render(<Feedback />, byId('feedback-root'));
