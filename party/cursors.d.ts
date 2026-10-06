// Types for the unit test only: the relay itself is plain JS run by wrangler.
export function parseCursorMessage(text: unknown): unknown;
export class CursorRoom {
  constructor(state: unknown);
  handleSession(ws: unknown): void;
  webSocketMessage(ws: unknown, data: unknown): void;
  webSocketClose(ws: unknown): void;
  webSocketError(ws: unknown): void;
}
