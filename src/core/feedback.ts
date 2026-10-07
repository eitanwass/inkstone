// ── The feedback form: what may be sent, and what to say when it can't ──
// Pure, so it is unit tested. The limits are the Worker's (party/feedback.js), which can't import this file: keep
// them in step by hand. Used by the dialog in the editor (ui/feedback.tsx) and the Contact page (contact.ts).

export const MAX_MESSAGE = 2000;
export const MAX_EMAIL = 200;
export const MAX_MAP = 2_000_000; // characters of the attached map file

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface FeedbackDraft {
  message: string;
  email: string;
  website?: string; // a hidden field only a script fills in
}

// Why a draft can't be sent, in words, or null if it can.
export function feedbackProblem(draft: FeedbackDraft): string | null {
  if (!draft.message.trim()) return 'Write a message first.';
  const email = draft.email.trim();
  if (email && (email.length > MAX_EMAIL || !EMAIL_RE.test(email))) {
    return "That email doesn't look right. Leave it empty if you'd rather not give one.";
  }
  return null;
}

// What went wrong when sending, as a message a player can act on.
export const SEND_PROBLEMS = {
  'not-set-up': "Feedback isn't set up on this site yet.",
  busy: "You've sent a few messages already. Please try again in a while.",
  failed: "Couldn't send that. Check your connection and try again.",
} as const;
export type SendResult = 'sent' | keyof typeof SEND_PROBLEMS;

// The request body for the Worker: the message and email as typed (the Worker trims them), what helps to read them
// (the version, the screen), where it came from, and the map as file text if one is attached.
export function feedbackBody(
  draft: FeedbackDraft,
  context: { version: string; screen: string; page: 'editor' | 'contact'; map?: string | null },
): string {
  return JSON.stringify({
    message: draft.message.trim().slice(0, MAX_MESSAGE),
    email: draft.email.trim(),
    website: draft.website ?? '',
    version: context.version,
    screen: context.screen,
    page: context.page,
    ...(context.map ? { map: context.map } : {}),
  });
}
