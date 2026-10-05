// Types for the unit test only: the relay itself is plain JS run by wrangler.
export function parseMessage(text: unknown): unknown;
export class InkstoneRoom {
  constructor(state: unknown);
  ready: Promise<void>;
  handleSession(ws: unknown): void;
  alarm(): Promise<void>;
}
