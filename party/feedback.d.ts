// Types for the unit test only: the relay itself is plain JS run by wrangler.
export interface Feedback {
  message: string;
  email: string;
  map: string | null;
  version: string;
  screen: string;
  page: string;
}
export function parseFeedback(data: unknown): { feedback?: Feedback; error?: string; spam?: true };
export function discordRequest(
  feedback: Feedback,
  webhook: string,
  now?: Date,
): { url: string; init: RequestInit };
export function handleFeedback(
  request: Request,
  env: { FEEDBACK_WEBHOOK?: string; FEEDBACK_GATE: unknown },
  send?: (url: string, init: RequestInit) => Promise<Response>,
): Promise<Response>;
export class FeedbackGate {
  constructor(state: unknown);
  fetch(request: Request): Promise<Response>;
  alarm(): Promise<void>;
}
