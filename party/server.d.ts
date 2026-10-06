// Types for the unit test only: the relay itself is plain JS run by wrangler.
export function parseMessage(text: unknown): unknown;
export class InkstoneRoom {
  constructor(state: unknown);
  ready: Promise<void>;
  handleSession(ws: unknown): void;
  webSocketMessage(ws: unknown, data: unknown): void;
  webSocketClose(ws: unknown): void;
  webSocketError(ws: unknown): void;
  alarm(): Promise<void>;
}
