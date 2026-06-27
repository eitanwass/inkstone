// ── Collab relay (PartyKit room server) ─────────────────────────
// One room per session id. Pure relay, no merge logic — last message
// received wins, matching the client's last-write-wins sync model
// (see src/collab.js). lastState is kept in memory only so a client
// joining an already-active session gets caught up; it's not a durable
// store, since every client's own localStorage already has a copy.

export default class InkstoneRoom {
  constructor(room) {
    this.room = room;
    this.lastState = null;
  }

  onConnect(connection) {
    if (this.lastState) connection.send(this.lastState);
  }

  onMessage(message, sender) {
    this.lastState = message;
    for (const connection of this.room.getConnections()) {
      if (connection.id !== sender.id) connection.send(message);
    }
  }
}
