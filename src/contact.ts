// ── The Contact page ───────────────────────────────────────────
// The same message the editor's feedback dialog sends (ui/feedback.tsx), without the map: this page is for people
// who have not opened the editor. The rest of the page is in site.ts.

import './site';
import { version } from '../package.json';
import { byId } from './core/dom';
import { feedbackBody, feedbackProblem, SEND_PROBLEMS } from './core/feedback';
import { sendFeedback } from './feedback-send';

const form = byId<HTMLFormElement>('contact-form');
const message = byId<HTMLTextAreaElement>('contact-message');
const email = byId<HTMLInputElement>('contact-email');
const trap = byId<HTMLInputElement>('contact-trap');
const problem = byId('contact-problem');
const send = byId<HTMLButtonElement>('contact-send');
const thanks = byId('contact-thanks');

message.addEventListener('input', () => {
  problem.textContent = '';
});
email.addEventListener('input', () => {
  problem.textContent = '';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (send.disabled) return;
  const draft = { message: message.value, email: email.value, website: trap.value };
  const found = feedbackProblem(draft);
  if (found) {
    problem.textContent = found;
    (found.startsWith('Write') ? message : email).focus();
    return;
  }
  problem.textContent = '';
  send.disabled = true;
  send.textContent = 'Sending…';
  const result = await sendFeedback(
    feedbackBody(draft, { version, screen: `${innerWidth}x${innerHeight}`, page: 'contact' }),
  );
  if (result === 'sent') {
    form.hidden = true;
    thanks.hidden = false;
    thanks.focus();
    return;
  }
  problem.textContent = SEND_PROBLEMS[result];
  send.disabled = false;
  send.textContent = 'Send message';
});
