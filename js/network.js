// Short-code multiplayer via PeerJS
class NetManager {
  constructor() {
    this.isHost = false;
    this.roomCode = '';
    this.localId = 'p' + Math.random().toString(36).slice(2, 7);
    this.players = [];
    this.peer = null;
    this.conns = new Map();
    this.onUpdate = null;
  }

  code() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 5; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  }

  async host() {
    this.isHost = true;
    this.roomCode = this.code();
    this.players = [{ id: this.localId, name: 'Host', ready: false, isLocal: true }];
    return new Promise((resolve) => {
      try {
        this.peer = new Peer('ba-' + this.roomCode);
        this.peer.on('open', () => {
          if (this.onUpdate) this.onUpdate(this.players);
          resolve(this.roomCode);
        });
        this.peer.on('connection', (conn) => this._bind(conn));
        this.peer.on('error', () => resolve(this.roomCode));
      } catch (e) {
        resolve(this.roomCode);
      }
    });
  }

  async join(code) {
    this.isHost = false;
    this.roomCode = code.toUpperCase().trim();
    this.players = [{ id: this.localId, name: 'Player', ready: false, isLocal: true }];
    return new Promise((resolve) => {
      try {
        this.peer = new Peer();
        this.peer.on('open', () => {
          const conn = this.peer.connect('ba-' + this.roomCode, { reliable: true });
          conn.on('open', () => {
            this._bind(conn);
            this.send({ type: 'join', id: this.localId, name: 'Player' });
            resolve(true);
          });
          conn.on('error', () => resolve(false));
        });
        this.peer.on('error', () => resolve(false));
        setTimeout(() => resolve(false), 7000);
      } catch (e) {
        resolve(false);
      }
    });
  }

  solo() {
    this.isHost = true;
    this.roomCode = 'SOLO';
    this.players = [{ id: this.localId, name: 'You', ready: true, isLocal: true }];
    if (this.onUpdate) this.onUpdate(this.players);
  }

  _bind(conn) {
    this.conns.set(conn.peer, conn);
    conn.on('data', (raw) => {
      const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
      this._onMsg(msg);
    });
  }

  _onMsg(msg) {
    if (msg.type === 'join' && this.isHost) {
      this.players.push({ id: msg.id, name: msg.name || 'Player', ready: false, isLocal: false });
      this.broadcast({ type: 'roster', players: this.players.map(p => ({ ...p, isLocal: false })) });
      if (this.onUpdate) this.onUpdate(this.players);
    }
    if (msg.type === 'roster' && !this.isHost) {
      const me = this.players.find(p => p.id === this.localId);
      this.players = msg.players.map(p => ({ ...p, isLocal: p.id === this.localId }));
      if (me && !this.players.find(p => p.id === me.id)) this.players.push(me);
      if (this.onUpdate) this.onUpdate(this.players);
    }
    if (msg.type === 'ready') {
      const p = this.players.find(x => x.id === msg.id);
      if (p) { p.ready = true; p.name = msg.name || p.name; }
      if (this.onUpdate) this.onUpdate(this.players);
    }
    if (msg.type === 'start' && this.onStart) this.onStart(msg.players);
  }

  send(obj) {
    this.conns.forEach(c => { try { if (c.open) c.send(obj); } catch (e) {} });
  }

  broadcast(obj) { this.send(obj); }

  setReady(name) {
    const p = this.players.find(x => x.id === this.localId);
    if (p) { p.ready = true; p.name = name; }
    this.broadcast({ type: 'ready', id: this.localId, name });
    if (this.onUpdate) this.onUpdate(this.players);
  }

  allReady() {
    return this.players.length >= 1 && this.players.every(p => p.ready);
  }

  startMatch(players) {
    this.broadcast({ type: 'start', players });
  }
}
const Net = new NetManager();
